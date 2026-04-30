/**
 * daily-token-zenga-index: per-source ZENGA (2007) inequality index of
 * the per-day total_tokens distribution.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Zenga index.
 *
 * Construction (Zenga 2007, "Inequality curve and inequality index
 * based on the ratios between lower and upper arithmetic means"):
 *
 *   Sort D ascending: D_(1) <= D_(2) <= ... <= D_(n).
 *   For k = 1, ..., n - 1 define
 *     M_k^- = (1/k)       * sum_{i=1..k}     D_(i)   // bottom-k mean
 *     M_k^+ = (1/(n-k))   * sum_{i=k+1..n}   D_(i)   // top-(n-k) mean
 *     u(k)  = 1 - M_k^- / M_k^+                       // in [0, 1]
 *   Zenga index
 *     Z = (1 / (n - 1)) * sum_{k=1..n-1} u(k)         // in [0, 1]
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `daily-token-gini-coefficient` integrates the Lorenz curve once
 *     and folds all cutpoints into a single area. Zenga averages
 *     (n - 1) DIFFERENT bottom-vs-top mean ratios and is far more
 *     sensitive to the SHAPE of the distribution at intermediate
 *     cutpoints. Two day-vectors with identical Gini can have very
 *     different Zenga: e.g. [1, 1, 1, 1, 100] and [1, 25, 50, 75, 51]
 *     differ in Zenga even when their Gini values match closely.
 *   - `daily-token-z-score-extremes` is a per-day OUTLIER flag and
 *     reads the daily series in time order. Zenga is order-invariant.
 *   - `daily-token-monotone-run-length`,
 *     `daily-token-second-difference-sign-runs`,
 *     `daily-token-autocorrelation-lag1` are all ORDER-DEPENDENT
 *     time-series stats; Zenga is permutation-invariant.
 *   - `cumulative-tokens-midpoint` reports a single CDF quantile
 *     (the 50% mass day). Zenga averages a function of (n - 1)
 *     thresholds and answers a different question.
 *   - `single-day-mass-concentration` reports top-1/top-2/top-3
 *     mass shares at FIXED k. Zenga uses ALL k, so it is robust to
 *     the choice of k that fixed-k indices have to make.
 *
 * Headline question:
 * **"For each source, averaged over every cutpoint k from 1 to n-1,
 *   what fraction of the upper-tail mean does the lower-tail mean
 *   FAIL to reach? A score of 0 means the bottom-k days carry the
 *   same mean as the top-(n-k) days at every cutpoint; a score
 *   approaching 1 means the bottom is dwarfed by the top at every
 *   cutpoint."**
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
 *   - `minDays` (default 2): Zenga requires n >= 2; surfaces as
 *     `droppedBelowMinDays`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'zenga'): 'zenga' | 'tokens' | 'days' | 'source'.
 *   - All days are read off the UTC date prefix (yyyy-mm-dd) of
 *     `hour_start`, matching every other daily statistic in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type DailyTokenZengaSort = 'zenga' | 'tokens' | 'days' | 'source';

export interface DailyTokenZengaOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenZengaSort;
  /**
   * Display filter: drop rows whose `zenga` is strictly below this
   * value. 0 = no filter; in [0, 1].
   */
  minZenga?: number;
  generatedAt?: string;
}

export interface DailyTokenZengaSourceRow {
  source: string;
  /** Sum of total_tokens across all retained days. */
  totalTokens: number;
  /** Number of distinct UTC days with positive token mass. */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Zenga (2007) inequality index of the per-day total_tokens vector.
   * In [0, 1]. 0 = perfect equality; -> 1 = extreme concentration.
   */
  zenga: number;
  /**
   * Mean per-day total_tokens (totalTokens / nDays). Provided for
   * cross-reference with the gini axis and as a scale anchor.
   */
  meanDailyTokens: number;
  /** Largest single-day total_tokens. */
  maxDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the largest single-day total. */
  maxDay: string;
  /**
   * Maximum value of the per-cutpoint inequality function u(k) over
   * k = 1..n-1, plus the k that achieves it (1-indexed). The
   * argmax-k tells you the cutpoint at which the bottom-vs-top mean
   * gap is widest -- a feature the scalar Zenga hides.
   */
  maxU: number;
  argmaxK: number;
  /**
   * Quantile-anchored sweep of the inequality curve at k =
   * round(0.25 * n), round(0.50 * n), round(0.75 * n) (each clamped
   * to [1, n-1]). Reported alongside the scalar Zenga so a reader
   * can tell whether the inequality is loaded at the bottom, the
   * middle, or the top of the cutpoint range. Refinement (v0.6.271).
   */
  uAt25: number;
  uAt50: number;
  uAt75: number;
  /**
   * Full per-cutpoint inequality curve u(k) for k = 1..n-1.
   * Length = nDays - 1. Always emitted in JSON; the pretty
   * renderer only prints it when --show-curve is passed.
   * Refinement (v0.6.271).
   */
  curve: number[];
}

export interface DailyTokenZengaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenZengaSort;
  minZenga: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinZenga: number;
  droppedTopSources: number;
  sources: DailyTokenZengaSourceRow[];
}

/**
 * Zenga (2007) inequality index of a non-negative numeric vector.
 *
 * Returns:
 *   - { zenga: 0, maxU: 0, argmaxK: 0, curve: [] } for n < 2.
 *   - { zenga: 0, maxU: 0, argmaxK: 0, curve: [...zeros] } for the
 *     all-zero vector.
 *   - zenga in [0, 1] otherwise.
 *
 * `curve` is the full per-cutpoint inequality function
 * `u(k) = 1 - M_k^- / M_k^+` for k = 1, ..., n - 1, in order.
 * Length n - 1. The scalar Zenga is its arithmetic mean.
 *
 * Throws on negative or non-finite input -- token totals are
 * guaranteed non-negative by upstream filters.
 */
export function zengaOfVector(values: number[]): {
  zenga: number;
  maxU: number;
  argmaxK: number;
  curve: number[];
} {
  const n = values.length;
  if (n < 2) return { zenga: 0, maxU: 0, argmaxK: 0, curve: [] };
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `zengaOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return { zenga: 0, maxU: 0, argmaxK: 0, curve: new Array(n - 1).fill(0) };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  let prefix = 0;
  let sumU = 0;
  let maxU = 0;
  let argmaxK = 0;
  const curve: number[] = new Array(n - 1);
  for (let k = 1; k <= n - 1; k++) {
    prefix += sorted[k - 1]!;
    const lower = prefix / k;
    const upperSum = total - prefix;
    const upper = upperSum / (n - k);
    const u = upper > 0 ? 1 - lower / upper : 0;
    curve[k - 1] = u;
    sumU += u;
    if (u > maxU) {
      maxU = u;
      argmaxK = k;
    }
  }
  const zenga = sumU / (n - 1);
  return { zenga, maxU, argmaxK, curve };
}

export function buildDailyTokenZengaIndex(
  queue: QueueLine[],
  opts: DailyTokenZengaOptions = {},
): DailyTokenZengaReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Zenga needs n >= 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minZenga = opts.minZenga ?? 0;
  if (!Number.isFinite(minZenga) || minZenga < 0 || minZenga > 1) {
    throw new Error(
      `minZenga must be a finite number in [0, 1] (got ${opts.minZenga})`,
    );
  }
  const sort: DailyTokenZengaSort = opts.sort ?? 'zenga';
  const validSorts: DailyTokenZengaSort[] = [
    'zenga',
    'tokens',
    'days',
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
  const rows: DailyTokenZengaSourceRow[] = [];

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
    const z = zengaOfVector(values);
    const clampK = (k: number) => Math.max(1, Math.min(nDays - 1, k));
    const k25 = clampK(Math.round(0.25 * nDays));
    const k50 = clampK(Math.round(0.5 * nDays));
    const k75 = clampK(Math.round(0.75 * nDays));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      zenga: z.zenga,
      meanDailyTokens: acc.totalTokens / nDays,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      maxU: z.maxU,
      argmaxK: z.argmaxK,
      uAt25: z.curve[k25 - 1] ?? 0,
      uAt50: z.curve[k50 - 1] ?? 0,
      uAt75: z.curve[k75 - 1] ?? 0,
      curve: z.curve,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinZenga = 0;
  let filtered = rows;
  if (minZenga > 0) {
    const next: DailyTokenZengaSourceRow[] = [];
    for (const r of rows) {
      if (r.zenga >= minZenga) next.push(r);
      else droppedBelowMinZenga += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
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
      case 'zenga':
      default:
        primary = b.zenga - a.zenga;
        break;
    }
    if (primary !== 0) return primary;
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
    minDays,
    top,
    sort,
    minZenga,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinZenga,
    droppedTopSources,
    sources: kept,
  };
}
