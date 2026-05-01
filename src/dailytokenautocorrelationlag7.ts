/**
 * daily-token-autocorrelation-lag7: per-source lag-7 (Pearson)
 * autocorrelation of the gap-filled daily total_tokens series.
 *
 * SIXTY-EIGHTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (so
 * we have a dense, evenly-spaced length-N time series). Then
 * compute the lag-7 Pearson autocorrelation
 *
 *     rho7 = sum_{i=0..n-8} (x[i] - mu) * (x[i+7] - mu)
 *            / sum_{i=0..n-1} (x[i] - mu)^2
 *
 * (biased divisor matching numpy/statsmodels acf conventions).
 *
 * Headline question:
 * **"For each source, does this Monday's token mass predict NEXT
 *   Monday's token mass -- i.e. is there a WEEKLY ECHO at exactly
 *   the 7-day lag, separate from any same-weekday mass concentration
 *   captured by weekday-share or lag-1 stickiness?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED AXIS 32..67:
 *
 *   - vs `daily-token-autocorrelation-lag1` (rho1, the lag-1
 *     analogue): lag-1 captures adjacency persistence (does today
 *     predict tomorrow?). lag-7 specifically captures the WEEKLY
 *     CYCLE -- a source with rho1 = 0 (i.i.d. day-to-day on the
 *     short scale) can still have rho7 = +0.8 if it follows a
 *     rigid weekly pattern (heavy Mondays + light Sundays
 *     repeating). Conversely a source with rho1 = +0.6 (sticky
 *     bursts of 3-4 days) typically has rho7 closer to 0 because
 *     the 7-day shift falls into the next burst gap. The two are
 *     mathematically independent: the autocorrelation function
 *     evaluated at different lags is a different scalar at each
 *     lag, and a finite series can have arbitrary (rho1, rho7)
 *     pairs subject only to positive semi-definiteness of the
 *     full ACF (which 7-1=6 lags of slack accommodate freely).
 *
 *   - vs `weekday-share` HHI (axis: weekday concentration):
 *     weekday-share aggregates ALL Mondays into a single bucket
 *     and reports the share. A source whose Mondays alternate
 *     0 / 50000 / 0 / 50000 across weeks has the same Monday
 *     SHARE as one whose Mondays are flat 25000 every week, but
 *     totally different rho7. weekday-share is order-invariant
 *     across same-weekday observations; rho7 is the order-
 *     SENSITIVE complement.
 *
 *   - vs ALL unsigned dispersion axes 32..63 (Gini, Atkinson,
 *     Theil, GE, Hoover, Pietra, Bonferroni, Mehran, Wolfson,
 *     Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray,
 *     Var-of-Logs, Log-MAD, FGT, PGR, IOM, MSR, DSG, QSR, MADM,
 *     Zenga): all permutation-INVARIANT. Shuffle the days,
 *     dispersion is unchanged, rho7 collapses to ~0.
 *
 *   - vs calendar-order axes 60 (MSR), 64 (RTZ), monotone-run-
 *     length, second-diff-sign-runs: those are SIGN-trace or
 *     RUN statistics on order patterns and ignore magnitude.
 *     rho7 is a VALUE correlation at a specific lag.
 *
 *   - vs Hill (axis 65) tail-index, L-skewness (axis 67),
 *     medcouple (axis 66): these are shape statistics on the
 *     marginal distribution. Permutation-invariant. rho7 sees
 *     the temporal placement that they explicitly throw away.
 *
 *   - vs `source-row-token-autocorrelation-lag1` (row-grain,
 *     not day-grain): row-grain lag-1 captures within-hour
 *     stickiness across consecutive queue ROWS. lag-7 here is
 *     at DAY grain and captures specifically the 7-day cycle,
 *     which has no analogue at row grain (a "row 7 ago" is
 *     not a meaningful temporal anchor when rows-per-day
 *     varies wildly).
 *
 *   - vs `trend` / `forecast` / `source-daily-token-trend-slope`:
 *     these fit a LINEAR drift. A source can have zero drift
 *     and still have rho7 = +0.9 (rigid weekly oscillation
 *     around a flat mean). rho7 explicitly de-trends via the
 *     mean-centring inside the Pearson formula.
 *
 *   - vs `interarrival-time`, `bucket-streak-length`,
 *     `bucket-gap-distribution`, `source-decay-half-life`,
 *     `source-rank-churn`: gap / decay / rank statistics, not
 *     numerical autocorrelation at a fixed lag.
 *
 * Bound: rho7 in [-1, +1] by Cauchy-Schwarz applied to the
 * mean-centred shifted-product sum. flat=true marks sources
 * with var(x)=0 across the gap-filled tenure (rho7 reported as
 * 0 to distinguish "literally undefined" from "noisy zero").
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass
 *     is below this floor; counts surface as droppedSparseSources.
 *   - `minTenureDays` (default 14): require tenure >= this many
 *     calendar days so we have at least one full lag-7 pair. The
 *     hard structural floor is 8 (need at least one (i, i+7) pair
 *     => n >= 8); we default to 14 so rho7 has at least N - 7 = 7
 *     pair contributions -- one full week of overlapping
 *     comparisons.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'absRho7'): 'absRho7' (most weekly-periodic
 *     first; |rho7| descending) | 'rho7' (most positively-periodic
 *     first) | 'rho7Asc' (most anti-periodic first) | 'tokens' |
 *     'tenure' | 'source'.
 *   - `minAbsRho7`: display filter; hide non-flat rows with
 *     |rho7| < this.
 */
import type { QueueLine } from './types.js';

export type DailyTokenAutocorrelationLag7Sort =
  | 'absRho7'
  | 'rho7'
  | 'rho7Asc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAutocorrelationLag7Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Must be >= 8. Default 14. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAutocorrelationLag7Sort;
  /** Display filter: drop non-flat rows with |rho7| < this. null = no filter. */
  minAbsRho7?: number | null;
  generatedAt?: string;
}

export interface DailyTokenAutocorrelationLag7SourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days = lastActive - firstActive + 1. */
  nTenureDays: number;
  /** Number of (i, i+7) pair contributions in the rho7 sum = nTenureDays - 7. */
  nLag7Pairs: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Lag-7 Pearson autocorrelation in [-1, +1]. 0 with flat=true when var=0. */
  rho7: number;
  /** True iff the gap-filled series is constant (rho7 undefined). */
  flat: boolean;
}

export interface DailyTokenAutocorrelationLag7Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAutocorrelationLag7Sort;
  minAbsRho7: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedBelowMinAbsRho7: number;
  droppedTopSources: number;
  sources: DailyTokenAutocorrelationLag7SourceRow[];
}

/**
 * Lag-k Pearson autocorrelation with biased (1/n) divisor:
 *
 *   rho_k = sum_{i=0..n-k-1} (x[i] - mu) * (x[i+k] - mu)
 *           / sum_{i=0..n-1} (x[i] - mu)^2
 *
 * Returns { rho: 0, flat: true } when the denominator is 0 or
 * n <= k (no pairs).
 */
export function pearsonAutocorrelationAtLag(
  values: number[],
  k: number,
): { rho: number; flat: boolean } {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`lag k must be a positive integer (got ${k})`);
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `pearsonAutocorrelationAtLag requires finite values (got ${v})`,
      );
    }
  }
  const n = values.length;
  if (n <= k) return { rho: 0, flat: true };
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let denom = 0;
  for (const v of values) {
    const d = v - mu;
    denom += d * d;
  }
  if (denom === 0) return { rho: 0, flat: true };
  let num = 0;
  for (let i = 0; i < n - k; i += 1) {
    num += (values[i]! - mu) * (values[i + k]! - mu);
  }
  let rho = num / denom;
  // Clamp into [-1, 1] to absorb fp noise.
  if (rho > 1) rho = 1;
  if (rho < -1) rho = -1;
  return { rho, flat: false };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenAutocorrelationLag7(
  queue: QueueLine[],
  opts: DailyTokenAutocorrelationLag7Options = {},
): DailyTokenAutocorrelationLag7Report {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (lag-7 autocorrelation requires at least one (i, i+7) pair, i.e. n >= 8) (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAbsRho7 = opts.minAbsRho7 ?? null;
  if (
    minAbsRho7 !== null &&
    (!Number.isFinite(minAbsRho7) || minAbsRho7 < 0 || minAbsRho7 > 1)
  ) {
    throw new Error(
      `minAbsRho7 must be a finite number in [0, 1] when set (got ${opts.minAbsRho7})`,
    );
  }
  const sort: DailyTokenAutocorrelationLag7Sort = opts.sort ?? 'absRho7';
  const validSorts: DailyTokenAutocorrelationLag7Sort[] = [
    'absRho7',
    'rho7',
    'rho7Asc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

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
  let droppedBelowMinTenure = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenAutocorrelationLag7SourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(acc.firstDay, acc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    // Build dense gap-filled tenure series.
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mu = 0;
    for (const v of filled) mu += v;
    mu /= nTenure;
    let varSum = 0;
    for (const v of filled) {
      const d = v - mu;
      varSum += d * d;
    }
    const stddev = Math.sqrt(varSum / nTenure);
    const r = pearsonAutocorrelationAtLag(filled, 7);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nLag7Pairs: nTenure - 7,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: mu,
      stddev,
      rho7: r.rho,
      flat: r.flat,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAbsRho7 = 0;
  let filtered = rows;
  if (minAbsRho7 !== null) {
    const next: DailyTokenAutocorrelationLag7SourceRow[] = [];
    for (const r of rows) {
      if (r.flat) next.push(r);
      else if (Math.abs(r.rho7) >= minAbsRho7) next.push(r);
      else droppedBelowMinAbsRho7 += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rho7':
        primary = b.rho7 - a.rho7;
        break;
      case 'rho7Asc':
        primary = a.rho7 - b.rho7;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absRho7':
      default:
        primary = Math.abs(b.rho7) - Math.abs(a.rho7);
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTenureDays,
    top,
    sort,
    minAbsRho7,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedBelowMinAbsRho7,
    droppedTopSources,
    sources: kept,
  };
}
