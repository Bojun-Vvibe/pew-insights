/**
 * daily-token-total-variation-halves: per-source KDE-SMOOTHED
 * TOTAL-VARIATION DISTANCE between the FIRST and SECOND half
 * of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-SEVENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axis-126 for direct
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
 * TOTAL-VARIATION DISTANCE between the discrete pmfs
 * (Levin & Peres 2017, Markov Chains and Mixing Times,
 * Definition 4.1; equivalent to half the L^1 distance):
 *
 *     tvDist = 0.5 * sum_k | p_k - q_k |
 *
 * tvDist in [0, 1]. tvDist = 0 iff p === q on the grid;
 * tvDist = 1 iff p and q have disjoint support on the
 * grid. tvDist is a TRUE METRIC on the probability simplex
 * (sym., non-negative, identity of indiscernibles, triangle
 * inequality directly inherited from the L^1 norm).
 *
 * Per-grid-point TV contribution:
 *
 *     tvContribByBin[k] = 0.5 * | p_k - q_k |
 *     tvMaxBin          = argmax_k tvContribByBin[k]
 *     tvMaxBinValue     = tvContribByBin[tvMaxBin]
 *
 * Pinsker-style anchor (Lemma 2.1, Tsybakov 2009 Intro to
 * Nonparametric Estimation): tvDist <= sqrt(0.5 * KL(p||q))
 * and the dual JS bound tvDist <= sqrt(2 * ln(2) * jsdBits)
 * (Endres & Schindelin 2003, Cor. 5). We do NOT compute KL
 * here -- the bound is informational only and shows that TV
 * is a STRICTLY WEAKER signal than JSD: small JSD implies
 * small TV, but small TV does not bound JSD (TV can be small
 * while JSD has a long, thin discrepancy). This is why the
 * axes are NOT redundant.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-126:
 *
 *   - Class. L^1 (HALF-NORM) DISTANCE on KERNEL-DENSITY-
 *     SMOOTHED probability mass functions. The metric is
 *     POINTWISE-LINEAR in pmf differences, NOT log-ratio,
 *     NOT quadratic, NOT CDF-based.
 *
 *   - vs axis-118 KS (sup-norm CDF distance). KS is the
 *     L_INFTY norm of CDF differences; TV is HALF the L^1
 *     norm of pmf differences. TV captures DIFFUSE
 *     POINTWISE mass disagreement that KS misses (KS only
 *     records the single worst CDF gap); TV records the
 *     INTEGRATED absolute mass disagreement.
 *
 *   - vs axis-119 AD (tail-weighted L^2 CDF distance) and
 *     axis-120 CvM (unweighted L^2 CDF distance). Both are
 *     QUADRATIC functionals of CDF differences; TV is a
 *     LINEAR functional of pmf differences. A pmf with two
 *     equal-magnitude, opposite-sign mass shifts at well-
 *     separated bins gives small CDF-L^2 (cancellation)
 *     but full-magnitude TV (no cancellation in |.|).
 *
 *   - vs axis-121 W1 (transport cost in token units). W1
 *     equals the L^1 norm of CDF differences AND has units
 *     of tokens; TV is dimensionless and is the L^1 norm of
 *     pmf differences. They are linked by the bound
 *     W1 >= tvDist * (range/2) but are NOT monotone images
 *     of each other (a translation x -> x + c gives W1 = c
 *     but tvDist depends on the smoothed pmf overlap, not
 *     the location shift directly).
 *
 *   - vs axis-122 energy (1/t^2-weighted CF distance). Energy
 *     is a moment-matching test in characteristic-function
 *     space; TV is a real-domain pmf-amplitude test. Energy
 *     is QUADRATIC in CF differences; TV is LINEAR in pmf
 *     differences.
 *
 *   - vs axis-123 MMD (Gaussian RKHS distance). MMD is a
 *     PAIRWISE KERNEL DISTANCE in an infinite-dimensional
 *     RKHS; TV is a POINTWISE L^1 INTEGRAL on a finite
 *     grid in pmf space. A pmf with the same RKHS-mean
 *     embedding but different pointwise mass gives small
 *     MMD and large TV.
 *
 *   - vs axis-124 qv-Mahalanobis. Lives in R^9 quantile-
 *     coordinate space; TV in K=257 pmf-coordinate space.
 *
 *   - vs axis-125 PCA-projection. PCA is COVARIANCE-AWARE
 *     through the delay-embedding lag structure; TV is
 *     PERMUTATION-INVARIANT within each half (depends only
 *     on the marginal pmf). Time-permuted halves preserve
 *     tvDist exactly but change pcZ.
 *
 *   - vs axis-126 JSD (KDE-smoothed Jensen-Shannon
 *     divergence in bits). MOST IMPORTANT comparison since
 *     both axes share the IDENTICAL KDE setup (h, K, grid,
 *     trapezoidal weights). JSD is a LOG-RATIO integral:
 *     0.5 * sum_k [p_k*log2(p_k/m_k) + q_k*log2(q_k/m_k)].
 *     TV is the L^1 HALF-NORM: 0.5 * sum_k |p_k - q_k|.
 *     TV is LINEAR in pmf gaps (each bin contributes its
 *     absolute amplitude, no log amplification); JSD is
 *     LOG-WEIGHTED (low-mass bins where one pmf is large
 *     and the other tiny dominate JSD because log(p/m)
 *     blows up). A pmf disagreement that is BROAD AND
 *     SHALLOW maximises TV but gives modest JSD; a
 *     disagreement that is NARROW AND SHARP near zero-mass
 *     regions maximises JSD but gives modest TV. Pinsker
 *     bound: tvDist <= sqrt(2 * ln(2) * jsdBits) (Endres
 *     & Schindelin 2003 Cor. 5) shows TV <= JSD-derived
 *     upper bound but the converse fails -- TV is a
 *     strictly weaker signal that captures aggregate mass
 *     disagreement, not log-ratio amplified disagreement.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; TV is permutation-
 *     invariant within halves and applied to two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the L^1-HALF-NORM TOTAL-VARIATION DISTANCE on the
 *   probability simplex, how much PMF-AMPLITUDE
 *   DISAGREEMENT (in [0, 1]) separates the two
 *   half-densities, and which source has the largest
 *   tvDist?"**
 *
 * References:
 *   Levin, D. A. and Peres, Y., Markov Chains and Mixing
 *     Times, 2nd edition, AMS (2017), Definition 4.1.
 *   Tsybakov, A. B., Introduction to Nonparametric
 *     Estimation, Springer (2009), Lemma 2.1 (Pinsker).
 *   Endres, D. M. and Schindelin, J. E., "A new metric
 *     for probability distributions", IEEE Transactions
 *     on Information Theory 49(7) (2003), pp. 1858-1860.
 *   Silverman, B. W., Density Estimation for Statistics
 *     and Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axis-126. Hard
 *     floor n >= 8 so that n1, n2 >= 4.
 *   - tvDist === 0 iff p === q on the grid; this is the
 *     reference for "halves are indistinguishable after
 *     KDE smoothing under L^1".
 *   - tvDist is in [0, 1] and is the true L^1-half-norm
 *     metric on the probability simplex.
 *   - Trapezoidal mass normalisation makes p, q exact pmfs
 *     to machine precision regardless of how spread the
 *     KDE puts mass outside the chosen support extension.
 *   - TV is INVARIANT under translation x -> x + c AND
 *     under positive rescaling x -> k*x (k > 0; identical
 *     argument as for JSD in axis-126: both data and
 *     bandwidth scale together, dx scales together,
 *     w_k * f scales by 1, p_k and q_k unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-total-variation-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-total-variation-halves \
 *     --source vscode-other --json
 *
 *   # Sort by TV distance ascending (closest halves first):
 *   pew-insights daily-token-total-variation-halves \
 *     --sort tvDist
 */
import type { QueueLine } from './types.js';

export type DailyTokenTotalVariationHalvesSort =
  | 'tvDist'
  | 'tvDistDesc'
  | 'tvMaxBinValue'
  | 'tvMaxBinValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTotalVariationHalvesOptions {
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
  sort?: DailyTokenTotalVariationHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenTotalVariationHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half sample size n1 = floor(n/2). */
  tvN1: number;
  /** Second-half sample size n2 = n - n1. */
  tvN2: number;
  /** Pooled robust scale (1.4826 * MAD around pooled median). */
  tvMadPool: number;
  /** Silverman bandwidth h = 0.9 * mad_pool * n^(-1/5). */
  tvBandwidth: number;
  /** Grid lower bound g_lo = min(x) - 3*h. */
  tvGridLo: number;
  /** Grid upper bound g_hi = max(x) + 3*h. */
  tvGridHi: number;
  /** Grid spacing dx. */
  tvGridDx: number;
  /** Grid size K (fixed = 257). */
  tvGridK: number;
  /** Total-variation distance = 0.5 * sum_k |p_k - q_k|, in [0, 1]. */
  tvDist: number;
  /** Argmax bin index of the per-bin contribution. */
  tvMaxBin: number;
  /** Grid value at tvMaxBin (in token units). */
  tvMaxBinX: number;
  /** Per-bin contribution 0.5*|p-q| at tvMaxBin (dimensionless). */
  tvMaxBinValue: number;
  /**
   * L^2 norm of the pmf gap: tvL2 = sqrt(sum_k (p_k - q_k)^2).
   * Diagnostic only; bounded above by sqrt(2) (when p, q have
   * disjoint single-bin support). Complementary to tvDist
   * (L^1 half-norm): tvL2 amplifies sharp single-bin gaps
   * relative to broad shallow ones, while tvDist sums them
   * linearly. Cauchy-Schwarz: 2*tvDist <= sqrt(K) * tvL2,
   * giving tvL2 >= 2*tvDist/sqrt(K) (here K=257). Translation-
   * and positive-scale-invariant for the same reason as tvDist.
   */
  tvL2: number;
}

export interface DailyTokenTotalVariationHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTotalVariationHalvesSort;
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
  sources: DailyTokenTotalVariationHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axis-126 for direct comparability). */
export const TV_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axis-126). */
export const TV_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side (matches axis-126). */
export const TV_GRID_EXTENSION_H = 3;

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
 * KDE-smoothed Total-Variation distance between halves of
 * a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - tvDist(x + c) === tvDist(x) for any constant c
 *     (translation-invariance: KDE, grid, and pmfs all
 *     shift rigidly).
 *   - tvDist(k*x) === tvDist(x) for any k > 0
 *     (positive scale-invariance: data, bandwidth, and grid
 *     spacing all scale by k; pmf entries unchanged).
 *   - tvDist in [0, 1].
 *   - tvDist === 0 when both halves are identical samples.
 *   - Symmetric: swapping the two halves preserves tvDist
 *     exactly (since |p - q| === |q - p|).
 */
export function dailyTokenTotalVariationHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  tvN1: number;
  tvN2: number;
  tvMadPool: number;
  tvBandwidth: number;
  tvGridLo: number;
  tvGridHi: number;
  tvGridDx: number;
  tvGridK: number;
  tvDist: number;
  tvMaxBin: number;
  tvMaxBinX: number;
  tvMaxBinValue: number;
  tvL2: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenTotalVariationHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenTotalVariationHalves requires finite values',
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
      `dailyTokenTotalVariationHalves: zero centred variance (n=${n})`,
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
  let h = TV_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = TV_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
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
  const gLo = mn - TV_GRID_EXTENSION_H * h;
  const gHi = mx + TV_GRID_EXTENSION_H * h;
  const K = TV_GRID_K;
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
      `dailyTokenTotalVariationHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }
  // Total-variation distance: 0.5 * sum_k |p_k - q_k|.
  // Companion L^2 norm sqrt(sum_k (p_k - q_k)^2) computed in
  // the same single pass for efficiency.
  let tv = 0;
  let l2sq = 0;
  let maxBin = 0;
  let maxBinValue = -Infinity;
  for (let k = 0; k < K; k += 1) {
    const pk = (w[k]! * fA[k]!) / zA;
    const qk = (w[k]! * fB[k]!) / zB;
    const gap = pk - qk;
    const absGap = Math.abs(gap);
    const contrib = 0.5 * absGap;
    tv += contrib;
    l2sq += gap * gap;
    if (contrib > maxBinValue) {
      maxBinValue = contrib;
      maxBin = k;
    }
  }
  // Numerical clamp [0, 1].
  if (tv < 0) tv = 0;
  if (tv > 1) tv = 1;
  const tvL2 = Math.sqrt(l2sq);
  const tvMaxBinX = gLo + maxBin * dx;

  if (
    !Number.isFinite(tv) ||
    !Number.isFinite(maxBinValue) ||
    !Number.isFinite(tvL2)
  ) {
    throw new Error(
      `dailyTokenTotalVariationHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    tvN1: n1,
    tvN2: n2,
    tvMadPool: madPool,
    tvBandwidth: h,
    tvGridLo: gLo,
    tvGridHi: gHi,
    tvGridDx: dx,
    tvGridK: K,
    tvDist: tv,
    tvMaxBin: maxBin,
    tvMaxBinX,
    tvMaxBinValue: maxBinValue,
    tvL2,
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

export function buildDailyTokenTotalVariationHalves(
  queue: QueueLine[],
  opts: DailyTokenTotalVariationHalvesOptions = {},
): DailyTokenTotalVariationHalvesReport {
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
  const sort: DailyTokenTotalVariationHalvesSort =
    opts.sort ?? 'tvDistDesc';
  const validSorts: DailyTokenTotalVariationHalvesSort[] = [
    'tvDist',
    'tvDistDesc',
    'tvMaxBinValue',
    'tvMaxBinValueDesc',
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
  const rows: DailyTokenTotalVariationHalvesSourceRow[] = [];

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
      result = dailyTokenTotalVariationHalves(filled);
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
      tvN1: result.tvN1,
      tvN2: result.tvN2,
      tvMadPool: result.tvMadPool,
      tvBandwidth: result.tvBandwidth,
      tvGridLo: result.tvGridLo,
      tvGridHi: result.tvGridHi,
      tvGridDx: result.tvGridDx,
      tvGridK: result.tvGridK,
      tvDist: result.tvDist,
      tvMaxBin: result.tvMaxBin,
      tvMaxBinX: result.tvMaxBinX,
      tvMaxBinValue: result.tvMaxBinValue,
      tvL2: result.tvL2,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tvDist':
        primary = a.tvDist - b.tvDist;
        break;
      case 'tvDistDesc':
        primary = b.tvDist - a.tvDist;
        break;
      case 'tvMaxBinValue':
        primary = a.tvMaxBinValue - b.tvMaxBinValue;
        break;
      case 'tvMaxBinValueDesc':
        primary = b.tvMaxBinValue - a.tvMaxBinValue;
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
    gridK: TV_GRID_K,
    silvermanMultiplier: TV_SILVERMAN_MULTIPLIER,
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
