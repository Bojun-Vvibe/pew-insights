/**
 * source-row-token-quadratic-mean: per-source **quadratic mean**
 * (a.k.a. **root-mean-square**, RMS) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n`:
 *
 *     QM = sqrt( ( sum_{i=1..n} x_i^2 ) / n )
 *
 * That is: square every row's token count, average those squares
 * (the arithmetic mean of the squares), and take the positive
 * square root.
 *
 * Headline question: **for each source, what is the quadratic
 * mean of the per-row token distribution — the
 * large-value-weighted central tendency that, by the Pythagorean
 * sandwich `HM <= GM <= AM <= QM`, is the upper bound on every
 * other Pythagorean mean and is dominated by the largest rows
 * even more aggressively than the arithmetic mean?**
 *
 * Properties.
 *
 *   - **Pythagorean-mean upper bound**: for any non-negative
 *     sample with at least one row > 0, `AM <= QM`, with
 *     equality iff every row is equal. Together with
 *     v0.6.186's `source-row-token-harmonic-mean` (which
 *     reports HM, GM, and AM in a single row), QM completes
 *     the full **Pythagorean sandwich**:
 *
 *         HM <= GM <= AM <= QM
 *
 *     QM is the rightmost (largest) of the four classical
 *     means and lies strictly above the arithmetic mean
 *     unless the series is constant.
 *   - **Strictly non-negative**: QM >= 0 for any non-negative
 *     sample, and QM = 0 iff every row is 0.
 *   - **Bounded by `[mean, max]`** (when every row is
 *     non-negative): `mean <= QM <= max`, with `QM = mean`
 *     iff every row is equal and `QM = max` iff every row
 *     is equal to `max` (degenerate). In particular, on a
 *     heavily right-skewed distribution `QM` sits closer to
 *     `max` than `mean` does, because squaring the rows
 *     amplifies the large-row contribution before averaging.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c >= 0` rescales QM by `c`. (QM is
 *     `sqrt( sum (c*x_i)^2 / n ) = c * QM_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift QM by `c`. Squaring is
 *     non-linear; the inner average of squares picks up
 *     cross-terms `2*c*x_i + c^2` that don't combine to a
 *     simple `+c` after the outer square root. This is
 *     the same qualitative break from the L-estimator
 *     suite (mean, median, midhinge, trimean, mid-range,
 *     trim-mean-25 are all translation-equivariant; QM is
 *     not). The direction of the shift depends on the
 *     starting geometry: when `c` is large relative to
 *     the original spread, the post-shift relative
 *     multiplicative spread compresses and `qmAmGap`
 *     shrinks toward 0; QM ends up shifted by *less*
 *     than `c`. The invariant is just "not exactly `c`".
 *   - **Order-invariant**: QM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c >= 0`, then every square is `c^2`, the mean of
 *     squares is `c^2`, and `QM = sqrt(c^2) = c`.
 *   - **Always finite for any non-negative series with
 *     n >= 1**: no division by zero possible (denominator
 *     is `n`), no negative under the square root possible
 *     (squares are non-negative).
 *   - **Dominated by the largest rows** (more so than AM):
 *     a single row of value `M` contributes `M^2 / n` to
 *     the inner average, so `QM >= M / sqrt(n)`. Compare
 *     to AM, where the same single row only contributes
 *     `M / n` and forces `AM >= M / n`. The squaring
 *     amplifies large-row dominance by an extra factor of
 *     roughly `sqrt(n)` for the bottleneck row.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from the mean (AM)**: QM and AM are both
 *     dominated by the *largest* rows, but QM amplifies
 *     that dominance by squaring. `qmAmGap = QM - AM` is
 *     reported as a free byproduct and is **always >= 0**,
 *     with `0` iff the series is constant; the magnitude
 *     of the gap is a model-free measure of multiplicative
 *     spread (it is exactly `0` on a constant series and
 *     grows monotonically as the distribution becomes
 *     more spread-out in the multiplicative sense).
 *     Concretely, for a sample of `[1, 1, 1, 1, 1000]`:
 *     AM ~200.8, QM ~447.4 — QM sits >2x higher than AM
 *     because the single huge row's `1_000_000` squared
 *     contribution dominates the inner average.
 *   - **Distinct from harmonic-mean (HM)**: HM is the
 *     opposite end of the Pythagorean spectrum — dominated
 *     by the *smallest* rows. Together QM and HM bracket
 *     the entire Pythagorean sandwich: `HM <= GM <= AM <=
 *     QM`. `qmHmGap = QM - HM` is reported as a free
 *     byproduct: it is the **full Pythagorean spread** and
 *     is `0` iff the series is constant.
 *   - **Distinct from `source-row-token-trimean`,
 *     `source-row-token-midhinge`, `source-row-token-
 *     mid-range`, `source-row-token-trim-mean-25`**:
 *     those are L-estimators (linear combinations of
 *     order statistics) — they are translation- and
 *     scale-equivariant, all live in `[min, max]`, and
 *     all collapse to the constant on a constant series.
 *     QM is *not* an L-estimator: it is a non-linear
 *     function of every row's value. It is scale-
 *     equivariant but NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; QM is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency. QM is genuinely a center (it
 *     equals `c` on a constant series).
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-output-tokens-per-row-
 *     percentiles`**: that command exposes raw P50/P75/
 *     P90/P99 of `output_tokens` (different field)
 *     without combining them.
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the ratio max / RMS — it *uses* RMS
 *     as a denominator to produce a dimensionless peak
 *     metric. QM is the RMS itself, in token units, as a
 *     standalone location signal.
 *
 * `qmAmGap = QM - AM` is the natural diagnostic pair: AM
 * tells you the all-rows-equal-weight location, QM tells
 * you the squared-weighted location, and their (always
 * >= 0) signed gap quantifies how much the multiplicative
 * spread of the series is pulling the quadratic mean
 * above the arithmetic mean. The free byproduct `mean`
 * (arithmetic mean of all `n` kept rows) is reported
 * alongside QM as the natural reference and the lower
 * bound on QM by the QM-AM inequality.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *      (Zero is allowed for QM — `0^2 = 0` is well-defined.
 *      This is a deliberate divergence from harmonic-mean,
 *      which strictly forbids zero rows because `1/0` is
 *      undefined.)
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1 — QM is
 *      well-defined for any single non-negative row and
 *      equals that row).
 *   7. Compute `sumSq = sum(x_i^2)`,
 *      `quadraticMean = sqrt(sumSq / n)`,
 *      `mean = sum(x_i) / n`,
 *      `qmAmGap = quadraticMean - mean` (always >= 0).
 *   8. Apply display gates:
 *      - `--min-rows`             (absolute floor 1)         -> droppedBelowMinRows.
 *      - `--min-quadratic-mean`   (cohort: only sources with
 *                                  meaningful body-location
 *                                  magnitude; finite,
 *                                  non-negative)
 *                                                           -> droppedBelowMinQuadraticMean.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal non-negative series (all rows == c >= 0): every
 *     square is c^2, sumSq = n*c^2, QM = c, mean = c,
 *     qmAmGap = 0. Pinned in tests.
 *   - All-zero series: every row is kept (zero is allowed for
 *     QM); QM = 0, mean = 0, qmAmGap = 0. This is a deliberate
 *     divergence from harmonic-mean, which drops zero rows.
 *   - Mixed positive/zero rows: zero rows contribute `0` to
 *     `sumSq` (no-op) and `0` to `sumX`. QM is computed from
 *     all `n` non-negative rows.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean lenses; QM technically
 *     could absorb negatives via squaring, but that would
 *     lose the location interpretation — a negative cancels
 *     to a positive squared contribution, which is not a
 *     meaningful "central tendency" for token counts).
 *   - Single huge row (e.g. [1, 1, 1, 1000]): AM = 250.75,
 *     QM = 500.25 — QM sits ~2x above AM because the squared
 *     huge row dominates the inner average. This is the
 *     diagnostic signal "this source has a heavy upper tail
 *     that dominates a squared-weighted average".
 *   - n exactly 1: QM equals that single row; mean equals
 *     that single row; qmAmGap = 0. Degenerate but
 *     well-defined; pinned in tests.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenQuadraticMeanOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many non-negative kept
   * rows. Display filter. Must be an integer >= 1 (QM is
   * well-defined for any single non-negative row). Default 1.
   */
  minRows?: number;
  /**
   * Drop sources whose quadratic mean is strictly below this value.
   * Cohort selector for "this source actually carries non-trivial
   * squared-weighted token magnitude". Must be a finite,
   * non-negative number. Default 0.
   */
  minQuadraticMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'quadratic-mean-desc' (default): quadraticMean desc.
   *   - 'quadratic-mean-asc':            quadraticMean asc.
   *   - 'mean-desc':                     arithmetic mean desc (compare).
   *   - 'gap-desc':                      qmAmGap desc (multiplicative spread first).
   *   - 'rows':                          rowsKept desc.
   *   - 'source':                        source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'quadratic-mean-desc'
    | 'quadratic-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenQuadraticMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Quadratic mean = sqrt( sum(x_i^2) / n ). Always in [mean, max]. */
  quadraticMean: number;
  /**
   * Signed gap quadraticMean - mean. Always >= 0 (QM-AM
   * inequality) with equality iff the series is constant.
   * Magnitude is a model-free measure of multiplicative
   * spread.
   */
  qmAmGap: number;
}

export interface SourceRowTokenQuadraticMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minQuadraticMean: number;
  top: number | null;
  sort:
    | 'quadratic-mean-desc'
    | 'quadratic-mean-asc'
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
  droppedBelowMinQuadraticMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenQuadraticMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'quadratic-mean-desc',
  'quadratic-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenQuadraticMean(
  queue: QueueLine[],
  opts: SourceRowTokenQuadraticMeanOptions = {},
): SourceRowTokenQuadraticMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minQuadraticMean = opts.minQuadraticMean ?? 0;
  if (!Number.isFinite(minQuadraticMean) || minQuadraticMean < 0) {
    throw new Error(
      `minQuadraticMean must be a finite, non-negative number (got ${opts.minQuadraticMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'quadratic-mean-desc';
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
  const allRows: SourceRowTokenQuadraticMeanRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sumSq = 0;
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      sumSq += v * v;
      totalSum += v;
    }
    const mean = totalSum / n;
    const quadraticMean = Math.sqrt(sumSq / n);
    const qmAmGap = quadraticMean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      quadraticMean,
      qmAmGap,
    });
  }

  let droppedBelowMinQuadraticMean = 0;
  const survived: SourceRowTokenQuadraticMeanRow[] = [];
  for (const row of allRows) {
    if (minQuadraticMean > 0 && row.quadraticMean < minQuadraticMean) {
      droppedBelowMinQuadraticMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'quadratic-mean-desc') primary = b.quadraticMean - a.quadraticMean;
    else if (sort === 'quadratic-mean-asc') primary = a.quadraticMean - b.quadraticMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc') primary = b.qmAmGap - a.qmAmGap;
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
    minQuadraticMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinQuadraticMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
