/**
 * daily-token-maximum-mean-discrepancy-halves: per-source
 * MAXIMUM MEAN DISCREPANCY TWO-SAMPLE TEST (Gretton et al.
 * 2012) with the GAUSSIAN RBF kernel comparing the
 * empirical distributions of the FIRST half vs SECOND
 * half of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-THIRD cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Let H be the Reproducing Kernel Hilbert Space (RKHS)
 * induced by the Gaussian RBF kernel
 *
 *     k(x, y)  =  exp( - (x - y)^2 / (2 * sigma^2) )
 *
 * with feature map phi: R -> H, k(x, y) = <phi(x), phi(y)>_H.
 * The mean embedding of distribution F is mu_F = E_{X~F}[phi(X)] in H.
 * The Maximum Mean Discrepancy (Gretton et al. 2006 NeurIPS;
 * Gretton et al. 2012 J. Mach. Learn. Res. 13:723-773) is
 *
 *     MMD^2(F_A, F_B)  =  || mu_A - mu_B ||_H^2
 *                      =  E[k(X, X')] + E[k(Y, Y')] - 2 * E[k(X, Y)]
 *
 * where X, X' iid ~ F_A and Y, Y' iid ~ F_B. The biased
 * V-statistic empirical estimator is
 *
 *     mmd2_V  =  (1 / n1^2)   * sum_{i, j} k(A_i, A_j)
 *             +  (1 / n2^2)   * sum_{i, j} k(B_i, B_j)
 *             -  (2 / (n1*n2)) * sum_{i, j} k(A_i, B_j)
 *
 * which is non-negative for the Gaussian kernel and
 * equals zero iff F_A = F_B (Gretton et al. 2012
 * Theorem 5: Gaussian kernel is CHARACTERISTIC, so the
 * mean embedding is INJECTIVE on the space of probability
 * measures). The unbiased U-statistic estimator is
 *
 *     mmd2_U  =  (1 / (n1*(n1-1))) * sum_{i != j} k(A_i, A_j)
 *             +  (1 / (n2*(n2-1))) * sum_{i != j} k(B_i, B_j)
 *             -  (2 / (n1*n2))     * sum_{i, j}    k(A_i, B_j)
 *
 * which is unbiased but can be negative for finite samples
 * (Gretton et al. 2012 Lemma 6). We report BOTH.
 *
 * Bandwidth selection: MEDIAN HEURISTIC. We set
 *
 *     sigma  =  sqrt( median( { (z_i - z_j)^2 : i < j } ) / 2 )
 *
 * over the pooled sample z = [A_0, ..., A_{n1-1}, B_0, ..., B_{n2-1}]
 * (Garreau, Jitkrittum, Kanagawa 2017 arXiv:1707.07269 §2;
 * Gretton et al. 2012 §8.2). This makes sigma scale with the
 * data so the kernel is neither saturated (k -> 1, MMD -> 0)
 * nor degenerate (k -> 0 except on diagonal, MMD trivial).
 * When the median squared pairwise distance is 0 (>= half the
 * pooled values are tied at the median), we fall back to the
 * pooled population variance.
 *
 * Test statistic. The canonical scaled MMD^2 statistic is
 *
 *     T_MMD  =  ( n1 * n2 / (n1 + n2) ) * mmd2_V
 *
 * which under H0 has a degenerate limiting distribution
 * (mixture of weighted chi-squared with kernel-eigenvalue
 * weights, Gretton et al. 2012 Theorem 12).
 *
 * Standardisation. The null distribution depends on F and
 * on the kernel. We standardise by
 *
 *     mmdZ  =  sqrt(mmd2_V) / pooledMad
 *
 * (mmd2_V is dimensionless once the kernel is fixed, but
 * its SCALE depends on sigma which scales with the data;
 * dividing by pooledMad in the original units gives a
 * cross-source-comparable EFFECT SIZE in robust-scale
 * units of the embedded RKHS distance per token of pooled
 * dispersion). mmdZ is NOT a hypothesis-test z-score
 * (the null distribution is not standard normal) but a
 * cross-source-comparable effect size.
 *
 * Sign convention. mmd2 is INTRINSICALLY UNSIGNED
 * (squared norm in H). To make the axis cross-comparable
 * with the signed halves tests (115/116/117/118) and the
 * unsigned-with-sign-flag axes 119/120/121/122, we report
 *
 *     mmdDir   =  sign( median(B) - median(A) )
 *     mmdZSigned  =  mmdDir * mmdZ
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-122:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-TEST
 *     in REPRODUCING-KERNEL HILBERT SPACE (RKHS).
 *     Sensitive to ANY distributional difference (location,
 *     scale, shape, tails) and is a proper METRIC on the
 *     space of probability measures via the injective
 *     mean embedding (Gretton et al. 2012 Theorem 5).
 *
 *   - vs axis-122 daily-token-energy-distance-halves.
 *     Energy distance E^2 = (1/pi) integral_R |phi_A - phi_B|^2 / t^2 dt
 *     is the L2 norm of the CHARACTERISTIC-FUNCTION GAP weighted
 *     by 1/t^2. MMD^2 with Gaussian kernel is the L2 norm of
 *     ( phi_A - phi_B ) weighted by exp(-sigma^2 * t^2 / 2)
 *     (Sriperumbudur et al. 2010 J. Mach. Learn. Res. 11:1517-1561,
 *     Theorem 23; equivalently Bochner's theorem applied to the
 *     RBF spectral density). The TWO WEIGHTING KERNELS are
 *     STRUCTURALLY DIFFERENT: 1/t^2 (energy) emphasises
 *     LOW frequencies and is itself non-integrable at 0
 *     (regularised by symmetry); exp(-sigma^2*t^2/2)
 *     (Gaussian RBF) emphasises a CHARACTERISTIC band of
 *     frequencies set by sigma, exponentially attenuating
 *     both very low and very high frequencies. They are
 *     NOT monotone images of each other; two distributions
 *     with identical energy distance can have very
 *     different MMD if their CF gap is concentrated at
 *     frequencies in vs outside the Gaussian band.
 *
 *   - vs axis-121 daily-token-wasserstein-one-halves.
 *     W1 lives in QUANTILE-INTEGRAL space. MMD lives in
 *     RKHS feature-embedding space. They are not monotone
 *     transforms.
 *
 *   - vs axis-120 daily-token-cramer-von-mises-halves.
 *     CvM = integral_R (F_A - F_B)^2 dH_N is the L2 norm of
 *     the CDF GAP in PROBABILITY space. MMD is the RKHS
 *     norm of the MEAN EMBEDDING GAP. The Gaussian kernel
 *     induces a SMOOTH feature map (infinite-dim Gaussian
 *     polynomial expansion via Mercer); CvM operates
 *     directly on raw CDF values.
 *
 *   - vs axis-119 daily-token-anderson-darling-halves.
 *     AD weights the squared CDF gap by 1/(H_N(1-H_N))
 *     in PROBABILITY space, blowing up at the tails.
 *     MMD with Gaussian kernel applies an exponential
 *     bandpass at scale sigma in FEATURE space.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS is L_infinity sup of CDF gap in support space.
 *     MMD is L2 of mean embedding gap in RKHS. Two halves
 *     with identical KS but very different MMD emerge
 *     when one has a single localised CDF jump (small
 *     contribution from the Gaussian-bandpass-attenuated
 *     high-frequency CF content) vs many small jumps
 *     spread across the support (large in-band MMD).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is RANK-SUM on outward-pair ranks
 *     after median-centring, sensitive ONLY to scale.
 *     MMD detects scale among other things via the RKHS
 *     mean-embedding distance.
 *
 *   - vs axes 115/116. Mann-Whitney is location /
 *     stochastic-dominance; Brown-Forsythe is parametric
 *     scale F-test. MMD detects ANY shift via RKHS.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Permutation-invariant functionals on
 *     the WHOLE series. MMD is permutation-invariant
 *     within each half but depends on WHICH half each
 *     value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), how large is the squared RKHS distance
 *   between the kernel mean embeddings of the two
 *   half-distributions under the Gaussian kernel with
 *   median-heuristic bandwidth, and how does that compare
 *   with the pooled robust scale?"**
 *
 * Reference:
 *   Gretton, A., Borgwardt, K. M., Rasch, M., Scholkopf, B.,
 *     and Smola, A., "A kernel two-sample test", Journal
 *     of Machine Learning Research 13 (2012), pp. 723-773.
 *   Sriperumbudur, B. K., Gretton, A., Fukumizu, K.,
 *     Scholkopf, B., and Lanckriet, G. R. G., "Hilbert
 *     space embeddings and metrics on probability
 *     measures", Journal of Machine Learning Research 11
 *     (2010), pp. 1517-1561.
 *   Garreau, D., Jitkrittum, W., and Kanagawa, M., "Large
 *     sample analysis of the median heuristic", arXiv
 *     preprint arXiv:1707.07269 (2017).
 *
 * Caveats:
 *
 *   - mmd2_V in [0, 1] (Gaussian kernel bounded by 1).
 *     mmd2_U in [-1, 1] for finite samples (can be slightly
 *     negative; clipped to 0 for sqrt downstream is NOT
 *     done since we report mmdZ from V-stat).
 *     T_MMD in [0, +inf) (scaled).
 *     mmdZ in [0, +inf) dimensionless effect size.
 *     mmdZSigned in (-inf, +inf).
 *   - mmdZ is NOT a hypothesis-test z-score; the null
 *     distribution of T_MMD depends on F and the kernel.
 *     It is a CROSS-SOURCE-COMPARABLE EFFECT SIZE.
 *   - Bandwidth sigma is data-dependent (median heuristic),
 *     so two sources with identical mmd2_V values may
 *     reflect different effective bandwidths. The pooledMad
 *     normalisation partially corrects for this.
 *   - When the median squared pairwise distance is 0 we
 *     fall back to pooled stddev for sigma; if both are 0
 *     the upstream zero-variance guard already filters.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115-122). Hard floor n >= 8.
 *   - Computational cost. O((n1 + n2)^2) for kernel matrix
 *     evaluation AND median-heuristic pairwise distance
 *     (uses a sort-based median over n*(n-1)/2 squared
 *     distances = O(n^2 log n) worst case, but n is at
 *     most a few thousand so this is comfortably interactive).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-maximum-mean-discrepancy-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-maximum-mean-discrepancy-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute MMD effect size desc:
 *   pew-insights daily-token-maximum-mean-discrepancy-halves \
 *     --sort mmdZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenMaximumMeanDiscrepancyHalvesSort =
  | 'mmd2V'
  | 'mmd2VDesc'
  | 'mmdT'
  | 'mmdTDesc'
  | 'mmdZ'
  | 'mmdZDesc'
  | 'mmdZSigned'
  | 'mmdZSignedDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMaximumMeanDiscrepancyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (asymptotic regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMaximumMeanDiscrepancyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMaximumMeanDiscrepancyHalvesSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  mmdN1: number;
  /** Second-half size n2 = n - n1. */
  mmdN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  mmdMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  mmdMedianB: number;
  /** Median of the pooled sample. */
  mmdPooledMedian: number;
  /** MAD/scale of the pooled sample about the pooled median. */
  mmdPooledMad: number;
  /** Median-heuristic Gaussian kernel bandwidth sigma. */
  mmdSigma: number;
  /** V-statistic (biased) MMD^2 estimator. */
  mmd2V: number;
  /** U-statistic (unbiased) MMD^2 estimator. */
  mmd2U: number;
  /** Scaled MMD^2 test statistic T_MMD = n1*n2/(n1+n2)*mmd2_V. */
  mmdT: number;
  /** Scale-normalised effect size sqrt(mmd2_V)/pooledMad. */
  mmdZ: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  mmdDir: number;
  /** Signed effect size: mmdDir * mmdZ. */
  mmdZSigned: number;
}

export interface DailyTokenMaximumMeanDiscrepancyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMaximumMeanDiscrepancyHalvesSort;
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
  sources: DailyTokenMaximumMeanDiscrepancyHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Robust pooled-dispersion scale for the dimensionless
 * effect size mmdZ. Mirrors axis-122 with the same
 * MAD-with-stddev-fallback pattern (Hampel 1974, JASA
 * 69(346):383-393).
 */
function pooledRobustScale(
  pooledSorted: number[],
  pooledMedian: number,
  stddev: number,
): { mad: number; scale: number } {
  const absDevSorted = pooledSorted
    .map((v) => Math.abs(v - pooledMedian))
    .sort((p, q) => p - q);
  const mad = medianSorted(absDevSorted);
  let scale = mad;
  if (scale === 0) scale = stddev;
  if (scale === 0) {
    throw new Error(
      `pooledRobustScale: both MAD and stddev are 0 (n=${pooledSorted.length})`,
    );
  }
  return { mad, scale };
}

/**
 * Median-heuristic bandwidth selection (Garreau,
 * Jitkrittum, Kanagawa 2017 §2; Gretton et al. 2012 §8.2).
 *
 *     sigma  =  sqrt( median( { (z_i - z_j)^2 : i < j } ) / 2 )
 *
 * Pooled sample z is sorted on input (the sort is
 * required by the caller for the median computation
 * downstream; we do not re-sort here). Returns
 * sigma > 0. When the median squared distance is 0
 * (>= half the pooled values tied at the median), falls
 * back to the pooled population stddev so the kernel is
 * not degenerate.
 *
 * Cost. O(m^2) for the m*(m-1)/2 squared distances plus
 * O(m^2 log m) for the sort. For pew tenures (m up to a
 * few thousand) this is comfortably interactive at
 * < 100 ms per source.
 *
 * Why divide by 2. The factor of 2 inside the sqrt
 * matches the kernel parameterisation
 * k(x, y) = exp( -(x-y)^2 / (2*sigma^2) ): plugging the
 * median squared distance med_sq into k gives
 * k = exp( -med_sq / (2*sigma^2) ) = exp(-1) when
 * sigma^2 = med_sq / 2, putting the median pair at the
 * kernel's natural decay point. (Garreau et al. 2017 §2
 * gives the same convention.)
 */
function medianHeuristicBandwidth(
  pooledSorted: number[],
  stddev: number,
): number {
  const m = pooledSorted.length;
  if (m < 2) {
    throw new Error(
      `medianHeuristicBandwidth: need at least 2 samples (got ${m})`,
    );
  }
  const sqdists: number[] = [];
  for (let i = 0; i < m; i += 1) {
    for (let j = i + 1; j < m; j += 1) {
      const d = pooledSorted[i]! - pooledSorted[j]!;
      sqdists.push(d * d);
    }
  }
  sqdists.sort((p, q) => p - q);
  const medSq = medianSorted(sqdists);
  let sigma = Math.sqrt(medSq / 2);
  if (sigma === 0) {
    // Fall back to stddev when median squared distance is 0.
    sigma = stddev;
  }
  if (sigma === 0 || !Number.isFinite(sigma)) {
    throw new Error(
      `medianHeuristicBandwidth: degenerate sigma=${sigma} (n=${m})`,
    );
  }
  return sigma;
}

/**
 * MMD V-statistic (biased) and U-statistic (unbiased)
 * estimators with Gaussian RBF kernel. Returns both.
 *
 *     mmd2_V = (1/n1^2)*K_AA_sum + (1/n2^2)*K_BB_sum
 *              - (2/(n1*n2))*K_AB_sum
 *     mmd2_U = (1/(n1*(n1-1)))*K_AA_offdiag + (1/(n2*(n2-1)))*K_BB_offdiag
 *              - (2/(n1*n2))*K_AB_sum
 *
 * O((n1 + n2)^2) kernel evaluations.
 */
function mmdGaussianEstimators(
  a: number[],
  b: number[],
  sigma: number,
): { mmd2V: number; mmd2U: number } {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) {
    throw new Error('mmdGaussianEstimators: need n1 >= 2 and n2 >= 2');
  }
  const twoSigSq = 2 * sigma * sigma;
  let kAA = 0;
  let kAAoff = 0;
  for (let i = 0; i < n1; i += 1) {
    for (let j = 0; j < n1; j += 1) {
      const d = a[i]! - a[j]!;
      const k = Math.exp(-(d * d) / twoSigSq);
      kAA += k;
      if (i !== j) kAAoff += k;
    }
  }
  let kBB = 0;
  let kBBoff = 0;
  for (let i = 0; i < n2; i += 1) {
    for (let j = 0; j < n2; j += 1) {
      const d = b[i]! - b[j]!;
      const k = Math.exp(-(d * d) / twoSigSq);
      kBB += k;
      if (i !== j) kBBoff += k;
    }
  }
  let kAB = 0;
  for (let i = 0; i < n1; i += 1) {
    for (let j = 0; j < n2; j += 1) {
      const d = a[i]! - b[j]!;
      kAB += Math.exp(-(d * d) / twoSigSq);
    }
  }
  const mmd2V =
    kAA / (n1 * n1) + kBB / (n2 * n2) - (2 * kAB) / (n1 * n2);
  const mmd2U =
    kAAoff / (n1 * (n1 - 1)) +
    kBBoff / (n2 * (n2 - 1)) -
    (2 * kAB) / (n1 * n2);
  return { mmd2V, mmd2U };
}

/**
 * MMD two-sample test on the first-half (A = x[0..n1-1])
 * vs second-half (B = x[n1..n-1]) of a real-valued series
 * with Gaussian RBF kernel, median-heuristic bandwidth.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - mmd2_V(x + c) === mmd2_V(x) for any constant c.
 *     Translating both halves identically leaves all
 *     pairwise differences (and hence the kernel values)
 *     unchanged.
 *   - mmd2_V(k*x) === mmd2_V(x) for any k != 0 because
 *     the median heuristic rescales sigma proportionally:
 *     sigma(k*x) = |k| * sigma(x), so the kernel
 *     k(k*x_i, k*x_j) = exp(-(k*x_i - k*x_j)^2 / (2*sigma(k*x)^2))
 *                     = exp(-k^2*(x_i-x_j)^2 / (2*k^2*sigma(x)^2))
 *                     = exp(-(x_i-x_j)^2 / (2*sigma(x)^2))
 *                     = k(x_i, x_j).
 *     Hence MMD with median-heuristic bandwidth is FULLY
 *     SCALE-INVARIANT (in contrast to energy distance
 *     axis-122 which is 1-homogeneous in the data).
 *   - mmd2_V in [0, 1] (Gaussian kernel bounded by 1).
 *   - Swapping the two halves leaves mmd2_V invariant
 *     and negates mmdDir.
 */
export function dailyTokenMaximumMeanDiscrepancyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  mmdN1: number;
  mmdN2: number;
  mmdMedianA: number;
  mmdMedianB: number;
  mmdPooledMedian: number;
  mmdPooledMad: number;
  mmdSigma: number;
  mmd2V: number;
  mmd2U: number;
  mmdT: number;
  mmdZ: number;
  mmdDir: number;
  mmdZSigned: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenMaximumMeanDiscrepancyHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenMaximumMeanDiscrepancyHalves requires finite values',
      );
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenMaximumMeanDiscrepancyHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aSorted = aRaw.slice().sort((p, q) => p - q);
  const bSorted = bRaw.slice().sort((p, q) => p - q);
  const mmdMedianA = medianSorted(aSorted);
  const mmdMedianB = medianSorted(bSorted);

  const pooledSorted = values.slice().sort((p, q) => p - q);
  const mmdPooledMedian = medianSorted(pooledSorted);
  const { scale: mmdPooledMad } = pooledRobustScale(
    pooledSorted,
    mmdPooledMedian,
    stddev,
  );

  const mmdSigma = medianHeuristicBandwidth(pooledSorted, stddev);
  const { mmd2V, mmd2U } = mmdGaussianEstimators(aRaw, bRaw, mmdSigma);

  // Numerical safety: theoretical V-stat floor is 0; clip
  // tiny negative roundoff so sqrt is real downstream.
  let mmd2Vsafe = mmd2V;
  if (mmd2Vsafe < 0 && mmd2Vsafe > -1e-10) mmd2Vsafe = 0;
  if (mmd2Vsafe < 0) {
    throw new Error(
      `dailyTokenMaximumMeanDiscrepancyHalves: negative mmd2_V=${mmd2V} (n=${n})`,
    );
  }

  const mmdT = ((n1 * n2) / (n1 + n2)) * mmd2Vsafe;
  const mmdZ = Math.sqrt(mmd2Vsafe) / mmdPooledMad;
  const mmdDir =
    mmdMedianB > mmdMedianA ? 1 : mmdMedianB < mmdMedianA ? -1 : 0;
  const mmdZSigned = mmdDir * mmdZ;

  if (
    !Number.isFinite(mmd2Vsafe) ||
    !Number.isFinite(mmd2U) ||
    !Number.isFinite(mmdT) ||
    !Number.isFinite(mmdZ) ||
    !Number.isFinite(mmdZSigned)
  ) {
    throw new Error(
      `dailyTokenMaximumMeanDiscrepancyHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mmdN1: n1,
    mmdN2: n2,
    mmdMedianA,
    mmdMedianB,
    mmdPooledMedian,
    mmdPooledMad,
    mmdSigma,
    mmd2V: mmd2Vsafe,
    mmd2U,
    mmdT,
    mmdZ,
    mmdDir,
    mmdZSigned,
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

export function buildDailyTokenMaximumMeanDiscrepancyHalves(
  queue: QueueLine[],
  opts: DailyTokenMaximumMeanDiscrepancyHalvesOptions = {},
): DailyTokenMaximumMeanDiscrepancyHalvesReport {
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
  const sort: DailyTokenMaximumMeanDiscrepancyHalvesSort =
    opts.sort ?? 'mmdTDesc';
  const validSorts: DailyTokenMaximumMeanDiscrepancyHalvesSort[] = [
    'mmd2V',
    'mmd2VDesc',
    'mmdT',
    'mmdTDesc',
    'mmdZ',
    'mmdZDesc',
    'mmdZSigned',
    'mmdZSignedDesc',
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
  const rows: DailyTokenMaximumMeanDiscrepancyHalvesSourceRow[] = [];

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
      result = dailyTokenMaximumMeanDiscrepancyHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenMaximumMeanDiscrepancyHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      mmdN1: result.mmdN1,
      mmdN2: result.mmdN2,
      mmdMedianA: result.mmdMedianA,
      mmdMedianB: result.mmdMedianB,
      mmdPooledMedian: result.mmdPooledMedian,
      mmdPooledMad: result.mmdPooledMad,
      mmdSigma: result.mmdSigma,
      mmd2V: result.mmd2V,
      mmd2U: result.mmd2U,
      mmdT: result.mmdT,
      mmdZ: result.mmdZ,
      mmdDir: result.mmdDir,
      mmdZSigned: result.mmdZSigned,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mmd2V':
        primary = a.mmd2V - b.mmd2V;
        break;
      case 'mmd2VDesc':
        primary = b.mmd2V - a.mmd2V;
        break;
      case 'mmdT':
        primary = a.mmdT - b.mmdT;
        break;
      case 'mmdTDesc':
        primary = b.mmdT - a.mmdT;
        break;
      case 'mmdZ':
        primary = a.mmdZ - b.mmdZ;
        break;
      case 'mmdZDesc':
        primary = b.mmdZ - a.mmdZ;
        break;
      case 'mmdZSigned':
        primary = a.mmdZSigned - b.mmdZSigned;
        break;
      case 'mmdZSignedDesc':
        primary = b.mmdZSigned - a.mmdZSigned;
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
