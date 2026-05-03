/**
 * daily-token-neyman-chi-squared-halves: per-source
 * KDE-SMOOTHED ASYMMETRIC NEYMAN CHI-SQUARED DIVERGENCE
 * between the FIRST and SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126-138 for direct
 * comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h = 0.9 * mad_pool * n^(-1/5) (Silverman).
 * Shared K=257-point grid spans [min - 3h, max + 3h]; pmfs
 * p (first half) and q (second half) are obtained by
 * Gaussian KDE per half then trapezoidal mass-normalisation.
 * (Bit-exact same setup as axes 126-138.)
 *
 * NEYMAN CHI-SQUARED DIVERGENCE (Neyman 1949; Cha 2007 eq.
 * 12 / 13):
 *
 *     N(p || q) = sum_k (p_k - q_k)^2 / q_k       (forward)
 *     N(q || p) = sum_k (q_k - p_k)^2 / p_k       (reverse)
 *
 * The ASYMMETRIC pair (`neymanForward`, `neymanReverse`) is
 * reported separately on every row -- this is THE point of
 * the axis. Headline value is the MAX of the two:
 *
 *     neymanMax = max( neymanForward, neymanReverse )
 *
 * which dominates the symmetrised sum (axis-134 psChi2)
 * exactly when one direction blows up far harder than the
 * other -- the regime psChi2 collapses by averaging.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-138:
 *
 *   - Class. (p - q)^2 / q (forward) and (q - p)^2 / p
 *     (reverse) -- ASYMMETRIC chi-squared in opposite
 *     directions, reported as a PAIR. No prior half-vs-half
 *     axis ships an explicitly DIRECTIONAL pair: every
 *     prior axis 118-138 emits a single SYMMETRIC scalar
 *     (KS, AD, CvM, W1, energy, MMD, qv-Mahalanobis,
 *     PCA, JSD, TV, H, bDist, delta, AOV, Hoeffding-D,
 *     SE, max-div, Clark, Taneja, KJ, Topsoe) or a single
 *     SYMMETRISED scalar (axis-134 psChi2 = (p-q)^2(p+q)/
 *     (pq) = (p-q)^2 (1/p + 1/q)). axis-139 surfaces
 *     `neymanAsymmetry = |N_pq - N_qp| / (N_pq + N_qp)`
 *     in `[0, 1]` -- a bounded, scale-free DIRECTIONAL
 *     diagnostic with NO equivalent on any prior axis.
 *
 *   - vs axis-134 psChi2 = sum (p-q)^2 (p+q)/(pq)
 *     = N(p||q) + N(q||p):
 *     psChi2 is the ARITHMETIC SUM of the two Neyman
 *     directions -- it has a single magnitude scalar and
 *     CANNOT recover the direction. axis-139 ships the
 *     PAIR + the bounded asymmetry ratio. Whenever
 *     neymanAsymmetry > 0 the directional information is
 *     genuinely new vs psChi2; when neymanAsymmetry = 0
 *     the two axes carry the same information.
 *
 *   - vs axis-118 JSD (logarithmic, symmetric, bounded):
 *     Neyman is rational, asymmetric, unbounded.
 *
 *   - vs axis-119 TV / axis-127 TV (L^1 distance,
 *     symmetric, bounded by 1): TV is symmetric and
 *     bounded; Neyman is asymmetric and unbounded with
 *     `1/q` (forward) or `1/p` (reverse) tail blow-up.
 *
 *   - vs axis-122 Bhattacharyya (similarity in sqrt
 *     coordinates, symmetric, bounded in [0, 1]): Neyman
 *     is dissimilarity-valued, in raw pmf coordinates,
 *     asymmetric, unbounded.
 *
 *   - vs axis-128 Hellinger (sqrt-amplitude L^2,
 *     symmetric, bounded in [0, 1]): Neyman is rational,
 *     asymmetric, unbounded.
 *
 *   - vs axis-129 triangular delta = sum (p-q)^2/(p+q):
 *     delta is symmetric, bounded by 2, with HARMONIC
 *     midpoint denominator; Neyman is asymmetric with
 *     SINGLE-DIRECTION reference denominator and unbounded.
 *
 *   - vs axis-135 Clark (sqrt-sum of bounded relative
 *     gaps, symmetric, bounded by sqrt(K)): Clark is
 *     symmetric and bounded; Neyman is asymmetric and
 *     unbounded.
 *
 *   - vs axis-136 Taneja (AM*log(AM/GM), symmetric,
 *     unbounded but logarithmic): Taneja is symmetric and
 *     LOGARITHMIC; Neyman is asymmetric and POLYNOMIAL-
 *     RATIONAL with degree -1 in the reference pmf.
 *
 *   - vs axis-137 Kumar-Johnson (symmetric, polynomial,
 *     `1/min(p,q)^(3/2)` blow-up): KJ is symmetric and
 *     -3/2 in the joint min; Neyman is asymmetric and -1
 *     in a SINGLE direction.
 *
 *   - vs axis-138 Topsoe (symmetric, logarithmic, bounded
 *     by 2*log(2)): Topsoe is symmetric and bounded;
 *     Neyman is asymmetric and unbounded.
 *
 * NUMERICAL FLOOR. Per-bin denominators `q_k` (forward)
 * and `p_k` (reverse) vanish only at extreme tail bins
 * where the KDE underflows to 0. We apply the SAME
 * PMF_FLOOR = 1e-15 as axes 134/135/136/137/138 to keep
 * the per-bin ratio finite and preserve cross-axis
 * numerical comparability. The floor is a no-op for any
 * genuine KDE pmf (Gaussian KDE on a finite grid is
 * strictly positive analytically) and contributes at most
 * O(K * eps * 1e15) to the asymmetric sum -- well below
 * any natural Neyman value at this grid resolution.
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     neymanForward    = sum_k (p_k - q_k)^2 / q_k     >= 0
 *     neymanReverse    = sum_k (q_k - p_k)^2 / p_k     >= 0
 *     neymanMax        = max(neymanForward, neymanReverse)
 *     neymanAsymmetry  = |N_pq - N_qp| / (N_pq + N_qp)
 *                        in [0, 1]   (0 iff perfectly
 *                        symmetric drift; 1 iff one
 *                        direction is zero, the rare
 *                        regime where the axis-134 psChi2
 *                        symmetrisation is maximally
 *                        misleading)
 *     neymanMaxBinFwd  = max_k of forward per-bin
 *                        summand
 *     neymanMaxBinRev  = max_k of reverse per-bin
 *                        summand
 *
 * neymanAsymmetry is defined as 0 when the two-direction
 * sum is itself 0 (vacuous case where `p = q` on the grid).
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the ASYMMETRIC NEYMAN chi-squared in BOTH directions
 *   `N(p||q) = sum_k (p_k - q_k)^2 / q_k` and
 *   `N(q||p) = sum_k (q_k - p_k)^2 / p_k`, how
 *   DIRECTIONAL is the half-vs-half drift -- i.e. does
 *   the FIRST half look much more anomalous against the
 *   SECOND half's reference distribution than vice versa?"**
 *
 * References:
 *   Neyman, J. (1949). "Contribution to the theory of the
 *     chi-square test", Proc. First Berkeley Symp. on
 *     Math. Stat. and Prob., 239-273.
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 12 (forward) and the
 *     symmetric companion eq. 13.
 *
 * Caveats:
 *
 *   - Neyman is asymmetric: the ROLE of the SECOND half as
 *     the reference for `neymanForward` is a deliberate
 *     CONVENTION (treat the more recent half as the
 *     baseline against which the older half is scored).
 *   - PMF_FLOOR = 1e-15 is a numerical safeguard, not a
 *     statistical regulariser.
 *   - Translation- AND positive-scale-invariant in the
 *     data (data and bandwidth scale together; pmfs
 *     unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-neyman-chi-squared-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-neyman-chi-squared-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Neyman max ascending:
 *   pew-insights daily-token-neyman-chi-squared-halves \
 *     --sort neymanMax
 */
import type { QueueLine } from './types.js';

export type DailyTokenNeymanChiSquaredHalvesSort =
  | 'neymanMax'
  | 'neymanMaxDesc'
  | 'neymanForward'
  | 'neymanForwardDesc'
  | 'neymanReverse'
  | 'neymanReverseDesc'
  | 'neymanAsymmetry'
  | 'neymanAsymmetryDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenNeymanChiSquaredHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenNeymanChiSquaredHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenNeymanChiSquaredHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  neymanN1: number;
  neymanN2: number;
  neymanMadPool: number;
  neymanBandwidth: number;
  neymanGridLo: number;
  neymanGridHi: number;
  neymanGridDx: number;
  neymanGridK: number;
  /** N(p||q) = sum_k (p_k - q_k)^2 / q_k, >= 0. */
  neymanForward: number;
  /** N(q||p) = sum_k (q_k - p_k)^2 / p_k, >= 0. */
  neymanReverse: number;
  /** max(neymanForward, neymanReverse), >= 0. */
  neymanMax: number;
  /** |N_pq - N_qp| / (N_pq + N_qp) in [0, 1]; 0 if both directions zero. */
  neymanAsymmetry: number;
  /** Largest per-bin forward summand (p_k - q_k)^2 / q_k, >= 0. */
  neymanMaxBinFwd: number;
  /** Largest per-bin reverse summand (q_k - p_k)^2 / p_k, >= 0. */
  neymanMaxBinRev: number;
}

export interface DailyTokenNeymanChiSquaredHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenNeymanChiSquaredHalvesSort;
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
  sources: DailyTokenNeymanChiSquaredHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126-138). */
export const NEYMAN_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const NEYMAN_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const NEYMAN_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins to keep (p-q)^2/q finite. */
export const NEYMAN_PMF_FLOOR = 1e-15;

/**
 * Directional sign diagnostic: returns +1 iff the FORWARD
 * direction `N(p||q)` strictly dominates the REVERSE
 * direction `N(q||p)` by more than `tol` (default 1e-12),
 * -1 iff the REVERSE dominates by more than `tol`, 0 iff
 * the two are within `tol` of each other (symmetric drift,
 * the regime where axis-134 psChi2 carries the same
 * information as either direction).
 *
 * Pure scalar helper -- a complement to `neymanAsymmetry`
 * which is the bounded MAGNITUDE of the asymmetry. Together
 * they fully decompose the directional asymmetry into
 * `(sign, magnitude)`:
 *
 *     forward-dominated:  sign = +1, asym in (0, 1]
 *     reverse-dominated:  sign = -1, asym in (0, 1]
 *     symmetric:          sign =  0, asym near 0
 *
 * Identities verified by the test suite:
 *
 *   - neymanDirectionalSign(a, a) === 0
 *   - neymanDirectionalSign(a, b) === -neymanDirectionalSign(b, a)
 *   - neymanDirectionalSign(2, 1) === 1
 *   - neymanDirectionalSign(1, 2) === -1
 *   - neymanDirectionalSign(0, 0) === 0
 */
export function neymanDirectionalSign(
  forward: number,
  reverse: number,
  tol = 1e-12,
): -1 | 0 | 1 {
  if (!Number.isFinite(forward) || !Number.isFinite(reverse)) {
    throw new Error('neymanDirectionalSign requires finite inputs');
  }
  if (forward < 0 || reverse < 0) {
    throw new Error('neymanDirectionalSign requires non-negative inputs');
  }
  if (!Number.isFinite(tol) || tol < 0) {
    throw new Error('neymanDirectionalSign requires non-negative finite tol');
  }
  const diff = forward - reverse;
  if (Math.abs(diff) <= tol) return 0;
  return diff > 0 ? 1 : -1;
}

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
 * Pure per-bin Neyman summand in the FORWARD direction.
 * Exposed for downstream tooling that wants to inspect the
 * bin-wise contribution without re-running the full KDE
 * pipeline.
 *
 *     neymanSummand(p, q) = (p - q)^2 / q
 *
 * This is the per-bin contribution to N(p || q) =
 * sum_k neymanSummand(p_k, q_k). Note that
 * neymanSummand(p, q) !== neymanSummand(q, p) in general
 * -- this is exactly the asymmetry that axis-139 surfaces.
 *
 * Both `p` and `q` are floored at NEYMAN_PMF_FLOOR to keep
 * the divisor strictly positive under IEEE-754 underflow at
 * extreme tail bins.
 *
 * Identities verified by the test suite:
 *
 *   - neymanSummand(p, p) === 0                    (vanishes on the diagonal)
 *   - neymanSummand(p, q) >= 0                     (non-negative)
 *   - neymanSummand(0, q) = q                      (one-sided mass: (0-q)^2/q = q)
 *   - neymanSummand(p, 0) -> p^2 / PMF_FLOOR (huge but finite)
 */
export function neymanSummand(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    throw new Error('neymanSummand requires finite inputs');
  }
  if (p < 0 || q < 0) {
    throw new Error('neymanSummand requires non-negative inputs');
  }
  const pf = p < NEYMAN_PMF_FLOOR ? NEYMAN_PMF_FLOOR : p;
  const qf = q < NEYMAN_PMF_FLOOR ? NEYMAN_PMF_FLOOR : q;
  const d = pf - qf;
  return (d * d) / qf;
}

/**
 * KDE-smoothed asymmetric Neyman chi-squared between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - neymanForward(x + c) === neymanForward(x).
 *   - neymanForward(k*x) === neymanForward(x) for k > 0.
 *   - neymanForward >= 0, neymanReverse >= 0.
 *   - Both === 0 iff p === q on the grid.
 *   - Swapping the two halves swaps forward and reverse
 *     (NOT preserved -- this is the point).
 *   - neymanAsymmetry in [0, 1].
 *   - neymanMax === max(neymanForward, neymanReverse).
 */
export function dailyTokenNeymanChiSquaredHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  neymanN1: number;
  neymanN2: number;
  neymanMadPool: number;
  neymanBandwidth: number;
  neymanGridLo: number;
  neymanGridHi: number;
  neymanGridDx: number;
  neymanGridK: number;
  neymanForward: number;
  neymanReverse: number;
  neymanMax: number;
  neymanAsymmetry: number;
  neymanMaxBinFwd: number;
  neymanMaxBinRev: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenNeymanChiSquaredHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenNeymanChiSquaredHalves requires finite values');
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
      `dailyTokenNeymanChiSquaredHalves: zero centred variance (n=${n})`,
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

  let h = NEYMAN_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = NEYMAN_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - NEYMAN_GRID_EXTENSION_H * h;
  const gHi = mx + NEYMAN_GRID_EXTENSION_H * h;
  const K = NEYMAN_GRID_K;
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
      `dailyTokenNeymanChiSquaredHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sumFwd = 0;
  let sumRev = 0;
  let maxBinFwd = 0;
  let maxBinRev = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < NEYMAN_PMF_FLOOR) pk = NEYMAN_PMF_FLOOR;
    if (qk < NEYMAN_PMF_FLOOR) qk = NEYMAN_PMF_FLOOR;
    const d = pk - qk;
    const d2 = d * d;
    const tFwd = d2 / qk;
    const tRev = d2 / pk;
    sumFwd += tFwd;
    sumRev += tRev;
    if (tFwd > maxBinFwd) maxBinFwd = tFwd;
    if (tRev > maxBinRev) maxBinRev = tRev;
  }
  // The pure `neymanSummand(p, q)` helper exposes the same
  // per-bin forward computation for downstream tooling; we
  // keep the inlined hot loop here to avoid per-bin
  // function-call overhead on the K=257 grid.

  const neymanForward = sumFwd;
  const neymanReverse = sumRev;
  const neymanMax = neymanForward > neymanReverse ? neymanForward : neymanReverse;
  const denom = neymanForward + neymanReverse;
  const neymanAsymmetry =
    denom > 0 ? Math.abs(neymanForward - neymanReverse) / denom : 0;

  if (
    !Number.isFinite(neymanForward) ||
    !Number.isFinite(neymanReverse) ||
    !Number.isFinite(neymanMax) ||
    !Number.isFinite(neymanAsymmetry) ||
    !Number.isFinite(maxBinFwd) ||
    !Number.isFinite(maxBinRev)
  ) {
    throw new Error(
      `dailyTokenNeymanChiSquaredHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    neymanN1: n1,
    neymanN2: n2,
    neymanMadPool: madPool,
    neymanBandwidth: h,
    neymanGridLo: gLo,
    neymanGridHi: gHi,
    neymanGridDx: dx,
    neymanGridK: K,
    neymanForward,
    neymanReverse,
    neymanMax,
    neymanAsymmetry,
    neymanMaxBinFwd: maxBinFwd,
    neymanMaxBinRev: maxBinRev,
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

export function buildDailyTokenNeymanChiSquaredHalves(
  queue: QueueLine[],
  opts: DailyTokenNeymanChiSquaredHalvesOptions = {},
): DailyTokenNeymanChiSquaredHalvesReport {
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
  const sort: DailyTokenNeymanChiSquaredHalvesSort = opts.sort ?? 'neymanMaxDesc';
  const validSorts: DailyTokenNeymanChiSquaredHalvesSort[] = [
    'neymanMax',
    'neymanMaxDesc',
    'neymanForward',
    'neymanForwardDesc',
    'neymanReverse',
    'neymanReverseDesc',
    'neymanAsymmetry',
    'neymanAsymmetryDesc',
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
  const rows: DailyTokenNeymanChiSquaredHalvesSourceRow[] = [];

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
      result = dailyTokenNeymanChiSquaredHalves(filled);
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
      neymanN1: result.neymanN1,
      neymanN2: result.neymanN2,
      neymanMadPool: result.neymanMadPool,
      neymanBandwidth: result.neymanBandwidth,
      neymanGridLo: result.neymanGridLo,
      neymanGridHi: result.neymanGridHi,
      neymanGridDx: result.neymanGridDx,
      neymanGridK: result.neymanGridK,
      neymanForward: result.neymanForward,
      neymanReverse: result.neymanReverse,
      neymanMax: result.neymanMax,
      neymanAsymmetry: result.neymanAsymmetry,
      neymanMaxBinFwd: result.neymanMaxBinFwd,
      neymanMaxBinRev: result.neymanMaxBinRev,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'neymanMax':
        primary = a.neymanMax - b.neymanMax;
        break;
      case 'neymanMaxDesc':
        primary = b.neymanMax - a.neymanMax;
        break;
      case 'neymanForward':
        primary = a.neymanForward - b.neymanForward;
        break;
      case 'neymanForwardDesc':
        primary = b.neymanForward - a.neymanForward;
        break;
      case 'neymanReverse':
        primary = a.neymanReverse - b.neymanReverse;
        break;
      case 'neymanReverseDesc':
        primary = b.neymanReverse - a.neymanReverse;
        break;
      case 'neymanAsymmetry':
        primary = a.neymanAsymmetry - b.neymanAsymmetry;
        break;
      case 'neymanAsymmetryDesc':
        primary = b.neymanAsymmetry - a.neymanAsymmetry;
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
    gridK: NEYMAN_GRID_K,
    silvermanMultiplier: NEYMAN_SILVERMAN_MULTIPLIER,
    pmfFloor: NEYMAN_PMF_FLOOR,
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
