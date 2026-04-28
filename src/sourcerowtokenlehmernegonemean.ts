/**
 * source-row-token-lehmer-neg-1-mean: per-source **Lehmer mean
 * of order -1** (a.k.a. **L_-1**, the sub-harmonic Lehmer mean)
 * of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row strictly positive
 * `total_tokens` samples `x_1, x_2, ..., x_n`:
 *
 *     L_-1 = ( sum_{i=1..n} x_i^{-1} ) / ( sum_{i=1..n} x_i^{-2} )
 *
 * That is: the sum of reciprocals divided by the sum of inverse
 * squares. Equivalently, L_-1 is the `x_i^{-2}`-weighted
 * arithmetic mean of `x_i` (each row weights itself by its own
 * INVERSE square), so
 * L_-1 = sum(x^{-1}) / sum(x^{-2}) = E_w[x] with weights
 * w_i = x_i^{-2} / sum(x_i^{-2}).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order -1 of the per-row token distribution — the
 * inverse-square-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly below the
 * harmonic mean (L_0 = HM) and therefore extends the
 * Pythagorean+CHM+L_3 sandwich one step further to the LEFT:
 * `L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3`?**
 *
 * Properties.
 *
 *   - **Below-HM upper bound** (Lehmer monotonicity). For any
 *     strictly positive sample, `L_-1 <= L_0 = HM`, with
 *     equality iff every row is equal. This extends v0.6.189's
 *     Lehmer ladder one step further LEFT, completing the
 *     symmetric integer Lehmer ladder around AM:
 *
 *         L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3
 *          ^                ^                     ^
 *          |                |                     |
 *          new step left   center (L_1)          v0.6.189
 *
 *     Proof sketch: Lehmer's mean L_p(x) is monotone non-
 *     decreasing in `p` for positive samples (a Cauchy-Schwarz
 *     argument). So L_-1 <= L_0 = HM, with equality on a
 *     constant series.
 *   - **Lehmer mean of order -1**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_-1 = sum(x^-1) / sum(x^-2)`, `L_0 = HM`, `L_1 = AM`,
 *     `L_2 = CHM`, `L_3` (v0.6.189). L_-1 is the natural
 *     one-step-left Lehmer-family extension that mirrors L_3
 *     across the AM (L_1) center: just as L_3 weights each
 *     row by its own SQUARE and is dominated by the largest
 *     rows, L_-1 weights each row by its INVERSE SQUARE and
 *     is dominated by the smallest rows.
 *   - **Strictly positive**: L_-1 > 0 for any strictly
 *     positive sample. Undefined if any row is 0 (the row's
 *     reciprocal blows up); we therefore require all rows
 *     to be strictly positive and surface zero-bearing
 *     sources as `droppedZeroBearingSources`.
 *   - **Bounded by `[min, HM]`** (when every row is positive):
 *     `min <= L_-1 <= HM`, with `L_-1 = HM` iff every row is
 *     equal and `L_-1 = min` iff every row equals `min`.
 *   - **Scale-equivariant** (multiplicative): rescaling every
 *     row by `c > 0` rescales L_-1 by `c`. (L_-1 becomes
 *     `(c^-1 sum x^-1) / (c^-2 sum x^-2) = c * L_-1_original`.)
 *   - **NOT translation-equivariant**: shifting every row by
 *     `c` does NOT shift L_-1 by `c`. Same qualitative break
 *     as harmonic-mean / quadratic-mean / contraharmonic-mean
 *     / lehmer-3-mean.
 *   - **Order-invariant**: depends only on the multiset of
 *     row values.
 *   - **Identity on a constant positive series**: if all rows
 *     equal `c > 0`, then sumInv = n/c, sumInvSq = n/c^2,
 *     L_-1 = (n/c) / (n/c^2) = c. Pinned in tests.
 *   - **Self-inverse-square-weighted-mean interpretation**:
 *     L_-1 is the arithmetic mean of `x_i` weighted by
 *     `x_i^{-2}` itself. This is a strongly small-row-biased
 *     location: each row's contribution is proportional to
 *     `1 / x_i^2`. A single tiny row dominates L_-1 even more
 *     than it dominates HM.
 *   - **Dominated by the smallest rows even more than HM**:
 *     a single row of value `m` contributes `m^-1` to the
 *     numerator and `m^-2` to the denominator, so it pushes
 *     L_-1 toward `m` itself faster than HM does. Concretely
 *     on `[1, 1000, 1000, 1000, 1000]`:
 *     HM ~ 4.98, L_-1 = (1 + 4/1000) / (1 + 4/1_000_000)
 *           ~ 1.004 / 1.000004 ~ 1.004 — L_-1 sits within
 *     0.4 % of the smallest row's value 1, vs HM at ~398 %.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from HM (L_0)**: by Lehmer monotonicity,
 *     L_-1 <= HM with equality iff every row is equal.
 *     `negOneHmGap = HM - L_-1` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     series is constant. Magnitude is the **inverse-square-
 *     weighting amplification** below the rank-1-inverse-
 *     weighted HM: how much further the smallest rows pull
 *     the location when each row's weight is its own
 *     `x^{-2}` rather than its own `x^{-1}`.
 *   - **Distinct from the mean (AM)**: `negOneAmGap = mean -
 *     L_-1` is reported as a free byproduct and is **always
 *     >= 0**. This is the cumulative pull from the equal-
 *     weight average all the way to the inverse-square-
 *     weighted location — strictly larger than the
 *     mean-minus-HM gap for any non-constant positive
 *     series.
 *   - **Distinct from L_3 (v0.6.189)**: L_3 sits on the
 *     OPPOSITE side of AM, dominated by the *largest* rows.
 *     L_-1 mirrors L_3 across AM: the same machinery
 *     (Lehmer L_p = sum x^p / sum x^{p-1}) but with p flipped
 *     from +3 to -1. Together L_-1 and L_3 bracket the
 *     widest span of the integer Lehmer ladder shipped to
 *     date.
 *   - **Distinct from `source-row-token-trimean`,
 *     `source-row-token-midhinge`, `source-row-token-
 *     mid-range`, `source-row-token-trim-mean-25`**: those
 *     are L-estimators (linear combinations of order
 *     statistics) — translation- AND scale-equivariant,
 *     all live in `[min, max]`. L_-1 is non-linear in every
 *     row's value; scale-equivariant but NOT translation-
 *     equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     scale-invariant *shape* statistics built from q1/q3;
 *     L_-1 is a location in token units.
 *   - **Distinct from coefficient-of-variation / burstiness
 *     / skewness / kurtosis / gini**: those are spread- or
 *     distribution-shape statistics, not central tendency.
 *     L_-1 is genuinely a center (it equals `c` on a
 *     constant positive series).
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the dimensionless ratio max / RMS;
 *     L_-1 is the inverse-square-weighted location itself
 *     in token units.
 *
 * `negOneHmGap = HM - L_-1` and `negOneAmGap = mean - L_-1`
 * are the natural diagnostic pair: `negOneHmGap` quantifies
 * the incremental pull below HM that comes from squaring the
 * inverse weights; `negOneAmGap` quantifies the cumulative
 * pull all the way from the equal-weight average down to the
 * inverse-square-weighted location. Both are always `>= 0`,
 * both are `0` iff the series is constant. The free
 * byproducts `mean` (AM) and `harmonicMean` (HM, recomputed
 * inline so the lens is self-contained) are reported
 * alongside L_-1 as the natural references and upper bounds
 * on L_-1 by Lehmer monotonicity.
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
 *      diverges) -> `droppedZeroBearingSources`. Lehmer L_-1
 *      is undefined for any zero row.
 *   8. Compute `sumInv = sum(1/x_i)`, `sumInvSq = sum(1/x_i^2)`,
 *      `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `harmonicMean = n / sumInv`,
 *      `lehmerNegOneMean = sumInv / sumInvSq`,
 *      `negOneHmGap = HM - L_-1` (always >= 0),
 *      `negOneAmGap = mean - L_-1` (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-neg-1-mean`     (cohort)                  -> droppedBelowMinLehmerNegOneMean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sumInv = n/c, sumInvSq = n/c^2, L_-1 = c, HM = c,
 *     mean = c, negOneHmGap = 0, negOneAmGap = 0. Pinned in
 *     tests.
 *   - Any zero row: source dropped as
 *     `droppedZeroBearingSources` (1/0 diverges).
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean / quadratic-mean /
 *     contraharmonic-mean / lehmer-3-mean lenses).
 *   - Single positive row [v]: sumInv = 1/v, sumInvSq = 1/v^2,
 *     L_-1 = v, HM = v, mean = v, negOneHmGap = 0,
 *     negOneAmGap = 0. Pinned in tests.
 *   - Single tiny row dominates: [1, 1000, 1000, 1000]:
 *     sumInv = 1 + 3/1000 = 1.003, sumInvSq = 1 + 3/1_000_000
 *     ~ 1.000003, L_-1 ~ 1.003 / 1.000003 ~ 1.003. HM =
 *     4 / 1.003 ~ 3.988. AM = 750.25. L_-1 sits within ~0.3 %
 *     of the smallest row; HM at ~299 %; AM at ~75025 %.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmerNegOneMeanOptions {
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
   * Drop sources whose Lehmer L_-1 mean is strictly below
   * this value. Cohort selector. Must be a finite, non-
   * negative number. Default 0.
   */
  minLehmerNegOneMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-neg-1-mean-desc' (default): lehmerNegOneMean desc.
   *   - 'lehmer-neg-1-mean-asc':            lehmerNegOneMean asc.
   *   - 'mean-desc':                        arithmetic mean desc (compare).
   *   - 'hm-gap-desc':                      negOneHmGap desc.
   *   - 'am-gap-desc':                      negOneAmGap desc.
   *   - 'rows':                             rowsKept desc.
   *   - 'source':                           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-neg-1-mean-desc'
    | 'lehmer-neg-1-mean-asc'
    | 'mean-desc'
    | 'hm-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmerNegOneMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` positive rows. */
  mean: number;
  /** Harmonic mean = n / sum(1/x). Upper bound on L_-1 by Lehmer monotonicity. */
  harmonicMean: number;
  /** Lehmer mean of order -1 = sum(1/x) / sum(1/x^2). */
  lehmerNegOneMean: number;
  /**
   * Signed gap HM - L_-1. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negOneHmGap: number;
  /**
   * Signed gap mean - L_-1. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negOneAmGap: number;
}

export interface SourceRowTokenLehmerNegOneMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmerNegOneMean: number;
  top: number | null;
  sort:
    | 'lehmer-neg-1-mean-desc'
    | 'lehmer-neg-1-mean-asc'
    | 'mean-desc'
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
  droppedBelowMinLehmerNegOneMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmerNegOneMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-neg-1-mean-desc',
  'lehmer-neg-1-mean-asc',
  'mean-desc',
  'hm-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmerNegOneMean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmerNegOneMeanOptions = {},
): SourceRowTokenLehmerNegOneMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmerNegOneMean = opts.minLehmerNegOneMean ?? 0;
  if (!Number.isFinite(minLehmerNegOneMean) || minLehmerNegOneMean < 0) {
    throw new Error(
      `minLehmerNegOneMean must be a finite, non-negative number (got ${opts.minLehmerNegOneMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-neg-1-mean-desc';
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
  const allRows: SourceRowTokenLehmerNegOneMeanRow[] = [];
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
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const inv = 1 / v;
      sumInv += inv;
      sumInvSq += inv * inv;
      sumX += v;
    }
    const mean = sumX / n;
    const harmonicMean = n / sumInv;
    const lehmerNegOneMean = sumInv / sumInvSq;
    const negOneHmGap = harmonicMean - lehmerNegOneMean;
    const negOneAmGap = mean - lehmerNegOneMean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      harmonicMean,
      lehmerNegOneMean,
      negOneHmGap,
      negOneAmGap,
    });
  }

  let droppedBelowMinLehmerNegOneMean = 0;
  const survived: SourceRowTokenLehmerNegOneMeanRow[] = [];
  for (const row of allRows) {
    if (
      minLehmerNegOneMean > 0 &&
      row.lehmerNegOneMean < minLehmerNegOneMean
    ) {
      droppedBelowMinLehmerNegOneMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-neg-1-mean-desc')
      primary = b.lehmerNegOneMean - a.lehmerNegOneMean;
    else if (sort === 'lehmer-neg-1-mean-asc')
      primary = a.lehmerNegOneMean - b.lehmerNegOneMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'hm-gap-desc') primary = b.negOneHmGap - a.negOneHmGap;
    else if (sort === 'am-gap-desc') primary = b.negOneAmGap - a.negOneAmGap;
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
    minLehmerNegOneMean,
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
    droppedBelowMinLehmerNegOneMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
