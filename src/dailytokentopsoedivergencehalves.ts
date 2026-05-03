/**
 * daily-token-topsoe-divergence-halves: per-source
 * KDE-SMOOTHED TOPSOE DIVERGENCE between the FIRST
 * and SECOND half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-THIRTY-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129/130/131/
 * 132/133/134/135/136/137 for direct comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h is Silverman's rule of thumb on the POOLED
 * sample with the robust scale:
 *
 *     h = 0.9 * mad_pool * n^(-1/5)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side; pmfs
 * p, q are obtained by Gaussian KDE per half then trapezoidal
 * mass-normalisation. (Bit-exact same setup as axes 126-137.)
 *
 * TOPSOE DIVERGENCE (Topsoe 2000; Cha 2007 eq. 40):
 *
 *     T(p, q) = sum_k [ p_k * log( 2*p_k / (p_k + q_k) )
 *                      + q_k * log( 2*q_k / (p_k + q_k) ) ]
 *
 * Equivalently, T(p, q) = 2 * JSD(p, q) where JSD is the
 * Jensen-Shannon divergence; the per-bin summand is
 *
 *     t_k = p_k log(2 p_k/(p_k+q_k)) + q_k log(2 q_k/(p_k+q_k))
 *         = KL(p_k || M_k) + KL(q_k || M_k)
 *
 * with M_k = (p_k + q_k)/2 the per-bin midpoint mass.
 * Topsoe is symmetric in (p, q), non-negative, and BOUNDED
 * ABOVE BY 2*log(2) when p, q are pmfs. T(p, q) = 0 iff
 * p = q on the grid; T(p, q) = 2*log(2) iff p, q have
 * disjoint support on the grid. Topsoe is a TRUE METRIC
 * after taking sqrt (Endres & Schindelin 2003;
 * Osterreicher & Vajda 2003) but the raw form (axis-138)
 * is divergence-valued, not a metric.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-137:
 *
 *   - Class. p log(2p/(p+q)) + q log(2q/(p+q)). The summand
 *     is the SUM OF TWO KL-TO-MIDPOINT contributions. No
 *     prior half-vs-half axis uses log(2p/(p+q)) directly:
 *     axis-118 JSD aggregates the SAME KL-to-midpoint
 *     contributions but as a MEAN with explicit 0.5 weights
 *     and via the (p+q)/2 midpoint pmf rather than the
 *     bin-wise log(2p/(p+q)) form. axis-138 Topsoe is the
 *     UNNORMALISED sum and exposes the per-bin summand
 *     directly bounded in [0, 2*log(2)] per bin (and
 *     globally in [0, 2*log(2)]).
 *
 *   - vs axis-118 JSD = 0.5 KL(p||M) + 0.5 KL(q||M):
 *     T = 2 * JSD as values, but Topsoe DIAGNOSTICS
 *     (`topsoeMaxBin`, `topsoeSpreadRatio`,
 *     `topsoePerBinAverage`) report the per-bin
 *     summand on the natural Topsoe scale (range
 *     [0, 2*log(2)] per bin), distinct from JSD's
 *     (range [0, log(2)]). The Topsoe spread/maxBin
 *     diagnostics reveal where the symmetric KL mass
 *     concentrates without the JSD halving convention.
 *
 *   - vs axis-137 Kumar-Johnson = sum (p^2-q^2)^2/(2(pq)^(3/2)):
 *     KJ is POLYNOMIAL/RATIONAL with degree -1 overall and
 *     blow-up rate 1/min(p,q)^(3/2); Topsoe is LOGARITHMIC
 *     and BOUNDED ABOVE BY 2*log(2). Per-bin tail behaviour
 *     as q -> 0 with p fixed: KJ summand -> +infty
 *     polynomially; Topsoe summand -> p*log(2) (bounded).
 *
 *   - vs axis-136 Taneja = sum AM*log(AM/GM): Taneja uses
 *     the AM/GM ratio inside the log; Topsoe uses 2p/(p+q)
 *     and 2q/(p+q) -- the per-bin RATIO of each pmf to its
 *     ARITHMETIC MIDPOINT. Taneja is unbounded (AM/GM -> infty
 *     as min -> 0); Topsoe is bounded by 2*log(2).
 *
 *   - vs axis-135 Clark = sqrt(sum ((p-q)/(p+q))^2): Clark
 *     uses the per-bin RELATIVE gap |p-q|/(p+q) bounded in
 *     [0, 1]; Topsoe uses the per-bin RATIO p/((p+q)/2)
 *     inside a log. Clark is bounded by sqrt(K); Topsoe
 *     is bounded by 2*log(2) <= 1.3863.
 *
 *   - vs axis-134 psChi2 = sum (p-q)^2(p+q)/(p*q): psChi2
 *     is rational and unbounded; Topsoe is logarithmic and
 *     bounded.
 *
 *   - vs axis-129 triangular Delta = sum (p-q)^2/(p+q):
 *     Delta is bounded above by 2; Topsoe is bounded above
 *     by 2*log(2) <= 1.3863. Both bounded but Delta is
 *     polynomial in (p-q) while Topsoe is logarithmic.
 *
 *   - vs axis-122 Bhattacharyya BC = sum sqrt(p*q): Bhatt
 *     measures SIMILARITY in the per-bin GM coordinate;
 *     Topsoe measures DISSIMILARITY in the KL-to-midpoint
 *     coordinate.
 *
 * NUMERICAL FLOOR. The log-arguments 2p/(p+q) and 2q/(p+q)
 * vanish only at extreme tail bins where p or q underflows
 * to 0. We apply the SAME PMF_FLOOR = 1e-15 as axes
 * 134/135/136/137 to keep log(.) well-defined and preserve
 * cross-axis numerical comparability. The floor is a no-op
 * for any genuine KDE pmf and contributes at most
 * O(K * 1e-15 * |log(1e-15)|) ~ O(K * 1e-13) to the sum.
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     topsoeDivergence  = sum_k [p_k log(2p_k/(p_k+q_k))
 *                                + q_k log(2q_k/(p_k+q_k))]
 *                         in [0, 2*log(2)]
 *     topsoeMaxBin      = max_k of the per-bin summand
 *                         in [0, 2*log(2)]
 *     topsoeMaxRelGap   = max_k |p_k - q_k| / (p_k + q_k)
 *                         in [0, 1]
 *     topsoeSpreadRatio = topsoeDivergence /
 *                         (K * topsoeMaxBin)  in [0, 1]
 *
 * topsoeSpreadRatio approaches 1/K iff the divergence is
 * concentrated in a single bin and approaches 1 iff every
 * bin contributes the same maximal amount. Defined as 0
 * when topsoeMaxBin === 0 (vacuous case where halves
 * coincide). Cross-source-comparable: independent of the
 * overall divergence magnitude.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the TOPSOE divergence
 *   T = sum_k [p_k log(2 p_k/(p_k+q_k)) + q_k log(2 q_k/(p_k+q_k))],
 *   how strong is the half-vs-half drift WHEN EACH BIN IS
 *   PENALISED BY THE SUM OF THE TWO KL CONTRIBUTIONS TO
 *   THE PER-BIN MIDPOINT (a logarithmic, naturally bounded
 *   in [0, 2*log(2)], symmetric Jensen-Shannon-class
 *   functional)?"**
 *
 * References:
 *   Topsoe, F. (2000). "Some inequalities for information
 *     divergence and related measures of discrimination",
 *     IEEE Trans. Inf. Theory 46(4), 1602-1609.
 *   Endres, D. M. and Schindelin, J. E. (2003). "A new
 *     metric for probability distributions",
 *     IEEE Trans. Inf. Theory 49(7), 1858-1860.
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 40.
 *
 * Caveats:
 *
 *   - Topsoe divergence is symmetric and non-negative but
 *     NOT a metric (sqrt(T) is, however; Endres & Schindelin
 *     2003).
 *   - PMF_FLOOR = 1e-15 is a numerical safeguard, not a
 *     statistical regulariser.
 *   - Translation- AND positive-scale-invariant in the data
 *     (data and bandwidth scale together; pmfs unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-topsoe-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-topsoe-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Topsoe divergence ascending:
 *   pew-insights daily-token-topsoe-divergence-halves --sort topsoe
 */
import type { QueueLine } from './types.js';

export type DailyTokenTopsoeDivergenceHalvesSort =
  | 'topsoe'
  | 'topsoeDesc'
  | 'maxBin'
  | 'maxBinDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTopsoeDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenTopsoeDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenTopsoeDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  topsoeN1: number;
  topsoeN2: number;
  topsoeMadPool: number;
  topsoeBandwidth: number;
  topsoeGridLo: number;
  topsoeGridHi: number;
  topsoeGridDx: number;
  topsoeGridK: number;
  /** Topsoe divergence T(p,q) = sum_k [p_k log(2p_k/(p_k+q_k)) + q_k log(2q_k/(p_k+q_k))] in [0, 2*log(2)]. */
  topsoeDivergence: number;
  /** Largest per-bin Topsoe summand in [0, 2*log(2)]. */
  topsoeMaxBin: number;
  /**
   * max_k |p_k - q_k| / (p_k + q_k) in [0, 1]; saturates
   * iff at least one bin is regime-disjoint (one half put
   * effectively zero mass while the other did not).
   */
  topsoeMaxRelGap: number;
  /**
   * Spread diagnostic topsoeDivergence /
   * (K * topsoeMaxBin) in [0, 1]. Approaches 1 iff
   * every bin contributes the same maximal Topsoe amount
   * (broad, evenly-spread asymmetry); approaches 1/K iff
   * the Topsoe mass is concentrated in a single bin. Defined
   * as 0 when topsoeMaxBin === 0 (vacuous case
   * where halves coincide). Cross-source-comparable:
   * INDEPENDENT of overall divergence magnitude.
   */
  topsoeSpreadRatio: number;
  /**
   * Cross-source-comparable scale-free magnitude diagnostic
   * `topsoePerBinAverage = topsoeDivergence / K` -- the
   * MEAN per-bin Topsoe summand on the K=257-point grid.
   * Bounded above by 2*log(2)/K when K bins are saturated
   * uniformly (tight only at the disjoint-support
   * extreme). >= 0; equals 0 iff `p == q` on every bin.
   * Directly comparable across sources at the SAME grid
   * resolution.
   */
  topsoePerBinAverage: number;
}

export interface DailyTokenTopsoeDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTopsoeDivergenceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  gridK: number;
  silvermanMultiplier: number;
  pmfFloor: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenTopsoeDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126-137). */
export const TOPSOE_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const TOPSOE_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const TOPSOE_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins for the (p*q)^(3/2) denominator. */
export const TOPSOE_PMF_FLOOR = 1e-15;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function gaussianPdf(u: number): number {
  return Math.exp(-0.5 * u * u) / SQRT_2PI;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * Pure per-bin Topsoe summand. Exposed for downstream
 * tooling that wants to inspect the bin-wise contribution
 * without re-running the full KDE pipeline.
 *
 *     topsoeSummand(p, q) = p * log(2p / (p+q)) + q * log(2q / (p+q))
 *
 * This is the per-bin contribution to Topsoe divergence
 * T(p, q) = sum_k topsoeSummand(p_k, q_k). Equivalently,
 * `topsoeSummand(p, q) = 2 * jensenShannonSummand(p, q)`,
 * i.e. Topsoe equals twice the Jensen-Shannon divergence
 * (Cha 2007 eq. 40; Topsoe 2000).
 *
 * Both `p` and `q` are floored at TOPSOE_PMF_FLOOR to keep
 * the log-arguments strictly positive under IEEE-754
 * underflow at extreme tail bins.
 *
 * Identities verified by the test suite:
 *
 *   - topsoeSummand(p, q) === topsoeSummand(q, p)   (symmetric)
 *   - topsoeSummand(p, p) === 0                     (vanishes on the diagonal)
 *   - topsoeSummand(p, q) >= 0                      (non-negative)
 *   - topsoeSummand(p, 0) = p * log(2)              (bounded mass-only contribution)
 *   - topsoeSummand(0, q) = q * log(2)
 */
export function topsoeSummand(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    throw new Error('topsoeSummand requires finite inputs');
  }
  if (p < 0 || q < 0) {
    throw new Error('topsoeSummand requires non-negative inputs');
  }
  const pf = p < TOPSOE_PMF_FLOOR ? TOPSOE_PMF_FLOOR : p;
  const qf = q < TOPSOE_PMF_FLOOR ? TOPSOE_PMF_FLOOR : q;
  const sumPq = pf + qf;
  const tp = pf * Math.log((2 * pf) / sumPq);
  const tq = qf * Math.log((2 * qf) / sumPq);
  return tp + tq;
}

/**
 * KDE-smoothed Topsoe divergence between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - topsoeDivergence(x + c) === topsoeDivergence(x).
 *   - topsoeDivergence(k*x) === topsoeDivergence(x) for k > 0.
 *   - topsoeDivergence >= 0.
 *   - topsoeDivergence === 0 iff p === q on the grid.
 *   - Symmetric: swapping the two halves preserves the value.
 *   - topsoeMaxRelGap in [0, 1].
 *   - topsoeMaxBin >= 0.
 */
export function dailyTokenTopsoeDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  topsoeN1: number;
  topsoeN2: number;
  topsoeMadPool: number;
  topsoeBandwidth: number;
  topsoeGridLo: number;
  topsoeGridHi: number;
  topsoeGridDx: number;
  topsoeGridK: number;
  topsoeDivergence: number;
  topsoeMaxBin: number;
  topsoeMaxRelGap: number;
  topsoeSpreadRatio: number;
  topsoePerBinAverage: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenTopsoeDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenTopsoeDivergenceHalves requires finite values');
    }
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let denomVar = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denomVar += c * c;
  }
  const stddev = Math.sqrt(denomVar / n);
  if (denomVar === 0) {
    throw new Error(
      `dailyTokenTopsoeDivergenceHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const A = values.slice(0, n1);
  const B = values.slice(n1);

  const medPool = median(values);
  const absDev: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) absDev[i] = Math.abs(values[i]! - medPool);
  const madPool = 1.4826 * median(absDev);

  let h = TOPSOE_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = TOPSOE_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - TOPSOE_GRID_EXTENSION_H * h;
  const gHi = mx + TOPSOE_GRID_EXTENSION_H * h;
  const K = TOPSOE_GRID_K;
  const dx = (gHi - gLo) / (K - 1);

  const fA: number[] = new Array(K);
  const fB: number[] = new Array(K);
  const invH = 1 / h;
  const invN1H = 1 / (n1 * h);
  const invN2H = 1 / (n2 * h);
  for (let k = 0; k < K; k += 1) {
    const gk = gLo + k * dx;
    let sa = 0;
    for (let i = 0; i < n1; i += 1) {
      sa += gaussianPdf((gk - A[i]!) * invH);
    }
    fA[k] = sa * invN1H;
    let sb = 0;
    for (let i = 0; i < n2; i += 1) {
      sb += gaussianPdf((gk - B[i]!) * invH);
    }
    fB[k] = sb * invN2H;
  }

  const w: number[] = new Array(K);
  for (let k = 0; k < K; k += 1) {
    w[k] = k === 0 || k === K - 1 ? dx / 2 : dx;
  }
  let zA = 0;
  let zB = 0;
  for (let k = 0; k < K; k += 1) {
    zA += w[k]! * fA[k]!;
    zB += w[k]! * fB[k]!;
  }
  if (!(zA > 0) || !(zB > 0) || !Number.isFinite(zA) || !Number.isFinite(zB)) {
    throw new Error(
      `dailyTokenTopsoeDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sum = 0;
  let maxBin = 0;
  let maxRelGap = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < TOPSOE_PMF_FLOOR) pk = TOPSOE_PMF_FLOOR;
    if (qk < TOPSOE_PMF_FLOOR) qk = TOPSOE_PMF_FLOOR;
    const sumPq = pk + qk;
    const tp = pk * Math.log((2 * pk) / sumPq);
    const tq = qk * Math.log((2 * qk) / sumPq);
    const term = tp + tq;
    sum += term;
    if (term > maxBin) maxBin = term;
    const relGap = Math.abs(pk - qk) / (pk + qk);
    if (relGap > maxRelGap) maxRelGap = relGap;
  }
  // The pure `topsoeSummand(p, q)` helper exposes the
  // same per-bin computation for downstream tooling; we keep
  // the inlined hot loop here to avoid per-bin function-call
  // overhead on the K=257 grid.

  const topsoeDivergence = sum;
  const topsoeMaxBin = maxBin;
  const topsoeMaxRelGap = maxRelGap;
  const topsoeSpreadRatio =
    topsoeMaxBin > 0
      ? topsoeDivergence / (K * topsoeMaxBin)
      : 0;
  const topsoePerBinAverage = topsoeDivergence / K;

  if (
    !Number.isFinite(topsoeDivergence) ||
    !Number.isFinite(topsoeMaxBin) ||
    !Number.isFinite(topsoeMaxRelGap) ||
    !Number.isFinite(topsoeSpreadRatio) ||
    !Number.isFinite(topsoePerBinAverage)
  ) {
    throw new Error(
      `dailyTokenTopsoeDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    topsoeN1: n1,
    topsoeN2: n2,
    topsoeMadPool: madPool,
    topsoeBandwidth: h,
    topsoeGridLo: gLo,
    topsoeGridHi: gHi,
    topsoeGridDx: dx,
    topsoeGridK: K,
    topsoeDivergence,
    topsoeMaxBin,
    topsoeMaxRelGap,
    topsoeSpreadRatio,
    topsoePerBinAverage,
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

export function buildDailyTokenTopsoeDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenTopsoeDivergenceHalvesOptions = {},
): DailyTokenTopsoeDivergenceHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenTopsoeDivergenceHalvesSort = opts.sort ?? 'topsoeDesc';
  const validSorts: DailyTokenTopsoeDivergenceHalvesSort[] = [
    'topsoe',
    'topsoeDesc',
    'maxBin',
    'maxBinDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
  const rows: DailyTokenTopsoeDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenTopsoeDivergenceHalves(filled);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('zero centred variance') || msg.includes('KDE mass')) {
        droppedZeroVariance += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
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
      topsoeN1: result.topsoeN1,
      topsoeN2: result.topsoeN2,
      topsoeMadPool: result.topsoeMadPool,
      topsoeBandwidth: result.topsoeBandwidth,
      topsoeGridLo: result.topsoeGridLo,
      topsoeGridHi: result.topsoeGridHi,
      topsoeGridDx: result.topsoeGridDx,
      topsoeGridK: result.topsoeGridK,
      topsoeDivergence: result.topsoeDivergence,
      topsoeMaxBin: result.topsoeMaxBin,
      topsoeMaxRelGap: result.topsoeMaxRelGap,
      topsoeSpreadRatio: result.topsoeSpreadRatio,
      topsoePerBinAverage: result.topsoePerBinAverage,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'topsoe':
        primary = a.topsoeDivergence - b.topsoeDivergence;
        break;
      case 'topsoeDesc':
        primary = b.topsoeDivergence - a.topsoeDivergence;
        break;
      case 'maxBin':
        primary = a.topsoeMaxBin - b.topsoeMaxBin;
        break;
      case 'maxBinDesc':
        primary = b.topsoeMaxBin - a.topsoeMaxBin;
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
    gridK: TOPSOE_GRID_K,
    silvermanMultiplier: TOPSOE_SILVERMAN_MULTIPLIER,
    pmfFloor: TOPSOE_PMF_FLOOR,
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
