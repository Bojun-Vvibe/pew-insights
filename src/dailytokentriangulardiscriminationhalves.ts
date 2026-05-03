/**
 * daily-token-triangular-discrimination-halves: per-source
 * KDE-SMOOTHED TRIANGULAR DISCRIMINATION (Le Cam distance
 * squared, also known as the Topsoe distance squared) between
 * the FIRST and SECOND half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-TWENTY-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128 for direct
 * comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h is Silverman's rule of thumb on the POOLED
 * sample with the robust scale (Silverman 1986, eq. 3.31):
 *
 *     h = 0.9 * mad_pool * n^(-1/5)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side
 * (Wand & Jones 1995, §2.7):
 *
 *     g_lo = min(x) - 3*h
 *     g_hi = max(x) + 3*h
 *     dx   = (g_hi - g_lo) / (K - 1)
 *
 * Gaussian KDE per half on the shared grid; trapezoidal
 * mass-normalisation to exact pmfs p, q on {g_0..g_{K-1}}
 * (sum_k p_k = sum_k q_k = 1).
 *
 * TRIANGULAR DISCRIMINATION between the discrete pmfs (Le Cam
 * 1986, Asymptotic Methods in Statistical Decision Theory,
 * §16.4; Topsoe 2000, "Some inequalities for information
 * divergence and related measures of discrimination", IEEE
 * Trans. Info. Theory, 46(4): 1602-1609; Vajda 2009, "On
 * metric divergences of probability measures", Kybernetika
 * 45(6): 885-900):
 *
 *     Delta(p, q) = sum_k ( p_k - q_k )^2 / ( p_k + q_k )
 *
 * with the convention 0^2 / 0 := 0 for the bins where both
 * p_k and q_k vanish (this only occurs in the strictly
 * disjoint-support limit which is unreachable on a Gaussian
 * KDE evaluated on a shared finite grid; the implementation
 * still applies the safeguard mask).
 *
 * Bounds. Delta(p, q) in [0, 2]. Delta = 0 iff p === q on
 * the grid; Delta = 2 iff p, q have disjoint support on the
 * grid. The square root sqrt(Delta(p, q)) is a TRUE METRIC
 * on the probability simplex (Le Cam 1986; Topsoe 2000
 * Theorem 4.2; Vajda 2009 Eq. 17). The non-squared form
 * Delta itself is NOT a metric (it fails the triangle
 * inequality; it is a squared-metric).
 *
 * Per-grid-point Delta contribution:
 *
 *     deltaContribByBin[k] = (p_k - q_k)^2 / (p_k + q_k)
 *     deltaMaxBin          = argmax_k deltaContribByBin[k]
 *     deltaMaxBinValue     = deltaContribByBin[deltaMaxBin]
 *
 * (Per-bin Delta contribution is bounded by p_k + q_k since
 * (p - q)^2 <= (p + q)^2 implies (p - q)^2 / (p + q) <= p + q
 * <= 2*max_k(p_k + q_k); a safer per-bin cap is just 2 since
 * max_k(p_k + q_k) <= 2 for pmfs.)
 *
 * Topsoe-Vajda relation to Hellinger and TV (Topsoe 2000
 * Lemma 2; Vajda 2009 Eq. 13):
 *
 *     4 * H(p, q)^2 <= Delta(p, q) <= 4 * H(p, q)^2 / (1 - H^2)
 *     Delta(p, q)   <= 2 * tvDist(p, q)
 *     Delta(p, q)   >= tvDist(p, q)^2     (consequence of
 *                                          Cauchy-Schwarz on
 *                                          the (p_k - q_k)^2
 *                                          / (p_k + q_k) form)
 *
 * In particular Delta is BOUNDED ABOVE BY twice the TV
 * (axis-127) and BELOW BY four times Hellinger-squared
 * (axis-128). It SANDWICHES NEITHER but the inequalities
 * make Delta non-monotonically related to both: the
 * cross-source ranking can differ from H, TV, and JSD.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-128:
 *
 *   - Class. WEIGHTED L^2 distance between pmfs in
 *     RECIPROCAL-SUM coordinates: each squared difference
 *     (p_k - q_k)^2 is divided by the LOCAL pmf total
 *     (p_k + q_k). This is structurally distinct from every
 *     prior axis. The denominator p_k + q_k makes the
 *     functional CONVEX in (p, q) and gives bins where BOTH
 *     halves have substantial mass MORE weight per absolute
 *     disagreement than bins where only one half has mass.
 *
 *   - vs axis-118 KS / 119 AD / 120 CvM. CDF-based
 *     functionals (sup-norm, tail-weighted L^2, unweighted
 *     L^2 of CDF differences). Delta is a pmf functional in
 *     reciprocal-sum coordinates and is INVARIANT under pmf
 *     permutation across bins.
 *
 *   - vs axis-121 W1. W1 is L^1 of CDF differences with
 *     token units; Delta is dimensionless and lives in the
 *     probability simplex.
 *
 *   - vs axis-122 energy / 123 MMD. CF-1/t^2 and RKHS
 *     embedding distances; both are infinite-dimensional and
 *     weighted by a kernel/CF; Delta is a finite-grid
 *     L^2 distance in reciprocal-sum coordinates.
 *
 *   - vs axis-124 qv-Mahalanobis / 125 PCA-projection. Live
 *     in low-dimensional (R^9 / R^d) Euclidean spaces; Delta
 *     lives in the K=257 pmf simplex.
 *
 *   - vs axis-126 JSD (KDE-smoothed Jensen-Shannon
 *     divergence in bits). Both share the IDENTICAL KDE
 *     setup (h, K, grid, trapezoidal weights). JSD weights
 *     each bin by log(p/m): a 0.001-vs-0.0001 disagreement
 *     produces a ~3.32-bit log-ratio jolt. Delta weights by
 *     1/(p_k + q_k): the same 0.001 vs 0.0001 contributes
 *     (0.001 - 0.0001)^2 / 0.0011 = ~7.4e-4. So Delta is
 *     sensitive to the BULK of mass disagreement weighted by
 *     a HARMONIC-LIKE DENOMINATOR, not log-ratio extremes.
 *     Crucially: Delta and JSD are NOT monotone images of
 *     each other.
 *
 *   - vs axis-127 TV (KDE-smoothed Total-Variation distance,
 *     identical KDE setup). TV is L^1 in pmf coordinates,
 *     Delta is weighted L^2 in (p_k - q_k)^2 / (p_k + q_k)
 *     coordinates. The Topsoe inequality Delta <= 2*tvDist
 *     gives an UPPER bound but does not make Delta a
 *     monotone image of TV (it can saturate or stay slack
 *     depending on the per-bin distribution of mass).
 *
 *   - vs axis-128 H (KDE-smoothed Hellinger distance,
 *     identical KDE setup). H is L^2 in SQRT-AMPLITUDE
 *     coordinates of pmfs; Delta is weighted L^2 in
 *     RECIPROCAL-SUM coordinates of pmfs. The Topsoe
 *     inequality 4*H^2 <= Delta <= 4*H^2/(1 - H^2) pins
 *     Delta around 4*H^2 in the SMALL-H regime but lets
 *     them diverge for large H.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; Delta is permutation-
 *     invariant within halves and applied to two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with the
 *   TRIANGULAR DISCRIMINATION (squared Le Cam distance,
 *   weighted L^2 in reciprocal-sum coordinates), how much
 *   RECIPROCAL-SUM-WEIGHTED DISAGREEMENT (in [0, 2]) separates
 *   the two half-densities, and which source has the largest
 *   Delta?"**
 *
 * References:
 *   Le Cam, L., Asymptotic Methods in Statistical Decision
 *     Theory, Springer (1986), §16.4.
 *   Silverman, B. W., Density Estimation for Statistics
 *     and Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *   Topsoe, F., "Some inequalities for information divergence
 *     and related measures of discrimination", IEEE Trans.
 *     Info. Theory, 46(4): 1602-1609 (2000).
 *   Vajda, I., "On metric divergences of probability
 *     measures", Kybernetika 45(6): 885-900 (2009).
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes 126/127/128.
 *     Hard floor n >= 8 so that n1, n2 >= 4.
 *   - delta === 0 iff p === q on the grid; this is the
 *     reference for "halves are indistinguishable after
 *     KDE smoothing under the reciprocal-sum L^2 norm".
 *   - delta is in [0, 2] and sqrt(delta) is the true Le Cam
 *     metric on the probability simplex.
 *   - Trapezoidal mass normalisation makes p, q exact pmfs
 *     to machine precision regardless of how spread the
 *     KDE puts mass outside the chosen support extension.
 *   - Delta is INVARIANT under translation x -> x + c AND
 *     under positive rescaling x -> k*x (k > 0; identical
 *     argument as for TV/JSD/H: data and bandwidth scale
 *     together, dx scales together, w_k * f scales by 1,
 *     p_k and q_k unchanged so the bin contribution
 *     (p_k - q_k)^2 / (p_k + q_k) is unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-triangular-discrimination-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-triangular-discrimination-halves \
 *     --source vscode-other --json
 *
 *   # Sort by triangular discrimination ascending:
 *   pew-insights daily-token-triangular-discrimination-halves \
 *     --sort delta
 */
import type { QueueLine } from './types.js';

export type DailyTokenTriangularDiscriminationHalvesSort =
  | 'delta'
  | 'deltaDesc'
  | 'deltaMaxBinValue'
  | 'deltaMaxBinValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTriangularDiscriminationHalvesOptions {
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
  sort?: DailyTokenTriangularDiscriminationHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenTriangularDiscriminationHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half sample size n1 = floor(n/2). */
  deltaN1: number;
  /** Second-half sample size n2 = n - n1. */
  deltaN2: number;
  /** Pooled robust scale (1.4826 * MAD around pooled median). */
  deltaMadPool: number;
  /** Silverman bandwidth h = 0.9 * mad_pool * n^(-1/5). */
  deltaBandwidth: number;
  /** Grid lower bound g_lo = min(x) - 3*h. */
  deltaGridLo: number;
  /** Grid upper bound g_hi = max(x) + 3*h. */
  deltaGridHi: number;
  /** Grid spacing dx. */
  deltaGridDx: number;
  /** Grid size K (fixed = 257). */
  deltaGridK: number;
  /** Triangular discrimination = sum_k (p_k - q_k)^2 / (p_k + q_k), in [0, 2]. */
  delta: number;
  /** Le Cam metric distance = sqrt(delta), in [0, sqrt(2)]. */
  deltaMetric: number;
  /** Argmax bin index of the per-bin Delta contribution. */
  deltaMaxBin: number;
  /** Grid value at deltaMaxBin (in token units). */
  deltaMaxBinX: number;
  /** Per-bin contribution (p_k - q_k)^2 / (p_k + q_k) at deltaMaxBin. */
  deltaMaxBinValue: number;
}

export interface DailyTokenTriangularDiscriminationHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTriangularDiscriminationHalvesSort;
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
  sources: DailyTokenTriangularDiscriminationHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128 for direct comparability). */
export const DELTA_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126/127/128). */
export const DELTA_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side (matches axes 126/127/128). */
export const DELTA_GRID_EXTENSION_H = 3;

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
 * KDE-smoothed Triangular Discrimination between halves of a
 * real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - delta(x + c) === delta(x) for any constant c
 *     (translation-invariance: KDE, grid, and pmfs all
 *     shift rigidly).
 *   - delta(k*x) === delta(x) for any k > 0
 *     (positive scale-invariance: data, bandwidth, and grid
 *     spacing all scale by k; pmf entries unchanged).
 *   - delta in [0, 2].
 *   - delta === 0 when both halves are identical samples.
 *   - Symmetric: swapping the two halves preserves delta
 *     exactly (since (p - q)^2 === (q - p)^2 and (p + q) === (q + p)).
 *   - sqrt(delta) is a true metric on the probability simplex.
 */
export function dailyTokenTriangularDiscriminationHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  deltaN1: number;
  deltaN2: number;
  deltaMadPool: number;
  deltaBandwidth: number;
  deltaGridLo: number;
  deltaGridHi: number;
  deltaGridDx: number;
  deltaGridK: number;
  delta: number;
  deltaMetric: number;
  deltaMaxBin: number;
  deltaMaxBinX: number;
  deltaMaxBinValue: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenTriangularDiscriminationHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenTriangularDiscriminationHalves requires finite values',
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
      `dailyTokenTriangularDiscriminationHalves: zero centred variance (n=${n})`,
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
  // to data range / n^(1/5) if mad is zero.
  let h = DELTA_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = DELTA_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
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
  const gLo = mn - DELTA_GRID_EXTENSION_H * h;
  const gHi = mx + DELTA_GRID_EXTENSION_H * h;
  const K = DELTA_GRID_K;
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
      `dailyTokenTriangularDiscriminationHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Triangular discrimination: Delta = sum_k (p - q)^2 / (p + q).
  // Use 0/0 -> 0 safeguard for any bin where both vanish (cannot
  // arise on a Gaussian KDE on a shared finite grid, but kept for
  // numerical safety).
  let dSum = 0;
  let maxBin = 0;
  let maxBinValue = -Infinity;
  for (let k = 0; k < K; k += 1) {
    const pk = (w[k]! * fA[k]!) / zA;
    const qk = (w[k]! * fB[k]!) / zB;
    const sumPq = pk + qk;
    let contrib = 0;
    if (sumPq > 0) {
      const diff = pk - qk;
      contrib = (diff * diff) / sumPq;
    }
    dSum += contrib;
    if (contrib > maxBinValue) {
      maxBinValue = contrib;
      maxBin = k;
    }
  }
  // Numerical clamp [0, 2] before sqrt.
  if (dSum < 0) dSum = 0;
  if (dSum > 2) dSum = 2;
  const deltaMetric = Math.sqrt(dSum);
  const deltaMaxBinX = gLo + maxBin * dx;

  if (
    !Number.isFinite(dSum) ||
    !Number.isFinite(maxBinValue) ||
    !Number.isFinite(deltaMetric)
  ) {
    throw new Error(
      `dailyTokenTriangularDiscriminationHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    deltaN1: n1,
    deltaN2: n2,
    deltaMadPool: madPool,
    deltaBandwidth: h,
    deltaGridLo: gLo,
    deltaGridHi: gHi,
    deltaGridDx: dx,
    deltaGridK: K,
    delta: dSum,
    deltaMetric,
    deltaMaxBin: maxBin,
    deltaMaxBinX,
    deltaMaxBinValue: maxBinValue,
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

export function buildDailyTokenTriangularDiscriminationHalves(
  queue: QueueLine[],
  opts: DailyTokenTriangularDiscriminationHalvesOptions = {},
): DailyTokenTriangularDiscriminationHalvesReport {
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
  const sort: DailyTokenTriangularDiscriminationHalvesSort =
    opts.sort ?? 'deltaDesc';
  const validSorts: DailyTokenTriangularDiscriminationHalvesSort[] = [
    'delta',
    'deltaDesc',
    'deltaMaxBinValue',
    'deltaMaxBinValueDesc',
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
  const rows: DailyTokenTriangularDiscriminationHalvesSourceRow[] = [];

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
      result = dailyTokenTriangularDiscriminationHalves(filled);
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
      deltaN1: result.deltaN1,
      deltaN2: result.deltaN2,
      deltaMadPool: result.deltaMadPool,
      deltaBandwidth: result.deltaBandwidth,
      deltaGridLo: result.deltaGridLo,
      deltaGridHi: result.deltaGridHi,
      deltaGridDx: result.deltaGridDx,
      deltaGridK: result.deltaGridK,
      delta: result.delta,
      deltaMetric: result.deltaMetric,
      deltaMaxBin: result.deltaMaxBin,
      deltaMaxBinX: result.deltaMaxBinX,
      deltaMaxBinValue: result.deltaMaxBinValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'delta':
        primary = a.delta - b.delta;
        break;
      case 'deltaDesc':
        primary = b.delta - a.delta;
        break;
      case 'deltaMaxBinValue':
        primary = a.deltaMaxBinValue - b.deltaMaxBinValue;
        break;
      case 'deltaMaxBinValueDesc':
        primary = b.deltaMaxBinValue - a.deltaMaxBinValue;
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
    gridK: DELTA_GRID_K,
    silvermanMultiplier: DELTA_SILVERMAN_MULTIPLIER,
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
