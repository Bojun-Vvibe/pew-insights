/**
 * daily-token-spectral-spread-iqr: per-source ROBUST
 * INTERQUARTILE SPREAD of the bin-index distribution induced
 * by the L1-normalised one-sided non-DC periodogram of the
 * gap-filled mean-centred daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4 (gate enforced via
 * `--min-tenure-days 8`), let p[k] = P[k] / sum_j P[j] be the
 * L1-normalised PSD treated as a probability mass function on
 * the bin index k. Define the cumulative mass
 *
 *   F[m] = sum_{k=1..m} p[k]
 *
 * and the lower / upper quartile bins
 *
 *   q1Bin = min { m in 1..K : F[m] >= 0.25 }
 *   q3Bin = min { m in 1..K : F[m] >= 0.75 }
 *
 * Then
 *
 *   spreadIqr = (q3Bin - q1Bin) / K        in [0, 1)
 *
 * NINETY-FOURTH cross-source axis. Distinct from every
 * shipped SPECTRAL OCTAD axis (84 DFT-slope, 85 Wiener-
 * flatness, 86 centroid, 87 bandwidth, 88 rolloff, 89 crest,
 * 90 skewness, 91 kurtosis), axis 92 spectral-decrease, and
 * axis 93 spectral-irregularity. Spread-IQR is a ROBUST
 * (quantile-based) 2nd-moment dispersion descriptor: the
 * difference between the 75th- and 25th-percentile bins of
 * the L1-normalised PSD, normalised by the bin count.
 *
 * READING:
 *
 *   - spreadIqr ~ 0 -- mass is tightly concentrated within a
 *     narrow band of adjacent bins (extremely peaked PSD).
 *   - spreadIqr small -- mass is concentrated in a small
 *     fraction of the band; the PSD is narrow.
 *   - spreadIqr ~ 0.5 -- mass spans roughly half the band
 *     between the inner quartiles; the PSD is broad.
 *   - spreadIqr -> 1 -- mass is spread nearly uniformly across
 *     the band (broadband / near-white) and the inner-50%
 *     quartile bins are far apart.
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     k >= 1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the L1-normalised pmf is UNCHANGED -> the quartile
 *     bins are unchanged. SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD
 *     and drives spreadIqr toward (3K/4 - K/4)/K = 0.5
 *     (the inner-50% width of a uniform pmf).
 *   - BIN-PERMUTATION: NOT invariant -- the cumulative-mass
 *     quantile traversal is bin-order-tied. This is the
 *     orthogonality witness vs flatness (85), entropy (69),
 *     and crest (89), all of which are bin-permutation
 *     INVARIANT.
 *   - BIN-REVERSAL k -> K + 1 - k: NOT invariant in general.
 *     Reversal sends the lower-quartile bin to K+1-q3Bin and
 *     the upper-quartile bin to K+1-q1Bin -- the IQR width
 *     (q3Bin - q1Bin) is PRESERVED in magnitude. Therefore
 *     spreadIqr IS bin-reversal-invariant (the endpoints flip
 *     but the spread is the same). This separates spreadIqr
 *     from spectral-decrease (axis 92), which is bin-reversal
 *     SENSITIVE.
 *
 * REFERENCES:
 *
 *   Peeters, G., "A large set of audio features for sound
 *     description (similarity and classification) in the
 *     CUIDADO project", IRCAM tech. rep., 2004, §6.1 --
 *     spectral spread family; the IQR variant is the natural
 *     robust counterpart to the variance-based bandwidth.
 *   Lerch, A., "An Introduction to Audio Content Analysis",
 *     Wiley/IEEE, 2012, §3.3.1-3.3.2 -- moment-based vs
 *     quantile-based spectral dispersion.
 *   Tukey, J.W., "Exploratory Data Analysis", Addison-Wesley,
 *     1977, §2 -- the canonical IQR robust-spread primitive
 *     this axis transplants onto the PSD pmf.
 *
 * STRUCTURAL ORTHOGONALITY -- a ROBUST (quantile-based)
 * 2nd-moment dispersion descriptor on the L1-normalised PSD,
 * distinct from every shipped daily-token axis 32..93:
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87): bandwidth
 *     is the SECOND CENTRAL MOMENT around the centroid (a
 *     non-robust L2 spread); spreadIqr is a ROBUST L1
 *     percentile difference. A bandwidth-equivalent PSD with
 *     one heavy outlier bin moves bandwidth strongly and
 *     spreadIqr barely; a PSD with two narrow lobes at the
 *     band edges has high bandwidth and high spreadIqr both,
 *     but the trade-off is non-monotonic in general.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a SINGLE CDF QUANTILE (typically 0.85) on the cumulative
 *     PSD. SpreadIqr uses TWO quantiles (0.25 and 0.75) and
 *     reports their DIFFERENCE. Two PSDs with identical 85th-
 *     percentile rolloff bin can have wildly different IQR
 *     spreads. This is the canonical orthogonality witness
 *     vs rolloff.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is a LOCATION (1st raw moment); spreadIqr is a SCALE
 *     (dispersion). Trivially orthogonal -- shifting all mass
 *     by a constant offset of bins changes the centroid but
 *     leaves the IQR unchanged.
 *
 *   - vs `daily-token-spectral-skewness` (axis 90) /
 *     `-kurtosis` (axis 91): both are higher-order
 *     CENTROID-relative central moments (3rd / 4th
 *     standardised). They are dimensionless shape descriptors
 *     and are sensitive to the tails of the PSD; spreadIqr is
 *     INSENSITIVE to the tails (the inner 50% width depends
 *     only on the mass between the 25th and 75th percentile
 *     bins). A heavy-tailed PSD has high kurtosis and small
 *     spreadIqr; a uniform PSD has zero kurtosis and large
 *     spreadIqr.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is a peak-to-mean RATIO, BIN-PERMUTATION INVARIANT.
 *     SpreadIqr is bin-permutation-SENSITIVE. A high-crest
 *     PSD with one isolated spike has tiny spreadIqr (mass
 *     concentrated at one bin); a high-crest PSD with the
 *     same multiset reordered into a smooth ramp has larger
 *     spreadIqr but equal crest.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     flatness is GM/AM over bin powers, BIN-PERMUTATION
 *     INVARIANT. SpreadIqr is bin-order-sensitive at the
 *     cumulative-mass scale.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): Shannon
 *     entropy of the L1-normalised periodogram, BIN-
 *     PERMUTATION INVARIANT.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG slope via least-squares. SpreadIqr is
 *     a linear-axis quantile-based dispersion. A clean
 *     power-law spectrum has a well-defined beta and a
 *     specific spreadIqr that depends on beta and K; perturbing
 *     a single mid-band bin shifts spreadIqr without changing
 *     beta materially.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a FIXED-ANCHOR (bin 1) 1/(k-1)-weighted slope-from-
 *     anchor. Decrease is bin-reversal SENSITIVE; spreadIqr
 *     IS bin-reversal-invariant (endpoints flip but the
 *     magnitude is preserved). A monotone-decreasing PSD has
 *     strong decrease (negative) and small q3Bin (mass
 *     piles up early), giving small spreadIqr; a comb PSD
 *     has near-zero decrease and large spreadIqr.
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a LOCAL adjacent-bin difference
 *     (derivative-like). SpreadIqr is a GLOBAL inner-50%
 *     dispersion (quantile-based). A locally-rough PSD with
 *     mass concentrated at one band has high irregularity and
 *     small spreadIqr; a locally-smooth broad PSD has low
 *     irregularity and large spreadIqr. The decoupling is
 *     the orthogonality witness.
 *
 *   - vs all permutation-invariant amplitude-shape axes 32-67:
 *     those are TIME-DOMAIN shuffle-invariant; spreadIqr is
 *     bin-order-sensitive in the FREQUENCY domain.
 *
 * Bound: spreadIqr is in [0, 1). It equals 0 iff q1Bin == q3Bin
 * (all mass between the inner quartiles falls in a single
 * bin). It approaches 1 only when q1Bin == 1 and q3Bin == K
 * (mass spread broadly with the 25th percentile already at the
 * first bin and the 75th percentile only reached at the last
 * bin).
 *
 * Throws when the series is too short (n < 8 -> K < 4
 * candidate bins), when a non-finite value is present, when
 * var(y) = 0 (every bin is exactly 0 power), when the
 * cumulative PSD denominator sum_{k=1..K} P[k] is non-positive
 * (degenerate all-zero spectrum), or when the computed
 * spreadIqr is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralSpreadIqrSort =
  | 'spreadIqr'
  | 'spreadIqrDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralSpreadIqrOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * (we need K >= 2 strictly for any non-degenerate quartile
   * traversal; K >= 4 keeps the descriptor non-trivial).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralSpreadIqrSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralSpreadIqrSourceRow {
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
  /** Lower-quartile (0.25) bin index in 1..K. */
  q1Bin: number;
  /** Upper-quartile (0.75) bin index in 1..K. */
  q3Bin: number;
  /** sum_{k=1..K} P[k] -- L1 PSD mass (denominator). */
  totalPower: number;
  /** Robust IQR spread = (q3Bin - q1Bin) / K, in [0, 1). */
  spreadIqr: number;
}

export interface DailyTokenSpectralSpreadIqrReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralSpreadIqrSort;
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
  sources: DailyTokenSpectralSpreadIqrSourceRow[];
}

/**
 * Spectral spread-IQR primitive on a non-negative power vector
 * indexed by k = 1..power.length. Returns
 * `{ spreadIqr, q1Bin, q3Bin, totalPower }`. Throws when the
 * input has fewer than 2 bins / contains a non-finite or
 * negative value / has non-positive totalPower (degenerate
 * all-zero spectrum).
 *
 * The quartile bins are defined via the smallest cumulative
 * mass index that meets or exceeds the threshold:
 *
 *   q1Bin = min { m : sum_{k=1..m} P[k] / totalPower >= 0.25 }
 *   q3Bin = min { m : sum_{k=1..m} P[k] / totalPower >= 0.75 }
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=4, P=[1,1,1,1]   -> totalPower=4, cumshares
 *                           [0.25, 0.5, 0.75, 1.0];
 *                           q1Bin=1, q3Bin=3, spread=(3-1)/4=0.5
 *   - K=4, P=[1,0,0,0]   -> q1Bin=q3Bin=1, spread=0 (all mass
 *                           in one bin)
 *   - K=K,  P=[1,0,...,0] -> q1Bin=q3Bin=1, spread=0
 *   - K=K,  P=[0,...,0,1] -> q1Bin=q3Bin=K, spread=0
 *   - K=4, P=[0,1,1,0]   -> cumshares [0, 0.5, 1.0, 1.0];
 *                           q1Bin=2 (first to hit 0.25),
 *                           q3Bin=3, spread=(3-2)/4=0.25
 */
export function spectralSpreadIqr(power: number[]): {
  spreadIqr: number;
  q1Bin: number;
  q3Bin: number;
  totalPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralSpreadIqr: too few bins (${k}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralSpreadIqr: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralSpreadIqr: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `spectralSpreadIqr: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  const lo = 0.25 * totalPower;
  const hi = 0.75 * totalPower;
  let cum = 0;
  let q1Bin = -1;
  let q3Bin = -1;
  for (let i = 0; i < k; i += 1) {
    cum += power[i]!;
    if (q1Bin === -1 && cum >= lo) q1Bin = i + 1;
    if (q3Bin === -1 && cum >= hi) {
      q3Bin = i + 1;
      break;
    }
  }
  // Defensive: with totalPower>0 we must hit both thresholds
  // before the loop exits; if not, something is numerically
  // pathological -- treat as non-finite.
  if (q1Bin === -1 || q3Bin === -1) {
    throw new Error(
      `spectralSpreadIqr: failed to locate quartile bins (q1=${q1Bin}, q3=${q3Bin}, totalPower=${totalPower})`,
    );
  }
  const spreadIqr = (q3Bin - q1Bin) / k;
  return { spreadIqr, q1Bin, q3Bin, totalPower };
}

/**
 * Daily-token spectral-spread-IQR primitive on a real-valued
 * series. Computes the one-sided periodogram, takes the
 * IQR-based bin spread, and returns the spread, q1Bin, q3Bin,
 * totalPower, mean, stddev, and bin count.
 */
export function dailyTokenSpectralSpreadIqr(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  q1Bin: number;
  q3Bin: number;
  totalPower: number;
  spreadIqr: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSpectralSpreadIqr: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralSpreadIqr requires finite values',
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
      'dailyTokenSpectralSpreadIqr: zero variance (constant series)',
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
  const result = spectralSpreadIqr(power);
  if (
    !Number.isFinite(result.spreadIqr) ||
    !Number.isFinite(result.totalPower)
  ) {
    throw new Error(
      `dailyTokenSpectralSpreadIqr: non-finite output (spreadIqr=${result.spreadIqr}, totalPower=${result.totalPower})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    q1Bin: result.q1Bin,
    q3Bin: result.q3Bin,
    totalPower: result.totalPower,
    spreadIqr: result.spreadIqr,
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

export function buildDailyTokenSpectralSpreadIqr(
  queue: QueueLine[],
  opts: DailyTokenSpectralSpreadIqrOptions = {},
): DailyTokenSpectralSpreadIqrReport {
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
  const sort: DailyTokenSpectralSpreadIqrSort = opts.sort ?? 'spreadIqrDesc';
  const validSorts: DailyTokenSpectralSpreadIqrSort[] = [
    'spreadIqr',
    'spreadIqrDesc',
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
  const rows: DailyTokenSpectralSpreadIqrSourceRow[] = [];

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
      result = dailyTokenSpectralSpreadIqr(filled);
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
      q1Bin: result.q1Bin,
      q3Bin: result.q3Bin,
      totalPower: result.totalPower,
      spreadIqr: result.spreadIqr,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'spreadIqr':
        primary = a.spreadIqr - b.spreadIqr;
        break;
      case 'spreadIqrDesc':
        primary = b.spreadIqr - a.spreadIqr;
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
