/**
 * daily-token-decile-share-gap: per-source DECILE-SHARE GAP
 *
 *     DSG = (mass in top 10% of days  -  mass in bottom 10% of days) / total
 *
 * SIXTY-FIRST cross-source axis.
 *
 * For each source we collapse all hourly buckets into one scalar per
 * UTC day (D_d = sum of total_tokens on day d). Sort the resulting
 * day vector D = (D_1, ..., D_n) ascending. Let
 *
 *     k = ceil(0.10 * n)
 *     bottomMass = sum of the SMALLEST k values
 *     topMass    = sum of the LARGEST  k values
 *     total      = sum(D)
 *     DSG        = (topMass - bottomMass) / total
 *
 * DSG is the SIGNED ANTI-LORENZ DECILE PRIMITIVE: it asks how much
 * more total daily-token mass lives in the busiest tenth of days than
 * in the quietest tenth. It is dimensionless, in [0, 1], and reaches
 * 0 ONLY when the two decile masses are equal (which forces the
 * extreme deciles to be flat).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..60):
 *
 *   - axes 32..57 are MOMENT- or LORENZ-functional summaries (Gini,
 *     S-Gini, Atkinson, Theil, GE family at alpha in {-1,0,1/2,1,2,3,4},
 *     Hoover, Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson,
 *     Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, Var-of-Logs,
 *     Log-MAD, FGT). Each integrates over the FULL Lorenz curve or
 *     the FULL distribution and is normalised by the MEAN. DSG uses
 *     ONLY the two extreme deciles' MASS (a sparse linear functional)
 *     and is normalised by the TOTAL, not the mean per row.
 *   - axis 58 (PGR = P90/P50) is a TAIL-VS-MEDIAN ratio of percentile
 *     VALUES.
 *   - axis 59 (IOM = (P75-P25)/P50) is a CENTRAL-VS-MEDIAN ratio of
 *     percentile VALUES.
 *   - axis 60 (MSR = (P75-P25)/(P90-P10)) is a SHAPE ratio of
 *     percentile VALUES, normalised by another percentile-value
 *     spread.
 *   - DSG (this axis, 61) is built from MASS SUMS of the two extreme
 *     deciles, not from percentile VALUES, and uses NO DIVISION
 *     between order statistics. It is ADDITIVE in the day vector
 *     (numerator and denominator both scale linearly under k * D),
 *     making it a pure LINEAR FUNCTIONAL of the sorted day vector
 *     (a closed-cone structure that no value-ratio axis 58/59/60 has).
 *   - DSG is INVARIANT to ANY change in the central 80% of days
 *     (positions strictly between rank ceil(0.10*n) and n -
 *     ceil(0.10*n) + 1) that preserves the total sum. By contrast
 *     Hoover (axis 36) is invariant to changes that don't cross the
 *     mean -- a totally different threshold (the mean, not the 10%
 *     rank), and Hoover's threshold is VALUE-based, not RANK-based.
 *
 * RANK-FLIP WITNESS vs axis-36 Hoover. Construct two day vectors of
 * length 10:
 *
 *   A = [1, 2, 2, 2, 2, 2, 2, 2, 2, 11]
 *     k = ceil(0.10 * 10) = 1
 *     bottomMass = 1; topMass = 11; total = 28
 *     DSG(A) = (11 - 1) / 28 = 10/28 = 0.357142857...
 *     mean(A) = 2.8; Hoover(A) = 0.5 * sum |D_i - mean| / sum D_i
 *       deviations: |1-2.8|+|2-2.8|*8+|11-2.8| = 1.8+6.4+8.2 = 16.4
 *       Hoover = 0.5 * 16.4 / 28 = 8.2/28 = 0.292857...
 *
 *   B = [1, 1, 1, 1, 5, 5, 5, 5, 9, 9]
 *     k = 1
 *     bottomMass = 1; topMass = 9; total = 42
 *     DSG(B) = (9 - 1) / 42 = 8/42 = 0.190476...
 *     mean(B) = 4.2; Hoover deviations:
 *       |1-4.2|*4 + |5-4.2|*4 + |9-4.2|*2
 *       = 12.8 + 3.2 + 9.6 = 25.6
 *     Hoover = 0.5 * 25.6 / 42 = 12.8/42 = 0.304761...
 *
 *   DSG ranks A > B (0.357 > 0.190): A's single "spike day" of 11
 *   dominates one full extreme decile vs B's smaller decile-spike of
 *   9. Hoover ranks B > A (0.305 > 0.293): B has more total deviation
 *   from its (higher) mean across the body of days, even though its
 *   tail-decile gap is narrower. This is a genuine flip: no monotone
 *   transform recovers Hoover from DSG (Hoover's threshold is the
 *   mean, DSG's is the rank-decile boundary).
 *
 * RANK-FLIP WITNESS vs axis-60 MSR (verified on the same A/B pair):
 *   For A, sorted: P10=v[1]=2, P25=2, P50=2, P75=2, P90=v[8]=2.
 *     IQR = 0, IDR = 0, MSR = 0 (degenerate -- tight body of 2's).
 *   For B, sorted: P10=v[1]=1, P25 (h=2.25)=1, P50=5, P75 (h=6.75)=5,
 *     P90=v[8]=9. IQR=4, IDR=8, MSR=0.5.
 *   So MSR ranks B > A (0.5 > 0 with A degenerate); DSG ranks A > B.
 *   Real flip, since DSG and MSR look at orthogonal facets of the day
 *   vector (mass-of-extreme-deciles vs spread-of-central-percentiles).
 *
 *   Headline question:
 *   **"How much more total daily-token mass lives in each source's
 *     busiest 10% of days than in its quietest 10% of days?"**
 *
 * Range and special cases:
 *   - 0 <= DSG <= 1 always (topMass >= bottomMass since the top k of
 *     the sorted vector are >= the bottom k; total > 0).
 *   - DSG == 0 iff the smallest k values sum equals the largest k
 *     values sum (which on a sorted vector forces all k pairs equal
 *     -- in particular the entire vector is constant when 2k >= n).
 *     Marked degenerate=true.
 *   - DSG == 1 iff bottomMass == 0 (impossible here: per-day totals
 *     are strictly positive). The maximum attainable DSG is
 *     1 - 2k * minDay / total, approached but not reached.
 *   - DSG is SCALE-INVARIANT (multiply every D_d by c > 0; numerator
 *     and denominator both scale by c).
 *   - DSG is PERMUTATION-INVARIANT (depends on the sorted vector).
 *   - DSG is ADDITIVE in mass (numerator is a mass sum, not a value
 *     ratio); this makes it a pure LINEAR functional of the sorted
 *     day vector. No shipped axis 32..60 has this structure.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sparse sources.
 *   - `minDays` (default 4): DSG requires k = ceil(0.10*n) >= 1 and
 *     a non-empty body (n - 2k >= 0), so n >= 2 is the algebraic
 *     minimum; default 4 matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'dsg'): 'dsg' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'topMass' | 'bottomMass' | 'k'.
 *   - `minDsg` (>=0, optional): display filter on dsg.
 *   - `includeHoover` (refinement): also surface Hoover index in the
 *     same row for cross-axis comparison vs axis 36.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10]:
 *   k = ceil(0.10 * 10) = 1
 *   sorted: [1,2,3,4,5,6,7,8,9,10]
 *   bottomMass = 1; topMass = 10; total = 55
 *   DSG = (10 - 1) / 55 = 9/55 = 0.16363636...
 * Reproduced exactly by `decileShareGapOfVector([1..10])` in tests.
 */
import type { QueueLine } from './types.js';

export type DailyTokenDecileShareGapSort =
  | 'dsg'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'topMass'
  | 'bottomMass'
  | 'k';

export interface DailyTokenDecileShareGapOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenDecileShareGapSort;
  /** Display filter: drop rows whose dsg < this value (>= 0). Default null = no filter. */
  minDsg?: number | null;
  /** Refinement: surface Hoover (axis 36) alongside DSG for cross-axis comparison. */
  includeHoover?: boolean;
  generatedAt?: string;
}

export interface DailyTokenDecileShareGapSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** k = ceil(0.10 * nDays); the size of each extreme decile. */
  k: number;
  /** Sum of the smallest k daily totals. */
  bottomMass: number;
  /** Sum of the largest k daily totals. */
  topMass: number;
  /** topMass / total in [0, 1]. */
  topShare: number;
  /** bottomMass / total in [0, 1]. */
  bottomShare: number;
  /** DSG = (topMass - bottomMass) / total in [0, 1). */
  dsg: number;
  /** mean(D_i) -- for cross-reference only (not used in dsg). */
  meanDailyTokens: number;
  /** True iff n < 2 OR bottomMass == topMass (the extreme deciles are balanced). */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Hoover index = 0.5 * sum |D_i - mean| / sum D_i (only set when includeHoover=true). */
  hoover?: number;
}

export interface DailyTokenDecileShareGapReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenDecileShareGapSort;
  minDsg: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinDsg: number;
  droppedTopSources: number;
  sources: DailyTokenDecileShareGapSourceRow[];
}

/**
 * DSG = (topMass - bottomMass) / total of a strictly-positive numeric
 * vector, where topMass = sum of the largest ceil(0.10*n) values and
 * bottomMass = sum of the smallest ceil(0.10*n) values.
 *
 * Returns degenerate=true with dsg=0 for empty input or n<2; with
 * dsg=0 when topMass == bottomMass (the extreme deciles are balanced).
 * Throws on negative, zero, or non-finite input. Also returns mean
 * and Hoover (= 0.5 * sum |D_i - mean| / sum) for cross-reference.
 */
export function decileShareGapOfVector(values: number[]): {
  dsg: number;
  k: number;
  bottomMass: number;
  topMass: number;
  topShare: number;
  bottomShare: number;
  hoover: number;
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
          `decileShareGapOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    const single = n === 1 ? values[0]! : 0;
    return {
      dsg: 0,
      k: n,
      bottomMass: single,
      topMass: single,
      topShare: n === 1 ? 1 : 0,
      bottomShare: n === 1 ? 1 : 0,
      hoover: 0,
      mean: single,
      total,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `decileShareGapOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.1 * n));
  // k may exceed floor(n/2) for very small n; in that case top and
  // bottom slabs overlap and necessarily produce dsg = 0 (degenerate).
  let bottomMass = 0;
  for (let i = 0; i < k; i += 1) bottomMass += sorted[i]!;
  let topMass = 0;
  for (let i = n - k; i < n; i += 1) topMass += sorted[i]!;
  let dsg: number;
  if (total <= 0) {
    dsg = 0;
  } else {
    const raw = (topMass - bottomMass) / total;
    dsg = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }
  const mean = total / n;
  let absDev = 0;
  for (const v of values) absDev += Math.abs(v - mean);
  const hoover = total > 0 ? (0.5 * absDev) / total : 0;
  const balancedExtremes = !(topMass - bottomMass > 1e-15);
  const degenerate = balancedExtremes;
  const topShare = total > 0 ? topMass / total : 0;
  const bottomShare = total > 0 ? bottomMass / total : 0;
  return {
    dsg,
    k,
    bottomMass,
    topMass,
    topShare,
    bottomShare,
    hoover: hoover < 0 ? 0 : hoover,
    mean,
    total,
    degenerate,
  };
}

export function buildDailyTokenDecileShareGap(
  queue: QueueLine[],
  opts: DailyTokenDecileShareGapOptions = {},
): DailyTokenDecileShareGapReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (DSG degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minDsg = opts.minDsg ?? null;
  if (minDsg !== null && (!Number.isFinite(minDsg) || minDsg < 0)) {
    throw new Error(
      `minDsg must be a finite number >= 0 or null (got ${opts.minDsg})`,
    );
  }
  const sort: DailyTokenDecileShareGapSort = opts.sort ?? 'dsg';
  const validSorts: DailyTokenDecileShareGapSort[] = [
    'dsg',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'topMass',
    'bottomMass',
    'k',
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
  const rows: DailyTokenDecileShareGapSourceRow[] = [];

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
    const r = decileShareGapOfVector(values);
    const row: DailyTokenDecileShareGapSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      k: r.k,
      bottomMass: r.bottomMass,
      topMass: r.topMass,
      topShare: r.topShare,
      bottomShare: r.bottomShare,
      dsg: r.dsg,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeHoover) {
      row.hoover = r.hoover;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinDsg = 0;
  let filtered = rows;
  if (minDsg !== null) {
    const next: DailyTokenDecileShareGapSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.dsg >= minDsg) next.push(r);
      else droppedBelowMinDsg += 1;
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
      case 'topMass':
        primary = b.topMass - a.topMass;
        break;
      case 'bottomMass':
        primary = b.bottomMass - a.bottomMass;
        break;
      case 'k':
        primary = b.k - a.k;
        break;
      case 'dsg':
      default:
        primary = b.dsg - a.dsg;
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
    minDsg,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinDsg,
    droppedTopSources,
    sources: kept,
  };
}
