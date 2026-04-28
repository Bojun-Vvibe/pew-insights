/**
 * source-row-token-harmonic-mean: per-source **harmonic mean**
 * of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row strictly positive
 * `total_tokens` samples `x_1, x_2, ..., x_n`:
 *
 *     HM = n / sum_{i=1..n} (1 / x_i)
 *
 * That is: take the reciprocal of each row's token count,
 * average those reciprocals (the arithmetic mean of the
 * reciprocals), and take the reciprocal of that average.
 * Equivalently, HM is `n` divided by the sum of reciprocals.
 *
 * Headline question: **for each source, what is the harmonic
 * mean of the per-row token distribution — the reciprocal-of-
 * average-reciprocals "small-value-weighted" central tendency
 * that, unlike the arithmetic mean, is dominated by the
 * smallest rows rather than the largest?**
 *
 * Properties.
 *
 *   - **Pythagorean-mean lower bound**: by the AM-GM-HM
 *     inequality, for any strictly positive sample,
 *     `HM <= GM <= AM`, with equality iff all rows are
 *     equal. So HM is always the smallest of the three
 *     classical Pythagorean means and lies strictly below
 *     the arithmetic mean unless the series is constant.
 *   - **Strictly positive**: HM > 0 whenever every kept row
 *     is > 0 (so this lens requires `total_tokens > 0` for
 *     every kept row — see "edge cases" below for the zero-
 *     row policy).
 *   - **Bounded by `[min, max]`**: HM lies in the closed
 *     interval `[min(x), max(x)]`, with equality iff all
 *     rows are equal. In particular `HM <= min(x) * (n /
 *     n) * (max/min)` is *not* the bound — the correct
 *     bound is `min(x) <= HM <= max(x)`, and on a heavily
 *     right-skewed distribution `HM` sits very close to
 *     `min(x)`.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c > 0` rescales HM by `c`. (HM is
 *     `c * n / sum(1/(c*x_i)) = c * HM_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift HM by `c`. This is the
 *     fundamental qualitative break from every existing
 *     `source-row-token-*` location lens (mean, median,
 *     midhinge, trimean, mid-range, trim-mean-25 are all
 *     translation-equivariant; HM is not). Shifting all
 *     rows up by `c` *moves* HM by less than `c` because
 *     the small-row reciprocals dominate the average and
 *     they shrink by relatively more after the shift.
 *   - **Order-invariant**: HM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c > 0`, then every reciprocal is `1/c`, the average
 *     reciprocal is `1/c`, and HM = `c`.
 *   - **Always finite for a strictly positive series with
 *     n >= 1**: no division by zero possible once every
 *     row is `> 0` (the zero-row filter is strict — see
 *     edge cases).
 *   - **Dominated by the smallest rows**: any single very
 *     small row pulls HM toward zero hard. A row of
 *     value `epsilon` contributes `1/epsilon` to the sum
 *     of reciprocals, which alone forces
 *     `HM <= n * epsilon`. This is the "bottleneck"
 *     interpretation: HM is the right average for rates
 *     and ratios precisely because slow / cheap rows
 *     dominate the result.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from the mean (AM)**: AM is dominated by
 *     the *largest* rows (a single huge row pulls AM up
 *     unboundedly); HM is dominated by the *smallest*
 *     rows (a single tiny row pulls HM down unboundedly).
 *     They are the two opposite ends of the Pythagorean-
 *     mean spectrum. `hmAmGap = HM - AM` is reported as a
 *     free byproduct and is **always <= 0**, with
 *     `0` iff the series is constant; the magnitude of
 *     the gap is a model-free measure of multiplicative
 *     spread (it is exactly `0` on a constant series and
 *     grows monotonically as the distribution becomes
 *     more spread-out in the multiplicative sense).
 *   - **Distinct from the median**: median weights only
 *     the central order statistic; HM weights *every* row
 *     by its *reciprocal*. A series of `[1, 1, 1, 1, 1,
 *     1000]` has median 1, AM ~167, HM ~1.2 — three
 *     wildly different "central" answers, each correct
 *     for its own question. HM happens to agree with the
 *     median here only because the bottleneck rows
 *     dominate; in general HM and median diverge.
 *   - **Distinct from `source-row-token-trimean`,
 *     `source-row-token-midhinge`, `source-row-token-
 *     mid-range`, `source-row-token-trim-mean-25`**:
 *     those are L-estimators (linear combinations of
 *     order statistics) — they are translation- and
 *     scale-equivariant, all live in `[min, max]`, and
 *     all collapse to the constant on a constant series.
 *     HM is *not* an L-estimator: it is a non-linear
 *     function of every row's value. It is scale-
 *     equivariant but NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; HM is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency.
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-output-tokens-per-row-
 *     percentiles`**: that command exposes raw P50/P75/
 *     P90/P99 of `output_tokens` (different field)
 *     without combining them.
 *
 * `hmAmGap = HM - AM` is the natural diagnostic pair: AM
 * tells you the all-rows-equal-weight location, HM tells
 * you the small-rows-dominated location, and their
 * (always <= 0) signed gap quantifies how much the
 * multiplicative spread of the series is pulling the
 * harmonic mean down below the arithmetic mean. The free
 * byproduct `mean` (arithmetic mean of all `n` kept rows)
 * is reported alongside HM — it's not a separate lens
 * (no `source-row-token-mean` exists), it's just the
 * natural reference and the obvious sanity check, AND
 * the AM-GM-HM upper bound on HM.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Drop rows with zero `total_tokens`         -> droppedZeroTokens.
 *      (Harmonic mean requires strictly positive
 *      values — `1 / 0` is undefined; tracked
 *      separately from "negative" for diagnostics.)
 *   6. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   7. Per source: skip if `n < minRows` (default 1 — HM is
 *      well-defined for any single strictly positive row
 *      and equals that row).
 *   8. Compute `sumRecip = sum(1 / x_i)`,
 *      `harmonicMean = n / sumRecip`,
 *      `mean = sum(x_i) / n`,
 *      `hmAmGap = harmonicMean - mean` (always <= 0).
 *   9. Apply display gates:
 *      - `--min-rows`             (absolute floor 1)         -> droppedBelowMinRows.
 *      - `--min-harmonic-mean`    (cohort: only sources with
 *                                  meaningful body-location
 *                                  magnitude; finite,
 *                                  non-negative)
 *                                                           -> droppedBelowMinHarmonicMean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0): every
 *     reciprocal is 1/c, sumRecip = n/c, HM = c, mean = c,
 *     hmAmGap = 0. Pinned in tests.
 *   - All-zero series: every row dropped as
 *     droppedZeroTokens; the source then has zero kept
 *     rows and is dropped as droppedBelowMinRows. (HM is
 *     undefined when any row is zero; we skip the source
 *     entirely rather than emit Infinity or NaN.)
 *   - Mixed positive/zero rows: zero rows are dropped
 *     individually (counted in droppedZeroTokens), and HM
 *     is computed from the surviving strictly positive
 *     rows. This matches the standard convention for
 *     harmonic mean of a sample.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 lenses).
 *   - Single huge row (e.g. [1, 1, 1, 1000]): AM ~250,
 *     HM ~1.33 — HM barely moves because the small rows
 *     dominate the sum of reciprocals. This is the
 *     diagnostic signal "this source has a typical row
 *     value of ~1, the huge row is rare enough to barely
 *     register in a small-value-weighted average".
 *   - n exactly 1: HM equals that single row; mean equals
 *     that single row; hmAmGap = 0. Degenerate but
 *     well-defined; pinned in tests.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenHarmonicMeanOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many strictly positive kept
   * rows. Display filter. Must be an integer >= 1 (HM is
   * well-defined for any single strictly positive row). Default 1.
   */
  minRows?: number;
  /**
   * Drop sources whose harmonic mean is strictly below this value.
   * Cohort selector for "this source actually carries non-trivial
   * small-row-weighted token magnitude". Must be a finite,
   * non-negative number. Default 0.
   */
  minHarmonicMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'harmonic-mean-desc' (default): harmonicMean desc.
   *   - 'harmonic-mean-asc':            harmonicMean asc.
   *   - 'mean-desc':                    arithmetic mean desc (compare).
   *   - 'gap-desc':                     |hmAmGap| desc (multiplicative spread first).
   *   - 'rows':                         rowsKept desc.
   *   - 'source':                       source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'harmonic-mean-desc'
    | 'harmonic-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenHarmonicMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` strictly positive rows. */
  mean: number;
  /**
   * Geometric mean = exp( mean(log x_i) ) of all `rowsKept`
   * strictly positive rows. Reported as a free byproduct: by
   * AM-GM-HM, `harmonicMean <= geometricMean <= mean` for any
   * strictly positive sample, with equality iff the series is
   * constant. Computed in log-space (sum of `Math.log(x)` /
   * `n`, then `Math.exp`) so very large products do not
   * overflow.
   */
  geometricMean: number;
  /** Harmonic mean = n / sum(1 / x_i). Always in (0, mean]. */
  harmonicMean: number;
  /**
   * Signed gap harmonicMean - mean. Always <= 0 (AM-GM-HM
   * inequality) with equality iff the series is constant.
   * Magnitude is a model-free measure of multiplicative
   * spread.
   */
  hmAmGap: number;
  /**
   * Signed gap harmonicMean - geometricMean. Always <= 0 by
   * the right half of AM-GM-HM (HM <= GM), with equality iff
   * the series is constant. Together with `hmAmGap` and the
   * derived `gmAmGap = geometricMean - mean` (also <= 0), the
   * three classical Pythagorean means form the verifiable
   * sandwich `HM <= GM <= AM` directly in each row.
   */
  hmGmGap: number;
}

export interface SourceRowTokenHarmonicMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minHarmonicMean: number;
  top: number | null;
  sort:
    | 'harmonic-mean-desc'
    | 'harmonic-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinHarmonicMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenHarmonicMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'harmonic-mean-desc',
  'harmonic-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenHarmonicMean(
  queue: QueueLine[],
  opts: SourceRowTokenHarmonicMeanOptions = {},
): SourceRowTokenHarmonicMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minHarmonicMean = opts.minHarmonicMean ?? 0;
  if (!Number.isFinite(minHarmonicMean) || minHarmonicMean < 0) {
    throw new Error(
      `minHarmonicMean must be a finite, non-negative number (got ${opts.minHarmonicMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'harmonic-mean-desc';
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
  let droppedZeroTokens = 0;
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
    if (tt === 0) {
      droppedZeroTokens += 1;
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
  const allRows: SourceRowTokenHarmonicMeanRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sumRecip = 0;
    let totalSum = 0;
    let sumLog = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      sumRecip += 1 / v;
      totalSum += v;
      sumLog += Math.log(v);
    }
    const mean = totalSum / n;
    const harmonicMean = n / sumRecip;
    const geometricMean = Math.exp(sumLog / n);
    const hmAmGap = harmonicMean - mean;
    const hmGmGap = harmonicMean - geometricMean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      geometricMean,
      harmonicMean,
      hmAmGap,
      hmGmGap,
    });
  }

  let droppedBelowMinHarmonicMean = 0;
  const survived: SourceRowTokenHarmonicMeanRow[] = [];
  for (const row of allRows) {
    if (minHarmonicMean > 0 && row.harmonicMean < minHarmonicMean) {
      droppedBelowMinHarmonicMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'harmonic-mean-desc') primary = b.harmonicMean - a.harmonicMean;
    else if (sort === 'harmonic-mean-asc') primary = a.harmonicMean - b.harmonicMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.hmAmGap) - Math.abs(a.hmAmGap);
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
    minHarmonicMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinHarmonicMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
