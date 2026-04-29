/**
 * source-row-token-profile-likelihood-slope-ci: per-source
 * **profile-likelihood confidence interval** for the v0.6.219 Deming
 * regression slope of per-row `total_tokens` against row index, in
 * tokens / row.
 *
 * Headline question: **for each source, what is the confidence
 * interval obtained by inverting the profile log-likelihood ratio
 * for the Deming slope at confidence level `c`?**
 *
 * Mechanical class — **likelihood-ratio inversion (Wilks 1938,
 * Annals of Mathematical Statistics 9:60-62; Cox & Hinkley 1974,
 * "Theoretical Statistics", Ch. 9)**. This is the **sixth
 * uncertainty-quantification lens** in the slope suite and the only
 * one that produces a CI by **inverting a likelihood ratio test
 * statistic** rather than by resampling or by computing a standard
 * error.
 *
 * Mechanically distinct from every prior CI lens:
 *
 *   - **vs v0.6.220 percentile bootstrap CI** — that lens runs `B`
 *     Monte-Carlo Deming refits with replacement and ranks the raw
 *     slope replicates. This lens runs **zero** Monte-Carlo
 *     resamples; it evaluates the profile RSS at candidate slopes
 *     and bisects two roots of `2n*log(R(beta)/R(thetaHat)) =
 *     chi2_{1, 1-alpha}`.
 *   - **vs v0.6.221 jackknife normal CI** — jackknife uses
 *     leave-one-out replicates and a SYMMETRIC `+/- z*jackSe`
 *     envelope. The profile-likelihood CI uses NO leave-one-out, NO
 *     SE, and is intrinsically ASYMMETRIC (the two bisection roots
 *     of the W(beta) curve are independently located).
 *   - **vs v0.6.222 BCa bootstrap CI** — BCa is bias-corrected and
 *     accelerated bootstrap; needs `B` resamples + `n` jackknife
 *     replicates for the acceleration. This lens needs neither.
 *   - **vs v0.6.223 studentized-t bootstrap CI** — studentized-t
 *     runs `B*n` Deming fits (outer bootstrap + inner jackknife).
 *     This lens runs `2 * (numIterations + 1)` Deming-RSS
 *     evaluations + `2 * numIterations` bisection steps; for the
 *     default 60-iteration bisection that's 240 RSS evals (each
 *     O(1) given the precomputed sums) per source — orders of
 *     magnitude cheaper.
 *   - **vs v0.6.224 ABC CI** — ABC computes analytic directional
 *     derivatives `T_dot_i = dT/dw_i` of the slope at the
 *     equal-weight point and produces an asymmetric CI shifted by
 *     analytic bias `b` and stretched by analytic acceleration
 *     `a`. ABC is the analytic limit of BCa. This lens is unrelated
 *     to BCa: it inverts a likelihood ratio statistic, not a
 *     bootstrap percentile, and its asymmetry comes from the
 *     curvature of the RSS curve at thetaHat, not from acceleration.
 *
 * The procedure (per source):
 *
 *   1. Compute the centered sums of squares and cross-product:
 *      `s_xx = sum (t_i - tbar)^2`, `s_yy = sum (x_i - xbar)^2`,
 *      `s_xy = sum (t_i - tbar)(x_i - xbar)`.
 *   2. The MLE slope is the v0.6.219 Deming closed form,
 *      `thetaHat = demingSlopeFromSums(s_xx, s_yy, s_xy, lambda)`.
 *   3. The Deming **profile log-likelihood** at any candidate slope
 *      `beta`, after concentrating out the intercept
 *      `alpha(beta) = xbar - beta*tbar`, reduces to a closed-form
 *      profile residual sum of squares:
 *
 *          R(beta) = (s_yy - 2*beta*s_xy + beta^2*s_xx)
 *                    / (1 + lambda * beta^2)
 *
 *      (this is the orthogonal-regression sum of squared
 *      perpendicular distances at lambda = 1, and the standard
 *      Deming MLE residual sum at any lambda > 0). `R(thetaHat)` is
 *      the minimum.
 *   4. Wilks' statistic:
 *
 *          W(beta) = 2 * n * log( R(beta) / R(thetaHat) )
 *
 *      Wilks 1938 shows W(beta_true) ~ chi2_1 asymptotically. The
 *      `1 - alpha` profile-likelihood CI is the set of `beta` where
 *
 *          W(beta) <= chi2_{1, 1 - alpha} = z_{1 - alpha/2}^2
 *
 *      i.e. the slope values that the data cannot reject at
 *      confidence `c = 1 - alpha`. We solve for the two crossings
 *      of the threshold by bisection on each side of `thetaHat`.
 *   5. Initial bracket: expand outward from `thetaHat` by
 *      doubling steps starting from
 *      `step = max(|thetaHat| * 0.5, sqrt(R(thetaHat) / (n * s_xx)))`
 *      (the Fisher-information-based local SE) until W exceeds the
 *      threshold or `--max-bracket-doublings` is reached. Then
 *      bisect for `--bisection-iterations` rounds.
 *
 * Reports per source: `slope` (point Deming MLE), `nllAtMle` (the
 * profile residual sum at thetaHat), `chi2Threshold` (the level
 * curve), `ciLower`, `ciUpper`, `ciWidth`, `ciAsymmetry =
 * (ciUpper - thetaHat) - (thetaHat - ciLower)` (the *signed*
 * asymmetry the symmetric jackknife CI cannot capture; positive =
 * the upper arm is wider), `ciContainsZero`, `wilksAtZero` (the
 * Wilks statistic evaluated at beta = 0 — a direct
 * likelihood-ratio test of "no trend"; reject H0: slope=0 at level
 * `1-c` iff `wilksAtZero > chi2Threshold`), and `bracketHits`
 * (number of bracket-doubling rounds actually used; if it equals
 * `--max-bracket-doublings` the corresponding CI endpoint may be
 * unreliable and surfaces in `bracketSaturated`).
 *
 * Determinism: pure builder, no RNG. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 *
 * Edge cases:
 *
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: `s_yy = s_xy = 0`, point slope is 0,
 *     `R(beta) = beta^2 * s_xx / (1 + lambda * beta^2)`, which
 *     yields W(beta) -> +Infinity for any beta != 0. The CI
 *     collapses to `[0, 0]`, ciWidth = 0, ciContainsZero = true.
 *   - **`R(thetaHat) <= 0`**: numerically degenerate (perfect fit);
 *     CI collapses to `[thetaHat, thetaHat]`.
 *   - **`--confidence` not in (0, 1)**: rejected.
 *   - **`--lambda <= 0`**: rejected.
 *   - **`--bisection-iterations <= 0`**: rejected.
 *   - **`--max-bracket-doublings <= 0`**: rejected.
 */
import type { QueueLine } from './types.js';
import { demingSlopeFromSums } from './sourcerowtokendemingslope.js';
import { inverseStandardNormalCdf } from './sourcerowtokenjackknifeslopeci.js';

export interface SourceRowTokenProfileLikelihoodSlopeCiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio var(eps_y)/var(eps_x). Finite > 0. Default 1. */
  lambda?: number;
  /** Bisection rounds per CI endpoint. Integer >= 1. Default 60. */
  bisectionIterations?: number;
  /**
   * Hard cap on bracket-doubling rounds when expanding outward to
   * find a sign change of `W(beta) - chi2Threshold`. Integer >= 1.
   * Default 64. If the cap is hit on either side, the corresponding
   * CI endpoint is the last reached value and the source is added
   * to `bracketSaturated`.
   */
  maxBracketDoublings?: number;
  /**
   * If true, only emit sources whose CI strictly contains zero
   * (i.e. `ciLower <= 0 && ciUpper >= 0`). Default false.
   */
  alertZeroInCi?: boolean;
  /**
   * If true, only emit sources whose Wilks statistic at beta = 0
   * exceeds the chi-square threshold (i.e. the LR test rejects
   * H0: slope = 0 at the requested confidence). Default false.
   */
  alertRejectZero?: boolean;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'ci-asymmetry-magnitude-desc'
    | 'wilks-at-zero-desc'
    | 'ci-contains-zero-first'
    | 'reject-zero-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenProfileLikelihoodSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming MLE slope on the full data, in tokens / row. */
  slope: number;
  /** Profile residual sum of squares at thetaHat: R(thetaHat). */
  rssAtMle: number;
  /** chi2_{1, 1-alpha} = z_{1-alpha/2}^2 (the Wilks threshold). */
  chi2Threshold: number;
  /** Lower endpoint of the profile-likelihood CI. */
  ciLower: number;
  /** Upper endpoint of the profile-likelihood CI. */
  ciUpper: number;
  /** ciUpper - ciLower. */
  ciWidth: number;
  /**
   * Signed CI asymmetry: `(ciUpper - thetaHat) - (thetaHat - ciLower)`.
   * Positive = the upper arm of the CI is wider than the lower arm
   * (right-skewed). Zero = perfectly symmetric. The jackknife and
   * studentized-t-bootstrap-around-jackknife CIs are intrinsically
   * symmetric and cannot reveal this; the percentile / BCa / ABC
   * bootstrap CIs and this profile-likelihood CI all can.
   */
  ciAsymmetry: number;
  /** True iff `ciLower <= 0 && ciUpper >= 0`. */
  ciContainsZero: boolean;
  /**
   * Wilks statistic at beta = 0: `2n*log(R(0)/R(thetaHat))`. This
   * is the profile-likelihood ratio test statistic for the null
   * hypothesis "slope = 0" (no per-row trend). Reject H0 at level
   * `1 - c` iff `wilksAtZero > chi2Threshold`.
   */
  wilksAtZero: number;
  /** True iff `wilksAtZero > chi2Threshold`. */
  rejectZero: boolean;
  /**
   * Number of bracket-doubling rounds used to find the lower
   * endpoint (`<= maxBracketDoublings`). Equals the cap iff the
   * search saturated.
   */
  bracketDoublingsLower: number;
  /** Same for the upper endpoint. */
  bracketDoublingsUpper: number;
  /**
   * True iff either side hit `maxBracketDoublings` without crossing
   * the chi-square threshold. The reported endpoint is then the
   * last bracket value (a lower bound on the true endpoint) and the
   * CI is conservative on that side.
   */
  bracketSaturated: boolean;
}

export interface SourceRowTokenProfileLikelihoodSlopeCiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  /** chi2_{1, 1-alpha} = z_{1-alpha/2}^2. */
  chi2Threshold: number;
  lambda: number;
  bisectionIterations: number;
  maxBracketDoublings: number;
  alertZeroInCi: boolean;
  alertRejectZero: boolean;
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'ci-asymmetry-magnitude-desc'
    | 'wilks-at-zero-desc'
    | 'ci-contains-zero-first'
    | 'reject-zero-first'
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
  droppedNotRejectZero: number;
  droppedBelowTopCap: number;
  bracketSaturatedCount: number;
  sources: SourceRowTokenProfileLikelihoodSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'ci-asymmetry-magnitude-desc',
  'wilks-at-zero-desc',
  'ci-contains-zero-first',
  'reject-zero-first',
  'rows',
  'source',
] as const;

/**
 * Profile residual sum of squares for the Deming MLE at variance
 * ratio `lambda`, evaluated at candidate slope `beta`. Closed form
 * after concentrating the intercept out:
 *
 *   R(beta) = (s_yy - 2*beta*s_xy + beta^2*s_xx) / (1 + lambda*beta^2)
 *
 * Returns +Infinity if the numerator is negative (defensive — should
 * not happen for valid sums) and 0 if both numerator and denominator
 * are 0 (degenerate). The minimum over beta is attained at the
 * v0.6.219 Deming closed-form slope.
 */
export function demingProfileRss(
  sxx: number,
  syy: number,
  sxy: number,
  lambda: number,
  beta: number,
): number {
  const num = syy - 2 * beta * sxy + beta * beta * sxx;
  const den = 1 + lambda * beta * beta;
  if (den === 0) return Number.POSITIVE_INFINITY;
  if (num <= 0) return num === 0 ? 0 : Number.POSITIVE_INFINITY;
  return num / den;
}

/**
 * Wilks' profile log-likelihood ratio statistic at `beta`, given the
 * Deming MLE profile RSS (`rssAtMle`) computed at the closed-form
 * slope `thetaHat`. Returns 0 at the MLE and grows roughly
 * quadratically away from it.
 *
 *     W(beta) = 2 * n * log( R(beta) / R(thetaHat) )
 *
 * Returns +Infinity if `rssAtMle <= 0` and `R(beta) > 0` (the
 * data are perfectly explained at the MLE so any other slope is
 * infinitely worse) and NaN if both are 0.
 */
export function wilksStatistic(
  n: number,
  rssAtBeta: number,
  rssAtMle: number,
): number {
  if (rssAtMle <= 0) {
    if (rssAtBeta <= 0) return Number.NaN;
    return Number.POSITIVE_INFINITY;
  }
  if (rssAtBeta <= 0) return 0;
  return 2 * n * Math.log(rssAtBeta / rssAtMle);
}

interface BracketResult {
  endpoint: number;
  doublings: number;
  saturated: boolean;
}

/**
 * Find the crossing of `W(beta) = threshold` on a given side of
 * `thetaHat` by (a) doubling-step bracket expansion until W exceeds
 * the threshold or `maxDoublings` is hit, then (b) `bisectionIters`
 * bisection rounds. `direction = +1` searches for the upper
 * endpoint, `direction = -1` searches for the lower endpoint.
 *
 * Returns the last reached value (a conservative endpoint, equal to
 * the bracket-expansion frontier) and `saturated = true` if the cap
 * was hit without finding a sign change.
 */
export function bracketAndBisect(
  n: number,
  sxx: number,
  syy: number,
  sxy: number,
  lambda: number,
  thetaHat: number,
  rssAtMle: number,
  threshold: number,
  initialStep: number,
  direction: 1 | -1,
  maxDoublings: number,
  bisectionIters: number,
): BracketResult {
  let step = initialStep;
  if (!Number.isFinite(step) || step <= 0) step = 1;
  let lo = thetaHat;
  let hi = thetaHat + direction * step;
  let wHi = wilksStatistic(n, demingProfileRss(sxx, syy, sxy, lambda, hi), rssAtMle);
  let doublings = 1;
  while (wHi <= threshold && doublings < maxDoublings) {
    lo = hi;
    step *= 2;
    hi = thetaHat + direction * step;
    wHi = wilksStatistic(n, demingProfileRss(sxx, syy, sxy, lambda, hi), rssAtMle);
    doublings += 1;
  }
  if (wHi <= threshold) {
    // Saturated without crossing — return the conservative endpoint.
    return { endpoint: hi, doublings, saturated: true };
  }
  // Bisect between [lo, hi] (W(lo) <= threshold, W(hi) > threshold).
  for (let i = 0; i < bisectionIters; i += 1) {
    const mid = 0.5 * (lo + hi);
    const wMid = wilksStatistic(
      n,
      demingProfileRss(sxx, syy, sxy, lambda, mid),
      rssAtMle,
    );
    if (wMid <= threshold) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { endpoint: 0.5 * (lo + hi), doublings, saturated: false };
}

export function buildSourceRowTokenProfileLikelihoodSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenProfileLikelihoodSlopeCiOptions = {},
): SourceRowTokenProfileLikelihoodSlopeCiReport {
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
  const bisectionIterations = opts.bisectionIterations ?? 60;
  if (!Number.isInteger(bisectionIterations) || bisectionIterations < 1) {
    throw new Error(
      `bisectionIterations must be a positive integer (got ${opts.bisectionIterations})`,
    );
  }
  const maxBracketDoublings = opts.maxBracketDoublings ?? 64;
  if (!Number.isInteger(maxBracketDoublings) || maxBracketDoublings < 1) {
    throw new Error(
      `maxBracketDoublings must be a positive integer (got ${opts.maxBracketDoublings})`,
    );
  }
  const alertZeroInCi = opts.alertZeroInCi ?? false;
  const alertRejectZero = opts.alertRejectZero ?? false;
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
  const z = inverseStandardNormalCdf((1 + confidence) / 2);
  const chi2Threshold = z * z;

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
  const allRows: SourceRowTokenProfileLikelihoodSlopeCiRow[] = [];
  let droppedBelowMinRows = 0;

  const sourceKeys = Array.from(perSource.keys()).sort();

  for (const source of sourceKeys) {
    const samples = perSource.get(source)!;
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    samples.sort((p, q) => (p.ms !== q.ms ? p.ms - q.ms : p.ord - q.ord));

    // Compute centered sums on relabeled x-axis (0..n-1).
    let xsum = 0;
    let ysum = 0;
    for (let i = 0; i < n; i += 1) {
      xsum += i;
      ysum += samples[i]!.x;
    }
    const xbar = xsum / n;
    const ybar = ysum / n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let i = 0; i < n; i += 1) {
      const dx = i - xbar;
      const dy = samples[i]!.x - ybar;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }

    let thetaHat: number;
    if (sxx === 0 || sxy === 0) {
      thetaHat = 0;
    } else {
      thetaHat = demingSlopeFromSums(sxx, syy, sxy, lambda);
    }
    const rssAtMle = demingProfileRss(sxx, syy, sxy, lambda, thetaHat);
    const wilksAtZero = wilksStatistic(
      n,
      demingProfileRss(sxx, syy, sxy, lambda, 0),
      rssAtMle,
    );

    // Initial step heuristic: max of |thetaHat|/2 and the
    // Fisher-information local SE estimate sqrt(R(thetaHat)/(n*sxx)).
    let initialStep = Math.abs(thetaHat) * 0.5;
    if (rssAtMle > 0 && sxx > 0 && Number.isFinite(rssAtMle)) {
      const fisherSe = Math.sqrt(rssAtMle / (n * sxx));
      if (Number.isFinite(fisherSe) && fisherSe > 0 && fisherSe > initialStep) {
        initialStep = fisherSe;
      }
    }
    if (!(initialStep > 0)) initialStep = 1;

    let ciLower: number;
    let ciUpper: number;
    let bracketDoublingsLower = 0;
    let bracketDoublingsUpper = 0;
    let bracketSaturated = false;

    if (rssAtMle <= 0 || !Number.isFinite(rssAtMle)) {
      // Degenerate: perfect fit at MLE, CI collapses to point.
      ciLower = thetaHat;
      ciUpper = thetaHat;
    } else if (sxx === 0 || (sxy === 0 && syy === 0)) {
      // No variance in y or no covariance with index — flat series,
      // CI collapses to [0, 0].
      ciLower = 0;
      ciUpper = 0;
    } else {
      const upper = bracketAndBisect(
        n,
        sxx,
        syy,
        sxy,
        lambda,
        thetaHat,
        rssAtMle,
        chi2Threshold,
        initialStep,
        +1,
        maxBracketDoublings,
        bisectionIterations,
      );
      const lower = bracketAndBisect(
        n,
        sxx,
        syy,
        sxy,
        lambda,
        thetaHat,
        rssAtMle,
        chi2Threshold,
        initialStep,
        -1,
        maxBracketDoublings,
        bisectionIterations,
      );
      ciUpper = upper.endpoint;
      ciLower = lower.endpoint;
      bracketDoublingsUpper = upper.doublings;
      bracketDoublingsLower = lower.doublings;
      bracketSaturated = upper.saturated || lower.saturated;
    }

    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;
    const ciAsymmetry = ciUpper - thetaHat - (thetaHat - ciLower);
    const rejectZero =
      !Number.isNaN(wilksAtZero) && wilksAtZero > chi2Threshold;

    allRows.push({
      source,
      rowsKept: n,
      slope: thetaHat,
      rssAtMle,
      chi2Threshold,
      ciLower,
      ciUpper,
      ciWidth,
      ciAsymmetry,
      ciContainsZero,
      wilksAtZero,
      rejectZero,
      bracketDoublingsLower,
      bracketDoublingsUpper,
      bracketSaturated,
    });
  }

  let droppedNotZeroInCi = 0;
  let droppedNotRejectZero = 0;
  const survived: SourceRowTokenProfileLikelihoodSlopeCiRow[] = [];
  for (const row of allRows) {
    if (alertZeroInCi && !row.ciContainsZero) {
      droppedNotZeroInCi += 1;
      continue;
    }
    if (alertRejectZero && !row.rejectZero) {
      droppedNotRejectZero += 1;
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
    else if (sort === 'ci-asymmetry-magnitude-desc')
      primary = Math.abs(q.ciAsymmetry) - Math.abs(p.ciAsymmetry);
    else if (sort === 'wilks-at-zero-desc') {
      const pv = Number.isFinite(p.wilksAtZero) ? p.wilksAtZero : -1;
      const qv = Number.isFinite(q.wilksAtZero) ? q.wilksAtZero : -1;
      primary = qv - pv;
    } else if (sort === 'ci-contains-zero-first')
      primary = (q.ciContainsZero ? 1 : 0) - (p.ciContainsZero ? 1 : 0);
    else if (sort === 'reject-zero-first')
      primary = (q.rejectZero ? 1 : 0) - (p.rejectZero ? 1 : 0);
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

  let bracketSaturatedCount = 0;
  for (const r of finalSources) if (r.bracketSaturated) bracketSaturatedCount += 1;

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minRows,
    confidence,
    chi2Threshold,
    lambda,
    bisectionIterations,
    maxBracketDoublings,
    alertZeroInCi,
    alertRejectZero,
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
    droppedNotRejectZero,
    droppedBelowTopCap,
    bracketSaturatedCount,
    sources: finalSources,
  };
}
