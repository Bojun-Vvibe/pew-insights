/**
 * source-row-token-bca-bootstrap-slope-ci: per-source **BCa (bias-corrected
 * and accelerated) bootstrap confidence interval** for the v0.6.219 Deming
 * regression slope of per-row `total_tokens` against row index `0..n-1`,
 * in tokens / row.
 *
 * Headline question: **for each source, what is the BCa-adjusted bootstrap
 * confidence interval for the Deming slope** — i.e. the second-order
 * accurate interval that corrects the percentile bootstrap for both the
 * **median bias** (`z0`) of the bootstrap distribution and the **rate of
 * change of standard error with respect to the true parameter**
 * (acceleration `a`, estimated from the jackknife)?
 *
 * Mechanical class — **BCa bootstrap CI** (Efron 1987, *JASA* 82:171-185).
 * Third uncertainty-quantification lens in the slope suite. Genuinely
 * novel relative to:
 *
 *   - **percentile bootstrap CI** (v0.6.220, `source-row-token-bootstrap-
 *     slope-ci`): same `B` Deming resamples, but BCa picks DIFFERENT
 *     percentiles `(alpha1, alpha2)` of the same sorted bootstrap
 *     distribution, where the picks depend on `z0` (bias correction) and
 *     `a` (acceleration). Recovers the percentile interval iff
 *     `z0 == 0 && a == 0`. Otherwise the interval is shifted and rescaled
 *     toward the correct coverage.
 *   - **jackknife normal-approx CI** (v0.6.221, `source-row-token-
 *     jackknife-slope-ci`): uses jackknife replicates only for the
 *     acceleration parameter `a`, NOT for the interval endpoints. The
 *     endpoints are bootstrap percentiles, not `biasCorrected +/- z*jackSe`.
 *
 * The procedure (per source):
 *
 *   1. Compute the point Deming slope `thetaHat` on the full data at the
 *      supplied `--lambda` (default 1, orthogonal regression).
 *   2. Run `B = --bootstraps` non-parametric resamples (resample n indices
 *      with replacement, relabel positions `0..n-1` as the new x axis,
 *      re-fit Deming) under a seeded LCG. Sort ascending: the bootstrap
 *      slopes `theta*_(1) <= ... <= theta*_(B)`.
 *   3. **Bias correction `z0`**: `z0 = Phi^{-1}( #{theta*_b < thetaHat} / B )`.
 *      If `thetaHat` is the median of the bootstrap distribution, `z0 = 0`.
 *      Ties are split half-and-half (Efron's tie convention).
 *   4. **Acceleration `a`**: from the jackknife replicates `theta_(-i)`,
 *
 *          jackMean = (1/n) * sum_i theta_(-i)
 *          a        = sum_i (jackMean - theta_(-i))^3
 *                   / ( 6 * ( sum_i (jackMean - theta_(-i))^2 )^{3/2} )
 *
 *      `a` measures the rate of change of the standard error of `thetaHat`
 *      with respect to the true parameter on a normalized scale; a
 *      symmetric jackknife distribution gives `a = 0`.
 *   5. **BCa percentiles**: with `z_lo = Phi^{-1}((1 - confidence)/2)` and
 *      `z_hi = Phi^{-1}((1 + confidence)/2)`,
 *
 *          alpha1 = Phi( z0 + (z0 + z_lo) / (1 - a*(z0 + z_lo)) )
 *          alpha2 = Phi( z0 + (z0 + z_hi) / (1 - a*(z0 + z_hi)) )
 *
 *      Then `ciLower = quantile(theta*_b, alpha1)`,
 *      `ciUpper = quantile(theta*_b, alpha2)` via the same linear-
 *      interpolation percentile as the v0.6.220 lens.
 *
 *   6. Diagnostics emitted per source:
 *
 *       - `slope`              the Deming point slope (full-data fit)
 *       - `z0`                 bias-correction quantile
 *       - `acceleration`       jackknife-derived `a`
 *       - `alphaLower`         BCa lower percentile (in (0,1))
 *       - `alphaUpper`         BCa upper percentile (in (0,1))
 *       - `ciLower`, `ciUpper` interval endpoints in tokens/row
 *       - `ciWidth`            `ciUpper - ciLower`
 *       - `ciContainsZero`     `ciLower <= 0 && ciUpper >= 0`
 *       - `bcaShift`           median(theta*) - thetaHat (positive => the
 *                              bootstrap distribution is biased above the
 *                              point estimate; jointly informs whether the
 *                              correction `z0` was meaningful)
 *
 * Mechanical sibling-summary:
 *
 *   - vs **bootstrap percentile CI** (v0.6.220): same `B` resamples, but
 *     percentiles are shifted by `z0` and stretched by `a`. With a
 *     non-zero `z0` or `a` the BCa CI can be visibly OFF-CENTER from the
 *     percentile CI on the same data.
 *   - vs **jackknife normal CI** (v0.6.221): both use jackknife replicates,
 *     but here the jackknife enters only as the acceleration term; the CI
 *     endpoints are bootstrap percentiles (NOT a normal-approximation
 *     centered on a bias-corrected point).
 *   - vs **Deming** (v0.6.219): same point estimator at the heart, plus a
 *     second-order accurate interval (Efron 1987 shows BCa is correct to
 *     `O(1/n)` whereas percentile is only first-order accurate).
 *   - vs **Mann-Kendall** (v0.6.211): MK reports a *p-value* for the
 *     monotone-trend null hypothesis. This lens reports a second-order
 *     accurate interval estimate for the slope itself.
 *
 * Determinism: bootstrap is driven by a **seeded LCG** (Numerical Recipes
 * 32-bit constants `a=1664525, c=1013904223, m=2^32`); jackknife is purely
 * deterministic. Pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 *
 * Edge cases:
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: every bootstrap and jackknife slope is 0 — `z0`
 *     and `a` collapse to 0 (handled explicitly: empty deviations -> `a=0`,
 *     `z0` defaults to 0 when all bootstrap slopes equal `thetaHat`),
 *     `ciLower = ciUpper = 0`, `ciWidth = 0`, `ciContainsZero = true`.
 *   - **`a` denominator ~ 0**: `a = 0` (no acceleration; falls back to
 *     bias-corrected-only "BC" interval).
 *   - **`alpha1` or `alpha2` clipped to [0, 1]**: clamped at the edges of
 *     the bootstrap distribution.
 *   - **`--bootstraps < 100`**: rejected at option-validation time.
 *   - **`--confidence` not in (0, 1)**: rejected.
 *   - **`--lambda <= 0`**: rejected.
 *
 * Steps:
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group rows by source, sort per-source by `hour_start` asc
 *      (tiebreak input order).
 *   6. Per source: skip if `n < minRows` (default 4).
 *   7. Compute the full-data Deming slope, the `B` bootstrap slopes, and
 *      the `n` jackknife slopes.
 *   8. Compute `z0`, `a`, BCa percentiles, CI endpoints, diagnostics.
 *   9. Apply display gates: `--alert-zero-in-ci`,
 *      `--alert-bca-shift-min` (filter to only sources whose `|alphaLower
 *      - (1-confidence)/2| + |alphaUpper - (1+confidence)/2|` shift sum
 *      is at least the threshold — surfaces sources where BCa
 *      meaningfully disagreed with the percentile interval).
 *  10. Sort, then optionally cap with `--top`.
 */
import type { QueueLine } from './types.js';
import {
  demingSlope,
  demingSlopeFromSums,
} from './sourcerowtokendemingslope.js';
import {
  inverseStandardNormalCdf,
  jackknifeLeaveOneOutSlopes,
} from './sourcerowtokenjackknifeslopeci.js';
import {
  makeLcg,
  bootstrapResample,
  bootstrapDemingSlope,
  percentileSorted,
} from './sourcerowtokenbootstrapslopeci.js';

export interface SourceRowTokenBcaBootstrapSlopeCiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Number of bootstrap resamples. Integer >= 100. Default 1000. */
  bootstraps?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for inner Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /** Seed for the LCG bootstrap. Integer (any). Default 42. */
  seed?: number;
  /**
   * If true, only emit sources whose CI contains zero (i.e.
   * `ciLower <= 0 && ciUpper >= 0`). Default false.
   */
  alertZeroInCi?: boolean;
  /**
   * Refinement filter: only emit sources whose summed BCa percentile
   * shift `|alphaLower - (1-conf)/2| + |alphaUpper - (1+conf)/2|` is
   * at least the threshold. `0` (default) keeps all sources.
   */
  alertBcaShiftMin?: number;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'z0-magnitude-desc'
    | 'acceleration-magnitude-desc'
    | 'bca-shift-desc'
    | 'bca-width-ratio-desc'
    | 'ci-contains-zero-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenBcaBootstrapSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming point slope on the full data, in tokens / row. */
  slope: number;
  /** BCa bias correction `z0 = Phi^{-1}( #{theta*<thetaHat}/B )`. */
  z0: number;
  /** BCa acceleration term, derived from jackknife replicates. */
  acceleration: number;
  /** Lower BCa percentile in (0, 1). */
  alphaLower: number;
  /** Upper BCa percentile in (0, 1). */
  alphaUpper: number;
  /** BCa lower CI endpoint in tokens / row. */
  ciLower: number;
  /** BCa upper CI endpoint in tokens / row. */
  ciUpper: number;
  /** `ciUpper - ciLower`. */
  ciWidth: number;
  /** True iff `ciLower <= 0 && ciUpper >= 0`. */
  ciContainsZero: boolean;
  /**
   * Median(theta*) - thetaHat: a non-parametric "is the bootstrap
   * distribution centered above the point estimate?" diagnostic.
   * Positive => bootstrap distribution sits above the point estimate
   * (consistent with `z0 > 0`). Useful jointly with `z0` to interpret
   * the BCa shift.
   */
  bcaShift: number;
  /**
   * `|alphaLower - (1-confidence)/2| + |alphaUpper - (1+confidence)/2|`.
   * Refinement field: a single scalar telling you HOW FAR the BCa
   * percentile picks shifted away from the percentile bootstrap CI on
   * the same `B` resamples. `0` => BCa and percentile picks coincide
   * (z0 = 0 and acceleration = 0). Larger => BCa meaningfully
   * disagreed with percentile.
   */
  bcaPercentileShift: number;
  /**
   * `bcaCiWidth / percentileCiWidth` on the SAME sorted bootstrap
   * distribution: the multiplicative factor by which the BCa
   * adjustment widened or narrowed the v0.6.220-style percentile
   * interval. `1.0` => BCa and percentile produce the same width
   * (typically also `bcaPercentileShift ~ 0`); `> 1` => BCa is
   * wider than percentile (acceleration stretching dominates),
   * `< 1` => BCa is narrower (typically driven by a one-sided shift
   * that lands inside the percentile range). NaN if the percentile
   * width is zero (constant-bootstrap source). (Refinement field,
   * v0.6.222 follow-up.)
   */
  bcaWidthRatio: number;
  /**
   * Direction of the BCa shift relative to the percentile pick:
   * `+1` if both alphaLower and alphaUpper shifted upward (interval
   * moved up), `-1` if both shifted downward, `0` if they shifted in
   * opposite directions (the BCa interval is rescaled but not net-
   * shifted). Useful with `bcaShift` for distinguishing "interval
   * moved" vs "interval rescaled" corrections. (Refinement field,
   * v0.6.222 follow-up.)
   */
  bcaShiftDirection: number;
}

export interface SourceRowTokenBcaBootstrapSlopeCiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  bootstraps: number;
  confidence: number;
  lambda: number;
  seed: number;
  alertZeroInCi: boolean;
  alertBcaShiftMin: number;
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'z0-magnitude-desc'
    | 'acceleration-magnitude-desc'
    | 'bca-shift-desc'
    | 'bca-width-ratio-desc'
    | 'ci-contains-zero-first'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedNotZeroInCi: number;
  droppedBelowBcaShift: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenBcaBootstrapSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const MIN_BOOTSTRAPS = 100;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'z0-magnitude-desc',
  'acceleration-magnitude-desc',
  'bca-shift-desc',
  'bca-width-ratio-desc',
  'ci-contains-zero-first',
  'rows',
  'source',
] as const;

/**
 * Standard-normal CDF Phi(z). Uses the Abramowitz & Stegun 7.1.26
 * approximation via `erf` to match the inverse used elsewhere in the
 * suite. Accurate to ~1.5e-7. Pure.
 */
export function standardNormalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  // Abramowitz & Stegun 7.1.26 erf approximation, then Phi(z) = (1+erf(z/sqrt(2)))/2.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  const erf = sign * y;
  const cdf = 0.5 * (1 + erf);
  return cdf < 0 ? 0 : cdf > 1 ? 1 : cdf;
}

/**
 * Efron's tie-aware empirical proportion `# {b : theta_b < thetaHat} / B`,
 * with ties split half-and-half: for each tied entry, count 0.5 instead
 * of 1. Returns a value in `[0, 1]`. Empty input returns 0.5.
 */
export function bcaBiasFraction(
  bootSlopes: readonly number[],
  thetaHat: number,
): number {
  const B = bootSlopes.length;
  if (B === 0) return 0.5;
  let lt = 0;
  let eq = 0;
  for (let b = 0; b < B; b += 1) {
    const v = bootSlopes[b]!;
    if (v < thetaHat) lt += 1;
    else if (v === thetaHat) eq += 1;
  }
  return (lt + 0.5 * eq) / B;
}

/**
 * BCa bias correction `z0 = Phi^{-1}(p)` where `p` is the empirical
 * proportion of bootstrap slopes strictly less than `thetaHat` (with
 * ties split half-and-half). Edge cases: `p = 0` -> very negative
 * (clamped to `Phi^{-1}(1/(2B))`); `p = 1` -> very positive
 * (`Phi^{-1}(1 - 1/(2B))`). On `B = 0` returns 0.
 */
export function bcaBiasCorrection(
  bootSlopes: readonly number[],
  thetaHat: number,
): number {
  const B = bootSlopes.length;
  if (B === 0) return 0;
  let p = bcaBiasFraction(bootSlopes, thetaHat);
  // Clamp p away from {0, 1} to avoid +-Inf z0.
  const lo = 1 / (2 * B);
  const hi = 1 - lo;
  if (p < lo) p = lo;
  if (p > hi) p = hi;
  return inverseStandardNormalCdf(p);
}

/**
 * BCa acceleration `a`. Given the `n` jackknife slopes
 * `theta_(-i)`,
 *
 *     jackMean = (1/n) * sum_i theta_(-i)
 *     dev_i    = jackMean - theta_(-i)
 *     a        = sum_i dev_i^3 / ( 6 * (sum_i dev_i^2)^{3/2} )
 *
 * If the denominator is ~0 (constant jackknife replicates), returns 0.
 */
export function bcaAcceleration(jackSlopes: readonly number[]): number {
  const n = jackSlopes.length;
  if (n === 0) return 0;
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += jackSlopes[i]!;
  mean /= n;
  let num = 0;
  let denSq = 0;
  for (let i = 0; i < n; i += 1) {
    const d = mean - jackSlopes[i]!;
    num += d * d * d;
    denSq += d * d;
  }
  if (denSq === 0) return 0;
  const den = 6 * Math.pow(denSq, 1.5);
  if (den === 0 || !Number.isFinite(den)) return 0;
  const a = num / den;
  if (!Number.isFinite(a)) return 0;
  return a;
}

/**
 * BCa adjusted percentiles. Returns `[alphaLower, alphaUpper]`, each
 * clamped to `[0, 1]`. With `z0 = 0, a = 0` reproduces the classical
 * percentile interval `[(1-confidence)/2, (1+confidence)/2]`.
 */
export function bcaAdjustedPercentiles(
  z0: number,
  a: number,
  confidence: number,
): [number, number] {
  const zLo = inverseStandardNormalCdf((1 - confidence) / 2);
  const zHi = inverseStandardNormalCdf((1 + confidence) / 2);
  const adj = (zside: number): number => {
    const numer = z0 + zside;
    const denom = 1 - a * numer;
    if (denom === 0 || !Number.isFinite(denom)) {
      return zside > 0 ? 1 : 0;
    }
    const z = z0 + numer / denom;
    if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
    return standardNormalCdf(z);
  };
  let aLo = adj(zLo);
  let aHi = adj(zHi);
  if (aLo < 0) aLo = 0;
  if (aLo > 1) aLo = 1;
  if (aHi < 0) aHi = 0;
  if (aHi > 1) aHi = 1;
  return [aLo, aHi];
}

export function buildSourceRowTokenBcaBootstrapSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenBcaBootstrapSlopeCiOptions = {},
): SourceRowTokenBcaBootstrapSlopeCiReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const bootstraps = opts.bootstraps ?? 1000;
  if (!Number.isInteger(bootstraps) || bootstraps < MIN_BOOTSTRAPS) {
    throw new Error(
      `bootstraps must be an integer >= ${MIN_BOOTSTRAPS} (got ${opts.bootstraps})`,
    );
  }
  const confidence = opts.confidence ?? 0.95;
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
    throw new Error(
      `confidence must be a finite number in (0, 1) (got ${opts.confidence})`,
    );
  }
  const lambda = opts.lambda ?? 1;
  if (!Number.isFinite(lambda) || lambda <= 0) {
    throw new Error(
      `lambda must be a finite, strictly positive number (got ${opts.lambda})`,
    );
  }
  const seed = opts.seed ?? 42;
  if (!Number.isInteger(seed)) {
    throw new Error(`seed must be an integer (got ${opts.seed})`);
  }
  const alertZeroInCi = opts.alertZeroInCi ?? false;
  const alertBcaShiftMin = opts.alertBcaShiftMin ?? 0;
  if (
    !Number.isFinite(alertBcaShiftMin) ||
    alertBcaShiftMin < 0 ||
    alertBcaShiftMin > 2
  ) {
    throw new Error(
      `alertBcaShiftMin must be a finite number in [0, 2] (got ${opts.alertBcaShiftMin})`,
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
  const allRows: SourceRowTokenBcaBootstrapSlopeCiRow[] = [];
  let droppedBelowMinRows = 0;

  // Sort source keys for deterministic LCG advancement order.
  const sourceKeys = Array.from(perSource.keys()).sort();
  const rng = makeLcg(seed);

  const percentileNomLo = (1 - confidence) / 2;
  const percentileNomHi = (1 + confidence) / 2;

  for (const source of sourceKeys) {
    const samples = perSource.get(source)!;
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    samples.sort((p, q) => (p.ms !== q.ms ? p.ms - q.ms : p.ord - q.ord));
    const xs = samples.map((s) => s.x);

    let pointSlope: number;
    try {
      pointSlope = demingSlope(xs, lambda).slope;
    } catch {
      pointSlope = 0;
    }

    // Bootstrap.
    const slopes = new Array<number>(bootstraps);
    for (let b = 0; b < bootstraps; b += 1) {
      const resampled = bootstrapResample(xs, rng);
      slopes[b] = bootstrapDemingSlope(resampled, lambda);
    }
    const sorted = slopes.slice().sort((p, q) => p - q);
    const bootMedian = percentileSorted(sorted, 0.5);

    // Jackknife (for acceleration only).
    const jackSlopes = jackknifeLeaveOneOutSlopes(xs, lambda);

    const z0 = bcaBiasCorrection(slopes, pointSlope);
    const a = bcaAcceleration(jackSlopes);
    const [alphaLower, alphaUpper] = bcaAdjustedPercentiles(z0, a, confidence);

    const ciLower = percentileSorted(sorted, alphaLower);
    const ciUpper = percentileSorted(sorted, alphaUpper);
    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;
    const bcaShift = bootMedian - pointSlope;
    const bcaPercentileShift =
      Math.abs(alphaLower - percentileNomLo) +
      Math.abs(alphaUpper - percentileNomHi);
    // Refinement: the v0.6.220-style percentile-bootstrap interval
    // on the SAME sorted distribution, for direct comparison.
    const pctCiLower = percentileSorted(sorted, percentileNomLo);
    const pctCiUpper = percentileSorted(sorted, percentileNomHi);
    const pctCiWidth = pctCiUpper - pctCiLower;
    const bcaWidthRatio = pctCiWidth === 0 ? NaN : ciWidth / pctCiWidth;
    const dLo = alphaLower - percentileNomLo;
    const dHi = alphaUpper - percentileNomHi;
    let bcaShiftDirection = 0;
    if (dLo > 0 && dHi > 0) bcaShiftDirection = 1;
    else if (dLo < 0 && dHi < 0) bcaShiftDirection = -1;

    allRows.push({
      source,
      rowsKept: n,
      slope: pointSlope,
      z0,
      acceleration: a,
      alphaLower,
      alphaUpper,
      ciLower,
      ciUpper,
      ciWidth,
      ciContainsZero,
      bcaShift,
      bcaPercentileShift,
      bcaWidthRatio,
      bcaShiftDirection,
    });
  }

  let droppedNotZeroInCi = 0;
  let droppedBelowBcaShift = 0;
  const survived: SourceRowTokenBcaBootstrapSlopeCiRow[] = [];
  for (const row of allRows) {
    if (alertZeroInCi && !row.ciContainsZero) {
      droppedNotZeroInCi += 1;
      continue;
    }
    if (row.bcaPercentileShift < alertBcaShiftMin) {
      droppedBelowBcaShift += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'magnitude-desc')
      primary = Math.abs(q.slope) - Math.abs(p.slope);
    else if (sort === 'slope-desc') primary = q.slope - p.slope;
    else if (sort === 'slope-asc') primary = p.slope - q.slope;
    else if (sort === 'ci-width-desc') primary = q.ciWidth - p.ciWidth;
    else if (sort === 'ci-width-asc') primary = p.ciWidth - q.ciWidth;
    else if (sort === 'z0-magnitude-desc')
      primary = Math.abs(q.z0) - Math.abs(p.z0);
    else if (sort === 'acceleration-magnitude-desc')
      primary = Math.abs(q.acceleration) - Math.abs(p.acceleration);
    else if (sort === 'bca-shift-desc')
      primary = q.bcaPercentileShift - p.bcaPercentileShift;
    else if (sort === 'bca-width-ratio-desc') {
      // NaN ratios sort last.
      const qv = Number.isFinite(q.bcaWidthRatio) ? q.bcaWidthRatio : -Infinity;
      const pv = Number.isFinite(p.bcaWidthRatio) ? p.bcaWidthRatio : -Infinity;
      primary = qv - pv;
    } else if (sort === 'ci-contains-zero-first')
      primary = (q.ciContainsZero ? 1 : 0) - (p.ciContainsZero ? 1 : 0);
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
    bootstraps,
    confidence,
    lambda,
    seed,
    alertZeroInCi,
    alertBcaShiftMin,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedNotZeroInCi,
    droppedBelowBcaShift,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
