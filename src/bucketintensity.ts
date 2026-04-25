/**
 * bucket-intensity: per-model distribution of `total_tokens`
 * within a single UTC hour bucket. For every (model, hour_start)
 * pair with positive token mass we compute one observation —
 * the bucket's total token count — and then report per-model
 * percentiles (p50, p90, p99), min, max, mean, sum, and a
 * fixed-edge histogram over the magnitude range
 *
 *     [1, 1k, 10k, 100k, 1M, 10M, +inf)
 *
 * Why a separate subcommand:
 *
 *   - `velocity` measures tokens/minute across *contiguous active
 *     stretches* of hours (hours collapsed into a stretch). It
 *     answers "during a sprint, how hard were you hitting the API
 *     per minute". bucket-intensity stays at the single-bucket
 *     grain and never collapses neighbouring hours, so a 4-hour
 *     stretch with 100k tokens reads as 4 separate observations of
 *     ~25k each, not one observation of ~417 tok/min.
 *   - `cost`, `agent-mix`, `provider-share`, and `model-mix-entropy`
 *     are pure mass tallies or concentration scalars — they hide
 *     the per-bucket *spread*. A model with one 5M-token bucket and
 *     a model with 50 buckets of 100k each look identical to
 *     `agent-mix`, but their p99 ratio is 50x.
 *   - `burstiness` reports a single concentration scalar per
 *     window (Gini / coefficient of variation across all buckets).
 *     It does not break the distribution out per-model and does not
 *     surface percentile bands.
 *   - `interarrival-time` reports time *between* active buckets,
 *     not the magnitude *inside* a bucket.
 *
 * bucket-intensity is the per-model "how big is a typical hour vs
 * your heaviest hour" lens. It surfaces models that are dominated
 * by one giant bucket (high p99/p50 ratio) versus models with a
 * flat workload (p99/p50 close to 1).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Percentiles use nearest-rank (R-1 / "lower" convention) on the
 * sorted observation list — matches `interarrival-time` and
 * `velocity` so the numbers are comparable across reports.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

/** Histogram bucket lower edges in tokens. Last bucket is [1e7, +inf). */
export const BUCKET_INTENSITY_EDGES: readonly number[] = [
  1, 1_000, 10_000, 100_000, 1_000_000, 10_000_000,
];

export interface BucketIntensityOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop *display rows* whose `buckets < minBuckets`. Display filter
   * only — `totalModels`, `totalBuckets`, `totalTokens` reflect the
   * full population. Counts surface as `droppedMinBuckets`. Default 0.
   */
  minBuckets?: number;
  /**
   * Truncate `models[]` to the top N after sorting. Display filter
   * only. Counts surface as `droppedTopModels`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `models[]`:
   *   - 'tokens' (default): sum of token mass desc
   *   - 'buckets':          number of active buckets desc
   *   - 'p99':              p99 desc (tail-heaviness lens)
   *   - 'spread':           p99/p50 ratio desc (asymmetry lens)
   * Tiebreak in all cases: model name asc (lex).
   */
  sort?: 'tokens' | 'buckets' | 'p99' | 'spread';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface BucketIntensityHistogramRow {
  /** Inclusive lower edge in tokens. */
  edge: number;
  /** Number of (model, hour) observations falling into [edge, nextEdge). */
  count: number;
  /** count / total observations for the model, in [0,1]. */
  share: number;
}

export interface BucketIntensityModelRow {
  model: string;
  /** Number of distinct (model, hour_start) observations. */
  buckets: number;
  /** Sum of total_tokens across this model's buckets. */
  tokens: number;
  /** Smallest single-bucket token count. */
  min: number;
  /** Median single-bucket token count (nearest-rank). */
  p50: number;
  /** 90th-percentile single-bucket token count. */
  p90: number;
  /** 99th-percentile single-bucket token count. */
  p99: number;
  /** Largest single-bucket token count. */
  max: number;
  /** tokens / buckets. */
  mean: number;
  /**
   * p99 / p50 ratio. Tail-heaviness scalar. 1 = symmetric around
   * the median; >>1 = a few giant hours dominate. NaN-safe: when
   * p50 == 0 (impossible here since we drop zero-token buckets)
   * we report 0.
   */
  spread: number;
  /** Fixed-edge histogram, one entry per BUCKET_INTENSITY_EDGES item. */
  histogram: BucketIntensityHistogramRow[];
}

export interface BucketIntensityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minBuckets: number;
  top: number;
  sort: 'tokens' | 'buckets' | 'p99' | 'spread';
  /** Distinct models observed in the window before display filters. */
  totalModels: number;
  /** Sum of buckets across all models (== total observations). */
  totalBuckets: number;
  /** Sum of total_tokens across all observations. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Model rows hidden by `minBuckets`. */
  droppedMinBuckets: number;
  /** Model rows hidden by the `top` cap. */
  droppedTopModels: number;
  /** Per-model rows after sort + display filters. */
  models: BucketIntensityModelRow[];
}

function nearestRank(sorted: number[], q: number): number {
  // R-1 / "lower" nearest-rank: rank = ceil(q * n), value at index rank-1.
  // Matches the convention used in interarrival-time and velocity.
  if (sorted.length === 0) return 0;
  if (q <= 0) return sorted[0]!;
  if (q >= 1) return sorted[sorted.length - 1]!;
  const rank = Math.ceil(q * sorted.length);
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[idx]!;
}

function bucketIndexFor(v: number): number {
  // Map an observation to its histogram bucket index.
  // Edges are sorted asc; pick the largest edge <= v.
  let idx = 0;
  for (let i = 0; i < BUCKET_INTENSITY_EDGES.length; i++) {
    if (v >= (BUCKET_INTENSITY_EDGES[i] as number)) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

export function buildBucketIntensity(
  queue: QueueLine[],
  opts: BucketIntensityOptions = {},
): BucketIntensityReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (sort !== 'tokens' && sort !== 'buckets' && sort !== 'p99' && sort !== 'spread') {
    throw new Error(
      `sort must be 'tokens' | 'buckets' | 'p99' | 'spread' (got ${opts.sort})`,
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

  // model -> hour_start -> tokens (sum within the same hour for
  // duplicate device/source rows on the same model+hour).
  const perModelBuckets = new Map<string, Map<string, number>>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;

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

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    let perBucket = perModelBuckets.get(model);
    if (!perBucket) {
      perBucket = new Map<string, number>();
      perModelBuckets.set(model, perBucket);
    }
    perBucket.set(q.hour_start, (perBucket.get(q.hour_start) ?? 0) + tt);
  }

  // Build per-model rows over the *full* population (pre display filters).
  const allRows: BucketIntensityModelRow[] = [];
  let totalBuckets = 0;
  let totalTokens = 0;
  for (const [model, buckets] of perModelBuckets.entries()) {
    const obs: number[] = [];
    let sum = 0;
    for (const v of buckets.values()) {
      obs.push(v);
      sum += v;
    }
    obs.sort((a, b) => a - b);
    const n = obs.length;
    totalBuckets += n;
    totalTokens += sum;

    const histogram: BucketIntensityHistogramRow[] = BUCKET_INTENSITY_EDGES.map(
      (edge) => ({ edge, count: 0, share: 0 }),
    );
    for (const v of obs) {
      const idx = bucketIndexFor(v);
      (histogram[idx] as BucketIntensityHistogramRow).count += 1;
    }
    if (n > 0) {
      for (const h of histogram) h.share = h.count / n;
    }

    const p50 = nearestRank(obs, 0.5);
    const p99 = nearestRank(obs, 0.99);
    allRows.push({
      model,
      buckets: n,
      tokens: sum,
      min: n > 0 ? (obs[0] as number) : 0,
      p50,
      p90: nearestRank(obs, 0.9),
      p99,
      max: n > 0 ? (obs[n - 1] as number) : 0,
      mean: n > 0 ? sum / n : 0,
      spread: p50 > 0 ? p99 / p50 : 0,
      histogram,
    });
  }

  const totalModels = allRows.length;

  // Apply minBuckets display filter.
  let droppedMinBuckets = 0;
  const afterMin: BucketIntensityModelRow[] = [];
  for (const row of allRows) {
    if (row.buckets < minBuckets) {
      droppedMinBuckets += 1;
      continue;
    }
    afterMin.push(row);
  }

  // Sort.
  afterMin.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'buckets') primary = b.buckets - a.buckets;
    else if (sort === 'p99') primary = b.p99 - a.p99;
    else primary = b.spread - a.spread;
    if (primary !== 0) return primary;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  // Apply top cap.
  let droppedTopModels = 0;
  let kept = afterMin;
  if (top > 0 && afterMin.length > top) {
    droppedTopModels = afterMin.length - top;
    kept = afterMin.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minBuckets,
    top,
    sort,
    totalModels,
    totalBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedMinBuckets,
    droppedTopModels,
    models: kept,
  };
}
