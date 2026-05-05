/**
 * daily-token-hogg-adaptive-halves: per-source HOGG 1974
 * ADAPTIVE TWO-SAMPLE LOCATION TEST comparing the first
 * half (n1 = floor(n/2) days) vs second half (n2 = n - n1
 * days) of the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-FOURTH cross-source axis.
 *
 * Mechanism. Hogg, Fisher & Randles (1975, *JASA* 70(351):
 * 656-661) propose a META-TEST that first measures the
 * TAIL WEIGHT of the POOLED sample via the SELECTOR
 * STATISTIC
 *
 *     Q = ( U_05 - M_50 ) / ( M_50 - L_05 )
 *
 * where U_05 = mean of the upper 5% of pooled order
 * statistics, L_05 = mean of the lower 5%, and
 * M_50 = mean of the middle 50% (25th-to-75th percentile
 * trimmed mean). Q is a ROBUST tail-weight scalar with
 * Q ~ 1 for a symmetric medium-tail population.
 * Q substantially > 1 indicates RIGHT-SKEW or HEAVY
 * UPPER-TAIL; Q substantially < 1 indicates LEFT-SKEW or
 * HEAVY LOWER-TAIL.
 *
 * Hogg-Fisher-Randles 1975 then DISPATCHES to the
 * asymptotically-most-efficient two-sample location test
 * among a small library, based on Q's value:
 *
 *     Q < 0.5            -> dispatch HFR1 (Mood's median
 *                           test): heavy left tail, only
 *                           the median is reliably
 *                           informative.
 *     0.5 <= Q < 0.8     -> dispatch HFR2 (Wilcoxon
 *                           rank-sum): moderate left
 *                           skew, ranks are robust.
 *     0.8 <= Q <= 1.25   -> dispatch HFR3 (van der
 *                           Waerden normal-scores): near-
 *                           symmetric, normal-scores are
 *                           asymptotically most
 *                           efficient.
 *     1.25 < Q <= 2.0    -> dispatch HFR2 (Wilcoxon
 *                           rank-sum): moderate right
 *                           skew, ranks are robust.
 *     Q > 2.0            -> dispatch HFR1 (Mood's median
 *                           test): heavy right tail, only
 *                           the median is reliably
 *                           informative.
 *
 * (Threshold values follow Hogg-Fisher-Randles 1975
 * Table 1 simulation-tuned cutoffs, also reproduced in
 * Hettmansperger & McKean 2011 *Robust Nonparametric
 * Statistical Methods* 2nd ed. Table 2.6.2.)
 *
 * The DISPATCHED test is then computed on the same A/B
 * split, producing a standardised Z statistic. Three
 * dispatched-test computations are implemented as PURE
 * INLINE PRIMITIVES (no cross-axis imports) to keep the
 * adaptive selector self-contained:
 *
 *   - HFR1 Mood's-median: a = #{x in A : x > pooledMed},
 *     null E[a] = n1 * (n_above) / n, hypergeometric
 *     variance, Z = (a - E[a]) / sqrt(Var[a]). Continuity
 *     correction is NOT applied (HFR 1975 sec. 2 uses
 *     the uncorrected version for fair Pitman-efficiency
 *     comparison against Wilcoxon and normal-scores).
 *   - HFR2 Wilcoxon: W = sum of A's pooled mid-ranks.
 *     E[W] = n1 (n+1)/2, Var[W] = n1 n2 (n+1) / 12 with
 *     standard tie-correction Var[W] -= n1 n2 *
 *     sum_t (t^3 - t) / (12 n (n - 1)). Z = (W - E[W]) /
 *     sqrt(Var[W]).
 *   - HFR3 van der Waerden: assign normal scores
 *     a_i = Phi^-1( R_i / (n + 1) ) to pooled mid-ranks,
 *     S = sum_{i in A} a_i. E[S] = 0 (centred normal
 *     scores), Var[S] = n1 n2 / (n - 1) * (1/n) sum a_i^2
 *     (Hajek-Sidak 1967 sec. 2.4). Z = S / sqrt(Var[S]).
 *
 * SIGN CONVENTION: hoggZ > 0 <=> SECOND half has LARGER
 * location (median / mean / centred-rank-sum) than the
 * first half. This is achieved by encoding the sign of
 * the dispatched statistic so that ALL three dispatched
 * tests use the SAME directional convention as axis-110
 * mannwhitneyZ, axis-181 vanDerWaerdenZ, axis-189
 * wilcoxonSignedRankZ for direct cross-axis aggregation.
 * Two-sided p-value: hoggPValue = 2 (1 - Phi(|hoggZ|)).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim — distinct
 * from EVERY prior axis, including the rank tests it
 * dispatches to):
 *
 *   - vs axis-110 Mann-Whitney-halves, axis-181 van-der-
 *     Waerden-halves, axis-171 Mood's-median-halves: each
 *     of these uses a SINGLE FIXED score function on
 *     EVERY input regardless of the underlying tail
 *     shape. Hogg-Adaptive uses a DATA-DRIVEN selector Q
 *     to CHOOSE which score function to apply. Two
 *     sources with identical Mann-Whitney Z but different
 *     tail weights will get DIFFERENT hoggZ (one
 *     dispatched to median, the other to van der
 *     Waerden), so the hoggZ value carries STRICTLY MORE
 *     INFORMATION than any single prior rank-location
 *     test. The DISPATCH LABEL itself is a NEW PER-
 *     SOURCE FEATURE not exposed by any prior axis.
 *
 *   - vs axis-201 Kamat-range-ratio / axis-200 Mielke /
 *     axes 117/170/177-179/199 scale tests: those probe
 *     SCALE; Hogg-Adaptive probes LOCATION. Orthogonal
 *     by alternative.
 *
 *   - vs axis-185 Baumgartner-Weiss-Schindler (joint
 *     location-scale): BWS combines location and scale
 *     into a SINGLE QUADRATIC-WEIGHT statistic; Hogg-
 *     Adaptive isolates LOCATION while ROUTING through a
 *     tail-weight selector. BWS cannot tell you WHICH
 *     family of alternative is most consistent with the
 *     data; Hogg-Adaptive makes the selection EXPLICIT
 *     and EXPOSED.
 *
 *   - vs axis-181 Lepage-style joint-combiner / axis-203
 *     David-Barton runs / axis-202 Noether: those are
 *     scale-combined, sign-pattern, and lag-cyclic
 *     respectively; Hogg-Adaptive is none of these.
 *
 *   - vs ANY rank-based meta-test: this codebase has NO
 *     prior adaptive / data-driven test-selection axis.
 *     Hogg-Adaptive is the FIRST axis to expose a
 *     dispatch decision as a primary output channel.
 *
 * The KEY INFORMATION DELIVERED beyond any individual
 * dispatched test is the JOINT (Q, dispatchedTest)
 * fingerprint: heavy-tail sources get routed to median,
 * symmetric sources get routed to normal-scores. This
 * routing decision is itself a REPORTED OUTPUT and can
 * be cross-tabulated against tail-weight axes (axis-176
 * Hampel outlier count, axis-179 Mood scale, axis-200
 * Mielke quartic) for downstream diagnostic compounds.
 *
 * Pre-processing: NONE. The pooled mid-ranks are
 * computed on the raw gap-filled daily totals. Ties are
 * handled by mid-ranks for the Wilcoxon and van-der-
 * Waerden branches; ties at the median are assigned to
 * the AT-OR-BELOW cell for the Mood-median branch.
 *
 * Hard floor on min-tenure-days is 20 (n1 = n2 = 10) so
 * (a) the pooled n = 20 supports a 5%-tail mean with at
 * least one observation per tail, and (b) all three
 * dispatched-test asymptotic normal references hold
 * nominal alpha (Hettmansperger & McKean 2011 sec.
 * 2.6.2 simulation: actual size 0.041-0.057 across
 * n1 = n2 in [10, 50] for the dispatched tests under
 * the 5-region threshold scheme).
 *
 * References:
 *   Hogg, R. V., Fisher, D. M. & Randles, R. H., "A two-
 *     sample adaptive distribution-free test", *JASA*
 *     70(351) (1975), pp. 656-661.
 *   Hogg, R. V., "Adaptive robust procedures: A partial
 *     review and some suggestions for future
 *     applications and theory", *JASA* 69(348) (1974),
 *     pp. 909-923.
 *   Hettmansperger, T. P. & McKean, J. W., *Robust
 *     Nonparametric Statistical Methods* 2nd ed. (CRC
 *     Press 2011), sec. 2.6.2.
 *   Hajek, J. & Sidak, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), sec. 2.4.
 */
import type { QueueLine } from './types.js';

export type HoggAdaptiveDispatch =
  | 'HFR1-mood-median'
  | 'HFR2-wilcoxon'
  | 'HFR3-vanderwaerden';

export type DailyTokenHoggAdaptiveHalvesSort =
  | 'hoggZ'
  | 'hoggZAbsDesc'
  | 'hoggPValue'
  | 'hoggPValueDesc'
  | 'hoggQ'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHoggAdaptiveHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 20
   * (n1 = n2 = 10) so the 5%-tail selector is well-
   * defined and dispatched-test asymptotic normal
   * references hold nominal alpha (Hettmansperger &
   * McKean 2011 sec. 2.6.2).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHoggAdaptiveHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenHoggAdaptiveHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  hoggN1: number;
  /** Second-half size n2 = n - n1. */
  hoggN2: number;
  /** Hogg-Fisher-Randles 1975 tail-weight selector. */
  hoggQ: number;
  /** Dispatched-test label chosen from Q. */
  hoggDispatch: HoggAdaptiveDispatch;
  /** Standardised Z from the dispatched test. */
  hoggZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|hoggZ|)). */
  hoggPValue: number;
}

export interface DailyTokenHoggAdaptiveHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHoggAdaptiveHalvesSort;
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
  /** Dispatch counts across kept rows for quick audit. */
  dispatchCounts: {
    'HFR1-mood-median': number;
    'HFR2-wilcoxon': number;
    'HFR3-vanderwaerden': number;
  };
  sources: DailyTokenHoggAdaptiveHalvesSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8.
 */
export function standardNormalUpperTailHogg(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailHogg: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailHogg(-z);
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
 * Standard-normal inverse CDF Phi^-1(p) using the
 * Beasley-Springer 1977 / Moro 1995 rational
 * approximation; max absolute error ~3e-9 across
 * p in [1e-15, 1 - 1e-15]. Used to assign normal
 * scores for the HFR3 van-der-Waerden dispatch.
 */
export function standardNormalInverseHogg(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new Error(
      `standardNormalInverseHogg: p must be in (0, 1) (got ${p})`,
    );
  }
  // Beasley-Springer-Moro coefficients.
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
  let q: number, r: number;
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
 * Median of an array of finite numbers (does not mutate).
 */
export function medianHogg(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianHogg: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Hogg-Fisher-Randles 1975 tail-weight selector
 * Q = (U_05 - M_50) / (M_50 - L_05) where
 *
 *   U_05 = mean of the upper 5% of order statistics
 *   L_05 = mean of the lower 5% of order statistics
 *   M_50 = mean of the middle 50% (25%-75% trimmed mean)
 *
 * Tail counts use ceil(0.05 n) rounded up so the tails
 * are non-empty for n >= 20 (HFR 1975 sec. 3 convention,
 * matching the n >= 20 hard floor on this axis). Returns
 * a strictly positive Q; throws if the denominator is
 * zero (constant median bulk after trimming).
 */
export function hoggSelectorQ(values: number[]): number {
  const n = values.length;
  if (n < 20) {
    throw new Error(
      `hoggSelectorQ: need at least 20 samples (got ${n})`,
    );
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const tailCount = Math.max(1, Math.ceil(0.05 * n));
  const bulkLow = Math.floor(0.25 * n);
  const bulkHigh = Math.ceil(0.75 * n);
  let lSum = 0;
  for (let i = 0; i < tailCount; i += 1) lSum += sorted[i]!;
  let uSum = 0;
  for (let i = n - tailCount; i < n; i += 1) uSum += sorted[i]!;
  let mSum = 0;
  let mCount = 0;
  for (let i = bulkLow; i < bulkHigh; i += 1) {
    mSum += sorted[i]!;
    mCount += 1;
  }
  if (mCount === 0) {
    throw new Error(`hoggSelectorQ: empty bulk (n=${n})`);
  }
  const lMean = lSum / tailCount;
  const uMean = uSum / tailCount;
  const mMean = mSum / mCount;
  const num = uMean - mMean;
  const den = mMean - lMean;
  if (!(den > 0)) {
    throw new Error(
      `hoggSelectorQ: degenerate bulk-vs-lower-tail gap (den=${den})`,
    );
  }
  return num / den;
}

/**
 * Map a Hogg-Fisher-Randles 1975 selector value Q to one
 * of three dispatched-test labels per HFR 1975 Table 1
 * thresholds (also Hettmansperger & McKean 2011 sec.
 * 2.6.2 Table 2.6.2).
 */
export function hoggDispatchFromQ(q: number): HoggAdaptiveDispatch {
  if (!Number.isFinite(q) || q <= 0) {
    throw new Error(`hoggDispatchFromQ: q must be a positive finite (got ${q})`);
  }
  if (q < 0.5) return 'HFR1-mood-median';
  if (q < 0.8) return 'HFR2-wilcoxon';
  if (q <= 1.25) return 'HFR3-vanderwaerden';
  if (q <= 2.0) return 'HFR2-wilcoxon';
  return 'HFR1-mood-median';
}

/**
 * Pooled mid-ranks of `values`. Returns the rank vector
 * aligned with the input order. Ties are assigned the
 * average of the ranks they would have occupied.
 */
export function midRanksHogg(values: number[]): number[] {
  const n = values.length;
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    const avg = (i + 1 + j) / 2; // average of (i+1)..j
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avg;
    i = j;
  }
  return ranks;
}

/**
 * HFR1: Mood's median two-sample test on (A, B). Returns
 * SIGNED Z with sign convention "Z > 0 <=> B has more
 * observations strictly above the pooled median than
 * expected under H0 of equal location" (so Z > 0 = B
 * located ABOVE A). Continuity correction is NOT applied
 * (HFR 1975 sec. 2 convention for fair Pitman-efficiency
 * comparison against Wilcoxon and normal-scores).
 */
export function hoggMoodMedianZ(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  const n = n1 + n2;
  if (n1 < 2 || n2 < 2) {
    throw new Error('hoggMoodMedianZ: need at least 2 samples per side');
  }
  const pooled = a.concat(b);
  const med = medianHogg(pooled);
  let above = 0;
  for (const v of pooled) if (v > med) above += 1;
  const below = n - above;
  if (above === 0 || below === 0) {
    throw new Error('hoggMoodMedianZ: pooled median splits all/none');
  }
  let bAbove = 0;
  for (const v of b) if (v > med) bAbove += 1;
  // Hypergeometric: number of "above" in B has mean n2 *
  // above / n and variance n2 * (n - n2) * above * below
  // / (n^2 * (n - 1)).
  const mean = (n2 * above) / n;
  const variance =
    (n2 * (n - n2) * above * below) / (n * n * (n - 1));
  if (!(variance > 0)) {
    throw new Error('hoggMoodMedianZ: degenerate variance');
  }
  return (bAbove - mean) / Math.sqrt(variance);
}

/**
 * HFR2: Wilcoxon rank-sum two-sample test on (A, B).
 * Returns SIGNED Z with sign convention "Z > 0 <=> the
 * sum of B's pooled mid-ranks exceeds its null
 * expectation, i.e. B located ABOVE A". Tie-correction
 * applied to the variance (Hollander & Wolfe 1999 eq.
 * 4.4).
 */
export function hoggWilcoxonZ(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  const n = n1 + n2;
  if (n1 < 2 || n2 < 2) {
    throw new Error('hoggWilcoxonZ: need at least 2 samples per side');
  }
  const pooled = a.concat(b);
  const ranks = midRanksHogg(pooled);
  let wB = 0;
  for (let i = n1; i < n; i += 1) wB += ranks[i]!;
  const meanW = (n2 * (n + 1)) / 2;
  // Standard variance with tie correction.
  const sortedVals = pooled.slice().sort((x, y) => x - y);
  let tieAdj = 0;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && sortedVals[j]! === sortedVals[i]!) j += 1;
    const t = j - i;
    if (t > 1) tieAdj += t * t * t - t;
    i = j;
  }
  const variance =
    (n1 * n2 * (n + 1)) / 12 -
    (n1 * n2 * tieAdj) / (12 * n * (n - 1));
  if (!(variance > 0)) {
    throw new Error('hoggWilcoxonZ: degenerate variance');
  }
  return (wB - meanW) / Math.sqrt(variance);
}

/**
 * HFR3: Van-der-Waerden normal-scores two-sample location
 * test on (A, B). Returns SIGNED Z with sign convention
 * "Z > 0 <=> the sum of B's normal scores exceeds 0,
 * i.e. B located ABOVE A". Hajek-Sidak 1967 sec. 2.4
 * variance formula.
 */
export function hoggVanDerWaerdenZ(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  const n = n1 + n2;
  if (n1 < 2 || n2 < 2) {
    throw new Error('hoggVanDerWaerdenZ: need at least 2 samples per side');
  }
  const pooled = a.concat(b);
  const ranks = midRanksHogg(pooled);
  const scores = new Array<number>(n);
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const u = ranks[i]! / (n + 1);
    const sc = standardNormalInverseHogg(u);
    scores[i] = sc;
    sumSq += sc * sc;
  }
  let sB = 0;
  for (let i = n1; i < n; i += 1) sB += scores[i]!;
  // Hajek-Sidak 1967 sec. 2.4: under H0,
  // E[sum_B] = (n2 / n) sum scores = 0 if scores centred.
  // (Phi^-1(R/(n+1)) is centred about 0 when ranks 1..n
  // are symmetric, which they are.) Var[sum_B] = n1 n2 /
  // (n (n - 1)) sum scores^2.
  const variance = (n1 * n2 * sumSq) / (n * (n - 1));
  if (!(variance > 0)) {
    throw new Error('hoggVanDerWaerdenZ: degenerate variance');
  }
  return sB / Math.sqrt(variance);
}

/**
 * Hogg-Fisher-Randles 1975 adaptive two-sample location
 * test on the first half (A = x[0..n1-1]) vs second half
 * (B = x[n1..n-1]) of a real-valued series. Returns the
 * tail-weight selector Q, the dispatched-test label, the
 * dispatched test's signed Z, and the two-sided p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - hoggZ(x + c) === hoggZ(x) for any constant c
 *     (every dispatched test is location-invariant via
 *     ranks or median; Q is computed as a RATIO of
 *     centred quantities so the location shift cancels
 *     ONLY UP TO the change in median/tail means; Q's
 *     value can change but the dispatched-test choice
 *     changes only at threshold boundaries).
 *   - For x with strict positive monotonic ordering
 *     between A and B, hoggZ has a definite sign
 *     consistent with the convention.
 *   - Deterministic: hoggZ(x) evaluated twice returns
 *     bit-identical results (no randomisation).
 */
export function dailyTokenHoggAdaptiveHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  hoggN1: number;
  hoggN2: number;
  hoggQ: number;
  hoggDispatch: HoggAdaptiveDispatch;
  hoggZ: number;
  hoggPValue: number;
} {
  const n = values.length;
  if (n < 20) {
    throw new Error(
      `dailyTokenHoggAdaptiveHalves: need at least 20 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenHoggAdaptiveHalves requires finite values',
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
      `dailyTokenHoggAdaptiveHalves: zero centred variance (n=${n})`,
    );
  }
  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const a = values.slice(0, n1);
  const b = values.slice(n1);

  const q = hoggSelectorQ(values);
  const dispatch = hoggDispatchFromQ(q);
  let z: number;
  switch (dispatch) {
    case 'HFR1-mood-median':
      z = hoggMoodMedianZ(a, b);
      break;
    case 'HFR2-wilcoxon':
      z = hoggWilcoxonZ(a, b);
      break;
    case 'HFR3-vanderwaerden':
      z = hoggVanDerWaerdenZ(a, b);
      break;
  }
  const pValue = 2 * standardNormalUpperTailHogg(Math.abs(z));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    hoggN1: n1,
    hoggN2: n2,
    hoggQ: q,
    hoggDispatch: dispatch,
    hoggZ: z,
    hoggPValue: pValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-204 per-source
 * results. Combines per-source SIGNED hoggZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949).
 *
 * Malformed rows (non-finite hoggZ, hoggPValue not in
 * (0, 1], non-positive nTenureDays) are SKIPPED with a
 * counter rather than throwing.
 */
export interface HoggAdaptiveHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanHoggZ: number;
  tenureWeightedMeanHoggZ: number;
  rowsUsed: number;
  rowsSkipped: number;
  dispatchCounts: {
    'HFR1-mood-median': number;
    'HFR2-wilcoxon': number;
    'HFR3-vanderwaerden': number;
  };
}

export function aggregateHoggAdaptiveHalves(
  rows: ReadonlyArray<{
    hoggZ: number;
    hoggPValue: number;
    nTenureDays: number;
    hoggDispatch: HoggAdaptiveDispatch;
  }>,
): HoggAdaptiveHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  const counts = {
    'HFR1-mood-median': 0,
    'HFR2-wilcoxon': 0,
    'HFR3-vanderwaerden': 0,
  };
  for (const r of rows) {
    if (
      !Number.isFinite(r.hoggZ) ||
      !Number.isFinite(r.hoggPValue) ||
      r.hoggPValue <= 0 ||
      r.hoggPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.hoggZ;
    weightedZSum += r.nTenureDays * r.hoggZ;
    totalTenure += r.nTenureDays;
    used += 1;
    counts[r.hoggDispatch] += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanHoggZ: Number.NaN,
      tenureWeightedMeanHoggZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
      dispatchCounts: counts,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailHogg(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanHoggZ: zSum / used,
    tenureWeightedMeanHoggZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
    dispatchCounts: counts,
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

export function buildDailyTokenHoggAdaptiveHalves(
  queue: QueueLine[],
  opts: DailyTokenHoggAdaptiveHalvesOptions = {},
): DailyTokenHoggAdaptiveHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 20;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 20) {
    throw new Error(
      `minTenureDays must be an integer >= 20 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHoggAdaptiveHalvesSort =
    opts.sort ?? 'hoggZAbsDesc';
  const validSorts: DailyTokenHoggAdaptiveHalvesSort[] = [
    'hoggZ',
    'hoggZAbsDesc',
    'hoggPValue',
    'hoggPValueDesc',
    'hoggQ',
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
  const dispatchCounts = {
    'HFR1-mood-median': 0,
    'HFR2-wilcoxon': 0,
    'HFR3-vanderwaerden': 0,
  };
  const rows: DailyTokenHoggAdaptiveHalvesSourceRow[] = [];

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
      result = dailyTokenHoggAdaptiveHalves(filled);
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
      hoggN1: result.hoggN1,
      hoggN2: result.hoggN2,
      hoggQ: result.hoggQ,
      hoggDispatch: result.hoggDispatch,
      hoggZ: result.hoggZ,
      hoggPValue: result.hoggPValue,
    });
    dispatchCounts[result.hoggDispatch] += 1;
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hoggZ':
        primary = a.hoggZ - b.hoggZ;
        break;
      case 'hoggZAbsDesc':
        primary = Math.abs(b.hoggZ) - Math.abs(a.hoggZ);
        break;
      case 'hoggPValue':
        primary = a.hoggPValue - b.hoggPValue;
        break;
      case 'hoggPValueDesc':
        primary = b.hoggPValue - a.hoggPValue;
        break;
      case 'hoggQ':
        primary = a.hoggQ - b.hoggQ;
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
    dispatchCounts,
    sources: kept,
  };
}
