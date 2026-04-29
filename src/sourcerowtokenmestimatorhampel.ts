/**
 * source-row-token-m-estimator-hampel: per-source **Hampel three-part
 * redescending M-estimator of location** of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. The Hampel M-estimator solves the implicit equation
 *
 *     sum_i  psi_{a,b,c}( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_{a,b,c}` is the
 * Hampel three-part piecewise-linear influence function:
 *
 *     psi(z) = z                              if |z| <= a
 *            = a * sign(z)                    if a < |z| <= b
 *            = a * sign(z) * (c - |z|) / (c - b)
 *                                             if b < |z| <= c
 *            = 0                              if |z| >  c
 *
 * The classical Hampel tuning is `(a, b, c) = (1.7, 3.4, 8.5)` in MAD
 * units, which yields about 95 % asymptotic relative efficiency at the
 * normal distribution. For the auxiliary scale `s` we use the median
 * absolute deviation rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w(z) = psi(z) / z
 *          = 1                                if |z| <= a
 *          = a / |z|                          if a < |z| <= b
 *          = a / |z| * (c - |z|) / (c - b)    if b < |z| <= c
 *          = 0                                if |z| >  c
 *     (with w defined as 1 when z = 0)
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w(z_i) * x_i  /  sum_i w(z_i)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — REDESCENDING M-estimator, three-part piecewise
 * linear. Distinct from BOTH currently shipped M-estimators:
 *
 *   - **vs Huber (v0.6.209, c = 1.345)**: Huber psi is monotone and
 *     clips to +- c at the tails (bounded but NONZERO influence
 *     forever). Hampel psi is monotone only on the inner core
 *     [-a, +a]; on (a, b] it plateaus at +-a; on (b, c] it
 *     LINEARLY DESCENDS from +-a to 0; beyond c it is exactly 0.
 *     Hampel therefore eventually rejects extreme rows entirely
 *     (like Tukey, unlike Huber).
 *   - **vs Tukey biweight (v0.6.210, c = 4.685)**: Tukey psi is
 *     SMOOTH on its support (degree-3 polynomial), tangent to 0 at
 *     +-c (both value and derivative vanish). Hampel psi is
 *     PIECEWISE LINEAR with corners at +-a, +-b, +-c. The descent
 *     from full influence to zero is therefore SHARPER and
 *     CONFIGURABLE via the (b, c) gap: a long (b, c) gap gives a
 *     gentle descent (close to Tukey-like behaviour), a short
 *     (b, c) gap gives a near-step rejection (close to a "hard"
 *     redescender). Tukey is a single-knob estimator; Hampel is a
 *     three-knob estimator, and the inner plateau on (a, b]
 *     contributes a constant +-a to psi (qualitatively different
 *     from Tukey's smooth peak).
 *
 * Hampel is the FIRST PIECEWISE-LINEAR REDESCENDER and the FIRST
 * THREE-PART (rather than two-part) M-estimator in the suite. Concretely
 * it produces three diagnostic row counts per source:
 *
 *   - `coreRows`        rows with |z| <= a       (full-weight)
 *   - `plateauRows`     rows with a < |z| <= b   (constant psi = a)
 *   - `descendingRows`  rows with b < |z| <= c   (linear psi descent)
 *   - `rejectedRows`    rows with |z| > c        (psi = 0)
 *
 * with `coreRows + plateauRows + descendingRows + rejectedRows = n`.
 * This makes Hampel uniquely diagnostic across the M-estimator family:
 * Huber's table reports clipped-vs-not (two buckets); Tukey's reports
 * rejected-vs-not (two buckets); Hampel reports the full four-bucket
 * partition of the residual axis.
 *
 * Translation equivariance is exact (`hampel(x + a0) = hampel(x) + a0`);
 * scale equivariance is exact when `s` is computed consistently
 * (`hampel(k * x) = k * hampel(x)` for `k > 0`); the breakdown point
 * under the MAD scale is `0.5`.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows tied at the median): we
 *     fall back to `s = max(1, 1e-12 * range)`. With this fallback
 *     any non-tied row gets `|z|` very large -> psi = 0 -> rejected,
 *     and IRLS collapses onto the tied bulk. When ALL rows are tied,
 *     mu = the common value at iteration 1.
 *   - **All weights zero** at iteration k (every residual is beyond c
 *     at the current mu — possible at iteration 0 under degenerate
 *     scale): we break and report the last valid mu.
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
 *   8. IRLS loop with Hampel three-part psi at (a, b, c).
 *   9. Free byproducts:
 *        - `mean`              arithmetic mean of x
 *        - `median`            ordinary sample median of x
 *        - `mad`               raw MAD
 *        - `scale`             MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`        number of IRLS iterations performed
 *        - `coreRows`          |z| <= a at converged mu (full weight)
 *        - `plateauRows`       a < |z| <= b at converged mu (psi = a)
 *        - `descendingRows`    b < |z| <= c at converged mu (linear)
 *        - `rejectedRows`      |z| > c at converged mu (weight = 0)
 *        - `hampelMeanGap`     signed `hampel - mean`
 *        - `hampelMedianGap`   signed `hampel - median`
 *  10. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-hampel`      (cohort selector)          -> droppedBelowMinHampel.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorHampelOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Hampel M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minHampel?: number;
  /**
   * Hampel inner knot `a` (in MAD units). Default 1.7 (canonical).
   * Rows with |z| <= a get full weight 1.
   * Must satisfy 0 < a < b < c.
   */
  a?: number;
  /**
   * Hampel middle knot `b` (in MAD units). Default 3.4 (canonical).
   * Rows with a < |z| <= b get psi = a (constant plateau).
   */
  b?: number;
  /**
   * Hampel outer knot `c` (in MAD units). Default 8.5 (canonical).
   * Rows with b < |z| <= c are linearly descended; rows with
   * |z| > c are fully rejected (weight 0).
   */
  c?: number;
  top?: number | null;
  sort?:
    | 'hampel-desc'
    | 'hampel-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rejected-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorHampelRow {
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
  /** Hampel three-part M-estimate (IRLS converged). */
  hampel: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /** Rows with |z| <= a at converged mu (full weight). */
  coreRows: number;
  /** Rows with a < |z| <= b at converged mu (psi plateau at a). */
  plateauRows: number;
  /** Rows with b < |z| <= c at converged mu (linear descent). */
  descendingRows: number;
  /** Rows with |z| > c at converged mu (weight = 0; fully rejected). */
  rejectedRows: number;
  /** Signed gap hampel - mean. */
  hampelMeanGap: number;
  /** Signed gap hampel - median. */
  hampelMedianGap: number;
}

export interface SourceRowTokenMEstimatorHampelReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minHampel: number;
  a: number;
  b: number;
  c: number;
  top: number | null;
  sort:
    | 'hampel-desc'
    | 'hampel-asc'
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
  droppedBelowMinHampel: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorHampelRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_A = 1.7;
const DEFAULT_B = 3.4;
const DEFAULT_C = 8.5;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;

const VALID_SORTS = [
  'hampel-desc',
  'hampel-asc',
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
 * Hampel three-part weight w(z) = psi(z) / z (with w(0) = 1).
 *
 * Pure helper exposed for testing.
 */
export function hampelWeight(
  z: number,
  a: number,
  b: number,
  c: number,
): number {
  const az = Math.abs(z);
  if (az === 0) return 1;
  if (az <= a) return 1;
  if (az <= b) return a / az;
  if (az <= c) return (a / az) * ((c - az) / (c - b));
  return 0;
}

/**
 * Compute the Hampel three-part M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, scale, mad, coreRows, plateauRows,
 * descendingRows, rejectedRows }`.
 * Pure function; suitable for unit testing in isolation.
 */
export function hampelMEstimator(
  xs: number[],
  a: number = DEFAULT_A,
  b: number = DEFAULT_B,
  c: number = DEFAULT_C,
): {
  mu: number;
  iterations: number;
  scale: number;
  mad: number;
  coreRows: number;
  plateauRows: number;
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
      plateauRows: 0,
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
      plateauRows: 0,
      descendingRows: 0,
      rejectedRows: 0,
    };
  }
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    !(a > 0) ||
    !(b > a) ||
    !(c > b)
  ) {
    throw new Error(
      `hampelMEstimator: knots must satisfy 0 < a < b < c (got a=${a}, b=${b}, c=${c})`,
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
      const w = hampelWeight(z, a, b, c);
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
  let coreRows = 0;
  let plateauRows = 0;
  let descendingRows = 0;
  let rejectedRows = 0;
  for (let i = 0; i < n; i += 1) {
    const az = Math.abs((xs[i]! - mu) / s);
    if (az <= a) coreRows += 1;
    else if (az <= b) plateauRows += 1;
    else if (az <= c) descendingRows += 1;
    else rejectedRows += 1;
  }

  return {
    mu,
    iterations,
    scale: s,
    mad,
    coreRows,
    plateauRows,
    descendingRows,
    rejectedRows,
  };
}

export function buildSourceRowTokenMEstimatorHampel(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorHampelOptions = {},
): SourceRowTokenMEstimatorHampelReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minHampel = opts.minHampel ?? 0;
  if (!Number.isFinite(minHampel) || minHampel < 0) {
    throw new Error(
      `minHampel must be a finite, non-negative number (got ${opts.minHampel})`,
    );
  }
  const a = opts.a ?? DEFAULT_A;
  const b = opts.b ?? DEFAULT_B;
  const c = opts.c ?? DEFAULT_C;
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    !Number.isFinite(c) ||
    !(a > 0) ||
    !(b > a) ||
    !(c > b)
  ) {
    throw new Error(
      `Hampel knots must satisfy 0 < a < b < c (got a=${opts.a}, b=${opts.b}, c=${opts.c})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'hampel-desc';
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
  const allRows: SourceRowTokenMEstimatorHampelRow[] = [];
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
      plateauRows,
      descendingRows,
      rejectedRows,
    } = hampelMEstimator(samples, a, b, c);

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      mad,
      scale,
      hampel: mu,
      iterations,
      coreRows,
      plateauRows,
      descendingRows,
      rejectedRows,
      hampelMeanGap: mu - meanv,
      hampelMedianGap: mu - medianv,
    });
  }

  let droppedBelowMinHampel = 0;
  const survived: SourceRowTokenMEstimatorHampelRow[] = [];
  for (const row of allRows) {
    if (minHampel > 0 && row.hampel < minHampel) {
      droppedBelowMinHampel += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'hampel-desc') primary = q.hampel - p.hampel;
    else if (sort === 'hampel-asc') primary = p.hampel - q.hampel;
    else if (sort === 'mean-desc') primary = q.mean - p.mean;
    else if (sort === 'median-desc') primary = q.median - p.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(q.hampelMeanGap) - Math.abs(p.hampelMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(q.hampelMedianGap) - Math.abs(p.hampelMedianGap);
    else if (sort === 'rejected-desc') primary = q.rejectedRows - p.rejectedRows;
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
    minHampel,
    a,
    b,
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
    droppedBelowMinHampel,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
