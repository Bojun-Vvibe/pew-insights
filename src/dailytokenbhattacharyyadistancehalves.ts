/**
 * daily-token-bhattacharyya-distance-halves: per-source
 * KDE-SMOOTHED BHATTACHARYYA DISTANCE between the FIRST
 * and SECOND half of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-THIRTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129 for
 * direct comparability of bandwidth):
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
 * BHATTACHARYYA COEFFICIENT (Bhattacharyya 1943, "On a
 * measure of divergence between two statistical populations
 * defined by their probability distributions", Bull. Calcutta
 * Math. Soc. 35: 99-109):
 *
 *     BC(p, q)  =  sum_k sqrt( p_k * q_k )
 *
 * BHATTACHARYYA DISTANCE (Kailath 1967, "The Divergence and
 * Bhattacharyya Distance Measures in Signal Selection", IEEE
 * Trans. Comm. Tech. 15(1): 52-60):
 *
 *     bDist(p, q)  =  -ln( BC(p, q) )    in [0, +inf)
 *
 * BC in [0, 1]; BC = 1 iff p === q on the grid; BC -> 0 iff
 * p, q have disjoint support on the grid. bDist = 0 iff
 * p === q; bDist -> +inf as supports become disjoint. We
 * clamp bDist via a numerical floor BC >= EPS = 1e-300 to
 * keep the statistic finite for the (unreachable on a
 * Gaussian KDE on a shared grid) disjoint-support limit.
 *
 * Note that bDist is NOT a metric: it fails the triangle
 * inequality. The closely related HELLINGER DISTANCE
 *
 *     H(p, q)  =  sqrt( 1 - BC(p, q) )
 *
 * IS a metric and was already shipped in axis-128. bDist
 * is a STRICTLY MONOTONE transform of BC, but bDist and H
 * are NOT monotone images of each other in general (they
 * become monotone in the small-H regime but the ranking
 * across SOURCES with very different BC can differ from H
 * because of the LOG transform's amplification near BC=0).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-129:
 *
 *   - Class. NEGATIVE LOG of the BHATTACHARYYA COEFFICIENT,
 *     i.e. the LOG-INTEGRAL of sqrt(p*q). This is the unique
 *     class of "log of a sqrt-amplitude inner product"
 *     functionals on pmfs and is not occupied by any prior
 *     axis. The LOG transformation makes bDist a CHERNOFF
 *     INFORMATION at alpha=1/2 (Chernoff 1952; Cover &
 *     Thomas 2006 Sec. 11.9), placing it in the
 *     LARGE-DEVIATIONS class of error exponents.
 *
 *   - vs axis-118 KS / 119 AD / 120 CvM. CDF-based
 *     functionals (sup-norm, tail-weighted L^2, unweighted
 *     L^2 of CDF differences). bDist is a pmf functional
 *     and is INVARIANT under pmf permutation across bins.
 *
 *   - vs axis-121 W1. W1 is L^1 of CDF differences with
 *     token units; bDist is dimensionless (and unbounded
 *     above).
 *
 *   - vs axis-122 energy / 123 MMD. CF-1/t^2 and RKHS
 *     embedding distances; both are infinite-dimensional
 *     and weighted by a kernel/CF; bDist is a finite-grid
 *     LOG of an inner product.
 *
 *   - vs axis-124 qv-Mahalanobis / 125 PCA-projection. Live
 *     in low-dimensional Euclidean spaces; bDist lives in
 *     the K=257 pmf simplex via -ln of an inner product.
 *
 *   - vs axis-126 JSD (KDE-smoothed Jensen-Shannon
 *     divergence in bits). Both are LOG functionals on the
 *     IDENTICAL KDE setup, but JSD = 0.5*KL(p||m) + 0.5*KL(q||m)
 *     is a SHANNON-WEIGHTED log-ratio integral while bDist
 *     is the LOG of a SQRT-AMPLITUDE INNER PRODUCT. JSD
 *     bounds bDist from above (JSD >= 0 and unrelated by
 *     monotone transform; in fact JSD relates to H via
 *     0.5*H^2 <= JSD <= H*sqrt(ln 4)). bDist and JSD are
 *     NOT monotone images of each other.
 *
 *   - vs axis-127 TV (KDE-smoothed Total-Variation distance,
 *     identical KDE setup). TV is L^1 in pmf coordinates;
 *     bDist is -ln of sqrt-amplitude inner product. The
 *     Pinsker-like inequality 1 - BC <= 0.5*TV gives
 *     BC >= 1 - 0.5*TV, hence bDist <= -ln(1 - 0.5*TV) only
 *     when TV < 2. Not a monotone transform.
 *
 *   - vs axis-128 H (KDE-smoothed Hellinger distance,
 *     identical KDE setup). H = sqrt(1 - BC) and bDist =
 *     -ln(BC) = -ln(1 - H^2). For small H, bDist ~ H^2,
 *     i.e. they are LOCALLY MONOTONE; for H -> 1 (BC -> 0),
 *     bDist -> +inf much faster than H. The CROSS-SOURCE
 *     ranking can differ when BC values are spread across
 *     ORDERS OF MAGNITUDE because the LOG amplifies
 *     near-zero coefficients: a source with BC = 0.01 has
 *     bDist = 4.605 while H = 0.995; another with BC = 0.5
 *     has bDist = 0.693 while H = 0.707. The bDist ratio
 *     is ~6.6x while the H ratio is only ~1.4x. This makes
 *     bDist a far more SENSITIVE detector of strong
 *     half-vs-half divergence.
 *
 *   - vs axis-129 Delta (triangular discrimination, KDE,
 *     identical setup). Delta is weighted L^2 in
 *     reciprocal-sum coordinates (algebraic, bounded in
 *     [0, 2]); bDist is -ln of sqrt-amplitude inner product
 *     (LOGARITHMIC, unbounded above). Topsoe inequalities
 *     pin Delta near 4*H^2 in the small-H regime; bDist
 *     pins near H^2. Hence in the small-H regime bDist ~
 *     Delta/4. Outside that regime (large H) the two
 *     diverge sharply: Delta saturates at 2 while bDist
 *     grows without bound.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; bDist is permutation-
 *     invariant within halves and applied to two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with the
 *   BHATTACHARYYA DISTANCE bDist = -ln(sum_k sqrt(p_k*q_k))
 *   (NEGATIVE LOG of the sqrt-amplitude inner product, i.e.
 *   the Chernoff information at alpha=1/2), what is the
 *   LOG-AMPLIFIED DIVERGENCE (in nats, in [0, +inf)) between
 *   the two half-densities, and which source has the largest
 *   bDist?"**
 *
 * References:
 *   Bhattacharyya, A., "On a measure of divergence between
 *     two statistical populations defined by their probability
 *     distributions", Bull. Calcutta Math. Soc. 35: 99-109 (1943).
 *   Chernoff, H., "A measure of asymptotic efficiency for
 *     tests of a hypothesis based on the sum of observations",
 *     Ann. Math. Statist. 23(4): 493-507 (1952).
 *   Kailath, T., "The Divergence and Bhattacharyya Distance
 *     Measures in Signal Selection", IEEE Trans. Comm. Tech.
 *     15(1): 52-60 (1967).
 *   Silverman, B. W., Density Estimation for Statistics and
 *     Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *   Cover, T. M. and Thomas, J. A., Elements of Information
 *     Theory, 2nd ed., Wiley (2006), Sec. 11.9.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes 126/127/128/129.
 *     Hard floor n >= 8 so that n1, n2 >= 4.
 *   - bDist === 0 iff BC === 1 iff p === q on the grid.
 *   - bDist is UNBOUNDED ABOVE; the diagnostic field
 *     bDistNormalized = 1 - exp(-bDist) = 1 - BC = H^2 maps
 *     bDist into [0, 1] for at-a-glance comparison with
 *     Delta/2 (axis-129), tvDist (axis-127), H (axis-128),
 *     and JSD/log(2) (axis-126).
 *   - bDist is INVARIANT under translation x -> x + c AND
 *     under positive rescaling x -> k*x (k > 0; identical
 *     argument as for TV/JSD/H/Delta: data and bandwidth
 *     scale together, dx scales together, w_k * f scales
 *     by 1, p_k and q_k unchanged so sum_k sqrt(p*q) is
 *     unchanged hence bDist is unchanged).
 *   - Numerical floor: BC clamped to [BC_FLOOR, 1] with
 *     BC_FLOOR = 1e-300 before -ln() to keep the statistic
 *     finite under disjoint-support pathologies.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-bhattacharyya-distance-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-bhattacharyya-distance-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Bhattacharyya distance ascending:
 *   pew-insights daily-token-bhattacharyya-distance-halves \
 *     --sort bDist
 */
import type { QueueLine } from './types.js';

export type DailyTokenBhattacharyyaDistanceHalvesSort =
  | 'bDist'
  | 'bDistDesc'
  | 'bcCoefficient'
  | 'bcCoefficientDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBhattacharyyaDistanceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBhattacharyyaDistanceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenBhattacharyyaDistanceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  bDistN1: number;
  bDistN2: number;
  bDistMadPool: number;
  bDistBandwidth: number;
  bDistGridLo: number;
  bDistGridHi: number;
  bDistGridDx: number;
  bDistGridK: number;
  /** Bhattacharyya coefficient BC = sum_k sqrt(p_k*q_k) in [0, 1]. */
  bcCoefficient: number;
  /** Bhattacharyya distance bDist = -ln(BC) in [0, +inf). */
  bDist: number;
  /**
   * Bhattacharyya angle bcAngle = arccos(BC) in [0, pi/2] radians
   * (Bhattacharyya 1943; Cha 2007 "Comprehensive Survey on
   * Distance/Similarity Measures between Probability Density
   * Functions"). UNLIKE bDist, bcAngle IS a true METRIC on the
   * probability simplex (the spherical/great-circle metric in
   * sqrt-amplitude coordinates). Diagnostic only -- mirrors the
   * hAngle field shipped on axis-128 for at-a-glance Riemannian
   * comparison. Translation- and positive-scale-invariant in
   * the data for the same reason as BC and bDist.
   */
  bcAngle: number;
  /**
   * Normalised diagnostic: 1 - exp(-bDist) = 1 - BC = H^2 in [0, 1].
   * Puts bDist on the same [0, 1] scale as hDist^2 (axis-128) and
   * deltaNormalized (axis-129) for at-a-glance cross-axis comparison.
   */
  bDistNormalized: number;
}

export interface DailyTokenBhattacharyyaDistanceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBhattacharyyaDistanceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  gridK: number;
  silvermanMultiplier: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenBhattacharyyaDistanceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129). */
export const BDIST_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126/127/128/129). */
export const BDIST_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const BDIST_GRID_EXTENSION_H = 3;
/** Numerical floor on the Bhattacharyya coefficient before -ln(). */
export const BDIST_BC_FLOOR = 1e-300;

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
 * KDE-smoothed Bhattacharyya distance between halves of a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - bDist(x + c) === bDist(x) for any constant c (translation).
 *   - bDist(k*x) === bDist(x) for any k > 0 (positive scale).
 *   - bDist >= 0; bDist === 0 iff BC === 1 iff halves identical
 *     after KDE smoothing.
 *   - bcCoefficient in [0, 1]; bcCoefficient === 1 iff halves match.
 *   - Symmetric: swapping the two halves preserves bDist.
 *   - bDistNormalized = 1 - exp(-bDist) = 1 - BC in [0, 1].
 */
export function dailyTokenBhattacharyyaDistanceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  bDistN1: number;
  bDistN2: number;
  bDistMadPool: number;
  bDistBandwidth: number;
  bDistGridLo: number;
  bDistGridHi: number;
  bDistGridDx: number;
  bDistGridK: number;
  bcCoefficient: number;
  bDist: number;
  bcAngle: number;
  bDistNormalized: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenBhattacharyyaDistanceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenBhattacharyyaDistanceHalves requires finite values',
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
      `dailyTokenBhattacharyyaDistanceHalves: zero centred variance (n=${n})`,
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

  let h = BDIST_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = BDIST_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - BDIST_GRID_EXTENSION_H * h;
  const gHi = mx + BDIST_GRID_EXTENSION_H * h;
  const K = BDIST_GRID_K;
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
      `dailyTokenBhattacharyyaDistanceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Bhattacharyya coefficient BC = sum_k sqrt(p_k * q_k).
  let bc = 0;
  for (let k = 0; k < K; k += 1) {
    const pk = (w[k]! * fA[k]!) / zA;
    const qk = (w[k]! * fB[k]!) / zB;
    if (pk > 0 && qk > 0) {
      bc += Math.sqrt(pk * qk);
    }
  }
  // Numerical clamp [0, 1].
  if (bc < 0) bc = 0;
  if (bc > 1) bc = 1;

  const bcSafe = bc < BDIST_BC_FLOOR ? BDIST_BC_FLOOR : bc;
  const bDist = -Math.log(bcSafe);
  // Clamp BC into [-1, 1] for arccos numerical safety (already in
  // [0, 1] from the clamp above; this guards against floating-point
  // 1 + 1e-16 type overshoots).
  const bcForArccos = bc > 1 ? 1 : bc < -1 ? -1 : bc;
  const bcAngle = Math.acos(bcForArccos);
  const bDistNormalized = 1 - bc;

  if (!Number.isFinite(bc) || !Number.isFinite(bDist)) {
    throw new Error(
      `dailyTokenBhattacharyyaDistanceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bDistN1: n1,
    bDistN2: n2,
    bDistMadPool: madPool,
    bDistBandwidth: h,
    bDistGridLo: gLo,
    bDistGridHi: gHi,
    bDistGridDx: dx,
    bDistGridK: K,
    bcCoefficient: bc,
    bDist,
    bcAngle,
    bDistNormalized,
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

export function buildDailyTokenBhattacharyyaDistanceHalves(
  queue: QueueLine[],
  opts: DailyTokenBhattacharyyaDistanceHalvesOptions = {},
): DailyTokenBhattacharyyaDistanceHalvesReport {
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
  const sort: DailyTokenBhattacharyyaDistanceHalvesSort =
    opts.sort ?? 'bDistDesc';
  const validSorts: DailyTokenBhattacharyyaDistanceHalvesSort[] = [
    'bDist',
    'bDistDesc',
    'bcCoefficient',
    'bcCoefficientDesc',
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
  const rows: DailyTokenBhattacharyyaDistanceHalvesSourceRow[] = [];

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
      result = dailyTokenBhattacharyyaDistanceHalves(filled);
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
      bDistN1: result.bDistN1,
      bDistN2: result.bDistN2,
      bDistMadPool: result.bDistMadPool,
      bDistBandwidth: result.bDistBandwidth,
      bDistGridLo: result.bDistGridLo,
      bDistGridHi: result.bDistGridHi,
      bDistGridDx: result.bDistGridDx,
      bDistGridK: result.bDistGridK,
      bcCoefficient: result.bcCoefficient,
      bDist: result.bDist,
      bcAngle: result.bcAngle,
      bDistNormalized: result.bDistNormalized,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bDist':
        primary = a.bDist - b.bDist;
        break;
      case 'bDistDesc':
        primary = b.bDist - a.bDist;
        break;
      case 'bcCoefficient':
        primary = a.bcCoefficient - b.bcCoefficient;
        break;
      case 'bcCoefficientDesc':
        primary = b.bcCoefficient - a.bcCoefficient;
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
    gridK: BDIST_GRID_K,
    silvermanMultiplier: BDIST_SILVERMAN_MULTIPLIER,
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
