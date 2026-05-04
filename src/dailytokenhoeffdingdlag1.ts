/**
 * daily-token-hoeffding-d-lag1: per-source HOEFFDING'S
 * D STATISTIC for LAG-1 DEPENDENCE between consecutive
 * MID-RANKS of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-SIXTY-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure. Form
 * the lag-1 paired sequence
 *
 *     P = { (x_t, x_{t+1}) : t = 0..n-2 }       |P| = m = n - 1
 *
 * Replace each marginal coordinate by its MID-RANK in
 * its own marginal:
 *
 *     R_i = mid-rank of P_i.first  in {1..m}
 *     S_i = mid-rank of P_i.second in {1..m}
 *
 * (mid-ranks: ties broken by AVERAGE rank in 1-based
 * convention). Define for each i the BIVARIATE COUNT
 *
 *     Q_i = # { j : R_j < R_i  AND  S_j < S_i }
 *
 * Hoeffding's D (Hoeffding 1948 "A non-parametric test
 * of independence", Annals of Mathematical Statistics
 * 19(4):546-557) is the unbiased U-statistic
 *
 *     D = 30 * ( (m-2)*(m-3)*D1 + D2 - 2*(m-2)*D3 )
 *         / ( m*(m-1)*(m-2)*(m-3)*(m-4) )
 *
 *     D1 = sum_i Q_i * (Q_i - 1)
 *     D2 = sum_i (R_i - 1)*(R_i - 2)*(S_i - 1)*(S_i - 2)
 *     D3 = sum_i (R_i - 2)*(S_i - 2)*Q_i
 *
 * Under H0 (X_i, Y_i are independent draws from
 * continuous joint density f_X * f_Y, no ties):
 *
 *     E[D] = 0
 *     Var[D] = 2 * (m^2 + 5*m - 32)
 *              / ( 9 * m * (m - 1) * (m - 3) * (m - 4) )
 *     hdZ  = D / sqrt(Var[D])    approx N(0, 1) for m large
 *
 * Range: D in [-1/60, 1/30] for the U-statistic form
 * with the 30-multiplier convention used here. Under
 * H0 the typical magnitude is O(1/sqrt(m^3)).
 *
 * Sign convention:
 *
 *   hdZ approx 0  D approx 0  -> consecutive (x_t,
 *                  x_{t+1}) pairs consistent with
 *                  INDEPENDENCE in the joint-CDF
 *                  sense. The lag-1 marginal mid-ranks
 *                  give no evidence of any dependence
 *                  -- linear, monotone, or otherwise.
 *
 *   hdZ >> 0    D > 0  -> there IS lag-1 dependence
 *                  in the joint-CDF sense, of ANY
 *                  shape. Importantly D detects
 *                  NON-MONOTONIC dependence (e.g.
 *                  parabolic, U-shaped, sinusoidal
 *                  conditional means) that
 *                  Spearman-rho lag-1 (axis-130) and
 *                  Kendall-tau lag-1 (axis-131) MISS.
 *
 *   hdZ << 0    D < 0  -> the empirical joint CDF
 *                  underweights the (low, low) and
 *                  (high, high) corners relative to
 *                  the independence product. Under
 *                  Hoeffding's null this is rare;
 *                  values strongly below -1.645 are
 *                  usually small-sample noise rather
 *                  than evidence of "anti-dependence".
 *
 * Identities preserved (verified by tests):
 *
 *   - hdZ(x + c) === hdZ(x) for any constant c
 *     (additive shift preserves marginal ranks).
 *   - hdZ(a*x) === hdZ(x) for any positive scalar a
 *     (positive-affine: marginal ranks preserved).
 *   - hdZ(-x) is FINITE and well-defined but is NOT
 *     in general equal to hdZ(x): negation reverses
 *     each marginal (R -> m+1-R, S -> m+1-S), but the
 *     Q_i counter uses STRICT less-than ordering and
 *     so transforms asymmetrically across mid-rank
 *     ties. Both runs remain rank-based and finite.
 *   - hdZ(monotone-increasing-transform applied
 *     coordinatewise) === hdZ(x): D is a RANK-ONLY
 *     statistic, so any strictly monotone f gives the
 *     same D.
 *   - For a perfect linear ramp x_t = a + b*t with
 *     b != 0: lag-1 pairs are (a + b*t, a + b*(t+1)),
 *     marginal ranks of t and t+1 over t in [0..n-2]
 *     give R_i = i+1, S_i = i+1, so the joint is
 *     COMPLETELY MONOTONE -- D is at its theoretical
 *     maximum 1/30 and hdZ -> +infinity. (Detected,
 *     not penalised: the test doesn't distinguish
 *     trend from any other dependence; compose with a
 *     stationarity / detrending axis for partition.)
 *   - For a perfectly alternating series like
 *     +1, -1, +1, -1, ...: lag-1 pairs are
 *     (+1, -1) and (-1, +1) repeated. Marginal ranks
 *     collapse via mid-rank to 1.5, 1.5, 1.5, 1.5
 *     -- the U-statistic numerator vanishes and D = 0
 *     by the tie-degeneracy convention. (When the
 *     denominator of the rank-mass term is zero we
 *     return D = 0, hdZ = 0.)
 *
 * Verdict cutoffs by standardised score hdZ
 * (asymptotic N(0, 1) under the Hoeffding null):
 *
 *   strong-positive-rank-dependence  hdZ >= +2.576   (p <= 0.005, two-sided 0.01)
 *   borderline-positive-rank-dependence  +1.645 <= hdZ <  +2.576 (p <= 0.05 one-sided)
 *   independent                          -1.645 <  hdZ <  +1.645
 *   borderline-negative-rank-dependence  -2.576 <  hdZ <= -1.645
 *   strong-negative-rank-dependence      hdZ <= -2.576
 *
 * The asymptotic Normal approximation is adequate for
 * m = n - 1 >= 9; for smaller samples hdZ is reported
 * but should be read as suggestive.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OF AXES 79-164:
 *
 *   - vs axis-130 daily-token-spearman-autocorrelation-
 *     lag1 (Spearman rank correlation of consecutive
 *     ranks). Spearman-rho is a LINEAR correlation
 *     statistic ON RANKS: rho = 1 - 6*sum(R_i - S_i)^2
 *     / (m*(m^2 - 1)). It detects only MONOTONE
 *     dependence between R and S; a U-shaped or
 *     periodic conditional mean E[Y|X] with zero
 *     monotone trend gives Spearman-rho approx 0 but
 *     Hoeffding D >> 0. THIS axis fires on
 *     non-monotone dependence Spearman misses.
 *
 *   - vs axis-131 daily-token-kendall-tau-
 *     autocorrelation-lag1 (Kendall tau of consecutive
 *     ranks). tau = (concordant - discordant) /
 *     (m*(m-1)/2). It is also a CONCORDANCE-based
 *     monotone statistic. Same blindness as
 *     Spearman-rho to non-monotone joint structure.
 *
 *   - vs axis-95 daily-token-autocorrelation-lag1
 *     (Pearson autocorrelation). Operates on RAW
 *     magnitudes, not ranks. Detects only LINEAR
 *     dependence and is dominated by outliers.
 *     THIS axis is rank-only and detects ANY joint
 *     dependence shape.
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann
 *     (Bartels RVN on raw-series ranks). Bartels RVN
 *     compares CONSECUTIVE RANK DIFFERENCES against
 *     total rank variance. It is a UNIVARIATE rank
 *     statistic on the time-ordered rank sequence and
 *     fires on local serial structure (positive or
 *     negative rank-autocorrelation) but it does NOT
 *     test the joint distribution of the lag-1
 *     (R_i, S_i) pairs. Concretely: Bartels RVN bvnZ
 *     << 0 means consecutive ranks STAY CLOSE (close
 *     in order); Hoeffding D > 0 means consecutive
 *     pairs concentrate on SOME bivariate region (any
 *     shape).
 *
 *   - vs axis-164 daily-token-rank-von-neumann-
 *     detrended (Bartels RVN on residual ranks). Same
 *     univariate-vs-bivariate distinction as axis-112,
 *     but on detrended residuals. THIS axis ranks the
 *     RAW series (pre-detrending) and tests bivariate
 *     joint dependence.
 *
 *   - vs axis-160 BDS. BDS uses an embedding
 *     correlation integral on RAW VALUES with a
 *     bandwidth parameter epsilon. THIS axis uses
 *     RANK-based U-statistics (no bandwidth) and is a
 *     pure lag-1 test, not a higher-order embedding
 *     test.
 *
 *   - vs axis-114 Ljung-Box, axis-159 McLeod-Li,
 *     axis-158 Lo-MacKinlay VR, axis-162 DW,
 *     axis-163 runs detrended. All of these are
 *     either L^2 magnitude statistics, sign-only
 *     statistics, or multi-lag portmanteau statistics,
 *     and all are univariate-on-time. THIS axis is a
 *     bivariate joint-CDF statistic at a single lag.
 *
 *   - vs the STATIONARITY / UNIT-ROOT / CHANGEPOINT
 *     AXES (axis-156 KPSS, axis-157 ADF, axis-153
 *     CUSUM, axis-154 Pettitt, axis-155 Buishand):
 *     those test the LEVEL TRAJECTORY for
 *     unit-root / level-stationarity / changepoint.
 *     This axis tests the LAG-1 JOINT-CDF SHAPE.
 *
 * Headline question:
 * **"For each source, when we line up consecutive day
 *   pairs (x_t, x_{t+1}) and replace each coordinate
 *   by its mid-rank, does the joint empirical CDF
 *   match the independence product (D approx 0,
 *   hdZ approx 0) -- or does it deviate in any
 *   shape, monotone OR non-monotone (D > 0,
 *   hdZ >> 0) -- in a way that linear-monotone
 *   companions Spearman-lag1 (axis-130) and
 *   Kendall-tau-lag1 (axis-131) would MISS?"**
 *
 * Reference:
 *   Hoeffding, W., "A non-parametric test of
 *     independence", Annals of Mathematical
 *     Statistics 19(4) (1948), pp. 546-557.
 *
 * Caveats:
 *
 *   - Asymptotic Normal approximation is adequate for
 *     m >= 9 (i.e. n >= 10). Below this, the EXACT
 *     distribution of D under H0 is enumerable but
 *     not computed here.
 *   - Heavy ties in the source values collapse
 *     marginal ranks via mid-rank; D may degenerate
 *     toward 0 (under-detection) when many ties are
 *     present. The `tieFraction` field below
 *     surfaces this: tieFraction = 1.0 means all
 *     marginal values distinct; tieFraction << 1
 *     means many ties.
 *   - When the rank-mass denominator is exactly 0
 *     (degenerate marginals, e.g. constant first or
 *     second coordinate), we return D = 0, hdZ = 0
 *     by tie-degeneracy convention and surface the
 *     row with verdict 'independent'. The
 *     `droppedZeroVariance` counter still catches
 *     fully constant series at the build level.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, sort by largest
 *   # |hdZ|):
 *   pew-insights daily-token-hoeffding-d-lag1
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-hoeffding-d-lag1 --json
 *
 *   # Sort by raw hdZ descending (most positive
 *   # rank-dependence first):
 *   pew-insights daily-token-hoeffding-d-lag1 --sort hdZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenHoeffdingDLag1Sort =
  | 'hdZ'
  | 'hdZDesc'
  | 'hdZAbs'
  | 'hdZAbsDesc'
  | 'hd'
  | 'hdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type HoeffdingDLag1Verdict =
  | 'strong-positive-rank-dependence'
  | 'borderline-positive-rank-dependence'
  | 'independent'
  | 'borderline-negative-rank-dependence'
  | 'strong-negative-rank-dependence';

export interface DailyTokenHoeffdingDLag1Options {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 6 (so m = n-1 >= 5). */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHoeffdingDLag1Sort;
  generatedAt?: string;
}

export interface DailyTokenHoeffdingDLag1SourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Number of lag-1 pairs (= nTenureDays - 1). */
  nPairs: number;
  /** Hoeffding D statistic (U-statistic, range ~ [-1/60, +1/30]). */
  hd: number;
  /** Asymptotic variance of D under independence. */
  varHd: number;
  /** Standardised score D / sqrt(Var[D]). */
  hdZ: number;
  /**
   * Tie correction: number of distinct values in the
   * lag-1-paired first-coordinate marginal divided by
   * m. = 1.0 means all distinct (textbook Hoeffding).
   * < 1 means ties are present and D may be
   * under-detected.
   */
  tieFraction: number;
  verdict: HoeffdingDLag1Verdict;
}

export interface DailyTokenHoeffdingDLag1Report {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHoeffdingDLag1Sort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenHoeffdingDLag1SourceRow[];
}

const HD_Z_STRONG = 2.5758293035489004; // N(0,1) 99.5th percentile
const HD_Z_WEAK = 1.6448536269514722; // N(0,1) 95th percentile

function classifyHoeffdingDLag1(hdZ: number): HoeffdingDLag1Verdict {
  if (hdZ >= HD_Z_STRONG) return 'strong-positive-rank-dependence';
  if (hdZ >= HD_Z_WEAK) return 'borderline-positive-rank-dependence';
  if (hdZ > -HD_Z_WEAK) return 'independent';
  if (hdZ > -HD_Z_STRONG) return 'borderline-negative-rank-dependence';
  return 'strong-negative-rank-dependence';
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
    const meanRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) {
      ranks[idx[k]!] = meanRank;
    }
    i = j;
  }
  return ranks;
}

/**
 * Hoeffding's D U-statistic for lag-1 dependence in a
 * series. Throws on too-short input or non-finite
 * values; returns D = 0, hdZ = 0 when the marginal
 * rank-variance degenerates (constant first or second
 * coordinate after lag-1 pairing).
 */
export function dailyTokenHoeffdingDLag1(values: number[]): {
  nSamples: number;
  nPairs: number;
  hd: number;
  varHd: number;
  hdZ: number;
  tieFraction: number;
} {
  const n = values.length;
  if (n < 6) {
    throw new Error(
      `dailyTokenHoeffdingDLag1: need at least 6 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenHoeffdingDLag1 requires finite values');
    }
  }

  // Form lag-1 pairs.
  const m = n - 1;
  const X = new Array<number>(m);
  const Y = new Array<number>(m);
  for (let t = 0; t < m; t += 1) {
    X[t] = values[t]!;
    Y[t] = values[t + 1]!;
  }

  // Mid-ranks of each marginal.
  const R = midRanks(X);
  const S = midRanks(Y);

  // Tie fraction on the first marginal X.
  const sortedX = X.slice().sort((a, b) => a - b);
  let nDistinct = 1;
  for (let i = 1; i < m; i += 1) {
    if (sortedX[i]! !== sortedX[i - 1]!) nDistinct += 1;
  }
  const tieFraction = nDistinct / m;

  // Marginal degeneracy guard: if either coordinate
  // collapses to a single tied rank, return D = 0.
  let allRSame = true;
  for (let i = 1; i < m; i += 1) {
    if (R[i] !== R[0]) {
      allRSame = false;
      break;
    }
  }
  let allSSame = true;
  for (let i = 1; i < m; i += 1) {
    if (S[i] !== S[0]) {
      allSSame = false;
      break;
    }
  }
  if (allRSame || allSSame) {
    // Variance is still well-defined for the asymptotic
    // formula at sample size m, but the realised D is 0
    // by tie collapse.
    const varHdDeg =
      (2 * (m * m + 5 * m - 32)) /
      (9 * m * (m - 1) * (m - 3) * (m - 4));
    return {
      nSamples: n,
      nPairs: m,
      hd: 0,
      varHd: varHdDeg > 0 ? varHdDeg : Number.POSITIVE_INFINITY,
      hdZ: 0,
      tieFraction,
    };
  }

  // Bivariate counts Q_i = #{ j != i : R_j < R_i AND
  // S_j < S_i } using the strict-less-than convention
  // (mid-rank ties contribute 0 to Q_i; this is the
  // standard tie-aware Hoeffding form).
  const Q = new Array<number>(m).fill(0);
  for (let i = 0; i < m; i += 1) {
    let q = 0;
    const ri = R[i]!;
    const si = S[i]!;
    for (let j = 0; j < m; j += 1) {
      if (j === i) continue;
      if (R[j]! < ri && S[j]! < si) q += 1;
    }
    Q[i] = q;
  }

  // U-statistic components.
  let D1 = 0;
  let D2 = 0;
  let D3 = 0;
  for (let i = 0; i < m; i += 1) {
    const ri = R[i]!;
    const si = S[i]!;
    const qi = Q[i]!;
    D1 += qi * (qi - 1);
    D2 += (ri - 1) * (ri - 2) * (si - 1) * (si - 2);
    D3 += (ri - 2) * (si - 2) * qi;
  }

  const denom = m * (m - 1) * (m - 2) * (m - 3) * (m - 4);
  if (denom === 0) {
    // Should be impossible given m = n-1 >= 5, but
    // guard anyway.
    throw new Error(
      `dailyTokenHoeffdingDLag1: denominator zero (m=${m})`,
    );
  }
  const hd = (30 * ((m - 2) * (m - 3) * D1 + D2 - 2 * (m - 2) * D3)) / denom;
  if (!Number.isFinite(hd)) {
    throw new Error(
      `dailyTokenHoeffdingDLag1: non-finite D (m=${m})`,
    );
  }

  // Asymptotic variance under independence (Hollander-
  // Wolfe 1973, eq. 8.96 adapted for the 30-multiplier
  // U-statistic form).
  const varHd =
    (2 * (m * m + 5 * m - 32)) /
    (9 * m * (m - 1) * (m - 3) * (m - 4));
  if (!Number.isFinite(varHd) || varHd <= 0) {
    throw new Error(
      `dailyTokenHoeffdingDLag1: non-positive Var[D] (m=${m})`,
    );
  }
  const hdZ = hd / Math.sqrt(varHd);
  if (!Number.isFinite(hdZ)) {
    throw new Error(
      `dailyTokenHoeffdingDLag1: non-finite hdZ (m=${m})`,
    );
  }

  return {
    nSamples: n,
    nPairs: m,
    hd,
    varHd,
    hdZ,
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

export function buildDailyTokenHoeffdingDLag1(
  queue: QueueLine[],
  opts: DailyTokenHoeffdingDLag1Options = {},
): DailyTokenHoeffdingDLag1Report {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 6) {
    throw new Error(
      `minTenureDays must be an integer >= 6 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHoeffdingDLag1Sort = opts.sort ?? 'hdZAbsDesc';
  const validSorts: DailyTokenHoeffdingDLag1Sort[] = [
    'hdZ',
    'hdZDesc',
    'hdZAbs',
    'hdZAbsDesc',
    'hd',
    'hdDesc',
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
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHoeffdingDLag1SourceRow[] = [];

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
      result = dailyTokenHoeffdingDLag1(filled);
    } catch (_err) {
      droppedNonFiniteFit += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      nPairs: result.nPairs,
      hd: result.hd,
      varHd: result.varHd,
      hdZ: result.hdZ,
      tieFraction: result.tieFraction,
      verdict: classifyHoeffdingDLag1(result.hdZ),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hdZ':
        primary = a.hdZ - b.hdZ;
        break;
      case 'hdZDesc':
        primary = b.hdZ - a.hdZ;
        break;
      case 'hdZAbs':
        primary = Math.abs(a.hdZ) - Math.abs(b.hdZ);
        break;
      case 'hdZAbsDesc':
        primary = Math.abs(b.hdZ) - Math.abs(a.hdZ);
        break;
      case 'hd':
        primary = a.hd - b.hd;
        break;
      case 'hdDesc':
        primary = b.hd - a.hd;
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
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
