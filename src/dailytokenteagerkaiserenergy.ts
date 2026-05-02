/**
 * daily-token-teager-kaiser-energy: per-source mean Teager-Kaiser
 * Energy Operator (Kaiser, J. F., "On a simple algorithm to
 * calculate the 'energy' of a signal", ICASSP-90, pp. 381-384,
 * 1990) on the gap-filled daily total_tokens series.
 *
 * EIGHTY-FIRST cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75/76/77/78/
 * 79/80).
 *
 * Teager-Kaiser Energy Operator (TKEO) procedure:
 *
 *   1. For each interior index i in [1, N-2]:
 *        psi[i] = y[i]^2 - y[i-1] * y[i+1]
 *
 *   2. tke_mean = (1 / (N-2)) * sum_{i=1}^{N-2} psi[i]
 *
 *   3. We additionally surface a normalised variant:
 *        tke_normalized = tke_mean / var(y)         (population var)
 *      so that two sources with very different overall amplitudes
 *      can be compared on the SHAPE of their instantaneous energy
 *      profile rather than absolute magnitude.
 *
 * Defaults: `min-tenure-days = 32`, `min-tokens = 1000`. The
 * minimum tenure floor of 5 ensures the interior triplet count
 * (N-2) is at least 3 for a stable TKE mean.
 *
 * Reading tke_normalized (unitless ratio of TKE to variance):
 *   - For a single tone y[n] = A * cos(omega*n + phi), Kaiser's
 *     1990 closed form gives psi[n] ~ A^2 * sin^2(omega), so the
 *     mean TKE concentrates instantaneous energy at a value
 *     proportional to BOTH amplitude squared AND the squared sine
 *     of the angular frequency. Dividing by var(y) = A^2/2 yields
 *     tke_normalized ~ 2 * sin^2(omega), a frequency-only quantity
 *     bounded in [0, 2].
 *   - tke_normalized close to 0       = very low local frequency
 *                                        content; the series moves
 *                                        slowly relative to its
 *                                        amplitude (smooth ramps,
 *                                        slow drifts).
 *   - tke_normalized close to 2       = very high local frequency
 *                                        content; sample-to-sample
 *                                        sign reversals dominate
 *                                        (Nyquist-rate behaviour).
 *   - tke_normalized greater than 2   = the local energy carried
 *                                        by amplitude/frequency
 *                                        coupling exceeds twice
 *                                        the static variance --
 *                                        only possible for non-
 *                                        stationary, locally
 *                                        amplitude-modulated
 *                                        bursts (typical for
 *                                        bursty token streams).
 *
 * Sign of tke_mean (raw, unnormalised):
 *   - tke_mean > 0  = the dominant local pattern is "amplitude
 *                     squared exceeds the product of neighbours"
 *                     (typical for oscillatory or burst-rich
 *                     content).
 *   - tke_mean < 0  = the dominant local pattern is "neighbour
 *                     product exceeds local amplitude squared"
 *                     (typical for monotone trends where y[i-1]
 *                     and y[i+1] both flank a smaller y[i] less
 *                     than they reach themselves -- e.g. dips at
 *                     the centre of a triplet).
 *
 * INVARIANCES of tke_mean:
 *   - SCALE: psi[n] is QUADRATIC in y, so multiplying y by k
 *     scales tke_mean by k^2. The normalised variant divides
 *     by var(y) which also scales by k^2, so tke_normalized is
 *     scale-invariant.
 *   - SHIFT: TKE is NOT shift-invariant in general. Adding a
 *     constant c to y inserts a c * (2*y - y_prev - y_next) cross-
 *     term. Token-mass series are anchored at 0 (an absent day
 *     means 0 tokens), so the natural baseline is the raw signal
 *     without re-centering, which is what we use.
 *   - SIGN-FLIP: TKE is sign-flip-INVARIANT (every term is even-
 *     order in the sign of y).
 *   - TIME-REVERSAL: TKE is time-reversal-INVARIANT (psi depends
 *     symmetrically on the i-1 and i+1 neighbours).
 *
 * STRUCTURAL ORTHOGONALITY -- INSTANTANEOUS-ENERGY OPERATOR
 * (an A^2 * omega^2 quantity that simultaneously captures local
 * amplitude AND local frequency from three consecutive samples),
 * fundamentally distinct from every shipped daily-token axis
 * 32..80:
 *
 *   - vs `daily-token-hjorth-complexity` (axis 80) and
 *     `daily-token-hjorth-mobility` (axis 79): both are GLOBAL
 *     ratios of three sample variances over the entire series.
 *     TKE is a LOCAL operator -- psi[i] depends only on three
 *     consecutive samples (y[i-1], y[i], y[i+1]) and the result
 *     we report is the time-AVERAGE of that local quantity.
 *     Two series with identical Hjorth mobility AND complexity
 *     can have arbitrarily different mean TKE because the
 *     averaging order matters (mean of products vs ratio of
 *     means of squares of differences). Sign of tke_mean is
 *     also informative; mobility / complexity are strictly
 *     non-negative.
 *
 *   - vs `daily-token-box-count-fd` (axis 78) / Sevcik FD (77) /
 *     Katz FD (75) / Higuchi FD (74): path-length / coverage
 *     geometric ratios. TKE has no length, no grid, no coverage;
 *     it is a quadratic energy density.
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD counts SIGN
 *     CHANGES in diff(y) (binary, magnitude-blind). TKE is fully
 *     magnitude-aware and quadratic; the sign of psi[i] depends
 *     on whether |y[i]| exceeds the geometric mean of |y[i-1]|
 *     and |y[i+1]| (when all three share the same sign).
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): both are multi-scale variance scaling
 *     estimators on cumulative deviations. TKE is single-scale
 *     and operates on raw triplets with no cumulative transform.
 *
 *   - vs `daily-token-autocorrelation-lag1` (axis 67) and
 *     `daily-token-autocorrelation-lag7`: TKE is a NONLINEAR
 *     (quadratic) functional of triplets (y_{i-1}, y_i, y_{i+1});
 *     ACF is a strictly LINEAR cross-product. Two stationary
 *     series with identical lag-1 covariance can produce wildly
 *     different mean TKE because the operator weights local
 *     amplitude by local curvature.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     periodogram FLATNESS over all frequencies. TKE is a
 *     specific A^2 * omega^2 mean energy; on a single tone it
 *     reduces to A^2 * sin^2(omega), a function of frequency
 *     and amplitude jointly.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) / `daily-
 *     token-sample-entropy` (axis 73): pattern / template
 *     statistics on ordinal patterns or amplitude similarity.
 *     TKE is a quadratic real-valued operator with no embedding
 *     window beyond a fixed 3-sample stencil and no template
 *     matching.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32-67:
 *     they are SHUFFLE-INVARIANT. TKE is SHUFFLE-SENSITIVE
 *     because psi[i] depends on the local triplet ordering --
 *     reordering samples breaks the i-1 / i / i+1 relationship
 *     that supplies the operator's frequency information.
 *
 * REFERENCES:
 *   Kaiser, J. F., "On a simple algorithm to calculate the
 *     'energy' of a signal", Proc. IEEE ICASSP-90, pp. 381-384,
 *     Albuquerque, NM, April 1990.
 *   Maragos, P., Kaiser, J. F., Quatieri, T. F., "On amplitude
 *     and frequency demodulation using energy operators", IEEE
 *     Trans. Signal Processing 41(4):1532-1550, 1993.
 */
import type { QueueLine } from './types.js';

export type DailyTokenTeagerKaiserEnergySort =
  | 'absTkeNormalizedDesc'
  | 'tkeMean'
  | 'tkeMeanDesc'
  | 'tkeNormalized'
  | 'tkeNormalizedDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTeagerKaiserEnergyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 5 so the
   * interior-triplet count (N-2) is at least 3 for a stable mean.
   * Default 32 (matches axes 74/75/76/77/78/79/80).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenTeagerKaiserEnergySort;
  generatedAt?: string;
}

export interface DailyTokenTeagerKaiserEnergySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of psi[i] = y[i]^2 - y[i-1]*y[i+1] over interior. */
  tkeMean: number;
  /** tkeMean / var(y), unitless and scale-invariant. */
  tkeNormalized: number;
  /** Population variance of the gap-filled series (denominator). */
  varV: number;
  /** Number of interior triplets that contributed (N-2). */
  interiorSamples: number;
}

export interface DailyTokenTeagerKaiserEnergyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTeagerKaiserEnergySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteTke: number;
  droppedTopSources: number;
  sources: DailyTokenTeagerKaiserEnergySourceRow[];
}

/**
 * Teager-Kaiser Energy Operator mean on a real-valued series.
 * Returns the raw mean psi, the variance-normalised variant, the
 * population variance used for normalisation, and the interior
 * triplet count.
 *
 * Throws when the series is too short (n < 4 -- need >= 2 interior
 * triplets to take a stable mean), when a non-finite value is
 * present, or when var(y) collapses to 0 (constant series).
 */
export function teagerKaiserEnergy(values: number[]): {
  tkeMean: number;
  tkeNormalized: number;
  varV: number;
  interiorSamples: number;
} {
  const N = values.length;
  if (N < 4) {
    throw new Error(`teagerKaiserEnergy: series too short (n=${N}, need n >= 4)`);
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('teagerKaiserEnergy requires finite values');
    }
  }

  // population var(y).
  let sumV = 0;
  for (let i = 0; i < N; i += 1) sumV += values[i]!;
  const meanV = sumV / N;
  let varV = 0;
  for (let i = 0; i < N; i += 1) {
    const d = values[i]! - meanV;
    varV += d * d;
  }
  varV /= N;
  if (!(varV > 0)) {
    throw new Error('teagerKaiserEnergy: zero variance (constant series)');
  }

  // Kaiser TKEO: psi[i] = y[i]^2 - y[i-1] * y[i+1], i in [1, N-2].
  const interior = N - 2;
  let sumPsi = 0;
  for (let i = 1; i <= N - 2; i += 1) {
    const yi = values[i]!;
    const psi = yi * yi - values[i - 1]! * values[i + 1]!;
    sumPsi += psi;
  }
  const tkeMean = sumPsi / interior;
  const tkeNormalized = tkeMean / varV;

  if (!Number.isFinite(tkeMean) || !Number.isFinite(tkeNormalized)) {
    throw new Error(
      `teagerKaiserEnergy: non-finite result (tkeMean=${tkeMean}, tkeNormalized=${tkeNormalized})`,
    );
  }
  return { tkeMean, tkeNormalized, varV, interiorSamples: interior };
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

export function buildDailyTokenTeagerKaiserEnergy(
  queue: QueueLine[],
  opts: DailyTokenTeagerKaiserEnergyOptions = {},
): DailyTokenTeagerKaiserEnergyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 5) {
    throw new Error(
      `minTenureDays must be an integer >= 5 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenTeagerKaiserEnergySort =
    opts.sort ?? 'absTkeNormalizedDesc';
  const validSorts: DailyTokenTeagerKaiserEnergySort[] = [
    'absTkeNormalizedDesc',
    'tkeMean',
    'tkeMeanDesc',
    'tkeNormalized',
    'tkeNormalizedDesc',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedNonFiniteTke = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenTeagerKaiserEnergySourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
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
      result = teagerKaiserEnergy(filled);
    } catch {
      droppedNonFiniteTke += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      tkeMean: result.tkeMean,
      tkeNormalized: result.tkeNormalized,
      varV: result.varV,
      interiorSamples: result.interiorSamples,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tkeMean':
        primary = a.tkeMean - b.tkeMean;
        break;
      case 'tkeMeanDesc':
        primary = b.tkeMean - a.tkeMean;
        break;
      case 'tkeNormalized':
        primary = a.tkeNormalized - b.tkeNormalized;
        break;
      case 'tkeNormalizedDesc':
        primary = b.tkeNormalized - a.tkeNormalized;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absTkeNormalizedDesc':
      default:
        // Surface sources whose normalised TKE deviates farthest
        // from the white-noise reference value of 1: both unusually
        // burst-rich and unusually-smooth sources rise to the top.
        primary =
          Math.abs(b.tkeNormalized - 1) - Math.abs(a.tkeNormalized - 1);
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
    droppedNonFiniteTke,
    droppedTopSources,
    sources: kept,
  };
}
