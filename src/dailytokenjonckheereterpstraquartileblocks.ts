/**
 * daily-token-jonckheere-terpstra-quartile-blocks: per-source
 * JONCKHEERE 1954 / TERPSTRA 1952 ORDERED-ALTERNATIVE
 * RANK TEST applied to the gap-filled daily total_tokens
 * series partitioned into k = 4 CONSECUTIVE TIME BLOCKS
 * (chronological quartiles).
 *
 * TWO-HUNDRED-AND-SIXTH cross-source axis.
 *
 * Mechanism. Terpstra (1952 *Indag. Math.* 14: 327-333)
 * and independently Jonckheere (1954 *Biometrika* 41:
 * 133-145) propose a NONPARAMETRIC TEST for ORDERED
 * ALTERNATIVES across k >= 3 independent samples. Given
 * groups G_1, ..., G_k (here k = 4 chronologically-
 * consecutive blocks of the gap-filled daily series, each
 * of size n/4 +/- 1), the JT statistic is the SUM OF
 * MANN-WHITNEY U COUNTS over every pair of ordered
 * blocks:
 *
 *     jtJ = sum over i < j of U(G_i, G_j)
 *
 * where
 *
 *     U(G_i, G_j) = #{ (a, b) : a in G_i, b in G_j,
 *                                a < b }
 *                 + (1/2) * #{ (a, b) : a in G_i,
 *                                       b in G_j,
 *                                       a == b }
 *
 * (the standard "mid-rank" tie convention, equivalent
 * to Terpstra 1952 sec. 3 and to Hollander, Wolfe &
 * Chicken 2014 sec. 6.2 eq. 6.18).
 *
 * Under H0 of NO LOCATION SHIFT (F_1 = ... = F_k) all
 * orderings of the n total observations across the
 * blocks are equiprobable, so
 *
 *     E[jtJ]   = ( n^2 - sum_g n_g^2 ) / 4
 *     Var[jtJ] = ( n^2 (2n + 3) -
 *                  sum_g n_g^2 (2 n_g + 3) ) / 72
 *
 * (Jonckheere 1954 eqs. 5-6; Hollander-Wolfe-Chicken
 * 2014 eq. 6.20-6.21 NO-TIES form). The standardised
 * statistic
 *
 *     jtZ = ( jtJ - E[jtJ] ) / sqrt( Var[jtJ] )
 *         ~~ N(0, 1)
 *
 * is asymptotically standard normal once each block has
 * size >= 5 (Jonckheere 1954 sec. 4 Table 1; the normal
 * approximation is accurate within 0.005 of nominal alpha
 * by n_min = 5 per block at alpha = 0.05).
 *
 * SIGN CONVENTION:
 *
 *     jtZ much greater than +1.96 = jtJ much greater
 *       than its no-ordering expectation = LATE BLOCKS
 *       SYSTEMATICALLY OUTRANK EARLY BLOCKS = MONOTONIC
 *       INCREASING ORDERED-BLOCK TREND.
 *     jtZ much less than -1.96 = MONOTONIC DECREASING
 *       ORDERED-BLOCK TREND.
 *     jtZ approx 0 = no detectable monotonic ordering
 *       across the four chronological blocks.
 *
 * Two-sided p-value `jtPValue = 2 (1 - Phi(|jtZ|))`.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-205 daily-token-cox-stuart-sign-pairs.
 *     Cox-Stuart pairs v[i] with v[i+c] (lag c=ceil(n/2)
 *     -- maximally distant pairing) and counts the SIGN
 *     of the late-minus-early difference. JT pools the
 *     entire series into k=4 ORDERED GROUPS and counts
 *     PAIRWISE BLOCK U-COMPARISONS (n^2/4 - O(n)
 *     pair contributions). A series with strong global
 *     trend gives BOTH csZ >> 0 AND jtZ >> 0; a series
 *     with a single late-block burst (only Q4 elevated,
 *     Q1=Q2=Q3 flat) shows a strong jtZ (last block
 *     outranks all earlier ones in 3 of the 6 pairwise
 *     U comparisons) but a Cox-Stuart csZ that depends
 *     on the precise pair-offset alignment (csZ may be
 *     marginal). A series with linear trend over Q1-Q3
 *     and a Q4 reversion to baseline shows csZ ~ 0
 *     (paired-sign cancellation) but jtZ that captures
 *     the Q1<Q2<Q3 ordering net-of-Q4-reversion.
 *
 *   - vs axis-203 daily-token-david-barton-runs-up-down.
 *     David-Barton counts MAXIMAL RUNS of identically-
 *     signed FIRST DIFFERENCES (lag-1 LOCAL oscillation
 *     vs persistence). JT measures GLOBAL block-level
 *     ordering across k=4 chronological blocks. A series
 *     with severe lag-1 oscillation around a slowly-
 *     rising baseline gives dbZ >> 0 (high run count)
 *     AND jtZ >> 0 (Q1 < Q2 < Q3 < Q4 by block-rank),
 *     classifying as "drift + AR(1)-noise" coherently.
 *
 *   - vs axis-202 daily-token-noether-cyclical-trend.
 *     Noether at lag-2 examines MONOTONIC SPACED
 *     TRIPLETS (v[i], v[i+2], v[i+4]) -- a LOCAL trend
 *     probe at a FIXED SHORT lag. JT pools all
 *     observations into k=4 BLOCKS and tests block-
 *     level ordering -- global rank-aggregated.
 *
 *   - vs all halves-comparison axes (Mann-Whitney etc.).
 *     Halves split into k=2 groups. JT splits into k=4
 *     CHRONOLOGICAL GROUPS and tests for an ORDERED
 *     ALTERNATIVE -- it is sensitive to monotonicity
 *     across multiple blocks, not merely to a single
 *     early-vs-late shift. A series with a U-shape (Q1
 *     and Q4 high, Q2 and Q3 low) has a halves-Mann-
 *     Whitney p-value near 1 (means equal) but a
 *     strongly NEGATIVE jtZ (since Q4 > Q3 alone is
 *     swamped by Q1 > Q2 in the JT U-sum -- the test
 *     is not a halves test).
 *
 *   - vs Mann-Kendall tau (axis-... if shipped).
 *     Mann-Kendall sums sign(v[j] - v[i]) over ALL
 *     n(n-1)/2 pairs -- a FULL-RANK trend probe at the
 *     finest possible resolution. JT aggregates to
 *     BLOCK-LEVEL pairwise U comparisons (k(k-1)/2
 *     block pairs, each contributing on average n^2/k^2
 *     pair counts). Mann-Kendall is sensitive to the
 *     entire pairwise sign pattern; JT is sensitive to
 *     the BLOCK-AVERAGED ordering -- robust to within-
 *     block heterogeneity that would noise-up Mann-
 *     Kendall.
 *
 * Pre-processing: NONE. JT is a rank-based U-statistic;
 * any strictly monotone increasing transform of the
 * series (log, sqrt, etc.) leaves jtJ unchanged. JT is
 * also shift- and positive-scale-invariant.
 *
 * Hard floor on min-tenure-days is 20 (gives n = 20,
 * each block size n/4 = 5, exactly at Jonckheere 1954
 * Table 1 normal-approximation validity threshold).
 *
 * Tie convention. The mid-rank "U with 1/2-weight on
 * ties" form (Hollander-Wolfe-Chicken 2014 eq. 6.18) is
 * used. Under heavy ties the variance Var[jtJ] is the
 * NO-TIES form -- this is conservative (slightly over-
 * estimates Var, slightly under-rejects H0). The exact
 * tie-correction (Lehmann 1975 eq. 4.16) is not needed
 * at the n>=20 floor with the gap-filled-zero series
 * because tie-rate is bounded by zero-day proportion.
 *
 * Reference:
 *   Terpstra, T. J., "The asymptotic normality and
 *     consistency of Kendall's test against trend, when
 *     ties are present in one ranking",
 *     *Indagationes Mathematicae* 14 (1952), pp. 327-333.
 *   Jonckheere, A. R., "A distribution-free k-sample
 *     test against ordered alternatives",
 *     *Biometrika* 41 (1954), pp. 133-145.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.
 *     (Wiley 2014), sec. 6.2.
 *   Lehmann, E. L., *Nonparametrics: Statistical Methods
 *     Based on Ranks* (Holden-Day 1975), sec. 4.
 */
import type { QueueLine } from './types.js';

export type DailyTokenJonckheereTerpstraQuartileBlocksSort =
  | 'jtZ'
  | 'jtZAbsDesc'
  | 'jtPValue'
  | 'jtPValueDesc'
  | 'jtJ'
  | 'jtJDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenJonckheereTerpstraQuartileBlocksOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 20 so
   * each of the k=4 blocks has size >= 5 -- within
   * Jonckheere 1954 Table 1 normal-approximation
   * validity band.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenJonckheereTerpstraQuartileBlocksSort;
  generatedAt?: string;
}

export interface DailyTokenJonckheereTerpstraQuartileBlocksSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Number of chronological blocks (always 4 here). */
  jtK: number;
  /** Block sizes [n1, n2, n3, n4] (sums to nTenureDays). */
  jtBlockSizes: number[];
  /** Jonckheere-Terpstra U-sum statistic. */
  jtJ: number;
  /** Expected value of jtJ under H0 (no ordering). */
  jtExpected: number;
  /** Variance of jtJ under H0 (no-ties form). */
  jtVariance: number;
  /** Standardised Z = (jtJ - E[jtJ]) / sqrt(Var[jtJ]). */
  jtZ: number;
  /** Two-sided normal p-value. */
  jtPValue: number;
}

export interface DailyTokenJonckheereTerpstraQuartileBlocksReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenJonckheereTerpstraQuartileBlocksSort;
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
  sources: DailyTokenJonckheereTerpstraQuartileBlocksSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailJonckheereTerpstra(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailJonckheereTerpstra: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailJonckheereTerpstra(-z);
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
 * Partition the index range [0, n) into k consecutive
 * blocks as evenly as possible. The first (n mod k)
 * blocks each receive ceil(n/k) elements; the remaining
 * blocks each receive floor(n/k) elements. Returns the
 * block sizes [n1, ..., nk] (always summing to n).
 */
export function partitionIntoConsecutiveBlocks(
  n: number,
  k: number,
): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `partitionIntoConsecutiveBlocks: n must be non-negative integer (got ${n})`,
    );
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(
      `partitionIntoConsecutiveBlocks: k must be positive integer (got ${k})`,
    );
  }
  const base = Math.floor(n / k);
  const rem = n - base * k;
  const sizes = new Array<number>(k);
  for (let i = 0; i < k; i += 1) {
    sizes[i] = base + (i < rem ? 1 : 0);
  }
  return sizes;
}

/**
 * Compute the Mann-Whitney U-count for the directional
 * comparison G_i vs G_j: count of (a, b) pairs with
 * a in G_i, b in G_j, and a < b, plus 0.5 * count of
 * a == b ties (mid-rank convention; Hollander-Wolfe-
 * Chicken 2014 eq. 6.18).
 */
export function pairwiseMannWhitneyUCountJonckheere(
  groupI: number[],
  groupJ: number[],
): number {
  let u = 0;
  for (const a of groupI) {
    for (const b of groupJ) {
      if (a < b) u += 1;
      else if (a === b) u += 0.5;
    }
  }
  return u;
}

/**
 * Jonckheere-Terpstra (Terpstra 1952 / Jonckheere 1954)
 * ordered-alternative rank test on a real-valued series
 * partitioned into k = 4 chronological blocks. Returns
 * the U-sum statistic, its no-ties expectation /
 * variance, the standardised Z, and two-sided normal
 * p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - jtJ(x + c) === jtJ(x) for any constant c
 *     (rank comparisons translation-invariant).
 *   - jtJ(a * x) === jtJ(x) for any a > 0
 *     (positive scale preserves rank order).
 *   - jtJ(-x) === jtJMax - jtJ(x) where jtJMax =
 *     sum_{i<j} n_i * n_j (negation reverses every
 *     pairwise comparison; ties preserved at 0.5).
 *   - For x strictly increasing (perfect ordering):
 *     jtJ === jtJMax (every cross-block pair satisfies
 *     a < b).
 *   - For x strictly decreasing: jtJ === 0.
 *   - For x = repeat(constant): jtJ === jtJMax / 2
 *     (every pair tied; each contributes 0.5).
 *   - jtZ is finite and well-defined when min block
 *     size >= 1 and at least 2 distinct values.
 *   - For x = repeat(constant) the centred variance
 *     is zero; we throw to be filtered upstream.
 */
export function dailyTokenJonckheereTerpstraQuartileBlocks(
  values: number[],
): {
  mean: number;
  stddev: number;
  nSamples: number;
  jtK: number;
  jtBlockSizes: number[];
  jtJ: number;
  jtExpected: number;
  jtVariance: number;
  jtZ: number;
  jtPValue: number;
} {
  const n = values.length;
  const k = 4;
  if (n < 20) {
    throw new Error(
      `dailyTokenJonckheereTerpstraQuartileBlocks: need at least 20 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenJonckheereTerpstraQuartileBlocks requires finite values',
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
      `dailyTokenJonckheereTerpstraQuartileBlocks: zero centred variance (n=${n})`,
    );
  }

  const sizes = partitionIntoConsecutiveBlocks(n, k);
  for (const sz of sizes) {
    if (sz < 1) {
      throw new Error(
        `dailyTokenJonckheereTerpstraQuartileBlocks: block size < 1 (sizes=${sizes.join(',')})`,
      );
    }
  }

  // Slice into the k consecutive blocks.
  const blocks: number[][] = new Array(k);
  let cursor = 0;
  for (let g = 0; g < k; g += 1) {
    blocks[g] = values.slice(cursor, cursor + sizes[g]!);
    cursor += sizes[g]!;
  }

  // Compute jtJ = sum_{i<j} U(G_i, G_j).
  let jtJ = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = i + 1; j < k; j += 1) {
      jtJ += pairwiseMannWhitneyUCountJonckheere(blocks[i]!, blocks[j]!);
    }
  }

  // No-ties expectation and variance (Jonckheere 1954
  // eqs. 5-6; Hollander-Wolfe-Chicken 2014 eqs. 6.20-6.21):
  //   E[jtJ]   = ( n^2 - sum_g n_g^2 ) / 4
  //   Var[jtJ] = ( n^2 (2n + 3)
  //                - sum_g n_g^2 (2 n_g + 3) ) / 72
  let sumNgSq = 0;
  let sumNgSq2NgPlus3 = 0;
  for (const sz of sizes) {
    sumNgSq += sz * sz;
    sumNgSq2NgPlus3 += sz * sz * (2 * sz + 3);
  }
  const jtExpected = (n * n - sumNgSq) / 4;
  const jtVariance =
    (n * n * (2 * n + 3) - sumNgSq2NgPlus3) / 72;
  if (!(jtVariance > 0) || !Number.isFinite(jtVariance)) {
    throw new Error(
      `dailyTokenJonckheereTerpstraQuartileBlocks: degenerate variance (jtVariance=${jtVariance})`,
    );
  }
  const jtZ = (jtJ - jtExpected) / Math.sqrt(jtVariance);
  if (!Number.isFinite(jtZ)) {
    throw new Error(
      `dailyTokenJonckheereTerpstraQuartileBlocks: non-finite z (n=${n})`,
    );
  }
  const jtPValue =
    2 * standardNormalUpperTailJonckheereTerpstra(Math.abs(jtZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    jtK: k,
    jtBlockSizes: sizes,
    jtJ,
    jtExpected,
    jtVariance,
    jtZ,
    jtPValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-206. Combines
 * per-source SIGNED jtZ via Stouffer's Z-method
 * (Stouffer et al. 1949). Skips malformed rows.
 */
export interface JonckheereTerpstraQuartileBlocksCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanJtZ: number;
  tenureWeightedMeanJtZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateJonckheereTerpstraQuartileBlocks(
  rows: ReadonlyArray<{
    jtZ: number;
    jtPValue: number;
    nTenureDays: number;
  }>,
): JonckheereTerpstraQuartileBlocksCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.jtZ) ||
      !Number.isFinite(r.jtPValue) ||
      r.jtPValue <= 0 ||
      r.jtPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 20
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.jtZ;
    weightedZSum += r.nTenureDays * r.jtZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanJtZ: Number.NaN,
      tenureWeightedMeanJtZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailJonckheereTerpstra(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanJtZ: zSum / used,
    tenureWeightedMeanJtZ: weightedZSum / totalTenure,
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

export function buildDailyTokenJonckheereTerpstraQuartileBlocks(
  queue: QueueLine[],
  opts: DailyTokenJonckheereTerpstraQuartileBlocksOptions = {},
): DailyTokenJonckheereTerpstraQuartileBlocksReport {
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
  const sort: DailyTokenJonckheereTerpstraQuartileBlocksSort =
    opts.sort ?? 'jtZAbsDesc';
  const validSorts: DailyTokenJonckheereTerpstraQuartileBlocksSort[] = [
    'jtZ',
    'jtZAbsDesc',
    'jtPValue',
    'jtPValueDesc',
    'jtJ',
    'jtJDesc',
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
  const rows: DailyTokenJonckheereTerpstraQuartileBlocksSourceRow[] = [];

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
      result = dailyTokenJonckheereTerpstraQuartileBlocks(filled);
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
      jtK: result.jtK,
      jtBlockSizes: result.jtBlockSizes,
      jtJ: result.jtJ,
      jtExpected: result.jtExpected,
      jtVariance: result.jtVariance,
      jtZ: result.jtZ,
      jtPValue: result.jtPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'jtZ':
        primary = a.jtZ - b.jtZ;
        break;
      case 'jtZAbsDesc':
        primary = Math.abs(b.jtZ) - Math.abs(a.jtZ);
        break;
      case 'jtPValue':
        primary = a.jtPValue - b.jtPValue;
        break;
      case 'jtPValueDesc':
        primary = b.jtPValue - a.jtPValue;
        break;
      case 'jtJ':
        primary = a.jtJ - b.jtJ;
        break;
      case 'jtJDesc':
        primary = b.jtJ - a.jtJ;
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
