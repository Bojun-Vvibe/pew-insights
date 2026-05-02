/**
 * daily-token-spectral-centroid: per-source SPECTRAL CENTROID
 * (frequency-weighted mean of the power spectrum) of the gap-
 * filled daily total_tokens series, defined as the FIRST MOMENT
 * of the one-sided periodogram in bin-index units.
 *
 * EIGHTY-SIXTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length n:
 *
 *   1. Mean-centre y.
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2) (DC bin omitted; mean already removed).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; finite floor).
 *   4. Over the m surviving bins compute
 *
 *        centroidBin = sum_k ( k * P[k] ) / sum_k P[k]
 *
 *      which is the BIN-INDEX-WEIGHTED MEAN of the surviving
 *      power vector. centroidNormalised = centroidBin / K maps
 *      the result to (0, 1] so that values across series of
 *      different lengths are directly comparable: a low-
 *      frequency-dominated spectrum has centroidNormalised near
 *      1/K (~ 0), and a Nyquist-edge-dominated spectrum has
 *      centroidNormalised near 1.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - centroidNormalised ~ 0.05 - 0.20 : low-frequency mass --
 *     slow drift, weekly-or-longer cycles dominate.
 *   - centroidNormalised ~ 0.40 - 0.60 : balanced mid-band
 *     mass -- a noise-like or broadband spectrum.
 *   - centroidNormalised ~ 0.70 - 0.95 : high-frequency mass --
 *     near-Nyquist alternation dominates (day-to-day flips).
 *
 * REFERENCES:
 *
 *   Beauchamp, J. W., "Synthesis by spectral amplitude and
 *     'brightness' matching of analyzed musical instrument
 *     tones", J. Audio Eng. Soc. 30(6):396-406, 1982 (the
 *     "brightness" interpretation of the spectral centroid).
 *   Schubert, E., Wolfe, J., "Does timbral brightness scale
 *     with frequency and spectral centroid?", Acta Acust.
 *     United Acust. 92(5):820-825, 2006.
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM tech. report, 2004 (canonical
 *     spectral-centroid definition in MIR feature suites).
 *   Klapuri, A., Davy, M. (eds.), "Signal Processing Methods
 *     for Music Transcription", Springer, 2006, ch. 5
 *     (spectral centroid as a first-order frequency moment).
 *
 * STRUCTURAL ORTHOGONALITY -- a FIRST-MOMENT (frequency-weighted
 * mean) statistic on the Fourier power spectrum, distinct from
 * every shipped daily-token axis 32..85:
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM RATIO of the kept bins. It is
 *     BIN-PERMUTATION-INVARIANT -- you can shuffle the
 *     bin-index assignment of the same multiset of powers and
 *     the GM/AM ratio is unchanged. Centroid is the OPPOSITE:
 *     it is entirely about WHICH bin index carries the mass.
 *     A perfectly tilted 1/k power spectrum and the same bin
 *     VALUES randomly reshuffled across bin indices share
 *     IDENTICAL flatness but very different centroids. This is
 *     the precise orthogonality witness.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG slope of P[k] in log k. Centroid is the
 *     LINEAR first moment in k. Two spectra can share the same
 *     beta but very different centroids (a steep 1/k^2 spectrum
 *     concentrated in the lowest 4 bins vs a gentle 1/k^2
 *     spectrum spread across 64 bins -- both have beta ~ 2 but
 *     very different centroidBin / K). Symmetrically, centroid
 *     is well-defined on spectra that are NOT power laws at all
 *     (impulse trains, line spectra) where beta is meaningless.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral
 *     entropy is the SHANNON ENTROPY of the L1-normalised
 *     periodogram -- a SHAPE-DISPERSION statistic that is
 *     ALSO bin-permutation-invariant (depends only on the
 *     multiset of normalised probabilities, not on which k they
 *     sit at). Centroid is bin-permutation-SENSITIVE. A two-
 *     tone spectrum at bins (2, 8) and the same two-tone
 *     spectrum at bins (20, 26) share entropy = log 2 but have
 *     centroids 5 vs 23. Symmetrically, a flat spectrum and a
 *     spectrum that puts equal mass on bins (1, K) share
 *     centroid (K + 1) / 2 but very different entropies.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is a
 *     STRING-COMBINATORIAL phrase count on the median-binarised
 *     time-domain stream. Centroid is a CONTINUOUS frequency-
 *     weighted mean of the power spectrum. No closed-form link.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): sign counts of
 *     derivatives in the time domain (amplitude-blind).
 *     Centroid is a power-weighted spectral first moment.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     LOCAL TRIPLET energy operator in the TIME DOMAIN. While
 *     TKE is biased toward higher-frequency content via its
 *     y[i]^2 - y[i-1]*y[i+1] kernel, it is a TIME-DOMAIN sum,
 *     not a frequency moment, and is not normalised to (0, 1].
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `hjorth-
 *     complexity` (axis 80): Hjorth statistics are RATIOS of
 *     low-order spectral MOMENTS (variance of the first /
 *     second differences over variance of the series). Mobility
 *     is sqrt(m2 / m0) where m_i is the i-th MOMENT of the
 *     power spectrum in ANGULAR-FREQUENCY units. Centroid here
 *     is the FIRST moment in BIN-INDEX units, NORMALISED by K
 *     and by total power. They emphasise different orders and
 *     different normalisations -- mobility ~ sqrt(m2/m0) has a
 *     SECOND-moment numerator; centroid is m1/m0.
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): GEOMETRIC fractal
 *     dimensions on the time-domain curve; no closed-form link
 *     to a frequency-domain first moment.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): time-domain SCALING exponents.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; centroid is a whole-spectrum first moment.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant. Time-
 *     domain shuffling whitens the spectrum and drives the
 *     centroid toward the midpoint (K + 1) / 2 (~ 0.5 in
 *     normalised units); therefore centroid is TIME-DOMAIN-
 *     SHUFFLE-SENSITIVE.
 *
 * INVARIANCES of centroidNormalised:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     numerator and denominator both scale by a^2; the RATIO
 *     is unchanged. SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives the centroid toward (K + 1) / (2 K).
 *   - BIN-PERMUTATION (frequency reshuffle): NOT invariant --
 *     this is the key orthogonality witness vs flatness (85)
 *     and entropy (69), which are bin-permutation-INVARIANT.
 *
 * Bound: centroidBin in (0, K] strictly, attained at
 * centroidBin = K iff all mass is at the Nyquist bin. After
 * normalisation centroidNormalised = centroidBin / K lies in
 * (0, 1]. usableBins >= 2 is enforced (a single bin trivially
 * pins the centroid to that bin).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralCentroidSort =
  | 'centroid'
  | 'centroidDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralCentroidOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for a non-trivial centroid;
   * a single bin trivially pins the centroid to that bin).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralCentroidSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralCentroidSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of strictly-positive Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the moment. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** centroid in BIN INDEX units, in (0, K]. */
  centroidBin: number;
  /** centroidBin / K in (0, 1]. */
  centroidNormalised: number;
}

export interface DailyTokenSpectralCentroidReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralCentroidSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedTooFewUsableBins: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralCentroidSourceRow[];
}

/**
 * Spectral-centroid primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * { centroidBin, usableBins } where centroidBin = sum(k * p_k)
 * / sum(p_k) over bins with p > 0, and usableBins is the count
 * of those surviving bins.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when the total power is zero, or when fewer
 * than 2 bins survive the strictly-positive filter.
 */
export function spectralCentroidBin(power: number[]): {
  centroidBin: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralCentroidBin: empty power vector');
  }
  let m = 0;
  let weightedSum = 0;
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralCentroidBin: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralCentroidBin: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      // bin index in the human/spectral sense is i + 1
      // (k = 1..K of the one-sided periodogram).
      const binIndex = i + 1;
      weightedSum += binIndex * p;
      totalPower += p;
      m += 1;
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralCentroidBin: too few positive-power bins (${m}; need >= 2)`,
    );
  }
  if (totalPower <= 0) {
    throw new Error(
      `spectralCentroidBin: non-positive total power (${totalPower})`,
    );
  }
  const centroidBin = weightedSum / totalPower;
  return { centroidBin, usableBins: m };
}

/**
 * Daily-token spectral-centroid primitive on a real-valued
 * series. Computes the one-sided periodogram, evaluates the
 * frequency-weighted mean over bins with P[k] > 0, and returns
 * the centroid in bin-index units, the K-normalised centroid in
 * (0, 1], and the input mean / stddev / bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4 candidate
 * bins), when a non-finite value is present, when var(y) = 0
 * (every bin is exactly 0 power), or when fewer than 2 bins
 * survive the strictly-positive-power filter.
 */
export function dailyTokenSpectralCentroid(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  centroidBin: number;
  centroidNormalised: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralCentroid: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralCentroid requires finite values',
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
      'dailyTokenSpectralCentroid: zero variance (constant series)',
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

  const power = periodogramOneSided(values);
  const k = power.length;
  const { centroidBin, usableBins } = spectralCentroidBin(power);
  const centroidNormalised = centroidBin / k;
  if (
    !Number.isFinite(centroidBin) ||
    !Number.isFinite(centroidNormalised)
  ) {
    throw new Error(
      `dailyTokenSpectralCentroid: non-finite output (centroidBin=${centroidBin}, centroidNormalised=${centroidNormalised})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins,
    centroidBin,
    centroidNormalised,
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

export function buildDailyTokenSpectralCentroid(
  queue: QueueLine[],
  opts: DailyTokenSpectralCentroidOptions = {},
): DailyTokenSpectralCentroidReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralCentroidSort = opts.sort ?? 'centroidDesc';
  const validSorts: DailyTokenSpectralCentroidSort[] = [
    'centroid',
    'centroidDesc',
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
  let droppedZeroVariance = 0;
  let droppedTooFewUsableBins = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralCentroidSourceRow[] = [];

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
      result = dailyTokenSpectralCentroid(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('too few positive-power bins')) {
        droppedTooFewUsableBins += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nFreqBins: result.nFreqBins,
      usableBins: result.usableBins,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      centroidBin: result.centroidBin,
      centroidNormalised: result.centroidNormalised,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'centroid':
        primary = a.centroidNormalised - b.centroidNormalised;
        break;
      case 'centroidDesc':
        primary = b.centroidNormalised - a.centroidNormalised;
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
    droppedTooFewUsableBins,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
