/**
 * source-row-token-iqr-ratio: per-source robust dispersion of
 * `total_tokens` across the source's queue rows, computed as the
 * **interquartile range divided by the median**:
 *
 *     iqrRatio = (q3 - q1) / median
 *
 * Headline question: **for each source, how spread out is the middle
 * 50 % of per-row token magnitudes relative to the typical row?**
 *
 * Why this lens is genuinely orthogonal to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-coefficient-of-variation` uses the **mean**
 *     and **standard deviation** — both arbitrarily inflated by a
 *     single huge outlier. iqrRatio uses **order statistics** (Q1,
 *     median, Q3) which are bounded by the rank, not the value;
 *     swapping the largest row's token count for `+infinity-ish`
 *     leaves Q1, median, and Q3 unchanged.
 *   - `source-row-token-mad` (median absolute deviation / median) is
 *     also robust, but it measures **average** distance from the
 *     median (using *all* rows, just summarised by a median of
 *     absolute deviations). iqrRatio measures the **width of the
 *     central 50 %** specifically — it deliberately ignores the
 *     bottom 25 % and the top 25 %. Two distributions can share an
 *     identical MAD/median and have wildly different IQR/median
 *     when the tails differ from the central mass shape.
 *   - `source-row-token-gini` is a **concentration / inequality**
 *     index over the whole distribution; it is a Lorenz-curve area,
 *     not a spread relative to the centre. A perfectly symmetric
 *     distribution can have Gini ~ 0.3 (because Gini uses pairwise
 *     differences) and IQR/median = 0.5 simultaneously, and the
 *     ranking of sources under the two metrics need not agree.
 *   - `source-row-token-skewness` and `source-row-token-kurtosis`
 *     are **shape moments** (third / fourth standardised moment)
 *     that say nothing about *width*; a narrow but heavy-tailed
 *     distribution and a wide but flat one can share kurtosis.
 *   - `source-row-token-autocorrelation-lag1` measures **ordering
 *     persistence**, blind to dispersion; shuffling rows leaves
 *     iqrRatio unchanged but zeros out lag-1 autocorrelation.
 *   - `source-output-tokens-per-row-percentiles` reports the raw
 *     percentiles of **output_tokens** (not total_tokens), and
 *     leaves the operator to compute any ratios manually; this lens
 *     emits the single normalised dispersion scalar suitable for
 *     ranking and gating.
 *   - `cost-per-bucket-percentiles` operates on **dollar cost per
 *     hour-bucket**, not per-row token magnitudes.
 *
 * Concretely, for each source:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`).
 *   3. Drop rows with non-finite `total_tokens` (counted in
 *      `droppedInvalidTokens`).
 *   4. Drop rows with **negative** `total_tokens` (counted in
 *      `droppedNegativeTokens`). Negative magnitudes would make the
 *      "ratio of spread to typical magnitude" interpretation
 *      meaningless.
 *   5. Group remaining rows by source.
 *   6. Per source: skip if `n < minRows` (default 4 — need at least
 *      one observation in each of the four "quartile slots" for a
 *      meaningful Q1/Q3).
 *   7. Sort the per-row `total_tokens` ascending and compute Q1,
 *      median (Q2), Q3 using **linear interpolation between closest
 *      ranks** (the "type 7" quantile estimator — the same one used
 *      by NumPy / R's default `quantile()`):
 *
 *        h = (n - 1) * p
 *        lo = floor(h); hi = ceil(h)
 *        q  = x[lo] + (h - lo) * (x[hi] - x[lo])
 *
 *      with `p = 0.25, 0.5, 0.75`.
 *   8. Emit:
 *      - `q1`, `median`, `q3`, `iqr = q3 - q1`.
 *      - `iqrRatio`:
 *          - `iqr / median` when `median > 0`,
 *          - `0`           when `median = 0` AND `iqr = 0`
 *                          (degenerate constant-zero column,
 *                          flagged as `flat: true`),
 *          - `null`        when `median = 0` AND `iqr > 0`
 *                          (more than half the rows are zero but
 *                          a non-trivial top quartile exists; the
 *                          ratio diverges and is reported as
 *                          `null` with `degenerate: true`).
 *      - `flat`: true iff `iqr = 0` (all middle rows equal).
 *      - `degenerate`: true iff `median = 0 && iqr > 0` (ratio
 *        undefined, surfaced separately so it is filterable).
 *   9. Apply display gates `--min-rows`, `--min-iqr-ratio` (cohort
 *      filter on the dispersion scalar; `null` and `flat` rows are
 *      always dropped by a positive `--min-iqr-ratio` because they
 *      have no comparable scalar).
 *  10. Sort + optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - `n < 4`: surfaces as `droppedBelowMinRows`.
 *   - `n = 4`: each percentile lands on a unique sample (h = 0.75,
 *     1.5, 2.25); the linear interpolation is well-defined.
 *   - All-equal series: `q1 = median = q3 = c`; if `c > 0` then
 *     `iqr = 0`, `iqrRatio = 0`, `flat = true`. If `c = 0` then
 *     `iqr = 0`, `iqrRatio = 0`, `flat = true`. Either way the row
 *     is rendered with iqrRatio = 0 and is excluded by any positive
 *     `--min-iqr-ratio` floor.
 *   - Median-zero / non-zero-IQR (sparse-burst pattern: most rows
 *     are 0, occasional huge rows): `iqrRatio = null`,
 *     `degenerate = true`. These are intentionally surfaced rather
 *     than coerced to `+Infinity` so the operator sees the case
 *     explicitly. They never satisfy `--min-iqr-ratio > 0`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenIqrRatioOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows. Display
   * filter only — global denominators reflect the full kept
   * population. Must be >= 4 (need at least one observation per
   * quartile slot for a meaningful Q1/Q3). Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose `iqrRatio` is strictly below this value;
   * cohort selector for sources whose central spread is non-trivial
   * relative to their typical magnitude. Drops `flat: true` and
   * `degenerate: true` sources too (their iqrRatio is 0 / null
   * respectively). Must be a finite, non-negative number. Default 0
   * (no floor).
   *
   * Reserved for the v0.6.98 refinement commit; the v0.6.97
   * implementation already wires the option end-to-end so the
   * refinement is purely additive.
   */
  minIqrRatio?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'iqr-ratio-desc' (default): iqrRatio descending. `null`
   *                                  (degenerate) rows sort last.
   *   - 'iqr-ratio-asc':            iqrRatio ascending. `null`
   *                                  (degenerate) rows sort last.
   *   - 'iqr-desc':                 raw iqr (q3 - q1) descending.
   *   - 'median-desc':              median descending.
   *   - 'rows':                     rowsKept desc.
   *   - 'source':                   source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'iqr-ratio-desc'
    | 'iqr-ratio-asc'
    | 'iqr-desc'
    | 'median-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenIqrRatioRow {
  source: string;
  rowsKept: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  /**
   * `iqr / median`. `null` iff `median = 0 && iqr > 0`
   * (degenerate sparse-burst). `0` iff `iqr = 0` (constant or
   * constant-after-quartile-collapse).
   */
  iqrRatio: number | null;
  flat: boolean;
  degenerate: boolean;
}

export interface SourceRowTokenIqrRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minIqrRatio: number;
  top: number | null;
  sort:
    | 'iqr-ratio-desc'
    | 'iqr-ratio-asc'
    | 'iqr-desc'
    | 'median-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinIqrRatio: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenIqrRatioRow[];
}

const VALID_SORTS = [
  'iqr-ratio-desc',
  'iqr-ratio-asc',
  'iqr-desc',
  'median-desc',
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

export function buildSourceRowTokenIqrRatio(
  queue: QueueLine[],
  opts: SourceRowTokenIqrRatioOptions = {},
): SourceRowTokenIqrRatioReport {
  const minRows = opts.minRows ?? 4;
  if (!Number.isInteger(minRows) || minRows < 4) {
    throw new Error(
      `minRows must be an integer >= 4 (got ${opts.minRows})`,
    );
  }
  const minIqrRatio = opts.minIqrRatio ?? 0;
  if (!Number.isFinite(minIqrRatio) || minIqrRatio < 0) {
    throw new Error(
      `minIqrRatio must be a finite, non-negative number (got ${opts.minIqrRatio})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'iqr-ratio-desc';
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
  const allRows: SourceRowTokenIqrRatioRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const q1 = quantileType7(sorted, 0.25);
    const median = quantileType7(sorted, 0.5);
    const q3 = quantileType7(sorted, 0.75);
    const iqr = q3 - q1;

    let iqrRatio: number | null;
    let flat: boolean;
    let degenerate: boolean;
    if (iqr === 0) {
      iqrRatio = 0;
      flat = true;
      degenerate = false;
    } else if (median === 0) {
      // iqr > 0 but median == 0: > 50 % of rows are 0, and a
      // non-trivial top quartile exists. The ratio diverges; report
      // null + degenerate flag instead of +Infinity.
      iqrRatio = null;
      flat = false;
      degenerate = true;
    } else {
      iqrRatio = iqr / median;
      flat = false;
      degenerate = false;
    }

    allRows.push({
      source,
      rowsKept: n,
      q1,
      median,
      q3,
      iqr,
      iqrRatio,
      flat,
      degenerate,
    });
  }

  let droppedBelowMinIqrRatio = 0;
  let droppedDegenerate = 0;
  const survived: SourceRowTokenIqrRatioRow[] = [];
  for (const row of allRows) {
    if (minIqrRatio > 0) {
      if (row.iqrRatio === null) {
        // Degenerate rows have no comparable scalar; the floor
        // excludes them. Counted under droppedDegenerate (not
        // droppedBelowMinIqrRatio) so the operator sees they were
        // dropped because of *what* they are, not because of *how
        // big* they are.
        droppedDegenerate += 1;
        continue;
      }
      if (row.iqrRatio < minIqrRatio) {
        droppedBelowMinIqrRatio += 1;
        continue;
      }
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'iqr-ratio-desc') {
      // null (degenerate) sorts last in both desc and asc.
      const av = a.iqrRatio;
      const bv = b.iqrRatio;
      if (av === null && bv === null) primary = 0;
      else if (av === null) primary = 1;
      else if (bv === null) primary = -1;
      else primary = bv - av;
    } else if (sort === 'iqr-ratio-asc') {
      const av = a.iqrRatio;
      const bv = b.iqrRatio;
      if (av === null && bv === null) primary = 0;
      else if (av === null) primary = 1;
      else if (bv === null) primary = -1;
      else primary = av - bv;
    } else if (sort === 'iqr-desc') primary = b.iqr - a.iqr;
    else if (sort === 'median-desc') primary = b.median - a.median;
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
    minIqrRatio,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinIqrRatio,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
