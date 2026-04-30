/**
 * daily-token-pietra-ratio: per-source PIETRA / SCHUTZ / HOOVER ratio of
 * the per-day total_tokens distribution.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Pietra ratio.
 *
 * Construction (Pietra 1915 / Schutz 1951 / Hoover 1936 are all the
 * same scalar):
 *
 *   Let mu = mean(D). Then
 *
 *     P = (1 / (2 * n * mu)) * sum_{i=1..n} |D_i - mu|
 *
 *   Equivalently, on the Lorenz curve L(p) of D,
 *
 *     P = max_{p in [0,1]} (p - L(p))
 *
 *   which is achieved at the population share p* = #{i : D_i <= mu} / n.
 *
 *   Interpretation: P is the FRACTION of total mass that would have to
 *   be transferred from above-mean days to below-mean days in order
 *   to flatten the distribution. It is the SINGLE WORST Lorenz gap,
 *   not an integral or an averaged mean-ratio.
 *
 *   Range: [0, 1 - 1/n]. P = 0 iff every D_i = mu (perfect equality);
 *   P -> 1 as one day carries all mass.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `daily-token-gini-coefficient` is the AREA under the Lorenz gap
 *     (integral over p in [0,1]). Pietra is the MAX of the same gap.
 *     A small uniform shift to the curve shape moves Gini smoothly
 *     but can leave Pietra anchored at the same argmax. Conversely,
 *     two distributions with identical Pietra (same single worst gap)
 *     can have meaningfully different Gini.
 *   - `daily-token-zenga-index` averages (n - 1) bottom-vs-top MEAN
 *     RATIOS u(k). Pietra averages NOTHING -- it is a single max.
 *     A vector can have a moderate Zenga (most cutpoints near
 *     equality) yet a large Pietra if a small number of days carry
 *     the bulk of the mass concentrated above the mean.
 *   - `cumulative-tokens-midpoint` is the day at which CDF crosses
 *     0.5 of CUMULATIVE MASS. Pietra's argmax-p is the population
 *     share whose value is at-or-below the MEAN, not the median.
 *     Different functional.
 *   - `single-day-mass-concentration` reports the share of the top-1
 *     / top-2 / top-3 days. Pietra uses a mean-anchored cut, so it
 *     adapts to the distribution's own scale and is robust to the
 *     fixed-k choice.
 *   - `daily-token-zscore-extremes`, `daily-token-monotone-run-length`,
 *     `daily-token-second-difference-sign-runs`,
 *     `daily-token-autocorrelation-lag1` all read the daily series
 *     in time order. Pietra is permutation-invariant.
 *
 * Headline question:
 * **"For each source, what fraction of the total token mass would
 *   have to be transferred from above-mean days to below-mean days
 *   to make every day equal? And what fraction of the days sits at
 *   or below the mean?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor; surfaces as `droppedSparseSources`.
 *   - `minDays` (default 2): Pietra is degenerate for n < 2;
 *     surfaces as `droppedBelowMinDays`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'pietra'): 'pietra' | 'tokens' | 'days' | 'source'.
 *   - `minPietra`: display filter in [0, 1].
 *   - All days are read off the UTC date prefix (yyyy-mm-dd) of
 *     `hour_start`, matching every other daily statistic in this
 *     codebase.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenPietraSort = 'pietra' | 'tokens' | 'days' | 'source';

export interface DailyTokenPietraOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenPietraSort;
  /**
   * Display filter: drop rows whose `pietra` is strictly below this
   * value. 0 = no filter; in [0, 1].
   */
  minPietra?: number;
  /**
   * Refinement (v0.6.272): when true, every emitted row gains a
   * `gini` value, a `pietraToGiniRatio` (P / G in [0, 1] with the
   * inequality P <= G enforced by construction), and a verbal
   * `concentrationStyle` classifier in
   * { 'point-anchored', 'mixed', 'curve-spread', 'degenerate' }.
   * Default false. Pure compute; no extra I/O.
   */
  showGiniComparison?: boolean;
  generatedAt?: string;
}

export interface DailyTokenPietraSourceRow {
  source: string;
  /** Sum of total_tokens across all retained days. */
  totalTokens: number;
  /** Number of distinct UTC days with positive token mass. */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Pietra / Schutz / Hoover ratio of the per-day total_tokens
   * vector. In [0, 1 - 1/n] subset of [0, 1]. 0 = perfect equality;
   * -> 1 = extreme concentration.
   */
  pietra: number;
  /**
   * Mean per-day total_tokens (totalTokens / nDays). Scale anchor.
   */
  meanDailyTokens: number;
  /** Largest single-day total_tokens. */
  maxDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the largest single-day total. */
  maxDay: string;
  /**
   * Population share at the Lorenz argmax, i.e. the fraction of
   * days whose D_i <= mean. Equals nBelowMean / nDays. In [0, 1).
   */
  belowMeanShare: number;
  /** Number of days at or below the mean. Integer in [0, n-1]. */
  nBelowMean: number;
  /**
   * Lorenz value at p = belowMeanShare, i.e. the cumulative mass
   * share of the below-mean days. In [0, 1). The Pietra ratio is
   * exactly `belowMeanShare - lorenzAtBelowMean`.
   */
  lorenzAtBelowMean: number;
  /**
   * Mean of the days that lie strictly above the mean, divided by
   * the overall mean. >= 1; 1 iff all above-mean days equal the
   * mean (degenerate). Quantifies the "how heavy is the heavy
   * tail" multiplier that drives the Pietra gap.
   */
  aboveMeanLift: number;
  /**
   * Refinement (v0.6.272): Gini coefficient of the same day vector,
   * present iff `showGiniComparison` is set. Always >= pietra.
   */
  gini?: number;
  /**
   * Refinement (v0.6.272): P / G ratio. Range [0, 1] with 1 iff
   * the distribution is two-valued (P = G). High ratio (-> 1)
   * means inequality is concentrated near a single Lorenz argmax;
   * low ratio (-> 0) means inequality is spread across the curve
   * (many cutpoints contribute). Present iff `showGiniComparison`.
   */
  pietraToGiniRatio?: number;
  /**
   * Refinement (v0.6.272): verbal classifier. Present iff
   * `showGiniComparison`.
   *   - 'degenerate' if pietra = 0 (uniform).
   *   - 'point-anchored' if P / G > 0.7.
   *   - 'curve-spread'   if P / G < 0.55.
   *   - 'mixed' otherwise.
   */
  concentrationStyle?:
    | 'degenerate'
    | 'point-anchored'
    | 'mixed'
    | 'curve-spread';
}

export interface DailyTokenPietraReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenPietraSort;
  minPietra: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinPietra: number;
  droppedTopSources: number;
  /** Echo of the showGiniComparison knob. */
  showGiniComparison: boolean;
  sources: DailyTokenPietraSourceRow[];
}

/**
 * Classify the concentration style of a (P, G) pair. Pure helper
 * for the v0.6.272 refinement; reused by the renderer.
 *
 * Returns 'degenerate' for the all-equal vector, otherwise compares
 * the Pietra-to-Gini ratio against fixed thresholds (0.55, 0.7).
 * Both thresholds are exposed to tests.
 */
export const PIETRA_GINI_RATIO_THRESHOLDS = {
  curveSpreadUpper: 0.55,
  pointAnchoredLower: 0.7,
} as const;

export function classifyPietraGiniStyle(
  pietra: number,
  gini: number,
): 'degenerate' | 'point-anchored' | 'mixed' | 'curve-spread' {
  if (!(pietra > 0)) return 'degenerate';
  if (!(gini > 0)) return 'degenerate';
  const ratio = pietra / gini;
  if (ratio > PIETRA_GINI_RATIO_THRESHOLDS.pointAnchoredLower) {
    return 'point-anchored';
  }
  if (ratio < PIETRA_GINI_RATIO_THRESHOLDS.curveSpreadUpper) {
    return 'curve-spread';
  }
  return 'mixed';
}

/**
 * Pietra / Schutz / Hoover ratio of a non-negative numeric vector,
 * along with diagnostics needed to interpret the scalar.
 *
 * Returns:
 *   - { pietra: 0, ... zeros } for n < 2 or all-zero input.
 *   - pietra in [0, 1 - 1/n] otherwise.
 *
 * Throws on negative or non-finite input.
 */
export function pietraOfVector(values: number[]): {
  pietra: number;
  nBelowMean: number;
  belowMeanShare: number;
  lorenzAtBelowMean: number;
  aboveMeanLift: number;
} {
  const n = values.length;
  if (n < 2) {
    return {
      pietra: 0,
      nBelowMean: 0,
      belowMeanShare: 0,
      lorenzAtBelowMean: 0,
      aboveMeanLift: 0,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `pietraOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      pietra: 0,
      nBelowMean: 0,
      belowMeanShare: 0,
      lorenzAtBelowMean: 0,
      aboveMeanLift: 0,
    };
  }
  const mu = total / n;
  let absDevSum = 0;
  let nBelow = 0;
  let massBelow = 0;
  let aboveSum = 0;
  let nAbove = 0;
  for (const v of values) {
    absDevSum += Math.abs(v - mu);
    if (v <= mu) {
      nBelow += 1;
      massBelow += v;
    } else {
      aboveSum += v;
      nAbove += 1;
    }
  }
  const pietra = absDevSum / (2 * n * mu);
  const belowMeanShare = nBelow / n;
  const lorenzAtBelowMean = massBelow / total;
  const aboveMeanLift = nAbove > 0 ? aboveSum / nAbove / mu : 1;
  return {
    pietra,
    nBelowMean: nBelow,
    belowMeanShare,
    lorenzAtBelowMean,
    aboveMeanLift,
  };
}

export function buildDailyTokenPietraRatio(
  queue: QueueLine[],
  opts: DailyTokenPietraOptions = {},
): DailyTokenPietraReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Pietra is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minPietra = opts.minPietra ?? 0;
  if (!Number.isFinite(minPietra) || minPietra < 0 || minPietra > 1) {
    throw new Error(
      `minPietra must be a finite number in [0, 1] (got ${opts.minPietra})`,
    );
  }
  const sort: DailyTokenPietraSort = opts.sort ?? 'pietra';
  const validSorts: DailyTokenPietraSort[] = [
    'pietra',
    'tokens',
    'days',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(
      `source must be a string when set (got ${typeof sourceFilter})`,
    );
  }

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
  const rows: DailyTokenPietraSourceRow[] = [];

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
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
    }
    const p = pietraOfVector(values);
    const row: DailyTokenPietraSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      pietra: p.pietra,
      meanDailyTokens: acc.totalTokens / nDays,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      belowMeanShare: p.belowMeanShare,
      nBelowMean: p.nBelowMean,
      lorenzAtBelowMean: p.lorenzAtBelowMean,
      aboveMeanLift: p.aboveMeanLift,
    };
    if (opts.showGiniComparison) {
      const gini = giniOfVector(values);
      // Enforce the Pietra <= Gini inequality numerically (always
      // true mathematically; floating-point can put them within
      // ~1e-15 of each other).
      const safeGini = gini < p.pietra ? p.pietra : gini;
      row.gini = safeGini;
      row.pietraToGiniRatio = safeGini > 0 ? p.pietra / safeGini : 0;
      row.concentrationStyle = classifyPietraGiniStyle(p.pietra, safeGini);
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinPietra = 0;
  let filtered = rows;
  if (minPietra > 0) {
    const next: DailyTokenPietraSourceRow[] = [];
    for (const r of rows) {
      if (r.pietra >= minPietra) next.push(r);
      else droppedBelowMinPietra += 1;
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
      case 'pietra':
      default:
        primary = b.pietra - a.pietra;
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
    minPietra,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinPietra,
    droppedTopSources,
    showGiniComparison: opts.showGiniComparison ?? false,
    sources: kept,
  };
}
