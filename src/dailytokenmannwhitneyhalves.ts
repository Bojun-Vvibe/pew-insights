/**
 * daily-token-mann-whitney-halves: per-source MANN-
 * WHITNEY U TWO-SAMPLE LEVEL-SHIFT TEST comparing the
 * first half vs. second half of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-FIFTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Pool the n1 + n2 = n values, assign MID-RANKS (the
 * average of the ranks tied values would receive),
 * and let R_A be the sum of mid-ranks of the n1
 * elements of A. Then the MANN-WHITNEY U STATISTIC
 * (Mann & Whitney 1947, Annals of Mathematical
 * Statistics 18(1):50-60) is
 *
 *     U_A = R_A - n1 (n1 + 1) / 2
 *
 * which counts (with mid-rank tie credit of 1/2 per
 * tied pair) the number of (a, b) pairs with a in A,
 * b in B, and a > b. The complementary statistic is
 * U_B = n1 n2 - U_A. Under the iid two-sample null
 * (A and B drawn from a common continuous
 * distribution),
 *
 *     E[U_A] = n1 n2 / 2
 *     Var[U_A] = n1 n2 (n + 1) / 12     (no ties)
 *
 * With ties (necessary because gap-fill produces many
 * exact zeros), the variance is corrected per the
 * standard formula (Lehmann 1975 "Nonparametrics:
 * Statistical Methods Based on Ranks" eq. 1.8;
 * Hollander, Wolfe & Chicken 2014 "Nonparametric
 * Statistical Methods" 3rd ed. sec. 4.1):
 *
 *     Var_tie[U_A] = (n1 n2 / (12 n (n - 1))) *
 *                    (n^3 - n - sum_g (t_g^3 - t_g))
 *
 * where the sum runs over tied groups of size t_g
 * (singletons contribute 0). The standardised score
 *
 *     mwZ = (U_A - E[U_A]) / sqrt(Var_tie[U_A])
 *
 * is approximately N(0, 1) for min(n1, n2) >= 8
 * (Conover 1999 "Practical Nonparametric Statistics"
 * 3rd ed. sec. 5.1 recommends n1, n2 >= 4 with
 * continuity correction; we omit the +/- 0.5
 * continuity correction here for compositional
 * consistency with the other z-score axes 108-114).
 *
 *     mwZ much greater than +1.96 = the FIRST half
 *       has STRICTLY HIGHER token mass than the second
 *       (token activity declined over the tenure).
 *     mwZ much less than -1.96 = the SECOND half has
 *       STRICTLY HIGHER token mass than the first
 *       (token activity grew over the tenure).
 *     mwZ approx 0 = no detectable level shift between
 *       the two halves.
 *
 * This is a TWO-SIDED unpaired RANK-BASED LEVEL-SHIFT
 * test sensitive to a SHIFT IN MEDIAN between the
 * first and second halves of the tenure. It is INSEN-
 * SITIVE TO WITHIN-HALF MONOTONICITY -- a series
 * whose first half is monotonically rising from 0 to
 * 100 and second half is monotonically rising from
 * 100 to 200 will yield a strongly NEGATIVE mwZ
 * (second half strictly larger), whereas axis-110
 * Mann-Kendall would report tau = +1 (perfect
 * monotonic trend across the whole series) and axis-
 * 111 Cox-Stuart would report a perfect half-shift
 * sign-test rejection. The three statistics co-move
 * for pure linear trends but DIVERGE for level-shift-
 * but-no-trend or trend-but-no-level-shift series.
 *
 * (Mann, H. B. and Whitney, D. R., "On a test of
 *  whether one of two random variables is
 *  stochastically larger than the other", Annals of
 *  Mathematical Statistics 18 (1947), pp. 50-60;
 *  Wilcoxon, F., "Individual comparisons by ranking
 *  methods", Biometrics Bulletin 1 (1945), pp. 80-83;
 *  Lehmann, E. L., "Nonparametrics: Statistical
 *  Methods Based on Ranks", Holden-Day, 1975, sec.
 *  1.3 / eq. 1.8; Hollander, Wolfe & Chicken,
 *  "Nonparametric Statistical Methods", 3rd ed.,
 *  Wiley, 2014, sec. 4.1; Conover, W. J., "Practical
 *  Nonparametric Statistics", 3rd ed., Wiley, 1999,
 *  sec. 5.1.)
 *
 * Reported alongside `mwU`: the two half-sample sizes
 * `mwN1` and `mwN2`, the rank-sum `mwRankSumA` of the
 * first half, the tie-corrected `mwVar`, and the
 * standardised `mwZ`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-114:
 *
 *   - Class. TWO-SAMPLE-LEVEL-SHIFT-TEST (rank-sum
 *     U-statistic comparing two contiguous halves of
 *     the tenure with a tie-corrected Gaussian null).
 *     UNPAIRED (n1 vs n2 elements, no element-by-
 *     element pairing); RANK-BASED (only mid-ranks
 *     enter, raw values discarded after ranking);
 *     LEVEL-SHIFT (sensitive to a difference in
 *     median between halves, NOT to monotone trend
 *     within halves).
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a MULTI-LAG SQUARED-AUTOCORRELATION
 *     PORTMANTEAU statistic on the centred raw
 *     series with a Chi-Square(H) null. Mann-Whitney
 *     is a TWO-SAMPLE RANK-SUM statistic comparing
 *     two contiguous halves with a Normal null. Sample
 *     space differs (H squared correlations vs n1*n2
 *     pair-comparisons); functional differs (squared
 *     Pearson autocorr vs sum of mid-ranks);
 *     null differs (Chi-Square vs tie-corrected
 *     Gaussian); detection target differs (any serial
 *     structure across H lags vs SPECIFIC level shift
 *     between two contiguous halves).
 *
 *   - vs axis-113 daily-token-difference-sign-test
 *     (Mood). Mood is a SINGLE-LAG (k=1) BINARY
 *     SIGN-COUNT on first differences with a
 *     Binomial(n-1, 1/2) null. Mann-Whitney is an
 *     UNPAIRED two-sample RANK-SUM with a Gaussian
 *     null. Sample space differs (n-1 diff signs vs
 *     n1*n2 pair-orderings); paired adjacent
 *     differences (Mood) vs unpaired all-pairs
 *     between halves (Mann-Whitney); a series with
 *     constant first half then constant second half
 *     at a higher level has only ONE non-zero diff
 *     (Mood reports nothing detectable) while
 *     Mann-Whitney reports the full level shift.
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann.
 *     Bartels is a SINGLE-LAG (k=1) SQUARED-RANK-
 *     ADJACENT-DIFFERENCE statistic with a Gaussian
 *     null on the rank series of the WHOLE sequence.
 *     Mann-Whitney is a TWO-SAMPLE RANK-SUM statistic
 *     comparing two contiguous halves. Bartels uses
 *     the entire rank vector as a single sample;
 *     Mann-Whitney partitions the ranks into two
 *     contiguous groups and compares sums.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is a HALF-SHIFT BINOMIAL SIGN-TEST
 *     on floor(n/2) PAIRED comparisons (x_i vs
 *     x_{i+floor(n/2)}). Mann-Whitney is an UNPAIRED
 *     two-sample RANK-SUM on n1 vs n2 elements.
 *     Although both partition the series at the
 *     midpoint, Cox-Stuart uses only floor(n/2)
 *     ELEMENT-BY-ELEMENT paired binary signs (Sample
 *     space n/2 binary outcomes; Binomial null);
 *     Mann-Whitney uses all n1*n2 cross-half pair
 *     comparisons (Sample space ~n^2/4 pair
 *     comparisons; Gaussian null). For a series with
 *     a SINGLE LEVEL-SHIFT in the middle, both
 *     reject; for a series where the second half is
 *     uniformly higher in median but element-by-
 *     element the paired comparisons are mixed (e.g.
 *     second half oscillates around a higher median
 *     while first half oscillates around a lower
 *     median, so paired (x_i, x_{i+n/2}) comparisons
 *     are roughly 50/50), Mann-Whitney detects the
 *     shift while Cox-Stuart does not.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. Mann-
 *     Kendall is a GLOBAL ALL-PAIRS sign-of-difference
 *     statistic over n*(n-1)/2 pairs, sensitive to
 *     monotonic trend across the WHOLE series. Mann-
 *     Whitney is a TWO-SAMPLE rank-sum over n1*n2
 *     CROSS-HALF pairs only. A series with a clean
 *     STEP-FUNCTION level shift (constant first half
 *     at 10, constant second half at 20) yields
 *     mwZ much greater than 0 (perfect cross-half
 *     separation) but tau_MK only modestly elevated
 *     (within-half pairs are all ties); a series with
 *     pure linear trend has both elevated.
 *
 *   - vs axis-109 daily-token-upper-records-count.
 *     Upper-records counts STRICT NEW MAXIMA. Mann-
 *     Whitney sums mid-ranks of one half. Unrelated
 *     primitives.
 *
 *   - vs axis-108 / 107 (kendall-tau / spearman lag-1
 *     rank autocorrelation). Both axes 107 and 108
 *     are SINGLE-LAG (k=1) RANK CORRELATIONS on the
 *     whole series. Mann-Whitney is a TWO-SAMPLE
 *     RANK-SUM comparing two contiguous halves.
 *     Sample space differs (n-1 lag-1 pairs vs n1*n2
 *     cross-half pairs); aggregation differs (rank
 *     correlation vs rank-sum difference).
 *
 *   - vs axis-64 daily-token-runs-test-z (Wald-
 *     Wolfowitz median-binarised run-count). Wald-
 *     Wolfowitz binarises by MEDIAN and counts
 *     MAXIMAL RUNS with a hypergeometric null --
 *     sensitive to ALTERNATION around the median.
 *     Mann-Whitney compares two CONTIGUOUS halves'
 *     rank-sums with a Gaussian null -- sensitive to
 *     a LEVEL SHIFT between halves. Different
 *     binarisation (above/below median vs first/
 *     second half); different aggregation (run count
 *     vs rank-sum); different nulls.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution. Mann-Whitney
 *     depends entirely on the TEMPORAL ORDER --
 *     specifically, on which values fall in the first
 *     half vs the second half. A uniformly random
 *     permutation has E[mwZ] = 0 regardless of value
 *     distribution.
 *
 *   - vs the spectral axes (84-104). Spectral axes
 *     transform to the FREQUENCY domain via the FFT
 *     and summarise the periodogram. Mann-Whitney
 *     stays in the TIME domain and asks a single
 *     question: is the median of the second half
 *     stochastically equal to the median of the first
 *     half. Different aggregation surface entirely.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes.
 *     Those are scaling exponents fit across multiple
 *     window sizes. Mann-Whitney is a single z-score
 *     at a single fixed split (the half-point).
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), pool the values,
 *   assign mid-ranks, and sum the ranks of the first
 *   half, does the rank-sum deviate from its iid
 *   two-sample null mean E[R_A] = n1(n+1)/2 by more
 *   than 1.96 standard deviations (tie-corrected)?"**
 *
 * Reference:
 *   Mann, H. B. and Whitney, D. R., "On a test of
 *     whether one of two random variables is
 *     stochastically larger than the other", Annals
 *     of Mathematical Statistics 18 (1947), pp. 50-60.
 *   Wilcoxon, F., "Individual comparisons by ranking
 *     methods", Biometrics Bulletin 1 (1945),
 *     pp. 80-83.
 *   Lehmann, E. L., "Nonparametrics: Statistical
 *     Methods Based on Ranks", Holden-Day, 1975,
 *     sec. 1.3 / eq. 1.8.
 *   Hollander, M., Wolfe, D. A. and Chicken, E.,
 *     "Nonparametric Statistical Methods", 3rd ed.,
 *     Wiley, 2014, sec. 4.1.
 *   Conover, W. J., "Practical Nonparametric
 *     Statistics", 3rd ed., Wiley, 1999, sec. 5.1.
 *
 * Caveats:
 *
 *   - mwZ in (-inf, +inf). mwZ approx 0 = halves
 *     stochastically equal; mwZ much greater than 0
 *     = first half larger; mwZ much less than 0
 *     = second half larger.
 *   - Tie correction matters. Gap-filled days
 *     produce many exact zeros; the no-ties variance
 *     formula n1*n2*(n+1)/12 OVERSTATES Var[U] when
 *     ties are present, biasing mwZ towards 0
 *     (CONSERVATIVE). The tie-corrected formula is
 *     used here.
 *   - No continuity correction. The +/- 0.5
 *     continuity correction recommended by Conover
 *     1999 sec. 5.1 for very small samples is
 *     OMITTED for compositional consistency with the
 *     other z-score axes (108-114). For exact small-
 *     sample p-values use the U value directly with a
 *     Mann-Whitney U table.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1.
 *     For odd n the first half is one element shorter
 *     than the second half (e.g. n = 15 -> n1 = 7,
 *     n2 = 8). The middle element (index n1) goes
 *     into the SECOND half.
 *   - All-tied series filtered upstream by zero-
 *     variance guard (every value identical -> no
 *     detectable level shift).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-mann-whitney-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-mann-whitney-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # level-shift evidence first):
 *   pew-insights daily-token-mann-whitney-halves \
 *     --sort mwZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenMannWhitneyHalvesSort =
  | 'u'
  | 'uDesc'
  | 'mwZ'
  | 'mwZDesc'
  | 'mwZAbs'
  | 'mwZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMannWhitneyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8
   * (so each half has >= 4 elements per Conover 1999
   * sec. 5.1 minimum).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMannWhitneyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMannWhitneyHalvesSourceRow {
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
  mwN1: number;
  /** Second-half size n2 = n - n1. */
  mwN2: number;
  /** Median of the first half. */
  mwMedianA: number;
  /** Median of the second half. */
  mwMedianB: number;
  /** Sum of mid-ranks of the first-half elements. */
  mwRankSumA: number;
  /** Mann-Whitney U statistic for the first half. */
  mwU: number;
  /** Tie-corrected variance of U under the iid null. */
  mwVar: number;
  /** Standardised score (U - E[U]) / sqrt(Var_tie[U]). */
  mwZ: number;
}

export interface DailyTokenMannWhitneyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMannWhitneyHalvesSort;
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
  sources: DailyTokenMannWhitneyHalvesSourceRow[];
}

/**
 * Mann-Whitney U two-sample level-shift test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series, with
 * mid-rank ties and the tie-corrected Gaussian null.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - mwU(x + c) === mwU(x) for any constant c. The
 *     mid-rank assignment is shift-invariant.
 *   - mwU(a * x) === mwU(x) for any a > 0. Mid-ranks
 *     are scale-invariant under positive
 *     monotonic transforms.
 *   - mwU(reverse(x)) === n1*n2 - mwU(x) when n1 = n2
 *     (and approximately so otherwise). Reversal
 *     swaps the two halves; U_A and U_B sum to
 *     n1*n2 by construction. Hence
 *     mwZ(reverse(x)) === -mwZ(x) when n1 = n2.
 *   - mwU + mwU_complement === n1*n2 by construction
 *     (the two U statistics partition the n1*n2
 *     cross-half pair comparisons).
 *   - mwRankSumA + mwRankSumB === n*(n+1)/2 by
 *     construction (every mid-rank assigned exactly
 *     once).
 *   - 0 <= mwU <= n1*n2 by construction.
 *   - E[mwU] === n1*n2/2 under the iid null.
 *
 * Closed-form sanity anchors:
 *   - constant series filtered upstream by zero-
 *     variance guard.
 *   - strictly monotone increasing series x = (1, 2,
 *     .., n) -> every element of B exceeds every
 *     element of A -> mwU = 0 -> mwZ much less than 0.
 *   - strictly monotone decreasing series x = (n, n-1,
 *     .., 1) -> every element of A exceeds every
 *     element of B -> mwU = n1*n2 -> mwZ much greater
 *     than 0.
 *   - perfect step-shift series 0,0,..,0,1,1,..,1
 *     (n/2 zeros then n/2 ones) -> mwU = 0 -> mwZ
 *     much less than 0 (second half strictly larger).
 *   - perfectly random permutation -> mwU approx
 *     n1*n2/2, mwZ approx 0.
 *
 * Throws when the series is too short, contains non-
 * finite entries, or has zero centred variance.
 */
export function dailyTokenMannWhitneyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  mwN1: number;
  mwN2: number;
  mwMedianA: number;
  mwMedianB: number;
  mwRankSumA: number;
  mwU: number;
  mwVar: number;
  mwZ: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenMannWhitneyHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenMannWhitneyHalves requires finite values',
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
      `dailyTokenMannWhitneyHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Build the pooled mid-rank vector and the tie-
  // group sizes for the variance correction.
  // Sort indices by value ascending; assign mid-rank
  // = average of (1-based) positions for tied groups.
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);

  const ranks: number[] = new Array(n);
  const tieGroupSizes: number[] = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) {
      j += 1;
    }
    const groupSize = j - i + 1;
    if (groupSize > 1) {
      tieGroupSizes.push(groupSize);
    }
    // Mid-rank for the tied block = average of
    // (i+1) .. (j+1) = ((i+1) + (j+1)) / 2.
    const midRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = midRank;
    }
    i = j + 1;
  }

  // Sum of ranks of the first half.
  let mwRankSumA = 0;
  for (let k = 0; k < n1; k += 1) {
    mwRankSumA += ranks[k]!;
  }

  const mwU = mwRankSumA - (n1 * (n1 + 1)) / 2;
  const mwEU = (n1 * n2) / 2;

  // Tie-corrected variance per Lehmann 1975 eq. 1.8 /
  // Hollander, Wolfe & Chicken 2014 sec. 4.1:
  //   Var_tie[U] = (n1 n2 / (12 n (n - 1)))
  //                * (n^3 - n - sum_g (t_g^3 - t_g))
  let tieSum = 0;
  for (const tg of tieGroupSizes) {
    tieSum += tg * tg * tg - tg;
  }
  const mwVar =
    ((n1 * n2) / (12 * n * (n - 1))) * (n * n * n - n - tieSum);

  if (mwVar <= 0 || !Number.isFinite(mwVar)) {
    throw new Error(
      `dailyTokenMannWhitneyHalves: non-positive tie-corrected variance (n=${n}, tieSum=${tieSum})`,
    );
  }

  const mwZ = (mwU - mwEU) / Math.sqrt(mwVar);

  if (!Number.isFinite(mwU) || !Number.isFinite(mwZ)) {
    throw new Error(
      `dailyTokenMannWhitneyHalves: non-finite U or Z (n=${n})`,
    );
  }

  // Half-medians (sorted-copy median; n1 / n2 always
  // >= 4 here so a simple sort is fine).
  const aSorted = values.slice(0, n1).sort((a, b) => a - b);
  const bSorted = values.slice(n1).sort((a, b) => a - b);
  const mwMedianA =
    n1 % 2 === 1
      ? aSorted[(n1 - 1) / 2]!
      : (aSorted[n1 / 2 - 1]! + aSorted[n1 / 2]!) / 2;
  const mwMedianB =
    n2 % 2 === 1
      ? bSorted[(n2 - 1) / 2]!
      : (bSorted[n2 / 2 - 1]! + bSorted[n2 / 2]!) / 2;

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mwN1: n1,
    mwN2: n2,
    mwMedianA,
    mwMedianB,
    mwRankSumA,
    mwU,
    mwVar,
    mwZ,
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

export function buildDailyTokenMannWhitneyHalves(
  queue: QueueLine[],
  opts: DailyTokenMannWhitneyHalvesOptions = {},
): DailyTokenMannWhitneyHalvesReport {
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
  const sort: DailyTokenMannWhitneyHalvesSort = opts.sort ?? 'mwZAbsDesc';
  const validSorts: DailyTokenMannWhitneyHalvesSort[] = [
    'u',
    'uDesc',
    'mwZ',
    'mwZDesc',
    'mwZAbs',
    'mwZAbsDesc',
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
  const rows: DailyTokenMannWhitneyHalvesSourceRow[] = [];

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
      result = dailyTokenMannWhitneyHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenMannWhitneyHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      mwN1: result.mwN1,
      mwN2: result.mwN2,
      mwMedianA: result.mwMedianA,
      mwMedianB: result.mwMedianB,
      mwRankSumA: result.mwRankSumA,
      mwU: result.mwU,
      mwVar: result.mwVar,
      mwZ: result.mwZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'u':
        primary = a.mwU - b.mwU;
        break;
      case 'uDesc':
        primary = b.mwU - a.mwU;
        break;
      case 'mwZ':
        primary = a.mwZ - b.mwZ;
        break;
      case 'mwZDesc':
        primary = b.mwZ - a.mwZ;
        break;
      case 'mwZAbs':
        primary = Math.abs(a.mwZ) - Math.abs(b.mwZ);
        break;
      case 'mwZAbsDesc':
        primary = Math.abs(b.mwZ) - Math.abs(a.mwZ);
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
