/**
 * daily-token-cramer-von-mises-halves: per-source
 * CRAMER-VON MISES TWO-SAMPLE TEST comparing the
 * empirical cumulative distribution functions (ECDFs)
 * of the FIRST half vs SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The Cramer-von Mises two-sample statistic
 * (Anderson 1962, Annals of Mathematical Statistics
 * 33(3):1148-1159) integrates the squared ECDF gap
 * with UNIFORM weight on the pooled ECDF
 * (in CONTRAST to axis-119 Anderson-Darling which
 * weights by 1/(H_N(1-H_N)) and amplifies the tails):
 *
 *     omega2 = ( n1 * n2 / N^2 ) *
 *              integral_{-inf..+inf}
 *                ( F_A(x) - F_B(x) )^2 dH_N(x)
 *
 * where N = n1 + n2 and H_N is the pooled empirical
 * CDF. Anderson 1962 eq. 2 gives the EXACT discrete
 * closed form on pooled ranks:
 *
 *     U = n1 * sum_{i=1..n1} ( r_i - i )^2 +
 *         n2 * sum_{j=1..n2} ( s_j - j )^2
 *
 *     T = U / ( n1 * n2 * N ) -
 *         ( 4 * n1 * n2 - 1 ) / ( 6 * N )
 *
 * where r_1 < r_2 < ... < r_{n1} are the pooled ranks
 * of the SORTED A-sample (i.e. the position in the
 * pooled sorted list, 1-based) and s_1 < ... < s_{n2}
 * are the pooled ranks of the SORTED B-sample.
 * Equivalently (Anderson 1962 eq. 4):
 *
 *     T = ( n1 * n2 / N^2 ) *
 *         sum_{i=1..N} ( F_A(z_i) - F_B(z_i) )^2 / N
 *
 * over the pooled order statistics z_1 <= ... <= z_N.
 * The two are algebraically identical for distinct
 * pooled samples; for ties we use the midrank
 * convention (Schmid & Trede 1995, "A distribution
 * free test for the two sample problem for general
 * alternatives", Computational Statistics & Data
 * Analysis 20(4):409-419), accumulating contributions
 * at the END of each tied plateau.
 *
 * Asymptotic null. Under H0 (both halves drawn from
 * the same continuous distribution F), as
 * n1, n2 -> infinity,
 *
 *     T  ->  W^2_inf
 *
 * with limiting CDF
 *
 *     P( W^2_inf <= t )  =  1 -
 *         (1 / pi) * sum_{j=0..inf}
 *             Gamma(j + 1/2) / ( Gamma(1/2) * j! ) *
 *             sqrt(4 * j + 1) *
 *             exp( -(4 * j + 1)^2 / (16 * t) ) *
 *             K_{1/4}( (4 * j + 1)^2 / (16 * t) )
 *
 * (Anderson & Darling 1952; Csorgo & Faraway 1996,
 * Journal of the Royal Statistical Society B
 * 58(1):221-234). Closed-form moments under H0
 * (Anderson 1962 Theorem 2):
 *
 *     mean_H0  =  1/6  +  1/(6 * N)
 *     var_H0   =  ( N + 1 ) / ( 45 * N^2 ) *
 *                 ( 4 * n1 * n2 * N - 3 * (n1^2 + n2^2)
 *                   - 2 * n1 * n2 ) /
 *                 ( 4 * n1 * n2 )
 *
 * We standardise to a unit-variance score:
 *
 *     cvmT  =  ( T - mean_H0 ) / sqrt( var_H0 )
 *
 * Right-tail p-value. The asymptotic CDF of T under H0
 * has heavy upper tail; standard practice
 * (Csorgo & Faraway 1996; matched by R's
 * `goftest::cvm.test` and SciPy's
 * `scipy.stats.cramervonmises_2samp`) uses Knott 1974
 * / Anderson 1962 Table 1 anchors. We hard-code the
 * Anderson 1962 Table 1 critical values for omega^2
 * (one-sample, valid in the large-N limit also for
 * two-sample):
 *
 *     alpha = 0.25    omega^2 = 0.20939
 *     alpha = 0.10    omega^2 = 0.34730
 *     alpha = 0.05    omega^2 = 0.46136
 *     alpha = 0.025   omega^2 = 0.58061
 *     alpha = 0.01    omega^2 = 0.74346
 *
 * and log-linearly interpolate cvmP from the
 * UNSTANDARDISED T (not cvmT) to match these anchors.
 * For T below the 0.25 anchor we return cvmP = 1;
 * for T above the 0.01 anchor we extrapolate via the
 * slope between the 0.025 and 0.01 anchors. The
 * standardised score cvmT is reported separately for
 * cross-axis comparability.
 *
 * The alpha = 0.05 critical value on the
 * UNSTANDARDISED T is omega^2_{0.05} = 0.46136
 * (Anderson 1962 Table 1).
 *
 * Sign convention. CvM is INTRINSICALLY UNSIGNED
 * (squared L2 deviation between ECDFs). To make the
 * axis cross-comparable with the signed halves tests
 * (115/116/117/118) and the unsigned-with-sign-flag
 * axis-119 AD, we report a directional indicator
 *
 *     cvmDir = sign( median(B) - median(A) )
 *
 * (purely diagnostic; +1 = second-half median larger,
 * -1 = first-half median larger, 0 = tied medians)
 * and a SIGNED z-equivalent
 *
 *     cvmZSigned  =  cvmDir * |cvmT|
 *
 * cvmZSigned is a CONVENTION not a property of the
 * CvM statistic itself; users who want the pure
 * unsigned omnibus score should read T / cvmT / cvmP.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-119:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-
 *     TEST (NONPARAMETRIC ECDF-INTEGRATED-UNWEIGHTED-L2
 *     statistic). Sensitive to ANY distributional
 *     difference between the halves (location, scale,
 *     shape, multimodality, skewness, tails) with
 *     UNIFORM emphasis across the support. This is
 *     the UNWEIGHTED L2 partner to axis-119
 *     Anderson-Darling's TAIL-WEIGHTED L2 and the
 *     INTEGRATED L2 partner to axis-118 KS's
 *     POINTWISE SUP-NORM L_infinity.
 *
 *   - vs axis-119 daily-token-anderson-darling-halves.
 *     AD weights the squared ECDF gap by
 *     1/(H_N (1 - H_N)) which EXPLODES near 0 and 1:
 *     a half whose extreme order statistics differ
 *     from the other half is amplified in AD even
 *     when the central ECDFs agree. CvM uses UNIFORM
 *     weight on dH_N: the same tail discrepancy
 *     contributes proportionally to its mass under
 *     the pooled distribution, NOT to its inverse-
 *     variance distance from the median. They are
 *     NOT a monotone transform of each other:
 *     constructing two halves with identical CvM
 *     statistic but different AD statistic is easy
 *     by repositioning a fixed mass-discrepancy
 *     between the bulk and the tails.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS uses the SUPREMUM of |F_A - F_B| with UNIFORM
 *     weight on the support: a single tall pointwise
 *     spike dominates and the rest of the curve is
 *     ignored. CvM INTEGRATES the squared gap over
 *     the pooled measure: many small pointwise gaps
 *     accumulate to a large CvM statistic that KS
 *     would miss, while a single localised spike that
 *     drives KS contributes only the area under one
 *     small bump in CvM. They are NOT a monotone
 *     transform: a step-shifted half has CvM
 *     proportional to the squared shift integrated
 *     over the bulk, while KS sees only the maximum
 *     vertical gap.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is a NONPARAMETRIC RANK-SUM on
 *     OUTWARD-PAIR ranks AFTER median-centring,
 *     sensitive ONLY to SCALE shift. CvM compares
 *     the PRE-CENTRED ECDFs; a clean step-shift in
 *     median gives stZ approx 0 but T large.
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Brown-Forsythe is a PARAMETRIC F-test on
 *     ABSOLUTE deviations from per-half medians,
 *     sensitive ONLY to SCALE shift. CvM detects
 *     scale shift among other things but also
 *     detects skewness and tail-mass differences
 *     invisible to Brown-Forsythe.
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney detects a LOCATION/STOCHASTIC-
 *     DOMINANCE shift via the integral
 *     int F_A dF_B - 1/2. CvM detects ANY ECDF gap
 *     with UNIFORM emphasis. Two distributions with
 *     EQUAL MEDIANS but different shape give
 *     mwZ approx 0 but T large (and vice versa: a
 *     clean stochastic dominance with proportional
 *     ECDFs gives mwZ large and T moderate).
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a multi-lag squared-autocorrelation
 *     PORTMANTEAU sensitive to SERIAL STRUCTURE
 *     (within-half ORDER matters). CvM is fully
 *     PERMUTATION-INVARIANT WITHIN each half; only
 *     the multiset of values per half matters.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Permutation-invariant functionals
 *     of the EMPIRICAL DISTRIBUTION computed on the
 *     WHOLE series. CvM is also permutation-invariant
 *     within each half but depends on WHICH half each
 *     value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), build their empirical
 *   CDFs F_A and F_B, and compute the Cramer-von Mises
 *   two-sample statistic T (Anderson 1962) which
 *   integrates the squared ECDF gap with uniform
 *   weight on the pooled ECDF, does T exceed the
 *   Anderson 1962 alpha = 0.05 critical value
 *   omega^2_{0.05} = 0.46136?"**
 *
 * Reference:
 *   Anderson, T. W., "On the Distribution of the
 *     Two-Sample Cramer-von Mises Criterion",
 *     The Annals of Mathematical Statistics 33(3)
 *     (1962), pp. 1148-1159.
 *   Csorgo, S. and Faraway, J. J., "The exact and
 *     asymptotic distributions of Cramer-von Mises
 *     statistics", Journal of the Royal Statistical
 *     Society B 58(1) (1996), pp. 221-234.
 *   Schmid, F. and Trede, M., "A distribution free
 *     test for the two sample problem for general
 *     alternatives", Computational Statistics & Data
 *     Analysis 20(4) (1995), pp. 409-419.
 *
 * Caveats:
 *
 *   - T in [0, +inf). cvmT in (-inf, +inf) but
 *     typically cvmT >= -1. cvmP in (0, 1].
 *   - The Anderson 1962 standardisation assumes
 *     continuous F; the discrete gap-filled token
 *     series (many exact zeros) makes the test
 *     CONSERVATIVE (slightly under-rejects). Adequate
 *     for cross-source ranking.
 *   - Tied pooled values are handled by the midrank
 *     convention: contributions at tied plateaux are
 *     evaluated only at the END of each plateau using
 *     the running rank counts, matching Schmid & Trede
 *     1995.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115/116/117/118/119). Hard floor
 *     n >= 8 so the asymptotic standardisation is in
 *     its calibrated regime.
 *   - All-equal series filtered upstream by
 *     zero-variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-cramer-von-mises-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-cramer-von-mises-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute CvM statistic descending:
 *   pew-insights daily-token-cramer-von-mises-halves \
 *     --sort cvmTDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenCramerVonMisesHalvesSort =
  | 'cvmStat'
  | 'cvmStatDesc'
  | 'cvmT'
  | 'cvmTDesc'
  | 'cvmZSigned'
  | 'cvmZSignedDesc'
  | 'cvmP'
  | 'cvmPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCramerVonMisesHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (Anderson 1962 calibrated regime
   * for the asymptotic CvM null).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCramerVonMisesHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenCramerVonMisesHalvesSourceRow {
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
  cvmN1: number;
  /** Second-half size n2 = n - n1. */
  cvmN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  cvmMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  cvmMedianB: number;
  /** Cramer-von Mises two-sample statistic T (Anderson 1962 eq. 2). */
  cvmStat: number;
  /** H0 mean of T (Anderson 1962 Theorem 2). */
  cvmMeanH0: number;
  /** H0 variance of T (Anderson 1962 Theorem 2). */
  cvmVarH0: number;
  /** Standardised score cvmT = (T - meanH0) / sqrt(varH0). */
  cvmT: number;
  /** Right-tail p-value (Anderson 1962 Table 1 interp on T). */
  cvmP: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  cvmDir: number;
  /** Signed z-equivalent: cvmDir * |cvmT|. */
  cvmZSigned: number;
  /** alpha = 0.05 critical value on T (Anderson 1962 Table 1). */
  cvmStatCrit05: number;
}

export interface DailyTokenCramerVonMisesHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCramerVonMisesHalvesSort;
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
  sources: DailyTokenCramerVonMisesHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Anderson 1962 Table 1 right-tail interpolation for
 * the UNSTANDARDISED CvM statistic T. Returns an
 * approximate one-sided right-tail p-value.
 *
 * Anchor critical values (Anderson 1962 Table 1,
 * one-sample omega^2; valid in the two-sample
 * limiting null distribution):
 *
 *     alpha = 0.25   T = 0.20939
 *     alpha = 0.10   T = 0.34730
 *     alpha = 0.05   T = 0.46136
 *     alpha = 0.025  T = 0.58061
 *     alpha = 0.01   T = 0.74346
 *
 * For T below 0.20939 we return p = 1. For T above
 * 0.74346 we extrapolate via a single exponential
 * decay matching the slope between the 0.025 and
 * 0.01 anchors:
 *
 *     log p  approx  log(0.025) + (T - 0.58061) *
 *                    (log(0.01) - log(0.025)) /
 *                    (0.74346 - 0.58061)
 */
const ANDERSON_1962_TABLE_1_T = [
  0.20939, 0.3473, 0.46136, 0.58061, 0.74346,
] as const;
const ANDERSON_1962_TABLE_1_P = [0.25, 0.1, 0.05, 0.025, 0.01] as const;
const ANDERSON_1962_TABLE_1_T_CRIT_05 = ANDERSON_1962_TABLE_1_T[2];

function cramerVonMisesP(T: number): number {
  if (!Number.isFinite(T) || T <= ANDERSON_1962_TABLE_1_T[0]) return 1;
  const ts = ANDERSON_1962_TABLE_1_T;
  const ps = ANDERSON_1962_TABLE_1_P;
  if (T >= ts[ts.length - 1]!) {
    const t1 = ts[ts.length - 2]!;
    const t2 = ts[ts.length - 1]!;
    const lp1 = Math.log(ps[ps.length - 2]!);
    const lp2 = Math.log(ps[ps.length - 1]!);
    const slope = (lp2 - lp1) / (t2 - t1);
    const lp = lp2 + (T - t2) * slope;
    const p = Math.exp(lp);
    return p > 1 ? 1 : p < 0 ? 0 : p;
  }
  for (let k = 0; k < ts.length - 1; k += 1) {
    if (T >= ts[k]! && T < ts[k + 1]!) {
      const t1 = ts[k]!;
      const t2 = ts[k + 1]!;
      const lp1 = Math.log(ps[k]!);
      const lp2 = Math.log(ps[k + 1]!);
      const lp = lp1 + ((T - t1) * (lp2 - lp1)) / (t2 - t1);
      const p = Math.exp(lp);
      return p > 1 ? 1 : p < 0 ? 0 : p;
    }
  }
  return 1;
}

/**
 * Cramer-von Mises two-sample equality-of-distribution
 * test on the first-half (A = x[0..n1-1]) vs second-
 * half (B = x[n1..n-1]) of a real-valued series.
 *
 * Computes T via the Anderson 1962 closed form on
 * pooled ranks, then standardises via Anderson 1962
 * Theorem 2 closed-form H0 moments.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - T(x + c) === T(x) for any constant c.
 *     A constant added to every value translates both
 *     ECDFs identically; the integrated L2 gap is
 *     unchanged.
 *   - T(a * x) === T(x) for any a > 0 (rank order
 *     preserved). For a < 0 the rank order REVERSES;
 *     T is unchanged (the squared gap is symmetric);
 *     cvmDir flips.
 *   - For x = repeat(constant) the test is undefined
 *     (zero variance, both ECDFs identical step
 *     functions); we throw to be filtered upstream.
 *   - T in [0, +inf); cvmP in (0, 1].
 *   - Swapping the two halves leaves T invariant
 *     (ECDF gap is squared) and negates cvmDir.
 */
export function dailyTokenCramerVonMisesHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  cvmN1: number;
  cvmN2: number;
  cvmMedianA: number;
  cvmMedianB: number;
  cvmStat: number;
  cvmMeanH0: number;
  cvmVarH0: number;
  cvmT: number;
  cvmP: number;
  cvmDir: number;
  cvmZSigned: number;
  cvmStatCrit05: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenCramerVonMisesHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenCramerVonMisesHalves requires finite values',
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
      `dailyTokenCramerVonMisesHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const N = n1 + n2;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const cvmMedianA = medianSorted(aSorted);
  const cvmMedianB = medianSorted(bSorted);

  // Pool with provenance tag. Stable sort by value.
  // For tied pooled values we use the MIDRANK
  // convention (Schmid & Trede 1995): every tied
  // element receives the average of the ranks the
  // plateau spans. This matches scipy.stats.
  // cramervonmises_2samp's tie handling.
  type Tagged = { v: number; t: 0 | 1; rank: number };
  const pool: Tagged[] = new Array(N);
  for (let i = 0; i < n1; i += 1) {
    pool[i] = { v: aSorted[i]!, t: 0, rank: 0 };
  }
  for (let j = 0; j < n2; j += 1) {
    pool[n1 + j] = { v: bSorted[j]!, t: 1, rank: 0 };
  }
  pool.sort((p, q) => p.v - q.v);

  // Assign midranks across tied plateaux.
  let idx = 0;
  while (idx < N) {
    let end = idx;
    while (end < N && pool[end]!.v === pool[idx]!.v) end += 1;
    // ranks for positions [idx..end-1] are
    // [idx+1, idx+2, ..., end] (1-based); mean is
    // (idx + 1 + end) / 2.
    const meanRank = (idx + 1 + end) / 2;
    for (let k = idx; k < end; k += 1) pool[k]!.rank = meanRank;
    idx = end;
  }

  // Collect per-sample sorted ranks (already sorted
  // because we sorted by value and then assigned
  // ranks in that order; we just split by tag).
  const ranksA: number[] = [];
  const ranksB: number[] = [];
  for (const p of pool) {
    if (p.t === 0) ranksA.push(p.rank);
    else ranksB.push(p.rank);
  }
  // After splitting by tag the within-tag order is
  // pooled-sorted order, which is exactly the order
  // r_1 < r_2 < ... < r_{n1} (and similarly s) that
  // Anderson 1962 eq. 2 calls for.

  let sumA = 0;
  for (let i = 0; i < n1; i += 1) {
    const d = ranksA[i]! - (i + 1);
    sumA += d * d;
  }
  let sumB = 0;
  for (let j = 0; j < n2; j += 1) {
    const d = ranksB[j]! - (j + 1);
    sumB += d * d;
  }
  const U = n1 * sumA + n2 * sumB;
  const cvmStat =
    U / (n1 * n2 * N) - (4 * n1 * n2 - 1) / (6 * N);

  // Anderson 1962 Theorem 2 H0 moments.
  const cvmMeanH0 = 1 / 6 + 1 / (6 * N);
  const numerator =
    4 * n1 * n2 * N - 3 * (n1 * n1 + n2 * n2) - 2 * n1 * n2;
  const cvmVarH0 =
    ((N + 1) / (45 * N * N)) * (numerator / (4 * n1 * n2));
  const cvmT = (cvmStat - cvmMeanH0) / Math.sqrt(cvmVarH0);
  const cvmP = cramerVonMisesP(cvmStat);
  const cvmDir =
    cvmMedianB > cvmMedianA ? 1 : cvmMedianB < cvmMedianA ? -1 : 0;
  const cvmZSigned = cvmDir * Math.abs(cvmT);
  const cvmStatCrit05 = ANDERSON_1962_TABLE_1_T_CRIT_05;

  if (
    !Number.isFinite(cvmStat) ||
    !Number.isFinite(cvmT) ||
    !Number.isFinite(cvmP)
  ) {
    throw new Error(
      `dailyTokenCramerVonMisesHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    cvmN1: n1,
    cvmN2: n2,
    cvmMedianA,
    cvmMedianB,
    cvmStat,
    cvmMeanH0,
    cvmVarH0,
    cvmT,
    cvmP,
    cvmDir,
    cvmZSigned,
    cvmStatCrit05,
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

export function buildDailyTokenCramerVonMisesHalves(
  queue: QueueLine[],
  opts: DailyTokenCramerVonMisesHalvesOptions = {},
): DailyTokenCramerVonMisesHalvesReport {
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
  const sort: DailyTokenCramerVonMisesHalvesSort = opts.sort ?? 'cvmStatDesc';
  const validSorts: DailyTokenCramerVonMisesHalvesSort[] = [
    'cvmStat',
    'cvmStatDesc',
    'cvmT',
    'cvmTDesc',
    'cvmZSigned',
    'cvmZSignedDesc',
    'cvmP',
    'cvmPDesc',
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
  const rows: DailyTokenCramerVonMisesHalvesSourceRow[] = [];

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
      result = dailyTokenCramerVonMisesHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenCramerVonMisesHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      cvmN1: result.cvmN1,
      cvmN2: result.cvmN2,
      cvmMedianA: result.cvmMedianA,
      cvmMedianB: result.cvmMedianB,
      cvmStat: result.cvmStat,
      cvmMeanH0: result.cvmMeanH0,
      cvmVarH0: result.cvmVarH0,
      cvmT: result.cvmT,
      cvmP: result.cvmP,
      cvmDir: result.cvmDir,
      cvmZSigned: result.cvmZSigned,
      cvmStatCrit05: result.cvmStatCrit05,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'cvmStat':
        primary = a.cvmStat - b.cvmStat;
        break;
      case 'cvmStatDesc':
        primary = b.cvmStat - a.cvmStat;
        break;
      case 'cvmT':
        primary = a.cvmT - b.cvmT;
        break;
      case 'cvmTDesc':
        primary = b.cvmT - a.cvmT;
        break;
      case 'cvmZSigned':
        primary = a.cvmZSigned - b.cvmZSigned;
        break;
      case 'cvmZSignedDesc':
        primary = b.cvmZSigned - a.cvmZSigned;
        break;
      case 'cvmP':
        primary = a.cvmP - b.cvmP;
        break;
      case 'cvmPDesc':
        primary = b.cvmP - a.cvmP;
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
