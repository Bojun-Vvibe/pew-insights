/**
 * daily-token-top-four-concentration-ratio: per-source TOP-4
 * CONCENTRATION RATIO (CR4) of the per-day total_tokens
 * distribution.
 *
 * ONE-HUNDRED-AND-FORTY-SECOND cross-source axis.
 *
 *     CR4 = (sum of the 4 largest D_i) / (sum of all D_i)
 *
 * where D = (D_1, ..., D_n) is the per-source per-day total_tokens
 * vector (one scalar per UTC day, sum of hourly buckets). CR4 lives
 * in [4/n, 1] for n >= 4 (lower bound attained by the perfectly-flat
 * day vector, upper bound attained when the four busiest days carry
 * 100% of the mass). For n < 4 we fall back to CR_n = 1 by
 * definition (all days are in the top-4 set) and mark the row
 * degenerate.
 *
 * CR4 is the canonical INDUSTRIAL-ORGANIZATION concentration measure
 * (Bain 1956, "Barriers to New Competition"; Hannah & Kay 1977).
 * Antitrust regulators report CR4 alongside Herfindahl-Hirschman; in
 * the daily-token setting CR4 asks **what fraction of a source's
 * total token mass is concentrated in its four busiest days**.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW AXIS:
 *
 *   - vs the inequality family (axes 32-57: Gini, S-Gini, Atkinson,
 *     Theil, GE, Hoover, Pietra, Bonferroni, Mehran, Wolfson,
 *     Foster-Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray, FGT, Var-of-Logs, Log-MAD): all integrate over
 *     the FULL Lorenz curve / FULL distribution and divide by the
 *     MEAN. CR4 is a SPARSE FUNCTIONAL on a FIXED-SIZE top set
 *     (k=4); it ignores everything outside the top-4 days.
 *   - vs QSR / DSG (axes 61, 62): those use a RELATIVE quintile/
 *     decile cut (k = ceil(0.20 n) or ceil(0.10 n)) which scales
 *     with n. CR4 uses an ABSOLUTE cut (k = 4) which does NOT scale
 *     with n. As n grows, QSR/DSG cover proportionally more days;
 *     CR4 covers proportionally fewer. They answer different
 *     questions on long vs short series.
 *   - vs PGR / IOM / MSR (axes 58, 59, 60): those are RATIOS OF
 *     PERCENTILE VALUES. CR4 is a RATIO OF MASSES (sum / total).
 *   - vs Hill tail index (axis 64) and the spectral / FD / entropy
 *     axes: those are ASYMPTOTIC or BANDWIDTH-INTEGRATED. CR4 is a
 *     finite-window mass share with a closed-form bound.
 *   - vs the divergence-of-halves family (axes 118-140: KS, MWU,
 *     AD, CvM, Bhatt, Hellinger, JS, K, KJ, Topsoe, Taneja,
 *     Wasserstein, MMD, Energy, Mahalanobis, Neyman): those compare
 *     halves of the day vector. CR4 is computed on the WHOLE vector
 *     and is permutation-invariant.
 *   - vs PSS (axis 141): PSS surfaces the SIGN of asymmetry; CR4
 *     surfaces the MAGNITUDE of upper-tail mass concentration.
 *
 * RANK-FLIP WITNESS vs Gini (axis 32). Construct two day vectors:
 *
 *   A = [10, 10, 10, 10, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]  (n=10)
 *     CR4(A) = (10+10+10+10) / (40 + 0.6) = 40 / 40.6 = 0.985222...
 *     Lorenz curve: very steep top, very flat bottom -> Gini ~ 0.444
 *
 *   B = [100, 1, 1, 1, 1, 1, 1, 1, 1, 1]                (n=10)
 *     CR4(B) = (100+1+1+1) / (100+9) = 103 / 109 = 0.944954...
 *     Gini ~ 0.81 (one mega-day, nine flat days)
 *
 *   CR4 ranks A > B (0.985 > 0.945): A's mass is concentrated in
 *   the top-4 fixed set, even though A's overall distribution is
 *   far MORE EVEN than B's by every Lorenz functional. Gini ranks
 *   B >> A because Gini integrates the WHOLE Lorenz curve and the
 *   single B spike crushes it. Genuine flip: CR4 is a TOP-k MASS
 *   functional, Gini is a FULL-MEAN functional.
 *
 * Headline question:
 * **"What fraction of a source's total token mass lives in its
 *   four busiest UTC days?"**
 *
 * Range, special cases, invariances:
 *   - CR4 in [4/n, 1] for n >= 4. Lower bound iff the day vector is
 *     constant; upper bound iff total mass is in the top-4 set.
 *   - SCALE-INVARIANT: CR4(c * D) = CR4(D) for any c > 0.
 *   - PERMUTATION-INVARIANT: depends only on the sorted vector.
 *   - For n in {1, 2, 3, 4}: CR_n = 1 trivially; we mark degenerate.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10]:
 *   topMass = 10+9+8+7 = 34; total = 55
 *   CR4 = 34 / 55 = 0.6181818...
 *   lowerBound = 4/10 = 0.4
 *   slack = CR4 - lowerBound = 0.2181818...
 */
import type { QueueLine } from './types.js';

export type DailyTokenTopFourConcentrationRatioSort =
  | 'cr4'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'topMass'
  | 'lowerBound';

export interface DailyTokenTopFourConcentrationRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenTopFourConcentrationRatioSort;
  minCr4?: number | null;
  generatedAt?: string;
}

export interface DailyTokenTopFourConcentrationRatioSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  topMass: number;
  cr4: number;
  lowerBound: number;
  slack: number;
  meanDailyTokens: number;
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
}

export interface DailyTokenTopFourConcentrationRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenTopFourConcentrationRatioSort;
  minCr4: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinCr4: number;
  droppedTopSources: number;
  sources: DailyTokenTopFourConcentrationRatioSourceRow[];
}

export function topFourConcentrationRatioOfVector(values: number[]): {
  cr4: number;
  topMass: number;
  total: number;
  mean: number;
  lowerBound: number;
  slack: number;
  degenerate: boolean;
} {
  const n = values.length;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `topFourConcentrationRatioOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (n === 0) {
    return {
      cr4: 0,
      topMass: 0,
      total: 0,
      mean: 0,
      lowerBound: 0,
      slack: 0,
      degenerate: true,
    };
  }
  const sorted = values.slice().sort((a, b) => b - a);
  const k = Math.min(4, n);
  let topMass = 0;
  for (let i = 0; i < k; i += 1) topMass += sorted[i]!;
  const cr4 = total > 0 ? topMass / total : 0;
  const mean = total / n;
  const lowerBound = n >= 4 ? 4 / n : 1;
  const slack = cr4 - lowerBound;
  const degenerate = n < 5;
  return {
    cr4,
    topMass,
    total,
    mean,
    lowerBound,
    slack,
    degenerate,
  };
}

export function buildDailyTokenTopFourConcentrationRatio(
  queue: QueueLine[],
  opts: DailyTokenTopFourConcentrationRatioOptions = {},
): DailyTokenTopFourConcentrationRatioReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 5) {
    throw new Error(
      `minDays must be an integer >= 5 (CR4 is degenerate for n<5) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minCr4 = opts.minCr4 ?? null;
  if (minCr4 !== null && (!Number.isFinite(minCr4) || minCr4 < 0 || minCr4 > 1)) {
    throw new Error(
      `minCr4 must be a finite number in [0, 1] or null (got ${opts.minCr4})`,
    );
  }
  const sort: DailyTokenTopFourConcentrationRatioSort = opts.sort ?? 'cr4';
  const validSorts: DailyTokenTopFourConcentrationRatioSort[] = [
    'cr4',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'topMass',
    'lowerBound',
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
  const rows: DailyTokenTopFourConcentrationRatioSourceRow[] = [];

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
    const r = topFourConcentrationRatioOfVector(values);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      topMass: r.topMass,
      cr4: r.cr4,
      lowerBound: r.lowerBound,
      slack: r.slack,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinCr4 = 0;
  let filtered = rows;
  if (minCr4 !== null) {
    const next: DailyTokenTopFourConcentrationRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.cr4 >= minCr4) next.push(r);
      else droppedBelowMinCr4 += 1;
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
      case 'topMass':
        primary = b.topMass - a.topMass;
        break;
      case 'lowerBound':
        primary = b.lowerBound - a.lowerBound;
        break;
      case 'cr4':
      default:
        primary = b.cr4 - a.cr4;
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
    minCr4,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinCr4,
    droppedTopSources,
    sources: kept,
  };
}
