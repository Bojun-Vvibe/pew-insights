/**
 * daily-token-mid-spread-ratio: per-source MID-TAIL CONCENTRATION RATIO
 * (P75 - P25) / (P90 - P10) of the per-day total_tokens distribution.
 * SIXTIETH cross-source axis.
 *
 * For each source we collapse all hourly buckets into one scalar per
 * UTC day (D_d = sum of total_tokens on day d) and summarise the
 * resulting day vector D = (D_1, ..., D_n) by the dimensionless SHAPE
 * statistic
 *
 *     MSR = (P75(D) - P25(D)) / (P90(D) - P10(D)),
 *
 * where P_q(D) is the q-th sample percentile under the standard
 * linear-interpolation rule (numpy "linear" / R "type 7"):
 *
 *     given sorted D, with h = q * (n - 1), let k = floor(h) and
 *     f = h - k. Then P_q = D_sorted[k] + f * (D_sorted[k+1] - D_sorted[k]).
 *
 * MSR is the ratio of the INTERQUARTILE width to the INTERDECILE width.
 * It is a unit-free SHAPE descriptor: it asks what fraction of the
 * 10-90 spread is contained inside the central 25-75 box. For a
 * Gaussian tail, MSR ~ 0.526 (1.349 sigma over 2.563 sigma); for a
 * heavy upper tail, MSR shrinks toward 0; for a uniform distribution,
 * MSR = 0.625. MSR lies in (0, 1] always (P75 - P25 <= P90 - P10 by
 * monotonicity).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..59):
 *
 *   - axes 32..57 are MOMENT- or LORENZ-functional summaries (GE
 *     family at alpha in {-1,0,1/2,1,2,3,4}; Gini, S-Gini, Bonferroni,
 *     Mehran, Pietra, Hoover, Zenga, Wolfson, Foster-Wolfson, Palma,
 *     Atkinson, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray,
 *     Var-of-Logs, Log-MAD, FGT). Each integrates over the FULL
 *     distribution and is normalised by the MEAN.
 *   - axis 58 (PGR = P90/P50) is a TAIL-VS-MEDIAN ratio: depends on
 *     two upper-half order statistics (P50, P90), normalised by the
 *     MEDIAN.
 *   - axis 59 (IOM = (P75-P25)/P50) is a CENTRAL-VS-MEDIAN ratio:
 *     depends on three central order statistics (P25, P50, P75),
 *     normalised by the MEDIAN. Carries no tail information.
 *   - MSR (this axis, 60) depends on FOUR order statistics
 *     (P10, P25, P75, P90) and is INVARIANT to the MEDIAN entirely.
 *     It is normalised by an ANOTHER ORDER STATISTIC SPREAD
 *     (P90 - P10), not by a center. This makes it a pure SHAPE
 *     statistic in the order-statistic ratio family -- distinct from
 *     every tail/median or central/median ratio shipped to date.
 *     It is also INVARIANT to all changes strictly above P90 OR
 *     strictly below P10 (drops the extreme tails), and to all changes
 *     strictly between P25 and P75 that hold P25 and P75 fixed (drops
 *     the median wiggle).
 *
 * RANK-FLIP WITNESS vs axis-59 (IOM). Construct two day vectors of
 * length 11 (so q=0.10/0.25/0.50/0.75/0.90 land at h=1.0/2.5/5.0/7.5/9.0):
 *
 *   A = [1, 1, 5, 5, 5, 5, 5, 5, 5, 9, 9]
 *     Sorted A: P10 = v[1] = 1; P25 (h=2.5) = 5+0.5*0 = 5;
 *               P50 = v[5] = 5; P75 (h=7.5) = 5+0.5*(5-5) = 5;
 *               P90 = v[9] = 9.
 *     IOM(A) = (5-5)/5 = 0  (DEGENERATE on central body)
 *     MSR(A) = (5-5)/(9-1) = 0  (DEGENERATE on numerator -- tight body)
 *
 *   B = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
 *     Sorted B: P10 = v[1] = 2; P25 (h=2.5) = 3+0.5 = 3.5;
 *               P50 = v[5] = 6; P75 (h=7.5) = 8+0.5 = 8.5;
 *               P90 = v[9] = 10.
 *     IOM(B) = (8.5-3.5)/6 = 5/6 ~= 0.833
 *     MSR(B) = (8.5-3.5)/(10-2) = 5/8 = 0.625
 *
 *   So far both rank B > A. Now the GENUINE FLIP:
 *
 *   X = [1, 4, 5, 5, 5, 5, 5, 5, 5, 6, 100]
 *     Sorted X: P10 = v[1] = 4; P25 (h=2.5) = 5+0.5*0 = 5;
 *               P50 = v[5] = 5; P75 (h=7.5) = 5+0.5*0 = 5;
 *               P90 = v[9] = 6.
 *     IOM(X) = (5-5)/5 = 0   (DEGENERATE -- tight central body)
 *     MSR(X) = (5-5)/(6-4) = 0/2 = 0  (also DEGENERATE on numerator)
 *
 *   Y = [1, 2, 4, 4, 5, 5, 5, 6, 6, 8, 9]
 *     Sorted Y: P10 = v[1] = 2; P25 (h=2.5) = 4+0.5*0 = 4;
 *               P50 = v[5] = 5; P75 (h=7.5) = 6+0.5*(8-6) = 7;
 *               P90 = v[9] = 8.
 *     IOM(Y) = (7-4)/5 = 0.6
 *     MSR(Y) = (7-4)/(8-2) = 3/6 = 0.5
 *
 *   Z = [1, 1, 4, 4, 5, 5, 5, 6, 6, 9, 100]
 *     Sorted Z: P10 = v[1] = 1; P25 (h=2.5) = 4+0.5*0 = 4;
 *               P50 = v[5] = 5; P75 (h=7.5) = 6+0.5*(9-6) = 7.5;
 *               P90 = v[9] = 9.
 *     IOM(Z) = (7.5-4)/5 = 0.7
 *     MSR(Z) = (7.5-4)/(9-1) = 3.5/8 = 0.4375
 *
 *   IOM ranks Z > Y (0.7 > 0.6). MSR ranks Y > Z (0.5 > 0.4375).
 *   The rank flip is real: Z has a wider central body in absolute
 *   terms (P75-P25 = 3.5 vs 3.0), so IOM (normalised by P50 which is
 *   identical here) prefers Z. But Z also has a wider INTERDECILE
 *   spread (8 vs 6), so the SHAPE ratio MSR finds Y's central body
 *   represents a LARGER FRACTION of its total spread -- Y is more
 *   "boxy", Z is more "stretched". This is a genuine SHAPE flip,
 *   uncorrelated with the median-normalised flips that distinguish
 *   IOM from PGR.
 *
 *   Headline question:
 *   **"What fraction of each source's interdecile (10-90) daily-token
 *     spread is contained inside its interquartile (25-75) box?"**
 *
 * Range and special cases:
 *   - 0 <= MSR <= 1 always (P75 - P25 <= P90 - P10 by monotonicity).
 *   - MSR == 0 iff P25 == P75 (the central 50% of days is constant).
 *     Marked degenerate=true.
 *   - MSR == 1 iff P25 == P10 AND P75 == P90 (the extreme 10% on each
 *     side equals the quartile boundary -- the distribution is
 *     perfectly clipped to the central box). Also marked
 *     degenerate=true to flag "no extra information from the deciles".
 *   - Reference values:
 *       Uniform(0,1):   IQR = 0.5, IDR = 0.8, MSR = 0.625
 *       Gaussian:       IQR ~ 1.349*sigma, IDR ~ 2.563*sigma,
 *                       MSR ~ 0.526
 *       Laplace(b=1):   IQR ~ 1.386, IDR ~ 3.219, MSR ~ 0.431
 *       Pareto(alpha=2): MSR < 0.4 (heavy upper tail).
 *   - MSR is SCALE-INVARIANT (multiply every day by k > 0; ratio
 *     unchanged) AND TRANSLATION-INVARIANT in the sense that adding
 *     the same constant to every day shifts P10/P25/P75/P90 by the
 *     same constant -- numerator and denominator unchanged. (The
 *     daily-token domain is positive, so we don't allow negative
 *     shifts in practice, but the algebra is invariant.)
 *   - MSR is PERMUTATION-INVARIANT (depends on sorted vector only).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sparse sources.
 *   - `minDays` (default 4): MSR degenerate for n<2 (and P10/P90
 *     uninformative for n<5 since the deciles collapse to the
 *     extremes). Default 4 matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'msr'): 'msr' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'p50' | 'iqrAbsolute' | 'idrAbsolute'.
 *   - `minMsr` (>=0, optional): display filter on msr.
 *   - `includeIom` (refinement): also surface IOM = (P75-P25)/P50 in
 *     the same row for cross-axis comparison vs axis 59.
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only, so per-day totals are strictly positive, and the
 * percentiles are well-defined for n >= 2.
 *
 * CLOSED-FORM ANCHOR. For D = [1..11]:
 *   P10 (h=1.0) = v[1] = 2
 *   P25 (h=2.5) = 3 + 0.5*(4-3) = 3.5
 *   P50 (h=5.0) = v[5] = 6
 *   P75 (h=7.5) = 8 + 0.5*(9-8) = 8.5
 *   P90 (h=9.0) = v[9] = 10
 *   IQR = 8.5 - 3.5 = 5.0
 *   IDR = 10 - 2 = 8.0
 *   MSR = 5.0 / 8.0 = 0.625
 * Reproduced exactly by `midSpreadRatioOfVector([1..11])` in tests.
 */
import type { QueueLine } from './types.js';
import { linearPercentileSorted } from './dailytokenpercentilegapratio.js';

export type DailyTokenMidSpreadRatioSort =
  | 'msr'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'p50'
  | 'iqrAbsolute'
  | 'idrAbsolute';

export interface DailyTokenMidSpreadRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMidSpreadRatioSort;
  /** Display filter: drop rows whose msr < this value (>= 0). Default null = no filter. */
  minMsr?: number | null;
  /** Refinement: surface IOM = (P75-P25)/P50 alongside MSR for cross-axis comparison. */
  includeIom?: boolean;
  generatedAt?: string;
}

export interface DailyTokenMidSpreadRatioSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** P10 of D (linear-interp). */
  p10: number;
  /** P25 of D (linear-interp). */
  p25: number;
  /** P50 (median) of D. */
  p50: number;
  /** P75 of D (linear-interp). */
  p75: number;
  /** P90 of D (linear-interp). */
  p90: number;
  /** Absolute IQR = P75 - P25 (>= 0). */
  iqrAbsolute: number;
  /** Absolute IDR = P90 - P10 (>= 0). */
  idrAbsolute: number;
  /** MSR = (P75-P25)/(P90-P10) in [0, 1]. 0 iff P25==P75; 1 iff P10==P25 AND P75==P90. */
  msr: number;
  /** mean(D_i) -- for cross-reference only (not used in msr). */
  meanDailyTokens: number;
  /** True iff n < 2 OR P25 == P75 (msr == 0) OR (P10 == P25 AND P75 == P90) (msr == 1). */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: IOM = (P75-P25)/P50 (only set when includeIom=true). */
  iom?: number;
}

export interface DailyTokenMidSpreadRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMidSpreadRatioSort;
  minMsr: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinMsr: number;
  droppedTopSources: number;
  sources: DailyTokenMidSpreadRatioSourceRow[];
}

/**
 * MSR = (P75 - P25) / (P90 - P10) of a strictly-positive numeric vector.
 *
 * Returns degenerate=true with msr=0 for empty input or n<2; with
 * msr=0 when P25 == P75 (tight body); with msr=1 when P10==P25 AND
 * P75==P90 (perfectly box-clipped). Throws on negative, zero, or
 * non-finite input. Also returns mean and IOM (= (P75-P25)/P50) for
 * cross-reference.
 */
export function midSpreadRatioOfVector(values: number[]): {
  msr: number;
  iqrAbsolute: number;
  idrAbsolute: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  iom: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `midSpreadRatioOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    const single = n === 1 ? values[0]! : 0;
    return {
      msr: 0,
      iqrAbsolute: 0,
      idrAbsolute: 0,
      p10: single,
      p25: single,
      p50: single,
      p75: single,
      p90: single,
      iom: 0,
      mean: single,
      total,
      degenerate: true,
    };
  }
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `midSpreadRatioOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    sum += v;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const p10 = linearPercentileSorted(sorted, 0.1);
  const p25 = linearPercentileSorted(sorted, 0.25);
  const p50 = linearPercentileSorted(sorted, 0.5);
  const p75 = linearPercentileSorted(sorted, 0.75);
  const p90 = linearPercentileSorted(sorted, 0.9);
  const iqrAbsoluteRaw = p75 - p25;
  const idrAbsoluteRaw = p90 - p10;
  const iqrAbsolute = iqrAbsoluteRaw < 0 ? 0 : iqrAbsoluteRaw;
  const idrAbsolute = idrAbsoluteRaw < 0 ? 0 : idrAbsoluteRaw;
  let msr: number;
  if (idrAbsolute <= 0) {
    msr = 0;
  } else {
    const raw = iqrAbsolute / idrAbsolute;
    msr = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  }
  const iom = p50 > 0 ? iqrAbsolute / p50 : 0;
  const tightBody = !(iqrAbsolute > 1e-15);
  const boxClipped =
    iqrAbsolute > 1e-15 &&
    Math.abs(p10 - p25) < 1e-15 &&
    Math.abs(p75 - p90) < 1e-15;
  const degenerate = tightBody || boxClipped;
  return {
    msr,
    iqrAbsolute,
    idrAbsolute,
    p10,
    p25,
    p50,
    p75,
    p90,
    iom: iom < 0 ? 0 : iom,
    mean: sum / n,
    total: sum,
    degenerate,
  };
}

export function buildDailyTokenMidSpreadRatio(
  queue: QueueLine[],
  opts: DailyTokenMidSpreadRatioOptions = {},
): DailyTokenMidSpreadRatioReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (MSR degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minMsr = opts.minMsr ?? null;
  if (minMsr !== null && (!Number.isFinite(minMsr) || minMsr < 0)) {
    throw new Error(
      `minMsr must be a finite number >= 0 or null (got ${opts.minMsr})`,
    );
  }
  const sort: DailyTokenMidSpreadRatioSort = opts.sort ?? 'msr';
  const validSorts: DailyTokenMidSpreadRatioSort[] = [
    'msr',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'p50',
    'iqrAbsolute',
    'idrAbsolute',
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
  const rows: DailyTokenMidSpreadRatioSourceRow[] = [];

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
    const r = midSpreadRatioOfVector(values);
    const row: DailyTokenMidSpreadRatioSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      p10: r.p10,
      p25: r.p25,
      p50: r.p50,
      p75: r.p75,
      p90: r.p90,
      iqrAbsolute: r.iqrAbsolute,
      idrAbsolute: r.idrAbsolute,
      msr: r.msr,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeIom) {
      row.iom = r.iom;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinMsr = 0;
  let filtered = rows;
  if (minMsr !== null) {
    const next: DailyTokenMidSpreadRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.msr >= minMsr) next.push(r);
      else droppedBelowMinMsr += 1;
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
      case 'p50':
        primary = b.p50 - a.p50;
        break;
      case 'iqrAbsolute':
        primary = b.iqrAbsolute - a.iqrAbsolute;
        break;
      case 'idrAbsolute':
        primary = b.idrAbsolute - a.idrAbsolute;
        break;
      case 'msr':
      default:
        primary = b.msr - a.msr;
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
    minMsr,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinMsr,
    droppedTopSources,
    sources: kept,
  };
}
