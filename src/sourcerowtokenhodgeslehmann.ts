/**
 * source-row-token-hodges-lehmann: per-source **Hodges-Lehmann
 * pseudo-median** of `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples `x_1, x_2, ..., x_n`, form the multiset of all
 * `n*(n+1)/2` **Walsh averages** (pairwise means including
 * self-pairs):
 *
 *     W = { (x_i + x_j) / 2 : 1 <= i <= j <= n }
 *
 * Then the Hodges-Lehmann pseudo-median is the **median of W**:
 *
 *     HL = median( W )
 *
 * On `n = 4` the multiset has `4*5/2 = 10` Walsh averages; on
 * `n = 100` it has `5050`; on `n = 500` it has `125,250`.
 *
 * Mechanical class — fundamentally distinct from every shipped lens.
 *
 * Every previously shipped per-source row-token location lens on
 * the robustness ladder (mean / mid-range / trim-mean-{10,20,25,30}
 * / winsorized-mean-{10,20} / median / midhinge / trimean / IQM)
 * is an **L-estimator**: a fixed linear combination of the order
 * statistics `x_(1) <= x_(2) <= ... <= x_(n)` with deterministic
 * coefficients depending only on `n` (drop, clip, weight). The
 * Hodges-Lehmann estimator is **NOT an L-estimator**. It is the
 * canonical **R-estimator / U-statistic** location estimator,
 * derived from the Wilcoxon signed-rank test: it is the value
 * that, if subtracted from the sample, makes the signed-rank
 * statistic vanish. Computationally, it is the median of all
 * pairwise *averages*, not the median (or any linear combination)
 * of the *values themselves*.
 *
 * Why this matters mechanically:
 *   - L-estimators only see each `x_i` as a single point in the
 *     sorted ranking. Re-arranging two interior values within
 *     adjacent ranks leaves every L-estimator unchanged. The HL
 *     estimator sees the full multiset of pairwise sums and is
 *     sensitive to interior spacing — moving `x_i` even without
 *     crossing any other point changes `n` Walsh averages
 *     (`(x_i + x_j)/2` for every `j`), which can shift the
 *     median of `W`.
 *   - Asymptotic relative efficiency at the normal model is
 *     `3/pi ~= 0.955` — strictly higher than the median's `2/pi
 *     ~= 0.637` and only marginally below the mean's `1.0`.
 *     Breakdown point is `1 - 1/sqrt(2) ~= 0.293`, between the
 *     trim-mean-25 (25 %) and trim-mean-30 (30 %) and far above
 *     any shipped winsorized lens.
 *   - For symmetric distributions HL agrees with the population
 *     median in expectation; for asymmetric distributions it
 *     does NOT — it estimates the center of symmetry of the
 *     symmetrized distribution `(X + X')/2`, which is generally
 *     closer to the mean than to the median. This makes HL a
 *     mechanically distinct location target from every shipped
 *     median-family lens (median / midhinge / trimean / IQM),
 *     all of which estimate the population median directly.
 *
 * Algorithm — exact `O(n^2)` Walsh-average enumeration.
 *
 * For the queue sizes seen in this repo (largest source ~500
 * rows -> ~125,250 Walsh averages, ~1 ms to median) the exact
 * `O(n^2)` enumeration is fast and **exact**. We do NOT use the
 * `O(n log^2 n)` Monahan algorithm — exactness is more valuable
 * than the asymptotic speedup at our scale, and the simpler
 * code is auditable.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — at `n = 4`
 *      the Walsh-average multiset has 10 elements and the
 *      pseudo-median is a meaningful R-estimator; at `n < 4`
 *      the multiset is too small to be informative).
 *   7. Build `W` of size `n*(n+1)/2`. Sort ascending.
 *   8. `hl = median(W)`. With `m = |W|`:
 *        - if `m` is odd:   `hl = W_((m+1)/2)`
 *        - if `m` is even:  `hl = (W_(m/2) + W_(m/2+1)) / 2`
 *   9. Free byproducts:
 *        - `mean`            arithmetic mean of `x` (raw location)
 *        - `median`          ordinary sample median of `x`
 *        - `walshCount`      `n*(n+1)/2`
 *        - `walshMin`        smallest Walsh average = `x_(1)`
 *        - `walshMax`        largest Walsh average  = `x_(n)`
 *        - `hlMeanGap`       signed `hl - mean`     (exposes tail asymmetry as
 *                            seen by the symmetrized distribution)
 *        - `hlMedianGap`     signed `hl - median`   (exposes how far HL is
 *                            shifted from the L-estimator median by the
 *                            pairwise-symmetrization)
 *  10. Apply display gates:
 *        - `--min-rows`            (absolute floor 4)         -> droppedBelowMinRows.
 *        - `--min-hodges-lehmann`  (cohort selector)          -> droppedBelowMinHodgesLehmann.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenHodgesLehmannOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (need n >= 4 for a meaningful
   * Walsh-average multiset of size n*(n+1)/2 = 10). Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose Hodges-Lehmann pseudo-median is strictly
   * below this value. Cohort selector. Must be a finite,
   * non-negative number. Default 0.
   */
  minHodgesLehmann?: number;
  top?: number | null;
  sort?:
    | 'hl-desc'
    | 'hl-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenHodgesLehmannRow {
  source: string;
  rowsKept: number;
  /** |W| = n * (n + 1) / 2 — number of Walsh averages enumerated. */
  walshCount: number;
  /** Smallest Walsh average == x_(1). */
  walshMin: number;
  /** Largest Walsh average == x_(n). */
  walshMax: number;
  /** Arithmetic mean of all rowsKept order statistics. */
  mean: number;
  /** Ordinary sample median of all rowsKept rows. */
  median: number;
  /** Hodges-Lehmann pseudo-median = median of all Walsh averages. */
  hodgesLehmann: number;
  /** Signed gap hodgesLehmann - mean. */
  hlMeanGap: number;
  /** Signed gap hodgesLehmann - median. */
  hlMedianGap: number;
}

export interface SourceRowTokenHodgesLehmannReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minHodgesLehmann: number;
  top: number | null;
  sort:
    | 'hl-desc'
    | 'hl-asc'
    | 'mean-desc'
    | 'median-desc'
    | 'mean-gap-desc'
    | 'median-gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinHodgesLehmann: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenHodgesLehmannRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'hl-desc',
  'hl-asc',
  'mean-desc',
  'median-desc',
  'mean-gap-desc',
  'median-gap-desc',
  'rows',
  'source',
] as const;

function sampleMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n % 2 === 1) return sortedAsc[(n - 1) / 2]!;
  return (sortedAsc[n / 2 - 1]! + sortedAsc[n / 2]!) / 2;
}

export function buildSourceRowTokenHodgesLehmann(
  queue: QueueLine[],
  opts: SourceRowTokenHodgesLehmannOptions = {},
): SourceRowTokenHodgesLehmannReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minHodgesLehmann = opts.minHodgesLehmann ?? 0;
  if (!Number.isFinite(minHodgesLehmann) || minHodgesLehmann < 0) {
    throw new Error(
      `minHodgesLehmann must be a finite, non-negative number (got ${opts.minHodgesLehmann})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'hl-desc';
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
  const allRows: SourceRowTokenHodgesLehmannRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);

    // Walsh averages: enumerate (x_i + x_j) / 2 for i <= j.
    const m = (n * (n + 1)) / 2;
    const walsh = new Float64Array(m);
    let widx = 0;
    for (let i = 0; i < n; i += 1) {
      const xi = sorted[i]!;
      for (let j = i; j < n; j += 1) {
        walsh[widx] = (xi + sorted[j]!) / 2;
        widx += 1;
      }
    }
    // Sort the typed array in place.
    walsh.sort();
    let hl: number;
    if (m % 2 === 1) {
      hl = walsh[(m - 1) / 2]!;
    } else {
      hl = (walsh[m / 2 - 1]! + walsh[m / 2]!) / 2;
    }

    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += sorted[i]!;
    const mean = totalSum / n;
    const median = sampleMedian(sorted);
    const walshMin = walsh[0]!;
    const walshMax = walsh[m - 1]!;

    allRows.push({
      source,
      rowsKept: n,
      walshCount: m,
      walshMin,
      walshMax,
      mean,
      median,
      hodgesLehmann: hl,
      hlMeanGap: hl - mean,
      hlMedianGap: hl - median,
    });
  }

  let droppedBelowMinHodgesLehmann = 0;
  const survived: SourceRowTokenHodgesLehmannRow[] = [];
  for (const row of allRows) {
    if (minHodgesLehmann > 0 && row.hodgesLehmann < minHodgesLehmann) {
      droppedBelowMinHodgesLehmann += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'hl-desc') primary = b.hodgesLehmann - a.hodgesLehmann;
    else if (sort === 'hl-asc') primary = a.hodgesLehmann - b.hodgesLehmann;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'mean-gap-desc')
      primary = Math.abs(b.hlMeanGap) - Math.abs(a.hlMeanGap);
    else if (sort === 'median-gap-desc')
      primary = Math.abs(b.hlMedianGap) - Math.abs(a.hlMedianGap);
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
    minHodgesLehmann,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinHodgesLehmann,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
