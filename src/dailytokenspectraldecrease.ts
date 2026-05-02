/**
 * daily-token-spectral-decrease: per-source SPECTRAL DECREASE
 * (Peeters 2004 §6.1.2) of the gap-filled mean-centred daily
 * total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 2 (gate K >= 4 enforced via
 * `--min-tenure-days 8`):
 *
 *   decrease = (1 / sum_{k=2..K} P[k])
 *              * sum_{k=2..K} (P[k] - P[1]) / (k - 1)
 *
 * NINETY-SECOND cross-source axis. The SPECTRAL OCTAD
 * (84 DFT-slope, 85 Wiener-flatness, 86 centroid, 87 bandwidth,
 * 88 rolloff, 89 crest, 90 skewness, 91 kurtosis) is closed
 * around the spectral CENTROID. Spectral decrease is the
 * canonical PSD shape descriptor that is FIXED-ANCHORED at
 * bin 1 (NOT the centroid) and uses the perceptually-motivated
 * 1/(k-1) weighting that gives disproportionate importance to
 * the immediate drop past the fundamental and de-emphasizes
 * the high-frequency tail. This is structurally different from
 * every centroid-relative central moment in the octad.
 *
 * SIGN CONVENTION:
 *
 *   - decrease < 0 -- every higher-bin power P[k] for k >= 2
 *     sits below P[1] on average (with 1/(k-1) weighting).
 *     The PSD genuinely DECREASES away from the fundamental.
 *     Typical for sources whose daily-token series carry
 *     strong low-frequency mass with a monotone-ish decline
 *     toward high frequencies.
 *   - decrease ~ 0 -- higher-bin powers are on average
 *     comparable to P[1]. The PSD holds up roughly flat past
 *     the first bin (broadband-on-band).
 *   - decrease > 0 -- higher-bin powers EXCEED P[1] on
 *     average. The PSD does NOT decrease away from bin 1 --
 *     mass is piled higher up the band (a high-pass-shaped
 *     daily series around its mean).
 *
 * The denominator deliberately excludes bin 1 (sum starts at
 * k = 2) so the descriptor is dimensionless on the high-
 * frequency mass; the numerator's (P[k] - P[1]) term anchors
 * the comparison at bin 1.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM Technical Report v1.0, 2004 --
 *     §6.1.2 defines spectral decrease as a perceptually-
 *     motivated PSD slope-from-anchor descriptor with
 *     1/(k-1) weighting. Distinguished from spectral slope
 *     (a least-squares LINEAR fit) by the fixed bin-1 anchor
 *     and the inverse-bin-distance weighting.
 *   Lerch, A., "An Introduction to Audio Content Analysis:
 *     Applications in Signal Processing and Music
 *     Informatics", Wiley/IEEE, 2012, §3.3.1 -- Spectral
 *     Slope and Decrease.
 *
 * STRUCTURAL ORTHOGONALITY -- a FIXED-ANCHOR (bin 1)
 * PERCEPTUALLY-WEIGHTED slope-from-anchor descriptor on the
 * one-sided periodogram, distinct from every shipped daily-
 * token axis 32..91:
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is the FIRST RAW MOMENT (mean bin index across the
 *     whole PSD). Decrease is a SLOPE-FROM-ANCHOR summary
 *     tied to bin 1 specifically with 1/(k-1) weighting.
 *     Two PSDs with identical centroids can have very
 *     different decrease values: a PSD with mass at bins
 *     {1, K-1} (low-freq anchor + far high-bin peak) gives
 *     a strongly-positive decrease; a PSD with mass at bins
 *     {K/2 - 5, K/2 + 5} (no mass at bin 1, symmetric
 *     around centroid) gives a near-zero decrease -- same
 *     centroid, opposite sign.
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87),
 *     `-skewness` (axis 90), `-kurtosis` (axis 91): all three
 *     are CENTRAL MOMENTS computed AROUND THE CENTROID.
 *     Decrease is anchored at bin 1, NOT at the centroid,
 *     and uses 1/(k-1) weighting. A PSD perfectly symmetric
 *     around its centroid (skewness = 0) can still have a
 *     strongly-negative decrease if the centroid sits near
 *     bin 1; central moments are centroid-relative and
 *     cannot detect the bin-1 anchor drop.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): roll-off
 *     is a single CDF QUANTILE on the cumulative PSD.
 *     Decrease integrates the FULL tail with 1/(k-1)
 *     weighting, anchored at bin 1. Two PSDs that share an
 *     85% roll-off bin can have very different decrease
 *     values depending on how mass is distributed below the
 *     rolloff bin and around bin 1.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89):
 *     crest is a PEAK-vs-MEAN RATIO that does not reference
 *     bin index at all (BIN-PERMUTATION INVARIANT).
 *     Decrease is bin-index-weighted by 1/(k-1) and
 *     anchored at bin 1 (BIN-PERMUTATION SENSITIVE).
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is the GM/AM ratio over bin powers (BIN-
 *     PERMUTATION INVARIANT, in [0, 1]). Decrease is signed,
 *     bin-permutation-sensitive, and anchor-aware (bin 1).
 *     A flat PSD on [1, K] and a flat PSD on [K/2, K] share
 *     the same flatness but very different decrease values.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     the LOG-LOG SLOPE of P[k] vs k via least squares.
 *     Decrease is a LINEAR-AXIS 1/(k-1)-weighted ratio
 *     anchored at bin 1; it is dimensionful in a different
 *     way and not collapsible onto a log-log slope in
 *     general. A power-law spectrum with beta = -1 has a
 *     definite decrease sign, but a comb spectrum with no
 *     power-law structure also has a well-defined decrease;
 *     the two statistics are defined on different
 *     functionals of P[k].
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): entropy is
 *     the SHANNON ENTROPY of the L1-normalised periodogram --
 *     a SHAPE-DISPERSION statistic in nats summed over ALL
 *     bins, BIN-PERMUTATION INVARIANT. Decrease is signed
 *     and bin-permutation-sensitive.
 *
 *   - vs `source-row-token-spectral-decrease`: that statistic
 *     operates on the per-row STREAM (row-index time axis,
 *     no gap-filling, no daily aggregation). The new axis
 *     operates on the gap-filled DAILY aggregate (calendar-
 *     day time axis, mean-centred, UTC bucketed). PER-ROW-
 *     AT-SOURCE vs DAILY-AGGREGATE-AT-SOURCE is the
 *     orthogonality witness; the two can move in opposite
 *     directions on the same source.
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; spectral
 *     decrease depends on the order of bins and is therefore
 *     bin-permutation-SENSITIVE.
 *
 * INVARIANCES of decrease:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by a^2;
 *     numerator AND denominator scale by a^2 -- the ratio
 *     CANCELS. SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the spectrum
 *     and drives decrease toward 0 (uniform PSD has every
 *     P[k] - P[1] = 0 in expectation).
 *   - BIN-PERMUTATION: NOT invariant -- the 1/(k-1) weighting
 *     is bin-index-tied. This is the key orthogonality witness
 *     vs flatness (85), entropy (69), and crest (89), all of
 *     which are bin-permutation INVARIANT.
 *   - BIN-REVERSAL k -> K + 1 - k: NOT invariant in general --
 *     the anchor moves from bin 1 to bin K, so the descriptor
 *     re-reads the spectrum from the opposite end of the band.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the tail
 * power sum_{k=2..K} P[k] is non-positive (degenerate single-
 * bin spectrum at bin 1), or when the computed decrease is
 * non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralDecreaseSort =
  | 'decrease'
  | 'decreaseDesc'
  | 'absDecreaseDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralDecreaseOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available.
   * (We need at least one bin past the bin-1 anchor for the
   * tail sum to be non-trivial; K >= 2 is the absolute
   * minimum, K >= 4 keeps the descriptor non-degenerate.)
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralDecreaseSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralDecreaseSourceRow {
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
  /** P[1] -- anchor bin power. */
  firstBinPower: number;
  /** sum_{k=2..K} P[k] -- the descriptor's denominator. */
  tailPower: number;
  /** Peeters 2004 spectral decrease (signed dimensionless). */
  decrease: number;
}

export interface DailyTokenSpectralDecreaseReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralDecreaseSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroTailPower: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralDecreaseSourceRow[];
}

/**
 * Spectral decrease primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * `{ decrease, firstBinPower, tailPower }`. Throws when the
 * input is empty / contains a non-finite or negative value /
 * has fewer than 2 bins / has non-positive tail power
 * (sum_{k=2..K} P[k] <= 0; degenerate single-bin spectrum at
 * bin 1).
 */
export function spectralDecrease(power: number[]): {
  decrease: number;
  firstBinPower: number;
  tailPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralDecrease: too few bins (${k}; need >= 2)`,
    );
  }
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralDecrease: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralDecrease: negative power at index ${i} (${p})`,
      );
    }
  }
  const firstBinPower = power[0]!;
  let tailPower = 0;
  let weightedDiff = 0;
  for (let i = 1; i < k; i += 1) {
    const p = power[i]!;
    tailPower += p;
    // i is 0-indexed; bin index is i+1, so (k_bin - 1) = i.
    weightedDiff += (p - firstBinPower) / i;
  }
  if (!(tailPower > 0)) {
    throw new Error(
      `spectralDecrease: non-positive tail power (${tailPower}; degenerate single-bin spectrum at bin 1)`,
    );
  }
  const decrease = weightedDiff / tailPower;
  return { decrease, firstBinPower, tailPower };
}

/**
 * Daily-token spectral-decrease primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the
 * Peeters 2004 §6.1.2 spectral decrease, and returns the
 * decrease, firstBinPower, tailPower, mean, stddev, and bin
 * count.
 */
export function dailyTokenSpectralDecrease(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  firstBinPower: number;
  tailPower: number;
  decrease: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralDecrease: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralDecrease requires finite values',
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
      'dailyTokenSpectralDecrease: zero variance (constant series)',
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
  const result = spectralDecrease(power);
  if (
    !Number.isFinite(result.decrease) ||
    !Number.isFinite(result.firstBinPower) ||
    !Number.isFinite(result.tailPower)
  ) {
    throw new Error(
      `dailyTokenSpectralDecrease: non-finite output (decrease=${result.decrease}, firstBinPower=${result.firstBinPower}, tailPower=${result.tailPower})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    firstBinPower: result.firstBinPower,
    tailPower: result.tailPower,
    decrease: result.decrease,
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

export function buildDailyTokenSpectralDecrease(
  queue: QueueLine[],
  opts: DailyTokenSpectralDecreaseOptions = {},
): DailyTokenSpectralDecreaseReport {
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
  const sort: DailyTokenSpectralDecreaseSort = opts.sort ?? 'decrease';
  const validSorts: DailyTokenSpectralDecreaseSort[] = [
    'decrease',
    'decreaseDesc',
    'absDecreaseDesc',
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
  let droppedZeroTailPower = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralDecreaseSourceRow[] = [];

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
      result = dailyTokenSpectralDecrease(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive tail power')) {
        droppedZeroTailPower += 1;
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
      firstBinPower: result.firstBinPower,
      tailPower: result.tailPower,
      decrease: result.decrease,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'decrease':
        primary = a.decrease - b.decrease;
        break;
      case 'decreaseDesc':
        primary = b.decrease - a.decrease;
        break;
      case 'absDecreaseDesc':
        primary = Math.abs(b.decrease) - Math.abs(a.decrease);
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
    droppedZeroTailPower,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
