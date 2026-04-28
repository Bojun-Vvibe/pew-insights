/**
 * source-row-token-lehmer-3-mean: per-source **Lehmer mean of
 * order 3** (a.k.a. **L_3**) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least
 * one strictly positive row:
 *
 *     L_3 = ( sum_{i=1..n} x_i^3 ) / ( sum_{i=1..n} x_i^2 )
 *
 * That is: the sum of cubes divided by the sum of squares.
 * Equivalently, L_3 is the `x_i^2`-weighted arithmetic mean
 * of `x_i` (each row weights itself by its own *square*),
 * so L_3 = sum(x*x*x) / sum(x*x) = E_w[x] with weights
 * w_i = x_i^2 / sum(x_i^2).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order 3 of the per-row token distribution — the
 * size-squared-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly above the
 * contraharmonic mean (L_2 = CHM) and therefore extends
 * the Pythagorean-plus-CHM sandwich one step further to
 * the right: `HM <= GM <= AM <= QM <= CHM <= L_3`?**
 *
 * Properties.
 *
 *   - **Above-CHM upper bound** (Lehmer monotonicity). For
 *     any non-negative sample with at least one strictly
 *     positive row, `L_2 = CHM <= L_3`, with equality iff
 *     every positive row is equal. This extends v0.6.188's
 *     extended Pythagorean sandwich one step further:
 *
 *         HM <= GM <= AM <= QM <= CHM <= L_3
 *
 *     Proof sketch: the Lehmer mean `L_p(x) = sum(x^p) /
 *     sum(x^{p-1})` is monotone non-decreasing in `p` for
 *     non-negative samples (a Cauchy-Schwarz / power-mean
 *     argument). So L_3 >= L_2 = CHM, with equality on the
 *     constant-positive series.
 *   - **Lehmer mean of order 3**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_0 = HM`, `L_1 = AM`, `L_2 = CHM`, and `L_3` is
 *     the natural one-step-right Lehmer-family extension
 *     of v0.6.188. Together with `source-row-token-
 *     harmonic-mean` (L_0), the implicit AM (L_1) reported
 *     in every lens, and `source-row-token-contraharmonic-
 *     mean` (L_2), this lens completes the integer-order
 *     Lehmer-mean ladder L_0 -> L_1 -> L_2 -> L_3.
 *   - **Strictly non-negative**: L_3 >= 0 for any non-
 *     negative sample with sum(x^2) > 0; L_3 = 0 iff every
 *     row is 0 (the all-zero series — the only case where
 *     the denominator vanishes; we report it as
 *     `droppedAllZeroSources`).
 *   - **Bounded by `[CHM, max]`** (when every row is non-
 *     negative): `CHM <= L_3 <= max`, with `L_3 = CHM` iff
 *     every positive row is equal and `L_3 = max` iff
 *     every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c >= 0` rescales L_3 by `c`. (L_3 is
 *     `(c^3 sum x_i^3) / (c^2 sum x_i^2) = c * L_3_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift L_3 by `c`. Same qualitative
 *     break from the L-estimator suite as harmonic-mean,
 *     quadratic-mean, and contraharmonic-mean.
 *   - **Order-invariant**: L_3 depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant positive series**: if all
 *     rows equal `c > 0`, then sumCube = n*c^3,
 *     sumSq = n*c^2, L_3 = c^3/c^2 = c. Pinned in tests.
 *   - **Self-square-weighted-mean interpretation**: L_3 is
 *     the arithmetic mean of `x_i` weighted by `x_i^2`
 *     itself. This is an even more aggressively size-
 *     biased location than CHM (which weights by `x_i`):
 *     each row's contribution is proportional to the
 *     SQUARE of how big it is. A single huge row dominates
 *     L_3 even more than it dominates CHM.
 *   - **Dominated by the largest rows even more than CHM**:
 *     a single row of value `M` contributes `M^3` to the
 *     numerator and `M^2` to the denominator, so it pushes
 *     L_3 toward `M` itself faster than CHM does.
 *     Concretely on `[1, 1, 1, 1, 1000]`:
 *     AM = 200.8, QM ~ 447.4, CHM ~ 996.0,
 *     L_3 = 1_000_000_004 / 1_000_004 ~ 999.996 — L_3 sits
 *     within 0.0004 % of the bottleneck row's value, vs
 *     CHM's 0.4 %.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from CHM (L_2)**: by Lehmer monotonicity,
 *     L_3 >= CHM with equality iff every positive row is
 *     equal. `l3ChmGap = L_3 - CHM` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     positive part of the series is constant. Magnitude
 *     is the **size-square-weighting amplification** above
 *     the size-weighted CHM: how much further the largest
 *     rows pull the location when each row's weight is its
 *     own *square* rather than its own value.
 *   - **Distinct from the mean (AM)**: `l3AmGap = L_3 - AM`
 *     is reported as a free byproduct and is **always >= 0**.
 *     This is the cumulative pull from the equal-weight
 *     average all the way to the size-square-weighted
 *     location — strictly larger than `chmAmGap` for any
 *     non-constant positive series.
 *   - **Distinct from harmonic-mean (HM)**: HM = L_0 sits
 *     at the opposite end of the Lehmer family — dominated
 *     by the *smallest* rows. L_3 is dominated by the
 *     *largest* rows even more than CHM. Together HM and
 *     L_3 bracket an even wider Lehmer-family spectrum
 *     than HM <-> CHM.
 *   - **Distinct from `source-row-token-trimean`,
 *     `source-row-token-midhinge`, `source-row-token-
 *     mid-range`, `source-row-token-trim-mean-25`**:
 *     those are L-estimators (linear combinations of
 *     order statistics) — translation- AND scale-
 *     equivariant, all live in `[min, max]`. L_3 is
 *     non-linear in every row's value; scale-equivariant
 *     but NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; L_3 is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency. L_3 is genuinely a center (it
 *     equals `c` on a constant positive series).
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the dimensionless ratio max / RMS;
 *     L_3 is the size-square-weighted location itself in
 *     token units.
 *
 * `l3ChmGap = L_3 - CHM` and `l3AmGap = L_3 - AM` are the
 * natural diagnostic pair: `l3ChmGap` quantifies the
 * incremental pull above CHM that comes from squaring the
 * weights; `l3AmGap` quantifies the cumulative pull all
 * the way from the equal-weight average to the size-
 * square-weighted location. Both are always `>= 0`, both
 * are `0` iff the positive part of the series is constant.
 * The free byproducts `mean` (AM) and `contraharmonicMean`
 * (CHM, recomputed inline so the lens is self-contained)
 * are reported alongside L_3 as the natural references
 * and lower bounds on L_3 by Lehmer monotonicity.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *      (Zero is allowed for L_3 — `0^k = 0` contributes 0
 *      to numerator and denominator alike.)
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources whose entire `sum(x^2) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources`. Lehmer L_3 is undefined
 *      for sum(x^2) = 0).
 *   8. Compute `sumCube = sum(x_i^3)`, `sumSq = sum(x_i^2)`,
 *      `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `contraharmonicMean = sumSq / sumX`,
 *      `lehmer3Mean = sumCube / sumSq`,
 *      `l3ChmGap = L_3 - CHM` (always >= 0),
 *      `l3AmGap = L_3 - mean` (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-3-mean`         (cohort)                  -> droppedBelowMinLehmer3Mean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sumCube = n*c^3, sumSq = n*c^2, L_3 = c, CHM = c,
 *     mean = c, l3ChmGap = 0, l3AmGap = 0. Pinned in
 *     tests.
 *   - All-zero series: sumSq = 0 — denominator vanishes;
 *     the source is dropped as `droppedAllZeroSources`.
 *   - Mixed positive/zero rows: zero rows contribute `0`
 *     to numerator and denominator (no-op). L_3 is well-
 *     defined as long as at least one row is > 0.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean / quadratic-mean /
 *     contraharmonic-mean lenses).
 *   - Single positive row [v]: sumCube = v^3, sumSq = v^2,
 *     L_3 = v, CHM = v, mean = v, l3ChmGap = 0,
 *     l3AmGap = 0. Pinned in tests.
 *   - Single huge row dominates: [1, 1, 1, 1000]:
 *     sumCube = 1_000_000_003, sumSq = 1_000_003,
 *     L_3 ~ 999.997, CHM ~ 997.01, AM = 250.75. L_3 sits
 *     within ~0.0003 % of the bottleneck row; CHM at
 *     ~0.3 %; AM at ~25 %.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmer3MeanOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many non-negative kept
   * rows. Display filter. Must be an integer >= 1. Default 1.
   */
  minRows?: number;
  /**
   * Drop sources whose Lehmer-3 mean is strictly below this
   * value. Cohort selector. Must be a finite, non-negative
   * number. Default 0.
   */
  minLehmer3Mean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-3-mean-desc' (default): lehmer3Mean desc.
   *   - 'lehmer-3-mean-asc':            lehmer3Mean asc.
   *   - 'mean-desc':                    arithmetic mean desc (compare).
   *   - 'chm-gap-desc':                 l3ChmGap desc.
   *   - 'am-gap-desc':                  l3AmGap desc.
   *   - 'rows':                         rowsKept desc.
   *   - 'source':                       source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-3-mean-desc'
    | 'lehmer-3-mean-asc'
    | 'mean-desc'
    | 'chm-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmer3MeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Contraharmonic mean = sum(x^2) / sum(x). Lower bound on L_3 by Lehmer monotonicity. */
  contraharmonicMean: number;
  /** Lehmer mean of order 3 = sum(x^3) / sum(x^2). */
  lehmer3Mean: number;
  /**
   * Signed gap L_3 - CHM. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l3ChmGap: number;
  /**
   * Signed gap L_3 - mean. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l3AmGap: number;
}

export interface SourceRowTokenLehmer3MeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmer3Mean: number;
  top: number | null;
  sort:
    | 'lehmer-3-mean-desc'
    | 'lehmer-3-mean-asc'
    | 'mean-desc'
    | 'chm-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAllZeroSources: number;
  droppedBelowMinLehmer3Mean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmer3MeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-3-mean-desc',
  'lehmer-3-mean-asc',
  'mean-desc',
  'chm-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmer3Mean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmer3MeanOptions = {},
): SourceRowTokenLehmer3MeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmer3Mean = opts.minLehmer3Mean ?? 0;
  if (!Number.isFinite(minLehmer3Mean) || minLehmer3Mean < 0) {
    throw new Error(
      `minLehmer3Mean must be a finite, non-negative number (got ${opts.minLehmer3Mean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-3-mean-desc';
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
  const allRows: SourceRowTokenLehmer3MeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sumCube = 0;
    let sumSq = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const v2 = v * v;
      sumCube += v2 * v;
      sumSq += v2;
      sumX += v;
    }
    if (sumSq === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    // sumX may also be zero only if every value is zero, which
    // is already caught by sumSq === 0 above. So CHM is safe.
    const contraharmonicMean = sumSq / sumX;
    const lehmer3Mean = sumCube / sumSq;
    const l3ChmGap = lehmer3Mean - contraharmonicMean;
    const l3AmGap = lehmer3Mean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      contraharmonicMean,
      lehmer3Mean,
      l3ChmGap,
      l3AmGap,
    });
  }

  let droppedBelowMinLehmer3Mean = 0;
  const survived: SourceRowTokenLehmer3MeanRow[] = [];
  for (const row of allRows) {
    if (minLehmer3Mean > 0 && row.lehmer3Mean < minLehmer3Mean) {
      droppedBelowMinLehmer3Mean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-3-mean-desc')
      primary = b.lehmer3Mean - a.lehmer3Mean;
    else if (sort === 'lehmer-3-mean-asc')
      primary = a.lehmer3Mean - b.lehmer3Mean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'chm-gap-desc') primary = b.l3ChmGap - a.l3ChmGap;
    else if (sort === 'am-gap-desc') primary = b.l3AmGap - a.l3AmGap;
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
    minLehmer3Mean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAllZeroSources,
    droppedBelowMinLehmer3Mean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
