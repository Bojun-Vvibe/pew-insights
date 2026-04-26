/**
 * source-active-hour-span: per-source *circular minimum-arc* on the
 * 24-hour UTC clock that covers every active (positive token mass)
 * hour-of-day for that source.
 *
 * For each source we collapse every hourly bucket onto a length-24
 * vector indexed by UTC hour-of-day,
 *
 *   H_h = sum_{rows with utc-hour = h} total_tokens     (h in 0..23)
 *
 * and then find the *smallest contiguous arc on the circular 24-cycle*
 * that contains every h with H_h > 0. Equivalently: sort the active
 * hours around the circle, find the largest gap of *inactive* hours
 * between two consecutive actives (wrapping the 23->0 boundary), and
 * report `circularSpan = 24 - largestQuietGap`.
 *
 * Reports per source:
 *
 *   - activeHours:      count of h in 0..23 with H_h > 0   (range 0..24)
 *   - circularSpan:     width of the minimum-arc cover     (range 0..24)
 *                       0 if activeHours=0 (filtered by minTokens),
 *                       1 if activeHours=1, 24 if active in every hour.
 *   - spanStartHour:    UTC hour where the minimum-arc begins
 *                       (-1 if activeHours=0)
 *   - spanEndHour:      UTC hour where the minimum-arc ends, inclusive
 *                       (-1 if activeHours=0). Equal to spanStartHour
 *                       when activeHours=1; equal to (spanStartHour +
 *                       circularSpan - 1) mod 24 in general.
 *   - largestQuietGap:  24 - circularSpan when activeHours>0, else 0.
 *                       This is the longest stretch of *inactive*
 *                       hour-of-day bins between two active ones on
 *                       the circle.
 *   - spanDensity:      activeHours / circularSpan in (0..1] when
 *                       activeHours>0, else 0. 1.0 means the active
 *                       hours fully fill their waking window with no
 *                       interior gaps; lower values mean the window
 *                       is wide but pocked with quiet hours inside.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `source-dead-hour-count` reports `deadHours` and
 *     `longestDeadRun`, the latter being the longest *circular* run
 *     of zeros. `largestQuietGap` here is the same scalar as
 *     `longestDeadRun` *only* when activeHours fully fill one
 *     contiguous arc; in general they differ. Span = 24 -
 *     longestDeadRun is the *minimum-arc cover*, not the longest
 *     dead run; e.g. active hours {0, 6, 18} on the 24-clock have
 *     longestDeadRun=11 (between 6 and 18) but the minimum-arc
 *     cover is also 24-11=13 from hour 18 wrapping to hour 6.
 *     The orthogonality vs `source-dead-hour-count` lies in the
 *     reported axes (`spanStartHour`, `spanEndHour`, `spanDensity`)
 *     which dead-hour-count does not surface, and in the headline
 *     question being framed as the *active waking window* rather
 *     than the *quiet block*.
 *   - `source-active-hour-longest-run` reports the longest
 *     contiguous *active* block. Two sources with `activeHours=4`
 *     can have `longestActiveRun=4` (one solid 4h shift) and
 *     `circularSpan=4` (density 1.0), or `longestActiveRun=1` with
 *     `circularSpan=20` (density 0.20) — same active count, very
 *     different waking windows.
 *   - `source-token-mass-hour-centroid` reports the circular *mean*;
 *     it does not report the *width* of the support.
 *   - `source-hour-of-day-token-mass-entropy` is mass-weighted
 *     spread; this subcommand is the *support-set* width regardless
 *     of mass distribution. A source whose mass is 99% at hour 09
 *     and 1% at hour 21 has very low entropy but a large circular
 *     span (13), which entropy hides.
 *   - `source-hour-of-day-topk-mass-share` measures the lump share
 *     of the busiest hours on the linear axis; it does not measure
 *     the width of the support arc.
 *
 * Headline question:
 *   **"For each source, what's the *narrowest* slice of the 24-hour
 *   clock that covers every hour it's ever active in, and how
 *   tightly does it fill that slice?"**
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
 *   - `sort` (default 'tokens'): 'tokens' | 'span' | 'density' |
 *     'active' | 'gap' | 'source'. 'span' = circularSpan desc,
 *     'density' = spanDensity desc, 'active' = activeHours desc,
 *     'gap' = largestQuietGap desc.
 *   - `maxSpan` (refinement, v0.6.47): drop rows whose `circularSpan`
 *     is strictly *above* this integer threshold. Useful for
 *     surfacing only sources with a *narrow* waking window. Range
 *     0..24; default 0 = no filter (note: 0 means disabled, NOT
 *     "keep only span<=0"; use `--max-span 24` to keep all rows
 *     while still emitting the filter knob).
 *   - `tz` is intentionally NOT a knob: hour-of-day is read from the
 *     UTC timestamp, matching every other time-axis stat in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type SourceActiveHourSpanSort =
  | 'tokens'
  | 'span'
  | 'density'
  | 'active'
  | 'gap'
  | 'source';

export interface SourceActiveHourSpanOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceActiveHourSpanSort;
  /**
   * Display filter (refinement, v0.6.47): drop rows whose
   * `circularSpan` is strictly *above* this integer threshold.
   * Useful for surfacing only sources with a narrow waking window
   * (e.g. --max-span 12 hides any source whose minimum-arc cover
   * exceeds half the day). Range 0..24; default 0 = no filter
   * (disabled). Use 24 to keep all rows while still echoing the
   * knob.
   */
  maxSpan?: number;
  generatedAt?: string;
}

export interface SourceActiveHourSpanSourceRow {
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
  /** Width of the minimum-arc cover on the circular 24-cycle. Range 0..24. */
  circularSpan: number;
  /** UTC hour where the minimum-arc cover begins. -1 if activeHours=0. */
  spanStartHour: number;
  /** UTC hour where the minimum-arc cover ends, inclusive. -1 if activeHours=0. */
  spanEndHour: number;
  /** 24 - circularSpan when activeHours>0, else 0. */
  largestQuietGap: number;
  /** activeHours / circularSpan in (0..1] when activeHours>0, else 0. */
  spanDensity: number;
}

export interface SourceActiveHourSpanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceActiveHourSpanSort;
  maxSpan: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedAboveMaxSpan: number;
  droppedTopSources: number;
  sources: SourceActiveHourSpanSourceRow[];
}

/**
 * Compute, for a length-n vector of nonnegative numbers on a circular
 * cycle, the minimum-arc cover of the *positive* entries.
 *
 * Returns:
 *   - span:        width of the smallest contiguous arc covering every
 *                  positive entry. 0 if no entries are positive; n if
 *                  every entry is positive.
 *   - startHour:   index where the minimum-arc cover begins, in [0, n).
 *                  -1 if span=0.
 *   - endHour:     index where the minimum-arc cover ends, inclusive,
 *                  in [0, n). -1 if span=0. Equal to startHour when
 *                  span=1; equal to (startHour + span - 1) mod n in
 *                  general.
 *   - largestGap:  n - span when span>0, else 0. The longest stretch
 *                  of inactive entries between two consecutive actives
 *                  on the circle.
 *
 * Determinism: when several arcs share the minimum width, the start
 * with the smallest index in [0, n) is returned.
 */
export function circularMinimumArcCover(
  v: number[],
): { span: number; startHour: number; endHour: number; largestGap: number } {
  const n = v.length;
  if (n === 0) {
    return { span: 0, startHour: -1, endHour: -1, largestGap: 0 };
  }
  const actives: number[] = [];
  for (let i = 0; i < n; i++) {
    if ((v[i] ?? 0) > 0) actives.push(i);
  }
  const k = actives.length;
  if (k === 0) {
    return { span: 0, startHour: -1, endHour: -1, largestGap: 0 };
  }
  if (k === n) {
    return { span: n, startHour: 0, endHour: n - 1, largestGap: 0 };
  }
  if (k === 1) {
    const h = actives[0]!;
    return { span: 1, startHour: h, endHour: h, largestGap: n - 1 };
  }

  // actives is sorted ascending. Compute gaps between consecutive
  // actives on the circle. The "gap" between actives[i] and
  // actives[i+1] is the count of *inactive* hours strictly between
  // them: actives[i+1] - actives[i] - 1. The wrap gap is
  // (n - actives[k-1] - 1) + actives[0].
  let largestGap = -1;
  let largestGapStartActive = 0; // index into `actives`: the active hour where the gap *starts*
  for (let i = 0; i < k - 1; i++) {
    const g = actives[i + 1]! - actives[i]! - 1;
    if (g > largestGap) {
      largestGap = g;
      largestGapStartActive = i;
    }
  }
  const wrapGap = n - actives[k - 1]! - 1 + actives[0]!;
  if (wrapGap > largestGap) {
    largestGap = wrapGap;
    largestGapStartActive = k - 1;
  }
  const span = n - largestGap;
  // The minimum-arc cover starts at the active hour *immediately after*
  // the largest gap (going clockwise on the circle).
  const startHour = actives[(largestGapStartActive + 1) % k]!;
  const endHour = (startHour + span - 1) % n;
  return { span, startHour, endHour, largestGap };
}

export function buildSourceActiveHourSpan(
  queue: QueueLine[],
  opts: SourceActiveHourSpanOptions = {},
): SourceActiveHourSpanReport {
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
  const maxSpan = opts.maxSpan ?? 0;
  if (!Number.isInteger(maxSpan) || maxSpan < 0 || maxSpan > 24) {
    throw new Error(
      `maxSpan must be an integer in [0, 24] (got ${opts.maxSpan})`,
    );
  }
  const sort: SourceActiveHourSpanSort = opts.sort ?? 'tokens';
  const validSorts: SourceActiveHourSpanSort[] = [
    'tokens',
    'span',
    'density',
    'active',
    'gap',
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
  const rows: SourceActiveHourSpanSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    let activeHours = 0;
    for (let h = 0; h < 24; h++) {
      if ((acc.mass[h] ?? 0) > 0) activeHours += 1;
    }
    const { span, startHour, endHour, largestGap } = circularMinimumArcCover(
      acc.mass,
    );
    const spanDensity = span > 0 ? activeHours / span : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nBuckets: acc.nBuckets,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hourMass: acc.mass.slice(),
      activeHours,
      circularSpan: span,
      spanStartHour: startHour,
      spanEndHour: endHour,
      largestQuietGap: largestGap,
      spanDensity,
    });
    totalTokensSum += acc.totalTokens;
  }

  // refinement filter (v0.6.47): max-span
  let droppedAboveMaxSpan = 0;
  let filtered = rows;
  if (maxSpan > 0) {
    const next: SourceActiveHourSpanSourceRow[] = [];
    for (const r of rows) {
      if (r.circularSpan <= maxSpan) next.push(r);
      else droppedAboveMaxSpan += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'span':
        primary = b.circularSpan - a.circularSpan;
        break;
      case 'density':
        primary = b.spanDensity - a.spanDensity;
        break;
      case 'active':
        primary = b.activeHours - a.activeHours;
        break;
      case 'gap':
        primary = b.largestQuietGap - a.largestQuietGap;
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
    maxSpan,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedAboveMaxSpan,
    droppedTopSources,
    sources: kept,
  };
}
