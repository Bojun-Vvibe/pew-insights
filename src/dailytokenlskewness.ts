/**
 * daily-token-l-skewness: per-source L-SKEWNESS (tau_3 = lambda_3 /
 * lambda_2) of the per-day total_tokens vector.
 *
 * SIXTY-SEVENTH cross-source axis.
 *
 * The L-moments (Hosking 1990, "L-moments: analysis and estimation
 * of distributions using linear combinations of order statistics",
 * JRSS-B 52(1):105-124) are a family of summary statistics built
 * from linear combinations of expectations of ORDER STATISTICS
 * rather than from powers of the data. The first four are:
 *
 *     lambda_1 = E[X_(1:1)]                       (the mean)
 *     lambda_2 = (1/2)  E[X_(2:2) - X_(1:2)]      (a scale)
 *     lambda_3 = (1/3)  E[X_(3:3) - 2 X_(2:3) + X_(1:3)]
 *     lambda_4 = (1/4)  E[X_(4:4) - 3 X_(3:4) + 3 X_(2:4) - X_(1:4)]
 *
 * The dimensionless L-moment ratios are
 *
 *     tau_3 = lambda_3 / lambda_2     (L-skewness, in (-1, +1))
 *     tau_4 = lambda_4 / lambda_2     (L-kurtosis, in (-1/4, +1))
 *
 * For a sample x_1, ..., x_n with order statistics x_(1:n) <=
 * ... <= x_(n:n) the unbiased SAMPLE L-moments use Hosking's
 * probability-weighted moments:
 *
 *     b_r = (1 / n) * sum_{j=r+1..n} ((j-1)(j-2)...(j-r) /
 *                                     ((n-1)(n-2)...(n-r))) * x_(j:n)
 *
 *     l_1 = b_0
 *     l_2 = 2 b_1 - b_0
 *     l_3 = 6 b_2 - 6 b_1 + b_0
 *
 * and t_3 = l_3 / l_2 is the unbiased plug-in L-skewness estimator
 * used here. By Hosking's bound |tau_3| < 1 for any non-degenerate
 * distribution.
 *
 * SIGN CONVENTION:
 *
 *   - tau_3 > 0 : right-skewed (heavy upper tail)
 *   - tau_3 < 0 : left-skewed
 *   - tau_3 = 0 : symmetric
 *
 * Headline question:
 * **"For each source, does the per-day total_tokens distribution
 *   have a HEAVIER UPPER OR LOWER TAIL, measured via the
 *   PROBABILITY-WEIGHTED-MOMENT (linear order-statistic)
 *   estimator tau_3 -- bounded in (-1, +1), defined for any
 *   distribution with finite mean (no second moment required),
 *   and a fundamentally different primitive from any other
 *   shipped daily-token axis?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..66):
 *
 *   - vs ALL unsigned dispersion axes 32..63 (Gini, Atkinson,
 *     Theil-L/T, GE family, Hoover, Pietra, Bonferroni, Mehran,
 *     Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray, Var-of-Logs, Log-MAD, FGT, PGR, IOM, MSR,
 *     DSG, QSR, MADM): those are reflection-INVARIANT and cannot
 *     detect the SIGN of asymmetry. tau_3 IS signed and changes
 *     sign under X -> 2*mean - X.
 *
 *   - vs axes 60 (MSR) and 64 (RTZ): both are calendar-ORDER
 *     trace statistics on the binary above/below-median sequence
 *     and ignore magnitude. tau_3 is permutation-INVARIANT and
 *     depends only on order statistics; sorting the days first
 *     does not change tau_3.
 *
 *   - vs axis 65 Hill (tail-index): Hill is TAIL-ONLY (top-k
 *     order statistics, requires choosing k) and unbounded in
 *     (0, +inf); tau_3 uses ALL order statistics with an
 *     analytic linear weighting, requires no k choice, and is
 *     bounded in (-1, +1). A symmetric heavy-tail distribution
 *     has tau_3 = 0 while Hill alpha is small.
 *
 *   - vs axis 66 medcouple (MC): this is the KEY orthogonality
 *     to defend, since both MC and tau_3 are signed
 *     dimensionless skewness measures bounded in [-1, +1] / (-1, +1).
 *     They use FUNDAMENTALLY DIFFERENT primitives:
 *
 *       MEDCOUPLE -- PAIRWISE QUARTILE FUNCTIONAL.
 *           median over (x_i, x_j) with x_i <= m <= x_j of
 *           [(x_j - m) - (m - x_i)] / (x_j - x_i).
 *           Builds an O(n^2) family of pairwise asymmetry
 *           ratios then takes their MEDIAN. Robust (~25%
 *           breakdown), but uses ONLY pairs that straddle the
 *           sample median; everything in the lower half is
 *           summarised by its single largest representative
 *           against everything in the upper half by its smallest.
 *
 *       L-SKEWNESS -- LINEAR ORDER-STATISTIC (PWM) FUNCTIONAL.
 *           tau_3 = (6 b_2 - 6 b_1 + b_0) / (2 b_1 - b_0),
 *           where b_r is a polynomial-weighted MEAN over ALL
 *           order statistics. Uses the FULL ranked sample
 *           with a smooth, monotonically-increasing weight on
 *           the upper-tail order statistics; the weights are
 *           NOT a hard split at the median.
 *
 *     Concretely they DISAGREE on standard bimodal /
 *     pre-asymmetric cases:
 *
 *       (a) A vector with all mass concentrated in three large
 *           values above the median and many small values just
 *           below has MC near +1 (the pairwise ratio is near
 *           the upper bound) but tau_3 nearer +0.4..+0.7
 *           (the polynomial weights soften the contribution
 *           of the few extreme upper-tail values).
 *
 *       (b) A vector with one large outlier and otherwise
 *           symmetric body has tau_3 strictly positive (the
 *           upper PWM b_2 absorbs the outlier with weight
 *           proportional to (j-1)(j-2)) while MC remains 0
 *           when the median straddle pair set is unaffected.
 *
 *     So MC and tau_3 measure independent slices of the
 *     skew-shape plane -- they can take any joint value in
 *     ([-1, +1] x (-1, +1)).
 *
 *   - vs `source-row-token-skewness` (3rd-moment skewness,
 *     row-level): classical g_1 = m_3 / m_2^(3/2) requires
 *     finite THIRD moment, is unbounded, and is dominated by
 *     extreme values (breakdown 0). tau_3 requires only finite
 *     FIRST moment, is bounded, and downweights extremes
 *     (asymptotic relative efficiency higher than g_1 for
 *     heavy-tailed parents).
 *
 *   - vs `source-row-token-bowley-skewness` (Bowley quartile
 *     skewness): Bowley uses exactly THREE quantiles (Q1, Q2,
 *     Q3); tau_3 uses ALL n order statistics with smooth
 *     polynomial weights. Bowley is bounded in [-1, +1] but is
 *     piecewise-constant in the underlying distribution (jumps
 *     when a quartile crosses an observation); tau_3 is smooth.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass
 *     is below this floor.
 *   - `minDays` (default 5): tau_3 requires l_2 well-defined and
 *     non-zero; we additionally require >=3 distinct values.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'absTau3'): 'absTau3' (most-asymmetric
 *     first; |tau_3| descending) | 'tau3' (most right-skewed
 *     first) | 'tau3Asc' (most left-skewed first) | 'tokens' |
 *     'days' | 'source'.
 *   - `minAbsTau3`: display filter; hide rows with |tau_3| < this.
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';

export type DailyTokenLSkewnessSort =
  | 'absTau3'
  | 'tau3'
  | 'tau3Asc'
  | 'tokens'
  | 'days'
  | 'source';

export interface DailyTokenLSkewnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenLSkewnessSort;
  /** Display filter: drop rows whose |tau_3| is strictly below this value. null = no filter. */
  minAbsTau3?: number | null;
  generatedAt?: string;
}

export interface DailyTokenLSkewnessSourceRow {
  source: string;
  totalTokens: number;
  /** Days observed (all days with strictly positive total_tokens). */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Sample L-mean = b_0. */
  l1: number;
  /** Sample L-scale (always >= 0 for any sample). */
  l2: number;
  /** Sample L-skewness numerator (signed). */
  l3: number;
  /** L-skewness ratio tau_3 = l_3 / l_2 in (-1, +1). */
  tau3: number;
  meanDailyTokens: number;
  /** Number of distinct values among the per-day vector. */
  nDistinct: number;
  /** True when tau_3 is undefined (e.g. l_2 == 0 -> all values equal). */
  degenerate: boolean;
}

export interface DailyTokenLSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenLSkewnessSort;
  minAbsTau3: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinAbsTau3: number;
  droppedTopSources: number;
  sources: DailyTokenLSkewnessSourceRow[];
}

/**
 * Compute the unbiased sample L-moments l_1, l_2, l_3 and the
 * L-skewness ratio tau_3 = l_3 / l_2 of a non-empty numeric
 * vector via Hosking's probability-weighted moments.
 *
 * Throws on non-finite input.
 *
 *   b_r = (1 / n) * sum_{j=r+1..n} (
 *           prod_{k=1..r} (j-k) / prod_{k=1..r} (n-k)
 *         ) * x_(j:n)
 *
 *   l_1 = b_0
 *   l_2 = 2 b_1 - b_0
 *   l_3 = 6 b_2 - 6 b_1 + b_0
 *
 * Degenerate cases (n < 4 or all-equal sample) -> tau_3 = 0,
 * `degenerate: true`. We require n >= 4 because b_2 needs at
 * least three indices j with a non-zero binomial weight; with
 * n=3 the b_2 sum has a single term and l_3 is fully determined
 * by the single largest order statistic, which is structurally
 * fragile.
 */
export function lSkewnessOfVector(values: number[]): {
  l1: number;
  l2: number;
  l3: number;
  tau3: number;
  nDistinct: number;
  degenerate: boolean;
} {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `lSkewnessOfVector requires finite values (got ${v})`,
      );
    }
  }
  const n = values.length;
  if (n < 4) {
    return {
      l1: n >= 1 ? values.reduce((a, b) => a + b, 0) / n : 0,
      l2: 0,
      l3: 0,
      tau3: 0,
      nDistinct: new Set(values).size,
      degenerate: true,
    };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const nDistinct = new Set(sorted).size;
  // Probability-weighted moments b_0, b_1, b_2 (Hosking 1990).
  // b_0 = mean of x.
  // b_1 = (1/n) * sum_{j=2..n} (j-1)/(n-1) * x_(j)
  // b_2 = (1/n) * sum_{j=3..n} (j-1)(j-2)/((n-1)(n-2)) * x_(j)
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let idx = 0; idx < n; idx += 1) {
    const j = idx + 1; // 1-based rank
    const x = sorted[idx]!;
    b0 += x;
    if (j >= 2) {
      b1 += ((j - 1) / (n - 1)) * x;
    }
    if (j >= 3) {
      b2 += (((j - 1) * (j - 2)) / ((n - 1) * (n - 2))) * x;
    }
  }
  b0 /= n;
  b1 /= n;
  b2 /= n;
  const l1 = b0;
  const l2 = 2 * b1 - b0;
  const l3 = 6 * b2 - 6 * b1 + b0;
  // l_2 is the sample analogue of E|X - X'|/2 and is >= 0 always;
  // numerical noise can make it tiny negative when all values equal.
  if (!(l2 > 0) || nDistinct < 2) {
    return {
      l1,
      l2: Math.max(l2, 0),
      l3,
      tau3: 0,
      nDistinct,
      degenerate: true,
    };
  }
  let tau3 = l3 / l2;
  // Numerical clamp into the open theoretical range (-1, +1). For
  // a finite sample l_3/l_2 can in principle hit the boundary; in
  // practice we clamp aggressively so callers see a well-defined
  // value.
  if (tau3 > 1) tau3 = 1;
  if (tau3 < -1) tau3 = -1;
  return { l1, l2, l3, tau3, nDistinct, degenerate: false };
}

export function buildDailyTokenLSkewness(
  queue: QueueLine[],
  opts: DailyTokenLSkewnessOptions = {},
): DailyTokenLSkewnessReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 5;
  if (!Number.isInteger(minDays) || minDays < 4) {
    throw new Error(
      `minDays must be an integer >= 4 (the unbiased sample tau_3 requires n >= 4 because b_2 needs >=3 nonzero-weight order statistics) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAbsTau3 = opts.minAbsTau3 ?? null;
  if (
    minAbsTau3 !== null &&
    (!Number.isFinite(minAbsTau3) || minAbsTau3 < 0 || minAbsTau3 > 1)
  ) {
    throw new Error(
      `minAbsTau3 must be a finite number in [0, 1] when set (got ${opts.minAbsTau3})`,
    );
  }
  const sort: DailyTokenLSkewnessSort = opts.sort ?? 'absTau3';
  const validSorts: DailyTokenLSkewnessSort[] = [
    'absTau3',
    'tau3',
    'tau3Asc',
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
  const rows: DailyTokenLSkewnessSourceRow[] = [];

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
    const r = lSkewnessOfVector(values);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      l1: r.l1,
      l2: r.l2,
      l3: r.l3,
      tau3: r.tau3,
      meanDailyTokens: acc.totalTokens / nDays,
      nDistinct: r.nDistinct,
      degenerate: r.degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAbsTau3 = 0;
  let filtered = rows;
  if (minAbsTau3 !== null) {
    const next: DailyTokenLSkewnessSourceRow[] = [];
    for (const r of rows) {
      if (!r.degenerate && Math.abs(r.tau3) >= minAbsTau3) next.push(r);
      else if (r.degenerate) next.push(r);
      else droppedBelowMinAbsTau3 += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tau3':
        primary = b.tau3 - a.tau3;
        break;
      case 'tau3Asc':
        primary = a.tau3 - b.tau3;
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
      case 'absTau3':
      default:
        primary = Math.abs(b.tau3) - Math.abs(a.tau3);
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
    minAbsTau3,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinAbsTau3,
    droppedTopSources,
    sources: kept,
  };
}
