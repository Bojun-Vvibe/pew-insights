/**
 * source-burstiness-fano-factor: per-source Fano factor of
 * **daily total_tokens** over the source's active calendar days.
 *
 * The Fano factor is `F = variance / mean`. For a Poisson
 * counting process F = 1 exactly. F < 1 = sub-Poisson
 * (under-dispersed, steadier than coin-flip noise); F > 1 =
 * super-Poisson (over-dispersed, bursty / clustered). It is the
 * standard dimensional dispersion index for non-negative count
 * series — units are the same as the mean (tokens), so it is
 * directly comparable to "what does a one-sigma day look like
 * for this source?".
 *
 * For each source we:
 *
 *   1. Aggregate `total_tokens` per UTC calendar day.
 *   2. Take the source's **active**-day sequence (inactive days
 *      are NOT inserted as zeroes — same convention as every
 *      other `source-active-*` and `source-daily-*` builder in
 *      this repo).
 *   3. Compute mean, population variance (ddof=0), and
 *      `fanoFactor = variance / mean`. Also report the
 *      coefficient of variation `cv = stddev / mean` for
 *      cross-reference and `index_of_dispersion = fanoFactor`
 *      under its other common name (kept implicit; only the
 *      Fano column is exposed).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `burstiness` reports CV (= stddev / mean), NOT Fano (=
 *     variance / mean), and aggregates over *hourly* buckets,
 *     not per-source-active-day buckets. CV is unitless; Fano
 *     carries units of the mean and behaves very differently
 *     under rescaling — F = mean for a Poisson process, F = 0
 *     for a constant series, and F can scale with the mean for
 *     heavy-tailed series. Same headline word ("burstiness"),
 *     totally different statistic at a totally different grain.
 *   - `rolling-bucket-cv` reports a *distribution* of windowed
 *     CVs per source over hourly buckets — it is a sliding
 *     dispersion stat, not a single per-source dispersion
 *     index, and it never computes variance / mean.
 *   - `daily-token-z-score-extremes` flags outlier days via
 *     z-scores; it does not report dispersion as a scalar.
 *   - `daily-token-gini-coefficient` measures inequality of
 *     mass across days (Lorenz-curve area), not variance / mean.
 *     A perfectly bimodal series (zero, big, zero, big, ...) and
 *     a moderately noisy series can have very different Fano
 *     and very similar Gini, or vice versa.
 *   - `daily-token-monotone-run-length`,
 *     `daily-token-second-diff-sign-runs`, and
 *     `daily-token-autocorrelation-lag1` are *order*-structure
 *     stats; Fano is order-invariant.
 *   - `source-daily-token-trend-slope` fits a line; Fano does
 *     not care about a trend, only dispersion around the mean.
 *   - `source-active-hour-*`, `source-token-mass-hour-centroid`,
 *     `source-hour-of-day-*` all live on the hour-of-day axis,
 *     not the active-day axis.
 *
 * Headline question:
 *   **"For each source, how bursty is its day-to-day token
 *   usage relative to a Poisson baseline (variance == mean)?"**
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching
 *     surface as `droppedSourceFilter`.
 *   - `minActiveDays` (default 3): structural floor. Variance is
 *     defined for n>=2 but a 2-day variance is degenerate (a
 *     single difference squared); 3 is the smallest sample
 *     where Fano carries real information. Suppressed surface as
 *     `droppedBelowMinActiveDays`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'fano'): 'fano' | 'cv' | 'mean' |
 *     'variance' | 'days' | 'tokens' | 'source'. Null fano (a
 *     mean of 0, structurally impossible here since we drop
 *     non-positive token rows) sorts last on numeric keys.
 */
import type { QueueLine } from './types.js';

export type SourceBurstinessFanoFactorSort =
  | 'fano'
  | 'cv'
  | 'mean'
  | 'variance'
  | 'days'
  | 'tokens'
  | 'source';

export interface SourceBurstinessFanoFactorOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minActiveDays?: number;
  top?: number;
  sort?: SourceBurstinessFanoFactorSort;
  generatedAt?: string;
}

export interface SourceBurstinessFanoFactorSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  firstActiveDay: string; // YYYY-MM-DD
  lastActiveDay: string; // YYYY-MM-DD
  meanDailyTokens: number;
  /** population variance (ddof=0). */
  varianceDailyTokens: number;
  /** sqrt(variance). */
  stddevDailyTokens: number;
  /** Fano factor = variance / mean; null when mean == 0. */
  fanoFactor: number | null;
  /** Coefficient of variation = stddev / mean; null when mean == 0. */
  cv: number | null;
}

export interface SourceBurstinessFanoFactorReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minActiveDays: number;
  top: number;
  sort: SourceBurstinessFanoFactorSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinActiveDays: number;
  droppedTopSources: number;
  sources: SourceBurstinessFanoFactorSourceRow[];
}

/**
 * Returns the YYYY-MM-DD UTC calendar-day key for a finite epoch ms.
 */
export function utcDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildSourceBurstinessFanoFactor(
  queue: QueueLine[],
  opts: SourceBurstinessFanoFactorOptions = {},
): SourceBurstinessFanoFactorReport {
  const minActiveDays = opts.minActiveDays ?? 3;
  if (!Number.isInteger(minActiveDays) || minActiveDays < 2) {
    throw new Error(
      `minActiveDays must be an integer >= 2 (got ${opts.minActiveDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: SourceBurstinessFanoFactorSort = opts.sort ?? 'fano';
  const validSorts: SourceBurstinessFanoFactorSort[] = [
    'fano',
    'cv',
    'mean',
    'variance',
    'days',
    'tokens',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(
      `source must be a string when set (got ${typeof sourceFilter})`,
    );
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

  // src -> (dayKey -> total_tokens summed)
  const agg = new Map<string, Map<string, number>>();
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
    const key = utcDayKey(ms);
    let inner = agg.get(src);
    if (!inner) {
      inner = new Map<string, number>();
      agg.set(src, inner);
    }
    inner.set(key, (inner.get(key) ?? 0) + tt);
  }

  const totalSources = agg.size;
  let droppedBelowMinActiveDays = 0;
  let totalTokens = 0;
  const rows: SourceBurstinessFanoFactorSourceRow[] = [];

  for (const [src, byDay] of agg) {
    const days = Array.from(byDay.keys()).sort();
    const n = days.length;
    if (n < minActiveDays) {
      droppedBelowMinActiveDays += 1;
      continue;
    }
    const ys: number[] = days.map((d) => byDay.get(d) as number);
    const total = ys.reduce((a, b) => a + b, 0);
    const mean = total / n;
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const d = ys[i]! - mean;
      sse += d * d;
    }
    const variance = sse / n; // population (ddof=0)
    const stddev = Math.sqrt(variance);
    const fano = mean > 0 ? variance / mean : null;
    const cv = mean > 0 ? stddev / mean : null;

    rows.push({
      source: src,
      totalTokens: total,
      nActiveDays: n,
      firstActiveDay: days[0]!,
      lastActiveDay: days[n - 1]!,
      meanDailyTokens: mean,
      varianceDailyTokens: variance,
      stddevDailyTokens: stddev,
      fanoFactor: fano,
      cv,
    });
    totalTokens += total;
  }

  const cmpNullableDesc = (a: number | null, b: number | null): number => {
    const aNull = a === null;
    const bNull = b === null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return (b as number) - (a as number);
  };

  const cmpRow = (
    a: SourceBurstinessFanoFactorSourceRow,
    b: SourceBurstinessFanoFactorSourceRow,
  ): number => {
    let primary = 0;
    switch (sort) {
      case 'cv':
        primary = cmpNullableDesc(a.cv, b.cv);
        break;
      case 'mean':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'variance':
        primary = b.varianceDailyTokens - a.varianceDailyTokens;
        break;
      case 'days':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'source':
        primary = 0;
        break;
      case 'fano':
      default:
        primary = cmpNullableDesc(a.fanoFactor, b.fanoFactor);
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  };
  rows.sort(cmpRow);

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
    minActiveDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedBelowMinActiveDays,
    droppedTopSources,
    sources: kept,
  };
}
