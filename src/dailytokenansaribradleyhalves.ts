/**
 * daily-token-ansari-bradley-halves: per-source
 * ANSARI-BRADLEY TWO-SAMPLE NONPARAMETRIC SCALE-SHIFT
 * (EQUALITY-OF-DISPERSION) TEST comparing the first half
 * vs second half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-SEVENTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Median-centre each half (Hollander, Wolfe & Chicken
 * 2014 sec. 5.4: removes a pure location shift before the
 * scale comparison). Pool the n = n1 + n2 centred values,
 * sort ascending (stable, ties broken by original index),
 * and assign ANSARI-BRADLEY FOLDED RANKS (Ansari &
 * Bradley 1960, Annals Math. Stat. 31(4):1174-1189):
 *
 *     for even n:
 *       sortedRank 1, 2, ...,  n/2,         n/2,         ..., 2, 1
 *     for odd n:
 *       sortedRank 1, 2, ..., (n-1)/2, (n+1)/2, (n-1)/2, ..., 2, 1
 *
 * That is, the smallest AND the largest pooled value both
 * receive rank 1, the second-smallest and second-largest
 * both receive rank 2, etc., folding inward to the median.
 * Values close to the pooled MEDIAN receive HIGH ranks;
 * values at the pooled EXTREMES receive LOW ranks. (The
 * mirror image of monotonic ranking, and a DIFFERENT
 * weighting from Siegel-Tukey's outward-pair scheme:
 * Ansari-Bradley is SYMMETRIC about the median in a
 * single pass, while Siegel-Tukey alternates lo/hi pairs
 * one at a time. The two rank vectors are NOT a monotone
 * transform of each other.)
 *
 * Let abWA = sum of Ansari-Bradley ranks assigned to the
 * elements that originally came from half A. Under H0
 * (equal scale -- both halves drawn from the same
 * distribution up to a common location shift, which the
 * median-centring removes), abWA is exchangeable across
 * halves and has the EXACT first two moments
 *
 *     even n:
 *       E[abWA]   = n1 (n + 2) / 4
 *       Var[abWA] = n1 n2 (n + 2) (n - 2) / (48 (n - 1))
 *
 *     odd n:
 *       E[abWA]   = n1 (n + 1)^2 / (4 n)
 *       Var[abWA] = n1 n2 (n + 1) (n^2 + 3) / (48 n^2)
 *
 * (Ansari & Bradley 1960 Theorem 2.1; Hollander, Wolfe &
 * Chicken 2014 eq. 5.16.) The asymptotic-normal
 * standardisation
 *
 *     abZ = (abWA - E[abWA]) / sqrt(Var[abWA])
 *
 * is approximately N(0, 1) under H0 for moderate n.
 *
 * SIGN CONVENTION. The raw rank-sum interpretation: a
 * half whose values cluster NEAR THE POOLED MEDIAN
 * collects LARGE folded ranks, so a half that is MORE
 * CONCENTRATED (smaller scale) inflates abWA. Consistent
 * with the axis-117 stZ convention (positive = second
 * half more dispersed), we report abZ as the SAME sign
 * as the raw (abWA - E)/sqrt(Var): positive abZ means
 * half A is concentrated near the median, i.e. half B is
 * MORE DISPERSED. So
 *
 *     abZ much greater than +1.96  ->  the FIRST half is
 *       concentrated; SECOND HALF MORE DISPERSED;
 *       DISPERSION GREW over the tenure.
 *     abZ much less than -1.96     ->  the FIRST half is
 *       at the extremes; FIRST HALF MORE DISPERSED;
 *       DISPERSION SHRANK over the tenure.
 *     abZ approx 0                  ->  no detectable
 *       scale shift between the two halves.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves. Both
 *     are TWO-SAMPLE rank-based scale-shift tests on the
 *     SAME first/second-half partition with the SAME
 *     median-centring prophylaxis. They differ in the
 *     RANK ASSIGNMENT SCHEME: Siegel-Tukey assigns
 *     OUTWARD-PAIR ranks (1, 2-3, 4-5, 6-7, ...
 *     alternating lo/hi pairs); Ansari-Bradley assigns
 *     SYMMETRIC FOLDED ranks (1, 2, ..., n/2, n/2, ..., 2, 1
 *     in a single fold). The rank VECTORS are NOT a
 *     monotone transform of each other -- Siegel-Tukey
 *     gives the smallest pooled value rank 1 and the
 *     largest pooled value rank 2; Ansari-Bradley gives
 *     BOTH extremes the SAME rank 1. As a consequence
 *     the two statistics have DIFFERENT exact null
 *     distributions (different mean/variance formulas)
 *     and disagree on a finite-sample basis -- a series
 *     where the second half has equal mass at both
 *     pooled extremes registers a small siegel-tukey
 *     stU (the lo and hi extreme values cancel) but a
 *     LARGE Ansari-Bradley deviation (both extremes
 *     attract the SAME small rank 1, depressing abWA
 *     for whichever half holds them).
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Brown-Forsythe is a PARAMETRIC F-statistic on
 *     median-centred ABSOLUTE DEVIATIONS; Ansari-Bradley
 *     is a NONPARAMETRIC RANK-SUM. Same orthogonality
 *     class as Siegel-Tukey vs BF: rank-invariant scale
 *     test vs magnitude-based parametric scale test.
 *     Differs from BF on heavy-tailed contamination.
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney halves uses MONOTONIC ranks (the
 *     smallest pooled value gets rank 1 and the rank
 *     INCREASES monotonically) and is sensitive to
 *     LOCATION shift. Ansari-Bradley uses FOLDED ranks
 *     (the smallest and the largest pooled values both
 *     get rank 1 and the rank INCREASES toward the
 *     median) and is sensitive to SCALE shift. The
 *     median-centring removes any location component
 *     before the rank assignment.
 *
 *   - vs all CDF-distance halves axes (axes-118.. KS,
 *     CvM, AD, Hellinger, Bhattacharyya, JS, KL, MMD,
 *     PCA, energy, Wasserstein, Cramer-vM, Clark,
 *     Kumar-Johnson, Renyi-2, Jeffreys, max, total-
 *     variation, triangular, Tarneja, neyman-chi-sq,
 *     symmetric-chi-sq, topsoe). Those compare the
 *     EMPIRICAL DISTRIBUTIONS of the two halves
 *     directly -- ANY difference in shape (location,
 *     scale, skewness, kurtosis, modality) registers.
 *     Ansari-Bradley targets ONLY the SCALE component
 *     after median-centring. A pure-location-shift
 *     example: A = [0,0,0,0,0,0,0,0], B = [5,5,5,5,5,5,5,5]
 *     gives KS halves the maximum statistic but
 *     Ansari-Bradley exactly null (after centring).
 *
 *   - vs axis-114 daily-token-ljung-box-q-test. Ljung-Box
 *     is a MULTI-LAG SQUARED-AUTOCORRELATION
 *     PORTMANTEAU on the centred raw series with a
 *     Chi-Square(H) null. Ansari-Bradley is a TWO-
 *     SAMPLE RANK-SUM on folded ranks of two contiguous
 *     halves with a Normal null. Sample space differs;
 *     functional differs; null differs; detection
 *     target differs.
 *
 *   - vs the trend axes (axis-110 Mann-Kendall,
 *     axis-111 Cox-Stuart, axis-113 difference-sign).
 *     All target a MONOTONIC LOCATION trend across
 *     the whole series. Ansari-Bradley is invariant to
 *     a monotonic location shift between halves (the
 *     median-centring removes it) and targets SCALE.
 *
 *   - vs the cumulative-periodogram axes (167-169).
 *     Those are FREQUENCY-DOMAIN goodness-of-fit
 *     against white noise on the WHOLE series.
 *     Ansari-Bradley is TIME-DOMAIN, two-sample,
 *     rank-based on a fixed first/second-half split.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals of
 *     the empirical distribution. Ansari-Bradley
 *     depends on temporal ORDER -- specifically, on
 *     which values fall in the first half vs the
 *     second half.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), median-centre each half, pool them,
 *   sort the pool, assign Ansari-Bradley folded ranks
 *   (1, 2, ..., n/2, n/2, ..., 2, 1), sum the ranks that
 *   originally came from the first half, and normal-
 *   standardise via the exact Ansari-Bradley mean and
 *   variance, does the resulting |abZ| exceed 1.96?"**
 *
 * Reference:
 *   Ansari, A. R. and Bradley, R. A., "Rank-Sum Tests
 *     for Dispersions", Annals of Mathematical
 *     Statistics 31(4) (1960), pp. 1174-1189.
 *   Hollander, M., Wolfe, D. A. and Chicken, E.,
 *     "Nonparametric Statistical Methods", 3rd ed.,
 *     Wiley, 2014, sec. 5.4 eq. 5.16.
 *
 * Caveats:
 *
 *   - abZ uses the asymptotic-normal approximation of
 *     the EXACT Ansari-Bradley null. For small n
 *     (n <= 10) the exact distribution is mildly skew
 *     and the normal-approximation tails are slightly
 *     conservative. We require n >= 8 (n1*n2 >= 16,
 *     Var[abWA] well above the small-sample regime).
 *   - Tied centred values are broken by ORIGINAL INDEX
 *     (stable sort) so the rank assignment is
 *     deterministic. The normal approximation ignores
 *     tie-correction; for the heavy-tailed gap-filled
 *     token series with many exact zeros after median-
 *     centring, this is conservative.
 *   - All-equal series filtered upstream by zero-
 *     variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-ansari-bradley-halves
 *
 *   pew-insights daily-token-ansari-bradley-halves \
 *     --json --min-tenure-days 14 --sort abZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenAnsariBradleyHalvesSort =
  | 'abWA'
  | 'abWADesc'
  | 'abZ'
  | 'abZDesc'
  | 'abZAbs'
  | 'abZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAnsariBradleyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * Var[abWA] is well within the normal-approximation
   * regime (n1*n2 >= 16).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAnsariBradleyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenAnsariBradleyHalvesSourceRow {
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
  abN1: number;
  /** Second-half size n2 = n - n1. */
  abN2: number;
  /** Median of the first half (used for centring). */
  abMedianA: number;
  /** Median of the second half (used for centring). */
  abMedianB: number;
  /** Sum of Ansari-Bradley folded ranks assigned to first-half elements. */
  abWA: number;
  /** Exact null mean of abWA (per Ansari-Bradley 1960 Thm 2.1). */
  abMean: number;
  /** Exact null variance of abWA. */
  abVar: number;
  /** Normal-approx z-equivalent (positive = second half more dispersed). */
  abZ: number;
}

export interface DailyTokenAnsariBradleyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAnsariBradleyHalvesSort;
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
  sources: DailyTokenAnsariBradleyHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Assign Ansari-Bradley folded ranks to a pool of size n.
 *
 *   even n: 1, 2, ..., n/2, n/2, ..., 2, 1
 *   odd  n: 1, 2, ..., (n-1)/2, (n+1)/2, (n-1)/2, ..., 2, 1
 *
 * The element at sorted position i (0-indexed) gets rank
 *   r(i) = min(i + 1, n - i).
 *
 * Closed-form sanity check: sum_{i=0..n-1} r(i)
 *   even n: 2 * (1 + 2 + ... + n/2) = (n/2) * (n/2 + 1) = n(n+2)/4
 *   odd  n: 2 * (1 + 2 + ... + (n-1)/2) + (n+1)/2
 *           = ((n-1)/2)*((n+1)/2) + (n+1)/2 = (n+1)^2/4
 *
 * The first-half rank-sum's null mean is therefore
 *   even n: (n1/n) * n(n+2)/4 = n1(n+2)/4
 *   odd  n: (n1/n) * (n+1)^2/4 = n1(n+1)^2/(4n)
 *
 * matching Ansari & Bradley 1960 Thm 2.1.
 */
export function ansariBradleyRanksFor(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(
      `ansariBradleyRanksFor: n must be an integer >= 2 (got ${n})`,
    );
  }
  const ranks: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = i + 1;
    const b = n - i;
    ranks[i] = a < b ? a : b;
  }
  return ranks;
}

/**
 * Exact Ansari-Bradley null moments (Ansari & Bradley
 * 1960 Theorem 2.1; Hollander, Wolfe & Chicken 2014 eq.
 * 5.16).
 *
 * Returns { mean, variance } of W_A under H0 (equal-
 * distribution exchangeability of the two halves).
 *
 * Throws on n1 < 1, n2 < 1, or non-finite output.
 */
export function ansariBradleyNullMoments(
  n1: number,
  n2: number,
): { mean: number; variance: number } {
  if (!Number.isInteger(n1) || n1 < 1) {
    throw new Error(`ansariBradleyNullMoments: n1 must be an integer >= 1 (got ${n1})`);
  }
  if (!Number.isInteger(n2) || n2 < 1) {
    throw new Error(`ansariBradleyNullMoments: n2 must be an integer >= 1 (got ${n2})`);
  }
  const n = n1 + n2;
  let mean: number;
  let variance: number;
  if (n % 2 === 0) {
    mean = (n1 * (n + 2)) / 4;
    variance = (n1 * n2 * (n + 2) * (n - 2)) / (48 * (n - 1));
  } else {
    mean = (n1 * (n + 1) * (n + 1)) / (4 * n);
    variance = (n1 * n2 * (n + 1) * (n * n + 3)) / (48 * n * n);
  }
  if (!Number.isFinite(mean) || !Number.isFinite(variance) || variance <= 0) {
    throw new Error(
      `ansariBradleyNullMoments: degenerate moments (n1=${n1}, n2=${n2}, mean=${mean}, var=${variance})`,
    );
  }
  return { mean, variance };
}

/**
 * Ansari-Bradley two-sample equality-of-scale test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series.
 *
 * Each half is median-centred (Hollander, Wolfe &
 * Chicken 2014 sec. 5.4) so that a pure location shift
 * is removed before the rank assignment. Then the pool
 * is sorted ascending (stable, ties broken by original
 * index) and Ansari-Bradley FOLDED ranks are assigned.
 * The first-half rank-sum is normal-standardised against
 * the EXACT Ansari-Bradley 1960 mean/variance.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - abZ(x + c) === abZ(x) for any constant c.
 *   - abZ(a * x) === abZ(x) for any a > 0.
 *   - abZ(-x) === abZ(x): negation of the whole series
 *     reverses the pooled sort order, but the folded
 *     rank vector is SYMMETRIC about its centre, so the
 *     rank assigned to each ORIGINAL element is the
 *     same; abZ unchanged.
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 *   - abMean and abVar match the Ansari-Bradley 1960
 *     closed-form moments exactly (covered by the test
 *     suite for n in 8..30).
 */
export function dailyTokenAnsariBradleyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  abN1: number;
  abN2: number;
  abMedianA: number;
  abMedianB: number;
  abWA: number;
  abMean: number;
  abVar: number;
  abZ: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenAnsariBradleyHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenAnsariBradleyHalves requires finite values',
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
      `dailyTokenAnsariBradleyHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const abMedianA = medianSorted(aSorted);
  const abMedianB = medianSorted(bSorted);

  // Median-centre each half (Hollander/Wolfe/Chicken
  // 2014 sec. 5.4) so pure location shift is removed
  // before pooling.
  interface PoolElem {
    centred: number;
    origIdx: number;
    fromFirstHalf: boolean;
  }
  const pool: PoolElem[] = new Array(n);
  for (let i = 0; i < n1; i += 1) {
    pool[i] = {
      centred: values[i]! - abMedianA,
      origIdx: i,
      fromFirstHalf: true,
    };
  }
  for (let i = 0; i < n2; i += 1) {
    pool[n1 + i] = {
      centred: values[n1 + i]! - abMedianB,
      origIdx: n1 + i,
      fromFirstHalf: false,
    };
  }

  // Stable sort ascending by centred value, ties broken
  // by original index for deterministic rank assignment.
  pool.sort((p, q) => {
    if (p.centred !== q.centred) return p.centred - q.centred;
    return p.origIdx - q.origIdx;
  });

  const ranks = ansariBradleyRanksFor(n);

  // Sum Ansari-Bradley folded ranks assigned to first-
  // half elements.
  let abWA = 0;
  for (let i = 0; i < n; i += 1) {
    if (pool[i]!.fromFirstHalf) {
      abWA += ranks[i]!;
    }
  }

  const { mean: abMean, variance: abVar } = ansariBradleyNullMoments(
    n1,
    n2,
  );

  // Sign convention: positive abZ = first half collects
  // more central (high-folded-rank) mass = first half
  // more concentrated = second half MORE DISPERSED.
  // Matches axis-117 stZ convention.
  const abZ = (abWA - abMean) / Math.sqrt(abVar);

  if (!Number.isFinite(abWA) || !Number.isFinite(abZ)) {
    throw new Error(
      `dailyTokenAnsariBradleyHalves: non-finite abWA or abZ (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    abN1: n1,
    abN2: n2,
    abMedianA,
    abMedianB,
    abWA,
    abMean,
    abVar,
    abZ,
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

export function buildDailyTokenAnsariBradleyHalves(
  queue: QueueLine[],
  opts: DailyTokenAnsariBradleyHalvesOptions = {},
): DailyTokenAnsariBradleyHalvesReport {
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
  const sort: DailyTokenAnsariBradleyHalvesSort = opts.sort ?? 'abZAbsDesc';
  const validSorts: DailyTokenAnsariBradleyHalvesSort[] = [
    'abWA',
    'abWADesc',
    'abZ',
    'abZDesc',
    'abZAbs',
    'abZAbsDesc',
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
  const rows: DailyTokenAnsariBradleyHalvesSourceRow[] = [];

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
      result = dailyTokenAnsariBradleyHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenAnsariBradleyHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      abN1: result.abN1,
      abN2: result.abN2,
      abMedianA: result.abMedianA,
      abMedianB: result.abMedianB,
      abWA: result.abWA,
      abMean: result.abMean,
      abVar: result.abVar,
      abZ: result.abZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'abWA':
        primary = a.abWA - b.abWA;
        break;
      case 'abWADesc':
        primary = b.abWA - a.abWA;
        break;
      case 'abZ':
        primary = a.abZ - b.abZ;
        break;
      case 'abZDesc':
        primary = b.abZ - a.abZ;
        break;
      case 'abZAbs':
        primary = Math.abs(a.abZ) - Math.abs(b.abZ);
        break;
      case 'abZAbsDesc':
        primary = Math.abs(b.abZ) - Math.abs(a.abZ);
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
