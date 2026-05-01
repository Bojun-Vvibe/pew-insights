/**
 * daily-token-higuchi-fd: per-source Higuchi Fractal Dimension
 * (Higuchi 1988, Physica D 31:277-283) on the gap-filled daily
 * total_tokens series.
 *
 * SEVENTY-FOURTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73). Then:
 *
 *   1. For each scale k = 1..kMax, build k interleaved sub-series
 *      X_m^k = { x[m-1], x[m-1+k], x[m-1+2k], ... } for m = 1..k.
 *   2. For each sub-series of length M+1 (where M = floor((N-m)/k)),
 *      compute the average absolute one-step difference and rescale
 *      by Higuchi's normalisation factor (N-1)/(M*k):
 *
 *        L_m(k) = ((N - 1) / (M * k)) * sum_{i=1..M} |x[m+i*k-1] - x[m+(i-1)*k-1]|
 *
 *   3. L(k) = mean over m of L_m(k) (averaging only over m starts
 *      that produced at least one increment; m starts with M = 0
 *      are skipped and counted in degenerateStartsTotal).
 *
 *   4. HFD = -OLS slope of log(L(k)) vs log(k), with r^2 of the
 *      log-log fit reported alongside. Theoretically HFD in [1, 2]
 *      for self-affine planar curves; we clamp the reported HFD to
 *      [1, 2] and surface hfdRaw, with counters clampedBelow1 /
 *      clampedAbove2 for sources that hit the bracket.
 *
 *      HFD ~ 1.0 = smooth curve / near-monotone.
 *      HFD ~ 1.5 = Brownian-like / fractional-Brownian H = 0.5.
 *      HFD ~ 2.0 = white-noise-like / space-filling / heavily
 *                  oscillating.
 *
 * Headline question:
 * **"For each source, how does the average GEOMETRIC arc length of
 *   the daily-token series scale with stride k?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED DAILY-TOKEN AXIS 32..73:
 *
 *   - vs `daily-token-hurst-rs` (axis 71): R/S divides the RANGE of
 *     cumulative deviations by the population stddev across
 *     partition scales. HFD is a path-length / arc-length scaling
 *     of the RAW values themselves under stride-k sub-sampling — a
 *     geometric estimator on the curve, not a variance estimator
 *     on cumulative deviations. The two estimators coincide only
 *     for ideal fBm (HFD = 2 - H); on real bounded gap-filled
 *     daily-token series they routinely disagree and rankings do
 *     not preserve.
 *
 *   - vs `daily-token-dfa-alpha` (axis 72): DFA-1 alpha is the
 *     scaling of LOCAL-LINEAR-DETRENDED residuals of the
 *     CUMULATIVE-DEVIATION profile across non-overlapping windows
 *     of size s. HFD is the scaling of average ARC LENGTH of the
 *     RAW series under stride-k sub-sampling, with NO cumulative
 *     integration and NO per-window detrending. These are opposite
 *     ends of the integration ladder: DFA integrates the series
 *     once before measuring fluctuation; HFD measures path length
 *     directly. Coincide only under ideal self-affine stationarity
 *     (HFD = 2 - alpha for fBm); on real series with mixed regimes
 *     and bounded support, ranking by alpha vs by HFD is
 *     uncorrelated. The `orthogonality witness: sorted-vs-shuffled
 *     multiset` test also separates them: a sorted ramp -> HFD
 *     near 1.0 (smooth path), shuffled -> HFD near 2.0 (space-
 *     filling), while every multiset / dispersion / shape statistic
 *     stays bit-identical.
 *
 *   - vs `daily-token-autocorrelation-lag1` and
 *     `daily-token-autocorrelation-lag7` (axes 67/68): rho_k is
 *     a SINGLE-LAG linear-correlation scalar at one fixed lag.
 *     HFD is a MULTI-SCALE geometric exponent and is well-defined
 *     even when all finite-lag rho_k = 0.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     the FLATNESS of the global periodogram symmetrically; HFD
 *     summarises a POWER-LAW EXPONENT linking stride k to average
 *     arc length. Related only under idealised 1/f^beta stationarity
 *     (HFD = (5 - beta)/2); on real bounded gap-filled series they
 *     routinely disagree.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE is
 *     ORDINAL on length-3 windows (alphabet of 6 patterns),
 *     invariant under ANY strictly monotone transform. HFD is
 *     METRIC and only invariant under positive affine transforms.
 *     A linear ramp has PE = 0 AND HFD ~ 1.0; a noisy alternating
 *     bounded oscillation can have PE near 1 and HFD near 2.0.
 *
 *   - vs `daily-token-sample-entropy` (axis 73): SampEn is a
 *     SHORT-WINDOW SINGLE-SCALE conditional irregularity at one
 *     (m, r). HFD is a MULTI-SCALE arc-length scaling exponent.
 *     They measure orthogonal facets of complexity (template
 *     recurrence vs geometric path roughness).
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     throw away temporal placement entirely. A sorted and a
 *     shuffled copy of the same multiset produce wildly different
 *     HFD (sorted -> ~1.0, shuffled -> ~2.0) while every multiset
 *     statistic is identical. See the `orthogonality witness` test.
 *
 *   - vs trend / forecast / source-daily-token-trend-slope: HFD
 *     measures GEOMETRIC roughness of the curve and is invariant
 *     to positive affine rescaling of the value axis; trend slope
 *     measures monotone drift. A heavily trended series with
 *     little roughness has high |slope| and HFD near 1.0; a
 *     trend-free noisy series has slope near 0 and HFD near 2.0.
 *
 * Caveats:
 *
 *   - All-zero stretches in the gap-filled series produce stride
 *     sub-series with zero increments, contributing L_m(k) = 0
 *     for those m starts. If ALL m starts at scale k yield zero
 *     length the scale is dropped (counted in scalesDroppedZeroL);
 *     a source whose surviving scale count falls below `minK` is
 *     dropped at the source level (counted in
 *     `droppedTooFewScales`).
 *   - Higuchi's HFD is biased on short series and on series with
 *     heavy bounded support; the default `minTenureDays = 32` floor
 *     and `kMax = 8` keep the bias bounded and yield at least 4
 *     surviving scales at the default `minK = 4`.
 *   - HFD is NOT shift-invariant on its raw definition (additive
 *     constants do not change increments, so shift cancels), but
 *     IS scale-invariant: multiplying the series by any positive
 *     constant cancels in numerator and denominator of L(k) ratios.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Higuchi, T., "Approach to an irregular time series on the basis
 *     of the fractal theory", Physica D: Nonlinear Phenomena
 *     31(2):277-283, 1988.
 *   Esteller, R., Vachtsevanos, G., Echauz, J., Litt, B., "A
 *     comparison of waveform fractal dimension algorithms", IEEE
 *     Trans. Circuits Syst. I 48(2):177-183, 2001.
 */
import type { QueueLine } from './types.js';

/** Default cap on the Higuchi stride k. */
export const DEFAULT_HFD_KMAX = 8;
/** Default minimum surviving scales required to fit the OLS. */
export const DEFAULT_HFD_MIN_K = 4;

export type DailyTokenHiguchiFdSort =
  | 'absHfdDeviationDesc'
  | 'hfd'
  | 'hfdDesc'
  | 'r2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHiguchiFdOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor `kMax + 2` so the
   * largest stride still has at least 1 increment. Default 32.
   */
  minTenureDays?: number;
  /** Cap on the Higuchi stride k. Hard floor 2, ceiling 64. Default 8. */
  kMax?: number;
  /** Minimum surviving scales required to fit the log-log OLS. Default 4. */
  minK?: number;
  top?: number;
  sort?: DailyTokenHiguchiFdSort;
  generatedAt?: string;
}

export interface DailyTokenHiguchiFdSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Higuchi fractal dimension clamped to [1, 2]. */
  hfd: number;
  /** Negated OLS slope of log(L(k)) vs log(k) before clamping. */
  hfdRaw: number;
  /** OLS intercept on the log-log fit. */
  intercept: number;
  /** Coefficient of determination r^2 of the log-log fit in [0, 1]. */
  r2: number;
  /** Number of surviving scales used in the OLS. */
  scalesUsed: number;
  /** Smallest scale (in days) actually used. */
  minScaleUsed: number;
  /** Largest scale (in days) actually used. */
  maxScaleUsed: number;
  /** Total m-start sub-series whose path length collapsed to 0. */
  degenerateStartsTotal: number;
  /** Scales whose averaged L(k) reduced to 0 across all m starts. */
  scalesDroppedZeroL: number;
  /** True if hfdRaw was clamped from below 1 to 1. */
  clampedBelow1: boolean;
  /** True if hfdRaw was clamped from above 2 to 2. */
  clampedAbove2: boolean;
}

export interface DailyTokenHiguchiFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  kMax: number;
  minK: number;
  top: number;
  sort: DailyTokenHiguchiFdSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedTooFewScales: number;
  droppedZeroVariance: number;
  droppedTopSources: number;
  clampedBelow1: number;
  clampedAbove2: number;
  sources: DailyTokenHiguchiFdSourceRow[];
}

/**
 * Higuchi Fractal Dimension on a real-valued series. Returns the
 * negated OLS slope of log(L(k)) vs log(k), the intercept, r^2,
 * the surviving stride list, and counts of m-starts / scales
 * dropped to numerical degeneracy. Throws when fewer than minK
 * scales survive (caller should catch and surface as
 * droppedTooFewScales at the source level).
 *
 * Algorithm (Higuchi 1988):
 *   1. For each k = 1..kMax and each m = 1..k, form the stride-k
 *      sub-series starting at index m-1. Let M = floor((N-m)/k);
 *      its length is M+1.
 *   2. L_m(k) = ((N - 1) / (M * k)) * sum_{i=1..M} |x[m+i*k-1]
 *               - x[m+(i-1)*k-1]|
 *   3. L(k) = mean over surviving m of L_m(k).
 *   4. HFD = - OLS slope of log(L(k)) vs log(k).
 *
 * Caveats specific to this estimator:
 *   - m-starts with M = 0 (k > N - m) contribute zero increments
 *     and are skipped at the m-level; a scale that loses ALL m
 *     starts is dropped (`scalesDroppedZeroL`).
 *   - On a deterministic monotone ramp the increments at every k
 *     are constant and L(k) ~ const * (N-1)/k, giving slope -1
 *     and HFD ~ 1.0.
 *   - On a Nyquist alternation the increments at odd k inflate
 *     while even-k strides see zero swings, biasing HFD toward 2.
 */
export function higuchiFd(
  values: number[],
  opts: { kMax?: number; minK?: number } = {},
): {
  hfd: number;
  hfdRaw: number;
  intercept: number;
  r2: number;
  scalesUsed: number[];
  degenerateStartsTotal: number;
  scalesDroppedZeroL: number;
  clampedBelow1: boolean;
  clampedAbove2: boolean;
} {
  const kMax = opts.kMax ?? DEFAULT_HFD_KMAX;
  const minK = opts.minK ?? DEFAULT_HFD_MIN_K;
  const N = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('higuchiFd requires finite values');
    }
  }
  // Need at least 1 increment at the largest stride: floor((N - 1)/kMax) >= 1.
  if (N < kMax + 2) {
    throw new Error(
      `higuchiFd: series too short (n=${N}, need n >= kMax+2=${kMax + 2})`,
    );
  }

  const xs: number[] = []; // log(k)
  const ys: number[] = []; // log(L(k))
  const survivingScales: number[] = [];
  let degenerateStartsTotal = 0;
  let scalesDroppedZeroL = 0;

  for (let k = 1; k <= kMax; k += 1) {
    let sumLm = 0;
    let validM = 0;
    for (let mStart = 1; mStart <= k; mStart += 1) {
      const M = Math.floor((N - mStart) / k);
      if (M < 1) {
        degenerateStartsTotal += 1;
        continue;
      }
      let absSum = 0;
      for (let i = 1; i <= M; i += 1) {
        const idx1 = mStart + i * k - 1;
        const idx0 = mStart + (i - 1) * k - 1;
        absSum += Math.abs(values[idx1]! - values[idx0]!);
      }
      // Higuchi normalisation: (N - 1) / (M * k)
      const Lm = (absSum * (N - 1)) / (M * k);
      sumLm += Lm;
      validM += 1;
    }
    if (validM === 0) {
      scalesDroppedZeroL += 1;
      continue;
    }
    const Lk = sumLm / validM;
    if (!(Lk > 0)) {
      scalesDroppedZeroL += 1;
      continue;
    }
    const logLk = Math.log(Lk);
    if (!Number.isFinite(logLk)) {
      // Defence-in-depth: extremely small L(k) (sub-normal floats)
      // can produce -Infinity from Math.log even when Lk > 0 in
      // IEEE-754. Treat such scales as numerically degenerate.
      scalesDroppedZeroL += 1;
      continue;
    }
    xs.push(Math.log(k));
    ys.push(logLk);
    survivingScales.push(k);
  }

  if (survivingScales.length < minK) {
    throw new Error(
      `higuchiFd: only ${survivingScales.length} scales survived (need >= ${minK})`,
    );
  }

  const n = xs.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i += 1) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const xbar = sx / n;
  const ybar = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - xbar;
    sxx += dx * dx;
    sxy += dx * (ys[i]! - ybar);
  }
  if (sxx === 0) {
    throw new Error('higuchiFd: surviving log-scales are degenerate');
  }
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const yhat = slope * xs[i]! + intercept;
    const r = ys[i]! - yhat;
    ssRes += r * r;
    const dy = ys[i]! - ybar;
    ssTot += dy * dy;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  const hfdRaw = -slope;
  const clampedBelow1 = hfdRaw < 1;
  const clampedAbove2 = hfdRaw > 2;
  const hfd = Math.max(1, Math.min(2, hfdRaw));

  return {
    hfd,
    hfdRaw,
    intercept,
    r2,
    scalesUsed: survivingScales,
    degenerateStartsTotal,
    scalesDroppedZeroL,
    clampedBelow1,
    clampedAbove2,
  };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenHiguchiFd(
  queue: QueueLine[],
  opts: DailyTokenHiguchiFdOptions = {},
): DailyTokenHiguchiFdReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const kMax = opts.kMax ?? DEFAULT_HFD_KMAX;
  if (!Number.isInteger(kMax) || kMax < 2 || kMax > 64) {
    throw new Error(`kMax must be an integer in [2, 64] (got ${opts.kMax})`);
  }
  const minK = opts.minK ?? DEFAULT_HFD_MIN_K;
  if (!Number.isInteger(minK) || minK < 2 || minK > kMax) {
    throw new Error(
      `minK must be an integer in [2, kMax=${kMax}] (got ${opts.minK})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < kMax + 2) {
    throw new Error(
      `minTenureDays must be an integer >= kMax+2=${kMax + 2} (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHiguchiFdSort = opts.sort ?? 'absHfdDeviationDesc';
  const validSorts: DailyTokenHiguchiFdSort[] = [
    'absHfdDeviationDesc',
    'hfd',
    'hfdDesc',
    'r2Desc',
    'tokens',
    'tenure',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedTooFewScales = 0;
  let droppedZeroVariance = 0;
  let clampedBelow1Count = 0;
  let clampedAbove2Count = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHiguchiFdSourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    // Zero-variance gate: a perfectly flat series has every L(k) =
    // 0 and the log-log fit is undefined. (Cannot happen given
    // upstream "tt > 0" filter unless the only days with mass span
    // a tenure of identical totals — vanishingly rare on real data
    // but defended here for symmetry with axis-73.)
    let mn = filled[0]!;
    let mx = filled[0]!;
    for (let i = 1; i < nTenure; i += 1) {
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = higuchiFd(filled, { kMax, minK });
    } catch {
      droppedTooFewScales += 1;
      continue;
    }
    if (result.clampedBelow1) clampedBelow1Count += 1;
    if (result.clampedAbove2) clampedAbove2Count += 1;
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      hfd: result.hfd,
      hfdRaw: result.hfdRaw,
      intercept: result.intercept,
      r2: result.r2,
      scalesUsed: result.scalesUsed.length,
      minScaleUsed: result.scalesUsed[0]!,
      maxScaleUsed: result.scalesUsed[result.scalesUsed.length - 1]!,
      degenerateStartsTotal: result.degenerateStartsTotal,
      scalesDroppedZeroL: result.scalesDroppedZeroL,
      clampedBelow1: result.clampedBelow1,
      clampedAbove2: result.clampedAbove2,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hfd':
        primary = a.hfd - b.hfd;
        break;
      case 'hfdDesc':
        primary = b.hfd - a.hfd;
        break;
      case 'r2Desc':
        primary = b.r2 - a.r2;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absHfdDeviationDesc':
      default:
        // Sources furthest from HFD = 1.5 (Brownian midpoint) first.
        primary = Math.abs(b.hfd - 1.5) - Math.abs(a.hfd - 1.5);
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTenureDays,
    kMax,
    minK,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedTooFewScales,
    droppedZeroVariance,
    droppedTopSources,
    clampedBelow1: clampedBelow1Count,
    clampedAbove2: clampedAbove2Count,
    sources: kept,
  };
}
