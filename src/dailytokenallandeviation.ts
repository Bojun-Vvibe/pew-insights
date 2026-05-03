/**
 * daily-token-allan-deviation: per-source overlapping Allan
 * deviation (sigma_a) at tau=1 day of the daily total-token
 * series, computed across the source's gap-filled tenure of
 * contiguous calendar days.
 *
 * Why a fresh subcommand (orthogonality):
 *
 *   - Allan deviation is a *first-difference* dispersion statistic:
 *
 *         sigma_a^2(tau=1) = (1 / (2 * (N - 1)))
 *                            * sum_{i=0..N-2} (x[i+1] - x[i])^2
 *
 *     where N is the gap-filled tenure length. It measures the
 *     RMS step-to-step change of the daily token series.
 *   - `daily-token-autocorrelation-lag1` is a *normalized covariance*
 *     of (x[i], x[i+1]) divided by total variance. Two series can
 *     have identical lag-1 autocorrelation rho1 but radically
 *     different absolute step sizes -- Allan deviation captures
 *     the latter (in token units).
 *   - `burstiness` (Goh-Barabasi (sigma - mu)/(sigma + mu)) and
 *     `rolling-bucket-cv` describe the *marginal-distribution*
 *     dispersion of bucket totals -- they are order-INVARIANT.
 *     Shuffling the day vector leaves them unchanged but changes
 *     Allan deviation. (Allan is the *temporal*-difference
 *     dispersion.)
 *   - `daily-token-variance-of-logarithms` is on `log(x)` (a scale
 *     statistic), not on first differences. Allan operates on raw
 *     token deltas in the same units as `total_tokens`.
 *   - `daily-token-difference-sign-test` and
 *     `daily-token-second-diff-sign-runs` count sign patterns of
 *     the first / second difference -- they ignore magnitudes.
 *     Allan magnifies them and quadratically punishes large jumps.
 *   - `daily-token-monotone-run-length` and
 *     `daily-token-zero-crossing-rate` are categorical / counting,
 *     not RMS.
 *   - `daily-token-gini-coefficient`, `daily-token-pietra-ratio`,
 *     `daily-token-zenga-index`, `daily-token-mdd-rate`,
 *     `daily-token-percentile-gap-ratio` etc. are
 *     order-INVARIANT inequality scalars.
 *   - `daily-token-hurst-rs` measures long-range memory (slope of
 *     R/S vs window size). Allan tau=1 is a SHORT-range
 *     volatility scalar. Both can move independently.
 *   - `daily-token-spectral-*` family lives in frequency domain;
 *     Allan deviation lives in time domain on raw token deltas.
 *   - `daily-token-mann-kendall-tau` and
 *     `daily-token-cox-stuart-trend-test` are trend statistics
 *     (signed monotonicity), not first-difference RMS.
 *   - `interarrival-time` and `bucket-gap-distribution` are gap
 *     statistics on event spacing, not on token magnitudes.
 *
 * Allan deviation is the canonical frequency-stability metric in
 * time/frequency metrology (oscillator drift) and is widely used
 * in network-flow and token-rate stability work as well. Tau=1
 * (single sampling step) is the most sensitive to local
 * volatility and is the natural starting point.
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`):
 *      `total_tokens` summed over all rows for that day.
 *   2. Drop days with non-positive tokens (consistent with the
 *      `total_tokens > 0` floor used by `daily-token-autocorrelation-
 *      lag1` and `burstiness`).
 *   3. The source's *active-day series* is the sequence of those
 *      bucket totals sorted ascending by day. We compute Allan
 *      deviation on the *gap-filled tenure* (missing calendar days
 *      inside `[firstActiveDay, lastActiveDay]` are filled with 0
 *      before differencing). This is the only definition that
 *      makes "step from one calendar day to the literal next
 *      calendar day" semantically well-defined; the active-only
 *      variant would silently bridge over multi-day gaps.
 *   4. sigma_a = sqrt( (1 / (2 * (N - 1)))
 *                    * sum_{i=0..N-2} (x[i+1] - x[i])^2 )
 *      where N = nFilledDays (>= minDays). When N < 2 (single-day
 *      tenure even after fill) sigma_a is reported as 0 with
 *      `flat: true`. We also report:
 *        - `meanAbsStep`: mean |x[i+1] - x[i]| (L1 first-diff).
 *        - `maxAbsStep` and `argMaxStepDay`: largest single-day
 *          step magnitude and the *later* day of the spanning
 *          pair (i.e. the day on which the jump landed).
 *        - `allanRel`: sigma_a / mean (dimensionless). 0 when
 *          mean is 0, with `flat: true`.
 *        - `randomWalkAllanRatio`: sigma_a / sigma_iid where
 *          sigma_iid = popStddev(filled-series) is the Allan
 *          deviation of an i.i.d. shuffle of the same series
 *          (under i.i.d. assumption Allan(tau=1) -> sigma).
 *          Ratio > 1 = MORE step-volatility than i.i.d. (anti-
 *          persistent / oscillating); ratio < 1 = LESS step-
 *          volatility than i.i.d. (persistent / smooth); ratio
 *          ~ 1 = i.i.d.-like. Independent of lag-1 autocorrelation
 *          in sign (anti-persistent series can still have rho1
 *          near 0 if the oscillation period is > 2 days).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys (source asc).
 *
 * Knobs:
 *
 *   - `minDays` (default 3): structural floor on the source's
 *     gap-filled tenure length. Must be >= 3 (need at least two
 *     differences for the Allan formula to be a stable estimator;
 *     we permit 2 mathematically but reject below 3 to match the
 *     conventions of related axes).
 *   - `top` (default 0): display cap on `sources[]` after
 *     structural filters. Global denominators reflect the full
 *     population.
 */
import type { QueueLine } from './types.js';

export interface DailyTokenAllanDeviationOptions {
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
   * Minimum gap-filled tenure length (calendar days from
   * firstActiveDay to lastActiveDay inclusive). Must be >= 3.
   * Default 3.
   */
  minDays?: number;
  /**
   * Truncate `sources[]` to the top N after the sort. Display
   * filter only -- global denominators reflect the full population.
   * Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for the per-source table (display only). One of:
   *   - 'tokens' (default): total tokens desc, source asc.
   *   - 'allan':            sigma_a desc, source asc.
   *   - 'allanrel':         allanRel desc, source asc.
   *   - 'rwratio':          randomWalkAllanRatio desc, source asc.
   *   - 'ndays':            nFilledDays desc, source asc.
   * The `top` cap is applied AFTER the sort.
   */
  sort?: 'tokens' | 'allan' | 'allanrel' | 'rwratio' | 'hadamard' | 'hadamardratio' | 'ndays';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenAllanDeviationSourceRow {
  source: string;
  /** Sum of total_tokens across all active days. */
  totalTokens: number;
  /** Distinct active calendar days (positive token mass). */
  nActiveDays: number;
  /** Length of gap-filled tenure (lastActiveDay - firstActiveDay + 1). */
  nFilledDays: number;
  /** Mean of the gap-filled series. */
  mean: number;
  /** Population stddev of the gap-filled series (Allan i.i.d. baseline). */
  stddev: number;
  /**
   * Overlapping Allan deviation at tau=1 day on the gap-filled
   * series. `flat: true` and value 0 when n < 2.
   */
  allanDev: number;
  /** True iff the gap-filled series has fewer than 2 points. */
  flat: boolean;
  /** Mean absolute first-difference (|x[i+1] - x[i]|). 0 when flat. */
  meanAbsStep: number;
  /** Maximum absolute first-difference. 0 when flat. */
  maxAbsStep: number;
  /**
   * The LATER day of the spanning pair achieving maxAbsStep
   * (YYYY-MM-DD). When several pairs tie we take the EARLIEST
   * landing day (deterministic). null when flat.
   */
  argMaxStepDay: string | null;
  /**
   * allanDev / mean. 0 with `flatRel: true` when mean is 0
   * (degenerate-zero series). Dimensionless.
   */
  allanRel: number;
  /** True iff allanRel is undefined (mean=0) and reported as 0. */
  flatRel: boolean;
  /**
   * allanDev / stddev. Under i.i.d. Allan(tau=1) ~ stddev so
   * ratio ~ 1; > 1 = step-volatility EXCEEDS marginal stddev
   * (anti-persistent / oscillating); < 1 = step-volatility
   * BELOW marginal stddev (persistent / smooth). 0 with
   * `flatRwRatio: true` when stddev is 0.
   */
  randomWalkAllanRatio: number;
  /** True iff randomWalkAllanRatio is undefined (stddev=0) and reported as 0. */
  flatRwRatio: boolean;
  /**
   * Hadamard deviation at tau=1 day on the gap-filled series.
   *
   *     H(tau=1) = sqrt( (1 / (6 * (N - 2)))
   *                    * sum_{i=0..N-3} (x[i+2] - 2*x[i+1] + x[i])^2 )
   *
   * The 3-sample variant of Allan deviation. Insensitive to LINEAR
   * drift in the underlying series (a constant linear trend has
   * second-difference zero), so isolates the *non-drift* step
   * volatility. Allan and Hadamard agree for purely random series
   * and diverge whenever a source carries a sustained ramp.
   * Reported as 0 with `flatHadamard: true` when N < 3.
   */
  hadamardDev: number;
  /** True iff hadamardDev is undefined (N < 3) and reported as 0. */
  flatHadamard: boolean;
  /**
   * hadamardDev / allanDev. Dimensionless. Pure-random series
   * have ratio ~ 1.225 (asymptotic factor sqrt(3/2)); a strong
   * linear ramp drives the ratio toward 0 (Hadamard removes
   * drift, Allan does not); a strongly oscillating / second-
   * differences-noisy series drives it well above sqrt(3/2).
   * Reported as 0 with `flatHadamardRatio: true` when allanDev
   * = 0 or hadamardDev is undefined.
   */
  hadamardAllanRatio: number;
  /** True iff hadamardAllanRatio is undefined and reported as 0. */
  flatHadamardRatio: boolean;
  /** ISO date (YYYY-MM-DD) of the source's first active day. */
  firstActiveDay: string;
  /** ISO date (YYYY-MM-DD) of the source's last active day. */
  lastActiveDay: string;
}

export interface DailyTokenAllanDeviationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: 'tokens' | 'allan' | 'allanrel' | 'rwratio' | 'hadamard' | 'hadamardratio' | 'ndays';
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Sources with gap-filled tenure shorter than `minDays`. */
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenAllanDeviationSourceRow[];
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
 * Overlapping Allan deviation at tau=1 sample for a series.
 *
 *   sigma_a^2 = (1 / (2 * (N - 1))) * sum_{i=0..N-2} (x[i+1] - x[i])^2
 *
 * Returns 0 with flat=true when N < 2.
 */
export function allanDeviationTau1(values: number[]): { allan: number; flat: boolean } {
  const n = values.length;
  if (n < 2) return { allan: 0, flat: true };
  let sumSq = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = values[i + 1]! - values[i]!;
    sumSq += d * d;
  }
  return { allan: Math.sqrt(sumSq / (2 * (n - 1))), flat: false };
}

/**
 * Hadamard deviation at tau=1 sample (3-sample variant of Allan).
 *
 *   H^2 = (1 / (6 * (N - 2))) * sum_{i=0..N-3} (x[i+2] - 2*x[i+1] + x[i])^2
 *
 * Insensitive to linear drift. Returns 0 with flat=true when N < 3.
 */
export function hadamardDeviationTau1(values: number[]): { hadamard: number; flat: boolean } {
  const n = values.length;
  if (n < 3) return { hadamard: 0, flat: true };
  let sumSq = 0;
  for (let i = 0; i < n - 2; i++) {
    const d = values[i + 2]! - 2 * values[i + 1]! + values[i]!;
    sumSq += d * d;
  }
  return { hadamard: Math.sqrt(sumSq / (6 * (n - 2))), flat: false };
}

function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const next = new Date(ms + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenAllanDeviation(
  queue: QueueLine[],
  opts: DailyTokenAllanDeviationOptions = {},
): DailyTokenAllanDeviationReport {
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(`minDays must be an integer >= 3 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!['tokens', 'allan', 'allanrel', 'rwratio', 'hadamard', 'hadamardratio', 'ndays'].includes(sort)) {
    throw new Error(`sort must be one of tokens|allan|allanrel|rwratio|hadamard|hadamardratio|ndays (got ${opts.sort})`);
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
  const rows: DailyTokenAllanDeviationSourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((k) => days.get(k)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const nActive = series.length;
    if (nActive === 0) continue;

    const first = sortedKeys[0]!;
    const last = sortedKeys[sortedKeys.length - 1]!;
    const nFilled = dayDiffInclusive(first, last);

    if (nFilled < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    // Build gap-filled tenure series.
    const filled: number[] = [];
    const filledDays: string[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      filledDays.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const mean = popMean(filled);
    const stddev = popStddev(filled, mean);
    const a = allanDeviationTau1(filled);
    const h = hadamardDeviationTau1(filled);

    // First-difference summary (mean abs + max abs + arg-max landing day).
    let sumAbs = 0;
    let maxAbs = 0;
    let argMaxIdx = -1;
    for (let i = 0; i < filled.length - 1; i++) {
      const d = Math.abs(filled[i + 1]! - filled[i]!);
      sumAbs += d;
      if (d > maxAbs) {
        maxAbs = d;
        argMaxIdx = i + 1;
      }
    }
    const meanAbsStep = filled.length >= 2 ? sumAbs / (filled.length - 1) : 0;
    const argMaxStepDay =
      argMaxIdx >= 0 && argMaxIdx < filledDays.length ? filledDays[argMaxIdx]! : null;

    const allanRel = mean === 0 ? 0 : a.allan / mean;
    const flatRel = mean === 0;
    const randomWalkAllanRatio = stddev === 0 ? 0 : a.allan / stddev;
    const flatRwRatio = stddev === 0;
    const hadamardAllanRatio = h.flat || a.allan === 0 ? 0 : h.hadamard / a.allan;
    const flatHadamardRatio = h.flat || a.allan === 0;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      mean,
      stddev,
      allanDev: a.allan,
      flat: a.flat,
      meanAbsStep,
      maxAbsStep: maxAbs,
      argMaxStepDay,
      allanRel,
      flatRel,
      randomWalkAllanRatio,
      flatRwRatio,
      hadamardDev: h.hadamard,
      flatHadamard: h.flat,
      hadamardAllanRatio,
      flatHadamardRatio,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'allan':
        primary = b.allanDev - a.allanDev;
        break;
      case 'allanrel':
        primary = b.allanRel - a.allanRel;
        break;
      case 'rwratio':
        primary = b.randomWalkAllanRatio - a.randomWalkAllanRatio;
        break;
      case 'hadamard':
        primary = b.hadamardDev - a.hadamardDev;
        break;
      case 'hadamardratio':
        primary = b.hadamardAllanRatio - a.hadamardAllanRatio;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
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
