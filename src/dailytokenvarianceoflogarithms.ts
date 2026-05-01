/**
 * daily-token-variance-of-logarithms: per-source VARIANCE OF
 * LOGARITHMS (log-variance) of the per-day total_tokens distribution.
 * FIFTY-THIRD cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the variance of
 * logarithms (Aitchison & Brown 1957, "The Lognormal Distribution",
 * CUP; Sen 1973, "On Economic Inequality", OUP, ch.2.5):
 *
 *     VL = (1/n) * sum_i ( log(D_i) - mean_j log(D_j) )^2
 *
 *   i.e. the SECOND CENTRAL MOMENT of the LOGARITHMS of the daily
 *   token mass. VL is dimensionless, anchored at the GEOMETRIC MEAN
 *   (because the within-log mean is log(GeoMean)), and it operates
 *   on a LOG-SCALE -- doubling every D_i leaves VL unchanged
 *   (translation in log-space is scale-invariance in token-space).
 *
 *   Range: [0, +inf). VL = 0 iff all D_i are equal (perfect
 *   equality). Larger VL = more spread of the daily-token mass on a
 *   multiplicative scale.
 *
 *   Headline question:
 *   **"On a LOG scale, how spread out is each source's daily token
 *     mass around its OWN geometric mean?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-52):
 *
 *   axis-32 daily-token-gini-coefficient: Gini = (1/(2*n^2*mu)) *
 *     sum_i sum_j |y_i - y_j|. Linear-scale, mean-anchored, L1
 *     pairwise-distance functional. VL is LOG-scale, geometric-mean-
 *     anchored, L2 deviation-from-log-mean functional.
 *   axis-33 daily-token-theil-l-index (MLD, GE(0)):
 *     L = log(mu) - mean(log y) = log(mu / GeoMean).
 *     Both VL and GE(0) live in log-space and share GeoMean as a
 *     reference but they read DIFFERENT moments of log y:
 *       - GE(0) is the GAP between log(arithmetic mean) and the
 *         arithmetic mean of log y. It is a FIRST-MOMENT functional
 *         in the log shift.
 *       - VL is the SECOND CENTRAL MOMENT of log y itself.
 *     For a LOGNORMAL distribution log y ~ N(m, sigma^2) we have
 *     the closed-form identities
 *         GE(0) = sigma^2 / 2,    VL = sigma^2,
 *     i.e. VL = 2 * GE(0) FOR LOGNORMAL ONLY. For non-lognormal
 *     vectors the two functionals decouple: rankings can flip and
 *     the ratio VL / (2*GE(0)) is NOT identically 1.
 *   axis-34 daily-token-theil-t-index (Theil-T, GE(1)): share-
 *     weighted log share, read at alpha=1 in the GE family. VL is
 *     not a GE-family member.
 *   axis-37 daily-token-ge2-index (GE(2), half coefficient of
 *     variation squared): linear-scale moment of shares. VL is
 *     log-scale.
 *   axis-49 daily-token-genentropy-negone-index (GE(-1)): a
 *     reciprocal-share log functional. VL is a centred second
 *     moment of log y, not a share functional.
 *   axis-35 pietra / axis-42 hoover: single-point L_inf Lorenz gaps
 *     at the MEAN-rank cut, dimensionless and linear-scale. VL is
 *     a global L2 log-spread, no Lorenz reading.
 *   axis-36 atkinson / axis-44 kolm-pollak: CRRA / CARA welfare-
 *     equivalent loss functionals. VL is not a welfare functional.
 *   axis-39 zenga: lower-mean / upper-mean ratio, linear-scale,
 *     dimensionless. VL is a single log-scale L2 statistic.
 *   axis-40 palma: top-decile / bottom-four-decile ratio. Linear-
 *     scale rank-cut ratio. VL is a global second log-moment.
 *   axis-41 fgt: one-sided lower-tail threshold-anchored functional.
 *     VL is two-sided, threshold-FREE, and operates on log y.
 *   axes-43/45/47 bonferroni / mehran / s-gini: rank-weighted
 *     PARTIAL-MEAN kernels in linear space. VL is log-scale and
 *     unweighted.
 *   axis-46 wolfson / axis-52 foster-wolfson: median-anchored
 *     polarization. VL is geometric-mean-anchored DISPERSION (not a
 *     polarization measure -- VL is a Pigou-Dalton-violating
 *     functional, see Cowell 2011 "Measuring Inequality" sec.4.4
 *     for the well-known caveat).
 *   axis-48 chakravarty: parametric concave share-power averaging.
 *     VL has no power exponent and works on log y, not shares.
 *   axis-50 amato: Lorenz-curve ARC LENGTH. VL is not a Lorenz
 *     functional at all.
 *   axis-51 esteban-ray: pairwise identification-alienation
 *     polarization. VL is a single second moment, no pairwise sum.
 *
 *   THE LOG-SCALE CORNER. Among the prior 21 daily-token axes
 *   (32-52), only the GE family (axes 33/34/37/49) reads y on the
 *   logarithmic axis at all, and even those read it through a
 *   single first-order log shift (GE(0) = log mu - mean log y) or
 *   through linear-share moments (GE(1), GE(2), GE(-1)). VL is
 *   the only axis that exposes the SECOND CENTRAL MOMENT of log y
 *   directly. The closed-form audit VL == 2 * GE(0) holds for
 *   lognormal y and FAILS otherwise, so we can detect non-
 *   lognormality of each source's daily-token distribution by
 *   reading abs(VL - 2 * GE(0)) on the same vector.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): VL degenerate for n<2; default 4
 *     matches the rest of the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'vl'): 'vl' | 'tokens' | 'days' | 'source' |
 *     'meanDaily' | 'geoMeanDaily' | 'meanLog'.
 *   - `minVl` (>=0): display filter on VL. Degenerate rows always
 *     pass.
 *   - `includeGe0Anchor` (refinement): per-row `theilL` (GE(0) /
 *     MLD on the same vector) and `vlOverTwoGe0` ratio. The
 *     closed-form identity VL == 2 * GE(0) holds iff log y is
 *     normal; we surface the residual as the lognormality audit.
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only (rows with total_tokens <= 0 are dropped at
 * intake), so per-day totals are strictly positive whenever a day
 * appears in `perDay`. This means log(D_i) is always finite. Days
 * with zero contribution simply do not appear -- the same convention
 * the rest of the daily-token axis family uses.
 */
import type { QueueLine } from './types.js';

export type DailyTokenVarianceOfLogarithmsSort =
  | 'vl'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'geoMeanDaily'
  | 'meanLog';

export interface DailyTokenVarianceOfLogarithmsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenVarianceOfLogarithmsSort;
  /** Display filter: drop rows whose vl < this value. Default null = no filter. */
  minVl?: number | null;
  /** Refinement: surface theilL (axis-33 / GE(0)) and vl/(2*GE(0)) lognormality audit. */
  includeGe0Anchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenVarianceOfLogarithmsSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** Variance of logarithms of the per-day token vector. In [0, +inf). */
  vl: number;
  /** mean(log D_i). */
  meanLog: number;
  /** exp(meanLog) = geometric mean (in token units). */
  geoMeanDaily: number;
  /** Arithmetic mean of D_i (in token units). */
  meanDailyTokens: number;
  /** True iff total = 0 OR n < 2. vl = 0 in this case. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: theilL = GE(0) = log(mean) - mean(log) on the same vector. */
  theilL?: number;
  /** Refinement: vl / (2 * theilL). Equals 1 iff log y is normal. */
  vlOverTwoGe0?: number;
}

export interface DailyTokenVarianceOfLogarithmsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenVarianceOfLogarithmsSort;
  minVl: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinVl: number;
  droppedTopSources: number;
  sources: DailyTokenVarianceOfLogarithmsSourceRow[];
}

/**
 * Variance of logarithms of a strictly-positive numeric vector.
 *
 *     VL = (1/n) * sum_i ( log(v_i) - mean_j log(v_j) )^2
 *
 * Numerically stable single-pass computation via Welford's online
 * algorithm applied to log v_i. Returns { vl: 0, degenerate: true }
 * for empty input or n < 2 or all-equal values. Throws on negative,
 * zero, or non-finite input.
 */
export function varianceOfLogarithmsOfVector(values: number[]): {
  vl: number;
  meanLog: number;
  geoMean: number;
  mean: number;
  total: number;
  degenerate: boolean;
} {
  const n = values.length;
  if (n < 2) {
    let total = 0;
    for (const v of values) {
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error(
          `varianceOfLogarithmsOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    return {
      vl: 0,
      meanLog: n === 1 ? Math.log(values[0]!) : 0,
      geoMean: n === 1 ? values[0]! : 0,
      mean: n === 1 ? values[0]! : 0,
      total,
      degenerate: true,
    };
  }
  // Welford on log v_i for numerical stability on near-equal vectors.
  let m = 0; // running mean of log v
  let s = 0; // running sum of squared deviations
  let total = 0;
  let k = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `varianceOfLogarithmsOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
    k += 1;
    const lv = Math.log(v);
    const d = lv - m;
    m += d / k;
    const d2 = lv - m;
    s += d * d2;
  }
  let vl = s / n;
  // Numerical clamp: variance is non-negative; floating-point can put it
  // ~-1e-30 negative on near-uniform vectors.
  if (vl < 0) vl = 0;
  return {
    vl,
    meanLog: m,
    geoMean: Math.exp(m),
    mean: total / n,
    total,
    degenerate: vl === 0,
  };
}

/**
 * Theil-L (GE(0), MLD) of a strictly-positive vector.
 *     L = log(arithmetic mean) - mean(log v_i)
 * Used internally for the refinement lognormality audit. Mirrors
 * the public helper in src/dailytokentheillindex.ts but specialised
 * to the strictly-positive case (we never see zeros here because
 * intake filters total_tokens <= 0).
 */
function theilLPositive(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let total = 0;
  let logSum = 0;
  for (const v of values) {
    total += v;
    logSum += Math.log(v);
  }
  if (total <= 0) return 0;
  let l = Math.log(total / n) - logSum / n;
  if (l < 0) l = 0;
  return l;
}

export function buildDailyTokenVarianceOfLogarithms(
  queue: QueueLine[],
  opts: DailyTokenVarianceOfLogarithmsOptions = {},
): DailyTokenVarianceOfLogarithmsReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (VL degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minVl = opts.minVl ?? null;
  if (minVl !== null && (!Number.isFinite(minVl) || minVl < 0)) {
    throw new Error(
      `minVl must be a non-negative finite number or null (got ${opts.minVl})`,
    );
  }
  const sort: DailyTokenVarianceOfLogarithmsSort = opts.sort ?? 'vl';
  const validSorts: DailyTokenVarianceOfLogarithmsSort[] = [
    'vl',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'geoMeanDaily',
    'meanLog',
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
  const rows: DailyTokenVarianceOfLogarithmsSourceRow[] = [];

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
    const r = varianceOfLogarithmsOfVector(values);
    const row: DailyTokenVarianceOfLogarithmsSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      vl: r.vl,
      meanLog: r.meanLog,
      geoMeanDaily: r.geoMean,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeGe0Anchor) {
      const l = theilLPositive(values);
      row.theilL = l;
      row.vlOverTwoGe0 = l > 1e-15 ? r.vl / (2 * l) : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinVl = 0;
  let filtered = rows;
  if (minVl !== null) {
    const next: DailyTokenVarianceOfLogarithmsSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.vl >= minVl) next.push(r);
      else droppedBelowMinVl += 1;
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
      case 'geoMeanDaily':
        primary = b.geoMeanDaily - a.geoMeanDaily;
        break;
      case 'meanLog':
        primary = b.meanLog - a.meanLog;
        break;
      case 'vl':
      default:
        primary = b.vl - a.vl;
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
    minVl,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinVl,
    droppedTopSources,
    sources: kept,
  };
}
