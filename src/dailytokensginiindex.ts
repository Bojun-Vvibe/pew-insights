/**
 * daily-token-sgini-index: per-source DONALDSON-WEYMARK / YITZHAKI
 * SINGLE-PARAMETER (extended) GINI of the per-day total_tokens
 * distribution. FORTY-SEVENTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Donaldson-
 * Weymark (1980) / Yitzhaki (1983) single-parameter S-Gini:
 *
 *     S(delta) = 1 - (1 / mu) * sum_{i=1..n} x_(i) * w_i^(delta)
 *
 *   where x_(i) is the i-th order statistic of D sorted ASCENDING,
 *   mu is the sample mean, and the order weights are the difference
 *   of the inverse-rank power kernel:
 *
 *     w_i^(delta) = ((n - i + 1) / n)^delta - ((n - i) / n)^delta
 *
 *   The weights satisfy sum_i w_i^(delta) = 1 for every delta > 0,
 *   so S(delta) is a proper Lorenz-area generalization.
 *
 *   delta is a DISTRIBUTIONAL-AVERSION PARAMETER:
 *     delta = 1   -> S = 0 for ANY non-negative vector (degenerate
 *                    weights collapse to uniform 1/n; the formula
 *                    reduces to 1 - mu/mu = 0). NOT useful.
 *     delta = 2   -> S = standard Gini (axis-32). Identity, not new.
 *     delta > 2   -> MORE weight on the bottom of the distribution
 *                    than standard Gini (the (n-i+1)/n kernel
 *                    decays faster, so leftmost order statistics
 *                    receive larger increments).
 *     delta < 1   -> reverses sign of inequality aversion (top-
 *                    weighted; mostly theoretical).
 *
 *   We ship at delta = 3 by default. This is the canonical
 *   "high-aversion" extended Gini used in welfare economics for
 *   bottom-tail-sensitive inequality readings. Range [0, 1) on
 *   non-negative input; S = 0 iff all observations equal.
 *
 *   Headline question:
 *   **"For each source, how unequal is the per-day token mass when
 *     scored by an inequality kernel that puts EXTRA weight on the
 *     bottom of the distribution (delta > 2) compared to the
 *     mean-anchored Gini benchmark?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-46):
 *
 *   axis-32 daily-token-gini-coefficient: standard Gini is
 *     S(delta=2). At delta=3 the order kernel puts strictly more
 *     weight on the bottom; the textbook identity S(3) >= S(2) = G
 *     holds for any non-negative vector with equality only at
 *     two-point or perfect equality. Thus S(3) - G >= 0 is itself
 *     a Donaldson-Weymark identity gap that we surface as a
 *     cross-anchor refinement.
 *   axis-33 daily-token-theil-l-index / axis-34 daily-token-theil-t-
 *     index / axis-37 daily-token-ge2-index: GE(alpha) family is
 *     entirely moment-based on shares; no order kernel and no
 *     parametric aversion knob. S-Gini is rank-based (order
 *     statistics) by construction and indifferent to share moments
 *     beyond the rank pairing.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: single-point L_infinity Lorenz gaps at the MEAN-rank
 *     cut. S-Gini integrates the entire Lorenz curve under a
 *     non-uniform power-kernel weighting; not a single-point
 *     reading.
 *   axis-36 daily-token-atkinson-index: CRRA welfare loss with
 *     epsilon-parameterised power-mean penalty. Atkinson's
 *     aversion knob acts on VALUES (power-mean over x_i^(1-eps));
 *     S-Gini's delta acts on RANKS (power-kernel over (n-i+1)/n).
 *     Polar-opposite construction: smooth power-mean of values vs
 *     power-kernel weighting of order statistics.
 *   axis-39 daily-token-zenga-index: relative-mean-shortfall
 *     functional (lower-mean / upper-mean). Different Lorenz-curve
 *     functional; not a parametric rank-weighted Gini.
 *   axis-40 daily-token-palma-ratio: ratio of two Lorenz partial
 *     shares. Different two-point functional, no parametric kernel.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold-
 *     anchored poverty index. S-Gini is two-sided and threshold-
 *     FREE.
 *   axis-43 daily-token-bonferroni-index: harmonic bottom-rank-
 *     weighted (1/k cumulative-mean kernel). S-Gini at delta=3 is
 *     polynomial bottom-rank-weighted ((n-i+1)/n)^3 difference
 *     kernel; both lean bottom but with structurally distinct
 *     kernel families (harmonic vs polynomial).
 *   axis-44 daily-token-kolm-pollak-index: ABSOLUTE (translation-
 *     invariant) measure in token units. S-Gini is RELATIVE
 *     (scale-invariant) and dimensionless. Polar-opposite
 *     invariance class.
 *   axis-45 daily-token-mehran-index: linear-rank-weighted partial-
 *     mean-shortfall integral (Lorenz-area cousin with linear
 *     kernel 2(1-p)). S-Gini at delta=3 is a power-kernel
 *     difference-of-cumulative weighting; not a partial-mean
 *     integral of L(p).
 *   axis-46 daily-token-wolfson-polarization-index: median-anchored
 *     bipolarization (W = (mu/m)(2T - G)). S-Gini has no median
 *     anchor; it integrates the full Lorenz curve under a
 *     parametric rank kernel.
 *   All time-ordered axes: S-Gini is permutation-invariant by
 *     construction (depends only on order statistics), so
 *     orthogonal to every time-ordered axis.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 3): S-Gini is degenerate for n < 2; we
 *     require >= 3 days for the bottom-weighted kernel to be
 *     meaningfully distinct from standard Gini (n=2 collapses both
 *     readings to the same two-point gap).
 *   - `delta` (default 3): aversion parameter. Must be > 0 and != 1
 *     (delta=1 is the degenerate identity that returns 0 for any
 *     vector). delta=2 reproduces standard Gini exactly.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'sgini'): 'sgini' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'sginiOverGini' | 'bottomWeightExcess'.
 *   - `minSgini` (default 0 = no filter): display filter on S-Gini.
 *   - `includeBottomWeightExcess` (refinement): per-row
 *     `bottomWeightExcess` field = sgini - gini, and
 *     `sginiOverGini` = sgini / gini (or null if gini=0). Surfaces
 *     the Donaldson-Weymark identity S(delta>=2) >= G; the gap is
 *     the bottom-rank weighting EXCESS that the parametric kernel
 *     extracts beyond the standard Gini baseline.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenSginiSort =
  | 'sgini'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'sginiOverGini'
  | 'bottomWeightExcess';

export interface DailyTokenSginiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  /** Aversion parameter. Must be > 0 and != 1. Default 3. delta=2 reproduces standard Gini. */
  delta?: number;
  top?: number;
  sort?: DailyTokenSginiSort;
  /** Display filter: drop rows whose sgini < this. In [0, 1). Default 0 = no filter. */
  minSgini?: number;
  /**
   * Refinement: when true, every emitted row gains
   * `bottomWeightExcess` (sgini - gini) and `sginiOverGini`
   * (sgini / gini, or null if gini=0). Surfaces the Donaldson-
   * Weymark identity S(delta>=2) >= G.
   */
  includeBottomWeightExcess?: boolean;
  generatedAt?: string;
}

export interface DailyTokenSginiSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Donaldson-Weymark S-Gini at delta. In [0, 1). */
  sgini: number;
  /** True iff total = 0 OR n < 2. sgini = 0 in this case. */
  degenerate: boolean;
  /** Aversion parameter actually used for this row (echoes opts.delta). */
  delta: number;
  /** Cross-anchor: standard Gini = S(2) on the same vector. */
  gini: number;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * Refinement: sgini - gini. Donaldson-Weymark identity says
   * this is >= 0 for every delta >= 2. Present iff caller set
   * `includeBottomWeightExcess: true`.
   */
  bottomWeightExcess?: number;
  /**
   * Refinement: sgini / gini. NaN if gini = 0 (perfect equality).
   * Present iff caller set `includeBottomWeightExcess: true`.
   */
  sginiOverGini?: number;
}

export interface DailyTokenSginiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  delta: number;
  top: number;
  sort: DailyTokenSginiSort;
  minSgini: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinSgini: number;
  droppedTopSources: number;
  sources: DailyTokenSginiSourceRow[];
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
 * Donaldson-Weymark / Yitzhaki single-parameter S-Gini of a
 * non-negative vector at aversion parameter delta:
 *
 *     S(delta) = 1 - (1 / mu) * sum_{i=1..n} x_(i) * w_i
 *     w_i = ((n - i + 1) / n)^delta - ((n - i) / n)^delta
 *
 * with x_(i) the i-th ascending order statistic. Returns
 * {sgini: 0, degenerate: true} for n < 2, empty input, or all-zero
 * vector. Throws on negative or non-finite input, or invalid delta.
 *
 * Identity: at delta=2, this reproduces standard Gini exactly.
 * Identity: weights sum to 1 for every delta > 0:
 *   sum_i w_i = ((n)/n)^delta - (0/n)^delta = 1.
 */
export function sginiOfVector(
  values: number[],
  delta: number,
): {
  sgini: number;
  mean: number;
  median: number;
  total: number;
  degenerate: boolean;
} {
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error(
      `sginiOfVector requires delta > 0 (got ${delta})`,
    );
  }
  if (delta === 1) {
    throw new Error(
      `sginiOfVector: delta = 1 is the degenerate identity (returns 0 for any vector). Use delta > 1.`,
    );
  }
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      sgini: 0,
      mean: v0,
      median: v0,
      total: v0,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `sginiOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      sgini: 0,
      mean: 0,
      median: 0,
      total: 0,
      degenerate: true,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  const median = medianOfSorted(sorted);
  let weightedSum = 0;
  for (let i = 1; i <= n; i += 1) {
    const upper = (n - i + 1) / n;
    const lower = (n - i) / n;
    const w = Math.pow(upper, delta) - Math.pow(lower, delta);
    weightedSum += (sorted[i - 1] as number) * w;
  }
  const sgini = 1 - weightedSum / mu;
  return {
    sgini,
    mean: mu,
    median,
    total,
    degenerate: false,
  };
}

export function buildDailyTokenSginiIndex(
  queue: QueueLine[],
  opts: DailyTokenSginiOptions = {},
): DailyTokenSginiReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (S-Gini is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const delta = opts.delta ?? 3;
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new Error(`delta must be a positive finite number (got ${opts.delta})`);
  }
  if (delta === 1) {
    throw new Error(
      `delta = 1 is the degenerate identity (S(1) = 0 for any vector). Use delta > 1.`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minSgini = opts.minSgini ?? 0;
  if (!Number.isFinite(minSgini) || minSgini < 0 || minSgini >= 1) {
    throw new Error(
      `minSgini must be a number in [0, 1) (got ${opts.minSgini})`,
    );
  }
  const sort: DailyTokenSginiSort = opts.sort ?? 'sgini';
  const validSorts: DailyTokenSginiSort[] = [
    'sgini',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'sginiOverGini',
    'bottomWeightExcess',
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
  const rows: DailyTokenSginiSourceRow[] = [];

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
    const s = sginiOfVector(values, delta);
    const g = giniOfVector(values);
    const row: DailyTokenSginiSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      sgini: s.sgini,
      degenerate: s.degenerate,
      delta,
      gini: g,
      meanDailyTokens: s.mean,
      medianDailyTokens: s.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeBottomWeightExcess) {
      row.bottomWeightExcess = s.sgini - g;
      row.sginiOverGini = g > 0 ? s.sgini / g : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinSgini = 0;
  let filtered = rows;
  if (minSgini > 0) {
    const next: DailyTokenSginiSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.sgini >= minSgini) next.push(r);
      else droppedBelowMinSgini += 1;
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
      case 'sginiOverGini': {
        const ar =
          a.sginiOverGini ?? (a.gini > 0 ? a.sgini / a.gini : Number.NaN);
        const br =
          b.sginiOverGini ?? (b.gini > 0 ? b.sgini / b.gini : Number.NaN);
        primary = cmpNum(ar, br);
        break;
      }
      case 'bottomWeightExcess': {
        const ar = a.bottomWeightExcess ?? a.sgini - a.gini;
        const br = b.bottomWeightExcess ?? b.sgini - b.gini;
        primary = br - ar;
        break;
      }
      case 'sgini':
      default:
        primary = b.sgini - a.sgini;
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
    delta,
    top,
    sort,
    minSgini,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinSgini,
    droppedTopSources,
    sources: kept,
  };
}
