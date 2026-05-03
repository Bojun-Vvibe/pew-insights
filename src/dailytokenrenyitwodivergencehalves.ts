/**
 * daily-token-renyi-two-divergence-halves: per-source
 * KDE-SMOOTHED SYMMETRISED RENYI-2 DIVERGENCE between
 * the FIRST and SECOND half of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-SECOND cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129/130/131
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
 * RENYI-2 DIVERGENCE (Renyi 1961, "On measures of
 * entropy and information", Proc. 4th Berkeley Symp. on
 * Math. Stat. and Prob. 1: 547-561, eq. (3.5) at order
 * alpha = 2; van Erven & Harremos 2014, "Renyi divergence
 * and Kullback-Leibler divergence", IEEE Trans. Inf.
 * Theory 60(7): 3797-3820, Sec. III). The Renyi
 * divergence at order alpha = 2 is the FORWARD direction
 *
 *     D_2(p || q)  =  ln( sum_k p_k^2 / q_k )    in nats
 *
 * The IDENTITY D_2(p || q) = ln( 1 + chi^2(p || q) ) holds
 * with chi^2 the Pearson chi-squared divergence sum_k
 * (p_k - q_k)^2 / q_k (van Erven & Harremos 2014, eq. (8)).
 *
 * Renyi-2 is INHERENTLY ASYMMETRIC. We expose both
 * directions and the SYMMETRISED form
 *
 *     D_2^sym(p, q)  =  0.5 * ( D_2(p || q) + D_2(q || p) )
 *                    =  0.5 * ( ln(sum p^2/q) + ln(sum q^2/p) )
 *                    =  0.5 * ln( (sum p^2/q) * (sum q^2/p) )
 *
 * D_2^sym in [0, +inf). D_2^sym = 0 iff p === q on the
 * grid; D_2^sym -> +inf as p, q approach disjoint support
 * (each direction's chi-squared blows up and so does its
 * log).
 *
 * We add a TINY MASS FLOOR to each pmf entry before
 * forming p_k^2 / q_k and q_k^2 / p_k, max(p_k, EPS_PMF)
 * and max(q_k, EPS_PMF) with EPS_PMF = 1e-300, to keep
 * the per-bin contribution finite under near-zero KDE
 * tails (Gaussian KDE on the shared finite grid never
 * produces exact zeros, but underflow to subnormal mass
 * can drive the ratio to +inf in floating-point). This
 * is a NUMERICAL guard, not a smoothing: the floor is
 * far below any contribution that materially moves
 * D_2^sym.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-131:
 *
 *   - Class. The LOG-OF-RATIO-MOMENT-INTEGRAL functional,
 *     i.e. log(sum p^2/q). The forward direction is the
 *     f-divergence with f(t) = t^2 - 1, then log-
 *     transformed; the symmetrisation averages two such
 *     log-transformed chi-squared moments. This class is
 *     not occupied by any prior axis (axis-126 JSD is
 *     log-of-mixture; axis-127 TV is L^1; axis-128 H is
 *     L^2-of-sqrt-amplitude; axis-129 Delta is
 *     reciprocal-sum-weighted L^2; axis-130 bDist is
 *     log-of-inner-product of sqrt; axis-131 J is
 *     linear-(p-q)-weighted log-ratio).
 *
 *   - vs axis-118 KS / 119 AD / 120 CvM. CDF-based
 *     functionals (sup-norm, tail-weighted L^2, unweighted
 *     L^2 of CDF differences). D_2^sym is a pmf functional
 *     and is INVARIANT under pmf permutation across bins.
 *
 *   - vs axis-121 W1 (Wasserstein-1). W1 is L^1 of CDF
 *     differences with token units; D_2^sym is
 *     dimensionless and unbounded above with no notion of
 *     "ground distance" between bins.
 *
 *   - vs axis-122 energy / 123 MMD. CF-1/t^2 and RKHS
 *     embedding distances; both kernel-weighted; D_2^sym
 *     is a finite-grid log-of-chi-squared-moment integral.
 *
 *   - vs axis-124 qv-Mahalanobis / 125 PCA-projection.
 *     Live in low-dimensional Euclidean spaces; D_2^sym
 *     lives in the K=257 pmf simplex via a log-of-moment.
 *
 *   - vs axis-126 JSD. JSD = 0.5*KL(p||m) + 0.5*KL(q||m)
 *     uses the MIXTURE m = (p+q)/2 inside the log; D_2^sym
 *     uses the FORWARD pmfs themselves inside a SQUARED-
 *     MASS-OVER-MASS ratio inside the log. JSD is BOUNDED
 *     by ln 2 in nats; D_2^sym is UNBOUNDED. The Renyi
 *     divergences are MONOTONE-NONDECREASING in alpha
 *     (van Erven & Harremos 2014 Theorem 3): D_2 >=
 *     D_1 = KL >= D_{1/2}, but D_2^sym (symmetrised) is
 *     NOT a monotone image of JSD = 0.5*(D_1(p||m) +
 *     D_1(q||m)) since the log-mixture mass m breaks the
 *     ordering.
 *
 *   - vs axis-127 TV. TV is L^1 in pmf coordinates;
 *     D_2^sym is log-of-quadratic-moment. Pinsker (1964):
 *     tvDist^2 <= 0.5 * KL <= 0.5 * D_2 (Renyi monotone),
 *     so tvDist <= sqrt(D_2^sym) -- bound, not monotone
 *     (D_2^sym diverges on disjoint supports while TV
 *     saturates at 2).
 *
 *   - vs axis-128 H (Hellinger). H is L^2 in
 *     SQRT-AMPLITUDE coordinates; D_2^sym is log of
 *     SQUARED-MASS-OVER-MASS. The Renyi-1/2 divergence
 *     equals -2*ln(BC) = 2*bDist (axis-130) and is
 *     MONOTONE in H, but D_2^sym is NOT (Renyi alphas at
 *     1/2 vs 2 are on opposite sides of the KL).
 *
 *   - vs axis-129 Delta (triangular discrimination). Delta
 *     = sum (p-q)^2 / (p+q) is bounded in [0, 2] and
 *     algebraic; D_2^sym is logarithmic and unbounded
 *     above. The two are related only via the chain
 *     Delta <= 2*KL <= 2*D_2 -- bound, not monotone.
 *
 *   - vs axis-130 bDist (Bhattacharyya). bDist = -ln(BC)
 *     is the Renyi-1/2 divergence DIVIDED BY 2 (van Erven
 *     & Harremos 2014 eq. (5)): D_{1/2}(p||q) = -2*ln(BC)
 *     = 2*bDist. So bDist is the SYMMETRIC Renyi divergence
 *     at alpha = 1/2 (it IS symmetric since BC is symmetric);
 *     D_2^sym is the symmetrised Renyi at alpha = 2. Renyi
 *     monotonicity in alpha (van Erven & Harremos 2014
 *     Theorem 3) gives D_{1/2} <= KL <= D_2 in EACH
 *     DIRECTION, but symmetrised forms BREAK the per-pair
 *     monotonicity bound, so 2*bDist <= D_2^sym is a
 *     LOOSE bound that is NOT monotone in general. The
 *     two probe DIFFERENT corners of the Renyi alpha-line.
 *
 *   - vs axis-131 J (Jeffreys). J = KL(p||q) + KL(q||p)
 *     sums two FIRST-MOMENT log-ratios; D_2^sym averages
 *     two SECOND-MOMENT log-ratios. The Renyi alpha-line
 *     monotonicity gives KL(p||q) <= D_2(p||q) per
 *     direction (van Erven & Harremos 2014 Theorem 3),
 *     hence J <= 2 * D_2^sym -- bound, not monotone.
 *
 *   - vs spectral / autocorrelation axes. Those summarise
 *     the WHOLE series with permutation-SENSITIVE
 *     FFT/autocorrelation functionals; D_2^sym is
 *     permutation-invariant within halves and applied to
 *     two HALVES.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the SYMMETRISED RENYI-2 DIVERGENCE D_2^sym = 0.5 *
 *   (ln(sum p^2/q) + ln(sum q^2/p)) (the f-divergence at
 *   Renyi alpha = 2, log-transformed and symmetrised), what
 *   is the LOG-CHI-SQUARED-MOMENT divergence between the
 *   two half-densities, and which source has the largest
 *   D_2^sym?"**
 *
 * References:
 *   Renyi, A., "On measures of entropy and information",
 *     Proc. 4th Berkeley Symp. on Math. Stat. and Prob.
 *     1: 547-561 (1961), eq. (3.5).
 *   van Erven, T. and Harremos, P., "Renyi divergence
 *     and Kullback-Leibler divergence", IEEE Trans. Inf.
 *     Theory 60(7): 3797-3820 (2014), Sec. III, eqs.
 *     (5), (8) and Theorem 3.
 *   Silverman, B. W., Density Estimation for Statistics and
 *     Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes 126-131.
 *     Hard floor n >= 8 so that n1, n2 >= 4.
 *   - D_2^sym === 0 iff p === q on the grid.
 *   - D_2^sym is UNBOUNDED ABOVE; the diagnostic field
 *     renyiTwoNormalized = D_2^sym / (D_2^sym + 1) maps
 *     it monotonically into [0, 1) for at-a-glance
 *     comparison with bDistNormalized (axis-130),
 *     deltaNormalized (axis-129), tvDist (axis-127),
 *     jeffreysNormalized (axis-131).
 *   - D_2^sym is INVARIANT under translation x -> x + c
 *     AND under positive rescaling x -> k*x (k > 0;
 *     identical argument as for TV/JSD/H/Delta/bDist/J:
 *     data and bandwidth scale together, dx scales
 *     together, w_k * f scales by 1, p_k and q_k unchanged
 *     so the integrand sum p^2/q is unchanged, hence
 *     D_2^sym is unchanged).
 *   - Numerical floor: pmf entries clamped to >= EPS_PMF =
 *     1e-300 before forming the ratio.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-renyi-two-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-renyi-two-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Renyi-2 forward direction ascending:
 *   pew-insights daily-token-renyi-two-divergence-halves \
 *     --sort renyiTwoForward
 */
import type { QueueLine } from './types.js';

export type DailyTokenRenyiTwoDivergenceHalvesSort =
  | 'renyiTwoSym'
  | 'renyiTwoSymDesc'
  | 'renyiTwoForward'
  | 'renyiTwoForwardDesc'
  | 'renyiTwoReverse'
  | 'renyiTwoReverseDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenRenyiTwoDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenRenyiTwoDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenRenyiTwoDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  renyiTwoN1: number;
  renyiTwoN2: number;
  renyiTwoMadPool: number;
  renyiTwoBandwidth: number;
  renyiTwoGridLo: number;
  renyiTwoGridHi: number;
  renyiTwoGridDx: number;
  renyiTwoGridK: number;
  /** Forward Renyi-2 divergence D_2(p||q) = ln(sum p^2/q), in nats. */
  renyiTwoForward: number;
  /** Reverse Renyi-2 divergence D_2(q||p) = ln(sum q^2/p), in nats. */
  renyiTwoReverse: number;
  /** Symmetrised: 0.5*(forward + reverse), in nats. */
  renyiTwoSym: number;
  /** Asymmetry diagnostic: |forward - reverse| / (2 * renyiTwoSym) in [0, 1]. */
  renyiTwoAsymmetry: number;
  /** Chi-squared(p||q) = sum (p-q)^2/q (forward Pearson chi-squared). */
  chiSquaredForward: number;
  /** Chi-squared(q||p) = sum (p-q)^2/p (reverse Pearson chi-squared). */
  chiSquaredReverse: number;
  /** Normalised diagnostic: D_2^sym / (D_2^sym + 1) in [0, 1). */
  renyiTwoNormalized: number;
}

export interface DailyTokenRenyiTwoDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenRenyiTwoDivergenceHalvesSort;
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
  sources: DailyTokenRenyiTwoDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126-131). */
export const RENYI_TWO_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126-131). */
export const RENYI_TWO_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const RENYI_TWO_GRID_EXTENSION_H = 3;
/** Numerical floor on per-bin pmf mass before the ratio. */
export const RENYI_TWO_PMF_FLOOR = 1e-300;

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
 * KDE-smoothed symmetrised Renyi-2 divergence between halves
 * of a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - renyiTwoSym(x + c) === renyiTwoSym(x) for any constant c.
 *   - renyiTwoSym(k*x) === renyiTwoSym(x) for any k > 0.
 *   - renyiTwoSym === 0.5 * (renyiTwoForward + renyiTwoReverse).
 *   - renyiTwoForward === ln(1 + chiSquaredForward) (Renyi-2 / chi^2 identity).
 *   - renyiTwoReverse === ln(1 + chiSquaredReverse).
 *   - renyiTwoSym >= 0; equality iff halves identical after KDE smoothing.
 *   - Symmetric: swapping the two halves preserves renyiTwoSym
 *     (forward and reverse swap).
 *   - renyiTwoNormalized = D_2^sym / (D_2^sym + 1) in [0, 1).
 *   - renyiTwoAsymmetry in [0, 1] (or 0 when D_2^sym === 0).
 */
export function dailyTokenRenyiTwoDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  renyiTwoN1: number;
  renyiTwoN2: number;
  renyiTwoMadPool: number;
  renyiTwoBandwidth: number;
  renyiTwoGridLo: number;
  renyiTwoGridHi: number;
  renyiTwoGridDx: number;
  renyiTwoGridK: number;
  renyiTwoForward: number;
  renyiTwoReverse: number;
  renyiTwoSym: number;
  renyiTwoAsymmetry: number;
  chiSquaredForward: number;
  chiSquaredReverse: number;
  renyiTwoNormalized: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenRenyiTwoDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenRenyiTwoDivergenceHalves requires finite values',
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
      `dailyTokenRenyiTwoDivergenceHalves: zero centred variance (n=${n})`,
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

  let h = RENYI_TWO_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = RENYI_TWO_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - RENYI_TWO_GRID_EXTENSION_H * h;
  const gHi = mx + RENYI_TWO_GRID_EXTENSION_H * h;
  const K = RENYI_TWO_GRID_K;
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
      `dailyTokenRenyiTwoDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Build pmfs p, q with floor; accumulate
  //   M_pq = sum p^2/q (forward Renyi-2 moment)
  //   M_qp = sum q^2/p (reverse Renyi-2 moment)
  //   chi^2_fwd = sum (p-q)^2/q
  //   chi^2_rev = sum (p-q)^2/p
  let mPQ = 0;
  let mQP = 0;
  let chi2Fwd = 0;
  let chi2Rev = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < RENYI_TWO_PMF_FLOOR) pk = RENYI_TWO_PMF_FLOOR;
    if (qk < RENYI_TWO_PMF_FLOOR) qk = RENYI_TWO_PMF_FLOOR;
    mPQ += (pk * pk) / qk;
    mQP += (qk * qk) / pk;
    const d = pk - qk;
    chi2Fwd += (d * d) / qk;
    chi2Rev += (d * d) / pk;
  }
  // M_pq, M_qp >= 1 (each is 1 + chi^2 by identity); snap any
  // floor-induced sub-1 to 1 to keep the log >= 0.
  if (mPQ < 1) mPQ = 1;
  if (mQP < 1) mQP = 1;
  if (chi2Fwd < 0) chi2Fwd = 0;
  if (chi2Rev < 0) chi2Rev = 0;
  const renyiTwoForward = Math.log(mPQ);
  const renyiTwoReverse = Math.log(mQP);
  const renyiTwoSym = 0.5 * (renyiTwoForward + renyiTwoReverse);

  const renyiTwoNormalized = renyiTwoSym / (renyiTwoSym + 1);
  const renyiTwoAsymmetry =
    renyiTwoSym > 0
      ? Math.abs(renyiTwoForward - renyiTwoReverse) / (2 * renyiTwoSym)
      : 0;

  if (
    !Number.isFinite(renyiTwoForward) ||
    !Number.isFinite(renyiTwoReverse) ||
    !Number.isFinite(renyiTwoSym)
  ) {
    throw new Error(
      `dailyTokenRenyiTwoDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    renyiTwoN1: n1,
    renyiTwoN2: n2,
    renyiTwoMadPool: madPool,
    renyiTwoBandwidth: h,
    renyiTwoGridLo: gLo,
    renyiTwoGridHi: gHi,
    renyiTwoGridDx: dx,
    renyiTwoGridK: K,
    renyiTwoForward,
    renyiTwoReverse,
    renyiTwoSym,
    renyiTwoAsymmetry,
    chiSquaredForward: chi2Fwd,
    chiSquaredReverse: chi2Rev,
    renyiTwoNormalized,
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

export function buildDailyTokenRenyiTwoDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenRenyiTwoDivergenceHalvesOptions = {},
): DailyTokenRenyiTwoDivergenceHalvesReport {
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
  const sort: DailyTokenRenyiTwoDivergenceHalvesSort =
    opts.sort ?? 'renyiTwoSymDesc';
  const validSorts: DailyTokenRenyiTwoDivergenceHalvesSort[] = [
    'renyiTwoSym',
    'renyiTwoSymDesc',
    'renyiTwoForward',
    'renyiTwoForwardDesc',
    'renyiTwoReverse',
    'renyiTwoReverseDesc',
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
  const rows: DailyTokenRenyiTwoDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenRenyiTwoDivergenceHalves(filled);
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
      renyiTwoN1: result.renyiTwoN1,
      renyiTwoN2: result.renyiTwoN2,
      renyiTwoMadPool: result.renyiTwoMadPool,
      renyiTwoBandwidth: result.renyiTwoBandwidth,
      renyiTwoGridLo: result.renyiTwoGridLo,
      renyiTwoGridHi: result.renyiTwoGridHi,
      renyiTwoGridDx: result.renyiTwoGridDx,
      renyiTwoGridK: result.renyiTwoGridK,
      renyiTwoForward: result.renyiTwoForward,
      renyiTwoReverse: result.renyiTwoReverse,
      renyiTwoSym: result.renyiTwoSym,
      renyiTwoAsymmetry: result.renyiTwoAsymmetry,
      chiSquaredForward: result.chiSquaredForward,
      chiSquaredReverse: result.chiSquaredReverse,
      renyiTwoNormalized: result.renyiTwoNormalized,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'renyiTwoSym':
        primary = a.renyiTwoSym - b.renyiTwoSym;
        break;
      case 'renyiTwoSymDesc':
        primary = b.renyiTwoSym - a.renyiTwoSym;
        break;
      case 'renyiTwoForward':
        primary = a.renyiTwoForward - b.renyiTwoForward;
        break;
      case 'renyiTwoForwardDesc':
        primary = b.renyiTwoForward - a.renyiTwoForward;
        break;
      case 'renyiTwoReverse':
        primary = a.renyiTwoReverse - b.renyiTwoReverse;
        break;
      case 'renyiTwoReverseDesc':
        primary = b.renyiTwoReverse - a.renyiTwoReverse;
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
    gridK: RENYI_TWO_GRID_K,
    silvermanMultiplier: RENYI_TWO_SILVERMAN_MULTIPLIER,
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
