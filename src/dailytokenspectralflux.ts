/**
 * daily-token-spectral-flux: per-source SPECTRAL FLUX
 * (mean L2 norm of frame-to-frame PSD differences over a
 * sliding window of the gap-filled mean-centred daily total
 * tokens series).
 *
 * ONE-HUNDRED-AND-THIRD cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure. Slide a window of
 * length `windowSize` across the series with hop `hop`,
 * producing frames f[0], f[1], ..., f[F-1] where
 *     F = floor((n - windowSize) / hop) + 1.
 * For each frame f[i] of length W = windowSize, mean-centre
 * the frame in place and compute its one-sided non-DC
 * periodogram P_i[k] for k = 1..K = floor(W / 2). L2-NORMALISE
 * each frame's PSD to unit energy:
 *     Q_i[k] = P_i[k] / ||P_i||_2
 * (frames whose total power is zero -- a constant frame --
 * are surfaced as `nFramesZero` and excluded from the flux
 * average; the surrounding frame-pair gaps are bridged).
 * Spectral flux between consecutive surviving frames i and j
 * (the next surviving frame after i) is
 *     flux[i->j] = sqrt( sum_{k=1..K} (Q_j[k] - Q_i[k])^2 )
 *               = ||Q_j - Q_i||_2
 * The headline statistic is
 *     fluxMean = (1/Npairs) * sum_{i->j} flux[i->j]
 * the AVERAGE frame-to-frame spectral L2 distance of the
 * unit-energy PSDs over the tenure. Reported alongside
 * fluxMean: fluxMax, fluxMin, nFrames, nFramesZero, nPairs.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS:
 *
 *   - vs ALL static-spectrum axes 84-102 (DFT-slope, Wiener-
 *     flatness, centroid, bandwidth, rolloff, crest, skew,
 *     decrease, irregularity, spread-iqr, roughness, peak,
 *     second-peak, tail-flatness, Renyi-2/half/3, contrast):
 *     every prior axis collapses the WHOLE-tenure PSD to a
 *     single scalar and is therefore TIME-PERMUTATION
 *     INVARIANT on the frame sequence. Specifically, two
 *     series whose frames are the same MULTISET of windows
 *     (just re-ordered in time) have IDENTICAL whole-tenure
 *     PSDs (the periodogram operator does not see frame
 *     order; it sees the global cosine/sine projections), so
 *     all axes 84-102 produce identical scalars on a frame
 *     reshuffle. Axis-103 is FRAME-ORDER SENSITIVE: shuffling
 *     the frame multiset generally changes the consecutive
 *     differences ||Q_{i+1} - Q_i||_2 and therefore changes
 *     fluxMean.
 *
 *   - vs the time-domain Hjorth-mobility / Hjorth-complexity
 *     axes (79, 80) and Teager-Kaiser (81): those are
 *     POINTWISE successive-difference statistics on x itself
 *     (first-difference variance, second-difference variance,
 *     pointwise instantaneous energy). Axis-103 is a
 *     SLIDING-WINDOW spectral L2 distance between SUB-band
 *     PSDs across ENTIRE windows, not single samples. Two
 *     series with identical Hjorth mobility / complexity can
 *     have arbitrarily different fluxMean depending on
 *     whether their window-local frequency content is
 *     piecewise constant (low flux) or rapidly drifting
 *     (high flux).
 *
 *   - vs sample/permutation/approximate entropy on the time
 *     series (axes 71, 73, 74): those are pattern-recurrence
 *     entropies on amplitude embeddings. Axis-103 is a
 *     spectral-domain L2 frame distance.
 *
 *   - vs the curvature-sign-change-rate axis (82) and the LZ
 *     complexity axis (83): both are symbolic-sequence
 *     statistics on the time-domain signal. Axis-103 lives
 *     in the SPECTRAL domain on a per-frame basis.
 *
 *   - vs the autocorrelation lag-1 / lag-7 axes: those are
 *     normalised inner products of the WHOLE series with
 *     itself at a single lag; they do not decompose the
 *     series into temporally adjacent SPECTRAL fingerprints.
 *
 * Headline question:
 * **"For each source, how rapidly does the local frequency
 *   content of its daily-token activity drift, frame to
 *   frame, over its tenure?"**
 *
 * Caveats:
 *
 *   - fluxMean depends on `windowSize` and `hop`. Defaults are
 *     `windowSize = 7` (one calendar week) and `hop = 1` (slide
 *     by one day). With `hop = windowSize` the windows are
 *     non-overlapping; with `hop < windowSize` they overlap.
 *   - fluxMean is in [0, sqrt(2)]: each Q_i is a unit L2 vector,
 *     so ||Q_j - Q_i||_2 <= ||Q_j||_2 + ||Q_i||_2 = 2 by the
 *     triangle inequality, and the maximum achievable on the
 *     unit sphere of K dimensions is sqrt(2) (when Q_j and
 *     Q_i are orthogonal unit vectors). Two identical PSDs
 *     give flux = 0.
 *   - Frames whose mean-centred window has zero variance
 *     (constant window) yield zero PSD power; those frames
 *     are counted in `nFramesZero` and dropped from the
 *     pairing. If fewer than two surviving frames remain,
 *     the source is dropped as `droppedNoFramePair`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (window=7, hop=1):
 *   pew-insights daily-token-spectral-flux
 *
 *   # Non-overlapping weekly windows:
 *   pew-insights daily-token-spectral-flux --window 7 --hop 7
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-spectral-flux \
 *     --source vscode-other --json
 *
 * References:
 *   Tzanetakis, G. & Cook, P., "Musical genre classification
 *     of audio signals", IEEE Trans. Speech Audio Proc.
 *     10(5), 2002, eq. 3 (spectral flux).
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press, 2012, sec. 3.3.4.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralFluxSort =
  | 'fluxMean'
  | 'fluxMeanDesc'
  | 'fluxMax'
  | 'fluxMaxDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralFluxOptions {
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
   * integer >= 4 (so K = floor(window/2) >= 2 spectral bins
   * are available per frame).
   */
  windowSize?: number;
  /**
   * Sliding hop length in days. Default 1. Must be a positive
   * integer.
   */
  hop?: number;
  top?: number;
  sort?: DailyTokenSpectralFluxSort;
  generatedAt?: string;
  /**
   * When true, include per-source `framePsdEnergy` summary in
   * the report (mean of pre-normalised total power per frame).
   * Off by default to keep the JSON tight; tests use it to
   * pin internal behaviour.
   */
  debug?: boolean;
}

export interface DailyTokenSpectralFluxSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Total number of frames cut from the tenure series. */
  nFrames: number;
  /** Frames whose mean-centred window had zero total power. */
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
  /** Mean L2 distance between consecutive unit-energy PSDs. */
  fluxMean: number;
  /** Max consecutive-pair L2 distance. */
  fluxMax: number;
  /** Min consecutive-pair L2 distance. */
  fluxMin: number;
  /**
   * Optional debug stat: mean of pre-normalisation total
   * frame power. Only present when opts.debug = true.
   */
  framePsdEnergy?: number;
}

export interface DailyTokenSpectralFluxReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  windowSize: number;
  hop: number;
  top: number;
  sort: DailyTokenSpectralFluxSort;
  source: string | null;
  debug: boolean;
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
  sources: DailyTokenSpectralFluxSourceRow[];
}

/**
 * Cut frames from a series with given window size and hop.
 * Returns a list of length-W slices in chronological order.
 *
 * Throws on bad geometry (window < 1, hop < 1, or n < window).
 */
export function frameSeries(
  values: number[],
  windowSize: number,
  hop: number,
): number[][] {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new Error(`frameSeries: windowSize must be a positive integer (got ${windowSize})`);
  }
  if (!Number.isInteger(hop) || hop < 1) {
    throw new Error(`frameSeries: hop must be a positive integer (got ${hop})`);
  }
  const n = values.length;
  if (n < windowSize) {
    throw new Error(`frameSeries: series too short (n=${n}, windowSize=${windowSize})`);
  }
  const f = Math.floor((n - windowSize) / hop) + 1;
  const out: number[][] = new Array(f);
  for (let i = 0; i < f; i += 1) {
    const start = i * hop;
    const slice = new Array<number>(windowSize);
    for (let j = 0; j < windowSize; j += 1) {
      slice[j] = values[start + j]!;
    }
    out[i] = slice;
  }
  return out;
}

/**
 * Spectral-flux primitive on a list of length-W frames.
 * Computes the one-sided non-DC periodogram of each frame,
 * L2-normalises it (zero-power frames are surfaced and
 * skipped), then averages the L2 distance between consecutive
 * surviving-frame PSDs.
 *
 * Closed-form sanity anchors:
 *   - all frames identical -> every consecutive pair has
 *     flux = 0 -> fluxMean = 0.
 *   - alternating pure-tone frames at distinct frequencies ->
 *     unit PSDs concentrated on different bins -> consecutive
 *     L2 distance = sqrt(2) per pair -> fluxMean = sqrt(2).
 *
 * Returns nFrames, nFramesZero, nPairs, fluxMean, fluxMax,
 * fluxMin, framePsdEnergy. When fewer than two surviving
 * frames remain, throws "no frame pair".
 */
export function spectralFlux(frames: number[][]): {
  nFrames: number;
  nFramesZero: number;
  nPairs: number;
  fluxMean: number;
  fluxMax: number;
  fluxMin: number;
  framePsdEnergy: number;
} {
  const f = frames.length;
  if (f < 2) {
    throw new Error(`spectralFlux: need at least 2 frames (got ${f})`);
  }
  const unit: (number[] | null)[] = new Array(f);
  let energySum = 0;
  let nZero = 0;
  for (let i = 0; i < f; i += 1) {
    const frame = frames[i]!;
    const w = frame.length;
    let mu = 0;
    for (const v of frame) {
      if (!Number.isFinite(v)) {
        throw new Error(`spectralFlux: non-finite value in frame ${i}`);
      }
      mu += v;
    }
    mu /= w;
    const centred = new Array<number>(w);
    for (let j = 0; j < w; j += 1) centred[j] = frame[j]! - mu;
    const psd = periodogramOneSided(centred);
    let total = 0;
    for (const p of psd) total += p;
    if (!(total > 0)) {
      unit[i] = null;
      nZero += 1;
      continue;
    }
    energySum += total;
    let sq = 0;
    for (const p of psd) sq += p * p;
    const norm = Math.sqrt(sq);
    if (!(norm > 0)) {
      unit[i] = null;
      nZero += 1;
      continue;
    }
    const u = new Array<number>(psd.length);
    for (let k = 0; k < psd.length; k += 1) u[k] = psd[k]! / norm;
    unit[i] = u;
  }
  let prev: number[] | null = null;
  let nPairs = 0;
  let sumFlux = 0;
  let maxFlux = -Infinity;
  let minFlux = +Infinity;
  for (let i = 0; i < f; i += 1) {
    const cur = unit[i];
    if (cur === null) continue;
    if (prev !== null) {
      let sq = 0;
      for (let k = 0; k < cur.length; k += 1) {
        const d = cur[k]! - prev[k]!;
        sq += d * d;
      }
      const fl = Math.sqrt(sq);
      if (!Number.isFinite(fl)) {
        throw new Error(`spectralFlux: non-finite flux at pair ending ${i}`);
      }
      sumFlux += fl;
      if (fl > maxFlux) maxFlux = fl;
      if (fl < minFlux) minFlux = fl;
      nPairs += 1;
    }
    prev = cur;
  }
  if (nPairs === 0) {
    throw new Error(`spectralFlux: no frame pair (every consecutive pair lost a frame to zero power)`);
  }
  const surviving = f - nZero;
  const framePsdEnergy = surviving > 0 ? energySum / surviving : 0;
  return {
    nFrames: f,
    nFramesZero: nZero,
    nPairs,
    fluxMean: sumFlux / nPairs,
    fluxMax: maxFlux,
    fluxMin: minFlux,
    framePsdEnergy,
  };
}

/**
 * Daily-token spectral-flux primitive on a real-valued
 * series. Frames the series with the given window/hop, then
 * applies `spectralFlux` to the resulting frames.
 *
 * Throws when the series is too short, non-finite,
 * zero-variance, or yields fewer than two surviving frames.
 */
export function dailyTokenSpectralFlux(
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
  fluxMean: number;
  fluxMax: number;
  fluxMin: number;
  framePsdEnergy: number;
} {
  const n = values.length;
  if (!Number.isInteger(windowSize) || windowSize < 4) {
    throw new Error(
      `dailyTokenSpectralFlux: windowSize must be an integer >= 4 (got ${windowSize})`,
    );
  }
  if (!Number.isInteger(hop) || hop < 1) {
    throw new Error(`dailyTokenSpectralFlux: hop must be a positive integer (got ${hop})`);
  }
  if (n < windowSize + hop) {
    throw new Error(
      `dailyTokenSpectralFlux: series too short (n=${n}, need n >= windowSize + hop = ${windowSize + hop})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenSpectralFlux requires finite values');
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
    throw new Error('dailyTokenSpectralFlux: zero variance (constant series)');
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
  const res = spectralFlux(frames);
  if (
    !Number.isFinite(res.fluxMean) ||
    !Number.isFinite(res.fluxMax) ||
    !Number.isFinite(res.fluxMin)
  ) {
    throw new Error(
      `dailyTokenSpectralFlux: non-finite output (fluxMean=${res.fluxMean})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFrames: res.nFrames,
    nFramesZero: res.nFramesZero,
    nPairs: res.nPairs,
    nFreqBins: Math.floor(windowSize / 2),
    fluxMean: res.fluxMean,
    fluxMax: res.fluxMax,
    fluxMin: res.fluxMin,
    framePsdEnergy: res.framePsdEnergy,
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

export function buildDailyTokenSpectralFlux(
  queue: QueueLine[],
  opts: DailyTokenSpectralFluxOptions = {},
): DailyTokenSpectralFluxReport {
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
  const sort: DailyTokenSpectralFluxSort = opts.sort ?? 'fluxMeanDesc';
  const validSorts: DailyTokenSpectralFluxSort[] = [
    'fluxMean',
    'fluxMeanDesc',
    'fluxMax',
    'fluxMaxDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const sourceFilter = opts.source ?? null;
  const debug = opts.debug ?? false;

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
  const rows: DailyTokenSpectralFluxSourceRow[] = [];

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
      result = dailyTokenSpectralFlux(filled, windowSize, hop);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('no frame pair')) {
        droppedNoFramePair += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    const row: DailyTokenSpectralFluxSourceRow = {
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
      fluxMean: result.fluxMean,
      fluxMax: result.fluxMax,
      fluxMin: result.fluxMin,
    };
    if (debug) row.framePsdEnergy = result.framePsdEnergy;
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
    debug,
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
