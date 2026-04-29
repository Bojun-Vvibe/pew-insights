/**
 * source-row-token-deming-slope: per-source **Deming regression**
 * slope of per-row `total_tokens` against row index, in tokens / row.
 *
 * Definition. Given the source's `n` rows in chronological order
 * `(t_i, x_i)` with `t_i = i` (0-based row index) and `x_i =
 * total_tokens`, the **Deming regression** estimator (Deming 1943,
 * "Statistical Adjustment of Data") is the **parametric maximum-
 * likelihood errors-in-both-variables (EIV) slope** under bivariate
 * normal noise with a fixed variance ratio
 * `lambda = var(epsilon_y) / var(epsilon_x)`:
 *
 *   1. Center: `xbar = mean(t_i)`, `ybar = mean(x_i)`.
 *   2. Form sums of squares around the centroid:
 *        `s_xx = sum (t_i - xbar)^2`
 *        `s_yy = sum (x_i - ybar)^2`
 *        `s_xy = sum (t_i - xbar) * (x_i - ybar)`
 *   3. Closed-form slope (the larger root of the EIV likelihood):
 *        `b = (s_yy - lambda * s_xx
 *              + sqrt((s_yy - lambda * s_xx)^2 + 4 * lambda * s_xy^2))
 *             / (2 * s_xy)`
 *   4. `intercept = ybar - b * xbar`.
 *
 * For `lambda -> 0` (no error in y) the formula collapses to the
 * inverse OLS slope `s_xy / s_xx`. For `lambda -> infinity` (no
 * error in x) it collapses to the OLS-of-x-on-y reciprocal. For
 * `lambda = 1` (equal error variances on both axes) it becomes
 * **orthogonal regression** — the slope that minimizes perpendicular
 * distances.
 *
 * Headline question: **for each source, what is the parametric
 * maximum-likelihood per-row trend in token magnitude under a
 * Gaussian errors-in-both-variables model with a tunable variance
 * ratio lambda?**
 *
 * Mechanical class — **parametric MLE EIV regression (closed-form,
 * x<->y SYMMETRIC at lambda=1, lambda-tunable, NO IRLS, NO ranks,
 * NO pairs)**. Mechanically distinct from every previously shipped
 * lens in the suite, including its closest siblings:
 *
 *   - **vs source-row-token-passing-bablok-slope (v0.6.218,
 *     non-parametric EIV)**: Passing-Bablok also targets EIV
 *     regression (and is x<->y symmetric) but does so via a
 *     *non-parametric R-estimator* — the shifted median of the
 *     pairwise slope cloud, ~29.3% breakdown, no distributional
 *     assumption. Deming is the **parametric sibling**: closed-form
 *     MLE under bivariate normal noise, **0% breakdown** (a single
 *     extreme outlier moves it), but it gives you a tunable knob
 *     (lambda) that PB does not. Same EIV target, opposite
 *     assumption stance. The two are exactly the parametric and
 *     non-parametric arms of the EIV axis.
 *   - **vs source-row-token-theil-sen-slope (v0.6.214) and
 *     source-row-token-siegel-slope (v0.6.216)**: Theil-Sen and
 *     Siegel are y-asymmetric (regress y on x — assumes the index
 *     axis is exact). Deming is x<->y SYMMETRIC at lambda = 1 and
 *     more generally invariant up to the lambda swap (regress y on
 *     x with lambda, swap to regress x on y, you must use 1/lambda
 *     and you get the reciprocal slope).
 *   - **vs source-daily-token-trend-slope (OLS on daily aggregates)**:
 *     OLS assumes the index axis is error-free and minimizes vertical
 *     residuals only. Deming minimizes a weighted sum of squared
 *     residuals on **both** axes; OLS is the lambda -> 0 limit of
 *     Deming.
 *   - **vs the M-estimator family (Huber/Tukey/Hampel/Andrews/Welsch/
 *     Cauchy/Geman-McClure, v0.6.207-v0.6.217)**: those are
 *     **location** estimators (one robust mean per source) computed
 *     by IRLS on residuals from a single center. Deming is a
 *     **trend / slope** estimator with a closed form and no IRLS.
 *   - **vs source-row-token-mann-kendall-trend (v0.6.211)**:
 *     Mann-Kendall reports rank-correlation tau and a p-value of
 *     monotone trend; it does not give a slope magnitude. Deming is
 *     a **point estimate of the slope itself** in tokens / row.
 *
 * This lens is the **first parametric EIV regression** in the suite
 * — every prior slope lens is either (a) y-asymmetric and assumes
 * the index axis is exact (Theil-Sen, Siegel, OLS), or (b)
 * non-parametric EIV (Passing-Bablok). Deming completes the
 * errors-in-both-variables axis with the parametric / closed-form
 * MLE option.
 *
 * Reports the **lambda echo + lambda-sensitivity diagnostic** so the
 * caller can see how much the answer depends on the assumed variance
 * ratio:
 *
 *   - `lambda`             the assumed variance ratio (default 1)
 *   - `slope`              the Deming slope at the supplied lambda
 *   - `slopeAtLambdaHalf`  slope re-evaluated at lambda / 2
 *   - `slopeAtLambdaTwo`   slope re-evaluated at lambda * 2
 *   - `lambdaSensitivity`  `slopeAtLambdaTwo - slopeAtLambdaHalf`,
 *                          the literal slope range across a 4x
 *                          lambda sweep. Small absolute value =>
 *                          the slope is robust to lambda choice;
 *                          large => the answer materially depends on
 *                          which axis you assigned more error to.
 *
 * Translation- and scale-equivariant in y (and in x with the
 * inverse-scale rule — the index axis is always integer here). When
 * `s_xy = 0` the formula is singular; we fall through to a 0 slope
 * (no linear EIV trend at any lambda).
 *
 * Edge cases:
 *
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: `s_yy = 0`, `s_xy = 0`. We report
 *     `slope = 0`, `intercept = x_1`, lambda-sensitivity = 0.
 *   - **`lambda <= 0`**: rejected at option-validation time (must be
 *     a finite positive number).
 *   - **n large**: O(n) (single pass for centroid, single pass for
 *     sums) — no pair guard required.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown'),
 *      sorting per-source rows by `hour_start` ascending (ties
 *      broken by original input order).
 *   6. Per source: skip if `n < minRows` (default 4).
 *   7. Compute centroid, s_xx, s_yy, s_xy in one pass.
 *   8. Apply the Deming closed form at the supplied lambda. Also
 *      evaluate at lambda/2 and lambda*2 for the sensitivity field.
 *   9. Free byproducts:
 *        - `mean`                arithmetic mean of x
 *        - `median`              ordinary sample median of x
 *        - `firstX` / `lastX`    chronological endpoints
 *        - `naiveSlope`          `(lastX - firstX) / (n - 1)`
 *        - `olsSlope`            ordinary `s_xy / s_xx` (lambda -> 0
 *                                limit of Deming)
 *        - `demingVsOlsGap`      `slope - olsSlope`
 *        - `demingVsNaiveGap`    `slope - naiveSlope`
 *        - `slopeAtLambdaHalf`, `slopeAtLambdaTwo`,
 *          `lambdaSensitivity` (see above)
 *        - `slopeSign`           'up' | 'down' | 'flat'
 *        - `slopeMagnitude`      |slope|
 *  10. Apply display gates:
 *        - `--min-rows`             (absolute floor 4)        -> droppedBelowMinRows.
 *        - `--min-slope-magnitude`  cohort selector           -> droppedBelowMinSlopeMagnitude.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenDemingSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Drop sources whose `|slope|` is strictly below this value. Finite, non-negative. */
  minSlopeMagnitude?: number;
  /**
   * Variance ratio `lambda = var(epsilon_y) / var(epsilon_x)`.
   * Must be a finite, strictly positive number. Default 1
   * (orthogonal regression, x<->y symmetric).
   */
  lambda?: number;
  top?: number | null;
  sort?:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'gap-desc'
    | 'gap-magnitude-desc'
    | 'naive-gap-magnitude-desc'
    | 'lambda-sensitivity-desc'
    | 'lambda-sensitivity-relative-desc'
    | 'sign-flipped-from-ols-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenDemingSlopeRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of x. */
  mean: number;
  /** Sample median of x. */
  median: number;
  /** First row's total_tokens (chronological). */
  firstX: number;
  /** Last row's total_tokens (chronological). */
  lastX: number;
  /** Endpoint-only slope `(lastX - firstX) / (n - 1)`. Non-robust reference. */
  naiveSlope: number;
  /** Ordinary least-squares slope `s_xy / s_xx`; the lambda -> 0 limit of Deming. */
  olsSlope: number;
  /** Deming slope at the supplied lambda, in tokens per row. */
  slope: number;
  /** Intercept `ybar - slope * xbar`. */
  intercept: number;
  /** |slope|. */
  slopeMagnitude: number;
  /** 'up' if slope > 0, 'down' if slope < 0, 'flat' if slope == 0. */
  slopeSign: 'up' | 'down' | 'flat';
  /** Sum of squares about the centroid in x (the row-index axis). */
  sxx: number;
  /** Sum of squares about the centroid in y (the token axis). */
  syy: number;
  /** Sum of cross-products about the centroid. */
  sxy: number;
  /** `slope - olsSlope`, the gap between Deming and the OLS limit. */
  demingVsOlsGap: number;
  /** `slope - naiveSlope`, gap between Deming and endpoint-only reference. */
  demingVsNaiveGap: number;
  /** Slope re-evaluated at lambda / 2. */
  slopeAtLambdaHalf: number;
  /** Slope re-evaluated at lambda * 2. */
  slopeAtLambdaTwo: number;
  /**
   * `slopeAtLambdaTwo - slopeAtLambdaHalf` — the literal range of the
   * slope across a 4x lambda sweep. Small absolute value => the
   * answer is robust to the assumed variance ratio.
   */
  lambdaSensitivity: number;
  /**
   * `|lambdaSensitivity / slope|` — the unitless relative range of
   * the slope across a 4x lambda sweep, expressed as a fraction of
   * the slope's own magnitude. Use this to compare lambda-robustness
   * across sources whose absolute slope magnitudes differ by orders
   * of magnitude. `null` when `slope == 0` (relative form is
   * undefined). Smaller = more robust.
   */
  relativeLambdaSensitivity: number | null;
  /**
   * True iff `sign(slope) != sign(olsSlope)` AND neither is exactly
   * zero. Direct flag for "the EIV correction has flipped the trend
   * direction relative to plain OLS-of-y-on-x" — the most actionable
   * cohort for analysts who would otherwise have used OLS.
   */
  signFlippedFromOls: boolean;
}

export interface SourceRowTokenDemingSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minSlopeMagnitude: number;
  lambda: number;
  top: number | null;
  sort:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'gap-desc'
    | 'gap-magnitude-desc'
    | 'naive-gap-magnitude-desc'
    | 'lambda-sensitivity-desc'
    | 'lambda-sensitivity-relative-desc'
    | 'sign-flipped-from-ols-first'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinSlopeMagnitude: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenDemingSlopeRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'slope-desc',
  'slope-asc',
  'magnitude-desc',
  'gap-desc',
  'gap-magnitude-desc',
  'naive-gap-magnitude-desc',
  'lambda-sensitivity-desc',
  'lambda-sensitivity-relative-desc',
  'sign-flipped-from-ols-first',
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
 * Closed-form Deming slope from sums of squares about the centroid.
 * Returns 0 when `s_xy == 0` (no linear EIV trend at any lambda).
 *
 * Throws if `lambda` is not a finite positive number.
 */
export function demingSlopeFromSums(
  sxx: number,
  syy: number,
  sxy: number,
  lambda: number,
): number {
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(`demingSlopeFromSums: lambda must be > 0 (got ${lambda})`);
  }
  if (sxy === 0) return 0;
  const a = syy - lambda * sxx;
  const disc = a * a + 4 * lambda * sxy * sxy;
  // disc >= a*a >= 0, so sqrt is safe.
  const root = Math.sqrt(disc);
  return (a + root) / (2 * sxy);
}

/**
 * Deming regression slope and intercept for a chronologically ordered
 * series `xs`, where the regressor is the implicit row index
 * `0..n-1`. Returns the Deming slope at the supplied lambda along
 * with the OLS reference (`s_xy / s_xx`, the lambda -> 0 limit).
 *
 * Throws if `xs.length < 2` or `lambda <= 0`.
 */
export function demingSlope(
  xs: number[],
  lambda: number,
): {
  slope: number;
  olsSlope: number;
  intercept: number;
  sxx: number;
  syy: number;
  sxy: number;
} {
  const n = xs.length;
  if (n < 2) {
    throw new Error(`demingSlope: need at least 2 points (got ${n})`);
  }
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(`demingSlope: lambda must be > 0 (got ${lambda})`);
  }
  // Centroid. xbar = (n-1)/2 always, but compute by sum for parity.
  let xsum = 0;
  let ysum = 0;
  for (let i = 0; i < n; i += 1) {
    xsum += i;
    ysum += xs[i]!;
  }
  const xbar = xsum / n;
  const ybar = ysum / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xbar;
    const dy = xs[i]! - ybar;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const slope = demingSlopeFromSums(sxx, syy, sxy, lambda);
  const olsSlope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  return { slope, olsSlope, intercept, sxx, syy, sxy };
}

export function buildSourceRowTokenDemingSlope(
  queue: QueueLine[],
  opts: SourceRowTokenDemingSlopeOptions = {},
): SourceRowTokenDemingSlopeReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minSlopeMagnitude = opts.minSlopeMagnitude ?? 0;
  if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
    throw new Error(
      `minSlopeMagnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
    );
  }
  const lambda = opts.lambda ?? 1;
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(
      `lambda must be a finite, strictly positive number (got ${opts.lambda})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'magnitude-desc';
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

  const perSource = new Map<
    string,
    Array<{ ms: number; ord: number; x: number }>
  >();

  let droppedInvalidHourStart = 0;
  let droppedInvalidTokens = 0;
  let droppedNegativeTokens = 0;
  let droppedSourceFilter = 0;

  let ord = 0;
  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    const ordHere = ord;
    ord += 1;
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
    arr.push({ ms, ord: ordHere, x: tt });
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceRowTokenDemingSlopeRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    samples.sort((p, q) =>
      p.ms !== q.ms ? p.ms - q.ms : p.ord - q.ord,
    );
    const xs = samples.map((s) => s.x);

    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += xs[i]!;
    const meanv = totalSum / n;
    const sorted = xs.slice().sort((p, q) => p - q);
    const medianv = sampleMedian(sorted);
    const firstX = xs[0]!;
    const lastX = xs[n - 1]!;
    const naiveSlope = (lastX - firstX) / (n - 1);

    const dem = demingSlope(xs, lambda);
    const slope = dem.slope;
    const intercept = dem.intercept;

    const slopeAtLambdaHalf = demingSlopeFromSums(
      dem.sxx,
      dem.syy,
      dem.sxy,
      lambda / 2,
    );
    const slopeAtLambdaTwo = demingSlopeFromSums(
      dem.sxx,
      dem.syy,
      dem.sxy,
      lambda * 2,
    );
    const lambdaSensitivity = slopeAtLambdaTwo - slopeAtLambdaHalf;

    const slopeMagnitude = Math.abs(slope);
    const slopeSign: 'up' | 'down' | 'flat' =
      slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat';

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      firstX,
      lastX,
      naiveSlope,
      olsSlope: dem.olsSlope,
      slope,
      intercept,
      slopeMagnitude,
      slopeSign,
      sxx: dem.sxx,
      syy: dem.syy,
      sxy: dem.sxy,
      demingVsOlsGap: slope - dem.olsSlope,
      demingVsNaiveGap: slope - naiveSlope,
      slopeAtLambdaHalf,
      slopeAtLambdaTwo,
      lambdaSensitivity,
      relativeLambdaSensitivity:
        slope !== 0 ? Math.abs(lambdaSensitivity / slope) : null,
      signFlippedFromOls:
        slope !== 0 &&
        dem.olsSlope !== 0 &&
        Math.sign(slope) !== Math.sign(dem.olsSlope),
    });
  }

  let droppedBelowMinSlopeMagnitude = 0;
  const survived: SourceRowTokenDemingSlopeRow[] = [];
  for (const row of allRows) {
    if (minSlopeMagnitude > 0 && row.slopeMagnitude < minSlopeMagnitude) {
      droppedBelowMinSlopeMagnitude += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'slope-desc') primary = q.slope - p.slope;
    else if (sort === 'slope-asc') primary = p.slope - q.slope;
    else if (sort === 'magnitude-desc')
      primary = q.slopeMagnitude - p.slopeMagnitude;
    else if (sort === 'gap-desc') primary = q.demingVsOlsGap - p.demingVsOlsGap;
    else if (sort === 'gap-magnitude-desc')
      primary = Math.abs(q.demingVsOlsGap) - Math.abs(p.demingVsOlsGap);
    else if (sort === 'naive-gap-magnitude-desc')
      primary = Math.abs(q.demingVsNaiveGap) - Math.abs(p.demingVsNaiveGap);
    else if (sort === 'lambda-sensitivity-desc')
      primary = Math.abs(q.lambdaSensitivity) - Math.abs(p.lambdaSensitivity);
    else if (sort === 'lambda-sensitivity-relative-desc') {
      const qr = q.relativeLambdaSensitivity ?? -1;
      const pr = p.relativeLambdaSensitivity ?? -1;
      primary = qr - pr;
    } else if (sort === 'sign-flipped-from-ols-first')
      primary =
        (q.signFlippedFromOls ? 1 : 0) - (p.signFlippedFromOls ? 1 : 0);
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
    minSlopeMagnitude,
    lambda,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinSlopeMagnitude,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
