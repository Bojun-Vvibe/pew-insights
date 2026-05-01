/**
 * daily-token-chakravarty-index: per-source CHAKRAVARTY (1988)
 * single-parameter inequality index of the per-day total_tokens
 * distribution. FORTY-EIGHTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Chakravarty
 * (1988) "Ethical Social Index Numbers" generalized inequality
 * index at concavity parameter alpha in (0, 1):
 *
 *     C(alpha) = 1 - (1/n) * sum_{i=1..n} (D_i / mu)^alpha
 *
 *   where mu is the sample mean and 0^0 := 0 by convention. Range
 *   [0, 1]. C = 0 iff every D_i = mu (perfect equality). Strictly
 *   increasing in any rank-preserving Pigou-Dalton spread.
 *
 *   alpha is a CONCAVITY / TOP-WEIGHTING knob in (0, 1):
 *     alpha = 1   degenerate identity, C = 0 for any vector. We
 *                 reject this at parse time.
 *     alpha -> 1- weakest concavity; C tends to 0 for any vector.
 *     alpha = 0.5 balanced; canonical default.
 *     alpha -> 0+ strongest concavity (geometric-mean limit); the
 *                 Atkinson-1 / log-utility regime is approached but
 *                 NOT reproduced (Chakravarty drops the outer
 *                 power-mean wrapper Atkinson uses).
 *
 *   THE DEFINING CONTRAST WITH ATKINSON. Atkinson (axis-36) is
 *   built around the equally-distributed-equivalent income (EDE):
 *
 *     A(eps) = 1 - [(1/n) * sum_i (D_i/mu)^(1-eps)]^(1/(1-eps))
 *
 *   The OUTER power 1/(1-eps) is what makes A a welfare-equivalent-
 *   mean construction (1 - EDE/mu). Chakravarty 1988 INTENTIONALLY
 *   DROPS that outer power and reads inequality directly off the
 *   raw mean of concave normalised shares:
 *
 *     C(alpha) = 1 - (arithmetic mean of (x/mu)^alpha)
 *
 *   So C is the AVERAGE concave share-deficit; A is 1 - the
 *   POWER-mean-equivalent of share. They are NOT proportional and
 *   NOT a monotone transformation of each other in general; the
 *   ordering of two distributions can flip between the two indices.
 *   The relationship A(1-alpha) = 1 - (1 - C(alpha))^(1/alpha) is
 *   a textbook identity (Chakravarty 1988, eq. 3.4) but it is a
 *   non-linear transform, not a linear or rank-preserving one.
 *
 *   Headline question:
 *   **"For each source, how unequal is the per-day token mass when
 *     scored as the average concave normalised share-deficit
 *     (1 - mean of (x/mu)^alpha) at concavity alpha = 0.5?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-47):
 *
 *   axis-32 daily-token-gini-coefficient: Gini is rank-based
 *     (depends on order statistics through Lorenz integration).
 *     Chakravarty is share-moment-based (depends only on the
 *     multiset of normalised shares; no rank pairing). Two vectors
 *     with identical share moments but different rank-order
 *     statistics read identical C and different G.
 *   axis-33 daily-token-theil-l-index = GE(0): Theil-L = mean of
 *     log(mu/x_i) = -mean of log(x_i/mu). Logarithm is the
 *     alpha->0 LIMIT of (1 - x^alpha)/alpha; Chakravarty at
 *     alpha=0.5 uses the direct concave power x^0.5, NOT its
 *     logarithm. Distinct functional forms.
 *   axis-34 daily-token-theil-t-index = GE(1) and axis-37 GE2:
 *     all GE indices are share-MOMENT functionals built from
 *     x*log(x) or x^2 / mu^2; Chakravarty uses x^alpha with
 *     alpha in (0,1) - a DIFFERENT power-family entirely.
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: single-point L_infinity Lorenz gaps at the mean cut.
 *     Chakravarty integrates a CONCAVE TRANSFORM of every share
 *     value, not a single-point Lorenz reading.
 *   axis-36 daily-token-atkinson-index: explicit polar-opposite
 *     construction (see "DEFINING CONTRAST" above). Atkinson at
 *     eps=0.5 reads A = 1 - [(1/n) sum (x/mu)^0.5]^2; Chakravarty
 *     at alpha=0.5 reads C = 1 - (1/n) sum (x/mu)^0.5. The two
 *     differ by an OUTER SQUARE that materially changes the
 *     ordering between distributions.
 *   axis-39 daily-token-zenga-index: lower-mean / upper-mean
 *     shortfall functional; rank-anchored, non-symmetric. Different
 *     functional family.
 *   axis-40 daily-token-palma-ratio: two-point ratio of cumulative
 *     Lorenz shares. Different two-point functional, no concave
 *     averaging.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold-
 *     anchored poverty index. Chakravarty is two-sided and
 *     threshold-FREE.
 *   axis-43 daily-token-bonferroni-index: harmonic-bottom-rank-
 *     weighted (1/k cumulative-mean kernel). Rank-based; not
 *     comparable to Chakravarty's share-power averaging.
 *   axis-44 daily-token-kolm-pollak-index: ABSOLUTE (translation-
 *     invariant) measure in token units. Chakravarty is RELATIVE
 *     (scale-invariant) and dimensionless. Polar-opposite
 *     invariance class.
 *   axis-45 daily-token-mehran-index: linear partial-mean Lorenz
 *     kernel. Rank-based; different family.
 *   axis-46 daily-token-wolfson-polarization-index: median-anchored
 *     bipolarization. Different functional class entirely.
 *   axis-47 daily-token-sgini-index: parametric RANK kernel
 *     (Donaldson-Weymark). Chakravarty is parametric SHARE-VALUE
 *     kernel (concave power on share). Two vectors with identical
 *     order statistics but reshuffled values give the same S-Gini
 *     and the same Chakravarty (both are permutation-invariant),
 *     but the parameter axes (rank-aversion delta vs share-
 *     concavity alpha) are functionally orthogonal.
 *   All time-ordered axes: Chakravarty is permutation-invariant
 *     (depends only on the multiset of share values), so
 *     orthogonal to every time-ordered axis.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 3): Chakravarty is degenerate for n < 2;
 *     we require >= 3 days to avoid two-point trivialities.
 *   - `alpha` (default 0.5): concavity parameter. Must be in (0, 1).
 *     We reject alpha = 1 (degenerate identity, C = 0 for any
 *     vector) and alpha <= 0 (loses concavity, no longer an
 *     inequality index in Chakravarty's axiomatic sense).
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'chakravarty'): 'chakravarty' | 'tokens' |
 *     'days' | 'source' | 'meanDaily' | 'atkinsonGap'.
 *   - `minChakravarty` (default 0): display filter on C.
 *   - `includeAtkinsonAnchor` (refinement): per-row
 *     `atkinson` (Atkinson at eps = 1 - alpha on the SAME vector,
 *     which is the welfare-economics anchor that shares the
 *     concavity parameter with Chakravarty), `atkinsonGap`
 *     = chakravarty - atkinson, and `chakravartyOverAtkinson` =
 *     chakravarty / atkinson (or null if atkinson = 0). Surfaces
 *     the textbook Chakravarty-Atkinson identity gap and lets the
 *     reader see the two functionals side-by-side at matched
 *     concavity.
 */
import type { QueueLine } from './types.js';

export type DailyTokenChakravartySort =
  | 'chakravarty'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'atkinsonGap';

export interface DailyTokenChakravartyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  /** Concavity parameter. Must be in (0, 1). Default 0.5. */
  alpha?: number;
  top?: number;
  sort?: DailyTokenChakravartySort;
  /** Display filter: drop rows whose chakravarty < this. In [0, 1). Default 0 = no filter. */
  minChakravarty?: number;
  /**
   * Refinement: when true, every emitted row gains `atkinson`
   * (Atkinson at eps = 1 - alpha), `atkinsonGap` (chakravarty -
   * atkinson), and `chakravartyOverAtkinson` (ratio, or null if
   * atkinson = 0).
   */
  includeAtkinsonAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenChakravartySourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed. */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Chakravarty (1988) C(alpha). In [0, 1]. */
  chakravarty: number;
  /** True iff total = 0 OR n < 2. chakravarty = 0 in this case. */
  degenerate: boolean;
  /** Concavity parameter actually used (echoes opts.alpha). */
  alpha: number;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Atkinson at eps = 1 - alpha on the same vector. */
  atkinson?: number;
  /** Refinement: chakravarty - atkinson. */
  atkinsonGap?: number;
  /** Refinement: chakravarty / atkinson (NaN if atkinson = 0). */
  chakravartyOverAtkinson?: number;
}

export interface DailyTokenChakravartyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  alpha: number;
  top: number;
  sort: DailyTokenChakravartySort;
  minChakravarty: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinChakravarty: number;
  droppedTopSources: number;
  sources: DailyTokenChakravartySourceRow[];
}

function medianOfSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2] as number;
  const a = sorted[n / 2 - 1] as number;
  const b = sorted[n / 2] as number;
  return (a + b) / 2;
}

/**
 * Chakravarty (1988) generalized inequality index of a
 * non-negative vector at concavity parameter alpha in (0, 1):
 *
 *     C(alpha) = 1 - (1/n) * sum_i (x_i / mu)^alpha
 *
 * with the convention 0^alpha = 0 for alpha > 0. Returns
 * {chakravarty: 0, degenerate: true} for n < 2, empty input, or
 * all-zero vector. Throws on negative or non-finite input, or
 * alpha not in the open interval (0, 1).
 *
 * Identities used as test anchors:
 *   - perfect equality (all equal): C = 1 - (1/n) * n * 1 = 0.
 *   - scale-invariance: C(c*x) = C(x) for any c > 0 (x/mu is
 *     scale-invariant by construction).
 *   - permutation-invariance: C depends only on the multiset of
 *     shares.
 *   - bounded: C in [0, 1] (since each (x_i/mu)^alpha >= 0, and
 *     the mean of (x/mu)^alpha is in [0, 1] when alpha in (0,1) by
 *     Jensen's inequality applied to the concave x^alpha).
 */
export function chakravartyOfVector(
  values: number[],
  alpha: number,
): {
  chakravarty: number;
  mean: number;
  median: number;
  total: number;
  degenerate: boolean;
} {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(
      `chakravartyOfVector requires alpha in the open interval (0, 1) (got ${alpha})`,
    );
  }
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      chakravarty: 0,
      mean: v0,
      median: v0,
      total: v0,
      degenerate: true,
    };
  }
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `chakravartyOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      chakravarty: 0,
      mean: 0,
      median: 0,
      total: 0,
      degenerate: true,
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  const median = medianOfSorted(sorted);
  let acc = 0;
  for (const v of values) {
    if (v === 0) continue; // 0^alpha = 0 for alpha > 0
    acc += Math.pow(v / mu, alpha);
  }
  const chakravarty = 1 - acc / n;
  return {
    chakravarty,
    mean: mu,
    median,
    total,
    degenerate: false,
  };
}

/**
 * Atkinson (1970) index at inequality-aversion eps in (0, 1).
 * Used here as the cross-anchor companion to chakravartyOfVector.
 *
 *     A(eps) = 1 - [ (1/n) * sum_i (x_i / mu)^(1 - eps) ]^(1/(1-eps))
 *
 * Limited to eps in (0, 1) because that is the range over which
 * (1 - eps) in (0, 1) matches Chakravarty's alpha domain. Returns
 * 0 for n < 2, empty, or all-zero. Throws on bad input.
 */
function atkinsonOfVectorOpenUnit(values: number[], eps: number): number {
  if (!Number.isFinite(eps) || eps <= 0 || eps >= 1) {
    throw new Error(`atkinson eps must be in (0, 1) (got ${eps})`);
  }
  const n = values.length;
  if (n < 2) return 0;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`atkinson requires non-negative finite values`);
    }
    total += v;
  }
  if (total <= 0) return 0;
  const mu = total / n;
  let acc = 0;
  for (const v of values) {
    if (v === 0) continue;
    acc += Math.pow(v / mu, 1 - eps);
  }
  acc /= n;
  // EDE / mu = acc^(1 / (1 - eps))
  const ede = Math.pow(acc, 1 / (1 - eps));
  return 1 - ede;
}

export function buildDailyTokenChakravartyIndex(
  queue: QueueLine[],
  opts: DailyTokenChakravartyOptions = {},
): DailyTokenChakravartyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Chakravarty is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const alpha = opts.alpha ?? 0.5;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    throw new Error(
      `alpha must be a finite number in the open interval (0, 1) (got ${opts.alpha})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minChakravarty = opts.minChakravarty ?? 0;
  if (
    !Number.isFinite(minChakravarty) ||
    minChakravarty < 0 ||
    minChakravarty >= 1
  ) {
    throw new Error(
      `minChakravarty must be a number in [0, 1) (got ${opts.minChakravarty})`,
    );
  }
  const sort: DailyTokenChakravartySort = opts.sort ?? 'chakravarty';
  const validSorts: DailyTokenChakravartySort[] = [
    'chakravarty',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'atkinsonGap',
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
  const rows: DailyTokenChakravartySourceRow[] = [];

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
    const c = chakravartyOfVector(values, alpha);
    const row: DailyTokenChakravartySourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      chakravarty: c.chakravarty,
      degenerate: c.degenerate,
      alpha,
      meanDailyTokens: c.mean,
      medianDailyTokens: c.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeAtkinsonAnchor) {
      const atk = atkinsonOfVectorOpenUnit(values, 1 - alpha);
      row.atkinson = atk;
      row.atkinsonGap = c.chakravarty - atk;
      row.chakravartyOverAtkinson = atk > 0 ? c.chakravarty / atk : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinChakravarty = 0;
  let filtered = rows;
  if (minChakravarty > 0) {
    const next: DailyTokenChakravartySourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.chakravarty >= minChakravarty) next.push(r);
      else droppedBelowMinChakravarty += 1;
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
      case 'atkinsonGap': {
        const ar = a.atkinsonGap ?? 0;
        const br = b.atkinsonGap ?? 0;
        primary = br - ar;
        break;
      }
      case 'chakravarty':
      default:
        primary = b.chakravarty - a.chakravarty;
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
    alpha,
    top,
    sort,
    minChakravarty,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinChakravarty,
    droppedTopSources,
    sources: kept,
  };
}
