/**
 * source-token-mass-hour-centroid: per-source token-mass-weighted
 * circular centroid on the 24-hour clock.
 *
 * Hour-of-day is intrinsically *circular*: hour 23 and hour 0 are
 * adjacent, not 23 units apart. A naive arithmetic mean of integer
 * hours (or even fractional hours) is therefore meaningless for any
 * source whose activity straddles midnight — a user working from
 * 22:00 to 02:00 has a "true" centroid near midnight (24/0), but
 * naive mean would put them around noon.
 *
 * For each source we treat each hourly bucket as a point on the
 * unit circle at angle theta_h = 2*pi * h / 24 (h in 0..23) carrying
 * mass m_h = total_tokens contributed by that source at that hour.
 * The weighted circular mean is
 *
 *   x_bar = sum_h m_h * cos(theta_h) / M
 *   y_bar = sum_h m_h * sin(theta_h) / M
 *   theta_bar = atan2(y_bar, x_bar)        // (-pi, pi]
 *   centroidHour = ((theta_bar / (2*pi)) * 24 + 24) mod 24    // [0,24)
 *
 * where M = sum_h m_h. We also compute the resultant length
 *
 *   R = sqrt(x_bar^2 + y_bar^2)            // [0, 1]
 *
 * which is the canonical concentration measure on the circle:
 *
 *   - R = 1: all token mass at a single hour-of-day
 *   - R = 0: token mass perfectly spread around the clock
 *
 * The circular variance is V = 1 - R, and the circular standard
 * deviation in radians is sqrt(-2 * ln(R)) (Mardia/Jupp). We expose
 * both R and the circular SD converted to *hours* via the same
 * 24/(2*pi) scaling, so the "spread" column is in directly
 * comparable units to the centroid column.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `peak-hour`, `time-of-day`, `hour-of-week`, `weekday-share`,
 *     `weekend-vs-weekday`, `first-bucket-of-day`, `last-bucket-of-day`,
 *     `active-span-per-day` are all *non-circular*: they pick a
 *     single bucket (mode), report a histogram, or measure a span
 *     in linear time. None of them computes a mass-weighted
 *     circular centroid.
 *   - `bucket-token-gini`, `model-mix-entropy`,
 *     `hour-of-day-source-mix-entropy`, `bucket-density-percentile`
 *     are concentration measures across categories or value bins
 *     but not on the circle.
 *   - `interarrival-time` measures gaps between events in linear
 *     time, not their phase on the day clock.
 *   - The Benford / decile / autocorrelation / monotone-run /
 *     d2-sign-runs family are all on the *value* axis or its
 *     order, never on phase.
 *
 * Headline question:
 * **"Where on the 24-hour clock does each source's token mass
 *   actually concentrate, and how tight is that concentration?"**
 *
 * Practical reading:
 *
 *   - Two sources with identical centroidHour = 14.5 but R = 0.95
 *     vs R = 0.20 are radically different: the first is a sharp
 *     "always at 14:30" worker, the second has mass smeared all
 *     across the day with only a faint pull toward 14:30.
 *   - A source whose centroid lands near 0 with high R is a
 *     "graveyard shift" source — the circular geometry is the only
 *     reliable way to surface that pattern; linear means hide it.
 *   - Comparing centroids across sources answers the temporal
 *     equivalent of "who works when": the clockwise distance
 *     between two centroids on a 24-hour circle is the natural
 *     phase offset between two sources' workloads.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): structural floor; need at least
 *     this much total token mass for the centroid to be meaningful.
 *     Sparse sources surface as `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'centroid' | 'r' |
 *     'spread' | 'source'.
 *   - `tz` is intentionally NOT a knob: hour-of-day is read directly
 *     from the UTC timestamp in `hour_start`. Every other
 *     hour-of-day statistic in this codebase reads UTC as well, so
 *     the centroid is comparable.
 */
import type { QueueLine } from './types.js';

export type SourceTokenMassHourCentroidSort =
  | 'tokens'
  | 'centroid'
  | 'r'
  | 'spread'
  | 'source';

export interface SourceTokenMassHourCentroidOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Minimum total token mass required for a source to be reported.
   * Must be a non-negative finite number; default 1000.
   */
  minTokens?: number;
  top?: number;
  sort?: SourceTokenMassHourCentroidSort;
  generatedAt?: string;
}

export interface SourceTokenMassHourCentroidSourceRow {
  source: string;
  /** Sum of total_tokens contributing to the centroid. */
  totalTokens: number;
  /** Number of hourly buckets contributing positive mass. */
  nBuckets: number;
  /** Number of distinct UTC days seen. */
  nDays: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Token-mass-weighted circular mean hour in [0, 24). */
  centroidHour: number;
  /** Resultant length R in [0, 1]. R=1 means all mass at one hour. */
  resultantLength: number;
  /** Circular SD expressed in hours. Infinity when R=0. */
  spreadHours: number;
  /** Hour-of-day with the largest total_tokens mass for this source. */
  peakHour: number;
  /** Token mass at peakHour. */
  peakHourTokens: number;
}

export interface SourceTokenMassHourCentroidReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceTokenMassHourCentroidSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: SourceTokenMassHourCentroidSourceRow[];
}

const TWO_PI = 2 * Math.PI;
const HOUR_TO_RAD = TWO_PI / 24;
const RAD_TO_HOUR = 24 / TWO_PI;

/**
 * Convert a circular angle in radians to an hour in [0, 24).
 * Negative angles wrap forward.
 */
export function angleToHour(theta: number): number {
  let h = theta * RAD_TO_HOUR;
  // wrap into [0, 24)
  h = ((h % 24) + 24) % 24;
  // floating slop near 24 -> 0
  if (h >= 24) h -= 24;
  return h;
}

/**
 * Token-mass-weighted circular mean of a hour-of-day distribution.
 *
 * `mass[h]` is total token mass at hour h (h in 0..23). Returns
 * the centroid hour in [0, 24) and the resultant length R in [0,1].
 * If total mass is 0, returns { centroidHour: 0, resultantLength: 0 }.
 */
export function circularHourCentroid(mass: number[]): {
  centroidHour: number;
  resultantLength: number;
} {
  if (mass.length !== 24) {
    throw new Error(`mass must have length 24 (got ${mass.length})`);
  }
  let x = 0;
  let y = 0;
  let M = 0;
  for (let h = 0; h < 24; h++) {
    const m = mass[h]!;
    if (!Number.isFinite(m) || m <= 0) continue;
    const theta = h * HOUR_TO_RAD;
    x += m * Math.cos(theta);
    y += m * Math.sin(theta);
    M += m;
  }
  if (M <= 0) return { centroidHour: 0, resultantLength: 0 };
  const xBar = x / M;
  const yBar = y / M;
  const R = Math.sqrt(xBar * xBar + yBar * yBar);
  // atan2 returns (-pi, pi]; angleToHour wraps into [0,24).
  const theta = Math.atan2(yBar, xBar);
  return { centroidHour: angleToHour(theta), resultantLength: Math.min(R, 1) };
}

/**
 * Mardia/Jupp circular standard deviation expressed in hours.
 * R=1 -> 0 hours. R=0 -> Infinity.
 */
export function circularSpreadHours(R: number): number {
  if (!Number.isFinite(R) || R <= 0) return Infinity;
  if (R >= 1) return 0;
  const sdRad = Math.sqrt(-2 * Math.log(R));
  return sdRad * RAD_TO_HOUR;
}

export function buildSourceTokenMassHourCentroid(
  queue: QueueLine[],
  opts: SourceTokenMassHourCentroidOptions = {},
): SourceTokenMassHourCentroidReport {
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
  const sort: SourceTokenMassHourCentroidSort = opts.sort ?? 'tokens';
  const validSorts: SourceTokenMassHourCentroidSort[] = [
    'tokens',
    'centroid',
    'r',
    'spread',
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
    days: Set<string>;
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
    // hour_start is ISO-8601; read UTC hour from char positions 11..13.
    // Fallback to Date getUTCHours if parsing the substring fails.
    const hStr = q.hour_start.slice(11, 13);
    let h = Number.parseInt(hStr, 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      h = new Date(ms).getUTCHours();
    }
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        mass: new Array(24).fill(0),
        days: new Set<string>(),
        nBuckets: 0,
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    if (acc.mass[h] === 0) acc.nBuckets += 1;
    acc.mass[h] = (acc.mass[h] ?? 0) + tt;
    acc.totalTokens += tt;
    acc.days.add(day);
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokensSum = 0;
  const rows: SourceTokenMassHourCentroidSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const { centroidHour, resultantLength } = circularHourCentroid(acc.mass);
    const spreadHours = circularSpreadHours(resultantLength);
    let peakHour = 0;
    let peakHourTokens = -1;
    for (let h = 0; h < 24; h++) {
      const m = acc.mass[h]!;
      if (m > peakHourTokens) {
        peakHourTokens = m;
        peakHour = h;
      }
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nBuckets: acc.nBuckets,
      nDays: acc.days.size,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      centroidHour,
      resultantLength,
      spreadHours,
      peakHour,
      peakHourTokens: Math.max(0, peakHourTokens),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'centroid':
        primary = a.centroidHour - b.centroidHour;
        break;
      case 'r':
        primary = b.resultantLength - a.resultantLength;
        break;
      case 'spread':
        // Infinity sorts last (largest spread = least concentrated).
        primary = b.spreadHours - a.spreadHours;
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
    if (primary === Infinity) return 1;
    if (primary === -Infinity) return -1;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
