/**
 * daily-token-spectral-peak-frequency: per-source SPECTRAL
 * PEAK-FREQUENCY -- the argmax-bin POSITION descriptor on the
 * one-sided non-DC periodogram of the gap-filled mean-centred
 * daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4 (gate enforced via
 * `--min-tenure-days 8`), let
 *
 *   k* = argmax_{k=1..K} P[k]
 *   peakFreqRatio = (k* - 1) / (K - 1)         in [0, 1]
 *   peakNormalisedFreq = k* / n                in (0, 0.5]
 *
 * Ties broken by SMALLEST k (lowest-frequency wins) -- a
 * deterministic, slow-cycle-favouring tie-break aligned with
 * the daily-cadence interpretation (long workloads have low-k
 * mass on the same gap-filled carrier as every other shipped
 * spectral axis).
 *
 * NINETY-SIXTH cross-source axis. This is a Class-P (POSITION
 * / ARGMAX) primitive -- a categorical *bin index* read,
 * structurally distinct from every shipped axis 32..95 which
 * report magnitude-, moment-, ratio-, entropy-, TV-, slope-,
 * or quantile-of-mass numbers. Argmax is a 0th-order
 * INDEX-VALUED statistic; every prior spectral axis is a
 * REAL-VALUED MASS aggregate.
 *
 * READING:
 *
 *   - peakFreqRatio = 0 (k* = 1) -- mass concentrates at the
 *     LOWEST non-DC bin -- a slow-cycle / low-frequency-
 *     dominant series (typical of long-tenure workloads with
 *     a multi-day envelope).
 *   - peakFreqRatio in (0, 0.5) -- mid-low band peak; cycle
 *     period roughly n / k* days.
 *   - peakFreqRatio ~ 0.5 -- mid-band peak.
 *   - peakFreqRatio ~ 1 (k* = K) -- mass concentrates at the
 *     HIGHEST representable bin -- a near-Nyquist / fast-
 *     oscillation-dominant series (alternating-day-like
 *     behaviour).
 *
 * BOUND: peakFreqRatio in [0, 1] exactly (k* in {1, ..., K},
 * normalised to [0, 1] by (k* - 1) / (K - 1)). The companion
 * peakNormalisedFreq = k* / n lives in (0, 0.5] (Nyquist 0.5
 * achieved iff K = n/2 and k* = K, i.e. n even and the largest
 * bin wins).
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the argmax is UNCHANGED.
 *     SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD and
 *     randomises k*.
 *   - BIN-PERMUTATION: NOT invariant -- the argmax index is by
 *     definition permutation-sensitive. This is a primary
 *     orthogonality witness vs every BIN-PERMUTATION-INVARIANT
 *     axis (entropy 69, flatness 85, crest 89, kurtosis 91,
 *     skewness 90).
 *   - BIN-REVERSAL k -> K + 1 - k: argmax FLIPS to K + 1 - k*.
 *     NOT bin-reversal-invariant. Distinct from roughness 95
 *     (TV is reversal-blind in magnitude).
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report (2004) §6 --
 *     spectral descriptors including peak-frequency / argmax-
 *     bin primitives on the periodogram.
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press (2012) §3.3 -- spectral peak features.
 *   Tzanetakis, G. & Cook, P., "Musical genre classification of
 *     audio signals", IEEE TSAP 10:5 (2002) -- canonical use of
 *     spectral peak / dominant frequency in classification.
 *
 * STRUCTURAL ORTHOGONALITY -- a 0TH-ORDER INDEX-VALUED
 * (argmax-bin) descriptor, distinct from every shipped daily-
 * token axis 32..95:
 *
 *   - vs `daily-token-spectral-roughness` (axis 95): roughness
 *     is a real-valued L1 TV-of-pmf MASS aggregate over ALL
 *     adjacent bin pairs and is BIN-REVERSAL-INVARIANT. Peak-
 *     frequency is a single INDEX read -- the argmax bin --
 *     and is bin-reversal-SENSITIVE (k* flips to K + 1 - k*).
 *     A monotone-decreasing PSD has k* = 1 (peakFreqRatio = 0)
 *     and a non-trivial roughness; reversing the same PSD
 *     leaves roughness identical and moves peakFreqRatio to 1.
 *
 *   - vs `daily-token-spectral-spread-iqr` (axis 94): spread-
 *     IQR is an inner-50% percentile-gap WIDTH (real-valued).
 *     Peak-frequency is the argmax INDEX. A pmf with q1Bin =
 *     q3Bin = mid-band has spread-IQR = 0 and peakFreqRatio
 *     determined by the argmax.
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a SECOND-ORDER L2 magnitude statistic on
 *     the raw periodogram. Peak-frequency is a position read.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease is
 *     a fixed-anchor (bin 1) slope-from-anchor REAL VALUE. The
 *     sign of decrease is loosely predictive of peakFreqRatio
 *     (decrease < 0 favours k* small, decrease > 0 favours k*
 *     large) but not deterministic -- a comb PSD can have
 *     decrease ~ 0 with k* anywhere.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87) /
 *     `-skewness` (axis 90) / `-kurtosis` (axis 91): each is a
 *     CENTROID-RELATIVE central moment. Peak-frequency is the
 *     ARGMAX, not the centroid. A bimodal PSD with two equal
 *     peaks at k=1 and k=K has centroid (K+1)/2 (mid-band) but
 *     argmax = 1 (lowest-tied bin). Bandwidth/skewness/
 *     kurtosis depend on dispersion around the centroid;
 *     argmax depends on no dispersion at all.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT (probability-weighted mean bin).
 *     Peak-frequency is the ARGMAX. Centroid uses ALL bins'
 *     mass; argmax uses only the WINNING bin. Two PSDs with
 *     identical centroid can have wildly different argmax
 *     (e.g. (0.5 at k=1) + (0.5 at k=K) vs (1.0 at k=mid)).
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     the SMALLEST k such that the cumulative power up to k
 *     >= 0.85 * total power. Peak-frequency is the argmax.
 *     A pmf concentrated at one interior bin has argmax =
 *     rolloff (both point to the spike); a uniform pmf has
 *     argmax = 1 (tie -> smallest) and rolloff ~ 0.85 * K.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is the peak-to-mean RATIO -- the MAGNITUDE of the
 *     winning bin relative to the mean. Peak-frequency is the
 *     INDEX of that bin. Crest = K iff the spike is total;
 *     argmax tells WHERE the spike sits.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85) /
 *     `-spectral-entropy` (axis 69): both are GM/AM and Shannon
 *     entropy of the normalised PSD respectively, BIN-
 *     PERMUTATION INVARIANT. Argmax is bin-position-VALUED
 *     (categorical) and bin-permutation-SENSITIVE.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope fit. Argmax is a single bin
 *     position. A clean 1/f PSD has beta ~ -1 and k* = 1;
 *     a clean white-noise PSD has beta ~ 0 and k* arbitrary
 *     (lowest-tied -> 1).
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; argmax-bin is
 *     bin-position-sensitive in the FREQUENCY domain.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the
 * cumulative PSD denominator sum_{k=1..K} P[k] is non-positive
 * (degenerate all-zero spectrum), or when the computed
 * argmax / peakFreqRatio is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralPeakFrequencySort =
  | 'peakFreqRatio'
  | 'peakFreqRatioDesc'
  | 'peakBin'
  | 'peakBinDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralPeakFrequencyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralPeakFrequencySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralPeakFrequencySourceRow {
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
  /** P[k*] -- power at the winning bin. */
  peakPower: number;
  /** k* = argmax bin index in {1, ..., K}. */
  peakBin: number;
  /** (k* - 1) / (K - 1) in [0, 1]. */
  peakFreqRatio: number;
  /** k* / n in (0, 0.5]. */
  peakNormalisedFreq: number;
  /** P[k*] / sum_{k=1..K} P[k] in (0, 1]. */
  peakMassShare: number;
}

export interface DailyTokenSpectralPeakFrequencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralPeakFrequencySort;
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
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralPeakFrequencySourceRow[];
}

/**
 * Spectral peak-frequency primitive on a non-negative power
 * vector indexed by k = 1..power.length. Returns
 * `{ peakBin, peakPower, totalPower, peakMassShare }` where
 * peakBin = argmax (1-indexed; ties -> smallest k).
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> tied across all bins; peakBin = 1
 *                          (smallest-k tie-break);
 *                          peakMassShare = 1/K.
 *   - K=K, P=[0,...,0,1] -> peakBin = K; peakMassShare = 1.
 *   - K=K, P=[1,0,...,0] -> peakBin = 1; peakMassShare = 1.
 *   - K=K, P[m]=1, others 0 -> peakBin = m; peakMassShare = 1.
 *   - K=K, P=[1,2,3,...,K] (monotone asc) -> peakBin = K.
 *   - K=K, P=[K,K-1,...,1] (monotone desc) -> peakBin = 1.
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, or non-positive total power.
 */
export function spectralPeakFrequency(power: number[]): {
  peakBin: number;
  peakPower: number;
  totalPower: number;
  peakMassShare: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralPeakFrequency: too few bins (${k}; need >= 2)`,
    );
  }
  let totalPower = 0;
  let peakPower = -Infinity;
  let peakBin = 1; // 1-indexed
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralPeakFrequency: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralPeakFrequency: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
    // strict greater-than -> smallest-k tie-break
    if (p > peakPower) {
      peakPower = p;
      peakBin = i + 1;
    }
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralPeakFrequency: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  const peakMassShare = peakPower / totalPower;
  return { peakBin, peakPower, totalPower, peakMassShare };
}

/**
 * Daily-token spectral-peak-frequency primitive on a real-
 * valued series. Computes the one-sided periodogram, takes the
 * argmax bin (smallest-k tie-break), and returns peakBin,
 * peakFreqRatio in [0, 1], peakNormalisedFreq in (0, 0.5],
 * peakPower, totalPower, peakMassShare, mean, stddev, and bin
 * count.
 */
export function dailyTokenSpectralPeakFrequency(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  peakPower: number;
  peakBin: number;
  peakFreqRatio: number;
  peakNormalisedFreq: number;
  peakMassShare: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralPeakFrequency: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralPeakFrequency requires finite values',
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
      'dailyTokenSpectralPeakFrequency: zero variance (constant series)',
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
  if (k < 2) {
    throw new Error(
      `dailyTokenSpectralPeakFrequency: too few bins (${k}; need >= 2)`,
    );
  }
  const result = spectralPeakFrequency(power);
  const peakFreqRatio = (result.peakBin - 1) / (k - 1);
  const peakNormalisedFreq = result.peakBin / n;
  if (
    !Number.isFinite(peakFreqRatio) ||
    !Number.isFinite(peakNormalisedFreq) ||
    !Number.isFinite(result.peakMassShare) ||
    !Number.isFinite(result.totalPower) ||
    !Number.isFinite(result.peakPower)
  ) {
    throw new Error(
      `dailyTokenSpectralPeakFrequency: non-finite output (peakBin=${result.peakBin}, peakFreqRatio=${peakFreqRatio}, peakNormalisedFreq=${peakNormalisedFreq}, peakMassShare=${result.peakMassShare})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    peakPower: result.peakPower,
    peakBin: result.peakBin,
    peakFreqRatio,
    peakNormalisedFreq,
    peakMassShare: result.peakMassShare,
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

export function buildDailyTokenSpectralPeakFrequency(
  queue: QueueLine[],
  opts: DailyTokenSpectralPeakFrequencyOptions = {},
): DailyTokenSpectralPeakFrequencyReport {
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
  const sort: DailyTokenSpectralPeakFrequencySort =
    opts.sort ?? 'peakFreqRatioDesc';
  const validSorts: DailyTokenSpectralPeakFrequencySort[] = [
    'peakFreqRatio',
    'peakFreqRatioDesc',
    'peakBin',
    'peakBinDesc',
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
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralPeakFrequencySourceRow[] = [];

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
      result = dailyTokenSpectralPeakFrequency(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive total power')) {
        droppedZeroPowerSum += 1;
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
      peakBin: result.peakBin,
      peakFreqRatio: result.peakFreqRatio,
      peakNormalisedFreq: result.peakNormalisedFreq,
      peakMassShare: result.peakMassShare,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'peakFreqRatio':
        primary = a.peakFreqRatio - b.peakFreqRatio;
        break;
      case 'peakFreqRatioDesc':
        primary = b.peakFreqRatio - a.peakFreqRatio;
        break;
      case 'peakBin':
        primary = a.peakBin - b.peakBin;
        break;
      case 'peakBinDesc':
        primary = b.peakBin - a.peakBin;
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
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
