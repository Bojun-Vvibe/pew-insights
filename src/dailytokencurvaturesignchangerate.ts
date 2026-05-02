/**
 * daily-token-curvature-sign-change-rate: per-source rate of
 * sign changes in the SECOND difference of the gap-filled daily
 * total_tokens series.
 *
 * EIGHTY-SECOND cross-source axis.
 *
 * Operationally: form d2[i] = y[i+1] - 2*y[i] + y[i-1] for
 * i in [1, N-2]. The second difference is the discrete analogue of
 * the second derivative; its sign changes mark INFLECTION POINTS
 * of the underlying daily-token curve. We count adjacent pairs of
 * d2 entries whose signs differ (zeros are ignored as in axis-76)
 * and normalise by the maximum possible such pairs (N-3) so the
 * result lives in [0, 1].
 *
 *   csc_rate = (number of sign changes in d2) / (N - 3)
 *
 * For each source we also surface a "white-noise reference"
 * comparison: the expected fraction of sign changes in d2 of an
 * iid white-noise series approaches 2/3 in the long-N limit
 * (because the first difference of iid noise is itself coloured
 * MA(1) with negative lag-1 correlation, and its sign-change rate
 * converges to 2/3). So `csc_rate / (2/3)` is a unitless ratio
 * with reference value 1 for white-noise-like behaviour.
 *
 * REFERENCES (sign-changes of the second difference / discrete
 * Laplacian zero-crossings):
 *
 *   Bracewell, R. N., "The Fourier Transform and Its Applications",
 *     McGraw-Hill, 1965 (chap. on zero-crossings of derivatives).
 *   Marr, D., Hildreth, E., "Theory of edge detection", Proc. R.
 *     Soc. Lond. B 207:187-217, 1980 (zero-crossings of the
 *     Laplacian as the canonical second-order edge primitive).
 *   Kedem, B., "Spectral analysis and discrimination by
 *     zero-crossings", Proc. IEEE 74(11):1477-1493, 1986
 *     (general theory of higher-order zero-crossing counts and
 *     their relation to spectral content).
 *
 * STRUCTURAL ORTHOGONALITY -- SECOND-ORDER SIGN-CHANGE PRIMITIVE,
 * fundamentally distinct from every shipped daily-token axis 32..81:
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD counts sign
 *     changes in the FIRST difference d1 = diff(y); CSC counts
 *     sign changes in the SECOND difference d2 = diff(diff(y)).
 *     A pure linear ramp y[n] = a*n + b has d1 of constant sign
 *     (PFD = 0) AND d2 = 0 (CSC undefined); a pure parabola
 *     y[n] = n^2 has d1 strictly increasing (PFD = 0) BUT d2
 *     constant (CSC = 0); a pure cubic y[n] = n^3 has d1 of
 *     constant sign for n > 0 (PFD = 0) BUT d2 strictly
 *     increasing through zero (CSC > 0 once). PFD and CSC can
 *     therefore split sharply on the same series. Empirically
 *     the two indicators are not strictly comparable: a series
 *     can have low PFD (smooth monotonic trend) and high CSC
 *     (many local curvature reversals), or vice versa.
 *
 *   - vs `daily-token-teager-kaiser-energy` (axis 81): TKE is a
 *     QUADRATIC magnitude-aware operator on triplets
 *     (y[i-1], y[i], y[i+1]); CSC is a BINARY magnitude-blind
 *     count of sign disagreements between consecutive d2 values
 *     (which involve four consecutive y samples through the
 *     overlap of the i and i+1 d2 windows). Two series with
 *     identical TKE can have arbitrarily different CSC because
 *     CSC throws away every magnitude.
 *
 *   - vs `daily-token-hjorth-mobility` (axis 79) / `daily-token-
 *     hjorth-complexity` (axis 80): Hjorth axes are GLOBAL
 *     ratios of three sample VARIANCES; CSC is a LOCAL count
 *     normalised by N. Sign-changes of d2 are a topological
 *     feature; variance ratios are second-moment summaries.
 *
 *   - vs box-count FD (78) / Sevcik FD (77) / Katz FD (75) /
 *     Higuchi FD (74): path-length / coverage geometric ratios
 *     in (n, y) space. CSC is a count, not a length, and uses
 *     no time-axis scaling.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): multi-scale variance scaling on
 *     CUMULATIVE deviations. CSC is single-scale, uses the
 *     RAW second difference, and counts a topological event.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69) and the
 *     autocorrelation axes 67/68: linear / Fourier summaries
 *     of the FULL power spectrum vs a high-frequency-biased
 *     count. CSC is most sensitive to power above the spectral
 *     "shoulder" because the second-difference filter has
 *     transfer function |H(omega)|^2 = (2 - 2*cos(omega))^2,
 *     a sharp high-pass.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) / `daily-
 *     token-sample-entropy` (axis 73): pattern / template
 *     statistics on ordinal patterns. CSC operates directly on
 *     the second-difference SIGNS of consecutive samples and
 *     does not embed in a higher-dimensional state space.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32-67:
 *     they are SHUFFLE-INVARIANT. CSC is SHUFFLE-SENSITIVE
 *     because the second difference depends on the ordering of
 *     three consecutive samples.
 *
 * INVARIANCES of csc_rate:
 *   - SHIFT: d2[i] = y[i+1] - 2*y[i] + y[i-1]; adding a constant
 *     c to every y leaves d2 unchanged, so CSC is shift-INVARIANT.
 *   - LINEAR-TREND: d2 of a linear ramp is identically 0; adding a
 *     linear trend a*n + b to y leaves d2 unchanged, so CSC is
 *     linear-trend-INVARIANT (a property axes 74/75/77/78/79/80/81
 *     do NOT all share).
 *   - SCALE: d2 is linear in y, but CSC only consumes its sign,
 *     so multiplying y by k != 0 leaves CSC unchanged. CSC is
 *     fully SCALE-INVARIANT (independent of |k|).
 *   - SIGN-FLIP: d2 negates under y -> -y, but again CSC only
 *     consumes the sign of pairs (d2[i], d2[i+1]); both flip
 *     together, so the COUNT of sign disagreements is preserved.
 *     CSC is SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL: d2 is symmetric in i-1 and i+1, so reversing
 *     the series reverses the d2 sequence end-for-end without
 *     changing it, and the count of adjacent sign disagreements
 *     is preserved. CSC is TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: not invariant by construction (the i-1 / i / i+1
 *     stencil supplies the curvature information).
 */
import type { QueueLine } from './types.js';

export type DailyTokenCurvatureSignChangeRateSort =
  | 'absDeviationFromWhiteDesc'
  | 'cscRate'
  | 'cscRateDesc'
  | 'cscNormalized'
  | 'cscNormalizedDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCurvatureSignChangeRateOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 5 so that
   * d2 has at least 3 entries (N-2 >= 3) and the count of
   * adjacent sign-change pairs (N-3) is at least 2.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCurvatureSignChangeRateSort;
  generatedAt?: string;
}

export interface DailyTokenCurvatureSignChangeRateSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Number of adjacent sign-change pairs in d2. */
  signChanges: number;
  /** Number of comparable adjacent d2 pairs (= N - 3). */
  comparablePairs: number;
  /** signChanges / comparablePairs, in [0, 1]. */
  cscRate: number;
  /** cscRate / (2/3), white-noise-reference-normalised. */
  cscNormalized: number;
}

export interface DailyTokenCurvatureSignChangeRateReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCurvatureSignChangeRateSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteCsc: number;
  droppedTopSources: number;
  sources: DailyTokenCurvatureSignChangeRateSourceRow[];
}

/**
 * Curvature sign-change rate on a real-valued series.
 *
 * Returns the count of adjacent sign-change pairs in the second
 * difference, the number of comparable pairs (N - 3), the rate
 * in [0, 1], and the white-noise-reference-normalised rate
 * (rate / (2/3)).
 *
 * Sign-change convention (matches axis-76 Petrosian): a pair
 * (d2[i], d2[i+1]) counts as a sign change iff
 * `d2[i] * d2[i+1] < 0`. Zero entries are treated as neither
 * positive nor negative and never participate in a sign change
 * (they break runs without contributing).
 *
 * Throws when the series is too short (n < 5 -- need >= 2
 * comparable d2 pairs), when a non-finite value is present, or
 * when var(y) collapses to 0 (constant series).
 */
export function curvatureSignChangeRate(values: number[]): {
  signChanges: number;
  comparablePairs: number;
  cscRate: number;
  cscNormalized: number;
} {
  const N = values.length;
  if (N < 5) {
    throw new Error(
      `curvatureSignChangeRate: series too short (n=${N}, need n >= 5)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('curvatureSignChangeRate requires finite values');
    }
  }
  // Reject constant series (variance check kept for parity with the
  // primitive-level guards in axes 74..81; a constant series has
  // d2 identically 0 and would otherwise yield 0/0).
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < N; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error('curvatureSignChangeRate: zero variance (constant series)');
  }

  // d2[i] = y[i+1] - 2*y[i] + y[i-1] for i in [1, N-2]; d2 has
  // length N - 2.
  const d2Len = N - 2;
  const d2: number[] = new Array(d2Len);
  for (let i = 1; i <= N - 2; i += 1) {
    d2[i - 1] = values[i + 1]! - 2 * values[i]! + values[i - 1]!;
  }

  const comparablePairs = d2Len - 1; // = N - 3
  let signChanges = 0;
  for (let i = 0; i < comparablePairs; i += 1) {
    const a = d2[i]!;
    const b = d2[i + 1]!;
    if (a * b < 0) signChanges += 1;
  }
  const cscRate = signChanges / comparablePairs;
  const cscNormalized = cscRate / (2 / 3);

  if (!Number.isFinite(cscRate) || !Number.isFinite(cscNormalized)) {
    throw new Error(
      `curvatureSignChangeRate: non-finite result (cscRate=${cscRate}, cscNormalized=${cscNormalized})`,
    );
  }
  return { signChanges, comparablePairs, cscRate, cscNormalized };
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

export function buildDailyTokenCurvatureSignChangeRate(
  queue: QueueLine[],
  opts: DailyTokenCurvatureSignChangeRateOptions = {},
): DailyTokenCurvatureSignChangeRateReport {
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
  const sort: DailyTokenCurvatureSignChangeRateSort =
    opts.sort ?? 'absDeviationFromWhiteDesc';
  const validSorts: DailyTokenCurvatureSignChangeRateSort[] = [
    'absDeviationFromWhiteDesc',
    'cscRate',
    'cscRateDesc',
    'cscNormalized',
    'cscNormalizedDesc',
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
  let droppedNonFiniteCsc = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenCurvatureSignChangeRateSourceRow[] = [];

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
      result = curvatureSignChangeRate(filled);
    } catch {
      droppedNonFiniteCsc += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      signChanges: result.signChanges,
      comparablePairs: result.comparablePairs,
      cscRate: result.cscRate,
      cscNormalized: result.cscNormalized,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'cscRate':
        primary = a.cscRate - b.cscRate;
        break;
      case 'cscRateDesc':
        primary = b.cscRate - a.cscRate;
        break;
      case 'cscNormalized':
        primary = a.cscNormalized - b.cscNormalized;
        break;
      case 'cscNormalizedDesc':
        primary = b.cscNormalized - a.cscNormalized;
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
      case 'absDeviationFromWhiteDesc':
      default:
        // Surface sources whose csc rate deviates farthest from the
        // white-noise reference 2/3: both unusually-curvy and
        // unusually-smooth sources rise to the top.
        primary =
          Math.abs(b.cscRate - 2 / 3) - Math.abs(a.cscRate - 2 / 3);
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
    droppedNonFiniteCsc,
    droppedTopSources,
    sources: kept,
  };
}
