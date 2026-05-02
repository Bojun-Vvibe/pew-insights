/**
 * daily-token-spectral-rolloff: per-source SPECTRAL ROLL-OFF
 * frequency of the gap-filled daily total_tokens series,
 * defined as the smallest bin index R such that the cumulative
 * one-sided periodogram up to and including R reaches a chosen
 * fraction (default 0.85) of the total non-DC spectral energy.
 *
 * EIGHTY-EIGHTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length
 * n:
 *
 *   1. Mean-centre y (drops DC; required for a faithful CDF
 *      over the non-DC band on strictly-positive series).
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2) (DC bin omitted; mean already removed).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; defensive
 *      finite-floor pass; usableBins counts the survivors and
 *      MUST be >= 2 for a non-trivial CDF).
 *   4. Compute totalPower = sum_{k} P[k] over surviving bins.
 *   5. Walk k = 1..K from the LOW frequency end accumulating
 *      cumulative = sum_{j<=k} P[j]. The roll-off bin R is the
 *      smallest k for which cumulative / totalPower >=
 *      rolloffFraction. Reported quantities:
 *        - rolloffBin         : the integer bin R, in [1, K].
 *        - rolloffFraction    : the requested fraction (0.85
 *                               by default; configurable via
 *                               --rolloff-fraction).
 *        - rolloffNormalised  : R / K in (0, 1] -- a scale-free
 *                               band-edge in fraction-of-Nyquist
 *                               units that makes series of
 *                               different lengths directly
 *                               comparable.
 *        - cumulativeFraction : the realised cumulative fraction
 *                               attained at R (>= rolloffFraction
 *                               by construction).
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - rolloffNormalised < 0.10 : LOW-FREQUENCY-DOMINATED energy
 *     (>= 85% of non-DC mass concentrated in the slowest-moving
 *     bins -- pink/red noise, slow drift dominated).
 *   - rolloffNormalised ~ 0.30 - 0.60 : BROADBAND mid-band
 *     concentration (typical for natural daily token traces
 *     with some weekly periodicity).
 *   - rolloffNormalised ~ rolloffFraction : WHITE-NOISE-LIKE
 *     band-edge (uniform PSD has cumulative-fraction-of-energy
 *     proportional to bin index, so R / K -> rolloffFraction).
 *   - rolloffNormalised > 0.85 : HIGH-FREQUENCY-DOMINATED energy
 *     (most non-DC mass at the fast end of the band -- bursty,
 *     impulse-like, or noise-floor saturated).
 *
 * REFERENCES:
 *
 *   Tzanetakis, G. & Cook, P., "Musical Genre Classification
 *     of Audio Signals", IEEE Trans. Speech Audio Process.,
 *     10(5):293-302, 2002 -- §III.A.4 introduces spectral
 *     roll-off as the frequency below which 85% of the
 *     magnitude distribution is concentrated, and pairs it
 *     with centroid and flux as the canonical timbre triple.
 *   McKinney, M. F. & Breebaart, J., "Features for Audio and
 *     Music Classification", Proc. ISMIR 2003, pp. 151-158
 *     -- standard reference establishing roll-off alongside
 *     flatness, centroid, and spread.
 *   Klapuri, A., "Sound onset detection by applying
 *     psychoacoustic knowledge", Proc. ICASSP-99, vol. 6,
 *     pp. 3089-3092, 1999 -- earlier mention of cumulative-
 *     energy band-edge in the onset-detection context.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 (spectral
 *     roll-off as a CDF percentile of the magnitude
 *     spectrum).
 *
 * STRUCTURAL ORTHOGONALITY -- a CDF-PERCENTILE statistic on
 * the Fourier power spectrum, distinct from every shipped
 * daily-token axis 32..87:
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): bandwidth
 *     is the SECOND CENTRAL MOMENT (sqrt) about the centroid.
 *     Roll-off is a CUMULATIVE-CDF QUANTILE -- a percentile,
 *     NOT a moment. Two spectra can share an identical
 *     bandwidth at very different roll-offs (a symmetric
 *     two-tone at bins (k0, k0 + d) and a one-sided two-tone
 *     at bins (1, 1 + d) share bandwidth d/2 but have totally
 *     different roll-offs). Symmetrically two spectra can
 *     share an identical roll-off at very different bandwidths
 *     (a thin spike at bin R vs a wide hump centred near R
 *     both reach the 85% mark at R but have very different
 *     spreads). MOMENT vs QUANTILE is the precise orthogonality
 *     witness.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid is
 *     the MASS-WEIGHTED MEAN bin (a first moment). Roll-off is
 *     the bin where the CUMULATIVE MASS first reaches a chosen
 *     quantile. For a symmetric unimodal spectrum the centroid
 *     and the median (50% roll-off) coincide, but the 85%
 *     roll-off lies WELL above the centroid; for a heavily
 *     left-skewed spectrum (mass concentrated at low k with a
 *     long tail) the 85% roll-off lies far above the centroid.
 *     MEAN vs PERCENTILE -- the same orthogonality witness as
 *     median-vs-mean in the amplitude domain.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM RATIO over kept bins and is
 *     BIN-PERMUTATION-INVARIANT. Roll-off is BIN-PERMUTATION-
 *     SENSITIVE (it depends on the cumulative integral up to
 *     bin index R). Reshuffling bin indices preserves flatness
 *     but can change roll-off arbitrarily.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE of P[k] in log k. Roll-off is a
 *     LINEAR-AXIS PERCENTILE in k. A 1/k power spectrum
 *     truncated to a few low bins and the same beta spread
 *     across many bins share beta but have very different
 *     roll-offs. Roll-off is also well-defined on spectra
 *     that are NOT power laws at all (line spectra, comb
 *     spectra) where beta is meaningless.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): entropy is
 *     the SHANNON ENTROPY of the L1-normalised periodogram --
 *     a SHAPE-DISPERSION statistic that is BIN-PERMUTATION-
 *     INVARIANT. Roll-off is BIN-PERMUTATION-SENSITIVE. A
 *     two-tone spectrum at bins (2, 8) and the same two-tone
 *     spectrum reshuffled to bins (8, 30) share entropy =
 *     log 2 but their roll-offs differ.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is a
 *     STRING-COMBINATORIAL phrase count on the median-binarised
 *     time-domain stream. Roll-off is a CONTINUOUS frequency-
 *     domain CDF percentile.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): sign counts of
 *     derivatives in the time domain (amplitude-blind).
 *     Roll-off is a power-weighted spectral CDF percentile.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     LOCAL TRIPLET energy operator in the TIME DOMAIN that
 *     responds to high-frequency content via its
 *     y[i]^2 - y[i-1]*y[i+1] kernel, but it is a TIME-DOMAIN
 *     sum, not a frequency-band edge.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `hjorth-
 *     complexity` (axis 80): Hjorth statistics are RATIOS of
 *     low-order spectral MOMENTS in ANGULAR-FREQUENCY units
 *     (mobility = sqrt(m_2 / m_0); complexity = sqrt(m_4
 *     m_0 / m_2^2) - 1). Roll-off is a CDF PERCENTILE in
 *     BIN-INDEX units. A spectrum with most mass at low k
 *     plus a tiny but very high-k tail can have a small
 *     roll-off (CDF reaches 85% before the tail) but a large
 *     mobility (the tail moves m_2 a lot).
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): GEOMETRIC fractal
 *     dimensions on the time-domain curve; no closed-form link
 *     to a frequency-domain CDF percentile.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): time-domain SCALING exponents.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; roll-off is a whole-spectrum CDF percentile.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant. Time-
 *     domain shuffling whitens the spectrum and drives the
 *     roll-off toward the white-noise asymptote R / K ->
 *     rolloffFraction. Roll-off is therefore TIME-DOMAIN-
 *     SHUFFLE-SENSITIVE.
 *
 * INVARIANCES of rolloffNormalised:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     the cumulative-fraction CDF is scale-blind. SCALE-
 *     INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives the roll-off toward the uniform asymptote
 *     R / K -> rolloffFraction.
 *   - BIN-PERMUTATION (frequency reshuffle): NOT invariant --
 *     this is the key orthogonality witness vs flatness (85)
 *     and entropy (69), which are bin-permutation-INVARIANT.
 *
 * Bound: rolloffBin in [1, K] (rolloffFraction > 0 forces
 * R >= 1; rolloffFraction <= 1 caps R <= K). After
 * normalisation rolloffNormalised lies in (0, 1].
 * cumulativeFraction lies in [rolloffFraction, 1] by
 * construction. usableBins >= 2 is enforced (a single bin
 * trivially pins R = 1 with no CDF information).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralRolloffSort =
  | 'rolloff'
  | 'rolloffDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralRolloffOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for a non-trivial CDF
   * percentile; a single bin trivially pins R = 1 with no
   * percentile information).
   */
  minTenureDays?: number;
  /**
   * Cumulative-energy fraction at which to read the roll-off
   * bin. Must be in (0, 1]. Default 0.85 (the canonical
   * Tzanetakis & Cook 2002 / McKinney & Breebaart 2003 value).
   * Common alternatives: 0.50 (median band-edge), 0.95 (high-
   * frequency cut-off).
   */
  rolloffFraction?: number;
  top?: number;
  sort?: DailyTokenSpectralRolloffSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralRolloffSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of strictly-positive Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the CDF. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** roll-off bin in [1, K]. */
  rolloffBin: number;
  /** rolloffBin / K in (0, 1]. */
  rolloffNormalised: number;
  /** realised cumulative fraction at rolloffBin, in [rolloffFraction, 1]. */
  cumulativeFraction: number;
}

export interface DailyTokenSpectralRolloffReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  rolloffFraction: number;
  top: number;
  sort: DailyTokenSpectralRolloffSort;
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
  sources: DailyTokenSpectralRolloffSourceRow[];
}

/**
 * Spectral-rolloff primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * { rolloffBin, cumulativeFraction, usableBins } where
 *   rolloffBin         = smallest k s.t. sum_{j<=k} p_j >= rolloffFraction * sum p
 *   cumulativeFraction = sum_{j<=rolloffBin} p_j / sum p
 * over bins with p > 0, and usableBins is the count of those
 * surviving bins.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, when the total power is zero, when fewer
 * than 2 bins survive the strictly-positive filter, or when
 * rolloffFraction is outside (0, 1].
 */
export function spectralRolloffBin(
  power: number[],
  rolloffFraction: number,
): {
  rolloffBin: number;
  cumulativeFraction: number;
  usableBins: number;
} {
  if (
    !Number.isFinite(rolloffFraction) ||
    rolloffFraction <= 0 ||
    rolloffFraction > 1
  ) {
    throw new Error(
      `spectralRolloffBin: rolloffFraction must be in (0, 1] (got ${rolloffFraction})`,
    );
  }
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralRolloffBin: empty power vector');
  }
  let m = 0;
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralRolloffBin: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralRolloffBin: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      totalPower += p;
      m += 1;
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralRolloffBin: too few positive-power bins (${m}; need >= 2)`,
    );
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralRolloffBin: non-positive total power after sum (${totalPower})`,
    );
  }
  const target = rolloffFraction * totalPower;
  let cumulative = 0;
  let rolloffBin = -1;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (p > 0) {
      cumulative += p;
    }
    if (cumulative >= target) {
      rolloffBin = i + 1;
      break;
    }
  }
  // Floating-point defence: target = rolloffFraction * totalPower
  // and we sum the same positive bins, so cumulative MUST reach
  // target by k = K. If a catastrophic-cancellation underflow
  // prevents that, pin to K (the upper bound of a CDF percentile).
  if (rolloffBin < 0) {
    rolloffBin = k;
    cumulative = totalPower;
  }
  const cumulativeFraction = cumulative / totalPower;
  return { rolloffBin, cumulativeFraction, usableBins: m };
}

/**
 * Daily-token spectral-rolloff primitive on a real-valued
 * series. Computes the one-sided periodogram, walks the CDF
 * up from the low-frequency end, and returns the roll-off bin,
 * the K-normalised roll-off in (0, 1], the realised cumulative
 * fraction, and the input mean / stddev / bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4 candidate
 * bins), when a non-finite value is present, when var(y) = 0
 * (every bin is exactly 0 power), when fewer than 2 bins
 * survive the strictly-positive-power filter, or when
 * rolloffFraction is outside (0, 1].
 */
export function dailyTokenSpectralRolloff(
  values: number[],
  rolloffFraction: number,
): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  rolloffBin: number;
  rolloffNormalised: number;
  cumulativeFraction: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralRolloff: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenSpectralRolloff requires finite values');
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
      'dailyTokenSpectralRolloff: zero variance (constant series)',
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
  const { rolloffBin, cumulativeFraction, usableBins } = spectralRolloffBin(
    power,
    rolloffFraction,
  );
  let rolloffNormalised = rolloffBin / k;
  // Floating-point defence: rolloffNormalised is mathematically
  // in (0, 1]. Pin to the closed upper bound for the documented
  // contract.
  if (rolloffNormalised <= 0) rolloffNormalised = 1 / k;
  if (rolloffNormalised > 1) rolloffNormalised = 1;
  if (
    !Number.isFinite(rolloffBin) ||
    !Number.isFinite(rolloffNormalised) ||
    !Number.isFinite(cumulativeFraction)
  ) {
    throw new Error(
      `dailyTokenSpectralRolloff: non-finite output (rolloffBin=${rolloffBin}, rolloffNormalised=${rolloffNormalised}, cumulativeFraction=${cumulativeFraction})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins,
    rolloffBin,
    rolloffNormalised,
    cumulativeFraction,
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

export function buildDailyTokenSpectralRolloff(
  queue: QueueLine[],
  opts: DailyTokenSpectralRolloffOptions = {},
): DailyTokenSpectralRolloffReport {
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
  const rolloffFraction = opts.rolloffFraction ?? 0.85;
  if (
    !Number.isFinite(rolloffFraction) ||
    rolloffFraction <= 0 ||
    rolloffFraction > 1
  ) {
    throw new Error(
      `rolloffFraction must be in (0, 1] (got ${opts.rolloffFraction})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralRolloffSort = opts.sort ?? 'rolloffDesc';
  const validSorts: DailyTokenSpectralRolloffSort[] = [
    'rolloff',
    'rolloffDesc',
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
  const rows: DailyTokenSpectralRolloffSourceRow[] = [];

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
      result = dailyTokenSpectralRolloff(filled, rolloffFraction);
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
      rolloffBin: result.rolloffBin,
      rolloffNormalised: result.rolloffNormalised,
      cumulativeFraction: result.cumulativeFraction,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rolloff':
        primary = a.rolloffNormalised - b.rolloffNormalised;
        break;
      case 'rolloffDesc':
        primary = b.rolloffNormalised - a.rolloffNormalised;
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
    rolloffFraction,
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
