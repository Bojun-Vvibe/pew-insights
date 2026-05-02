/**
 * daily-token-spectral-irregularity: per-source SPECTRAL
 * IRREGULARITY (Jensen 1999) of the gap-filled mean-centred
 * daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4 (gate enforced via
 * `--min-tenure-days 8`):
 *
 *   irregularity = sum_{k=1..K-1} (P[k] - P[k+1])^2
 *                  / sum_{k=1..K}   P[k]^2
 *
 * NINETY-THIRD cross-source axis. Distinct from every shipped
 * SPECTRAL OCTAD axis (84 DFT-slope, 85 Wiener-flatness, 86
 * centroid, 87 bandwidth, 88 rolloff, 89 crest, 90 skewness,
 * 91 kurtosis) AND axis 92 spectral-decrease: irregularity is
 * a LOCAL bin-difference (derivative-like) statistic that
 * accumulates squared differences between ADJACENT bins.
 * Every other shipped descriptor is either a global
 * MOMENT/CDF integral (86, 87, 88, 90, 91), a
 * BIN-PERMUTATION-INVARIANT shape ratio (85, 89, 69), a
 * LOG-LOG SLOPE fit (84), or a FIXED-ANCHOR slope-from-anchor
 * (92). None of them sees the bin-to-bin local roughness.
 *
 * READING:
 *
 *   - irregularity ~ 0 -- adjacent bins are nearly equal
 *     (PSD is locally smooth; could be flat, monotone, or
 *     slowly-varying).
 *   - irregularity small (<< 1) -- locally smooth PSD,
 *     possibly with a few mild kinks.
 *   - irregularity large (~ 1 or higher) -- spiky/comb-shaped
 *     PSD with strong bin-to-bin swings.
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     numerator AND denominator scale by a^4 -- the ratio
 *     CANCELS. SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD
 *     and drives irregularity toward a small constant
 *     (uniform PSD has every (P[k]-P[k+1])^2 = 0).
 *   - BIN-PERMUTATION: NOT invariant -- the descriptor sums
 *     over ADJACENT bin pairs, which is bin-order-tied.
 *     This is the orthogonality witness vs flatness (85),
 *     entropy (69), and crest (89), all of which are bin-
 *     permutation INVARIANT.
 *   - BIN-REVERSAL k -> K + 1 - k: INVARIANT (the set of
 *     adjacent pairs is unchanged under reversal; only the
 *     pair order flips, but the sum of squares is symmetric).
 *     This separates irregularity from spectral-decrease (92)
 *     which is bin-reversal SENSITIVE.
 *
 * REFERENCES:
 *
 *   Jensen, K., "Timbre Models of Musical Sounds",
 *     PhD dissertation, DIKU Tech. Rep. 99/7, University of
 *     Copenhagen, 1999, §3.5 -- canonical
 *     `sum (P[k]-P[k+1])^2 / sum P[k]^2` form, simplified
 *     from the earlier triangular-window formulation.
 *   Krimphoff, J., McAdams, S., Winsberg, S., "Caracterisation
 *     du timbre des sons complexes. II. Analyses acoustiques
 *     et quantification psychophysique", J. Phys. IV, 4(C5),
 *     1994 -- the original spectral irregularity primitive
 *     (Jensen 1999 §3.5 is the simplified successor).
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley/IEEE, 2012, §3.3.4 -- spectral irregularity as a
 *     local-roughness counterpart to global moment statistics.
 *
 * STRUCTURAL ORTHOGONALITY -- a LOCAL bin-difference
 * (derivative-like) descriptor on the one-sided periodogram,
 * distinct from every shipped daily-token axis 32..92:
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT (mean bin index). Two PSDs
 *     with identical centroid can have wildly different
 *     irregularity: a smooth Gaussian-shaped PSD vs a comb
 *     PSD with the same first moment. Irregularity sees the
 *     comb teeth; centroid is blind to them.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): both
 *     measure dispersion in some sense, but bandwidth is the
 *     SECOND CENTRAL MOMENT around the centroid (a global
 *     L2 spread). Irregularity is a sum of squared LOCAL
 *     differences. A wide-but-smooth PSD has high bandwidth
 *     and low irregularity; a narrow-but-spiky PSD has low
 *     bandwidth and high irregularity.
 *
 *   - vs `daily-token-spectral-skewness` (axis 90) /
 *     `-kurtosis` (axis 91): both are CENTRAL MOMENTS around
 *     the centroid (3rd / 4th standardised). They are
 *     reorder-of-equally-spaced-bin-symmetric global shape
 *     summaries; they have no local-difference term.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a single CDF QUANTILE on the cumulative PSD. It is a
 *     monotone-in-PSD-mass integral; it does not see local
 *     bin-to-bin roughness.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is a peak-to-mean RATIO, BIN-PERMUTATION INVARIANT.
 *     A high-crest PSD with one isolated spike has strong
 *     irregularity; a high-crest PSD with the same multiset
 *     reordered into a smooth ramp has low irregularity but
 *     equal crest.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is GM/AM over bin powers, BIN-PERMUTATION
 *     INVARIANT. Irregularity is bin-order-sensitive at the
 *     adjacent-pair scale.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): Shannon
 *     entropy of the L1-normalised periodogram, BIN-
 *     PERMUTATION INVARIANT.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope via least-squares. Irregularity
 *     is a local LINEAR-AXIS adjacent-difference statistic.
 *     A clean power-law spectrum has a well-defined beta
 *     and small irregularity; a broken-power-law spectrum
 *     with a small step at one bin has nearly the same beta
 *     but a strictly larger irregularity.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a FIXED-ANCHOR (bin 1) 1/(k-1)-weighted slope-from-
 *     anchor. Irregularity has NO anchor; it sums over all
 *     adjacent pairs symmetrically. Critically, decrease is
 *     BIN-REVERSAL SENSITIVE; irregularity is BIN-REVERSAL
 *     INVARIANT (set of adjacent pairs is unchanged on
 *     reversal). A monotone-decreasing PSD has strong
 *     decrease (negative) but small irregularity; a comb
 *     PSD has near-zero decrease but large irregularity.
 *
 *   - vs `source-row-token-spectral-irregularity`: that
 *     statistic operates on the per-row STREAM (row-index
 *     time axis, no gap-filling, no daily aggregation). The
 *     new axis operates on the gap-filled DAILY aggregate
 *     (calendar-day time axis, mean-centred, UTC bucketed).
 *     PER-ROW vs DAILY-AGGREGATE is the orthogonality witness
 *     mirroring axis-92.
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; spectral
 *     irregularity is bin-order-sensitive.
 *
 * Bound: irregularity is non-negative; it is dimensionless
 * (powers cancel). It is 0 iff every adjacent bin pair has
 * P[k] = P[k+1]. The upper bound is loose (depends on K and
 * the contrast structure of the PSD), but on empirical
 * token-count series it is order-1 in magnitude.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the
 * denominator sum_{k=1..K} P[k]^2 is non-positive (degenerate
 * all-zero spectrum), or when the computed irregularity is
 * non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralIrregularitySort =
  | 'irregularity'
  | 'irregularityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralIrregularityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need K >= 2 strictly for any adjacent pair; K >= 4
   * keeps the descriptor non-degenerate).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralIrregularitySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralIrregularitySourceRow {
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
  /** sum_{k=1..K-1} (P[k] - P[k+1])^2 -- numerator. */
  diffSquaredSum: number;
  /** sum_{k=1..K} P[k]^2 -- denominator (energy of PSD). */
  powerSquaredSum: number;
  /** Jensen 1999 spectral irregularity (dimensionless, >= 0). */
  irregularity: number;
}

export interface DailyTokenSpectralIrregularityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralIrregularitySort;
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
  sources: DailyTokenSpectralIrregularitySourceRow[];
}

/**
 * Spectral irregularity primitive on a non-negative power
 * vector indexed by k = 1..power.length. Returns
 * `{ irregularity, diffSquaredSum, powerSquaredSum }`. Throws
 * when the input is empty / contains a non-finite or negative
 * value / has fewer than 2 bins / has non-positive
 * powerSquaredSum (degenerate all-zero spectrum).
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=2, P=[a,b]      -> irregularity = (a-b)^2 / (a^2 + b^2)
 *   - K>=2, P=[c,c,...,c] -> irregularity = 0   (every diff vanishes)
 *   - K=2, P=[1,0]      -> irregularity = 1     (max contrast)
 *   - K>=3, P=[1,0,1,0,...] -> irregularity sums every adjacent
 *                              pair as (1-0)^2 = 1 each; denom
 *                              = ceil(K/2) * 1; numer = K-1.
 */
export function spectralIrregularity(power: number[]): {
  irregularity: number;
  diffSquaredSum: number;
  powerSquaredSum: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralIrregularity: too few bins (${k}; need >= 2)`,
    );
  }
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralIrregularity: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralIrregularity: negative power at index ${i} (${p})`,
      );
    }
  }
  let powerSquaredSum = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    powerSquaredSum += p * p;
  }
  if (!(powerSquaredSum > 0)) {
    throw new Error(
      `spectralIrregularity: non-positive power-squared sum (${powerSquaredSum}; degenerate all-zero spectrum)`,
    );
  }
  let diffSquaredSum = 0;
  for (let i = 0; i < k - 1; i += 1) {
    const d = power[i]! - power[i + 1]!;
    diffSquaredSum += d * d;
  }
  const irregularity = diffSquaredSum / powerSquaredSum;
  return { irregularity, diffSquaredSum, powerSquaredSum };
}

/**
 * Daily-token spectral-irregularity primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the Jensen
 * 1999 spectral irregularity, and returns the irregularity,
 * diffSquaredSum, powerSquaredSum, mean, stddev, and bin count.
 */
export function dailyTokenSpectralIrregularity(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  diffSquaredSum: number;
  powerSquaredSum: number;
  irregularity: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralIrregularity: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralIrregularity requires finite values',
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
      'dailyTokenSpectralIrregularity: zero variance (constant series)',
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
  const result = spectralIrregularity(power);
  if (
    !Number.isFinite(result.irregularity) ||
    !Number.isFinite(result.diffSquaredSum) ||
    !Number.isFinite(result.powerSquaredSum)
  ) {
    throw new Error(
      `dailyTokenSpectralIrregularity: non-finite output (irregularity=${result.irregularity}, diffSquaredSum=${result.diffSquaredSum}, powerSquaredSum=${result.powerSquaredSum})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    diffSquaredSum: result.diffSquaredSum,
    powerSquaredSum: result.powerSquaredSum,
    irregularity: result.irregularity,
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

export function buildDailyTokenSpectralIrregularity(
  queue: QueueLine[],
  opts: DailyTokenSpectralIrregularityOptions = {},
): DailyTokenSpectralIrregularityReport {
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
  const sort: DailyTokenSpectralIrregularitySort = opts.sort ?? 'irregularityDesc';
  const validSorts: DailyTokenSpectralIrregularitySort[] = [
    'irregularity',
    'irregularityDesc',
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
  const rows: DailyTokenSpectralIrregularitySourceRow[] = [];

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
      result = dailyTokenSpectralIrregularity(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive power-squared sum')) {
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
      diffSquaredSum: result.diffSquaredSum,
      powerSquaredSum: result.powerSquaredSum,
      irregularity: result.irregularity,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'irregularity':
        primary = a.irregularity - b.irregularity;
        break;
      case 'irregularityDesc':
        primary = b.irregularity - a.irregularity;
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
