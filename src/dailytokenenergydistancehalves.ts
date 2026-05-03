/**
 * daily-token-energy-distance-halves: per-source
 * ENERGY DISTANCE TWO-SAMPLE TEST (Szekely & Rizzo
 * 2004) comparing the empirical distributions of the
 * FIRST half vs SECOND half of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-SECOND cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The energy distance E^2(A, B) (Szekely 2002 Inv.
 * Math. tech. report 02-16; Szekely & Rizzo 2004,
 * InterStat; Szekely & Rizzo 2013 Journal of
 * Statistical Planning and Inference 143(8):1249-1272)
 * between the empirical distributions F_A and F_B is
 *
 *     E^2(A, B)  =  2 * E|X - Y|
 *                  -   E|X - X'|
 *                  -   E|Y - Y'|
 *
 * where X, X' iid ~ F_A and Y, Y' iid ~ F_B. The
 * empirical (V-statistic) estimator is
 *
 *     E_hat  =  (2 / (n1 * n2))
 *                * sum_{i, j} | A_i - B_j |
 *             -  (1 / n1^2)
 *                * sum_{i, j} | A_i - A_j |
 *             -  (1 / n2^2)
 *                * sum_{i, j} | B_i - B_j |
 *
 * which is non-negative and equals zero iff the two
 * empirical distributions coincide (Szekely & Rizzo
 * 2013 Theorem 1). The test statistic
 *
 *     T_E  =  ( n1 * n2 / (n1 + n2) ) * E_hat
 *
 * is the canonical scaled energy statistic with a
 * non-degenerate limiting distribution under H0
 * (mixture of weighted chi-squared, Szekely & Rizzo
 * 2013 Theorem 2).
 *
 * Equivalent characteristic-function representation.
 * For univariate F with finite first moment,
 *
 *     E^2(F_A, F_B)  =  (1 / pi)
 *         * integral_R
 *             | phi_A(t) - phi_B(t) |^2 / t^2  dt
 *
 * where phi_A, phi_B are the characteristic functions
 * of F_A, F_B (Szekely 2002, Lemma 1; Feuerverger 1993
 * J. Time Series Anal. 14(2):129-145). This places
 * energy distance squarely in CHARACTERISTIC-FUNCTION
 * SPACE, structurally distinct from ECDF-space
 * statistics (KS axis-118, AD axis-119, CvM axis-120)
 * and quantile-space statistics (W1 axis-121).
 *
 * Standardisation. Under H0 (both halves drawn from
 * the same continuous distribution F with finite
 * first moment), T_E has the limiting distribution
 *
 *     T_E  ->  sum_k lambda_k * (Z_k^2 - 1)
 *
 * for eigenvalues lambda_k of an F-dependent integral
 * operator. The null distribution depends on F, so we
 * standardise by the SCALE-INVARIANT normalisation
 *
 *     enZ  =  sqrt(E_hat) / pooledMad
 *
 * (sqrt(E_hat) has units of tokens by the |.| kernel,
 * so dividing by pooledMad yields dimensionless effect
 * size). The square root is needed because E_hat
 * itself has units of tokens (since the energy kernel
 * d(x, y) = |x - y| is positively homogeneous of
 * degree 1, so E_hat scales linearly under x -> k*x).
 * pooledMad is the median absolute deviation about
 * the pooled median, with deterministic fallback to
 * population stddev. enZ is NOT a hypothesis-test
 * z-score (the null distribution depends on F) but a
 * cross-source-comparable effect size.
 *
 * Sign convention. T_E is INTRINSICALLY UNSIGNED
 * (sum of three non-negative kernel sums). To make
 * the axis cross-comparable with the signed halves
 * tests (115/116/117/118) and the unsigned-with-
 * sign-flag axes 119/120/121, we report
 *
 *     enDir   =  sign( median(B) - median(A) )
 *     enZSigned  =  enDir * enZ
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-121:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-
 *     TEST (NONPARAMETRIC ENERGY-DISTANCE statistic).
 *     Sensitive to ANY distributional difference
 *     (location, scale, shape, tails) and is a proper
 *     METRIC on the space of probability measures
 *     with finite first moment (Szekely & Rizzo 2013
 *     Theorem 1).
 *
 *   - vs axis-121 daily-token-wasserstein-one-halves.
 *     W1 = integral_R |F_A - F_B| dx is the L1 norm of
 *     the CDF GAP in support space. Energy distance
 *     E^2 = (1/pi) integral_R |phi_A - phi_B|^2 / t^2
 *     dt is the WEIGHTED L2 norm of the CHARACTERISTIC
 *     FUNCTION GAP in frequency space. The two are
 *     NOT a monotone transform: a sharp short-range
 *     CDF discontinuity gives finite W1 but unbounded
 *     |phi|^2 contribution at high frequencies (and
 *     is dampened by the 1/t^2 kernel into a finite
 *     E^2). Two distributions with identical L1 CDF
 *     gap can have very different E^2 if the gap is
 *     concentrated (high frequencies, large E^2) vs
 *     spread out (low frequencies, smaller E^2).
 *
 *   - vs axis-120 daily-token-cramer-von-mises-halves.
 *     CvM = integral_R (F_A - F_B)^2 dH_N is the L2
 *     norm of the CDF GAP in PROBABILITY space.
 *     Energy distance is the L2 norm of the
 *     CHARACTERISTIC-FUNCTION GAP in FREQUENCY space.
 *     They are linked by Parseval-Plancherel only
 *     under specific weight functions; here the CvM
 *     dH_N weight and the energy 1/t^2 weight differ,
 *     so the two statistics are not monotone images
 *     of each other.
 *
 *   - vs axis-119 daily-token-anderson-darling-halves.
 *     AD weights the squared CDF gap by
 *     1/(H_N(1-H_N)) in PROBABILITY space, amplifying
 *     tail discrepancies. Energy distance applies
 *     the 1/t^2 weight in FREQUENCY space, which
 *     amplifies LOW-FREQUENCY (large-scale) features
 *     of the distributional difference. AD blows up
 *     for tail-mass differences; energy distance
 *     blows up for large-scale support shifts.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS = sup |F_A - F_B| is the L_infinity SUP of
 *     the CDF gap in support space; only the maximum
 *     vertical gap matters. Energy distance INTEGRATES
 *     the squared characteristic-function gap with the
 *     1/t^2 weight; the entire frequency spectrum
 *     contributes. Two halves with identical KS but
 *     very different E^2 emerge when one has a single
 *     localised jump (small E^2 contribution from
 *     dampened high frequencies) vs many small jumps
 *     spread over the support (large low-frequency
 *     contribution).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is a NONPARAMETRIC RANK-SUM on
 *     OUTWARD-PAIR ranks AFTER median-centring,
 *     sensitive ONLY to SCALE shift. Energy distance
 *     detects scale shift among other things in
 *     CHARACTERISTIC-FUNCTION space.
 *
 *   - vs axes 115/116. Mann-Whitney is a LOCATION /
 *     stochastic-dominance test in PROBABILITY space.
 *     Brown-Forsythe is a PARAMETRIC SCALE F-test on
 *     absolute deviations from per-half medians.
 *     Energy distance detects ANY distributional
 *     shift via the characteristic-function gap.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Permutation-invariant functionals
 *     of the EMPIRICAL DISTRIBUTION computed on the
 *     WHOLE series. Energy distance is permutation-
 *     invariant within each half but depends on
 *     WHICH half each value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), how large is the
 *   Szekely-Rizzo energy distance between the two
 *   half-distributions in the L2-weighted-frequency
 *   sense, and how does that compare with the pooled
 *   robust scale?"**
 *
 * Reference:
 *   Szekely, G. J., "E-statistics: The energy of
 *     statistical samples", Bowling Green State
 *     University, Department of Mathematics and
 *     Statistics, Technical Report 02-16 (2002).
 *   Szekely, G. J. and Rizzo, M. L., "Testing for
 *     Equal Distributions in High Dimension",
 *     InterStat (November 2004).
 *   Szekely, G. J. and Rizzo, M. L., "Energy
 *     statistics: A class of statistics based on
 *     distances", Journal of Statistical Planning
 *     and Inference 143(8) (2013), pp. 1249-1272.
 *
 * Caveats:
 *
 *   - E_hat in [0, +inf) with units of tokens.
 *     T_E in [0, +inf) with units of tokens.
 *     enZ in [0, +inf) dimensionless.
 *     enZSigned in (-inf, +inf).
 *   - enZ is NOT a hypothesis-test z-score; the null
 *     distribution of T_E depends on F. It is a
 *     CROSS-SOURCE-COMPARABLE EFFECT SIZE.
 *   - When pooledMad = 0 (degenerate flat pool) we
 *     fall back to stddev; when both are 0 we throw,
 *     though the upstream zero-variance guard already
 *     filters such sources.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115-121). Hard floor n >= 8.
 *   - Computational cost. O((n1 + n2)^2) due to the
 *     pairwise |.| sums. For n = nTenureDays up to a
 *     few thousand this is comfortably interactive.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-energy-distance-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-energy-distance-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute energy effect size desc:
 *   pew-insights daily-token-energy-distance-halves \
 *     --sort enZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenEnergyDistanceHalvesSort =
  | 'enE'
  | 'enEDesc'
  | 'enT'
  | 'enTDesc'
  | 'enZ'
  | 'enZDesc'
  | 'enZSigned'
  | 'enZSignedDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenEnergyDistanceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (asymptotic regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenEnergyDistanceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenEnergyDistanceHalvesSourceRow {
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
  /** First-half size n1 = floor(n/2). */
  enN1: number;
  /** Second-half size n2 = n - n1. */
  enN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  enMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  enMedianB: number;
  /** Median of the pooled sample (used as scale centre). */
  enPooledMedian: number;
  /** MAD/scale of the pooled sample about the pooled median. */
  enPooledMad: number;
  /** Empirical energy distance E_hat (token units). */
  enE: number;
  /** Scaled energy test statistic T_E = n1*n2/(n1+n2)*E_hat. */
  enT: number;
  /** Scale-normalised effect size sqrt(E_hat)/pooledMad. */
  enZ: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  enDir: number;
  /** Signed effect size: enDir * enZ. */
  enZSigned: number;
}

export interface DailyTokenEnergyDistanceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenEnergyDistanceHalvesSort;
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
  sources: DailyTokenEnergyDistanceHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Robust pooled-dispersion scale used to convert the
 * raw energy distance into a dimensionless, cross-
 * source-comparable effect size enZ.
 *
 * Returns the median absolute deviation about the
 * pooled median (Hampel 1974, JASA 69(346):383-393),
 * with a deterministic fallback to the population
 * stddev when MAD collapses to 0 -- which happens for
 * sparse zero-heavy daily token series where >= 50 %
 * of the days are gap-filled zeros (so the pooled
 * median IS 0 and over half the absolute deviations
 * are 0 too). The upstream zero-variance guard has
 * already filtered out fully-constant series, so
 * stddev > 0 here.
 *
 * Throws if BOTH MAD and stddev are zero (cannot
 * happen given the upstream guard, but kept as a
 * defensive invariant).
 */
function pooledRobustScale(
  pooledSorted: number[],
  pooledMedian: number,
  stddev: number,
): { mad: number; scale: number } {
  const absDevSorted = pooledSorted
    .map((v) => Math.abs(v - pooledMedian))
    .sort((p, q) => p - q);
  const mad = medianSorted(absDevSorted);
  let scale = mad;
  if (scale === 0) scale = stddev;
  if (scale === 0) {
    throw new Error(
      `pooledRobustScale: both MAD and stddev are 0 (n=${pooledSorted.length})`,
    );
  }
  return { mad, scale };
}

/**
 * Mean of pairwise absolute differences within a
 * sorted vector. For sorted v[0..m-1], using the
 * identity sum_{i<j} (v_j - v_i) = sum_j (2j - m + 1)
 * * v_j (1-indexed; equivalently using prefix sums in
 * 0-indexed form), the V-statistic mean
 * (1/m^2) sum_{i,j} |v_i - v_j| collapses to an
 * O(m) computation:
 *
 *     sum_{i<j} (v_j - v_i)
 *       =  sum_{k=0..m-1} (2k - m + 1) * v_k
 *       =  sum_k k*v_k * 2 - (m - 1) * sum_k v_k
 *
 * (1/m^2) * 2 * sum_{i<j} (v_j - v_i) is the desired
 * V-statistic mean (the diagonal i = j contributes 0).
 */
function meanPairwiseAbsSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return 0;
  let weighted = 0;
  let total = 0;
  for (let k = 0; k < m; k += 1) {
    const v = sorted[k]!;
    weighted += k * v;
    total += v;
  }
  // sum_{i<j}(v_j - v_i) = 2*weighted - (m-1)*total.
  const sumPairs = 2 * weighted - (m - 1) * total;
  return (2 * sumPairs) / (m * m);
}

/**
 * Mean of pairwise absolute differences across two
 * sorted vectors aSorted (length n1), bSorted (length
 * n2):  (1 / (n1 * n2)) sum_{i,j} | A_i - B_j |.
 *
 * O(n1 + n2) using the merged-walk identity: when both
 * are sorted, for a fixed A_i the contribution
 * sum_j |A_i - B_j| = (count of B_j < A_i) * A_i -
 * (sum of B_j < A_i) + (sum of B_j >= A_i) -
 * (count of B_j >= A_i) * A_i. Computed via a single
 * sweep with a binary-search-free linear merge.
 */
function meanPairwiseAbsCross(
  aSorted: number[],
  bSorted: number[],
): number {
  const n1 = aSorted.length;
  const n2 = bSorted.length;
  if (n1 === 0 || n2 === 0) {
    throw new Error('meanPairwiseAbsCross: both samples must be non-empty');
  }
  // Precompute cumulative sums of B for O(1) split sums.
  const bCum: number[] = new Array(n2 + 1);
  bCum[0] = 0;
  for (let j = 0; j < n2; j += 1) {
    bCum[j + 1] = bCum[j]! + bSorted[j]!;
  }
  const bTotal = bCum[n2]!;
  // For each A_i find k = number of B_j < A_i via merged walk.
  let k = 0;
  let total = 0;
  for (let i = 0; i < n1; i += 1) {
    const a = aSorted[i]!;
    while (k < n2 && bSorted[k]! < a) k += 1;
    // B_j < a for j in [0, k): contributes a*k - bCum[k].
    // B_j >= a for j in [k, n2): contributes (bTotal - bCum[k]) - a*(n2 - k).
    const lower = a * k - bCum[k]!;
    const upper = bTotal - bCum[k]! - a * (n2 - k);
    total += lower + upper;
  }
  return total / (n1 * n2);
}

/**
 * Energy distance two-sample equality-of-distribution
 * test on the first-half (A = x[0..n1-1]) vs second-
 * half (B = x[n1..n-1]) of a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - E_hat(x + c) === E_hat(x) for any constant c.
 *     A constant added to every value translates both
 *     halves identically; pairwise |.| is unchanged.
 *   - E_hat(a * x) === |a| * E_hat(x) for any a.
 *     The energy kernel d(x,y) = |x-y| is positively
 *     homogeneous of degree 1, and E_hat is a linear
 *     combination of mean pairwise distances.
 *   - E_hat in [0, +inf); enZ in [0, +inf).
 *   - Swapping the two halves leaves E_hat invariant
 *     (E_hat is symmetric in A, B) and negates enDir.
 *   - Under the rescale x -> k*x with k > 0, enE
 *     scales as k * enE and pooledMad scales as
 *     k * pooledMad, so enZ = sqrt(enE)/pooledMad
 *     scales as sqrt(k)/k = 1/sqrt(k) (NOT scale-
 *     invariant). This is the deliberate design
 *     choice for the canonical Szekely-Rizzo energy
 *     effect-size scale: it preserves the unit-
 *     analysis identity enZ ~ sqrt(transport-cost-
 *     in-tokens) / robust-scale-in-tokens. See the
 *     test "enZ scale-invariant under x -> k*x" for
 *     the exact identity enZ(k*x) = enZ(x)/sqrt(k).
 */
export function dailyTokenEnergyDistanceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  enN1: number;
  enN2: number;
  enMedianA: number;
  enMedianB: number;
  enPooledMedian: number;
  enPooledMad: number;
  enE: number;
  enT: number;
  enZ: number;
  enDir: number;
  enZSigned: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenEnergyDistanceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenEnergyDistanceHalves requires finite values',
      );
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenEnergyDistanceHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const enMedianA = medianSorted(aSorted);
  const enMedianB = medianSorted(bSorted);

  const pooledSorted = values.slice().sort((p, q) => p - q);
  const enPooledMedian = medianSorted(pooledSorted);
  const { scale: enPooledMad } = pooledRobustScale(
    pooledSorted,
    enPooledMedian,
    stddev,
  );

  const meanAB = meanPairwiseAbsCross(aSorted, bSorted);
  const meanAA = meanPairwiseAbsSorted(aSorted);
  const meanBB = meanPairwiseAbsSorted(bSorted);
  let enE = 2 * meanAB - meanAA - meanBB;
  // Numerical safety: theoretical floor is 0; clip
  // tiny negative roundoff so sqrt is real.
  if (enE < 0 && enE > -1e-9 * Math.max(1, Math.abs(meanAB))) {
    enE = 0;
  }
  if (enE < 0) {
    throw new Error(
      `dailyTokenEnergyDistanceHalves: negative E_hat=${enE} (n=${n})`,
    );
  }
  const enT = ((n1 * n2) / (n1 + n2)) * enE;
  const enZ = Math.sqrt(enE) / enPooledMad;
  const enDir =
    enMedianB > enMedianA ? 1 : enMedianB < enMedianA ? -1 : 0;
  const enZSigned = enDir * enZ;

  if (
    !Number.isFinite(enE) ||
    !Number.isFinite(enT) ||
    !Number.isFinite(enZ) ||
    !Number.isFinite(enZSigned)
  ) {
    throw new Error(
      `dailyTokenEnergyDistanceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    enN1: n1,
    enN2: n2,
    enMedianA,
    enMedianB,
    enPooledMedian,
    enPooledMad,
    enE,
    enT,
    enZ,
    enDir,
    enZSigned,
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

export function buildDailyTokenEnergyDistanceHalves(
  queue: QueueLine[],
  opts: DailyTokenEnergyDistanceHalvesOptions = {},
): DailyTokenEnergyDistanceHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenEnergyDistanceHalvesSort = opts.sort ?? 'enTDesc';
  const validSorts: DailyTokenEnergyDistanceHalvesSort[] = [
    'enE',
    'enEDesc',
    'enT',
    'enTDesc',
    'enZ',
    'enZDesc',
    'enZSigned',
    'enZSignedDesc',
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
  const rows: DailyTokenEnergyDistanceHalvesSourceRow[] = [];

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
      result = dailyTokenEnergyDistanceHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenEnergyDistanceHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      enN1: result.enN1,
      enN2: result.enN2,
      enMedianA: result.enMedianA,
      enMedianB: result.enMedianB,
      enPooledMedian: result.enPooledMedian,
      enPooledMad: result.enPooledMad,
      enE: result.enE,
      enT: result.enT,
      enZ: result.enZ,
      enDir: result.enDir,
      enZSigned: result.enZSigned,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'enE':
        primary = a.enE - b.enE;
        break;
      case 'enEDesc':
        primary = b.enE - a.enE;
        break;
      case 'enT':
        primary = a.enT - b.enT;
        break;
      case 'enTDesc':
        primary = b.enT - a.enT;
        break;
      case 'enZ':
        primary = a.enZ - b.enZ;
        break;
      case 'enZDesc':
        primary = b.enZ - a.enZ;
        break;
      case 'enZSigned':
        primary = a.enZSigned - b.enZSigned;
        break;
      case 'enZSignedDesc':
        primary = b.enZSigned - a.enZSigned;
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
