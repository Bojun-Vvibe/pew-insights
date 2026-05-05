/**
 * daily-token-sen-adichie-aligned-rank-trend: per-source
 * SEN-ADICHIE 1967 ALIGNED RANK TREND TEST across weekday
 * cohorts (period s = 7) on the gap-filled daily
 * total_tokens series.
 *
 * TWO-HUNDRED-AND-NINETEENTH cross-source axis.
 *
 * Mechanism. Let x[0..n-1] be the gap-filled daily token
 * series for one source (n = nTenureDays >= 21). Partition
 * the index set into s = 7 weekday-of-week cohorts by
 *
 *     cohort(i) = i mod 7      (i = 0..n-1)
 *
 * For each cohort g of length n_g (>= 3), let
 *
 *     X^{(g)} = ( x[i] : i mod 7 == g )
 *     T^{(g)} = ( j    : j = 0..n_g-1 )    (within-cohort
 *                                           time position)
 *
 * Compute the WITHIN-COHORT MIDRANKS R^{(g)}_j of
 * X^{(g)}_j (average rank for ties; range 1..n_g). The
 * SEN-ADICHIE 1967 *Annals of Mathematical Statistics*
 * 38(4):1216-1228 ALIGNED RANK statistic for trend across
 * blocks (here weekday cohorts) is
 *
 *     L_g = sum_{j=0..n_g-1}
 *             ( T^{(g)}_j - meanT_g ) *
 *             ( R^{(g)}_j - (n_g + 1)/2 )                 (1)
 *
 *     L^{SA} = sum_{g=0..6} L_g                           (2)
 *
 * where meanT_g = (n_g - 1)/2. Under H0 of no within-
 * cohort monotone trend (the within-cohort midranks are
 * a uniform random permutation of {1, .., n_g}), L_g has
 * mean ZERO and variance
 *
 *     Var(L_g) = ( sum_j ( T^{(g)}_j - meanT_g )^2 )
 *                * ( sum_j ( R^{(g)}_j - (n_g+1)/2 )^2 )
 *                / ( n_g - 1 )                            (3)
 *
 * which is the classical Spearman / Pitman permutation
 * variance for the inner product of two centred sequences
 * (Kendall 1975 sec. 3.1; Hettmansperger & McKean 1998
 * eq. 6.5.2 for the aligned-rank variant). Pooling across
 * INDEPENDENT cohorts (Sen-Adichie 1967 working
 * assumption -- the same as Hirsch-Slack 1984 axis-218
 * for the seasonal Mann-Kendall) gives
 *
 *     Var(L^{SA}) = sum_{g=0..6} Var(L_g)                 (4)
 *
 * The standardised statistic
 *
 *     saZ = L^{SA} / sqrt( Var(L^{SA}) )                  (5)
 *
 * is asymptotically N(0, 1) two-sided; the two-sided
 * p-value is
 *
 *     saPValue = 2 * ( 1 - Phi(|saZ|) )                   (6)
 *
 * via the Abramowitz-Stegun 1964 eq. 7.1.26 erf approxi-
 * mation (max abs error ~1.5e-7). Diagnostic surfaces:
 *
 *   - saRho: an aggregate ALIGNED-RANK SPEARMAN
 *     coefficient,
 *
 *         saRho = L^{SA} / sqrt( STT * SRR )
 *
 *     where STT = sum_g sum_j (T_j - meanT_g)^2 and
 *     SRR = sum_g sum_j (R_j - (n_g+1)/2)^2; in [-1, +1]
 *     with magnitude 1 iff every cohort is exactly
 *     monotone in time (no ties).
 *   - saConcordantSeasons: number of cohorts with L_g > 0
 *     (in {0, .., 7}); cohort-level direction agreement.
 *   - saConcordanceRatio: saConcordantSeasons / 7.
 *
 * SIGN convention.
 *
 *   - saZ > 0  =>  L^{SA} > 0  =>  weekday cohorts
 *                  collectively trend UP across weeks
 *                  (within-cohort rank-position
 *                   correlation positive)
 *   - saZ < 0  =>  trend DOWN
 *   - saZ ~ 0  =>  no within-cohort monotone trend
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `daily-token-hirsch-slack-seasonal-kendall`
 *     (axis-218): both are SEASON-STRATIFIED rank trend
 *     tests with period s = 7. Hirsch-Slack 1984 sums the
 *     KENDALL S = sum_{j<k} sign(x_k - x_j) per cohort;
 *     it is a SIGN-COUNT (L_1-style on rank
 *     concordances). Sen-Adichie 1967 sums an INNER
 *     PRODUCT of within-cohort midranks against time
 *     position; it is the SEASONAL Spearman analogue
 *     (L_2-style on aligned ranks). Hirsch-Slack vs
 *     Sen-Adichie is the seasonal-stratified analogue of
 *     Mann-Kendall vs Spearman: both detect the same
 *     monotone alternative but with DIFFERENT
 *     INFLUENCE FUNCTIONS -- Hirsch-Slack assigns equal
 *     weight to every concordant pair regardless of rank
 *     gap; Sen-Adichie WEIGHTS BY RANK MAGNITUDE so that
 *     extreme within-cohort rank departures count more.
 *     Empirically the two often agree in DIRECTION
 *     (sign(saZ) == sign(hsZ)) but can DISAGREE on
 *     STRENGTH (saZ much larger when within-cohort rank
 *     departures concentrate at the extremes; hsZ much
 *     larger when concordances are uniformly distributed
 *     across the cohort). The RANK INFLUENCE structure is
 *     ORTHOGONAL.
 *   - vs `daily-token-buys-ballot-period7-anova`
 *     (axis-216): Buys-Ballot tests for WEEKDAY MEAN
 *     STRUCTURE (between-cohort mean differences) and is
 *     INVARIANT under within-column detrending. Sen-
 *     Adichie tests for WITHIN-COHORT TREND and is
 *     INVARIANT under any per-cohort additive shift
 *     (subtracting the mean of cohort g leaves all
 *     within-cohort midranks unchanged). The two are
 *     COMPLEMENTARY and ORTHOGONAL.
 *   - vs `daily-token-spearman-footrule-time` (the
 *     unstratified Spearman-family axis): plain Spearman
 *     on the WHOLE series conflates period-7 mean
 *     structure with monotone trend (a series with
 *     weekday-vs-weekend amplitude but no within-cohort
 *     trend loads on plain Spearman because cross-cohort
 *     rank gaps dominate). Sen-Adichie ALIGNS the ranks
 *     within each cohort first, removing the cross-
 *     cohort mean shift by construction.
 *   - vs `daily-token-laplace-centroid-trend` (axis-217):
 *     L-1 magnitude functional vs L-2 rank inner product
 *     -- a single late spike shifts the Laplace centroid
 *     but contributes only ONE extreme rank within ONE
 *     cohort to Sen-Adichie. MAGNITUDE vs RANK orthogonal
 *     AND aggregated vs season-stratified.
 *   - vs `daily-token-theil-sen-slope` (axis-214):
 *     Theil-Sen is a SLOPE estimator on (i, x[i]) pairs
 *     across the whole series. Sen-Adichie operates on
 *     within-cohort midranks against within-cohort time
 *     position only -- mean-of-cohort drops out
 *     completely.
 *
 * Headline question:
 * **"For each source, after stratifying on weekday cohort
 *   and ALIGNING the midranks within each cohort, is
 *   there a STATISTICALLY SIGNIFICANT linear-rank
 *   association between within-cohort time position and
 *   within-cohort midrank, pooled across the seven
 *   weekday cohorts via the Sen-Adichie 1967 aligned-rank
 *   sum?"**
 *
 * References:
 *   Sen, P. K. & Adichie, J. N., "Estimates of regression
 *     parameters based on rank tests", *Annals of
 *     Mathematical Statistics* 38(4) (1967), pp. 1216-
 *     1228. The aligned-rank statistic used here.
 *   Hettmansperger, T. P. & McKean, J. W., *Robust
 *     Nonparametric Statistical Methods*, Arnold 1998,
 *     sec. 6.5 (aligned-rank trend tests).
 *   Kendall, M. G., *Rank Correlation Methods*, 4th ed.,
 *     Griffin 1975, sec. 3.1 (Spearman variance under
 *     uniform-permutation H0).
 *   Abramowitz, M. & Stegun, I. A., *Handbook of Mathe-
 *     matical Functions*, NBS 1964, eq. 7.1.26.
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 21 days. Each cohort needs n_g >= 3
 *     for the Spearman variance (3) to be well-defined
 *     (denominator n_g - 1 >= 2).
 *   - WORKING ASSUMPTION: cross-cohort independence
 *     (same as Hirsch-Slack 1984 axis-218). For typical
 *     token series with positive weekly autocorrelation
 *     this is anti-conservative; covariance-corrected
 *     variants (analogous to Hirsch-Slack-Smith 1982)
 *     are reserved for separate axes.
 *   - The test is INVARIANT under monotone within-cohort
 *     transformations of x and under per-cohort additive
 *     shifts (rank-based + alignment).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-sen-adichie-aligned-rank-trend
 *   pew-insights daily-token-sen-adichie-aligned-rank-trend --json
 *   pew-insights daily-token-sen-adichie-aligned-rank-trend \
 *     --sort saAbsZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenSenAdichieAlignedRankTrendSort =
  | 'saZ'
  | 'saZDesc'
  | 'saAbsZDesc'
  | 'saPValue'
  | 'saPValueDesc'
  | 'saRho'
  | 'saRhoDesc'
  | 'saConcordantSeasonsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSenAdichieAlignedRankTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21 (each cohort needs n_g >= 3). */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSenAdichieAlignedRankTrendSort;
  generatedAt?: string;
}

export interface DailyTokenSenAdichieAlignedRankTrendSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Sen-Adichie 1967 sum-over-cohorts L^{SA}. */
  saL: number;
  /** Variance of L^{SA} under H0. */
  saVar: number;
  /** Standardised Z. */
  saZ: number;
  /** Two-sided Normal-approximation p-value. */
  saPValue: number;
  /** Aggregate aligned-rank Spearman rho in [-1, +1]. */
  saRho: number;
  /** Number of cohorts (out of 7) with L_g > 0. */
  saConcordantSeasons: number;
  /** saConcordantSeasons / 7. */
  saConcordanceRatio: number;
  /** Number of cohorts with at least 3 observations. */
  saActiveSeasons: number;
}

export interface DailyTokenSenAdichieAlignedRankTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSenAdichieAlignedRankTrendSort;
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
  sources: DailyTokenSenAdichieAlignedRankTrendSourceRow[];
}

/**
 * Standard Normal CDF Phi(z) via Abramowitz-Stegun 1964
 * eq. 7.1.26 rational erf approximation. Max abs error
 * ~1.5e-7.
 */
export function standardNormalCdfSenAdichie(z: number): number {
  if (!Number.isFinite(z)) {
    if (z === Number.POSITIVE_INFINITY) return 1;
    if (z === Number.NEGATIVE_INFINITY) return 0;
    throw new Error(`standardNormalCdfSenAdichie: z must be finite (got ${z})`);
  }
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

export function twoSidedNormalPSenAdichie(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`twoSidedNormalPSenAdichie: z must be finite (got ${z})`);
  }
  const az = Math.abs(z);
  const upper = 1 - standardNormalCdfSenAdichie(az);
  const p = 2 * upper;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Compute MIDRANKS (average rank for ties) of `values`,
 * ranks in 1..n. Returns a fresh array.
 */
export function midranksSenAdichie(values: number[]): number[] {
  const n = values.length;
  const idx = values.map((_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    const avg = (i + 1 + j) / 2; // midrank for [i+1 .. j]
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avg;
    i = j;
  }
  return ranks;
}

/**
 * Sen-Adichie 1967 aligned rank trend test on a gap-
 * filled daily token series with period s = 7.
 *
 * EXACT IDENTITIES preserved:
 *
 *   - saL = 0 for any series whose every cohort is
 *     constant (all midranks equal to (n_g+1)/2).
 *   - saRho in [-1, +1].
 *   - INVARIANT under any per-cohort additive shift.
 *   - REVERSING the entire series along time NEGATES
 *     saL and saZ but PRESERVES saVar and saPValue.
 *     (Reversing inverts within-cohort rank order and
 *      time-position centring symmetrically.)
 */
export function dailyTokenSenAdichieAlignedRankTrend(weights: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  saL: number;
  saVar: number;
  saZ: number;
  saPValue: number;
  saRho: number;
  saConcordantSeasons: number;
  saConcordanceRatio: number;
  saActiveSeasons: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenSenAdichieAlignedRankTrend: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenSenAdichieAlignedRankTrend requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenSenAdichieAlignedRankTrend requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  for (let i = 0; i < n; i += 1) sumW += weights[i]!;
  const mean = sumW / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenSenAdichieAlignedRankTrend: zero centred variance (n=${n})`,
    );
  }
  // partition into 7 cohorts
  const cohorts: number[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < n; i += 1) cohorts[i % 7]!.push(weights[i]!);

  let saL = 0;
  let saVar = 0;
  let saConcordantSeasons = 0;
  let saActiveSeasons = 0;
  let sttTotal = 0;
  let srrTotal = 0;
  for (let g = 0; g < 7; g += 1) {
    const cohort = cohorts[g]!;
    const ng = cohort.length;
    if (ng < 3) continue;
    saActiveSeasons += 1;
    const ranks = midranksSenAdichie(cohort);
    const meanT = (ng - 1) / 2;
    const meanR = (ng + 1) / 2;
    let lg = 0;
    let stt = 0;
    let srr = 0;
    for (let j = 0; j < ng; j += 1) {
      const dt = j - meanT;
      const dr = ranks[j]! - meanR;
      lg += dt * dr;
      stt += dt * dt;
      srr += dr * dr;
    }
    saL += lg;
    sttTotal += stt;
    srrTotal += srr;
    // permutation variance: stt * srr / (ng - 1)
    const vg = (stt * srr) / (ng - 1);
    saVar += vg;
    if (lg > 0) saConcordantSeasons += 1;
  }
  if (saActiveSeasons < 3) {
    throw new Error(
      `dailyTokenSenAdichieAlignedRankTrend: too few active seasons (${saActiveSeasons} < 3); n=${n}`,
    );
  }
  if (saVar <= 0 || !Number.isFinite(saVar)) {
    throw new Error(
      `dailyTokenSenAdichieAlignedRankTrend: non-positive Var(L^{SA})=${saVar} (n=${n})`,
    );
  }
  const saZ = saL / Math.sqrt(saVar);
  if (!Number.isFinite(saZ)) {
    throw new Error(
      `dailyTokenSenAdichieAlignedRankTrend: non-finite Z (n=${n})`,
    );
  }
  const saPValue = twoSidedNormalPSenAdichie(saZ);
  const denomRho = Math.sqrt(sttTotal * srrTotal);
  const saRho = denomRho > 0 ? saL / denomRho : 0;
  const saConcordanceRatio = saConcordantSeasons / 7;
  return {
    mean,
    stddev,
    nSamples: n,
    saL,
    saVar,
    saZ,
    saPValue,
    saRho,
    saConcordantSeasons,
    saConcordanceRatio,
    saActiveSeasons,
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

export function buildDailyTokenSenAdichieAlignedRankTrend(
  queue: QueueLine[],
  opts: DailyTokenSenAdichieAlignedRankTrendOptions = {},
): DailyTokenSenAdichieAlignedRankTrendReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSenAdichieAlignedRankTrendSort = opts.sort ?? 'saAbsZDesc';
  const validSorts: DailyTokenSenAdichieAlignedRankTrendSort[] = [
    'saZ',
    'saZDesc',
    'saAbsZDesc',
    'saPValue',
    'saPValueDesc',
    'saRho',
    'saRhoDesc',
    'saConcordantSeasonsDesc',
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
  const rows: DailyTokenSenAdichieAlignedRankTrendSourceRow[] = [];

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
      result = dailyTokenSenAdichieAlignedRankTrend(filled);
    } catch {
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
      mean: result.mean,
      stddev: result.stddev,
      saL: result.saL,
      saVar: result.saVar,
      saZ: result.saZ,
      saPValue: result.saPValue,
      saRho: result.saRho,
      saConcordantSeasons: result.saConcordantSeasons,
      saConcordanceRatio: result.saConcordanceRatio,
      saActiveSeasons: result.saActiveSeasons,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'saZ':
        primary = a.saZ - b.saZ;
        break;
      case 'saZDesc':
        primary = b.saZ - a.saZ;
        break;
      case 'saAbsZDesc':
        primary = Math.abs(b.saZ) - Math.abs(a.saZ);
        break;
      case 'saPValue':
        primary = a.saPValue - b.saPValue;
        break;
      case 'saPValueDesc':
        primary = b.saPValue - a.saPValue;
        break;
      case 'saRho':
        primary = a.saRho - b.saRho;
        break;
      case 'saRhoDesc':
        primary = b.saRho - a.saRho;
        break;
      case 'saConcordantSeasonsDesc':
        primary = b.saConcordantSeasons - a.saConcordantSeasons;
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
