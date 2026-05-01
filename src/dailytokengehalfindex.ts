/**
 * daily-token-ge-half-index: per-source GENERALIZED ENTROPY index at
 * parameter alpha = 1/2 (GE(1/2)) of the per-day total_tokens
 * distribution. FIFTY-FIFTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the half-power
 * member of the generalised-entropy family:
 *
 *     GE(alpha)   = (1 / (alpha*(alpha-1)*n)) * sum_i [ (D_i/mu)^alpha - 1 ]
 *     GE(1/2)     = (1 / ((1/2)*(-1/2)*n)) * sum_i [ sqrt(D_i/mu) - 1 ]
 *                = -4 * (1/n) * sum_i [ sqrt(D_i/mu) - 1 ]
 *                =  4 * (1 - (1/n) * sum_i sqrt(D_i/mu))
 *                =  4 * (1 - sqrt(M_{1/2}(D) / mu)),
 *     where M_{1/2}(D) = ((1/n) * sum sqrt(D_i))^2 is the POWER MEAN
 *     of order 1/2 of D.
 *
 *   The last equality is the working form: write meanSqrt = (1/n)*sum
 *   sqrt(D_i), so M_{1/2}(D) = meanSqrt^2 and (1/n)*sum sqrt(D_i/mu)
 *   = meanSqrt / sqrt(mu) = sqrt(M_{1/2}(D)/mu).
 *
 *   GE(1/2) is the unique HALF-POWER member of the GE family;
 *   alpha = 1/2 is the unique value at which the GE-kernel is the
 *   SQUARE-ROOT TRANSFORM of share, midway (in the Box-Cox sense)
 *   between alpha=0 (log) and alpha=1 (identity).
 *   Range: [0, +inf); GE(1/2) = 0 iff perfect equality (Jensen on
 *   the concave sqrt). Larger GE(1/2) = more sqrt-share dispersion
 *   of daily-token mass.
 *
 *   Headline question:
 *   **"How far is the SQUARE-ROOT-share mean of daily token mass from
 *     the linear mean for each source?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-54):
 *
 *   axes-33/34/37/49 GE family: Theil-L = GE(0), Theil-T = GE(1),
 *     GE(2), GE(-1). All other GE alphas are present EXCEPT alpha=1/2
 *     -- the unique sqrt-share kernel. GE(0) reads log(mu)-mean(log y);
 *     GE(1) reads share-weighted log share; GE(2) reads squared share
 *     deviations; GE(-1) reads reciprocal share deviations. NONE of
 *     them read the sqrt-share kernel, which is the unique kernel
 *     midway in Box-Cox between log (alpha=0) and identity (alpha=1).
 *   axis-32 Gini: pairwise mean-absolute-difference / 2mu. GE(1/2) is
 *     a single-point welfare functional, not pairwise.
 *   axes-35/42 pietra/hoover: L_inf Lorenz gap. GE(1/2) is a global
 *     L1-on-sqrt-share moment.
 *   axis-36 atkinson(eps=0.5): Atkinson at epsilon=1/2 is
 *     1 - M_{1/2}(D)/mu (equivalently 1 - (meanSqrt^2)/mu). The
 *     functional bridge to GE(1/2) is
 *         GE(1/2) = 4 * (1 - sqrt(1 - Atkinson(eps=1/2))),
 *       i.e. Atkinson(eps=1/2) = 1 - (1 - GE(1/2)/4)^2.
 *     The two are MONOTONE in each other (both shrink to 0 with
 *     equality, both grow under spreads), so on the SHIPPED
 *     atkinson(0.5) the rank order coincides with GE(1/2). The
 *     mapping is NOT linear -- the GE(1/2)/Atk(1/2) ratio
 *     interpolates from 2 (near equality) to 4 (extreme dispersion),
 *     so the two scalars carry different SCALE information even when
 *     ranks match. Non-degeneracy vs axis-36 comes from
 *     atkinson being a PARAMETRIC family on epsilon: at any
 *     eps != 1/2 the rank order diverges.
 *   axis-44 kolm-pollak: CARA / translation-equivariant. GE(1/2) is
 *     CRRA / scale-equivariant.
 *   axes-39/40 zenga/palma: rank-cut ratio. GE(1/2) is a global
 *     functional, no rank cut.
 *   axis-41 fgt: lower-tail threshold-anchored. GE(1/2) is two-sided
 *     and threshold-free.
 *   axes-43/45/47 bonferroni/mehran/s-gini: rank-weighted partial-
 *     mean kernels. GE(1/2) has no rank kernel.
 *   axes-46/52 wolfson/foster-wolfson: median-anchored polarization.
 *     GE(1/2) is mean-anchored inequality.
 *   axis-48 chakravarty: parametric concave share-power averaging
 *     (CES utility loss). GE(1/2) is an additive-decomposable scalar
 *     (chakravarty is not).
 *   axis-50 amato: Lorenz arc length. GE(1/2) is not a Lorenz
 *     functional.
 *   axis-51 esteban-ray: pairwise identification-alienation. GE(1/2)
 *     is a single-point welfare moment.
 *   axis-53 variance-of-logarithms: L2 second central moment of
 *     log y. GE(1/2) is a sqrt-share L1 deviation.
 *   axis-54 log-mean-absolute-deviation: L1 first absolute central
 *     moment of log y. GE(1/2) is a sqrt-share L1 deviation -- a
 *     DIFFERENT Box-Cox exponent (0 vs 1/2).
 *
 *   THE SQRT-SHARE GE CORNER. Among the prior GE-family daily-token
 *   axes (33/34/37/49) the kernel exponents are alpha in
 *   {0, 1, 2, -1}. GE(1/2) is the unique half-power kernel, and the
 *   ONLY GE alpha at which the underlying transform is the square
 *   root.
 *
 * CLOSED-FORM AUDIT vs axis-36 ATKINSON(eps=1/2). For ANY positive
 * vector,
 *     Atkinson(eps=1/2)(D) = 1 - M_{1/2}(D) / mu,
 *     GE(1/2)(D)           = 4 * (1 - sqrt(M_{1/2}(D) / mu))
 *                          = 4 * (1 - sqrt(1 - Atkinson(eps=1/2)(D))).
 * Equivalently
 *     Atkinson(eps=1/2)(D) = 1 - (1 - GE(1/2)(D)/4)^2,
 * and
 *     GE(1/2) / Atkinson(eps=1/2) = 4 / (1 + sqrt(1 - Atk(1/2)))
 *                                  in [2, 4),
 * approaching 2 as the vector approaches equality and approaching 4
 * as the vector approaches a one-source spike. The audit pair
 * (gehalf, atkHalf) carries one redundant scalar (per-source
 * residual abs(GE(1/2) - 4*(1 - sqrt(1 - atkHalf))) detects
 * implementation drift between the two axes) and one informative
 * scalar (the GE(1/2)/atkHalf ratio is a per-source DISPERSION-
 * REGIME diagnostic: closer to 2 = near-equality, closer to 4 =
 * heavy-tail dominated).
 *
 * NON-DEGENERACY WITNESS vs axes 33/34/37/49 (other GE alphas): for
 * lognormal log y ~ N(m, sigma^2), GE(alpha) =
 * (exp(alpha*(alpha-1)*sigma^2/2) - 1) / (alpha*(alpha-1)). At
 * alpha=1/2 this is GE(1/2) = 4*(1 - exp(-sigma^2/8)). The ratio
 *     GE(1/2) / GE(2)  =  4*(1 - exp(-sigma^2/8)) / ((exp(sigma^2) - 1)/2)
 *                      =  8*(1 - exp(-sigma^2/8)) / (exp(sigma^2) - 1)
 * is a non-trivial function of sigma -- approaches 1 as sigma -> 0,
 * approaches 0 as sigma -> +inf. So GE(1/2) and GE(2) rank lognormal
 * sources differently when sigma differs across sources, and the
 * GE(1/2)/GE(2) ratio is itself a per-source HEAVY-TAILEDNESS audit
 * (smaller ratio = heavier upper tail).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): GE(1/2) degenerate for n<2; default 4
 *     matches the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'gehalf'): 'gehalf' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'sqrtMeanDaily' | 'atk'.
 *   - `minGeHalf` (>=0): display filter on GE(1/2). Degenerate rows
 *     always pass.
 *   - `includeAtkAnchor` (refinement): per-row `atkHalf`
 *     = 1 - M_{1/2}/mu (= GE(1/2)/4), and `geHalfOverAtkHalf` = 4
 *     identity check.
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only (rows with total_tokens <= 0 are dropped at
 * intake), so per-day totals are strictly positive whenever a day
 * appears in `perDay`. sqrt(D_i) is always finite. Days with zero
 * contribution simply do not appear -- the convention used by the
 * rest of the daily-token axis family.
 */
import type { QueueLine } from './types.js';

export type DailyTokenGeHalfIndexSort =
  | 'gehalf'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'sqrtMeanDaily'
  | 'atk';

export interface DailyTokenGeHalfIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenGeHalfIndexSort;
  /** Display filter: drop rows whose gehalf < this value. Default null = no filter. */
  minGeHalf?: number | null;
  /** Refinement: surface atkHalf = GE(1/2)/4 and the GE(1/2)/atkHalf identity check. */
  includeAtkAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenGeHalfIndexSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** GE(1/2) = 4 * (1 - M_{1/2}/mu). In [0, +inf). */
  gehalf: number;
  /** mean(D_i). */
  meanDailyTokens: number;
  /** Power mean of order 1/2 of D = ((1/n) sum sqrt(D_i))^2. */
  sqrtMeanDaily: number;
  /** True iff total = 0 OR n < 2 OR all D_i equal. gehalf = 0. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: Atkinson(eps=1/2) = 1 - M_{1/2}/mu. */
  atkHalf?: number;
  /** Refinement: gehalf / atkHalf. In [2, 4) for non-degenerate inputs. */
  geHalfOverAtkHalf?: number;
  /** Refinement: gehalf - 4*(1 - sqrt(1 - atkHalf)); ~0 to fp by construction. */
  geHalfBridgeResidual?: number;
}

export interface DailyTokenGeHalfIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenGeHalfIndexSort;
  minGeHalf: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinGeHalf: number;
  droppedTopSources: number;
  sources: DailyTokenGeHalfIndexSourceRow[];
}

/**
 * Closed-form bridge between GE(1/2) and Atkinson(eps=1/2):
 *     GE(1/2) = 4 * (1 - sqrt(1 - Atkinson(eps=1/2))),
 *     Atkinson(eps=1/2) = 1 - (1 - GE(1/2)/4)^2.
 * The ratio GE(1/2)/Atkinson(eps=1/2) = 4 / (1 + sqrt(1 - Atk(1/2)))
 * lives in [2, 4): -> 2 near equality, -> 4 in the heavy-tail
 * limit. Surface as a named export so the audit display cannot drift
 * from the algebra.
 */
export const GE_HALF_ATK_HALF_RATIO_LIMITS = { atEquality: 2, atSpike: 4 };

/**
 * GE(1/2) of a strictly-positive numeric vector.
 *
 *     GE(1/2) = 4 * (1 - M_{1/2}(D) / mean(D)),
 *     where M_{1/2}(D) = ((1/n) * sum sqrt(D_i))^2 is the power mean
 *     of order 1/2.
 *
 * Numerically stable: computes mean and mean-of-sqrt in a single
 * Kahan-summed pass each. Returns degenerate=true with gehalf=0 for
 * empty input, n<2, or all-equal input. Throws on negative, zero,
 * or non-finite input.
 */
export function geHalfOfVector(values: number[]): {
  gehalf: number;
  mean: number;
  sqrtMean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `geHalfOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    return {
      gehalf: 0,
      mean: n === 1 ? values[0]! : 0,
      sqrtMean: n === 1 ? values[0]! : 0,
      total,
      degenerate: true,
    };
  }
  // Kahan-summed total + sum of sqrt.
  let sum = 0;
  let cSum = 0;
  let sumSqrt = 0;
  let cSqrt = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `geHalfOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    {
      const y = v - cSum;
      const t = sum + y;
      cSum = t - sum - y;
      sum = t;
    }
    const sq = Math.sqrt(v);
    {
      const y = sq - cSqrt;
      const t = sumSqrt + y;
      cSqrt = t - sumSqrt - y;
      sumSqrt = t;
    }
  }
  const mu = sum / n;
  const meanSqrt = sumSqrt / n;
  const sqrtMean = meanSqrt * meanSqrt; // M_{1/2}(D) = (mean(sqrt))^2.
  // GE(1/2) = 4 * (1 - (1/n) sum sqrt(D_i/mu))
  //        = 4 * (1 - meanSqrt / sqrt(mu))
  //        = 4 * (1 - sqrt(M_{1/2}(D) / mu))
  // since (1/n) sum sqrt(D_i/mu) = meanSqrt/sqrt(mu) and
  // M_{1/2}(D) = meanSqrt^2 so sqrt(M_{1/2}/mu) = meanSqrt/sqrt(mu).
  // By Cauchy-Schwarz / Jensen on the concave sqrt, meanSqrt <=
  // sqrt(mu), so GE(1/2) >= 0; equality iff all D_i equal.
  let gehalf = 4 * (1 - meanSqrt / Math.sqrt(mu));
  if (gehalf < 0) gehalf = 0; // Kahan / fp clamp on near-uniform data.
  return {
    gehalf,
    mean: mu,
    sqrtMean,
    total: sum,
    degenerate: gehalf === 0,
  };
}

export function buildDailyTokenGeHalfIndex(
  queue: QueueLine[],
  opts: DailyTokenGeHalfIndexOptions = {},
): DailyTokenGeHalfIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (GE(1/2) degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minGeHalf = opts.minGeHalf ?? null;
  if (minGeHalf !== null && (!Number.isFinite(minGeHalf) || minGeHalf < 0)) {
    throw new Error(
      `minGeHalf must be a non-negative finite number or null (got ${opts.minGeHalf})`,
    );
  }
  const sort: DailyTokenGeHalfIndexSort = opts.sort ?? 'gehalf';
  const validSorts: DailyTokenGeHalfIndexSort[] = [
    'gehalf',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'sqrtMeanDaily',
    'atk',
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
  const rows: DailyTokenGeHalfIndexSourceRow[] = [];

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
    const r = geHalfOfVector(values);
    const row: DailyTokenGeHalfIndexSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      gehalf: r.gehalf,
      meanDailyTokens: r.mean,
      sqrtMeanDaily: r.sqrtMean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeAtkAnchor) {
      // atkHalf = 1 - M_{1/2}/mu = 1 - sqrtMean/mu (M_{1/2} = sqrtMean).
      const atkHalf = r.mean > 0 ? 1 - r.sqrtMean / r.mean : 0;
      row.atkHalf = atkHalf;
      // Functional bridge audit: the residual must be ~0 to fp.
      const expectedFromAtk = 4 * (1 - Math.sqrt(Math.max(0, 1 - atkHalf)));
      row.geHalfBridgeResidual = r.gehalf - expectedFromAtk;
      row.geHalfOverAtkHalf =
        atkHalf > 1e-15 ? r.gehalf / atkHalf : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinGeHalf = 0;
  let filtered = rows;
  if (minGeHalf !== null) {
    const next: DailyTokenGeHalfIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.gehalf >= minGeHalf) next.push(r);
      else droppedBelowMinGeHalf += 1;
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
      case 'sqrtMeanDaily':
        primary = b.sqrtMeanDaily - a.sqrtMeanDaily;
        break;
      case 'atk':
        primary = b.gehalf - a.gehalf; // atk = gehalf/4, monotone.
        break;
      case 'gehalf':
      default:
        primary = b.gehalf - a.gehalf;
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
    minGeHalf,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinGeHalf,
    droppedTopSources,
    sources: kept,
  };
}
