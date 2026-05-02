/**
 * daily-token-spectral-roughness: per-source FIRST-ORDER
 * TOTAL-VARIATION (TV) of the L1-NORMALISED one-sided non-DC
 * periodogram of the gap-filled mean-centred daily total_tokens
 * series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4 (gate enforced via
 * `--min-tenure-days 8`), let p[k] = P[k] / sum_j P[j] be the
 * L1-normalised PSD treated as a probability mass function on
 * the bin index k. Then
 *
 *   roughness = sum_{k=1..K-1} |p[k+1] - p[k]|     in [0, 2]
 *
 * NINETY-FIFTH cross-source axis. Distinct from every shipped
 * SPECTRAL OCTAD axis (84 DFT-slope, 85 Wiener-flatness, 86
 * centroid, 87 bandwidth, 88 rolloff, 89 crest, 90 skewness,
 * 91 kurtosis), axis 92 spectral-decrease, axis 93 spectral-
 * irregularity, and axis 94 spectral-spread-IQR. Roughness is
 * a FIRST-ORDER L1 TOTAL-VARIATION descriptor on the L1-
 * NORMALISED PSD pmf -- the discrete analogue of integral
 * |dp/dk| over the spectrum.
 *
 * READING:
 *
 *   - roughness ~ 0 -- the L1-normalised PSD is nearly flat
 *     bin-to-bin (slow-changing, smooth spectrum).
 *   - roughness small -- mass varies gently across adjacent
 *     bins.
 *   - roughness moderate -- mass changes appreciably across
 *     adjacent bins (typical broadband spectrum).
 *   - roughness -> 2 -- a single isolated spike in one bin
 *     (cum-up + cum-down each contribute the spike's whole
 *     normalised mass).
 *
 * BOUND: roughness lies in [0, 2]. The supremum of 2 is
 * approached when one bin carries (almost) all of the mass and
 * is interior; the lower bound 0 is reached for any constant
 * PSD where p[1] = ... = p[K] (e.g. white-noise-like spectrum).
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the L1-normalised pmf is UNCHANGED.
 *     SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD and
 *     drives roughness toward 0 (since p[k] -> 1/K).
 *   - BIN-PERMUTATION: NOT invariant -- the adjacent-bin
 *     differences are bin-order-tied. This is the orthogonality
 *     witness vs flatness (85), entropy (69), and crest (89),
 *     all of which are bin-permutation INVARIANT.
 *   - BIN-REVERSAL k -> K + 1 - k: INVARIANT in magnitude --
 *     reversing the pmf reverses every adjacent difference's
 *     SIGN but not its absolute value, so the TV sum is
 *     identical. Roughness is BIN-REVERSAL-INVARIANT.
 *
 * REFERENCES:
 *
 *   Krishnamoorthy, P. & Kumar, S., "Hierarchical audio content
 *     classification system using an optimal feature selection
 *     algorithm", Multimedia Tools and Applications 54 (2011)
 *     §3.2 -- spectral roughness primitive on a normalised PSD.
 *   Klapuri, A. & Davy, M., "Signal Processing Methods for
 *     Music Transcription", Springer, 2006, §5 -- spectral
 *     descriptors and the role of TV-of-spectrum statistics.
 *   Rudin, L., Osher, S., Fatemi, E., "Nonlinear total
 *     variation based noise removal algorithms", Physica D 60
 *     (1992) -- canonical TV reference; this axis transplants
 *     the discrete TV functional onto the PSD pmf instead of
 *     a 2D image signal.
 *
 * STRUCTURAL ORTHOGONALITY -- a FIRST-ORDER L1 TV descriptor
 * on the L1-normalised PSD, distinct from every shipped
 * daily-token axis 32..94:
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a SECOND-ORDER L2 statistic --
 *     sum of (P[k+1] - P[k])^2 divided by sum P[k]^2,
 *     operating on the RAW periodogram. Roughness is a
 *     FIRST-ORDER L1 statistic on the L1-NORMALISED pmf.
 *     L1 vs L2 norm of the difference-vector AND raw vs
 *     normalised input AND first-order absolute vs squared
 *     denominator: three structural splits at once. A PSD
 *     with many tiny differences and one big one has high
 *     irregularity (squared) and moderate roughness (linear);
 *     a PSD that is rescaled to share its shape but
 *     concentrate at small magnitudes leaves roughness
 *     identical (pmf-invariant) but moves irregularity (raw
 *     P[k]^2 denominator).
 *
 *   - vs `daily-token-spectral-spread-iqr` (axis 94):
 *     spread-IQR is a GLOBAL inner-50% percentile-gap
 *     dispersion. Roughness is a LOCAL adjacent-bin difference
 *     sum. A pmf concentrated in a narrow contiguous band has
 *     small spread-IQR AND small roughness (smooth interior).
 *     A pmf with one isolated spike has small spread-IQR (q1Bin
 *     = q3Bin = spike bin) AND large roughness (~ 2). The
 *     decoupling on the spike vs band trade-off is the
 *     orthogonality witness.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a FIXED-ANCHOR (bin 1) 1/(k-1)-weighted slope-from-
 *     anchor descriptor and is bin-reversal SENSITIVE.
 *     Roughness is bin-reversal INVARIANT. A monotone-
 *     decreasing PSD has strong (negative) decrease and
 *     small roughness (smooth descent); a comb PSD has
 *     ~ 0 decrease and large roughness.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87) /
 *     `-skewness` (axis 90) / `-kurtosis` (axis 91): each
 *     is a CENTROID-RELATIVE central moment summary (variance,
 *     3rd, 4th). All are bin-PERMUTATION-INVARIANT in the
 *     sense that they depend only on the multiset {(k, P[k])}
 *     under the centroid-relative reference. Roughness is
 *     bin-order-SENSITIVE -- two PSDs with identical multiset
 *     ordered differently have identical bandwidth/skewness/
 *     kurtosis but different roughness.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a SINGLE CDF QUANTILE. Roughness is a sum-over-all-
 *     adjacent-pairs derivative. Two PSDs with identical 0.85
 *     rolloff bin can have wildly different TVs.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is a LOCATION (1st raw moment). Roughness is a SHAPE
 *     (TV of pmf). Trivially orthogonal.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is a peak-to-mean RATIO, BIN-PERMUTATION INVARIANT.
 *     Roughness is bin-permutation-SENSITIVE. A high-crest PSD
 *     with one isolated interior spike has high crest AND high
 *     roughness; the same multiset reordered into a smooth
 *     ramp has equal crest and far-lower roughness.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85) /
 *     `-spectral-entropy` (axis 69): both are GM/AM and
 *     Shannon entropy of the normalised PSD respectively, and
 *     both are BIN-PERMUTATION INVARIANT. Roughness is bin-
 *     order-sensitive at the adjacent-bin scale.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope fit. Roughness is a linear-axis
 *     pmf-TV. A clean power-law spectrum has a tight beta and
 *     a specific roughness depending on beta and K; perturbing
 *     a single mid-band bin moves roughness without changing
 *     beta materially.
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; roughness is
 *     bin-order-sensitive in the FREQUENCY domain.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the
 * cumulative PSD denominator sum_{k=1..K} P[k] is non-positive
 * (degenerate all-zero spectrum), or when the computed
 * roughness is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralRoughnessSort =
  | 'roughness'
  | 'roughnessDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralRoughnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need K >= 2 strictly for any non-degenerate adjacent
   * difference; K >= 4 keeps the descriptor non-trivial).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralRoughnessSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralRoughnessSourceRow {
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
  /** sum_{k=1..K} P[k] -- L1 PSD mass (denominator). */
  totalPower: number;
  /** sum_{k=1..K-1} |p[k+1] - p[k]| on the L1-normalised pmf. */
  absDiffSum: number;
  /** TV of the L1-normalised PSD pmf, in [0, 2]. */
  roughness: number;
}

export interface DailyTokenSpectralRoughnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralRoughnessSort;
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
  sources: DailyTokenSpectralRoughnessSourceRow[];
}

/**
 * Spectral roughness primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * `{ roughness, absDiffSum, totalPower }`. Throws when the
 * input has fewer than 2 bins / contains a non-finite or
 * negative value / has non-positive totalPower (degenerate
 * all-zero spectrum).
 *
 * Definition (operating on the L1-NORMALISED pmf
 * p[k] = P[k] / sum_j P[j]):
 *
 *   roughness = sum_{k=1..K-1} |p[k+1] - p[k]|
 *             = absDiffSum / totalPower
 *
 * where `absDiffSum = sum_{k=1..K-1} |P[k+1] - P[k]|` on the
 * raw periodogram (equivalent by linearity of the L1 norm
 * under positive scalar division).
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=2, P=[a,b], totalPower=a+b, roughness = |b - a| / (a+b)
 *                   = |1 - 2*a/(a+b)|, in [0, 1].
 *   - K>=2, P=[c,c,...,c] -> every diff vanishes; roughness = 0.
 *   - K=K,  P=[1,0,...,0] (spike at boundary): one adjacent pair
 *                          contributes |0-1|=1; rest are 0;
 *                          roughness = 1.
 *   - K>=3, P=[0,1,0,...,0] (interior spike): two adjacent pairs
 *                          contribute |1-0|=1 each; roughness = 2.
 *   - K>=3, P=[1,0,1,0,...] (alternating comb): every adjacent
 *                          pair contributes 1 / sum = 1 / (number
 *                          of 1s); roughness = (K-1) / ceil(K/2).
 *   - MONOTONE PSD (either direction): the L1 TV telescopes to
 *                          |p[K] - p[1]|. This pins roughness
 *                          for monotone-decreasing decay-PSDs
 *                          (1/f-like) at exactly p[1] - p[K]
 *                          on the L1-normalised pmf. Any
 *                          non-monotone perturbation only
 *                          INCREASES the TV (zigzag bound),
 *                          giving a clean lower-bound interpretation.
 *   - SUPREMUM 2 is approached only when one INTERIOR bin
 *                          carries (almost) all the mass (both
 *                          adjacent diffs hit ~ 1).
 *   - SUPREMUM 1 (not 2) when a BOUNDARY bin (k=1 or k=K)
 *                          carries (almost) all the mass (only
 *                          one adjacent diff exists).
 */
export function spectralRoughness(power: number[]): {
  roughness: number;
  absDiffSum: number;
  totalPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralRoughness: too few bins (${k}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralRoughness: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralRoughness: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralRoughness: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  let absDiffSum = 0;
  for (let i = 0; i < k - 1; i += 1) {
    const d = power[i + 1]! - power[i]!;
    absDiffSum += d >= 0 ? d : -d;
  }
  const roughness = absDiffSum / totalPower;
  return { roughness, absDiffSum, totalPower };
}

/**
 * Daily-token spectral-roughness primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the TV of
 * the L1-normalised PSD pmf, and returns the roughness,
 * absDiffSum, totalPower, mean, stddev, and bin count.
 */
export function dailyTokenSpectralRoughness(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  absDiffSum: number;
  roughness: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralRoughness: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralRoughness requires finite values',
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
      'dailyTokenSpectralRoughness: zero variance (constant series)',
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
  const result = spectralRoughness(power);
  if (
    !Number.isFinite(result.roughness) ||
    !Number.isFinite(result.totalPower) ||
    !Number.isFinite(result.absDiffSum)
  ) {
    throw new Error(
      `dailyTokenSpectralRoughness: non-finite output (roughness=${result.roughness}, absDiffSum=${result.absDiffSum}, totalPower=${result.totalPower})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    absDiffSum: result.absDiffSum,
    roughness: result.roughness,
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

export function buildDailyTokenSpectralRoughness(
  queue: QueueLine[],
  opts: DailyTokenSpectralRoughnessOptions = {},
): DailyTokenSpectralRoughnessReport {
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
  const sort: DailyTokenSpectralRoughnessSort = opts.sort ?? 'roughnessDesc';
  const validSorts: DailyTokenSpectralRoughnessSort[] = [
    'roughness',
    'roughnessDesc',
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
  const rows: DailyTokenSpectralRoughnessSourceRow[] = [];

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
      result = dailyTokenSpectralRoughness(filled);
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
      absDiffSum: result.absDiffSum,
      roughness: result.roughness,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'roughness':
        primary = a.roughness - b.roughness;
        break;
      case 'roughnessDesc':
        primary = b.roughness - a.roughness;
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
