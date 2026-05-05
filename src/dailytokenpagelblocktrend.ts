/**
 * daily-token-page-l-block-trend: per-source PAGE'S L
 * TEST FOR ORDERED ALTERNATIVES on consecutive
 * time-block within-rank scores, applied to the
 * gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-THIRTEENTH cross-source axis.
 *
 * Mechanism. Page (1963, "Ordered hypotheses for
 * multiple treatments: a significance test for linear
 * ranks", *J. Amer. Statist. Assoc.* 58(301): 216-230)
 * introduced a rank test for the alternative
 *   H1: theta_1 <= theta_2 <= ... <= theta_T
 * with at least one strict inequality, against
 *   H0: theta_1 = theta_2 = ... = theta_T
 * for k=T treatments observed in b independent BLOCKS.
 *
 * We adapt it as a TREND test on the daily-tokens series
 * by treating CONSECUTIVE TIME-WINDOW BLOCKS of size T=3
 * as the b "blocks", with the THREE WITHIN-BLOCK TIME
 * SLOTS (early/mid/late inside each 3-day window)
 * playing the role of the T=3 treatments in a
 * predicted-ordinal sequence. Specifically:
 *
 *   1. Drop the last (n mod 3) days of the gap-filled
 *      daily series to obtain b = floor(n / 3) complete
 *      contiguous 3-day blocks.
 *   2. Within each block, RANK the 3 daily values from
 *      1 (smallest) to 3 (largest); ties resolved by
 *      MIDRANK.
 *   3. Form Page's L statistic with predicted ordinal
 *      scores j = 1, 2, 3 for early/mid/late slots:
 *
 *        L = sum over blocks b of (1*R_{b,1} + 2*R_{b,2}
 *                                  + 3*R_{b,3})
 *
 *      L is large when within-block ranks INCREASE from
 *      slot 1 to slot 3 across many blocks (up-trend);
 *      L is small when ranks DECREASE (down-trend).
 *
 *   4. Standardize via Page's exact moments (Page 1963,
 *      eq. 2.5):
 *
 *        E[L]   = b * T * (T+1)^2 / 4
 *        Var[L] = b * T^2 * (T-1) * (T+1)^2 / 144
 *        pageZ  = (L - E[L]) / sqrt(Var[L])
 *        pagePValue = 2 * (1 - Phi(|pageZ|))
 *
 *      For T=3 these reduce to E[L] = 12 b, Var[L] = 2 b,
 *      so pageZ = (L - 12 b) / sqrt(2 b). The asymptotic
 *      normal approximation is good for b >= 4 (Page
 *      1963 sec. 4); we require b >= 4 (so n >= 12,
 *      consistent with our axis-205..-212 trend
 *      trilogy).
 *
 * SIGN CONVENTION:
 *   - pageZ >> 0  <=>  within-block ranks
 *     SYSTEMATICALLY INCREASE early -> mid -> late
 *     across 3-day windows  <=>  MONOTONE UP-TREND on
 *     the LOCAL 3-day timescale.
 *   - pageZ << 0  <=>  within-block ranks
 *     SYSTEMATICALLY DECREASE early -> mid -> late
 *     <=>  MONOTONE DOWN-TREND on the LOCAL 3-day scale.
 *   - pageZ ~ 0   <=>  no consistent within-block
 *     ordering.
 *
 * TIE HANDLING. Within each block, ties are resolved by
 * MIDRANK (average of tied positions). Page's exact
 * variance formula above assumes no ties; in the
 * presence of ties the variance is mildly OVERSTATED
 * (Z is mildly conservative). Tie counts surfaced via
 * `nTiedBlocks` (blocks with at least one within-block
 * tie).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim). The
 * mechanism is fundamentally distinct from every
 * existing trend / association axis on the daily-tokens
 * series:
 *
 *   - vs axis-212 Olmstead-Tukey (otQ). OT is an
 *     EXTREMAL EDGE-RUN statistic that ignores the
 *     interior of the time window; Page's L scans the
 *     ENTIRE interior in 3-day chunks and uses every
 *     observation. A series that is flat at the edges
 *     but drifts upward smoothly through the middle
 *     gives otQ ~ 0 but pageZ >> 0; a series with
 *     sharp edge corners and a noisy interior gives
 *     the opposite.
 *
 *   - vs axis-211 Brown-Mood (bmZ). BM thresholds the
 *     ENTIRE series at the global median and counts
 *     above-median observations in each whole half;
 *     Page operates on WITHIN-BLOCK RANKS at a 3-day
 *     scale and never compares across blocks. A
 *     two-tier series (low first half, high second
 *     half) gives bmZ very large but pageZ ~ 0 (no
 *     within-block ordering); a smoothly-rising series
 *     gives both nonzero but for different reasons.
 *
 *   - vs axis-210 Daniels rank-vs-time. Daniels uses
 *     n GLOBAL ranks correlated with the n time
 *     identity ranks -- a single O(n^2) statistic on
 *     the full rank vector. Page uses b * T = n LOCAL
 *     within-block ranks scored against a fixed
 *     predicted ordinal pattern. Page is BLIND to the
 *     across-block trend: a series that increases by 1
 *     unit per day for n days has perfect Daniels
 *     correlation but Page's L sees only that within
 *     each 3-day block ranks are 1, 2, 3 -- which
 *     gives pageZ at its maximum value but DERIVED FROM
 *     LOCAL ORDER, not global order.
 *
 *   - vs axis-209 Wallis-Moore phase-frequency. WM
 *     counts the NUMBER of monotone phases in the
 *     first-difference sign sequence; Page counts the
 *     within-block predicted-ordinal score and never
 *     differences. A series with many short phases
 *     each going UP by 3 days then DOWN by 3 days
 *     gives WM phase count high but pageZ ~ 0
 *     (alternating block ordering cancels).
 *
 *   - vs axis-208 Spearman footrule. Footrule sums L1
 *     deviations of GLOBAL ranks from time identity.
 *     Page sums LOCAL block-rank predicted scores.
 *     Different rank scope.
 *
 *   - vs axis-207 Pitman MSSD. MSSD is an L2
 *     squared-difference magnitude statistic; Page is
 *     a rank statistic with no magnitudes.
 *
 *   - vs axis-206 Jonckheere-Terpstra. JT uses k=4
 *     ordered QUARTILE blocks and sums O(n^2) pairwise
 *     U-counts ACROSS blocks. Page uses b = n/3
 *     SMALL CONTIGUOUS BLOCKS and predicted-ordinal
 *     scores WITHIN blocks. JT's blocks are large and
 *     compared between; Page's blocks are tiny and
 *     compared internally.
 *
 *   - vs axis-205 Cox-Stuart half-lag pair signs. CS
 *     pairs x[i] with x[i + ceil(n/2)] and signs n/2
 *     differences. Page makes no pairs across the
 *     half-lag; all comparisons are within a 3-day
 *     window.
 *
 *   - vs Mann-Kendall S. MK uses n*(n-1)/2 pairwise
 *     sign comparisons across ALL distinct pairs;
 *     Page uses 3*b = n predicted-ordinal scores.
 *     Different rank topology.
 *
 *   - vs Friedman / Kruskal-Wallis on time blocks.
 *     Friedman tests OMNIBUS (any difference) among
 *     treatments; Page tests SPECIFICALLY for the
 *     ordered alternative theta_1 <= ... <= theta_T.
 *     Page is more powerful for ordered trends.
 *
 *   - vs daily-token-monotone-run-length. Run-length
 *     measures the LONGEST monotone block; Page
 *     scores EVERY 3-block uniformly.
 *
 *   - vs daily-token-difference-sign-test. DS counts
 *     positive first differences; Page rank-orders
 *     within 3-day windows.
 *
 * Pre-processing: NONE (besides the gap-filling already
 * applied at the daily-aggregation layer).
 *
 * Refs:
 *   Page, E. B., "Ordered hypotheses for multiple
 *     treatments: a significance test for linear
 *     ranks", *J. Amer. Statist. Assoc.* 58(301)
 *     (1963), pp. 216-230.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.,
 *     Wiley (2014), sec. 7.2 (Page's test).
 *   Conover, W. J., *Practical Nonparametric
 *     Statistics*, 3rd ed., Wiley (1999), sec. 5.8.
 *   Siegel, S. & Castellan, N. J., *Nonparametric
 *     Statistics for the Behavioral Sciences*, 2nd
 *     ed., McGraw-Hill (1988), ch. 7.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPageLBlockTrendSort =
  | 'pageZ'
  | 'pageZAbsDesc'
  | 'pageL'
  | 'pageLAbsDesc'
  | 'pagePValue'
  | 'pagePValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPageLBlockTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep parity with the axis-205..-212 trend trilogy
   * and to ensure b >= 4 complete 3-day blocks (Page's
   * normal approximation good for b >= 4).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPageLBlockTrendSort;
  generatedAt?: string;
}

export interface DailyTokenPageLBlockTrendSourceRow {
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
  /** Number of complete 3-day blocks used (b). */
  nBlocks: number;
  /** Number of trailing days dropped (0..2). */
  nTrailingDropped: number;
  /** Number of blocks containing at least one within-block tie. */
  nTiedBlocks: number;
  /** Page's L statistic. */
  pageL: number;
  /** Expected value of L under H0 = 12 * b for T=3. */
  pageEL: number;
  /** Variance of L under H0 = 2 b for T=3. */
  pageVarL: number;
  /** Standardized Z form (pageL - E[L]) / sqrt(Var[L]). */
  pageZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|pageZ|)). */
  pagePValue: number;
}

export interface DailyTokenPageLBlockTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPageLBlockTrendSort;
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
  sources: DailyTokenPageLBlockTrendSourceRow[];
}

/**
 * Compute MIDRANKS for a small array (length 3 in the
 * Page-L use case but written generically). Ties get
 * the average of the tied positions.
 */
export function pageLMidranks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const idx = values.map((v, i) => ({ v, i }));
  idx.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1]!.v === idx[i]!.v) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!.i] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Whether a 3-element array contains any tie.
 */
export function pageLBlockHasTie(triple: number[]): boolean {
  if (triple.length !== 3) {
    throw new Error(
      `pageLBlockHasTie: need exactly 3 values (got ${triple.length})`,
    );
  }
  return (
    triple[0] === triple[1] ||
    triple[1] === triple[2] ||
    triple[0] === triple[2]
  );
}

/**
 * Standard normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailPageL(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailPageL: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailPageL(-z);
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
 * Compute Page's L statistic for T=3 over consecutive
 * 3-day blocks of `values`. Trailing (n mod 3) entries
 * are dropped.
 */
export function dailyTokenPageLBlockTrend(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nBlocks: number;
  nTrailingDropped: number;
  nTiedBlocks: number;
  pageL: number;
  pageEL: number;
  pageVarL: number;
  pageZ: number;
  pagePValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenPageLBlockTrend: need at least 12 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenPageLBlockTrend requires finite values');
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
      `dailyTokenPageLBlockTrend: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const T = 3;
  const b = Math.floor(n / T);
  if (b < 4) {
    throw new Error(
      `dailyTokenPageLBlockTrend: need at least 4 complete 3-day blocks (got ${b})`,
    );
  }
  const nTrailingDropped = n - b * T;
  let pageL = 0;
  let nTiedBlocks = 0;
  for (let blk = 0; blk < b; blk += 1) {
    const triple = [
      values[blk * T]!,
      values[blk * T + 1]!,
      values[blk * T + 2]!,
    ];
    if (pageLBlockHasTie(triple)) nTiedBlocks += 1;
    const ranks = pageLMidranks(triple);
    pageL += 1 * ranks[0]! + 2 * ranks[1]! + 3 * ranks[2]!;
  }
  // E[L] = b * T * (T+1)^2 / 4 = b * 3 * 16 / 4 = 12 b
  const pageEL = (b * T * (T + 1) * (T + 1)) / 4;
  // Var[L] = b * T^2 * (T-1) * (T+1)^2 / 144
  //        = b * 9 * 2 * 16 / 144 = 2 b
  const pageVarL = (b * T * T * (T - 1) * (T + 1) * (T + 1)) / 144;
  if (pageVarL <= 0) {
    throw new Error(
      `dailyTokenPageLBlockTrend: non-positive variance (b=${b})`,
    );
  }
  const pageZ = (pageL - pageEL) / Math.sqrt(pageVarL);
  if (!Number.isFinite(pageL) || !Number.isFinite(pageZ)) {
    throw new Error(
      `dailyTokenPageLBlockTrend: non-finite statistic (n=${n})`,
    );
  }
  const pagePValue = 2 * standardNormalUpperTailPageL(Math.abs(pageZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nBlocks: b,
    nTrailingDropped,
    nTiedBlocks,
    pageL,
    pageEL,
    pageVarL,
    pageZ,
    pagePValue: Math.min(1, Math.max(0, pagePValue)),
  };
}

export interface PageLBlockTrendCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanPageZ: number;
  tenureWeightedMeanPageZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED pageZ values via Stouffer's (1949) Z-method.
 */
export function aggregatePageLBlockTrend(
  rows: ReadonlyArray<{
    pageZ: number;
    pagePValue: number;
    nTenureDays: number;
  }>,
): PageLBlockTrendCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.pageZ) ||
      !Number.isFinite(r.pagePValue) ||
      r.pagePValue < 0 ||
      r.pagePValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.pageZ;
    weightedZSum += r.nTenureDays * r.pageZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanPageZ: Number.NaN,
      tenureWeightedMeanPageZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailPageL(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanPageZ: zSum / used,
    tenureWeightedMeanPageZ: weightedZSum / totalTenure,
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

export function buildDailyTokenPageLBlockTrend(
  queue: QueueLine[],
  opts: DailyTokenPageLBlockTrendOptions = {},
): DailyTokenPageLBlockTrendReport {
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
  const sort: DailyTokenPageLBlockTrendSort = opts.sort ?? 'pageZAbsDesc';
  const validSorts: DailyTokenPageLBlockTrendSort[] = [
    'pageZ',
    'pageZAbsDesc',
    'pageL',
    'pageLAbsDesc',
    'pagePValue',
    'pagePValueDesc',
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
  const rows: DailyTokenPageLBlockTrendSourceRow[] = [];

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
      result = dailyTokenPageLBlockTrend(filled);
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
      nBlocks: result.nBlocks,
      nTrailingDropped: result.nTrailingDropped,
      nTiedBlocks: result.nTiedBlocks,
      pageL: result.pageL,
      pageEL: result.pageEL,
      pageVarL: result.pageVarL,
      pageZ: result.pageZ,
      pagePValue: result.pagePValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'pageZ':
        primary = a.pageZ - b.pageZ;
        break;
      case 'pageZAbsDesc':
        primary = Math.abs(b.pageZ) - Math.abs(a.pageZ);
        break;
      case 'pageL':
        primary = a.pageL - b.pageL;
        break;
      case 'pageLAbsDesc':
        primary = Math.abs(b.pageL - b.pageEL) - Math.abs(a.pageL - a.pageEL);
        break;
      case 'pagePValue':
        primary = a.pagePValue - b.pagePValue;
        break;
      case 'pagePValueDesc':
        primary = b.pagePValue - a.pagePValue;
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
