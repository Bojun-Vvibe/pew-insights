/**
 * source-row-token-m-estimator-andrews: per-source **Andrews sine
 * redescending M-estimator of location** of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. The Andrews M-estimator solves the implicit equation
 *
 *     sum_i  psi_A( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_A` is the Andrews
 * **sine wave** influence function:
 *
 *     psi_A(z) = A * sin(z / A)   if |z| <= A * pi
 *              = 0                 if |z| >  A * pi
 *
 * The classical Andrews tuning is `A = 1.339`, which yields about
 * 95 % asymptotic relative efficiency at the normal distribution.
 * For the auxiliary scale `s` we use the median absolute deviation
 * rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w(z) = psi_A(z) / z
 *          = A * sin(z / A) / z   if 0 < |z| <= A * pi
 *          = 1                    if z = 0     (limit)
 *          = 0                    if |z| >  A * pi
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w(z_i) * x_i  /  sum_i w(z_i)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — REDESCENDING M-estimator, **smooth sinusoidal**.
 * Mechanically distinct from every previously shipped M-estimator and
 * from every L/R-estimator in the suite:
 *
 *   - **vs Huber (v0.6.209, monotone, c = 1.345)**: Huber psi clips to
 *     +- c forever — bounded but **nonzero** tail influence. Andrews
 *     eventually rejects entirely (`psi = 0` beyond `A*pi`), like
 *     Tukey and Hampel.
 *   - **vs Tukey biweight (v0.6.210, smooth polynomial,
 *     c = 4.685)**: Tukey psi is a degree-3 **polynomial**
 *     `z * (1 - (z/c)^2)^2`, tangent to 0 at +-c, monotone *only*
 *     on the inner core. Andrews psi is a **transcendental sine
 *     wave** with **derivative** `cos(z/A)` — it is monotone on
 *     `|z| <= A*pi/2`, then descends sinusoidally to 0 at +-A*pi.
 *     The two redescenders disagree on the *shape* of descent: Tukey
 *     descends as a quartic, Andrews as a half-cosine arch. They
 *     also disagree on the *rejection threshold* per MAD-unit:
 *     Andrews rejects beyond `A*pi ≈ 4.207`, Tukey beyond
 *     `c = 4.685`.
 *   - **vs Hampel three-part (v0.6.211, piecewise-linear,
 *     a=1.7, b=3.4, c=8.5)**: Hampel psi is **piecewise linear**
 *     with corners at +- a, b, c, and an inner *plateau* on
 *     `(a, b]` where psi is constant +- a. Andrews psi has **no
 *     corners and no plateau** — it is C-infinity smooth on its
 *     support and has a single peak at `z = A*pi/2`. Hampel rejects
 *     beyond `c = 8.5` MAD-units (much later than Andrews); Andrews
 *     rejects much earlier and more aggressively, but does so
 *     *smoothly*.
 *   - **vs all L-estimators (median, trimean, broadened median,
 *     Hodges-Lehmann)**: rank-only weights with no IRLS, no
 *     redescent.
 *   - **vs power means (Lehmer, harmonic, contraharmonic)**:
 *     weighted by power of x itself, never by residual.
 *
 * Andrews is the **first SINUSOIDAL / TRANSCENDENTAL redescender**
 * in the suite, the **first M-estimator with a single inflection
 * point in psi** (at `z = A*pi/2`), and uses the **most aggressive
 * rejection threshold** (`A*pi ≈ 4.207` MAD-units) of any shipped
 * redescender. Reports a unique **three-bucket residual partition**
 * per source (no other M-estimator in the suite reports this exact
 * partition):
 *
 *   - `coreRows`        rows with `|z| <= A*pi/2`   (rising half:
 *                       weight in `[2/pi, 1]`, full weight at z=0)
 *   - `descendingRows`  rows with `A*pi/2 < |z| <= A*pi`
 *                       (falling half: weight in `(0, 2/pi)`)
 *   - `rejectedRows`    rows with `|z| > A*pi`      (weight = 0)
 *
 * with `coreRows + descendingRows + rejectedRows = n`.
 *
 * Translation- and scale-equivariant. Breakdown 0.5 under the MAD
 * scale.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows tied at the median): we
 *     fall back to `s = max(1, 1e-12 * range)`. With this fallback
 *     any non-tied row gets `|z|` very large -> psi = 0 -> rejected,
 *     and IRLS collapses onto the tied bulk. When ALL rows are tied,
 *     mu = the common value at iteration 1.
 *   - **All weights zero** at iteration k (every residual is beyond
 *     A*pi at the current mu — possible at iteration 0 under
 *     degenerate scale): we break and report the last valid mu.
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
 *   8. IRLS loop with Andrews sine psi at tuning `A`.
 *   9. Free byproducts:
 *        - `mean`              arithmetic mean of x
 *        - `median`            ordinary sample median of x
 *        - `mad`               raw MAD
 *        - `scale`             MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`        number of IRLS iterations performed
 *        - `coreRows`          |z| <= A*pi/2 at converged mu
 *        - `descendingRows`    A*pi/2 < |z| <= A*pi at converged mu
 *        - `rejectedRows`      |z| > A*pi at converged mu (weight = 0)
 *        - `andrewsMeanGap`    signed `andrews - mean`
 *        - `andrewsMedianGap`  signed `andrews - median`
 *  10. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-andrews`     (cohort selector)          -> droppedBelowMinAndrews.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorAndrewsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Andrews M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minAndrews?: number;
  /**
   * Andrews tuning constant `A` (in MAD units). Default 1.339
   * (canonical, ~95% asymptotic relative efficiency at the normal).
   * Rows with `|z| > A*pi` are fully rejected (weight 0). Must be
   * strictly positive and finite.
   */
  tuning?: number;
  top?: number | null;
  sort?:
    | 'andrews-desc'
    | 'andrews-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rejected-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorAndrewsRow {
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
  /** Andrews sine M-estimate (IRLS converged). */
  andrews: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /** Rows with |z| <= A*pi/2 at converged mu (rising half of sine). */
  coreRows: number;
  /** Rows with A*pi/2 < |z| <= A*pi at converged mu (falling half). */
  descendingRows: number;
  /** Rows with |z| > A*pi at converged mu (weight = 0; rejected). */
  rejectedRows: number;
  /** Signed gap andrews - mean. */
  andrewsMeanGap: number;
  /** Signed gap andrews - median. */
  andrewsMedianGap: number;
}

export interface SourceRowTokenMEstimatorAndrewsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minAndrews: number;
  tuning: number;
  top: number | null;
  sort:
    | 'andrews-desc'
    | 'andrews-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rejected-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinAndrews: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorAndrewsRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_TUNING = 1.339;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;

const VALID_SORTS = [
  'andrews-desc',
  'andrews-asc',
  'mean-desc',
  'median-desc',
  'mean-gap-desc',
  'median-gap-desc',
  'rejected-desc',
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
 * Andrews sine weight `w(z) = psi_A(z) / z` with `psi_A(z) =
 * A * sin(z/A)` for `|z| <= A*pi`, else 0. `w(0) = 1` (the limit
 * `A * sin(z/A) / z -> 1` as `z -> 0`).
 *
 * Pure helper exposed for testing.
 */
export function andrewsWeight(z: number, tuning: number): number {
  const az = Math.abs(z);
  if (az === 0) return 1;
  if (az > tuning * Math.PI) return 0;
  return (tuning * Math.sin(z / tuning)) / z;
}

/**
 * Compute the Andrews sine M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, scale, mad, coreRows, descendingRows,
 * rejectedRows }`. Pure function; suitable for unit testing in
 * isolation.
 */
export function andrewsMEstimator(
  xs: number[],
  tuning: number = DEFAULT_TUNING,
): {
  mu: number;
  iterations: number;
  scale: number;
  mad: number;
  coreRows: number;
  descendingRows: number;
  rejectedRows: number;
} {
  const n = xs.length;
  if (n === 0) {
    return {
      mu: NaN,
      iterations: 0,
      scale: 0,
      mad: 0,
      coreRows: 0,
      descendingRows: 0,
      rejectedRows: 0,
    };
  }
  if (n === 1) {
    return {
      mu: xs[0]!,
      iterations: 0,
      scale: 0,
      mad: 0,
      coreRows: 1,
      descendingRows: 0,
      rejectedRows: 0,
    };
  }
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `andrewsMEstimator: tuning must be a positive finite number (got ${tuning})`,
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
  for (let iter = 1; iter <= IRLS_MAX_ITER; iter += 1) {
    let wsum = 0;
    let wxsum = 0;
    for (let i = 0; i < n; i += 1) {
      const z = (xs[i]! - mu) / s;
      const w = andrewsWeight(z, tuning);
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

  // Bucket counts at final mu.
  const halfCutoff = tuning * Math.PI * 0.5;
  const fullCutoff = tuning * Math.PI;
  let coreRows = 0;
  let descendingRows = 0;
  let rejectedRows = 0;
  for (let i = 0; i < n; i += 1) {
    const az = Math.abs((xs[i]! - mu) / s);
    if (az <= halfCutoff) coreRows += 1;
    else if (az <= fullCutoff) descendingRows += 1;
    else rejectedRows += 1;
  }

  return {
    mu,
    iterations,
    scale: s,
    mad,
    coreRows,
    descendingRows,
    rejectedRows,
  };
}

export function buildSourceRowTokenMEstimatorAndrews(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorAndrewsOptions = {},
): SourceRowTokenMEstimatorAndrewsReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minAndrews = opts.minAndrews ?? 0;
  if (!Number.isFinite(minAndrews) || minAndrews < 0) {
    throw new Error(
      `minAndrews must be a finite, non-negative number (got ${opts.minAndrews})`,
    );
  }
  const tuning = opts.tuning ?? DEFAULT_TUNING;
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `Andrews tuning must be a positive finite number (got ${opts.tuning})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'andrews-desc';
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
  const allRows: SourceRowTokenMEstimatorAndrewsRow[] = [];
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
      scale,
      mad,
      coreRows,
      descendingRows,
      rejectedRows,
    } = andrewsMEstimator(samples, tuning);

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      mad,
      scale,
      andrews: mu,
      iterations,
      coreRows,
      descendingRows,
      rejectedRows,
      andrewsMeanGap: mu - meanv,
      andrewsMedianGap: mu - medianv,
    });
  }

  let droppedBelowMinAndrews = 0;
  const survived: SourceRowTokenMEstimatorAndrewsRow[] = [];
  for (const row of allRows) {
    if (minAndrews > 0 && row.andrews < minAndrews) {
      droppedBelowMinAndrews += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'andrews-desc') primary = q.andrews - p.andrews;
    else if (sort === 'andrews-asc') primary = p.andrews - q.andrews;
    else if (sort === 'mean-desc') primary = q.mean - p.mean;
    else if (sort === 'median-desc') primary = q.median - p.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(q.andrewsMeanGap) - Math.abs(p.andrewsMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(q.andrewsMedianGap) - Math.abs(p.andrewsMedianGap);
    else if (sort === 'rejected-desc')
      primary = q.rejectedRows - p.rejectedRows;
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
    minAndrews,
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
    droppedBelowMinAndrews,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
