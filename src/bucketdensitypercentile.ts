/**
 * bucket-density-percentile: population-level distribution of
 * `total_tokens` per *single bucket*, pooled across *all*
 * (source, model, hour_start) rows that survive filters.
 *
 * For every active bucket (one row in the queue with
 * `total_tokens > 0` and a parseable `hour_start`) we treat the
 * row's token count as one observation. We then report the full
 * percentile ladder over the pooled population:
 *
 *   p1, p5, p10, p25, p50, p75, p90, p95, p99, p99.9, max
 *
 * Plus min, mean, sum, and total observation count.
 *
 * In addition we slice the population into 10 deciles (D1 = lowest
 * 10% of buckets by token mass, D10 = top 10%) and for each decile
 * report:
 *
 *   - count:        number of buckets in the decile
 *   - tokens:       sum of total_tokens in the decile
 *   - tokenShare:   tokens / totalTokens (fraction of all mass)
 *   - lowerEdge:    min token value in the decile (inclusive)
 *   - upperEdge:    max token value in the decile (inclusive)
 *
 * Why a separate subcommand:
 *
 *   - `bucket-intensity` reports the same magnitude axis but
 *     *per model* — so a model with 3 buckets at 1M tokens has its
 *     own p50/p90 row, never pooled with everything else. This
 *     subcommand answers "across all my buckets regardless of
 *     model/source, what does the size distribution look like".
 *   - `burstiness` collapses the spread into a single Gini /
 *     coefficient of variation scalar. It tells you *how* uneven
 *     the distribution is but never surfaces the percentile values
 *     themselves or the decile mass shares.
 *   - `tail-share` reports a single "top N% of buckets hold X% of
 *     tokens" pair. bucket-density-percentile gives the full decile
 *     mass distribution (D1..D10), so you can see whether the tail
 *     is a sharp 99th-percentile cliff or a gentle slope across
 *     the top 3 deciles.
 *   - `bucket-streak-length` / `idle-gaps` are temporal. This is
 *     purely a magnitude distribution — bucket order does not
 *     matter.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Percentiles use nearest-rank (R-1 / "lower") on the sorted
 * observation list — same convention as `bucket-intensity`,
 * `interarrival-time`, and `velocity` so numbers are comparable
 * across reports.
 */
import type { QueueLine } from './types.js';

export interface BucketDensityPercentileOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Floor on per-bucket `total_tokens`. Buckets with tokens
   * strictly less than `minTokens` are dropped *before* percentile
   * and decile computation. Suppressed buckets surface as
   * `droppedBelowMinTokens`. Default 0 = no floor (all positive
   * buckets count).
   */
  minTokens?: number;
  /**
   * Outlier-trim flag: drop the top `trimTopPct` percent of
   * buckets (by token mass) *before* computing percentiles and
   * deciles. Useful for getting a robust read on the body of the
   * distribution without one or two giant reasoning buckets
   * dragging mean / p99 around. Suppressed buckets surface as
   * `droppedTrimTop`. Range [0, 100). Default 0 = no trim.
   *
   * Note: this trims after window / source / minTokens filters
   * are applied, on the surviving population. So the trim cap is
   * always relative to the *post-filter* count, not the raw
   * queue. The exact number of trimmed buckets is
   * `floor(N * trimTopPct / 100)` so a trim of 1% on 1,443
   * buckets drops the 14 largest.
   */
  trimTopPct?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface BucketDensityDecile {
  /** Decile rank, 1..10 (1 = smallest 10% of buckets, 10 = top 10%). */
  decile: number;
  /** Number of bucket observations in this decile. */
  count: number;
  /** Sum of total_tokens in this decile. */
  tokens: number;
  /** tokens / totalTokens (over the post-filter population). */
  tokenShare: number;
  /** Inclusive lower bound on token value in this decile. */
  lowerEdge: number;
  /** Inclusive upper bound on token value in this decile. */
  upperEdge: number;
}

export interface BucketDensityPercentileReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of resolved minTokens floor (0 = no floor). */
  minTokens: number;
  /** Echo of resolved trimTopPct (0 = no trim). */
  trimTopPct: number;
  /** Total bucket observations after filters (pre-decile). */
  totalBuckets: number;
  /** Sum of total_tokens across the post-filter population. */
  totalTokens: number;
  /** Min token value in the population (null if empty). */
  min: number | null;
  /** p1 .. max ladder. null entries when the population is empty. */
  p1: number | null;
  p5: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  p999: number | null;
  max: number | null;
  /** mean = totalTokens / totalBuckets (null if empty). */
  mean: number | null;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinTokens: number;
  /** Buckets dropped by the --trim-top outlier trim (top P% of post-filter pop). */
  droppedTrimTop: number;
  /** Always 10 entries when totalBuckets > 0; empty array otherwise. */
  deciles: BucketDensityDecile[];
}

/** Nearest-rank (R-1) percentile on a *sorted asc* numeric array. */
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // R-1: ceil(p/100 * N) - 1, clamped to [0, N-1]
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const i = rank < 0 ? 0 : rank > sorted.length - 1 ? sorted.length - 1 : rank;
  return sorted[i]!;
}

export function buildBucketDensityPercentile(
  queue: QueueLine[],
  opts: BucketDensityPercentileOptions = {},
): BucketDensityPercentileReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative finite number (got ${opts.minTokens})`);
  }
  const trimTopPct = opts.trimTopPct ?? 0;
  if (!Number.isFinite(trimTopPct) || trimTopPct < 0 || trimTopPct >= 100) {
    throw new Error(
      `trimTopPct must be a finite number in [0, 100) (got ${opts.trimTopPct})`,
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

  const observations: number[] = [];
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;
  let droppedBelowMinTokens = 0;

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

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    if (tt < minTokens) {
      droppedBelowMinTokens += 1;
      continue;
    }

    observations.push(tt);
  }

  observations.sort((a, b) => a - b);

  // Outlier trim: drop the top trimTopPct percent of buckets after
  // sorting. floor(N * pct / 100) — a 0% trim is a no-op, a 1% trim
  // on 1,443 buckets drops the 14 largest.
  let droppedTrimTop = 0;
  if (trimTopPct > 0 && observations.length > 0) {
    droppedTrimTop = Math.floor((observations.length * trimTopPct) / 100);
    if (droppedTrimTop > 0) {
      observations.length = observations.length - droppedTrimTop;
    }
  }

  const N = observations.length;

  let totalTokens = 0;
  for (const v of observations) totalTokens += v;

  const deciles: BucketDensityDecile[] = [];
  if (N > 0) {
    // Partition the *sorted* observation list into 10 contiguous
    // decile slices. We use floor((d-1)*N/10) .. floor(d*N/10) so
    // every observation lands in exactly one decile and decile 10
    // always contains the max. Tied values that straddle a slice
    // boundary land on the lower-decile side (the slice that comes
    // first in the cumulative order). This is deterministic and
    // matches the standard "equal-count quantile bucket" definition.
    for (let d = 1; d <= 10; d += 1) {
      const lo = Math.floor(((d - 1) * N) / 10);
      const hi = Math.floor((d * N) / 10);
      const slice = observations.slice(lo, hi);
      let sum = 0;
      for (const v of slice) sum += v;
      deciles.push({
        decile: d,
        count: slice.length,
        tokens: sum,
        tokenShare: totalTokens > 0 ? sum / totalTokens : 0,
        lowerEdge: slice.length > 0 ? slice[0]! : 0,
        upperEdge: slice.length > 0 ? slice[slice.length - 1]! : 0,
      });
    }
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minTokens,
    trimTopPct,
    totalBuckets: N,
    totalTokens,
    min: N > 0 ? observations[0]! : null,
    p1: N > 0 ? pct(observations, 1) : null,
    p5: N > 0 ? pct(observations, 5) : null,
    p10: N > 0 ? pct(observations, 10) : null,
    p25: N > 0 ? pct(observations, 25) : null,
    p50: N > 0 ? pct(observations, 50) : null,
    p75: N > 0 ? pct(observations, 75) : null,
    p90: N > 0 ? pct(observations, 90) : null,
    p95: N > 0 ? pct(observations, 95) : null,
    p99: N > 0 ? pct(observations, 99) : null,
    p999: N > 0 ? pct(observations, 99.9) : null,
    max: N > 0 ? observations[N - 1]! : null,
    mean: N > 0 ? totalTokens / N : null,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedBelowMinTokens,
    droppedTrimTop,
    deciles,
  };
}
