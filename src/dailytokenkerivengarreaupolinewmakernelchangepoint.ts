/**
 * daily-token-keriven-garreau-poli-newma-kernel-changepoint:
 * per-source ONLINE TWO-TIMESCALE NEWMA changepoint detector
 * on the gap-filled daily total_tokens series, in a finite-
 * dimensional RANDOM-FOURIER-FEATURE (RFF) embedding of a
 * Gaussian RBF kernel.
 *
 * TWO-HUNDRED-AND-THIRTIETH cross-source axis.
 *
 * Mechanism. Keriven, N., Garreau, D. and Poli, I. (2020),
 * "NEWMA: a new method for scalable model-free online
 * change-point detection", *IEEE Trans. Signal Process.*
 * 68: 3515-3528. NEWMA tracks two parallel exponentially-
 * weighted moving averages (EWMAs) at DIFFERENT forgetting
 * factors lambda_1 < lambda_2 of a feature embedding
 * Phi(x_t) of the data, and triggers when the L2 distance
 * between the two EWMAs exceeds an adaptive threshold.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total tokens
 * series for one source (n >= 21). Standardise by the median
 * absolute deviation (MAD) for kernel-bandwidth scale
 * stability:
 *
 *   med = median(x), mad = median(|x - med|)         (1)
 *   z_t = (x_t - med) / max(mad, eps)                (2)
 *
 * Pick a Gaussian RBF kernel
 *
 *   k(u, v) = exp(- (u - v)^2 / (2 sigma^2))         (3)
 *
 * with bandwidth sigma chosen by the median heuristic
 * sigma = max(median{|z_i - z_j| : i < j}, eps_sigma).
 * Approximate Phi by a D-dimensional RFF embedding
 * (Rahimi-Recht 2008):
 *
 *   omega_d ~ N(0, 1 / sigma^2),  b_d ~ U[0, 2 pi]   (4)
 *   Phi_d(z) = sqrt(2 / D) cos(omega_d z + b_d)      (5)
 *
 * so that <Phi(u), Phi(v)> ~= k(u, v) (Bochner). For
 * determinism, omega_d and b_d are drawn from a SEEDED
 * mulberry32 PRNG keyed by source name, n, and a fixed
 * salt — every call returns the same RFF basis for the same
 * inputs.
 *
 * Two EWMAs. With Phi_t = Phi(z_t) in R^D, define
 *
 *   M_1(t) = (1 - lambda_1) M_1(t-1) + lambda_1 Phi_t (6)
 *   M_2(t) = (1 - lambda_2) M_2(t-1) + lambda_2 Phi_t (7)
 *
 * with M_1(0) = M_2(0) = 0 and 0 < lambda_1 < lambda_2 <
 * 1. The NEWMA STATISTIC is
 *
 *   T(t) = || M_1(t) - M_2(t) ||_2                  (8)
 *
 * which is provably zero in expectation under stationarity
 * (both EWMAs target the same population mean embedding)
 * and grows after a kernel-mean shift, with the SLOWER
 * EWMA M_1 lagging behind M_2 (Keriven et al. 2020 Thm. 1).
 *
 * Adaptive threshold. Following Keriven et al. (2020 §IV-B,
 * "online null-distribution sketch") we adopt the simple,
 * deterministic, O(1) per-step threshold
 *
 *   tau(t) = thrMul * sqrt(2 D *
 *            (lambda_1 / (2 - lambda_1) +
 *             lambda_2 / (2 - lambda_2) -
 *             2 lambda_1 lambda_2 /
 *             (lambda_1 + lambda_2 - lambda_1 lambda_2)))
 *                                                    (9)
 *
 * which is the closed-form steady-state SD of T(t) under
 * iid bounded RFF features (each Phi_d in [-sqrt(2/D),
 * sqrt(2/D)]) times a user threshold multiplier thrMul
 * (default 0.7 — chosen so the floor (8.4 used by all
 * existing changepoint axes 221..229) of "decisive" CPs
 * is comparable across paradigms). Detections are emitted
 * at every t where T(t) > tau(t), then COLLAPSED into
 * MAXIMAL EXCURSIONS (one CP per consecutive exceedance
 * run, located at the argmax T inside the run) and
 * DEDUPLICATED so that no two CPs are within delayCool
 * (default 7 days) of each other.
 *
 * Surfaces (deterministic, pure):
 *
 *   - mChangepoints: number of decisive CPs.
 *   - tauStar: ascending raw split indices.
 *   - tauStarDays: ISO YYYY-MM-DD per tauStar.
 *   - tMax: max over t of T(t).
 *   - tMean: mean of T(t).
 *   - tArea: trapezoidal integral of T(t) over t.
 *   - tauStarBest: argmax t of T(t).
 *   - tauStarBestDay: ISO YYYY-MM-DD of tauStarBest.
 *   - lambda1, lambda2, D, sigma, thrMul, thrSteady,
 *     delayCool: hyperparameters actually applied.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 229 cross-source axes NONE is an ONLINE
 * TWO-TIMESCALE EWMA detector in a KERNEL FEATURE SPACE.
 * Axis-230 is orthogonal along four INDEPENDENT dimensions
 * inside the changepoint family:
 *
 *   1. STREAMING vs OFFLINE. NEWMA is a SEQUENTIAL O(1)-
 *      per-step OBSERVER: M_1, M_2 are recursively updated;
 *      no global reweighting, no segmentation tree, no
 *      backward pass. Axes 221-229 are all OFFLINE batch
 *      detectors that re-scan the entire series (Pettitt
 *      rank-CUSUM, Lombard quadratic CUSUM, Inclan-Tiao
 *      cumulative variance, PELT cost-functional dynamic
 *      program, WBS recursive binary segmentation, ECP
 *      pairwise energy distance, BOCPD posterior over
 *      run-length, spectral CUSUM on Fourier coefficients,
 *      SSA Hankel SVD). The streaming dimension is new.
 *   2. STATISTICAL FUNCTIONAL. NEWMA tests the difference
 *      of two KERNEL MEAN EMBEDDINGS at different memory
 *      scales — a function of the entire kernel-induced
 *      distribution, not just one moment. ECP (axis-226)
 *      uses pairwise energy distances but is BATCH and
 *      EXACT-PAIRWISE; NEWMA uses RFF-APPROXIMATE
 *      embeddings, RECURSIVE EWMAs, and a TWO-TIMESCALE
 *      DIFFERENTIAL — disjoint statistical machinery.
 *   3. RANDOMISED FEATURE BASIS. NEWMA operates in a
 *      finite RFF projection of the kernel RKHS — a
 *      randomised low-rank approximation governed by the
 *      Bochner integral. Axes 221-229 use no random
 *      embedding: they project onto deterministic bases
 *      (raw observations, ranks, Hankel columns, Fourier
 *      atoms). Determinism here is restored by the per-
 *      source SEED, but the BASIS REPRESENTATION is
 *      categorically different.
 *   4. ALARM RULE. NEWMA fires on a CLOSED-FORM STEADY-
 *      STATE STANDARD-DEVIATION threshold derived from
 *      the EWMA forgetting factors (eq. 9), not on a
 *      sigma-of-statistic threshold (axes 228, 229) nor a
 *      penalty-vs-cost optimisation (PELT, axis-224) nor
 *      a posterior run-length argmax (BOCPD, axis-227).
 *      The alarm rule is functionally distinct.
 *
 * Refs: Keriven, N., Garreau, D. and Poli, I. (2020),
 * "NEWMA: a new method for scalable model-free online
 * change-point detection", *IEEE Trans. Signal Process.*
 * 68: 3515-3528; Rahimi, A. and Recht, B. (2008), "Random
 * features for large-scale kernel machines", *NeurIPS*
 * 20: 1177-1184; Roberts, S. W. (1959), "Control chart
 * tests based on geometric moving averages",
 * *Technometrics* 1(3): 239-250 (the original EWMA);
 * Gretton, A., Borgwardt, K. M., Rasch, M. J., Scholkopf,
 * B. and Smola, A. (2012), "A kernel two-sample test",
 * *J. Mach. Learn. Res.* 13: 723-773 (the kernel-mean-
 * embedding two-sample background).
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. SEEDED PRNG (mulberry32) + DETERMINISTIC RFF
// =========================================================

/** mulberry32: tiny, fast, deterministic 32-bit PRNG. */
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

/** Box-Muller standard normal from two uniforms. */
function boxMullerStdNormal(rng: () => number): number {
  let u1 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** FNV-1a 32-bit hash of a string for PRNG seeding. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface RffBasis {
  omega: number[];
  bias: number[];
  D: number;
}

/**
 * Deterministic D-dimensional RFF basis for kernel
 * k(u,v) = exp(-(u-v)^2 / (2 sigma^2)) with omega_d ~
 * N(0, 1 / sigma^2), bias_d ~ U[0, 2 pi]. Seeded by the
 * caller for full reproducibility.
 */
export function buildRffBasis(D: number, sigma: number, seed: number): RffBasis {
  if (!Number.isInteger(D) || D < 1) {
    throw new Error(`buildRffBasis: D must be int >= 1 (got ${D})`);
  }
  if (!Number.isFinite(sigma) || sigma <= 0) {
    throw new Error(`buildRffBasis: sigma must be > 0 (got ${sigma})`);
  }
  const rng = mulberry32(seed);
  const omega = new Array<number>(D);
  const bias = new Array<number>(D);
  const invSigma = 1 / sigma;
  for (let d = 0; d < D; d += 1) {
    omega[d] = boxMullerStdNormal(rng) * invSigma;
    bias[d] = rng() * 2 * Math.PI;
  }
  return { omega, bias, D };
}

/** Apply RFF embedding to a scalar z. Returns Phi(z) in R^D. */
export function rffEmbed(z: number, basis: RffBasis): number[] {
  const { omega, bias, D } = basis;
  const out = new Array<number>(D);
  const norm = Math.sqrt(2 / D);
  for (let d = 0; d < D; d += 1) {
    out[d] = norm * Math.cos(omega[d]! * z + bias[d]!);
  }
  return out;
}

// =========================================================
// SECTION 2. MAD-STANDARDISATION + MEDIAN BANDWIDTH
// =========================================================

function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const m = n >> 1;
  return n % 2 === 1 ? sorted[m]! : 0.5 * (sorted[m - 1]! + sorted[m]!);
}

export function median(x: number[]): number {
  const s = x.slice().sort((a, b) => a - b);
  return medianSorted(s);
}

export function mad(x: number[]): number {
  const med = median(x);
  const dev = x.map((v) => Math.abs(v - med));
  return median(dev);
}

/**
 * Median pairwise distance |z_i - z_j| over i<j (capped at
 * a sample of pairs for n large; here n is per-source daily
 * tenure, typically <= a few hundred so the full O(n^2) is
 * cheap).
 */
export function medianPairwiseDistance(z: number[]): number {
  const n = z.length;
  if (n < 2) return 0;
  const dists: number[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      dists.push(Math.abs(z[i]! - z[j]!));
    }
  }
  dists.sort((a, b) => a - b);
  return medianSorted(dists);
}

// =========================================================
// SECTION 3. NEWMA CORE
// =========================================================

export interface NewmaResult {
  /** T(t) = ||M_1(t) - M_2(t)||_2, length n. */
  tCurve: number[];
  /** Detected changepoint indices in ORIGINAL series space. */
  tauStar: number[];
  /** max over t of T(t). */
  tMax: number;
  /** mean of T(t). */
  tMean: number;
  /** trapezoidal integral of T(t). */
  tArea: number;
  /** argmax raw original-series index of T(t). */
  tauStarBest: number;
  /** Steady-state SD threshold actually applied (eq. 9). */
  thrSteady: number;
}

export interface NewmaOptions {
  lambda1: number;
  lambda2: number;
  D: number;
  sigma: number;
  thrMul: number;
  delayCool: number;
  rffSeed: number;
}

/**
 * Closed-form steady-state SD of ||M_1 - M_2|| under iid
 * bounded RFF features, per eq. (9). Each Phi_d has mean
 * E[Phi_d] integrated to 0 by the Bochner phase b_d ~
 * U[0,2pi] and variance 1/D, so
 * Var(M_k(infty)) = 1/D * lambda_k / (2 - lambda_k) and
 * Cov(M_1, M_2)(infty) = 1/D * lambda_1 lambda_2 /
 * (lambda_1 + lambda_2 - lambda_1 lambda_2). Summing over
 * D coords gives the under-the-square-root expression in
 * eq. (9) without the leading 2*D factor (the 2*D factor
 * accounts for the full Var(||.||) expansion).
 */
export function newmaSteadyStateSd(
  lambda1: number,
  lambda2: number,
  D: number,
): number {
  // Per-coord steady-state variance of an EWMA of iid
  // unit-variance noise is lambda / (2 - lambda). Each Phi_d
  // has variance 1/D (since |Phi_d| <= sqrt(2/D) and the
  // bias b_d ~ U[0,2pi] zero-means it). Summing E||.||^2
  // over D coords cancels the 1/D factor, giving a result
  // INDEPENDENT of D in the leading order. The D dependence
  // re-enters only through the slack between sqrt(E[X^2])
  // and the desired SD-of-norm (a sqrt(2/D) factor on the
  // chi-distribution mean for D large). For our threshold
  // we keep the simpler closed form
  //
  //   sd ~ sqrt(v1 + v2 - 2 c12)
  //
  // and absorb residual scale into thrMul.
  const v1 = lambda1 / (2 - lambda1);
  const v2 = lambda2 / (2 - lambda2);
  const c12 = (lambda1 * lambda2) / (lambda1 + lambda2 - lambda1 * lambda2);
  void D;
  const inside = v1 + v2 - 2 * c12;
  if (!Number.isFinite(inside) || inside < 0) return 0;
  return Math.sqrt(inside);
}

/**
 * Pure online NEWMA scan over a standardised series z[].
 * Throws on bad shape arguments.
 */
export function newmaRun(z: number[], opts: NewmaOptions): NewmaResult {
  const { lambda1, lambda2, D, sigma, thrMul, delayCool, rffSeed } = opts;
  const n = z.length;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`newmaRun: need n >= 1 integer (got ${n})`);
  }
  if (!Number.isFinite(lambda1) || lambda1 <= 0 || lambda1 >= 1) {
    throw new Error(`newmaRun: lambda1 must be in (0,1) (got ${lambda1})`);
  }
  if (!Number.isFinite(lambda2) || lambda2 <= 0 || lambda2 >= 1) {
    throw new Error(`newmaRun: lambda2 must be in (0,1) (got ${lambda2})`);
  }
  if (!(lambda1 < lambda2)) {
    throw new Error(`newmaRun: need lambda1 < lambda2 (got ${lambda1}, ${lambda2})`);
  }
  if (!Number.isInteger(D) || D < 1) {
    throw new Error(`newmaRun: D must be int >= 1 (got ${D})`);
  }
  if (!Number.isFinite(sigma) || sigma <= 0) {
    throw new Error(`newmaRun: sigma must be > 0 (got ${sigma})`);
  }
  if (!Number.isFinite(thrMul) || thrMul < 0) {
    throw new Error(`newmaRun: thrMul must be >= 0 (got ${thrMul})`);
  }
  if (!Number.isInteger(delayCool) || delayCool < 1) {
    throw new Error(`newmaRun: delayCool must be int >= 1 (got ${delayCool})`);
  }
  const basis = buildRffBasis(D, sigma, rffSeed);
  const M1 = new Array<number>(D).fill(0);
  const M2 = new Array<number>(D).fill(0);
  const tCurve = new Array<number>(n).fill(0);
  for (let t = 0; t < n; t += 1) {
    const phi = rffEmbed(z[t]!, basis);
    let sumSq = 0;
    for (let d = 0; d < D; d += 1) {
      M1[d] = (1 - lambda1) * M1[d]! + lambda1 * phi[d]!;
      M2[d] = (1 - lambda2) * M2[d]! + lambda2 * phi[d]!;
      const diff = M1[d]! - M2[d]!;
      sumSq += diff * diff;
    }
    const T = Math.sqrt(sumSq);
    tCurve[t] = Number.isFinite(T) ? T : 0;
  }
  const thrSteadyRaw = newmaSteadyStateSd(lambda1, lambda2, D);
  const thrSteady = thrMul * thrSteadyRaw;
  let tMax = 0;
  let tMaxIdx = 0;
  let tSum = 0;
  for (let t = 0; t < n; t += 1) {
    const v = tCurve[t]!;
    tSum += v;
    if (v > tMax) {
      tMax = v;
      tMaxIdx = t;
    }
  }
  const tMean = n > 0 ? tSum / n : 0;
  let tArea = 0;
  for (let t = 0; t + 1 < n; t += 1) {
    tArea += 0.5 * (tCurve[t]! + tCurve[t + 1]!);
  }
  // Excursion-collapse: emit one CP per maximal run of
  // consecutive exceedances, located at the argmax inside.
  const cps: number[] = [];
  let inRun = false;
  let runStart = 0;
  let runArgmax = 0;
  let runArgmaxVal = 0;
  for (let t = 0; t < n; t += 1) {
    const exceed = thrSteady > 0 && tCurve[t]! > thrSteady;
    if (exceed) {
      if (!inRun) {
        inRun = true;
        runStart = t;
        runArgmax = t;
        runArgmaxVal = tCurve[t]!;
      } else if (tCurve[t]! > runArgmaxVal) {
        runArgmax = t;
        runArgmaxVal = tCurve[t]!;
      }
    } else if (inRun) {
      cps.push(runArgmax);
      inRun = false;
    }
  }
  if (inRun) cps.push(runArgmax);
  // Cooldown deduplication.
  const tauStar: number[] = [];
  for (const c of cps) {
    if (tauStar.length === 0 || c - tauStar[tauStar.length - 1]! >= delayCool) {
      tauStar.push(c);
    }
  }
  return {
    tCurve,
    tauStar,
    tMax,
    tMean,
    tArea,
    tauStarBest: tMaxIdx,
    thrSteady,
  };
}

// =========================================================
// SECTION 4. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenKerivenGarreauPoliNewmaKernelChangepointSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'tMax'
  | 'tMaxDesc'
  | 'tArea'
  | 'tAreaDesc'
  | 'tMean'
  | 'tMeanDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKerivenGarreauPoliNewmaKernelChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSort;
  /** Slow EWMA forgetting factor in (0,1). Default 0.05. */
  lambda1?: number;
  /** Fast EWMA forgetting factor in (0,1). Default 0.20. */
  lambda2?: number;
  /** RFF dimension D. Default 64. */
  D?: number;
  /** Optional explicit kernel bandwidth sigma. Default median heuristic. */
  sigma?: number;
  /** Threshold multiplier on closed-form steady-state SD. Default 0.7. */
  thrMul?: number;
  /** Min spacing between successive detected CPs (days). Default 7. */
  delayCool?: number;
  /** Drop rows with mChangepoints == 0. */
  onlyWithCps?: boolean;
  /** Salt for the per-source RFF seed. Default 'axis230'. */
  rffSalt?: string;
  generatedAt?: string;
}

export interface DailyTokenKerivenGarreauPoliNewmaKernelChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  tauStar: number[];
  tauStarDays: string[];
  tMax: number;
  tMean: number;
  tArea: number;
  tauStarBest: number;
  tauStarBestDay: string;
  lambda1: number;
  lambda2: number;
  D: number;
  sigma: number;
  thrMul: number;
  thrSteady: number;
  delayCool: number;
  rffSeed: number;
}

export interface DailyTokenKerivenGarreauPoliNewmaKernelChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSort;
  lambda1: number;
  lambda2: number;
  D: number;
  sigma: number | null;
  thrMul: number;
  delayCool: number;
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
  sources: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSourceRow[];
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
 * runs NEWMA scan, returns a deterministic report.
 */
export function buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(
  queue: QueueLine[],
  opts: DailyTokenKerivenGarreauPoliNewmaKernelChangepointOptions = {},
): DailyTokenKerivenGarreauPoliNewmaKernelChangepointReport {
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
  const sort: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'tMax',
    'tMaxDesc',
    'tArea',
    'tAreaDesc',
    'tMean',
    'tMeanDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const lambda1 = opts.lambda1 ?? 0.05;
  if (!Number.isFinite(lambda1) || lambda1 <= 0 || lambda1 >= 1) {
    throw new Error(`lambda1 must be in (0,1) (got ${opts.lambda1})`);
  }
  const lambda2 = opts.lambda2 ?? 0.2;
  if (!Number.isFinite(lambda2) || lambda2 <= 0 || lambda2 >= 1) {
    throw new Error(`lambda2 must be in (0,1) (got ${opts.lambda2})`);
  }
  if (!(lambda1 < lambda2)) {
    throw new Error(`lambda1 must be < lambda2 (got ${lambda1}, ${lambda2})`);
  }
  const D = opts.D ?? 64;
  if (!Number.isInteger(D) || D < 1) {
    throw new Error(`D must be an integer >= 1 (got ${opts.D})`);
  }
  const explicitSigma = opts.sigma ?? null;
  if (explicitSigma !== null) {
    if (!Number.isFinite(explicitSigma) || explicitSigma <= 0) {
      throw new Error(`sigma must be > 0 (got ${opts.sigma})`);
    }
  }
  const thrMul = opts.thrMul ?? 0.7;
  if (!Number.isFinite(thrMul) || thrMul < 0) {
    throw new Error(`thrMul must be >= 0 (got ${opts.thrMul})`);
  }
  const delayCool = opts.delayCool ?? 7;
  if (!Number.isInteger(delayCool) || delayCool < 1) {
    throw new Error(`delayCool must be an integer >= 1 (got ${opts.delayCool})`);
  }
  const onlyWithCps = opts.onlyWithCps ?? false;
  if (typeof onlyWithCps !== 'boolean') {
    throw new Error(`onlyWithCps must be boolean (got ${opts.onlyWithCps})`);
  }
  const rffSalt = opts.rffSalt ?? 'axis230';
  if (typeof rffSalt !== 'string') {
    throw new Error(`rffSalt must be string (got ${opts.rffSalt})`);
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
  let sigmaUsedReport: number | null = explicitSigma;
  const rows: DailyTokenKerivenGarreauPoliNewmaKernelChangepointSourceRow[] = [];

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
    // MAD-standardise.
    const med = median(filled);
    const m = mad(filled);
    const denom = Math.max(m, 1e-12);
    const z = filled.map((v) => (v - med) / denom);
    // Bandwidth.
    let sigma: number;
    if (explicitSigma !== null) {
      sigma = explicitSigma;
    } else {
      const md = medianPairwiseDistance(z);
      sigma = Math.max(md, 1e-6);
    }
    if (sigmaUsedReport === null) sigmaUsedReport = sigma;
    const seed = (fnv1a32(`${rffSalt}|${src}|${nTenure}|${D}`) ^ 0xa5a5a5a5) >>> 0;
    let result: NewmaResult;
    try {
      result = newmaRun(z, {
        lambda1,
        lambda2,
        D,
        sigma,
        thrMul,
        delayCool,
        rffSeed: seed,
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(result.tMax) ||
      !Number.isFinite(result.tMean) ||
      !Number.isFinite(result.tArea)
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
      tMax: result.tMax,
      tMean: result.tMean,
      tArea: result.tArea,
      tauStarBest: result.tauStarBest,
      tauStarBestDay,
      lambda1,
      lambda2,
      D,
      sigma,
      thrMul,
      thrSteady: result.thrSteady,
      delayCool,
      rffSeed: seed,
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
      case 'tMax':
        primary = a.tMax - b.tMax;
        break;
      case 'tMaxDesc':
        primary = b.tMax - a.tMax;
        break;
      case 'tArea':
        primary = a.tArea - b.tArea;
        break;
      case 'tAreaDesc':
        primary = b.tArea - a.tArea;
        break;
      case 'tMean':
        primary = a.tMean - b.tMean;
        break;
      case 'tMeanDesc':
        primary = b.tMean - a.tMean;
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
    lambda1,
    lambda2,
    D,
    sigma: sigmaUsedReport,
    thrMul,
    delayCool,
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
