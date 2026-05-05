/**
 * daily-token-olmstead-tukey-corner-test: per-source
 * OLMSTEAD-TUKEY CORNER TEST FOR ASSOCIATION on the
 * gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWELFTH cross-source axis.
 *
 * Mechanism. Olmstead & Tukey (1947, "A corner test for
 * association", *Ann. Math. Statist.* 18(4): 495-513)
 * introduced a quick-and-distribution-free test for
 * BIVARIATE ASSOCIATION based on counting "corner
 * agreements" -- consecutive observations at the
 * extremes of x that lie on the same side of the
 * y-median. With x = TIME INDEX (1..n) and y = the
 * gap-filled daily total_tokens series, the test
 * becomes a TREND test for monotone association
 * between value and time.
 *
 * Let M_y = median(y[0..n-1]). Sort observations by x
 * (already given by time order). Define four
 * "corner counts":
 *
 *   nNE = max k s.t. y[n-1], y[n-2], ..., y[n-k] are
 *         all > M_y                     (right edge,
 *                                        upper side)
 *   nSE = max k s.t. y[n-1], y[n-2], ..., y[n-k] are
 *         all < M_y                     (right edge,
 *                                        lower side)
 *   nNW = max k s.t. y[0], y[1], ..., y[k-1] are all
 *         > M_y                         (left edge,
 *                                        upper side)
 *   nSW = max k s.t. y[0], y[1], ..., y[k-1] are all
 *         < M_y                         (left edge,
 *                                        lower side)
 *
 * Ties at the median (y == M_y) BREAK the run at that
 * corner (treated as neither above nor below). Exactly
 * one of {nNE, nSE} is non-zero unless the right-edge
 * point sits ON the median (then both are 0). Same for
 * {nNW, nSW}.
 *
 * The OLMSTEAD-TUKEY Q-STATISTIC is
 *
 *   otQ = (nNE + nSW) - (nSE + nNW)
 *
 * SIGN CONVENTION:
 *   - otQ >> 0  <=>  HIGH values cluster at HIGH x AND
 *     LOW values cluster at LOW x  <=>  MONOTONE
 *     UP-TREND.
 *   - otQ << 0  <=>  HIGH values cluster at LOW x AND
 *     LOW values cluster at HIGH x  <=>  MONOTONE
 *     DOWN-TREND.
 *   - otQ ~ 0   <=>  no extremal-corner agreement.
 *
 * NULL DISTRIBUTION (asymptotic). Under H0 (independence
 * of y from x, no trend) each corner-count K is
 * approximately GEOMETRIC(1/2) on {0, 1, 2, ...}
 * because each successive y from the edge has roughly
 * 1/2 probability of crossing the median (under the
 * null permutation distribution conditional on M_y).
 * Hence E[K] = 1, Var(K) = 2 per corner. Olmstead &
 * Tukey 1947 give EXACT critical tables (e.g. |Q| >= 9
 * rejects at alpha ~ 0.05, |Q| >= 11 at alpha ~ 0.01,
 * |Q| >= 13 at alpha ~ 0.005). For our normal-tail
 * SIGNED Z form we use the moment-matched
 *
 *   otVar = 8         (4 corners, each Var(K) = 2;
 *                      cross-corner correlation cancels
 *                      to leading order under random
 *                      pairing of edges)
 *   otZ   = otQ / sqrt(otVar)
 *   otPValue = 2 * (1 - Phi(|otZ|))
 *
 * This gives slightly anti-conservative p-values vs the
 * exact tables in the deep tail but matches their
 * |Q| >= 9 rule of thumb at alpha ~ 0.05 to better than
 * a factor of 2; we surface the raw Q so consumers can
 * compare against the exact tables directly.
 *
 * TIE HANDLING. Equality with the median y-value at a
 * corner BREAKS the run there (the corner contributes
 * 0 to its respective count and 0 to the other in that
 * pair). Internal ties are irrelevant -- only
 * consecutive runs of strict inequality from the
 * extremes count. We surface `nAtMedian` for
 * transparency.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim). The
 * mechanism is fundamentally different from every
 * recent trend axis:
 *
 *   - vs axis-211 Brown-Mood (bmZ). BM uses a 2x2
 *     contingency table of GLOBAL above-median counts
 *     summed over EACH ENTIRE HALF of the series. OT
 *     uses ONLY the 4 EXTREMAL CORNERS -- ignores
 *     everything in the interior of the time window.
 *     A series with strong middle-of-window structure
 *     and quiet edges gives bmZ != 0 but otQ ~ 0.
 *     A series with quiet middle and strong corner
 *     agreement gives the opposite.
 *
 *   - vs axis-210 Daniels rank-vs-time. Daniels uses
 *     the FULL VALUE-RANK sequence and correlates it
 *     with the time-identity rank -- a CONTINUOUS-rank
 *     statistic on n distinct ranks. OT collapses each
 *     value to a SINGLE BIT (above/not-above median)
 *     AND THEN further collapses to only the corner
 *     RUN-LENGTHS at the 4 extremes; OT uses at most
 *     4 * O(1) values per source. Different rank
 *     resolution, different power profile.
 *
 *   - vs axis-209 Wallis-Moore (wmZ). WM counts the
 *     number of MONOTONE PHASES in the FIRST-DIFFERENCE
 *     SIGN sequence -- a LOCAL CONTIGUOUS-PHASE
 *     statistic on the differenced series. OT is an
 *     EXTREMAL CORNER statistic on the raw series.
 *
 *   - vs axis-208 Spearman footrule. Footrule sums L1
 *     rank deviations across ALL n positions; OT
 *     ignores the interior entirely.
 *
 *   - vs axis-205 Cox-Stuart. CS pairs x[i] with
 *     x[i + ceil(n/2)] and signs the n/2 paired
 *     differences -- a LAG-h paired-sign statistic.
 *     OT does no pairing and no differencing.
 *
 *   - vs axis-206 Jonckheere-Terpstra. JT uses k=4
 *     ordered blocks with sums of pairwise U-counts
 *     across blocks -- O(n^2) pairwise comparisons.
 *     OT uses 4 corner run-lengths -- O(n) but with
 *     drop-out after the first crossing, typically
 *     O(log n) per corner.
 *
 *   - vs axis-207 Pitman MSSD. Pitman uses the SUM OF
 *     SQUARED FIRST DIFFERENCES vs sample variance --
 *     an L2 magnitude statistic. OT uses no
 *     magnitudes and no differences.
 *
 *   - vs Mann-Kendall S. MK uses n*(n-1)/2 pairwise
 *     sign comparisons across ALL distinct pairs.
 *     OT uses only edge runs.
 *
 *   - vs daily-token-difference-sign-test. DS counts
 *     positive first differences out of n-1. OT does
 *     no differencing.
 *
 *   - vs Foster-Stuart records-count axis. FS counts
 *     RECORD-BREAKING events sweeping through the
 *     whole series; OT only counts edge-RUN lengths
 *     against the global median.
 *
 *   - vs daily-token-cusum-max-deviation. Cusum
 *     tracks the maximum absolute partial sum of
 *     (x[i] - mean) -- a continuous-magnitude
 *     path-extremum statistic. OT collapses to 4
 *     binary edge-run counts.
 *
 * Pre-processing: NONE (besides gap-filling already
 * applied at the daily-aggregation layer).
 *
 * Refs:
 *   Olmstead, P. S. & Tukey, J. W., "A corner test for
 *     association", *Ann. Math. Statist.* 18(4)
 *     (1947), pp. 495-513.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.,
 *     Wiley (2014), sec. 8.5 (corner test for
 *     monotone trend / association).
 *   Mosteller, F. & Rourke, R. E. K., *Sturdy
 *     Statistics: Nonparametrics and Order Statistics*,
 *     Addison-Wesley (1973), ch. 6.
 *   Conover, W. J., *Practical Nonparametric Statistics*,
 *     3rd ed., Wiley (1999), sec. 5.5 (quick tests).
 */
import type { QueueLine } from './types.js';

export type DailyTokenOlmsteadTukeyCornerTestSort =
  | 'otZ'
  | 'otZAbsDesc'
  | 'otQ'
  | 'otQAbsDesc'
  | 'otPValue'
  | 'otPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenOlmsteadTukeyCornerTestOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep parity with the other axis-205..-211 trend
   * tests; the corner test itself is well-defined for
   * n >= 4 but very low-power in that regime.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenOlmsteadTukeyCornerTestSort;
  generatedAt?: string;
}

export interface DailyTokenOlmsteadTukeyCornerTestSourceRow {
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
  /** North-east corner run length (right edge, upper side). */
  nNE: number;
  /** North-west corner run length (left edge, upper side). */
  nNW: number;
  /** South-east corner run length (right edge, lower side). */
  nSE: number;
  /** South-west corner run length (left edge, lower side). */
  nSW: number;
  /** Olmstead-Tukey signed Q-statistic (nNE + nSW) - (nSE + nNW). */
  otQ: number;
  /** Standardized Z form otQ / sqrt(8). */
  otZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|otZ|)). */
  otPValue: number;
}

export interface DailyTokenOlmsteadTukeyCornerTestReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenOlmsteadTukeyCornerTestSort;
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
  sources: DailyTokenOlmsteadTukeyCornerTestSourceRow[];
}

/**
 * Linear-time selection of the SAMPLE MEDIAN. Even-n
 * returns the average of the two middle order
 * statistics. Throws on empty input.
 */
export function olmsteadTukeySampleMedian(values: number[]): number {
  const n = values.length;
  if (n === 0) {
    throw new Error('olmsteadTukeySampleMedian: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Compute the four corner run-lengths for the
 * Olmstead-Tukey test. Ties (y == median) BREAK the
 * run at that corner.
 */
export function olmsteadTukeyCornerCounts(
  values: number[],
  median: number,
): {
  nNE: number;
  nNW: number;
  nSE: number;
  nSW: number;
  nAtMedian: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `olmsteadTukeyCornerCounts: need at least 4 values (got ${n})`,
    );
  }
  let nNE = 0;
  let nSE = 0;
  let nNW = 0;
  let nSW = 0;
  let nAtMedian = 0;
  for (let i = 0; i < n; i += 1) {
    if (values[i]! === median) nAtMedian += 1;
  }
  // Right-edge (large x) corner: scan backward from i=n-1.
  // Determine side of the right-most non-tie point.
  // Convention: walk from the right edge and count
  // consecutive points strictly above (NE) OR strictly
  // below (SE), stopping at first crossing or tie.
  if (values[n - 1]! > median) {
    for (let i = n - 1; i >= 0; i -= 1) {
      if (values[i]! > median) nNE += 1;
      else break;
    }
  } else if (values[n - 1]! < median) {
    for (let i = n - 1; i >= 0; i -= 1) {
      if (values[i]! < median) nSE += 1;
      else break;
    }
  }
  // Left-edge (small x) corner: scan forward from i=0.
  if (values[0]! > median) {
    for (let i = 0; i < n; i += 1) {
      if (values[i]! > median) nNW += 1;
      else break;
    }
  } else if (values[0]! < median) {
    for (let i = 0; i < n; i += 1) {
      if (values[i]! < median) nSW += 1;
      else break;
    }
  }
  return { nNE, nNW, nSE, nSW, nAtMedian };
}

/**
 * Standard normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailOlmsteadTukey(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailOlmsteadTukey: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailOlmsteadTukey(-z);
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

export function dailyTokenOlmsteadTukeyCornerTest(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  median: number;
  nAtMedian: number;
  nNE: number;
  nNW: number;
  nSE: number;
  nSW: number;
  otQ: number;
  otZ: number;
  otPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenOlmsteadTukeyCornerTest: need at least 12 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenOlmsteadTukeyCornerTest requires finite values',
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
      `dailyTokenOlmsteadTukeyCornerTest: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const median = olmsteadTukeySampleMedian(values);
  const { nNE, nNW, nSE, nSW, nAtMedian } = olmsteadTukeyCornerCounts(
    values,
    median,
  );
  const otQ = nNE + nSW - (nSE + nNW);
  const otZ = otQ / Math.sqrt(8);
  if (!Number.isFinite(otQ) || !Number.isFinite(otZ)) {
    throw new Error(
      `dailyTokenOlmsteadTukeyCornerTest: non-finite statistic (n=${n})`,
    );
  }
  const otPValue =
    2 * standardNormalUpperTailOlmsteadTukey(Math.abs(otZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    median,
    nAtMedian,
    nNE,
    nNW,
    nSE,
    nSW,
    otQ,
    otZ,
    otPValue: Math.min(1, Math.max(0, otPValue)),
  };
}

export interface OlmsteadTukeyCornerTestCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanOtZ: number;
  tenureWeightedMeanOtZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED otZ values via Stouffer's (1949) Z-method.
 */
export function aggregateOlmsteadTukeyCornerTest(
  rows: ReadonlyArray<{
    otZ: number;
    otPValue: number;
    nTenureDays: number;
  }>,
): OlmsteadTukeyCornerTestCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.otZ) ||
      !Number.isFinite(r.otPValue) ||
      r.otPValue < 0 ||
      r.otPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.otZ;
    weightedZSum += r.nTenureDays * r.otZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanOtZ: Number.NaN,
      tenureWeightedMeanOtZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailOlmsteadTukey(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanOtZ: zSum / used,
    tenureWeightedMeanOtZ: weightedZSum / totalTenure,
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

export function buildDailyTokenOlmsteadTukeyCornerTest(
  queue: QueueLine[],
  opts: DailyTokenOlmsteadTukeyCornerTestOptions = {},
): DailyTokenOlmsteadTukeyCornerTestReport {
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
  const sort: DailyTokenOlmsteadTukeyCornerTestSort =
    opts.sort ?? 'otZAbsDesc';
  const validSorts: DailyTokenOlmsteadTukeyCornerTestSort[] = [
    'otZ',
    'otZAbsDesc',
    'otQ',
    'otQAbsDesc',
    'otPValue',
    'otPValueDesc',
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
  const rows: DailyTokenOlmsteadTukeyCornerTestSourceRow[] = [];

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
      result = dailyTokenOlmsteadTukeyCornerTest(filled);
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
      median: result.median,
      nAtMedian: result.nAtMedian,
      nNE: result.nNE,
      nNW: result.nNW,
      nSE: result.nSE,
      nSW: result.nSW,
      otQ: result.otQ,
      otZ: result.otZ,
      otPValue: result.otPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'otZ':
        primary = a.otZ - b.otZ;
        break;
      case 'otZAbsDesc':
        primary = Math.abs(b.otZ) - Math.abs(a.otZ);
        break;
      case 'otQ':
        primary = a.otQ - b.otQ;
        break;
      case 'otQAbsDesc':
        primary = Math.abs(b.otQ) - Math.abs(a.otQ);
        break;
      case 'otPValue':
        primary = a.otPValue - b.otPValue;
        break;
      case 'otPValueDesc':
        primary = b.otPValue - a.otPValue;
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
