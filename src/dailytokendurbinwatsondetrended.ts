/**
 * daily-token-durbin-watson-detrended: per-source
 * DURBIN-WATSON LAG-1 RESIDUAL-AUTOCORRELATION TEST
 * applied to the OLS-DETRENDED gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTY-SECOND cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Fit an OLS LINEAR TREND
 *
 *     x_t  approx  a + b * t
 *
 * via the closed-form moment estimators
 *
 *     b   = sum (t - t_bar)(x_t - x_bar) /
 *           sum (t - t_bar)^2
 *     a   = x_bar - b * t_bar
 *
 * (t = 0..n-1, t_bar = (n-1)/2). Form the residuals
 *
 *     e_t = x_t - (a + b * t)            t = 0..n-1
 *
 * (sum e_t === 0 by OLS first-order condition; sum
 * t*e_t === 0 by the second). The DURBIN-WATSON
 * STATISTIC is
 *
 *     DW =   sum_{t=1..n-1} (e_t - e_{t-1})^2
 *          ----------------------------------------
 *               sum_{t=0..n-1} e_t^2
 *
 * (Durbin & Watson 1950 Biometrika 37:409-428;
 *  1951 Biometrika 38:159-178; 1971 Biometrika
 *  58:1-19).
 *
 * Range: DW in [0, 4].
 *
 *   DW approx 2  : residuals are serially
 *                  independent (null);
 *   DW <  2      : POSITIVE first-order
 *                  autocorrelation in residuals
 *                  (DW approx 0 = perfect positive
 *                  rho_1 of residuals);
 *   DW >  2      : NEGATIVE first-order
 *                  autocorrelation in residuals
 *                  (DW approx 4 = perfect negative
 *                  rho_1 of residuals).
 *
 * Closed-form identity (algebraic; verified by tests):
 *
 *     DW  =  2 * (1 - rhoHat_e)
 *           -  ( e_0^2 + e_{n-1}^2 ) / sum e_t^2
 *
 * where
 *
 *     rhoHat_e = sum_{t=1..n-1} e_t * e_{t-1}
 *               / sum_{t=0..n-1} e_t^2
 *
 * is the lag-1 residual autocorrelation (uncentred,
 * normalised by sum-of-squares). For large n the end-
 * point correction is O(1/n) and DW approx
 * 2 * (1 - rhoHat_e). We surface BOTH `dw` and
 * `rhoHatResid` so the relationship is auditable.
 *
 * Standardised score. Under iid Gaussian residuals
 * and large n, DW is asymptotically Normal with
 * mean 2 and variance 4 / n (rhoHat_e is approx
 * N(0, 1/n) under the null; DW approx 2(1 - rhoHat_e)
 * gives Var(DW) approx 4/n). We report
 *
 *     dwZ = (DW - 2) / sqrt(4 / n)
 *         = (DW - 2) * sqrt(n) / 2
 *
 * which is asymptotically N(0, 1) under the null.
 * dwZ < -1.96 = significant POSITIVE residual
 * autocorrelation; dwZ > +1.96 = significant
 * NEGATIVE residual autocorrelation.
 *
 * NB: the EXACT small-sample DW distribution is the
 * ratio of two quadratic forms in Normal residuals
 * (Imhof 1961) and depends on the design matrix; the
 * Durbin-Watson original `d_L` / `d_U` bound tables
 * (1950, 1951) were derived from it. We deliberately
 * use the LARGE-SAMPLE NORMAL APPROXIMATION rather
 * than ship the bound tables: the approximation is
 * adequate for n >= 30 and gives a single calibrated
 * score across all sources. The minTenureDays floor
 * defaults to 14 (matching axis-161); for short
 * tenures the dwZ should be read as suggestive.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-161:
 *
 *   - vs the RAW-SERIES SERIAL-CORRELATION AXES
 *     (autocorrelation lag-1, autocorrelation
 *     lag-7, Spearman lag-1, Kendall lag-1,
 *     Bartels-rank von Neumann, axis-114
 *     Ljung-Box, axis-159 McLeod-Li, axis-158 VR,
 *     axis-160 BDS). Every one of those operates
 *     on the RAW series x_t (or |x_t|, or
 *     ranks(x_t), or x_t^2, or m-history embeddings
 *     of x_t). DW operates on the OLS-DETRENDED
 *     RESIDUALS e_t = x_t - (a + b * t) -- the
 *     LINEAR-TREND COMPONENT IS REMOVED BEFORE the
 *     autocorrelation is measured. A monotone-
 *     trend series with iid Gaussian noise has
 *     near-perfect raw-series lag-1 autocorrelation
 *     (rhoHat_x approx 1) but DW approx 2 because
 *     the trend is exactly what gets subtracted.
 *     Conversely an AR(1) series with no trend has
 *     DW != 2 even though its raw rhoHat_x equals
 *     its residual rhoHat_e (no trend to remove).
 *     The two answers diverge whenever the linear
 *     trend is non-trivial -- which is the
 *     interesting regime for daily-token series.
 *
 *   - vs the STATIONARITY / UNIT-ROOT / CHANGEPOINT
 *     AXES (axis-156 KPSS, axis-157 ADF, axis-153
 *     CUSUM, axis-154 Pettitt, axis-155 Buishand).
 *     KPSS / ADF test the LEVEL TRAJECTORY for a
 *     unit root or level-stationarity. CUSUM /
 *     Pettitt / Buishand test for a CHANGEPOINT in
 *     the level. DW tests the SHORT-RANGE LAG-1
 *     SERIAL CORRELATION OF THE RESIDUALS AROUND A
 *     FITTED LINEAR TREND -- a different question:
 *     even if the level is stationary and there is
 *     no changepoint, the residuals of the
 *     trend-fit can still carry strong lag-1
 *     dependence (the regression's standard errors
 *     would be wrong). DW is the regression-
 *     diagnostic of "how dependent are the
 *     fit-residuals?".
 *
 *   - vs axis-161 JARQUE-BERA. JB is permutation-
 *     invariant on the RAW series and tests the
 *     MARGINAL DISTRIBUTION SHAPE. DW operates on
 *     RESIDUALS of a fitted regression and is
 *     time-ordered. A heavy-tailed iid raw series
 *     has JB much greater than 0 but DW approx 2
 *     (residuals are still iid, just heavy-tailed).
 *     A linearly trending raw series with AR(1)
 *     residuals has JB approx 0 (residuals
 *     Gaussian) but DW deviates from 2.
 *
 *   - vs the SHAPE / SKEWNESS / KURTOSIS AXES.
 *     Those summarise the raw-series moments. DW
 *     does not see moments; it sees the lag-1
 *     residual cross-product after detrending.
 *
 *   - vs the HALVES-DISTANCE axes (KS halves, AD
 *     halves, energy halves, etc.). Those compare
 *     the empirical CDF of the FIRST HALF of x_t
 *     to the SECOND HALF. DW is a single-window
 *     statistic on residuals -- no first/second-
 *     half split.
 *
 * Headline question:
 * **"For each source, after we subtract the best
 *   linear trend, do the day-to-day residuals
 *   carry first-order serial structure (DW != 2),
 *   or do they look like a clean white-noise
 *   sequence around the trend (DW approx 2)?"**
 *
 * Reference:
 *   Durbin, J. and Watson, G. S., "Testing for serial
 *     correlation in least squares regression. I",
 *     Biometrika 37(3/4) (1950), pp. 409-428.
 *   Durbin, J. and Watson, G. S., "Testing for serial
 *     correlation in least squares regression. II",
 *     Biometrika 38(1/2) (1951), pp. 159-178.
 *   Durbin, J. and Watson, G. S., "Testing for serial
 *     correlation in least squares regression. III",
 *     Biometrika 58(1) (1971), pp. 1-19.
 *   Imhof, J. P., "Computing the distribution of
 *     quadratic forms in normal variables",
 *     Biometrika 48 (1961), pp. 419-426.
 *
 * Caveats:
 *
 *   - DW in [0, 4]; reference null DW = 2.
 *   - The N(2, 4/n) approximation is asymptotic;
 *     the EXACT distribution depends on the design
 *     matrix. For n < 30 dwZ is suggestive. The
 *     classical d_L / d_U bound tables are the
 *     gold standard for small n -- we do not ship
 *     them.
 *   - DW is sensitive to AR(1) only. A residual
 *     process that is iid at lag 1 but dependent
 *     at lag 2 (e.g. a pure MA(2) with theta_1 = 0)
 *     gives DW approx 2. Compose with axis-114
 *     Ljung-Box on the RAW series to detect higher-
 *     order structure.
 *   - DW assumes the regression is correctly
 *     specified (here: linear in t). A non-linear
 *     trend (e.g. a saturating curve) leaves
 *     curvature in the residuals which DW will
 *     attribute to AR(1).
 *   - DW is BLIND TO RESIDUAL VARIANCE: the
 *     normalisation by sum e_t^2 makes it scale-
 *     invariant. Same series multiplied by 1000
 *     gives the same DW.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, sort by largest
 *   # |dwZ|):
 *   pew-insights daily-token-durbin-watson-detrended
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-durbin-watson-detrended --json
 *
 *   # Sort by raw DW ascending (most positive
 *   # residual autocorrelation first):
 *   pew-insights daily-token-durbin-watson-detrended --sort dw
 */
import type { QueueLine } from './types.js';

export type DailyTokenDurbinWatsonDetrendedSort =
  | 'dw'
  | 'dwDesc'
  | 'dwZ'
  | 'dwZDesc'
  | 'dwZAbs'
  | 'dwZAbsDesc'
  | 'rhoHatResid'
  | 'rhoHatResidDesc'
  | 'rhoHatResidAbs'
  | 'rhoHatResidAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type DwVerdict =
  | 'positive-autocorr'
  | 'borderline-positive'
  | 'independent'
  | 'borderline-negative'
  | 'negative-autocorr';

export interface DailyTokenDurbinWatsonDetrendedOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenDurbinWatsonDetrendedSort;
  generatedAt?: string;
}

export interface DailyTokenDurbinWatsonDetrendedSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** OLS intercept of fitted x_t = a + b*t. */
  trendIntercept: number;
  /** OLS slope of fitted x_t = a + b*t (tokens / day). */
  trendSlope: number;
  /** Sum of squared residuals (resid sum-of-squares). */
  rss: number;
  /** Lag-1 residual autocorrelation rhoHat_e. */
  rhoHatResid: number;
  /** Durbin-Watson statistic in [0, 4]. */
  dw: number;
  /** Standardised score (DW - 2) * sqrt(n) / 2. */
  dwZ: number;
  /** Verdict by dwZ cutoffs (see VERDICT_CUTOFFS). */
  verdict: DwVerdict;
}

export interface DailyTokenDurbinWatsonDetrendedReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenDurbinWatsonDetrendedSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroResidualVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenDurbinWatsonDetrendedSourceRow[];
}

/**
 * Verdict cutoffs by standardised score dwZ
 * (asymptotic N(0, 1) under iid Gaussian residual
 * null):
 *
 *   positive-autocorr     dwZ <= -2.576   (p <= 0.005, two-sided 0.01)
 *   borderline-positive   -2.576 < dwZ <= -1.645 (p <= 0.05 one-sided)
 *   independent           -1.645 < dwZ <  +1.645
 *   borderline-negative   +1.645 <= dwZ <  +2.576
 *   negative-autocorr     dwZ >= +2.576
 */
const DW_Z_STRONG = 2.5758293035489004; // N(0,1) 99.5th percentile
const DW_Z_WEAK = 1.6448536269514722; // N(0,1) 95th percentile

function classifyDw(dwZ: number): DwVerdict {
  if (dwZ <= -DW_Z_STRONG) return 'positive-autocorr';
  if (dwZ <= -DW_Z_WEAK) return 'borderline-positive';
  if (dwZ < DW_Z_WEAK) return 'independent';
  if (dwZ < DW_Z_STRONG) return 'borderline-negative';
  return 'negative-autocorr';
}

/**
 * Durbin-Watson detrended-residual lag-1 test on a
 * real-valued series of length n >= 4.
 *
 * EXACT IDENTITIES preserved (verified by tests):
 *
 *   - dw(x + c) === dw(x) for any constant c
 *     (additive shift absorbed into intercept).
 *   - dw(a*x) === dw(x) for any non-zero scalar a
 *     (numerator and denominator scale as a^2 and
 *     cancel).
 *   - For a perfect linear ramp x_t = a + b*t:
 *     residuals are exactly 0 -> rss = 0 -> THROWS
 *     (zero residual variance).
 *   - For a perfect linear ramp PLUS perfect
 *     two-point alternation in residuals
 *     {+1, -1, +1, -1, ...}: rhoHat_e approx -1,
 *     dw approx 4 - O(1/n).
 *   - Algebraic identity:
 *     dw === 2 * (1 - rhoHat_e) - (e_0^2 + e_{n-1}^2) / rss.
 *   - dwZ === (dw - 2) * sqrt(n) / 2.
 *
 * Throws when too short, non-finite, zero level
 * variance, or zero residual variance (perfect
 * linear fit).
 */
export function dailyTokenDurbinWatsonDetrended(
  values: number[],
): {
  nSamples: number;
  trendIntercept: number;
  trendSlope: number;
  rss: number;
  rhoHatResid: number;
  dw: number;
  dwZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenDurbinWatsonDetrended: need at least 4 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenDurbinWatsonDetrended requires finite values',
      );
    }
  }

  // Sum-of-squares constants for t = 0..n-1.
  // sum t = n(n-1)/2; sum t^2 = (n-1)n(2n-1)/6.
  // sum (t - tbar)^2 = sum t^2 - n * tbar^2.
  const tbar = (n - 1) / 2;
  let xbar = 0;
  for (const v of values) xbar += v;
  xbar /= n;

  let sxt = 0; // sum (t - tbar) * (x - xbar)
  let stt = 0; // sum (t - tbar)^2
  let sxx = 0; // sum (x - xbar)^2 (level variance check)
  for (let t = 0; t < n; t += 1) {
    const dt = t - tbar;
    const dx = values[t]! - xbar;
    sxt += dt * dx;
    stt += dt * dt;
    sxx += dx * dx;
  }
  if (sxx === 0) {
    throw new Error(
      `dailyTokenDurbinWatsonDetrended: zero level variance (n=${n})`,
    );
  }
  const slope = sxt / stt;
  const intercept = xbar - slope * tbar;

  // Residuals.
  const e: number[] = new Array(n);
  let rss = 0;
  for (let t = 0; t < n; t += 1) {
    const r = values[t]! - (intercept + slope * t);
    e[t] = r;
    rss += r * r;
  }
  if (rss === 0 || rss < 1e-300) {
    throw new Error(
      `dailyTokenDurbinWatsonDetrended: zero residual variance (perfect linear fit, n=${n})`,
    );
  }

  // DW numerator: sum (e_t - e_{t-1})^2 for t = 1..n-1.
  let dwNum = 0;
  let cross = 0; // sum e_t * e_{t-1}
  for (let t = 1; t < n; t += 1) {
    const d = e[t]! - e[t - 1]!;
    dwNum += d * d;
    cross += e[t]! * e[t - 1]!;
  }
  const dw = dwNum / rss;
  const rhoHatResid = cross / rss;
  const dwZ = ((dw - 2) * Math.sqrt(n)) / 2;

  if (
    !Number.isFinite(dw) ||
    !Number.isFinite(rhoHatResid) ||
    !Number.isFinite(dwZ)
  ) {
    throw new Error(
      `dailyTokenDurbinWatsonDetrended: non-finite fit (n=${n})`,
    );
  }

  return {
    nSamples: n,
    trendIntercept: intercept,
    trendSlope: slope,
    rss,
    rhoHatResid,
    dw,
    dwZ,
  };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenDurbinWatsonDetrended(
  queue: QueueLine[],
  opts: DailyTokenDurbinWatsonDetrendedOptions = {},
): DailyTokenDurbinWatsonDetrendedReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenDurbinWatsonDetrendedSort =
    opts.sort ?? 'dwZAbsDesc';
  const validSorts: DailyTokenDurbinWatsonDetrendedSort[] = [
    'dw',
    'dwDesc',
    'dwZ',
    'dwZDesc',
    'dwZAbs',
    'dwZAbsDesc',
    'rhoHatResid',
    'rhoHatResidDesc',
    'rhoHatResidAbs',
    'rhoHatResidAbsDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface SrcAcc {
    perDay: Map<string, number>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
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
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + tt);
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedZeroResidualVariance = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenDurbinWatsonDetrendedSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(acc.firstDay, acc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mn = filled[0]!;
    let mx = filled[0]!;
    for (let i = 1; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenDurbinWatsonDetrended(filled);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/zero residual variance/.test(msg)) {
        droppedZeroResidualVariance += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      trendIntercept: result.trendIntercept,
      trendSlope: result.trendSlope,
      rss: result.rss,
      rhoHatResid: result.rhoHatResid,
      dw: result.dw,
      dwZ: result.dwZ,
      verdict: classifyDw(result.dwZ),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'dw':
        primary = a.dw - b.dw;
        break;
      case 'dwDesc':
        primary = b.dw - a.dw;
        break;
      case 'dwZ':
        primary = a.dwZ - b.dwZ;
        break;
      case 'dwZDesc':
        primary = b.dwZ - a.dwZ;
        break;
      case 'dwZAbs':
        primary = Math.abs(a.dwZ) - Math.abs(b.dwZ);
        break;
      case 'dwZAbsDesc':
        primary = Math.abs(b.dwZ) - Math.abs(a.dwZ);
        break;
      case 'rhoHatResid':
        primary = a.rhoHatResid - b.rhoHatResid;
        break;
      case 'rhoHatResidDesc':
        primary = b.rhoHatResid - a.rhoHatResid;
        break;
      case 'rhoHatResidAbs':
        primary = Math.abs(a.rhoHatResid) - Math.abs(b.rhoHatResid);
        break;
      case 'rhoHatResidAbsDesc':
        primary = Math.abs(b.rhoHatResid) - Math.abs(a.rhoHatResid);
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
      default:
        primary = 0;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTokens,
    minTenureDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedZeroResidualVariance,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
