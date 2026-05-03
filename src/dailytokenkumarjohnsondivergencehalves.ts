/**
 * daily-token-kumar-johnson-divergence-halves: per-source
 * KDE-SMOOTHED KUMAR-JOHNSON DIVERGENCE between the FIRST
 * and SECOND half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-THIRTY-SEVENTH cross-source axis.
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
 * 132/133/134/135/136 for direct comparability of bandwidth):
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
 * mass-normalisation. (Bit-exact same setup as axes 126-136.)
 *
 * KUMAR-JOHNSON DIVERGENCE (Kumar & Johnson 2005;
 * Cha 2007 eq. 51):
 *
 *     KJ(p, q) = sum_k  (p_k^2 - q_k^2)^2
 *                       / ( 2 * (p_k * q_k)^(3/2) )
 *
 * The numerator factors as (p-q)^2 * (p+q)^2: a per-bin
 * SQUARED ABSOLUTE GAP times a per-bin SQUARED ARITHMETIC
 * MEAN (twice). The denominator is the per-bin GEOMETRIC
 * MEAN raised to the 3/2 power. So KJ weights each bin by
 * a polynomial in p, q with TOTAL DEGREE -1 (numerator
 * degree 4, denominator degree 3) but with very strong
 * asymmetric tail behaviour: as min(p, q) -> 0 the per-bin
 * summand grows POLYNOMIALLY in 1/(p*q)^(3/2).
 *
 * KJ is symmetric under swap of p, q (the numerator is even
 * in (p - q) and the denominator in (p, q)) and non-negative
 * (sum of squares over a positive denominator). KJ(p, q) = 0
 * iff p = q on the grid.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-136:
 *
 *   - Class. (p^2 - q^2)^2 / GM^3. The numerator is the
 *     SQUARE of the per-bin DIFFERENCE OF SQUARES; the
 *     denominator is the cube of the per-bin GEOMETRIC
 *     MEAN. No prior half-vs-half axis uses (p^2-q^2)^2
 *     in the numerator NOR (p*q)^(3/2) in the denominator.
 *
 *   - vs axis-134 psChi2 = sum (p-q)^2 (p+q)/(p*q):
 *     psChi2 has numerator (p-q)^2*(p+q) (degree 3) and
 *     denominator p*q (degree 2). KJ has numerator
 *     (p-q)^2*(p+q)^2 (degree 4) and denominator
 *     (p*q)^(3/2) (degree 3). KJ is MORE-than-quadratic
 *     in the per-bin AM and HALF-INTEGER-degree in the
 *     per-bin GM -- a strictly different rational function
 *     of (p, q). In particular the per-bin tail blow-up
 *     rate as min(p, q) -> 0 is 1/min^(3/2) for KJ vs
 *     1/min for psChi2; KJ is more aggressive on extreme
 *     tail bins than psChi2.
 *
 *   - vs axis-136 Taneja = sum AM*log(AM/GM): Taneja is
 *     LOGARITHMIC in the AM/GM ratio; KJ is POLYNOMIAL.
 *     Taneja saturates LOGARITHMICALLY as AM/GM -> infty;
 *     KJ saturates as a power of (p^2-q^2)^2 / GM^3.
 *     Different classes of f-divergence-like functional.
 *
 *   - vs axis-129 triangular Delta = sum (p-q)^2/(p+q):
 *     Delta is bounded above by 2 (Cha 2007); KJ is
 *     unbounded above as min(p, q) -> 0. Delta is degree
 *     1 in (p, q) overall; KJ is degree -1. Delta divides
 *     by AM; KJ divides by GM^3. Different normaliser
 *     class entirely.
 *
 *   - vs axis-122 Bhattacharyya BC = sum sqrt(p*q): Bhatt
 *     is LINEAR in the per-bin GM and aggregates similarity
 *     (so peak similarity = peak BC); KJ is rational in
 *     the per-bin GM and aggregates dissimilarity (peak
 *     dissimilarity = peak KJ). Bhatt is bounded in [0, 1];
 *     KJ is unbounded above.
 *
 *   - vs axis-135 Clark = sqrt(sum ((p-q)/(p+q))^2): Clark
 *     uses the per-bin RELATIVE gap |p-q|/(p+q) bounded in
 *     [0, 1] BEFORE squaring; KJ uses (p^2-q^2)^2 / GM^3
 *     which is unbounded. Clark is bounded above by sqrt(K);
 *     KJ has no a-priori upper bound.
 *
 *   - vs axis-118 JSD: JSD is a mean of two KL divergences
 *     bounded by log(2). KJ is polynomial in (p, q) and
 *     unbounded. JSD penalises log-ratio gaps; KJ penalises
 *     squared-difference-of-squares gaps.
 *
 * NUMERICAL FLOOR. The denominator (p*q)^(3/2) underflows
 * to zero in IEEE-754 only at extreme tail bins. We apply
 * the SAME PMF_FLOOR = 1e-15 as axes 134/135/136 to keep
 * the rational function well-defined and preserve cross-axis
 * numerical comparability. The floor is a no-op for any
 * genuine KDE pmf.
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     kumarJohnsonDivergence = sum_k (p_k^2-q_k^2)^2 /
 *                                    (2 * (p_k*q_k)^(3/2))
 *     kumarJohnsonMaxBin     = max_k of the per-bin summand
 *     kumarJohnsonMaxRelGap  = max_k |p_k - q_k| / (p_k + q_k)
 *                              in [0, 1]
 *     kumarJohnsonSpreadRatio = kumarJohnsonDivergence /
 *                               (K * kumarJohnsonMaxBin)
 *                               in [0, 1]
 *
 * kumarJohnsonSpreadRatio approaches 1/K iff the divergence
 * is concentrated in a single bin and approaches 1 iff every
 * bin contributes the same maximal amount. Defined as 0
 * when kumarJohnsonMaxBin === 0 (vacuous case where halves
 * coincide). Cross-source-comparable: independent of the
 * overall divergence magnitude.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the KUMAR-JOHNSON divergence
 *   KJ = sum_k (p_k^2 - q_k^2)^2 / (2 (p_k q_k)^(3/2)),
 *   how strong is the half-vs-half drift WHEN EACH BIN
 *   IS PENALISED BY ITS SQUARED DIFFERENCE-OF-SQUARES
 *   NORMALISED BY THE 3/2 POWER OF ITS GEOMETRIC MEAN
 *   (so disagreement on extreme tails is amplified
 *   POLYNOMIALLY rather than logarithmically)?"**
 *
 * References:
 *   Kumar, P. and Johnson, A. (2005). "On a symmetric
 *     divergence measure and information inequalities",
 *     J. Inequalities in Pure & Applied Math 6(3), Art. 65.
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 51.
 *
 * Caveats:
 *
 *   - Kumar-Johnson divergence is symmetric and non-negative
 *     but NOT a metric (no triangle inequality; Cha 2007).
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
 *   pew-insights daily-token-kumar-johnson-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-kumar-johnson-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Kumar-Johnson divergence ascending:
 *   pew-insights daily-token-kumar-johnson-divergence-halves --sort kj
 */
import type { QueueLine } from './types.js';

export type DailyTokenKumarJohnsonDivergenceHalvesSort =
  | 'kj'
  | 'kjDesc'
  | 'maxBin'
  | 'maxBinDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKumarJohnsonDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKumarJohnsonDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenKumarJohnsonDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  kjN1: number;
  kjN2: number;
  kjMadPool: number;
  kjBandwidth: number;
  kjGridLo: number;
  kjGridHi: number;
  kjGridDx: number;
  kjGridK: number;
  /** Kumar-Johnson divergence sum_k (p^2-q^2)^2 / (2 (p*q)^(3/2)) >= 0. */
  kumarJohnsonDivergence: number;
  /** Largest per-bin summand contributing to the KJ sum. */
  kumarJohnsonMaxBin: number;
  /**
   * max_k |p_k - q_k| / (p_k + q_k) in [0, 1]; saturates
   * iff at least one bin is regime-disjoint (one half put
   * effectively zero mass while the other did not).
   */
  kumarJohnsonMaxRelGap: number;
  /**
   * Spread diagnostic kumarJohnsonDivergence /
   * (K * kumarJohnsonMaxBin) in [0, 1]. Approaches 1 iff
   * every bin contributes the same maximal KJ amount
   * (broad, evenly-spread asymmetry); approaches 1/K iff
   * the KJ mass is concentrated in a single bin. Defined
   * as 0 when kumarJohnsonMaxBin === 0 (vacuous case
   * where halves coincide). Cross-source-comparable:
   * INDEPENDENT of overall divergence magnitude.
   */
  kumarJohnsonSpreadRatio: number;
}

export interface DailyTokenKumarJohnsonDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKumarJohnsonDivergenceHalvesSort;
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
  sources: DailyTokenKumarJohnsonDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126-136). */
export const KJ_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const KJ_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const KJ_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins for the (p*q)^(3/2) denominator. */
export const KJ_PMF_FLOOR = 1e-15;

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
 * Pure per-bin Kumar-Johnson summand. Exposed for downstream
 * tooling that wants to inspect the bin-wise contribution
 * without re-running the full KDE pipeline.
 *
 *     kumarJohnsonSummand(p, q) = (p^2 - q^2)^2 / (2 * (p*q)^(3/2))
 *
 * Both `p` and `q` are floored at KJ_PMF_FLOOR to keep the
 * denominator well-defined under IEEE-754 underflow at
 * extreme tail bins.
 *
 * Identities verified by the test suite:
 *
 *   - kumarJohnsonSummand(p, q) === kumarJohnsonSummand(q, p)
 *   - kumarJohnsonSummand(p, p) === 0
 *   - kumarJohnsonSummand(p, q) >= 0
 */
export function kumarJohnsonSummand(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    throw new Error('kumarJohnsonSummand requires finite inputs');
  }
  if (p < 0 || q < 0) {
    throw new Error('kumarJohnsonSummand requires non-negative inputs');
  }
  const pf = p < KJ_PMF_FLOOR ? KJ_PMF_FLOOR : p;
  const qf = q < KJ_PMF_FLOOR ? KJ_PMF_FLOOR : q;
  const diffSq = (pf * pf - qf * qf);
  const num = diffSq * diffSq;
  const pq = pf * qf;
  const denom = 2 * Math.pow(pq, 1.5);
  return num / denom;
}

/**
 * KDE-smoothed Kumar-Johnson divergence between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - kumarJohnsonDivergence(x + c) === kumarJohnsonDivergence(x).
 *   - kumarJohnsonDivergence(k*x) === kumarJohnsonDivergence(x) for k > 0.
 *   - kumarJohnsonDivergence >= 0.
 *   - kumarJohnsonDivergence === 0 iff p === q on the grid.
 *   - Symmetric: swapping the two halves preserves the value.
 *   - kumarJohnsonMaxRelGap in [0, 1].
 *   - kumarJohnsonMaxBin >= 0.
 */
export function dailyTokenKumarJohnsonDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  kjN1: number;
  kjN2: number;
  kjMadPool: number;
  kjBandwidth: number;
  kjGridLo: number;
  kjGridHi: number;
  kjGridDx: number;
  kjGridK: number;
  kumarJohnsonDivergence: number;
  kumarJohnsonMaxBin: number;
  kumarJohnsonMaxRelGap: number;
  kumarJohnsonSpreadRatio: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenKumarJohnsonDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenKumarJohnsonDivergenceHalves requires finite values');
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
      `dailyTokenKumarJohnsonDivergenceHalves: zero centred variance (n=${n})`,
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

  let h = KJ_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = KJ_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - KJ_GRID_EXTENSION_H * h;
  const gHi = mx + KJ_GRID_EXTENSION_H * h;
  const K = KJ_GRID_K;
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
      `dailyTokenKumarJohnsonDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sum = 0;
  let maxBin = 0;
  let maxRelGap = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < KJ_PMF_FLOOR) pk = KJ_PMF_FLOOR;
    if (qk < KJ_PMF_FLOOR) qk = KJ_PMF_FLOOR;
    const diffSq = pk * pk - qk * qk;
    const num = diffSq * diffSq;
    const pq = pk * qk;
    const denom = 2 * Math.pow(pq, 1.5);
    const term = num / denom;
    sum += term;
    if (term > maxBin) maxBin = term;
    const relGap = Math.abs(pk - qk) / (pk + qk);
    if (relGap > maxRelGap) maxRelGap = relGap;
  }
  // The pure `kumarJohnsonSummand(p, q)` helper exposes the
  // same per-bin computation for downstream tooling; we keep
  // the inlined hot loop here to avoid per-bin function-call
  // overhead on the K=257 grid.

  const kumarJohnsonDivergence = sum;
  const kumarJohnsonMaxBin = maxBin;
  const kumarJohnsonMaxRelGap = maxRelGap;
  const kumarJohnsonSpreadRatio =
    kumarJohnsonMaxBin > 0
      ? kumarJohnsonDivergence / (K * kumarJohnsonMaxBin)
      : 0;

  if (
    !Number.isFinite(kumarJohnsonDivergence) ||
    !Number.isFinite(kumarJohnsonMaxBin) ||
    !Number.isFinite(kumarJohnsonMaxRelGap) ||
    !Number.isFinite(kumarJohnsonSpreadRatio)
  ) {
    throw new Error(
      `dailyTokenKumarJohnsonDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    kjN1: n1,
    kjN2: n2,
    kjMadPool: madPool,
    kjBandwidth: h,
    kjGridLo: gLo,
    kjGridHi: gHi,
    kjGridDx: dx,
    kjGridK: K,
    kumarJohnsonDivergence,
    kumarJohnsonMaxBin,
    kumarJohnsonMaxRelGap,
    kumarJohnsonSpreadRatio,
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

export function buildDailyTokenKumarJohnsonDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenKumarJohnsonDivergenceHalvesOptions = {},
): DailyTokenKumarJohnsonDivergenceHalvesReport {
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
  const sort: DailyTokenKumarJohnsonDivergenceHalvesSort = opts.sort ?? 'kjDesc';
  const validSorts: DailyTokenKumarJohnsonDivergenceHalvesSort[] = [
    'kj',
    'kjDesc',
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
  const rows: DailyTokenKumarJohnsonDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenKumarJohnsonDivergenceHalves(filled);
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
      kjN1: result.kjN1,
      kjN2: result.kjN2,
      kjMadPool: result.kjMadPool,
      kjBandwidth: result.kjBandwidth,
      kjGridLo: result.kjGridLo,
      kjGridHi: result.kjGridHi,
      kjGridDx: result.kjGridDx,
      kjGridK: result.kjGridK,
      kumarJohnsonDivergence: result.kumarJohnsonDivergence,
      kumarJohnsonMaxBin: result.kumarJohnsonMaxBin,
      kumarJohnsonMaxRelGap: result.kumarJohnsonMaxRelGap,
      kumarJohnsonSpreadRatio: result.kumarJohnsonSpreadRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kj':
        primary = a.kumarJohnsonDivergence - b.kumarJohnsonDivergence;
        break;
      case 'kjDesc':
        primary = b.kumarJohnsonDivergence - a.kumarJohnsonDivergence;
        break;
      case 'maxBin':
        primary = a.kumarJohnsonMaxBin - b.kumarJohnsonMaxBin;
        break;
      case 'maxBinDesc':
        primary = b.kumarJohnsonMaxBin - a.kumarJohnsonMaxBin;
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
    gridK: KJ_GRID_K,
    silvermanMultiplier: KJ_SILVERMAN_MULTIPLIER,
    pmfFloor: KJ_PMF_FLOOR,
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
