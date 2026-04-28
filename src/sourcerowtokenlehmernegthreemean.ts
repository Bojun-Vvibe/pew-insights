/**
 * source-row-token-lehmer-neg-3-mean: per-source **Lehmer mean
 * of order -3** (a.k.a. **L_-3**, the sub-sub-sub-harmonic Lehmer
 * mean) of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row strictly positive
 * `total_tokens` samples `x_1, x_2, ..., x_n`:
 *
 *     L_-3 = ( sum_{i=1..n} x_i^{-3} ) / ( sum_{i=1..n} x_i^{-4} )
 *
 * That is: the sum of inverse cubes divided by the sum of
 * inverse fourth powers. Equivalently, L_-3 is the
 * `x_i^{-4}`-weighted arithmetic mean of `x_i` (each row weights
 * itself by its own INVERSE fourth power), so
 * L_-3 = sum(x^{-3}) / sum(x^{-4}) = E_w[x] with weights
 * w_i = x_i^{-4} / sum(x_i^{-4}).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order -3 of the per-row token distribution — the
 * inverse-fourth-power-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly below the
 * Lehmer L_-2 (v0.6.191) and therefore extends the integer
 * Lehmer ladder one further step LEFT:
 * `L_-3 <= L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3`?**
 *
 * Properties.
 *
 *   - **Below-L_-2 upper bound** (Lehmer monotonicity). For
 *     any strictly positive sample, `L_-3 <= L_-2 <= L_-1 <=
 *     L_0 = HM`, with equality iff every row is equal. This
 *     extends v0.6.191's Lehmer ladder one step further LEFT,
 *     deepening the integer Lehmer ladder further into the
 *     small-value-dominated tail:
 *
 *         L_-3 <= L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3
 *          ^                              ^                              ^
 *          |                              |                              |
 *          new step left                center (L_1)                  v0.6.189
 *
 *     Proof sketch: Lehmer's mean L_p(x) is monotone non-
 *     decreasing in `p` for positive samples (a Cauchy-Schwarz
 *     argument). So L_-3 <= L_-2, with equality on a constant
 *     series.
 *   - **Lehmer mean of order -3**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_-3 = sum(x^-3) / sum(x^-4)`, `L_-2`, `L_-1`,
 *     `L_0 = HM`, `L_1 = AM`, `L_2 = CHM`, `L_3` (v0.6.189).
 *     L_-3 is the natural one-step-left Lehmer-family extension
 *     that deepens the small-row bias even further: each row
 *     weights itself by its own INVERSE FOURTH POWER, so a
 *     single tiny row pulls L_-3 toward that row's value even
 *     faster than L_-2 does.
 *   - **Strictly positive**: L_-3 > 0 for any strictly
 *     positive sample. Undefined if any row is 0 (the row's
 *     reciprocal blows up); we therefore require all rows
 *     to be strictly positive and surface zero-bearing
 *     sources as `droppedZeroBearingSources`.
 *   - **Bounded by `[min, L_-2]`** (when every row is positive):
 *     `min <= L_-3 <= L_-2`, with `L_-3 = L_-2` iff every row
 *     is equal and `L_-3 = min` iff every row equals `min`.
 *   - **Scale-equivariant** (multiplicative): rescaling every
 *     row by `c > 0` rescales L_-3 by `c`. (L_-3 becomes
 *     `(c^-3 sum x^-3) / (c^-4 sum x^-4) = c * L_-3_original`.)
 *   - **NOT translation-equivariant**: shifting every row by
 *     `c` does NOT shift L_-3 by `c`. Same qualitative break
 *     as harmonic-mean / quadratic-mean / contraharmonic-mean
 *     / lehmer-3-mean / lehmer-neg-1-mean / lehmer-neg-2-mean.
 *   - **Order-invariant**: depends only on the multiset of
 *     row values.
 *   - **Identity on a constant positive series**: if all rows
 *     equal `c > 0`, then sumInvCu = n/c^3, sumInvQu = n/c^4,
 *     L_-3 = (n/c^3) / (n/c^4) = c. Pinned in tests.
 *   - **Self-inverse-fourth-power-weighted-mean interpretation**:
 *     L_-3 is the arithmetic mean of `x_i` weighted by
 *     `x_i^{-4}` itself. This is an even more aggressively
 *     small-row-biased location than L_-2: each row's
 *     contribution is proportional to `1 / x_i^4`.
 *   - **Dominated by the smallest rows even more than L_-2**:
 *     a single row of value `m` contributes `m^-3` to the
 *     numerator and `m^-4` to the denominator, so it pushes
 *     L_-3 toward `m` itself faster than L_-2 does.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from L_-2 (v0.6.191)**: by Lehmer monotonicity,
 *     L_-3 <= L_-2 with equality iff every row is equal.
 *     `negThreeNegTwoGap = L_-2 - L_-3` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     series is constant. Magnitude is the **inverse-fourth-
 *     power weighting amplification** below the inverse-cube-
 *     weighted L_-2: how much further the smallest rows pull
 *     the location when each row's weight is its own
 *     `x^{-4}` rather than its own `x^{-3}`.
 *   - **Distinct from HM (L_0)**: `negThreeHmGap = HM - L_-3`
 *     is reported as a free byproduct and is **always >= 0**,
 *     strictly larger than v0.6.191's negTwoHmGap for any
 *     non-constant positive series.
 *   - **Distinct from the mean (AM)**: `negThreeAmGap = mean -
 *     L_-3` is reported as a free byproduct and is **always
 *     >= 0**. This is the cumulative pull from the equal-
 *     weight average all the way to the inverse-fourth-power-
 *     weighted location — strictly larger than the mean-minus-
 *     L_-2 gap for any non-constant positive series.
 *   - **Distinct from L_3 (v0.6.189)**: L_3 sits on the
 *     OPPOSITE side of AM, dominated by the *largest* rows.
 *     L_-3 is dominated by the *smallest* rows. Together
 *     L_-3 and L_3 bracket the widest span of the integer
 *     Lehmer ladder shipped to date.
 *   - **Distinct from L-estimators** (mid-range / midhinge /
 *     trimean / trim-mean-25): those are translation- AND
 *     scale-equivariant, all live in `[min, max]`. L_-3 is
 *     non-linear in every row's value; scale-equivariant but
 *     NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     scale-invariant *shape* statistics built from q1/q3;
 *     L_-3 is a location in token units.
 *   - **Distinct from coefficient-of-variation / burstiness
 *     / skewness / kurtosis / gini**: those are spread- or
 *     distribution-shape statistics, not central tendency.
 *     L_-3 is genuinely a center (it equals `c` on a
 *     constant positive series).
 *
 * `negThreeNegTwoGap = L_-2 - L_-3`, `negThreeHmGap = HM -
 * L_-3`, and `negThreeAmGap = mean - L_-3` form the natural
 * diagnostic triple. All three are always `>= 0`, all three
 * are `0` iff the series is constant. The free byproducts
 * `mean` (AM), `harmonicMean` (HM), and `lehmerNegTwoMean`
 * (L_-2, recomputed inline so the lens is self-contained) are
 * reported alongside L_-3 as the natural references and upper
 * bounds on L_-3 by Lehmer monotonicity.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources containing ANY row equal to 0 (reciprocal
 *      diverges) -> `droppedZeroBearingSources`. Lehmer L_-3
 *      is undefined for any zero row.
 *   8. Compute `sumInv = sum(1/x_i)`, `sumInvSq = sum(1/x_i^2)`,
 *      `sumInvCu = sum(1/x_i^3)`, `sumInvQu = sum(1/x_i^4)`,
 *      `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `harmonicMean = n / sumInv`,
 *      `lehmerNegTwoMean = sumInvSq / sumInvCu`,
 *      `lehmerNegThreeMean = sumInvCu / sumInvQu`,
 *      `negThreeNegTwoGap = L_-2 - L_-3` (always >= 0),
 *      `negThreeHmGap = HM - L_-3`        (always >= 0),
 *      `negThreeAmGap = mean - L_-3`      (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-neg-3-mean`     (cohort)                  -> droppedBelowMinLehmerNegThreeMean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sumInvCu = n/c^3, sumInvQu = n/c^4, L_-3 = c, L_-2 = c,
 *     HM = c, mean = c, all gaps = 0. Pinned in tests.
 *   - Any zero row: source dropped as
 *     `droppedZeroBearingSources` (1/0 diverges).
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean / quadratic-mean /
 *     contraharmonic-mean / lehmer-3-mean / lehmer-neg-1-mean
 *     / lehmer-neg-2-mean lenses).
 *   - Single positive row [v]: sumInvCu = 1/v^3,
 *     sumInvQu = 1/v^4, L_-3 = v, L_-2 = v, HM = v, mean = v,
 *     all gaps = 0. Pinned in tests.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmerNegThreeMeanOptions {
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
   * Drop sources whose Lehmer L_-3 mean is strictly below
   * this value. Cohort selector. Must be a finite, non-
   * negative number. Default 0.
   */
  minLehmerNegThreeMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-neg-3-mean-desc' (default): lehmerNegThreeMean desc.
   *   - 'lehmer-neg-3-mean-asc':            lehmerNegThreeMean asc.
   *   - 'mean-desc':                        arithmetic mean desc (compare).
   *   - 'neg-two-gap-desc':                 negThreeNegTwoGap desc.
   *   - 'hm-gap-desc':                      negThreeHmGap desc.
   *   - 'am-gap-desc':                      negThreeAmGap desc.
   *   - 'rows':                             rowsKept desc.
   *   - 'source':                           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-neg-3-mean-desc'
    | 'lehmer-neg-3-mean-asc'
    | 'mean-desc'
    | 'neg-two-gap-desc'
    | 'hm-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmerNegThreeMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` positive rows. */
  mean: number;
  /** Harmonic mean = n / sum(1/x). Upper bound on L_-3 by Lehmer monotonicity. */
  harmonicMean: number;
  /** Lehmer L_-2 = sum(1/x^2) / sum(1/x^3). Upper bound on L_-3. */
  lehmerNegTwoMean: number;
  /** Lehmer mean of order -3 = sum(1/x^3) / sum(1/x^4). */
  lehmerNegThreeMean: number;
  /**
   * Signed gap L_-2 - L_-3. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negThreeNegTwoGap: number;
  /**
   * Signed gap HM - L_-3. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negThreeHmGap: number;
  /**
   * Signed gap mean - L_-3. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negThreeAmGap: number;
}

export interface SourceRowTokenLehmerNegThreeMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmerNegThreeMean: number;
  top: number | null;
  sort:
    | 'lehmer-neg-3-mean-desc'
    | 'lehmer-neg-3-mean-asc'
    | 'mean-desc'
    | 'neg-two-gap-desc'
    | 'hm-gap-desc'
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
  droppedZeroBearingSources: number;
  droppedBelowMinLehmerNegThreeMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmerNegThreeMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-neg-3-mean-desc',
  'lehmer-neg-3-mean-asc',
  'mean-desc',
  'neg-two-gap-desc',
  'hm-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmerNegThreeMean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmerNegThreeMeanOptions = {},
): SourceRowTokenLehmerNegThreeMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmerNegThreeMean = opts.minLehmerNegThreeMean ?? 0;
  if (!Number.isFinite(minLehmerNegThreeMean) || minLehmerNegThreeMean < 0) {
    throw new Error(
      `minLehmerNegThreeMean must be a finite, non-negative number (got ${opts.minLehmerNegThreeMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-neg-3-mean-desc';
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
  const allRows: SourceRowTokenLehmerNegThreeMeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedZeroBearingSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let hasZero = false;
    for (let i = 0; i < n; i += 1) {
      if (samples[i]! === 0) {
        hasZero = true;
        break;
      }
    }
    if (hasZero) {
      droppedZeroBearingSources += 1;
      continue;
    }

    let sumInv = 0;
    let sumInvSq = 0;
    let sumInvCu = 0;
    let sumInvQu = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const inv = 1 / v;
      const invSq = inv * inv;
      const invCu = invSq * inv;
      sumInv += inv;
      sumInvSq += invSq;
      sumInvCu += invCu;
      sumInvQu += invCu * inv;
      sumX += v;
    }
    const mean = sumX / n;
    const harmonicMean = n / sumInv;
    const lehmerNegTwoMean = sumInvSq / sumInvCu;
    const lehmerNegThreeMean = sumInvCu / sumInvQu;
    const negThreeNegTwoGap = lehmerNegTwoMean - lehmerNegThreeMean;
    const negThreeHmGap = harmonicMean - lehmerNegThreeMean;
    const negThreeAmGap = mean - lehmerNegThreeMean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      harmonicMean,
      lehmerNegTwoMean,
      lehmerNegThreeMean,
      negThreeNegTwoGap,
      negThreeHmGap,
      negThreeAmGap,
    });
  }

  let droppedBelowMinLehmerNegThreeMean = 0;
  const survived: SourceRowTokenLehmerNegThreeMeanRow[] = [];
  for (const row of allRows) {
    if (
      minLehmerNegThreeMean > 0 &&
      row.lehmerNegThreeMean < minLehmerNegThreeMean
    ) {
      droppedBelowMinLehmerNegThreeMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-neg-3-mean-desc')
      primary = b.lehmerNegThreeMean - a.lehmerNegThreeMean;
    else if (sort === 'lehmer-neg-3-mean-asc')
      primary = a.lehmerNegThreeMean - b.lehmerNegThreeMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'neg-two-gap-desc')
      primary = b.negThreeNegTwoGap - a.negThreeNegTwoGap;
    else if (sort === 'hm-gap-desc') primary = b.negThreeHmGap - a.negThreeHmGap;
    else if (sort === 'am-gap-desc') primary = b.negThreeAmGap - a.negThreeAmGap;
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
    minLehmerNegThreeMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroBearingSources,
    droppedBelowMinLehmerNegThreeMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
