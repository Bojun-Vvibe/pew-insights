/**
 * daily-token-pearson-second-skewness: per-source PEARSON'S SECOND
 * SKEWNESS COEFFICIENT (PSS) of the per-day total_tokens distribution.
 *
 *     PSS = 3 * (mean - median) / stddev      (Pearson 1895)
 *
 * ONE-HUNDRED-AND-FORTY-FIRST cross-source axis.
 *
 * For each source we collapse all hourly buckets into one scalar per
 * UTC day (D_d = sum of total_tokens on day d) and report PSS, a
 * dimensionless centre-vs-tail asymmetry diagnostic that combines
 * the SECOND CENTRAL MOMENT (stddev) with the gap between the FIRST
 * MOMENT (mean) and the FIFTIETH PERCENTILE (median).
 *
 * Range / sign convention:
 *
 *   - PSS > 0 iff mean > median (right-skewed tail; a few large days
 *     pull the mean above the typical day).
 *   - PSS < 0 iff mean < median (left-skewed tail; a few small days
 *     pull the mean below the typical day).
 *   - PSS = 0 iff mean === median (symmetric in the Pearson sense
 *     -- the median is the centre of mass).
 *   - Theoretical bound: |PSS| <= 3 for any unimodal distribution
 *     (Pearson; the constant 3 is what makes the coefficient
 *     dimensionless AND comparable to the third standardised moment
 *     in the unimodal regime). PSS is NOT bounded for arbitrary
 *     distributions but the |PSS| > 3 regime is itself a witness
 *     of multi-modality / heavy clumping.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN SKEWNESS / SHAPE AXIS:
 *
 *   - axis L-skewness (`daily-token-l-skewness`) is built from the
 *     L-moments (linear combinations of expected order statistics);
 *     it is ROBUST and bounded by [-1, 1]. PSS is built from the
 *     classical CENTRAL MOMENTS combined with a percentile -- a
 *     HYBRID functional that is moment-sensitive in the denominator
 *     and percentile-sensitive in the numerator. The two disagree
 *     on heavy-tailed days because L-skew downweights extremes
 *     while PSS lets stddev blow up.
 *
 *   - axis MEDCOUPLE skewness (`daily-token-medcouple-skewness`,
 *     Brys 2004) is a rank-based bivariate kernel summary, bounded
 *     by [-1, 1] and with breakdown 0.25. Medcouple is INSENSITIVE
 *     to scale; PSS is INSENSITIVE to scale by construction (the
 *     `1/stddev` denominator) but its scale-invariance route is
 *     completely different (moment ratio, not rank ratio), so the
 *     two carry independent shape information for non-symmetric
 *     non-Gaussian day vectors.
 *
 *   - PEARSON SECOND vs the unrelated PEARSON FIRST skewness
 *     (`3 * (mean - mode) / stddev`): Pearson SECOND uses the
 *     median, which is uniquely defined and trivially estimable
 *     from a sample; the FIRST uses the mode, which is degenerate
 *     for continuous samples without binning. We deliberately ship
 *     the SECOND form -- the FIRST has no canonical empirical
 *     plug-in.
 *
 *   - PSS is COMPLEMENTARY to the inequality axes (Gini family,
 *     Atkinson, Theil, Hoover, GE, FGT, Bonferroni, Mehran, Wolfson,
 *     Foster-Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray) which all measure SPREAD around the MEAN and
 *     are SIGN-AGNOSTIC by construction (they cannot tell a
 *     right-skewed from a left-skewed day vector with the same
 *     Lorenz curve shape -- the Gini coefficient of `[1,1,1,5]`
 *     equals the Gini of `[1,5,5,5]` after re-centring tricks).
 *     PSS surfaces the SIGN of the asymmetry; the inequality
 *     axes never can.
 *
 *   - PSS is COMPLEMENTARY to the divergence-of-halves axes
 *     (axes 118-140: KS, MWU, AD, CvM, Bhatt, Hellinger, JS, K,
 *     KJ, Topsoe, Taneja, Wasserstein, MMD, Energy, Mahalanobis,
 *     ...) which all compare the FIRST half of the day vector
 *     against the SECOND half. PSS is computed on the WHOLE day
 *     vector at once; it is a SHAPE statistic, not a TEMPORAL DRIFT
 *     statistic. A perfectly stationary heavy-right-tail source
 *     would show |PSS| > 0 on the whole vector and divergence ~ 0
 *     between halves; a non-stationary perfectly-symmetric source
 *     would show |PSS| ~ 0 and divergence > 0. The two regimes
 *     are NOT DETECTABLE by either axis alone.
 *
 *   - PSS is COMPLEMENTARY to the autocorrelation / runs / sign
 *     tests (axes lag-1, lag-7, runs, Mann-Kendall, Cox-Stuart,
 *     monotone-run-length, ...). Those measure TEMPORAL ORDER
 *     dependence; PSS is permutation-invariant and ignores order.
 *
 * Headline question:
 * **"For each source, on which side of its typical day do the
 *   anomalous days fall, and how loudly?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 5): PSS is degenerate for n < 2; the
 *     default 5 keeps both moments and the median nontrivial.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'absPss' desc): 'absPss' | 'pss' | 'pssDesc'
 *     | 'tokens' | 'days' | 'source' | 'meanDaily' | 'medianDaily'
 *     | 'stddevDaily'.
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPearsonSecondSkewnessSort =
  | 'absPss'
  | 'pss'
  | 'pssDesc'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'medianDaily'
  | 'stddevDaily';

export interface DailyTokenPearsonSecondSkewnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenPearsonSecondSkewnessSort;
  generatedAt?: string;
}

export interface DailyTokenPearsonSecondSkewnessSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Per-day arithmetic mean (totalTokens / nDays). */
  meanDaily: number;
  /** Per-day P50 under linear interpolation (R type 7). */
  medianDaily: number;
  /** Per-day population standard deviation (divisor n, NOT n-1). */
  stddevDaily: number;
  /** 3 * (mean - median) / stddev. */
  pss: number;
  /** Sign of PSS in {-1, 0, +1} (skew direction). */
  pssSign: -1 | 0 | 1;
  /** True iff stddev = 0 (cannot normalise; constant series). */
  degenerate: boolean;
}

export interface DailyTokenPearsonSecondSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenPearsonSecondSkewnessSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedTopSources: number;
  sources: DailyTokenPearsonSecondSkewnessSourceRow[];
}

/**
 * Linear-interpolation (numpy 'linear' / R type 7) percentile of a
 * pre-sorted ascending vector.
 */
function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/**
 * Pure primitive: Pearson's second skewness coefficient on a numeric
 * vector.
 *
 *     PSS = 3 * (mean - median) / stddev
 *
 * - `stddev` is the POPULATION standard deviation (divisor n).
 * - Returns `degenerate: true` and `pss: 0` when n < 2 or stddev = 0.
 * - Throws on negative or non-finite input (per-day totals are
 *   strictly non-negative by upstream contract).
 */
export function pearsonSecondSkewnessOfVector(values: number[]): {
  mean: number;
  median: number;
  stddev: number;
  pss: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    return {
      mean: n === 1 ? values[0]! : 0,
      median: n === 1 ? values[0]! : 0,
      stddev: 0,
      pss: 0,
      degenerate: true,
    };
  }
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `pearsonSecondSkewnessOfVector requires non-negative finite values (got ${v})`,
      );
    }
  }
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  let sq = 0;
  for (const v of values) {
    const d = v - mean;
    sq += d * d;
  }
  const variance = sq / n;
  const stddev = Math.sqrt(variance);
  const sorted = values.slice().sort((a, b) => a - b);
  const median = percentileSorted(sorted, 50);
  if (!(stddev > 0)) {
    return { mean, median, stddev: 0, pss: 0, degenerate: true };
  }
  const pss = (3 * (mean - median)) / stddev;
  return { mean, median, stddev, pss, degenerate: false };
}

export function buildDailyTokenPearsonSecondSkewness(
  queue: QueueLine[],
  opts: DailyTokenPearsonSecondSkewnessOptions = {},
): DailyTokenPearsonSecondSkewnessReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (PSS is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenPearsonSecondSkewnessSort = opts.sort ?? 'absPss';
  const validSorts: DailyTokenPearsonSecondSkewnessSort[] = [
    'absPss',
    'pss',
    'pssDesc',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'medianDaily',
    'stddevDaily',
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
  const rows: DailyTokenPearsonSecondSkewnessSourceRow[] = [];

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
    for (const v of acc.perDay.values()) values.push(v);
    const r = pearsonSecondSkewnessOfVector(values);
    let sign: -1 | 0 | 1 = 0;
    if (r.pss > 0) sign = 1;
    else if (r.pss < 0) sign = -1;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      meanDaily: r.mean,
      medianDaily: r.median,
      stddevDaily: r.stddev,
      pss: r.pss,
      pssSign: sign,
      degenerate: r.degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'pss':
        primary = a.pss - b.pss; // ascending (most negative first)
        break;
      case 'pssDesc':
        primary = b.pss - a.pss;
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
      case 'meanDaily':
        primary = b.meanDaily - a.meanDaily;
        break;
      case 'medianDaily':
        primary = b.medianDaily - a.medianDaily;
        break;
      case 'stddevDaily':
        primary = b.stddevDaily - a.stddevDaily;
        break;
      case 'absPss':
      default:
        primary = Math.abs(b.pss) - Math.abs(a.pss);
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedTopSources,
    sources: kept,
  };
}
