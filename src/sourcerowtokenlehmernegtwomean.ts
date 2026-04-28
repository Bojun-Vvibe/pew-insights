/**
 * source-row-token-lehmer-neg-2-mean: per-source **Lehmer mean
 * of order -2** (a.k.a. **L_-2**, the sub-sub-harmonic Lehmer
 * mean) of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row strictly positive
 * `total_tokens` samples `x_1, x_2, ..., x_n`:
 *
 *     L_-2 = ( sum_{i=1..n} x_i^{-2} ) / ( sum_{i=1..n} x_i^{-3} )
 *
 * That is: the sum of inverse squares divided by the sum of
 * inverse cubes. Equivalently, L_-2 is the `x_i^{-3}`-weighted
 * arithmetic mean of `x_i` (each row weights itself by its own
 * INVERSE cube), so
 * L_-2 = sum(x^{-2}) / sum(x^{-3}) = E_w[x] with weights
 * w_i = x_i^{-3} / sum(x_i^{-3}).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order -2 of the per-row token distribution — the
 * inverse-cube-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly below the
 * Lehmer L_-1 (v0.6.190) and therefore extends the symmetric
 * integer Lehmer ladder one further step LEFT:
 * `L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3`?**
 *
 * Properties.
 *
 *   - **Below-L_-1 upper bound** (Lehmer monotonicity). For
 *     any strictly positive sample, `L_-2 <= L_-1 <= L_0 = HM`,
 *     with equality iff every row is equal. This extends
 *     v0.6.190's Lehmer ladder one step further LEFT,
 *     completing the integer Lehmer ladder L_-2..L_3 around AM:
 *
 *         L_-2 <= L_-1 <= HM <= GM <= AM <= QM <= CHM <= L_3
 *          ^                ^                              ^
 *          |                |                              |
 *          new step left   center (L_1)                  v0.6.189
 *
 *     Proof sketch: Lehmer's mean L_p(x) is monotone non-
 *     decreasing in `p` for positive samples (a Cauchy-Schwarz
 *     argument). So L_-2 <= L_-1, with equality on a constant
 *     series.
 *   - **Lehmer mean of order -2**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers
 *     `L_-2 = sum(x^-2) / sum(x^-3)`, `L_-1`, `L_0 = HM`,
 *     `L_1 = AM`, `L_2 = CHM`, `L_3` (v0.6.189). L_-2 is the
 *     natural one-step-left Lehmer-family extension that
 *     deepens the small-row bias even further: each row weights
 *     itself by its own INVERSE CUBE, so a single tiny row
 *     pulls L_-2 toward that row's value even faster than
 *     L_-1 does.
 *   - **Strictly positive**: L_-2 > 0 for any strictly
 *     positive sample. Undefined if any row is 0 (the row's
 *     reciprocal blows up); we therefore require all rows
 *     to be strictly positive and surface zero-bearing
 *     sources as `droppedZeroBearingSources`.
 *   - **Bounded by `[min, L_-1]`** (when every row is positive):
 *     `min <= L_-2 <= L_-1`, with `L_-2 = L_-1` iff every row
 *     is equal and `L_-2 = min` iff every row equals `min`.
 *   - **Scale-equivariant** (multiplicative): rescaling every
 *     row by `c > 0` rescales L_-2 by `c`. (L_-2 becomes
 *     `(c^-2 sum x^-2) / (c^-3 sum x^-3) = c * L_-2_original`.)
 *   - **NOT translation-equivariant**: shifting every row by
 *     `c` does NOT shift L_-2 by `c`. Same qualitative break
 *     as harmonic-mean / quadratic-mean / contraharmonic-mean
 *     / lehmer-3-mean / lehmer-neg-1-mean.
 *   - **Order-invariant**: depends only on the multiset of
 *     row values.
 *   - **Identity on a constant positive series**: if all rows
 *     equal `c > 0`, then sumInvSq = n/c^2, sumInvCu = n/c^3,
 *     L_-2 = (n/c^2) / (n/c^3) = c. Pinned in tests.
 *   - **Self-inverse-cube-weighted-mean interpretation**:
 *     L_-2 is the arithmetic mean of `x_i` weighted by
 *     `x_i^{-3}` itself. This is an even more aggressively
 *     small-row-biased location than L_-1: each row's
 *     contribution is proportional to `1 / x_i^3`.
 *   - **Dominated by the smallest rows even more than L_-1**:
 *     a single row of value `m` contributes `m^-2` to the
 *     numerator and `m^-3` to the denominator, so it pushes
 *     L_-2 toward `m` itself faster than L_-1 does. Concretely
 *     on `[1, 1000, 1000, 1000]`:
 *     L_-1 ~ 1.003, L_-2 = (1 + 3/1_000_000) / (1 + 3/1e9)
 *           ~ 1.000003 / 1.000000003 ~ 1.000003 — L_-2 sits
 *     within 0.0003 % of the smallest row's value 1, vs L_-1
 *     at ~0.3 % and HM at ~299 %.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from L_-1 (v0.6.190)**: by Lehmer monotonicity,
 *     L_-2 <= L_-1 with equality iff every row is equal.
 *     `negTwoNegOneGap = L_-1 - L_-2` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     series is constant. Magnitude is the **inverse-cube-
 *     weighting amplification** below the inverse-square-
 *     weighted L_-1: how much further the smallest rows pull
 *     the location when each row's weight is its own
 *     `x^{-3}` rather than its own `x^{-2}`.
 *   - **Distinct from HM (L_0)**: `negTwoHmGap = HM - L_-2`
 *     is reported as a free byproduct and is **always >= 0**,
 *     strictly larger than v0.6.190's negOneHmGap for any
 *     non-constant positive series.
 *   - **Distinct from the mean (AM)**: `negTwoAmGap = mean -
 *     L_-2` is reported as a free byproduct and is **always
 *     >= 0**. This is the cumulative pull from the equal-
 *     weight average all the way to the inverse-cube-weighted
 *     location — strictly larger than the mean-minus-L_-1
 *     gap for any non-constant positive series.
 *   - **Distinct from L_3 (v0.6.189)**: L_3 sits on the
 *     OPPOSITE side of AM, dominated by the *largest* rows.
 *     L_-2 is dominated by the *smallest* rows. Together
 *     L_-2 and L_3 bracket the widest span of the integer
 *     Lehmer ladder shipped to date.
 *   - **Distinct from L-estimators** (mid-range / midhinge /
 *     trimean / trim-mean-25): those are translation- AND
 *     scale-equivariant, all live in `[min, max]`. L_-2 is
 *     non-linear in every row's value; scale-equivariant but
 *     NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     scale-invariant *shape* statistics built from q1/q3;
 *     L_-2 is a location in token units.
 *   - **Distinct from coefficient-of-variation / burstiness
 *     / skewness / kurtosis / gini**: those are spread- or
 *     distribution-shape statistics, not central tendency.
 *     L_-2 is genuinely a center (it equals `c` on a
 *     constant positive series).
 *
 * `negTwoNegOneGap = L_-1 - L_-2`, `negTwoHmGap = HM - L_-2`,
 * and `negTwoAmGap = mean - L_-2` form the natural diagnostic
 * triple. All three are always `>= 0`, all three are `0` iff
 * the series is constant. The free byproducts `mean` (AM),
 * `harmonicMean` (HM), and `lehmerNegOneMean` (L_-1, recomputed
 * inline so the lens is self-contained) are reported alongside
 * L_-2 as the natural references and upper bounds on L_-2 by
 * Lehmer monotonicity.
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
 *      diverges) -> `droppedZeroBearingSources`. Lehmer L_-2
 *      is undefined for any zero row.
 *   8. Compute `sumInv = sum(1/x_i)`, `sumInvSq = sum(1/x_i^2)`,
 *      `sumInvCu = sum(1/x_i^3)`, `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `harmonicMean = n / sumInv`,
 *      `lehmerNegOneMean = sumInv / sumInvSq`,
 *      `lehmerNegTwoMean = sumInvSq / sumInvCu`,
 *      `negTwoNegOneGap = L_-1 - L_-2` (always >= 0),
 *      `negTwoHmGap = HM - L_-2`        (always >= 0),
 *      `negTwoAmGap = mean - L_-2`      (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                  (absolute floor 1)        -> droppedBelowMinRows.
 *      - `--min-lehmer-neg-2-mean`     (cohort)                  -> droppedBelowMinLehmerNegTwoMean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sumInvSq = n/c^2, sumInvCu = n/c^3, L_-2 = c, L_-1 = c,
 *     HM = c, mean = c, all gaps = 0. Pinned in tests.
 *   - Any zero row: source dropped as
 *     `droppedZeroBearingSources` (1/0 diverges).
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean / quadratic-mean /
 *     contraharmonic-mean / lehmer-3-mean / lehmer-neg-1-mean
 *     lenses).
 *   - Single positive row [v]: sumInv = 1/v, sumInvSq = 1/v^2,
 *     sumInvCu = 1/v^3, L_-2 = v, L_-1 = v, HM = v, mean = v,
 *     all gaps = 0. Pinned in tests.
 *   - Single tiny row dominates: [1, 1000, 1000, 1000]:
 *     sumInvSq = 1 + 3e-6, sumInvCu = 1 + 3e-9,
 *     L_-2 ~ 1.000003. L_-1 ~ 1.003. HM ~ 3.988. AM = 750.25.
 *     L_-2 sits within ~0.0003 % of the smallest row.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmerNegTwoMeanOptions {
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
   * Drop sources whose Lehmer L_-2 mean is strictly below
   * this value. Cohort selector. Must be a finite, non-
   * negative number. Default 0.
   */
  minLehmerNegTwoMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lehmer-neg-2-mean-desc' (default): lehmerNegTwoMean desc.
   *   - 'lehmer-neg-2-mean-asc':            lehmerNegTwoMean asc.
   *   - 'mean-desc':                        arithmetic mean desc (compare).
   *   - 'neg-one-gap-desc':                 negTwoNegOneGap desc.
   *   - 'hm-gap-desc':                      negTwoHmGap desc.
   *   - 'am-gap-desc':                      negTwoAmGap desc.
   *   - 'rows':                             rowsKept desc.
   *   - 'source':                           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'lehmer-neg-2-mean-desc'
    | 'lehmer-neg-2-mean-asc'
    | 'mean-desc'
    | 'neg-one-gap-desc'
    | 'hm-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLehmerNegTwoMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` positive rows. */
  mean: number;
  /** Harmonic mean = n / sum(1/x). Upper bound on L_-2 by Lehmer monotonicity. */
  harmonicMean: number;
  /** Lehmer L_-1 = sum(1/x) / sum(1/x^2). Upper bound on L_-2. */
  lehmerNegOneMean: number;
  /** Lehmer mean of order -2 = sum(1/x^2) / sum(1/x^3). */
  lehmerNegTwoMean: number;
  /**
   * Signed gap L_-1 - L_-2. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negTwoNegOneGap: number;
  /**
   * Signed gap HM - L_-2. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negTwoHmGap: number;
  /**
   * Signed gap mean - L_-2. Always >= 0 by Lehmer monotonicity,
   * with equality iff the series is constant.
   */
  negTwoAmGap: number;
}

export interface SourceRowTokenLehmerNegTwoMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmerNegTwoMean: number;
  top: number | null;
  sort:
    | 'lehmer-neg-2-mean-desc'
    | 'lehmer-neg-2-mean-asc'
    | 'mean-desc'
    | 'neg-one-gap-desc'
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
  droppedBelowMinLehmerNegTwoMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmerNegTwoMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-neg-2-mean-desc',
  'lehmer-neg-2-mean-asc',
  'mean-desc',
  'neg-one-gap-desc',
  'hm-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmerNegTwoMean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmerNegTwoMeanOptions = {},
): SourceRowTokenLehmerNegTwoMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmerNegTwoMean = opts.minLehmerNegTwoMean ?? 0;
  if (!Number.isFinite(minLehmerNegTwoMean) || minLehmerNegTwoMean < 0) {
    throw new Error(
      `minLehmerNegTwoMean must be a finite, non-negative number (got ${opts.minLehmerNegTwoMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-neg-2-mean-desc';
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
  const allRows: SourceRowTokenLehmerNegTwoMeanRow[] = [];
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
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const inv = 1 / v;
      const invSq = inv * inv;
      sumInv += inv;
      sumInvSq += invSq;
      sumInvCu += invSq * inv;
      sumX += v;
    }
    const mean = sumX / n;
    const harmonicMean = n / sumInv;
    const lehmerNegOneMean = sumInv / sumInvSq;
    const lehmerNegTwoMean = sumInvSq / sumInvCu;
    const negTwoNegOneGap = lehmerNegOneMean - lehmerNegTwoMean;
    const negTwoHmGap = harmonicMean - lehmerNegTwoMean;
    const negTwoAmGap = mean - lehmerNegTwoMean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      harmonicMean,
      lehmerNegOneMean,
      lehmerNegTwoMean,
      negTwoNegOneGap,
      negTwoHmGap,
      negTwoAmGap,
    });
  }

  let droppedBelowMinLehmerNegTwoMean = 0;
  const survived: SourceRowTokenLehmerNegTwoMeanRow[] = [];
  for (const row of allRows) {
    if (
      minLehmerNegTwoMean > 0 &&
      row.lehmerNegTwoMean < minLehmerNegTwoMean
    ) {
      droppedBelowMinLehmerNegTwoMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-neg-2-mean-desc')
      primary = b.lehmerNegTwoMean - a.lehmerNegTwoMean;
    else if (sort === 'lehmer-neg-2-mean-asc')
      primary = a.lehmerNegTwoMean - b.lehmerNegTwoMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'neg-one-gap-desc')
      primary = b.negTwoNegOneGap - a.negTwoNegOneGap;
    else if (sort === 'hm-gap-desc') primary = b.negTwoHmGap - a.negTwoHmGap;
    else if (sort === 'am-gap-desc') primary = b.negTwoAmGap - a.negTwoAmGap;
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
    minLehmerNegTwoMean,
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
    droppedBelowMinLehmerNegTwoMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
