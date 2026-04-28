/**
 * source-row-token-coefficient-of-quartile-deviation: per-source
 * **coefficient of quartile deviation** (CQD) of `total_tokens`
 * across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens` samples,
 * with type-7 quantiles `q1 = Q(0.25)`, `q3 = Q(0.75)`, the
 * coefficient of quartile deviation is:
 *
 *     CQD = (q3 - q1) / (q3 + q1)
 *
 * Headline question: **for each source, how spread out is the
 * middle 50 % of per-row token magnitudes relative to the central
 * tendency, on a hard-bounded `[0, 1]` scale that is immune to
 * single-row outliers and that does NOT divide by the median?**
 *
 * Properties.
 *
 *   - For non-negative data (which `total_tokens` always is — we
 *     drop negative rows under `droppedNegativeTokens`), q1 >= 0
 *     and q3 >= 0, so q3 + q1 >= 0 and CQD lies in `[0, 1]`.
 *     - `CQD = 0` iff q1 = q3 (the central 50 % collapses to a
 *       single value).
 *     - `CQD = 1` iff q1 = 0 and q3 > 0 (the lower quartile sits
 *       on zero — at least 25 % of rows carry zero tokens).
 *   - **Scale-invariant**: rescaling all rows by `c > 0` leaves CQD
 *     unchanged (q1 and q3 both scale by c; the ratio is invariant).
 *   - **Order-invariant**: CQD depends only on the multiset of
 *     row values, not on row order.
 *   - **Robust**: built from three order statistics; a single
 *     arbitrarily-large row cannot move it (unlike CV, which is
 *     unbounded above and dominated by extreme rows).
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-iqr-ratio` reports `(q3 - q1) / median`.
 *     Same numerator (the IQR), but the denominator is the
 *     **median (Q2)**, not `q3 + q1`. Two sources can share an
 *     identical iqr-ratio and have very different CQD — for
 *     example, a tightly-clustered distribution where median is
 *     very close to Q1 will have a small iqr but the median can
 *     be small enough that iqr/median is inflated, while
 *     iqr/(q3+q1) is bounded by 1. iqr-ratio is *unbounded above*
 *     (it can exceed 1 for any source where the IQR is wider than
 *     the median) and is *undefined* (forced null) when median=0.
 *     CQD is hard-bounded in `[0, 1]`, never undefined for any
 *     source with at least one strictly-positive q3, and treats
 *     "lower quartile sits on zero" as the natural saturation
 *     point CQD=1 rather than an undefined edge case. This is the
 *     concrete operational difference: the two lenses can give
 *     opposite source rankings when one source has small median
 *     vs another with median ~ q3.
 *   - `source-row-token-bowley-skewness` uses the same three
 *     quantiles `(q1, q2, q3)` to measure **direction** of central
 *     skew `(q1 + q3 - 2*q2) / iqr`. CQD is direction-blind: two
 *     sources can share `CQD = 0.6` and have Bowley = +0.8 vs
 *     Bowley = -0.8.
 *   - `source-row-token-mad` is `median(|x_i - median|) / median`
 *     (or just `median(|x_i - median|)` depending on
 *     normalisation): a robust **mean-absolute-deviation** flavour
 *     using all rows, then summarised by a median of deviations.
 *     CQD uses only the three order statistics (q1, q3) and
 *     deliberately discards both tails (bottom 25 %, top 25 %).
 *     Two distributions can share an identical MAD and have wildly
 *     different CQD when the bottom-25 % / top-25 % shape differs
 *     from the central shape.
 *   - `source-row-token-coefficient-of-variation` is `sigma / mu`,
 *     a **moment-based** dispersion (mean and stddev). One huge
 *     row inflates both mu and sigma; CV is unbounded above, has
 *     50 %-breakdown 0 %, and is dominated by extreme rows. CQD
 *     uses only Q1 and Q3 (50 %-breakdown), is hard-bounded in
 *     [0, 1], and a single huge row leaves it unchanged.
 *   - `source-row-token-burstiness-coefficient` is
 *     `(sigma - mu) / (sigma + mu)` in `[-1, +1]`. CQD has the
 *     same `(b - a) / (b + a)` algebraic form but with order
 *     statistics (q3 - q1) / (q3 + q1) instead of moments
 *     (sigma - mu) / (sigma + mu). The two ranks can disagree
 *     because the moment-based form is dominated by outliers and
 *     the quantile-based form is not. They also have different
 *     bounds and different anchor regimes (B = 0 ~ Poisson;
 *     CQD = 0.5 has no comparable special meaning).
 *   - `source-row-token-gini` is a **Lorenz** concentration index
 *     integrating pairwise differences over the whole distribution
 *     (a 100 %-breakdown sample-size-weighted dispersion). CQD
 *     uses three order statistics. Both lie in [0, 1] but a
 *     symmetric-uniform distribution has Gini = 1/3 and
 *     CQD = 1/3 only by coincidence at specific shapes; in
 *     general the two ranks disagree.
 *   - `source-row-token-kurtosis` / `-skewness` are **shape
 *     moments**, not dispersion.
 *   - all order-sensitive lenses (`-autocorrelation-lag1`,
 *     `-runs-test`, `-turning-point-count`, `-mann-kendall-trend`,
 *     `-permutation-entropy`, `-sample-entropy`, `-hurst-rs`,
 *     `-dfa`, `-higuchi-fd`, `-petrosian-fd`, `-katz-fd`,
 *     `-hjorth-mobility`, `-hjorth-complexity`, `-spectral-*`,
 *     `-zero-crossing-rate`, `-teager-kaiser`, `-lempel-ziv`,
 *     `-renyi-entropy`, `-temporal-*`): shuffling rows leaves CQD
 *     unchanged but moves all of them.
 *   - `bucket-token-gini`, `daily-token-gini-coefficient`: different
 *     grain (per-bucket / per-day totals, not per-row), different
 *     functional form.
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
 *   7. Sort ascending; compute Q1, Q3 with the type-7 (linear-
 *      interpolation) quantile estimator. Compute `iqr = q3 - q1`,
 *      `qsum = q3 + q1`.
 *   8. CQD:
 *      - `qsum > 0`:                cqd = iqr / qsum
 *      - `qsum = 0` (degenerate):   cqd = 0, `degenerate = true`.
 *        This happens iff q1 = q3 = 0, i.e. at least 75 % of rows
 *        carry zero tokens. CQD is mathematically `0/0` here;
 *        reporting 0 keeps the column numeric and the operator
 *        reads `degenerate=true` for the special case.
 *   9. Apply display gates:
 *      - `--min-rows`     (absolute floor 4)            -> droppedBelowMinRows.
 *      - `--min-q3`       (suppress tiny-row sources)   -> droppedBelowMinQ3.
 *      - `--min-cqd`      (cohort: only meaningfully
 *                          dispersed sources; degenerate
 *                          rows have CQD=0 and are dropped
 *                          by any positive floor — counted
 *                          as droppedDegenerate, not as
 *                          droppedBelowMinCqd, so the
 *                          operator can distinguish
 *                          "filtered for dispersion" from
 *                          "no usable CQD signal at all").
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (e.g. all 100): q1 = q3 = 100;
 *     iqr = 0; qsum = 200; CQD = 0 / 200 = 0 (NOT degenerate).
 *   - All-zero series: q1 = q3 = 0; iqr = 0; qsum = 0;
 *     CQD = 0 (degenerate=true).
 *   - At least 25 % zeros, q3 > 0: q1 = 0; CQD = q3 / q3 = 1.
 *     Hard upper saturation. The lens reports CQD = 1 cleanly;
 *     the operator reads "lower quartile sits on zero — at least
 *     25 % of rows are zero-token rows".
 *   - Symmetric (q1 = a, q3 = b, a < b, 2*median = a + b):
 *     CQD = (b - a) / (b + a), Bowley = 0. CQD ranks dispersion;
 *     Bowley says the dispersion is symmetric around the median.
 *     The two lenses partition the (q1, q2, q3) signal cleanly:
 *     CQD = "how wide" (bounded), Bowley = "which side"
 *     (bounded).
 *   - Negative total_tokens: dropped (same convention as iqr-ratio
 *     and bowley lenses). For non-negative data, q3 + q1 >= 0 is
 *     guaranteed; allowing negatives would make `q3 + q1` go
 *     negative and break the [0, 1] bound.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenCoefficientOfQuartileDeviationOptions {
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
   * Drop sources whose Q3 (75th percentile) of per-row `total_tokens`
   * is strictly below this value. Cohort filter for "tiny producer
   * noise" — the natural anchor for a CQD lens (median can be 0
   * even when q3 > 0; q3 itself is the right "is there any usable
   * upper-half magnitude" gate). Must be a finite, non-negative
   * number. Default 0.
   */
  minQ3?: number;
  /**
   * Drop sources whose CQD is strictly below this value.
   * Useful for surfacing only meaningfully dispersed sources
   * (e.g. `--min-cqd 0.5` hides everything whose central 50 % is
   * tightly clustered). With f > 0, `degenerate` rows (CQD=0
   * because q3+q1=0) are also dropped but counted under
   * `droppedDegenerate`, not `droppedBelowMinCqd`. Must be in
   * `[0, 1]`. Default 0.
   */
  minCqd?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'cqd-desc' (default): cqd desc (most dispersed central half first).
   *   - 'cqd-asc':            cqd asc  (most clustered central half first).
   *   - 'iqr-desc':           iqr desc.
   *   - 'q3-desc':            q3 desc.
   *   - 'rows':               rowsKept desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'cqd-desc'
    | 'cqd-asc'
    | 'iqr-desc'
    | 'q3-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenCoefficientOfQuartileDeviationRow {
  source: string;
  rowsKept: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  qsum: number;
  /** Coefficient of quartile deviation. 0 (with degenerate=true) iff q3+q1=0. */
  cqd: number;
  /** True iff q3+q1=0 (q1=q3=0); CQD forced to 0 (mathematically 0/0). */
  degenerate: boolean;
}

export interface SourceRowTokenCoefficientOfQuartileDeviationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minQ3: number;
  minCqd: number;
  top: number | null;
  sort:
    | 'cqd-desc'
    | 'cqd-asc'
    | 'iqr-desc'
    | 'q3-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinQ3: number;
  droppedBelowMinCqd: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenCoefficientOfQuartileDeviationRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'cqd-desc',
  'cqd-asc',
  'iqr-desc',
  'q3-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation (type-7) quantile of an already-sorted ascending
 * array `xs`. `p` in `[0, 1]`. Matches numpy.quantile's default and R's
 * `quantile(..., type = 7)`. Same helper as in
 * `sourcerowtokenbowleyskewness.ts` / `sourcerowtokeniqrratio.ts` —
 * duplicated here to keep this module self-contained (no cross-lens
 * import dependency).
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

export function buildSourceRowTokenCoefficientOfQuartileDeviation(
  queue: QueueLine[],
  opts: SourceRowTokenCoefficientOfQuartileDeviationOptions = {},
): SourceRowTokenCoefficientOfQuartileDeviationReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minQ3 = opts.minQ3 ?? 0;
  if (!Number.isFinite(minQ3) || minQ3 < 0) {
    throw new Error(
      `minQ3 must be a finite, non-negative number (got ${opts.minQ3})`,
    );
  }
  const minCqd = opts.minCqd ?? 0;
  if (!Number.isFinite(minCqd) || minCqd < 0 || minCqd > 1) {
    throw new Error(
      `minCqd must be a finite number in [0, 1] (got ${opts.minCqd})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'cqd-desc';
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
  const allRows: SourceRowTokenCoefficientOfQuartileDeviationRow[] = [];
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
    const iqr = q3 - q1;
    const qsum = q3 + q1;

    let cqd: number;
    let degenerate: boolean;
    if (qsum === 0) {
      cqd = 0;
      degenerate = true;
    } else {
      cqd = iqr / qsum;
      degenerate = false;
    }

    allRows.push({
      source,
      rowsKept: n,
      q1,
      median,
      q3,
      iqr,
      qsum,
      cqd,
      degenerate,
    });
  }

  let droppedBelowMinQ3 = 0;
  let droppedBelowMinCqd = 0;
  let droppedDegenerate = 0;
  const survived: SourceRowTokenCoefficientOfQuartileDeviationRow[] = [];
  for (const row of allRows) {
    if (minQ3 > 0 && row.q3 < minQ3) {
      droppedBelowMinQ3 += 1;
      continue;
    }
    if (minCqd > 0) {
      if (row.degenerate) {
        // Forced-zero CQD: drop under "degenerate" bucket so the
        // operator can distinguish "filtered for dispersion" from
        // "this source has no usable CQD signal at all (q3+q1=0)".
        droppedDegenerate += 1;
        continue;
      }
      if (row.cqd < minCqd) {
        droppedBelowMinCqd += 1;
        continue;
      }
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'cqd-desc') primary = b.cqd - a.cqd;
    else if (sort === 'cqd-asc') primary = a.cqd - b.cqd;
    else if (sort === 'iqr-desc') primary = b.iqr - a.iqr;
    else if (sort === 'q3-desc') primary = b.q3 - a.q3;
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
    minQ3,
    minCqd,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinQ3,
    droppedBelowMinCqd,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
