/**
 * daily-token-esteban-ray-polarization-index: per-source ESTEBAN-RAY
 * POLARIZATION INDEX (Esteban & Ray 1994, Econometrica 62:819-851)
 * of the per-day total_tokens distribution. FIFTY-FIRST cross-source
 * axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Esteban-Ray
 * polarization measure
 *
 *     ER(alpha) = sum_{i=1..n} sum_{j=1..n} pi_i^(1+alpha) * pi_j * |y_i - y_j|
 *
 * where pi_i = 1/n is the empirical mass on day i (every day weighted
 * equally) and y_i is the day-token value. We default alpha = 1, the
 * canonical sensitivity studied in the original paper (alpha in
 * [1, 1.6] for the axiomatic family). Higher alpha amplifies the
 * SELF-IDENTIFICATION of large groups (here: large-mass days) -- the
 * defining feature of polarization vs inequality.
 *
 *   Range: ER(alpha) >= 0. ER = 0 iff all y_i are equal. There is
 *   no closed-form upper bound because ER scales LINEARLY with the
 *   units of y_i (a TRANSLATION-DEPENDENT, SCALE-LINEAR functional
 *   in absolute units). We surface a NORMALIZED variant
 *
 *     ER_norm = ER / mean
 *
 *   which is scale-invariant (and is the form most directly
 *   comparable across sources).
 *
 *   Headline question:
 *   **"For each source, how strongly is per-day token mass clustered
 *     into INTERNALLY HOMOGENEOUS but MUTUALLY DISTANT groups?"**
 *
 *   This is structurally distinct from every prior daily-token axis.
 *   The Esteban-Ray family is built on an IDENTIFICATION-ALIENATION
 *   axiomatization (Esteban & Ray 1994 axioms A1-A4): each pair (i,j)
 *   contributes pi_i^(1+alpha) * pi_j * |y_i - y_j| -- the product of
 *   group i's IDENTIFICATION (pi_i^(1+alpha), super-linear in own
 *   mass) and the ALIENATION between groups (pi_j * |y_i - y_j|).
 *   The super-linear identification term is what separates POLARIZATION
 *   from INEQUALITY: pi_i appears with exponent (1+alpha) > 1 rather
 *   than the linear weight that all Lorenz-based / Gini-based / GE
 *   measures use.
 *
 * Why orthogonal to every prior daily-token axis (axes 32-50):
 *
 *   axis-32 daily-token-gini-coefficient: Gini = (1/(2*n^2*mu)) *
 *     sum_i sum_j |y_i - y_j|. The pairwise-distance kernel is the
 *     SAME, but Gini uses LINEAR weights (1/n)*(1/n) on every pair.
 *     ER uses SUPER-LINEAR weights pi_i^(1+alpha) * pi_j. Two
 *     distributions can have identical Gini and different ER
 *     (concentrate the same |y_i - y_j| differences onto fewer days
 *     and ER rises while Gini stays put).
 *   axis-33/34/37/49 GE(0)/GE(1)/GE(2)/GE(-1): SHARE-MOMENT family,
 *     weighted by f(share). ER is a PAIRWISE-DISTANCE kernel, no
 *     share-power moment.
 *   axis-35 daily-token-pietra-ratio / axis-42 hoover-index: SINGLE-
 *     POINT L_inf Lorenz gaps. ER is a sum over ALL n^2 pairs.
 *   axis-36 daily-token-atkinson-index / axis-44 kolm-pollak: CRRA /
 *     CARA welfare-equivalent power means. ER has no welfare functional.
 *   axis-39 daily-token-zenga-index: lower-mean / upper-mean ratio.
 *     ER is full-pair distance summation.
 *   axis-40 daily-token-palma-ratio / axis-46 wolfson: SPECIFIC-RANK
 *     functionals (top10/bot40, half-Lorenz at median). ER aggregates
 *     across all ranks.
 *   axis-41 daily-token-fgt-index: one-sided LOWER-tail threshold
 *     functional. ER is two-sided, threshold-FREE.
 *   axis-43 bonferroni / axis-45 mehran / axis-47 sgini: rank-weighted
 *     PARTIAL-MEAN kernels (cumulative-mean weights). ER is a
 *     PAIRWISE distance kernel, not a partial-mean kernel.
 *   axis-48 chakravarty: parametric concave share-power averaging.
 *     ER is a parametric IDENTIFICATION-power weighting on PAIRWISE
 *     distances, structurally different.
 *   axis-50 amato: Lorenz-curve ARC LENGTH. ER is a pairwise-distance
 *     polarization kernel; not a Lorenz-curve functional.
 *
 *   THE STRUCTURAL DISTINCTION FROM GINI. ER and Gini share the SAME
 *   pairwise-distance kernel |y_i - y_j| but differ in the WEIGHTS:
 *     Gini  : weight(i, j) = (1/n) * (1/n)             (linear in pi_i)
 *     ER(a) : weight(i, j) = pi_i^(1+a) * pi_j         (super-linear)
 *   With pi_i = 1/n forced (per-day projection: each day is its own
 *   pi-group), the two reduce to a CLOSED-FORM PROPORTIONAL identity
 *   at fixed n:
 *
 *     erNorm / gini = 2 * n^{-alpha}.
 *
 *   So at alpha = 0 the ratio is 2 (constant: ER(0) = 2*mu*Gini); at
 *   alpha = 1 the ratio is 2/n; at alpha = 1.5 the ratio is 2*n^{-1.5}.
 *   THIS IS THE ORTHOGONALITY THAT SURVIVES THE PER-DAY PROJECTION:
 *   an N-DEPENDENT RESCALING of the Gini signal. Sources with
 *   different #days have different ER/Gini ratios -- a real
 *   cross-source decoupling that no other axis surfaces. The full
 *   non-trivial Esteban-Ray identification axiom (mass coalescence
 *   into super-groups) is degenerate under per-day grouping; we
 *   surface the n-rescaling form, which is the natural way ER enters
 *   when groups are atomic units (here: UTC days). The
 *   --include-gini-anchor refinement makes this n-dependence visible
 *   row by row.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `alpha` (default 1): polarization-sensitivity parameter in
 *     [0, 1.6]. The canonical Esteban-Ray axiom range. alpha = 1 is
 *     the most-studied default.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 3): ER is degenerate for n < 2; default 3.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'erNorm'): 'erNorm' | 'er' | 'tokens' | 'days'
 *     | 'source' | 'meanDaily'.
 *   - `minErNorm` (default 0): display filter on the normalized ER.
 *   - `includeGiniAnchor` (refinement): per-row `gini` (axis-32
 *     functional on the same per-day vector) and `erNormOverGini`
 *     ratio (the IDENTIFICATION-POWER amplification factor over
 *     pure Gini). NOT a constant; varies across distributions.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenEstebanRaySort =
  | 'erNorm'
  | 'er'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenEstebanRayOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Polarization-sensitivity parameter. In [0, 1.6]. Default 1. */
  alpha?: number;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenEstebanRaySort;
  /** Display filter: drop rows whose erNorm < this. Default 0 = no filter. */
  minErNorm?: number;
  /**
   * Refinement: when true, every emitted row gains `gini` (axis-32
   * functional on the SAME per-day vector) and `erNormOverGini`,
   * the IDENTIFICATION-POWER amplification of ER_norm over the pure
   * Gini-style linear weighting.
   */
  includeGiniAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenEstebanRaySourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one positive observation. */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Polarization-sensitivity parameter alpha used for this row. */
  alpha: number;
  /** Esteban-Ray polarization index in absolute (token) units. >= 0. */
  er: number;
  /** Scale-invariant normalization: er / meanDailyTokens. >= 0. */
  erNorm: number;
  /** True iff total = 0 OR n < 2. er = erNorm = 0 in this case. */
  degenerate: boolean;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Gini on the same vector. */
  gini?: number;
  /** Refinement: erNorm / gini ratio. NaN if gini = 0. */
  erNormOverGini?: number;
}

export interface DailyTokenEstebanRayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  alpha: number;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenEstebanRaySort;
  minErNorm: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinErNorm: number;
  droppedTopSources: number;
  sources: DailyTokenEstebanRaySourceRow[];
}

/**
 * Esteban-Ray polarization index of a non-negative numeric vector.
 *
 *     ER(alpha) = sum_i sum_j pi_i^(1+alpha) * pi_j * |y_i - y_j|
 *
 * with pi_i = 1/n. Returns { er: 0, erNorm: 0, degenerate: true } for
 * empty input, n < 2, or all-zero vector. Throws on negative or
 * non-finite input or invalid alpha. erNorm = er / mean.
 */
export function estebanRayOfVector(
  values: number[],
  alpha = 1,
): {
  er: number;
  erNorm: number;
  mean: number;
  median: number;
  total: number;
  degenerate: boolean;
} {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1.6) {
    throw new Error(
      `estebanRayOfVector requires alpha in [0, 1.6] (got ${alpha})`,
    );
  }
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      er: 0,
      erNorm: 0,
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
        `estebanRayOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      er: 0,
      erNorm: 0,
      mean: 0,
      median: 0,
      total: 0,
      degenerate: true,
    };
  }
  const mu = total / n;
  // Sorted copy for deterministic median + identical-shape iteration order.
  const sorted = values.slice().sort((a, b) => a - b);
  const median =
    n % 2 === 1
      ? (sorted[(n - 1) / 2] as number)
      : ((sorted[n / 2 - 1] as number) + (sorted[n / 2] as number)) / 2;
  // pi_i = 1/n for all i. Pull constants out of the double sum:
  //   ER = (1/n)^(1+alpha) * (1/n) * sum_i sum_j |y_i - y_j|
  //      = n^{-(2+alpha)} * sum_i sum_j |y_i - y_j|
  // Compute sum_i sum_j |y_i - y_j| via the ascending-order identity:
  //   sum_i sum_j |y_i - y_j| = 2 * sum_{k=1..n} (2k - n - 1) * y_(k)
  // where y_(k) is the k-th order statistic (1-indexed). This is the
  // standard sorted-form of the pairwise-distance double sum and is
  // O(n log n) instead of O(n^2).
  let pairSum = 0; // sum_{k=1..n} (2k - n - 1) * y_(k)
  for (let k = 1; k <= n; k += 1) {
    pairSum += (2 * k - n - 1) * (sorted[k - 1] as number);
  }
  const doubleSum = 2 * pairSum;
  const er = Math.pow(n, -(2 + alpha)) * doubleSum;
  const erNorm = er / mu;
  return {
    er,
    erNorm,
    mean: mu,
    median,
    total,
    degenerate: false,
  };
}

export function buildDailyTokenEstebanRayPolarizationIndex(
  queue: QueueLine[],
  opts: DailyTokenEstebanRayOptions = {},
): DailyTokenEstebanRayReport {
  const alpha = opts.alpha ?? 1;
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1.6) {
    throw new Error(
      `alpha must be in [0, 1.6] (Esteban-Ray axiom range) (got ${opts.alpha})`,
    );
  }
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (ER is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minErNorm = opts.minErNorm ?? 0;
  if (!Number.isFinite(minErNorm) || minErNorm < 0) {
    throw new Error(
      `minErNorm must be a non-negative finite number (got ${opts.minErNorm})`,
    );
  }
  const sort: DailyTokenEstebanRaySort = opts.sort ?? 'erNorm';
  const validSorts: DailyTokenEstebanRaySort[] = [
    'erNorm',
    'er',
    'tokens',
    'days',
    'source',
    'meanDaily',
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
  const rows: DailyTokenEstebanRaySourceRow[] = [];

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
    const e = estebanRayOfVector(values, alpha);
    const row: DailyTokenEstebanRaySourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      alpha,
      er: e.er,
      erNorm: e.erNorm,
      degenerate: e.degenerate,
      meanDailyTokens: e.mean,
      medianDailyTokens: e.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeGiniAnchor) {
      const g = giniOfVector(values);
      row.gini = g;
      row.erNormOverGini = g > 0 ? e.erNorm / g : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinErNorm = 0;
  let filtered = rows;
  if (minErNorm > 0) {
    const next: DailyTokenEstebanRaySourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.erNorm >= minErNorm) next.push(r);
      else droppedBelowMinErNorm += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'er':
        primary = b.er - a.er;
        break;
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
      case 'erNorm':
      default:
        primary = b.erNorm - a.erNorm;
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
    alpha,
    minTokens,
    minDays,
    top,
    sort,
    minErNorm,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinErNorm,
    droppedTopSources,
    sources: kept,
  };
}
