/**
 * source-row-token-coefficient-of-variation: per-source
 * coefficient of variation `cv = stddev / mean` of the per-row
 * `total_tokens` distribution.
 *
 * Headline question: **for each source, how dispersed is the
 * per-row total_tokens distribution relative to its own mean?**
 * (i.e. how "wide" is a typical row, in units of typical-row-
 * size?)
 *
 * Definition. Given the source's `n` per-row `total_tokens`
 * samples `x_1, ..., x_n`, with sample mean `m = mean(x)` and
 * sample (population, ddof=0) standard deviation
 * `s = sqrt(mean((x - m)^2))`, the coefficient of variation is:
 *
 *     cv = s / m                  (defined only when m > 0)
 *
 * - `cv = 0`              : all rows identical (zero dispersion).
 * - `cv ~ 0.1`            : rows tightly clustered around the
 *                           mean (~10% relative spread).
 * - `cv ~ 0.5`            : moderate dispersion; one stddev is
 *                           half the mean.
 * - `cv = 1.0`            : stddev equals mean — the canonical
 *                           "exponential-distribution" baseline
 *                           and the dispersion floor for any
 *                           non-trivial heavy-tailed series with
 *                           a strict zero floor.
 * - `cv >> 1.0`           : per-row sizes are extremely spread
 *                           out relative to the mean; a few rows
 *                           dwarf the typical row by an order of
 *                           magnitude or more.
 *
 * CV is **scale-free** (multiplying every row by the same
 * constant does not change `cv`), which is its key property:
 * a small-token source and a large-token source can be compared
 * on the same axis. This is what makes it qualitatively
 * different from variance, fano factor, or stddev — all of
 * which carry token units and grow with absolute scale.
 *
 * Why this is genuinely orthogonal to every existing per-source
 * dispersion / shape lens in the codebase:
 *
 *   - `source-burstiness-fano-factor` reports `variance / mean`
 *     of **per-source-active-day** `total_tokens` totals. Two
 *     differences: (1) Fano = variance / mean (carries token
 *     units, not scale-free); CV = stddev / mean (dimensionless,
 *     scale-free). They rank sources differently — a source
 *     with a high mean and a moderate spread can have a high
 *     Fano (because variance scales as the square of the values)
 *     but a low CV (because stddev grows only linearly).
 *     Concretely: doubling every value doubles the Fano factor
 *     but leaves CV unchanged. (2) Fano operates on day totals
 *     (one observation per active day); CV here operates on
 *     **per-row** values (typically tens-to-thousands of
 *     observations per source). A source with smooth daily
 *     totals but per-row spikiness has low Fano + high CV.
 *   - `source-row-token-skewness` (v0.6.81) is the **3rd**
 *     standardised moment — asymmetry / tail direction. CV is
 *     a **2nd**-moment statistic — dispersion magnitude,
 *     scale-normalised. They are mathematically independent:
 *     a Normal(mu, sigma) has g1 = 0 for any sigma, while CV =
 *     sigma / mu varies arbitrarily; an exponential has CV = 1
 *     and g1 = 2 (any rate parameter). A symmetric high-CV
 *     source has zero skewness; a heavily right-skewed source
 *     can have low or high CV depending on how big the tail is
 *     relative to the bulk.
 *   - `source-row-token-kurtosis` (v0.6.82) is the **4th**
 *     standardised moment — tail weight / peakedness. Same
 *     logic as the skewness comparison: CV is the 2nd, kurtosis
 *     the 4th, mathematically independent.
 *   - `source-output-tokens-per-row-percentiles` reports
 *     p50/p90/p99 of per-row **`output_tokens`** (NOT
 *     `total_tokens`). It is a quantile shape on a different
 *     numerator. A source whose `output_tokens` distribution
 *     has a tight p50/p90 ratio can still have a high CV on
 *     `total_tokens` if `input_tokens` is wildly variable.
 *   - `source-output-tokens-by-hour-cv` *also* reports CV, but
 *     on a wholly different sample: per-source `output_tokens`
 *     **aggregated by hour-of-day** (24 bins), then CV across
 *     those 24 bin totals. That is a **temporal** dispersion
 *     statistic — does the day have flat hour-of-day mass or
 *     spiky hour-of-day mass? The lens here is on raw per-row
 *     values with no hour bucketing whatsoever; sources can
 *     have flat hour-of-day mass (low hour-bucket CV) and
 *     still spiky per-row sizes (high per-row CV).
 *   - `source-gap-hours-cv` reports CV of inter-row hour gap
 *     lengths — a temporal cadence statistic on the *spacing*
 *     between rows. The lens here is on the *value* of each
 *     row, not its arrival time.
 *   - `source-cache-share-by-day-cv` and
 *     `source-reasoning-share-by-day-cv` report CV of daily
 *     ratios — a stability-of-mix statistic on a derived
 *     fraction. The lens here is on a raw count, not a ratio,
 *     and at row grain rather than day grain.
 *   - `source-io-ratio-stability` is CV of daily output/input
 *     ratio — a different ratio at day grain.
 *   - `burstiness` and `rolling-bucket-cv` are global / windowed
 *     CVs of token-per-bucket; not per-source row CV.
 *   - `source-input-token-top-row-share`,
 *     `source-cumulative-mass-half-life-day`,
 *     `source-cold-warm-row-ratio`,
 *     `source-zero-output-row-share`,
 *     `daily-token-gini-coefficient`, and
 *     `source-first-vs-last-quartile-output-mean-shift` are
 *     concentration / share / temporal statistics, not
 *     scale-free dispersion of per-row values.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect `total_tokens` values (clamp negative
 *      and non-finite values to 0; same convention as the rest
 *      of the codebase).
 *   4. Skip sources with `rowsKept < 2` — sample CV is undefined
 *      for n < 2 (no spread). Skipped surface as
 *      `droppedTooFewRowsForCv`.
 *   5. Compute mean and population stddev (ddof=0). If
 *      `mean = 0` (all rows zero, or no positive rows), CV is
 *      mathematically undefined — we report `cv = 0` and set
 *      `degenerate = true`. The operator can read the row and
 *      tell from the `mean = 0` column that the value was
 *      forced.
 *   6. Compute `cv = stddev / mean`.
 *   7. Apply display gates `--min-rows` (default 2, the absolute
 *      floor) and `--min-mean` (drop sources whose row mean is
 *      strictly below this — useful for suppressing tiny-row
 *      sources where the single-outlier-dominates problem
 *      inflates CV).
 *   8. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - All-zero rows: mean = 0, CV reported as 0 with
 *     `degenerate = true`. Surfaces in the table; not silently
 *     dropped. (A source that emits only `total_tokens = 0`
 *     rows is a real and interesting cohort — it is "perfectly
 *     stable" in a degenerate sense.)
 *   - Single non-zero row in n>=2: CV is finite but very large
 *     (mean is small, stddev is sqrt(non-zero variance)). The
 *     `degenerate` flag is `false` because mean > 0; the
 *     operator should read the row count column to gauge
 *     stability.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenCoefficientOfVariationOptions {
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
   * absolute floor for a sample 2nd moment). Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose per-row `total_tokens` mean is strictly below
   * this value. Useful for suppressing tiny-row sources where a
   * single outlier dominates the CV. Display filter only.
   * Suppressed rows surface as `droppedBelowMinMean`. Must be a
   * finite, non-negative number. Default 0 = no floor.
   */
  minMean?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'cv-desc' (default): cv desc (most dispersed first).
   *   - 'cv-asc':            cv asc (most uniform first).
   *   - 'rows':              rowsKept desc.
   *   - 'mean':              row mean desc.
   *   - 'stddev':            stddev desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'cv-desc' | 'cv-asc' | 'rows' | 'mean' | 'stddev' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenCoefficientOfVariationRow {
  source: string;
  rowsKept: number;
  mean: number;
  stddev: number;
  variance: number;
  cv: number;
  /** True iff mean = 0 (CV undefined; reported as 0). */
  degenerate: boolean;
}

export interface SourceRowTokenCoefficientOfVariationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMean: number;
  top: number | null;
  sort: 'cv-desc' | 'cv-asc' | 'rows' | 'mean' | 'stddev' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of kept rows across all sources. */
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForCv: number;
  droppedBelowMinRows: number;
  droppedBelowMinMean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenCoefficientOfVariationRow[];
}

const ABSOLUTE_MIN_ROWS = 2;

const VALID_SORTS = [
  'cv-desc',
  'cv-asc',
  'rows',
  'mean',
  'stddev',
  'source',
] as const;

export function buildSourceRowTokenCoefficientOfVariation(
  queue: QueueLine[],
  opts: SourceRowTokenCoefficientOfVariationOptions = {},
): SourceRowTokenCoefficientOfVariationReport {
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
  const sort = opts.sort ?? 'cv-desc';
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

  // Per-source -> array of total_tokens samples.
  const perSource = new Map<string, number[]>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) {
      continue;
    }
    if (untilMs !== null && ms >= untilMs) {
      continue;
    }

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
  let droppedTooFewRowsForCv = 0;
  const allRows: SourceRowTokenCoefficientOfVariationRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    if (samples.length < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForCv += 1;
      continue;
    }
    const n = samples.length;
    let sum = 0;
    for (let k = 0; k < n; k += 1) sum += samples[k] as number;
    const mean = sum / n;

    let m2 = 0; // sum of (x - mean)^2
    for (let k = 0; k < n; k += 1) {
      const d = (samples[k] as number) - mean;
      m2 += d * d;
    }
    const variance = m2 / n; // population variance, ddof=0
    const stddev = Math.sqrt(variance);
    const degenerate = mean === 0;
    const cv = degenerate ? 0 : stddev / mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      stddev,
      variance,
      cv,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMean = 0;
  const survived: SourceRowTokenCoefficientOfVariationRow[] = [];
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
    if (sort === 'cv-desc') primary = b.cv - a.cv;
    else if (sort === 'cv-asc') primary = a.cv - b.cv;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'mean') primary = b.mean - a.mean;
    else if (sort === 'stddev') primary = b.stddev - a.stddev;
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
    droppedTooFewRowsForCv,
    droppedBelowMinRows,
    droppedBelowMinMean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
