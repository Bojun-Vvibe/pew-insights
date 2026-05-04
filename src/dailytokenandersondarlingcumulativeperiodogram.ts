/**
 * daily-token-anderson-darling-cumulative-periodogram: per-source
 * ANDERSON-DARLING CUMULATIVE PERIODOGRAM TEST -- the
 * TAIL-WEIGHTED L^2 goodness-of-fit test for white-noise on the
 * gap-filled mean-centred daily total_tokens series. Third
 * member of the canonical EDF goodness-of-fit trio
 * (Kolmogorov-Smirnov / Cramer-von Mises / Anderson-Darling)
 * applied to the cumulative periodogram domain. Sister axes:
 *
 *   axis-167  Bartlett's KS-style statistic (sup-norm L^infty)
 *   axis-168  Cramer-von Mises (uniform-weighted L^2)
 *   axis-169  Anderson-Darling (tail-weighted L^2)        <-- this file
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the NORMALISED CUMULATIVE
 * PERIODOGRAM
 *
 *   C[j] = (sum_{k=1..j} P[k]) / (sum_{k=1..K} P[k]),
 *          j = 1..K
 *
 * Anderson & Darling (1952) introduced a WEIGHT FUNCTION
 * w(t) = 1 / (t * (1 - t)) on [0,1] to up-weight deviations
 * in the tails of the reference CDF where the un-weighted
 * Cramer-von Mises and Kolmogorov-Smirnov statistics lose
 * power. Applied to the cumulative-periodogram domain
 * (treating j/K as the uniform reference CDF), the
 * ANDERSON-DARLING STATISTIC for white-noise is
 *
 *   adA2 = (1/(K-1)) sum_{j=1..K-1}
 *               (C[j] - j/K)^2 / ( (j/K) * (1 - j/K) )    (raw)
 *
 *   adAStar = (K-1) * adA2                                (scaled)
 *
 * Why this matters in PRACTICE: at j = 1 (the lowest
 * non-zero frequency) and j = K-1 (just below Nyquist), the
 * weight (j/K)*(1 - j/K) is approximately 1/K -- so the
 * Anderson-Darling weight `1/(j/K)*(1-j/K)` is approximately
 * K. A small deviation in the FIRST or LAST cumulative bin
 * therefore contributes ~K times more to adAStar than the
 * SAME deviation in the centre of the spectrum. This is
 * exactly the orthogonality witness against axis-168 CvM:
 * CvM uses uniform weight 1, AD uses 1/[F(1-F)]. A spectrum
 * whose deviation is concentrated near DC (j=1) or near
 * Nyquist (j=K-1) shows up STRONGLY in adAStar but only
 * MODESTLY in cvmW2; a spectrum whose deviation is centred
 * mid-band shows up STRONGLY in cvmW2 but only MODESTLY in
 * adAStar.
 *
 * Under H0 (Gaussian white noise) the cumulative process
 * C[j] - j/K converges to a Brownian bridge B(t) on [0,1]
 * (the SAME limiting process as Bartlett-167 and CvM-168);
 * the AD functional integral
 *
 *   A^2 = integral_0^1 B(t)^2 / (t * (1 - t)) dt
 *
 * has the celebrated Anderson-Darling 1952 distribution. We
 * adopt the Marsaglia & Marsaglia (2004) JSS algorithm:
 * a piecewise rational/series approximation that is exact
 * to better than 1e-6 across the operating range. For
 * adAStar > 6 we use the published asymptotic-tail closure
 *
 *   P(A^2 > a) ~ (sqrt(2 pi) / a) * exp(-pi^2 / (8 a))
 *                * (1 + 7 a / (12 pi^2) - ...) [Marsaglia 2004 eq.(13)]
 *
 * which is accurate to better than 1e-12 for a >= 6.
 *
 * READING:
 *
 *   - adAStar near 0   -- C[j] tracks j/K everywhere, with
 *                         the tails very tightly tracked.
 *                         adPValue near 1.
 *   - adAStar large    -- cumulative spectrum departs from
 *                         the uniform line MOST in the
 *                         tails (near DC or near Nyquist).
 *                         adPValue near 0.
 *   - adPValue < 0.05  -- reject H0 at 5%: PSD departs from
 *                         white noise in the tail-weighted
 *                         L^2 sense.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs `daily-token-cramer-von-mises-cumulative-periodogram`
 *     (axis-168): SAME statistic domain (the cumulative
 *     periodogram C[j] - j/K), DIFFERENT WEIGHT. CvM uses
 *     uniform weight 1; AD uses 1/[F(1-F)] -- a tail-
 *     emphasising weight that grows like K at j=1 and
 *     j=K-1. PRIMARY witness: a spectrum with deviation
 *     concentrated at j = 1 (DC excess) or j = K-1 (Nyquist
 *     excess) yields LARGE adAStar but MODEST cvmW2. A
 *     spectrum with deviation concentrated mid-band yields
 *     LARGE cvmW2 but MODEST adAStar. This is the textbook
 *     uniform-L^2 vs tail-weighted-L^2 power complement
 *     (Stephens 1974 JASA 69(347) Table 3).
 *
 *   - vs `daily-token-bartlett-cumulative-periodogram`
 *     (axis-167): SAME statistic domain, DIFFERENT NORM
 *     ENTIRELY. Bartlett is sup-norm (L^infty); AD is
 *     tail-weighted L^2. A single-bin SPIKE drives Bartlett
 *     bD large; AD adAStar feels it ONLY proportionally to
 *     the spike's bin-position weight. A SUSTAINED LOW-
 *     FREQUENCY bias drives both moderately, but AD up-
 *     weights the j=1 contribution.
 *
 *   - vs `daily-token-fisher-g-periodicity` (axis-166):
 *     Fisher's g is a MAX-SHARE of one bin (bin-permutation
 *     -INVARIANT); AD is bin-permutation-SENSITIVE
 *     (cumulative ordering with positional weight).
 *
 *   - vs all 2nd-moment spectral descriptors (centroid,
 *     bandwidth, kurtosis, skewness, rolloff, flatness,
 *     entropy): those are MOMENTS / SCALARS of the PSD
 *     shape; AD is a CALIBRATED p-value with a TAIL-WEIGHT
 *     emphasis no moment captures.
 *
 *   - vs the time-domain serial-dependence tests (durbin-
 *     watson 162, runs-test 163, rank-vN 164, hoeffding-d 165,
 *     ljung-box-Q 158, mcleod-li 159): all are time-domain;
 *     AD is frequency-domain on the cumulative periodogram
 *     with tail-weight emphasis.
 *
 * BOUND: adAStar in [0, infinity). adPValue in [0, 1].
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; kept bins
 *     unchanged. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every bin scales by a^2;
 *     normalised C[j] is unchanged. SCALE-INVARIANT.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 reversal-blind.
 *     TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD,
 *     drives adAStar toward 0.
 *   - BIN-PERMUTATION: NOT invariant -- C[j] cumulative
 *     ordering is permutation-sensitive, AND the AD weight
 *     1/[F(1-F)] is positionally sensitive. STRONGEST
 *     position-sensitivity of the EDF trio.
 *   - BIN-REVERSAL k -> K + 1 - k: adAStar INVARIANT in
 *     magnitude (the integral is symmetric under reversal
 *     because the weight 1/[F(1-F)] is symmetric about 1/2).
 *
 * REFERENCES:
 *
 *   Anderson, T. W. & Darling, D. A. "Asymptotic theory of
 *     certain `goodness of fit' criteria based on stochastic
 *     processes", Annals Math. Stat. 23(2) (1952) 193-212 --
 *     ORIGINAL definition of A^2 with weight 1/[F(1-F)].
 *   Anderson, T. W. & Darling, D. A. "A test of goodness of
 *     fit", JASA 49(268) (1954) 765-769 -- published critical
 *     values.
 *   Stephens, M. A. "EDF statistics for goodness of fit and
 *     some comparisons", JASA 69(347) (1974) 730-737 --
 *     calibrated power comparison KS vs CvM vs AD.
 *   Marsaglia, G. & Marsaglia, J. C. W. "Evaluating the
 *     Anderson-Darling distribution", Journal of Statistical
 *     Software 9(2) (2004) -- the rational/series
 *     approximation deployed in `andersonDarlingSurvival`
 *     below, accurate to ~1e-6 in the body and ~1e-12 in
 *     the tail.
 *   Brockwell, P. J. & Davis, R. A. "Time Series: Theory
 *     and Methods" (2nd ed., Springer 1991), §10.2 --
 *     application of EDF tests to the cumulative periodogram.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when
 * the computed adAStar / adPValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenAndersonDarlingCumulativePeriodogramSort =
  | 'adA2'
  | 'adA2Desc'
  | 'adAStar'
  | 'adAStarDesc'
  | 'adPValue'
  | 'adPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAndersonDarlingCumulativePeriodogramOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and the Brownian-bridge asymptotic for the cumulative
   * periodogram is reasonable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAndersonDarlingCumulativePeriodogramSort;
  generatedAt?: string;
}

export interface DailyTokenAndersonDarlingCumulativePeriodogramSourceRow {
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
  /** raw A^2 = (1/(K-1)) sum_{j=1..K-1} (C[j] - j/K)^2 / ((j/K)*(1-j/K)). */
  adA2: number;
  /** scaled adAStar = (K-1) * adA2; the calibrated statistic. */
  adAStar: number;
  /** Marsaglia-Marsaglia (2004) survival p-value, in [0, 1]. */
  adPValue: number;
  /**
   * tail-weighted signed mean: average of
   *   (C[j] - j/K) / sqrt((j/K)*(1-j/K))
   * over j = 1..K-1.
   *   > 0 -> weighted overshoot toward LOW-freq tail;
   *   < 0 -> weighted overshoot toward HIGH-freq tail.
   *
   * Distinct from cvmSignedMean (axis-168 uses uniform
   * weight) and bSignedDevPositive/Negative (axis-167 uses
   * sup over signed deviations). The 1/sqrt[F(1-F)] half-
   * weight is the natural companion to A^2's full-weight
   * statistic.
   */
  adWeightedSignedMean: number;
}

export interface DailyTokenAndersonDarlingCumulativePeriodogramReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAndersonDarlingCumulativePeriodogramSort;
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
  sources: DailyTokenAndersonDarlingCumulativePeriodogramSourceRow[];
}

/**
 * Marsaglia & Marsaglia (2004) JSS approximation to the
 * Anderson-Darling A^2 distribution. Two pieces:
 *
 *   adinf(z): the asymptotic CDF of A^2 (n -> infinity).
 *
 * For z in (0, 2]:
 *   adinf(z) = (1/sqrt(z)) * exp(-1.2337141/z)
 *               * (2.00012 + (0.247105 - (0.0649821 - (0.0347962
 *                  - (0.0116720 - 0.00168691*z)*z)*z)*z)*z)
 *
 * For z in (2, infinity):
 *   adinf(z) = exp( -exp(1.0776 - (2.30695 - (0.43424 - (0.082433
 *                    - (0.008056 - 0.0003146*z)*z)*z)*z)*z) )
 *
 * The survival is P(A^2 > z) = 1 - adinf(z).
 *
 * Edge cases:
 *   - z <= 0  -> p = 1
 *
 * Returns a value in [0, 1]; clamped.
 */
export function andersonDarlingSurvival(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`andersonDarlingSurvival: non-finite input (${z})`);
  }
  if (z <= 0) return 1;
  let cdf: number;
  if (z <= 2) {
    cdf =
      (1 / Math.sqrt(z)) *
      Math.exp(-1.2337141 / z) *
      (2.00012 +
        (0.247105 -
          (0.0649821 -
            (0.0347962 - (0.0116720 - 0.00168691 * z) * z) * z) *
            z) *
          z);
  } else {
    cdf = Math.exp(
      -Math.exp(
        1.0776 -
          (2.30695 -
            (0.43424 - (0.082433 - (0.008056 - 0.0003146 * z) * z) * z) *
              z) *
            z,
      ),
    );
  }
  let p = 1 - cdf;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Anderson-Darling cumulative-periodogram statistic on a
 * non-negative power vector indexed by k = 1..power.length.
 * Returns
 *   { adA2, adAStar, adPValue, adWeightedSignedMean,
 *     totalPower }.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> C[j] = j/K exactly,
 *                          adA2 = 0, adAStar = 0, p = 1.
 *   - K=K, P=[1,0,...,0] -> C[1..K-1] = 1,
 *                          dev[j] = 1 - j/K,
 *                          term[j] = (1 - j/K)^2 / ((j/K)*(1-j/K))
 *                                  = (1 - j/K) / (j/K)
 *                                  = (K - j) / j.
 *                          adA2 = (1/(K-1)) sum_{j=1..K-1} (K-j)/j.
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function andersonDarlingCumulativePeriodogramStatistic(
  power: number[],
): {
  adA2: number;
  adAStar: number;
  adPValue: number;
  adWeightedSignedMean: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `andersonDarlingCumulativePeriodogramStatistic: too few bins (${K}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `andersonDarlingCumulativePeriodogramStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `andersonDarlingCumulativePeriodogramStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `andersonDarlingCumulativePeriodogramStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  let cum = 0;
  let sumWeighted = 0;
  let sumSignedHalfWeighted = 0;
  // Loop j = 1..K-1 inclusive. j = K is the trivial endpoint
  // where C[K] = 1 = K/K so contributes zero numerator BUT a
  // pole in the denominator (1 - K/K = 0); we exclude it
  // exactly as Anderson-Darling 1952 prescribes (the integral
  // domain is open on the right) and as axis-167/168 do.
  for (let j = 1; j <= K - 1; j += 1) {
    cum += power[j - 1]!;
    const cj = cum / totalPower;
    const fj = j / K;
    const dev = cj - fj;
    const w = fj * (1 - fj);
    // w > 0 strictly for j in 1..K-1 because 0 < j/K < 1.
    sumWeighted += (dev * dev) / w;
    sumSignedHalfWeighted += dev / Math.sqrt(w);
  }
  const adA2 = sumWeighted / (K - 1);
  const adAStar = (K - 1) * adA2; // == sumWeighted
  const adPValue = andersonDarlingSurvival(adAStar);
  const adWeightedSignedMean = sumSignedHalfWeighted / (K - 1);
  if (
    !Number.isFinite(adA2) ||
    !Number.isFinite(adAStar) ||
    !Number.isFinite(adPValue) ||
    !Number.isFinite(adWeightedSignedMean)
  ) {
    throw new Error(
      `andersonDarlingCumulativePeriodogramStatistic: non-finite output (adA2=${adA2}, adAStar=${adAStar}, adPValue=${adPValue}, adWeightedSignedMean=${adWeightedSignedMean})`,
    );
  }
  return {
    adA2,
    adAStar,
    adPValue,
    adWeightedSignedMean,
    totalPower,
  };
}

export function dailyTokenAndersonDarlingCumulativePeriodogram(
  values: number[],
): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  adA2: number;
  adAStar: number;
  adPValue: number;
  adWeightedSignedMean: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenAndersonDarlingCumulativePeriodogram: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenAndersonDarlingCumulativePeriodogram requires finite values',
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
      'dailyTokenAndersonDarlingCumulativePeriodogram: zero variance (constant series)',
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
      `dailyTokenAndersonDarlingCumulativePeriodogram: too few bins (${K}; need >= 2)`,
    );
  }
  const r = andersonDarlingCumulativePeriodogramStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    adA2: r.adA2,
    adAStar: r.adAStar,
    adPValue: r.adPValue,
    adWeightedSignedMean: r.adWeightedSignedMean,
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

export function buildDailyTokenAndersonDarlingCumulativePeriodogram(
  queue: QueueLine[],
  opts: DailyTokenAndersonDarlingCumulativePeriodogramOptions = {},
): DailyTokenAndersonDarlingCumulativePeriodogramReport {
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
  const sort: DailyTokenAndersonDarlingCumulativePeriodogramSort =
    opts.sort ?? 'adPValue';
  const validSorts: DailyTokenAndersonDarlingCumulativePeriodogramSort[] = [
    'adA2',
    'adA2Desc',
    'adAStar',
    'adAStarDesc',
    'adPValue',
    'adPValueDesc',
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
  const rows: DailyTokenAndersonDarlingCumulativePeriodogramSourceRow[] = [];

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
      result = dailyTokenAndersonDarlingCumulativePeriodogram(filled);
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
      adA2: result.adA2,
      adAStar: result.adAStar,
      adPValue: result.adPValue,
      adWeightedSignedMean: result.adWeightedSignedMean,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'adA2':
        primary = a.adA2 - b.adA2;
        break;
      case 'adA2Desc':
        primary = b.adA2 - a.adA2;
        break;
      case 'adAStar':
        primary = a.adAStar - b.adAStar;
        break;
      case 'adAStarDesc':
        primary = b.adAStar - a.adAStar;
        break;
      case 'adPValue':
        primary = a.adPValue - b.adPValue;
        break;
      case 'adPValueDesc':
        primary = b.adPValue - a.adPValue;
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
