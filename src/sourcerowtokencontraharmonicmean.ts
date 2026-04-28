/**
 * source-row-token-contraharmonic-mean: per-source
 * **contraharmonic mean** (a.k.a. **Lehmer mean of order 2**) of
 * `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least one
 * strictly positive row:
 *
 *     CHM = ( sum_{i=1..n} x_i^2 ) / ( sum_{i=1..n} x_i )
 *
 * That is: the sum of squares divided by the plain sum.
 * Equivalently, CHM is the `x_i`-weighted arithmetic mean
 * of `x_i` itself (each row weights itself by its own
 * value), so CHM = sum(x*x) / sum(x) = E_w[x] with weights
 * w_i = x_i / sum(x).
 *
 * Headline question: **for each source, what is the
 * contraharmonic mean of the per-row token distribution —
 * the size-weighted central tendency that, by Cauchy-Schwarz,
 * sits strictly above the quadratic mean (RMS) and therefore
 * extends the Pythagorean sandwich one step to the right:
 * `HM <= GM <= AM <= QM <= CHM`?**
 *
 * Properties.
 *
 *   - **Above-QM upper bound** (Cauchy-Schwarz). For any
 *     non-negative sample with at least one strictly
 *     positive row, `QM <= CHM`, with equality iff every
 *     positive row is equal (all zero rows can be ignored
 *     because they contribute nothing to either sum). This
 *     extends v0.6.187's full Pythagorean sandwich one
 *     step further to the right:
 *
 *         HM <= GM <= AM <= QM <= CHM
 *
 *     Proof sketch: Cauchy-Schwarz gives
 *     `(sum x_i)^2 <= n * sum x_i^2`, so
 *     `sum x_i^2 / sum x_i >= sum x_i / n = AM`, and a
 *     similar Cauchy-Schwarz step yields `CHM >= QM`. So
 *     CHM is the rightmost classical Pythagorean-style
 *     mean and is a strictly larger upper bound on
 *     central tendency than QM.
 *   - **Lehmer mean of order 2**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` recovers `L_0 =
 *     HM`, `L_1 = AM`, and `L_2 = CHM`. CHM is therefore
 *     the natural "one step past arithmetic" Lehmer
 *     family member; AM = L_1 sits midway between HM = L_0
 *     and CHM = L_2.
 *   - **Strictly non-negative**: CHM >= 0 for any non-
 *     negative sample with sum > 0; CHM = 0 iff every
 *     row is 0 (the all-zero series — the only case
 *     where the denominator vanishes; we report it as
 *     0 by convention via the all-zero-source guard).
 *   - **Bounded by `[mean, max]`** (when every row is
 *     non-negative): `mean <= CHM <= max`, with `CHM =
 *     mean` iff every positive row is equal and `CHM =
 *     max` iff every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling
 *     every row by `c >= 0` rescales CHM by `c`. (CHM is
 *     `(c^2 sum x_i^2) / (c sum x_i) = c * CHM_original`.)
 *   - **NOT translation-equivariant**: shifting every row
 *     by `c` does NOT shift CHM by `c`. Same qualitative
 *     break from the L-estimator suite as harmonic-mean
 *     and quadratic-mean.
 *   - **Order-invariant**: CHM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant positive series**: if all
 *     rows equal `c > 0`, then sumSq = n*c^2, sum = n*c,
 *     CHM = c^2/c = c. Pinned in tests.
 *   - **Self-weighted-mean interpretation**: CHM is the
 *     arithmetic mean of `x_i` weighted by `x_i` itself.
 *     This is the natural "size-biased" location: each
 *     row's contribution is proportional to how big it
 *     is. A single huge row dominates CHM far more than
 *     it dominates AM; a single tiny row contributes
 *     almost nothing to CHM (whereas it pulls HM toward
 *     zero and pulls QM down toward AM).
 *   - **Dominated by the largest rows even more than QM**:
 *     a single row of value `M` contributes `M^2` to the
 *     numerator and `M` to the denominator, so it pushes
 *     CHM toward `M` itself as `M -> infinity`. Compare
 *     to QM, which only goes as `M / sqrt(n)`. Concretely
 *     on `[1, 1, 1, 1, 1000]`: AM = 200.8, QM ~ 447.4,
 *     CHM = 1_000_004 / 1004 ~ 996.0 — CHM sits within
 *     0.4 % of the bottleneck row and >2x above QM.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` location lens already in the suite:
 *
 *   - **Distinct from the mean (AM)**: by Cauchy-Schwarz,
 *     CHM >= AM with equality iff every positive row is
 *     equal. `chmAmGap = CHM - AM` is reported as a free
 *     byproduct and is **always >= 0**, with `0` iff the
 *     positive part of the series is constant. Magnitude
 *     is the **size-weighting amplification** of the
 *     arithmetic mean: how much the largest rows pull
 *     the location above the equal-weight average.
 *   - **Distinct from quadratic-mean (QM)**: by Cauchy-
 *     Schwarz, CHM >= QM with equality iff every positive
 *     row is equal. `chmQmGap = CHM - QM` is reported as
 *     a free byproduct and is **always >= 0**, with `0`
 *     iff the positive part of the series is constant.
 *     Magnitude is the **above-RMS slack**: even after
 *     amplifying by squaring, QM still under-estimates
 *     the size-biased location by exactly this much.
 *     This lens completes the extended Pythagorean
 *     sandwich `HM <= GM <= AM <= QM <= CHM`.
 *   - **Distinct from harmonic-mean (HM)**: HM is the
 *     opposite end of the Lehmer family (L_0) — dominated
 *     by the *smallest* rows. CHM (L_2) is dominated by
 *     the *largest* rows. Together HM and CHM bracket the
 *     full Lehmer-family spectrum.
 *   - **Distinct from `source-row-token-trimean`,
 *     `source-row-token-midhinge`, `source-row-token-
 *     mid-range`, `source-row-token-trim-mean-25`**:
 *     those are L-estimators (linear combinations of
 *     order statistics) — translation- AND scale-
 *     equivariant, all live in `[min, max]`. CHM is
 *     non-linear in every row's value; scale-equivariant
 *     but NOT translation-equivariant.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those
 *     are scale-invariant *shape* statistics built from
 *     q1/q3; CHM is a location in token units.
 *   - **Distinct from coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those
 *     are spread- or distribution-shape statistics, not
 *     central tendency. CHM is genuinely a center (it
 *     equals `c` on a constant positive series).
 *   - **Distinct from MAD**: MAD is a spread, not a
 *     center.
 *   - **Distinct from `source-row-token-crest-factor`**:
 *     crest-factor is the dimensionless ratio max / RMS;
 *     CHM is the size-weighted location itself in token
 *     units.
 *
 * `chmAmGap = CHM - AM` and `chmQmGap = CHM - QM` are the
 * natural diagnostic pair: `chmAmGap` quantifies how much
 * the size-weighting pulls the location above the equal-
 * weight mean; `chmQmGap` quantifies how much CHM still
 * sits above the squared-weighted RMS. Both are always
 * `>= 0`, both are `0` iff the positive part of the series
 * is constant. The free byproducts `mean` (AM) and
 * `quadraticMean` (QM, recomputed inline so the lens is
 * self-contained) are reported alongside CHM as the
 * natural references and lower bounds on CHM by Cauchy-
 * Schwarz.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *      (Zero is allowed for CHM — `0^2 = 0` and `0` both
 *      contribute 0 to numerator and denominator.)
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources whose entire `sum(x) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources` and report CHM = 0
 *      conventionally? — design choice: drop, since the
 *      Lehmer L_2 is undefined for sum = 0).
 *   8. Compute `sumSq = sum(x_i^2)`, `sumX = sum(x_i)`,
 *      `mean = sumX / n`,
 *      `quadraticMean = sqrt(sumSq / n)`,
 *      `contraharmonicMean = sumSq / sumX`,
 *      `chmAmGap = CHM - mean` (always >= 0),
 *      `chmQmGap = CHM - QM` (always >= 0).
 *   9. Apply display gates:
 *      - `--min-rows`                          (absolute floor 1)         -> droppedBelowMinRows.
 *      - `--min-contraharmonic-mean`           (cohort)                   -> droppedBelowMinContraharmonicMean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c > 0):
 *     sumSq = n*c^2, sumX = n*c, CHM = c, mean = c,
 *     QM = c, chmAmGap = 0, chmQmGap = 0. Pinned in tests.
 *   - All-zero series: sumX = 0 — denominator vanishes;
 *     the source is dropped as `droppedAllZeroSources`
 *     (Lehmer L_2 is undefined when the L_1 denominator
 *     is 0).
 *   - Mixed positive/zero rows: zero rows contribute `0`
 *     to both numerator and denominator (no-op). CHM is
 *     well-defined as long as at least one row is > 0.
 *   - Negative total_tokens: dropped as
 *     droppedNegativeTokens (same convention as midhinge /
 *     trimean / iqr-ratio / bowley / cqd / mid-range /
 *     trim-mean-25 / harmonic-mean / quadratic-mean
 *     lenses).
 *   - Single positive row [v]: sumSq = v^2, sumX = v,
 *     CHM = v, QM = v, mean = v, chmAmGap = 0,
 *     chmQmGap = 0. Pinned in tests.
 *   - Single huge row dominates: [1, 1, 1, 1000]:
 *     sumSq = 1_000_003, sumX = 1003, CHM ~ 997.01,
 *     QM = 500.25, AM = 250.75. CHM sits within ~0.3 %
 *     of the bottleneck row; QM sits at ~50 % of it;
 *     AM at ~25 %.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenContraharmonicMeanOptions {
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
   * Drop sources whose contraharmonic mean is strictly below
   * this value. Cohort selector. Must be a finite, non-negative
   * number. Default 0.
   */
  minContraharmonicMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'contraharmonic-mean-desc' (default): contraharmonicMean desc.
   *   - 'contraharmonic-mean-asc':            contraharmonicMean asc.
   *   - 'mean-desc':                          arithmetic mean desc (compare).
   *   - 'gap-desc':                           chmAmGap desc.
   *   - 'qm-gap-desc':                        chmQmGap desc.
   *   - 'rows':                               rowsKept desc.
   *   - 'source':                             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'contraharmonic-mean-desc'
    | 'contraharmonic-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'qm-gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenContraharmonicMeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Quadratic mean = sqrt(sum(x^2)/n). Lower bound on CHM by Cauchy-Schwarz. */
  quadraticMean: number;
  /** Contraharmonic mean = sum(x^2) / sum(x). */
  contraharmonicMean: number;
  /**
   * Signed gap CHM - mean. Always >= 0 by Cauchy-Schwarz, with
   * equality iff the positive part of the series is constant.
   */
  chmAmGap: number;
  /**
   * Signed gap CHM - QM. Always >= 0 by Cauchy-Schwarz, with
   * equality iff the positive part of the series is constant.
   */
  chmQmGap: number;
}

export interface SourceRowTokenContraharmonicMeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minContraharmonicMean: number;
  top: number | null;
  sort:
    | 'contraharmonic-mean-desc'
    | 'contraharmonic-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'qm-gap-desc'
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
  droppedBelowMinContraharmonicMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenContraharmonicMeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'contraharmonic-mean-desc',
  'contraharmonic-mean-asc',
  'mean-desc',
  'gap-desc',
  'qm-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenContraharmonicMean(
  queue: QueueLine[],
  opts: SourceRowTokenContraharmonicMeanOptions = {},
): SourceRowTokenContraharmonicMeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minContraharmonicMean = opts.minContraharmonicMean ?? 0;
  if (!Number.isFinite(minContraharmonicMean) || minContraharmonicMean < 0) {
    throw new Error(
      `minContraharmonicMean must be a finite, non-negative number (got ${opts.minContraharmonicMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'contraharmonic-mean-desc';
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
  const allRows: SourceRowTokenContraharmonicMeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sumSq = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      sumSq += v * v;
      sumX += v;
    }
    if (sumX === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    const quadraticMean = Math.sqrt(sumSq / n);
    const contraharmonicMean = sumSq / sumX;
    const chmAmGap = contraharmonicMean - mean;
    const chmQmGap = contraharmonicMean - quadraticMean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      quadraticMean,
      contraharmonicMean,
      chmAmGap,
      chmQmGap,
    });
  }

  let droppedBelowMinContraharmonicMean = 0;
  const survived: SourceRowTokenContraharmonicMeanRow[] = [];
  for (const row of allRows) {
    if (
      minContraharmonicMean > 0 &&
      row.contraharmonicMean < minContraharmonicMean
    ) {
      droppedBelowMinContraharmonicMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'contraharmonic-mean-desc')
      primary = b.contraharmonicMean - a.contraharmonicMean;
    else if (sort === 'contraharmonic-mean-asc')
      primary = a.contraharmonicMean - b.contraharmonicMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc') primary = b.chmAmGap - a.chmAmGap;
    else if (sort === 'qm-gap-desc') primary = b.chmQmGap - a.chmQmGap;
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
    minContraharmonicMean,
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
    droppedBelowMinContraharmonicMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
