/**
 * daily-token-ge-four-index: per-source GENERALIZED ENTROPY index at
 * parameter alpha = 4 (GE(4)) of the per-day total_tokens
 * distribution. FIFTY-SEVENTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the alpha=4 member
 * of the generalised-entropy family:
 *
 *     GE(alpha) = (1 / (alpha*(alpha-1)*n)) * sum_i [ (D_i/mu)^alpha - 1 ]
 *     GE(4)     = (1 / (4*3*n)) * sum_i [ (D_i/mu)^4 - 1 ]
 *               = (1/12) * ( (1/n) * sum_i (D_i/mu)^4 - 1 )
 *               = (1/12) * ( m_4(D) / mu^4 - 1 ),
 *     where m_4(D) = (1/n) * sum_i D_i^4 is the raw fourth moment of D.
 *
 *   GE(4) is the unique QUARTIC-SHARE member of the GE family. Each
 *   daily share is raised to the FOURTH power before averaging, so
 *   the contribution of the largest day to the index grows with the
 *   fourth power of its share -- the natural next heavy-tail GE point
 *   above alpha=3 (the cubic-share kernel just shipped as axis-56).
 *   Range: [0, +inf); GE(4) = 0 iff perfect equality (Jensen on the
 *   convex x^4). Larger GE(4) = more quartic-share dispersion of
 *   daily-token mass, even more dominated by the heaviest day than
 *   GE(3) is.
 *
 *   Headline question:
 *   **"After we raise each day's share of total token mass to the
 *     FOURTH power, how much does the resulting average exceed the
 *     equal-share baseline for each source?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-56):
 *
 *   axes-33/34/37/49/55/56 GE family: Theil-L = GE(0), Theil-T = GE(1),
 *     GE(2), GE(-1), GE(1/2), GE(3). All shipped GE alphas live in
 *     {-1, 0, 1/2, 1, 2, 3}; alpha=4 is the unique quartic-share
 *     kernel and the next standard heavy-tail point above GE(3).
 *     Closed-form audit on lognormal (log Y ~ N(m, sigma^2)):
 *       GE(k)(lognormal) = (exp((k^2 - k)/2 * sigma^2) - 1)
 *                        / (k * (k - 1)),
 *     so GE(4) = (exp(6*sigma^2) - 1)/12 vs GE(3) =
 *     (exp(3*sigma^2) - 1)/6, and GE(4)/GE(3) =
 *     (exp(6*sigma^2) - 1) / (2 * (exp(3*sigma^2) - 1)) -> 1 as
 *     sigma -> 0 and -> +inf super-exponentially as sigma -> +inf.
 *     So GE(4) and GE(3) cannot rank lognormal sources identically
 *     when sigma differs across sources.
 *   axis-32 Gini, axes-35/42 pietra/hoover, axis-36 atkinson(eps),
 *     axis-44 kolm-pollak, axes-39/40 zenga/palma, axis-41 fgt,
 *     axes-43/45/47 bonferroni/mehran/s-gini, axes-46/52 wolfson/
 *     foster-wolfson, axis-48 chakravarty, axis-50 amato, axis-51
 *     esteban-ray, axis-53 variance-of-logs, axis-54 log-MAD: all
 *     belong to non-GE functional classes (pairwise / Lorenz /
 *     CARA / rank-cut / median-anchored / log-domain). GE(4) is a
 *     pure cubic+quartic power-share moment; it cannot be reduced
 *     to any of those.
 *
 *   THE QUARTIC-SHARE GE CORNER. Among the prior GE-family daily-token
 *   axes (33/34/37/49/55/56) the kernel exponents are alpha in
 *   {-1, 0, 1/2, 1, 2, 3}. GE(4) is the unique quartic-share kernel
 *   and the natural next heavy-tail GE point above alpha=3.
 *
 * CLOSED-FORM RELATIONSHIP TO MOMENTS / COEFFICIENT OF VARIATION.
 * Let mu = mean(D), CV = sigma_D / mu, s = standardized skewness, and
 * k = standardized kurtosis (raw, NOT excess, so k = 3 for a normal).
 * Expanding (D - mu + mu)^4:
 *     E[D^4] = mu^4 + 6*mu^2*sigma^2 + 4*mu*m_3c + m_4c
 *            = mu^4 * (1 + 6*CV^2 + 4*s*CV^3 + k*CV^4),
 * where m_3c, m_4c are the central 3rd and 4th moments. Therefore
 *     c_4 = m_4 / mu^4 = 1 + 6*CV^2 + 4*s*CV^3 + k*CV^4,
 * and the EXACT MOMENT DECOMPOSITION is
 *     GE(4) = (c_4 - 1) / 12
 *           = (1/2)*CV^2 + (1/3)*s*CV^3 + (1/12)*k*CV^4.
 * Compare with GE(2) = (1/2)*CV^2 and GE(3) = (1/2)*CV^2 +
 * (1/6)*s*CV^3 (closed form from axis-56). Then
 *     GE(4) - GE(2) = (1/3)*s*CV^3 + (1/12)*k*CV^4,
 *     GE(4) - GE(3) = (1/6)*s*CV^3 + (1/12)*k*CV^4.
 * GE(4) - GE(3) isolates the SECOND HALF of the skewness contribution
 * PLUS the KURTOSIS-WEIGHTED-BY-CV^4 term that NEITHER GE(2) NOR
 * GE(3) can see -- a per-source heavy-upper-tail diagnostic that is
 * positive iff k > 0 (always true; raw kurtosis >= 1 by Jensen on
 * x^2) AND grows with CV^4.
 *
 * CLOSED-FORM PARETO IDENTITY. For a Pareto(alpha) distribution with
 * shape alpha > 4 (so that the fourth moment exists), with scale
 * x_min = 1,
 *     E[D]   = alpha / (alpha - 1)         (alpha > 1),
 *     E[D^4] = alpha / (alpha - 4)         (alpha > 4),
 * so
 *     c_4 = (alpha - 1)^4 / (alpha^3 * (alpha - 4))
 *         (algebra: (alpha/(alpha-4)) * ((alpha-1)/alpha)^4
 *                 = (alpha - 1)^4 / (alpha^3 * (alpha - 4))),
 * and
 *     GE(4)(Pareto(alpha)) =
 *         ((alpha - 1)^4 / (alpha^3 * (alpha - 4)) - 1) / 12.
 * As alpha -> 4+, GE(4) -> +inf (fourth moment diverges); as
 * alpha -> +inf, GE(4) -> 0. For alpha = 5, GE(4) =
 * (4^4 / (125 * 1) - 1) / 12 = (256/125 - 1) / 12 = (131/125) / 12
 * = 131/1500 = 0.08733333... For alpha = 6, GE(4) =
 * (5^4 / (216 * 2) - 1) / 12 = (625/432 - 1) / 12 = (193/432) / 12
 * = 193/5184 = 0.03723... These are CLOSED-FORM ANCHORS for the
 * unit tests below.
 *
 * NUMERICAL CAUTION. m_4 / mu^4 = mean((D/mu)^4) involves quartic
 * shares; on heavy-tailed real data a single very large day can
 * dominate the sum even more strongly than at alpha=3. We compute
 * using the SHARE form (D_i/mu)^4 directly (Kahan-summed) to avoid
 * raising raw token counts to the fourth power (which overflows fp
 * on day-totals of ~1e8+ tokens to the fourth = ~1e32, well within
 * fp64 range but precision-degrading; raw 1e9^4 = 1e36 is still
 * safe but the share form is uniformly bounded by O(n^4) and far
 * more numerically stable). This keeps GE(4) numerically stable on
 * production-scale inputs.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): GE(4) degenerate for n<2; default 4
 *     matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'gefour'): 'gefour' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'cv' | 'ge3'.
 *   - `minGeFour` (>=0): display filter on GE(4). Degenerate rows
 *     always pass.
 *   - `includeMomentDecomposition` (refinement): per-row `cv`,
 *     `skewness`, `kurtosis`, `ge2` (= (1/2)*CV^2), `ge3`
 *     (= GE(2) + (1/6)*s*CV^3), and `geFourMinusGeThree`
 *     (= (1/6)*s*CV^3 + (1/12)*k*CV^4 = GE(4) - GE(3) by closed
 *     form).
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only (rows with total_tokens <= 0 are dropped at
 * intake), so per-day totals are strictly positive whenever a day
 * appears in `perDay`. (D_i/mu)^4 is always finite. Days with zero
 * contribution simply do not appear -- the convention used by the
 * rest of the daily-token axis family.
 */
import type { QueueLine } from './types.js';

export type DailyTokenGeFourIndexSort =
  | 'gefour'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'cv'
  | 'ge3';

export interface DailyTokenGeFourIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenGeFourIndexSort;
  /** Display filter: drop rows whose gefour < this value. Default null = no filter. */
  minGeFour?: number | null;
  /** Refinement: surface CV, skewness, kurtosis, GE(2), GE(3), and the GE(4)-GE(3) closed-form decomposition. */
  includeMomentDecomposition?: boolean;
  generatedAt?: string;
}

export interface DailyTokenGeFourIndexSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** GE(4) = (1/12) * (mean((D/mu)^4) - 1). In [0, +inf). */
  gefour: number;
  /** mean(D_i). */
  meanDailyTokens: number;
  /** mean((D/mu)^4) = c_4 (dimensionless quartic-share moment). >= 1. */
  quarticShareMean: number;
  /** True iff total = 0 OR n < 2 OR all D_i equal. gefour = 0. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: coefficient of variation sigma_D/mu of the day vector. */
  cv?: number;
  /** Refinement: standardized skewness of the day vector. */
  skewness?: number;
  /** Refinement: standardized kurtosis (raw, NOT excess; raw kurtosis = 3 for normal) of the day vector. */
  kurtosis?: number;
  /** Refinement: GE(2) = (1/2) * CV^2 (closed form). */
  ge2?: number;
  /** Refinement: GE(3) = GE(2) + (1/6) * skewness * CV^3 (closed form). */
  ge3?: number;
  /**
   * Refinement: GE(4) - GE(3) = (1/6) * skewness * CV^3 +
   * (1/12) * kurtosis * CV^4 (the second-half-skewness +
   * kurtosis-weighted contribution that GE(3) cannot fully see).
   */
  geFourMinusGeThree?: number;
}

export interface DailyTokenGeFourIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGeFourIndexSort;
  minGeFour: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinGeFour: number;
  droppedTopSources: number;
  sources: DailyTokenGeFourIndexSourceRow[];
}

/**
 * Closed-form moment decomposition surfaced as a named export so the
 * audit display cannot drift from the algebra:
 *     GE(4) = (1/2)*CV^2 + (1/3)*skewness*CV^3 + (1/12)*kurtosis*CV^4
 *           = GE(2) + (1/3)*s*CV^3 + (1/12)*k*CV^4
 *           = GE(3) + (1/6)*s*CV^3 + (1/12)*k*CV^4.
 * The constant (1/12) is the GE(alpha) prefactor at alpha=4:
 * 1 / (alpha * (alpha - 1)) = 1 / (4 * 3) = 1/12.
 */
export const GE_FOUR_PREFACTOR = 1 / 12;

/**
 * GE(4) of a strictly-positive numeric vector.
 *
 *     GE(4) = (1/12) * (mean((D/mu)^4) - 1)
 *           = (1/12) * (m_4 / mu^4 - 1).
 *
 * We compute via the SHARE form (D_i/mu)^4 in Kahan-summed passes
 * (one for mu, one for the quartic-share mean and central moments).
 * Returns degenerate=true with gefour=0 for empty input, n<2, or
 * all-equal input. Throws on negative, zero, or non-finite input.
 * Also returns moment auxiliaries (cv, skewness, kurtosis) for the
 * refinement decomposition.
 */
export function geFourOfVector(values: number[]): {
  gefour: number;
  mean: number;
  quarticShareMean: number;
  cv: number;
  skewness: number;
  kurtosis: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `geFourOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    return {
      gefour: 0,
      mean: n === 1 ? values[0]! : 0,
      quarticShareMean: n === 1 ? 1 : 0,
      cv: 0,
      skewness: 0,
      kurtosis: 0,
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
        `geFourOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    const y = v - cSum;
    const t = sum + y;
    cSum = t - sum - y;
    sum = t;
  }
  const mu = sum / n;
  // Pass 2: Kahan-summed quartic-share moment + central moments for
  // CV, standardized skewness, and standardized kurtosis.
  let sumQuart = 0;
  let cQuart = 0;
  let sumSq = 0; // sum (D - mu)^2
  let cSq = 0;
  let sumCu = 0; // sum (D - mu)^3
  let cCu = 0;
  let sumQu = 0; // sum (D - mu)^4
  let cQu = 0;
  for (const v of values) {
    const share = v / mu;
    const sq = share * share;
    const quart = sq * sq;
    {
      const y = quart - cQuart;
      const t = sumQuart + y;
      cQuart = t - sumQuart - y;
      sumQuart = t;
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
    const dddd = dd * dd;
    {
      const y = dddd - cQu;
      const t = sumQu + y;
      cQu = t - sumQu - y;
      sumQu = t;
    }
  }
  const quarticShareMean = sumQuart / n;
  let gefour = (quarticShareMean - 1) / 12;
  if (gefour < 0) gefour = 0; // fp clamp on near-uniform data.
  const variance = sumSq / n;
  const sigma = Math.sqrt(Math.max(0, variance));
  const cv = mu > 0 ? sigma / mu : 0;
  const m3Central = sumCu / n;
  const m4Central = sumQu / n;
  const skewness =
    sigma > 0 ? m3Central / (sigma * sigma * sigma) : 0;
  const kurtosis =
    sigma > 0 ? m4Central / (sigma * sigma * sigma * sigma) : 0;
  return {
    gefour,
    mean: mu,
    quarticShareMean,
    cv,
    skewness,
    kurtosis,
    total: sum,
    degenerate: gefour === 0,
  };
}

export function buildDailyTokenGeFourIndex(
  queue: QueueLine[],
  opts: DailyTokenGeFourIndexOptions = {},
): DailyTokenGeFourIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (GE(4) degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minGeFour = opts.minGeFour ?? null;
  if (
    minGeFour !== null &&
    (!Number.isFinite(minGeFour) || minGeFour < 0)
  ) {
    throw new Error(
      `minGeFour must be a non-negative finite number or null (got ${opts.minGeFour})`,
    );
  }
  const sort: DailyTokenGeFourIndexSort = opts.sort ?? 'gefour';
  const validSorts: DailyTokenGeFourIndexSort[] = [
    'gefour',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'cv',
    'ge3',
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
  const rows: DailyTokenGeFourIndexSourceRow[] = [];

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
    const r = geFourOfVector(values);
    const row: DailyTokenGeFourIndexSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      gefour: r.gefour,
      meanDailyTokens: r.mean,
      quarticShareMean: r.quarticShareMean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeMomentDecomposition) {
      row.cv = r.cv;
      row.skewness = r.skewness;
      row.kurtosis = r.kurtosis;
      const ge2 = 0.5 * r.cv * r.cv;
      const ge3 = ge2 + (r.skewness * r.cv * r.cv * r.cv) / 6;
      row.ge2 = ge2;
      row.ge3 = ge3;
      row.geFourMinusGeThree =
        (r.skewness * r.cv * r.cv * r.cv) / 6 +
        (r.kurtosis * r.cv * r.cv * r.cv * r.cv) / 12;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinGeFour = 0;
  let filtered = rows;
  if (minGeFour !== null) {
    const next: DailyTokenGeFourIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.gefour >= minGeFour) next.push(r);
      else droppedBelowMinGeFour += 1;
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
        // to gefour which is a monotone proxy on positive vectors of
        // similar shape.
        primary = (b.cv ?? b.gefour) - (a.cv ?? a.gefour);
        break;
      case 'ge3':
        primary = (b.ge3 ?? b.gefour) - (a.ge3 ?? a.gefour);
        break;
      case 'gefour':
      default:
        primary = b.gefour - a.gefour;
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
    minGeFour,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinGeFour,
    droppedTopSources,
    sources: kept,
  };
}
