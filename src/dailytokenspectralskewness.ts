/**
 * daily-token-spectral-skewness: per-source SPECTRAL SKEWNESS
 * (third standardised central moment) of the gap-filled daily
 * total_tokens series, defined as
 *
 *   mu       = sum_{k=1..K} k * P[k] / sum_{k=1..K} P[k]
 *   sigma^2  = sum_{k=1..K} (k - mu)^2 * P[k] / sum_{k=1..K} P[k]
 *   skewness = sum_{k=1..K} (k - mu)^3 * P[k]
 *              / (sum_{k=1..K} P[k] * sigma^3)
 *
 * over the surviving (strictly-positive-power) non-DC band of
 * the one-sided periodogram of the mean-centred series.
 *
 * NINETIETH cross-source axis. Joins the spectral hexad
 * (84 DFT-slope, 85 Wiener-flatness, 86 spectral-centroid,
 * 87 spectral-bandwidth, 88 spectral-rolloff, 89 spectral-
 * crest) into a SPECTRAL HEPTAD by closing the third
 * central moment slot.
 *
 * Operationally, given the gap-filled daily series y of length
 * n:
 *
 *   1. Mean-centre y (drops DC; required so that bin 0 is
 *      exactly zero and the moments are read on the non-DC
 *      band).
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; defensive
 *      finite-floor pass; usableBins counts the survivors and
 *      MUST be >= 3 for a non-degenerate third moment -- a
 *      single bin pins sigma = 0 (skewness undefined); two
 *      bins force a sign-determined point mass with sigma
 *      determined by the gap (the third moment then collapses
 *      algebraically to a binary sign function and carries no
 *      shape information beyond which-bin-is-bigger).
 *   4. Compute centroid mu = sum_{k} k * P[k] / sum_{k} P[k]
 *      (1st central moment in bin-index units).
 *   5. Compute spread sigma^2 = sum_{k} (k - mu)^2 * P[k] /
 *      sum_{k} P[k] (2nd central moment); take sigma = sqrt.
 *   6. Compute third central moment m3 = sum_{k} (k - mu)^3 *
 *      P[k] / sum_{k} P[k]; standardise:
 *      skewness = m3 / sigma^3.
 *   7. Report `skewness` (signed real, asymmetry of the PSD
 *      shape about its centroid, in dimensionless units after
 *      sigma^3 normalisation), the unstandardised third moment
 *      `thirdCentralMoment` in cubed-bin units, and the
 *      standardising sigma `bandwidth` in bin units.
 *
 * SIGN CONVENTION:
 *
 *   - skewness > 0 -- RIGHT-SKEWED PSD: a long high-frequency
 *     tail relative to the centroid (mass concentrated below
 *     mu with a sparse, far-from-mu high-bin tail). Typical
 *     for series with a low-frequency hump and intermittent
 *     high-frequency bursts.
 *   - skewness ~= 0 -- SYMMETRIC PSD about the centroid: bins
 *     above and below mu carry mirror-image power (cosine-
 *     packets, two-tone symmetric pairs).
 *   - skewness < 0 -- LEFT-SKEWED PSD: a long low-frequency
 *     tail relative to the centroid (mass concentrated above
 *     mu with a sparse, far-from-mu low-bin tail).
 *
 * BOUNDS:
 *
 *   - Pearson 1895 / Wilkins 1944 give the algebraic envelope
 *     |skewness| <= sqrt(usableBins - 2) * (usableBins - 1)
 *     / sqrt(usableBins) for any non-negative-mass standardised
 *     third moment on a discrete support of usableBins points
 *     (Wilkins, "A note on skewness and kurtosis", Annals of
 *     Math. Stat. 15(3), 1944). For the K-bin one-sided
 *     periodogram with K = floor(n/2) and `--min-tenure-days
 *     8` (-> K >= 4) and the `usableBins >= 3` gate, this
 *     gives a generous envelope that grows like sqrt(K).
 *   - In practice for daily-token PSDs the realised |skewness|
 *     is order-1 to order-10; runaway magnitudes (>> 50)
 *     usually flag a near-degenerate two-bin spectrum just
 *     barely above the usableBins >= 3 floor.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - |skewness| < 0.5 -- nearly symmetric PSD; the spectral
 *     mass is balanced about its centroid (the typical case
 *     for broadband / well-mixed-noise sources).
 *   - skewness in roughly [+0.5, +3] -- mild to moderate
 *     RIGHT-skewed PSD; centroid sits below the mean of the
 *     surviving bin range with a longer high-frequency tail.
 *   - skewness <= -0.5 -- LEFT-skewed PSD; centroid sits
 *     above the mean of the surviving bin range with a longer
 *     low-frequency tail.
 *   - |skewness| >> 5 -- degenerate / near-line-spectrum
 *     concentration where one or two bins dominate and the
 *     third moment is amplified by their distance from the
 *     centroid.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report v1.0, 2004 --
 *     §6.1.3 defines the spectral skewness as the third
 *     standardised central moment of the magnitude spectrum
 *     about the spectral centroid; explicitly listed as the
 *     ASYMMETRY descriptor sitting one moment beyond the
 *     spectral spread / bandwidth.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 lists spectral
 *     skewness as the canonical SHAPE-ASYMMETRY descriptor
 *     in the moment sequence
 *       centroid (1st) -> spread (2nd) -> SKEWNESS (3rd) ->
 *       kurtosis (4th).
 *   Pearson, K., "Contributions to the mathematical theory of
 *     evolution. II. Skew variation in homogeneous material",
 *     Phil. Trans. Roy. Soc. London A 186, 1895 -- the
 *     foundational definition of the third standardised
 *     central moment as a measure of distributional asymmetry.
 *   Wilkins, J. E., "A note on skewness and kurtosis", Annals
 *     of Math. Stat. 15(3):333-335, 1944 -- algebraic envelope
 *     |skewness| <= sqrt(n-2) * (n-1) / sqrt(n) on any
 *     n-point discrete support.
 *
 * STRUCTURAL ORTHOGONALITY -- a SIGNED THIRD CENTRAL MOMENT
 * statistic on the Fourier power spectrum, distinct from every
 * shipped daily-token axis 32..89:
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): bandwidth
 *     is the SECOND CENTRAL MOMENT (sqrt) about the centroid;
 *     skewness is the THIRD STANDARDISED central moment about
 *     the same centroid. Bandwidth is unsigned (always >= 0)
 *     and measures spread; skewness is signed and measures
 *     asymmetry. A symmetric PSD with mass evenly split about
 *     mu has finite bandwidth and zero skewness; a one-sided
 *     PSD with the SAME bandwidth can have arbitrarily large
 *     positive or negative skewness. SECOND-MOMENT vs
 *     SIGNED-THIRD-MOMENT is the precise witness.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is a PEAK-vs-MEAN RATIO that does not reference bin
 *     index at all (BIN-PERMUTATION INVARIANT). Skewness is
 *     bin-index-weighted by (k - mu)^3 -- BIN-PERMUTATION
 *     SENSITIVE. Two spectra with the same crest can have
 *     opposite-sign skewness (a single big bin at low k vs
 *     the same big bin at high k). PEAK-RATIO vs
 *     SIGNED-MOMENT-SHAPE is the witness.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): roll-off is
 *     a CDF QUANTILE (the smallest bin where the cumulative
 *     mass crosses a chosen fraction); skewness is a SIGNED
 *     CENTRAL MOMENT integrated over ALL bins. Roll-off is
 *     unsigned and a single-point summary; skewness is signed
 *     and integrates the whole shape. Two spectra can share
 *     identical roll-offs at very different skewness values
 *     (the location of the cumulative-fraction threshold does
 *     not pin asymmetry about the centroid).
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT (mean bin index); skewness is
 *     the THIRD STANDARDISED CENTRAL MOMENT about that mean.
 *     Two spectra with the same centroid mu can have opposite
 *     skewness (mass piled symmetrically below or asymmetric
 *     long tail above mu). FIRST-MOMENT vs THIRD-MOMENT is
 *     the precise witness.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM ratio over bin powers (BIN-
 *     PERMUTATION INVARIANT, in [0, 1]). Skewness is signed
 *     and bin-permutation-sensitive. Two spectra with the
 *     same flatness can have opposite-sign skewness (mirror-
 *     reflected PSDs share GM and AM but flip the third
 *     central moment).
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE of P[k] vs k (a monotone-trend
 *     statistic on log-axes). Skewness is a SIGNED THIRD
 *     CENTRAL MOMENT on the LINEAR power axis. A power-law
 *     spectrum with beta = -1 has a definite skewness sign,
 *     but a comb spectrum with no power-law structure also
 *     has a well-defined skewness; the two statistics are
 *     defined on different functionals of P[k].
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): entropy is
 *     the SHANNON ENTROPY of the L1-normalised periodogram --
 *     a SHAPE-DISPERSION statistic in nats summed over ALL
 *     bins, BIN-PERMUTATION INVARIANT. Skewness is signed and
 *     bin-permutation-sensitive. Two spectra with the same
 *     entropy can have opposite-sign skewness.
 *
 *   - vs `source-row-token-spectral-skewness` (the per-row
 *     spectral skewness on the raw total_tokens-per-row
 *     series): that statistic operates on the per-row STREAM
 *     (row-index time axis, no gap-filling, no daily
 *     aggregation). The new axis operates on the gap-filled
 *     DAILY aggregate (calendar-day time axis, mean-centred,
 *     UTC bucketed). PER-ROW-AT-SOURCE vs DAILY-AGGREGATE-AT-
 *     SOURCE is the orthogonality witness; the two can move
 *     in opposite directions on the same source (per-row
 *     bursts vs daily totals decoupled by intra-day clumping).
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; spectral
 *     skewness depends on the order of bins and is therefore
 *     bin-permutation-SENSITIVE.
 *
 * INVARIANCES of skewness:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     mu and sigma are bin-index-weighted statistics that are
 *     scale-blind. SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives skewness toward 0 (symmetric about the
 *     centroid of a uniform PSD).
 *   - BIN-PERMUTATION (frequency reshuffle): NOT invariant --
 *     skewness depends on the bin index k via (k - mu)^3.
 *     This is the key orthogonality witness vs crest (89),
 *     flatness (85), and entropy (69), all of which are bin-
 *     permutation INVARIANT.
 *   - BIN-REVERSAL k -> K + 1 - k (mirror PSD about the centre
 *     bin): FLIPS THE SIGN of skewness while preserving its
 *     magnitude. Confirms that skewness reads asymmetry in a
 *     directed way on the bin axis.
 *
 * Bound: |skewness| <= sqrt(usableBins - 2) * (usableBins - 1)
 *  / sqrt(usableBins) (Wilkins 1944) on any usableBins-point
 *  non-negative-mass support; the hard floor `--min-tenure-
 *  days 8` keeps `K = floor(n/2) >= 4` and enforces
 *  `usableBins >= 3` so the envelope is non-trivial.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralSkewnessSort =
  | 'skew'
  | 'skewDesc'
  | 'absSkewDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralSkewnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we require usableBins >= 3 for a non-degenerate third
   * central moment; on a 2-bin support the third moment
   * collapses to a sign-determined point mass).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralSkewnessSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralSkewnessSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of one-sided Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the moments. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** First raw moment of P[k]: spectral centroid in bin units. */
  centroidBin: number;
  /** Sqrt of second central moment of P[k] in bin units. */
  bandwidth: number;
  /** Third central moment of P[k] in cubed-bin units (signed). */
  thirdCentralMoment: number;
  /** Third standardised central moment (dimensionless, signed). */
  skewness: number;
}

export interface DailyTokenSpectralSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralSkewnessSort;
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
  droppedZeroBandwidth: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralSkewnessSourceRow[];
}

/**
 * Spectral skewness primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * `{ skewness, centroidBin, bandwidth, thirdCentralMoment,
 *    usableBins }` where
 *
 *   centroidBin        = sum k * p_k / sum p_k
 *   bandwidth          = sqrt(sum (k - mu)^2 p_k / sum p_k)
 *   thirdCentralMoment = sum (k - mu)^3 p_k / sum p_k
 *   skewness           = thirdCentralMoment / bandwidth^3
 *
 * over bins with p > 0, with usableBins the count of those
 * surviving bins.
 *
 * USABLEBINS GATE: requires usableBins >= 3. With one bin the
 * second central moment is 0 (skewness undefined; sigma^3 = 0
 * denominator). With two bins the spectrum is a sign-
 * determined point mass: bandwidth and thirdCentralMoment are
 * both algebraically pinned by the two bin indices and their
 * power ratio, so the standardised third moment carries no
 * additional shape information beyond which bin is larger.
 *
 * BANDWIDTH GATE: requires bandwidth > 0. With three or more
 * surviving bins, bandwidth = 0 only happens via floating-
 * point cancellation on a degenerate equal-mass-equal-bin
 * configuration; we surface this as a `zero bandwidth` throw
 * for the orchestrator to route into the
 * `droppedZeroBandwidth` counter.
 *
 * SIGN: skewness > 0 -- right-skewed PSD (long tail above
 * mu); skewness < 0 -- left-skewed PSD (long tail below mu);
 * skewness = 0 -- symmetric about mu.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when fewer than 3 bins survive the strictly-
 * positive filter, when the total power is non-positive, or
 * when bandwidth = 0.
 */
export function spectralSkewness(power: number[]): {
  skewness: number;
  centroidBin: number;
  bandwidth: number;
  thirdCentralMoment: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralSkewness: empty power vector');
  }
  let m = 0;
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralSkewness: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralSkewness: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      totalPower += p;
      m += 1;
    }
  }
  if (m < 3) {
    throw new Error(
      `spectralSkewness: too few positive-power bins (${m}; need >= 3)`,
    );
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralSkewness: non-positive total power after sum (${totalPower})`,
    );
  }
  // First raw moment: centroid in 1-indexed bin units.
  let muNum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) muNum += (i + 1) * p;
  }
  const centroidBin = muNum / totalPower;
  // Second central moment (variance in bin units).
  let varNum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      const d = i + 1 - centroidBin;
      varNum += d * d * p;
    }
  }
  const variance = varNum / totalPower;
  if (!(variance > 0)) {
    throw new Error(
      `spectralSkewness: zero bandwidth (variance=${variance}; degenerate equal-bin spectrum)`,
    );
  }
  const bandwidth = Math.sqrt(variance);
  // Third central moment (signed, in cubed-bin units).
  let thirdNum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      const d = i + 1 - centroidBin;
      thirdNum += d * d * d * p;
    }
  }
  const thirdCentralMoment = thirdNum / totalPower;
  const skewness = thirdCentralMoment / (bandwidth * bandwidth * bandwidth);
  return {
    skewness,
    centroidBin,
    bandwidth,
    thirdCentralMoment,
    usableBins: m,
  };
}

/**
 * Daily-token spectral-skewness primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the third
 * standardised central moment about the spectral centroid
 * over the surviving non-DC bins, and returns the skewness,
 * centroid in bin units, bandwidth (sqrt of second central
 * moment) in bin units, the unstandardised third central
 * moment in cubed-bin units, and the input mean / stddev /
 * bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when fewer than
 * 3 bins survive the strictly-positive-power filter, or when
 * the spectral bandwidth is zero (degenerate equal-mass-
 * equal-bin floating-point edge case).
 */
export function dailyTokenSpectralSkewness(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  centroidBin: number;
  bandwidth: number;
  thirdCentralMoment: number;
  skewness: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralSkewness: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralSkewness requires finite values',
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
      'dailyTokenSpectralSkewness: zero variance (constant series)',
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
  const result = spectralSkewness(power);
  if (
    !Number.isFinite(result.skewness) ||
    !Number.isFinite(result.centroidBin) ||
    !Number.isFinite(result.bandwidth) ||
    !Number.isFinite(result.thirdCentralMoment)
  ) {
    throw new Error(
      `dailyTokenSpectralSkewness: non-finite output (skewness=${result.skewness}, centroidBin=${result.centroidBin}, bandwidth=${result.bandwidth}, thirdCentralMoment=${result.thirdCentralMoment})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins: result.usableBins,
    centroidBin: result.centroidBin,
    bandwidth: result.bandwidth,
    thirdCentralMoment: result.thirdCentralMoment,
    skewness: result.skewness,
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

export function buildDailyTokenSpectralSkewness(
  queue: QueueLine[],
  opts: DailyTokenSpectralSkewnessOptions = {},
): DailyTokenSpectralSkewnessReport {
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
  const sort: DailyTokenSpectralSkewnessSort = opts.sort ?? 'absSkewDesc';
  const validSorts: DailyTokenSpectralSkewnessSort[] = [
    'skew',
    'skewDesc',
    'absSkewDesc',
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
  let droppedZeroBandwidth = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralSkewnessSourceRow[] = [];

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
      result = dailyTokenSpectralSkewness(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('too few positive-power bins')) {
        droppedTooFewUsableBins += 1;
      } else if (msg.includes('zero bandwidth')) {
        droppedZeroBandwidth += 1;
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
      bandwidth: result.bandwidth,
      thirdCentralMoment: result.thirdCentralMoment,
      skewness: result.skewness,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'skew':
        primary = a.skewness - b.skewness;
        break;
      case 'skewDesc':
        primary = b.skewness - a.skewness;
        break;
      case 'absSkewDesc':
        primary = Math.abs(b.skewness) - Math.abs(a.skewness);
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
    droppedZeroBandwidth,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
