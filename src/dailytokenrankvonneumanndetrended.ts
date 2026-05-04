/**
 * daily-token-rank-von-neumann-detrended: per-source
 * BARTELS RANK VON NEUMANN RATIO computed on the
 * MID-RANKS of the OLS-DETRENDED RESIDUALS of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTY-FOURTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure. Fit the
 * OLS LINEAR TREND
 *
 *     x_t  approx  a + b * t
 *
 * by closed-form moment estimators (identical to the
 * fit used in axis-162 daily-token-durbin-watson-
 * detrended and axis-163 daily-token-runs-test-
 * detrended). Form residuals
 *
 *     e_t = x_t - (a + b * t)        t = 0..n-1
 *
 * (sum e_t === 0 and sum t * e_t === 0 by OLS first-
 * and second-order conditions). Replace each residual
 * by its MID-RANK
 *
 *     R[t] = mid-rank of e_t in {1, 2, ..., n}
 *
 * (ties broken by AVERAGE rank). Let Rbar = (n + 1)/2.
 * Define the BARTELS RANK VON NEUMANN STATISTIC
 * (Bartels 1982 JASA 77(377):40-46) on the rank
 * sequence:
 *
 *     RVN = sum_{t=0..n-2} (R[t+1] - R[t])^2
 *           / sum_{t=0..n-1} (R[t] - Rbar)^2
 *
 * For untied ranks the denominator collapses to the
 * closed-form n*(n^2 - 1)/12. With ties (mid-rank) we
 * compute the empirical denominator. The asymptotic
 * null is
 *
 *     E[RVN]   = 2
 *     Var[RVN] = 4 * (n - 2) * (5*n^2 - 2*n - 9)
 *                / (5 * n * (n + 1) * (n - 1)^2)
 *              -> 4 / n              for large n
 *     RVN     ~  N(E, Var)           under iid null
 *     bvnZ    = (RVN - 2) / sqrt(Var)   approx N(0, 1)
 *
 * Sign convention (identical to axis-112 raw-series
 * Bartels rank von Neumann, applied here on RANKS OF
 * RESIDUALS):
 *
 *   bvnZ << 0   RVN < 2 -> consecutive RANKS OF
 *               RESIDUALS are CLOSE to each other ->
 *               POSITIVE RANK-DOMAIN AUTOCORRELATION
 *               of residuals (above-trend days followed
 *               by above-trend days, in rank order).
 *   bvnZ approx 0  RVN approx 2 -> rank sequence of
 *               residuals consistent with a random
 *               permutation (residuals iid in
 *               distribution-free / rank-domain sense).
 *   bvnZ >> 0   RVN > 2 -> consecutive RANKS OF
 *               RESIDUALS are FAR apart ->
 *               NEGATIVE RANK-DOMAIN AUTOCORRELATION
 *               of residuals (rank-oscillation around
 *               the trend, robust analogue of axis-162
 *               DW > 2).
 *
 * Identities preserved (verified by tests):
 *
 *   - bvnZ(x + c) === bvnZ(x) for any constant c
 *     (additive shift absorbed into intercept;
 *     residuals unchanged; ranks unchanged).
 *   - bvnZ(a*x) === bvnZ(x) for any non-zero scalar a
 *     (positive a preserves residual ordering; negative
 *     a reverses it. But Bartels RVN is INVARIANT under
 *     monotone-DECREASING transforms of the rank
 *     sequence too: R -> (n + 1 - R) maps the rank
 *     sequence to its "complement", but the squared
 *     consecutive differences and squared deviations
 *     from Rbar are unchanged. Hence bvnZ unchanged.)
 *   - For a perfect linear ramp x_t = a + b*t:
 *     residuals are exactly zero -> all ranks tie at
 *     mid-rank (n+1)/2 -> denom = 0 -> THROWS.
 *   - For a perfectly alternating residual pattern
 *     (e.g. +,-,+,-,...): the RANKS interleave
 *     extremes, giving large consecutive differences
 *     and RVN approaching its theoretical maximum
 *     (= 4 in the large-n limit), bvnZ >> 0.
 *   - For a perfectly clustered residual pattern (the
 *     bottom half of ranks then the top half): the
 *     consecutive squared differences sum approaches
 *     a single big jump in the middle, RVN << 2,
 *     bvnZ << 0.
 *
 * Verdict cutoffs by standardised score bvnZ
 * (asymptotic N(0, 1) under the Bartels rank null):
 *
 *   strong-positive-rank-autocorr  bvnZ <= -2.576   (p <= 0.005, two-sided 0.01)
 *   borderline-positive            -2.576 < bvnZ <= -1.645 (p <= 0.05 one-sided)
 *   independent                    -1.645 < bvnZ <  +1.645
 *   borderline-negative            +1.645 <= bvnZ <  +2.576
 *   strong-negative-rank-autocorr  bvnZ >= +2.576
 *
 * The asymptotic Normal approximation is adequate for
 * n >= 10; for smaller samples bvnZ is reported but
 * should be read as suggestive.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OF AXES 79-163:
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann
 *     (BARTELS RVN ON RAW SERIES). The pivot is
 *     fundamentally different:
 *       * axis-112 ranks the RAW series x_t directly.
 *         For a monotone-trending series the ranks are
 *         essentially 1, 2, 3, ..., n in order, so
 *         consecutive squared differences sum to ~n
 *         and RVN is near its MINIMUM (~ 12/(n^2 - 1)
 *         in the perfect ramp limit) and bvnZ is at
 *         its most negative ("strong positive rank
 *         autocorrelation") -- BUT THIS IS ENTIRELY
 *         DRIVEN BY THE TREND, not by short-range
 *         residual structure.
 *       * THIS axis ranks the RESIDUALS e_t. The
 *         trend is REMOVED before ranking, so the
 *         test sees only the SHORT-RANGE RANK
 *         BEHAVIOUR around the fitted line. A
 *         linearly-rising series with iid Gaussian
 *         noise gives axis-112 bvnZ approx -sqrt(n)
 *         (extreme positive rank-autocorr) but THIS
 *         axis gives bvnZ approx 0 (independent).
 *
 *   - vs axis-162 daily-token-durbin-watson-detrended.
 *     Both operate on OLS residuals e_t. But:
 *       * DW is a RAW-MAGNITUDE L^2 statistic:
 *         dw = sum (e_t - e_{t-1})^2 / sum e_t^2.
 *         It depends on the CONTINUOUS magnitudes of
 *         the residuals; a single huge outlier
 *         residual can dominate the numerator and
 *         denominator simultaneously and shift dw by
 *         an order of magnitude.
 *       * THIS axis is a RANK-DOMAIN L^2 statistic:
 *         RVN = sum (R[t+1] - R[t])^2 / sum (R[t] - Rbar)^2
 *         where R[t] = mid-rank(e_t) in {1..n}. It is
 *         INVARIANT UNDER MONOTONE TRANSFORMS of the
 *         residuals: replacing e_t by sign(e_t)*|e_t|^p
 *         for any p > 0 leaves bvnZ unchanged. It is
 *         the ROBUST RANK-DOMAIN COMPANION of DW.
 *       * Concretely: residuals (-100, +1, -2, +50, ...)
 *         and (-1, +1, -1, +1, ...) -- with the same
 *         RANK ORDER -- give EXACTLY the same RVN,
 *         while DW differs by orders of magnitude.
 *
 *   - vs axis-163 daily-token-runs-test-detrended.
 *     Both operate on OLS residuals e_t. But:
 *       * axis-163 reduces e_t to a BINARY SIGN
 *         sequence s_t in {+, -} and counts maximal
 *         runs R. It is a discrete L^0 statistic that
 *         IGNORES even the rank ordering within the
 *         positive (or negative) group: a residual
 *         pattern of (+1, +1, +1) and (+100, +1, +0.01)
 *         have the same R contribution.
 *       * THIS axis preserves the FULL RANK ORDERING
 *         of residuals. A residual pattern of
 *         (+1, +1, +1, -1, -1, -1) has R = 2 in
 *         axis-163 but a SPECIFIC RANK SEQUENCE
 *         (4, 5, 6, 1, 2, 3) in this axis, with a
 *         specific RVN. axis-163 is "blind to
 *         rank-within-sign"; this axis is not.
 *
 *   - vs axis-114 Ljung-Box, axis-159 McLeod-Li, and
 *     axis-158 VR Lo-MacKinlay. All three operate on
 *     RAW or SQUARED RAW values, in CONTINUOUS
 *     magnitudes, on the LEVEL series (not residuals).
 *     This axis is on the RANKS OF RESIDUALS. The
 *     primitives differ on three dimensions: (a) raw
 *     vs. detrended, (b) magnitude vs. rank, (c) lag
 *     structure (lag-q portmanteau for Ljung-Box and
 *     McLeod-Li, multi-q variance ratio for VR vs.
 *     pure lag-1 here).
 *
 *   - vs axis-160 BDS. BDS is a m-history embedding
 *     correlation-integral statistic on RAW values
 *     measuring NONLINEAR DEPENDENCE; this axis is a
 *     bivariate (lag-1) RANK-DOMAIN test on RESIDUALS
 *     measuring linear-in-rank dependence.
 *
 *   - vs axis-161 Jarque-Bera. JB is permutation-
 *     invariant on the RAW series and tests
 *     marginal-shape (skew + kurtosis). This axis is
 *     time-ordered on the RANKS OF RESIDUALS and is
 *     invariant to the marginal shape of the residuals
 *     (only the rank order matters).
 *
 *   - vs the STATIONARITY / UNIT-ROOT / CHANGEPOINT
 *     AXES (axis-156 KPSS, axis-157 ADF, axis-153
 *     CUSUM, axis-154 Pettitt, axis-155 Buishand):
 *     those test the LEVEL TRAJECTORY for unit root /
 *     level-stationarity / changepoint. This axis
 *     tests the RANK STRUCTURE OF RESIDUALS AROUND A
 *     FITTED LINEAR TREND -- a different question.
 *
 * Headline question:
 * **"For each source, after we subtract the best
 *   linear trend and replace the residuals by their
 *   mid-ranks, do consecutive ranks STAY CLOSE
 *   (bvnZ << 0, persistent above-trend / below-trend
 *   ordering), JUMP APART (bvnZ >> 0, rank
 *   oscillation), or look like a random permutation
 *   (bvnZ approx 0)?"**
 *
 * Reference:
 *   Bartels, R., "The rank version of von Neumann's
 *     ratio test for randomness", Journal of the
 *     American Statistical Association 77(377)
 *     (1982), pp. 40-46.
 *
 * Caveats:
 *
 *   - Asymptotic Normal approximation is adequate for
 *     n >= 10. Below this, the EXACT distribution of
 *     RVN is enumerable but not computed here.
 *   - bvnZ is BLIND TO RESIDUAL MAGNITUDE. Compose
 *     with axis-162 DW (magnitude-aware) for a
 *     complete residual diagnostic.
 *   - When all residuals are exactly zero (perfect
 *     linear fit) the denominator is zero and we
 *     throw `zero rank variance`.
 *   - Heavy ties in the residuals (e.g. many days
 *     with exactly the same total_tokens) collapse
 *     ranks via mid-rank; the closed-form denominator
 *     n*(n^2-1)/12 no longer applies and we use the
 *     empirical sum (R[t] - Rbar)^2.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, sort by largest
 *   # |bvnZ|):
 *   pew-insights daily-token-rank-von-neumann-detrended
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-rank-von-neumann-detrended --json
 *
 *   # Sort by raw bvnZ ascending (most positive
 *   # rank-autocorrelated residuals first):
 *   pew-insights daily-token-rank-von-neumann-detrended --sort bvnZ
 */
import type { QueueLine } from './types.js';

export type DailyTokenRankVonNeumannDetrendedSort =
  | 'bvnZ'
  | 'bvnZDesc'
  | 'bvnZAbs'
  | 'bvnZAbsDesc'
  | 'rvn'
  | 'rvnDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type RankVonNeumannDetrendedVerdict =
  | 'strong-positive-rank-autocorr'
  | 'borderline-positive-rank-autocorr'
  | 'independent'
  | 'borderline-negative-rank-autocorr'
  | 'strong-negative-rank-autocorr';

export interface DailyTokenRankVonNeumannDetrendedOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenRankVonNeumannDetrendedSort;
  generatedAt?: string;
}

export interface DailyTokenRankVonNeumannDetrendedSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** OLS intercept of fitted x_t = a + b*t. */
  trendIntercept: number;
  /** OLS slope of fitted x_t = a + b*t (tokens / day). */
  trendSlope: number;
  /** Rank von Neumann ratio on residual mid-ranks. */
  rvn: number;
  /** Variance of RVN under the rank-permutation null. */
  varRvn: number;
  /** Standardised score (rvn - 2)/sqrt(var). */
  bvnZ: number;
  /**
   * Tie correction: number of distinct residual
   * values divided by n (refinement, axis-164).
   * = 1.0 means all residuals distinct (textbook
   * Bartels). < 1 means ties are present and the
   * empirical denominator deviates from the
   * closed-form n*(n^2-1)/12.
   */
  tieFraction: number;
  verdict: RankVonNeumannDetrendedVerdict;
}

export interface DailyTokenRankVonNeumannDetrendedReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenRankVonNeumannDetrendedSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroResidualVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenRankVonNeumannDetrendedSourceRow[];
}

const BVN_Z_STRONG = 2.5758293035489004; // N(0,1) 99.5th percentile
const BVN_Z_WEAK = 1.6448536269514722; // N(0,1) 95th percentile

function classifyRankVnDetrended(
  bvnZ: number,
): RankVonNeumannDetrendedVerdict {
  if (bvnZ <= -BVN_Z_STRONG) return 'strong-positive-rank-autocorr';
  if (bvnZ <= -BVN_Z_WEAK) return 'borderline-positive-rank-autocorr';
  if (bvnZ < BVN_Z_WEAK) return 'independent';
  if (bvnZ < BVN_Z_STRONG) return 'borderline-negative-rank-autocorr';
  return 'strong-negative-rank-autocorr';
}

/**
 * Mid-ranks (average ranks for ties) of the input
 * array. Returns ranks in {1..n} with ties given the
 * mean of their tied positions.
 */
function midRanks(values: number[]): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    // Tie group [i..j-1]; positions are i+1..j (1-based).
    const meanRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) {
      ranks[idx[k]!] = meanRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Bartels rank von Neumann ratio on the mid-ranks of
 * the OLS-detrended residuals.
 *
 * Throws when too short, non-finite, zero level
 * variance, or zero residual variance (perfect linear
 * fit -> all ranks identical -> denom 0).
 */
export function dailyTokenRankVonNeumannDetrended(values: number[]): {
  nSamples: number;
  trendIntercept: number;
  trendSlope: number;
  rvn: number;
  varRvn: number;
  bvnZ: number;
  tieFraction: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: need at least 4 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenRankVonNeumannDetrended requires finite values',
      );
    }
  }

  const tbar = (n - 1) / 2;
  let xbar = 0;
  for (const v of values) xbar += v;
  xbar /= n;

  let sxt = 0;
  let stt = 0;
  let sxx = 0;
  for (let t = 0; t < n; t += 1) {
    const dt = t - tbar;
    const dx = values[t]! - xbar;
    sxt += dt * dx;
    stt += dt * dt;
    sxx += dx * dx;
  }
  if (sxx === 0) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: zero level variance (n=${n})`,
    );
  }
  const slope = sxt / stt;
  const intercept = xbar - slope * tbar;

  const residuals = new Array<number>(n);
  let rss = 0;
  for (let t = 0; t < n; t += 1) {
    const r = values[t]! - (intercept + slope * t);
    residuals[t] = r;
    rss += r * r;
  }
  if (rss === 0 || rss < 1e-300) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: zero residual variance (perfect linear fit, n=${n})`,
    );
  }

  const ranks = midRanks(residuals);

  // Numerator: sum_{t=0..n-2} (R[t+1] - R[t])^2
  let num = 0;
  for (let t = 0; t < n - 1; t += 1) {
    const d = ranks[t + 1]! - ranks[t]!;
    num += d * d;
  }
  // Denominator: sum_{t=0..n-1} (R[t] - Rbar)^2
  const Rbar = (n + 1) / 2;
  let denom = 0;
  for (let t = 0; t < n; t += 1) {
    const d = ranks[t]! - Rbar;
    denom += d * d;
  }
  if (denom === 0 || denom < 1e-300) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: zero rank variance (degenerate ranks, n=${n})`,
    );
  }
  const rvn = num / denom;

  // Bartels 1982 eq. for Var[RVN] under the iid null:
  // Var = 4*(n-2)*(5*n^2 - 2*n - 9) / (5*n*(n+1)*(n-1)^2)
  const varRvn =
    (4 * (n - 2) * (5 * n * n - 2 * n - 9)) /
    (5 * n * (n + 1) * (n - 1) * (n - 1));
  if (!Number.isFinite(varRvn) || varRvn <= 0) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: non-positive Var[RVN] (n=${n})`,
    );
  }
  const bvnZ = (rvn - 2) / Math.sqrt(varRvn);
  if (!Number.isFinite(bvnZ)) {
    throw new Error(
      `dailyTokenRankVonNeumannDetrended: non-finite bvnZ (n=${n})`,
    );
  }

  // Tie fraction (refinement): #distinct residual values / n.
  const sorted = residuals.slice().sort((a, b) => a - b);
  let nDistinct = 1;
  for (let i = 1; i < n; i += 1) {
    if (sorted[i]! !== sorted[i - 1]!) nDistinct += 1;
  }
  const tieFraction = nDistinct / n;

  return {
    nSamples: n,
    trendIntercept: intercept,
    trendSlope: slope,
    rvn,
    varRvn,
    bvnZ,
    tieFraction,
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

export function buildDailyTokenRankVonNeumannDetrended(
  queue: QueueLine[],
  opts: DailyTokenRankVonNeumannDetrendedOptions = {},
): DailyTokenRankVonNeumannDetrendedReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenRankVonNeumannDetrendedSort = opts.sort ?? 'bvnZAbsDesc';
  const validSorts: DailyTokenRankVonNeumannDetrendedSort[] = [
    'bvnZ',
    'bvnZDesc',
    'bvnZAbs',
    'bvnZAbsDesc',
    'rvn',
    'rvnDesc',
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
  let droppedZeroResidualVariance = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenRankVonNeumannDetrendedSourceRow[] = [];

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
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenRankVonNeumannDetrended(filled);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /zero residual variance/.test(msg) ||
        /zero rank variance/.test(msg)
      ) {
        droppedZeroResidualVariance += 1;
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
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      trendIntercept: result.trendIntercept,
      trendSlope: result.trendSlope,
      rvn: result.rvn,
      varRvn: result.varRvn,
      bvnZ: result.bvnZ,
      tieFraction: result.tieFraction,
      verdict: classifyRankVnDetrended(result.bvnZ),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bvnZ':
        primary = a.bvnZ - b.bvnZ;
        break;
      case 'bvnZDesc':
        primary = b.bvnZ - a.bvnZ;
        break;
      case 'bvnZAbs':
        primary = Math.abs(a.bvnZ) - Math.abs(b.bvnZ);
        break;
      case 'bvnZAbsDesc':
        primary = Math.abs(b.bvnZ) - Math.abs(a.bvnZ);
        break;
      case 'rvn':
        primary = a.rvn - b.rvn;
        break;
      case 'rvnDesc':
        primary = b.rvn - a.rvn;
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
    droppedZeroResidualVariance,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
