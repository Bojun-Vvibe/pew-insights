/**
 * daily-token-weekend-vs-weekday-ratio: per-source ratio of
 * WEEKEND-DAY tokens to WEEKDAY tokens on the per-day
 * total_tokens vector.
 *
 * ONE-HUNDRED-AND-FORTY-EIGHTH cross-source axis.
 *
 * For each source we collapse hourly buckets into a per-UTC-day
 * total D = (D_d) and partition the active days into two
 * disjoint sets:
 *   - WEEKEND := UTC weekday in {Sat, Sun} (JS getUTCDay() in
 *     {6, 0}).
 *   - WEEKDAY := UTC weekday in {Mon, Tue, Wed, Thu, Fri} (JS
 *     getUTCDay() in {1, 2, 3, 4, 5}).
 * The headline scalar is:
 *
 *     ratio = weekendTokens / weekdayTokens
 *
 * with deterministic NaN guards (null when either denominator
 * is zero or both are zero -- see below). We also surface the
 * complementary symmetric forms `weekendShare = weekendTokens /
 * (weekendTokens + weekdayTokens)` and `weekdayShare = 1 -
 * weekendShare`, plus a calendar-density-corrected
 * `densityRatio` that divides by the COUNT of weekend / weekday
 * calendar days actually observed in the source's active span.
 *
 * RANGE / SEMANTICS
 *   - ratio in [0, +inf):
 *       0  = source ONLY produces tokens on weekdays.
 *       +inf = source ONLY produces tokens on weekends.
 *       2/5 = "balanced": tokens scale to the natural calendar
 *             rate (5 weekdays vs 2 weekend days per ISO week);
 *             the calendar-baseline equivalent is captured by
 *             `densityRatio = (weekendTokens / weekendDayCount) /
 *             (weekdayTokens / weekdayDayCount)` which is 1.0
 *             at "uniform per-day intensity".
 *   - weekendShare in [0, 1]; 0 = pure weekday source, 1 = pure
 *     weekend source.
 *   - For sources with EITHER weekendDayCount = 0 OR
 *     weekdayDayCount = 0 (active span fits inside a stretch
 *     of pure weekday-only or weekend-only days), `ratio` and
 *     `densityRatio` are reported as `null` (regime label
 *     `weekend-blind` / `weekday-blind` accordingly). The
 *     SHARES remain defined for any active span.
 *
 * STRUCTURAL ORTHOGONALITY
 *
 * This is a CALENDAR-PARTITION functional: it depends entirely on
 * which day-of-week each token landed on. It cannot be recovered
 * from any of the prior 147 cross-source daily-token axes:
 *
 *   - vs the permutation-invariant inequality / diversity family
 *     (Gini, HHI, Pielou, CR4, Atkinson, Theil, Hoover, Pietra,
 *     Bonferroni, Mehran, Wolfson, Foster-Wolfson, Palma,
 *     Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, FGT, GE
 *     family, Var-of-Logs, Log-MAD, Zenga, S-Gini, Hill-tail,
 *     decile-share-gap, quintile-share-ratio,
 *     percentile-gap-ratio, top-4-CR, ...): those see only the
 *     active-day VALUE multiset; they cannot see which day of
 *     week each value landed on. Two sources with identical
 *     daily-token multisets but their values shuffled across
 *     calendar days have IDENTICAL Gini / HHI / Pielou / CR4 /
 *     etc. but can have ANY weekend/weekday ratio in [0, +inf].
 *     Witness: D=[100,100] on (Sat, Sun) vs (Mon, Tue) -- same
 *     multiset, ratio = +inf vs 0.
 *
 *   - vs PATH-DEPENDENT axes 145 (max-drawdown-rate), 146
 *     (longest-zero-run), 147 (calendar-mask-RLE-entropy):
 *     all three are sequence functionals on the active-day
 *     order or the calendar mask -- they don't know which
 *     day-of-week any position represents. A source can have
 *     MDD = 0, LZR = 0, RLE-H = 0 (continuous, monotone, single
 *     segment) and still have any weekend/weekday ratio
 *     depending on which weekday firstActiveDay landed on.
 *     Witness shipped in test suite.
 *
 *   - vs the autocorrelation family (Pearson lag-1, lag-7,
 *     Kendall-tau, Spearman): autocorrelation measures
 *     POSITION-relative dependence. AC at lag-7 is the closest
 *     neighbour but still distinct: AC(7) measures the
 *     dependence between same-day-of-week pairs ACROSS WEEKS;
 *     weekend/weekday ratio is the average MASS PARTITION
 *     across two sets of weekdays. A source with strictly equal
 *     daily totals on all 7 weekdays has AC(7) ~ 1.0 (perfect
 *     same-DOW correlation) and ratio = 2/5 (balanced, no
 *     weekend-vs-weekday preference). A source that fires
 *     [0, 0, 0, 0, 0, X, X] every week has AC(7) ~ 1.0 AND
 *     ratio = +inf.
 *
 *   - vs `weekendvsweekday.ts` (the existing PER-MODEL
 *     weekend/weekday split): that report aggregates by
 *     normalised model name and surfaces a global-plus-per-model
 *     view. It is NOT a cross-source axis -- two different
 *     sources running the same model collapse together. The new
 *     axis-148 keeps the per-source axis (cross-source rank-and-
 *     order) and ignores the model dimension, making it a
 *     proper sibling of the other 147 cross-source daily-token
 *     axes.
 *
 *   - vs `dailytokendayofweektokenmassshare` family / 7-bin
 *     mass entropy axes: those compute a 7-bin Shannon entropy
 *     over the day-of-week histogram (fine-grained shape), not
 *     a 2-bucket ratio. Two sources with very different DOW
 *     entropy can have identical weekend/weekday ratio (e.g.
 *     uniform-7 vs concentrated-on-Wed both give ratio = 2/5
 *     under perfect calendar density). Conversely, two sources
 *     with identical 7-bin DOW entropy can have very different
 *     weekend/weekday ratio (e.g. mass concentrated on
 *     Sat+Sun-only vs mass concentrated on Mon+Tue-only).
 *     Wait -- those have the SAME 7-bin entropy since both
 *     concentrate on two equal-mass bins; ratio is +inf vs 0.
 *     Witness shipped in test suite.
 *
 * REGIME LABEL
 *
 * Per-row `weekendRegime` bins `weekendShare` into seven bands
 * relative to the 2/7 ~= 0.2857 calendar baseline:
 *   - 'weekday-only'      : weekendShare = 0 (and weekend tokens = 0).
 *   - 'weekday-heavy'     : 0    < share <  0.10  (well below baseline).
 *   - 'weekday-leaning'   : 0.10 <= share < 2/7   (mildly weekday-skewed).
 *   - 'balanced'          : 2/7  <= share < 3/7   (close to natural rate).
 *   - 'weekend-leaning'   : 3/7  <= share < 0.60  (mild weekend tilt).
 *   - 'weekend-heavy'     : 0.60 <= share <  1.0  (strong weekend tilt).
 *   - 'weekend-only'      : share = 1.0 (all tokens on weekends).
 *   - 'degenerate'        : nDays < minDays.
 *
 * Headline question:
 * **"Does this source actually grind on weekends, or is it a
 *   pure weekday workhorse?"** -- answered as a single per-source
 *   ratio that ranks cleanly across the suite.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenWeekendWeekdayRatioSort =
  | 'weekendShare'
  | 'weekdayShare'
  | 'ratio'
  | 'densityRatio'
  | 'weekendTokens'
  | 'weekdayTokens'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenWeekendWeekdayRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenWeekendWeekdayRatioSort;
  /**
   * Display filter: hide rows whose `weekendShare` is strictly
   * below this fraction in [0, 1]. Default null = no filter.
   */
  minWeekendShare?: number | null;
  generatedAt?: string;
}

export type DailyTokenWeekendRegime =
  | 'weekday-only'
  | 'weekday-heavy'
  | 'weekday-leaning'
  | 'balanced'
  | 'weekend-leaning'
  | 'weekend-heavy'
  | 'weekend-only'
  | 'weekend-blind'
  | 'weekday-blind'
  | 'degenerate';

export interface DailyTokenWeekendWeekdayRatioSourceRow {
  source: string;
  totalTokens: number;
  /** Number of UTC days on which the source was actually active. */
  nDays: number;
  spanDays: number;
  firstDay: string;
  lastDay: string;
  /** Weekend-day count among active days. */
  weekendActiveDayCount: number;
  /** Weekday-day count among active days. */
  weekdayActiveDayCount: number;
  /**
   * Calendar-day count of weekend days INSIDE the active span
   * [firstDay, lastDay], regardless of whether the source was
   * active on each one.
   */
  weekendCalendarDayCount: number;
  /**
   * Calendar-day count of weekday days INSIDE the active span.
   */
  weekdayCalendarDayCount: number;
  /** Sum of total_tokens on weekend days. */
  weekendTokens: number;
  /** Sum of total_tokens on weekday days. */
  weekdayTokens: number;
  /** weekendTokens / (weekendTokens + weekdayTokens). In [0, 1]. */
  weekendShare: number;
  /** 1 - weekendShare. In [0, 1]. */
  weekdayShare: number;
  /**
   * weekendTokens / weekdayTokens. `null` when weekdayTokens = 0
   * (pure weekend source) -- in that case weekendShare = 1
   * captures the same fact without dividing by zero.
   */
  ratio: number | null;
  /**
   * Calendar-density-corrected ratio:
   *   (weekendTokens / weekendCalendarDayCount) /
   *   (weekdayTokens / weekdayCalendarDayCount)
   * 1.0 = uniform per-day intensity across the two sets.
   * `null` when EITHER weekendCalendarDayCount = 0 OR
   * weekdayCalendarDayCount = 0 OR weekdayTokens = 0.
   */
  densityRatio: number | null;
  weekendRegime: DailyTokenWeekendRegime;
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenWeekendWeekdayRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenWeekendWeekdayRatioSort;
  minWeekendShare: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinWeekendShare: number;
  droppedTopSources: number;
  sources: DailyTokenWeekendWeekdayRatioSourceRow[];
}

/**
 * Returns true iff the UTC day key `YYYY-MM-DD` is a Saturday
 * (getUTCDay() = 6) or Sunday (getUTCDay() = 0). Throws if the
 * input is not a parseable UTC day.
 */
export function isWeekendUtcDay(day: string): boolean {
  const ms = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(ms)) {
    throw new Error(`isWeekendUtcDay: invalid day ${day}`);
  }
  const dow = new Date(ms).getUTCDay();
  return dow === 0 || dow === 6;
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
 * Classify weekendShare into a regime label. Pure / total
 * function; does not look at counts.
 */
export function classifyWeekendRegime(
  weekendShare: number,
  weekendTokens: number,
  weekdayTokens: number,
): DailyTokenWeekendRegime {
  // Pure-pole detection: zero-token side wins the absolute label.
  if (weekendTokens === 0 && weekdayTokens === 0) {
    return 'degenerate';
  }
  if (weekendTokens === 0) return 'weekday-only';
  if (weekdayTokens === 0) return 'weekend-only';
  const baseLow = 2 / 7; // ~0.2857
  const baseHigh = 3 / 7; // ~0.4286
  if (weekendShare < 0.1) return 'weekday-heavy';
  if (weekendShare < baseLow) return 'weekday-leaning';
  if (weekendShare < baseHigh) return 'balanced';
  if (weekendShare < 0.6) return 'weekend-leaning';
  return 'weekend-heavy';
}

export function buildDailyTokenWeekendWeekdayRatio(
  queue: QueueLine[],
  opts: DailyTokenWeekendWeekdayRatioOptions = {},
): DailyTokenWeekendWeekdayRatioReport {
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
  const minWeekendShare = opts.minWeekendShare ?? null;
  if (
    minWeekendShare !== null &&
    (!Number.isFinite(minWeekendShare) ||
      minWeekendShare < 0 ||
      minWeekendShare > 1)
  ) {
    throw new Error(
      `minWeekendShare must be a finite number in [0, 1] or null (got ${opts.minWeekendShare})`,
    );
  }
  const sort: DailyTokenWeekendWeekdayRatioSort = opts.sort ?? 'weekendShare';
  const validSorts: DailyTokenWeekendWeekdayRatioSort[] = [
    'weekendShare',
    'weekdayShare',
    'ratio',
    'densityRatio',
    'weekendTokens',
    'weekdayTokens',
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
  const rows: DailyTokenWeekendWeekdayRatioSourceRow[] = [];

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

    // Partition active days.
    let weekendTokens = 0;
    let weekdayTokens = 0;
    let weekendActiveDayCount = 0;
    let weekdayActiveDayCount = 0;
    for (const [day, v] of acc.perDay) {
      if (isWeekendUtcDay(day)) {
        weekendTokens += v;
        weekendActiveDayCount += 1;
      } else {
        weekdayTokens += v;
        weekdayActiveDayCount += 1;
      }
    }

    // Calendar-day partition over the active span (used for density correction).
    let weekendCalendarDayCount = 0;
    let weekdayCalendarDayCount = 0;
    for (let i = 0; i < spanDays; i += 1) {
      const day = addUtcDays(acc.firstDay, i);
      if (isWeekendUtcDay(day)) weekendCalendarDayCount += 1;
      else weekdayCalendarDayCount += 1;
    }

    const denom = weekendTokens + weekdayTokens;
    const weekendShare = denom > 0 ? weekendTokens / denom : 0;
    const weekdayShare = denom > 0 ? weekdayTokens / denom : 0;
    const ratio: number | null =
      weekdayTokens > 0 ? weekendTokens / weekdayTokens : null;

    let densityRatio: number | null = null;
    if (
      weekendCalendarDayCount > 0 &&
      weekdayCalendarDayCount > 0 &&
      weekdayTokens > 0
    ) {
      const weekendIntensity = weekendTokens / weekendCalendarDayCount;
      const weekdayIntensity = weekdayTokens / weekdayCalendarDayCount;
      if (weekdayIntensity > 0) {
        densityRatio = weekendIntensity / weekdayIntensity;
      }
    }

    let weekendRegime: DailyTokenWeekendRegime = classifyWeekendRegime(
      weekendShare,
      weekendTokens,
      weekdayTokens,
    );
    // Calendar-blind overrides: if the source's active span fits
    // entirely inside a stretch of one parity, ratio is undefined
    // and we surface that explicitly. Note the regime above can
    // already return 'weekend-only'/'weekday-only' on a token basis;
    // the calendar-blind label fires only when the SPAN itself
    // contains no day of the missing parity (more diagnostic).
    if (weekdayCalendarDayCount === 0) {
      weekendRegime = 'weekday-blind';
    } else if (weekendCalendarDayCount === 0) {
      weekendRegime = 'weekend-blind';
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
      weekendActiveDayCount,
      weekdayActiveDayCount,
      weekendCalendarDayCount,
      weekdayCalendarDayCount,
      weekendTokens,
      weekdayTokens,
      weekendShare,
      weekdayShare,
      ratio,
      densityRatio,
      weekendRegime,
      meanDailyTokens: meanDaily,
      degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinWeekendShare = 0;
  let filtered = rows;
  if (minWeekendShare !== null) {
    const next: DailyTokenWeekendWeekdayRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.weekendShare >= minWeekendShare) next.push(r);
      else droppedBelowMinWeekendShare += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'weekdayShare':
        primary = b.weekdayShare - a.weekdayShare;
        break;
      case 'ratio': {
        const av = a.ratio === null ? Number.POSITIVE_INFINITY : a.ratio;
        const bv = b.ratio === null ? Number.POSITIVE_INFINITY : b.ratio;
        primary = bv - av;
        break;
      }
      case 'densityRatio': {
        const av =
          a.densityRatio === null
            ? Number.POSITIVE_INFINITY
            : a.densityRatio;
        const bv =
          b.densityRatio === null
            ? Number.POSITIVE_INFINITY
            : b.densityRatio;
        primary = bv - av;
        break;
      }
      case 'weekendTokens':
        primary = b.weekendTokens - a.weekendTokens;
        break;
      case 'weekdayTokens':
        primary = b.weekdayTokens - a.weekdayTokens;
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
      case 'weekendShare':
      default:
        primary = b.weekendShare - a.weekendShare;
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
    minWeekendShare,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinWeekendShare,
    droppedTopSources,
    sources: kept,
  };
}
