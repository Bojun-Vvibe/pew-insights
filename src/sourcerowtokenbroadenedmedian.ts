/**
 * source-row-token-broadened-median: per-source **Harrell-Davis
 * pseudo-median** (a.k.a. "broadened median") of `total_tokens`
 * across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens` samples
 * sorted as `x_(1) <= x_(2) <= ... <= x_(n)`, the Harrell-Davis
 * (HD) quantile estimator at level `p` is the weighted L-estimator
 *
 *     HD_p = sum_{i=1..n} w_i * x_(i)
 *
 * where the weights come from a Beta(alpha, beta) CDF with
 * `alpha = (n + 1) * p` and `beta = (n + 1) * (1 - p)`:
 *
 *     w_i = I_{i/n}(alpha, beta) - I_{(i-1)/n}(alpha, beta)
 *
 * and `I_x(a, b)` is the regularized incomplete Beta function (the
 * CDF of Beta(a, b) at `x`). The **broadened median** is the
 * special case `p = 0.5`, which simplifies to
 *
 *     alpha = beta = (n + 1) / 2.
 *
 * On `n = 4`: alpha = beta = 2.5, weights are smooth and concentrated
 * around the central two order statistics but every order statistic
 * carries strictly positive weight (no hard cutoff). On `n = 100`:
 * alpha = beta = 50.5; the central bump becomes narrower as `n` grows
 * but stays smooth.
 *
 * Mechanical class — fundamentally distinct from every shipped lens.
 *
 * Among shipped row-token location lenses, two families exist:
 *
 *   - **Hard-cutoff L-estimators** with deterministic 0/1 or
 *     uniform-on-a-subset weights: mean, mid-range, trim-mean-{10,
 *     20, 25, 30}, winsorized-mean-{10, 20}, median, midhinge,
 *     trimean, IQM. Every weight is either 0 or one of a handful
 *     of constants depending only on `n`.
 *
 *   - **Power means** (Lehmer, harmonic, contraharmonic,
 *     quadratic, geometric-by-implication): non-linear in the
 *     `x_i` themselves but symmetric and mechanically distinct
 *     from any L-estimator.
 *
 *   - **R-estimator / U-statistic** (Hodges-Lehmann): median of
 *     the Walsh-average multiset.
 *
 * The Harrell-Davis broadened median is a **smooth L-estimator**:
 * it is a linear combination of the order statistics like any
 * L-estimator, but the weights are a strictly positive smooth
 * function of `i/n`, NOT a 0/1 indicator and NOT a uniform-on-a-
 * subset constant. Concretely:
 *
 *   - The raw sample median puts weight 1 on `x_((n+1)/2)` (odd n)
 *     or weight 1/2 on each of `x_(n/2)`, `x_(n/2+1)` (even n).
 *     Every other order statistic gets weight 0. This is a "hard"
 *     L-estimator — the most extreme case of bandwidth 0 around
 *     the center.
 *   - The trim-mean-25 puts uniform weight `1 / floor(0.5 * n)`
 *     on the central 50 % of order statistics and 0 on the rest.
 *     This is a "rectangular" L-estimator with a flat top and
 *     hard cliffs at the edges.
 *   - The Harrell-Davis broadened median puts a **smooth bell**
 *     of Beta-derived weights centered on `i = (n + 1) / 2`,
 *     decaying smoothly to nearly-but-not-exactly zero at the
 *     extremes. Every order statistic contributes a positive
 *     amount; the contribution falls off smoothly with distance
 *     from the center.
 *
 * Why this matters mechanically:
 *
 *   - Re-arranging two interior order statistics within adjacent
 *     ranks changes HD by a smooth amount (the difference times
 *     two slightly different Beta-derived weights), whereas the
 *     raw median is unchanged unless the swap involves the central
 *     rank.
 *   - HD has **lower asymptotic variance** than the raw median
 *     and the raw quantile estimator at virtually every quantile
 *     for finite `n` — the smoothing trades a small bias for
 *     much-reduced sampling variability. At the population
 *     median of a normal distribution, HD's asymptotic relative
 *     efficiency vs the mean is about `2/pi ~= 0.637` (same as
 *     the raw median in the limit, but HD reaches it from above
 *     for finite `n`); for skewed distributions HD typically
 *     beats the raw median in MSE.
 *   - Breakdown point is `0.5` (same as the raw median — the
 *     central weights dominate enough that contaminating fewer
 *     than half the points cannot pull HD past the population
 *     median).
 *   - For symmetric distributions HD agrees with the population
 *     median in expectation; for asymmetric distributions HD
 *     estimates the population median as well (NOT the center of
 *     symmetry of (X+X')/2 the way HL does), but with smoother
 *     finite-sample behavior. This makes HD a mechanically
 *     distinct estimator of the same target as the raw median,
 *     and a mechanically distinct estimator from HL (different
 *     target on asymmetric distributions).
 *
 * Algorithm — exact O(n) Beta-CDF differencing.
 *
 * For each source we sort the n samples once (O(n log n)), then
 * compute the n+1 cumulative Beta-CDF values `I_{k/n}(alpha, beta)`
 * for k = 0..n via a continued-fraction expansion of the
 * regularized incomplete Beta function (the Numerical-Recipes
 * `betacf` algorithm, Lentz's method). The weights w_i are the n
 * consecutive differences. The HD pseudo-median is then a single
 * inner product. The continued fraction converges in O(1)
 * iterations per evaluation (typical 10-20 iterations to 1e-12),
 * so the per-source cost is O(n log n) for the sort + O(n) for
 * the weight computation + O(n) for the inner product.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — at `n = 4`
 *      alpha = beta = 2.5 and the Beta bell is wide enough that
 *      the broadened median is meaningfully distinct from the raw
 *      median; below n = 4 the smoothing has nothing to smooth).
 *   7. Sort samples ascending. Compute alpha = beta = (n + 1) / 2.
 *   8. Compute cumulative I_{k/n}(alpha, beta) for k = 0..n.
 *      Boundary values: I_0 = 0, I_1 = 1 exactly.
 *   9. Compute weights w_i = I_{i/n} - I_{(i-1)/n}.
 *  10. Compute HD = sum(w_i * x_(i)).
 *  11. Free byproducts:
 *        - `mean`              arithmetic mean of x (raw location)
 *        - `median`            ordinary sample median of x
 *        - `centerWeight`      weight on the central order statistic
 *                              (i = ceil((n + 1) / 2)) — quantifies how
 *                              "broad" the broadening is for this n
 *        - `weightSpread`      max(w_i) - min(w_i) over i (NB: min(w_i)
 *                              is at the extremes, max at the center)
 *        - `hdMeanGap`         signed `hd - mean`
 *        - `hdMedianGap`       signed `hd - median` (the headline signal:
 *                              how much smoothing shifted the location
 *                              estimate away from the raw median)
 *  12. Apply display gates:
 *        - `--min-rows`              (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-broadened-median`  (cohort selector)          -> droppedBelowMinBroadenedMedian.
 *  13. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenBroadenedMedianOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (need n >= 4 for the Beta(alpha, beta)
   * smoothing to be meaningfully distinct from the raw median).
   * Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Harrell-Davis broadened median is strictly
   * below this value. Cohort selector. Must be a finite,
   * non-negative number. Default 0.
   */
  minBroadenedMedian?: number;
  top?: number | null;
  sort?:
    | 'hd-desc'
    | 'hd-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenBroadenedMedianRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all rowsKept order statistics. */
  mean: number;
  /** Ordinary sample median of all rowsKept rows. */
  median: number;
  /** Harrell-Davis broadened median (HD at p = 0.5). */
  broadenedMedian: number;
  /** Beta-derived weight on the central order statistic. */
  centerWeight: number;
  /** max(w_i) - min(w_i) — quantifies the broadening's bell shape. */
  weightSpread: number;
  /** Signed gap broadenedMedian - mean. */
  hdMeanGap: number;
  /** Signed gap broadenedMedian - median. */
  hdMedianGap: number;
}

export interface SourceRowTokenBroadenedMedianReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minBroadenedMedian: number;
  top: number | null;
  sort:
    | 'hd-desc'
    | 'hd-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinBroadenedMedian: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenBroadenedMedianRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'hd-desc',
  'hd-asc',
  'mean-desc',
  'median-desc',
  'mean-gap-desc',
  'median-gap-desc',
  'rows',
  'source',
] as const;

function sampleMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n % 2 === 1) return sortedAsc[(n - 1) / 2]!;
  return (sortedAsc[n / 2 - 1]! + sortedAsc[n / 2]!) / 2;
}

/**
 * `ln(Gamma(x))` via the Lanczos approximation. Accurate to ~1e-14
 * for x > 0. Borrowed from Numerical Recipes' standard formulation.
 */
function lnGamma(x: number): number {
  const COF = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    ser += COF[j]! / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Continued-fraction expansion of the incomplete Beta function,
 * `betacf(a, b, x)`, evaluated at `x` strictly inside `(0, (a+1)/(a+b+2))`.
 * Standard Numerical Recipes / Lentz formulation. Converges in
 * O(1) iterations.
 */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-16;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) return h;
  }
  return h;
}

/**
 * Regularized incomplete Beta function `I_x(a, b)` — the CDF of a
 * Beta(a, b) random variable at x. Returns 0 for x <= 0 and 1 for
 * x >= 1. Otherwise uses the standard symmetry trick and `betacf`.
 */
export function regIncompleteBeta(a: number, b: number, x: number): number {
  if (!(x > 0)) return 0;
  if (!(x < 1)) return 1;
  const lnBetaTerm =
    lnGamma(a + b) -
    lnGamma(a) -
    lnGamma(b) +
    a * Math.log(x) +
    b * Math.log(1 - x);
  const bt = Math.exp(lnBetaTerm);
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/**
 * Compute the Harrell-Davis broadened median weights w_1..w_n.
 * Sum of weights is exactly 1 by construction (telescoping).
 */
export function harrellDavisMedianWeights(n: number): number[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`harrellDavisMedianWeights: n must be a positive integer (got ${n})`);
  }
  const a = (n + 1) / 2;
  const b = a; // symmetric: p = 0.5
  const cum = new Array<number>(n + 1);
  cum[0] = 0;
  cum[n] = 1;
  for (let k = 1; k < n; k += 1) {
    cum[k] = regIncompleteBeta(a, b, k / n);
  }
  const w = new Array<number>(n);
  for (let i = 1; i <= n; i += 1) {
    w[i - 1] = cum[i]! - cum[i - 1]!;
  }
  return w;
}

export function buildSourceRowTokenBroadenedMedian(
  queue: QueueLine[],
  opts: SourceRowTokenBroadenedMedianOptions = {},
): SourceRowTokenBroadenedMedianReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minBroadenedMedian = opts.minBroadenedMedian ?? 0;
  if (!Number.isFinite(minBroadenedMedian) || minBroadenedMedian < 0) {
    throw new Error(
      `minBroadenedMedian must be a finite, non-negative number (got ${opts.minBroadenedMedian})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'hd-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  const perSource = new Map<string, number[]>();

  let droppedInvalidHourStart = 0;
  let droppedInvalidTokens = 0;
  let droppedNegativeTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const tt = q.total_tokens;
    if (typeof tt !== 'number' || !Number.isFinite(tt)) {
      droppedInvalidTokens += 1;
      continue;
    }
    if (tt < 0) {
      droppedNegativeTokens += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push(tt);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceRowTokenBroadenedMedianRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);

    const w = harrellDavisMedianWeights(n);
    let hd = 0;
    let totalSum = 0;
    let wMin = Infinity;
    let wMax = -Infinity;
    for (let i = 0; i < n; i += 1) {
      const wi = w[i]!;
      hd += wi * sorted[i]!;
      totalSum += sorted[i]!;
      if (wi < wMin) wMin = wi;
      if (wi > wMax) wMax = wi;
    }
    const mean = totalSum / n;
    const median = sampleMedian(sorted);

    // Central order statistic index (1-based ceil((n+1)/2)) -> 0-based.
    const centerIdx0 = Math.ceil((n + 1) / 2) - 1;
    const centerWeight = w[centerIdx0]!;
    const weightSpread = wMax - wMin;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      median,
      broadenedMedian: hd,
      centerWeight,
      weightSpread,
      hdMeanGap: hd - mean,
      hdMedianGap: hd - median,
    });
  }

  let droppedBelowMinBroadenedMedian = 0;
  const survived: SourceRowTokenBroadenedMedianRow[] = [];
  for (const row of allRows) {
    if (minBroadenedMedian > 0 && row.broadenedMedian < minBroadenedMedian) {
      droppedBelowMinBroadenedMedian += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'hd-desc') primary = b.broadenedMedian - a.broadenedMedian;
    else if (sort === 'hd-asc') primary = a.broadenedMedian - b.broadenedMedian;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(b.hdMeanGap) - Math.abs(a.hdMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(b.hdMedianGap) - Math.abs(a.hdMedianGap);
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minRows,
    minBroadenedMedian,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinBroadenedMedian,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
