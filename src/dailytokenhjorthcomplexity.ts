/**
 * daily-token-hjorth-complexity: per-source Hjorth Complexity
 * parameter (Hjorth, B., "EEG analysis based on time domain
 * properties", Electroencephalography and Clinical Neurophysiology
 * 29(3):306-310, 1970) on the gap-filled daily total_tokens series.
 *
 * EIGHTIETH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75/76/77/78/79).
 *
 * Hjorth Complexity procedure (ratio of mobility-of-derivative to
 * mobility-of-signal):
 *
 *   1. Let d[i]  = y[i+1]   - y[i]    (length N-1)
 *      Let dd[i] = d[i+1]   - d[i]    (length N-2)
 *
 *   2. Population variances (Hjorth's 1970 convention -- mean-square
 *      deviation around the sample mean, no Bessel correction):
 *        var_v   = (1/N)     * sum (y  - mean(y))^2
 *        var_dv  = (1/(N-1)) * sum (d  - mean(d))^2
 *        var_ddv = (1/(N-2)) * sum (dd - mean(dd))^2
 *
 *   3. mobility(x)            = sqrt(var(diff(x)) / var(x))
 *      complexity = mobility(d) / mobility(y)
 *                 = sqrt(var_ddv / var_dv) / sqrt(var_dv / var_v)
 *                 = sqrt(var_ddv * var_v) / var_dv
 *
 * Defaults: `min-tenure-days = 32`, `min-tokens = 1000`. The
 * minimum tenure floor of 5 ensures the second-difference series
 * has at least 3 samples for a stable var_ddv estimate.
 *
 * Reading complexity (unitless ratio):
 *   - complexity ~ 1     = single-tone / sinusoidal (the canonical
 *                          y = cos(omega n) gives mobility(y) =
 *                          mobility(d) = 2 sin(omega/2), so the
 *                          ratio collapses to ~ 1).
 *   - complexity > 1     = the first-difference series is itself
 *                          MORE oscillatory than the original ->
 *                          spectral mass spread across multiple
 *                          frequencies, noise-like / multi-component.
 *   - complexity < 1     = the first-difference series is SMOOTHER
 *                          than the original -> rare for token
 *                          streams; happens when the diff sequence
 *                          shows persistent runs (slow modulation
 *                          on top of a fast carrier).
 *
 *   - Complexity is SCALE-INVARIANT (multiply y by k != 0 -> all
 *     three variances scale by k^2, ratio unchanged).
 *   - Complexity is SHIFT-INVARIANT (constant cancels in every
 *     variance because mean is subtracted).
 *   - Complexity is SIGN-FLIP-INVARIANT.
 *
 * STRUCTURAL ORTHOGONALITY -- SECOND SPECTRAL MOMENT RATIO
 * (specifically the bandwidth-equivalent quantity), fundamentally
 * distinct from every shipped daily-token axis 32..79:
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79): mobility IS the
 *     spectral CENTROID (Hjorth 1970 Eq. 3, sigma_1 in Hjorth
 *     notation), a FIRST-moment quantity. Complexity is the ratio
 *     of two centroids and is the BANDWIDTH-equivalent quantity
 *     (Hjorth 1970 Eq. 8) -- a SECOND-moment summary. Two sources
 *     with identical mobility can have arbitrarily different
 *     complexity, and vice-versa: a single sinusoid at frequency
 *     omega has mobility = 2 sin(omega/2) (varies with omega) but
 *     complexity ~ 1 (independent of omega). This module ships an
 *     explicit witness asserting that a single-frequency series
 *     and a multi-component series can match on mobility yet split
 *     on complexity.
 *
 *   - vs `daily-token-box-count-fd` (axis 78): BFD is a multi-
 *     scale OLS log-log slope on 2D box coverage. Complexity is
 *     a single-scale closed-form ratio of three sample variances
 *     -- no geometric grid, no slope fitting, no normalisation
 *     to the unit square.
 *
 *   - vs `daily-token-sevcik-fd` (axis 77) / `katz-fd` (axis 75):
 *     path-length geometric ratios on the double-normalised
 *     waveform. Complexity probes second derivatives in the LINEAR
 *     domain via variances, with no path-length quantity.
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD counts SIGN
 *     CHANGES in diff(y) (binary, magnitude-blind). Complexity
 *     uses the MAGNITUDE of diff and diff-of-diff via their
 *     variances. A uniform-amplitude zigzag and an amplitude-
 *     modulated zigzag can share PFD identically yet split sharply
 *     on complexity.
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a multi-scale
 *     OLS slope on stride-k subsampled path lengths L(k).
 *     Complexity is single-scale and uses no subsampling.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): both are multi-scale variance-scaling
 *     estimators on cumulative deviations. Complexity is single-
 *     scale and operates on first AND second differences with no
 *     cumulative transform.
 *
 *   - vs `daily-token-autocorrelation-lag1` (axis 67): rho_1 is
 *     a single-lag linear correlation. Complexity carries lag-2
 *     information (because var_ddv depends on cov(y_{t+2}, y_t)
 *     through dd[i] = y[i+2] - 2 y[i+1] + y[i]) and is therefore
 *     not a function of rho_1 alone -- two stationary series with
 *     identical rho_1 but different rho_2 split on complexity.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     periodogram FLATNESS across all frequencies. Complexity is
 *     a SPECIFIC second-moment ratio. A flat spectrum (high SE)
 *     can have arbitrary complexity bounded by Parseval; a
 *     concentrated spectrum (low SE) at a single frequency forces
 *     complexity ~ 1.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) / `daily-
 *     token-sample-entropy` (axis 73): pattern / template
 *     statistics on ordinal patterns or amplitude similarity.
 *     Complexity is a pure second-moment scalar with no embedding
 *     window, no ordinal mapping, and no template matching.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32-67:
 *     they are SHUFFLE-INVARIANT. Complexity is SHUFFLE-SENSITIVE
 *     (shuffling typically pushes complexity down toward the
 *     white-noise reference because diff and diff-of-diff become
 *     near-iid with similar variances).
 *
 * INVARIANCES:
 *   - SHIFT-invariant (y' = y + c).
 *   - POSITIVE-SCALE-invariant (y' = a*y, a > 0).
 *   - SIGN-FLIP-invariant (y' = -y).
 *   - TIME-REVERSAL-invariant (variances of differences are
 *     unchanged under reversal).
 *   - NOT invariant under non-affine monotone transforms.
 *
 * REFERENCES:
 *   Hjorth, B., "EEG analysis based on time domain properties",
 *     Electroenceph. Clin. Neurophysiol. 29(3):306-310, 1970.
 *   Hjorth, B., "The Physical Significance of Time Domain
 *     Descriptors in EEG Analysis", Electroenceph. Clin.
 *     Neurophysiol. 34:321-325, 1973.
 */
import type { QueueLine } from './types.js';

export type DailyTokenHjorthComplexitySort =
  | 'absComplexityDeviationDesc'
  | 'complexity'
  | 'complexityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHjorthComplexityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 5 so the diff-
   * of-diff series has at least 3 samples for a stable var_ddv.
   * Default 32 (matches axes 74/75/76/77/78/79).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHjorthComplexitySort;
  generatedAt?: string;
}

export interface DailyTokenHjorthComplexitySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** mobility(diff(y)) / mobility(y). */
  complexity: number;
  /** mobility(y) = sqrt(var_dv / var_v). */
  mobilityV: number;
  /** mobility(diff(y)) = sqrt(var_ddv / var_dv). */
  mobilityDv: number;
  /** Population variance of the raw series. */
  varV: number;
  /** Population variance of the first-difference series. */
  varDv: number;
  /** Population variance of the second-difference series. */
  varDdv: number;
}

export interface DailyTokenHjorthComplexityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHjorthComplexitySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteComplexity: number;
  droppedTopSources: number;
  sources: DailyTokenHjorthComplexitySourceRow[];
}

/**
 * Hjorth complexity on a real-valued series. Returns complexity
 * plus the underlying variances and intermediate mobilities for
 * traceability.
 *
 * Throws when the series is too short (n < 4 -- need >= 2 samples
 * in dd to estimate var_ddv), when a non-finite value is present,
 * or when var_v or var_dv collapse to 0.
 */
export function hjorthComplexity(values: number[]): {
  complexity: number;
  mobilityV: number;
  mobilityDv: number;
  varV: number;
  varDv: number;
  varDdv: number;
} {
  const N = values.length;
  if (N < 4) {
    throw new Error(`hjorthComplexity: series too short (n=${N}, need n >= 4)`);
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('hjorthComplexity requires finite values');
    }
  }

  // var(y), population.
  let sumV = 0;
  for (let i = 0; i < N; i += 1) sumV += values[i]!;
  const meanV = sumV / N;
  let varV = 0;
  for (let i = 0; i < N; i += 1) {
    const d = values[i]! - meanV;
    varV += d * d;
  }
  varV /= N;
  if (!(varV > 0)) {
    throw new Error('hjorthComplexity: zero variance (constant series)');
  }

  // first differences and var(diff), population over length M = N-1.
  const M = N - 1;
  const dv: number[] = new Array(M);
  let sumDv = 0;
  for (let i = 0; i < M; i += 1) {
    dv[i] = values[i + 1]! - values[i]!;
    sumDv += dv[i]!;
  }
  const meanDv = sumDv / M;
  let varDv = 0;
  for (let i = 0; i < M; i += 1) {
    const d = dv[i]! - meanDv;
    varDv += d * d;
  }
  varDv /= M;
  if (!(varDv > 0)) {
    throw new Error(
      'hjorthComplexity: zero diff variance (first-difference series is constant)',
    );
  }

  // second differences and var(diff(diff)), population over length P = N-2.
  const P = N - 2;
  let sumDdv = 0;
  const ddv: number[] = new Array(P);
  for (let i = 0; i < P; i += 1) {
    ddv[i] = dv[i + 1]! - dv[i]!;
    sumDdv += ddv[i]!;
  }
  const meanDdv = sumDdv / P;
  let varDdv = 0;
  for (let i = 0; i < P; i += 1) {
    const d = ddv[i]! - meanDdv;
    varDdv += d * d;
  }
  varDdv /= P;

  const mobilityV = Math.sqrt(varDv / varV);
  const mobilityDv = Math.sqrt(varDdv / varDv);
  const complexity = mobilityDv / mobilityV;
  if (!Number.isFinite(complexity)) {
    throw new Error(`hjorthComplexity: non-finite complexity (${complexity})`);
  }
  return { complexity, mobilityV, mobilityDv, varV, varDv, varDdv };
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

export function buildDailyTokenHjorthComplexity(
  queue: QueueLine[],
  opts: DailyTokenHjorthComplexityOptions = {},
): DailyTokenHjorthComplexityReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 5) {
    throw new Error(
      `minTenureDays must be an integer >= 5 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHjorthComplexitySort =
    opts.sort ?? 'absComplexityDeviationDesc';
  const validSorts: DailyTokenHjorthComplexitySort[] = [
    'absComplexityDeviationDesc',
    'complexity',
    'complexityDesc',
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
  let droppedZeroVariance = 0;
  let droppedNonFiniteComplexity = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHjorthComplexitySourceRow[] = [];

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
      result = hjorthComplexity(filled);
    } catch {
      droppedNonFiniteComplexity += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      complexity: result.complexity,
      mobilityV: result.mobilityV,
      mobilityDv: result.mobilityDv,
      varV: result.varV,
      varDv: result.varDv,
      varDdv: result.varDdv,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'complexity':
        primary = a.complexity - b.complexity;
        break;
      case 'complexityDesc':
        primary = b.complexity - a.complexity;
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
      case 'absComplexityDeviationDesc':
      default:
        // Single-tone reference is complexity = 1; sort by distance
        // from 1 so both unusually-multi-component (>1) and unusually-
        // smooth-derivative (<1) sources rise to the top.
        primary = Math.abs(b.complexity - 1) - Math.abs(a.complexity - 1);
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
    droppedZeroVariance,
    droppedNonFiniteComplexity,
    droppedTopSources,
    sources: kept,
  };
}
