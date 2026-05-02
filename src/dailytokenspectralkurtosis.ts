/**
 * daily-token-spectral-kurtosis: per-source SPECTRAL KURTOSIS
 * (fourth standardised central moment) of the gap-filled daily
 * total_tokens series, defined as
 *
 *   mu       = sum_{k=1..K} k * P[k] / sum_{k=1..K} P[k]
 *   sigma^2  = sum_{k=1..K} (k - mu)^2 * P[k] / sum_{k=1..K} P[k]
 *   m4       = sum_{k=1..K} (k - mu)^4 * P[k] / sum_{k=1..K} P[k]
 *   kurtosis = m4 / sigma^4         (Pearson; always >= 1)
 *   excess   = kurtosis - 3         (Fisher; Gaussian baseline 0)
 *
 * over the surviving (strictly-positive-power) non-DC band of
 * the one-sided periodogram of the mean-centred series.
 *
 * NINETY-FIRST cross-source axis. Joins the spectral heptad
 * (84 DFT-slope, 85 Wiener-flatness, 86 spectral-centroid,
 * 87 spectral-bandwidth, 88 spectral-rolloff, 89 spectral-
 * crest, 90 spectral-skewness) into a SPECTRAL OCTAD by
 * closing the FOURTH standardised central moment slot --
 * peakedness / tail-weight of the PSD about its centroid.
 *
 * Operationally, given the gap-filled daily series y of length
 * n:
 *
 *   1. Mean-centre y (drops DC; bin 0 is exactly zero and the
 *      moments are read on the non-DC band).
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2).
 *   3. Drop bins with P[k] <= 0 (spectral nulls). The third-
 *      moment axis (skewness) only needs >= 3 surviving bins,
 *      but the FOURTH moment is degenerate on 3 bins (with mu
 *      symmetric about the middle bin the (k-mu)^4 weights
 *      are pinned by the two outer bins and m4 / m2^2
 *      collapses to a fixed function of the outer-to-middle
 *      power ratio; carries no shape information beyond it).
 *      We require usableBins >= 4 -- the smallest support on
 *      which kurtosis can vary independently of (mu, sigma).
 *   4. Compute centroid mu, second central moment sigma^2,
 *      and fourth central moment m4 about mu.
 *   5. Standardise: kurtosis = m4 / sigma^4. Report
 *      `kurtosis` (Pearson, always >= 1) and the Fisher
 *      `excess = kurtosis - 3` (signed; > 0 leptokurtic,
 *      < 0 platykurtic, ~ 0 mesokurtic).
 *
 * SIGN / SHAPE CONVENTION:
 *
 *   - kurtosis ~ 1   -- two-bin point-mass spectrum at the
 *     extreme support of m4 / sigma^4 (rare; only reachable
 *     near the usableBins gate); algebraic floor.
 *   - kurtosis ~ 1.8 -- uniform power across the surviving
 *     band (continuous-uniform reference; the standard
 *     "white-on-band" baseline with sigma^2 = (K^2-1)/12
 *     and m4 = (3K^4 - 7K^2 + ...)/240 -> ratio -> 9/5 = 1.8).
 *   - kurtosis = 3   -- Gaussian-shaped PSD baseline
 *     (excess = 0, mesokurtic).
 *   - kurtosis > 3   -- LEPTOKURTIC PSD: a sharply peaked
 *     spectral mode at mu with heavier tails than Gaussian
 *     (typical for series with one dominant frequency and
 *     leakage into far-from-mu bins).
 *   - kurtosis < 3   -- PLATYKURTIC PSD: a flatter-topped
 *     spectral mass with lighter tails than Gaussian
 *     (broadband-noise-like or two-tone-symmetric PSDs).
 *
 * BOUNDS:
 *
 *   - Pearson 1916 / Wilkins 1944 give the algebraic envelope
 *     kurtosis >= 1 + skewness^2 on any non-negative-mass
 *     standardised distribution (the "Pearson inequality";
 *     sharp on two-point supports). For an n-point support
 *     the upper envelope is kurtosis <= (n^2 - 3n + 3) / (n-1)
 *     (Wilkins 1944), which grows roughly as n; the
 *     `usableBins >= 4` gate keeps the envelope finite.
 *   - In practice for daily-token PSDs the realised kurtosis
 *     sits in [1.5, 50]; runaway magnitudes (>> 100) usually
 *     flag a near-degenerate two-bin-dominated spectrum just
 *     barely above the usableBins >= 4 floor.
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - kurtosis in [1.5, 2.5] -- platykurtic / flat-topped PSD;
 *     mass is broadly distributed across the surviving band.
 *   - kurtosis in [2.5, 3.5] -- near-Gaussian-shaped PSD; the
 *     spectral mass tapers from a single mode at roughly the
 *     bell-curve rate.
 *   - kurtosis in [3.5, 10] -- moderately leptokurtic PSD;
 *     a clear dominant mode with non-trivial leakage tails.
 *   - kurtosis > 10 -- strongly leptokurtic PSD; one or two
 *     bins dominate and the (k-mu)^4 weighting amplifies
 *     even mild high-bin-distance tails.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report v1.0, 2004 --
 *     §6.1.4 defines the spectral kurtosis as the fourth
 *     standardised central moment of the magnitude spectrum
 *     about the spectral centroid; explicitly listed as the
 *     PEAKEDNESS / TAIL-WEIGHT descriptor sitting one moment
 *     beyond the spectral skewness.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 lists spectral
 *     kurtosis as the canonical SHAPE-PEAKEDNESS descriptor
 *     in the moment sequence
 *       centroid (1st) -> spread (2nd) -> skewness (3rd) ->
 *       KURTOSIS (4th).
 *   Antoni, J., "The spectral kurtosis: a useful tool for
 *     characterising non-stationary signals", Mech. Syst.
 *     Signal Proc. 20(2), 2006 -- the canonical engineering
 *     reference for spectral kurtosis as a non-stationarity /
 *     transient detector on the per-frequency-bin energy
 *     distribution.
 *   Pearson, K., "Mathematical contributions to the theory of
 *     evolution. XIX. Second supplement to a memoir on skew
 *     variation", Phil. Trans. Roy. Soc. London A 216, 1916 --
 *     the foundational definition of kurtosis as the fourth
 *     standardised central moment.
 *   Wilkins, J. E., "A note on skewness and kurtosis", Annals
 *     of Math. Stat. 15(3):333-335, 1944 -- algebraic envelope
 *     kurtosis <= (n^2 - 3n + 3) / (n - 1) on any n-point
 *     discrete support, and the floor kurtosis >= 1 +
 *     skewness^2 (Pearson inequality).
 *
 * STRUCTURAL ORTHOGONALITY -- a SIGN-BLIND, STANDARDISED
 * FOURTH CENTRAL MOMENT statistic on the Fourier power
 * spectrum, distinct from every shipped daily-token axis
 * 32..90:
 *
 *   - vs `daily-token-spectral-skewness` (axis 90): skewness
 *     is the SIGNED THIRD standardised central moment about mu;
 *     kurtosis is the SIGN-BLIND FOURTH standardised central
 *     moment about the same mu. Two spectra with the same
 *     skewness can have arbitrarily different kurtosis (a
 *     mild-tail vs a heavy-tail PSD with identical asymmetry).
 *     Bin-reversal FLIPS the skewness sign but PRESERVES
 *     kurtosis exactly -- the precise orthogonality witness.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): bandwidth
 *     is the SECOND CENTRAL MOMENT (sqrt of sigma^2);
 *     kurtosis STANDARDISES m4 BY sigma^4 so its dependence
 *     on bandwidth is divided out. Two spectra with very
 *     different bandwidths can have identical kurtosis;
 *     conversely the same bandwidth can host arbitrarily
 *     different kurtosis values (uniform vs leptokurtic over
 *     the same support). SPREAD vs SHAPE-AT-FIXED-SPREAD is
 *     the witness.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is a PEAK-vs-MEAN RATIO that does not reference bin
 *     index (BIN-PERMUTATION INVARIANT). Kurtosis is bin-
 *     index-weighted by (k - mu)^4 (BIN-PERMUTATION SENSITIVE).
 *     Two spectra with identical crest can have very
 *     different kurtosis (a single big bin AT mu vs the same
 *     big bin FAR FROM mu).
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): roll-off is
 *     a CDF QUANTILE; kurtosis integrates the FOURTH-power
 *     deviation over ALL bins. Two spectra can share an
 *     identical roll-off at very different kurtosis values.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT (location); kurtosis is the
 *     FOURTH STANDARDISED CENTRAL MOMENT (shape about that
 *     location, location-blind after centring). Translating
 *     a PSD along the bin axis preserves kurtosis exactly.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM ratio (BIN-PERMUTATION INVARIANT,
 *     bounded in [0, 1]). Kurtosis is bin-permutation-
 *     sensitive and unbounded above. Mirror-reflected PSDs
 *     share GM/AM but preserve kurtosis exactly while flipping
 *     skewness sign.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE on log-frequency / log-power axes;
 *     kurtosis is the FOURTH MOMENT on the LINEAR power axis.
 *     Distinct functionals of P[k]; a power-law spectrum has
 *     a definite kurtosis but the slope and the kurtosis are
 *     algebraically independent.
 *
 *   - vs `source-row-token-spectral-kurtosis` (the per-row
 *     spectral kurtosis on the raw total_tokens-per-row
 *     stream): that statistic operates on the per-row STREAM
 *     (row-index time axis, no gap-filling, no daily
 *     aggregation). The new axis operates on the gap-filled
 *     DAILY aggregate (calendar-day time axis, mean-centred,
 *     UTC bucketed). PER-ROW-AT-SOURCE vs DAILY-AGGREGATE-AT-
 *     SOURCE is the orthogonality witness; the two can move
 *     in opposite directions on the same source (per-row
 *     bursts vs daily totals decoupled by intra-day clumping).
 *
 *   - vs all permutation-invariant amplitude-shape axes 32..67:
 *     those are TIME-DOMAIN shuffle-invariant; spectral
 *     kurtosis depends on the order of bins and is therefore
 *     bin-permutation-SENSITIVE.
 *
 * INVARIANCES of kurtosis:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     mu, sigma and m4 are bin-index-weighted statistics that
 *     ARE scale-blind on standardisation. SCALE-INVARIANT for
 *     any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives kurtosis toward the uniform-band reference.
 *   - BIN-PERMUTATION (frequency reshuffle): NOT invariant --
 *     kurtosis depends on the bin index k via (k - mu)^4.
 *   - BIN-REVERSAL k -> K + 1 - k (mirror PSD about the centre
 *     bin): PRESERVES kurtosis EXACTLY (the (k-mu)^4 weighting
 *     is even, so reflecting about mu leaves m4 unchanged
 *     while flipping skewness sign). The precise orthogonality
 *     witness vs axis 90.
 *
 * Bound: 1 + skewness^2 <= kurtosis <= (m^2 - 3m + 3)/(m-1)
 *  on any m-point non-negative-mass support (Pearson 1916 /
 *  Wilkins 1944); the `usableBins >= 4` gate keeps the upper
 *  envelope finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralKurtosisSort =
  | 'kurt'
  | 'kurtDesc'
  | 'excessAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralKurtosisOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we require usableBins >= 4 for a non-degenerate fourth
   * central moment; on a 3-bin support kurtosis collapses to
   * a fixed function of the outer-to-middle power ratio).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralKurtosisSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralKurtosisSourceRow {
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
  /** Fourth central moment of P[k] in quartic-bin units (>= 0). */
  fourthCentralMoment: number;
  /** Fourth standardised central moment (Pearson; >= 1). */
  kurtosis: number;
  /** Excess kurtosis (Fisher; kurtosis - 3). */
  excessKurtosis: number;
}

export interface DailyTokenSpectralKurtosisReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralKurtosisSort;
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
  sources: DailyTokenSpectralKurtosisSourceRow[];
}

/**
 * Spectral kurtosis primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * `{ kurtosis, excessKurtosis, centroidBin, bandwidth,
 *    fourthCentralMoment, usableBins }` where
 *
 *   centroidBin         = sum k * p_k / sum p_k
 *   bandwidth           = sqrt(sum (k - mu)^2 p_k / sum p_k)
 *   fourthCentralMoment = sum (k - mu)^4 p_k / sum p_k
 *   kurtosis            = fourthCentralMoment / bandwidth^4
 *   excessKurtosis      = kurtosis - 3
 *
 * over bins with p > 0, with usableBins the count of those
 * surviving bins.
 *
 * USABLEBINS GATE: requires usableBins >= 4. With one bin
 * sigma = 0 (kurtosis undefined; sigma^4 = 0 denominator).
 * With two or three bins kurtosis is algebraically pinned by
 * the mu/sigma fit and carries no independent shape
 * information beyond what skewness and bandwidth already
 * report.
 *
 * BANDWIDTH GATE: requires bandwidth > 0. With four or more
 * surviving bins bandwidth = 0 only happens via floating-
 * point cancellation on a degenerate equal-mass-equal-bin
 * configuration; we surface this as a `zero bandwidth` throw
 * for the orchestrator to route into the
 * `droppedZeroBandwidth` counter.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when fewer than 4 bins survive the strictly-
 * positive filter, when the total power is non-positive, or
 * when bandwidth = 0.
 */
export function spectralKurtosis(power: number[]): {
  kurtosis: number;
  excessKurtosis: number;
  centroidBin: number;
  bandwidth: number;
  fourthCentralMoment: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralKurtosis: empty power vector');
  }
  let m = 0;
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralKurtosis: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralKurtosis: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      totalPower += p;
      m += 1;
    }
  }
  if (m < 4) {
    throw new Error(
      `spectralKurtosis: too few positive-power bins (${m}; need >= 4)`,
    );
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralKurtosis: non-positive total power after sum (${totalPower})`,
    );
  }
  let muNum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) muNum += (i + 1) * p;
  }
  const centroidBin = muNum / totalPower;
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
      `spectralKurtosis: zero bandwidth (variance=${variance}; degenerate equal-bin spectrum)`,
    );
  }
  const bandwidth = Math.sqrt(variance);
  let fourthNum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      const d = i + 1 - centroidBin;
      const d2 = d * d;
      fourthNum += d2 * d2 * p;
    }
  }
  const fourthCentralMoment = fourthNum / totalPower;
  const kurtosis = fourthCentralMoment / (variance * variance);
  return {
    kurtosis,
    excessKurtosis: kurtosis - 3,
    centroidBin,
    bandwidth,
    fourthCentralMoment,
    usableBins: m,
  };
}

/**
 * Daily-token spectral-kurtosis primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the fourth
 * standardised central moment about the spectral centroid
 * over the surviving non-DC bins, and returns the kurtosis
 * (Pearson), excess kurtosis (Fisher), centroid in bin units,
 * bandwidth (sqrt of second central moment) in bin units, the
 * unstandardised fourth central moment in quartic-bin units,
 * and the input mean / stddev / bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when fewer than
 * 4 bins survive the strictly-positive-power filter, or when
 * the spectral bandwidth is zero (degenerate equal-mass-
 * equal-bin floating-point edge case).
 */
export function dailyTokenSpectralKurtosis(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  centroidBin: number;
  bandwidth: number;
  fourthCentralMoment: number;
  kurtosis: number;
  excessKurtosis: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralKurtosis: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralKurtosis requires finite values',
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
      'dailyTokenSpectralKurtosis: zero variance (constant series)',
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
  const result = spectralKurtosis(power);
  if (
    !Number.isFinite(result.kurtosis) ||
    !Number.isFinite(result.excessKurtosis) ||
    !Number.isFinite(result.centroidBin) ||
    !Number.isFinite(result.bandwidth) ||
    !Number.isFinite(result.fourthCentralMoment)
  ) {
    throw new Error(
      `dailyTokenSpectralKurtosis: non-finite output (kurtosis=${result.kurtosis}, excessKurtosis=${result.excessKurtosis}, centroidBin=${result.centroidBin}, bandwidth=${result.bandwidth}, fourthCentralMoment=${result.fourthCentralMoment})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins: result.usableBins,
    centroidBin: result.centroidBin,
    bandwidth: result.bandwidth,
    fourthCentralMoment: result.fourthCentralMoment,
    kurtosis: result.kurtosis,
    excessKurtosis: result.excessKurtosis,
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

export function buildDailyTokenSpectralKurtosis(
  queue: QueueLine[],
  opts: DailyTokenSpectralKurtosisOptions = {},
): DailyTokenSpectralKurtosisReport {
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
  const sort: DailyTokenSpectralKurtosisSort = opts.sort ?? 'kurtDesc';
  const validSorts: DailyTokenSpectralKurtosisSort[] = [
    'kurt',
    'kurtDesc',
    'excessAbsDesc',
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
  const rows: DailyTokenSpectralKurtosisSourceRow[] = [];

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
      result = dailyTokenSpectralKurtosis(filled);
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
      fourthCentralMoment: result.fourthCentralMoment,
      kurtosis: result.kurtosis,
      excessKurtosis: result.excessKurtosis,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kurt':
        primary = a.kurtosis - b.kurtosis;
        break;
      case 'kurtDesc':
        primary = b.kurtosis - a.kurtosis;
        break;
      case 'excessAbsDesc':
        primary = Math.abs(b.excessKurtosis) - Math.abs(a.excessKurtosis);
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
