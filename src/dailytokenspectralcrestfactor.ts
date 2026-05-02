/**
 * daily-token-spectral-crest-factor: per-source SPECTRAL
 * CREST FACTOR of the gap-filled daily total_tokens series,
 * defined as the ratio of the PEAK one-sided periodogram bin
 * to the MEAN one-sided periodogram bin over the surviving
 * (strictly-positive-power) non-DC band.
 *
 * EIGHTY-NINTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length
 * n:
 *
 *   1. Mean-centre y (drops DC; required so that bin 0 is
 *      exactly zero and the crest factor is read on the non-DC
 *      band).
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; defensive
 *      finite-floor pass; usableBins counts the survivors and
 *      MUST be >= 2 for a non-trivial peak/mean ratio -- a
 *      single bin trivially pins crestFactor = 1 with no shape
 *      information).
 *   4. Take peakPower = max_{k} P[k] over surviving bins, and
 *      meanPower = (sum_{k} P[k]) / usableBins.
 *   5. Return crestFactor = peakPower / meanPower, plus the
 *      bin-index of the peak (peakBin), the normalised peak
 *      position peakBinNormalised = peakBin / K in (0, 1], and
 *      the share of total non-DC power in the peak bin
 *      peakBinShare = peakPower / sum_{k} P[k] in (0, 1].
 *
 * BOUNDS:
 *
 *   crestFactor in [1, usableBins]:
 *     - LOWER bound 1 is attained iff every surviving bin has
 *       identical power (white-noise-on-band asymptote;
 *       peak/mean = 1).
 *     - UPPER bound `usableBins` is attained iff a single bin
 *       carries all the non-DC mass (line-spectrum asymptote;
 *       peak/mean = m * peak / peak = m). This is the
 *       Parseval-style hard cap that makes crest a clean
 *       PEAK-vs-MEAN ratio statistic.
 *
 *   peakBinShare in (0, 1]: equals 1 iff a single bin carries
 *     all the non-DC mass; equals 1 / usableBins under uniform
 *     power.
 *
 *   peakBinNormalised in (0, 1]: just the K-normalised position
 *     of the argmax bin; SCALE-FREE across series of different
 *     lengths.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - crestFactor approx 1 -- WHITE-NOISE-LIKE non-DC PSD;
 *     mass spread evenly across all surviving bins (peak
 *     barely above the mean).
 *   - crestFactor in roughly [2, 5] -- BROADBAND with a mild
 *     concentration; typical for natural daily token traces
 *     with weak weekly periodicity.
 *   - crestFactor >> 5 -- LINE-SPECTRUM-LIKE; one Fourier
 *     bin dominates (a strong periodic component sticking
 *     well above the spectral floor).
 *   - crestFactor near `usableBins` -- DEGENERATE single-tone
 *     non-DC mass concentrated entirely in one bin.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report v1.0, 2004 --
 *     §6.1.4 defines the spectral crest factor as the ratio
 *     of the maximum spectral magnitude to the arithmetic
 *     mean of spectral magnitudes over the analysis band.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 lists the
 *     spectral crest factor as a canonical SPECTRAL TONALITY
 *     descriptor sitting alongside flatness as the
 *     PEAK-vs-MEAN companion to the GM/AM-vs-MEAN flatness
 *     ratio.
 *   Tzanetakis, G. & Cook, P., "Musical Genre Classification
 *     of Audio Signals", IEEE Trans. Speech Audio Process.,
 *     10(5):293-302, 2002 -- broader context for
 *     periodogram-derived timbre descriptors (centroid,
 *     rolloff, flux) of which crest is the natural
 *     PEAK-LOCALISER companion.
 *   Klapuri, A. & Davy, M. (eds.), "Signal Processing Methods
 *     for Music Transcription", Springer, 2006, §5.3 surveys
 *     spectral peakiness measures including crest as a
 *     tonality / harmonicity proxy.
 *
 * STRUCTURAL ORTHOGONALITY -- a PEAK-TO-MEAN RATIO statistic
 * on the Fourier power spectrum, distinct from every shipped
 * daily-token axis 32..88:
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): roll-off is
 *     a CDF QUANTILE (the smallest bin where the cumulative
 *     mass crosses a chosen fraction). Crest is a PEAK-vs-MEAN
 *     RATIO -- it is NOT a CDF percentile and does not depend
 *     on cumulative integrals at all. Two spectra can share an
 *     identical roll-off at very different crest factors (a
 *     thin spike at bin R vs a wide hump centred near R both
 *     reach the 85% mark at R; the spike has a large crest,
 *     the hump a small crest). Symmetrically two spectra can
 *     share an identical crest factor at very different
 *     roll-offs (peak/mean depends only on the extremum and
 *     the average, not on where the peak sits along the bin
 *     axis). QUANTILE vs PEAK-RATIO is the precise witness.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): bandwidth
 *     is the SECOND CENTRAL MOMENT (sqrt) about the centroid;
 *     crest is a PEAK-vs-MEAN RATIO. Bandwidth is mass-
 *     weighted around the centroid; crest cares only about the
 *     extremum and the arithmetic mean. A symmetric two-tone
 *     at bins (k0, k0 + d) and a single isolated peak at bin
 *     k0 + d/2 can share the same total non-DC power and a
 *     similar peak-bin power (so similar crest) but very
 *     different bandwidths.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid is
 *     the MASS-WEIGHTED MEAN BIN INDEX (a position along the
 *     bin axis). Crest is a POWER STATISTIC -- it does not
 *     reference bin index at all. Reshuffling bin indices
 *     leaves crest UNCHANGED but changes the centroid
 *     arbitrarily. POSITION vs RATIO is the precise witness.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     Wiener flatness is the GEOMETRIC-MEAN / ARITHMETIC-MEAN
 *     ratio over kept bins (in [0, 1] with the white-noise
 *     asymptote at 1). Crest is the MAX / ARITHMETIC-MEAN
 *     ratio (in [1, m] with the white-noise asymptote at 1
 *     and the single-tone asymptote at m). Both share the
 *     "/AM" denominator and are bin-permutation-invariant,
 *     but flatness uses the GM-of-the-distribution numerator
 *     (shape-dispersion) while crest uses the MAX-of-the-
 *     distribution numerator (peak-vs-bulk). MAX vs GM is
 *     the precise orthogonality witness: a spectrum with one
 *     huge spike and many tiny but strictly positive bins can
 *     have a moderate flatness (GM is dominated by the many
 *     small terms) and a very large crest (peak/mean spikes
 *     when the max is much bigger than the average). The two
 *     can move in opposite directions on the same series.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE of P[k] in log k (a monotone-trend
 *     statistic). Crest is a single PEAK-vs-MEAN ratio that
 *     does not reference any monotone trend or bin index.
 *     Crest is also well-defined on spectra that are NOT
 *     power laws at all (line spectra, comb spectra) where
 *     beta is meaningless.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is
 *     a STRING-COMBINATORIAL phrase count on the median-
 *     binarised time-domain stream. Crest is a frequency-
 *     domain PEAK-vs-MEAN ratio.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): sign counts of
 *     derivatives in the time domain (amplitude-blind). Crest
 *     is a power-weighted spectral peak ratio.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is
 *     a LOCAL TRIPLET energy operator in the TIME DOMAIN.
 *     Crest is a global frequency-domain peak ratio.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `hjorth-
 *     complexity` (axis 80): Hjorth statistics are RATIOS of
 *     low-order spectral MOMENTS (sqrt(m_2 / m_0); sqrt(m_4
 *     m_0 / m_2^2) - 1). Crest is a PEAK-vs-MEAN RATIO of bin
 *     POWERS, not a moment ratio. A spectrum with most mass
 *     spread across many bins of similar magnitude plus a
 *     single very-high-k spike can have a small crest (peak
 *     barely above mean) and a large mobility (the high-k
 *     spike pulls m_2 a lot). MOMENT-RATIO vs PEAK-RATIO is
 *     the witness.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): entropy is
 *     the SHANNON ENTROPY of the L1-normalised periodogram --
 *     a SHAPE-DISPERSION statistic in nats summed over ALL
 *     bins. Crest is a SINGLE-EXTREMUM ratio. A spectrum with
 *     one moderate peak and many roughly-equal small bins can
 *     have a high entropy (lots of spread mass) and a small
 *     crest; a spectrum with one extreme spike and otherwise
 *     near-uniform power has a similar entropy but a much
 *     larger crest. ENTROPY-OF-DISTRIBUTION vs MAX-OF-
 *     DISTRIBUTION.
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): GEOMETRIC fractal
 *     dimensions on the time-domain curve. No closed-form link
 *     to a frequency-domain peak/mean ratio.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): time-domain SCALING exponents.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; crest is a whole-spectrum peak/mean ratio.
 *
 *   - vs the `source-row-token-crest-factor` axis (a per-
 *     source-row AMPLITUDE-DOMAIN crest factor on the raw
 *     total_tokens-per-row series): that statistic operates
 *     on TIME-DOMAIN amplitudes (peak |y| / RMS y). The new
 *     axis operates on the FREQUENCY-DOMAIN POWER SPECTRUM of
 *     the gap-filled daily aggregate (peak P[k] / mean P[k]).
 *     AMPLITUDE-DOMAIN vs POWER-SPECTRUM-DOMAIN is the
 *     orthogonality witness; the two can move in opposite
 *     directions on the same source.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant. Time-
 *     domain shuffling whitens the spectrum and drives the
 *     crest factor toward the white-noise asymptote
 *     crestFactor -> 1. Crest is therefore TIME-DOMAIN-
 *     SHUFFLE-SENSITIVE.
 *
 * INVARIANCES of crestFactor:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     the peak/mean ratio is scale-blind. SCALE-INVARIANT for
 *     any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives crestFactor toward 1.
 *   - BIN-PERMUTATION (frequency reshuffle): INVARIANT --
 *     peak/mean does not depend on bin index. This is the key
 *     orthogonality witness vs roll-off (88), centroid (86),
 *     and bandwidth (87), all of which are bin-permutation-
 *     SENSITIVE.
 *
 * Bound: crestFactor in [1, usableBins]; peakBinShare in
 * (0, 1]; peakBinNormalised in (0, 1]. The hard floor
 * `--min-tenure-days 8` keeps `K = floor(n/2) >= 4` and
 * enforces `usableBins >= 2`.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralCrestFactorSort =
  | 'crest'
  | 'crestDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralCrestFactorOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for a non-trivial
   * peak/mean ratio; a single bin trivially pins crestFactor
   * = 1).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralCrestFactorSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralCrestFactorSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of one-sided Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the ratio. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Argmax bin index in [1, K]. */
  peakBin: number;
  /** peakBin / K in (0, 1]. */
  peakBinNormalised: number;
  /** peak share of total non-DC power, in (0, 1]. */
  peakBinShare: number;
  /** PEAK / MEAN of surviving bin powers, in [1, usableBins]. */
  crestFactor: number;
}

export interface DailyTokenSpectralCrestFactorReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralCrestFactorSort;
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
  sources: DailyTokenSpectralCrestFactorSourceRow[];
}

/**
 * Spectral crest-factor primitive on a non-negative power
 * vector indexed by k = 1..power.length. Returns
 * { crestFactor, peakBin, peakBinShare, usableBins } where
 *   peakBin      = argmax_{k} p_k (1-indexed; ties: lowest k)
 *   crestFactor  = max p_k / (sum p_k / usableBins)
 *   peakBinShare = max p_k / sum p_k
 * over bins with p > 0, and usableBins is the count of those
 * surviving bins.
 *
 * TIE-BREAKING: when multiple bins share the maximum power,
 * the LOWEST bin index wins (we visit bins in ascending k and
 * only replace peakBin on a strict `p > peakPower`). This is
 * deterministic and matches the natural reading of "first
 * spectral peak from DC outward".
 *
 * TIGHT BOUND: crestFactor in [1, usableBins]. Lower bound
 * attained iff all surviving bins have identical power
 * (white-noise-on-band: peak/mean = 1). Upper bound attained
 * iff a single bin carries (essentially) all the mass while
 * the other surviving bins carry an arbitrarily small but
 * strictly-positive floor (single-tone limit: peak/mean ->
 * usableBins as the floor -> 0). Covered by unit tests.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when fewer than 2 bins survive the strictly-
 * positive filter, or when the total power is non-positive.
 */
export function spectralCrestFactor(power: number[]): {
  crestFactor: number;
  peakBin: number;
  peakBinShare: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralCrestFactor: empty power vector');
  }
  let m = 0;
  let totalPower = 0;
  let peakPower = 0;
  let peakBin = -1;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralCrestFactor: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralCrestFactor: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      totalPower += p;
      m += 1;
      if (p > peakPower) {
        peakPower = p;
        peakBin = i + 1;
      }
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralCrestFactor: too few positive-power bins (${m}; need >= 2)`,
    );
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralCrestFactor: non-positive total power after sum (${totalPower})`,
    );
  }
  if (peakBin < 0) {
    // Defensive: cannot happen because m >= 2 implies at least
    // one strictly-positive bin was visited.
    throw new Error('spectralCrestFactor: failed to locate peak bin');
  }
  const meanPower = totalPower / m;
  const crestFactor = peakPower / meanPower;
  const peakBinShare = peakPower / totalPower;
  return { crestFactor, peakBin, peakBinShare, usableBins: m };
}

/**
 * Daily-token spectral crest-factor primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the
 * peak/mean ratio over the surviving non-DC bins, and returns
 * the crest factor, the bin-index of the peak, the K-
 * normalised peak position in (0, 1], the share of total non-
 * DC power in the peak bin, and the input mean / stddev / bin
 * counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), or when fewer
 * than 2 bins survive the strictly-positive-power filter.
 */
export function dailyTokenSpectralCrestFactor(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  peakBin: number;
  peakBinNormalised: number;
  peakBinShare: number;
  crestFactor: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralCrestFactor: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralCrestFactor requires finite values',
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
      'dailyTokenSpectralCrestFactor: zero variance (constant series)',
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
  const { crestFactor, peakBin, peakBinShare, usableBins } =
    spectralCrestFactor(power);
  let peakBinNormalised = peakBin / k;
  // Floating-point defence: peakBinNormalised is mathematically
  // in (0, 1].
  if (peakBinNormalised <= 0) peakBinNormalised = 1 / k;
  if (peakBinNormalised > 1) peakBinNormalised = 1;
  if (
    !Number.isFinite(crestFactor) ||
    !Number.isFinite(peakBin) ||
    !Number.isFinite(peakBinNormalised) ||
    !Number.isFinite(peakBinShare)
  ) {
    throw new Error(
      `dailyTokenSpectralCrestFactor: non-finite output (crestFactor=${crestFactor}, peakBin=${peakBin}, peakBinNormalised=${peakBinNormalised}, peakBinShare=${peakBinShare})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins,
    peakBin,
    peakBinNormalised,
    peakBinShare,
    crestFactor,
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

export function buildDailyTokenSpectralCrestFactor(
  queue: QueueLine[],
  opts: DailyTokenSpectralCrestFactorOptions = {},
): DailyTokenSpectralCrestFactorReport {
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
  const sort: DailyTokenSpectralCrestFactorSort = opts.sort ?? 'crestDesc';
  const validSorts: DailyTokenSpectralCrestFactorSort[] = [
    'crest',
    'crestDesc',
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
  const rows: DailyTokenSpectralCrestFactorSourceRow[] = [];

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
      result = dailyTokenSpectralCrestFactor(filled);
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
      peakBin: result.peakBin,
      peakBinNormalised: result.peakBinNormalised,
      peakBinShare: result.peakBinShare,
      crestFactor: result.crestFactor,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'crest':
        primary = a.crestFactor - b.crestFactor;
        break;
      case 'crestDesc':
        primary = b.crestFactor - a.crestFactor;
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
