/**
 * source-row-token-siegel-slope: per-source **Siegel repeated-medians**
 * slope of per-row `total_tokens` against row index.
 *
 * Definition. Given the source's `n` rows in chronological order
 * `(t_i, x_i)` with `t_i = i` (0-based row index) and `x_i =
 * total_tokens`, the **Siegel repeated-medians** estimator of the
 * slope is computed in **two nested median passes**:
 *
 *   1. Per anchor point `i`, compute the median of all `n - 1`
 *      pairwise slopes through `i`:
 *
 *          m_i = median_{j != i} ( (x_j - x_i) / (j - i) )
 *
 *   2. Take the median of those n per-point medians:
 *
 *          slope = median_i ( m_i )
 *
 * with the associated median-based intercept
 *
 *          intercept = median_i ( x_i - slope * i )
 *
 * Headline question: **for each source, what is the highest-breakdown
 * robust per-row trend in token magnitude — what slope survives even
 * when up to ~50 % of the rows are arbitrary outliers?**
 *
 * Mechanical class — **R-estimator (rank/order based, REPEATED-
 * median nested-median pairwise slope)**. Mechanically distinct
 * from every previously shipped lens in the suite, including its
 * closest sibling Theil-Sen:
 *
 *   - **vs source-row-token-theil-sen-slope (v0.6.214)**: Theil-Sen
 *     takes ONE median over the full cloud of `n*(n-1)/2` pairwise
 *     slopes — every pair is weighted equally. Siegel takes a
 *     **median of medians**: per-anchor inner median (n - 1
 *     slopes) then an outer median over the n anchors. The result
 *     is **breakdown ~50 %** (vs Theil-Sen's ~29.3 %): up to half
 *     of the input points can be arbitrary outliers and the slope
 *     survives. This is the MAXIMAL breakdown for any equivariant
 *     slope estimator. The cost is that pristine pairs no longer
 *     directly outvote outlier pairs by majority — outliers must
 *     also corrupt the *anchor's own inner median* before they can
 *     touch the outer median, which requires roughly half the
 *     other points to be bad relative to that anchor.
 *   - **vs source-daily-token-trend-slope (OLS)**: that lens fits
 *     ordinary least squares on **daily aggregates** (one point
 *     per active calendar day) — breakdown 0 %. Siegel works on
 *     the **raw per-row stream** with breakdown ~50 %.
 *   - **vs the M-estimator family (Huber/Tukey/Hampel/Andrews/
 *     Welsch/Cauchy — v0.6.207-v0.6.215)**: those are **location**
 *     estimators (one number per source: a robust mean) computed
 *     by IRLS on residuals from a single center. Siegel is a
 *     **trend / slope** estimator and uses no IRLS, no tuning
 *     constant, no scale parameter, no weight function.
 *   - **vs source-row-token-mann-kendall-trend**: Mann-Kendall
 *     reports a rank-correlation tau and a p-value of monotone
 *     trend; it tells you *whether* there is a trend, not its
 *     magnitude. Siegel is the **point estimate of the slope
 *     itself** in `tokens / row`, with the highest breakdown of
 *     any slope estimator we ship.
 *   - **vs all dispersion lenses (MAD, IQR, gini, CV)**: those are
 *     scale, not location-of-trend.
 *   - **vs all L-estimators (median, trimean, Hodges-Lehmann)**:
 *     those average values, not slopes.
 *
 * This lens is the **first ~50 % BREAKDOWN slope estimator** in
 * the suite, and the **first NESTED-MEDIAN (median-of-medians)
 * estimator** in the suite — every prior lens uses one median
 * pass, one mean pass, or IRLS, never two stacked medians.
 *
 * Reports a unique **per-anchor median spread** diagnostic:
 *
 *   - `perAnchorMedianMin` smallest of the n inner medians m_i
 *   - `perAnchorMedianMax` largest of the n inner medians m_i
 *   - `perAnchorMedianRange` max - min, a quick measure of how
 *     much the choice of anchor point would have moved a single-
 *     anchor slope estimate. Large range -> the data is
 *     heterogeneous in trend (some anchors see one slope, others
 *     see another); small range -> trend is locally consistent.
 *
 * Translation- and scale-equivariant in `x`. Fully robust under
 * arbitrary horizontal index shifts. Asymptotic breakdown ~0.50.
 *
 * Edge cases:
 *
 *   - **n < 2 pairs**: skipped via `--min-rows` (absolute floor 4).
 *   - **All x_i equal**: every per-anchor median is exactly 0;
 *     `slope = 0`, `intercept = x_1`, `perAnchorMedianRange = 0`.
 *   - **n large**: O(n^2) work for n inner medians of size n - 1.
 *     For the row-stream of a busy source this can be hundreds of
 *     millions of slope evaluations; we guard with `--max-pairs`
 *     (default 5_000_000 over n*(n-1) per-anchor slopes, i.e.
 *     n ~ 2236) and skip the source with a `droppedAbovePairCap`
 *     counter rather than letting the process get hot.
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
 *   6. Per source: skip if `n < minRows` (default 4). Skip if
 *      `n*(n-1) > maxPairs` -> droppedAbovePairCap. (Note: Siegel
 *      enumerates `n*(n-1)` ordered slopes total — `n - 1` inner
 *      slopes for each of the n anchors.)
 *   7. For each anchor i in 0..n-1, compute
 *      `m_i = median_{j != i} (x_j - x_i) / (j - i)`.
 *   8. `slope = median_i(m_i)`,
 *      `intercept = median_i (x_i - slope * i)`.
 *   9. Free byproducts:
 *        - `mean`                arithmetic mean of x
 *        - `median`              ordinary sample median of x
 *        - `firstX`              x_0
 *        - `lastX`               x_{n-1}
 *        - `naiveSlope`          `(x_{n-1} - x_0) / (n - 1)` (endpoint slope)
 *        - `slopeSign`           'up' | 'down' | 'flat'
 *        - `slopeMagnitude`      |slope|
 *        - `perAnchorMedianMin`  min over i of m_i
 *        - `perAnchorMedianMax`  max over i of m_i
 *        - `perAnchorMedianRange` max - min
 *        - `anchorsPositive`     #{i : m_i > 0}
 *        - `anchorsNegative`     #{i : m_i < 0}
 *        - `anchorsZero`         #{i : m_i == 0}
 *  10. Apply display gates:
 *        - `--min-rows`             (absolute floor 4)        -> droppedBelowMinRows.
 *        - `--min-slope-magnitude`  cohort selector           -> droppedBelowMinSlopeMagnitude.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenSiegelSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Drop sources whose `|slope|` is strictly below this value. Finite, non-negative. */
  minSlopeMagnitude?: number;
  /**
   * Skip sources whose ordered slope count `n*(n-1)` exceeds this
   * cap, to bound the O(n^2) work. Positive integer.
   * Default 5_000_000 (~ n = 2236).
   */
  maxPairs?: number;
  top?: number | null;
  sort?:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'range-desc'
    | 'positive-desc'
    | 'negative-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenSiegelSlopeRow {
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
  /** Siegel repeated-medians slope, in tokens per row. */
  slope: number;
  /** Median-based intercept `median_i(x_i - slope * i)`. */
  intercept: number;
  /** |slope|. */
  slopeMagnitude: number;
  /** 'up' if slope > 0, 'down' if slope < 0, 'flat' if slope == 0. */
  slopeSign: 'up' | 'down' | 'flat';
  /** Smallest per-anchor inner median m_i. */
  perAnchorMedianMin: number;
  /** Largest per-anchor inner median m_i. */
  perAnchorMedianMax: number;
  /** Range of per-anchor inner medians (max - min). */
  perAnchorMedianRange: number;
  /** #{i : m_i > 0}. */
  anchorsPositive: number;
  /** #{i : m_i < 0}. */
  anchorsNegative: number;
  /** #{i : m_i == 0}. */
  anchorsZero: number;
  /** Total ordered slope count `n*(n-1)`. */
  pairsTotal: number;
}

export interface SourceRowTokenSiegelSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minSlopeMagnitude: number;
  maxPairs: number;
  top: number | null;
  sort:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'range-desc'
    | 'positive-desc'
    | 'negative-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAbovePairCap: number;
  droppedBelowMinSlopeMagnitude: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSiegelSlopeRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_MAX_PAIRS = 5_000_000;

const VALID_SORTS = [
  'slope-desc',
  'slope-asc',
  'magnitude-desc',
  'range-desc',
  'positive-desc',
  'negative-desc',
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
 * Compute the Siegel repeated-medians slope and its associated
 * median intercept for a chronologically ordered series `xs`.
 *
 * Returns `{ slope, intercept, perAnchorMedians }` plus pair-count
 * diagnostics. The index axis is implicit `0..n-1`. Pure function;
 * suitable for unit testing in isolation.
 *
 * Throws if `xs.length < 2`.
 */
export function siegelSlope(xs: number[]): {
  slope: number;
  intercept: number;
  perAnchorMedians: number[];
  perAnchorMedianMin: number;
  perAnchorMedianMax: number;
  perAnchorMedianRange: number;
  anchorsPositive: number;
  anchorsNegative: number;
  anchorsZero: number;
  pairsTotal: number;
} {
  const n = xs.length;
  if (n < 2) {
    throw new Error(`siegelSlope: need at least 2 points (got ${n})`);
  }
  const perAnchor = new Array<number>(n);
  const innerBuf = new Array<number>(n - 1);
  for (let i = 0; i < n; i += 1) {
    const xi = xs[i]!;
    let k = 0;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      innerBuf[k] = (xs[j]! - xi) / (j - i);
      k += 1;
    }
    perAnchor[i] = medianOfArray(innerBuf);
  }
  const slope = medianOfArray(perAnchor);
  const resid = new Array<number>(n);
  for (let i = 0; i < n; i += 1) resid[i] = xs[i]! - slope * i;
  const intercept = medianOfArray(resid);

  let mn = Number.POSITIVE_INFINITY;
  let mx = Number.NEGATIVE_INFINITY;
  let pos = 0;
  let neg = 0;
  let zer = 0;
  for (let i = 0; i < n; i += 1) {
    const m = perAnchor[i]!;
    if (m < mn) mn = m;
    if (m > mx) mx = m;
    if (m > 0) pos += 1;
    else if (m < 0) neg += 1;
    else zer += 1;
  }

  return {
    slope,
    intercept,
    perAnchorMedians: perAnchor,
    perAnchorMedianMin: mn,
    perAnchorMedianMax: mx,
    perAnchorMedianRange: mx - mn,
    anchorsPositive: pos,
    anchorsNegative: neg,
    anchorsZero: zer,
    pairsTotal: n * (n - 1),
  };
}

export function buildSourceRowTokenSiegelSlope(
  queue: QueueLine[],
  opts: SourceRowTokenSiegelSlopeOptions = {},
): SourceRowTokenSiegelSlopeReport {
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
  const maxPairs = opts.maxPairs ?? DEFAULT_MAX_PAIRS;
  if (!Number.isInteger(maxPairs) || maxPairs < 1) {
    throw new Error(`maxPairs must be a positive integer (got ${opts.maxPairs})`);
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
  const allRows: SourceRowTokenSiegelSlopeRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAbovePairCap = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    const pairsTotalCheck = n * (n - 1);
    if (pairsTotalCheck > maxPairs) {
      droppedAbovePairCap += 1;
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

    const sg = siegelSlope(xs);
    const slope = sg.slope;
    const intercept = sg.intercept;

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
      slope,
      intercept,
      slopeMagnitude,
      slopeSign,
      perAnchorMedianMin: sg.perAnchorMedianMin,
      perAnchorMedianMax: sg.perAnchorMedianMax,
      perAnchorMedianRange: sg.perAnchorMedianRange,
      anchorsPositive: sg.anchorsPositive,
      anchorsNegative: sg.anchorsNegative,
      anchorsZero: sg.anchorsZero,
      pairsTotal: sg.pairsTotal,
    });
  }

  let droppedBelowMinSlopeMagnitude = 0;
  const survived: SourceRowTokenSiegelSlopeRow[] = [];
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
    else if (sort === 'range-desc')
      primary = q.perAnchorMedianRange - p.perAnchorMedianRange;
    else if (sort === 'positive-desc')
      primary = q.anchorsPositive - p.anchorsPositive;
    else if (sort === 'negative-desc')
      primary = q.anchorsNegative - p.anchorsNegative;
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
    maxPairs,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAbovePairCap,
    droppedBelowMinSlopeMagnitude,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
