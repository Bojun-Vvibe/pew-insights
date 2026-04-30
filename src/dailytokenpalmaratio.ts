/**
 * daily-token-palma-ratio: per-source PALMA RATIO of the per-day
 * total_tokens distribution. FORTIETH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Palma ratio
 * (Palma 2011; Cobham & Sumner 2013):
 *
 *     palma = mass(top 10% of days) / mass(bottom 40% of days)
 *
 *   where days are first sorted ASCENDING by D_i and then the bottom-
 *   40% and top-10% rank-cut shares are read off the empirical Lorenz
 *   curve. Range `[0, +inf)`. palma = 1 iff the top decile carries
 *   exactly the same total mass as the bottom 4 deciles. palma > 1 is
 *   the canonical "concentration" reading: the few largest days
 *   dominate the long thin bottom 40%.
 *
 *   The classical reading (income-distribution literature) is that
 *   the middle 50% (deciles 5..9) carries a remarkably stable share
 *   across sources, and that ALL the inequality story lives in the
 *   tug-of-war between the bottom 40% and the top 10%. The ratio is
 *   the literal expression of that tug-of-war, applied here to per-
 *   source token-mass-by-day instead of to incomes.
 *
 * Why orthogonal to every prior daily-token axis (the central design
 * point of this axis):
 *
 *   axis-32 daily-token-gini-coefficient: Gini is the rank-weighted
 *     L1 of all share differences (the FULL Lorenz curve area). The
 *     Palma ratio reads only TWO points on the same Lorenz curve
 *     (the 40th and 90th percentile cut). Two sources with identical
 *     Gini routinely have very different Palma ratios when the bulk
 *     mass migrates between the middle deciles and the tails.
 *   axis-35 daily-token-pietra-ratio: Pietra is the L_infinity Lorenz
 *     gap (one POINT, the maximum vertical Lorenz gap, anywhere along
 *     the curve). Palma is a RATIO of two bounded mass shares at
 *     FIXED rank cutoffs. Same Lorenz curve, different reading.
 *   axis-36 daily-token-atkinson-index: Atkinson is bounded in [0, 1]
 *     (CRRA welfare loss). Palma is unbounded above. Atkinson
 *     parametrically penalises bottom shortfalls; Palma is a hard
 *     ratio of two specific deciles.
 *   axis-37/38/39 daily-token-theil-l/theil-t/ge2: GE(alpha) family
 *     summaries (logarithmic / log-linear / quadratic moments of the
 *     share ratio). Palma is RANK-CUTOFF-BASED, NOT moment-based;
 *     immune to the within-decile distribution as long as the rank-
 *     cut decile shares are unchanged.
 *   axis-34 daily-token-zenga-index: Zenga averages bottom-vs-top
 *     mean ratios over EVERY rank cut. Palma reads only ONE such
 *     ratio (the 40/10 cut) and reports it directly without
 *     averaging. Zenga is in [0, 1]; Palma is unbounded above.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Palma is
 *     permutation-invariant, so orthogonal by construction.
 *
 *   The headline derived field is the BOTTOM-40-EXCLUSION RATIO
 *   `palmaOverGini = palma / gini` (cross-anchor on axis-32). Two
 *   indices on the SAME Lorenz curve must move together for any
 *   single transfer; their ratio quantifies how much of the
 *   inequality is concentrated in the rank-cut tug-of-war (top10 vs
 *   bottom40) versus spread across the body of the Lorenz curve.
 *   Cannot be recovered from either axis alone. Set to NaN when
 *   gini = 0 (degenerate; both should be 0).
 *
 *   Headline question:
 *   **"For each source, how many times does the busiest 10% of days
 *     out-weigh the quietest 40% of days in raw token mass? And how
 *     concentrated in this single rank-cut tug-of-war is the
 *     inequality (via the palma/gini Lorenz-shape ratio)?"**
 *
 * EDGE CASE: fewer than 10 days. The literal "top 10%" decile is
 *   undefined when n < 10. We follow the income-distribution
 *   convention and use FRACTIONAL-RANK quantile cutoffs: bottom 40%
 *   = mass at or below the 0.4 quantile (linear interpolation
 *   between adjacent sorted day values), top 10% = mass at or above
 *   the 0.9 quantile. For n >= 10 the cutoffs collapse exactly to
 *   the literal whole-decile reading. For 2 <= n < 10 we use the
 *   fractional reading and surface `interpolatedCutoffs: true` so
 *   downstream consumers can flag rows where a single day straddles
 *   a cutoff. Floor enforced via `--min-days` (default 2).
 *
 *   When a single day's mass spans a cutoff (e.g. day 4 of 10 holds
 *   the 0.4 quantile), the fractional contribution to the bottom
 *   40% slice is `(0.4 - cumulativeRankBelow) / (1/n)` of that
 *   day's mass; the remainder flows into the middle slice.
 *
 * ZERO DAYS: a zero-mass day in the bottom 40% is benign (just
 *   contributes 0). Pure-zero bottom 40% (denominator = 0) yields
 *   palma = +Inf when top 10% > 0. The flag `bottomZero` surfaces
 *   this so consumers can route those rows separately.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): Palma is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'palma'): 'palma' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'topShare' | 'bottomShare' |
 *     'palmaOverGini'.
 *   - `minPalma` (default 0): display filter; in [0, +inf).
 *   - `topQuantile` (default 0.9): rank cutoff for the numerator.
 *   - `bottomQuantile` (default 0.4): rank cutoff for the
 *     denominator. Together (0.9, 0.4) yield the canonical Palma.
 *     Other useful pairs: (0.95, 0.4) "P95-40 ratio", (0.8, 0.2)
 *     "20-20 ratio", (0.95, 0.05) "P95/P5 inter-decile spread".
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenPalmaSort =
  | 'palma'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'topShare'
  | 'bottomShare'
  | 'palmaOverGini';

export interface DailyTokenPalmaOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenPalmaSort;
  /** Display filter: drop rows whose palma < this. In [0, +inf). */
  minPalma?: number;
  /** Top-rank cutoff (default 0.9 => "top 10%"). In (0, 1). */
  topQuantile?: number;
  /** Bottom-rank cutoff (default 0.4 => "bottom 40%"). In (0, 1). */
  bottomQuantile?: number;
  generatedAt?: string;
}

export interface DailyTokenPalmaSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Palma ratio = topShare / bottomShare. In [0, +inf). */
  palma: number;
  /** Mass share of top (1 - topQuantile) of days. In [0, 1]. */
  topShare: number;
  /** Mass share of bottom bottomQuantile of days. In [0, 1]. */
  bottomShare: number;
  /** Mass share of the middle band [bottomQuantile, topQuantile]. */
  middleShare: number;
  /** True iff bottomShare = 0 (palma is +Inf if topShare > 0). */
  bottomZero: boolean;
  /**
   * True iff n < 1/(1 - topQuantile) or n < 1/bottomQuantile, in
   * which case at least one cutoff sits strictly inside a single
   * day's mass and the share is read by linear interpolation across
   * a day's bin (vs. landing exactly on a day boundary).
   */
  interpolatedCutoffs: boolean;
  /**
   * Cross-anchor: Gini on the same vector. The headline LORENZ-
   * SHAPE indicator of THIS axis is `palmaOverGini`, which requires
   * both to compute. Two indices on the SAME Lorenz curve.
   */
  gini: number;
  /**
   * Lorenz-shape ratio: palma / gini. Quantifies how concentrated
   * the inequality is in the 40/10 rank-cut tug-of-war versus
   * spread across the curve body.
   *   = NaN when gini = 0 (degenerate; both should be 0)
   */
  palmaOverGini: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
}

export interface DailyTokenPalmaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenPalmaSort;
  minPalma: number;
  topQuantile: number;
  bottomQuantile: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinPalma: number;
  droppedTopSources: number;
  sources: DailyTokenPalmaSourceRow[];
}

/**
 * Mass-share at a fractional rank quantile q in [0, 1] of a sorted
 * non-negative vector. Reads out the cumulative mass at rank q via
 * linear interpolation between adjacent values when q does not fall
 * on a day boundary.
 *
 * Interpretation: returns the fraction of total mass held by the
 * bottom q fraction of days, in [0, 1]. q=0 returns 0; q=1 returns 1.
 * Pure compute; sortedAsc must be ascending; total must equal sum
 * (caller computes once and reuses).
 */
export function lorenzMassAtRank(
  sortedAsc: number[],
  total: number,
  q: number,
): number {
  const n = sortedAsc.length;
  if (n === 0 || total <= 0) return 0;
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  // Position on rank axis: q * n. Days 1..n have rank cumulative of
  // i/n at the END of their bin. The mass below rank q is the sum
  // of all whole-bin days strictly below q*n plus the fractional
  // tail of the day that straddles q*n.
  const rankPos = q * n;
  const fullDays = Math.floor(rankPos);
  const frac = rankPos - fullDays;
  let cumMass = 0;
  for (let i = 0; i < fullDays; i += 1) cumMass += sortedAsc[i] as number;
  if (frac > 0 && fullDays < n) {
    cumMass += frac * (sortedAsc[fullDays] as number);
  }
  return cumMass / total;
}

/**
 * Palma-style rank-cutoff ratio of a non-negative vector. Returns
 * the canonical Palma when (topQ, bottomQ) = (0.9, 0.4).
 *
 *   topShare    = 1 - lorenzMassAtRank(sortedAsc, total, topQ)
 *   bottomShare = lorenzMassAtRank(sortedAsc, total, bottomQ)
 *   palma       = topShare / bottomShare
 *
 * Returns:
 *   - All zeros for n < 2 or empty / all-zero (degenerate).
 *   - palma = +Inf when bottomShare = 0 and topShare > 0.
 *   - palma = NaN when both topShare and bottomShare are 0
 *     (perfect equality + total = 0 edge).
 *
 * Throws on negative or non-finite input, or invalid quantiles.
 */
export function palmaOfVector(
  values: number[],
  topQ: number = 0.9,
  bottomQ: number = 0.4,
): {
  palma: number;
  topShare: number;
  bottomShare: number;
  middleShare: number;
  mean: number;
  total: number;
  bottomZero: boolean;
  interpolatedCutoffs: boolean;
} {
  if (!Number.isFinite(topQ) || topQ <= 0 || topQ >= 1) {
    throw new Error(`topQ must be in (0, 1) (got ${topQ})`);
  }
  if (!Number.isFinite(bottomQ) || bottomQ <= 0 || bottomQ >= 1) {
    throw new Error(`bottomQ must be in (0, 1) (got ${bottomQ})`);
  }
  if (bottomQ >= topQ) {
    throw new Error(`bottomQ (${bottomQ}) must be < topQ (${topQ})`);
  }
  const n = values.length;
  if (n < 2) {
    return {
      palma: 0,
      topShare: 0,
      bottomShare: 0,
      middleShare: 0,
      mean: 0,
      total: 0,
      bottomZero: false,
      interpolatedCutoffs: false,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `palmaOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      palma: 0,
      topShare: 0,
      bottomShare: 0,
      middleShare: 0,
      mean: 0,
      total: 0,
      bottomZero: false,
      interpolatedCutoffs: false,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const bottomShare = lorenzMassAtRank(sorted, total, bottomQ);
  const topMassBelowTopQ = lorenzMassAtRank(sorted, total, topQ);
  const topShare = 1 - topMassBelowTopQ;
  const middleShare = Math.max(0, 1 - topShare - bottomShare);
  let palma: number;
  if (bottomShare === 0) {
    palma = topShare === 0 ? Number.NaN : Number.POSITIVE_INFINITY;
  } else {
    palma = topShare / bottomShare;
  }
  // A cutoff lands on a day boundary iff q*n is an integer.
  const topPos = topQ * n;
  const botPos = bottomQ * n;
  const onBoundary = (x: number): boolean =>
    Math.abs(x - Math.round(x)) < 1e-12;
  const interpolatedCutoffs = !(onBoundary(topPos) && onBoundary(botPos));
  return {
    palma,
    topShare,
    bottomShare,
    middleShare,
    mean: total / n,
    total,
    bottomZero: bottomShare === 0,
    interpolatedCutoffs,
  };
}

export function buildDailyTokenPalmaRatio(
  queue: QueueLine[],
  opts: DailyTokenPalmaOptions = {},
): DailyTokenPalmaReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Palma is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minPalma = opts.minPalma ?? 0;
  if (!Number.isFinite(minPalma) || minPalma < 0) {
    throw new Error(
      `minPalma must be a non-negative finite number (got ${opts.minPalma})`,
    );
  }
  const topQuantile = opts.topQuantile ?? 0.9;
  const bottomQuantile = opts.bottomQuantile ?? 0.4;
  if (!Number.isFinite(topQuantile) || topQuantile <= 0 || topQuantile >= 1) {
    throw new Error(`topQuantile must be in (0, 1) (got ${opts.topQuantile})`);
  }
  if (
    !Number.isFinite(bottomQuantile) ||
    bottomQuantile <= 0 ||
    bottomQuantile >= 1
  ) {
    throw new Error(
      `bottomQuantile must be in (0, 1) (got ${opts.bottomQuantile})`,
    );
  }
  if (bottomQuantile >= topQuantile) {
    throw new Error(
      `bottomQuantile (${bottomQuantile}) must be < topQuantile (${topQuantile})`,
    );
  }
  const sort: DailyTokenPalmaSort = opts.sort ?? 'palma';
  const validSorts: DailyTokenPalmaSort[] = [
    'palma',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'topShare',
    'bottomShare',
    'palmaOverGini',
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
  const rows: DailyTokenPalmaSourceRow[] = [];

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
    const p = palmaOfVector(values, topQuantile, bottomQuantile);
    const gini = giniOfVector(values);
    let palmaOverGini: number;
    if (gini === 0) {
      palmaOverGini = Number.NaN;
    } else if (!Number.isFinite(p.palma)) {
      palmaOverGini = p.palma; // propagate +Inf or NaN
    } else {
      palmaOverGini = p.palma / gini;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      palma: p.palma,
      topShare: p.topShare,
      bottomShare: p.bottomShare,
      middleShare: p.middleShare,
      bottomZero: p.bottomZero,
      interpolatedCutoffs: p.interpolatedCutoffs,
      gini,
      palmaOverGini,
      meanDailyTokens: p.mean,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinPalma = 0;
  let filtered = rows;
  if (minPalma > 0) {
    const next: DailyTokenPalmaSourceRow[] = [];
    for (const r of rows) {
      if (Number.isFinite(r.palma) && r.palma >= minPalma) next.push(r);
      else if (!Number.isFinite(r.palma) && !Number.isNaN(r.palma)) next.push(r);
      else droppedBelowMinPalma += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    const cmpNum = (av: number, bv: number): number => {
      const aBad = !Number.isFinite(av) && !Number.isNaN(av);
      const bBad = !Number.isFinite(bv) && !Number.isNaN(bv);
      if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      if (aBad && !bBad) return -1;
      if (bBad && !aBad) return 1;
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
      case 'topShare':
        primary = b.topShare - a.topShare;
        break;
      case 'bottomShare':
        primary = b.bottomShare - a.bottomShare;
        break;
      case 'palmaOverGini':
        primary = cmpNum(a.palmaOverGini, b.palmaOverGini);
        break;
      case 'palma':
      default:
        primary = cmpNum(a.palma, b.palma);
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
    minPalma,
    topQuantile,
    bottomQuantile,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinPalma,
    droppedTopSources,
    sources: kept,
  };
}
