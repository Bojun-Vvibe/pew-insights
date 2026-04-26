/**
 * source-row-token-skewness: per-source sample skewness
 * (Fisher-Pearson moment coefficient `g1`) of per-row
 * `total_tokens` distribution.
 *
 * Headline question: **for each source, is the per-row
 * total_tokens distribution symmetric, right-tailed (a few rare
 * fat rows pull the right tail), or left-tailed (rare anaemic
 * rows on the left)?**
 *
 * Definition. Given the source's `n` per-row `total_tokens`
 * samples `x_1, ..., x_n`, with sample mean `m = mean(x)` and
 * sample (population, ddof=0) variance `s^2 = mean((x - m)^2)`,
 * the Fisher-Pearson moment skewness is:
 *
 *     g1 = ( (1/n) * sum_i (x_i - m)^3 ) / s^3
 *
 * - `g1 = 0` for any symmetric distribution (Normal, Uniform,
 *   any reflection-invariant pdf).
 * - `g1 > 0` (right-skewed): mean is pulled to the right of the
 *   median by a heavy right tail. Most rows are smaller than
 *   the mean, a few are much larger. This is the textbook
 *   shape for token usage: lots of small interactive turns,
 *   occasional huge background runs.
 * - `g1 < 0` (left-skewed): the rare events are on the **low**
 *   end. Uncommon for token usage; would imply a source that
 *   normally emits long replies but occasionally emits a near-
 *   empty one (rate-limit, error-row, etc).
 *
 * As a sanity rule of thumb: |g1| < 0.5 is "approximately
 * symmetric", 0.5 <= |g1| < 1 is "moderately skewed", |g1| >= 1
 * is "highly skewed". These thresholds are not part of the
 * report — they are what an operator reading the column would
 * apply.
 *
 * Why this is genuinely orthogonal to existing per-source lenses:
 *
 *   - `hour-of-day-token-skew` ALSO computes g1, but on a wholly
 *     different sample: per-day `total_tokens` totals grouped
 *     by UTC hour-of-day, **pooled across all sources**. It
 *     answers "is hour-of-day h a steady or rare-burst hour
 *     globally?" — there is no per-source breakdown and the
 *     unit of observation is a day, not a row.
 *   - `source-burstiness-fano-factor` reports `variance / mean`
 *     of per-source-active-day totals. It captures dispersion
 *     (2nd moment), not asymmetry (3rd moment). A perfectly
 *     symmetric high-variance source has high Fano and zero
 *     skewness; a strictly right-skewed source with one fat
 *     row pulling the tail has both. Different statistic,
 *     different question. Also: Fano is on day totals,
 *     skewness here is on per-row values.
 *   - `source-output-tokens-per-row-percentiles` reports
 *     p50/p90/p99 of per-row `output_tokens` (NOT
 *     `total_tokens`). Percentiles describe shape via
 *     quantiles; skewness describes shape via the third
 *     standardised moment. A source with p50 = p90 but
 *     p99 >> p90 has a "p90-to-p99 jump" but skewness is
 *     specifically the moment that captures **all** of the
 *     mass above the mean cubed, not a single quantile gap.
 *   - `source-input-token-top-row-share` reports the share of
 *     the source's input-token mass concentrated in its top-K
 *     rows. That is a mass-share statistic on **input** tokens;
 *     this lens is a moment statistic on **total** tokens.
 *     They can disagree: a source with one fat input row and
 *     many fat output rows has a high top-row input share but
 *     a moderate total-token skewness.
 *   - `source-output-token-benford-deviation` measures leading-
 *     digit deviation from Benford's law. That is a digit-
 *     distribution test, not a moment statistic; a source with
 *     well-behaved leading digits and a heavy right tail has
 *     low Benford deviation and high skewness.
 *   - `source-cumulative-mass-half-life-day` measures temporal
 *     mass concentration. A source can be temporally stable
 *     (mass spread evenly across days) and still have a heavy
 *     right tail in the per-row distribution.
 *   - `source-first-vs-last-quartile-output-mean-shift` measures
 *     chronological drift in the mean. Skewness is a one-shot
 *     pooled distribution statistic with no time axis.
 *   - `daily-token-gini-coefficient` measures inequality of
 *     mass across days; gini and skewness are formally
 *     different (a perfectly bimodal symmetric distribution
 *     has high gini and zero skewness).
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect `total_tokens` values (clamp negative
 *      and non-finite values to 0; same convention as the rest
 *      of the codebase).
 *   4. Skip sources with `rowsKept < 3` — sample skewness is
 *      undefined for n < 3 (you need at least 3 samples to have
 *      a 3rd moment that is not degenerate, and 2 of them
 *      still produce a degenerate variance for the cube root
 *      step). Skipped sources surface as
 *      `droppedTooFewRowsForSkewness`.
 *   5. Compute mean, population variance, stddev. If stddev = 0
 *      (all rows identical, including all zeroes), skewness is
 *      mathematically undefined — we report `skewness = 0` and
 *      set `degenerate = true`. The operator can read the row
 *      and tell from the `mean = 0` (or `variance = 0`)
 *      column that the value was forced.
 *   6. Compute g1 and the absolute skewness `absSkewness`.
 *   7. Apply display gates `--min-rows` (default 3, the absolute
 *      floor) and `--min-mean` (drop sources whose row mean is
 *      strictly below this — useful for suppressing tiny-row
 *      sources where 3rd-moment estimation is dominated by a
 *      single outlier).
 *   8. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - All-zero rows: variance = 0, skewness reported as 0 with
 *     `degenerate = true`. Surfaces in the table; not silently
 *     dropped.
 *   - Single non-zero row in n>=3: skewness is finite but very
 *     large (one bin carries all the moment). The `degenerate`
 *     flag is `false` because variance > 0; the operator
 *     should read the row count column to gauge stability.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenSkewnessOptions {
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
   * `droppedBelowMinRows`. Must be a positive integer >= 3 (the
   * absolute floor for a sample 3rd moment). Default 3.
   */
  minRows?: number;
  /**
   * Drop sources whose per-row `total_tokens` mean is strictly below
   * this value. Useful for suppressing tiny-row sources where the
   * 3rd moment is dominated by a single outlier. Display filter
   * only. Suppressed rows surface as `droppedBelowMinMean`. Must be
   * a finite, non-negative number. Default 0 = no floor.
   */
  minMean?: number;
  /**
   * Drop sources whose `|skewness|` is strictly below this value.
   * Useful for surfacing only meaningfully asymmetric sources (e.g.
   * `--min-abs-skew 0.5` hides everything in the "approximately
   * symmetric" rule-of-thumb band). Display filter only. Suppressed
   * rows surface as `droppedBelowMinAbsSkew`. Must be a finite,
   * non-negative number. Default 0 = no floor (preserves v0.6.81
   * behaviour exactly).
   */
  minAbsSkew?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'skew-desc' (default): skewness desc (most right-skewed first).
   *   - 'skew-asc':            skewness asc (most left-skewed first).
   *   - 'abs-skew':            |skewness| desc (most asymmetric either way).
   *   - 'rows':                rowsKept desc.
   *   - 'mean':                row mean desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'skew-desc' | 'skew-asc' | 'abs-skew' | 'rows' | 'mean' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSkewnessRow {
  source: string;
  rowsKept: number;
  mean: number;
  variance: number;
  stddev: number;
  skewness: number;
  absSkewness: number;
  /** True iff stddev = 0 (skewness undefined; reported as 0). */
  degenerate: boolean;
}

export interface SourceRowTokenSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMean: number;
  minAbsSkew: number;
  top: number | null;
  sort: 'skew-desc' | 'skew-asc' | 'abs-skew' | 'rows' | 'mean' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of kept rows across all sources. */
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForSkewness: number;
  droppedBelowMinRows: number;
  droppedBelowMinMean: number;
  droppedBelowMinAbsSkew: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSkewnessRow[];
}

const ABSOLUTE_MIN_ROWS = 3;

const VALID_SORTS = [
  'skew-desc',
  'skew-asc',
  'abs-skew',
  'rows',
  'mean',
  'source',
] as const;

export function buildSourceRowTokenSkewness(
  queue: QueueLine[],
  opts: SourceRowTokenSkewnessOptions = {},
): SourceRowTokenSkewnessReport {
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
  const minAbsSkew = opts.minAbsSkew ?? 0;
  if (!Number.isFinite(minAbsSkew) || minAbsSkew < 0) {
    throw new Error(
      `minAbsSkew must be a finite, non-negative number (got ${opts.minAbsSkew})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'skew-desc';
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
  let droppedTooFewRowsForSkewness = 0;
  const allRows: SourceRowTokenSkewnessRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    if (samples.length < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForSkewness += 1;
      continue;
    }
    const n = samples.length;
    let sum = 0;
    for (let k = 0; k < n; k += 1) sum += samples[k] as number;
    const mean = sum / n;

    let m2 = 0; // sum of (x - mean)^2
    let m3 = 0; // sum of (x - mean)^3
    for (let k = 0; k < n; k += 1) {
      const d = (samples[k] as number) - mean;
      const d2 = d * d;
      m2 += d2;
      m3 += d2 * d;
    }
    const variance = m2 / n; // population variance, ddof=0
    const stddev = Math.sqrt(variance);
    const degenerate = stddev === 0;
    const skewness = degenerate ? 0 : m3 / n / (stddev * stddev * stddev);
    const absSkewness = Math.abs(skewness);

    allRows.push({
      source,
      rowsKept: n,
      mean,
      variance,
      stddev,
      skewness,
      absSkewness,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMean = 0;
  let droppedBelowMinAbsSkew = 0;
  const survived: SourceRowTokenSkewnessRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.mean < minMean) {
      droppedBelowMinMean += 1;
      continue;
    }
    if (row.absSkewness < minAbsSkew) {
      droppedBelowMinAbsSkew += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'skew-desc') primary = b.skewness - a.skewness;
    else if (sort === 'skew-asc') primary = a.skewness - b.skewness;
    else if (sort === 'abs-skew') primary = b.absSkewness - a.absSkewness;
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
    minAbsSkew,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedTooFewRowsForSkewness,
    droppedBelowMinRows,
    droppedBelowMinMean,
    droppedBelowMinAbsSkew,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
