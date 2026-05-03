/**
 * daily-token-ks-two-sample-halves: per-source
 * KOLMOGOROV-SMIRNOV TWO-SAMPLE TEST comparing the
 * empirical cumulative distribution functions (ECDFs)
 * of the FIRST half vs SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Construct the empirical CDFs (Smirnov 1939, Bulletin
 * Mathematique de l'Universite de Moscou 2(2):3-14;
 * Massey 1951, Journal of the American Statistical
 * Association 46(253):68-78):
 *
 *     F_A(t) = (1/n1) * #{i : A_i <= t}
 *     F_B(t) = (1/n2) * #{j : B_j <= t}
 *
 * The KS two-sample statistic is the supremum of the
 * absolute pointwise difference between the ECDFs:
 *
 *     ksD = sup_t |F_A(t) - F_B(t)|
 *
 * Computationally the supremum is attained at one of
 * the n pooled sample values, so we evaluate at each
 * pooled order statistic. We also report the SIGNED
 * supremum to disambiguate which half stochastically
 * dominates:
 *
 *     ksDPlus  = sup_t  ( F_A(t) - F_B(t) )
 *     ksDMinus = sup_t  ( F_B(t) - F_A(t) )
 *     ksD      = max( ksDPlus, ksDMinus )
 *
 * Sign convention. We report `ksDSigned`:
 *
 *     ksDSigned = +ksDPlus   if ksDPlus >= ksDMinus
 *               = -ksDMinus  otherwise
 *
 *   ksDSigned > 0 means F_A is ABOVE F_B at the
 *     supremum, i.e. half A puts more mass at or below
 *     the threshold than half B does -- B is
 *     STOCHASTICALLY LARGER -- daily token mass
 *     STOCHASTICALLY GREW from first to second half.
 *   ksDSigned < 0 means F_B is above F_A at the
 *     supremum -- A is STOCHASTICALLY LARGER -- daily
 *     token mass STOCHASTICALLY SHRANK.
 *   ksDSigned approx 0 means the ECDFs agree at every
 *     pooled order statistic -- no detectable
 *     distribution shift.
 *
 * Under H0 (both halves drawn from the same continuous
 * distribution F), the limiting distribution of the
 * scaled KS statistic is the Kolmogorov distribution
 * (Kolmogorov 1933, Giornale dell'Istituto Italiano
 * degli Attuari 4:83-91):
 *
 *     ksLambda = sqrt( n1 * n2 / (n1 + n2) ) * ksD
 *     P( ksLambda > t ) = 2 sum_{k=1..inf}
 *                         (-1)^(k-1) exp(-2 k^2 t^2)
 *
 * The right-tail p-value is conventionally evaluated
 * with the Smirnov series (Press, Teukolsky,
 * Vetterling & Flannery 2007, Numerical Recipes 3rd
 * ed. eq. 14.3.18):
 *
 *     ksP = 2 sum_{k=1..inf}
 *           (-1)^(k-1) exp(-2 k^2 ksLambda^2)
 *
 * with the small-lambda tail handled via the
 * complementary identity (NR 14.3.19) for numerical
 * stability. We additionally report a normal-
 * standardised z-equivalent for cross-axis
 * comparability:
 *
 *     ksZ = sign(ksDSigned) * sqrt(2) *
 *           erfInv( 1 - ksP )
 *
 * (so ksZ > +1.96 means ksP < 0.05 with second half
 * stochastically larger; ksZ < -1.96 means ksP < 0.05
 * with first half stochastically larger).
 *
 * The standard alpha = 0.05 critical value is
 *
 *     ksDCrit_{0.05} = 1.36 * sqrt( (n1 + n2) / (n1 * n2) )
 *
 * (Massey 1951 Table 1 large-sample asymptote);
 * |ksD| > ksDCrit rejects equal-distribution at the
 * 5 % level.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-117:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-
 *     TEST (NONPARAMETRIC ECDF-supremum statistic
 *     comparing two contiguous halves with the
 *     Kolmogorov asymptotic null). Sensitive to ANY
 *     distributional difference between the halves --
 *     LOCATION shift, SCALE shift, SHAPE difference,
 *     MULTIMODALITY appearance/disappearance,
 *     SKEWNESS asymmetry, TAIL behaviour --
 *     simultaneously and jointly. This is the
 *     OMNIBUS distribution-equality companion to the
 *     SPECIFIC-MOMENT halves tests (115/116/117).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney detects a LOCATION/STOCHASTIC-
 *     DOMINANCE shift via monotonic ranks, which is
 *     a SPECIFIC functional of the difference between
 *     ECDFs (specifically int F_A dF_B). KS detects
 *     ANY pointwise gap between the ECDFs. Two
 *     distributions with EQUAL MEDIANS but different
 *     SHAPES (e.g. uniform vs bimodal on the same
 *     support with the same mean) yield mwZ approx 0
 *     but ksD large. Conversely a pure constant shift
 *     gives both tests significant but with similar
 *     direction. They are NOT a monotone transform of
 *     each other.
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Brown-Forsythe is a PARAMETRIC F-test on
 *     ABSOLUTE deviations from per-half medians,
 *     sensitive ONLY to SCALE shift. KS detects scale
 *     shift among other things, but also detects
 *     skewness shifts and shape changes that Brown-
 *     Forsythe cannot see. A series whose first half
 *     is N(0, 1) and whose second half is uniform on
 *     [-sqrt(3), +sqrt(3)] (same mean, same variance)
 *     gives bfZ approx 0 but ksD large.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is a NONPARAMETRIC RANK-SUM on
 *     OUTWARD-PAIR ranks AFTER median-centring,
 *     sensitive ONLY to SCALE shift. KS uses the
 *     PRE-CENTRED ECDFs and detects ANY shape
 *     difference including pure location shifts that
 *     Siegel-Tukey actively removes. A clean step-
 *     shift in median gives stZ approx 0 but ksD
 *     large.
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a multi-lag squared-autocorrelation
 *     PORTMANTEAU on the centred raw series with a
 *     Chi-Square(H) null sensitive to SERIAL
 *     STRUCTURE (the ORDER within each half matters).
 *     KS is fully PERMUTATION-INVARIANT WITHIN each
 *     half (only the MULTISET of values in each half
 *     matters, not their internal order). A series
 *     with strong AR(1) structure but identical
 *     marginal distributions in each half gives
 *     ljungBoxQZ much greater than 0 but ksD approx 0.
 *
 *   - vs axes 110/111/113 (Mann-Kendall, Cox-Stuart,
 *     Mood difference-sign). Those are TREND
 *     statistics on LOCATION using sign / rank
 *     functionals on the WHOLE series or on PAIRED
 *     comparisons. KS is an UNPAIRED two-sample
 *     ECDF supremum on a fixed split. A WITHIN-HALF
 *     monotone trend that exactly reverses across the
 *     split (e.g. half A = 1..n1, half B = n1..1)
 *     gives identical ECDFs (ksD approx 0) but
 *     mannKendallTau approx -1.
 *
 *   - vs axis-64 daily-token-runs-test-z (Wald-
 *     Wolfowitz median-binarised run-count). Wald-
 *     Wolfowitz binarises the WHOLE series by its
 *     median and counts MAXIMAL RUNS with a
 *     hypergeometric null -- sensitive to ALTERNATION
 *     of the centred sign. KS compares the two halves'
 *     full ECDFs -- sensitive to distribution shift,
 *     insensitive to within-half ordering.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution computed on the
 *     WHOLE series. KS is also permutation-invariant
 *     within each half but depends on WHICH half each
 *     value lands in. A uniformly random permutation
 *     of the time index has E[ksD] = O(1/sqrt(n)),
 *     not 0, but no systematic direction.
 *
 *   - vs the spectral axes (84-104). Spectral axes
 *     transform to the FREQUENCY domain. KS stays in
 *     the TIME-domain ECDF.
 *
 *   - vs DFA / Hurst / fractal-dimension axes. Those
 *     are scaling exponents fit across multiple window
 *     sizes. KS is a single supremum statistic at a
 *     single fixed split.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), build their empirical
 *   CDFs F_A and F_B, and compute ksD = sup_t |F_A(t) -
 *   F_B(t)|, does ksD exceed the Massey 1951
 *   alpha = 0.05 critical value 1.36 * sqrt((n1+n2) /
 *   (n1*n2))?"**
 *
 * Reference:
 *   Smirnov, N. V., "Estimate of deviation between
 *     empirical distribution functions in two
 *     independent samples", Bulletin Mathematique de
 *     l'Universite de Moscou 2(2) (1939), pp. 3-14.
 *   Kolmogorov, A. N., "Sulla determinazione empirica
 *     di una legge di distribuzione", Giornale
 *     dell'Istituto Italiano degli Attuari 4 (1933),
 *     pp. 83-91.
 *   Massey, F. J., "The Kolmogorov-Smirnov Test for
 *     Goodness of Fit", Journal of the American
 *     Statistical Association 46(253) (1951), pp.
 *     68-78.
 *   Press, W. H., Teukolsky, S. A., Vetterling, W. T.
 *     and Flannery, B. P., "Numerical Recipes: The
 *     Art of Scientific Computing", 3rd ed.,
 *     Cambridge University Press, 2007, sec. 14.3
 *     eqs. 14.3.18-19.
 *
 * Caveats:
 *
 *   - ksD in [0, 1] by construction. ksDSigned in
 *     [-1, +1]. ksP in (0, 1]. ksZ in (-inf, +inf).
 *   - The continuous-distribution limit assumed by
 *     the Kolmogorov asymptotic null is technically
 *     violated for the discrete gap-filled token
 *     series (many exact zeros). The effect is that
 *     ksP is CONSERVATIVE (slightly under-rejects)
 *     for ties; the asymptote remains valid in the
 *     n1, n2 -> inf regime relevant here.
 *   - Tied pooled values are handled by walking the
 *     pool in stable sorted order and updating both
 *     ECDFs at each value before recording the
 *     pointwise difference, so the supremum is
 *     evaluated at the UPPER step of each tied
 *     plateau. This matches Massey 1951 conventions.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axis-115 / axis-116 / axis-117). Hard
 *     floor n >= 8 so the asymptotic Kolmogorov null
 *     is in its valid regime (Massey 1951 documents
 *     adequate calibration for n1, n2 >= 4).
 *   - All-equal series filtered upstream by zero-
 *     variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-ks-two-sample-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-ks-two-sample-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute KS statistic descending
 *   # (strongest distributional shift evidence first):
 *   pew-insights daily-token-ks-two-sample-halves \
 *     --sort ksDDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenKsTwoSampleHalvesSort =
  | 'ksD'
  | 'ksDDesc'
  | 'ksDSigned'
  | 'ksDSignedDesc'
  | 'ksZ'
  | 'ksZDesc'
  | 'ksZAbs'
  | 'ksZAbsDesc'
  | 'ksP'
  | 'ksPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKsTwoSampleHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (Massey 1951 calibrated regime
   * for the asymptotic Kolmogorov null).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKsTwoSampleHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenKsTwoSampleHalvesSourceRow {
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
  ksN1: number;
  /** Second-half size n2 = n - n1. */
  ksN2: number;
  /** Median of the first half (diagnostic only; KS does not centre). */
  ksMedianA: number;
  /** Median of the second half (diagnostic only; KS does not centre). */
  ksMedianB: number;
  /** Positive supremum sup_t (F_A(t) - F_B(t)) in [0, 1]. */
  ksDPlus: number;
  /** Positive supremum sup_t (F_B(t) - F_A(t)) in [0, 1]. */
  ksDMinus: number;
  /** KS two-sample statistic max(ksDPlus, ksDMinus) in [0, 1]. */
  ksD: number;
  /**
   * Signed KS statistic:
   *   +ksDPlus  if ksDPlus >= ksDMinus
   *   -ksDMinus otherwise
   * Positive = second half stochastically larger.
   */
  ksDSigned: number;
  /** Effective sample size en = n1*n2/(n1+n2). */
  ksEn: number;
  /** ksLambda = sqrt(ksEn) * ksD. */
  ksLambda: number;
  /** Two-sided asymptotic p-value (Smirnov series). */
  ksP: number;
  /**
   * Normal-standardised z-equivalent.
   * Sign matches ksDSigned (positive = second half
   * stochastically larger).
   */
  ksZ: number;
  /** Massey 1951 alpha=0.05 critical value 1.36*sqrt((n1+n2)/(n1*n2)). */
  ksDCrit05: number;
}

export interface DailyTokenKsTwoSampleHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKsTwoSampleHalvesSort;
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
  sources: DailyTokenKsTwoSampleHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Smirnov asymptotic two-sided KS p-value:
 *
 *     P(K > lambda) = 2 sum_{k=1..inf}
 *                       (-1)^(k-1) exp(-2 k^2 lambda^2)
 *
 * Numerical Recipes 3rd ed. eq. 14.3.18 with the
 * complementary expansion (eq. 14.3.19) for very small
 * lambda where the alternating series is slow to
 * converge. We use the direct series with a fixed
 * truncation (101 terms) which is safely converged for
 * lambda >= 0.18; below that we clip to 1.0 (the
 * limiting value as lambda -> 0+).
 */
function smirnovP(lambda: number): number {
  if (!Number.isFinite(lambda) || lambda <= 0) return 1;
  if (lambda < 0.18) {
    // Asymptotic for very small lambda where direct
    // series converges slowly; the exact limit is
    // P -> 1 as lambda -> 0+.
    return 1;
  }
  const EPS1 = 1e-12;
  const EPS2 = 1e-30;
  let fac = 2;
  let sum = 0;
  let termbf = 0;
  const a2 = -2 * lambda * lambda;
  for (let j = 1; j <= 200; j += 1) {
    const term = fac * Math.exp(a2 * j * j);
    sum += term;
    if (Math.abs(term) <= EPS1 * termbf || Math.abs(term) <= EPS2 * sum) {
      const p = sum;
      return p > 1 ? 1 : p < 0 ? 0 : p;
    }
    fac = -fac;
    termbf = Math.abs(term);
  }
  // Did not converge in 200 terms (should never happen
  // for lambda >= 0.18); return clipped sum.
  const p = sum;
  return p > 1 ? 1 : p < 0 ? 0 : p;
}

/**
 * Inverse complementary error function via the
 * Acklam 2003 rational approximation (max relative
 * error 1.15e-9 in the central region; 4.5e-4 in the
 * tail region p < 0.02 or p > 0.98). Adequate for
 * z-equivalent display.
 *
 * We use it to compute the two-sided z-equivalent of
 * a two-tailed p-value:
 *
 *     z = sqrt(2) * erfInv(1 - p)
 *
 * by passing p to Acklam's standard normal quantile
 * (returning the upper-tail quantile of N(0,1) for
 * tail probability p/2):
 *
 *     z = -normalQuantile(p / 2)   (since p is two-sided)
 */
function normalQuantile(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    return Number.NaN;
  }
  // Acklam coefficients.
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/**
 * Kolmogorov-Smirnov two-sample equality-of-distribution
 * test on the first-half (A = x[0..n1-1]) vs second-
 * half (B = x[n1..n-1]) of a real-valued series.
 *
 * Computes ksDPlus = sup_t (F_A(t) - F_B(t)) and
 * ksDMinus = sup_t (F_B(t) - F_A(t)) by sweeping the
 * pooled sorted values and tracking the running ECDF
 * difference. Tied pooled values are flushed in a
 * single step so the difference is evaluated at the
 * UPPER step of each tied plateau (Massey 1951
 * convention).
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - ksD(x + c) === ksD(x) for any constant c.
 *     A constant added to every value translates both
 *     ECDFs identically, so the supremum difference is
 *     unchanged.
 *   - ksD(a * x) === ksD(x) for any a > 0 (rank order
 *     preserved). For a < 0 the rank order REVERSES;
 *     ksD is unchanged because both ksDPlus and
 *     ksDMinus swap, but ksDSigned NEGATES.
 *   - For x = repeat(constant) the test is undefined
 *     (zero variance, both ECDFs are identical step
 *     functions); we throw to be filtered upstream.
 *   - ksD in [0, 1]; ksDSigned in [-1, +1]; ksP in
 *     (0, 1]; ksLambda >= 0.
 *   - Swapping the two halves negates ksDSigned,
 *     leaves ksD invariant.
 */
export function dailyTokenKsTwoSampleHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  ksN1: number;
  ksN2: number;
  ksMedianA: number;
  ksMedianB: number;
  ksDPlus: number;
  ksDMinus: number;
  ksD: number;
  ksDSigned: number;
  ksEn: number;
  ksLambda: number;
  ksP: number;
  ksZ: number;
  ksDCrit05: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenKsTwoSampleHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenKsTwoSampleHalves requires finite values',
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
      `dailyTokenKsTwoSampleHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const ksMedianA = medianSorted(aSorted);
  const ksMedianB = medianSorted(bSorted);

  // KS supremum via merged sweep over the two sorted
  // halves. We walk both arrays simultaneously, at
  // each unique pooled value v advancing the count of
  // A-elements <= v and B-elements <= v, then
  // recording the running F_A(v) - F_B(v) AFTER the
  // step (Massey 1951 upper-step convention for ties).
  let i = 0;
  let j = 0;
  let ksDPlus = 0;
  let ksDMinus = 0;
  while (i < n1 && j < n2) {
    const va = aSorted[i]!;
    const vb = bSorted[j]!;
    let v: number;
    if (va < vb) {
      v = va;
    } else if (vb < va) {
      v = vb;
    } else {
      v = va;
    }
    while (i < n1 && aSorted[i]! === v) i += 1;
    while (j < n2 && bSorted[j]! === v) j += 1;
    const fa = i / n1;
    const fb = j / n2;
    const diff = fa - fb;
    if (diff > ksDPlus) ksDPlus = diff;
    if (-diff > ksDMinus) ksDMinus = -diff;
  }
  // Drain the longer side. After one half is fully
  // consumed its ECDF is flat at 1; only its tail
  // values can extend the supremum, but at v >= max(A)
  // we have F_A = 1, so the remaining difference is
  // F_A - F_B = 1 - F_B, which decreases monotonically
  // toward 0 as we walk the rest of B. Conversely for
  // A's tail. Therefore no further extremum can occur
  // beyond what we have already recorded; we leave
  // i and j as-is. (We also do NOT need to record the
  // final (1, 1) point, which contributes 0.)

  const ksD = ksDPlus >= ksDMinus ? ksDPlus : ksDMinus;
  const ksDSigned = ksDPlus >= ksDMinus ? ksDPlus : -ksDMinus;
  const ksEn = (n1 * n2) / (n1 + n2);
  const ksLambda = Math.sqrt(ksEn) * ksD;
  const ksP = smirnovP(ksLambda);
  // Two-sided z-equivalent: |z| = -normalQuantile(p/2);
  // sign from ksDSigned.
  const ksAbsZ = ksP >= 1 ? 0 : -normalQuantile(ksP / 2);
  const ksZ = ksDSigned >= 0 ? ksAbsZ : -ksAbsZ;
  const ksDCrit05 = 1.36 * Math.sqrt((n1 + n2) / (n1 * n2));

  if (
    !Number.isFinite(ksD) ||
    !Number.isFinite(ksLambda) ||
    !Number.isFinite(ksP) ||
    !Number.isFinite(ksZ)
  ) {
    throw new Error(
      `dailyTokenKsTwoSampleHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    ksN1: n1,
    ksN2: n2,
    ksMedianA,
    ksMedianB,
    ksDPlus,
    ksDMinus,
    ksD,
    ksDSigned,
    ksEn,
    ksLambda,
    ksP,
    ksZ,
    ksDCrit05,
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

export function buildDailyTokenKsTwoSampleHalves(
  queue: QueueLine[],
  opts: DailyTokenKsTwoSampleHalvesOptions = {},
): DailyTokenKsTwoSampleHalvesReport {
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
  const sort: DailyTokenKsTwoSampleHalvesSort = opts.sort ?? 'ksDDesc';
  const validSorts: DailyTokenKsTwoSampleHalvesSort[] = [
    'ksD',
    'ksDDesc',
    'ksDSigned',
    'ksDSignedDesc',
    'ksZ',
    'ksZDesc',
    'ksZAbs',
    'ksZAbsDesc',
    'ksP',
    'ksPDesc',
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
  const rows: DailyTokenKsTwoSampleHalvesSourceRow[] = [];

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
      result = dailyTokenKsTwoSampleHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenKsTwoSampleHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      ksN1: result.ksN1,
      ksN2: result.ksN2,
      ksMedianA: result.ksMedianA,
      ksMedianB: result.ksMedianB,
      ksDPlus: result.ksDPlus,
      ksDMinus: result.ksDMinus,
      ksD: result.ksD,
      ksDSigned: result.ksDSigned,
      ksEn: result.ksEn,
      ksLambda: result.ksLambda,
      ksP: result.ksP,
      ksZ: result.ksZ,
      ksDCrit05: result.ksDCrit05,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'ksD':
        primary = a.ksD - b.ksD;
        break;
      case 'ksDDesc':
        primary = b.ksD - a.ksD;
        break;
      case 'ksDSigned':
        primary = a.ksDSigned - b.ksDSigned;
        break;
      case 'ksDSignedDesc':
        primary = b.ksDSigned - a.ksDSigned;
        break;
      case 'ksZ':
        primary = a.ksZ - b.ksZ;
        break;
      case 'ksZDesc':
        primary = b.ksZ - a.ksZ;
        break;
      case 'ksZAbs':
        primary = Math.abs(a.ksZ) - Math.abs(b.ksZ);
        break;
      case 'ksZAbsDesc':
        primary = Math.abs(b.ksZ) - Math.abs(a.ksZ);
        break;
      case 'ksP':
        primary = a.ksP - b.ksP;
        break;
      case 'ksPDesc':
        primary = b.ksP - a.ksP;
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
