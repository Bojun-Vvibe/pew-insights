/**
 * source-row-token-m-estimator-tukey: per-source **Tukey biweight
 * (bisquare) M-estimator of location** of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. The Tukey biweight M-estimator solves the implicit
 * equation
 *
 *     sum_i  psi_c( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_c` is the Tukey
 * biweight (bisquare) influence function:
 *
 *     psi_c(z) = z * (1 - (z / c)^2)^2     if |z| <= c
 *              = 0                          if |z| >  c
 *
 * The canonical tuning constant is `c = 4.685`, which yields about
 * 95 % asymptotic relative efficiency at the normal distribution.
 * For the auxiliary scale `s` we use the median absolute deviation
 * rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w_i(mu) = psi_c(z_i) / z_i
 *             = (1 - (z_i / c)^2)^2     if |z_i| <= c
 *             = 0                        if |z_i| >  c
 *     (with z_i = (x_i - mu) / s; w_i defined as 1 when z_i = 0)
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w_i(mu_k) * x_i  /  sum_i w_i(mu_k)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — REDESCENDING M-estimator: distinct from Huber.
 *
 * The shipped suite already contains:
 *
 *   - **L-estimators** with rank-only weights (mean, mid-range,
 *     trim-mean-{10,20,25,30}, winsorized-mean-{10,20}, median,
 *     midhinge, trimean, IQM, HD broadened median).
 *   - **Power means** (Lehmer-k, harmonic, contraharmonic,
 *     quadratic, geometric).
 *   - **R-estimator** (Hodges-Lehmann).
 *   - **Monotone M-estimator** (Huber, c = 1.345): psi_c clips to
 *     +-c at the tails — a single far outlier still contributes
 *     `c * sign(z) * s` to the weighted sum (bounded but nonzero).
 *
 * Tukey biweight is the first **REDESCENDING** M-estimator in the
 * suite. The distinguishing property:
 *
 *   - **Zero influence beyond c**: any row with |z| > c contributes
 *     EXACTLY 0 to both numerator and denominator of the IRLS
 *     update — it is fully rejected, not merely clipped. Huber
 *     bounds the influence; Tukey eliminates it once the residual
 *     is large enough.
 *   - **Smooth on the support**: weights are a smooth degree-4
 *     polynomial of (z/c)^2 inside [-c, c], peaking at 1 at z = 0
 *     and tangent to 0 at z = +-c (both value and derivative
 *     vanish there). No discontinuity.
 *   - **Non-convex psi**: psi_c is not monotone (it rises, falls
 *     to 0 at +-c, and stays at 0 outside). IRLS is therefore
 *     only LOCALLY convergent. Initializing at the sample median
 *     (the strategy used here) is the standard, well-behaved
 *     choice and converges reliably on real data.
 *
 * Concretely, on a clean normal sample Tukey agrees closely with
 * the arithmetic mean (efficiency ~95 %); on a sample with extreme
 * outliers Tukey is even more robust than Huber — it not only
 * caps but discards the outlying rows entirely. We expose
 * `rejectedRows` (count of rows with |z| > c at the converged mu;
 * weight = 0) as the headline diagnostic, distinct from Huber's
 * `clippedRows` (rows with bounded but nonzero weight).
 *
 * Translation equivariance is exact (`tukey(x + a) = tukey(x) + a`);
 * scale equivariance is exact when `s` is computed consistently
 * (`tukey(k * x) = k * tukey(x)` for `k > 0`); the breakdown point
 * under the MAD scale is `0.5`.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows are tied at the
 *     median): we fall back to `s = max(1, 1e-12 * range)`. With
 *     this fallback any non-tied row gets `|z|` very large -> psi
 *     = 0 -> rejected, and the IRLS update collapses onto the
 *     tied bulk. When ALL rows are tied, mu = the common value
 *     and IRLS terminates at iteration 1.
 *   - **All weights zero** (pathological: every residual is
 *     beyond c at the current mu — possible at iteration 0 if the
 *     median is far from all bulks under degenerate scale): we
 *     break the loop and report the last valid mu.
 *   - **n = 1**: trivially mu = x_1.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4).
 *   7. Sort samples ascending (only needed for median/MAD).
 *   8. Compute `mu_0 = median`, `MAD`, `s = MAD / 0.6744897501960817`
 *      (with eps fallback if MAD is 0).
 *   9. IRLS loop with Tukey biweight psi at c = 4.685.
 *  10. Free byproducts:
 *        - `mean`              arithmetic mean of x
 *        - `median`            ordinary sample median of x
 *        - `mad`               raw MAD
 *        - `scale`             MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`        number of IRLS iterations performed
 *        - `rejectedRows`      count of rows whose final residual
 *                              had |z| > c (weight = 0; fully
 *                              rejected — distinct from Huber's
 *                              `clippedRows` which had bounded
 *                              nonzero weight)
 *        - `tukeyMeanGap`      signed `tukey - mean`
 *        - `tukeyMedianGap`    signed `tukey - median`
 *  11. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-tukey`       (cohort selector)          -> droppedBelowMinTukey.
 *  12. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorTukeyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Tukey M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minTukey?: number;
  /**
   * Tukey biweight tuning constant. Default 4.685 (canonical:
   * ~95% ARE at the normal). Larger c -> closer to the mean
   * (less robust); smaller c -> more aggressive rejection.
   * Must be a finite positive number.
   */
  c?: number;
  top?: number | null;
  sort?:
    | 'tukey-desc'
    | 'tukey-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorTukeyRow {
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
  /** Tukey biweight M-estimate (IRLS converged). */
  tukey: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /**
   * Number of rows whose final residual was Tukey-rejected
   * (|z| > c -> weight exactly 0). Distinct from Huber's
   * clippedRows (bounded but nonzero weight).
   */
  rejectedRows: number;
  /** Signed gap tukey - mean. */
  tukeyMeanGap: number;
  /** Signed gap tukey - median. */
  tukeyMedianGap: number;
}

export interface SourceRowTokenMEstimatorTukeyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minTukey: number;
  c: number;
  top: number | null;
  sort:
    | 'tukey-desc'
    | 'tukey-asc'
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
  droppedBelowMinTukey: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorTukeyRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_C = 4.685;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;

const VALID_SORTS = [
  'tukey-desc',
  'tukey-asc',
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
 * Compute the Tukey biweight M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, scale, mad, rejectedRows }`.
 * Pure function; suitable for unit testing in isolation.
 */
export function tukeyBiweightMEstimator(
  xs: number[],
  c: number = DEFAULT_C,
): {
  mu: number;
  iterations: number;
  scale: number;
  mad: number;
  rejectedRows: number;
} {
  const n = xs.length;
  if (n === 0) {
    return { mu: NaN, iterations: 0, scale: 0, mad: 0, rejectedRows: 0 };
  }
  if (n === 1) {
    return { mu: xs[0]!, iterations: 0, scale: 0, mad: 0, rejectedRows: 0 };
  }
  if (!(c > 0) || !Number.isFinite(c)) {
    throw new Error(
      `tukeyBiweightMEstimator: c must be a finite positive number (got ${c})`,
    );
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
      let w = 0;
      if (az <= c) {
        const u = z / c;
        const oneMinusU2 = 1 - u * u;
        w = oneMinusU2 * oneMinusU2;
      }
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

  // Count Tukey-rejected rows at final mu (|z| > c -> weight 0).
  let rejectedRows = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (xs[i]! - mu) / s;
    if (Math.abs(z) > c) rejectedRows += 1;
  }

  return { mu, iterations, scale: s, mad, rejectedRows };
}

export function buildSourceRowTokenMEstimatorTukey(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorTukeyOptions = {},
): SourceRowTokenMEstimatorTukeyReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minTukey = opts.minTukey ?? 0;
  if (!Number.isFinite(minTukey) || minTukey < 0) {
    throw new Error(
      `minTukey must be a finite, non-negative number (got ${opts.minTukey})`,
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
  const sort = opts.sort ?? 'tukey-desc';
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
  const allRows: SourceRowTokenMEstimatorTukeyRow[] = [];
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

    const { mu, iterations, scale, mad, rejectedRows } =
      tukeyBiweightMEstimator(samples, c);

    allRows.push({
      source,
      rowsKept: n,
      mean,
      median,
      mad,
      scale,
      tukey: mu,
      iterations,
      rejectedRows,
      tukeyMeanGap: mu - mean,
      tukeyMedianGap: mu - median,
    });
  }

  let droppedBelowMinTukey = 0;
  const survived: SourceRowTokenMEstimatorTukeyRow[] = [];
  for (const row of allRows) {
    if (minTukey > 0 && row.tukey < minTukey) {
      droppedBelowMinTukey += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tukey-desc') primary = b.tukey - a.tukey;
    else if (sort === 'tukey-asc') primary = a.tukey - b.tukey;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(b.tukeyMeanGap) - Math.abs(a.tukeyMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(b.tukeyMedianGap) - Math.abs(a.tukeyMedianGap);
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
    minTukey,
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
    droppedBelowMinTukey,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
