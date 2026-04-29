/**
 * source-row-token-m-estimator-cauchy: per-source **Cauchy
 * (Lorentzian) M-estimator of location** of `total_tokens` across
 * the source's queue rows.
 *
 * Definition. The Cauchy M-estimator solves the implicit equation
 *
 *     sum_i  psi_C( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_C` is the Cauchy
 * (Lorentzian) influence function:
 *
 *     psi_C(z) = z / ( 1 + (z/c)^2 )
 *
 * arising from the rho function
 *
 *     rho_C(z) = (c^2 / 2) * ln( 1 + (z/c)^2 )
 *
 * The Cauchy tuning constant `c = 2.3849` yields about 95 %
 * asymptotic relative efficiency at the normal distribution.
 * For the auxiliary scale `s` we use the median absolute deviation
 * rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w(z) = psi_C(z) / z = 1 / ( 1 + (z/c)^2 )
 *
 * (the un-normalized Cauchy / Lorentzian density up to a constant.)
 * Then iterate
 *
 *     mu_{k+1} = sum_i w(z_i) * x_i  /  sum_i w(z_i)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — **MONOTONE** (NON-redescending) M-estimator
 * with **infinite support** and **vanishing tail influence**.
 * This is the missing middle of the M-estimator coverage:
 *
 *   - **vs Huber (v0.6.209, monotone, c = 1.345)**: Huber psi clips
 *     to `+- c` forever — bounded but **constant nonzero** tail
 *     influence (psi(z) = sign(z) * c for |z| > c). Cauchy psi is
 *     also unbounded-support and never **redescends to zero**, but
 *     its tail influence **decays to zero asymptotically** like
 *     `c^2 / z` — so Cauchy and Huber agree that there is no hard
 *     cutoff and disagree on whether tail residuals retain
 *     constant pull (Huber: yes; Cauchy: no, fades like 1/z).
 *   - **vs Tukey biweight (v0.6.210, smooth polynomial,
 *     c = 4.685)**: Tukey psi has **compact support** — strictly
 *     zero past `+- c`. Cauchy psi is strictly nonzero everywhere
 *     and never reaches exactly zero.
 *   - **vs Hampel three-part (v0.6.211, piecewise-linear, knots
 *     1.7/3.4/8.5)**: Hampel psi is **piecewise linear** with three
 *     corners and a hard outer rejection at `+- 8.5`. Cauchy psi
 *     has **no corners, no plateau, and no hard cutoff**.
 *   - **vs Andrews sine (v0.6.212, sinusoidal, A = 1.339)**: Andrews
 *     has compact support at `+- A*pi`. Cauchy never hard-rejects
 *     and is monotone, not oscillating.
 *   - **vs Welsch (v0.6.213, Gaussian-kernel redescender,
 *     c = 2.9846)**: Welsch is a **redescender** — psi rises then
 *     falls back toward 0. Cauchy is **monotone increasing**
 *     forever (psi(z) -> sign(z) * (c^2 / z) -> 0 from above as
 *     |z| -> infinity, but never *decreases* past a peak). Both
 *     have infinite support and both downweight the tail toward
 *     0; they differ on whether psi is monotone (Cauchy) or
 *     non-monotone (Welsch).
 *   - **vs all L-estimators (median, trimean, broadened median,
 *     Hodges-Lehmann)**: rank-only weights, no IRLS, no implicit
 *     equation.
 *   - **vs power means (Lehmer, harmonic, contraharmonic,
 *     quadratic)**: weighted by power of `x` itself, never by
 *     residual.
 *
 * Cauchy is the **first MONOTONE M-estimator with vanishing tail
 * influence** in the suite (Huber's tail influence is bounded but
 * constant; Cauchy's decays like 1/z), the **first M-estimator
 * derived from a heavy-tailed location-scale density** (the
 * standard Cauchy / Lorentzian distribution has rho = -log
 * density), and **rounds out the M-estimator coverage between
 * Huber's monotone-bounded family and the redescender family
 * (Tukey/Hampel/Andrews/Welsch)**. Reports a unique
 * **three-bucket residual partition** keyed on **weight magnitude**:
 *
 *   - `coreRows`         rows with `w >= 0.5`
 *                        i.e. `|z| <= c` (the half-power knee)
 *   - `tailRows`         rows with `0.05 <= w < 0.5`
 *                        i.e. `c < |z| <= c * sqrt(19) ~ 4.36 c`
 *                        (down-weighted but still influential)
 *   - `farTailRows`     rows with `w < 0.05`
 *                       i.e. `|z| > c * sqrt(19) ~ 4.36 c`
 *                       (very small but strictly positive weight —
 *                       Cauchy never assigns w = 0 to a finite z)
 *
 * with `coreRows + tailRows + farTailRows = n`.
 *
 * Translation- and scale-equivariant. Breakdown 0.5 under the MAD
 * scale.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows tied at the median): we
 *     fall back to `s = max(1, 1e-12 * range)`. With this fallback
 *     non-tied rows get very large `|z|`, weight `~ c^2 / z^2 ~ 0`,
 *     and IRLS collapses onto the tied bulk. When ALL rows are
 *     tied, mu = the common value at iteration 1.
 *   - **All weights underflow to 0** at iteration k (theoretically
 *     impossible for Cauchy at finite z since w = 1 / (1 + (z/c)^2)
 *     is never zero for finite z, but defensive guard kept):
 *     we break and report the last valid mu.
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
 *   8. IRLS loop with Cauchy/Lorentzian psi at tuning `c`.
 *   9. Free byproducts:
 *        - `mean`             arithmetic mean of x
 *        - `median`           ordinary sample median of x
 *        - `mad`              raw MAD
 *        - `scale`            MAD / 0.6744... (the s used by IRLS)
 *        - `iterations`       number of IRLS iterations performed
 *        - `coreRows`         weight >= 0.5 at converged mu
 *        - `tailRows`         0.05 <= weight < 0.5 at converged mu
 *        - `farTailRows`      weight < 0.05 at converged mu
 *        - `cauchyMeanGap`    signed `cauchy - mean`
 *        - `cauchyMedianGap`  signed `cauchy - median`
 *  10. Apply display gates:
 *        - `--min-rows`        (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-cauchy`      (cohort selector)          -> droppedBelowMinCauchy.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorCauchyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Cauchy M-estimate is strictly below this
   * value. Cohort selector. Must be a finite, non-negative number.
   */
  minCauchy?: number;
  /**
   * Cauchy tuning constant `c` (in MAD units). Default 2.3849
   * (canonical, ~95% asymptotic relative efficiency at the normal).
   * Weight is `1 / (1 + (z/c)^2)` — never exactly zero for finite z,
   * decays like `c^2 / z^2` in the tail. Must be strictly positive
   * and finite.
   */
  tuning?: number;
  top?: number | null;
  sort?:
    | 'cauchy-desc'
    | 'cauchy-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'far-tail-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorCauchyRow {
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
  /** Cauchy / Lorentzian M-estimate (IRLS converged). */
  cauchy: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /**
   * Termination reason for the IRLS loop ('converged' on the
   * happy path; 'max-iter' or 'zero-weight' indicates a numerical
   * edge case worth surfacing per source).
   */
  converged: 'converged' | 'max-iter' | 'zero-weight';
  /** Rows with weight >= 0.5 at converged mu (|z| <= c, the half-power knee). */
  coreRows: number;
  /** Rows with 0.05 <= weight < 0.5 at converged mu (down-weighted). */
  tailRows: number;
  /** Rows with weight < 0.05 at converged mu (very small but strictly positive). */
  farTailRows: number;
  /** Signed gap cauchy - mean. */
  cauchyMeanGap: number;
  /** Signed gap cauchy - median. */
  cauchyMedianGap: number;
}

export interface SourceRowTokenMEstimatorCauchyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minCauchy: number;
  tuning: number;
  top: number | null;
  sort:
    | 'cauchy-desc'
    | 'cauchy-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'far-tail-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinCauchy: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorCauchyRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_TUNING = 2.3849;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;
/** Weight threshold separating high-confidence inliers (|z| <= c) from tail. */
const CORE_WEIGHT_THRESHOLD = 0.5;
/** Weight threshold below which a row is "far tail" (very small). */
const FAR_TAIL_WEIGHT_THRESHOLD = 0.05;

const VALID_SORTS = [
  'cauchy-desc',
  'cauchy-asc',
  'mean-desc',
  'median-desc',
  'mean-gap-desc',
  'median-gap-desc',
  'far-tail-desc',
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
 * Cauchy / Lorentzian weight `w(z) = 1 / (1 + (z/c)^2)`.
 *
 * - `w(0) = 1` exactly.
 * - `w(z) > 0` for every finite `z`: no hard rejection, no
 *   underflow within IEEE 754 representable range (since the
 *   denominator is `1 + (z/c)^2` which is always >= 1).
 * - Decays like `c^2 / z^2` in the tail (heavy-tailed): `w` halves
 *   at `|z| = c`, reaches 0.05 at `|z| = c * sqrt(19) ~ 4.36 c`,
 *   reaches 0.01 at `|z| = c * sqrt(99) ~ 9.95 c`.
 * - Equals (up to a constant) the standard Cauchy density at z/c.
 *
 * Pure helper exposed for testing.
 */
export function cauchyWeight(z: number, tuning: number): number {
  const r = z / tuning;
  return 1 / (1 + r * r);
}

/**
 * Compute the Cauchy / Lorentzian M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, converged, scale, mad, coreRows,
 * tailRows, farTailRows }`. Pure function; suitable for unit
 * testing in isolation.
 */
export function cauchyMEstimator(
  xs: number[],
  tuning: number = DEFAULT_TUNING,
): {
  mu: number;
  iterations: number;
  converged: 'converged' | 'max-iter' | 'zero-weight';
  scale: number;
  mad: number;
  coreRows: number;
  tailRows: number;
  farTailRows: number;
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
      tailRows: 0,
      farTailRows: 0,
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
      tailRows: 0,
      farTailRows: 0,
    };
  }
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `cauchyMEstimator: tuning must be a positive finite number (got ${tuning})`,
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
      const w = cauchyWeight(z, tuning);
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
  let tailRows = 0;
  let farTailRows = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (xs[i]! - mu) / s;
    const w = cauchyWeight(z, tuning);
    if (w >= CORE_WEIGHT_THRESHOLD) coreRows += 1;
    else if (w >= FAR_TAIL_WEIGHT_THRESHOLD) tailRows += 1;
    else farTailRows += 1;
  }

  return {
    mu,
    iterations,
    converged,
    scale: s,
    mad,
    coreRows,
    tailRows,
    farTailRows,
  };
}

export function buildSourceRowTokenMEstimatorCauchy(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorCauchyOptions = {},
): SourceRowTokenMEstimatorCauchyReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minCauchy = opts.minCauchy ?? 0;
  if (!Number.isFinite(minCauchy) || minCauchy < 0) {
    throw new Error(
      `minCauchy must be a finite, non-negative number (got ${opts.minCauchy})`,
    );
  }
  const tuning = opts.tuning ?? DEFAULT_TUNING;
  if (!Number.isFinite(tuning) || !(tuning > 0)) {
    throw new Error(
      `Cauchy tuning must be a positive finite number (got ${opts.tuning})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'cauchy-desc';
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
  const allRows: SourceRowTokenMEstimatorCauchyRow[] = [];
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
      tailRows,
      farTailRows,
    } = cauchyMEstimator(samples, tuning);

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      mad,
      scale,
      cauchy: mu,
      iterations,
      converged,
      coreRows,
      tailRows,
      farTailRows,
      cauchyMeanGap: mu - meanv,
      cauchyMedianGap: mu - medianv,
    });
  }

  let droppedBelowMinCauchy = 0;
  const survived: SourceRowTokenMEstimatorCauchyRow[] = [];
  for (const row of allRows) {
    if (minCauchy > 0 && row.cauchy < minCauchy) {
      droppedBelowMinCauchy += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'cauchy-desc') primary = q.cauchy - p.cauchy;
    else if (sort === 'cauchy-asc') primary = p.cauchy - q.cauchy;
    else if (sort === 'mean-desc') primary = q.mean - p.mean;
    else if (sort === 'median-desc') primary = q.median - p.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(q.cauchyMeanGap) - Math.abs(p.cauchyMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(q.cauchyMedianGap) - Math.abs(p.cauchyMedianGap);
    else if (sort === 'far-tail-desc')
      primary = q.farTailRows - p.farTailRows;
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
    minCauchy,
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
    droppedBelowMinCauchy,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
