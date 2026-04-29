/**
 * source-row-token-studentized-bootstrap-slope-ci: per-source
 * **studentized bootstrap (a.k.a. bootstrap-t) confidence interval** for
 * the v0.6.219 Deming regression slope of per-row `total_tokens` against
 * row index `0..n-1`, in tokens / row.
 *
 * Headline question: **for each source, what is the pivotal-t bootstrap
 * confidence interval for the Deming slope** — i.e. the interval built
 * by bootstrapping a *studentized* statistic
 *
 *     T*_b = (theta*_b - thetaHat) / SE*_b
 *
 * (where `SE*_b` is the inner jackknife standard error of `theta*_b`
 * computed from the b-th resample itself), then inverting the
 * empirical distribution of `T*` against the full-data jackknife SE
 * `SE_full`?
 *
 * Mechanical class — **bootstrap-t / studentized bootstrap CI** (Efron
 * & Tibshirani 1993, *An Introduction to the Bootstrap*, Ch. 12.5;
 * Hall 1988, *Annals of Statistics* 16:927-953). Fourth uncertainty-
 * quantification lens in the slope suite. Genuinely novel relative to:
 *
 *   - **percentile bootstrap CI** (v0.6.220, `source-row-token-bootstrap-
 *     slope-ci`): ranks the *raw* bootstrap slopes `theta*_b` and picks
 *     `[(1-conf)/2, (1+conf)/2]` quantiles. This lens ranks the
 *     *studentized* statistic `T*_b = (theta*_b - thetaHat) / SE*_b`
 *     instead, and then maps the t-quantiles back via the full-data SE.
 *     Genuinely a different mechanism: percentile is a quantile of slope
 *     replicates; bootstrap-t is a quantile of *t-statistic* replicates,
 *     pivotally inverted (note the cross-tail flip: the *upper* CI
 *     endpoint uses the *lower* t-quantile, and vice versa).
 *   - **jackknife normal-approx CI** (v0.6.221, `source-row-token-
 *     jackknife-slope-ci`): uses the same `SE_full` as this lens, but
 *     wraps it in a NORMAL envelope `biasCorrected +/- z * SE_full`.
 *     This lens replaces `+/- z` with the empirical t-quantiles of the
 *     bootstrap-t distribution, which absorbs skew and excess kurtosis
 *     of the slope sampling distribution that `+/- z` cannot.
 *   - **BCa bootstrap CI** (v0.6.222, `source-row-token-bca-bootstrap-
 *     slope-ci`): also uses bootstrap resamples and is also second-order
 *     accurate, but it operates on slope quantiles SHIFTED by `z0` and
 *     STRETCHED by `a`. Bootstrap-t pivots on a studentized statistic
 *     (carries inner-resample variability) rather than only adjusting
 *     percentile picks.
 *   - **Deming** (v0.6.219): same point estimator at the heart, plus
 *     a second-order accurate pivotal-t interval (Hall 1988 shows
 *     bootstrap-t is correct to `O(1/n)` for smooth statistics, like
 *     BCa).
 *
 * The procedure (per source):
 *
 *   1. Compute the point Deming slope `thetaHat` on the full data at
 *      the supplied `--lambda` (default 1, orthogonal regression).
 *   2. Compute the full-data jackknife SE
 *
 *          SE_full^2 = ((n-1)/n) * sum_i (theta_(-i) - jackMean)^2
 *
 *      (the same quantity v0.6.221 uses; deterministic, cost O(n)).
 *      If `SE_full == 0` (all jackknife slopes equal), all `T*_b` are
 *      0/0 and the CI collapses to `[thetaHat, thetaHat]` with
 *      `seFull = 0`.
 *   3. Run `B = --bootstraps` non-parametric resamples (resample n
 *      indices with replacement, relabel positions `0..n-1` as the
 *      new x axis, re-fit Deming) under a seeded LCG.
 *   4. For each bootstrap resample compute its *inner* jackknife SE
 *      `SE*_b` from `n` leave-one-out fits on the same resample
 *      (cost O(n) per replicate, total O(B*n) — same order as BCa
 *      since BCa already does an O(n) jackknife once and an O(B*n)
 *      bootstrap; here both are inside the bootstrap loop).
 *   5. **Studentized statistic**:
 *
 *          T*_b = (theta*_b - thetaHat) / SE*_b
 *
 *      If `SE*_b == 0` for a particular resample (constant series in
 *      the resample), that replicate's `T*_b` is treated as 0
 *      (carries no signal; tracked as `degenerateSeReplicates`).
 *   6. Sort the `T*` values ascending and pick the empirical
 *      t-quantiles
 *
 *          tLo = quantile(T*, (1 - confidence)/2)
 *          tHi = quantile(T*, (1 + confidence)/2)
 *
 *      (linear interpolation, same convention as v0.6.220).
 *   7. **Pivotal CI** (NOTE the cross-tail flip):
 *
 *          ciLower = thetaHat - tHi * SE_full
 *          ciUpper = thetaHat - tLo * SE_full
 *
 *      This is the pivotal inversion of `P(tLo <= T* <= tHi) = conf`,
 *      which is correct precisely when `T*` is approximately
 *      pivotal (its distribution does not depend on `theta`). When
 *      `T*` is symmetric about 0, this reduces to a textbook
 *      `thetaHat +/- t * SE_full`; when skewed, the asymmetry is
 *      preserved (this is the whole point of the bootstrap-t).
 *
 *   8. Diagnostics emitted per source:
 *
 *       - `slope`            the Deming point slope (full-data fit)
 *       - `seFull`           full-data jackknife SE used for the pivot
 *       - `tLower`, `tUpper` empirical t-quantiles of `T*`
 *       - `ciLower`, `ciUpper` pivotal-t CI endpoints in tokens/row
 *       - `ciWidth`          `ciUpper - ciLower`
 *       - `ciContainsZero`   `ciLower <= 0 && ciUpper >= 0`
 *       - `degenerateSeReplicates` count of bootstrap replicates whose
 *                            inner jackknife SE was 0 (constant
 *                            resample). High counts (e.g. > B/4) make
 *                            the bootstrap-t CI unreliable.
 *       - `tSkewSignal`      `(tUpper + tLower) / (tUpper - tLower)`,
 *                            in [-1, +1]; symmetric T* gives 0,
 *                            right-skewed T* (long upper tail) gives
 *                            > 0, left-skewed gives < 0. Captures the
 *                            asymmetry the pivotal CI is preserving.
 *
 * Mechanical sibling-summary:
 *
 *   - vs **percentile** (v0.6.220): different statistic ranked
 *     (T* vs theta*), different CI assembly (pivotal back-transform
 *     vs raw quantiles).
 *   - vs **jackknife** (v0.6.221): same SE_full, but t-quantiles
 *     replace the normal `+/- z`, which corrects coverage for skewed
 *     sampling distributions.
 *   - vs **BCa** (v0.6.222): both are second-order accurate. BCa
 *     adjusts the percentile picks of slope replicates; bootstrap-t
 *     pivots on a studentized statistic that explicitly carries
 *     resample variance. They generally disagree on small-n skewed
 *     distributions.
 *
 * Determinism: bootstrap is driven by a **seeded LCG** (Numerical
 * Recipes 32-bit constants `a=1664525, c=1013904223, m=2^32`);
 * jackknife is purely deterministic. Pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 *
 * Edge cases:
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: every bootstrap and jackknife slope is 0,
 *     `SE_full = 0`, every `SE*_b = 0` -> all `T*_b = 0` ->
 *     `tLower = tUpper = 0`, `ciLower = ciUpper = thetaHat = 0`,
 *     `ciContainsZero = true`, `degenerateSeReplicates = B`.
 *   - **`SE*_b == 0` for some replicates**: `T*_b` set to 0 for those
 *     replicates and counted in `degenerateSeReplicates`.
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
 *   7. Compute thetaHat, SE_full, B bootstrap T* values.
 *   8. Compute tLo, tHi, ciLower, ciUpper, diagnostics.
 *   9. Apply display gates: `--alert-zero-in-ci`,
 *      `--alert-degenerate-se-min` (filter to only sources whose
 *      `degenerateSeReplicates` is at least the threshold — surfaces
 *      sources where bootstrap-t was unreliable).
 *  10. Sort, then optionally cap with `--top`.
 */
import type { QueueLine } from './types.js';
import { demingSlope } from './sourcerowtokendemingslope.js';
import { jackknifeLeaveOneOutSlopes } from './sourcerowtokenjackknifeslopeci.js';
import {
  makeLcg,
  bootstrapResample,
  bootstrapDemingSlope,
  percentileSorted,
} from './sourcerowtokenbootstrapslopeci.js';

export interface SourceRowTokenStudentizedBootstrapSlopeCiOptions {
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
   * Refinement filter: only emit sources whose `degenerateSeReplicates`
   * is at least the threshold. `0` (default) keeps all sources.
   * Useful for surfacing sources where the bootstrap-t pivot was
   * unreliable due to constant inner resamples.
   */
  alertDegenerateSeMin?: number;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'se-full-desc'
    | 't-skew-magnitude-desc'
    | 'degenerate-se-desc'
    | 'ci-contains-zero-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenStudentizedBootstrapSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming point slope on the full data, in tokens / row. */
  slope: number;
  /** Full-data jackknife standard error used for the pivot. */
  seFull: number;
  /** Empirical lower t-quantile of T*. */
  tLower: number;
  /** Empirical upper t-quantile of T*. */
  tUpper: number;
  /** Pivotal-t CI lower endpoint in tokens / row. */
  ciLower: number;
  /** Pivotal-t CI upper endpoint in tokens / row. */
  ciUpper: number;
  /** `ciUpper - ciLower`. */
  ciWidth: number;
  /** True iff `ciLower <= 0 && ciUpper >= 0`. */
  ciContainsZero: boolean;
  /**
   * Count of bootstrap replicates whose inner jackknife SE was 0 (a
   * constant resample). Those replicates contributed `T*_b = 0`,
   * which biases the bootstrap-t toward narrower intervals. High
   * counts (e.g. > B/4) make the CI unreliable.
   */
  degenerateSeReplicates: number;
  /**
   * `(tUpper + tLower) / (tUpper - tLower)` in `[-1, +1]` (or NaN
   * if `tUpper == tLower`): the bootstrap-t skew signal. Symmetric
   * T* gives 0; right-skewed T* gives > 0; left-skewed gives < 0.
   * This is the asymmetry the pivotal-t CI is explicitly preserving
   * vs the symmetric `+/- z` of v0.6.221.
   */
  tSkewSignal: number;
}

export interface SourceRowTokenStudentizedBootstrapSlopeCiReport {
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
  alertDegenerateSeMin: number;
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'se-full-desc'
    | 't-skew-magnitude-desc'
    | 'degenerate-se-desc'
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
  droppedBelowDegenerateSe: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenStudentizedBootstrapSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const MIN_BOOTSTRAPS = 100;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'se-full-desc',
  't-skew-magnitude-desc',
  'degenerate-se-desc',
  'ci-contains-zero-first',
  'rows',
  'source',
] as const;

/**
 * Jackknife standard error for the Deming slope on a series `xs`,
 * matching v0.6.221's convention:
 *
 *     SE^2 = ((n-1)/n) * sum_i (theta_(-i) - jackMean)^2
 *
 * Returns 0 if all `theta_(-i)` are equal (degenerate jackknife).
 */
export function jackknifeSlopeSe(xs: number[], lambda: number): number {
  const n = xs.length;
  if (n < 2) return 0;
  const reps = jackknifeLeaveOneOutSlopes(xs, lambda);
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += reps[i]!;
  mean /= n;
  let sq = 0;
  for (let i = 0; i < n; i += 1) {
    const d = reps[i]! - mean;
    sq += d * d;
  }
  if (sq === 0) return 0;
  const variance = ((n - 1) / n) * sq;
  if (!Number.isFinite(variance) || variance < 0) return 0;
  return Math.sqrt(variance);
}

/**
 * Pivotal-t CI endpoints from the empirical t-quantiles. Note the
 * cross-tail flip:
 *
 *     ciLower = thetaHat - tHi * seFull
 *     ciUpper = thetaHat - tLo * seFull
 *
 * If `seFull == 0` returns `[thetaHat, thetaHat]`.
 */
export function pivotalTCi(
  thetaHat: number,
  seFull: number,
  tLo: number,
  tHi: number,
): [number, number] {
  if (seFull === 0) return [thetaHat, thetaHat];
  return [thetaHat - tHi * seFull, thetaHat - tLo * seFull];
}

/**
 * Bootstrap-t skew signal: `(tHi + tLo) / (tHi - tLo)` clamped to
 * `[-1, +1]`. Returns NaN if `tHi == tLo`.
 */
export function bootstrapTSkewSignal(tLo: number, tHi: number): number {
  const denom = tHi - tLo;
  if (denom === 0 || !Number.isFinite(denom)) return NaN;
  let s = (tHi + tLo) / denom;
  if (!Number.isFinite(s)) return NaN;
  if (s > 1) s = 1;
  if (s < -1) s = -1;
  return s;
}

export function buildSourceRowTokenStudentizedBootstrapSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenStudentizedBootstrapSlopeCiOptions = {},
): SourceRowTokenStudentizedBootstrapSlopeCiReport {
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
  const alertDegenerateSeMin = opts.alertDegenerateSeMin ?? 0;
  if (
    !Number.isInteger(alertDegenerateSeMin) ||
    alertDegenerateSeMin < 0
  ) {
    throw new Error(
      `alertDegenerateSeMin must be a non-negative integer (got ${opts.alertDegenerateSeMin})`,
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
  const allRows: SourceRowTokenStudentizedBootstrapSlopeCiRow[] = [];
  let droppedBelowMinRows = 0;

  // Sort source keys for deterministic LCG advancement order.
  const sourceKeys = Array.from(perSource.keys()).sort();
  const rng = makeLcg(seed);

  const tNomLo = (1 - confidence) / 2;
  const tNomHi = (1 + confidence) / 2;

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

    const seFull = jackknifeSlopeSe(xs, lambda);

    // Bootstrap loop: per resample, compute slope AND its inner
    // jackknife SE. T*_b = (theta*_b - thetaHat) / SE*_b.
    const tStars = new Array<number>(bootstraps);
    let degenerateSeReplicates = 0;
    for (let b = 0; b < bootstraps; b += 1) {
      const resampled = bootstrapResample(xs, rng);
      const slopeStar = bootstrapDemingSlope(resampled, lambda);
      const seStar = jackknifeSlopeSe(resampled, lambda);
      if (seStar === 0 || !Number.isFinite(seStar)) {
        tStars[b] = 0;
        degenerateSeReplicates += 1;
      } else {
        const t = (slopeStar - pointSlope) / seStar;
        tStars[b] = Number.isFinite(t) ? t : 0;
      }
    }
    const sortedT = tStars.slice().sort((p, q) => p - q);
    const tLower = percentileSorted(sortedT, tNomLo);
    const tUpper = percentileSorted(sortedT, tNomHi);

    const [ciLower, ciUpper] = pivotalTCi(pointSlope, seFull, tLower, tUpper);
    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;
    const tSkewSignal = bootstrapTSkewSignal(tLower, tUpper);

    allRows.push({
      source,
      rowsKept: n,
      slope: pointSlope,
      seFull,
      tLower,
      tUpper,
      ciLower,
      ciUpper,
      ciWidth,
      ciContainsZero,
      degenerateSeReplicates,
      tSkewSignal,
    });
  }

  let droppedNotZeroInCi = 0;
  let droppedBelowDegenerateSe = 0;
  const survived: SourceRowTokenStudentizedBootstrapSlopeCiRow[] = [];
  for (const row of allRows) {
    if (alertZeroInCi && !row.ciContainsZero) {
      droppedNotZeroInCi += 1;
      continue;
    }
    if (row.degenerateSeReplicates < alertDegenerateSeMin) {
      droppedBelowDegenerateSe += 1;
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
    else if (sort === 'se-full-desc') primary = q.seFull - p.seFull;
    else if (sort === 't-skew-magnitude-desc') {
      const qv = Number.isFinite(q.tSkewSignal) ? Math.abs(q.tSkewSignal) : -1;
      const pv = Number.isFinite(p.tSkewSignal) ? Math.abs(p.tSkewSignal) : -1;
      primary = qv - pv;
    } else if (sort === 'degenerate-se-desc')
      primary = q.degenerateSeReplicates - p.degenerateSeReplicates;
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
    bootstraps,
    confidence,
    lambda,
    seed,
    alertZeroInCi,
    alertDegenerateSeMin,
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
    droppedBelowDegenerateSe,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
