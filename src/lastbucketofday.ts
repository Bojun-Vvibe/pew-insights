/**
 * last-bucket-of-day: per UTC calendar day, the latest active
 * `hour_start` bucket — i.e. the "shutdown clock" of the workday.
 *
 * For each UTC calendar day in which at least one positive-token
 * row exists, we compute:
 *
 *   - day:           ISO date YYYY-MM-DD (UTC)
 *   - lastBucket:    ISO of the latest `hour_start` on that day
 *                    with at least one positive-token row
 *   - lastHour:      0..23 — UTC hour-of-day of `lastBucket`
 *   - bucketsOnDay:  count of distinct active hour_start values
 *                    on that day
 *   - tokensOnDay:   sum of total_tokens on that day
 *
 * The report also summarises across all days: distinctDays, plus
 * the distribution of `lastHour` (min, max, mean, median, p25,
 * p75, mode). Mode is reported as the most-frequent lastHour
 * with its count and share-of-days; ties broken by **higher**
 * hour (the *latest* hour wins ties — symmetric to `first-bucket-
 * of-day`'s lower-hour tiebreak).
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `first-bucket-of-day` is the symmetric *start* signal; this
 *     is the *stop* signal. A day with first=09 and last=17 is a
 *     very different shape from first=09 and last=23 even if
 *     `time-of-day` distributes their tokens identically.
 *   - `active-span-per-day` reports first/last/span/duty as a
 *     joint per-day record, but it's a wide-row dashboard, not a
 *     focused distribution lens on the *end*-of-day hour. It does
 *     not report lastHour quantiles / mode / mode-share.
 *   - `time-of-day` / `which-hour` / `peak-hour-share` are
 *     window-wide hour distributions; they don't anchor to the
 *     daily stop-time.
 *   - `idle-gaps` / `interarrival` / `bucket-streak-length`
 *     measure spacing or runs, not the calendar-day shutdown
 *     anchor.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface LastBucketOfDayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Truncate `days[]` to N rows after sorting. Display filter only —
   * summary stats (`distinctDays`, all `lastHour*` aggregates,
   * `totalTokens`) always reflect the full pre-cap population.
   * Suppressed rows surface as `droppedTopDays`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `days[]`:
   *   - 'day' (default):     day desc (newest first)
   *   - 'last-hour':         lastHour desc (latest stop first)
   *   - 'tokens':            tokensOnDay desc (heaviest day first)
   *   - 'buckets':           bucketsOnDay desc (most-active day first)
   * Tiebreak in all non-default cases: day desc.
   */
  sort?: 'day' | 'last-hour' | 'tokens' | 'buckets';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface LastBucketOfDayRow {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** ISO of the latest active hour_start on this day. */
  lastBucket: string;
  /** UTC hour-of-day 0..23 of `lastBucket`. */
  lastHour: number;
  /** Distinct active hour_start values on this day. */
  bucketsOnDay: number;
  /** Sum of total_tokens on this day. */
  tokensOnDay: number;
}

export interface LastBucketOfDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved `sort` key. */
  sort: 'day' | 'last-hour' | 'tokens' | 'buckets';
  /** Distinct UTC calendar days with at least one positive-token row. */
  distinctDays: number;
  /** Sum of total_tokens across the *full* population (pre top cap). */
  totalTokens: number;
  /** min lastHour observed across all days (null if no days). */
  lastHourMin: number | null;
  /** max lastHour observed across all days (null if no days). */
  lastHourMax: number | null;
  /** arithmetic mean of lastHour (null if no days). */
  lastHourMean: number | null;
  /** median lastHour (null if no days). */
  lastHourMedian: number | null;
  /** 25th percentile lastHour (null if no days). */
  lastHourP25: number | null;
  /** 75th percentile lastHour (null if no days). */
  lastHourP75: number | null;
  /** Most-frequent lastHour (highest hour wins ties); null if no days. */
  lastHourMode: number | null;
  /** Number of days at `lastHourMode` (0 if no days). */
  lastHourModeCount: number;
  /** lastHourModeCount / distinctDays (0 if no days). */
  lastHourModeShare: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Day rows hidden by the `top` cap. */
  droppedTopDays: number;
  /** Per-day rows after sort + top cap. */
  days: LastBucketOfDayRow[];
}

export function buildLastBucketOfDay(
  queue: QueueLine[],
  opts: LastBucketOfDayOptions = {},
): LastBucketOfDayReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'day';
  if (
    sort !== 'day' &&
    sort !== 'last-hour' &&
    sort !== 'tokens' &&
    sort !== 'buckets'
  ) {
    throw new Error(
      `sort must be 'day' | 'last-hour' | 'tokens' | 'buckets' (got ${opts.sort})`,
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

  interface Acc {
    lastMs: number;
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
      acc = { lastMs: ms, buckets: new Set<string>(), tokens: 0 };
      perDay.set(day, acc);
    }
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.buckets.add(q.hour_start);
    acc.tokens += tt;
  }

  // Build rows.
  const allDays: LastBucketOfDayRow[] = [];
  let totalTokens = 0;
  for (const [day, acc] of perDay.entries()) {
    const lastBucketISO = new Date(acc.lastMs).toISOString();
    const lastHour = new Date(acc.lastMs).getUTCHours();
    allDays.push({
      day,
      lastBucket: lastBucketISO,
      lastHour,
      bucketsOnDay: acc.buckets.size,
      tokensOnDay: acc.tokens,
    });
    totalTokens += acc.tokens;
  }

  // Summary stats over the full population (not the windowed `kept`).
  const distinctDays = allDays.length;
  let lastHourMin: number | null = null;
  let lastHourMax: number | null = null;
  let lastHourMean: number | null = null;
  let lastHourMedian: number | null = null;
  let lastHourP25: number | null = null;
  let lastHourP75: number | null = null;
  let lastHourMode: number | null = null;
  let lastHourModeCount = 0;
  let lastHourModeShare = 0;

  if (distinctDays > 0) {
    const hours = allDays.map((d) => d.lastHour);
    const sorted = [...hours].sort((a, b) => a - b);
    lastHourMin = sorted[0]!;
    lastHourMax = sorted[sorted.length - 1]!;
    lastHourMean = hours.reduce((s, h) => s + h, 0) / distinctDays;
    lastHourMedian = percentile(sorted, 0.5);
    lastHourP25 = percentile(sorted, 0.25);
    lastHourP75 = percentile(sorted, 0.75);
    // mode: highest-hour wins ties (symmetric to first-bucket-of-day)
    const counts = new Map<number, number>();
    for (const h of hours) counts.set(h, (counts.get(h) ?? 0) + 1);
    let bestCount = -1;
    let bestHour = -1;
    for (const [h, c] of counts.entries()) {
      if (c > bestCount || (c === bestCount && h > bestHour)) {
        bestCount = c;
        bestHour = h;
      }
    }
    lastHourMode = bestHour;
    lastHourModeCount = bestCount;
    lastHourModeShare = bestCount / distinctDays;
  }

  // Sort days. Default 'day' desc; otherwise primary key with day desc tiebreak.
  allDays.sort((a, b) => {
    let primary = 0;
    if (sort === 'last-hour') primary = b.lastHour - a.lastHour;
    else if (sort === 'tokens') primary = b.tokensOnDay - a.tokensOnDay;
    else if (sort === 'buckets') primary = b.bucketsOnDay - a.bucketsOnDay;
    if (primary !== 0) return primary;
    return a.day < b.day ? 1 : a.day > b.day ? -1 : 0;
  });

  let droppedTopDays = 0;
  let kept: LastBucketOfDayRow[] = allDays;
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
    sort,
    distinctDays,
    totalTokens,
    lastHourMin,
    lastHourMax,
    lastHourMean,
    lastHourMedian,
    lastHourP25,
    lastHourP75,
    lastHourMode,
    lastHourModeCount,
    lastHourModeShare,
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
