/**
 * source-row-token-m-estimator-geman-mcclure: per-source
 * **Geman-McClure M-estimator of location** of `total_tokens`
 * across the source's queue rows.
 *
 * Definition. The Geman-McClure M-estimator solves the implicit
 * equation
 *
 *     sum_i  psi_GM( (x_i - mu) / s )  =  0
 *
 * for `mu`, where `s` is a robust scale and `psi_GM` is the
 * Geman-McClure influence function:
 *
 *     psi_GM(z) = 2 z / ( 1 + z^2 )^2
 *
 * arising from the rho function
 *
 *     rho_GM(z) = z^2 / ( 1 + z^2 )
 *
 * Note: Geman-McClure has **no tuning constant**. The single
 * canonical form is parameter-free; robustness is built in to the
 * shape of rho itself (rho saturates at 1 as |z| -> infinity).
 * This is the first M-estimator in the suite **without a tuning
 * constant**. For the auxiliary scale `s` we use the median
 * absolute deviation rescaled to a normal-consistent estimate:
 *
 *     MAD = median_i |x_i - median(x)|
 *     s   = MAD / 0.6744897501960817   (Phi^{-1}(0.75))
 *
 * Algorithm — iteratively reweighted least squares (IRLS).
 *
 *     w(z) = psi_GM(z) / z = 2 / ( 1 + z^2 )^2
 *
 * Then iterate
 *
 *     mu_{k+1} = sum_i w(z_i) * x_i  /  sum_i w(z_i)
 *
 * starting from `mu_0 = median(x)` until `|mu_{k+1} - mu_k| <=
 * eps * max(1, s)` or a hard iteration cap is hit.
 *
 * Mechanical class — **REDESCENDER** with **infinite support**
 * and **quartic tail decay** (`w ~ 2/z^4`). Distinct from every
 * prior M-estimator:
 *
 *   - **vs Huber (v0.6.207, monotone, c = 1.345)**: Huber psi
 *     clips to constant `+- c` forever — bounded but *constant*
 *     nonzero tail. Geman-McClure psi rises, peaks at `|z| =
 *     1/sqrt(3) ~ 0.577`, then **redescends to 0** like `2/z^3`.
 *   - **vs Tukey biweight (v0.6.208, smooth polynomial,
 *     c = 4.685)**: Tukey psi has **compact support** — strictly
 *     zero past `+- c`. Geman-McClure psi is strictly nonzero
 *     everywhere and never reaches exactly zero (only
 *     asymptotically).
 *   - **vs Hampel (v0.6.209, piecewise-linear, knots
 *     1.7/3.4/8.5)**: Hampel psi has corners and a hard outer
 *     rejection at `+- 8.5`. Geman-McClure psi is smooth
 *     everywhere and never hard-rejects.
 *   - **vs Andrews sine (v0.6.212, sinusoidal, A = 1.339)**:
 *     Andrews has compact support at `+- A*pi`. Geman-McClure
 *     has infinite support and a single peak (no oscillation).
 *   - **vs Welsch (v0.6.213, Gaussian-kernel redescender,
 *     c = 2.9846)**: both are smooth redescenders with infinite
 *     support, but Welsch tail decays **exponentially**
 *     (`w = exp(-(z/c)^2)`), Geman-McClure tail decays
 *     **polynomially** (`w ~ 2/z^4`) — qualitatively heavier
 *     descent. Welsch has a tuning constant; Geman-McClure does
 *     not.
 *   - **vs Cauchy (v0.6.215, monotone, c = 2.3849)**: Cauchy is
 *     **monotone** with `1/z^2` tail; Geman-McClure
 *     **redescends** with `1/z^4` tail — strictly faster
 *     downweighting and a peak-and-fall shape vs Cauchy's rise
 *     forever.
 *
 * Geman-McClure is the **first PARAMETER-FREE M-estimator** in
 * the suite (no tuning constant), and the **first redescender
 * with polynomial (~1/z^4) tail decay** — sitting between
 * Cauchy's monotone `1/z^2` and Tukey's compact-support hard
 * cutoff. Originally proposed by Geman & McClure (1987) for
 * robust image reconstruction; widely used in computer vision
 * (bundle adjustment, optical flow) precisely because it has no
 * threshold to tune.
 *
 * Reports a unique **three-bucket residual partition** keyed on
 * **weight magnitude** (relative to the maximum w(0) = 2):
 *
 *   - `coreRows`     rows with `w >= 1` (i.e. >= 50% of peak weight)
 *                    iff `(1 + z^2)^2 <= 2`, i.e. `|z| <= sqrt(sqrt(2) - 1)
 *                    ~ 0.6436` (the half-peak knee)
 *   - `tailRows`     rows with `0.05 <= w < 1`
 *                    i.e. `0.6436 < |z| <= sqrt(sqrt(40) - 1)
 *                    ~ 2.299` (down-weighted but still influential)
 *   - `farTailRows`  rows with `w < 0.05`
 *                    i.e. `|z| > 2.299` (very small but strictly
 *                    positive — Geman-McClure never assigns
 *                    w = 0 to a finite z)
 *
 * with `coreRows + tailRows + farTailRows = n`.
 *
 * Translation- and scale-equivariant. Breakdown 0.5 under MAD scale.
 *
 * Edge cases:
 *
 *   - **MAD = 0** (more than half the rows tied at the median):
 *     fall back to `s = max(1, 1e-12 * range)`. Non-tied rows
 *     get very large `|z|`, weight `~ 2/z^4 ~ 0`, IRLS collapses
 *     to the tied bulk. When ALL rows are tied, mu = the common
 *     value at iteration 1.
 *   - **All weights underflow to 0**: defensive guard returns
 *     last valid mu with `converged: 'zero-weight'`.
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
 *   7. Compute `mu_0 = median`, `MAD`, `s = MAD / 0.6744...`.
 *   8. IRLS loop with Geman-McClure psi.
 *   9. Free byproducts:
 *        - `mean`, `median`, `mad`, `scale`, `iterations`
 *        - `coreRows`, `tailRows`, `farTailRows`
 *        - `gemanMeanGap`, `gemanMedianGap`, `gemanMedianRatio`
 *  10. Apply display gates: `--min-rows` (>=4), `--min-geman`.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMEstimatorGemanMcClureOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /**
   * Drop sources whose Geman-McClure M-estimate is strictly below
   * this value. Cohort selector. Must be finite, non-negative.
   */
  minGeman?: number;
  top?: number | null;
  sort?:
    | 'geman-desc'
    | 'geman-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'far-tail-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenMEstimatorGemanMcClureRow {
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
  /** Geman-McClure M-estimate (IRLS converged). */
  geman: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /** Termination reason for the IRLS loop. */
  converged: 'converged' | 'max-iter' | 'zero-weight';
  /** Rows with w >= 1 (>= 50% of peak weight 2). */
  coreRows: number;
  /** Rows with 0.05 <= w < 1. */
  tailRows: number;
  /** Rows with w < 0.05 (very small but strictly positive). */
  farTailRows: number;
  /** Signed gap geman - mean. */
  gemanMeanGap: number;
  /** Signed gap geman - median. */
  gemanMedianGap: number;
  /**
   * Geman-McClure estimate as a ratio of the sample median:
   * `geman / median` when `median > 0`; `1` when both `geman` and
   * `median` are exactly zero; `NaN` when `median = 0` but
   * `geman != 0`. Dimensionless diagnostic; values near `1.0`
   * mean the IRLS center agrees with the classical median.
   */
  gemanMedianRatio: number;
}

export interface SourceRowTokenMEstimatorGemanMcClureReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minGeman: number;
  top: number | null;
  sort:
    | 'geman-desc'
    | 'geman-asc'
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
  droppedBelowMinGeman: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMEstimatorGemanMcClureRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
/** Phi^{-1}(0.75): MAD-to-sigma normal-consistency constant. */
const MAD_NORMAL_CONST = 0.6744897501960817;
const IRLS_EPS = 1e-10;
const IRLS_MAX_ITER = 200;
/** Weight threshold for "core" inliers: w >= 1 = 50% of peak (2). */
const CORE_WEIGHT_THRESHOLD = 1;
/** Weight threshold below which a row is "far tail". */
const FAR_TAIL_WEIGHT_THRESHOLD = 0.05;

const VALID_SORTS = [
  'geman-desc',
  'geman-asc',
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
 * Geman-McClure weight `w(z) = 2 / (1 + z^2)^2`.
 *
 * - `w(0) = 2` exactly (peak weight; note this is NOT 1 — the
 *   peak comes from psi(z) = 2z/(1+z^2)^2 having slope 2 at z=0).
 * - `w(z) > 0` for every finite `z`: no hard rejection, no
 *   underflow within IEEE 754 representable range.
 * - Decays like `2/z^4` in the tail (quartic — strictly faster
 *   than Cauchy's `c^2/z^2` and slower than Tukey's compact
 *   support).
 * - `w(0.6436) = 1` (the half-peak knee).
 *
 * Pure helper exposed for testing.
 */
export function gemanMcClureWeight(z: number): number {
  const denom = 1 + z * z;
  return 2 / (denom * denom);
}

/**
 * Compute the Geman-McClure M-estimator of location via IRLS.
 *
 * Returns `{ mu, iterations, converged, scale, mad, coreRows,
 * tailRows, farTailRows }`. Pure function; suitable for unit
 * testing in isolation. No tuning constant — the Geman-McClure
 * rho is canonically parameter-free.
 */
export function gemanMcClureMEstimator(xs: number[]): {
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
  const sorted = xs.slice().sort((p, q) => p - q);
  const med = sampleMedian(sorted);
  const absDev = xs.map((x) => Math.abs(x - med));
  const mad = medianOfArray(absDev);
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
      const w = gemanMcClureWeight(z);
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

  let coreRows = 0;
  let tailRows = 0;
  let farTailRows = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (xs[i]! - mu) / s;
    const w = gemanMcClureWeight(z);
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

export function buildSourceRowTokenMEstimatorGemanMcClure(
  queue: QueueLine[],
  opts: SourceRowTokenMEstimatorGemanMcClureOptions = {},
): SourceRowTokenMEstimatorGemanMcClureReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minGeman = opts.minGeman ?? 0;
  if (!Number.isFinite(minGeman) || minGeman < 0) {
    throw new Error(
      `minGeman must be a finite, non-negative number (got ${opts.minGeman})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'geman-desc';
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
  const allRows: SourceRowTokenMEstimatorGemanMcClureRow[] = [];
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
    } = gemanMcClureMEstimator(samples);

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      mad,
      scale,
      geman: mu,
      iterations,
      converged,
      coreRows,
      tailRows,
      farTailRows,
      gemanMeanGap: mu - meanv,
      gemanMedianGap: mu - medianv,
      gemanMedianRatio:
        medianv > 0 ? mu / medianv : medianv === 0 && mu === 0 ? 1 : NaN,
    });
  }

  let droppedBelowMinGeman = 0;
  const survived: SourceRowTokenMEstimatorGemanMcClureRow[] = [];
  for (const row of allRows) {
    if (minGeman > 0 && row.geman < minGeman) {
      droppedBelowMinGeman += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'geman-desc') primary = q.geman - p.geman;
    else if (sort === 'geman-asc') primary = p.geman - q.geman;
    else if (sort === 'mean-desc') primary = q.mean - p.mean;
    else if (sort === 'median-desc') primary = q.median - p.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(q.gemanMeanGap) - Math.abs(p.gemanMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(q.gemanMedianGap) - Math.abs(p.gemanMedianGap);
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
    minGeman,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinGeman,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
