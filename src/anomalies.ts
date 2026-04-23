/**
 * Anomaly detection over daily token totals.
 *
 * For each day in the lookback window, we compute a z-score against a
 * trailing baseline (mean + sample stddev of the prior `baselineDays`
 * days). Any day whose |z| ≥ `threshold` is flagged. The first
 * `baselineDays` of the series get no z-score (status `warmup`) — we
 * need enough history to score against.
 *
 * Why a trailing baseline (not a global one)?
 *   - It tracks regime shifts: if the user permanently doubles their
 *     token usage, the baseline catches up after `baselineDays` and
 *     we stop flagging every day as anomalous.
 *   - It composes with `forecast` (linear trend over recent N) and
 *     `budget` (rolling burn). All three use windowed views.
 *
 * Sample stddev uses Bessel's correction (n-1) so a 7-day baseline of
 * [10,10,10,10,10,10,10] gives σ = 0 → z is undefined → status `flat`
 * (we don't divide by zero, and we don't pretend a perfectly flat
 * baseline is "low confidence" — it's just informationless).
 *
 * Determinism: like `forecast`, this module never reads Date.now()
 * inside the pure builder. Callers pass `asOf` explicitly so tests
 * stay reproducible.
 */
import { buildDailySeries } from './trend.js';
import type { QueueLine } from './types.js';

export type AnomalyStatus =
  | 'warmup'   // not enough trailing history yet
  | 'flat'     // baseline σ = 0, no scoring possible
  | 'normal'   // |z| < threshold
  | 'high'     // z ≥ +threshold (spike)
  | 'low';     // z ≤ -threshold (dip)

export interface AnomalyDay {
  day: string;
  tokens: number;
  /** Mean of the trailing baseline window (or null during warmup). */
  baselineMean: number | null;
  /** Sample stddev of the trailing baseline window (or null during warmup). */
  baselineStdDev: number | null;
  /** z = (tokens - baselineMean) / baselineStdDev. null when not scored. */
  z: number | null;
  status: AnomalyStatus;
}

export interface AnomaliesOptions {
  /** Total days of history to score, including warmup. Default 30. */
  lookbackDays?: number;
  /** Trailing-window size used to compute baseline. Default 7. */
  baselineDays?: number;
  /** |z| threshold for flagging. Default 2.0. */
  threshold?: number;
  /** Cutoff timestamp; defaults to now. */
  asOf?: string;
}

export interface AnomaliesReport {
  asOf: string;
  lookbackDays: number;
  baselineDays: number;
  threshold: number;
  /** Full per-day series, oldest → newest. */
  series: AnomalyDay[];
  /** Subset of `series` with status === 'high' or 'low'. */
  flagged: AnomalyDay[];
  /** True iff the most recent scored day is `high`. Used by CLI exit code. */
  recentHigh: boolean;
}

// ---------------------------------------------------------------------------
// Pure stats
// ---------------------------------------------------------------------------

/** Sample mean. Empty array → 0. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Sample stddev with Bessel's correction. n < 2 → 0 (no variance defined).
 * Always non-negative; 0 means perfectly flat.
 */
export function stdDev(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let sse = 0;
  for (const x of xs) {
    const d = x - m;
    sse += d * d;
  }
  return Math.sqrt(sse / (n - 1));
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function todayUtc(asOf: string): string {
  return asOf.slice(0, 10);
}

export function buildAnomalies(
  queue: QueueLine[],
  opts: AnomaliesOptions = {},
): AnomaliesReport {
  const lookbackDays = opts.lookbackDays ?? 30;
  const baselineDays = opts.baselineDays ?? 7;
  const threshold = opts.threshold ?? 2.0;
  const asOf = opts.asOf ?? new Date().toISOString();

  if (lookbackDays < 1) throw new Error(`lookbackDays must be >= 1`);
  if (baselineDays < 1) throw new Error(`baselineDays must be >= 1`);
  if (!(threshold > 0)) throw new Error(`threshold must be > 0`);

  // Pull lookbackDays + baselineDays so the first scored day still has
  // a full baseline window to look back at.
  const totalDays = lookbackDays + baselineDays;
  const endDay = todayUtc(asOf);
  const raw = buildDailySeries(queue, endDay, totalDays);

  const series: AnomalyDay[] = [];
  for (let i = 0; i < raw.length; i++) {
    const day = raw[i]!;
    if (i < baselineDays) {
      // Drop warmup days from the visible series — they exist only to
      // seed the baseline for the first scored day.
      continue;
    }
    const baselineSlice = raw.slice(i - baselineDays, i).map((d) => d.tokens);
    const m = mean(baselineSlice);
    const s = stdDev(baselineSlice);

    let status: AnomalyStatus;
    let z: number | null;
    if (s === 0) {
      // Flat baseline — can't compute z. If today differs from the
      // flat baseline at all, that's worth showing but we don't call
      // it `high` / `low` since there's no scale.
      z = null;
      status = 'flat';
    } else {
      z = (day.tokens - m) / s;
      if (z >= threshold) status = 'high';
      else if (z <= -threshold) status = 'low';
      else status = 'normal';
    }

    series.push({
      day: day.day,
      tokens: day.tokens,
      baselineMean: m,
      baselineStdDev: s,
      z,
      status,
    });
  }

  const flagged = series.filter((d) => d.status === 'high' || d.status === 'low');
  const recentHigh =
    series.length > 0 && series[series.length - 1]!.status === 'high';

  return {
    asOf,
    lookbackDays,
    baselineDays,
    threshold,
    series,
    flagged,
    recentHigh,
  };
}
