/**
 * burstiness: per-(model|source) spikiness of hourly token usage.
 *
 * For each group, bucket rows by `hour_start` (the queue's natural
 * 1-hour grain) and sum `total_tokens` per bucket. Then compute,
 * across the *active* hour buckets seen for that group:
 *
 *   - mean tokens per active hour
 *   - stddev tokens per active hour (population, ddof=0)
 *   - coefficient of variation (cv = stddev / mean), the headline
 *     scalar: cv ≈ 0 means perfectly steady hour-to-hour, cv ≈ 1
 *     means stddev equals mean (Poisson-ish noise), cv >> 1 means
 *     a few huge hours dwarf the rest (heavy bursts).
 *   - p50 / p95 / max tokens per active hour
 *   - burst ratio = max / p50 (how much louder the peak hour is
 *     than the median active hour)
 *   - active hours: number of distinct hour buckets the group hit
 *
 * Distinct lens vs the existing reports:
 *
 *   - `velocity` is rate over time (tokens / wall-clock window),
 *     a single throughput number — it cannot tell a steady drip
 *     from a single 10× spike that averages out.
 *   - `concurrency` is overlap of session activity, not token
 *     dispersion.
 *   - `streaks` and `gaps` are about *contiguity* of activity,
 *     not its magnitude variance.
 *   - `peak-hour-share` and `weekday-share` measure *which* hour
 *     or weekday is hottest, not how spiky the time series is.
 *   - `time-of-day` collapses across days; burstiness keeps each
 *     hour as its own observation.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. The hour bucket key is the row's
 * `hour_start` exactly as stored — no re-quantisation — so the
 * builder inherits whatever pew already wrote.
 *
 * Why population stddev (ddof=0) and not sample (ddof=1): we are
 * describing the observed window, not estimating a parameter of a
 * larger population. ddof=0 is well-defined for n=1 (returns 0,
 * cv=0) which keeps the report stable for thinly-active models.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export type BurstinessDimension = 'model' | 'source';

export interface BurstinessOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Group rows by `model` (default) or by `source`.
   */
  by?: BurstinessDimension;
  /**
   * Drop group rows whose total token count is `< minTokens` from
   * `groups[]`. Display filter only — global denominators reflect
   * the full population. Default 0 (keep every group).
   */
  minTokens?: number;
  /**
   * Drop groups with fewer than `minActiveHours` distinct hour
   * buckets. Display filter only. Default 1 (keep every group
   * with any activity). Useful for hiding the long-tail of
   * one-hour-only models which trivially score cv = 0.
   */
  minActiveHours?: number;
  /**
   * Truncate `groups[]` to the top N by total tokens. Display
   * filter only. Default 0 (no truncation).
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface BurstinessGroupRow {
  /**
   * Group key. When `by === 'model'` this is the normalised model
   * id; when `by === 'source'` this is the raw source string.
   * Field name kept as `model` for downstream JSON consumer
   * symmetry with the size/share family.
   */
  model: string;
  /** Sum of total_tokens across all hour buckets. */
  totalTokens: number;
  /** Distinct hour buckets the group hit (>= 1 in `groups[]`). */
  activeHours: number;
  /** Mean tokens across active hour buckets (totalTokens/activeHours). */
  meanTokensPerHour: number;
  /** Population stddev of tokens across active hour buckets. */
  stddevTokensPerHour: number;
  /** Coefficient of variation = stddev / mean. 0 if mean = 0. */
  cv: number;
  /** Median tokens across active hour buckets (linear interp on n>1). */
  p50TokensPerHour: number;
  /** 95th percentile tokens across active hour buckets (linear interp). */
  p95TokensPerHour: number;
  /** Largest token count seen in any single hour bucket. */
  maxTokensPerHour: number;
  /** maxTokensPerHour / p50TokensPerHour. 0 if p50 = 0. */
  burstRatio: number;
}

export interface BurstinessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved grouping dimension. */
  by: BurstinessDimension;
  /** Echo of the resolved minTokens floor. */
  minTokens: number;
  /** Echo of the resolved minActiveHours floor. */
  minActiveHours: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Sum of total_tokens across all kept rows for the *global* row. */
  totalTokens: number;
  /** Distinct hour buckets seen across all groups. */
  globalActiveHours: number;
  /** Global mean tokens per active hour. */
  globalMeanTokensPerHour: number;
  /** Global stddev. */
  globalStddevTokensPerHour: number;
  /** Global cv. */
  globalCv: number;
  /** Global max tokens in any hour. */
  globalMaxTokensPerHour: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** Group rows hidden by the minTokens floor. */
  droppedGroupRows: number;
  /** Group rows hidden by the minActiveHours floor. */
  droppedSparseGroups: number;
  /** Group rows hidden by the `top` cap (counted after other floors). */
  droppedTopGroups: number;
  /**
   * One row per kept group. Sorted by total tokens desc, then
   * group key asc.
   */
  groups: BurstinessGroupRow[];
}

/**
 * Population stddev (ddof=0). For n <= 1 returns 0 — well-defined
 * for the "this group only ever ran one hour" case.
 */
function popStddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - mean;
    s += d * d;
  }
  return Math.sqrt(s / values.length);
}

/**
 * Linear-interpolated percentile on an already-sorted ascending
 * array. Matches numpy's default ('linear') interpolation for n>1.
 * Returns 0 for empty input.
 */
function percentileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export function buildBurstiness(
  queue: QueueLine[],
  opts: BurstinessOptions = {},
): BurstinessReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative number (got ${opts.minTokens})`);
  }
  const minActiveHours = opts.minActiveHours ?? 1;
  if (!Number.isInteger(minActiveHours) || minActiveHours < 1) {
    throw new Error(
      `minActiveHours must be a positive integer (got ${opts.minActiveHours})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const by: BurstinessDimension = opts.by ?? 'model';
  if (by !== 'model' && by !== 'source') {
    throw new Error(`by must be 'model' or 'source' (got ${opts.by})`);
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

  // group -> hour_start -> tokens
  const agg = new Map<string, Map<string, number>>();
  // global hour_start -> tokens (across all groups)
  const globalAgg = new Map<string, number>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;

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

    const groupKey =
      by === 'source'
        ? typeof q.source === 'string' && q.source !== ''
          ? q.source
          : 'unknown'
        : normaliseModel(typeof q.model === 'string' ? q.model : '');

    let hours = agg.get(groupKey);
    if (!hours) {
      hours = new Map<string, number>();
      agg.set(groupKey, hours);
    }
    hours.set(q.hour_start, (hours.get(q.hour_start) ?? 0) + tt);
    globalAgg.set(q.hour_start, (globalAgg.get(q.hour_start) ?? 0) + tt);
  }

  const groups: BurstinessGroupRow[] = [];
  let droppedGroupRows = 0;
  let droppedSparseGroups = 0;

  for (const [group, hours] of agg) {
    const values = Array.from(hours.values());
    const total = values.reduce((acc, x) => acc + x, 0);
    if (total <= 0) continue;
    if (total < minTokens) {
      droppedGroupRows += 1;
      continue;
    }
    const activeHours = values.length;
    if (activeHours < minActiveHours) {
      droppedSparseGroups += 1;
      continue;
    }
    const mean = total / activeHours;
    const stddev = popStddev(values, mean);
    const cv = mean > 0 ? stddev / mean : 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const p50 = percentileSorted(sorted, 0.5);
    const p95 = percentileSorted(sorted, 0.95);
    const max = sorted[sorted.length - 1]!;
    const burstRatio = p50 > 0 ? max / p50 : 0;

    groups.push({
      model: group,
      totalTokens: total,
      activeHours,
      meanTokensPerHour: mean,
      stddevTokensPerHour: stddev,
      cv,
      p50TokensPerHour: p50,
      p95TokensPerHour: p95,
      maxTokensPerHour: max,
      burstRatio,
    });
  }

  groups.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopGroups = 0;
  let kept = groups;
  if (top > 0 && groups.length > top) {
    droppedTopGroups = groups.length - top;
    kept = groups.slice(0, top);
  }

  // Global stats over the union of all hour buckets.
  const globalValues = Array.from(globalAgg.values());
  const globalTotal = globalValues.reduce((acc, x) => acc + x, 0);
  const globalActiveHours = globalValues.length;
  const globalMean = globalActiveHours > 0 ? globalTotal / globalActiveHours : 0;
  const globalStddev = popStddev(globalValues, globalMean);
  const globalCv = globalMean > 0 ? globalStddev / globalMean : 0;
  const globalMax = globalValues.length > 0 ? Math.max(...globalValues) : 0;

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    minTokens,
    minActiveHours,
    top,
    totalTokens: globalTotal,
    globalActiveHours,
    globalMeanTokensPerHour: globalMean,
    globalStddevTokensPerHour: globalStddev,
    globalCv,
    globalMaxTokensPerHour: globalMax,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedGroupRows,
    droppedSparseGroups,
    droppedTopGroups,
    groups: kept,
  };
}
