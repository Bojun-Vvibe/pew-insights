/**
 * daily-token-wilcoxon-signed-rank-halves: per-source
 * WILCOXON SIGNED-RANK PAIRED TEST on the half-split
 * gap-filled daily total_tokens series. Each day of the
 * first half (n1 = floor(n/2) days) is PAIRED with the
 * corresponding day of the second half (n2 = n - n1
 * days; if n is odd we drop the median day so the two
 * halves have IDENTICAL length and the pairing is
 * unambiguous). Differences d_i = B_i - A_i are signed-
 * ranked; the test statistic is W+ (sum of positive
 * ranks), referenced to its asymptotic normal null with
 * CONTINUITY CORRECTION and TIE-CORRECTED variance.
 *
 * ONE-HUNDRED-AND-EIGHTY-NINTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL to every prior axis. Detail:
 *
 *   - vs axis-115 MANN-WHITNEY (independent two-sample
 *     rank-sum). MW treats the two halves as
 *     INDEPENDENT samples and tests stochastic
 *     dominance F_A != F_B. axis-189 treats them as
 *     PAIRED observations of the SAME calendar day-
 *     position and tests whether the within-pair shift
 *     d_i = B_i - A_i has zero pseudo-median. The
 *     PAIRED null is STRICTLY STRONGER than the
 *     unpaired one whenever pairing reduces variance
 *     (which it does whenever there is any shared
 *     within-pair signal -- e.g., weekly seasonality
 *     that aligns first/second-half day-positions).
 *   - vs axis-186 HL (HODGES-LEHMANN POINT ESTIMATOR +
 *     LEHMANN CI). HL is the TWO-SAMPLE Hodges-Lehmann
 *     estimator built on Walsh averages of cross-
 *     sample pairs. axis-189 is a PAIRED-DESIGN
 *     SIGNIFICANCE TEST built on the SIGNED-RANK SUM
 *     of WITHIN-PAIR differences -- a different
 *     statistic on a different null. (The paired
 *     analogue of HL would be the median of Walsh
 *     averages of d_i with d_j; we deliberately do
 *     NOT estimate that here -- axis-189 is a pure
 *     significance-decision test, not an estimator.)
 *   - vs axis-188 PERMUTATION WELCH-T (independent
 *     two-sample, raw values, exchangeable null).
 *     axis-188 permutes labels under an
 *     exchangeability null on the POOLED sample;
 *     axis-189 ranks WITHIN-PAIR differences under a
 *     SYMMETRY null on d_i around 0. Different null,
 *     different design, different statistic.
 *   - vs axis-187 A12 / axis-185 BWS / axis-184 SAVAGE
 *     / axis-181 vdW / axis-183 YW. All those are
 *     INDEPENDENT-SAMPLE tests. axis-189 is the FIRST
 *     PAIRED-DESIGN test in the cross-source axis
 *     family.
 *   - vs axis-118 PETTITT change-point (single break-
 *     point detection by max-cumulative-rank-deviation
 *     across the whole series). axis-189 fixes the
 *     split at n/2 BY CONSTRUCTION and tests
 *     PAIRED-SHIFT, so it is sensitive to a SUSTAINED
 *     PAIRED LOCATION SHIFT that aligns with the
 *     half-boundary, not to a one-off break.
 *
 * THE STATISTIC. Given the gap-filled daily series
 * v[0..n-1], drop v[(n-1)/2] when n is odd so n becomes
 * even, then split into A = v[0..n/2-1] and B =
 * v[n/2..n-1]. Pair (A_i, B_i) for i in [0, n/2).
 * Compute differences d_i = B_i - A_i. Drop zero
 * differences (Pratt 1959 modification: zero-rank
 * elimination); let nNonZero = #{i : d_i != 0}. Rank
 * |d_i| with MID-RANK tie correction. Let
 *
 *     W+ = sum_{i: d_i > 0} rank(|d_i|)
 *     W- = sum_{i: d_i < 0} rank(|d_i|)
 *     W  = W+ - W-              (signed-rank sum)
 *
 * Under H0: F_d is symmetric around 0,
 *
 *     E[W+]   = nNonZero (nNonZero + 1) / 4
 *     Var[W+] = nNonZero (nNonZero + 1) (2 nNonZero + 1)
 *               / 24
 *               - sum_g t_g (t_g - 1) (t_g + 1) / 48
 *
 * (the tie correction term subtracts variance
 * contributed by each tie group g of size t_g; Lehmann
 * 1975 *Nonparametrics* 4.1.2). The asymptotic
 * normal-approximation Z with CONTINUITY CORRECTION is
 *
 *     Z = (W+ - E[W+] - 0.5 * sign(W+ - E[W+]))
 *         / sqrt(Var[W+])
 *
 * (continuity correction vanishes when W+ == E[W+]).
 * Two-sided p uses the standard normal survival:
 *
 *     pTwoSided = 2 * (1 - Phi(|Z|))
 *     pUpper    = 1 - Phi(Z)
 *     pLower    = Phi(Z)
 *
 * SIGN convention: positive Z = SECOND-half larger
 * (preserves the second-half-positive cross-axis
 * convention; matches the sign of W+ - E[W+]).
 *
 * EFFECT-SIZE CONJUGATE. We surface the matched-pairs
 * RANK-BISERIAL CORRELATION
 *
 *     r_rb = (W+ - W-) / (W+ + W-) in [-1, 1]
 *
 * (Kerby 2014 *Comprehensive Psychology* 3:Article 1,
 * the simple-difference formula). |r_rb| has a clean
 * scale-free interpretation as the proportion of
 * within-pair rank mass favouring B over A, and is
 * directly comparable across sources of widely
 * different token volumes.
 *
 * DECISION BUCKETS. 5-level keyed off pTwoSided:
 *
 *     pTwoSided <= 0.001  -> 'highly-significant'
 *     pTwoSided <= 0.01   -> 'very-significant'
 *     pTwoSided <= 0.05   -> 'significant'
 *     pTwoSided <= 0.10   -> 'marginal'
 *     pTwoSided >  0.10   -> 'ns'
 *
 * Refs:
 *   - Wilcoxon, F. (1945). Individual comparisons by
 *     ranking methods. *Biometrics Bull.* 1(6):80-83.
 *   - Pratt, J. W. (1959). Remarks on zeros and ties
 *     in the Wilcoxon signed rank procedures. *J.
 *     Amer. Stat. Assoc.* 54(287):655-667.
 *   - Lehmann, E. L. (1975). *Nonparametrics:
 *     Statistical Methods Based on Ranks*. Holden-Day.
 *     Section 4.1.2 (tie-corrected variance).
 *   - Kerby, D. S. (2014). The simple difference
 *     formula: an approach to teaching nonparametric
 *     correlation. *Comprehensive Psychology*
 *     3:Article 1.
 */

import type { QueueLine } from './types.js';

export type DailyTokenWilcoxonSignedRankHalvesSort =
  | 'wPlus'
  | 'absZDesc'
  | 'pTwoSided'
  | 'tokens'
  | 'tenure'
  | 'source';

export type WilcoxonSignedRankDecision =
  | 'highly-significant'
  | 'very-significant'
  | 'significant'
  | 'marginal'
  | 'ns';

export interface DailyTokenWilcoxonSignedRankHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenWilcoxonSignedRankHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenWilcoxonSignedRankHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Number of pairs after dropping the median day if n odd. */
  wsrNPairs: number;
  /** Number of non-zero pairs (zeros dropped Pratt-style). */
  wsrNNonZero: number;
  /** Number of zero-difference pairs that were dropped. */
  wsrNZeroDropped: number;
  /** Sum of ranks of positive d_i. */
  wsrWPlus: number;
  /** Sum of ranks of negative d_i. */
  wsrWMinus: number;
  /** Signed-rank sum W+ - W-. */
  wsrW: number;
  /** Expected W+ under H0. */
  wsrExpectedWPlus: number;
  /** Tie-corrected variance of W+ under H0. */
  wsrVarianceWPlus: number;
  /** Asymptotic normal Z with continuity correction. */
  wsrZ: number;
  /** Two-sided normal p. */
  wsrPTwoSided: number;
  /** Upper-tail normal p. */
  wsrPUpper: number;
  /** Lower-tail normal p. */
  wsrPLower: number;
  /** Sign of Z in {-1, 0, +1}. */
  wsrSign: -1 | 0 | 1;
  /** Matched-pairs rank-biserial correlation in [-1, 1]. */
  wsrRankBiserial: number;
  /** 5-level decision bucket. */
  wsrDecision: WilcoxonSignedRankDecision;
}

export interface DailyTokenWilcoxonSignedRankHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWilcoxonSignedRankHalvesSort;
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
  sources: DailyTokenWilcoxonSignedRankHalvesSourceRow[];
}

/** Decision bucket from two-sided p. */
export function wilcoxonSignedRankDecision(
  pTwoSided: number,
): WilcoxonSignedRankDecision {
  if (!Number.isFinite(pTwoSided) || pTwoSided < 0 || pTwoSided > 1) {
    throw new Error(
      `wilcoxonSignedRankDecision: pTwoSided must be in [0, 1] (got ${pTwoSided})`,
    );
  }
  if (pTwoSided <= 0.001) return 'highly-significant';
  if (pTwoSided <= 0.01) return 'very-significant';
  if (pTwoSided <= 0.05) return 'significant';
  if (pTwoSided <= 0.10) return 'marginal';
  return 'ns';
}

/** Standard normal CDF Phi(x) via Abramowitz-Stegun 7.1.26 erf approx. */
function normalCdf(x: number): number {
  // erf approximation, max error ~ 1.5e-7.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** Mid-rank rank assignment with tie groups; returns ranks and tie-group sizes. */
export function midRanks(values: ReadonlyArray<number>): {
  ranks: number[];
  tieGroupSizes: number[];
} {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  const tieGroupSizes: number[] = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) j += 1;
    const groupSize = j - i + 1;
    // average rank (1-indexed): (i+1 + j+1) / 2.
    const avg = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k]!] = avg;
    if (groupSize > 1) tieGroupSizes.push(groupSize);
    i = j + 1;
  }
  return { ranks, tieGroupSizes };
}

/**
 * Wilcoxon signed-rank PAIRED test on a contiguous-half
 * split of the input series. Returns W+, W-, expected
 * W+, tie-corrected variance, continuity-corrected Z,
 * normal p-values, and the matched-pairs rank-biserial
 * effect size.
 */
export function dailyTokenWilcoxonSignedRankHalves(values: number[]): {
  nPairs: number;
  nNonZero: number;
  nZeroDropped: number;
  wPlus: number;
  wMinus: number;
  w: number;
  expectedWPlus: number;
  varianceWPlus: number;
  z: number;
  pTwoSided: number;
  pUpper: number;
  pLower: number;
  rankBiserial: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenWilcoxonSignedRankHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenWilcoxonSignedRankHalves requires finite values',
      );
    }
  }
  // Drop median day when n odd so halves have identical length.
  let trimmed: number[];
  if (n % 2 === 1) {
    const mid = (n - 1) >>> 1;
    trimmed = values.slice(0, mid).concat(values.slice(mid + 1));
  } else {
    trimmed = values.slice();
  }
  const half = trimmed.length / 2;
  const sampleA = trimmed.slice(0, half);
  const sampleB = trimmed.slice(half);
  // Build differences d_i = B_i - A_i. Pratt: drop zeros.
  const diffsAll: number[] = new Array(half);
  for (let i = 0; i < half; i += 1) diffsAll[i] = sampleB[i]! - sampleA[i]!;
  let nZeroDropped = 0;
  const diffs: number[] = [];
  for (const d of diffsAll) {
    if (d === 0) nZeroDropped += 1;
    else diffs.push(d);
  }
  const nNonZero = diffs.length;
  if (nNonZero < 6) {
    throw new Error(
      `dailyTokenWilcoxonSignedRankHalves: need at least 6 non-zero differences (got ${nNonZero})`,
    );
  }
  const absDiffs = diffs.map((d) => Math.abs(d));
  const { ranks, tieGroupSizes } = midRanks(absDiffs);
  let wPlus = 0;
  let wMinus = 0;
  for (let i = 0; i < nNonZero; i += 1) {
    if (diffs[i]! > 0) wPlus += ranks[i]!;
    else wMinus += ranks[i]!;
  }
  const w = wPlus - wMinus;
  const expectedWPlus = (nNonZero * (nNonZero + 1)) / 4;
  // Variance: N(N+1)(2N+1)/24 - sum t(t-1)(t+1)/48.
  const baseVar = (nNonZero * (nNonZero + 1) * (2 * nNonZero + 1)) / 24;
  let tieCorrection = 0;
  for (const t of tieGroupSizes) {
    tieCorrection += (t * (t - 1) * (t + 1)) / 48;
  }
  const varianceWPlus = baseVar - tieCorrection;
  if (!(varianceWPlus > 0)) {
    throw new Error(
      `dailyTokenWilcoxonSignedRankHalves: non-positive variance (var=${varianceWPlus})`,
    );
  }
  const dev = wPlus - expectedWPlus;
  const cc = dev > 0 ? -0.5 : dev < 0 ? 0.5 : 0;
  const z = (dev + cc) / Math.sqrt(varianceWPlus);
  const phi = normalCdf(z);
  const pUpper = 1 - phi;
  const pLower = phi;
  const pTwoSided = 2 * (1 - normalCdf(Math.abs(z)));
  const sumW = wPlus + wMinus;
  const rankBiserial = sumW > 0 ? (wPlus - wMinus) / sumW : 0;
  return {
    nPairs: half,
    nNonZero,
    nZeroDropped,
    wPlus,
    wMinus,
    w,
    expectedWPlus,
    varianceWPlus,
    z,
    pTwoSided,
    pUpper,
    pLower,
    rankBiserial,
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

export function buildDailyTokenWilcoxonSignedRankHalves(
  queue: QueueLine[],
  opts: DailyTokenWilcoxonSignedRankHalvesOptions = {},
): DailyTokenWilcoxonSignedRankHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 16;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 16) {
    throw new Error(
      `minTenureDays must be an integer >= 16 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenWilcoxonSignedRankHalvesSort = opts.sort ?? 'absZDesc';
  const validSorts: DailyTokenWilcoxonSignedRankHalvesSort[] = [
    'wPlus',
    'absZDesc',
    'pTwoSided',
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
  const rows: DailyTokenWilcoxonSignedRankHalvesSourceRow[] = [];

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
      result = dailyTokenWilcoxonSignedRankHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const sign: -1 | 0 | 1 = result.z > 0 ? 1 : result.z < 0 ? -1 : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      wsrNPairs: result.nPairs,
      wsrNNonZero: result.nNonZero,
      wsrNZeroDropped: result.nZeroDropped,
      wsrWPlus: result.wPlus,
      wsrWMinus: result.wMinus,
      wsrW: result.w,
      wsrExpectedWPlus: result.expectedWPlus,
      wsrVarianceWPlus: result.varianceWPlus,
      wsrZ: result.z,
      wsrPTwoSided: result.pTwoSided,
      wsrPUpper: result.pUpper,
      wsrPLower: result.pLower,
      wsrSign: sign,
      wsrRankBiserial: result.rankBiserial,
      wsrDecision: wilcoxonSignedRankDecision(result.pTwoSided),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'wPlus':
        primary = b.wsrWPlus - a.wsrWPlus;
        break;
      case 'absZDesc':
        primary = Math.abs(b.wsrZ) - Math.abs(a.wsrZ);
        break;
      case 'pTwoSided':
        primary = a.wsrPTwoSided - b.wsrPTwoSided;
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
