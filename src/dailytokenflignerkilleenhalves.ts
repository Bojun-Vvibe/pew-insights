/**
 * daily-token-fligner-killeen-halves: per-source
 * FLIGNER-KILLEEN MEDIAN-CENTERED SCALE TEST for
 * equality of dispersion between the FIRST half
 * (n1 = floor(n/2) days) vs SECOND half (n2 = n - n1
 * days) of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-NINETY-SIXTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Fligner & Killeen (1976 *J. Amer. Statist. Assoc.*
 * 71:210-213, "Distribution-free two-sample tests for
 * scale") proposed a class of MEDIAN-CENTERED rank tests
 * for scale that is essentially insensitive to violations
 * of the equal-medians assumption (the Achilles' heel of
 * Ansari-Bradley, Klotz, and Siegel-Tukey). The
 * recommended form, validated by Conover, Johnson &
 * Johnson (1981 *Technometrics* 23(4):351-361 Table 5,
 * "median-modified Fligner-Killeen"), proceeds as
 * follows:
 *
 *   1. STEP 1 (median-centring): replace each x_ij by
 *      its absolute deviation from its WITHIN-GROUP
 *      MEDIAN
 *
 *          z_ij = | x_ij - median_i |
 *
 *      where i in {A, B} indexes the group. This step is
 *      DISTINCT from the within-half-median pre-alignment
 *      used by Klotz (axis-177) / Ansari-Bradley
 *      (axis-170): there the alignment is a SUBTRACTION
 *      and the SIGN is preserved; here the alignment is
 *      an ABSOLUTE DEVIATION and only the MAGNITUDE
 *      enters subsequent analysis.
 *
 *   2. STEP 2 (pooled mid-ranks): assign mid-ranks
 *      R_ij in {1, ..., n} to the pooled |z_ij|.
 *
 *   3. STEP 3 (HALF-NORMAL SCORES): transform each rank
 *      to a half-normal score
 *
 *          a(R) = Phi^{-1}( 0.5 + R / ( 2 * (n + 1) ) )
 *
 *      where Phi^{-1} is the standard-normal inverse CDF.
 *      This is the SCORE FUNCTION distinct from Klotz's
 *      squared full-normal-scores
 *      (a_klotz = (Phi^{-1}(R/(n+1)))^2): half-normal
 *      scores are MONOTONE in rank and live on
 *      [0, +infty), while squared normal scores are
 *      U-shaped in rank (small AND large ranks both get
 *      large scores). Half-normal scores correspond to
 *      the optimal locally-most-powerful rank test for a
 *      half-normal-distributed dispersion alternative
 *      (Hajek & Sidak 1967 *Theory of Rank Tests*,
 *      ch. III).
 *
 *   4. STEP 4 (test statistic): compute the
 *      group-A mean score
 *
 *          abarA = (1/n1) sum_{i in A} a(R_i)
 *
 *      pooled mean score
 *
 *          abar = (1/n) sum_i a(R_i)
 *
 *      pooled score variance (with the n-1 divisor for
 *      finite-sample exactness; Conover et al 1981
 *      sec. 2)
 *
 *          v = ( 1 / (n - 1) ) * sum_i ( a(R_i) - abar )^2
 *
 *      and the FLIGNER-KILLEEN STATISTIC
 *
 *          fkX2 = ( n1 * (abarA - abar)^2 ) / ( v * (1 - n1/n) )
 *                ~ chi^2(1)   (asymptotically; Conover
 *                              et al 1981 Table 5 shows
 *                              actual size 0.046-0.054
 *                              vs nominal 0.05 for
 *                              n1 = n2 in [10, 50] under
 *                              normal, double-exponential,
 *                              uniform, and Cauchy)
 *
 *      We expose both the chi^2(1) statistic AND its
 *      SIGNED square-root
 *
 *          fkZ = sign(abarA - abar) * sqrt(fkX2)
 *               ~ N(0, 1) under H0
 *
 *      so the SIGN of fkZ encodes which half is more
 *      DISPERSED (with the Fligner-Killeen median-
 *      centred convention, fkZ < 0 <=> group-A scores are
 *      LARGER than the pooled mean <=> A has LARGER
 *      |median-deviations| <=> A is MORE DISPERSED;
 *      fkZ > 0 <=> SECOND half is MORE DISPERSED).
 *      This matches axis-117 / axis-170 / axis-177
 *      directional convention for direct cross-axis
 *      aggregation.
 *
 * Two-sided p-value
 *
 *     fkPValue = 2 * ( 1 - Phi( |fkZ| ) )
 *              = chi2_1_upper_tail( fkX2 )
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-177 daily-token-klotz-halves
 *     (Klotz 1962). Klotz uses SQUARED FULL-NORMAL-
 *     SCORES on the SIGNED median-aligned values
 *     ( a_klotz(R) = (Phi^{-1}(R/(n+1)))^2 ). FK uses
 *     HALF-NORMAL SCORES on the ABSOLUTE median-deviations
 *     ( a_fk(R) = Phi^{-1}(0.5 + R/(2(n+1))) ). The
 *     score functions disagree at every rank: Klotz is
 *     U-shaped (small AND large ranks both scored high);
 *     FK is monotone-increasing (only large ranks scored
 *     high). FK is therefore strictly more sensitive to
 *     ONE-TAILED dispersion (e.g., the second half has
 *     occasional huge spikes but is otherwise tight),
 *     while Klotz is sensitive to TWO-TAILED dispersion
 *     (e.g., the second half has both tighter centre and
 *     larger tails). They reject differently when the
 *     dispersion change is asymmetric.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves and
 *     axis-170 daily-token-ansari-bradley-halves. Both
 *     use FOLDED RANKS on the SIGNED median-aligned
 *     values (rank by distance-from-centre on the pooled
 *     ordering, NOT on absolute deviations). The
 *     fundamental mechanistic difference: ST/AB depend
 *     on POSITION in the pooled ORDERING; FK depends on
 *     POSITION in the |z| ORDERING. Two configurations
 *     with the same folded-rank sum can have radically
 *     different |z| rank sums (e.g., a symmetric pair
 *     {-5, +5} occupies pooled-ordering positions
 *     {1, n} -> ST score = 1+1 = 2; on |z| -> {n, n}
 *     -> FK score = 2 * a(n)).
 *
 *   - vs axis-178 daily-token-conover-squared-ranks-
 *     halves (Conover 1980). Conover squared-ranks uses
 *     ( R - (n+1)/2 )^2 on POOLED SIGNED ranks of the
 *     median-aligned values. FK uses Phi^{-1}-based
 *     half-normal scores on ranks of |z|. Conover's
 *     score is QUADRATIC in centred rank; FK's score is
 *     PROBIT-LIKE in upper-half rank. The two have
 *     identical asymptotic null distribution (chi^2(1))
 *     but DIFFERENT power profiles -- Conover is
 *     locally-most-powerful for normal-shifted-scale
 *     alternatives, FK is locally-most-powerful for
 *     half-normal scale alternatives.
 *
 *   - vs axis-176 daily-token-brunner-munzel-halves and
 *     axis-115 daily-token-mann-whitney-halves
 *     (STOCHASTIC ORDERING tests). BM/MW test for
 *     stochastic dominance (location); pure scale shift
 *     with equal medians gives BM/MW statistics ~ 0
 *     while FK rejects strongly. Cross-loading near zero
 *     by construction.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi^2(2)
 *     location-scale tests). C/L combine location and
 *     scale into a single 2-df chi^2; they cannot
 *     SEPARATE the two channels. FK is a pure scale test
 *     and answers ONLY the dispersion question; combined
 *     with axis-176 BM (pure location), FK forms an
 *     ORTHOGONAL DECOMPOSITION of what C/L mash
 *     together.
 *
 *   - vs axes 192-195 (Kuiper, Tukey-quick, Wald-Wolfowitz,
 *     Rosenbaum). Those operate on ECDF-supremum,
 *     extreme-end-counts, label-runs, and extreme-
 *     boundary-counts of POOLED ORDER. FK operates on
 *     median-deviations magnitudes. The mechanism is
 *     mechanistically distinct on every axis.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic chi^2(1) reference holds nominal alpha
 * (Conover et al. 1981 Table 5: actual size 0.046-0.054
 * across n1 = n2 in [10, 50] under FOUR diverse null
 * distributions). The FK test is widely cited as the
 * MOST ROBUST nonparametric scale test under deviations
 * from normality (Conover et al. 1981 explicitly
 * recommend it; it is the default `var.test`-replacement
 * in R's `stats::fligner.test`).
 *
 * Reference:
 *   Fligner, M. A. & Killeen, T. J., "Distribution-free
 *     two-sample tests for scale", *J. Amer. Statist.
 *     Assoc.* 71(353) (1976), pp. 210-213.
 *   Conover, W. J., Johnson, M. E. & Johnson, M. M.,
 *     "A comparative study of tests for homogeneity of
 *     variances, with applications to the outer
 *     continental shelf bidding data", *Technometrics*
 *     23(4) (1981), pp. 351-361 Table 5.
 *   Hajek, J. & Sidak, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), ch. III.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-fligner-killeen-halves
 *
 *   pew-insights daily-token-fligner-killeen-halves \
 *     --json --min-tenure-days 18 --sort fkZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenFlignerKilleenHalvesSort =
  | 'fkZ'
  | 'fkZDesc'
  | 'fkZAbs'
  | 'fkZAbsDesc'
  | 'fkX2'
  | 'fkX2Desc'
  | 'fkPValue'
  | 'fkPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenFlignerKilleenHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic chi^2(1) reference
   * holds nominal alpha (Conover et al. 1981 Table 5).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenFlignerKilleenHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenFlignerKilleenHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  fkN1: number;
  /** Second-half size n2 = n - n1. */
  fkN2: number;
  /** Mean half-normal score on group A. */
  fkAbarA: number;
  /** Pooled-score mean abar = (1/n) sum a(R_i). */
  fkAbar: number;
  /** Pooled-score variance v = (1/(n-1)) sum (a(R_i)-abar)^2. */
  fkScoreVar: number;
  /** FK statistic n1*(abarA - abar)^2 / (v*(1-n1/n)) ~ chi^2(1). */
  fkX2: number;
  /** Signed sqrt(fkX2) ~ N(0,1). Sign convention: positive = SECOND half more dispersed. */
  fkZ: number;
  /** Two-sided normal p-value 2(1 - Phi(|fkZ|)) = chi^2(1) upper tail at fkX2. */
  fkPValue: number;
}

export interface DailyTokenFlignerKilleenHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenFlignerKilleenHalvesSort;
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
  sources: DailyTokenFlignerKilleenHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksFlignerKilleen(values: number[]): number[] {
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
 * Median of an array of finite numbers (does not mutate
 * the input).
 */
export function medianFlignerKilleen(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianFlignerKilleen: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Inverse standard-normal CDF: given p in (0, 1), returns
 * z such that Phi(z) = p. Beasley-Springer-Moro 1977 +
 * Acklam 2003 (max relative error ~1e-9 across p in
 * (1e-300, 1 - 1e-300)).
 */
export function inverseStandardNormalCdfFlignerKilleen(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdfFlignerKilleen: p in (0,1) required (got ${p})`,
    );
  }
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

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailFlignerKilleen(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailFlignerKilleen: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailFlignerKilleen(-z);
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
 * Fligner-Killeen (1976) median-centered scale test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Centres each
 * half by its WITHIN-GROUP MEDIAN, takes ABSOLUTE
 * DEVIATIONS, ranks the pooled |z|, applies HALF-NORMAL
 * SCORES, and computes the Conover-Iman-Keselman 1981
 * chi^2(1) statistic. Returns the chi^2(1) statistic, its
 * SIGNED square-root Z, and the two-sided p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - fkZ(x + c) === fkZ(x) for any constant c (uniform
 *     shift removed by within-half median-centring; |z|
 *     unchanged).
 *   - fkZ(a * x) === fkZ(x) for any a > 0 (positive
 *     scale preserves both halves' medians and the
 *     RANK-ORDER of |z|, hence preserves the FK
 *     statistic).
 *   - fkZ is invariant under independent location shifts
 *     of A and B (the within-half median-centring step
 *     subtracts each half's median first).
 *   - For x = repeat(constant) the test is undefined
 *     (zero score variance after alignment); we throw
 *     to be filtered upstream.
 *   - When n1 = n2 and the |z| values can be partitioned
 *     into two halves with identical multisets of ranks,
 *     fkZ = 0 and fkX2 = 0.
 */
export function dailyTokenFlignerKilleenHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  fkN1: number;
  fkN2: number;
  fkAbarA: number;
  fkAbar: number;
  fkScoreVar: number;
  fkX2: number;
  fkZ: number;
  fkPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenFlignerKilleenHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenFlignerKilleenHalves requires finite values');
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
      `dailyTokenFlignerKilleenHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Step 1: within-group median-centred ABSOLUTE deviations.
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianFlignerKilleen(aRaw);
  const bMed = medianFlignerKilleen(bRaw);
  const z = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) z[i] = Math.abs(aRaw[i]! - aMed);
  for (let j = 0; j < n2; j += 1) z[n1 + j] = Math.abs(bRaw[j]! - bMed);

  // Step 2: pooled mid-ranks of |z|.
  const ranks = midRanksFlignerKilleen(z);

  // Step 3: half-normal scores a(R) = Phi^{-1}(0.5 + R/(2(n+1))).
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const u = 0.5 + ranks[i]! / (2 * (n + 1));
    scores[i] = inverseStandardNormalCdfFlignerKilleen(u);
  }

  // Step 4: pooled and group-A means.
  let abar = 0;
  for (let i = 0; i < n; i += 1) abar += scores[i]!;
  abar /= n;
  let abarA = 0;
  for (let i = 0; i < n1; i += 1) abarA += scores[i]!;
  abarA /= n1;

  // Pooled score variance with (n-1) divisor.
  let scoreSS = 0;
  for (let i = 0; i < n; i += 1) {
    const c = scores[i]! - abar;
    scoreSS += c * c;
  }
  const v = scoreSS / (n - 1);
  if (!(v > 0) || !Number.isFinite(v)) {
    throw new Error(
      `dailyTokenFlignerKilleenHalves: degenerate score variance (v=${v})`,
    );
  }

  // FK chi^2(1) statistic. Equivalent algebraic form:
  //   fkX2 = ( n1 * (abarA - abar)^2 ) / ( v * (1 - n1/n) )
  // Note: 1 - n1/n = n2/n, so denominator = v * n2 / n.
  const denomX2 = v * (1 - n1 / n);
  if (!(denomX2 > 0) || !Number.isFinite(denomX2)) {
    throw new Error(
      `dailyTokenFlignerKilleenHalves: degenerate denom (${denomX2})`,
    );
  }
  const diff = abarA - abar;
  const fkX2 = (n1 * diff * diff) / denomX2;

  // Sign convention: positive Z = SECOND half more
  // dispersed. abarA - abar < 0  <=>  group A scores
  // BELOW pooled mean  <=>  group B scores ABOVE pooled
  // mean  <=>  group B has the LARGER |z|-ranks (more
  // dispersed). So fkZ = -sign(diff) * sqrt(fkX2).
  const sgn = diff < 0 ? 1 : diff > 0 ? -1 : 0;
  const fkZ = sgn * Math.sqrt(fkX2);
  const fkPValue =
    fkZ === 0 ? 1 : 2 * standardNormalUpperTailFlignerKilleen(Math.abs(fkZ));

  if (
    !Number.isFinite(fkX2) ||
    !Number.isFinite(fkZ) ||
    !Number.isFinite(fkPValue)
  ) {
    throw new Error(
      `dailyTokenFlignerKilleenHalves: non-finite output (n=${n}, fkX2=${fkX2})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    fkN1: n1,
    fkN2: n2,
    fkAbarA: abarA,
    fkAbar: abar,
    fkScoreVar: v,
    fkX2,
    fkZ,
    fkPValue,
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

export function buildDailyTokenFlignerKilleenHalves(
  queue: QueueLine[],
  opts: DailyTokenFlignerKilleenHalvesOptions = {},
): DailyTokenFlignerKilleenHalvesReport {
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
  const sort: DailyTokenFlignerKilleenHalvesSort = opts.sort ?? 'fkZAbsDesc';
  const validSorts: DailyTokenFlignerKilleenHalvesSort[] = [
    'fkZ',
    'fkZDesc',
    'fkZAbs',
    'fkZAbsDesc',
    'fkX2',
    'fkX2Desc',
    'fkPValue',
    'fkPValueDesc',
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
  const rows: DailyTokenFlignerKilleenHalvesSourceRow[] = [];

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
      result = dailyTokenFlignerKilleenHalves(filled);
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
      fkN1: result.fkN1,
      fkN2: result.fkN2,
      fkAbarA: result.fkAbarA,
      fkAbar: result.fkAbar,
      fkScoreVar: result.fkScoreVar,
      fkX2: result.fkX2,
      fkZ: result.fkZ,
      fkPValue: result.fkPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'fkZ':
        primary = a.fkZ - b.fkZ;
        break;
      case 'fkZDesc':
        primary = b.fkZ - a.fkZ;
        break;
      case 'fkZAbs':
        primary = Math.abs(a.fkZ) - Math.abs(b.fkZ);
        break;
      case 'fkZAbsDesc':
        primary = Math.abs(b.fkZ) - Math.abs(a.fkZ);
        break;
      case 'fkX2':
        primary = a.fkX2 - b.fkX2;
        break;
      case 'fkX2Desc':
        primary = b.fkX2 - a.fkX2;
        break;
      case 'fkPValue':
        primary = a.fkPValue - b.fkPValue;
        break;
      case 'fkPValueDesc':
        primary = b.fkPValue - a.fkPValue;
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
