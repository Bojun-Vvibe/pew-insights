/**
 * source-dead-hour-count: per-source count of UTC hours of day (0..23)
 * with zero observed token mass over the source's lifetime in window.
 *
 * For each source we collapse every hourly bucket onto a length-24 vector
 * indexed by UTC hour-of-day,
 *
 *   H_h = sum_{rows with utc-hour = h} total_tokens     (h in 0..23)
 *
 * and report:
 *
 *   - deadHours:    count of h in 0..23 with H_h == 0    (range 0..24)
 *   - liveHours:    24 - deadHours                       (range 0..24)
 *   - deadShare:    deadHours / 24                       (range 0..1)
 *   - longestDeadRun: longest *circular* run of consecutive zero hours
 *     wrapping the 0..23 axis (range 0..24). 24 means the source has
 *     no observations at all (which should be filtered by minTokens).
 *   - deadRunCount: number of maximal zero-runs on the *circular*
 *     24-cycle. 0 means the source covers all 24 hours; 1 means there
 *     is a single contiguous quiet block; >1 means quiet hours are
 *     fragmented across the day.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `source-token-mass-hour-centroid` reports the *circular mean* of
 *     the hour-of-day distribution. A source with mass concentrated at
 *     09:00 and at 21:00 has centroid near 03:00, which is misleading.
 *     This subcommand surfaces the *sparseness* of the same axis, not
 *     the centroid.
 *   - `source-hour-of-day-topk-mass-share` reports the share of the
 *     top-k busiest hours. It does not count zero hours: a source with
 *     mass in only 3 hours and a source with mass in 14 hours can both
 *     have the same topK share if their tail is similar.
 *   - `source-day-of-week-token-mass-share` is the day-of-week axis,
 *     not hour-of-day.
 *   - `hour-of-day-token-skew`, `peak-hour`, `time-of-day` are *global*
 *     not per-source.
 *   - `source-dry-spell` and `source-decay-half-life` are calendar-day
 *     recency metrics — they care about which dates have zero, not
 *     which hours-of-day. A source that posts every single day at the
 *     same hour has zero dry-spell but 23 dead hours.
 *
 * Headline question:
 *   **"For each source, how many hours of the 24-hour clock are
 *   completely unused, and is that quiet zone one block or several?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): structural floor on total token mass
 *     for a source row to be reported. Sparse sources surface as
 *     `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'dead' | 'live' | 'run' |
 *     'source'. 'dead' = deadHours desc, 'live' = liveHours desc,
 *     'run' = longestDeadRun desc.
 *   - `tz` is intentionally NOT a knob: hour-of-day is read from the
 *     UTC timestamp, matching every other time-axis stat in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type SourceDeadHourCountSort =
  | 'tokens'
  | 'dead'
  | 'live'
  | 'run'
  | 'source';

export interface SourceDeadHourCountOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceDeadHourCountSort;
  /**
   * Display filter (refinement, v0.6.43): drop rows whose `deadHours`
   * is strictly below this integer threshold. Useful for surfacing
   * only sources with a substantial quiet zone (e.g. --min-dead-hours
   * 12 hides any source that uses more than half the 24-hour clock).
   * Range 0..24; default 0 = no filter.
   */
  minDeadHours?: number;
  generatedAt?: string;
}

export interface SourceDeadHourCountSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC hour-buckets that contributed rows. */
  nBuckets: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Token mass per UTC hour-of-day (length 24). */
  hourMass: number[];
  /** Count of hour-of-day bins with zero token mass. Range 0..24. */
  deadHours: number;
  /** 24 - deadHours. Range 0..24. */
  liveHours: number;
  /** deadHours / 24. Range 0..1. */
  deadShare: number;
  /** Longest *circular* run of consecutive zero hours. Range 0..24. */
  longestDeadRun: number;
  /** Number of maximal zero-runs on the circular 24-cycle. */
  deadRunCount: number;
}

export interface SourceDeadHourCountReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceDeadHourCountSort;
  minDeadHours: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDeadHours: number;
  droppedTopSources: number;
  sources: SourceDeadHourCountSourceRow[];
}

/**
 * Compute, on a circular 24-cycle:
 *   - longestRun: length of the longest contiguous run of zeros
 *     (wrapping across the 23->0 boundary).
 *   - runCount:   number of maximal zero-runs.
 *
 * If every entry is zero, returns { longestRun: 24, runCount: 1 }.
 * If no entry is zero, returns { longestRun: 0, runCount: 0 }.
 */
export function circularZeroRuns(
  v: number[],
): { longestRun: number; runCount: number } {
  const n = v.length;
  if (n === 0) return { longestRun: 0, runCount: 0 };
  let zeroCount = 0;
  for (const x of v) if (x === 0) zeroCount += 1;
  if (zeroCount === 0) return { longestRun: 0, runCount: 0 };
  if (zeroCount === n) return { longestRun: n, runCount: 1 };

  // Walk twice to get circular runs without index gymnastics.
  let longest = 0;
  let cur = 0;
  for (let i = 0; i < 2 * n; i++) {
    if (v[i % n] === 0) {
      cur += 1;
      if (cur > longest) longest = cur;
    } else {
      cur = 0;
    }
  }
  if (longest > n) longest = n;

  // Count maximal zero-runs on the linear array, then merge wrap if both
  // ends are zero.
  let runs = 0;
  let inRun = false;
  for (let i = 0; i < n; i++) {
    if (v[i] === 0) {
      if (!inRun) {
        runs += 1;
        inRun = true;
      }
    } else {
      inRun = false;
    }
  }
  if (v[0] === 0 && v[n - 1] === 0 && runs > 1) {
    runs -= 1;
  }
  return { longestRun: longest, runCount: runs };
}

export function buildSourceDeadHourCount(
  queue: QueueLine[],
  opts: SourceDeadHourCountOptions = {},
): SourceDeadHourCountReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minDeadHours = opts.minDeadHours ?? 0;
  if (
    !Number.isInteger(minDeadHours) ||
    minDeadHours < 0 ||
    minDeadHours > 24
  ) {
    throw new Error(
      `minDeadHours must be an integer in [0, 24] (got ${opts.minDeadHours})`,
    );
  }
  const sort: SourceDeadHourCountSort = opts.sort ?? 'tokens';
  const validSorts: SourceDeadHourCountSort[] = [
    'tokens',
    'dead',
    'live',
    'run',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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

  interface SrcAcc {
    mass: number[]; // length 24
    nBuckets: number;
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
    const hour = new Date(ms).getUTCHours();
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        mass: new Array(24).fill(0),
        nBuckets: 0,
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.mass[hour] = (acc.mass[hour] ?? 0) + tt;
    acc.totalTokens += tt;
    acc.nBuckets += 1;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokensSum = 0;
  const rows: SourceDeadHourCountSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    let deadHours = 0;
    for (let h = 0; h < 24; h++) {
      if ((acc.mass[h] ?? 0) === 0) deadHours += 1;
    }
    const liveHours = 24 - deadHours;
    const { longestRun, runCount } = circularZeroRuns(acc.mass);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nBuckets: acc.nBuckets,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hourMass: acc.mass.slice(),
      deadHours,
      liveHours,
      deadShare: deadHours / 24,
      longestDeadRun: longestRun,
      deadRunCount: runCount,
    });
    totalTokensSum += acc.totalTokens;
  }

  // refinement filter (v0.6.43)
  let droppedBelowMinDeadHours = 0;
  let filtered = rows;
  if (minDeadHours > 0) {
    const next: SourceDeadHourCountSourceRow[] = [];
    for (const r of rows) {
      if (r.deadHours >= minDeadHours) next.push(r);
      else droppedBelowMinDeadHours += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'dead':
        primary = b.deadHours - a.deadHours;
        break;
      case 'live':
        primary = b.liveHours - a.liveHours;
        break;
      case 'run':
        primary = b.longestDeadRun - a.longestDeadRun;
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
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
    top,
    sort,
    minDeadHours,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDeadHours,
    droppedTopSources,
    sources: kept,
  };
}
