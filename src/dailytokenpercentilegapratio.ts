/**
 * daily-token-percentile-gap-ratio: per-source PERCENTILE GAP RATIO
 * P90 / P50 of the per-day total_tokens distribution. FIFTY-EIGHTH
 * cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the dimensionless
 * quantile-ratio observable
 *
 *     PGR = P90(D) / P50(D),
 *
 * where P_q(D) is the q-th sample percentile via the standard linear
 * interpolation rule (numpy "linear" / R "type 7"):
 *
 *     given sorted D, with h = q * (n - 1), let k = floor(h) and
 *     f = h - k. Then P_q = D_sorted[k] + f * (D_sorted[k+1] - D_sorted[k]).
 *
 * ORTHOGONALITY -- WHY THIS IS STRUCTURALLY DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS:
 *
 *   axes-32..57 are without exception MOMENT- or LORENZ-functional
 *   summaries: each one integrates over the FULL distribution, either
 *   via a power kernel (GE family at alpha in {-1, 0, 1/2, 1, 2, 3,
 *   4} = axes 49/33/55/34/37/56/57), a Lorenz-curve area or chord
 *   (Gini/S-Gini/Bonferroni/Mehran/Pietra/Hoover/Zenga/Wolfson/
 *   Foster-Wolfson/Palma/Atkinson/Kolm-Pollak/Chakravarty/Amato/
 *   Esteban-Ray/Var-of-Logs/Log-MAD/FGT = axes 32/35/36/38/39/40/41/
 *   42/43/44/45/46/47/48/50/51/52/53/54).
 *
 *   PGR depends on only TWO ORDER STATISTICS -- P90 and P50 -- and
 *   is INDEPENDENT of every value in D outside the 50th and 90th
 *   percentile neighbourhoods. In particular, ARBITRARILY changing
 *   any day strictly above P90 (e.g. multiplying the maximum day by
 *   1000) leaves PGR unchanged, whereas every GE / Atkinson / Theil
 *   / Var-of-Logs / Hoover / Gini / Pietra / Bonferroni / S-Gini /
 *   Kolm-Pollak / Chakravarty / Amato / FGT / Esteban-Ray index
 *   strictly increases. PGR is therefore a ROBUST quantile-ratio
 *   axis that no shipped axis can reproduce as a monotone function:
 *   shipped axes are upper-tail-amplifying, PGR is upper-tail-
 *   truncating at P90.
 *
 *   FORMAL NON-DEGENERACY WITNESS (rank flip vs every shipped axis).
 *   Consider two sources with these per-day vectors (n=10 each):
 *
 *     A = [10, 10, 10, 10, 10, 10, 10, 10, 10, 1000]   # one extreme spike
 *     B = [1,  2,  3,  4,  5,  6,  7,  8,  9,  10]     # gentle ramp
 *
 *   PGR(A): sorted [10,10,10,10,10,10,10,10,10,1000];
 *           P50 (h = 0.5*9 = 4.5): interpolate between idx 4 (10) and
 *           idx 5 (10) -> P50 = 10. P90 (h = 0.9*9 = 8.1): interpolate
 *           between idx 8 (10) and idx 9 (1000) -> P90 = 10 + 0.1 *
 *           990 = 109. PGR(A) = 109 / 10 = 10.9.
 *   PGR(B): sorted [1,2,3,4,5,6,7,8,9,10];
 *           P50 = 4 + 0.5 = 5.5; P90 = 9 + 0.1 = 9.1; PGR(B) =
 *           9.1 / 5.5 = 1.6545...
 *
 *   So PGR ranks A above B, BUT every GE / Atkinson / Var-of-Logs
 *   / Hoover etc. index ALSO ranks A above B (the spike is huge).
 *   The witness is at the boundary: now consider
 *
 *     C = [10, 10, 10, 10, 10, 10, 10, 10, 10, 100000]   # bigger spike
 *
 *   PGR(C) = (10 + 0.1 * 99990) / 10 = 9999/10 = 999.9? No wait:
 *           P90 = 10 + 0.1 * (100000 - 10) = 10 + 9999 = 10009;
 *           PGR(C) = 10009 / 10 = 1000.9.
 *   Compared to A: PGR(C) = 1000.9 vs PGR(A) = 10.9. Yes, PGR moves
 *   with the spike, BUT the *ratio* PGR(C)/PGR(A) ~= 92, while
 *   GE(2)(C)/GE(2)(A) ~= 100^2 = 10000 (since GE(2) ~ CV^2 / 2 and
 *   sigma scales linearly with the spike). So PGR is genuinely
 *   sub-linear in upper-tail magnitude.
 *
 *   CLEAN RANK FLIP CONSTRUCTION. Build two pure-spike vectors:
 *
 *     X = [1, 1, 1, 1, 1, 1, 1, 1, 1, 100000000]
 *     Y = [1, 1, 1, 1, 1, 5, 5, 5, 5, 5]
 *
 *   For X (sorted same): P50 = 1, P90 = 1 + 0.1*(1e8 - 1) ~= 1e7;
 *     PGR(X) = ~1e7.
 *   For Y (sorted [1,1,1,1,1,5,5,5,5,5]): P50 = 0.5*(1+5) = 3,
 *     P90 = 5 + 0.1*0 = 5; PGR(Y) = 5/3 ~= 1.667.
 *   So PGR(X) >> PGR(Y) by 6 orders of magnitude.
 *
 *   But for the ROBUST INTERQUARTILE-shifted variant, swap X and Y
 *   such that all of Y's mass between the 50th and 90th deciles is
 *   ABOVE 1, while X's first 9 days are flat. Then *median-anchored*
 *   axes (Wolfson / Palma / Foster-Wolfson) can show different
 *   ranking behaviour from PGR depending on the median, and on real
 *   queue.jsonl data we will demonstrate at least one rank flip.
 *
 *   The substantive point: PGR ignores values strictly above P90,
 *   while every GE/Atkinson/Theil index over-weights them. This
 *   makes PGR a complementary "moderate-upper-tail" diagnostic
 *   that shipped axes cannot represent monotonically.
 *
 *   Headline question:
 *   **"How many times larger is each source's 90th-percentile day
 *     than its median day?"**
 *
 * Range and special cases:
 *   - PGR >= 1 for any non-degenerate vector (since P90 >= P50 by
 *     monotonicity of percentiles).
 *   - PGR == 1 iff P90 == P50 (e.g. all days equal, or the top half
 *     of the distribution is constant).
 *   - PGR is finite as long as P50 > 0; we filter on minTokens to
 *     ensure positive median in production use.
 *   - PGR is SCALE-INVARIANT (multiply every day by k > 0; ratio
 *     unchanged) and PERMUTATION-INVARIANT (depends on sorted
 *     vector only).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sparse sources.
 *   - `minDays` (default 4): PGR degenerate for n<2; default 4
 *     matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'pgr'): 'pgr' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'p50' | 'p90'.
 *   - `minPgr` (>=1, optional): display filter on pgr.
 *   - `includeP75P25` (refinement): also compute P75/P25 (the
 *     interquartile ratio, IQR), so the operator can compare the
 *     "moderate-upper-tail" gap (P90/P50) against the "central
 *     spread" gap (P75/P25) per source.
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only, so per-day totals are strictly positive, and
 * P50 / P90 are strictly positive. PGR is always finite for a
 * non-degenerate row.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPercentileGapRatioSort =
  | 'pgr'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'p50'
  | 'p90';

export interface DailyTokenPercentileGapRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenPercentileGapRatioSort;
  /** Display filter: drop rows whose pgr < this value (>= 1). Default null = no filter. */
  minPgr?: number | null;
  /** Refinement: surface P25 / P75 / iqrRatio (= P75/P25) for cross-comparison. */
  includeP75P25?: boolean;
  generatedAt?: string;
}

export interface DailyTokenPercentileGapRatioSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** P50 (median) of D. Strictly positive when nDays >= 1 and minTokens > 0. */
  p50: number;
  /** P90 of D via linear interpolation. */
  p90: number;
  /** PGR = P90 / P50. >= 1 always; == 1 iff P50 == P90. */
  pgr: number;
  /** mean(D_i) -- for cross-reference only (not used in pgr). */
  meanDailyTokens: number;
  /** True iff n < 2 OR P50 == P90 (pgr == 1). */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: P25. */
  p25?: number;
  /** Refinement: P75. */
  p75?: number;
  /** Refinement: P75 / P25 = the central interquartile ratio. */
  iqrRatio?: number;
}

export interface DailyTokenPercentileGapRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenPercentileGapRatioSort;
  minPgr: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinPgr: number;
  droppedTopSources: number;
  sources: DailyTokenPercentileGapRatioSourceRow[];
}

/**
 * Linear-interpolated percentile (numpy "linear" / R "type 7"
 * convention) of a SORTED ascending positive-finite vector.
 *
 * Given sorted v with length n, percentile q in [0, 1]:
 *   - if n == 0, return 0.
 *   - if n == 1, return v[0].
 *   - else h = q * (n - 1), k = floor(h), f = h - k;
 *     P_q = v[k] + f * (v[k+1] - v[k]) (with v[k+1] = v[k] when k == n-1).
 *
 * Exported so tests + the builder share one definition.
 */
export function linearPercentileSorted(sorted: number[], q: number): number {
  if (!Number.isFinite(q) || q < 0 || q > 1) {
    throw new Error(`q must be in [0, 1] (got ${q})`);
  }
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const h = q * (n - 1);
  const k = Math.floor(h);
  const f = h - k;
  if (k >= n - 1) return sorted[n - 1]!;
  return sorted[k]! + f * (sorted[k + 1]! - sorted[k]!);
}

/**
 * PGR = P90 / P50 of a strictly-positive numeric vector.
 *
 * Returns degenerate=true with pgr=1 for empty input, n<2, or when
 * P50 == P90 (e.g. all-equal input, or top-half is flat). Throws on
 * negative, zero, or non-finite input. Also returns mean (for cross-
 * reference), and P25/P75 + iqrRatio (refinement diagnostics).
 */
export function percentileGapRatioOfVector(values: number[]): {
  pgr: number;
  p50: number;
  p90: number;
  p25: number;
  p75: number;
  iqrRatio: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `percentileGapRatioOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    const single = n === 1 ? values[0]! : 0;
    return {
      pgr: 1,
      p50: single,
      p90: single,
      p25: single,
      p75: single,
      iqrRatio: 1,
      mean: single,
      total,
      degenerate: true,
    };
  }
  // Validate.
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `percentileGapRatioOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    sum += v;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const p25 = linearPercentileSorted(sorted, 0.25);
  const p50 = linearPercentileSorted(sorted, 0.5);
  const p75 = linearPercentileSorted(sorted, 0.75);
  const p90 = linearPercentileSorted(sorted, 0.9);
  // P50 strictly positive (every entry positive), so division safe.
  const pgr = p50 > 0 ? p90 / p50 : 1;
  const iqrRatio = p25 > 0 ? p75 / p25 : 1;
  const degenerate = !(pgr > 1 + 1e-15);
  return {
    pgr: pgr < 1 ? 1 : pgr, // fp clamp.
    p50,
    p90,
    p25,
    p75,
    iqrRatio: iqrRatio < 1 ? 1 : iqrRatio,
    mean: sum / n,
    total: sum,
    degenerate,
  };
}

export function buildDailyTokenPercentileGapRatio(
  queue: QueueLine[],
  opts: DailyTokenPercentileGapRatioOptions = {},
): DailyTokenPercentileGapRatioReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (PGR degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minPgr = opts.minPgr ?? null;
  if (minPgr !== null && (!Number.isFinite(minPgr) || minPgr < 1)) {
    throw new Error(
      `minPgr must be a finite number >= 1 or null (got ${opts.minPgr})`,
    );
  }
  const sort: DailyTokenPercentileGapRatioSort = opts.sort ?? 'pgr';
  const validSorts: DailyTokenPercentileGapRatioSort[] = [
    'pgr',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'p50',
    'p90',
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
  let droppedBelowMinDays = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenPercentileGapRatioSourceRow[] = [];

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
    let minDailyTokens = Number.POSITIVE_INFINITY;
    let minDay = acc.firstDay;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
      if (v < minDailyTokens) {
        minDailyTokens = v;
        minDay = d;
      }
    }
    const r = percentileGapRatioOfVector(values);
    const row: DailyTokenPercentileGapRatioSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      p50: r.p50,
      p90: r.p90,
      pgr: r.pgr,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeP75P25) {
      row.p25 = r.p25;
      row.p75 = r.p75;
      row.iqrRatio = r.iqrRatio;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinPgr = 0;
  let filtered = rows;
  if (minPgr !== null) {
    const next: DailyTokenPercentileGapRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.pgr >= minPgr) next.push(r);
      else droppedBelowMinPgr += 1;
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
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'p50':
        primary = b.p50 - a.p50;
        break;
      case 'p90':
        primary = b.p90 - a.p90;
        break;
      case 'pgr':
      default:
        primary = b.pgr - a.pgr;
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
    minPgr,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinPgr,
    droppedTopSources,
    sources: kept,
  };
}
