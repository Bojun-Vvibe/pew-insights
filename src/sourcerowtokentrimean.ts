/**
 * source-row-token-trimean: per-source **Tukey trimean** of
 * `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples, with type-7 quantiles `q1 = Q(0.25)`,
 * `q2 = Q(0.50)` (median), `q3 = Q(0.75)`, the Tukey
 * trimean (Tukey, 1977, "Exploratory Data Analysis") is:
 *
 *     TM = (q1 + 2*q2 + q3) / 4
 *
 * Headline question: **for each source, what is the robust
 * central magnitude of per-row token usage — a weighted blend
 * of the median (weight 1/2) and the midhinge (q1+q3)/2
 * (weight 1/2) — that absorbs both light-tail asymmetry and
 * single-row outliers, on the same units as `total_tokens`?**
 *
 * Properties.
 *
 *   - **Robust central tendency**, breakdown 25 %: a single
 *     arbitrarily-large row cannot move TM until at least
 *     25 % of rows are pushed past it. The mean has 0 %
 *     breakdown; the median has 50 % breakdown. TM sits
 *     between them and is a Tukey-recommended L-estimator
 *     for moderately heavy-tailed data.
 *   - **Lies in [q1, q3]** (always between the 25th and 75th
 *     percentiles): both `(q1 + 2q2 + q3) / 4 >= q1` and
 *     `<= q3` follow from `q1 <= q2 <= q3` and convex
 *     combination. So for non-negative data, TM >= 0.
 *   - **Translation- and scale-equivariant**: shifting all
 *     rows by `c` shifts TM by `c`; rescaling by `c > 0`
 *     rescales TM by `c`. (Unlike CQD / Bowley which are
 *     scale-invariant — those measure shape, TM measures
 *     location.)
 *   - **Order-invariant**: TM depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c`, then q1 = q2 = q3 = c so TM = c. (Same as mean
 *     and median.)
 *   - **Equals the median for any symmetric distribution**:
 *     symmetric => q3 - q2 == q2 - q1, so q1 + q3 = 2*q2 and
 *     TM = (2*q2 + 2*q2) / 4 = q2. Trimean's added value is
 *     for asymmetric data: it shifts towards the longer tail
 *     by exactly half the gap between midhinge and median.
 *   - **Always finite for any non-empty series**: no division,
 *     never undefined. (CQD divides by q3+q1 and is
 *     mathematically 0/0 on an all-zero series; trimean is
 *     simply 0 there.)
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - **No existing lens reports a robust central-tendency
 *     scalar in the same units as total_tokens.** The
 *     percentile lens `source-output-tokens-per-row-
 *     percentiles` reports the raw P50/P75/P90/P99 of
 *     `output_tokens` (different field) and exposes them
 *     individually — it does not blend them into a single
 *     L-estimator and does not anchor on `total_tokens`.
 *     `source-row-token-mad` reports the median of absolute
 *     deviations (a *spread* statistic, not a center).
 *     None of the recent shape lenses (kurtosis, skewness,
 *     bowley, cqd, iqr-ratio, coefficient-of-variation,
 *     burstiness-coefficient, gini, mad, *-fd, hjorth-*,
 *     spectral-*, temporal-*) is a location estimator.
 *   - **Distinct from the mean** (no current lens exposes
 *     the per-source mean of total_tokens directly as a
 *     headline scalar; mean is implied inside CV, burstiness,
 *     skewness, kurtosis as a divisor or moment center, but
 *     never reported as the central question). Trimean and
 *     mean disagree on any non-symmetric distribution; one
 *     huge row moves the mean arbitrarily far while leaving
 *     TM unchanged.
 *   - **Distinct from the median**: trimean equals the median
 *     for symmetric distributions but shifts towards the
 *     longer tail for skewed distributions. Two sources can
 *     share an identical median and have very different
 *     trimeans (the one with the heavier upper tail will have
 *     trimean > median).
 *   - **Distinct from the midhinge** `(q1 + q3) / 2`: trimean
 *     gives the median weight 1/2 and the midhinge weight 1/2,
 *     so TM and midhinge agree only when the median equals the
 *     midhinge (i.e. perfectly symmetric central half).
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     all *shape* statistics built from the same three
 *     quantiles. CQD is direction-blind dispersion in [0,1];
 *     Bowley is direction in [-1, +1]; IQR-ratio is unbounded
 *     dispersion / median. Trimean is *location* in the same
 *     units as total_tokens (counts, not ratios).
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — need at least
 *      one observation per quartile slot for meaningful Q1/Q3).
 *   7. Sort ascending; compute Q1, median, Q3 with the type-7
 *      (linear-interpolation) quantile estimator. Compute
 *      `trimean = (q1 + 2*median + q3) / 4` and `midhinge =
 *      (q1 + q3) / 2`.
 *   8. The trimean - median signed gap (positive = upper tail
 *      heavier than lower tail) is a free byproduct; report it
 *      as `tmMedianGap` for cohort-level skew triage without
 *      requiring the operator to also run the bowley lens.
 *   9. Apply display gates:
 *      - `--min-rows`     (absolute floor 4)            -> droppedBelowMinRows.
 *      - `--min-trimean`  (cohort: only sources with
 *                          meaningful central magnitude;
 *                          finite, non-negative)        -> droppedBelowMinTrimean.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c): q1 = q2 = q3 = c;
 *     trimean = c; midhinge = c; tmMedianGap = 0.
 *   - All-zero series: q1 = q2 = q3 = 0; trimean = 0;
 *     midhinge = 0; tmMedianGap = 0. (No degeneracy — trimean
 *     is well-defined; the operator can spot all-zero sources
 *     by `trimean == 0` paired with `q3 == 0`.)
 *   - At least 25 % zeros, q3 > 0: q1 = 0; trimean = (2*q2 + q3) / 4.
 *     Trimean still finite and well-bounded.
 *   - Symmetric: trimean == median (additional invariant
 *     pinned in the property tests).
 *   - Negative total_tokens: dropped (same convention as
 *     iqr-ratio, bowley, cqd lenses). Trimean would still be
 *     mathematically well-defined for signed data, but the
 *     pew domain only emits non-negative totals; allowing
 *     negatives would break the "trimean >= 0" invariant.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenTrimeanOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (one observation per quartile slot).
   * Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose trimean is strictly below this value.
   * Cohort selector for "this source actually carries non-trivial
   * central token magnitude" — useful to hide low-volume noise
   * sources before ranking. Must be a finite, non-negative number.
   * Default 0.
   */
  minTrimean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'trimean-desc' (default): trimean desc (largest central magnitude first).
   *   - 'trimean-asc':            trimean asc.
   *   - 'median-desc':            median desc (compare with trimean ranking).
   *   - 'gap-desc':               |tmMedianGap| desc (most asymmetric first).
   *   - 'rows':                   rowsKept desc.
   *   - 'source':                 source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'trimean-desc'
    | 'trimean-asc'
    | 'median-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTrimeanRow {
  source: string;
  rowsKept: number;
  q1: number;
  median: number;
  q3: number;
  /** Midhinge (q1 + q3) / 2 — Tukey's two-quantile center. */
  midhinge: number;
  /** Tukey trimean (q1 + 2*median + q3) / 4. */
  trimean: number;
  /**
   * Signed gap trimean - median. Positive means the trimean
   * is pulled above the median (upper central half heavier),
   * which is a robust skew direction signal. Zero on any
   * symmetric central half. Bounded by [-(q3-q1)/4, +(q3-q1)/4]
   * since trimean = median + (midhinge - median)/2.
   */
  tmMedianGap: number;
}

export interface SourceRowTokenTrimeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minTrimean: number;
  top: number | null;
  sort:
    | 'trimean-desc'
    | 'trimean-asc'
    | 'median-desc'
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
  droppedBelowMinTrimean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTrimeanRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'trimean-desc',
  'trimean-asc',
  'median-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation (type-7) quantile of an already-sorted
 * ascending array `xs`. `p` in `[0, 1]`. Matches numpy.quantile's
 * default and R's `quantile(..., type = 7)`. Same helper as in
 * `sourcerowtokenbowleyskewness.ts` /
 * `sourcerowtokencoefficientofquartiledeviation.ts` — duplicated
 * here to keep this module self-contained (no cross-lens import
 * dependency).
 */
function quantileType7(xs: number[], p: number): number {
  const n = xs.length;
  if (n === 0) throw new Error('quantileType7: empty input');
  if (n === 1) return xs[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return xs[lo]!;
  return xs[lo]! + (h - lo) * (xs[hi]! - xs[lo]!);
}

export function buildSourceRowTokenTrimean(
  queue: QueueLine[],
  opts: SourceRowTokenTrimeanOptions = {},
): SourceRowTokenTrimeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minTrimean = opts.minTrimean ?? 0;
  if (!Number.isFinite(minTrimean) || minTrimean < 0) {
    throw new Error(
      `minTrimean must be a finite, non-negative number (got ${opts.minTrimean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'trimean-desc';
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
  const allRows: SourceRowTokenTrimeanRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const q1 = quantileType7(sorted, 0.25);
    const median = quantileType7(sorted, 0.5);
    const q3 = quantileType7(sorted, 0.75);
    const midhinge = (q1 + q3) / 2;
    const trimean = (q1 + 2 * median + q3) / 4;
    const tmMedianGap = trimean - median;

    allRows.push({
      source,
      rowsKept: n,
      q1,
      median,
      q3,
      midhinge,
      trimean,
      tmMedianGap,
    });
  }

  let droppedBelowMinTrimean = 0;
  const survived: SourceRowTokenTrimeanRow[] = [];
  for (const row of allRows) {
    if (minTrimean > 0 && row.trimean < minTrimean) {
      droppedBelowMinTrimean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'trimean-desc') primary = b.trimean - a.trimean;
    else if (sort === 'trimean-asc') primary = a.trimean - b.trimean;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.tmMedianGap) - Math.abs(a.tmMedianGap);
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
    minTrimean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinTrimean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
