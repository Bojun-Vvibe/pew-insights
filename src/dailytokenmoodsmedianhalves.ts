/**
 * daily-token-moods-median-halves: per-source MOOD'S
 * MEDIAN TEST comparing the first half vs the second half
 * of the gap-filled daily total_tokens series via a 2x2
 * contingency table on counts above/below the POOLED
 * median, with a CHI-SQUARE(1) null and Yates'
 * continuity correction.
 *
 * ONE-HUNDRED-AND-SEVENTY-FIRST cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Compute the POOLED MEDIAN m of all n values. Build the
 * 2x2 contingency table (Mood 1950, "Introduction to the
 * Theory of Statistics", McGraw-Hill, sec. 16.5):
 *
 *                 above m       at-or-below m       total
 *     A           a              n1 - a             n1
 *     B           b              n2 - b             n2
 *     total       a + b          n - (a+b)          n
 *
 * where a = #{i in [0,n1): x[i] > m} and b =
 * #{i in [n1,n): x[i] > m}. Tied-with-median values are
 * assigned to the AT-OR-BELOW cell (Hollander, Wolfe &
 * Chicken 2014 sec. 6.3 convention; equivalent to the
 * "high" classification of Brown 1975, J. Amer. Stat.
 * Assoc. 70(351):690-692). With n even, exactly half the
 * pooled values fall above m and half at-or-below; with n
 * odd the median itself sits in the at-or-below cell so
 * (n-1)/2 are above.
 *
 * The PEARSON CHI-SQUARE statistic with YATES'
 * CONTINUITY CORRECTION (Yates 1934, Suppl. J. R. Stat.
 * Soc. 1(2):217-235) for a 2x2 table is
 *
 *     mdChi2 = n * (|a*(n2 - b) - b*(n1 - a)| - n/2)^2
 *              / ( n1 * n2 * (a+b) * (n - (a+b)) )
 *
 * with the |.| - n/2 clamped at 0 if the unsigned cross-
 * product residual is below n/2 (the standard Yates
 * floor). Under H0 (equal medians, i.e. both halves drawn
 * from distributions with the same median) and for n not
 * too small (Cochran 1954 rule of thumb: all expected
 * cell counts >= 5; we require n >= 8 and at least one
 * value strictly above m), mdChi2 ~ Chi-Square(1) and
 *
 *     mdZ = sign(a/n1 - b/n2) * sqrt(mdChi2)
 *
 * is the SIGNED z-equivalent (positive mdZ means the
 * first half has a HIGHER PROPORTION OF ABOVE-MEDIAN
 * VALUES, i.e. the first half tends to LARGER
 * values, i.e. the median has DROPPED across the tenure).
 *
 * The two-sided p-value comes from the chi-square upper
 * tail
 *
 *     mdTwoSidedP = 1 - F_{Chi-Square(1)}(mdChi2)
 *                 = erfc(sqrt(mdChi2 / 2))
 *
 * (using the Chi-Square(1) = Z^2 identity, so the
 * Chi-Square(1) CDF equals 2*Phi(sqrt(x)) - 1, and the
 * upper-tail equals 2*(1 - Phi(sqrt(x))) = erfc of
 * sqrt(x/2)).
 *
 * SIGN CONVENTION. Positive mdZ = first half has more
 * above-median values = first half RUNS LARGER = MEDIAN
 * DECREASED over the tenure. Negative mdZ = MEDIAN
 * INCREASED. The convention is INTENTIONALLY OPPOSITE to
 * axis-117 stZ (which targets scale, not location): mdZ
 * tracks the LOCATION SHIFT direction directly.
 *
 *     mdZ much greater than +1.96  ->  first half larger;
 *       MEDIAN DROPPED over the tenure.
 *     mdZ much less than -1.96     ->  second half larger;
 *       MEDIAN ROSE over the tenure.
 *     mdZ approx 0                  ->  no detectable
 *       shift in median between the halves.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-115 daily-token-mann-whitney-halves. Both
 *     are TWO-SAMPLE LOCATION tests on the same
 *     first/second-half partition. Mann-Whitney uses
 *     MONOTONIC RANKS on all n values and is sensitive
 *     to stochastic dominance over the ENTIRE
 *     distribution; Mood's median REDUCES every value
 *     to a BINARY above/at-or-below the pooled median
 *     and discards all magnitude information. Operative
 *     consequence: Mood's median is INVARIANT under any
 *     monotone transform of the data (log, sqrt,
 *     bucketing) and is HIGHLY ROBUST to heavy-tailed
 *     contamination -- a single extreme spike that
 *     would dominate Mann-Whitney's rank-sum is just
 *     "1 above-median count" to Mood. The two tests
 *     have DIFFERENT NULL DISTRIBUTIONS (Normal vs
 *     Chi-Square(1)) and DISAGREE on a finite-sample
 *     basis when the location shift is small but the
 *     dispersion is uneven.
 *
 *   - vs axis-170 daily-token-ansari-bradley-halves. AB
 *     is a SCALE-SHIFT test on FOLDED ranks of MEDIAN-
 *     CENTRED values (removes location before testing
 *     dispersion); Mood's median is a LOCATION-SHIFT
 *     test on BINARY counts above the POOLED MEDIAN
 *     (no centring). They target ORTHOGONAL components
 *     of the two-sample shift: AB sees scale, Mood
 *     sees location. The functionals share NO common
 *     transformation: AB's folded-rank vector is a
 *     symmetric function of the centred pool; Mood's
 *     count vector is a binary indicator on the raw
 *     pool.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves. KS
 *     is a SUP-NORM EDF DIFFERENCE on the entire
 *     empirical CDF -- ANY shape difference (location,
 *     scale, modality, etc.) registers. Mood's median
 *     evaluates the EDF DIFFERENCE AT EXACTLY ONE
 *     POINT (the pooled median); a series whose halves
 *     differ ONLY in their tails registers strongly on
 *     KS but exactly null on Mood's median. The
 *     functionals are not even monotone-related.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau and
 *     axis-111 daily-token-cox-stuart-trend-test. These
 *     are MONOTONIC-TREND tests that scan ALL pairs
 *     (Mann-Kendall) or symmetric pairs across the
 *     whole series (Cox-Stuart). Mood's median is a
 *     fixed FIRST-VS-SECOND-HALF binary partition and
 *     does not see any within-half ordering (a series
 *     where the first half is shuffled in any order but
 *     keeps the same number of above-median values
 *     gives the IDENTICAL mdZ).
 *
 *   - vs the cumulative-periodogram axes (167-169).
 *     Frequency-domain goodness-of-fit against white
 *     noise on the whole series. Mood's median is
 *     time-domain, two-sample, contingency-table on a
 *     fixed first/second-half split.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     ..). Permutation-invariant functionals of the
 *     empirical distribution. Mood's median depends on
 *     temporal ORDER (which half each value belongs
 *     to).
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), compute the pooled median m, count
 *   how many values in each half exceed m, and compute
 *   the Yates-corrected Pearson chi-square on the
 *   resulting 2x2 table, does the resulting |mdZ| =
 *   sqrt(mdChi2) exceed 1.96?"**
 *
 * Reference:
 *   Mood, A. M., "Introduction to the Theory of
 *     Statistics", McGraw-Hill, 1950, sec. 16.5.
 *   Hollander, M., Wolfe, D. A. and Chicken, E.,
 *     "Nonparametric Statistical Methods", 3rd ed.,
 *     Wiley, 2014, sec. 6.3.
 *   Yates, F., "Contingency Tables Involving Small
 *     Numbers and the Chi-Square Test", Suppl. J. R.
 *     Stat. Soc. 1(2) (1934), pp. 217-235.
 *
 * Caveats:
 *
 *   - The chi-square approximation to the EXACT 2x2
 *     hypergeometric (Fisher's exact test) deteriorates
 *     when expected cell counts fall below 5. We
 *     require n >= 8 (so n1, n2 >= 4); for n in [8, 12]
 *     the Yates correction makes the approximation
 *     conservative. The code throws if any column
 *     marginal is 0 (no above-median or no
 *     at-or-below-median values, which happens when
 *     all values are equal -- already guarded upstream
 *     by the zero-variance check).
 *   - Tied-with-median values are placed in the
 *     AT-OR-BELOW cell (low classification). This
 *     differs from Hettmansperger 1984 sec. 4.2 which
 *     splits ties symmetrically; our convention matches
 *     Hollander/Wolfe/Chicken 2014 and the R package
 *     'agricolae' default.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-moods-median-halves
 *
 *   pew-insights daily-token-moods-median-halves \
 *     --json --min-tenure-days 14 --sort mdZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenMoodsMedianHalvesSort =
  | 'mdChi2'
  | 'mdChi2Desc'
  | 'mdZ'
  | 'mdZDesc'
  | 'mdZAbs'
  | 'mdZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMoodsMedianHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * each half has at least 4 observations and Yates-
   * corrected chi-square is reasonable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMoodsMedianHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMoodsMedianHalvesSourceRow {
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
  mdN1: number;
  /** Second-half size n2 = n - n1. */
  mdN2: number;
  /** Pooled median used as the cut. */
  mdPooledMedian: number;
  /** Count of first-half values strictly above the pooled median. */
  mdAboveA: number;
  /** Count of second-half values strictly above the pooled median. */
  mdAboveB: number;
  /** Yates-corrected Pearson chi-square statistic (1 df). */
  mdChi2: number;
  /** Signed z-equivalent: sign(aboveA/n1 - aboveB/n2) * sqrt(mdChi2). */
  mdZ: number;
  /** Two-sided p-value: 1 - F_{ChiSq(1)}(mdChi2). */
  mdTwoSidedP: number;
}

export interface DailyTokenMoodsMedianHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMoodsMedianHalvesSort;
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
  sources: DailyTokenMoodsMedianHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Standard normal CDF Phi(z) via Abramowitz & Stegun 1964
 * formula 26.2.17 (rational approximation, max error
 * ~7.5e-8 across all real z). Self-contained -- duplicates
 * the helper from axis-170 to keep this module
 * self-contained.
 */
export function moodsMedianStandardNormalCdf(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`moodsMedianStandardNormalCdf: non-finite input (${z})`);
  }
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * a);
  const phi = Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI);
  const tail =
    phi * (b1 * t + b2 * t * t + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5);
  const upper = tail;
  const result = sign === 1 ? 1 - upper : upper;
  if (result < 0) return 0;
  if (result > 1) return 1;
  return result;
}

/**
 * Chi-Square(1) upper-tail survival function via the
 * Z^2 identity: ChiSq(1) = Z^2, so
 *   P(ChiSq(1) > x) = P(|Z| > sqrt(x)) = 2 * (1 - Phi(sqrt(x))).
 *
 * Returns 1 for x <= 0, 0 for non-finite-large positive x.
 */
export function chiSquare1UpperTail(x: number): number {
  if (!Number.isFinite(x)) {
    throw new Error(`chiSquare1UpperTail: non-finite input (${x})`);
  }
  if (x <= 0) return 1;
  const r = 2 * (1 - moodsMedianStandardNormalCdf(Math.sqrt(x)));
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

/**
 * Mood's median test on the first half (A = x[0..n1-1])
 * vs second half (B = x[n1..n-1]) of a real-valued
 * series, with Yates' continuity correction on the 2x2
 * contingency table.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - mdChi2(x + c) === mdChi2(x) for any constant c
 *     (a uniform shift moves the pooled median by c and
 *     leaves the above/below indicator unchanged).
 *   - mdChi2(a * x) === mdChi2(x) for any a > 0 (scaling
 *     preserves the pooled median's order rank, which
 *     is all the test depends on).
 *   - mdChi2(f(x)) === mdChi2(x) for ANY strictly
 *     monotone f (the sign convention may flip if f is
 *     decreasing, but |mdZ| is invariant). This is the
 *     defining property that distinguishes Mood from
 *     Mann-Whitney.
 *   - For x = repeat(constant) the test is undefined
 *     (zero variance, zero column-marginal); we throw to
 *     be filtered upstream.
 *   - For perfectly-balanced halves (a = n1/2, b = n2/2
 *     when n is even and median splits exactly) mdChi2
 *     equals 0 modulo Yates clamping.
 */
export function dailyTokenMoodsMedianHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  mdN1: number;
  mdN2: number;
  mdPooledMedian: number;
  mdAboveA: number;
  mdAboveB: number;
  mdChi2: number;
  mdZ: number;
  mdTwoSidedP: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenMoodsMedianHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenMoodsMedianHalves requires finite values');
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
      `dailyTokenMoodsMedianHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pooled median.
  const pooled = values.slice().sort((p, q) => p - q);
  const mdPooledMedian = medianSorted(pooled);

  // Count above-median in each half. Tied-with-median ->
  // at-or-below cell (Hollander/Wolfe/Chicken convention).
  let mdAboveA = 0;
  for (let i = 0; i < n1; i += 1) {
    if (values[i]! > mdPooledMedian) mdAboveA += 1;
  }
  let mdAboveB = 0;
  for (let i = n1; i < n; i += 1) {
    if (values[i]! > mdPooledMedian) mdAboveB += 1;
  }

  const colAbove = mdAboveA + mdAboveB;
  const colBelow = n - colAbove;
  if (colAbove === 0 || colBelow === 0) {
    throw new Error(
      `dailyTokenMoodsMedianHalves: degenerate column marginal (above=${colAbove}, below=${colBelow}, n=${n})`,
    );
  }

  // Yates-corrected Pearson chi-square for a 2x2 table:
  //   chi2 = n * (|a*d - b*c| - n/2)^2 / (r1 * r2 * c1 * c2)
  // with the |.| - n/2 floored at 0.
  const a = mdAboveA;
  const b = mdAboveB;
  const c = n1 - a;
  const d = n2 - b;
  const cross = Math.abs(a * d - b * c);
  const corrected = Math.max(0, cross - n / 2);
  const numer = n * corrected * corrected;
  const denomChi = n1 * n2 * colAbove * colBelow;
  const mdChi2 = numer / denomChi;

  // Sign: positive mdZ = first half larger (more above-
  // median) = MEDIAN DROPPED over the tenure.
  const propA = a / n1;
  const propB = b / n2;
  const sign = propA > propB ? 1 : propA < propB ? -1 : 0;
  const mdZ = sign * Math.sqrt(mdChi2);
  const mdTwoSidedP = chiSquare1UpperTail(mdChi2);

  if (
    !Number.isFinite(mdChi2) ||
    !Number.isFinite(mdZ) ||
    !Number.isFinite(mdTwoSidedP)
  ) {
    throw new Error(
      `dailyTokenMoodsMedianHalves: non-finite output (n=${n}, mdChi2=${mdChi2})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mdN1: n1,
    mdN2: n2,
    mdPooledMedian,
    mdAboveA,
    mdAboveB,
    mdChi2,
    mdZ,
    mdTwoSidedP,
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

export function buildDailyTokenMoodsMedianHalves(
  queue: QueueLine[],
  opts: DailyTokenMoodsMedianHalvesOptions = {},
): DailyTokenMoodsMedianHalvesReport {
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
  const sort: DailyTokenMoodsMedianHalvesSort = opts.sort ?? 'mdZAbsDesc';
  const validSorts: DailyTokenMoodsMedianHalvesSort[] = [
    'mdChi2',
    'mdChi2Desc',
    'mdZ',
    'mdZDesc',
    'mdZAbs',
    'mdZAbsDesc',
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
  const rows: DailyTokenMoodsMedianHalvesSourceRow[] = [];

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
      result = dailyTokenMoodsMedianHalves(filled);
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
      mdN1: result.mdN1,
      mdN2: result.mdN2,
      mdPooledMedian: result.mdPooledMedian,
      mdAboveA: result.mdAboveA,
      mdAboveB: result.mdAboveB,
      mdChi2: result.mdChi2,
      mdZ: result.mdZ,
      mdTwoSidedP: result.mdTwoSidedP,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mdChi2':
        primary = a.mdChi2 - b.mdChi2;
        break;
      case 'mdChi2Desc':
        primary = b.mdChi2 - a.mdChi2;
        break;
      case 'mdZ':
        primary = a.mdZ - b.mdZ;
        break;
      case 'mdZDesc':
        primary = b.mdZ - a.mdZ;
        break;
      case 'mdZAbs':
        primary = Math.abs(a.mdZ) - Math.abs(b.mdZ);
        break;
      case 'mdZAbsDesc':
        primary = Math.abs(b.mdZ) - Math.abs(a.mdZ);
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
 * Corpus-level aggregator for axis-171 per-source results
 * via the COCHRAN-MANTEL-HAENSZEL POOLED CHI-SQUARE
 * (Cochran 1954, Biometrics 10(4):417-451; Mantel &
 * Haenszel 1959, J. Natl. Cancer Inst. 22(4):719-748).
 *
 * For K independent 2x2 tables (one per source), the
 * Mantel-Haenszel statistic is
 *
 *   cmhChi2 = ( |sum_i (a_i - E[a_i])| - 0.5 )^2
 *             / sum_i Var[a_i]
 *
 * where for source i with marginals (n1_i, n2_i,
 * colAbove_i, colBelow_i) and total n_i = n1_i + n2_i,
 *
 *   E[a_i]   = n1_i * colAbove_i / n_i
 *   Var[a_i] = n1_i * n2_i * colAbove_i * colBelow_i
 *              / ( n_i^2 * (n_i - 1) )
 *
 * (the hypergeometric mean / variance of a_i under the
 * H0 of equal medians within each stratum). The 0.5 is
 * the canonical Mantel-Haenszel continuity correction.
 *
 * Under the global H0 that ALL sources have equal
 * medians across their two halves AND the sources are
 * independent, cmhChi2 ~ Chi-Square(1).
 *
 * Why CMH (this axis) vs Stouffer (axis-170 aggregator):
 * the per-source statistic here is a 2x2 contingency
 * table -- the natural pooled statistic is the
 * stratified Mantel-Haenszel chi-square, which weights
 * each table by its INFORMATION (variance) under the
 * hypergeometric null. This is more efficient than a
 * Stouffer combination of per-source mdZ when stratum
 * sizes vary widely -- a small-n source with |mdZ| = 3
 * carries less hypergeometric information than a large-n
 * source with |mdZ| = 1.5.
 *
 * Returns:
 *   cmhChi2          -- pooled Yates-style chi-square(1).
 *   cmhTwoSidedP     -- 1 - F_{ChiSq(1)}(cmhChi2).
 *   cmhSignedZ       -- sign(sum_i (a_i - E[a_i])) * sqrt(cmhChi2);
 *                       positive = corpus-level MEDIAN DROPPED
 *                       (more above-median values fell in the
 *                       first halves on average).
 *   sumObservedMinusExpected -- sum_i (a_i - E[a_i]).
 *   sumVariance      -- sum_i Var[a_i].
 *   rowsUsed / rowsSkipped -- defensive book-keeping.
 *
 * Malformed rows (non-finite fields, non-integer counts,
 * zero variance) are SKIPPED with a counter rather than
 * throwing.
 */
export interface MoodsMedianHalvesCorpusAggregate {
  cmhChi2: number;
  cmhTwoSidedP: number;
  cmhSignedZ: number;
  sumObservedMinusExpected: number;
  sumVariance: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateMoodsMedianHalves(
  rows: ReadonlyArray<{
    mdN1: number;
    mdN2: number;
    mdAboveA: number;
    mdAboveB: number;
  }>,
): MoodsMedianHalvesCorpusAggregate {
  let sumOmE = 0;
  let sumVar = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isInteger(r.mdN1) ||
      !Number.isInteger(r.mdN2) ||
      !Number.isInteger(r.mdAboveA) ||
      !Number.isInteger(r.mdAboveB) ||
      r.mdN1 < 1 ||
      r.mdN2 < 1
    ) {
      skipped += 1;
      continue;
    }
    const a = r.mdAboveA;
    const n1 = r.mdN1;
    const n2 = r.mdN2;
    const n = n1 + n2;
    const colAbove = r.mdAboveA + r.mdAboveB;
    const colBelow = n - colAbove;
    if (
      colAbove < 1 ||
      colBelow < 1 ||
      a < 0 ||
      a > n1 ||
      r.mdAboveB < 0 ||
      r.mdAboveB > n2 ||
      n < 2
    ) {
      skipped += 1;
      continue;
    }
    const expectedA = (n1 * colAbove) / n;
    const varA =
      (n1 * n2 * colAbove * colBelow) / (n * n * (n - 1));
    if (!Number.isFinite(expectedA) || !Number.isFinite(varA) || varA <= 0) {
      skipped += 1;
      continue;
    }
    sumOmE += a - expectedA;
    sumVar += varA;
    used += 1;
  }
  if (used === 0 || sumVar <= 0) {
    return {
      cmhChi2: Number.NaN,
      cmhTwoSidedP: Number.NaN,
      cmhSignedZ: Number.NaN,
      sumObservedMinusExpected: sumOmE,
      sumVariance: sumVar,
      rowsUsed: used,
      rowsSkipped: skipped,
    };
  }
  const corrected = Math.max(0, Math.abs(sumOmE) - 0.5);
  const cmhChi2 = (corrected * corrected) / sumVar;
  const cmhTwoSidedP = chiSquare1UpperTail(cmhChi2);
  const sign = sumOmE > 0 ? 1 : sumOmE < 0 ? -1 : 0;
  const cmhSignedZ = sign * Math.sqrt(cmhChi2);
  return {
    cmhChi2,
    cmhTwoSidedP,
    cmhSignedZ,
    sumObservedMinusExpected: sumOmE,
    sumVariance: sumVar,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}
