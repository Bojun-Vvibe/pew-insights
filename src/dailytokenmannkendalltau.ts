/**
 * daily-token-mann-kendall-tau: per-source MANN-KENDALL
 * GLOBAL MONOTONIC TREND TAU on the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-TENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Define the Mann-Kendall S statistic
 *
 *     S = sum_{i<j} sgn(x[j] - x[i])
 *
 * where sgn returns +1, -1, or 0. The Mann-Kendall tau is
 * the normalised concordance score
 *
 *     tau_MK = S / (n * (n - 1) / 2)
 *
 * lying in [-1, +1]. tau_MK = +1 iff every pair (i, j) with
 * i < j has x[j] > x[i] (the series is strictly
 * increasing); tau_MK = -1 iff strictly decreasing;
 * tau_MK = 0 under the iid permutation null in expectation.
 *
 * Closed-form null distribution (Mann 1945; Kendall 1975).
 * Under the null hypothesis that x is a random permutation
 * of n distinct continuous values (no ties),
 *
 *     E[S]   = 0
 *     Var[S] = n * (n - 1) * (2*n + 5) / 18
 *
 * and S is asymptotically normal by Hoeffding's CLT for
 * U-statistics. With ties present we apply the standard
 * tie correction (Kendall 1945; Hipel & McLeod 1994,
 * Environmetrics monograph, eq. 17.1.5):
 *
 *     Var[S] = (n*(n-1)*(2n+5)
 *              - sum_g t_g*(t_g-1)*(2*t_g+5)) / 18
 *
 * where t_g is the size of the g-th group of tied values.
 * The continuity-corrected standardised score
 *
 *     MKZ = (S - sgn(S)) / sqrt(Var[S])    if S != 0
 *         = 0                              if S == 0
 *
 * is approximately N(0, 1) under the iid null.
 *
 * (Mann, H. B., "Nonparametric tests against trend",
 * Econometrica 13 (1945), pp. 245-259; Kendall, M. G.,
 * "Rank Correlation Methods", 4th ed., Charles Griffin,
 * London, 1975; Hipel, K. W. and McLeod, A. I.,
 * "Time Series Modelling of Water Resources and
 * Environmental Systems", Elsevier, 1994, ch. 23,
 * eq. 23.1.4-23.1.5.)
 *
 * Tie regime. In the gap-filled regime sparse days are
 * zero-padded so multiple indices may share the value 0.
 * The sgn function evaluates to 0 on tied pairs which
 * neither contributes to nor subtracts from S; the
 * tie-corrected variance accounts for the reduced effective
 * pair count. We surface `nTies` (number of tied pairs)
 * and `nConcordant`, `nDiscordant` as side-quantities for
 * triage.
 *
 * Reported alongside `mannKendallTau`: the raw `S` score,
 * `mannKendallVarS` (tie-corrected), `nConcordant`,
 * `nDiscordant`, `nTies`, and the standardised score
 * `mannKendallZ` (continuity-corrected).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS
 * IN 79-109:
 *
 *   - Class. MONOTONIC-TREND is a GLOBAL pairwise
 *     concordance statistic over ALL n*(n-1)/2 ordered
 *     index pairs. It is the exact U-statistic for the
 *     hypothesis "the joint distribution of (x[i], x[j])
 *     for i < j is symmetric in i, j" (Hoeffding 1948).
 *     No other axis in 79-109 is a global all-pairs
 *     concordance count.
 *
 *   - vs axis-108 daily-token-kendall-tau-autocorrelation-
 *     lag-1. Axis-108 is the LOCAL LAG-1 Kendall tau
 *     between consecutive pairs (x[i], x[i+1]); its sample
 *     space is restricted to the n-1 adjacent pairs.
 *     axis-110 is the GLOBAL all-pairs Kendall tau over
 *     the n*(n-1)/2 pairs. The two are functionally
 *     independent in the precise sense:
 *
 *       * a series x = (1, 2, 3, ..., n) has axis-108
 *         tau = +1 AND axis-110 tau = +1 (extreme of both)
 *       * a series x with two halves (1..n/2, n/2..1) -- a
 *         tent -- has axis-108 tau approx 0 (alternating
 *         monotone runs) but axis-110 tau much closer to 0
 *         too: same value.
 *       * a series x = shuffle of (1..n) with the LARGEST
 *         element placed last has lag-1 tau approx 0 but
 *         axis-110 S boosted by n-1 concordant pairs
 *         (j = n - 1 vs all i < n - 1), shifting tau_MK
 *         away from zero.
 *       * a series with one big late spike on top of an
 *         iid background: lag-1 Kendall tau is dominated
 *         by the iid bulk and remains near 0; axis-110 S
 *         picks up the systematic late-loaded mass and
 *         tau_MK becomes positive. Same sign-pattern but
 *         different magnitude regime.
 *
 *     Intuitively: axis-108 measures LOCAL serial
 *     dependence (lag-1); axis-110 measures the GLOBAL
 *     monotonic trend.
 *
 *   - vs axis-107 daily-token-spearman-autocorrelation-lag-
 *     1. Same local vs global distinction: Spearman lag-1
 *     is a single-lag rank-correlation. Mann-Kendall is the
 *     full all-pairs rank-correlation, which is what
 *     ENVIRONMENTAL TREND DETECTION uses (see Hirsch &
 *     Slack 1984, Water Resources Research) precisely
 *     because lag-k autocorrelations cannot detect a
 *     monotone drift.
 *
 *   - vs axis-109 daily-token-upper-records-count.
 *     Records-count is the integer cardinality of the set
 *     of prefix-max-strict-improvement events; it is a
 *     COUNTING statistic with a Bernoulli-convolution null
 *     (Renyi 1962). Mann-Kendall is a NORMALISED PAIR-
 *     CONCORDANCE statistic with a Gaussian null. They
 *     differ in sample space (n events vs n*(n-1)/2 pairs)
 *     and in functional form (count vs ratio). A series
 *     "1, 2, 3, ..., n" has both R_n = n AND tau_MK = +1
 *     (extremes coincide), but a series with one big late
 *     spike on a constant baseline has R_n = 2 (only two
 *     records: index 0 and the spike) but tau_MK > 0
 *     because the spike creates n-1 concordant pairs.
 *
 *   - vs axes 105 / 106 (zero-crossing rate / turning-
 *     point rate). Those are LOCAL counting statistics
 *     based on consecutive sign-changes (level or first-
 *     difference). Mann-Kendall is GLOBAL all-pairs and
 *     is invariant to the order of any same-sign run.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson, ...).
 *     Those are PERMUTATION-INVARIANT functionals of the
 *     empirical distribution. Mann-Kendall depends on the
 *     TEMPORAL ORDER. A reverse-sorted permutation of x
 *     has identical Gini / Atkinson but tau_MK negated.
 *
 *   - vs the spectral axes (84-104). PSD axes are time-
 *     reversal symmetric (the periodogram drops phase).
 *     Mann-Kendall is anti-symmetric under time reversal
 *     (S -> -S), so it cannot be reconstructed from any
 *     spectral functional.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes. Those
 *     are scaling exponents fit across multiple window
 *     sizes; Mann-Kendall is a single scalar in [-1, +1]
 *     with a closed-form Gaussian null and is the standard
 *     non-parametric trend test in environmetrics
 *     (Hirsch-Slack-Smith 1982).
 *
 *   - vs runs-test / monotone-run-length / second-
 *     difference sign-runs. Those are conditional on
 *     consecutive sign blocks; Mann-Kendall counts
 *     concordant vs discordant pairs over all index pairs.
 *
 * Headline question:
 * **"For each source, do the daily token totals exhibit a
 *   GLOBAL monotonic trend across the entire gap-filled
 *   tenure -- and is the trend sign and magnitude
 *   significant under the iid permutation null?"**
 *
 * Reference:
 *   Mann, H. B., "Nonparametric tests against trend",
 *     Econometrica 13 (1945), pp. 245-259.
 *   Kendall, M. G., "Rank Correlation Methods", 4th ed.,
 *     Charles Griffin, London, 1975.
 *   Hipel, K. W. and McLeod, A. I., "Time Series Modelling
 *     of Water Resources and Environmental Systems",
 *     Elsevier, 1994, ch. 23 (tie correction eq. 23.1.4-
 *     23.1.5).
 *   Hirsch, R. M. and Slack, J. R., "A nonparametric trend
 *     test for seasonal data with serial dependence",
 *     Water Resources Research 20(6) (1984), pp. 727-732.
 *
 * Caveats:
 *
 *   - tau_MK in [-1, +1]. Sign is the trend direction.
 *   - The variance correction assumes ties are exchangeable
 *     within tied groups. In the zero-padded daily-token
 *     regime, the tied-group at zero can be a substantial
 *     fraction of n; the tie-corrected variance handles
 *     this exactly.
 *   - The continuity correction (S - sgn(S)) follows
 *     Kendall 1975 ch. 4 and is appropriate for moderate
 *     n. For very large n it is numerically negligible.
 *   - Mann-Kendall does NOT assume the trend is linear; it
 *     detects ANY monotone (concordant-pair-majority)
 *     trend.
 *   - Complexity. The S accumulator is O(n^2) by design
 *     (every i<j pair is enumerated). For tenures up to a
 *     few thousand days this is well under a millisecond;
 *     no Knight (1966) merge-sort O(n log n) optimisation
 *     is warranted at this scale and the explicit pair
 *     loop keeps the tie semantics auditable.
 *   - The tie-correction tied-group keys are the raw
 *     numerical values; no bucketing or rounding is
 *     applied. In the gap-filled regime the dominant tied
 *     group is the integer 0 (zero-padded sparse days),
 *     which the JavaScript Map keys exactly.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-mann-kendall-tau
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-mann-kendall-tau \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest trend
 *   # first):
 *   pew-insights daily-token-mann-kendall-tau \
 *     --sort mkZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenMannKendallTauSort =
  | 'tau'
  | 'tauDesc'
  | 'tauAbs'
  | 'tauAbsDesc'
  | 'mkZ'
  | 'mkZDesc'
  | 'mkZAbs'
  | 'mkZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMannKendallTauOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMannKendallTauSort;
  generatedAt?: string;
}

export interface DailyTokenMannKendallTauSourceRow {
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
  /** Mann-Kendall S = sum_{i<j} sgn(x[j] - x[i]). */
  mannKendallS: number;
  /** Tie-corrected Var[S]. */
  mannKendallVarS: number;
  /** Number of concordant ordered pairs (sgn > 0). */
  nConcordant: number;
  /** Number of discordant ordered pairs (sgn < 0). */
  nDiscordant: number;
  /** Number of tied ordered pairs (sgn == 0). */
  nTies: number;
  /** tau_MK = S / (n*(n-1)/2) in [-1, +1]. */
  mannKendallTau: number;
  /** Continuity-corrected standardised score (S - sgn(S))/sqrt(Var[S]). */
  mannKendallZ: number;
}

export interface DailyTokenMannKendallTauReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMannKendallTauSort;
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
  sources: DailyTokenMannKendallTauSourceRow[];
}

/**
 * Mann-Kendall global monotonic trend tau on a real-valued
 * series.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, .., n)
 *     -> S = n*(n-1)/2, tau = +1.
 *   - strictly monotone decreasing series x = (n, .., 1)
 *     -> S = -n*(n-1)/2, tau = -1.
 *   - constant series x = (c, c, .., c)
 *     -> S = 0, tau = 0, all pairs tied.
 *   - i.i.d. continuous sample
 *     -> E[S] = 0, Var[S] = n*(n-1)*(2n+5)/18 (Mann 1945).
 *
 * Throws when the series is too short or contains
 * non-finite entries.
 */
export function dailyTokenMannKendallTau(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  mannKendallS: number;
  mannKendallVarS: number;
  nConcordant: number;
  nDiscordant: number;
  nTies: number;
  mannKendallTau: number;
  mannKendallZ: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenMannKendallTau: need at least 3 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenMannKendallTau requires finite values');
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

  // O(n^2) Mann-Kendall S accumulation. n is bounded by
  // tenure days (typically a few hundred) so this is fine.
  let S = 0;
  let nConc = 0;
  let nDisc = 0;
  let nTie = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const xi = values[i]!;
    for (let j = i + 1; j < n; j += 1) {
      const xj = values[j]!;
      if (xj > xi) {
        S += 1;
        nConc += 1;
      } else if (xj < xi) {
        S -= 1;
        nDisc += 1;
      } else {
        nTie += 1;
      }
    }
  }

  const totalPairs = (n * (n - 1)) / 2;
  const mannKendallTau = totalPairs > 0 ? S / totalPairs : 0;

  // Tie-corrected Var[S] (Kendall 1945; Hipel-McLeod 1994).
  // Var[S] = ( n*(n-1)*(2n+5) - sum_g t_g*(t_g-1)*(2*t_g+5) ) / 18
  const groupSizes = new Map<number, number>();
  for (const v of values) {
    groupSizes.set(v, (groupSizes.get(v) ?? 0) + 1);
  }
  let tieAdjust = 0;
  for (const t of groupSizes.values()) {
    if (t > 1) {
      tieAdjust += t * (t - 1) * (2 * t + 5);
    }
  }
  const baseVar = n * (n - 1) * (2 * n + 5);
  const mannKendallVarS = (baseVar - tieAdjust) / 18;

  let mannKendallZ = 0;
  if (n >= 4 && mannKendallVarS > 0) {
    if (S > 0) {
      mannKendallZ = (S - 1) / Math.sqrt(mannKendallVarS);
    } else if (S < 0) {
      mannKendallZ = (S + 1) / Math.sqrt(mannKendallVarS);
    } else {
      mannKendallZ = 0;
    }
  }
  if (!Number.isFinite(mannKendallZ)) {
    throw new Error(
      `dailyTokenMannKendallTau: non-finite mannKendallZ (n=${n}, S=${S}, varS=${mannKendallVarS})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mannKendallS: S,
    mannKendallVarS,
    nConcordant: nConc,
    nDiscordant: nDisc,
    nTies: nTie,
    mannKendallTau,
    mannKendallZ,
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

export function buildDailyTokenMannKendallTau(
  queue: QueueLine[],
  opts: DailyTokenMannKendallTauOptions = {},
): DailyTokenMannKendallTauReport {
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
  const sort: DailyTokenMannKendallTauSort = opts.sort ?? 'mkZAbsDesc';
  const validSorts: DailyTokenMannKendallTauSort[] = [
    'tau',
    'tauDesc',
    'tauAbs',
    'tauAbsDesc',
    'mkZ',
    'mkZDesc',
    'mkZAbs',
    'mkZAbsDesc',
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
  const rows: DailyTokenMannKendallTauSourceRow[] = [];

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
      result = dailyTokenMannKendallTau(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenMannKendallTauSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      mannKendallS: result.mannKendallS,
      mannKendallVarS: result.mannKendallVarS,
      nConcordant: result.nConcordant,
      nDiscordant: result.nDiscordant,
      nTies: result.nTies,
      mannKendallTau: result.mannKendallTau,
      mannKendallZ: result.mannKendallZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tau':
        primary = a.mannKendallTau - b.mannKendallTau;
        break;
      case 'tauDesc':
        primary = b.mannKendallTau - a.mannKendallTau;
        break;
      case 'tauAbs':
        primary = Math.abs(a.mannKendallTau) - Math.abs(b.mannKendallTau);
        break;
      case 'tauAbsDesc':
        primary = Math.abs(b.mannKendallTau) - Math.abs(a.mannKendallTau);
        break;
      case 'mkZ':
        primary = a.mannKendallZ - b.mannKendallZ;
        break;
      case 'mkZDesc':
        primary = b.mannKendallZ - a.mannKendallZ;
        break;
      case 'mkZAbs':
        primary = Math.abs(a.mannKendallZ) - Math.abs(b.mannKendallZ);
        break;
      case 'mkZAbsDesc':
        primary = Math.abs(b.mannKendallZ) - Math.abs(a.mannKendallZ);
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
