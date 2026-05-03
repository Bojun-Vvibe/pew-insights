/**
 * daily-token-pca-projection-distance-halves: per-source
 * DELAY-EMBEDDED PCA HALF-CENTROID PROJECTION DISTANCE on
 * the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Form delay-embedded vectors of dimension d = 3 with lag 1
 * (Takens-style embedding):
 *
 *     v_t = ( x[t], x[t+1], x[t+2] )    for t in 0..n-3
 *
 * giving M = n - d + 1 = n - 2 row-vectors in R^d. Split
 * the embedded matrix V (M x d) into two contiguous halves
 *
 *     A = V[0..m1-1]      with m1 = floor(M/2)
 *     B = V[m1..M-1]      with m2 = M - m1
 *
 * Pooled centring:
 *
 *     mu_pool  =  ( 1 / M ) * sum_t v_t
 *     V_c      =  V - mu_pool       (broadcast)
 *
 * PCA on the POOLED centred matrix. Form the d x d sample
 * covariance
 *
 *     C  =  ( 1 / M ) * V_c^T V_c
 *
 * (population scaling, deterministic and matches the
 * pooled-centred convention used by axis-124's pooled-IQR
 * scale). Diagonalise C = U L U^T with eigenvalues
 * lam_1 >= lam_2 >= lam_3 >= 0 (real, non-negative because
 * C is PSD by construction). The leading PRINCIPAL
 * COMPONENT u_1 is the d-vector u_1 in R^3 with
 * ||u_1||_2 = 1 maximising u_1^T C u_1 = lam_1.
 *
 * Project the half centroids onto the leading PC:
 *
 *     mu_A     =  ( 1 / m1 ) * sum_{t in A} v_t
 *     mu_B     =  ( 1 / m2 ) * sum_{t in B} v_t
 *     s_A      =  u_1^T ( mu_A - mu_pool )
 *     s_B      =  u_1^T ( mu_B - mu_pool )
 *     pcGap    =  s_B - s_A    (signed, in same units as x)
 *
 * Standardise by sqrt(lam_1) (the pooled stddev along the
 * leading PC; positive whenever the source has any spread
 * in delay-embedding space):
 *
 *     pcZ      =  ( s_B - s_A ) / sqrt(lam_1)
 *
 * pcZ is dimensionless, signed, scale-invariant in the
 * data, and CROSS-SOURCE-COMPARABLE.
 *
 * Test statistic. The canonical scaled multivariate two-
 * sample statistic for the projected scalar gap is
 *
 *     pcT  =  ( m1 * m2 / (m1 + m2) ) * pcZ^2
 *
 * (Hotelling 1931 Ann. Math. Statist. 2(3):360-378;
 * Anderson 2003 Intro. to Multivariate Stat. Analysis,
 * 3rd ed., §5.2; the projection onto u_1 is the linear
 * combination maximising the cross-validated separation in
 * the pooled-PCA basis).
 *
 * Variance-explained diagnostics:
 *
 *     pcVarExplained1  =  lam_1 / (lam_1 + lam_2 + lam_3)
 *     pcVarExplained2  =  (lam_1 + lam_2) / sum(lam)
 *
 * Per-PC-axis projected gap vector (length d = 3):
 *
 *     pcGapByAxis[i]   =  u_i^T (mu_B - mu_A)        (raw)
 *     pcStdGapByAxis[i] = pcGapByAxis[i] / sqrt(lam_i)
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-124:
 *
 *   - Class. TWO-SAMPLE LOCATION-SHIFT TEST in the
 *     LEADING-PRINCIPAL-COMPONENT SUBSPACE of the
 *     DELAY-EMBEDDED phase-space reconstruction (R^3 with
 *     d = 3, lag = 1). Detects shifts that align with the
 *     dominant phase-space direction of variation while
 *     remaining INSENSITIVE to off-axis fluctuations that
 *     project to zero on u_1.
 *
 *   - vs axis-124 quantile-vector diagonal-Mahalanobis.
 *     qv-Mahalanobis lives in FINITE-DIMENSIONAL QUANTILE-
 *     VECTOR SPACE indexed by 9 fixed probability levels;
 *     the metric is diagonal in the q_p coordinate system.
 *     PCA-projection lives in DELAY-EMBEDDED PHASE-SPACE
 *     (R^3 lagged-coordinate system) and the metric is
 *     ROTATED into the data-driven principal-component
 *     basis. A change confined to a single quantile (e.g.
 *     a stretch of the 70-80 percentile range) can move
 *     d2Diag substantially while leaving the leading-PC
 *     projection unchanged if the change is orthogonal to
 *     u_1; conversely, a coherent phase-space drift along
 *     u_1 can leave every individual quantile gap small.
 *
 *   - vs axes 118-123 (KS / AD / CvM / W1 / energy / MMD).
 *     All six work on the MARGINAL distribution of x[t]
 *     (i.e. permutation-invariant within each half). The
 *     PCA-projection axis is COVARIANCE-AWARE: it depends
 *     on the JOINT distribution of (x[t], x[t+1], x[t+2])
 *     through the delay-embedding lag structure. A
 *     time-permuted half (same marginal, different order)
 *     gives the same KS/AD/CvM/W1/energy/MMD/d2Diag but
 *     a different lam_i and hence a different u_1 and
 *     pcZ. This is the FIRST half-vs-half axis to use a
 *     LAGGED-COORDINATE PHASE-SPACE RECONSTRUCTION.
 *
 *   - vs spectral / autocorrelation axes (axes ~80-95,
 *     spectral centroid, autocorrelation lag-1, etc.).
 *     Those summarise the WHOLE series with permutation-
 *     SENSITIVE functionals (FFT phases, lag-1 autocorr).
 *     This axis SPLITS the series into halves and asks
 *     whether the leading-PC PROJECTION of the embedded
 *     phase-space CENTROID has shifted; spectral functionals
 *     are global and produce a single number per source.
 *
 *   - vs axes 115/116/117 (Mann-Whitney location, Brown-
 *     Forsythe scale, Siegel-Tukey scale). Those are
 *     UNIVARIATE rank-based half-vs-half tests on x[t].
 *     PCA-projection is a MULTIVARIATE projection-pursuit
 *     test on the delay-embedded vectors v_t in R^3.
 *
 * Headline question:
 * **"For each source, when we delay-embed the gap-filled
 *   daily token series with d=3, lag=1 and run PCA on the
 *   pooled centred matrix, how far apart (in pooled-leading-
 *   PC standard deviations) are the centroid projections
 *   of the first half vs the second half along the leading
 *   principal component, and how does that compare across
 *   sources?"**
 *
 * References:
 *   Takens, F., "Detecting strange attractors in turbulence",
 *     in Dynamical Systems and Turbulence, Warwick 1980,
 *     Lecture Notes in Mathematics 898, Springer (1981),
 *     pp. 366-381.
 *   Hotelling, H., "Analysis of a complex of statistical
 *     variables into principal components", J. Educ.
 *     Psychol. 24 (1933), pp. 417-441 and 498-520.
 *   Anderson, T. W., An Introduction to Multivariate
 *     Statistical Analysis, 3rd ed., Wiley (2003), §5.2,
 *     §11.
 *
 * Caveats:
 *
 *   - Embedding dimension d = 3 and lag = 1 are FIXED for
 *     cross-source comparability (no CLI knob). Hard floor
 *     n >= 8 so that M = n - 2 >= 6 and m1, m2 >= 3.
 *   - lam_1 = 0 implies the entire delay-embedded matrix
 *     is constant (zero-variance source); such sources are
 *     dropped as droppedZeroVariance.
 *   - Eigendecomposition is computed analytically for the
 *     symmetric 3x3 pooled covariance using the standard
 *     trigonometric closed form (Smith 1961 Comm. ACM 4(4):
 *     168), avoiding any iterative solver.
 *   - The SIGN of u_1 is fixed deterministically by
 *     requiring its largest-magnitude component to be
 *     positive. (Eigenvectors are defined up to sign;
 *     pcZ then carries a well-defined direction, but
 *     pcZ^2 and pcT are sign-invariant by construction.)
 *   - pcZ is INVARIANT under translation x -> x + c (mu_A,
 *     mu_B, mu_pool all shift by (c,c,c); the gap mu_B-mu_A
 *     is unchanged, lam_i unchanged).
 *   - pcZ is INVARIANT under positive rescaling x -> k*x
 *     (k > 0): mu_B - mu_A scales by k, lam_i scales by
 *     k^2, sqrt(lam_1) scales by k, ratio unchanged.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-pca-projection-distance-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-pca-projection-distance-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute leading-PC effect size desc:
 *   pew-insights daily-token-pca-projection-distance-halves \
 *     --sort pcZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenPcaProjectionDistanceHalvesSort =
  | 'pcT'
  | 'pcTDesc'
  | 'pcZ'
  | 'pcZDesc'
  | 'pcZAbs'
  | 'pcZAbsDesc'
  | 'pcVarExplained1'
  | 'pcVarExplained1Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPcaProjectionDistanceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that the embedded matrix has M = n - 2 >= 6 rows and
   * m1, m2 >= 3.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPcaProjectionDistanceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenPcaProjectionDistanceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Embedded matrix row count M = n - 2. */
  pcM: number;
  /** First-half embedded row count m1 = floor(M/2). */
  pcM1: number;
  /** Second-half embedded row count m2 = M - m1. */
  pcM2: number;
  /** Eigenvalues of the pooled covariance, descending. */
  pcEigenvalues: number[];
  /** Variance-explained ratio for PC1. */
  pcVarExplained1: number;
  /** Cumulative variance-explained ratio for PC1+PC2. */
  pcVarExplained2: number;
  /** Leading principal component u_1 (length 3, unit-norm). */
  pcU1: number[];
  /** Centroid projection on u_1 of the first half. */
  pcSA: number;
  /** Centroid projection on u_1 of the second half. */
  pcSB: number;
  /** Raw signed gap s_B - s_A in token units. */
  pcGap: number;
  /** Standardised signed gap (s_B - s_A) / sqrt(lam_1). */
  pcZ: number;
  /** Scaled multivariate two-sample statistic. */
  pcT: number;
  /**
   * Per-PC raw signed gap u_i^T (mu_B - mu_A), length 3.
   */
  pcGapByAxis: number[];
  /**
   * Per-PC standardised signed gap pcGapByAxis[i] / sqrt(lam_i).
   * Length 3. Entries with lam_i === 0 are reported as 0.
   */
  pcStdGapByAxis: number[];
}

export interface DailyTokenPcaProjectionDistanceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPcaProjectionDistanceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  /** Fixed embedding dimension. */
  embeddingDim: number;
  /** Fixed embedding lag. */
  embeddingLag: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenPcaProjectionDistanceHalvesSourceRow[];
}

/** Fixed embedding parameters. */
export const PC_EMBEDDING_DIM = 3;
export const PC_EMBEDDING_LAG = 1;

/**
 * Analytical eigendecomposition of a symmetric 3x3 matrix
 * using the trigonometric closed form (Smith 1961 Comm.
 * ACM 4(4):168). Returns eigenvalues sorted descending and
 * the corresponding orthonormal eigenvectors as columns.
 *
 * Input matrix is given by its 6 distinct entries:
 *     [ a b c ]
 *     [ b d e ]
 *     [ c e f ]
 */
function symmetric3x3Eigendecomp(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const p1 = b * b + c * c + e * e;
  let lam: number[];
  if (p1 === 0) {
    // Diagonal matrix.
    lam = [a, d, f];
  } else {
    const q = (a + d + f) / 3;
    const p2 = (a - q) ** 2 + (d - q) ** 2 + (f - q) ** 2 + 2 * p1;
    const p = Math.sqrt(p2 / 6);
    // B = (1/p) * (M - q*I)
    const Ba = (a - q) / p;
    const Bd = (d - q) / p;
    const Bf = (f - q) / p;
    const Bb = b / p;
    const Bc = c / p;
    const Be = e / p;
    // det(B)/2
    const detB =
      Ba * (Bd * Bf - Be * Be) -
      Bb * (Bb * Bf - Be * Bc) +
      Bc * (Bb * Be - Bd * Bc);
    let r = detB / 2;
    if (r < -1) r = -1;
    if (r > 1) r = 1;
    const phi = Math.acos(r) / 3;
    const eig1 = q + 2 * p * Math.cos(phi);
    const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
    const eig2 = 3 * q - eig1 - eig3;
    lam = [eig1, eig2, eig3];
  }
  // Sort descending.
  lam.sort((x, y) => y - x);

  // Compute eigenvector for a given eigenvalue via cross product
  // of two rows of (M - lam*I).
  function eigvec(lambda: number): number[] {
    const m11 = a - lambda;
    const m22 = d - lambda;
    const m33 = f - lambda;
    // Rows of (M - lam*I):
    const r1 = [m11, b, c];
    const r2 = [b, m22, e];
    const r3 = [c, e, m33];
    // Try cross products until non-trivial.
    const candidates: number[][] = [
      cross(r1, r2),
      cross(r1, r3),
      cross(r2, r3),
    ];
    let best = candidates[0]!;
    let bestNorm = norm3(best);
    for (let i = 1; i < candidates.length; i += 1) {
      const n = norm3(candidates[i]!);
      if (n > bestNorm) {
        best = candidates[i]!;
        bestNorm = n;
      }
    }
    if (bestNorm === 0) {
      // Degenerate (e.g. multiplicity); return canonical basis.
      return [1, 0, 0];
    }
    return [best[0]! / bestNorm, best[1]! / bestNorm, best[2]! / bestNorm];
  }

  const v1 = eigvec(lam[0]!);
  // For v2, project out v1 contribution from the second
  // eigenvector candidate to enforce orthogonality (in
  // case of near-multiplicity).
  let v2 = eigvec(lam[1]!);
  v2 = gramSchmidt(v2, [v1]);
  // v3 = v1 x v2 (right-handed).
  let v3 = cross(v1, v2);
  const v3n = norm3(v3);
  if (v3n > 0) {
    v3 = [v3[0]! / v3n, v3[1]! / v3n, v3[2]! / v3n];
  } else {
    v3 = eigvec(lam[2]!);
  }

  // Deterministic sign: largest-magnitude component positive.
  function fixSign(v: number[]): number[] {
    let argmax = 0;
    let absMax = Math.abs(v[0]!);
    for (let i = 1; i < 3; i += 1) {
      const ai = Math.abs(v[i]!);
      if (ai > absMax) {
        absMax = ai;
        argmax = i;
      }
    }
    if (v[argmax]! < 0) return [-v[0]!, -v[1]!, -v[2]!];
    return v;
  }

  return {
    eigenvalues: lam,
    eigenvectors: [fixSign(v1), fixSign(v2), fixSign(v3)],
  };
}

function cross(u: number[], v: number[]): number[] {
  return [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
}

function norm3(v: number[]): number {
  return Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!);
}

function gramSchmidt(v: number[], basis: number[][]): number[] {
  let out = v.slice();
  for (const u of basis) {
    const dot = out[0]! * u[0]! + out[1]! * u[1]! + out[2]! * u[2]!;
    out = [out[0]! - dot * u[0]!, out[1]! - dot * u[1]!, out[2]! - dot * u[2]!];
  }
  const n = norm3(out);
  if (n === 0) return [1, 0, 0];
  return [out[0]! / n, out[1]! / n, out[2]! / n];
}

/**
 * Delay-embedded PCA half-centroid projection on a real
 * series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - pcZ(x + c) === pcZ(x) for any constant c
 *     (translation-invariance: mu_A, mu_B, mu_pool all
 *     shift by (c,c,c); the gap is unchanged, eigenvalues
 *     unchanged).
 *   - pcZ(k*x) === pcZ(x) for any k > 0
 *     (positive scale-invariance: gap scales by k,
 *     sqrt(lam_1) scales by k, ratio unchanged).
 *   - pcT === (m1*m2/(m1+m2)) * pcZ^2.
 *   - sum(eigenvalues) === trace(C).
 */
export function dailyTokenPcaProjectionDistanceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  pcM: number;
  pcM1: number;
  pcM2: number;
  pcEigenvalues: number[];
  pcVarExplained1: number;
  pcVarExplained2: number;
  pcU1: number[];
  pcSA: number;
  pcSB: number;
  pcGap: number;
  pcZ: number;
  pcT: number;
  pcGapByAxis: number[];
  pcStdGapByAxis: number[];
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenPcaProjectionDistanceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenPcaProjectionDistanceHalves requires finite values',
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
      `dailyTokenPcaProjectionDistanceHalves: zero centred variance (n=${n})`,
    );
  }

  const d = PC_EMBEDDING_DIM;
  const M = n - d + 1;
  const m1 = Math.floor(M / 2);
  const m2 = M - m1;

  // Build embedded matrix V (M x 3).
  const V: number[][] = new Array(M);
  for (let t = 0; t < M; t += 1) {
    V[t] = [values[t]!, values[t + 1]!, values[t + 2]!];
  }

  // Pooled centroid.
  let mp0 = 0;
  let mp1 = 0;
  let mp2 = 0;
  for (let t = 0; t < M; t += 1) {
    mp0 += V[t]![0]!;
    mp1 += V[t]![1]!;
    mp2 += V[t]![2]!;
  }
  mp0 /= M;
  mp1 /= M;
  mp2 /= M;
  const muPool = [mp0, mp1, mp2];

  // Pooled covariance C = (1/M) * V_c^T V_c.
  let c00 = 0;
  let c01 = 0;
  let c02 = 0;
  let c11 = 0;
  let c12 = 0;
  let c22 = 0;
  for (let t = 0; t < M; t += 1) {
    const a0 = V[t]![0]! - mp0;
    const a1 = V[t]![1]! - mp1;
    const a2 = V[t]![2]! - mp2;
    c00 += a0 * a0;
    c01 += a0 * a1;
    c02 += a0 * a2;
    c11 += a1 * a1;
    c12 += a1 * a2;
    c22 += a2 * a2;
  }
  c00 /= M;
  c01 /= M;
  c02 /= M;
  c11 /= M;
  c12 /= M;
  c22 /= M;

  const { eigenvalues, eigenvectors } = symmetric3x3Eigendecomp(
    c00,
    c01,
    c02,
    c11,
    c12,
    c22,
  );
  // Numerical floor at 0 (PSD).
  for (let i = 0; i < 3; i += 1) {
    if (eigenvalues[i]! < 0) eigenvalues[i] = 0;
  }
  const lam1 = eigenvalues[0]!;
  if (!(lam1 > 0) || !Number.isFinite(lam1)) {
    throw new Error(
      `dailyTokenPcaProjectionDistanceHalves: zero leading eigenvalue (lam1=${lam1})`,
    );
  }
  const traceL = eigenvalues[0]! + eigenvalues[1]! + eigenvalues[2]!;
  const pcVarExplained1 = lam1 / traceL;
  const pcVarExplained2 = (eigenvalues[0]! + eigenvalues[1]!) / traceL;

  // Half centroids.
  let aA0 = 0;
  let aA1 = 0;
  let aA2 = 0;
  for (let t = 0; t < m1; t += 1) {
    aA0 += V[t]![0]!;
    aA1 += V[t]![1]!;
    aA2 += V[t]![2]!;
  }
  aA0 /= m1;
  aA1 /= m1;
  aA2 /= m1;
  let bB0 = 0;
  let bB1 = 0;
  let bB2 = 0;
  for (let t = m1; t < M; t += 1) {
    bB0 += V[t]![0]!;
    bB1 += V[t]![1]!;
    bB2 += V[t]![2]!;
  }
  bB0 /= m2;
  bB1 /= m2;
  bB2 /= m2;

  const u1 = eigenvectors[0]!;
  // s_A = u1 . (mu_A - mu_pool); s_B = u1 . (mu_B - mu_pool)
  const dA0 = aA0 - mp0;
  const dA1 = aA1 - mp1;
  const dA2 = aA2 - mp2;
  const dB0 = bB0 - mp0;
  const dB1 = bB1 - mp1;
  const dB2 = bB2 - mp2;
  const pcSA = u1[0]! * dA0 + u1[1]! * dA1 + u1[2]! * dA2;
  const pcSB = u1[0]! * dB0 + u1[1]! * dB1 + u1[2]! * dB2;
  const pcGap = pcSB - pcSA;
  const sqrtLam1 = Math.sqrt(lam1);
  const pcZ = pcGap / sqrtLam1;
  const pcT = ((m1 * m2) / (m1 + m2)) * pcZ * pcZ;

  // Per-PC gap (mu_B - mu_A projected on u_i).
  const gap0 = bB0 - aA0;
  const gap1 = bB1 - aA1;
  const gap2 = bB2 - aA2;
  const pcGapByAxis: number[] = new Array(3);
  const pcStdGapByAxis: number[] = new Array(3);
  for (let i = 0; i < 3; i += 1) {
    const ui = eigenvectors[i]!;
    const g = ui[0]! * gap0 + ui[1]! * gap1 + ui[2]! * gap2;
    pcGapByAxis[i] = g;
    const lam = eigenvalues[i]!;
    pcStdGapByAxis[i] = lam > 0 ? g / Math.sqrt(lam) : 0;
  }

  if (
    !Number.isFinite(pcZ) ||
    !Number.isFinite(pcT) ||
    !Number.isFinite(pcGap) ||
    !Number.isFinite(pcVarExplained1)
  ) {
    throw new Error(
      `dailyTokenPcaProjectionDistanceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    pcM: M,
    pcM1: m1,
    pcM2: m2,
    pcEigenvalues: eigenvalues,
    pcVarExplained1,
    pcVarExplained2,
    pcU1: u1,
    pcSA,
    pcSB,
    pcGap,
    pcZ,
    pcT,
    pcGapByAxis,
    pcStdGapByAxis,
  };
  // Unused helper reference so muPool is observable by name.
  void muPool;
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

export function buildDailyTokenPcaProjectionDistanceHalves(
  queue: QueueLine[],
  opts: DailyTokenPcaProjectionDistanceHalvesOptions = {},
): DailyTokenPcaProjectionDistanceHalvesReport {
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
  const sort: DailyTokenPcaProjectionDistanceHalvesSort = opts.sort ?? 'pcTDesc';
  const validSorts: DailyTokenPcaProjectionDistanceHalvesSort[] = [
    'pcT',
    'pcTDesc',
    'pcZ',
    'pcZDesc',
    'pcZAbs',
    'pcZAbsDesc',
    'pcVarExplained1',
    'pcVarExplained1Desc',
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
  const rows: DailyTokenPcaProjectionDistanceHalvesSourceRow[] = [];

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
      result = dailyTokenPcaProjectionDistanceHalves(filled);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('zero leading eigenvalue') || msg.includes('zero centred variance')) {
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
      pcM: result.pcM,
      pcM1: result.pcM1,
      pcM2: result.pcM2,
      pcEigenvalues: result.pcEigenvalues,
      pcVarExplained1: result.pcVarExplained1,
      pcVarExplained2: result.pcVarExplained2,
      pcU1: result.pcU1,
      pcSA: result.pcSA,
      pcSB: result.pcSB,
      pcGap: result.pcGap,
      pcZ: result.pcZ,
      pcT: result.pcT,
      pcGapByAxis: result.pcGapByAxis,
      pcStdGapByAxis: result.pcStdGapByAxis,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'pcT':
        primary = a.pcT - b.pcT;
        break;
      case 'pcTDesc':
        primary = b.pcT - a.pcT;
        break;
      case 'pcZ':
        primary = a.pcZ - b.pcZ;
        break;
      case 'pcZDesc':
        primary = b.pcZ - a.pcZ;
        break;
      case 'pcZAbs':
        primary = Math.abs(a.pcZ) - Math.abs(b.pcZ);
        break;
      case 'pcZAbsDesc':
        primary = Math.abs(b.pcZ) - Math.abs(a.pcZ);
        break;
      case 'pcVarExplained1':
        primary = a.pcVarExplained1 - b.pcVarExplained1;
        break;
      case 'pcVarExplained1Desc':
        primary = b.pcVarExplained1 - a.pcVarExplained1;
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
    embeddingDim: PC_EMBEDDING_DIM,
    embeddingLag: PC_EMBEDDING_LAG,
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
