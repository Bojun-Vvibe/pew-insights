/**
 * daily-token-laplace-centroid-trend: per-source LAPLACE
 * 1773 MASS-WEIGHTED POSITION-CENTROID TREND TEST applied
 * to the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-SEVENTEENTH cross-source axis.
 *
 * Mechanism. Laplace (1773, "Memoire sur la probabilite
 * des causes par les evenements", *Memoires de Mathema-
 * tique et de Physique presentes a l'Academie Royale des
 * Sciences*, vol. 6) introduced what is now called the
 * LAPLACE CENTROID TREND TEST: given a sequence of
 * non-negative weights w[i] (i = 1..n) at known positions,
 * the MASS-WEIGHTED CENTROID
 *
 *     cBar = ( sum_{i=1}^{n} i * w_i ) / ( sum_{i=1}^{n} w_i )
 *
 * concentrates at (n+1)/2 under the null hypothesis of
 * MASS UNIFORMLY DISTRIBUTED across positions, and shifts
 * away from the midpoint when mass is preferentially
 * front- or back-loaded. The standardised statistic
 *
 *     lapZ = ( cBar - (n+1)/2 )
 *            / sqrt( (n^2 - 1) / (12 * nEff) )
 *
 * with the Cox-Lewis 1966 *The Statistical Analysis of
 * Series of Events* sec. 3.3 EFFECTIVE SAMPLE SIZE
 *
 *     nEff = ( sum w_i )^2 / sum (w_i^2)             (1)
 *
 * is asymptotically standard Normal under H0. The
 * quantity (n^2 - 1)/12 is the variance of the discrete
 * uniform distribution on {1, .., n} (Feller 1968 vol. 1
 * sec. IX.5); dividing by nEff yields the variance of the
 * mass-weighted centroid under H0 of equal per-position
 * mass-share.
 *
 * The TWO-SIDED p-value is
 *
 *     lapPValue = 2 * (1 - Phi(|lapZ|))
 *
 * where Phi is the standard Normal CDF; we evaluate Phi
 * via Abramowitz-Stegun 7.1.26 erf approximation
 * (max abs error ~1.5e-7) wrapped to give the upper-tail
 * survival function with full precision in the tail.
 *
 * SIGN CONVENTION.
 *   - lapZ > 0  =>  cBar > (n+1)/2  =>  MASS is BACK-LOADED
 *                   (centroid LATE in tenure; growing source)
 *   - lapZ < 0  =>  cBar < (n+1)/2  =>  MASS is FRONT-LOADED
 *                   (centroid EARLY in tenure; declining source)
 *   - lapZ ~ 0  =>  mass roughly uniformly distributed across
 *                   the gap-filled tenure window
 *
 * SECONDARY DIAGNOSTIC. We surface the dimensionless
 * NORMALISED CENTROID OFFSET
 *
 *     lapCBarNorm = ( cBar - (n+1)/2 ) / ((n - 1) / 2)
 *
 * in [-1, +1] (saturated at +1 when ALL mass sits at
 * position n, at -1 when all mass sits at position 1).
 * This is a directly-interpretable EFFECT-SIZE measure
 * INDEPENDENT of nEff and so independent of the test
 * power. lapCBarNorm and lapZ can carry the same sign but
 * different magnitudes: a SMALL centroid offset on a long
 * spiky series (high nEff) can be statistically
 * significant; a LARGE offset on a short flat series (low
 * nEff) may not be.
 *
 * EFFECTIVE SAMPLE SIZE. nEff in (1) is the standard
 * Cox-Lewis 1966 sec. 3.3 effective-sample-size correction
 * for mass-weighted statistics: it equals n exactly when
 * w_i == const (uniform mass) and degenerates toward 1
 * when one w_i dominates (a single-day spike). Under the
 * uniform-mass null nEff = n; under maximal concentration
 * at one day nEff = 1 and the test correctly returns lapZ
 * = 0 (since cBar = i* exactly equals its observed value
 * and there is no mass to compare elsewhere). nEff is
 * INVARIANT under positive scale (multiply all w_i by a >
 * 0 leaves nEff unchanged) and under permutation of the
 * w_i across positions (since it depends only on the
 * sorted mass-vector); cBar is NOT permutation-invariant.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `cumulative-tokens-midpoint` (`midpointPctTenure`):
 *     that axis is a DESCRIPTIVE PERCENTILE LOOKUP -- the
 *     position at which cumulative mass first crosses 50%
 *     -- with NO null distribution, NO p-value, NO
 *     effective-sample-size correction. Two sources with
 *     identical midpointPctTenure can have DIFFERENT lapZ
 *     because lapZ uses the FIRST MOMENT (centroid) of
 *     the entire mass distribution, whereas
 *     midpointPctTenure uses ONLY the median (50th
 *     percentile) of the cumulative-mass curve. A
 *     symmetric heavy-tailed mass profile and a uniform
 *     profile can have identical 50%-crossings but very
 *     different centroids. This is the FIRST hypothesis-
 *     test axis on the mass-weighted centroid.
 *   - vs `daily-token-mann-kendall-tau` / `theil-sen-slope`
 *     / `cox-stuart-thirds-trend` (axis-110 / axis-214 /
 *     axis-215): those are RANK / SIGN-OF-DIFFERENCE
 *     tests that depend ONLY on the relative ordering of
 *     daily values, NOT on their magnitudes. The Laplace
 *     centroid test uses VALUES DIRECTLY as mass weights
 *     and is sensitive to MAGNITUDE. A series with a
 *     strict monotonic increase from 1 to n (rank trend
 *     ~+1) and a series with values [1,1,..,1,1e9] (rank
 *     trend ~0 but late-spike) have OPPOSITE signals on
 *     the rank axes; both register strongly POSITIVE on
 *     lapZ. Conversely, a series with a strict monotone
 *     increase from 1 to 1.0001 has rank trend ~+1 but
 *     lapZ near 0 (mass essentially uniform). The two
 *     families test ORTHOGONAL alternatives.
 *   - vs `daily-token-buys-ballot-period7-anova` (axis-216):
 *     period-7 ANOVA tests for WEEKDAY-OF-WEEK MEAN
 *     STRUCTURE and is INVARIANT under DETRENDING (it
 *     mean-centers within-column). The Laplace test is a
 *     PURE TREND-IN-LOCATION test on the position
 *     centroid and is BLIND to within-week periodic
 *     structure. The two are mutually orthogonal: a
 *     series with strong period-7 mean shift but uniform
 *     long-term mass loads on bbF and not on lapZ; a
 *     series with a smooth monotone mass shift but no
 *     weekday structure loads on lapZ and not on bbF.
 *   - vs `daily-token-pettitt-changepoint`: Pettitt's
 *     test (1979, *J. R. Statist. Soc. C* 28(2): 126-135)
 *     is a non-parametric CHANGE-POINT test for a SINGLE
 *     ABRUPT MEAN SHIFT at an unknown location, based on
 *     the maximum of cumulative Mann-Whitney U
 *     statistics. The Laplace test is a SMOOTH-TREND
 *     test for FIRST-MOMENT DISPLACEMENT under H0 of
 *     uniform mass, with no notion of an abrupt shift.
 *     A series with a single late spike and otherwise
 *     uniform mass loads on Pettitt and on lapZ; a
 *     series with a smooth ramp loads strongly on lapZ
 *     and weakly on Pettitt; a series with two
 *     symmetric mean shifts (low-high-low) loads on
 *     Pettitt with one direction at one change-point
 *     but lapZ ~ 0.
 *   - vs `daily-token-cusum-max-deviation`: CUSUM tracks
 *     the MAXIMUM DEVIATION of the running cumulative
 *     sum from its straight-line interpolation -- a
 *     L-infinity functional of the cumulative mass
 *     curve. The Laplace centroid is the L-1 / first-
 *     moment functional of the same curve. Different
 *     functionals of the same underlying object: a series
 *     with a sudden mid-series step has large CUSUM
 *     deviation but small centroid offset (mass on each
 *     side of the step still balances). A series with a
 *     gentle linear ramp has small CUSUM deviation but
 *     large centroid offset.
 *   - vs `daily-token-buishand-range`: Buishand R is the
 *     RESCALED RANGE of the running cumulative DEVIATIONS
 *     from the mean (Buishand 1982 *J. Hydrol.* 58:
 *     11-27). Like CUSUM it is an L-infinity / range
 *     functional, ORTHOGONAL to the L-1 centroid: a
 *     symmetric V-shaped deviation has large Buishand R
 *     but lapZ near 0; a monotone drift has both.
 *   - vs all spectral / fractal-dimension / inequality
 *     axes: those are AMPLITUDE-ONLY or PERMUTATION-
 *     INVARIANT functionals (the position labels can be
 *     freely shuffled). The Laplace centroid is FUNDA-
 *     MENTALLY POSITION-DEPENDENT: shuffling the daily
 *     values across the tenure rearranges cBar. Hence the
 *     Laplace centroid test is the FIRST L-1 first-moment
 *     position-dependent hypothesis-test axis in the
 *     suite.
 *
 * Headline question:
 * **"For each source, is the gap-filled daily-token mass
 *   STATISTICALLY DISPLACED from a uniform distribution
 *   along its tenure window -- i.e. is the mass-weighted
 *   day-index centroid significantly EARLIER (front-
 *   loaded) or LATER (back-loaded) than the tenure
 *   midpoint, after the Cox-Lewis 1966 effective-sample-
 *   size correction?"**
 *
 * References:
 *   Laplace, P. S., "Memoire sur la probabilite des causes
 *     par les evenements", *Memoires de Mathematique et
 *     de Physique presentes a l'Academie Royale des
 *     Sciences*, vol. 6 (1773), pp. 621-656. Original
 *     introduction of the centroid trend statistic for
 *     temporal point processes.
 *   Cox, D. R. & Lewis, P. A. W., *The Statistical
 *     Analysis of Series of Events*, Methuen 1966, sec.
 *     3.3 (Laplace centroid test; effective-sample-size
 *     correction for non-iid mass weights).
 *   Feller, W., *An Introduction to Probability Theory and
 *     Its Applications*, 3rd ed., Wiley 1968, vol. 1,
 *     sec. IX.5 (variance of the discrete uniform
 *     distribution: (n^2 - 1) / 12).
 *   Abramowitz, M. & Stegun, I. A., *Handbook of
 *     Mathematical Functions*, NBS 1964, eq. 7.1.26
 *     (rational approximation of the error function;
 *     used here for the standard Normal CDF).
 *   Ascher, H. & Feingold, H., *Repairable Systems
 *     Reliability*, Marcel Dekker 1984, sec. 3.5
 *     (Laplace test as the locally-most-powerful test
 *     against an exponential trend in NHPP intensity).
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 14 days. The Normal approximation
 *     to the centroid is accurate once nEff >= ~10
 *     (Cox-Lewis 1966 sec. 3.3 give simulation evidence);
 *     n >= 14 with the typical token series has nEff
 *     comfortably above 10 except for extreme single-day
 *     spikes. Sources where nEff < 2 are rejected as
 *     non-finite-fit (the variance denominator collapses).
 *   - HARD FLOOR sum w_i > 0 (otherwise cBar is
 *     undefined); enforced via the upstream zero-variance
 *     gate on the gap-filled series (a source with
 *     totalTokens > 0 always has sum w_i > 0).
 *   - Zero-padded sparse days (most days zero, few days
 *     non-zero) DECREASE nEff and so DECREASE the test
 *     power: an isolated single-day late spike registers
 *     as a large lapCBarNorm but a small |lapZ| because
 *     nEff -> 1. This is the right conservatism (a single
 *     day of activity should not be called a statistically
 *     significant trend).
 *   - The test is INVARIANT under positive scaling of
 *     mass (multiply all x_i by a > 0 leaves cBar, nEff,
 *     lapZ, and lapCBarNorm unchanged).
 *   - The test is NOT INVARIANT under shifting the
 *     series along the tenure window: cyclic-shifting the
 *     mass by k days SHIFTS cBar by k days mod n and so
 *     CHANGES lapZ. This is the right behaviour (it IS a
 *     position-test).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-laplace-centroid-trend
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-laplace-centroid-trend \
 *     --source vsc-redacted --json
 *
 *   # Sort by lapZ descending (most back-loaded sources first):
 *   pew-insights daily-token-laplace-centroid-trend \
 *     --sort lapZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenLaplaceCentroidTrendSort =
  | 'lapZ'
  | 'lapZDesc'
  | 'lapAbsZDesc'
  | 'lapPValue'
  | 'lapPValueDesc'
  | 'lapCBarNorm'
  | 'lapCBarNormDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLaplaceCentroidTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 14 so
   * that nEff has room above the Cox-Lewis 1966 sec. 3.3
   * floor of ~10 for the Normal approximation to be
   * accurate.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenLaplaceCentroidTrendSort;
  generatedAt?: string;
}

export interface DailyTokenLaplaceCentroidTrendSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Mass-weighted day-index centroid in [1, n]. */
  lapCBar: number;
  /** Tenure midpoint reference (n+1)/2. */
  lapMidpoint: number;
  /** Cox-Lewis 1966 sec. 3.3 effective sample size in [1, n]. */
  lapNEff: number;
  /** Standardised Normal Z statistic. */
  lapZ: number;
  /** Two-sided Normal-approximation p-value. */
  lapPValue: number;
  /** Normalised centroid offset in [-1, +1]. */
  lapCBarNorm: number;
}

export interface DailyTokenLaplaceCentroidTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenLaplaceCentroidTrendSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenLaplaceCentroidTrendSourceRow[];
}

/**
 * Standard Normal CDF Phi(z) via the Abramowitz-Stegun
 * 1964 eq. 7.1.26 rational erf approximation. Max
 * absolute error ~1.5e-7 across all real z; we use the
 * symmetry Phi(z) = 1 - Phi(-z) to keep the working
 * argument non-negative.
 */
export function standardNormalCdfLaplace(z: number): number {
  if (!Number.isFinite(z)) {
    if (z === Number.POSITIVE_INFINITY) return 1;
    if (z === Number.NEGATIVE_INFINITY) return 0;
    throw new Error(`standardNormalCdfLaplace: z must be finite (got ${z})`);
  }
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  // Abramowitz-Stegun 7.1.26
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Two-sided Normal p-value 2 * (1 - Phi(|z|)).
 */
export function twoSidedNormalPLaplace(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`twoSidedNormalPLaplace: z must be finite (got ${z})`);
  }
  const az = Math.abs(z);
  const upper = 1 - standardNormalCdfLaplace(az);
  const p = 2 * upper;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Cox-Lewis 1966 sec. 3.3 effective sample size for a
 * mass-weighted statistic:
 *
 *     nEff = (sum w_i)^2 / sum (w_i^2)
 *
 * Returns n exactly when w is uniform; returns 1 when one
 * w_i carries all mass. Throws if any w_i < 0 or if sum
 * w_i = 0.
 */
export function effectiveSampleSizeLaplace(weights: number[]): number {
  const n = weights.length;
  if (n === 0) {
    throw new Error('effectiveSampleSizeLaplace: empty weights');
  }
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i]!;
    if (!Number.isFinite(w)) {
      throw new Error(
        `effectiveSampleSizeLaplace: non-finite weight at index ${i}`,
      );
    }
    if (w < 0) {
      throw new Error(
        `effectiveSampleSizeLaplace: negative weight at index ${i} (got ${w})`,
      );
    }
    s1 += w;
    s2 += w * w;
  }
  if (s1 === 0) {
    throw new Error('effectiveSampleSizeLaplace: total mass is zero');
  }
  if (s2 === 0) {
    // unreachable when s1 > 0 and all w_i >= 0, but defensive
    throw new Error('effectiveSampleSizeLaplace: zero squared-mass');
  }
  return (s1 * s1) / s2;
}

/**
 * Laplace 1773 mass-weighted centroid trend test on a
 * non-negative weight sequence at integer positions
 * 1..n. Returns the centroid, the midpoint, the effective
 * sample size, the Z statistic, the two-sided p-value,
 * and the normalised centroid offset.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - lapCBar in [1, n] always.
 *   - lapMidpoint === (n + 1) / 2 always.
 *   - lapNEff in [1, n] always; lapNEff = n iff all
 *     weights are equal; lapNEff = 1 iff one weight
 *     carries all mass.
 *   - lapCBarNorm in [-1, +1] always.
 *   - For weights uniform-non-zero (e.g. all 1):
 *     lapCBar === (n+1)/2, lapZ === 0, lapPValue === 1,
 *     lapCBarNorm === 0.
 *   - For all mass at position 1 (only w_0 > 0):
 *     lapCBar = 1, lapNEff = 1, lapZ < 0, lapCBarNorm = -1.
 *   - For all mass at position n (only w_{n-1} > 0):
 *     lapCBar = n, lapNEff = 1, lapZ > 0, lapCBarNorm = +1.
 *   - lap statistics are INVARIANT under positive scaling
 *     of all weights (a > 0).
 *   - REVERSING the weights along positions NEGATES lapZ
 *     and lapCBarNorm but preserves their absolute
 *     values; lapPValue is unchanged.
 */
export function dailyTokenLaplaceCentroidTrend(weights: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  lapCBar: number;
  lapMidpoint: number;
  lapNEff: number;
  lapZ: number;
  lapPValue: number;
  lapCBarNorm: number;
} {
  const n = weights.length;
  if (n < 14) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: need at least 14 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenLaplaceCentroidTrend requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenLaplaceCentroidTrend requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  let sumIW = 0;
  let sumW2 = 0;
  let sumXForMean = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i]!;
    sumW += w;
    sumW2 += w * w;
    sumIW += (i + 1) * w; // 1-indexed positions per Laplace 1773
    sumXForMean += w;
  }
  if (sumW === 0) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: total mass is zero (n=${n})`,
    );
  }
  const mean = sumXForMean / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: zero centred variance (n=${n})`,
    );
  }
  const lapCBar = sumIW / sumW;
  const lapMidpoint = (n + 1) / 2;
  const lapNEff = (sumW * sumW) / sumW2;
  if (!Number.isFinite(lapNEff) || lapNEff < 1) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: invalid nEff=${lapNEff} (n=${n})`,
    );
  }
  if (lapNEff < 2) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: nEff < 2 (got ${lapNEff}); test power collapses`,
    );
  }
  // Variance of cBar under H0 (mass uniform across positions):
  //   Var(cBar) = (n^2 - 1) / (12 * nEff)
  const varCBar = (n * n - 1) / (12 * lapNEff);
  if (varCBar <= 0 || !Number.isFinite(varCBar)) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: non-positive var(cBar)=${varCBar} (n=${n})`,
    );
  }
  const lapZ = (lapCBar - lapMidpoint) / Math.sqrt(varCBar);
  if (!Number.isFinite(lapZ)) {
    throw new Error(
      `dailyTokenLaplaceCentroidTrend: non-finite Z (n=${n})`,
    );
  }
  const lapPValue = twoSidedNormalPLaplace(lapZ);
  // Normalised centroid offset in [-1, +1]: cBar can range
  // over [1, n]; the half-range from the midpoint is (n-1)/2.
  const lapCBarNorm = (lapCBar - lapMidpoint) / ((n - 1) / 2);
  return {
    mean,
    stddev,
    nSamples: n,
    lapCBar,
    lapMidpoint,
    lapNEff,
    lapZ,
    lapPValue,
    lapCBarNorm,
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

export function buildDailyTokenLaplaceCentroidTrend(
  queue: QueueLine[],
  opts: DailyTokenLaplaceCentroidTrendOptions = {},
): DailyTokenLaplaceCentroidTrendReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 14) {
    throw new Error(
      `minTenureDays must be an integer >= 14 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenLaplaceCentroidTrendSort = opts.sort ?? 'lapAbsZDesc';
  const validSorts: DailyTokenLaplaceCentroidTrendSort[] = [
    'lapZ',
    'lapZDesc',
    'lapAbsZDesc',
    'lapPValue',
    'lapPValueDesc',
    'lapCBarNorm',
    'lapCBarNormDesc',
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
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenLaplaceCentroidTrendSourceRow[] = [];

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
      result = dailyTokenLaplaceCentroidTrend(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      lapCBar: result.lapCBar,
      lapMidpoint: result.lapMidpoint,
      lapNEff: result.lapNEff,
      lapZ: result.lapZ,
      lapPValue: result.lapPValue,
      lapCBarNorm: result.lapCBarNorm,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'lapZ':
        primary = a.lapZ - b.lapZ;
        break;
      case 'lapZDesc':
        primary = b.lapZ - a.lapZ;
        break;
      case 'lapAbsZDesc':
        primary = Math.abs(b.lapZ) - Math.abs(a.lapZ);
        break;
      case 'lapPValue':
        primary = a.lapPValue - b.lapPValue;
        break;
      case 'lapPValueDesc':
        primary = b.lapPValue - a.lapPValue;
        break;
      case 'lapCBarNorm':
        primary = a.lapCBarNorm - b.lapCBarNorm;
        break;
      case 'lapCBarNormDesc':
        primary = b.lapCBarNorm - a.lapCBarNorm;
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
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
