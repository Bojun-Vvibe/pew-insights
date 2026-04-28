/**
 * source-row-token-trim-mean-25: per-source **25 % symmetrically
 * trimmed mean** of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_(1) <= x_(2) <= ... <= x_(n)` (sorted ascending),
 * with trimming fraction `alpha = 0.25`:
 *
 *     k  = floor(alpha * n)
 *     TM = mean( x_(k+1), x_(k+2), ..., x_(n-k) )
 *
 * That is: drop the bottom `k` and top `k` order statistics
 * (each tail trimmed by 25 % of `n`, rounded down), then take
 * the arithmetic mean of the surviving central `n - 2k` rows.
 * On `n = 4` we drop one from each side and average the inner
 * two; on `n = 8` we drop two from each side and average the
 * inner four; on `n = 100` we drop 25 from each side and
 * average the central 50. The fraction is the standard
 * **interquartile-mean fraction** (alpha = 0.25 -> 50 % of
 * the data survives, the central 50 %).
 *
 * Headline question: **for each source, what is the mean of
 * the central 50 % of the per-row token distribution — the
 * "typical body" location after both tails have been
 * symmetrically discarded?**
 *
 * Properties.
 *
 *   - **Symmetric L-estimator** (a linear combination of order
 *     statistics with equal weight `1 / (n - 2k)` on the
 *     central `n - 2k` and weight `0` on the trimmed
 *     `2k`). Sits squarely between the mean (no trimming) and
 *     the median (maximum trimming).
 *   - **Breakdown 25 %**: a single arbitrarily-large row that
 *     sits inside the trimmed tail moves TM by exactly `0`;
 *     to move TM at all, you need to pollute strictly more
 *     than `floor(0.25 * n)` rows on one side. This matches
 *     the breakdown of the midhinge `(q1+q3)/2` and the
 *     trimean `(q1+2*median+q3)/4`, and is **strictly more
 *     robust than the mean and the mid-range (both 0 %)** but
 *     **strictly less robust than the median (50 %)**.
 *   - **Translation- and scale-equivariant**: shifting every
 *     row by `c` shifts TM by `c`; rescaling by `c > 0`
 *     rescales TM by `c`. (Same as mean, median, mid-range,
 *     midhinge, trimean.)
 *   - **Order-invariant**: TM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c`, then every order statistic is `c` and TM = c.
 *   - **Bounded by `[min, max]`** (TM is a convex combination
 *     of order statistics, all in `[min, max]`).
 *   - **Always finite for any series with `n - 2k >= 1`**: no
 *     division by zero possible once `n >= 2` and
 *     `k = floor(0.25 * n) <= (n - 1) / 2`. (At `n = 2`,
 *     `k = 0` and TM equals the arithmetic mean of the two
 *     rows — degenerate but well-defined; pinned in tests.)
 *   - **Equals the arithmetic mean iff** the trimmed tails
 *     are symmetric around the central mean — i.e. the sum
 *     of the bottom `k` order statistics equals the sum of
 *     the top `k` adjusted for the central mean. The signed
 *     gap `tmMeanGap = trim_mean - mean` is reported as a
 *     free byproduct: positive means trimming the tails
 *     **raised** the location estimate (long lower tail
 *     dominated the raw mean — the diagnostic signature of
 *     a left-heavy outlier), negative means trimming
 *     **lowered** it (long upper tail dominated the raw
 *     mean — the standard "single huge token row" signal),
 *     zero on a tail-symmetric distribution.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - **Distinct from the mean** (which this command does NOT
 *     expose as a standalone lens but reports as a free
 *     byproduct via `tmMeanGap`): mean uses every row with
 *     weight `1/n`, has 0 % breakdown, and is dominated by
 *     extremes; TM-25 zeroes the bottom 25 % and top 25 %
 *     and concentrates all weight on the central 50 %.
 *   - **Distinct from the median**: median weights only the
 *     central `1` (or `2`) order statistics; TM-25 weights
 *     `n - 2*floor(0.25 n)` central rows equally. They agree
 *     only on distributions where the central 50 % is
 *     symmetric around its midpoint.
 *   - **Distinct from `source-row-token-trimean`**:
 *     trimean = (q1 + 2*median + q3) / 4 weights three
 *     specific quantiles (1/4, 1/2, 1/4); TM-25 weights
 *     every row in the central 50 % equally. Trimean cares
 *     only about three points; TM-25 averages over the
 *     entire interquartile body, so it is sensitive to the
 *     *shape* of the central 50 % (e.g. a bimodal central
 *     mass shifts TM-25 toward the modes, but leaves
 *     trimean unchanged so long as q1, median, q3 are
 *     unchanged).
 *   - **Distinct from `source-row-token-midhinge`**:
 *     midhinge = (q1 + q3) / 2 uses *zero* central rows
 *     (just two boundary quantiles); TM-25 uses *all*
 *     central rows. Midhinge is a tail-of-the-central-half
 *     summary; TM-25 is a body-of-the-central-half
 *     summary.
 *   - **Distinct from `source-row-token-mid-range`**:
 *     mid-range = (min + max) / 2 has 0 % breakdown and
 *     listens to *only* the two tails; TM-25 has 25 %
 *     breakdown and *discards* both tails. They are
 *     opposites on the L-estimator robustness spectrum.
 *   - **Distinct from `source-row-token-mad`**: MAD is a
 *     spread, not a center.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     scale-invariant *shape* statistics built from q1/q3
 *     (and median for Bowley); TM-25 is location in token
 *     units, not shape.
 *   - **Distinct from coefficient-of-variation / burstiness /
 *     skewness / kurtosis / gini**: those are spread or
 *     shape statistics, not central tendency.
 *   - **Distinct from `source-output-tokens-per-row-percentiles`**:
 *     that command exposes raw `P50/P75/P90/P99` of
 *     `output_tokens` (different field) without combining
 *     them.
 *
 * `tmMeanGap = trim_mean - mean` is the natural diagnostic
 * pair: TM tells you the typical-body location, mean tells
 * you the all-rows location, and their signed gap quantifies
 * how much the tails are pulling the raw mean away from the
 * body. The free byproduct `mean` (arithmetic mean of all
 * `n` kept rows) is reported alongside TM — it's not a
 * separate lens (no `source-row-token-mean` exists), it's
 * just the natural reference and the obvious sanity check.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — at
 *      `n = 4` we drop one from each side and average the
 *      inner two, which is the smallest meaningful symmetric
 *      trimmed mean. At `n < 4`, `k = 0` and TM degenerates
 *      to the arithmetic mean, so we require n >= 4 by
 *      default).
 *   7. Sort ascending; compute `k = floor(0.25 * n)`,
 *      `trim_mean = sum(x_(k+1..n-k)) / (n - 2k)`,
 *      `mean = sum(x_(1..n)) / n`,
 *      `tmMeanGap = trim_mean - mean`. Also record
 *      `trimmedPerTail = k`.
 *   8. Apply display gates:
 *      - `--min-rows`       (absolute floor 4)            -> droppedBelowMinRows.
 *      - `--min-trim-mean`  (cohort: only sources with
 *                            meaningful body-location
 *                            magnitude; finite, non-negative)
 *                                                         -> droppedBelowMinTrimMean.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c): every order
 *     statistic is c; trim_mean = c; mean = c; tmMeanGap = 0.
 *   - All-zero series: trim_mean = 0; mean = 0; tmMeanGap = 0.
 *   - Single huge row dominates: that row sits in the trimmed
 *     top tail and is discarded entirely from TM (so long as
 *     there are at least `floor(0.25 n)` other rows above
 *     the trim cut, which for `n >= 4` is always at least 1);
 *     mean is pulled up; tmMeanGap is large negative. This
 *     is the diagnostic signal "this source has a heavy
 *     upper tail that the trimmed mean filters out".
 *   - Negative total_tokens: dropped (same convention as
 *     midhinge / trimean / iqr-ratio / bowley / cqd /
 *     mid-range lenses).
 *   - n exactly 4: k = 1, central window is x_(2)..x_(3), TM
 *     is the mean of the inner two; for any n in [4, 7],
 *     k = 1.
 *   - n exactly 8: k = 2, central window is x_(3)..x_(6), TM
 *     is the mean of the central four.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenTrimMean25Options {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (need k = floor(0.25 n) >= 1 to
   * actually trim — at n < 4, k = 0 and TM degenerates to
   * the arithmetic mean). Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose trim-mean is strictly below this value.
   * Cohort selector for "this source actually carries non-
   * trivial body-location token magnitude" — useful to hide
   * low-volume noise sources before ranking. Must be a
   * finite, non-negative number. Default 0.
   */
  minTrimMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'trim-mean-desc' (default): trim_mean desc.
   *   - 'trim-mean-asc':            trim_mean asc.
   *   - 'mean-desc':                arithmetic mean desc (compare).
   *   - 'gap-desc':                 |tmMeanGap| desc (mean furthest from body first).
   *   - 'rows':                     rowsKept desc.
   *   - 'source':                   source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'trim-mean-desc'
    | 'trim-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTrimMean25Row {
  source: string;
  rowsKept: number;
  /** k = floor(0.25 * rowsKept). Each tail discards exactly k order statistics. */
  trimmedPerTail: number;
  /** Arithmetic mean of all `rowsKept` order statistics. */
  mean: number;
  /** 25 % symmetrically trimmed mean — central (rowsKept - 2k) rows. */
  trimMean: number;
  /**
   * Signed gap trim_mean - mean. Positive means trimming
   * raised the location estimate (a long lower tail dominated
   * the raw mean); negative means trimming lowered it (the
   * standard "single huge token row" signal); zero on a
   * tail-symmetric distribution.
   */
  tmMeanGap: number;
}

export interface SourceRowTokenTrimMean25Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minTrimMean: number;
  top: number | null;
  sort:
    | 'trim-mean-desc'
    | 'trim-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinTrimMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTrimMean25Row[];
}

const ABSOLUTE_MIN_ROWS = 4;
const TRIM_FRACTION = 0.25;

const VALID_SORTS = [
  'trim-mean-desc',
  'trim-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTrimMean25(
  queue: QueueLine[],
  opts: SourceRowTokenTrimMean25Options = {},
): SourceRowTokenTrimMean25Report {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minTrimMean = opts.minTrimMean ?? 0;
  if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
    throw new Error(
      `minTrimMean must be a finite, non-negative number (got ${opts.minTrimMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'trim-mean-desc';
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
  const allRows: SourceRowTokenTrimMean25Row[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const k = Math.floor(TRIM_FRACTION * n);
    // Defensive: by construction with n >= minRows >= 4 and TRIM_FRACTION = 0.25,
    // k >= 1 and n - 2k >= 2, so the central window is always non-empty.
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    let centralSum = 0;
    for (let i = k; i < n - k; i += 1) centralSum += sorted[i]!;
    const mean = totalSum / n;
    const trimMean = centralSum / (n - 2 * k);
    const tmMeanGap = trimMean - mean;

    allRows.push({
      source,
      rowsKept: n,
      trimmedPerTail: k,
      mean,
      trimMean,
      tmMeanGap,
    });
  }

  let droppedBelowMinTrimMean = 0;
  const survived: SourceRowTokenTrimMean25Row[] = [];
  for (const row of allRows) {
    if (minTrimMean > 0 && row.trimMean < minTrimMean) {
      droppedBelowMinTrimMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'trim-mean-desc') primary = b.trimMean - a.trimMean;
    else if (sort === 'trim-mean-asc') primary = a.trimMean - b.trimMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.tmMeanGap) - Math.abs(a.tmMeanGap);
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
    minTrimMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinTrimMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
