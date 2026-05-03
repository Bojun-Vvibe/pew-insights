/**
 * daily-token-wasserstein-one-halves: per-source
 * WASSERSTEIN-1 (KANTOROVICH-RUBINSTEIN, EARTH MOVER'S
 * DISTANCE) TWO-SAMPLE TEST comparing the empirical
 * distributions of the FIRST half vs SECOND half of
 * the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWENTY-FIRST cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The Wasserstein-1 distance (also known as the
 * Kantorovich-Rubinstein metric, Mallows L1 metric,
 * or Earth Mover's Distance on the real line) between
 * the empirical distributions F_A and F_B is the
 * minimal L1 cost of transporting mass from F_A to
 * F_B. By the Kantorovich-Rubinstein duality
 * (Vallender 1974, Theory of Probability and Its
 * Applications 18(4):784-786) for one-dimensional
 * distributions:
 *
 *     W1(F_A, F_B)  =  integral_{-inf..+inf}
 *                        | F_A(x) - F_B(x) | dx
 *                   =  integral_0^1
 *                        | Q_A(u) - Q_B(u) | du
 *
 * where Q_A, Q_B are the quantile functions (CDF
 * inverses). The first form is the L1 norm of the CDF
 * gap; the second form is the L1 norm of the quantile
 * gap. The two are dual and equal on the real line.
 *
 * Discrete computation. For empirical samples we use
 * the QUANTILE-INTEGRAL form which is numerically
 * stable and exact for arbitrary tied data. Sort both
 * halves in ascending order. The pooled grid of breaks
 * partitions u in [0, 1] into segments where both
 * Q_A(u) and Q_B(u) are step-constant. Specifically,
 * letting the merged sorted distinct quantile-fraction
 * breakpoints be 0 = u_0 < u_1 < ... < u_K = 1
 * (sorted union of {0, 1/n1, 2/n1, ..., 1} and
 * {0, 1/n2, 2/n2, ..., 1}):
 *
 *     wassW1 = sum_{k=1..K} (u_k - u_{k-1}) *
 *                | Q_A(u_k^-) - Q_B(u_k^-) |
 *
 * where Q_A(u_k^-) is the value of the A-quantile
 * function on the open segment (u_{k-1}, u_k). This is
 * Bonneel et al. 2015 (Journal of Mathematical Imaging
 * and Vision 51(1):22-45) algorithm 1 specialised to
 * 1-D, equivalent to scipy.stats.wasserstein_distance.
 *
 * EQUIVALENT EQUAL-SIZE FORMULA. When n1 = n2 = m
 * the integral collapses to the L1 mean of paired
 * order statistics:
 *
 *     W1  =  (1/m) * sum_{i=1..m}
 *              | A_(i) - B_(i) |
 *
 * (Bickel & Freedman 1981, Annals of Statistics 9(6):
 * 1196-1217, eq. 8.5; Mallows 1972, Annals of
 * Mathematical Statistics 43(2):508-515). We use the
 * general two-sized form since odd-n splits give
 * n1 != n2.
 *
 * Standardisation. Under H0 (both halves drawn from
 * the same continuous distribution F with finite
 * variance sigma^2 and density f bounded away from 0
 * on its support), W1 has limiting distribution
 * (del Barrio, Gine & Matran 1999, Annals of
 * Probability 27(2):1009-1071):
 *
 *     sqrt(N) * W1  ->  ||B^circ / f(F^{-1})||_{L1}
 *
 * where B^circ is a Brownian bridge and N = n1 + n2.
 * The functional limit has no closed-form moments
 * for arbitrary F, so we standardise by the SCALE-
 * INVARIANT normalisation
 *
 *     wassZ  =  W1 / pooledMad
 *
 * where pooledMad is the median absolute deviation
 * from the pooled median (a robust dispersion scale).
 * wassZ measures the W1 distance in "robust scale
 * units" of the underlying distribution and is
 * comparable across sources with different magnitude
 * scales. This is NOT a hypothesis-test z-score (the
 * null distribution of wassZ depends on F) but a
 * cross-source-comparable effect size.
 *
 * Sign convention. W1 is INTRINSICALLY UNSIGNED
 * (L1 norm). To make the axis cross-comparable with
 * the signed halves tests (115/116/117/118) and the
 * unsigned-with-sign-flag axes 119/120, we report
 *
 *     wassDir   =  sign( median(B) - median(A) )
 *     wassZSigned  =  wassDir * wassZ
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS IN 79-120:
 *
 *   - Class. TWO-SAMPLE-FULL-DISTRIBUTION-EQUALITY-
 *     TEST (NONPARAMETRIC OPTIMAL-TRANSPORT-L1
 *     statistic). Sensitive to ANY distributional
 *     difference (location, scale, shape, tails) but
 *     measured in the ORIGINAL UNITS of the data
 *     rather than in CDF-probability space.
 *
 *   - vs axis-120 daily-token-cramer-von-mises-halves.
 *     CvM integrates the SQUARED CDF gap with UNIFORM
 *     weight on the pooled ECDF dH_N: it lives in
 *     [0, 1]-PROBABILITY space and is dimensionless.
 *     W1 integrates the |CDF gap| with UNIFORM weight
 *     on the SUPPORT dx: it lives in DATA-UNIT space
 *     and has units of tokens. This is not a monotone
 *     transform: scale the data by k > 0 and W1
 *     scales by k while T is unchanged. Two halves
 *     with identical CvM but very different W1
 *     emerge when bulk discrepancies sit far from the
 *     pooled median (W1 weights by support distance,
 *     CvM by mass).
 *
 *   - vs axis-119 daily-token-anderson-darling-halves.
 *     AD weights the squared CDF gap by 1/(H_N(1-H_N))
 *     and lives in PROBABILITY space. W1 lives in
 *     SUPPORT space. AD blows up tail discrepancies
 *     by inverse-variance weighting; W1 blows up
 *     SUPPORT-DISTANT discrepancies by their literal
 *     transport cost. They diverge cleanly: a high-
 *     density tail bump near the median has large AD
 *     (tail weight) but small W1 (short transport).
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS is the L_infinity SUP of |F_A - F_B|: a
 *     single tall pointwise spike dominates and the
 *     rest of the curve is ignored. W1 is the L1
 *     INTEGRAL of |F_A - F_B| over the support:
 *     many small CDF gaps over a wide support
 *     accumulate to large W1 while KS sees only the
 *     maximum vertical gap. They are not a monotone
 *     transform: a single localised CDF spike of
 *     height h over a narrow support of width w gives
 *     KS = h and W1 = h*w.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves.
 *     Siegel-Tukey is a NONPARAMETRIC RANK-SUM on
 *     OUTWARD-PAIR ranks AFTER median-centring,
 *     sensitive ONLY to SCALE shift. W1 detects scale
 *     shift among other things but in support units;
 *     a clean median shift gives stZ approx 0 but
 *     W1 = |delta_median|.
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves.
 *     Brown-Forsythe is a PARAMETRIC F-test on
 *     ABSOLUTE deviations from per-half medians,
 *     sensitive ONLY to SCALE shift. W1 detects
 *     scale shift among other things and in support
 *     units rather than F-statistic probability.
 *
 *   - vs axis-115 daily-token-mann-whitney-halves.
 *     Mann-Whitney detects a LOCATION/STOCHASTIC-
 *     DOMINANCE shift via the integral
 *     int F_A dF_B - 1/2 in PROBABILITY space.
 *     W1 measures the literal L1 distance between
 *     ECDFs in SUPPORT space. Two halves with
 *     EQUAL MEDIANS but different shape give
 *     mwZ approx 0 but W1 large.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Permutation-invariant functionals
 *     of the EMPIRICAL DISTRIBUTION computed on the
 *     WHOLE series. W1 is permutation-invariant
 *     within each half but depends on WHICH half
 *     each value lands in.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), how much L1 mass
 *   transport is needed to convert the first-half
 *   empirical distribution into the second-half
 *   empirical distribution, measured in tokens by
 *   the Kantorovich-Rubinstein (Earth Mover's)
 *   metric, and how does that compare with the
 *   pooled robust scale?"**
 *
 * Reference:
 *   Vallender, S. S., "Calculation of the Wasserstein
 *     Distance Between Probability Distributions on
 *     the Line", Theory of Probability and Its
 *     Applications 18(4) (1974), pp. 784-786.
 *   Bickel, P. J. and Freedman, D. A., "Some
 *     Asymptotic Theory for the Bootstrap", Annals
 *     of Statistics 9(6) (1981), pp. 1196-1217.
 *   del Barrio, E., Gine, E. and Matran, C., "Central
 *     Limit Theorems for the Wasserstein Distance
 *     Between the Empirical and the True
 *     Distributions", Annals of Probability 27(2)
 *     (1999), pp. 1009-1071.
 *   Bonneel, N., Rabin, J., Peyre, G. and Pfister, H.,
 *     "Sliced and Radon Wasserstein Barycenters of
 *     Measures", Journal of Mathematical Imaging and
 *     Vision 51(1) (2015), pp. 22-45.
 *
 * Caveats:
 *
 *   - wassW1 in [0, +inf) with units of tokens.
 *     wassZ in [0, +inf) dimensionless.
 *     wassZSigned in (-inf, +inf).
 *   - wassZ is NOT a hypothesis-test z-score; the
 *     null distribution of W1/pooledMad depends on F.
 *     It is a CROSS-SOURCE-COMPARABLE EFFECT SIZE.
 *   - When pooledMad = 0 (degenerate flat pool) we
 *     throw; the upstream zero-variance guard already
 *     filters such sources.
 *   - Half-split point. n1 = floor(n/2), n2 = n - n1
 *     (matches axes 115/116/117/118/119/120). Hard
 *     floor n >= 8.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-wasserstein-one-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-wasserstein-one-halves \
 *     --source vscode-other --json
 *
 *   # Sort by absolute Wasserstein-1 effect size desc:
 *   pew-insights daily-token-wasserstein-one-halves \
 *     --sort wassZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenWassersteinOneHalvesSort =
  | 'wassW1'
  | 'wassW1Desc'
  | 'wassZ'
  | 'wassZDesc'
  | 'wassZSigned'
  | 'wassZSignedDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenWassersteinOneHalvesOptions {
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
  sort?: DailyTokenWassersteinOneHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenWassersteinOneHalvesSourceRow {
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
  wassN1: number;
  /** Second-half size n2 = n - n1. */
  wassN2: number;
  /** Median of the first half (diagnostic; sets sign). */
  wassMedianA: number;
  /** Median of the second half (diagnostic; sets sign). */
  wassMedianB: number;
  /** Median of the pooled sample (used as scale centre). */
  wassPooledMedian: number;
  /** MAD of the pooled sample about the pooled median. */
  wassPooledMad: number;
  /** Wasserstein-1 distance between the half ECDFs (token units). */
  wassW1: number;
  /** Scale-normalised effect size W1 / pooledMad (dimensionless). */
  wassZ: number;
  /** Sign indicator: +1 if median(B) > median(A); -1 if <; 0 if =. */
  wassDir: number;
  /** Signed effect size: wassDir * wassZ. */
  wassZSigned: number;
}

export interface DailyTokenWassersteinOneHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWassersteinOneHalvesSort;
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
  sources: DailyTokenWassersteinOneHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Wasserstein-1 distance between two empirical
 * distributions on the real line, computed via the
 * quantile-integral form on the merged grid of step
 * breakpoints. Equivalent to
 * `scipy.stats.wasserstein_distance(A, B)`.
 *
 * Algorithm (Bonneel et al. 2015 alg. 1 specialised
 * to 1-D, vectorised):
 *
 *   1. Sort A and B ascending: A_(i), B_(j).
 *   2. Build the merged sorted list of CDF
 *      breakpoints {i/n1} U {j/n2} on [0, 1].
 *   3. For each consecutive pair (u_{k-1}, u_k) the
 *      A-quantile and B-quantile are constant on the
 *      open segment; accumulate
 *      (u_k - u_{k-1}) * | Q_A - Q_B |.
 *
 * Complexity O((n1 + n2) log(n1 + n2)) due to the
 * initial sorts; the merge pass is O(n1 + n2).
 */
function wasserstein1OneDim(
  aSorted: number[],
  bSorted: number[],
): number {
  const n1 = aSorted.length;
  const n2 = bSorted.length;
  if (n1 === 0 || n2 === 0) {
    throw new Error('wasserstein1OneDim: both samples must be non-empty');
  }
  // Walk the merged CDF breakpoint grid. At every step
  // we know which value of A and which value of B is
  // active on the segment we just exited.
  let i = 0;
  let j = 0;
  let prevU = 0;
  let total = 0;
  // Precompute step heights so we can advance one
  // index per iteration.
  while (i < n1 && j < n2) {
    const uA = (i + 1) / n1;
    const uB = (j + 1) / n2;
    const u = uA < uB ? uA : uB;
    // On (prevU, u] the active quantile values are
    // A_(i) and B_(j) (the i-th smallest of A and
    // j-th smallest of B; both 0-indexed = (i+1)-th
    // / (j+1)-th order statistic).
    const gap = aSorted[i]! - bSorted[j]!;
    total += (u - prevU) * (gap >= 0 ? gap : -gap);
    prevU = u;
    if (uA <= uB) i += 1;
    if (uB <= uA) j += 1;
  }
  // After the loop one of A / B is exhausted; the
  // remaining segment up to u = 1 has the last
  // exhausted value at one end. Either i == n1 (so
  // A's quantile sits at A_(n1-1) on (prevU, 1]) or
  // j == n2 similarly.
  if (i === n1 && j < n2) {
    while (j < n2) {
      const uB = (j + 1) / n2;
      const gap = aSorted[n1 - 1]! - bSorted[j]!;
      total += (uB - prevU) * (gap >= 0 ? gap : -gap);
      prevU = uB;
      j += 1;
    }
  } else if (j === n2 && i < n1) {
    while (i < n1) {
      const uA = (i + 1) / n1;
      const gap = aSorted[i]! - bSorted[n2 - 1]!;
      total += (uA - prevU) * (gap >= 0 ? gap : -gap);
      prevU = uA;
      i += 1;
    }
  }
  return total;
}

/**
 * Wasserstein-1 two-sample equality-of-distribution
 * test on the first-half (A = x[0..n1-1]) vs second-
 * half (B = x[n1..n-1]) of a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - W1(x + c) === W1(x) for any constant c.
 *     A constant added to every value translates both
 *     ECDFs identically; the L1 CDF gap is unchanged.
 *   - W1(a * x) === |a| * W1(x) for any scalar a.
 *     Wasserstein-1 is positively homogeneous of
 *     degree 1.
 *   - W1 in [0, +inf); wassZ in [0, +inf).
 *   - Swapping the two halves leaves W1 invariant
 *     (L1 norm is symmetric) and negates wassDir.
 */
export function dailyTokenWassersteinOneHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  wassN1: number;
  wassN2: number;
  wassMedianA: number;
  wassMedianB: number;
  wassPooledMedian: number;
  wassPooledMad: number;
  wassW1: number;
  wassZ: number;
  wassDir: number;
  wassZSigned: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenWassersteinOneHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenWassersteinOneHalves requires finite values',
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
      `dailyTokenWassersteinOneHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const wassMedianA = medianSorted(aSorted);
  const wassMedianB = medianSorted(bSorted);

  const pooledSorted = values.slice().sort((p, q) => p - q);
  const wassPooledMedian = medianSorted(pooledSorted);
  const absDevSorted = pooledSorted
    .map((v) => Math.abs(v - wassPooledMedian))
    .sort((p, q) => p - q);
  let wassPooledMad = medianSorted(absDevSorted);
  // When more than half the pooled sample lies on the
  // pooled median (common for sparse zero-heavy daily
  // token series where >= 50 % of days are gap-filled
  // zeros), MAD collapses to 0 and would render wassZ
  // undefined. Fall back to the population stddev,
  // which is guaranteed positive here because the
  // upstream zero-variance guard has already filtered
  // out constant series.
  if (wassPooledMad === 0) {
    wassPooledMad = stddev;
  }
  if (wassPooledMad === 0) {
    throw new Error(
      `dailyTokenWassersteinOneHalves: zero pooled MAD and zero stddev (n=${n})`,
    );
  }

  const wassW1 = wasserstein1OneDim(aSorted, bSorted);
  const wassZ = wassW1 / wassPooledMad;
  const wassDir =
    wassMedianB > wassMedianA ? 1 : wassMedianB < wassMedianA ? -1 : 0;
  const wassZSigned = wassDir * wassZ;

  if (
    !Number.isFinite(wassW1) ||
    !Number.isFinite(wassZ) ||
    !Number.isFinite(wassZSigned)
  ) {
    throw new Error(
      `dailyTokenWassersteinOneHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    wassN1: n1,
    wassN2: n2,
    wassMedianA,
    wassMedianB,
    wassPooledMedian,
    wassPooledMad,
    wassW1,
    wassZ,
    wassDir,
    wassZSigned,
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

export function buildDailyTokenWassersteinOneHalves(
  queue: QueueLine[],
  opts: DailyTokenWassersteinOneHalvesOptions = {},
): DailyTokenWassersteinOneHalvesReport {
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
  const sort: DailyTokenWassersteinOneHalvesSort = opts.sort ?? 'wassW1Desc';
  const validSorts: DailyTokenWassersteinOneHalvesSort[] = [
    'wassW1',
    'wassW1Desc',
    'wassZ',
    'wassZDesc',
    'wassZSigned',
    'wassZSignedDesc',
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
  const rows: DailyTokenWassersteinOneHalvesSourceRow[] = [];

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
      result = dailyTokenWassersteinOneHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenWassersteinOneHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      wassN1: result.wassN1,
      wassN2: result.wassN2,
      wassMedianA: result.wassMedianA,
      wassMedianB: result.wassMedianB,
      wassPooledMedian: result.wassPooledMedian,
      wassPooledMad: result.wassPooledMad,
      wassW1: result.wassW1,
      wassZ: result.wassZ,
      wassDir: result.wassDir,
      wassZSigned: result.wassZSigned,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'wassW1':
        primary = a.wassW1 - b.wassW1;
        break;
      case 'wassW1Desc':
        primary = b.wassW1 - a.wassW1;
        break;
      case 'wassZ':
        primary = a.wassZ - b.wassZ;
        break;
      case 'wassZDesc':
        primary = b.wassZ - a.wassZ;
        break;
      case 'wassZSigned':
        primary = a.wassZSigned - b.wassZSigned;
        break;
      case 'wassZSignedDesc':
        primary = b.wassZSigned - a.wassZSigned;
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
