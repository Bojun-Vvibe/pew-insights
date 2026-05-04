/**
 * daily-token-yuen-welch-halves: per-source
 * YUEN-WELCH (1974) TRIMMED-MEAN LOCATION TEST with
 * WELCH-SATTERTHWAITE degrees-of-freedom on the
 * WINSORIZED variances between the first half
 * (n1 = floor(n/2) days) vs second half
 * (n2 = n - n1 days) of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTY-THIRD cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO axis-182 FLIGNER-POLICELLO
 * AND ALL PRIOR LOCATION AXES (axis-115 Mann-Whitney,
 * axis-116 Brunner-Munzel, axis-176 Brunner-Munzel halves,
 * axis-181 Van der Waerden) BY USING
 *
 *   - TRIMMED MEANS (drop the lowest and highest
 *     gamma * n_i observations from each half) instead
 *     of midranks / placements / normal scores;
 *   - WINSORIZED variances (replace the trimmed tails
 *     with the boundary order statistics, then take the
 *     usual sample variance) for the standard error;
 *   - WELCH-SATTERTHWAITE degrees of freedom on the
 *     ratio of those winsorized variances;
 *   - STUDENT-t reference distribution rather than the
 *     standard normal.
 *
 * Yuen 1974 (*Biometrika* 61:165-170) showed this
 * combination gives nominal alpha under heavy-tailed
 * F (e.g. t_3, double-exponential, mixed normal
 * 0.9 N(0,1) + 0.1 N(0,9)) where the Student t,
 * Welch t, Mann-Whitney, and Brunner-Munzel all lose
 * size or power. Wilcox 2017 (*Introduction to Robust
 * Estimation and Hypothesis Testing* 4ed., sec. 5.3)
 * recommends gamma = 0.2 (20% trim per side) as the
 * default that "works across the widest range of
 * unknown distributions". This axis uses gamma = 0.2.
 *
 * Definition. Let `x[0..n-1]` be the gap-filled daily
 * token series for one source. Split
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * For a sample `S` of size `m` with sorted values
 * `S(1) <= ... <= S(m)` and trim fraction
 * `g = floor(gamma * m)`, define
 *
 *   - TRIMMED MEAN
 *
 *         tm(S) = (1 / (m - 2g)) * sum_{i=g+1}^{m-g} S(i)
 *
 *   - WINSORIZED SAMPLE
 *
 *         W(S)_i = S(g+1)        for i in [1, g]
 *                = S(i)          for i in [g+1, m-g]
 *                = S(m-g)        for i in [m-g+1, m]
 *
 *   - WINSORIZED MEAN  wm(S) = (1/m) sum W(S)_i
 *   - WINSORIZED SS    sw2(S) = sum (W(S)_i - wm(S))^2
 *   - WINSORIZED SE2   d(S) = sw2(S) / ((m - 2g) * (m - 2g - 1))
 *     (Yuen 1974 eq. 2; Wilcox 2017 eq. 5.21)
 *
 * The Yuen-Welch statistic is
 *
 *     ywT = ( tm(B) - tm(A) ) / sqrt( d(A) + d(B) )       (1)
 *
 * with WELCH-SATTERTHWAITE degrees of freedom
 *
 *     ywDf = ( d(A) + d(B) )^2
 *            / ( d(A)^2 / (h1 - 1) + d(B)^2 / (h2 - 1) )  (2)
 *
 * where h_i = m_i - 2g_i is the effective sample size of
 * the trimmed half (Yuen 1974 eq. 3; Welch 1947 *Biometrika*
 * 34:28-35). Two-sided p-value
 *
 *     ywPValue = 2 * ( 1 - F_t(|ywT|; ywDf) )             (3)
 *
 * with F_t the Student-t cdf computed via the regularised
 * incomplete beta function (Press et al. 2007 *Numerical
 * Recipes* 3rd ed. sec. 6.4 algorithm `betacf`).
 *
 * SIGN CONVENTION: ywT > 0 <=> SECOND half has LARGER
 * trimmed mean (B is shifted up; tm(B) > tm(A)). ywT < 0
 * <=> FIRST half has larger trimmed mean. Matches axis-117
 * stZ, axis-170 abZ, axis-176-181 SECOND-half-positive
 * convention so signed cross-axis aggregation (Stouffer
 * combiners) preserves direction interpretation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-183):
 *
 *   - vs axis-182 Fligner-Policello. FP is a RANK test
 *     (placement counts, scale-free for any monotone
 *     transformation of x). YW is a MOMENT test on the
 *     20%-trimmed mean, which IS sensitive to monotone
 *     scale changes that move the central 60% of the
 *     mass. They have the SAME sign convention but
 *     DIFFERENT influence functions (FP: bounded by
 *     placement-count truncation at 0..n_other; YW:
 *     re-descending at the 20%-th and 80%-th
 *     order statistics — exactly zero outside).
 *     Pitman ARE YW/FP ~ 1 under symmetric heavy-tailed
 *     F (Yuen 1974 Table 1; Wilcox 2017 sec. 5.3.4)
 *     but their disagreement under skewed F is
 *     diagnostic: YW > 0 with FP < 0 means the central
 *     trimmed mass moved up while the rank-stochastic-
 *     ordering of the full distribution moved down
 *     (heavy second-half left tail dragging the
 *     stochastic-ordering verdict).
 *
 *   - vs axis-181 Van der Waerden, axis-115 Mann-Whitney,
 *     axis-176 Brunner-Munzel. All three are rank tests
 *     against a Gaussian (VDW) or asymptotic-normal /
 *     Welch-t (MW / BM) reference. YW is a MOMENT test
 *     against a Student-t reference. Under exact-normal
 *     equal-scale alternatives Pitman ARE YW/VDW ~ 1.
 *     Under heavy-tailed F YW dominates VDW/MW in power
 *     while preserving nominal alpha (Yuen 1974 Sec. 4
 *     simulation tables 1-2 across n_i in [10, 50] for
 *     normal, t_3, contaminated normal). Disagreement
 *     across YW (moment) and VDW (rank) flags either
 *     heavy tails (rank wins on robustness) or skew
 *     (moment captures it; rank obscures it).
 *
 *   - vs the entire scale family (axes 170 AB, 174
 *     Cucconi, 175 Lepage, 177 Klotz, 178 Conover, 179
 *     Mood, 180 Sukhatme). Pure scale shift at zero
 *     median under symmetric F gives ywT ~ 0
 *     (the trimmed mean is location-equivariant and
 *     translation-only-equivariant); pure location
 *     shift at equal scales gives the scale family
 *     ~ 0. Asymptotically orthogonal under symmetric F
 *     (Hampel et al. 1986 *Robust Statistics* sec. 2.4).
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8 so
 * trimming 2 from each side leaves h1 = h2 = 4 effective
 * trimmed observations per half, which is the smallest
 * Yuen 1974 Table 1 bracket where the t-reference holds
 * nominal alpha within +/- 0.01).
 *
 * Reference:
 *   Yuen, K. K., "The two-sample trimmed t for unequal
 *     population variances", *Biometrika* 61 (1974),
 *     pp. 165-170.
 *   Welch, B. L., "The generalization of `Student's'
 *     problem when several different population variances
 *     are involved", *Biometrika* 34 (1947), pp. 28-35.
 *   Wilcox, R. R., *Introduction to Robust Estimation and
 *     Hypothesis Testing* 4th ed. (Academic Press 2017),
 *     sec. 5.3.
 *   Hampel, F. R., Ronchetti, E. M., Rousseeuw, P. J. &
 *     Stahel, W. A., *Robust Statistics: The Approach
 *     Based on Influence Functions* (Wiley 1986), sec. 2.4.
 *   Press, W. H., Teukolsky, S. A., Vetterling, W. T. &
 *     Flannery, B. P., *Numerical Recipes* 3rd ed.
 *     (Cambridge 2007), sec. 6.4.
 */
import type { QueueLine } from './types.js';

export type DailyTokenYuenWelchHalvesSort =
  | 'ywT'
  | 'ywTAbsDesc'
  | 'ywPValue'
  | 'ywPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenYuenWelchHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8; trim 2 each => h1 = h2 = 4) so the
   * Student-t reference holds nominal alpha within
   * +/- 0.01 (Yuen 1974 Table 1).
   */
  minTenureDays?: number;
  /**
   * Symmetric trim fraction on each tail. Default 0.2
   * per Wilcox 2017 sec. 5.3 recommendation. Must be in
   * [0, 0.5). gamma = 0 collapses to the ordinary Welch
   * t-test on raw means.
   */
  trimFraction?: number;
  top?: number;
  sort?: DailyTokenYuenWelchHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenYuenWelchHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  ywN1: number;
  /** Second-half size n2 = n - n1. */
  ywN2: number;
  /** Per-side trim count g_i = floor(trimFraction * n_i). */
  ywG1: number;
  ywG2: number;
  /** Effective trimmed sample sizes h_i = n_i - 2 g_i. */
  ywH1: number;
  ywH2: number;
  /** Trimmed means tm(A) and tm(B). */
  ywTrimmedMeanA: number;
  ywTrimmedMeanB: number;
  /** Winsorized SE^2 contributions d(A) and d(B). */
  ywDA: number;
  ywDB: number;
  /** Yuen-Welch t-statistic (eq. 1). */
  ywT: number;
  /** Welch-Satterthwaite degrees of freedom (eq. 2). */
  ywDf: number;
  /** Two-sided Student-t p-value (eq. 3). */
  ywPValue: number;
}

export interface DailyTokenYuenWelchHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  trimFraction: number;
  top: number;
  sort: DailyTokenYuenWelchHalvesSort;
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
  sources: DailyTokenYuenWelchHalvesSourceRow[];
}

/**
 * Regularised incomplete beta function I_x(a, b) via the
 * Lentz / Numerical Recipes 3ed sec. 6.4 continued-fraction
 * `betacf` algorithm. Used to compute the Student-t
 * survival function:
 *
 *     1 - F_t(|t|; df) = 0.5 * I_{ df/(df + t^2) }(df/2, 1/2)
 *
 * (Abramowitz-Stegun 1965 eq. 26.5.27). Max relative error
 * ~1e-12 across the parameter range we care about
 * (df in [3, 1000], t in [0, 30]).
 */
export function regularisedIncompleteBeta(
  x: number,
  a: number,
  b: number,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(
      `regularisedIncompleteBeta: non-finite input (x=${x}, a=${a}, b=${b})`,
    );
  }
  if (x < 0 || x > 1) {
    throw new Error(`regularisedIncompleteBeta: x must be in [0, 1] (got ${x})`);
  }
  if (a <= 0 || b <= 0) {
    throw new Error(
      `regularisedIncompleteBeta: a, b must be positive (got a=${a}, b=${b})`,
    );
  }
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lnGammaA = lnGamma(a);
  const lnGammaB = lnGamma(b);
  const lnGammaAB = lnGamma(a + b);
  const front = Math.exp(
    lnGammaAB - lnGammaA - lnGammaB + a * Math.log(x) + b * Math.log(1 - x),
  );

  // Use the continued fraction directly only when x < (a+1)/(a+b+2);
  // otherwise apply the symmetry I_x(a,b) = 1 - I_{1-x}(b, a).
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const MAX_ITER = 256;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_ITER; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  return h;
}

/**
 * Lanczos approximation to ln Gamma (Press et al. 2007
 * sec. 6.1). Max relative error ~2e-10 for x > 0.
 */
export function lnGamma(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) {
    throw new Error(`lnGamma: x must be positive finite (got ${x})`);
  }
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    ser += cof[j]! / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Two-sided Student-t survival probability
 * `2 * (1 - F_t(|t|; df))` via A&S 26.5.27. Throws on
 * non-finite t or non-positive df.
 */
export function studentTTwoSidedSurvival(t: number, df: number): number {
  if (!Number.isFinite(t)) {
    throw new Error(`studentTTwoSidedSurvival: t must be finite (got ${t})`);
  }
  if (!(df > 0) || !Number.isFinite(df)) {
    throw new Error(
      `studentTTwoSidedSurvival: df must be positive finite (got ${df})`,
    );
  }
  if (t === 0) return 1;
  const xArg = df / (df + t * t);
  const upperTail =
    0.5 * regularisedIncompleteBeta(xArg, df / 2, 0.5);
  const p = 2 * upperTail;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * Trimmed mean of `s` with symmetric trim count `g` on
 * each tail. Throws on g < 0, g >= m/2, or non-finite
 * inputs. Operates on a copy so caller's array is
 * preserved.
 */
export function trimmedMean(s: ReadonlyArray<number>, g: number): number {
  const m = s.length;
  if (!Number.isInteger(g) || g < 0 || 2 * g >= m) {
    throw new Error(
      `trimmedMean: invalid g=${g} for m=${m} (need 0 <= g, 2g < m)`,
    );
  }
  for (const v of s) {
    if (!Number.isFinite(v)) {
      throw new Error('trimmedMean: non-finite value in sample');
    }
  }
  const sorted = [...s].sort((a, b) => a - b);
  let acc = 0;
  for (let i = g; i < m - g; i += 1) acc += sorted[i]!;
  return acc / (m - 2 * g);
}

/**
 * Winsorized variance contribution `d(S) = sw2(S) /
 * ((m - 2g) (m - 2g - 1))` per Yuen 1974 eq. 2 / Wilcox
 * 2017 eq. 5.21. Throws on g < 0, g >= m/2, h <= 1.
 */
export function winsorizedVarianceContribution(
  s: ReadonlyArray<number>,
  g: number,
): number {
  const m = s.length;
  if (!Number.isInteger(g) || g < 0 || 2 * g >= m) {
    throw new Error(
      `winsorizedVarianceContribution: invalid g=${g} for m=${m}`,
    );
  }
  const h = m - 2 * g;
  if (h < 2) {
    throw new Error(
      `winsorizedVarianceContribution: trimmed h=${h} must be >= 2`,
    );
  }
  for (const v of s) {
    if (!Number.isFinite(v)) {
      throw new Error('winsorizedVarianceContribution: non-finite value');
    }
  }
  const sorted = [...s].sort((a, b) => a - b);
  const lo = sorted[g]!;
  const hi = sorted[m - g - 1]!;
  const wins = new Array<number>(m);
  for (let i = 0; i < m; i += 1) {
    const v = sorted[i]!;
    wins[i] = v < lo ? lo : v > hi ? hi : v;
  }
  let mean = 0;
  for (const v of wins) mean += v;
  mean /= m;
  let ss = 0;
  for (const v of wins) {
    const c = v - mean;
    ss += c * c;
  }
  return ss / (h * (h - 1));
}

/**
 * Yuen-Welch (1974) trimmed-mean two-sample t-test
 * between the first half (A) and second half (B) of
 * a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - ywT(x + c) === ywT(x) for any constant c
 *     (a constant shift moves both trimmed means by c
 *     and leaves both winsorized variances unchanged).
 *   - ywT(a * x) for a > 0 multiplies both trimmed
 *     means and the SE by a; ywT itself is INVARIANT
 *     under positive scaling (sign preserved, magnitude
 *     unchanged).
 *   - ywT(reverse(x)) === -ywT(x) WHEN n1 = n2 (the
 *     two halves swap; the numerator (tm(B) - tm(A))
 *     flips sign; the denominator is symmetric in
 *     d(A) + d(B); df is symmetric in (h1-1, h2-1)
 *     so it is invariant).
 *   - For a strict monotone increasing series of length
 *     >= 16, ywT > 0 (second-half trimmed mean exceeds
 *     first-half trimmed mean).
 *   - gamma = 0 (no trimming) collapses to the ordinary
 *     Welch t-test on raw means.
 */
export function dailyTokenYuenWelchHalves(
  values: number[],
  trimFraction = 0.2,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  ywN1: number;
  ywN2: number;
  ywG1: number;
  ywG2: number;
  ywH1: number;
  ywH2: number;
  ywTrimmedMeanA: number;
  ywTrimmedMeanB: number;
  ywDA: number;
  ywDB: number;
  ywT: number;
  ywDf: number;
  ywPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenYuenWelchHalves: need at least 16 samples (got ${n})`,
    );
  }
  if (!Number.isFinite(trimFraction) || trimFraction < 0 || trimFraction >= 0.5) {
    throw new Error(
      `dailyTokenYuenWelchHalves: trimFraction must be in [0, 0.5) (got ${trimFraction})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenYuenWelchHalves requires finite values');
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
      `dailyTokenYuenWelchHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const a = values.slice(0, n1);
  const b = values.slice(n1);
  const g1 = Math.floor(trimFraction * n1);
  const g2 = Math.floor(trimFraction * n2);
  const h1 = n1 - 2 * g1;
  const h2 = n2 - 2 * g2;
  if (h1 < 2 || h2 < 2) {
    throw new Error(
      `dailyTokenYuenWelchHalves: effective trimmed sample size too small (h1=${h1}, h2=${h2})`,
    );
  }

  const tmA = trimmedMean(a, g1);
  const tmB = trimmedMean(b, g2);
  const dA = winsorizedVarianceContribution(a, g1);
  const dB = winsorizedVarianceContribution(b, g2);

  const seSquared = dA + dB;
  let ywT: number;
  let ywDf: number;
  let ywPValue: number;
  if (!(seSquared > 0) || !Number.isFinite(seSquared)) {
    // Both winsorized variances are zero (constant trimmed
    // tails on both halves). Fall back to a degenerate
    // verdict matching the trimmed-mean shift sign.
    if (tmB === tmA) {
      ywT = 0;
      ywDf = h1 + h2 - 2;
      ywPValue = 1;
    } else {
      throw new Error(
        `dailyTokenYuenWelchHalves: degenerate winsorized variance with non-zero trimmed-mean shift`,
      );
    }
  } else {
    ywT = (tmB - tmA) / Math.sqrt(seSquared);
    const dfNum = (dA + dB) * (dA + dB);
    const dfDen = (dA * dA) / (h1 - 1) + (dB * dB) / (h2 - 1);
    ywDf = dfDen > 0 ? dfNum / dfDen : h1 + h2 - 2;
    if (!Number.isFinite(ywDf) || ywDf <= 0) ywDf = h1 + h2 - 2;
    ywPValue = studentTTwoSidedSurvival(ywT, ywDf);
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    ywN1: n1,
    ywN2: n2,
    ywG1: g1,
    ywG2: g2,
    ywH1: h1,
    ywH2: h2,
    ywTrimmedMeanA: tmA,
    ywTrimmedMeanB: tmB,
    ywDA: dA,
    ywDB: dB,
    ywT,
    ywDf,
    ywPValue,
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

export function buildDailyTokenYuenWelchHalves(
  queue: QueueLine[],
  opts: DailyTokenYuenWelchHalvesOptions = {},
): DailyTokenYuenWelchHalvesReport {
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
  const trimFraction = opts.trimFraction ?? 0.2;
  if (
    !Number.isFinite(trimFraction) ||
    trimFraction < 0 ||
    trimFraction >= 0.5
  ) {
    throw new Error(
      `trimFraction must be in [0, 0.5) (got ${opts.trimFraction})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenYuenWelchHalvesSort = opts.sort ?? 'ywTAbsDesc';
  const validSorts: DailyTokenYuenWelchHalvesSort[] = [
    'ywT',
    'ywTAbsDesc',
    'ywPValue',
    'ywPValueDesc',
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
  const rows: DailyTokenYuenWelchHalvesSourceRow[] = [];

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
      result = dailyTokenYuenWelchHalves(filled, trimFraction);
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
      ywN1: result.ywN1,
      ywN2: result.ywN2,
      ywG1: result.ywG1,
      ywG2: result.ywG2,
      ywH1: result.ywH1,
      ywH2: result.ywH2,
      ywTrimmedMeanA: result.ywTrimmedMeanA,
      ywTrimmedMeanB: result.ywTrimmedMeanB,
      ywDA: result.ywDA,
      ywDB: result.ywDB,
      ywT: result.ywT,
      ywDf: result.ywDf,
      ywPValue: result.ywPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'ywT':
        primary = a.ywT - b.ywT;
        break;
      case 'ywTAbsDesc':
        primary = Math.abs(b.ywT) - Math.abs(a.ywT);
        break;
      case 'ywPValue':
        primary = a.ywPValue - b.ywPValue;
        break;
      case 'ywPValueDesc':
        primary = b.ywPValue - a.ywPValue;
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
    trimFraction,
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
 * Corpus-level SIGNED aggregator for axis-183 per-source
 * results. Combines per-source SIGNED ywT (mapped to a
 * z-score via the standard-normal quantile that gives
 * the same one-sided Student-t tail probability) via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949 *American
 * Soldier* vol. 1, sec. 2.2; Whitlock 2005 *J. Evol.
 * Biol.* 18:1368-1373):
 *
 *     stoufferZ              = sum_i z_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * where z_i = sign(ywT_i) * Phi^-1(1 - 0.5 * ywPValue_i)
 * is the signed Z-score equivalent of each per-source
 * Student-t verdict. ywT itself is NOT directly poolable
 * across sources because each row has a different df —
 * converting through the p-value first gives a uniform
 * normal scale.
 *
 * Mirrors the axis-176 / 177 / 178 / 179 / 180 / 181 /
 * 182 SIGNED aggregators.
 */
export interface YuenWelchHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanYwT: number;
  tenureWeightedMeanYwT: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Acklam (2003) inverse-normal-cdf approximation;
 * max relative error ~1.15e-9 across (0, 1).
 */
export function inverseStandardNormalCdf(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdf: p must be in (0, 1) (got ${p})`,
    );
  }
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
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q;
  let r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
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
 * Standard normal upper-tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 1965 sec. 26.2.17.
 */
export function standardNormalUpperTailYw(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`standardNormalUpperTailYw: z must be finite (got ${z})`);
  }
  if (z < 0) return 1 - standardNormalUpperTailYw(-z);
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

export function aggregateYuenWelchHalves(
  rows: ReadonlyArray<{
    ywT: number;
    ywPValue: number;
    nTenureDays: number;
  }>,
): YuenWelchHalvesCorpusAggregate {
  let zSum = 0;
  let tSum = 0;
  let weightedTSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.ywT) ||
      !Number.isFinite(r.ywPValue) ||
      r.ywPValue < 0 ||
      r.ywPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    // Convert signed t to signed Z via p-value round-trip:
    // one-sided tail = ywPValue / 2; signed Z = sign(t) *
    // Phi^-1(1 - one-sided tail). Clamp p to (epsilon,
    // 1-epsilon) to keep Phi^-1 finite at the boundaries.
    const sign = r.ywT >= 0 ? 1 : -1;
    const oneSided = Math.min(0.999_999_999, Math.max(1e-15, r.ywPValue / 2));
    const z = sign * inverseStandardNormalCdf(1 - oneSided);
    if (!Number.isFinite(z)) {
      skipped += 1;
      continue;
    }
    zSum += z;
    tSum += r.ywT;
    weightedTSum += r.nTenureDays * r.ywT;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanYwT: Number.NaN,
      tenureWeightedMeanYwT: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailYw(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanYwT: tSum / used,
    tenureWeightedMeanYwT: weightedTSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Directional 5-bucket label classifier for axis-183
 * per-source ywT. Maps the signed Yuen-Welch trimmed
 * t-statistic to one of five mutually-exclusive verdict
 * buckets at configurable two-sided alpha (default 0.05):
 *
 *   - 'second-decisively-trimmed-mean-larger' if ywT > 0
 *     AND ywPValue < alpha
 *   - 'first-decisively-trimmed-mean-larger'  if ywT < 0
 *     AND ywPValue < alpha
 *   - 'second-leans-trimmed-mean-larger' if ywT > 0 AND
 *     alpha <= ywPValue < 2 * alpha
 *   - 'first-leans-trimmed-mean-larger'  if ywT < 0 AND
 *     alpha <= ywPValue < 2 * alpha
 *   - 'no-evidence-of-trimmed-mean-shift' otherwise
 */
export type YuenWelchDirectionalLabel =
  | 'second-decisively-trimmed-mean-larger'
  | 'first-decisively-trimmed-mean-larger'
  | 'second-leans-trimmed-mean-larger'
  | 'first-leans-trimmed-mean-larger'
  | 'no-evidence-of-trimmed-mean-shift';

export function labelYuenWelchHalvesRow(
  row: { ywT: number; ywPValue: number },
  alpha = 0.05,
): YuenWelchDirectionalLabel {
  if (!Number.isFinite(row.ywT)) {
    throw new Error(
      `labelYuenWelchHalvesRow: ywT must be finite (got ${row.ywT})`,
    );
  }
  if (
    !Number.isFinite(row.ywPValue) ||
    row.ywPValue < 0 ||
    row.ywPValue > 1
  ) {
    throw new Error(
      `labelYuenWelchHalvesRow: ywPValue must be in [0, 1] (got ${row.ywPValue})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelYuenWelchHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const lean = 2 * alpha;
  if (row.ywPValue < alpha) {
    return row.ywT > 0
      ? 'second-decisively-trimmed-mean-larger'
      : 'first-decisively-trimmed-mean-larger';
  }
  if (row.ywPValue < lean) {
    return row.ywT > 0
      ? 'second-leans-trimmed-mean-larger'
      : 'first-leans-trimmed-mean-larger';
  }
  return 'no-evidence-of-trimmed-mean-shift';
}
