/**
 * daily-token-log-mean-absolute-deviation-index: per-source LOG-MAD
 * (mean absolute deviation of log y around the log-mean) of the
 * per-day total_tokens distribution. FIFTY-FOURTH cross-source axis.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the L1 dispersion
 * of its logarithms around the arithmetic mean of the logarithms:
 *
 *     LMAD = (1/n) * sum_i | log(D_i) - mean_j log(D_j) |
 *
 *   i.e. the FIRST ABSOLUTE CENTRAL MOMENT of LOG y -- the L1 sibling
 *   of axis-53's L2 variance-of-logarithms VL = (1/n) * sum_i (log D_i
 *   - mean_j log D_j)^2. LMAD is dimensionless, anchored at the
 *   GEOMETRIC MEAN (the within-log mean is log(GeoMean)), and operates
 *   on a LOG-SCALE: doubling every D_i leaves LMAD unchanged
 *   (translation in log-space is scale-invariance in token-space).
 *
 *   Range: [0, +inf). LMAD = 0 iff all D_i are equal (perfect
 *   equality). Larger LMAD = more L1 spread of the daily-token mass on
 *   a multiplicative scale.
 *
 *   Headline question:
 *   **"On a LOG scale, what is the AVERAGE absolute deviation of each
 *     source's daily token mass from its OWN geometric mean?"**
 *
 * Why orthogonal to every prior daily-token axis (axes 32-53):
 *
 *   axis-32 daily-token-gini-coefficient: linear-scale, mean-anchored
 *     pairwise L1 (= mean-absolute-DIFFERENCE / 2mu). LMAD is log-
 *     scale, geometric-mean-anchored mean-absolute-DEVIATION (single-
 *     point reference, not pairwise).
 *   axis-33 daily-token-theil-l-index (MLD, GE(0)):
 *     L = log(mu) - mean(log y) = log(mu / GeoMean). FIRST-ORDER
 *     log-shift between log-mean and mean-log; SIGNED zero-mean
 *     functional (in fact non-negative by Jensen). LMAD is the FIRST
 *     ABSOLUTE moment of (log y - mean log y) -- the symmetric L1
 *     spread of log y around its OWN center, NOT the gap between
 *     log-mean and mean-log.
 *   axis-34 daily-token-theil-t-index (Theil-T, GE(1)): mass-weighted
 *     log share. LMAD is unweighted, no share scaling.
 *   axis-35 daily-token-pietra-ratio / axis-42 hoover: single-point
 *     L_inf Lorenz gaps in linear share space. LMAD is a global L1
 *     log-deviation, no Lorenz reading at all.
 *   axis-37 daily-token-ge2-index (GE(2)) / axis-49 GE(-1): MOMENT
 *     functionals on LINEAR shares (squared / reciprocal share
 *     deviations). LMAD is a LOG-domain absolute moment.
 *   axis-36 daily-token-atkinson-index / axis-44 kolm-pollak: CRRA
 *     / CARA welfare-equivalent loss functionals (concave power
 *     averaging of values). LMAD is not a welfare functional.
 *   axes-39 zenga / axis-40 palma: rank-cut RATIO functionals in
 *     linear space. LMAD is a global L1 moment of log y, no rank cut.
 *   axis-41 fgt: one-sided lower-tail threshold-anchored. LMAD is
 *     two-sided, threshold-FREE, log-domain.
 *   axes-43/45/47 bonferroni / mehran / s-gini: rank-weighted
 *     PARTIAL-MEAN kernels in linear space. LMAD has no rank kernel.
 *   axis-46 wolfson / axis-52 foster-wolfson: median-anchored
 *     polarization on linear shares. LMAD is geometric-mean-anchored
 *     L1 dispersion (non-bipolarization).
 *   axis-48 chakravarty: parametric concave share-power averaging
 *     (CES utility loss). LMAD has no exponent and is L1-on-log.
 *   axis-50 amato: Lorenz-curve ARC LENGTH on linear shares. LMAD is
 *     not a Lorenz functional.
 *   axis-51 esteban-ray: pairwise identification-alienation. LMAD is
 *     a single-point absolute moment, no pairwise sum.
 *   axis-53 daily-token-variance-of-logarithms (VL): SECOND CENTRAL
 *     MOMENT of log y. LMAD and VL are the L1 / L2 siblings on log y;
 *     for LOGNORMAL log y ~ N(mu_L, sigma^2) we have the closed-form
 *     identities
 *         VL   = sigma^2,
 *         LMAD = sigma * sqrt(2/pi),
 *     so the dimensionless ratio
 *         LMAD / sqrt(VL) = sqrt(2/pi) ~ 0.7978845608...
 *     for ANY lognormal source. The residual abs(LMAD/sqrt(VL) -
 *     sqrt(2/pi)) is a per-source LOG-NORMALITY audit that is
 *     INDEPENDENT of the axis-53 audit VL == 2 * GE(0) (which uses
 *     log-mean / mean-log balance, not the L1/L2 ratio of log
 *     deviations) -- so the two audits can disagree on non-lognormal
 *     vectors and together pin down WHICH moment of log y is non-
 *     Gaussian.
 *
 *   THE L1 LOG-DEVIATION CORNER. Among the prior 22 daily-token axes
 *   (32-53), only axes 33/34/37/49/53 read y on the logarithmic axis,
 *   and all of them are L2-style (variance, share-weighted log share,
 *   squared share deviation) or single-point first-order shifts.
 *   LMAD is the only axis that exposes the FIRST ABSOLUTE central
 *   moment of log y -- the L1 sibling of VL. It is robust to log-tail
 *   outliers in a way VL is not (extreme log values contribute
 *   linearly, not quadratically), so on heavy-log-tailed sources LMAD
 *   and VL strongly disagree on rank order.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 4): LMAD degenerate for n<2; default 4
 *     matches the rest of the daily-token axis family.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'lmad'): 'lmad' | 'tokens' | 'days' | 'source'
 *     | 'meanDaily' | 'geoMeanDaily' | 'meanLog'.
 *   - `minLmad` (>=0): display filter on LMAD. Degenerate rows always
 *     pass.
 *   - `includeVlAnchor` (refinement): per-row `vl` (axis-53 / VL on
 *     the same vector) and `lmadOverSqrtVl` ratio. The closed-form
 *     identity LMAD / sqrt(VL) = sqrt(2/pi) holds iff log y is
 *     normal; we surface the residual as an INDEPENDENT lognormality
 *     audit (orthogonal to the axis-53 vl/(2*GE(0)) audit).
 *
 * Zero-day handling: per-day totals are aggregated from positive
 * total_tokens only (rows with total_tokens <= 0 are dropped at
 * intake), so per-day totals are strictly positive whenever a day
 * appears in `perDay`. This means log(D_i) is always finite. Days
 * with zero contribution simply do not appear -- the same convention
 * the rest of the daily-token axis family uses.
 */
import type { QueueLine } from './types.js';

export type DailyTokenLogMeanAbsoluteDeviationIndexSort =
  | 'lmad'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'geoMeanDaily'
  | 'meanLog';

export interface DailyTokenLogMeanAbsoluteDeviationIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenLogMeanAbsoluteDeviationIndexSort;
  /** Display filter: drop rows whose lmad < this value. Default null = no filter. */
  minLmad?: number | null;
  /** Refinement: surface vl (axis-53) and lmad/sqrt(vl) lognormality audit. */
  includeVlAnchor?: boolean;
  generatedAt?: string;
}

export interface DailyTokenLogMeanAbsoluteDeviationIndexSourceRow {
  source: string;
  totalTokens: number;
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** L1 log-deviation around the log-mean. In [0, +inf). */
  lmad: number;
  /** mean(log D_i). */
  meanLog: number;
  /** exp(meanLog) = geometric mean (in token units). */
  geoMeanDaily: number;
  /** Arithmetic mean of D_i (in token units). */
  meanDailyTokens: number;
  /** True iff total = 0 OR n < 2 OR all D_i equal. lmad = 0 in this case. */
  degenerate: boolean;
  maxDailyTokens: number;
  maxDay: string;
  minDailyTokens: number;
  minDay: string;
  /** Refinement: vl = axis-53 / VL on the same vector. */
  vl?: number;
  /** Refinement: lmad / sqrt(vl). Equals sqrt(2/pi) iff log y is normal. */
  lmadOverSqrtVl?: number;
}

export interface DailyTokenLogMeanAbsoluteDeviationIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenLogMeanAbsoluteDeviationIndexSort;
  minLmad: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinLmad: number;
  droppedTopSources: number;
  sources: DailyTokenLogMeanAbsoluteDeviationIndexSourceRow[];
}

/**
 * Closed-form constant for lognormal sources:
 *     E |Z|  = sqrt(2/pi)  for  Z ~ N(0, 1).
 * Surface as a named export so tests and the audit display cannot
 * drift from the Math.* truth.
 */
export const LMAD_OVER_SIGMA_NORMAL = Math.sqrt(2 / Math.PI);

/**
 * Log-mean-absolute-deviation of a strictly-positive numeric vector.
 *
 *     LMAD = (1/n) * sum_i | log(v_i) - mean_j log(v_j) |
 *
 * Numerically stable two-pass computation: first pass accumulates
 * sum of log v_i (single-precision-safe via Kahan summation); second
 * pass accumulates absolute deviations. Returns { lmad: 0,
 * degenerate: true } for empty input or n < 2 or all-equal values.
 * Throws on negative, zero, or non-finite input.
 */
export function logMeanAbsoluteDeviationOfVector(values: number[]): {
  lmad: number;
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
          `logMeanAbsoluteDeviationOfVector requires strictly-positive finite values (got ${v})`,
        );
      }
      total += v;
    }
    return {
      lmad: 0,
      meanLog: n === 1 ? Math.log(values[0]!) : 0,
      geoMean: n === 1 ? values[0]! : 0,
      mean: n === 1 ? values[0]! : 0,
      total,
      degenerate: true,
    };
  }
  // Pass 1: Kahan-summed mean of log values + arithmetic total.
  let sumLog = 0;
  let cLog = 0;
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `logMeanAbsoluteDeviationOfVector requires strictly-positive finite values (got ${v})`,
      );
    }
    total += v;
    const lv = Math.log(v);
    const y = lv - cLog;
    const t = sumLog + y;
    cLog = t - sumLog - y;
    sumLog = t;
  }
  const meanLog = sumLog / n;
  // Pass 2: Kahan-summed absolute deviation from meanLog.
  let sumAbs = 0;
  let cAbs = 0;
  for (const v of values) {
    const dev = Math.abs(Math.log(v) - meanLog);
    const y = dev - cAbs;
    const t = sumAbs + y;
    cAbs = t - sumAbs - y;
    sumAbs = t;
  }
  let lmad = sumAbs / n;
  // Numerical clamp: |.| is non-negative; floating-point can put it
  // ~-1e-30 negative on near-uniform vectors via Kahan correction.
  if (lmad < 0) lmad = 0;
  return {
    lmad,
    meanLog,
    geoMean: Math.exp(meanLog),
    mean: total / n,
    total,
    degenerate: lmad === 0,
  };
}

/**
 * Variance of logarithms helper (axis-53 / VL on the same vector).
 * Local copy to avoid an import cycle and to allow LMAD to compute
 * the closed-form lognormality audit without pulling the axis-53
 * builder. Mirrors `varianceOfLogarithmsOfVector` in
 * src/dailytokenvarianceoflogarithms.ts but specialised to the
 * strictly-positive case.
 */
function vlPositive(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let m = 0;
  let s = 0;
  let k = 0;
  for (const v of values) {
    k += 1;
    const lv = Math.log(v);
    const d = lv - m;
    m += d / k;
    const d2 = lv - m;
    s += d * d2;
  }
  let vl = s / n;
  if (vl < 0) vl = 0;
  return vl;
}

export function buildDailyTokenLogMeanAbsoluteDeviationIndex(
  queue: QueueLine[],
  opts: DailyTokenLogMeanAbsoluteDeviationIndexOptions = {},
): DailyTokenLogMeanAbsoluteDeviationIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (LMAD degenerate for n<2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minLmad = opts.minLmad ?? null;
  if (minLmad !== null && (!Number.isFinite(minLmad) || minLmad < 0)) {
    throw new Error(
      `minLmad must be a non-negative finite number or null (got ${opts.minLmad})`,
    );
  }
  const sort: DailyTokenLogMeanAbsoluteDeviationIndexSort = opts.sort ?? 'lmad';
  const validSorts: DailyTokenLogMeanAbsoluteDeviationIndexSort[] = [
    'lmad',
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
  const rows: DailyTokenLogMeanAbsoluteDeviationIndexSourceRow[] = [];

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
    const r = logMeanAbsoluteDeviationOfVector(values);
    const row: DailyTokenLogMeanAbsoluteDeviationIndexSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      lmad: r.lmad,
      meanLog: r.meanLog,
      geoMeanDaily: r.geoMean,
      meanDailyTokens: r.mean,
      degenerate: r.degenerate,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (opts.includeVlAnchor) {
      const vl = vlPositive(values);
      row.vl = vl;
      row.lmadOverSqrtVl = vl > 1e-15 ? r.lmad / Math.sqrt(vl) : Number.NaN;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinLmad = 0;
  let filtered = rows;
  if (minLmad !== null) {
    const next: DailyTokenLogMeanAbsoluteDeviationIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.lmad >= minLmad) next.push(r);
      else droppedBelowMinLmad += 1;
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
      case 'lmad':
      default:
        primary = b.lmad - a.lmad;
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
    minLmad,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinLmad,
    droppedTopSources,
    sources: kept,
  };
}
