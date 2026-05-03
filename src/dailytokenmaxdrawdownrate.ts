/**
 * daily-token-max-drawdown-rate: per-source MAXIMUM PROPORTIONAL
 * DRAWDOWN of the per-day total_tokens series.
 *
 * ONE-HUNDRED-AND-FORTY-FIFTH cross-source axis.
 *
 *     MDD = max over (i < j) of (D_i - D_j) / D_i
 *
 * with D = (D_1, ..., D_n) the per-source per-day total_tokens
 * vector ordered by ascending UTC day. D_i is the running peak,
 * D_j is the post-peak trough. MDD answers: **"what is the worst
 * proportional drop a source has ever taken from a prior daily
 * peak to a subsequent daily trough?"**
 *
 * Drawdown analysis originates with finance (Magdon-Ismail &
 * Atiya 2004, "Maximum drawdown", Risk Magazine 17(10): 99-102;
 * Chekhlov, Uryasev & Zabarankin 2005, "Drawdown measure in
 * portfolio optimization", IJTAF 8(1): 13-58). It is the
 * canonical PATH-DEPENDENT risk functional: unlike the
 * dispersion / inequality / diversity functionals already
 * surfaced (Gini, HHI, Pielou, CR4, Theil, Atkinson, Hoover,
 * Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson, Palma,
 * Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, FGT, GE family,
 * Var-of-Logs, Log-MAD, Zenga, S-Gini, Hill-tail, decile-share-
 * gap, quintile-share-ratio, percentile-gap-ratio, top-4-CR,
 * Pielou, Renyi spectral, Shannon spectral, ...), MDD depends on
 * the ORDER of D. Reversing D in time generally changes MDD;
 * permuting D arbitrarily generally changes MDD. None of the
 * permutation-invariant axes can detect a "smooth ramp followed
 * by a 90% crash" vs the same multiset reshuffled into "crash
 * first, ramp later" -- the inequality functionals see identical
 * Lorenz curves, identical entropies, identical concentration
 * ratios. MDD separates them.
 *
 * RANGE AND BOUNDS:
 *   - MDD in [0, 1).
 *   - MDD = 0 iff D is monotone non-decreasing (the running
 *     peak is also the running max, so trough = peak).
 *   - MDD -> 1 iff some post-peak day approaches zero relative
 *     to its prior peak (D_j / D_i -> 0).
 *   - MDD is SCALE-INVARIANT: MDD(c * D) = MDD(D) for any
 *     c > 0 (numerator and denominator both scale by c).
 *   - MDD is NOT permutation-invariant.
 *   - MDD is NOT translation-invariant: D + c shifts the ratio
 *     non-trivially; we only consider strictly-positive D so
 *     translation is irrelevant for our use.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW AXIS:
 *
 * Witness: take two day vectors with the same multiset, hence
 * identical Gini, identical HHI, identical Pielou J, identical
 * CR4, identical Atkinson, identical Theil, identical every
 * inequality / diversity / spectral-on-shares index:
 *
 *   A = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
 *     monotone DECAY. Running peak is always D_1 = 100.
 *     Worst drawdown is from D_1 = 100 down to D_10 = 10:
 *     MDD(A) = (100 - 10) / 100 = 0.9
 *
 *   B = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
 *     monotone GROWTH. Running peak equals running max.
 *     There is no post-peak trough below the peak.
 *     MDD(B) = 0
 *
 *   C = [10, 100, 20, 30, 40, 50, 60, 70, 80, 90]
 *     same multiset, peak on day 2.
 *     Worst drawdown is from D_2 = 100 down to D_3 = 20:
 *     MDD(C) = (100 - 20) / 100 = 0.8
 *
 * A, B, C all have IDENTICAL Gini ~ 0.300, IDENTICAL HHI
 * ~ 0.155 (sum_k (k/55)^2 over k=1..10), IDENTICAL Pielou
 * J ~ 0.934, IDENTICAL CR4 = 340/550 ~ 0.618. Yet their MDDs
 * are 0.9, 0.0, 0.8 -- a 90-percentage-point spread that
 * NO permutation-invariant functional can express. This is
 * proof of structural orthogonality, not just empirical
 * decorrelation.
 *
 * vs the temporal axes (autocorrelation lag-1/lag-7, Mann-
 * Kendall tau, Cox-Stuart, Bartels rank, runs test, turning-
 * point rate, Hurst R/S, DFA alpha, sample entropy, permutation
 * entropy, Lempel-Ziv, Hjorth complexity / mobility, Higuchi
 * FD, Katz FD, Petrosian FD, Sevcik FD, box-count FD, Teager-
 * Kaiser energy, Ljung-Box Q): those measure GLOBAL ORDER
 * STRUCTURE -- whether the series is monotone, anti-correlated,
 * trending, fractal, predictable, etc. MDD is a LOCAL EXTREMAL
 * functional: it asks for the SINGLE WORST peak-to-trough pair,
 * regardless of what happens elsewhere. A series can be Hurst
 * H ~ 0.5 (random-walk-like, no long memory) and still have
 * MDD = 0.99 if one bad day follows one peak day. Conversely
 * a strongly trending series (Mann-Kendall tau near +1) can
 * have MDD = 0 (pure monotone growth). Different signal.
 *
 * vs the halves-divergence family (KS, Cramer-von-Mises,
 * Anderson-Darling, Mann-Whitney, Brown-Forsythe, Siegel-
 * Tukey, Mahalanobis, energy-distance, MMD, Hellinger, Total-
 * Variation, Kullback-Liebler, Jensen-Shannon, Bhattacharyya,
 * Triangular, Topsoe, Kumar-Johnson, Renyi-2, Taneja, Neyman
 * chi-squared, symmetric chi-squared, Jeffreys, K-divergence,
 * Wasserstein-1, max-divergence, Clark, PCA-projection-
 * distance, quantile-vector-Mahalanobis): those compare the
 * FIRST half against the SECOND half as DISTRIBUTIONS. MDD
 * does not partition; it is a single extremal pair selected
 * across the WHOLE ordered series. A source with identically-
 * distributed halves (zero halves-divergence on every metric)
 * can still have arbitrarily large MDD if a peak is adjacent
 * to a trough within EITHER half. Different signal.
 *
 * CLOSED-FORM ANCHOR. For D = [4, 3, 2, 1, 5]:
 *   running peak at each j > 1:
 *     j=2 (val 3, peak so far D_1=4)  drop = (4-3)/4 = 0.25
 *     j=3 (val 2, peak so far 4)      drop = (4-2)/4 = 0.50
 *     j=4 (val 1, peak so far 4)      drop = (4-1)/4 = 0.75
 *     j=5 (val 5, peak so far 4)      drop = (4-5)/4 = -0.25 (no drop)
 *   MDD = 0.75. Worst pair: peak day 1, trough day 4.
 *
 * Headline question:
 * **"What is the worst proportional drop in daily token
 *   throughput a source has experienced from a prior peak day
 *   to a subsequent trough day, on a scale of 0 (monotone
 *   growth) to 1 (post-peak collapse to zero)?"**
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export type DailyTokenMaxDrawdownRateSort =
  | 'maxDrawdownRate'
  | 'maxDrawdownDurationDays'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'peakDailyTokens';

export interface DailyTokenMaxDrawdownRateOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenMaxDrawdownRateSort;
  minDrawdown?: number | null;
  generatedAt?: string;
}

export interface DailyTokenMaxDrawdownRateSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Worst proportional drop (D_peak - D_trough) / D_peak over all
   * (peak day, trough day) pairs with peak day strictly before
   * trough day. In [0, 1) for strictly-positive D. NaN-safe: 0
   * if n < 2 (no pair exists).
   */
  maxDrawdownRate: number;
  /** UTC day on which the peak of the worst drawdown sits. */
  peakDay: string;
  /** Daily total_tokens on `peakDay`. */
  peakDailyTokens: number;
  /** UTC day of the post-peak trough of the worst drawdown. */
  troughDay: string;
  /** Daily total_tokens on `troughDay`. */
  troughDailyTokens: number;
  /**
   * Refinement: distance in days between `peakDay` and
   * `troughDay`, inclusive of both endpoints (so peak->next-day
   * trough = 1 day gap). 0 when n < 2 / no drawdown.
   */
  maxDrawdownDurationDays: number;
  /**
   * Refinement: did any post-trough day reach or exceed the
   * peak-of-worst-drawdown's level? `true` indicates the
   * source recovered from its worst drawdown; `false` means it
   * is still below its worst-drawdown peak as of `lastDay`.
   * `false` for degenerate / no-drawdown rows.
   */
  recovered: boolean;
  /**
   * Refinement: structural label binning maxDrawdownRate into
   * five bands. Cutoffs chosen to match financial-risk
   * convention (50% drawdown = "severe", 90% = "catastrophic")
   * applied to a daily-token signal:
   *   - 'flat'         : MDD == 0 -- monotone non-decreasing.
   *   - 'shallow'      : MDD in (0, 0.25)  -- routine variation.
   *   - 'moderate'     : MDD in [0.25, 0.50) -- noticeable dip.
   *   - 'severe'       : MDD in [0.50, 0.90) -- a clear collapse.
   *   - 'catastrophic' : MDD >= 0.90 -- post-peak day approaches
   *                       zero relative to peak.
   *   - 'degenerate'   : n < 2 (no drawdown definable).
   */
  drawdownRegime:
    | 'flat'
    | 'shallow'
    | 'moderate'
    | 'severe'
    | 'catastrophic'
    | 'degenerate';
  meanDailyTokens: number;
  degenerate: boolean;
}

export interface DailyTokenMaxDrawdownRateReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenMaxDrawdownRateSort;
  minDrawdown: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinDrawdown: number;
  droppedTopSources: number;
  sources: DailyTokenMaxDrawdownRateSourceRow[];
}

/**
 * Compute the maximum proportional drawdown of a strictly-
 * positive vector treated as an ordered time series.
 *
 * Returns the indices of the peak and trough of the worst
 * drawdown along with the recovery flag (whether any
 * subsequent value reached or exceeded the peak).
 *
 * O(n) single pass: maintain running max value + index, at
 * each j > 0 compute (peak - v[j]) / peak and track the
 * argmax. Tie-break on first occurrence (smallest j, then
 * smallest peak index) to keep output deterministic.
 */
export function maxDrawdownRateOfVector(values: number[]): {
  maxDrawdownRate: number;
  peakIndex: number;
  troughIndex: number;
  peakValue: number;
  troughValue: number;
  recovered: boolean;
  degenerate: boolean;
} {
  const n = values.length;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `maxDrawdownRateOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
  }
  if (n < 2) {
    const only = n === 1 ? (values[0] as number) : 0;
    return {
      maxDrawdownRate: 0,
      peakIndex: 0,
      troughIndex: 0,
      peakValue: only,
      troughValue: only,
      recovered: false,
      degenerate: true,
    };
  }
  let runningPeak = values[0] as number;
  let runningPeakIndex = 0;
  let bestDrop = 0;
  let bestPeakIndex = 0;
  let bestPeakValue = values[0] as number;
  let bestTroughIndex = 0;
  let bestTroughValue = values[0] as number;
  for (let j = 1; j < n; j += 1) {
    const v = values[j] as number;
    if (v > runningPeak) {
      runningPeak = v;
      runningPeakIndex = j;
      continue;
    }
    // v <= runningPeak; consider as a candidate trough.
    const drop = (runningPeak - v) / runningPeak;
    if (drop > bestDrop) {
      bestDrop = drop;
      bestPeakIndex = runningPeakIndex;
      bestPeakValue = runningPeak;
      bestTroughIndex = j;
      bestTroughValue = v;
    }
  }
  // Recovered iff any index strictly after bestTroughIndex has
  // value >= bestPeakValue. If MDD == 0 we report recovered =
  // false (no drawdown to recover from; flat-line by definition).
  let recovered = false;
  if (bestDrop > 0) {
    for (let k = bestTroughIndex + 1; k < n; k += 1) {
      if ((values[k] as number) >= bestPeakValue) {
        recovered = true;
        break;
      }
    }
  }
  return {
    maxDrawdownRate: bestDrop,
    peakIndex: bestPeakIndex,
    troughIndex: bestTroughIndex,
    peakValue: bestPeakValue,
    troughValue: bestTroughValue,
    recovered,
    degenerate: false,
  };
}

export function buildDailyTokenMaxDrawdownRate(
  queue: QueueLine[],
  opts: DailyTokenMaxDrawdownRateOptions = {},
): DailyTokenMaxDrawdownRateReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (drawdown undefined for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minDrawdown = opts.minDrawdown ?? null;
  if (
    minDrawdown !== null &&
    (!Number.isFinite(minDrawdown) || minDrawdown < 0 || minDrawdown >= 1)
  ) {
    throw new Error(
      `minDrawdown must be a finite number in [0, 1) or null (got ${opts.minDrawdown})`,
    );
  }
  const sort: DailyTokenMaxDrawdownRateSort = opts.sort ?? 'maxDrawdownRate';
  const validSorts: DailyTokenMaxDrawdownRateSort[] = [
    'maxDrawdownRate',
    'maxDrawdownDurationDays',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'peakDailyTokens',
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
  const rows: DailyTokenMaxDrawdownRateSourceRow[] = [];

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
    // Sort days ascending and produce parallel arrays of
    // (day, value) for deterministic peak/trough labels.
    const days = Array.from(acc.perDay.keys()).sort();
    const values = days.map((d) => acc.perDay.get(d) as number);
    const r = maxDrawdownRateOfVector(values);
    let regime:
      | 'flat'
      | 'shallow'
      | 'moderate'
      | 'severe'
      | 'catastrophic'
      | 'degenerate';
    if (r.degenerate) {
      regime = 'degenerate';
    } else if (r.maxDrawdownRate === 0) {
      regime = 'flat';
    } else if (r.maxDrawdownRate < 0.25) {
      regime = 'shallow';
    } else if (r.maxDrawdownRate < 0.5) {
      regime = 'moderate';
    } else if (r.maxDrawdownRate < 0.9) {
      regime = 'severe';
    } else {
      regime = 'catastrophic';
    }
    const peakDay = r.degenerate ? acc.firstDay : (days[r.peakIndex] as string);
    const troughDay = r.degenerate
      ? acc.firstDay
      : (days[r.troughIndex] as string);
    const durationDays =
      r.degenerate || r.maxDrawdownRate === 0
        ? 0
        : r.troughIndex - r.peakIndex;
    let mean = 0;
    for (const v of values) mean += v;
    mean = mean / values.length;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      maxDrawdownRate: r.maxDrawdownRate,
      peakDay,
      peakDailyTokens: r.degenerate ? 0 : r.peakValue,
      troughDay,
      troughDailyTokens: r.degenerate ? 0 : r.troughValue,
      maxDrawdownDurationDays: durationDays,
      recovered: r.recovered,
      drawdownRegime: regime,
      meanDailyTokens: mean,
      degenerate: r.degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinDrawdown = 0;
  let filtered = rows;
  if (minDrawdown !== null) {
    const next: DailyTokenMaxDrawdownRateSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.maxDrawdownRate >= minDrawdown) next.push(r);
      else droppedBelowMinDrawdown += 1;
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
      case 'maxDrawdownDurationDays':
        primary = b.maxDrawdownDurationDays - a.maxDrawdownDurationDays;
        break;
      case 'peakDailyTokens':
        primary = b.peakDailyTokens - a.peakDailyTokens;
        break;
      case 'maxDrawdownRate':
      default:
        primary = b.maxDrawdownRate - a.maxDrawdownRate;
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
    minDrawdown,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinDrawdown,
    droppedTopSources,
    sources: kept,
  };
}
