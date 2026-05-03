/**
 * daily-token-jeffreys-divergence-halves: per-source
 * KDE-SMOOTHED JEFFREYS DIVERGENCE between the FIRST and
 * SECOND half of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-FIRST cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129/130
 * for direct comparability of bandwidth):
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
 * JEFFREYS DIVERGENCE (Jeffreys 1946, "An invariant form
 * for the prior probability in estimation problems",
 * Proc. R. Soc. A 186(1007): 453-461; Kullback & Leibler
 * 1951, "On information and sufficiency", Ann. Math.
 * Statist. 22(1): 79-86, eq. 2.4 -- the "symmetric
 * divergence" J):
 *
 *     J(p, q)  =  KL(p||q) + KL(q||p)
 *              =  sum_k ( p_k - q_k ) * ln( p_k / q_k )    in nats
 *
 * Equivalently the SYMMETRIC version of KL: J(p,q) = J(q,p)
 * by construction. J in [0, +inf); J = 0 iff p === q on
 * the grid; J -> +inf as supports become disjoint.
 *
 * We add a TINY MASS FLOOR to both pmfs before evaluating
 * the log-ratio integrand, p_k <- max(p_k, EPS_PMF) and
 * q_k <- max(q_k, EPS_PMF) with EPS_PMF = 1e-300, to keep
 * the per-bin contribution finite under near-zero KDE
 * tails (Gaussian KDE on the shared finite grid never
 * produces exact zeros, but underflow to subnormal mass
 * can drive the ln(.) factor to -inf in floating-point).
 * This is a NUMERICAL guard, not a smoothing: the floor is
 * far below any contribution that materially moves J.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-130:
 *
 *   - Class. The (p - q) * log(p/q) integral, i.e. the
 *     L^1-IN-PMF-DIFFERENCE WEIGHTED LOG-RATIO functional.
 *     This is the unique class of "linear-in-(p-q),
 *     log-in-ratio" functionals on pmfs and is not
 *     occupied by any prior axis. Equivalently the SUM of
 *     two opposite-direction KL divergences, putting it in
 *     the f-divergence class with f(t) = (t - 1) * ln(t).
 *
 *   - vs axis-118 KS / 119 AD / 120 CvM. CDF-based
 *     functionals (sup-norm, tail-weighted L^2, unweighted
 *     L^2 of CDF differences). J is a pmf functional and
 *     is INVARIANT under pmf permutation across bins.
 *
 *   - vs axis-121 W1 (Wasserstein-1). W1 is L^1 of CDF
 *     differences with token units; J is dimensionless and
 *     unbounded above with no notion of "ground distance"
 *     between bins.
 *
 *   - vs axis-122 energy / 123 MMD. CF-1/t^2 and RKHS
 *     embedding distances; both kernel-weighted; J is a
 *     finite-grid log-ratio integral with no kernel.
 *
 *   - vs axis-124 qv-Mahalanobis / 125 PCA-projection.
 *     Live in low-dimensional Euclidean spaces; J lives in
 *     the K=257 pmf simplex via a log-ratio integral.
 *
 *   - vs axis-126 JSD (KDE-smoothed Jensen-Shannon
 *     divergence in bits). Both LOG functionals on the
 *     IDENTICAL KDE setup, but JSD = 0.5*KL(p||m) + 0.5*KL(q||m)
 *     is the SHANNON-AVERAGED log-ratio against the
 *     MIXTURE m = (p+q)/2, while J = KL(p||q) + KL(q||p)
 *     is the SUM of TWO PAIRWISE log-ratios. JSD is
 *     ALWAYS BOUNDED above by ln(2) (in nats) -- J is
 *     UNBOUNDED. Lin (1991, "Divergence measures based on
 *     the Shannon entropy", IEEE Trans. Inf. Theory 37(1):
 *     145-151) gives JSD <= 0.25 * J (in nats) as the
 *     tightest one-direction bound, but J and JSD are NOT
 *     monotone images of each other and J amplifies
 *     near-zero pmf bins via ln(p/q) far more aggressively
 *     than JSD's mixture-bounded ln(p/m).
 *
 *   - vs axis-127 TV (KDE-smoothed Total-Variation distance,
 *     identical KDE setup). TV is L^1 in pmf coordinates;
 *     J is L^1-WEIGHTED LOG-RATIO. Pinsker (1964) and
 *     Kullback (1967) give 0.5 * tvDist^2 <= KL hence
 *     tvDist^2 <= 0.5 * J. Not a monotone transform: J
 *     diverges on disjoint supports while TV saturates at
 *     2.
 *
 *   - vs axis-128 H (KDE-smoothed Hellinger distance,
 *     identical KDE setup). H is L^2 in sqrt-amplitude
 *     coordinates; J is log-ratio. Topsoe (2000) gives
 *     2 * (1 - BC) <= J / 2 hence H^2 <= J / 4 with the
 *     equality LOOSE (J grows much faster). Not a monotone
 *     transform.
 *
 *   - vs axis-129 Delta (triangular discrimination, KDE,
 *     identical setup). Delta is weighted L^2 in
 *     reciprocal-sum coordinates and BOUNDED in [0, 2]; J
 *     is logarithmic and UNBOUNDED above. Topsoe (2000
 *     Theorem 3.2) gives Delta <= J / 2 with strict
 *     inequality away from p === q. Not a monotone
 *     transform.
 *
 *   - vs axis-130 bDist (Bhattacharyya distance, KDE,
 *     identical setup). bDist = -ln(BC) is the LOG of an
 *     INNER PRODUCT (sum_k sqrt(p*q)); J is the LINEAR
 *     functional of (p - q) WEIGHTED by log(p/q). bDist
 *     bounds J from below via 4*bDist <= J in the
 *     small-divergence regime (Cover & Thomas 2006,
 *     Sec. 11.6, with the substitution BC = 1 - H^2 and
 *     H^2 ~ J/4 small) but the two diverge sharply for
 *     large divergence: bDist is the Chernoff information
 *     at alpha=1/2, while J is a SUM of two FIRST-MOMENT
 *     log-ratios. Not a monotone transform.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; J is permutation-
 *     invariant within halves and applied to two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the JEFFREYS DIVERGENCE J = sum_k (p_k - q_k) * ln(p_k/q_k)
 *   (the SYMMETRIC SUM of the two pairwise KL divergences,
 *   i.e. KL(p||q) + KL(q||p) in nats), what is the
 *   FIRST-MOMENT-WEIGHTED LOG-RATIO DIVERGENCE between the
 *   two half-densities, and which source has the largest
 *   J?"**
 *
 * References:
 *   Jeffreys, H., "An invariant form for the prior
 *     probability in estimation problems", Proc. R. Soc. A
 *     186(1007): 453-461 (1946).
 *   Kullback, S. and Leibler, R. A., "On information and
 *     sufficiency", Ann. Math. Statist. 22(1): 79-86 (1951).
 *   Lin, J., "Divergence measures based on the Shannon
 *     entropy", IEEE Trans. Inf. Theory 37(1): 145-151 (1991).
 *   Topsoe, F., "Some inequalities for information divergence
 *     and related measures of discrimination", IEEE Trans.
 *     Inf. Theory 46(4): 1602-1609 (2000).
 *   Silverman, B. W., Density Estimation for Statistics and
 *     Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *   Cover, T. M. and Thomas, J. A., Elements of Information
 *     Theory, 2nd ed., Wiley (2006), Sec. 11.6.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes 126/127/128/129/130.
 *     Hard floor n >= 8 so that n1, n2 >= 4.
 *   - J === 0 iff p === q on the grid.
 *   - J is UNBOUNDED ABOVE; the diagnostic field
 *     jeffreysNormalized = J / (J + 1) maps J monotonically
 *     into [0, 1) for at-a-glance comparison with
 *     bDistNormalized (axis-130), deltaNormalized (axis-129),
 *     hDist (axis-128), tvDist (axis-127), JSD/log(2) (axis-126).
 *   - J is INVARIANT under translation x -> x + c AND
 *     under positive rescaling x -> k*x (k > 0; identical
 *     argument as for TV/JSD/H/Delta/bDist: data and
 *     bandwidth scale together, dx scales together, w_k * f
 *     scales by 1, p_k and q_k unchanged so the log-ratio
 *     integrand is unchanged hence J is unchanged).
 *   - Numerical floor: pmf entries clamped to >= EPS_PMF =
 *     1e-300 before the log-ratio to keep the per-bin
 *     contribution finite under subnormal-mass tails.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-jeffreys-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-jeffreys-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Jeffreys divergence ascending:
 *   pew-insights daily-token-jeffreys-divergence-halves \
 *     --sort jeffreys
 */
import type { QueueLine } from './types.js';

export type DailyTokenJeffreysDivergenceHalvesSort =
  | 'jeffreys'
  | 'jeffreysDesc'
  | 'klPQ'
  | 'klPQDesc'
  | 'klQP'
  | 'klQPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenJeffreysDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenJeffreysDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenJeffreysDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  jeffreysN1: number;
  jeffreysN2: number;
  jeffreysMadPool: number;
  jeffreysBandwidth: number;
  jeffreysGridLo: number;
  jeffreysGridHi: number;
  jeffreysGridDx: number;
  jeffreysGridK: number;
  /** KL(p||q) in nats, the FORWARD direction. */
  klPQ: number;
  /** KL(q||p) in nats, the REVERSE direction. */
  klQP: number;
  /** Jeffreys divergence J = KL(p||q) + KL(q||p) in nats, in [0, +inf). */
  jeffreys: number;
  /**
   * Asymmetry diagnostic: |KL(p||q) - KL(q||p)| / J in [0, 1].
   * 0 means perfectly symmetric per-bin contributions; 1 means one
   * direction dominates entirely. Defined as 0 when J === 0
   * (degenerate identity case). Permutation-invariant within halves.
   */
  jeffreysAsymmetry: number;
  /**
   * Symmetry-ratio diagnostic: min(klPQ, klQP) / max(klPQ, klQP) in
   * [0, 1]. The COMPLEMENTARY normalised form to jeffreysAsymmetry:
   * 1 = the two directional KLs are equal (purely symmetric f-divergence
   * decomposition); 0 = one direction is degenerate. Defined as 1 when
   * both klPQ and klQP are 0 (identity case is, by convention,
   * perfectly symmetric). Useful to flag sources whose symmetric-KL
   * mass is structurally one-sided versus balanced -- where
   * jeffreysAsymmetry surfaces the absolute imbalance of (forward -
   * reverse), this ratio surfaces the magnitude balance regardless of
   * J's overall scale, so two sources with very different J can be
   * directly compared on the SHAPE of their KL split.
   */
  klSymmetryRatio: number;
  /**
   * Normalised diagnostic: J / (J + 1) in [0, 1). Monotone-increasing
   * in J; puts J on the same [0, 1) scale as bDistNormalized
   * (axis-130), deltaNormalized (axis-129), hDist (axis-128), and
   * tvDist (axis-127) for at-a-glance cross-axis comparison.
   */
  jeffreysNormalized: number;
}

export interface DailyTokenJeffreysDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenJeffreysDivergenceHalvesSort;
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
  sources: DailyTokenJeffreysDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129/130). */
export const JEFFREYS_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126/127/128/129/130). */
export const JEFFREYS_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const JEFFREYS_GRID_EXTENSION_H = 3;
/** Numerical floor on per-bin pmf mass before the log-ratio. */
export const JEFFREYS_PMF_FLOOR = 1e-300;

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
 * KDE-smoothed Jeffreys divergence between halves of a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - jeffreys(x + c) === jeffreys(x) for any constant c (translation).
 *   - jeffreys(k*x) === jeffreys(x) for any k > 0 (positive scale).
 *   - jeffreys === klPQ + klQP (decomposition identity).
 *   - jeffreys >= 0; jeffreys === 0 iff halves identical after KDE
 *     smoothing.
 *   - klPQ >= 0; klQP >= 0 (Gibbs' inequality).
 *   - Symmetric: swapping the two halves preserves jeffreys (klPQ
 *     and klQP swap).
 *   - jeffreysNormalized = J / (J + 1) in [0, 1).
 *   - jeffreysAsymmetry = |klPQ - klQP| / J in [0, 1] (or 0 when J=0).
 */
export function dailyTokenJeffreysDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  jeffreysN1: number;
  jeffreysN2: number;
  jeffreysMadPool: number;
  jeffreysBandwidth: number;
  jeffreysGridLo: number;
  jeffreysGridHi: number;
  jeffreysGridDx: number;
  jeffreysGridK: number;
  klPQ: number;
  klQP: number;
  jeffreys: number;
  jeffreysAsymmetry: number;
  klSymmetryRatio: number;
  jeffreysNormalized: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenJeffreysDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenJeffreysDivergenceHalves requires finite values',
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
      `dailyTokenJeffreysDivergenceHalves: zero centred variance (n=${n})`,
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

  let h = JEFFREYS_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = JEFFREYS_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - JEFFREYS_GRID_EXTENSION_H * h;
  const gHi = mx + JEFFREYS_GRID_EXTENSION_H * h;
  const K = JEFFREYS_GRID_K;
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
      `dailyTokenJeffreysDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Build pmfs p, q with floor; accumulate KL(p||q), KL(q||p), J.
  let klPQ = 0;
  let klQP = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < JEFFREYS_PMF_FLOOR) pk = JEFFREYS_PMF_FLOOR;
    if (qk < JEFFREYS_PMF_FLOOR) qk = JEFFREYS_PMF_FLOOR;
    // KL(p||q) = sum p * log(p/q); KL(q||p) = sum q * log(q/p).
    // Both contribute >= 0 by Gibbs (in the limit; the floor keeps
    // each term finite).
    const lpq = Math.log(pk / qk);
    klPQ += pk * lpq;
    klQP += qk * (-lpq); // = qk * log(qk/pk)
  }
  // Numerical clamp: KL >= 0 by Gibbs; the floor can introduce
  // O(K * EPS_PMF * |log EPS_PMF|) ~ 1e-295 noise but never breaks
  // the bound materially. Snap tiny negatives to 0.
  if (klPQ < 0) klPQ = 0;
  if (klQP < 0) klQP = 0;
  const jeffreys = klPQ + klQP;

  const jeffreysNormalized = jeffreys / (jeffreys + 1);
  const jeffreysAsymmetry =
    jeffreys > 0 ? Math.abs(klPQ - klQP) / jeffreys : 0;
  const klMax = Math.max(klPQ, klQP);
  const klMin = Math.min(klPQ, klQP);
  // Identity case (both KLs = 0) is, by convention, perfectly symmetric
  // (ratio = 1). Otherwise return min/max in [0, 1].
  const klSymmetryRatio = klMax > 0 ? klMin / klMax : 1;

  if (
    !Number.isFinite(klPQ) ||
    !Number.isFinite(klQP) ||
    !Number.isFinite(jeffreys)
  ) {
    throw new Error(
      `dailyTokenJeffreysDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    jeffreysN1: n1,
    jeffreysN2: n2,
    jeffreysMadPool: madPool,
    jeffreysBandwidth: h,
    jeffreysGridLo: gLo,
    jeffreysGridHi: gHi,
    jeffreysGridDx: dx,
    jeffreysGridK: K,
    klPQ,
    klQP,
    jeffreys,
    jeffreysAsymmetry,
    klSymmetryRatio,
    jeffreysNormalized,
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

export function buildDailyTokenJeffreysDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenJeffreysDivergenceHalvesOptions = {},
): DailyTokenJeffreysDivergenceHalvesReport {
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
  const sort: DailyTokenJeffreysDivergenceHalvesSort =
    opts.sort ?? 'jeffreysDesc';
  const validSorts: DailyTokenJeffreysDivergenceHalvesSort[] = [
    'jeffreys',
    'jeffreysDesc',
    'klPQ',
    'klPQDesc',
    'klQP',
    'klQPDesc',
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
  const rows: DailyTokenJeffreysDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenJeffreysDivergenceHalves(filled);
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
      jeffreysN1: result.jeffreysN1,
      jeffreysN2: result.jeffreysN2,
      jeffreysMadPool: result.jeffreysMadPool,
      jeffreysBandwidth: result.jeffreysBandwidth,
      jeffreysGridLo: result.jeffreysGridLo,
      jeffreysGridHi: result.jeffreysGridHi,
      jeffreysGridDx: result.jeffreysGridDx,
      jeffreysGridK: result.jeffreysGridK,
      klPQ: result.klPQ,
      klQP: result.klQP,
      jeffreys: result.jeffreys,
      jeffreysAsymmetry: result.jeffreysAsymmetry,
      klSymmetryRatio: result.klSymmetryRatio,
      jeffreysNormalized: result.jeffreysNormalized,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'jeffreys':
        primary = a.jeffreys - b.jeffreys;
        break;
      case 'jeffreysDesc':
        primary = b.jeffreys - a.jeffreys;
        break;
      case 'klPQ':
        primary = a.klPQ - b.klPQ;
        break;
      case 'klPQDesc':
        primary = b.klPQ - a.klPQ;
        break;
      case 'klQP':
        primary = a.klQP - b.klQP;
        break;
      case 'klQPDesc':
        primary = b.klQP - a.klQP;
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
    gridK: JEFFREYS_GRID_K,
    silvermanMultiplier: JEFFREYS_SILVERMAN_MULTIPLIER,
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
