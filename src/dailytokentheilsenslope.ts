/**
 * daily-token-theil-sen-slope: per-source THEIL-SEN MEDIAN
 * PAIRWISE SLOPE on the gap-filled daily total_tokens
 * series, with rank-based confidence interval inverted from
 * the Kendall tau distribution (Sen 1968).
 *
 * TWO-HUNDRED-AND-FOURTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays)
 * with the natural integer time index t[i] = i. Form all
 * N = n*(n-1)/2 pairwise slopes
 *
 *     s_{i,j} = (x[j] - x[i]) / (j - i)     for i < j
 *
 * The Theil-Sen point estimate of slope is the SAMPLE
 * MEDIAN of {s_{i,j}}:
 *
 *     theilSenSlope = median_{i<j} s_{i,j}
 *
 * The Theil-Sen INTERCEPT is the median of x[i] - slope*i
 * (Sen 1968 sec. 3 -- equivariant to additive shifts in t).
 *
 * Units. Tokens per day. Sign-correctly oriented:
 *   theilSenSlope > 0 = systematic up-drift in tokens/day
 *   theilSenSlope < 0 = systematic down-drift
 *   theilSenSlope = 0 = no drift (null)
 *
 * Confidence interval (Sen 1968). Order the N pairwise
 * slopes ascending: s_(1) <= s_(2) <= .. <= s_(N). Sen
 * showed that for any confidence level 1-alpha the
 * conservative two-sided CI is the order-statistic pair
 * (s_(M_lo), s_(M_hi)) with
 *
 *     C_alpha = z_{1-alpha/2} * sqrt(VarS)
 *     M_lo    = floor((N - C_alpha) / 2)
 *     M_hi    = ceil((N + C_alpha) / 2) + 1
 *
 * where VarS is the tie-corrected Mann-Kendall variance of
 * the S statistic (Hipel & McLeod 1994 eq. 23.1.5):
 *
 *     VarS = ( n*(n-1)*(2n+5) - sum_g t_g*(t_g-1)*(2*t_g+5) ) / 18
 *
 * with t_g the size of the g-th group of tied values in x.
 * The default alpha = 0.05 gives a two-sided 95% CI;
 * `confidenceLevel` is configurable.
 *
 * The CI bounds are PAIRWISE-SLOPE order statistics, NOT
 * Gaussian intervals around the slope median, so the CI is
 * non-symmetric in general. We surface `theilSenSlopeCiLow`,
 * `theilSenSlopeCiHigh`, and the order-statistic ranks
 * `mLo` (1-indexed), `mHi` (1-indexed) used to extract them.
 *
 * Sign-resolved pair partition. We additionally surface a
 * unique three-bucket pair partition keyed on the SIGN of
 * each pairwise slope:
 *
 *     pairsPositive = #{(i, j) : s_{i,j} > 0}
 *     pairsNegative = #{(i, j) : s_{i,j} < 0}
 *     pairsZero     = #{(i, j) : s_{i,j} = 0}
 *
 * pairsPositive + pairsNegative + pairsZero = N and the
 * difference (pairsPositive - pairsNegative) is exactly the
 * sign-resolved Mann-Kendall S statistic (axis-110), but
 * note that this axis reports the MEDIAN PAIRWISE SLOPE
 * MAGNITUDE in tokens/day units -- a fundamentally different
 * scalar from the unitless tau / Z reported by axes 110 /
 * 210 / 213.
 *
 * (Theil, H., "A rank-invariant method of linear and
 * polynomial regression analysis", Indagationes Mathematicae
 * 12 (1950), pp. 85-91, 173-177, 467-482; Sen, P. K.,
 * "Estimates of the regression coefficient based on
 * Kendall's tau", J. Amer. Statist. Assoc. 63(324) (1968),
 * pp. 1379-1389; Hipel, K. W. and McLeod, A. I.,
 * "Time Series Modelling of Water Resources and
 * Environmental Systems", Elsevier, 1994, ch. 23.)
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS:
 *
 *   - Class. ROBUST POINT-ESTIMATOR OF SLOPE MAGNITUDE.
 *     Asymptotic breakdown ~29.3 percent (Sen 1968 sec. 5):
 *     up to ~3-in-10 outlier days can be moved arbitrarily
 *     without dragging the slope median past a finite limit.
 *     This is the FIRST daily-token axis that yields a
 *     directly INTERPRETABLE TOKENS-PER-DAY MAGNITUDE for
 *     the trend; every prior trend axis (110, 205, 207, 208,
 *     209, 210, 211, 212, 213) returns a unitless rank /
 *     normal / chi-square test statistic.
 *
 *   - vs axis-110 Mann-Kendall tau. MK tau is the unitless
 *     normalised pair-concordance count tau in [-1, +1]; it
 *     answers "is the trend monotonic?". Theil-Sen answers
 *     "what is the slope magnitude in tokens/day?" using the
 *     same N pairs but reducing them by MEDIAN of the slope
 *     values, not by sign-tally. A series can have MK tau
 *     close to +1 with a small slope (slow steady drift)
 *     OR close to +1 with a large slope (fast steady drift);
 *     MK tau cannot distinguish these two cases.
 *
 *   - vs axis-210 Daniels rank correlation with time. Daniels
 *     is Spearman's rho between rank(x[i]) and rank(t[i]) =
 *     i+1; it is unitless and saturates at +/-1 for any
 *     monotone series regardless of slope magnitude.
 *     Theil-Sen carries token-per-day units and is sensitive
 *     to slope magnitude.
 *
 *   - vs axis-213 Page's L block trend. Page's L is a within-
 *     3-day-block ordered-alternative test on midranks; it
 *     is unitless, LOCAL, and saturates by construction.
 *     Theil-Sen is GLOBAL across all C(n,2) pairs and yields
 *     a magnitude.
 *
 *   - vs axis-211 Brown-Mood / axis-212 Olmstead-Tukey. Both
 *     are 2x2 contingency / corner-count tests on binary
 *     median- or extremal-classified observations. Theil-Sen
 *     uses raw values across all C(n,2) pairs.
 *
 *   - vs OLS slope (no current daily-token axis -- see source-
 *     daily-token-trend-slope which does OLS on daily
 *     aggregates per source). OLS has 0% breakdown and is
 *     pulled arbitrarily by a single late spike; Theil-Sen
 *     median is invariant to such spikes up to the ~29%
 *     breakdown bound. Even on outlier-free Gaussian data
 *     the two slopes only coincide in expectation under the
 *     null; under a single up-spike the OLS slope rises
 *     unboundedly while Theil-Sen barely moves.
 *
 *   - vs the inequality / shape / spectral / fractal axes.
 *     Those are PERMUTATION-INVARIANT functionals of the
 *     empirical distribution or its frequency-domain
 *     transform. Theil-Sen depends on the TEMPORAL ORDER --
 *     reverse-sorting x negates the slope.
 *
 *   - vs the per-row Theil-Sen lens
 *     (`source-row-token-theil-sen-slope`). That axis runs
 *     Theil-Sen on the per-MESSAGE row total_tokens against
 *     the row INDEX (not calendar time) and gives a slope
 *     in tokens/row. The current axis runs Theil-Sen on the
 *     gap-filled DAILY TOTAL_TOKENS series against calendar
 *     day index, in tokens/day. The two estimators have
 *     different units, different sample spaces (rows vs
 *     gap-filled days), and different null distributions
 *     (per-row order vs gap-filled calendar order). The two
 *     ranks routinely disagree: bursty single-day spikes
 *     show up in the per-row estimator as many concordant
 *     row pairs but in the per-day estimator as a single
 *     daily aggregate.
 *
 * Headline question:
 * **"For each source, what is the ROBUST MEDIAN PAIRWISE
 *   SLOPE of daily token totals against calendar day, in
 *   tokens/day, and what is its Sen 1968 rank-based
 *   1-alpha confidence interval?"**
 *
 * Reference:
 *   Theil, H., "A rank-invariant method of linear and
 *     polynomial regression analysis", Indagationes
 *     Mathematicae 12 (1950), pp. 85-91, 173-177, 467-482.
 *   Sen, P. K., "Estimates of the regression coefficient
 *     based on Kendall's tau", J. Amer. Statist. Assoc.
 *     63(324) (1968), pp. 1379-1389.
 *   Hipel, K. W. and McLeod, A. I., "Time Series Modelling
 *     of Water Resources and Environmental Systems",
 *     Elsevier, 1994, ch. 23.
 *   Wilcox, R. R., "Introduction to Robust Estimation and
 *     Hypothesis Testing", 4th ed., Academic Press, 2017,
 *     ch. 10 (~29.3% breakdown bound on the median pairwise
 *     slope).
 *
 * Caveats:
 *
 *   - Complexity. The pairwise-slope set has O(n^2) entries.
 *     For tenures up to a few thousand days this is well
 *     under a few hundred milliseconds; no Siegel-1982
 *     repeated-median or Knight (1966) merge-sort O(n log n)
 *     optimisation is warranted at this scale and the
 *     explicit pair loop keeps the tie / CI semantics
 *     auditable.
 *   - Tied days. In the gap-filled regime, sparse days are
 *     zero-padded so multiple indices may share x = 0. The
 *     pairwise slope between two zero-days is exactly 0
 *     (contributes to pairsZero). The tie-corrected VarS
 *     accounts for this via the standard Hipel-McLeod
 *     correction.
 *   - The CI is conservative -- it is the EXACT distribution-
 *     free interval inverted from the Kendall tau null
 *     distribution; for moderate n it tends to be slightly
 *     wider than a Studentized parametric CI but does not
 *     require any distributional assumption on x.
 *   - Theil-Sen does NOT detect non-linear / non-monotone
 *     trends. A symmetric tent x = (1, 2, .., n/2, .., 2, 1)
 *     has theilSenSlope close to 0 even though x is not
 *     constant; pair Page's L (axis-213) or turning-point-
 *     rate to detect such structure.
 *   - The naive endpoint slope (x[n-1] - x[0]) / (n-1) is
 *     reported as `naiveEndpointSlope` for triage; it is
 *     the slope of one of the n-1 pairs that include index
 *     0 and is dominated by the two endpoints.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14, 95% CI):
 *   pew-insights daily-token-theil-sen-slope
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-theil-sen-slope \
 *     --source vscode-other --json
 *
 *   # 99% CI, sort by absolute slope descending (steepest
 *   # trend first):
 *   pew-insights daily-token-theil-sen-slope \
 *     --confidence-level 0.99 --sort slopeAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenTheilSenSlopeSort =
  | 'slope'
  | 'slopeDesc'
  | 'slopeAbs'
  | 'slopeAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTheilSenSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 (need
   * at least C(4,2)=6 pairwise slopes for a stable median).
   */
  minTenureDays?: number;
  /**
   * Two-sided confidence level for the Sen 1968 rank-based
   * CI. In (0, 1); default 0.95.
   */
  confidenceLevel?: number;
  top?: number;
  sort?: DailyTokenTheilSenSlopeSort;
  generatedAt?: string;
}

export interface DailyTokenTheilSenSlopeSourceRow {
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
  /** Median of the gap-filled tenure series. */
  median: number;
  /** Median of all C(n,2) pairwise slopes, in tokens/day. */
  theilSenSlope: number;
  /** Theil-Sen intercept = median(x[i] - slope * i). */
  theilSenIntercept: number;
  /** Naive endpoint slope (x[n-1] - x[0]) / (n - 1). */
  naiveEndpointSlope: number;
  /** Total number of pairwise slopes = n*(n-1)/2. */
  nPairs: number;
  /** Pairs with strictly positive slope. */
  pairsPositive: number;
  /** Pairs with strictly negative slope. */
  pairsNegative: number;
  /** Pairs with exactly zero slope (tied values). */
  pairsZero: number;
  /** Tie-corrected Var[S] (Mann-Kendall variance). */
  mannKendallVarS: number;
  /** Sen 1968 lower bound on slope (order-statistic). */
  theilSenSlopeCiLow: number;
  /** Sen 1968 upper bound on slope (order-statistic). */
  theilSenSlopeCiHigh: number;
  /** 1-indexed lower order-statistic rank used. */
  mLo: number;
  /** 1-indexed upper order-statistic rank used. */
  mHi: number;
  /** Realised confidence level (= input confidenceLevel). */
  confidenceLevel: number;
}

export interface DailyTokenTheilSenSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  confidenceLevel: number;
  top: number;
  sort: DailyTokenTheilSenSlopeSort;
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
  sources: DailyTokenTheilSenSlopeSourceRow[];
}

/**
 * Inverse standard-normal CDF via Beasley-Springer-Moro.
 * Used only to compute z_{1-alpha/2} for the Sen 1968 CI;
 * we keep this self-contained to avoid a dependency.
 *
 * Accuracy: |error| < 1.15e-9 across (0, 1).
 *
 * (Beasley & Springer 1977, Appl. Stat. 26(1):118-121;
 * Moro 1995 in The Complete Guide to Option Pricing
 * Formulas.)
 */
function invNormalCdf(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new Error(`invNormalCdf requires p in (0, 1) (got ${p})`);
  }
  // Beasley-Springer-Moro coefficients.
  const a = [
    -3.969_683_028_665_376e1,
    2.209_460_984_245_205e2,
    -2.759_285_104_469_687e2,
    1.383_577_518_672_69e2,
    -3.066_479_806_614_716e1,
    2.506_628_277_459_239,
  ];
  const b = [
    -5.447_609_879_822_406e1,
    1.615_858_368_580_409e2,
    -1.556_989_798_598_866e2,
    6.680_131_188_771_972e1,
    -1.328_068_155_288_572e1,
  ];
  const c = [
    -7.784_894_002_430_293e-3,
    -3.223_964_580_411_365e-1,
    -2.400_758_277_161_838,
    -2.549_732_539_343_734,
    4.374_664_141_464_968,
    2.938_163_982_698_783,
  ];
  const d = [
    7.784_695_709_041_462e-3,
    3.224_671_290_700_398e-1,
    2.445_134_137_142_996,
    3.754_408_661_907_416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
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
  return (
    -(
      ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!
    ) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

function median(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return 0;
  const mid = m >> 1;
  if (m % 2 === 1) return sorted[mid]!;
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * Theil-Sen median pairwise slope of x against the integer
 * time index t = 0, 1, ..., n-1, with rank-based Sen 1968
 * CI inverted from the tie-corrected Mann-Kendall variance.
 *
 * Closed-form sanity anchors:
 *   - x = (1, 2, ..., n) -> theilSenSlope = 1, intercept = 0,
 *     pairsPositive = n*(n-1)/2, pairsNegative = pairsZero =
 *     0.
 *   - x = (n, n-1, ..., 1) -> theilSenSlope = -1, pairsNeg
 *     = n*(n-1)/2.
 *   - x = (c, c, ..., c) -> theilSenSlope = 0, all pairs
 *     zero.
 *   - x = (a + b*t + eps_t) with iid eps -> theilSenSlope is
 *     a consistent estimator of b (Sen 1968 sec. 6).
 *
 * Throws when n < 4 or any value is non-finite.
 */
export function dailyTokenTheilSenSlope(
  values: number[],
  confidenceLevel = 0.95,
): {
  mean: number;
  stddev: number;
  median: number;
  nSamples: number;
  theilSenSlope: number;
  theilSenIntercept: number;
  naiveEndpointSlope: number;
  nPairs: number;
  pairsPositive: number;
  pairsNegative: number;
  pairsZero: number;
  mannKendallVarS: number;
  theilSenSlopeCiLow: number;
  theilSenSlopeCiHigh: number;
  mLo: number;
  mHi: number;
  confidenceLevel: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenTheilSenSlope: need at least 4 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenTheilSenSlope requires finite values');
    }
  }
  if (
    !Number.isFinite(confidenceLevel) ||
    confidenceLevel <= 0 ||
    confidenceLevel >= 1
  ) {
    throw new Error(
      `dailyTokenTheilSenSlope: confidenceLevel must be in (0, 1) (got ${confidenceLevel})`,
    );
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let varSum = 0;
  for (const val of values) {
    const d = val - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const sortedVals = values.slice().sort((a, b) => a - b);
  const med = median(sortedVals);

  // O(n^2) pairwise slope accumulation. n is bounded by
  // tenure days (typically a few hundred) so this is fine.
  const nPairs = (n * (n - 1)) / 2;
  const slopes = new Array<number>(nPairs);
  let pairsPositive = 0;
  let pairsNegative = 0;
  let pairsZero = 0;
  let k = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const xi = values[i]!;
    for (let j = i + 1; j < n; j += 1) {
      const s = (values[j]! - xi) / (j - i);
      slopes[k] = s;
      k += 1;
      if (s > 0) pairsPositive += 1;
      else if (s < 0) pairsNegative += 1;
      else pairsZero += 1;
    }
  }
  slopes.sort((a, b) => a - b);
  const theilSenSlope = median(slopes);

  // Theil-Sen intercept = median(x[i] - slope * i).
  const intercepts = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    intercepts[i] = values[i]! - theilSenSlope * i;
  }
  intercepts.sort((a, b) => a - b);
  const theilSenIntercept = median(intercepts);

  const naiveEndpointSlope = (values[n - 1]! - values[0]!) / (n - 1);

  // Tie-corrected Var[S] (Hipel & McLeod 1994 eq. 23.1.5).
  const groupSizes = new Map<number, number>();
  for (const v of values) {
    groupSizes.set(v, (groupSizes.get(v) ?? 0) + 1);
  }
  let tieAdjust = 0;
  for (const t of groupSizes.values()) {
    if (t > 1) {
      tieAdjust += t * (t - 1) * (2 * t + 5);
    }
  }
  const baseVar = n * (n - 1) * (2 * n + 5);
  const mannKendallVarS = (baseVar - tieAdjust) / 18;
  if (!Number.isFinite(mannKendallVarS) || mannKendallVarS < 0) {
    throw new Error(
      `dailyTokenTheilSenSlope: non-finite/negative VarS (n=${n})`,
    );
  }

  // Sen 1968 CI: order-statistic indices.
  // C_alpha = z_{1 - alpha/2} * sqrt(VarS); alpha = 1 - cl.
  const alpha = 1 - confidenceLevel;
  const z = invNormalCdf(1 - alpha / 2);
  const cAlpha = z * Math.sqrt(mannKendallVarS);
  // M_lo = floor((N - C_alpha) / 2); M_hi = ceil((N + C_alpha) / 2) + 1.
  // Convert to 1-indexed order-statistic ranks; clamp to [1, N].
  let mLoFloat = (nPairs - cAlpha) / 2;
  let mHiFloat = (nPairs + cAlpha) / 2 + 1;
  let mLo = Math.floor(mLoFloat);
  let mHi = Math.ceil(mHiFloat);
  if (mLo < 1) mLo = 1;
  if (mHi > nPairs) mHi = nPairs;
  if (mLo > nPairs) mLo = nPairs;
  if (mHi < 1) mHi = 1;
  // s_(mLo) and s_(mHi) in 1-indexed terms => slopes[mLo-1], slopes[mHi-1].
  const theilSenSlopeCiLow = slopes[mLo - 1]!;
  const theilSenSlopeCiHigh = slopes[mHi - 1]!;

  if (
    !Number.isFinite(theilSenSlope) ||
    !Number.isFinite(theilSenIntercept) ||
    !Number.isFinite(theilSenSlopeCiLow) ||
    !Number.isFinite(theilSenSlopeCiHigh)
  ) {
    throw new Error(
      `dailyTokenTheilSenSlope: non-finite output (slope=${theilSenSlope}, intercept=${theilSenIntercept}, ciLow=${theilSenSlopeCiLow}, ciHigh=${theilSenSlopeCiHigh})`,
    );
  }

  return {
    mean: mu,
    stddev,
    median: med,
    nSamples: n,
    theilSenSlope,
    theilSenIntercept,
    naiveEndpointSlope,
    nPairs,
    pairsPositive,
    pairsNegative,
    pairsZero,
    mannKendallVarS,
    theilSenSlopeCiLow,
    theilSenSlopeCiHigh,
    mLo,
    mHi,
    confidenceLevel,
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

export function buildDailyTokenTheilSenSlope(
  queue: QueueLine[],
  opts: DailyTokenTheilSenSlopeOptions = {},
): DailyTokenTheilSenSlopeReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const confidenceLevel = opts.confidenceLevel ?? 0.95;
  if (
    !Number.isFinite(confidenceLevel) ||
    confidenceLevel <= 0 ||
    confidenceLevel >= 1
  ) {
    throw new Error(
      `confidenceLevel must be in (0, 1) (got ${opts.confidenceLevel})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenTheilSenSlopeSort = opts.sort ?? 'slopeAbsDesc';
  const validSorts: DailyTokenTheilSenSlopeSort[] = [
    'slope',
    'slopeDesc',
    'slopeAbs',
    'slopeAbsDesc',
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
  const rows: DailyTokenTheilSenSlopeSourceRow[] = [];

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
      result = dailyTokenTheilSenSlope(filled, confidenceLevel);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenTheilSenSlopeSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      median: result.median,
      theilSenSlope: result.theilSenSlope,
      theilSenIntercept: result.theilSenIntercept,
      naiveEndpointSlope: result.naiveEndpointSlope,
      nPairs: result.nPairs,
      pairsPositive: result.pairsPositive,
      pairsNegative: result.pairsNegative,
      pairsZero: result.pairsZero,
      mannKendallVarS: result.mannKendallVarS,
      theilSenSlopeCiLow: result.theilSenSlopeCiLow,
      theilSenSlopeCiHigh: result.theilSenSlopeCiHigh,
      mLo: result.mLo,
      mHi: result.mHi,
      confidenceLevel: result.confidenceLevel,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'slope':
        primary = a.theilSenSlope - b.theilSenSlope;
        break;
      case 'slopeDesc':
        primary = b.theilSenSlope - a.theilSenSlope;
        break;
      case 'slopeAbs':
        primary = Math.abs(a.theilSenSlope) - Math.abs(b.theilSenSlope);
        break;
      case 'slopeAbsDesc':
        primary = Math.abs(b.theilSenSlope) - Math.abs(a.theilSenSlope);
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
    confidenceLevel,
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
