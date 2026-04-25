/**
 * cache-hit-by-hour: prompt-cache effectiveness bucketed by
 * hour-of-day (0..23 in UTC), broken down per source.
 *
 * `cache-hit-ratio` already gives the cumulative cached-token /
 * input-token ratio per model. `time-of-day` already shows raw
 * token mass per hour. Neither answers the question this report
 * is built for: *does my cache effectiveness change across the
 * day?* A source that is 80% cached at 09:00 UTC but only 20%
 * cached at 23:00 UTC has a very different cost story from one
 * that holds 70%+ across all 24 hours, even when the daily total
 * cache ratio is identical.
 *
 * For each kept queue row we bucket `hour_start`'s UTC hour
 * (0..23) and accumulate `input_tokens` and `cached_input_tokens`
 * per (source, hour). The report emits:
 *
 *   - one row per hour (0..23) with global totals + cache ratio
 *   - one block per source with the same 24-hour breakdown plus
 *     a peak / trough hour pointer
 *   - dropped counters split by reason (bad hour_start, zero or
 *     negative input_tokens)
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Hour-of-day is UTC; we don't try to guess
 * the operator's timezone — `time-of-day` already supports `--tz`
 * and this report leaves that knob to a future flag.
 *
 * Window semantics match the rest of the suite: `since` inclusive,
 * `until` exclusive on `hour_start`.
 */
import type { QueueLine } from './types.js';

export interface CacheHitByHourOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop source rows whose total considered `input_tokens` across
   * the whole day is `< minInputTokens`. Display filter only — the
   * global `byHour[]` reflects the full population. Default 0.
   */
  minInputTokens?: number;
  /**
   * Truncate `bySource[]` to the top N by total input tokens.
   * Display filter only. Default 0 = no cap.
   */
  topSources?: number;
  /**
   * Restrict the entire computation to rows from a single source.
   * When set, `byHour[]` and totals reflect only that source, and
   * `bySource[]` will contain at most one entry. Useful when
   * isolating one producer's daily cache rhythm without the noise
   * of others sharing the same hour buckets. null = include all.
   */
  source?: string | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface CacheHitByHourBucket {
  /** UTC hour-of-day, 0..23. */
  hour: number;
  inputTokens: number;
  cachedInputTokens: number;
  /** cachedInputTokens / inputTokens, in [0,1]. 0 if input = 0. */
  cacheRatio: number;
  /** Number of queue rows that landed in this bucket. */
  rows: number;
}

export interface CacheHitByHourSource {
  source: string;
  inputTokens: number;
  cachedInputTokens: number;
  /** Daily ratio for this source, in [0,1]. 0 if input = 0. */
  cacheRatio: number;
  /** Hour with the highest cacheRatio (ties broken by hour asc). -1 if no rows. */
  peakHour: number;
  peakRatio: number;
  /** Hour with the lowest cacheRatio across hours that *had* input. -1 if none. */
  troughHour: number;
  troughRatio: number;
  /** Spread = peakRatio - troughRatio. 0 when only one hour had input. */
  spread: number;
  /** 24-element array, hour 0..23. Hours with no input have ratio 0 and rows 0. */
  byHour: CacheHitByHourBucket[];
}

export interface CacheHitByHourReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minInputTokens floor. */
  minInputTokens: number;
  /** Echo of resolved topSources cap (0 = no cap). */
  topSources: number;
  /** Sum of input_tokens across all kept rows. */
  totalInputTokens: number;
  /** Sum of cached_input_tokens across all kept rows. */
  totalCachedInputTokens: number;
  /** Global ratio across all kept rows. 0 if total input = 0. */
  globalCacheRatio: number;
  /** Distinct sources observed before display filters. */
  totalSources: number;
  /** Rows where hour_start did not parse as ISO. */
  droppedInvalidHourStart: number;
  /** Rows where input_tokens was non-finite or <= 0 (cache ratio is undefined for these). */
  droppedZeroInput: number;
  /** Source rows hidden by the minInputTokens floor. */
  droppedMinInputTokens: number;
  /** Source rows hidden by the topSources cap. */
  droppedTopSources: number;
  /** Rows dropped because they did not match the requested source. */
  droppedSourceFilter: number;
  /** Echo of the resolved source filter. null = no filter. */
  sourceFilter: string | null;
  /** 24-element global breakdown, hour 0..23. */
  byHour: CacheHitByHourBucket[];
  /** One row per kept source. Sorted by inputTokens desc, source asc on tie. */
  bySource: CacheHitByHourSource[];
}

function emptyBuckets(): { input: number; cached: number; rows: number }[] {
  const out: { input: number; cached: number; rows: number }[] = [];
  for (let i = 0; i < 24; i += 1) {
    out.push({ input: 0, cached: 0, rows: 0 });
  }
  return out;
}

function toBuckets(raw: { input: number; cached: number; rows: number }[]): CacheHitByHourBucket[] {
  return raw.map((b, i) => ({
    hour: i,
    inputTokens: b.input,
    cachedInputTokens: b.cached,
    cacheRatio: b.input > 0 ? b.cached / b.input : 0,
    rows: b.rows,
  }));
}

export function buildCacheHitByHour(
  queue: QueueLine[],
  opts: CacheHitByHourOptions = {},
): CacheHitByHourReport {
  const minInputTokens = opts.minInputTokens ?? 0;
  if (!Number.isFinite(minInputTokens) || minInputTokens < 0) {
    throw new Error(
      `minInputTokens must be a non-negative number (got ${opts.minInputTokens})`,
    );
  }
  const topSources = opts.topSources ?? 0;
  if (!Number.isInteger(topSources) || topSources < 0) {
    throw new Error(`topSources must be a non-negative integer (got ${opts.topSources})`);
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  const sourceFilter = opts.source != null && opts.source !== '' ? opts.source : null;

  const globalRaw = emptyBuckets();
  const perSource = new Map<string, { input: number; cached: number; raw: { input: number; cached: number; rows: number }[] }>();
  let droppedInvalidHourStart = 0;
  let droppedZeroInput = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const srcKey = typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && srcKey !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const input = Number(q.input_tokens);
    if (!Number.isFinite(input) || input <= 0) {
      droppedZeroInput += 1;
      continue;
    }
    let cached = Number(q.cached_input_tokens);
    if (!Number.isFinite(cached) || cached < 0) cached = 0;
    // Clamp: cached can never exceed input (defensive against bad rows).
    if (cached > input) cached = input;

    const hour = new Date(ms).getUTCHours();
    const gb = globalRaw[hour]!;
    gb.input += input;
    gb.cached += cached;
    gb.rows += 1;

    let s = perSource.get(srcKey);
    if (!s) {
      s = { input: 0, cached: 0, raw: emptyBuckets() };
      perSource.set(srcKey, s);
    }
    s.input += input;
    s.cached += cached;
    const sb = s.raw[hour]!;
    sb.input += input;
    sb.cached += cached;
    sb.rows += 1;
  }

  const totalInputTokens = globalRaw.reduce((s, b) => s + b.input, 0);
  const totalCachedInputTokens = globalRaw.reduce((s, b) => s + b.cached, 0);

  const totalSources = perSource.size;

  // Build source rows.
  const allSources: CacheHitByHourSource[] = [];
  for (const [source, s] of perSource.entries()) {
    const buckets = toBuckets(s.raw);
    let peakHour = -1;
    let peakRatio = -1;
    let troughHour = -1;
    let troughRatio = Number.POSITIVE_INFINITY;
    for (const b of buckets) {
      if (b.inputTokens <= 0) continue;
      if (b.cacheRatio > peakRatio) {
        peakRatio = b.cacheRatio;
        peakHour = b.hour;
      }
      if (b.cacheRatio < troughRatio) {
        troughRatio = b.cacheRatio;
        troughHour = b.hour;
      }
    }
    if (peakHour === -1) {
      peakRatio = 0;
      troughRatio = 0;
    }
    const spread = peakHour === -1 || troughHour === -1 ? 0 : peakRatio - troughRatio;
    allSources.push({
      source,
      inputTokens: s.input,
      cachedInputTokens: s.cached,
      cacheRatio: s.input > 0 ? s.cached / s.input : 0,
      peakHour,
      peakRatio,
      troughHour,
      troughRatio: peakHour === -1 ? 0 : troughRatio,
      spread,
      byHour: buckets,
    });
  }

  // Apply minInputTokens floor.
  let droppedMinInputTokens = 0;
  const afterMin: CacheHitByHourSource[] = [];
  for (const row of allSources) {
    if (row.inputTokens < minInputTokens) {
      droppedMinInputTokens += 1;
      continue;
    }
    afterMin.push(row);
  }

  afterMin.sort((a, b) => {
    if (b.inputTokens !== a.inputTokens) return b.inputTokens - a.inputTokens;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = afterMin;
  if (topSources > 0 && afterMin.length > topSources) {
    droppedTopSources = afterMin.length - topSources;
    kept = afterMin.slice(0, topSources);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minInputTokens,
    topSources,
    totalInputTokens,
    totalCachedInputTokens,
    globalCacheRatio: totalInputTokens > 0 ? totalCachedInputTokens / totalInputTokens : 0,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroInput,
    droppedMinInputTokens,
    droppedTopSources,
    droppedSourceFilter,
    sourceFilter,
    byHour: toBuckets(globalRaw),
    bySource: kept,
  };
}
