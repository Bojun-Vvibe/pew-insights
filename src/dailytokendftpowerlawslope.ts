/**
 * daily-token-dft-power-law-slope: per-source 1/f^beta spectral
 * exponent of the gap-filled daily total_tokens series, estimated
 * by ordinary-least-squares fit of log10(P[k]) on log10(k) across
 * the strictly-positive Fourier bins of the one-sided periodogram.
 *
 * EIGHTY-FOURTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length n
 * (zero-fill missing days inside [firstActiveDay, lastActiveDay]):
 *
 *   1. Mean-centre y.
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n/2) at the strictly-positive Fourier
 *      frequencies (DC bin omitted; mean already removed).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; finite floor).
 *   4. OLS-fit  log10(P[k]) = a - beta * log10(k)  over the kept
 *      bins. The headline statistic is the spectral-slope
 *      exponent
 *
 *        beta = - slope of log10 P vs log10 k
 *
 *      reported alongside the fit's R^2 and the count of usable
 *      bins.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - beta ~ 0.0 : white-noise-like (flat spectrum across Fourier
 *     bins); each frequency carries comparable power.
 *   - beta ~ 1.0 : pink / 1-f noise (Voss-Clarke 1975); power
 *     decays in inverse proportion to frequency. Often associated
 *     with self-organised processes that mix many timescales.
 *   - beta ~ 2.0 : red / Brownian / random-walk noise (Wiener
 *     process); power decays as 1/f^2. Consistent with a series
 *     dominated by a slowly-drifting cumulative component.
 *   - beta < 0 : blue noise (rare for token streams); power rises
 *     with frequency.
 *
 * REFERENCES:
 *
 *   Voss, R. F., Clarke, J., "1/f noise in music and speech",
 *     Nature 258:317-318, 1975.
 *   Mandelbrot, B. B., Van Ness, J. W., "Fractional Brownian
 *     motions, fractional noises and applications", SIAM Review
 *     10(4):422-437, 1968.
 *   Bak, P., Tang, C., Wiesenfeld, K., "Self-organized
 *     criticality: An explanation of the 1/f noise",
 *     Phys. Rev. Lett. 59(4):381-384, 1987.
 *   Eke, A., Herman, P., Kocsis, L., Kozak, L. R., "Fractal
 *     characterization of complexity in temporal physiological
 *     signals", Physiol. Meas. 23:R1-R38, 2002 (PSD log-log
 *     slope estimator).
 *
 * STRUCTURAL ORTHOGONALITY -- a SCALING-EXPONENT primitive on
 * the Fourier power spectrum, fundamentally distinct from every
 * shipped daily-token axis 32..83:
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral
 *     entropy is the SHANNON ENTROPY of the normalised
 *     periodogram (a flatness measure -- how spread out is the
 *     spectral mass across bins?). beta is the SLOPE of the
 *     spectrum on log-log axes (a colour measure -- does the
 *     spectrum tilt low-to-high?). They disagree wherever the
 *     spectrum is concentrated AT ONE END (low entropy) but is
 *     either flat or peaked elsewhere: e.g. a single sharp peak
 *     at a mid frequency has very low entropy and beta ~ 0; a
 *     pure 1/f spectrum has HIGH entropy (mass spread across
 *     many bins) and beta ~ 1. The two are mathematically
 *     independent statistics of the same periodogram.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is
 *     STRING-COMBINATORIAL complexity of the median-binarised
 *     time-domain stream. beta is a CONTINUOUS-VALUED log-log
 *     slope of the Fourier amplitude spectrum. A pure 1/f
 *     process has beta = 1 and intermediate LZ; an alternating
 *     [median-1, median+1, ...] sequence has very low LZ but
 *     beta near a SHARP NEGATIVE value (all power at Nyquist).
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     LOCAL TRIPLET energy operator in the TIME DOMAIN; beta is
 *     a GLOBAL LOG-LOG slope in the FREQUENCY DOMAIN. They have
 *     no closed-form link.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): these count sign
 *     changes of derivatives; they are blind to amplitude. beta
 *     uses the FULL amplitude periodogram.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `daily-token-
 *     hjorth-complexity` (axis 80): Hjorth statistics are
 *     RATIOS of low-order spectral MOMENTS (variance of
 *     successive differences vs variance). beta is a SCALING
 *     EXPONENT of the spectrum across bins. For a pure 1/f^beta
 *     process the moments DIVERGE in the continuous limit, so
 *     Hjorth and beta cannot both be controlling estimators.
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): these are GEOMETRIC
 *     fractal dimensions on the time-domain curve. There is an
 *     ASYMPTOTIC link FD = (5 - beta) / 2 for an idealised
 *     fractional-Brownian-motion (Mandelbrot 1968), but it does
 *     NOT hold for finite, non-Gaussian, gap-filled token
 *     streams; the two estimators disagree by 0.3 - 0.8 in
 *     practice. They are operationally orthogonal lenses.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): Hurst R/S and DFA-alpha are TIME-DOMAIN
 *     scaling exponents (range-of-cumsum and detrended
 *     fluctuation respectively). beta is the FREQUENCY-DOMAIN
 *     scaling exponent. Asymptotic identity beta = 2H - 1 for
 *     fGn / 2H + 1 for fBm (Eke 2002), but for short
 *     non-Gaussian gap-filled token series the three estimators
 *     diverge (different bias, different windowing).
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain; spectral slope is
 *     amplitude-aware and frequency-resolved.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; beta summarises the WHOLE autocorrelation
 *     function via its Fourier dual.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are SHUFFLE-INVARIANT. Shuffling a series
 *     whitens its spectrum, driving beta toward 0 -- so beta is
 *     SHUFFLE-SENSITIVE.
 *
 * INVARIANCES of beta:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; periodogram at
 *     k >= 1 is UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a > 0: every bin scales by a^2; the
 *     log10 plot moves by 2*log10(a) vertically (intercept
 *     changes, slope does not). SCALE-INVARIANT for a > 0.
 *   - SIGN-FLIP y -> -y: every bin scales by 1 (|.|^2 is sign-
 *     blind). SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is time-reversal-
 *     INVARIANT (the DFT picks up a complex conjugate which
 *     drops in the magnitude). TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives beta toward 0.
 *
 * Bound: beta is unbounded in principle. R^2 lives in [0, 1].
 * usableBins >= 2 is enforced (need at least two log-log points
 * to fit a slope).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenDftPowerLawSlopeSort =
  | 'beta'
  | 'betaDesc'
  | 'rSquared'
  | 'rSquaredDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenDftPowerLawSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for an OLS slope; the floor
   * gives headroom for some bins to be dropped as spectral
   * nulls).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenDftPowerLawSlopeSort;
  generatedAt?: string;
}

export interface DailyTokenDftPowerLawSlopeSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of strictly-positive Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the OLS fit. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** OLS spectral exponent beta where P[k] ~ k^(-beta). */
  beta: number;
  /** OLS coefficient of determination R^2 of the log-log fit, in [0, 1]. */
  rSquared: number;
}

export interface DailyTokenDftPowerLawSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenDftPowerLawSlopeSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedTooFewUsableBins: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenDftPowerLawSlopeSourceRow[];
}

/**
 * Ordinary-least-squares fit of `y = a + s*x` over the supplied
 * paired samples; returns slope `s`, intercept `a`, and the
 * coefficient of determination R^2 in [0, 1].
 *
 * Throws when fewer than 2 samples are supplied or when the
 * variance of `x` is zero (slope is undefined). Returns R^2 = 1
 * when both var(x) > 0 AND var(y) = 0 (perfect horizontal fit).
 */
export function olsSlope(x: number[], y: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = x.length;
  if (n !== y.length) {
    throw new Error(`olsSlope: length mismatch (x=${n}, y=${y.length})`);
  }
  if (n < 2) {
    throw new Error(`olsSlope: need at least 2 samples (got ${n})`);
  }
  for (let i = 0; i < n; i += 1) {
    if (!Number.isFinite(x[i]!) || !Number.isFinite(y[i]!)) {
      throw new Error(`olsSlope: non-finite sample at index ${i}`);
    }
  }
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mx += x[i]!;
    my += y[i]!;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) {
    throw new Error('olsSlope: zero variance in x; slope undefined');
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let rSquared: number;
  if (syy === 0) {
    rSquared = 1;
  } else {
    const ssRes = syy - slope * sxy;
    rSquared = 1 - ssRes / syy;
    if (rSquared < 0) rSquared = 0;
    if (rSquared > 1) rSquared = 1;
  }
  return { slope, intercept, rSquared };
}

/**
 * Daily-token DFT spectral-slope primitive on a real-valued
 * series. Computes the one-sided periodogram, OLS-fits
 * log10(P[k]) = a - beta * log10(k) over bins with P[k] > 0,
 * and returns { beta, rSquared, usableBins } alongside the
 * mean, stddev, and total positive-bin count.
 *
 * Throws when the series is too short (n < 8 -> K < 4 candidate
 * bins), when a non-finite value is present, when var(y) = 0
 * (every bin is exactly 0 power), or when fewer than 2 bins
 * survive the strictly-positive-power filter.
 */
export function dailyTokenDftPowerLawSlope(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  beta: number;
  rSquared: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenDftPowerLawSlope: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenDftPowerLawSlope requires finite values');
    }
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error(
      'dailyTokenDftPowerLawSlope: zero variance (constant series)',
    );
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let varSum = 0;
  for (const v of values) {
    const d = v - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const power = periodogramOneSided(values);
  const k = power.length;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      xs.push(Math.log10(i + 1)); // bin 1..K -> log10(1..K)
      ys.push(Math.log10(p));
    }
  }
  if (xs.length < 2) {
    throw new Error(
      `dailyTokenDftPowerLawSlope: too few positive-power bins (${xs.length}; need >= 2)`,
    );
  }

  const fit = olsSlope(xs, ys);
  if (!Number.isFinite(fit.slope) || !Number.isFinite(fit.rSquared)) {
    throw new Error(
      `dailyTokenDftPowerLawSlope: non-finite OLS fit (slope=${fit.slope}, rSquared=${fit.rSquared})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins: xs.length,
    beta: -fit.slope,
    rSquared: fit.rSquared,
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

export function buildDailyTokenDftPowerLawSlope(
  queue: QueueLine[],
  opts: DailyTokenDftPowerLawSlopeOptions = {},
): DailyTokenDftPowerLawSlopeReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenDftPowerLawSlopeSort = opts.sort ?? 'betaDesc';
  const validSorts: DailyTokenDftPowerLawSlopeSort[] = [
    'beta',
    'betaDesc',
    'rSquared',
    'rSquaredDesc',
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
  let droppedTooFewUsableBins = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenDftPowerLawSlopeSourceRow[] = [];

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
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenDftPowerLawSlope(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('too few positive-power bins')) {
        droppedTooFewUsableBins += 1;
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
      nFreqBins: result.nFreqBins,
      usableBins: result.usableBins,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      beta: result.beta,
      rSquared: result.rSquared,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'beta':
        primary = a.beta - b.beta;
        break;
      case 'betaDesc':
        primary = b.beta - a.beta;
        break;
      case 'rSquared':
        primary = a.rSquared - b.rSquared;
        break;
      case 'rSquaredDesc':
        primary = b.rSquared - a.rSquared;
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
    droppedTooFewUsableBins,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
