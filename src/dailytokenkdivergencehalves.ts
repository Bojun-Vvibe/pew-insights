/**
 * daily-token-k-divergence-halves: per-source
 * KDE-SMOOTHED ASYMMETRIC K-DIVERGENCE
 * between the FIRST and SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-FORTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126-139 for direct
 * comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h = 0.9 * mad_pool * n^(-1/5) (Silverman).
 * Shared K=257-point grid spans [min - 3h, max + 3h]; pmfs
 * p (first half) and q (second half) are obtained by
 * Gaussian KDE per half then trapezoidal mass-normalisation.
 * (Bit-exact same setup as axes 126-139.)
 *
 * K-DIVERGENCE (Cha 2007 eq. 36):
 *
 *     K(p || q) = sum_k p_k * log( 2 p_k / (p_k + q_k) )    (forward)
 *     K(q || p) = sum_k q_k * log( 2 q_k / (p_k + q_k) )    (reverse)
 *
 * Each direction is bounded above by log(2) and >= 0, with
 * 0 iff p === q on the grid. JSD = 0.5 * (K(p||q) + K(q||p)),
 * so axis-140 RECOVERS the directional decomposition that
 * axis-118 JSD collapses by symmetric averaging.
 *
 * The ASYMMETRIC pair (`kForward`, `kReverse`) is reported
 * separately on every row -- this is THE point of the axis.
 * Headline value is the MAX of the two:
 *
 *     kMax = max( kForward, kReverse )
 *
 * which dominates the symmetrised JSD exactly when one
 * direction blows up far harder than the other -- the regime
 * JSD collapses by averaging.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-139:
 *
 *   - Class. p log(2p / (p+q)) (forward) and
 *     q log(2q / (p+q)) (reverse) -- ASYMMETRIC, LOGARITHMIC,
 *     BOUNDED-by-log(2) divergence in opposite directions,
 *     reported as a PAIR. axis-139 ships an asymmetric
 *     POLYNOMIAL-RATIONAL pair (Neyman, unbounded);
 *     axis-140 ships an asymmetric LOGARITHMIC pair
 *     (K-div, bounded by log(2)). Different family.
 *
 *   - vs axis-118 JSD = 0.5 * (K(p||q) + K(q||p)):
 *     JSD is the ARITHMETIC MEAN of the two K-div
 *     directions -- it has a single magnitude scalar and
 *     CANNOT recover the direction. axis-140 ships the
 *     PAIR + the bounded asymmetry ratio. Whenever
 *     kAsymmetry > 0 the directional information is
 *     genuinely new vs JSD; when kAsymmetry = 0
 *     the two axes carry the same information.
 *
 *   - vs axis-139 Neyman pair (asymmetric, polynomial-
 *     rational, UNBOUNDED with 1/q (forward) or 1/p
 *     (reverse) tail blow-up): K-div is asymmetric and
 *     LOGARITHMIC, bounded above by log(2). Different
 *     numerical regime -- K-div is dominated by the
 *     LOG-RATIO of p to (p+q)/2, not the polynomial
 *     p^2 / q.
 *
 *   - vs axis-119 / 127 TV (L^1, symmetric, bounded by 1):
 *     TV is symmetric and L^1; K-div is asymmetric and
 *     log-weighted.
 *
 *   - vs axis-122 Bhattacharyya (similarity in sqrt
 *     coordinates, symmetric, bounded in [0, 1]): K-div
 *     is dissimilarity-valued, in raw pmf coordinates,
 *     asymmetric, bounded by log(2).
 *
 *   - vs axis-128 Hellinger (sqrt-amplitude L^2,
 *     symmetric): K-div is asymmetric and logarithmic.
 *
 *   - vs axis-129 triangular delta = sum (p-q)^2/(p+q):
 *     delta is symmetric, polynomial-rational; K-div is
 *     asymmetric and logarithmic.
 *
 *   - vs axis-134 psChi2 = sum (p-q)^2 (p+q)/(pq):
 *     psChi2 is symmetric polynomial-rational; K-div is
 *     asymmetric logarithmic.
 *
 *   - vs axis-135 Clark / 136 Taneja / 137 KJ /
 *     138 Topsoe: all symmetric. K-div is asymmetric and
 *     reported as a PAIR.
 *
 * BOUNDED REGIME. K(p||q) <= log(2) per direction (proof:
 * 2p / (p+q) <= 2, so log(2p/(p+q)) <= log(2), and
 * sum_k p_k = 1). The headline `kMax` is therefore strictly
 * bounded above by `log(2) ~= 0.6931472` -- a regime
 * COMPLETELY ABSENT from axes 134/137/139 which all have
 * unbounded blow-up tails. This bounded regime is exactly
 * what makes K-div a robust drift signal in the presence of
 * tail outliers that wreck unbounded divergences.
 *
 * NUMERICAL FLOOR. The argument `2p/(p+q)` vanishes only
 * where `p` underflows to 0; the denominator `p+q` is
 * floored implicitly because both `p` and `q` are. We apply
 * the SAME PMF_FLOOR = 1e-15 as axes 134/135/136/137/138/139
 * to keep `p log(2p/(p+q))` finite (the limit is 0 as
 * p -> 0; the floor keeps the literal evaluation tame).
 * The floor is a no-op for any genuine KDE pmf and
 * contributes at most O(K * eps * |log eps|) -- well below
 * any natural K-div value at this grid resolution.
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     kForward     = sum_k p_k log(2 p_k / (p_k + q_k))   in [0, log 2]
 *     kReverse     = sum_k q_k log(2 q_k / (p_k + q_k))   in [0, log 2]
 *     kMax         = max(kForward, kReverse)              in [0, log 2]
 *     kAsymmetry   = |K_pq - K_qp| / (K_pq + K_qp)
 *                    in [0, 1]   (0 iff perfectly
 *                    symmetric drift; 1 iff one direction
 *                    is zero, the rare regime where the
 *                    axis-118 JSD symmetrisation is
 *                    maximally misleading)
 *     kJsd         = 0.5 * (kForward + kReverse)
 *                    in [0, log 2]   (the SYMMETRIC sister,
 *                    bit-exactly the JSD)
 *     kMaxBinFwd   = max_k of forward per-bin summand
 *     kMaxBinRev   = max_k of reverse per-bin summand
 *
 * kAsymmetry is defined as 0 when the two-direction sum is
 * itself 0 (vacuous case where `p = q` on the grid).
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the ASYMMETRIC K-DIVERGENCE in BOTH directions
 *   `K(p||q) = sum_k p_k log(2 p_k / (p_k + q_k))` and
 *   `K(q||p) = sum_k q_k log(2 q_k / (p_k + q_k))`, both
 *   bounded by `log(2)`, how DIRECTIONAL is the
 *   half-vs-half drift in the regime where unbounded
 *   asymmetric divergences (Neyman) blow up on tail bins?"**
 *
 * References:
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 36 (K-divergence) and
 *     the symmetric companion eq. 39 (JSD).
 *   Lin, J. (1991). "Divergence measures based on the
 *     Shannon entropy", IEEE Trans. Inf. Theory 37(1),
 *     145-151.
 *
 * Caveats:
 *
 *   - K-div is asymmetric: the ROLE of the SECOND half as
 *     the partner in `kForward = K(p||q)` is a deliberate
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
 *   pew-insights daily-token-k-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-k-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by K-divergence max ascending:
 *   pew-insights daily-token-k-divergence-halves \
 *     --sort kMax
 */
import type { QueueLine } from './types.js';

export type DailyTokenKDivergenceHalvesSort =
  | 'kMax'
  | 'kMaxDesc'
  | 'kForward'
  | 'kForwardDesc'
  | 'kReverse'
  | 'kReverseDesc'
  | 'kAsymmetry'
  | 'kAsymmetryDesc'
  | 'kJsd'
  | 'kJsdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenKDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  kN1: number;
  kN2: number;
  kMadPool: number;
  kBandwidth: number;
  kGridLo: number;
  kGridHi: number;
  kGridDx: number;
  kGridK: number;
  /** K(p||q) = sum_k p_k log(2 p_k / (p_k + q_k)), in [0, log 2]. */
  kForward: number;
  /** K(q||p) = sum_k q_k log(2 q_k / (p_k + q_k)), in [0, log 2]. */
  kReverse: number;
  /** max(kForward, kReverse), in [0, log 2]. */
  kMax: number;
  /** |K_pq - K_qp| / (K_pq + K_qp) in [0, 1]; 0 if both directions zero. */
  kAsymmetry: number;
  /** 0.5 * (kForward + kReverse) -- the JSD sister, in [0, log 2]. */
  kJsd: number;
  /** Largest per-bin forward summand p_k log(2 p_k / (p_k + q_k)), >= 0. */
  kMaxBinFwd: number;
  /** Largest per-bin reverse summand q_k log(2 q_k / (p_k + q_k)), >= 0. */
  kMaxBinRev: number;
  /** kMax / ln(2), in [0, 1]; saturation against analytic ceiling. */
  kSaturation: number;
}

export interface DailyTokenKDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKDivergenceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  gridK: number;
  silvermanMultiplier: number;
  pmfFloor: number;
  /** Theoretical upper bound on each K-div direction: ln(2). */
  upperBound: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenKDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126-139). */
export const KDIV_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const KDIV_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const KDIV_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins to keep p log(2p/(p+q)) finite. */
export const KDIV_PMF_FLOOR = 1e-15;
/** Theoretical upper bound on K(p||q) per direction: ln(2). */
export const KDIV_UPPER_BOUND = Math.log(2);

/**
 * Saturation indicator: ratio of `kMax` to the theoretical
 * upper bound `ln(2)`, in `[0, 1]`. A value near 1 means the
 * loudest direction is approaching the analytic ceiling --
 * a regime where the bounded K-divergence is itself losing
 * resolution and unbounded asymmetric divergences (axis-139
 * Neyman) carry strictly more discrimination. A value near
 * 0 means the drift is well below saturation and K-div is
 * comfortably in its informative regime.
 *
 * Identities verified by the test suite:
 *
 *   - kDivSaturation(0)         === 0
 *   - kDivSaturation(KDIV_UPPER_BOUND) === 1
 *   - kDivSaturation(0.5 * KDIV_UPPER_BOUND) === 0.5
 *   - monotone non-decreasing in `kMax`.
 *
 * Capped at 1 to absorb tiny numerical overshoot from
 * trapezoidal pmf reconstruction; rejects inputs above
 * `KDIV_UPPER_BOUND * (1 + 1e-6)` as a sentinel that
 * something upstream is wrong.
 */
export function kDivSaturation(kMax: number): number {
  if (!Number.isFinite(kMax)) {
    throw new Error('kDivSaturation requires finite input');
  }
  if (kMax < 0) {
    throw new Error('kDivSaturation requires non-negative input');
  }
  if (kMax > KDIV_UPPER_BOUND * (1 + 1e-6)) {
    throw new Error(
      `kDivSaturation: kMax=${kMax} exceeds ln(2) sentinel; upstream pipeline is wrong`,
    );
  }
  const r = kMax / KDIV_UPPER_BOUND;
  return r > 1 ? 1 : r;
}

/**
 * Directional sign diagnostic: returns +1 iff the FORWARD
 * direction `K(p||q)` strictly dominates the REVERSE
 * direction `K(q||p)` by more than `tol` (default 1e-12),
 * -1 iff the REVERSE dominates by more than `tol`, 0 iff
 * the two are within `tol` of each other (symmetric drift,
 * the regime where axis-118 JSD carries the same
 * information as either direction).
 *
 * Pure scalar helper -- a complement to `kAsymmetry`
 * which is the bounded MAGNITUDE of the asymmetry. Together
 * they fully decompose the directional asymmetry into
 * `(sign, magnitude)`.
 */
export function kDivDirectionalSign(
  forward: number,
  reverse: number,
  tol = 1e-12,
): -1 | 0 | 1 {
  if (!Number.isFinite(forward) || !Number.isFinite(reverse)) {
    throw new Error('kDivDirectionalSign requires finite inputs');
  }
  if (forward < 0 || reverse < 0) {
    throw new Error('kDivDirectionalSign requires non-negative inputs');
  }
  if (!Number.isFinite(tol) || tol < 0) {
    throw new Error('kDivDirectionalSign requires non-negative finite tol');
  }
  const diff = forward - reverse;
  if (Math.abs(diff) <= tol) return 0;
  return diff > 0 ? 1 : -1;
}

/**
 * Classify the asymmetry regime of a (forward, reverse)
 * K-divergence pair into one of four buckets that tell
 * downstream tooling how much the directional information
 * matters relative to the symmetric JSD sister.
 *
 *   - 'symmetric'         : kAsymmetry < 0.05  (JSD captures
 *                           essentially all of the signal;
 *                           the pair adds <5% information)
 *   - 'mild-asymmetry'    : 0.05 <= asym < 0.25
 *   - 'strong-asymmetry'  : 0.25 <= asym < 0.75
 *   - 'one-sided'         : asym >= 0.75 (one direction
 *                           dwarfs the other; JSD averaging
 *                           is maximally misleading -- this
 *                           is the regime where axis-140
 *                           strictly dominates axis-118 JSD)
 *
 * The 'vacuous' regime (both directions = 0, i.e. `p = q`
 * on the grid) is reported as 'symmetric' with sign 0.
 *
 * Returns a structured (regime, sign, asymmetry) triple
 * suitable for direct rendering in tabular output.
 *
 * Identities verified by the test suite:
 *
 *   - kDivAsymmetryRegime(a, a) -> 'symmetric', sign 0
 *   - kDivAsymmetryRegime(0, 0) -> 'symmetric', sign 0
 *   - kDivAsymmetryRegime(1, 0) -> 'one-sided', sign +1
 *   - kDivAsymmetryRegime(0, 1) -> 'one-sided', sign -1
 *   - regime is monotone in `|fwd - rev| / (fwd + rev)`.
 */
export type KDivAsymmetryRegime =
  | 'symmetric'
  | 'mild-asymmetry'
  | 'strong-asymmetry'
  | 'one-sided';

export interface KDivAsymmetryClassification {
  regime: KDivAsymmetryRegime;
  sign: -1 | 0 | 1;
  asymmetry: number;
}

export function kDivAsymmetryRegime(
  forward: number,
  reverse: number,
): KDivAsymmetryClassification {
  if (!Number.isFinite(forward) || !Number.isFinite(reverse)) {
    throw new Error('kDivAsymmetryRegime requires finite inputs');
  }
  if (forward < 0 || reverse < 0) {
    throw new Error('kDivAsymmetryRegime requires non-negative inputs');
  }
  const denom = forward + reverse;
  const asym = denom > 0 ? Math.abs(forward - reverse) / denom : 0;
  const sign = kDivDirectionalSign(forward, reverse);
  let regime: KDivAsymmetryRegime;
  if (asym < 0.05) regime = 'symmetric';
  else if (asym < 0.25) regime = 'mild-asymmetry';
  else if (asym < 0.75) regime = 'strong-asymmetry';
  else regime = 'one-sided';
  return { regime, sign, asymmetry: asym };
}

/**
 * Per-bin JSD decomposition. The JSD on a single bin is
 *
 *     jsdBin(p, q) = 0.5 * (kDivSummand(p, q) + kDivSummand(q, p))
 *                  = 0.5 * ( p log(p/m) + q log(q/m) )
 *
 * where `m = (p + q) / 2`. Sum over k recovers the JSD
 * scalar `kJsd`. Per-bin jsd is non-negative (Gibbs' on the
 * 2-bin distribution {p, q} with mixture m) -- in contrast
 * to the SIGNED `kDivSummand`, this symmetric per-bin
 * primitive is a true non-negative diagnostic suitable for
 * "which bin is driving the drift" inspection.
 *
 * Identities verified by the test suite:
 *
 *   - kJsdSummand(p, p) === 0                     (diagonal)
 *   - kJsdSummand(p, q) >= 0                      (Gibbs')
 *   - kJsdSummand(p, q) === kJsdSummand(q, p)     (symmetric)
 *   - kJsdSummand(0, q) === 0.5 * q * log(2)      (limit)
 *   - kJsdSummand(p, q) <= 0.5 * (p + q) * log(2) (per-bin bound)
 */
export function kJsdSummand(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    throw new Error('kJsdSummand requires finite inputs');
  }
  if (p < 0 || q < 0) {
    throw new Error('kJsdSummand requires non-negative inputs');
  }
  if (p <= 0 && q <= 0) return 0;
  const pf = p < KDIV_PMF_FLOOR ? KDIV_PMF_FLOOR : p;
  const qf = q < KDIV_PMF_FLOOR ? KDIV_PMF_FLOOR : q;
  const m = 0.5 * (pf + qf);
  // x log(x/m) where x -> 0 has limit 0; the floor handles
  // it numerically.
  const tp = p > 0 ? pf * Math.log(pf / m) : 0;
  const tq = q > 0 ? qf * Math.log(qf / m) : 0;
  const v = 0.5 * (tp + tq);
  return v > 0 ? v : 0;
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
 * Pure per-bin K-divergence summand in the FORWARD direction.
 *
 *     kDivSummand(p, q) = p * log( 2p / (p + q) )
 *
 * Per-bin contribution to K(p || q) = sum_k kDivSummand(p_k, q_k).
 * Both `p` and `q` are floored at KDIV_PMF_FLOOR. Returns 0
 * when p === q (diagonal vanishes) and 0 when p === 0
 * (limit, since x log x -> 0 as x -> 0).
 *
 * Identities verified by the test suite:
 *
 *   - kDivSummand(p, p) === 0                    (vanishes on the diagonal)
 *   - kDivSummand(p, q) >= 0 when p >= q          (log arg >= 1)
 *   - kDivSummand(p, q) <  0 when 0 < p < q       (per-bin SIGNED;
 *                                                  only the SUM over k
 *                                                  is non-negative by Gibbs')
 *   - kDivSummand(0, q) === 0                    (limit)
 *   - kDivSummand(p, q) <= p * log(2)            (per-bin upper bound)
 */
export function kDivSummand(p: number, q: number): number {
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    throw new Error('kDivSummand requires finite inputs');
  }
  if (p < 0 || q < 0) {
    throw new Error('kDivSummand requires non-negative inputs');
  }
  if (p <= 0) return 0;
  const pf = p < KDIV_PMF_FLOOR ? KDIV_PMF_FLOOR : p;
  const qf = q < KDIV_PMF_FLOOR ? KDIV_PMF_FLOOR : q;
  const ratio = (2 * pf) / (pf + qf);
  return pf * Math.log(ratio);
}

/**
 * KDE-smoothed asymmetric K-divergence between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - kForward(x + c) === kForward(x).
 *   - kForward(k*x) === kForward(x) for k > 0.
 *   - 0 <= kForward <= ln(2), 0 <= kReverse <= ln(2).
 *   - Both === 0 iff p === q on the grid.
 *   - Swapping the two halves swaps forward and reverse.
 *   - kAsymmetry in [0, 1].
 *   - kMax === max(kForward, kReverse).
 *   - kJsd === 0.5 * (kForward + kReverse).
 */
export function dailyTokenKDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  kN1: number;
  kN2: number;
  kMadPool: number;
  kBandwidth: number;
  kGridLo: number;
  kGridHi: number;
  kGridDx: number;
  kGridK: number;
  kForward: number;
  kReverse: number;
  kMax: number;
  kAsymmetry: number;
  kJsd: number;
  kMaxBinFwd: number;
  kMaxBinRev: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenKDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenKDivergenceHalves requires finite values');
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
      `dailyTokenKDivergenceHalves: zero centred variance (n=${n})`,
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

  let h = KDIV_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = KDIV_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - KDIV_GRID_EXTENSION_H * h;
  const gHi = mx + KDIV_GRID_EXTENSION_H * h;
  const K = KDIV_GRID_K;
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
      `dailyTokenKDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sumFwd = 0;
  let sumRev = 0;
  let maxBinFwd = 0;
  let maxBinRev = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < KDIV_PMF_FLOOR) pk = KDIV_PMF_FLOOR;
    if (qk < KDIV_PMF_FLOOR) qk = KDIV_PMF_FLOOR;
    const m = 0.5 * (pk + qk);
    // K(p||q) = sum p log(p/m) where m = (p+q)/2
    const tFwd = pk * Math.log(pk / m);
    const tRev = qk * Math.log(qk / m);
    sumFwd += tFwd;
    sumRev += tRev;
    if (tFwd > maxBinFwd) maxBinFwd = tFwd;
    if (tRev > maxBinRev) maxBinRev = tRev;
  }
  // The pure `kDivSummand(p, q)` helper exposes the same
  // per-bin forward computation for downstream tooling; we
  // keep the inlined hot loop here to avoid per-bin
  // function-call overhead on the K=257 grid.

  // Floor at 0: tiny negative drift from finite-grid pmf
  // floor + log can in principle produce small-negative
  // partial sums; the analytic value is non-negative.
  const kForward = sumFwd > 0 ? sumFwd : 0;
  const kReverse = sumRev > 0 ? sumRev : 0;
  const kMax = kForward > kReverse ? kForward : kReverse;
  const kJsd = 0.5 * (kForward + kReverse);
  const denom = kForward + kReverse;
  const kAsymmetry =
    denom > 0 ? Math.abs(kForward - kReverse) / denom : 0;

  if (
    !Number.isFinite(kForward) ||
    !Number.isFinite(kReverse) ||
    !Number.isFinite(kMax) ||
    !Number.isFinite(kAsymmetry) ||
    !Number.isFinite(kJsd) ||
    !Number.isFinite(maxBinFwd) ||
    !Number.isFinite(maxBinRev)
  ) {
    throw new Error(
      `dailyTokenKDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    kN1: n1,
    kN2: n2,
    kMadPool: madPool,
    kBandwidth: h,
    kGridLo: gLo,
    kGridHi: gHi,
    kGridDx: dx,
    kGridK: K,
    kForward,
    kReverse,
    kMax,
    kAsymmetry,
    kJsd,
    kMaxBinFwd: maxBinFwd,
    kMaxBinRev: maxBinRev,
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

export function buildDailyTokenKDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenKDivergenceHalvesOptions = {},
): DailyTokenKDivergenceHalvesReport {
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
  const sort: DailyTokenKDivergenceHalvesSort = opts.sort ?? 'kMaxDesc';
  const validSorts: DailyTokenKDivergenceHalvesSort[] = [
    'kMax',
    'kMaxDesc',
    'kForward',
    'kForwardDesc',
    'kReverse',
    'kReverseDesc',
    'kAsymmetry',
    'kAsymmetryDesc',
    'kJsd',
    'kJsdDesc',
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
  const rows: DailyTokenKDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenKDivergenceHalves(filled);
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
      kN1: result.kN1,
      kN2: result.kN2,
      kMadPool: result.kMadPool,
      kBandwidth: result.kBandwidth,
      kGridLo: result.kGridLo,
      kGridHi: result.kGridHi,
      kGridDx: result.kGridDx,
      kGridK: result.kGridK,
      kForward: result.kForward,
      kReverse: result.kReverse,
      kMax: result.kMax,
      kAsymmetry: result.kAsymmetry,
      kJsd: result.kJsd,
      kMaxBinFwd: result.kMaxBinFwd,
      kMaxBinRev: result.kMaxBinRev,
      kSaturation: kDivSaturation(result.kMax),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kMax':
        primary = a.kMax - b.kMax;
        break;
      case 'kMaxDesc':
        primary = b.kMax - a.kMax;
        break;
      case 'kForward':
        primary = a.kForward - b.kForward;
        break;
      case 'kForwardDesc':
        primary = b.kForward - a.kForward;
        break;
      case 'kReverse':
        primary = a.kReverse - b.kReverse;
        break;
      case 'kReverseDesc':
        primary = b.kReverse - a.kReverse;
        break;
      case 'kAsymmetry':
        primary = a.kAsymmetry - b.kAsymmetry;
        break;
      case 'kAsymmetryDesc':
        primary = b.kAsymmetry - a.kAsymmetry;
        break;
      case 'kJsd':
        primary = a.kJsd - b.kJsd;
        break;
      case 'kJsdDesc':
        primary = b.kJsd - a.kJsd;
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
    gridK: KDIV_GRID_K,
    silvermanMultiplier: KDIV_SILVERMAN_MULTIPLIER,
    pmfFloor: KDIV_PMF_FLOOR,
    upperBound: KDIV_UPPER_BOUND,
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
