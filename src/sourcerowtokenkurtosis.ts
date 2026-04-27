/**
 * source-row-token-kurtosis: per-source sample **excess** kurtosis
 * (Fisher `g2`) of per-row `total_tokens` distribution.
 *
 * Headline question: **for each source, how heavy-tailed and
 * peaked is the per-row total_tokens distribution relative to a
 * Normal?**
 *
 * Definition. Given the source's `n` per-row `total_tokens`
 * samples `x_1, ..., x_n`, with sample mean `m`, second central
 * moment `m2 = (1/n) sum (x_i - m)^2`, and fourth central
 * moment `m4 = (1/n) sum (x_i - m)^4`, the Fisher excess kurtosis
 * is:
 *
 *     g2 = m4 / (m2^2) - 3
 *
 * The `-3` makes a Normal distribution have `g2 = 0`. So:
 *
 * - `g2 = 0`  : mesokurtic (Normal-like tail thickness).
 * - `g2 > 0`  : leptokurtic — heavier tails AND a more peaked
 *               centre than a Normal of the same variance. Both
 *               extreme-row events and "typical small row"
 *               events are more common than a Normal would
 *               predict; the variance is "earned" disproportion-
 *               ately by the tail. The textbook shape for token
 *               usage with rare massive background runs.
 * - `g2 < 0`  : platykurtic — tails THINNER and shoulders wider
 *               than a Normal. A perfectly bounded (e.g.
 *               uniform) distribution has `g2 = -1.2`. Indicates
 *               a source whose row sizes are bounded into a
 *               narrow band with no extreme outliers.
 *
 * Rule-of-thumb reading: `|g2| < 1` ~ Normal-ish, `1 <= g2 < 4`
 * moderately leptokurtic, `g2 >= 4` heavily leptokurtic (a
 * Laplace distribution has `g2 = 3`; an exponential has `g2 = 6`;
 * the kurtosis of a fat-tailed log-normal can run into the
 * hundreds). Negative `g2` is rare in token data.
 *
 * Why this is genuinely orthogonal to every per-source lens
 * already in the codebase (incl. v0.6.81 skewness):
 *
 *   - `source-row-token-skewness` (v0.6.81) is the **3rd**
 *     standardised moment. Skewness measures asymmetry (tail
 *     direction). Kurtosis measures **tail weight + peakedness**
 *     (4th moment). They are mathematically independent: a
 *     symmetric Laplace distribution has `g1 = 0` and `g2 = 3`
 *     (high kurtosis, zero skew); a triangular distribution has
 *     `g1 = 0` and `g2 = -0.6` (low kurtosis, zero skew); a
 *     skewed distribution can have any kurtosis. So a high-skew
 *     low-kurtosis source has an asymmetric body but no fat
 *     tail beyond the asymmetry — versus a high-skew high-
 *     kurtosis source where rare extreme rows dominate the
 *     fourth moment.
 *   - `source-burstiness-fano-factor` is `variance / mean` of
 *     per-source-active-day totals (2nd moment, on day totals).
 *     Kurtosis is the 4th moment on per-row values. A perfectly
 *     symmetric high-Fano source has zero excess kurtosis if
 *     the per-row distribution is Normal.
 *   - `source-output-tokens-per-row-percentiles` reports
 *     p50/p90/p99 — quantile shape on `output_tokens`. Kurtosis
 *     integrates the entire tail (to the 4th power) on
 *     `total_tokens`. A source with p99 >> p90 is suggestive
 *     of high kurtosis but not the same statistic.
 *   - `source-input-token-top-row-share` is mass concentration
 *     on input tokens, not a moment statistic.
 *   - `source-output-token-benford-deviation` is digit-distrib
 *     test, not a moment.
 *   - `source-cumulative-mass-half-life-day` and
 *     `source-first-vs-last-quartile-output-mean-shift` are
 *     temporal / chronological lenses; kurtosis is one-shot
 *     pooled and time-axis-free.
 *   - `daily-token-gini-coefficient` is cross-day inequality;
 *     a perfectly mesokurtic source can still have any gini.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect `total_tokens` values (clamp negative
 *      and non-finite values to 0; same convention as the rest
 *      of the codebase).
 *   4. Skip sources with `rowsKept < 4` — sample 4th moment is
 *      undefined for n < 4 (degenerate).  Surfaced as
 *      `droppedTooFewRowsForKurtosis`.
 *   5. Compute mean, m2, m4. If m2 = 0 (all rows identical),
 *      kurtosis is mathematically undefined — we report
 *      `excessKurtosis = 0` and set `degenerate = true`.
 *   6. Compute `g2 = m4 / (m2^2) - 3`.
 *   7. Apply display gates: `--min-rows` (default 4, the
 *      absolute floor) and `--min-mean`.
 *   8. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenKurtosisOptions {
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
   * `droppedBelowMinRows`. Must be a positive integer >= 4 (the
   * absolute floor for a sample 4th moment). Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose per-row `total_tokens` mean is strictly below
   * this value. Display filter only.  Suppressed rows surface as
   * `droppedBelowMinMean`. Must be finite and non-negative.
   * Default 0 = no floor.
   */
  minMean?: number;
  /**
   * Drop sources whose `|excessKurtosis|` is strictly below this
   * value. Useful for surfacing only meaningfully non-Normal sources
   * (e.g. `--min-abs-kurt 1` hides everything in the rule-of-thumb
   * "approximately mesokurtic" band; `--min-abs-kurt 3` hides
   * everything below "Laplace-grade" tail weight). Display filter
   * only. Suppressed rows surface as `droppedBelowMinAbsKurt`. Must
   * be a finite, non-negative number. Default 0 = no floor
   * (preserves v0.6.83 behaviour exactly).
   */
  minAbsKurt?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'kurt-desc' (default): excess kurtosis desc (heaviest-tailed first).
   *   - 'kurt-asc':            excess kurtosis asc (most platykurtic first).
   *   - 'abs-kurt':            |excess kurtosis| desc.
   *   - 'rows':                rowsKept desc.
   *   - 'mean':                row mean desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'kurt-desc' | 'kurt-asc' | 'abs-kurt' | 'rows' | 'mean' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenKurtosisRow {
  source: string;
  rowsKept: number;
  mean: number;
  variance: number;
  stddev: number;
  /** Excess kurtosis g2 = m4 / m2^2 - 3 (Normal = 0). */
  excessKurtosis: number;
  absExcessKurtosis: number;
  /** True iff variance = 0 (kurtosis undefined; reported as 0). */
  degenerate: boolean;
}

export interface SourceRowTokenKurtosisReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMean: number;
  minAbsKurt: number;
  top: number | null;
  sort: 'kurt-desc' | 'kurt-asc' | 'abs-kurt' | 'rows' | 'mean' | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForKurtosis: number;
  droppedBelowMinRows: number;
  droppedBelowMinMean: number;
  droppedBelowMinAbsKurt: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenKurtosisRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'kurt-desc',
  'kurt-asc',
  'abs-kurt',
  'rows',
  'mean',
  'source',
] as const;

export function buildSourceRowTokenKurtosis(
  queue: QueueLine[],
  opts: SourceRowTokenKurtosisOptions = {},
): SourceRowTokenKurtosisReport {
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
  const minAbsKurt = opts.minAbsKurt ?? 0;
  if (!Number.isFinite(minAbsKurt) || minAbsKurt < 0) {
    throw new Error(
      `minAbsKurt must be a finite, non-negative number (got ${opts.minAbsKurt})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'kurt-desc';
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
  let droppedTooFewRowsForKurtosis = 0;
  const allRows: SourceRowTokenKurtosisRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    if (samples.length < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForKurtosis += 1;
      continue;
    }
    const n = samples.length;
    let sum = 0;
    for (let k = 0; k < n; k += 1) sum += samples[k] as number;
    const mean = sum / n;

    let m2 = 0;
    let m4 = 0;
    for (let k = 0; k < n; k += 1) {
      const d = (samples[k] as number) - mean;
      const d2 = d * d;
      m2 += d2;
      m4 += d2 * d2;
    }
    const variance = m2 / n; // population variance, ddof=0
    const stddev = Math.sqrt(variance);
    const m2bar = variance; // = m2 / n
    const m4bar = m4 / n;
    const degenerate = variance === 0;
    const excessKurtosis = degenerate ? 0 : m4bar / (m2bar * m2bar) - 3;
    const absExcessKurtosis = Math.abs(excessKurtosis);

    allRows.push({
      source,
      rowsKept: n,
      mean,
      variance,
      stddev,
      excessKurtosis,
      absExcessKurtosis,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMean = 0;
  let droppedBelowMinAbsKurt = 0;
  const survived: SourceRowTokenKurtosisRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.mean < minMean) {
      droppedBelowMinMean += 1;
      continue;
    }
    if (row.absExcessKurtosis < minAbsKurt) {
      droppedBelowMinAbsKurt += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'kurt-desc') primary = b.excessKurtosis - a.excessKurtosis;
    else if (sort === 'kurt-asc') primary = a.excessKurtosis - b.excessKurtosis;
    else if (sort === 'abs-kurt')
      primary = b.absExcessKurtosis - a.absExcessKurtosis;
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
    minAbsKurt,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedTooFewRowsForKurtosis,
    droppedBelowMinRows,
    droppedBelowMinMean,
    droppedBelowMinAbsKurt,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
