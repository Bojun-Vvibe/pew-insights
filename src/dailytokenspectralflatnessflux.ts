/**
 * daily-token-spectral-flatness-flux: per-source SPECTRAL
 * FLATNESS FLUX (mean absolute frame-to-frame change in
 * Wiener flatness over a sliding window of the gap-filled
 * mean-centred daily total tokens series).
 *
 * ONE-HUNDRED-AND-FOURTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure. Slide a window of
 * length `windowSize` across the series with hop `hop`,
 * producing frames f[0], f[1], ..., f[F-1] where
 *     F = floor((n - windowSize) / hop) + 1.
 * For each frame f[i] of length W = windowSize, mean-centre
 * the frame in place and compute its one-sided non-DC
 * periodogram P_i[k] for k = 1..K = floor(W / 2). Compute
 * the WIENER SPECTRAL FLATNESS scalar of the frame
 *     phi_i = GM(P_i) / AM(P_i)   in   [0, 1]
 * (geometric over arithmetic mean of strictly positive bins;
 * frames with fewer than 2 positive-power bins or with zero
 * total power are surfaced as `nFramesZero` and excluded from
 * the pairing). Define the per-pair flatness flux as the
 * ABSOLUTE difference between consecutive surviving frames:
 *     flux[i->j] = | phi_j - phi_i |
 * The headline statistic is
 *     fluxMean = (1 / nPairs) * sum_{i->j} | phi_j - phi_i |
 * the AVERAGE absolute frame-to-frame Wiener-flatness change
 * over the tenure. Reported alongside fluxMean: fluxMax,
 * fluxMin, flatnessMean (mean of phi_i over surviving
 * frames), nFrames, nFramesZero, nPairs.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS:
 *
 *   - vs all static-spectrum axes 84-102: every prior axis
 *     collapses the WHOLE-tenure PSD to a single scalar via
 *     the periodogram operator and is therefore TIME-
 *     PERMUTATION INVARIANT on the frame multiset. Two
 *     series whose frames are the same multiset of windows
 *     in different temporal order have IDENTICAL whole-tenure
 *     PSDs and thus identical axes 84-102 outputs. Axis-104
 *     directly measures consecutive-frame |phi_{i+1}-phi_i|,
 *     so a frame reorder generally changes fluxMean.
 *
 *   - vs axis-103 (daily-token-spectral-flux, L2 distance
 *     between consecutive UNIT-ENERGY PSD VECTORS): axis-103
 *     measures the L2 distance between the full unit-energy
 *     PSD vectors Q_i and Q_j in K-dimensional space.
 *     Axis-104 measures only the change in a single SHAPE
 *     SCALAR phi_i (the geometric/arithmetic mean ratio).
 *     The two axes are not comonotone:
 *
 *       (a) Two frames can have identical Wiener flatness
 *           phi but be ORTHOGONAL as unit-energy PSD
 *           vectors. Example with K=4 bins: Q_i = (a,b,a,b)
 *           and Q_j = (b,a,b,a) for any positive a != b
 *           normalised to unit L2 energy. Both have phi =
 *           (ab)^{1/2} / ((a^2+b^2)/2)^{1/2} (same arithmetic
 *           and geometric means over the four bins because
 *           the multiset {a,b,a,b} = {b,a,b,a}). So axis-104
 *           yields per-pair flux = 0 while axis-103 yields a
 *           strictly positive per-pair flux equal to
 *           ||Q_j - Q_i||_2 = 2|a-b|.
 *
 *       (b) Conversely, two frames can have small L2 PSD
 *           distance but a sharp swing in phi. A small
 *           perturbation that shifts a tiny fraction of
 *           energy off a near-monochromatic spike onto a
 *           previously-zero bin can move phi from near 0
 *           (peaky) sharply, while ||Q_j - Q_i||_2 stays
 *           small.
 *
 *     Axis-104 therefore tracks the temporal evolution of
 *     PSD SHAPE PEAKINESS, not the temporal evolution of the
 *     full PSD vector. Bound: |phi_j - phi_i| <= 1 because
 *     phi in [0,1]; fluxMean in [0, 1]. (Tighter bound than
 *     axis-103's [0, sqrt(2)].)
 *
 *   - vs the time-domain Hjorth-mobility / Hjorth-complexity
 *     axes (79, 80) and Teager-Kaiser (81): those are
 *     POINTWISE successive-difference statistics on x itself.
 *     Axis-104 is a SLIDING-WINDOW change in a SHAPE SCALAR
 *     of sub-band PSDs.
 *
 *   - vs the curvature-sign-change-rate (82) and LZ
 *     complexity (83) axes: both are symbolic-sequence
 *     statistics on the time-domain signal. Axis-104 lives
 *     in the spectral domain on a per-frame basis.
 *
 *   - vs autocorrelation lag-1 / lag-7 axes: those are
 *     normalised inner products of the WHOLE series with
 *     itself; they do not decompose the series into
 *     temporally adjacent SPECTRAL SHAPE descriptors.
 *
 * Headline question:
 * **"For each source, how rapidly does the local spectral
 *   PEAKINESS (Wiener flatness) of its daily-token activity
 *   change, frame to frame, over its tenure?"**
 *
 * Caveats:
 *
 *   - fluxMean depends on `windowSize` and `hop`. Defaults are
 *     `windowSize = 7` (one calendar week) and `hop = 1`.
 *   - fluxMean is in [0, 1]. fluxMean = 0 iff every
 *     consecutive surviving frame has identical Wiener
 *     flatness (e.g., all frames are pure tones at distinct
 *     bins -- each has phi = 0). fluxMax = 1 is approached
 *     when consecutive frames swing between an exact pure
 *     tone (phi -> 0) and an exactly flat PSD (phi = 1).
 *     This bound is TIGHT in the closed-form sense: the
 *     test suite includes a witness frame pair (tone vs flat
 *     PSD on K = W/2 bins) for which fluxMean exceeds 0.75
 *     at W = 8 (the discrete-spectrum approximation of a
 *     perfectly flat PSD on a length-8 frame is bounded
 *     below 1 by the finite-bin leakage).
 *   - Frames whose mean-centred window has zero variance, or
 *     fewer than 2 strictly positive periodogram bins, are
 *     counted in `nFramesZero` and dropped from the pairing.
 *     If fewer than two surviving frames remain, the source
 *     is dropped as `droppedNoFramePair`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (window=7, hop=1):
 *   pew-insights daily-token-spectral-flatness-flux
 *
 *   # Non-overlapping weekly windows:
 *   pew-insights daily-token-spectral-flatness-flux \
 *     --window 7 --hop 7
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-spectral-flatness-flux \
 *     --source vscode-other --json
 *
 * References:
 *   Johnston, J. D., "Transform coding of audio signals
 *     using perceptual noise criteria", IEEE J. Sel. Areas
 *     Comm. 6(2), 1988 (Wiener flatness measure).
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press, 2012, secs. 3.3.3 (flatness) &
 *     3.3.4 (flux).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';
import { spectralFlatnessWiener } from './dailytokenspectralflatnesswiener.js';
import { frameSeries } from './dailytokenspectralflux.js';

export type DailyTokenSpectralFlatnessFluxSort =
  | 'fluxMean'
  | 'fluxMeanDesc'
  | 'fluxMax'
  | 'fluxMaxDesc'
  | 'flatnessMean'
  | 'flatnessMeanDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralFlatnessFluxOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor:
   * `windowSize + hop` so at least two frames can be cut.
   */
  minTenureDays?: number;
  /**
   * Sliding window length in days. Default 7. Must be an
   * integer >= 4 so K = floor(window/2) >= 2 spectral bins
   * are available per frame (Wiener flatness needs >= 2
   * positive-power bins).
   */
  windowSize?: number;
  /**
   * Sliding hop length in days. Default 1. Must be a
   * positive integer.
   */
  hop?: number;
  top?: number;
  sort?: DailyTokenSpectralFlatnessFluxSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralFlatnessFluxSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Total number of frames cut from the tenure series. */
  nFrames: number;
  /**
   * Frames whose mean-centred window had zero total power
   * OR fewer than 2 positive-power bins (Wiener flatness
   * undefined).
   */
  nFramesZero: number;
  /** Number of consecutive surviving-frame pairs in fluxMean. */
  nPairs: number;
  /** Number of one-sided Fourier bins K = floor(windowSize/2). */
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Mean per-frame Wiener flatness over surviving frames. */
  flatnessMean: number;
  /** Mean |phi_j - phi_i| between consecutive surviving frames. */
  fluxMean: number;
  /** Max consecutive-pair |phi_j - phi_i|. */
  fluxMax: number;
  /** Min consecutive-pair |phi_j - phi_i|. */
  fluxMin: number;
}

export interface DailyTokenSpectralFlatnessFluxReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  windowSize: number;
  hop: number;
  top: number;
  sort: DailyTokenSpectralFlatnessFluxSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNoFramePair: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralFlatnessFluxSourceRow[];
}

/**
 * Spectral-flatness-flux primitive on a list of length-W
 * frames. For each frame, computes the one-sided non-DC
 * periodogram, then the Wiener flatness scalar of its
 * positive-power bins. Frames with zero power, or with fewer
 * than 2 positive-power bins, are surfaced as nFramesZero
 * and skipped. Returns nFrames, nFramesZero, nPairs,
 * fluxMean, fluxMax, fluxMin, flatnessMean.
 *
 * Closed-form sanity anchors:
 *   - all frames identical -> consecutive |Δphi| = 0 ->
 *     fluxMean = 0.
 *   - alternating "pure tone" (phi ~ 0) and "flat" (phi = 1)
 *     frames -> consecutive |Δphi| ~ 1 -> fluxMean ~ 1.
 *
 * Throws "no frame pair" when fewer than two surviving
 * frames remain.
 */
export function spectralFlatnessFlux(frames: number[][]): {
  nFrames: number;
  nFramesZero: number;
  nPairs: number;
  fluxMean: number;
  fluxMax: number;
  fluxMin: number;
  flatnessMean: number;
} {
  const f = frames.length;
  if (f < 2) {
    throw new Error(
      `spectralFlatnessFlux: need at least 2 frames (got ${f})`,
    );
  }
  const flat: (number | null)[] = new Array(f);
  let flatSum = 0;
  let nZero = 0;
  for (let i = 0; i < f; i += 1) {
    const frame = frames[i]!;
    const w = frame.length;
    let mu = 0;
    for (const v of frame) {
      if (!Number.isFinite(v)) {
        throw new Error(
          `spectralFlatnessFlux: non-finite value in frame ${i}`,
        );
      }
      mu += v;
    }
    mu /= w;
    const centred = new Array<number>(w);
    for (let j = 0; j < w; j += 1) centred[j] = frame[j]! - mu;
    const psd = periodogramOneSided(centred);
    let total = 0;
    let positiveBins = 0;
    for (const p of psd) {
      total += p;
      if (p > 0) positiveBins += 1;
    }
    if (!(total > 0) || positiveBins < 2) {
      flat[i] = null;
      nZero += 1;
      continue;
    }
    let phi: number;
    try {
      phi = spectralFlatnessWiener(psd).flatness;
    } catch {
      flat[i] = null;
      nZero += 1;
      continue;
    }
    if (!Number.isFinite(phi)) {
      flat[i] = null;
      nZero += 1;
      continue;
    }
    flat[i] = phi;
    flatSum += phi;
  }
  let prev: number | null = null;
  let nPairs = 0;
  let sumFlux = 0;
  let maxFlux = -Infinity;
  let minFlux = +Infinity;
  for (let i = 0; i < f; i += 1) {
    const cur = flat[i];
    if (cur === null || cur === undefined) continue;
    if (prev !== null) {
      const fl = Math.abs(cur - prev);
      if (!Number.isFinite(fl)) {
        throw new Error(
          `spectralFlatnessFlux: non-finite flux at pair ending ${i}`,
        );
      }
      sumFlux += fl;
      if (fl > maxFlux) maxFlux = fl;
      if (fl < minFlux) minFlux = fl;
      nPairs += 1;
    }
    prev = cur;
  }
  if (nPairs === 0) {
    throw new Error(
      `spectralFlatnessFlux: no frame pair (every consecutive pair lost a frame to zero power or undefined flatness)`,
    );
  }
  const surviving = f - nZero;
  const flatnessMean = surviving > 0 ? flatSum / surviving : 0;
  return {
    nFrames: f,
    nFramesZero: nZero,
    nPairs,
    fluxMean: sumFlux / nPairs,
    fluxMax: maxFlux,
    fluxMin: minFlux,
    flatnessMean,
  };
}

/**
 * Daily-token spectral-flatness-flux primitive on a
 * real-valued series. Frames the series with the given
 * window/hop, then applies `spectralFlatnessFlux`.
 *
 * Throws when the series is too short, non-finite,
 * zero-variance, or yields fewer than two surviving frames.
 */
export function dailyTokenSpectralFlatnessFlux(
  values: number[],
  windowSize: number,
  hop: number,
): {
  mean: number;
  stddev: number;
  nFrames: number;
  nFramesZero: number;
  nPairs: number;
  nFreqBins: number;
  flatnessMean: number;
  fluxMean: number;
  fluxMax: number;
  fluxMin: number;
} {
  const n = values.length;
  if (!Number.isInteger(windowSize) || windowSize < 4) {
    throw new Error(
      `dailyTokenSpectralFlatnessFlux: windowSize must be an integer >= 4 (got ${windowSize})`,
    );
  }
  if (!Number.isInteger(hop) || hop < 1) {
    throw new Error(
      `dailyTokenSpectralFlatnessFlux: hop must be a positive integer (got ${hop})`,
    );
  }
  if (n < windowSize + hop) {
    throw new Error(
      `dailyTokenSpectralFlatnessFlux: series too short (n=${n}, need n >= windowSize + hop = ${windowSize + hop})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralFlatnessFlux requires finite values',
      );
    }
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error(
      'dailyTokenSpectralFlatnessFlux: zero variance (constant series)',
    );
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let varSum = 0;
  for (const v of values) {
    const d = v - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const frames = frameSeries(values, windowSize, hop);
  const res = spectralFlatnessFlux(frames);
  if (
    !Number.isFinite(res.fluxMean) ||
    !Number.isFinite(res.fluxMax) ||
    !Number.isFinite(res.fluxMin) ||
    !Number.isFinite(res.flatnessMean)
  ) {
    throw new Error(
      `dailyTokenSpectralFlatnessFlux: non-finite output (fluxMean=${res.fluxMean})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFrames: res.nFrames,
    nFramesZero: res.nFramesZero,
    nPairs: res.nPairs,
    nFreqBins: Math.floor(windowSize / 2),
    flatnessMean: res.flatnessMean,
    fluxMean: res.fluxMean,
    fluxMax: res.fluxMax,
    fluxMin: res.fluxMin,
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

export function buildDailyTokenSpectralFlatnessFlux(
  queue: QueueLine[],
  opts: DailyTokenSpectralFlatnessFluxOptions = {},
): DailyTokenSpectralFlatnessFluxReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const windowSize = opts.windowSize ?? 7;
  if (!Number.isInteger(windowSize) || windowSize < 4) {
    throw new Error(`windowSize must be an integer >= 4 (got ${opts.windowSize})`);
  }
  const hop = opts.hop ?? 1;
  if (!Number.isInteger(hop) || hop < 1) {
    throw new Error(`hop must be a positive integer (got ${opts.hop})`);
  }
  const minFloor = windowSize + hop;
  const minTenureDays = opts.minTenureDays ?? Math.max(16, minFloor);
  if (!Number.isInteger(minTenureDays) || minTenureDays < minFloor) {
    throw new Error(
      `minTenureDays must be an integer >= ${minFloor} (= windowSize+hop; got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralFlatnessFluxSort = opts.sort ?? 'fluxMeanDesc';
  const validSorts: DailyTokenSpectralFlatnessFluxSort[] = [
    'fluxMean',
    'fluxMeanDesc',
    'fluxMax',
    'fluxMaxDesc',
    'flatnessMean',
    'flatnessMeanDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
  let droppedZeroVariance = 0;
  let droppedNoFramePair = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralFlatnessFluxSourceRow[] = [];

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
      result = dailyTokenSpectralFlatnessFlux(filled, windowSize, hop);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('no frame pair')) {
        droppedNoFramePair += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    const row: DailyTokenSpectralFlatnessFluxSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nFrames: result.nFrames,
      nFramesZero: result.nFramesZero,
      nPairs: result.nPairs,
      nFreqBins: result.nFreqBins,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      flatnessMean: result.flatnessMean,
      fluxMean: result.fluxMean,
      fluxMax: result.fluxMax,
      fluxMin: result.fluxMin,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'fluxMean':
        primary = a.fluxMean - b.fluxMean;
        break;
      case 'fluxMeanDesc':
        primary = b.fluxMean - a.fluxMean;
        break;
      case 'fluxMax':
        primary = a.fluxMax - b.fluxMax;
        break;
      case 'fluxMaxDesc':
        primary = b.fluxMax - a.fluxMax;
        break;
      case 'flatnessMean':
        primary = a.flatnessMean - b.flatnessMean;
        break;
      case 'flatnessMeanDesc':
        primary = b.flatnessMean - a.flatnessMean;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
      default:
        primary = 0;
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
    windowSize,
    hop,
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
    droppedNoFramePair,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
