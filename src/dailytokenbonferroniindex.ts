/**
 * daily-token-bonferroni-index: per-source BONFERRONI INDEX of the
 * per-day total_tokens distribution. FORTY-THIRD cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Bonferroni
 * index (Bonferroni 1930):
 *
 *     B = 1 - (1 / ((n - 1) * mu)) * sum_{k=1..n-1} M_k
 *
 *   where the values are sorted ascending x_(1) <= ... <= x_(n),
 *   M_k = (1/k) * sum_{j=1..k} x_(j) is the partial mean of the
 *   k POOREST units, and mu = mean(D). Equivalently:
 *
 *     B = 1 - (1 / ((n - 1) * mu * 1)) * sum_{k=1..n-1} (S_k / k)
 *
 *   with S_k = sum_{j=1..k} x_(j) the cumulative sum of sorted values.
 *
 *   Range `[0, 1)`. B = 0 iff every day carries the same mass
 *   (perfect equality across days). B -> 1 as mass concentrates on
 *   a vanishing fraction of days. The classical reading (income
 *   distribution literature) is that Bonferroni is a BOTTOM-WEIGHTED
 *   rank-weighted Lorenz-area cousin to the Gini: where Gini weights
 *   every Lorenz-curve gap UNIFORMLY, Bonferroni weights gaps in
 *   the BOTTOM ranks much more heavily than gaps near the top.
 *   Specifically, the rank weight on the k-th sorted observation
 *   (1-indexed, ascending) is proportional to sum_{j=k..n-1} (1/j),
 *   which is monotone decreasing in k -- the harmonic-tail weighting
 *   that characterises Bonferroni and gives it its BOTTOM-SENSITIVE
 *   personality.
 *
 *   The textbook identity B >= G holds for any non-negative vector
 *   (Bonferroni 1930; Tarsitano 1990) -- Bonferroni is ALWAYS at
 *   least as large as Gini on the same data, with equality only in
 *   degenerate or two-point cases. The gap `B - G >= 0` is the
 *   BOTTOM-RANK-EXCESS diagnostic exposed by this axis.
 *
 * Why orthogonal to every prior daily-token axis:
 *
 *   axis-32 daily-token-gini-coefficient: Gini is the UNIFORM-rank-
 *     weighted Lorenz-area reading. Bonferroni is the HARMONIC-tail-
 *     weighted Lorenz-area reading -- same Lorenz curve, different
 *     rank-weight kernel. Two distributions with identical Gini can
 *     have different Bonferroni when bulk-mass migration moves
 *     between bottom and middle ranks vs middle and top ranks.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: both are L_infinity Lorenz gaps at a SINGLE rank cut
 *     (equal-mass cut for Pietra; equal-weights cut for Hoover).
 *     Bonferroni integrates over ALL n-1 rank cuts with harmonic
 *     weighting -- a strictly different functional.
 *   axis-36 daily-token-atkinson-index: Atkinson is a CRRA welfare
 *     loss with smooth power-mean penalty. Bonferroni is a
 *     PARAMETER-FREE rank-weighted Lorenz-area integral -- no
 *     curvature parameter, no power-mean form.
 *   axis-37/38/39 daily-token-theil-l/theil-t/ge2: GE(alpha) family
 *     summaries (logarithmic / log-linear / quadratic moments of
 *     the share ratio). All are MOMENT-based on shares; Bonferroni
 *     is RANK-based on cumulative partial means. There is no
 *     monotone bijection between the two families.
 *   axis-40 daily-token-palma-ratio: Palma reads only TWO points on
 *     the Lorenz curve (90/40). Bonferroni reads ALL n-1 partial
 *     means. Palma is unbounded; Bonferroni is in [0, 1).
 *   axis-41 daily-token-fgt-index: FGT is a ONE-SIDED LOWER-TAIL
 *     poverty index threshold-anchored at z = lineFraction * mean.
 *     Bonferroni is two-sided, threshold-FREE, and rank-weighted
 *     across the full distribution.
 *   axis-42 daily-token-hoover-index: Hoover is the L_infinity
 *     Lorenz gap at the EQUAL-WEIGHTS rank cut -- a single point
 *     reading. Bonferroni integrates over all rank cuts with
 *     harmonic weighting. Two sources with identical Hoover can
 *     have very different Bonferroni when the bottom-rank shape
 *     differs.
 *   All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes): Bonferroni
 *     is permutation-invariant, so orthogonal by construction.
 *
 *   ORTHOGONALITY WITNESS / cross-anchor: the literal identity
 *   `bonferroni - gini >= 0` (Bonferroni 1930). The empirical
 *   gap `B - G` is the BOTTOM-RANK-EXCESS shape diagnostic: it
 *   measures how much extra weight Bonferroni assigns to the
 *   bottom-tail Lorenz gaps over the uniform Gini weighting.
 *   The ratio `bonferroniOverGini` sits in [1, n/(n-1)] under
 *   ordinary distributions and is exactly 1 only for two-point
 *   binary distributions or under degenerate concentration on a
 *   single day. Set to NaN when gini = 0 (degenerate; both 0).
 *
 *   Headline question:
 *   **"For each source, what is the BOTTOM-RANK-WEIGHTED inequality
 *     of per-day token mass? And how much extra weight does Bonferroni
 *     give to the bottom of the distribution beyond what Gini sees?"**
 *
 * ZERO DAYS: a zero-mass day enters the sorted vector as x_(1) = 0
 *   and contributes 0 to every partial sum S_k that includes it.
 *   This MAXIMISES the bottom-rank pull of Bonferroni -- a single
 *   zero day inflates B more than G by a relatively larger amount
 *   than a single small-but-positive day would.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): Bonferroni is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'bonferroni'): 'bonferroni' | 'tokens' | 'days'
 *     | 'source' | 'meanDaily' | 'bottomQuintilePartialMean' |
 *     'bonferroniOverGini'.
 *   - `minBonferroni` (default 0): display filter; in [0, 1).
 *   - `includeBottomRankExcess` (refinement): per-row `bonferroni - gini`
 *     gap and the harmonic-tail-weighted Lorenz-area diagnostic.
 *   - `includeDeVergottiniCrossAnchor` (refinement v0.6.285): per-row
 *     De Vergottini index (rank-weighted dual of Bonferroni using
 *     TOP-WEIGHTED harmonic kernel) and the cross-rank-weight gap.
 */
import type { QueueLine } from './types.js';
import { giniOfVector } from './dailytokenginicoefficient.js';

export type DailyTokenBonferroniSort =
  | 'bonferroni'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'bottomQuintilePartialMean'
  | 'bonferroniOverGini'
  | 'bottomRankExcess';

export interface DailyTokenBonferroniOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenBonferroniSort;
  /** Display filter: drop rows whose bonferroni < this. In [0, 1). */
  minBonferroni?: number;
  /**
   * Refinement: when true, every emitted row gains a `bottomRankExcess`
   * field = bonferroni - gini (the textbook B >= G identity gap),
   * and a `bonferroniOverGini` ratio in [1, n/(n-1)].
   */
  includeBottomRankExcess?: boolean;
  /**
   * Refinement (v0.6.285): when true, every emitted row gains a
   * `deVergottini` field and a `bonferroniMinusDeVergottini` field.
   * The De Vergottini index uses the DUAL harmonic kernel (top-rank-
   * weighted instead of bottom-rank-weighted) and is computed as
   *
   *   DV = (sum_{k=1..n} (1/k) * x_((n-k+1)) / mu - H_n) / (n - H_n)
   *
   * where H_n is the n-th harmonic number. The two indices read the
   * SAME Lorenz curve at the SAME n-1 rank cuts but with reversed
   * harmonic weighting; the gap `bonferroni - deVergottini` flips
   * sign depending on whether the bulk of the inequality sits in the
   * bottom or top tail. The cross-rank-weight gap is the diagnostic
   * that no single-kernel inequality index can produce on its own.
   */
  includeDeVergottiniCrossAnchor?: boolean;
  /**
   * Refinement (v0.6.285): when true, every emitted row gains a
   * `harmonicKernelTail` field = sum_{k=1..n-1} (1/k) = H_(n-1)
   * (the (n-1)-th harmonic number). This is the closed-form
   * normalising sum of the rank-weight kernel that drives Bonferroni
   * (each k-th sorted observation gets weight proportional to
   * sum_{j=k..n-1} (1/j) under the Bonferroni functional). Surfacing
   * H_(n-1) makes the rank-weight scale visible per source: it grows
   * logarithmically with n, so two sources with identical Bonferroni
   * values may live on rank-weight scales that differ by orders of
   * magnitude.
   */
  includeHarmonicKernelTail?: boolean;
  generatedAt?: string;
}

export interface DailyTokenBonferroniSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Bonferroni index in [0, 1). */
  bonferroni: number;
  /**
   * Partial mean of the bottom 20% of days (or single bottom day for
   * small n). Surfaced because Bonferroni is bottom-rank-sensitive
   * and this is the most diagnostically interpretable scalar of the
   * underlying partial-mean profile that drives B.
   */
  bottomQuintilePartialMean: number;
  /** Number of days included in the bottom-quintile partial mean. */
  bottomQuintileDays: number;
  /**
   * True iff total = 0 (all-zero per-day vector). bonferroni = 0 in
   * this case but the reading is informationally degenerate.
   */
  degenerate: boolean;
  /**
   * Cross-anchor: Gini on the same vector. The headline RANK-WEIGHT
   * SHAPE indicator of THIS axis is `bonferroniOverGini`, which
   * requires both to compute. Two indices on the SAME Lorenz curve
   * read with different rank-weight kernels.
   */
  gini: number;
  /**
   * Rank-weight ratio bonferroni/gini in [1, n/(n-1)]. Equals 1 iff
   * the distribution is two-point (binary) or degenerate.
   *   = NaN when gini = 0 (degenerate; both should be 0)
   */
  bonferroniOverGini: number;
  meanDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /**
   * Refinement: bonferroni - gini. By the textbook identity
   * Bonferroni 1930, this is >= 0 for any non-negative vector.
   * Present iff caller set `includeBottomRankExcess: true`.
   */
  bottomRankExcess?: number;
  /**
   * Refinement (v0.6.285): De Vergottini index on the same per-day
   * vector (top-rank-weighted harmonic dual of Bonferroni). Present
   * iff caller set `includeDeVergottiniCrossAnchor: true`.
   */
  deVergottini?: number;
  /**
   * Refinement (v0.6.285): bonferroni - deVergottini. Sign flips
   * depending on whether bulk of inequality sits in the bottom tail
   * (positive) or top tail (negative). Present iff caller set
   * `includeDeVergottiniCrossAnchor: true`.
   */
  bonferroniMinusDeVergottini?: number;
  /**
   * Refinement (v0.6.285): the (n-1)-th harmonic number H_(n-1) =
   * sum_{k=1..n-1} (1/k). Closed-form normalising sum of the
   * Bonferroni rank-weight kernel; grows like ln(n) + gamma.
   * Present iff caller set `includeHarmonicKernelTail: true`.
   */
  harmonicKernelTail?: number;
}

export interface DailyTokenBonferroniReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenBonferroniSort;
  minBonferroni: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinBonferroni: number;
  droppedTopSources: number;
  sources: DailyTokenBonferroniSourceRow[];
}

/**
 * Bonferroni index of a non-negative vector.
 *
 * Returns:
 *   - All zeros + degenerate=true for n < 2 or empty / all-zero.
 *   - bonferroni in [0, 1) otherwise.
 *
 * Throws on negative or non-finite input.
 */
export function bonferroniOfVector(values: number[]): {
  bonferroni: number;
  bottomQuintilePartialMean: number;
  bottomQuintileDays: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      bonferroni: 0,
      bottomQuintilePartialMean: v0,
      bottomQuintileDays: n,
      mean: v0,
      total: v0,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `bonferroniOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      bonferroni: 0,
      bottomQuintilePartialMean: 0,
      bottomQuintileDays: Math.max(1, Math.floor(n / 5)),
      mean: 0,
      total: 0,
      degenerate: true,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  // B = 1 - (1 / ((n - 1) * mu)) * sum_{k=1..n-1} (S_k / k)
  let cumSum = 0;
  let acc = 0;
  for (let k = 1; k <= n - 1; k += 1) {
    cumSum += sorted[k - 1] as number;
    acc += cumSum / k;
  }
  const bonferroni = 1 - acc / ((n - 1) * mu);
  // Bottom-quintile partial mean (at least 1 day).
  const bqDays = Math.max(1, Math.floor(n / 5));
  let bqSum = 0;
  for (let i = 0; i < bqDays; i += 1) {
    bqSum += sorted[i] as number;
  }
  const bottomQuintilePartialMean = bqSum / bqDays;
  return {
    bonferroni,
    bottomQuintilePartialMean,
    bottomQuintileDays: bqDays,
    mean: mu,
    total,
    degenerate: false,
  };
}

/**
 * De Vergottini index of a non-negative vector. Top-rank-weighted
 * harmonic dual of Bonferroni; reads the SAME Lorenz curve at the
 * SAME n-1 rank cuts but with REVERSED harmonic weighting.
 *
 *   DV = (sum_{k=1..n} (1/k) * x_((n-k+1)) / mu - H_n) / (n - H_n)
 *
 * where x_((j)) is the j-th order statistic ascending and H_n is the
 * n-th harmonic number. Range [0, 1) for non-negative inputs.
 *
 * Returns 0 + degenerate=true for n < 2 or all-zero. Throws on
 * negative or non-finite input.
 */
export function deVergottiniOfVector(values: number[]): {
  deVergottini: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) return { deVergottini: 0, degenerate: true };
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `deVergottiniOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) return { deVergottini: 0, degenerate: true };
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  let Hn = 0;
  for (let k = 1; k <= n; k += 1) Hn += 1 / k;
  // Top-weighted harmonic kernel: weight 1/k attaches to the k-th
  // LARGEST (descending) value, i.e. sorted[n - k].
  let weighted = 0;
  for (let k = 1; k <= n; k += 1) {
    weighted += (1 / k) * ((sorted[n - k] as number) / mu);
  }
  const dv = (weighted - Hn) / (n - Hn);
  return { deVergottini: dv, degenerate: false };
}

export function buildDailyTokenBonferroniIndex(
  queue: QueueLine[],
  opts: DailyTokenBonferroniOptions = {},
): DailyTokenBonferroniReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Bonferroni is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minBonferroni = opts.minBonferroni ?? 0;
  if (
    !Number.isFinite(minBonferroni) ||
    minBonferroni < 0 ||
    minBonferroni >= 1
  ) {
    throw new Error(
      `minBonferroni must be a finite number in [0, 1) (got ${opts.minBonferroni})`,
    );
  }
  const sort: DailyTokenBonferroniSort = opts.sort ?? 'bonferroni';
  const validSorts: DailyTokenBonferroniSort[] = [
    'bonferroni',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'bottomQuintilePartialMean',
    'bonferroniOverGini',
    'bottomRankExcess',
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
  const rows: DailyTokenBonferroniSourceRow[] = [];

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
    const b = bonferroniOfVector(values);
    const gini = giniOfVector(values);
    const bonferroniOverGini = gini === 0 ? Number.NaN : b.bonferroni / gini;
    const row: DailyTokenBonferroniSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      bonferroni: b.bonferroni,
      bottomQuintilePartialMean: b.bottomQuintilePartialMean,
      bottomQuintileDays: b.bottomQuintileDays,
      degenerate: b.degenerate,
      gini,
      bonferroniOverGini,
      meanDailyTokens: b.mean,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeBottomRankExcess) {
      row.bottomRankExcess = b.bonferroni - gini;
    }
    if (opts.includeDeVergottiniCrossAnchor) {
      const dv = deVergottiniOfVector(values);
      row.deVergottini = dv.deVergottini;
      row.bonferroniMinusDeVergottini = b.bonferroni - dv.deVergottini;
    }
    if (opts.includeHarmonicKernelTail) {
      let hn1 = 0;
      for (let k = 1; k <= nDays - 1; k += 1) hn1 += 1 / k;
      row.harmonicKernelTail = hn1;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinBonferroni = 0;
  let filtered = rows;
  if (minBonferroni > 0) {
    const next: DailyTokenBonferroniSourceRow[] = [];
    for (const r of rows) {
      if (r.bonferroni >= minBonferroni) next.push(r);
      else droppedBelowMinBonferroni += 1;
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
      case 'bottomQuintilePartialMean':
        primary = b.bottomQuintilePartialMean - a.bottomQuintilePartialMean;
        break;
      case 'bonferroniOverGini':
        primary = cmpNum(a.bonferroniOverGini, b.bonferroniOverGini);
        break;
      case 'bottomRankExcess':
        primary =
          (b.bottomRankExcess ?? b.bonferroni - b.gini) -
          (a.bottomRankExcess ?? a.bonferroni - a.gini);
        break;
      case 'bonferroni':
      default:
        primary = b.bonferroni - a.bonferroni;
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
    minBonferroni,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinBonferroni,
    droppedTopSources,
    sources: kept,
  };
}
