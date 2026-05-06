/**
 * daily-token-moskvina-zhigljavsky-ssa-subspace-changepoint:
 * per-source SINGULAR SPECTRUM ANALYSIS (SSA) subspace
 * changepoint detector on the gap-filled daily total_tokens
 * series.
 *
 * TWO-HUNDRED-AND-TWENTY-EIGHTH cross-source axis.
 *
 * Mechanism. Moskvina, V. and Zhigljavsky, A. (2003),
 * "An algorithm based on singular spectrum analysis for
 * change-point detection", *Communications in Statistics -
 * Simulation and Computation* 32(2): 319-352.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total tokens
 * series for one source (n >= 21). Pick a window length
 * L (default min(20, floor(n/3))) and a base/test interval
 * B = N - L + 1, T = M - L + 1 with N a "base" segment
 * length and M a "test" segment length advanced one step at
 * a time. For each candidate split index t in
 * [N + L - 1, n - T] we form
 *
 *   X_base(t) = Hankel(x[t - N + 1 .. t], L)            (1)
 *   X_test(t) = Hankel(x[t + 1 .. t + M], L)            (2)
 *
 * compute the SVD of X_base(t) and let U_r be the top-r
 * left singular vectors (the r-dim SIGNAL SUBSPACE). The
 * SSA changepoint statistic at t is the Frobenius
 * SUBSPACE DISTANCE between X_test(t) and its projection
 * onto col(U_r):
 *
 *   D(t) = || (I - U_r U_r^T) X_test(t) ||_F^2 /
 *           || X_test(t) ||_F^2                          (3)
 *
 * D(t) in [0, 1] measures the fraction of test-window
 * trajectory-matrix energy ORTHOGONAL to the base
 * subspace. Large D(t) means the L-lag dynamics of the
 * test interval cannot be reconstructed from the base
 * subspace -> changepoint.
 *
 * Detection. The TEST STATISTIC is the maximum over
 * candidate splits Dmax = max_t D(t) at tauStarBest =
 * argmax_t D(t). Multiple changepoints are extracted by
 * thresholding with a Frobenius cutoff D(t) >= dThreshold
 * (default 0.20) and applying NON-MAXIMUM SUPPRESSION on a
 * window of L splits to deduplicate adjacent peaks.
 *
 * Surfaces (deterministic, pure):
 *
 *   - mChangepoints: number of suppressed peaks at or
 *     above dThreshold.
 *   - tauStar: ascending changepoint indices (raw split
 *     indices in [N + L - 1, n - T]).
 *   - tauStarDays: ISO YYYY-MM-DD per tauStar.
 *   - dMax: max over t of D(t) (the strongest single CP
 *     evidence; in [0, 1]).
 *   - dMean: mean of D(t) over the candidate range.
 *   - dArea: trapezoidal-rule integral of D(t) (energy of
 *     the subspace-divergence curve).
 *   - tauStarBest: argmax t.
 *   - tauStarBestDay: ISO YYYY-MM-DD of tauStarBest.
 *   - subspaceRank: r actually used.
 *   - windowL: L actually used.
 *   - baseN, testM: base / test segment lengths used.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 227 cross-source axes NONE is an SSA
 * SUBSPACE-PROJECTION detector on Hankel trajectory
 * matrices. Closest neighbours inside the changepoint
 * family:
 *
 *   - axis-221 ALEXANDERSSON-PETTITT (single CP, mean,
 *     parametric/rank, BATCH).
 *   - axis-222 LOMBARD smooth (single, smooth, rank-
 *     CUSUM, BATCH).
 *   - axis-223 INCLAN-TIAO ICSS (single CP, variance,
 *     parametric, BATCH cumulative-sum).
 *   - axis-224 KILLICK-FEARNHEAD-ECKLEY PELT (multiple
 *     CP, variance, GAUSSIAN cost + BIC, BATCH DP).
 *   - axis-225 FRYZLEWICZ WBS (multiple CP, mean,
 *     RANDOMISED CUSUM aggregation, BATCH).
 *   - axis-226 MATTESON-JAMES ECP (multiple CP, full
 *     distribution, energy-distance, BATCH binary
 *     segmentation).
 *   - axis-227 ADAMS-MACKAY BOCPD (multiple, online
 *     bayesian run-length, NIG predictive, STREAMING).
 *
 * Axis-228 SSA is orthogonal along three INDEPENDENT
 * dimensions inside the changepoint family:
 *
 *   1. STATE-SPACE GEOMETRY. SSA operates on a DELAY-
 *      EMBEDDED Hankel trajectory matrix; the test
 *      statistic is a SUBSPACE DISTANCE in R^L
 *      (Grassmannian geometry). Axes 221-227 operate on
 *      raw scalar observations (mean, variance, rank,
 *      empirical distribution, NIG predictive).
 *   2. DECOMPOSITION FAMILY. SSA uses the SVD of the
 *      base Hankel matrix to extract a low-rank signal
 *      subspace. Axes 221-227 use no spectral / matrix
 *      decomposition; they are scalar test statistics or
 *      conjugate Bayesian recursions.
 *   3. WHAT IS DETECTED. SSA fires on any change in the
 *      L-LAG DYNAMICS (trend slope, seasonality phase,
 *      autoregressive structure, low-rank dimension)
 *      since these all alter the column span of the
 *      Hankel matrix. Axes 221-227 fire on shifts in
 *      first / second moment or full distribution but
 *      NOT on subspace-rank changes that preserve
 *      moments (e.g. a phase flip of a sinusoid).
 *
 * The axis is also orthogonal to all earlier trend /
 * variance / shape / dispersion axes (181-220) because
 * (a) those axes target a single moment / shape
 * functional, while SSA targets the LAG-EMBEDDED
 * SUBSPACE GEOMETRY of the series, and (b) SSA's test
 * statistic is invariant to the marginal distribution of
 * x once its trajectory subspace is fixed.
 *
 * Refs: Moskvina, V. and Zhigljavsky, A. (2003), "An
 * algorithm based on singular spectrum analysis for
 * change-point detection", *Comm. Statist. - Simul.
 * Comput.* 32(2): 319-352; Golyandina, N., Nekrutkin, V.
 * and Zhigljavsky, A. (2001), *Analysis of Time Series
 * Structure: SSA and Related Techniques*, Chapman &
 * Hall/CRC; Hassani, H. (2007), "Singular spectrum
 * analysis: methodology and comparison", *J. Data Sci.*
 * 5(2): 239-257.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. PURE NUMERIC HELPERS (Hankel, Frobenius, SVD)
// =========================================================

/** Build the L x K = Hankel trajectory matrix of x where K = x.length - L + 1. Row-major flat. */
export function hankelMatrix(x: number[], L: number): { data: number[]; rows: number; cols: number } {
  const n = x.length;
  if (!Number.isInteger(L) || L < 2 || L > n - 1) {
    throw new Error(`hankelMatrix: need 2 <= L <= n-1 (n=${n}, L=${L})`);
  }
  const K = n - L + 1;
  const data = new Array<number>(L * K);
  for (let i = 0; i < L; i += 1) {
    for (let j = 0; j < K; j += 1) {
      data[i * K + j] = x[i + j]!;
    }
  }
  return { data, rows: L, cols: K };
}

/** Squared Frobenius norm of a flat row-major matrix. */
export function frobeniusSq(data: number[]): number {
  let s = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]!;
    s += v * v;
  }
  return s;
}

/**
 * Compute the L x L symmetric Gram matrix S = X X^T for a
 * row-major L x K matrix X. Returns flat row-major L x L.
 */
export function gramSelf(X: number[], rows: number, cols: number): number[] {
  const G = new Array<number>(rows * rows).fill(0);
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = 0;
      for (let k = 0; k < cols; k += 1) {
        s += X[i * cols + k]! * X[j * cols + k]!;
      }
      G[i * rows + j] = s;
      G[j * rows + i] = s;
    }
  }
  return G;
}

/**
 * Symmetric eigendecomposition of an n x n symmetric matrix
 * via cyclic Jacobi rotations. Returns eigenvalues sorted
 * descending and a column-stacked matrix V (row-major n x n)
 * whose i-th COLUMN is the eigenvector for eigenvalue i.
 *
 * Suitable for small L (default L = 20). Iteration cap = 200,
 * convergence threshold = 1e-12 on the largest off-diagonal.
 */
export function jacobiEigSym(
  A: number[],
  n: number,
  maxSweeps = 200,
  tol = 1e-12,
): { values: number[]; vectors: number[] } {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`jacobiEigSym: need n >= 1 integer (got ${n})`);
  }
  if (A.length !== n * n) {
    throw new Error(`jacobiEigSym: A must be n*n flat (n=${n}, len=${A.length})`);
  }
  // Work on a copy.
  const M = A.slice();
  const V = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n; i += 1) V[i * n + i] = 1;
  for (let sweep = 0; sweep < maxSweeps; sweep += 1) {
    // Find largest off-diagonal element magnitude.
    let off = 0;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const v = Math.abs(M[p * n + q]!);
        if (v > off) off = v;
      }
    }
    if (off < tol) break;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        const apq = M[p * n + q]!;
        if (Math.abs(apq) < tol * 0.01) continue;
        const app = M[p * n + p]!;
        const aqq = M[q * n + q]!;
        const theta = (aqq - app) / (2 * apq);
        let t: number;
        if (Math.abs(theta) > 1e15) {
          t = 1 / (2 * theta);
        } else {
          const sgn = theta >= 0 ? 1 : -1;
          t = sgn / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        }
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // Update M: rotate rows/cols p,q.
        M[p * n + p] = app - t * apq;
        M[q * n + q] = aqq + t * apq;
        M[p * n + q] = 0;
        M[q * n + p] = 0;
        for (let i = 0; i < n; i += 1) {
          if (i !== p && i !== q) {
            const aip = M[i * n + p]!;
            const aiq = M[i * n + q]!;
            M[i * n + p] = c * aip - s * aiq;
            M[p * n + i] = M[i * n + p]!;
            M[i * n + q] = s * aip + c * aiq;
            M[q * n + i] = M[i * n + q]!;
          }
        }
        // Update V.
        for (let i = 0; i < n; i += 1) {
          const vip = V[i * n + p]!;
          const viq = V[i * n + q]!;
          V[i * n + p] = c * vip - s * viq;
          V[i * n + q] = s * vip + c * viq;
        }
      }
    }
  }
  // Extract eigenvalues from the diagonal and sort descending,
  // permuting V columns to match.
  const idx: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => M[b * n + b]! - M[a * n + a]!);
  const values = new Array<number>(n);
  const vectors = new Array<number>(n * n);
  for (let j = 0; j < n; j += 1) {
    const src = idx[j]!;
    values[j] = M[src * n + src]!;
    for (let i = 0; i < n; i += 1) vectors[i * n + j] = V[i * n + src]!;
  }
  return { values, vectors };
}

/**
 * Subspace-distance Frobenius statistic D in [0, 1]:
 *
 *   D = || (I - U_r U_r^T) X_test ||_F^2 / || X_test ||_F^2
 *
 * U_r is the top-r left singular vectors of the BASE matrix,
 * extracted as the top-r eigenvectors of X_base X_base^T.
 *
 * Computation. With G_base = X_base X_base^T eigen-decomposed
 * as G = sum_i lambda_i u_i u_i^T, the projector onto the
 * top-r subspace is P_r = sum_{i=1..r} u_i u_i^T. Then
 *
 *   || (I - P_r) X_test ||_F^2 = sum_j || x_test_j ||^2
 *                              - sum_j sum_{i=1..r}
 *                                   (u_i^T x_test_j)^2
 *                              = || X_test ||_F^2
 *                              - sum_{i=1..r} || X_test^T u_i ||^2.
 */
export function ssaSubspaceDistance(
  xBase: number[],
  xTest: number[],
  L: number,
  r: number,
): number {
  if (!Number.isInteger(r) || r < 1) {
    throw new Error(`ssaSubspaceDistance: need r >= 1 integer (got ${r})`);
  }
  if (r > L) {
    throw new Error(`ssaSubspaceDistance: need r <= L (r=${r}, L=${L})`);
  }
  const Xb = hankelMatrix(xBase, L);
  const Xt = hankelMatrix(xTest, L);
  const fbT = frobeniusSq(Xt.data);
  if (!(fbT > 0)) return 0;
  const G = gramSelf(Xb.data, Xb.rows, Xb.cols);
  const { vectors } = jacobiEigSym(G, L);
  // Project: for each top-r eigenvector u_i, compute
  // sum_j (u_i^T x_test_j)^2 = || X_test^T u_i ||^2.
  let captured = 0;
  for (let i = 0; i < r; i += 1) {
    // u_i is the i-th column of vectors.
    let normSq = 0;
    for (let j = 0; j < Xt.cols; j += 1) {
      let dot = 0;
      for (let k = 0; k < L; k += 1) {
        dot += vectors[k * L + i]! * Xt.data[k * Xt.cols + j]!;
      }
      normSq += dot * dot;
    }
    captured += normSq;
  }
  const orth = Math.max(0, fbT - captured);
  const d = orth / fbT;
  if (!Number.isFinite(d)) return 0;
  if (d < 0) return 0;
  if (d > 1) return 1;
  return d;
}

// =========================================================
// SECTION 2. SSA CHANGEPOINT CORE
// =========================================================

export interface SsaChangepointResult {
  /** D(t) over candidate splits, ascending in t. */
  dCurve: number[];
  /** Candidate split indices t (raw). */
  tCandidates: number[];
  /** Detected changepoint indices (NMS-suppressed peaks at or above dThreshold). */
  tauStar: number[];
  /** max over t of D(t). */
  dMax: number;
  /** mean of dCurve. */
  dMean: number;
  /** trapezoidal integral of dCurve. */
  dArea: number;
  /** argmax t in tCandidates. */
  tauStarBest: number;
  /** Window L applied. */
  L: number;
  /** Base window N applied. */
  baseN: number;
  /** Test window M applied. */
  testM: number;
  /** Subspace rank r applied. */
  rank: number;
}

export interface SsaChangepointOptions {
  L: number;
  baseN: number;
  testM: number;
  rank: number;
  dThreshold: number;
}

/**
 * Pure offline SSA changepoint scan. For each candidate
 * split t = [baseN + L - 1, n - testM], compute D(t).
 *
 * Throws on bad shape arguments.
 */
export function ssaChangepointRun(
  x: number[],
  opts: SsaChangepointOptions,
): SsaChangepointResult {
  const n = x.length;
  const { L, baseN, testM, rank, dThreshold } = opts;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`ssaChangepointRun: need n >= 1 integer (got ${n})`);
  }
  if (!Number.isInteger(L) || L < 2) {
    throw new Error(`ssaChangepointRun: need L >= 2 integer (got ${L})`);
  }
  if (!Number.isInteger(baseN) || baseN < L + 1) {
    throw new Error(`ssaChangepointRun: need baseN >= L+1 (L=${L}, baseN=${baseN})`);
  }
  if (!Number.isInteger(testM) || testM < L) {
    throw new Error(`ssaChangepointRun: need testM >= L (L=${L}, testM=${testM})`);
  }
  if (!Number.isInteger(rank) || rank < 1 || rank > L) {
    throw new Error(`ssaChangepointRun: need 1 <= rank <= L (rank=${rank}, L=${L})`);
  }
  if (!Number.isFinite(dThreshold) || dThreshold < 0 || dThreshold > 1) {
    throw new Error(
      `ssaChangepointRun: dThreshold must be in [0, 1] (got ${dThreshold})`,
    );
  }
  const tStart = baseN - 1;
  const tEnd = n - testM - 1;
  const dCurve: number[] = [];
  const tCandidates: number[] = [];
  if (tStart > tEnd) {
    return {
      dCurve,
      tCandidates,
      tauStar: [],
      dMax: 0,
      dMean: 0,
      dArea: 0,
      tauStarBest: -1,
      L,
      baseN,
      testM,
      rank,
    };
  }
  for (let t = tStart; t <= tEnd; t += 1) {
    const baseStart = t - baseN + 1;
    const baseSlice = x.slice(baseStart, baseStart + baseN);
    const testSlice = x.slice(t + 1, t + 1 + testM);
    let d: number;
    try {
      d = ssaSubspaceDistance(baseSlice, testSlice, L, rank);
    } catch {
      d = 0;
    }
    dCurve.push(d);
    tCandidates.push(t);
  }
  let dMax = 0;
  let dMaxIdx = 0;
  let dSum = 0;
  for (let i = 0; i < dCurve.length; i += 1) {
    const v = dCurve[i]!;
    dSum += v;
    if (v > dMax) {
      dMax = v;
      dMaxIdx = i;
    }
  }
  const dMean = dCurve.length > 0 ? dSum / dCurve.length : 0;
  // Trapezoidal area.
  let dArea = 0;
  for (let i = 0; i + 1 < dCurve.length; i += 1) {
    dArea += 0.5 * (dCurve[i]! + dCurve[i + 1]!);
  }
  // NMS thresholded peaks: pick all i with d >= dThreshold and
  // d >= neighbours within +/- L.
  const tauStar: number[] = [];
  for (let i = 0; i < dCurve.length; i += 1) {
    const v = dCurve[i]!;
    if (v < dThreshold) continue;
    let isPeak = true;
    for (let j = Math.max(0, i - L); j <= Math.min(dCurve.length - 1, i + L); j += 1) {
      if (j === i) continue;
      if (dCurve[j]! > v) {
        isPeak = false;
        break;
      }
      // Strictly greater on the left to break ties deterministically.
      if (dCurve[j]! === v && j < i) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) tauStar.push(tCandidates[i]!);
  }
  return {
    dCurve,
    tCandidates,
    tauStar,
    dMax,
    dMean,
    dArea,
    tauStarBest: tCandidates[dMaxIdx] ?? -1,
    L,
    baseN,
    testM,
    rank,
  };
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'dMax'
  | 'dMaxDesc'
  | 'dArea'
  | 'dAreaDesc'
  | 'dMean'
  | 'dMeanDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSort;
  /** Window L for the Hankel embedding (>= 2). Default min(20, floor(n/3)). */
  windowL?: number;
  /** Subspace rank r in [1, L]. Default 2. */
  rank?: number;
  /** Frobenius cutoff for peak detection (in [0, 1]). Default 0.20. */
  dThreshold?: number;
  /** Drop rows with mChangepoints == 0. */
  onlyWithCps?: boolean;
  generatedAt?: string;
}

export interface DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  tauStar: number[];
  tauStarDays: string[];
  dMax: number;
  dMean: number;
  dArea: number;
  tauStarBest: number;
  tauStarBestDay: string;
  windowL: number;
  baseN: number;
  testM: number;
  rank: number;
  dThreshold: number;
}

export interface DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSort;
  windowL: number | null;
  rank: number;
  dThreshold: number;
  onlyWithCps: boolean;
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
  sources: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSourceRow[];
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
 * Per-source pure builder. Validates options, gap-fills, runs
 * SSA subspace changepoint scan, returns a deterministic
 * report.
 */
export function buildDailyTokenMoskvinaZhigljavskySsaSubspaceChangepoint(
  queue: QueueLine[],
  opts: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointOptions = {},
): DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointReport {
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
  const sort: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'dMax',
    'dMaxDesc',
    'dArea',
    'dAreaDesc',
    'dMean',
    'dMeanDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const explicitL = opts.windowL ?? null;
  if (explicitL !== null) {
    if (!Number.isInteger(explicitL) || explicitL < 2) {
      throw new Error(`windowL must be an integer >= 2 (got ${opts.windowL})`);
    }
  }
  const rank = opts.rank ?? 2;
  if (!Number.isInteger(rank) || rank < 1) {
    throw new Error(`rank must be an integer >= 1 (got ${opts.rank})`);
  }
  const dThreshold = opts.dThreshold ?? 0.2;
  if (!Number.isFinite(dThreshold) || dThreshold < 0 || dThreshold > 1) {
    throw new Error(
      `dThreshold must be a finite number in [0, 1] (got ${opts.dThreshold})`,
    );
  }
  const onlyWithCps = opts.onlyWithCps ?? false;
  if (typeof onlyWithCps !== 'boolean') {
    throw new Error(`onlyWithCps must be boolean (got ${opts.onlyWithCps})`);
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
  const rows: DailyTokenMoskvinaZhigljavskySsaSubspaceChangepointSourceRow[] = [];

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
    for (let i = 0; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    const Ldefault = Math.max(2, Math.min(20, Math.floor(nTenure / 3)));
    const L = explicitL ?? Ldefault;
    if (rank > L) {
      droppedNonFiniteFit += 1;
      continue;
    }
    // baseN = max(L+1, floor(nTenure/2)); testM = max(L, floor(nTenure/4)).
    const baseN = Math.max(L + 1, Math.floor(nTenure / 2));
    const testM = Math.max(L, Math.floor(nTenure / 4));
    if (baseN + testM + L > nTenure + L) {
      droppedNonFiniteFit += 1;
      continue;
    }
    let result: SsaChangepointResult;
    try {
      result = ssaChangepointRun(filled, {
        L,
        baseN,
        testM,
        rank,
        dThreshold,
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(result.dMax) ||
      !Number.isFinite(result.dMean) ||
      !Number.isFinite(result.dArea)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const tauStarDays = result.tauStar.map((t) => addUtcDays(acc.firstDay, t));
    const tauStarBestDay =
      result.tauStarBest >= 0 ? addUtcDays(acc.firstDay, result.tauStarBest) : '';
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mChangepoints: result.tauStar.length,
      tauStar: result.tauStar,
      tauStarDays,
      dMax: result.dMax,
      dMean: result.dMean,
      dArea: result.dArea,
      tauStarBest: result.tauStarBest,
      tauStarBestDay,
      windowL: L,
      baseN,
      testM,
      rank,
      dThreshold,
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
      case 'dMax':
        primary = a.dMax - b.dMax;
        break;
      case 'dMaxDesc':
        primary = b.dMax - a.dMax;
        break;
      case 'dArea':
        primary = a.dArea - b.dArea;
        break;
      case 'dAreaDesc':
        primary = b.dArea - a.dArea;
        break;
      case 'dMean':
        primary = a.dMean - b.dMean;
        break;
      case 'dMeanDesc':
        primary = b.dMean - a.dMean;
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
  if (onlyWithCps) {
    kept = kept.filter((r) => r.mChangepoints > 0);
  }
  if (top > 0 && kept.length > top) {
    droppedTopSources = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    top,
    sort,
    windowL: explicitL,
    rank,
    dThreshold,
    onlyWithCps,
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
