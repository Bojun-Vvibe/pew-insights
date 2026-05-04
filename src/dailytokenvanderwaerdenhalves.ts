/**
 * daily-token-van-der-waerden-halves: per-source
 * VAN DER WAERDEN (1952, 1953) NORMAL-SCORES LOCATION
 * TEST for equality of CENTRAL TENDENCY between the
 * first half (n1 = floor(n/2) days) vs second half
 * (n2 = n - n1 days) of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-EIGHTY-FIRST cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO ALL PRIOR SCALE AXES
 * (170 Ansari-Bradley, 174 Cucconi, 175 Lepage, 177
 * Klotz, 178 Conover squared-ranks, 179 Mood, 180
 * Sukhatme): those test EQUALITY OF DISPERSION;
 * Van der Waerden tests EQUALITY OF LOCATION (the
 * complementary first-moment alternative). Mixing a
 * scale family with a location axis is the cleanest
 * structural-orthogonality move available without
 * re-treading existing axes.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Compute the FRACTIONAL POOLED RANK R_k of each
 * observation (mid-rank for ties, k = 1..n). Transform to
 * Van der Waerden NORMAL SCORES via the inverse standard-
 * normal CDF Phi^{-1}:
 *
 *     a_k = Phi^{-1}( R_k / (n + 1) )                (1)
 *
 * The test statistic is the sum of B's normal scores:
 *
 *     T = sum_{k in B} a_k                           (2)
 *
 * Under H0 (equal location, F_A = F_B = F continuous) the
 * exact null moments are
 *
 *     E[T]   = 0                                     (3)
 *     Var[T] = (n1 * n2 / (n * (n - 1))) * sum_k a_k^2
 *
 * giving the asymptotic standardised statistic
 *
 *     vdwZ = T / sqrt(Var[T])  ~ N(0, 1)             (4)
 *
 * (Hajek & Sidak 1967 *Theory of Rank Tests* sec. III.4
 * proved Pitman ARE = 1.000 of the normal-scores
 * location test vs the Student t under normal F — ARE = 1
 * also under any F with finite Fisher information for
 * location, including double-exponential and logistic.
 * This is the ASYMPTOTICALLY OPTIMAL distribution-free
 * location test under normal alternatives, dominating
 * Wilcoxon-Mann-Whitney's ARE 3/pi ~ 0.955.)
 *
 * Two-sided p-value
 *
 *     vdwPValue = 2 * ( 1 - Phi(|vdwZ|) )            (5)
 *
 * SIGN CONVENTION: vdwZ > 0 <=> SECOND half has LARGER
 * central tendency (B's normal scores sum is above null
 * mean 0); vdwZ < 0 <=> FIRST half has larger central
 * tendency. This matches the SECOND-half-positive
 * convention shared with axis-117 stZ, axis-170 abZ,
 * axis-177 klotzZ, axis-178 conoverZ, axis-179 moodZ,
 * axis-180 sukhatmeZ so signed cross-axis aggregation
 * (Stouffer combiners) preserves direction interpretation
 * even when mixing the location axis with the scale axes
 * (positive on both = second half is BIGGER and MORE
 * VARIABLE; opposite signs = sharper diagnostic).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-181):
 *
 *   - vs ALL prior axes 170/174/175/177/178/179/180.
 *     LOCATION vs SCALE. Pure first-moment shift with
 *     equal spreads gives vdwZ != 0 and the entire
 *     scale family ~ 0; pure second-moment shift with
 *     equal medians gives vdwZ ~ 0 (assuming symmetric
 *     F) and the scale family rejects. The two
 *     directions are asymptotically orthogonal under
 *     symmetric F (Hajek & Sidak 1967 Lemma III.4.1).
 *
 *   - vs hypothetical Wilcoxon-Mann-Whitney location
 *     halves (NOT YET IMPLEMENTED; would be axis-182+).
 *     WMW sums RAW pooled mid-ranks; VDW transforms
 *     them through Phi^{-1} first. The transform makes
 *     central scores small (Phi^{-1}(0.5) = 0) and
 *     extreme scores large (Phi^{-1}(0.99) ~ 2.33),
 *     amplifying tail evidence. ARE WMW/VDW = 0.955
 *     under normal F; equal under double-exponential.
 *
 *   - vs hypothetical t-test on raw values. VDW is
 *     DISTRIBUTION-FREE under continuous F (the rank
 *     transform absorbs the marginal); the t-test
 *     requires F approximately normal for nominal
 *     alpha. Under heavy-tailed F (e.g. Cauchy) the
 *     t-test loses control; VDW retains exact alpha.
 *
 *   - vs Mood's median test. Mood collapses each
 *     observation to a binary "above pooled median"
 *     indicator; VDW preserves the full rank ordering.
 *     ARE Mood/VDW = 2/pi ~ 0.637 under normal F.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Hajek & Sidak 1967 Theorem V.1.6.a: actual size
 * 0.046-0.054 across n1 = n2 in [8, 50] under continuous
 * F; the normal-score transform converges to the
 * asymptotic null faster than raw-rank statistics
 * because the scores are bounded in absolute value by
 * Phi^{-1}(n/(n+1)) -> sqrt(2 ln n) as n grows).
 *
 * Reference:
 *   Van der Waerden, B. L., "Order tests for the two-
 *     sample problem and their power", *Indagationes
 *     Mathematicae* 14 (1952), pp. 453-458; 15 (1953),
 *     pp. 303-316.
 *   Hajek, J. & Sidak, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), sec. III.4 and V.1.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods* 3rd ed.
 *     (Wiley 2014), sec. 4.4.
 */
import type { QueueLine } from './types.js';

export type DailyTokenVanDerWaerdenHalvesSort =
  | 'vdwZ'
  | 'vdwZAbsDesc'
  | 'vdwPValue'
  | 'vdwPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenVanDerWaerdenHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Hajek & Sidak 1967 V.1.6.a).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenVanDerWaerdenHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenVanDerWaerdenHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  vdwN1: number;
  /** Second-half size n2 = n - n1. */
  vdwN2: number;
  /** Sum of B's normal scores T = sum_{k in B} a_k. */
  vdwT: number;
  /** Sum of squared normal scores sum_k a_k^2 (denominator basis). */
  vdwSumSquaredScores: number;
  /** Null variance Var[T] = n1 n2 / (n (n-1)) * sum_k a_k^2. */
  vdwVarT: number;
  /** Standardised VDW Z ~ N(0, 1) under H0. */
  vdwZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|vdwZ|)). */
  vdwPValue: number;
}

export interface DailyTokenVanDerWaerdenHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenVanDerWaerdenHalvesSort;
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
  sources: DailyTokenVanDerWaerdenHalvesSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailVdw(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailVdw: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailVdw(-z);
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
 * Inverse standard-normal CDF Phi^{-1}(p) for p in (0, 1)
 * via the Beasley-Springer-Moro 1995 rational
 * approximation; max absolute error ~1.15e-9 across
 * (0, 1). Required for the Van der Waerden normal-score
 * transform a_k = Phi^{-1}( R_k / (n + 1) ).
 *
 * Reference:
 *   Moro, B., "The full Monte", *Risk Magazine* 8(2)
 *     (1995), pp. 57-58. Refines Beasley & Springer
 *     1977 *Applied Statistics* 26:118-121.
 */
export function inverseStandardNormalCdfVdw(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdfVdw: p must be in (0, 1) (got ${p})`,
    );
  }
  // Beasley-Springer central-region rational approximation
  // for |p - 0.5| <= 0.42, then Moro tail expansion.
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(
      ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!
    ) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/**
 * Pooled fractional mid-ranks R_k of `values`, length n.
 * Tied groups receive the average of the integer ranks
 * they would otherwise occupy (standard mid-rank
 * convention used by Hajek & Sidak 1967 sec. III.4 for
 * the normal-scores test).
 */
export function fractionalMidRanksVdw(values: number[]): number[] {
  const n = values.length;
  if (n === 0) {
    throw new Error('fractionalMidRanksVdw: empty input');
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('fractionalMidRanksVdw: non-finite value');
    }
  }
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((i, j) => values[i]! - values[j]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    // Average of integer ranks (i+1) .. j (1-indexed).
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avg;
    i = j;
  }
  return ranks;
}

/**
 * Van der Waerden (1952) NORMAL-SCORES LOCATION test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - vdwZ(x + c) === vdwZ(x) for any constant c
 *     (a constant shift preserves the pooled rank order,
 *     so all normal scores are unchanged).
 *   - vdwZ(a * x) === vdwZ(x) for any a > 0
 *     (positive scale preserves pooled rank order).
 *   - vdwZ(reverse(x)) === -vdwZ(x) WHEN n1 = n2 AND no
 *     ties between halves: reversing swaps A and B,
 *     so T_B becomes T_A = -T_B (since sum of all
 *     normal scores is exactly 0 by symmetry of
 *     Phi^{-1} around p = 0.5).
 *   - For x = repeat(constant) all ranks are
 *     (n + 1) / 2 so all scores are Phi^{-1}(1/2) = 0,
 *     T = 0, Var[T] = 0, vdwZ = 0/0 — we throw on zero
 *     variance to surface this upstream.
 */
export function dailyTokenVanDerWaerdenHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  vdwN1: number;
  vdwN2: number;
  vdwT: number;
  vdwSumSquaredScores: number;
  vdwVarT: number;
  vdwZ: number;
  vdwPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenVanDerWaerdenHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenVanDerWaerdenHalves requires finite values');
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
      `dailyTokenVanDerWaerdenHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const ranks = fractionalMidRanksVdw(values);
  // Normal scores a_k = Phi^{-1}( R_k / (n + 1) ).
  const scores = new Array<number>(n);
  let sumSq = 0;
  for (let k = 0; k < n; k += 1) {
    const p = ranks[k]! / (n + 1);
    const s = inverseStandardNormalCdfVdw(p);
    scores[k] = s;
    sumSq += s * s;
  }
  // T = sum of B's normal scores.
  let T = 0;
  for (let k = n1; k < n; k += 1) T += scores[k]!;

  const varT = ((n1 * n2) / (n * (n - 1))) * sumSq;
  if (!(varT > 0) || !Number.isFinite(varT)) {
    throw new Error(
      `dailyTokenVanDerWaerdenHalves: degenerate null variance (varT=${varT})`,
    );
  }
  const vdwZ = T / Math.sqrt(varT);
  const vdwPValue = 2 * standardNormalUpperTailVdw(Math.abs(vdwZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    vdwN1: n1,
    vdwN2: n2,
    vdwT: T,
    vdwSumSquaredScores: sumSq,
    vdwVarT: varT,
    vdwZ,
    vdwPValue,
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

export function buildDailyTokenVanDerWaerdenHalves(
  queue: QueueLine[],
  opts: DailyTokenVanDerWaerdenHalvesOptions = {},
): DailyTokenVanDerWaerdenHalvesReport {
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
  const sort: DailyTokenVanDerWaerdenHalvesSort = opts.sort ?? 'vdwZAbsDesc';
  const validSorts: DailyTokenVanDerWaerdenHalvesSort[] = [
    'vdwZ',
    'vdwZAbsDesc',
    'vdwPValue',
    'vdwPValueDesc',
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
  const rows: DailyTokenVanDerWaerdenHalvesSourceRow[] = [];

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
      result = dailyTokenVanDerWaerdenHalves(filled);
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
      vdwN1: result.vdwN1,
      vdwN2: result.vdwN2,
      vdwT: result.vdwT,
      vdwSumSquaredScores: result.vdwSumSquaredScores,
      vdwVarT: result.vdwVarT,
      vdwZ: result.vdwZ,
      vdwPValue: result.vdwPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'vdwZ':
        primary = a.vdwZ - b.vdwZ;
        break;
      case 'vdwZAbsDesc':
        primary = Math.abs(b.vdwZ) - Math.abs(a.vdwZ);
        break;
      case 'vdwPValue':
        primary = a.vdwPValue - b.vdwPValue;
        break;
      case 'vdwPValueDesc':
        primary = b.vdwPValue - a.vdwPValue;
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
 * Corpus-level SIGNED aggregator for axis-181 per-source
 * results. Combines per-source SIGNED vdwZ via STOUFFER'S
 * Z-METHOD (Stouffer et al. 1949 *American Soldier* vol.
 * 1, sec. 2.2; Whitlock 2005 *J. Evol. Biol.*
 * 18:1368-1373):
 *
 *     stoufferZ              = sum_i vdwZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * vdwZ is intrinsically signed (positive = second half
 * has LARGER central tendency; negative = first half has
 * larger central tendency). Mirrors the axis-177/178/
 * 179/180 SIGNED scale aggregators so location and scale
 * evidence can be compared elementwise — matching signs
 * across location & scale axes indicate a coherent
 * "second half is bigger AND more variable" narrative;
 * opposite signs indicate "second half drifts UP but
 * tightens" or vice versa, a sharper diagnostic than
 * either family alone.
 *
 * Also returns
 *
 *   - meanVdwZ — unweighted corpus-mean vdwZ
 *   - tenureWeightedMeanVdwZ — nTenureDays-weighted
 *     mean vdwZ (matches the axis-175 v0.6.452 ...
 *     axis-180 v0.6.460 weighting convention)
 *   - rowsUsed, rowsSkipped — counters; malformed rows
 *     (non-finite Z, P outside (0, 1], non-positive
 *     VarT or nTenureDays) are SKIPPED with a counter
 *     rather than throwing.
 */
export interface VanDerWaerdenHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanVdwZ: number;
  tenureWeightedMeanVdwZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateVanDerWaerdenHalves(
  rows: ReadonlyArray<{
    vdwZ: number;
    vdwPValue: number;
    vdwVarT: number;
    nTenureDays: number;
  }>,
): VanDerWaerdenHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.vdwZ) ||
      !Number.isFinite(r.vdwPValue) ||
      r.vdwPValue <= 0 ||
      r.vdwPValue > 1 ||
      !Number.isFinite(r.vdwVarT) ||
      r.vdwVarT <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.vdwZ;
    weightedZSum += r.nTenureDays * r.vdwZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanVdwZ: Number.NaN,
      tenureWeightedMeanVdwZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailVdw(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanVdwZ: zSum / used,
    tenureWeightedMeanVdwZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Directional 5-bucket label classifier for axis-181
 * per-source vdwZ. Maps the signed standardised
 * statistic to one of five mutually-exclusive verdict
 * buckets at configurable two-sided alpha (default 0.05):
 *
 *   - 'second-decisively-larger-location' if vdwZ > 0
 *     AND vdwPValue < alpha
 *   - 'first-decisively-larger-location'  if vdwZ < 0
 *     AND vdwPValue < alpha
 *   - 'second-leans-larger-location' if vdwZ > 0 AND
 *     alpha <= vdwPValue < 2 * alpha (suggestive but
 *     not significant at the chosen level)
 *   - 'first-leans-larger-location'  if vdwZ < 0 AND
 *     alpha <= vdwPValue < 2 * alpha
 *   - 'no-evidence-of-location-shift' otherwise
 *
 * Throws on malformed input (non-finite Z, P outside
 * (0, 1], alpha outside (0, 0.5]).
 */
export type VanDerWaerdenDirectionalLabel =
  | 'second-decisively-larger-location'
  | 'first-decisively-larger-location'
  | 'second-leans-larger-location'
  | 'first-leans-larger-location'
  | 'no-evidence-of-location-shift';

export function labelVanDerWaerdenHalvesRow(
  row: { vdwZ: number; vdwPValue: number },
  alpha = 0.05,
): VanDerWaerdenDirectionalLabel {
  if (!Number.isFinite(row.vdwZ)) {
    throw new Error(
      `labelVanDerWaerdenHalvesRow: vdwZ must be finite (got ${row.vdwZ})`,
    );
  }
  if (
    !Number.isFinite(row.vdwPValue) ||
    row.vdwPValue <= 0 ||
    row.vdwPValue > 1
  ) {
    throw new Error(
      `labelVanDerWaerdenHalvesRow: vdwPValue must be in (0, 1] (got ${row.vdwPValue})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelVanDerWaerdenHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const lean = 2 * alpha;
  if (row.vdwPValue < alpha) {
    return row.vdwZ > 0
      ? 'second-decisively-larger-location'
      : 'first-decisively-larger-location';
  }
  if (row.vdwPValue < lean) {
    return row.vdwZ > 0
      ? 'second-leans-larger-location'
      : 'first-leans-larger-location';
  }
  return 'no-evidence-of-location-shift';
}

/**
 * Cross-axis JOINT location-and-scale combiner. Combines
 * axis-181 (Van der Waerden LOCATION) with axis-180
 * (Sukhatme SCALE) into a single chi-squared statistic
 * with 2 degrees of freedom, mirroring the original
 * Lepage (1971) construction:
 *
 *     jointChi2 = vdwZ^2 + sukhatmeZ^2  ~ Chi^2_2  under H0
 *
 * Under H0 (equal location AND equal scale, F_A = F_B
 * continuous) the two standardised statistics are
 * asymptotically INDEPENDENT under symmetric F (Lepage
 * 1971 *Biometrika* 58:213-217 Thm. 1; Hajek-Sidak 1967
 * Lemma III.4.1) so their squared sum follows the central
 * chi-squared on 2 df.
 *
 * The two-sided p-value uses the closed-form Chi^2_2
 * survival function 1 - F(x) = exp(-x/2) (no series
 * needed — Chi^2_2 is exponential with mean 2):
 *
 *     jointPValue = exp(-jointChi2 / 2)
 *
 * jointDirection summarises the two component signs into
 * a four-quadrant verdict useful for downstream labelling:
 *
 *   - 'larger-and-more-dispersed'  vdwZ>0 AND sukhatmeZ>0
 *   - 'larger-but-less-dispersed'  vdwZ>0 AND sukhatmeZ<0
 *   - 'smaller-and-more-dispersed' vdwZ<0 AND sukhatmeZ>0
 *   - 'smaller-but-less-dispersed' vdwZ<0 AND sukhatmeZ<0
 *   - 'mixed-or-zero'              if either is exactly 0
 *
 * Throws on non-finite inputs.
 */
export type VdwSukhatmeJointDirection =
  | 'larger-and-more-dispersed'
  | 'larger-but-less-dispersed'
  | 'smaller-and-more-dispersed'
  | 'smaller-but-less-dispersed'
  | 'mixed-or-zero';

export interface VdwSukhatmeJointResult {
  jointChi2: number;
  jointPValue: number;
  jointDirection: VdwSukhatmeJointDirection;
}

export function combineVdwSukhatmeJoint(
  vdwZ: number,
  sukhatmeZ: number,
): VdwSukhatmeJointResult {
  if (!Number.isFinite(vdwZ) || !Number.isFinite(sukhatmeZ)) {
    throw new Error(
      `combineVdwSukhatmeJoint: both Z values must be finite (vdwZ=${vdwZ}, sukhatmeZ=${sukhatmeZ})`,
    );
  }
  const jointChi2 = vdwZ * vdwZ + sukhatmeZ * sukhatmeZ;
  // Chi^2_2 survival = exp(-x/2) (closed-form; Chi^2_2 ~ Exp(1/2)).
  let jointPValue = Math.exp(-jointChi2 / 2);
  if (jointPValue < 0) jointPValue = 0;
  if (jointPValue > 1) jointPValue = 1;
  let jointDirection: VdwSukhatmeJointDirection;
  if (vdwZ === 0 || sukhatmeZ === 0) {
    jointDirection = 'mixed-or-zero';
  } else if (vdwZ > 0 && sukhatmeZ > 0) {
    jointDirection = 'larger-and-more-dispersed';
  } else if (vdwZ > 0 && sukhatmeZ < 0) {
    jointDirection = 'larger-but-less-dispersed';
  } else if (vdwZ < 0 && sukhatmeZ > 0) {
    jointDirection = 'smaller-and-more-dispersed';
  } else {
    jointDirection = 'smaller-but-less-dispersed';
  }
  return { jointChi2, jointPValue, jointDirection };
}
