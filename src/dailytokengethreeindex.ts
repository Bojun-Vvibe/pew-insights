/**
 * daily-token-ge-three-index: per-source GENERALIZED ENTROPY index at
 * parameter alpha = 3 (GE(3)) of the per-day total_tokens
 * distribution. FIFTY-SIXTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the alpha=3 member
 * of the generalised-entropy family:
 *
 *     GE(alpha) = (1 / (alpha*(alpha-1)*n)) * sum_i [ (D_i/mu)^alpha - 1 ]
 *     GE(3)     = (1 / (3*2*n)) * sum_i [ (D_i/mu)^3 - 1 ]
 *               = (1/6) * ( (1/n) * sum_i (D_i/mu)^3 - 1 )
 *               = (1/6) * ( M_3(D) / mu^3 - 1 ),
 *     where M_3(D) = (1/n) * sum_i D_i^3 is the raw third moment of D.
 *
 *   GE(3) is the unique CUBIC-SHARE member of the GE family. It is the
 *   most TOP-SENSITIVE / HEAVY-TAIL-EMPHASISING standard alpha that is
 *   still routinely shipped on production data: each daily share is
 *   raised to the third power before averaging, so the contribution of
 *   the largest day to the index grows with the cube of its share.
 *   Range: [0, +inf); GE(3) = 0 iff perfect equality (Jensen on the
 *   convex x^3). Larger GE(3) = more cube-share dispersion of
 *   daily-token mass, dominated by the heaviest day.
 *
 *   Headline question:
 *   **"After we cube each day's share of total token mass, how much
 *     does the resulting average exceed the equal-share baseline for
 *     each source?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-55):
 *
 *   axes-33/34/37/49/55 GE family: Theil-L = GE(0), Theil-T = GE(1),
 *     GE(2), GE(-1), GE(1/2). All shipped GE alphas live in
 *     {-1, 0, 1/2, 1, 2}; alpha=3 is the unique cubic-share kernel and
 *     the next standard heavy-tail point above GE(2). Closed-form
 *     audit on lognormal: GE(3) = (exp(3*sigma^2) - 1) / 6 vs GE(2) =
 *     (exp(sigma^2) - 1) / 2; the ratio GE(3)/GE(2) =
 *     (exp(3*sigma^2) - 1) / (3*(exp(sigma^2) - 1)) -> 1 as
 *     sigma -> 0 and -> +inf super-exponentially as sigma -> +inf,
 *     so GE(3) and GE(2) cannot rank lognormal sources identically
 *     when sigma differs across sources.
 *   axis-32 Gini: pairwise mean-absolute-difference / 2mu. GE(3) is a
 *     single-point cubic moment, not pairwise.
 *   axes-35/42 pietra/hoover: L_inf Lorenz gap. GE(3) is a global
 *     L1-on-cubic-share moment with no Lorenz reference.
 *   axes-36 atkinson(eps): Atkinson at any epsilon != -2 has no
 *     closed-form bridge to GE(3). The Atkinson-GE bridge identity
 *     A(eps) = 1 - (1 + eps*(eps-1)*GE(eps))^(1/(1-eps)) requires
 *     epsilon = alpha; with alpha=3 this would be Atkinson(eps=3),
 *     which is NOT shipped (only eps=1/2 ships in axis-36).
 *   axis-44 kolm-pollak: CARA / translation-equivariant. GE(3) is
 *     CRRA / scale-equivariant.
 *   axes-39/40 zenga/palma: rank-cut ratio. GE(3) is a global
 *     functional, no rank cut.
 *   axis-41 fgt: lower-tail threshold-anchored. GE(3) is two-sided
 *     and threshold-free.
 *   axes-43/45/47 bonferroni/mehran/s-gini: rank-weighted partial-
 *     mean kernels. GE(3) has no rank kernel.
 *   axes-46/52 wolfson/foster-wolfson: median-anchored polarization.
 *     GE(3) is mean-anchored inequality.
 *   axis-48 chakravarty: parametric concave share-power averaging
 *     (CES utility loss). GE(3) is convex (cubic) and additively
 *     decomposable; chakravarty is concave and not additively
 *     decomposable.
 *   axis-50 amato: Lorenz arc length. GE(3) is not a Lorenz
 *     functional.
 *   axis-51 esteban-ray: pairwise identification-alienation. GE(3)
 *     is a single-point welfare moment.
 *   axis-53 variance-of-logarithms: L2 second central moment of
 *     log y. GE(3) is a cubic-share L1 deviation -- different
 *     functional class.
 *   axis-54 log-mean-absolute-deviation: L1 first absolute central
 *     moment of log y. GE(3) is a cubic-share moment of D, not of
 *     log D.
 *
 *   THE CUBIC-SHARE GE CORNER. Among the prior GE-family daily-token
 *   axes (33/34/37/49/55) the kernel exponents are alpha in
 *   {-1, 0, 1/2, 1, 2}. GE(3) is the unique cubic-share kernel and
 *   the natural next heavy-tail GE point above alpha=2.
 *
 * CLOSED-FORM RELATIONSHIP TO MOMENTS / COEFFICIENT OF VARIATION.
 * Let mu = mean(D), m_3 = (1/n) * sum D_i^3 the raw third moment, and
 * write c_3 = m_3 / mu^3 (a dimensionless cubic-share moment). Then
 *     GE(3) = (c_3 - 1) / 6.
 * In particular for any positive vector with coefficient of variation
 * CV = sigma_D / mu and standardized skewness s = E[((D-mu)/sigma)^3]:
 *     m_3 = mu^3 + 3*mu*sigma^2 + s*sigma^3
 *         = mu^3 * (1 + 3*CV^2 + s*CV^3),
 * giving the EXACT MOMENT DECOMPOSITION
 *     GE(3) = (1/6) * (3*CV^2 + s*CV^3)
 *           = (1/2)*CV^2 + (1/6)*s*CV^3.
 * Compare with the well-known GE(2) = (1/2) * CV^2: GE(3) ADDS the
 * cubic skewness term (1/6)*s*CV^3 on top of GE(2). So the difference
 *     GE(3) - GE(2) = (1/6) * s * CV^3
 * isolates the SKEWNESS-WEIGHTED-BY-CV^3 contribution that GE(2)
 * cannot see -- a per-source heavy-upper-tail diagnostic that is
 * positive iff skewness is positive (right-skewed) and grows with
 * CV^3.
 *
 * CLOSED-FORM PARETO IDENTITY. For a Pareto(alpha) distribution
 * with shape alpha > 3 (so that the third moment exists), with scale
 * x_min = 1,
 *     E[D]   = alpha / (alpha - 1)         (alpha > 1),
 *     E[D^3] = alpha / (alpha - 3)         (alpha > 3),
 * so
 *     m_3 / mu^3 = (alpha / (alpha - 3)) / (alpha / (alpha - 1))^3
 *                = (alpha - 1)^3 / (alpha * (alpha - 3) * (alpha - 1) * ... )
 * which simplifies to
 *     c_3 = (alpha - 1)^3 / (alpha^2 * (alpha - 3))
 *         (algebra: (alpha/(alpha-3)) * ((alpha-1)/alpha)^3
 *                 = (alpha - 1)^3 / (alpha^2 * (alpha - 3))),
 * and
 *     GE(3)(Pareto(alpha)) = ((alpha - 1)^3 / (alpha^2 * (alpha - 3)) - 1) / 6.
 * As alpha -> 3+, GE(3) -> +inf (third moment diverges); as
 * alpha -> +inf, GE(3) -> 0. For alpha = 4, GE(3) =
 * (3^3 / (16 * 1) - 1) / 6 = (27/16 - 1) / 6 = (11/16) / 6 = 11/96 =
 * 0.11458333... For alpha = 5, GE(3) = (64 / (25 * 2) - 1) / 6 =
 * (1.28 - 1) / 6 = 0.046666... These are CLOSED-FORM ANCHORS for the
 * unit tests below.
 *
 * NUMERICAL CAUTION. m_3 / mu^3 = mean((D/mu)^3) involves cube of
 * shares; on heavy-tailed real data a single very large day can
 * dominate the sum. We compute using the SHARE form (D_i/mu)^3
 * directly (Kahan-summed) to avoid cubing raw token counts (which
 * overflows fp on day-totals of 1e9+ tokens cubed). This keeps GE(3)
 * numerically stable on production-scale inputs.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): GE(3) degenerate for n<2; default 4
 *     matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'gethree'): 'gethree' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'cv' | 'ge2'.
 *   - `minGeThree` (>=0): display filter on GE(3). Degenerate rows
 *     always pass.
 *   - `includeMomentDecomposition` (refinement): per-row `cv`,
 *     `skewness`, `ge2`, and `geThreeMinusGeTwo` =
 *     (1/6)*skewness*CV^3 (the closed-form skewness-weighted
 *     diagnostic above).
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only (rows with total_tokens <= 0 are dropped at
 * intake), so per-day totals are strictly positive whenever a day
 * appears in `perDay`. (D_i/mu)^3 is always finite. Days with zero
 * contribution simply do not appear -- the convention used by the
 * rest of the daily-token axis family.
 */
import type { QueueLine } from './types.js';

export type DailyTokenGeThreeIndexSort =
  | 'gethree'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'cv'
  | 'ge2';

export interface DailyTokenGeThreeIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenGeThreeIndexSort;
  /** Display filter: drop rows whose gethree < this value. Default null = no filter. */
  minGeThree?: number | null;
  /** Refinement: surface CV, skewness, GE(2), and the skewness-weighted GE(3)-GE(2) decomposition. */
  includeMomentDecomposition?: boolean;
  generatedAt?: string;
}

export interface DailyTokenGeThreeIndexSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** GE(3) = (1/6) * (mean((D/mu)^3) - 1). In [0, +inf). */
  gethree: number;
  /** mean(D_i). */
  meanDailyTokens: number;
  /** mean((D/mu)^3) = c_3 (dimensionless cubic-share moment). >= 1. */
  cubicShareMean: number;
  /** True iff total = 0 OR n < 2 OR all D_i equal. gethree = 0. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: coefficient of variation sigma_D/mu of the day vector. */
  cv?: number;
  /** Refinement: standardized skewness of the day vector. */
  skewness?: number;
  /** Refinement: GE(2) = (1/2) * CV^2 (closed form). */
  ge2?: number;
  /**
   * Refinement: GE(3) - GE(2) = (1/6) * skewness * CV^3 (the
   * skewness-weighted-by-CV^3 contribution that GE(2) cannot see).
   */
  geThreeMinusGeTwo?: number;
}

export interface DailyTokenGeThreeIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGeThreeIndexSort;
  minGeThree: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinGeThree: number;
  droppedTopSources: number;
  sources: DailyTokenGeThreeIndexSourceRow[];
}

/**
 * Closed-form moment decomposition surfaced as a named export so the
 * audit display cannot drift from the algebra:
 *     GE(3) = (1/2)*CV^2 + (1/6)*skewness*CV^3
 *           = GE(2) + (1/6)*skewness*CV^3.
 * The constant (1/6) is the GE(alpha) prefactor at alpha=3:
 * 1 / (alpha * (alpha - 1)) = 1 / (3 * 2) = 1/6.
 */
export const GE_THREE_PREFACTOR = 1 / 6;

/**
 * GE(3) of a strictly-positive numeric vector.
 *
 *     GE(3) = (1/6) * (mean((D/mu)^3) - 1)
 *           = (1/6) * (m_3 / mu^3 - 1).
 *
 * We compute via the SHARE form (D_i/mu)^3 in Kahan-summed passes
 * (one for mu, one for the cubic-share mean) to avoid cubing raw
 * token counts. Returns degenerate=true with gethree=0 for empty
 * input, n<2, or all-equal input. Throws on negative, zero, or
 * non-finite input. Also returns moment auxiliaries (cv, skewness)
 * for the refinement decomposition GE(3) = GE(2) + (1/6)*s*CV^3.
 */
export function geThreeOfVector(values: number[]): {
  gethree: number;
  mean: number;
  cubicShareMean: number;
  cv: number;
  skewness: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `geThreeOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    return {
      gethree: 0,
      mean: n === 1 ? values[0]! : 0,
      cubicShareMean: n === 1 ? 1 : 0,
      cv: 0,
      skewness: 0,
      total,
      degenerate: true,
    };
  }
  // Pass 1: Kahan-summed mean.
  let sum = 0;
  let cSum = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `geThreeOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    const y = v - cSum;
    const t = sum + y;
    cSum = t - sum - y;
    sum = t;
  }
  const mu = sum / n;
  // Pass 2: Kahan-summed cubic-share moment + central moments for
  // CV and standardized skewness.
  let sumCube = 0;
  let cCube = 0;
  let sumSq = 0; // sum (D - mu)^2
  let cSq = 0;
  let sumCu = 0; // sum (D - mu)^3
  let cCu = 0;
  for (const v of values) {
    const share = v / mu;
    const cube = share * share * share;
    {
      const y = cube - cCube;
      const t = sumCube + y;
      cCube = t - sumCube - y;
      sumCube = t;
    }
    const d = v - mu;
    const dd = d * d;
    {
      const y = dd - cSq;
      const t = sumSq + y;
      cSq = t - sumSq - y;
      sumSq = t;
    }
    const ddd = dd * d;
    {
      const y = ddd - cCu;
      const t = sumCu + y;
      cCu = t - sumCu - y;
      sumCu = t;
    }
  }
  const cubicShareMean = sumCube / n;
  let gethree = (cubicShareMean - 1) / 6;
  if (gethree < 0) gethree = 0; // fp clamp on near-uniform data.
  const variance = sumSq / n;
  const sigma = Math.sqrt(Math.max(0, variance));
  const cv = mu > 0 ? sigma / mu : 0;
  const m3Central = sumCu / n;
  const skewness =
    sigma > 0 ? m3Central / (sigma * sigma * sigma) : 0;
  return {
    gethree,
    mean: mu,
    cubicShareMean,
    cv,
    skewness,
    total: sum,
    degenerate: gethree === 0,
  };
}

export function buildDailyTokenGeThreeIndex(
  queue: QueueLine[],
  opts: DailyTokenGeThreeIndexOptions = {},
): DailyTokenGeThreeIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (GE(3) degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minGeThree = opts.minGeThree ?? null;
  if (
    minGeThree !== null &&
    (!Number.isFinite(minGeThree) || minGeThree < 0)
  ) {
    throw new Error(
      `minGeThree must be a non-negative finite number or null (got ${opts.minGeThree})`,
    );
  }
  const sort: DailyTokenGeThreeIndexSort = opts.sort ?? 'gethree';
  const validSorts: DailyTokenGeThreeIndexSort[] = [
    'gethree',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'cv',
    'ge2',
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
  const rows: DailyTokenGeThreeIndexSourceRow[] = [];

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
    const r = geThreeOfVector(values);
    const row: DailyTokenGeThreeIndexSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      gethree: r.gethree,
      meanDailyTokens: r.mean,
      cubicShareMean: r.cubicShareMean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeMomentDecomposition) {
      row.cv = r.cv;
      row.skewness = r.skewness;
      const ge2 = 0.5 * r.cv * r.cv;
      row.ge2 = ge2;
      row.geThreeMinusGeTwo = (r.skewness * r.cv * r.cv * r.cv) / 6;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinGeThree = 0;
  let filtered = rows;
  if (minGeThree !== null) {
    const next: DailyTokenGeThreeIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.gethree >= minGeThree) next.push(r);
      else droppedBelowMinGeThree += 1;
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
      case 'cv':
        // CV may be undefined unless the refinement is on; fall back
        // to gethree which is a monotone proxy on positive vectors of
        // similar shape.
        primary = (b.cv ?? b.gethree) - (a.cv ?? a.gethree);
        break;
      case 'ge2':
        primary = (b.ge2 ?? b.gethree) - (a.ge2 ?? a.gethree);
        break;
      case 'gethree':
      default:
        primary = b.gethree - a.gethree;
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
    minGeThree,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinGeThree,
    droppedTopSources,
    sources: kept,
  };
}
