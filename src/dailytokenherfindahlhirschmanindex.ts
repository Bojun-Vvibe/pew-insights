/**
 * daily-token-herfindahl-hirschman-index: per-source
 * HERFINDAHL-HIRSCHMAN INDEX (HHI) of the per-day total_tokens
 * distribution.
 *
 * ONE-HUNDRED-AND-FORTY-THIRD cross-source axis.
 *
 *     HHI = sum_i s_i^2,    where s_i = D_i / sum_j D_j
 *
 * with D = (D_1, ..., D_n) the per-source per-day total_tokens
 * vector (one scalar per UTC day, sum of hourly buckets).
 *
 * HHI is the canonical INDUSTRIAL-ORGANIZATION concentration
 * measure (Hirschman 1945, "National Power and the Structure of
 * Foreign Trade"; Herfindahl 1950, Columbia PhD thesis). The
 * U.S. Department of Justice antitrust guidelines report HHI
 * alongside CR4 (axis-142). In the daily-token setting HHI asks
 * **how concentrated is a source's total token mass across its
 * active days, weighted by squared share**.
 *
 * RANGE AND BOUNDS:
 *   - HHI in [1/n, 1] for n >= 1.
 *   - Lower bound 1/n attained iff D is perfectly flat
 *     (s_i = 1/n for every i).
 *   - Upper bound 1 attained iff a single day carries 100% of
 *     the mass (a "monopoly day").
 *   - SCALE-INVARIANT: HHI(c * D) = HHI(D) for any c > 0.
 *   - PERMUTATION-INVARIANT: depends only on the multiset of
 *     shares, not their ordering.
 *
 * NORMALISED HHI (refinement, see below):
 *
 *     HHI* = (HHI - 1/n) / (1 - 1/n)    for n >= 2
 *
 * lives in [0, 1] regardless of n, making cross-source ranking
 * of a 6-day series and a 73-day series directly comparable.
 *
 * EFFECTIVE NUMBER OF DAYS (REFINEMENT):
 *
 *     N_eff = 1 / HHI
 *
 * is the inverse-Simpson "effective number of equally-busy
 * days". For a flat n-day vector, N_eff = n. For a one-day
 * monopoly, N_eff = 1.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW AXIS:
 *
 *   - vs CR4 (axis-142): CR4 is a SPARSE FUNCTIONAL on a
 *     FIXED-SIZE top set (k=4); it ignores everything outside
 *     the top-4 days. HHI is a DENSE FUNCTIONAL: every day
 *     contributes via its squared share. CR4 is piecewise-linear
 *     in D; HHI is QUADRATIC in D and therefore strictly
 *     more sensitive to single-day spikes than CR4 is.
 *   - vs the inequality family (axes 32-57: Gini, S-Gini,
 *     Atkinson, Theil, GE, Hoover, Pietra, Bonferroni, Mehran,
 *     Wolfson, Foster-Wolfson, Palma, Kolm-Pollak, Chakravarty,
 *     Amato, Esteban-Ray, FGT, Var-of-Logs, Log-MAD): all
 *     normalise by the MEAN and integrate against the Lorenz
 *     curve (linear-ish in shares). HHI normalises by the SUM
 *     and aggregates SQUARED shares (quadratic). HHI is the
 *     unique scale-invariant L^2 functional on the simplex; the
 *     Lorenz family lives in L^1.
 *   - vs QSR / DSG (axes 61, 62): those are RATIOS OF QUANTILE
 *     MASSES. HHI is a SUM OF SQUARED SHARES. QSR/DSG depend
 *     on the order-statistic structure; HHI depends only on
 *     the MULTISET of shares.
 *   - vs Hill tail index (axis 64) and the spectral / FD /
 *     entropy axes: those are ASYMPTOTIC or BANDWIDTH-INTEGRATED.
 *     HHI is a FINITE-WINDOW closed-form sum.
 *   - vs the divergence-of-halves family (axes 118-140): those
 *     compare halves of the day vector. HHI is computed on the
 *     WHOLE vector and is permutation-invariant.
 *   - vs PSS (axis-141): PSS surfaces the SIGN of asymmetry;
 *     HHI surfaces the MAGNITUDE of mass concentration.
 *
 * RANK-FLIP WITNESS vs CR4 (axis-142). Construct two day
 * vectors with the SAME number of days n=10:
 *
 *   A = [40, 40, 40, 40, 1, 1, 1, 1, 1, 1]    (n=10)
 *     total = 166; shares roughly (0.241,0.241,0.241,0.241,
 *       0.006,0.006,0.006,0.006,0.006,0.006).
 *     CR4(A) = (40+40+40+40)/166 = 160/166 = 0.96386...
 *     HHI(A) = 4 * (40/166)^2 + 6 * (1/166)^2
 *            = 4 * 0.058065 + 6 * 0.0000363
 *            = 0.23226 + 0.000218 = 0.23248...
 *
 *   B = [100, 30, 30, 30, 1, 1, 1, 1, 1, 1]   (n=10)
 *     total = 196; shares: 100/196=0.5102, 30/196=0.1531,
 *       30/196=0.1531, 30/196=0.1531, six at 1/196=0.0051.
 *     CR4(B) = (100+30+30+30)/196 = 190/196 = 0.96939...
 *     HHI(B) = (100/196)^2 + 3*(30/196)^2 + 6*(1/196)^2
 *            = 0.26031 + 3 * 0.023438 + 6 * 0.000026
 *            = 0.26031 + 0.07031 + 0.000156 = 0.33078...
 *
 *   CR4 ranks B > A (0.969 > 0.964) — a near-tie. HHI ranks
 *   B >> A (0.331 > 0.232) — an enormous gap. HHI penalises
 *   B's single-day spike (one share at 0.51 contributes 0.26
 *   to HHI all by itself) far more aggressively than CR4 can,
 *   because CR4 caps at the top-4 mass share. Genuine flip in
 *   ordering MAGNITUDE: HHI is QUADRATIC and therefore
 *   spike-sensitive, CR4 is piecewise-linear and therefore
 *   spike-insensitive within the top-4 set.
 *
 * Headline question:
 * **"How concentrated is a source's total token mass across
 *   its active UTC days, measured by sum of squared daily
 *   shares?"**
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10] (n=10):
 *   total = 55
 *   sum of squares = 1+4+9+16+25+36+49+64+81+100 = 385
 *   HHI = 385 / 55^2 = 385 / 3025 = 0.12727272...
 *   lowerBound = 1/10 = 0.1
 *   normalisedHhi = (0.127272 - 0.1) / (1 - 0.1)
 *                 = 0.027272 / 0.9 = 0.030303...
 *   N_eff = 1 / 0.127272 = 7.857142...
 */
import type { QueueLine } from './types.js';

export type DailyTokenHerfindahlHirschmanIndexSort =
  | 'hhi'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'lowerBound'
  | 'normalisedHhi'
  | 'effectiveDays';

export interface DailyTokenHerfindahlHirschmanIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenHerfindahlHirschmanIndexSort;
  minHhi?: number | null;
  generatedAt?: string;
}

export interface DailyTokenHerfindahlHirschmanIndexSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  hhi: number;
  lowerBound: number;
  slack: number;
  /**
   * Refinement: HHI normalised against the available headroom
   * (1 - 1/n). normalisedHhi = (hhi - 1/n) / (1 - 1/n) in [0, 1]
   * for n >= 2. 0 = at the flat-floor, 1 = single-day monopoly.
   * Cross-source comparable. NaN-safe: 0 if degenerate (n < 2).
   */
  normalisedHhi: number;
  /**
   * Refinement: inverse-Simpson "effective number of equally-busy
   * days" = 1 / hhi. For a flat n-day vector, N_eff = n. For a
   * one-day monopoly, N_eff = 1. NaN-safe: 0 if hhi == 0.
   */
  effectiveDays: number;
  /**
   * Refinement: classification of concentration intensity using
   * the DOJ Horizontal Merger Guidelines bands MAPPED INTO THE
   * NORMALISED HHI* SCALE so that the bands are cross-source
   * comparable regardless of n (the raw DOJ bands were defined
   * over market shares in [0, 100] which is an n-invariant
   * basis -- the same logic applies here once we compensate for
   * the floor 1/n):
   *   - 'low'         : normalisedHhi < 0.15 (close to flat-floor)
   *   - 'moderate'    : 0.15 <= normalisedHhi < 0.25
   *   - 'high'        : normalisedHhi >= 0.25 (top-heavy clumping)
   *   - 'degenerate'  : n < 2 (HHI = 1 trivially)
   */
  concentrationRegime: 'low' | 'moderate' | 'high' | 'degenerate';
  meanDailyTokens: number;
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  maxShare: number;
  /**
   * Refinement: fraction of HHI explained by the single peak day,
   * `peakDayHhiContribution = maxShare^2 / hhi` in `[1/n, 1]`.
   *
   * Closed-form interpretation: HHI is the sum of squared shares;
   * the single largest share contributes `maxShare^2` to that sum
   * and `peakDayHhiContribution` reports its fractional share of
   * the total HHI. A value near `1/n` means concentration is
   * EVENLY DISTRIBUTED across all days (no single dominant day);
   * a value near `1` means HHI is essentially driven by ONE
   * monopoly day and the rest of the vector contributes negligibly.
   *
   * Cross-source comparable on `[0, 1]`. NaN-safe: returns `1` if
   * `hhi == 0` (degenerate empty case) so degenerate rows do not
   * silently sort low. For `n=1` this is `1` by construction.
   */
  peakDayHhiContribution: number;
  /**
   * Refinement: structural label for the peak-day contribution:
   *   - `'spread'`     : peakDayHhiContribution < 0.5 -- HHI is
   *                      driven by MULTIPLE busy days, not one.
   *   - `'peak-driven'`: peakDayHhiContribution in `[0.5, 0.85)` --
   *                      a single peak day dominates concentration
   *                      but other days still matter.
   *   - `'monopoly'`   : peakDayHhiContribution >= 0.85 -- one day
   *                      essentially explains all of HHI.
   *   - `'degenerate'` : `n < 2`.
   */
  peakRegime: 'spread' | 'peak-driven' | 'monopoly' | 'degenerate';
}

export interface DailyTokenHerfindahlHirschmanIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenHerfindahlHirschmanIndexSort;
  minHhi: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinHhi: number;
  droppedTopSources: number;
  sources: DailyTokenHerfindahlHirschmanIndexSourceRow[];
}

export function herfindahlHirschmanIndexOfVector(values: number[]): {
  hhi: number;
  total: number;
  mean: number;
  lowerBound: number;
  slack: number;
  normalisedHhi: number;
  effectiveDays: number;
  maxShare: number;
  degenerate: boolean;
} {
  const n = values.length;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `herfindahlHirschmanIndexOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (n === 0) {
    return {
      hhi: 0,
      total: 0,
      mean: 0,
      lowerBound: 0,
      slack: 0,
      normalisedHhi: 0,
      effectiveDays: 0,
      maxShare: 0,
      degenerate: true,
    };
  }
  if (n === 1) {
    return {
      hhi: 1,
      total,
      mean: total,
      lowerBound: 1,
      slack: 0,
      normalisedHhi: 0,
      effectiveDays: 1,
      maxShare: 1,
      degenerate: true,
    };
  }
  let sumSq = 0;
  let maxShare = 0;
  for (const v of values) {
    const s = v / total;
    sumSq += s * s;
    if (s > maxShare) maxShare = s;
  }
  const hhi = sumSq;
  const mean = total / n;
  const lowerBound = 1 / n;
  const slack = hhi - lowerBound;
  const headroom = 1 - lowerBound;
  const normalisedHhi =
    headroom > 0 ? Math.max(0, Math.min(1, slack / headroom)) : 0;
  const effectiveDays = hhi > 0 ? 1 / hhi : 0;
  return {
    hhi,
    total,
    mean,
    lowerBound,
    slack,
    normalisedHhi,
    effectiveDays,
    maxShare,
    degenerate: false,
  };
}

export function buildDailyTokenHerfindahlHirschmanIndex(
  queue: QueueLine[],
  opts: DailyTokenHerfindahlHirschmanIndexOptions = {},
): DailyTokenHerfindahlHirschmanIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (HHI normalisation degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minHhi = opts.minHhi ?? null;
  if (minHhi !== null && (!Number.isFinite(minHhi) || minHhi < 0 || minHhi > 1)) {
    throw new Error(
      `minHhi must be a finite number in [0, 1] or null (got ${opts.minHhi})`,
    );
  }
  const sort: DailyTokenHerfindahlHirschmanIndexSort = opts.sort ?? 'hhi';
  const validSorts: DailyTokenHerfindahlHirschmanIndexSort[] = [
    'hhi',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'lowerBound',
    'normalisedHhi',
    'effectiveDays',
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
  const rows: DailyTokenHerfindahlHirschmanIndexSourceRow[] = [];

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
    const r = herfindahlHirschmanIndexOfVector(values);
    let concentrationRegime:
      | 'low'
      | 'moderate'
      | 'high'
      | 'degenerate';
    if (r.degenerate) {
      concentrationRegime = 'degenerate';
    } else if (r.normalisedHhi < 0.15) {
      concentrationRegime = 'low';
    } else if (r.normalisedHhi < 0.25) {
      concentrationRegime = 'moderate';
    } else {
      concentrationRegime = 'high';
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hhi: r.hhi,
      lowerBound: r.lowerBound,
      slack: r.slack,
      normalisedHhi: r.normalisedHhi,
      effectiveDays: r.effectiveDays,
      concentrationRegime,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      maxShare: r.maxShare,
      peakDayHhiContribution:
        r.degenerate || r.hhi <= 0 ? 1 : (r.maxShare * r.maxShare) / r.hhi,
      peakRegime: r.degenerate
        ? 'degenerate'
        : (r.maxShare * r.maxShare) / r.hhi < 0.5
          ? 'spread'
          : (r.maxShare * r.maxShare) / r.hhi < 0.85
            ? 'peak-driven'
            : 'monopoly',
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinHhi = 0;
  let filtered = rows;
  if (minHhi !== null) {
    const next: DailyTokenHerfindahlHirschmanIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.hhi >= minHhi) next.push(r);
      else droppedBelowMinHhi += 1;
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
      case 'lowerBound':
        primary = b.lowerBound - a.lowerBound;
        break;
      case 'normalisedHhi':
        primary = b.normalisedHhi - a.normalisedHhi;
        break;
      case 'effectiveDays':
        primary = b.effectiveDays - a.effectiveDays;
        break;
      case 'hhi':
      default:
        primary = b.hhi - a.hhi;
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
    minHhi,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinHhi,
    droppedTopSources,
    sources: kept,
  };
}
