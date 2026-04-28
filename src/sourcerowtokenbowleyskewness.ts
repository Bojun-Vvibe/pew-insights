/**
 * source-row-token-bowley-skewness: per-source robust quartile-based
 * skewness (Bowley / Yule–Kendall coefficient) of the per-row
 * `total_tokens` distribution.
 *
 * Headline question: **for each source, is the central 50 % of the
 * per-row total_tokens distribution symmetric around the median, or
 * is it pulled toward the right (long upper half) or the left (long
 * lower half)?** — measured by *order statistics*, immune to the
 * single-outlier sensitivity that wrecks the Fisher–Pearson moment
 * skewness g1.
 *
 * Definition. Given the per-source per-row `total_tokens` samples,
 * with type-7 quantiles `q1 = Q(0.25)`, `q2 = Q(0.5)` (median),
 * `q3 = Q(0.75)`, the Bowley quartile skewness is:
 *
 *     B = ((q3 - q2) - (q2 - q1)) / (q3 - q1)
 *       = (q1 + q3 - 2 * q2) / (q3 - q1)
 *
 * - `B = 0`  symmetric central 50 % (median sits exactly midway
 *           between Q1 and Q3).
 * - `B > 0`  right-skewed central half (upper quartile gap
 *           `q3 - q2` is wider than the lower gap `q2 - q1`).
 * - `B < 0`  left-skewed central half (lower quartile gap is wider).
 * - `B` is bounded in `[-1, +1]` by construction (the two halves of
 *   the IQR cannot each exceed the IQR), unlike Fisher–Pearson g1
 *   which is unbounded above.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens:
 *
 *   - `source-row-token-skewness` (Fisher–Pearson g1) is the **third
 *     standardised moment** of the *whole* distribution; a single
 *     huge row inflates `m3 / s^3` arbitrarily. Bowley uses only
 *     three order statistics (Q1, median, Q3) and is hard-bounded
 *     in `[-1, +1]` — a 50 %-breakdown robust analog of g1. Two
 *     sources can have identical g1 ranks and very different
 *     Bowley ranks (and vice versa) when the asymmetry is in the
 *     tail vs. in the central half.
 *   - `source-row-token-kurtosis` is the **fourth** standardised
 *     moment; tail weight, not asymmetry. Bowley says nothing
 *     about kurtosis: a symmetric heavy-tailed distribution has
 *     `B = 0` and large g2.
 *   - `source-row-token-iqr-ratio` reports `(q3 - q1) / median` —
 *     the **width** of the central 50 % relative to the median.
 *     Bowley uses the same three quantiles but answers a different
 *     question: not how *wide* the central 50 % is, but how
 *     *off-centre* the median sits within it. Two sources can
 *     share `iqrRatio = 1.0` and have `B = +0.8` and `B = -0.8`
 *     respectively (median at 10 % and 90 % of the IQR).
 *   - `source-row-token-mad` is a robust **dispersion** stat
 *     (median of absolute deviations); blind to direction.
 *   - `source-row-token-gini` is a Lorenz **concentration** index;
 *     a perfectly symmetric uniform distribution has `gini ~ 0.33`
 *     and `B = 0`.
 *   - `source-row-token-coefficient-of-variation`, `-burstiness-
 *     coefficient`, `-fano-factor`: all moment-based dispersion;
 *     blind to skew direction.
 *   - `source-row-token-mean-to-median` (if it existed) would be
 *     `(mean - median) / mean` — also a skew sense, but driven by
 *     the *whole* upper tail and not bounded. Bowley discards the
 *     outer 50 % entirely.
 *   - `source-row-token-autocorrelation-lag1`, `-runs-test`,
 *     `-turning-point-count`, `-mann-kendall-trend`,
 *     `-permutation-entropy`, `-sample-entropy`, `-hurst-rs`,
 *     `-dfa`, `-higuchi-fd`, `-petrosian-fd`, `-katz-fd`,
 *     `-hjorth-mobility`, `-hjorth-complexity`, `-spectral-*`,
 *     `-zero-crossing-rate`, `-teager-kaiser`, `-lempel-ziv`,
 *     `-renyi-entropy`: all **order-sensitive**; shuffling rows
 *     leaves Bowley unchanged but moves every order-sensitive
 *     lens.
 *   - `hour-of-day-token-skew` is g1 on per-day totals grouped by
 *     hour, **pooled across all sources**; different grain (day,
 *     not row), different aggregation (per-hour totals, not raw
 *     rows), and not per-source.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`        -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`      -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`        -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> `'unknown'`).
 *   6. Per source: skip if `n < minRows` (default 4 — need at least
 *      one observation per quartile slot for a meaningful Q1/Q3).
 *   7. Sort ascending; compute Q1, median, Q3 with the type-7
 *      (linear-interpolation) quantile estimator (the same one
 *      `source-row-token-iqr-ratio` uses). Compute `iqr = q3 - q1`.
 *   8. Bowley skewness `B`:
 *      - `iqr > 0`:                B = (q1 + q3 - 2 * q2) / iqr
 *      - `iqr = 0` (degenerate):   B = 0, `degenerate = true`
 *        (q1 = q2 = q3; the central 50 % collapses to a single
 *        value; Bowley is mathematically `0/0`. Reporting 0 keeps
 *        the column numeric and the operator can read the
 *        `degenerate` flag to know the value was forced.)
 *   9. Apply display gates:
 *      - `--min-rows`         (absolute floor 4)            -> droppedBelowMinRows.
 *      - `--min-median`       (suppress tiny-row sources)   -> droppedBelowMinMedian.
 *      - `--min-abs-bowley`   (cohort: only meaningfully
 *                              asymmetric sources; degenerate
 *                              rows have Bowley=0 and are dropped
 *                              by any positive floor — counted as
 *                              droppedDegenerate, not as
 *                              droppedBelowMinAbsBowley, so the
 *                              operator sees they were dropped
 *                              for *what they are*, not for *how
 *                              skewed they are*).
 *  10. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal series:                q1 = q2 = q3 = c; iqr = 0;
 *     Bowley reported as `0` with `degenerate = true`.
 *   - Bimodal symmetric (e.g. half 100 / half 1000): q1 = 100,
 *     q2 ∈ {midpoint of central two values}, q3 = 1000; B is
 *     small (often exactly 0 by symmetry). Validates "symmetry"
 *     reading: even with an obviously bimodal histogram, if the
 *     median is centred Bowley reads 0.
 *   - Right-tailed (lognormal-like) distribution with heavy upper
 *     tail: median pulled toward Q1, so `(q3 - q2) > (q2 - q1)`
 *     and `B > 0`.
 *   - Bound check: `|B| <= 1` always. The implementation does not
 *     clamp; the algebra guarantees the bound (because both
 *     `(q3 - q2)` and `(q2 - q1)` are non-negative and sum to
 *     `iqr`, so their difference is in `[-iqr, +iqr]`).
 *   - Negative `total_tokens`: dropped (same convention as the
 *     iqr-ratio lens). A negative magnitude breaks the
 *     interpretation of "robust skew of a non-negative usage
 *     scalar" and is almost certainly a parser bug upstream.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenBowleySkewnessOptions {
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
   * Drop sources whose median per-row `total_tokens` is strictly
   * below this value. Cohort filter for "tiny producer noise".
   * Must be a finite, non-negative number. Default 0.
   */
  minMedian?: number;
  /**
   * Drop sources whose `|bowley|` is strictly below this value.
   * Useful for surfacing only meaningfully asymmetric sources
   * (e.g. `--min-abs-bowley 0.1` hides everything that is
   * essentially symmetric in the central half). With f > 0,
   * `degenerate` rows (Bowley=0 because iqr=0) are also dropped
   * but counted under `droppedDegenerate`, not
   * `droppedBelowMinAbsBowley`. Must be in `[0, 1]`. Default 0.
   */
  minAbsBowley?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'bowley-desc' (default): bowley desc (most right-skewed first).
   *   - 'bowley-asc':            bowley asc  (most left-skewed first).
   *   - 'abs-bowley':            |bowley| desc (most asymmetric either way).
   *   - 'iqr-desc':              iqr desc.
   *   - 'median-desc':           median desc.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'bowley-desc'
    | 'bowley-asc'
    | 'abs-bowley'
    | 'iqr-desc'
    | 'median-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenBowleySkewnessRow {
  source: string;
  rowsKept: number;
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  /** Bowley quartile skewness. 0 (with degenerate=true) iff iqr=0. */
  bowley: number;
  absBowley: number;
  /** True iff iqr=0 (q1=q2=q3); Bowley forced to 0. */
  degenerate: boolean;
}

export interface SourceRowTokenBowleySkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMedian: number;
  minAbsBowley: number;
  top: number | null;
  sort:
    | 'bowley-desc'
    | 'bowley-asc'
    | 'abs-bowley'
    | 'iqr-desc'
    | 'median-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinMedian: number;
  droppedBelowMinAbsBowley: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenBowleySkewnessRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'bowley-desc',
  'bowley-asc',
  'abs-bowley',
  'iqr-desc',
  'median-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation (type-7) quantile of an already-sorted ascending
 * array `xs`. `p` in `[0, 1]`. Matches numpy.quantile's default and R's
 * `quantile(..., type = 7)`. Identical to the helper in
 * `sourcerowtokeniqrratio.ts` — duplicated here to keep this module
 * self-contained (no cross-lens import dependency).
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

export function buildSourceRowTokenBowleySkewness(
  queue: QueueLine[],
  opts: SourceRowTokenBowleySkewnessOptions = {},
): SourceRowTokenBowleySkewnessReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minMedian = opts.minMedian ?? 0;
  if (!Number.isFinite(minMedian) || minMedian < 0) {
    throw new Error(
      `minMedian must be a finite, non-negative number (got ${opts.minMedian})`,
    );
  }
  const minAbsBowley = opts.minAbsBowley ?? 0;
  if (!Number.isFinite(minAbsBowley) || minAbsBowley < 0 || minAbsBowley > 1) {
    throw new Error(
      `minAbsBowley must be a finite number in [0, 1] (got ${opts.minAbsBowley})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'bowley-desc';
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
  const allRows: SourceRowTokenBowleySkewnessRow[] = [];
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

    let bowley: number;
    let degenerate: boolean;
    if (iqr === 0) {
      bowley = 0;
      degenerate = true;
    } else {
      bowley = (q1 + q3 - 2 * median) / iqr;
      degenerate = false;
    }
    const absBowley = Math.abs(bowley);

    allRows.push({
      source,
      rowsKept: n,
      q1,
      median,
      q3,
      iqr,
      bowley,
      absBowley,
      degenerate,
    });
  }

  let droppedBelowMinMedian = 0;
  let droppedBelowMinAbsBowley = 0;
  let droppedDegenerate = 0;
  const survived: SourceRowTokenBowleySkewnessRow[] = [];
  for (const row of allRows) {
    if (minMedian > 0 && row.median < minMedian) {
      droppedBelowMinMedian += 1;
      continue;
    }
    if (minAbsBowley > 0) {
      if (row.degenerate) {
        // Forced-zero Bowley: drop under "degenerate" bucket so the
        // operator can distinguish "I filtered for asymmetry" from
        // "this source has no usable Bowley signal at all".
        droppedDegenerate += 1;
        continue;
      }
      if (row.absBowley < minAbsBowley) {
        droppedBelowMinAbsBowley += 1;
        continue;
      }
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'bowley-desc') primary = b.bowley - a.bowley;
    else if (sort === 'bowley-asc') primary = a.bowley - b.bowley;
    else if (sort === 'abs-bowley') primary = b.absBowley - a.absBowley;
    else if (sort === 'iqr-desc') primary = b.iqr - a.iqr;
    else if (sort === 'median-desc') primary = b.median - a.median;
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
    minMedian,
    minAbsBowley,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinMedian,
    droppedBelowMinAbsBowley,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
