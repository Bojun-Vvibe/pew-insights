/**
 * source-row-token-lehmer-5-mean: per-source **Lehmer mean of
 * order 5** (a.k.a. **L_5**) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least
 * one strictly positive row:
 *
 *     L_5 = ( sum_{i=1..n} x_i^5 ) / ( sum_{i=1..n} x_i^4 )
 *
 * That is: the sum of fifth powers divided by the sum of
 * fourth powers. Equivalently, L_5 is the `x_i^4`-weighted
 * arithmetic mean of `x_i` (each row weights itself by its
 * own *fourth power*), so L_5 = sum(x*x^4) / sum(x^4) =
 * E_w[x] with weights w_i = x_i^4 / sum(x_i^4).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order 5 of the per-row token distribution — the
 * size-fourth-power-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly above
 * L_4 (v0.6.193) and therefore extends the integer Lehmer
 * ladder one further step to the right:
 * `L_-3 <= L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3 <= L_4 <= L_5`?**
 *
 * Properties.
 *
 *   - **Above-L_4 upper bound** (Lehmer monotonicity). For
 *     any non-negative sample with at least one strictly
 *     positive row, `L_4 <= L_5`, with equality iff every
 *     positive row is equal. This extends the integer
 *     Lehmer ladder shipped through v0.6.193 one more
 *     step to the right:
 *
 *         L_-3 <= ... <= CHM <= L_3 <= L_4 <= L_5
 *                                       L_4   new
 *
 *     Proof sketch: the Lehmer mean `L_p(x) = sum(x^p) /
 *     sum(x^{p-1})` is monotone non-decreasing in `p` for
 *     non-negative samples (a Cauchy-Schwarz / power-mean
 *     argument). So L_5 >= L_4, with equality on the
 *     constant-positive series.
 *   - **Lehmer mean of order 5**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_0 = HM`, `L_1 = AM`, `L_2 = CHM`, `L_3` is
 *     v0.6.188's lens, `L_4` is v0.6.193's lens, and `L_5`
 *     is the natural one-step-right Lehmer-family extension
 *     of v0.6.193. The positive integer ladder L_0 -> L_1
 *     -> L_2 -> L_3 -> L_4 -> L_5 is now complete out to
 *     order 5.
 *   - **Strictly non-negative**: L_5 >= 0 for any non-
 *     negative sample with sum(x^4) > 0; L_5 = 0 iff every
 *     row is 0 (the all-zero series — the only case where
 *     the denominator vanishes; we report it as
 *     `droppedAllZeroSources`).
 *   - **Bounded by `[L_4, max]`** (when every row is non-
 *     negative): `L_4 <= L_5 <= max`, with `L_5 = L_4` iff
 *     every positive row is equal and `L_5 = max` iff
 *     every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c >= 0` rescales L_5 by `c`. (L_5 is
 *     `(c^5 sum x_i^5) / (c^4 sum x_i^4) = c * L_5_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift L_5 by `c`. Same qualitative
 *     break from the L-estimator suite as harmonic-mean,
 *     quadratic-mean, contraharmonic-mean, lehmer-3-mean,
 *     lehmer-4-mean, and the negative-order Lehmer rungs.
 *   - **Order-invariant**: L_5 depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant positive series**: if all
 *     rows equal `c > 0`, then sum5 = n*c^5, sum4 = n*c^4,
 *     L_5 = c^5/c^4 = c. Pinned in tests.
 *   - **Self-fourth-power-weighted-mean interpretation**:
 *     L_5 is the arithmetic mean of `x_i` weighted by
 *     `x_i^4` itself. This is an even more aggressively
 *     size-biased location than L_4 (which weights by
 *     `x_i^3`): each row's contribution is proportional to
 *     the FOURTH POWER of how big it is. A single huge row
 *     dominates L_5 even more than it dominates L_4.
 *   - **Dominated by the largest rows even more than L_4**:
 *     a single row of value `M` contributes `M^5` to the
 *     numerator and `M^4` to the denominator, so it pushes
 *     L_5 toward `M` itself faster than L_4 does.
 *     Concretely on `[1, 1, 1, 1, 1000]`:
 *     AM = 200.8, QM ~ 447.4, CHM ~ 996.0,
 *     L_3 ~ 999.996, L_4 ~ 999.99996, L_5 ~ 999.9999996 —
 *     L_5 sits within ~4e-8 % of the bottleneck row's
 *     value, vs L_4's ~4e-6 %.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from L_4**: by Lehmer monotonicity,
 *     L_5 >= L_4 with equality iff every positive row is
 *     equal. `l5L4Gap = L_5 - L_4` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     positive part of the series is constant. Magnitude
 *     is the **size-fourth-power-weighting amplification**
 *     above the size-cube-weighted L_4: how much further
 *     the largest rows pull the location when each row's
 *     weight is its own *fourth power* rather than its own
 *     cube.
 *   - **Distinct from L_3**: `l5L3Gap = L_5 - L_3` is
 *     reported as a free byproduct and is **always >= 0**.
 *     Strictly larger than v0.6.193's `l4L3Gap` for any
 *     non-constant positive series.
 *   - **Distinct from the mean (AM)**: `l5AmGap = L_5 - AM`
 *     is reported as a free byproduct and is **always >= 0**.
 *     This is the cumulative pull from the equal-weight
 *     average all the way to the size-fourth-power-weighted
 *     location — strictly larger than `l4AmGap` for any
 *     non-constant positive series.
 *   - **Distinct from harmonic-mean (HM) and the negative
 *     Lehmer rungs**: those sit at the opposite end of the
 *     Lehmer family — dominated by the *smallest* rows.
 *     L_5 is dominated by the *largest* rows even more
 *     than L_4.
 *   - **Distinct from L-estimators** (`source-row-token-
 *     trimean`, `source-row-token-midhinge`, `source-row-
 *     token-mid-range`, `source-row-token-trim-mean-25`):
 *     those are linear combinations of order statistics —
 *     translation- AND scale-equivariant, all live in
 *     `[min, max]`. L_5 is non-linear in every row's
 *     value; scale-equivariant but NOT translation-
 *     equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; L_5 is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency. L_5 is genuinely a center (it
 *     equals `c` on a constant positive series).
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the dimensionless ratio max / RMS;
 *     L_5 is the size-fourth-power-weighted location
 *     itself in token units.
 *
 * `l5L4Gap = L_5 - L_4`, `l5L3Gap = L_5 - L_3`, and
 * `l5AmGap = L_5 - AM` are the natural diagnostic triplet:
 * `l5L4Gap` quantifies the incremental pull above L_4 that
 * comes from raising the weight power from 3 to 4;
 * `l5L3Gap` quantifies the cumulative pull above L_3 from
 * stepping the weight power from 2 to 4; and `l5AmGap`
 * quantifies the cumulative pull all the way from the
 * equal-weight average to the size-fourth-power-weighted
 * location. All three are always `>= 0`, all three are
 * `0` iff the positive part of the series is constant.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *      (Zero is allowed for L_5 — `0^k = 0` contributes 0
 *      to numerator and denominator alike.)
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources whose entire `sum(x^4) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources`. Lehmer L_5 is undefined
 *      for sum(x^4) = 0).
 *   8. Compute `sum5 = sum(x_i^5)`, `sum4 = sum(x_i^4)`,
 *      `sum3 = sum(x_i^3)`, `sum2 = sum(x_i^2)`,
 *      `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `lehmer3Mean = sum3 / sum2`,
 *      `lehmer4Mean = sum4 / sum3`,
 *      `lehmer5Mean = sum5 / sum4`,
 *      `l5L4Gap = L_5 - L_4` (always >= 0),
 *      `l5L3Gap = L_5 - L_3` (always >= 0),
 *      `l5AmGap = L_5 - mean` (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-5-mean`         (cohort)                  -> droppedBelowMinLehmer5Mean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sum5 = n*c^5, sum4 = n*c^4, L_5 = c, L_4 = c, L_3 = c,
 *     mean = c, l5L4Gap = 0, l5L3Gap = 0, l5AmGap = 0.
 *     Pinned in tests.
 *   - All-zero series: sum4 = 0 — denominator vanishes;
 *     the source is dropped as `droppedAllZeroSources`.
 *   - Mixed positive/zero rows: zero rows contribute `0`
 *     to numerator and denominator (no-op). L_5 is well-
 *     defined as long as at least one row is > 0.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as the rest
 *     of the row-token Lehmer family).
 *   - Single positive row [v]: sum5 = v^5, sum4 = v^4,
 *     L_5 = v, L_4 = v, L_3 = v, mean = v, all gaps 0.
 *     Pinned in tests.
 *   - Single huge row dominates: [1, 1, 1, 1, 1000]:
 *     sum5 = 1e15 + 4, sum4 = 1e12 + 4, L_5 ~ 999.99999996.
 *     L_5 sits within ~4e-8 % of the bottleneck row;
 *     L_4 at ~4e-6 %; L_3 at ~4e-4 %; AM at ~80 %.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmer5MeanOptions {
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
   * Drop sources whose Lehmer-5 mean is strictly below this
   * value. Cohort selector. Must be a finite, non-negative
   * number. Default 0.
   */
  minLehmer5Mean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-5-mean-desc' (default): lehmer5Mean desc.
   *   - 'lehmer-5-mean-asc':            lehmer5Mean asc.
   *   - 'mean-desc':                    arithmetic mean desc (compare).
   *   - 'l4-gap-desc':                  l5L4Gap desc.
   *   - 'l3-gap-desc':                  l5L3Gap desc.
   *   - 'am-gap-desc':                  l5AmGap desc.
   *   - 'rows':                         rowsKept desc.
   *   - 'source':                       source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-5-mean-desc'
    | 'lehmer-5-mean-asc'
    | 'mean-desc'
    | 'l4-gap-desc'
    | 'l3-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmer5MeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Lehmer mean of order 3 = sum(x^3) / sum(x^2). Lower bound on L_4 by Lehmer monotonicity. */
  lehmer3Mean: number;
  /** Lehmer mean of order 4 = sum(x^4) / sum(x^3). Lower bound on L_5 by Lehmer monotonicity. */
  lehmer4Mean: number;
  /** Lehmer mean of order 5 = sum(x^5) / sum(x^4). */
  lehmer5Mean: number;
  /**
   * Signed gap L_5 - L_4. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l5L4Gap: number;
  /**
   * Signed gap L_5 - L_3. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l5L3Gap: number;
  /**
   * Signed gap L_5 - mean. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l5AmGap: number;
}

export interface SourceRowTokenLehmer5MeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmer5Mean: number;
  top: number | null;
  sort:
    | 'lehmer-5-mean-desc'
    | 'lehmer-5-mean-asc'
    | 'mean-desc'
    | 'l4-gap-desc'
    | 'l3-gap-desc'
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
  droppedBelowMinLehmer5Mean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmer5MeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-5-mean-desc',
  'lehmer-5-mean-asc',
  'mean-desc',
  'l4-gap-desc',
  'l3-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmer5Mean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmer5MeanOptions = {},
): SourceRowTokenLehmer5MeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmer5Mean = opts.minLehmer5Mean ?? 0;
  if (!Number.isFinite(minLehmer5Mean) || minLehmer5Mean < 0) {
    throw new Error(
      `minLehmer5Mean must be a finite, non-negative number (got ${opts.minLehmer5Mean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-5-mean-desc';
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
  const allRows: SourceRowTokenLehmer5MeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum5 = 0;
    let sum4 = 0;
    let sum3 = 0;
    let sum2 = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const v2 = v * v;
      const v3 = v2 * v;
      const v4 = v3 * v;
      sum5 += v4 * v;
      sum4 += v4;
      sum3 += v3;
      sum2 += v2;
      sumX += v;
    }
    if (sum4 === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    // sumX, sum2, sum3 are zero only if every value is zero,
    // already caught by sum4 === 0 above. So L_3 and L_4 are safe.
    const lehmer3Mean = sum3 / sum2;
    const lehmer4Mean = sum4 / sum3;
    const lehmer5Mean = sum5 / sum4;
    const l5L4Gap = lehmer5Mean - lehmer4Mean;
    const l5L3Gap = lehmer5Mean - lehmer3Mean;
    const l5AmGap = lehmer5Mean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      lehmer3Mean,
      lehmer4Mean,
      lehmer5Mean,
      l5L4Gap,
      l5L3Gap,
      l5AmGap,
    });
  }

  let droppedBelowMinLehmer5Mean = 0;
  const survived: SourceRowTokenLehmer5MeanRow[] = [];
  for (const row of allRows) {
    if (minLehmer5Mean > 0 && row.lehmer5Mean < minLehmer5Mean) {
      droppedBelowMinLehmer5Mean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-5-mean-desc')
      primary = b.lehmer5Mean - a.lehmer5Mean;
    else if (sort === 'lehmer-5-mean-asc')
      primary = a.lehmer5Mean - b.lehmer5Mean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'l4-gap-desc') primary = b.l5L4Gap - a.l5L4Gap;
    else if (sort === 'l3-gap-desc') primary = b.l5L3Gap - a.l5L3Gap;
    else if (sort === 'am-gap-desc') primary = b.l5AmGap - a.l5AmGap;
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
    minLehmer5Mean,
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
    droppedBelowMinLehmer5Mean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
