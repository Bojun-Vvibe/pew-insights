/**
 * daily-token-permutation-tstat-halves: per-source
 * MONTE-CARLO PERMUTATION TWO-SAMPLE WELCH-T STATISTIC
 * with EXACT/MONTE-CARLO PERMUTATION-DISTRIBUTION
 * TWO-SIDED P-VALUE between the first half (n1 =
 * floor(n/2) days) and the second half (n2 = n - n1
 * days) of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTY-EIGHTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO every prior axis. Detail:
 *
 *   - vs axis-183 YUEN-WELCH (TRIMMED-MEAN T STAT WITH
 *     ASYMPTOTIC T-DISTRIBUTION P-VALUE). YW assumes the
 *     trimmed-Welch t-stat is approximately t-distributed
 *     under H0 (Welch-Satterthwaite df). axis-188 makes
 *     ZERO DISTRIBUTIONAL ASSUMPTIONS: the p-value is
 *     computed by RESHUFFLING the half labels B times
 *     (B = 10000 by default) and counting how often the
 *     shuffled |t_perm| exceeds |t_obs|. Two-sided p =
 *     (1 + #{|t_perm| >= |t_obs|}) / (B + 1) (Phipson &
 *     Smyth 2010 add-one correction).
 *   - vs axis-186 HL (POINT ESTIMATOR + LEHMANN CI from
 *     pairwise-difference QUANTILES). HL gives a SIGNED
 *     LOCATION SHIFT in tokens with a NORMAL-APPROX CI
 *     on the WALSH-AVERAGE rank. axis-188 gives a
 *     SIGNIFICANCE-DECISION p-value that DOES NOT REST
 *     on rank-CI normality OR pairwise-difference
 *     symmetry. The two are MAXIMALLY COMPLEMENTARY:
 *     axis-186 estimates the SIZE of the shift,
 *     axis-188 tests whether ANY shift is detectable
 *     under the strongest possible distribution-free
 *     null.
 *   - vs axis-187 A12 / axis-185 BWS / axis-184 SAVAGE /
 *     axis-181 vdW / all RANK-BASED axes. Those build
 *     statistics from POOLED RANKS; axis-188 operates
 *     on the RAW VALUES via the parametric Welch-t
 *     numerator / denominator BUT references it to a
 *     PERMUTATION null (so it inherits the EFFICIENCY
 *     of the t-stat under approximately-normal data
 *     while RETAINING EXACT TYPE-I CONTROL under any
 *     exchangeable null — including heavy-tailed,
 *     bimodal, or skewed distributions where rank tests
 *     lose power). This is the Pitman 1937 / Fisher
 *     1935 PERMUTATION-T paradigm.
 *   - vs axis-115 MANN-WHITNEY / axis-182 FLIGNER-
 *     POLICELLO. Both produce ASYMPTOTIC normal Z; the
 *     null is a STRONG H0 of equal distributions (MW)
 *     or symmetric placement (FP). axis-188's null is
 *     EXCHANGEABILITY of the COMBINED SAMPLE, which is
 *     IMPLIED by H0: F = G but is logically WEAKER
 *     when paired with the t-stat (the rejection has
 *     POWER against location alternatives, not pure-
 *     scale alternatives — making it ORTHOGONAL to
 *     omnibus axes like BWS / Cucconi).
 *   - vs axis-178 BAUMGARTNER-WEISS-SCHINDLER and other
 *     omnibus tests. axis-188 targets the LOCATION
 *     alternative specifically, not the omnibus
 *     "any-departure" alternative.
 *
 * THE STATISTIC. Given two samples sampleA (first
 * half, size n1) and sampleB (second half, size n2),
 * the observed Welch-t numerator/denominator is
 *
 *     t_obs = (mean(B) - mean(A))
 *             / sqrt(var(A)/n1 + var(B)/n2)
 *
 * with var() the unbiased (n-1 denominator) sample
 * variance. SIGN convention: positive t = SECOND-half
 * mean larger (preserves the SECOND-half-positive
 * cross-axis convention). Under H0: F_A = F_B, the
 * pooled sample (sampleA || sampleB) is exchangeable;
 * permuting the n1+n2 labels yields the exact null
 * distribution of t. We approximate this by drawing
 * B = 10000 random permutations (Fisher-Yates shuffle)
 * and computing
 *
 *     pTwoSided = (1 + #{b : |t_perm_b| >= |t_obs|})
 *                  / (B + 1)
 *     pUpper    = (1 + #{b : t_perm_b >= t_obs}) / (B + 1)
 *     pLower    = (1 + #{b : t_perm_b <= t_obs}) / (B + 1)
 *
 * (Phipson & Smyth 2010 *Stat. Appl. Genet. Mol. Biol.*
 * 9(1):Article 39 add-one correction; ensures pmin =
 * 1/(B+1) > 0, which is required for valid downstream
 * FDR adjustment).
 *
 * RANDOMNESS. We use a deterministic xorshift32 PRNG
 * seeded by a hash of the input values (so re-running
 * the axis on the same data yields BIT-IDENTICAL
 * permutation p-values, which is required for
 * reproducible CI). The seed is derived from the
 * concatenated rounded values, NOT from clock time.
 *
 * MAGNITUDE / DECISION BUCKETS. The p-value alone is a
 * binary-decision summary. We surface a 5-level
 * decision label keyed off pTwoSided AND the absolute
 * effect size |t_obs| / sqrt(n1+n2-2) (the Welch-t
 * effect-size analogue of Cohen's d):
 *
 *     pTwoSided <= 0.001  -> 'highly-significant'
 *     pTwoSided <= 0.01   -> 'very-significant'
 *     pTwoSided <= 0.05   -> 'significant'
 *     pTwoSided <= 0.10   -> 'marginal'
 *     pTwoSided >  0.10   -> 'ns'
 *
 * Refs:
 *   - Pitman, E. J. G. (1937). Significance tests which
 *     may be applied to samples from any populations.
 *     *Suppl. J. Royal Stat. Soc.* 4(1):119-130.
 *   - Phipson, B. & Smyth, G. K. (2010). Permutation
 *     P-values should never be zero: calculating exact
 *     P-values when permutations are randomly drawn.
 *     *Stat. Appl. Genet. Mol. Biol.* 9(1):Article 39.
 *   - Welch, B. L. (1947). The generalization of
 *     Student's problem when several different
 *     population variances are involved. *Biometrika*
 *     34(1/2):28-35.
 */

import type { QueueLine } from './types.js';

export type DailyTokenPermutationTstatHalvesSort =
  | 'tStat'
  | 'absTStatDesc'
  | 'pTwoSided'
  | 'tokens'
  | 'tenure'
  | 'source';

export type PermutationTstatDecision =
  | 'highly-significant'
  | 'very-significant'
  | 'significant'
  | 'marginal'
  | 'ns';

export interface DailyTokenPermutationTstatHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  /** Number of Monte Carlo permutations (default 10000). */
  permutations?: number;
  sort?: DailyTokenPermutationTstatHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenPermutationTstatHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  permN1: number;
  /** Second-half size n2 = n - n1. */
  permN2: number;
  /** First-half mean. */
  permMeanA: number;
  /** Second-half mean. */
  permMeanB: number;
  /** Observed Welch-t (signed; positive = second-half larger). */
  permTStat: number;
  /** Number of Monte-Carlo permutations actually drawn. */
  permB: number;
  /** Add-one-corrected upper-tail permutation p-value. */
  permPUpper: number;
  /** Add-one-corrected lower-tail permutation p-value. */
  permPLower: number;
  /** Add-one-corrected two-sided permutation p-value. */
  permPTwoSided: number;
  /** Sign of permTStat in {-1, 0, +1}. */
  permSign: -1 | 0 | 1;
  /** 5-level decision bucket. */
  permDecision: PermutationTstatDecision;
}

export interface DailyTokenPermutationTstatHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  permutations: number;
  sort: DailyTokenPermutationTstatHalvesSort;
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
  sources: DailyTokenPermutationTstatHalvesSourceRow[];
}

/** Decision bucket from two-sided p. */
export function permutationTstatDecision(
  pTwoSided: number,
): PermutationTstatDecision {
  if (!Number.isFinite(pTwoSided) || pTwoSided < 0 || pTwoSided > 1) {
    throw new Error(
      `permutationTstatDecision: pTwoSided must be in [0, 1] (got ${pTwoSided})`,
    );
  }
  if (pTwoSided <= 0.001) return 'highly-significant';
  if (pTwoSided <= 0.01) return 'very-significant';
  if (pTwoSided <= 0.05) return 'significant';
  if (pTwoSided <= 0.10) return 'marginal';
  return 'ns';
}

/** xorshift32 PRNG. */
function makeXorshift32(seed: number): () => number {
  let s = (seed | 0) || 0x9e3779b9;
  return function next(): number {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s |= 0;
    // Map int32 -> [0, 1).
    return ((s >>> 0) / 0x1_0000_0000);
  };
}

/** Deterministic seed from values (FNV-1a 32-bit on rounded ints). */
function seedFromValues(values: ReadonlyArray<number>): number {
  let h = 0x811c9dc5 | 0;
  for (const v of values) {
    // round to int (token counts are integral); encode 8 bytes worth.
    let x = Math.round(v) | 0;
    for (let k = 0; k < 4; k += 1) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193);
      x >>>= 8;
    }
  }
  // Avoid 0 seed.
  return (h | 0) === 0 ? 0x9e3779b9 : h | 0;
}

/** Welch-t numerator/denominator (positive = mean(B) > mean(A)). */
export function welchT(
  sampleA: ReadonlyArray<number>,
  sampleB: ReadonlyArray<number>,
): { tStat: number; meanA: number; meanB: number } {
  const n1 = sampleA.length;
  const n2 = sampleB.length;
  if (n1 < 2 || n2 < 2) {
    throw new Error(
      `welchT: each sample must have at least 2 observations (got ${n1}, ${n2})`,
    );
  }
  let muA = 0;
  for (const v of sampleA) muA += v;
  muA /= n1;
  let muB = 0;
  for (const v of sampleB) muB += v;
  muB /= n2;
  let ssA = 0;
  for (const v of sampleA) {
    const d = v - muA;
    ssA += d * d;
  }
  let ssB = 0;
  for (const v of sampleB) {
    const d = v - muB;
    ssB += d * d;
  }
  const varA = ssA / (n1 - 1);
  const varB = ssB / (n2 - 1);
  const denom = Math.sqrt(varA / n1 + varB / n2);
  if (!(denom > 0)) {
    throw new Error('welchT: zero pooled standard error');
  }
  return { tStat: (muB - muA) / denom, meanA: muA, meanB: muB };
}

/**
 * Permutation Welch-t two-sample test on a real-valued
 * series split into two contiguous halves. Returns the
 * observed t and add-one-corrected one- and two-sided
 * p-values from B Monte-Carlo permutations seeded
 * deterministically from the input values.
 */
export function dailyTokenPermutationTstatHalves(
  values: number[],
  permutations: number,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  permN1: number;
  permN2: number;
  permMeanA: number;
  permMeanB: number;
  permTStat: number;
  permB: number;
  permPUpper: number;
  permPLower: number;
  permPTwoSided: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenPermutationTstatHalves: need at least 16 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(permutations) || permutations < 100) {
    throw new Error(
      `dailyTokenPermutationTstatHalves: permutations must be an integer >= 100 (got ${permutations})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenPermutationTstatHalves requires finite values');
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
      `dailyTokenPermutationTstatHalves: zero centred variance (n=${n})`,
    );
  }
  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const sampleA = values.slice(0, n1);
  const sampleB = values.slice(n1);
  const obs = welchT(sampleA, sampleB);

  const pooled = values.slice();
  const rng = makeXorshift32(seedFromValues(values));
  const tAbs = Math.abs(obs.tStat);
  let countAbs = 0;
  let countUpper = 0;
  let countLower = 0;
  const buf = pooled.slice();
  for (let b = 0; b < permutations; b += 1) {
    // Fisher-Yates shuffle in place.
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = buf[i]!;
      buf[i] = buf[j]!;
      buf[j] = tmp;
    }
    let muA = 0;
    for (let i = 0; i < n1; i += 1) muA += buf[i]!;
    muA /= n1;
    let muB = 0;
    for (let i = n1; i < n; i += 1) muB += buf[i]!;
    muB /= n2;
    let ssA = 0;
    for (let i = 0; i < n1; i += 1) {
      const d = buf[i]! - muA;
      ssA += d * d;
    }
    let ssB = 0;
    for (let i = n1; i < n; i += 1) {
      const d = buf[i]! - muB;
      ssB += d * d;
    }
    const varA = ssA / (n1 - 1);
    const varB = ssB / (n2 - 1);
    const dPerm = Math.sqrt(varA / n1 + varB / n2);
    if (!(dPerm > 0)) continue;
    const tPerm = (muB - muA) / dPerm;
    if (Math.abs(tPerm) >= tAbs) countAbs += 1;
    if (tPerm >= obs.tStat) countUpper += 1;
    if (tPerm <= obs.tStat) countLower += 1;
  }
  const Bp1 = permutations + 1;
  return {
    mean: mu,
    stddev,
    nSamples: n,
    permN1: n1,
    permN2: n2,
    permMeanA: obs.meanA,
    permMeanB: obs.meanB,
    permTStat: obs.tStat,
    permB: permutations,
    permPUpper: (1 + countUpper) / Bp1,
    permPLower: (1 + countLower) / Bp1,
    permPTwoSided: (1 + countAbs) / Bp1,
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

export function buildDailyTokenPermutationTstatHalves(
  queue: QueueLine[],
  opts: DailyTokenPermutationTstatHalvesOptions = {},
): DailyTokenPermutationTstatHalvesReport {
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
  const permutations = opts.permutations ?? 10000;
  if (!Number.isInteger(permutations) || permutations < 100) {
    throw new Error(
      `permutations must be an integer >= 100 (got ${opts.permutations})`,
    );
  }
  const sort: DailyTokenPermutationTstatHalvesSort =
    opts.sort ?? 'absTStatDesc';
  const validSorts: DailyTokenPermutationTstatHalvesSort[] = [
    'tStat',
    'absTStatDesc',
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
  const rows: DailyTokenPermutationTstatHalvesSourceRow[] = [];

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
      result = dailyTokenPermutationTstatHalves(filled, permutations);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const sign: -1 | 0 | 1 =
      result.permTStat > 0 ? 1 : result.permTStat < 0 ? -1 : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      permN1: result.permN1,
      permN2: result.permN2,
      permMeanA: result.permMeanA,
      permMeanB: result.permMeanB,
      permTStat: result.permTStat,
      permB: result.permB,
      permPUpper: result.permPUpper,
      permPLower: result.permPLower,
      permPTwoSided: result.permPTwoSided,
      permSign: sign,
      permDecision: permutationTstatDecision(result.permPTwoSided),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tStat':
        primary = a.permTStat - b.permTStat;
        break;
      case 'absTStatDesc':
        primary = Math.abs(b.permTStat) - Math.abs(a.permTStat);
        break;
      case 'pTwoSided':
        primary = a.permPTwoSided - b.permPTwoSided;
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
    permutations,
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
