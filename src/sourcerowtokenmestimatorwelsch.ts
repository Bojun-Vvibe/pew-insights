/**
 * source-row-token-m-estimator-welsch: per-source **Welsch (Leclerc)
 * Gaussian-kernel redescending M-estimator of location** of
 * `total_tokens` across the source's queue rows.
 *
 * Definition. The Welsch M-estimator solves the implicit equation
 *
 *     sum_i  psi_W( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_W` is the Welsch
 * **Gaussian-kernel** influence function:
 *
 *     psi_W(z) = z * exp( -(z/c)^2 / 2 )
 *
 * arising from the rho function
 *
 *     rho_W(z) = (c^2 / 2) * ( 1 - exp( -(z/c)^2 / 2 ) )
 *
 * The Welsch tuning constant `c = 2.9846` yields about 95 %
 * asymptotic relative efficiency at the normal distribution. For
 * the auxiliary scale `s` we use the median absolute deviation
 * rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w(z) = psi_W(z) / z = exp( -(z/c)^2 / 2 )
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w(z_i) * x_i  /  sum_i w(z_i)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — REDESCENDING M-estimator,
 * **smooth Gaussian (asymptotically rejecting, never exactly
 * zero)**. Mechanically distinct from every previously shipped
 * M-estimator and from every L/R-estimator in the suite:
 *
 *   - **vs Huber (v0.6.209, monotone, c = 1.345)**: Huber psi clips
 *     to +- c forever — bounded but **nonzero** tail influence.
 *     Welsch psi *also* never reaches exactly 0, but unlike Huber
 *     it **redescends** to a vanishing influence asymptotically
 *     (exponentially fast). Welsch and Huber agree that no row is
 *     ever fully rejected, but disagree on whether tail residuals
 *     keep contributing meaningfully (Huber: yes, Welsch: no).
 *   - **vs Tukey biweight (v0.6.210, smooth polynomial,
 *     c = 4.685)**: Tukey psi is a degree-3 **polynomial** with
 *     **compact support** — strictly zero past `+- c`. Welsch psi
 *     has **infinite support** — Gaussian decay, never exactly
 *     zero. Tukey gives a hard rejection cliff; Welsch gives a
 *     soft asymptotic fade.
 *   - **vs Hampel three-part (v0.6.211, piecewise-linear, knots
 *     1.7/3.4/8.5)**: Hampel psi is **piecewise linear** with three
 *     corners and a hard outer rejection at `+- c = +-8.5`. Welsch
 *     psi has **no corners, no plateau, and no hard cutoff** — it
 *     is C-infinity smooth on all of R, with a single monotone
 *     decay envelope.
 *   - **vs Andrews sine (v0.6.212, sinusoidal, A = 1.339)**: Andrews
 *     psi is a **transcendental sine wave** with **compact support**
 *     — strictly zero past `+- A*pi`. Welsch psi is also
 *     transcendental but is a **Gaussian decay** with **infinite
 *     support**. Andrews uses the most aggressive *hard* rejection
 *     threshold of any shipped redescender; Welsch never hard-rejects
 *     anything — instead it down-weights to negligible influence.
 *   - **vs all L-estimators (median, trimean, broadened median,
 *     Hodges-Lehmann)**: rank-only weights, no IRLS, no redescent.
 *   - **vs power means (Lehmer, harmonic, contraharmonic)**: weighted
 *     by power of x itself, never by residual.
 *
 * Welsch is the **first GAUSSIAN-KERNEL redescender** in the suite,
 * the **first redescender with INFINITE SUPPORT** (no hard
 * rejection cutoff — every row keeps a strictly positive weight),
 * and the **first redescender whose weight equals a probability
 * density up to constant** (Gaussian kernel, equivalent to the
 * EM-algorithm soft-assignment weight for a single-Gaussian model
 * with bandwidth `c`). Reports a unique **three-bucket residual
 * partition** based on **weight magnitude** rather than support
 * cutoff (no other M-estimator in the suite reports a partition
 * keyed on weight, because every other shipped M-estimator hits a
 * compact support cutoff first):
 *
 *   - `coreRows`         rows with `w >= 0.5`
 *                        i.e. `|z| <= c * sqrt(2 * ln 2) ~ 2.484`
 *                        (high-confidence inliers)
 *   - `descendingRows`   rows with `0.01 <= w < 0.5`
 *                        i.e. `2.484 < |z| <= c * sqrt(2*ln 100) ~ 9.046`
 *                        (down-weighted, still influential)
 *   - `negligibleRows`   rows with `w < 0.01`
 *                        i.e. `|z| > c * sqrt(2*ln 100) ~ 9.046`
 *                        (effectively rejected, but NOT exactly zero —
 *                        Welsch never assigns w = 0 to a finite z)
 *
 * with `coreRows + descendingRows + negligibleRows = n`.
 *
 * Translation- and scale-equivariant. Breakdown 0.5 under the MAD
 * scale.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows tied at the median): we
 *     fall back to `s = max(1, 1e-12 * range)`. With this fallback
 *     non-tied rows get very large `|z|`, weight `~ exp(-huge) ~ 0`,
 *     and IRLS collapses onto the tied bulk. When ALL rows are
 *     tied, mu = the common value at iteration 1.
 *   - **All weights underflow to 0** at iteration k (every residual
 *     so far in the tail that even Gaussian weight underflows in
 *     IEEE 754): we break and report the last valid mu.
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
 *   7. Compute `mu_0 = median`, `MAD`, `s = MAD / 0.6744...` (with
 *      eps fallback if MAD = 0).
 *   8. IRLS loop with Welsch Gaussian psi at tuning `c`.
 *   9. Free byproducts:
 *        - `mean`              arithmetic mean of x
 *        - `median`            ordinary sample median of x
 *        - `mad`               raw MAD
 *        - `scale`             MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`        number of IRLS iterations performed
 *        - `coreRows`          weight >= 0.5 at converged mu
 *        - `descendingRows`    0.01 <= weight < 0.5 at converged mu
 *        - `negligibleRows`    weight < 0.01 at converged mu
 *        - `welschMeanGap`     signed `welsch - mean`
 *        - `welschMedianGap`   signed `welsch - median`
 *  10. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-welsch`      (cohort selector)          -> droppedBelowMinWelsch.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorWelschOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Welsch M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minWelsch?: number;
  /**
   * Welsch tuning constant `c` (in MAD units). Default 2.9846
   * (canonical, ~95% asymptotic relative efficiency at the normal).
   * Weight is `exp(-(z/c)^2/2)` — never exactly zero, but decays
   * Gaussian-fast in `|z|`. Must be strictly positive and finite.
   */
  tuning?: number;
  top?: number | null;
  sort?:
    | 'welsch-desc'
    | 'welsch-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'negligible-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorWelschRow {
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
  /** Welsch Gaussian-kernel M-estimate (IRLS converged). */
  welsch: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /**
   * Termination reason for the IRLS loop ('converged' on the
   * happy path; 'max-iter' or 'zero-weight' indicates a numerical
   * edge case worth surfacing per source).
   */
  converged: 'converged' | 'max-iter' | 'zero-weight';
  coreRows: number;
  /** Rows with 0.01 <= weight < 0.5 at converged mu (down-weighted). */
  descendingRows: number;
  /** Rows with weight < 0.01 at converged mu (effectively rejected, never exactly 0). */
  negligibleRows: number;
  /** Signed gap welsch - mean. */
  welschMeanGap: number;
  /** Signed gap welsch - median. */
  welschMedianGap: number;
}

export interface SourceRowTokenMEstimatorWelschReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minWelsch: number;
  tuning: number;
  top: number | null;
  sort:
    | 'welsch-desc'
    | 'welsch-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'negligible-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinWelsch: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorWelschRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_TUNING = 2.9846;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;
/** Weight threshold separating high-confidence inliers from descenders. */
const CORE_WEIGHT_THRESHOLD = 0.5;
/** Weight threshold below which a row is "negligible" (effectively rejected). */
const NEGLIGIBLE_WEIGHT_THRESHOLD = 0.01;

const VALID_SORTS = [
  'welsch-desc',
  'welsch-asc',
  'mean-desc',
  'median-desc',
  'mean-gap-desc',
  'median-gap-desc',
  'negligible-desc',
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
 * Welsch (Leclerc) Gaussian-kernel weight `w(z) = exp(-(z/c)^2/2)`.
 *
 * - `w(0) = 1` exactly.
 * - `w(z) > 0` for every finite `z`: no hard rejection.
 * - Decays Gaussian-fast: `w` halves at `|z| = c * sqrt(2 * ln 2)`,
 *   reaches 0.01 at `|z| = c * sqrt(2 * ln 100)`, and underflows to
 *   IEEE 754 zero at extremely large `|z|`.
 *
 * Pure helper exposed for testing.
 */
export function welschWeight(z: number, tuning: number): number {
  const r = z / tuning;
  return Math.exp(-(r * r) / 2);
}

/**
 * Compute the Welsch (Leclerc) Gaussian-kernel M-estimator of
 * location via IRLS.
 *
 * Returns `{ mu, iterations, converged, scale, mad, coreRows,
 * descendingRows, negligibleRows }`. Pure function; suitable for
 * unit testing in isolation.
 */
export function welschMEstimator(
  xs: number[],
  tuning: number = DEFAULT_TUNING,
): {
  mu: number;
  iterations: number;
  converged: 'converged' | 'max-iter' | 'zero-weight';
  scale: number;
  mad: number;
  coreRows: number;
  descendingRows: number;
  negligibleRows: number;
} {
  const n = xs.length;
  if (n === 0) {
    return {
      mu: NaN,
      iterations: 0,
      converged: 'converged',
      scale: 0,
      mad: 0,
      coreRows: 0,
      descendingRows: 0,
      negligibleRows: 0,
    };
  }
  if (n === 1) {
    return {
      mu: xs[0]!,
      iterations: 0,
      converged: 'converged',
      scale: 0,
      mad: 0,
      coreRows: 1,
      descendingRows: 0,
      negligibleRows: 0,
    };
  }
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `welschMEstimator: tuning must be a positive finite number (got ${tuning})`,
    );
  }
  const sorted = xs.slice().sort((p, q) => p - q);
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
  let converged: 'converged' | 'max-iter' | 'zero-weight' = 'max-iter';
  for (let iter = 1; iter <= IRLS_MAX_ITER; iter += 1) {
    let wsum = 0;
    let wxsum = 0;
    for (let i = 0; i < n; i += 1) {
      const z = (xs[i]! - mu) / s;
      const w = welschWeight(z, tuning);
      wsum += w;
      wxsum += w * xs[i]!;
    }
    if (!(wsum > 0)) {
      iterations = iter;
      converged = 'zero-weight';
      break;
    }
    const muNext = wxsum / wsum;
    iterations = iter;
    if (Math.abs(muNext - mu) <= IRLS_EPS * Math.max(1, s)) {
      mu = muNext;
      converged = 'converged';
      break;
    }
    mu = muNext;
  }

  // Bucket counts at final mu, keyed on weight magnitude.
  let coreRows = 0;
  let descendingRows = 0;
  let negligibleRows = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (xs[i]! - mu) / s;
    const w = welschWeight(z, tuning);
    if (w >= CORE_WEIGHT_THRESHOLD) coreRows += 1;
    else if (w >= NEGLIGIBLE_WEIGHT_THRESHOLD) descendingRows += 1;
    else negligibleRows += 1;
  }

  return {
    mu,
    iterations,
    converged,
    scale: s,
    mad,
    coreRows,
    descendingRows,
    negligibleRows,
  };
}

export function buildSourceRowTokenMEstimatorWelsch(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorWelschOptions = {},
): SourceRowTokenMEstimatorWelschReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minWelsch = opts.minWelsch ?? 0;
  if (!Number.isFinite(minWelsch) || minWelsch < 0) {
    throw new Error(
      `minWelsch must be a finite, non-negative number (got ${opts.minWelsch})`,
    );
  }
  const tuning = opts.tuning ?? DEFAULT_TUNING;
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `Welsch tuning must be a positive finite number (got ${opts.tuning})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'welsch-desc';
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
  const allRows: SourceRowTokenMEstimatorWelschRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((p, q) => p - q);
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    const meanv = totalSum / n;
    const medianv = sampleMedian(sorted);

    const {
      mu,
      iterations,
      converged,
      scale,
      mad,
      coreRows,
      descendingRows,
      negligibleRows,
    } = welschMEstimator(samples, tuning);

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      mad,
      scale,
      welsch: mu,
      iterations,
      converged,
      coreRows,
      descendingRows,
      negligibleRows,
      welschMeanGap: mu - meanv,
      welschMedianGap: mu - medianv,
    });
  }

  let droppedBelowMinWelsch = 0;
  const survived: SourceRowTokenMEstimatorWelschRow[] = [];
  for (const row of allRows) {
    if (minWelsch > 0 && row.welsch < minWelsch) {
      droppedBelowMinWelsch += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'welsch-desc') primary = q.welsch - p.welsch;
    else if (sort === 'welsch-asc') primary = p.welsch - q.welsch;
    else if (sort === 'mean-desc') primary = q.mean - p.mean;
    else if (sort === 'median-desc') primary = q.median - p.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(q.welschMeanGap) - Math.abs(p.welschMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(q.welschMedianGap) - Math.abs(p.welschMedianGap);
    else if (sort === 'negligible-desc')
      primary = q.negligibleRows - p.negligibleRows;
    else if (sort === 'rows') primary = q.rowsKept - p.rowsKept;
    else primary = p.source < q.source ? -1 : p.source > q.source ? 1 : 0;
    if (primary !== 0) return primary;
    return p.source < q.source ? -1 : p.source > q.source ? 1 : 0;
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
    minWelsch,
    tuning,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinWelsch,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
