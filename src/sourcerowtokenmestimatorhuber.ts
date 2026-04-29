/**
 * source-row-token-m-estimator-huber: per-source **Huber M-estimator
 * of location** of `total_tokens` across the source's queue rows.
 *
 * Definition. The Huber M-estimator solves the implicit equation
 *
 *     sum_i  psi_c( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_c` is the Huber
 * influence function:
 *
 *     psi_c(z) = z              if |z| <= c
 *              = c * sign(z)    if |z| >  c
 *
 * The canonical tuning constant is `c = 1.345`, which yields
 * about 95 % asymptotic relative efficiency at the normal
 * distribution while bounding influence (an outlier z can never
 * pull mu by more than `c * s`). For the auxiliary scale `s` we
 * use the median absolute deviation rescaled to a normal-consistent
 * estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w_i(mu) = psi_c(z_i) / z_i              with z_i = (x_i - mu) / s
 *             = 1                              if |z_i| <= c
 *             = c * sign(z_i) / z_i = c / |z_i|   if |z_i| >  c
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w_i(mu_k) * x_i  /  sum_i w_i(mu_k)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit. With Huber psi
 * (convex), IRLS is globally convergent and typically terminates in
 * 5-15 iterations.
 *
 * Mechanical class — fundamentally distinct from every shipped lens.
 *
 * Among shipped row-token location lenses we already have:
 *
 *   - **L-estimators** with deterministic weights (mean,
 *     mid-range, trim-mean-{10,20,25,30}, winsorized-mean-{10,20},
 *     median, midhinge, trimean, IQM): each `x_(i)` carries a
 *     fixed weight that depends ONLY on its rank `i` and `n` —
 *     not on the data values themselves.
 *   - **Smooth L-estimator** (Harrell-Davis broadened median):
 *     same property — weights depend only on `i` and `n` via the
 *     Beta CDF.
 *   - **Power means** (Lehmer-k, harmonic, contraharmonic,
 *     quadratic, geometric): each row `x_i` is transformed by
 *     a fixed nonlinear function before averaging — weights are
 *     not data-adaptive in the order-statistic sense, and the
 *     transformation itself does not depend on the data.
 *   - **R-estimator / U-statistic** (Hodges-Lehmann): operates
 *     on the multiset of pairwise Walsh averages — uses *ranks*
 *     of those pairwise averages rather than residuals.
 *
 * The Huber M-estimator is the first **M-estimator** in the lens
 * suite. M-estimators distinguish themselves by:
 *
 *   - **Data-adaptive weights**: `w_i = w_i(mu)` depends on the
 *     residual `x_i - mu` itself, not on the rank `i`. Two rows
 *     with the same value get the same weight; two rows with
 *     different values get different weights even if their ranks
 *     are adjacent.
 *   - **Iterative**: there is no closed form. Each step recomputes
 *     weights from the previous mu, then takes a weighted mean.
 *   - **Bounded influence**: the Huber psi caps the leverage of
 *     any single observation at `c * s` (in residual units) —
 *     unlike the mean (unbounded influence) and similar in spirit
 *     to the median (also bounded), but with a smooth approach
 *     that retains efficiency near the bulk.
 *
 * Concretely, on a clean normal sample Huber agrees closely with
 * the arithmetic mean (efficiency ~95 %); on a sample with a few
 * extreme outliers Huber lies between the mean (which is dragged
 * by the outlier) and the median (which ignores the outlier
 * entirely), but typically much closer to the median. Translation
 * equivariance is exact (`huber(x + a) = huber(x) + a`); scale
 * equivariance is exact when `s` is computed consistently
 * (`huber(k * x) = k * huber(x)` for `k > 0`); the breakdown
 * point under the MAD scale is `0.5` (since MAD itself has 0.5
 * breakdown and Huber's psi caps individual influence).
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows are tied at the
 *     median): every residual is either 0 or has `|z| = inf`,
 *     so Huber psi clamps to `+- c` for the non-tied rows. We
 *     handle this by setting `s = max(MAD / 0.6744..., epsScale)`
 *     where `epsScale = max(1, 1e-12 * (max(x) - min(x)))`.
 *     With this fallback Huber reduces to a clipped-mean-style
 *     estimate that gracefully degenerates to the median value
 *     itself when ALL rows are tied.
 *   - **All rows equal**: MAD = 0, range = 0, residuals all 0,
 *     mu_0 = median = mean = the common value; IRLS terminates
 *     at iteration 1 with no change.
 *   - **n = 1**: trivially mu = x_1.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — IRLS works
 *      for n >= 1, but n >= 4 lets MAD be a meaningful scale).
 *   7. Sort samples ascending (only needed for median/MAD).
 *   8. Compute `mu_0 = median`, `MAD`, `s = MAD / 0.6744897501960817`
 *      (with epsScale fallback if MAD is 0).
 *   9. IRLS loop with Huber psi at c = 1.345; stop when
 *      `|mu_{k+1} - mu_k| <= eps * max(1, s)` or `iter >= maxIter`.
 *  10. Free byproducts:
 *        - `mean`              arithmetic mean of x
 *        - `median`            ordinary sample median of x
 *        - `mad`               raw MAD
 *        - `scale`             MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`        number of IRLS iterations performed
 *        - `clippedRows`       count of rows whose final residual
 *                              had |z| > c (i.e. were Huber-clipped)
 *        - `huberMeanGap`      signed `huber - mean`
 *        - `huberMedianGap`    signed `huber - median` (the headline
 *                              signal: how much Huber moved the
 *                              location estimate from the median
 *                              toward the mean)
 *  11. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-huber`       (cohort selector)          -> droppedBelowMinHuber.
 *  12. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorHuberOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (need n >= 4 for MAD to be a
   * meaningful scale estimate).
   */
  minRows?: number;
  /**
   * Drop sources whose Huber M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minHuber?: number;
  /**
   * Huber tuning constant. Default 1.345 (canonical: ~95% ARE at
   * the normal). Larger c -> closer to the mean (less robust);
   * smaller c -> closer to the median (more robust). Must be a
   * finite positive number.
   */
  c?: number;
  top?: number | null;
  sort?:
    | 'huber-desc'
    | 'huber-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorHuberRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of x. */
  mean: number;
  /** Sample median of x. */
  median: number;
  /** Raw median absolute deviation from the median. */
  mad: number;
  /** Normal-consistent scale: MAD / 0.6744... (with eps fallback). */
  scale: number;
  /** Huber M-estimate (IRLS converged). */
  huber: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /** Number of rows whose final residual was Huber-clipped (|z| > c). */
  clippedRows: number;
  /** Signed gap huber - mean. */
  huberMeanGap: number;
  /** Signed gap huber - median. */
  huberMedianGap: number;
}

export interface SourceRowTokenMEstimatorHuberReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minHuber: number;
  c: number;
  top: number | null;
  sort:
    | 'huber-desc'
    | 'huber-asc'
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
  droppedBelowMinHuber: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorHuberRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_C = 1.345;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;

const VALID_SORTS = [
  'huber-desc',
  'huber-asc',
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

function medianOfArray(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return sampleMedian(s);
}

/**
 * Compute the Huber M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, scale, mad, clippedRows }`.
 * Pure function; suitable for unit testing in isolation.
 */
export function huberMEstimator(
  xs: number[],
  c: number = DEFAULT_C,
): {
  mu: number;
  iterations: number;
  scale: number;
  mad: number;
  clippedRows: number;
} {
  const n = xs.length;
  if (n === 0) {
    return { mu: NaN, iterations: 0, scale: 0, mad: 0, clippedRows: 0 };
  }
  if (n === 1) {
    return { mu: xs[0]!, iterations: 0, scale: 0, mad: 0, clippedRows: 0 };
  }
  if (!(c > 0) || !Number.isFinite(c)) {
    throw new Error(`huberMEstimator: c must be a finite positive number (got ${c})`);
  }
  const sorted = xs.slice().sort((a, b) => a - b);
  const med = sampleMedian(sorted);
  const absDev = xs.map((x) => Math.abs(x - med));
  const mad = medianOfArray(absDev);
  // Normal-consistent scale with eps fallback.
  const range = sorted[n - 1]! - sorted[0]!;
  const epsScale = Math.max(1, 1e-12 * range);
  let s = mad / MAD_NORMAL_CONST;
  if (!(s > 0)) s = epsScale;

  let mu = med;
  let iterations = 0;
  for (let iter = 1; iter <= IRLS_MAX_ITER; iter += 1) {
    let wsum = 0;
    let wxsum = 0;
    for (let i = 0; i < n; i += 1) {
      const r = xs[i]! - mu;
      const z = r / s;
      const az = Math.abs(z);
      const w = az <= c ? 1 : c / az;
      wsum += w;
      wxsum += w * xs[i]!;
    }
    if (!(wsum > 0)) {
      iterations = iter;
      break;
    }
    const muNext = wxsum / wsum;
    iterations = iter;
    if (Math.abs(muNext - mu) <= IRLS_EPS * Math.max(1, s)) {
      mu = muNext;
      break;
    }
    mu = muNext;
  }

  // Count Huber-clipped rows at final mu.
  let clippedRows = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (xs[i]! - mu) / s;
    if (Math.abs(z) > c) clippedRows += 1;
  }

  return { mu, iterations, scale: s, mad, clippedRows };
}

export function buildSourceRowTokenMEstimatorHuber(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorHuberOptions = {},
): SourceRowTokenMEstimatorHuberReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minHuber = opts.minHuber ?? 0;
  if (!Number.isFinite(minHuber) || minHuber < 0) {
    throw new Error(
      `minHuber must be a finite, non-negative number (got ${opts.minHuber})`,
    );
  }
  const c = opts.c ?? DEFAULT_C;
  if (!Number.isFinite(c) || !(c > 0)) {
    throw new Error(`c must be a finite positive number (got ${opts.c})`);
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'huber-desc';
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
  const allRows: SourceRowTokenMEstimatorHuberRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    const mean = totalSum / n;
    const median = sampleMedian(sorted);

    const { mu, iterations, scale, mad, clippedRows } = huberMEstimator(
      samples,
      c,
    );

    allRows.push({
      source,
      rowsKept: n,
      mean,
      median,
      mad,
      scale,
      huber: mu,
      iterations,
      clippedRows,
      huberMeanGap: mu - mean,
      huberMedianGap: mu - median,
    });
  }

  let droppedBelowMinHuber = 0;
  const survived: SourceRowTokenMEstimatorHuberRow[] = [];
  for (const row of allRows) {
    if (minHuber > 0 && row.huber < minHuber) {
      droppedBelowMinHuber += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'huber-desc') primary = b.huber - a.huber;
    else if (sort === 'huber-asc') primary = a.huber - b.huber;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(b.huberMeanGap) - Math.abs(a.huberMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(b.huberMedianGap) - Math.abs(a.huberMedianGap);
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
    minHuber,
    c,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinHuber,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
