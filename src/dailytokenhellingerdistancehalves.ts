/**
 * daily-token-hellinger-distance-halves: per-source KDE-SMOOTHED
 * HELLINGER DISTANCE between the FIRST and SECOND half of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127 for direct
 * comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h is Silverman's rule of thumb on the POOLED
 * sample with the robust scale (Silverman 1986, Density
 * Estimation for Statistics and Data Analysis, eq. 3.31):
 *
 *     h = 0.9 * mad_pool * n^(-1/5)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side
 * (Wand & Jones 1995 Kernel Smoothing, §2.7):
 *
 *     g_lo = min(x) - 3*h
 *     g_hi = max(x) + 3*h
 *     dx   = (g_hi - g_lo) / (K - 1)
 *
 * Gaussian KDE per half on the shared grid; trapezoidal
 * mass-normalisation to exact pmfs p, q on {g_0..g_{K-1}}
 * (sum_k p_k = sum_k q_k = 1).
 *
 * HELLINGER DISTANCE between the discrete pmfs (Pollard
 * 2002, A User's Guide to Measure Theoretic Probability,
 * Chapter 3, definition; also Le Cam & Yang 2000,
 * Asymptotics in Statistics, §4.2):
 *
 *     H(p, q) = (1 / sqrt(2)) * sqrt( sum_k (sqrt(p_k) - sqrt(q_k))^2 )
 *
 * Equivalently, with Bhattacharyya coefficient
 * BC(p, q) = sum_k sqrt(p_k * q_k):
 *
 *     H(p, q) = sqrt( 1 - BC(p, q) )
 *
 * H in [0, 1]. H = 0 iff p === q on the grid; H = 1 iff
 * p, q have disjoint support on the grid (BC = 0). H is a
 * TRUE METRIC on the probability simplex (sym., non-neg.,
 * identity of indiscernibles, triangle inequality directly
 * on the L^2 norm in sqrt-amplitude coordinates).
 *
 * Per-grid-point H^2 contribution:
 *
 *     hsqContribByBin[k] = 0.5 * (sqrt(p_k) - sqrt(q_k))^2
 *     hMaxBin            = argmax_k hsqContribByBin[k]
 *     hMaxBinValue       = hsqContribByBin[hMaxBin]
 *
 * (Per-bin H^2 contribution is bounded by 0.5 since each
 * sqrt(p_k), sqrt(q_k) in [0, 1] and the squared difference
 * cannot exceed 1; halving gives the 0.5 cap.)
 *
 * Le Cam-style ANCHOR (Le Cam 1986, Asymptotic Methods in
 * Statistical Decision Theory, §16.4): H^2 <= TV <= sqrt(2)*H,
 * equivalently
 *
 *     H^2 <= tvDist <= sqrt(2) * H,
 *
 * so H is SANDWICHED by TV (axis-127) but is NEITHER a
 * monotone image of TV nor of JSD (axis-126). H lives in
 * SQRT-AMPLITUDE space: it weights pmf differences by
 * 1 / sqrt(p + q) implicitly (because d(sqrt p) ~ dp / (2 sqrt p)),
 * giving more sensitivity to LOW-MASS bins than TV (which
 * is uniform in p) and LESS sensitivity than JSD (which is
 * log-ratio amplified). This is the precise sense in which
 * H is the "geometric-mean tail" between TV and JSD on the
 * probability simplex.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-127:
 *
 *   - Class. L^2 DISTANCE in SQRT-AMPLITUDE COORDINATES of
 *     KERNEL-DENSITY-SMOOTHED probability mass functions.
 *     The metric is QUADRATIC in sqrt(p) - sqrt(q), NOT
 *     linear in p - q (TV), NOT log-ratio (JSD), NOT a CDF
 *     functional.
 *
 *   - vs axis-118 KS / 119 AD / 120 CvM. CDF-based
 *     functionals (sup-norm, tail-weighted L^2, unweighted
 *     L^2 of CDF differences). H is a pmf functional in
 *     sqrt-amplitude coordinates and is INVARIANT under
 *     pmf permutation across bins (a CDF-based test is not).
 *
 *   - vs axis-121 W1. W1 is L^1 of CDF differences with
 *     token units; H is dimensionless and lives in the
 *     probability simplex.
 *
 *   - vs axis-122 energy / 123 MMD. CF-1/t^2 and RKHS
 *     embedding distances; both are infinite-dimensional
 *     and weighted by a kernel/CF; H is a finite-grid
 *     L^2 distance in sqrt-amplitude space.
 *
 *   - vs axis-124 qv-Mahalanobis / 125 PCA-projection.
 *     Live in low-dimensional (R^9 / R^d) Euclidean spaces;
 *     H lives in the K=257 sqrt-pmf simplex.
 *
 *   - vs axis-126 JSD (KDE-smoothed Jensen-Shannon
 *     divergence in bits). Both share the IDENTICAL KDE
 *     setup (h, K, grid, trapezoidal weights). JSD weights
 *     each bin by log(p/m): a 0.001-vs-0.0001 disagreement
 *     produces a ~3.32-bit log-ratio jolt. H weights by
 *     sqrt(p) - sqrt(q): the same 0.001 vs 0.0001 contributes
 *     (sqrt(0.001) - sqrt(0.0001))^2 = ~4.4e-4 to H^2, far
 *     smaller. So H is sensitive to the BULK (sqrt-amplitude)
 *     of mass disagreement, not to log-ratio extremes.
 *     Crucially: H and JSD are NOT monotone images of each
 *     other -- a pmf with broad sqrt-amplitude disagreement
 *     gives large H but moderate JSD; a pmf with thin
 *     low-mass log-ratio spike gives large JSD but moderate H.
 *
 *   - vs axis-127 TV (KDE-smoothed Total-Variation distance,
 *     identical KDE setup). MOST IMPORTANT comparison since
 *     TV is the closest neighbour. Le Cam's bound:
 *     H^2 <= tvDist <= sqrt(2)*H. H is RIEMANNIAN on the
 *     simplex (sqrt-pmf is the embedding of the simplex in
 *     the unit sphere of R^K_+; H equals the chord distance
 *     up to scale), TV is FLAT in pmf coordinates. A pmf
 *     disagreement that is BROAD AND DIFFUSE has H^2 ~ TV
 *     (since sqrt is locally linear there); a pmf
 *     disagreement that is CONCENTRATED on a few low-mass
 *     bins has H >> TV (since sqrt amplifies low-mass
 *     differences). The two axes therefore are not monotone
 *     images of each other and the cross-source ranking can
 *     differ.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; H is permutation-
 *     invariant within halves and applied to two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the HELLINGER DISTANCE (L^2 in sqrt-amplitude
 *   coordinates), how much SQRT-AMPLITUDE DISAGREEMENT
 *   (in [0, 1]) separates the two half-densities, and
 *   which source has the largest H?"**
 *
 * References:
 *   Le Cam, L., Asymptotic Methods in Statistical Decision
 *     Theory, Springer (1986), §16.4.
 *   Le Cam, L. and Yang, G. L., Asymptotics in Statistics,
 *     2nd edition, Springer (2000), §4.2.
 *   Pollard, D., A User's Guide to Measure Theoretic
 *     Probability, Cambridge (2002), Chapter 3.
 *   Silverman, B. W., Density Estimation for Statistics
 *     and Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes 126/127. Hard
 *     floor n >= 8 so that n1, n2 >= 4.
 *   - hDist === 0 iff p === q on the grid; this is the
 *     reference for "halves are indistinguishable after
 *     KDE smoothing under the sqrt-amplitude L^2 norm".
 *   - hDist is in [0, 1] and is the true Hellinger metric
 *     on the probability simplex.
 *   - Trapezoidal mass normalisation makes p, q exact pmfs
 *     to machine precision regardless of how spread the
 *     KDE puts mass outside the chosen support extension.
 *   - H is INVARIANT under translation x -> x + c AND
 *     under positive rescaling x -> k*x (k > 0; identical
 *     argument as for TV/JSD: data and bandwidth scale
 *     together, dx scales together, w_k * f scales by 1,
 *     p_k and q_k unchanged so sqrt(p_k) - sqrt(q_k)
 *     unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-hellinger-distance-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-hellinger-distance-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Hellinger distance ascending (closest halves first):
 *   pew-insights daily-token-hellinger-distance-halves \
 *     --sort hDist
 */
import type { QueueLine } from './types.js';

export type DailyTokenHellingerDistanceHalvesSort =
  | 'hDist'
  | 'hDistDesc'
  | 'hMaxBinValue'
  | 'hMaxBinValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHellingerDistanceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHellingerDistanceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenHellingerDistanceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half sample size n1 = floor(n/2). */
  hN1: number;
  /** Second-half sample size n2 = n - n1. */
  hN2: number;
  /** Pooled robust scale (1.4826 * MAD around pooled median). */
  hMadPool: number;
  /** Silverman bandwidth h = 0.9 * mad_pool * n^(-1/5). */
  hBandwidth: number;
  /** Grid lower bound g_lo = min(x) - 3*h. */
  hGridLo: number;
  /** Grid upper bound g_hi = max(x) + 3*h. */
  hGridHi: number;
  /** Grid spacing dx. */
  hGridDx: number;
  /** Grid size K (fixed = 257). */
  hGridK: number;
  /** Hellinger distance = sqrt(0.5 * sum_k (sqrt p - sqrt q)^2), in [0, 1]. */
  hDist: number;
  /** Bhattacharyya coefficient BC = sum_k sqrt(p_k * q_k), in [0, 1]. */
  hBhattacharyya: number;
  /** Argmax bin index of the per-bin H^2 contribution. */
  hMaxBin: number;
  /** Grid value at hMaxBin (in token units). */
  hMaxBinX: number;
  /** Per-bin contribution 0.5*(sqrt p - sqrt q)^2 at hMaxBin (dimensionless). */
  hMaxBinValue: number;
  /**
   * Bhattacharyya angle (Riemannian geodesic distance on the
   * sqrt-pmf unit sphere): hAngle = arccos(hBhattacharyya), in
   * [0, pi/2]. Diagnostic only. Satisfies the half-angle identity
   * sqrt(2) * sin(hAngle / 2) = hDist exactly (algebraic
   * consequence of 2*sin^2(theta/2) = 1 - cos(theta) combined
   * with hDist^2 = 1 - BC -- the same identity verified by the
   * test suite).
   * The angle puts H in its NATURAL Riemannian setting: the
   * sqrt-pmf vectors live on the unit sphere of R^K_+ (since
   * sum_k (sqrt p_k)^2 = sum_k p_k = 1) and hAngle is their
   * arc-length separation. Translation- and positive-scale-
   * invariant for the same reason as hDist.
   */
  hAngle: number;
}

export interface DailyTokenHellingerDistanceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHellingerDistanceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  /** Fixed grid size. */
  gridK: number;
  /** Fixed Silverman multiplier. */
  silvermanMultiplier: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenHellingerDistanceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127 for direct comparability). */
export const H_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126/127). */
export const H_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side (matches axes 126/127). */
export const H_GRID_EXTENSION_H = 3;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function gaussianPdf(u: number): number {
  return Math.exp(-0.5 * u * u) / SQRT_2PI;
}

/** Population median of a copy-sorted array. */
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * KDE-smoothed Hellinger distance between halves of a real
 * series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - hDist(x + c) === hDist(x) for any constant c
 *     (translation-invariance: KDE, grid, and pmfs all
 *     shift rigidly).
 *   - hDist(k*x) === hDist(x) for any k > 0
 *     (positive scale-invariance: data, bandwidth, and grid
 *     spacing all scale by k; pmf entries unchanged).
 *   - hDist in [0, 1].
 *   - hDist === 0 when both halves are identical samples.
 *   - Symmetric: swapping the two halves preserves hDist
 *     exactly (since (sqrt p - sqrt q)^2 === (sqrt q - sqrt p)^2).
 *   - hDist^2 + hBhattacharyya === 1 (algebraic identity:
 *     0.5 * sum (sqrt p - sqrt q)^2 = 0.5 * sum (p + q - 2 sqrt(pq))
 *     = 1 - sum sqrt(pq) = 1 - BC).
 */
export function dailyTokenHellingerDistanceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  hN1: number;
  hN2: number;
  hMadPool: number;
  hBandwidth: number;
  hGridLo: number;
  hGridHi: number;
  hGridDx: number;
  hGridK: number;
  hDist: number;
  hBhattacharyya: number;
  hMaxBin: number;
  hMaxBinX: number;
  hMaxBinValue: number;
  hAngle: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenHellingerDistanceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenHellingerDistanceHalves requires finite values',
      );
    }
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenHellingerDistanceHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const A = values.slice(0, n1);
  const B = values.slice(n1);

  // Pooled robust scale.
  const medPool = median(values);
  const absDev: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) absDev[i] = Math.abs(values[i]! - medPool);
  const madPool = 1.4826 * median(absDev);

  // Silverman bandwidth on the pooled robust scale; fall back
  // to data range / n^(1/5) if mad is zero (only possible on
  // pathological inputs already excluded by zero-variance guard).
  let h = H_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = H_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  // Shared grid.
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - H_GRID_EXTENSION_H * h;
  const gHi = mx + H_GRID_EXTENSION_H * h;
  const K = H_GRID_K;
  const dx = (gHi - gLo) / (K - 1);

  // KDE values on the shared grid for each half.
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

  // Trapezoidal weights.
  const w: number[] = new Array(K);
  for (let k = 0; k < K; k += 1) {
    w[k] = k === 0 || k === K - 1 ? dx / 2 : dx;
  }
  // Mass-normalise to exact pmfs.
  let zA = 0;
  let zB = 0;
  for (let k = 0; k < K; k += 1) {
    zA += w[k]! * fA[k]!;
    zB += w[k]! * fB[k]!;
  }
  if (!(zA > 0) || !(zB > 0) || !Number.isFinite(zA) || !Number.isFinite(zB)) {
    throw new Error(
      `dailyTokenHellingerDistanceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Hellinger distance: H = sqrt(0.5 * sum_k (sqrt p - sqrt q)^2).
  // Equivalently: H = sqrt(1 - BC) with BC = sum_k sqrt(p*q).
  // Compute both forms in a single pass so we can expose BC as
  // a diagnostic AND check the algebraic identity at the test
  // boundary.
  let hsqSum = 0;
  let bc = 0;
  let maxBin = 0;
  let maxBinValue = -Infinity;
  for (let k = 0; k < K; k += 1) {
    const pk = (w[k]! * fA[k]!) / zA;
    const qk = (w[k]! * fB[k]!) / zB;
    const sp = Math.sqrt(pk);
    const sq = Math.sqrt(qk);
    const d = sp - sq;
    const contrib = 0.5 * d * d;
    hsqSum += contrib;
    bc += sp * sq;
    if (contrib > maxBinValue) {
      maxBinValue = contrib;
      maxBin = k;
    }
  }
  // Numerical clamp [0, 1] before sqrt.
  if (hsqSum < 0) hsqSum = 0;
  if (hsqSum > 1) hsqSum = 1;
  const hDist = Math.sqrt(hsqSum);
  if (bc < 0) bc = 0;
  if (bc > 1) bc = 1;
  const hMaxBinX = gLo + maxBin * dx;
  const hAngle = Math.acos(bc);

  if (
    !Number.isFinite(hDist) ||
    !Number.isFinite(maxBinValue) ||
    !Number.isFinite(bc) ||
    !Number.isFinite(hAngle)
  ) {
    throw new Error(
      `dailyTokenHellingerDistanceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    hN1: n1,
    hN2: n2,
    hMadPool: madPool,
    hBandwidth: h,
    hGridLo: gLo,
    hGridHi: gHi,
    hGridDx: dx,
    hGridK: K,
    hDist,
    hBhattacharyya: bc,
    hMaxBin: maxBin,
    hMaxBinX,
    hMaxBinValue: maxBinValue,
    hAngle,
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

export function buildDailyTokenHellingerDistanceHalves(
  queue: QueueLine[],
  opts: DailyTokenHellingerDistanceHalvesOptions = {},
): DailyTokenHellingerDistanceHalvesReport {
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
  const sort: DailyTokenHellingerDistanceHalvesSort =
    opts.sort ?? 'hDistDesc';
  const validSorts: DailyTokenHellingerDistanceHalvesSort[] = [
    'hDist',
    'hDistDesc',
    'hMaxBinValue',
    'hMaxBinValueDesc',
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
  const rows: DailyTokenHellingerDistanceHalvesSourceRow[] = [];

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
      result = dailyTokenHellingerDistanceHalves(filled);
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
      hN1: result.hN1,
      hN2: result.hN2,
      hMadPool: result.hMadPool,
      hBandwidth: result.hBandwidth,
      hGridLo: result.hGridLo,
      hGridHi: result.hGridHi,
      hGridDx: result.hGridDx,
      hGridK: result.hGridK,
      hDist: result.hDist,
      hBhattacharyya: result.hBhattacharyya,
      hMaxBin: result.hMaxBin,
      hMaxBinX: result.hMaxBinX,
      hMaxBinValue: result.hMaxBinValue,
      hAngle: result.hAngle,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hDist':
        primary = a.hDist - b.hDist;
        break;
      case 'hDistDesc':
        primary = b.hDist - a.hDist;
        break;
      case 'hMaxBinValue':
        primary = a.hMaxBinValue - b.hMaxBinValue;
        break;
      case 'hMaxBinValueDesc':
        primary = b.hMaxBinValue - a.hMaxBinValue;
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
    gridK: H_GRID_K,
    silvermanMultiplier: H_SILVERMAN_MULTIPLIER,
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
