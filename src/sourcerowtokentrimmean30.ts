/**
 * source-row-token-trim-mean-30: per-source **30 % symmetrically
 * trimmed mean** of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_(1) <= x_(2) <= ... <= x_(n)` (sorted ascending),
 * with trimming fraction `alpha = 0.30`:
 *
 *     k  = floor(alpha * n)
 *     TM = mean( x_(k+1), x_(k+2), ..., x_(n-k) )
 *
 * That is: drop the bottom `k` and top `k` order statistics
 * (each tail trimmed by 30 % of `n`, rounded down), then take
 * the arithmetic mean of the surviving central `n - 2k` rows.
 * On `n = 100` we drop 30 from each side and average the
 * central 40; on `n = 50` we drop 15 from each side and
 * average the central 20; on `n = 10` we drop 3 from each
 * side and average the central 4.
 *
 * Place on the L-estimator robustness ladder. Sits ONE rung up
 * from `source-row-token-trim-mean-25` (25 % breakdown,
 * already shipped) and ONE rung down from the median (50 %
 * breakdown, the L-estimator with maximum robustness):
 *
 *     mean / mid-range          0 % breakdown
 *     winsorized-mean-10       10 % breakdown   CLIPS  k tails (k=floor(0.10n))
 *     trim-mean-10             10 % breakdown   DROPS  k tails (k=floor(0.10n))
 *     winsorized-mean-20       20 % breakdown   CLIPS  k tails (k=floor(0.20n))
 *     trim-mean-20             20 % breakdown   DROPS  k tails (k=floor(0.20n))
 *     trim-mean-25             25 % breakdown   DROPS  k tails (k=floor(0.25n))
 *     TRIM-MEAN-30  (this)     30 % breakdown   DROPS  k tails (k=floor(0.30n))
 *     median                   50 % breakdown
 *
 * Mechanically distinct from every existing trim-mean lens at
 * a different alpha (TM-10 / TM-20 / TM-25): same DROP
 * mechanism (the trimmed `2k` rows contribute nothing to
 * either numerator or denominator) but a strictly larger `k`
 * for any given `n` once `floor(0.30 n) > floor(0.25 n)`,
 * i.e. for `n >= 5` (floor(1.5)=1 vs floor(1.25)=1 at n=5
 * happens to coincide; first true gap at n=20: floor(6)=6 vs
 * floor(5)=5). TM-30 retains only the central 40 % of the
 * data on the asymptote (vs TM-25's central 50 %, TM-20's
 * central 60 %, TM-10's central 80 %), so it is **strictly
 * more robust to outliers than every shipped trim-mean lens
 * and strictly less robust than the median**.
 *
 * Mechanically distinct from any winsorized-mean lens at any
 * alpha: at the same alpha, winsorized-mean keeps `n` rows
 * in the denominator (the `2k` clipped boundaries STILL count
 * toward the average, just at the boundary value), whereas
 * this lens keeps only `n - 2k` rows in the denominator (the
 * `2k` trimmed rows contribute nothing). Even at the same
 * `k`, the two are not generally equal whenever the central
 * body mean differs from the boundary midpoint.
 *
 * Properties exercised in tests: scale-equivariance,
 * translation-equivariance, order-invariance, identity on
 * constant + all-zero series, bounded by `[x_(k+1), x_(n-k)]`,
 * `tmMeanGap = 0` on tail-symmetric series, free byproduct
 * `mean` reported as a sanity reference, signed `tmMeanGap`
 * reveals tail asymmetry direction.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — at
 *      `n = 4` we have `k = floor(0.30 * 4) = 1`, drop one
 *      from each side, and average the inner two, which is
 *      the smallest meaningful 30 % symmetric trimmed mean.
 *      At `n < 4`, `k = 0` and TM degenerates to the
 *      arithmetic mean, so we require n >= 4 by default).
 *   7. Sort ascending; compute `k = floor(0.30 * n)`,
 *      `trim_mean = sum(x_(k+1..n-k)) / (n - 2k)`,
 *      `mean = sum(x_(1..n)) / n`,
 *      `tmMeanGap = trim_mean - mean`. Also record
 *      `trimmedPerTail = k`, `loBoundary = x_(k+1)`,
 *      `hiBoundary = x_(n-k)`.
 *   8. Apply display gates:
 *      - `--min-rows`       (absolute floor 4)             -> droppedBelowMinRows.
 *      - `--min-trim-mean`  (cohort selector)              -> droppedBelowMinTrimMean.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenTrimMean30Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (need k = floor(0.30 n) >= 1 to
   * actually trim — at n < 4, k = 0 and TM degenerates to
   * the arithmetic mean). Default 4.
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

export interface SourceRowTokenTrimMean30Row {
  source: string;
  rowsKept: number;
  /** k = floor(0.30 * rowsKept). Each tail discards exactly k order statistics. */
  trimmedPerTail: number;
  /** Lower trim boundary x_(k+1) — the smallest surviving order statistic. */
  loBoundary: number;
  /** Upper trim boundary x_(n-k) — the largest surviving order statistic. */
  hiBoundary: number;
  /** Arithmetic mean of all `rowsKept` order statistics. */
  mean: number;
  /** 30 % symmetrically trimmed mean — central (rowsKept - 2k) rows. */
  trimMean: number;
  /** Signed gap trim_mean - mean. */
  tmMeanGap: number;
}

export interface SourceRowTokenTrimMean30Report {
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
  sources: SourceRowTokenTrimMean30Row[];
}

const ABSOLUTE_MIN_ROWS = 4;
const TRIM_FRACTION = 0.30;

const VALID_SORTS = [
  'trim-mean-desc',
  'trim-mean-asc',
  'mean-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTrimMean30(
  queue: QueueLine[],
  opts: SourceRowTokenTrimMean30Options = {},
): SourceRowTokenTrimMean30Report {
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
  const allRows: SourceRowTokenTrimMean30Row[] = [];
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
    // Defensive: by construction with n >= minRows >= 4 and TRIM_FRACTION = 0.30,
    // k >= 1 and n - 2k >= 2, so the central window is always non-empty.
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
  const survived: SourceRowTokenTrimMean30Row[] = [];
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
