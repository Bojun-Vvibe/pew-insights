/**
 * daily-token-difference-sign-test: per-source MOOD
 * DIFFERENCE-SIGN TEST FOR TREND on the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Form the n - 1 first differences d[i] = x[i+1] - x[i]
 * for i in 0..n-2. Define
 *
 *     S+ = #{ i : d[i] > 0 }    (positive sign count)
 *     S- = #{ i : d[i] < 0 }    (negative sign count)
 *     S0 = #{ i : d[i] = 0 }    (tied / zero-step count)
 *
 * The MOOD DIFFERENCE-SIGN STATISTIC (Brockwell & Davis
 * 1991 sec. 1.6; Kendall & Stuart 1976 vol. 3 sec. 45)
 * is the count of strictly-positive first differences:
 *
 *     S = S+
 *
 * Under the iid CONTINUOUS null (so ties have probability
 * zero), each d[i] has P(d[i] > 0) = 1/2 independently of
 * the marginal distribution, and so
 *
 *     S ~ Binomial(n - 1, 1/2)
 *     E[S]   = (n - 1) / 2
 *     Var[S] = (n - 1) / 4
 *
 * The asymptotic standardised score
 *
 *     dZ = (S - (n - 1) / 2) / sqrt((n - 1) / 4)
 *
 * is approximately N(0, 1) for n - 1 >= 20. dZ > 1.96
 * indicates significant positive trend (more "ups" than
 * expected); dZ < -1.96 significant negative trend.
 *
 * MID-RANK / TIE HANDLING. The closed-form Binomial null
 * assumes a continuous distribution. With discrete or
 * gap-filled count data we get S0 zero-difference events;
 * we report S0 as `nZeroSteps` so the operator can audit
 * tie load. The standardised score uses the full (n - 1)
 * denominator (no tie correction); the conservative
 * tie-corrected variant is documented in the caveats.
 *
 * The DIFFERENCE-SIGN STATISTIC is a TREND test: it has
 * no power against periodic / oscillating alternatives
 * (e.g. a sinusoid has S approx (n-1)/2). For short-range
 * serial-correlation alternatives use Bartels (axis-112)
 * or runs-test-z; for global monotone concordance use
 * Mann-Kendall (axis-110); for distributional inequality
 * use Gini / Atkinson / Theil etc.
 *
 * (Mood, A. M., "Introduction to the Theory of Statistics",
 *  McGraw-Hill, 1950, sec. 16.10; Brockwell, P. J. and
 *  Davis, R. A., "Time Series: Theory and Methods", 2nd
 *  ed., Springer, 1991, sec. 1.6 "Tests of Randomness";
 *  Kendall, M. G. and Stuart, A., "The Advanced Theory
 *  of Statistics", vol. 3, 3rd ed., Griffin, 1976,
 *  sec. 45.10.)
 *
 * Reported alongside `dsS`: the negative count `dsSneg`,
 * the zero-step count `dsSzero`, the standardised score
 * `dsZ`, the asymptotic variance `dsVar`, and the
 * effective sample size n - 1 as `dsN`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-112:
 *
 *   - Class. TREND-TEST (binomial sign-test on first
 *     differences), specifically the count of positive
 *     first differences with a Binomial(n-1, 1/2) null.
 *     Sign-based -> distribution-free; first-difference
 *     -> local trend sensitivity at lag 1; closed-form
 *     binomial null with asymptotic normal approximation.
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann.
 *     Bartels is the SUM OF SQUARED ADJACENT-RANK
 *     DIFFERENCES at lag 1 with a closed-form GAUSSIAN
 *     null (output in [0, 4]). Mood is the COUNT OF
 *     POSITIVE FIRST DIFFERENCES with a closed-form
 *     BINOMIAL null (output in {0, 1, .., n-1}).
 *     Functional family differs (squared rank diff vs
 *     binary sign of raw difference), null differs
 *     (Gaussian vs Binomial), test direction differs
 *     (Bartels is two-sided randomness; Mood is
 *     directional trend). A perfectly oscillating
 *     series 1, 10, 2, 11, 3, 12, ... has RVN -> 4
 *     (extreme negative serial dependence) but Mood S
 *     approx n/2 (alternating signs cancel). Conversely,
 *     a slow monotone trend 1, 2, 3, .., n has RVN -> 0
 *     AND Mood S = n - 1 (extreme of both, but for
 *     different reasons -- Bartels detects local
 *     persistence, Mood detects directional drift).
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is also a binomial sign-test for
 *     trend, but it pairs observations at LAG c =
 *     floor(n/2) (first half vs second half) and counts
 *     positive sign-pairs from floor(n/2) comparisons.
 *     Mood operates at LAG 1 with n - 1 comparisons.
 *     Sample size differs (n-1 vs floor(n/2)); lag
 *     differs (1 vs floor(n/2)); detection differs
 *     (Cox-Stuart catches LARGE-SCALE half-shift drift;
 *     Mood catches LOCAL incremental trend). A series
 *     1, 1, 1, .., 1, 2, 2, .., 2 (constant then jump,
 *     then constant) has csTau approx +1 (clean half-
 *     shift) but Mood S = 1 (only ONE positive
 *     difference at the jump, the rest zero -> very
 *     few "ups"); a saw-tooth ramp 1, 2, 3, 4, 1, 2,
 *     3, 4, .. has Mood S much greater than (n-1)/2
 *     (mostly +1 steps with occasional resets) but
 *     csTau approx 0 (first-half mean = second-half
 *     mean by symmetry).
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. Mann-
 *     Kendall sums sign(x[j] - x[i]) over ALL n*(n-1)/2
 *     PAIRS i < j -- a global concordance statistic.
 *     Mood sums sign(x[i+1] - x[i]) over only the n - 1
 *     ADJACENT pairs. A series with strong global trend
 *     and no local noise has tau_MK = +1 AND Mood
 *     S = n - 1; a series with global trend but high
 *     local noise has tau_MK > 0 but Mood S can be
 *     close to (n-1)/2 (local diffs have mixed signs).
 *     Sample space differs by O(n) -- Mann-Kendall is
 *     O(n^2) pairs, Mood is O(n) pairs.
 *
 *   - vs daily-token-runs-test-z (Wald-Wolfowitz median-
 *     binarised maximal-run count). Wald-Wolfowitz
 *     binarises by MEDIAN (s_i = sgn(x_i - median)) and
 *     counts MAXIMAL RUNS of identical signs; the null
 *     is the asymptotic Gaussian for run count, which
 *     is the chi-square / runs statistic on sign
 *     transitions. Mood binarises by ADJACENT
 *     DIFFERENCE (sgn(x[i+1] - x[i])) and SUMS the
 *     positive signs; the null is Binomial(n-1, 1/2)
 *     on the count. Both are sign-based but the
 *     binarisation operator differs (level vs first-
 *     difference), the aggregation differs (run count
 *     vs sum), and the detection target differs
 *     (randomness of level signs vs trend in
 *     differences). A median-balanced trendless series
 *     with rapid alternation has WW many runs but Mood
 *     S approx (n-1)/2.
 *
 *   - vs axes 105 / 106 (zero-crossing-rate / turning-
 *     point-rate). Zero-crossing-rate counts sign
 *     changes around the MEAN; turning-point-rate
 *     counts LOCAL EXTREMA (where sign of d[i]
 *     differs from sign of d[i-1]). Mood counts the
 *     sign of d[i] itself, NOT sign changes between
 *     consecutive d[i]. A monotone-up series 1,2,..,n
 *     has zero-crossing-rate = 0 (no mean crossings),
 *     turning-point-rate = 0 (no extrema), and Mood
 *     S = n - 1 (every difference positive). The three
 *     statistics measure different primitives: level
 *     crossings, second-difference sign changes, and
 *     first-difference sign sums respectively.
 *
 *   - vs axes 107 / 108 (spearman-lag-1 / kendall-tau-
 *     lag-1 autocorrelation). Both are LAG-1 RANK
 *     CORRELATIONS using normalised cross-products on
 *     the (R[i], R[i+1]) pairs. Mood is a SUM OF
 *     SIGNS of first DIFFERENCES, not a correlation.
 *     A monotone-up series has rho_S(1) -> 1 AND
 *     Mood S = n - 1; a permutation-randomised series
 *     has rho_S(1) approx 0 AND Mood S approx (n-1)/2.
 *     But the relation is non-monotone in general:
 *     a series with strong negative lag-1 autocorr
 *     (e.g. alternating high/low) has rho_S(1) << 0
 *     while Mood S approx (n-1)/2 (alternating signs).
 *
 *   - vs axes 103 / 104 (second-diff-sign-runs /
 *     monotone-run-length). Second-diff-sign-runs
 *     operates on sign of x[i+1] - 2*x[i] + x[i-1]
 *     (CURVATURE sign); Mood operates on sign of
 *     x[i+1] - x[i] (FIRST-DIFFERENCE sign).
 *     Monotone-run-length measures the LENGTH of the
 *     LONGEST monotone run; Mood measures the COUNT
 *     of positive first differences (a SUM, not a
 *     MAX). A series 1,2,3,2,1,2,3,4,5 has Mood
 *     S = 6 (6 positive diffs out of 8) and longest
 *     monotone run = 5 (1,2,3,4,5 at the end);
 *     different primitives.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution. Mood depends
 *     entirely on the TEMPORAL ORDER of consecutive
 *     pairs; a uniformly random permutation has
 *     E[S] = (n-1)/2 regardless of value distribution.
 *
 *   - vs the spectral axes (84-104). PSD axes are
 *     time-reversal symmetric and operate on the raw
 *     value sequence. Mood is NOT time-reversal
 *     symmetric: reversing the series flips every
 *     d[i] sign, so S becomes (n-1) - S - S0. A pure
 *     trend has S = n - 1 forward but S = 0 reversed.
 *     This anti-symmetry is the defining property of
 *     a directional trend test.
 *
 *   - vs DFA / Hurst / fractal-dimension axes. Those
 *     are scaling exponents fit across multiple
 *     window sizes; Mood is a single lag-1 sign-sum
 *     statistic with a closed-form Binomial null and
 *     is the canonical DIFFERENCE-SIGN test for
 *     trend (Brockwell & Davis 1991 sec. 1.6).
 *
 * Headline question:
 * **"For each source, do the gap-filled daily token
 *   totals show a directional drift -- i.e. do strictly
 *   positive day-over-day increments outnumber strictly
 *   negative ones (significant positive trend) or vice
 *   versa, compared to a Binomial(n-1, 1/2) null?"**
 *
 * Reference:
 *   Brockwell, P. J. and Davis, R. A., "Time Series:
 *     Theory and Methods", 2nd ed., Springer, 1991,
 *     sec. 1.6 "Tests of Randomness".
 *   Mood, A. M., "Introduction to the Theory of
 *     Statistics", McGraw-Hill, 1950, sec. 16.10.
 *   Kendall, M. G. and Stuart, A., "The Advanced
 *     Theory of Statistics", vol. 3, 3rd ed., Griffin,
 *     1976, sec. 45.10.
 *
 * Caveats:
 *
 *   - S in {0, 1, .., n - 1}. S approx (n-1)/2 = no
 *     directional trend; S much greater = upward
 *     drift; S much less = downward drift.
 *   - dZ approx N(0, 1) for n - 1 >= 20 (Brockwell &
 *     Davis 1991 sec. 1.6). For smaller effective n
 *     use the exact Binomial(n-1, 1/2) tail.
 *   - Zero-step handling. We exclude d[i] = 0 from S+
 *     and S- (S0 surfaces in `nZeroSteps`). The
 *     standardised score uses the full (n-1)
 *     denominator (asymptotic Binomial null assuming
 *     continuous data). With many ties this is mildly
 *     anti-conservative; a tie-corrected variance
 *     would scale by (1 - S0/(n-1)) but is omitted
 *     for closed-form Binomial-null parity with the
 *     classical reference (Brockwell & Davis 1991).
 *   - The test is BLIND TO PERIODIC ALTERNATIVES. A
 *     pure sinusoid x[i] = A * sin(2*pi*i/T) has
 *     E[S] = (n-1)/2 by symmetry. Use spectral axes
 *     (84-104) or runs-test-z for periodic / cyclic
 *     structure.
 *   - The test is DIRECTIONAL: a series with strong
 *     negative lag-1 autocorr (alternating up/down)
 *     can have S approx (n-1)/2 (mixed signs) and
 *     hence dZ approx 0, EVEN THOUGH the series is
 *     decisively non-iid. Pair Mood with Bartels
 *     (axis-112) for full local-serial-dependence
 *     coverage.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-difference-sign-test
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-difference-sign-test \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # directional trend first):
 *   pew-insights daily-token-difference-sign-test \
 *     --sort dZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenDifferenceSignTestSort =
  | 's'
  | 'sDesc'
  | 'dZ'
  | 'dZDesc'
  | 'dZAbs'
  | 'dZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenDifferenceSignTestOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenDifferenceSignTestSort;
  generatedAt?: string;
}

export interface DailyTokenDifferenceSignTestSourceRow {
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
  /** Effective sample size for the binomial null = n - 1. */
  dsN: number;
  /** Count of strictly positive first differences (Mood S). */
  dsS: number;
  /** Count of strictly negative first differences. */
  dsSneg: number;
  /** Count of zero first differences (ties). */
  dsSzero: number;
  /** Asymptotic variance under Binomial(n-1, 1/2): (n-1)/4. */
  dsVar: number;
  /** Standardised score (S - (n-1)/2)/sqrt((n-1)/4); ~N(0,1) for n-1>=20. */
  dsZ: number;
}

export interface DailyTokenDifferenceSignTestReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenDifferenceSignTestSort;
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
  sources: DailyTokenDifferenceSignTestSourceRow[];
}

/**
 * Mood difference-sign test for trend on a real-valued
 * series.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, ..,
 *     n) -> every d[i] = +1, S = n - 1, Sneg = 0,
 *     Szero = 0, dZ = ((n-1) - (n-1)/2)/sqrt((n-1)/4)
 *     = sqrt(n-1) (extreme positive trend signal).
 *   - strictly monotone decreasing series -> S = 0,
 *     dZ = -sqrt(n-1).
 *   - perfectly alternating series 1, 2, 1, 2, .. ->
 *     d[i] alternates +1/-1, S approx (n-1)/2, dZ
 *     approx 0 (no directional trend).
 *   - constant series -> all d[i] = 0, S = 0, but the
 *     stddev guard above filters constant series so
 *     this branch reports the zero values rather than
 *     throwing here.
 *   - i.i.d. continuous sample -> E[S] = (n-1)/2
 *     (Brockwell & Davis 1991 sec. 1.6).
 *
 * Throws when the series is too short or contains non-
 * finite entries.
 */
export function dailyTokenDifferenceSignTest(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  dsN: number;
  dsS: number;
  dsSneg: number;
  dsSzero: number;
  dsVar: number;
  dsZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenDifferenceSignTest: need at least 4 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenDifferenceSignTest requires finite values',
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

  let s = 0;
  let sneg = 0;
  let szero = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const d = values[i + 1]! - values[i]!;
    if (d > 0) s += 1;
    else if (d < 0) sneg += 1;
    else szero += 1;
  }
  const dsN = n - 1;
  // Closed-form Binomial(n-1, 1/2) variance (Brockwell &
  // Davis 1991 sec. 1.6; no tie correction by design --
  // see module docstring caveats).
  const dsVar = dsN / 4;
  const sigma = Math.sqrt(dsVar);
  const dsZ = sigma > 0 ? (s - dsN / 2) / sigma : 0;
  if (!Number.isFinite(dsZ)) {
    throw new Error(
      `dailyTokenDifferenceSignTest: non-finite dsZ (n=${n}, s=${s})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    dsN,
    dsS: s,
    dsSneg: sneg,
    dsSzero: szero,
    dsVar,
    dsZ,
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

export function buildDailyTokenDifferenceSignTest(
  queue: QueueLine[],
  opts: DailyTokenDifferenceSignTestOptions = {},
): DailyTokenDifferenceSignTestReport {
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
  const sort: DailyTokenDifferenceSignTestSort = opts.sort ?? 'dZAbsDesc';
  const validSorts: DailyTokenDifferenceSignTestSort[] = [
    's',
    'sDesc',
    'dZ',
    'dZDesc',
    'dZAbs',
    'dZAbsDesc',
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
  const rows: DailyTokenDifferenceSignTestSourceRow[] = [];

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
      result = dailyTokenDifferenceSignTest(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenDifferenceSignTestSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      dsN: result.dsN,
      dsS: result.dsS,
      dsSneg: result.dsSneg,
      dsSzero: result.dsSzero,
      dsVar: result.dsVar,
      dsZ: result.dsZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 's':
        primary = a.dsS - b.dsS;
        break;
      case 'sDesc':
        primary = b.dsS - a.dsS;
        break;
      case 'dZ':
        primary = a.dsZ - b.dsZ;
        break;
      case 'dZDesc':
        primary = b.dsZ - a.dsZ;
        break;
      case 'dZAbs':
        primary = Math.abs(a.dsZ) - Math.abs(b.dsZ);
        break;
      case 'dZAbsDesc':
        primary = Math.abs(b.dsZ) - Math.abs(a.dsZ);
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
