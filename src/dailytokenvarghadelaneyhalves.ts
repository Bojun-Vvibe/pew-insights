/**
 * daily-token-vargha-delaney-halves: per-source
 * VARGHA-DELANEY 2000 A12 PROBABILITY-OF-SUPERIORITY
 * EFFECT-SIZE STATISTIC between the first half (n1 =
 * floor(n/2) days) and the second half (n2 = n - n1 days)
 * of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTY-SEVENTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO every prior axis. Detail:
 *
 *   - vs axis-115 MANN-WHITNEY (TEST STATISTIC). MW
 *     reports a Z and an asymptotic p-value. A12 reports
 *     a SCALE-FREE EFFECT SIZE in [0, 1] with a direct
 *     PROBABILISTIC INTERPRETATION (A12 = 0.62 means the
 *     second-half day picked at random has a 62% chance
 *     of exceeding a randomly picked first-half day). The
 *     two are deterministically related (A12 = U2 / (n1
 *     n2) with U2 the Mann-Whitney U for the second
 *     sample), but A12 is the EFFECT-SIZE INTERPRETATION
 *     while MW is the SIGNIFICANCE-DECISION
 *     interpretation; they answer different questions.
 *   - vs axis-186 HODGES-LEHMANN SHIFT (POINT ESTIMATOR
 *     in token units). HL gives the median shift in raw
 *     tokens; A12 gives the probability-of-superiority on
 *     a SCALE-FREE [0, 1] axis. Two sources with very
 *     different token volumes are DIRECTLY COMPARABLE on
 *     A12 but NOT on hlDelta.
 *   - vs axis-184 SAVAGE / axis-181 vdW / axis-183 YW
 *     (location TEST statistics with various score
 *     functions). All produce z-scores with parametric
 *     null references. A12 is a NON-PARAMETRIC
 *     EFFECT-SIZE summary; it has no null reference per se
 *     and no associated p-value -- only thresholds for
 *     small / medium / large effects.
 *   - vs axis-185 BWS (omnibus location-AND-scale test)
 *     and axis-174 CUCCONI (omnibus location-AND-scale
 *     test). Those reject under any departure; A12 is a
 *     ONE-DIRECTIONAL location-only EFFECT-SIZE (and is
 *     INSENSITIVE to pure-scale departures: a sample
 *     symmetric around the same median as another sample
 *     yields A12 ~ 0.5 even with very different
 *     variances).
 *
 * THE STATISTIC. (Vargha & Delaney 2000 *J. Educational
 * and Behavioral Statistics* 25(2):101-132.)
 *
 *     A12 = (1 / (n1 * n2)) * sum_{i,j} ind(y_j > x_i)
 *           + 0.5 * (1 / (n1 * n2)) * sum_{i,j} ind(y_j == x_i)
 *
 * Equivalently, in mid-rank form: let R_y = sum of pooled
 * mid-ranks for the Y (second-half) sample. Then
 *
 *     A12 = (R_y / n2 - (n2 + 1) / 2) / n1
 *
 * (Vargha-Delaney eq. 14). A12 in [0, 1]; A12 = 0.5 means
 * STOCHASTIC EQUALITY (no superiority either way); A12 >
 * 0.5 means the SECOND half is stochastically larger, in
 * line with the SECOND-half-positive convention shared by
 * every prior halves axis.
 *
 * MAGNITUDE BUCKETS (Vargha & Delaney 2000 Table 3,
 * after Cohen 1988). For two-sided centred A12:
 *
 *     |A12 - 0.5| < 0.06  -> 'negligible'
 *     0.06 <= |A12 - 0.5| < 0.14 -> 'small'
 *     0.14 <= |A12 - 0.5| < 0.21 -> 'medium'
 *     0.21 <= |A12 - 0.5|       -> 'large'
 *
 * STANDARD ERROR. We use the BRUNNER-MUNZEL 2000
 * (*Biometrics* 56:1129-1135) closed-form SE for
 * P(Y > X) + 0.5 P(Y == X), which does NOT assume
 * identical-shape distributions:
 *
 *     sigma1^2 = (1/(n1-1)) sum_i (R_x_i - Rbar_x - (i_x - (n1+1)/2))^2
 *                  / (n1 + n2)^2
 *     sigma2^2 = (1/(n2-1)) sum_j (R_y_j - Rbar_y - (j_y - (n2+1)/2))^2
 *                  / (n1 + n2)^2
 *     SE(A) = sqrt( sigma1^2 / n1 + sigma2^2 / n2 )
 *
 * with R_x_i / R_y_j the pooled mid-ranks and i_x / j_y
 * the within-sample mid-ranks. We report an asymptotic
 * 95% CI [A - 1.96 SE, A + 1.96 SE], CLAMPED to [0, 1].
 *
 * Refs:
 *   - Vargha, A. & Delaney, H. D. (2000). A critique and
 *     improvement of the CL common language effect size
 *     statistics of McGraw and Wong. *J. Educational and
 *     Behavioral Statistics* 25(2):101-132.
 *   - Brunner, E. & Munzel, U. (2000). The nonparametric
 *     Behrens-Fisher problem: asymptotic theory and a
 *     small-sample approximation. *Biometrics*
 *     56:1129-1135.
 */

import type { QueueLine } from './types.js';

export type DailyTokenVarghaDelaneyHalvesSort =
  | 'a12'
  | 'a12Desc'
  | 'a12CenteredAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type VarghaDelaneyMagnitude =
  | 'negligible'
  | 'small'
  | 'medium'
  | 'large';

export interface DailyTokenVarghaDelaneyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenVarghaDelaneyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenVarghaDelaneyHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  vdN1: number;
  /** Second-half size n2 = n - n1. */
  vdN2: number;
  /** Vargha-Delaney A12 probability of superiority in [0, 1]. */
  vdA12: number;
  /** Centred effect: A12 - 0.5 in [-0.5, +0.5]. */
  vdA12Centered: number;
  /** Brunner-Munzel asymptotic SE. */
  vdSe: number;
  /** Asymptotic 95% CI lower bound, clamped to [0, 1]. */
  vdCiLow: number;
  /** Asymptotic 95% CI upper bound, clamped to [0, 1]. */
  vdCiHigh: number;
  /** True iff 0.5 is strictly outside [vdCiLow, vdCiHigh]. */
  vdCiExcludesHalf: boolean;
  /** Vargha-Delaney 2000 Table 3 magnitude bucket. */
  vdMagnitude: VarghaDelaneyMagnitude;
  /** Sign of (A12 - 0.5) in {-1, 0, +1}. */
  vdSign: -1 | 0 | 1;
}

export interface DailyTokenVarghaDelaneyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenVarghaDelaneyHalvesSort;
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
  sources: DailyTokenVarghaDelaneyHalvesSourceRow[];
}

/** Pooled mid-ranks (1-based, average for ties). */
export function midRanksVd(values: ReadonlyArray<number>): number[] {
  const n = values.length;
  if (n === 0) return [];
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) j += 1;
    const avg = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k]!] = avg;
    i = j + 1;
  }
  return ranks;
}

/** Vargha-Delaney 2000 Table 3 magnitude bucket. */
export function varghaDelaneyMagnitude(a12: number): VarghaDelaneyMagnitude {
  if (!Number.isFinite(a12)) {
    throw new Error(`varghaDelaneyMagnitude: a12 must be finite (got ${a12})`);
  }
  const d = Math.abs(a12 - 0.5);
  if (d < 0.06) return 'negligible';
  if (d < 0.14) return 'small';
  if (d < 0.21) return 'medium';
  return 'large';
}

/**
 * Vargha-Delaney A12 probability-of-superiority statistic
 * for two samples (sampleB stochastically-larger semantics:
 * A12 > 0.5 iff sampleB tends to exceed sampleA), with
 * Brunner-Munzel 2000 closed-form asymptotic SE.
 */
export function varghaDelaneyStatistic(
  sampleA: ReadonlyArray<number>,
  sampleB: ReadonlyArray<number>,
): {
  vdA12: number;
  vdSe: number;
  vdCiLow: number;
  vdCiHigh: number;
} {
  const n1 = sampleA.length;
  const n2 = sampleB.length;
  if (n1 < 2 || n2 < 2) {
    throw new Error(
      `varghaDelaneyStatistic: each sample must have at least 2 observations (got ${n1}, ${n2})`,
    );
  }
  for (const v of sampleA) {
    if (!Number.isFinite(v)) {
      throw new Error('varghaDelaneyStatistic: sampleA must be all finite');
    }
  }
  for (const v of sampleB) {
    if (!Number.isFinite(v)) {
      throw new Error('varghaDelaneyStatistic: sampleB must be all finite');
    }
  }

  // Direct count: A12 = (1/(n1 n2)) sum_{i,j} [ ind(y_j > x_i) + 0.5 ind(y_j == x_i) ].
  let wins = 0;
  let ties = 0;
  for (let i = 0; i < n1; i += 1) {
    const ai = sampleA[i]!;
    for (let j = 0; j < n2; j += 1) {
      const bj = sampleB[j]!;
      if (bj > ai) wins += 1;
      else if (bj === ai) ties += 1;
    }
  }
  const a12 = (wins + 0.5 * ties) / (n1 * n2);

  // Brunner-Munzel 2000 SE for the placement statistic.
  // Pooled mid-ranks Rx, Ry over the combined sample.
  const N = n1 + n2;
  const pooled = new Array<number>(N);
  for (let i = 0; i < n1; i += 1) pooled[i] = sampleA[i]!;
  for (let j = 0; j < n2; j += 1) pooled[n1 + j] = sampleB[j]!;
  const pooledRanks = midRanksVd(pooled);
  const pooledRx = pooledRanks.slice(0, n1);
  const pooledRy = pooledRanks.slice(n1);
  // Within-sample mid-ranks.
  const withinRx = midRanksVd(sampleA);
  const withinRy = midRanksVd(sampleB);

  let RbarX = 0;
  for (const r of pooledRx) RbarX += r;
  RbarX /= n1;
  let RbarY = 0;
  for (const r of pooledRy) RbarY += r;
  RbarY /= n2;

  let s1Sum = 0;
  for (let i = 0; i < n1; i += 1) {
    const d = pooledRx[i]! - withinRx[i]! - RbarX + (n1 + 1) / 2;
    s1Sum += d * d;
  }
  const sigma1Sq = s1Sum / ((n1 - 1) * N * N);
  let s2Sum = 0;
  for (let j = 0; j < n2; j += 1) {
    const d = pooledRy[j]! - withinRy[j]! - RbarY + (n2 + 1) / 2;
    s2Sum += d * d;
  }
  const sigma2Sq = s2Sum / ((n2 - 1) * N * N);

  const seSq = sigma1Sq / n1 + sigma2Sq / n2;
  const se = seSq > 0 ? Math.sqrt(seSq) * N : 0;
  // Convert from p̂-on-rank-scale to A12-scale: SE on A12 directly
  // is sqrt((sigma1^2 / n1 + sigma2^2 / n2)) * N / (n1 * n2) is wrong.
  // Brunner-Munzel: phat = (Rbar_y - (n2+1)/2) / n1 has SE
  // sqrt(sigma1^2 / n1 + sigma2^2 / n2) where sigmas are the
  // placement variances divided by N as defined above.
  // We use that directly.
  const seA12 = Math.sqrt(sigma1Sq / n1 + sigma2Sq / n2);

  const lo = Math.max(0, a12 - 1.96 * seA12);
  const hi = Math.min(1, a12 + 1.96 * seA12);
  return {
    vdA12: a12,
    vdSe: seA12,
    vdCiLow: lo,
    vdCiHigh: hi,
  };
  // Note: `se` local kept for clarity above; not exported.
  void se;
}

/**
 * Vargha-Delaney A12 on a real-valued series split into
 * two contiguous halves [0..n1-1] and [n1..n-1].
 */
export function dailyTokenVarghaDelaneyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  vdN1: number;
  vdN2: number;
  vdA12: number;
  vdSe: number;
  vdCiLow: number;
  vdCiHigh: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenVarghaDelaneyHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenVarghaDelaneyHalves requires finite values');
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
      `dailyTokenVarghaDelaneyHalves: zero centred variance (n=${n})`,
    );
  }
  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const sampleA = values.slice(0, n1);
  const sampleB = values.slice(n1);
  const r = varghaDelaneyStatistic(sampleA, sampleB);
  return {
    mean: mu,
    stddev,
    nSamples: n,
    vdN1: n1,
    vdN2: n2,
    vdA12: r.vdA12,
    vdSe: r.vdSe,
    vdCiLow: r.vdCiLow,
    vdCiHigh: r.vdCiHigh,
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

export function buildDailyTokenVarghaDelaneyHalves(
  queue: QueueLine[],
  opts: DailyTokenVarghaDelaneyHalvesOptions = {},
): DailyTokenVarghaDelaneyHalvesReport {
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
  const sort: DailyTokenVarghaDelaneyHalvesSort = opts.sort ?? 'a12CenteredAbsDesc';
  const validSorts: DailyTokenVarghaDelaneyHalvesSort[] = [
    'a12',
    'a12Desc',
    'a12CenteredAbsDesc',
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
  const rows: DailyTokenVarghaDelaneyHalvesSourceRow[] = [];

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
      result = dailyTokenVarghaDelaneyHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const a12c = result.vdA12 - 0.5;
    const sign: -1 | 0 | 1 = a12c > 0 ? 1 : a12c < 0 ? -1 : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      vdN1: result.vdN1,
      vdN2: result.vdN2,
      vdA12: result.vdA12,
      vdA12Centered: a12c,
      vdSe: result.vdSe,
      vdCiLow: result.vdCiLow,
      vdCiHigh: result.vdCiHigh,
      vdCiExcludesHalf: result.vdCiLow > 0.5 || result.vdCiHigh < 0.5,
      vdMagnitude: varghaDelaneyMagnitude(result.vdA12),
      vdSign: sign,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'a12':
        primary = a.vdA12 - b.vdA12;
        break;
      case 'a12Desc':
        primary = b.vdA12 - a.vdA12;
        break;
      case 'a12CenteredAbsDesc':
        primary = Math.abs(b.vdA12Centered) - Math.abs(a.vdA12Centered);
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
