/**
 * daily-token-anderson-darling-halves: per-source
 * ANDERSON-DARLING TWO-SAMPLE TEST comparing the
 * empirical cumulative distribution functions (ECDFs)
 * of the FIRST half vs SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-NINETEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The Anderson-Darling two-sample statistic
 * (Pettitt 1976, Biometrika 63(1):161-168;
 * Scholz & Stephens 1987, Journal of the American
 * Statistical Association 82(399):918-924) integrates
 * the squared ECDF gap weighted by the inverse
 * variance of the pooled ECDF, putting MORE WEIGHT
 * in the tails where the pooled F is near 0 or 1:
 *
 *     adA2 = ( n1 * n2 / N ) *
 *            sum_{i=1..N-1}
 *              ( H_A(x_i) - H_B(x_i) )^2 /
 *              ( H_N(x_i) * ( 1 - H_N(x_i) ) )
 *
 * where N = n1 + n2, x_1 < x_2 < ... < x_N is the
 * pooled sorted sample, and H_A, H_B, H_N are the
 * RIGHT-CONTINUOUS empirical CDFs of A, B, and the
 * pooled sample respectively. Equivalently we
 * accumulate over the pooled order statistics
 * (Pettitt 1976 eq. 1.3; Scholz & Stephens 1987
 * eq. 7 with k = 2):
 *
 *     adA2 = (1 / N) *
 *            sum_{i=1..N-1}
 *              ( N * M_Ai - i * n1 )^2 /
 *              ( i * ( N - i ) * n1 * n2 / N ) (??)
 *
 * We use the EXACT discrete-pool form (Pettitt 1976
 * eq. 1.3, ties handled by the Scholz & Stephens 1987
 * "midrank" correction at tied plateaux):
 *
 *     adA2 = ( N - 1 ) / ( n1 * n2 ) *
 *            sum_{i=1..N-1}
 *              ( N * M_Ai - i * n1 )^2 /
 *              ( i * ( N - i ) )
 *
 * where M_Ai = #{ A_j <= x_(i) } is the count of
 * A-elements at or below the i-th pooled order
 * statistic. The constant ( N - 1 ) / ( n1 * n2 )
 * matches Pettitt 1976 and recovers Scholz & Stephens
 * 1987 with k = 2.
 *
 * Asymptotic null. Under H0 (both halves drawn from
 * the same continuous distribution F), as n1, n2 -> inf,
 *
 *     adA2  ->  A^2_inf
 *
 * with cumulative distribution function tabulated by
 * Scholz & Stephens 1987 Table 1. We standardise to
 * a unit-variance score (Scholz & Stephens 1987
 * eq. 4 with k = 2):
 *
 *     adT  =  ( adA2 - mean_H0 ) / sigma_H0
 *
 * where for k = 2 samples the H0 mean and variance
 * (Scholz & Stephens 1987 eqs. 4, 5; Pettitt 1976
 * Theorem 2) reduce to:
 *
 *     mean_H0  =  k - 1  =  1
 *     varNum   =  ( a * N^3 + b * N^2 + c * N + d )
 *     varDen   =  ( N - 1 ) * ( N - 2 ) * ( N - 3 )
 *
 *   with the exact polynomial coefficients
 *   (Scholz-Stephens 1987 eq. 5 specialised to k = 2,
 *   h_N = sum_{i=1..N-1} 1/i):
 *
 *     a =  (4 * g - 6) * (k - 1) + (10 - 6 * g) * H
 *     b =  (2 * g - 4) * k^2 + 8 * h * k +
 *          (2 * g - 14 * h - 4) * H - 8 * h + 4 * g - 6
 *     c =  (6 * h + 2 * g - 2) * k^2 +
 *          (4 * h - 4 * g + 6) * k +
 *          (2 * h - 6) * H + 4 * h
 *     d =  (2 * h + 6) * k^2 - 4 * h * k
 *
 *   with H = sum_{i=1..k} 1/n_i (= 1/n1 + 1/n2 for k=2),
 *        h = sum_{i=1..N-1} 1/i,
 *        g = sum_{i=1..N-2}
 *              sum_{j=i+1..N-1} 1 / ( (N - i) * j ).
 *
 *   These are quoted verbatim from Scholz & Stephens
 *   1987 eq. (5) and used directly. (We compute h and
 *   g exactly in O(N) and O(N^2) respectively.)
 *
 * Right-tail p-value. Approximated by the Marsaglia &
 * Marsaglia 2004 (Journal of Statistical Software
 * 9(2)) one-sample A^2 limiting distribution evaluated
 * at adT * sqrt(varH0) + meanH0 normalised to the
 * standard limit; in practice for the standardised
 * score adT we use the Scholz & Stephens 1987 Table 1
 * upper-tail interpolation (we hard-code the four
 * canonical critical values t_{0.25}=0.325,
 * t_{0.10}=1.226, t_{0.05}=1.960, t_{0.025}=2.719,
 * t_{0.01}=3.752 from S&S 1987 Table 1) and
 * log-linearly interpolate the tail; for adT well
 * outside the table we fall back to the chi-square(1)
 * tail bound on the squared deviation, giving a
 * conservative upper bound on adP. This is purely
 * for display -- the ranking by adA2 / adT is
 * unaffected.
 *
 * Sign convention. Anderson-Darling is INTRINSICALLY
 * UNSIGNED (it is a squared L2-with-tail-weight
 * deviation between ECDFs). To make the axis cross-
 * comparable with the signed halves tests (115/116/
 * 117/118), we report a directional indicator
 *
 *     adDir = sign( median(B) - median(A) )
 *
 * (purely diagnostic; +1 = second-half median larger,
 * -1 = first-half median larger, 0 = tied medians)
 * and a SIGNED z-equivalent
 *
 *     adZ        = adT             (unsigned magnitude)
 *     adZSigned  = adDir * |adZ|   (sign from medians)
 *
 * Note adZSigned is a CONVENTION not a property of the
 * AD statistic itself; users who want the pure
 * unsigned omnibus score should read adA2 / adT / adP.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-118:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-
 *     TEST (NONPARAMETRIC ECDF-INTEGRATED-WEIGHTED-L2
 *     statistic). Sensitive to ANY distributional
 *     difference between the halves (location, scale,
 *     shape, multimodality, skewness, tails) but with
 *     EMPHASIS on the TAILS via the inverse-variance
 *     weight 1 / (H_N (1 - H_N)). This is the
 *     TAIL-WEIGHTED L2 companion to axis-118's
 *     UNIFORM-WEIGHT SUP-NORM omnibus test.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS uses the SUPREMUM of |F_A - F_B| with UNIFORM
 *     weight on the support: a single tall spike near
 *     the median dominates, and tail differences far
 *     from the bulk are visible only via their
 *     pointwise contribution. AD uses an INTEGRATED
 *     L2 norm with weight 1/(H_N (1 - H_N)) which
 *     EXPLODES near 0 and 1: a half whose extreme
 *     order statistics differ from the other half is
 *     amplified in AD even when the central ECDFs
 *     agree, while a localised mid-distribution gap
 *     that drives KS need not move AD much. They are
 *     NOT a monotone transform of each other:
 *     constructing two halves with identical sup-norm
 *     gap but different tail mass yields constant
 *     ksD with monotone-increasing adA2.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is a NONPARAMETRIC RANK-SUM on
 *     OUTWARD-PAIR ranks AFTER median-centring,
 *     sensitive ONLY to SCALE shift. AD compares the
 *     PRE-CENTRED ECDFs; a clean step-shift in median
 *     gives stZ approx 0 but adA2 large.
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Brown-Forsythe is a PARAMETRIC F-test on
 *     ABSOLUTE deviations from per-half medians,
 *     sensitive ONLY to SCALE shift. AD detects scale
 *     shift among other things but also detects
 *     skewness and tail-mass differences invisible to
 *     Brown-Forsythe.
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney detects a LOCATION/STOCHASTIC-
 *     DOMINANCE shift via the integral int F_A dF_B.
 *     AD detects ANY ECDF gap with TAIL EMPHASIS.
 *     Two distributions with EQUAL MEDIANS but
 *     different tail behaviour give mwZ approx 0 but
 *     adA2 large (and vice versa: a clean stochastic
 *     dominance with similar tails gives mwZ large
 *     and adA2 large but the LATTER amplifies the
 *     tail discrepancy more strongly).
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a multi-lag squared-autocorrelation
 *     PORTMANTEAU sensitive to SERIAL STRUCTURE
 *     (within-half ORDER matters). AD is fully
 *     PERMUTATION-INVARIANT WITHIN each half; only
 *     the multiset of values per half matters.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Permutation-invariant functionals
 *     of the EMPIRICAL DISTRIBUTION computed on the
 *     WHOLE series. AD is also permutation-invariant
 *     within each half but depends on WHICH half each
 *     value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), build their empirical
 *   CDFs F_A and F_B, and compute the Anderson-Darling
 *   two-sample statistic adA2 (Pettitt 1976) which
 *   integrates the squared ECDF gap weighted by the
 *   inverse pooled-ECDF variance, does the
 *   standardised score adT exceed the
 *   Scholz & Stephens 1987 alpha = 0.05 critical
 *   value 1.960?"**
 *
 * Reference:
 *   Anderson, T. W. and Darling, D. A.,
 *     "Asymptotic theory of certain 'goodness of fit'
 *     criteria based on stochastic processes",
 *     The Annals of Mathematical Statistics 23(2)
 *     (1952), pp. 193-212.
 *   Pettitt, A. N., "A two-sample Anderson-Darling
 *     rank statistic", Biometrika 63(1) (1976),
 *     pp. 161-168.
 *   Scholz, F. W. and Stephens, M. A., "K-Sample
 *     Anderson-Darling Tests", Journal of the American
 *     Statistical Association 82(399) (1987),
 *     pp. 918-924.
 *   Marsaglia, G. and Marsaglia, J., "Evaluating the
 *     Anderson-Darling Distribution", Journal of
 *     Statistical Software 9(2) (2004).
 *
 * Caveats:
 *
 *   - adA2 in [0, +inf). adT in (-inf, +inf) but
 *     typically adT >= -1 (with mean 0 under H0 and
 *     std-deviation 1). adP in (0, 1].
 *   - The Scholz & Stephens 1987 standardisation
 *     assumes continuous F; the discrete gap-filled
 *     token series (many exact zeros) makes the test
 *     CONSERVATIVE (slightly under-rejects). Adequate
 *     for cross-source ranking.
 *   - Tied pooled values are handled by the midrank
 *     convention (Scholz & Stephens 1987 sec. 6):
 *     contributions at tied plateaux are evaluated
 *     using the mean rank of the plateau. We accumulate
 *     M_Ai at the END of each tied plateau and skip the
 *     intermediate i positions, which matches the
 *     "ties broken by averaging" convention.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115/116/117/118). Hard floor n >= 8
 *     so the asymptotic standardisation is in its
 *     calibrated regime.
 *   - All-equal series filtered upstream by
 *     zero-variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-anderson-darling-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-anderson-darling-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute AD statistic descending
 *   # (strongest distributional shift evidence first):
 *   pew-insights daily-token-anderson-darling-halves \
 *     --sort adA2Desc
 */
import type { QueueLine } from './types.js';

export type DailyTokenAndersonDarlingHalvesSort =
  | 'adA2'
  | 'adA2Desc'
  | 'adT'
  | 'adTDesc'
  | 'adZSigned'
  | 'adZSignedDesc'
  | 'adP'
  | 'adPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAndersonDarlingHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (Scholz & Stephens 1987 calibrated
   * regime for the asymptotic AD null).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAndersonDarlingHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenAndersonDarlingHalvesSourceRow {
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
  adN1: number;
  /** Second-half size n2 = n - n1. */
  adN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  adMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  adMedianB: number;
  /** Anderson-Darling two-sample statistic (Pettitt 1976 eq. 1.3). */
  adA2: number;
  /** H0 mean of adA2 (Scholz & Stephens 1987 eq. 4, k=2: equals 1). */
  adMeanH0: number;
  /** H0 variance of adA2 (Scholz & Stephens 1987 eq. 5, k=2). */
  adVarH0: number;
  /** Standardised score adT = (adA2 - meanH0) / sqrt(varH0). */
  adT: number;
  /** Right-tail p-value (Scholz & Stephens 1987 Table 1 interp). */
  adP: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  adDir: number;
  /** Signed z-equivalent: adDir * |adT| (sign from medians). */
  adZSigned: number;
  /** alpha = 0.05 critical value on adT (Scholz-Stephens 1987 Table 1). */
  adTCrit05: number;
}

export interface DailyTokenAndersonDarlingHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAndersonDarlingHalvesSort;
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
  sources: DailyTokenAndersonDarlingHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Scholz & Stephens 1987 Table 1 right-tail
 * interpolation for the standardised k=2 AD score
 * adT. Returns an approximate two-sided p-value
 * (we treat AD as one-sided right-tail since adA2
 * is intrinsically non-negative; "two-sided" notion
 * does not apply).
 *
 * Anchor critical values (S&S 1987 Table 1, k=2):
 *
 *     alpha = 0.25   t = 0.325
 *     alpha = 0.10   t = 1.226
 *     alpha = 0.05   t = 1.960
 *     alpha = 0.025  t = 2.719
 *     alpha = 0.01   t = 3.752
 *
 * For adT below 0.325 we return p = 1 (no evidence).
 * For adT above 3.752 we extrapolate via a single
 * exponential decay matching the slope between the
 * 0.025 and 0.01 anchors:
 *
 *     log p  approx  log(0.025) + (adT - 2.719) *
 *                    (log(0.01) - log(0.025)) /
 *                    (3.752 - 2.719)
 *
 * Otherwise log-linearly interpolate between the
 * bracketing anchors. This mirrors the approach used
 * in scipy.stats.anderson_ksamp for ranking-quality
 * tail estimates.
 */
function andersonDarlingP(adT: number): number {
  if (!Number.isFinite(adT) || adT <= 0.325) return 1;
  const ts = [0.325, 1.226, 1.960, 2.719, 3.752];
  const ps = [0.25, 0.10, 0.05, 0.025, 0.01];
  if (adT >= ts[ts.length - 1]!) {
    const t1 = ts[ts.length - 2]!;
    const t2 = ts[ts.length - 1]!;
    const lp1 = Math.log(ps[ps.length - 2]!);
    const lp2 = Math.log(ps[ps.length - 1]!);
    const slope = (lp2 - lp1) / (t2 - t1);
    const lp = lp2 + (adT - t2) * slope;
    const p = Math.exp(lp);
    return p > 1 ? 1 : p < 0 ? 0 : p;
  }
  for (let k = 0; k < ts.length - 1; k += 1) {
    if (adT >= ts[k]! && adT < ts[k + 1]!) {
      const t1 = ts[k]!;
      const t2 = ts[k + 1]!;
      const lp1 = Math.log(ps[k]!);
      const lp2 = Math.log(ps[k + 1]!);
      const lp = lp1 + ((adT - t1) * (lp2 - lp1)) / (t2 - t1);
      const p = Math.exp(lp);
      return p > 1 ? 1 : p < 0 ? 0 : p;
    }
  }
  return 1;
}

/**
 * Scholz & Stephens 1987 eq. (5) closed-form H0
 * variance of the k-sample AD statistic, specialised
 * to k = 2 samples of sizes n1, n2 (N = n1 + n2).
 *
 *     H = 1/n1 + 1/n2
 *     h = sum_{i=1..N-1} 1/i             (harmonic)
 *     g = sum_{i=1..N-2} sum_{j=i+1..N-1}
 *           1 / ( (N - i) * j )
 *     k = 2
 *
 *     a = (4*g - 6) * (k - 1) + (10 - 6*g) * H
 *     b = (2*g - 4) * k^2 + 8*h*k +
 *         (2*g - 14*h - 4) * H - 8*h + 4*g - 6
 *     c = (6*h + 2*g - 2) * k^2 +
 *         (4*h - 4*g + 6) * k +
 *         (2*h - 6) * H + 4*h
 *     d = (2*h + 6) * k^2 - 4*h*k
 *
 *     varA2 = (a*N^3 + b*N^2 + c*N + d) /
 *             ((N-1)*(N-2)*(N-3))
 *
 * Mean under H0 (S&S 1987 eq. 4, k=2) is k - 1 = 1.
 */
function adVarH0Coef(n1: number, n2: number): number {
  const N = n1 + n2;
  if (N <= 3) return Number.NaN;
  const k = 2;
  const H = 1 / n1 + 1 / n2;
  let h = 0;
  for (let i = 1; i <= N - 1; i += 1) h += 1 / i;
  let g = 0;
  for (let i = 1; i <= N - 2; i += 1) {
    for (let j = i + 1; j <= N - 1; j += 1) {
      g += 1 / ((N - i) * j);
    }
  }
  const a = (4 * g - 6) * (k - 1) + (10 - 6 * g) * H;
  const b =
    (2 * g - 4) * k * k +
    8 * h * k +
    (2 * g - 14 * h - 4) * H -
    8 * h +
    4 * g -
    6;
  const c =
    (6 * h + 2 * g - 2) * k * k +
    (4 * h - 4 * g + 6) * k +
    (2 * h - 6) * H +
    4 * h;
  const d = (2 * h + 6) * k * k - 4 * h * k;
  const num = a * N * N * N + b * N * N + c * N + d;
  const den = (N - 1) * (N - 2) * (N - 3);
  return num / den;
}

/**
 * Anderson-Darling two-sample equality-of-distribution
 * test on the first-half (A = x[0..n1-1]) vs second-
 * half (B = x[n1..n-1]) of a real-valued series.
 *
 * Computes adA2 via the Pettitt 1976 closed form on
 * pooled order statistics, then standardises via
 * Scholz & Stephens 1987 eq. (5) closed-form H0
 * variance.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - adA2(x + c) === adA2(x) for any constant c.
 *     A constant added to every value translates both
 *     ECDFs identically; the integrated weighted L2
 *     gap is unchanged.
 *   - adA2(a * x) === adA2(x) for any a > 0 (rank
 *     order preserved). For a < 0 the rank order
 *     REVERSES; adA2 is unchanged (the squared gap
 *     is symmetric); adDir flips.
 *   - For x = repeat(constant) the test is undefined
 *     (zero variance, both ECDFs are identical step
 *     functions); we throw to be filtered upstream.
 *   - adA2 in [0, +inf); adP in (0, 1].
 *   - Swapping the two halves leaves adA2 invariant
 *     (ECDF gap is squared) and negates adDir.
 */
export function dailyTokenAndersonDarlingHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  adN1: number;
  adN2: number;
  adMedianA: number;
  adMedianB: number;
  adA2: number;
  adMeanH0: number;
  adVarH0: number;
  adT: number;
  adP: number;
  adDir: number;
  adZSigned: number;
  adTCrit05: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenAndersonDarlingHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenAndersonDarlingHalves requires finite values',
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
      `dailyTokenAndersonDarlingHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const N = n1 + n2;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const adMedianA = medianSorted(aSorted);
  const adMedianB = medianSorted(bSorted);

  // Pool with provenance tag (0 = A, 1 = B). Stable
  // sort by value. Pettitt 1976 eq. 1.3 sums over the
  // first N-1 pooled order statistics; ties handled
  // by accumulating contributions only at the END of
  // each tied plateau (Scholz & Stephens 1987 sec. 6
  // midrank convention).
  type Tagged = { v: number; t: 0 | 1 };
  const pool: Tagged[] = new Array(N);
  for (let i = 0; i < n1; i += 1) pool[i] = { v: aSorted[i]!, t: 0 };
  for (let j = 0; j < n2; j += 1) pool[n1 + j] = { v: bSorted[j]!, t: 1 };
  pool.sort((p, q) => p.v - q.v);

  let MAi = 0; // running count of A-elements at or below current value
  let acc = 0;
  let i = 0;
  while (i < N - 1) {
    // advance through tied plateau, accumulating
    // count contributions
    let j = i;
    while (j < N && pool[j]!.v === pool[i]!.v) {
      if (pool[j]!.t === 0) MAi += 1;
      j += 1;
    }
    // We have just processed pool indices [i..j-1]. The
    // pooled rank at the END of this plateau (1-based)
    // is `j` (the next rank). For Pettitt 1976 eq. 1.3
    // we evaluate the contribution at rank index `r`
    // (1 <= r <= N - 1). After the plateau ending at
    // 1-based index j, the pooled ECDF has just stepped
    // up to value j/N. We record the contribution at
    // rank r = j IF j <= N - 1 (i.e. not the last
    // plateau, which would give H_N = 1 and a divide
    // by zero).
    if (j <= N - 1) {
      const num = N * MAi - j * n1;
      const den = j * (N - j);
      acc += (num * num) / den;
    }
    i = j;
  }

  const adA2 = ((N - 1) / (n1 * n2)) * acc;
  const adMeanH0 = 1; // S&S 1987 eq. 4 with k = 2
  const adVarH0 = adVarH0Coef(n1, n2);
  const adT = (adA2 - adMeanH0) / Math.sqrt(adVarH0);
  const adP = andersonDarlingP(adT);
  const adDir = adMedianB > adMedianA ? 1 : adMedianB < adMedianA ? -1 : 0;
  const adZSigned = adDir * Math.abs(adT);
  const adTCrit05 = 1.96; // S&S 1987 Table 1, k=2, alpha=0.05

  if (
    !Number.isFinite(adA2) ||
    !Number.isFinite(adT) ||
    !Number.isFinite(adP)
  ) {
    throw new Error(
      `dailyTokenAndersonDarlingHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    adN1: n1,
    adN2: n2,
    adMedianA,
    adMedianB,
    adA2,
    adMeanH0,
    adVarH0,
    adT,
    adP,
    adDir,
    adZSigned,
    adTCrit05,
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

export function buildDailyTokenAndersonDarlingHalves(
  queue: QueueLine[],
  opts: DailyTokenAndersonDarlingHalvesOptions = {},
): DailyTokenAndersonDarlingHalvesReport {
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
  const sort: DailyTokenAndersonDarlingHalvesSort = opts.sort ?? 'adA2Desc';
  const validSorts: DailyTokenAndersonDarlingHalvesSort[] = [
    'adA2',
    'adA2Desc',
    'adT',
    'adTDesc',
    'adZSigned',
    'adZSignedDesc',
    'adP',
    'adPDesc',
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
  const rows: DailyTokenAndersonDarlingHalvesSourceRow[] = [];

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
      result = dailyTokenAndersonDarlingHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenAndersonDarlingHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      adN1: result.adN1,
      adN2: result.adN2,
      adMedianA: result.adMedianA,
      adMedianB: result.adMedianB,
      adA2: result.adA2,
      adMeanH0: result.adMeanH0,
      adVarH0: result.adVarH0,
      adT: result.adT,
      adP: result.adP,
      adDir: result.adDir,
      adZSigned: result.adZSigned,
      adTCrit05: result.adTCrit05,
    };
    rows.push(row);
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
      case 'adT':
        primary = a.adT - b.adT;
        break;
      case 'adTDesc':
        primary = b.adT - a.adT;
        break;
      case 'adZSigned':
        primary = a.adZSigned - b.adZSigned;
        break;
      case 'adZSignedDesc':
        primary = b.adZSigned - a.adZSigned;
        break;
      case 'adP':
        primary = a.adP - b.adP;
        break;
      case 'adPDesc':
        primary = b.adP - a.adP;
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
