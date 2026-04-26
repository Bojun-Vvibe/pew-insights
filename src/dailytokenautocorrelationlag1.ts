/**
 * daily-token-autocorrelation-lag1: per-source lag-1 (Pearson)
 * autocorrelation of *daily* total-token totals across the source's
 * own tenure of contiguous calendar days.
 *
 * Why a fresh subcommand:
 *
 *   - `burstiness` and `rolling-bucket-cv` describe the *magnitude*
 *     of variance in token-per-bucket, but say nothing about whether
 *     today's token mass actually predicts tomorrow's. A perfectly
 *     spiky source with i.i.d. days is "noisy". A spiky source whose
 *     spikes cluster (one heavy day -> another heavy day) is
 *     "persistent". The two look identical to CV-based metrics.
 *   - `trend` and `forecast` fit a *linear time trend* (drift), not
 *     a serial-dependence statistic. A source can have zero linear
 *     trend and still have rho1 = 0.8 (highly persistent).
 *   - `interarrival-time`, `bucket-streak-length`, `bucket-gap-*` are
 *     about *contiguity* and *gap structure* of activity, not about
 *     the magnitude correlation between adjacent days.
 *   - `source-decay-half-life` measures how fast a source fades,
 *     not the day-to-day stickiness of its volume.
 *   - `source-rank-churn` is a categorical (rank-permutation)
 *     statistic, not a numerical autocorrelation.
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`): tokens
 *      summed over all device/model rows for that day. Days with
 *      non-positive tokens are dropped (consistent with the
 *      `total_tokens > 0` floor used by `rolling-bucket-cv` and
 *      `burstiness`).
 *   2. The source's *active-day series* is the values of those
 *      buckets sorted ascending by day. By default we operate on
 *      the source's own *consecutive active days* (no calendar
 *      gap-fill): rho1 is computed over the pair sequence
 *      `(x[i], x[i+1])`. This is the right call when "did a heavy
 *      day predict the next active day" is the question.
 *   3. Optionally (`fillGaps: true`) we dense-fill missing calendar
 *      days inside the source's tenure with 0 tokens before
 *      computing rho1. Useful when "did a heavy day predict the
 *      *literal* next calendar day" is the question. The two
 *      definitions agree for sources with no gaps and diverge for
 *      bursty / sporadic sources -- both are reported on the row
 *      so the operator can read both at once.
 *   4. rho1 = sum_{i<n-1} (x[i]-mean) * (x[i+1]-mean)
 *             / sum_i (x[i]-mean)^2
 *      (lag-k=1 Pearson autocorrelation, biased divisor matching
 *      stats.acf and numpy.correlate conventions). When the
 *      denominator is 0 (constant series) rho1 is reported as 0
 *      with a `flat: true` flag so the operator can distinguish
 *      "literally undefined" from "noisy zero".
 *   5. Aggregate per-source: `nDays` (active days), `nFilled` (days
 *      under fillGaps), `mean`, `stddev`, `rho1Active`, `rho1Filled`,
 *      `flatActive`, `flatFilled`, and the ISO of the *first* and
 *      *last* active day so the reader can see the tenure.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys.
 *
 * Knobs:
 *
 *   - `minDays` (default 3): structural floor. A source must have
 *     `>= minDays` active days for rho1 to be defined at all (need
 *     at least two pairs to be meaningfully different from a 2-day
 *     coin-flip). Sources below this floor surface as
 *     `droppedSparseSources`. Must be >= 3.
 *   - `top` (default 0): display cap on `sources[]` after structural
 *     filters. Global denominators reflect the full population.
 */
import type { QueueLine } from './types.js';

export interface DailyTokenAutocorrelationLag1Options {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Restrict analysis to a single source. Non-matching rows surface
   * as `droppedSourceFilter`. null = no filter.
   */
  source?: string | null;
  /**
   * Minimum number of *active* calendar days for the source's row
   * to be reported. Must be >= 3. Default 3.
   */
  minDays?: number;
  /**
   * Truncate `sources[]` to the top N by total tokens after all
   * structural floors. Display filter only -- global denominators
   * reflect the full population. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for the per-source table (display only). One of:
   *   - 'tokens' (default): total tokens desc, source asc.
   *   - 'rho1active': rho1Active desc, source asc.
   *   - 'rho1filled': rho1Filled desc, source asc.
   *   - 'ndays':     nActiveDays desc, source asc.
   * The `top` cap is applied *after* the sort, so changing the
   * sort changes which sources are kept under a non-zero cap.
   */
  sort?: 'tokens' | 'rho1active' | 'rho1filled' | 'ndays';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenAutocorrelationLag1SourceRow {
  source: string;
  /** Sum of total_tokens across all active days. */
  totalTokens: number;
  /** Count of distinct active calendar days (positive token mass). */
  nActiveDays: number;
  /** Count of calendar days in tenure under gap-fill (last - first + 1). */
  nFilledDays: number;
  /** Mean of the active-day series. */
  mean: number;
  /** Population stddev of the active-day series. */
  stddev: number;
  /**
   * Lag-1 Pearson autocorrelation over the active-day series
   * (pairs are consecutive *active* days, no gap-fill). 0 with
   * `flatActive: true` when the series is constant.
   */
  rho1Active: number;
  /** True iff the active-day series is constant (rho1 undefined). */
  flatActive: boolean;
  /**
   * Lag-1 Pearson autocorrelation over the gap-filled tenure
   * (missing calendar days inside [first, last] become 0 tokens).
   * 0 with `flatFilled: true` when the resulting series is constant.
   */
  rho1Filled: number;
  /** True iff the gap-filled series is constant (rho1 undefined). */
  flatFilled: boolean;
  /** ISO date (YYYY-MM-DD) of the source's first active day. */
  firstActiveDay: string;
  /** ISO date (YYYY-MM-DD) of the source's last active day. */
  lastActiveDay: string;
}

export interface DailyTokenAutocorrelationLag1Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minDays floor. */
  minDays: number;
  /** Echo of resolved top cap (0 = no cap). */
  top: number;
  /** Echo of resolved sort key. */
  sort: 'tokens' | 'rho1active' | 'rho1filled' | 'ndays';
  /** Echo of source filter (null when not set). */
  source: string | null;
  /** Sum of total_tokens across all kept rows. */
  totalTokens: number;
  /** Distinct sources seen (before display filters). */
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Sources with fewer than `minDays` active days. */
  droppedSparseSources: number;
  /** Source rows hidden by the `top` cap (counted after floors). */
  droppedTopSources: number;
  /** One row per kept source. Sorted by totalTokens desc, then source asc. */
  sources: DailyTokenAutocorrelationLag1SourceRow[];
}

function popMean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

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
 * Lag-1 Pearson autocorrelation with biased (1/n) divisor, matching
 * statsmodels.acf and numpy.correlate conventions:
 *
 *   rho1 = sum_{i=0..n-2} (x[i] - mean) * (x[i+1] - mean)
 *          / sum_{i=0..n-1} (x[i] - mean)^2
 *
 * Returns { rho1: 0, flat: true } when the denominator is 0
 * (constant series) so the caller can distinguish "undefined" from
 * "weakly negative".
 */
function rho1(values: number[]): { rho1: number; flat: boolean } {
  const n = values.length;
  if (n < 2) return { rho1: 0, flat: true };
  const mu = popMean(values);
  let denom = 0;
  for (const v of values) {
    const d = v - mu;
    denom += d * d;
  }
  if (denom === 0) return { rho1: 0, flat: true };
  let num = 0;
  for (let i = 0; i < n - 1; i++) {
    num += (values[i]! - mu) * (values[i + 1]! - mu);
  }
  return { rho1: num / denom, flat: false };
}

/**
 * Add `days` UTC days to a YYYY-MM-DD string, return the new
 * YYYY-MM-DD. Pure: no Date.now().
 */
function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const next = new Date(ms + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Inclusive day count between two YYYY-MM-DD strings (a <= b). */
function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenAutocorrelationLag1(
  queue: QueueLine[],
  opts: DailyTokenAutocorrelationLag1Options = {},
): DailyTokenAutocorrelationLag1Report {
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(`minDays must be an integer >= 3 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!['tokens', 'rho1active', 'rho1filled', 'ndays'].includes(sort)) {
    throw new Error(`sort must be one of tokens|rho1active|rho1filled|ndays (got ${opts.sort})`);
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

  // source -> day(YYYY-MM-DD) -> tokens
  const agg = new Map<string, Map<string, number>>();
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

    const day = q.hour_start.slice(0, 10);
    let days = agg.get(src);
    if (!days) {
      days = new Map<string, number>();
      agg.set(src, days);
    }
    days.set(day, (days.get(day) ?? 0) + tt);
  }

  const totalSources = agg.size;
  const rows: DailyTokenAutocorrelationLag1SourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((k) => days.get(k)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const nActive = series.length;
    if (nActive < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const first = sortedKeys[0]!;
    const last = sortedKeys[sortedKeys.length - 1]!;
    const nFilled = dayDiffInclusive(first, last);

    // Build gap-filled tenure series.
    const filled: number[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      cursor = addDays(cursor, 1);
    }

    const mean = popMean(series);
    const stddev = popStddev(series, mean);
    const a = rho1(series);
    const f = rho1(filled);

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      mean,
      stddev,
      rho1Active: a.rho1,
      flatActive: a.flat,
      rho1Filled: f.rho1,
      flatFilled: f.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rho1active':
        primary = b.rho1Active - a.rho1Active;
        break;
      case 'rho1filled':
        primary = b.rho1Filled - a.rho1Filled;
        break;
      case 'ndays':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
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
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
