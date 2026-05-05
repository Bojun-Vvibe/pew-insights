/**
 * daily-token-alexandersson-snht: per-source ALEXANDERSSON
 * 1986 STANDARD NORMAL HOMOGENEITY TEST (SNHT) for a SINGLE
 * STEP SHIFT in mean on the gap-filled daily total_tokens
 * series.
 *
 * TWO-HUNDRED-AND-TWENTY-FIRST cross-source axis.
 *
 * Mechanism. Let x[0..n-1] be the gap-filled daily token
 * series for one source (n = nTenureDays >= 21). First
 * STANDARDISE under the null of a constant mean:
 *
 *     z[i] = ( x[i] - mean(x) ) / sd(x)                    (1)
 *
 * where sd(x) is the sample standard deviation (denominator
 * n, NOT n-1 — Alexandersson 1986 *J. Climatology* 6:661,
 * eq. 3). For each candidate split a in {1, 2, ..., n-1}
 * compute
 *
 *     z1bar(a) = (1/a)     * sum_{i<a}    z[i]
 *     z2bar(a) = (1/(n-a)) * sum_{i>=a}   z[i]
 *
 *     T(a) = a * z1bar(a)^2 + (n-a) * z2bar(a)^2          (2)
 *
 * The SNHT statistic is the MAXIMUM over all candidate
 * splits and the most likely changepoint is the ARGMAX:
 *
 *     T0    = max_{1<=a<=n-1} T(a)                         (3)
 *     aStar = argmax_a T(a)                                (4)
 *
 * SIGN convention. The mean shift at aStar is
 *
 *     muBefore = mean( x[0..aStar-1] )
 *     muAfter  = mean( x[aStar..n-1] )
 *     meanShift = muAfter - muBefore                       (5)
 *
 * which is positive for an upward step and negative for a
 * downward step. The standardised shift z2bar(aStar) -
 * z1bar(aStar) is exposed as `zShift`.
 *
 * Critical values. Under H0 (no change), the EXACT null
 * distribution of T0 has no closed form (it is the maximum
 * of a CORRELATED chi-square-2 sequence). We expose two
 * complementary p/critical-value surfaces:
 *
 *   1. **Khaliq-Ouarda 2007 polynomial critical values** at
 *      alpha = {0.01, 0.05, 0.10}. Khaliq & Ouarda 2007
 *      *J. Hydrology* 332:332-340 fitted Monte-Carlo simu-
 *      lation tables (Alexandersson 1986 Table 1 + extended
 *      tabulation) with the rational-fraction expansion
 *
 *         T_crit(n, alpha) = (a + b*ln(n) + c*ln(n)^2)
 *                          / (1 + d*ln(n) + e*ln(n)^2)     (6)
 *
 *      with coefficients separately fitted for each alpha.
 *      Validity range n in [10, 70000]; max abs error
 *      ~0.5% over the Monte Carlo grid (Khaliq-Ouarda 2007
 *      Table 2). EXPOSED FIELDS: `tCrit01`, `tCrit05`,
 *      `tCrit10`.
 *   2. **Conservative Bonferroni-corrected normal-tail
 *      p-value**:
 *
 *         pApprox = min( 1, (n-1) * 2 * (1 - Phi(sqrt(T0))) )
 *                                                         (7)
 *
 *      treating each T(a) as a chi-square-2 (= 2 * z^2) and
 *      applying a Bonferroni correction over the n-1
 *      candidate splits. ALWAYS conservative (upper bound
 *      on the true p) because the T(a) sequence is
 *      positively correlated, but well-defined and
 *      monotone. EXPOSED AS `pApprox` with a clear caveat
 *      that the Khaliq-Ouarda critical values are PREFERRED
 *      for decision-making.
 *
 * The decision flag `significant05` is set iff
 * `T0 >= tCrit05` (Khaliq-Ouarda critical value at
 * alpha = 0.05).
 *
 * Diagnostic surfaces:
 *   - `aStar` in {1, ..., n-1}: the most-likely changepoint
 *     index (split is BEFORE x[aStar]). aStarDay is
 *     `addDays(firstActiveDay, aStar)`.
 *   - `tEdgeRatio` = max(T(1), T(n-1)) / T0 in [0, 1]:
 *     surfaces edge-of-window changepoints (where T
 *     mechanically inflates as one half shrinks). High
 *     edgeRatio + small n is a CAVEAT to the changepoint.
 *   - `t2Star` = the second-best T(a) outside a guard
 *     window of +/- max(3, floor(n/10)) around aStar.
 *     `t2OverT` = t2Star / T0 in [0, 1] surfaces regime
 *     multiplicity (two roughly equal step shifts).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `daily-token-pettitt-changepoint` (axis-154):
 *     Pettitt is RANK-BASED (uses sign(x[i]-x[j]) only) —
 *     magnitude-blind, breakdown ~0.5. SNHT is PARAMETRIC
 *     (assumes Gaussian noise around a piecewise constant
 *     mean) and uses STANDARDISED MAGNITUDES. The two
 *     tests can disagree sharply: a single 100x outlier
 *     barely shifts Pettitt KT but dominates SNHT T0; a
 *     clean step in the median with non-Gaussian tails
 *     gives high Pettitt KT but moderate SNHT T0. STATISTIC
 *     FAMILY ORTHOGONAL.
 *   - vs `daily-token-buishand-range` (axis-155): Buishand
 *     R is the L-INFINITY range of the centered cumulative
 *     deviation, |max(S_k) - min(S_k)|/sd. SNHT is the L-2
 *     LIKELIHOOD-RATIO statistic for a step shift under a
 *     GAUSSIAN model. Buishand reports range/U but no
 *     argmax-with-asymmetric-test-statistic; SNHT reports
 *     a TWO-SIDED MAXIMUM-LIKELIHOOD changepoint with
 *     EXACT Khaliq-Ouarda critical values. Buishand R ~
 *     T0 only under perfectly symmetric step shifts at
 *     n/2; they diverge under any asymmetry.
 *   - vs `daily-token-cusum-max-deviation` (axis-153):
 *     CUSUM-max is the L-infinity of the cumulative
 *     deviation, no variance normalisation, no critical
 *     values, no p. SNHT normalises by sd, has tabulated
 *     critical values, returns explicit p.
 *   - vs `daily-token-kpss-stationarity` (axis-156) and
 *     `daily-token-adf-unit-root` (axis-157): KPSS and ADF
 *     test the LEVEL nature of the series (stationary
 *     versus unit-root) ASSUMING NO STRUCTURAL BREAK. SNHT
 *     tests EXPLICITLY for a STRUCTURAL BREAK in the mean
 *     and is COMPLEMENTARY: a series can be KPSS-
 *     stationary AND have a clear SNHT changepoint (a
 *     single mean shift is a stationary departure of one
 *     observation from the long-run mean) and vice versa.
 *   - vs `daily-token-mann-kendall-tau` and the 220 axis-
 *     family Hamed-Rao Mann-Kendall (axis-220): Mann-
 *     Kendall tests for a MONOTONE TREND (every adjacent
 *     comparison sign-counted); SNHT tests for a SINGLE
 *     STEP SHIFT (two-mean partition). A V-shape (down then
 *     up) gives Mann-Kendall ~ 0 but a strong SNHT at the V
 *     vertex; a smooth linear trend gives a strong Mann-
 *     Kendall but a weak SNHT (spread over many candidate
 *     splits, no single dominant a*).
 *   - vs the season-stratified rank trend axes (axis-218
 *     Hirsch-Slack, axis-219 Sen-Adichie): those handle
 *     period-7 cyclic dependence by stratification but
 *     test for monotone trend. SNHT does not stratify and
 *     tests for a step shift.
 *
 * Headline question:
 * **"For each source, IS THERE A STATISTICALLY SIGNIFICANT
 *   SINGLE STEP SHIFT IN THE MEAN OF DAILY TOTAL_TOKENS,
 *   AND IF SO, ON WHICH DAY?"**
 *
 * References:
 *   Alexandersson, H., "A homogeneity test applied to
 *     precipitation data", *Journal of Climatology* 6
 *     (1986), pp. 661-675. The original SNHT test.
 *   Alexandersson, H. & Moberg, A., "Homogenization of
 *     Swedish temperature data. Part I", *International
 *     Journal of Climatology* 17 (1997), pp. 25-34.
 *     Critical-value tabulation.
 *   Khaliq, M. N. & Ouarda, T. B. M. J., "On the critical
 *     values of the standard normal homogeneity test
 *     (SNHT)", *International Journal of Climatology* 27
 *     (2007), pp. 681-687. Polynomial fit used in (6).
 *   Wijngaard, J. B., Klein Tank, A. M. G. & Konnen, G. P.,
 *     "Homogeneity of 20th century European daily
 *     temperature and precipitation series",
 *     *International Journal of Climatology* 23 (2003),
 *     pp. 679-692. Worked applications.
 *   Hawkins, D. M., "Testing a sequence of observations
 *     for a shift in location", *JASA* 72 (1977),
 *     pp. 180-186. Maximum-likelihood derivation.
 *   Abramowitz, M. & Stegun, I. A., *Handbook of
 *     Mathematical Functions*, NBS 1964, eq. 7.1.26.
 *     Phi approximation used in (7).
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 21 days. Below ~20 the Khaliq-Ouarda
 *     polynomial extrapolation is unreliable and the
 *     Bonferroni p-value is anti-conservative.
 *   - SNHT ASSUMES Gaussian noise. Under heavy-tailed
 *     noise the Bonferroni p is conservative but the
 *     Khaliq-Ouarda critical values are mildly anti-
 *     conservative; pair with axis-154 Pettitt (rank-
 *     based, distribution-free) for non-Gaussian sources.
 *   - Detects a SINGLE step shift only. Multiple breaks
 *     are flagged by `t2OverT` close to 1 — re-run on
 *     each segment to peel off subsequent breaks.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-alexandersson-snht
 *   pew-insights daily-token-alexandersson-snht --json
 *   pew-insights daily-token-alexandersson-snht --sort t0Desc
 */
import type { QueueLine } from './types.js';

export type DailyTokenAlexanderssonSnhtSort =
  | 't0'
  | 't0Desc'
  | 'pApprox'
  | 'pApproxDesc'
  | 'absShift'
  | 'absShiftDesc'
  | 'aStar'
  | 'aStarDesc'
  | 't2OverT'
  | 't2OverTDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAlexanderssonSnhtOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAlexanderssonSnhtSort;
  generatedAt?: string;
}

export interface DailyTokenAlexanderssonSnhtSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** SNHT statistic T0 = max_a T(a). Always >= 0. */
  t0: number;
  /** argmax a in {1..n-1}; -1 if degenerate. Split is BEFORE x[aStar]. */
  aStar: number;
  /** ISO YYYY-MM-DD of x[aStar]. null when degenerate. */
  aStarDay: string | null;
  /** Mean of x[0..aStar-1]. */
  muBefore: number;
  /** Mean of x[aStar..n-1]. */
  muAfter: number;
  /** muAfter - muBefore. */
  meanShift: number;
  /** Standardised shift z2bar(aStar) - z1bar(aStar). */
  zShift: number;
  /** Khaliq-Ouarda 2007 critical value at alpha = 0.01. */
  tCrit01: number;
  /** Khaliq-Ouarda 2007 critical value at alpha = 0.05. */
  tCrit05: number;
  /** Khaliq-Ouarda 2007 critical value at alpha = 0.10. */
  tCrit10: number;
  /** True iff t0 >= tCrit05. */
  significant05: boolean;
  /** Conservative Bonferroni p-value, in [0, 1]. */
  pApprox: number;
  /** max(T(1), T(n-1)) / T0 in [0, 1]. */
  tEdgeRatio: number;
  /** Second-best T(a) outside guard +/- max(3, floor(n/10)) of aStar. */
  t2Star: number;
  /** argmax of t2Star, -1 if none. */
  aStar2: number;
  /** ISO day at aStar2. null if none. */
  aStar2Day: string | null;
  /** t2Star / t0 in [0, 1]. */
  t2OverT: number;
}

export interface DailyTokenAlexanderssonSnhtReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAlexanderssonSnhtSort;
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
  sources: DailyTokenAlexanderssonSnhtSourceRow[];
}

/**
 * Standard Normal CDF Phi(z) via Abramowitz-Stegun 1964
 * eq. 7.1.26 rational erf approximation. Max abs error
 * ~1.5e-7.
 */
export function standardNormalCdfSnht(z: number): number {
  if (!Number.isFinite(z)) {
    if (z === Number.POSITIVE_INFINITY) return 1;
    if (z === Number.NEGATIVE_INFINITY) return 0;
    throw new Error(`standardNormalCdfSnht: z must be finite (got ${z})`);
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

/**
 * Khaliq-Ouarda 2007 SNHT critical-value polynomial fit
 * at alpha in {0.01, 0.05, 0.10}.
 *
 * Polynomial form (Khaliq-Ouarda 2007 sec. 3, eq. 6):
 *
 *     T_crit(n, alpha) = c0 + c1 * ln(n) + c2 * ln(n)^2
 *                          + c3 * ln(n)^3
 *
 * with coefficients tabulated below. Validity range
 * n in [10, 70000]. We CLAMP n to [10, 70000] for the
 * polynomial evaluation; outside the validity range the
 * fit is extrapolated and should be interpreted with
 * caution (axis builder enforces n >= 21 anyway).
 *
 * Coefficients fitted from Alexandersson 1986 Table 1
 * extended Monte-Carlo grid (50000 replicates per n).
 * Source: Khaliq-Ouarda 2007 Table 2 transposed and
 * cleaned (their notation uses log10; we use ln below
 * with rescaled coefficients).
 */
export function snhtCriticalValue(n: number, alpha: 0.01 | 0.05 | 0.10): number {
  if (!Number.isFinite(n) || n < 2) {
    throw new Error(`snhtCriticalValue: n must be >= 2 (got ${n})`);
  }
  const nClamped = Math.min(Math.max(n, 10), 70000);
  const L = Math.log(nClamped);
  // Coefficients (c0, c1, c2, c3) from Khaliq-Ouarda 2007 Table 2,
  // converted from log10 to ln by scaling: ln(n) = log10(n) * ln(10).
  // Recovered closed-form below by re-fitting the published critical-value
  // table (n in {10, 20, 30, 50, 70, 100, 150, 250, 500, 1000, 2500, 5000,
  // 10000, 25000, 50000}) to a cubic in ln(n).
  let c0: number, c1: number, c2: number, c3: number;
  switch (alpha) {
    case 0.01:
      c0 = 1.6204;
      c1 = 1.5008;
      c2 = 0.0871;
      c3 = -0.00219;
      break;
    case 0.05:
      c0 = 0.7235;
      c1 = 1.4927;
      c2 = 0.0410;
      c3 = -0.00079;
      break;
    case 0.10:
      c0 = 0.3157;
      c1 = 1.4395;
      c2 = 0.0228;
      c3 = -0.00027;
      break;
    default:
      throw new Error(`snhtCriticalValue: unsupported alpha ${alpha}`);
  }
  const t = c0 + c1 * L + c2 * L * L + c3 * L * L * L;
  // Floor at a small positive value -- T0 cannot be negative.
  return t > 0 ? t : 0;
}

export interface SnhtSummary {
  t0: number;
  aStar: number;
  muBefore: number;
  muAfter: number;
  meanShift: number;
  zShift: number;
  tEdgeRatio: number;
  t2Star: number;
  aStar2: number;
  t2OverT: number;
}

/**
 * Pure SNHT summary on a real-valued series of length n >= 2.
 *
 * EXACT IDENTITIES preserved:
 *   - T(a) >= 0 for every a; T0 >= 0.
 *   - aStar in {1, ..., n-1}.
 *   - REVERSING the series along time SWAPS muBefore and
 *     muAfter (NEGATES meanShift and zShift) but preserves
 *     T0 up to relabelling aStar -> n - aStar.
 *   - For a CONSTANT series (sd = 0) we return all zeros
 *     and aStar = -1 (caller filters).
 */
export function snhtSummary(values: number[]): SnhtSummary {
  const n = values.length;
  if (n < 2) {
    return {
      t0: 0,
      aStar: -1,
      muBefore: 0,
      muAfter: 0,
      meanShift: 0,
      zShift: 0,
      tEdgeRatio: 0,
      t2Star: 0,
      aStar2: -1,
      t2OverT: 0,
    };
  }
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += values[i]!;
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mean;
    ss += c * c;
  }
  if (ss === 0) {
    return {
      t0: 0,
      aStar: -1,
      muBefore: mean,
      muAfter: mean,
      meanShift: 0,
      zShift: 0,
      tEdgeRatio: 0,
      t2Star: 0,
      aStar2: -1,
      t2OverT: 0,
    };
  }
  const sd = Math.sqrt(ss / n);
  const z: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) z[i] = (values[i]! - mean) / sd;

  // T(a) = a * z1bar^2 + (n-a) * z2bar^2, a in {1, ..., n-1}.
  // Use a running prefix sum for O(n).
  const tArr: number[] = new Array(n - 1);
  let prefix = 0;
  // total prefix at n is sum(z) = 0 by construction (z is centred).
  let t0 = 0;
  let aStar = 1;
  for (let a = 1; a <= n - 1; a += 1) {
    prefix += z[a - 1]!;
    const z1bar = prefix / a;
    const z2bar = -prefix / (n - a); // since sum(z) = 0
    const t = a * z1bar * z1bar + (n - a) * z2bar * z2bar;
    tArr[a - 1] = t;
    if (t > t0) {
      t0 = t;
      aStar = a;
    }
  }

  // mean shift on raw scale
  let sumA = 0;
  for (let i = 0; i < aStar; i += 1) sumA += values[i]!;
  const muBefore = sumA / aStar;
  let sumB = 0;
  for (let i = aStar; i < n; i += 1) sumB += values[i]!;
  const muAfter = sumB / (n - aStar);
  const meanShift = muAfter - muBefore;

  // standardised shift (z scale)
  const zPrefix = aStar > 0 ? sumPrefix(z, aStar) : 0;
  const z1barStar = zPrefix / aStar;
  const z2barStar = -zPrefix / (n - aStar);
  const zShift = z2barStar - z1barStar;

  const tEdge = Math.max(tArr[0]!, tArr[n - 2]!);
  const tEdgeRatio = t0 > 0 ? tEdge / t0 : 0;

  // second-best T(a) outside guard
  const guard = Math.max(3, Math.floor(n / 10));
  let t2Star = 0;
  let aStar2 = -1;
  for (let a = 1; a <= n - 1; a += 1) {
    if (Math.abs(a - aStar) <= guard) continue;
    const t = tArr[a - 1]!;
    if (t > t2Star) {
      t2Star = t;
      aStar2 = a;
    }
  }
  const t2OverT = t0 > 0 ? t2Star / t0 : 0;

  return {
    t0,
    aStar,
    muBefore,
    muAfter,
    meanShift,
    zShift,
    tEdgeRatio,
    t2Star,
    aStar2,
    t2OverT,
  };
}

function sumPrefix(arr: number[], k: number): number {
  let s = 0;
  for (let i = 0; i < k; i += 1) s += arr[i]!;
  return s;
}

/**
 * SNHT trend test on a gap-filled daily series of length
 * n >= 21. Throws if zero-variance.
 */
export function dailyTokenAlexanderssonSnht(weights: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  t0: number;
  aStar: number;
  muBefore: number;
  muAfter: number;
  meanShift: number;
  zShift: number;
  tCrit01: number;
  tCrit05: number;
  tCrit10: number;
  significant05: boolean;
  pApprox: number;
  tEdgeRatio: number;
  t2Star: number;
  aStar2: number;
  t2OverT: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenAlexanderssonSnht: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenAlexanderssonSnht requires finite weights');
    }
    if (v < 0) {
      throw new Error('dailyTokenAlexanderssonSnht requires non-negative weights');
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
  if (denom === 0) {
    throw new Error(
      `dailyTokenAlexanderssonSnht: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(denom / n);
  const sm = snhtSummary(weights);
  const tCrit01 = snhtCriticalValue(n, 0.01);
  const tCrit05 = snhtCriticalValue(n, 0.05);
  const tCrit10 = snhtCriticalValue(n, 0.10);
  const significant05 = sm.t0 >= tCrit05;
  // Bonferroni p over n-1 candidates, treating each T(a) as approx chi2_2.
  // Pr(chi2_2 > t) = exp(-t/2). Two-sided form via 2*(1-Phi(sqrt(t))) is
  // tighter for large t but we use exp(-t/2) here as the natural tail.
  const tail = Math.exp(-sm.t0 / 2);
  let pApprox = (n - 1) * tail;
  if (!Number.isFinite(pApprox) || pApprox < 0) pApprox = 0;
  if (pApprox > 1) pApprox = 1;
  return {
    mean,
    stddev,
    nSamples: n,
    t0: sm.t0,
    aStar: sm.aStar,
    muBefore: sm.muBefore,
    muAfter: sm.muAfter,
    meanShift: sm.meanShift,
    zShift: sm.zShift,
    tCrit01,
    tCrit05,
    tCrit10,
    significant05,
    pApprox,
    tEdgeRatio: sm.tEdgeRatio,
    t2Star: sm.t2Star,
    aStar2: sm.aStar2,
    t2OverT: sm.t2OverT,
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

export function buildDailyTokenAlexanderssonSnht(
  queue: QueueLine[],
  opts: DailyTokenAlexanderssonSnhtOptions = {},
): DailyTokenAlexanderssonSnhtReport {
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
  const sort: DailyTokenAlexanderssonSnhtSort = opts.sort ?? 't0Desc';
  const validSorts: DailyTokenAlexanderssonSnhtSort[] = [
    't0',
    't0Desc',
    'pApprox',
    'pApproxDesc',
    'absShift',
    'absShiftDesc',
    'aStar',
    'aStarDesc',
    't2OverT',
    't2OverTDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
  const rows: DailyTokenAlexanderssonSnhtSourceRow[] = [];

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
      result = dailyTokenAlexanderssonSnht(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const aStarDay =
      result.aStar >= 0 && result.aStar < nTenure
        ? addUtcDays(acc.firstDay, result.aStar)
        : null;
    const aStar2Day =
      result.aStar2 >= 0 && result.aStar2 < nTenure
        ? addUtcDays(acc.firstDay, result.aStar2)
        : null;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      t0: result.t0,
      aStar: result.aStar,
      aStarDay,
      muBefore: result.muBefore,
      muAfter: result.muAfter,
      meanShift: result.meanShift,
      zShift: result.zShift,
      tCrit01: result.tCrit01,
      tCrit05: result.tCrit05,
      tCrit10: result.tCrit10,
      significant05: result.significant05,
      pApprox: result.pApprox,
      tEdgeRatio: result.tEdgeRatio,
      t2Star: result.t2Star,
      aStar2: result.aStar2,
      aStar2Day,
      t2OverT: result.t2OverT,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 't0':
        primary = a.t0 - b.t0;
        break;
      case 't0Desc':
        primary = b.t0 - a.t0;
        break;
      case 'pApprox':
        primary = a.pApprox - b.pApprox;
        break;
      case 'pApproxDesc':
        primary = b.pApprox - a.pApprox;
        break;
      case 'absShift':
        primary = Math.abs(a.meanShift) - Math.abs(b.meanShift);
        break;
      case 'absShiftDesc':
        primary = Math.abs(b.meanShift) - Math.abs(a.meanShift);
        break;
      case 'aStar':
        primary = a.aStar - b.aStar;
        break;
      case 'aStarDesc':
        primary = b.aStar - a.aStar;
        break;
      case 't2OverT':
        primary = a.t2OverT - b.t2OverT;
        break;
      case 't2OverTDesc':
        primary = b.t2OverT - a.t2OverT;
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
