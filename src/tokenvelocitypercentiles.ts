/**
 * token-velocity-percentiles: per-source distribution of
 * tokens-per-minute computed at the single UTC hour bucket grain.
 *
 * For every (source, hour_start) pair with `total_tokens > 0` we
 * treat that bucket's `total_tokens / 60` as one tokens-per-minute
 * observation (a one-hour bucket is 60 minutes). We then report
 * per-source percentiles (p50, p90, p99), min, max, mean, sum of
 * tokens, and bucket count.
 *
 * Why a separate subcommand:
 *
 *   - `velocity` reports tokens-per-minute over *contiguous active
 *     stretches* of hours, collapsing neighbouring active hours
 *     into one stretch and emitting one rate per stretch (per
 *     period). It does not surface per-source distribution shape
 *     and it never reports the per-bucket spread inside a sprint.
 *   - `bucket-intensity` reports per-bucket magnitude *per model*
 *     in raw tokens (not normalised to per-minute) and never
 *     slices by source.
 *   - `bucket-density-percentile` pools all buckets across every
 *     source and model into one population; it cannot tell you
 *     "codex's typical per-minute pace vs claude-code's".
 *
 * token-velocity-percentiles is the per-source "how fast does each
 * tool actually move tokens during an active hour" lens, with the
 * tail/median spread surfaced for each source.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Percentiles use nearest-rank (R-1 / "lower" convention) on the
 * sorted observation list — matches `bucket-intensity`,
 * `interarrival-time`, `velocity` so numbers are comparable.
 */
import type { QueueLine } from './types.js';

/** Minutes in a single hour bucket. Used to normalise tokens -> tokens/minute. */
export const MINUTES_PER_BUCKET = 60;

export interface TokenVelocityPercentilesOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop *display rows* whose `buckets < minBuckets`. Display filter
   * only — `totalSources`, `totalBuckets`, `totalTokens` reflect the
   * full population. Counts surface as `droppedMinBuckets`. Default 0.
   */
  minBuckets?: number;
  /**
   * Truncate `sources[]` to the top N after sorting. Display filter
   * only. Counts surface as `droppedTopSources`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): sum of token mass desc
   *   - 'buckets':          number of active buckets desc
   *   - 'p99':              p99 tokens/minute desc (tail-heaviness)
   *   - 'mean':             mean tokens/minute desc
   * Tiebreak in all cases: source name asc (lex).
   */
  sort?: 'tokens' | 'buckets' | 'p99' | 'mean';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface TokenVelocitySourceRow {
  source: string;
  /** Number of distinct (source, hour_start) observations. */
  buckets: number;
  /** Sum of total_tokens across this source's buckets. */
  tokens: number;
  /** Smallest single-bucket tokens-per-minute. */
  min: number;
  /** Median single-bucket tokens-per-minute (nearest-rank). */
  p50: number;
  /** 90th-percentile single-bucket tokens-per-minute. */
  p90: number;
  /** 99th-percentile single-bucket tokens-per-minute. */
  p99: number;
  /** Largest single-bucket tokens-per-minute. */
  max: number;
  /** Arithmetic mean tokens-per-minute across this source's buckets. */
  mean: number;
}

export interface TokenVelocityPercentilesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minBuckets: number;
  top: number;
  sort: 'tokens' | 'buckets' | 'p99' | 'mean';
  /** Distinct sources observed in the window before display filters. */
  totalSources: number;
  /** Sum of buckets across all sources (== total observations). */
  totalBuckets: number;
  /** Sum of total_tokens across all observations. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Source rows hidden by `minBuckets`. */
  droppedMinBuckets: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** Per-source rows after sort + display filters. */
  sources: TokenVelocitySourceRow[];
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

export function buildTokenVelocityPercentiles(
  queue: QueueLine[],
  opts: TokenVelocityPercentilesOptions = {},
): TokenVelocityPercentilesReport {
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
  if (sort !== 'tokens' && sort !== 'buckets' && sort !== 'p99' && sort !== 'mean') {
    throw new Error(
      `sort must be 'tokens' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
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

  // source -> hour_start -> tokens (sum within the same hour for
  // duplicate device/model rows on the same source+hour).
  const perSourceBuckets = new Map<string, Map<string, number>>();

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

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let perBucket = perSourceBuckets.get(src);
    if (!perBucket) {
      perBucket = new Map<string, number>();
      perSourceBuckets.set(src, perBucket);
    }
    perBucket.set(q.hour_start, (perBucket.get(q.hour_start) ?? 0) + tt);
  }

  // Build per-source rows over the full population (pre display filters).
  const allRows: TokenVelocitySourceRow[] = [];
  let totalBuckets = 0;
  let totalTokens = 0;
  for (const [source, buckets] of perSourceBuckets.entries()) {
    const rates: number[] = [];
    let sum = 0;
    for (const v of buckets.values()) {
      rates.push(v / MINUTES_PER_BUCKET);
      sum += v;
    }
    if (rates.length === 0) continue;
    rates.sort((a, b) => a - b);
    const n = rates.length;
    totalBuckets += n;
    totalTokens += sum;

    allRows.push({
      source,
      buckets: n,
      tokens: sum,
      min: rates[0]!,
      p50: nearestRank(rates, 0.5),
      p90: nearestRank(rates, 0.9),
      p99: nearestRank(rates, 0.99),
      max: rates[n - 1]!,
      mean: sum / MINUTES_PER_BUCKET / n,
    });
  }

  const totalSources = allRows.length;

  // Apply minBuckets display filter.
  let droppedMinBuckets = 0;
  const afterMin: TokenVelocitySourceRow[] = [];
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
    sort,
    totalSources,
    totalBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedMinBuckets,
    droppedTopSources,
    sources: kept,
  };
}
