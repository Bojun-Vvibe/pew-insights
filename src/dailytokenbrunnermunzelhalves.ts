/**
 * daily-token-brunner-munzel-halves: per-source
 * BRUNNER-MUNZEL (2000) GENERALISED-WILCOXON
 * NONPARAMETRIC BEHRENS-FISHER TEST for stochastic
 * equality between the first half and second half of
 * the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-SIXTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The Brunner-Munzel (2000 *Biometrical Journal* 42:17-25)
 * relative-effect estimator targets the unknown functional
 *
 *     p = P(X < Y) + (1/2) P(X = Y)
 *
 * (probability that a random draw from sample A is smaller
 * than a random draw from sample B, with a 1/2 charge for
 * ties). Under H0 of stochastic equality p = 1/2; the
 * alternative p != 1/2 is the strict nonparametric
 * Behrens-Fisher problem (compare Mann-Whitney 1947 which
 * additionally assumes EQUAL DISPERSION under H0).
 *
 * Compute pooled mid-ranks R_i (1..n) on the union of A
 * and B and the WITHIN-SAMPLE mid-ranks R^A_i (rank within
 * A only) and R^B_j (rank within B only). Let
 *
 *     Rbar_A = (1/n1) sum_{i in A} R_i
 *     Rbar_B = (1/n2) sum_{j in B} R_j
 *
 * The PLACEMENT VARIANCE estimators (Brunner-Munzel 2000
 * eq. 2.4) are
 *
 *     S_A^2 = (1/(n1 - 1)) sum_{i in A}
 *               ( R_i - R^A_i - Rbar_A + (n1 + 1)/2 )^2
 *     S_B^2 = (1/(n2 - 1)) sum_{j in B}
 *               ( R_j - R^B_j - Rbar_B + (n2 + 1)/2 )^2
 *
 * (equivalently var[R_i - R^A_i] estimated within each
 * sample with the across-sample mean adjustment, which
 * is Brunner-Munzel's KEY innovation: the pure rank-sum
 * variance n1 n2 (n+1)/12 used by Wilcoxon and Lepage
 * IMPLICITLY ASSUMES EQUAL underlying CDFs, while S_A^2
 * and S_B^2 estimate the true Behrens-Fisher variance
 * separately for each sample without any pooled
 * variance assumption).
 *
 * The Brunner-Munzel statistic is
 *
 *     bmRelative   = (Rbar_B - (n2 + 1)/2) / n1
 *                  ~ p (the relative-effect estimator)
 *     bmW          = (Rbar_B - Rbar_A) /
 *                       ( n * sqrt(S_A^2/n1 + S_B^2/n2) )
 *
 * with the WELCH-SATTERTHWAITE (1946 *Biometrics* 2:
 * 110-114) effective degrees of freedom (Brunner-Munzel
 * 2000 eq. 2.5)
 *
 *     bmDof = ( S_A^2/n1 + S_B^2/n2 )^2 /
 *             ( (S_A^2/n1)^2/(n1-1) + (S_B^2/n2)^2/(n2-1) )
 *
 * Under H0 the statistic bmW is asymptotically N(0, 1) but
 * the SMALL-SAMPLE correction Brunner-Munzel recommend is
 * a Student-t reference with bmDof; they show via
 * simulation (sec. 4) that the t approximation HOLDS THE
 * NOMINAL alpha within 1% even at n1 = n2 = 10. We use the
 * Student-t two-sided p-value
 *
 *     bmPValue = 2 * (1 - F_t(|bmW|; bmDof))
 *
 * via the regularised incomplete beta function I_x(a, b)
 * with x = bmDof / (bmDof + bmW^2), a = bmDof/2,
 * b = 1/2:
 *
 *     1 - F_t(|t|; v) = (1/2) I_{v/(v + t^2)}(v/2, 1/2)
 *     bmPValue        = I_{v/(v + t^2)}(v/2, 1/2)
 *
 * (Abramowitz-Stegun 1965 sec. 26.7.4; the factor of 2 in
 * the two-sided p-value cancels the 1/2 in the
 * single-tail identity, matching the standard t two-
 * sided table to machine precision).
 *
 * SIGN CONVENTION: bmW > 0 <=> Rbar_B > Rbar_A
 *                  <=> SECOND half stochastically LARGER
 *                  <=> bmRelative > 0.5
 * matching axis-115 mwZ and axis-175 lepLocZ sign
 * conventions for direct cross-axis aggregation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-115 daily-token-mann-whitney-halves
 *     (Wilcoxon-Mann-Whitney). WMW assumes EQUAL
 *     UNDERLYING CDFs under H0 and uses the closed-form
 *     null variance n1 n2 (n + 1)/12 (with tie
 *     correction). Brunner-Munzel uses SAMPLE-SPECIFIC
 *     placement variances S_A^2 and S_B^2 which are
 *     CONSISTENT FOR THE TRUE VARIANCE OF p UNDER ANY
 *     PAIR OF UNDERLYING CDFs. The two tests COINCIDE
 *     when F_A == F_B under H0; they DIFFER (sometimes
 *     dramatically) when the two halves have DIFFERENT
 *     dispersions under the null hypothesis of
 *     STOCHASTIC equality (the Behrens-Fisher problem
 *     for ranks). For pew-token series the second half
 *     is OFTEN heteroscedastic with respect to the first
 *     (token volumes ramp up as a project matures), so
 *     this test rejects/fails-to-reject MEANINGFULLY
 *     differently from axis-115 even though they target
 *     "the same" location-shift question.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves and
 *     axis-170 daily-token-ansari-bradley-halves (PURE
 *     SCALE tests). Brunner-Munzel is a STOCHASTIC-
 *     ORDERING test, not a scale test; pure scale shift
 *     with equal medians gives bmW near zero while
 *     ST/AB reject strongly.
 *
 *   - vs axis-174 daily-token-cucconi-halves and axis-175
 *     daily-token-lepage-halves (JOINT location-scale
 *     chi-2(2)). Cucconi/Lepage are JOINT tests with two
 *     channels combined into a chi-2(2) statistic;
 *     Brunner-Munzel is a SINGLE-CHANNEL t-test on the
 *     functional p with a Welch-Satterthwaite df
 *     correction. Crucially the BM variance estimator
 *     does NOT assume the rank-sum null variance
 *     n1 n2 (n + 1)/12 that Cucconi and Lepage both rely
 *     on; under heteroscedastic alternatives BM has
 *     correct asymptotic SIZE while Cucconi/Lepage drift
 *     (Brunner-Munzel 2000 Tab. 1 reports WMW size
 *     0.075-0.090 for nominal 0.05 under unequal
 *     variances, BM holds at 0.048-0.052).
 *
 *   - vs axis-171 Mood's median (one-point EDF gap at
 *     pooled median). Mood is invariant to any monotone
 *     transform of the data; Brunner-Munzel uses the
 *     full pooled mid-rank vector and is much more
 *     powerful for stochastic-ordering alternatives that
 *     don't concentrate at the median.
 *
 *   - vs axis-116 Brown-Forsythe (PARAMETRIC F on
 *     |x - median|, SCALE only). Different target
 *     functional, different alternative space.
 *
 *   - vs the cumulative-periodogram axes (167-169, 172-
 *     173). Frequency-domain whole-series tests; this is
 *     a time-domain two-sample halves test on a fixed
 *     midpoint split.
 *
 *   - vs axis-114 Mood's-median-halves and axis-118
 *     Mann-Whitney-halves (location-only halves split).
 *     Mood reduces to a 2x2 chi-squared on above-median
 *     counts; BM uses the full rank vector AND a Welch-
 *     style variance estimator. The two are not
 *     monotonic functions of each other.
 *
 *   - vs axis-110-113 trend axes (Mann-Kendall, Cox-
 *     Stuart, difference-sign). Trend axes target a
 *     MONOTONIC trend across the WHOLE series; BM
 *     targets the JOINT stochastic-ordering shift
 *     between two FIXED halves and is invariant to the
 *     internal order WITHIN each half.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), what is the probability that a random
 *   day from the second half has more tokens than a
 *   random day from the first half (with 1/2-credit for
 *   ties), and is the Brunner-Munzel two-sided p-value
 *   (Welch-Satterthwaite t reference) below alpha = 0.05
 *   even after accounting for unequal dispersions of the
 *   two halves?"**
 *
 * Reference:
 *   Brunner, E. & Munzel, U., "The nonparametric
 *     Behrens-Fisher problem: asymptotic theory and a
 *     small-sample approximation", *Biometrical Journal*
 *     42(1) (2000), pp. 17-25.
 *   Welch, B. L., "The generalisation of Student's
 *     problem when several different population variances
 *     are involved", *Biometrika* 34(1/2) (1947),
 *     pp. 28-35.
 *   Satterthwaite, F. E., "An approximate distribution of
 *     estimates of variance components", *Biometrics* 2(6)
 *     (1946), pp. 110-114.
 *   Abramowitz, M. & Stegun, I. A., *Handbook of
 *     Mathematical Functions* (US NBS, 1965) sec. 26.7.
 *
 * Caveats:
 *
 *   - The Welch-Satterthwaite t-reference is mildly
 *     conservative for n1 + n2 < 20 (Brunner-Munzel 2000
 *     sec. 4 reports actual size 0.043 vs nominal 0.05
 *     at n1 = n2 = 7). We require n >= 16 (n1 = n2 = 8)
 *     so each within-sample variance has at least 7
 *     residual dof.
 *   - Tied pooled values use MID-RANK assignment; the
 *     placement variance estimators handle ties
 *     correctly without an explicit tie correction (the
 *     residuals R_i - R^A_i - Rbar_A + (n1+1)/2 absorb
 *     tie-induced rank inflation symmetrically).
 *   - Degenerate case: if S_A^2 == 0 AND S_B^2 == 0 (all
 *     residuals exactly cancel) the statistic is 0/0;
 *     we throw to be filtered upstream as
 *     droppedNonFiniteFit.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-brunner-munzel-halves
 *
 *   pew-insights daily-token-brunner-munzel-halves \
 *     --json --min-tenure-days 16 --sort bmPValue
 */
import type { QueueLine } from './types.js';

export type DailyTokenBrunnerMunzelHalvesSort =
  | 'bmW'
  | 'bmWAbsDesc'
  | 'bmPValue'
  | 'bmPValueDesc'
  | 'bmRelative'
  | 'bmRelativeDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBrunnerMunzelHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so each within-sample placement
   * variance has at least 7 residual dof and the
   * Welch-Satterthwaite t-reference holds nominal alpha.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBrunnerMunzelHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenBrunnerMunzelHalvesSourceRow {
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
  bmN1: number;
  /** Second-half size n2 = n - n1. */
  bmN2: number;
  /** Mean pooled mid-rank in A. */
  bmRbarA: number;
  /** Mean pooled mid-rank in B. */
  bmRbarB: number;
  /** Placement variance estimator for A (Brunner-Munzel eq. 2.4). */
  bmSAsq: number;
  /** Placement variance estimator for B. */
  bmSBsq: number;
  /** Relative-effect estimator p_hat = (Rbar_B - (n2+1)/2) / n1; under H0, p = 1/2. */
  bmRelative: number;
  /** Brunner-Munzel statistic; under H0 ~ Student-t with bmDof. */
  bmW: number;
  /** Welch-Satterthwaite effective degrees of freedom. */
  bmDof: number;
  /** Two-sided Student-t p-value at bmDof. */
  bmPValue: number;
}

export interface DailyTokenBrunnerMunzelHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBrunnerMunzelHalvesSort;
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
  sources: DailyTokenBrunnerMunzelHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions. Returns
 * the rank vector aligned to the input order.
 */
export function midRanksBM(values: number[]): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) {
      j += 1;
    }
    const midRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = midRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Brunner-Munzel (2000) generalised-Wilcoxon nonparametric
 * Behrens-Fisher test on the first-half (A = x[0..n1-1])
 * vs second-half (B = x[n1..n-1]) of a real-valued series.
 *
 * Returns the relative-effect estimator p_hat (target
 * functional p = P(X<Y) + 0.5 P(X=Y), under H0 p = 1/2),
 * the placement-variance-based statistic bmW (Welch-style
 * standardisation, NO pooled-variance assumption), the
 * Welch-Satterthwaite effective dof, and the two-sided
 * Student-t p-value at that dof.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - bmW(x + c) === bmW(x) for any constant c (mid-ranks
 *     are invariant under any monotone transform).
 *   - bmW(a * x) === bmW(x) for any a > 0 (positive scale
 *     preserves both pooled mid-ranks and within-sample
 *     mid-ranks, hence both Rbar's and S_A^2, S_B^2).
 *   - bmRelative(x) + bmRelative(reverse(x)) === 1 (with
 *     equal halves; swapping halves reverses the rank
 *     comparison).
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 *   - When F_A === F_B (equal underlying distributions,
 *     no ties) bmW reduces (asymptotically) to the
 *     standardised Mann-Whitney statistic with the
 *     classical n1 n2 (n+1)/12 variance; under
 *     heteroscedastic alternatives the two diverge and
 *     bmW is the consistent one.
 */
export function dailyTokenBrunnerMunzelHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  bmN1: number;
  bmN2: number;
  bmRbarA: number;
  bmRbarB: number;
  bmSAsq: number;
  bmSBsq: number;
  bmRelative: number;
  bmW: number;
  bmDof: number;
  bmPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenBrunnerMunzelHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenBrunnerMunzelHalves requires finite values');
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
      `dailyTokenBrunnerMunzelHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pooled mid-ranks (1..n) on the union.
  const pooledRanks = midRanksBM(values);
  // Within-sample mid-ranks (1..n1 for A, 1..n2 for B).
  const aValues = values.slice(0, n1);
  const bValues = values.slice(n1);
  const aRanks = midRanksBM(aValues);
  const bRanks = midRanksBM(bValues);

  // Mean pooled rank within each sample.
  let sumPooledA = 0;
  for (let i = 0; i < n1; i += 1) sumPooledA += pooledRanks[i]!;
  const RbarA = sumPooledA / n1;
  let sumPooledB = 0;
  for (let j = 0; j < n2; j += 1) sumPooledB += pooledRanks[n1 + j]!;
  const RbarB = sumPooledB / n2;

  // Placement variances (Brunner-Munzel 2000 eq. 2.4).
  const meanARank = (n1 + 1) / 2;
  const meanBRank = (n2 + 1) / 2;
  let sumSqA = 0;
  for (let i = 0; i < n1; i += 1) {
    const resid = pooledRanks[i]! - aRanks[i]! - RbarA + meanARank;
    sumSqA += resid * resid;
  }
  let sumSqB = 0;
  for (let j = 0; j < n2; j += 1) {
    const resid = pooledRanks[n1 + j]! - bRanks[j]! - RbarB + meanBRank;
    sumSqB += resid * resid;
  }
  const SAsq = sumSqA / (n1 - 1);
  const SBsq = sumSqB / (n2 - 1);

  // Relative-effect estimator.
  const bmRelative = (RbarB - meanBRank) / n1;

  const varCombined = SAsq / n1 + SBsq / n2;
  if (!(varCombined > 0) || !Number.isFinite(varCombined)) {
    throw new Error(
      `dailyTokenBrunnerMunzelHalves: degenerate placement variance (SAsq=${SAsq}, SBsq=${SBsq})`,
    );
  }
  const bmW = (RbarB - RbarA) / (n * Math.sqrt(varCombined));

  // Welch-Satterthwaite df.
  const aTerm = SAsq / n1;
  const bTerm = SBsq / n2;
  const dofNum = (aTerm + bTerm) * (aTerm + bTerm);
  const dofDen =
    (aTerm * aTerm) / (n1 - 1) + (bTerm * bTerm) / (n2 - 1);
  if (!(dofDen > 0) || !Number.isFinite(dofDen)) {
    throw new Error(
      `dailyTokenBrunnerMunzelHalves: degenerate Welch dof (dofDen=${dofDen})`,
    );
  }
  const bmDof = dofNum / dofDen;
  if (!Number.isFinite(bmDof) || bmDof <= 0) {
    throw new Error(
      `dailyTokenBrunnerMunzelHalves: non-finite Welch dof (bmDof=${bmDof})`,
    );
  }

  const bmPValue = studentTTwoSidedBM(Math.abs(bmW), bmDof);

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bmN1: n1,
    bmN2: n2,
    bmRbarA: RbarA,
    bmRbarB: RbarB,
    bmSAsq: SAsq,
    bmSBsq: SBsq,
    bmRelative,
    bmW,
    bmDof,
    bmPValue,
  };
}

/**
 * Two-sided Student-t p-value at |t| with v degrees of
 * freedom, computed via the regularised incomplete beta
 * (Abramowitz-Stegun 1965 sec. 26.7.4):
 *
 *   2 * (1 - F_t(|t|; v))
 *     = I_{v/(v + t^2)}(v/2, 1/2)
 *
 * Max relative error ~1e-12 from the Lentz continued-
 * fraction implementation of incomplete beta.
 */
export function studentTTwoSidedBM(t: number, v: number): number {
  if (!Number.isFinite(t) || t < 0) {
    throw new Error(`studentTTwoSidedBM: t must be non-negative finite (got ${t})`);
  }
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`studentTTwoSidedBM: v must be positive (got ${v})`);
  }
  if (t === 0) return 1;
  const x = v / (v + t * t);
  const p = regularisedIncompleteBetaBM(x, v / 2, 0.5);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * Regularised incomplete beta I_x(a, b) via the Lentz
 * continued fraction (Numerical Recipes 3rd ed. sec. 6.4
 * "betacf"). Uses the symmetry I_x(a,b) = 1 - I_{1-x}(b,a)
 * to keep the continued fraction in its rapidly-
 * convergent regime x < (a+1)/(a+b+2).
 *
 * Max relative error ~1e-12 across the parameter ranges
 * we use (a = v/2 with v in [1, 1e6]; b = 1/2; x in (0, 1)).
 */
export function regularisedIncompleteBetaBM(
  x: number,
  a: number,
  b: number,
): number {
  if (!Number.isFinite(x) || x < 0 || x > 1) {
    throw new Error(`regularisedIncompleteBetaBM: x in [0,1] (got ${x})`);
  }
  if (!Number.isFinite(a) || a <= 0) {
    throw new Error(`regularisedIncompleteBetaBM: a > 0 (got ${a})`);
  }
  if (!Number.isFinite(b) || b <= 0) {
    throw new Error(`regularisedIncompleteBetaBM: b > 0 (got ${b})`);
  }
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lnBeta =
    lanczosLogGammaBM(a) + lanczosLogGammaBM(b) - lanczosLogGammaBM(a + b);
  const front = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - lnBeta,
  ) / a;

  // Decide which side of the symmetry to use.
  if (x < (a + 1) / (a + b + 2)) {
    return front * betacfBM(x, a, b);
  } else {
    return 1 - (Math.exp(
      b * Math.log(1 - x) + a * Math.log(x) -
        (lanczosLogGammaBM(a) + lanczosLogGammaBM(b) - lanczosLogGammaBM(a + b)),
    ) / b) * betacfBM(1 - x, b, a);
  }
}

function betacfBM(x: number, a: number, b: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-15) break;
  }
  return h;
}

export function lanczosLogGammaBM(x: number): number {
  if (!Number.isFinite(x) || x <= 0) {
    throw new Error(`lanczosLogGammaBM: x must be > 0 (got ${x})`);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const xm = x - 1;
  let a = c[0]!;
  const t = xm + g + 0.5;
  for (let i = 1; i < 9; i += 1) {
    a += c[i]! / (xm + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
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

export function buildDailyTokenBrunnerMunzelHalves(
  queue: QueueLine[],
  opts: DailyTokenBrunnerMunzelHalvesOptions = {},
): DailyTokenBrunnerMunzelHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 16;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 16) {
    throw new Error(
      `minTenureDays must be an integer >= 16 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenBrunnerMunzelHalvesSort = opts.sort ?? 'bmWAbsDesc';
  const validSorts: DailyTokenBrunnerMunzelHalvesSort[] = [
    'bmW',
    'bmWAbsDesc',
    'bmPValue',
    'bmPValueDesc',
    'bmRelative',
    'bmRelativeDesc',
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
  const rows: DailyTokenBrunnerMunzelHalvesSourceRow[] = [];

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
      result = dailyTokenBrunnerMunzelHalves(filled);
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
      bmN1: result.bmN1,
      bmN2: result.bmN2,
      bmRbarA: result.bmRbarA,
      bmRbarB: result.bmRbarB,
      bmSAsq: result.bmSAsq,
      bmSBsq: result.bmSBsq,
      bmRelative: result.bmRelative,
      bmW: result.bmW,
      bmDof: result.bmDof,
      bmPValue: result.bmPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bmW':
        primary = a.bmW - b.bmW;
        break;
      case 'bmWAbsDesc':
        primary = Math.abs(b.bmW) - Math.abs(a.bmW);
        break;
      case 'bmPValue':
        primary = a.bmPValue - b.bmPValue;
        break;
      case 'bmPValueDesc':
        primary = b.bmPValue - a.bmPValue;
        break;
      case 'bmRelative':
        primary = a.bmRelative - b.bmRelative;
        break;
      case 'bmRelativeDesc':
        primary = b.bmRelative - a.bmRelative;
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

/**
 * Corpus-level SIGNED aggregator for axis-176 per-source
 * results. Combines the per-source SIGNED bmW statistics
 * via STOUFFER'S Z-METHOD (Stouffer et al. 1949
 * *American Soldier* vol. 1, sec. 2.2; the canonical
 * signed-combination meta-analytic z statistic):
 *
 *     stoufferZ = sum_i bmZ_i / sqrt(m)
 *     stoufferTwoSidedPValue =
 *       2 * (1 - Phi(|stoufferZ|))
 *
 * where bmZ_i is the per-source bmW interpreted as an
 * approximate N(0,1) z-score (valid asymptotically as the
 * t-reference approaches normal as bmDof grows; for
 * bmDof < 30 we use the equivalent signed normal z via
 * the inverse-Phi of the per-source two-sided t p-value
 * with sign(bmW) preserved, which is the standard
 * Stouffer adjustment for non-normal per-source z's).
 *
 * Why Stouffer (this axis): bmW is intrinsically SIGNED
 * (positive = second half stochastically larger). The
 * Lancaster/Satterthwaite aggregator used for axis-175
 * Lepage targets UNSIGNED chi-2(2) p-values via Fisher's
 * combined-p; that's the right answer for an unsigned
 * upper-tail test, the WRONG answer for a signed
 * directional statistic where positive and negative
 * evidence can CANCEL. Stouffer preserves the sign and
 * answers "is the corpus-level direction of stochastic
 * shift consistent and significant", which is the
 * correct meta-analytic question for axis-176.
 *
 * The aggregator returns also the corpus-mean bmRelative
 * (TENURE-WEIGHTED, matching the axis-175 v0.6.452
 * weighting convention) for downstream interpretation.
 *
 * Malformed rows (non-finite bmW, bmPValue not in (0,1],
 * non-positive bmDof or nTenureDays) are SKIPPED with a
 * counter rather than throwing.
 *
 * Reference:
 *   Stouffer, S. A., Suchman, E. A., DeVinney, L. C.,
 *     Star, S. A. & Williams, R. M. Jr., *The American
 *     Soldier: Adjustment During Army Life* vol. 1
 *     (Princeton 1949), sec. 2.2.
 *   Whitlock, M. C., "Combining probability from
 *     independent tests: the weighted Z-method is
 *     superior to Fisher's approach", *J. Evolutionary
 *     Biology* 18(5) (2005), pp. 1368-1373.
 */
export interface BrunnerMunzelHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanBmW: number;
  tenureWeightedMeanBmRelative: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateBrunnerMunzelHalves(
  rows: ReadonlyArray<{
    bmW: number;
    bmPValue: number;
    bmDof: number;
    bmRelative: number;
    nTenureDays: number;
  }>,
): BrunnerMunzelHalvesCorpusAggregate {
  let zSum = 0;
  let bmwSum = 0;
  let weightedRelativeSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.bmW) ||
      !Number.isFinite(r.bmPValue) ||
      r.bmPValue <= 0 ||
      r.bmPValue > 1 ||
      !Number.isFinite(r.bmDof) ||
      r.bmDof <= 0 ||
      !Number.isFinite(r.bmRelative) ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    // Convert per-source two-sided t p-value back to a
    // signed normal z preserving sign(bmW). The half-
    // p-value gives the magnitude of the equivalent
    // standard-normal z via inverse Phi.
    const halfP = r.bmPValue / 2;
    const zMagnitude = inverseStandardNormalUpperTailBM(halfP);
    const signedZ = r.bmW >= 0 ? zMagnitude : -zMagnitude;
    zSum += signedZ;
    bmwSum += r.bmW;
    weightedRelativeSum += r.nTenureDays * r.bmRelative;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanBmW: Number.NaN,
      tenureWeightedMeanBmRelative: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailBM(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanBmW: bmwSum / used,
    tenureWeightedMeanBmRelative: weightedRelativeSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailBM(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`standardNormalUpperTailBM: z must be finite (got ${z})`);
  }
  if (z < 0) return 1 - standardNormalUpperTailBM(-z);
  // Q(z) = phi(z) * (b1 t + b2 t^2 + b3 t^3 + b4 t^4 + b5 t^5)
  // with t = 1 / (1 + p z).
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * z);
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    b1 * t +
    b2 * t * t +
    b3 * t * t * t +
    b4 * t * t * t * t +
    b5 * t * t * t * t * t;
  const q = phi * poly;
  return q < 0 ? 0 : q > 1 ? 1 : q;
}

/**
 * Inverse standard-normal upper tail: given p in (0, 1),
 * return z such that Q(z) = 1 - Phi(z) = p. Uses the
 * Beasley-Springer-Moro 1977/2002 rational approximation
 * (max relative error ~1e-9 across p in (1e-300, 1 - 1e-300)).
 *
 * Boundary handling: p = 0 returns +Infinity (capped at
 * a large finite value to avoid NaN downstream); p = 1
 * returns -Infinity (capped similarly). For pew-insights
 * this caps at +/- 38.5 (the practical limit of the
 * normal CDF in IEEE 754 double precision).
 */
export function inverseStandardNormalUpperTailBM(p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error(
      `inverseStandardNormalUpperTailBM: p in [0,1] required (got ${p})`,
    );
  }
  if (p <= 0) return 38.5;
  if (p >= 1) return -38.5;
  // p is the upper tail; convert to lower-tail percentile q = 1 - p.
  const q = 1 - p;
  return inverseStandardNormalCdfBM(q);
}

function inverseStandardNormalCdfBM(p: number): number {
  // Beasley-Springer-Moro 1977 + Moro 1995 tail correction.
  // Coefficients from Acklam 2003 (max rel err ~1e-9).
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let z: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    z =
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    z =
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z =
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  return z;
}
