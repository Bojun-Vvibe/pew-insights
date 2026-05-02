/**
 * daily-token-spectral-flatness-tail: per-source SPECTRAL
 * TAIL-FLATNESS -- a Wiener (geometric/arithmetic mean)
 * flatness restricted to the UPPER-HALF (high-frequency) bins
 * of the one-sided non-DC periodogram of the gap-filled mean-
 * centred daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the TAIL bin set
 *
 *   T = { k in 1..K : k > floor(K / 2) }
 *
 * |T| = K - floor(K/2) = ceil(K/2). The tail flatness is the
 * standard Wiener AM/GM ratio computed over the POSITIVE-power
 * subset of T:
 *
 *   T+         = { k in T : P[k] > 0 }
 *   m          = |T+|         (must satisfy m >= 2)
 *   tailFlat   = exp(mean_{k in T+} log P[k]) /
 *                mean_{k in T+} P[k]               in [0, 1]
 *
 * NINETY-EIGHTH cross-source axis. This is a Class-FT
 * (FLATNESS-TAIL) primitive -- the FIRST primitive in the
 * suite that restricts a flatness statistic to a STRUCTURED
 * BIN SUBSET (the upper-half of the spectrum), structurally
 * distinct from every shipped axis 32..97. Axis-85 (Wiener
 * flatness) is the FULL-BAND read on the same periodogram;
 * axis-98 is the TAIL-ONLY read. The two coincide when the
 * spectrum is uniformly distributed, but DECOUPLE on any
 * spectrum with frequency-dependent structure: a low-pass
 * spectrum (mass concentrated in low bins) has high full-band
 * flatness depression but tail flatness near 1 (tail is pure
 * noise floor); a high-pass spectrum has the reverse.
 *
 * READING:
 *
 *   - tailFlat ~ 1 -- the tail bins are nearly equipowered
 *     (white noise in the upper half; either a flat noise
 *     floor or a noise-dominated tail).
 *   - tailFlat ~ 0 -- the tail is dominated by a small number
 *     of bins (a localised high-frequency peak; or a single
 *     bin carrying all upper-half mass).
 *   - tailFlat / fullFlat (computable from axes 98 and 85)
 *     ~ 1 -- the tail mirrors the full band; ~ 0 -- the
 *     spectrum is structurally split between low- and high-
 *     frequency regimes.
 *
 * BOUND: tailFlat in [0, 1] exactly. tailFlat = 1 iff every
 * positive-power tail bin has identical power; tailFlat -> 0
 * as one tail bin's power dominates the rest of T+.
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; AM and GM scale identically. SCALE-INVARIANT for
 *     any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling redistributes mass
 *     across bins.
 *   - BIN-PERMUTATION (permutation of bins WITHIN T): GM/AM
 *     ratio is permutation-invariant within the tail subset.
 *     PERMUTATION-INVARIANT within T.
 *   - BIN-REVERSAL k -> K + 1 - k: the tail subset T = {k:
 *     k > floor(K/2)} maps to the HEAD subset {k: k <=
 *     ceil(K/2)} -- so tailFlat is NOT bin-reversal-invariant
 *     unless the spectrum is symmetric under reversal. This
 *     asymmetry is the structural distinction from axis-85
 *     (full-band Wiener) which IS bin-permutation-invariant
 *     and therefore bin-reversal-invariant.
 *
 * REFERENCES:
 *
 *   Johnston, J. D., "Transform coding of audio signals using
 *     perceptual noise criteria", IEEE J. Sel. Areas Commun.
 *     6:2 (1988) -- spectral flatness measure (SFM) as
 *     GM/AM of the power spectrum.
 *   Peeters, G., "A large set of audio features for sound
 *     description", IRCAM Technical Report (2004) §6.1.5 --
 *     spectral flatness with sub-band restriction (band-
 *     limited flatness as a perceptual descriptor).
 *   Allamanche, E. et al., "Content-based identification of
 *     audio material using MPEG-7 low level description",
 *     ISMIR (2001) -- MPEG-7 spectral flatness with band
 *     subdivision (the canonical sub-band flatness reference).
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley-IEEE Press (2012) §3.3 -- spectral flatness with
 *     band restrictions.
 *
 * STRUCTURAL ORTHOGONALITY -- a 0TH-ORDER SUB-BAND-RESTRICTED
 * GM/AM RATIO descriptor, distinct from every shipped daily-
 * token axis 32..97:
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     axis-85 is the FULL-BAND Wiener flatness; axis-98 is
 *     the UPPER-HALF restricted flatness. The two COINCIDE
 *     iff the spectrum is uniformly distributed across all
 *     positive-power bins. They DECOUPLE structurally on
 *     any non-uniform spectrum: a delta at bin 1 has fullFlat
 *     -> 0 (one dominant bin) but tailFlat undefined (tail is
 *     all-zero); a delta at bin K has fullFlat -> 0 but
 *     tailFlat -> 0 (one tail bin dominates). Two equal
 *     deltas at bins 1 and 2 (head-only) have fullFlat at the
 *     m=2 limit and tailFlat undefined (tail empty). A flat
 *     low band + delta in tail has tailFlat -> 0 but fullFlat
 *     bounded away from 0.
 *
 *   - vs `daily-token-spectral-second-peak-frequency` (axis
 *     97): axis-97 is a SECOND-INDEX-VALUED descriptor (where
 *     does the secondary mode sit?). Axis-98 is a real-valued
 *     SUB-BAND MAGNITUDE-RATIO statistic. A bimodal PSD with
 *     equal peaks at k=1 and k=K has axis-97 (k1*, k2*) =
 *     (1, K) and axis-98 tailFlat -> 0 (one tail bin
 *     dominates the tail) -- same structural fact, different
 *     primitive read.
 *
 *   - vs `daily-token-spectral-peak-frequency` (axis 96):
 *     axis-96 is a SINGLE-INDEX read on the FULL band.
 *     Axis-98 is a real-valued AGGREGATE on the TAIL. Axis-96
 *     gives no information about how the upper half of the
 *     spectrum is distributed; axis-98 collapses the upper
 *     half to a single GM/AM scalar.
 *
 *   - vs `daily-token-spectral-roughness` (axis 95):
 *     roughness is an L1 TV-of-pmf MASS aggregate over
 *     ADJACENT bin pairs (full-band) and is permutation-
 *     SENSITIVE within bins. Tail-flatness is permutation-
 *     INVARIANT within the tail subset. A monotone-decreasing
 *     full-band PSD has high roughness (large adjacent
 *     differences) and tailFlat depending only on the upper-
 *     half magnitudes, not their order.
 *
 *   - vs `daily-token-spectral-spread-iqr` (axis 94): spread-
 *     IQR is an inner-50% percentile-gap WIDTH on the PSD-
 *     CDF. Tail-flatness is a FIXED upper-half subset GM/AM
 *     ratio. The IQR is a DATA-DEFINED interval (varies with
 *     spectrum); tail is a STRUCTURAL fixed interval. Two
 *     PSDs with identical IQR can have wildly different tail
 *     flatness depending on how mass is arranged within the
 *     fixed upper half.
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a SECOND-ORDER L2 magnitude statistic
 *     across ALL adjacent bin triples. Tail-flatness is a
 *     0th-order GM/AM scalar on the tail subset.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a FIXED-ANCHOR (bin 1) slope-from-anchor real value
 *     across the FULL band. Tail-flatness ignores the anchor
 *     and the head entirely. A clean 1/f spectrum has strong
 *     negative decrease but tail-flatness depending only on
 *     the noise structure of the upper half (typically near
 *     1 if the 1/f is clean).
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87) /
 *     `-skewness` (axis 90) / `-kurtosis` (axis 91): each is
 *     a CENTROID-RELATIVE central moment computed across the
 *     FULL band. Tail-flatness is a SUB-BAND GM/AM ratio.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is a FIRST RAW MOMENT (mass-weighted bin). Tail-
 *     flatness is a GM/AM ratio on a fixed sub-band. A
 *     spectrum with centroid in the head can still have any
 *     tail-flatness in [0, 1] depending on tail structure.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a CDF QUANTILE BIN INDEX. Tail-flatness is a GM/AM
 *     ratio over a fixed (non-quantile) sub-band. Decoupled
 *     by construction.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is the PEAK-TO-MEAN RATIO of the FULL band. Tail-
 *     flatness is GM/AM (not max/mean) on the SUB-BAND. Crest
 *     is permutation-invariant on the full band; tail-
 *     flatness is permutation-invariant only WITHIN the tail.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): entropy is
 *     Shannon entropy of the normalised PSD across the FULL
 *     band. Tail-flatness uses GM/AM (not -p log p) on the
 *     UPPER HALF only.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope fit. A clean 1/f PSD with beta
 *     ~ -1 has tailFlat near 1 (the tail is by construction
 *     a smooth low-amplitude region of the power-law); a
 *     1/f^2 (red noise) has tailFlat similarly near 1
 *     because the tail mass is small but uniformly small.
 *     A bimodal spectrum with a tail spike has beta ~ 0 but
 *     tailFlat -> 0.
 *
 *   - vs all permutation-invariant amplitude-shape axes
 *     32-67: those are TIME-DOMAIN shuffle-invariant; tail-
 *     flatness is bin-position-sensitive (tail vs head) in
 *     the FREQUENCY domain.
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins, leaving < 2 in the tail), when a non-finite
 * value is present, when var(y) = 0 (every bin is exactly 0
 * power), when fewer than 2 positive-power bins exist in the
 * tail subset, or when the computed flatness is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralFlatnessTailSort =
  | 'tailFlat'
  | 'tailFlatDesc'
  | 'usableTailBins'
  | 'usableTailBinsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralFlatnessTailOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available,
   * leaving at least 2 candidates in the tail subset
   * T = {k > floor(K/2)} (|T| = ceil(K/2) >= 2 for K >= 4).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralFlatnessTailSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralFlatnessTailSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of one-sided Fourier bins K = floor(n/2). */
  nFreqBins: number;
  /** |T| = K - floor(K/2) = ceil(K/2) -- the tail subset size. */
  nTailBins: number;
  /** First bin index of the tail (= floor(K/2) + 1). */
  tailStartBin: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Number of tail bins with strictly positive power (m). */
  usableTailBins: number;
  /** sum_{k in T+} P[k]. */
  tailPowerSum: number;
  /** Wiener AM/GM ratio over T+ in [0, 1]. */
  tailFlat: number;
}

export interface DailyTokenSpectralFlatnessTailReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralFlatnessTailSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedTooFewTailBins: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralFlatnessTailSourceRow[];
}

/**
 * Spectral tail-flatness primitive on a non-negative power
 * vector indexed by k = 1..power.length. The tail subset is
 * T = { k : k > floor(K/2) }; the flatness is the Wiener
 * GM/AM ratio over the positive-power subset T+.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=4, T = {3, 4}: |T|=2.
 *   - K=5, T = {3, 4, 5}: |T|=3.
 *   - K=K, P[k] = c (constant): tailFlat = 1 (GM = AM = c).
 *   - K=K, P[K] = 1, others 0: only one tail bin positive ->
 *     m=1 -> throws.
 *   - K=K, P[K] = a, P[K-1] = a: tailFlat = 1 (two equal
 *     positive tail bins).
 *   - K=K, P[K] = a, P[K-1] = b with a > b > 0: tailFlat
 *     = sqrt(a*b) / ((a+b)/2) = 2*sqrt(a*b)/(a+b) (the m=2
 *     closed form).
 *   - HEAD-only deltas (P[1] = c, others 0): tail is all-
 *     zero -> m=0 -> throws.
 *   - REVERSAL: NOT invariant -- the tail subset maps to the
 *     head subset under k -> K+1-k.
 *
 * Throws on too-few-bins (< 4), non-finite power, negative
 * power, or fewer than 2 positive-power tail bins.
 */
export function spectralFlatnessTail(power: number[]): {
  tailFlat: number;
  usableTailBins: number;
  nTailBins: number;
  tailStartBin: number;
  tailPowerSum: number;
} {
  const k = power.length;
  if (k < 4) {
    throw new Error(
      `spectralFlatnessTail: too few bins (${k}; need >= 4 to leave >= 2 tail candidates)`,
    );
  }
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralFlatnessTail: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralFlatnessTail: negative power at index ${i} (${p})`,
      );
    }
  }
  const tailStartBin = Math.floor(k / 2) + 1; // 1-indexed
  const nTailBins = k - Math.floor(k / 2); // = ceil(k/2)
  let m = 0;
  let arithSum = 0;
  let logSum = 0;
  for (let i = 0; i < k; i += 1) {
    const oneIdx = i + 1;
    if (oneIdx < tailStartBin) continue;
    const p = power[i]!;
    if (p > 0) {
      arithSum += p;
      logSum += Math.log(p);
      m += 1;
    }
  }
  if (m < 2) {
    throw new Error(
      `spectralFlatnessTail: too few positive-power tail bins (${m}; need >= 2; tail starts at bin ${tailStartBin})`,
    );
  }
  const arithMean = arithSum / m;
  const logMean = logSum / m;
  const ratio = Math.exp(logMean - Math.log(arithMean));
  let tailFlat = ratio;
  if (tailFlat < 0) tailFlat = 0;
  if (tailFlat > 1) tailFlat = 1;
  return {
    tailFlat,
    usableTailBins: m,
    nTailBins,
    tailStartBin,
    tailPowerSum: arithSum,
  };
}

/**
 * Daily-token spectral tail-flatness primitive on a real-
 * valued series. Computes the one-sided periodogram, evaluates
 * the GM/AM ratio over positive-power bins in the upper-half
 * subset T = {k > floor(K/2)}, and returns the flatness
 * alongside the mean, stddev, and tail bin counts.
 *
 * Throws when the series is too short (n < 8 -> K < 4),
 * non-finite, zero-variance, or has fewer than 2 positive-
 * power tail bins.
 */
export function dailyTokenSpectralFlatnessTail(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  nTailBins: number;
  tailStartBin: number;
  usableTailBins: number;
  tailPowerSum: number;
  tailFlat: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralFlatnessTail: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralFlatnessTail requires finite values',
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
      'dailyTokenSpectralFlatnessTail: zero variance (constant series)',
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
  if (k < 4) {
    throw new Error(
      `dailyTokenSpectralFlatnessTail: too few bins (${k}; need >= 4)`,
    );
  }
  const result = spectralFlatnessTail(power);
  if (
    !Number.isFinite(result.tailFlat) ||
    !Number.isFinite(result.tailPowerSum)
  ) {
    throw new Error(
      `dailyTokenSpectralFlatnessTail: non-finite output (tailFlat=${result.tailFlat})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    nTailBins: result.nTailBins,
    tailStartBin: result.tailStartBin,
    usableTailBins: result.usableTailBins,
    tailPowerSum: result.tailPowerSum,
    tailFlat: result.tailFlat,
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

export function buildDailyTokenSpectralFlatnessTail(
  queue: QueueLine[],
  opts: DailyTokenSpectralFlatnessTailOptions = {},
): DailyTokenSpectralFlatnessTailReport {
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
  const sort: DailyTokenSpectralFlatnessTailSort =
    opts.sort ?? 'tailFlatDesc';
  const validSorts: DailyTokenSpectralFlatnessTailSort[] = [
    'tailFlat',
    'tailFlatDesc',
    'usableTailBins',
    'usableTailBinsDesc',
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
  let droppedTooFewTailBins = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralFlatnessTailSourceRow[] = [];

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
      result = dailyTokenSpectralFlatnessTail(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('too few positive-power tail bins')) {
        droppedTooFewTailBins += 1;
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
      nTailBins: result.nTailBins,
      tailStartBin: result.tailStartBin,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      usableTailBins: result.usableTailBins,
      tailPowerSum: result.tailPowerSum,
      tailFlat: result.tailFlat,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tailFlat':
        primary = a.tailFlat - b.tailFlat;
        break;
      case 'tailFlatDesc':
        primary = b.tailFlat - a.tailFlat;
        break;
      case 'usableTailBins':
        primary = a.usableTailBins - b.usableTailBins;
        break;
      case 'usableTailBinsDesc':
        primary = b.usableTailBins - a.usableTailBins;
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
    droppedTooFewTailBins,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
