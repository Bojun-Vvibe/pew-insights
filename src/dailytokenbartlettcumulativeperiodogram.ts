/**
 * daily-token-bartlett-cumulative-periodogram: per-source
 * BARTLETT'S CUMULATIVE PERIODOGRAM TEST -- the classical
 * Bartlett (1955) Kolmogorov-Smirnov-style goodness-of-fit
 * test for white-noise on the gap-filled mean-centred daily
 * total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the NORMALISED
 * CUMULATIVE PERIODOGRAM
 *
 *   C[j] = (sum_{k=1..j} P[k]) / (sum_{k=1..K} P[k]),
 *          j = 1..K
 *
 * and compare to the white-noise reference line j/K. The
 * Bartlett statistic is the sup-norm Kolmogorov deviation
 *
 *   bD = max_{j=1..K-1} | C[j] - j/K |   in [0, 1)
 *
 * Under H0 (Gaussian white noise) Bartlett (1955) showed that
 * sqrt(K - 1) * bD converges in distribution to the
 * Kolmogorov-Smirnov supremum, with closed-form survival
 *
 *   P(sqrt(K - 1) * bD > lambda) = Q_KS(lambda)
 *      = 2 * sum_{j=1}^{infty} (-1)^{j-1} exp(-2 j^2 lambda^2)
 *
 * which is the standard Kolmogorov distribution. This is the
 * exact reference invoked here (via the rapidly-convergent
 * Kolmogorov series with 100 terms; truncation error below
 * 1e-300 for any lambda > 0.05).
 *
 * ONE-HUNDRED-AND-SIXTY-SEVENTH cross-source axis. Where
 * Fisher's g (axis-166) tests "is there ONE dominant bin",
 * Bartlett's cumulative-periodogram test asks "does the
 * SHAPE of the spectral CDF deviate from uniform ANYWHERE".
 * It is sensitive to BANDED departures (a wide red-noise
 * shoulder, an inverse 1/f slope, or a band-limited
 * concentration) that Fisher's MAX-BIN test misses entirely
 * because none of those put a single bin above the
 * white-noise threshold.
 *
 * READING:
 *
 *   - bD near 0   -- C[j] tracks j/K closely; spectrum is
 *                    white-noise-compatible. bPValue near 1.
 *   - bD large    -- cumulative spectrum bulges away from
 *                    uniform; spectral mass is concentrated
 *                    on a CONTIGUOUS BAND of bins. bPValue
 *                    near 0.
 *   - bPValue < 0.05 -- reject H0 at 5%: the one-sided PSD
 *                    departs from uniform somewhere in the
 *                    cumulative sense.
 *
 * COMPANIONS:
 *
 *   - `bLambda` = sqrt(K - 1) * bD -- the Kolmogorov-scaled
 *      statistic on which the survival function operates.
 *   - `bSignedDevPositive` and `bSignedDevNegative` -- the
 *      MAXIMUM POSITIVE and MAXIMUM NEGATIVE signed
 *      deviations of C[j] - j/K. Their pair tells WHICH
 *      DIRECTION the spectrum is biased toward (positive ->
 *      LOW-FREQUENCY mass overshoots uniform; negative ->
 *      HIGH-FREQUENCY mass overshoots uniform).
 *   - `bArgMaxBin` -- the bin j at which |C[j] - j/K| attains
 *      its maximum (1-indexed). Indicates the FREQUENCY where
 *      the cumulative discrepancy peaks.
 *
 * BOUND: bD in [0, 1) (sup of |empirical CDF - uniform CDF|
 * is bounded by 1). bPValue in [0, 1].
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; kept bins
 *     k >= 1 are unchanged. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the NORMALISED cumulative C[j] is unchanged.
 *     SCALE-INVARIANT.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 reversal-blind.
 *     TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD,
 *     drives bD toward 0 and bPValue toward 1.
 *   - BIN-PERMUTATION: NOT invariant -- C[j] is a CUMULATIVE
 *     ordering, so permuting bins changes the staircase
 *     entirely. PRIMARY orthogonality witness vs axis-166
 *     Fisher's g (which IS bin-permutation-invariant).
 *   - BIN-REVERSAL k -> K + 1 - k: |bD| INVARIANT (the sup
 *     of |C - line| is symmetric under reversal of the
 *     cumulative direction), but the SIGNED dev pair
 *     (bSignedDevPositive, bSignedDevNegative) SWAPS sign --
 *     a useful diagnostic.
 *
 * REFERENCES:
 *
 *   Bartlett, M. S. "An Introduction to Stochastic Processes
 *     with Special Reference to Methods and Applications"
 *     (Cambridge University Press, 1955), Chapter 9 --
 *     ORIGINAL cumulative-periodogram test derivation, with
 *     the Kolmogorov-distribution reference.
 *   Brockwell, P. J. & Davis, R. A., "Time Series: Theory
 *     and Methods" (2nd ed., Springer 1991), §10.2 --
 *     modern textbook treatment.
 *   Priestley, M. B., "Spectral Analysis and Time Series"
 *     (Academic Press 1981), §6.1.4 -- detailed exposition.
 *
 * STRUCTURAL ORTHOGONALITY:
 *
 *   - vs `daily-token-fisher-g-periodicity` (axis-166):
 *     Fisher's g picks the SINGLE LARGEST bin; Bartlett's
 *     test integrates the WHOLE cumulative spectrum.
 *     Bin-permutation FIXES Fisher's g and DESTROYS
 *     Bartlett's bD -- the cleanest possible orthogonality.
 *     A spectrum with TWO equal peaks of mass 0.4 each gives
 *     g = 0.4 (modest p) but a SHARP cumulative jump that
 *     Bartlett picks up. A red-noise spectrum gives g
 *     modest but Bartlett rejects strongly.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis-85):
 *     flatness is GM/AM (a SCALAR ratio of all bins);
 *     Bartlett's bD is the SUP of cumulative deviation
 *     (a SHAPE statistic). A spectrum with mass concentrated
 *     in low-k vs high-k can have the SAME flatness but
 *     OPPOSITE bSignedDev pair sign.
 *
 *   - vs `daily-token-spectral-entropy` (axis-69): entropy
 *     is a Shannon SCALAR; bD is the KOLMOGOROV SUPREMUM
 *     of the empirical-vs-uniform CDF gap. Two spectra with
 *     identical entropy can have wildly different bD if one
 *     has the mass smoothly distributed and the other
 *     concentrated on a contiguous band.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis-84): slope
 *     beta is a LINEAR FIT on log-log; Bartlett's test makes
 *     no parametric assumption about the spectral shape and
 *     delivers a CALIBRATED p-value via Kolmogorov's
 *     distribution.
 *
 *   - vs the time-domain serial-dependence tests
 *     (durbin-watson 162, runs-test 163, rank-vN 164,
 *     hoeffding-d 165): all test for serial dependence in
 *     the time domain on detrended residuals. Bartlett's
 *     test is FREQUENCY-DOMAIN on the gap-filled mean-centred
 *     series and detects spectral-shape departures from
 *     white noise that those time-domain tests can miss
 *     when the residual autocorrelation function has
 *     near-zero average but a band-concentrated PSD.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when the
 * computed bD / bPValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenBartlettCumulativePeriodogramSort =
  | 'bD'
  | 'bDDesc'
  | 'bPValue'
  | 'bPValueDesc'
  | 'bLambda'
  | 'bLambdaDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBartlettCumulativePeriodogramOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and the Kolmogorov asymptotic is reasonable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBartlettCumulativePeriodogramSort;
  generatedAt?: string;
}

export interface DailyTokenBartlettCumulativePeriodogramSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  totalPower: number;
  /** bD = max_{j=1..K-1} |C[j] - j/K| in [0, 1). */
  bD: number;
  /** sqrt(K - 1) * bD -- Kolmogorov-scaled statistic. */
  bLambda: number;
  /** Kolmogorov survival function p-value, in [0, 1]. */
  bPValue: number;
  /** max_{j} (C[j] - j/K), positive deviation. */
  bSignedDevPositive: number;
  /** min_{j} (C[j] - j/K), negative deviation (<= 0). */
  bSignedDevNegative: number;
  /** 1-indexed bin j at which |C[j] - j/K| is max. */
  bArgMaxBin: number;
}

export interface DailyTokenBartlettCumulativePeriodogramReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBartlettCumulativePeriodogramSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPowerSum: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenBartlettCumulativePeriodogramSourceRow[];
}

/**
 * Kolmogorov-Smirnov survival function:
 *
 *   Q_KS(lambda) = 2 * sum_{j=1}^{infty} (-1)^{j-1}
 *                                        * exp(-2 j^2 lambda^2)
 *
 * Series converges geometrically; truncating at 100 terms is
 * sufficient down to lambda > 0.05 (the j=100 term is
 * exp(-2 * 10000 * lambda^2) which underflows for lambda
 * meaningfully above 0). Edge cases:
 *
 *   - lambda <= 0  -> p = 1
 *   - lambda large -> p -> 0 exponentially
 *
 * Returns a value in [0, 1]; clamped to absorb cancellation.
 */
export function kolmogorovSurvival(lambda: number): number {
  if (!Number.isFinite(lambda)) {
    throw new Error(`kolmogorovSurvival: non-finite input (${lambda})`);
  }
  if (lambda <= 0) return 1;
  let s = 0;
  for (let j = 1; j <= 100; j += 1) {
    const t = Math.exp(-2 * j * j * lambda * lambda);
    if (t === 0) break;
    s += j % 2 === 1 ? t : -t;
    // Early exit: once the term magnitude has shrunk below
    // 1e-18 (well past double-precision contribution to s),
    // further terms cannot meaningfully change the partial
    // sum and we save iterations on small-lambda inputs
    // where the loop would otherwise run all 100 iterations.
    if (t < 1e-18) break;
  }
  let p = 2 * s;
  if (p < 0) p = 0;
  if (p > 1) p = 1;
  return p;
}

/**
 * Bartlett's cumulative-periodogram statistic on a non-
 * negative power vector indexed by k = 1..power.length.
 * Returns
 *   { bD, bLambda, bPValue, bSignedDevPositive,
 *     bSignedDevNegative, bArgMaxBin, totalPower }.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> C[j] = j/K exactly,
 *                          bD = 0, bPValue = 1.
 *   - K=K, P=[1,0,...,0] -> C[1] = 1, C[2..K-1] = 1,
 *                          dev[j] = 1 - j/K,
 *                          bD = max(1 - 1/K) = (K-1)/K,
 *                          bSignedDevPositive = (K-1)/K,
 *                          bSignedDevNegative = 0.
 *   - K=K, P=[0,...,0,1] -> C[j] = 0 for j < K,
 *                          dev[j] = -j/K for j < K,
 *                          bD = (K-1)/K (at j=K-1),
 *                          bSignedDevPositive = 0,
 *                          bSignedDevNegative = -(K-1)/K.
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function bartlettCumulativePeriodogramStatistic(power: number[]): {
  bD: number;
  bLambda: number;
  bPValue: number;
  bSignedDevPositive: number;
  bSignedDevNegative: number;
  bArgMaxBin: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `bartlettCumulativePeriodogramStatistic: too few bins (${K}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `bartlettCumulativePeriodogramStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `bartlettCumulativePeriodogramStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `bartlettCumulativePeriodogramStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  let cum = 0;
  let bD = 0;
  let bSignedDevPositive = 0;
  let bSignedDevNegative = 0;
  let bArgMaxBin = 1;
  // Loop j = 1..K-1 inclusive. j = K is exact identity
  // (C[K] = 1 = K/K) so contributes zero by construction;
  // skipping it avoids polluting the argmax with the trivial
  // endpoint.
  for (let j = 1; j <= K - 1; j += 1) {
    cum += power[j - 1]!;
    const cj = cum / totalPower;
    const dev = cj - j / K;
    if (dev > bSignedDevPositive) bSignedDevPositive = dev;
    if (dev < bSignedDevNegative) bSignedDevNegative = dev;
    const a = Math.abs(dev);
    if (a > bD) {
      bD = a;
      bArgMaxBin = j;
    }
  }
  const bLambda = Math.sqrt(K - 1) * bD;
  const bPValue = kolmogorovSurvival(bLambda);
  if (
    !Number.isFinite(bD) ||
    !Number.isFinite(bLambda) ||
    !Number.isFinite(bPValue)
  ) {
    throw new Error(
      `bartlettCumulativePeriodogramStatistic: non-finite output (bD=${bD}, bLambda=${bLambda}, bPValue=${bPValue})`,
    );
  }
  return {
    bD,
    bLambda,
    bPValue,
    bSignedDevPositive,
    bSignedDevNegative,
    bArgMaxBin,
    totalPower,
  };
}

export function dailyTokenBartlettCumulativePeriodogram(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  bD: number;
  bLambda: number;
  bPValue: number;
  bSignedDevPositive: number;
  bSignedDevNegative: number;
  bArgMaxBin: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenBartlettCumulativePeriodogram: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenBartlettCumulativePeriodogram requires finite values',
      );
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
      'dailyTokenBartlettCumulativePeriodogram: zero variance (constant series)',
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
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `dailyTokenBartlettCumulativePeriodogram: too few bins (${K}; need >= 2)`,
    );
  }
  const r = bartlettCumulativePeriodogramStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    bD: r.bD,
    bLambda: r.bLambda,
    bPValue: r.bPValue,
    bSignedDevPositive: r.bSignedDevPositive,
    bSignedDevNegative: r.bSignedDevNegative,
    bArgMaxBin: r.bArgMaxBin,
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

export function buildDailyTokenBartlettCumulativePeriodogram(
  queue: QueueLine[],
  opts: DailyTokenBartlettCumulativePeriodogramOptions = {},
): DailyTokenBartlettCumulativePeriodogramReport {
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
  const sort: DailyTokenBartlettCumulativePeriodogramSort =
    opts.sort ?? 'bPValue';
  const validSorts: DailyTokenBartlettCumulativePeriodogramSort[] = [
    'bD',
    'bDDesc',
    'bPValue',
    'bPValueDesc',
    'bLambda',
    'bLambdaDesc',
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
  let droppedZeroPowerSum = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenBartlettCumulativePeriodogramSourceRow[] = [];

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
      result = dailyTokenBartlettCumulativePeriodogram(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive total power')) {
        droppedZeroPowerSum += 1;
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
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      totalPower: result.totalPower,
      bD: result.bD,
      bLambda: result.bLambda,
      bPValue: result.bPValue,
      bSignedDevPositive: result.bSignedDevPositive,
      bSignedDevNegative: result.bSignedDevNegative,
      bArgMaxBin: result.bArgMaxBin,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bD':
        primary = a.bD - b.bD;
        break;
      case 'bDDesc':
        primary = b.bD - a.bD;
        break;
      case 'bPValue':
        primary = a.bPValue - b.bPValue;
        break;
      case 'bPValueDesc':
        primary = b.bPValue - a.bPValue;
        break;
      case 'bLambda':
        primary = a.bLambda - b.bLambda;
        break;
      case 'bLambdaDesc':
        primary = b.bLambda - a.bLambda;
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
    droppedZeroPowerSum,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
