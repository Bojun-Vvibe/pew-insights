/**
 * daily-token-amato-index: per-source AMATO INDEX (Lorenz-curve
 * arc length) of the per-day total_tokens distribution. FIFTIETH
 * cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by Amato's index
 * (Amato 1968, "Metodologia statistica strutturale", revisited by
 * Arnold 1987 and Kakwani 1980 §4):
 *
 *     A(L) = total ARC LENGTH of the Lorenz curve from (0,0) to (1,1)
 *
 * For a non-negative vector sorted ascending into x_(1) <= ... <= x_(n)
 * with total S = sum x_i, the Lorenz curve is piecewise-linear with
 * segments connecting (i/n, S_i/S) and (i+1)/n, S_{i+1}/S). Each
 * segment has horizontal length 1/n and vertical length x_(i+1)/S, so
 *
 *     A(L) = sum_{i=1..n} sqrt( (1/n)^2 + (x_(i)/S)^2 )
 *
 *   Range: A(L) in [sqrt(2), 2].
 *     - LOWER BOUND sqrt(2) attained iff every D_i = mu (perfect
 *       equality; the Lorenz curve is the diagonal y = x of length
 *       sqrt(2) on the unit square).
 *     - UPPER BOUND 2 approached (never attained for finite n) when a
 *       single day holds all the mass: the curve is the L-shape of two
 *       unit segments, total length 2.
 *   Strictly increasing in any rank-preserving Pigou-Dalton spread by
 *   the convexity of sqrt() composed with an L^2 norm of the share
 *   vector with a fixed horizontal pitch.
 *
 *   Headline question:
 *   **"For each source, how STRETCHED is the Lorenz curve of per-day
 *     token mass relative to the equality diagonal?"**
 *
 *   Amato's index measures the GEOMETRIC LENGTH of the Lorenz curve.
 *   It is a SHAPE functional: orthogonal in functional class to
 *   - AREA functionals (Gini = 2 * area between Lorenz and diagonal)
 *   - SINGLE-POINT functionals (Pietra, Hoover = max gap; Wolfson,
 *     Palma = single rank cuts)
 *   - SHARE-MOMENT functionals (Theil-L=GE(0), Theil-T=GE(1),
 *     GE(2), GE(-1), Atkinson, Chakravarty)
 *   - WELFARE-EQUIVALENT functionals (Atkinson, Kolm-Pollak)
 *   - RANK-WEIGHTED PARTIAL-MEAN functionals (Bonferroni, Mehran,
 *     S-Gini, Zenga)
 *
 *   The arc-length functional has a different sensitivity profile:
 *   it weights each Lorenz segment by sqrt(1/n^2 + s_i^2) where s_i =
 *   x_(i)/S is the share at rank i. Small shares contribute ~ 1/n
 *   each; large shares contribute ~ s_i. So Amato is dominated by the
 *   LARGEST shares (top-tail-sensitive) but with sqrt() compression
 *   rather than the squared compression of GE(2). This places Amato
 *   in a structurally distinct slot from every prior axis.
 *
 * Why orthogonal to every prior daily-token axis (axes 32-49):
 *
 *   axis-32 daily-token-gini-coefficient: Gini = 2 * AREA between the
 *     Lorenz curve and the equality diagonal. Amato = ARC LENGTH of
 *     the Lorenz curve. Two completely different functionals of the
 *     same curve. Two distributions can have identical Gini and
 *     different Amato (Amato is more sensitive to the TOP END of the
 *     Lorenz curve, where the slope is largest).
 *   axis-33/34/37/49 GE(0)/GE(1)/GE(2)/GE(-1): SHARE-MOMENT family.
 *     Amato is a non-moment Lorenz-shape functional.
 *   axis-35 daily-token-pietra-ratio / axis-42 hoover-index:
 *     SINGLE-POINT L_infinity Lorenz gaps at the mean rank. Amato
 *     integrates a function of the slope along the entire curve.
 *   axis-36 daily-token-atkinson-index: power-mean welfare-equivalent
 *     with CRRA penalty. Amato has no welfare parameter.
 *   axis-39 daily-token-zenga-index: lower-mean / upper-mean ratio,
 *     rank-anchored. Amato is rank-aggregated (sums over all ranks).
 *   axis-40 daily-token-palma-ratio: TWO-point Lorenz ratio. Amato is
 *     n-point.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold
 *     functional. Amato is two-sided, threshold-FREE.
 *   axis-43 bonferroni / axis-45 mehran: rank-weighted partial-mean
 *     KERNELS. Amato is the Euclidean ARC LENGTH of the curve, not a
 *     weighted partial-mean.
 *   axis-44 kolm-pollak: ABSOLUTE (translation-invariant). Amato is
 *     RELATIVE (scale-invariant; depends only on shares).
 *   axis-46 daily-token-wolfson-polarization-index: median-anchored
 *     bipolarization, Lorenz-DIFFERENCE-at-the-median functional.
 *     Amato is rank-aggregated arc length, no median anchor.
 *   axis-47 sgini: rank-kernel single-parameter family. Amato is a
 *     parameter-free arc length.
 *   axis-48 chakravarty: parametric concave share-power averaging.
 *     Amato is parameter-free L^2 segment summation.
 *   All time-ordered axes (autocorrelation, run-length, sign-runs,
 *     z-score-extremes): Amato is permutation-invariant (depends only
 *     on the multiset of shares), so orthogonal by construction.
 *
 *   THE SHARED IDENTITY WITH KAKWANI'S K-INDEX. Amato's index A(L) is
 *   strictly monotonically related to Kakwani's normalized arc-length
 *   index K = (A(L) - sqrt(2)) / (2 - sqrt(2)) in [0, 1]. We surface
 *   K as a refinement so the reader can read Amato in its raw
 *   geometric units AND in the normalized [0, 1] form simultaneously.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 3): Amato is degenerate-trivial for n < 2;
 *     we require >= 3 days to avoid two-point trivialities.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'amato'): 'amato' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'kakwani'.
 *   - `minAmato` (default 0 = no filter): display filter; values
 *     below sqrt(2) are mathematically impossible so any positive
 *     filter is a "stretch floor".
 *   - `includeKakwani` (refinement): per-row `kakwani` (Kakwani's
 *     normalized arc-length index K = (A - sqrt(2)) / (2 - sqrt(2))
 *     in [0, 1]) and `amatoExcessOverEquality` = A - sqrt(2) (raw
 *     stretch above the equality diagonal).
 *   - `includeGiniAnchor` (refinement): per-row `gini` (axis-32
 *     functional on the SAME per-day vector) and `amatoOverGini`
 *     ratio. Surfaces the area-vs-arc-length functional decoupling;
 *     this ratio is NOT constant across distributions.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenAmatoSort =
  | 'amato'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'kakwani';

export interface DailyTokenAmatoOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenAmatoSort;
  /** Display filter: drop rows whose amato < this. In [sqrt(2), 2]. Default 0 = no filter. */
  minAmato?: number;
  /**
   * Refinement: when true, every emitted row gains `kakwani`
   * (normalized arc-length index in [0, 1]) and
   * `amatoExcessOverEquality` (A - sqrt(2)).
   */
  includeKakwani?: boolean;
  /**
   * Refinement: when true, every emitted row gains `gini` (Gini on
   * the SAME per-day vector) and `amatoOverGini` ratio. Surfaces the
   * area-vs-arc-length functional decoupling.
   */
  includeGiniAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenAmatoSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one positive observation. */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Amato index (Lorenz arc length). In [sqrt(2), 2]. */
  amato: number;
  /** True iff total = 0 OR n < 2. amato = sqrt(2) in this case. */
  degenerate: boolean;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Kakwani normalized arc-length K in [0, 1]. */
  kakwani?: number;
  /** Refinement: A - sqrt(2). Raw stretch above the equality diagonal. */
  amatoExcessOverEquality?: number;
  /** Refinement: Gini on the same vector. */
  gini?: number;
  /** Refinement: amato / gini ratio. NaN if gini = 0. */
  amatoOverGini?: number;
}

export interface DailyTokenAmatoReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenAmatoSort;
  minAmato: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinAmato: number;
  droppedTopSources: number;
  sources: DailyTokenAmatoSourceRow[];
}

export const SQRT2 = Math.SQRT2;

function medianOfSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2] as number;
  const a = sorted[n / 2 - 1] as number;
  const b = sorted[n / 2] as number;
  return (a + b) / 2;
}

/**
 * Amato's index: arc length of the Lorenz curve for a non-negative
 * vector. Returns sqrt(2) for n < 2, empty input, or all-zero vector
 * (equality diagonal length). Throws on negative or non-finite input.
 *
 *     A(L) = sum_{i=1..n} sqrt( (1/n)^2 + (x_(i)/S)^2 )
 *
 * For perfect equality (every x_i = mu) every share is 1/n so
 *     A = n * sqrt(1/n^2 + 1/n^2) = n * sqrt(2)/n = sqrt(2).
 * For maximal inequality (one entry has all mass) one segment has
 * length sqrt(1/n^2 + 1) and the n-1 others have length 1/n; total
 * approaches 2 as n -> inf.
 */
export function amatoOfVector(values: number[]): {
  amato: number;
  mean: number;
  median: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      amato: SQRT2,
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
        `amatoOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      amato: SQRT2,
      mean: 0,
      median: 0,
      total: 0,
      degenerate: true,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  const median = medianOfSorted(sorted);
  const dx = 1 / n;
  const dx2 = dx * dx;
  let amato = 0;
  for (let i = 0; i < n; i += 1) {
    const s = (sorted[i] as number) / total;
    amato += Math.sqrt(dx2 + s * s);
  }
  return {
    amato,
    mean: mu,
    median,
    total,
    degenerate: false,
  };
}

/**
 * Kakwani's normalized arc-length index:
 *
 *     K = (A(L) - sqrt(2)) / (2 - sqrt(2))   in [0, 1].
 *
 * K = 0 iff perfect equality; K -> 1 as a single entry holds all mass
 * (and n -> inf).
 */
export function kakwaniArcLengthIndex(amato: number): number {
  return (amato - SQRT2) / (2 - SQRT2);
}

export function buildDailyTokenAmatoIndex(
  queue: QueueLine[],
  opts: DailyTokenAmatoOptions = {},
): DailyTokenAmatoReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Amato is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAmato = opts.minAmato ?? 0;
  if (!Number.isFinite(minAmato) || minAmato < 0) {
    throw new Error(
      `minAmato must be a non-negative finite number (got ${opts.minAmato})`,
    );
  }
  const sort: DailyTokenAmatoSort = opts.sort ?? 'amato';
  const validSorts: DailyTokenAmatoSort[] = [
    'amato',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'kakwani',
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
  const rows: DailyTokenAmatoSourceRow[] = [];

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
    const a = amatoOfVector(values);
    const row: DailyTokenAmatoSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      amato: a.amato,
      degenerate: a.degenerate,
      meanDailyTokens: a.mean,
      medianDailyTokens: a.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeKakwani) {
      row.kakwani = kakwaniArcLengthIndex(a.amato);
      row.amatoExcessOverEquality = a.amato - SQRT2;
    }
    if (opts.includeGiniAnchor) {
      const g = giniOfVector(values);
      row.gini = g;
      row.amatoOverGini = g > 0 ? a.amato / g : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAmato = 0;
  let filtered = rows;
  if (minAmato > 0) {
    const next: DailyTokenAmatoSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.amato >= minAmato) next.push(r);
      else droppedBelowMinAmato += 1;
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
      case 'kakwani': {
        const ak = a.kakwani ?? kakwaniArcLengthIndex(a.amato);
        const bk = b.kakwani ?? kakwaniArcLengthIndex(b.amato);
        primary = bk - ak;
        break;
      }
      case 'amato':
      default:
        primary = b.amato - a.amato;
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
    minAmato,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinAmato,
    droppedTopSources,
    sources: kept,
  };
}
