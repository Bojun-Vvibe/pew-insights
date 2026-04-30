/**
 * daily-token-ge2-index: per-source GENERALISED ENTROPY GE(2) (=
 * half-squared coefficient of variation) of the per-day total_tokens
 * distribution. THIRTY-NINTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the alpha = 2
 * element of the Generalised-Entropy GE(alpha) family
 * (Bourguignon 1979; Shorrocks 1980; Cowell 2011).
 *
 * Construction:
 *
 *     mu  = mean(D)
 *     CV  = sigma / mu                             (coefficient of variation)
 *     GE2 = (1 / (2 n)) * sum_i ((D_i / mu) - 1)^2
 *         = (1 / 2) * CV^2
 *         = (1 / 2) * (sample-variance-of-D / mu^2)         [biased var]
 *
 *   Range: GE(2) in [0, +inf). GE(2) = 0 iff every D_i = mu (perfect
 *   equality). Unbounded above (a single mega-day can drive GE(2)
 *   arbitrarily large; specifically, one-day-takes-all on n days
 *   gives CV^2 = n - 1, GE(2) = (n-1)/2). Reported as a pure ratio
 *   (NOT in NATS -- this is the structural break with axes 37/38).
 *
 *   The CV identity GE(2) = CV^2 / 2 is exact and audited per row
 *   via `cvSquaredOverTwo` (= GE(2) by construction; surfaced for
 *   independent verification, mirrors the cross-lens axis-27
 *   `--show-cv-identity` flag).
 *
 * Why orthogonal to every prior daily-token axis (and to Theil-T /
 * Theil-L specifically -- this is the central design point):
 *
 *   axis-37 daily-token-theil-l-index = GE(0): bottom-tail-sensitive
 *     log shortfall (`log(mu / D_i)`). Linear in log of small days.
 *     Zero day pins L = +inf.
 *   axis-38 daily-token-theil-t-index = GE(1): mass-weighted log
 *     ratio (`q_i * log(q_i / (1/n))`). Linear in log of large days.
 *     Stays finite on zero days.
 *   THIS axis      = GE(2): SQUARED-DEVIATION of the share ratio.
 *     QUADRATIC in (D_i / mu - 1). When a single day's share grows,
 *     ITS contribution grows like ((D_i / mu) - 1)^2 -- much faster
 *     than Theil-T's q_i * log(q_i * n) which is O(q_i * log q_i).
 *
 *   The MOMENT family is ordered:
 *     - GE(0) absorbs deviations LOGARITHMICALLY (bottom-sensitive)
 *     - GE(1) absorbs deviations LOG-LINEARLY     (mass-balanced)
 *     - GE(2) absorbs deviations QUADRATICALLY    (top-EXTREME-sensitive)
 *
 *   Two sources can have IDENTICAL Gini, IDENTICAL Theil-L, and
 *   IDENTICAL Theil-T but very different GE(2) -- because GE(2) is
 *   uniquely sensitive to a single isolated outlier day. That is the
 *   structural value-add: GE(2) is the only daily-token axis whose
 *   transfer-sensitivity at the top is QUADRATIC; every other index
 *   ships ranges from log to L1 to L_inf, but never L2.
 *
 *   Headline derived field: SQUARED-VS-LOG SKEW RATIO `ge2OverT` =
 *   GE(2) / Theil-T (axis-38 cross-anchor). This is dimensionally
 *   the MOMENT-FAMILY GAP: GE(2) and GE(1) are different elements of
 *   the same family, so their ratio quantifies how much of the
 *   inequality lives in the QUADRATIC TAIL (high ratio: a few mega-
 *   days dominate quadratically; low ratio: top mass is spread out).
 *   Set to NaN when Theil-T = 0 (degenerate; both should be 0). Set
 *   to +Inf when Theil-T > 0 but only via a numerical quirk (cannot
 *   happen for non-empty positive vectors with both > 0).
 *
 *   Other comparisons:
 *
 *     - daily-token-gini-coefficient: Gini is rank-weighted L1 of
 *       differences (Lorenz integral). GE(2) is moment-2 of share
 *       ratios. Different functional class; transfer principle holds
 *       with DIFFERENT weighting.
 *     - daily-token-pietra-ratio: Pietra is the L_infinity Lorenz
 *       gap. GE(2) is L2 of share deviations. Same data, different
 *       norm.
 *     - daily-token-zenga-index: Zenga averages bottom-vs-top mean
 *       ratios over rank cuts. GE(2) uses no rank ordering at all;
 *       only share moments.
 *     - daily-token-atkinson-index: Atkinson is bounded in [0, 1] by
 *       construction (CRRA welfare loss). GE(2) is unbounded above.
 *       Atkinson and GE(2) only share an ordering at a degenerate
 *       limit; functionally independent elsewhere.
 *     - All time-ordered axes (autocorrelation, monotone-run-length,
 *       second-difference-sign-runs, z-score-extremes): GE(2) is
 *       permutation-invariant, so orthogonal by construction.
 *
 *   Headline question:
 *   **"For each source, how much QUADRATIC tail mass does the per-day
 *     distribution carry around the mean? And how does that top-
 *     extreme reading compare to axis-38's log-linear Theil-T on the
 *     same vector (via the GE(2)/T moment-family-gap ratio)?"**
 *
 * ZERO-COLLAPSE: GE(2) does NOT zero-collapse (zero days contribute
 *   (0/mu - 1)^2 = 1 each, finite). GE(2) stays finite on any non-
 *   trivially-zero vector. We surface `nZeroDays` for transparency.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): GE(2) is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'ge2'): 'ge2' | 'tokens' | 'days' | 'source' |
 *     'meanDaily' | 'cv' | 'ge2OverT'.
 *   - `minGe2` (default 0): display filter; in [0, +inf).
 */
import type { QueueLine } from './types.js';
import {
  theilLOfVector,
  generalisedEntropyOfVector,
} from './dailytokentheillindex.js';
import { theilTOfVector } from './dailytokentheiltindex.js';

export type DailyTokenGe2Sort =
  | 'ge2'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'cv'
  | 'ge2OverT';

export interface DailyTokenGe2Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenGe2Sort;
  /** Display filter: drop rows whose ge2 < this. In [0, +inf). */
  minGe2?: number;
  /**
   * Optional GE(alpha) sweep, mirrors axes 37/38: every emitted row
   * gains a `geSweep` array `{ alpha, ge }` for cross-family compare.
   */
  alphaSweep?: readonly number[];
  /**
   * Refinement (v0.6.278): when true, every emitted row gains a
   * `weekCollapse` field with `{ ge2PerWeek, nWeeks, weeklySmoothingRatio }`
   * computed via `ge2PerWeekCollapse`. The ratio quantifies how much
   * of the GE(2) inequality is sub-weekly noise vs. structural
   * between-week variation. Pure compute over the same per-day map.
   */
  includeWeekCollapse?: boolean;
  generatedAt?: string;
}

export interface DailyTokenGe2SourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed (informational; does not affect GE2). */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** GE(2) = (1/(2n)) * sum ((D_i/mu - 1)^2) = (1/2) * CV^2. In [0, +inf). */
  ge2: number;
  /** Coefficient of variation = sigma/mu. In [0, +inf). */
  cv: number;
  /** CV^2; satisfies ge2 == cvSquared / 2 exactly (numerical audit). */
  cvSquared: number;
  /** = cvSquared / 2; redundant readout of GE(2) (audit field). */
  cvSquaredOverTwo: number;
  /**
   * Cross-anchor: Theil-T (GE(1)) on the same vector. The headline
   * SKEW INDICATOR of THIS axis is the moment-family-gap ratio
   * `ge2OverT = ge2 / theilT`, which requires both to compute.
   */
  theilT: number;
  /**
   * Cross-anchor: Theil-L (GE(0)) on the same vector. +Infinity on
   * zero-day vectors. We surface it for free since the user is
   * already asking for the GE(alpha) family.
   */
  theilL: number;
  /**
   * Moment-family-gap skew indicator: ge2 / theilT.
   *   high  => quadratic tail dominates (a few mega-days carry the
   *            inequality, with squared sensitivity)
   *   low   => log-linear tail dominates (top mass is spread out)
   *   = NaN => theilT = 0 (degenerate; both should be 0 then)
   *   = +inf=> theilT = 0 with ge2 > 0 (numerically improbable)
   */
  ge2OverT: number;
  /** True iff theilL = +Infinity (>=1 zero day). Informational. */
  lInfinite: boolean;
  /** Mean per-day total_tokens. */
  meanDailyTokens: number;
  /** Sample standard deviation (biased; population formula matches CV). */
  stdDailyTokens: number;
  /** Largest single-day total_tokens. */
  maxDailyTokens: number;
  maxDay: string;
  /** Smallest single-day total_tokens. */
  minDailyTokens: number;
  minDay: string;
  /**
   * Saturation flag: maximum-possible GE(2) on n days is (n-1)/2
   * (one-day-takes-all). True iff ge2 >= 0.999 * (n-1)/2 (very near
   * the saturation envelope). Informational; not a degenerate flag.
   */
  ge2Saturated: boolean;
  geSweep?: { alpha: number; ge: number }[];
  /**
   * Refinement (v0.6.278): per-week collapse of the same per-day
   * vector. Present iff caller set `includeWeekCollapse: true`.
   * `weeklySmoothingRatio = ge2PerWeek / ge2PerDay` in [0, 1] in
   * practice; lower => more inequality is sub-weekly noise; closer
   * to 1 => inequality is structural between-week. `null` when
   * ge2PerDay = 0.
   */
  weekCollapse?: {
    ge2PerWeek: number;
    nWeeks: number;
    weeklySmoothingRatio: number | null;
  };
}

export interface DailyTokenGe2Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGe2Sort;
  minGe2: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinGe2: number;
  droppedTopSources: number;
  alphaSweep: number[];
  sources: DailyTokenGe2SourceRow[];
}

/**
 * GE(2) of a non-negative vector, returned alongside the supporting
 * CV, mean, and standard-deviation values. Pure compute.
 *
 * Returns:
 *   - All zeros for n < 2, all-zero, or empty (degenerate).
 *   - Otherwise GE(2) in [0, +inf).
 *
 * Throws on negative or non-finite input.
 */
export function ge2OfVector(values: number[]): {
  ge2: number;
  cv: number;
  cvSquared: number;
  mean: number;
  std: number;
} {
  const n = values.length;
  if (n < 2) return { ge2: 0, cv: 0, cvSquared: 0, mean: 0, std: 0 };
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `ge2OfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) return { ge2: 0, cv: 0, cvSquared: 0, mean: 0, std: 0 };
  const mu = total / n;
  // GE(2) = (1/(2n)) * sum (D_i/mu - 1)^2 = sum (D_i - mu)^2 / (2 n mu^2).
  let sumSq = 0;
  for (const v of values) {
    const d = v - mu;
    sumSq += d * d;
  }
  const variance = sumSq / n; // population variance
  const std = Math.sqrt(variance);
  const cv = std / mu;
  const cvSquared = cv * cv;
  let ge2 = cvSquared / 2;
  if (ge2 < 0) ge2 = 0; // numerical clamp (shouldn't trigger)
  return { ge2, cv, cvSquared, mean: mu, std };
}

export function buildDailyTokenGe2Index(
  queue: QueueLine[],
  opts: DailyTokenGe2Options = {},
): DailyTokenGe2Report {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (GE(2) is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minGe2 = opts.minGe2 ?? 0;
  if (!Number.isFinite(minGe2) || minGe2 < 0) {
    throw new Error(
      `minGe2 must be a non-negative finite number (got ${opts.minGe2})`,
    );
  }
  const sort: DailyTokenGe2Sort = opts.sort ?? 'ge2';
  const validSorts: DailyTokenGe2Sort[] = [
    'ge2',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'cv',
    'ge2OverT',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

  const alphaSweep: number[] = [];
  if (opts.alphaSweep && opts.alphaSweep.length > 0) {
    for (const a of opts.alphaSweep) {
      if (!Number.isFinite(a)) {
        throw new Error(
          `alphaSweep values must be finite numbers (got ${a})`,
        );
      }
      alphaSweep.push(a);
    }
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
  const rows: DailyTokenGe2SourceRow[] = [];

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
    const g = ge2OfVector(values);
    const t = theilTOfVector(values);
    const lRes = theilLOfVector(values);
    const lInfinite = !Number.isFinite(lRes.theilL);
    let ge2OverT: number;
    if (t.theilT === 0) {
      ge2OverT = g.ge2 === 0 ? Number.NaN : Number.POSITIVE_INFINITY;
    } else {
      ge2OverT = g.ge2 / t.theilT;
    }
    const ge2Max = (nDays - 1) / 2;
    const ge2Saturated = ge2Max > 0 && g.ge2 >= 0.999 * ge2Max;
    const row: DailyTokenGe2SourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      ge2: g.ge2,
      cv: g.cv,
      cvSquared: g.cvSquared,
      cvSquaredOverTwo: g.cvSquared / 2,
      theilT: t.theilT,
      theilL: lRes.theilL,
      ge2OverT,
      lInfinite,
      meanDailyTokens: g.mean,
      stdDailyTokens: g.std,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
      ge2Saturated,
    };
    if (alphaSweep.length > 0) {
      row.geSweep = alphaSweep.map((a) => ({
        alpha: a,
        ge: generalisedEntropyOfVector(values, a),
      }));
    }
    if (opts.includeWeekCollapse) {
      const wk = ge2PerWeekCollapse(acc.perDay);
      row.weekCollapse = {
        ge2PerWeek: wk.ge2PerWeek,
        nWeeks: wk.nWeeks,
        weeklySmoothingRatio: wk.weeklySmoothingRatio,
      };
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinGe2 = 0;
  let filtered = rows;
  if (minGe2 > 0) {
    const next: DailyTokenGe2SourceRow[] = [];
    for (const r of rows) {
      if (r.ge2 >= minGe2) next.push(r);
      else droppedBelowMinGe2 += 1;
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
      case 'cv':
        primary = b.cv - a.cv;
        break;
      case 'ge2OverT': {
        const av = a.ge2OverT;
        const bv = b.ge2OverT;
        const aBad = !Number.isFinite(av) && !Number.isNaN(av);
        const bBad = !Number.isFinite(bv) && !Number.isNaN(bv);
        if (Number.isNaN(av) && Number.isNaN(bv)) primary = 0;
        else if (Number.isNaN(av)) primary = 1;
        else if (Number.isNaN(bv)) primary = -1;
        else if (aBad && !bBad) primary = -1;
        else if (bBad && !aBad) primary = 1;
        else primary = bv - av;
        break;
      }
      case 'ge2':
      default:
        primary = b.ge2 - a.ge2;
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
    minGe2,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinGe2,
    droppedTopSources,
    alphaSweep,
    sources: kept,
  };
}

/**
 * Convenience refinement: GE(2) PER-WEEK collapse. Re-aggregates the
 * per-day vector into ISO-week buckets (Monday-anchored) before
 * applying GE(2). When the original day vector is dominated by a few
 * mega-days, the per-week collapse smooths within-week noise and
 * surfaces between-WEEK inequality instead. The contrast
 * `ge2(per-day) / ge2(per-week)` quantifies HOW MUCH of the GE(2)
 * inequality is sub-weekly noise vs. structural between-week
 * variation.
 *
 * Pure compute over an existing day-keyed map: caller is responsible
 * for pre-aggregating per-source. Returns `null` for the contrast
 * field when either component is 0 (degenerate).
 *
 * Why this is the right refinement to ship alongside the headline:
 *   - Reuses `ge2OfVector` exactly; no duplicate stats logic.
 *   - The per-week vs. per-day ratio is a legitimate ORTHOGONAL
 *     diagnostic to anything in the headline (it requires TWO GE(2)
 *     evaluations on differently-aggregated data; neither alone
 *     gives it).
 *   - Mirrors the "cross-anchor + ratio" pattern established by
 *     axis-37/38 (theilL/theilT and tOverL).
 */
export function ge2PerWeekCollapse(perDay: Map<string, number>): {
  ge2PerDay: number;
  ge2PerWeek: number;
  nDays: number;
  nWeeks: number;
  /**
   * Smoothing ratio: ge2PerWeek / ge2PerDay. In [0, 1] in practice
   * (per-week aggregation is a smoothing operation on the day
   * vector). Lower => more inequality is sub-weekly noise; closer
   * to 1 => inequality is structural between-week. `null` when
   * ge2PerDay = 0 (no inequality to smooth).
   */
  weeklySmoothingRatio: number | null;
} {
  const days = Array.from(perDay.keys()).sort();
  const dayValues: number[] = days.map((d) => perDay.get(d) ?? 0);
  const perWeek = new Map<string, number>();
  for (const d of days) {
    const wk = isoWeekKey(d);
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + (perDay.get(d) ?? 0));
  }
  const weekValues = Array.from(perWeek.values());
  const day = ge2OfVector(dayValues);
  const week = ge2OfVector(weekValues);
  const ratio =
    day.ge2 > 0 ? week.ge2 / day.ge2 : null;
  return {
    ge2PerDay: day.ge2,
    ge2PerWeek: week.ge2,
    nDays: dayValues.length,
    nWeeks: weekValues.length,
    weeklySmoothingRatio: ratio,
  };
}

/**
 * ISO-8601 week key 'YYYY-Www' for a 'YYYY-MM-DD' date string. Pure
 * arithmetic; no Intl, no zone shifts.
 */
function isoWeekKey(dayIso: string): string {
  // Date.UTC handles the calendar arithmetic safely.
  const ms = Date.parse(dayIso + 'T00:00:00Z');
  const d = new Date(ms);
  // ISO week: Thursday-anchored. Per the standard:
  // 1) Get the day's UTC date.
  // 2) Shift to the Thursday of that ISO week (day index Mon=1..Sun=7).
  // 3) The ISO year is the year of that Thursday.
  // 4) Week number = floor(((thursday - jan4_of_iso_year) / 7) + 1)
  //    where jan4 is shifted to the Monday of its own ISO week.
  const dayNum = d.getUTCDay() || 7; // Sun=0 -> 7, Mon=1, ..., Sat=6
  const thursday = new Date(d.getTime());
  thursday.setUTCDate(d.getUTCDate() + (4 - dayNum));
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() + (1 - jan4DayNum));
  const weekNum =
    Math.floor((thursday.getTime() - week1Monday.getTime()) / (7 * 86400000)) +
    1;
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}
