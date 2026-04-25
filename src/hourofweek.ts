/**
 * hour-of-week: 168-cell joint (weekday × hour-of-day) concentration lens.
 *
 * Distinct from existing temporal lenses:
 *
 *   - `time-of-day`  collapses to 24 hour-of-day cells (loses weekday).
 *   - `weekday-share` collapses to 7 weekday cells (loses hour).
 *   - `weekend-vs-weekday` is binary (loses both axes).
 *   - `peak-hour-share` reports a single hour's share, not the joint shape.
 *   - `which-hour` is a per-bucket pick, not a population shape.
 *   - `cache-hit-by-hour` is a different metric, hourly only.
 *
 * Hour-of-week answers: "across the full 168-cell weekly clock, how
 * concentrated is your usage, and which weekday/hour cells are the
 * routine peaks vs the dead zones?". Reports:
 *
 *   - per-cell token/bucket counts and shares
 *   - Shannon entropy in bits (max log2(168) = 7.392)
 *   - normalised entropy (entropy / 7.392, in [0,1]; 1 = uniform)
 *   - Gini coefficient over cell token mass (0 = uniform, 1 = single-cell)
 *   - top-N share (mass concentrated in the N hottest cells)
 *   - count of populated vs zero cells (the "dead hours")
 *   - top cells (sorted by tokens desc)
 *
 * Weekday convention: ISO — Monday=1 .. Sunday=7. Hour of day: 0..23
 * in UTC. We do not interpret a local timezone; rows are bucketed by
 * the UTC clock from `hour_start`. Determinism: pure builder; wall
 * clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface HourOfWeekOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /** Restrict to a single model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Truncate `topCells[]` to the top N by tokens desc. Display filter
   * only — entropy / Gini / topShare are always computed over the
   * full 168-cell population. Default 10. Range >= 1.
   */
  top?: number;
  /**
   * Mass-share concentration window: report tokenShare of the top K
   * cells. Default 10. Range 1..168. Surfaces as `topKShare`.
   */
  topK?: number;
  /**
   * Drop cells whose `tokens` < `minCellTokens` from `topCells[]`.
   * Display filter only — concentration metrics (entropy, gini,
   * topKShare) and `populatedCells` / `deadCells` are always
   * computed over the full 168-cell population. Suppressed cells
   * surface as `droppedSparseCells`. Default 0 = keep every cell.
   */
  minCellTokens?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface HourOfWeekCell {
  /** ISO weekday: 1=Mon, 7=Sun. */
  weekday: number;
  /** UTC hour of day, 0..23. */
  hour: number;
  /** Distinct hour_start buckets touching this cell. */
  buckets: number;
  /** Sum of total_tokens for this cell. */
  tokens: number;
  /** tokens / totalTokens (0 if denom 0). */
  tokenShare: number;
}

export interface HourOfWeekReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  model: string | null;
  /** Echo of resolved `top` cap. */
  top: number;
  /** Echo of resolved `topK`. */
  topK: number;
  /** Echo of resolved `minCellTokens` floor. */
  minCellTokens: number;
  /** Distinct hour_start buckets surviving filters. */
  totalBuckets: number;
  /** Sum of total_tokens surviving filters. */
  totalTokens: number;
  /** Cells with tokens > 0 (max 168). */
  populatedCells: number;
  /** Cells with tokens === 0 (= 168 - populatedCells). */
  deadCells: number;
  /** Shannon entropy of token mass over 168 cells, in bits. */
  entropyBits: number;
  /** entropyBits / log2(168). 1 = perfectly uniform. */
  normalisedEntropy: number;
  /** Gini coefficient over cell token mass. 0 = uniform, ~1 = single cell. */
  gini: number;
  /** Sum of tokenShare across the top K cells (concentration). */
  topKShare: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Rows excluded by the `model` filter. */
  droppedModelFilter: number;
  /** Cells hidden from `topCells[]` by the `minCellTokens` floor. */
  droppedSparseCells: number;
  /** Top cells by tokens desc, capped at `top`. */
  topCells: HourOfWeekCell[];
}

const TOTAL_CELLS = 168; // 7 * 24
const LOG2_168 = Math.log2(TOTAL_CELLS);

export function buildHourOfWeek(
  queue: QueueLine[],
  opts: HourOfWeekOptions = {},
): HourOfWeekReport {
  const top = opts.top ?? 10;
  if (!Number.isInteger(top) || top < 1) {
    throw new Error(`top must be a positive integer (got ${opts.top})`);
  }
  const topK = opts.topK ?? 10;
  if (!Number.isInteger(topK) || topK < 1 || topK > TOTAL_CELLS) {
    throw new Error(
      `topK must be an integer in [1, 168] (got ${opts.topK})`,
    );
  }
  const minCellTokens = opts.minCellTokens ?? 0;
  if (!Number.isInteger(minCellTokens) || minCellTokens < 0) {
    throw new Error(
      `minCellTokens must be a non-negative integer (got ${opts.minCellTokens})`,
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
  const modelFilter =
    opts.model != null && opts.model !== '' ? normaliseModel(opts.model) : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // 168-cell buffers, indexed (weekday-1)*24 + hour
  const cellTokens = new Float64Array(TOTAL_CELLS);
  const cellBucketSets: Set<string>[] = Array.from(
    { length: TOTAL_CELLS },
    () => new Set<string>(),
  );

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;
  let droppedModelFilter = 0;
  const allBuckets = new Set<string>();
  let totalTokens = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedZeroTokens += 1;
      continue;
    }

    if (sourceFilter !== null) {
      const src =
        typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
      if (src !== sourceFilter) {
        droppedSourceFilter += 1;
        continue;
      }
    }

    if (modelFilter !== null) {
      const m = normaliseModel(typeof q.model === 'string' ? q.model : '');
      if (m !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }

    const d = new Date(ms);
    // JS getUTCDay: 0=Sun..6=Sat. Convert to ISO 1=Mon..7=Sun.
    const jsDow = d.getUTCDay();
    const weekday = jsDow === 0 ? 7 : jsDow;
    const hour = d.getUTCHours();
    const idx = (weekday - 1) * 24 + hour;

    cellTokens[idx]! += tt;
    cellBucketSets[idx]!.add(q.hour_start);
    allBuckets.add(q.hour_start);
    totalTokens += tt;
  }

  // Build cells, compute shares, entropy, gini
  const cells: HourOfWeekCell[] = [];
  let populatedCells = 0;
  let entropyBits = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const tokens = cellTokens[i]!;
    const buckets = cellBucketSets[i]!.size;
    const share = totalTokens > 0 ? tokens / totalTokens : 0;
    if (tokens > 0) {
      populatedCells += 1;
      if (share > 0) entropyBits -= share * Math.log2(share);
    }
    cells.push({
      weekday: Math.floor(i / 24) + 1,
      hour: i % 24,
      buckets,
      tokens,
      tokenShare: share,
    });
  }
  const deadCells = TOTAL_CELLS - populatedCells;
  const normalisedEntropy = totalTokens > 0 ? entropyBits / LOG2_168 : 0;

  // Gini over the 168 cell token masses (treat zeros as zeros).
  let gini = 0;
  if (totalTokens > 0) {
    const sorted = cells.map((c) => c.tokens).sort((a, b) => a - b);
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += sorted[i]! * (i + 1);
    }
    // Standard formula: G = (2 * sum_{i=1..n} i * x_i) / (n * sum) - (n+1)/n
    gini =
      (2 * cum) / (sorted.length * totalTokens) -
      (sorted.length + 1) / sorted.length;
    if (gini < 0) gini = 0;
    if (gini > 1) gini = 1;
  }

  const sortedDesc = [...cells]
    .filter((c) => c.tokens > 0)
    .sort((a, b) => {
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.hour - b.hour;
    });
  let topKShare = 0;
  for (let i = 0; i < Math.min(topK, sortedDesc.length); i++) {
    topKShare += sortedDesc[i]!.tokenShare;
  }
  let droppedSparseCells = 0;
  let displayCells = sortedDesc;
  if (minCellTokens > 0) {
    displayCells = sortedDesc.filter((c) => {
      if (c.tokens < minCellTokens) {
        droppedSparseCells += 1;
        return false;
      }
      return true;
    });
  }
  const topCells = displayCells.slice(0, top);

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    model: modelFilter,
    top,
    topK,
    minCellTokens,
    totalBuckets: allBuckets.size,
    totalTokens,
    populatedCells,
    deadCells,
    entropyBits,
    normalisedEntropy,
    gini,
    topKShare,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedModelFilter,
    droppedSparseCells,
    topCells,
  };
}
