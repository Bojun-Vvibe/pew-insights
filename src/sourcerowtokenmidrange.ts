/**
 * source-row-token-mid-range: per-source **mid-range**
 * MR = (min + max) / 2 of `total_tokens` across the source's
 * queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_1, ..., x_n`, the mid-range is the arithmetic
 * mean of the two order statistics x_(1) and x_(n):
 *
 *     MR = (min(x) + max(x)) / 2
 *
 * Headline question: **for each source, what is the midpoint
 * of the per-row token range — the location halfway between
 * the smallest and largest observed row, in the same units
 * as `total_tokens`?**
 *
 * Properties.
 *
 *   - **Extreme L-estimator** (linear combination of order
 *     statistics) using only the two tail order statistics.
 *     Formally, the **MVUE for the location parameter of a
 *     symmetric uniform distribution** (Pitman 1939); on
 *     symmetric uniforms the mid-range is more efficient
 *     than the sample mean.
 *   - **Breakdown 0 %**: a single arbitrarily-large row moves
 *     MR by exactly half its excess over the previous max.
 *     This is the *opposite* end of the L-estimator robustness
 *     spectrum from the median (50 % breakdown), the trimean /
 *     midhinge (25 % breakdown), and even the mean (which
 *     averages over all `n` rows and so has 0 % breakdown but
 *     dilutes single-point pull by `1/n`). MR concentrates
 *     all sensitivity on the two tails — making it the
 *     **canonical "where do the extremes sit?" central-
 *     tendency lens**.
 *   - **Translation- and scale-equivariant**: shifting every
 *     row by `c` shifts MR by `c`; rescaling by `c > 0`
 *     rescales MR by `c`. (The midhinge and trimean share
 *     this property; CQD / Bowley do not — those are
 *     scale-invariant shape statistics.)
 *   - **Order-invariant**: MR depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c`, then min = max = c so MR = c. (Same as mean,
 *     median, midhinge, trimean.)
 *   - **Lies in `[min, max]`** (exact midpoint of the support
 *     interval): MR = min + (max - min)/2 = max - (max - min)/2.
 *     For non-negative data, MR >= 0; in particular MR >= min,
 *     so any source with min == 0 has MR == max/2.
 *   - **Insensitive to inner shape**: two distributions sharing
 *     min and max but with arbitrarily different medians,
 *     IQRs, midhinges, or trimeans have **identical mid-ranges**.
 *     The signed gap `mrMedianGap = mid_range - median`
 *     reveals where the median sits inside the full range —
 *     positive means the median is in the lower half of
 *     `[min, max]` (long upper tail), negative means the
 *     median is in the upper half (long lower tail), zero
 *     means the median is the exact range midpoint.
 *     Bounded by `[-(max-min)/2, +(max-min)/2]`.
 *   - **Always finite for any non-empty series**: no division,
 *     never undefined.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - **Distinct from midhinge** (the closest sibling, but
 *     opposite robustness): midhinge = (q1 + q3)/2 ignores
 *     the bottom 25 % and top 25 % of rows entirely;
 *     mid-range = (min + max)/2 listens to *only* the bottom
 *     0.0001/n and top 0.0001/n. Two sources with identical
 *     IQR centers can have wildly different mid-ranges if
 *     one has a huge max. Compare to midhinge:
 *     mid-range > midhinge whenever the tails are heavier
 *     than the central half (positive overall skew once you
 *     include the extremes); mid-range < midhinge whenever
 *     the tails are lighter (rare for token usage).
 *   - **Distinct from trimean**: trimean = (q1 + 2*median + q3)/4
 *     blends three central quantiles; mid-range uses zero
 *     central quantiles. Trimean and mid-range agree only on
 *     distributions where `min + max == q1 + 2*median + q3`
 *     scaled — basically symmetric uniform-like data.
 *   - **Distinct from the median**: median has 50 % breakdown;
 *     mid-range has 0 %. They equal each other only on
 *     distributions whose median is exactly the midpoint of
 *     `[min, max]`.
 *   - **Distinct from the mean**: mean weights every row 1/n;
 *     mid-range weights min and max each 1/2 and every other
 *     row 0. On a symmetric uniform sample, mid-range is the
 *     UMVUE of the center and outperforms the mean; on
 *     heavy-tailed data the mean is unbiased but sensitive,
 *     and the mid-range is degenerate (it just chases the
 *     largest observation).
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     all *shape* statistics built from q1/q3 (and median for
 *     Bowley); they ignore the tails entirely. Mid-range is
 *     *location* in token units, dominated by the tails.
 *   - **Distinct from MAD / coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those are
 *     all spread or shape statistics, not central tendency.
 *   - **Distinct from source-output-tokens-per-row-percentiles**:
 *     that command exposes the raw `P50/P75/P90/P99` of
 *     `output_tokens` (different field), without combining
 *     them, and never reports the absolute min or max.
 *
 * The free byproduct `range = max - min` is reported alongside
 * MR — it's not a separate lens (no `source-row-token-range`
 * exists), it's just the natural denominator of `mrMedianGap`
 * and the obvious sanity check on MR.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 2 — need at
 *      least one min and one max; the mid-range is degenerate
 *      but well-defined at n=1, but two-point support is the
 *      smallest meaningful case for a "range midpoint" lens).
 *   7. Single linear scan to find min, max, and median (the
 *      median uses the type-7 quantile of the sorted samples).
 *      Compute `mid_range = (min + max) / 2`,
 *      `range = max - min`, `mrMedianGap = mid_range - median`.
 *   8. Apply display gates:
 *      - `--min-rows`      (absolute floor 2)            -> droppedBelowMinRows.
 *      - `--min-mid-range` (cohort: only sources with
 *                           meaningful range-center
 *                           magnitude; finite, non-negative)
 *                                                        -> droppedBelowMinMidRange.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c): min = max = c;
 *     mid_range = c; range = 0; mrMedianGap = 0.
 *   - All-zero series: min = max = 0; mid_range = 0; range = 0;
 *     mrMedianGap = 0. (No degeneracy — operator can spot
 *     all-zero sources by `mid_range == 0` paired with
 *     `range == 0`.)
 *   - Single huge row dominates: min = small, max = huge,
 *     mid_range ~= max/2; mrMedianGap is large positive
 *     (median far below the extremes). This is the diagnostic
 *     signal of a single-row tail anomaly.
 *   - Negative total_tokens: dropped (same convention as
 *     midhinge / trimean / iqr-ratio / bowley / cqd lenses).
 *   - n=2: min = x_1, max = x_2 (or vice versa); median is
 *     also (x_1 + x_2)/2 by type-7 convention, so
 *     mid_range == median and mrMedianGap == 0 by
 *     construction. (Pinned in the property tests.)
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMidRangeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 2 (need at least one min and one max).
   * Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose mid-range is strictly below this value.
   * Cohort selector for "this source actually carries non-trivial
   * range-center token magnitude" — useful to hide low-volume
   * noise sources before ranking. Must be a finite, non-negative
   * number. Default 0.
   */
  minMidRange?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'mid-range-desc' (default): mid-range desc (largest range-center magnitude first).
   *   - 'mid-range-asc':            mid-range asc.
   *   - 'median-desc':              median desc (compare with mid-range ranking).
   *   - 'gap-desc':                 |mrMedianGap| desc (median furthest from range center first).
   *   - 'range-desc':               (max - min) desc (widest support intervals first).
   *   - 'rows':                     rowsKept desc.
   *   - 'source':                   source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'mid-range-desc'
    | 'mid-range-asc'
    | 'median-desc'
    | 'gap-desc'
    | 'range-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenMidRangeRow {
  source: string;
  rowsKept: number;
  min: number;
  median: number;
  max: number;
  /** Sample range (max - min). Non-negative; 0 iff all rows equal. */
  range: number;
  /** Mid-range (min + max) / 2. */
  midRange: number;
  /**
   * Signed gap mid_range - median. Positive means the median
   * sits in the lower half of [min, max] (upper tail longer);
   * negative means the median sits in the upper half (lower
   * tail longer); zero on any range-symmetric distribution.
   * Bounded by [-(max-min)/2, +(max-min)/2].
   */
  mrMedianGap: number;
}

export interface SourceRowTokenMidRangeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMidRange: number;
  top: number | null;
  sort:
    | 'mid-range-desc'
    | 'mid-range-asc'
    | 'median-desc'
    | 'gap-desc'
    | 'range-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinMidRange: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMidRangeRow[];
}

const ABSOLUTE_MIN_ROWS = 2;

const VALID_SORTS = [
  'mid-range-desc',
  'mid-range-asc',
  'median-desc',
  'gap-desc',
  'range-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation (type-7) quantile of an already-sorted
 * ascending array `xs`. `p` in `[0, 1]`. Matches numpy.quantile's
 * default and R's `quantile(..., type = 7)`.
 */
function quantileType7(xs: number[], p: number): number {
  const n = xs.length;
  if (n === 0) throw new Error('quantileType7: empty input');
  if (n === 1) return xs[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return xs[lo]!;
  return xs[lo]! + (h - lo) * (xs[hi]! - xs[lo]!);
}

export function buildSourceRowTokenMidRange(
  queue: QueueLine[],
  opts: SourceRowTokenMidRangeOptions = {},
): SourceRowTokenMidRangeReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minMidRange = opts.minMidRange ?? 0;
  if (!Number.isFinite(minMidRange) || minMidRange < 0) {
    throw new Error(
      `minMidRange must be a finite, non-negative number (got ${opts.minMidRange})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'mid-range-desc';
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
  const allRows: SourceRowTokenMidRangeRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const min = sorted[0]!;
    const max = sorted[n - 1]!;
    const median = quantileType7(sorted, 0.5);
    const range = max - min;
    const midRange = (min + max) / 2;
    const mrMedianGap = midRange - median;

    allRows.push({
      source,
      rowsKept: n,
      min,
      median,
      max,
      range,
      midRange,
      mrMedianGap,
    });
  }

  let droppedBelowMinMidRange = 0;
  const survived: SourceRowTokenMidRangeRow[] = [];
  for (const row of allRows) {
    if (minMidRange > 0 && row.midRange < minMidRange) {
      droppedBelowMinMidRange += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'mid-range-desc') primary = b.midRange - a.midRange;
    else if (sort === 'mid-range-asc') primary = a.midRange - b.midRange;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.mrMedianGap) - Math.abs(a.mrMedianGap);
    else if (sort === 'range-desc') primary = b.range - a.range;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    minMidRange,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinMidRange,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
