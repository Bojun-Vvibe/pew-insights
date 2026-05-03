/**
 * daily-token-jensen-shannon-divergence-halves: per-source
 * KDE-SMOOTHED JENSEN-SHANNON DIVERGENCE between the FIRST
 * and SECOND half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-TWENTY-SIXTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median, deterministic; matches the median-heuristic style
 * of axis-123 MMD):
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
 * (Falls back to 1 if mad_pool is non-positive; this can
 * only happen on degenerate halves which are dropped
 * upstream by zero-variance guard.)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side
 * (the de-facto KDE convention; Wand & Jones 1995 Kernel
 * Smoothing, §2.7):
 *
 *     g_lo = min(x) - 3*h
 *     g_hi = max(x) + 3*h
 *     dx   = (g_hi - g_lo) / (K - 1)
 *     g_k  = g_lo + k*dx       for k = 0..K-1
 *
 * Gaussian KDE on each half evaluated on the shared grid:
 *
 *     f_A(g_k) = (1 / (n1 * h)) * sum_{a in A} phi( (g_k - a)/h )
 *     f_B(g_k) = (1 / (n2 * h)) * sum_{b in B} phi( (g_k - b)/h )
 *
 * with phi(u) = (1/sqrt(2*pi)) * exp(-u^2/2). Convert to
 * discrete pmfs by trapezoidal-rule mass-normalisation on
 * the shared grid:
 *
 *     w_k    = dx if 0 < k < K-1 else dx/2     (trapezoid)
 *     Z_A    = sum_k w_k * f_A(g_k)
 *     p_k    = w_k * f_A(g_k) / Z_A
 *     q_k    = w_k * f_B(g_k) / Z_B
 *
 * (Trapezoidal weights: end-points half. p and q are exact
 * pmfs on {g_0..g_K-1} with sum_k p_k = sum_k q_k = 1.)
 *
 * Jensen-Shannon divergence in BITS (log base 2; Lin 1991
 * IEEE Trans. Info. Theory 37(1):145-151):
 *
 *     m_k  = 0.5 * (p_k + q_k)
 *     D_KL(p||m) = sum_k p_k * log2( p_k / m_k )      (0*log0 := 0)
 *     D_KL(q||m) = sum_k q_k * log2( q_k / m_k )
 *     jsdBits   = 0.5 * (D_KL(p||m) + D_KL(q||m))
 *
 * jsdBits in [0, 1] -- bounded above by 1 in bits because
 * each KL term is bounded by log2(2) = 1 (Lin 1991 §II;
 * Endres & Schindelin 2003 IEEE Trans. Info. Theory 49(7):
 * 1858-1860, Theorem 1). 0 iff p === q on the grid.
 *
 * Jensen-Shannon DISTANCE (square root, true metric on the
 * probability simplex; Endres & Schindelin 2003, Theorem 2):
 *
 *     jsdDist = sqrt(jsdBits)
 *
 * jsdDist is a TRUE METRIC: symmetric, non-negative, zero
 * iff p === q, AND satisfies the triangle inequality on
 * the probability simplex. jsdDist in [0, 1].
 *
 * Per-grid-point divergence contribution:
 *
 *     jsdContribByBin[k] = 0.5 * ( p_k*log2(p_k/m_k)
 *                                + q_k*log2(q_k/m_k) )
 *     jsdMaxBin          = argmax_k jsdContribByBin[k]
 *     jsdMaxBinValue     = jsdContribByBin[jsdMaxBin]
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-125:
 *
 *   - Class. INFORMATION-THEORETIC SYMMETRIC DIVERGENCE on
 *     KERNEL-DENSITY-SMOOTHED probability mass functions.
 *     The metric lives in the BREGMAN/INFORMATION-GEOMETRIC
 *     space of distributions equipped with the Kullback-
 *     Leibler quasi-distance and symmetrised via the
 *     midpoint construction (Lin 1991).
 *
 *   - vs axis-118 KS (sup-norm CDF distance). KS lives in
 *     L_infinity of CDF space and is INSENSITIVE to small
 *     pointwise mass differences spread over many bins.
 *     JS is sensitive to the ENTIRE shape of the pmf and
 *     amplifies regions where one pmf is large and the
 *     other small (log-ratio amplification); a uniform
 *     pmf shift contributes to JS while leaving KS small.
 *
 *   - vs axis-119 AD (tail-weighted L^2 CDF distance).
 *     AD weights by 1/[F(1-F)] in CDF space; JS weights by
 *     log(p_k/m_k) in pmf space. AD blows up at extreme
 *     tails; JS bounded by 1 bit so behaves smoothly under
 *     extreme outliers (because log(p/m) <= log(2/m_min)
 *     but p_k itself goes to 0 in the tail).
 *
 *   - vs axis-120 CvM (unweighted L^2 CDF distance). CvM
 *     integrates squared CDF differences; JS integrates
 *     pmf log-ratios. CvM is QUADRATIC in pointwise CDF
 *     gaps; JS is LOGARITHMIC in pointwise pmf ratios.
 *
 *   - vs axis-121 W1 (transport cost in token units). W1
 *     is 1-homogeneous in the data and lives in
 *     QUANTILE-INTEGRAL space; JS is dimensionless and
 *     lives in PROBABILITY-MASS space. W1 cares about HOW
 *     FAR mass moved on the x-axis; JS cares about HOW
 *     DIFFERENT the densities look at fixed locations.
 *     A pure horizontal translation x -> x + c gives
 *     non-zero W1 = c but JS depends on the smoothed pmf
 *     overlap, not the location shift directly.
 *
 *   - vs axis-122 energy (1/t^2-weighted CF distance). Energy
 *     distance is a MOMENT-MATCHING test in characteristic-
 *     function space with a fixed 1/t^2 weight; JS is a
 *     LOG-LIKELIHOOD-RATIO-style test in real-domain pmf
 *     space. They are not monotone images of each other
 *     because energy is determined by the joint moments
 *     of x while JS uses the full smoothed density at every
 *     grid point.
 *
 *   - vs axis-123 MMD (Gaussian RKHS distance). MMD is a
 *     PAIRWISE KERNEL DISTANCE in an infinite-dimensional
 *     RKHS; JS is a POINTWISE LOG-RATIO INTEGRAL on a
 *     finite grid in pmf space. MMD with the Gaussian
 *     kernel responds to KERNEL-SMOOTHED expectations of
 *     the difference in distributions; JS responds to
 *     KERNEL-SMOOTHED pmf RATIOS. A pmf with the same
 *     RKHS-mean but a different shape (e.g. a 50-50 mixture
 *     of two delta-like spikes vs a uniform on the same
 *     support) gives small MMD and large JS.
 *
 *   - vs axis-124 qv-Mahalanobis (diagonal-Mahalanobis on
 *     9 quantiles). qv-Mahalanobis lives in R^9 quantile-
 *     coordinate space; JS lives in K=257 pmf-coordinate
 *     space. qv-Mahalanobis is a quadratic form in
 *     standardised quantile gaps; JS is an entropy-based
 *     functional of the smoothed densities.
 *
 *   - vs axis-125 PCA-projection (delay-embedded leading-PC
 *     gap). PCA-projection is COVARIANCE-AWARE through the
 *     delay-embedding lag structure (it depends on the
 *     joint distribution of (x[t], x[t+1], x[t+2])). JS is
 *     PERMUTATION-INVARIANT within each half: it depends
 *     only on the marginal pmf of x in each half. A
 *     time-permuted half preserves JS exactly but changes
 *     pcZ. Conversely, two halves with identical marginals
 *     but different temporal structure give jsdBits = 0
 *     while pcZ may be non-zero.
 *
 *   - vs spectral / autocorrelation axes (axes ~80-95).
 *     Those summarise the WHOLE series with permutation-
 *     SENSITIVE FFT/autocorrelation functionals; JS is
 *     permutation-invariant within halves and applied to
 *     two HALVES rather than the whole series.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the SYMMETRIC Jensen-Shannon divergence (in bits),
 *   how much information (in bits) separates the two
 *   half-densities, and which source has the largest
 *   metric-distance jsdDist = sqrt(jsdBits) on the
 *   probability simplex?"**
 *
 * References:
 *   Lin, J., "Divergence measures based on the Shannon
 *     entropy", IEEE Transactions on Information Theory
 *     37(1) (1991), pp. 145-151.
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
 *     FIXED for cross-source comparability (no CLI knob).
 *     Hard floor n >= 8 so that n1, n2 >= 4.
 *   - jsdBits === 0 iff p === q on the grid; this is the
 *     reference for "halves are indistinguishable after
 *     KDE smoothing".
 *   - jsdBits is in [0, 1] (bits, not nats); jsdDist =
 *     sqrt(jsdBits) is in [0, 1] and is the true metric.
 *   - Trapezoidal mass normalisation makes p, q exact pmfs
 *     to machine precision regardless of how spread the
 *     KDE puts mass outside the chosen support extension.
 *   - JS is INVARIANT under translation x -> x + c (the
 *     KDE shifts rigidly, the grid shifts rigidly, all
 *     pmf values are unchanged at the corresponding shifted
 *     grid point) AND under positive rescaling x -> k*x
 *     (k > 0; both data and bandwidth scale by k, dx scales
 *     by k, w_k * f scales by 1, so p_k and q_k unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-jensen-shannon-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-jensen-shannon-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by JS distance descending (worst overlap first):
 *   pew-insights daily-token-jensen-shannon-divergence-halves \
 *     --sort jsdDistDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenJensenShannonDivergenceHalvesSort =
  | 'jsdBits'
  | 'jsdBitsDesc'
  | 'jsdDist'
  | 'jsdDistDesc'
  | 'jsdMaxBinValue'
  | 'jsdMaxBinValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenJensenShannonDivergenceHalvesOptions {
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
  sort?: DailyTokenJensenShannonDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenJensenShannonDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half sample size n1 = floor(n/2). */
  jsdN1: number;
  /** Second-half sample size n2 = n - n1. */
  jsdN2: number;
  /** Pooled robust scale (1.4826 * MAD around pooled median). */
  jsdMadPool: number;
  /** Silverman bandwidth h = 0.9 * mad_pool * n^(-1/5). */
  jsdBandwidth: number;
  /** Grid lower bound g_lo = min(x) - 3*h. */
  jsdGridLo: number;
  /** Grid upper bound g_hi = max(x) + 3*h. */
  jsdGridHi: number;
  /** Grid spacing dx. */
  jsdGridDx: number;
  /** Grid size K (fixed = 257). */
  jsdGridK: number;
  /** Jensen-Shannon divergence in BITS (log base 2). */
  jsdBits: number;
  /** Jensen-Shannon DISTANCE = sqrt(jsdBits) (true metric). */
  jsdDist: number;
  /** Argmax bin index of the per-bin contribution. */
  jsdMaxBin: number;
  /** Grid value at jsdMaxBin (in token units). */
  jsdMaxBinX: number;
  /** Per-bin contribution at jsdMaxBin (in bits). */
  jsdMaxBinValue: number;
  /**
   * Asymmetry diagnostic |KL(p||m) - KL(q||m)| in bits.
   * Symmetry of JS implies jsdAsymmetry = 0 only in the
   * case p === q; in general it measures the imbalance
   * between the two KL summands. Bounded above by 1 bit.
   */
  jsdAsymmetry: number;
  /**
   * Signed direction sgn(KL(q||m) - KL(p||m)) in {-1, 0, +1}.
   * +1 means the second-half pmf is "more divergent from m"
   * than the first-half pmf (i.e. q has more low-mass bins
   * relative to m); -1 the converse. Sign-invariant under
   * translation and positive scaling.
   */
  jsdAsymmetryDir: number;
}

export interface DailyTokenJensenShannonDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenJensenShannonDivergenceHalvesSort;
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
  sources: DailyTokenJensenShannonDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size. */
export const JSD_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const JSD_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const JSD_GRID_EXTENSION_H = 3;

const LN2 = Math.log(2);
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
 * KDE-smoothed Jensen-Shannon divergence between halves of
 * a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - jsdBits(x + c) === jsdBits(x) for any constant c
 *     (translation-invariance: KDE, grid, and pmfs all
 *     shift rigidly).
 *   - jsdBits(k*x) === jsdBits(x) for any k > 0
 *     (positive scale-invariance: data, bandwidth, and grid
 *     spacing all scale by k; pmf entries unchanged).
 *   - jsdBits in [0, 1].
 *   - jsdDist === sqrt(jsdBits) and is in [0, 1].
 *   - jsdBits === 0 when both halves are identical samples.
 */
export function dailyTokenJensenShannonDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  jsdN1: number;
  jsdN2: number;
  jsdMadPool: number;
  jsdBandwidth: number;
  jsdGridLo: number;
  jsdGridHi: number;
  jsdGridDx: number;
  jsdGridK: number;
  jsdBits: number;
  jsdDist: number;
  jsdMaxBin: number;
  jsdMaxBinX: number;
  jsdMaxBinValue: number;
  jsdAsymmetry: number;
  jsdAsymmetryDir: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenJensenShannonDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenJensenShannonDivergenceHalves requires finite values',
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
      `dailyTokenJensenShannonDivergenceHalves: zero centred variance (n=${n})`,
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
  // to data range / n^(1/5) if mad is zero (still positive
  // because zero-variance is guarded above).
  let h = JSD_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = JSD_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
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
  const gLo = mn - JSD_GRID_EXTENSION_H * h;
  const gHi = mx + JSD_GRID_EXTENSION_H * h;
  const K = JSD_GRID_K;
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
      `dailyTokenJensenShannonDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }
  const p: number[] = new Array(K);
  const q: number[] = new Array(K);
  for (let k = 0; k < K; k += 1) {
    p[k] = (w[k]! * fA[k]!) / zA;
    q[k] = (w[k]! * fB[k]!) / zB;
  }

  // Jensen-Shannon divergence in bits.
  let kl1 = 0;
  let kl2 = 0;
  let maxBin = 0;
  let maxBinValue = -Infinity;
  for (let k = 0; k < K; k += 1) {
    const pk = p[k]!;
    const qk = q[k]!;
    const mk = 0.5 * (pk + qk);
    let t1 = 0;
    let t2 = 0;
    if (pk > 0 && mk > 0) t1 = pk * (Math.log(pk / mk) / LN2);
    if (qk > 0 && mk > 0) t2 = qk * (Math.log(qk / mk) / LN2);
    kl1 += t1;
    kl2 += t2;
    const contrib = 0.5 * (t1 + t2);
    if (contrib > maxBinValue) {
      maxBinValue = contrib;
      maxBin = k;
    }
  }
  let jsdBits = 0.5 * (kl1 + kl2);
  // Numerical clamp [0, 1].
  if (jsdBits < 0) jsdBits = 0;
  if (jsdBits > 1) jsdBits = 1;
  const jsdDist = Math.sqrt(jsdBits);
  const jsdMaxBinX = gLo + maxBin * dx;
  // Asymmetry diagnostic between the two KL summands.
  const jsdAsymmetry = Math.abs(kl1 - kl2);
  const klDelta = kl2 - kl1;
  const jsdAsymmetryDir = klDelta > 0 ? 1 : klDelta < 0 ? -1 : 0;

  if (
    !Number.isFinite(jsdBits) ||
    !Number.isFinite(jsdDist) ||
    !Number.isFinite(maxBinValue) ||
    !Number.isFinite(jsdAsymmetry)
  ) {
    throw new Error(
      `dailyTokenJensenShannonDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    jsdN1: n1,
    jsdN2: n2,
    jsdMadPool: madPool,
    jsdBandwidth: h,
    jsdGridLo: gLo,
    jsdGridHi: gHi,
    jsdGridDx: dx,
    jsdGridK: K,
    jsdBits,
    jsdDist,
    jsdMaxBin: maxBin,
    jsdMaxBinX,
    jsdMaxBinValue: maxBinValue,
    jsdAsymmetry,
    jsdAsymmetryDir,
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

export function buildDailyTokenJensenShannonDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenJensenShannonDivergenceHalvesOptions = {},
): DailyTokenJensenShannonDivergenceHalvesReport {
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
  const sort: DailyTokenJensenShannonDivergenceHalvesSort =
    opts.sort ?? 'jsdBitsDesc';
  const validSorts: DailyTokenJensenShannonDivergenceHalvesSort[] = [
    'jsdBits',
    'jsdBitsDesc',
    'jsdDist',
    'jsdDistDesc',
    'jsdMaxBinValue',
    'jsdMaxBinValueDesc',
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
  const rows: DailyTokenJensenShannonDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenJensenShannonDivergenceHalves(filled);
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
      jsdN1: result.jsdN1,
      jsdN2: result.jsdN2,
      jsdMadPool: result.jsdMadPool,
      jsdBandwidth: result.jsdBandwidth,
      jsdGridLo: result.jsdGridLo,
      jsdGridHi: result.jsdGridHi,
      jsdGridDx: result.jsdGridDx,
      jsdGridK: result.jsdGridK,
      jsdBits: result.jsdBits,
      jsdDist: result.jsdDist,
      jsdMaxBin: result.jsdMaxBin,
      jsdMaxBinX: result.jsdMaxBinX,
      jsdMaxBinValue: result.jsdMaxBinValue,
      jsdAsymmetry: result.jsdAsymmetry,
      jsdAsymmetryDir: result.jsdAsymmetryDir,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'jsdBits':
        primary = a.jsdBits - b.jsdBits;
        break;
      case 'jsdBitsDesc':
        primary = b.jsdBits - a.jsdBits;
        break;
      case 'jsdDist':
        primary = a.jsdDist - b.jsdDist;
        break;
      case 'jsdDistDesc':
        primary = b.jsdDist - a.jsdDist;
        break;
      case 'jsdMaxBinValue':
        primary = a.jsdMaxBinValue - b.jsdMaxBinValue;
        break;
      case 'jsdMaxBinValueDesc':
        primary = b.jsdMaxBinValue - a.jsdMaxBinValue;
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
    gridK: JSD_GRID_K,
    silvermanMultiplier: JSD_SILVERMAN_MULTIPLIER,
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
