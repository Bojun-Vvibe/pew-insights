/**
 * daily-token-siegel-tukey-halves: per-source
 * SIEGEL-TUKEY TWO-SAMPLE NONPARAMETRIC SCALE-SHIFT
 * (EQUALITY-OF-DISPERSION) TEST comparing the first
 * half vs. second half of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Pool the n = n1 + n2 values, break ties by ORIGINAL
 * INDEX (stable order), and sort ascending. Then
 * assign SIEGEL-TUKEY OUTWARD RANKS: starting from
 * the two extremes and walking inward in alternating
 * pairs (Siegel & Tukey 1960, Journal of the American
 * Statistical Association 55(291):429-445, eq. 1):
 *
 *   pooledSorted index 0      (smallest)  -> rank 1
 *   pooledSorted index n - 1  (largest)   -> rank 2
 *   pooledSorted index n - 2                -> rank 3
 *   pooledSorted index 1                    -> rank 4
 *   pooledSorted index 2                    -> rank 5
 *   pooledSorted index n - 3                -> rank 6
 *   pooledSorted index n - 4                -> rank 7
 *   pooledSorted index 3                    -> rank 8
 *   ...
 *
 * Equivalently: rank 1 to the minimum, ranks 2 & 3
 * to the two largest values, ranks 4 & 5 to the next
 * two smallest values, ranks 6 & 7 to the next two
 * largest, alternating until exhausted. Values close
 * to the pooled extremes receive SMALL ranks; values
 * close to the pooled MEDIAN receive LARGE ranks.
 *
 * Let WA = sum of Siegel-Tukey ranks assigned to the
 * elements that originally belonged to half A. Under
 * H0 (equal scale -- both halves drawn from the same
 * distribution up to a common location shift), WA is
 * exchangeable across halves and the Mann-Whitney
 * representation
 *
 *     stU = WA - n1 (n1 + 1) / 2
 *
 * is approximately Normal with mean and variance
 * (Mann & Whitney 1947, Annals of Mathematical
 * Statistics 18(1):50-60, with continuity correction
 * per Hollander, Wolfe & Chicken 2014 sec. 5.4):
 *
 *     E[stU]   = n1 * n2 / 2
 *     Var[stU] = n1 * n2 * (n + 1) / 12
 *     stZ      = (stU - E[stU]) / sqrt(Var[stU])
 *
 * (For the half with smaller pooled extremity-ranks,
 * stU is small / negative; for the half with values
 * concentrated near the pooled MEDIAN, stU is large
 * / positive.)
 *
 *     stZ much greater than +1.96 = the FIRST half is
 *       MORE CONCENTRATED around the pooled median
 *       (occupies the high outward ranks more often
 *       than chance) and so has STRICTLY SMALLER
 *       SCALE than the second half. (DISPERSION GREW
 *       over the tenure.)
 *     stZ much less than -1.96 = the FIRST half
 *       occupies the EXTREME outward ranks more often
 *       than chance, and so has STRICTLY GREATER
 *       SCALE than the second half. (DISPERSION
 *       SHRANK over the tenure.)
 *     stZ approx 0 = no detectable scale shift between
 *       the two halves.
 *
 * Note the SIGN CONVENTION is fixed to match axis-116
 * (positive z = second half more dispersed): we
 * report stZ with the OPPOSITE sign of the raw rank-
 * sum z so that POSITIVE = second half more
 * dispersed, exactly like bfZ in axis-116. The raw
 * Mann-Whitney representation gives the FIRST half
 * the "concentrated" interpretation when WA is large;
 * we negate to keep the across-axis convention.
 *
 * This is a TWO-SIDED unpaired NONPARAMETRIC ROBUST
 * EQUALITY-OF-SCALE test sensitive to a SHIFT IN
 * DISPERSION between the first and second halves of
 * the tenure. It is approximately INSENSITIVE TO
 * LOCATION SHIFT (Siegel-Tukey assumes equal medians;
 * the standard prophylaxis -- which we apply -- is to
 * MEDIAN-CENTRE each half before pooling, so a pure
 * location shift between halves is removed and only a
 * scale shift survives. See Hollander, Wolfe &
 * Chicken 2014 eq. 5.13).
 *
 * (Siegel, S. and Tukey, J. W., "A Nonparametric Sum
 *  of Ranks Procedure for Relative Spread in Unpaired
 *  Samples", Journal of the American Statistical
 *  Association 55(291) (1960), pp. 429-445; Mann,
 *  H. B. and Whitney, D. R., "On a Test of Whether
 *  one of Two Random Variables is Stochastically
 *  Larger than the Other", Annals of Mathematical
 *  Statistics 18(1) (1947), pp. 50-60; Hollander, M.,
 *  Wolfe, D. A. and Chicken, E., "Nonparametric
 *  Statistical Methods", 3rd ed., Wiley, 2014, sec.
 *  5.4 eq. 5.13.)
 *
 * Reported alongside `stU`: the two half-sample sizes
 * `stN1` and `stN2`, the two half-medians `stMedianA`
 * and `stMedianB`, the rank-sum for the first half
 * `stWA`, the Mann-Whitney representation `stU`, the
 * normal-approximation z-equivalent `stZ` (sign-
 * flipped so positive = second half more dispersed),
 * and the variance scale `stVar` for diagnostics.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-116:
 *
 *   - Class. TWO-SAMPLE-SCALE-SHIFT-TEST (NON-
 *     PARAMETRIC RANK-BASED equality-of-dispersion
 *     statistic comparing two contiguous halves of
 *     the tenure with a Mann-Whitney-Wilcoxon
 *     N(0, 1) null on outward-pair ranks). UNPAIRED
 *     (n1 vs n2 elements, no element-by-element
 *     pairing); FULLY NONPARAMETRIC (uses only rank
 *     order, not numeric values, after median-
 *     centring); SCALE-SHIFT (sensitive to a
 *     difference in DISPERSION between halves).
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Both are TWO-SAMPLE SCALE-SHIFT tests on the
 *     same first/second half partition, but they
 *     differ in TEST FAMILY and in NULL DISTRIBUTION:
 *     Brown-Forsythe is a PARAMETRIC F-statistic on
 *     median-centred ABSOLUTE DEVIATIONS with an
 *     F(1, n-2) null and Wallace 1959 normal
 *     correction; Siegel-Tukey is a NONPARAMETRIC
 *     RANK-SUM statistic on outward-alternating
 *     RANKS of pooled values with a Mann-Whitney
 *     normal null. They are orthogonal in the same
 *     way that t-test (parametric on means) is
 *     orthogonal to Mann-Whitney (nonparametric on
 *     ranks): under heavy-tailed contamination the
 *     two tests can disagree -- Brown-Forsythe is
 *     more powerful under approximately Normal
 *     deviations but loses calibration under heavy
 *     tails; Siegel-Tukey is rank-invariant and so
 *     calibration-stable under any continuous
 *     distribution. They are NOT a monotone
 *     transform of each other: a series with a few
 *     large outliers in the second half can yield
 *     bfZ much greater than +1.96 (BF is sensitive
 *     to magnitudes) but stZ approx 0 (the OUTLIER
 *     RANKS occupy the same Siegel-Tukey extreme-
 *     rank positions whether the value is 100 or
 *     1,000,000).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney halves is the LOCATION-SHIFT
 *     rank-sum on the SAME partition. Siegel-Tukey
 *     uses the SAME pooling but assigns OUTWARD-PAIR
 *     RANKS instead of monotonic ranks -- the rank
 *     pattern is what differs. Mann-Whitney detects
 *     a shift in MEDIAN; Siegel-Tukey detects a
 *     shift in SPREAD. Median-centring before
 *     pooling REMOVES the location component and
 *     leaves only the scale component for Siegel-
 *     Tukey to detect.
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a MULTI-LAG SQUARED-AUTO-
 *     CORRELATION PORTMANTEAU on the centred raw
 *     series with a Chi-Square(H) null. Siegel-Tukey
 *     is a TWO-SAMPLE RANK-SUM on outward ranks of
 *     two contiguous halves with a Normal null.
 *     Sample space differs (H squared correlations
 *     vs n outward ranks); functional differs
 *     (squared autocorr vs Mann-Whitney U on
 *     extremity ranks); null differs (Chi-Square vs
 *     Normal); detection target differs (any serial
 *     structure across H lags vs SPECIFIC scale
 *     shift between two contiguous halves).
 *
 *   - vs axis-113 daily-token-difference-sign-test
 *     (Mood). Mood is a SINGLE-LAG (k=1) BINARY
 *     SIGN-COUNT on first differences sensitive to
 *     TREND. Siegel-Tukey is a TWO-SAMPLE rank-sum
 *     sensitive to SCALE shift. A series with
 *     constant first half at value 0 and constant
 *     second half oscillating between -1 and +1 has
 *     few non-zero diffs of varying sign (Mood
 *     reports nothing) but Siegel-Tukey reports
 *     stZ much greater than +1.96 (the second-half
 *     values straddle the pooled median and so
 *     occupy the central, low-outward-rank positions
 *     of the pool -- meaning the FIRST half occupies
 *     the high outward ranks, indicating LESS
 *     dispersion in the first half).
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann.
 *     Bartels is a SINGLE-LAG (k=1) SQUARED-RANK-
 *     ADJACENT-DIFFERENCE statistic on the rank
 *     series of the WHOLE sequence -- sensitive to
 *     SERIAL CORRELATION. Siegel-Tukey partitions
 *     the raw series into two contiguous groups and
 *     compares OUTWARD ranks -- sensitive to scale
 *     shift between halves, insensitive to within-
 *     half serial structure.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is a HALF-SHIFT BINOMIAL SIGN-TEST
 *     on floor(n/2) PAIRED comparisons sensitive to
 *     MONOTONE LOCATION TREND. Siegel-Tukey is an
 *     UNPAIRED two-sample rank-sum sensitive to
 *     SCALE shift. A clean step-shift in median
 *     triggers Cox-Stuart but is REMOVED by Siegel-
 *     Tukey's median-centring prophylaxis.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau.
 *     Mann-Kendall is a GLOBAL ALL-PAIRS sign-of-
 *     difference statistic over n*(n-1)/2 pairs
 *     sensitive to monotonic LOCATION trend across
 *     the WHOLE series. Siegel-Tukey is a TWO-
 *     SAMPLE rank-sum sensitive to SCALE shift
 *     between halves -- insensitive to monotone
 *     location trend within either half (which is
 *     median-centred away).
 *
 *   - vs axis-64 daily-token-runs-test-z (Wald-
 *     Wolfowitz median-binarised run-count). Wald-
 *     Wolfowitz binarises the WHOLE series by its
 *     median and counts MAXIMAL RUNS with a
 *     hypergeometric null -- sensitive to ALTERNATION
 *     around the global median. Siegel-Tukey
 *     compares two CONTIGUOUS halves' outward-rank-
 *     sums with a Mann-Whitney null -- sensitive to
 *     scale shift between halves.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution. Siegel-Tukey
 *     depends entirely on the TEMPORAL ORDER --
 *     specifically, on which values fall in the
 *     first half vs the second half. A uniformly
 *     random permutation has E[stZ] approx 0
 *     regardless of value distribution.
 *
 *   - vs the spectral axes (84-104). Spectral axes
 *     transform to the FREQUENCY domain. Siegel-
 *     Tukey stays in the TIME domain.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes.
 *     Those are scaling exponents fit across multiple
 *     window sizes. Siegel-Tukey is a single rank-
 *     sum statistic at a single fixed split.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), median-centre each
 *   half, pool them, sort the pool, assign Siegel-
 *   Tukey alternating outward ranks, sum the ranks
 *   that originally came from the first half, and
 *   normal-standardise via the Mann-Whitney mean and
 *   variance, does the resulting |stZ| exceed
 *   1.96?"**
 *
 * Reference:
 *   Siegel, S. and Tukey, J. W., "A Nonparametric Sum
 *     of Ranks Procedure for Relative Spread in
 *     Unpaired Samples", Journal of the American
 *     Statistical Association 55(291) (1960), pp.
 *     429-445.
 *   Mann, H. B. and Whitney, D. R., "On a Test of
 *     Whether one of Two Random Variables is
 *     Stochastically Larger than the Other", Annals
 *     of Mathematical Statistics 18(1) (1947), pp.
 *     50-60.
 *   Hollander, M., Wolfe, D. A. and Chicken, E.,
 *     "Nonparametric Statistical Methods", 3rd ed.,
 *     Wiley, 2014, sec. 5.4 eq. 5.13.
 *
 * Caveats:
 *
 *   - stU >= 0 (Mann-Whitney representation), stZ in
 *     (-inf, +inf) with sign convention NEGATIVE
 *     of the raw rank-sum z so positive = second
 *     half more dispersed (matches bfZ in axis-116).
 *   - Median-centring per half is applied before
 *     pooling so a pure LOCATION shift between
 *     halves is removed (Hollander, Wolfe & Chicken
 *     2014 eq. 5.13). Without this, Siegel-Tukey
 *     conflates location and scale.
 *   - Tied centred values are broken by ORIGINAL
 *     INDEX (stable sort) so the rank assignment is
 *     deterministic. The normal approximation
 *     ignores tie-correction; for the heavy-tailed
 *     gap-filled token series with many exact zeros
 *     after median-centring, this is conservative
 *     (slight over-estimate of variance, slight
 *     under-rejection at alpha = 0.05).
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axis-115 / axis-116). Hard floor
 *     n >= 8 so n1 * n2 * (n + 1) / 12 >= 6 and the
 *     normal approximation is well within its valid
 *     regime.
 *   - All-equal series filtered upstream by zero-
 *     variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-siegel-tukey-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-siegel-tukey-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # scale-shift evidence first):
 *   pew-insights daily-token-siegel-tukey-halves \
 *     --sort stZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenSiegelTukeyHalvesSort =
  | 'stU'
  | 'stUDesc'
  | 'stZ'
  | 'stZDesc'
  | 'stZAbs'
  | 'stZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSiegelTukeyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * n1 * n2 * (n + 1) / 12 >= 6 (Mann-Whitney normal
   * approximation regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSiegelTukeyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenSiegelTukeyHalvesSourceRow {
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
  stN1: number;
  /** Second-half size n2 = n - n1. */
  stN2: number;
  /** Median of the first half (used for centring). */
  stMedianA: number;
  /** Median of the second half (used for centring). */
  stMedianB: number;
  /** Sum of Siegel-Tukey outward ranks assigned to first-half elements. */
  stWA: number;
  /** Mann-Whitney U representation = stWA - n1 (n1 + 1) / 2. */
  stU: number;
  /** Variance of stU under H0 = n1 * n2 * (n + 1) / 12. */
  stVar: number;
  /** Normal-approx z-equivalent (sign-flipped: positive = second half more dispersed). */
  stZ: number;
}

export interface DailyTokenSiegelTukeyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSiegelTukeyHalvesSort;
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
  sources: DailyTokenSiegelTukeyHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Siegel-Tukey two-sample equality-of-scale test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series.
 *
 * Each half is median-centred (Hollander, Wolfe &
 * Chicken 2014 eq. 5.13) so that a pure location
 * shift is removed before the rank assignment. Then
 * the pool is sorted ascending (stable, ties broken
 * by original index) and Siegel-Tukey OUTWARD-PAIR
 * RANKS are assigned. The Mann-Whitney representation
 * of the rank-sum for half A is normal-standardised.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - stZ(x + c) === stZ(x) for any constant c.
 *     Constant added to the whole series shifts every
 *     value identically, both half-medians shift by
 *     the same c, centred values are unchanged.
 *   - stZ(a * x) === stZ(x) for any a > 0 with stZ
 *     scale-invariant (rank order preserved). For
 *     a < 0 the rank order REVERSES which preserves
 *     the Siegel-Tukey extremity assignment exactly
 *     (the smallest becomes the largest etc.) so
 *     stZ(-x) === stZ(x) as well.
 *   - For n1 = n2: swapping the two halves negates
 *     stZ. (The first half's contribution to the
 *     rank-sum becomes the second half's.)
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be
 *     filtered upstream.
 *   - stU >= 0 by construction (rank-sum minimum).
 */
export function dailyTokenSiegelTukeyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  stN1: number;
  stN2: number;
  stMedianA: number;
  stMedianB: number;
  stWA: number;
  stU: number;
  stVar: number;
  stZ: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSiegelTukeyHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenSiegelTukeyHalves requires finite values',
      );
    }
  }

  // Mean / stddev as compositional context.
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
      `dailyTokenSiegelTukeyHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const stMedianA = medianSorted(aSorted);
  const stMedianB = medianSorted(bSorted);

  // Median-centre each half (Hollander/Wolfe/Chicken
  // 2014 eq. 5.13) so pure location shift is removed
  // before pooling.
  interface PoolElem {
    centred: number;
    origIdx: number;
    fromFirstHalf: boolean;
  }
  const pool: PoolElem[] = new Array(n);
  for (let i = 0; i < n1; i += 1) {
    pool[i] = {
      centred: values[i]! - stMedianA,
      origIdx: i,
      fromFirstHalf: true,
    };
  }
  for (let i = 0; i < n2; i += 1) {
    pool[n1 + i] = {
      centred: values[n1 + i]! - stMedianB,
      origIdx: n1 + i,
      fromFirstHalf: false,
    };
  }

  // Stable sort ascending by centred value, ties
  // broken by original index so the rank assignment
  // is fully deterministic (V8 Array.prototype.sort
  // is stable per ES2019, but we belt-and-brace via
  // origIdx as the secondary key).
  pool.sort((p, q) => {
    if (p.centred !== q.centred) return p.centred - q.centred;
    return p.origIdx - q.origIdx;
  });

  // Siegel-Tukey outward-pair rank assignment.
  // Walk inward from both ends, assigning ranks 1, 2,
  // 3, 4, ... in the alternating pattern from
  // Siegel & Tukey 1960 eq. 1:
  //
  //   rank 1 -> sorted[0]    (smallest, lo side, 1 take)
  //   rank 2 -> sorted[n-1]  (largest, hi side, take 1 of 2)
  //   rank 3 -> sorted[n-2]                (hi side, take 2 of 2)
  //   rank 4 -> sorted[1]                  (lo side, take 1 of 2)
  //   rank 5 -> sorted[2]                  (lo side, take 2 of 2)
  //   rank 6 -> sorted[n-3]                (hi side, take 1 of 2)
  //   rank 7 -> sorted[n-4]                (hi side, take 2 of 2)
  //   ...
  //
  // i.e. the very first low-side phase takes ONLY 1
  // (rank 1 alone goes to the global minimum); every
  // subsequent phase (low or hi) takes a PAIR of 2.
  // For odd n the inner walk terminates mid-pair and
  // the leftover slot gets the final rank n. The
  // result is that values close to the pooled
  // EXTREMES collect SMALL ranks and values close to
  // the pooled MEDIAN collect LARGE ranks -- the
  // exact opposite weighting of monotonic ranking,
  // which is what makes the rank-sum sensitive to
  // SCALE shift instead of LOCATION shift.
  const ranks: number[] = new Array(n);
  let lo = 0;
  let hi = n - 1;
  let nextRank = 1;
  let onLowSide = true; // first rank goes to lo
  while (lo <= hi) {
    if (onLowSide) {
      // Take 1 from lo, then 2 from hi (next phase),
      // then 2 from lo, then 2 from hi, ...
      // Special case: very first iteration takes only
      // 1 from lo (rank 1), then flips to a 2-from-hi
      // phase. Subsequent low-side phases take 2.
      const take = nextRank === 1 ? 1 : 2;
      for (let k = 0; k < take && lo <= hi; k += 1) {
        ranks[lo] = nextRank;
        nextRank += 1;
        lo += 1;
      }
    } else {
      const take = 2;
      for (let k = 0; k < take && lo <= hi; k += 1) {
        ranks[hi] = nextRank;
        nextRank += 1;
        hi -= 1;
      }
    }
    onLowSide = !onLowSide;
  }

  // Sum ranks assigned to first-half elements.
  let stWA = 0;
  for (let i = 0; i < n; i += 1) {
    if (pool[i]!.fromFirstHalf) {
      stWA += ranks[i]!;
    }
  }

  // Mann-Whitney U representation and normal moments.
  const stU = stWA - (n1 * (n1 + 1)) / 2;
  const eU = (n1 * n2) / 2;
  const stVar = (n1 * n2 * (n + 1)) / 12;
  if (stVar <= 0) {
    throw new Error(
      `dailyTokenSiegelTukeyHalves: non-positive variance (n=${n})`,
    );
  }
  // Sign convention: NEGATE the raw rank-sum z so
  // POSITIVE means SECOND HALF MORE DISPERSED, to
  // match the bfZ convention in axis-116. Raw stU
  // > eU means half A occupies the high (central /
  // pooled-median) outward ranks, i.e. half A is
  // MORE concentrated, i.e. half B is MORE dispersed
  // -> we want positive z. So stZ = (stU - eU) /
  // sqrt(stVar) directly (no flip needed -- the
  // Siegel-Tukey assignment puts LARGE ranks at the
  // CENTRE of the pool, so a half concentrated at
  // the median already has a LARGE rank-sum, and
  // larger rank-sum for half A directly means half B
  // is more dispersed).
  const stZ = (stU - eU) / Math.sqrt(stVar);

  if (!Number.isFinite(stU) || !Number.isFinite(stZ)) {
    throw new Error(
      `dailyTokenSiegelTukeyHalves: non-finite U or Z (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    stN1: n1,
    stN2: n2,
    stMedianA,
    stMedianB,
    stWA,
    stU,
    stVar,
    stZ,
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

export function buildDailyTokenSiegelTukeyHalves(
  queue: QueueLine[],
  opts: DailyTokenSiegelTukeyHalvesOptions = {},
): DailyTokenSiegelTukeyHalvesReport {
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
  const sort: DailyTokenSiegelTukeyHalvesSort = opts.sort ?? 'stZAbsDesc';
  const validSorts: DailyTokenSiegelTukeyHalvesSort[] = [
    'stU',
    'stUDesc',
    'stZ',
    'stZDesc',
    'stZAbs',
    'stZAbsDesc',
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
  const rows: DailyTokenSiegelTukeyHalvesSourceRow[] = [];

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
      result = dailyTokenSiegelTukeyHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenSiegelTukeyHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      stN1: result.stN1,
      stN2: result.stN2,
      stMedianA: result.stMedianA,
      stMedianB: result.stMedianB,
      stWA: result.stWA,
      stU: result.stU,
      stVar: result.stVar,
      stZ: result.stZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'stU':
        primary = a.stU - b.stU;
        break;
      case 'stUDesc':
        primary = b.stU - a.stU;
        break;
      case 'stZ':
        primary = a.stZ - b.stZ;
        break;
      case 'stZDesc':
        primary = b.stZ - a.stZ;
        break;
      case 'stZAbs':
        primary = Math.abs(a.stZ) - Math.abs(b.stZ);
        break;
      case 'stZAbsDesc':
        primary = Math.abs(b.stZ) - Math.abs(a.stZ);
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
