/**
 * active-span-per-day: for each UTC calendar day with at least one
 * positive-token row, compute the *workday window* — i.e. the span
 * from the day's earliest active `hour_start` to its latest, and how
 * saturated that window is.
 *
 * Per day we report:
 *
 *   - day:            ISO date YYYY-MM-DD (UTC)
 *   - firstHour:      0..23 — UTC hour-of-day of earliest active bucket
 *   - lastHour:       0..23 — UTC hour-of-day of latest active bucket
 *   - spanHours:      lastHour - firstHour + 1 (always >= 1)
 *   - activeBuckets:  count of distinct active hour_start values that day
 *   - dutyCycle:      activeBuckets / spanHours (0..1] — how saturated
 *                     the window was. 1.0 means every hour in the
 *                     [firstHour, lastHour] window had activity.
 *   - tokensOnDay:    sum of total_tokens that day
 *
 * Plus distribution stats over the full population: min/p25/median/
 * mean/p75/max for both `spanHours` and `dutyCycle`.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `first-bucket-of-day` reports *when* the day starts (firstHour
 *     only). This reports *how long* the workday window is and
 *     *how saturated* it is.
 *   - `time-of-day` / `which-hour` / `peak-hour-share` distribute
 *     mass across hour-of-day across the whole window — not per-day
 *     start/end/length.
 *   - `bucket-streak-length` measures consecutive-hour runs but a
 *     fragmented day (work at 09, 14, 21) has spanHours=13, runs of
 *     length 1; a focused day (09..13 contiguous) has spanHours=5,
 *     runs of length 5. This lens captures the *containment* signal
 *     a streak doesn't.
 *   - `idle-gaps` / `interarrival` measure gaps *between* active
 *     buckets but don't anchor to a calendar day.
 *
 * Note on bucket bin width: pew rolls activity into hour buckets, so
 * 'activeBuckets' is exactly the number of distinct active hours in
 * the day. dutyCycle is therefore strictly in (0, 1].
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface ActiveSpanPerDayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Truncate `days[]` after sorting. Display filter only — summary
   * stats (`distinctDays`, `totalTokens`, all `span*` and `duty*`
   * aggregates) always reflect the full pre-cap population.
   * Suppressed rows surface as `droppedTopDays`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `days[]`:
   *   - 'day' (default):       day desc (newest first)
   *   - 'span':                spanHours desc (longest workday first)
   *   - 'duty':                dutyCycle desc (most-saturated first)
   *   - 'tokens':              tokensOnDay desc (heaviest day first)
   *   - 'active':              activeBuckets desc (most-active day first)
   * Tiebreak in all non-default cases: day desc.
   */
  sort?: 'day' | 'span' | 'duty' | 'tokens' | 'active';
  /**
   * Drop days whose `spanHours` is strictly less than this floor
   * *before* computing summary stats and `days[]`. Suppressed days
   * surface as `droppedShortSpanDays`. 0 (default) = no floor.
   *
   * Useful for stripping out days that are just one or two stray
   * automated buckets and would otherwise pull `dutyCycleMean`
   * artificially toward 1.0.
   */
  minSpan?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ActiveSpanPerDayRow {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** UTC hour-of-day 0..23 of earliest active bucket. */
  firstHour: number;
  /** UTC hour-of-day 0..23 of latest active bucket. */
  lastHour: number;
  /** lastHour - firstHour + 1; always >= 1. */
  spanHours: number;
  /** Distinct active hour_start values on this day. */
  activeBuckets: number;
  /** activeBuckets / spanHours; in (0, 1]. */
  dutyCycle: number;
  /** Sum of total_tokens on this day. */
  tokensOnDay: number;
}

export interface ActiveSpanPerDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of resolved `sort` key. */
  sort: 'day' | 'span' | 'duty' | 'tokens' | 'active';
  /** Echo of resolved `minSpan` floor (0 = no floor). */
  minSpan: number;
  /** Distinct UTC calendar days with at least one positive-token row. */
  distinctDays: number;
  /** Sum of total_tokens across the full population (pre top cap). */
  totalTokens: number;

  /** spanHours distribution (null if no days). */
  spanHoursMin: number | null;
  spanHoursMax: number | null;
  spanHoursMean: number | null;
  spanHoursMedian: number | null;
  spanHoursP25: number | null;
  spanHoursP75: number | null;

  /** dutyCycle distribution (null if no days). */
  dutyCycleMin: number | null;
  dutyCycleMax: number | null;
  dutyCycleMean: number | null;
  dutyCycleMedian: number | null;
  dutyCycleP25: number | null;
  dutyCycleP75: number | null;

  /** Drops. */
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Days suppressed by the `minSpan` floor. */
  droppedShortSpanDays: number;
  droppedTopDays: number;

  /** Per-day rows after sort + top cap. */
  days: ActiveSpanPerDayRow[];
}

export function buildActiveSpanPerDay(
  queue: QueueLine[],
  opts: ActiveSpanPerDayOptions = {},
): ActiveSpanPerDayReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'day';
  if (
    sort !== 'day' &&
    sort !== 'span' &&
    sort !== 'duty' &&
    sort !== 'tokens' &&
    sort !== 'active'
  ) {
    throw new Error(
      `sort must be 'day' | 'span' | 'duty' | 'tokens' | 'active' (got ${opts.sort})`,
    );
  }
  const minSpan = opts.minSpan ?? 0;
  if (!Number.isInteger(minSpan) || minSpan < 0) {
    throw new Error(
      `minSpan must be a non-negative integer (got ${opts.minSpan})`,
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
    minHour: number;
    maxHour: number;
    activeHours: Set<number>;
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

    const d = new Date(ms);
    const day = d.toISOString().slice(0, 10);
    const hour = d.getUTCHours();
    let acc = perDay.get(day);
    if (!acc) {
      acc = {
        minHour: hour,
        maxHour: hour,
        activeHours: new Set<number>(),
        tokens: 0,
      };
      perDay.set(day, acc);
    }
    if (hour < acc.minHour) acc.minHour = hour;
    if (hour > acc.maxHour) acc.maxHour = hour;
    acc.activeHours.add(hour);
    acc.tokens += tt;
  }

  const allDays: ActiveSpanPerDayRow[] = [];
  let totalTokens = 0;
  let droppedShortSpanDays = 0;
  for (const [day, acc] of perDay.entries()) {
    const spanHours = acc.maxHour - acc.minHour + 1;
    const activeBuckets = acc.activeHours.size;
    if (minSpan > 0 && spanHours < minSpan) {
      droppedShortSpanDays += 1;
      continue;
    }
    allDays.push({
      day,
      firstHour: acc.minHour,
      lastHour: acc.maxHour,
      spanHours,
      activeBuckets,
      dutyCycle: activeBuckets / spanHours,
      tokensOnDay: acc.tokens,
    });
    totalTokens += acc.tokens;
  }

  const distinctDays = allDays.length;
  let spanHoursMin: number | null = null;
  let spanHoursMax: number | null = null;
  let spanHoursMean: number | null = null;
  let spanHoursMedian: number | null = null;
  let spanHoursP25: number | null = null;
  let spanHoursP75: number | null = null;
  let dutyCycleMin: number | null = null;
  let dutyCycleMax: number | null = null;
  let dutyCycleMean: number | null = null;
  let dutyCycleMedian: number | null = null;
  let dutyCycleP25: number | null = null;
  let dutyCycleP75: number | null = null;

  if (distinctDays > 0) {
    const spans = allDays.map((d) => d.spanHours).sort((a, b) => a - b);
    spanHoursMin = spans[0]!;
    spanHoursMax = spans[spans.length - 1]!;
    spanHoursMean =
      allDays.reduce((s, d) => s + d.spanHours, 0) / distinctDays;
    spanHoursMedian = percentileInt(spans, 0.5);
    spanHoursP25 = percentileInt(spans, 0.25);
    spanHoursP75 = percentileInt(spans, 0.75);

    const duties = allDays.map((d) => d.dutyCycle).sort((a, b) => a - b);
    dutyCycleMin = duties[0]!;
    dutyCycleMax = duties[duties.length - 1]!;
    dutyCycleMean =
      allDays.reduce((s, d) => s + d.dutyCycle, 0) / distinctDays;
    dutyCycleMedian = percentileFloat(duties, 0.5);
    dutyCycleP25 = percentileFloat(duties, 0.25);
    dutyCycleP75 = percentileFloat(duties, 0.75);
  }

  // Sort.
  allDays.sort((a, b) => {
    let primary = 0;
    if (sort === 'span') primary = b.spanHours - a.spanHours;
    else if (sort === 'duty') primary = b.dutyCycle - a.dutyCycle;
    else if (sort === 'tokens') primary = b.tokensOnDay - a.tokensOnDay;
    else if (sort === 'active') primary = b.activeBuckets - a.activeBuckets;
    if (primary !== 0) return primary;
    return a.day < b.day ? 1 : a.day > b.day ? -1 : 0;
  });

  let droppedTopDays = 0;
  let kept: ActiveSpanPerDayRow[] = allDays;
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
    minSpan,
    distinctDays,
    totalTokens,
    spanHoursMin,
    spanHoursMax,
    spanHoursMean,
    spanHoursMedian,
    spanHoursP25,
    spanHoursP75,
    dutyCycleMin,
    dutyCycleMax,
    dutyCycleMean,
    dutyCycleMedian,
    dutyCycleP25,
    dutyCycleP75,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedShortSpanDays,
    droppedTopDays,
    days: kept,
  };
}

/** Linear-interpolation percentile, rounded to nearest int (spans are integer). */
function percentileInt(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = q * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  return Math.round(sortedAsc[lo]! + frac * (sortedAsc[hi]! - sortedAsc[lo]!));
}

/** Linear-interpolation percentile, returning the raw float (for dutyCycle). */
function percentileFloat(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = q * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  return sortedAsc[lo]! + frac * (sortedAsc[hi]! - sortedAsc[lo]!);
}
