/**
 * Linear-regression forecast for daily token usage.
 *
 * Design notes
 * ------------
 * We fit ordinary-least-squares y = a + b*x over the last N daily token totals
 * (x = day index 0..N-1, y = tokens that day, missing days filled with 0 to keep
 * the time axis uniform). From the fit we project:
 *   - tomorrow's total: ŷ at x = N
 *   - week-end total:   sum of ŷ for the remaining UTC-week days through Sunday,
 *                       *added to* the actual tokens already observed this week
 *
 * Confidence interval
 * -------------------
 * Residual standard error s = sqrt( SSE / (N-2) ). For each forecast point we use
 * the standard prediction-interval form
 *     ŷ ± z * s * sqrt(1 + 1/N + (x* - x̄)^2 / Σ(xi - x̄)^2)
 * with z = 1.96 (≈ 95%). For N < 4 we fall back to a wide ±2*mean band and flag
 * `lowConfidence`. Negative bounds clamp to zero (token counts can't be negative).
 *
 * The whole module is deterministic given (queue, asOf): no Date.now() inside
 * pure functions — everything depends on the explicit `asOf` parameter so tests
 * stay reproducible.
 */
import { buildDailySeries } from './trend.js';
import type { QueueLine } from './types.js';

export interface ForecastOptions {
  /** Number of recent days to fit the regression on (default 14). */
  lookbackDays?: number;
  /** Cutoff timestamp; defaults to now. */
  asOf?: string;
  /** z-score for the prediction interval (default 1.96 ≈ 95%). */
  z?: number;
}

export interface ForecastPoint {
  /** ISO yyyy-mm-dd day this prediction is for. */
  day: string;
  predicted: number;
  /** Lower bound of the prediction interval, clamped to 0. */
  lower: number;
  /** Upper bound of the prediction interval. */
  upper: number;
}

export interface ForecastReport {
  asOf: string;
  lookbackDays: number;
  /** Slope: tokens/day change. */
  slope: number;
  /** Intercept of the OLS fit. */
  intercept: number;
  /** Coefficient of determination R² in [0,1]. NaN when variance is 0. */
  r2: number;
  /** Residual standard error. */
  residualStdErr: number;
  /** Sample size (== lookbackDays after zero-fill). */
  n: number;
  /** True when N is too small or all-y are zero — predictions are wide guesses. */
  lowConfidence: boolean;
  /** The historical series we fit on (oldest → newest). */
  history: Array<{ day: string; tokens: number }>;
  /** Forecast for tomorrow (asOf + 1 day, UTC). */
  tomorrow: ForecastPoint;
  /** Per-day forecast for remaining days of the current UTC ISO week (Mon..Sun). */
  weekRemaining: ForecastPoint[];
  /** Sum of actual tokens already observed this UTC week (Mon → asOf, inclusive). */
  weekObserved: number;
  /** Projected total for the full UTC week = observed + Σ weekRemaining.predicted. */
  weekProjected: number;
  /** Lower / upper aggregate bounds for the week projection (sum of bounds). */
  weekProjectedLower: number;
  weekProjectedUpper: number;
}

// ---------------------------------------------------------------------------
// Pure stats helpers
// ---------------------------------------------------------------------------

interface OlsFit {
  slope: number;
  intercept: number;
  /** Σ(xi - x̄)^2 — kept around for prediction-interval math. */
  sxx: number;
  /** Mean of xs. */
  xMean: number;
  /** Sum of squared residuals. */
  sse: number;
  /** Sum of squared deviations of y. */
  sst: number;
}

export function olsFit(ys: number[]): OlsFit {
  const n = ys.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, sxx: 0, xMean: 0, sse: 0, sst: 0 };
  }
  const xs = ys.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - xMean;
    const dy = ys[i]! - yMean;
    sxy += dx * dy;
    sxx += dx * dx;
    sst += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i]!;
    const r = ys[i]! - yhat;
    sse += r * r;
  }
  return { slope, intercept, sxx, xMean, sse, sst };
}

function predictPoint(
  fit: OlsFit,
  xStar: number,
  n: number,
  z: number,
): { predicted: number; lower: number; upper: number } {
  const predicted = fit.intercept + fit.slope * xStar;
  if (n < 3 || fit.sxx === 0) {
    // Cannot estimate residual variance reliably.
    const halfWidth = Math.max(predicted * 0.5, 1);
    return {
      predicted,
      lower: Math.max(0, predicted - halfWidth),
      upper: predicted + halfWidth,
    };
  }
  const s = Math.sqrt(fit.sse / (n - 2));
  const dx = xStar - fit.xMean;
  const stderr = s * Math.sqrt(1 + 1 / n + (dx * dx) / fit.sxx);
  return {
    predicted,
    lower: Math.max(0, predicted - z * stderr),
    upper: predicted + z * stderr,
  };
}

// ---------------------------------------------------------------------------
// Date helpers (UTC-only)
// ---------------------------------------------------------------------------

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Return ISO yyyy-mm-dd for the Monday on or before `d` (UTC). We use ISO weeks
 * (Mon=1..Sun=7) so the "week-end" projection lines up with how most teams plan.
 */
export function isoWeekStart(d: Date): string {
  const dayOfWeek = d.getUTCDay(); // 0=Sun..6=Sat
  // Convert Sunday(0) -> 7 so Monday is the start.
  const isoDow = dayOfWeek === 0 ? 7 : dayOfWeek;
  const monday = addDays(d, -(isoDow - 1));
  return isoDay(monday);
}

/** Return ISO yyyy-mm-dd for the Sunday at the end of the same ISO week as `d`. */
export function isoWeekEnd(d: Date): string {
  const dayOfWeek = d.getUTCDay();
  const isoDow = dayOfWeek === 0 ? 7 : dayOfWeek;
  const sunday = addDays(d, 7 - isoDow);
  return isoDay(sunday);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function buildForecast(queue: QueueLine[], opts: ForecastOptions = {}): ForecastReport {
  const asOf = opts.asOf ?? new Date().toISOString();
  const lookbackDays = opts.lookbackDays ?? 14;
  const z = opts.z ?? 1.96;

  if (lookbackDays < 2) {
    throw new Error(`lookbackDays must be >= 2 (got ${lookbackDays})`);
  }

  const asOfDate = new Date(asOf);
  const endDay = asOf.slice(0, 10);
  const series = buildDailySeries(queue, endDay, lookbackDays);
  const ys = series.map((s) => s.tokens);
  const fit = olsFit(ys);

  const totalY = ys.reduce((a, b) => a + b, 0);
  const r2 = fit.sst === 0 ? Number.NaN : Math.max(0, 1 - fit.sse / fit.sst);
  const residualStdErr = ys.length >= 3 ? Math.sqrt(fit.sse / (ys.length - 2)) : Number.NaN;
  const lowConfidence = ys.length < 4 || totalY === 0;

  // Tomorrow.
  const tomorrowDate = addDays(asOfDate, 1);
  const tomorrowPt = predictPoint(fit, ys.length, ys.length, z);
  const tomorrow: ForecastPoint = { day: isoDay(tomorrowDate), ...tomorrowPt };

  // Week-end: predict each remaining day this UTC week, sum + add observed.
  const weekStartIso = isoWeekStart(asOfDate);
  const weekEndIso = isoWeekEnd(asOfDate);
  const weekStart = new Date(weekStartIso + 'T00:00:00.000Z');
  const weekEnd = new Date(weekEndIso + 'T00:00:00.000Z');

  // Observed = sum of tokens whose hour_start falls in [weekStart, asOf].
  const weekStartIsoStamp = weekStart.toISOString();
  const weekObserved = queue.reduce((acc, q) => {
    if (q.hour_start >= weekStartIsoStamp && q.hour_start <= asOf) {
      return acc + (q.total_tokens || 0);
    }
    return acc;
  }, 0);

  const weekRemaining: ForecastPoint[] = [];
  let cursor = addDays(asOfDate, 1);
  // Predict each day from tomorrow through Sunday inclusive (compare by ISO day,
  // not millisecond, so the time-of-day in `asOf` doesn't trim the last entry).
  while (isoDay(cursor) <= weekEndIso) {
    // x* relative to history: today (last bucket) is index N-1, tomorrow = N, etc.
    const offset = Math.round((cursor.getTime() - asOfDate.getTime()) / 86_400_000);
    const xStar = ys.length - 1 + offset;
    const pt = predictPoint(fit, xStar, ys.length, z);
    weekRemaining.push({ day: isoDay(cursor), ...pt });
    cursor = addDays(cursor, 1);
  }

  const weekProjected = weekObserved + weekRemaining.reduce((a, p) => a + p.predicted, 0);
  const weekProjectedLower =
    weekObserved + weekRemaining.reduce((a, p) => a + p.lower, 0);
  const weekProjectedUpper =
    weekObserved + weekRemaining.reduce((a, p) => a + p.upper, 0);

  return {
    asOf,
    lookbackDays,
    slope: fit.slope,
    intercept: fit.intercept,
    r2,
    residualStdErr,
    n: ys.length,
    lowConfidence,
    history: series.map((s) => ({ day: s.day, tokens: s.tokens })),
    tomorrow,
    weekRemaining,
    weekObserved,
    weekProjected,
    weekProjectedLower,
    weekProjectedUpper,
  };
}
