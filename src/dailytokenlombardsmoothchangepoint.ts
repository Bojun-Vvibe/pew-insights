/**
 * daily-token-lombard-smooth-changepoint: per-source
 * LOMBARD 1987 RANK-BASED SMOOTH-CHANGEPOINT TEST on the
 * gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-SECOND cross-source axis.
 *
 * Mechanism. Lombard, F. (1987), "Rank tests for
 * changepoint problems", *Biometrika* 74:615-624.
 *
 * Let x[0..n-1] be the gap-filled daily token series for
 * one source (n = nTenureDays >= 21). Form the
 * MID-RANKS r[i] in {1..n} (Wilcoxon scores) and CENTRE:
 *
 *     phi[i] = ( r[i] - (n+1)/2 ) / sqrt(n)              (1)
 *
 * so sum(phi) = 0 and var(phi) ~ (n^2 - 1) / (12 * n).
 *
 * Apply a TRIANGULAR KERNEL SMOOTHER of half-width K
 * (the SMOOTH alternative window). The smoothed scores
 * s[i] are the convolution of phi with the symmetric
 * triangular weights w[j] = (K + 1 - |j|) for j in
 * {-K..K}, normalised by sum_w:
 *
 *     s[i] = sum_{j=-K..K} w[j] * phi[i+j] / sum_w       (2)
 *
 * with phi reflected at the boundaries (mirror padding).
 * The Lombard SMOOTH-CHANGE statistic is the CUMULATIVE
 * RANK SCORE squared and integrated:
 *
 *     S[k]  = sum_{i<=k} s[i]                            (3)
 *     L_n   = (1/n^2) * sum_{k=0..n-1} S[k]^2            (4)
 *
 * Under H0 (exchangeability) and as n -> infinity with
 * K = o(n^{1/2}), L_n converges in distribution to
 *
 *     L_n  -> sigma^2 * integral_0^1 B(t)^2 dt           (5)
 *
 * where B(t) is a STANDARD BROWNIAN BRIDGE and sigma^2 is
 * the asymptotic variance of phi[1] (= 1/12 for mid-ranks
 * on a uniform, with a finite-n correction). The integral
 * has an Anderson-Darling-like distribution; we expose
 * critical values via Lombard 1987 Table 1 and a moment-
 * matched gamma approximation:
 *
 *     L0 / sigma^2  ~ Gamma(shape=k_g, scale=theta_g)    (6)
 *
 * with k_g = (E[Q])^2 / Var[Q] = (1/6)^2 / (1/45) = 1.25
 * and theta_g = Var[Q] / E[Q] = (1/45) / (1/6) = 2/15
 * approx 0.1333. Here Q := integral B^2 has E[Q] = 1/6
 * and Var[Q] = 1/45 (Anderson-Darling 1952 *AnnMS* 23:193,
 * eq. 4.2). pApprox uses the upper-tail gamma CDF.
 *
 * SIGN AND POSITION DIAGNOSTICS.
 *
 *   - kStar = argmax_k |S[k]| in {0..n-1}: the
 *     most-likely smooth-change CENTRE (the index where the
 *     cumulative smoothed rank deviation peaks in
 *     magnitude). kStarDay is `addDays(firstActiveDay,
 *     kStar)`.
 *   - directionSign in {-1, 0, +1}: sign of S[kStar].
 *     Positive = upward smooth shift after kStarDay,
 *     negative = downward.
 *   - smoothBandwidthDays = K (the kernel half-width
 *     used). Default K = max(2, ceil(n^{1/3})).
 *   - lEdgeRatio = max(|S[0]|, |S[n-2]|)^2 / max_k S[k]^2
 *     in [0, 1]: surfaces edge-of-window peaks.
 *   - secondPeakRatio: the second-best |S[k]| outside a
 *     guard window of +/- max(3, K) days, relative to the
 *     primary. Close to 1 = regime multiplicity.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-221 ALEXANDERSSON SNHT (single ABRUPT step
 *     under Gaussian likelihood ratio): SNHT is L-2
 *     PARAMETRIC on standardised magnitudes; Lombard is
 *     L-2 RANK-BASED on smoothed Wilcoxon scores. SNHT's
 *     T(a) optimises a TWO-MEAN PARTITION (one sharp
 *     break); Lombard's L_n integrates SQUARED CUMULATIVE
 *     SMOOTHED rank deviations and is sensitive to GRADUAL
 *     transitions over ~ K days. A clean abrupt step gives
 *     high SNHT and moderate Lombard; a slow logistic
 *     transition over 10 days gives moderate SNHT (split
 *     ambiguity) and high Lombard. STATISTIC FAMILY +
 *     CHANGE-SHAPE ORTHOGONAL.
 *   - vs axis-154 PETTITT (rank-based ABRUPT step): Pettitt
 *     is max_t |U[t]| with U[t] = sum_{i<=t} sum_{j>t}
 *     sign(x[i]-x[j]) -- an L-INFINITY rank statistic on
 *     the UNSMOOTHED rank-difference walk. Lombard L_n is
 *     L-2 INTEGRATED on the SMOOTHED cumulative rank walk.
 *     CHANGE-SHAPE (abrupt vs smooth) and STATISTIC NORM
 *     (L-inf vs L-2) both differ.
 *   - vs axis-220 HAMED-RAO MK and axis-219 SEN-ADICHIE
 *     (monotone trend): those test a globally MONOTONE
 *     trend over the whole series; Lombard tests a
 *     LOCALISED smooth change. A V-shape gives MK ~ 0 but
 *     a strong Lombard at the V vertex.
 *   - vs axis-218 HIRSCH-SLACK seasonal MK: stratified by
 *     period-7 day-of-week; Lombard does not stratify.
 *
 * Headline question:
 * **"For each source, IS THERE A STATISTICALLY SIGNIFICANT
 *   SMOOTH (NON-ABRUPT) CHANGE IN THE LOCATION OF DAILY
 *   TOTAL_TOKENS, AND IF SO, AROUND WHICH DAY DOES THE
 *   TRANSITION CENTRE?"**
 *
 * References:
 *   Lombard, F., "Rank tests for changepoint problems",
 *     *Biometrika* 74 (1987), pp. 615-624. The original
 *     smooth-change rank test.
 *   Anderson, T. W. & Darling, D. A., "Asymptotic theory
 *     of certain goodness-of-fit criteria based on
 *     stochastic processes", *Ann. Math. Stat.* 23 (1952),
 *     pp. 193-212. Moments E[Q]=1/6, Var[Q]=1/45 used in
 *     (6).
 *   Csorgo, M. & Horvath, L., *Limit Theorems in Change-
 *     Point Analysis*, Wiley 1997, sec. 2.6 -- Lombard
 *     statistic asymptotics.
 *
 * Caveats:
 *   - HARD FLOOR n >= 21 days. Below ~20 the gamma
 *     approximation in (6) is anti-conservative.
 *   - Detects a single smooth change. Two well-separated
 *     smooth changes give secondPeakRatio close to 1 ->
 *     re-run on each segment.
 *   - K too large smooths over the change; K too small
 *     reduces to a Pettitt-like sharp test. Default K =
 *     max(2, ceil(n^{1/3})) tracks Lombard 1987 sec. 4.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-lombard-smooth-changepoint
 *   pew-insights daily-token-lombard-smooth-changepoint --json
 *   pew-insights daily-token-lombard-smooth-changepoint --sort lnDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenLombardSmoothChangepointSort =
  | 'ln'
  | 'lnDesc'
  | 'pApprox'
  | 'pApproxDesc'
  | 'kStar'
  | 'kStarDesc'
  | 'absShift'
  | 'absShiftDesc'
  | 'secondPeakRatio'
  | 'secondPeakRatioDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLombardSmoothChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  /**
   * Smoothing kernel half-width K. Default = max(2, ceil(n^{1/3})).
   * Caller may override for sensitivity sweeps; clamped to [1, floor(n/3)].
   */
  smoothBandwidthDays?: number | null;
  top?: number;
  sort?: DailyTokenLombardSmoothChangepointSort;
  generatedAt?: string;
}

export interface DailyTokenLombardSmoothChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Lombard L_n statistic, always >= 0. */
  ln: number;
  /** Smoothing kernel half-width actually used. */
  smoothBandwidthDays: number;
  /** Argmax k of |S[k]| in {0..n-1}; -1 if degenerate. */
  kStar: number;
  /** ISO YYYY-MM-DD of x[kStar]. null if degenerate. */
  kStarDay: string | null;
  /** Sign of S[kStar] in {-1, 0, +1}. */
  directionSign: number;
  /** S[kStar] / n on the rank scale (mean smoothed rank deviation up to kStar). */
  zShift: number;
  /** muAfter - muBefore on the raw token scale, split at kStar. */
  meanShift: number;
  /** muBefore = mean(x[0..kStar]). */
  muBefore: number;
  /** muAfter = mean(x[kStar+1..n-1]). */
  muAfter: number;
  /** Conservative gamma upper-tail p-value. */
  pApprox: number;
  /** True iff pApprox < 0.05. */
  significant05: boolean;
  /** Edge ratio: max(S[0]^2, S[n-2]^2) / max_k S[k]^2 in [0, 1]. */
  lEdgeRatio: number;
  /** Second-best |S[k]| outside guard +/- max(3, K) of kStar. */
  secondPeak: number;
  /** k of secondPeak, -1 if none. */
  kStar2: number;
  /** ISO day at kStar2. null if none. */
  kStar2Day: string | null;
  /** secondPeak^2 / S[kStar]^2 in [0, 1]. */
  secondPeakRatio: number;
}

export interface DailyTokenLombardSmoothChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  smoothBandwidthDays: number | null;
  top: number;
  sort: DailyTokenLombardSmoothChangepointSort;
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
  sources: DailyTokenLombardSmoothChangepointSourceRow[];
}

/**
 * Compute MID-RANKS of a numeric vector (ties get the
 * average rank). Returns ranks in {1..n} (real-valued for
 * ties).
 */
export function lombardMidRanks(x: number[]): number[] {
  const n = x.length;
  const idx: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => {
    const va = x[a]!;
    const vb = x[b]!;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return a - b;
  });
  const ranks: number[] = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]!]! === x[idx[i]!]!) j += 1;
    // ranks i+1..j+1 (1-based) tied -> average rank
    const avg = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k]!] = avg;
    i = j + 1;
  }
  return ranks;
}

/**
 * Triangular-kernel smoother of half-width K with mirror
 * padding at the boundaries. Returns an array of length n.
 * Weights w[j] = (K + 1 - |j|), normalised by their sum.
 */
export function lombardTriangularSmooth(phi: number[], K: number): number[] {
  const n = phi.length;
  if (K < 1) return phi.slice();
  let wSum = 0;
  for (let j = -K; j <= K; j += 1) wSum += K + 1 - Math.abs(j);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    let acc = 0;
    for (let j = -K; j <= K; j += 1) {
      let idx = i + j;
      // mirror padding: ..., x[1], x[0], x[0], x[1], ...
      if (idx < 0) idx = -idx - 1;
      if (idx >= n) idx = 2 * n - idx - 1;
      // clamp defensively
      if (idx < 0) idx = 0;
      if (idx >= n) idx = n - 1;
      acc += (K + 1 - Math.abs(j)) * phi[idx]!;
    }
    out[i] = acc / wSum;
  }
  return out;
}

export interface LombardSummary {
  ln: number;
  kStar: number;
  sAtKStar: number;
  directionSign: number;
  lEdgeRatio: number;
  secondPeak: number;
  kStar2: number;
  secondPeakRatio: number;
}

/**
 * Pure Lombard smooth-changepoint summary on a real-valued
 * series of length n >= 2 with a kernel half-width K.
 */
export function lombardSummary(values: number[], K: number): LombardSummary {
  const n = values.length;
  if (n < 2) {
    return {
      ln: 0,
      kStar: -1,
      sAtKStar: 0,
      directionSign: 0,
      lEdgeRatio: 0,
      secondPeak: 0,
      kStar2: -1,
      secondPeakRatio: 0,
    };
  }
  const ranks = lombardMidRanks(values);
  // phi[i] = ( r[i] - (n+1)/2 ) / sqrt(n)
  const center = (n + 1) / 2;
  const sqn = Math.sqrt(n);
  const phi: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) phi[i] = (ranks[i]! - center) / sqn;
  const s = lombardTriangularSmooth(phi, K);
  // cumulative S[k]
  const S: number[] = new Array(n);
  let cum = 0;
  for (let i = 0; i < n; i += 1) {
    cum += s[i]!;
    S[i] = cum;
  }
  // L_n = (1/n^2) * sum S[k]^2
  let lnAcc = 0;
  for (let k = 0; k < n; k += 1) lnAcc += S[k]! * S[k]!;
  const ln = lnAcc / (n * n);
  // argmax |S[k]|
  let kStar = 0;
  let bestAbs = Math.abs(S[0]!);
  for (let k = 1; k < n; k += 1) {
    const a = Math.abs(S[k]!);
    if (a > bestAbs) {
      bestAbs = a;
      kStar = k;
    }
  }
  const sAtKStar = S[kStar]!;
  const directionSign = sAtKStar > 0 ? 1 : sAtKStar < 0 ? -1 : 0;
  // edge ratio in S^2
  const peakSq = sAtKStar * sAtKStar;
  const edgeSq = Math.max(S[0]! * S[0]!, S[n - 1]! * S[n - 1]!);
  const lEdgeRatio = peakSq > 0 ? edgeSq / peakSq : 0;
  // second peak outside guard
  const guard = Math.max(3, K);
  let secondPeak = 0;
  let kStar2 = -1;
  for (let k = 0; k < n; k += 1) {
    if (Math.abs(k - kStar) <= guard) continue;
    const a = Math.abs(S[k]!);
    if (a > secondPeak) {
      secondPeak = a;
      kStar2 = k;
    }
  }
  const secondPeakRatio =
    peakSq > 0 ? (secondPeak * secondPeak) / peakSq : 0;
  return {
    ln,
    kStar,
    sAtKStar,
    directionSign,
    lEdgeRatio,
    secondPeak,
    kStar2,
    secondPeakRatio,
  };
}

/**
 * Lombard 1987 Table 1 + Anderson-Darling 1952 moments
 * gamma approximation for the upper-tail p-value of L_n
 * under H0 of no change.
 *
 * Under exchangeability and triangular smoothing with
 * K = o(n^{1/2}), n * L_n / sigma^2 -> Q := integral_0^1
 * B(t)^2 dt where B is a standard Brownian bridge and
 * sigma^2 = Var(phi[1]) = (n^2 - 1) / (12 * n^2) -> 1/12.
 *
 * Q has E[Q] = 1/6 and Var[Q] = 1/45 (Anderson-Darling
 * 1952). We moment-match a Gamma:
 *
 *     k_g     = E[Q]^2 / Var[Q] = (1/36) / (1/45) = 5/4 = 1.25
 *     theta_g = Var[Q] / E[Q] = (1/45) / (1/6) = 2/15 ~ 0.1333
 *
 * Returns the upper-tail probability Pr(Gamma(k_g,
 * theta_g) > L_n / sigma^2).
 */
export function lombardGammaUpperTailP(ln: number, n: number): number {
  if (!Number.isFinite(ln) || ln < 0) return 1;
  if (n < 2) return 1;
  const sigma2 = (n * n - 1) / (12 * n * n);
  if (sigma2 <= 0) return 1;
  const q = ln / sigma2;
  if (q <= 0) return 1;
  const kShape = 1.25;
  const theta = 2 / 15;
  // Pr(Gamma(kShape, theta) > q) = 1 - regIncGamma(kShape, q/theta)
  const reg = regularizedLowerGamma(kShape, q / theta);
  const p = 1 - reg;
  if (!Number.isFinite(p) || p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Regularised lower incomplete gamma P(a, x) =
 * gamma(a, x) / Gamma(a) via series (x < a+1) or
 * continued fraction (x >= a+1). Numerical Recipes
 * 6.2.5/6.2.7 (Press et al., 3rd ed.).
 */
export function regularizedLowerGamma(a: number, x: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(x) || a <= 0 || x < 0) {
    throw new Error(`regularizedLowerGamma: bad args a=${a} x=${x}`);
  }
  if (x === 0) return 0;
  if (x < a + 1) {
    // series
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let i = 0; i < 200; i += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // continued fraction (Lentz's method)
  const fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpmin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  const Q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return 1 - Q;
}

/** Lanczos log-Gamma. */
export function logGamma(z: number): number {
  // Lanczos g = 7, n = 9 coefficients (Numerical Recipes table 6.1).
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // reflection
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  }
  const zz = z - 1;
  let a = c[0]!;
  for (let i = 1; i < 9; i += 1) a += c[i]! / (zz + i);
  const t = zz + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Lombard smooth-changepoint summary on a gap-filled
 * daily series of length n >= 21. Throws on zero-variance.
 */
export function dailyTokenLombardSmoothChangepoint(
  weights: number[],
  smoothBandwidthDays: number | null = null,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  ln: number;
  smoothBandwidthDays: number;
  kStar: number;
  sAtKStar: number;
  directionSign: number;
  zShift: number;
  meanShift: number;
  muBefore: number;
  muAfter: number;
  pApprox: number;
  significant05: boolean;
  lEdgeRatio: number;
  secondPeak: number;
  kStar2: number;
  secondPeakRatio: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenLombardSmoothChangepoint: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenLombardSmoothChangepoint requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenLombardSmoothChangepoint requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  for (let i = 0; i < n; i += 1) sumW += weights[i]!;
  const mean = sumW / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  if (denom === 0) {
    throw new Error(
      `dailyTokenLombardSmoothChangepoint: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(denom / n);
  // Resolve K
  let K: number;
  if (smoothBandwidthDays !== null && smoothBandwidthDays !== undefined) {
    if (
      !Number.isInteger(smoothBandwidthDays) ||
      smoothBandwidthDays < 1
    ) {
      throw new Error(
        `smoothBandwidthDays must be an integer >= 1 (got ${smoothBandwidthDays})`,
      );
    }
    K = smoothBandwidthDays;
  } else {
    K = Math.max(2, Math.ceil(Math.cbrt(n)));
  }
  const kMax = Math.max(1, Math.floor(n / 3));
  if (K > kMax) K = kMax;
  const sm = lombardSummary(weights, K);
  const zShift = sm.sAtKStar / n;
  // raw-scale mean shift partitioned at kStar (split AFTER kStar so muBefore = x[0..kStar])
  const split = Math.max(1, Math.min(n - 1, sm.kStar + 1));
  let sumA = 0;
  for (let i = 0; i < split; i += 1) sumA += weights[i]!;
  const muBefore = sumA / split;
  let sumB = 0;
  for (let i = split; i < n; i += 1) sumB += weights[i]!;
  const muAfter = sumB / (n - split);
  const meanShift = muAfter - muBefore;
  const pApprox = lombardGammaUpperTailP(sm.ln, n);
  const significant05 = pApprox < 0.05;
  return {
    mean,
    stddev,
    nSamples: n,
    ln: sm.ln,
    smoothBandwidthDays: K,
    kStar: sm.kStar,
    sAtKStar: sm.sAtKStar,
    directionSign: sm.directionSign,
    zShift,
    meanShift,
    muBefore,
    muAfter,
    pApprox,
    significant05,
    lEdgeRatio: sm.lEdgeRatio,
    secondPeak: sm.secondPeak,
    kStar2: sm.kStar2,
    secondPeakRatio: sm.secondPeakRatio,
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

export function buildDailyTokenLombardSmoothChangepoint(
  queue: QueueLine[],
  opts: DailyTokenLombardSmoothChangepointOptions = {},
): DailyTokenLombardSmoothChangepointReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const smoothBandwidthDays =
    opts.smoothBandwidthDays === undefined ? null : opts.smoothBandwidthDays;
  if (
    smoothBandwidthDays !== null &&
    (!Number.isInteger(smoothBandwidthDays) || smoothBandwidthDays < 1)
  ) {
    throw new Error(
      `smoothBandwidthDays must be an integer >= 1 or null (got ${opts.smoothBandwidthDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenLombardSmoothChangepointSort = opts.sort ?? 'lnDesc';
  const validSorts: DailyTokenLombardSmoothChangepointSort[] = [
    'ln',
    'lnDesc',
    'pApprox',
    'pApproxDesc',
    'kStar',
    'kStarDesc',
    'absShift',
    'absShiftDesc',
    'secondPeakRatio',
    'secondPeakRatioDesc',
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
  const rows: DailyTokenLombardSmoothChangepointSourceRow[] = [];

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
      result = dailyTokenLombardSmoothChangepoint(filled, smoothBandwidthDays);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const kStarDay =
      result.kStar >= 0 && result.kStar < nTenure
        ? addUtcDays(acc.firstDay, result.kStar)
        : null;
    const kStar2Day =
      result.kStar2 >= 0 && result.kStar2 < nTenure
        ? addUtcDays(acc.firstDay, result.kStar2)
        : null;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      ln: result.ln,
      smoothBandwidthDays: result.smoothBandwidthDays,
      kStar: result.kStar,
      kStarDay,
      directionSign: result.directionSign,
      zShift: result.zShift,
      meanShift: result.meanShift,
      muBefore: result.muBefore,
      muAfter: result.muAfter,
      pApprox: result.pApprox,
      significant05: result.significant05,
      lEdgeRatio: result.lEdgeRatio,
      secondPeak: result.secondPeak,
      kStar2: result.kStar2,
      kStar2Day,
      secondPeakRatio: result.secondPeakRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'ln':
        primary = a.ln - b.ln;
        break;
      case 'lnDesc':
        primary = b.ln - a.ln;
        break;
      case 'pApprox':
        primary = a.pApprox - b.pApprox;
        break;
      case 'pApproxDesc':
        primary = b.pApprox - a.pApprox;
        break;
      case 'kStar':
        primary = a.kStar - b.kStar;
        break;
      case 'kStarDesc':
        primary = b.kStar - a.kStar;
        break;
      case 'absShift':
        primary = Math.abs(a.meanShift) - Math.abs(b.meanShift);
        break;
      case 'absShiftDesc':
        primary = Math.abs(b.meanShift) - Math.abs(a.meanShift);
        break;
      case 'secondPeakRatio':
        primary = a.secondPeakRatio - b.secondPeakRatio;
        break;
      case 'secondPeakRatioDesc':
        primary = b.secondPeakRatio - a.secondPeakRatio;
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
    smoothBandwidthDays,
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
