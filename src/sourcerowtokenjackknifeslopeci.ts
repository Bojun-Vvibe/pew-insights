/**
 * source-row-token-jackknife-slope-ci: per-source **jackknife
 * (leave-one-out) confidence interval** for the Deming regression
 * slope of per-row `total_tokens` against row index, in tokens / row.
 *
 * Headline question: **for each source, what is the jackknife
 * leave-one-out estimate of the standard error of the Deming
 * slope** — and does the resulting normal-approximation CI
 * straddle zero?
 *
 * Mechanical class — **deterministic resampling: jackknife
 * (Quenouille 1949 / Tukey 1958)**. Sibling lens to v0.6.220
 * `source-row-token-bootstrap-slope-ci`, but mechanically distinct:
 *
 *   - **Bootstrap (v0.6.220)**: random with-replacement resampling,
 *     `B` resamples, percentile CI, RNG-driven (LCG seed). Adds
 *     `bootMean / bootStd / ciLower / ciUpper` (percentile).
 *   - **Jackknife (this lens)**: deterministic leave-one-out
 *     resampling, exactly `n` resamples (one per dropped row), uses
 *     the **classical jackknife SE formula**:
 *
 *         jackMean = (1/n) * sum_i theta_(-i)
 *         jackSe   = sqrt( ((n-1)/n) * sum_i (theta_(-i) - jackMean)^2 )
 *         bias     = (n-1) * (jackMean - thetaFull)
 *         biasCorrected = thetaFull - bias = n*thetaFull - (n-1)*jackMean
 *
 *     and reports a **normal-approximation studentized CI** centered
 *     on the bias-corrected slope:
 *
 *         ciLower = biasCorrected - z * jackSe
 *         ciUpper = biasCorrected + z * jackSe
 *
 *     where `z` is the inverse-Phi of `(1 + confidence)/2` — i.e.
 *     the symmetric normal quantile (e.g. z=1.959964 for the default
 *     0.95 confidence). No RNG, no seed.
 *
 * Bootstrap and jackknife answer **mechanically different questions**:
 *
 *   - Bootstrap simulates the *sampling distribution* of the
 *     estimator under repeated random draws and reports a
 *     **percentile** CI (no Gaussian assumption, but no bias
 *     correction either).
 *   - Jackknife produces a **bias and variance estimate** by
 *     leave-one-out; the CI here is **normal-approximation around
 *     the bias-corrected slope** (Gaussian assumption, but a
 *     closed-form bias correction the bootstrap doesn't give).
 *
 * On the same data the two lenses can disagree: jackknife often
 * delivers a tighter SE for smooth estimators on well-conditioned
 * data, but is brittle (assumes the jackknife distribution is
 * roughly Gaussian) where the bootstrap percentile CI handles
 * fat-tailed leverage cases gracefully. The pair is the standard
 * resampling-CI duo (Efron 1979, *Annals of Statistics*).
 *
 * Mechanically distinct from every previously shipped lens:
 *
 *   - vs **`source-row-token-bootstrap-slope-ci`** (v0.6.220):
 *     deterministic vs random, leave-one-out vs with-replacement,
 *     normal-approx vs percentile, **adds a bias estimate that
 *     bootstrap doesn't produce**.
 *   - vs **`source-row-token-deming-slope`** (v0.6.219): same
 *     point estimator at the heart, but adds the
 *     **bias-corrected** slope plus its SE-based CI.
 *   - vs every other slope lens (Theil-Sen / Siegel /
 *     Passing-Bablok / OLS / M-estimator family): all point
 *     estimators with no uncertainty quantification.
 *   - vs **Mann-Kendall** (v0.6.211): MK reports a *p-value* of
 *     monotone trend; this lens reports an **interval estimate**
 *     for the slope itself in tokens / row.
 *
 * Determinism: pure builder, no RNG. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 *
 * Edge cases:
 *
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: the full-data Deming slope is 0 and every
 *     leave-one-out slope is 0; SE = 0, bias = 0, CI = [0, 0],
 *     ciContainsZero = true.
 *   - **`--confidence` not in (0, 1)**: rejected.
 *   - **`--lambda <= 0`**: rejected.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens` -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens` -> droppedNegativeTokens.
 *   5. Group rows by source, sort per-source by `hour_start` asc
 *      (tiebreak input order).
 *   6. Per source: skip if `n < minRows` (default 4).
 *   7. Compute the full-data Deming slope (`thetaFull`).
 *   8. For each i in `0..n-1`, compute the Deming slope on the
 *      length-(n-1) series with row i removed (relabel positions
 *      `0..n-2` as the new x axis).
 *   9. Compute jackMean, jackSe, bias, biasCorrected, ciLower,
 *      ciUpper, ciWidth, ciContainsZero.
 *  10. Apply display gates: `--alert-zero-in-ci` (filter to only
 *      sources whose CI straddles zero).
 *  11. Sort, then optionally cap with `--top`.
 */
import type { QueueLine } from './types.js';
import {
  demingSlope,
  demingSlopeFromSums,
} from './sourcerowtokendemingslope.js';

export interface SourceRowTokenJackknifeSlopeCiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Confidence level in (0, 1). Default 0.95. */
  confidence?: number;
  /** Variance ratio for inner Deming fit. Finite > 0. Default 1. */
  lambda?: number;
  /**
   * If true, only emit sources whose CI strictly contains zero
   * (i.e. `ciLower <= 0 && ciUpper >= 0`). Default false.
   */
  alertZeroInCi?: boolean;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'jack-se-desc'
    | 'bias-magnitude-desc'
    | 'ci-contains-zero-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenJackknifeSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming point slope on the full data, in tokens / row. */
  slope: number;
  /** Mean of the `n` leave-one-out Deming slopes. */
  jackMean: number;
  /**
   * Classical jackknife standard error:
   * `sqrt( ((n-1)/n) * sum_i (theta_(-i) - jackMean)^2 )`.
   */
  jackSe: number;
  /**
   * Quenouille-Tukey jackknife bias estimate:
   * `(n-1) * (jackMean - thetaFull)`. Positive = the leave-one-out
   * mean is above the full-data point estimate (i.e. the full-data
   * estimator is biased downward; the bias-corrected slope is below
   * the point slope).
   */
  bias: number;
  /**
   * Bias-corrected slope: `thetaFull - bias = n*thetaFull - (n-1)*jackMean`.
   */
  biasCorrected: number;
  /** `biasCorrected - z * jackSe`, where z = Phi^{-1}((1+confidence)/2). */
  ciLower: number;
  /** `biasCorrected + z * jackSe`. */
  ciUpper: number;
  /** `ciUpper - ciLower = 2 * z * jackSe`. */
  ciWidth: number;
  /**
   * True iff `ciLower <= 0 && ciUpper >= 0` — the slope is **not**
   * statistically distinguishable from zero at the requested
   * confidence under the jackknife normal-approximation CI.
   */
  ciContainsZero: boolean;
}

export interface SourceRowTokenJackknifeSlopeCiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  confidence: number;
  /** The symmetric normal quantile used for the CI. */
  zCritical: number;
  lambda: number;
  alertZeroInCi: boolean;
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'jack-se-desc'
    | 'bias-magnitude-desc'
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
  droppedBelowTopCap: number;
  sources: SourceRowTokenJackknifeSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'jack-se-desc',
  'bias-magnitude-desc',
  'ci-contains-zero-first',
  'rows',
  'source',
] as const;

/**
 * Inverse standard-normal CDF (Acklam 2003 rational approximation).
 * Accurate to ~1e-9 across `(0, 1)`. Returns -Infinity at 0,
 * +Infinity at 1, NaN outside `[0, 1]`.
 */
export function inverseStandardNormalCdf(p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 1) return Number.NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  // Coefficients
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;
  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;
  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;
  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  );
}

/**
 * Compute the Deming slope on a series whose x-axis is `0..n-1`
 * (relabeled positions; identical to the resample contract used
 * by the bootstrap lens). Robust to all-equal series (returns 0
 * for `s_xy == 0`) and degenerate (single distinct x) inputs.
 */
export function jackknifeDemingSlope(xs: number[], lambda: number): number {
  const n = xs.length;
  if (n < 2) return 0;
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
  if (sxx === 0 || sxy === 0) return 0;
  return demingSlopeFromSums(sxx, syy, sxy, lambda);
}

/**
 * Return the `n` leave-one-out slopes (theta_(-i)) for the supplied
 * series. The dropped row is excluded and the remaining rows are
 * **relabeled** as positions `0..n-2` — same contract as the
 * bootstrap's resample x-axis. Returns the slopes in input order
 * (slopes[i] = the slope with row i dropped).
 */
export function jackknifeLeaveOneOutSlopes(
  xs: number[],
  lambda: number,
): number[] {
  const n = xs.length;
  if (n < 3) {
    // n=2 leave-one-out gives length-1 series, undefined slope -> 0.
    return new Array<number>(n).fill(0);
  }
  const out = new Array<number>(n);
  const buf = new Array<number>(n - 1);
  for (let drop = 0; drop < n; drop += 1) {
    let k = 0;
    for (let i = 0; i < n; i += 1) {
      if (i === drop) continue;
      buf[k] = xs[i]!;
      k += 1;
    }
    out[drop] = jackknifeDemingSlope(buf, lambda);
  }
  return out;
}

export function buildSourceRowTokenJackknifeSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenJackknifeSlopeCiOptions = {},
): SourceRowTokenJackknifeSlopeCiReport {
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
  const alertZeroInCi = opts.alertZeroInCi ?? false;
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
  const zCritical = inverseStandardNormalCdf((1 + confidence) / 2);

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
  const allRows: SourceRowTokenJackknifeSlopeCiRow[] = [];
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
    const xs = samples.map((s) => s.x);

    let pointSlope: number;
    try {
      pointSlope = demingSlope(xs, lambda).slope;
    } catch {
      pointSlope = 0;
    }

    const looSlopes = jackknifeLeaveOneOutSlopes(xs, lambda);
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += looSlopes[i]!;
    const jackMean = sum / n;
    let sqsum = 0;
    for (let i = 0; i < n; i += 1) {
      const d = looSlopes[i]! - jackMean;
      sqsum += d * d;
    }
    // Classical jackknife SE: sqrt( ((n-1)/n) * sum (theta_(-i) - jackMean)^2 ).
    const jackSe = Math.sqrt(((n - 1) / n) * sqsum);
    const bias = (n - 1) * (jackMean - pointSlope);
    const biasCorrected = pointSlope - bias;
    const half = zCritical * jackSe;
    const ciLower = biasCorrected - half;
    const ciUpper = biasCorrected + half;
    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;

    allRows.push({
      source,
      rowsKept: n,
      slope: pointSlope,
      jackMean,
      jackSe,
      bias,
      biasCorrected,
      ciLower,
      ciUpper,
      ciWidth,
      ciContainsZero,
    });
  }

  let droppedNotZeroInCi = 0;
  const survived: SourceRowTokenJackknifeSlopeCiRow[] = [];
  for (const row of allRows) {
    if (alertZeroInCi && !row.ciContainsZero) {
      droppedNotZeroInCi += 1;
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
    else if (sort === 'jack-se-desc') primary = q.jackSe - p.jackSe;
    else if (sort === 'bias-magnitude-desc')
      primary = Math.abs(q.bias) - Math.abs(p.bias);
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
    zCritical,
    lambda,
    alertZeroInCi,
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
    droppedBelowTopCap,
    sources: finalSources,
  };
}
