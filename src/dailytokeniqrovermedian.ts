/**
 * daily-token-iqr-over-median: per-source MEDIAN-NORMALIZED INTERQUARTILE
 * SPREAD (P75 - P25) / P50 of the per-day total_tokens distribution.
 * FIFTY-NINTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and summarise the
 * resulting day vector D = (D_1, ..., D_n) by the dimensionless
 * central-spread observable
 *
 *     IOM = (P75(D) - P25(D)) / P50(D),
 *
 * where P_q(D) is the q-th sample percentile under the standard
 * linear interpolation rule (numpy "linear" / R "type 7"):
 *
 *     given sorted D, with h = q * (n - 1), let k = floor(h) and
 *     f = h - k. Then P_q = D_sorted[k] + f * (D_sorted[k+1] - D_sorted[k]).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..58):
 *
 *   - axes 32..57 are MOMENT- or LORENZ-functional summaries (GE
 *     family at alpha in {-1,0,1/2,1,2,3,4}; Gini, S-Gini, Bonferroni,
 *     Mehran, Pietra, Hoover, Zenga, Wolfson, Foster-Wolfson, Palma,
 *     Atkinson, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray,
 *     Var-of-Logs, Log-MAD, FGT). Each integrates over the FULL
 *     distribution.
 *   - axis 58 (PGR = P90/P50) depends on TWO ORDER STATISTICS in the
 *     UPPER half (P50, P90) and is invariant to changes strictly above
 *     P90.
 *   - IOM (this axis, 59) depends on THREE ORDER STATISTICS spanning
 *     the CENTRAL HALF of the distribution (P25, P50, P75) and is
 *     invariant to changes strictly above P75 OR strictly below P25.
 *     It carries NO information about either tail. This is the
 *     COMPLEMENT of PGR's information geometry: PGR sees the upper
 *     decile gap, IOM sees only the central body.
 *
 * RANK-FLIP WITNESS vs axis-58 (PGR). Construct two day vectors:
 *
 *     A = [1, 1, 1, 5, 5, 5, 5, 5, 9, 9, 9]    # tight body, hard step
 *     B = [3, 4, 4, 5, 5, 5, 5, 5, 5, 6, 7]    # wide body, no step
 *
 *   Sorted A = [1,1,1,5,5,5,5,5,9,9,9] (n=11):
 *     P25 (h=2.5): v[2]+0.5*(v[3]-v[2]) = 1 + 0.5*4 = 3
 *     P50 (h=5.0): v[5] = 5
 *     P75 (h=7.5): v[7]+0.5*(v[8]-v[7]) = 5 + 0.5*4 = 7
 *     P90 (h=9.0): v[9] = 9
 *     IOM(A) = (7 - 3) / 5 = 0.8
 *     PGR(A) = 9 / 5 = 1.8
 *
 *   Sorted B = [3,4,4,5,5,5,5,5,5,6,7] (n=11):
 *     P25 (h=2.5): 4 + 0.5*(5-4) = 4.5
 *     P50: v[5] = 5
 *     P75 (h=7.5): 5 + 0.5*(5-5) = 5
 *     P90 (h=9.0): v[9] = 6
 *     IOM(B) = (5 - 4.5) / 5 = 0.1
 *     PGR(B) = 6 / 5 = 1.2
 *
 *   Both axes rank A > B here. Now the FLIP construction:
 *
 *     C = [1, 1, 1, 1, 5, 5, 5, 9, 9, 9, 9]    # bimodal, top-heavy
 *     D = [1, 3, 3, 3, 4, 5, 6, 7, 7, 7, 9]    # smooth ramp
 *
 *   Sorted C = [1,1,1,1,5,5,5,9,9,9,9] (n=11):
 *     P25 (h=2.5): 1 + 0.5*0 = 1
 *     P50: v[5] = 5
 *     P75 (h=7.5): 9 + 0.5*0 = 9
 *     P90 (h=9.0): v[9] = 9
 *     IOM(C) = (9 - 1) / 5 = 1.6
 *     PGR(C) = 9 / 5 = 1.8
 *
 *   Sorted D = [1,3,3,3,4,5,6,7,7,7,9] (n=11):
 *     P25 (h=2.5): 3 + 0.5*0 = 3
 *     P50: v[5] = 5
 *     P75 (h=7.5): 7 + 0.5*0 = 7
 *     P90 (h=9.0): v[9] = 7
 *     IOM(D) = (7 - 3) / 5 = 0.8
 *     PGR(D) = 7 / 5 = 1.4
 *
 *   Both rank C > D. The genuine FLIP is between IOM and the
 *   upper-tail-amplifying GE family. Consider:
 *
 *     P = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000]   # one extreme spike
 *     Q = [1, 1, 1, 5, 5, 5, 5, 5, 9, 9, 9]      # tight body, hard step
 *
 *   Sorted P (n=11): P25=1, P50=1, P75=1 (P25..P75 all equal to 1
 *     because v[2]=v[5]=v[7]=1), P90 (h=9) = 1, max=1000.
 *     IOM(P) = (1 - 1) / 1 = 0   (DEGENERATE)
 *     PGR(P) = 1 / 1 = 1         (DEGENERATE)
 *     GE(2)(P) = (mean(x_i^2) / mean(x_i)^2 - 1) / 2
 *       mean = (10 + 1000)/11 = 91.818...; mean^2 = 8430.6
 *       mean(x^2) = (10 + 1000000)/11 = 90910.0
 *       GE(2) = (90910.0 / 8430.6 - 1) / 2 = (10.783 - 1)/2 = 4.892
 *
 *   For Q: IOM(Q) = 0.8 (computed above), GE(2)(Q) << GE(2)(P)
 *     (small spike vs huge spike). So the rank flip is
 *     IOM(Q) > IOM(P) (0.8 vs 0), while GE(2)(P) >> GE(2)(Q). And
 *     IOM(Q) > PGR(Q)-ranking-style story too: Q has central body
 *     spread, P has one tail spike with no body spread.
 *
 *   The substantive point: IOM is invariant to ALL tail mass strictly
 *   outside [P25, P75]. Any source whose mass is concentrated in tail
 *   spikes (with a flat central body) registers as IOM = 0
 *   "degenerate" even though every shipped GE/Atkinson/Theil/Var-of-
 *   Logs index, AND the PGR axis (58), would call it heavily unequal.
 *   Conversely, a source with a tight tail but spread central body has
 *   IOM > 0 while PGR / GE-family register near-equality.
 *
 *   Headline question:
 *   **"How wide is each source's central-50% daily-token band, as a
 *     fraction of its median day?"**
 *
 * Range and special cases:
 *   - IOM >= 0 always (since P75 >= P25 and P50 > 0 under our
 *     positive-tokens filter).
 *   - IOM == 0 iff P25 == P75 (the central 50% of days is constant).
 *     Marked degenerate=true.
 *   - IOM has no upper bound (unbounded above): a source whose
 *     central body has huge spread relative to its median has large
 *     IOM. Empirically on token data we see IOM in roughly [0, 10].
 *   - IOM is SCALE-INVARIANT (multiply every day by k > 0; ratio
 *     unchanged) and PERMUTATION-INVARIANT (depends on sorted vector
 *     only).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sparse sources.
 *   - `minDays` (default 4): IOM degenerate for n<2 (and uninformative
 *     for n<4 since the quartiles collapse). Default 4 matches the
 *     daily-token axis family.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'iom'): 'iom' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'p50' | 'iqrAbsolute'.
 *   - `minIom` (>=0, optional): display filter on iom.
 *   - `includePgr` (refinement): also compute the upper-tail gap
 *     PGR = P90/P50 for cross-axis comparison in the same row.
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only, so per-day totals are strictly positive, P50 > 0,
 * and IOM is finite for every row that survives the minTokens filter.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10]:
 *   P25 = 3 + 0.25 = 3.25
 *   P50 = 5 + 0.5  = 5.5
 *   P75 = 7 + 0.75 = 7.75
 *   IOM = (7.75 - 3.25) / 5.5 = 4.5 / 5.5 = 0.81818181...
 * Reproduced exactly by `iqrOverMedianOfVector([1..10])` in tests.
 */
import type { QueueLine } from './types.js';
import { linearPercentileSorted } from './dailytokenpercentilegapratio.js';

export type DailyTokenIqrOverMedianSort =
  | 'iom'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'p50'
  | 'iqrAbsolute';

export interface DailyTokenIqrOverMedianOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenIqrOverMedianSort;
  /** Display filter: drop rows whose iom < this value (>= 0). Default null = no filter. */
  minIom?: number | null;
  /** Refinement: surface PGR = P90/P50 alongside IOM for cross-axis comparison. */
  includePgr?: boolean;
  generatedAt?: string;
}

export interface DailyTokenIqrOverMedianSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** P25 of D (linear-interp). */
  p25: number;
  /** P50 (median) of D. Strictly positive when minTokens > 0 enforced. */
  p50: number;
  /** P75 of D (linear-interp). */
  p75: number;
  /** Absolute IQR = P75 - P25 (>= 0). */
  iqrAbsolute: number;
  /** IOM = (P75 - P25) / P50. >= 0 always; == 0 iff P25 == P75. */
  iom: number;
  /** mean(D_i) -- for cross-reference only (not used in iom). */
  meanDailyTokens: number;
  /** True iff n < 2 OR P25 == P75 (iom == 0). */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: P90 (only set when includePgr=true). */
  p90?: number;
  /** Refinement: PGR = P90/P50 (only set when includePgr=true). */
  pgr?: number;
}

export interface DailyTokenIqrOverMedianReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenIqrOverMedianSort;
  minIom: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinIom: number;
  droppedTopSources: number;
  sources: DailyTokenIqrOverMedianSourceRow[];
}

/**
 * IOM = (P75 - P25) / P50 of a strictly-positive numeric vector.
 *
 * Returns degenerate=true with iom=0 for empty input, n<2, or when
 * P25 == P75 (e.g. all-equal input, or central-50 is flat). Throws on
 * negative, zero, or non-finite input. Also returns mean and PGR
 * (= P90/P50) for cross-reference.
 */
export function iqrOverMedianOfVector(values: number[]): {
  iom: number;
  iqrAbsolute: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  pgr: number;
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
          `iqrOverMedianOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    const single = n === 1 ? values[0]! : 0;
    return {
      iom: 0,
      iqrAbsolute: 0,
      p25: single,
      p50: single,
      p75: single,
      p90: single,
      pgr: 1,
      mean: single,
      total,
      degenerate: true,
    };
  }
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `iqrOverMedianOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    sum += v;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const p25 = linearPercentileSorted(sorted, 0.25);
  const p50 = linearPercentileSorted(sorted, 0.5);
  const p75 = linearPercentileSorted(sorted, 0.75);
  const p90 = linearPercentileSorted(sorted, 0.9);
  const iqrAbsolute = p75 - p25;
  const iom = p50 > 0 ? iqrAbsolute / p50 : 0;
  const pgr = p50 > 0 ? p90 / p50 : 1;
  const degenerate = !(iom > 1e-15);
  return {
    iom: iom < 0 ? 0 : iom,
    iqrAbsolute: iqrAbsolute < 0 ? 0 : iqrAbsolute,
    p25,
    p50,
    p75,
    p90,
    pgr: pgr < 1 ? 1 : pgr,
    mean: sum / n,
    total: sum,
    degenerate,
  };
}

export function buildDailyTokenIqrOverMedian(
  queue: QueueLine[],
  opts: DailyTokenIqrOverMedianOptions = {},
): DailyTokenIqrOverMedianReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (IOM degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minIom = opts.minIom ?? null;
  if (minIom !== null && (!Number.isFinite(minIom) || minIom < 0)) {
    throw new Error(
      `minIom must be a finite number >= 0 or null (got ${opts.minIom})`,
    );
  }
  const sort: DailyTokenIqrOverMedianSort = opts.sort ?? 'iom';
  const validSorts: DailyTokenIqrOverMedianSort[] = [
    'iom',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'p50',
    'iqrAbsolute',
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
  const rows: DailyTokenIqrOverMedianSourceRow[] = [];

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
    const r = iqrOverMedianOfVector(values);
    const row: DailyTokenIqrOverMedianSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      p25: r.p25,
      p50: r.p50,
      p75: r.p75,
      iqrAbsolute: r.iqrAbsolute,
      iom: r.iom,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includePgr) {
      row.p90 = r.p90;
      row.pgr = r.pgr;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinIom = 0;
  let filtered = rows;
  if (minIom !== null) {
    const next: DailyTokenIqrOverMedianSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.iom >= minIom) next.push(r);
      else droppedBelowMinIom += 1;
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
      case 'iqrAbsolute':
        primary = b.iqrAbsolute - a.iqrAbsolute;
        break;
      case 'iom':
      default:
        primary = b.iom - a.iom;
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
    minIom,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinIom,
    droppedTopSources,
    sources: kept,
  };
}
