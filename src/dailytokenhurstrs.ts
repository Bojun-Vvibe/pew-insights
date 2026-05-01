/**
 * daily-token-hurst-rs: per-source Hurst exponent via classical
 * rescaled-range (R/S) analysis on the gap-filled daily total_tokens
 * series.
 *
 * SEVENTY-FIRST cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (so we
 * have a dense, evenly-spaced length-N daily series — same gap-fill
 * convention as axis 67/68/69/70). Then:
 *
 *   1. Build a log-spaced grid of window sizes m in
 *      [minWindow, floor(N/2)] capped at maxScales distinct values.
 *
 *   2. For each scale m, split the series into k = floor(N/m)
 *      non-overlapping chunks. Per chunk:
 *        - subtract chunk mean,
 *        - cumulate residuals z[i] = sum_{j<=i} (x[j] - mu),
 *        - R = max(z) - min(z) (range of cumulative deviation),
 *        - S = sqrt((1/m) sum (x - mu)^2) (population stddev).
 *      Average R/S over the k chunks (skipping chunks with S = 0,
 *      which arise from all-zero gap-filled stretches).
 *
 *   3. Hurst H = OLS slope of log((R/S)_m) vs log(m) across the
 *      surviving scales (Mandelbrot & Wallis 1969; Hurst 1951).
 *
 *      H = 0.5 -> uncorrelated random-walk increments (independent
 *                 Brownian).
 *      H > 0.5 -> persistent / long-range positive memory across
 *                 many scales (a high day predicts further high
 *                 days at multiple horizons).
 *      H < 0.5 -> anti-persistent / mean-reverting (high days
 *                 followed by low days at multiple horizons).
 *
 * Headline question:
 * **"For each source, how strong is the LONG-RANGE / multi-scale
 *   memory in the daily-token series, beyond the single-lag
 *   linear correlation captured by lag-1 / lag-7 ACF?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED DAILY-TOKEN AXIS 32..70:
 *
 *   - vs `daily-token-autocorrelation-lag1` and
 *     `daily-token-autocorrelation-lag7` (axes 67/68): rho_k is a
 *     SINGLE-LAG linear-correlation scalar at one chosen lag.
 *     Hurst R/S is a MULTI-SCALE exponent that aggregates
 *     range-to-stddev growth across a log-spaced grid of window
 *     sizes (and is well-defined even when all rho_k = 0 at every
 *     finite lag, e.g. fractional Gaussian noise with H != 0.5).
 *     A series with rho_1 = rho_7 = 0 can still have H clearly
 *     above or below 0.5 — the Joseph effect that R/S was
 *     introduced to detect.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral entropy
 *     summarises the FLATNESS of the global periodogram at all
 *     frequencies symmetrically; H summarises a POWER-LAW SCALING
 *     EXPONENT linking window size to range-to-stddev. They are
 *     related (1/f^beta noise has H = (beta+1)/2 only under
 *     idealised stationarity), but on real bounded gap-filled
 *     series the two estimators routinely disagree and rankings
 *     do not preserve. A pink-noise series and a white-noise
 *     series can share spectral entropy near 1 yet H = 1 vs
 *     H = 0.5.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70): PE captures
 *     ORDINAL micro-pattern complexity in length-3 windows
 *     (categorical alphabet of 6 patterns) and is invariant under
 *     any strictly monotone transform; H captures METRIC range-to-
 *     stddev scaling at multiple scales and is invariant only under
 *     positive affine transforms. A linear ramp has PE = 0 (only
 *     pattern 012 occurs) AND R/S H -> 1 (range grows linearly
 *     with m while stddev is bounded), but a noisy mean-reverting
 *     bounded oscillation can have PE near 1 and H near 0.3.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hill, MC, L-skew, ...): those
 *     throw away temporal placement entirely. A sorted and a
 *     shuffled copy of the same multiset produce H near 1 (sorted
 *     -> deterministic ramp; range grows linearly with window) and
 *     H near 0.5 respectively (shuffled -> i.i.d. permutation;
 *     range grows like sqrt(m)) while every multiset statistic is
 *     identical. New refinement test
 *     `orthogonality: sorted vs shuffled multiset` is the explicit
 *     witness.
 *
 *   - vs trend / forecast / source-daily-token-trend-slope: a
 *     monotone trend can drive H -> 1 spuriously (the canonical
 *     R/S caveat — a deterministic linear ramp has range growing
 *     linearly with window size). Operators must cross-check
 *     against the trend-slope axis before claiming long-range
 *     dependence on a trended source. The `--detrend` knob OLS-
 *     detrends each chunk in-place to mitigate this (the
 *     "modified R/S" of Lo 1991 in spirit; we use linear OLS
 *     per-chunk rather than Lo's spectral kernel).
 *
 * Caveats:
 *
 *   - All-zero stretches in the gap-filled series produce chunks
 *     with stddev = 0; those chunks are dropped at the chunk level
 *     (counted in `degenerateChunks`), and a scale that loses ALL
 *     chunks to degeneracy is dropped at the scale level (counted
 *     in `scalesDroppedAllDegenerate`). A source whose surviving
 *     scale count falls below `minScales` after that filter is
 *     dropped at the source level (counted in
 *     `droppedAllDegenerate`).
 *   - Hurst R/S is biased upward for short series; the default
 *     `minTenureDays = 32` floor keeps the bias bounded and yields
 *     at least 4 surviving scales at the default `minWindow = 4`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * References:
 *   Hurst, "Long-term storage capacity of reservoirs", Trans.
 *     Amer. Soc. Civ. Eng. 116, 1951.
 *   Mandelbrot & Wallis, "Robustness of the rescaled range R/S in
 *     the measurement of noncyclic long run statistical
 *     dependence", Water Resources Research 5(5), 1969.
 *   Lo, "Long-term memory in stock market prices", Econometrica
 *     59(5), 1991 (modified R/S; motivates the --detrend knob).
 */
import type { QueueLine } from './types.js';

/** Default minimum chunk size in days. */
export const DEFAULT_HURST_MIN_WINDOW = 4;
/** Default cap on the number of distinct scales used in the OLS. */
export const DEFAULT_HURST_MAX_SCALES = 12;
/** Default minimum surviving scales required to fit the OLS. */
export const DEFAULT_HURST_MIN_SCALES = 4;

export type DailyTokenHurstRsSort =
  | 'absHurstDeviationDesc'
  | 'hurst'
  | 'hurstDesc'
  | 'r2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHurstRsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 2*minWindow so
   * that floor(N/m) >= 2 chunks at the smallest scale. Default 32.
   */
  minTenureDays?: number;
  /** Smallest chunk size in days. Hard floor 4. Default 4. */
  minWindow?: number;
  /** Cap on the number of distinct scales in the OLS grid. Default 12. */
  maxScales?: number;
  /** Minimum surviving scales required to fit. Default 4. */
  minScales?: number;
  /**
   * If true, OLS-detrend each chunk before computing R and S
   * (modified-R/S in spirit; mitigates spurious H -> 1 from a
   * monotone trend).
   */
  detrend?: boolean;
  top?: number;
  sort?: DailyTokenHurstRsSort;
  generatedAt?: string;
}

export interface DailyTokenHurstRsSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Hurst exponent (OLS slope of log(R/S) vs log(m)). */
  hurst: number;
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
  /** Total chunks dropped because their stddev was 0 (all-zero gap-fill stretches). */
  degenerateChunks: number;
  /** Scales dropped because every chunk at that scale was degenerate. */
  scalesDroppedAllDegenerate: number;
}

export interface DailyTokenHurstRsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  minWindow: number;
  maxScales: number;
  minScales: number;
  detrend: boolean;
  top: number;
  sort: DailyTokenHurstRsSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedBelowMinScales: number;
  droppedAllDegenerate: number;
  droppedTopSources: number;
  sources: DailyTokenHurstRsSourceRow[];
}

/**
 * Build a log-spaced integer grid in [lo, hi], capped at maxLen
 * distinct values. Returns an ascending unique-integer array.
 */
export function buildHurstScales(
  lo: number,
  hi: number,
  maxLen: number,
): number[] {
  if (!Number.isInteger(lo) || lo < 1) {
    throw new Error(`buildHurstScales: lo must be a positive integer (got ${lo})`);
  }
  if (!Number.isInteger(hi) || hi < lo) {
    throw new Error(
      `buildHurstScales: hi must be an integer >= lo (got lo=${lo}, hi=${hi})`,
    );
  }
  if (!Number.isInteger(maxLen) || maxLen < 1) {
    throw new Error(
      `buildHurstScales: maxLen must be a positive integer (got ${maxLen})`,
    );
  }
  if (lo === hi) return [lo];
  const out: number[] = [];
  let last = -1;
  const logLo = Math.log(lo);
  const logHi = Math.log(hi);
  for (let i = 0; i < maxLen; i += 1) {
    const t = i / (maxLen - 1);
    const raw = Math.exp(logLo + t * (logHi - logLo));
    const m = Math.max(lo, Math.min(hi, Math.round(raw)));
    if (m !== last) {
      out.push(m);
      last = m;
    }
  }
  return out;
}

/**
 * Hurst R/S exponent on a real-valued series. Returns the OLS
 * slope of log(R/S)_m vs log(m) across the surviving scales,
 * the intercept, r^2, the surviving scale list, and counts of
 * chunks / scales dropped to all-zero degeneracy. Throws when
 * fewer than minScales survive (caller should catch and surface
 * as droppedAllDegenerate at the source level).
 */
export function hurstRs(
  values: number[],
  opts: {
    minWindow?: number;
    maxScales?: number;
    minScales?: number;
    detrend?: boolean;
  } = {},
): {
  hurst: number;
  intercept: number;
  r2: number;
  scalesUsed: number[];
  degenerateChunks: number;
  scalesDroppedAllDegenerate: number;
} {
  const minWindow = opts.minWindow ?? DEFAULT_HURST_MIN_WINDOW;
  const maxScales = opts.maxScales ?? DEFAULT_HURST_MAX_SCALES;
  const minScales = opts.minScales ?? DEFAULT_HURST_MIN_SCALES;
  const detrend = opts.detrend === true;
  const n = values.length;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('hurstRs requires finite values');
    }
  }
  const maxWindow = Math.floor(n / 2);
  if (maxWindow < minWindow) {
    throw new Error(
      `hurstRs: series too short (n=${n}, need n >= 2*minWindow=${2 * minWindow})`,
    );
  }
  const scales = buildHurstScales(minWindow, maxWindow, maxScales);
  const logM: number[] = [];
  const logRS: number[] = [];
  const survivingScales: number[] = [];
  let degenerateChunks = 0;
  let scalesDroppedAllDegenerate = 0;
  for (const m of scales) {
    const k = Math.floor(n / m);
    let rsSum = 0;
    let rsCount = 0;
    for (let c = 0; c < k; c += 1) {
      const start = c * m;
      let cum = 0;
      let zMin = Infinity;
      let zMax = -Infinity;
      let sqDev = 0;
      if (detrend) {
        let sumX = 0;
        for (let i = 0; i < m; i += 1) sumX += values[start + i]!;
        const meanX = sumX / m;
        const meanI = (m - 1) / 2;
        const sxx = (m * (m * m - 1)) / 12;
        let sxy = 0;
        for (let i = 0; i < m; i += 1) {
          sxy += (i - meanI) * (values[start + i]! - meanX);
        }
        const b = sxx === 0 ? 0 : sxy / sxx;
        const a = meanX - b * meanI;
        for (let i = 0; i < m; i += 1) {
          const d = values[start + i]! - (a + b * i);
          cum += d;
          if (cum < zMin) zMin = cum;
          if (cum > zMax) zMax = cum;
          sqDev += d * d;
        }
      } else {
        let sum = 0;
        for (let i = 0; i < m; i += 1) sum += values[start + i]!;
        const mu = sum / m;
        for (let i = 0; i < m; i += 1) {
          const d = values[start + i]! - mu;
          cum += d;
          if (cum < zMin) zMin = cum;
          if (cum > zMax) zMax = cum;
          sqDev += d * d;
        }
      }
      const stddev = Math.sqrt(sqDev / m);
      if (stddev === 0) {
        degenerateChunks += 1;
        continue;
      }
      const range = zMax - zMin;
      rsSum += range / stddev;
      rsCount += 1;
    }
    if (rsCount === 0) {
      scalesDroppedAllDegenerate += 1;
      continue;
    }
    const rsBar = rsSum / rsCount;
    if (rsBar <= 0) {
      scalesDroppedAllDegenerate += 1;
      continue;
    }
    logM.push(Math.log(m));
    logRS.push(Math.log(rsBar));
    survivingScales.push(m);
  }
  if (survivingScales.length < minScales) {
    throw new Error(
      `hurstRs: only ${survivingScales.length} scales survived (need >= ${minScales})`,
    );
  }
  const kk = logM.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < kk; i += 1) {
    sx += logM[i]!;
    sy += logRS[i]!;
  }
  const xbar = sx / kk;
  const ybar = sy / kk;
  let sxx2 = 0;
  let sxy2 = 0;
  for (let i = 0; i < kk; i += 1) {
    const dx = logM[i]! - xbar;
    sxx2 += dx * dx;
    sxy2 += dx * (logRS[i]! - ybar);
  }
  if (sxx2 === 0) {
    throw new Error('hurstRs: surviving log-scales are degenerate');
  }
  const slope = sxy2 / sxx2;
  const intercept = ybar - slope * xbar;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < kk; i += 1) {
    const yhat = slope * logM[i]! + intercept;
    const r = logRS[i]! - yhat;
    ssRes += r * r;
    const dy = logRS[i]! - ybar;
    ssTot += dy * dy;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return {
    hurst: slope,
    intercept,
    r2,
    scalesUsed: survivingScales,
    degenerateChunks,
    scalesDroppedAllDegenerate,
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

export function buildDailyTokenHurstRs(
  queue: QueueLine[],
  opts: DailyTokenHurstRsOptions = {},
): DailyTokenHurstRsReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minWindow = opts.minWindow ?? DEFAULT_HURST_MIN_WINDOW;
  if (!Number.isInteger(minWindow) || minWindow < DEFAULT_HURST_MIN_WINDOW) {
    throw new Error(
      `minWindow must be an integer >= ${DEFAULT_HURST_MIN_WINDOW} (got ${opts.minWindow})`,
    );
  }
  const maxScales = opts.maxScales ?? DEFAULT_HURST_MAX_SCALES;
  if (!Number.isInteger(maxScales) || maxScales < 3) {
    throw new Error(`maxScales must be an integer >= 3 (got ${opts.maxScales})`);
  }
  const minScales = opts.minScales ?? DEFAULT_HURST_MIN_SCALES;
  if (!Number.isInteger(minScales) || minScales < 3) {
    throw new Error(`minScales must be an integer >= 3 (got ${opts.minScales})`);
  }
  if (minScales > maxScales) {
    throw new Error(
      `minScales (${minScales}) must not exceed maxScales (${maxScales})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 2 * minWindow) {
    throw new Error(
      `minTenureDays must be an integer >= 2*minWindow=${2 * minWindow} (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHurstRsSort = opts.sort ?? 'absHurstDeviationDesc';
  const validSorts: DailyTokenHurstRsSort[] = [
    'absHurstDeviationDesc',
    'hurst',
    'hurstDesc',
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
  const detrend = opts.detrend === true;
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
  let droppedBelowMinTenure = 0;
  let droppedBelowMinScales = 0;
  let droppedAllDegenerate = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHurstRsSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(acc.firstDay, acc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    if (Math.floor(nTenure / 2) < minWindow) {
      droppedBelowMinScales += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let result;
    try {
      result = hurstRs(filled, { minWindow, maxScales, minScales, detrend });
    } catch {
      droppedAllDegenerate += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      hurst: result.hurst,
      intercept: result.intercept,
      r2: result.r2,
      scalesUsed: result.scalesUsed.length,
      minScaleUsed: result.scalesUsed[0]!,
      maxScaleUsed: result.scalesUsed[result.scalesUsed.length - 1]!,
      degenerateChunks: result.degenerateChunks,
      scalesDroppedAllDegenerate: result.scalesDroppedAllDegenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hurst':
        primary = a.hurst - b.hurst;
        break;
      case 'hurstDesc':
        primary = b.hurst - a.hurst;
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
      case 'absHurstDeviationDesc':
      default:
        primary = Math.abs(b.hurst - 0.5) - Math.abs(a.hurst - 0.5);
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
    minWindow,
    maxScales,
    minScales,
    detrend,
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
    droppedBelowMinScales,
    droppedAllDegenerate,
    droppedTopSources,
    sources: kept,
  };
}
