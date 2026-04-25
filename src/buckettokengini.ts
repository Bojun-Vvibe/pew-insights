/**
 * bucket-token-gini: per-source Gini coefficient of token mass
 * across the source's active UTC hour buckets (`hour_start`).
 *
 * For each source, group its `QueueLine` rows by UTC hour bucket
 * (the parsed `hour_start` ISO timestamp, kept at full datetime
 * precision so each bucket is one source-hour). Sum
 * `total_tokens` per bucket, sort the per-bucket totals
 * ascending, and compute the standard Gini coefficient on the
 * resulting non-negative vector:
 *
 *     G = (Σ_i (2i − n − 1) * x_i) / (n * Σ_i x_i)
 *
 * with `i = 1..n` after ascending sort. G = 0 means the source
 * spread its tokens perfectly evenly across the hour buckets it
 * touched. G → 1 means almost all of the source's tokens piled
 * into a single bucket while every other touched bucket is
 * near-zero.
 *
 * Distinct lens vs the existing reports:
 *
 *   - `tail-share` reports per-source Pareto top-N%/top-1%
 *     mass, summarised by a `giniLike` *truncated* index
 *     baselined against decile bins — it answers "do the top
 *     1% of buckets hold most of the mass" but does not give
 *     the standard textbook Gini on the full per-bucket vector,
 *     and it discards the bucket-count denominator.
 *   - `agent-mix` and `model-mix-entropy` measure concentration
 *     *across sources* / *across models* — a different axis;
 *     bucket-token-gini measures concentration *within a single
 *     source over time*.
 *   - `bucket-density-percentile` pools every (source, model)
 *     bucket into one population and emits decile mass shares;
 *     it never separates by source, so a source with three
 *     burst hours and one with steady hourly use look the same
 *     when collapsed.
 *   - `burstiness` collapses the dataset into a single
 *     coefficient-of-variation scalar — global, not per source.
 *   - `bucket-intensity` reports per-model magnitude percentiles,
 *     not the equality of distribution across hour buckets.
 *
 * Use case: separate "always-on" sources (low Gini, tokens
 * distributed across many active hour buckets evenly) from
 * "burst" sources (high Gini, one or two hour buckets carry
 * almost all mass). The same operator can have a steady
 * background tool and a spiky on-demand tool — the Gini
 * coefficient surfaces that contrast in a single number per
 * source while preserving the bucket count and the top-bucket
 * share for context.
 *
 * What we emit:
 *
 *   - one row per source that owns at least `--min-buckets`
 *     active hour buckets (default 1 — every observed source).
 *   - per-row: bucketCount, totalTokens, gini, meanTokens,
 *     maxBucketTokens, topBucketShare (= max/total),
 *     activeWindowStart / activeWindowEnd (ISO of the source's
 *     earliest and latest active bucket).
 *   - global rollup: token-weighted mean Gini across the kept
 *     sources (each source's gini weighted by its totalTokens),
 *     unweighted mean Gini, total bucket count, total tokens,
 *     and the count of sources observed in only one bucket
 *     (their gini is reported as 0 by convention; they cannot
 *     be unequal across one observation).
 *
 * Window semantics: filter by `hour_start`. Window is applied
 * *before* per-source bucket aggregation so a source whose
 * pre-window mass is enormous but in-window mass is tiny will
 * be treated as the in-window distribution.
 *
 * Determinism: pure builder. `generatedAt` is the only
 * `Date.now()` read and is overridable. All sorts fully
 * specified (rows: gini desc → totalTokens desc → source asc).
 */
import type { QueueLine } from './types.js';

export interface BucketTokenGiniOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop sources from `sources[]` whose active bucket count is
   * `< minBuckets`. Their counts surface as
   * `droppedBelowMinBuckets`. Display filter only — global
   * rollup numerators reflect only the kept set so the rollup
   * stays meaningful when the floor is set high. Default 1.
   */
  minBuckets?: number;
  /**
   * Optional source allowlist. When set, only `QueueLine` rows
   * whose `source` matches one of the listed values are
   * considered. Dropped rows surface as `droppedByFilterSource`.
   */
  filterSources?: string[];
  /**
   * Optional cap on `sources[]`. When set, the report keeps
   * only the top K sources sorted by `gini` desc (then
   * `totalTokens` desc, then `source` asc — the same order as
   * the default ranking). Hidden sources surface as
   * `droppedBelowTopK`. Crucially, the global rollup
   * (`weightedMeanGini`, `unweightedMeanGini`,
   * `singleBucketSourceCount`) is computed across the full
   * kept set *before* the topK cap so the population summary
   * stays invariant under the display filter — only the
   * rendered table shrinks. Mirrors the `--top-k` cap
   * convention from `hour-of-day-source-mix-entropy`. Default
   * unset = no cap.
   */
  topK?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface BucketTokenGiniRow {
  /** Source name (`unknown` when empty in source data). */
  source: string;
  /** Distinct active UTC hour buckets attributed to this source. */
  bucketCount: number;
  /** Sum of total_tokens for this source across its buckets. */
  totalTokens: number;
  /** Gini coefficient in [0,1] on the per-bucket token totals
   *  for this source. 0 when bucketCount ≤ 1. */
  gini: number;
  /** totalTokens / bucketCount. 0 when bucketCount = 0. */
  meanTokens: number;
  /** Tokens in the heaviest single bucket. 0 when no buckets. */
  maxBucketTokens: number;
  /** maxBucketTokens / totalTokens in [0,1]. 0 when no tokens. */
  topBucketShare: number;
  /** ISO of the earliest active bucket (post-window). */
  activeWindowStart: string | null;
  /** ISO of the latest active bucket (post-window). */
  activeWindowEnd: string | null;
}

export interface BucketTokenGiniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minBuckets. */
  minBuckets: number;
  /** Resolved source filter (null = no filter). */
  filterSources: string[] | null;
  /** Resolved topK cap (null = no cap). */
  topK: number | null;
  /** Sum of total_tokens across all considered rows (post-filter). */
  totalTokens: number;
  /** Distinct sources observed (pre-minBuckets, post-filter). */
  observedSources: number;
  /** Rows where `hour_start` did not parse as ISO. */
  droppedInvalidHourStart: number;
  /** Rows with non-finite or non-positive `total_tokens`. */
  droppedZeroTokens: number;
  /** Rows dropped by the `--filter-source` allowlist. */
  droppedByFilterSource: number;
  /** Sources hidden by the `minBuckets` floor. */
  droppedBelowMinBuckets: number;
  /** Sources hidden by the `topK` display cap (applied after `minBuckets`). */
  droppedBelowTopK: number;
  /** Token-weighted mean of `gini` across kept sources.
   *  0 when there are no considered tokens. */
  weightedMeanGini: number;
  /** Unweighted (per-source) mean of `gini` across kept sources.
   *  0 when there are no kept sources. */
  unweightedMeanGini: number;
  /** Number of kept sources whose bucketCount === 1
   *  (their gini is 0 by convention). */
  singleBucketSourceCount: number;
  /** Per-source rows. Default sort: gini desc → totalTokens desc → source asc. */
  sources: BucketTokenGiniRow[];
}

/**
 * Standard Gini on a non-negative vector. Caller passes the
 * already-aggregated per-bucket totals; we sort ascending here.
 * Returns 0 for vectors of length ≤ 1 or sum 0.
 */
function giniOf(values: number[]): number {
  const n = values.length;
  if (n <= 1) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  if (sum <= 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    weighted += (2 * (i + 1) - n - 1) * sorted[i]!;
  }
  const g = weighted / (n * sum);
  // Numerical guard: clamp into [0,1] in case of fp drift.
  if (g < 0) return 0;
  if (g > 1) return 1;
  return g;
}

export function buildBucketTokenGini(
  queue: QueueLine[],
  opts: BucketTokenGiniOptions = {},
): BucketTokenGiniReport {
  const minBuckets = opts.minBuckets ?? 1;
  if (!Number.isFinite(minBuckets) || minBuckets < 1 || !Number.isInteger(minBuckets)) {
    throw new Error(`minBuckets must be a positive integer (got ${opts.minBuckets})`);
  }

  const topK = opts.topK ?? null;
  if (topK !== null) {
    if (!Number.isInteger(topK) || topK < 1) {
      throw new Error(`topK must be a positive integer (got ${opts.topK})`);
    }
  }

  let filterSet: Set<string> | null = null;
  if (opts.filterSources != null) {
    if (!Array.isArray(opts.filterSources) || opts.filterSources.length === 0) {
      throw new Error('filterSources must be a non-empty array when provided');
    }
    for (const s of opts.filterSources) {
      if (typeof s !== 'string' || s.length === 0) {
        throw new Error(
          `filterSources entries must be non-empty strings (got ${JSON.stringify(s)})`,
        );
      }
    }
    filterSet = new Set(opts.filterSources);
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

  // source -> bucketIso -> tokens
  const agg = new Map<string, Map<string, number>>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedByFilterSource = 0;
  let globalTotal = 0;

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

    const src =
      typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
    if (filterSet !== null && !filterSet.has(src)) {
      droppedByFilterSource += 1;
      continue;
    }

    let buckets = agg.get(src);
    if (!buckets) {
      buckets = new Map();
      agg.set(src, buckets);
    }
    // Normalise the bucket key to a canonical ISO string so
    // representations like "2026-04-20T10:00:00Z" and
    // "2026-04-20T10:00:00.000Z" merge by their parsed instant.
    const key = new Date(ms).toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + tt);
    globalTotal += tt;
  }

  const observedSources = agg.size;

  const allRows: BucketTokenGiniRow[] = [];
  for (const [source, buckets] of agg) {
    const values: number[] = [];
    let total = 0;
    let maxBucket = 0;
    let firstMs = Number.POSITIVE_INFINITY;
    let lastMs = Number.NEGATIVE_INFINITY;
    for (const [iso, tokens] of buckets) {
      values.push(tokens);
      total += tokens;
      if (tokens > maxBucket) maxBucket = tokens;
      const ms = Date.parse(iso);
      if (Number.isFinite(ms)) {
        if (ms < firstMs) firstMs = ms;
        if (ms > lastMs) lastMs = ms;
      }
    }
    const bucketCount = values.length;
    const gini = giniOf(values);
    const meanTokens = bucketCount > 0 ? total / bucketCount : 0;
    const topBucketShare = total > 0 ? maxBucket / total : 0;
    const activeWindowStart =
      Number.isFinite(firstMs) ? new Date(firstMs).toISOString() : null;
    const activeWindowEnd =
      Number.isFinite(lastMs) ? new Date(lastMs).toISOString() : null;

    allRows.push({
      source,
      bucketCount,
      totalTokens: total,
      gini,
      meanTokens,
      maxBucketTokens: maxBucket,
      topBucketShare,
      activeWindowStart,
      activeWindowEnd,
    });
  }

  // minBuckets display floor.
  let droppedBelowMinBuckets = 0;
  const kept: BucketTokenGiniRow[] = [];
  for (const row of allRows) {
    if (row.bucketCount < minBuckets) {
      droppedBelowMinBuckets += 1;
      continue;
    }
    kept.push(row);
  }

  // Global rollup is computed on `kept` (post-minBuckets) so
  // the population summary respects the display floor.
  let weightedNumerator = 0;
  let weightedDenominator = 0;
  let unweightedSum = 0;
  let singleBucketSourceCount = 0;
  for (const r of kept) {
    weightedNumerator += r.gini * r.totalTokens;
    weightedDenominator += r.totalTokens;
    unweightedSum += r.gini;
    if (r.bucketCount === 1) singleBucketSourceCount += 1;
  }
  const weightedMeanGini =
    weightedDenominator === 0 ? 0 : weightedNumerator / weightedDenominator;
  const unweightedMeanGini = kept.length === 0 ? 0 : unweightedSum / kept.length;

  // Sort: gini desc → totalTokens desc → source asc.
  const ranked = [...kept].sort((a, b) => {
    if (b.gini !== a.gini) return b.gini - a.gini;
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  // topK display cap (applied after the minBuckets floor and the
  // ranked sort so droppedBelowTopK reflects only sources that
  // already passed the structural floor). Crucially, the global
  // rollup above already used the full `kept` set, so the
  // population summary is invariant under the display cap —
  // only the rendered table shrinks.
  let droppedBelowTopK = 0;
  let display: BucketTokenGiniRow[];
  if (topK === null) {
    display = ranked;
  } else if (ranked.length > topK) {
    droppedBelowTopK = ranked.length - topK;
    display = ranked.slice(0, topK);
  } else {
    display = ranked;
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minBuckets,
    filterSources: filterSet === null ? null : [...filterSet].sort(),
    topK,
    totalTokens: globalTotal,
    observedSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedByFilterSource,
    droppedBelowMinBuckets,
    droppedBelowTopK,
    weightedMeanGini,
    unweightedMeanGini,
    singleBucketSourceCount,
    sources: display,
  };
}
