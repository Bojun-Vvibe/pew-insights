/**
 * daily-token-spectral-renyi2-entropy: per-source SPECTRAL
 * RENYI-ALPHA=2 (COLLISION) ENTROPY -- the negative natural-
 * log of the sum of SQUARED normalised bin probabilities of
 * the one-sided non-DC periodogram of the gap-filled mean-
 * centred daily total_tokens series, normalised by ln(K)
 * into [0, 1].
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 2, define the normalised power
 * distribution
 *
 *   S        = sum_{k=1..K} P[k]                  (must be > 0)
 *   p[k]     = P[k] / S                           in [0, 1]
 *   H2       = -ln(sum_{k=1..K} p[k]^2)           in [0, ln K]
 *   h2Norm   = H2 / ln K                          in [0, 1]
 *
 * Equivalently, sum p[k]^2 = 1 / K_eff where K_eff is the
 * EFFECTIVE NUMBER OF SPECTRAL BINS (the inverse participation
 * ratio, IPR^-1, classical in localisation physics). So
 *
 *   h2Norm = ln(K_eff) / ln(K)
 *
 * NINETY-NINTH cross-source axis. This is a Class-EN
 * (RENYI-ENTROPY-ALPHA=2) primitive -- the FIRST primitive in
 * the suite that uses an ALPHA=2 Renyi (collision) entropy on
 * the SPECTRAL distribution. Structurally distinct from
 * axis-69 (Shannon spectral entropy, alpha=1 limit) and from
 * axis-85 (Wiener flatness, GM/AM ratio).
 *
 * The Renyi-2 vs Shannon distinction matters because:
 *   - Shannon weights every bin by its OWN log-probability
 *     (-p log p), giving moderate sensitivity to all bins.
 *   - Renyi-2 weights bins QUADRATICALLY (sum p^2), so it is
 *     dominated by the LARGEST bins; it is the canonical
 *     "concentration" entropy. It thereby gives a different
 *     ordering of spectra that have the same Shannon entropy
 *     but different concentration profiles -- e.g. one large
 *     peak + many tiny bins vs several medium bins can match
 *     on Shannon but split on Renyi-2.
 *
 * READING:
 *
 *   - h2Norm ~ 1 -- the spectrum is nearly EQUIPOWERED across
 *     all bins (white-noise-like; effective bin count ~ K).
 *   - h2Norm ~ 0 -- the spectrum is concentrated on a SINGLE
 *     bin (delta-like; effective bin count ~ 1).
 *   - K_eff = exp(H2) gives a direct interpretation: "how
 *     many bins effectively carry the mass under quadratic
 *     weighting".
 *
 * BOUND: h2Norm in [0, 1] exactly. h2Norm = 1 iff p[k] = 1/K
 * for all k (uniform PSD, every bin equipowered);
 * h2Norm -> 0 as one bin's share approaches 1.
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; the kept bins
 *     are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the NORMALISED probabilities p[k] are unchanged.
 *     SCALE-INVARIANT.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 is reversal-
 *     blind. TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling redistributes mass
 *     across bins, changing p[k].
 *   - BIN-PERMUTATION (any permutation of bins): sum p^2 is
 *     symmetric, so h2Norm IS bin-permutation-invariant. This
 *     is the structural contrast with axis-98 (tail-flatness)
 *     which is sub-band-restricted and therefore NOT
 *     permutation-invariant across the full band.
 *   - BIN-REVERSAL k -> K + 1 - k: a special case of bin-
 *     permutation. INVARIANT.
 *
 * REFERENCES:
 *
 *   Renyi, A., "On measures of entropy and information",
 *     Proc. 4th Berkeley Symp. on Math. Stat. & Probab.,
 *     vol. 1 (1961) pp. 547-561 -- the original alpha-family.
 *   Beck, C. and Schloegl, F., "Thermodynamics of Chaotic
 *     Systems", Cambridge University Press (1993) Ch. 6 --
 *     Renyi entropies and the inverse participation ratio.
 *   Bell, A. J. and Sejnowski, T. J., "An information-
 *     maximisation approach to blind separation and blind
 *     deconvolution", Neural Computation 7:6 (1995) -- IPR
 *     and concentration measures on PSDs.
 *   Wegner, F., "Inverse participation ratio in 2 + epsilon
 *     dimensions", Z. Physik B 36 (1980) -- IPR as the
 *     localisation diagnostic that exp(H2) = K_eff captures.
 *
 * STRUCTURAL ORTHOGONALITY -- a 2ND-ORDER (QUADRATIC) ENTROPY
 * descriptor on the FULL-BAND normalised PSD, distinct from
 * every shipped daily-token axis 32..98:
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): axis-69 is
 *     SHANNON entropy (alpha = 1 limit), -sum p log p. Axis-99
 *     is RENYI-2 entropy, -log sum p^2. The two are EQUAL only
 *     on a uniform distribution; for any non-uniform PSD they
 *     give a DIFFERENT ordering. A spectrum with one big peak
 *     + many tiny bins vs a spectrum with several medium peaks
 *     can have identical Shannon but different Renyi-2 (the
 *     classic Shannon-vs-Renyi trade-off). Algebraically, by
 *     Jensen's inequality H2 <= H1 (Shannon), with equality
 *     iff uniform; the GAP H1 - H2 is itself a non-trivial
 *     concentration diagnostic that this axis exposes via its
 *     normalised form.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     axis-85 is the GM/AM ratio (a different functional of
 *     the same p[k]). Algebraically, log(GM/AM) = (1/K) sum
 *     log p - log mean p, which is a 0TH-order entropy
 *     measure. Renyi-2 uses sum p^2, a 2ND-order moment of p.
 *     Two PSDs with the same flatness (same GM/AM) can have
 *     different sum p^2 -- e.g. a low-rank perturbation of a
 *     uniform distribution.
 *
 *   - vs `daily-token-spectral-flatness-tail` (axis 98):
 *     axis-98 is GM/AM RESTRICTED to the upper-half subset.
 *     Axis-99 is FULL-BAND quadratic entropy, permutation-
 *     invariant. A head-dominant spectrum has axis-98 ~ 1 but
 *     axis-99 small (low effective bin count); a tail-spike
 *     has axis-98 small but axis-99 also small -- they both
 *     drop in the tail-spike case but for completely different
 *     structural reasons (tail-only vs full-band).
 *
 *   - vs `daily-token-spectral-second-peak-frequency` (axis
 *     97): axis-97 returns the bin INDEX of the second peak +
 *     a magnitude RATIO peakRatio = P[k2*]/P[k1*]; axis-99 is
 *     a real-valued GLOBAL CONCENTRATION scalar. A unimodal
 *     spectrum with a single sharp peak has axis-99 small
 *     (collision dominated by k1*) but axis-97 peakRatio
 *     small (k2* << k1*); a bimodal balanced spectrum has
 *     axis-99 medium (two-bin equipartition: K_eff ~ 2) and
 *     axis-97 peakRatio ~ 1.
 *
 *   - vs `daily-token-spectral-peak-frequency` (axis 96):
 *     axis-96 is a SINGLE-INDEX read (bin position of the max).
 *     Axis-99 is a magnitude-aggregate scalar that ignores
 *     bin position. Two PSDs with peakBin = (1, K) and the
 *     same magnitude profile share axis-99 but split on
 *     axis-96.
 *
 *   - vs `daily-token-spectral-roughness` (axis 95):
 *     roughness is an L1 TV-of-pmf MASS aggregate over
 *     ADJACENT bin pairs (permutation-SENSITIVE). Renyi-2 is
 *     permutation-INVARIANT. A sorted-descending PSD vs the
 *     same multiset reverse-sorted has identical h2Norm but
 *     dramatically different roughness.
 *
 *   - vs `daily-token-spectral-spread-iqr` (axis 94): IQR
 *     uses a CDF-quantile width on the bin-INDEX axis;
 *     Renyi-2 ignores bin order. A delta at bin K has IQR = 0
 *     and h2Norm = 0; a uniform PSD has IQR = K/2 and
 *     h2Norm = 1. But two reversed PSDs share h2Norm and
 *     split on IQR.
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93):
 *     irregularity is a SECOND-ORDER L2 magnitude statistic
 *     across ALL adjacent bin triples (permutation-SENSITIVE).
 *     Renyi-2 is permutation-INVARIANT.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92): decrease
 *     is a FIXED-ANCHOR (bin 1) slope-from-anchor real value;
 *     it is bin-position-dependent. Renyi-2 ignores bin
 *     position entirely.
 *
 *   - vs `daily-token-spectral-bandwidth/skewness/kurtosis`
 *     (axes 87/90/91): each is a CENTROID-RELATIVE central
 *     moment computed on the bin-INDEX axis (mass-weighted
 *     positions). Renyi-2 is a moment of the PROBABILITY
 *     VECTOR p, not of the bin-index axis -- two PSDs with
 *     the same bandwidth can have very different concentration.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is a FIRST RAW MOMENT (mass-weighted bin index). Renyi-2
 *     is independent of bin index.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a CDF QUANTILE BIN INDEX. Renyi-2 is a quadratic
 *     concentration scalar with no quantile structure.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is the PEAK-TO-MEAN RATIO of the FULL band, max p / mean
 *     p, an L-infinity / L1 ratio. Renyi-2 is an L2 / L1
 *     ratio. Same family of "spikiness" descriptors but
 *     different norms -- they coincide only on degenerate
 *     spectra (uniform or single-bin) and decouple on the
 *     middle ground (two-bin equipartition has crest = K/2
 *     and h2Norm = log 2 / log K).
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG SLOPE fit. A 1/f spectrum has beta = -1
 *     and h2Norm depending on K (effective bin count grows
 *     logarithmically); a flat spectrum has beta = 0 and
 *     h2Norm = 1.
 *
 *   - vs all permutation-invariant TIME-DOMAIN amplitude-shape
 *     axes 32-67: those operate on the time-domain shuffle-
 *     invariant statistic of the daily series. Renyi-2 here
 *     is on the FREQUENCY-domain |DFT|^2 distribution. A
 *     shuffle of the time-domain series leaves time-domain
 *     amplitude statistics fixed but DESTROYS the spectrum.
 *
 *   - vs `source-row-token-renyi-entropy`: same Renyi family
 *     but on the per-row TOKEN MASS distribution (time-domain),
 *     not on the SPECTRAL distribution. Different domain,
 *     different unit of aggregation, different primitive.
 *
 * Throws when the series is too short (n < 4 -> K < 2 bins),
 * when a non-finite value is present, when var(y) = 0 (every
 * bin is exactly 0 power -> S = 0), or when the computed
 * entropy is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralRenyi2EntropySort =
  | 'h2Norm'
  | 'h2NormDesc'
  | 'kEff'
  | 'kEffDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralRenyi2EntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so that
   * K = floor(n/2) >= 2 candidate Fourier bins are available
   * (ln K is the normalisation denominator and must be > 0).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpectralRenyi2EntropySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralRenyi2EntropySourceRow {
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
  /** sum_{k=1..K} P[k]. */
  totalPower: number;
  /** sum_{k=1..K} p[k]^2 in [1/K, 1]. */
  sumP2: number;
  /** Effective bin count = 1 / sumP2 in [1, K]. */
  kEff: number;
  /** Renyi-2 entropy in nats: -ln(sumP2) in [0, ln K]. */
  h2: number;
  /** Renyi-2 entropy normalised by ln(K), in [0, 1]. */
  h2Norm: number;
}

export interface DailyTokenSpectralRenyi2EntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralRenyi2EntropySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPower: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralRenyi2EntropySourceRow[];
}

/**
 * Spectral Renyi-2 (collision) entropy primitive on a non-
 * negative power vector indexed by k = 1..power.length.
 * Returns the entropy in nats, the effective bin count, the
 * sum of squared normalised probabilities, and the normalised
 * entropy in [0, 1] (divided by ln K).
 *
 * Closed-form sanity anchors:
 *   - K=K, P[k] = c (uniform): p[k] = 1/K -> sumP2 = 1/K
 *     -> h2 = ln K -> h2Norm = 1.
 *   - K=K, P[1] = c, others 0: p[1] = 1 -> sumP2 = 1
 *     -> h2 = 0 -> h2Norm = 0.
 *   - K=K, P[1] = P[2] = c, others 0 (two equipowered bins):
 *     sumP2 = 1/2 -> h2 = ln 2 -> h2Norm = ln 2 / ln K.
 *   - kEff = exp(h2) = 1/sumP2.
 *   - Bin-permutation INVARIANT (sum is symmetric).
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, or zero total power.
 */
export function spectralRenyi2Entropy(power: number[]): {
  h2: number;
  h2Norm: number;
  kEff: number;
  sumP2: number;
  totalPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralRenyi2Entropy: too few bins (${k}; need >= 2 so ln K > 0)`,
    );
  }
  let s = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralRenyi2Entropy: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralRenyi2Entropy: negative power at index ${i} (${p})`,
      );
    }
    s += p;
  }
  if (!(s > 0)) {
    throw new Error(
      `spectralRenyi2Entropy: zero total power (S=${s}; PSD is identically zero)`,
    );
  }
  let sumP2 = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]! / s;
    sumP2 += p * p;
  }
  // Numerical guard: clamp sumP2 to its valid range [1/K, 1].
  if (sumP2 > 1) sumP2 = 1;
  if (sumP2 < 1 / k) sumP2 = 1 / k;
  const h2 = -Math.log(sumP2);
  const lnK = Math.log(k);
  let h2Norm = h2 / lnK;
  if (h2Norm < 0) h2Norm = 0;
  if (h2Norm > 1) h2Norm = 1;
  // Normalise -0 to +0 for clean equality semantics.
  const h2Out = h2 === 0 ? 0 : h2;
  const h2NormOut = h2Norm === 0 ? 0 : h2Norm;
  const kEff = 1 / sumP2;
  return { h2: h2Out, h2Norm: h2NormOut, kEff, sumP2, totalPower: s };
}

/**
 * Daily-token spectral Renyi-2 entropy primitive on a real-
 * valued series. Computes the one-sided periodogram and
 * applies `spectralRenyi2Entropy` to the resulting bin power
 * vector.
 *
 * Throws when the series is too short (n < 4 -> K < 2),
 * non-finite, zero-variance, or yields zero total power.
 */
export function dailyTokenSpectralRenyi2Entropy(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  sumP2: number;
  kEff: number;
  h2: number;
  h2Norm: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenSpectralRenyi2Entropy: series too short (n=${n}, need n >= 4)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralRenyi2Entropy requires finite values',
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
      'dailyTokenSpectralRenyi2Entropy: zero variance (constant series)',
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
      `dailyTokenSpectralRenyi2Entropy: too few bins (${k}; need >= 2)`,
    );
  }
  const result = spectralRenyi2Entropy(power);
  if (
    !Number.isFinite(result.h2) ||
    !Number.isFinite(result.h2Norm) ||
    !Number.isFinite(result.kEff)
  ) {
    throw new Error(
      `dailyTokenSpectralRenyi2Entropy: non-finite output (h2=${result.h2})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    sumP2: result.sumP2,
    kEff: result.kEff,
    h2: result.h2,
    h2Norm: result.h2Norm,
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

export function buildDailyTokenSpectralRenyi2Entropy(
  queue: QueueLine[],
  opts: DailyTokenSpectralRenyi2EntropyOptions = {},
): DailyTokenSpectralRenyi2EntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralRenyi2EntropySort = opts.sort ?? 'h2NormDesc';
  const validSorts: DailyTokenSpectralRenyi2EntropySort[] = [
    'h2Norm',
    'h2NormDesc',
    'kEff',
    'kEffDesc',
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
  let droppedZeroPower = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralRenyi2EntropySourceRow[] = [];

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
      result = dailyTokenSpectralRenyi2Entropy(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('zero total power')) {
        droppedZeroPower += 1;
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
      sumP2: result.sumP2,
      kEff: result.kEff,
      h2: result.h2,
      h2Norm: result.h2Norm,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'h2Norm':
        primary = a.h2Norm - b.h2Norm;
        break;
      case 'h2NormDesc':
        primary = b.h2Norm - a.h2Norm;
        break;
      case 'kEff':
        primary = a.kEff - b.kEff;
        break;
      case 'kEffDesc':
        primary = b.kEff - a.kEff;
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
    droppedZeroPower,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
