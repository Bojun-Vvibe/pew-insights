/**
 * daily-token-quantile-vector-mahalanobis-halves: per-source
 * QUANTILE-VECTOR DIAGONAL-MAHALANOBIS TWO-SAMPLE TEST
 * comparing the EMPIRICAL QUANTILE VECTORS of the FIRST half
 * vs SECOND half of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-FOURTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Fix a probability grid
 *
 *     P  =  ( 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 )
 *
 * (k = 9 equally-spaced interior probabilities; the boundary
 * probabilities 0 and 1 are EXCLUDED to avoid sample-min /
 * sample-max instability). Define the empirical quantile
 * vectors
 *
 *     q_A  =  ( Q_A(0.1), Q_A(0.2), ..., Q_A(0.9) )  in R^9
 *     q_B  =  ( Q_B(0.1), Q_B(0.2), ..., Q_B(0.9) )  in R^9
 *
 * where Q_A(p) is the p-th sample quantile of A using the
 * Hyndman-Fan TYPE-7 LINEAR-INTERPOLATION definition
 * (Hyndman & Fan 1996, Amer. Statist. 50(4):361-365):
 *
 *     h        =  (n - 1) * p
 *     j        =  floor(h)
 *     gamma    =  h - j
 *     Q(p)     =  sorted[j]  +  gamma * ( sorted[j+1] - sorted[j] )
 *
 * (R's `quantile(., type=7)` default; numpy's
 * `numpy.quantile` default; matches axes that consume IQR
 * etc. in this codebase).
 *
 * Standardisation. Compute the per-quantile robust scale
 * from the POOLED sample at the same probability grid:
 *
 *     q_pool       =  ( Q_pool(0.1), ..., Q_pool(0.9) )
 *     iqr_pool     =  Q_pool(0.75) - Q_pool(0.25)
 *
 * The pooled IQR is a single GLOBAL robust scale: it is
 * dimensioned in tokens-per-day (same as the quantile
 * coordinates), it is computed once per source, and it is
 * positive whenever the source has any spread in the
 * 25%-75% middle. Define the diagonal Mahalanobis-style
 * squared distance on the quantile vector
 *
 *     d2_diag  =  ( 1 / (k * iqr_pool^2) )
 *                 * sum_{i=1..k} ( q_B[i] - q_A[i] )^2
 *
 * This is the SQUARED EUCLIDEAN distance between the two
 * quantile vectors, normalised by k*iqr_pool^2 so the
 * resulting effect size is dimensionless (square of a
 * length divided by square of a length) and CROSS-SOURCE-
 * COMPARABLE. The factor (1 / k) makes d2_diag the MEAN
 * SQUARED PER-QUANTILE GAP in iqr_pool units.
 *
 * Test statistic. The canonical scaled statistic is
 *
 *     qvT  =  ( n1 * n2 / (n1 + n2) ) * d2_diag
 *
 * (matches the Hotelling-T^2 / two-sample multivariate
 * scaling, Hotelling 1931 Ann. Math. Statist. 2(3):360-378;
 * Anderson 2003 §5.2). The cross-source-comparable signed
 * effect size is
 *
 *     qvZ        =  sqrt(d2_diag)
 *     qvDir      =  sign( median(B) - median(A) )
 *     qvZSigned  =  qvDir * qvZ
 *
 * Per-quantile diagnostic. We also report the L_infinity
 * gap on the standardised quantile vector
 *
 *     qvLinf  =  max_i ( | q_B[i] - q_A[i] | / iqr_pool )
 *
 * which exposes WHICH quantile contributes the most.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-123:
 *
 *   - Class. TWO-SAMPLE-DISTRIBUTION-EQUALITY-TEST in
 *     FINITE-DIMENSIONAL QUANTILE-VECTOR SPACE (R^k with
 *     k = 9), with diagonal-Mahalanobis-style metric using
 *     pooled-IQR scale. Detects ANY shift that changes the
 *     vector of interior quantiles.
 *
 *   - vs axis-123 daily-token-maximum-mean-discrepancy-halves.
 *     MMD lives in INFINITE-DIMENSIONAL RKHS feature space
 *     with Gaussian-kernel mean embedding; it integrates
 *     over the entire support via the band-pass spectral
 *     filter exp(-sigma^2*t^2/2). qv-Mahalanobis lives in
 *     a FIXED FINITE-DIMENSIONAL REAL VECTOR SPACE indexed
 *     by k discrete probability levels. They are not
 *     monotone images of one another: a change confined
 *     to between, say, the 0.42- and 0.48-quantile of the
 *     pooled distribution can move MMD substantially while
 *     leaving every q_A[i], q_B[i] at the grid {0.1,..,0.9}
 *     identical (so d2_diag === 0).
 *
 *   - vs axis-122 daily-token-energy-distance-halves.
 *     Energy distance is the L2 norm of the CHARACTERISTIC-
 *     FUNCTION GAP weighted by 1/t^2. qv-Mahalanobis is
 *     the L2 norm of the DISCRETELY-SAMPLED QUANTILE-
 *     FUNCTION GAP. Energy distance integrates continuously
 *     over t; qv-Mahalanobis samples the inverse CDF on
 *     a FIXED 9-POINT GRID. They cannot be reduced to one
 *     another.
 *
 *   - vs axis-121 daily-token-wasserstein-one-halves.
 *     W1 = integral_{[0,1]} |F_A^{-1}(u) - F_B^{-1}(u)| du
 *     is the L1-CONTINUOUS-INTEGRAL of the quantile-
 *     function gap. qv-Mahalanobis is the L2-DISCRETELY-
 *     SAMPLED-AT-9-POINTS norm of the same gap, then
 *     normalised by pooled-IQR^2 (vs W1's no normalisation
 *     -- W1 is 1-homogeneous in the data). Two halves with
 *     identical W1 can have different qvZ if the L1 mass
 *     is concentrated at a probability NOT on the grid.
 *
 *   - vs axis-120 daily-token-cramer-von-mises-halves.
 *     CvM is in PROBABILITY space (L2 of CDF gap weighted
 *     by pooled CDF mass). qv-Mahalanobis is in TOKEN
 *     space (L2 of quantile gap normalised by pooled IQR).
 *     They are inverse-function dual operators on different
 *     metric structures.
 *
 *   - vs axis-119 daily-token-anderson-darling-halves.
 *     AD is tail-weighted L2 in PROBABILITY space (weights
 *     1 / (H(1-H)) blow up at the support tails). qv-
 *     Mahalanobis SAMPLES the interior of the quantile
 *     function uniformly (probabilities {0.1,..,0.9}) and
 *     is INSENSITIVE BY DESIGN to the extreme tails p<0.1
 *     and p>0.9.
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS is L_infinity of CDF gap in PROBABILITY space.
 *     qvLinf (a diagnostic of this axis) is L_infinity of
 *     STANDARDISED QUANTILE gap in TOKEN-PER-IQR-UNIT space.
 *     They are duals through the inverse-CDF map but the
 *     KS argmax is a probability whereas the qvLinf argmax
 *     is one of the 9 grid probabilities.
 *
 *   - vs axes 115/116/117. Mann-Whitney (location), Brown-
 *     Forsythe (scale), Siegel-Tukey (scale). qv-Mahalanobis
 *     captures location AND scale AND shape jointly through
 *     the full 9-quantile vector.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). These are PERMUTATION-INVARIANT functionals
 *     on the WHOLE series. qv-Mahalanobis depends on which
 *     half each value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), how large is the squared diagonal-
 *   Mahalanobis distance between the two halves' empirical
 *   quantile vectors at probabilities {0.1, 0.2, ..., 0.9},
 *   normalised by the pooled IQR squared, and how does that
 *   compare across sources?"**
 *
 * Reference:
 *   Hyndman, R. J. and Fan, Y., "Sample quantiles in
 *     statistical packages", The American Statistician 50(4)
 *     (1996), pp. 361-365.
 *   Hotelling, H., "The generalization of Student's ratio",
 *     The Annals of Mathematical Statistics 2(3) (1931),
 *     pp. 360-378.
 *   Anderson, T. W., An Introduction to Multivariate
 *     Statistical Analysis, 3rd ed., Wiley (2003), §5.2.
 *
 * Caveats:
 *
 *   - d2_diag in [0, +inf) (squared distance, dimensionless
 *     after normalisation by iqr_pool^2).
 *   - qvT in [0, +inf), qvZ in [0, +inf), qvZSigned in
 *     (-inf, +inf).
 *   - The diagonal-Mahalanobis metric ignores cross-quantile
 *     covariance (genuine Mahalanobis would invert the full
 *     k x k covariance matrix of the quantile vector).
 *     The diagonal form with pooled-IQR scale is preferred
 *     here for two reasons: (a) it is FULLY DETERMINISTIC
 *     and requires no permutation/bootstrap covariance
 *     estimation, and (b) the off-diagonal entries of the
 *     true covariance matrix are themselves estimated with
 *     considerable noise at n ~ 14-30, leading to numerical
 *     instability of the inverse. The pooled-IQR diagonal
 *     scale is robust and unique per source.
 *   - The probability grid {0.1, ..., 0.9} is FIXED (no CLI
 *     knob). This is intentional: cross-source comparability
 *     of d2_diag, qvT, qvZ, and qvZSigned requires the same
 *     grid for every source.
 *   - The grid excludes 0 and 1 (the sample minimum and
 *     maximum) so the axis is INSENSITIVE to extreme outliers
 *     beyond the 0.1 / 0.9 quantiles, by design.
 *   - When iqr_pool === 0 (>= half the pooled values tied at
 *     the median AND the spread between the 25- and 75-
 *     percentile is 0) the source is dropped as
 *     droppedZeroIqr.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115-123). Hard floor n >= 8.
 *   - d2_diag is INVARIANT under translation x -> x + c
 *     applied to BOTH halves identically (each q_A[i] and
 *     q_B[i] shift by c, the difference is unchanged, and
 *     iqr_pool is translation-invariant).
 *   - d2_diag is INVARIANT under positive rescaling
 *     x -> k*x (k > 0): each quantile scales by k, the
 *     numerator gap by k^2, and iqr_pool by k so iqr_pool^2
 *     by k^2. Hence FULLY SCALE-INVARIANT in the data,
 *     mirroring axis-123 MMD with median-heuristic bandwidth
 *     and unlike axis-122 (energy) and axis-121 (W1) which
 *     are 1-homogeneous in the data.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-quantile-vector-mahalanobis-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-quantile-vector-mahalanobis-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute diagonal-Mahalanobis effect size desc:
 *   pew-insights daily-token-quantile-vector-mahalanobis-halves \
 *     --sort qvZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenQuantileVectorMahalanobisHalvesSort =
  | 'd2Diag'
  | 'd2DiagDesc'
  | 'qvT'
  | 'qvTDesc'
  | 'qvZ'
  | 'qvZDesc'
  | 'qvZSigned'
  | 'qvZSignedDesc'
  | 'qvLinf'
  | 'qvLinfDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenQuantileVectorMahalanobisHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (sample-quantile interpolation regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenQuantileVectorMahalanobisHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenQuantileVectorMahalanobisHalvesSourceRow {
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
  qvN1: number;
  /** Second-half size n2 = n - n1. */
  qvN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  qvMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  qvMedianB: number;
  /** Pooled IQR (Q75 - Q25 on the pooled sample). */
  qvIqrPool: number;
  /** Diagonal-Mahalanobis squared distance, dimensionless. */
  qvD2Diag: number;
  /** Scaled test statistic qvT = n1*n2/(n1+n2)*d2Diag. */
  qvT: number;
  /** sqrt(d2Diag) -- effect size, dimensionless. */
  qvZ: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  qvDir: number;
  /** Signed effect size: qvDir * qvZ. */
  qvZSigned: number;
  /** L_infinity standardised quantile gap (max over grid). */
  qvLinf: number;
  /** Index in {0..k-1} of the grid probability where qvLinf is attained. */
  qvLinfArgmax: number;
}

export interface DailyTokenQuantileVectorMahalanobisHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenQuantileVectorMahalanobisHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  /** Probability grid as a fixed report-level constant. */
  probabilityGrid: number[];
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroIqr: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenQuantileVectorMahalanobisHalvesSourceRow[];
}

/** Hyndman-Fan TYPE-7 sample quantile from a pre-sorted array. */
function quantileType7Sorted(sorted: number[], p: number): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  if (m === 1) return sorted[0]!;
  if (p <= 0) return sorted[0]!;
  if (p >= 1) return sorted[m - 1]!;
  const h = (m - 1) * p;
  const j = Math.floor(h);
  const gamma = h - j;
  if (j + 1 >= m) return sorted[m - 1]!;
  return sorted[j]! + gamma * (sorted[j + 1]! - sorted[j]!);
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/** Fixed cross-source-comparable interior probability grid. */
export const QV_PROBABILITY_GRID: readonly number[] = Object.freeze([
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
]);

/**
 * Quantile-vector diagonal-Mahalanobis two-sample test on
 * the first-half vs second-half of a real-valued series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - d2Diag(x + c) === d2Diag(x) for any constant c
 *     (translation-invariance: each q_A[i], q_B[i] shifts
 *     by c, the difference is unchanged, and iqr_pool is
 *     translation-invariant).
 *   - d2Diag(k*x) === d2Diag(x) for any k > 0
 *     (positive scale-invariance: each quantile scales by
 *     k, the gap by k, the squared gap by k^2, iqr_pool by
 *     k, iqr_pool^2 by k^2; ratio unchanged).
 *   - d2Diag >= 0; equals 0 iff q_A == q_B at every grid
 *     probability (which for type-7 quantiles is iff the
 *     two halves' sorted arrays agree at every interior
 *     interpolation node on the grid).
 *   - Swapping the two halves leaves d2Diag invariant and
 *     negates qvDir.
 */
export function dailyTokenQuantileVectorMahalanobisHalves(
  values: number[],
): {
  mean: number;
  stddev: number;
  nSamples: number;
  qvN1: number;
  qvN2: number;
  qvMedianA: number;
  qvMedianB: number;
  qvIqrPool: number;
  qvD2Diag: number;
  qvT: number;
  qvZ: number;
  qvDir: number;
  qvZSigned: number;
  qvLinf: number;
  qvLinfArgmax: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenQuantileVectorMahalanobisHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenQuantileVectorMahalanobisHalves requires finite values',
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
      `dailyTokenQuantileVectorMahalanobisHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const pooledSorted = values.slice().sort((p, q) => p - q);

  const qvMedianA = medianSorted(aSorted);
  const qvMedianB = medianSorted(bSorted);

  const q25 = quantileType7Sorted(pooledSorted, 0.25);
  const q75 = quantileType7Sorted(pooledSorted, 0.75);
  const qvIqrPool = q75 - q25;
  if (!(qvIqrPool > 0) || !Number.isFinite(qvIqrPool)) {
    throw new Error(
      `dailyTokenQuantileVectorMahalanobisHalves: pooled IQR is non-positive (${qvIqrPool})`,
    );
  }

  const k = QV_PROBABILITY_GRID.length;
  let sumSqGap = 0;
  let qvLinf = 0;
  let qvLinfArgmax = 0;
  for (let i = 0; i < k; i += 1) {
    const p = QV_PROBABILITY_GRID[i]!;
    const qa = quantileType7Sorted(aSorted, p);
    const qb = quantileType7Sorted(bSorted, p);
    const gap = qb - qa;
    sumSqGap += gap * gap;
    const stdGap = Math.abs(gap) / qvIqrPool;
    if (stdGap > qvLinf) {
      qvLinf = stdGap;
      qvLinfArgmax = i;
    }
  }
  const qvD2Diag = sumSqGap / (k * qvIqrPool * qvIqrPool);

  const qvT = ((n1 * n2) / (n1 + n2)) * qvD2Diag;
  const qvZ = Math.sqrt(qvD2Diag);
  const qvDir =
    qvMedianB > qvMedianA ? 1 : qvMedianB < qvMedianA ? -1 : 0;
  const qvZSigned = qvDir * qvZ;

  if (
    !Number.isFinite(qvD2Diag) ||
    !Number.isFinite(qvT) ||
    !Number.isFinite(qvZ) ||
    !Number.isFinite(qvZSigned) ||
    !Number.isFinite(qvLinf)
  ) {
    throw new Error(
      `dailyTokenQuantileVectorMahalanobisHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    qvN1: n1,
    qvN2: n2,
    qvMedianA,
    qvMedianB,
    qvIqrPool,
    qvD2Diag,
    qvT,
    qvZ,
    qvDir,
    qvZSigned,
    qvLinf,
    qvLinfArgmax,
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

export function buildDailyTokenQuantileVectorMahalanobisHalves(
  queue: QueueLine[],
  opts: DailyTokenQuantileVectorMahalanobisHalvesOptions = {},
): DailyTokenQuantileVectorMahalanobisHalvesReport {
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
  const sort: DailyTokenQuantileVectorMahalanobisHalvesSort =
    opts.sort ?? 'qvTDesc';
  const validSorts: DailyTokenQuantileVectorMahalanobisHalvesSort[] = [
    'd2Diag',
    'd2DiagDesc',
    'qvT',
    'qvTDesc',
    'qvZ',
    'qvZDesc',
    'qvZSigned',
    'qvZSignedDesc',
    'qvLinf',
    'qvLinfDesc',
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
  let droppedZeroIqr = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenQuantileVectorMahalanobisHalvesSourceRow[] = [];

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
      result = dailyTokenQuantileVectorMahalanobisHalves(filled);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('pooled IQR is non-positive')) {
        droppedZeroIqr += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    const row: DailyTokenQuantileVectorMahalanobisHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      qvN1: result.qvN1,
      qvN2: result.qvN2,
      qvMedianA: result.qvMedianA,
      qvMedianB: result.qvMedianB,
      qvIqrPool: result.qvIqrPool,
      qvD2Diag: result.qvD2Diag,
      qvT: result.qvT,
      qvZ: result.qvZ,
      qvDir: result.qvDir,
      qvZSigned: result.qvZSigned,
      qvLinf: result.qvLinf,
      qvLinfArgmax: result.qvLinfArgmax,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'd2Diag':
        primary = a.qvD2Diag - b.qvD2Diag;
        break;
      case 'd2DiagDesc':
        primary = b.qvD2Diag - a.qvD2Diag;
        break;
      case 'qvT':
        primary = a.qvT - b.qvT;
        break;
      case 'qvTDesc':
        primary = b.qvT - a.qvT;
        break;
      case 'qvZ':
        primary = a.qvZ - b.qvZ;
        break;
      case 'qvZDesc':
        primary = b.qvZ - a.qvZ;
        break;
      case 'qvZSigned':
        primary = a.qvZSigned - b.qvZSigned;
        break;
      case 'qvZSignedDesc':
        primary = b.qvZSigned - a.qvZSigned;
        break;
      case 'qvLinf':
        primary = a.qvLinf - b.qvLinf;
        break;
      case 'qvLinfDesc':
        primary = b.qvLinf - a.qvLinf;
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
    probabilityGrid: QV_PROBABILITY_GRID.slice(),
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedZeroIqr,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
