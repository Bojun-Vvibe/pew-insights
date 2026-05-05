/**
 * daily-token-cliffs-delta-halves: per-source CLIFF'S
 * DELTA effect-size with BOOTSTRAP PERCENTILE CI on the
 * half-split gap-filled daily total_tokens series.
 *
 * Cliff (1993, *Psychological Bulletin* 114(3):494-509)
 * defines the ordinal effect size
 *
 *     delta = P(X_B > X_A) - P(X_A > X_B)
 *           in [-1, +1]
 *
 * for two independent samples A and B drawn from CDFs
 * F_A and F_B. Sample estimator on samples of size m
 * (first half) and n (second half) is
 *
 *     deltaHat = (#{(i, j) : B_j > A_i}
 *               -  #{(i, j) : B_j < A_i}) / (m * n)
 *
 * with TIES contributing 0 to the numerator (Cliff's
 * preferred convention; ties are EXCLUDED from the
 * dominance count, not split). |delta| in [0, +1] is a
 * RANK-PROBABILITY effect-size that is INVARIANT under
 * any strictly monotone transformation of the values --
 * it depends only on the JOINT RANKS of the pooled
 * sample. Sign convention: deltaHat > 0 means SECOND
 * half stochastically dominates the first half.
 *
 * ONE-HUNDRED-AND-NINETY-FIRST cross-source axis. SECOND
 * ORDINAL EFFECT-SIZE axis (axis-187 Vargha-Delaney A12
 * was the first); orthogonal to A12 by formula AND by
 * confidence-interval method (BOOTSTRAP PERCENTILE here
 * vs A12's analytical Mee 1990 CI).
 *
 * STRUCTURALLY ORTHOGONAL to every prior axis. Detail:
 *
 *   - vs axis-187 VARGHA-DELANEY A12. A12 = P(X_B > X_A)
 *     + 0.5 * P(X_B = X_A) in [0, 1]; Cliff's delta =
 *     P(X_B > X_A) - P(X_A > X_B) in [-1, +1]. The two
 *     are algebraically related (delta = 2*A12 - 1) ONLY
 *     when there are NO TIES; under ties the formulas
 *     diverge (A12 splits ties at 0.5, Cliff's delta
 *     drops them entirely from the numerator). Crucially
 *     this axis differs from axis-187 in TWO further
 *     ways: (1) the CI method here is BOOTSTRAP PERCENTILE
 *     (n_boot resamples of the m+n half-pairs with
 *     replacement) NOT the closed-form Mee 1990
 *     approximation that axis-187 uses; (2) we surface
 *     the dominance-count split (nGreater / nLess /
 *     nEqual) as primary outputs, exposing the TIE
 *     STRUCTURE that axis-187's A12 collapses into a
 *     half-credit. Reported alongside delta is the
 *     bootstrap-CI HALF-WIDTH and a CI-EXCLUSION
 *     decision bucket (CI excludes 0 -> significant).
 *   - vs axis-115 MANN-WHITNEY rank-sum. MW returns a Z
 *     and a SIGNIFICANCE p but the effect-size is buried
 *     in U; this axis surfaces the ORDINAL effect-size
 *     directly with a NON-PARAMETRIC distribution-free
 *     CI from the data itself.
 *   - vs axis-186 HODGES-LEHMANN. HL is a LOCATION
 *     point estimator (median of pairwise differences)
 *     in the SAME UNITS as the data; Cliff's delta is a
 *     UNIT-FREE ORDINAL effect-size on [-1, +1].
 *   - vs axis-188 PERMUTATION WELCH-T. Permutation t is
 *     a SIGNIFICANCE test on a LOCATION statistic with
 *     an EXCHANGEABILITY null; Cliff's delta is an
 *     ORDINAL EFFECT-SIZE with a BOOTSTRAP CI under the
 *     SAMPLING null.
 *   - vs axes 189/190 paired-design tests (wilcoxon
 *     signed-rank, paired sign). Those operate on
 *     within-pair differences d_i = B_i - A_i; Cliff's
 *     delta operates on ALL m*n cross-pair comparisons
 *     between INDEPENDENT samples (so it does NOT
 *     leverage the pairing) -- a strictly different null.
 *   - vs every prior SCALE axis (Mood/Levene/AB scale,
 *     Klotz, Conover squared-ranks, Siegel-Tukey,
 *     Ansari-Bradley): scale axes test EQUAL DISPERSION
 *     under equal medians; Cliff's delta tests STOCHASTIC
 *     ORDERING regardless of dispersion.
 *
 * THE STATISTIC. Given the gap-filled daily series
 * v[0..N-1] with N >= 16, drop v[(N-1)/2] when N is odd
 * so N becomes even, then split into A = v[0..N/2-1]
 * (m = N/2) and B = v[N/2..N-1] (n = N/2). Compute
 *
 *     nGreater = #{(i, j) : B_j > A_i}
 *     nLess    = #{(i, j) : B_j < A_i}
 *     nEqual   = #{(i, j) : B_j = A_i}
 *     deltaHat = (nGreater - nLess) / (m * n)
 *
 * BOOTSTRAP PERCENTILE CI. Resample A and B WITH
 * REPLACEMENT independently nBoot times (default 999);
 * compute deltaHat on each resample; the (alpha/2,
 * 1-alpha/2) percentiles of the deltaHat* distribution
 * form the (1-alpha) CI. Default alpha = 0.05 (95% CI).
 * The bootstrap is SEEDED via a deterministic
 * Mulberry32 PRNG keyed on the source name for
 * reproducible reports. We surface ciLow, ciHigh, the
 * half-width (ciHigh - ciLow)/2, and an EXCLUDES-ZERO
 * boolean.
 *
 * DECISION BUCKETS keyed off CI-exclusion-of-zero AND
 * |deltaHat| magnitude (Romano-Coraggio-Skowronski 2006
 * thresholds: |delta| < .147 = negligible, < .33 =
 * small, < .474 = medium, otherwise large):
 *
 *     CI excludes 0 AND |delta| >= .474 -> 'significant-large'
 *     CI excludes 0 AND |delta| >= .33  -> 'significant-medium'
 *     CI excludes 0 AND |delta| >= .147 -> 'significant-small'
 *     CI excludes 0 AND |delta|  < .147 -> 'significant-negligible'
 *     CI includes 0                     -> 'ns'
 *
 * Refs:
 *   - Cliff, N. (1993). Dominance statistics: ordinal
 *     analyses to answer ordinal questions.
 *     *Psychological Bulletin* 114(3):494-509.
 *   - Cliff, N. (1996). *Ordinal Methods for Behavioral
 *     Data Analysis*. Erlbaum, ch. 5.
 *   - Romano, J., Coraggio, J., & Skowronski, J.
 *     (2006). Appropriate statistics for ordinal level
 *     data. *Annual Meeting of FERA*.
 *   - Efron, B. (1979). Bootstrap methods: another look
 *     at the jackknife. *Annals of Statistics* 7(1):
 *     1-26.
 */

import type { QueueLine } from './types.js';

export type DailyTokenCliffsDeltaHalvesSort =
  | 'absDeltaDesc'
  | 'ciHalfWidth'
  | 'absDeltaDescCiExcludesZero'
  | 'tokens'
  | 'tenure'
  | 'source';

export type CliffsDeltaDecision =
  | 'significant-large'
  | 'significant-medium'
  | 'significant-small'
  | 'significant-negligible'
  | 'ns';

export interface DailyTokenCliffsDeltaHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCliffsDeltaHalvesSort;
  /** Number of bootstrap resamples (default 999). */
  nBoot?: number;
  /** Two-sided alpha for the percentile CI (default 0.05 -> 95% CI). */
  alpha?: number;
  generatedAt?: string;
}

export interface DailyTokenCliffsDeltaHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  cdMSize: number;
  cdNSize: number;
  cdNGreater: number;
  cdNLess: number;
  cdNEqual: number;
  cdDelta: number;
  cdAbsDelta: number;
  cdMagnitude: 'negligible' | 'small' | 'medium' | 'large';
  cdSign: -1 | 0 | 1;
  cdCiLow: number;
  cdCiHigh: number;
  cdCiHalfWidth: number;
  cdCiExcludesZero: boolean;
  cdNBoot: number;
  cdAlpha: number;
  cdDecision: CliffsDeltaDecision;
}

export interface DailyTokenCliffsDeltaHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCliffsDeltaHalvesSort;
  source: string | null;
  nBoot: number;
  alpha: number;
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
  sources: DailyTokenCliffsDeltaHalvesSourceRow[];
}

/** Cliff's delta magnitude bucket per Romano-Coraggio-Skowronski 2006. */
export function cliffsDeltaMagnitude(
  absDelta: number,
): 'negligible' | 'small' | 'medium' | 'large' {
  if (!Number.isFinite(absDelta) || absDelta < 0 || absDelta > 1) {
    throw new Error(
      `cliffsDeltaMagnitude: |delta| must be in [0, 1] (got ${absDelta})`,
    );
  }
  if (absDelta >= 0.474) return 'large';
  if (absDelta >= 0.33) return 'medium';
  if (absDelta >= 0.147) return 'small';
  return 'negligible';
}

/** CI-exclusion-of-zero crossed with magnitude. */
export function cliffsDeltaDecision(
  delta: number,
  ciLow: number,
  ciHigh: number,
): CliffsDeltaDecision {
  if (!Number.isFinite(delta) || delta < -1 || delta > 1) {
    throw new Error(
      `cliffsDeltaDecision: delta must be in [-1, 1] (got ${delta})`,
    );
  }
  if (!Number.isFinite(ciLow) || !Number.isFinite(ciHigh)) {
    throw new Error('cliffsDeltaDecision: CI endpoints must be finite');
  }
  if (ciLow > ciHigh) {
    throw new Error(
      `cliffsDeltaDecision: ciLow (${ciLow}) must be <= ciHigh (${ciHigh})`,
    );
  }
  const excludesZero = ciLow > 0 || ciHigh < 0;
  if (!excludesZero) return 'ns';
  const mag = cliffsDeltaMagnitude(Math.abs(delta));
  if (mag === 'large') return 'significant-large';
  if (mag === 'medium') return 'significant-medium';
  if (mag === 'small') return 'significant-small';
  return 'significant-negligible';
}

/**
 * Direct O(m*n) Cliff's delta point estimate. Returns
 * dominance counts and the unit-free delta in [-1, +1].
 * Sign convention: deltaHat > 0 means sample B
 * stochastically dominates sample A.
 */
export function cliffsDelta(
  sampleA: number[],
  sampleB: number[],
): {
  nGreater: number;
  nLess: number;
  nEqual: number;
  delta: number;
} {
  const m = sampleA.length;
  const n = sampleB.length;
  if (m === 0 || n === 0) {
    throw new Error(
      `cliffsDelta: both samples must be non-empty (got m=${m}, n=${n})`,
    );
  }
  let nGreater = 0;
  let nLess = 0;
  let nEqual = 0;
  for (let i = 0; i < m; i += 1) {
    const ai = sampleA[i]!;
    if (!Number.isFinite(ai)) {
      throw new Error('cliffsDelta: sampleA must be finite');
    }
    for (let j = 0; j < n; j += 1) {
      const bj = sampleB[j]!;
      if (!Number.isFinite(bj)) {
        throw new Error('cliffsDelta: sampleB must be finite');
      }
      if (bj > ai) nGreater += 1;
      else if (bj < ai) nLess += 1;
      else nEqual += 1;
    }
  }
  const total = m * n;
  const delta = (nGreater - nLess) / total;
  return { nGreater, nLess, nEqual, delta };
}

/** Mulberry32 PRNG seeded by a string (deterministic for reproducible CI). */
export function makeMulberry32(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h >>> 0;
  return function rand(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap percentile CI for Cliff's delta. Resamples
 * A and B with replacement nBoot times. Returns the
 * (alpha/2, 1-alpha/2) percentiles of the bootstrap
 * deltaHat* distribution. Deterministic given the seed.
 */
export function cliffsDeltaBootstrapCi(
  sampleA: number[],
  sampleB: number[],
  nBoot: number,
  alpha: number,
  rng: () => number,
): { ciLow: number; ciHigh: number; bootDeltas: number[] } {
  if (!Number.isInteger(nBoot) || nBoot < 99) {
    throw new Error(
      `cliffsDeltaBootstrapCi: nBoot must be an integer >= 99 (got ${nBoot})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(
      `cliffsDeltaBootstrapCi: alpha must be in (0, 1) (got ${alpha})`,
    );
  }
  const m = sampleA.length;
  const n = sampleB.length;
  const bootDeltas: number[] = new Array(nBoot);
  const aResample = new Array<number>(m);
  const bResample = new Array<number>(n);
  for (let b = 0; b < nBoot; b += 1) {
    for (let i = 0; i < m; i += 1) {
      aResample[i] = sampleA[Math.floor(rng() * m)]!;
    }
    for (let j = 0; j < n; j += 1) {
      bResample[j] = sampleB[Math.floor(rng() * n)]!;
    }
    const { delta } = cliffsDelta(aResample, bResample);
    bootDeltas[b] = delta;
  }
  const sorted = bootDeltas.slice().sort((a, b) => a - b);
  const loIdx = Math.max(
    0,
    Math.min(nBoot - 1, Math.floor((alpha / 2) * nBoot)),
  );
  const hiIdx = Math.max(
    0,
    Math.min(nBoot - 1, Math.ceil((1 - alpha / 2) * nBoot) - 1),
  );
  return {
    ciLow: sorted[loIdx]!,
    ciHigh: sorted[hiIdx]!,
    bootDeltas,
  };
}

/**
 * Cliff's delta on a contiguous-half split. Drops the
 * median day if N odd. Returns the dominance split,
 * point estimate, and the bootstrap percentile CI.
 */
export function dailyTokenCliffsDeltaHalves(
  values: number[],
  opts: { nBoot?: number; alpha?: number; seed?: string } = {},
): {
  m: number;
  n: number;
  nGreater: number;
  nLess: number;
  nEqual: number;
  delta: number;
  ciLow: number;
  ciHigh: number;
  ciHalfWidth: number;
  ciExcludesZero: boolean;
  nBoot: number;
  alpha: number;
} {
  const N = values.length;
  if (N < 16) {
    throw new Error(
      `dailyTokenCliffsDeltaHalves: need at least 16 samples (got ${N})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenCliffsDeltaHalves: requires finite values');
    }
  }
  const nBoot = opts.nBoot ?? 999;
  const alpha = opts.alpha ?? 0.05;
  let trimmed: number[];
  if (N % 2 === 1) {
    const mid = (N - 1) >>> 1;
    trimmed = values.slice(0, mid).concat(values.slice(mid + 1));
  } else {
    trimmed = values.slice();
  }
  const half = trimmed.length / 2;
  const sampleA = trimmed.slice(0, half);
  const sampleB = trimmed.slice(half);
  const { nGreater, nLess, nEqual, delta } = cliffsDelta(sampleA, sampleB);
  const rng = makeMulberry32(opts.seed ?? 'cliffs-delta-halves');
  const { ciLow, ciHigh } = cliffsDeltaBootstrapCi(
    sampleA,
    sampleB,
    nBoot,
    alpha,
    rng,
  );
  const ciHalfWidth = (ciHigh - ciLow) / 2;
  const ciExcludesZero = ciLow > 0 || ciHigh < 0;
  return {
    m: half,
    n: half,
    nGreater,
    nLess,
    nEqual,
    delta,
    ciLow,
    ciHigh,
    ciHalfWidth,
    ciExcludesZero,
    nBoot,
    alpha,
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

export function buildDailyTokenCliffsDeltaHalves(
  queue: QueueLine[],
  opts: DailyTokenCliffsDeltaHalvesOptions = {},
): DailyTokenCliffsDeltaHalvesReport {
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
  const nBoot = opts.nBoot ?? 999;
  if (!Number.isInteger(nBoot) || nBoot < 99) {
    throw new Error(
      `nBoot must be an integer >= 99 (got ${opts.nBoot})`,
    );
  }
  const alpha = opts.alpha ?? 0.05;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(`alpha must be in (0, 1) (got ${opts.alpha})`);
  }
  const sort: DailyTokenCliffsDeltaHalvesSort = opts.sort ?? 'absDeltaDesc';
  const validSorts: DailyTokenCliffsDeltaHalvesSort[] = [
    'absDeltaDesc',
    'ciHalfWidth',
    'absDeltaDescCiExcludesZero',
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
  const rows: DailyTokenCliffsDeltaHalvesSourceRow[] = [];

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
      result = dailyTokenCliffsDeltaHalves(filled, {
        nBoot,
        alpha,
        seed: `cliffs-delta-halves:${src}`,
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const sign: -1 | 0 | 1 =
      result.delta > 0 ? 1 : result.delta < 0 ? -1 : 0;
    const absDelta = Math.abs(result.delta);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      cdMSize: result.m,
      cdNSize: result.n,
      cdNGreater: result.nGreater,
      cdNLess: result.nLess,
      cdNEqual: result.nEqual,
      cdDelta: result.delta,
      cdAbsDelta: absDelta,
      cdMagnitude: cliffsDeltaMagnitude(absDelta),
      cdSign: sign,
      cdCiLow: result.ciLow,
      cdCiHigh: result.ciHigh,
      cdCiHalfWidth: result.ciHalfWidth,
      cdCiExcludesZero: result.ciExcludesZero,
      cdNBoot: result.nBoot,
      cdAlpha: result.alpha,
      cdDecision: cliffsDeltaDecision(
        result.delta,
        result.ciLow,
        result.ciHigh,
      ),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'absDeltaDesc':
        primary = b.cdAbsDelta - a.cdAbsDelta;
        break;
      case 'ciHalfWidth':
        primary = a.cdCiHalfWidth - b.cdCiHalfWidth;
        break;
      case 'absDeltaDescCiExcludesZero':
        if (a.cdCiExcludesZero !== b.cdCiExcludesZero) {
          primary = a.cdCiExcludesZero ? -1 : 1;
        } else {
          primary = b.cdAbsDelta - a.cdAbsDelta;
        }
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
    nBoot,
    alpha,
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
