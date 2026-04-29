/**
 * source-row-token-abc-bootstrap-slope-ci: per-source **ABC (approximate
 * bootstrap confidence) interval** for the v0.6.219 Deming regression
 * slope of per-row `total_tokens` against row index `0..n-1`, in
 * tokens / row.
 *
 * Headline question: **for each source, what is the ABC analytic
 * approximation to the BCa interval for the Deming slope** — i.e. the
 * second-order accurate confidence interval that uses ANALYTIC
 * directional derivatives of the slope statistic with respect to the
 * empirical resampling weights, rather than running a Monte-Carlo
 * bootstrap?
 *
 * Mechanical class — **ABC bootstrap CI** (Diciccio & Efron 1992,
 * *Statistical Science* 7:189-228; Efron & Tibshirani 1993, *An
 * Introduction to the Bootstrap*, Ch. 14.4). Fifth uncertainty-
 * quantification lens in the slope suite. Genuinely novel relative to
 * every existing CI lens:
 *
 *   - **vs v0.6.220 percentile bootstrap CI** — that lens runs `B`
 *     Monte-Carlo Deming refits and ranks the raw `theta*_b`. ABC
 *     runs **zero** Monte-Carlo bootstrap resamples; it computes
 *     analytic directional derivatives `T_dot_i = dT/dw_i` of the
 *     Deming slope at the equal-weight point `w = (1,...,1)`, then
 *     evaluates the slope on two analytically-perturbed weight
 *     vectors. ABC is `O(n)`, not `O(B*n)`.
 *   - **vs v0.6.221 jackknife normal CI** — both are O(n). Jackknife
 *     uses leave-one-out replicates `theta_(-i)` and a
 *     symmetric `+/- z` envelope. ABC uses *symmetric finite-
 *     difference* directional derivatives `T_dot_i =
 *     (T(w + eps*e_i) - T(w - eps*e_i)) / (2*eps)` and produces an
 *     ASYMMETRIC interval shifted by the analytic bias `b` and
 *     stretched by the analytic acceleration `a` (the asymmetry
 *     captures skew the jackknife normal CI cannot).
 *   - **vs v0.6.222 BCa bootstrap CI** — both produce the same
 *     `a` term up to `O(1/n^2)` (Diciccio-Efron prove ABC is the
 *     analytic limit of BCa as `B -> infinity`). But:
 *       * BCa needs `B` bootstrap resamples; ABC needs none.
 *       * BCa picks endpoints from sorted slope replicates; ABC
 *         evaluates the slope at two analytically-constructed
 *         weight vectors.
 *       * BCa's `z0` is empirical (count of slopes below thetaHat);
 *         ABC's `b` is analytic (`(1/(2n^2)) * sum T_ddot_ii` from
 *         numerical second derivatives).
 *   - **vs v0.6.223 studentized bootstrap CI** — that lens runs
 *     `B*n` Deming fits (outer bootstrap + inner jackknife per
 *     replicate). ABC runs `2n + 1` Deming fits total. Different
 *     statistic ranked, no studentization, no Monte-Carlo at all.
 *
 * The procedure (per source):
 *
 *   1. Compute the point Deming slope on the full data at the
 *      supplied `--lambda` (default 1, orthogonal regression):
 *      `thetaHat = T(1, ..., 1)` where the weight vector is the
 *      n-vector of ones.
 *   2. **Directional derivatives** at the equal-weight point. For
 *      each `i in 0..n-1`,
 *
 *          T_dot_i  = ( T(w + eps*e_i) - T(w - eps*e_i) ) / (2 * eps)
 *          T_ddot_i = ( T(w + eps*e_i) - 2*T(w) + T(w - eps*e_i) ) / eps^2
 *
 *      where `T(w)` is the **weighted Deming slope** evaluated at
 *      weight vector `w` (each row contributes weight `w_i` rather
 *      than the implicit `1`), and `eps = --abc-eps` (default 0.01).
 *      The slope is computed via the closed-form sums-of-squares
 *      version `demingSlopeFromSums`, with weighted sums:
 *
 *          n_w     = sum_i w_i
 *          x_bar_w = sum_i w_i * x_i / n_w
 *          y_bar_w = sum_i w_i * y_i / n_w     (here y_i = i)
 *          sxx_w   = sum_i w_i * (x_i - x_bar_w)^2
 *          syy_w   = sum_i w_i * (y_i - y_bar_w)^2
 *          sxy_w   = sum_i w_i * (x_i - x_bar_w) * (y_i - y_bar_w)
 *
 *      Cost: `2n + 1` Deming evaluations.
 *
 *   3. **Acceleration `a`** (Diciccio-Efron eq. (5.4)):
 *
 *          a = (1/6) * sum_i T_dot_i^3 / ( sum_i T_dot_i^2 )^{3/2}
 *
 *      If `sum T_dot_i^2 == 0` returns 0.
 *
 *   4. **Bias `b`** (Diciccio-Efron eq. (5.5)):
 *
 *          b = (1 / (2 * n^2)) * sum_i T_ddot_i
 *
 *      This is the analytic limit of BCa's `z0 / sigmaHat`-shaped
 *      bias correction.
 *
 *   5. **`sigmaHat`** (Diciccio-Efron, the nonparametric delta-method
 *      SE):
 *
 *          sigmaHat = sqrt( sum_i T_dot_i^2 ) / n
 *
 *   6. **Cq curvature** (Diciccio-Efron eq. (5.6); the quadratic
 *      term used to refine `z0`):
 *
 *          cq = ( T(w + eps*sigmaHat^{-1}*T_dot/n)
 *               - T(w) ) / (eps^2 * sigmaHat)
 *               - sum_i T_dot_i^2 / (n^2 * sigmaHat)
 *
 *      Practically, ABC writes the bias correction as
 *      `z0_abc = a - cq * sigmaHat`, but the simpler "ABCq" form
 *      replaces `cq` with `0` and retains the Diciccio-Efron `b`
 *      term. We follow ABCq for numeric stability — `cq` is
 *      reported diagnostically but not used in endpoint construction.
 *
 *   7. **ABC endpoints** (Diciccio-Efron eq. (5.7), ABCq form). For
 *      each tail `alpha in {(1-confidence)/2, (1+confidence)/2}`:
 *
 *          z_alpha = Phi^{-1}(alpha)
 *          w_alpha = b + (b + z_alpha) / (1 - a*(b + z_alpha))^2
 *          lam_a   = w_alpha / sqrt( sum_i T_dot_i^2 )
 *          w_i*    = 1 + lam_a * T_dot_i        (perturbed weights)
 *          theta_alpha = T(w_1*, ..., w_n*)
 *
 *      Then `ciLower = theta_loAlpha`, `ciUpper = theta_hiAlpha`.
 *      Note this evaluates the Deming slope on TWO additional
 *      perturbed weight vectors (one per CI endpoint) — total cost
 *      across the whole procedure is `2n + 3` Deming fits per
 *      source.
 *
 *   8. Diagnostics emitted per source:
 *
 *       - `slope`               the Deming point slope (full-data fit)
 *       - `accelerationAbc`     ABC analytic acceleration `a`
 *       - `biasAbc`             ABC analytic bias `b`
 *       - `sigmaHat`            nonparametric delta-method SE
 *       - `cqAbc`               curvature term `cq` (diagnostic only)
 *       - `wLower`, `wUpper`    the ABC `w_alpha` quantile-shifted
 *                               z-scores (transformed Phi^{-1} picks)
 *       - `ciLower`, `ciUpper`  interval endpoints in tokens / row
 *       - `ciWidth`             `ciUpper - ciLower`
 *       - `ciContainsZero`      `ciLower <= 0 && ciUpper >= 0`
 *       - `dotDispersion`       `max|T_dot_i| / mean|T_dot_i|` —
 *                               an influence-function spread metric;
 *                               large values flag a single dominant
 *                               row whose weight perturbation moves
 *                               the slope much more than typical rows
 *       - `degenerateDotCount`  count of `T_dot_i` whose absolute
 *                               value is below `1e-12 * sigmaHat * n`
 *                               (rows with negligible influence)
 *
 * Mechanical sibling-summary:
 *
 *   - vs **percentile bootstrap CI** (v0.6.220): no Monte-Carlo at
 *     all. Endpoints are evaluated at analytically-perturbed weight
 *     vectors, not picked from sorted Monte-Carlo replicates.
 *   - vs **jackknife normal CI** (v0.6.221): both are `O(n)`, but
 *     ABC produces an asymmetric interval driven by analytic `a`
 *     and `b`, not by `+/- z * jackSe`.
 *   - vs **BCa bootstrap CI** (v0.6.222): ABC is the analytic
 *     `B -> infinity` limit of BCa. With finite `B` they generally
 *     differ by `O(1/sqrt(B))` Monte-Carlo noise plus `O(1/n^2)`
 *     analytic terms.
 *   - vs **studentized bootstrap CI** (v0.6.223): both are second-
 *     order accurate, but ABC is fully analytic — no inner
 *     bootstrap, no studentization, no `T*_b / SE*_b` ranking.
 *
 * Determinism: fully deterministic. No RNG. No `seed` option needed.
 * Pure builder. Wall clock only via `opts.generatedAt`. Sort tiebreak
 * is `source` asc.
 *
 * Edge cases:
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All values equal**: every weighted Deming slope is 0 — `a`,
 *     `b`, `sigmaHat`, `cq` all collapse to 0; `ciLower = ciUpper = 0`,
 *     `ciContainsZero = true`.
 *   - **`sum T_dot^2 == 0`**: `a = 0`, `sigmaHat = 0`, `lam_a = 0` —
 *     endpoints both evaluate to `thetaHat`, `ciWidth = 0`.
 *   - **`a*(b+z_alpha) >= 1`**: the `(1 - a*(b+z_alpha))^2` denominator
 *     would be zero or negative. We clip the perturbation `lam_a` so
 *     the perturbed weights stay in `(0, +inf)` (any `w_i* <= 0` is
 *     clamped to a tiny positive `1e-9`); this handles extreme
 *     acceleration without throwing.
 *   - **`--abc-eps <= 0` or `> 0.5`**: rejected.
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
 *   7. Compute thetaHat, T_dot_i, T_ddot_i, a, b, sigmaHat, cq, and
 *      the two ABC endpoints.
 *   8. Apply display gates: `--alert-zero-in-ci`,
 *      `--alert-dot-dispersion-min` (filter to only sources whose
 *      `dotDispersion` is at least the threshold — surfaces sources
 *      whose slope is dominated by a single influential row).
 *   9. Sort, then optionally cap with `--top`.
 */
import type { QueueLine } from './types.js';
import { demingSlopeFromSums } from './sourcerowtokendemingslope.js';
import { inverseStandardNormalCdf } from './sourcerowtokenjackknifeslopeci.js';

export interface SourceRowTokenAbcBootstrapSlopeCiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for inner Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /** Numerical-derivative step size in (0, 0.5]. Default 0.01. */
  abcEps?: number;
  /**
   * If true, only emit sources whose CI contains zero (i.e.
   * `ciLower <= 0 && ciUpper >= 0`). Default false.
   */
  alertZeroInCi?: boolean;
  /**
   * Refinement filter: only emit sources whose `dotDispersion` is at
   * least this threshold. `0` (default) keeps all sources.
   */
  alertDotDispersionMin?: number;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'acceleration-magnitude-desc'
    | 'bias-magnitude-desc'
    | 'sigma-hat-desc'
    | 'dot-dispersion-desc'
    | 'dot-concentration-top2-desc'
    | 'ci-contains-zero-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenAbcBootstrapSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming point slope on the full data, in tokens / row. */
  slope: number;
  /** ABC analytic acceleration `a` (Diciccio-Efron eq. (5.4)). */
  accelerationAbc: number;
  /** ABC analytic bias `b` (Diciccio-Efron eq. (5.5)). */
  biasAbc: number;
  /** Nonparametric delta-method SE: `sqrt(sum T_dot^2) / n`. */
  sigmaHat: number;
  /** ABC curvature term `cq` (Diciccio-Efron eq. (5.6)); diagnostic. */
  cqAbc: number;
  /** ABC w_alpha for the lower endpoint (transformed z). */
  wLower: number;
  /** ABC w_alpha for the upper endpoint. */
  wUpper: number;
  /** ABC lower CI endpoint in tokens / row. */
  ciLower: number;
  /** ABC upper CI endpoint in tokens / row. */
  ciUpper: number;
  /** `ciUpper - ciLower`. */
  ciWidth: number;
  /** True iff `ciLower <= 0 && ciUpper >= 0`. */
  ciContainsZero: boolean;
  /**
   * Influence-function spread: `max|T_dot| / mean|T_dot|`. Large
   * values flag a single row whose weight perturbation moves the
   * slope much more than typical rows. `1.0` => perfectly uniform
   * influence; large values => slope dominated by one row.
   */
  dotDispersion: number;
  /**
   * Count of `T_dot_i` with `|T_dot_i| < 1e-12 * sigmaHat * n` —
   * rows whose weight perturbation has negligible influence on the
   * slope (e.g. rows lying exactly on the EIV line, or constant
   * series).
   */
  degenerateDotCount: number;
  /**
   * Share of `sum |T_dot|` contributed by the **top-2 most-
   * influential rows** (refinement field, v0.6.224 follow-up). In
   * `[2/n, 1]`. `2/n` => influence is perfectly uniform across all
   * rows; `1` => the entire slope sensitivity sits on just two
   * rows. Complements `dotDispersion` (a single-row max ratio) by
   * answering "is the slope dominated by ONE row, or by a small
   * cluster?". Returns 0 if `sum |T_dot| == 0` or `n < 2`.
   */
  dotConcentrationTop2: number;
}

export interface SourceRowTokenAbcBootstrapSlopeCiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  lambda: number;
  abcEps: number;
  alertZeroInCi: boolean;
  alertDotDispersionMin: number;
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'acceleration-magnitude-desc'
    | 'bias-magnitude-desc'
    | 'sigma-hat-desc'
    | 'dot-dispersion-desc'
    | 'dot-concentration-top2-desc'
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
  droppedBelowDotDispersion: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenAbcBootstrapSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'acceleration-magnitude-desc',
  'bias-magnitude-desc',
  'sigma-hat-desc',
  'dot-dispersion-desc',
  'dot-concentration-top2-desc',
  'ci-contains-zero-first',
  'rows',
  'source',
] as const;

/**
 * Weighted Deming slope T(w) where x_i = ys[i] (the per-row
 * total_tokens) plays the role of the regressand and y_i = i is the
 * implicit row index. Uses the same closed-form sums-of-squares
 * formulation as `demingSlope`, but with per-row weights `w_i`.
 *
 * Pure. Returns `0` for n < 2 or `sum w == 0` (degenerate).
 */
export function weightedDemingSlope(
  ys: readonly number[],
  weights: readonly number[],
  lambda: number,
): number {
  const n = ys.length;
  if (n < 2) return 0;
  let sumW = 0;
  let sumWX = 0; // x = row index i
  let sumWY = 0; // y = ys[i] (tokens)
  for (let i = 0; i < n; i += 1) {
    const w = weights[i]!;
    sumW += w;
    sumWX += w * i;
    sumWY += w * ys[i]!;
  }
  if (sumW <= 0) return 0;
  const xBar = sumWX / sumW;
  const yBar = sumWY / sumW;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i]!;
    const dx = i - xBar;
    const dy = ys[i]! - yBar;
    sxx += w * dx * dx;
    syy += w * dy * dy;
    sxy += w * dx * dy;
  }
  // Slope is tokens-per-row (dy/dx). Mirrors existing demingSlope which
  // calls demingSlopeFromSums(sxx, syy, sxy, lambda) with x = row index,
  // y = total_tokens. Returns 0 for sxy = 0 (orthogonal/no covariance).
  return demingSlopeFromSums(sxx, syy, sxy, lambda);
}

/**
 * Compute `(T_dot_i, T_ddot_i)` at the equal-weight point `w =
 * (1,...,1)` via symmetric finite differences with step `eps`. Uses
 * `2n + 1` weighted Deming evaluations.
 */
export function abcDirectionalDerivatives(
  ys: readonly number[],
  lambda: number,
  eps: number,
): { tDot: number[]; tDdot: number[]; thetaHat: number } {
  const n = ys.length;
  const w = new Array<number>(n).fill(1);
  const thetaHat = weightedDemingSlope(ys, w, lambda);
  const tDot = new Array<number>(n).fill(0);
  const tDdot = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    w[i] = 1 + eps;
    const tPlus = weightedDemingSlope(ys, w, lambda);
    w[i] = 1 - eps;
    const tMinus = weightedDemingSlope(ys, w, lambda);
    w[i] = 1;
    tDot[i] = (tPlus - tMinus) / (2 * eps);
    tDdot[i] = (tPlus - 2 * thetaHat + tMinus) / (eps * eps);
  }
  return { tDot, tDdot, thetaHat };
}

/**
 * ABC acceleration `a = (1/6) * sum T_dot^3 / (sum T_dot^2)^{3/2}`.
 * Returns 0 if `sum T_dot^2 == 0`.
 */
export function abcAcceleration(tDot: readonly number[]): number {
  let s2 = 0;
  let s3 = 0;
  for (let i = 0; i < tDot.length; i += 1) {
    const v = tDot[i]!;
    s2 += v * v;
    s3 += v * v * v;
  }
  if (s2 === 0) return 0;
  const den = 6 * Math.pow(s2, 1.5);
  if (den === 0 || !Number.isFinite(den)) return 0;
  const a = s3 / den;
  return Number.isFinite(a) ? a : 0;
}

/**
 * ABC analytic bias `b = (1 / (2 * n^2)) * sum T_ddot_i`. Returns 0
 * for empty input.
 */
export function abcBias(tDdot: readonly number[]): number {
  const n = tDdot.length;
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += tDdot[i]!;
  const b = s / (2 * n * n);
  return Number.isFinite(b) ? b : 0;
}

/**
 * Nonparametric delta-method SE: `sqrt(sum T_dot^2) / n`.
 */
export function abcSigmaHat(tDot: readonly number[]): number {
  let s2 = 0;
  for (let i = 0; i < tDot.length; i += 1) {
    const v = tDot[i]!;
    s2 += v * v;
  }
  const n = tDot.length;
  if (n === 0) return 0;
  return Math.sqrt(s2) / n;
}

/**
 * ABC curvature `cq` per Diciccio-Efron eq. (5.6). Diagnostic only —
 * we use the ABCq form (cq = 0) for endpoint construction. Computes:
 *
 *     w_i*  = 1 + eps * T_dot_i / (n * sigmaHat)
 *     cq    = ( T(w*) - thetaHat ) / (eps^2 * sigmaHat)
 *           - sum_i T_dot_i^2 / (n^2 * sigmaHat)
 *
 * Returns 0 if `sigmaHat == 0`.
 */
export function abcCurvature(
  ys: readonly number[],
  tDot: readonly number[],
  thetaHat: number,
  sigmaHat: number,
  lambda: number,
  eps: number,
): number {
  if (sigmaHat === 0) return 0;
  const n = ys.length;
  const w = new Array<number>(n);
  let s2 = 0;
  for (let i = 0; i < n; i += 1) {
    s2 += tDot[i]! * tDot[i]!;
    w[i] = 1 + (eps * tDot[i]!) / (n * sigmaHat);
  }
  const tStar = weightedDemingSlope(ys, w, lambda);
  const term1 = (tStar - thetaHat) / (eps * eps * sigmaHat);
  const term2 = s2 / (n * n * sigmaHat);
  const cq = term1 - term2;
  return Number.isFinite(cq) ? cq : 0;
}

/**
 * Compute the ABC interval endpoint at signed quantile `zAlpha`.
 * Returns `[wAlpha, thetaAlpha]` where `wAlpha` is the transformed
 * z-score and `thetaAlpha` is the Deming slope evaluated at the
 * perturbed weight vector.
 *
 * If `sum T_dot^2 == 0` (no influence), returns `[0, thetaHat]`.
 * Perturbed weights `w_i* <= 0` are clamped to `1e-9`.
 */
export function abcEndpoint(
  ys: readonly number[],
  tDot: readonly number[],
  thetaHat: number,
  a: number,
  b: number,
  zAlpha: number,
  lambda: number,
): { wAlpha: number; thetaAlpha: number } {
  let s2 = 0;
  for (let i = 0; i < tDot.length; i += 1) s2 += tDot[i]! * tDot[i]!;
  if (s2 === 0) return { wAlpha: 0, thetaAlpha: thetaHat };
  const denomBase = 1 - a * (b + zAlpha);
  let wAlpha: number;
  if (denomBase === 0 || !Number.isFinite(denomBase)) {
    wAlpha = b + (b + zAlpha);
  } else {
    wAlpha = b + (b + zAlpha) / (denomBase * denomBase);
  }
  if (!Number.isFinite(wAlpha)) {
    wAlpha = b + (b + zAlpha);
  }
  const sqrtS2 = Math.sqrt(s2);
  const lamA = wAlpha / sqrtS2;
  const n = ys.length;
  const w = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const wi = 1 + lamA * tDot[i]!;
    w[i] = wi > 0 ? wi : 1e-9;
  }
  const thetaAlpha = weightedDemingSlope(ys, w, lambda);
  return { wAlpha, thetaAlpha };
}

export function buildSourceRowTokenAbcBootstrapSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenAbcBootstrapSlopeCiOptions = {},
): SourceRowTokenAbcBootstrapSlopeCiReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
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
  const abcEps = opts.abcEps ?? 0.01;
  if (!Number.isFinite(abcEps) || abcEps <= 0 || abcEps > 0.5) {
    throw new Error(
      `abcEps must be a finite number in (0, 0.5] (got ${opts.abcEps})`,
    );
  }
  const alertZeroInCi = opts.alertZeroInCi ?? false;
  const alertDotDispersionMin = opts.alertDotDispersionMin ?? 0;
  if (!Number.isFinite(alertDotDispersionMin) || alertDotDispersionMin < 0) {
    throw new Error(
      `alertDotDispersionMin must be a finite, non-negative number (got ${opts.alertDotDispersionMin})`,
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
  const allRows: SourceRowTokenAbcBootstrapSlopeCiRow[] = [];
  let droppedBelowMinRows = 0;

  const sourceKeys = Array.from(perSource.keys()).sort();

  const zLo = inverseStandardNormalCdf((1 - confidence) / 2);
  const zHi = inverseStandardNormalCdf((1 + confidence) / 2);

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

    const { tDot, tDdot, thetaHat } = abcDirectionalDerivatives(
      xs,
      lambda,
      abcEps,
    );
    const a = abcAcceleration(tDot);
    const b = abcBias(tDdot);
    const sigmaHat = abcSigmaHat(tDot);
    const cq = abcCurvature(xs, tDot, thetaHat, sigmaHat, lambda, abcEps);

    const lo = abcEndpoint(xs, tDot, thetaHat, a, b, zLo, lambda);
    const hi = abcEndpoint(xs, tDot, thetaHat, a, b, zHi, lambda);

    let ciLower = lo.thetaAlpha;
    let ciUpper = hi.thetaAlpha;
    if (ciLower > ciUpper) {
      // Defensive: extreme acceleration could swap order; restore.
      const tmp = ciLower;
      ciLower = ciUpper;
      ciUpper = tmp;
    }
    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;

    // Influence diagnostics.
    let absSum = 0;
    let absMax = 0;
    let degenerate = 0;
    const deg = 1e-12 * sigmaHat * n;
    for (let i = 0; i < n; i += 1) {
      const v = Math.abs(tDot[i]!);
      absSum += v;
      if (v > absMax) absMax = v;
      if (sigmaHat > 0 && v < deg) degenerate += 1;
    }
    const meanAbs = absSum / n;
    const dotDispersion = meanAbs === 0 ? 0 : absMax / meanAbs;

    // Refinement (v0.6.224 follow-up): top-2 |T_dot| concentration share.
    let dotConcentrationTop2 = 0;
    if (absSum > 0 && n >= 2) {
      let top1 = 0;
      let top2 = 0;
      for (let i = 0; i < n; i += 1) {
        const v = Math.abs(tDot[i]!);
        if (v > top1) {
          top2 = top1;
          top1 = v;
        } else if (v > top2) {
          top2 = v;
        }
      }
      dotConcentrationTop2 = (top1 + top2) / absSum;
    }

    allRows.push({
      source,
      rowsKept: n,
      slope: thetaHat,
      accelerationAbc: a,
      biasAbc: b,
      sigmaHat,
      cqAbc: cq,
      wLower: lo.wAlpha,
      wUpper: hi.wAlpha,
      ciLower,
      ciUpper,
      ciWidth,
      ciContainsZero,
      dotDispersion,
      degenerateDotCount: degenerate,
      dotConcentrationTop2,
    });
  }

  let droppedNotZeroInCi = 0;
  let droppedBelowDotDispersion = 0;
  const survived: SourceRowTokenAbcBootstrapSlopeCiRow[] = [];
  for (const row of allRows) {
    if (alertZeroInCi && !row.ciContainsZero) {
      droppedNotZeroInCi += 1;
      continue;
    }
    if (row.dotDispersion < alertDotDispersionMin) {
      droppedBelowDotDispersion += 1;
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
    else if (sort === 'acceleration-magnitude-desc')
      primary = Math.abs(q.accelerationAbc) - Math.abs(p.accelerationAbc);
    else if (sort === 'bias-magnitude-desc')
      primary = Math.abs(q.biasAbc) - Math.abs(p.biasAbc);
    else if (sort === 'sigma-hat-desc') primary = q.sigmaHat - p.sigmaHat;
    else if (sort === 'dot-dispersion-desc')
      primary = q.dotDispersion - p.dotDispersion;
    else if (sort === 'dot-concentration-top2-desc')
      primary = q.dotConcentrationTop2 - p.dotConcentrationTop2;
    else if (sort === 'ci-contains-zero-first')
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
    confidence,
    lambda,
    abcEps,
    alertZeroInCi,
    alertDotDispersionMin,
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
    droppedBelowDotDispersion,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
