/**
 * source-cost-class-mix: per-source classification of activity rows
 * into small / medium / large cost classes by `total_tokens`, with
 * both row-share and token-mass-share reported per class.
 *
 * For each source we:
 *
 *   1. Walk every row in the queue with positive `total_tokens` and
 *      classify it by total_tokens into one of three cost classes:
 *        - small  : 0      <  total_tokens <  smallMax    (default 1_000)
 *        - medium : smallMax <= total_tokens < largeMin   (default 1_000..10_000)
 *        - large  : total_tokens >= largeMin              (default 10_000)
 *      The bucket boundaries are inclusive on the low end of medium
 *      and large so every positive row lands in exactly one class.
 *   2. For each source, count rows in each class and sum token mass
 *      in each class.
 *   3. Report `pctRowsX` (= classRows / totalRows) and `pctTokensX`
 *      (= classTokens / totalTokens) for each X in {small, medium,
 *      large}, plus the absolute counts.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `tail-share` is a *Pareto* lens on hour-of-week buckets per
 *     source ("what fraction of mass is in the top K% of buckets?")
 *     and never classifies individual rows by absolute token
 *     magnitude. A source whose total mass is dominated by 1 huge
 *     row vs. 1000 mid rows can have similar top-K-share but very
 *     different cost-class-mix.
 *   - `bucket-intensity` and `output-size` report the
 *     *distribution shape* (mean, p50, p95, max) of magnitudes;
 *     they never project onto a small/medium/large 3-class
 *     categorical, so they cannot answer "what % of this source's
 *     traffic is interactive-sized vs. batch-sized?".
 *   - `source-burstiness-fano-factor`, `daily-token-gini-coefficient`
 *     and friends are dispersion / inequality stats; they do not
 *     classify rows into named magnitude classes.
 *   - `cost`, `cost-per-bucket-percentiles`, `budget` operate on
 *     *cost dollars* (a model-priced derivative), not on the raw
 *     `total_tokens` magnitude with a fixed threshold ladder.
 *   - Every `source-hour-of-day-*` and `source-active-*` lens lives
 *     on a time axis, not a magnitude axis.
 *
 * Headline question:
 *   **"For each source, what mix of small / medium / large rows is
 *   it built out of, by both row-count and by token mass?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `smallMax` (default 1000): exclusive upper bound of the small
 *     class. A row with `total_tokens < smallMax` is small. Must be
 *     a finite positive integer.
 *   - `largeMin` (default 10000): inclusive lower bound of the
 *     large class. A row with `total_tokens >= largeMin` is large.
 *     Must be a finite integer with `largeMin >= smallMax` so
 *     medium is non-empty in principle (medium is the half-open
 *     interval [smallMax, largeMin)). When `largeMin == smallMax`
 *     the medium class is structurally empty and only small/large
 *     rows are reported.
 *   - `minRows` (default 1): hide source rows with fewer than n
 *     classified rows. Suppressed surface as `droppedBelowMinRows`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'rows' | 'pctLargeTokens' |
 *     'pctLargeRows' | 'pctSmallTokens' | 'pctSmallRows' | 'source'.
 */
import type { QueueLine } from './types.js';

export type SourceCostClassMixSort =
  | 'tokens'
  | 'rows'
  | 'pctLargeTokens'
  | 'pctLargeRows'
  | 'pctSmallTokens'
  | 'pctSmallRows'
  | 'source';

export interface SourceCostClassMixOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  smallMax?: number;
  largeMin?: number;
  minRows?: number;
  top?: number;
  sort?: SourceCostClassMixSort;
  generatedAt?: string;
}

export interface SourceCostClassMixSourceRow {
  source: string;
  totalRows: number;
  totalTokens: number;
  smallRows: number;
  mediumRows: number;
  largeRows: number;
  smallTokens: number;
  mediumTokens: number;
  largeTokens: number;
  pctRowsSmall: number;
  pctRowsMedium: number;
  pctRowsLarge: number;
  pctTokensSmall: number;
  pctTokensMedium: number;
  pctTokensLarge: number;
}

export interface SourceCostClassMixReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  smallMax: number;
  largeMin: number;
  minRows: number;
  top: number;
  sort: SourceCostClassMixSort;
  source: string | null;
  totalRows: number;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedTopSources: number;
  sources: SourceCostClassMixSourceRow[];
}

export function buildSourceCostClassMix(
  queue: QueueLine[],
  opts: SourceCostClassMixOptions = {},
): SourceCostClassMixReport {
  const smallMax = opts.smallMax ?? 1000;
  if (!Number.isInteger(smallMax) || smallMax <= 0) {
    throw new Error(
      `smallMax must be a positive integer (got ${opts.smallMax})`,
    );
  }
  const largeMin = opts.largeMin ?? 10000;
  if (!Number.isInteger(largeMin) || largeMin < smallMax) {
    throw new Error(
      `largeMin must be an integer >= smallMax (got largeMin=${opts.largeMin}, smallMax=${smallMax})`,
    );
  }
  const minRows = opts.minRows ?? 1;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(`minRows must be an integer >= 1 (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: SourceCostClassMixSort = opts.sort ?? 'tokens';
  const validSorts: SourceCostClassMixSort[] = [
    'tokens',
    'rows',
    'pctLargeTokens',
    'pctLargeRows',
    'pctSmallTokens',
    'pctSmallRows',
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

  interface Acc {
    rows: number;
    tokens: number;
    sR: number;
    mR: number;
    lR: number;
    sT: number;
    mT: number;
    lT: number;
  }
  const agg = new Map<string, Acc>();
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
    let a = agg.get(src);
    if (!a) {
      a = { rows: 0, tokens: 0, sR: 0, mR: 0, lR: 0, sT: 0, mT: 0, lT: 0 };
      agg.set(src, a);
    }
    a.rows += 1;
    a.tokens += tt;
    if (tt >= largeMin) {
      a.lR += 1;
      a.lT += tt;
    } else if (tt >= smallMax) {
      a.mR += 1;
      a.mT += tt;
    } else {
      a.sR += 1;
      a.sT += tt;
    }
  }

  const totalSources = agg.size;
  let droppedBelowMinRows = 0;
  let totalRowsAll = 0;
  let totalTokensAll = 0;
  const rowsArr: SourceCostClassMixSourceRow[] = [];

  for (const [src, a] of agg) {
    if (a.rows < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    totalRowsAll += a.rows;
    totalTokensAll += a.tokens;
    rowsArr.push({
      source: src,
      totalRows: a.rows,
      totalTokens: a.tokens,
      smallRows: a.sR,
      mediumRows: a.mR,
      largeRows: a.lR,
      smallTokens: a.sT,
      mediumTokens: a.mT,
      largeTokens: a.lT,
      pctRowsSmall: a.sR / a.rows,
      pctRowsMedium: a.mR / a.rows,
      pctRowsLarge: a.lR / a.rows,
      pctTokensSmall: a.tokens > 0 ? a.sT / a.tokens : 0,
      pctTokensMedium: a.tokens > 0 ? a.mT / a.tokens : 0,
      pctTokensLarge: a.tokens > 0 ? a.lT / a.tokens : 0,
    });
  }

  const cmpRow = (
    a: SourceCostClassMixSourceRow,
    b: SourceCostClassMixSourceRow,
  ): number => {
    let primary = 0;
    switch (sort) {
      case 'rows':
        primary = b.totalRows - a.totalRows;
        break;
      case 'pctLargeTokens':
        primary = b.pctTokensLarge - a.pctTokensLarge;
        break;
      case 'pctLargeRows':
        primary = b.pctRowsLarge - a.pctRowsLarge;
        break;
      case 'pctSmallTokens':
        primary = b.pctTokensSmall - a.pctTokensSmall;
        break;
      case 'pctSmallRows':
        primary = b.pctRowsSmall - a.pctRowsSmall;
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
  };
  rowsArr.sort(cmpRow);

  let droppedTopSources = 0;
  let kept = rowsArr;
  if (top > 0 && rowsArr.length > top) {
    droppedTopSources = rowsArr.length - top;
    kept = rowsArr.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    smallMax,
    largeMin,
    minRows,
    top,
    sort,
    source: sourceFilter,
    totalRows: totalRowsAll,
    totalTokens: totalTokensAll,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedTopSources,
    sources: kept,
  };
}
