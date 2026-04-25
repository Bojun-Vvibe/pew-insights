/**
 * rolling-bucket-cv: per-source distribution of *rolling-window*
 * coefficient-of-variation (CV) of token-per-bucket.
 *
 * Why a fresh subcommand:
 *
 *   - `burstiness` collapses every active hour bucket of a source
 *     into ONE scalar `cv`. A source whose first 100 hours are
 *     pin-flat and whose last 5 hours are 100x spikes scores the
 *     same single `cv` as a source that is uniformly noisy across
 *     its tenure. The headline number is right; the *time
 *     evolution* of spikiness is invisible.
 *   - `bucket-intensity` is per-(source,hour) token mass with no
 *     dispersion structure at all.
 *   - `bucket-streak-length`, `inter-bucket-gap` family is about
 *     contiguity of activity, not magnitude variance within a
 *     local time window.
 *   - `tail-share` is a global concentration scalar (Pareto / Gini)
 *     that ignores time order.
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per `hour_start` bucket: tokens summed over all
 *      device/model rows in that UTC hour. Buckets with non-positive
 *      tokens are dropped.
 *   2. Sort buckets ascending by `hour_start`.
 *   3. Slide a fixed-width window of `windowSize` *consecutive
 *      active buckets* (default 12). The window is on the source's
 *      own active-bucket sequence, not on the wall clock — a source
 *      with a 24h gap still slides cleanly across that gap because
 *      we index into the active-bucket array, not a uniform time
 *      grid. This is the right call for a CV-of-spikiness metric:
 *      we want "what does a chunk of N consecutive observations of
 *      this source look like" rather than "how spiky is each calendar
 *      day", which `weekday-share` and `time-of-day` already
 *      provide.
 *   4. For each window: compute population mean and stddev (ddof=0,
 *      consistent with `burstiness`) and CV = stddev / mean. Empty
 *      windows or windows with mean = 0 contribute CV = 0 (matches
 *      `burstiness` semantics).
 *   5. Aggregate per-source over the resulting CV sequence: the
 *      window count, min, p50, p90, max, mean CV, and the ISO
 *      `hour_start` of the *peak window*'s first bucket (the
 *      window that contained the highest local CV — i.e. "when
 *      did this source go through its spikiest stretch?"). For
 *      reproducibility ties on peak CV are broken by earlier
 *      window start.
 *   6. We also report the global (whole-source) CV as
 *      `globalCv` so the operator can directly compare "this
 *      source has a global CV of 1.4 but its rolling p90 CV is
 *      2.7 — the spikiness is concentrated in a few windows, not
 *      uniform across tenure".
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. All sorts have explicit secondary keys.
 *
 * Window-size knob:
 *
 *   - `windowSize` defaults to 12 active buckets ("half a day's
 *     worth of activity for a busy source", roughly).
 *   - `windowSize` must be >= 2 (a CV with n=1 is trivially 0).
 *   - Sources with fewer than `windowSize` active buckets produce
 *     0 windows and contribute to `droppedSparseSources`. They
 *     still appear in the global denominator counts.
 */
import type { QueueLine } from './types.js';

export interface RollingBucketCvOptions {
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
   * Width of the rolling window, measured in *consecutive active
   * buckets* of the source. Default 12. Must be an integer >= 2.
   */
  windowSize?: number;
  /**
   * Truncate `sources[]` to the top N by total tokens after all
   * other floors. Display filter only — global denominators
   * reflect the full population. Default 0 = no cap.
   */
  top?: number;
  /**
   * Drop source rows whose total active-bucket count is `< minBuckets`
   * from `sources[]`. Display filter only. Default 0.
   */
  minBuckets?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface RollingBucketCvSourceRow {
  source: string;
  /** Sum of total_tokens across all active buckets. */
  totalTokens: number;
  /** Distinct active hour buckets (positive token mass). */
  activeBuckets: number;
  /** Number of rolling windows produced (= max(activeBuckets - windowSize + 1, 0)). */
  windowCount: number;
  /**
   * Whole-source coefficient of variation across all active
   * buckets. Same definition `burstiness` uses for the source
   * scalar; included so the operator can read both at once.
   */
  globalCv: number;
  /** Min CV across windows. 0 when windowCount=0. */
  minCv: number;
  /** Median CV across windows. 0 when windowCount=0. */
  p50Cv: number;
  /** 90th percentile CV across windows (nearest-rank R-1). */
  p90Cv: number;
  /** Max CV across windows. */
  maxCv: number;
  /** Arithmetic mean of CVs across windows. */
  meanCv: number;
  /**
   * ISO `hour_start` of the first bucket of the window that
   * achieved `maxCv`. null when windowCount = 0. Ties broken by
   * earlier window start.
   */
  peakWindowStart: string | null;
}

export interface RollingBucketCvReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved windowSize. */
  windowSize: number;
  /** Echo of resolved top cap (0 = no cap). */
  top: number;
  /** Echo of resolved minBuckets floor. */
  minBuckets: number;
  /** Echo of source filter (null when not set). */
  source: string | null;
  /** Sum of total_tokens across all kept rows. */
  totalTokens: number;
  /** Distinct sources seen (before display filters). */
  totalSources: number;
  /** Sum of windowCount across all kept sources. */
  totalWindows: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Sources that produced 0 windows because activeBuckets < windowSize. */
  droppedSparseSources: number;
  /** Source rows hidden by the minBuckets floor. */
  droppedMinBuckets: number;
  /** Source rows hidden by the `top` cap (counted after floors). */
  droppedTopSources: number;
  /** One row per kept source. Sorted by totalTokens desc, then source asc. */
  sources: RollingBucketCvSourceRow[];
}

function popMean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function popStddev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - mean;
    s += d * d;
  }
  return Math.sqrt(s / values.length);
}

/**
 * Nearest-rank R-1 percentile on an already-sorted ascending array.
 * Matches the `bucket-intensity` / `cost-per-bucket-percentiles`
 * convention so numbers reconcile across reports.
 */
function nearestRank(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  // R-1 (Hyndman-Fan): ceil(q * n) - 1, clamped to [0, n-1].
  const k = Math.max(0, Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1));
  return sorted[k]!;
}

export function buildRollingBucketCv(
  queue: QueueLine[],
  opts: RollingBucketCvOptions = {},
): RollingBucketCvReport {
  const windowSize = opts.windowSize ?? 12;
  if (!Number.isInteger(windowSize) || windowSize < 2) {
    throw new Error(`windowSize must be an integer >= 2 (got ${opts.windowSize})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(`minBuckets must be a non-negative integer (got ${opts.minBuckets})`);
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

  // source -> hour_start -> tokens
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

    let hours = agg.get(src);
    if (!hours) {
      hours = new Map<string, number>();
      agg.set(src, hours);
    }
    hours.set(q.hour_start, (hours.get(q.hour_start) ?? 0) + tt);
  }

  const totalSources = agg.size;
  const rows: RollingBucketCvSourceRow[] = [];
  let droppedSparseSources = 0;
  let droppedMinBuckets = 0;
  let totalTokens = 0;
  let totalWindows = 0;

  for (const [src, hours] of agg) {
    const sortedKeys = Array.from(hours.keys()).sort();
    const series = sortedKeys.map((k) => hours.get(k)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const activeBuckets = series.length;
    if (activeBuckets < minBuckets) {
      droppedMinBuckets += 1;
      continue;
    }
    const globalMean = popMean(series);
    const globalStddev = popStddev(series, globalMean);
    const globalCv = globalMean > 0 ? globalStddev / globalMean : 0;

    const cvs: number[] = [];
    let peakIdx = -1;
    let peakCv = -Infinity;
    if (activeBuckets >= windowSize) {
      for (let i = 0; i + windowSize <= activeBuckets; i++) {
        const slice = series.slice(i, i + windowSize);
        const mu = popMean(slice);
        const sd = popStddev(slice, mu);
        const cv = mu > 0 ? sd / mu : 0;
        cvs.push(cv);
        if (cv > peakCv) {
          peakCv = cv;
          peakIdx = i;
        }
      }
    }

    if (cvs.length === 0) {
      droppedSparseSources += 1;
      // Skip from sources[] but still count globally so totals tally.
      continue;
    }

    totalWindows += cvs.length;
    const sorted = cvs.slice().sort((a, b) => a - b);
    rows.push({
      source: src,
      totalTokens: sourceTotal,
      activeBuckets,
      windowCount: cvs.length,
      globalCv,
      minCv: sorted[0]!,
      p50Cv: nearestRank(sorted, 0.5),
      p90Cv: nearestRank(sorted, 0.9),
      maxCv: sorted[sorted.length - 1]!,
      meanCv: popMean(cvs),
      peakWindowStart: peakIdx >= 0 ? sortedKeys[peakIdx]! : null,
    });
  }

  rows.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
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
    windowSize,
    top,
    minBuckets,
    source: sourceFilter,
    totalTokens,
    totalSources,
    totalWindows,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedMinBuckets,
    droppedTopSources,
    sources: kept,
  };
}
