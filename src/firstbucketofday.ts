/**
 * first-bucket-of-day: per UTC calendar day, the earliest active
 * `hour_start` bucket — i.e. the "wake-up clock" of the workday.
 *
 * For each UTC calendar day in which at least one positive-token
 * row exists, we compute:
 *
 *   - day:           ISO date YYYY-MM-DD (UTC)
 *   - firstBucket:   ISO of the earliest `hour_start` on that day
 *                    with at least one positive-token row
 *   - firstHour:     0..23 — UTC hour-of-day of `firstBucket`
 *   - bucketsOnDay:  count of distinct active hour_start values
 *                    on that day
 *   - tokensOnDay:   sum of total_tokens on that day
 *
 * The report also summarises across all days: distinctDays, plus
 * the distribution of `firstHour` (min, max, mean, median, p25,
 * p75, mode). Mode is reported as the most-frequent firstHour
 * with its count and share-of-days; ties broken by lower hour.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `time-of-day` / `which-hour` / `peak-hour-share` distribute
 *     tokens or buckets across hour-of-day across the *whole*
 *     window — they tell you where mass lands, not when each
 *     individual day starts.
 *   - `weekday-share` / `weekend-vs-weekday` are day-of-week
 *     lenses, not start-of-day lenses.
 *   - `idle-gaps` / `interarrival` measure spacing between
 *     active buckets; they don't anchor to "first bucket of the
 *     calendar day".
 *   - `bucket-streak-length` measures consecutive-hour runs but
 *     a streak that crosses midnight isn't the same signal as
 *     "what hour did this day's work begin".
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface FirstBucketOfDayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Truncate `days[]` to the most-recent N days after sorting (sort
   * always: day desc — newest first). Display filter only — summary
   * stats (`distinctDays`, all `firstHour*` aggregates,
   * `totalTokens`) always reflect the full pre-cap population.
   * Suppressed rows surface as `droppedTopDays`. Default 0 = no cap.
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface FirstBucketOfDayRow {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** ISO of the earliest active hour_start on this day. */
  firstBucket: string;
  /** UTC hour-of-day 0..23 of `firstBucket`. */
  firstHour: number;
  /** Distinct active hour_start values on this day. */
  bucketsOnDay: number;
  /** Sum of total_tokens on this day. */
  tokensOnDay: number;
}

export interface FirstBucketOfDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Distinct UTC calendar days with at least one positive-token row. */
  distinctDays: number;
  /** Sum of total_tokens across the *full* population (pre top cap). */
  totalTokens: number;
  /** min firstHour observed across all days (null if no days). */
  firstHourMin: number | null;
  /** max firstHour observed across all days (null if no days). */
  firstHourMax: number | null;
  /** arithmetic mean of firstHour (null if no days). */
  firstHourMean: number | null;
  /** median firstHour (null if no days). */
  firstHourMedian: number | null;
  /** 25th percentile firstHour (null if no days). */
  firstHourP25: number | null;
  /** 75th percentile firstHour (null if no days). */
  firstHourP75: number | null;
  /** Most-frequent firstHour (lowest hour wins ties); null if no days. */
  firstHourMode: number | null;
  /** Number of days at `firstHourMode` (0 if no days). */
  firstHourModeCount: number;
  /** firstHourModeCount / distinctDays (0 if no days). */
  firstHourModeShare: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Day rows hidden by the `top` cap. */
  droppedTopDays: number;
  /** Per-day rows after sort (day desc) + top cap. */
  days: FirstBucketOfDayRow[];
}

export function buildFirstBucketOfDay(
  queue: QueueLine[],
  opts: FirstBucketOfDayOptions = {},
): FirstBucketOfDayReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
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

  interface Acc {
    firstMs: number;
    buckets: Set<string>;
    tokens: number;
  }
  const perDay = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
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
      droppedZeroTokens += 1;
      continue;
    }

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const day = new Date(ms).toISOString().slice(0, 10);
    let acc = perDay.get(day);
    if (!acc) {
      acc = { firstMs: ms, buckets: new Set<string>(), tokens: 0 };
      perDay.set(day, acc);
    }
    if (ms < acc.firstMs) acc.firstMs = ms;
    acc.buckets.add(q.hour_start);
    acc.tokens += tt;
  }

  // Build rows.
  const allDays: FirstBucketOfDayRow[] = [];
  let totalTokens = 0;
  for (const [day, acc] of perDay.entries()) {
    const firstBucketISO = new Date(acc.firstMs).toISOString();
    const firstHour = new Date(acc.firstMs).getUTCHours();
    allDays.push({
      day,
      firstBucket: firstBucketISO,
      firstHour,
      bucketsOnDay: acc.buckets.size,
      tokensOnDay: acc.tokens,
    });
    totalTokens += acc.tokens;
  }

  // Summary stats over the full population (not the windowed `kept`).
  const distinctDays = allDays.length;
  let firstHourMin: number | null = null;
  let firstHourMax: number | null = null;
  let firstHourMean: number | null = null;
  let firstHourMedian: number | null = null;
  let firstHourP25: number | null = null;
  let firstHourP75: number | null = null;
  let firstHourMode: number | null = null;
  let firstHourModeCount = 0;
  let firstHourModeShare = 0;

  if (distinctDays > 0) {
    const hours = allDays.map((d) => d.firstHour);
    const sorted = [...hours].sort((a, b) => a - b);
    firstHourMin = sorted[0]!;
    firstHourMax = sorted[sorted.length - 1]!;
    firstHourMean = hours.reduce((s, h) => s + h, 0) / distinctDays;
    firstHourMedian = percentile(sorted, 0.5);
    firstHourP25 = percentile(sorted, 0.25);
    firstHourP75 = percentile(sorted, 0.75);
    // mode: lowest-hour wins ties
    const counts = new Map<number, number>();
    for (const h of hours) counts.set(h, (counts.get(h) ?? 0) + 1);
    let bestCount = -1;
    let bestHour = 0;
    for (const [h, c] of counts.entries()) {
      if (c > bestCount || (c === bestCount && h < bestHour)) {
        bestCount = c;
        bestHour = h;
      }
    }
    firstHourMode = bestHour;
    firstHourModeCount = bestCount;
    firstHourModeShare = bestCount / distinctDays;
  }

  // Sort days desc (newest first).
  allDays.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));

  let droppedTopDays = 0;
  let kept: FirstBucketOfDayRow[] = allDays;
  if (top > 0 && kept.length > top) {
    droppedTopDays = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    top,
    distinctDays,
    totalTokens,
    firstHourMin,
    firstHourMax,
    firstHourMean,
    firstHourMedian,
    firstHourP25,
    firstHourP75,
    firstHourMode,
    firstHourModeCount,
    firstHourModeShare,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedTopDays,
    days: kept,
  };
}

/**
 * Linear-interpolation percentile (matches numpy default), but
 * because the underlying values are integer hours 0..23 we round
 * the result to the nearest integer for reporting clarity.
 */
function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = q * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  const interp = sortedAsc[lo]! + frac * (sortedAsc[hi]! - sortedAsc[lo]!);
  return Math.round(interp);
}
