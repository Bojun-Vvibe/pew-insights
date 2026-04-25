/**
 * cost-per-bucket-percentiles: per-source distribution of estimated
 * USD cost computed at the single UTC hour bucket grain.
 *
 * For every (source, hour_start) pair we sum the per-row USD cost
 * (input + cached_input + output + reasoning, priced through the
 * shared `RateTable`) across all device/model rows that landed in
 * that hour. The resulting per-bucket dollar number is one
 * observation. We then report per-source percentiles (p50, p90,
 * p99), min, max, mean, and the sum of dollars across the source's
 * buckets.
 *
 * Why a separate subcommand instead of leaning on `cost`,
 * `bucket-intensity`, or `token-velocity-percentiles`:
 *
 *   - `cost` aggregates by *model* and emits one cumulative dollar
 *     per model. It cannot tell you whether the spend is dominated
 *     by a few catastrophically expensive hours or smeared evenly.
 *   - `bucket-intensity` looks at *token mass* per bucket per model,
 *     not USD, and never slices by source. A cheap model sending
 *     huge prompts and an expensive model sending small prompts
 *     can land on identical token mass while the dollar tail is
 *     wildly different.
 *   - `token-velocity-percentiles` is the per-source rate
 *     distribution, but again unit-free of price — a 1M-token hour
 *     of `gpt-5-nano` and of `claude-opus-4.7` look the same.
 *
 * cost-per-bucket-percentiles is the per-source "what is the
 * dollar shape of one hour of activity for each tool" lens, with
 * the tail pulled out so a single $50 hour cannot hide inside a
 * monthly average.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Percentiles use nearest-rank (R-1 / "lower" convention) on the
 * sorted observation list — matches `bucket-intensity`,
 * `token-velocity-percentiles`, `interarrival-time` so numbers are
 * comparable across reports. Unknown models contribute zero cost
 * to their bucket (counted in `unknownModelRows`), which means a
 * bucket that consists *entirely* of unknown-model rows is dropped
 * with the zero-cost buckets — surfaced as `droppedZeroCost`.
 */
import type { QueueLine } from './types.js';
import type { RateTable } from './cost.js';
import { normaliseModel } from './parsers.js';

export interface CostPerBucketPercentilesOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop *display rows* whose `buckets < minBuckets`. Display filter
   * only — `totalSources`, `totalBuckets`, `totalCost` reflect the
   * full population. Counts surface as `droppedMinBuckets`. Default 0.
   */
  minBuckets?: number;
  /**
   * Truncate `sources[]` to the top N after sorting. Display filter
   * only. Counts surface as `droppedTopSources`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Drop individual *(source, hour) bucket observations* whose
   * USD cost is `< minCost`. Counts surface as `droppedMinCost`.
   * Default 0 = no filter. Useful for hiding nearly-free background
   * pings whose dollar contribution is rounding error. Distinct
   * from `minBuckets`:
   *   - `minBuckets` filters per-source display *rows* by observation count.
   *   - `minCost` filters per-bucket *observations* by dollar amount,
   *     applied during aggregation, so it changes `totalBuckets`,
   *     `totalCost`, every percentile, and can remove a source
   *     entirely if all its buckets fall below the threshold.
   * Must be a non-negative finite number.
   */
  minCost?: number;
  /**
   * Sort key for `sources[]`:
   *   - 'cost' (default): sum of cost desc
   *   - 'buckets':        number of active buckets desc
   *   - 'p99':            p99 dollars-per-bucket desc (tail-heaviness)
   *   - 'mean':           mean dollars-per-bucket desc
   * Tiebreak in all cases: source name asc (lex).
   */
  sort?: 'cost' | 'buckets' | 'p99' | 'mean';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface CostPerBucketSourceRow {
  source: string;
  /** Number of distinct (source, hour_start) observations with positive cost. */
  buckets: number;
  /** Sum of USD across this source's buckets. */
  cost: number;
  /** Smallest single-bucket dollar cost. */
  min: number;
  /** Median single-bucket dollar cost (nearest-rank). */
  p50: number;
  /** 90th-percentile single-bucket dollar cost. */
  p90: number;
  /** 99th-percentile single-bucket dollar cost. */
  p99: number;
  /** Largest single-bucket dollar cost. */
  max: number;
  /** Arithmetic mean dollar cost across this source's buckets. */
  mean: number;
}

export interface CostPerBucketPercentilesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minBuckets: number;
  top: number;
  /** Echo of the resolved `minCost` threshold (USD). */
  minCost: number;
  sort: 'cost' | 'buckets' | 'p99' | 'mean';
  /** Distinct sources observed in the window before display filters. */
  totalSources: number;
  /** Sum of buckets across all sources (== total observations). */
  totalBuckets: number;
  /** Sum of USD across all observations. */
  totalCost: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Per-row count of rows whose normalised model has no rate entry. */
  unknownModelRows: number;
  /**
   * Aggregated (source, hour) buckets that ended up with cost <= 0
   * (e.g. every row in the bucket was an unknown-rate model). Always
   * dropped before percentile computation.
   */
  droppedZeroCost: number;
  /**
   * Aggregated (source, hour) buckets whose cost fell below `minCost`.
   * Counted *after* multi-device/multi-model summing.
   */
  droppedMinCost: number;
  /** Source rows hidden by `minBuckets`. */
  droppedMinBuckets: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** Per-source rows after sort + display filters. */
  sources: CostPerBucketSourceRow[];
}

function nearestRank(sorted: number[], q: number): number {
  // R-1 / "lower" nearest-rank: rank = ceil(q * n), value at index rank-1.
  if (sorted.length === 0) return 0;
  if (q <= 0) return sorted[0]!;
  if (q >= 1) return sorted[sorted.length - 1]!;
  const rank = Math.ceil(q * sorted.length);
  const idx = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[idx]!;
}

/**
 * Per-row USD cost. Identical formula to `computeCost` so dollar
 * sums reconcile; rows whose model is missing from `rates` return 0
 * here and are counted in `unknownModelRows` upstream.
 */
function rowCost(q: QueueLine, rates: RateTable): { cost: number; known: boolean } {
  const model = normaliseModel(q.model);
  const rate = rates[model];
  if (!rate) return { cost: 0, known: false };
  const inT = q.input_tokens || 0;
  const cachedT = q.cached_input_tokens || 0;
  const outT = q.output_tokens || 0;
  const reasonT = q.reasoning_output_tokens || 0;
  const cost =
    (inT * rate.input) / 1_000_000 +
    (cachedT * rate.cachedInput) / 1_000_000 +
    (outT * rate.output) / 1_000_000 +
    (reasonT * rate.reasoning) / 1_000_000;
  return { cost, known: true };
}

export function buildCostPerBucketPercentiles(
  queue: QueueLine[],
  rates: RateTable,
  opts: CostPerBucketPercentilesOptions = {},
): CostPerBucketPercentilesReport {
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
  const minCost = opts.minCost ?? 0;
  if (!Number.isFinite(minCost) || minCost < 0) {
    throw new Error(
      `minCost must be a non-negative finite number (got ${opts.minCost})`,
    );
  }
  const sort = opts.sort ?? 'cost';
  if (sort !== 'cost' && sort !== 'buckets' && sort !== 'p99' && sort !== 'mean') {
    throw new Error(
      `sort must be 'cost' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
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

  // source -> hour_start -> cost (sum within the same hour for
  // duplicate device/model rows on the same source+hour).
  const perSourceBuckets = new Map<string, Map<string, number>>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;
  let unknownModelRows = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const { cost, known } = rowCost(q, rates);
    if (!known) unknownModelRows += 1;

    let perBucket = perSourceBuckets.get(src);
    if (!perBucket) {
      perBucket = new Map<string, number>();
      perSourceBuckets.set(src, perBucket);
    }
    perBucket.set(q.hour_start, (perBucket.get(q.hour_start) ?? 0) + cost);
  }

  // Build per-source rows over the full population (pre display filters).
  const allRows: CostPerBucketSourceRow[] = [];
  let totalBuckets = 0;
  let totalCost = 0;
  let droppedZeroCost = 0;
  let droppedMinCost = 0;
  for (const [source, buckets] of perSourceBuckets.entries()) {
    const costs: number[] = [];
    let sum = 0;
    for (const v of buckets.values()) {
      if (!Number.isFinite(v) || v <= 0) {
        droppedZeroCost += 1;
        continue;
      }
      if (minCost > 0 && v < minCost) {
        droppedMinCost += 1;
        continue;
      }
      costs.push(v);
      sum += v;
    }
    if (costs.length === 0) continue;
    costs.sort((a, b) => a - b);
    const n = costs.length;
    totalBuckets += n;
    totalCost += sum;

    allRows.push({
      source,
      buckets: n,
      cost: sum,
      min: costs[0]!,
      p50: nearestRank(costs, 0.5),
      p90: nearestRank(costs, 0.9),
      p99: nearestRank(costs, 0.99),
      max: costs[n - 1]!,
      mean: sum / n,
    });
  }

  const totalSources = allRows.length;

  // Apply minBuckets display filter.
  let droppedMinBuckets = 0;
  const afterMin: CostPerBucketSourceRow[] = [];
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
    if (sort === 'cost') primary = b.cost - a.cost;
    else if (sort === 'buckets') primary = b.buckets - a.buckets;
    else if (sort === 'p99') primary = b.p99 - a.p99;
    else primary = b.mean - a.mean;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  // Apply top cap.
  let droppedTopSources = 0;
  let kept = afterMin;
  if (top > 0 && afterMin.length > top) {
    droppedTopSources = afterMin.length - top;
    kept = afterMin.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minBuckets,
    top,
    minCost,
    sort,
    totalSources,
    totalBuckets,
    totalCost,
    droppedInvalidHourStart,
    droppedSourceFilter,
    unknownModelRows,
    droppedZeroCost,
    droppedMinCost,
    droppedMinBuckets,
    droppedTopSources,
    sources: kept,
  };
}
