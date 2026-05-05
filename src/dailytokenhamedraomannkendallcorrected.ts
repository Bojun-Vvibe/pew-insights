/**
 * daily-token-hamed-rao-mann-kendall-corrected: per-source
 * HAMED-RAO 1998 EFFECTIVE-SAMPLE-SIZE VARIANCE CORRECTION
 * to the Mann-Kendall trend statistic on the gap-filled
 * daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTIETH cross-source axis.
 *
 * Mechanism. Let x[0..n-1] be the gap-filled daily token
 * series for one source (n = nTenureDays >= 21). Compute
 * the standard MANN-KENDALL S statistic
 *
 *     S = sum_{j<k} sign( x[k] - x[j] )                   (1)
 *
 * with the classical no-autocorrelation variance (Kendall
 * 1975 sec. 3.1; Hirsch-Slack-Smith 1982 eq. 3) including
 * the tie correction:
 *
 *     Var0(S) = ( n*(n-1)*(2n+5)
 *               - sum_t t_i*(t_i-1)*(2*t_i+5) ) / 18      (2)
 *
 * where the sum runs over groups of tied x-values with
 * group size t_i (singletons contribute zero).
 *
 * Hamed-Rao 1998 *Journal of Hydrology* 204(1-4):182-196
 * showed that under POSITIVE SERIAL AUTOCORRELATION the
 * naive variance (2) UNDERSTATES Var(S) and inflates the
 * Type I rate. They derived the EFFECTIVE-SAMPLE-SIZE
 * VARIANCE INFLATION FACTOR
 *
 *     eta = 1 + ( 2 / ( n*(n-1)*(n-2) ) ) *
 *           sum_{k=1..n-1} (n-k)*(n-k-1)*(n-k-2) *
 *                          rho_k                          (3)
 *
 * where rho_k is the LAG-k SAMPLE AUTOCORRELATION OF THE
 * RANKS of the DETRENDED series (Theil-Sen residuals of
 * midranks against time). The corrected variance is
 *
 *     VarHR(S) = eta * Var0(S)                            (4)
 *
 * Following Hamed-Rao's original recommendation, only the
 * SIGNIFICANT (two-sided z-test at alpha = 0.05 on
 * sqrt(n-k-2) * rho_k under the null of no rank-
 * autocorrelation) lag autocorrelations are RETAINED in
 * the sum (3) -- the rest are SET TO ZERO. This is the
 * "significant lags only" variant; we expose nSigLags as a
 * diagnostic.
 *
 * The standardised statistic is
 *
 *     hrZ = ( S - sign(S) ) / sqrt( VarHR(S) )            (5)
 *
 * (Mann-Kendall continuity correction: subtract sign(S)
 * from |S| before standardising) and is asymptotically
 * N(0, 1) two-sided. The two-sided p-value is
 *
 *     hrPValue = 2 * ( 1 - Phi(|hrZ|) )                   (6)
 *
 * via the Abramowitz-Stegun 1964 eq. 7.1.26 erf approxi-
 * mation. Diagnostic surfaces:
 *
 *   - hrEta in [1, +inf): the variance-inflation factor;
 *     == 1 iff no significant rank autocorrelation at any
 *     lag.
 *   - hrEffectiveN = n / hrEta: the effective sample size
 *     for trend inference.
 *   - hrTau = S / ( n*(n-1)/2 - tieAdjustment ) in
 *     [-1, +1]: classical Kendall tau-b of the (i, x[i])
 *     pairs (DIAGNOSTIC ONLY -- the test variance is
 *     hrEta-corrected, but the point estimate of monotone
 *     association is the standard tau-b).
 *   - hrNaiveZ = ( S - sign(S) ) / sqrt( Var0(S) ): the
 *     pre-correction Mann-Kendall Z, surfaced so users can
 *     directly read off how much the autocorrelation
 *     correction shifted significance.
 *   - hrNaivePValue: matching pre-correction p.
 *   - hrNSigLags: number of lags k in {1,..,n-1} with
 *     |sqrt(n-k-2) * rho_k| > 1.96 (alpha=0.05 two-sided).
 *
 * SIGN convention.
 *
 *   - hrZ > 0  =>  S > 0  =>  monotone UP-trend
 *   - hrZ < 0  =>  monotone DOWN-trend
 *   - hrZ ~ 0  =>  no detectable monotone trend
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `daily-token-mann-kendall-tau` (the unstratified
 *     Mann-Kendall axis): SAME S, SAME tau, but a
 *     STRUCTURALLY DIFFERENT VARIANCE. Mann-Kendall uses
 *     the no-autocorrelation Var0(S); Hamed-Rao corrects
 *     it by the rank-autocorrelation inflation factor eta.
 *     For a series with positive AR(1) the two p-values
 *     can DIFFER BY ORDERS OF MAGNITUDE: a significant
 *     Mann-Kendall trend is often a STATISTICAL ARTIFACT
 *     of serial dependence, which Hamed-Rao corrects. The
 *     TEST STATISTIC is the same but the NULL DISTRIBUTION
 *     differs -- this is a VARIANCE-FAMILY orthogonality,
 *     not a statistic-family orthogonality.
 *   - vs `daily-token-sen-adichie-aligned-rank-trend`
 *     (axis-219) and `daily-token-hirsch-slack-seasonal-
 *     kendall` (axis-218): both season-stratify (period
 *     s = 7) and IMPLICITLY remove cross-cohort serial
 *     dependence by partitioning into 7 cohorts. Hamed-Rao
 *     does NOT season-stratify -- it operates on the FULL
 *     n-series Mann-Kendall S and inflates the variance
 *     by the OBSERVED rank-autocorrelation function.
 *     Season-stratification handles only the period-7
 *     component of serial dependence; Hamed-Rao captures
 *     ALL lag autocorrelation (period-7, AR(1), AR(2),
 *     longer memory). The two are COMPLEMENTARY: a
 *     significant axis-220 hrZ in the presence of a
 *     significant axis-219 saZ implies trend BEYOND any
 *     pure period-7 cyclic dependence.
 *   - vs `daily-token-autocorrelation-lag1` and
 *     `daily-token-autocorrelation-lag7`: those are
 *     UNIVARIATE autocorrelation magnitudes on raw or
 *     detrended values. Hamed-Rao FOLDS the rank
 *     autocorrelation function into the variance of a
 *     trend statistic -- it is a JOINT (trend, dependence)
 *     functional, not an autocorrelation magnitude.
 *   - vs `daily-token-cox-stuart-trend-test`,
 *     `daily-token-cox-stuart-sign-pairs`,
 *     `daily-token-cox-stuart-thirds-trend`,
 *     `daily-token-difference-sign-test`: those use
 *     SIGN-PAIR or HALF-PAIR statistics with EXACT
 *     binomial nulls -- ZERO autocorrelation correction
 *     anywhere. Hamed-Rao is the FIRST axis on the daily
 *     token series to expose an autocorrelation-corrected
 *     trend p-value.
 *   - vs `daily-token-theil-sen-slope` (axis-214): point
 *     estimator of the regression slope; no inferential
 *     variance. Hamed-Rao is INFERENTIAL.
 *   - vs `daily-token-laplace-centroid-trend` (axis-217):
 *     L-1 magnitude functional of the centroid; not a rank
 *     trend test, not autocorrelation-corrected.
 *
 * Headline question:
 * **"For each source, after CORRECTING the Mann-Kendall
 *   trend variance for the OBSERVED rank-autocorrelation
 *   function via the Hamed-Rao 1998 effective-sample-size
 *   inflation factor, is there a STATISTICALLY SIGNIFICANT
 *   monotone trend in daily total_tokens?"**
 *
 * References:
 *   Hamed, K. H. & Rao, A. R., "A modified Mann-Kendall
 *     trend test for autocorrelated data", *Journal of
 *     Hydrology* 204(1-4) (1998), pp. 182-196. The
 *     variance-inflation factor used here.
 *   Mann, H. B., "Nonparametric tests against trend",
 *     *Econometrica* 13(3) (1945), pp. 245-259.
 *   Kendall, M. G., *Rank Correlation Methods*, 4th ed.,
 *     Griffin 1975, sec. 3.1.
 *   Hirsch, R. M., Slack, J. R. & Smith, R. A., "Tech-
 *     niques of trend analysis for monthly water quality
 *     data", *Water Resources Research* 18(1) (1982),
 *     pp. 107-121. Tie correction in Var0(S).
 *   Abramowitz, M. & Stegun, I. A., *Handbook of Mathe-
 *     matical Functions*, NBS 1964, eq. 7.1.26.
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 21 days. Need at least n-3 lags for
 *     the inflation sum (3); below ~20 the rho_k estimates
 *     are too noisy to be useful.
 *   - The "significant lags only" variant gives slightly
 *     biased eta under H0 (selection bias), but is more
 *     stable than the all-lags variant in moderate n. We
 *     follow Hamed-Rao's original recommendation.
 *   - eta is FLOORED at 1: if the significant-lag rank
 *     autocorrelations sum to a NEGATIVE inflation
 *     (overall negative autocorrelation), we DO NOT
 *     deflate the variance -- this is anti-conservative
 *     in the trend direction, but matches Hamed-Rao's
 *     conventional usage.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-hamed-rao-mann-kendall-corrected
 *   pew-insights daily-token-hamed-rao-mann-kendall-corrected --json
 *   pew-insights daily-token-hamed-rao-mann-kendall-corrected \
 *     --sort hrAbsZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenHamedRaoMannKendallCorrectedSort =
  | 'hrZ'
  | 'hrZDesc'
  | 'hrAbsZDesc'
  | 'hrPValue'
  | 'hrPValueDesc'
  | 'hrTau'
  | 'hrTauDesc'
  | 'hrEtaDesc'
  | 'hrNSigLagsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHamedRaoMannKendallCorrectedOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHamedRaoMannKendallCorrectedSort;
  generatedAt?: string;
}

export interface DailyTokenHamedRaoMannKendallCorrectedSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Mann-Kendall S. */
  hrS: number;
  /** No-autocorrelation Var0(S) (with tie correction). */
  hrVar0: number;
  /** Hamed-Rao corrected variance VarHR(S). */
  hrVarHR: number;
  /** Hamed-Rao variance-inflation factor eta in [1, +inf). */
  hrEta: number;
  /** Effective sample size n / eta. */
  hrEffectiveN: number;
  /** Number of significant rank autocorrelation lags retained in (3). */
  hrNSigLags: number;
  /** Standardised Z with continuity correction. */
  hrZ: number;
  /** Two-sided Normal-approximation p-value. */
  hrPValue: number;
  /** Pre-correction Mann-Kendall Z (for comparison). */
  hrNaiveZ: number;
  /** Pre-correction Mann-Kendall p (for comparison). */
  hrNaivePValue: number;
  /** Kendall tau-b in [-1, +1] (DIAGNOSTIC only). */
  hrTau: number;
}

export interface DailyTokenHamedRaoMannKendallCorrectedReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHamedRaoMannKendallCorrectedSort;
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
  sources: DailyTokenHamedRaoMannKendallCorrectedSourceRow[];
}

/**
 * Standard Normal CDF Phi(z) via Abramowitz-Stegun 1964
 * eq. 7.1.26 rational erf approximation. Max abs error
 * ~1.5e-7.
 */
export function standardNormalCdfHamedRao(z: number): number {
  if (!Number.isFinite(z)) {
    if (z === Number.POSITIVE_INFINITY) return 1;
    if (z === Number.NEGATIVE_INFINITY) return 0;
    throw new Error(`standardNormalCdfHamedRao: z must be finite (got ${z})`);
  }
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
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

export function twoSidedNormalPHamedRao(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`twoSidedNormalPHamedRao: z must be finite (got ${z})`);
  }
  const az = Math.abs(z);
  const upper = 1 - standardNormalCdfHamedRao(az);
  const p = 2 * upper;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Compute MIDRANKS (average rank for ties) of `values`,
 * ranks in 1..n. Returns a fresh array.
 */
export function midranksHamedRao(values: number[]): number[] {
  const n = values.length;
  const idx = values.map((_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avg;
    i = j;
  }
  return ranks;
}

/**
 * Mann-Kendall S = sum_{j<k} sign(x[k] - x[j]).
 */
export function mannKendallSHamedRao(x: number[]): number {
  const n = x.length;
  let s = 0;
  for (let j = 0; j < n - 1; j += 1) {
    for (let k = j + 1; k < n; k += 1) {
      const d = x[k]! - x[j]!;
      if (d > 0) s += 1;
      else if (d < 0) s -= 1;
    }
  }
  return s;
}

/**
 * Tie-corrected no-autocorrelation Var0(S) per
 * Hirsch-Slack-Smith 1982 eq. 3.
 */
export function varZeroMannKendallHamedRao(x: number[]): number {
  const n = x.length;
  // group sizes for ties
  const sorted = [...x].sort((a, b) => a - b);
  let tieSum = 0;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && sorted[j]! === sorted[i]!) j += 1;
    const t = j - i;
    if (t > 1) tieSum += t * (t - 1) * (2 * t + 5);
    i = j;
  }
  const main = n * (n - 1) * (2 * n + 5);
  return (main - tieSum) / 18;
}

/**
 * Theil-Sen median slope of (i, x[i]) pairs.
 */
export function theilSenSlopeHamedRao(x: number[]): number {
  const n = x.length;
  const slopes: number[] = [];
  for (let j = 0; j < n - 1; j += 1) {
    for (let k = j + 1; k < n; k += 1) {
      const dt = k - j;
      slopes.push((x[k]! - x[j]!) / dt);
    }
  }
  slopes.sort((a, b) => a - b);
  const m = slopes.length;
  if (m === 0) return 0;
  if (m % 2 === 1) return slopes[(m - 1) / 2]!;
  return 0.5 * (slopes[m / 2 - 1]! + slopes[m / 2]!);
}

/**
 * Sample autocorrelation rho_k of `r` at lag k (>= 1)
 * using the standard biased estimator with mean removed.
 */
export function sampleAutocorrHamedRao(r: number[], k: number): number {
  const n = r.length;
  if (k < 1 || k >= n) return 0;
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += r[i]!;
  mean /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const c = r[i]! - mean;
    den += c * c;
  }
  for (let i = 0; i < n - k; i += 1) {
    num += (r[i]! - mean) * (r[i + k]! - mean);
  }
  if (den === 0) return 0;
  return num / den;
}

/**
 * Hamed-Rao 1998 variance-inflation factor eta computed
 * from the rank-autocorrelation function of the Theil-Sen
 * detrended series. Only "significant" lags (|sqrt(n-k-2)
 * * rho_k| > 1.96) are retained per Hamed-Rao's
 * recommendation. eta is FLOORED at 1.
 */
export function hamedRaoEta(x: number[]): {
  eta: number;
  nSigLags: number;
} {
  const n = x.length;
  const slope = theilSenSlopeHamedRao(x);
  const detrended = x.map((v, i) => v - slope * i);
  const ranks = midranksHamedRao(detrended);
  let acc = 0;
  let nSig = 0;
  for (let k = 1; k <= n - 3; k += 1) {
    const rho = sampleAutocorrHamedRao(ranks, k);
    const seInv = Math.sqrt(n - k - 2);
    const z = seInv * rho;
    if (Math.abs(z) > 1.96) {
      const w = (n - k) * (n - k - 1) * (n - k - 2);
      acc += w * rho;
      nSig += 1;
    }
  }
  const denom = n * (n - 1) * (n - 2);
  let eta = 1 + (2 * acc) / denom;
  if (!Number.isFinite(eta) || eta < 1) eta = 1;
  return { eta, nSigLags: nSig };
}

/**
 * Hamed-Rao 1998 modified Mann-Kendall trend test on a
 * gap-filled daily token series.
 *
 * EXACT IDENTITIES preserved:
 *
 *   - hrEta >= 1 always.
 *   - hrEta == 1 iff no significant rank-autocorrelation
 *     lag at alpha=0.05.
 *   - hrZ == hrNaiveZ when hrEta == 1.
 *   - REVERSING the series along time NEGATES hrS, hrZ,
 *     hrTau, hrNaiveZ but PRESERVES hrVar0, hrVarHR,
 *     hrEta, hrEffectiveN, hrPValue, hrNaivePValue.
 */
export function dailyTokenHamedRaoMannKendallCorrected(weights: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  hrS: number;
  hrVar0: number;
  hrVarHR: number;
  hrEta: number;
  hrEffectiveN: number;
  hrNSigLags: number;
  hrZ: number;
  hrPValue: number;
  hrNaiveZ: number;
  hrNaivePValue: number;
  hrTau: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenHamedRaoMannKendallCorrected: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenHamedRaoMannKendallCorrected requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenHamedRaoMannKendallCorrected requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  for (let i = 0; i < n; i += 1) sumW += weights[i]!;
  const mean = sumW / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenHamedRaoMannKendallCorrected: zero centred variance (n=${n})`,
    );
  }
  const hrS = mannKendallSHamedRao(weights);
  const hrVar0 = varZeroMannKendallHamedRao(weights);
  if (hrVar0 <= 0 || !Number.isFinite(hrVar0)) {
    throw new Error(
      `dailyTokenHamedRaoMannKendallCorrected: non-positive Var0(S)=${hrVar0} (n=${n})`,
    );
  }
  const { eta, nSigLags } = hamedRaoEta(weights);
  const hrVarHR = eta * hrVar0;
  const hrEffectiveN = n / eta;
  // continuity-corrected Z
  let hrZ: number;
  let hrNaiveZ: number;
  if (hrS > 0) {
    hrZ = (hrS - 1) / Math.sqrt(hrVarHR);
    hrNaiveZ = (hrS - 1) / Math.sqrt(hrVar0);
  } else if (hrS < 0) {
    hrZ = (hrS + 1) / Math.sqrt(hrVarHR);
    hrNaiveZ = (hrS + 1) / Math.sqrt(hrVar0);
  } else {
    hrZ = 0;
    hrNaiveZ = 0;
  }
  if (!Number.isFinite(hrZ) || !Number.isFinite(hrNaiveZ)) {
    throw new Error(
      `dailyTokenHamedRaoMannKendallCorrected: non-finite Z (n=${n})`,
    );
  }
  const hrPValue = twoSidedNormalPHamedRao(hrZ);
  const hrNaivePValue = twoSidedNormalPHamedRao(hrNaiveZ);
  // tau-b: tie-adjusted denominator
  // count tied pairs in x
  const sorted = [...weights].sort((a, b) => a - b);
  let tieXPairs = 0;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && sorted[j]! === sorted[i]!) j += 1;
    const t = j - i;
    if (t > 1) tieXPairs += (t * (t - 1)) / 2;
    i = j;
  }
  const totalPairs = (n * (n - 1)) / 2;
  const tauDenom = Math.sqrt(
    (totalPairs - tieXPairs) * totalPairs,
  );
  const hrTau = tauDenom > 0 ? hrS / tauDenom : 0;
  return {
    mean,
    stddev,
    nSamples: n,
    hrS,
    hrVar0,
    hrVarHR,
    hrEta: eta,
    hrEffectiveN,
    hrNSigLags: nSigLags,
    hrZ,
    hrPValue,
    hrNaiveZ,
    hrNaivePValue,
    hrTau,
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

export function buildDailyTokenHamedRaoMannKendallCorrected(
  queue: QueueLine[],
  opts: DailyTokenHamedRaoMannKendallCorrectedOptions = {},
): DailyTokenHamedRaoMannKendallCorrectedReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHamedRaoMannKendallCorrectedSort =
    opts.sort ?? 'hrAbsZDesc';
  const validSorts: DailyTokenHamedRaoMannKendallCorrectedSort[] = [
    'hrZ',
    'hrZDesc',
    'hrAbsZDesc',
    'hrPValue',
    'hrPValueDesc',
    'hrTau',
    'hrTauDesc',
    'hrEtaDesc',
    'hrNSigLagsDesc',
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
  const rows: DailyTokenHamedRaoMannKendallCorrectedSourceRow[] = [];

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
      result = dailyTokenHamedRaoMannKendallCorrected(filled);
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
      hrS: result.hrS,
      hrVar0: result.hrVar0,
      hrVarHR: result.hrVarHR,
      hrEta: result.hrEta,
      hrEffectiveN: result.hrEffectiveN,
      hrNSigLags: result.hrNSigLags,
      hrZ: result.hrZ,
      hrPValue: result.hrPValue,
      hrNaiveZ: result.hrNaiveZ,
      hrNaivePValue: result.hrNaivePValue,
      hrTau: result.hrTau,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hrZ':
        primary = a.hrZ - b.hrZ;
        break;
      case 'hrZDesc':
        primary = b.hrZ - a.hrZ;
        break;
      case 'hrAbsZDesc':
        primary = Math.abs(b.hrZ) - Math.abs(a.hrZ);
        break;
      case 'hrPValue':
        primary = a.hrPValue - b.hrPValue;
        break;
      case 'hrPValueDesc':
        primary = b.hrPValue - a.hrPValue;
        break;
      case 'hrTau':
        primary = a.hrTau - b.hrTau;
        break;
      case 'hrTauDesc':
        primary = b.hrTau - a.hrTau;
        break;
      case 'hrEtaDesc':
        primary = b.hrEta - a.hrEta;
        break;
      case 'hrNSigLagsDesc':
        primary = b.hrNSigLags - a.hrNSigLags;
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
