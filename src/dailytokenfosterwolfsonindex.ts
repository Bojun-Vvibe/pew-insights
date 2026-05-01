/**
 * daily-token-foster-wolfson-index: per-source FOSTER-WOLFSON
 * ABSOLUTE BIPOLARIZATION INDEX of the per-day total_tokens
 * distribution. FIFTY-SECOND cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Foster-Wolfson
 * absolute bipolarization index (Foster & Wolfson 1992 / 2010,
 * Journal of Economic Inequality 8:247-273):
 *
 *     FW = 2 * mu * (2 * T - G)
 *
 *   where
 *     mu        = mean(D)                  (in token units)
 *     L(0.5)    = Lorenz curve at the 50% population rank
 *     T         = 0.5 - L(0.5)             (half-Lorenz GAP at median)
 *     G         = Gini(D)                  (axis-32 functional)
 *
 *   FW is the ABSOLUTE (translation-equivariant in tokens, scale-
 *   equivariant in tokens) bipolarization measure. It fills the
 *   "absolute corner" of the polarization invariance cube that the
 *   relative Wolfson index (axis-46, W = (mu/m)*(2T-G), dimensionless)
 *   leaves empty. The relationship to Wolfson is
 *
 *     FW / W = 2 * m
 *
 *   i.e. the two indices differ by TWICE THE MEDIAN. Because the
 *   median varies independently across sources (sources with the
 *   same Wolfson can have very different medians, and vice versa),
 *   FW is NOT a constant reparameterization of any prior axis -- it
 *   is a genuine new cross-source signal whose source ranking can
 *   diverge from Wolfson's whenever median spreads diverge from
 *   bipolarization-strength spreads.
 *
 *   Sign of FW (inherits from 2T - G):
 *     FW >  0  the per-day distribution is MORE BIPOLARIZED than its
 *              within-Gini baseline (mass pulled away from the median
 *              into the two tails), absolute-units edition.
 *     FW == 0  bipolarization matches the within-Gini baseline.
 *     FW <  0  ANTI-polarized; mass concentrated AROUND the median
 *              relative to its overall Gini.
 *
 *   Headline question:
 *   **"For each source, in absolute token units, how much daily mass
 *     is pulled AWAY FROM THE MEDIAN beyond what its overall
 *     inequality alone would imply?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-51):
 *
 *   axis-32 daily-token-gini-coefficient: Gini = (1/(2*n^2*mu)) *
 *     sum_i sum_j |y_i - y_j|. Gini is dimensionless and dispersion-
 *     from-mean. FW is a MEDIAN-anchored ABSOLUTE-units bipolar
 *     functional; it uses Gini as one of two inputs but corrects it
 *     against the half-Lorenz median gap and re-units to tokens.
 *   axes-33/34/37/49 GE(0)/GE(1)/GE(2)/GE(-1): SHARE-MOMENT family,
 *     dimensionless, no median anchor. FW is median-anchored and in
 *     absolute units.
 *   axis-35 pietra / axis-42 hoover: SINGLE-POINT L_inf Lorenz gaps
 *     at the MEAN rank, dimensionless. FW is at the MEDIAN rank with
 *     a Gini correction, in token units.
 *   axes-36/44 atkinson/kolm-pollak: CRRA/CARA welfare-equivalent
 *     loss functionals. FW has no welfare functional, no aversion
 *     parameter.
 *   axis-39 zenga: lower-mean / upper-mean ratio, dimensionless. FW
 *     is a Lorenz-curve two-input functional, in tokens.
 *   axis-40 palma: top-decile / bottom-four-decile ratio, dimension-
 *     less. Different rank cuts, no Gini correction.
 *   axis-41 fgt: one-sided lower-tail threshold-anchored functional.
 *     FW is two-sided, threshold-FREE, median-anchored.
 *   axis-43 bonferroni / axis-45 mehran / axis-47 sgini: rank-weighted
 *     PARTIAL-MEAN kernels (cumulative-mean weights, dimensionless).
 *     FW is a single-point Lorenz reading at the median anchored
 *     against Gini, in token units.
 *   axis-46 daily-token-wolfson-polarization-index: RELATIVE Wolfson
 *     W = (mu/m)*(2T - G), DIMENSIONLESS. FW is the ABSOLUTE form
 *     FW = 2*mu*(2T - G), in TOKEN UNITS. Ratio FW/W = 2*m varies
 *     across sources -- a real cross-source decoupling. No constant
 *     reparameterization exists when comparing across sources whose
 *     medians differ.
 *   axis-48 chakravarty: parametric concave share-power averaging,
 *     dimensionless. FW has no power exponent, is in absolute units.
 *   axis-50 amato: Lorenz-curve ARC LENGTH, dimensionless and
 *     translation-INVARIANT in shares. FW is a two-point Lorenz
 *     reading anchored at the median, in token units.
 *   axis-51 esteban-ray: identification-alienation pairwise-distance
 *     polarization with super-linear identification weight. FW is
 *     single-point Lorenz reading at the median (no pairwise sum,
 *     no identification weighting).
 *
 *   THE INVARIANCE CORNER. Let the cube of (rank-anchor, scale-
 *   invariance) cross-classify polarization measures:
 *     - Gini-family (mean-anchor, scale-invariant)
 *     - Kolm-Pollak (mean-anchor, translation-invariant in absolute
 *       units)
 *     - Wolfson (median-anchor, scale-invariant)
 *     - Foster-Wolfson (median-anchor, scale-EQUIVARIANT in absolute
 *       token units) <-- THIS AXIS
 *   The fourth corner is empty in the prior axis catalogue. Filling
 *   it gives us the only median-anchored polarization signal denominated
 *   in real token units.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): FW degenerate for n<2; default 4 ensures
 *     a meaningful median-anchored Lorenz reading (matches axis-46).
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'fw'): 'fw' | 'tokens' | 'days' | 'source' |
 *     'meanDaily' | 'medianDaily' | 'halfLorenzGap'.
 *   - `minFw` (signed): display filter on FW. FW can be negative;
 *     degenerate rows always pass.
 *   - `includeWolfsonAnchor` (refinement): per-row `wolfson` (axis-46
 *     functional on the same per-day vector) and `fwOverWolfson`
 *     ratio (which equals 2 * median up to numerical precision; we
 *     surface it as the cross-axis identity audit).
 */
import type { QueueLine } from './types.js';
import { wolfsonOfVector } from './dailytokenwolfsonpolarizationindex.js';

export type DailyTokenFosterWolfsonSort =
  | 'fw'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'medianDaily'
  | 'halfLorenzGap';

export interface DailyTokenFosterWolfsonOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenFosterWolfsonSort;
  /** Display filter: drop rows whose fw < this signed value. Default null = no filter. */
  minFw?: number | null;
  /** Refinement: surface Wolfson (axis-46) on the same vector + fw/wolfson identity. */
  includeWolfsonAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenFosterWolfsonSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Foster-Wolfson absolute bipolarization in token units. Sign NOT constrained. */
  fw: number;
  /** Half-Lorenz gap T = 0.5 - L(0.5). In [0, 0.5]. */
  halfLorenzGap: number;
  /** Gini on the same vector (axis-32 functional). In [0, 1]. */
  gini: number;
  /** True iff total = 0 OR n < 2 OR median = 0. fw = 0 in this case. */
  degenerate: boolean;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Wolfson (axis-46) on the same vector. */
  wolfson?: number;
  /** Refinement: fw / wolfson ratio. Equals 2 * median at machine precision. */
  fwOverWolfson?: number;
}

export interface DailyTokenFosterWolfsonReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenFosterWolfsonSort;
  minFw: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinFw: number;
  droppedTopSources: number;
  sources: DailyTokenFosterWolfsonSourceRow[];
}

/**
 * Foster-Wolfson absolute bipolarization index of a non-negative
 * numeric vector.
 *
 *     FW = 2 * mu * (2 * T - G)
 *     T  = 0.5 - L(0.5)
 *     G  = Gini(values)
 *
 * Returns { fw: 0, degenerate: true } for empty input, n < 2,
 * all-zero vector, or median = 0. Throws on negative or non-finite
 * input.
 */
export function fosterWolfsonOfVector(values: number[]): {
  fw: number;
  mean: number;
  median: number;
  total: number;
  gini: number;
  halfLorenzGap: number;
  degenerate: boolean;
} {
  const w = wolfsonOfVector(values);
  if (w.degenerate) {
    return {
      fw: 0,
      mean: w.mean,
      median: w.median,
      total: w.total,
      gini: w.gini,
      halfLorenzGap: w.halfLorenzGap,
      degenerate: true,
    };
  }
  // FW = 2 * mu * (2T - G); independent of median.
  const fw = 2 * w.mean * (2 * w.halfLorenzGap - w.gini);
  return {
    fw,
    mean: w.mean,
    median: w.median,
    total: w.total,
    gini: w.gini,
    halfLorenzGap: w.halfLorenzGap,
    degenerate: false,
  };
}

export function buildDailyTokenFosterWolfsonIndex(
  queue: QueueLine[],
  opts: DailyTokenFosterWolfsonOptions = {},
): DailyTokenFosterWolfsonReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (FW degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minFw = opts.minFw ?? null;
  if (minFw !== null && !Number.isFinite(minFw)) {
    throw new Error(`minFw must be a finite number or null (got ${opts.minFw})`);
  }
  const sort: DailyTokenFosterWolfsonSort = opts.sort ?? 'fw';
  const validSorts: DailyTokenFosterWolfsonSort[] = [
    'fw',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'medianDaily',
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
  const rows: DailyTokenFosterWolfsonSourceRow[] = [];

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
    const fw = fosterWolfsonOfVector(values);
    const row: DailyTokenFosterWolfsonSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      fw: fw.fw,
      halfLorenzGap: fw.halfLorenzGap,
      gini: fw.gini,
      degenerate: fw.degenerate,
      meanDailyTokens: fw.mean,
      medianDailyTokens: fw.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeWolfsonAnchor) {
      const w = wolfsonOfVector(values);
      row.wolfson = w.wolfson;
      // fw / wolfson should equal 2 * median (closed-form identity).
      row.fwOverWolfson =
        Math.abs(w.wolfson) > 1e-15 ? fw.fw / w.wolfson : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinFw = 0;
  let filtered = rows;
  if (minFw !== null) {
    const next: DailyTokenFosterWolfsonSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.fw >= minFw) next.push(r);
      else droppedBelowMinFw += 1;
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
        primary = b.medianDailyTokens - a.medianDailyTokens;
        break;
      case 'halfLorenzGap':
        primary = b.halfLorenzGap - a.halfLorenzGap;
        break;
      case 'fw':
      default:
        primary = b.fw - a.fw;
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
    minFw,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinFw,
    droppedTopSources,
    sources: kept,
  };
}
