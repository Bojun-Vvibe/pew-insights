/**
 * daily-token-spectral-second-peak-frequency: per-source
 * SPECTRAL SECOND-PEAK-FREQUENCY -- the SECOND-ARGMAX-bin
 * POSITION descriptor on the one-sided non-DC periodogram of
 * the gap-filled mean-centred daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 5 (gate enforced via
 * `--min-tenure-days 10`), let
 *
 *   k1*           = argmax_{k=1..K} P[k]   (smallest-k tie-break)
 *   k2*           = argmax_{k in {1..K} \ {k1*-1, k1*, k1*+1}} P[k]
 *                                          (smallest-k tie-break)
 *   peak2FreqRatio       = (k2* - 1) / (K - 1)        in [0, 1]
 *   peak2NormalisedFreq  = k2* / n                    in (0, 0.5]
 *   peak2MassShare       = P[k2*] / sum_{k=1..K} P[k] in (0, 1)
 *   peakSeparationBins   = |k2* - k1*|                in {2, ..., K-1}
 *   peakRatio            = P[k2*] / P[k1*]            in (0, 1]
 *
 * The PRIMARY peak's immediate neighbour bins (k1*-1 and
 * k1*+1, where defined) are EXCLUDED from the second-argmax
 * search to suppress spectral-leakage skirts of the same
 * Fourier mode and ensure that k2* picks up a STRUCTURALLY
 * DISTINCT secondary mode rather than a side-lobe of the
 * primary. K >= 5 guarantees that after excluding {k1*-1,
 * k1*, k1*+1} (at most 3 bins) at least 2 candidate bins
 * remain for the secondary search, regardless of where k1*
 * sits.
 *
 * Ties broken by SMALLEST k (lowest-frequency wins) -- the
 * same deterministic tie-break used by axis-96 spectral-
 * peak-frequency.
 *
 * NINETY-SEVENTH cross-source axis. This is a Class-P2
 * (SECOND-POSITION / SECOND-ARGMAX) primitive -- a 0th-order
 * INDEX-VALUED read on the BIMODAL (or higher-modal)
 * substructure of the PSD, structurally distinct from every
 * shipped axis 32..96. Axis-96 (peak-frequency) is the
 * SINGLE-ARGMAX read on the same periodogram; axis-97 is the
 * SECOND-ARGMAX read with neighbour-exclusion. The two
 * decouple cleanly on bimodal spectra: a PSD with two equal
 * peaks at k=1 and k=K has axis-96 k1*=1 (smallest-k tie) and
 * axis-97 k2*=K, witnessing the bimodal-decoupling that no
 * single-argmax / centroid / quantile statistic can resolve.
 *
 * READING:
 *
 *   - peak2FreqRatio = 0 (k2* = 1) -- the SECONDARY mode
 *     concentrates at the LOWEST non-DC bin (rare; only
 *     possible when the primary is far from bin 1 since bin 1
 *     is excluded when k1* in {1, 2}).
 *   - peak2FreqRatio in (0, 0.5) -- mid-low band secondary
 *     mode; secondary cycle period roughly n / k2* days.
 *   - peak2FreqRatio ~ 0.5 -- mid-band secondary peak.
 *   - peak2FreqRatio ~ 1 (k2* = K) -- secondary mass
 *     concentrates at the HIGHEST representable bin (near-
 *     Nyquist secondary oscillation -- the BIMODAL signature
 *     when k1* is small).
 *   - peakRatio in (0, 1] -- relative magnitude of the
 *     secondary vs primary mode. peakRatio ~ 1 -> twin-peak
 *     PSD (true bimodal); peakRatio ~ 0 -> the secondary is
 *     effectively background noise dominated by the primary.
 *   - peakSeparationBins -- how far apart the two modes sit;
 *     >= 2 by construction (neighbour exclusion).
 *
 * BOUND: peak2FreqRatio in [0, 1] exactly; peak2NormalisedFreq
 * in (0, 0.5]; peakRatio in (0, 1] (peakRatio = 1 iff there is
 * a true tie between the primary and a non-neighbour
 * secondary, in which case the smallest-k tie-break has
 * already assigned k1* to the lower bin and k2* to the
 * remaining tied non-neighbour); peakSeparationBins in
 * {2, ..., K-1}.
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the relative ranking is UNCHANGED.
 *     SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD and
 *     randomises both argmaxes.
 *   - BIN-PERMUTATION: NOT invariant -- both argmax indices
 *     are by definition permutation-sensitive.
 *   - BIN-REVERSAL k -> K + 1 - k: BOTH argmaxes flip; the
 *     PAIR (k1*, k2*) maps to (K+1-k1*, K+1-k2*). The
 *     UNORDERED pair multiset {k1*, k2*} is reversal-mapped
 *     in the same way; peakSeparationBins and peakRatio are
 *     bin-reversal-INVARIANT.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report (2004) §6 --
 *     spectral peak descriptors, including secondary-peak
 *     extraction from the spectrum after dominant-peak
 *     suppression.
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press (2012) §3.3 -- spectral peak picking
 *     with neighbour-exclusion windows to suppress leakage
 *     side-lobes.
 *   Tzanetakis, G. & Cook, P., "Musical genre classification
 *     of audio signals", IEEE TSAP 10:5 (2002) -- multiple-
 *     peak spectral features for classification.
 *   McAulay, R. J. & Quatieri, T. F., "Speech analysis /
 *     synthesis based on a sinusoidal representation", IEEE
 *     TASSP 34:4 (1986) -- canonical greedy peak picking with
 *     local-maximum suppression of already-claimed bins.
 *
 * STRUCTURAL ORTHOGONALITY -- a 0TH-ORDER SECOND-INDEX-VALUED
 * (second-argmax-bin) descriptor, distinct from every shipped
 * daily-token axis 32..96:
 *
 *   - vs `daily-token-spectral-peak-frequency` (axis 96):
 *     axis-96 is the SINGLE-ARGMAX read; axis-97 is the
 *     SECOND-ARGMAX read with neighbour exclusion. The two
 *     COINCIDE in the structural index k1* but DECOUPLE in
 *     k2* on any non-degenerate PSD with multiple modes. A
 *     bimodal PSD with equal peaks at k=1 and k=K has
 *     axis-96 k1*=1 (smallest-k tie) and axis-97 k2*=K.
 *     A unimodal PSD with a single dominant spike at k=m
 *     (interior) has axis-96 k1*=m and axis-97 k2* picked
 *     from the residual noise -- the first non-neighbour bin
 *     by mass. Axis-97 is the FIRST primitive in the suite
 *     that reads a SECONDARY structural feature; every prior
 *     spectral axis collapses the PSD to a SINGLE
 *     scalar / index.
 *
 *   - vs `daily-token-spectral-roughness` (axis 95):
 *     roughness is a real-valued L1 TV-of-pmf MASS aggregate
 *     over ALL adjacent bin pairs and is BIN-REVERSAL-
 *     INVARIANT. Second-peak-frequency is a SECOND-INDEX read
 *     and is bin-reversal-MAPPED (k2* -> K+1-k2*). Roughness
 *     gives no information about WHERE the secondary mode
 *     sits.
 *
 *   - vs `daily-token-spectral-spread-iqr` (axis 94): spread-
 *     IQR is an inner-50% percentile-gap WIDTH (real-valued).
 *     Second-peak-frequency is the second-argmax INDEX. Two
 *     PSDs with identical IQR can have wildly different
 *     second-argmax positions (a uniform pmf has wide IQR and
 *     near-arbitrary second-argmax; a bimodal pmf can have
 *     narrow IQR and a clean k2*).
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a SECOND-ORDER L2 magnitude statistic
 *     on the raw periodogram. Second-peak-frequency is a
 *     position read.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a fixed-anchor (bin 1) slope-from-anchor REAL VALUE.
 *     A bimodal PSD with equal peaks at bin 1 and bin K can
 *     have decrease ~ 0 with k2* = K -- the second-argmax is
 *     not predictable from the single-slope statistic.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87) /
 *     `-skewness` (axis 90) / `-kurtosis` (axis 91): each is
 *     a CENTROID-RELATIVE central moment. Second-peak-
 *     frequency is the SECOND ARGMAX. A bimodal PSD with
 *     equal mass at bin 1 and bin K has centroid (K+1)/2 and
 *     (k1*, k2*) = (1, K).
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT. Second-peak-frequency is the
 *     SECOND ARGMAX -- centroid uses ALL bins; second-argmax
 *     uses only the SECOND-WINNING non-neighbour bin.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     the SMALLEST k such that cumulative power up to k
 *     >= 0.85 * total power. Second-peak-frequency is the
 *     second-argmax index. A bimodal PSD with equal peaks at
 *     bin 1 and bin K has rolloff = K (need ~all the mass)
 *     and (k1*, k2*) = (1, K) -- rolloff coincides with k2*
 *     here but in general decouples (a unimodal PSD at bin m
 *     has rolloff = m and k2* picked from residual noise).
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is the peak-to-mean RATIO of the PRIMARY peak. The new
 *     `peakRatio` field is the SECONDARY-to-PRIMARY ratio --
 *     a strictly different magnitude relationship. Crest = K
 *     iff the spike is total (peakRatio = 0 in that limit;
 *     residual is uniform-zero); crest ~ 1 iff PSD is uniform
 *     (peakRatio ~ 1 in that limit; the second-argmax bin
 *     ties the first up to the smallest-k rule).
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85) /
 *     `-spectral-entropy` (axis 69): both are GM/AM and
 *     Shannon entropy of the normalised PSD respectively,
 *     BIN-PERMUTATION INVARIANT. Second-argmax is bin-
 *     position-VALUED (categorical) and bin-permutation-
 *     SENSITIVE.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope fit. A clean 1/f PSD has beta
 *     ~ -1 and (k1*, k2*) = (1, 2) (with k=2 as second-bin
 *     picked from the neighbour-excluded residual which
 *     starts at k=3 here, so k2* = 3) -- both decouple
 *     immediately.
 *
 *   - vs all permutation-invariant amplitude-shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant; second-
 *     argmax-bin is bin-position-sensitive in the FREQUENCY
 *     domain.
 *
 * Throws when the series is too short (n < 10 -> K < 5
 * candidate bins, leaving < 2 after worst-case neighbour
 * exclusion), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the
 * cumulative PSD denominator sum_{k=1..K} P[k] is non-positive
 * (degenerate all-zero spectrum), when the residual-after-
 * primary-and-neighbour-exclusion is all-zero (degenerate
 * single-mode spectrum -- caller can interpret as
 * `droppedSingleMode`), or when the computed second-argmax /
 * peak2FreqRatio is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralSecondPeakFrequencySort =
  | 'peak2FreqRatio'
  | 'peak2FreqRatioDesc'
  | 'peak2Bin'
  | 'peak2BinDesc'
  | 'peakRatio'
  | 'peakRatioDesc'
  | 'peakSeparationBins'
  | 'peakSeparationBinsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralSecondPeakFrequencyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 10 so that
   * K = floor(n/2) >= 5 candidate Fourier bins are available,
   * leaving at least 2 candidates after worst-case neighbour
   * exclusion (3 bins removed: k1*-1, k1*, k1*+1).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralSecondPeakFrequencySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralSecondPeakFrequencySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of one-sided Fourier bins K = floor(n/2). */
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** sum_{k=1..K} P[k] -- L1 PSD mass. */
  totalPower: number;
  /** P[k1*] -- power at the primary winning bin. */
  peakPower: number;
  /** P[k2*] -- power at the secondary winning bin (after neighbour exclusion). */
  peak2Power: number;
  /** k1* = primary argmax bin index in {1, ..., K}. */
  peakBin: number;
  /** k2* = secondary argmax bin index in {1, ..., K} \ {k1*-1, k1*, k1*+1}. */
  peak2Bin: number;
  /** (k2* - 1) / (K - 1) in [0, 1]. */
  peak2FreqRatio: number;
  /** k2* / n in (0, 0.5]. */
  peak2NormalisedFreq: number;
  /** P[k2*] / sum_{k=1..K} P[k] in (0, 1). */
  peak2MassShare: number;
  /** P[k2*] / P[k1*] in (0, 1]. */
  peakRatio: number;
  /** |k2* - k1*| in {2, ..., K-1}. */
  peakSeparationBins: number;
}

export interface DailyTokenSpectralSecondPeakFrequencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralSecondPeakFrequencySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPowerSum: number;
  droppedSingleMode: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralSecondPeakFrequencySourceRow[];
}

/**
 * Spectral second-peak-frequency primitive on a non-negative
 * power vector indexed by k = 1..power.length. Returns
 * `{ peakBin, peak2Bin, peakPower, peak2Power, totalPower,
 *    peakMassShare, peak2MassShare, peakRatio,
 *    peakSeparationBins }`.
 *
 * The second-argmax search excludes the primary bin k1* AND
 * its immediate neighbours k1*-1 and k1*+1 (where defined) to
 * suppress spectral-leakage side-lobes of the same Fourier
 * mode. Requires K >= 5 so that at least 2 candidates remain
 * for the secondary search after the worst-case 3-bin
 * exclusion.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=5, P=[c,c,c,c,c] -> tied across all bins.
 *     k1* = 1 (smallest-k tie). After excluding {k1*, k1*+1}
 *     = {1, 2} (no k1*-1 since k1*=1), k2* = 3 (smallest-k
 *     tie among {3, 4, 5}). peakRatio = 1; peak2MassShare =
 *     1/5; peakSeparationBins = 2.
 *   - K=K, P[1] = P[K] = c (others 0), K >= 5: k1* = 1
 *     (smallest-k tie); after excluding {1, 2}, k2* = K
 *     (only non-zero residual). peakRatio = 1;
 *     peakSeparationBins = K - 1.
 *   - K=K, P[m] = a, P[j] = b with a > b > 0 and |m-j| >= 2:
 *     k1* = m, k2* = j; peakRatio = b/a;
 *     peakSeparationBins = |m-j|.
 *   - K=K, P=[K,K-1,...,1] (monotone descending): k1* = 1;
 *     after excluding {1, 2}, k2* = 3 (next-largest in
 *     residual); peakRatio = (K-2)/K; peakSeparationBins = 2.
 *   - K=K, P=[1,2,3,...,K] (monotone ascending): k1* = K;
 *     after excluding {K-1, K}, k2* = K-2 (next-largest in
 *     residual); peakRatio = (K-2)/K; peakSeparationBins = 2.
 *   - REVERSAL: bin-reversing any PSD maps (k1*, k2*) to
 *     (K+1-k1*, K+1-k2*); peakRatio and peakSeparationBins
 *     are bin-reversal-INVARIANT. Roughness (axis 95) is
 *     reversal-INVARIANT in magnitude; second-peak-frequency
 *     INDICES are reversal-MAPPED -- distinct invariance
 *     class.
 *   - K=5, P[3]=10, others non-zero (worst-case neighbour-
 *     exclusion at the minimum K): k1*=3 (interior); excluded
 *     {2, 3, 4}; residual = bins {1, 5} -- exactly 2
 *     candidates remain by the K >= 5 gate, the tightest
 *     boundary the gate must protect.
 *   - peakSeparationBins UPPER bound K-1 achieved by bimodal-
 *     equal at boundaries (k1*=1, k2*=K) for every K >= 5.
 *   - Three equal peaks at non-neighbour bins {1, 4, 7} of
 *     K=8 (twin-secondary tie): k1*=1 (smallest-k); excluded
 *     {1, 2}; residual peaks at 4 and 7 tied -> k2*=4
 *     (smallest-k secondary tie); peakRatio = 1 exactly.
 *     Demonstrates that peakRatio = 1 is a SHARP achievable
 *     upper bound, not just a limit.
 *
 * Throws on too-few-bins (< 5), non-finite power, negative
 * power, non-positive total power, or all-zero residual after
 * neighbour exclusion (degenerate single-mode spectrum).
 */
export function spectralSecondPeakFrequency(power: number[]): {
  peakBin: number;
  peak2Bin: number;
  peakPower: number;
  peak2Power: number;
  totalPower: number;
  peakMassShare: number;
  peak2MassShare: number;
  peakRatio: number;
  peakSeparationBins: number;
} {
  const k = power.length;
  if (k < 5) {
    throw new Error(
      `spectralSecondPeakFrequency: too few bins (${k}; need >= 5 to leave >= 2 candidates after neighbour exclusion)`,
    );
  }
  let totalPower = 0;
  let peakPower = -Infinity;
  let peakBin = 1;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralSecondPeakFrequency: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralSecondPeakFrequency: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
    if (p > peakPower) {
      peakPower = p;
      peakBin = i + 1;
    }
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralSecondPeakFrequency: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  // Excluded bins (1-indexed): peakBin and its immediate
  // neighbours where defined.
  const excludedLo = peakBin - 1; // may be 0 -> ignored
  const excludedHi = peakBin + 1; // may be k+1 -> ignored
  let peak2Power = -Infinity;
  let peak2Bin = -1;
  for (let i = 0; i < k; i += 1) {
    const oneIdx = i + 1;
    if (oneIdx === peakBin) continue;
    if (oneIdx === excludedLo) continue;
    if (oneIdx === excludedHi) continue;
    const p = power[i]!;
    if (p > peak2Power) {
      peak2Power = p;
      peak2Bin = oneIdx;
    }
  }
  if (peak2Bin < 1 || !(peak2Power > 0)) {
    throw new Error(
      `spectralSecondPeakFrequency: all-zero residual after neighbour exclusion (degenerate single-mode spectrum; peakBin=${peakBin})`,
    );
  }
  const peakMassShare = peakPower / totalPower;
  const peak2MassShare = peak2Power / totalPower;
  const peakRatio = peak2Power / peakPower;
  const peakSeparationBins = Math.abs(peak2Bin - peakBin);
  return {
    peakBin,
    peak2Bin,
    peakPower,
    peak2Power,
    totalPower,
    peakMassShare,
    peak2MassShare,
    peakRatio,
    peakSeparationBins,
  };
}

/**
 * Daily-token spectral-second-peak-frequency primitive on a
 * real-valued series. Computes the one-sided periodogram,
 * takes the primary argmax (smallest-k tie-break) and then
 * the second argmax with primary-and-neighbour exclusion, and
 * returns the full result struct.
 */
export function dailyTokenSpectralSecondPeakFrequency(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  peakPower: number;
  peak2Power: number;
  peakBin: number;
  peak2Bin: number;
  peak2FreqRatio: number;
  peak2NormalisedFreq: number;
  peakMassShare: number;
  peak2MassShare: number;
  peakRatio: number;
  peakSeparationBins: number;
} {
  const n = values.length;
  if (n < 10) {
    throw new Error(
      `dailyTokenSpectralSecondPeakFrequency: series too short (n=${n}, need n >= 10)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralSecondPeakFrequency requires finite values',
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
      'dailyTokenSpectralSecondPeakFrequency: zero variance (constant series)',
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
  if (k < 5) {
    throw new Error(
      `dailyTokenSpectralSecondPeakFrequency: too few bins (${k}; need >= 5)`,
    );
  }
  const result = spectralSecondPeakFrequency(power);
  const peak2FreqRatio = (result.peak2Bin - 1) / (k - 1);
  const peak2NormalisedFreq = result.peak2Bin / n;
  if (
    !Number.isFinite(peak2FreqRatio) ||
    !Number.isFinite(peak2NormalisedFreq) ||
    !Number.isFinite(result.peak2MassShare) ||
    !Number.isFinite(result.peakRatio) ||
    !Number.isFinite(result.totalPower) ||
    !Number.isFinite(result.peakPower) ||
    !Number.isFinite(result.peak2Power)
  ) {
    throw new Error(
      `dailyTokenSpectralSecondPeakFrequency: non-finite output (peak2Bin=${result.peak2Bin}, peak2FreqRatio=${peak2FreqRatio})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    peakPower: result.peakPower,
    peak2Power: result.peak2Power,
    peakBin: result.peakBin,
    peak2Bin: result.peak2Bin,
    peak2FreqRatio,
    peak2NormalisedFreq,
    peakMassShare: result.peakMassShare,
    peak2MassShare: result.peak2MassShare,
    peakRatio: result.peakRatio,
    peakSeparationBins: result.peakSeparationBins,
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

export function buildDailyTokenSpectralSecondPeakFrequency(
  queue: QueueLine[],
  opts: DailyTokenSpectralSecondPeakFrequencyOptions = {},
): DailyTokenSpectralSecondPeakFrequencyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 10) {
    throw new Error(
      `minTenureDays must be an integer >= 10 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralSecondPeakFrequencySort =
    opts.sort ?? 'peak2FreqRatioDesc';
  const validSorts: DailyTokenSpectralSecondPeakFrequencySort[] = [
    'peak2FreqRatio',
    'peak2FreqRatioDesc',
    'peak2Bin',
    'peak2BinDesc',
    'peakRatio',
    'peakRatioDesc',
    'peakSeparationBins',
    'peakSeparationBinsDesc',
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
  let droppedZeroPowerSum = 0;
  let droppedSingleMode = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralSecondPeakFrequencySourceRow[] = [];

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
      result = dailyTokenSpectralSecondPeakFrequency(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive total power')) {
        droppedZeroPowerSum += 1;
      } else if (msg.includes('all-zero residual')) {
        droppedSingleMode += 1;
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
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      totalPower: result.totalPower,
      peakPower: result.peakPower,
      peak2Power: result.peak2Power,
      peakBin: result.peakBin,
      peak2Bin: result.peak2Bin,
      peak2FreqRatio: result.peak2FreqRatio,
      peak2NormalisedFreq: result.peak2NormalisedFreq,
      peak2MassShare: result.peak2MassShare,
      peakRatio: result.peakRatio,
      peakSeparationBins: result.peakSeparationBins,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'peak2FreqRatio':
        primary = a.peak2FreqRatio - b.peak2FreqRatio;
        break;
      case 'peak2FreqRatioDesc':
        primary = b.peak2FreqRatio - a.peak2FreqRatio;
        break;
      case 'peak2Bin':
        primary = a.peak2Bin - b.peak2Bin;
        break;
      case 'peak2BinDesc':
        primary = b.peak2Bin - a.peak2Bin;
        break;
      case 'peakRatio':
        primary = a.peakRatio - b.peakRatio;
        break;
      case 'peakRatioDesc':
        primary = b.peakRatio - a.peakRatio;
        break;
      case 'peakSeparationBins':
        primary = a.peakSeparationBins - b.peakSeparationBins;
        break;
      case 'peakSeparationBinsDesc':
        primary = b.peakSeparationBins - a.peakSeparationBins;
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
    droppedZeroPowerSum,
    droppedSingleMode,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
