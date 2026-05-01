/**
 * daily-token-genentropy-negone-index: per-source GENERALISED
 * ENTROPY GE(-1) of the per-day total_tokens distribution.
 * FORTY-NINTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the alpha = -1
 * element of the Generalised-Entropy GE(alpha) family
 * (Bourguignon 1979; Shorrocks 1980; Cowell 2011):
 *
 *     GE(-1) = (1 / 2) * ((1/n) * sum_i (mu / D_i)^2  -  1)
 *            = (1 / 2) * ( mean_i (mu / D_i)^2  -  1 )
 *
 *   where mu = mean(D). Range [0, +inf). GE(-1) = 0 iff every D_i =
 *   mu (perfect equality). Strictly increasing in any rank-preserving
 *   Pigou-Dalton spread. Diverges to +inf as any D_i -> 0+ -- the
 *   defining BOTTOM-TAIL signature of GE(alpha) at alpha < 0. We
 *   therefore require all D_i > 0 (the upstream `total_tokens > 0`
 *   filter already enforces this; days with zero recorded mass are
 *   simply absent from the per-day vector).
 *
 *   GE(-1) is the canonical BOTTOM-TAIL inequality functional in the
 *   Cowell-Kuga moment family. Its share-power exponent is -1, which
 *   means each share's contribution is 1 / share^2. A single small day
 *   (share -> 0) drives GE(-1) -> +inf, while a single mega-day
 *   (share -> +inf) contributes (mu/D)^2 -> 0. This is the OPPOSITE
 *   tail bias from GE(2) (axis-37; CV^2 / 2; quadratic in the LARGE
 *   shares). The two anchor the moment family at polar-opposite
 *   tail-sensitivities.
 *
 *   THE DEFINING CONTRAST WITH GE(2) (axis-37). GE(2) reads
 *
 *     GE(2)  = (1/2) * ( (1/n) * sum_i (D_i / mu)^2  -  1 )
 *
 *   GE(-1) reads
 *
 *     GE(-1) = (1/2) * ( (1/n) * sum_i (mu / D_i)^2  -  1 )
 *
 *   They differ by INVERTING the share inside the squared term. GE(2)
 *   is dominated by large D_i; GE(-1) is dominated by small D_i. For
 *   any non-degenerate distribution the two are NOT proportional and
 *   NOT a monotone transformation of each other; the ordering of two
 *   sources can flip. The cross-anchor refinement below surfaces both
 *   side-by-side along with their ratio so the reader can SEE the
 *   tail-bias asymmetry directly.
 *
 *   Headline question:
 *   **"For each source, how unequal is the per-day token mass when
 *     scored at the BOTTOM-tail-sensitive moment exponent alpha = -1
 *     in the Cowell-Kuga GE family?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-48):
 *
 *   axis-32 daily-token-gini-coefficient: Gini is rank-based
 *     (Lorenz integration). GE(-1) is share-moment-based; depends
 *     only on the multiset of shares.
 *   axis-33 daily-token-theil-l-index = GE(0): mean of log(mu/x).
 *     Shares the bottom-bias direction with GE(-1) but uses
 *     LOGARITHMIC absorption (linear in log(mu/x)). GE(-1) uses
 *     QUADRATIC absorption ((mu/x)^2 - 1) -- a strictly faster
 *     blow-up as x -> 0+. Different functional class.
 *   axis-34 daily-token-theil-t-index = GE(1) and axis-37
 *     daily-token-ge2-index = GE(2): both ship POSITIVE alpha;
 *     GE(-1) is the first NEGATIVE-alpha element of the family
 *     shipped, so it occupies a structurally distinct slot in the
 *     moment lattice (Cowell 2011 sec. 2.6).
 *   axis-35 daily-token-pietra-ratio / axis-42 daily-token-hoover-
 *     index: single-point L_infinity Lorenz gaps. GE(-1) integrates
 *     a power of every share; not a single-cut functional.
 *   axis-36 daily-token-atkinson-index: power-mean welfare-equivalent
 *     functional; bottom-biased at large eps. There is a textbook
 *     identity A(2) = 1 - 1 / sqrt(1 + 2 * GE(-1)) (Cowell 2011
 *     eq. 4.32); we DO NOT use it as the cross-anchor here because
 *     Atkinson lives on [0, 1] while GE(-1) lives on [0, +inf), and
 *     the identity is a non-linear monotone transform that can
 *     compress visible variation across sources. The polar GE(2)
 *     anchor is more informative for tail-bias diagnostics.
 *   axis-39 daily-token-zenga-index: lower-mean / upper-mean rank
 *     shortfall. Different functional family.
 *   axis-40 daily-token-palma-ratio: two-point Lorenz ratio. Different
 *     two-point functional.
 *   axis-41 daily-token-fgt-index: one-sided lower-tail threshold-
 *     anchored poverty index. GE(-1) is two-sided and threshold-FREE.
 *   axis-43 daily-token-bonferroni-index / axis-45 daily-token-mehran-
 *     index: rank-based partial-mean kernels. GE(-1) is share-moment-
 *     based.
 *   axis-44 daily-token-kolm-pollak-index: ABSOLUTE (translation-
 *     invariant). GE(-1) is RELATIVE (scale-invariant).
 *   axis-46 daily-token-wolfson-polarization-index: median-anchored
 *     bipolarization. Different functional class entirely.
 *   axis-47 daily-token-sgini-index: parametric RANK kernel
 *     (Donaldson-Weymark). GE(-1) is parametric SHARE-MOMENT kernel
 *     at a fixed (negative) exponent. Functionally orthogonal
 *     parameter axes.
 *   axis-48 daily-token-chakravarty-index: parametric SHARE-VALUE
 *     kernel at concavity alpha in (0, 1). Chakravarty is a CONCAVE
 *     average of share^alpha; GE(-1) is a CONVEX average of
 *     share^(-2). Different concavity sign, different exponent sign.
 *   All time-ordered axes: GE(-1) is permutation-invariant (depends
 *     only on the multiset of share values), so orthogonal to every
 *     time-ordered axis.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 3): GE(-1) is degenerate for n < 2; we
 *     require >= 3 days to avoid two-point trivialities.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'genEntropy'): 'genEntropy' | 'tokens' |
 *     'days' | 'source' | 'meanDaily' | 'ge2Gap'.
 *   - `minGenEntropy` (default 0): display filter on GE(-1).
 *   - `includeGe2Anchor` (refinement): per-row `ge2` (GE(2) on the
 *     SAME per-day vector, the polar TOP-tail companion in the same
 *     moment family), `ge2Gap` = genEntropy - ge2, and
 *     `genEntropyOverGe2` = genEntropy / ge2 (or null if ge2 = 0).
 *     Surfaces the tail-bias asymmetry of the moment family at
 *     alpha = -1 vs alpha = +2.
 */
import type { QueueLine } from './types.js';

export type DailyTokenGenEntropyNegOneSort =
  | 'genEntropy'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'ge2Gap';

export interface DailyTokenGenEntropyNegOneOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenGenEntropyNegOneSort;
  /** Display filter: drop rows whose genEntropy < this. Non-negative. Default 0 = no filter. */
  minGenEntropy?: number;
  /**
   * Refinement: when true, every emitted row gains `ge2`
   * (GE(2) on the same vector), `ge2Gap` (genEntropy - ge2), and
   * `genEntropyOverGe2` (ratio, or null if ge2 = 0).
   */
  includeGe2Anchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenGenEntropyNegOneSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one positive observation. */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** GE(-1) on the per-day vector. In [0, +inf). */
  genEntropy: number;
  /** True iff total = 0 OR n < 2. genEntropy = 0 in this case. */
  degenerate: boolean;
  meanDailyTokens: number;
  medianDailyTokens: number;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: GE(2) on the same vector. */
  ge2?: number;
  /** Refinement: genEntropy - ge2. */
  ge2Gap?: number;
  /** Refinement: genEntropy / ge2 (NaN if ge2 = 0). */
  genEntropyOverGe2?: number;
}

export interface DailyTokenGenEntropyNegOneReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGenEntropyNegOneSort;
  minGenEntropy: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinGenEntropy: number;
  droppedTopSources: number;
  sources: DailyTokenGenEntropyNegOneSourceRow[];
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
 * Generalised Entropy GE(-1) of a strictly-positive vector:
 *
 *     GE(-1) = (1/2) * ( (1/n) * sum_i (mu / x_i)^2  -  1 )
 *
 * Returns {genEntropy: 0, degenerate: true} for n < 2, empty input,
 * or all-zero vector. Throws on negative or non-finite input. Throws
 * on any zero entry inside an otherwise non-degenerate vector
 * (GE(-1) diverges; surfacing this as an error is the safer
 * contract than silently emitting +inf).
 */
export function genEntropyNegOneOfVector(values: number[]): {
  genEntropy: number;
  mean: number;
  median: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    const v0 = n === 1 ? (values[0] as number) : 0;
    return {
      genEntropy: 0,
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
        `genEntropyNegOneOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) {
    return {
      genEntropy: 0,
      mean: 0,
      median: 0,
      total: 0,
      degenerate: true,
    };
  }
  // GE(-1) requires strictly positive entries; surface any zero
  // explicitly (the upstream `total_tokens > 0` filter is the
  // contract, but we double-check at the primitive boundary).
  for (const v of values) {
    if (v === 0) {
      throw new Error(
        `genEntropyNegOneOfVector requires strictly positive entries; GE(-1) diverges at x_i = 0`,
      );
    }
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mu = total / n;
  const median = medianOfSorted(sorted);
  let acc = 0;
  for (const v of values) {
    const r = mu / v;
    acc += r * r;
  }
  const meanRsq = acc / n;
  const genEntropy = 0.5 * (meanRsq - 1);
  return {
    genEntropy,
    mean: mu,
    median,
    total,
    degenerate: false,
  };
}

/**
 * GE(2) on the same vector, used as the polar TOP-tail cross-anchor
 * inside the moment family.
 *
 *     GE(2) = (1/2) * ( (1/n) * sum_i (x_i / mu)^2  -  1 )
 *
 * Returns 0 for n < 2, empty, or all-zero. Throws on bad input.
 */
function ge2OfVector(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`ge2OfVector requires non-negative finite values`);
    }
    total += v;
  }
  if (total <= 0) return 0;
  const mu = total / n;
  let acc = 0;
  for (const v of values) {
    const r = v / mu;
    acc += r * r;
  }
  return 0.5 * (acc / n - 1);
}

export function buildDailyTokenGenEntropyNegOneIndex(
  queue: QueueLine[],
  opts: DailyTokenGenEntropyNegOneOptions = {},
): DailyTokenGenEntropyNegOneReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (GE(-1) is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minGenEntropy = opts.minGenEntropy ?? 0;
  if (!Number.isFinite(minGenEntropy) || minGenEntropy < 0) {
    throw new Error(
      `minGenEntropy must be a non-negative finite number (got ${opts.minGenEntropy})`,
    );
  }
  const sort: DailyTokenGenEntropyNegOneSort = opts.sort ?? 'genEntropy';
  const validSorts: DailyTokenGenEntropyNegOneSort[] = [
    'genEntropy',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'ge2Gap',
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
  const rows: DailyTokenGenEntropyNegOneSourceRow[] = [];

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
    const g = genEntropyNegOneOfVector(values);
    const row: DailyTokenGenEntropyNegOneSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      genEntropy: g.genEntropy,
      degenerate: g.degenerate,
      meanDailyTokens: g.mean,
      medianDailyTokens: g.median,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeGe2Anchor) {
      const g2 = ge2OfVector(values);
      row.ge2 = g2;
      row.ge2Gap = g.genEntropy - g2;
      row.genEntropyOverGe2 = g2 > 0 ? g.genEntropy / g2 : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinGenEntropy = 0;
  let filtered = rows;
  if (minGenEntropy > 0) {
    const next: DailyTokenGenEntropyNegOneSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.genEntropy >= minGenEntropy) next.push(r);
      else droppedBelowMinGenEntropy += 1;
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
      case 'ge2Gap': {
        const ar = a.ge2Gap ?? 0;
        const br = b.ge2Gap ?? 0;
        primary = br - ar;
        break;
      }
      case 'genEntropy':
      default:
        primary = b.genEntropy - a.genEntropy;
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
    minGenEntropy,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinGenEntropy,
    droppedTopSources,
    sources: kept,
  };
}
