/**
 * source-row-token-bootstrap-slope-ci: per-source **non-parametric
 * bootstrap percentile confidence interval** for the Deming
 * regression slope of per-row `total_tokens` against row index, in
 * tokens / row.
 *
 * Headline question: **for each source, how uncertain is the Deming
 * slope** — i.e. given the data we actually have, what is the
 * percentile bootstrap confidence interval for the per-row trend in
 * token magnitude?
 *
 * Mechanical class — **non-parametric percentile bootstrap CI**
 * around the v0.6.219 Deming point estimator. This is the first
 * **uncertainty-quantification** lens in the slope suite. Every
 * prior slope lens (Theil-Sen, Siegel, Cauchy/Tukey M-estimators
 * for location, Passing-Bablok, Deming, OLS, naive endpoint, etc.)
 * is a **point estimator**. This lens reports the *spread* of the
 * point estimator across resamples, plus a percentile CI:
 *
 *   1. For each source: collect its `n` chronologically ordered
 *      `(i, total_tokens)` pairs.
 *   2. Compute the point Deming slope on the full data (the
 *      v0.6.219 estimator at the supplied `--lambda`).
 *   3. Run `B = --bootstraps` non-parametric resamples (resample
 *      `n` indices with replacement from `0..n-1`, take the
 *      corresponding `(idx_k, x_k)` pairs in their resampled order
 *      — i.e. relabel resample positions `0..n-1` as the new x
 *      axis), re-fit Deming on each.
 *   4. Sort the `B` resample slopes ascending; report:
 *      - `slope`         the point Deming slope (full-data fit)
 *      - `bootMean`      mean of the `B` resample slopes
 *      - `bootStd`       sample std (n-1) of the `B` resample
 *                        slopes
 *      - `ciLower`       `(1 - confidence)/2` percentile
 *      - `ciUpper`       `(1 + confidence)/2` percentile
 *      - `confidence`    the requested confidence level (default
 *                        0.95)
 *      - `bootstraps`    `B` (echo)
 *
 * Mechanically distinct from every previously shipped lens:
 *
 *   - vs **source-row-token-deming-slope** (v0.6.219): same point
 *     estimator at the heart, but adds the *bootstrap CI* lens —
 *     this is the first lens that says "the slope is X with a 95%
 *     CI of [L, U]" rather than just "the slope is X".
 *   - vs **Passing-Bablok / Theil-Sen / Siegel / OLS slope lenses**:
 *     all point estimators with no uncertainty quantification.
 *   - vs **Mann-Kendall** (v0.6.211): MK reports a *p-value* of
 *     monotone trend (does the slope differ from zero in a rank
 *     sense?). This lens reports a *confidence interval* for the
 *     slope itself in tokens / row.
 *
 * Determinism: the bootstrap is driven by a **seeded LCG**
 * (Numerical Recipes constants `a=1664525, c=1013904223,
 * m=2^32`), so results are reproducible under the same `--seed`
 * (default 42). Pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 *
 * Edge cases:
 *
 *   - **n < 4 rows**: skipped via `--min-rows`.
 *   - **All x_i equal**: every resample's Deming slope is 0; the
 *     CI is `[0, 0]` and `bootStd = 0`.
 *   - **Resample with `s_xy == 0`**: the inner `demingSlopeFromSums`
 *     returns 0 for that resample (no linear EIV trend at any
 *     lambda); folded into the bootstrap distribution as a 0.
 *   - **`--bootstraps < 100`**: rejected at option-validation time.
 *   - **`--confidence` not in (0, 1)**: rejected.
 *   - **`--lambda <= 0`**: rejected.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group rows by source, sort per-source by `hour_start` asc
 *      (tiebreak input order).
 *   6. Per source: skip if `n < minRows` (default 4).
 *   7. Compute the full-data Deming slope.
 *   8. Run `B` bootstrap resamples with seeded LCG; compute Deming
 *      on each.
 *   9. Compute `bootMean`, `bootStd`, `ciLower`, `ciUpper` (linear
 *      interpolation between adjacent ranks for the percentiles).
 *  10. Apply display gates: `--min-rows`, `--alert-zero-in-ci`
 *      (filter to only sources whose CI straddles zero — added in
 *      v0.6.220 refinement).
 *  11. Sort, then optionally cap with `--top`.
 */
import type { QueueLine } from './types.js';
import {
  demingSlope,
  demingSlopeFromSums,
} from './sourcerowtokendemingslope.js';

export interface SourceRowTokenBootstrapSlopeCiOptions {
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
   * If true, only emit sources whose CI strictly contains zero
   * (i.e. `ciLower <= 0 && ciUpper >= 0`). Default false.
   * (Refinement field, v0.6.220.)
   */
  alertZeroInCi?: boolean;
  top?: number | null;
  sort?:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'boot-std-desc'
    | 'ci-contains-zero-first'
    | 'boot-skew-magnitude-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenBootstrapSlopeCiRow {
  source: string;
  rowsKept: number;
  /** Deming point slope on the full data, in tokens / row. */
  slope: number;
  /** Mean of the `bootstraps` resample slopes. */
  bootMean: number;
  /** Sample std (n-1) of the resample slopes. */
  bootStd: number;
  /**
   * Median of the `bootstraps` resample slopes (50th percentile).
   * (Refinement field, v0.6.220 follow-up.)
   */
  bootMedian: number;
  /**
   * `bootMean - bootMedian` — a non-parametric skewness diagnostic
   * for the bootstrap distribution of the Deming slope. Positive =
   * mean above median (right-skewed; the bootstrap distribution has
   * a heavy upper tail); negative = left-skewed. Useful for spotting
   * sources where a percentile CI is misleading because the
   * resampling distribution is asymmetric. (Refinement field,
   * v0.6.220 follow-up.)
   */
  bootSkewMeanMinusMedian: number;
  /** Lower percentile of resample slopes at the requested confidence. */
  ciLower: number;
  /** Upper percentile of resample slopes at the requested confidence. */
  ciUpper: number;
  /** `ciUpper - ciLower`. (Refinement field, v0.6.220.) */
  ciWidth: number;
  /**
   * True iff `ciLower <= 0 && ciUpper >= 0` — the slope is **not**
   * statistically distinguishable from zero at the requested
   * confidence under the bootstrap. (Refinement field, v0.6.220.)
   */
  ciContainsZero: boolean;
}

export interface SourceRowTokenBootstrapSlopeCiReport {
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
  top: number | null;
  sort:
    | 'magnitude-desc'
    | 'slope-desc'
    | 'slope-asc'
    | 'ci-width-desc'
    | 'ci-width-asc'
    | 'boot-std-desc'
    | 'ci-contains-zero-first'
    | 'boot-skew-magnitude-desc'
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
  sources: SourceRowTokenBootstrapSlopeCiRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const MIN_BOOTSTRAPS = 100;

const VALID_SORTS = [
  'magnitude-desc',
  'slope-desc',
  'slope-asc',
  'ci-width-desc',
  'ci-width-asc',
  'boot-std-desc',
  'ci-contains-zero-first',
  'boot-skew-magnitude-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation percentile of a *sorted-ascending* array.
 * `p` in [0, 1]. Returns NaN on empty input.
 */
export function percentileSorted(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0]!;
  if (p <= 0) return sortedAsc[0]!;
  if (p >= 1) return sortedAsc[n - 1]!;
  const h = p * (n - 1);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = h - lo;
  return sortedAsc[lo]! * (1 - frac) + sortedAsc[hi]! * frac;
}

/**
 * Numerical Recipes 32-bit LCG. Returns a function that yields
 * uniform [0, 1) doubles.
 */
export function makeLcg(seed: number): () => number {
  // Force into uint32. Allow negative seeds.
  let state = (seed >>> 0) === 0 ? 1 : seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * One bootstrap resample: pick `n` indices with replacement from
 * `0..n-1` using the supplied uniform RNG. Returns the resampled
 * x array (preserving sample length).
 */
export function bootstrapResample<T>(xs: readonly T[], rng: () => number): T[] {
  const n = xs.length;
  const out = new Array<T>(n);
  for (let i = 0; i < n; i += 1) {
    const k = Math.floor(rng() * n);
    out[i] = xs[k < n ? k : n - 1]!;
  }
  return out;
}

/**
 * Compute the Deming slope on a resampled series. Uses the same
 * formula as `demingSlope` but is robust to all-equal resamples
 * (returns 0 for `s_xy == 0`) and to `s_xx == 0` (single distinct
 * x; returns 0).
 */
export function bootstrapDemingSlope(xs: number[], lambda: number): number {
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

export function buildSourceRowTokenBootstrapSlopeCi(
  queue: QueueLine[],
  opts: SourceRowTokenBootstrapSlopeCiOptions = {},
): SourceRowTokenBootstrapSlopeCiReport {
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
  const allRows: SourceRowTokenBootstrapSlopeCiRow[] = [];
  let droppedBelowMinRows = 0;

  // Sort source keys for deterministic LCG advancement order.
  const sourceKeys = Array.from(perSource.keys()).sort();
  const rng = makeLcg(seed);

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

    const slopes = new Array<number>(bootstraps);
    for (let b = 0; b < bootstraps; b += 1) {
      const resampled = bootstrapResample(xs, rng);
      slopes[b] = bootstrapDemingSlope(resampled, lambda);
    }

    let sum = 0;
    for (let b = 0; b < bootstraps; b += 1) sum += slopes[b]!;
    const bootMean = sum / bootstraps;
    let sqsum = 0;
    for (let b = 0; b < bootstraps; b += 1) {
      const d = slopes[b]! - bootMean;
      sqsum += d * d;
    }
    const bootStd = bootstraps > 1 ? Math.sqrt(sqsum / (bootstraps - 1)) : 0;

    const sorted = slopes.slice().sort((p, q) => p - q);
    const lo = (1 - confidence) / 2;
    const hi = 1 - lo;
    const ciLower = percentileSorted(sorted, lo);
    const ciUpper = percentileSorted(sorted, hi);
    const ciWidth = ciUpper - ciLower;
    const ciContainsZero = ciLower <= 0 && ciUpper >= 0;
    const bootMedian = percentileSorted(sorted, 0.5);
    const bootSkewMeanMinusMedian = bootMean - bootMedian;

    allRows.push({
      source,
      rowsKept: n,
      slope: pointSlope,
      bootMean,
      bootStd,
      bootMedian,
      bootSkewMeanMinusMedian,
      ciLower,
      ciUpper,
      ciWidth,
      ciContainsZero,
    });
  }

  let droppedNotZeroInCi = 0;
  const survived: SourceRowTokenBootstrapSlopeCiRow[] = [];
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
    else if (sort === 'boot-std-desc') primary = q.bootStd - p.bootStd;
    else if (sort === 'ci-contains-zero-first')
      primary = (q.ciContainsZero ? 1 : 0) - (p.ciContainsZero ? 1 : 0);
    else if (sort === 'boot-skew-magnitude-desc')
      primary =
        Math.abs(q.bootSkewMeanMinusMedian) -
        Math.abs(p.bootSkewMeanMinusMedian);
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
