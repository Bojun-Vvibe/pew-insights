/**
 * daily-token-spectral-renyi-half-entropy: per-source SPECTRAL
 * RENYI-ALPHA=0.5 (HARTLEY-STYLE) ENTROPY -- twice the natural
 * log of the sum of SQUARE-ROOTS of the normalised bin
 * probabilities of the one-sided non-DC periodogram of the
 * gap-filled mean-centred daily total_tokens series, normalised
 * by ln(K) into [0, 1].
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 2, define the normalised power
 * distribution
 *
 *   S            = sum_{k=1..K} P[k]                (must be > 0)
 *   p[k]         = P[k] / S                         in [0, 1]
 *   T            = sum_{k=1..K} sqrt(p[k])          in [1, sqrt K]
 *   Hhalf        = 2 * ln(T)                        in [0, ln K]
 *   hHalfNorm    = Hhalf / ln K                     in [0, 1]
 *
 * Equivalently, kEffHalf = T^2 = exp(Hhalf) is the EFFECTIVE
 * NUMBER OF SPECTRAL BINS UNDER ALPHA=0.5 WEIGHTING. So
 *
 *   hHalfNorm = ln(kEffHalf) / ln(K)
 *
 * ONE-HUNDREDTH cross-source axis. This is a Class-EN
 * (RENYI-ENTROPY-ALPHA=0.5) primitive -- the FIRST primitive
 * in the suite that uses an ALPHA=0.5 (sub-Shannon, super-
 * Hartley) Renyi entropy on the SPECTRAL distribution.
 * Structurally distinct from axis-99 (Renyi-alpha=2 collision
 * entropy on the same PSD) because alpha=0.5 weights LOW-MASS
 * bins (the sqrt is concave and amplifies small p[k]) while
 * alpha=2 weights HIGH-MASS bins (the square is convex and
 * amplifies large p[k]). The two indices have OPPOSITE TAIL
 * SENSITIVITY and therefore order spectra with the same
 * Shannon entropy in OPPOSITE directions when the deviation
 * from uniform is tail-asymmetric.
 *
 * The Renyi-0.5 vs Renyi-2 vs Shannon distinction matters:
 *   - Renyi-0.5 weights bins SUB-LINEARLY (sum sqrt(p)), so
 *     it is dominated by the MANY SMALL bins; it is the
 *     canonical "rare-event" / "tail-mass" entropy. A spectrum
 *     with a long flat low-power tail and one sharp peak has
 *     LARGE Renyi-0.5 (the tail mass survives the sqrt) yet
 *     SMALL Renyi-2 (the peak dominates the square).
 *   - Shannon (alpha=1) is the geometric-mean midpoint;
 *     equality H_alpha = H_Shannon holds only in the alpha->1
 *     limit and only on uniform distributions universally.
 *   - Renyi-2 weights bins SUPER-LINEARLY (sum p^2), so it is
 *     dominated by the LARGEST bins.
 *
 * READING:
 *
 *   - hHalfNorm ~ 1 -- the spectrum is nearly EQUIPOWERED
 *     across all bins (white-noise-like; effective bin count
 *     under alpha=0.5 weighting ~ K).
 *   - hHalfNorm ~ 0 -- the spectrum is concentrated on a
 *     SINGLE bin (delta-like; effective bin count ~ 1).
 *   - kEffHalf = exp(Hhalf) gives a direct interpretation:
 *     "how many bins effectively carry the mass under sqrt
 *     weighting", a number that is ALWAYS >= kEff (axis-99)
 *     because Renyi entropy is monotonically NON-INCREASING
 *     in alpha (Renyi 1961, Theorem 4).
 *
 * BOUND: hHalfNorm in [0, 1] exactly. hHalfNorm = 1 iff
 * p[k] = 1/K for all k (uniform PSD); hHalfNorm -> 0 as one
 * bin's share approaches 1.
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
 *   - BIN-PERMUTATION: sum sqrt(p) is symmetric, so
 *     hHalfNorm IS bin-permutation-invariant. Same structural
 *     contrast with axis-98 (sub-band tail-flatness) as
 *     axis-99 carries.
 *   - BIN-REVERSAL k -> K + 1 - k: a special case of bin-
 *     permutation. INVARIANT.
 *
 * ORDERING IDENTITY (Renyi 1961): for any non-uniform p,
 *
 *   H_{0.5} > H_1 (Shannon) > H_2 (axis-99)                 (*)
 *
 * with equality at all alphas iff p is uniform. Therefore
 * hHalfNorm >= h_Shannon_norm (axis-69) >= h2Norm (axis-99)
 * with equality iff uniform; the GAP hHalfNorm - h2Norm is a
 * non-trivial TAIL-ASYMMETRY diagnostic that this axis
 * exposes via its normalised form.
 *
 * REFERENCES:
 *
 *   Renyi, A., "On measures of entropy and information",
 *     Proc. 4th Berkeley Symp. on Math. Stat. & Probab.,
 *     vol. 1 (1961) pp. 547-561 -- the original alpha-family;
 *     Theorem 4 establishes monotonicity of H_alpha in alpha.
 *   Hartley, R. V. L., "Transmission of information",
 *     Bell System Technical Journal 7 (1928) pp. 535-563 --
 *     the alpha->0 limit, log-of-support.
 *   Beck, C. and Schloegl, F., "Thermodynamics of Chaotic
 *     Systems", Cambridge University Press (1993) Ch. 6 --
 *     Renyi entropies as moments of the probability vector.
 *   Tsallis, C., "Possible generalization of Boltzmann-Gibbs
 *     statistics", J. Stat. Phys. 52 (1988) pp. 479-487 --
 *     Tsallis q=0.5 entropy is monotonically equivalent to
 *     Renyi-0.5 here.
 *
 * STRUCTURAL ORTHOGONALITY -- a HALF-ORDER (sub-linear, sqrt-
 * weighted) entropy descriptor on the FULL-BAND normalised
 * PSD, distinct from every shipped daily-token axis 32..99:
 *
 *   - vs `daily-token-spectral-renyi2-entropy` (axis 99):
 *     PRIMARY orthogonality target. Axis-99 is alpha=2
 *     (sum p^2, peak-weighted, INVERSE participation ratio
 *     IPR^-1). Axis-100 is alpha=0.5 (sum sqrt p, tail-
 *     weighted, sqrt-effective bin count). They are EQUAL on
 *     a uniform PSD (both = 1) and on a single-bin delta
 *     (both = 0); for every intermediate non-uniform PSD they
 *     give a DIFFERENT real value, with hHalfNorm > h2Norm
 *     ALWAYS strict (Renyi 1961, monotonicity of H_alpha in
 *     alpha). Counter-example showcasing the orthogonality:
 *     consider K = 16 with p[1] = 0.85 and p[2..16] = 0.01 each
 *     (one big peak + 15 equal tiny bins). Then sumP2 ~ 0.7239
 *     so kEff ~ 1.38 (axis-99 sees it as essentially a
 *     single bin); but T = sqrt(0.85) + 15*sqrt(0.01) =
 *     0.9220 + 1.5 = 2.4220, so kEffHalf = T^2 ~ 5.87 (axis-100
 *     sees it as effectively six bins). The ratio kEffHalf/
 *     kEff ~ 4.25 quantifies tail-asymmetry: large ratio
 *     means the spectrum has broad tail mass under one big
 *     peak; ratio ~ 1 means roughly uniform.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): axis-69 is
 *     SHANNON entropy (alpha = 1). By Renyi's theorem
 *     hHalfNorm >= h_Shannon_norm with equality iff uniform;
 *     they coincide on uniform spectra and depart on every
 *     non-uniform one. The GAP hHalfNorm - h_Shannon_norm is
 *     a tail-mass concentration diagnostic distinct from the
 *     gap h_Shannon_norm - h2Norm (axis-99) which is a peak-
 *     mass concentration diagnostic.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85):
 *     axis-85 is the GM/AM ratio (alpha->0 limit, Hartley-
 *     style log-of-geometric-mean). Algebraically log(GM/AM)
 *     is the alpha=0 Renyi (per the limit definition). Axis-
 *     100 is alpha=0.5, strictly between Hartley and Shannon.
 *     Two PSDs with the same GM/AM can have different sum
 *     sqrt(p) -- e.g. a 2-bin equipartition vs a 4-bin
 *     equipartition share GM/AM = 1 on the positive subset
 *     but kEffHalf = 2 vs 4.
 *
 *   - vs `daily-token-spectral-flatness-tail` (axis 98):
 *     axis-98 is GM/AM RESTRICTED to the upper-half subset.
 *     Axis-100 is FULL-BAND sqrt-weighted entropy, bin-
 *     permutation-invariant. Permuting the same multiset
 *     between head and tail leaves axis-100 unchanged while
 *     axis-98 swings.
 *
 *   - vs `daily-token-spectral-second-peak-frequency` (axis
 *     97), `-peak-frequency` (axis 96), `-roughness` (axis 95),
 *     `-spread-iqr` (axis 94), `-irregularity` (axis 93),
 *     `-decrease` (axis 92): each of these is bin-position-
 *     SENSITIVE in a way that axis-100 (a sqrt-moment of the
 *     pmf vector) is not. A sorted-descending PSD vs the
 *     same multiset reverse-sorted has identical hHalfNorm
 *     but dramatically different roughness, decrease,
 *     irregularity, IQR, peak indices.
 *
 *   - vs `daily-token-spectral-bandwidth/skewness/kurtosis`
 *     (axes 87/90/91): each is a CENTROID-RELATIVE central
 *     moment computed on the bin-INDEX axis (mass-weighted
 *     positions). Axis-100 is a moment of the PROBABILITY
 *     VECTOR p, not of the bin-index axis -- two PSDs with
 *     the same bandwidth can have very different sqrt-
 *     weighted concentration.
 *
 *   - vs `daily-token-spectral-centroid` (axis 86): centroid
 *     is a FIRST RAW MOMENT (mass-weighted bin index). Axis-
 *     100 is independent of bin index.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88): rolloff is
 *     a CDF QUANTILE BIN INDEX. Axis-100 is a sub-linear
 *     concentration scalar with no quantile structure.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89): crest
 *     is the PEAK-TO-MEAN RATIO of the FULL band, max p / mean
 *     p, an L-infinity / L1 ratio. Axis-100 is a SQRT-SUM /
 *     L1 ratio (since sum p = 1 by construction). Same
 *     family of "spikiness" descriptors but different norms;
 *     they coincide only on degenerate spectra (uniform or
 *     single-bin) and decouple on the middle ground.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84): beta is
 *     a global LOG-LOG SLOPE fit. A 1/f spectrum has beta = -1
 *     and hHalfNorm depending on K (sub-linear effective bin
 *     count grows differently from quadratic kEff); a flat
 *     spectrum has beta = 0 and hHalfNorm = 1.
 *
 *   - vs all permutation-invariant TIME-DOMAIN amplitude-shape
 *     axes 32-67: those operate on the time-domain shuffle-
 *     invariant statistic of the daily series. Axis-100 here
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

export type DailyTokenSpectralRenyiHalfEntropySort =
  | 'hHalfNorm'
  | 'hHalfNormDesc'
  | 'kEffHalf'
  | 'kEffHalfDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralRenyiHalfEntropyOptions {
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
  sort?: DailyTokenSpectralRenyiHalfEntropySort;
  generatedAt?: string;
}

export interface DailyTokenSpectralRenyiHalfEntropySourceRow {
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
  /** sum_{k=1..K} sqrt(p[k]) in [1, sqrt K]. */
  sumSqrtP: number;
  /** Effective bin count under alpha=0.5 = sumSqrtP^2 in [1, K]. */
  kEffHalf: number;
  /** Renyi-0.5 entropy in nats: 2*ln(sumSqrtP) in [0, ln K]. */
  hHalf: number;
  /** Renyi-0.5 entropy normalised by ln(K), in [0, 1]. */
  hHalfNorm: number;
}

export interface DailyTokenSpectralRenyiHalfEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpectralRenyiHalfEntropySort;
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
  sources: DailyTokenSpectralRenyiHalfEntropySourceRow[];
}

/**
 * Spectral Renyi-0.5 (Hartley-style) entropy primitive on a
 * non-negative power vector indexed by k = 1..power.length.
 * Returns the entropy in nats, the alpha=0.5 effective bin
 * count, the sum of square-roots of normalised probabilities,
 * and the normalised entropy in [0, 1] (divided by ln K).
 *
 * Closed-form sanity anchors:
 *   - K=K, P[k] = c (uniform): p[k] = 1/K -> sumSqrtP = sqrt K
 *     -> hHalf = ln K -> hHalfNorm = 1.
 *   - K=K, P[1] = c, others 0: p[1] = 1, sqrt others 0
 *     -> sumSqrtP = 1 -> hHalf = 0 -> hHalfNorm = 0.
 *   - K=K, P[1] = P[2] = c, others 0 (two equipowered bins):
 *     sumSqrtP = 2 * sqrt(0.5) = sqrt 2
 *     -> hHalf = 2 * ln(sqrt 2) = ln 2
 *     -> hHalfNorm = ln 2 / ln K. (Same as axis-99 on the
 *     two-bin equipartition; the indices SEPARATE on every
 *     other non-uniform configuration.)
 *   - kEffHalf = sumSqrtP^2 = exp(hHalf).
 *   - Bin-permutation INVARIANT (sum is symmetric).
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, or zero total power.
 */
export function spectralRenyiHalfEntropy(power: number[]): {
  hHalf: number;
  hHalfNorm: number;
  kEffHalf: number;
  sumSqrtP: number;
  totalPower: number;
} {
  const k = power.length;
  if (k < 2) {
    throw new Error(
      `spectralRenyiHalfEntropy: too few bins (${k}; need >= 2 so ln K > 0)`,
    );
  }
  let s = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `spectralRenyiHalfEntropy: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `spectralRenyiHalfEntropy: negative power at index ${i} (${p})`,
      );
    }
    s += p;
  }
  if (!(s > 0)) {
    throw new Error(
      `spectralRenyiHalfEntropy: zero total power (S=${s}; PSD is identically zero)`,
    );
  }
  let sumSqrtP = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]! / s;
    sumSqrtP += Math.sqrt(p);
  }
  // Numerical guard: clamp sumSqrtP to its valid range [1, sqrt K].
  const sqrtK = Math.sqrt(k);
  if (sumSqrtP > sqrtK) sumSqrtP = sqrtK;
  if (sumSqrtP < 1) sumSqrtP = 1;
  const hHalf = 2 * Math.log(sumSqrtP);
  const lnK = Math.log(k);
  let hHalfNorm = hHalf / lnK;
  if (hHalfNorm < 0) hHalfNorm = 0;
  if (hHalfNorm > 1) hHalfNorm = 1;
  // Normalise -0 to +0 for clean equality semantics.
  const hHalfOut = hHalf === 0 ? 0 : hHalf;
  const hHalfNormOut = hHalfNorm === 0 ? 0 : hHalfNorm;
  const kEffHalf = sumSqrtP * sumSqrtP;
  return {
    hHalf: hHalfOut,
    hHalfNorm: hHalfNormOut,
    kEffHalf,
    sumSqrtP,
    totalPower: s,
  };
}

/**
 * Daily-token spectral Renyi-0.5 entropy primitive on a real-
 * valued series. Computes the one-sided periodogram and
 * applies `spectralRenyiHalfEntropy` to the resulting bin
 * power vector.
 *
 * Throws when the series is too short (n < 4 -> K < 2),
 * non-finite, zero-variance, or yields zero total power.
 */
export function dailyTokenSpectralRenyiHalfEntropy(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  sumSqrtP: number;
  kEffHalf: number;
  hHalf: number;
  hHalfNorm: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenSpectralRenyiHalfEntropy: series too short (n=${n}, need n >= 4)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSpectralRenyiHalfEntropy requires finite values',
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
      'dailyTokenSpectralRenyiHalfEntropy: zero variance (constant series)',
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
      `dailyTokenSpectralRenyiHalfEntropy: too few bins (${k}; need >= 2)`,
    );
  }
  const result = spectralRenyiHalfEntropy(power);
  if (
    !Number.isFinite(result.hHalf) ||
    !Number.isFinite(result.hHalfNorm) ||
    !Number.isFinite(result.kEffHalf)
  ) {
    throw new Error(
      `dailyTokenSpectralRenyiHalfEntropy: non-finite output (hHalf=${result.hHalf})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: k,
    totalPower: result.totalPower,
    sumSqrtP: result.sumSqrtP,
    kEffHalf: result.kEffHalf,
    hHalf: result.hHalf,
    hHalfNorm: result.hHalfNorm,
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

export function buildDailyTokenSpectralRenyiHalfEntropy(
  queue: QueueLine[],
  opts: DailyTokenSpectralRenyiHalfEntropyOptions = {},
): DailyTokenSpectralRenyiHalfEntropyReport {
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
  const sort: DailyTokenSpectralRenyiHalfEntropySort =
    opts.sort ?? 'hHalfNormDesc';
  const validSorts: DailyTokenSpectralRenyiHalfEntropySort[] = [
    'hHalfNorm',
    'hHalfNormDesc',
    'kEffHalf',
    'kEffHalfDesc',
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
  const rows: DailyTokenSpectralRenyiHalfEntropySourceRow[] = [];

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
      result = dailyTokenSpectralRenyiHalfEntropy(filled);
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
      sumSqrtP: result.sumSqrtP,
      kEffHalf: result.kEffHalf,
      hHalf: result.hHalf,
      hHalfNorm: result.hHalfNorm,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hHalfNorm':
        primary = a.hHalfNorm - b.hHalfNorm;
        break;
      case 'hHalfNormDesc':
        primary = b.hHalfNorm - a.hHalfNorm;
        break;
      case 'kEffHalf':
        primary = a.kEffHalf - b.kEffHalf;
        break;
      case 'kEffHalfDesc':
        primary = b.kEffHalf - a.kEffHalf;
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
