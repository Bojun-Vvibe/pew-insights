/**
 * daily-token-killick-pelt-variance-segmentation:
 * per-source KILLICK-FEARNHEAD-ECKLEY 2012 PELT (PRUNED
 * EXACT LINEAR TIME) MULTIPLE-CHANGEPOINT segmentation
 * for VARIANCE on the gap-filled daily total_tokens
 * series.
 *
 * TWO-HUNDRED-AND-TWENTY-FOURTH cross-source axis.
 *
 * Mechanism. Killick, R., Fearnhead, P. & Eckley, I. A.
 * (2012), "Optimal Detection of Changepoints With a
 * Linear Computational Cost", *J. Amer. Statist. Assoc.*
 * 107: 1590-1598. The "PELT" algorithm.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total-
 * tokens series for one source (n >= 21). Mean-centre to
 * remove first-moment effects (consistent with axis-223):
 *
 *     y[i] = x[i] - mean(x)                                (1)
 *
 * The OPTIMAL SEGMENTATION problem with m unknown
 * changepoints 0 = tau[0] < tau[1] < ... < tau[m] <
 * tau[m+1] = n minimises
 *
 *     F(n)  = min over m, {tau_j}  sum_{j=0..m}
 *               [ C( y[ tau[j] : tau[j+1]-1 ] )  +  beta ] (2)
 *
 * where C(.) is the Gaussian negative log-likelihood
 * cost for a CHANGE-IN-VARIANCE segment with mean fixed
 * at zero (because y is mean-centred):
 *
 *     C(y_seg) = L * ( ln(2*pi) + ln(sigma2_seg) + 1 )    (3)
 *
 *     sigma2_seg = (1/L) * sum_{i in seg} y[i]^2          (4)
 *
 * with L = segment length, and a small floor on
 * sigma2_seg to prevent log(0) on degenerate constant
 * segments.
 *
 * BIC penalty. We use beta = k * ln(n), with k = 2 (two
 * d.o.f. per added segment: location of the changepoint
 * + the new segment variance), the standard SCHWARZ
 * 1978 BIC choice for changepoint problems
 * recommended in Killick-Fearnhead-Eckley 2012 sec. 3.1.
 *
 * The OPTIMAL PARTITIONING dynamic-programming recursion
 * (Jackson et al. 2005) is
 *
 *     F(s)   = min_{0 <= t < s}  F(t) + C(y[t..s-1])
 *                                     + beta             (5)
 *
 * for s = 1..n with F(0) = -beta. This costs O(n^2).
 *
 * PELT pruning (Killick et al. 2012 thm. 3.1). Define
 *
 *     R(s+1) = { t in R(s) U {s} :
 *                F(t) + C(y[t..s-1]) + K <= F(s) }       (6)
 *
 * where K is a constant satisfying, for any t < s < u,
 *
 *     C(y[t..s-1]) + C(y[s..u-1]) + K <= C(y[t..u-1])    (7)
 *
 * For Gaussian variance cost (3), inequality (7) holds
 * with K = 0 (the cost is sub-additive after dropping
 * the per-segment beta surcharge). With K = 0 PELT
 * remains EXACT and runs in O(n) average-case under the
 * Killick et al. linearity assumption. We use K = 0
 * throughout.
 *
 * Surfaced quantities (pure builder, deterministic):
 *
 *   - mChangepoints: number of estimated changepoints
 *     (= |segments| - 1).
 *   - segments: array of {tStart, tEndExclusive, length,
 *     varSeg, logVarRel} with logVarRel = ln(varSeg /
 *     varGlobal).
 *   - tauStar: array of changepoint indices (0 < tau <
 *     n), in ascending order.
 *   - tauStarDays: ISO YYYY-MM-DD of x[tau] for each tau.
 *   - varRangeRatio = max(varSeg) / min(varSeg) over
 *     segments with length >= 3 and varSeg > 0; 1 if
 *     mChangepoints = 0; +inf collapsed to a finite cap
 *     1e12 if a degenerate zero segment slipped through.
 *   - cost = F(n), the final BIC-penalised total cost.
 *   - costNoSegmentation = C(y[0..n-1]) - the single-
 *     segment baseline cost MINUS the trailing beta (so
 *     directly comparable to F(n) which includes one
 *     beta per segment).
 *   - costReduction = costNoSegmentation - cost (always
 *     >= 0 by optimality of PELT; positive means the BIC
 *     prefers segmentation).
 *   - varHomogeneity in [0, 1]: 1 - logVarSpread /
 *     (logVarSpread + 1), where logVarSpread =
 *     max(|logVarRel|) across segments. 1 = single
 *     variance regime; near 0 = strongly heterogeneous.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the forty-two preceding cross-source axes 181-223,
 * exactly ONE (axis-223 INCLAN-TIAO ICSS) targets a
 * change in the SECOND MOMENT. PELT is orthogonal to
 * ICSS along three independent axes:
 *
 *   1. CARDINALITY OF CHANGEPOINTS. ICSS is a SINGLE-
 *      CHANGEPOINT test under H0 of no change vs H1 of
 *      exactly one change in variance (the recursive
 *      ICSS algorithm of Inclan-Tiao 1994 sec. 3 is
 *      noted but not implemented in axis-223; only
 *      secondPeakRatio is exposed as a screening
 *      diagnostic). PELT is a MULTIPLE-CHANGEPOINT
 *      EXACT segmenter that returns the optimal m for
 *      m in {0, 1, 2, ..., n-1} jointly with the
 *      optimal {tau_j}.
 *   2. ESTIMATION CRITERION. ICSS uses the Brownian-
 *      bridge SUP-NORM functional (4) of axis-223 with
 *      its Kolmogorov asymptotic null. PELT uses the
 *      GAUSSIAN BIC-PENALISED LIKELIHOOD (3)+(5) under
 *      a finite-sample SCHWARZ 1978 penalty, no null
 *      distribution required. The two estimators
 *      disagree on series with multiple comparable-
 *      magnitude variance shifts: ICSS picks the single
 *      strongest |D[k]| even when m > 1; PELT picks all
 *      of them subject to the BIC penalty.
 *   3. ALGORITHMIC FAMILY. ICSS is a CLOSED-FORM
 *      argmax of a cumulative-sum-of-squares functional.
 *      PELT is a DYNAMIC-PROGRAMMING RECURSION with
 *      pruning, fundamentally different in
 *      computational structure and able to handle
 *      arbitrary additive segment cost functions.
 *
 * PELT is also orthogonal to all FIRST-MOMENT
 * changepoint axes (Pettitt 154, Buys-Ballot 215,
 * Laplace centroid 217, SNHT 221, Lombard 222) by
 * mean-centring (location invariance), to all monotone-
 * trend axes (Theil-Sen 181, Mann-Kendall variants 195-
 * 200, Hirsch-Slack 218, Sen-Adichie 219, Hamed-Rao
 * 220) because trend in y[i] does not break sub-
 * additivity of the variance cost (changes in mean
 * become absorbed as larger segment variance, not as
 * spurious changepoints), and to all structural /
 * periodic axes (Cox-Stuart thirds 213, Buys-Ballot
 * 215, Page-L 207) by the same argument.
 *
 * Headline question:
 * **"For each source, INTO HOW MANY VARIANCE REGIMES
 *   DOES THE GAP-FILLED DAILY TOKEN SERIES OPTIMALLY
 *   SEGMENT UNDER A BIC-PENALISED GAUSSIAN COST, AND
 *   AT WHICH DAYS DO THE REGIMES SWITCH?"**
 *
 * References:
 *   Killick, R., Fearnhead, P. & Eckley, I. A.,
 *     "Optimal Detection of Changepoints With a Linear
 *     Computational Cost", *JASA* 107 (2012), pp. 1590-
 *     1598. The PELT algorithm.
 *   Jackson, B., Scargle, J. D., Barnes, D., Arabhi,
 *     S., Alt, A., Gioumousis, P., Gwin, E., Sangtrakul-
 *     panit, P., Tan, L. & Tsai, T. T., "An algorithm
 *     for optimal partitioning of data on an interval",
 *     *IEEE Signal Processing Letters* 12 (2005), pp.
 *     105-108. Optimal partitioning predecessor.
 *   Schwarz, G., "Estimating the dimension of a model",
 *     *Annals of Statistics* 6 (1978), pp. 461-464. BIC
 *     penalty.
 *   Chen, J. & Gupta, A. K., *Parametric Statistical
 *     Change Point Analysis* (Birkhauser, 2012). Variance
 *     change cost derivation.
 *
 * Caveats:
 *   - HARD FLOOR n >= 21. Below ~20 the BIC penalty
 *     dominates and PELT collapses to m = 0.
 *   - MIN-SEGMENT-LENGTH = 2 to keep variance estimates
 *     defined; segments of length 1 are excluded from
 *     candidate split points.
 *   - The Gaussian cost (3) assumes finite fourth
 *     moment of x. Heavy-tailed sources can produce
 *     spurious additional changepoints around extreme
 *     spikes. Pair with axis-223 ICSS (single-best
 *     candidate) for cross-validation.
 *   - PELT with K = 0 is EXACT for sub-additive Gaussian
 *     variance cost; we do NOT use the Killick et al.
 *     binary-segmentation-warm-start option.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-killick-pelt-variance-segmentation
 *   pew-insights daily-token-killick-pelt-variance-segmentation --json
 *   pew-insights daily-token-killick-pelt-variance-segmentation --sort mChangepointsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenKillickPeltVarianceSegmentationSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'costReduction'
  | 'costReductionDesc'
  | 'varRangeRatio'
  | 'varRangeRatioDesc'
  | 'varHomogeneity'
  | 'varHomogeneityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKillickPeltVarianceSegmentationOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKillickPeltVarianceSegmentationSort;
  /** BIC multiplier; default 2 (two d.o.f. per added segment). */
  betaK?: number;
  /** Variance floor to prevent log(0). Default 1e-12. */
  varFloor?: number;
  generatedAt?: string;
}

export interface PeltSegment {
  /** Inclusive start index into the gap-filled series. */
  tStart: number;
  /** Exclusive end index. */
  tEndExclusive: number;
  length: number;
  varSeg: number;
  /** ln(varSeg / varGlobal); 0 if varGlobal = 0. */
  logVarRel: number;
}

export interface DailyTokenKillickPeltVarianceSegmentationSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Number of estimated changepoints = segments - 1; >= 0. */
  mChangepoints: number;
  segments: PeltSegment[];
  /** Internal changepoint indices (ascending), in {1..n-1}. */
  tauStar: number[];
  /** ISO day at each tau. */
  tauStarDays: string[];
  /** max(varSeg) / min(varSeg) across segments with length >= 3, varSeg > 0. */
  varRangeRatio: number;
  /** F(n), final BIC-penalised cost. */
  cost: number;
  /** Single-segment Gaussian cost C(y[0..n-1]). */
  costNoSegmentation: number;
  /** costNoSegmentation - cost; >= 0 by optimality. */
  costReduction: number;
  /** 1 - logVarSpread / (logVarSpread + 1), in (0, 1]. */
  varHomogeneity: number;
}

export interface DailyTokenKillickPeltVarianceSegmentationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKillickPeltVarianceSegmentationSort;
  betaK: number;
  varFloor: number;
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
  sources: DailyTokenKillickPeltVarianceSegmentationSourceRow[];
}

export interface PeltSummary {
  /** Changepoint indices in {1..n-1}, ascending. Length = m. */
  tauStar: number[];
  /** F(n) at termination. */
  cost: number;
  /** Length-(m+1) array of segment variances aligned with [tau_j, tau_{j+1}). */
  segVars: number[];
}

/**
 * Pure PELT segmentation under Gaussian-variance cost
 * with mean fixed at 0. Caller is responsible for mean-
 * centring; this function does NOT re-centre.
 *
 *   centred: real-valued series of length n >= 2.
 *   beta:   BIC penalty per added segment (>= 0).
 *   varFloor: small positive floor on segment variance
 *             to keep the log-likelihood finite.
 *
 * Throws on n < 2, beta < 0, or varFloor <= 0. Returns
 * tauStar = [] for n < 4 or when beta dominates.
 */
export function peltVarianceSegment(
  centred: number[],
  beta: number,
  varFloor: number,
): PeltSummary {
  const n = centred.length;
  if (n < 2) {
    throw new Error(`peltVarianceSegment: need n >= 2 (got ${n})`);
  }
  if (!Number.isFinite(beta) || beta < 0) {
    throw new Error(`peltVarianceSegment: beta must be >= 0 (got ${beta})`);
  }
  if (!Number.isFinite(varFloor) || varFloor <= 0) {
    throw new Error(
      `peltVarianceSegment: varFloor must be > 0 (got ${varFloor})`,
    );
  }
  // Cumulative sum of squares so segment cost is O(1).
  const cs: number[] = new Array(n + 1);
  cs[0] = 0;
  for (let i = 0; i < n; i += 1) {
    cs[i + 1] = cs[i]! + centred[i]! * centred[i]!;
  }
  const LN2PI = Math.log(2 * Math.PI);
  // Gaussian variance cost on segment [t..s-1], inclusive of both endpoints.
  function segCost(t: number, s: number): number {
    const L = s - t;
    if (L <= 0) return 0;
    const ss = cs[s]! - cs[t]!;
    let sigma2 = ss / L;
    if (sigma2 < varFloor) sigma2 = varFloor;
    return L * (LN2PI + Math.log(sigma2) + 1);
  }
  // F[s] = min cost for partitioning y[0..s-1].
  const F: number[] = new Array(n + 1);
  F[0] = -beta;
  // backpointer: prev[s] = optimal last changepoint for F[s]
  const prev: number[] = new Array(n + 1);
  prev[0] = 0;
  // R = active candidate set; min seg length = 2, so candidates t for s
  // must satisfy s - t >= 2.
  let R: number[] = [0];
  for (let s = 1; s <= n; s += 1) {
    let best = Number.POSITIVE_INFINITY;
    let bestT = 0;
    for (const t of R) {
      // enforce min segment length 2 (segments of length 1 have undefined variance)
      if (s - t < 2) continue;
      const v = F[t]! + segCost(t, s) + beta;
      if (v < best) {
        best = v;
        bestT = t;
      }
    }
    if (!Number.isFinite(best)) {
      // s = 1 has no t with s - t >= 2; carry forward by greedy length-1 cost.
      best = F[0]! + segCost(0, s) + beta;
      bestT = 0;
    }
    F[s] = best;
    prev[s] = bestT;
    // PELT pruning step (K = 0 for sub-additive variance cost):
    //   keep t in R only if F[t] + segCost(t, s) <= F[s].
    const Rnext: number[] = [];
    for (const t of R) {
      if (F[t]! + segCost(t, s) <= F[s]!) Rnext.push(t);
    }
    Rnext.push(s);
    R = Rnext;
  }
  // Backtrack changepoints.
  const tauStar: number[] = [];
  let cur = n;
  while (cur > 0) {
    const p = prev[cur]!;
    if (p > 0) tauStar.push(p);
    cur = p;
    if (cur < 0) break;
  }
  tauStar.reverse();
  // Compute segment variances from final partition: 0, tauStar[0], ..., n.
  const bounds = [0, ...tauStar, n];
  const segVars: number[] = [];
  for (let j = 0; j + 1 < bounds.length; j += 1) {
    const t = bounds[j]!;
    const u = bounds[j + 1]!;
    const L = u - t;
    if (L <= 0) {
      segVars.push(0);
      continue;
    }
    const ss = cs[u]! - cs[t]!;
    segVars.push(ss / L);
  }
  return { tauStar, cost: F[n]!, segVars };
}

/**
 * Killick-Fearnhead-Eckley 2012 PELT variance
 * segmentation summary on a gap-filled daily series of
 * length n >= 21. Throws on non-finite or negative
 * weights. The series is mean-centred internally;
 * constant series throw zero-variance.
 */
export function dailyTokenKillickPeltVarianceSegmentation(
  weights: number[],
  betaK = 2,
  varFloor = 1e-12,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  beta: number;
  tauStar: number[];
  segVars: number[];
  cost: number;
  costNoSegmentation: number;
  costReduction: number;
  mChangepoints: number;
  varRangeRatio: number;
  varHomogeneity: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenKillickPeltVarianceSegmentation: need at least 21 samples (got ${n})`,
    );
  }
  if (!Number.isFinite(betaK) || betaK < 0) {
    throw new Error(
      `dailyTokenKillickPeltVarianceSegmentation: betaK must be >= 0 (got ${betaK})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenKillickPeltVarianceSegmentation requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenKillickPeltVarianceSegmentation requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  for (let i = 0; i < n; i += 1) sumW += weights[i]!;
  const mean = sumW / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  if (denom === 0) {
    throw new Error(
      `dailyTokenKillickPeltVarianceSegmentation: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(denom / n);
  const centred: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) centred[i] = weights[i]! - mean;
  const beta = betaK * Math.log(n);
  const sm = peltVarianceSegment(centred, beta, varFloor);
  // Single-segment Gaussian cost C(y[0..n-1]):
  let ss = 0;
  for (let i = 0; i < n; i += 1) ss += centred[i]! * centred[i]!;
  let sigma2Glob = ss / n;
  if (sigma2Glob < varFloor) sigma2Glob = varFloor;
  const LN2PI = Math.log(2 * Math.PI);
  const costNoSegmentation = n * (LN2PI + Math.log(sigma2Glob) + 1);
  // F(n) includes (m+1) * beta penalties; the no-segmentation baseline F(n|m=0)
  // = costNoSegmentation + beta. Compute reduction relative to single-segment:
  const baselineCost = costNoSegmentation + beta;
  const costReduction = Math.max(0, baselineCost - sm.cost);
  const m = sm.tauStar.length;
  // varRangeRatio across segments with length >= 3 and var > 0
  let mn = Number.POSITIVE_INFINITY;
  let mx = 0;
  const bounds = [0, ...sm.tauStar, n];
  for (let j = 0; j + 1 < bounds.length; j += 1) {
    const L = bounds[j + 1]! - bounds[j]!;
    if (L < 3) continue;
    const v = sm.segVars[j]!;
    if (v <= 0) continue;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  let varRangeRatio: number;
  if (m === 0 || !Number.isFinite(mn) || mn === 0) {
    varRangeRatio = 1;
  } else {
    const r = mx / mn;
    varRangeRatio = Number.isFinite(r) ? Math.min(r, 1e12) : 1e12;
  }
  // varHomogeneity from log-var spread
  let logVarSpread = 0;
  for (const v of sm.segVars) {
    if (v <= 0 || sigma2Glob <= 0) continue;
    const lr = Math.abs(Math.log(v / sigma2Glob));
    if (lr > logVarSpread) logVarSpread = lr;
  }
  const varHomogeneity = 1 - logVarSpread / (logVarSpread + 1);
  return {
    mean,
    stddev,
    nSamples: n,
    beta,
    tauStar: sm.tauStar,
    segVars: sm.segVars,
    cost: sm.cost,
    costNoSegmentation,
    costReduction,
    mChangepoints: m,
    varRangeRatio,
    varHomogeneity,
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

export function buildDailyTokenKillickPeltVarianceSegmentation(
  queue: QueueLine[],
  opts: DailyTokenKillickPeltVarianceSegmentationOptions = {},
): DailyTokenKillickPeltVarianceSegmentationReport {
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
  const sort: DailyTokenKillickPeltVarianceSegmentationSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenKillickPeltVarianceSegmentationSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'costReduction',
    'costReductionDesc',
    'varRangeRatio',
    'varRangeRatioDesc',
    'varHomogeneity',
    'varHomogeneityDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const betaK = opts.betaK ?? 2;
  if (!Number.isFinite(betaK) || betaK < 0) {
    throw new Error(`betaK must be a non-negative finite number (got ${opts.betaK})`);
  }
  const varFloor = opts.varFloor ?? 1e-12;
  if (!Number.isFinite(varFloor) || varFloor <= 0) {
    throw new Error(`varFloor must be > 0 (got ${opts.varFloor})`);
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
  const rows: DailyTokenKillickPeltVarianceSegmentationSourceRow[] = [];

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
      result = dailyTokenKillickPeltVarianceSegmentation(filled, betaK, varFloor);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    // Compute global var for logVarRel
    const sumX = filled.reduce((a, b) => a + b, 0);
    const meanX = sumX / nTenure;
    let ssGlob = 0;
    for (let i = 0; i < nTenure; i += 1) {
      const c = filled[i]! - meanX;
      ssGlob += c * c;
    }
    const varGlob = ssGlob / nTenure;
    const bounds = [0, ...result.tauStar, nTenure];
    const segments: PeltSegment[] = [];
    for (let j = 0; j + 1 < bounds.length; j += 1) {
      const t = bounds[j]!;
      const u = bounds[j + 1]!;
      const L = u - t;
      const v = result.segVars[j]!;
      const logVarRel =
        v > 0 && varGlob > 0 ? Math.log(v / varGlob) : 0;
      segments.push({
        tStart: t,
        tEndExclusive: u,
        length: L,
        varSeg: v,
        logVarRel,
      });
    }
    const tauStarDays = result.tauStar.map((t) => addUtcDays(acc.firstDay, t));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mChangepoints: result.mChangepoints,
      segments,
      tauStar: result.tauStar,
      tauStarDays,
      varRangeRatio: result.varRangeRatio,
      cost: result.cost,
      costNoSegmentation: result.costNoSegmentation,
      costReduction: result.costReduction,
      varHomogeneity: result.varHomogeneity,
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
      case 'costReduction':
        primary = a.costReduction - b.costReduction;
        break;
      case 'costReductionDesc':
        primary = b.costReduction - a.costReduction;
        break;
      case 'varRangeRatio':
        primary = a.varRangeRatio - b.varRangeRatio;
        break;
      case 'varRangeRatioDesc':
        primary = b.varRangeRatio - a.varRangeRatio;
        break;
      case 'varHomogeneity':
        primary = a.varHomogeneity - b.varHomogeneity;
        break;
      case 'varHomogeneityDesc':
        primary = b.varHomogeneity - a.varHomogeneity;
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
    betaK,
    varFloor,
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
