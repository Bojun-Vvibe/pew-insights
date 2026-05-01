/**
 * daily-token-dfa-alpha: per-source DFA-1 alpha exponent
 * (Detrended Fluctuation Analysis; Peng, Buldyrev, Havlin,
 * Simons, Stanley, Goldberger 1994, Phys. Rev. E 49:1685-1689)
 * on the gap-filled daily total_tokens series.
 *
 * SEVENTY-SECOND cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (so we
 * have a dense, evenly-spaced length-N daily series — same gap-fill
 * convention as axes 67/68/69/70/71). Then:
 *
 *   1. Compute the global mean mu and the integrated PROFILE
 *      Y[i] = sum_{j<=i} (x[j] - mu).  This is DFA's defining
 *      cumulative deviation: it converts stationary-like noise
 *      into a random walk whose roughness reveals the
 *      correlation structure.
 *
 *   2. Build a log-spaced grid of window sizes
 *      s in [minWindow, floor(N/4)] capped at maxScales distinct
 *      integers.  (The floor(N/4) cap rather than floor(N/2) is
 *      conservative: we want >= 4 non-overlapping windows per
 *      scale at the largest scale so the rms is meaningful.)
 *
 *   3. For each scale s, partition Y into k = floor(N/s)
 *      non-overlapping windows of length s.  In each window,
 *      OLS-fit a LINEAR trend (a + b*t) and take the residual
 *      sum-of-squares.  Average residual variance across all
 *      windows -> F^2(s) ; F(s) = sqrt(F^2(s)).
 *      Windows whose residual variance is exactly 0 (perfect-fit
 *      degenerate windows from all-zero gap-fill stretches) are
 *      counted in degenerateWindows; scales whose F(s) reduces
 *      to 0 are counted in scalesDroppedZeroF.
 *
 *   4. alpha = OLS slope of log(F(s)) vs log(s) across the
 *      surviving scales, with r^2 of the log-log fit reported
 *      alongside.
 *
 *      alpha ~ 0.5 = uncorrelated white-noise-like increments.
 *      alpha < 0.5 = anti-persistent / mean-reverting at multiple
 *                    horizons.
 *      0.5 < alpha < 1 = persistent / long-range positive
 *                    correlations.
 *      alpha = 1 = 1/f noise (pink noise).
 *      alpha = 1.5 = Brownian motion (integrated white noise).
 *      alpha > 1.5 = drift-dominated / smoother-than-Brownian.
 *
 *      We clamp the reported alpha to [0, 2] (the theoretically
 *      meaningful bracket for DFA-1) and surface alphaRaw, with
 *      counters clampedBelow0 / clampedAbove2 for sources that
 *      hit the bracket.
 *
 * Headline question:
 * **"For each source, after LINEARLY DETRENDING the cumulative
 *   token-mass profile inside each window, how does the residual
 *   fluctuation scale with window size?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED DAILY-TOKEN AXIS 32..71:
 *
 *   - vs `daily-token-hurst-rs` (axis 71): R/S divides the RANGE
 *     of cumulative deviations by the population stddev across
 *     partition scales with NO DETRENDING.  DFA detrends each
 *     window by its LOCAL LINEAR FIT before summarising
 *     fluctuation.  The two estimators coincide only for ideal
 *     fractional Brownian motion with no trend.  On real
 *     gap-filled daily-token series with even mild drift, R/S is
 *     biased upward by the trend (reports H near 1) while DFA-1
 *     absorbs the linear part and reports the scaling of the
 *     RESIDUALS.  Ranking sources by H vs by alpha on the same
 *     data does NOT preserve order: a deterministic ramp gives
 *     H -> 1 (axis 71's documented caveat) but alpha = 2.0
 *     clamped from a singular per-window fit.  The
 *     `orthogonality witness: sorted-vs-shuffled multiset` test
 *     also separates them (sorted -> alpha clamps high; shuffled
 *     -> alpha near 0.5).
 *
 *   - vs `daily-token-autocorrelation-lag1` and
 *     `daily-token-autocorrelation-lag7` (axes 67/68): rho_k is
 *     a SINGLE-LAG linear-correlation scalar.  DFA alpha is a
 *     MULTI-SCALE exponent and is well-defined even when all
 *     finite-lag rho_k = 0 (e.g. fractional Gaussian noise with
 *     alpha != 0.5).
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral
 *     entropy summarises the FLATNESS of the global periodogram
 *     symmetrically; alpha summarises a POWER-LAW EXPONENT
 *     linking window size to detrended residual rms.  They
 *     coincide only under idealised stationarity (alpha =
 *     (beta+1)/2 for 1/f^beta noise); on real bounded gap-filled
 *     series they routinely disagree and rankings do not
 *     preserve.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE is
 *     ORDINAL on length-3 windows (categorical alphabet of 6
 *     patterns), invariant under ANY strictly monotone transform.
 *     DFA alpha is METRIC and invariant only under positive
 *     affine transforms.  A linear ramp has PE = 0 AND alpha
 *     clamped at 2; a noisy mean-reverting bounded oscillation
 *     can have PE near 1 and alpha near 0.3.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32..67 (Gini, Atkinson, Theil, GE, Hill, MC, L-skew,
 *     ...): those throw away temporal placement entirely.
 *     A sorted and a shuffled copy of the same multiset produce
 *     wildly different alpha (sorted -> high alpha, shuffled ->
 *     alpha near 0.5) while every multiset statistic is
 *     identical.  See the `orthogonality witness` test.
 *
 *   - vs trend / forecast / source-daily-token-trend-slope: the
 *     local linear detrending is precisely what makes alpha
 *     trend-robust (the central design choice of Peng 1994 vs
 *     Hurst 1951).  Operators should still cross-check alpha
 *     against the trend-slope axis on heavily trended sources;
 *     persistent correlations on top of a trend can push alpha
 *     above 1 even after detrending.
 *
 * Caveats:
 *
 *   - All-zero stretches in the gap-filled series produce
 *     windows whose Y profile is itself a perfect linear ramp
 *     after the cumulative sum (cumulative sum of constants is
 *     linear), so the local linear fit drives residuals to
 *     numerical zero.  Such windows are counted in
 *     `degenerateWindows`; a scale that loses ALL windows to
 *     degeneracy contributes F(s) = 0, is dropped at the scale
 *     level, and counted in `scalesDroppedZeroF`.  A source
 *     whose surviving scale count falls below `minScales` after
 *     that filter is dropped at the source level (counted in
 *     `droppedTooFewScales`).
 *   - DFA alpha is biased on short series (Kantelhardt et al.
 *     2001, Physica A 295:441-454); the default `minTenureDays
 *     = 32` floor and `minWindow = 4` keep the bias bounded and
 *     yield at least 4 surviving scales at the default cap of
 *     12.
 *
 * Determinism: pure builder.  Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Peng, Buldyrev, Havlin, Simons, Stanley, Goldberger,
 *     "Mosaic organization of DNA nucleotides", Phys. Rev. E
 *     49(2):1685-1689, 1994.
 *   Kantelhardt, Koscielny-Bunde, Rego, Havlin, Bunde,
 *     "Detecting long-range correlations with detrended
 *     fluctuation analysis", Physica A 295(3-4):441-454, 2001.
 */
import type { QueueLine } from './types.js';

/** Default minimum window size in days. */
export const DEFAULT_DFA_MIN_WINDOW = 4;
/** Default cap on the number of distinct scales used in the OLS. */
export const DEFAULT_DFA_MAX_SCALES = 12;
/** Default minimum surviving scales required to fit the OLS. */
export const DEFAULT_DFA_MIN_SCALES = 4;

export type DailyTokenDfaAlphaSort =
  | 'absAlphaDeviationDesc'
  | 'alpha'
  | 'alphaDesc'
  | 'r2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenDfaAlphaOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4*minWindow so
   * that floor(N/m) >= 4 windows at the smallest scale. Default 32.
   */
  minTenureDays?: number;
  /** Smallest window size in days. Hard floor 4. Default 4. */
  minWindow?: number;
  /** Cap on the number of distinct scales in the OLS grid. Default 12. */
  maxScales?: number;
  /** Minimum surviving scales required to fit. Default 4. */
  minScales?: number;
  top?: number;
  sort?: DailyTokenDfaAlphaSort;
  generatedAt?: string;
}

export interface DailyTokenDfaAlphaSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** DFA-1 exponent clamped to [0, 2]. */
  alpha: number;
  /** OLS slope of log(F(s)) vs log(s) before clamping. */
  alphaRaw: number;
  /** OLS intercept on the log-log fit. */
  intercept: number;
  /** Coefficient of determination r^2 of the log-log fit in [0, 1]. */
  r2: number;
  /** Number of surviving scales used in the OLS. */
  scalesUsed: number;
  /** Smallest scale (in days) actually used. */
  minScaleUsed: number;
  /** Largest scale (in days) actually used. */
  maxScaleUsed: number;
  /** Total windows whose detrended residual rms collapsed to 0. */
  degenerateWindows: number;
  /** Scales whose averaged F(s) reduced to 0 across all windows. */
  scalesDroppedZeroF: number;
  /** True if alphaRaw was clamped from below 0 to 0. */
  clampedBelow0: boolean;
  /** True if alphaRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenDfaAlphaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  minWindow: number;
  maxScales: number;
  minScales: number;
  top: number;
  sort: DailyTokenDfaAlphaSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedBelowMinScales: number;
  droppedTooFewScales: number;
  droppedTopSources: number;
  clampedBelow0: number;
  clampedAbove2: number;
  sources: DailyTokenDfaAlphaSourceRow[];
}

/**
 * Build a log-spaced integer grid in [lo, hi], capped at maxLen
 * distinct values. Returns an ascending unique-integer array.
 */
export function buildDfaScales(
  lo: number,
  hi: number,
  maxLen: number,
): number[] {
  if (!Number.isInteger(lo) || lo < 1) {
    throw new Error(`buildDfaScales: lo must be a positive integer (got ${lo})`);
  }
  if (!Number.isInteger(hi) || hi < lo) {
    throw new Error(
      `buildDfaScales: hi must be an integer >= lo (got lo=${lo}, hi=${hi})`,
    );
  }
  if (!Number.isInteger(maxLen) || maxLen < 1) {
    throw new Error(
      `buildDfaScales: maxLen must be a positive integer (got ${maxLen})`,
    );
  }
  if (lo === hi) return [lo];
  const out: number[] = [];
  let last = -1;
  const logLo = Math.log(lo);
  const logHi = Math.log(hi);
  for (let i = 0; i < maxLen; i += 1) {
    const t = i / (maxLen - 1);
    const raw = Math.exp(logLo + t * (logHi - logLo));
    const m = Math.max(lo, Math.min(hi, Math.round(raw)));
    if (m !== last) {
      out.push(m);
      last = m;
    }
  }
  return out;
}

/**
 * DFA-1 alpha exponent on a real-valued series. Returns the OLS
 * slope of log(F(s)) vs log(s), the intercept, r^2, the surviving
 * scale list, and counts of windows / scales dropped to numerical
 * degeneracy. Throws when fewer than minScales survive (caller
 * should catch and surface as droppedTooFewScales at the source
 * level).
 *
 * Algorithm (Peng et al. 1994):
 *   1. Y[i] = sum_{j<=i} (x[j] - mean(x))           (cumulative profile)
 *   2. For each window of length s starting at offset c*s, OLS-fit
 *      Y_hat = a + b*t (t = 0..s-1) and accumulate residual
 *      sum-of-squares.
 *   3. F^2(s) = (1/(k*s)) * sum_windows ssr_window
 *   4. alpha = OLS slope of log(F(s)) vs log(s).
 *
 * Caveats specific to this estimator:
 *   - Windows whose residual variance is exactly 0 (perfect-fit
 *     degenerate windows) are counted in `degenerateWindows`; if
 *     ALL windows at a scale are degenerate so F(s) = 0, that
 *     scale is dropped (`scalesDroppedZeroF`).
 *   - On a deterministic monotone ramp the cumulative profile is
 *     a quadratic, and per-window linear detrending leaves
 *     parabolic residuals.  alpha typically pegs at 2.0 (clamped)
 *     for such inputs — operators should cross-check against an
 *     independent trend-slope estimator before claiming long-
 *     range memory on a trended source.
 *   - DFA-1 alpha is biased on short series; treat
 *     |alpha - 0.5| < 0.1 as "indistinguishable from white noise
 *     at this length" rather than a positive long-range claim.
 */
export function dfaAlpha(
  values: number[],
  opts: {
    minWindow?: number;
    maxScales?: number;
    minScales?: number;
  } = {},
): {
  alpha: number;
  alphaRaw: number;
  intercept: number;
  r2: number;
  scalesUsed: number[];
  degenerateWindows: number;
  scalesDroppedZeroF: number;
  clampedBelow0: boolean;
  clampedAbove2: boolean;
} {
  const minWindow = opts.minWindow ?? DEFAULT_DFA_MIN_WINDOW;
  const maxScales = opts.maxScales ?? DEFAULT_DFA_MAX_SCALES;
  const minScales = opts.minScales ?? DEFAULT_DFA_MIN_SCALES;
  const n = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dfaAlpha requires finite values');
    }
  }
  // Need at least 4 windows of size minWindow at the largest scale.
  const maxWindow = Math.floor(n / 4);
  if (maxWindow < minWindow) {
    throw new Error(
      `dfaAlpha: series too short (n=${n}, need n >= 4*minWindow=${4 * minWindow})`,
    );
  }

  // Compute the integrated profile Y[i] = sum_{j<=i} (x[j] - mu).
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += values[i]!;
  const mu = sum / n;
  const Y: number[] = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    acc += values[i]! - mu;
    Y[i] = acc;
  }

  const scales = buildDfaScales(minWindow, maxWindow, maxScales);
  const logS: number[] = [];
  const logF: number[] = [];
  const survivingScales: number[] = [];
  let degenerateWindows = 0;
  let scalesDroppedZeroF = 0;

  for (const s of scales) {
    const k = Math.floor(n / s);
    let ssrTotal = 0;
    let nValid = 0;
    // Closed-form OLS denominator and centered index helpers.
    const meanT = (s - 1) / 2;
    const sxx = (s * (s * s - 1)) / 12;
    for (let c = 0; c < k; c += 1) {
      const off = c * s;
      let sumY = 0;
      for (let t = 0; t < s; t += 1) sumY += Y[off + t]!;
      const meanY = sumY / s;
      let sxy = 0;
      for (let t = 0; t < s; t += 1) {
        sxy += (t - meanT) * (Y[off + t]! - meanY);
      }
      const b = sxx === 0 ? 0 : sxy / sxx;
      const a = meanY - b * meanT;
      let ssr = 0;
      for (let t = 0; t < s; t += 1) {
        const e = Y[off + t]! - (a + b * t);
        ssr += e * e;
      }
      if (ssr === 0) {
        degenerateWindows += 1;
        continue;
      }
      ssrTotal += ssr;
      nValid += 1;
    }
    if (nValid === 0) {
      scalesDroppedZeroF += 1;
      continue;
    }
    const f2 = ssrTotal / (nValid * s);
    if (f2 <= 0) {
      scalesDroppedZeroF += 1;
      continue;
    }
    const f = Math.sqrt(f2);
    const lf = Math.log(f);
    if (!Number.isFinite(lf)) {
      // Defence-in-depth: extremely small F(s) (sub-normal floats) can
      // produce -Infinity from Math.log even when f2 > 0 in IEEE-754.
      // Treat such scales as numerically degenerate.
      scalesDroppedZeroF += 1;
      continue;
    }
    logS.push(Math.log(s));
    logF.push(lf);
    survivingScales.push(s);
  }

  if (survivingScales.length < minScales) {
    throw new Error(
      `dfaAlpha: only ${survivingScales.length} scales survived (need >= ${minScales})`,
    );
  }

  const kk = logS.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < kk; i += 1) {
    sx += logS[i]!;
    sy += logF[i]!;
  }
  const xbar = sx / kk;
  const ybar = sy / kk;
  let sxx2 = 0;
  let sxy2 = 0;
  for (let i = 0; i < kk; i += 1) {
    const dx = logS[i]! - xbar;
    sxx2 += dx * dx;
    sxy2 += dx * (logF[i]! - ybar);
  }
  if (sxx2 === 0) {
    throw new Error('dfaAlpha: surviving log-scales are degenerate');
  }
  const slope = sxy2 / sxx2;
  const intercept = ybar - slope * xbar;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < kk; i += 1) {
    const yhat = slope * logS[i]! + intercept;
    const r = logF[i]! - yhat;
    ssRes += r * r;
    const dy = logF[i]! - ybar;
    ssTot += dy * dy;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  const clampedBelow0 = slope < 0;
  const clampedAbove2 = slope > 2;
  const alpha = Math.max(0, Math.min(2, slope));

  return {
    alpha,
    alphaRaw: slope,
    intercept,
    r2,
    scalesUsed: survivingScales,
    degenerateWindows,
    scalesDroppedZeroF,
    clampedBelow0,
    clampedAbove2,
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

export function buildDailyTokenDfaAlpha(
  queue: QueueLine[],
  opts: DailyTokenDfaAlphaOptions = {},
): DailyTokenDfaAlphaReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minWindow = opts.minWindow ?? DEFAULT_DFA_MIN_WINDOW;
  if (!Number.isInteger(minWindow) || minWindow < DEFAULT_DFA_MIN_WINDOW) {
    throw new Error(
      `minWindow must be an integer >= ${DEFAULT_DFA_MIN_WINDOW} (got ${opts.minWindow})`,
    );
  }
  const maxScales = opts.maxScales ?? DEFAULT_DFA_MAX_SCALES;
  if (!Number.isInteger(maxScales) || maxScales < 3) {
    throw new Error(`maxScales must be an integer >= 3 (got ${opts.maxScales})`);
  }
  const minScales = opts.minScales ?? DEFAULT_DFA_MIN_SCALES;
  if (!Number.isInteger(minScales) || minScales < 3) {
    throw new Error(`minScales must be an integer >= 3 (got ${opts.minScales})`);
  }
  if (minScales > maxScales) {
    throw new Error(
      `minScales (${minScales}) must not exceed maxScales (${maxScales})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4 * minWindow) {
    throw new Error(
      `minTenureDays must be an integer >= 4*minWindow=${4 * minWindow} (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenDfaAlphaSort = opts.sort ?? 'absAlphaDeviationDesc';
  const validSorts: DailyTokenDfaAlphaSort[] = [
    'absAlphaDeviationDesc',
    'alpha',
    'alphaDesc',
    'r2Desc',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedBelowMinScales = 0;
  let droppedTooFewScales = 0;
  let clampedBelow0Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenDfaAlphaSourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    if (Math.floor(nTenure / 4) < minWindow) {
      droppedBelowMinScales += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let result;
    try {
      result = dfaAlpha(filled, { minWindow, maxScales, minScales });
    } catch {
      droppedTooFewScales += 1;
      continue;
    }
    if (result.clampedBelow0) clampedBelow0Count += 1;
    if (result.clampedAbove2) clampedAbove2Count += 1;
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      alpha: result.alpha,
      alphaRaw: result.alphaRaw,
      intercept: result.intercept,
      r2: result.r2,
      scalesUsed: result.scalesUsed.length,
      minScaleUsed: result.scalesUsed[0]!,
      maxScaleUsed: result.scalesUsed[result.scalesUsed.length - 1]!,
      degenerateWindows: result.degenerateWindows,
      scalesDroppedZeroF: result.scalesDroppedZeroF,
      clampedBelow0: result.clampedBelow0,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'alpha':
        primary = a.alpha - b.alpha;
        break;
      case 'alphaDesc':
        primary = b.alpha - a.alpha;
        break;
      case 'r2Desc':
        primary = b.r2 - a.r2;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absAlphaDeviationDesc':
      default:
        primary = Math.abs(b.alpha - 0.5) - Math.abs(a.alpha - 0.5);
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
    minWindow,
    maxScales,
    minScales,
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
    droppedBelowMinScales,
    droppedTooFewScales,
    droppedTopSources,
    clampedBelow0: clampedBelow0Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
