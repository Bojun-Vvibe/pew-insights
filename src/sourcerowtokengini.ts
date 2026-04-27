/**
 * source-row-token-gini: per-source Gini coefficient of the
 * per-row `total_tokens` distribution.
 *
 * Headline question: **for each source, how unequal is the
 * distribution of token mass *across individual rows*? Are a
 * few rows responsible for most of the source's tokens, or
 * are tokens spread evenly across rows?**
 *
 * Definition. Given the source's `n` per-row `total_tokens`
 * samples `x_1, ..., x_n` with `x_i >= 0`, the Gini coefficient
 * is the textbook inequality measure on the value distribution:
 *
 *     G = sum_i sum_j |x_i - x_j| / (2 * n^2 * mean(x))
 *
 * Equivalently, with `x` sorted ascending and S = sum(x):
 *
 *     G = ( 2 * sum_{i=1..n} i * x_i  -  (n + 1) * S ) / ( n * S )
 *
 * The form we use is the standard sample Gini. Range: `[0, 1)`
 * for finite samples; `0` iff all rows equal, approaching `1`
 * as a single row carries all the mass. We report:
 *
 *   - `gini`         : raw Gini in [0, 1).
 *   - `giniUnbiased` : the small-sample-bias-corrected estimate
 *                      `n / (n - 1) * gini`. Diverges from raw
 *                      Gini by `~ 1 / n` for small `n`; the
 *                      canonical Deltas-style correction. Same
 *                      range and interpretation; preferred for
 *                      cross-source comparison when row counts
 *                      differ wildly.
 *   - `meanToMedian` : `mean / median` (defined when median > 0).
 *                      A *direction-of-skew* sanity check —
 *                      Gini is symmetric in the sense that
 *                      it cannot distinguish "a few huge rows
 *                      with many small ones" from "a few tiny
 *                      rows with many large ones"; meanToMedian
 *                      tells the operator which way the tail
 *                      points without re-computing skew.
 *
 * Reading guide:
 *
 *   - `G = 0`         : every row carries identical token mass
 *                       (the canonical "constant-token ping"
 *                       signature; same regime that drives
 *                       `mad = 0`, `cv = 0`, etc.).
 *   - `G < 0.2`       : rows are nearly equal in token mass;
 *                       very flat per-row distribution.
 *   - `0.2 <= G < 0.4`: moderate inequality — the cohort
 *                       resembling a typical income distribution.
 *   - `0.4 <= G < 0.6`: high inequality — a handful of rows
 *                       carry a disproportionate share.
 *   - `G >= 0.6`      : extreme inequality — token mass
 *                       concentrated in the long tail; the
 *                       "few rows do all the work" cohort.
 *   - `G -> 1`        : a single row carries essentially all
 *                       the source's tokens.
 *
 * Why this is genuinely orthogonal to every existing per-source
 * dispersion / shape / concentration lens in the codebase:
 *
 *   - `daily-token-gini-coefficient` is Gini of **per-day**
 *     totals — it answers "across days, are some days much
 *     more loaded than others?". This new lens is per-row
 *     within a source — the row-level inequality, with no
 *     time grouping. Two sources can have identical daily Gini
 *     (each day looks similar) but wildly different per-row
 *     Gini (one source has uniform rows per day, the other
 *     has a few huge rows + many tiny ones each day).
 *   - `bucket-token-gini` is Gini across **5-minute buckets**
 *     — bucket-level mass inequality. Same orthogonality
 *     argument: bucket aggregation can hide intra-bucket row
 *     inequality and vice versa.
 *   - `source-row-token-coefficient-of-variation` (v0.6.87) is
 *     `cv = stddev / mean`. CV depends only on the first two
 *     moments. Gini depends on the full Lorenz curve — the
 *     entire ordered sample. Two distributions with identical
 *     CV can have wildly different Gini: e.g. a Bernoulli-like
 *     `{0, 0, ..., 0, 1, 1, ..., 1}` and a `{0, 0, ..., 0, 1}`
 *     can both have CV = 1 in the right configuration but
 *     totally different Gini. Gini integrates the inequality
 *     curve; CV does not.
 *   - `source-row-token-mad` (v0.6.89) is the median-anchored
 *     **dispersion** statistic — width around the median.
 *     Gini is anchored on the *mean* (Lorenz/Gini construction)
 *     and answers "concentration" rather than "spread". A
 *     bimodal symmetric distribution can have moderate MAD
 *     but Gini close to 0.5; a unimodal heavy-tailed
 *     distribution can have small MAD but Gini close to 0.7.
 *   - `source-row-token-skewness` / `source-row-token-kurtosis`
 *     are 3rd / 4th standardised moments — *shape* statistics,
 *     not concentration. Two distributions with identical
 *     skewness / kurtosis can have wildly different Gini, and
 *     vice versa.
 *   - `source-input-token-top-row-share`,
 *     `source-cumulative-mass-half-life-day` are concentration
 *     statistics but they read off a *single quantile* (top
 *     1%, half-life day). Gini integrates over the entire
 *     Lorenz curve and is therefore sensitive to inequality
 *     in every part of the distribution simultaneously.
 *   - `source-output-tokens-per-row-percentiles` reports
 *     p50/p90/p99 spreads on `output_tokens` (not
 *     `total_tokens`). Gini is a single integrated scalar on
 *     `total_tokens` — orthogonal numerator and orthogonal
 *     statistic.
 *   - `source-zero-output-row-share`,
 *     `source-cold-warm-row-ratio` are share-of-rows
 *     statistics — they bin rows into a 2-class partition.
 *     Gini uses the continuous magnitude of every row.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect `total_tokens` values (clamp negative
 *      and non-finite to 0; standard codebase convention).
 *   4. Skip sources with `rowsKept < 2` — sample Gini from a
 *      single value is identically 0 and uninformative. Surface
 *      as `droppedTooFewRowsForGini`.
 *   5. Skip sources with sum(x) == 0 — Gini undefined when all
 *      mass is zero. Surface as `droppedZeroMassForGini`.
 *   6. Compute `mean`, sort ascending, compute Gini via the
 *      i-weighted sum form (numerically stable; O(n log n)
 *      dominated by the sort).
 *   7. Compute `giniUnbiased = n / (n - 1) * gini`.
 *   8. Compute `meanToMedian = mean / median` if `median > 0`,
 *      else 0 with `degenerateMedian = true`.
 *   9. Apply display gates `--min-rows` (default 2 floor) and
 *      `--min-mean` (drop sources whose mean row is strictly
 *      below f).
 *  10. Sort + optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - All-zero rows: `droppedZeroMassForGini` (Gini undefined
 *     when total mass is zero — there is no inequality to
 *     measure on a population of all-zero observations).
 *   - All rows equal and positive: gini = 0, giniUnbiased = 0,
 *     meanToMedian = 1.0, degenerateMedian = false. The
 *     "perfectly equal" cohort.
 *   - Single non-zero row, rest zero (n >= 2): gini approaches
 *     `1 - 1/n` (the maximum possible sample Gini for n rows);
 *     giniUnbiased approaches `1 - 1/(n-1) * (1/n) = ~1`.
 *     meanToMedian is large (mean > 0, median = 0 -> reported
 *     as 0 with degenerateMedian = true).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenGiniOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows from the per-source
   * table. Display filter only — global denominators reflect the
   * full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer >= 2 (the
   * absolute floor for a non-trivial sample Gini). Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose per-row `total_tokens` mean is strictly
   * below this value. Useful for suppressing tiny-row sources
   * where Gini is dominated by token-counting quantisation noise.
   * Display filter only. Must be a finite, non-negative number.
   * Default 0.
   */
  minMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'gini-desc' (default): gini desc (most unequal first).
   *   - 'gini-asc':            gini asc (most equal first).
   *   - 'unbiased-desc':       giniUnbiased desc.
   *   - 'unbiased-asc':        giniUnbiased asc.
   *   - 'rows':                rowsKept desc.
   *   - 'mean':                mean desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'gini-desc'
    | 'gini-asc'
    | 'unbiased-desc'
    | 'unbiased-asc'
    | 'rows'
    | 'mean'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenGiniRow {
  source: string;
  rowsKept: number;
  mean: number;
  median: number;
  gini: number;
  giniUnbiased: number;
  meanToMedian: number;
  /** True iff median = 0 (meanToMedian undefined; reported as 0). */
  degenerateMedian: boolean;
}

export interface SourceRowTokenGiniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMean: number;
  top: number | null;
  sort:
    | 'gini-desc'
    | 'gini-asc'
    | 'unbiased-desc'
    | 'unbiased-asc'
    | 'rows'
    | 'mean'
    | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of kept rows across all sources. */
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForGini: number;
  droppedZeroMassForGini: number;
  droppedBelowMinRows: number;
  droppedBelowMinMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenGiniRow[];
}

const ABSOLUTE_MIN_ROWS = 2;

const VALID_SORTS = [
  'gini-desc',
  'gini-asc',
  'unbiased-desc',
  'unbiased-asc',
  'rows',
  'mean',
  'source',
] as const;

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sortedAsc[(n - 1) / 2] as number;
  const a = sortedAsc[n / 2 - 1] as number;
  const b = sortedAsc[n / 2] as number;
  return (a + b) / 2;
}

export function buildSourceRowTokenGini(
  queue: QueueLine[],
  opts: SourceRowTokenGiniOptions = {},
): SourceRowTokenGiniReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minMean = opts.minMean ?? 0;
  if (!Number.isFinite(minMean) || minMean < 0) {
    throw new Error(
      `minMean must be a finite, non-negative number (got ${opts.minMean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'gini-desc';
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
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const totRaw = Number(q.total_tokens);
    const tot = Number.isFinite(totRaw) && totRaw > 0 ? totRaw : 0;

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push(tot);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedTooFewRowsForGini = 0;
  let droppedZeroMassForGini = 0;
  const allRows: SourceRowTokenGiniRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForGini += 1;
      continue;
    }
    const sortedVals = samples.slice().sort((a, b) => a - b);
    let s = 0;
    for (let k = 0; k < n; k += 1) s += sortedVals[k] as number;
    if (s <= 0) {
      droppedZeroMassForGini += 1;
      continue;
    }
    const mean = s / n;
    const med = median(sortedVals);

    // Gini via the i-weighted-sum closed form:
    //   G = ( 2 * sum_{i=1..n} i * x_i - (n + 1) * S ) / ( n * S )
    let weighted = 0;
    for (let k = 0; k < n; k += 1) {
      // i is 1-indexed in the formula
      weighted += (k + 1) * (sortedVals[k] as number);
    }
    const gini = (2 * weighted - (n + 1) * s) / (n * s);
    // Clamp tiny floating point noise into the canonical [0, 1) range.
    const giniClamped = gini < 0 ? 0 : gini >= 1 ? gini : gini;
    const giniUnbiased = (n / (n - 1)) * giniClamped;

    const degenerateMedian = med === 0;
    const meanToMedian = degenerateMedian ? 0 : mean / med;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      median: med,
      gini: giniClamped,
      giniUnbiased,
      meanToMedian,
      degenerateMedian,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMean = 0;
  const survived: SourceRowTokenGiniRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.mean < minMean) {
      droppedBelowMinMean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'gini-desc') primary = b.gini - a.gini;
    else if (sort === 'gini-asc') primary = a.gini - b.gini;
    else if (sort === 'unbiased-desc') primary = b.giniUnbiased - a.giniUnbiased;
    else if (sort === 'unbiased-asc') primary = a.giniUnbiased - b.giniUnbiased;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'mean') primary = b.mean - a.mean;
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
    minMean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedTooFewRowsForGini,
    droppedZeroMassForGini,
    droppedBelowMinRows,
    droppedBelowMinMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
