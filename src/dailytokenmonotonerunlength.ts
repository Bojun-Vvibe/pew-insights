/**
 * daily-token-monotone-run-length: per-source longest run of
 * **strictly monotone** consecutive daily total-token values
 * (separately for strictly-increasing and strictly-decreasing
 * directions), plus the live "current run" the source is on.
 *
 * Why a fresh subcommand (orthogonality vs everything shipped):
 *
 *   - `daily-token-autocorrelation-lag1` measures *linear* serial
 *     correlation rho1. A perfectly stair-stepped 1, 2, 3, 4, 5, 6
 *     series and a 1, 6, 2, 5, 3, 7 series can have similar rho1 in
 *     edge cases, but the former has a 6-day strictly-increasing
 *     run and the latter has a max monotone run of 2. rho1 is a
 *     mean-shape statistic; this is a *trajectory-shape* statistic.
 *   - `source-active-day-streak` / `bucket-streak-length` count
 *     consecutive *active* periods (binary indicator), saying
 *     nothing about the *direction* of the magnitude trace.
 *   - `source-decay-half-life` and `cumulative-tokens-midpoint`
 *     describe the cumulative shape of the source's lifetime
 *     mass; they do not detect locally-monotone segments inside
 *     a noisy series.
 *   - `trend` / `forecast` fit a global linear drift; they cannot
 *     surface "this source had a 5-day unbroken climb followed by
 *     a 4-day unbroken decline" — both halves cancel into ~zero
 *     slope.
 *   - `burstiness`, `rolling-bucket-cv`, `bucket-token-gini` are
 *     dispersion statistics with no notion of *order*; permuting
 *     the daily series leaves them unchanged but collapses every
 *     monotone-run length to 1 in expectation.
 *   - `daily-token-autocorrelation-lag1` is correlation, this is
 *     persistence-of-direction. Headline question:
 *     **"What is the longest unbroken climb (or fall) this source
 *     has ever strung together — and is it on one right now?"**
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`):
 *      tokens summed across all device/model rows for that day.
 *      Days with non-positive tokens are dropped (consistent with
 *      `daily-token-autocorrelation-lag1` and `rolling-bucket-cv`).
 *   2. The source's *active-day series* is those daily totals
 *      sorted ascending by day. By default we operate on the
 *      source's own *consecutive active days* (no calendar
 *      gap-fill): a "monotone step" is a strict comparison
 *      between adjacent active-day values, regardless of
 *      whether the calendar days were adjacent.
 *   3. A run is a maximal sequence of *consecutive strict steps*
 *      in the same direction. Length is **number of days
 *      participating** (i.e. steps + 1). A source with no strict
 *      steps has no runs (length-1 single-day or all-equal
 *      neighbours produce zero qualifying runs); we report
 *      `longestUpRun: 0`, `longestDownRun: 0`, `runs: 0` in
 *      that case rather than 1, so the operator can immediately
 *      see "no detectable monotone segment".
 *   4. We also track the **current run**: the run *ending on the
 *      source's last active day*. `currentDirection` is `'up'`,
 *      `'down'`, or `'flat'` (last two equal values, or single
 *      day). `currentRunLength` is the length of that run (>=1
 *      whenever the source has any active day; 0 only for empty
 *      sources, which are dropped earlier).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source (others surface as
 *     `droppedSourceFilter`).
 *   - `minDays` (default 2): structural floor; need at least 2
 *     active days for any step to exist. Sparse sources surface
 *     as `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`
 *     after sort. Suppressed surface as `droppedTopSources`.
 *   - `sort`: `'tokens'` (default) | `'longest'` | `'up'` |
 *     `'down'` | `'current'` | `'ndays'` | `'source'`.
 */
import type { QueueLine } from './types.js';

export type MonotoneDirection = 'up' | 'down' | 'flat';

export interface DailyTokenMonotoneRunLengthOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Restrict analysis to a single source. Non-matching rows
   * surface as `droppedSourceFilter`. null = no filter.
   */
  source?: string | null;
  /**
   * Minimum number of *active* calendar days required for the
   * source to be reported. Must be >= 2 (need at least one
   * adjacent pair to define a step). Default 2.
   */
  minDays?: number;
  /**
   * Truncate `sources[]` to the top N rows after the sort.
   * Display filter only -- global denominators reflect the full
   * kept population. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for the per-source table (display only).
   *   - 'tokens'  (default): totalTokens desc, source asc
   *   - 'longest':           longestMonotoneRun desc, source asc
   *   - 'up':                longestUpRun desc, source asc
   *   - 'down':              longestDownRun desc, source asc
   *   - 'current':           currentRunLength desc, source asc
   *   - 'ndays':             nActiveDays desc, source asc
   *   - 'source':            source asc
   */
  sort?: 'tokens' | 'longest' | 'up' | 'down' | 'current' | 'ndays' | 'source';
  /**
   * Display filter: hide rows whose `longestMonotoneRun` is
   * strictly below this value. Counts surface as
   * `droppedBelowMinLongestRun`. Default 0 = no floor (every
   * surviving source is shown).
   */
  minLongestRun?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenMonotoneRunLengthSourceRow {
  source: string;
  /** Sum of total_tokens across the source's positive-token days. */
  totalTokens: number;
  /** Count of distinct active calendar days (>= 2 in any kept row). */
  nActiveDays: number;
  /** ISO YYYY-MM-DD of the first active day. */
  firstActiveDay: string;
  /** ISO YYYY-MM-DD of the last active day. */
  lastActiveDay: string;
  /**
   * Length (in days) of the longest strictly-increasing run of
   * consecutive active-day values. 0 when no such run exists
   * (e.g. all-flat or all-down series).
   */
  longestUpRun: number;
  /** ISO YYYY-MM-DD of the first day of `longestUpRun` (empty when 0). */
  longestUpStart: string;
  /** ISO YYYY-MM-DD of the last day of `longestUpRun` (empty when 0). */
  longestUpEnd: string;
  /** Length of the longest strictly-decreasing run. 0 when none. */
  longestDownRun: number;
  /** ISO YYYY-MM-DD of the first day of `longestDownRun` (empty when 0). */
  longestDownStart: string;
  /** ISO YYYY-MM-DD of the last day of `longestDownRun` (empty when 0). */
  longestDownEnd: string;
  /**
   * `max(longestUpRun, longestDownRun)`. Convenience field for
   * sorting and headline reporting.
   */
  longestMonotoneRun: number;
  /**
   * Direction of the longest monotone run. 'up' or 'down'. When
   * up == down (tie), 'up' wins (deterministic). 'flat' only
   * when both are 0.
   */
  longestDirection: MonotoneDirection;
  /**
   * Direction of the run *ending on* the source's last active
   * day. 'up' or 'down' if the trailing two active values are
   * strictly different; 'flat' if they are equal (or only one
   * active day). For a source with `nActiveDays == 1` this is
   * 'flat' with `currentRunLength == 1`.
   */
  currentDirection: MonotoneDirection;
  /**
   * Length (in days) of the current trailing monotone run.
   * Always >= 1 for any kept source. For a 'flat' direction this
   * is the count of trailing equal-valued active days (>= 1).
   */
  currentRunLength: number;
  /**
   * Total count of maximal strict monotone runs of length >= 2
   * across the source's series (sum of "up" and "down" runs).
   */
  runs: number;
}

export interface DailyTokenMonotoneRunLengthReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minDays floor. */
  minDays: number;
  /** Echo of resolved minLongestRun floor. */
  minLongestRun: number;
  /** Echo of resolved top cap (0 = no cap). */
  top: number;
  /** Echo of resolved sort key. */
  sort: 'tokens' | 'longest' | 'up' | 'down' | 'current' | 'ndays' | 'source';
  /** Echo of source filter (null when not set). */
  source: string | null;
  /** Sum of total_tokens across all kept source rows. */
  totalTokens: number;
  /** Distinct sources seen (before display filters). */
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Sources with fewer than `minDays` active days. */
  droppedSparseSources: number;
  /** Source rows hidden by `minLongestRun`. */
  droppedBelowMinLongestRun: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** One row per kept source. */
  sources: DailyTokenMonotoneRunLengthSourceRow[];
}

/**
 * Walk the daily series once and find every maximal strictly-up
 * run and every maximal strictly-down run, with the indices of
 * the start and end of each. Equal adjacent values break runs in
 * both directions (they belong to neither).
 */
interface RunSpan {
  startIdx: number;
  endIdx: number;
  length: number;
}

function findMonotoneRuns(values: number[]): { up: RunSpan[]; down: RunSpan[] } {
  const up: RunSpan[] = [];
  const down: RunSpan[] = [];
  if (values.length < 2) return { up, down };

  let runStart = 0;
  let runDir: MonotoneDirection = 'flat';

  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const cur = values[i]!;
    let stepDir: MonotoneDirection;
    if (cur > prev) stepDir = 'up';
    else if (cur < prev) stepDir = 'down';
    else stepDir = 'flat';

    if (stepDir === 'flat') {
      // close any open monotone run at i-1
      if (runDir === 'up' || runDir === 'down') {
        const span: RunSpan = {
          startIdx: runStart,
          endIdx: i - 1,
          length: i - 1 - runStart + 1,
        };
        if (runDir === 'up') up.push(span);
        else down.push(span);
      }
      runStart = i;
      runDir = 'flat';
      continue;
    }

    if (runDir === 'flat') {
      // start a new run at i-1, current step extends it
      runStart = i - 1;
      runDir = stepDir;
      continue;
    }

    if (stepDir === runDir) {
      // continue the run
      continue;
    }

    // direction flipped: close the open run, start new one at i-1
    const span: RunSpan = {
      startIdx: runStart,
      endIdx: i - 1,
      length: i - 1 - runStart + 1,
    };
    if (runDir === 'up') up.push(span);
    else down.push(span);
    runStart = i - 1;
    runDir = stepDir;
  }

  // close trailing run
  if (runDir === 'up' || runDir === 'down') {
    const lastIdx = values.length - 1;
    const span: RunSpan = {
      startIdx: runStart,
      endIdx: lastIdx,
      length: lastIdx - runStart + 1,
    };
    if (runDir === 'up') up.push(span);
    else down.push(span);
  }

  return { up, down };
}

/**
 * Length of the trailing monotone run, plus its direction. For
 * an all-flat tail returns the count of trailing equal-valued
 * days (>= 1). For an empty input returns
 * `{ length: 0, direction: 'flat' }`.
 */
function trailingRun(values: number[]): {
  length: number;
  direction: MonotoneDirection;
} {
  const n = values.length;
  if (n === 0) return { length: 0, direction: 'flat' };
  if (n === 1) return { length: 1, direction: 'flat' };

  const last = values[n - 1]!;
  const prev = values[n - 2]!;
  let dir: MonotoneDirection;
  if (last > prev) dir = 'up';
  else if (last < prev) dir = 'down';
  else dir = 'flat';

  if (dir === 'flat') {
    let len = 1;
    for (let i = n - 1; i > 0; i--) {
      if (values[i] === values[i - 1]) len += 1;
      else break;
    }
    return { length: len, direction: 'flat' };
  }

  // monotone tail: walk back while sign matches strictly
  let len = 2;
  for (let i = n - 2; i > 0; i--) {
    const a = values[i - 1]!;
    const b = values[i]!;
    if (dir === 'up' && b > a) len += 1;
    else if (dir === 'down' && b < a) len += 1;
    else break;
  }
  return { length: len, direction: dir };
}

export function buildDailyTokenMonotoneRunLength(
  queue: QueueLine[],
  opts: DailyTokenMonotoneRunLengthOptions = {},
): DailyTokenMonotoneRunLengthReport {
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(`minDays must be an integer >= 2 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minLongestRun = opts.minLongestRun ?? 0;
  if (!Number.isInteger(minLongestRun) || minLongestRun < 0) {
    throw new Error(
      `minLongestRun must be a non-negative integer (got ${opts.minLongestRun})`,
    );
  }
  const sort = opts.sort ?? 'tokens';
  const validSorts = ['tokens', 'longest', 'up', 'down', 'current', 'ndays', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
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

  // source -> day(YYYY-MM-DD) -> tokens
  const agg = new Map<string, Map<string, number>>();
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

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const day = q.hour_start.slice(0, 10);
    let days = agg.get(src);
    if (!days) {
      days = new Map<string, number>();
      agg.set(src, days);
    }
    days.set(day, (days.get(day) ?? 0) + tt);
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokens = 0;
  const rows: DailyTokenMonotoneRunLengthSourceRow[] = [];

  for (const [src, days] of agg) {
    const sortedDays = Array.from(days.keys()).sort();
    const series = sortedDays.map((d) => days.get(d)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;

    if (series.length < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const { up, down } = findMonotoneRuns(series);
    const longestUpSpan = up.reduce<RunSpan | null>(
      (best, s) => (best === null || s.length > best.length ? s : best),
      null,
    );
    const longestDownSpan = down.reduce<RunSpan | null>(
      (best, s) => (best === null || s.length > best.length ? s : best),
      null,
    );
    const longestUpRun = longestUpSpan?.length ?? 0;
    const longestDownRun = longestDownSpan?.length ?? 0;
    const longestMonotoneRun = Math.max(longestUpRun, longestDownRun);
    let longestDirection: MonotoneDirection;
    if (longestMonotoneRun === 0) longestDirection = 'flat';
    else if (longestUpRun >= longestDownRun) longestDirection = 'up';
    else longestDirection = 'down';

    const cur = trailingRun(series);

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: series.length,
      firstActiveDay: sortedDays[0]!,
      lastActiveDay: sortedDays[sortedDays.length - 1]!,
      longestUpRun,
      longestUpStart: longestUpSpan ? sortedDays[longestUpSpan.startIdx]! : '',
      longestUpEnd: longestUpSpan ? sortedDays[longestUpSpan.endIdx]! : '',
      longestDownRun,
      longestDownStart: longestDownSpan ? sortedDays[longestDownSpan.startIdx]! : '',
      longestDownEnd: longestDownSpan ? sortedDays[longestDownSpan.endIdx]! : '',
      longestMonotoneRun,
      longestDirection,
      currentDirection: cur.direction,
      currentRunLength: cur.length,
      runs: up.length + down.length,
    });
  }

  // Apply minLongestRun display filter
  let droppedBelowMinLongestRun = 0;
  let kept = rows;
  if (minLongestRun > 0) {
    const next: DailyTokenMonotoneRunLengthSourceRow[] = [];
    for (const r of rows) {
      if (r.longestMonotoneRun >= minLongestRun) next.push(r);
      else droppedBelowMinLongestRun += 1;
    }
    kept = next;
  }

  // Sort
  kept.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'longest':
        primary = b.longestMonotoneRun - a.longestMonotoneRun;
        break;
      case 'up':
        primary = b.longestUpRun - a.longestUpRun;
        break;
      case 'down':
        primary = b.longestDownRun - a.longestDownRun;
        break;
      case 'current':
        primary = b.currentRunLength - a.currentRunLength;
        break;
      case 'ndays':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  if (top > 0 && kept.length > top) {
    droppedTopSources = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minDays,
    minLongestRun,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinLongestRun,
    droppedTopSources,
    sources: kept,
  };
}
