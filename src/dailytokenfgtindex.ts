/**
 * daily-token-fgt-index: per-source FOSTER-GREER-THORBECKE FGT(alpha)
 * poverty index of the per-day total_tokens distribution. FORTY-FIRST
 * cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by FGT(alpha) at a
 * RELATIVE poverty line z = lineFraction * mean(D) (Foster, Greer &
 * Thorbecke 1984):
 *
 *     FGT(alpha) = (1/n) * sum_{i: D_i < z} ((z - D_i) / z) ^ alpha
 *
 *   At alpha = 0 this collapses to the HEADCOUNT RATIO (the share of
 *   "poor" days). At alpha = 1 it is the POVERTY GAP RATIO (the
 *   average normalised shortfall, distribution-sensitive only via
 *   depth). At alpha = 2 it is the POVERTY SEVERITY index (squared
 *   shortfalls; Pigou-Dalton transfer-sensitive among the poor). For
 *   general alpha >= 0 the index is bounded in [0, 1] and is
 *   continuous and weakly monotonic in alpha.
 *
 * Why this is GENUINELY ORTHOGONAL to every prior daily-token axis
 * (the central design point of axis-41):
 *
 *   - ONE-SIDED. Every prior daily-token axis (Gini / Pietra /
 *     Atkinson / Theil-L / Theil-T / GE(2) / Palma / Zenga) is a
 *     symmetric inequality measure that uses information from BOTH
 *     tails. FGT(alpha) is a strictly LOWER-TAIL index: it is exactly
 *     0 for any vector whose minimum >= z, regardless of how
 *     concentrated the upper tail is. Two sources can have identical
 *     Gini and Atkinson and Palma but very different FGT(alpha).
 *   - THRESHOLD-ANCHORED. FGT depends only on (D_i, z). The shape of
 *     the distribution above z is invisible to it. Pietra, Palma,
 *     Gini, Zenga read the WHOLE Lorenz curve; Atkinson and the GE
 *     family read every value but with a smooth (non-thresholded)
 *     weighting.
 *   - AXIOMATICALLY DIFFERENT. FGT is the canonical
 *     transfer-sensitive POVERTY index (Sen 1976 family) rather than
 *     an INEQUALITY index. Inequality measures satisfy mean
 *     independence; FGT does NOT (rescaling raises both D_i and z by
 *     the same factor only when the line is relative; with an
 *     absolute line, FGT is scale-sensitive).
 *   - ADDITIVELY SUBGROUP DECOMPOSABLE WITH NO RESIDUAL via the
 *     classical FGT decomposition: for any partition of days into
 *     sub-windows g (e.g. weekday vs weekend; pre/post a date),
 *     FGT(alpha) = sum_g (n_g / n) * FGT_g(alpha). Theil shares this
 *     structure; Gini / Atkinson / Palma DO NOT (Gini has a residual
 *     overlap term, Atkinson is non-decomposable in general). The
 *     refinement on this axis (v0.6.281) surfaces the subgroup
 *     decomposition along the weekday/weekend partition.
 *
 *   Headline question:
 *   **"For each source, what fraction of UTC days are 'starvation
 *     days' (below `lineFraction` of the source's own mean), and how
 *     deep / severe is the shortfall on those days at the configured
 *     curvature alpha?"**
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources with low total mass.
 *   - `minDays` (default 2): FGT degenerate for n < 2 with a
 *     relative line (z = mean would be defined but useless on n=1).
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'fgt'): 'fgt' | 'headcount' | 'povertyGap' |
 *     'tokens' | 'days' | 'source' | 'meanDaily'.
 *   - `alpha` (default 2): curvature parameter; >= 0. Special
 *     readings: 0 = headcount, 1 = poverty gap, 2 = severity. Non-
 *     integer alphas are valid and produce intermediate sensitivity.
 *   - `lineFraction` (default 0.5): the relative poverty line as a
 *     fraction of the per-source mean. Common pairs: 0.5 (median-
 *     income style), 0.4 (deep poverty), 0.6 (at-risk-of-poverty).
 *   - `absoluteLine` (default null): if set, OVERRIDES `lineFraction`
 *     and uses an absolute token-count line z applied uniformly
 *     across all sources. Useful for cross-source comparability.
 *   - `minHeadcount` (default 0): display filter on the headcount.
 *   - `includeSubgroupDecomposition` (refinement v0.6.281): when
 *     true, every emitted row gains a `subgroupDecomposition` field
 *     that splits FGT additively across the weekday/weekend
 *     partition with the exact identity FGT = w_wd * FGT_wd + w_we *
 *     FGT_we (population-share weighted). Pure compute over the same
 *     per-day vector. Surfaces the WHEN-IS-IT-DRY pattern that the
 *     headline FGT collapses.
 */
import type { QueueLine } from './types.js';

export type DailyTokenFgtSort =
  | 'fgt'
  | 'headcount'
  | 'povertyGap'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenFgtOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenFgtSort;
  /** Curvature parameter alpha, >= 0. 0 = headcount, 1 = poverty
   * gap, 2 = severity (default). */
  alpha?: number;
  /** Relative poverty line as a fraction of per-source mean.
   * Default 0.5. In (0, +inf) but typically <= 1. */
  lineFraction?: number;
  /** If set, overrides lineFraction with an absolute token line z
   * applied uniformly across sources. Must be >= 0. */
  absoluteLine?: number | null;
  /** Display filter: drop rows whose headcount < this. In [0, 1]. */
  minHeadcount?: number;
  /** Refinement (v0.6.281): emit weekday/weekend subgroup
   * decomposition. */
  includeSubgroupDecomposition?: boolean;
  generatedAt?: string;
}

export interface FgtSubgroupDecomposition {
  /** Weekday (Mon-Fri) population share n_wd / n. */
  weekdayShare: number;
  /** Weekend (Sat-Sun) population share n_we / n. */
  weekendShare: number;
  /** FGT(alpha) computed on the weekday subset alone, with the
   * SAME global poverty line z (not a re-derived per-subgroup
   * line). */
  fgtWeekday: number;
  /** FGT(alpha) on the weekend subset with the same global line. */
  fgtWeekend: number;
  /** Number of weekday / weekend days in the source. */
  nWeekday: number;
  nWeekend: number;
  /** Identity check: w_wd * fgtWeekday + w_we * fgtWeekend should
   * equal the headline fgt to within ~1e-12. */
  recombinedFgt: number;
  /** True iff |recombinedFgt - fgt| < 1e-9. */
  decompositionExact: boolean;
}

export interface DailyTokenFgtSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Poverty line z used for THIS source (mean * lineFraction or
   * the absolute line). */
  povertyLine: number;
  /** FGT(alpha) at the configured alpha. In [0, 1]. */
  fgt: number;
  /** Headcount ratio = FGT(0) = (#days below z) / n. In [0, 1]. */
  headcount: number;
  /** Average normalised gap = FGT(1). In [0, 1]. */
  povertyGap: number;
  /** FGT(2) (severity), useful as a transfer-sensitive cross
   * anchor regardless of the requested alpha. In [0, 1]. */
  severity: number;
  /** Number of days strictly below the poverty line z. */
  nPoor: number;
  /** Mean shortfall (z - D_i) over the poor only, in tokens. 0
   * if nPoor = 0. */
  meanShortfallTokens: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement (v0.6.281): subgroup split. */
  subgroupDecomposition?: FgtSubgroupDecomposition;
}

export interface DailyTokenFgtReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenFgtSort;
  alpha: number;
  lineFraction: number;
  absoluteLine: number | null;
  minHeadcount: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinHeadcount: number;
  droppedTopSources: number;
  sources: DailyTokenFgtSourceRow[];
}

/**
 * FGT(alpha) of a non-negative vector at a fixed line z. Pure
 * compute. Returns FGT(0) (headcount) and FGT(1) (poverty gap) and
 * FGT(2) (severity) alongside the headline FGT(alpha) so a single
 * pass produces every standard reading.
 *
 * Behaviour:
 *   - n = 0 or z <= 0 -> all four readings are 0.
 *   - alpha = 0: a day at exactly D_i = z is NOT counted as poor
 *     (strict inequality D_i < z). This is the standard FGT
 *     convention and matches Foster-Greer-Thorbecke 1984.
 *   - z is taken AS-IS by this primitive (caller derives it from
 *     mean * lineFraction or an absolute override).
 *
 * Throws on negative / non-finite values or alpha < 0.
 */
export function fgtOfVector(
  values: number[],
  z: number,
  alpha: number = 2,
): {
  fgt: number;
  headcount: number;
  povertyGap: number;
  severity: number;
  nPoor: number;
  meanShortfall: number;
} {
  if (!Number.isFinite(alpha) || alpha < 0) {
    throw new Error(`alpha must be a non-negative finite number (got ${alpha})`);
  }
  if (!Number.isFinite(z) || z < 0) {
    throw new Error(`z must be a non-negative finite number (got ${z})`);
  }
  const n = values.length;
  if (n === 0 || z === 0) {
    return {
      fgt: 0,
      headcount: 0,
      povertyGap: 0,
      severity: 0,
      nPoor: 0,
      meanShortfall: 0,
    };
  }
  let nPoor = 0;
  let sumGap = 0; // sum of (z - D_i)/z
  let sumGap2 = 0; // sum of ((z - D_i)/z)^2
  let sumGapAlpha = 0; // sum of ((z - D_i)/z)^alpha
  let sumShortfallTokens = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `fgtOfVector requires non-negative finite values (got ${v})`,
      );
    }
    if (v < z) {
      nPoor += 1;
      const gap = (z - v) / z; // in (0, 1]
      sumGap += gap;
      sumGap2 += gap * gap;
      // alpha = 0 -> (gap)^0 = 1 (we want it exactly 1, not Math.pow's 1).
      if (alpha === 0) sumGapAlpha += 1;
      else if (alpha === 1) sumGapAlpha += gap;
      else if (alpha === 2) sumGapAlpha += gap * gap;
      else sumGapAlpha += Math.pow(gap, alpha);
      sumShortfallTokens += z - v;
    }
  }
  return {
    fgt: sumGapAlpha / n,
    headcount: nPoor / n,
    povertyGap: sumGap / n,
    severity: sumGap2 / n,
    nPoor,
    meanShortfall: nPoor > 0 ? sumShortfallTokens / nPoor : 0,
  };
}

/**
 * UTC day-of-week classification. Returns true for Mon-Fri and
 * false for Sat-Sun. Pure compute on a YYYY-MM-DD string.
 */
function isWeekdayUtc(day: string): boolean {
  // day = 'YYYY-MM-DD'
  const ms = Date.parse(day + 'T00:00:00Z');
  if (!Number.isFinite(ms)) return true; // benign default
  const dow = new Date(ms).getUTCDay(); // 0 = Sun ... 6 = Sat
  return dow >= 1 && dow <= 5;
}

export function buildDailyTokenFgtIndex(
  queue: QueueLine[],
  opts: DailyTokenFgtOptions = {},
): DailyTokenFgtReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (FGT is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const alpha = opts.alpha ?? 2;
  if (!Number.isFinite(alpha) || alpha < 0) {
    throw new Error(
      `alpha must be a non-negative finite number (got ${opts.alpha})`,
    );
  }
  const lineFraction = opts.lineFraction ?? 0.5;
  if (!Number.isFinite(lineFraction) || lineFraction <= 0) {
    throw new Error(
      `lineFraction must be a positive finite number (got ${opts.lineFraction})`,
    );
  }
  const absoluteLine = opts.absoluteLine ?? null;
  if (absoluteLine !== null && (!Number.isFinite(absoluteLine) || absoluteLine < 0)) {
    throw new Error(
      `absoluteLine must be a non-negative finite number or null (got ${opts.absoluteLine})`,
    );
  }
  const minHeadcount = opts.minHeadcount ?? 0;
  if (!Number.isFinite(minHeadcount) || minHeadcount < 0 || minHeadcount > 1) {
    throw new Error(
      `minHeadcount must be a number in [0, 1] (got ${opts.minHeadcount})`,
    );
  }
  const sort: DailyTokenFgtSort = opts.sort ?? 'fgt';
  const validSorts: DailyTokenFgtSort[] = [
    'fgt',
    'headcount',
    'povertyGap',
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
  const rows: DailyTokenFgtSourceRow[] = [];

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
    const days: string[] = [];
    const values: number[] = [];
    let maxDailyTokens = -1;
    let maxDay = acc.firstDay;
    let minDailyTokens = Number.POSITIVE_INFINITY;
    let minDay = acc.firstDay;
    let nZeroDays = 0;
    for (const [d, v] of acc.perDay) {
      days.push(d);
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
    const mean = acc.totalTokens / nDays;
    const povertyLine = absoluteLine !== null ? absoluteLine : mean * lineFraction;
    const headlineRes = fgtOfVector(values, povertyLine, alpha);
    // Compute alpha=2 (severity) explicitly when the requested alpha
    // is not 2 so the report always exposes the severity anchor.
    const severityRes = alpha === 2 ? headlineRes : fgtOfVector(values, povertyLine, 2);

    let subgroupDecomposition: FgtSubgroupDecomposition | undefined;
    if (opts.includeSubgroupDecomposition) {
      const wdVals: number[] = [];
      const weVals: number[] = [];
      for (let i = 0; i < days.length; i += 1) {
        const d = days[i] as string;
        const v = values[i] as number;
        if (isWeekdayUtc(d)) wdVals.push(v);
        else weVals.push(v);
      }
      const fgtWd =
        wdVals.length > 0 ? fgtOfVector(wdVals, povertyLine, alpha).fgt : 0;
      const fgtWe =
        weVals.length > 0 ? fgtOfVector(weVals, povertyLine, alpha).fgt : 0;
      const wWd = wdVals.length / nDays;
      const wWe = weVals.length / nDays;
      const recombined = wWd * fgtWd + wWe * fgtWe;
      subgroupDecomposition = {
        weekdayShare: wWd,
        weekendShare: wWe,
        fgtWeekday: fgtWd,
        fgtWeekend: fgtWe,
        nWeekday: wdVals.length,
        nWeekend: weVals.length,
        recombinedFgt: recombined,
        decompositionExact: Math.abs(recombined - headlineRes.fgt) < 1e-9,
      };
    }

    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      povertyLine,
      fgt: headlineRes.fgt,
      headcount: headlineRes.headcount,
      povertyGap: headlineRes.povertyGap,
      severity: severityRes.fgt,
      nPoor: headlineRes.nPoor,
      meanShortfallTokens: headlineRes.meanShortfall,
      meanDailyTokens: mean,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
      ...(subgroupDecomposition ? { subgroupDecomposition } : {}),
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinHeadcount = 0;
  let filtered = rows;
  if (minHeadcount > 0) {
    const next: DailyTokenFgtSourceRow[] = [];
    for (const r of rows) {
      if (r.headcount >= minHeadcount) next.push(r);
      else droppedBelowMinHeadcount += 1;
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
      case 'headcount':
        primary = b.headcount - a.headcount;
        break;
      case 'povertyGap':
        primary = b.povertyGap - a.povertyGap;
        break;
      case 'fgt':
      default:
        primary = b.fgt - a.fgt;
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
    alpha,
    lineFraction,
    absoluteLine,
    minHeadcount,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinHeadcount,
    droppedTopSources,
    sources: kept,
  };
}
