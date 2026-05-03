/**
 * daily-token-month-end-vs-month-start-ratio: per-source RATIO of
 * MONTH-END tokens to MONTH-START tokens on the per-day
 * total_tokens vector.
 *
 * ONE-HUNDRED-AND-FORTY-NINTH cross-source axis.
 *
 * For each source we collapse hourly buckets into a per-UTC-day
 * total D = (D_d) and partition the active days into three
 * disjoint sets based on day-of-month relative to that day's own
 * calendar month length:
 *   - START := day-of-month in {1, 2, ..., windowSize}
 *     (default windowSize = 7).
 *   - END   := day-of-month in {monthLength - windowSize + 1,
 *     ..., monthLength}, where monthLength is the actual length
 *     of that day's UTC calendar month (28..31). For the default
 *     windowSize=7 in a 30-day month, this is {24..30}; in a
 *     31-day month, {25..31}; in 28-day February, {22..28}; etc.
 *   - MID   := everything in between.
 *
 * START and END NEVER overlap as long as `2 * windowSize <=
 * monthLength`. With windowSize=7 the smallest month (28 days,
 * Feb non-leap) gives `{1..7} vs {22..28}` — disjoint by 14 days.
 * windowSize is bounded to [1, 14] for safety; we throw if a
 * caller picks a value that would cause overlap on any month
 * length we will see in practice.
 *
 * The headline scalar is:
 *
 *     endStartRatio = endTokens / startTokens
 *
 * with deterministic NaN guards (null when startTokens is zero
 * — see below). We also surface symmetric forms
 * `endShare = endTokens / (endTokens + startTokens)` and
 * `startShare = 1 - endShare`, plus a calendar-density-corrected
 * `densityRatio` that divides each side's tokens by the COUNT
 * of START-bucket / END-bucket calendar days actually observed
 * in the source's active span.
 *
 * RANGE / SEMANTICS
 *   - endStartRatio in [0, +inf):
 *       0    = source ONLY produces tokens in the START bucket
 *              (relative to MID and END).
 *       +inf = source ONLY produces tokens in the END bucket.
 *       1.0  = balanced bucket totals (NOT the calendar baseline,
 *              since with default windowSize=7 the START and END
 *              buckets each contain 7 days out of ~30 -> the
 *              calendar baseline ratio is 1.0 when monthLengths
 *              are symmetric around windowSize).
 *   - endShare in [0, 1]; 0 = pure-start, 1 = pure-end.
 *   - densityRatio: `(endTokens / endCalendarDayCount) /
 *     (startTokens / startCalendarDayCount)`. 1.0 = uniform
 *     per-day intensity across the two buckets. `null` when EITHER
 *     endCalendarDayCount = 0 OR startCalendarDayCount = 0 OR
 *     startTokens = 0.
 *
 * STRUCTURAL ORTHOGONALITY
 *
 * This is a NEW CALENDAR-PARTITION functional based on the
 * intra-MONTH position of each token. It cannot be recovered
 * from any of the prior 148 cross-source daily-token axes:
 *
 *   - vs the permutation-invariant inequality / diversity family
 *     (axes 1..144 incl. Gini, HHI, Pielou, CR4, Atkinson, Theil,
 *     Hoover, Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson,
 *     Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, FGT,
 *     GE family, Var-of-Logs, Log-MAD, Zenga, S-Gini, Hill-tail,
 *     decile-share-gap, quintile-share-ratio, percentile-gap-
 *     ratio, top-4-CR, ...): those see only the active-day VALUE
 *     multiset and cannot see which day-of-month each value
 *     landed on. Two sources with identical daily multisets but
 *     values shuffled across calendar days have IDENTICAL
 *     Gini/HHI/Pielou/CR4 and any month-end/month-start ratio in
 *     [0, +inf]. Witness: D=[1000, 1000] on (Jan-01, Jan-02) vs
 *     (Jan-30, Jan-31): same multiset, ratio = 0 vs +inf.
 *
 *   - vs path-dependent axes 145 (max-drawdown-rate), 146
 *     (longest-zero-run), 147 (calendar-mask-RLE-entropy):
 *     all three are sequence functionals on the active-day order
 *     or the calendar 0/1 mask. They don't know which
 *     day-of-MONTH any position represents. A source can have
 *     MDD = 0, LZR = 0, RLE-H = 0 (continuous, monotone, single
 *     segment) and still take any month-end/month-start ratio
 *     depending on which day-of-month firstActiveDay landed on.
 *
 *   - vs axis-148 weekend-vs-weekday-ratio: that is a
 *     day-of-WEEK partition (Sat/Sun vs Mon-Fri). Day-of-week
 *     and day-of-month are demonstrably independent partitions:
 *     month-start days {1..7} cycle through ALL seven weekdays
 *     across the year and the same is true of month-end days.
 *     Witness: a source firing X tokens on Jan-01 (Thu) +
 *     Feb-01 (Sun) has START tokens {Thu: X, Sun: X},
 *     weekendShare = 1/2, endStartRatio = 0. A source firing X
 *     tokens on Jan-31 (Sat) + Feb-28 (Sat) has END tokens
 *     {Sat: X, Sat: X}, weekendShare = 1.0, endStartRatio = +inf.
 *     Both can be permuted across calendar months to give any
 *     combination of weekendShare and endStartRatio. Test
 *     shipped.
 *
 *   - vs autocorrelation axes (Pearson lag-1, lag-7, Kendall-tau,
 *     Spearman): autocorrelation measures POSITION-relative
 *     dependence, not absolute calendar position. A source with
 *     strictly equal daily totals on all 31 days of the month
 *     has autocorrelation ~1 and endStartRatio = 1.0 (balanced
 *     under windowSize=7). A source with [X, 0, 0, ..., 0, X]
 *     pattern (only first and last day each month) has
 *     autocorrelation ~0 (purely on calendar boundaries) but
 *     endStartRatio = 1.0 also. Conversely, [0,0,...0,X,X,X,X]
 *     (only end-of-month days) has the same autocorrelation
 *     class as [X,X,X,X,0,0,...0] (only start-of-month days),
 *     but endStartRatio is +inf vs 0.
 *
 *   - vs `weekdayshare.ts` / `sourcedayofweektokenmassshare.ts`
 *     (7-bin DOW shares): those compute a day-of-WEEK histogram,
 *     not day-of-MONTH. Independent partitions; same witness as
 *     the axis-148 comparison above.
 *
 * REGIME LABEL
 *
 * Per-row `monthEdgeRegime` bins `endShare` into seven bands
 * relative to the 0.5 baseline (since windowSize is identical
 * on both sides):
 *   - 'start-only'      : endShare = 0 AND endTokens = 0.
 *   - 'start-heavy'     : 0    < endShare <  0.30.
 *   - 'start-leaning'   : 0.30 <= endShare < 0.45.
 *   - 'balanced'        : 0.45 <= endShare < 0.55.
 *   - 'end-leaning'     : 0.55 <= endShare < 0.70.
 *   - 'end-heavy'       : 0.70 <= endShare <  1.0.
 *   - 'end-only'        : endShare = 1.0 AND startTokens = 0.
 *   - 'mid-only'        : endTokens = 0 AND startTokens = 0
 *                         (all activity in the MID bucket).
 *   - 'start-blind'     : startCalendarDayCount = 0 (active span
 *                         contains no START-bucket calendar day).
 *   - 'end-blind'       : endCalendarDayCount = 0.
 *
 * Headline question:
 * **"Does this source pile tokens onto the FIRST week of each
 *   month, the LAST week of each month, or somewhere in the
 *   middle?"** -- answered as a single per-source ratio that
 *   ranks cleanly across the suite.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenMonthEndVsMonthStartRatioSort =
  | 'endShare'
  | 'startShare'
  | 'endStartRatio'
  | 'densityRatio'
  | 'endTokens'
  | 'startTokens'
  | 'midTokens'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenMonthEndVsMonthStartRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMonthEndVsMonthStartRatioSort;
  /**
   * Width of the START and END day-of-month windows. Default 7
   * (Mon-Fri-week-style edge). Bounded to [1, 14] so that even on
   * the shortest calendar month (28-day Feb) the START and END
   * sets remain disjoint (need 2 * windowSize <= 28).
   */
  windowSize?: number;
  /**
   * Display filter: hide rows whose `endShare` is strictly below
   * this fraction in [0, 1]. Default null = no filter.
   */
  minEndShare?: number | null;
  generatedAt?: string;
}

export type DailyTokenMonthEdgeRegime =
  | 'start-only'
  | 'start-heavy'
  | 'start-leaning'
  | 'balanced'
  | 'end-leaning'
  | 'end-heavy'
  | 'end-only'
  | 'mid-only'
  | 'start-blind'
  | 'end-blind'
  | 'degenerate';

export interface DailyTokenMonthEndVsMonthStartRatioSourceRow {
  source: string;
  totalTokens: number;
  /** Number of UTC days on which the source was actually active. */
  nDays: number;
  spanDays: number;
  firstDay: string;
  lastDay: string;
  /** Active days falling in the START bucket. */
  startActiveDayCount: number;
  /** Active days falling in the END bucket. */
  endActiveDayCount: number;
  /** Active days falling in the MID bucket. */
  midActiveDayCount: number;
  /** Calendar-day count of START-bucket days inside [firstDay, lastDay]. */
  startCalendarDayCount: number;
  /** Calendar-day count of END-bucket days inside [firstDay, lastDay]. */
  endCalendarDayCount: number;
  /** Calendar-day count of MID-bucket days inside [firstDay, lastDay]. */
  midCalendarDayCount: number;
  /** Sum of total_tokens on START-bucket days. */
  startTokens: number;
  /** Sum of total_tokens on END-bucket days. */
  endTokens: number;
  /** Sum of total_tokens on MID-bucket days. */
  midTokens: number;
  /** endTokens / (endTokens + startTokens). In [0, 1]. 0 if both zero. */
  endShare: number;
  /** 1 - endShare, when defined; 0 otherwise. */
  startShare: number;
  /**
   * endTokens / startTokens. `null` when startTokens = 0.
   */
  endStartRatio: number | null;
  /**
   * Refinement (v0.6.398): signed deviation of `endShare` from
   * the natural bucket-equal baseline 0.5 (since START and END
   * have identical bucket widths by design).
   *   = endShare - 0.5
   * Always defined and finite, in `[-0.5, +0.5]`. 0 = perfectly
   * balanced; positive = end-tilted; negative = start-tilted.
   * Lets you rank-order sources by EXCESS end tilt independent
   * of the absolute share.
   */
  endShareDelta: number;
  /**
   * Refinement (v0.6.398): signed log-density-lift, the
   * natural-log of `densityRatio`, capturing END-day vs
   * START-day INTENSITY in log-units (more comparable across
   * sources than the raw ratio when `densityRatio` is near 0
   * or very large). `null` exactly when `densityRatio` is null
   * or zero.
   *   = ln(densityRatio)
   * 0 = uniform per-day intensity; +ln(2) = end-day intensity
   * is 2x start-day; -ln(2) = half.
   */
  endStartDensityLogLift: number | null;
  /**
   * Calendar-density-corrected ratio:
   *   (endTokens / endCalendarDayCount) /
   *   (startTokens / startCalendarDayCount)
   * 1.0 = uniform per-day intensity across the two buckets.
   * `null` when EITHER startCalendarDayCount = 0 OR
   * endCalendarDayCount = 0 OR startTokens = 0.
   */
  densityRatio: number | null;
  monthEdgeRegime: DailyTokenMonthEdgeRegime;
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenMonthEndVsMonthStartRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMonthEndVsMonthStartRatioSort;
  windowSize: number;
  minEndShare: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinEndShare: number;
  droppedTopSources: number;
  sources: DailyTokenMonthEndVsMonthStartRatioSourceRow[];
}

/**
 * Returns the calendar length (28..31) of the UTC month containing
 * the given `YYYY-MM-DD` day key. Throws on invalid input.
 */
export function utcMonthLength(day: string): number {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`utcMonthLength: invalid day ${day}`);
  }
  const d = new Date(ms);
  // Day 0 of the next month = last day of current month.
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return next.getUTCDate();
}

export type MonthEdgeBucket = 'start' | 'end' | 'mid';

/**
 * Classify a UTC day key into one of {start, end, mid} given a
 * windowSize. With windowSize=7 in a 30-day month, days {1..7}
 * are 'start', {24..30} are 'end', and {8..23} are 'mid'.
 */
export function classifyMonthEdgeBucket(
  day: string,
  windowSize: number,
): MonthEdgeBucket {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`classifyMonthEdgeBucket: invalid day ${day}`);
  }
  const d = new Date(ms);
  const dom = d.getUTCDate();
  const len = utcMonthLength(day);
  if (dom <= windowSize) return 'start';
  if (dom > len - windowSize) return 'end';
  return 'mid';
}

function addUtcDays(day: string, daysToAdd: number): string {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`addUtcDays: invalid day ${day}`);
  }
  const d = new Date(ms + daysToAdd * 86400000);
  return d.toISOString().slice(0, 10);
}

function spanDaysInclusive(a: string, b: string): number {
  const aMs = Date.parse(a + 'T00:00:00.000Z');
  const bMs = Date.parse(b + 'T00:00:00.000Z');
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) {
    throw new Error(`spanDaysInclusive: invalid days ${a} ${b}`);
  }
  return Math.round((bMs - aMs) / 86400000) + 1;
}

/**
 * Classify endShare into a regime label. Pure / total function.
 */
export function classifyMonthEdgeRegime(
  endShare: number,
  startTokens: number,
  endTokens: number,
  midTokens: number,
): DailyTokenMonthEdgeRegime {
  if (startTokens === 0 && endTokens === 0 && midTokens === 0) {
    return 'degenerate';
  }
  if (startTokens === 0 && endTokens === 0) {
    return 'mid-only';
  }
  if (startTokens === 0) return 'end-only';
  if (endTokens === 0) return 'start-only';
  if (endShare < 0.3) return 'start-heavy';
  if (endShare < 0.45) return 'start-leaning';
  if (endShare < 0.55) return 'balanced';
  if (endShare < 0.7) return 'end-leaning';
  return 'end-heavy';
}

export function buildDailyTokenMonthEndVsMonthStartRatio(
  queue: QueueLine[],
  opts: DailyTokenMonthEndVsMonthStartRatioOptions = {},
): DailyTokenMonthEndVsMonthStartRatioReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(`minDays must be an integer >= 1 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const windowSize = opts.windowSize ?? 7;
  if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize > 14) {
    throw new Error(
      `windowSize must be an integer in [1, 14] (got ${opts.windowSize})`,
    );
  }
  const minEndShare = opts.minEndShare ?? null;
  if (
    minEndShare !== null &&
    (!Number.isFinite(minEndShare) || minEndShare < 0 || minEndShare > 1)
  ) {
    throw new Error(
      `minEndShare must be a finite number in [0, 1] or null (got ${opts.minEndShare})`,
    );
  }
  const sort: DailyTokenMonthEndVsMonthStartRatioSort = opts.sort ?? 'endShare';
  const validSorts: DailyTokenMonthEndVsMonthStartRatioSort[] = [
    'endShare',
    'startShare',
    'endStartRatio',
    'densityRatio',
    'endTokens',
    'startTokens',
    'midTokens',
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
  const rows: DailyTokenMonthEndVsMonthStartRatioSourceRow[] = [];

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

    let startTokens = 0;
    let endTokens = 0;
    let midTokens = 0;
    let startActiveDayCount = 0;
    let endActiveDayCount = 0;
    let midActiveDayCount = 0;
    for (const [day, v] of acc.perDay) {
      const bucket = classifyMonthEdgeBucket(day, windowSize);
      if (bucket === 'start') {
        startTokens += v;
        startActiveDayCount += 1;
      } else if (bucket === 'end') {
        endTokens += v;
        endActiveDayCount += 1;
      } else {
        midTokens += v;
        midActiveDayCount += 1;
      }
    }

    let startCalendarDayCount = 0;
    let endCalendarDayCount = 0;
    let midCalendarDayCount = 0;
    for (let i = 0; i < spanDays; i += 1) {
      const day = addUtcDays(acc.firstDay, i);
      const bucket = classifyMonthEdgeBucket(day, windowSize);
      if (bucket === 'start') startCalendarDayCount += 1;
      else if (bucket === 'end') endCalendarDayCount += 1;
      else midCalendarDayCount += 1;
    }

    const denom = startTokens + endTokens;
    const endShare = denom > 0 ? endTokens / denom : 0;
    const startShare = denom > 0 ? startTokens / denom : 0;
    const endStartRatio: number | null =
      startTokens > 0 ? endTokens / startTokens : null;

    let densityRatio: number | null = null;
    if (
      startCalendarDayCount > 0 &&
      endCalendarDayCount > 0 &&
      startTokens > 0
    ) {
      const startIntensity = startTokens / startCalendarDayCount;
      const endIntensity = endTokens / endCalendarDayCount;
      if (startIntensity > 0) {
        densityRatio = endIntensity / startIntensity;
      }
    }

    let monthEdgeRegime: DailyTokenMonthEdgeRegime = classifyMonthEdgeRegime(
      endShare,
      startTokens,
      endTokens,
      midTokens,
    );
    // Calendar-blind overrides: if the source's active span contains
    // no day of one bucket, surface that explicitly.
    if (startCalendarDayCount === 0) {
      monthEdgeRegime = 'start-blind';
    } else if (endCalendarDayCount === 0) {
      monthEdgeRegime = 'end-blind';
    }

    const degenerate = nDays < 2;
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
      startActiveDayCount,
      endActiveDayCount,
      midActiveDayCount,
      startCalendarDayCount,
      endCalendarDayCount,
      midCalendarDayCount,
      startTokens,
      endTokens,
      midTokens,
      endShare,
      startShare,
      endStartRatio,
      densityRatio,
      endShareDelta: endShare - 0.5,
      endStartDensityLogLift:
        densityRatio !== null && densityRatio > 0
          ? Math.log(densityRatio)
          : null,
      monthEdgeRegime,
      meanDailyTokens: meanDaily,
      degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinEndShare = 0;
  let filtered = rows;
  if (minEndShare !== null) {
    const next: DailyTokenMonthEndVsMonthStartRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.endShare >= minEndShare) next.push(r);
      else droppedBelowMinEndShare += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'startShare':
        primary = b.startShare - a.startShare;
        break;
      case 'endStartRatio': {
        const av =
          a.endStartRatio === null ? Number.POSITIVE_INFINITY : a.endStartRatio;
        const bv =
          b.endStartRatio === null ? Number.POSITIVE_INFINITY : b.endStartRatio;
        primary = bv - av;
        break;
      }
      case 'densityRatio': {
        const av =
          a.densityRatio === null ? Number.POSITIVE_INFINITY : a.densityRatio;
        const bv =
          b.densityRatio === null ? Number.POSITIVE_INFINITY : b.densityRatio;
        primary = bv - av;
        break;
      }
      case 'endTokens':
        primary = b.endTokens - a.endTokens;
        break;
      case 'startTokens':
        primary = b.startTokens - a.startTokens;
        break;
      case 'midTokens':
        primary = b.midTokens - a.midTokens;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'endShare':
      default:
        primary = b.endShare - a.endShare;
        break;
    }
    if (primary !== 0) return primary;
    // Secondary tie-break: heavier sources (more total tokens) win
    // before the final lexicographic source-name fallback. This makes
    // the cross-source ranking robust when many low-volume sources
    // collapse onto identical headline metrics (e.g. endShare = 0 and
    // endShare = 1 both occur for many narrow-span sources).
    if (a.totalTokens !== b.totalTokens) return b.totalTokens - a.totalTokens;
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
    windowSize,
    minEndShare,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinEndShare,
    droppedTopSources,
    sources: kept,
  };
}
