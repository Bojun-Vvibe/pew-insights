/**
 * source-row-token-mad: per-source Median Absolute Deviation
 * (MAD) of the per-row `total_tokens` distribution.
 *
 * Headline question: **for each source, what is the typical
 * absolute deviation of a row from the source's median row,
 * measured robustly (no mean, no stddev, no squaring)?**
 *
 * Definition. Given the source's `n` per-row `total_tokens`
 * samples `x_1, ..., x_n` and their sample median
 * `med = median(x)`, the Median Absolute Deviation is:
 *
 *     mad = median(|x_i - med|)            (raw MAD)
 *
 * We also report the consistency-scaled MAD:
 *
 *     madScaled = 1.4826 * mad
 *
 * The factor 1.4826 = 1 / Phi^{-1}(0.75) is the canonical
 * scaling that makes `madScaled` an unbiased, consistent
 * estimator of the standard deviation under a Normal
 * distribution. For Normal data, `madScaled ~ stddev`. For
 * non-Normal data the two diverge — and that divergence is
 * itself informative.
 *
 * Reading guide:
 *
 *   - `mad = 0`        : at least 50% of rows equal the median
 *                        (massive concentration on a single
 *                        value — the canonical "constant-token
 *                        ping" signature).
 *   - `mad <<  median` : tight clustering of the bulk; outliers
 *                        (if any) cannot pull MAD up.
 *   - `mad ~  median`  : moderately heavy spread relative to
 *                        the typical row.
 *   - `mad >> median`  : the typical absolute deviation
 *                        exceeds the typical row size — this
 *                        is rare and indicates a bimodal or
 *                        very heavy-tailed distribution.
 *
 * We additionally report `madRatio = mad / median` (defined
 * only when `median > 0`). This is a **scale-free, robust**
 * dispersion measure — analogous to the (mean-based)
 * coefficient of variation but with median replacing mean and
 * MAD replacing stddev. Both numerator and denominator are
 * robust to outliers.
 *
 * Why this is genuinely orthogonal to every existing per-source
 * dispersion / shape lens in the codebase:
 *
 *   - `source-row-token-coefficient-of-variation` (v0.6.87) is
 *     `cv = stddev / mean`. CV uses **mean and stddev** —
 *     both are dominated by the largest few rows in a
 *     heavy-tailed distribution. A single 100x outlier can
 *     shift the mean by >>10% and the stddev by >>50%, so CV
 *     reports "the source is highly dispersed" when in fact
 *     99% of rows are tightly clustered. MAD is computed from
 *     **medians** — the breakdown point is 50%; you have to
 *     replace half the rows before MAD changes by more than a
 *     bounded amount. The two statistics are mathematically
 *     **independent**: a Normal(mu, sigma) source has
 *     CV = sigma/mu and madRatio = 1.4826*sigma/mu (so they
 *     trace each other under Normal data); but for a
 *     contaminated distribution — say 95% N(100, 1) + 5%
 *     N(100, 1000) — CV is dominated by the contamination
 *     (CV ~ sigma_total/mu, large), while MAD reads through
 *     the contamination (madRatio ~ 1.4826 * 1 / 100, small).
 *     Sources with identical CV can have wildly different MAD,
 *     and the **gap between them quantifies outlier leverage**.
 *   - `source-row-token-skewness` / `source-row-token-kurtosis`
 *     are 3rd / 4th standardised **moments** — both use
 *     mean and stddev as their location/scale anchors and
 *     inherit the same outlier sensitivity. MAD does not.
 *   - `source-output-tokens-per-row-percentiles` reports
 *     p50/p90/p99 of per-row `output_tokens` (not
 *     `total_tokens`) — quantile shape on a different
 *     numerator. MAD is a *single robust dispersion scalar*
 *     on `total_tokens` — not a quantile spread, and not on
 *     output tokens.
 *   - `source-output-tokens-by-hour-cv` is CV across 24
 *     hour-of-day bins — temporal dispersion, hour grain.
 *     MAD here is on raw per-row values with no time grouping.
 *   - `source-gap-hours-cv` is CV of inter-row gap lengths —
 *     a cadence statistic. MAD here is on row-value, not row
 *     timing.
 *   - `source-burstiness-fano-factor` is `variance / mean` of
 *     per-day totals — day grain, mean-based. MAD here is row
 *     grain, median-based.
 *   - `source-cache-share-by-day-cv`,
 *     `source-reasoning-share-by-day-cv`,
 *     `source-io-ratio-stability` are CVs of daily *ratios*.
 *     MAD here is on a raw count, not a ratio.
 *   - `source-zero-output-row-share`,
 *     `source-cold-warm-row-ratio`,
 *     `source-input-token-top-row-share`,
 *     `source-cumulative-mass-half-life-day` are
 *     concentration / share statistics, not dispersion.
 *   - `source-output-tokens-per-row-percentiles` could in
 *     principle be massaged into a MAD-like quantity (p50 and
 *     |p_i - p50| spread), but it never is and it operates on
 *     `output_tokens`, not `total_tokens`.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect `total_tokens` values (clamp negative
 *      and non-finite to 0; standard codebase convention).
 *   4. Skip sources with `rowsKept < 2` — sample MAD from a single
 *      value is identically 0 and uninformative. Surface as
 *      `droppedTooFewRowsForMad`.
 *   5. Compute `median` (linear-interp on the n/2 element).
 *   6. Compute `mad = median(|x_i - median|)`.
 *   7. Compute `madScaled = 1.4826 * mad`.
 *   8. Compute `madRatio = mad / median` if `median > 0`,
 *      else `madRatio = 0` and `degenerate = true`.
 *   9. Apply display gates `--min-rows` (default 2 floor) and
 *      `--min-median` (drop sources whose median row is
 *      strictly below f).
 *  10. Sort + optionally cap with `--top`.
 *
 * Median convention: for n samples sorted ascending,
 *   median = sorted[(n-1)/2] if n is odd,
 *          = (sorted[n/2 - 1] + sorted[n/2]) / 2 if n is even.
 * Same convention as JS sort + standard textbooks.
 *
 * Edge cases:
 *
 *   - All-zero rows: median = 0, mad = 0, madRatio = 0,
 *     degenerate = true. Surfaces in the table; not silently
 *     dropped (a "perfectly stable at zero" source is real).
 *   - Single non-zero row at the median, all others zero:
 *     median = 0 (if zero is the majority), mad reflects half
 *     of the rows being non-zero. degenerate = true (median
 *     is 0 so madRatio undefined and reported as 0). Operator
 *     can read mad/madScaled directly.
 *   - All rows equal: mad = 0, madRatio = 0, degenerate is
 *     false iff median > 0. The "perfectly tight" cohort.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMadOptions {
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
   * absolute floor for a non-trivial sample MAD). Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose per-row `total_tokens` median is strictly
   * below this value. Useful for suppressing tiny-row sources where
   * the MAD ratio is dominated by quantisation. Display filter
   * only. Must be a finite, non-negative number. Default 0.
   */
  minMedian?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'mad-desc' (default): mad desc (largest absolute robust spread first).
   *   - 'mad-asc':            mad asc (most uniform first).
   *   - 'ratio-desc':         madRatio desc (largest robust scale-free spread first).
   *   - 'ratio-asc':          madRatio asc.
   *   - 'rows':               rowsKept desc.
   *   - 'median':             median desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'mad-desc'
    | 'mad-asc'
    | 'ratio-desc'
    | 'ratio-asc'
    | 'rows'
    | 'median'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenMadRow {
  source: string;
  rowsKept: number;
  median: number;
  mad: number;
  madScaled: number;
  madRatio: number;
  /** True iff median = 0 (madRatio undefined; reported as 0). */
  degenerate: boolean;
}

export interface SourceRowTokenMadReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMedian: number;
  top: number | null;
  sort:
    | 'mad-desc'
    | 'mad-asc'
    | 'ratio-desc'
    | 'ratio-asc'
    | 'rows'
    | 'median'
    | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of kept rows across all sources. */
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForMad: number;
  droppedBelowMinRows: number;
  droppedBelowMinMedian: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMadRow[];
}

const ABSOLUTE_MIN_ROWS = 2;

/** 1 / Phi^{-1}(0.75) — the canonical Normal-consistency factor. */
const MAD_NORMAL_FACTOR = 1.4826;

const VALID_SORTS = [
  'mad-desc',
  'mad-asc',
  'ratio-desc',
  'ratio-asc',
  'rows',
  'median',
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

export function buildSourceRowTokenMad(
  queue: QueueLine[],
  opts: SourceRowTokenMadOptions = {},
): SourceRowTokenMadReport {
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
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'mad-desc';
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
  let droppedTooFewRowsForMad = 0;
  const allRows: SourceRowTokenMadRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    if (samples.length < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForMad += 1;
      continue;
    }
    const sortedVals = samples.slice().sort((a, b) => a - b);
    const med = median(sortedVals);
    const absDevs: number[] = new Array(sortedVals.length);
    for (let k = 0; k < sortedVals.length; k += 1) {
      absDevs[k] = Math.abs((sortedVals[k] as number) - med);
    }
    absDevs.sort((a, b) => a - b);
    const mad = median(absDevs);
    const madScaled = MAD_NORMAL_FACTOR * mad;
    const degenerate = med === 0;
    const madRatio = degenerate ? 0 : mad / med;

    allRows.push({
      source,
      rowsKept: samples.length,
      median: med,
      mad,
      madScaled,
      madRatio,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMedian = 0;
  const survived: SourceRowTokenMadRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.median < minMedian) {
      droppedBelowMinMedian += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'mad-desc') primary = b.mad - a.mad;
    else if (sort === 'mad-asc') primary = a.mad - b.mad;
    else if (sort === 'ratio-desc') primary = b.madRatio - a.madRatio;
    else if (sort === 'ratio-asc') primary = a.madRatio - b.madRatio;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'median') primary = b.median - a.median;
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
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedTooFewRowsForMad,
    droppedBelowMinRows,
    droppedBelowMinMedian,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
