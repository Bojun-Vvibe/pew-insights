/**
 * daily-token-mad-over-median: per-source MEDIAN-ABSOLUTE-DEVIATION /
 * MEDIAN of the per-day total_tokens distribution.
 *
 *     MADM = MAD / median            where
 *     median = P50(D)                (linear-interpolation, R type 7)
 *     MAD    = median_i |D_i - median(D)|
 *
 * SIXTY-THIRD cross-source axis.
 *
 * For each source we collapse all hourly buckets into one scalar per
 * UTC day (D_d = sum of total_tokens on day d). MADM is the
 * dimensionless ROBUST scale-shape statistic of the day vector.
 *
 * Range: [0, +inf). MADM = 0 iff strictly more than half of the days
 * carry the median value (the inner median of |D_i - median| is then 0).
 * In the limit a single day dominates an otherwise tiny floor, MADM
 * grows without bound. MADM is scale-invariant and permutation-invariant.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..62):
 *
 *   - axes 32..57 (Gini, S-Gini, Atkinson, Theil-L/T, GE family,
 *     Hoover, Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson,
 *     Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray,
 *     Var-of-Logs, Log-MAD, FGT) are MOMENT- or LORENZ-functional
 *     summaries that integrate over the FULL distribution and divide
 *     by the MEAN. They have BREAKDOWN POINT 1/n -- a single outlier
 *     day moves them substantially. MADM has BREAKDOWN POINT 0.5
 *     (Hampel's robust scale): up to floor((n-1)/2) days can be
 *     replaced by arbitrarily large values without moving MADM at
 *     all. That is a strictly different functional class.
 *
 *   - axis 58 PGR = P90/P50 and axis 60 MSR = (P75-P25)/(P90-P10)
 *     are RATIOS OF PERCENTILE VALUES. PGR carries upper-tail
 *     information; MSR is a tail-vs-body shape ratio. MADM averages
 *     ABSOLUTE DEVIATIONS (a non-percentile pair) and then takes
 *     their MEDIAN -- a doubly-robust functional with no rank-cut
 *     at all.
 *
 *   - axis 59 IOM = (P75-P25)/P50 is the closest cousin: both are
 *     scale statistics normalised by the median. But IQR has
 *     BREAKDOWN POINT 0.25 (the upper or lower 25% of days both
 *     contribute), MAD has BREAKDOWN POINT 0.5. For symmetric
 *     distributions IQR/median ~ 1.349 * MAD/median (Gaussian
 *     consistency), but for asymmetric / heavy-tailed day vectors
 *     the two diverge -- IOM is sensitive to which side of the
 *     median the spread sits on, MADM folds both sides through the
 *     absolute value before taking the inner median, so it is
 *     SIGN-AGNOSTIC AROUND THE MEDIAN.
 *
 *   - axis 61 DSG = (top10 mass - bot10 mass)/total is a sparse
 *     LINEAR functional of the EXTREME deciles, normalised by total
 *     (not by a center). MADM ignores extremes by construction.
 *
 *   - axis 62 QSR = topMass / bottomMass on the QUINTILE cut is a
 *     RATIO OF MASS SUMS from the EXTREME quintiles, hyperbolic in
 *     bottomMass and unbounded above. MADM is built from CENTRAL
 *     order statistics (the inner median of |D_i - median|) and
 *     unbounded for an opposite reason: it grows when the median
 *     itself shrinks toward zero relative to typical absolute
 *     deviations, i.e. when the central body is small relative to
 *     its own spread, NOT when the extreme tails are heavy.
 *
 *   - QCD (`source-row-token-coefficient-of-quartile-deviation`),
 *     Gini coefficient on row tokens, etc. operate on the per-row
 *     (per-bucket) distribution, NOT on per-day collapsed totals.
 *     `source-row-token-mad` is the MAD of per-row tokens, again
 *     not collapsed per day. MADM is unique on the per-source
 *     PER-DAY axis.
 *
 * Headline question:
 * **"For each source, how large is the typical day-to-day fluctuation
 *   from the median day, expressed as a multiple of the median day
 *   itself?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 5): MAD is degenerate for n < 2; the
 *     default 5 keeps the inner median nontrivial.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'madm'): 'madm' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'medianDaily' | 'mad'.
 *   - `minMadm`: display filter; degenerate (median=0) rows always
 *     retained.
 *   - `includeIom` (refinement): every row gains
 *     `iom = (P75-P25)/median` and the dimensionless ratio
 *     `iomOverMadm = IOM / MADM` for cross-axis comparison vs
 *     axis 59 (IOM = (P75-P25)/P50). Under symmetric Gaussian
 *     daily totals the ratio is ~1.349; departures from that
 *     witness real asymmetric / heavy-tailed shape.
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';
import { iqrOverMedianOfVector } from './dailytokeniqrovermedian.js';

export type DailyTokenMadOverMedianSort =
  | 'madm'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'medianDaily'
  | 'mad';

export interface DailyTokenMadOverMedianOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMadOverMedianSort;
  /** Display filter: drop rows whose `madm` is strictly below this value. 0 = no filter. */
  minMadm?: number | null;
  /**
   * Refinement (v0.6.307): when true, every emitted row gains an
   * `iom` value (= (P75-P25)/median, axis 59) and the
   * `iomOverMadm = iom / madm` ratio for cross-axis comparison.
   * Pure compute; no extra I/O.
   */
  includeIom?: boolean;
  generatedAt?: string;
}

export interface DailyTokenMadOverMedianSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Per-day P50 under linear interpolation (R type 7). */
  medianDaily: number;
  /** median_i |D_i - median(D)|. In TOKEN units. */
  mad: number;
  /** mad / medianDaily. In [0, +inf). 0 iff > n/2 days equal the median. */
  madm: number;
  /** Mean per-day total_tokens (totalTokens / nDays). */
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * True iff `medianDaily` is 0 (cannot normalise) -- pathological
   * on strictly-positive per-day totals but guarded.
   */
  degenerate: boolean;
  /** Refinement: surfaced iff includeIom. */
  iom?: number;
  /** Refinement: iom/madm. Surfaced iff includeIom and madm > 0. */
  iomOverMadm?: number;
}

export interface DailyTokenMadOverMedianReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMadOverMedianSort;
  minMadm: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinMadm: number;
  droppedTopSources: number;
  /** Echo of the includeIom knob. */
  includeIom: boolean;
  sources: DailyTokenMadOverMedianSourceRow[];
}

/**
 * Linear-interpolation (numpy 'linear' / R type 7) percentile of a
 * pre-sorted ascending vector.
 */
function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/**
 * MAD / median primitive. Returns the median, the MAD, and the
 * MADM ratio.
 *
 * Throws on negative or non-finite input. Returns `degenerate: true`
 * for n < 2 or all-zero input.
 */
export function madOverMedianOfVector(values: number[]): {
  median: number;
  mad: number;
  madm: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    return { median: n === 1 ? values[0]! : 0, mad: 0, madm: 0, degenerate: true };
  }
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `madOverMedianOfVector requires non-negative finite values (got ${v})`,
      );
    }
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const median = percentileSorted(sorted, 50);
  const absDev: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) absDev[i] = Math.abs(values[i]! - median);
  absDev.sort((a, b) => a - b);
  const mad = percentileSorted(absDev, 50);
  if (!(median > 0)) {
    return { median, mad, madm: 0, degenerate: true };
  }
  return { median, mad, madm: mad / median, degenerate: false };
}

export function buildDailyTokenMadOverMedian(
  queue: QueueLine[],
  opts: DailyTokenMadOverMedianOptions = {},
): DailyTokenMadOverMedianReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (MAD is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minMadm = opts.minMadm ?? null;
  if (minMadm !== null && (!Number.isFinite(minMadm) || minMadm < 0)) {
    throw new Error(
      `minMadm must be a non-negative finite number when set (got ${opts.minMadm})`,
    );
  }
  const sort: DailyTokenMadOverMedianSort = opts.sort ?? 'madm';
  const validSorts: DailyTokenMadOverMedianSort[] = [
    'madm',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'medianDaily',
    'mad',
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
  const rows: DailyTokenMadOverMedianSourceRow[] = [];

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
    const r = madOverMedianOfVector(values);
    const row: DailyTokenMadOverMedianSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      medianDaily: r.median,
      mad: r.mad,
      madm: r.madm,
      meanDailyTokens: acc.totalTokens / nDays,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
      degenerate: r.degenerate,
    };
    if (opts.includeIom) {
      const iqr = iqrOverMedianOfVector(values);
      row.iom = iqr.iom;
      row.iomOverMadm = r.madm > 0 ? iqr.iom / r.madm : 0;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinMadm = 0;
  let filtered = rows;
  if (minMadm !== null && minMadm > 0) {
    const next: DailyTokenMadOverMedianSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.madm >= minMadm) next.push(r);
      else droppedBelowMinMadm += 1;
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
      case 'medianDaily':
        primary = b.medianDaily - a.medianDaily;
        break;
      case 'mad':
        primary = b.mad - a.mad;
        break;
      case 'madm':
      default:
        primary = b.madm - a.madm;
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
    minMadm,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinMadm,
    droppedTopSources,
    includeIom: opts.includeIom ?? false,
    sources: kept,
  };
}
