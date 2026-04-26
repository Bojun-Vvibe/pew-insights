/**
 * source-output-tokens-by-hour-cv: per-source coefficient of variation
 * of the **mean per-row output_tokens** grouped by UTC hour-of-day
 * (0..23). Surfaces *diurnal output regularity per source*.
 *
 * For each source, partition its rows by `hour_start.getUTCHours()`
 * into up to 24 buckets. For each populated bucket compute
 *
 *     hourMean_h = sum(output_tokens in bucket h) / rowCount_h
 *
 * — i.e. the source's typical per-row output size at that hour of
 * day. The headline value `hourCv` is the **population coefficient
 * of variation** (stddev / mean) of the `hourMean_h` sequence
 * across the source's *populated* hour buckets:
 *
 *     hourCv = stddev(hourMean_h) / mean(hourMean_h)
 *
 * Low CV = the source's per-row output size is the same shape no
 * matter what hour you look at (a steady streaming agent). High
 * CV = the source produces tiny replies at some hours and huge
 * replies at others (e.g. interactive chat in the morning,
 * background long-context summarization at night).
 *
 * Why a separate subcommand:
 *
 *   - `hour-of-day-token-skew` (and `hour-of-week`, `peak-hour`,
 *     `time-of-day`) are **global** views that mix every source
 *     into one signal. They cannot tell you that source A is
 *     diurnally lumpy while source B is flat.
 *   - `source-hour-of-day-token-mass-entropy` measures **mass
 *     concentration** across hours (Shannon entropy of the
 *     hourly token-mass distribution). A source can be highly
 *     entropic (mass spread across all 24 hours) while still
 *     having very different per-row output sizes per hour, and
 *     vice versa. Entropy is unaware of per-row scale.
 *   - `source-token-mass-hour-centroid` is a single circular
 *     mean of mass on the 24-hour clock; it discards all
 *     per-bucket variance.
 *   - `source-output-tokens-per-row-percentiles` is a *single*
 *     pooled percentile shape across all of a source's rows; it
 *     collapses the hour axis entirely.
 *   - `source-row-output-coefficient-of-variation` (if it
 *     existed) would be the CV across *rows* — much noisier
 *     and not aligned to the diurnal cycle. This metric instead
 *     averages within-hour first, then takes CV across the 24
 *     hour buckets, isolating the diurnal signal from row-level
 *     jitter.
 *   - `source-burstiness-fano-factor` and
 *     `source-daily-token-trend-slope` work on the *day* axis
 *     (variance/mean of per-day counts; OLS slope of per-day
 *     totals). Orthogonal axis to per-row size at fixed hour.
 *   - `source-cache-share-by-day-cv` and
 *     `source-reasoning-share-by-day-cv` are CVs of *share*
 *     (cached/input, reasoning/output), not of *size*.
 *
 * The metric is **scale-invariant** in row count: a source with
 * 10x more rows but the same per-hour output size profile gets
 * the same hourCv. That makes it useful for comparing a chatty
 * source to a sparse one on equal footing.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. For each (source, utc-hour-of-day) bucket, accumulate
 *      `sumOutput` and `rowCount` over `output_tokens >= 0`
 *      (negative or non-finite outputs are clamped to 0 like
 *      sibling subcommands).
 *   4. Per source: build the array `hourMeans[]` over populated
 *      hour buckets only. Compute population mean, population
 *      stddev, and CV in the conventional way.
 *   5. Display gates:
 *      - `--min-hours` (default 3): drop sources with fewer
 *        populated hour buckets than this floor. CV on <2
 *        samples is degenerate; <3 is statistically
 *        meaningless. Suppressed rows surface as
 *        `droppedBelowMinHours`.
 *      - `--min-rows` (default 1): drop sources with fewer total
 *        kept rows than this floor.
 *      - `--top` (default null): cap the per-source table.
 *
 * Edge cases:
 *
 *   - A source whose mean across hours is 0 (every populated
 *     hour bucket had `sum(output_tokens) == 0`) gets
 *     `hourCv = 0` by convention and `flatZero = true`.
 *   - A source with exactly 1 populated hour bucket fails the
 *     `--min-hours >= 2` floor and is suppressed; if `--min-hours 1`
 *     is forced it is reported with `singleHour = true` and
 *     `hourCv = 0`.
 *   - Population stddev (n-divisor, not n-1) so a 2-hour source
 *     does not produce a NaN.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceOutputTokensByHourCvOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer populated hour-of-day buckets than this
   * floor. Display filter only — global denominators reflect the
   * full kept population. Suppressed rows surface as
   * `droppedBelowMinHours`. Must be a positive integer in [1, 24].
   * Default 3.
   */
  minHours?: number;
  /**
   * Drop sources with fewer total kept rows than this floor. Display
   * filter only. Suppressed rows surface as `droppedBelowMinRows`.
   * Must be a positive integer. Default 1.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + floors.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokens desc.
   *   - 'cv':               hourCv desc (most diurnally lumpy first;
   *                         ties on tokens desc).
   *   - 'mean':             meanHourMean desc (biggest typical
   *                         per-row output first; ties on tokens
   *                         desc).
   *   - 'hours':            hoursPopulated desc; ties on tokens desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'cv' | 'mean' | 'hours' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceOutputTokensByHourCvRow {
  source: string;
  /** Sum of total_tokens across all kept rows for this source. */
  tokens: number;
  /** Sum of output_tokens (clamped >=0) across all kept rows. */
  outputTokens: number;
  /** Total kept row count for this source. */
  rowCount: number;
  /** Distinct UTC hour-of-day buckets populated by this source (0..24). */
  hoursPopulated: number;
  /** Arithmetic mean across populated hour buckets of (sumOutput/rowCount). */
  meanHourMean: number;
  /** Population stddev across populated hour buckets of hourMean_h. */
  stdHourMean: number;
  /**
   * stdHourMean / meanHourMean. Convention: 0 if meanHourMean == 0
   * (degenerate flat-zero source) — flagged with flatZero=true.
   */
  hourCv: number;
  /** True iff every populated hour had sum(output_tokens) == 0. */
  flatZero: boolean;
  /** True iff hoursPopulated === 1. */
  singleHour: boolean;
}

export interface SourceOutputTokensByHourCvReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minHours: number;
  minRows: number;
  top: number | null;
  sort: 'tokens' | 'cv' | 'mean' | 'hours' | 'source';
  /** Distinct sources that survived window/source filters. */
  totalSources: number;
  /** Sum of total_tokens across the full kept population. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinHours: number;
  droppedBelowMinRows: number;
  droppedBelowTopCap: number;
  sources: SourceOutputTokensByHourCvRow[];
}

export function buildSourceOutputTokensByHourCv(
  queue: QueueLine[],
  opts: SourceOutputTokensByHourCvOptions = {},
): SourceOutputTokensByHourCvReport {
  const minHours = opts.minHours ?? 3;
  if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
    throw new Error(
      `minHours must be an integer in [1, 24] (got ${opts.minHours})`,
    );
  }
  const minRows = opts.minRows ?? 1;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tokens';
  if (
    sort !== 'tokens' &&
    sort !== 'cv' &&
    sort !== 'mean' &&
    sort !== 'hours' &&
    sort !== 'source'
  ) {
    throw new Error(
      `sort must be 'tokens' | 'cv' | 'mean' | 'hours' | 'source' (got ${opts.sort})`,
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

  interface HourAgg {
    sumOutput: number;
    rowCount: number;
  }
  interface SourceAgg {
    perHour: Map<number, HourAgg>;
    totalTokens: number;
    totalOutput: number;
    totalRows: number;
  }
  const perSource = new Map<string, SourceAgg>();

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

    const outT = Number(q.output_tokens);
    const totT = Number(q.total_tokens);
    const outSafe = Number.isFinite(outT) && outT > 0 ? outT : 0;
    const totSafe = Number.isFinite(totT) && totT > 0 ? totT : 0;

    let acc = perSource.get(source);
    if (!acc) {
      acc = {
        perHour: new Map<number, HourAgg>(),
        totalTokens: 0,
        totalOutput: 0,
        totalRows: 0,
      };
      perSource.set(source, acc);
    }
    const h = new Date(ms).getUTCHours();
    let hour = acc.perHour.get(h);
    if (!hour) {
      hour = { sumOutput: 0, rowCount: 0 };
      acc.perHour.set(h, hour);
    }
    hour.sumOutput += outSafe;
    hour.rowCount += 1;
    acc.totalTokens += totSafe;
    acc.totalOutput += outSafe;
    acc.totalRows += 1;
  }

  const allRows: SourceOutputTokensByHourCvRow[] = [];
  let totalTokens = 0;

  for (const [source, agg] of perSource.entries()) {
    if (agg.totalRows === 0) continue;
    totalTokens += agg.totalTokens;

    const hourMeans: number[] = [];
    for (const hour of agg.perHour.values()) {
      if (hour.rowCount > 0) {
        hourMeans.push(hour.sumOutput / hour.rowCount);
      }
    }
    const hoursPopulated = hourMeans.length;

    let meanHourMean = 0;
    let stdHourMean = 0;
    let hourCv = 0;
    let flatZero = false;

    if (hoursPopulated > 0) {
      let sum = 0;
      for (const m of hourMeans) sum += m;
      meanHourMean = sum / hoursPopulated;
      let sq = 0;
      for (const m of hourMeans) {
        const d = m - meanHourMean;
        sq += d * d;
      }
      stdHourMean = Math.sqrt(sq / hoursPopulated);
      if (meanHourMean === 0) {
        hourCv = 0;
        flatZero = true;
      } else {
        hourCv = stdHourMean / meanHourMean;
      }
    }

    allRows.push({
      source,
      tokens: agg.totalTokens,
      outputTokens: agg.totalOutput,
      rowCount: agg.totalRows,
      hoursPopulated,
      meanHourMean,
      stdHourMean,
      hourCv,
      flatZero,
      singleHour: hoursPopulated === 1,
    });
  }

  let droppedBelowMinHours = 0;
  let droppedBelowMinRows = 0;
  const survived: SourceOutputTokensByHourCvRow[] = [];
  for (const row of allRows) {
    if (row.hoursPopulated < minHours) {
      droppedBelowMinHours += 1;
      continue;
    }
    if (row.rowCount < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'cv') {
      primary = b.hourCv - a.hourCv;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'mean') {
      primary = b.meanHourMean - a.meanHourMean;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'hours') {
      primary = b.hoursPopulated - a.hoursPopulated;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else {
      // 'source'
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
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
    minHours,
    minRows,
    top,
    sort,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinHours,
    droppedBelowMinRows,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
