/**
 * source-cold-warm-row-ratio: per-source split of hour-bucket *rows*
 * into "cold" (cached_input_tokens === 0) vs "warm"
 * (cached_input_tokens > 0), restricted to rows with
 * input_tokens > 0 (so cache reuse is even definable).
 *
 * For each source we report:
 *
 *   - coldRows / warmRows / nRows: row counts (one row per
 *     QueueLine that survived the input_tokens > 0 floor).
 *   - coldShare = coldRows / nRows in [0,1]: row-count share
 *     of cold rows.
 *   - coldInputTokens / warmInputTokens / inputTokens: input-token
 *     mass per class.
 *   - coldInputTokenShare = coldInputTokens / inputTokens in [0,1]:
 *     mass-weighted share of cold input.
 *   - coldRowMassGap = coldShare - coldInputTokenShare in [-1,+1]:
 *     positive = cold rows are *smaller than average* (many small
 *     uncached one-shots, big work happens on warm rows). Negative
 *     = cold rows are *larger than average* (the big jobs are the
 *     ones that miss the cache; the cache is doing well only on
 *     small follow-ups).
 *   - meanColdInput / meanWarmInput: mean input_tokens per row in
 *     each class (NaN-guarded; reported as 0 when the class is
 *     empty).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `cache-hit-ratio` is a population-of-rows distribution of
 *     `cached_input_tokens / input_tokens`. It blends the cold/warm
 *     dichotomy into a continuous ratio (cold rows have ratio = 0)
 *     and reports percentiles, not the row-count vs mass split.
 *   - `cache-hit-by-hour` projects the same ratio onto the hour-of-
 *     day axis. Different axis, still mass-weighted, no row-count.
 *   - `source-weekend-weekday-cache-share-gap` contrasts cache mass
 *     across the weekday/weekend axis only, and is mass-only.
 *   - `source-cost-class-mix` partitions rows by total_tokens
 *     buckets ("small" vs "large"). Different partition (token
 *     volume, not cache state).
 *   - `source-io-ratio-stability` is about the output/input ratio,
 *     not about cache state.
 *
 * Headline question:
 *   **"For each source, how big a share of *rows* miss the cache,
 *   and is that the same as the share of *input mass* that misses
 *   the cache?"**
 *
 * Window semantics: filter by `hour_start` (the row's own
 * timestamp), exactly like the rest of the queue-based reports.
 *
 * Determinism: pure builder. No `Date.now()` reads outside
 * `opts.generatedAt`. All sorts fully specified with source-asc
 * tie-break. Empty input returns a well-formed all-zero report.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching rows
 *     surface as `droppedSourceFilter`.
 *   - `minRows` (default 5): structural floor on nRows for a
 *     source to be reported. Sparse sources surface as
 *     `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'rows' | 'cold-share' |
 *     'cold-mass-share' | 'gap' | 'source'. 'gap' = |coldRowMassGap|
 *     desc (the most-mismatched sources first). All non-source
 *     sorts tie-break on source asc.
 */
import type { QueueLine } from './types.js';

export type SourceColdWarmRowRatioSort =
  | 'tokens'
  | 'rows'
  | 'cold-share'
  | 'cold-mass-share'
  | 'gap'
  | 'source';

export interface SourceColdWarmRowRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  top?: number;
  sort?: SourceColdWarmRowRatioSort;
  generatedAt?: string;
}

export interface SourceColdWarmRowRatioRow {
  source: string;
  /** Number of rows kept (input_tokens > 0). */
  nRows: number;
  /** Rows with cached_input_tokens === 0. */
  coldRows: number;
  /** Rows with cached_input_tokens > 0. */
  warmRows: number;
  /** coldRows / nRows in [0,1]. */
  coldShare: number;
  /** Sum of input_tokens across all kept rows. */
  inputTokens: number;
  /** Sum of input_tokens on cold rows. */
  coldInputTokens: number;
  /** Sum of input_tokens on warm rows. */
  warmInputTokens: number;
  /** coldInputTokens / inputTokens in [0,1]. 0 when inputTokens == 0. */
  coldInputTokenShare: number;
  /** coldShare - coldInputTokenShare in [-1, +1]. */
  coldRowMassGap: number;
  /** Mean input_tokens per cold row; 0 when coldRows == 0. */
  meanColdInput: number;
  /** Mean input_tokens per warm row; 0 when warmRows == 0. */
  meanWarmInput: number;
  /** Sum of total_tokens across kept rows (for sort/display). */
  totalTokens: number;
  /** First and last UTC day (yyyy-mm-dd) contributing. */
  firstDay: string;
  lastDay: string;
}

export interface SourceColdWarmRowRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minRows: number;
  top: number;
  sort: SourceColdWarmRowRatioSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveInput: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: SourceColdWarmRowRatioRow[];
}

export function buildSourceColdWarmRowRatio(
  queue: QueueLine[],
  opts: SourceColdWarmRowRatioOptions = {},
): SourceColdWarmRowRatioReport {
  const minRows = opts.minRows ?? 5;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(
      `minRows must be a non-negative integer (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: SourceColdWarmRowRatioSort = opts.sort ?? 'tokens';
  const validSorts: SourceColdWarmRowRatioSort[] = [
    'tokens',
    'rows',
    'cold-share',
    'cold-mass-share',
    'gap',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface SrcAcc {
    nRows: number;
    coldRows: number;
    warmRows: number;
    coldInputTokens: number;
    warmInputTokens: number;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveInput = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const inp = Number(q.input_tokens);
    if (!Number.isFinite(inp) || inp <= 0) {
      droppedNonPositiveInput += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const cached = Number(q.cached_input_tokens);
    const isCold = !Number.isFinite(cached) || cached === 0;
    const tt = Number(q.total_tokens);
    const ttSafe = Number.isFinite(tt) && tt > 0 ? tt : 0;
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        nRows: 0,
        coldRows: 0,
        warmRows: 0,
        coldInputTokens: 0,
        warmInputTokens: 0,
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.nRows += 1;
    if (isCold) {
      acc.coldRows += 1;
      acc.coldInputTokens += inp;
    } else {
      acc.warmRows += 1;
      acc.warmInputTokens += inp;
    }
    acc.totalTokens += ttSafe;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokensSum = 0;
  const rows: SourceColdWarmRowRatioRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.nRows < minRows) {
      droppedSparseSources += 1;
      continue;
    }
    const inputTokens = acc.coldInputTokens + acc.warmInputTokens;
    const coldShare = acc.nRows > 0 ? acc.coldRows / acc.nRows : 0;
    const coldInputTokenShare =
      inputTokens > 0 ? acc.coldInputTokens / inputTokens : 0;
    const meanColdInput =
      acc.coldRows > 0 ? acc.coldInputTokens / acc.coldRows : 0;
    const meanWarmInput =
      acc.warmRows > 0 ? acc.warmInputTokens / acc.warmRows : 0;
    rows.push({
      source: src,
      nRows: acc.nRows,
      coldRows: acc.coldRows,
      warmRows: acc.warmRows,
      coldShare,
      inputTokens,
      coldInputTokens: acc.coldInputTokens,
      warmInputTokens: acc.warmInputTokens,
      coldInputTokenShare,
      coldRowMassGap: coldShare - coldInputTokenShare,
      meanColdInput,
      meanWarmInput,
      totalTokens: acc.totalTokens,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rows':
        primary = b.nRows - a.nRows;
        break;
      case 'cold-share':
        primary = b.coldShare - a.coldShare;
        break;
      case 'cold-mass-share':
        primary = b.coldInputTokenShare - a.coldInputTokenShare;
        break;
      case 'gap':
        primary = Math.abs(b.coldRowMassGap) - Math.abs(a.coldRowMassGap);
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveInput,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
