/**
 * daily-token-buishand-range: per-source BUISHAND range/U test on the
 * gap-filled daily total_tokens series.
 *
 * AXIS-155 (range-based parametric changepoint).
 *
 * For each source, on the gap-filled tenure series x[0..n-1] with mean
 * mu and population standard deviation sigma > 0:
 *
 *     S[k] = sum_{i=0..k} (x[i] - mu)         k = 0..n-1   (S[n-1] = 0)
 *     S*[k] = S[k] / sigma                    standardized partial sum
 *
 *     R       = (max_k S*[k]) - (min_k S*[k])      "range"
 *     Rstar   = R / sqrt(n)                        Buishand R-statistic
 *
 *     Q       = max_k |S*[k]|                      max-absolute path
 *     Qstar   = Q / sqrt(n)                        Buishand Q-statistic
 *
 *     U       = sum_k (S*[k])^2 / (n * (n+1))      Buishand U-statistic
 *
 *     tStar   = argmax_k |S*[k]|                   most likely break index
 *     tArgMax = argmax_k S*[k]                     extreme-up index (sign +)
 *     tArgMin = argmin_k S*[k]                     extreme-down index (sign -)
 *
 * Buishand (1982) showed Rstar and Qstar are sensitive to a SINGLE
 * step shift in the mean of a roughly i.i.d. normal series, with
 * critical values tabulated under the null hypothesis of constant mean.
 * U is a Cramer-von-Mises-style integrated path statistic: it weighs
 * the WHOLE excursion path, not just the single worst point, so it
 * is comparatively more sensitive to slow drifts and less sensitive
 * to one-off spikes.
 *
 * Why this is structurally orthogonal to existing axes:
 *
 *   - axis-153 cusum-max-deviation: max |centered cumsum|, NOT
 *     standardized by sigma, no "range = max - min" surface, no U
 *     integrated path. Buishand divides by sigma so unit-free across
 *     sources of different scale; cusum is in token-units.
 *   - axis-154 pettitt-changepoint: rank-based (sign of pairwise
 *     differences only); Buishand is mean/sigma-based so it IS
 *     magnitude-sensitive but explicitly normalized. Pettitt has no
 *     "range" surface (max-min of S vs max|S|). On a clean V-shape
 *     symmetric around the mean Pettitt's KT can be small while
 *     Buishand R is large because S*[k] excurses to both extremes.
 *   - axis-151 allan-deviation, hampel-outlier-count, etc: variance
 *     / outlier statistics, not partial-sum shape statistics.
 *   - mann-kendall, cox-stuart, runs-test: trend/randomness tests on
 *     pairwise/sign relationships, not on cumulative-deviation paths.
 *
 * Knobs:
 *   - `minDays` (default 4): n must be >= 4 for non-degenerate stats.
 *   - `top` (default 0): display cap.
 *   - `sort`: tokens|rstar|qstar|u|tstaridx|spread|ndays.
 *
 *   `spread` sort is by tArgMax - tArgMin; positive means the up-extreme
 *   is reached AFTER the down-extreme (a rising regime), negative means
 *   the series peaked early then drained down. This is a directional
 *   sign that Pettitt KT and CUSUM do not directly expose.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export type DailyTokenBuishandRangeSortKey =
  | 'tokens'
  | 'rstar'
  | 'qstar'
  | 'u'
  | 'tstaridx'
  | 'spread'
  | 'ndays';

export interface DailyTokenBuishandRangeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Minimum gap-filled tenure length (days). Must be >= 4. Default 4. */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  sort?: DailyTokenBuishandRangeSortKey;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenBuishandRangeSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nFilledDays: number;
  /** Buishand R = (max S*) - (min S*). Always >= 0. */
  r: number;
  /** R / sqrt(n). */
  rStar: number;
  /** Q = max |S*|. Always >= 0. */
  q: number;
  /** Q / sqrt(n). */
  qStar: number;
  /** Buishand U = sum_k S*[k]^2 / (n*(n+1)). >= 0. */
  u: number;
  /** argmax |S*|. -1 if degenerate. */
  tStarIndex: number;
  /** ISO YYYY-MM-DD of x[tStarIndex]. null when degenerate. */
  tStarDay: string | null;
  /** argmax S*  (most extreme upward excursion index). -1 if degenerate. */
  tArgMax: number;
  /** ISO day at tArgMax. null when degenerate. */
  tArgMaxDay: string | null;
  /** argmin S*  (most extreme downward excursion index). -1 if degenerate. */
  tArgMin: number;
  /** ISO day at tArgMin. null when degenerate. */
  tArgMinDay: string | null;
  /** tArgMax - tArgMin. +n: up-extreme later (rising); -n: down-extreme later. */
  argSpread: number;
  /** True iff series has zero population variance — Buishand undefined. */
  flat: boolean;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenBuishandRangeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: DailyTokenBuishandRangeSortKey;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenBuishandRangeSourceRow[];
}

export interface BuishandSummary {
  r: number;
  rStar: number;
  q: number;
  qStar: number;
  u: number;
  tStarIndex: number;
  tArgMax: number;
  tArgMin: number;
  argSpread: number;
  flat: boolean;
}

/**
 * Pure Buishand range/U summary on a real-valued series of length n.
 * Returns `flat` true when n<2 or population variance is 0.
 */
export function buishandSummary(values: number[]): BuishandSummary {
  const n = values.length;
  if (n < 2) {
    return {
      r: 0,
      rStar: 0,
      q: 0,
      qStar: 0,
      u: 0,
      tStarIndex: -1,
      tArgMax: -1,
      tArgMin: -1,
      argSpread: 0,
      flat: true,
    };
  }
  let mu = 0;
  for (let i = 0; i < n; i++) mu += values[i]!;
  mu /= n;
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - mu;
    varSum += d * d;
  }
  // Population standard deviation (divide by n) — matches Buishand's original
  // formulation with biased variance estimator. Tests rely on this choice.
  const sigma = Math.sqrt(varSum / n);
  if (sigma === 0 || !Number.isFinite(sigma)) {
    return {
      r: 0,
      rStar: 0,
      q: 0,
      qStar: 0,
      u: 0,
      tStarIndex: -1,
      tArgMax: -1,
      tArgMin: -1,
      argSpread: 0,
      flat: true,
    };
  }

  let cum = 0;
  let maxS = -Infinity;
  let minS = Infinity;
  let absMax = 0;
  let tStar = 0;
  let tArgMax = 0;
  let tArgMin = 0;
  let sumSq = 0;
  for (let k = 0; k < n; k++) {
    cum += values[k]! - mu;
    const s = cum / sigma;
    sumSq += s * s;
    if (s > maxS) {
      maxS = s;
      tArgMax = k;
    }
    if (s < minS) {
      minS = s;
      tArgMin = k;
    }
    const a = Math.abs(s);
    if (a > absMax) {
      absMax = a;
      tStar = k;
    }
  }
  const r = maxS - minS;
  const q = absMax;
  const sqn = Math.sqrt(n);
  const rStar = r / sqn;
  const qStar = q / sqn;
  const u = sumSq / (n * (n + 1));

  return {
    r,
    rStar,
    q,
    qStar,
    u,
    tStarIndex: tStar,
    tArgMax,
    tArgMin,
    argSpread: tArgMax - tArgMin,
    flat: false,
  };
}

function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const next = new Date(ms + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

const SORT_KEYS: DailyTokenBuishandRangeSortKey[] = [
  'tokens',
  'rstar',
  'qstar',
  'u',
  'tstaridx',
  'spread',
  'ndays',
];

export function buildDailyTokenBuishandRange(
  queue: QueueLine[],
  opts: DailyTokenBuishandRangeOptions = {},
): DailyTokenBuishandRangeReport {
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 4) {
    throw new Error(`minDays must be an integer >= 4 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!SORT_KEYS.includes(sort)) {
    throw new Error(
      `sort must be one of ${SORT_KEYS.join('|')} (got ${opts.sort})`,
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
  const rows: DailyTokenBuishandRangeSourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((d) => days.get(d)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const nActive = series.length;
    if (nActive === 0) continue;

    const first = sortedKeys[0]!;
    const last = sortedKeys[sortedKeys.length - 1]!;
    const nFilled = dayDiffInclusive(first, last);
    if (nFilled < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const filled: number[] = [];
    const filledDays: string[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      filledDays.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const summary = buishandSummary(filled);
    const tStarDay =
      summary.tStarIndex >= 0 && summary.tStarIndex < filledDays.length
        ? filledDays[summary.tStarIndex]!
        : null;
    const tArgMaxDay =
      summary.tArgMax >= 0 && summary.tArgMax < filledDays.length
        ? filledDays[summary.tArgMax]!
        : null;
    const tArgMinDay =
      summary.tArgMin >= 0 && summary.tArgMin < filledDays.length
        ? filledDays[summary.tArgMin]!
        : null;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      r: summary.r,
      rStar: summary.rStar,
      q: summary.q,
      qStar: summary.qStar,
      u: summary.u,
      tStarIndex: summary.tStarIndex,
      tStarDay,
      tArgMax: summary.tArgMax,
      tArgMaxDay,
      tArgMin: summary.tArgMin,
      tArgMinDay,
      argSpread: summary.argSpread,
      flat: summary.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rstar':
        primary = b.rStar - a.rStar;
        break;
      case 'qstar':
        primary = b.qStar - a.qStar;
        break;
      case 'u':
        primary = b.u - a.u;
        break;
      case 'tstaridx':
        primary = b.tStarIndex - a.tStarIndex;
        break;
      case 'spread':
        primary = b.argSpread - a.argSpread;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
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
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
