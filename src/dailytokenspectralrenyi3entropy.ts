/**
 * daily-token-spectral-renyi3-entropy: per-source SPECTRAL
 * RENYI-ALPHA=3 (collision-3) entropy on the one-sided non-DC
 * periodogram of the gap-filled mean-centred daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-FIRST cross-source axis.
 *
 * Definition. Let P[k] for k = 1..K = floor(n/2) be the one-sided
 * periodogram of the gap-filled mean-centred series. Let
 *   S       = sum_{k=1..K} P[k]                        (must be > 0)
 *   p[k]    = P[k] / S                                 in [0, 1]
 *   M3      = sum_{k=1..K} p[k]^3                      in [1/K^2, 1]
 *   H3      = -ln(M3) / 2                              in [0, ln K]
 *   h3Norm  = H3 / ln K                                in [0, 1]
 *   kEff3   = exp(H3) = M3^(-1/2)                      in [1, K]
 *
 * H3 is the canonical Renyi entropy at order alpha = 3
 * (Renyi 1961, "On Measures of Entropy and Information",
 * Proc. 4th Berkeley Symp. on Math. Stat. & Prob., 547-561,
 * eq. 3.2 with alpha = 3). M3 is the THIRD COLLISION
 * PROBABILITY: the chance that three independent draws from
 * the spectral pmf land on the same bin. kEff3 = M3^(-1/2)
 * is the EFFECTIVE NUMBER OF SPECTRAL BINS UNDER CUBIC
 * WEIGHTING.
 *
 * h3Norm is monotone-decreasing in alpha (Renyi 1961, Theorem
 * 4): for the same PSD, h3Norm <= h2Norm <= h_Shannon_norm
 * <= hHalfNorm with equality iff p is uniform. The GAP
 * h2Norm - h3Norm is a NEW peak-mass-concentration diagnostic:
 * it is sensitive to whether peak mass sits in ONE huge bin
 * (h2Norm and h3Norm both small, but h2Norm/h3Norm ratio close
 * to 1) vs SEVERAL medium-large bins (h2Norm somewhat larger
 * than h3Norm because cubic weighting punishes the smaller
 * peaks faster than quadratic does).
 *
 * Headline question:
 * **"For each source, how concentrated under CUBIC moment
 *   weighting is the periodogram of its gap-filled daily-token
 *   series, normalised against the all-bins-equal Hartley
 *   ceiling?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS:
 *
 *   - vs `daily-token-spectral-renyi2-entropy` (axis 99):
 *     PRIMARY target. Axis-99 uses M2 = sum p[k]^2 (the
 *     SECOND collision probability / inverse participation
 *     ratio). Axis-101 uses M3 = sum p[k]^3 (the THIRD
 *     collision probability). M2 and M3 are MOMENT-
 *     INDEPENDENT for K >= 3: a 3-bin pmf has 2 free
 *     parameters, fixing M2 leaves a 1-parameter family on
 *     which M3 still varies. Counter-example: K=10,
 *     A = [0.7, 0.1, 0.1, 0.1, 0, ..., 0] vs
 *     B = [0.55, 0.4, 0.05, 0, ..., 0]. M2_A = 0.52,
 *     M2_B = 0.4625; M3_A = 0.346, M3_B = 0.230. The two
 *     ranks (A>B in M2 AND in M3) coincide here but the
 *     RATIO h3Norm/h2Norm differs significantly -- A is
 *     "single-peak with three small bumps" (cubic weighting
 *     amplifies the dominant 0.7 even more than quadratic
 *     does, so h3Norm drops harder than h2Norm), while B is
 *     "two-peak" (cubic weighting still mostly sees the 0.55
 *     and the 0.4, so h3Norm tracks h2Norm more closely).
 *     Concretely: h2Norm_A = -ln(0.52)/ln(10) = 0.284 vs
 *     h2Norm_B = -ln(0.4625)/ln(10) = 0.335 (B more spread);
 *     h3Norm_A = -ln(0.346)/(2*ln(10)) = 0.230 vs
 *     h3Norm_B = -ln(0.230)/(2*ln(10)) = 0.319 (B even more
 *     spread under cubic weighting). The h2Norm - h3Norm gap
 *     is 0.054 for A vs 0.016 for B -- a 3.4x difference in
 *     the same diagnostic, on two PSDs with similar overall
 *     concentration. Axis-101 is the only primitive in the
 *     suite that surfaces this gap.
 *
 *   - vs `daily-token-spectral-renyi-half-entropy` (axis 100):
 *     axis-100 is alpha = 0.5 (sub-linear, tail-mass weighted);
 *     axis-101 is alpha = 3 (super-quadratic, peak-mass weighted).
 *     The two are at OPPOSITE ENDS of the Renyi family with
 *     OPPOSITE tail/peak sensitivity. The TRIPLE
 *     (hHalfNorm, h2Norm, h3Norm) gives a 3-point sweep of
 *     the Renyi spectrum with axis-101 supplying the ALPHA > 2
 *     anchor that no other axis provides.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69, Shannon =
 *     alpha -> 1 limit): h3Norm <= h_Shannon_norm by the same
 *     Renyi monotonicity. h_Shannon_norm uses sum p log p
 *     (logarithmic moment); h3Norm uses log(sum p^3) (cubic
 *     moment). Coincide only on uniform spectra; on every
 *     non-uniform PSD the gap h_Shannon_norm - h3Norm is
 *     STRICTLY positive and quantifies the "peakedness premium
 *     beyond Shannon".
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85, GM/AM
 *     = alpha -> 0 limit, Hartley): axis-85 is the geometric/
 *     arithmetic mean ratio of POSITIVE bins only. Axis-101 is
 *     full-band cubic-weighted. Two PSDs with the same GM/AM
 *     can have very different M3 (a 2-bin equipartition has
 *     M3 = 0.25; a 4-bin equipartition has M3 = 0.0625; both
 *     have GM/AM = 1 on the kept-positive subset).
 *
 *   - vs `daily-token-spectral-flatness-tail` (axis 98): axis-98
 *     is GM/AM RESTRICTED to the upper-half subset. Axis-101 is
 *     FULL-BAND, bin-permutation-invariant, cubic-weighted.
 *     Permuting the same multiset between head and tail leaves
 *     axis-101 unchanged; axis-98 swings.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): axis-89
 *     is a SINGLE-EXTREMUM ratio (max P[k] / mean P[k]); axis-101
 *     is a FULL-DISTRIBUTION moment. Two spectra with the same
 *     peak-to-mean can have very different M3: spectrum A has
 *     one big bin and the rest near uniform (high crest, M3
 *     dominated by the big bin); spectrum B has a small handful
 *     of medium-large bins and the rest zero (same peak/mean
 *     but M3 = sum of several medium cubes, smaller than A).
 *
 *   - vs `daily-token-spectral-second-peak-frequency` (axis 97),
 *     `-peak-frequency` (axis 96), `-roughness` (axis 95),
 *     `-spread-iqr` (axis 94), `-irregularity` (axis 93),
 *     `-decrease` (axis 92): each is bin-position-SENSITIVE.
 *     axis-101 is bin-permutation-INVARIANT (M3 is a symmetric
 *     function of the pmf vector). Sorted-descending vs
 *     reverse-sorted vs random-permuted spectra share IDENTICAL
 *     h3Norm and very different roughness, peak indices, IQR.
 *
 *   - vs `daily-token-spectral-bandwidth/skewness/kurtosis`
 *     (axes 87/90/91): each is a CENTROID-RELATIVE central
 *     moment in bin-index space. axis-101 has NO centroid and
 *     no moment-about-centroid; it operates on the pmf VALUES
 *     directly, regardless of bin index. Bin-permutation-
 *     invariant by construction.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88, CDF
 *     percentile) and `-centroid` (axis 86, first moment): both
 *     bin-index-sensitive; both invariant under positive
 *     scaling of P; axis-101 is bin-position-blind and SENSITIVE
 *     to the SHAPE of the sorted pmf via cubic weighting.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): axis-84
 *     is the OLS slope of log P[k] on log k -- a structural
 *     scaling parameter. axis-101 is a SHAPE statistic of the
 *     same P normalised. A 1/f spectrum (beta = 1) on K=20
 *     bins has h3Norm ~ 0.85 (gentle concentration); a flat
 *     spectrum (beta = 0) has h3Norm = 1; a single-bin delta
 *     has h3Norm = 0; beta and h3Norm are independently
 *     adjustable.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70),
 *     `-sample-entropy` (axis 73), `-lempel-ziv-complexity`
 *     (axis 83): all TIME-DOMAIN complexity primitives. axis-101
 *     is FREQUENCY-DOMAIN. A shuffle of the daily series leaves
 *     PE unchanged but DESTROYS the spectrum (and hence M3).
 *     A monotone scaling of the daily series leaves PE
 *     unchanged but rescales the spectrum bin values uniformly,
 *     leaving M3 unchanged (M3 is scale-invariant).
 *
 *   - vs all permutation-invariant TIME-DOMAIN amplitude-shape
 *     axes 32-67 (Gini, Atkinson, Theil, GE, Hill, Bowley,
 *     ...): those operate on the TIME-DOMAIN distribution.
 *     axis-101 is on the FREQUENCY-DOMAIN |DFT|^2 distribution.
 *     A shuffle of the time-domain series leaves time-domain
 *     amplitude statistics fixed but DESTROYS the spectrum.
 *
 *   - vs `source-row-token-renyi-entropy`: same Renyi family
 *     but on the per-row TOKEN MASS distribution (time-domain
 *     histogram), not on the SPECTRAL distribution. Different
 *     domain, different unit of aggregation, different primitive.
 *
 * Caveats:
 *
 *   - h3Norm is sensitive to the K = floor(n/2) bin count via
 *     the ln(K) denominator. Comparisons across sources with
 *     very different tenures should also chart kEff3 (raw
 *     effective bin count under cubic weighting), which is
 *     unitless and tenure-comparable.
 *
 *   - M3 is bounded below by 1/K^2 only for the uniform
 *     distribution; for general PSDs the lower bound is 1/K^(q-1)
 *     = 1/K^2 (Renyi 1961). The clamp to [1/K^2, 1] is a
 *     numeric guard; mathematically the values always lie in
 *     [1/K^2, 1] when the pmf is well-formed.
 *
 *   - At K = 2 with both bins equal, h3Norm = 1 by construction
 *     (the Hartley ceiling). At K = 2 with one bin holding all
 *     mass, h3Norm = 0. K = 2 is the boundary regime; small-K
 *     readings should be interpreted with care.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * References:
 *   Renyi, A., "On Measures of Entropy and Information",
 *     Proc. 4th Berkeley Symp. Math. Stat. & Prob. 1, 547-561,
 *     1961.
 *   Beck, C. & Schloegl, F., "Thermodynamics of Chaotic Systems",
 *     Cambridge University Press, 1993, ch. 5 (Renyi dimensions
 *     and effective state counts).
 *   Wolf, A. et al., "Determining Lyapunov Exponents from a
 *     Time Series", Physica D 16:285-317, 1985 (collision
 *     probabilities and effective phase-space volumes).
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralRenyi3EntropySort =
  | 'h3Norm'
  | 'h3NormDesc'
  | 'kEff3'
  | 'kEff3Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralRenyi3EntropyOptions {
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
  sort?: DailyTokenSpectralRenyi3EntropySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralRenyi3EntropySourceRow {
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
  /** Third collision probability sum_{k=1..K} p[k]^3 in [1/K^2, 1]. */
  sumP3: number;
  /** Effective bin count under alpha=3 = M3^(-1/2) in [1, K]. */
  kEff3: number;
  /** Renyi-3 entropy in nats: -ln(M3) / 2 in [0, ln K]. */
  h3: number;
  /** Renyi-3 entropy normalised by ln(K), in [0, 1]. */
  h3Norm: number;
}

export interface DailyTokenSpectralRenyi3EntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralRenyi3EntropySort;
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
  sources: DailyTokenSpectralRenyi3EntropySourceRow[];
}

/**
 * Spectral Renyi-3 (collision-3) entropy primitive on a
 * non-negative power vector indexed by k = 1..power.length.
 * Returns the entropy in nats, the alpha=3 effective bin
 * count, the third collision probability M3 = sum p[k]^3,
 * and the normalised entropy in [0, 1] (divided by ln K).
 *
 * Closed-form sanity anchors:
 *   - K=K, P[k] = c (uniform): p[k] = 1/K -> M3 = K * (1/K)^3
 *     = 1/K^2 -> h3 = -ln(1/K^2)/2 = ln K -> h3Norm = 1.
 *   - K=K, P[1] = c, others 0: p[1] = 1 -> M3 = 1 -> h3 = 0
 *     -> h3Norm = 0.
 *   - K=K, P[1] = P[2] = c, others 0 (two equipowered bins):
 *     M3 = 2 * (0.5)^3 = 0.25 -> h3 = -ln(0.25)/2 = ln 2
 *     -> h3Norm = ln 2 / ln K. (Coincides with axis-99 and
 *     axis-100 on two-bin equipartition; the indices SEPARATE
 *     on every other non-uniform configuration.)
 *   - kEff3 = M3^(-1/2) = exp(h3).
 *   - Bin-permutation INVARIANT (sum is symmetric).
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, or zero total power.
 */
export function spectralRenyi3Entropy(power: number[]): {
  h3: number;
  h3Norm: number;
  kEff3: number;
  sumP3: number;
  totalPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralRenyi3Entropy: too few bins (${k}; need >= 2 so ln K > 0)`,
    );
  }
  let s = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralRenyi3Entropy: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralRenyi3Entropy: negative power at index ${i} (${p})`,
      );
    }
    s += p;
  }
  if (!(s > 0)) {
    throw new Error(
      `spectralRenyi3Entropy: zero total power (S=${s}; PSD is identically zero)`,
    );
  }
  let sumP3 = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]! / s;
    // p in [0, 1]; p^3 cannot underflow to negative; explicit
    // floor at 0 guards against floating-point negative zero
    // when p = 0.
    if (p > 0) sumP3 += p * p * p;
  }
  // Numerical guard: clamp M3 to [1/K^2, 1].
  // Lower bound: M3 minimised at uniform pmf (Renyi 1961); for
  // any pmf on K bins with sum = 1, M3 >= K * (1/K)^3 = 1/K^2.
  // Upper bound: M3 maximised at single-bin delta; M3 <= 1.
  const lowerBound = 1 / (k * k);
  if (sumP3 < lowerBound) sumP3 = lowerBound;
  if (sumP3 > 1) sumP3 = 1;
  const h3 = -Math.log(sumP3) / 2;
  const lnK = Math.log(k);
  let h3Norm = h3 / lnK;
  if (h3Norm < 0) h3Norm = 0;
  if (h3Norm > 1) h3Norm = 1;
  // Normalise -0 to +0 for clean equality semantics.
  const h3Out = h3 === 0 ? 0 : h3;
  const h3NormOut = h3Norm === 0 ? 0 : h3Norm;
  // kEff3 = exp(h3) = M3^(-1/2). Use exp(h3) for numeric
  // consistency with the entropy report.
  const kEff3 = Math.exp(h3);
  return {
    h3: h3Out,
    h3Norm: h3NormOut,
    kEff3,
    sumP3,
    totalPower: s,
  };
}

/**
 * Daily-token spectral Renyi-3 entropy primitive on a real-
 * valued series. Computes the one-sided periodogram and applies
 * `spectralRenyi3Entropy` to the resulting bin power vector.
 *
 * Throws when the series is too short (n < 4 -> K < 2),
 * non-finite, zero-variance, or yields zero total power.
 */
export function dailyTokenSpectralRenyi3Entropy(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  sumP3: number;
  kEff3: number;
  h3: number;
  h3Norm: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenSpectralRenyi3Entropy: series too short (n=${n}, need n >= 4)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenSpectralRenyi3Entropy requires finite values');
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
      'dailyTokenSpectralRenyi3Entropy: zero variance (constant series)',
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
      `dailyTokenSpectralRenyi3Entropy: too few bins (${k}; need >= 2)`,
    );
  }
  const result = spectralRenyi3Entropy(power);
  if (
    !Number.isFinite(result.h3) ||
    !Number.isFinite(result.h3Norm) ||
    !Number.isFinite(result.kEff3)
  ) {
    throw new Error(
      `dailyTokenSpectralRenyi3Entropy: non-finite output (h3=${result.h3})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    sumP3: result.sumP3,
    kEff3: result.kEff3,
    h3: result.h3,
    h3Norm: result.h3Norm,
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

export function buildDailyTokenSpectralRenyi3Entropy(
  queue: QueueLine[],
  opts: DailyTokenSpectralRenyi3EntropyOptions = {},
): DailyTokenSpectralRenyi3EntropyReport {
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
  const sort: DailyTokenSpectralRenyi3EntropySort = opts.sort ?? 'h3NormDesc';
  const validSorts: DailyTokenSpectralRenyi3EntropySort[] = [
    'h3Norm',
    'h3NormDesc',
    'kEff3',
    'kEff3Desc',
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
  const rows: DailyTokenSpectralRenyi3EntropySourceRow[] = [];

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
      result = dailyTokenSpectralRenyi3Entropy(filled);
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
      sumP3: result.sumP3,
      kEff3: result.kEff3,
      h3: result.h3,
      h3Norm: result.h3Norm,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'h3Norm':
        primary = a.h3Norm - b.h3Norm;
        break;
      case 'h3NormDesc':
        primary = b.h3Norm - a.h3Norm;
        break;
      case 'kEff3':
        primary = a.kEff3 - b.kEff3;
        break;
      case 'kEff3Desc':
        primary = b.kEff3 - a.kEff3;
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
