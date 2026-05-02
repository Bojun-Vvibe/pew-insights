/**
 * daily-token-spectral-flatness-wiener: per-source SPECTRAL
 * FLATNESS (Wiener entropy) of the gap-filled daily total_tokens
 * series, defined as the ratio of the geometric mean to the
 * arithmetic mean of the strictly-positive Fourier-bin powers of
 * the one-sided periodogram of the mean-centred series.
 *
 * EIGHTY-FIFTH cross-source axis.
 *
 * Operationally, given the gap-filled daily series y of length n:
 *
 *   1. Mean-centre y.
 *   2. Compute the one-sided periodogram P[k] for k = 1..K with
 *      K = floor(n / 2) (DC bin omitted; mean already removed).
 *   3. Drop bins with P[k] <= 0 (spectral nulls; finite floor).
 *   4. Over the m surviving bins compute
 *
 *        flatness = exp( (1/m) * sum log(P[k]) )
 *                   ----------------------------------
 *                       (1/m) * sum P[k]
 *
 *      which is the GEOMETRIC-MEAN-OVER-ARITHMETIC-MEAN ratio of
 *      the survivor set, mathematically equivalent to
 *      `exp(-D_KL(uniform || P_normalised) - log m)` rearranged
 *      so as to land in the unit interval [0, 1].
 *
 * INTERPRETATION (heuristic guide, NOT a contract):
 *
 *   - flatness = 1.0 : every surviving bin has identical power
 *     (perfect Wiener-white spectrum across the kept bins).
 *   - flatness ~ 0.6 - 0.9 : broad, nearly-flat spectrum
 *     consistent with a noise-dominated regime.
 *   - flatness ~ 0.1 - 0.4 : structured spectrum with a few
 *     dominant tones standing well above the floor.
 *   - flatness -> 0 : pure-tone limit (one bin carries almost
 *     all the spectral mass; geometric mean collapses).
 *
 * REFERENCES:
 *
 *   Wiener, N., "Generalized harmonic analysis", Acta Math.
 *     55:117-258, 1930 (geometric-mean spectral measure).
 *   Gray, A. H., Markel, J. D., "A spectral-flatness measure for
 *     studying the autocorrelation method of linear prediction
 *     of speech analysis", IEEE Trans. ASSP 22(3):207-217,
 *     1974 (the canonical SFM definition used here).
 *   Johnston, J. D., "Transform coding of audio signals using
 *     perceptual noise criteria", IEEE J. Select. Areas Commun.
 *     6(2):314-323, 1988 (SFM as a tonality / coding gain
 *     diagnostic).
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the CUIDADO
 *     project", IRCAM tech. report, 2004 (SFM canonicalisation
 *     in MIR feature suites).
 *
 * STRUCTURAL ORTHOGONALITY -- a GEOMETRIC-VS-ARITHMETIC mean
 * ratio on the Fourier power spectrum, distinct from every
 * shipped daily-token axis 32..84:
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): spectral
 *     entropy is the SHANNON ENTROPY of the L1-normalised
 *     periodogram (a sum of -p_k * log p_k weighted by the
 *     ARITHMETIC-MEAN-NORMALISED probabilities). Flatness is the
 *     RATIO of geometric to arithmetic mean of the same
 *     unnormalised periodogram. The two agree only at the
 *     boundary (flat spectrum -> entropy = log K, flatness = 1;
 *     pure tone -> entropy = 0, flatness = 0); EVERYWHERE ELSE
 *     they diverge. Specifically: flatness is
 *     `exp((1/m) sum log P_k - log((1/m) sum P_k))` which is
 *     bounded by AM-GM and lives in [0, 1]; Shannon entropy on
 *     the same survivor set lives in [0, log m] and depends only
 *     on the L1-normalised shape, not on the geometric mean.
 *     A spectrum with two equal tones at separated frequencies
 *     has high entropy but very low flatness (most bins are
 *     near-zero, drowning the geometric mean).
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE of the periodogram across bin index k.
 *     Flatness is BIN-INDEX-INVARIANT -- you can permute the
 *     bins and the geometric / arithmetic mean ratio is
 *     unchanged. Therefore a perfectly tilted 1/f^beta spectrum
 *     and the SAME bin VALUES randomly reshuffled across bin
 *     indices share an IDENTICAL flatness value but have very
 *     different beta. This is the precise sense in which
 *     flatness measures SPECTRAL SHAPE INDEPENDENT OF FREQUENCY
 *     ORDERING, while beta measures the FREQUENCY-DEPENDENT
 *     TILT.
 *
 *   - vs `daily-token-lempel-ziv-complexity` (axis 83): LZ is a
 *     STRING-COMBINATORIAL dictionary count on the median-
 *     binarised time-domain stream. Flatness is a CONTINUOUS
 *     RATIO of two means of the FOURIER POWER spectrum. A
 *     perfectly-flat-spectrum white noise has flatness near 1
 *     and intermediate LZ; an alternating two-symbol time
 *     series has very low LZ and a flatness value that depends
 *     entirely on the residual high-frequency mass.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     LOCAL TRIPLET energy operator in the TIME DOMAIN.
 *     Flatness is a GLOBAL geometric/arithmetic-mean RATIO in
 *     the FREQUENCY DOMAIN. No closed-form link.
 *
 *   - vs `daily-token-curvature-sign-change-rate` (axis 82) /
 *     `daily-token-petrosian-fd` (axis 76): sign counts of
 *     derivatives (amplitude-blind). Flatness is a power-
 *     weighted spectral statistic.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `daily-token-
 *     hjorth-complexity` (axis 80): Hjorth statistics are
 *     RATIOS of low-order spectral MOMENTS (variance of the
 *     first / second differences vs variance of the series).
 *     Flatness is the RATIO of a HIGHER-ORDER summary
 *     (geometric mean) to a LOW-ORDER summary (arithmetic mean)
 *     across all kept bins. They cannot both be controlling
 *     estimators for the same shape change.
 *
 *   - vs `daily-token-box-count-fd` / `sevcik-fd` / `katz-fd` /
 *     `higuchi-fd` (axes 78/77/75/74): GEOMETRIC fractal
 *     dimensions on the time-domain curve; no closed-form link
 *     to a frequency-domain mean-ratio.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): time-domain SCALING exponents; flatness
 *     is a unitless mean-ratio of the spectrum.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) /
 *     `sample-entropy` (axis 73): ordinal / template-matching
 *     irregularity in the time domain.
 *
 *   - vs autocorrelation axes 67/68: single-lag time-domain
 *     statistics; flatness summarises the WHOLE periodogram
 *     in a single ratio.
 *
 *   - vs all permutation-invariant dispersion / shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant. Time-
 *     domain shuffling whitens the spectrum and drives flatness
 *     toward 1; therefore flatness is TIME-DOMAIN-SHUFFLE-
 *     SENSITIVE.
 *
 * INVARIANCES of flatness:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     the geometric mean scales by a^2 and the arithmetic mean
 *     scales by a^2; the RATIO is unchanged. SCALE-INVARIANT
 *     for any non-zero a (including negative).
 *   - SIGN-FLIP y -> -y: equivalent to scale by -1. SIGN-FLIP-
 *     INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives flatness toward 1.
 *   - BIN-PERMUTATION (frequency reshuffle): INVARIANT -- both
 *     means depend only on the multiset of bin values, not
 *     their k-index. This is the key orthogonality witness vs
 *     beta (axis 84), which is bin-permutation-SENSITIVE.
 *
 * Bound: flatness in [0, 1] by the AM-GM inequality, attained
 * at flatness = 1 iff all kept bins have identical power, and
 * approached as flatness -> 0 in the pure-tone limit (one
 * dominant bin). usableBins >= 2 is enforced (a single bin
 * trivially has flatness = 1).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralFlatnessWienerSort =
  | 'flatness'
  | 'flatnessDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralFlatnessWienerOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need at least 2 usable bins for a non-trivial flatness;
   * a single bin gives flatness = 1 by definition).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralFlatnessWienerSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralFlatnessWienerSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of strictly-positive Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** Bins with strictly positive power that entered the GM/AM ratio. */
  usableBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** SFM = GM(P_kept) / AM(P_kept) in [0, 1]. */
  flatness: number;
  /** ln(flatness) in (-inf, 0], reported in dB form for audio-style readability. */
  flatnessDb: number;
}

export interface DailyTokenSpectralFlatnessWienerReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralFlatnessWienerSort;
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
  sources: DailyTokenSpectralFlatnessWienerSourceRow[];
}

/**
 * Spectral-flatness primitive on a non-negative power vector.
 * Returns { flatness, usableBins } where flatness = GM / AM
 * over bins with p > 0, and usableBins is the count of those
 * surviving bins.
 *
 * Throws when the input is empty, contains a non-finite or
 * negative value, or when fewer than 2 bins survive the
 * strictly-positive filter (1 bin trivially gives flatness = 1
 * with no orthogonality content).
 */
export function spectralFlatnessWiener(power: number[]): {
  flatness: number;
  usableBins: number;
} {
  const k = power.length;
  if (k < 1) {
    throw new Error('spectralFlatnessWiener: empty power vector');
  }
  let m = 0;
  let arithSum = 0;
  let logSum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralFlatnessWiener: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralFlatnessWiener: negative power at index ${i} (${p})`,
      );
    }
    if (p > 0) {
      arithSum += p;
      logSum += Math.log(p);
      m += 1;
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralFlatnessWiener: too few positive-power bins (${m}; need >= 2)`,
    );
  }
  const arithMean = arithSum / m;
  const logMean = logSum / m;
  // GM = exp(logMean); ratio = exp(logMean) / arithMean.
  // Compute as exp(logMean - log arithMean) for numerical stability
  // when both quantities span many decades.
  const ratio = Math.exp(logMean - Math.log(arithMean));
  // AM-GM clip: ratio is mathematically in [0, 1] but floating
  // point may push it slightly above 1 when all bins are nearly
  // identical. Clamp to the closed unit interval to preserve
  // the contract.
  let flatness = ratio;
  if (flatness < 0) flatness = 0;
  if (flatness > 1) flatness = 1;
  return { flatness, usableBins: m };
}

/**
 * Daily-token spectral-flatness primitive on a real-valued
 * series. Computes the one-sided periodogram, evaluates the
 * GM/AM ratio over bins with P[k] > 0, and returns the
 * flatness alongside the mean, stddev, and total positive-bin
 * count.
 *
 * Throws when the series is too short (n < 8 -> K < 4 candidate
 * bins), when a non-finite value is present, when var(y) = 0
 * (every bin is exactly 0 power), or when fewer than 2 bins
 * survive the strictly-positive-power filter.
 */
export function dailyTokenSpectralFlatnessWiener(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  usableBins: number;
  flatness: number;
  flatnessDb: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralFlatnessWiener: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralFlatnessWiener requires finite values',
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
      'dailyTokenSpectralFlatnessWiener: zero variance (constant series)',
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
  const { flatness, usableBins } = spectralFlatnessWiener(power);
  // log-domain conversion: 10*log10(flatness). flatness in (0, 1]
  // maps to flatnessDb in (-inf, 0]. flatness = 1 -> 0 dB (flat
  // white spectrum); flatness = 0.1 -> -10 dB; flatness = 0.01
  // -> -20 dB; etc.
  const flatnessDb = flatness > 0 ? 10 * Math.log10(flatness) : -Infinity;
  if (
    !Number.isFinite(flatness) ||
    (!Number.isFinite(flatnessDb) && flatness > 0)
  ) {
    throw new Error(
      `dailyTokenSpectralFlatnessWiener: non-finite output (flatness=${flatness}, flatnessDb=${flatnessDb})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    usableBins,
    flatness,
    flatnessDb,
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

export function buildDailyTokenSpectralFlatnessWiener(
  queue: QueueLine[],
  opts: DailyTokenSpectralFlatnessWienerOptions = {},
): DailyTokenSpectralFlatnessWienerReport {
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
  const sort: DailyTokenSpectralFlatnessWienerSort = opts.sort ?? 'flatnessDesc';
  const validSorts: DailyTokenSpectralFlatnessWienerSort[] = [
    'flatness',
    'flatnessDesc',
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
  const rows: DailyTokenSpectralFlatnessWienerSourceRow[] = [];

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
      result = dailyTokenSpectralFlatnessWiener(filled);
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
      flatness: result.flatness,
      flatnessDb: result.flatnessDb,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'flatness':
        primary = a.flatness - b.flatness;
        break;
      case 'flatnessDesc':
        primary = b.flatness - a.flatness;
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
