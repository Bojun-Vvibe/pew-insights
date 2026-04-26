/**
 * source-input-token-top-row-share: per-source concentration of
 * **input_tokens mass** in a small number of single monster rows.
 *
 * Headline question: **for a given source, how much of its lifetime
 * input-token volume lives in just a handful of giant prompts?**
 *
 * Intuition. A source can deliver the same input-token total via two
 * very different shapes:
 *
 *   - Flat:   thousands of medium prompts of similar size.
 *   - Spiky:  a few monster prompts (long context paste, large repo
 *             dump, big tool-result blob) that dominate the rest.
 *
 * The flat regime is well-modelled by mean-rate budget arithmetic;
 * the spiky regime is what blows context limits, kills latency, and
 * dominates cache-miss cost. Knowing which sources sit in which
 * regime is operationally distinct from any existing metric in this
 * codebase.
 *
 * Distinct from every existing lens:
 *
 *   - `input-token-decile-distribution` is a **global** decile cut
 *     of every row's input_tokens. It has no per-source breakdown,
 *     so it cannot tell `source A always sends giant prompts` from
 *     `source B sometimes sends one giant prompt`.
 *   - `source-output-tokens-per-row-percentiles` reports the same
 *     shape statistics on the **output** column and reports them as
 *     percentiles, not as a top-K cumulative-share concentration
 *     ratio. p99/p50 captures tail thickness; topKShare captures
 *     "what fraction of the pie do the K biggest slices own?" — a
 *     distinct, scale-free concentration measure.
 *   - `source-single-day-mass-concentration` operates on **daily
 *     total_tokens** (a UTC-day axis, sums input + output +
 *     reasoning). This metric operates on **per-row input_tokens**
 *     directly — a single monster prompt inside a busy day will
 *     show up here but be diluted there.
 *   - `source-cost-class-mix` projects each row onto a small/med/
 *     large categorical based on `total_tokens`. The category
 *     boundaries are fixed; concentration in the largest category
 *     is *count-based*, not *mass-based*. A source with 10 medium
 *     rows and 1 large row gets the same "1 large row" count as
 *     a source with 10 medium and 1 huge row.
 *   - `daily-token-gini-coefficient` measures inequality across
 *     **days**, not across **rows within a source**.
 *
 * The metric is **scale-invariant** in token volume: a source that
 * burns 10x more input tokens but holds the same row-distribution
 * shape gets the same topKShare and hhi. It is also unaffected by
 * the source's row count for fixed `top1Share` — a single monster
 * row is a single monster row whether it appears in 10 rows or
 * 10,000.
 *
 * Per surviving source we compute:
 *
 *   - rowsConsidered:  count of rows with input_tokens > 0 (rows
 *                      with input_tokens == 0 do not enter the
 *                      mass denominator and are tallied separately
 *                      as `rowsZeroInput`).
 *   - rowsZeroInput:   count of rows with input_tokens == 0.
 *   - inputSum:        sum of input_tokens across rowsConsidered.
 *   - top1Tokens:      the largest single-row input_tokens.
 *   - top1Share:       top1Tokens / inputSum. In [0, 1].
 *   - topKTokens:      sum of the top-K largest single-row
 *                      input_tokens (K = `topK`, default 3).
 *   - topKShare:       topKTokens / inputSum. In [0, 1]. If
 *                      rowsConsidered <= K, this equals 1.
 *   - hhi:             sum_i (row_input_i / inputSum)^2 over
 *                      rowsConsidered. In (0, 1]; 1.0 means a
 *                      single row owns 100% of mass; 1/n means
 *                      perfectly uniform across n rows.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. Per-source: bucket every row's `input_tokens` (treated as 0
 *      if non-finite or negative). Rows with input == 0 increment
 *      `rowsZeroInput`; rows with input > 0 enter the mass list.
 *   4. Sort each source's positive list **descending**; take the
 *      first `topK` for topKTokens, the first 1 for top1Tokens.
 *      Walk the full list once for the HHI sum.
 *   5. Apply display gates `--min-rows` (default 3),
 *      `--min-top1-share` (default 0), `--min-topk-share` (default
 *      0).
 *   6. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - rowsConsidered == 0  ->  source dropped (no positive input
 *     tokens means no mass to concentrate). Surfaces as
 *     `droppedAllZero`.
 *   - rowsConsidered == 1  ->  top1Share == topKShare == hhi == 1.
 *     `singleRow = true`. The metric is well-defined but
 *     uninformative; default `--min-rows 3` filters this out.
 *   - inputSum == 0 with rowsConsidered > 0: impossible by
 *     construction (positive-only list); guarded defensively
 *     anyway — the divisor is never zero.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceInputTokenTopRowShareOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * K for the top-K cumulative share metric. Must be a positive
   * integer. Default 3. Sources with fewer than K positive-input
   * rows automatically have topKShare = 1.
   */
  topK?: number;
  /**
   * Drop sources with fewer than this many positive-input rows from
   * the per-source table. Display filter only — global denominators
   * reflect the full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer. Default 3
   * (concentration on <3 samples is degenerate).
   */
  minRows?: number;
  /**
   * Drop sources whose `top1Share` is strictly below this value
   * from the per-source table. Display filter only. Suppressed
   * rows surface as `droppedBelowMinTop1Share`. Must be in [0, 1].
   * Default 0 = no floor.
   */
  minTop1Share?: number;
  /**
   * Drop sources whose `topKShare` is strictly below this value
   * from the per-source table. Display filter only. Suppressed
   * rows surface as `droppedBelowMinTopKShare`. Must be in [0, 1].
   * Default 0 = no floor.
   */
  minTopKShare?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null
   * = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): inputSum desc.
   *   - 'top1':             top1Share desc.
   *   - 'topk':             topKShare desc.
   *   - 'hhi':              hhi desc.
   *   - 'rows':             rowsConsidered desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'top1' | 'topk' | 'hhi' | 'rows' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceInputTokenTopRowShareRow {
  source: string;
  rowsConsidered: number;
  rowsZeroInput: number;
  inputSum: number;
  top1Tokens: number;
  top1Share: number;
  topKTokens: number;
  topKShare: number;
  hhi: number;
  /** True iff rowsConsidered === 1. */
  singleRow: boolean;
}

export interface SourceInputTokenTopRowShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  topK: number;
  minRows: number;
  minTop1Share: number;
  minTopKShare: number;
  top: number | null;
  sort: 'tokens' | 'top1' | 'topk' | 'hhi' | 'rows' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of input_tokens across all kept positive-input rows. */
  totalInputTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  /** Sources whose every kept row had input_tokens == 0. */
  droppedAllZero: number;
  droppedBelowMinRows: number;
  droppedBelowMinTop1Share: number;
  droppedBelowMinTopKShare: number;
  droppedBelowTopCap: number;
  sources: SourceInputTokenTopRowShareRow[];
}

export function buildSourceInputTokenTopRowShare(
  queue: QueueLine[],
  opts: SourceInputTokenTopRowShareOptions = {},
): SourceInputTokenTopRowShareReport {
  const topK = opts.topK ?? 3;
  if (!Number.isInteger(topK) || topK < 1) {
    throw new Error(`topK must be a positive integer (got ${opts.topK})`);
  }
  const minRows = opts.minRows ?? 3;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minTop1Share = opts.minTop1Share ?? 0;
  if (
    !Number.isFinite(minTop1Share) ||
    minTop1Share < 0 ||
    minTop1Share > 1
  ) {
    throw new Error(
      `minTop1Share must be a finite number in [0, 1] (got ${opts.minTop1Share})`,
    );
  }
  const minTopKShare = opts.minTopKShare ?? 0;
  if (
    !Number.isFinite(minTopKShare) ||
    minTopKShare < 0 ||
    minTopKShare > 1
  ) {
    throw new Error(
      `minTopKShare must be a finite number in [0, 1] (got ${opts.minTopKShare})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tokens';
  const validSorts = ['tokens', 'top1', 'topk', 'hhi', 'rows', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Bucket {
    positives: number[];
    zeros: number;
  }
  const perSource = new Map<string, Bucket>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const inRaw = Number(q.input_tokens);
    const inTok = Number.isFinite(inRaw) && inRaw > 0 ? inRaw : 0;

    let b = perSource.get(source);
    if (!b) {
      b = { positives: [], zeros: 0 };
      perSource.set(source, b);
    }
    if (inTok === 0) {
      b.zeros += 1;
    } else {
      b.positives.push(inTok);
    }
  }

  const totalSources = perSource.size;
  let droppedAllZero = 0;
  let totalInputTokens = 0;
  const allRows: SourceInputTokenTopRowShareRow[] = [];

  for (const [source, b] of perSource.entries()) {
    if (b.positives.length === 0) {
      droppedAllZero += 1;
      continue;
    }
    // Descending sort: largest single-row input_tokens first.
    b.positives.sort((a, c) => c - a);
    let sum = 0;
    for (const v of b.positives) sum += v;
    const n = b.positives.length;
    const top1Tokens = b.positives[0]!;
    const k = Math.min(topK, n);
    let topKTokens = 0;
    for (let i = 0; i < k; i += 1) topKTokens += b.positives[i]!;
    let hhi = 0;
    if (sum > 0) {
      for (const v of b.positives) {
        const s = v / sum;
        hhi += s * s;
      }
    }
    const top1Share = sum > 0 ? top1Tokens / sum : 0;
    const topKShare = sum > 0 ? topKTokens / sum : 0;
    totalInputTokens += sum;
    allRows.push({
      source,
      rowsConsidered: n,
      rowsZeroInput: b.zeros,
      inputSum: sum,
      top1Tokens,
      top1Share,
      topKTokens,
      topKShare,
      hhi,
      singleRow: n === 1,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinTop1Share = 0;
  let droppedBelowMinTopKShare = 0;
  const survived: SourceInputTokenTopRowShareRow[] = [];
  for (const row of allRows) {
    if (row.rowsConsidered < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.top1Share < minTop1Share) {
      droppedBelowMinTop1Share += 1;
      continue;
    }
    if (row.topKShare < minTopKShare) {
      droppedBelowMinTopKShare += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.inputSum - a.inputSum;
    else if (sort === 'top1') primary = b.top1Share - a.top1Share;
    else if (sort === 'topk') primary = b.topKShare - a.topKShare;
    else if (sort === 'hhi') primary = b.hhi - a.hhi;
    else if (sort === 'rows') primary = b.rowsConsidered - a.rowsConsidered;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    topK,
    minRows,
    minTop1Share,
    minTopKShare,
    top,
    sort,
    totalSources,
    totalInputTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedAllZero,
    droppedBelowMinRows,
    droppedBelowMinTop1Share,
    droppedBelowMinTopKShare,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
