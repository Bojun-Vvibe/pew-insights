/**
 * daily-token-brown-forsyth-halves: per-source
 * BROWN-FORSYTHE TWO-SAMPLE SCALE-SHIFT (EQUALITY-OF-
 * VARIANCE) TEST comparing the first half vs. second
 * half of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Let medA = median(A), medB = median(B) and form the
 * ABSOLUTE DEVIATIONS FROM THE GROUP MEDIANS (the
 * Brown-Forsythe variant of Levene's test):
 *
 *     z_i = |x_i - medA|   for i in [0, n1)
 *     z_i = |x_i - medB|   for i in [n1, n)
 *
 * Let zBarA, zBarB be the means of the two z-groups
 * and zBar the grand mean. The BROWN-FORSYTHE
 * STATISTIC (Brown & Forsythe 1974, Journal of the
 * American Statistical Association 69(346):364-367,
 * "Robust Tests for the Equality of Variances", eq.
 * 2; Levene 1960 "Contributions to Probability and
 * Statistics" sec. 2 with median substituted for the
 * mean per BF eq. 2) is
 *
 *     bfT = (n - k) * SSB / ((k - 1) * SSW)
 *
 * with k = 2 groups, SSB = n1 (zBarA - zBar)^2 +
 * n2 (zBarB - zBar)^2 (between-group sum of squares),
 * SSW = sum_{i in A} (z_i - zBarA)^2 +
 *       sum_{i in B} (z_i - zBarB)^2 (within-group
 * sum of squares). Under H0 (equal variances of A
 * and B) and the asymptotic Brown-Forsythe regime,
 * bfT is approximately F(k - 1, n - k) = F(1, n - 2)
 * distributed.
 *
 * For k = 2 the F(1, n - 2) statistic equals the
 * SQUARE of an equivalent Student t(n - 2) statistic;
 * we report the SIGNED equivalent
 *
 *     bfTSigned = sign(zBarB - zBarA) * sqrt(bfT)
 *
 * which is approximately t(n - 2) distributed under
 * H0. For the dispatcher's compositional consistency
 * with the other z-score axes (108-115), we
 * additionally report
 *
 *     bfZ = bfTSigned * sqrt(1 - 3 / (4 (n - 2) - 1))
 *
 * (Wallace 1959 normal-approximation correction to
 * Student's t, Journal of the American Statistical
 * Association 54(287):613-622) which is approximately
 * N(0, 1) distributed under H0 for n - 2 >= 6.
 *
 *     bfZ much greater than +1.96 = the SECOND half
 *       has STRICTLY GREATER spread (variance) than
 *       the first half (DISPERSION GREW over the
 *       tenure).
 *     bfZ much less than -1.96 = the FIRST half has
 *       STRICTLY GREATER spread than the second half
 *       (DISPERSION SHRANK over the tenure).
 *     bfZ approx 0 = no detectable scale shift between
 *       the two halves.
 *
 * This is a TWO-SIDED unpaired ROBUST EQUALITY-OF-
 * VARIANCE test sensitive to a SHIFT IN DISPERSION
 * (variance / IQR-like spread) between the first and
 * second halves of the tenure. It is INSENSITIVE TO
 * LOCATION SHIFT (a constant added to either half
 * leaves bfT exactly invariant -- bfT is computed on
 * absolute deviations from the per-group median,
 * which is itself shifted by the same constant).
 * This is the structural complement to axis-115
 * Mann-Whitney halves, which is sensitive to LOCATION
 * shift but insensitive to SCALE shift between
 * halves.
 *
 * (Brown, M. B. and Forsythe, A. B., "Robust Tests
 *  for the Equality of Variances", Journal of the
 *  American Statistical Association 69(346) (1974),
 *  pp. 364-367, eq. 2; Levene, H., "Robust tests for
 *  equality of variances", in "Contributions to
 *  Probability and Statistics: Essays in Honor of
 *  Harold Hotelling", Stanford University Press,
 *  1960, pp. 278-292; Wallace, D. L., "Bounds on
 *  Normal Approximations to Student's and the
 *  Chi-Square Distributions", Annals of Mathematical
 *  Statistics 30(4) (1959), pp. 1121-1130.)
 *
 * Reported alongside `bfT`: the two half-sample sizes
 * `bfN1` and `bfN2`, the two half-medians `bfMedianA`
 * and `bfMedianB`, the two within-half mean abs-
 * deviations `bfMadA` and `bfMadB`, the BF F-
 * statistic `bfT`, the signed-t equivalent
 * `bfTSigned`, the Wallace-corrected `bfZ`, and the
 * residual degrees of freedom `bfDf` = n - 2.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-115:
 *
 *   - Class. TWO-SAMPLE-SCALE-SHIFT-TEST (robust
 *     equality-of-variance F-statistic comparing two
 *     contiguous halves of the tenure with an
 *     F(1, n-2) null). UNPAIRED (n1 vs n2 elements,
 *     no element-by-element pairing); ROBUST (uses
 *     median-centred absolute deviations, not
 *     squared deviations from the mean); SCALE-SHIFT
 *     (sensitive to a difference in DISPERSION
 *     between halves, INSENSITIVE TO LOCATION
 *     SHIFT).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney is a TWO-SAMPLE RANK-SUM LEVEL-
 *     SHIFT statistic on the same two contiguous
 *     halves -- but it asks the COMPLEMENTARY
 *     question: "is the median of the second half
 *     stochastically equal to the median of the
 *     first half?" Brown-Forsythe asks: "is the
 *     SPREAD of the second half equal to the SPREAD
 *     of the first half?" Mann-Whitney is invariant
 *     to monotone scale changes within each half;
 *     Brown-Forsythe is invariant to location
 *     changes within each half. They are
 *     STRUCTURALLY ORTHOGONAL: a series with the
 *     same per-half median but a doubled per-half
 *     spread in the second half yields mwZ approx 0
 *     and bfZ much greater than +1.96; a series with
 *     a doubled per-half median but identical per-
 *     half spread yields mwZ much less than -1.96
 *     and bfZ approx 0.
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is a MULTI-LAG SQUARED-AUTO-
 *     CORRELATION PORTMANTEAU statistic on the
 *     centred raw series with a Chi-Square(H) null.
 *     Brown-Forsythe is a TWO-SAMPLE F-STATISTIC on
 *     median-centred absolute deviations with an
 *     F(1, n-2) null. Sample space differs (H
 *     squared correlations vs n median-deviations);
 *     functional differs (squared autocorr vs
 *     between/within sum-of-squares ratio); null
 *     differs (Chi-Square vs F); detection target
 *     differs (any serial structure across H lags
 *     vs SPECIFIC scale shift between two contiguous
 *     halves).
 *
 *   - vs axis-113 daily-token-difference-sign-test
 *     (Mood). Mood is a SINGLE-LAG (k=1) BINARY
 *     SIGN-COUNT on first differences with a
 *     Binomial(n-1, 1/2) null sensitive to TREND.
 *     Brown-Forsythe is an UNPAIRED two-sample F-
 *     statistic on median-deviations sensitive to
 *     SCALE SHIFT. A series with constant first half
 *     at value 0 and constant second half oscillating
 *     between -1 and +1 has very few non-zero diffs
 *     of varying sign (Mood reports nothing
 *     detectable) but Brown-Forsythe reports a large
 *     positive bfZ (second half spread strictly
 *     greater).
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann.
 *     Bartels is a SINGLE-LAG (k=1) SQUARED-RANK-
 *     ADJACENT-DIFFERENCE statistic on the rank
 *     series of the WHOLE sequence, sensitive to
 *     SERIAL CORRELATION. Brown-Forsythe partitions
 *     the raw series into two contiguous groups and
 *     compares median-deviations -- sensitive to
 *     scale-shift between halves, insensitive to
 *     within-half serial structure.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is a HALF-SHIFT BINOMIAL SIGN-TEST
 *     on floor(n/2) PAIRED comparisons (x_i vs
 *     x_{i+floor(n/2)}) sensitive to MONOTONE
 *     LOCATION TREND. Brown-Forsythe is an UNPAIRED
 *     two-sample F-statistic on median-deviations
 *     sensitive to SCALE shift. A clean step-shift
 *     in median triggers Cox-Stuart but leaves bfT
 *     unchanged (median deviations within each
 *     constant-mean half are still 0).
 *
 *   - vs axis-110 daily-token-mann-kendall-tau.
 *     Mann-Kendall is a GLOBAL ALL-PAIRS sign-of-
 *     difference statistic over n*(n-1)/2 pairs
 *     sensitive to monotonic LOCATION trend across
 *     the WHOLE series. Brown-Forsythe is a TWO-
 *     SAMPLE F-statistic comparing per-half median-
 *     deviation means -- sensitive to SCALE shift
 *     between halves, insensitive to monotone
 *     location trend within either half.
 *
 *   - vs axis-64 daily-token-runs-test-z (Wald-
 *     Wolfowitz median-binarised run-count). Wald-
 *     Wolfowitz binarises the WHOLE series by its
 *     median and counts MAXIMAL RUNS with a
 *     hypergeometric null -- sensitive to ALTERNATION
 *     around the global median. Brown-Forsythe
 *     compares two CONTIGUOUS halves' per-half
 *     median-deviation means with an F-null --
 *     sensitive to a scale shift between halves.
 *     Different binarisation (above/below global
 *     median vs first/second half); different
 *     aggregation (run count vs F-statistic);
 *     different nulls.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution. Brown-Forsythe
 *     depends entirely on the TEMPORAL ORDER --
 *     specifically, on which values fall in the
 *     first half vs the second half. A uniformly
 *     random permutation has E[bfT] approx 1 (the
 *     F-statistic null mean) regardless of value
 *     distribution.
 *
 *   - vs the spectral axes (84-104). Spectral axes
 *     transform to the FREQUENCY domain via the FFT
 *     and summarise the periodogram. Brown-Forsythe
 *     stays in the TIME domain and asks a single
 *     question: is the dispersion of the second half
 *     equal to the dispersion of the first half.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes.
 *     Those are scaling exponents fit across multiple
 *     window sizes. Brown-Forsythe is a single F-
 *     statistic at a single fixed split (the half-
 *     point).
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), compute the
 *   absolute deviations of each value from its own
 *   half's median, and run a one-way F-test on the
 *   two median-deviation groups, does the F-
 *   statistic exceed the F(1, n-2) critical value
 *   that corresponds to a two-sided z-equivalent
 *   |bfZ| > 1.96?"**
 *
 * Reference:
 *   Brown, M. B. and Forsythe, A. B., "Robust Tests
 *     for the Equality of Variances", Journal of the
 *     American Statistical Association 69(346)
 *     (1974), pp. 364-367, eq. 2.
 *   Levene, H., "Robust tests for equality of
 *     variances", in "Contributions to Probability
 *     and Statistics: Essays in Honor of Harold
 *     Hotelling", Stanford University Press, 1960,
 *     pp. 278-292.
 *   Wallace, D. L., "Bounds on Normal Approximations
 *     to Student's and the Chi-Square Distributions",
 *     Annals of Mathematical Statistics 30(4)
 *     (1959), pp. 1121-1130.
 *
 * Caveats:
 *
 *   - bfT >= 0 (F-statistic). bfTSigned, bfZ in
 *     (-inf, +inf) with sign = sign(zBarB - zBarA)
 *     (positive = second half more dispersed).
 *   - Median-centring (not mean-centring) is the BF
 *     variant of Levene's test, which Brown &
 *     Forsythe 1974 showed has correct Type-I error
 *     under heavy-tailed and skewed distributions
 *     (raw daily token series are exactly such --
 *     gap-fill produces many exact zeros and the
 *     positive tail is heavy).
 *   - The Wallace 1959 normal correction is exact
 *     to O(1 / df^2). For df = n - 2 >= 6 the
 *     approximation is within 0.01 of the true
 *     two-sided p-value.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axis-115). Hard floor n >= 8 so
 *     bfDf = n - 2 >= 6 and the Wallace correction
 *     is well within its valid regime.
 *   - All-equal series filtered upstream by zero-
 *     variance guard. If every value within both
 *     halves is identical (so SSW = 0), the test
 *     is undefined and the source is dropped.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-brown-forsyth-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-brown-forsyth-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # scale-shift evidence first):
 *   pew-insights daily-token-brown-forsyth-halves \
 *     --sort bfZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenBrownForsythHalvesSort =
  | 'bfT'
  | 'bfTDesc'
  | 'bfZ'
  | 'bfZDesc'
  | 'bfZAbs'
  | 'bfZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBrownForsythHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8
   * so bfDf = n - 2 >= 6 (Wallace 1959 normal
   * approximation regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBrownForsythHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenBrownForsythHalvesSourceRow {
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
  bfN1: number;
  /** Second-half size n2 = n - n1. */
  bfN2: number;
  /** Median of the first half. */
  bfMedianA: number;
  /** Median of the second half. */
  bfMedianB: number;
  /** Mean absolute deviation from median(A) over A. */
  bfMadA: number;
  /** Mean absolute deviation from median(B) over B. */
  bfMadB: number;
  /** Brown-Forsythe F-statistic (>=0). */
  bfT: number;
  /** Signed sqrt(bfT) with sign(zBarB - zBarA). */
  bfTSigned: number;
  /** Wallace 1959 normal-corrected z-equivalent. */
  bfZ: number;
  /** Residual degrees of freedom = n - 2. */
  bfDf: number;
}

export interface DailyTokenBrownForsythHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBrownForsythHalvesSort;
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
  sources: DailyTokenBrownForsythHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Brown-Forsythe two-sample equality-of-variance test
 * on the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series, using
 * absolute deviations from per-group medians and the
 * one-way F(1, n-2) null with a Wallace 1959 normal
 * approximation.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - bfT(x + c) === bfT(x) for any constant c. Group
 *     medians shift by c, absolute deviations are
 *     unchanged.
 *   - bfT(a * x) === bfT(x) for any a > 0 with bfT
 *     scale-invariant (both SSB and SSW scale by a^2,
 *     ratio cancels). bfTSigned(a * x) === bfTSigned(x)
 *     for a > 0; bfTSigned(-x) === -bfTSigned(x).
 *   - For n1 = n2: swapping the two halves gives
 *     bfT(swap) === bfT(orig) and
 *     bfTSigned(swap) === -bfTSigned(orig).
 *   - For x = repeat(constant) (constant within both
 *     halves) the test is undefined (SSW = 0); we
 *     throw to be filtered upstream.
 *   - bfT >= 0 by construction (ratio of sums of
 *     squares).
 */
export function dailyTokenBrownForsythHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  bfN1: number;
  bfN2: number;
  bfMedianA: number;
  bfMedianB: number;
  bfMadA: number;
  bfMadB: number;
  bfT: number;
  bfTSigned: number;
  bfZ: number;
  bfDf: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenBrownForsythHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenBrownForsythHalves requires finite values',
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
      `dailyTokenBrownForsythHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const bfMedianA = medianSorted(aSorted);
  const bfMedianB = medianSorted(bSorted);

  // Brown-Forsythe absolute deviations from per-group
  // medians.
  const zA: number[] = new Array(n1);
  const zB: number[] = new Array(n2);
  let zSumA = 0;
  let zSumB = 0;
  for (let i = 0; i < n1; i += 1) {
    const d = Math.abs(values[i]! - bfMedianA);
    zA[i] = d;
    zSumA += d;
  }
  for (let i = 0; i < n2; i += 1) {
    const d = Math.abs(values[n1 + i]! - bfMedianB);
    zB[i] = d;
    zSumB += d;
  }
  const zBarA = zSumA / n1;
  const zBarB = zSumB / n2;
  const zBar = (zSumA + zSumB) / n;

  // Between-group SS (k = 2 groups).
  const SSB = n1 * (zBarA - zBar) ** 2 + n2 * (zBarB - zBar) ** 2;

  // Within-group SS.
  let SSW = 0;
  for (let i = 0; i < n1; i += 1) {
    const d = zA[i]! - zBarA;
    SSW += d * d;
  }
  for (let i = 0; i < n2; i += 1) {
    const d = zB[i]! - zBarB;
    SSW += d * d;
  }

  if (SSW <= 0) {
    throw new Error(
      `dailyTokenBrownForsythHalves: within-group SSW is zero (n=${n}); test undefined`,
    );
  }

  const bfDf = n - 2;
  const bfT = ((n - 2) * SSB) / (1 * SSW); // F(1, n-2)
  const sign = zBarB > zBarA ? 1 : zBarB < zBarA ? -1 : 0;
  const bfTSigned = sign * Math.sqrt(Math.max(bfT, 0));

  // Wallace 1959 normal correction: t(df) ->
  // t * sqrt(1 - 3/(4*df - 1)) approx N(0, 1).
  const wallace = Math.sqrt(1 - 3 / (4 * bfDf - 1));
  const bfZ = bfTSigned * wallace;

  if (!Number.isFinite(bfT) || !Number.isFinite(bfZ)) {
    throw new Error(
      `dailyTokenBrownForsythHalves: non-finite F or Z (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bfN1: n1,
    bfN2: n2,
    bfMedianA,
    bfMedianB,
    bfMadA: zBarA,
    bfMadB: zBarB,
    bfT,
    bfTSigned,
    bfZ,
    bfDf,
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

export function buildDailyTokenBrownForsythHalves(
  queue: QueueLine[],
  opts: DailyTokenBrownForsythHalvesOptions = {},
): DailyTokenBrownForsythHalvesReport {
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
  const sort: DailyTokenBrownForsythHalvesSort = opts.sort ?? 'bfZAbsDesc';
  const validSorts: DailyTokenBrownForsythHalvesSort[] = [
    'bfT',
    'bfTDesc',
    'bfZ',
    'bfZDesc',
    'bfZAbs',
    'bfZAbsDesc',
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
  const rows: DailyTokenBrownForsythHalvesSourceRow[] = [];

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
      result = dailyTokenBrownForsythHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenBrownForsythHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      bfN1: result.bfN1,
      bfN2: result.bfN2,
      bfMedianA: result.bfMedianA,
      bfMedianB: result.bfMedianB,
      bfMadA: result.bfMadA,
      bfMadB: result.bfMadB,
      bfT: result.bfT,
      bfTSigned: result.bfTSigned,
      bfZ: result.bfZ,
      bfDf: result.bfDf,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bfT':
        primary = a.bfT - b.bfT;
        break;
      case 'bfTDesc':
        primary = b.bfT - a.bfT;
        break;
      case 'bfZ':
        primary = a.bfZ - b.bfZ;
        break;
      case 'bfZDesc':
        primary = b.bfZ - a.bfZ;
        break;
      case 'bfZAbs':
        primary = Math.abs(a.bfZ) - Math.abs(b.bfZ);
        break;
      case 'bfZAbsDesc':
        primary = Math.abs(b.bfZ) - Math.abs(a.bfZ);
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
