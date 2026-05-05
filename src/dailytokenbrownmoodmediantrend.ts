/**
 * daily-token-brown-mood-median-trend: per-source
 * BROWN-MOOD MEDIAN TREND TEST on the gap-filled daily
 * total_tokens series.
 *
 * TWO-HUNDRED-AND-ELEVENTH cross-source axis.
 *
 * Mechanism. Brown & Mood (1951, "On median tests for
 * linear hypotheses", *Proc. Second Berkeley Symp. on
 * Math. Stat. Probab.*, vol. 1, pp. 159-166) introduced
 * a class of MEDIAN-COUNT tests for linear hypotheses;
 * the trend variant compares the COUNT of values that
 * exceed the GLOBAL SAMPLE MEDIAN in the FIRST HALF of
 * the time window with the count in the SECOND HALF
 * via a 2x2 contingency table and a chi-square
 * statistic. Letting M = median(x[0..n-1]) and
 * splitting the time-ordered series into a first block
 * (indices 0..h-1) and a second block (indices h..n-1)
 * with h = floor(n/2), the four cell counts are
 *
 *     a = #{ i in [0, h) : x[i] >  M }   (first  above)
 *     b = #{ i in [0, h) : x[i] <= M }   (first  below-or-equal)
 *     c = #{ i in [h, n) : x[i] >  M }   (second above)
 *     d = #{ i in [h, n) : x[i] <= M }   (second below-or-equal)
 *
 * with row totals n1 = a + b = h, n2 = c + d = n - h
 * and column totals A = a + c, B = b + d, A + B = n.
 * Under H0 (no trend; the propensity to exceed the
 * global median is the same in both halves) the
 * standard PEARSON CHI-SQUARE statistic with one degree
 * of freedom is
 *
 *     bmChi2 = n * (a*d - b*c)^2
 *              / ((a + b) * (c + d) * (a + c) * (b + d))
 *
 * The matching SIGNED Z-statistic (one-degree-of-
 * freedom chi-square is the square of a standard
 * normal) is derived from the half-difference in the
 * estimated proportions p1 = a / n1 and p2 = c / n2:
 *
 *     bmZ = (p1 - p2) / sqrt(pHat * (1 - pHat) * (1/n1 + 1/n2))
 *
 * where pHat = A / n is the pooled proportion above
 * the median. bmChi2 = bmZ^2 (algebraically equal up
 * to floating round-off). The two-sided p-value is
 *
 *     bmPValue = 2 * (1 - Phi(|bmZ|))
 *              = 1 - F_chi2_1(bmChi2)             (equivalent)
 *
 * SIGN CONVENTION:
 *   - bmZ >> 0  <=>  p1 > p2  <=>  MORE values above
 *     the global median appear in the FIRST HALF than
 *     in the SECOND HALF  <=>  MONOTONE DOWN-TREND
 *     (the bulk has migrated below the median over
 *     time).
 *   - bmZ << 0  <=>  p1 < p2  <=>  MORE values above
 *     the global median in the SECOND HALF  <=>
 *     MONOTONE UP-TREND.
 *   - bmZ ~ 0   <=>  median exceedance is balanced
 *     across halves  <=>  NO MEDIAN-LEVEL TREND.
 *
 * NOTE on sign convention: this is OPPOSITE to the
 * usual "larger Z = up-trend" convention of the rank-
 * vs-time axes (Daniels axis-210, Spearman footrule
 * axis-208, Mann-Kendall) because we score the FIRST
 * half's above-median exceedance directly. Documented
 * here so downstream joiners are not confused.
 *
 * TIE HANDLING. The "<=" convention on the median
 * splits ties cleanly into the BELOW cell; this is
 * the conventional Brown-Mood treatment (Hollander-
 * Wolfe-Chicken 2014 sec. 6.6). When the global median
 * coincides with many observations the test loses
 * power but remains valid (a, b, c, d are still
 * non-negative integers summing to n). We surface the
 * count of observations EXACTLY equal to the median
 * (`nAtMedian`) so downstream consumers can detect
 * heavy-tie regimes.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim). The
 * mechanism is fundamentally different from every
 * recent trend axis:
 *
 *   - vs axis-210 Daniels rank-vs-time (drZ). Daniels
 *     uses the FULL VALUE-RANK sequence and correlates
 *     it with the time-identity (1..n) -- a
 *     CONTINUOUS-rank statistic sensitive to the
 *     DETAILED rank ordering. Brown-Mood collapses
 *     each value to a SINGLE BIT (above / not-above
 *     median) and bins it into one of TWO time
 *     buckets -- a MAXIMALLY-COARSE 2x2 statistic.
 *     Daniels uses n distinct ranks; Brown-Mood uses
 *     only 2 binary categories x 2 time bins. Brown-
 *     Mood is therefore much more ROBUST to outliers
 *     (a single huge spike contributes the same bit
 *     as a moderate above-median value) but much less
 *     POWERFUL against smooth trends. Different
 *     null variance, different power profile,
 *     different tie behaviour.
 *
 *   - vs axis-209 Wallis-Moore (wmZ). WM counts the
 *     number of MONOTONE PHASES in the SIGN-OF-FIRST-
 *     DIFFERENCE sequence -- a LOCAL CONTIGUOUS-PHASE
 *     statistic on differences. Brown-Mood is a
 *     GLOBAL median-level statistic on raw values.
 *     A series with a strong UP-TREND can have wmZ
 *     << 0 (few phases) AND bmZ << 0 (more above-
 *     median in second half). A series with iid
 *     noise around a constant level gives both ~ 0.
 *     But a series with HEAVY ZIGZAG and a slow
 *     DRIFT can give wmZ >> 0 (many phases) yet
 *     bmZ != 0 (drift visible at median level) --
 *     the two axes can disagree.
 *
 *   - vs axis-205 Cox-Stuart sign-pairs (csZ). CS
 *     pairs x[i] with x[i + ceil(n/2)] and signs the
 *     differences -- a HALF-LAG PAIRED-SIGN
 *     statistic that uses n/2 paired comparisons.
 *     Brown-Mood does NOT pair observations across
 *     halves; it counts above-median EXCEEDANCES in
 *     each half independently. CS is sensitive to
 *     PER-PAIR sign agreement; BM is sensitive to
 *     PROPORTION SHIFT relative to the global median.
 *     A series in which every pair (x[i], x[i+h])
 *     satisfies x[i+h] > x[i] gives csZ = -k_max but
 *     can give bmZ near 0 if the per-half above-
 *     median COUNTS happen to balance.
 *
 *   - vs axis-206 Jonckheere-Terpstra (jtZ). JT tests
 *     the ORDERED ALTERNATIVE across k=4 BLOCKS via
 *     SUMS OF U-COUNTS using the FULL within-block
 *     value distribution. Brown-Mood uses k=2 BLOCKS
 *     and only the BINARY ABOVE/NOT exceedance. JT's
 *     test statistic is a sum of n^2/8 pairwise
 *     comparisons; BM is a single 2x2 chi-square.
 *
 *   - vs axis-207 Pitman MSSD permutation. Pitman uses
 *     the SUM OF SQUARED FIRST DIFFERENCES vs the SAMPLE
 *     VARIANCE -- an L2 magnitude statistic on
 *     differences. Brown-Mood uses no differencing
 *     and no value magnitudes; only the binary
 *     above-median indicator and the time-half
 *     bucket.
 *
 *   - vs daily-token-mann-kendall-tau. MK counts
 *     pairwise sign agreement S = sum_{i<j} sign(
 *     x[j] - x[i]) -- a sum of n*(n-1)/2 PAIRWISE
 *     comparisons of all distinct pairs. Brown-Mood
 *     uses no pairwise value comparisons at all; it
 *     uses 2*n value-vs-median comparisons followed
 *     by a 2x2 chi-square. MK's null variance is
 *     2*(2n+5) / (9*n*(n-1)); BM's is (the standard
 *     2x2 chi-square 1-df null).
 *
 *   - vs daily-token-cox-stuart-trend-test. Same family
 *     as axis-205 above (different parameterisation).
 *     Brown-Mood remains distinct: BM never compares
 *     observations to each other.
 *
 *   - vs daily-token-difference-sign-test. Difference-
 *     sign counts the number of POSITIVE first
 *     differences out of n-1 -- a LOCAL one-step
 *     sign statistic. Brown-Mood is GLOBAL median-
 *     level only.
 *
 *   - vs daily-token-cusum-max-deviation. Cusum tracks
 *     the maximum absolute partial sum of (x[i] - mean);
 *     it is a CONTINUOUS-magnitude path-extremum
 *     statistic. Brown-Mood collapses to a 2x2 binary
 *     count.
 *
 * Pre-processing: NONE (besides gap-filling already
 * applied at the daily-aggregation layer).
 *
 * Refs:
 *   Brown, G. W. & Mood, A. M., "On median tests for
 *     linear hypotheses", in *Proc. Second Berkeley
 *     Symp. on Math. Stat. Probab.*, vol. 1 (1951),
 *     pp. 159-166.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.,
 *     Wiley (2014), sec. 6.6 (median test for trend).
 *   Gibbons, J. D. & Chakraborti, S., *Nonparametric
 *     Statistical Inference*, 4th ed., Marcel Dekker
 *     (2003), sec. 9.5 (chi-square 2x2 form).
 *   Conover, W. J., *Practical Nonparametric Statistics*,
 *     3rd ed., Wiley (1999), sec. 4.3 (Mood's median
 *     test, 2-sample form -- the trend variant uses
 *     time-halves as the two samples).
 */
import type { QueueLine } from './types.js';

export type DailyTokenBrownMoodMedianTrendSort =
  | 'bmZ'
  | 'bmZAbsDesc'
  | 'bmPValue'
  | 'bmPValueDesc'
  | 'bmChi2'
  | 'bmChi2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBrownMoodMedianTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep the chi-square 1-df normal approximation
   * reasonable (Cochran 1954 rule of thumb: each cell
   * expected count >= 5 with n >= 12 covers most cases
   * given a roughly balanced median split).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBrownMoodMedianTrendSort;
  generatedAt?: string;
}

export interface DailyTokenBrownMoodMedianTrendSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Sample mean of the gap-filled daily series. */
  mean: number;
  /** Sample stddev of the gap-filled daily series. */
  stddev: number;
  /** Global sample median. */
  median: number;
  /** Number of observations exactly equal to the median. */
  nAtMedian: number;
  /** First-half above-median count (cell a). */
  aFirstAbove: number;
  /** First-half not-above count (cell b). */
  bFirstNotAbove: number;
  /** Second-half above-median count (cell c). */
  cSecondAbove: number;
  /** Second-half not-above count (cell d). */
  dSecondNotAbove: number;
  /** First-half size h = floor(n/2). */
  nFirst: number;
  /** Second-half size n - h. */
  nSecond: number;
  /** Pearson chi-square 1-df statistic. */
  bmChi2: number;
  /** Signed Z form (sqrt of chi2 with first-half above-median sign). */
  bmZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|bmZ|)). */
  bmPValue: number;
}

export interface DailyTokenBrownMoodMedianTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBrownMoodMedianTrendSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedDegenerateSplit: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenBrownMoodMedianTrendSourceRow[];
}

/**
 * Linear-time selection of the SAMPLE MEDIAN. For
 * even-length inputs returns the average of the two
 * middle order statistics. Throws on empty input.
 */
export function brownMoodSampleMedian(values: number[]): number {
  const n = values.length;
  if (n === 0) {
    throw new Error('brownMoodSampleMedian: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Build the 2x2 contingency table (a, b, c, d) for the
 * Brown-Mood median trend test. h = floor(n/2) is the
 * first-half size; the second half has n - h elements.
 * Convention: x > median -> ABOVE; x <= median -> NOT
 * ABOVE (ties go to the not-above cell).
 */
export function brownMoodContingency(
  values: number[],
  median: number,
): { a: number; b: number; c: number; d: number; h: number; nAtMedian: number } {
  const n = values.length;
  if (n < 2) {
    throw new Error(
      `brownMoodContingency: need at least 2 values (got ${n})`,
    );
  }
  const h = Math.floor(n / 2);
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  let nAtMedian = 0;
  for (let i = 0; i < n; i += 1) {
    const v = values[i]!;
    if (v === median) nAtMedian += 1;
    const above = v > median;
    if (i < h) {
      if (above) a += 1;
      else b += 1;
    } else {
      if (above) c += 1;
      else d += 1;
    }
  }
  return { a, b, c, d, h, nAtMedian };
}

/**
 * Standard normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailBrownMoodMedianTrend(
  z: number,
): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailBrownMoodMedianTrend: z must be finite (got ${z})`,
    );
  }
  if (z < 0)
    return 1 - standardNormalUpperTailBrownMoodMedianTrend(-z);
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

export function dailyTokenBrownMoodMedianTrend(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  median: number;
  nAtMedian: number;
  aFirstAbove: number;
  bFirstNotAbove: number;
  cSecondAbove: number;
  dSecondNotAbove: number;
  nFirst: number;
  nSecond: number;
  bmChi2: number;
  bmZ: number;
  bmPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenBrownMoodMedianTrend: need at least 12 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenBrownMoodMedianTrend requires finite values',
      );
    }
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let ss = 0;
  for (const v of values) {
    const c = v - mu;
    ss += c * c;
  }
  if (ss === 0) {
    throw new Error(
      `dailyTokenBrownMoodMedianTrend: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const median = brownMoodSampleMedian(values);
  const { a, b, c, d, h, nAtMedian } = brownMoodContingency(values, median);
  const nFirst = h;
  const nSecond = n - h;
  const A = a + c;
  const B = b + d;
  if (A === 0 || B === 0) {
    // All values on one side of the median -> degenerate
    // 2x2 (zero column total). Test is undefined.
    throw new Error(
      `dailyTokenBrownMoodMedianTrend: degenerate split (A=${A}, B=${B}); chi-square undefined`,
    );
  }
  if (nFirst === 0 || nSecond === 0) {
    throw new Error(
      `dailyTokenBrownMoodMedianTrend: degenerate halves (nFirst=${nFirst}, nSecond=${nSecond})`,
    );
  }
  const bmChi2 =
    (n * Math.pow(a * d - b * c, 2)) /
    ((a + b) * (c + d) * (a + c) * (b + d));
  // Signed Z: positive when first-half above-median proportion exceeds
  // second-half above-median proportion.
  const p1 = a / nFirst;
  const p2 = c / nSecond;
  const pHat = A / n;
  const seSquared = pHat * (1 - pHat) * (1 / nFirst + 1 / nSecond);
  const bmZ = seSquared > 0 ? (p1 - p2) / Math.sqrt(seSquared) : 0;
  if (!Number.isFinite(bmChi2) || !Number.isFinite(bmZ)) {
    throw new Error(
      `dailyTokenBrownMoodMedianTrend: non-finite statistic (n=${n}, a=${a}, b=${b}, c=${c}, d=${d})`,
    );
  }
  const bmPValue =
    2 * standardNormalUpperTailBrownMoodMedianTrend(Math.abs(bmZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    median,
    nAtMedian,
    aFirstAbove: a,
    bFirstNotAbove: b,
    cSecondAbove: c,
    dSecondNotAbove: d,
    nFirst,
    nSecond,
    bmChi2,
    bmZ,
    bmPValue: Math.min(1, Math.max(0, bmPValue)),
  };
}

export interface BrownMoodMedianTrendCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanBmZ: number;
  tenureWeightedMeanBmZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED bmZ values via Stouffer's (1949) Z-method.
 * Skips rows with non-finite bmZ, malformed bmPValue,
 * or tenure below the floor.
 */
export function aggregateBrownMoodMedianTrend(
  rows: ReadonlyArray<{
    bmZ: number;
    bmPValue: number;
    nTenureDays: number;
  }>,
): BrownMoodMedianTrendCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.bmZ) ||
      !Number.isFinite(r.bmPValue) ||
      r.bmPValue < 0 ||
      r.bmPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.bmZ;
    weightedZSum += r.nTenureDays * r.bmZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanBmZ: Number.NaN,
      tenureWeightedMeanBmZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailBrownMoodMedianTrend(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanBmZ: zSum / used,
    tenureWeightedMeanBmZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
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

export function buildDailyTokenBrownMoodMedianTrend(
  queue: QueueLine[],
  opts: DailyTokenBrownMoodMedianTrendOptions = {},
): DailyTokenBrownMoodMedianTrendReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 12;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 12) {
    throw new Error(
      `minTenureDays must be an integer >= 12 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenBrownMoodMedianTrendSort =
    opts.sort ?? 'bmZAbsDesc';
  const validSorts: DailyTokenBrownMoodMedianTrendSort[] = [
    'bmZ',
    'bmZAbsDesc',
    'bmPValue',
    'bmPValueDesc',
    'bmChi2',
    'bmChi2Desc',
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
  let droppedDegenerateSplit = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenBrownMoodMedianTrendSourceRow[] = [];

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
      result = dailyTokenBrownMoodMedianTrend(filled);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('degenerate')) {
        droppedDegenerateSplit += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
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
      median: result.median,
      nAtMedian: result.nAtMedian,
      aFirstAbove: result.aFirstAbove,
      bFirstNotAbove: result.bFirstNotAbove,
      cSecondAbove: result.cSecondAbove,
      dSecondNotAbove: result.dSecondNotAbove,
      nFirst: result.nFirst,
      nSecond: result.nSecond,
      bmChi2: result.bmChi2,
      bmZ: result.bmZ,
      bmPValue: result.bmPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bmZ':
        primary = a.bmZ - b.bmZ;
        break;
      case 'bmZAbsDesc':
        primary = Math.abs(b.bmZ) - Math.abs(a.bmZ);
        break;
      case 'bmPValue':
        primary = a.bmPValue - b.bmPValue;
        break;
      case 'bmPValueDesc':
        primary = b.bmPValue - a.bmPValue;
        break;
      case 'bmChi2':
        primary = a.bmChi2 - b.bmChi2;
        break;
      case 'bmChi2Desc':
        primary = b.bmChi2 - a.bmChi2;
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
    droppedDegenerateSplit,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
