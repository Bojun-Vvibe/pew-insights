/**
 * daily-token-zscore-extremes: per-source count of daily total-token
 * values whose population z-score is **beyond ±sigma** from the
 * source's own mean. Tail-event statistic that is orthogonal to
 * everything currently shipped:
 *
 *   - `burstiness` and `rolling-bucket-cv` are *aggregate dispersion*
 *     numbers; they collapse the entire shape into one CV. This
 *     subcommand counts *how many* individual days actually breach
 *     a fixed sigma multiple, separately above and below the mean.
 *   - `daily-token-autocorrelation-lag1` is a serial-dependence
 *     statistic; it does not say whether any day is itself extreme.
 *   - `daily-token-monotone-run-length` is a trajectory-shape
 *     statistic about *direction persistence*; an extreme one-day
 *     spike contributes only a single up step and a single down
 *     step there.
 *   - `bucket-token-gini`, `hour-of-day-token-skew` operate on
 *     within-day or hour-of-day distributions, not on the full
 *     active-day series of a source.
 *   - `anomalies` uses different / coarser thresholds and is not
 *     a per-source z-score tally.
 *
 * Headline question this answers:
 * **"Out of this source's active-day series, how many days were
 * unusually heavy (z > +sigma) or unusually light (z < -sigma),
 * and what is the single most extreme |z|?"**
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`):
 *      tokens summed across all device/model rows. Days with
 *      non-positive tokens are dropped (consistent with the
 *      `total_tokens > 0` floor used by `rolling-bucket-cv`).
 *   2. The active-day series is the resulting positive-token
 *      values. We compute its population mean and population
 *      stddev (1/n divisor, matching `rolling-bucket-cv` and
 *      `daily-token-autocorrelation-lag1`).
 *   3. Per-day z = (x - mean) / stddev. When stddev == 0 (a
 *      perfectly flat active-day series) z is undefined; we
 *      report it as 0 with a `flat: true` flag and zero counts.
 *   4. Counts:
 *      - `nHighExtreme`: count of days with z >  +sigma
 *      - `nLowExtreme` : count of days with z <  -sigma
 *      - `nExtreme`    : sum of the two (sigma is strict — an
 *                       observation exactly at +sigma or -sigma
 *                       does NOT count as extreme).
 *      - `extremeFraction` = nExtreme / nActiveDays.
 *      - `maxAbsZ`: max |z| across the active-day series; 0 when
 *        flat.
 *      - `maxAbsZDay`: ISO YYYY-MM-DD of the day that produced
 *        `maxAbsZ`. Ties break by ISO ascending. Empty string
 *        when flat.
 *      - `maxAbsZTokens`: token total on `maxAbsZDay`.
 *      - `maxAbsZDirection`: 'high' (z > 0), 'low' (z < 0), or
 *        'flat' when the series is flat.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * All sorts have explicit secondary keys.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source (others surface as
 *     `droppedSourceFilter`).
 *   - `minDays` (default 3): structural floor; need at least 3
 *     active days for a stddev-based z-score to be meaningful.
 *     Sparse sources surface as `droppedSparseSources`. Must be >= 2.
 *   - `sigma` (default 2): strict z-score threshold. Must be > 0.
 *   - `top` (default 0 = no cap): display cap on `sources[]` after
 *     sort. Suppressed surface as `droppedTopSources`.
 *   - `sort`: `'tokens'` (default) | `'extreme'` (count desc) |
 *     `'fraction'` (extremeFraction desc) | `'maxabsz'` |
 *     `'ndays'` | `'source'`.
 */
import type { QueueLine } from './types.js';

export type ZscoreDirection = 'high' | 'low' | 'flat';

export interface DailyTokenZscoreExtremesOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict analysis to a single source. null = no filter. */
  source?: string | null;
  /** Minimum active calendar days for the source's row to be reported. Must be >= 2. Default 3. */
  minDays?: number;
  /** Strict z-score threshold (must be > 0). Default 2. */
  sigma?: number;
  /** Truncate `sources[]` to top N after sort. Default 0 = no cap. */
  top?: number;
  /** Sort key. */
  sort?: 'tokens' | 'extreme' | 'fraction' | 'maxabsz' | 'ndays' | 'source';
  /**
   * Display filter: hide sources whose `nExtreme` is strictly below
   * this value. `totalSources` and `totalTokens` still reflect the
   * full kept population. Suppressed rows surface as
   * `droppedBelowMinExtreme`. Default 0 = no floor.
   */
  minExtreme?: number;
  /**
   * Display filter: when set to `'high'` only sources with at least
   * one high-extreme day are kept; `'low'` only sources with at least
   * one low-extreme day; `'either'` keeps any source with any
   * extreme. Suppressed rows surface as `droppedByDirection`.
   * Default `null` = no direction gate (all sources kept).
   */
  direction?: 'high' | 'low' | 'either' | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenZscoreExtremesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  mean: number;
  stddev: number;
  /** True iff stddev == 0 (constant active-day series); z undefined. */
  flat: boolean;
  /** Count of days with z > +sigma. */
  nHighExtreme: number;
  /** Count of days with z < -sigma. */
  nLowExtreme: number;
  /** nHighExtreme + nLowExtreme. */
  nExtreme: number;
  /** nExtreme / nActiveDays. 0 when flat. */
  extremeFraction: number;
  /** max |z| across active days. 0 when flat. */
  maxAbsZ: number;
  /** ISO YYYY-MM-DD of the day producing maxAbsZ. '' when flat. */
  maxAbsZDay: string;
  /** Token total on maxAbsZDay. 0 when flat. */
  maxAbsZTokens: number;
  /** 'high' | 'low' | 'flat'. */
  maxAbsZDirection: ZscoreDirection;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenZscoreExtremesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  sigma: number;
  top: number;
  sort: 'tokens' | 'extreme' | 'fraction' | 'maxabsz' | 'ndays' | 'source';
  source: string | null;
  minExtreme: number;
  direction: 'high' | 'low' | 'either' | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinExtreme: number;
  droppedByDirection: number;
  droppedTopSources: number;
  sources: DailyTokenZscoreExtremesSourceRow[];
}

function popMean(values: number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function popStddev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - mean;
    s += d * d;
  }
  return Math.sqrt(s / values.length);
}

export function buildDailyTokenZscoreExtremes(
  queue: QueueLine[],
  opts: DailyTokenZscoreExtremesOptions = {},
): DailyTokenZscoreExtremesReport {
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(`minDays must be an integer >= 2 (got ${opts.minDays})`);
  }
  const sigma = opts.sigma ?? 2;
  if (typeof sigma !== 'number' || !Number.isFinite(sigma) || sigma <= 0) {
    throw new Error(`sigma must be a positive finite number (got ${opts.sigma})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  const validSorts = ['tokens', 'extreme', 'fraction', 'maxabsz', 'ndays', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
  }
  const minExtreme = opts.minExtreme ?? 0;
  if (!Number.isInteger(minExtreme) || minExtreme < 0) {
    throw new Error(`minExtreme must be a non-negative integer (got ${opts.minExtreme})`);
  }
  const direction = opts.direction ?? null;
  if (direction !== null && !['high', 'low', 'either'].includes(direction)) {
    throw new Error(`direction must be one of high|low|either when set (got ${direction})`);
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
  const rows: DailyTokenZscoreExtremesSourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((k) => days.get(k)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const n = series.length;
    if (n < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const mean = popMean(series);
    const stddev = popStddev(series, mean);
    const flat = stddev === 0;

    let nHigh = 0;
    let nLow = 0;
    let maxAbsZ = 0;
    let maxAbsZIdx = -1;
    let maxAbsZSigned = 0;

    if (!flat) {
      for (let i = 0; i < n; i++) {
        const z = (series[i]! - mean) / stddev;
        if (z > sigma) nHigh += 1;
        else if (z < -sigma) nLow += 1;
        const az = Math.abs(z);
        if (az > maxAbsZ || (az === maxAbsZ && maxAbsZIdx === -1)) {
          maxAbsZ = az;
          maxAbsZIdx = i;
          maxAbsZSigned = z;
        }
      }
    }

    const nExtreme = nHigh + nLow;
    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: n,
      mean,
      stddev,
      flat,
      nHighExtreme: nHigh,
      nLowExtreme: nLow,
      nExtreme,
      extremeFraction: n > 0 ? nExtreme / n : 0,
      maxAbsZ,
      maxAbsZDay: flat ? '' : sortedKeys[maxAbsZIdx]!,
      maxAbsZTokens: flat ? 0 : series[maxAbsZIdx]!,
      maxAbsZDirection: flat ? 'flat' : maxAbsZSigned >= 0 ? 'high' : 'low',
      firstActiveDay: sortedKeys[0]!,
      lastActiveDay: sortedKeys[sortedKeys.length - 1]!,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'extreme':
        primary = b.nExtreme - a.nExtreme;
        break;
      case 'fraction':
        primary = b.extremeFraction - a.extremeFraction;
        break;
      case 'maxabsz':
        primary = b.maxAbsZ - a.maxAbsZ;
        break;
      case 'ndays':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'source':
        primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
        return primary;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  // Display filters: minExtreme and direction. Applied AFTER sort so
  // they don't reshuffle the kept order, and BEFORE the top cap so
  // the cap operates on the post-filter population.
  let droppedBelowMinExtreme = 0;
  let droppedByDirection = 0;
  const filtered: DailyTokenZscoreExtremesSourceRow[] = [];
  for (const row of rows) {
    if (row.nExtreme < minExtreme) {
      droppedBelowMinExtreme += 1;
      continue;
    }
    if (direction !== null) {
      const passes =
        direction === 'high'
          ? row.nHighExtreme > 0
          : direction === 'low'
            ? row.nLowExtreme > 0
            : row.nExtreme > 0;
      if (!passes) {
        droppedByDirection += 1;
        continue;
      }
    }
    filtered.push(row);
  }

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
    minDays,
    sigma,
    top,
    sort,
    source: sourceFilter,
    minExtreme,
    direction,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinExtreme,
    droppedByDirection,
    droppedTopSources,
    sources: kept,
  };
}
