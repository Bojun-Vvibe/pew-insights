/**
 * source-hour-of-day-topk-mass-share: per-source share of total
 * token mass concentrated in the K busiest hours-of-day (default
 * K = 3) on the 24-hour clock.
 *
 * For each source we collapse all hourly buckets in the window into
 * a length-24 vector
 *
 *   H_h = sum_{rows with hour-of-day = h} total_tokens     (h in 0..23)
 *
 * and report
 *
 *   share_K = ( sum of the K largest H_h ) / ( sum_h H_h ).
 *
 * Range [K / 24, 1]:
 *   - share_K = K / 24 iff the source's mass is *perfectly uniform*
 *     across all 24 hours-of-day.
 *   - share_K = 1 iff the source only ever produces tokens during
 *     <= K hours-of-day.
 *
 * For K = 3 the lower bound is 0.125; a source with share_3 = 0.5
 * concentrates half its lifetime token mass into just three clock
 * hours.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `peak-hour-share` answers "on each *day*, what share went
 *     to that day's busiest 1-hour window?" then aggregates the
 *     per-day shares per *model*. It is a *within-day* spikiness
 *     stat, not a *clock-hour* concentration stat: a source that
 *     always works 03:00-05:00 and a source that always works
 *     14:00-16:00 can have identical peak-hour-share but very
 *     different topK-mass-share signatures (the question here is
 *     about the *clock-hour* signature, not within-day spikiness).
 *   - `source-token-mass-hour-centroid` reports the *position* of
 *     the circular mean of the hour-of-day mass distribution
 *     (centroidHour) and the resultant length R. R is a
 *     continuous, smooth concentration index across all 24 bins;
 *     topK-mass-share is a discrete top-K cumulative share. Two
 *     sources can share an R but have very different top-K
 *     shares: a unimodal source with a fat shoulder vs. a
 *     bimodal source with two narrow peaks.
 *   - `hour-of-day-token-skew` is the 3rd standardised moment of
 *     the hour-of-day distribution treated linearly. It measures
 *     asymmetry, not concentration magnitude.
 *   - `bucket-token-gini` Ginis the hourly buckets in the window
 *     directly. It conflates *which clock-hour* with *which day*:
 *     a source that hits 14:00 hard every single day looks the
 *     same to bucket-Gini as one that hits 14:00, 15:00, 16:00
 *     each on different days. topK-mass-share collapses to the
 *     hour-of-day axis first, isolating the clock signature.
 *   - `daily-token-gini-coefficient` Ginis the per-*day* totals.
 *     Order-invariant on the day axis. Says nothing about hour-of-day.
 *
 * Headline question:
 * **"For each source, how concentrated is its lifetime token spend
 *   on the 24-hour clock? Could you cover most of its work with
 *   just K clock hours of the day?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `topHours` (default 3): integer K in [1, 24]. The K of
 *     "top-K". Echoed back on the report so JSON consumers can
 *     reconstruct the bound K/24.
 *   - `minTokens` (default 1000): hide sparse sources;
 *     surfaces as `droppedSparseSources`.
 *   - `minHours` (default 2): require at least this many distinct
 *     populated hours-of-day. A source active in only 1 hour
 *     trivially has share_K = 1 and is uninteresting; surfaces as
 *     `droppedBelowMinHours`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'share'): 'share' | 'tokens' | 'hours' | 'source'.
 */
import type { QueueLine } from './types.js';

export type SourceHourTopKMassShareSort =
  | 'share'
  | 'tokens'
  | 'hours'
  | 'source';

export interface SourceHourTopKMassShareOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** K, the number of busiest hours-of-day to sum (default 3). */
  topHours?: number;
  minTokens?: number;
  /** Minimum number of distinct populated hours-of-day (default 2). */
  minHours?: number;
  top?: number;
  sort?: SourceHourTopKMassShareSort;
  generatedAt?: string;
}

export interface SourceHourTopKMassShareRow {
  source: string;
  totalTokens: number;
  /** Number of distinct hours-of-day with non-zero mass (1..24). */
  nHours: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Sum of top-K hour-of-day masses divided by totalTokens. */
  topKShare: number;
  /** The K largest hour-of-day buckets (descending by mass). */
  topHourBuckets: { hour: number; tokens: number; share: number }[];
  /** Per-bin uniform-baseline lower bound K / 24 echoed for convenience. */
  uniformBaseline: number;
}

export interface SourceHourTopKMassShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  topHoursK: number;
  /** K / 24 — the share you'd see under perfect uniformity. */
  uniformBaseline: number;
  minTokens: number;
  minHours: number;
  top: number;
  sort: SourceHourTopKMassShareSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinHours: number;
  droppedTopSources: number;
  sources: SourceHourTopKMassShareRow[];
}

/**
 * Sum of the K largest entries of a non-negative numeric vector.
 * Defensively clamps K to [0, vec.length].
 */
export function sumTopK(values: number[], k: number): number {
  if (k <= 0 || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => b - a);
  const eff = Math.min(k, sorted.length);
  let s = 0;
  for (let i = 0; i < eff; i++) s += sorted[i]!;
  return s;
}

export function buildSourceHourTopKMassShare(
  queue: QueueLine[],
  opts: SourceHourTopKMassShareOptions = {},
): SourceHourTopKMassShareReport {
  const topHoursK = opts.topHours ?? 3;
  if (!Number.isInteger(topHoursK) || topHoursK < 1 || topHoursK > 24) {
    throw new Error(
      `topHours must be an integer in [1, 24] (got ${opts.topHours})`,
    );
  }
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minHours = opts.minHours ?? 2;
  if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
    throw new Error(
      `minHours must be an integer in [1, 24] (got ${opts.minHours})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: SourceHourTopKMassShareSort = opts.sort ?? 'share';
  const validSorts: SourceHourTopKMassShareSort[] = [
    'share',
    'tokens',
    'hours',
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
  const uniformBaseline = topHoursK / 24;

  interface SrcAcc {
    perHour: number[]; // length 24
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
    const d = new Date(ms);
    const hour = d.getUTCHours();
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perHour: new Array(24).fill(0),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perHour[hour]! += tt;
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinHours = 0;
  let totalTokensSum = 0;
  const rows: SourceHourTopKMassShareRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    let nHours = 0;
    for (const v of acc.perHour) if (v > 0) nHours += 1;
    if (nHours < minHours) {
      droppedBelowMinHours += 1;
      continue;
    }
    const topKSum = sumTopK(acc.perHour, topHoursK);
    const topKShare = acc.totalTokens > 0 ? topKSum / acc.totalTokens : 0;
    // Build the explicit top-K hour list (ties: lower hour first).
    const indexed = acc.perHour
      .map((v, h) => ({ hour: h, tokens: v }))
      .filter((e) => e.tokens > 0)
      .sort((a, b) => {
        if (b.tokens !== a.tokens) return b.tokens - a.tokens;
        return a.hour - b.hour;
      });
    const eff = Math.min(topHoursK, indexed.length);
    const topHourBuckets = indexed.slice(0, eff).map((e) => ({
      hour: e.hour,
      tokens: e.tokens,
      share: acc.totalTokens > 0 ? e.tokens / acc.totalTokens : 0,
    }));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nHours,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      topKShare,
      topHourBuckets,
      uniformBaseline,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'hours':
        primary = b.nHours - a.nHours;
        break;
      case 'source':
        primary = 0;
        break;
      case 'share':
      default:
        primary = b.topKShare - a.topKShare;
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
    topHoursK,
    uniformBaseline,
    minTokens,
    minHours,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinHours,
    droppedTopSources,
    sources: kept,
  };
}
