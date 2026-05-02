/**
 * daily-token-bartels-rank-von-neumann: per-source BARTELS
 * RANK VON NEUMANN RATIO TEST FOR RANDOMNESS on the gap-
 * filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-TWELFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Replace each x[i] by its mid-rank R[i] in {1, .., n} (ties
 * broken by mid-rank), let Rbar = (n + 1) / 2, and define
 * the BARTELS RANK VON NEUMANN STATISTIC (Bartels 1982,
 * JASA 77(377):40-46):
 *
 *     RVN = sum_{i=0..n-2} (R[i+1] - R[i])^2
 *           / sum_{i=0..n-1} (R[i] - Rbar)^2
 *
 * Equivalently (Bartels 1982 eq. 1, after substituting
 * the closed-form denominator for ranks 1..n with mid-
 * rank ties):
 *
 *     denom = sum (R[i] - Rbar)^2
 *           = n * (n^2 - 1) / 12   (no ties)
 *
 * The BARTELS RANK VON NEUMANN RATIO is asymptotically
 * normal under the iid null:
 *
 *     E[RVN]   = 2
 *     Var[RVN] = 4 * (n - 2) * (5 n^2 - 2 n - 9) / (5 n (n + 1) (n - 1)^2)
 *              -> 4/n              for large n
 *
 * (Bartels 1982 sec. 2; Wackerly, Mendenhall & Scheaffer
 * 2008 ch. 15; Conover 1999 ch. 3.5.) The standardised
 * score
 *
 *     bZ = (RVN - 2) / sqrt(Var[RVN])
 *
 * is approximately N(0, 1) for n >= 10. RVN < 2 indicates
 * positive serial dependence (consecutive ranks too close
 * together -> trend or persistence); RVN > 2 indicates
 * negative serial dependence (consecutive ranks too far
 * apart -> oscillation / mean-reversion); RVN approx 2
 * indicates iid randomness.
 *
 * CLOSED-FORM RANK NULL. Under the null hypothesis of
 * exchangeability, the rank vector is a uniform random
 * permutation of {1, .., n}, and the moments of RVN are
 * known in closed form (Bartels 1982 Theorem 1). We use
 * the asymptotic Var[RVN] for the standardised score and
 * surface n_ties separately so the operator can audit
 * the mid-rank correction load (substantial in the gap-
 * filled regime where zero-padded days collide).
 *
 * (Bartels, R., "The rank version of von Neumann's ratio
 * test for randomness", Journal of the American
 * Statistical Association 77 (1982), pp. 40-46;
 * von Neumann, J., "Distribution of the ratio of the mean
 * square successive difference to the variance", Annals
 * of Mathematical Statistics 12 (1941), pp. 367-395;
 * Conover, W. J., "Practical Nonparametric Statistics",
 * 3rd ed., Wiley, 1999, ch. 3.5.)
 *
 * Reported alongside `bartelsRvn`: the rank denominator,
 * the rank numerator, the standardised score `bartelsZ`,
 * the number of ties n_ties, and the asymptotic variance
 * `bartelsVar`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-111:
 *
 *   - Class. RANDOMNESS-TEST (rank-based mean-square
 *     successive-difference), specifically the von Neumann
 *     ratio applied to MID-RANKS rather than raw values
 *     (Bartels 1982). Rank-based -> scale-and-monotone
 *     invariant; consecutive-rank squared differences ->
 *     local serial-dependence sensitivity; closed-form
 *     Gaussian null.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is the HALF-SHIFT BINOMIAL SIGN-TEST on
 *     floor(n/2) paired comparisons at lag c = floor(n/2);
 *     functional form is Binomial(k, 1/2), output in
 *     [-1, +1]. Bartels is the SUM OF SQUARED ADJACENT-
 *     RANK DIFFERENCES at lag 1 (consecutive pairs);
 *     functional form is Gaussian rank-permutation null,
 *     output in [0, 4]. Sample space differs (n - 1
 *     adjacent-rank squared differences vs floor(n/2)
 *     paired sign events), functional family differs
 *     (squared rank diff vs binary sign), lag scale
 *     differs (1 vs floor(n/2)). A series with strong
 *     half-shift drift but iid-shuffled within each half
 *     has csTau approx +1 but RVN approx 2 (random within-
 *     half makes adjacent ranks far apart, killing
 *     serial dependence at lag 1). Conversely, a series
 *     that locally clusters (ranks 1,2,3 then 8,9,10
 *     then 4,5,6 then ...) has RVN much less than 2 but
 *     csTau approx 0.
 *
 *   - vs daily-token-runs-test-z (Wald-Wolfowitz median-
 *     binarised maximal-run count). Wald-Wolfowitz counts
 *     MAXIMAL RUNS in the median-binarised sequence
 *     (s_1, .., s_n) where s_i = sgn(x_i - median);
 *     Bartels uses the FULL ORDINAL RANKS R[i] in
 *     {1, .., n} rather than a binary sign. Bartels is
 *     thus strictly finer than Wald-Wolfowitz: a series
 *     where consecutive observations alternate just-above
 *     / just-below the median has many runs (high WW z)
 *     and ranks that locally jump (high RVN); but a
 *     series with small consecutive rank steps but
 *     median-balanced clusters has low WW runs (clusters
 *     above-then-below) and high RVN (large rank steps
 *     between cluster boundaries) -- opposite signs.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. Mann-
 *     Kendall is the GLOBAL ALL-PAIRS Kendall U-statistic
 *     summing sign(R[j] - R[i]) over n*(n-1)/2 pairs
 *     i < j. Bartels is the SUM OF SQUARED ADJACENT
 *     differences at lag 1, sensitive to LOCAL serial
 *     structure rather than global monotonic concordance.
 *     A series with a single global up-trend (e.g.
 *     1,2,3,4,5,6,7,8,9,10) has tau_MK = +1 AND RVN very
 *     low (consecutive rank diffs all = 1, sum = n-1,
 *     denom much larger). A series with no global trend
 *     but strong local serial correlation (1,2,3,4,5,6,
 *     5,4,3,2,1) has tau_MK approx 0 but RVN low.
 *
 *   - vs axes 107 / 108 (spearman-lag-1 / kendall-tau-
 *     lag-1 autocorrelation). Both are LAG-1 RANK
 *     CORRELATIONS using either Spearman rho or Kendall
 *     tau on the (R[i], R[i+1]) pairs. Bartels uses the
 *     SUM OF SQUARED DIFFERENCES (R[i+1] - R[i])^2, which
 *     is the L2 form of the same lag-1 information; the
 *     two are mathematically distinct functionals (a
 *     correlation is normalised cross-product; Bartels is
 *     unnormalised squared difference, with closed-form
 *     null distribution from von Neumann 1941). For a
 *     given lag-1 Spearman rho, RVN equals
 *     2 * (1 - rho_S * (n - 1) / n) (Bartels 1982 eq. 3),
 *     so Bartels and Spearman-lag-1 are MONOTONE
 *     RELATED -- but the test statistic, asymptotic null
 *     distribution, and operator-facing semantics
 *     (randomness-test vs autocorrelation) are different.
 *     For lag-1 Kendall tau there is NO such linear
 *     relation: tau measures concordance of pair signs,
 *     not squared rank distances.
 *
 *   - vs axes 105 / 106 (zero-crossing rate / turning-
 *     point rate). LOCAL counting statistics on
 *     consecutive sign-changes (level / first-difference
 *     sign). Bartels is a LAG-1 SQUARED-RANK-DIFFERENCE
 *     statistic with closed-form Gaussian null --
 *     entirely distinct primitive.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     ...). PERMUTATION-INVARIANT functionals of the
 *     empirical distribution. Bartels depends entirely on
 *     the TEMPORAL ORDER of ranks; a uniformly random
 *     permutation has E[RVN] = 2 regardless of the
 *     underlying value distribution.
 *
 *   - vs the spectral axes (84-104). PSD axes are time-
 *     reversal symmetric and operate on the raw value
 *     sequence. Bartels operates on the rank sequence
 *     and is also time-reversal symmetric (squared
 *     adjacent differences invariant under reversal),
 *     but the family is rank-based randomness-test, not
 *     frequency-domain energy decomposition.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes. Those
 *     are scaling exponents fit across multiple window
 *     sizes; Bartels is a single lag-1 rank statistic
 *     with a closed-form Gaussian null and is the
 *     canonical rank version of the von Neumann ratio
 *     test for randomness (Bartels 1982).
 *
 * Headline question:
 * **"For each source, do the daily token totals exhibit
 *   lag-1 rank-based serial structure -- i.e. are
 *   consecutive ranked days too-close (positive serial
 *   dependence, RVN < 2) or too-far (oscillation,
 *   RVN > 2) compared to a uniform-permutation null?"**
 *
 * Reference:
 *   Bartels, R., "The rank version of von Neumann's ratio
 *     test for randomness", Journal of the American
 *     Statistical Association 77 (1982), pp. 40-46.
 *   von Neumann, J., "Distribution of the ratio of the
 *     mean square successive difference to the variance",
 *     Annals of Mathematical Statistics 12 (1941),
 *     pp. 367-395.
 *   Conover, W. J., "Practical Nonparametric Statistics",
 *     3rd ed., Wiley, 1999, ch. 3.5.
 *
 * Caveats:
 *
 *   - RVN in [0, 4]. RVN approx 2 = randomness; RVN < 2
 *     = positive serial correlation (trend or
 *     persistence); RVN > 2 = oscillation / mean-
 *     reversion.
 *   - bZ approx N(0, 1) for n >= 10 (Bartels 1982 sec.
 *     3). For smaller n use the exact tabulated critical
 *     values from Bartels 1982 Table 1.
 *   - Mid-rank ties handling. We use the standard mid-
 *     rank convention (average rank assigned to each tie
 *     group). In the gap-filled regime zero-padded days
 *     all share the lowest mid-rank, which heavily
 *     deflates squared adjacent-rank differences when
 *     consecutive zeros appear; we surface nTies for
 *     triage.
 *   - The asymptotic variance Var[RVN] = 4(n-2)(5n^2 -
 *     2n - 9) / (5n(n+1)(n-1)^2) is the no-ties form
 *     (Bartels 1982 Theorem 1). With ties the variance
 *     is approximate; we report the standardised score
 *     using the closed-form no-ties variance and surface
 *     nTies as a confidence indicator.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-bartels-rank-von-neumann
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-bartels-rank-von-neumann \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # rank serial dependence first):
 *   pew-insights daily-token-bartels-rank-von-neumann \
 *     --sort bZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenBartelsRankVonNeumannSort =
  | 'rvn'
  | 'rvnDesc'
  | 'bZ'
  | 'bZDesc'
  | 'bZAbs'
  | 'bZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBartelsRankVonNeumannOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBartelsRankVonNeumannSort;
  generatedAt?: string;
}

export interface DailyTokenBartelsRankVonNeumannSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Number of mid-rank ties (rank groups of size > 1 contribute their size). */
  nTies: number;
  /** Sum of squared adjacent-rank differences. */
  bartelsNumerator: number;
  /** Sum of squared rank deviations from mean rank (n+1)/2. */
  bartelsDenominator: number;
  /** Bartels rank von Neumann ratio in [0, 4]; ~2 under randomness null. */
  bartelsRvn: number;
  /** Closed-form asymptotic variance under the no-ties null. */
  bartelsVar: number;
  /** Standardised score (RVN - 2) / sqrt(Var); approx N(0,1) for n >= 10. */
  bartelsZ: number;
}

export interface DailyTokenBartelsRankVonNeumannReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBartelsRankVonNeumannSort;
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
  sources: DailyTokenBartelsRankVonNeumannSourceRow[];
}

/**
 * Compute mid-ranks (average rank for ties) for a real-
 * valued vector. Returns the rank vector and the count of
 * tied entries (entries belonging to a tie group of size
 * > 1).
 */
function midRanks(values: number[]): { ranks: number[]; nTies: number } {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let nTies = 0;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    // Group [i..j-1] gets average rank (1-indexed).
    const groupSize = j - i;
    const avgRank = (i + 1 + j) / 2; // (i+1) and j are 1-indexed inclusive bounds.
    for (let k = i; k < j; k += 1) {
      ranks[idx[k]!] = avgRank;
    }
    if (groupSize > 1) nTies += groupSize;
    i = j;
  }
  return { ranks, nTies };
}

/**
 * Bartels rank von Neumann ratio test for randomness on a
 * real-valued series.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, .., n)
 *     -> ranks (1,2,..,n), squared adjacent diffs all 1,
 *     numerator = n - 1, denominator = n(n^2-1)/12,
 *     RVN = 12(n-1) / (n(n^2-1)) = 12 / (n(n+1)) -> 0 for
 *     large n (extreme positive serial dependence).
 *   - perfectly oscillating ranks (1, n, 2, n-1, ..)
 *     yields RVN approaching 4 (extreme negative serial
 *     dependence).
 *   - constant series x = (c, c, .., c) -> all ranks tied
 *     at (n+1)/2, denominator = 0 -> undefined; we throw.
 *   - i.i.d. continuous sample -> E[RVN] = 2 (Bartels 1982).
 *
 * Throws when the series is too short, contains non-finite
 * entries, or has zero rank variance (all values equal).
 */
export function dailyTokenBartelsRankVonNeumann(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nTies: number;
  bartelsNumerator: number;
  bartelsDenominator: number;
  bartelsRvn: number;
  bartelsVar: number;
  bartelsZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenBartelsRankVonNeumann: need at least 4 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenBartelsRankVonNeumann requires finite values',
      );
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let varSum = 0;
  for (const val of values) {
    const d = val - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const { ranks, nTies } = midRanks(values);
  const meanRank = (n + 1) / 2;

  let numerator = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const d = ranks[i + 1]! - ranks[i]!;
    numerator += d * d;
  }
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const d = ranks[i]! - meanRank;
    denominator += d * d;
  }
  if (denominator === 0) {
    throw new Error(
      `dailyTokenBartelsRankVonNeumann: zero rank variance (all values equal, n=${n})`,
    );
  }
  const rvn = numerator / denominator;

  // Bartels 1982 Theorem 1 closed-form variance under the
  // no-ties uniform-permutation null:
  //   Var[RVN] = 4 (n-2)(5n^2 - 2n - 9) / (5 n (n+1)(n-1)^2)
  const bartelsVar =
    (4 * (n - 2) * (5 * n * n - 2 * n - 9)) /
    (5 * n * (n + 1) * (n - 1) * (n - 1));
  const sigma = Math.sqrt(bartelsVar);
  const bartelsZ = sigma > 0 ? (rvn - 2) / sigma : 0;
  if (!Number.isFinite(bartelsZ)) {
    throw new Error(
      `dailyTokenBartelsRankVonNeumann: non-finite bartelsZ (n=${n}, rvn=${rvn})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    nTies,
    bartelsNumerator: numerator,
    bartelsDenominator: denominator,
    bartelsRvn: rvn,
    bartelsVar,
    bartelsZ,
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

export function buildDailyTokenBartelsRankVonNeumann(
  queue: QueueLine[],
  opts: DailyTokenBartelsRankVonNeumannOptions = {},
): DailyTokenBartelsRankVonNeumannReport {
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
  const sort: DailyTokenBartelsRankVonNeumannSort = opts.sort ?? 'bZAbsDesc';
  const validSorts: DailyTokenBartelsRankVonNeumannSort[] = [
    'rvn',
    'rvnDesc',
    'bZ',
    'bZDesc',
    'bZAbs',
    'bZAbsDesc',
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
  const rows: DailyTokenBartelsRankVonNeumannSourceRow[] = [];

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
      result = dailyTokenBartelsRankVonNeumann(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenBartelsRankVonNeumannSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      nTies: result.nTies,
      bartelsNumerator: result.bartelsNumerator,
      bartelsDenominator: result.bartelsDenominator,
      bartelsRvn: result.bartelsRvn,
      bartelsVar: result.bartelsVar,
      bartelsZ: result.bartelsZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rvn':
        primary = a.bartelsRvn - b.bartelsRvn;
        break;
      case 'rvnDesc':
        primary = b.bartelsRvn - a.bartelsRvn;
        break;
      case 'bZ':
        primary = a.bartelsZ - b.bartelsZ;
        break;
      case 'bZDesc':
        primary = b.bartelsZ - a.bartelsZ;
        break;
      case 'bZAbs':
        primary = Math.abs(a.bartelsZ) - Math.abs(b.bartelsZ);
        break;
      case 'bZAbsDesc':
        primary = Math.abs(b.bartelsZ) - Math.abs(a.bartelsZ);
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
