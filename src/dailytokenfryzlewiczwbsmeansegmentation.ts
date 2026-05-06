/**
 * daily-token-fryzlewicz-wbs-mean-segmentation:
 * per-source FRYZLEWICZ 2014 WILD BINARY SEGMENTATION
 * (WBS) MULTIPLE-CHANGEPOINT estimator for the MEAN of
 * the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-FIFTH cross-source axis.
 *
 * Mechanism. Fryzlewicz, P. (2014), "Wild Binary
 * Segmentation for Multiple Change-Point Detection",
 * *Annals of Statistics* 42(6): 2243-2281.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total-
 * tokens series for one source (n >= 21). The MEAN-SHIFT
 * model is x[i] = f[i] + epsilon[i] where f is piecewise-
 * constant and epsilon is iid mean-zero with finite
 * variance. WBS estimates the changepoints {tau_j} of f.
 *
 * CUSUM. For interval [s, e) (so length L = e - s) and
 * candidate split b in [s+1, e-1], define the
 * normalising weights
 *
 *     n1 = b - s,   n2 = e - b,   L = n1 + n2
 *
 * and the CUSUM statistic
 *
 *     X[s,e](b) = sqrt( n2 / (L * n1) ) * sum_{i=s..b-1} x[i]
 *               - sqrt( n1 / (L * n2) ) * sum_{i=b..e-1} x[i]
 *                                                          (1)
 *
 * |X[s,e](b)| is maximised at the location of the most
 * likely single changepoint inside [s, e).
 *
 * Wild step. Draw M random sub-intervals
 * {[s_m, e_m)}_{m=1..M} uniformly with s_m < e_m drawn
 * from [0, n]. For each m, compute the maximiser
 *
 *     b_m^* = argmax_{s_m < b < e_m} |X[s_m,e_m](b)|       (2)
 *
 * with statistic
 *
 *     T_m = |X[s_m,e_m](b_m^*)|                            (3)
 *
 * Aggregate maximiser over the wild draws that overlap
 * [s, e):
 *
 *     m^* = argmax_{m : [s_m,e_m) subset of [s, e)} T_m    (4)
 *
 * If T_{m^*} > zeta_n, accept b_{m^*}^* as a changepoint
 * and recurse on [s, b_{m^*}^*) and [b_{m^*}^*, e). Else
 * stop. zeta_n is the WBS threshold; we use the sBIC-
 * style choice
 *
 *     zeta_n = c_zeta * sqrt(2 * sigma^2 * log(n))         (5)
 *
 * with sigma estimated by the MEDIAN ABSOLUTE DEVIATION
 * of FIRST-ORDER DIFFERENCES,
 *
 *     sigma_hat = MAD( x[1..n-1] - x[0..n-2] ) / sqrt(2)   (6)
 *
 * (Fryzlewicz 2014 sec. 2.4; the sqrt(2) corrects for
 * variance doubling under differencing). Default
 * c_zeta = 1.0, deterministic Mersenne-Twister seed.
 *
 * SEEDED RANDOMNESS. WBS is a randomised algorithm. To
 * maintain pure determinism we use a built-in MULBERRY32
 * generator with default seed 0xC0FFEE. The seed is
 * surfaced in the report; same seed + same input + same
 * M => same output. M default is 200 (Fryzlewicz 2014
 * recommends M = 5000 for n in the thousands; for our
 * regime n in [21, ~365] we use the empirically-stable
 * M = 200).
 *
 * Surfaced quantities (pure builder, deterministic):
 *
 *   - mChangepoints: number of accepted WBS changepoints
 *     (>= 0).
 *   - tauStar: ascending changepoint indices in {1..n-1}.
 *   - tauStarDays: ISO YYYY-MM-DD of x[tau] for each tau.
 *   - segments: array of {tStart, tEndExclusive, length,
 *     meanSeg, meanShiftRel} where meanShiftRel = (meanSeg
 *     - meanGlobal) / sigmaHat (z-score of segment mean).
 *   - maxAbsCusum: max T_m at acceptance time across all
 *     accepted changepoints (= "primary CUSUM strength").
 *     0 if mChangepoints = 0.
 *   - meanRangeRatio = max(meanSeg) / min(meanSeg) over
 *     segments with length >= 3 and meanSeg > 0; 1 if m=0;
 *     +inf collapsed to 1e12 if degenerate zero segment.
 *   - meanShiftSpread = max|meanShiftRel| over segments;
 *     0 if all segments share the global mean exactly.
 *   - meanHomogeneity in [0, 1]: 1 - meanShiftSpread /
 *     (meanShiftSpread + 1). 1 = single mean regime;
 *     near 0 = strongly heterogeneous mean shifts.
 *   - sigmaHat: MAD-of-differences variance estimate (6).
 *   - threshold: zeta_n actually applied per (5).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 224 cross-source axes, NONE is a
 * MULTIPLE-CHANGEPOINT estimator for the MEAN via random-
 * interval CUSUM aggregation. The closest neighbours are:
 *
 *   - axis-221 ALEXANDERSSON-PETTITT (single-changepoint
 *     parametric and rank). Single CP, not multiple;
 *     deterministic full-window argmax, not random
 *     intervals.
 *   - axis-222 LOMBARD smooth changepoint (single,
 *     smoothly-varying drift). Single CP and smooth, not
 *     piecewise-constant.
 *   - axis-223 INCLAN-TIAO ICSS (single CP, VARIANCE).
 *     Variance, not mean; single, not multiple.
 *   - axis-224 KILLICK-FEARNHEAD-ECKLEY PELT (multiple
 *     CP, VARIANCE). Variance, not mean; deterministic
 *     dynamic-programming, not random-interval.
 *
 * Axis-225 WBS is therefore orthogonal along three
 * independent dimensions within the changepoint family:
 *
 *   1. MOMENT TARGETED: WBS targets the FIRST MOMENT
 *      (mean), distinct from axis-223 / axis-224 which
 *      target the SECOND MOMENT (variance).
 *   2. CARDINALITY: WBS is MULTIPLE-CP, distinct from
 *      axes 221-223 which are SINGLE-CP.
 *   3. ALGORITHMIC FAMILY: WBS is RANDOMISED RECURSIVE
 *      CUSUM AGGREGATION over wild sub-intervals,
 *      distinct from PELT (deterministic DP), ICSS
 *      (closed-form argmax), Pettitt / Alexandersson
 *      (deterministic full-window argmax) and Lombard
 *      (rank-CUSUM with smoothing kernel).
 *
 * The axis is also orthogonal to all 41 first-moment
 * trend / location axes (181-218, 220, 222) because (a)
 * those axes target a DIRECTION or STRENGTH of monotone /
 * smooth drift across the whole window, while WBS
 * targets the LOCATION and CARDINALITY of ABRUPT mean
 * shifts; (b) WBS is invariant to monotone shifts that
 * are realised as one or zero accepted CPs whereas trend
 * statistics accumulate them with an asymptotic null.
 *
 * Refs: Fryzlewicz 2014 *AnnStat* 42:2243-2281; Vostrikova
 * 1981 *DokladyMath* 24:55-59 (binary-segmentation
 * ancestor); Yao 1988 *StatProbLett* 6:181-189; Cho-
 * Fryzlewicz 2015 *JRSS-B* 77:475-507 (sBIC penalty).
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. PURE NUMERIC HELPERS
// =========================================================

/**
 * Mulberry32 deterministic PRNG. Pure, no global state.
 * Returns a closure that emits uniform[0, 1) doubles.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MAD = median |x - median(x)|. Returns 0 on empty / constant input. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) >> 1]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const dev: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) dev[i] = Math.abs(values[i]! - med);
  return median(dev);
}

/**
 * MAD-of-first-differences sigma estimator (eq. 6 above).
 * Robust to mean-shifts: Fryzlewicz 2014 sec. 2.4.
 */
export function sigmaHatMadDiff(x: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const diff: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) diff[i] = x[i + 1]! - x[i]!;
  // MAD scaled by 1/0.6745 estimates sd of underlying noise; dividing by
  // sqrt(2) corrects for the variance doubling introduced by differencing.
  return (mad(diff) / 0.6745) / Math.SQRT2;
}

// =========================================================
// SECTION 2. CUSUM AND WBS CORE
// =========================================================

export interface WbsAcceptedChangepoint {
  /** Location in [1, n-1]. */
  tau: number;
  /** Wild interval [s, e) that produced this acceptance. */
  s: number;
  e: number;
  /** |X_{s,e}(tau)| at acceptance. */
  cusum: number;
}

export interface WbsSummary {
  tauStar: number[];
  acceptances: WbsAcceptedChangepoint[];
  /** Largest |CUSUM| across all acceptances; 0 if none. */
  maxAbsCusum: number;
}

/**
 * CUSUM(b) on the cumulative-sum array `cs` of x for
 * candidate split b in [s+1, e-1]. cs[i] = sum_{j<i} x[j],
 * so cs[s..e] is precomputed. Returns 0 if L < 2.
 */
function cusumAt(
  cs: number[],
  s: number,
  e: number,
  b: number,
): number {
  const L = e - s;
  const n1 = b - s;
  const n2 = e - b;
  if (n1 <= 0 || n2 <= 0 || L <= 0) return 0;
  const sumLeft = cs[b]! - cs[s]!;
  const sumRight = cs[e]! - cs[b]!;
  const wL = Math.sqrt(n2 / (L * n1));
  const wR = Math.sqrt(n1 / (L * n2));
  return wL * sumLeft - wR * sumRight;
}

/**
 * Pure WBS run. Pre-generates M wild sub-intervals
 * deterministically from `seed`. Recurses on [0, n)
 * accepting changepoints whose |CUSUM| > threshold.
 *
 * Throws on n < 4, M <= 0, threshold < 0, or non-integer
 * seed/n/M.
 */
export function wildBinarySegmentation(
  x: number[],
  threshold: number,
  M: number,
  seed: number,
): WbsSummary {
  const n = x.length;
  if (!Number.isInteger(n) || n < 4) {
    throw new Error(`wildBinarySegmentation: need n >= 4 integer (got ${n})`);
  }
  if (!Number.isInteger(M) || M <= 0) {
    throw new Error(`wildBinarySegmentation: M must be a positive integer (got ${M})`);
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(
      `wildBinarySegmentation: threshold must be >= 0 (got ${threshold})`,
    );
  }
  if (!Number.isInteger(seed)) {
    throw new Error(`wildBinarySegmentation: seed must be integer (got ${seed})`);
  }
  // Cumulative sums.
  const cs: number[] = new Array(n + 1);
  cs[0] = 0;
  for (let i = 0; i < n; i += 1) cs[i + 1] = cs[i]! + x[i]!;

  // Pre-draw M wild intervals deterministically. Each is a pair (s, e) with
  // 0 <= s < e <= n and e - s >= 2 (so at least one interior split exists).
  const rng = mulberry32(seed);
  const wildS: number[] = new Array(M);
  const wildE: number[] = new Array(M);
  for (let m = 0; m < M; m += 1) {
    // Sample two distinct indices in [0, n], take min/max.
    let a = Math.floor(rng() * (n + 1));
    let b = Math.floor(rng() * (n + 1));
    if (a === b) {
      // resample b until distinct (bounded loop; n+1 >= 5 here).
      for (let k = 0; k < 8 && a === b; k += 1) {
        b = Math.floor(rng() * (n + 1));
      }
      if (a === b) b = (a + 1) % (n + 1);
    }
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    if (b - a < 2) {
      // widen to length 2 by shifting one endpoint inward toward a valid range
      if (b + 1 <= n) b = a + 2;
      else if (a - 1 >= 0) a = b - 2;
      else {
        a = 0;
        b = Math.min(n, 2);
      }
    }
    wildS[m] = a;
    wildE[m] = b;
  }
  // Prepend the full interval [0, n) to ensure the deterministic baseline
  // candidate (Fryzlewicz 2014 sec. 2.2 implementation note: WBS includes
  // standard binary segmentation as a special case when [0, n) is in F_n).
  const intervalsS = [0, ...wildS];
  const intervalsE = [n, ...wildE];

  const acceptances: WbsAcceptedChangepoint[] = [];

  // Recurse. Use an explicit stack to avoid deep recursion on long series.
  type Frame = { s: number; e: number };
  const stack: Frame[] = [{ s: 0, e: n }];
  while (stack.length > 0) {
    const { s, e } = stack.pop()!;
    if (e - s < 4) continue; // need at least 4 points to split with min seg 2
    let bestStat = -1;
    let bestB = -1;
    let bestS = -1;
    let bestE = -1;
    for (let m = 0; m < intervalsS.length; m += 1) {
      const ms = intervalsS[m]!;
      const me = intervalsE[m]!;
      // Restrict to overlap with [s, e); WBS requires the wild interval to
      // be a SUBSET of the current segment.
      if (ms < s || me > e) continue;
      if (me - ms < 4) continue;
      // Argmax of |CUSUM| over interior splits b in [ms+2, me-2] to enforce
      // min-seg length 2 inside the wild interval.
      for (let b = ms + 2; b <= me - 2; b += 1) {
        const c = Math.abs(cusumAt(cs, ms, me, b));
        if (c > bestStat) {
          bestStat = c;
          bestB = b;
          bestS = ms;
          bestE = me;
        }
      }
    }
    if (bestStat > threshold && bestB > s && bestB < e) {
      acceptances.push({ tau: bestB, s: bestS, e: bestE, cusum: bestStat });
      stack.push({ s, e: bestB });
      stack.push({ s: bestB, e });
    }
  }

  acceptances.sort((u, v) => u.tau - v.tau);
  const tauStar = acceptances.map((a) => a.tau);
  let maxAbs = 0;
  for (const a of acceptances) if (a.cusum > maxAbs) maxAbs = a.cusum;
  return { tauStar, acceptances, maxAbsCusum: maxAbs };
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenFryzlewiczWbsMeanSegmentationSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'maxAbsCusum'
  | 'maxAbsCusumDesc'
  | 'meanRangeRatio'
  | 'meanRangeRatioDesc'
  | 'meanHomogeneity'
  | 'meanHomogeneityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenFryzlewiczWbsMeanSegmentationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenFryzlewiczWbsMeanSegmentationSort;
  /** Threshold scale c_zeta in (5); default 1.0. */
  cZeta?: number;
  /** Number of wild intervals; default 200. */
  M?: number;
  /** Mulberry32 seed; default 0xC0FFEE. */
  seed?: number;
  generatedAt?: string;
}

export interface WbsSegment {
  tStart: number;
  tEndExclusive: number;
  length: number;
  meanSeg: number;
  /** (meanSeg - meanGlobal) / sigmaHat; 0 if sigmaHat = 0. */
  meanShiftRel: number;
}

export interface DailyTokenFryzlewiczWbsMeanSegmentationSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  segments: WbsSegment[];
  tauStar: number[];
  tauStarDays: string[];
  maxAbsCusum: number;
  meanRangeRatio: number;
  meanShiftSpread: number;
  meanHomogeneity: number;
  sigmaHat: number;
  threshold: number;
}

export interface DailyTokenFryzlewiczWbsMeanSegmentationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenFryzlewiczWbsMeanSegmentationSort;
  cZeta: number;
  M: number;
  seed: number;
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
  sources: DailyTokenFryzlewiczWbsMeanSegmentationSourceRow[];
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

/**
 * Per-source pure builder. Validates options, gap-fills,
 * runs WBS, returns a deterministic report.
 */
export function buildDailyTokenFryzlewiczWbsMeanSegmentation(
  queue: QueueLine[],
  opts: DailyTokenFryzlewiczWbsMeanSegmentationOptions = {},
): DailyTokenFryzlewiczWbsMeanSegmentationReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenFryzlewiczWbsMeanSegmentationSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenFryzlewiczWbsMeanSegmentationSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'maxAbsCusum',
    'maxAbsCusumDesc',
    'meanRangeRatio',
    'meanRangeRatioDesc',
    'meanHomogeneity',
    'meanHomogeneityDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const cZeta = opts.cZeta ?? 1.0;
  if (!Number.isFinite(cZeta) || cZeta <= 0) {
    throw new Error(`cZeta must be a positive finite number (got ${opts.cZeta})`);
  }
  const M = opts.M ?? 200;
  if (!Number.isInteger(M) || M <= 0) {
    throw new Error(`M must be a positive integer (got ${opts.M})`);
  }
  const seed = opts.seed ?? 0xc0ffee;
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer (got ${opts.seed})`);
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
  const rows: DailyTokenFryzlewiczWbsMeanSegmentationSourceRow[] = [];

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
    let sigmaHat = sigmaHatMadDiff(filled);
    if (!(sigmaHat > 0) || !Number.isFinite(sigmaHat)) {
      // fallback to sample sd of differences if MAD collapses to 0
      let sumD = 0;
      let sumD2 = 0;
      const k = filled.length - 1;
      for (let i = 0; i < k; i += 1) {
        const d = filled[i + 1]! - filled[i]!;
        sumD += d;
        sumD2 += d * d;
      }
      const meanD = sumD / k;
      const varD = Math.max(0, sumD2 / k - meanD * meanD);
      sigmaHat = Math.sqrt(varD) / Math.SQRT2;
      if (!(sigmaHat > 0) || !Number.isFinite(sigmaHat)) {
        droppedNonFiniteFit += 1;
        continue;
      }
    }
    const threshold = cZeta * Math.sqrt(2 * sigmaHat * sigmaHat * Math.log(nTenure));
    let summary: WbsSummary;
    try {
      summary = wildBinarySegmentation(filled, threshold, M, seed);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    let sumX = 0;
    for (let i = 0; i < nTenure; i += 1) sumX += filled[i]!;
    const meanGlobal = sumX / nTenure;
    const bounds = [0, ...summary.tauStar, nTenure];
    const segments: WbsSegment[] = [];
    for (let j = 0; j + 1 < bounds.length; j += 1) {
      const t = bounds[j]!;
      const u = bounds[j + 1]!;
      const L = u - t;
      let segSum = 0;
      for (let i = t; i < u; i += 1) segSum += filled[i]!;
      const meanSeg = L > 0 ? segSum / L : 0;
      const meanShiftRel = sigmaHat > 0 ? (meanSeg - meanGlobal) / sigmaHat : 0;
      segments.push({
        tStart: t,
        tEndExclusive: u,
        length: L,
        meanSeg,
        meanShiftRel,
      });
    }
    let mnMean = Number.POSITIVE_INFINITY;
    let mxMean = 0;
    let shiftSpread = 0;
    for (const seg of segments) {
      if (seg.length >= 3 && seg.meanSeg > 0) {
        if (seg.meanSeg < mnMean) mnMean = seg.meanSeg;
        if (seg.meanSeg > mxMean) mxMean = seg.meanSeg;
      }
      const a = Math.abs(seg.meanShiftRel);
      if (a > shiftSpread) shiftSpread = a;
    }
    let meanRangeRatio: number;
    if (
      summary.tauStar.length === 0 ||
      !Number.isFinite(mnMean) ||
      mnMean === 0
    ) {
      meanRangeRatio = 1;
    } else {
      const r = mxMean / mnMean;
      meanRangeRatio = Number.isFinite(r) ? Math.min(r, 1e12) : 1e12;
    }
    const meanHomogeneity = 1 - shiftSpread / (shiftSpread + 1);
    const tauStarDays = summary.tauStar.map((t) =>
      addUtcDays(acc.firstDay, t),
    );
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mChangepoints: summary.tauStar.length,
      segments,
      tauStar: summary.tauStar,
      tauStarDays,
      maxAbsCusum: summary.maxAbsCusum,
      meanRangeRatio,
      meanShiftSpread: shiftSpread,
      meanHomogeneity,
      sigmaHat,
      threshold,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mChangepoints':
        primary = a.mChangepoints - b.mChangepoints;
        break;
      case 'mChangepointsDesc':
        primary = b.mChangepoints - a.mChangepoints;
        break;
      case 'maxAbsCusum':
        primary = a.maxAbsCusum - b.maxAbsCusum;
        break;
      case 'maxAbsCusumDesc':
        primary = b.maxAbsCusum - a.maxAbsCusum;
        break;
      case 'meanRangeRatio':
        primary = a.meanRangeRatio - b.meanRangeRatio;
        break;
      case 'meanRangeRatioDesc':
        primary = b.meanRangeRatio - a.meanRangeRatio;
        break;
      case 'meanHomogeneity':
        primary = a.meanHomogeneity - b.meanHomogeneity;
        break;
      case 'meanHomogeneityDesc':
        primary = b.meanHomogeneity - a.meanHomogeneity;
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
    cZeta,
    M,
    seed,
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
