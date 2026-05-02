/**
 * daily-token-spectral-bandwidth: per-source SPECTRAL BANDWIDTH
 * (frequency-weighted standard deviation of the power spectrum
 * about its centroid) of the gap-filled daily total_tokens
 * series, defined as the SECOND CENTRAL MOMENT (square root) of
 * the one-sided periodogram in bin-index units.
 *
 * EIGHTY-SEVENTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length
 * n:
 *
 *   1. Mean-centre y.
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2) (DC bin omitted; mean already removed).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; finite floor).
 *   4. Over the m surviving bins compute the centroid
 *
 *        centroidBin = sum_k ( k * P[k] ) / sum_k P[k]
 *
 *      and the second central moment about the centroid
 *
 *        m2 = sum_k ( (k - centroidBin)^2 * P[k] ) / sum_k P[k]
 *
 *      then
 *
 *        bandwidthBin = sqrt(m2)
 *
 *      i.e. the BIN-INDEX-WEIGHTED STANDARD DEVIATION of the
 *      surviving power vector. bandwidthNormalised = bandwidthBin
 *      / K maps the result to [0, 1) so values across series of
 *      different lengths are directly comparable: a sharp pure
 *      tone has bandwidthNormalised near 0, a uniformly
 *      distributed (white) spectrum approaches the variance of
 *      a discrete uniform on [1, K] which is (K^2 - 1)/12, so
 *      bandwidthNormalised approaches sqrt((K^2 - 1)/12)/K ->
 *      1/sqrt(12) ~ 0.2887 in the K->infty limit; spectra with
 *      mass split between bin 1 and bin K can push bandwidthBin
 *      arbitrarily close to (K - 1)/2, hence
 *      bandwidthNormalised -> 1/2.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - bandwidthNormalised < 0.05 : sharply concentrated spectrum
 *     (near pure-tone -- almost all power in a narrow bin
 *     neighbourhood of the centroid).
 *   - bandwidthNormalised ~ 0.10 - 0.25 : moderately spread
 *     spectrum (the typical pink-/red-noise regime).
 *   - bandwidthNormalised ~ 0.25 - 0.30 : white-noise-like
 *     uniform spread (asymptote 1/sqrt(12) ~ 0.2887).
 *   - bandwidthNormalised > 0.35 : bipolar split (mass at both
 *     low- and high-frequency edges; toward the limit 1/2).
 *
 * REFERENCES:
 *
 *   Klapuri, A., "Wide-band pitch estimation for natural
 *     sound sources with inharmonicities", AES 106th
 *     Convention, Munich, 1999 (definition of spectral spread
 *     as the second central moment of the spectrum).
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM tech. report, 2004 -- §6.1
 *     defines spectral spread as
 *     sqrt( sum_k (f[k] - centroid)^2 * P[k] / sum_k P[k] ),
 *     the canonical MIR definition adopted here in bin-index
 *     units.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 (spectral spread
 *     as the standard deviation of the spectrum around the
 *     centroid).
 *   Klapuri, A., Davy, M. (eds.), "Signal Processing Methods
 *     for Music Transcription", Springer, 2006, ch. 5
 *     (spectral spread as a second-order frequency moment).
 *
 * STRUCTURAL ORTHOGONALITY -- a SECOND-CENTRAL-MOMENT (about
 * the centroid) statistic on the Fourier power spectrum,
 * distinct from every shipped daily-token axis 32..86:
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid is
 *     the FIRST moment about zero; bandwidth is the SECOND
 *     CENTRAL moment (about the centroid). Two spectra can
 *     share the same centroid but have very different
 *     bandwidths -- a pure tone at bin (K+1)/2 and a two-bin
 *     spectrum with equal mass at bins 1 and K both have
 *     centroid (K+1)/2 but bandwidth 0 vs (K-1)/2. Symmetrically
 *     two spectra can share the same bandwidth at very
 *     different centroids (location-shifted Gaussians on the
 *     bin axis). This is the precise orthogonality witness vs
 *     axis 86 -- they are statistically independent moment
 *     orders of the same underlying distribution.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM RATIO of the kept bins and is
 *     BIN-PERMUTATION-INVARIANT. Bandwidth is the OPPOSITE: it
 *     depends on WHICH bin index carries the mass (the
 *     deviations are computed in the bin-index metric). A
 *     perfectly tilted 1/k power spectrum and the same bin
 *     VALUES randomly reshuffled across bin indices share
 *     IDENTICAL flatness but different bandwidths.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG slope of P[k] in log k. Bandwidth is a
 *     LINEAR second-central-moment in k. Two spectra can share
 *     the same beta but very different bandwidths (a steep
 *     1/k^2 spectrum spread across 64 bins vs the same beta
 *     concentrated in the lowest 4 bins -- both have beta ~ 2
 *     but very different bandwidths). Bandwidth is also well-
 *     defined on spectra that are NOT power laws at all (line
 *     spectra, impulse trains) where beta is meaningless.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral
 *     entropy is the SHANNON ENTROPY of the L1-normalised
 *     periodogram -- a SHAPE-DISPERSION statistic that is
 *     ALSO bin-permutation-invariant. Bandwidth is bin-
 *     permutation-SENSITIVE. A two-tone spectrum at bins (2,8)
 *     and the same two-tone spectrum at bins (20,26) share
 *     entropy = log 2 but bandwidths 3 vs 3 -- but flip one
 *     two-tone to bins (1, K) and the second has much larger
 *     bandwidth at the same entropy. Symmetrically a flat
 *     spectrum and a spectrum that puts equal mass on bins
 *     (1, K) share centroid (K+1)/2 but very different
 *     entropies AND very different bandwidths.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is a
 *     STRING-COMBINATORIAL phrase count on the median-binarised
 *     time-domain stream. Bandwidth is a CONTINUOUS frequency-
 *     weighted second central moment of the power spectrum. No
 *     closed-form link.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): sign counts of
 *     derivatives in the time domain (amplitude-blind).
 *     Bandwidth is a power-weighted spectral second central
 *     moment.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     LOCAL TRIPLET energy operator in the TIME DOMAIN. While
 *     TKE responds to high-frequency content via its
 *     y[i]^2 - y[i-1]*y[i+1] kernel, it is a TIME-DOMAIN sum,
 *     not a frequency moment, and is not normalised to a
 *     bounded interval.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `hjorth-
 *     complexity` (axis 80): Hjorth statistics are RATIOS of
 *     low-order spectral MOMENTS in ANGULAR-FREQUENCY units.
 *     Mobility is sqrt(m_2 / m_0) -- a NON-CENTRAL second
 *     moment ratio (about zero). Bandwidth here is the
 *     CENTRAL second moment about the CENTROID, in BIN-INDEX
 *     units, NORMALISED by K. A spectrum perfectly centred at
 *     bin K/2 can have arbitrarily small bandwidth but very
 *     large mobility -- the orthogonality witness is the
 *     CENTRAL-vs-NON-CENTRAL distinction.
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): GEOMETRIC fractal
 *     dimensions on the time-domain curve; no closed-form link
 *     to a frequency-domain second central moment.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): time-domain SCALING exponents.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; bandwidth is a whole-spectrum second central
 *     moment.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant. Time-
 *     domain shuffling whitens the spectrum and drives the
 *     bandwidth toward the discrete-uniform limit
 *     sqrt((K^2 - 1)/12). Bandwidth is therefore TIME-DOMAIN-
 *     SHUFFLE-SENSITIVE.
 *
 * INVARIANCES of bandwidthNormalised:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     numerator and denominator both scale by a^2; the ratio
 *     and its square root are unchanged. SCALE-INVARIANT for
 *     any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives the bandwidth toward the discrete-uniform
 *     spread sqrt((K^2 - 1)/12).
 *   - BIN-PERMUTATION (frequency reshuffle): NOT invariant --
 *     this is the key orthogonality witness vs flatness (85)
 *     and entropy (69), which are bin-permutation-INVARIANT.
 *
 * Bound: bandwidthBin in [0, (K - 1)/2]; the upper bound is
 * attained at equal mass on bins 1 and K. After normalisation
 * bandwidthNormalised lies in [0, 1/2). usableBins >= 2 is
 * enforced (a single bin trivially pins bandwidth to 0 with no
 * spread information).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralBandwidthSort =
  | 'bandwidth'
  | 'bandwidthDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralBandwidthOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for a non-trivial second
   * central moment; a single bin trivially pins the moment to
   * zero with no spread information).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralBandwidthSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralBandwidthSourceRow {
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
  /** bandwidth in BIN INDEX units, in [0, (K-1)/2]. */
  bandwidthBin: number;
  /** bandwidthBin / K in [0, 1/2). */
  bandwidthNormalised: number;
}

export interface DailyTokenSpectralBandwidthReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralBandwidthSort;
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
  sources: DailyTokenSpectralBandwidthSourceRow[];
}

/**
 * Spectral-bandwidth primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * { centroidBin, bandwidthBin, usableBins } where
 *   centroidBin  = sum(k * p_k) / sum(p_k)
 *   bandwidthBin = sqrt( sum((k - centroidBin)^2 * p_k) / sum(p_k) )
 * over bins with p > 0, and usableBins is the count of those
 * surviving bins.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when the total power is zero, or when fewer
 * than 2 bins survive the strictly-positive filter.
 */
export function spectralBandwidthBin(power: number[]): {
  centroidBin: number;
  bandwidthBin: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralBandwidthBin: empty power vector');
  }
  let m = 0;
  let weightedSum = 0;
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralBandwidthBin: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralBandwidthBin: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      const binIndex = i + 1;
      weightedSum += binIndex * p;
      totalPower += p;
      m += 1;
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralBandwidthBin: too few positive-power bins (${m}; need >= 2)`,
    );
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralBandwidthBin: non-positive total power after sum (${totalPower})`,
    );
  }
  const centroidBin = weightedSum / totalPower;
  // Second pass for the central moment about the centroid.
  // Two-pass is the textbook numerically stable estimator (vs
  // single-pass m2 - m1^2 which suffers catastrophic
  // cancellation for narrow peaks).
  let secondCentralWeighted = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      const binIndex = i + 1;
      const d = binIndex - centroidBin;
      secondCentralWeighted += d * d * p;
    }
  }
  const m2 = secondCentralWeighted / totalPower;
  // Floating-point defence: m2 is mathematically >= 0 but
  // catastrophic cancellation across very wide dynamic ranges
  // could push it a hair below 0 for near-pure-tone spectra.
  // Clamp to keep sqrt() well-defined.
  const m2Clamped = m2 < 0 ? 0 : m2;
  const bandwidthBin = Math.sqrt(m2Clamped);
  return { centroidBin, bandwidthBin, usableBins: m };
}

/**
 * Daily-token spectral-bandwidth primitive on a real-valued
 * series. Computes the one-sided periodogram, evaluates the
 * frequency-weighted second central moment over bins with
 * P[k] > 0, and returns the centroid in bin-index units, the
 * bandwidth in bin-index units, the K-normalised bandwidth in
 * [0, 1/2), and the input mean / stddev / bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4 candidate
 * bins), when a non-finite value is present, when var(y) = 0
 * (every bin is exactly 0 power), or when fewer than 2 bins
 * survive the strictly-positive-power filter.
 */
export function dailyTokenSpectralBandwidth(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  centroidBin: number;
  bandwidthBin: number;
  bandwidthNormalised: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralBandwidth: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralBandwidth requires finite values',
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
      'dailyTokenSpectralBandwidth: zero variance (constant series)',
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
  const { centroidBin, bandwidthBin, usableBins } =
    spectralBandwidthBin(power);
  let bandwidthNormalised = bandwidthBin / k;
  // Floating-point defence: bandwidthNormalised is
  // mathematically in [0, (K-1)/(2K)] < 1/2. Clamp to the
  // half-open interval [0, 1/2) for the documented contract.
  if (bandwidthNormalised < 0) bandwidthNormalised = 0;
  if (bandwidthNormalised >= 0.5) bandwidthNormalised = 0.5;
  if (
    !Number.isFinite(centroidBin) ||
    !Number.isFinite(bandwidthBin) ||
    !Number.isFinite(bandwidthNormalised)
  ) {
    throw new Error(
      `dailyTokenSpectralBandwidth: non-finite output (centroidBin=${centroidBin}, bandwidthBin=${bandwidthBin}, bandwidthNormalised=${bandwidthNormalised})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins,
    centroidBin,
    bandwidthBin,
    bandwidthNormalised,
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

export function buildDailyTokenSpectralBandwidth(
  queue: QueueLine[],
  opts: DailyTokenSpectralBandwidthOptions = {},
): DailyTokenSpectralBandwidthReport {
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
  const sort: DailyTokenSpectralBandwidthSort = opts.sort ?? 'bandwidthDesc';
  const validSorts: DailyTokenSpectralBandwidthSort[] = [
    'bandwidth',
    'bandwidthDesc',
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
  const rows: DailyTokenSpectralBandwidthSourceRow[] = [];

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
      result = dailyTokenSpectralBandwidth(filled);
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
      bandwidthBin: result.bandwidthBin,
      bandwidthNormalised: result.bandwidthNormalised,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bandwidth':
        primary = a.bandwidthNormalised - b.bandwidthNormalised;
        break;
      case 'bandwidthDesc':
        primary = b.bandwidthNormalised - a.bandwidthNormalised;
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
