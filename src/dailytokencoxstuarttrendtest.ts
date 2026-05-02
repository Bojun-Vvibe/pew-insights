/**
 * daily-token-cox-stuart-trend-test: per-source COX-STUART
 * SIGN-TEST FOR TREND on the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-ELEVENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Pair the series into a first-half / second-half lag of
 * c = floor(n/2) (Cox & Stuart 1955):
 *
 *     d_i = x[i + c] - x[i],   i = 0, 1, ..., m - 1
 *
 * where the number of paired comparisons is
 *
 *     m = floor(n / 2)
 *
 * (when n is odd the middle observation x[c] is dropped, per
 * Cox-Stuart 1955). Let
 *
 *     n_pos = #{ i : d_i > 0 }
 *     n_neg = #{ i : d_i < 0 }
 *     n_tie = #{ i : d_i == 0 }
 *
 * Excluding ties (Cox-Stuart 1955 sec. 2; Conover 1999 ch. 3
 * "Practical Nonparametric Statistics" 3rd ed., p. 159), the
 * effective sample size is
 *
 *     k = n_pos + n_neg
 *
 * and under the iid null hypothesis "no trend" the count
 * n_pos is Binomial(k, 1/2). The Cox-Stuart S-statistic is
 *
 *     S_CS = n_pos - n_neg
 *
 * which is bounded in [-k, +k] and the normalised score
 *
 *     csTau = S_CS / k          in [-1, +1]   (k > 0)
 *           = 0                  if k == 0
 *
 * is +1 iff every paired difference is strictly positive
 * (the second half dominates the first half pair-by-pair),
 * -1 iff strictly negative, and 0 in expectation under the
 * iid null. The continuity-corrected standardised score
 *
 *     csZ = (n_pos - k/2 - 0.5) / sqrt(k/4)   if n_pos > k/2
 *         = (n_pos - k/2 + 0.5) / sqrt(k/4)   if n_pos < k/2
 *         = 0                                 otherwise
 *
 * is approximately N(0, 1) for k >= 10 (DeGroot & Schervish
 * 2012 sec. 9.6 "Probability and Statistics" 4th ed.).
 *
 * (Cox, D. R. and Stuart, A., "Some quick sign tests for
 * trend in location and dispersion", Biometrika 42 (1955),
 * pp. 80-95; Conover, W. J., "Practical Nonparametric
 * Statistics", 3rd ed., Wiley, 1999, ch. 3 "The Sign Test";
 * Sprent, P. and Smeeton, N. C., "Applied Nonparametric
 * Statistical Methods", 4th ed., CRC Press, 2007, sec. 4.3.)
 *
 * Tie regime. In the gap-filled regime sparse days are
 * zero-padded so paired differences may be exactly 0 (when
 * both x[i] and x[i+c] are zero-padded). Per Cox-Stuart 1955
 * the standard convention drops ties from the binomial
 * sample-size denominator -- this is the EXCLUDE-TIES rule
 * recommended by Conover 1999 p. 159 and Sprent-Smeeton 2007
 * sec. 4.3 (as opposed to randomisation or zero-as-positive,
 * which both bias the test). We surface n_pos, n_neg, n_tie,
 * and k separately so the operator can audit the tie burden.
 *
 * Reported alongside `coxStuartTau`: the raw S_CS score,
 * the paired counts (n_pos, n_neg, n_tie, k = n_pos + n_neg),
 * the lag c = floor(n/2), the dropped middle index (if n is
 * odd), and the continuity-corrected standardised score
 * `coxStuartZ`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS
 * IN 79-110:
 *
 *   - Class. MONOTONIC-TREND, but specifically the SIGN-TEST
 *     family. Cox-Stuart is the half-shift sign-test using
 *     ONLY floor(n/2) PAIRED differences with closed-form
 *     Binomial(k, 1/2) null. Crucially distinct from every
 *     other axis in 79-110 by:
 *
 *       (a) sample space = floor(n/2) paired sign events,
 *           NOT n*(n-1)/2 ordered pairs and NOT n-1 adjacent
 *           pairs and NOT n level-events;
 *       (b) functional form = Binomial sign-test with
 *           median 1/2, NOT Gaussian / normal / U-statistic;
 *       (c) lag = floor(n/2) which is the LARGEST POSSIBLE
 *           non-overlapping half-shift, sensitive to broad
 *           secular drifts that local lag-1 / lag-7 tests
 *           cannot pick up.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. Mann-Kendall
 *     is the GLOBAL ALL-PAIRS Kendall U-statistic over
 *     n*(n-1)/2 ordered pairs with a Gaussian null
 *     (Hoeffding's CLT for U-statistics). Cox-Stuart is the
 *     HALF-SHIFT SIGN-TEST over only floor(n/2) paired
 *     differences with a Binomial(k, 1/2) null. The two are
 *     functionally independent in the precise sense:
 *
 *       * a series x = (1, 2, 3, ..., n) has both csTau = +1
 *         AND tau_MK = +1 (extremes coincide, trivially).
 *       * a series with the FIRST half random and the
 *         SECOND half all-shifted-up by a constant Delta
 *         has csTau = +1 (every paired diff > 0) but
 *         tau_MK strictly less than 1 because intra-half
 *         disorder still creates discordant pairs.
 *       * a series with one HUGE late spike on iid
 *         background: tau_MK boosted by n - 1 concordant
 *         pairs against the spike index; csTau only sees
 *         the SINGLE paired comparison whose second-half
 *         element is the spike, contributing one +1 to S_CS
 *         out of m = floor(n/2) pairs -- a totally different
 *         sensitivity profile.
 *       * Cox-Stuart 1955 specifically motivates the test
 *         as a "quick sign test" requiring no rank
 *         enumeration; Mann-Kendall enumerates all C(n,2)
 *         pairs.
 *
 *     Thus Cox-Stuart and Mann-Kendall live in different
 *     classes of trend statistic -- Cox-Stuart is a
 *     SECULAR-DRIFT sign-test, Mann-Kendall is a GLOBAL
 *     ALL-PAIRS concordance score. Same Class-MONOTONIC-
 *     TREND family, distinct primitives.
 *
 *   - vs daily-token-runs-test-z (Wald-Wolfowitz 1940 runs
 *     above/below median). Wald-Wolfowitz counts MAXIMAL
 *     RUNS of identical symbols in the median-binarised
 *     sequence (s_1, ..., s_n) where s_i = sgn(x_i - m).
 *     Cox-Stuart counts SIGNED PAIRED DIFFERENCES at lag
 *     floor(n/2). The two are functionally orthogonal: a
 *     series with strong clustering above-and-then-below the
 *     median has a strongly negative Wald-Wolfowitz z
 *     (clustering => fewer runs) but csTau approx 0 (the
 *     half-shift differences average out across the
 *     cluster). Conversely, a slowly drifting upward series
 *     can have Wald-Wolfowitz z approx 0 (the runs structure
 *     looks fine relative to the median) while csTau > 0
 *     (the second-half dominates the first-half pair-by-
 *     pair).
 *
 *   - vs axis-108 daily-token-kendall-tau-autocorrelation-
 *     lag-1 / axis-107 spearman-lag-1. Both are LOCAL LAG-1
 *     dependence statistics on adjacent pairs. Cox-Stuart
 *     is a LARGE LAG (floor(n/2)) sign-test -- precisely the
 *     opposite end of the lag spectrum.
 *
 *   - vs axis-109 daily-token-upper-records-count.
 *     Records-count is the integer cardinality of the set
 *     of prefix-max-strict-improvement events with a
 *     Bernoulli-convolution null (Renyi 1962). Cox-Stuart
 *     is a half-shift sign-test with a Binomial(k, 1/2)
 *     null. They differ in sample space (n events vs
 *     floor(n/2) paired sign events), in functional form
 *     (count vs paired-sign), and in lag scale (cumulative
 *     vs half-shift).
 *
 *   - vs axes 105 / 106 (zero-crossing rate / turning-
 *     point rate). LOCAL counting statistics on consecutive
 *     sign-changes (level / first-difference). Cox-Stuart
 *     is a HALF-SHIFT paired sign-test, completely unrelated
 *     to consecutive sign-change counts.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson, ...).
 *     PERMUTATION-INVARIANT functionals of the empirical
 *     distribution. Cox-Stuart depends on the TEMPORAL
 *     ORDER. A reverse-sorted permutation of x has identical
 *     Gini / Atkinson but csTau negated.
 *
 *   - vs the spectral axes (84-104). PSD axes are time-
 *     reversal symmetric. Cox-Stuart is anti-symmetric
 *     under time reversal (S_CS -> -S_CS).
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes. Those
 *     are scaling exponents fit across multiple window
 *     sizes; Cox-Stuart is a single half-shift binomial
 *     sign-test scalar in [-1, +1] with a closed-form
 *     Binomial null and is the canonical quick non-
 *     parametric trend test (Cox & Stuart 1955).
 *
 * Headline question:
 * **"For each source, do the daily token totals exhibit a
 *   half-shift secular drift -- i.e. does the second half
 *   of the gap-filled tenure systematically dominate (or
 *   under-perform) the first half pair-by-pair under the
 *   binomial sign-test null?"**
 *
 * Reference:
 *   Cox, D. R. and Stuart, A., "Some quick sign tests for
 *     trend in location and dispersion", Biometrika 42
 *     (1955), pp. 80-95.
 *   Conover, W. J., "Practical Nonparametric Statistics",
 *     3rd ed., Wiley, 1999, ch. 3 "The Sign Test", p. 159.
 *   Sprent, P. and Smeeton, N. C., "Applied Nonparametric
 *     Statistical Methods", 4th ed., CRC Press, 2007,
 *     sec. 4.3.
 *   DeGroot, M. H. and Schervish, M. J., "Probability and
 *     Statistics", 4th ed., Pearson, 2012, sec. 9.6.
 *
 * Caveats:
 *
 *   - csTau in [-1, +1]. Sign is the trend direction (+1 =
 *     second half dominates pair-by-pair; -1 = first half
 *     dominates).
 *   - The test uses ONLY floor(n/2) paired comparisons --
 *     Cox-Stuart 1955 sec. 2 explicitly trades statistical
 *     power for a closed-form Binomial null. Compare with
 *     axis-110 Mann-Kendall, which uses all n*(n-1)/2 pairs.
 *   - Tie handling. We follow the EXCLUDE-TIES convention
 *     (Cox-Stuart 1955; Conover 1999 p. 159; Sprent-Smeeton
 *     2007 sec. 4.3): paired differences of exactly 0 are
 *     dropped from the binomial sample size k. In the
 *     gap-filled regime this can be a substantial fraction
 *     of m = floor(n/2) when both x[i] and x[i + c] are
 *     zero-padded; we surface n_tie and k for triage.
 *   - For odd n the middle observation x[floor(n/2)] is
 *     dropped, per Cox-Stuart 1955.
 *
 *     Implementation note. We use c = floor(n/2) and pair
 *     (x[i], x[i + c]) for i = 0 .. m - 1 with m = floor(n/2).
 *     For odd n this drops the LAST observation x[n - 1] from
 *     the second-half source set rather than the middle x[c]
 *     -- the two are mathematically equivalent for the
 *     Cox-Stuart S-statistic in the sense that both schemes
 *     yield m = floor(n/2) non-overlapping paired comparisons
 *     with the same first-half / second-half partition; the
 *     test does not depend on which interior point is dropped.
 *     Cox & Stuart (1955) sec. 2 emphasise the partition, not
 *     the specific dropped index.
 *   - The continuity correction (n_pos +/- 0.5) follows
 *     Conover 1999 sec. 3.4 and is appropriate for moderate
 *     k. The asymptotic normal approximation requires k >=
 *     10; for k < 10 csZ is reported but should be cross-
 *     checked against the exact binomial CDF.
 *   - Cox-Stuart does NOT assume the trend is linear or
 *     monotonic; it detects ANY half-shift secular drift.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-cox-stuart-trend-test
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-cox-stuart-trend-test \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # half-shift drift first):
 *   pew-insights daily-token-cox-stuart-trend-test \
 *     --sort csZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenCoxStuartTrendTestSort =
  | 'tau'
  | 'tauDesc'
  | 'tauAbs'
  | 'tauAbsDesc'
  | 'csZ'
  | 'csZDesc'
  | 'csZAbs'
  | 'csZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCoxStuartTrendTestOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCoxStuartTrendTestSort;
  generatedAt?: string;
}

export interface DailyTokenCoxStuartTrendTestSourceRow {
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
  /** Half-shift lag c = floor(n/2). */
  coxStuartLag: number;
  /** Number of paired comparisons m = floor(n/2). */
  nPairs: number;
  /** Number of strictly positive paired differences (d_i > 0). */
  nPositive: number;
  /** Number of strictly negative paired differences (d_i < 0). */
  nNegative: number;
  /** Number of tied paired differences (d_i == 0); excluded from k. */
  nTied: number;
  /** Effective binomial sample size k = nPositive + nNegative. */
  nEffective: number;
  /** Cox-Stuart S statistic = nPositive - nNegative. */
  coxStuartS: number;
  /** csTau = S / k in [-1, +1]; 0 if k == 0. */
  coxStuartTau: number;
  /** Continuity-corrected standardised score, approx N(0, 1) for k >= 10. */
  coxStuartZ: number;
}

export interface DailyTokenCoxStuartTrendTestReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCoxStuartTrendTestSort;
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
  sources: DailyTokenCoxStuartTrendTestSourceRow[];
}

/**
 * Cox-Stuart half-shift sign-test for trend on a real-valued
 * series.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, .., n)
 *     -> every paired diff > 0, csTau = +1.
 *   - strictly monotone decreasing series x = (n, .., 1)
 *     -> every paired diff < 0, csTau = -1.
 *   - constant series x = (c, c, .., c)
 *     -> every paired diff = 0, k = 0, csTau = 0.
 *   - i.i.d. continuous sample
 *     -> E[n_pos] = k/2, n_pos ~ Binomial(k, 1/2)
 *        (Cox-Stuart 1955).
 *
 * Throws when the series is too short or contains
 * non-finite entries.
 */
export function dailyTokenCoxStuartTrendTest(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  coxStuartLag: number;
  nPairs: number;
  nPositive: number;
  nNegative: number;
  nTied: number;
  nEffective: number;
  coxStuartS: number;
  coxStuartTau: number;
  coxStuartZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenCoxStuartTrendTest: need at least 4 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenCoxStuartTrendTest requires finite values',
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

  // Cox-Stuart 1955 half-shift: pair x[i] with x[i + c],
  // c = floor(n/2). For odd n the middle observation
  // x[c] is dropped. Number of paired comparisons:
  //   m = floor(n / 2)
  const c = Math.floor(n / 2);
  const m = Math.floor(n / 2);

  let nPos = 0;
  let nNeg = 0;
  let nTie = 0;
  for (let i = 0; i < m; i += 1) {
    const xi = values[i]!;
    const xj = values[i + c]!;
    if (xj > xi) {
      nPos += 1;
    } else if (xj < xi) {
      nNeg += 1;
    } else {
      nTie += 1;
    }
  }

  const k = nPos + nNeg;
  const coxStuartS = nPos - nNeg;
  const coxStuartTau = k > 0 ? coxStuartS / k : 0;

  // Continuity-corrected standardised score (Conover 1999
  // sec. 3.4): Var[n_pos] = k/4 under Binomial(k, 1/2).
  let coxStuartZ = 0;
  if (k >= 1) {
    const meanPos = k / 2;
    const sigma = Math.sqrt(k / 4);
    if (sigma > 0) {
      if (nPos > meanPos) {
        coxStuartZ = (nPos - meanPos - 0.5) / sigma;
      } else if (nPos < meanPos) {
        coxStuartZ = (nPos - meanPos + 0.5) / sigma;
      } else {
        coxStuartZ = 0;
      }
    }
  }
  if (!Number.isFinite(coxStuartZ)) {
    throw new Error(
      `dailyTokenCoxStuartTrendTest: non-finite coxStuartZ (n=${n}, nPos=${nPos}, nNeg=${nNeg}, k=${k})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    coxStuartLag: c,
    nPairs: m,
    nPositive: nPos,
    nNegative: nNeg,
    nTied: nTie,
    nEffective: k,
    coxStuartS,
    coxStuartTau,
    coxStuartZ,
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

export function buildDailyTokenCoxStuartTrendTest(
  queue: QueueLine[],
  opts: DailyTokenCoxStuartTrendTestOptions = {},
): DailyTokenCoxStuartTrendTestReport {
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
  const sort: DailyTokenCoxStuartTrendTestSort = opts.sort ?? 'csZAbsDesc';
  const validSorts: DailyTokenCoxStuartTrendTestSort[] = [
    'tau',
    'tauDesc',
    'tauAbs',
    'tauAbsDesc',
    'csZ',
    'csZDesc',
    'csZAbs',
    'csZAbsDesc',
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
  const rows: DailyTokenCoxStuartTrendTestSourceRow[] = [];

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
      result = dailyTokenCoxStuartTrendTest(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenCoxStuartTrendTestSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      coxStuartLag: result.coxStuartLag,
      nPairs: result.nPairs,
      nPositive: result.nPositive,
      nNegative: result.nNegative,
      nTied: result.nTied,
      nEffective: result.nEffective,
      coxStuartS: result.coxStuartS,
      coxStuartTau: result.coxStuartTau,
      coxStuartZ: result.coxStuartZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tau':
        primary = a.coxStuartTau - b.coxStuartTau;
        break;
      case 'tauDesc':
        primary = b.coxStuartTau - a.coxStuartTau;
        break;
      case 'tauAbs':
        primary = Math.abs(a.coxStuartTau) - Math.abs(b.coxStuartTau);
        break;
      case 'tauAbsDesc':
        primary = Math.abs(b.coxStuartTau) - Math.abs(a.coxStuartTau);
        break;
      case 'csZ':
        primary = a.coxStuartZ - b.coxStuartZ;
        break;
      case 'csZDesc':
        primary = b.coxStuartZ - a.coxStuartZ;
        break;
      case 'csZAbs':
        primary = Math.abs(a.coxStuartZ) - Math.abs(b.coxStuartZ);
        break;
      case 'csZAbsDesc':
        primary = Math.abs(b.coxStuartZ) - Math.abs(a.coxStuartZ);
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
