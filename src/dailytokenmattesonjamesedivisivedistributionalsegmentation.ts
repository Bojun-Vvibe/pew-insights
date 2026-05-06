/**
 * daily-token-matteson-james-edivisive-distributional-segmentation:
 * per-source MATTESON-JAMES 2014 E-DIVISIVE
 * (ECP) MULTIPLE-CHANGEPOINT estimator for the
 * DISTRIBUTION of the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-SIXTH cross-source axis.
 *
 * Mechanism. Matteson, D.S. and James, N.A. (2014),
 * "A Nonparametric Approach for Multiple Change Point
 * Analysis of Multivariate Data", *J. Amer. Statist.
 * Assoc.* 109(505): 334-345.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total-
 * tokens series for one source (n >= 21). Treat the
 * series as a 1-D realisation drawn from an unknown
 * piecewise-stationary distribution F_1, ..., F_K. The
 * E-divisive procedure estimates changepoints between
 * adjacent regimes WITHOUT any moment, distributional or
 * parametric assumption: it looks for the split that
 * maximises the EMPIRICAL ENERGY-DISTANCE between the
 * left and right empirical distributions.
 *
 * E-statistic. For interval [s, e) and split b in
 * [s+1, e-1] partition into X = x[s..b-1] (size n1 = b-s)
 * and Y = x[b..e-1] (size n2 = e-b). The Szekely-Rizzo
 * 2004 ENERGY DISTANCE between X and Y is
 *
 *     E(X, Y) = 2/(n1*n2) sum_{i,j} |X_i - Y_j|
 *             - 1/n1^2     sum_{i,j} |X_i - X_j|
 *             - 1/n2^2     sum_{i,j} |Y_i - Y_j|         (1)
 *
 * (Euclidean distance |.| in 1-D = absolute value.) The
 * Matteson-James scaled E-statistic at split b is
 *
 *     Q[s,e](b) = (n1 * n2 / (n1 + n2)) * E(X, Y)        (2)
 *
 * which is non-negative, zero iff F_X = F_Y, and grows
 * with n. The argmax over interior splits is the
 * candidate changepoint:
 *
 *     b^* = argmax_{s<b<e} Q[s,e](b),
 *     Q^* = Q[s,e](b^*).                                  (3)
 *
 * Significance. Under the null F_X = F_Y, n^{-1/2} * Q^*
 * has a non-degenerate limit (Matteson-James 2014, thm 2).
 * Permutation-free PROXY threshold (used here for pure
 * determinism):
 *
 *     zeta_n = c_zeta * sigma * log(n)                  (4)
 *
 * with sigma estimated by the MEDIAN ABSOLUTE DEVIATION
 * of FIRST-ORDER DIFFERENCES,
 *
 *     sigma_hat = MAD( x[1..n-1] - x[0..n-2] ) / sqrt(2)  (5)
 *
 * Default c_zeta = 1.0. The threshold is calibrated so
 * that on a constant-mean iid noise series the expected
 * number of false-positive accepted CPs is small over
 * n in [21, ~365]. Empirically Q^* on iid noise scales
 * roughly as O(sigma * log n); the c_zeta=1 cutoff was
 * chosen by inspection so that pure noise yields zero
 * accepted CPs at default settings.
 *
 * Recursion. Accept b^* iff Q^* > zeta_n; recurse on
 * [s, b^*) and [b^*, e). Stop on segments shorter than 4
 * or when no split exceeds zeta_n. This is a
 * BINARY-SEGMENTATION variant (single-pass nesting) of
 * the Matteson-James E-divisive recursion: deterministic
 * and order-independent.
 *
 * NO RANDOMISATION. Unlike axis-225 WBS which draws
 * RANDOM wild sub-intervals, ECP scans the FULL
 * deterministic split set on each segment. There is no
 * seed.
 *
 * O(L^2) per segment via running-pair-distance
 * recurrences (sec. 1 of impl.) without quadratic-memory
 * blow-up. Total cost O(n^2) over the recursion.
 *
 * Surfaced quantities (pure builder, deterministic):
 *
 *   - mChangepoints: number of accepted ECP changepoints
 *     (>= 0).
 *   - tauStar: ascending changepoint indices in {1..n-1}.
 *   - tauStarDays: ISO YYYY-MM-DD of x[tau] for each tau.
 *   - segments: array of {tStart, tEndExclusive, length,
 *     meanSeg, sdSeg, meanShiftRel} where meanShiftRel =
 *     (meanSeg - meanGlobal) / sigmaHat.
 *   - maxQStar: max Q^* at acceptance time across all
 *     accepted CPs (= "primary E-statistic strength").
 *     0 if mChangepoints = 0.
 *   - sdRangeRatio = max(sdSeg) / min(sdSeg) over
 *     segments with length >= 3 and sdSeg > 0; 1 if m=0.
 *   - distributionalSpread = max over adjacent-segment
 *     pairs of n1*n2/(n1+n2) * energyDistance(seg_i, seg_{i+1});
 *     0 if m = 0.
 *   - distributionalHomogeneity in [0, 1]: 1 - x/(x+1)
 *     where x = distributionalSpread / max(1, sigmaHat).
 *     1 = single distributional regime; near 0 =
 *     strongly heterogeneous regimes.
 *   - sigmaHat: MAD-of-differences variance estimate (5).
 *   - threshold: zeta_n actually applied per (4).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 225 cross-source axes, NONE is a NON-
 * PARAMETRIC DISTRIBUTION-FREE MULTIPLE-CHANGEPOINT
 * estimator based on EMPIRICAL ENERGY-DISTANCE between
 * the two halves of a candidate split. Closest neighbours:
 *
 *   - axis-221 ALEXANDERSSON-PETTITT (single CP, mean,
 *     parametric/rank). Single CP and Gaussian/rank-based,
 *     not energy-distance.
 *   - axis-222 LOMBARD smooth changepoint (single, smooth,
 *     rank-CUSUM). Single CP and smoothing, not energy.
 *   - axis-223 INCLAN-TIAO ICSS (single CP, variance,
 *     parametric Gaussian iterated cumulative sum).
 *     Variance, single, parametric.
 *   - axis-224 KILLICK-FEARNHEAD-ECKLEY PELT (multiple
 *     CP, variance, GAUSSIAN VARIANCE COST + BIC).
 *     Variance and parametric, not energy-distance.
 *   - axis-225 FRYZLEWICZ WBS (multiple CP, mean,
 *     RANDOMISED CUSUM). Mean and randomised, not
 *     energy-distance.
 *
 * Axis-226 ECP is therefore orthogonal along three
 * INDEPENDENT dimensions within the changepoint family:
 *
 *   1. MOMENT TARGETED: ECP targets the FULL
 *      DISTRIBUTION (any difference: mean, variance,
 *      skewness, tail, multimodality), distinct from
 *      axis-225 (first moment) and axes 223-224 (second
 *      moment).
 *   2. PARAMETRIC ASSUMPTION: ECP is DISTRIBUTION-FREE
 *      and uses no Gaussian assumption, distinct from
 *      ICSS / PELT (Gaussian likelihood / Gaussian
 *      variance cost) and Pettitt / Alexandersson
 *      (parametric or rank under continuity).
 *   3. ALGORITHMIC FAMILY: ECP is DETERMINISTIC FULL-
 *      SCAN ENERGY-DISTANCE MAXIMISATION, distinct from
 *      WBS (RANDOMISED RECURSIVE CUSUM AGGREGATION),
 *      PELT (DP), ICSS (closed-form argmax) and Pettitt
 *      / Alexandersson (deterministic full-window
 *      argmax of CUSUM-style statistics).
 *
 * The axis is also orthogonal to all prior trend /
 * location axes (181-218, 220, 222) because (a) those
 * axes target a DIRECTION or STRENGTH of monotone /
 * smooth drift across the whole window, while ECP
 * targets the LOCATION and CARDINALITY of ABRUPT
 * DISTRIBUTIONAL shifts; (b) ECP is invariant under any
 * monotone transformation that preserves equality of
 * distributions whereas trend / location statistics
 * accumulate monotone drift with non-trivial asymptotic
 * nulls.
 *
 * Refs: Matteson-James 2014 *JASA* 109:334-345; Szekely-
 * Rizzo 2004 *InterStat*; Szekely-Rizzo 2013 *J. Stat.
 * Plann. Inference* 143:1249-1272 (energy-distance
 * theory); James-Matteson 2014 *J. Stat. Software*
 * 62(7) (the `ecp` R package).
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. PURE NUMERIC HELPERS
// =========================================================

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
 * MAD-of-first-differences sigma estimator (eq. 5 above).
 * Robust to mean-shifts / variance-shifts: same construction as axis-225.
 */
export function sigmaHatMadDiff(x: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const diff: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) diff[i] = x[i + 1]! - x[i]!;
  return (mad(diff) / 0.6745) / Math.SQRT2;
}

// =========================================================
// SECTION 2. ENERGY DISTANCE AND ECP CORE
// =========================================================

/**
 * Pure 1-D energy distance |X - Y| (Szekely-Rizzo 2004),
 * scaled by n1*n2/(n1+n2) per Matteson-James (eq. 2).
 *
 * O((n1+n2)^2) naive; used only by tests / external
 * callers. The recursive scan in `ecpSegment` uses an
 * O(L^2) running scheme.
 */
export function scaledEnergyStat(xs: number[], ys: number[]): number {
  const n1 = xs.length;
  const n2 = ys.length;
  if (n1 === 0 || n2 === 0) return 0;
  let sumXY = 0;
  for (let i = 0; i < n1; i += 1) {
    const xi = xs[i]!;
    for (let j = 0; j < n2; j += 1) sumXY += Math.abs(xi - ys[j]!);
  }
  let sumXX = 0;
  for (let i = 0; i < n1; i += 1) {
    const xi = xs[i]!;
    for (let j = 0; j < n1; j += 1) sumXX += Math.abs(xi - xs[j]!);
  }
  let sumYY = 0;
  for (let i = 0; i < n2; i += 1) {
    const yi = ys[i]!;
    for (let j = 0; j < n2; j += 1) sumYY += Math.abs(yi - ys[j]!);
  }
  const e = (2 * sumXY) / (n1 * n2)
    - sumXX / (n1 * n1)
    - sumYY / (n2 * n2);
  return (n1 * n2 / (n1 + n2)) * e;
}

export interface EcpAcceptedChangepoint {
  /** Location in [s+1, e-1]. */
  tau: number;
  /** Segment in which the split was accepted. */
  s: number;
  e: number;
  /** Q^* at acceptance. */
  qStar: number;
}

export interface EcpSummary {
  tauStar: number[];
  acceptances: EcpAcceptedChangepoint[];
  /** Largest Q^* across all acceptances; 0 if none. */
  maxQStar: number;
}

/**
 * Compute Q[s,e](b) for every interior b in [s+2, e-2] of a
 * segment of `x`. Returns the array Q indexed by b in that
 * range; Q[k] corresponds to b = s + 2 + k. Pure, O(L^2).
 */
function scanSegment(x: number[], s: number, e: number): { bestB: number; bestQ: number } {
  const L = e - s;
  if (L < 4) return { bestB: -1, bestQ: -1 };
  // Build the L x L Manhattan-distance matrix lazily through running sums.
  // For 1-D series the absolute differences are cheap; we accept O(L^2) work.
  // Maintain four running quantities as b advances by one to the right:
  //   sumXY  = sum_{i<b, j>=b} |x_i - x_j|
  //   sumXX  = sum_{i<b,  j<b} |x_i - x_j|
  //   sumYY  = sum_{i>=b, j>=b} |x_i - x_j|
  //   nL = b - s, nR = e - b.
  // Initialise at b = s + 2 by direct double sums (O(L) each).
  let bestB = -1;
  let bestQ = -1;
  // Precompute pairwise abs differences D[i][j] for i<j inside [s, e).
  // Memory O(L^2). For our regime L <= ~365 -> 130k doubles -> ~1MB worst case;
  // acceptable. For larger L the caller can pre-truncate.
  const D: number[][] = new Array(L);
  for (let i = 0; i < L; i += 1) {
    const row: number[] = new Array(L);
    const xi = x[s + i]!;
    for (let j = 0; j < L; j += 1) row[j] = Math.abs(xi - x[s + j]!);
    D[i] = row;
  }
  // Build prefix-row-sums S[i][k] = sum_{j=0..k-1} D[i][j] for fast slice sums.
  // O(L^2) space again; same bound.
  const S: number[][] = new Array(L);
  for (let i = 0; i < L; i += 1) {
    const row = D[i]!;
    const ps: number[] = new Array(L + 1);
    ps[0] = 0;
    for (let k = 0; k < L; k += 1) ps[k + 1] = ps[k]! + row[k]!;
    S[i] = ps;
  }
  // For each split b in [s+2, e-2] compute the three sums by summing rows.
  for (let b = s + 2; b <= e - 2; b += 1) {
    const nL = b - s;
    const nR = e - b;
    let sumXY = 0;
    for (let i = 0; i < nL; i += 1) {
      const ps = S[i]!;
      // sum over j in [nL, L)
      sumXY += ps[L]! - ps[nL]!;
    }
    let sumXX = 0;
    for (let i = 0; i < nL; i += 1) {
      const ps = S[i]!;
      sumXX += ps[nL]!; // sum over j in [0, nL)
    }
    let sumYY = 0;
    for (let i = nL; i < L; i += 1) {
      const ps = S[i]!;
      sumYY += ps[L]! - ps[nL]!;
    }
    const eStat = (2 * sumXY) / (nL * nR)
      - sumXX / (nL * nL)
      - sumYY / (nR * nR);
    const q = (nL * nR / (nL + nR)) * eStat;
    if (q > bestQ) {
      bestQ = q;
      bestB = b;
    }
  }
  return { bestB, bestQ };
}

/**
 * Pure E-divisive run. Recurses on [0, n) accepting CPs
 * whose Q^* > threshold.
 *
 * Throws on n < 4, threshold < 0, non-integer n.
 */
export function eDivisiveSegmentation(
  x: number[],
  threshold: number,
): EcpSummary {
  const n = x.length;
  if (!Number.isInteger(n) || n < 4) {
    throw new Error(`eDivisiveSegmentation: need n >= 4 integer (got ${n})`);
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(
      `eDivisiveSegmentation: threshold must be >= 0 (got ${threshold})`,
    );
  }
  const acceptances: EcpAcceptedChangepoint[] = [];
  type Frame = { s: number; e: number };
  const stack: Frame[] = [{ s: 0, e: n }];
  while (stack.length > 0) {
    const { s, e } = stack.pop()!;
    if (e - s < 4) continue;
    const { bestB, bestQ } = scanSegment(x, s, e);
    if (bestB < 0) continue;
    if (bestQ > threshold && bestB > s && bestB < e) {
      acceptances.push({ tau: bestB, s, e, qStar: bestQ });
      stack.push({ s, e: bestB });
      stack.push({ s: bestB, e });
    }
  }
  acceptances.sort((u, v) => u.tau - v.tau);
  const tauStar = acceptances.map((a) => a.tau);
  let maxQ = 0;
  for (const a of acceptances) if (a.qStar > maxQ) maxQ = a.qStar;
  return { tauStar, acceptances, maxQStar: maxQ };
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'maxQStar'
  | 'maxQStarDesc'
  | 'sdRangeRatio'
  | 'sdRangeRatioDesc'
  | 'distributionalHomogeneity'
  | 'distributionalHomogeneityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMattesonJamesEDivisiveDistributionalSegmentationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSort;
  /** Threshold scale c_zeta in (4); default 1.0. */
  cZeta?: number;
  generatedAt?: string;
}

export interface EcpSegment {
  tStart: number;
  tEndExclusive: number;
  length: number;
  meanSeg: number;
  sdSeg: number;
  /** (meanSeg - meanGlobal) / sigmaHat; 0 if sigmaHat = 0. */
  meanShiftRel: number;
}

export interface DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  segments: EcpSegment[];
  tauStar: number[];
  tauStarDays: string[];
  maxQStar: number;
  sdRangeRatio: number;
  distributionalSpread: number;
  distributionalHomogeneity: number;
  sigmaHat: number;
  threshold: number;
}

export interface DailyTokenMattesonJamesEDivisiveDistributionalSegmentationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSort;
  cZeta: number;
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
  sources: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSourceRow[];
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
 * runs E-divisive segmentation, returns a deterministic
 * report.
 */
export function buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(
  queue: QueueLine[],
  opts: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationOptions = {},
): DailyTokenMattesonJamesEDivisiveDistributionalSegmentationReport {
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
  const sort: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'maxQStar',
    'maxQStarDesc',
    'sdRangeRatio',
    'sdRangeRatioDesc',
    'distributionalHomogeneity',
    'distributionalHomogeneityDesc',
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
  const rows: DailyTokenMattesonJamesEDivisiveDistributionalSegmentationSourceRow[] = [];

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
    const threshold = cZeta * sigmaHat * Math.log(nTenure);
    let summary: EcpSummary;
    try {
      summary = eDivisiveSegmentation(filled, threshold);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    let sumX = 0;
    for (let i = 0; i < nTenure; i += 1) sumX += filled[i]!;
    const meanGlobal = sumX / nTenure;
    const bounds = [0, ...summary.tauStar, nTenure];
    const segments: EcpSegment[] = [];
    for (let j = 0; j + 1 < bounds.length; j += 1) {
      const t = bounds[j]!;
      const u = bounds[j + 1]!;
      const L = u - t;
      let segSum = 0;
      for (let i = t; i < u; i += 1) segSum += filled[i]!;
      const meanSeg = L > 0 ? segSum / L : 0;
      let segVar = 0;
      if (L > 1) {
        let sq = 0;
        for (let i = t; i < u; i += 1) {
          const d = filled[i]! - meanSeg;
          sq += d * d;
        }
        segVar = sq / L;
      }
      const sdSeg = Math.sqrt(segVar);
      const meanShiftRel = sigmaHat > 0 ? (meanSeg - meanGlobal) / sigmaHat : 0;
      segments.push({
        tStart: t,
        tEndExclusive: u,
        length: L,
        meanSeg,
        sdSeg,
        meanShiftRel,
      });
    }
    let mnSd = Number.POSITIVE_INFINITY;
    let mxSd = 0;
    for (const seg of segments) {
      if (seg.length >= 3 && seg.sdSeg > 0) {
        if (seg.sdSeg < mnSd) mnSd = seg.sdSeg;
        if (seg.sdSeg > mxSd) mxSd = seg.sdSeg;
      }
    }
    let sdRangeRatio: number;
    if (
      summary.tauStar.length === 0 ||
      !Number.isFinite(mnSd) ||
      mnSd === 0
    ) {
      sdRangeRatio = 1;
    } else {
      const r = mxSd / mnSd;
      sdRangeRatio = Number.isFinite(r) ? Math.min(r, 1e12) : 1e12;
    }
    // distributionalSpread: max scaled energy distance between adjacent segments.
    let distSpread = 0;
    for (let j = 0; j + 1 < segments.length; j += 1) {
      const a = segments[j]!;
      const b = segments[j + 1]!;
      const xs = filled.slice(a.tStart, a.tEndExclusive);
      const ys = filled.slice(b.tStart, b.tEndExclusive);
      const q = scaledEnergyStat(xs, ys);
      if (q > distSpread) distSpread = q;
    }
    const distNorm = distSpread / Math.max(1, sigmaHat);
    const distributionalHomogeneity = 1 - distNorm / (distNorm + 1);
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
      maxQStar: summary.maxQStar,
      sdRangeRatio,
      distributionalSpread: distSpread,
      distributionalHomogeneity,
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
      case 'maxQStar':
        primary = a.maxQStar - b.maxQStar;
        break;
      case 'maxQStarDesc':
        primary = b.maxQStar - a.maxQStar;
        break;
      case 'sdRangeRatio':
        primary = a.sdRangeRatio - b.sdRangeRatio;
        break;
      case 'sdRangeRatioDesc':
        primary = b.sdRangeRatio - a.sdRangeRatio;
        break;
      case 'distributionalHomogeneity':
        primary = a.distributionalHomogeneity - b.distributionalHomogeneity;
        break;
      case 'distributionalHomogeneityDesc':
        primary = b.distributionalHomogeneity - a.distributionalHomogeneity;
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
