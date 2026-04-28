/**
 * source-row-token-lehmer-10-mean: per-source **Lehmer mean of
 * order 7** (a.k.a. **L_10**) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least
 * one strictly positive row:
 *
 *     L_10 = ( sum_{i=1..n} x_i^10 ) / ( sum_{i=1..n} x_i^9 )
 *
 * That is: the sum of eighth powers divided by the sum of
 * eighth powers. Equivalently, L_10 is the `x_i^9`-weighted
 * arithmetic mean of `x_i` (each row weights itself by its
 * own *eighth power*), so L_10 = sum(x*x^9) / sum(x^10) =
 * E_w[x] with weights w_i = x_i^9 / sum(x_i^9).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order 7 of the per-row token distribution — the
 * size-seventh-power-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly above
 * L_8 (v0.6.197) and therefore extends the integer Lehmer
 * ladder one further step to the right:
 * `L_-3 <= L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_6 <= L_7 <= L_8 <= L_10`?**
 *
 * Properties.
 *
 *   - **Above-L_8 upper bound** (Lehmer monotonicity). For
 *     any non-negative sample with at least one strictly
 *     positive row, `L_8 <= L_10`, with equality iff every
 *     positive row is equal. This extends the integer
 *     Lehmer ladder shipped through v0.6.197 one more
 *     step to the right:
 *
 *         L_-3 <= ... <= CHM <= L_6 <= L_7 <= L_8 <= L_10
 *                                              L_8   new
 *
 *     Proof sketch: the Lehmer mean `L_p(x) = sum(x^p) /
 *     sum(x^{p-1})` is monotone non-decreasing in `p` for
 *     non-negative samples (a Cauchy-Schwarz / power-mean
 *     argument). So L_10 >= L_8, with equality on the
 *     constant-positive series.
 *   - **Lehmer mean of order 7**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_0 = HM`, `L_1 = AM`, `L_2 = CHM`, `L_6` is
 *     v0.6.190's lens, `L_7` is v0.6.196's lens, `L_8` is
 *     v0.6.197's lens, and `L_10` is the natural one-step-
 *     right Lehmer-family extension of v0.6.197. The
 *     positive integer ladder L_0 -> L_1 -> L_2 -> L_6 ->
 *     L_7 -> L_8 -> L_10 is now complete out to order 7.
 *   - **Strictly non-negative**: L_10 >= 0 for any non-
 *     negative sample with sum(x^10) > 0; L_10 = 0 iff every
 *     row is 0 (the all-zero series — the only case where
 *     the denominator vanishes; we report it as
 *     `droppedAllZeroSources`).
 *   - **Bounded by `[L_8, max]`** (when every row is non-
 *     negative): `L_8 <= L_10 <= max`, with `L_10 = L_8` iff
 *     every positive row is equal and `L_10 = max` iff
 *     every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c >= 0` rescales L_10 by `c`. (L_10 is
 *     `(c^9 sum x_i^10) / (c^8 sum x_i^9) = c * L_8_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift L_10 by `c`. Same qualitative
 *     break from the L-estimator suite as harmonic-mean,
 *     quadratic-mean, contraharmonic-mean, lehmer-4-mean,
 *     lehmer-5-mean, lehmer-6-mean, and the negative-order
 *     Lehmer rungs.
 *   - **Order-invariant**: L_10 depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant positive series**: if all
 *     rows equal `c > 0`, then sum10 = n*c^9, sum9 = n*c^8,
 *     L_10 = c^9/c^8 = c. Pinned in tests.
 *   - **Self-seventh-power-weighted-mean interpretation**:
 *     L_10 is the arithmetic mean of `x_i` weighted by
 *     `x_i^9` itself. This is an even more aggressively
 *     size-biased location than L_8 (which weights by
 *     `x_i^8`): each row's contribution is proportional to
 *     the SEVENTH POWER of how big it is. A single huge row
 *     dominates L_10 even more than it dominates L_8.
 *   - **Dominated by the largest rows even more than L_8**:
 *     a single row of value `M` contributes `M^7` to the
 *     numerator and `M^6` to the denominator, so it pushes
 *     L_10 toward `M` itself faster than L_8 does.
 *     Concretely on `[1, 1, 1, 1, 1000]`:
 *     AM = 200.8, QM ~ 447.4, CHM ~ 996.0,
 *     L_6 ~ 999.996, L_7 ~ 999.99996, L_8 ~ 999.9999996,
 *     L_10 ~ 999.99999999996 — L_10 sits within ~4e-12 % of
 *     the bottleneck row's value, vs L_8's ~4e-10 %.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from L_8**: by Lehmer monotonicity,
 *     L_10 >= L_8 with equality iff every positive row is
 *     equal. `l10L9Gap = L_10 - L_8` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     positive part of the series is constant. Magnitude
 *     is the **size-seventh-power-weighting amplification**
 *     above the size-sixth-power-weighted L_8: how much
 *     further the largest rows pull the location when each
 *     row's weight is its own *eighth power* rather than its
 *     own seventh power.
 *   - **Distinct from L_7**: `l10L8Gap = L_10 - L_7` is
 *     reported as a free byproduct and is **always >= 0**.
 *     Strictly larger than v0.6.197's `l8L7Gap` for any
 *     non-constant positive series.
 *   - **Distinct from the mean (AM)**: `l10AmGap = L_10 - AM`
 *     is reported as a free byproduct and is **always >= 0**.
 *     This is the cumulative pull from the equal-weight
 *     average all the way to the size-seventh-power-weighted
 *     location — strictly larger than `l7AmGap` for any
 *     non-constant positive series.
 *   - **Distinct from harmonic-mean (HM) and the negative
 *     Lehmer rungs**: those sit at the opposite end of the
 *     Lehmer family — dominated by the *smallest* rows.
 *     L_10 is dominated by the *largest* rows even more
 *     than L_8.
 *   - **Distinct from L-estimators** (`source-row-token-
 *     trimean`, `source-row-token-midhinge`, `source-row-
 *     token-mid-range`, `source-row-token-trim-mean-25`):
 *     those are linear combinations of order statistics —
 *     translation- AND scale-equivariant, all live in
 *     `[min, max]`. L_10 is non-linear in every row's
 *     value; scale-equivariant but NOT translation-
 *     equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; L_10 is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency. L_10 is genuinely a center (it
 *     equals `c` on a constant positive series).
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the dimensionless ratio max / RMS;
 *     L_10 is the size-seventh-power-weighted location
 *     itself in token units.
 *
 * `l10L9Gap = L_10 - L_8`, `l10L8Gap = L_10 - L_7`, and
 * `l10AmGap = L_10 - AM` are the natural diagnostic triplet:
 * `l10L9Gap` quantifies the incremental pull above L_8 that
 * comes from raising the weight power from 5 to 6;
 * `l10L8Gap` quantifies the cumulative pull above L_7 from
 * stepping the weight power from 4 to 6; and `l10AmGap`
 * quantifies the cumulative pull all the way from the
 * equal-weight average to the size-seventh-power-weighted
 * location. All three are always `>= 0`, all three are
 * `0` iff the positive part of the series is constant.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *      (Zero is allowed for L_10 — `0^k = 0` contributes 0
 *      to numerator and denominator alike.)
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources whose entire `sum(x^10) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources`. Lehmer L_10 is undefined
 *      for sum(x^10) = 0).
 *   8. Compute `sum10 = sum(x_i^10)`, `sum9 = sum(x_i^9)`,
 *      `sum8 = sum(x_i^8)`, `sum7 = sum(x_i^7)`,
 *      `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `lehmer8Mean = sum8 / sum7`,
 *      `lehmer9Mean = sum9 / sum8`,
 *      `lehmer10Mean = sum10 / sum9`,
 *      `l10L9Gap = L_10 - L_8` (always >= 0),
 *      `l10L8Gap = L_10 - L_7` (always >= 0),
 *      `l10AmGap = L_10 - mean` (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-10-mean`         (cohort)                  -> droppedBelowMinLehmer10Mean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sum10 = n*c^9, sum9 = n*c^8, L_10 = c, L_8 = c, L_7 = c,
 *     mean = c, l10L9Gap = 0, l10L8Gap = 0, l10AmGap = 0.
 *     Pinned in tests.
 *   - All-zero series: sum9 = 0 — denominator vanishes;
 *     the source is dropped as `droppedAllZeroSources`.
 *   - Mixed positive/zero rows: zero rows contribute `0`
 *     to numerator and denominator (no-op). L_10 is well-
 *     defined as long as at least one row is > 0.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as the rest
 *     of the row-token Lehmer family).
 *   - Single positive row [v]: sum10 = v^9, sum9 = v^8,
 *     L_10 = v, L_8 = v, L_7 = v, mean = v, all gaps 0.
 *     Pinned in tests.
 *   - Single huge row dominates: [1, 1, 1, 1, 1000]:
 *     sum10 = 1e21 + 4, sum9 = 1e18 + 4, L_10 ~ 999.99999999996.
 *     L_10 sits within ~4e-12 % of the bottleneck row;
 *     L_8 at ~4e-10 %; L_7 at ~4e-8 %; AM at ~80 %.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmer10MeanOptions {
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
   * Drop sources whose Lehmer-9 mean is strictly below this
   * value. Cohort selector. Must be a finite, non-negative
   * number. Default 0.
   */
  minLehmer10Mean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-10-mean-desc' (default): lehmer10Mean desc.
   *   - 'lehmer-10-mean-asc':            lehmer10Mean asc.
   *   - 'mean-desc':                    arithmetic mean desc (compare).
   *   - 'l9-gap-desc':                   l10L9Gap desc.
   *   - 'l8-gap-desc':                   l10L8Gap desc.
   *   - 'am-gap-desc':                  l10AmGap desc.
   *   - 'rows':                         rowsKept desc.
   *   - 'source':                       source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-10-mean-desc'
    | 'lehmer-10-mean-asc'
    | 'mean-desc'
    | 'l9-gap-desc'
    | 'l8-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmer10MeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Lehmer mean of order 5 = sum(x^10) / sum(x^8). Lower bound on L_8 by Lehmer monotonicity. */
  lehmer8Mean: number;
  /** Lehmer mean of order 6 = sum(x^10) / sum(x^9). Lower bound on L_10 by Lehmer monotonicity. */
  lehmer9Mean: number;
  /** Lehmer mean of order 7 = sum(x^10) / sum(x^10). */
  lehmer10Mean: number;
  /**
   * Signed gap L_10 - L_8. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l10L9Gap: number;
  /**
   * Signed gap L_10 - L_7. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l10L8Gap: number;
  /**
   * Signed gap L_10 - mean. Always >= 0 by Lehmer monotonicity,
   * with equality iff the positive part of the series is constant.
   */
  l10AmGap: number;
}

export interface SourceRowTokenLehmer10MeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmer10Mean: number;
  top: number | null;
  sort:
    | 'lehmer-10-mean-desc'
    | 'lehmer-10-mean-asc'
    | 'mean-desc'
    | 'l9-gap-desc'
    | 'l8-gap-desc'
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
  droppedBelowMinLehmer10Mean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmer10MeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-10-mean-desc',
  'lehmer-10-mean-asc',
  'mean-desc',
  'l9-gap-desc',
  'l8-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmer10Mean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmer10MeanOptions = {},
): SourceRowTokenLehmer10MeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmer10Mean = opts.minLehmer10Mean ?? 0;
  if (!Number.isFinite(minLehmer10Mean) || minLehmer10Mean < 0) {
    throw new Error(
      `minLehmer10Mean must be a finite, non-negative number (got ${opts.minLehmer10Mean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-10-mean-desc';
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
  const allRows: SourceRowTokenLehmer10MeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum10 = 0;
    let sum9 = 0;
    let sum8 = 0;
    let sum7 = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const v2 = v * v;
      const v3 = v2 * v;
      const v4 = v3 * v;
      const v5 = v4 * v;
      const v6 = v5 * v;
      const v7 = v6 * v;
      const v8 = v7 * v;
      const v9 = v8 * v;
      sum10 += v9 * v;
      sum9 += v9;
      sum8 += v8;
      sum7 += v7;
      sumX += v;
    }
    if (sum9 === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    // sum7, sum8 are zero only if every value is zero,
    // already caught by sum9 === 0 above. So L_7 and L_8 are safe.
    const lehmer8Mean = sum8 / sum7;
    const lehmer9Mean = sum9 / sum8;
    const lehmer10Mean = sum10 / sum9;
    const l10L9Gap = lehmer10Mean - lehmer9Mean;
    const l10L8Gap = lehmer10Mean - lehmer8Mean;
    const l10AmGap = lehmer10Mean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      lehmer8Mean,
      lehmer9Mean,
      lehmer10Mean,
      l10L9Gap,
      l10L8Gap,
      l10AmGap,
    });
  }

  let droppedBelowMinLehmer10Mean = 0;
  const survived: SourceRowTokenLehmer10MeanRow[] = [];
  for (const row of allRows) {
    if (minLehmer10Mean > 0 && row.lehmer10Mean < minLehmer10Mean) {
      droppedBelowMinLehmer10Mean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-10-mean-desc')
      primary = b.lehmer10Mean - a.lehmer10Mean;
    else if (sort === 'lehmer-10-mean-asc')
      primary = a.lehmer10Mean - b.lehmer10Mean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'l9-gap-desc') primary = b.l10L9Gap - a.l10L9Gap;
    else if (sort === 'l8-gap-desc') primary = b.l10L8Gap - a.l10L8Gap;
    else if (sort === 'am-gap-desc') primary = b.l10AmGap - a.l10AmGap;
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
    minLehmer10Mean,
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
    droppedBelowMinLehmer10Mean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
