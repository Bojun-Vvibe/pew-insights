/**
 * daily-token-hoover-index: per-source HOOVER INDEX (a.k.a. the
 * Robin Hood / Schutz / Pietra-twin index) of the per-day total_tokens
 * distribution. FORTY-SECOND cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Hoover index
 * (Hoover 1936; Schutz 1951):
 *
 *     hoover = 0.5 * sum_i | s_i - 1/n |
 *
 *   where s_i = D_i / sum(D) is the i-th day's mass share. Range
 *   `[0, 1)`. hoover = 0 iff every day carries the same mass share
 *   (perfect equality across days). hoover -> 1 iff all mass
 *   concentrates on a vanishing fraction of days. The classical
 *   reading (income-distribution literature) is the literal "Robin
 *   Hood" reading: hoover is the smallest fraction of total income
 *   that would have to be redistributed away from the above-mean
 *   units to bring the population to perfect equality.
 *
 *   Equivalently, hoover = sum_{i: s_i > 1/n} (s_i - 1/n) -- the
 *   total above-uniform excess held by the rich half. The two halves
 *   of the absolute deviation collapse to the same number because
 *   sum_i (s_i - 1/n) = 0 by construction.
 *
 *   It is also the L_infinity Lorenz gap measured at the rank
 *   x = (count of days strictly below the mean) / n -- i.e. it sits
 *   on the SAME Lorenz curve as the Gini and the Pietra ratio, but
 *   reads the gap at the EQUAL-WEIGHTS rank cut (where all days
 *   carry weight 1/n) rather than at the EQUAL-MASS rank cut (where
 *   the cumulative mass reaches its own mean) used by Pietra. The
 *   two cutoffs collapse to each other only for the 2-day case;
 *   otherwise hoover != pietra.
 *
 * Why orthogonal to every prior daily-token axis (the central design
 * point of this axis):
 *
 *   axis-32 daily-token-gini-coefficient: Gini is the Lorenz-AREA
 *     reading (a rank-weighted L1 of all share differences). Hoover
 *     is a SHARE-SPACE L1 reading at uniform reference (no rank
 *     weighting). Two sources with identical Hoover routinely have
 *     different Gini if the bulk-mass migration is between same-rank
 *     deviations vs cross-rank deviations.
 *   axis-35 daily-token-pietra-ratio: Pietra is the L_infinity Lorenz
 *     gap measured at the EQUAL-MASS rank cut. Hoover is the
 *     EQUAL-WEIGHTS-rank L_infinity reading (rank where every unit
 *     carries weight 1/n). Same Lorenz curve, different reading; the
 *     two collapse only when n=2 or under a degenerate distribution.
 *   axis-36 daily-token-atkinson-index: Atkinson is a CRRA welfare
 *     loss with a smooth penalty across all values. Hoover is a
 *     hard L1-deviation-from-uniform with NO curvature parameter
 *     and NO welfare interpretation -- a "transfer cost" measure,
 *     not a "welfare loss" measure.
 *   axis-37/38/39 daily-token-theil-l/theil-t/ge2: GE(alpha) family
 *     summaries (logarithmic / log-linear / quadratic moments of
 *     the share ratio). All are MOMENT-based smooth indices. Hoover
 *     is an L1-DEVIATION-from-uniform; there is no smooth functional
 *     of share ratios that recovers it.
 *   axis-40 daily-token-palma-ratio: Palma reads only TWO points on
 *     the Lorenz curve (90/40 rank cuts). Hoover reads a SINGLE L1
 *     summary across ALL share-deviations. Palma is unbounded;
 *     Hoover is in [0, 1).
 *   axis-41 daily-token-fgt-index: FGT is a ONE-SIDED LOWER-TAIL
 *     poverty index threshold-anchored at z = lineFraction * mean.
 *     Hoover is two-sided (uses both above-mean and below-mean
 *     deviations symmetrically) and threshold-FREE. Two sources can
 *     have identical FGT but very different Hoover.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Hoover is
 *     permutation-invariant, so orthogonal by construction.
 *
 *   ORTHOGONALITY WITNESS / cross-anchor: the literal Hoover/Gini
 *   ratio. For ANY non-degenerate Lorenz curve, the relationship
 *   `hoover = (1/2) * E[|X - E[X]|]/E[X]` and Gini = E[|X - X'|]/
 *   (2*E[X]) place the two indices on the same Lorenz curve but at
 *   different functional readings. The empirical ratio hoover/gini
 *   sits in (0, 1] and equals 1 iff the distribution is two-point
 *   (binary). The DEVIATION from the textbook reference value
 *   `0.75` (hoover/gini under a unit-uniform distribution) is the
 *   distributional-shape diagnostic exposed by this axis.
 *   Set to NaN when gini = 0 (degenerate; both should be 0).
 *
 *   Headline question:
 *   **"For each source, what FRACTION of total token mass would have
 *     to be redistributed from above-mean days to below-mean days
 *     to flatten the per-day distribution? And how does the empirical
 *     hoover/gini Lorenz-shape ratio compare to the textbook 0.75
 *     reference?"**
 *
 * ZERO DAYS: a zero-mass day contributes a (1/n) excess to the
 *   above-uniform deficit on the LOW side. Zero-mass days are
 *   always BELOW the mean (strict <) so they always count toward
 *   `nBelowMean` and toward `belowMeanDeficit`. A degenerate
 *   all-zero source returns hoover = 0 with `degenerate: true`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): Hoover is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'hoover'): 'hoover' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'aboveMeanExcess' | 'hooverOverGini'.
 *   - `minHoover` (default 0): display filter; in [0, 1).
 *   - `includeReferenceDeviation` (refinement): per-row deviation
 *     of hoover/gini from the textbook 0.75 reference.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';
import { pietraOfVector } from './dailytokenpietraratio.js';

export type DailyTokenHooverSort =
  | 'hoover'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'aboveMeanExcess'
  | 'hooverOverGini';

export interface DailyTokenHooverOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenHooverSort;
  /** Display filter: drop rows whose hoover < this. In [0, 1). */
  minHoover?: number;
  /**
   * Refinement: when true, every emitted row gains a
   * `referenceDeviation` field = (hoover/gini) - 0.75. The 0.75
   * reference comes from the unit-uniform Lorenz comparator. The
   * deviation is the orthogonality witness vis-a-vis Gini: it can
   * be non-zero even when both Hoover and Gini move identically
   * under a single Pigou-Dalton transfer.
   */
  includeReferenceDeviation?: boolean;
  /**
   * Refinement (v0.6.283): when true, every emitted row gains a
   * `pietra` field and a `hooverMinusPietra` field. Both Hoover
   * and Pietra are L_infinity Lorenz gaps but at different rank
   * cuts: Hoover at the EQUAL-WEIGHTS cut (every day = 1/n
   * weight), Pietra at the EQUAL-MASS cut (cumulative mass reaches
   * the mean). The identity `hoover >= pietra` holds for any
   * non-negative vector; equality iff n=2 or under degenerate
   * concentration. The gap `hoover - pietra >= 0` is the
   * cross-rank-cut diagnostic that no single L_infinity reading
   * can produce on its own.
   */
  includePietraCrossAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenHooverSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Hoover index = 0.5 * sum |s_i - 1/n|. In [0, 1). */
  hoover: number;
  /**
   * Total share-mass strictly above the uniform 1/n line. By
   * construction equals hoover (the two halves of the absolute
   * deviation are equal). Surfaced for cross-anchoring.
   */
  aboveMeanExcess: number;
  /**
   * Total share-mass deficit below uniform = sum_{i: s_i < 1/n}
   * (1/n - s_i). Equals hoover; surfaced for sanity-checking.
   */
  belowMeanDeficit: number;
  /** Number of days strictly above the per-source mean. */
  nAboveMean: number;
  /** Number of days strictly below the per-source mean. */
  nBelowMean: number;
  /** Number of days exactly at the per-source mean. */
  nAtMean: number;
  /**
   * True iff total = 0 (all-zero per-day vector). hoover = 0 in
   * this case but the reading is informationally degenerate.
   */
  degenerate: boolean;
  /**
   * Cross-anchor: Gini on the same vector. The headline LORENZ-
   * SHAPE indicator of THIS axis is `hooverOverGini`, which
   * requires both to compute. Two indices on the SAME Lorenz curve
   * read at different functional points.
   */
  gini: number;
  /**
   * Lorenz-shape ratio hoover/gini in (0, 1]. Equals 1 iff the
   * distribution is two-point. The textbook reference value under
   * a unit-uniform Lorenz curve is 0.75.
   *   = NaN when gini = 0 (degenerate; both should be 0)
   */
  hooverOverGini: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * Refinement: hooverOverGini - 0.75. Present iff caller set
   * `includeReferenceDeviation: true`. NaN propagates if
   * hooverOverGini is NaN.
   */
  referenceDeviation?: number;
  /**
   * Refinement (v0.6.283): Pietra ratio on the same per-day vector
   * (axis-35 cross-anchor). Present iff caller set
   * `includePietraCrossAnchor: true`.
   */
  pietra?: number;
  /**
   * Refinement (v0.6.283): hoover - pietra. By construction >= 0
   * for any non-negative vector. Equality iff n=2 or degenerate.
   * Present iff caller set `includePietraCrossAnchor: true`.
   */
  hooverMinusPietra?: number;
}

export interface DailyTokenHooverReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenHooverSort;
  minHoover: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinHoover: number;
  droppedTopSources: number;
  sources: DailyTokenHooverSourceRow[];
}

/**
 * Hoover index of a non-negative vector. Returns the index plus
 * sanity-check fields (above/below splits, mean) to support the
 * row-level surfaced columns.
 *
 * Returns:
 *   - All zeros + degenerate=true for n < 2 or empty / all-zero.
 *   - hoover in [0, 1) otherwise.
 *
 * Throws on negative or non-finite input.
 */
export function hooverOfVector(values: number[]): {
  hoover: number;
  aboveMeanExcess: number;
  belowMeanDeficit: number;
  nAboveMean: number;
  nBelowMean: number;
  nAtMean: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    return {
      hoover: 0,
      aboveMeanExcess: 0,
      belowMeanDeficit: 0,
      nAboveMean: 0,
      nBelowMean: 0,
      nAtMean: n,
      mean: n === 1 ? (values[0] as number) : 0,
      total: n === 1 ? (values[0] as number) : 0,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `hooverOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      hoover: 0,
      aboveMeanExcess: 0,
      belowMeanDeficit: 0,
      nAboveMean: 0,
      nBelowMean: 0,
      nAtMean: n,
      mean: 0,
      total: 0,
      degenerate: true,
    };
  }
  const uniform = 1 / n;
  let absSum = 0;
  let above = 0;
  let below = 0;
  let nAbove = 0;
  let nBelow = 0;
  let nAt = 0;
  for (const v of values) {
    const s = v / total;
    const d = s - uniform;
    absSum += Math.abs(d);
    if (d > 0) {
      above += d;
      nAbove += 1;
    } else if (d < 0) {
      below += -d;
      nBelow += 1;
    } else {
      nAt += 1;
    }
  }
  return {
    hoover: 0.5 * absSum,
    aboveMeanExcess: above,
    belowMeanDeficit: below,
    nAboveMean: nAbove,
    nBelowMean: nBelow,
    nAtMean: nAt,
    mean: total / n,
    total,
    degenerate: false,
  };
}

export function buildDailyTokenHooverIndex(
  queue: QueueLine[],
  opts: DailyTokenHooverOptions = {},
): DailyTokenHooverReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Hoover is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minHoover = opts.minHoover ?? 0;
  if (!Number.isFinite(minHoover) || minHoover < 0 || minHoover >= 1) {
    throw new Error(
      `minHoover must be a finite number in [0, 1) (got ${opts.minHoover})`,
    );
  }
  const sort: DailyTokenHooverSort = opts.sort ?? 'hoover';
  const validSorts: DailyTokenHooverSort[] = [
    'hoover',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'aboveMeanExcess',
    'hooverOverGini',
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
  const rows: DailyTokenHooverSourceRow[] = [];

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
    const h = hooverOfVector(values);
    const gini = giniOfVector(values);
    const hooverOverGini = gini === 0 ? Number.NaN : h.hoover / gini;
    const row: DailyTokenHooverSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hoover: h.hoover,
      aboveMeanExcess: h.aboveMeanExcess,
      belowMeanDeficit: h.belowMeanDeficit,
      nAboveMean: h.nAboveMean,
      nBelowMean: h.nBelowMean,
      nAtMean: h.nAtMean,
      degenerate: h.degenerate,
      gini,
      hooverOverGini,
      meanDailyTokens: h.mean,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeReferenceDeviation) {
      row.referenceDeviation = Number.isNaN(hooverOverGini)
        ? Number.NaN
        : hooverOverGini - 0.75;
    }
    if (opts.includePietraCrossAnchor) {
      const p = pietraOfVector(values);
      row.pietra = p.pietra;
      row.hooverMinusPietra = h.hoover - p.pietra;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinHoover = 0;
  let filtered = rows;
  if (minHoover > 0) {
    const next: DailyTokenHooverSourceRow[] = [];
    for (const r of rows) {
      if (r.hoover >= minHoover) next.push(r);
      else droppedBelowMinHoover += 1;
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
      case 'aboveMeanExcess':
        primary = b.aboveMeanExcess - a.aboveMeanExcess;
        break;
      case 'hooverOverGini':
        primary = cmpNum(a.hooverOverGini, b.hooverOverGini);
        break;
      case 'hoover':
      default:
        primary = b.hoover - a.hoover;
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
    minHoover,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinHoover,
    droppedTopSources,
    sources: kept,
  };
}
