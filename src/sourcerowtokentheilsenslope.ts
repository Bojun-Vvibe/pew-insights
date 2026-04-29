/**
 * source-row-token-theil-sen-slope: per-source **Theil-Sen median
 * pairwise slope** of per-row `total_tokens` against row index, over
 * the source's chronological queue rows.
 *
 * Definition. Given the source's `n` rows in chronological order
 * `(t_i, x_i)` with `t_i = i` (0-based row index over the source's
 * own active row sequence) and `x_i = total_tokens`, the
 * Theil-Sen estimator of the slope is
 *
 *     slope = median_{i < j} ( (x_j - x_i) / (t_j - t_i) )
 *
 * with the associated (median-based) intercept
 *
 *     intercept = median_i ( x_i - slope * t_i )
 *
 * Headline question: **for each source, what is the robust per-row
 * trend in token magnitude — does the source's per-row token usage
 * drift up, down, or sit flat, in a way that a handful of outlier
 * rows cannot dominate?**
 *
 * Mechanical class — **R-estimator (rank/order based, pairwise
 * slope median)**. Mechanically distinct from every previously
 * shipped lens in the suite:
 *
 *   - **vs source-daily-token-trend-slope (OLS)**: that lens fits
 *     ordinary least squares on **daily aggregates** (one point
 *     per active calendar day) and minimizes squared residuals,
 *     so a single anomalously big day can swing the slope by an
 *     arbitrary amount. Theil-Sen here works on the **raw per-row
 *     stream** (no daily aggregation; the natural unit of the
 *     queue) and takes the **median of pairwise slopes** —
 *     breakdown ~29.3 % vs OLS's 0 %.
 *   - **vs the M-estimator family (Huber/Tukey/Hampel/Andrews/
 *     Welsch — v0.6.209-v0.6.213)**: those are **location**
 *     estimators (one number per source: a robust mean) computed
 *     by IRLS on residuals from a single center. Theil-Sen is a
 *     **trend / slope** estimator computed by enumerating C(n,2)
 *     pairwise slopes and taking their median. No IRLS, no
 *     residual loop, no tuning constant, no scale parameter.
 *   - **vs source-row-token-mann-kendall-trend**: Mann-Kendall
 *     reports a **rank-correlation tau and a sign-test p-value**
 *     of monotone trend; it tells you *whether* there is a trend
 *     and how confident, but **not the magnitude in
 *     tokens-per-row**. Theil-Sen gives the **point estimate of
 *     the slope itself** in `tokens / row`. They are paired
 *     methods — Mann-Kendall is the test, Theil-Sen is the
 *     associated estimator — and shipping both gives a complete
 *     non-parametric trend picture.
 *   - **vs all dispersion lenses (MAD, IQR, gini, CV)**: those are
 *     scale, not location-of-trend.
 *   - **vs all L-estimators (median, trimean, Hodges-Lehmann)**:
 *     those average values, not slopes.
 *
 * This lens is the **first ROBUST PAIRWISE-SLOPE TREND lens** in
 * the suite, the **first PER-ROW (not per-day) trend slope** in
 * the suite, and the **first non-parametric POINT ESTIMATOR**
 * companion to Mann-Kendall's rank-correlation test. Reports a
 * unique three-bucket pair partition keyed on the **sign of each
 * pairwise slope**:
 *
 *   - `pairsPositive`   pairwise slopes strictly > 0 (up pairs)
 *   - `pairsNegative`   pairwise slopes strictly < 0 (down pairs)
 *   - `pairsZero`       pairwise slopes exactly == 0 (tie pairs)
 *
 * with `pairsPositive + pairsNegative + pairsZero = n*(n-1)/2` and
 * `pairsPositive + pairsNegative` is exactly the Mann-Kendall S
 * statistic in absolute terms (sign-resolved), so this lens is a
 * mechanically faithful sibling to the Mann-Kendall lens.
 *
 * Translation- and scale-equivariant in `x`. Fully robust under
 * arbitrary horizontal index shifts. Breakdown point ~0.293 (the
 * famous Theil-Sen breakdown, asymptotic).
 *
 * Edge cases:
 *
 *   - **n < 2 pairs**: skipped via `--min-rows` (absolute floor 4
 *     gives at least C(4,2) = 6 pairs).
 *   - **All x_i equal**: every pairwise slope is exactly 0;
 *     `slope = 0`, `intercept = x_1`, `pairsZero = n*(n-1)/2`.
 *   - **n large**: C(n,2) is O(n^2). For the row-stream of a busy
 *     source this can be tens of millions of pairs; we guard with
 *     `--max-pairs` (default 5_000_000) and skip the source with a
 *     `droppedAbovePairCap` counter rather than letting the
 *     process OOM. The threshold equals roughly n = 3162 rows.
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
 *      `n*(n-1)/2 > maxPairs` -> droppedAbovePairCap.
 *   7. Enumerate the C(n,2) pairwise slopes
 *      `s_{ij} = (x_j - x_i) / (j - i)` for i < j.
 *   8. `slope = median(s_{ij})`,
 *      `intercept = median_i (x_i - slope * i)`.
 *   9. Free byproducts:
 *        - `mean`            arithmetic mean of x
 *        - `median`          ordinary sample median of x
 *        - `firstX`          x_0
 *        - `lastX`           x_{n-1}
 *        - `naiveSlope`      `(x_{n-1} - x_0) / (n - 1)` (endpoint slope)
 *        - `pairsPositive`   pairwise slopes > 0
 *        - `pairsNegative`   pairwise slopes < 0
 *        - `pairsZero`       pairwise slopes == 0
 *        - `pairsTotal`      n*(n-1)/2
 *        - `slopeSign`       'up' | 'down' | 'flat'
 *        - `slopeMagnitude`  |slope|
 *  10. Apply display gates:
 *        - `--min-rows`             (absolute floor 4)        -> droppedBelowMinRows.
 *        - `--min-slope-magnitude`  cohort selector           -> droppedBelowMinSlopeMagnitude.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenTheilSenSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4.
   */
  minRows?: number;
  /**
   * Drop sources whose `|slope|` is strictly below this value.
   * Cohort selector. Must be a finite, non-negative number.
   */
  minSlopeMagnitude?: number;
  /**
   * Skip sources whose pair count `n*(n-1)/2` exceeds this cap, to
   * bound the O(n^2) memory/time of the pairwise enumeration.
   * Must be a positive integer. Default 5_000_000 (~ n = 3162).
   */
  maxPairs?: number;
  top?: number | null;
  sort?:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'positive-desc'
    | 'negative-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenTheilSenSlopeRow {
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
  /** Theil-Sen median pairwise slope, in tokens per row. */
  slope: number;
  /** Median-based intercept `median_i(x_i - slope * i)`. */
  intercept: number;
  /** |slope|. */
  slopeMagnitude: number;
  /** 'up' if slope > 0, 'down' if slope < 0, 'flat' if slope == 0. */
  slopeSign: 'up' | 'down' | 'flat';
  /** Number of pairwise slopes strictly > 0. */
  pairsPositive: number;
  /** Number of pairwise slopes strictly < 0. */
  pairsNegative: number;
  /** Number of pairwise slopes exactly == 0. */
  pairsZero: number;
  /** Total pair count `n*(n-1)/2`. */
  pairsTotal: number;
}

export interface SourceRowTokenTheilSenSlopeReport {
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
  sources: SourceRowTokenTheilSenSlopeRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_MAX_PAIRS = 5_000_000;

const VALID_SORTS = [
  'slope-desc',
  'slope-asc',
  'magnitude-desc',
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
 * Compute the Theil-Sen median pairwise slope and its associated
 * median intercept for a chronologically ordered series `xs`.
 *
 * Returns `{ slope, intercept, pairsPositive, pairsNegative,
 * pairsZero, pairsTotal }`. The index axis is implicit `0..n-1`.
 * Pure function; suitable for unit testing in isolation.
 *
 * Throws if `xs.length < 2`.
 */
export function theilSenSlope(xs: number[]): {
  slope: number;
  intercept: number;
  pairsPositive: number;
  pairsNegative: number;
  pairsZero: number;
  pairsTotal: number;
} {
  const n = xs.length;
  if (n < 2) {
    throw new Error(`theilSenSlope: need at least 2 points (got ${n})`);
  }
  const pairsTotal = (n * (n - 1)) / 2;
  const slopes = new Array<number>(pairsTotal);
  let pairsPositive = 0;
  let pairsNegative = 0;
  let pairsZero = 0;
  let k = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const xi = xs[i]!;
    for (let j = i + 1; j < n; j += 1) {
      const s = (xs[j]! - xi) / (j - i);
      slopes[k] = s;
      k += 1;
      if (s > 0) pairsPositive += 1;
      else if (s < 0) pairsNegative += 1;
      else pairsZero += 1;
    }
  }
  const slope = medianOfArray(slopes);
  // median-based intercept
  const resid = new Array<number>(n);
  for (let i = 0; i < n; i += 1) resid[i] = xs[i]! - slope * i;
  const intercept = medianOfArray(resid);
  return {
    slope,
    intercept,
    pairsPositive,
    pairsNegative,
    pairsZero,
    pairsTotal,
  };
}

export function buildSourceRowTokenTheilSenSlope(
  queue: QueueLine[],
  opts: SourceRowTokenTheilSenSlopeOptions = {},
): SourceRowTokenTheilSenSlopeReport {
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

  /** Per-source list of `{ ms, ord, x }` for chronological ordering. */
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
  const allRows: SourceRowTokenTheilSenSlopeRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAbovePairCap = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    const pairsTotalCheck = (n * (n - 1)) / 2;
    if (pairsTotalCheck > maxPairs) {
      droppedAbovePairCap += 1;
      continue;
    }

    // Sort chronologically; tiebreak by input order.
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

    const {
      slope,
      intercept,
      pairsPositive,
      pairsNegative,
      pairsZero,
      pairsTotal,
    } = theilSenSlope(xs);

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
      pairsPositive,
      pairsNegative,
      pairsZero,
      pairsTotal,
    });
  }

  let droppedBelowMinSlopeMagnitude = 0;
  const survived: SourceRowTokenTheilSenSlopeRow[] = [];
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
    else if (sort === 'positive-desc')
      primary = q.pairsPositive - p.pairsPositive;
    else if (sort === 'negative-desc')
      primary = q.pairsNegative - p.pairsNegative;
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
