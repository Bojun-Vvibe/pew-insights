/**
 * interarrival-time: per-source distribution of gaps (in hours)
 * between *consecutive distinct UTC hour buckets* with positive
 * token mass.
 *
 * Why a separate subcommand:
 *
 *   - `idle-gaps` works on `SessionLine` and measures gaps between
 *     consecutive *messages* inside one session (per session_key,
 *     in seconds). It cannot answer "how long does the codex
 *     producer go dark between active wall-clock hours globally".
 *   - `burstiness` measures intra-window concentration (Gini /
 *     coefficient of variation on per-bucket token mass). It says
 *     nothing about *spacing* — a perfectly-flat sequence and a
 *     sequence with one giant 24h gap can have similar burstiness.
 *   - `time-of-day` and `peak-hour-share` are population stats over
 *     the hour-of-day modulus; they ignore the raw gap between
 *     consecutive activity.
 *
 * Concretely, for each source:
 *   1. Collect the set of distinct `hour_start` values where the
 *      source had token mass > 0 within the window.
 *   2. Sort ascending; for each adjacent pair (t_i, t_{i+1}) emit
 *      a gap (t_{i+1} - t_i) in hours (a positive integer ≥ 1).
 *   3. Aggregate per-source statistics: count, min, p50, p90,
 *      max, mean, sum, and a histogram over fixed edges.
 *
 * The histogram edges (in hours) are:
 *   1, 2, 3, 6, 12, 24, 48, 168, +Inf
 * meaning buckets [1,2), [2,3), [3,6), [6,12), [12,24), [24,48),
 * [48,168), [168,+Inf). 168 = one week. A gap of exactly 1h is the
 * minimum observable (consecutive distinct UTC hours).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Source ordering on output: total active buckets desc, then source
 * asc.
 */
import type { QueueLine } from './types.js';

export interface InterarrivalTimeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * If non-null, restrict the analysis to a single source. All
   * non-matching rows surface as `droppedSourceFilter`. Default null.
   */
  source?: string | null;
  /**
   * Truncate `sources[]` to the top N by activeBuckets desc. Display
   * filter only — `totalSources` reflects the full population.
   * Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `sources[]`. Default 'buckets' (activeBuckets desc).
   * 'gaps' = gapCount desc. 'p90' = p90 desc.
   */
  sort?: 'buckets' | 'gaps' | 'p90';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface InterarrivalTimeBucket {
  /** Inclusive lower edge in hours. */
  loHours: number;
  /** Exclusive upper edge in hours, or +Infinity for the last bucket. */
  hiHours: number;
  /** Number of gaps falling into [loHours, hiHours). */
  count: number;
}

export interface InterarrivalTimeSourceRow {
  source: string;
  /** Distinct hour_start values for this source after filtering. */
  activeBuckets: number;
  /**
   * Number of consecutive-bucket gaps emitted. Always
   * max(0, activeBuckets - 1).
   */
  gapCount: number;
  /** Min observed gap in hours, or 0 if gapCount == 0. */
  minHours: number;
  /** Max observed gap in hours, or 0 if gapCount == 0. */
  maxHours: number;
  /** Sum of all gaps in hours (== span between first and last bucket). */
  sumHours: number;
  /** Arithmetic mean gap in hours. 0 if gapCount == 0. */
  meanHours: number;
  /** Median (p50) gap in hours via nearest-rank. 0 if gapCount == 0. */
  p50Hours: number;
  /** 90th-percentile gap in hours via nearest-rank. 0 if gapCount == 0. */
  p90Hours: number;
  /** Histogram over the global edges. */
  histogram: InterarrivalTimeBucket[];
}

export interface InterarrivalTimeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  top: number;
  sort: 'buckets' | 'gaps' | 'p90';
  /** Total distinct sources observed across kept rows. */
  totalSources: number;
  /** Sum of activeBuckets across kept sources. */
  totalActiveBuckets: number;
  /** Sum of gapCount across kept sources. */
  totalGaps: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** Edges used for every per-source histogram, in hours. */
  histogramEdgesHours: number[];
  /** Per-source rows. */
  sources: InterarrivalTimeSourceRow[];
}

/** Histogram edges in hours: bucket k covers [edges[k], edges[k+1]). */
export const DEFAULT_INTERARRIVAL_EDGES_HOURS: number[] = [
  1, 2, 3, 6, 12, 24, 48, 168, Number.POSITIVE_INFINITY,
];

const HOUR_MS = 3600 * 1000;

function nearestRank(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  // nearest-rank: rank = ceil(pct/100 * N), 1-indexed
  const rank = Math.max(1, Math.ceil((pct / 100) * sortedAsc.length));
  const idx = Math.min(sortedAsc.length - 1, rank - 1);
  return sortedAsc[idx] as number;
}

export function buildInterarrivalTime(
  queue: QueueLine[],
  opts: InterarrivalTimeOptions = {},
): InterarrivalTimeReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'buckets';
  if (sort !== 'buckets' && sort !== 'gaps' && sort !== 'p90') {
    throw new Error(`sort must be 'buckets' | 'gaps' | 'p90' (got ${opts.sort})`);
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

  // source -> Set<hour_start_ms>
  const perSourceBuckets = new Map<string, Set<number>>();
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

    let s = perSourceBuckets.get(src);
    if (!s) {
      s = new Set<number>();
      perSourceBuckets.set(src, s);
    }
    s.add(ms);
  }

  const edges = DEFAULT_INTERARRIVAL_EDGES_HOURS;
  const allRows: InterarrivalTimeSourceRow[] = [];
  let totalActiveBuckets = 0;
  let totalGaps = 0;

  for (const [src, set] of perSourceBuckets.entries()) {
    const tsAsc = Array.from(set).sort((a, b) => a - b);
    const active = tsAsc.length;
    totalActiveBuckets += active;
    const gaps: number[] = [];
    for (let i = 1; i < tsAsc.length; i++) {
      const gh = ((tsAsc[i] as number) - (tsAsc[i - 1] as number)) / HOUR_MS;
      // Round to handle DST-free integer-hour grid; pew uses UTC so this is exact.
      gaps.push(Math.round(gh));
    }
    totalGaps += gaps.length;

    const histogram: InterarrivalTimeBucket[] = [];
    for (let k = 0; k < edges.length - 1; k++) {
      histogram.push({
        loHours: edges[k] as number,
        hiHours: edges[k + 1] as number,
        count: 0,
      });
    }
    for (const g of gaps) {
      for (let k = 0; k < histogram.length; k++) {
        const b = histogram[k] as InterarrivalTimeBucket;
        if (g >= b.loHours && g < b.hiHours) {
          b.count += 1;
          break;
        }
      }
    }

    let minH = 0;
    let maxH = 0;
    let sumH = 0;
    let meanH = 0;
    let p50 = 0;
    let p90 = 0;
    if (gaps.length > 0) {
      const sortedAsc = gaps.slice().sort((a, b) => a - b);
      minH = sortedAsc[0] as number;
      maxH = sortedAsc[sortedAsc.length - 1] as number;
      for (const g of gaps) sumH += g;
      meanH = sumH / gaps.length;
      p50 = nearestRank(sortedAsc, 50);
      p90 = nearestRank(sortedAsc, 90);
    }

    allRows.push({
      source: src,
      activeBuckets: active,
      gapCount: gaps.length,
      minHours: minH,
      maxHours: maxH,
      sumHours: sumH,
      meanHours: meanH,
      p50Hours: p50,
      p90Hours: p90,
      histogram,
    });
  }

  // Sort.
  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'buckets') primary = b.activeBuckets - a.activeBuckets;
    else if (sort === 'gaps') primary = b.gapCount - a.gapCount;
    else primary = b.p90Hours - a.p90Hours;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  const totalSources = allRows.length;
  let droppedTopSources = 0;
  let kept = allRows;
  if (top > 0 && allRows.length > top) {
    droppedTopSources = allRows.length - top;
    kept = allRows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    top,
    sort,
    totalSources,
    totalActiveBuckets,
    totalGaps,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedTopSources,
    histogramEdgesHours: edges,
    sources: kept,
  };
}
