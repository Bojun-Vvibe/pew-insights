/**
 * daily-token-picard-aue-horvath-spectral-cusum-changepoint:
 * per-source FREQUENCY-DOMAIN spectral CUSUM changepoint
 * detector on the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-NINTH cross-source axis.
 *
 * Mechanism. Picard, D. (1985), "Testing and estimating
 * change-points in time series", *Adv. in Appl. Probab.*
 * 17(4): 841-867; Aue, A., Hormann, S., Horvath, L. and
 * Reimherr, M. (2009), "Break detection in the covariance
 * structure of multivariate time series models", *Ann.
 * Statist.* 37(6B): 4046-4087; Huskova, M., Praskova, Z.
 * and Steinebach, J. (2007), "On the detection of changes
 * in autoregressive time series I. Asymptotics", *J. Stat.
 * Plan. Inference* 137(4): 1243-1259.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total tokens
 * series for one source (n >= 21). Mean-center: y_t = x_t -
 * mean(x). Form the FOURIER COEFFICIENTS at the J = floor(
 * (n-1)/2) Fourier frequencies omega_j = 2 pi j / n,
 * j = 1..J:
 *
 *   a_j = sum_t y_t cos(omega_j t)                     (1)
 *   b_j = sum_t y_t sin(omega_j t)                     (2)
 *
 * The PERIODOGRAM at omega_j is
 *
 *   I(omega_j) = (a_j^2 + b_j^2) / n                   (3)
 *
 * Sub-band test. Pick a sub-band B = {j : j_lo <= j <= j_hi}
 * (default the LOW-FREQUENCY band j_lo = 1, j_hi = floor(J
 * / 4) — the band most informative for trend-like and
 * weekly-period activity). Define the BAND ENERGY
 *
 *   E_B(t) = (1/|B|) sum_{j in B} I_t(omega_j)         (4)
 *
 * computed locally from a sliding RECTANGULAR window of
 * length W (default min(28, floor(n/3))) centered at t.
 *
 * Spectral CUSUM. With S_t = sum_{i=1..t} E_B(i) the
 * cumulative band-energy series, the CUSUM statistic at
 * candidate split t is
 *
 *   C(t) = sqrt(t (n - t) / n) *
 *          | S_t / t - (S_n - S_t) / (n - t) |         (5)
 *
 * which (Picard 1985, eq. 2.4) is the standardised
 * difference of pre-/post-split MEAN BAND ENERGY. Under
 * the null of constant spectrum across [1, n], C(t) is
 * tight and bounded; under a spectrum-shift alternative
 * at tau, C(tau) -> infinity. The TEST STATISTIC is
 *
 *   C_max = max_t C(t),  tauStarBest = argmax_t C(t).  (6)
 *
 * Multiple changepoints by RECURSIVE binary segmentation
 * on the spectral-CUSUM curve, with stopping rule
 * C_max(segment) >= cThreshold * sigma_E where sigma_E
 * is the empirical SD of the local band-energy series
 * (default cThreshold = 2.5).
 *
 * Surfaces (deterministic, pure):
 *
 *   - mChangepoints: number of segmentation-detected CPs
 *     across the full series.
 *   - tauStar: ascending raw split indices.
 *   - tauStarDays: ISO YYYY-MM-DD per tauStar.
 *   - cMax: max over t of C(t) on the full series.
 *   - cArea: trapezoidal integral of C(t) over t.
 *   - cMean: mean of C(t).
 *   - tauStarBest: argmax t of C(t) on the full series.
 *   - tauStarBestDay: ISO YYYY-MM-DD of tauStarBest.
 *   - jLo, jHi, bandSize: Fourier sub-band actually used.
 *   - windowW: local periodogram window length used.
 *   - sigmaE: empirical SD of the local band-energy series.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 228 cross-source axes NONE operates in the
 * FOURIER FREQUENCY DOMAIN. Axis-229 is orthogonal along
 * three INDEPENDENT dimensions inside the changepoint
 * family:
 *
 *   1. REPRESENTATION DOMAIN. Spectral CUSUM operates on
 *      the PERIODOGRAM I(omega_j) — coefficients in a
 *      complex-exponential ORTHONORMAL basis at the n
 *      Fourier frequencies. Axes 221-227 operate on raw
 *      time-domain observations; axis-228 SSA operates on
 *      the time-domain Hankel DELAY embedding (basis is
 *      lagged copies of x). The Fourier basis and the
 *      Hankel column space are linearly independent
 *      representations: a periodicity flip whose mean,
 *      variance, and Hankel rank are preserved is invisible
 *      to all 228 prior axes but visible to axis-229
 *      because it shifts MASS BETWEEN FREQUENCY BANDS.
 *   2. WHAT IS DETECTED. Spectral CUSUM fires on changes
 *      in BAND ENERGY (a function of the spectral density
 *      restricted to B). Axes 221-227 fire on shifts in
 *      first/second moment or full distribution. Axis-228
 *      fires on shifts in the L-LAG SUBSPACE (column span
 *      of the Hankel matrix). Spectrum and subspace are
 *      related (Karhunen) but not equal: a sub-band
 *      energy-flip can occur with no rank change in the
 *      Hankel matrix when the flip is between in-subspace
 *      modes.
 *   3. ALGORITHMIC FAMILY. Spectral CUSUM combines a DFT
 *      (an n-point ORTHOGONAL TRANSFORM) with a Picard-
 *      style standardised partial-sum CUSUM (5). Axes
 *      221-227 use no orthogonal transform; axis-228 uses
 *      an SVD/Jacobi eigendecomposition of a Gram matrix.
 *      The DFT and the Gram-SVD are different
 *      decompositions with different invariances (DFT is
 *      shift-invariant in time, SVD is rotation-invariant
 *      in column space).
 *
 * Axis-229 is also orthogonal to all earlier trend /
 * variance / shape / dispersion axes (181-220) because
 * (a) those axes target TIME-DOMAIN moment / shape
 * functionals, while axis-229 targets the SUB-BAND ENERGY
 * of the spectral density, and (b) the spectral-CUSUM
 * statistic is invariant to time-domain location and
 * scale once the centred series has its sub-band fixed.
 *
 * Refs: Picard, D. (1985), *Adv. in Appl. Probab.* 17(4):
 * 841-867; Aue, A., Hormann, S., Horvath, L. and Reimherr,
 * M. (2009), *Ann. Statist.* 37(6B): 4046-4087; Huskova,
 * M., Praskova, Z. and Steinebach, J. (2007), *J. Stat.
 * Plan. Inference* 137(4): 1243-1259; Brillinger, D. R.
 * (1981), *Time Series: Data Analysis and Theory* (rev.
 * ed.), Holden-Day, ch. 5.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. PURE NUMERIC HELPERS (DFT, periodogram, CUSUM)
// =========================================================

/**
 * Naive O(n^2) DFT cosine/sine coefficients of x at the
 * J = floor((n-1)/2) Fourier frequencies omega_j = 2 pi j /
 * n, j = 1..J. Returns parallel arrays a[1..J], b[1..J]
 * (index 0 reserved / set to 0 to keep 1-based math).
 *
 * Suitable for small n (we cap source tenure at the daily
 * series level, typically n <= a few hundred).
 */
export function fourierCoefficients(
  x: number[],
): { a: number[]; b: number[]; J: number } {
  const n = x.length;
  if (!Number.isInteger(n) || n < 4) {
    throw new Error(`fourierCoefficients: need n >= 4 integer (got ${n})`);
  }
  const J = Math.floor((n - 1) / 2);
  const a = new Array<number>(J + 1).fill(0);
  const b = new Array<number>(J + 1).fill(0);
  for (let j = 1; j <= J; j += 1) {
    const w = (2 * Math.PI * j) / n;
    let ac = 0;
    let bs = 0;
    for (let t = 0; t < n; t += 1) {
      const v = x[t]!;
      ac += v * Math.cos(w * t);
      bs += v * Math.sin(w * t);
    }
    a[j] = ac;
    b[j] = bs;
  }
  return { a, b, J };
}

/**
 * Periodogram I(omega_j) = (a_j^2 + b_j^2) / n at the J
 * Fourier frequencies. Returns a length-(J+1) array with
 * I[0] = 0.
 */
export function periodogram(x: number[]): { I: number[]; J: number } {
  const n = x.length;
  const { a, b, J } = fourierCoefficients(x);
  const I = new Array<number>(J + 1).fill(0);
  for (let j = 1; j <= J; j += 1) {
    I[j] = (a[j]! * a[j]! + b[j]! * b[j]!) / n;
  }
  return { I, J };
}

/**
 * Mean of the periodogram restricted to a sub-band
 * B = {jLo, jLo+1, ..., jHi}.
 */
export function bandEnergy(I: number[], jLo: number, jHi: number): number {
  if (
    !Number.isInteger(jLo) ||
    !Number.isInteger(jHi) ||
    jLo < 1 ||
    jHi < jLo ||
    jHi >= I.length
  ) {
    throw new Error(
      `bandEnergy: need 1 <= jLo <= jHi < I.length (jLo=${jLo}, jHi=${jHi}, |I|=${I.length})`,
    );
  }
  let s = 0;
  for (let j = jLo; j <= jHi; j += 1) s += I[j]!;
  return s / (jHi - jLo + 1);
}

/**
 * Sliding local band-energy series: at each centre t in
 * [floor(W/2), n - 1 - floor(W/2)] take the rectangular
 * window x[t - W/2 .. t - W/2 + W - 1], compute its
 * periodogram and sub-band energy. Returns parallel arrays
 * eCurve[i] and tCenters[i] of equal length.
 */
export function slidingBandEnergy(
  x: number[],
  W: number,
  jLo: number,
  jHi: number,
): { eCurve: number[]; tCenters: number[] } {
  const n = x.length;
  if (!Number.isInteger(W) || W < 4) {
    throw new Error(`slidingBandEnergy: need W >= 4 integer (got ${W})`);
  }
  if (W > n) {
    throw new Error(`slidingBandEnergy: need W <= n (W=${W}, n=${n})`);
  }
  const half = Math.floor(W / 2);
  const eCurve: number[] = [];
  const tCenters: number[] = [];
  for (let t = half; t <= n - 1 - (W - 1 - half); t += 1) {
    const start = t - half;
    const slice = x.slice(start, start + W);
    // local mean-centre to make periodogram comparable.
    let mu = 0;
    for (let i = 0; i < W; i += 1) mu += slice[i]!;
    mu /= W;
    for (let i = 0; i < W; i += 1) slice[i] = slice[i]! - mu;
    let energy: number;
    try {
      const { I, J } = periodogram(slice);
      const lo = Math.max(1, Math.min(jLo, J));
      const hi = Math.max(lo, Math.min(jHi, J));
      energy = bandEnergy(I, lo, hi);
    } catch {
      energy = 0;
    }
    if (!Number.isFinite(energy) || energy < 0) energy = 0;
    eCurve.push(energy);
    tCenters.push(t);
  }
  return { eCurve, tCenters };
}

/**
 * Picard standardised partial-sum CUSUM curve of e[]:
 *
 *   C(t) = sqrt(t * (n - t) / n) *
 *          | S_t / t - (S_n - S_t) / (n - t) |
 *
 * for t = 1..n-1. Returns array of length n - 1 (1-based
 * conceptually; we store at index t-1).
 */
export function picardCusum(e: number[]): number[] {
  const n = e.length;
  if (n < 2) return [];
  const prefix = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i]! + e[i]!;
  const total = prefix[n]!;
  const C = new Array<number>(n - 1).fill(0);
  for (let t = 1; t < n; t += 1) {
    const left = prefix[t]! / t;
    const right = (total - prefix[t]!) / (n - t);
    const w = Math.sqrt((t * (n - t)) / n);
    const v = w * Math.abs(left - right);
    C[t - 1] = Number.isFinite(v) ? v : 0;
  }
  return C;
}

// =========================================================
// SECTION 2. SPECTRAL CUSUM CHANGEPOINT CORE
// =========================================================

export interface SpectralCusumResult {
  /** C(t) over candidate splits, length n - 1, in band-energy index space. */
  cCurve: number[];
  /** Map from cCurve index back to ORIGINAL series index. */
  tCentersForCusum: number[];
  /** Detected changepoint indices in ORIGINAL series space. */
  tauStar: number[];
  /** max over t of C(t) on the full series. */
  cMax: number;
  /** mean of C(t) on the full series. */
  cMean: number;
  /** trapezoidal integral of C(t). */
  cArea: number;
  /** argmax raw original-series index of C(t). */
  tauStarBest: number;
  /** Fourier sub-band actually used. */
  jLo: number;
  jHi: number;
  bandSize: number;
  /** Window W applied. */
  windowW: number;
  /** Empirical SD of the local band-energy series. */
  sigmaE: number;
}

export interface SpectralCusumOptions {
  windowW: number;
  jLo: number;
  jHi: number;
  cThreshold: number;
  /** Recursion depth cap (binary segmentation safety). Default 8. */
  maxDepth?: number;
  /** Minimum segment length (>= W). Default 2 W. */
  minSegment?: number;
}

/** Recursive binary-segmentation on the local band-energy series. */
function recursiveBinarySegment(
  e: number[],
  tCenters: number[],
  cThreshold: number,
  sigmaE: number,
  start: number,
  end: number,
  depth: number,
  maxDepth: number,
  minSegment: number,
  cps: number[],
): void {
  if (depth >= maxDepth) return;
  if (end - start < minSegment) return;
  const seg = e.slice(start, end);
  const C = picardCusum(seg);
  if (C.length === 0) return;
  let cMaxLocal = 0;
  let argmaxLocal = 0;
  for (let i = 0; i < C.length; i += 1) {
    if (C[i]! > cMaxLocal) {
      cMaxLocal = C[i]!;
      argmaxLocal = i;
    }
  }
  const cutoff = cThreshold * sigmaE;
  if (!(cMaxLocal >= cutoff) || cutoff <= 0) return;
  // argmaxLocal in [0, C.length-1] = [0, seg.length - 2] -> seg index argmaxLocal + 1.
  const localIdx = start + argmaxLocal + 1;
  if (localIdx <= start || localIdx >= end) return;
  const originalIdx = tCenters[localIdx]!;
  cps.push(originalIdx);
  recursiveBinarySegment(
    e,
    tCenters,
    cThreshold,
    sigmaE,
    start,
    localIdx,
    depth + 1,
    maxDepth,
    minSegment,
    cps,
  );
  recursiveBinarySegment(
    e,
    tCenters,
    cThreshold,
    sigmaE,
    localIdx,
    end,
    depth + 1,
    maxDepth,
    minSegment,
    cps,
  );
}

/**
 * Pure offline spectral-CUSUM changepoint scan.
 *
 * Throws on bad shape arguments.
 */
export function spectralCusumRun(
  x: number[],
  opts: SpectralCusumOptions,
): SpectralCusumResult {
  const n = x.length;
  const { windowW, jLo, jHi, cThreshold } = opts;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`spectralCusumRun: need n >= 1 integer (got ${n})`);
  }
  if (!Number.isInteger(windowW) || windowW < 4) {
    throw new Error(`spectralCusumRun: need windowW >= 4 integer (got ${windowW})`);
  }
  if (windowW > n) {
    throw new Error(`spectralCusumRun: need windowW <= n (W=${windowW}, n=${n})`);
  }
  if (!Number.isInteger(jLo) || jLo < 1) {
    throw new Error(`spectralCusumRun: need jLo >= 1 (got ${jLo})`);
  }
  if (!Number.isInteger(jHi) || jHi < jLo) {
    throw new Error(`spectralCusumRun: need jHi >= jLo (got ${jLo}, ${jHi})`);
  }
  if (!Number.isFinite(cThreshold) || cThreshold < 0) {
    throw new Error(`spectralCusumRun: cThreshold must be non-negative (got ${cThreshold})`);
  }
  const maxDepth = opts.maxDepth ?? 8;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error(`spectralCusumRun: maxDepth must be int >= 1 (got ${opts.maxDepth})`);
  }
  const minSegment = opts.minSegment ?? 2 * windowW;
  if (!Number.isInteger(minSegment) || minSegment < 2) {
    throw new Error(
      `spectralCusumRun: minSegment must be int >= 2 (got ${opts.minSegment})`,
    );
  }
  const { eCurve, tCenters } = slidingBandEnergy(x, windowW, jLo, jHi);
  if (eCurve.length < 2) {
    return {
      cCurve: [],
      tCentersForCusum: [],
      tauStar: [],
      cMax: 0,
      cMean: 0,
      cArea: 0,
      tauStarBest: -1,
      jLo,
      jHi,
      bandSize: jHi - jLo + 1,
      windowW,
      sigmaE: 0,
    };
  }
  // Empirical SD of e for the threshold-scaling.
  let mu = 0;
  for (let i = 0; i < eCurve.length; i += 1) mu += eCurve[i]!;
  mu /= eCurve.length;
  let varSum = 0;
  for (let i = 0; i < eCurve.length; i += 1) {
    const d = eCurve[i]! - mu;
    varSum += d * d;
  }
  const sigmaE = Math.sqrt(varSum / Math.max(1, eCurve.length - 1));
  const cCurve = picardCusum(eCurve);
  let cMax = 0;
  let cMaxIdx = 0;
  let cSum = 0;
  for (let i = 0; i < cCurve.length; i += 1) {
    const v = cCurve[i]!;
    cSum += v;
    if (v > cMax) {
      cMax = v;
      cMaxIdx = i;
    }
  }
  const cMean = cCurve.length > 0 ? cSum / cCurve.length : 0;
  let cArea = 0;
  for (let i = 0; i + 1 < cCurve.length; i += 1) {
    cArea += 0.5 * (cCurve[i]! + cCurve[i + 1]!);
  }
  // CUSUM index i corresponds to split between e[i] and e[i+1],
  // so the original-series tau is tCenters[i+1].
  const cps: number[] = [];
  recursiveBinarySegment(
    eCurve,
    tCenters,
    cThreshold,
    sigmaE,
    0,
    eCurve.length,
    0,
    maxDepth,
    Math.max(2, Math.min(eCurve.length, minSegment)),
    cps,
  );
  cps.sort((a, b) => a - b);
  // Deduplicate close-by detections (within W).
  const tauStar: number[] = [];
  for (const c of cps) {
    if (tauStar.length === 0 || c - tauStar[tauStar.length - 1]! > windowW) {
      tauStar.push(c);
    }
  }
  const tauStarBest =
    cMaxIdx + 1 < tCenters.length ? tCenters[cMaxIdx + 1]! : tCenters[tCenters.length - 1] ?? -1;
  return {
    cCurve,
    tCentersForCusum: tCenters,
    tauStar,
    cMax,
    cMean,
    cArea,
    tauStarBest,
    jLo,
    jHi,
    bandSize: jHi - jLo + 1,
    windowW,
    sigmaE,
  };
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenPicardAueHorvathSpectralCusumChangepointSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'cMax'
  | 'cMaxDesc'
  | 'cArea'
  | 'cAreaDesc'
  | 'cMean'
  | 'cMeanDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPicardAueHorvathSpectralCusumChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPicardAueHorvathSpectralCusumChangepointSort;
  /** Local periodogram window length W (>= 4). Default min(28, floor(n/3)). */
  windowW?: number;
  /** Sub-band lower index jLo (>= 1). Default 1. */
  jLo?: number;
  /** Sub-band upper index jHi (>= jLo). Default floor(J/4) computed per source. */
  jHi?: number;
  /** Threshold multiplier on sigma_E for binary segmentation. Default 2.5. */
  cThreshold?: number;
  /** Drop rows with mChangepoints == 0. */
  onlyWithCps?: boolean;
  generatedAt?: string;
}

export interface DailyTokenPicardAueHorvathSpectralCusumChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  tauStar: number[];
  tauStarDays: string[];
  cMax: number;
  cMean: number;
  cArea: number;
  tauStarBest: number;
  tauStarBestDay: string;
  windowW: number;
  jLo: number;
  jHi: number;
  bandSize: number;
  sigmaE: number;
  cThreshold: number;
}

export interface DailyTokenPicardAueHorvathSpectralCusumChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPicardAueHorvathSpectralCusumChangepointSort;
  windowW: number | null;
  jLo: number | null;
  jHi: number | null;
  cThreshold: number;
  onlyWithCps: boolean;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenPicardAueHorvathSpectralCusumChangepointSourceRow[];
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

/**
 * Per-source pure builder. Validates options, gap-fills,
 * runs spectral-CUSUM scan, returns a deterministic report.
 */
export function buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(
  queue: QueueLine[],
  opts: DailyTokenPicardAueHorvathSpectralCusumChangepointOptions = {},
): DailyTokenPicardAueHorvathSpectralCusumChangepointReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenPicardAueHorvathSpectralCusumChangepointSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenPicardAueHorvathSpectralCusumChangepointSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'cMax',
    'cMaxDesc',
    'cArea',
    'cAreaDesc',
    'cMean',
    'cMeanDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const explicitW = opts.windowW ?? null;
  if (explicitW !== null) {
    if (!Number.isInteger(explicitW) || explicitW < 4) {
      throw new Error(`windowW must be an integer >= 4 (got ${opts.windowW})`);
    }
  }
  const explicitJLo = opts.jLo ?? null;
  if (explicitJLo !== null) {
    if (!Number.isInteger(explicitJLo) || explicitJLo < 1) {
      throw new Error(`jLo must be an integer >= 1 (got ${opts.jLo})`);
    }
  }
  const explicitJHi = opts.jHi ?? null;
  if (explicitJHi !== null) {
    if (!Number.isInteger(explicitJHi) || explicitJHi < 1) {
      throw new Error(`jHi must be an integer >= 1 (got ${opts.jHi})`);
    }
    if (explicitJLo !== null && explicitJHi < explicitJLo) {
      throw new Error(
        `jHi must be >= jLo (jLo=${explicitJLo}, jHi=${explicitJHi})`,
      );
    }
  }
  const cThreshold = opts.cThreshold ?? 2.5;
  if (!Number.isFinite(cThreshold) || cThreshold < 0) {
    throw new Error(
      `cThreshold must be a non-negative finite number (got ${opts.cThreshold})`,
    );
  }
  const onlyWithCps = opts.onlyWithCps ?? false;
  if (typeof onlyWithCps !== 'boolean') {
    throw new Error(`onlyWithCps must be boolean (got ${opts.onlyWithCps})`);
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
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenPicardAueHorvathSpectralCusumChangepointSourceRow[] = [];

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
    for (let i = 0; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    const Wdefault = Math.max(4, Math.min(28, Math.floor(nTenure / 3)));
    const W = explicitW ?? Wdefault;
    if (W > nTenure) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const Jlocal = Math.floor((W - 1) / 2);
    if (Jlocal < 1) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const jLoEff = Math.max(1, Math.min(explicitJLo ?? 1, Jlocal));
    const jHiEff = Math.max(
      jLoEff,
      Math.min(explicitJHi ?? Math.max(jLoEff, Math.floor(Jlocal / 4)), Jlocal),
    );
    let result: SpectralCusumResult;
    try {
      result = spectralCusumRun(filled, {
        windowW: W,
        jLo: jLoEff,
        jHi: jHiEff,
        cThreshold,
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(result.cMax) ||
      !Number.isFinite(result.cMean) ||
      !Number.isFinite(result.cArea)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const tauStarDays = result.tauStar.map((t) => addUtcDays(acc.firstDay, t));
    const tauStarBestDay =
      result.tauStarBest >= 0 ? addUtcDays(acc.firstDay, result.tauStarBest) : '';
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mChangepoints: result.tauStar.length,
      tauStar: result.tauStar,
      tauStarDays,
      cMax: result.cMax,
      cMean: result.cMean,
      cArea: result.cArea,
      tauStarBest: result.tauStarBest,
      tauStarBestDay,
      windowW: W,
      jLo: result.jLo,
      jHi: result.jHi,
      bandSize: result.bandSize,
      sigmaE: result.sigmaE,
      cThreshold,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mChangepoints':
        primary = a.mChangepoints - b.mChangepoints;
        break;
      case 'mChangepointsDesc':
        primary = b.mChangepoints - a.mChangepoints;
        break;
      case 'cMax':
        primary = a.cMax - b.cMax;
        break;
      case 'cMaxDesc':
        primary = b.cMax - a.cMax;
        break;
      case 'cArea':
        primary = a.cArea - b.cArea;
        break;
      case 'cAreaDesc':
        primary = b.cArea - a.cArea;
        break;
      case 'cMean':
        primary = a.cMean - b.cMean;
        break;
      case 'cMeanDesc':
        primary = b.cMean - a.cMean;
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
  if (onlyWithCps) {
    kept = kept.filter((r) => r.mChangepoints > 0);
  }
  if (top > 0 && kept.length > top) {
    droppedTopSources = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    top,
    sort,
    windowW: explicitW,
    jLo: explicitJLo,
    jHi: explicitJHi,
    cThreshold,
    onlyWithCps,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
