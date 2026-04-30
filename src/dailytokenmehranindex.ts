/**
 * daily-token-mehran-index: per-source MEHRAN INDEX of the per-day
 * total_tokens distribution. FORTY-FIFTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Mehran
 * (1976) LINEAR rank-weighted partial-mean inequality measure:
 *
 *     M = 1 - sum_{k=1..n-1} w_k * (S_k / (k * mu))
 *
 *   with linearly-decreasing rank weights
 *
 *     w_k = 2 * (n - k) / (n * (n - 1))     (sum_{k=1..n-1} w_k = 1)
 *
 *   sorted-ascending values x_(1) <= ... <= x_(n), partial sum
 *   S_k = sum_{j=1..k} x_(j), partial mean M_k = S_k / k, and
 *   mu = mean(D). Equivalently:
 *
 *     M = sum_{k=1..n-1} w_k * (1 - M_k / mu)
 *        = LINEARLY-WEIGHTED average of partial-mean shortfalls.
 *
 *   Range `[0, 1]`. M = 0 iff every day carries the same mass
 *   (perfect equality across days). M = 1 in the maximal-inequality
 *   limit (all mass on a single day, S_k = 0 for k < n).
 *
 *   THE DEFINING CONTRAST. Three measures read the SAME family of
 *   partial-mean shortfalls (1 - M_k/mu) at the SAME n-1 rank cuts
 *   k = 1, ..., n-1 but apply DIFFERENT rank-kernel weightings:
 *
 *     - axis-32 GINI:        UNIFORM Lorenz weighting (gap weight 1)
 *     - axis-43 BONFERRONI:  UNIFORM partial-mean weighting (1/(n-1))
 *     - axis-45 MEHRAN:      LINEARLY-DECREASING partial-mean weighting
 *                            (2*(n-k)/(n*(n-1)))
 *
 *   Mehran sits in a DIFFERENT bottom-sensitivity profile than Gini
 *   and Bonferroni. Empirically Mehran tends to read ABOVE Gini for
 *   bottom-heavy distributions (the linear kernel pushes more weight
 *   onto bottom-rank partial-mean shortfalls than Gini's uniform
 *   Lorenz integral), but the Mehran-vs-Bonferroni ordering is NOT
 *   sign-constrained: depending on the shape, the linear kernel can
 *   read above OR below Bonferroni's harmonic-tail kernel because
 *   the linear weight 2*(n-k)/(n*(n-1)) and the Bonferroni weight
 *   sum_{j=k..n-1} 1/j are NOT pointwise-ordered for all k. Two
 *   distributions with identical Bonferroni (or identical Gini) can
 *   have distinct Mehran values when bulk-mass migration moves
 *   between mid-bottom and far-bottom ranks.
 *
 *   The empirical inequality M - G is the LINEAR-RANK-EXCESS
 *   diagnostic: how much extra weight Mehran's linear kernel
 *   assigns to bottom-ranks beyond Gini's uniform weighting. Unlike
 *   the textbook B >= G identity, M - G is NOT sign-constrained
 *   (Mehran can fall below Gini in heavy-top distributions where
 *   the linear kernel down-weights the top half more aggressively
 *   than the uniform Lorenz integral). The sign and magnitude of
 *   M - G is the new structural information surfaced by axis-45.
 *
 * Why orthogonal to every prior daily-token axis:
 *
 *   axis-32 daily-token-gini-coefficient: Gini integrates the Lorenz
 *     gap p_k - L_k with UNIFORM Lebesgue measure on [0,1]. Mehran
 *     integrates partial-mean shortfalls (1 - M_k/mu) with LINEARLY-
 *     DECREASING rank measure. Same underlying Lorenz curve, distinct
 *     functional. Two day-vectors with identical Gini can have
 *     different Mehran when mid-rank vs bottom-rank gaps trade off.
 *   axis-43 daily-token-bonferroni-index: Bonferroni is the UNIFORM
 *     average of (1 - M_k/mu); Mehran is the LINEARLY-DECREASING-
 *     weighted average. Same n-1 partial-mean shortfalls, different
 *     rank-kernel. Strictly distinct functional class.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: both are L_infinity Lorenz gaps at a SINGLE rank cut.
 *     Mehran integrates over ALL n-1 rank cuts with linear weighting.
 *   axis-36 daily-token-atkinson-index: Atkinson is a CRRA welfare
 *     loss with smooth power-mean penalty. Mehran is parameter-free
 *     rank-weighted shortfall integral; no power-mean curvature.
 *   axes 37/38/39 (theil-l/theil-t/ge2): GE(alpha) family. Moment-
 *     based on shares; Mehran is rank-based on cumulative partial
 *     means.
 *   axis-40 daily-token-palma-ratio: two-point Lorenz reading.
 *     Mehran reads ALL n-1 partial means.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold-
 *     anchored poverty index. Mehran is two-sided, threshold-FREE,
 *     rank-weighted across the full distribution.
 *   axis-44 daily-token-kolm-pollak-index: ABSOLUTE (translation-
 *     invariant) measure in token units. Mehran is RELATIVE (scale-
 *     invariant) and dimensionless. Polar-opposite invariance class.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Mehran is
 *     permutation-invariant, so orthogonal by construction.
 *
 *   Headline question:
 *   **"For each source, what is the LINEARLY-RANK-WEIGHTED partial-
 *     mean inequality of per-day token mass, and how does its bottom-
 *     sensitivity profile compare to Gini's uniform and Bonferroni's
 *     harmonic-tail weightings?"**
 *
 * ZERO DAYS: a zero-mass day enters the sorted vector as x_(1) = 0
 *   and contributes 0 to every partial mean M_k that includes it.
 *   The shortfall (1 - M_k/mu) is maximised at 1 for the small-k
 *   shortfalls dominated by the zero day. The linear kernel
 *   2*(n-k)/(n*(n-1)) puts the LARGEST weight on k=1, so a single
 *   zero day inflates Mehran by a relatively larger amount than a
 *   single small-but-positive day would.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): Mehran is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'mehran'): 'mehran' | 'tokens' | 'days'
 *     | 'source' | 'meanDaily' | 'mehranOverGini' | 'linearRankExcess'.
 *   - `minMehran` (default 0): display filter; in [0, 1].
 *   - `includeLinearRankExcess` (refinement): per-row `mehran - gini`
 *     gap (the LINEAR-RANK-EXCESS diagnostic; sign not constrained).
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';
import { bonferroniOfVector } from './dailytokenbonferroniindex.js';

export type DailyTokenMehranSort =
  | 'mehran'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'mehranOverGini'
  | 'linearRankExcess';

export interface DailyTokenMehranOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMehranSort;
  /** Display filter: drop rows whose mehran < this. In [0, 1]. */
  minMehran?: number;
  /**
   * Refinement: when true, every emitted row gains a
   * `linearRankExcess` field = mehran - gini (sign NOT constrained;
   * positive => Mehran's linear kernel pushes more weight onto the
   * bottom than Gini's uniform Lorenz integral; negative => the
   * top-of-distribution shape dominates and Mehran reads BELOW Gini).
   */
  includeLinearRankExcess?: boolean;
  /**
   * Refinement (cross-anchor): when true, every emitted row gains a
   * `bonferroni` field and a `mehranMinusBonferroni` field. Surfaces
   * the rank-kernel-shape contrast between LINEAR (Mehran) and
   * UNIFORM-on-partial-means (Bonferroni) weightings of the SAME
   * (1 - M_k/mu) shortfalls.
   */
  includeBonferroniCrossAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenMehranSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Mehran index in [0, 1]. */
  mehran: number;
  /**
   * True iff total = 0 (all-zero per-day vector). mehran = 0 in
   * this case but the reading is informationally degenerate.
   */
  degenerate: boolean;
  /**
   * Cross-anchor: Gini on the same vector. The headline RANK-WEIGHT
   * SHAPE indicator of THIS axis is `mehranOverGini`, which requires
   * both to compute.
   */
  gini: number;
  /**
   * Rank-weight ratio mehran/gini. Sign and magnitude depend on the
   * bottom-vs-top shape of the distribution (Mehran's linear kernel
   * vs Gini's uniform Lorenz integral). NaN when gini = 0.
   */
  mehranOverGini: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * Refinement: mehran - gini. Sign NOT constrained.
   * Present iff caller set `includeLinearRankExcess: true`.
   */
  linearRankExcess?: number;
  /**
   * Refinement: Bonferroni on the same vector. Present iff caller
   * set `includeBonferroniCrossAnchor: true`.
   */
  bonferroni?: number;
  /**
   * Refinement: mehran - bonferroni. Both indices read the SAME
   * partial-mean shortfalls (1 - M_k/mu); the gap exposes the
   * LINEAR-vs-UNIFORM rank-kernel contrast. Present iff caller set
   * `includeBonferroniCrossAnchor: true`.
   */
  mehranMinusBonferroni?: number;
}

export interface DailyTokenMehranReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMehranSort;
  minMehran: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinMehran: number;
  droppedTopSources: number;
  sources: DailyTokenMehranSourceRow[];
}

/**
 * Mehran (1976) linearly-rank-weighted partial-mean inequality
 * index of a non-negative vector.
 *
 *     M = 1 - sum_{k=1..n-1} w_k * (S_k / (k * mu))
 *
 *   with w_k = 2*(n-k)/(n*(n-1)) (sum to 1).
 *
 * Returns:
 *   - {mehran: 0, degenerate: true} for n < 2 or empty / all-zero.
 *   - mehran in [0, 1] otherwise.
 *
 * Throws on negative or non-finite input.
 */
export function mehranOfVector(values: number[]): {
  mehran: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return { mehran: 0, mean: v0, total: v0, degenerate: true };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `mehranOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return { mehran: 0, mean: 0, total: 0, degenerate: true };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  // M = 1 - sum_{k=1..n-1} w_k * (S_k / (k * mu))
  // w_k = 2*(n-k) / (n*(n-1))
  let cumSum = 0;
  let acc = 0;
  const denom = n * (n - 1);
  for (let k = 1; k <= n - 1; k += 1) {
    cumSum += sorted[k - 1] as number;
    const w = (2 * (n - k)) / denom;
    acc += w * (cumSum / (k * mu));
  }
  const mehran = 1 - acc;
  return { mehran, mean: mu, total, degenerate: false };
}

export function buildDailyTokenMehranIndex(
  queue: QueueLine[],
  opts: DailyTokenMehranOptions = {},
): DailyTokenMehranReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Mehran is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minMehran = opts.minMehran ?? 0;
  if (!Number.isFinite(minMehran) || minMehran < 0 || minMehran > 1) {
    throw new Error(
      `minMehran must be a finite number in [0, 1] (got ${opts.minMehran})`,
    );
  }
  const sort: DailyTokenMehranSort = opts.sort ?? 'mehran';
  const validSorts: DailyTokenMehranSort[] = [
    'mehran',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'mehranOverGini',
    'linearRankExcess',
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
  const rows: DailyTokenMehranSourceRow[] = [];

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
    const m = mehranOfVector(values);
    const gini = giniOfVector(values);
    const mehranOverGini = gini === 0 ? Number.NaN : m.mehran / gini;
    const row: DailyTokenMehranSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      mehran: m.mehran,
      degenerate: m.degenerate,
      gini,
      mehranOverGini,
      meanDailyTokens: m.mean,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeLinearRankExcess) {
      row.linearRankExcess = m.mehran - gini;
    }
    if (opts.includeBonferroniCrossAnchor) {
      const b = bonferroniOfVector(values);
      row.bonferroni = b.bonferroni;
      row.mehranMinusBonferroni = m.mehran - b.bonferroni;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinMehran = 0;
  let filtered = rows;
  if (minMehran > 0) {
    const next: DailyTokenMehranSourceRow[] = [];
    for (const r of rows) {
      if (r.mehran >= minMehran) next.push(r);
      else droppedBelowMinMehran += 1;
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
      case 'mehranOverGini':
        primary = cmpNum(a.mehranOverGini, b.mehranOverGini);
        break;
      case 'linearRankExcess':
        primary =
          (b.linearRankExcess ?? b.mehran - b.gini) -
          (a.linearRankExcess ?? a.mehran - a.gini);
        break;
      case 'mehran':
      default:
        primary = b.mehran - a.mehran;
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
    minMehran,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinMehran,
    droppedTopSources,
    sources: kept,
  };
}
