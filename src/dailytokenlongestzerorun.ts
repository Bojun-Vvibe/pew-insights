/**
 * daily-token-longest-zero-run: per-source LONGEST CONTIGUOUS RUN
 * OF ZERO-ACTIVITY UTC DAYS in the calendar window
 * [firstActiveDay, lastActiveDay] of the per-day total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-FORTY-SIXTH cross-source axis.
 *
 * The day vector is built by EXPANDING the source's active days
 * onto the full UTC calendar between firstActiveDay and
 * lastActiveDay, filling missing dates with zero. We then read
 * off the longest run of consecutive zero days inside that
 * span. The value is a count of CALENDAR DAYS, not a fraction;
 * the natural normalisation `longestZeroRun / spanDays` is also
 * surfaced (`longestZeroRunShare`).
 *
 * The leading-edge run starts at firstActiveDay (which is by
 * definition non-zero) and the trailing edge ends at
 * lastActiveDay (also non-zero), so leading / trailing zero
 * runs by construction CANNOT exist in this window. That is
 * deliberate: a source that hasn't been active in 30 days
 * should not register a 30-day "dormancy" -- it is simply
 * dormant. We measure the worst INTERIOR DROUGHT, the
 * longest stretch where the source went silent and then came
 * back.
 *
 * SECOND PATH-DEPENDENT cross-source daily-token axis (after
 * axis-145 max-drawdown-rate). Where MDD captures DEPTH of a
 * post-peak collapse on the active day vector, longest-zero-run
 * captures DURATION of complete dormancy on the calendar-day
 * vector. The two are STRUCTURALLY ORTHOGONAL:
 *
 *   - Source U: D = [100, 100, 100, 100, 100] on five consecutive
 *     days. MDD = 0 (monotone non-decreasing, flat counts);
 *     longestZeroRun = 0 (no gap). Both axes report 0; they
 *     agree on "boring".
 *   - Source V: D = [100, 1, 100] on three consecutive days.
 *     MDD = 0.99 (peak 100 -> trough 1); longestZeroRun = 0
 *     (no calendar gap). MDD fires, longest-zero-run does not.
 *   - Source W: D = [100, 100] on day-1 and day-30 (28 missing
 *     days in between). MDD = 0 (monotone non-decreasing on
 *     the active-day vector; both values equal 100);
 *     longestZeroRun = 28. longest-zero-run fires, MDD does not.
 *   - Source X: D = [100, 1] on day-1 and day-30. MDD = 0.99
 *     (peak 100 -> trough 1 on active-day vector);
 *     longestZeroRun = 28. Both fire.
 *
 * No permutation-invariant inequality / diversity functional
 * (Gini, HHI, Pielou, CR4, Atkinson, Theil, Hoover, Pietra,
 * Bonferroni, Mehran, Wolfson, Foster-Wolfson, Palma,
 * Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, FGT, GE family,
 * Var-of-Logs, Log-MAD, Zenga, S-Gini, Hill-tail, decile-share-
 * gap, quintile-share-ratio, percentile-gap-ratio, top-4-CR,
 * Pielou-evenness, ...) can express longestZeroRun: those
 * functionals see only the multiset of active-day values; they
 * cannot see the calendar gaps. Source W above (D=[100,100],
 * 28 missing days) has Gini = 0, HHI = 0.5, Pielou J = 1,
 * CR4 = 1 -- identical to a source with D=[100,100] on two
 * adjacent days. The new axis is the ONLY shipped daily-token
 * functional that distinguishes them.
 *
 * Distinct from MDD (axis-145) on the order-vector axis: MDD is
 * a magnitude / depth functional on the active-day vector;
 * longestZeroRun is a length / duration functional on the
 * calendar-day vector. Even when both are non-zero (source X
 * above), they capture orthogonal facets: MDD = 0.99 says "the
 * worst comeback day was 99% lower than its prior peak";
 * longestZeroRun = 28 says "the source went silent for four
 * weeks straight". Two sources with identical MDD = 0.5 can
 * have longestZeroRun anywhere from 0 to thousands of days
 * depending on their calendar footprint.
 *
 * Distinct from source-dry-spell (calendar-day recency from
 * lastDay to NOW): dry-spell is a single-edge measure
 * anchored at the present time. longest-zero-run is the
 * worst INTERNAL gap, observed entirely in the past, anchored
 * to nothing external.
 *
 * Distinct from source-active-day-streak (longest run of
 * CONSECUTIVE ACTIVE days): that is the dual / complement axis
 * on the same calendar vector but reads runs of NON-ZERO
 * positions, not runs of ZERO positions. They are not
 * algebraically related: a vector
 * [1, 0, 0, 1, 0, 0, 0, 1, 0, 1] has activeDayStreak = 1
 * (every single 1 is isolated) and longestZeroRun = 3 -- two
 * different positions in the same sequence. Even when streak
 * = run-length-of-zeros (vector [1,0,0,1,1,0,0,1]), the
 * SEMANTIC meaning differs: streak measures stamina,
 * zero-run measures dormancy.
 *
 * Distinct from source-dead-hour-count and source-dead-run on
 * the HOUR-OF-DAY axis: those operate on a 24-bin circular
 * vector pooled across all calendar days. longest-zero-run
 * operates on the unrolled CALENDAR-DAY axis -- a different
 * surface entirely. A source that is heavily diurnal (active
 * 9-17 every day) has 15 dead hours of day on the circular
 * 24-cycle but a longestZeroRun of 0 on the calendar vector.
 *
 * RANGE AND BOUNDS:
 *   - longestZeroRun is a non-negative integer in [0, spanDays - 2]
 *     where spanDays = (lastActiveDay - firstActiveDay) + 1 in
 *     calendar days. The upper bound is spanDays - 2 because
 *     firstActiveDay and lastActiveDay are by definition
 *     non-zero (those are the bookends of the active span),
 *     so at most spanDays - 2 interior days can be zero.
 *   - longestZeroRunShare = longestZeroRun / spanDays in
 *     [0, 1 - 2/spanDays].
 *   - 0 iff the source was active on every single UTC day in
 *     the span (no calendar gaps).
 *   - For nDays = 1 (single active day), spanDays = 1 and
 *     longestZeroRun = 0; reported as degenerate.
 *
 * Headline question:
 * **"What is the longest stretch of consecutive UTC days a
 *   source went completely silent in between its first and
 *   last days of activity?"**
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenLongestZeroRunSort =
  | 'longestZeroRun'
  | 'longestZeroRunShare'
  | 'totalZeroDays'
  | 'spanDays'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenLongestZeroRunOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenLongestZeroRunSort;
  minLongestZeroRun?: number | null;
  generatedAt?: string;
}

export interface DailyTokenLongestZeroRunSourceRow {
  source: string;
  totalTokens: number;
  /** Number of UTC days on which the source was actually active. */
  nDays: number;
  /**
   * Calendar span: (lastActiveDay - firstActiveDay) + 1 in days.
   * Always >= nDays.
   */
  spanDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Longest contiguous run of zero-activity UTC days inside the
   * span [firstDay, lastDay]. Non-negative integer.
   */
  longestZeroRun: number;
  /**
   * longestZeroRun / spanDays. In [0, 1 - 2/spanDays].
   * 0 iff the source was active on every UTC day in the span.
   */
  longestZeroRunShare: number;
  /** Total number of zero-activity UTC days inside the span. */
  totalZeroDays: number;
  /**
   * Number of disjoint zero-runs inside the span (each maximal
   * stretch of consecutive zero days counts once).
   */
  zeroRunCount: number;
  /**
   * UTC day on which the worst zero-run began (i.e. the first
   * silent day of the longest dormancy stretch). For
   * longestZeroRun = 0 this is empty string.
   */
  longestZeroRunStartDay: string;
  /**
   * UTC day on which the worst zero-run ended (last silent
   * day, inclusive). Empty string for longestZeroRun = 0.
   */
  longestZeroRunEndDay: string;
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenLongestZeroRunReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenLongestZeroRunSort;
  minLongestZeroRun: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinLongestZeroRun: number;
  droppedTopSources: number;
  sources: DailyTokenLongestZeroRunSourceRow[];
}

/**
 * Compute the longest run of zeros in a 0/1 mask vector along
 * with the count of disjoint zero runs. Returns the
 * (start, end) indices of the FIRST occurrence of the longest
 * zero run (deterministic tie-break: earliest index wins).
 */
export function longestZeroRunOfMask(mask: number[]): {
  longestZeroRun: number;
  totalZeros: number;
  zeroRunCount: number;
  longestStart: number;
  longestEnd: number;
} {
  const n = mask.length;
  let longest = 0;
  let totalZeros = 0;
  let runs = 0;
  let bestStart = -1;
  let bestEnd = -1;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < n; i += 1) {
    const v = mask[i] as number;
    if (v === 0) {
      if (curLen === 0) {
        curStart = i;
        runs += 1;
      }
      curLen += 1;
      totalZeros += 1;
      if (curLen > longest) {
        longest = curLen;
        bestStart = curStart;
        bestEnd = i;
      }
    } else {
      curLen = 0;
      curStart = -1;
    }
  }
  return {
    longestZeroRun: longest,
    totalZeros,
    zeroRunCount: runs,
    longestStart: bestStart,
    longestEnd: bestEnd,
  };
}

/**
 * Add `daysToAdd` UTC days to a YYYY-MM-DD string and return
 * the resulting YYYY-MM-DD. Pure date arithmetic in UTC.
 */
function addUtcDays(day: string, daysToAdd: number): string {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`addUtcDays: invalid day ${day}`);
  }
  const d = new Date(ms + daysToAdd * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Number of inclusive calendar days between two YYYY-MM-DD
 * strings (a <= b): (b - a) + 1.
 */
function spanDaysInclusive(a: string, b: string): number {
  const aMs = Date.parse(a + 'T00:00:00.000Z');
  const bMs = Date.parse(b + 'T00:00:00.000Z');
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) {
    throw new Error(`spanDaysInclusive: invalid days ${a} ${b}`);
  }
  return Math.round((bMs - aMs) / 86400000) + 1;
}

export function buildDailyTokenLongestZeroRun(
  queue: QueueLine[],
  opts: DailyTokenLongestZeroRunOptions = {},
): DailyTokenLongestZeroRunReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(
      `minDays must be an integer >= 1 (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minLongestZeroRun = opts.minLongestZeroRun ?? null;
  if (
    minLongestZeroRun !== null &&
    (!Number.isInteger(minLongestZeroRun) || minLongestZeroRun < 0)
  ) {
    throw new Error(
      `minLongestZeroRun must be a non-negative integer or null (got ${opts.minLongestZeroRun})`,
    );
  }
  const sort: DailyTokenLongestZeroRunSort = opts.sort ?? 'longestZeroRun';
  const validSorts: DailyTokenLongestZeroRunSort[] = [
    'longestZeroRun',
    'longestZeroRunShare',
    'totalZeroDays',
    'spanDays',
    'tokens',
    'days',
    'source',
    'meanDaily',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

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
    perDay: Map<string, number>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
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
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + tt);
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinDays = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenLongestZeroRunSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDays = acc.perDay.size;
    if (nDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    const spanDays = spanDaysInclusive(acc.firstDay, acc.lastDay);
    // Build the calendar mask: 1 if active that day, 0 if silent.
    const mask: number[] = new Array(spanDays);
    for (let i = 0; i < spanDays; i += 1) {
      const day = addUtcDays(acc.firstDay, i);
      mask[i] = acc.perDay.has(day) ? 1 : 0;
    }
    const r = longestZeroRunOfMask(mask);
    const degenerate = spanDays < 2;
    let longestStartDay = '';
    let longestEndDay = '';
    if (r.longestZeroRun > 0) {
      longestStartDay = addUtcDays(acc.firstDay, r.longestStart);
      longestEndDay = addUtcDays(acc.firstDay, r.longestEnd);
    }
    let meanDaily = 0;
    for (const v of acc.perDay.values()) meanDaily += v;
    meanDaily = meanDaily / nDays;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      spanDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      longestZeroRun: r.longestZeroRun,
      longestZeroRunShare: spanDays > 0 ? r.longestZeroRun / spanDays : 0,
      totalZeroDays: r.totalZeros,
      zeroRunCount: r.zeroRunCount,
      longestZeroRunStartDay: longestStartDay,
      longestZeroRunEndDay: longestEndDay,
      meanDailyTokens: meanDaily,
      degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinLongestZeroRun = 0;
  let filtered = rows;
  if (minLongestZeroRun !== null) {
    const next: DailyTokenLongestZeroRunSourceRow[] = [];
    for (const r of rows) {
      if (r.longestZeroRun >= minLongestZeroRun) next.push(r);
      else droppedBelowMinLongestZeroRun += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'spanDays':
        primary = b.spanDays - a.spanDays;
        break;
      case 'totalZeroDays':
        primary = b.totalZeroDays - a.totalZeroDays;
        break;
      case 'longestZeroRunShare':
        primary = b.longestZeroRunShare - a.longestZeroRunShare;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'longestZeroRun':
      default:
        primary = b.longestZeroRun - a.longestZeroRun;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

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
    minTokens,
    minDays,
    top,
    sort,
    minLongestZeroRun,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinLongestZeroRun,
    droppedTopSources,
    sources: kept,
  };
}
