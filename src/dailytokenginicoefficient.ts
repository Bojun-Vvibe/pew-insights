/**
 * daily-token-gini-coefficient: per-source Gini coefficient of the
 * *per-day* total_tokens distribution.
 *
 * For each source we collapse all hourly buckets into a single
 * scalar per UTC day: D_d = sum_{rows on day d} total_tokens. The
 * resulting per-day vector D = (D_1, ..., D_n) is then summarized
 * by its Gini coefficient
 *
 *   G = ( sum_i sum_j |D_i - D_j| ) / ( 2 * n * sum_i D_i )
 *
 * computed in O(n log n) via the standard sorted form
 *
 *   G = ( 2 * sum_i i * D_(i)  -  (n + 1) * S ) / ( n * S )
 *
 * where D_(i) is the i-th order statistic (1-indexed, ascending)
 * and S = sum_i D_(i). For n >= 2 and S > 0 the result lies in
 * [0, (n - 1) / n]; we report G directly without the (n / (n - 1))
 * small-sample correction so the value is comparable across
 * sources with different `n` and matches the closed-form bound.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `bucket-token-gini` computes Gini *across hourly buckets*
 *     within a single window. This subcommand collapses to *days*
 *     first and then computes Gini *per source* across that
 *     day-vector. A source whose hourly mass is wildly uneven but
 *     whose daily totals are flat will show high bucket-Gini and
 *     low daily-Gini — they answer different questions.
 *   - `source-active-day-streak`, `source-dry-spell`,
 *     `source-active-day-breadth-per-day` all measure presence /
 *     absence on the day axis. None of them measures concentration
 *     of *mass* over the days a source is actually active.
 *   - `daily-token-zscore-extremes`, `daily-token-monotone-run-length`,
 *     `daily-token-second-difference-sign-runs`,
 *     `daily-token-autocorrelation-lag1` all read the daily
 *     time-series in *order* (z-scores, monotone runs, sign of
 *     second differences, lag-1 autocorrelation). The Gini
 *     coefficient is order-invariant — a permutation of the day
 *     vector has the same Gini — so it is orthogonal to all of
 *     those.
 *   - `cumulative-tokens-midpoint` reports the day on which 50% of
 *     cumulative mass is reached (a CDF quantile). Gini integrates
 *     over the whole Lorenz curve, not a single quantile.
 *
 * Headline question:
 * **"For each source, how unequal is its day-by-day token spend?
 *   Is the source dominated by a handful of mega-days, or is its
 *   token mass roughly uniform across the days it is active?"**
 *
 * Practical reading:
 *
 *   - G near 0: token mass is roughly uniform across active days.
 *   - G near (n-1)/n: a single day carries virtually all the mass.
 *   - Two sources with identical totalTokens and identical nDays
 *     but different G are temporally very different beasts.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor; surfaces as `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'gini'): 'gini' | 'tokens' | 'days' | 'source'.
 *   - All days are read off the UTC date prefix (yyyy-mm-dd) of
 *     `hour_start`, matching every other daily statistic in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type DailyTokenGiniSort = 'gini' | 'tokens' | 'days' | 'source';

export interface DailyTokenGiniOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Minimum total token mass required for a source to be reported.
   * Must be a non-negative finite number; default 1000.
   */
  minTokens?: number;
  /**
   * Minimum number of distinct UTC days required for a source to
   * be reported. Gini on n=1 is 0 by definition and not
   * interesting; default 2. Refinement filter (v0.6.36+).
   */
  minDays?: number;
  top?: number;
  sort?: DailyTokenGiniSort;
  generatedAt?: string;
}

export interface DailyTokenGiniSourceRow {
  source: string;
  /** Sum of total_tokens contributing across all retained days. */
  totalTokens: number;
  /** Number of distinct UTC days with positive token mass. */
  nDays: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /**
   * Gini coefficient of the per-day total_tokens vector. In
   * [0, (nDays - 1) / nDays]. NaN when nDays < 1 or sum = 0
   * (those rows are dropped before reporting, so the value here
   * is always finite).
   */
  gini: number;
  /** Mean per-day total_tokens (totalTokens / nDays). */
  meanDailyTokens: number;
  /** Largest single-day total_tokens (the mass-dominant day). */
  maxDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the largest single-day total. */
  maxDay: string;
  /**
   * Share of totalTokens contributed by the single largest day.
   * In [1/nDays, 1]. A useful sanity check on Gini: if maxShare
   * is near 1 then Gini must be near (nDays - 1) / nDays.
   */
  maxDayShare: number;
}

export interface DailyTokenGiniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGiniSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedTopSources: number;
  sources: DailyTokenGiniSourceRow[];
}

/**
 * Gini coefficient of a non-negative numeric vector via the sorted
 * form. Returns 0 for n=0 or n=1 or sum=0. Result is in
 * [0, (n - 1) / n].
 */
export function giniOfVector(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`giniOfVector requires non-negative finite values (got ${v})`);
    }
    sum += v;
  }
  if (sum <= 0) return 0;
  if (n === 1) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    // 1-indexed in the textbook formula
    weighted += (i + 1) * sorted[i]!;
  }
  return (2 * weighted - (n + 1) * sum) / (n * sum);
}

export function buildDailyTokenGini(
  queue: QueueLine[],
  opts: DailyTokenGiniOptions = {},
): DailyTokenGiniReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(
      `minDays must be a positive integer (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenGiniSort = opts.sort ?? 'gini';
  const validSorts: DailyTokenGiniSort[] = ['gini', 'tokens', 'days', 'source'];
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
  const rows: DailyTokenGiniSourceRow[] = [];

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
    const values: number[] = [];
    let maxDailyTokens = -1;
    let maxDay = acc.firstDay;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
    }
    const gini = giniOfVector(values);
    const meanDailyTokens = acc.totalTokens / nDays;
    const maxDayShare = acc.totalTokens > 0 ? maxDailyTokens / acc.totalTokens : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      gini,
      meanDailyTokens,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      maxDayShare,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'gini':
      default:
        primary = b.gini - a.gini;
        break;
    }
    if (primary !== 0) return primary;
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
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedTopSources,
    sources: kept,
  };
}
