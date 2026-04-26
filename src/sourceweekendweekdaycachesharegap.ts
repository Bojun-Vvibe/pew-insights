/**
 * source-weekend-weekday-cache-share-gap: per-source comparison of
 * **input-token cache hit share** between weekday (Mon..Fri UTC) and
 * weekend (Sat..Sun UTC) buckets.
 *
 * For each source we partition every hourly queue row by UTC day-of-week
 * into "weekday" (Mon..Fri) and "weekend" (Sat..Sun), then compute, on
 * each side,
 *
 *   cacheShare_side = sum(cached_input_tokens_side) /
 *                     sum(input_tokens_side)
 *
 * and report:
 *
 *   - weekdayCacheShare in [0, 1]: pooled cache hit share over Mon..Fri
 *     buckets. NaN-coded as `null` when `weekdayInputTokens == 0`.
 *   - weekendCacheShare in [0, 1]: pooled cache hit share over Sat..Sun
 *     buckets. `null` when `weekendInputTokens == 0`.
 *   - shareGap in [-1, 1]: `weekendCacheShare - weekdayCacheShare`.
 *     Positive = source caches *more* on weekends than weekdays;
 *     negative = caches *less*. `null` when either side is `null`.
 *   - absShareGap in [0, 1]: |shareGap|. `null` when shareGap is null.
 *     Useful for "which sources behave most *differently* on weekends
 *     regardless of direction."
 *   - shareRatio in [0, +inf): `weekendCacheShare / weekdayCacheShare`
 *     when `weekdayCacheShare > 0`, else `null`. 1.0 means parity;
 *     >1 means relatively more cached on weekends.
 *   - weekdayBuckets / weekendBuckets: count of contributing hourly
 *     buckets on each side. Useful as a sample-size sanity check.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `cache-hit-ratio` reports a *single global* cached/input share,
 *     not split by day-of-week and not split by source.
 *   - `cache-hit-by-hour` splits cache share by UTC hour-of-day across
 *     the whole queue; it does not split by source and does not
 *     expose a weekday-vs-weekend axis.
 *   - `weekend-vs-weekday` (the existing global subcommand) compares
 *     *token volume* and bucket counts between weekday and weekend
 *     buckets; it does not look at the cached-share axis.
 *   - `source-day-of-week-token-mass-share` measures *token mass*
 *     distribution across the seven day-of-week bins per source; it
 *     does not measure cache-hit share and does not collapse to the
 *     weekday/weekend partition.
 *   - All of the source-* hour-of-day subcommands operate on the
 *     24-hour clock, not on the weekday/weekend partition, and on
 *     *total* tokens rather than cached/input.
 *
 * Headline question:
 *   **"For each source, does its input-token cache hit share differ
 *   on weekends vs weekdays, and by how much?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minInputTokens` (default 1000): structural floor on **total**
 *     input_tokens (weekday + weekend) for a source row to be
 *     reported. Sparse sources surface as `droppedSparseSources`.
 *   - `minInputTokensEachSide` (refinement, v0.6.50): require **both**
 *     `weekdayInputTokens >= n` AND `weekendInputTokens >= n` for a
 *     source row to be reported. Default 0 = no per-side floor.
 *     Useful for surfacing only sources with a comparable sample on
 *     both sides (so the gap isn't dominated by one tiny side).
 *     Suppressed surface as `droppedBelowMinInputTokensEachSide`.
 *     Filter order: `since`/`until` window -> `source` filter ->
 *     `minInputTokens` (pooled) -> `minInputTokensEachSide` (per side)
 *     -> sort -> `top` cap.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'absgap'): 'absgap' | 'gap' | 'ratio' |
 *     'weekday' | 'weekend' | 'tokens' | 'source'. 'absgap' sorts by
 *     `absShareGap` desc with `null` last; 'gap' sorts by `shareGap`
 *     desc with `null` last; 'ratio' sorts by `shareRatio` desc with
 *     `null` last; 'weekday'/'weekend' sort by the named cache share
 *     desc with `null` last; 'tokens' sorts by `inputTokens` desc;
 *     'source' sorts alphabetically.
 *   - `tz` is intentionally NOT a knob: day-of-week is read from the
 *     UTC timestamp, matching every other time-axis stat in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type SourceWeekendWeekdayCacheShareGapSort =
  | 'absgap'
  | 'gap'
  | 'ratio'
  | 'weekday'
  | 'weekend'
  | 'tokens'
  | 'source';

export interface SourceWeekendWeekdayCacheShareGapOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minInputTokens?: number;
  /**
   * Display filter (refinement, v0.6.50): require both
   * `weekdayInputTokens >= n` AND `weekendInputTokens >= n`. Default
   * 0 = no per-side floor. Use to surface only sources with a
   * comparable sample on both sides so the gap isn't dominated by
   * one tiny side. Suppressed surface as
   * `droppedBelowMinInputTokensEachSide`.
   */
  minInputTokensEachSide?: number;
  top?: number;
  sort?: SourceWeekendWeekdayCacheShareGapSort;
  generatedAt?: string;
}

export interface SourceWeekendWeekdayCacheShareGapSourceRow {
  source: string;
  /** Sum of input_tokens across all contributing rows. */
  inputTokens: number;
  /** Sum of cached_input_tokens across all contributing rows. */
  cachedInputTokens: number;
  /** Count of all contributing hourly buckets. */
  nBuckets: number;
  weekdayInputTokens: number;
  weekdayCachedInputTokens: number;
  weekdayBuckets: number;
  weekendInputTokens: number;
  weekendCachedInputTokens: number;
  weekendBuckets: number;
  /** weekdayCachedInputTokens / weekdayInputTokens, or null if 0 input. */
  weekdayCacheShare: number | null;
  /** weekendCachedInputTokens / weekendInputTokens, or null if 0 input. */
  weekendCacheShare: number | null;
  /** weekendCacheShare - weekdayCacheShare, or null if either is null. */
  shareGap: number | null;
  /** |shareGap|, or null if shareGap is null. */
  absShareGap: number | null;
  /** weekendCacheShare / weekdayCacheShare when weekdayCacheShare > 0, else null. */
  shareRatio: number | null;
}

export interface SourceWeekendWeekdayCacheShareGapReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minInputTokens: number;
  minInputTokensEachSide: number;
  top: number;
  sort: SourceWeekendWeekdayCacheShareGapSort;
  source: string | null;
  totalInputTokens: number;
  totalCachedInputTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinInputTokensEachSide: number;
  droppedTopSources: number;
  sources: SourceWeekendWeekdayCacheShareGapSourceRow[];
}

/**
 * Returns true when `dow` (UTC day-of-week as returned by Date#getUTCDay,
 * Sunday=0..Saturday=6) is a weekend day (Sat=6 or Sun=0).
 */
export function isWeekendUtc(dow: number): boolean {
  return dow === 0 || dow === 6;
}

export function buildSourceWeekendWeekdayCacheShareGap(
  queue: QueueLine[],
  opts: SourceWeekendWeekdayCacheShareGapOptions = {},
): SourceWeekendWeekdayCacheShareGapReport {
  const minInputTokens = opts.minInputTokens ?? 1000;
  if (!Number.isFinite(minInputTokens) || minInputTokens < 0) {
    throw new Error(
      `minInputTokens must be a non-negative finite number (got ${opts.minInputTokens})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minInputTokensEachSide = opts.minInputTokensEachSide ?? 0;
  if (
    !Number.isFinite(minInputTokensEachSide) ||
    minInputTokensEachSide < 0
  ) {
    throw new Error(
      `minInputTokensEachSide must be a non-negative finite number (got ${opts.minInputTokensEachSide})`,
    );
  }
  const sort: SourceWeekendWeekdayCacheShareGapSort = opts.sort ?? 'absgap';
  const validSorts: SourceWeekendWeekdayCacheShareGapSort[] = [
    'absgap',
    'gap',
    'ratio',
    'weekday',
    'weekend',
    'tokens',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(
      `source must be a string when set (got ${typeof sourceFilter})`,
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

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface SrcAcc {
    weekdayInput: number;
    weekdayCached: number;
    weekdayBuckets: number;
    weekendInput: number;
    weekendCached: number;
    weekendBuckets: number;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const inp = Number(q.input_tokens);
    const cached = Number(q.cached_input_tokens);
    const inpSafe = Number.isFinite(inp) && inp > 0 ? inp : 0;
    const cachedSafe = Number.isFinite(cached) && cached > 0 ? cached : 0;
    const dow = new Date(ms).getUTCDay();
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        weekdayInput: 0,
        weekdayCached: 0,
        weekdayBuckets: 0,
        weekendInput: 0,
        weekendCached: 0,
        weekendBuckets: 0,
      };
      agg.set(src, acc);
    }
    if (isWeekendUtc(dow)) {
      acc.weekendInput += inpSafe;
      acc.weekendCached += cachedSafe;
      acc.weekendBuckets += 1;
    } else {
      acc.weekdayInput += inpSafe;
      acc.weekdayCached += cachedSafe;
      acc.weekdayBuckets += 1;
    }
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalInputTokens = 0;
  let totalCachedInputTokens = 0;
  const rows: SourceWeekendWeekdayCacheShareGapSourceRow[] = [];

  for (const [src, acc] of agg) {
    const inputTokens = acc.weekdayInput + acc.weekendInput;
    const cachedInputTokens = acc.weekdayCached + acc.weekendCached;
    if (inputTokens < minInputTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const weekdayCacheShare =
      acc.weekdayInput > 0 ? acc.weekdayCached / acc.weekdayInput : null;
    const weekendCacheShare =
      acc.weekendInput > 0 ? acc.weekendCached / acc.weekendInput : null;
    const shareGap =
      weekdayCacheShare !== null && weekendCacheShare !== null
        ? weekendCacheShare - weekdayCacheShare
        : null;
    const absShareGap = shareGap !== null ? Math.abs(shareGap) : null;
    const shareRatio =
      weekdayCacheShare !== null &&
      weekendCacheShare !== null &&
      weekdayCacheShare > 0
        ? weekendCacheShare / weekdayCacheShare
        : null;
    rows.push({
      source: src,
      inputTokens,
      cachedInputTokens,
      nBuckets: acc.weekdayBuckets + acc.weekendBuckets,
      weekdayInputTokens: acc.weekdayInput,
      weekdayCachedInputTokens: acc.weekdayCached,
      weekdayBuckets: acc.weekdayBuckets,
      weekendInputTokens: acc.weekendInput,
      weekendCachedInputTokens: acc.weekendCached,
      weekendBuckets: acc.weekendBuckets,
      weekdayCacheShare,
      weekendCacheShare,
      shareGap,
      absShareGap,
      shareRatio,
    });
    totalInputTokens += inputTokens;
    totalCachedInputTokens += cachedInputTokens;
  }

  // refinement filter (v0.6.50): require both sides to clear the per-side floor
  let droppedBelowMinInputTokensEachSide = 0;
  let filtered = rows;
  if (minInputTokensEachSide > 0) {
    const next: SourceWeekendWeekdayCacheShareGapSourceRow[] = [];
    for (const r of rows) {
      if (
        r.weekdayInputTokens >= minInputTokensEachSide &&
        r.weekendInputTokens >= minInputTokensEachSide
      ) {
        next.push(r);
      } else {
        droppedBelowMinInputTokensEachSide += 1;
      }
    }
    filtered = next;
  }

  // sort: nulls always go last on numeric keys; ties broken by source asc
  const cmpNullableDesc = (a: number | null, b: number | null): number => {
    const aNull = a === null;
    const bNull = b === null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return (b as number) - (a as number);
  };

  const cmpRow = (
    a: SourceWeekendWeekdayCacheShareGapSourceRow,
    b: SourceWeekendWeekdayCacheShareGapSourceRow,
  ): number => {
    let primary = 0;
    switch (sort) {
      case 'gap':
        primary = cmpNullableDesc(a.shareGap, b.shareGap);
        break;
      case 'ratio':
        primary = cmpNullableDesc(a.shareRatio, b.shareRatio);
        break;
      case 'weekday':
        primary = cmpNullableDesc(a.weekdayCacheShare, b.weekdayCacheShare);
        break;
      case 'weekend':
        primary = cmpNullableDesc(a.weekendCacheShare, b.weekendCacheShare);
        break;
      case 'tokens':
        primary = b.inputTokens - a.inputTokens;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absgap':
      default:
        primary = cmpNullableDesc(a.absShareGap, b.absShareGap);
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  };
  filtered.sort(cmpRow);

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minInputTokens,
    minInputTokensEachSide,
    top,
    sort,
    source: sourceFilter,
    totalInputTokens,
    totalCachedInputTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinInputTokensEachSide,
    droppedTopSources,
    sources: kept,
  };
}
