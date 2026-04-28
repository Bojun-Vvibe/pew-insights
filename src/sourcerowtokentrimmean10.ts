/**
 * source-row-token-trim-mean-10: per-source **10 % symmetrically
 * trimmed mean** of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_(1) <= x_(2) <= ... <= x_(n)` (sorted ascending),
 * with trimming fraction `alpha = 0.10`:
 *
 *     k  = floor(alpha * n)
 *     TM = mean( x_(k+1), x_(k+2), ..., x_(n-k) )
 *
 * That is: drop the bottom `k` and top `k` order statistics
 * (each tail trimmed by 10 % of `n`, rounded down), then take
 * the arithmetic mean of the surviving central `n - 2k` rows.
 * On `n = 100` we drop 10 from each side and average the
 * central 80; on `n = 50` we drop 5 from each side and
 * average the central 40.
 *
 * Place on the L-estimator robustness ladder. Sits one rung
 * down from `source-row-token-trim-mean-25` (25 % breakdown,
 * already shipped) and is mechanically distinct from
 * `source-row-token-winsorized-mean-10` (same alpha = 0.10
 * but CLIPS the tails to boundary values instead of DROPPING
 * them entirely):
 *
 *     mean / mid-range          0 % breakdown
 *     winsorized-mean-10       10 % breakdown   CLIPS k tails
 *     TRIM-MEAN-10  (this)     10 % breakdown   DROPS  k tails
 *     winsorized-mean-20       20 % breakdown   CLIPS 2k tails
 *     trim-mean-25             25 % breakdown   DROPS  2.5k tails
 *     median                   50 % breakdown
 *
 * The natural distinction from `winsorized-mean-10`: at the
 * same alpha = 0.10, winsorized-mean keeps `n` rows in the
 * denominator (the 2k clipped boundaries STILL count toward
 * the average, just at the boundary value), whereas this
 * lens keeps only `n - 2k` rows in the denominator (the 2k
 * trimmed rows contribute nothing, neither to numerator nor
 * to denominator). Numerically: WM-10 mean is a weighted
 * average over `n` rows where the 2k extreme rows are
 * pulled to the boundary value but still weighted `1/n`;
 * TM-10 is an unweighted average over `n - 2k` rows. On a
 * tail-symmetric distribution these are not generally equal.
 *
 * Properties exercised in tests: scale-equivariance,
 * translation-equivariance, order-invariance, identity on
 * constant + all-zero series, bounded by `[x_(k+1), x_(n-k)]`,
 * `tmMeanGap = 0` on tail-symmetric series, free byproduct
 * `mean` reported as a sanity reference, signed `tmMeanGap`
 * reveals tail asymmetry direction.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens:
 *
 *   - **Distinct from `source-row-token-winsorized-mean-10`**:
 *     same alpha, different mechanism — clip vs drop. WM-10
 *     denominator is `n`; TM-10 denominator is `n - 2k`. On
 *     the same data the two are not equal whenever the body
 *     mean differs from the boundary midpoint.
 *   - **Distinct from `source-row-token-trim-mean-25`**: same
 *     mechanism (drop), different alpha (0.10 vs 0.25). At
 *     n = 100, this lens drops 20 rows; trim-mean-25 drops
 *     50 rows. TM-10 retains more body and is therefore
 *     closer to the raw mean than TM-25.
 *   - **Distinct from `source-row-token-mid-range`**:
 *     mid-range = (min+max)/2 listens to ONLY the two tails
 *     (0 % breakdown); TM-10 *discards* the bottom and top
 *     `floor(0.10 n)` rows entirely (10 % breakdown). They
 *     are opposite ends of the L-estimator ladder.
 *   - **Distinct from `source-row-token-midhinge` / `trimean`**:
 *     those are quantile-only summaries (q1, q3, median).
 *     TM-10 averages every row in the central 80 %, so it is
 *     sensitive to the *shape* of the central body (a
 *     bimodal central mass shifts TM-10 toward the modes).
 *   - **Distinct from `source-row-token-mad` / CQD / Bowley
 *     / IQR-ratio**: those are spread or shape statistics,
 *     not central tendency in token units.
 *   - **Distinct from harmonic / quadratic / contraharmonic /
 *     Lehmer-k means**: those are POWER-weighted (each row
 *     weights itself by some power of its own value),
 *     non-linear in row values, NOT translation-equivariant.
 *     TM-10 is a linear L-estimator, translation- AND
 *     scale-equivariant.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 10 — at
 *      `n = 10` we drop one from each side and average the
 *      inner eight, which is the smallest meaningful 10 %
 *      symmetric trimmed mean. At `n < 10`, `k = 0` and TM
 *      degenerates to the arithmetic mean, so we require
 *      n >= 10 by default).
 *   7. Sort ascending; compute `k = floor(0.10 * n)`,
 *      `trim_mean = sum(x_(k+1..n-k)) / (n - 2k)`,
 *      `mean = sum(x_(1..n)) / n`,
 *      `tmMeanGap = trim_mean - mean`. Also record
 *      `trimmedPerTail = k`, `loBoundary = x_(k+1)`,
 *      `hiBoundary = x_(n-k)`.
 *   8. Apply display gates:
 *      - `--min-rows`       (absolute floor 10)            -> droppedBelowMinRows.
 *      - `--min-trim-mean`  (cohort selector)              -> droppedBelowMinTrimMean.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenTrimMean10Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 10 (need k = floor(0.10 n) >= 1 to
   * actually trim — at n < 10, k = 0 and TM degenerates to
   * the arithmetic mean). Default 10.
   */
  minRows?: number;
  /**
   * Drop sources whose trim-mean is strictly below this value.
   * Cohort selector. Must be a finite, non-negative number.
   * Default 0.
   */
  minTrimMean?: number;
  top?: number | null;
  sort?:
    | 'trim-mean-desc'
    | 'trim-mean-asc'
    | 'mean-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenTrimMean10Row {
  source: string;
  rowsKept: number;
  /** k = floor(0.10 * rowsKept). Each tail discards exactly k order statistics. */
  trimmedPerTail: number;
  /** Lower trim boundary x_(k+1) — the smallest surviving order statistic. */
  loBoundary: number;
  /** Upper trim boundary x_(n-k) — the largest surviving order statistic. */
  hiBoundary: number;
  /** Arithmetic mean of all `rowsKept` order statistics. */
  mean: number;
  /** 10 % symmetrically trimmed mean — central (rowsKept - 2k) rows. */
  trimMean: number;
  /** Signed gap trim_mean - mean. */
  tmMeanGap: number;
}

export interface SourceRowTokenTrimMean10Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minTrimMean: number;
  top: number | null;
  sort:
    | 'trim-mean-desc'
    | 'trim-mean-asc'
    | 'mean-desc'
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
  droppedBelowMinTrimMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTrimMean10Row[];
}

const ABSOLUTE_MIN_ROWS = 10;
const TRIM_FRACTION = 0.10;

const VALID_SORTS = [
  'trim-mean-desc',
  'trim-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTrimMean10(
  queue: QueueLine[],
  opts: SourceRowTokenTrimMean10Options = {},
): SourceRowTokenTrimMean10Report {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minTrimMean = opts.minTrimMean ?? 0;
  if (!Number.isFinite(minTrimMean) || minTrimMean < 0) {
    throw new Error(
      `minTrimMean must be a finite, non-negative number (got ${opts.minTrimMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'trim-mean-desc';
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
  const allRows: SourceRowTokenTrimMean10Row[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const k = Math.floor(TRIM_FRACTION * n);
    // Defensive: by construction with n >= minRows >= 10 and TRIM_FRACTION = 0.10,
    // k >= 1 and n - 2k >= 8, so the central window is always non-empty.
    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    let centralSum = 0;
    for (let i = k; i < n - k; i += 1) centralSum += sorted[i]!;
    const mean = totalSum / n;
    const trimMean = centralSum / (n - 2 * k);
    const tmMeanGap = trimMean - mean;
    const loBoundary = sorted[k]!;
    const hiBoundary = sorted[n - k - 1]!;

    allRows.push({
      source,
      rowsKept: n,
      trimmedPerTail: k,
      loBoundary,
      hiBoundary,
      mean,
      trimMean,
      tmMeanGap,
    });
  }

  let droppedBelowMinTrimMean = 0;
  const survived: SourceRowTokenTrimMean10Row[] = [];
  for (const row of allRows) {
    if (minTrimMean > 0 && row.trimMean < minTrimMean) {
      droppedBelowMinTrimMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'trim-mean-desc') primary = b.trimMean - a.trimMean;
    else if (sort === 'trim-mean-asc') primary = a.trimMean - b.trimMean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.tmMeanGap) - Math.abs(a.tmMeanGap);
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
    minTrimMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinTrimMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
