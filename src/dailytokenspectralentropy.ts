/**
 * daily-token-spectral-entropy: per-source normalised Shannon entropy
 * of the periodogram of the gap-filled daily total_tokens series.
 *
 * SIXTY-NINTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (so we
 * have a dense, evenly-spaced length-N time series). Then:
 *
 *   1. Mean-centre x: y[i] = x[i] - mean(x).
 *   2. Compute the periodogram via direct DFT at the K = floor(N/2)
 *      strictly-positive Fourier frequencies (omit DC at k=0 and the
 *      Nyquist-only redundant tail):
 *
 *        P[k] = (1/N) * |sum_{n=0..N-1} y[n] * exp(-2*pi*i*k*n/N)|^2
 *             = (1/N) * (Re_k^2 + Im_k^2)
 *
 *      with Re_k = sum_n y[n] cos(2*pi*k*n/N),
 *           Im_k = sum_n y[n] sin(2*pi*k*n/N).
 *
 *   3. Normalise into a probability distribution over the K bins:
 *
 *        p[k] = P[k] / sum_j P[j]
 *
 *   4. Shannon entropy in nats then normalised by ln(K) into [0, 1]:
 *
 *        H = -sum_k p[k] * ln(p[k])
 *        H_norm = H / ln(K)         (K >= 2)
 *
 *      (Bins with p[k] = 0 contribute 0 by convention.)
 *
 * Headline question:
 * **"For each source, how spread out is the spectral mass of its
 *   daily-token series across all Fourier frequencies, vs concentrated
 *   in a few periodic components?"**
 *
 *   - H_norm = 1.0 : perfectly white spectrum, mass spread evenly
 *     across all frequency bins (no preferred period).
 *   - H_norm = 0.0 : a single Fourier bin carries 100% of the mass
 *     (a pure sinusoid at one period -- maximally non-white).
 *   - H_norm in between: partial periodicity / coloured noise.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT COVERED BY ANY SHIPPED AXIS 32..68:
 *
 *   - vs `daily-token-autocorrelation-lag1` and lag-7 (axes 67/68
 *     time-domain Pearson autocorrelation at a FIXED lag): those are
 *     a single scalar at a chosen lag k. Spectral entropy summarises
 *     the ENTIRE autocorrelation function via the Wiener-Khinchin
 *     dual: the periodogram is (asymptotically) the DFT of the
 *     autocovariance sequence. A series can have rho_1 = rho_7 = 0
 *     yet have non-trivial spectral mass concentrated at a 5-day or
 *     11-day period that lag-1 and lag-7 are blind to. Conversely
 *     two series with identical rho_1 and rho_7 can have wildly
 *     different spectral entropies because the rest of the ACF
 *     differs.
 *
 *   - vs `weekday-share` HHI: weekday-share is the calendar-aligned
 *     7-bucket aggregation. Spectral entropy is calendar-AGNOSTIC
 *     (a 5-day cycle has no special weekday alignment but produces
 *     a sharp spectral peak); and it sees ALL frequency bins, not
 *     just k = N/7.
 *
 *   - vs ALL permutation-invariant dispersion / shape axes 32..67
 *     (Gini, Atkinson, Theil, GE, Hoover, Pietra, Bonferroni,
 *     Mehran, Wolfson, Palma, Kolm-Pollak, Chakravarty, Amato,
 *     Esteban-Ray, Var-of-Logs, Log-MAD, FGT, PGR, IOM, MSR, DSG,
 *     QSR, MADM, Zenga, Hill, MC, L-skew): these throw away the
 *     temporal placement entirely. Shuffle the days and they are
 *     unchanged; spectral entropy collapses toward H_norm = 1
 *     (a permuted series has approximately white spectrum).
 *
 *   - vs calendar-order axes 60 (MSR), 64 (RTZ), monotone-run-
 *     length, second-diff-sign-runs, runs-test-z: those are SIGN-
 *     trace or RUN statistics on order patterns and ignore both
 *     magnitude AND specific frequency content. A series with a
 *     flat sign trace (alternating up/down) produces a sharp peak
 *     at the Nyquist frequency in the periodogram.
 *
 *   - vs `trend` / `forecast` / `source-daily-token-trend-slope`:
 *     these fit a LINEAR drift. A pure sinusoid has zero linear
 *     trend yet has a single sharp spectral peak (H_norm near 0).
 *     Spectral entropy explicitly de-trends only the mean (zeroth
 *     moment); higher-order drift contributes to the very-low-
 *     frequency bins, which is the correct treatment.
 *
 *   - vs `source-row-token-spectral-entropy` (row grain, on the
 *     row-level token sequence): row-grain spectral entropy
 *     measures the spectrum of the inter-row token sequence,
 *     where "frequency" indexes per-row positions and is sampling-
 *     rate dependent (rows-per-day varies wildly across sources).
 *     This DAY-grain spectral entropy lives on a uniformly-spaced
 *     1-sample-per-day grid, so frequency bin k corresponds to
 *     period N/k DAYS exactly. The two measure spectral
 *     concentration on incompatible time grids.
 *
 * Bound: H_norm in [0, 1]. flat=true marks sources with var(x)=0
 * across the gap-filled tenure (entropy reported as 0 to distinguish
 * "literally undefined" from "noisy zero").
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor; counts surface as droppedSparseSources.
 *   - `minTenureDays` (default 14): require gap-filled tenure >=
 *     this many calendar days. Hard structural floor is 4 (need
 *     K = floor(N/2) >= 2 frequency bins for entropy normalisation
 *     by ln(K) to be defined). We default to 14 so the periodogram
 *     has at least K = 7 bins and the normalised entropy has decent
 *     resolution.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'entropy'): 'entropy' (most-concentrated
 *     spectrum first; H_norm ascending) | 'entropyDesc' (whitest
 *     first; H_norm descending) | 'tokens' | 'tenure' | 'source'.
 *   - `maxEntropy`: display filter; hide non-flat rows with
 *     H_norm > this (surface only the most spectrally-concentrated
 *     sources).
 */
import type { QueueLine } from './types.js';

export type DailyTokenSpectralEntropySort =
  | 'entropy'
  | 'entropyDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Must be >= 4. Default 14. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralEntropySort;
  /** Display filter: drop non-flat rows with H_norm > this. null = no filter. */
  maxEntropy?: number | null;
  generatedAt?: string;
}

export interface DailyTokenSpectralEntropySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days = lastActive - firstActive + 1. */
  nTenureDays: number;
  /** Number of strictly-positive Fourier bins K = floor(nTenureDays / 2). */
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /**
   * Argmax frequency bin index k* in {1..K}. Period = nTenureDays / k*
   * days (the strongest periodic component). Reported as 0 when flat.
   */
  peakBin: number;
  /** p[k*] of the argmax bin. Reported as 0 when flat. */
  peakShare: number;
  /** Normalised Shannon entropy of the periodogram in [0, 1]. 0 with flat=true when var=0. */
  entropyNorm: number;
  /** True iff the gap-filled series is constant (entropy undefined). */
  flat: boolean;
}

export interface DailyTokenSpectralEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralEntropySort;
  maxEntropy: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedAboveMaxEntropy: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralEntropySourceRow[];
}

/**
 * Periodogram of a real-valued series via direct DFT at the K =
 * floor(N/2) strictly-positive Fourier frequencies. Returns the
 * raw bin powers P[1..K] (DC bin omitted because the input is
 * mean-centred and the Nyquist-only redundancy at N/2 is folded
 * once -- standard one-sided periodogram convention).
 *
 * This is O(N*K) = O(N^2/2). N here is calendar days per source,
 * which is small (tens to a few hundred), so an FFT is overkill
 * and would only add a dependency.
 */
export function periodogramOneSided(values: number[]): number[] {
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        `periodogramOneSided requires finite values (got ${v})`,
      );
    }
  }
  const n = values.length;
  if (n < 2) return [];
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  const y = values.map((v) => v - mu);
  const k = Math.floor(n / 2);
  const out: number[] = new Array(k);
  const twoPiOverN = (2 * Math.PI) / n;
  for (let f = 1; f <= k; f += 1) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t += 1) {
      const ang = twoPiOverN * f * t;
      re += y[t]! * Math.cos(ang);
      im -= y[t]! * Math.sin(ang);
    }
    out[f - 1] = (re * re + im * im) / n;
  }
  return out;
}

/**
 * Normalised Shannon entropy of a non-negative power spectrum
 * over K bins, normalised by ln(K) into [0, 1]. Bins with p=0
 * contribute 0. Returns { entropyNorm: 0, peakBin: 0, peakShare: 0,
 * flat: true } when the total power is 0 or K < 2.
 */
export function normalisedSpectralEntropy(power: number[]): {
  entropyNorm: number;
  peakBin: number;
  peakShare: number;
  flat: boolean;
} {
  for (const p of power) {
    if (!Number.isFinite(p) || p < 0) {
      throw new Error(
        `normalisedSpectralEntropy requires finite non-negative power (got ${p})`,
      );
    }
  }
  const k = power.length;
  if (k < 2) return { entropyNorm: 0, peakBin: 0, peakShare: 0, flat: true };
  let total = 0;
  for (const p of power) total += p;
  if (total === 0) return { entropyNorm: 0, peakBin: 0, peakShare: 0, flat: true };
  let h = 0;
  let argmax = 0;
  let argmaxP = -Infinity;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]! / total;
    if (p > 0) h -= p * Math.log(p);
    if (power[i]! > argmaxP) {
      argmaxP = power[i]!;
      argmax = i + 1; // 1-indexed Fourier bin
    }
  }
  let entropyNorm = h / Math.log(k);
  if (entropyNorm > 1) entropyNorm = 1;
  if (entropyNorm < 0) entropyNorm = 0;
  return {
    entropyNorm,
    peakBin: argmax,
    peakShare: argmaxP / total,
    flat: false,
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

export function buildDailyTokenSpectralEntropy(
  queue: QueueLine[],
  opts: DailyTokenSpectralEntropyOptions = {},
): DailyTokenSpectralEntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (spectral entropy normalisation by ln(K) requires K = floor(N/2) >= 2, i.e. N >= 4) (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const maxEntropy = opts.maxEntropy ?? null;
  if (
    maxEntropy !== null &&
    (!Number.isFinite(maxEntropy) || maxEntropy < 0 || maxEntropy > 1)
  ) {
    throw new Error(
      `maxEntropy must be a finite number in [0, 1] when set (got ${opts.maxEntropy})`,
    );
  }
  const sort: DailyTokenSpectralEntropySort = opts.sort ?? 'entropy';
  const validSorts: DailyTokenSpectralEntropySort[] = [
    'entropy',
    'entropyDesc',
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
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralEntropySourceRow[] = [];

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
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mu = 0;
    for (const v of filled) mu += v;
    mu /= nTenure;
    let varSum = 0;
    for (const v of filled) {
      const d = v - mu;
      varSum += d * d;
    }
    const stddev = Math.sqrt(varSum / nTenure);
    const power = periodogramOneSided(filled);
    const e = normalisedSpectralEntropy(power);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nFreqBins: power.length,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: mu,
      stddev,
      peakBin: e.peakBin,
      peakShare: e.peakShare,
      entropyNorm: e.entropyNorm,
      flat: e.flat,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedAboveMaxEntropy = 0;
  let filtered = rows;
  if (maxEntropy !== null) {
    const next: DailyTokenSpectralEntropySourceRow[] = [];
    for (const r of rows) {
      if (r.flat) next.push(r);
      else if (r.entropyNorm <= maxEntropy) next.push(r);
      else droppedAboveMaxEntropy += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'entropyDesc':
        primary = b.entropyNorm - a.entropyNorm;
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
      case 'entropy':
      default:
        primary = a.entropyNorm - b.entropyNorm;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
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
    minTenureDays,
    top,
    sort,
    maxEntropy,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedAboveMaxEntropy,
    droppedTopSources,
    sources: kept,
  };
}
