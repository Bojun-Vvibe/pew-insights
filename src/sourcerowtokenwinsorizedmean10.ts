/**
 * source-row-token-winsorized-mean-10: per-source **10 %
 * symmetrically winsorized mean** of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_(1) <= x_(2) <= ... <= x_(n)` (sorted ascending),
 * with winsorization fraction `alpha = 0.10`:
 *
 *     k  = floor(alpha * n)
 *     y_(i) = x_(k+1)        for i = 1..k
 *           = x_(i)           for i = k+1..n-k
 *           = x_(n-k)         for i = n-k+1..n
 *     WM  = mean(y_(1), y_(2), ..., y_(n))
 *
 * That is: REPLACE the bottom `k` order statistics with the
 * smallest non-trimmed value `x_(k+1)`, REPLACE the top `k`
 * order statistics with the largest non-trimmed value `x_(n-k)`,
 * then take the arithmetic mean of all `n` (now-clipped) rows.
 *
 * Headline question: **for each source, what is the mean of
 * the row token distribution after pulling the most extreme
 * 10 % of each tail in to the boundary of the central 80 % —
 * the "tail-clipped" location estimator that keeps every row
 * (unlike the trimmed mean) but caps the influence each tail
 * row can exert?**
 *
 * Properties.
 *
 *   - **Symmetric L-estimator** (linear combination of order
 *     statistics with weight `(k+1)/n` on `x_(k+1)`, weight
 *     `(k+1)/n` on `x_(n-k)`, weight `1/n` on each of the
 *     central `n - 2k - 2` rows, and weight `0` on the trimmed
 *     `2k` rows themselves; the trimmed rows' values still
 *     enter the count `n`, but their *original values* do not).
 *     Sits between the mean (no clipping) and the trimmed mean
 *     (full discard) on the L-estimator robustness spectrum.
 *   - **Breakdown 10 %**: a single arbitrarily-large row that
 *     sits inside the winsorized tail moves WM by at most
 *     `(x_(n-k) - mean) / n`, NOT by `infinity / n`. To move
 *     WM unboundedly, you need to pollute strictly more than
 *     `floor(0.10 * n)` rows on one side. This matches the
 *     breakdown of the 10 % trimmed mean, and is **strictly
 *     more robust than the mean and the mid-range (both 0 %)**
 *     but **strictly less robust than the median (50 %)** and
 *     the 25 % trimmed mean (25 %).
 *   - **Translation- and scale-equivariant**: shifting every
 *     row by `c` shifts WM by `c`; rescaling by `c > 0`
 *     rescales WM by `c`. (Same as mean, median, mid-range,
 *     midhinge, trimean, trim-mean-25.)
 *   - **Order-invariant**: WM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c`, then every order statistic is `c`, every clipped
 *     value is `c`, and WM = c.
 *   - **Bounded by `[x_(k+1), x_(n-k)]`** (WM is a convex
 *     combination of values all in that range).
 *   - **Always finite for any series with `n >= 1`**: no
 *     division by zero possible. (At `n < 10`, `k = 0` and
 *     WM degenerates to the arithmetic mean, so we require
 *     n >= 10 by default to ensure k >= 1 and actual
 *     winsorization happens.)
 *   - **Equals the arithmetic mean iff** the bottom `k` and
 *     top `k` order statistics, when replaced by their
 *     respective boundaries, sum to the same total they
 *     originally summed to — i.e. the total mass each tail
 *     contributed equals the total mass the boundary
 *     replacement contributes. The signed gap
 *     `wmMeanGap = winsorized_mean - mean` is reported as a
 *     free byproduct: positive means winsorizing the tails
 *     **raised** the location estimate (long lower tail
 *     dominated the raw mean — the diagnostic signature of a
 *     left-heavy outlier), negative means winsorizing
 *     **lowered** it (long upper tail dominated the raw
 *     mean — the standard "single huge token row" signal),
 *     zero on a tail-symmetric distribution.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - **Distinct from the mean**: mean uses every row's raw
 *     value with weight `1/n`, has 0 % breakdown, and is
 *     dominated by extremes; WM-10 *clips* the 10 % tails to
 *     the boundary value but still counts them, attenuating
 *     extreme influence without dropping data.
 *   - **Distinct from `source-row-token-trim-mean-25`**:
 *     trim-mean-25 *discards* the bottom 25 % and top 25 %
 *     entirely (they contribute zero to numerator AND zero
 *     to denominator); WM-10 *replaces* the bottom 10 % and
 *     top 10 % with boundary values (they contribute the
 *     boundary value to numerator AND one row to denominator).
 *     Different fraction (10 vs 25), different mechanism
 *     (clip vs drop), different breakdown (10 % vs 25 %).
 *   - **Distinct from the median**: median weights only the
 *     central `1` (or `2`) order statistics; WM-10 weights
 *     every row.
 *   - **Distinct from `source-row-token-midhinge`**:
 *     midhinge = (q1 + q3) / 2 uses *zero* central rows
 *     (just two boundary quantiles); WM-10 uses *all* rows.
 *   - **Distinct from `source-row-token-mid-range`**:
 *     mid-range = (min + max) / 2 listens to *only* the two
 *     extreme tails (0 % breakdown); WM-10 *clips* those
 *     tails (10 % breakdown). They are opposites on the
 *     L-estimator robustness spectrum.
 *   - **Distinct from `source-row-token-trimean`**:
 *     trimean = (q1 + 2*median + q3) / 4 weights three
 *     quantiles; WM-10 weights every row equally after
 *     clipping. Trimean cares about three points; WM-10
 *     cares about the entire (clipped) distribution.
 *   - **Distinct from `source-row-token-mad`**: MAD is a
 *     spread, not a center.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     scale-invariant *shape* statistics; WM-10 is location
 *     in token units.
 *   - **Distinct from CV / burstiness / skewness / kurtosis /
 *     gini**: those are spread or shape statistics, not
 *     central tendency.
 *   - **Distinct from every Lehmer / Pythagorean / contraharmonic
 *     mean** in the suite: those are POWER-weighted location
 *     estimators (each row weights itself by some power of
 *     its own value), non-linear in row values, NOT
 *     translation-equivariant; WM-10 is a linear L-estimator,
 *     translation- AND scale-equivariant.
 *
 * `wmMeanGap = winsorized_mean - mean` is the natural
 * diagnostic pair: WM tells you the tail-clipped location,
 * mean tells you the all-rows-as-is location, and their
 * signed gap quantifies how much the unclipped tails are
 * pulling the raw mean away from the body. The free byproduct
 * `mean` (arithmetic mean of all `n` kept rows, unclipped) is
 * reported alongside WM as the natural reference and the
 * obvious sanity check.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 10 — at
 *      `n = 10` we replace one from each side, the smallest
 *      meaningful symmetric winsorized mean. At `n < 10`,
 *      `k = 0` and WM degenerates to the arithmetic mean).
 *   7. Sort ascending; compute `k = floor(0.10 * n)`,
 *      lo = x_(k+1)       (1-indexed; sorted[k] in 0-indexed),
 *      hi = x_(n-k)        (1-indexed; sorted[n-k-1] in 0-indexed),
 *      sumWinsor = k * lo + sum(sorted[k..n-k-1]) + k * hi,
 *      winsorizedMean = sumWinsor / n,
 *      mean = sum(sorted[0..n-1]) / n,
 *      wmMeanGap = winsorizedMean - mean. Also record
 *      `clippedPerTail = k`, `loBoundary = lo`, `hiBoundary = hi`.
 *   8. Apply display gates:
 *      - `--min-rows`              (absolute floor 10) -> droppedBelowMinRows.
 *      - `--min-winsorized-mean`   (cohort: only sources with
 *                                    meaningful magnitude;
 *                                    finite, non-negative)
 *                                                       -> droppedBelowMinWinsorizedMean.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c): every order
 *     statistic is c; lo = hi = c; WM = c; mean = c;
 *     wmMeanGap = 0.
 *   - All-zero series: WM = 0; mean = 0; wmMeanGap = 0.
 *   - Single huge row dominates: that row sits in the
 *     winsorized top tail and is REPLACED by `x_(n-k)` (the
 *     largest non-clipped value); mean is pulled up by the
 *     huge row's true value; wmMeanGap is large negative.
 *     This is the diagnostic signal "this source has a heavy
 *     upper tail that the winsorized mean clips out".
 *   - Negative total_tokens: dropped (same convention as
 *     midhinge / trimean / iqr-ratio / bowley / cqd /
 *     mid-range / trim-mean-25 lenses).
 *   - n exactly 10: k = 1, clipped tails are `x_(1)` -> `x_(2)`
 *     and `x_(10)` -> `x_(9)`; central window x_(2)..x_(9)
 *     enters at original values.
 *   - n exactly 20: k = 2, clipped tails are x_(1), x_(2) -> x_(3)
 *     and x_(20), x_(19) -> x_(18); central window x_(3)..x_(18)
 *     enters at original values.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenWinsorizedMean10Options {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 10 (need k = floor(0.10 n) >= 1 to
   * actually winsorize — at n < 10, k = 0 and WM degenerates to
   * the arithmetic mean). Default 10.
   */
  minRows?: number;
  /**
   * Drop sources whose winsorized-mean is strictly below this
   * value. Cohort selector for "this source actually carries
   * non-trivial body-location token magnitude" — useful to hide
   * low-volume noise sources before ranking. Must be a finite,
   * non-negative number. Default 0.
   */
  minWinsorizedMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'winsorized-mean-desc' (default): WM desc.
   *   - 'winsorized-mean-asc':            WM asc.
   *   - 'mean-desc':                      arithmetic mean desc (compare).
   *   - 'gap-desc':                       |wmMeanGap| desc (mean furthest from clipped body first).
   *   - 'rows':                           rowsKept desc.
   *   - 'source':                         source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'winsorized-mean-desc'
    | 'winsorized-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenWinsorizedMean10Row {
  source: string;
  rowsKept: number;
  /** k = floor(0.10 * rowsKept). Each tail clips exactly k order statistics. */
  clippedPerTail: number;
  /** x_(k+1) — the value the bottom k order statistics get replaced with. */
  loBoundary: number;
  /** x_(n-k) — the value the top k order statistics get replaced with. */
  hiBoundary: number;
  /** Arithmetic mean of all `rowsKept` order statistics, UNCLIPPED. */
  mean: number;
  /** 10 % symmetrically winsorized mean — clip both tails to boundaries, then arithmetic mean. */
  winsorizedMean: number;
  /**
   * Signed gap winsorized_mean - mean. Positive means
   * winsorizing raised the location estimate (a long lower
   * tail dominated the raw mean); negative means winsorizing
   * lowered it (the standard "single huge token row" signal);
   * zero on a tail-symmetric distribution.
   */
  wmMeanGap: number;
}

export interface SourceRowTokenWinsorizedMean10Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minWinsorizedMean: number;
  top: number | null;
  sort:
    | 'winsorized-mean-desc'
    | 'winsorized-mean-asc'
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
  droppedBelowMinWinsorizedMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenWinsorizedMean10Row[];
}

const ABSOLUTE_MIN_ROWS = 10;
const WINSORIZE_FRACTION = 0.1;

const VALID_SORTS = [
  'winsorized-mean-desc',
  'winsorized-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenWinsorizedMean10(
  queue: QueueLine[],
  opts: SourceRowTokenWinsorizedMean10Options = {},
): SourceRowTokenWinsorizedMean10Report {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minWinsorizedMean = opts.minWinsorizedMean ?? 0;
  if (!Number.isFinite(minWinsorizedMean) || minWinsorizedMean < 0) {
    throw new Error(
      `minWinsorizedMean must be a finite, non-negative number (got ${opts.minWinsorizedMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'winsorized-mean-desc';
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
  const allRows: SourceRowTokenWinsorizedMean10Row[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const k = Math.floor(WINSORIZE_FRACTION * n);
    // Defensive: by construction with n >= minRows >= 10 and
    // WINSORIZE_FRACTION = 0.10, k >= 1 and n - 2k >= 8, so the
    // central window is always non-empty and lo/hi are distinct
    // order statistics from the trimmed positions.
    const lo = sorted[k]!;
    const hi = sorted[n - k - 1]!;
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    let centralSum = 0;
    for (let i = k; i < n - k; i += 1) centralSum += sorted[i]!;
    const sumWinsor = k * lo + centralSum + k * hi;
    const mean = totalSum / n;
    const winsorizedMean = sumWinsor / n;
    const wmMeanGap = winsorizedMean - mean;

    allRows.push({
      source,
      rowsKept: n,
      clippedPerTail: k,
      loBoundary: lo,
      hiBoundary: hi,
      mean,
      winsorizedMean,
      wmMeanGap,
    });
  }

  let droppedBelowMinWinsorizedMean = 0;
  const survived: SourceRowTokenWinsorizedMean10Row[] = [];
  for (const row of allRows) {
    if (minWinsorizedMean > 0 && row.winsorizedMean < minWinsorizedMean) {
      droppedBelowMinWinsorizedMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'winsorized-mean-desc')
      primary = b.winsorizedMean - a.winsorizedMean;
    else if (sort === 'winsorized-mean-asc')
      primary = a.winsorizedMean - b.winsorizedMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.wmMeanGap) - Math.abs(a.wmMeanGap);
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
    minWinsorizedMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinWinsorizedMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
