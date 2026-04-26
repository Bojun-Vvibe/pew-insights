/**
 * source-active-hour-longest-run: per-source longest *contiguous* run of
 * *active* UTC hours-of-day (those with positive token mass) on the
 * circular 24-cycle.
 *
 * For each source we collapse every hourly bucket onto a length-24 vector
 * indexed by UTC hour-of-day,
 *
 *   H_h = sum_{rows with utc-hour = h} total_tokens     (h in 0..23)
 *
 * and report:
 *
 *   - activeHours:        count of h in 0..23 with H_h > 0     (range 0..24)
 *   - longestActiveRun:   longest *circular* run of consecutive
 *                         positive hours, wrapping the 23->0 boundary
 *                         (range 0..24).
 *   - activeRunCount:     number of maximal positive-runs on the
 *                         circular 24-cycle. 1 means a single contiguous
 *                         "shift"; >1 means the source is split across
 *                         multiple disjoint active windows.
 *   - activeRunShare:     longestActiveRun / activeHours in (0..1].
 *                         1.0 means *every* active hour is part of one
 *                         contiguous block; lower values mean the source's
 *                         active mass is fragmented across the day.
 *   - longestRunStart:    UTC hour where the longest active run starts
 *                         (-1 if activeHours=0).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `source-dead-hour-count` measures `liveHours` (count) and
 *     `longestDeadRun` (longest run of *zeros*). It does NOT measure
 *     contiguity of the *active* mass. Two sources with `liveHours=12`
 *     can have `longestActiveRun=12` (one solid shift) vs
 *     `longestActiveRun=1` (12 disjoint live hours alternating with
 *     dead ones); dead-hour-count cannot tell them apart on the
 *     active axis.
 *   - `source-token-mass-hour-centroid` reports the circular *mean*,
 *     not the contiguous run length.
 *   - `source-hour-of-day-topk-mass-share` reports the share of the
 *     top-k hours; it does not measure whether those hours are
 *     adjacent on the clock.
 *   - `source-day-of-week-token-mass-share` is the day-of-week axis.
 *   - `source-active-day-streak` measures consecutive *calendar* days,
 *     not consecutive hours-of-day on a circular axis.
 *   - `source-run-lengths` measures consecutive hourly *buckets in
 *     wall-clock time*, not the hour-of-day clock projection.
 *
 * Headline question:
 *   **"For each source, what's the longest contiguous block of
 *   hours-of-day where it's active, and is its activity one shift or
 *   several scattered windows?"**
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
 *   - `sort` (default 'tokens'): 'tokens' | 'run' | 'active' | 'share' |
 *     'source'. 'run' = longestActiveRun desc, 'active' = activeHours
 *     desc, 'share' = activeRunShare desc.
 *   - `tz` is intentionally NOT a knob: hour-of-day is read from the
 *     UTC timestamp, matching every other time-axis stat in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type SourceActiveHourLongestRunSort =
  | 'tokens'
  | 'run'
  | 'active'
  | 'share'
  | 'source';

export interface SourceActiveHourLongestRunOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceActiveHourLongestRunSort;
  /**
   * Display filter (refinement, v0.6.45): drop rows whose
   * `longestActiveRun` is strictly below this integer threshold.
   * Useful for surfacing only sources with a substantial contiguous
   * active block (e.g. --min-longest-active-run 8 hides any source
   * whose busiest contiguous shift is shorter than 8 hours).
   * Range 0..24; default 0 = no filter.
   */
  minLongestActiveRun?: number;
  /**
   * Display filter (refinement, v0.6.45): drop rows whose
   * `activeHours` (raw count of nonzero hour-of-day bins) is
   * strictly below this integer threshold. Range 0..24; default
   * 0 = no filter.
   *
   * Complementary to `minLongestActiveRun`:
   *   - `minActiveHours` filters by raw *count* of active hours.
   *   - `minLongestActiveRun` filters by *contiguity* of those
   *     hours.
   * A source with `activeHours=12` scattered as 12 alternating
   * single hours has `longestActiveRun=1` and `activeHours=12`;
   * `--min-active-hours 10` keeps it, `--min-longest-active-run 6`
   * drops it. The two filters compose by intersection.
   */
  minActiveHours?: number;
  generatedAt?: string;
}

export interface SourceActiveHourLongestRunSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC hour-buckets that contributed rows. */
  nBuckets: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Token mass per UTC hour-of-day (length 24). */
  hourMass: number[];
  /** Count of hour-of-day bins with positive token mass. Range 0..24. */
  activeHours: number;
  /** Longest *circular* run of consecutive positive hours. Range 0..24. */
  longestActiveRun: number;
  /** Number of maximal positive-runs on the circular 24-cycle. */
  activeRunCount: number;
  /**
   * longestActiveRun / activeHours, or 0 if activeHours=0.
   * 1.0 = every active hour is part of one contiguous block.
   * Lower values indicate fragmentation across multiple shifts.
   */
  activeRunShare: number;
  /** UTC hour at which the longest active run starts. -1 if no active hours. */
  longestRunStart: number;
}

export interface SourceActiveHourLongestRunReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceActiveHourLongestRunSort;
  minLongestActiveRun: number;
  minActiveHours: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinLongestActiveRun: number;
  droppedBelowMinActiveHours: number;
  droppedTopSources: number;
  sources: SourceActiveHourLongestRunSourceRow[];
}

/**
 * Compute, on a circular 24-cycle, the longest contiguous run of
 * *positive* (non-zero) entries and the number of such maximal runs,
 * plus the start index of the longest run.
 *
 * If every entry is positive, returns
 *   { longestRun: n, runCount: 1, longestRunStart: 0 }.
 * If no entry is positive, returns
 *   { longestRun: 0, runCount: 0, longestRunStart: -1 }.
 * If multiple runs share the max length, the smallest start index is
 * preferred (deterministic).
 */
export function circularPositiveRuns(
  v: number[],
): { longestRun: number; runCount: number; longestRunStart: number } {
  const n = v.length;
  if (n === 0) return { longestRun: 0, runCount: 0, longestRunStart: -1 };
  let posCount = 0;
  for (const x of v) if (x > 0) posCount += 1;
  if (posCount === 0) return { longestRun: 0, runCount: 0, longestRunStart: -1 };
  if (posCount === n) return { longestRun: n, runCount: 1, longestRunStart: 0 };

  // Walk twice to find the longest circular run and its start.
  let longest = 0;
  let longestStart = -1;
  let cur = 0;
  let curStart = -1;
  for (let i = 0; i < 2 * n; i++) {
    if (v[i % n]! > 0) {
      if (cur === 0) curStart = i % n;
      cur += 1;
      if (cur > longest) {
        longest = cur;
        longestStart = curStart;
      }
    } else {
      cur = 0;
      curStart = -1;
    }
  }
  if (longest > n) longest = n;

  // Count maximal positive-runs on the linear array, then merge wrap if
  // both ends are positive.
  let runs = 0;
  let inRun = false;
  for (let i = 0; i < n; i++) {
    if (v[i]! > 0) {
      if (!inRun) {
        runs += 1;
        inRun = true;
      }
    } else {
      inRun = false;
    }
  }
  if (v[0]! > 0 && v[n - 1]! > 0 && runs > 1) {
    runs -= 1;
  }

  // Normalize start index when longest run wraps: prefer the start that
  // sits in [0, n). The two-pass walk already returns i % n.
  // Tie-breaker: among runs of the same max length, return the one with
  // smallest start index in the *linear* sense (helps make tests stable).
  // We re-scan to pick the deterministic minimum start.
  if (runs > 1) {
    // Walk the doubled array once more, tracking every maximal run >= longest,
    // and pick the earliest start in [0, n).
    let bestStart = longestStart;
    let cur2 = 0;
    let cur2Start = -1;
    for (let i = 0; i < 2 * n; i++) {
      if (v[i % n]! > 0) {
        if (cur2 === 0) cur2Start = i % n;
        cur2 += 1;
        if (cur2 === longest) {
          if (bestStart === -1 || cur2Start < bestStart) bestStart = cur2Start;
        }
      } else {
        cur2 = 0;
        cur2Start = -1;
      }
    }
    longestStart = bestStart;
  }

  return { longestRun: longest, runCount: runs, longestRunStart: longestStart };
}

export function buildSourceActiveHourLongestRun(
  queue: QueueLine[],
  opts: SourceActiveHourLongestRunOptions = {},
): SourceActiveHourLongestRunReport {
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
  const minLongestActiveRun = opts.minLongestActiveRun ?? 0;
  if (
    !Number.isInteger(minLongestActiveRun) ||
    minLongestActiveRun < 0 ||
    minLongestActiveRun > 24
  ) {
    throw new Error(
      `minLongestActiveRun must be an integer in [0, 24] (got ${opts.minLongestActiveRun})`,
    );
  }
  const minActiveHours = opts.minActiveHours ?? 0;
  if (
    !Number.isInteger(minActiveHours) ||
    minActiveHours < 0 ||
    minActiveHours > 24
  ) {
    throw new Error(
      `minActiveHours must be an integer in [0, 24] (got ${opts.minActiveHours})`,
    );
  }
  const sort: SourceActiveHourLongestRunSort = opts.sort ?? 'tokens';
  const validSorts: SourceActiveHourLongestRunSort[] = [
    'tokens',
    'run',
    'active',
    'share',
    'source',
  ];
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

  interface SrcAcc {
    mass: number[];
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
  const rows: SourceActiveHourLongestRunSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    let activeHours = 0;
    for (let h = 0; h < 24; h++) {
      if ((acc.mass[h] ?? 0) > 0) activeHours += 1;
    }
    const { longestRun, runCount, longestRunStart } = circularPositiveRuns(
      acc.mass,
    );
    const activeRunShare = activeHours > 0 ? longestRun / activeHours : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nBuckets: acc.nBuckets,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hourMass: acc.mass.slice(),
      activeHours,
      longestActiveRun: longestRun,
      activeRunCount: runCount,
      activeRunShare,
      longestRunStart,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinLongestActiveRun = 0;
  let filtered = rows;
  if (minLongestActiveRun > 0) {
    const next: SourceActiveHourLongestRunSourceRow[] = [];
    for (const r of rows) {
      if (r.longestActiveRun >= minLongestActiveRun) next.push(r);
      else droppedBelowMinLongestActiveRun += 1;
    }
    filtered = next;
  }

  let droppedBelowMinActiveHours = 0;
  if (minActiveHours > 0) {
    const next: SourceActiveHourLongestRunSourceRow[] = [];
    for (const r of filtered) {
      if (r.activeHours >= minActiveHours) next.push(r);
      else droppedBelowMinActiveHours += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'run':
        primary = b.longestActiveRun - a.longestActiveRun;
        break;
      case 'active':
        primary = b.activeHours - a.activeHours;
        break;
      case 'share':
        primary = b.activeRunShare - a.activeRunShare;
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
    minLongestActiveRun,
    minActiveHours,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinLongestActiveRun,
    droppedBelowMinActiveHours,
    droppedTopSources,
    sources: kept,
  };
}
