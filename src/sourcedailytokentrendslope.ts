/**
 * source-daily-token-trend-slope: per-source ordinary least squares
 * (OLS) regression slope of **daily total_tokens** against day index
 * over the source's lifetime.
 *
 * For each source we:
 *
 *   1. Aggregate `total_tokens` per UTC calendar day (`hour_start`
 *      truncated to YYYY-MM-DD).
 *   2. Index days as integers `t = 0 .. n-1` over the source's
 *      **active** day sequence (not wall-clock days). Inactive
 *      days are NOT inserted as zeroes — this matches every other
 *      `source-active-*` stat in the codebase, where the time axis
 *      is the source's own active sequence.
 *   3. Fit OLS y = a + b*t over (t, dailyTokens). Report:
 *
 *        - `slopeTokensPerActiveDay` (= b): expected change in
 *          daily token mass per additional active day. Positive =
 *          source is *growing*; negative = *shrinking*.
 *        - `interceptTokens` (= a): fitted day-zero intercept.
 *        - `meanDailyTokens`: simple arithmetic mean of the daily
 *          totals; the natural normalizer.
 *        - `normalizedSlope` = `slope / meanDailyTokens`: relative
 *          per-active-day growth rate (unitless). 0.10 means the
 *          source is growing at ~10% of its own mean per active
 *          day. This is the column you sort by when comparing
 *          across sources of wildly different scales — a raw slope
 *          of +1M tokens/day from a 100M-tokens/day source is
 *          *not* the same story as +1M from a 2M source.
 *        - `r2` in [0, 1]: coefficient of determination. Tells
 *          you whether the slope is actually a clean trend or
 *          just noise around the mean. Sources with `r2 < 0.05`
 *          have effectively no linear trend regardless of the
 *          slope sign.
 *        - `firstActiveDay` / `lastActiveDay`: ISO YYYY-MM-DD
 *          boundaries of the fit.
 *        - `nActiveDays`: number of days in the regression.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `trend` is a *global* week-over-week and day-over-day delta
 *     with sparklines. It is not per-source and does not fit a
 *     line over the source's lifetime.
 *   - `daily-token-zscore-extremes` flags outlier daily totals via
 *     z-scores; it explicitly ignores the mean trend.
 *   - `daily-token-monotone-run-length`,
 *     `daily-token-second-diff-sign-runs`, and
 *     `daily-token-autocorrelation-lag1` look at *order structure*
 *     (run lengths, sign runs of curvature, lag-1 correlation) of
 *     the daily series, not at a fitted linear slope.
 *   - `daily-token-gini-coefficient` measures concentration
 *     across days, not direction over time.
 *   - `prompt-output-correlation` fits y=output vs x=input per
 *     group; the regressor is *prompt size*, not *time index*.
 *   - `source-decay-half-life` fits a different functional form
 *     (exponential decay) and only on the recent decay phase, not
 *     a linear OLS over the source's whole active history.
 *   - `source-output-token-benford-deviation`,
 *     `source-io-ratio-stability`, `source-token-mass-hour-centroid`,
 *     `source-active-hour-*`, `source-day-of-week-token-mass-share`,
 *     `source-hour-of-day-*`, and `source-weekend-weekday-cache-share-gap`
 *     all aggregate over the source's whole lifetime to a single
 *     scalar that is invariant to time direction. None of them ask
 *     "is this source rising or falling over its lifetime?"
 *
 * Headline question:
 *   **"For each source, is its daily token usage trending up or
 *   down over its active lifetime, and how strong is the trend?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface
 *     as `droppedSourceFilter`.
 *   - `minActiveDays` (default 3): structural floor on active-day
 *     count for a source row to be reported. A 1-day or 2-day
 *     fit is degenerate (slope is exactly determined or
 *     undefined); 3 is the smallest sample where r2 carries
 *     real information. Suppressed surface as
 *     `droppedBelowMinActiveDays`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'absslope'): 'absslope' | 'slope' |
 *     'absnorm' | 'norm' | 'r2' | 'days' | 'tokens' | 'source'.
 */
import type { QueueLine } from './types.js';

export type SourceDailyTokenTrendSlopeSort =
  | 'absslope'
  | 'slope'
  | 'absnorm'
  | 'norm'
  | 'r2'
  | 'days'
  | 'tokens'
  | 'source';

export interface SourceDailyTokenTrendSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minActiveDays?: number;
  top?: number;
  sort?: SourceDailyTokenTrendSlopeSort;
  generatedAt?: string;
}

export interface SourceDailyTokenTrendSlopeSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  firstActiveDay: string; // YYYY-MM-DD
  lastActiveDay: string; // YYYY-MM-DD
  meanDailyTokens: number;
  /** OLS slope b in y = a + b*t, where t is the active-day index. */
  slopeTokensPerActiveDay: number;
  /** OLS intercept a. */
  interceptTokens: number;
  /** slope / meanDailyTokens; null when meanDailyTokens == 0 (impossible if any token >0). */
  normalizedSlope: number | null;
  /** Coefficient of determination in [0, 1]; null when variance(y) == 0. */
  r2: number | null;
}

export interface SourceDailyTokenTrendSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minActiveDays: number;
  top: number;
  sort: SourceDailyTokenTrendSlopeSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinActiveDays: number;
  droppedTopSources: number;
  sources: SourceDailyTokenTrendSlopeSourceRow[];
}

/**
 * Returns the YYYY-MM-DD UTC calendar-day key for a finite epoch ms.
 */
export function utcDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildSourceDailyTokenTrendSlope(
  queue: QueueLine[],
  opts: SourceDailyTokenTrendSlopeOptions = {},
): SourceDailyTokenTrendSlopeReport {
  const minActiveDays = opts.minActiveDays ?? 3;
  if (!Number.isInteger(minActiveDays) || minActiveDays < 2) {
    throw new Error(
      `minActiveDays must be an integer >= 2 (got ${opts.minActiveDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: SourceDailyTokenTrendSlopeSort = opts.sort ?? 'absslope';
  const validSorts: SourceDailyTokenTrendSlopeSort[] = [
    'absslope',
    'slope',
    'absnorm',
    'norm',
    'r2',
    'days',
    'tokens',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(
      `source must be a string when set (got ${typeof sourceFilter})`,
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

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // src -> (dayKey -> total_tokens summed)
  const agg = new Map<string, Map<string, number>>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
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
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const key = utcDayKey(ms);
    let inner = agg.get(src);
    if (!inner) {
      inner = new Map<string, number>();
      agg.set(src, inner);
    }
    inner.set(key, (inner.get(key) ?? 0) + tt);
  }

  const totalSources = agg.size;
  let droppedBelowMinActiveDays = 0;
  let totalTokens = 0;
  const rows: SourceDailyTokenTrendSlopeSourceRow[] = [];

  for (const [src, byDay] of agg) {
    const days = Array.from(byDay.keys()).sort(); // YYYY-MM-DD sorts lexically
    const n = days.length;
    if (n < minActiveDays) {
      droppedBelowMinActiveDays += 1;
      // still track tokens? no — droppedBelowMinActiveDays sources are excluded
      continue;
    }
    const ys: number[] = days.map((d) => byDay.get(d) as number);
    const total = ys.reduce((a, b) => a + b, 0);
    const mean = total / n;
    // OLS over (t, y) with t = 0..n-1
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    const meanT = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const dx = i - meanT;
      const dy = ys[i]! - mean;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    // sxx > 0 always when n >= 2 (already enforced via minActiveDays >= 2)
    const slope = sxx > 0 ? sxy / sxx : 0;
    const intercept = mean - slope * meanT;
    const normalizedSlope = mean > 0 ? slope / mean : null;
    // r2 = 1 - SSres / SStot; SSres = sum (y - (a + b*t))^2
    let ssres = 0;
    for (let i = 0; i < n; i++) {
      const yhat = intercept + slope * i;
      const resid = ys[i]! - yhat;
      ssres += resid * resid;
    }
    const r2 = syy > 0 ? Math.max(0, Math.min(1, 1 - ssres / syy)) : null;

    rows.push({
      source: src,
      totalTokens: total,
      nActiveDays: n,
      firstActiveDay: days[0]!,
      lastActiveDay: days[n - 1]!,
      meanDailyTokens: mean,
      slopeTokensPerActiveDay: slope,
      interceptTokens: intercept,
      normalizedSlope,
      r2,
    });
    totalTokens += total;
  }

  // sort: nulls always go last on numeric keys; ties broken by source asc
  const cmpNullableDesc = (a: number | null, b: number | null): number => {
    const aNull = a === null;
    const bNull = b === null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return (b as number) - (a as number);
  };

  const cmpRow = (
    a: SourceDailyTokenTrendSlopeSourceRow,
    b: SourceDailyTokenTrendSlopeSourceRow,
  ): number => {
    let primary = 0;
    switch (sort) {
      case 'slope':
        primary = b.slopeTokensPerActiveDay - a.slopeTokensPerActiveDay;
        break;
      case 'absnorm':
        primary = cmpNullableDesc(
          a.normalizedSlope === null ? null : Math.abs(a.normalizedSlope),
          b.normalizedSlope === null ? null : Math.abs(b.normalizedSlope),
        );
        break;
      case 'norm':
        primary = cmpNullableDesc(a.normalizedSlope, b.normalizedSlope);
        break;
      case 'r2':
        primary = cmpNullableDesc(a.r2, b.r2);
        break;
      case 'days':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absslope':
      default:
        primary =
          Math.abs(b.slopeTokensPerActiveDay) -
          Math.abs(a.slopeTokensPerActiveDay);
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  };
  rows.sort(cmpRow);

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
    minActiveDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedBelowMinActiveDays,
    droppedTopSources,
    sources: kept,
  };
}
