/**
 * daily-token-medcouple-skewness: per-source MEDCOUPLE (Brys,
 * Hubert, Struyf 2004) of the per-day total_tokens vector.
 *
 * SIXTY-SIXTH cross-source axis.
 *
 * The medcouple MC is a robust, scale-free measure of skewness
 * defined on a univariate sample as:
 *
 *     MC(X) = median over (x_i, x_j) with x_i <= m <= x_j and
 *             not both equal to m, of the kernel
 *
 *                       (x_j - m) - (m - x_i)
 *             h(x_i, x_j) = -----------------------
 *                                x_j - x_i
 *
 *     where m = median(X).
 *
 * MC is bounded in [-1, +1]:
 *
 *   - MC > 0 : right-skewed (the upper half is more spread out
 *              from the median than the lower half)
 *   - MC < 0 : left-skewed
 *   - MC = 0 : symmetric around the median
 *
 * SIGN CONVENTION (here): positive = heavy days are FAR ABOVE the
 * median while light days cluster JUST BELOW the median
 * (right-skew of the daily-token distribution).
 *
 * Headline question:
 * **"For each source, is the per-day total_tokens distribution
 *   asymmetric around its MEDIAN -- and in which direction --
 *   measured ROBUSTLY (insensitive to outliers, no moments
 *   required, scale-free, bounded)?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..65):
 *
 *   - All shipped axes 32..63 are NON-NEGATIVE dispersion /
 *     inequality functionals (Gini, Atkinson, Theil-L/T,
 *     GE family, Hoover, Pietra, Bonferroni, Mehran, Wolfson,
 *     Foster-Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray, Var-of-Logs, Log-MAD, FGT, PGR, IOM, MSR, DSG,
 *     QSR, MADM): they cannot distinguish a left-skewed from a
 *     right-skewed distribution at all (mirroring X around its
 *     mean leaves them invariant). MC is SIGNED and changes sign
 *     under reflection.
 *
 *   - vs axis 64 RTZ (runs-test-z) and axis 60 MSR (monotone-run):
 *     those are calendar-ORDER statistics on the median sign trace
 *     and ignore magnitude. MC is permutation-INVARIANT (sort the
 *     days and MC is unchanged) and depends only on magnitudes.
 *
 *   - vs axis 65 Hill (tail-index): Hill is TAIL-ONLY (top-k
 *     order statistics) and unbounded in (0, +inf); MC is a
 *     three-region functional (lower half / median / upper half)
 *     bounded in [-1, 1]. A perfectly symmetric heavy-tail
 *     distribution (e.g. symmetric Pareto) has Hill alpha low
 *     while MC = 0; a strongly right-skewed light-tail (most
 *     days near min, few near max) has MC > 0 while Hill alpha
 *     is large.
 *
 *   - vs `daily-token-foster-wolfson-index` (signed polarisation,
 *     axis 51-ish, axis 56): Foster-Wolfson is signed but is a
 *     BIPOLARISATION measure between two halves around the
 *     median; it grows with the distance of each half from m.
 *     MC is a normalised RATIO (upper-half spread minus
 *     lower-half spread, divided by total range of each pair),
 *     NOT a signed gap. A symmetric bipolar distribution has
 *     Foster-Wolfson != 0 (positive) but MC = 0.
 *
 *   - vs Bowley skewness (already shipped at the row-level as
 *     `source-row-token-bowley-skewness`): Bowley uses only
 *     three quantiles (Q1, Q2, Q3), giving a single number per
 *     vector. MC takes a MEDIAN over an O(n^2) family of
 *     pairwise asymmetries, breakdown point ~25%, well-defined
 *     under repeated values via the Brys-Hubert-Struyf "ties at
 *     the median" extension implemented here. Bowley uses
 *     exactly two pairs; MC uses up to (n/2)^2.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass
 *     is below this floor.
 *   - `minDays` (default 5): MC needs at least one element on
 *     each side of the median; default 5 is conservative.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'absMc'): 'absMc' (most-asymmetric first;
 *     |MC| descending) | 'mc' (most right-skewed first) |
 *     'mcAsc' (most left-skewed first) | 'tokens' | 'days' |
 *     'source'.
 *   - `minAbsMc`: display filter; hide rows with |MC| < this.
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';

export type DailyTokenMedcoupleSkewnessSort =
  | 'absMc'
  | 'mc'
  | 'mcAsc'
  | 'tokens'
  | 'days'
  | 'source';

export interface DailyTokenMedcoupleSkewnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMedcoupleSkewnessSort;
  /** Display filter: drop rows whose |MC| is strictly below this value. null = no filter. */
  minAbsMc?: number | null;
  generatedAt?: string;
}

export interface DailyTokenMedcoupleSkewnessSourceRow {
  source: string;
  totalTokens: number;
  /** Days observed (all days with strictly positive total_tokens). */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Sample median of the per-day vector. */
  median: number;
  /** Number of days strictly less than median. */
  nLower: number;
  /** Number of days strictly greater than median. */
  nUpper: number;
  /** Number of days equal to median. */
  nTies: number;
  /** Medcouple in [-1, +1]. */
  mc: number;
  meanDailyTokens: number;
  /** True when MC is undefined (e.g. all values equal -> nLower==nUpper==0). */
  degenerate: boolean;
}

export interface DailyTokenMedcoupleSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMedcoupleSkewnessSort;
  minAbsMc: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinAbsMc: number;
  droppedTopSources: number;
  sources: DailyTokenMedcoupleSkewnessSourceRow[];
}

/**
 * Sample median of a NON-EMPTY numeric vector. Uses the standard
 * order-statistic average for even n.
 */
function sampleMedian(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  const n = s.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Medcouple primitive (Brys, Hubert, Struyf 2004).
 *
 * Naive O(n^2) implementation -- adequate for daily-token vectors
 * where n is at most a few thousand.
 *
 * Handles ties at the median via the standard kernel extension:
 *
 *   For (x_i, x_j) BOTH equal to m, the kernel takes values
 *   {-1, 0, +1} according to the rank pattern:
 *
 *       h(m_p, m_q) = -1 if p+q < k-1
 *                   =  0 if p+q == k-1
 *                   = +1 if p+q > k-1
 *
 *   where p, q are the indices among the k tied elements.
 *
 * Returns:
 *   - mc:         medcouple in [-1, +1].
 *   - degenerate: true when nLower + nUpper + nTies < 2 or when
 *                 there is no comparable pair (e.g. all values
 *                 equal -- only ties).
 *
 * Throws on non-finite input. Accepts duplicates.
 */
export function medcoupleOfVector(values: number[]): {
  median: number;
  nLower: number;
  nUpper: number;
  nTies: number;
  mc: number;
  degenerate: boolean;
} {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `medcoupleOfVector requires finite values (got ${v})`,
      );
    }
  }
  const n = values.length;
  if (n < 2) {
    return {
      median: n === 1 ? values[0]! : 0,
      nLower: 0,
      nUpper: 0,
      nTies: n,
      mc: 0,
      degenerate: true,
    };
  }
  const m = sampleMedian(values);
  const lower: number[] = [];
  const upper: number[] = [];
  const ties: number[] = [];
  for (const v of values) {
    if (v < m) lower.push(v);
    else if (v > m) upper.push(v);
    else ties.push(v);
  }
  // Special case: ALL values equal -> no asymmetry defined.
  if (lower.length === 0 && upper.length === 0) {
    return {
      median: m,
      nLower: 0,
      nUpper: 0,
      nTies: ties.length,
      mc: 0,
      degenerate: true,
    };
  }
  // We accumulate kernel values across all (i, j) with x_i <= m <= x_j,
  // not both equal to m. The set of x_i is lower ∪ ties; the set of
  // x_j is ties ∪ upper. We exclude the (tie, tie) pairs from the
  // standard kernel and replace them with the discrete tie-rule below.
  const left: number[] = [...lower, ...ties];
  const right: number[] = [...ties, ...upper];
  const kernels: number[] = [];
  for (let i = 0; i < left.length; i += 1) {
    const xi = left[i]!;
    for (let j = 0; j < right.length; j += 1) {
      const xj = right[j]!;
      // (tie, tie) handled separately.
      if (xi === m && xj === m) continue;
      // Standard kernel.
      const denom = xj - xi;
      // denom > 0 always here because xi <= m <= xj and not both equal.
      kernels.push(((xj - m) - (m - xi)) / denom);
    }
  }
  // Discrete tie kernel for (m, m) pairs. The Brys-Hubert-Struyf
  // formulation indexes the k tied elements 0..k-1 and uses
  //   h(p, q) = sign(p + q - (k - 1))
  // We push exactly one kernel value per ordered pair (p, q) with
  // p, q in 0..k-1 -- including p == q (the diagonal contributes 0).
  const k = ties.length;
  if (k >= 2) {
    for (let p = 0; p < k; p += 1) {
      for (let q = 0; q < k; q += 1) {
        const s = p + q - (k - 1);
        kernels.push(s > 0 ? 1 : s < 0 ? -1 : 0);
      }
    }
  }
  if (kernels.length === 0) {
    return {
      median: m,
      nLower: lower.length,
      nUpper: upper.length,
      nTies: ties.length,
      mc: 0,
      degenerate: true,
    };
  }
  const mc = sampleMedian(kernels);
  return {
    median: m,
    nLower: lower.length,
    nUpper: upper.length,
    nTies: ties.length,
    mc,
    degenerate: false,
  };
}

export function buildDailyTokenMedcoupleSkewness(
  queue: QueueLine[],
  opts: DailyTokenMedcoupleSkewnessOptions = {},
): DailyTokenMedcoupleSkewnessReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(
      `minDays must be an integer >= 3 (the medcouple needs at least one element on each side of the median plus the median itself) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAbsMc = opts.minAbsMc ?? null;
  if (minAbsMc !== null && (!Number.isFinite(minAbsMc) || minAbsMc < 0 || minAbsMc > 1)) {
    throw new Error(
      `minAbsMc must be a finite number in [0, 1] when set (got ${opts.minAbsMc})`,
    );
  }
  const sort: DailyTokenMedcoupleSkewnessSort = opts.sort ?? 'absMc';
  const validSorts: DailyTokenMedcoupleSkewnessSort[] = [
    'absMc',
    'mc',
    'mcAsc',
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
  const rows: DailyTokenMedcoupleSkewnessSourceRow[] = [];

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
    const values = Array.from(acc.perDay.values());
    const r = medcoupleOfVector(values);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      median: r.median,
      nLower: r.nLower,
      nUpper: r.nUpper,
      nTies: r.nTies,
      mc: r.mc,
      meanDailyTokens: acc.totalTokens / nDays,
      degenerate: r.degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAbsMc = 0;
  let filtered = rows;
  if (minAbsMc !== null) {
    const next: DailyTokenMedcoupleSkewnessSourceRow[] = [];
    for (const r of rows) {
      if (!r.degenerate && Math.abs(r.mc) >= minAbsMc) next.push(r);
      else if (r.degenerate) next.push(r); // surface degenerate rows regardless
      else droppedBelowMinAbsMc += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mc':
        // Most right-skewed first (largest MC).
        primary = b.mc - a.mc;
        break;
      case 'mcAsc':
        // Most left-skewed first (smallest MC).
        primary = a.mc - b.mc;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absMc':
      default:
        // Most asymmetric first (|MC| descending).
        primary = Math.abs(b.mc) - Math.abs(a.mc);
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minAbsMc,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinAbsMc,
    droppedTopSources,
    sources: kept,
  };
}
