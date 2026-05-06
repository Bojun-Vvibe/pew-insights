/**
 * daily-token-liu-yamada-sugiyama-rulsif-density-ratio-changepoint:
 * per-source LIU-YAMADA-COLLIER-SUGIYAMA (2013) RuLSIF
 * (Relative unconstrained Least-Squares Importance Fitting)
 * relative density-ratio changepoint detector applied
 * retrospectively to the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-THIRTY-FOURTH cross-source axis (axis-234).
 *
 * Mechanism. Liu, Yamada, Collier & Sugiyama (2013)
 * "Change-Point Detection in Time-Series Data by Relative
 * Density-Ratio Estimation", Neural Networks 43:72-83
 * propose to detect changepoints by a SCAN of an estimated
 * RELATIVE DENSITY RATIO between pre- and post-window
 * empirical distributions. Unlike all prior 233 axes which
 * compare moments (CUSUM/PH/MOSUM/SNHT), CDFs (Pettitt/
 * Lombard/Inoue), spectra (Picard-Aue), subspaces (SSA),
 * kernel-mean-embeddings (NEWMA), or pairwise energies
 * (E-divisive), RuLSIF estimates the function
 *
 *   r_alpha(x) = p_post(x) / (alpha * p_post(x) + (1-alpha) * p_pre(x))   (1)
 *
 * directly via L2-penalised least-squares in a Gaussian
 * kernel basis -- this is a DENSITY RATIO, not a density,
 * not a CDF, not a moment. The relativisation by alpha in
 * (1) bounds r_alpha by 1/alpha, giving FINITE second
 * moments under heavy tails (whereas the pure ratio
 * p_post/p_pre is unbounded and statistically unstable).
 *
 * For each candidate split t in [w, N-w]:
 *
 *   1. Form the two adjacent windows
 *        Y_pre  = (x_{t-w+1}, ..., x_t)
 *        Y_post = (x_{t+1},  ..., x_{t+w})
 *      both of length w.
 *
 *   2. Pick a kernel basis: B Gaussian centres c_1, ..., c_B
 *      drawn deterministically as the equally-spaced
 *      quantiles of Y_post (so the model has support where
 *      the post-distribution does). Bandwidth sigmaKernel =
 *      median pairwise distance over Y_post (the "median
 *      heuristic" of Garreau-Jitkrittum-Kanagawa 2018).
 *
 *   3. Build the basis matrices
 *        Phi_pre[i,j]  = K_sigmaKernel(Y_pre[i],  c_j)
 *        Phi_post[i,j] = K_sigmaKernel(Y_post[i], c_j)
 *      with K(x,c) = exp(-(x-c)^2 / (2 sigmaKernel^2)).
 *
 *   4. Solve the L2-penalised RuLSIF normal equations
 *        H = (alpha/w) Phi_post^T Phi_post +
 *            ((1-alpha)/w) Phi_pre^T Phi_pre +
 *            lambda * I_B                                       (2)
 *        h = (1/w) Phi_post^T 1_w
 *        theta = H^{-1} h                                        (3)
 *
 *      via Cholesky decomposition of H (which is SPD by
 *      construction since lambda > 0). theta in R^B encodes
 *      the basis-coefficients of r_alpha.
 *
 *   5. Compute the SYMMETRIC PEARSON DIVERGENCE estimator
 *      (Yamada-Suzuki-Kanamori-Hachiya-Sugiyama 2013 §3.2;
 *      Liu-Yamada-Collier-Sugiyama 2013 eq. 11)
 *
 *        peStar(t) = -0.5 * theta^T (alpha/w Phi_post^T Phi_post
 *                     + (1-alpha)/w Phi_pre^T Phi_pre) theta
 *                   + theta^T h - 0.5                           (4)
 *
 *      which is a RAO-BLACKWELLISED estimator of the
 *      Pearson alpha-relative divergence
 *        PE_alpha(p_post || p_pre) = 0.5 * E_{r_alpha}[r_alpha] - 0.5.
 *
 *   6. Symmetrise by also swapping the role of pre and post
 *      and averaging:
 *        S(t) = 0.5 * ( peStar_post_vs_pre(t) +
 *                       peStar_pre_vs_post(t) )                  (5)
 *
 *      The symmetric statistic S(t) >= 0 is the change-point
 *      score at t. Argmax over t is tauStar.
 *
 * THRESHOLD. Liu-Yamada-Sugiyama 2013 §4 use a permutation
 * threshold; we expose a USER-TUNABLE thresholdScale on the
 * standardised score
 *
 *   peakRatio = max_t S(t) / ( median_t S(t) + 1e-12 )           (6)
 *
 * with default thresholdScale = 3.0 (i.e. peakRatio > 3 is a
 * "shift", > 6 is "strong-shift"). The median normaliser is a
 * robust scale that adapts to the noise floor of S without
 * needing the asymptotic null distribution of RuLSIF (which
 * has no closed form).
 *
 * MULTIPLE CHANGEPOINTS. We emit the GLOBAL ARGMAX (single
 * tauStar) plus all SECONDARY local maxima of S(t) above
 * thresholdScale * median(S) and at least w apart from any
 * already-accepted CP (greedy descending-magnitude pick).
 *
 * Defaults: windowFrac=0.18 (so w=max(8, floor(0.18 N))),
 * alpha=0.10 (Liu-Yamada-Sugiyama 2013 recommended), B=8
 * basis centres, lambda=0.01 (L2 regulariser), thresholdScale=3.0.
 *
 * ORTHOGONALITY (axis-234 vs axes 153, 221-233). RuLSIF
 * occupies a UNIQUE niche along five INDEPENDENT dimensions:
 *
 *   1. ESTIMATED FUNCTIONAL OBJECT. axis-234 estimates the
 *      DENSITY RATIO p_post/p_pre (relativised). Every prior
 *      axis estimates a DIFFERENT object:
 *        - moments (axes 153, 221, 222, 232, 233 mean;
 *                   223, 224 variance);
 *        - CDFs (axis-153 CUSUM-Brownian-bridge,
 *                axis-221 Alexandersson-SNHT,
 *                axis-222 Lombard-rank-CUSUM,
 *                axis-231 Inoue empirical-copula);
 *        - posteriors (axis-227 BOCPD);
 *        - spectra (axis-229 Picard-Aue);
 *        - subspaces (axis-228 Moskvina-Zhigljavsky SSA);
 *        - mean-embeddings (axis-230 Keriven NEWMA);
 *        - pairwise energies (axis-226 Matteson-James ECP);
 *        - DP costs (axis-224 Killick-PELT, axis-225 WBS).
 *      Density-RATIO is structurally distinct from all of
 *      them.
 *
 *   2. ALPHA-RELATIVISATION. The RELATIVE density ratio
 *      r_alpha = p_post / (alpha p_post + (1-alpha) p_pre)
 *      bounds r_alpha by 1/alpha. No prior axis applies any
 *      such relativisation; all prior moment-/CDF-based
 *      statistics are naturally bounded but at the cost of
 *      coarser sensitivity. RuLSIF's alpha knob is a
 *      structural parameter absent everywhere else.
 *
 *   3. KERNEL BASIS WITH MEDIAN-HEURISTIC BANDWIDTH +
 *      ANALYTICAL CHOLESKY SOLVE. This is the only axis that
 *      solves a linear system in a kernel-basis (axis-230
 *      NEWMA uses a kernel mean embedding but with a streaming
 *      EWMA, no system solve; axis-226 ECP uses pairwise
 *      energies, no kernel basis). The Cholesky on a B x B
 *      SPD H matrix gives an exact closed-form solution.
 *
 *   4. SYMMETRISED PEARSON ALPHA-DIVERGENCE STATISTIC. The
 *      PE_alpha(p||q) + PE_alpha(q||p) symmetrisation in (5)
 *      is unique to density-ratio scoring. No prior axis
 *      averages two directional divergences (axis-226 ECP
 *      uses an INHERENTLY symmetric energy distance, not a
 *      symmetrised pair).
 *
 *   5. ROBUST MEDIAN-NORMALISED PEAKRATIO. The score
 *      threshold (6) divides by median_t S(t), an INTERNAL
 *      ROBUST NULL CALIBRATION. Axis-232 PH and axis-233
 *      MOSUM also use robust scales but they are EXTERNAL
 *      (MAD on first differences) -- RuLSIF's median is taken
 *      OVER THE SCAN ITSELF, giving an adaptive scale that
 *      automatically tracks the noise floor of the chosen
 *      window/kernel/lambda.
 *
 * NUMERICAL NOTE. With B = 8 and Cholesky O(B^3) = O(512)
 * per candidate split, the total cost for N <= a few thousand
 * is acceptable. The symmetrisation doubles the work.
 *
 * Output schema (per-source row):
 *
 *   - peStarMax       max_t S(t) (5)
 *   - peStarArgmax    argmax t (1-indexed in [w, N-w])
 *   - peStarArgmaxDay ISO YYYY-MM-DD
 *   - peStarMedian    median_t S(t) (robust noise floor)
 *   - peakRatio       peStarMax / peStarMedian (6)
 *   - mChangepoints   number of CPs surviving threshold + w-spacing
 *   - tauStarDays     CP days (chronological)
 *   - windowW         w actually used
 *   - alphaUsed       alpha actually used
 *   - sigmaKernelUsed median-heuristic kernel bandwidth
 *   - verdict         peakRatio < 1.5 no-shift, < 3.0 borderline,
 *                     < 6.0 shift, otherwise strong-shift
 *
 * Refs:
 *   Liu, S., Yamada, M., Collier, N. & Sugiyama, M., 2013,
 *     "Change-Point Detection in Time-Series Data by
 *     Relative Density-Ratio Estimation",
 *     Neural Networks 43:72-83.
 *   Yamada, M., Suzuki, T., Kanamori, T., Hachiya, H. &
 *     Sugiyama, M., 2013, "Relative Density-Ratio
 *     Estimation for Robust Distribution Comparison",
 *     Neural Computation 25(5):1324-1370.
 *   Garreau, D., Jitkrittum, W. & Kanagawa, M., 2018,
 *     "Large sample analysis of the median heuristic",
 *     arXiv:1707.07269.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. NUMERIC HELPERS
// =========================================================

function sortedAsc(xs: readonly number[]): number[] {
  const c = xs.slice();
  c.sort((a, b) => a - b);
  return c;
}

/** Median of a numeric vector via ascending sort. */
export function median(xs: readonly number[]): number {
  const n = xs.length;
  if (n === 0) return Number.NaN;
  const s = sortedAsc(xs);
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid]! : 0.5 * (s[mid - 1]! + s[mid]!);
}

/**
 * Median pairwise distance, the "median heuristic" of
 * Garreau-Jitkrittum-Kanagawa 2018 for choosing a Gaussian
 * kernel bandwidth on a univariate sample.
 */
export function medianPairwiseDist(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return Number.NaN;
  const dists: number[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      dists.push(Math.abs(xs[i]! - xs[j]!));
    }
  }
  return median(dists);
}

/**
 * Equally-spaced quantiles of a sample (B centres at
 * (j + 0.5) / B for j in 0..B-1), via linear interpolation
 * on the sorted vector.
 */
export function equalSpacedQuantiles(xs: readonly number[], B: number): number[] {
  const n = xs.length;
  if (n === 0) throw new Error('equalSpacedQuantiles requires n >= 1');
  if (!Number.isInteger(B) || B < 1) {
    throw new Error(`B must be integer >= 1 (got ${B})`);
  }
  const s = sortedAsc(xs);
  const out: number[] = new Array(B);
  for (let j = 0; j < B; j += 1) {
    const p = (j + 0.5) / B;
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      out[j] = s[lo]!;
    } else {
      const w = idx - lo;
      out[j] = s[lo]! * (1 - w) + s[hi]! * w;
    }
  }
  return out;
}

// =========================================================
// SECTION 2. CHOLESKY-BASED LINEAR SOLVE (B x B SPD)
// =========================================================

/**
 * Cholesky decomposition of an SPD matrix in row-major flat
 * form (length B*B). Returns lower-triangular L (also flat,
 * length B*B; upper triangle zeroed). Throws on non-SPD.
 */
export function choleskyDecompose(A: readonly number[], B: number): number[] {
  if (A.length !== B * B) {
    throw new Error(`Cholesky: matrix length ${A.length} != B*B = ${B * B}`);
  }
  const L = new Array<number>(B * B).fill(0);
  for (let i = 0; i < B; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = A[i * B + j]!;
      for (let k = 0; k < j; k += 1) {
        s -= L[i * B + k]! * L[j * B + k]!;
      }
      if (i === j) {
        if (s <= 0 || !Number.isFinite(s)) {
          throw new Error(
            `Cholesky: matrix not SPD at diagonal ${i} (got ${s})`,
          );
        }
        L[i * B + j] = Math.sqrt(s);
      } else {
        const ljj = L[j * B + j]!;
        if (ljj === 0 || !Number.isFinite(ljj)) {
          throw new Error(`Cholesky: zero diagonal at ${j}`);
        }
        L[i * B + j] = s / ljj;
      }
    }
  }
  return L;
}

/** Solve L y = b (forward substitution), L lower triangular. */
export function forwardSubstitute(L: readonly number[], b: readonly number[], B: number): number[] {
  const y = new Array<number>(B).fill(0);
  for (let i = 0; i < B; i += 1) {
    let s = b[i]!;
    for (let k = 0; k < i; k += 1) s -= L[i * B + k]! * y[k]!;
    const lii = L[i * B + i]!;
    if (lii === 0) throw new Error(`forwardSubstitute: zero diagonal at ${i}`);
    y[i] = s / lii;
  }
  return y;
}

/** Solve L^T x = y (back substitution), L lower triangular. */
export function backSubstituteTranspose(L: readonly number[], y: readonly number[], B: number): number[] {
  const x = new Array<number>(B).fill(0);
  for (let i = B - 1; i >= 0; i -= 1) {
    let s = y[i]!;
    for (let k = i + 1; k < B; k += 1) s -= L[k * B + i]! * x[k]!;
    const lii = L[i * B + i]!;
    if (lii === 0) throw new Error(`backSubstituteTranspose: zero diagonal at ${i}`);
    x[i] = s / lii;
  }
  return x;
}

/** Solve A x = b for SPD A in flat row-major B*B form. */
export function spdSolve(A: readonly number[], b: readonly number[], B: number): number[] {
  const L = choleskyDecompose(A, B);
  const y = forwardSubstitute(L, b, B);
  return backSubstituteTranspose(L, y, B);
}

// =========================================================
// SECTION 3. RuLSIF CORE
// =========================================================

export interface RulsifScoreOptions {
  /** Relative density-ratio mixing parameter alpha in [0, 1). Default 0.10. */
  alpha?: number;
  /** Number of Gaussian basis centres B >= 2. Default 8. */
  basisCount?: number;
  /** L2 ridge regulariser lambda > 0. Default 0.01. */
  lambdaRidge?: number;
}

/**
 * One-sided RuLSIF symmetric Pearson-divergence estimate
 * peStar between two equal-length windows yPre and yPost
 * via (2)-(4). yPre and yPost must have the same length
 * w >= 4.
 */
export function rulsifPeStarOneSided(
  yPre: readonly number[],
  yPost: readonly number[],
  opts: RulsifScoreOptions = {},
): number {
  const w = yPre.length;
  if (yPost.length !== w) {
    throw new Error(
      `rulsifPeStarOneSided: window length mismatch (${yPre.length} vs ${yPost.length})`,
    );
  }
  if (w < 4) throw new Error(`rulsifPeStarOneSided: w must be >= 4 (got ${w})`);
  const alpha = opts.alpha ?? 0.1;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha >= 1) {
    throw new Error(`alpha must be in [0, 1) (got ${alpha})`);
  }
  const B = opts.basisCount ?? 8;
  if (!Number.isInteger(B) || B < 2) {
    throw new Error(`basisCount must be integer >= 2 (got ${B})`);
  }
  const lambdaRidge = opts.lambdaRidge ?? 0.01;
  if (!Number.isFinite(lambdaRidge) || lambdaRidge <= 0) {
    throw new Error(`lambdaRidge must be > 0 (got ${lambdaRidge})`);
  }
  // Choose B kernel centres from yPost (the numerator distribution).
  const centres = equalSpacedQuantiles(yPost, B);
  // Median-heuristic kernel bandwidth on yPost.
  let sigmaKernel = medianPairwiseDist(yPost);
  if (!Number.isFinite(sigmaKernel) || sigmaKernel <= 0) {
    // Fall back to MAD-style scale on yPost.
    const m = median(yPost);
    const dev = yPost.map((v) => Math.abs(v - m));
    sigmaKernel = median(dev);
  }
  if (!Number.isFinite(sigmaKernel) || sigmaKernel <= 0) {
    // Final fallback: range-based.
    let mn = yPost[0]!;
    let mx = yPost[0]!;
    for (const v of yPost) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    sigmaKernel = Math.max(1e-9, (mx - mn) / 4);
  }
  // Build Phi_pre (w x B) and Phi_post (w x B) in flat row-major.
  const phiPre = new Array<number>(w * B);
  const phiPost = new Array<number>(w * B);
  const inv2s2 = 1 / (2 * sigmaKernel * sigmaKernel);
  for (let i = 0; i < w; i += 1) {
    for (let j = 0; j < B; j += 1) {
      const dPre = yPre[i]! - centres[j]!;
      const dPost = yPost[i]! - centres[j]!;
      phiPre[i * B + j] = Math.exp(-dPre * dPre * inv2s2);
      phiPost[i * B + j] = Math.exp(-dPost * dPost * inv2s2);
    }
  }
  // H = (alpha/w) Phi_post^T Phi_post + ((1-alpha)/w) Phi_pre^T Phi_pre + lambda I
  // h = (1/w) Phi_post^T 1
  const H = new Array<number>(B * B).fill(0);
  const h = new Array<number>(B).fill(0);
  for (let a = 0; a < B; a += 1) {
    for (let b = 0; b < B; b += 1) {
      let sPost = 0;
      let sPre = 0;
      for (let i = 0; i < w; i += 1) {
        sPost += phiPost[i * B + a]! * phiPost[i * B + b]!;
        sPre += phiPre[i * B + a]! * phiPre[i * B + b]!;
      }
      H[a * B + b] = (alpha / w) * sPost + ((1 - alpha) / w) * sPre;
    }
    H[a * B + a] = H[a * B + a]! + lambdaRidge;
    let sH = 0;
    for (let i = 0; i < w; i += 1) sH += phiPost[i * B + a]!;
    h[a] = sH / w;
  }
  // theta = H^{-1} h via Cholesky.
  const theta = spdSolve(H, h, B);
  // peStar = -0.5 * theta^T (H - lambda I) theta + theta^T h - 0.5
  // (the lambda I cancels with the ridge in the divergence definition --
  //  Yamada-Suzuki-Kanamori-Hachiya-Sugiyama 2013 eq. 8)
  let quadH = 0;
  for (let a = 0; a < B; a += 1) {
    for (let b = 0; b < B; b += 1) {
      let coef = H[a * B + b]!;
      if (a === b) coef -= lambdaRidge;
      quadH += theta[a]! * coef * theta[b]!;
    }
  }
  let linH = 0;
  for (let a = 0; a < B; a += 1) linH += theta[a]! * h[a]!;
  return -0.5 * quadH + linH - 0.5;
}

/**
 * Symmetrised RuLSIF score S(t) per (5):
 *   S = 0.5 * ( peStar(post||pre) + peStar(pre||post) )
 *
 * Always >= 0 in expectation under H1 (a true distributional
 * change), and ~ 0 under H0.
 */
export function rulsifScoreSymmetric(
  yPre: readonly number[],
  yPost: readonly number[],
  opts: RulsifScoreOptions = {},
): number {
  const a = rulsifPeStarOneSided(yPre, yPost, opts);
  const b = rulsifPeStarOneSided(yPost, yPre, opts);
  return 0.5 * (a + b);
}

export interface RulsifScanOptions extends RulsifScoreOptions {
  /** Window half-length w = max(8, floor(windowFrac * N)). Default 0.18. */
  windowFrac?: number;
  /**
   * Decision threshold on peakRatio = max S / median S.
   * Default 3.0. Must be > 0.
   */
  thresholdScale?: number;
}

export interface RulsifScanResult {
  /** S(t) for t in [w, N-w]; length = N - 2w + 1. */
  scores: number[];
  /** max_t S(t). */
  peStarMax: number;
  /** argmax t (in original-series index space, i.e. split-point). */
  peStarArgmax: number;
  /** median_t S(t). */
  peStarMedian: number;
  /** peakRatio = peStarMax / max(peStarMedian, eps). */
  peakRatio: number;
  /** Window half-length w. */
  windowW: number;
  /** alpha actually used. */
  alphaUsed: number;
  /** Median-heuristic kernel bandwidth (averaged over scan). */
  sigmaKernelUsed: number;
  /** Threshold actually applied. */
  thresholdUsed: number;
  /** Local-max CPs surviving threshold + w-spacing rule, sorted asc. */
  changepoints: number[];
}

export function rulsifScan(x: readonly number[], opts: RulsifScanOptions = {}): RulsifScanResult {
  const N = x.length;
  if (N < 16) throw new Error(`rulsifScan requires N >= 16 (got ${N})`);
  const windowFrac = opts.windowFrac ?? 0.18;
  if (!Number.isFinite(windowFrac) || !(windowFrac > 0) || windowFrac >= 0.5) {
    throw new Error(`windowFrac must be in (0, 0.5) (got ${windowFrac})`);
  }
  const thresholdScale = opts.thresholdScale ?? 3.0;
  if (!Number.isFinite(thresholdScale) || !(thresholdScale > 0)) {
    throw new Error(`thresholdScale must be > 0 (got ${thresholdScale})`);
  }
  const w = Math.max(8, Math.floor(windowFrac * N));
  if (2 * w >= N) {
    throw new Error(`window w=${w} too large for N=${N} (require 2w < N)`);
  }
  const alpha = opts.alpha ?? 0.1;
  const M = N - 2 * w + 1;
  const scores = new Array<number>(M);
  let peStarMax = -Infinity;
  let peStarArgmax = w;
  let sigmaSum = 0;
  let sigmaCount = 0;
  for (let j = 0; j < M; j += 1) {
    const t = w + j; // 0-indexed split: pre = x[t-w..t-1], post = x[t..t+w-1].
    const yPre = x.slice(t - w, t);
    const yPost = x.slice(t, t + w);
    let s: number;
    try {
      s = rulsifScoreSymmetric(yPre, yPost, {
        alpha,
        basisCount: opts.basisCount,
        lambdaRidge: opts.lambdaRidge,
      });
      // Track sigma-heuristic on yPost for diagnostic reporting.
      const sig = medianPairwiseDist(yPost);
      if (Number.isFinite(sig) && sig > 0) {
        sigmaSum += sig;
        sigmaCount += 1;
      }
    } catch {
      s = 0;
    }
    if (!Number.isFinite(s)) s = 0;
    // Clamp tiny negative numerical noise: S is theoretically >= 0 in expectation.
    if (s < 0) s = 0;
    scores[j] = s;
    if (s > peStarMax) {
      peStarMax = s;
      peStarArgmax = t;
    }
  }
  const peStarMedian = median(scores);
  const denom = peStarMedian > 1e-12 ? peStarMedian : 1e-12;
  const peakRatio = peStarMax / denom;
  const sigmaKernelUsed = sigmaCount > 0 ? sigmaSum / sigmaCount : Number.NaN;
  // Local-max CP detection: scan scores for entries above
  // threshold = thresholdScale * peStarMedian, accept by greedy
  // descending-magnitude pick with w-spacing.
  const thresholdUsed = thresholdScale * denom;
  const candidates: { t: number; s: number }[] = [];
  for (let j = 0; j < M; j += 1) {
    if (scores[j]! > thresholdUsed) {
      // Local-max in +/- w window in j-space.
      let isLocalMax = true;
      const lo = Math.max(0, j - w);
      const hi = Math.min(M - 1, j + w);
      for (let l = lo; l <= hi; l += 1) {
        if (l === j) continue;
        if (scores[l]! > scores[j]!) {
          isLocalMax = false;
          break;
        }
      }
      if (isLocalMax) candidates.push({ t: w + j, s: scores[j]! });
    }
  }
  candidates.sort((a, b) => b.s - a.s);
  const accepted: number[] = [];
  for (const c of candidates) {
    let ok = true;
    for (const a of accepted) {
      if (Math.abs(c.t - a) < w) {
        ok = false;
        break;
      }
    }
    if (ok) accepted.push(c.t);
  }
  accepted.sort((a, b) => a - b);
  return {
    scores,
    peStarMax,
    peStarArgmax,
    peStarMedian,
    peakRatio,
    windowW: w,
    alphaUsed: alpha,
    sigmaKernelUsed,
    thresholdUsed,
    changepoints: accepted,
  };
}

export function rulsifVerdict(
  peakRatio: number,
): 'no-shift' | 'borderline' | 'shift' | 'strong-shift' {
  if (Number.isNaN(peakRatio)) return 'no-shift';
  if (peakRatio === Infinity) return 'strong-shift';
  if (peakRatio < 1.5) return 'no-shift';
  if (peakRatio < 3.0) return 'borderline';
  if (peakRatio < 6.0) return 'shift';
  return 'strong-shift';
}

// =========================================================
// SECTION 4. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSort =
  | 'peStarMax'
  | 'peStarMaxDesc'
  | 'peakRatio'
  | 'peakRatioDesc'
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSort;
  /** Window w = max(8, floor(windowFrac * N)). Default 0.18. */
  windowFrac?: number;
  /** Relative density-ratio alpha in [0, 1). Default 0.10. */
  alpha?: number;
  /** Number of Gaussian basis centres B >= 2. Default 8. */
  basisCount?: number;
  /** L2 ridge regulariser lambda > 0. Default 0.01. */
  lambdaRidge?: number;
  /** Threshold on peakRatio. Default 3.0. */
  thresholdScale?: number;
  onlyShifts?: boolean;
  generatedAt?: string;
}

export interface DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  windowW: number;
  alphaUsed: number;
  sigmaKernelUsed: number;
  thresholdUsed: number;
  peStarMax: number;
  peStarArgmax: number;
  peStarArgmaxDay: string;
  peStarMedian: number;
  mChangepoints: number;
  tauStarDays: string[];
  peakRatio: number;
  verdict: 'no-shift' | 'borderline' | 'shift' | 'strong-shift';
}

export interface DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSort;
  windowFrac: number;
  alpha: number;
  basisCount: number;
  lambdaRidge: number;
  thresholdScale: number;
  onlyShifts: boolean;
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
  sources: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSourceRow[];
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

export function buildDailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepoint(
  queue: QueueLine[],
  opts: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointOptions = {},
): DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative finite number (got ${opts.minTokens})`);
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(`minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be an integer >= 0 (got ${opts.top})`);
  }
  const sort: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSort =
    opts.sort ?? 'peakRatioDesc';
  const validSorts: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSort[] = [
    'peStarMax',
    'peStarMaxDesc',
    'peakRatio',
    'peakRatioDesc',
    'mChangepoints',
    'mChangepointsDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const windowFrac = opts.windowFrac ?? 0.18;
  if (!Number.isFinite(windowFrac) || !(windowFrac > 0) || windowFrac >= 0.5) {
    throw new Error(`windowFrac must be in (0, 0.5) finite (got ${opts.windowFrac})`);
  }
  const alpha = opts.alpha ?? 0.1;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha >= 1) {
    throw new Error(`alpha must be in [0, 1) (got ${opts.alpha})`);
  }
  const basisCount = opts.basisCount ?? 8;
  if (!Number.isInteger(basisCount) || basisCount < 2) {
    throw new Error(`basisCount must be integer >= 2 (got ${opts.basisCount})`);
  }
  const lambdaRidge = opts.lambdaRidge ?? 0.01;
  if (!Number.isFinite(lambdaRidge) || lambdaRidge <= 0) {
    throw new Error(`lambdaRidge must be > 0 finite (got ${opts.lambdaRidge})`);
  }
  const thresholdScale = opts.thresholdScale ?? 3.0;
  if (!Number.isFinite(thresholdScale) || !(thresholdScale > 0)) {
    throw new Error(`thresholdScale must be > 0 finite (got ${opts.thresholdScale})`);
  }
  const onlyShifts = opts.onlyShifts ?? false;
  if (typeof onlyShifts !== 'boolean') {
    throw new Error(`onlyShifts must be boolean (got ${opts.onlyShifts})`);
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
  const rows: DailyTokenLiuYamadaSugiyamaRulsifDensityRatioChangepointSourceRow[] = [];

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
    let scan: RulsifScanResult;
    try {
      scan = rulsifScan(filled, {
        windowFrac,
        alpha,
        basisCount,
        lambdaRidge,
        thresholdScale,
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(scan.peStarMax) ||
      !Number.isFinite(scan.peakRatio) ||
      !Number.isFinite(scan.peStarMedian)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const tauStarDays = scan.changepoints.map((k) => addUtcDays(acc.firstDay, k));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      windowW: scan.windowW,
      alphaUsed: scan.alphaUsed,
      sigmaKernelUsed: scan.sigmaKernelUsed,
      thresholdUsed: scan.thresholdUsed,
      peStarMax: scan.peStarMax,
      peStarArgmax: scan.peStarArgmax,
      peStarArgmaxDay: addUtcDays(acc.firstDay, scan.peStarArgmax),
      peStarMedian: scan.peStarMedian,
      mChangepoints: scan.changepoints.length,
      tauStarDays,
      peakRatio: scan.peakRatio,
      verdict: rulsifVerdict(scan.peakRatio),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'peStarMax':
        primary = a.peStarMax - b.peStarMax;
        break;
      case 'peStarMaxDesc':
        primary = b.peStarMax - a.peStarMax;
        break;
      case 'peakRatio':
        primary = a.peakRatio - b.peakRatio;
        break;
      case 'peakRatioDesc':
        primary = b.peakRatio - a.peakRatio;
        break;
      case 'mChangepoints':
        primary = a.mChangepoints - b.mChangepoints;
        break;
      case 'mChangepointsDesc':
        primary = b.mChangepoints - a.mChangepoints;
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
  if (onlyShifts) {
    kept = kept.filter((r) => r.verdict !== 'no-shift');
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
    windowFrac,
    alpha,
    basisCount,
    lambdaRidge,
    thresholdScale,
    onlyShifts,
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
