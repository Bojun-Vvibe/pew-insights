/**
 * daily-token-wolfson-polarization-index: per-source WOLFSON
 * BIPOLARIZATION INDEX (Wolfson 1994, "When inequalities diverge")
 * of the per-day total_tokens distribution. FORTY-SIXTH cross-source
 * axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Wolfson
 * bipolarization index:
 *
 *     W = (mu / m) * (2 * T - G)
 *
 *   where
 *     mu        = mean(D)
 *     m         = median(D)
 *     L(0.5)    = Lorenz curve evaluated at the 50% population rank
 *                 (cumulative income share of the bottom half)
 *     T         = 0.5 - L(0.5)        (half-Lorenz GAP at the median)
 *     G         = Gini(D)             (axis-32 functional)
 *
 *   Sign of W:
 *     W >  0  the distribution is MORE BIPOLARIZED than the
 *             "balanced-around-the-median" baseline G/2 (mass
 *             pulled away from the median into the two tails).
 *     W == 0  bipolarization matches the within-Gini baseline.
 *     W <  0  ANTI-polarization; distribution is more concentrated
 *             AROUND the median than would be expected from its
 *             overall Gini (rare in heavy-tailed real data).
 *
 *   Wolfson's measure is FUNDAMENTALLY DISTINCT from every prior
 *   inequality axis (Gini, Bonferroni, Mehran, Atkinson, GE family,
 *   Theil, Pietra, Hoover, Palma, FGT, Kolm-Pollak, Zenga). All of
 *   those measure DISPERSION FROM THE MEAN (or single-point Lorenz
 *   gaps). Wolfson measures CONCENTRATION AWAY FROM THE MEDIAN -
 *   bipolarization, not inequality. Two distributions can have
 *   identical Gini and yet wildly different Wolfson values when the
 *   bulk mass migrates between "around the median" and "split into
 *   two tails".
 *
 *   Headline question:
 *   **"For each source, how much MORE is per-day token mass pulled
 *     AWAY FROM THE MEDIAN (into the two tails) than its overall
 *     inequality alone would imply?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-45):
 *
 *   axis-32 daily-token-gini-coefficient: Gini measures dispersion
 *     from the MEAN via the Lorenz integral. Wolfson uses Gini as
 *     ONE input but subtracts it from twice the half-Lorenz median
 *     gap and re-scales by mu/m. Two equal-Gini vectors can have
 *     opposite-sign Wolfson values when bulk mass shifts between
 *     "around the median" and "split into tails".
 *   axis-33 daily-token-theil-l-index / axis-34 daily-token-theil-t-
 *     index / axis-37 daily-token-ge2-index: GE(alpha) family is
 *     entirely moment-based on shares; no median in the formula.
 *     Wolfson is a median-anchored two-point Lorenz functional.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: single-point L_infinity Lorenz gaps at the MEAN-rank
 *     cut. Wolfson uses the MEDIAN-rank cut, scaled by mu/m, AND
 *     subtracts Gini.
 *   axis-36 daily-token-atkinson-index: CRRA welfare loss with
 *     smooth power-mean penalty. Wolfson has no welfare parameter
 *     and no power-mean structure.
 *   axis-40 daily-token-palma-ratio: ratio of TWO Lorenz partial
 *     shares (top decile / bottom four deciles). Different two-point
 *     functional, different rank cuts, no Gini subtraction, no mu/m
 *     scaling.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold-
 *     anchored poverty index. Wolfson is two-sided, threshold-FREE,
 *     median-anchored.
 *   axis-43 daily-token-bonferroni-index / axis-45 daily-token-
 *     mehran-index: rank-weighted partial-mean shortfalls (uniform
 *     and linear kernels respectively). Wolfson is NOT a rank-
 *     weighted partial-mean integral; it is a single-point Lorenz
 *     reading at the median, anchored against Gini.
 *   axis-44 daily-token-kolm-pollak-index: ABSOLUTE (translation-
 *     invariant) measure in token units. Wolfson is RELATIVE
 *     (scale-invariant) and dimensionless. Polar-opposite invariance
 *     class.
 *   axis-39 daily-token-zenga-index: relative-mean-shortfall
 *     functional (lower-mean / upper-mean). Different Lorenz-curve
 *     functional; no median anchor.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Wolfson is
 *     permutation-invariant, so orthogonal by construction.
 *
 * ZERO DAYS: a zero-mass day enters the sorted vector as x_(1) = 0
 *   and depresses both the median and L(0.5). The half-Lorenz gap
 *   T = 0.5 - L(0.5) grows; if Gini also grows but more slowly,
 *   Wolfson grows. If the median collapses to 0 the index is
 *   degenerate (the mu/m multiplier is undefined) and we surface
 *   a `degenerate: true` row with `wolfson: 0`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): Wolfson is degenerate for n < 4 because
 *     the median-rank Lorenz reading needs at least two days on each
 *     side of the median to be meaningfully distinct from a Gini
 *     reading.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'wolfson'): 'wolfson' | 'tokens' | 'days'
 *     | 'source' | 'meanDaily' | 'meanOverMedian' | 'halfLorenzGap'.
 *   - `minWolfson` (default null = no filter): display filter; NaN/
 *     degenerate rows are kept regardless. Wolfson can be negative
 *     so the filter is signed-numeric, not [0, 1].
 *   - `includeMeanOverMedian` (refinement): per-row `meanOverMedian`
 *     scalar (mu/m). Surfaces the right-skew multiplier component
 *     of Wolfson independent of the (2T - G) bipolarization core.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenWolfsonSort =
  | 'wolfson'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'meanOverMedian'
  | 'halfLorenzGap';

export interface DailyTokenWolfsonOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenWolfsonSort;
  /** Display filter: drop rows whose wolfson < this. Wolfson can be negative; default null = no filter. */
  minWolfson?: number | null;
  /**
   * Refinement: when true, every emitted row gains a
   * `meanOverMedian` field (mu / m). Surfaces the right-skew
   * multiplier component of Wolfson independent of the (2T - G)
   * bipolarization core.
   */
  includeMeanOverMedian?: boolean;
  generatedAt?: string;
}

export interface DailyTokenWolfsonSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Wolfson bipolarization index. Sign NOT constrained. */
  wolfson: number;
  /**
   * True iff total = 0 OR median = 0 OR n < 2. wolfson = 0 in this
   * case but the reading is informationally degenerate.
   */
  degenerate: boolean;
  /** Cross-anchor: Gini on the same vector. */
  gini: number;
  /** Half-Lorenz gap at the median: T = 0.5 - L(0.5). In [0, 0.5]. */
  halfLorenzGap: number;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * Refinement: mu / m. Present iff caller set `includeMeanOverMedian: true`.
   * NaN if median = 0.
   */
  meanOverMedian?: number;
}

export interface DailyTokenWolfsonReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenWolfsonSort;
  minWolfson: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinWolfson: number;
  droppedTopSources: number;
  sources: DailyTokenWolfsonSourceRow[];
}

/**
 * Median of a numeric vector (sorted-ascending). Returns 0 for
 * empty input. Average of the two middle elements for even n.
 */
function medianOfSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2] as number;
  const a = sorted[n / 2 - 1] as number;
  const b = sorted[n / 2] as number;
  return (a + b) / 2;
}

/**
 * Lorenz curve evaluated at fractional rank p in [0, 1] for a
 * non-negative sorted-ascending vector via the standard linear
 * interpolation between integer rank-cuts.
 *
 *   L(p) = (S_floor + frac * x_(floor+1)) / total
 *
 * where the cut falls at fractional index p * n.
 */
function lorenzAt(sortedAsc: number[], p: number, total: number): number {
  const n = sortedAsc.length;
  if (n === 0 || total <= 0) return p;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const idx = p * n;
  const floor = Math.floor(idx);
  const frac = idx - floor;
  let s = 0;
  for (let i = 0; i < floor && i < n; i += 1) s += sortedAsc[i] as number;
  if (floor < n) s += frac * (sortedAsc[floor] as number);
  return s / total;
}

/**
 * Wolfson (1994) bipolarization index of a non-negative vector.
 *
 *     W = (mu / m) * (2 * T - G),  T = 0.5 - L(0.5)
 *
 * Returns:
 *   - {wolfson: 0, degenerate: true} for n < 2 or empty / all-zero
 *     or median = 0 (mu/m undefined).
 *   - wolfson signed otherwise. Sign NOT constrained.
 *
 * Throws on negative or non-finite input.
 */
export function wolfsonOfVector(values: number[]): {
  wolfson: number;
  mean: number;
  median: number;
  total: number;
  gini: number;
  halfLorenzGap: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      wolfson: 0,
      mean: v0,
      median: v0,
      total: v0,
      gini: 0,
      halfLorenzGap: 0,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `wolfsonOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      wolfson: 0,
      mean: 0,
      median: 0,
      total: 0,
      gini: 0,
      halfLorenzGap: 0,
      degenerate: true,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  const median = medianOfSorted(sorted);
  if (median <= 0) {
    return {
      wolfson: 0,
      mean: mu,
      median: 0,
      total,
      gini: giniOfVector(values),
      halfLorenzGap: 0,
      degenerate: true,
    };
  }
  const lHalf = lorenzAt(sorted, 0.5, total);
  const halfLorenzGap = 0.5 - lHalf;
  const gini = giniOfVector(values);
  const wolfson = (mu / median) * (2 * halfLorenzGap - gini);
  return {
    wolfson,
    mean: mu,
    median,
    total,
    gini,
    halfLorenzGap,
    degenerate: false,
  };
}

export function buildDailyTokenWolfsonPolarizationIndex(
  queue: QueueLine[],
  opts: DailyTokenWolfsonOptions = {},
): DailyTokenWolfsonReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Wolfson is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minWolfson = opts.minWolfson ?? null;
  if (minWolfson !== null && !Number.isFinite(minWolfson)) {
    throw new Error(
      `minWolfson must be a finite number or null (got ${opts.minWolfson})`,
    );
  }
  const sort: DailyTokenWolfsonSort = opts.sort ?? 'wolfson';
  const validSorts: DailyTokenWolfsonSort[] = [
    'wolfson',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'meanOverMedian',
    'halfLorenzGap',
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
  const rows: DailyTokenWolfsonSourceRow[] = [];

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
    let nZeroDays = 0;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v === 0) nZeroDays += 1;
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
      if (v < minDailyTokens) {
        minDailyTokens = v;
        minDay = d;
      }
    }
    const w = wolfsonOfVector(values);
    const row: DailyTokenWolfsonSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      wolfson: w.wolfson,
      degenerate: w.degenerate,
      gini: w.gini,
      halfLorenzGap: w.halfLorenzGap,
      meanDailyTokens: w.mean,
      medianDailyTokens: w.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeMeanOverMedian) {
      row.meanOverMedian =
        w.median > 0 ? w.mean / w.median : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinWolfson = 0;
  let filtered = rows;
  if (minWolfson !== null) {
    const next: DailyTokenWolfsonSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.wolfson >= minWolfson) next.push(r);
      else droppedBelowMinWolfson += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    const cmpNum = (av: number, bv: number): number => {
      if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      return bv - av;
    };
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
      case 'meanOverMedian': {
        const ar =
          a.meanOverMedian ??
          (a.medianDailyTokens > 0
            ? a.meanDailyTokens / a.medianDailyTokens
            : Number.NaN);
        const br =
          b.meanOverMedian ??
          (b.medianDailyTokens > 0
            ? b.meanDailyTokens / b.medianDailyTokens
            : Number.NaN);
        primary = cmpNum(ar, br);
        break;
      }
      case 'halfLorenzGap':
        primary = b.halfLorenzGap - a.halfLorenzGap;
        break;
      case 'wolfson':
      default:
        primary = b.wolfson - a.wolfson;
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
    minWolfson,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinWolfson,
    droppedTopSources,
    sources: kept,
  };
}
