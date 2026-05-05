/**
 * daily-token-hirsch-slack-seasonal-kendall: per-source
 * HIRSCH-SLACK 1984 SEASONAL MANN-KENDALL TREND TEST
 * with period s = 7 (weekday-of-week seasons) applied to
 * the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-EIGHTEENTH cross-source axis.
 *
 * Mechanism. Let x[0..n-1] be the gap-filled daily token
 * series for one source (n = nTenureDays >= 21, so each of
 * the 7 weekday cohorts has at least 3 observations and
 * the within-season Mann-Kendall variance is well-defined).
 *
 * Partition the index set into s = 7 SEASONS by weekday-
 * of-week:
 *
 *     season(i) = i mod 7    (i = 0..n-1)
 *
 * For each season g in {0, .., 6} let
 *
 *     X^{(g)} = ( x[i] : i mod 7 == g )    of length n_g
 *
 * be the within-weekday cohort. Compute the WITHIN-SEASON
 * MANN-KENDALL S statistic (Mann 1945 *Econometrica*
 * 13(3):245-259; Kendall 1975 *Rank Correlation Methods*)
 *
 *     S_g = sum_{j < k} sign( X^{(g)}_k - X^{(g)}_j )
 *
 * with values in {-n_g(n_g-1)/2, .., +n_g(n_g-1)/2} (sign
 * 0 for ties). Hirsch & Slack 1984 *Water Resources
 * Research* 20(6):727-732, "A nonparametric trend test for
 * seasonal data with serial dependence", define the
 * SEASONAL KENDALL S as the SUM over seasons
 *
 *     S^{HS} = sum_{g=0..6} S_g                              (1)
 *
 * Under H0 (no monotone trend within ANY season; observ-
 * ations independent within each season; cross-season
 * cross-products zero in expectation, the assumption made
 * by Hirsch-Slack 1984 sec. 2 in lieu of the full
 * Hirsch-Slack-Smith 1982 cross-covariance correction
 * which we do NOT carry here -- that variant is reserved
 * for a separate axis), and assuming weekly cohorts are
 * uncorrelated under H0, the variance of S^{HS} is the
 * sum of the within-season Kendall variances
 *
 *     Var(S^{HS}) = sum_{g=0..6} Var(S_g)                    (2)
 *
 *     Var(S_g) = ( n_g * (n_g - 1) * (2*n_g + 5)
 *                 - sum_t t*(t-1)*(2*t+5) ) / 18             (3)
 *
 * where the inner sum is over groups of TIED RANKS in
 * X^{(g)}, with t the size of each tie group (Kendall 1975
 * sec. 4.2 tie-correction). The CONTINUITY-CORRECTED
 * standardised statistic
 *
 *     hsZ = ( S^{HS} - sign(S^{HS}) ) / sqrt( Var(S^{HS}) )  (4)
 *
 * (with hsZ = 0 when S^{HS} = 0) is asymptotically
 * standard Normal under H0; the TWO-SIDED p-value is
 *
 *     hsPValue = 2 * ( 1 - Phi(|hsZ|) )                      (5)
 *
 * via the Abramowitz-Stegun 1964 eq. 7.1.26 erf approxi-
 * mation (max abs error ~1.5e-7).
 *
 * SECONDARY DIAGNOSTICS surfaced per source:
 *
 *   - hsTau: the AGGREGATE seasonal Kendall tau,
 *
 *         hsTau = S^{HS} / sum_g [ n_g * (n_g - 1) / 2 ]
 *
 *     in [-1, +1]; the seasonal analogue of Kendall's tau
 *     normalised to its theoretical maximum.
 *   - hsConcordantSeasons: the number of seasons g for
 *     which S_g > 0 (in {0, .., 7}); a coarse measure of
 *     how many weekday cohorts agree on the trend
 *     direction.
 *   - hsConcordanceRatio: hsConcordantSeasons / 7.
 *
 * SIGN convention.
 *
 *   - hsZ > 0  =>  S^{HS} > 0  =>  weekday cohorts
 *                  collectively trend UP across weeks
 *   - hsZ < 0  =>  S^{HS} < 0  =>  weekday cohorts
 *                  collectively trend DOWN across weeks
 *   - hsZ ~ 0  =>  no monotone within-weekday trend
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `daily-token-mann-kendall-tau` (axis-110 family):
 *     plain Mann-Kendall is computed on the WHOLE series,
 *     conflating a deterministic period-7 mean shift with
 *     monotone trend. A series with HUGE period-7
 *     amplitude but no underlying trend (e.g. weekday-
 *     vs-weekend mean step repeated week after week)
 *     loads strongly on plain Mann-Kendall (sign
 *     differences across weekday boundaries dominate)
 *     but Hirsch-Slack S^{HS} sees ZERO trend within each
 *     weekday cohort and so registers hsZ ~ 0.
 *     Conversely, a series with a slow monotone drift but
 *     no weekday structure loads similarly on both -- but
 *     Hirsch-Slack is the SEASONAL-CORRECTED version that
 *     remains valid in the presence of period-7 mean
 *     shifts.
 *   - vs `daily-token-theil-sen-slope` (axis-214):
 *     Theil-Sen is a SLOPE estimator on (i, x[i]) pairs
 *     across the whole series and likewise conflates
 *     period-7 mean structure with trend (the Theil-Sen
 *     line through a weekday-amplified series picks up
 *     the trend OF THE WEEKDAY MEANS, not the within-
 *     cohort trend). Hirsch-Slack S^{HS} looks WITHIN
 *     each cohort separately -- mean-of-cohort drops out
 *     of every within-cohort sign comparison.
 *   - vs `daily-token-cox-stuart-thirds-trend` (axis-215):
 *     Cox-Stuart-thirds compares the FIRST third's mean
 *     to the LAST third's mean across the whole series;
 *     a strong period-7 weekday step that happens to
 *     align with a third boundary contaminates the test.
 *     Hirsch-Slack is robust to this by construction:
 *     all comparisons stay within-weekday.
 *   - vs `daily-token-buys-ballot-period7-anova` (axis-216):
 *     Buys-Ballot tests for WEEKDAY MEAN STRUCTURE under
 *     H0 of equal weekday means; it is INVARIANT under
 *     within-column DETRENDING (columns are mean-centered
 *     before the F-statistic). Hirsch-Slack tests for
 *     WITHIN-COLUMN MONOTONE TREND under H0 of no within-
 *     column trend, taking the periodic structure as a
 *     NUISANCE. The two are complementary and ORTHOGONAL:
 *     a series with strong weekday mean shift but no
 *     within-cohort trend loads on Buys-Ballot and not on
 *     Hirsch-Slack; a series with smooth monotone drift
 *     but no weekday structure loads on Hirsch-Slack and
 *     not on Buys-Ballot; a series with both loads on
 *     both with INDEPENDENT signals.
 *   - vs `daily-token-laplace-centroid-trend` (axis-217):
 *     the Laplace centroid is an L-1 first-moment
 *     functional sensitive to MAGNITUDE: a single late
 *     spike shifts the centroid right but creates
 *     essentially no within-weekday rank-trend signal
 *     (only one cohort sees the spike, and only as one
 *     observation). Conversely, a series with no
 *     magnitude shift but a strict within-weekday rank
 *     ordering across weeks loads on Hirsch-Slack but
 *     not on the Laplace centroid (mass roughly uniform
 *     across positions). The two are MAGNITUDE vs RANK
 *     orthogonal AND aggregated vs season-stratified.
 *   - vs `daily-token-autocorrelation-lag7`: ACF(7) is a
 *     LINEAR DEPENDENCE statistic on the full series and
 *     is dominated by the period-7 PERIODIC AMPLITUDE
 *     when present. Hirsch-Slack ignores cross-cohort
 *     covariance entirely (under its working independence
 *     assumption) and tests within-cohort trend rank-
 *     wise.
 *
 * Headline question:
 * **"For each source, after removing the day-of-week
 *   periodic structure by stratifying on weekday cohort,
 *   is there a STATISTICALLY SIGNIFICANT monotone trend
 *   in token volume within at least one weekday cohort,
 *   pooled across the seven cohorts via the Hirsch-Slack
 *   1984 seasonal Kendall S statistic?"**
 *
 * References:
 *   Hirsch, R. M. & Slack, J. R., "A nonparametric trend
 *     test for seasonal data with serial dependence",
 *     *Water Resources Research* 20(6) (1984), pp. 727-
 *     732. The seasonal-Kendall S^{HS} as defined here
 *     (the simpler 1984 form; the 1982 Hirsch-Slack-Smith
 *     cross-covariance correction is a separate axis).
 *   Mann, H. B., "Nonparametric tests against trend",
 *     *Econometrica* 13(3) (1945), pp. 245-259. The
 *     within-season S statistic.
 *   Kendall, M. G., *Rank Correlation Methods*, 4th ed.,
 *     Griffin 1975, sec. 4.2 (variance with tie
 *     correction).
 *   Abramowitz, M. & Stegun, I. A., *Handbook of Mathe-
 *     matical Functions*, NBS 1964, eq. 7.1.26 (erf
 *     rational approximation; standard Normal CDF).
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 21 days. Each weekday cohort needs
 *     at least 3 observations for the within-season
 *     variance (3) to be well-defined and the Normal
 *     approximation to be reasonable (Hirsch-Slack 1984
 *     sec. 4 give simulation evidence for n_g >= 3).
 *   - WORKING ASSUMPTION: cross-season covariance is
 *     ZERO in expectation. The full Hirsch-Slack-Smith
 *     1982 *Water Resources Research* 18(1):107-121
 *     covariance-corrected variant (which we do NOT
 *     implement here -- it is reserved for a separate
 *     axis) replaces (2) by Var(S^{HS}) + 2 sum_{g<g'}
 *     Cov(S_g, S_{g'}). For the typical token series the
 *     simpler form is conservative: cross-day positive
 *     autocorrelation INFLATES the true variance and so
 *     the simpler form's hsPValue is ANTI-CONSERVATIVE
 *     in that direction. Users wanting the conservative
 *     covariance-corrected p-value should consult the
 *     companion axis.
 *   - The test is INVARIANT under monotone increasing
 *     transformations applied within each weekday cohort
 *     SEPARATELY (rank-based within-cohort).
 *   - The test is INVARIANT under any per-cohort additive
 *     SHIFT (subtracting the mean of cohort g from every
 *     observation in cohort g leaves all sign comparisons
 *     unchanged). This is precisely what makes it
 *     orthogonal to Buys-Ballot.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=21):
 *   pew-insights daily-token-hirsch-slack-seasonal-kendall
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-hirsch-slack-seasonal-kendall --json
 *
 *   # Sort by |hsZ| descending (largest seasonal trends first):
 *   pew-insights daily-token-hirsch-slack-seasonal-kendall \
 *     --sort hsAbsZDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenHirschSlackSeasonalKendallSort =
  | 'hsZ'
  | 'hsZDesc'
  | 'hsAbsZDesc'
  | 'hsPValue'
  | 'hsPValueDesc'
  | 'hsTau'
  | 'hsTauDesc'
  | 'hsConcordantSeasonsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHirschSlackSeasonalKendallOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 21 so
   * each of the 7 weekday cohorts has >= 3 observations
   * (Hirsch-Slack 1984 sec. 4 simulation floor for the
   * Normal approximation).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHirschSlackSeasonalKendallSort;
  generatedAt?: string;
}

export interface DailyTokenHirschSlackSeasonalKendallSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Hirsch-Slack 1984 sum-over-seasons S^{HS}. */
  hsS: number;
  /** Variance of S^{HS} under H0 with tie correction. */
  hsVar: number;
  /** Continuity-corrected standardised Z. */
  hsZ: number;
  /** Two-sided Normal-approximation p-value. */
  hsPValue: number;
  /** Aggregate seasonal Kendall tau in [-1, +1]. */
  hsTau: number;
  /** Number of seasons g (out of 7) with S_g > 0. */
  hsConcordantSeasons: number;
  /** hsConcordantSeasons / 7 in [0, 1]. */
  hsConcordanceRatio: number;
  /** Number of seasons with at least 3 observations. */
  hsActiveSeasons: number;
}

export interface DailyTokenHirschSlackSeasonalKendallReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHirschSlackSeasonalKendallSort;
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
  sources: DailyTokenHirschSlackSeasonalKendallSourceRow[];
}

/**
 * Standard Normal CDF Phi(z) via the Abramowitz-Stegun
 * 1964 eq. 7.1.26 rational erf approximation. Max abs
 * error ~1.5e-7.
 */
export function standardNormalCdfHirschSlack(z: number): number {
  if (!Number.isFinite(z)) {
    if (z === Number.POSITIVE_INFINITY) return 1;
    if (z === Number.NEGATIVE_INFINITY) return 0;
    throw new Error(`standardNormalCdfHirschSlack: z must be finite (got ${z})`);
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

export function twoSidedNormalPHirschSlack(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`twoSidedNormalPHirschSlack: z must be finite (got ${z})`);
  }
  const az = Math.abs(z);
  const upper = 1 - standardNormalCdfHirschSlack(az);
  const p = 2 * upper;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Within-season Mann-Kendall S statistic on a single
 * cohort. Returns S = sum_{j<k} sign(x_k - x_j).
 */
export function mannKendallSWithinSeason(values: number[]): number {
  const n = values.length;
  let s = 0;
  for (let j = 0; j < n - 1; j += 1) {
    for (let k = j + 1; k < n; k += 1) {
      const d = values[k]! - values[j]!;
      if (d > 0) s += 1;
      else if (d < 0) s -= 1;
    }
  }
  return s;
}

/**
 * Kendall 1975 sec. 4.2 tie-corrected variance of the
 * within-season Mann-Kendall S statistic:
 *
 *     Var(S) = ( n*(n-1)*(2*n+5) - sum_t t*(t-1)*(2*t+5) ) / 18
 *
 * where the inner sum is over groups of tied ranks with
 * t the size of each tie group.
 */
export function mannKendallVarianceWithinSeason(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const base = (n * (n - 1) * (2 * n + 5)) / 18;
  // tally ties
  const sorted = [...values].sort((a, b) => a - b);
  let tieAdjust = 0;
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j]! === sorted[i]!) j += 1;
    const t = j - i;
    if (t > 1) tieAdjust += (t * (t - 1) * (2 * t + 5)) / 18;
    i = j;
  }
  return base - tieAdjust;
}

/**
 * Hirsch-Slack 1984 seasonal Mann-Kendall trend test on a
 * gap-filled daily token series with period s = 7.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - hsS sums to 0 for any series whose every weekday
 *     cohort is constant (all sign(.) = 0).
 *   - hsS > 0 iff the across-cohort majority of within-
 *     cohort sign-differences is positive.
 *   - hsTau in [-1, +1]; equals +1 iff every cohort is
 *     strictly increasing across weeks (no ties); equals
 *     -1 iff every cohort is strictly decreasing.
 *   - hsConcordantSeasons in {0, .., hsActiveSeasons}.
 *   - The test is INVARIANT under any per-cohort additive
 *     shift (mean-centering each cohort separately leaves
 *     hsS, hsVar, hsZ, hsPValue unchanged).
 *   - REVERSING the entire series along time NEGATES hsS
 *     and hsZ (sign flips on every comparison) but
 *     preserves hsVar and hsPValue.
 */
export function dailyTokenHirschSlackSeasonalKendall(weights: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  hsS: number;
  hsVar: number;
  hsZ: number;
  hsPValue: number;
  hsTau: number;
  hsConcordantSeasons: number;
  hsConcordanceRatio: number;
  hsActiveSeasons: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenHirschSlackSeasonalKendall: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenHirschSlackSeasonalKendall requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenHirschSlackSeasonalKendall requires non-negative weights',
      );
    }
  }
  // mean / stddev for diagnostic surface
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
      `dailyTokenHirschSlackSeasonalKendall: zero centred variance (n=${n})`,
    );
  }
  // partition into 7 cohorts
  const cohorts: number[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < n; i += 1) {
    cohorts[i % 7]!.push(weights[i]!);
  }
  let hsS = 0;
  let hsVar = 0;
  let hsConcordantSeasons = 0;
  let hsActiveSeasons = 0;
  let pairsTotal = 0;
  for (let g = 0; g < 7; g += 1) {
    const cohort = cohorts[g]!;
    if (cohort.length < 3) continue;
    hsActiveSeasons += 1;
    const sg = mannKendallSWithinSeason(cohort);
    const vg = mannKendallVarianceWithinSeason(cohort);
    hsS += sg;
    hsVar += vg;
    if (sg > 0) hsConcordantSeasons += 1;
    pairsTotal += (cohort.length * (cohort.length - 1)) / 2;
  }
  if (hsActiveSeasons < 3) {
    throw new Error(
      `dailyTokenHirschSlackSeasonalKendall: too few active seasons (${hsActiveSeasons} < 3); n=${n}`,
    );
  }
  if (hsVar <= 0 || !Number.isFinite(hsVar)) {
    throw new Error(
      `dailyTokenHirschSlackSeasonalKendall: non-positive Var(S^{HS})=${hsVar} (n=${n})`,
    );
  }
  // continuity-corrected Z
  let hsZ: number;
  if (hsS > 0) hsZ = (hsS - 1) / Math.sqrt(hsVar);
  else if (hsS < 0) hsZ = (hsS + 1) / Math.sqrt(hsVar);
  else hsZ = 0;
  if (!Number.isFinite(hsZ)) {
    throw new Error(
      `dailyTokenHirschSlackSeasonalKendall: non-finite Z (n=${n})`,
    );
  }
  const hsPValue = twoSidedNormalPHirschSlack(hsZ);
  const hsTau = pairsTotal > 0 ? hsS / pairsTotal : 0;
  const hsConcordanceRatio = hsConcordantSeasons / 7;
  return {
    mean,
    stddev,
    nSamples: n,
    hsS,
    hsVar,
    hsZ,
    hsPValue,
    hsTau,
    hsConcordantSeasons,
    hsConcordanceRatio,
    hsActiveSeasons,
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

export function buildDailyTokenHirschSlackSeasonalKendall(
  queue: QueueLine[],
  opts: DailyTokenHirschSlackSeasonalKendallOptions = {},
): DailyTokenHirschSlackSeasonalKendallReport {
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
  const sort: DailyTokenHirschSlackSeasonalKendallSort = opts.sort ?? 'hsAbsZDesc';
  const validSorts: DailyTokenHirschSlackSeasonalKendallSort[] = [
    'hsZ',
    'hsZDesc',
    'hsAbsZDesc',
    'hsPValue',
    'hsPValueDesc',
    'hsTau',
    'hsTauDesc',
    'hsConcordantSeasonsDesc',
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
  const rows: DailyTokenHirschSlackSeasonalKendallSourceRow[] = [];

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
      result = dailyTokenHirschSlackSeasonalKendall(filled);
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
      hsS: result.hsS,
      hsVar: result.hsVar,
      hsZ: result.hsZ,
      hsPValue: result.hsPValue,
      hsTau: result.hsTau,
      hsConcordantSeasons: result.hsConcordantSeasons,
      hsConcordanceRatio: result.hsConcordanceRatio,
      hsActiveSeasons: result.hsActiveSeasons,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hsZ':
        primary = a.hsZ - b.hsZ;
        break;
      case 'hsZDesc':
        primary = b.hsZ - a.hsZ;
        break;
      case 'hsAbsZDesc':
        primary = Math.abs(b.hsZ) - Math.abs(a.hsZ);
        break;
      case 'hsPValue':
        primary = a.hsPValue - b.hsPValue;
        break;
      case 'hsPValueDesc':
        primary = b.hsPValue - a.hsPValue;
        break;
      case 'hsTau':
        primary = a.hsTau - b.hsTau;
        break;
      case 'hsTauDesc':
        primary = b.hsTau - a.hsTau;
        break;
      case 'hsConcordantSeasonsDesc':
        primary = b.hsConcordantSeasons - a.hsConcordantSeasons;
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
