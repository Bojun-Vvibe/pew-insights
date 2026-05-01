/**
 * daily-token-quintile-share-ratio: per-source QUINTILE SHARE RATIO
 *
 *     QSR (S80/S20) = topMass / bottomMass
 *
 * where topMass = sum of the largest ceil(0.20 * n) days and
 * bottomMass = sum of the smallest ceil(0.20 * n) days of the per-day
 * total_tokens distribution.
 *
 * SIXTY-SECOND cross-source axis.
 *
 * For each source we collapse all hourly buckets into one scalar per
 * UTC day (D_d = sum of total_tokens on day d). Sort the resulting
 * day vector D = (D_1, ..., D_n) ascending. Let
 *
 *     k = ceil(0.20 * n)
 *     bottomMass = sum of the SMALLEST k values
 *     topMass    = sum of the LARGEST  k values
 *     QSR        = topMass / bottomMass        in [1, +inf)
 *
 * QSR is the canonical EU-SILC inequality measure (also called the
 * Income Quintile Share Ratio). It asks how many TIMES more total
 * daily-token mass lives in the busiest fifth of days than in the
 * quietest fifth. It is dimensionless, scale-invariant, and
 * permutation-invariant.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..61):
 *
 *   - axes 32..57 are MOMENT- or LORENZ-functional summaries (Gini,
 *     S-Gini, Atkinson, Theil, GE family, Hoover, Pietra, Bonferroni,
 *     Mehran, Wolfson, Foster-Wolfson, Palma, Kolm-Pollak, Chakravarty,
 *     Amato, Esteban-Ray, Var-of-Logs, Log-MAD, FGT). Each integrates
 *     over the FULL Lorenz curve / FULL distribution and is normalised
 *     by the MEAN.
 *   - Palma ratio (axis already shipped) = top-10% MASS share / bottom-40%
 *     MASS share -- ASYMMETRIC quintile-pair contrast. QSR is the
 *     SYMMETRIC quintile pair (top-20 vs bottom-20). Different cuts,
 *     different functional family.
 *   - axis 58 (PGR = P90/P50) is a TAIL-VS-MEDIAN ratio of percentile
 *     VALUES.
 *   - axis 59 (IOM = (P75-P25)/P50) is a CENTRAL-VS-MEDIAN ratio of
 *     percentile VALUES.
 *   - axis 60 (MSR = (P75-P25)/(P90-P10)) is a SHAPE ratio of
 *     percentile VALUES, normalised by another percentile-value spread.
 *   - axis 61 (DSG = (topMass - bottomMass) / total of two extreme
 *     DECILES, k=ceil(0.10n)) is a DIFFERENCE-OVER-TOTAL functional on
 *     the DECILE cut, in [0, 1].
 *   - QSR (this axis, 62) is a RATIO-OF-MASSES (not a difference) on
 *     the QUINTILE cut (k=ceil(0.20n), not 0.10n), unbounded above
 *     ([1, +inf)), and is NORMALISED BY bottomMass (a mass), not by
 *     total nor by mean. It is a HYPERBOLIC functional of the sorted
 *     day vector (degenerates as bottomMass -> 0), in contrast to
 *     DSG which is a sparse LINEAR functional.
 *
 * RANK-FLIP WITNESS vs axis-61 DSG. Construct two day vectors of
 * length 10:
 *
 *   A = [1, 1, 4, 4, 4, 4, 4, 4, 9, 9]
 *     k_QSR = ceil(0.20 * 10) = 2
 *     bottomMass_QSR = 1 + 1 = 2; topMass_QSR = 9 + 9 = 18
 *     total = 44
 *     QSR(A) = 18 / 2 = 9.0
 *     k_DSG = ceil(0.10 * 10) = 1
 *     bottomMass_DSG = 1; topMass_DSG = 9
 *     DSG(A) = (9 - 1) / 44 = 8/44 = 0.181818...
 *
 *   B = [1, 3, 3, 3, 3, 3, 3, 3, 3, 20]
 *     k_QSR = 2
 *     bottomMass_QSR = 1 + 3 = 4; topMass_QSR = 3 + 20 = 23
 *     total = 45
 *     QSR(B) = 23 / 4 = 5.75
 *     k_DSG = 1
 *     bottomMass_DSG = 1; topMass_DSG = 20
 *     DSG(B) = (20 - 1) / 45 = 19/45 = 0.422222...
 *
 *   QSR ranks A > B (9.0 > 5.75): A's symmetric quintile cut sees a
 *   very low bottomMass (two 1's) AND a high topMass (two 9's), while
 *   B's bottomMass is dragged up by the second-smallest day (a 3).
 *   DSG ranks B > A (0.422 > 0.182): B has a single extreme spike
 *   (20) that maximises the SINGLE-decile gap, while A's mass is
 *   spread across two top-decile days that don't individually spike.
 *   This is a genuine flip: QSR is a multiplicative functional on the
 *   quintile cut (sensitive to bottomMass via division), DSG is an
 *   additive functional on the decile cut (sensitive only to the
 *   single-element extremes).
 *
 * RANK-FLIP WITNESS vs axis-60 MSR (verified on the same A/B pair):
 *   For A, sorted: P10=v[1]=1, P25 (h=2.25)=4, P50=4, P75 (h=6.75)=4,
 *     P90=v[8]=9. IQR = 0, IDR = 8, MSR = 0/8 = 0.
 *   For B, sorted: P10=v[1]=3, P25=3, P50=3, P75=3, P90=v[8]=3.
 *     IQR=0, IDR=0, MSR = 0/0 (degenerate -- tight body of 3's).
 *   QSR ranks A > B (both A and B finite); MSR is degenerate on B and
 *   zero on A. Real flip vs the percentile-VALUE spread family.
 *
 *   Headline question:
 *   **"How many times more total daily-token mass lives in each
 *     source's busiest 20% of days than in its quietest 20% of days?"**
 *
 * Range and special cases:
 *   - QSR >= 1 always (topMass >= bottomMass on a sorted vector).
 *   - QSR == 1 iff topMass == bottomMass (forces the extreme quintiles
 *     to be flat -- on a strictly-positive vector this means the
 *     entire body is constant when 2k >= n). Marked degenerate=true.
 *   - QSR == +inf if bottomMass == 0; impossible here since per-day
 *     totals are strictly positive. We still guard the denominator
 *     defensively (degenerate=true if bottomMass == 0).
 *   - QSR is SCALE-INVARIANT (top and bottom both scale by c).
 *   - QSR is PERMUTATION-INVARIANT (depends only on sorted vector).
 *   - QSR is HYPERBOLIC in bottomMass (small bottomMass amplifies QSR
 *     dramatically); contrast DSG which is bounded in [0, 1].
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sparse sources.
 *   - `minDays` (default 5): QSR requires k = ceil(0.20*n) >= 1 and
 *     a non-overlapping body (n - 2k > 0 needs n >= 5 to be
 *     non-degenerate with k=1; default 5 keeps the cut meaningful).
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'qsr'): 'qsr' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'topMass' | 'bottomMass' | 'k'.
 *   - `minQsr` (>=1, optional): display filter on qsr.
 *   - `includePalma` (refinement): also surface Palma ratio
 *     (top-10% mass share / bottom-40% mass share) for cross-axis
 *     comparison vs the asymmetric-quintile-pair axis.
 *
 * CLOSED-FORM ANCHOR. For D = [1..10]:
 *   k = ceil(0.20 * 10) = 2
 *   sorted: [1,2,3,4,5,6,7,8,9,10]
 *   bottomMass = 1+2 = 3; topMass = 9+10 = 19; total = 55
 *   QSR = 19 / 3 = 6.3333333...
 * Reproduced exactly by `quintileShareRatioOfVector([1..10])` in tests.
 *
 * SMALL-N BEHAVIOUR (refinement, v0.6.307+ tests). For n=2,3,4 the
 * formula reduces to ratio of single-element extremes:
 *   n=2: k=1, QSR = max / min
 *   n=3: k=1, QSR = max / min (middle element ignored, body size 1)
 *   n=4: k=1, QSR = max / min (body size 2)
 * For n>=5 the body becomes large enough that QSR is sensitive to
 * mass aggregation in the extreme quintiles rather than just the
 * single most-extreme days; this is why `--min-days` defaults to 5.
 */
import type { QueueLine } from './types.js';

export type DailyTokenQuintileShareRatioSort =
  | 'qsr'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'topMass'
  | 'bottomMass'
  | 'k';

export interface DailyTokenQuintileShareRatioOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenQuintileShareRatioSort;
  /** Display filter: drop rows whose qsr < this value (>= 1). Default null = no filter. */
  minQsr?: number | null;
  /** Refinement: surface Palma ratio alongside QSR for cross-axis comparison. */
  includePalma?: boolean;
  generatedAt?: string;
}

export interface DailyTokenQuintileShareRatioSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** k = ceil(0.20 * nDays); the size of each extreme quintile. */
  k: number;
  /** Sum of the smallest k daily totals. */
  bottomMass: number;
  /** Sum of the largest k daily totals. */
  topMass: number;
  /** topMass / total in [0, 1]. */
  topShare: number;
  /** bottomMass / total in [0, 1]. */
  bottomShare: number;
  /** QSR = topMass / bottomMass in [1, +inf). NaN-safe: 0 if degenerate. */
  qsr: number;
  /** mean(D_i) -- for cross-reference only. */
  meanDailyTokens: number;
  /** True iff n < 2 OR bottomMass == 0 OR topMass == bottomMass. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Palma ratio = (top 10% mass share) / (bottom 40% mass share). Only set when includePalma=true. */
  palma?: number;
}

export interface DailyTokenQuintileShareRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenQuintileShareRatioSort;
  minQsr: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinQsr: number;
  droppedTopSources: number;
  sources: DailyTokenQuintileShareRatioSourceRow[];
}

/**
 * QSR = topMass / bottomMass of a strictly-positive numeric vector,
 * where topMass = sum of the largest ceil(0.20*n) values and
 * bottomMass = sum of the smallest ceil(0.20*n) values.
 *
 * Returns degenerate=true with qsr=0 for empty input or n<2; with
 * qsr=0 when bottomMass == 0 (impossible on strictly-positive input
 * but guarded); with qsr=1 when topMass == bottomMass.
 * Throws on negative, zero, or non-finite input.
 */
export function quintileShareRatioOfVector(values: number[]): {
  qsr: number;
  k: number;
  bottomMass: number;
  topMass: number;
  topShare: number;
  bottomShare: number;
  palma: number;
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
          `quintileShareRatioOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    const single = n === 1 ? values[0]! : 0;
    return {
      qsr: 0,
      k: n,
      bottomMass: single,
      topMass: single,
      topShare: n === 1 ? 1 : 0,
      bottomShare: n === 1 ? 1 : 0,
      palma: 0,
      mean: single,
      total,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `quintileShareRatioOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.2 * n));
  let bottomMass = 0;
  for (let i = 0; i < k; i += 1) bottomMass += sorted[i]!;
  let topMass = 0;
  for (let i = n - k; i < n; i += 1) topMass += sorted[i]!;
  let qsr: number;
  let degenerate = false;
  if (bottomMass <= 0) {
    qsr = 0;
    degenerate = true;
  } else {
    qsr = topMass / bottomMass;
    if (!(qsr > 1 + 1e-15)) {
      degenerate = true;
    }
  }
  const mean = total / n;
  // Palma: top-10% mass / bottom-40% mass. ceil rules to mirror QSR's k.
  const k10 = Math.max(1, Math.ceil(0.1 * n));
  const k40 = Math.max(1, Math.ceil(0.4 * n));
  let top10 = 0;
  for (let i = n - k10; i < n; i += 1) top10 += sorted[i]!;
  let bot40 = 0;
  for (let i = 0; i < k40; i += 1) bot40 += sorted[i]!;
  const palma = bot40 > 0 ? top10 / bot40 : 0;
  const topShare = total > 0 ? topMass / total : 0;
  const bottomShare = total > 0 ? bottomMass / total : 0;
  return {
    qsr,
    k,
    bottomMass,
    topMass,
    topShare,
    bottomShare,
    palma,
    mean,
    total,
    degenerate,
  };
}

export function buildDailyTokenQuintileShareRatio(
  queue: QueueLine[],
  opts: DailyTokenQuintileShareRatioOptions = {},
): DailyTokenQuintileShareRatioReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (QSR degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minQsr = opts.minQsr ?? null;
  if (minQsr !== null && (!Number.isFinite(minQsr) || minQsr < 1)) {
    throw new Error(
      `minQsr must be a finite number >= 1 or null (got ${opts.minQsr})`,
    );
  }
  const sort: DailyTokenQuintileShareRatioSort = opts.sort ?? 'qsr';
  const validSorts: DailyTokenQuintileShareRatioSort[] = [
    'qsr',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'topMass',
    'bottomMass',
    'k',
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
  const rows: DailyTokenQuintileShareRatioSourceRow[] = [];

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
    const r = quintileShareRatioOfVector(values);
    const row: DailyTokenQuintileShareRatioSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      k: r.k,
      bottomMass: r.bottomMass,
      topMass: r.topMass,
      topShare: r.topShare,
      bottomShare: r.bottomShare,
      qsr: r.qsr,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includePalma) {
      row.palma = r.palma;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinQsr = 0;
  let filtered = rows;
  if (minQsr !== null) {
    const next: DailyTokenQuintileShareRatioSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.qsr >= minQsr) next.push(r);
      else droppedBelowMinQsr += 1;
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
      case 'bottomMass':
        primary = b.bottomMass - a.bottomMass;
        break;
      case 'k':
        primary = b.k - a.k;
        break;
      case 'qsr':
      default:
        primary = b.qsr - a.qsr;
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
    minQsr,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinQsr,
    droppedTopSources,
    sources: kept,
  };
}
