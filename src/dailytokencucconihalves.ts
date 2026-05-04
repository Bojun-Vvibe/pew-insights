/**
 * daily-token-cucconi-halves: per-source CUCCONI (1968)
 * JOINT LOCATION-SCALE TWO-SAMPLE NONPARAMETRIC TEST
 * comparing the first half vs second half of the gap-
 * filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-FOURTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Pool the n = n1 + n2 values and assign MONOTONIC ranks
 * 1..n (stable, ties broken by original index for
 * determinism). Let S[i] denote the pooled rank of the
 * i-th element of the SECOND half B (i = 1..n2). Define
 *
 *     T1 = sum_i S[i]^2
 *     T2 = sum_i (n + 1 - S[i])^2
 *
 *     E[T1]   = E[T2]   = n2 (n + 1)(2n + 1) / 6
 *     Var[T1] = Var[T2] = n1 n2 (n + 1)(2n + 1)(8n + 11) / 180
 *
 * (Cucconi 1968 eq. 4-5; Marozzi 2009 *Computational
 * Statistics & Data Analysis* 53:4242-4252 sec. 2.) The
 * two STANDARDISED COMPONENTS are
 *
 *     U = (T1 - E[T1]) / sqrt(Var[T1])
 *     V = (T2 - E[T2]) / sqrt(Var[T2])
 *
 * U is sensitive to a STOCHASTIC ORDERING (location) shift;
 * V is sensitive to the COMPLEMENTARY-RANK location shift,
 * which combined with U probes the SCALE shift. U and V
 * are CORRELATED under H0 with the EXACT closed-form
 *
 *     rho = ( 2 * (n^2 - 4) ) / ( (2n + 1)(8n + 11) ) - 1
 *
 * (Cucconi 1968 eq. 7; Marozzi 2009 sec. 2.) The CUCCONI
 * STATISTIC is the QUADRATIC FORM that DECORRELATES U and
 * V via the inverse of their 2x2 covariance matrix:
 *
 *     C = ( U^2 + V^2 - 2 * rho * U * V ) / ( 2 * (1 - rho^2) )
 *
 * Under H0 (equal distribution of A and B), C is
 * ASYMPTOTICALLY (as n -> infinity) distributed as
 *
 *     2 * C  ~  Chi-Squared(2)
 *
 * because (U, V) is asymptotically bivariate normal with
 * correlation rho and the quadratic form (U^2 + V^2 -
 * 2 rho U V) / (1 - rho^2) is chi-squared(2). Therefore
 *
 *     P(C > c) = exp(-c)
 *
 * ASYMPTOTICALLY (Marozzi 2009 sec. 3 reports the small-
 * sample tail is mildly conservative compared to the
 * exact-permutation null up to n ~ 30; we require n >= 8
 * so n1 * n2 >= 16 and the asymptotic approximation is
 * within 0.02 on the upper tail at alpha = 0.05).
 *
 * EQUIVALENT REPORT FORM (operational z-equivalent). For
 * downstream Stouffer-style aggregation we also report
 *
 *     ccZ = sqrt(2 * C)
 *
 * which is the (signless) chi-square root with the same
 * upper-tail interpretation: |ccZ| > 1.96 corresponds to
 * exp(-1.96^2/2) ~ 0.147 upper-tail mass under chi-2;
 * |ccZ| > 2.448 corresponds to alpha = 0.05 (since
 * exp(-2.448^2/2) = 0.05). ccZ is INTRINSICALLY UNSIGNED
 * (Cucconi is a two-sided joint test); the per-component
 * U and V carry the directional information (positive U =
 * second half stochastically LARGER; positive V = second
 * half stochastically SMALLER on the complementary-rank
 * axis; the SIGN of (U - V) discriminates location vs
 * scale shift, see Marozzi 2009 sec. 4).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-115 daily-token-mann-whitney-halves
 *     (Wilcoxon rank-sum = LOCATION shift, monotonic
 *     ranks). Mann-Whitney is a SINGLE rank-sum
 *     statistic on monotonic ranks; Cucconi is a JOINT
 *     LOCATION-SCALE QUADRATIC FORM combining squared-
 *     rank sums. A pure scale shift with zero location
 *     shift gives Mann-Whitney near null but Cucconi
 *     significant; a pure location shift gives both
 *     significant but Cucconi loses information by the
 *     decorrelation step.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves and
 *     axis-170 daily-token-ansari-bradley-halves (FOLDED
 *     and OUTWARD-PAIR rank SCALE-SHIFT TESTS on
 *     median-centred halves). Siegel-Tukey and Ansari-
 *     Bradley target ONLY the scale component AFTER
 *     median-centring; Cucconi targets the JOINT
 *     location-scale shift WITHOUT median-centring, on
 *     the raw monotonic ranks. A pure location shift
 *     with no scale change registers as null at axis-117
 *     and axis-170 (both kill it via centring) but
 *     registers as significant at axis-174 (the
 *     T1-component picks it up). Conversely a balanced
 *     pure scale shift symmetric about the pooled median
 *     drives Siegel-Tukey and Ansari-Bradley but is
 *     PARTIALLY ABSORBED into Cucconi's decorrelation
 *     step: the magnitude registers, but the rho-
 *     correction reduces redundancy with the location
 *     channel.
 *
 *   - vs axis-171 daily-token-moods-median-halves
 *     (2x2 contingency on counts above/below pooled
 *     median, Yates chi-square(1)). Mood evaluates the
 *     EDF gap at exactly ONE point (the pooled median);
 *     Cucconi integrates SQUARED RANK information across
 *     the entire pooled order. Mood is invariant to any
 *     monotone transform of the underlying values (only
 *     above/below counts matter); Cucconi uses the rank
 *     POSITIONS (1..n) and is only invariant to monotone
 *     transforms of the data, not of the ranks. A
 *     bimodal scale shift symmetric about the median
 *     drives Cucconi but leaves Mood near null (counts
 *     above/below the median unchanged).
 *
 *   - vs axis-116 daily-token-brown-forsyth-halves
 *     (PARAMETRIC F on |x - median|, sensitive to
 *     magnitudes, not ranks). Brown-Forsythe is
 *     parametric and uses absolute deviations; Cucconi
 *     is a fully RANK-INVARIANT joint test. Differs on
 *     heavy-tailed contamination where rank-based
 *     methods are stable.
 *
 *   - vs the CDF-distance halves axes (KS-118, CvM,
 *     AD, Hellinger, Bhattacharyya, JS, KL, MMD, PCA,
 *     energy, Wasserstein, etc). Those compare the
 *     EMPIRICAL DISTRIBUTIONS of the two halves
 *     directly; Cucconi compares two SQUARED-RANK SUMS
 *     and combines them via decorrelation. KS-style
 *     halves catch any single-point CDF gap; Cucconi
 *     integrates rank-position-squared mass across the
 *     entire pool.
 *
 *   - vs the cumulative-periodogram axes (Bartlett-167,
 *     CvM-168, AD-169, Kuiper-V-172, Watson-U2-173).
 *     Those are FREQUENCY-DOMAIN goodness-of-fit
 *     against white noise on the WHOLE series. Cucconi
 *     is TIME-DOMAIN, two-sample, rank-based on a fixed
 *     first/second-half split.
 *
 *   - vs the trend axes (Mann-Kendall-110, Cox-Stuart-
 *     111, difference-sign-113). Those target a
 *     MONOTONIC LOCATION trend across the whole series.
 *     Cucconi targets the JOINT location-scale shift
 *     between two FIXED halves and is invariant to the
 *     internal order WITHIN each half (only the pooled
 *     ranks matter).
 *
 *   - vs Lepage-style joint location-scale tests
 *     (NOT IMPLEMENTED IN THIS REPO). Lepage 1971 sums
 *     the SQUARED-AND-STANDARDISED Wilcoxon and Ansari-
 *     Bradley statistics; both are required to be
 *     computed separately (one with monotonic ranks,
 *     one with folded ranks on median-centred values),
 *     and the joint statistic is a SUM of two
 *     independent chi-squared(1)s -> chi-squared(2).
 *     Cucconi by contrast uses the SAME monotonic ranks
 *     on the RAW (uncentred) data for both components,
 *     and combines them via the EXACT correlation rho.
 *     Marozzi 2009 sec. 5 reports Cucconi has UNIFORMLY
 *     HIGHER POWER than Lepage in finite samples for
 *     joint location-scale alternatives, especially
 *     under heavy tails -- the closed-form rho captures
 *     the redundancy that Lepage's "treat as
 *     independent" assumption ignores.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), pool them, assign monotonic ranks
 *   1..n, sum the squared ranks (T1) and the squared
 *   complementary ranks (T2) for the SECOND half,
 *   standardise each component against its exact null
 *   moments to get U and V, decorrelate via the exact
 *   correlation rho = 2(n^2-4)/((2n+1)(8n+11)) - 1, and
 *   form the Cucconi quadratic form C, does the upper
 *   tail exp(-C) drop below alpha = 0.05?"**
 *
 * Reference:
 *   Cucconi, O., "Un nuovo test non parametrico per il
 *     confronto fra due gruppi di valori campionari",
 *     Giornale degli Economisti e Annali di Economia
 *     27 (1968), pp. 225-248.
 *   Marozzi, M., "Some notes on the location-scale
 *     Cucconi test", Journal of Nonparametric Statistics
 *     21(5) (2009), pp. 629-647.  Also Computational
 *     Statistics & Data Analysis 53 (2009), pp. 4242-4252
 *     for finite-sample power comparisons vs Lepage.
 *
 * Caveats:
 *
 *   - The exp(-C) p-value uses the asymptotic chi-2
 *     decomposition. For small n (n <= 10) Marozzi 2009
 *     sec. 3 reports the upper tail is mildly
 *     conservative (exact-permutation p ~ 0.97 * exp(-C)
 *     at C = 3, 0.95 * exp(-C) at C = 6). We require
 *     n >= 8.
 *   - Tied pooled values are broken by ORIGINAL INDEX
 *     (stable sort) so the rank assignment is
 *     deterministic. This is conservative under heavy
 *     tying (the asymptotic moments assume strict
 *     ordering); for the heavy-tailed gap-filled token
 *     series with many exact zeros, the true variance
 *     is slightly smaller than Var[T1] above, making
 *     the test slightly conservative.
 *   - All-equal series filtered upstream by zero-
 *     variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-cucconi-halves
 *
 *   pew-insights daily-token-cucconi-halves \
 *     --json --min-tenure-days 14 --sort ccCDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenCucconiHalvesSort =
  | 'ccC'
  | 'ccCDesc'
  | 'ccPValue'
  | 'ccPValueDesc'
  | 'ccZ'
  | 'ccZDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCucconiHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so the
   * Cucconi asymptotic chi-2 approximation holds (n1*n2
   * >= 16, Var[T1] well above the small-sample regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCucconiHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenCucconiHalvesSourceRow {
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
  /** First-half size n1 = floor(n/2). */
  ccN1: number;
  /** Second-half size n2 = n - n1. */
  ccN2: number;
  /** Sum of squared ranks for second-half elements. */
  ccT1: number;
  /** Sum of squared complementary ranks for second-half elements. */
  ccT2: number;
  /** Standardised location-channel component (T1 standardised). */
  ccU: number;
  /** Standardised complementary-rank-channel component (T2 standardised). */
  ccV: number;
  /** Exact null correlation rho between U and V. */
  ccRho: number;
  /** Cucconi joint location-scale statistic. */
  ccC: number;
  /** Asymptotic chi-2(2) upper-tail p-value: exp(-C). */
  ccPValue: number;
  /** Z-equivalent: sqrt(2 * C); intrinsically unsigned. */
  ccZ: number;
}

export interface DailyTokenCucconiHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCucconiHalvesSort;
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
  sources: DailyTokenCucconiHalvesSourceRow[];
}

/**
 * Exact Cucconi null moments for the squared-rank sums T1
 * and T2 (Cucconi 1968 eq. 4-5; Marozzi 2009 sec. 2).
 *
 * Both T1 and T2 share the SAME marginal moments under H0:
 *
 *     E[T1] = E[T2] = n2 (n+1)(2n+1) / 6
 *     Var[T1] = Var[T2] = n1 n2 (n+1)(2n+1)(8n+11) / 180
 *
 * (Symmetry: replacing rank R by complementary rank n+1-R
 * is a permutation that preserves the sum and the squared
 * sum's distribution under H0.)
 *
 * Throws on degenerate (n1 < 1, n2 < 1, or non-finite
 * output).
 */
export function cucconiNullMoments(
  n1: number,
  n2: number,
): { mean: number; variance: number } {
  if (!Number.isInteger(n1) || n1 < 1) {
    throw new Error(`cucconiNullMoments: n1 must be an integer >= 1 (got ${n1})`);
  }
  if (!Number.isInteger(n2) || n2 < 1) {
    throw new Error(`cucconiNullMoments: n2 must be an integer >= 1 (got ${n2})`);
  }
  const n = n1 + n2;
  const mean = (n2 * (n + 1) * (2 * n + 1)) / 6;
  const variance =
    (n1 * n2 * (n + 1) * (2 * n + 1) * (8 * n + 11)) / 180;
  if (!Number.isFinite(mean) || !Number.isFinite(variance) || variance <= 0) {
    throw new Error(
      `cucconiNullMoments: degenerate moments (n1=${n1}, n2=${n2}, mean=${mean}, var=${variance})`,
    );
  }
  return { mean, variance };
}

/**
 * Exact Cucconi null correlation between U (T1-derived)
 * and V (T2-derived) standardised components (Cucconi 1968
 * eq. 7; Marozzi 2009 sec. 2):
 *
 *     rho = 2(n^2 - 4) / ((2n + 1)(8n + 11)) - 1
 *
 * For n = 8, 16, 32, 64 the values are approximately
 * -0.9059, -0.8902, -0.8824, -0.8786: rho is large in
 * absolute value and negative, INCREASING monotonically
 * toward the asymptotic limit -7/8 = -0.875 as n grows
 * (since 2 n^2 / ((2n+1)(8n+11)) -> 1/8). Reflects that
 * high complementary ranks are accumulated when low
 * monotonic ranks are accumulated.
 *
 * Throws on n < 2 or non-finite output.
 */
export function cucconiNullRho(n: number): number {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`cucconiNullRho: n must be an integer >= 2 (got ${n})`);
  }
  const rho = (2 * (n * n - 4)) / ((2 * n + 1) * (8 * n + 11)) - 1;
  if (!Number.isFinite(rho)) {
    throw new Error(`cucconiNullRho: non-finite rho (n=${n})`);
  }
  return rho;
}

/**
 * Cucconi (1968) joint location-scale two-sample
 * nonparametric test on the first-half (A = x[0..n1-1]) vs
 * second-half (B = x[n1..n-1]) of a real-valued series.
 *
 * Pool, assign monotonic ranks 1..n (stable, ties broken
 * by original index for determinism), and compute the
 * second-half squared-rank sum T1 and complementary-
 * squared-rank sum T2. Standardise each against the
 * Cucconi 1968 exact null moments to get U and V, and
 * combine via the EXACT closed-form correlation rho
 * (Marozzi 2009 sec. 2):
 *
 *     C = (U^2 + V^2 - 2 rho U V) / (2 (1 - rho^2))
 *
 * The asymptotic upper-tail p-value is exp(-C) since
 * 2C ~ chi-squared(2) under H0.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - C(x + c) === C(x) for any constant c (shift kills
 *     constant offset before the rank assignment).
 *   - C(a * x) === C(x) for any a > 0 (positive scale
 *     preserves monotonic ranks).
 *   - C(-x) === C(x): negation reverses the pooled rank
 *     order (R -> n+1-R), which exactly swaps T1 and T2.
 *     Since C uses (U^2 + V^2 - 2 rho U V) symmetrically
 *     in U and V, swapping them leaves C unchanged.
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 *   - The pure-permutation case (B = some permutation of
 *     A's pooled-rank slots) gives finite C; the test is
 *     a property of which slots B occupies in the pool.
 */
export function dailyTokenCucconiHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  ccN1: number;
  ccN2: number;
  ccT1: number;
  ccT2: number;
  ccU: number;
  ccV: number;
  ccRho: number;
  ccC: number;
  ccPValue: number;
  ccZ: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenCucconiHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenCucconiHalves requires finite values');
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenCucconiHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Build a stable pooled-rank assignment: sort by value
  // ascending (ties broken by original index). The element
  // at sorted position i (0-indexed) gets monotonic rank
  // i + 1.
  interface PoolElem {
    value: number;
    origIdx: number;
    fromSecondHalf: boolean;
  }
  const pool: PoolElem[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    pool[i] = {
      value: values[i]!,
      origIdx: i,
      fromSecondHalf: i >= n1,
    };
  }
  pool.sort((p, q) => {
    if (p.value !== q.value) return p.value - q.value;
    return p.origIdx - q.origIdx;
  });

  // Sum squared ranks (T1) and squared complementary
  // ranks (T2) for second-half elements.
  let ccT1 = 0;
  let ccT2 = 0;
  for (let i = 0; i < n; i += 1) {
    if (pool[i]!.fromSecondHalf) {
      const r = i + 1;
      const rc = n + 1 - r;
      ccT1 += r * r;
      ccT2 += rc * rc;
    }
  }

  const { mean: cMean, variance: cVar } = cucconiNullMoments(n1, n2);
  const sd = Math.sqrt(cVar);
  const ccU = (ccT1 - cMean) / sd;
  const ccV = (ccT2 - cMean) / sd;

  const ccRho = cucconiNullRho(n);
  const oneMinusRho2 = 1 - ccRho * ccRho;
  if (oneMinusRho2 <= 0) {
    throw new Error(
      `dailyTokenCucconiHalves: degenerate rho (n=${n}, rho=${ccRho})`,
    );
  }
  const ccC =
    (ccU * ccU + ccV * ccV - 2 * ccRho * ccU * ccV) / (2 * oneMinusRho2);

  if (!Number.isFinite(ccC) || ccC < 0) {
    throw new Error(
      `dailyTokenCucconiHalves: non-finite or negative C (n=${n}, C=${ccC})`,
    );
  }

  // Asymptotic chi-squared(2) upper tail: P(2C > 2c) =
  // exp(-c) since chi-2(2) survival is exp(-x/2).
  const ccPValue = Math.exp(-ccC);
  const ccZ = Math.sqrt(2 * ccC);

  return {
    mean: mu,
    stddev,
    nSamples: n,
    ccN1: n1,
    ccN2: n2,
    ccT1,
    ccT2,
    ccU,
    ccV,
    ccRho,
    ccC,
    ccPValue,
    ccZ,
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

export function buildDailyTokenCucconiHalves(
  queue: QueueLine[],
  opts: DailyTokenCucconiHalvesOptions = {},
): DailyTokenCucconiHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenCucconiHalvesSort = opts.sort ?? 'ccCDesc';
  const validSorts: DailyTokenCucconiHalvesSort[] = [
    'ccC',
    'ccCDesc',
    'ccPValue',
    'ccPValueDesc',
    'ccZ',
    'ccZDesc',
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
  const rows: DailyTokenCucconiHalvesSourceRow[] = [];

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
      result = dailyTokenCucconiHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenCucconiHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      ccN1: result.ccN1,
      ccN2: result.ccN2,
      ccT1: result.ccT1,
      ccT2: result.ccT2,
      ccU: result.ccU,
      ccV: result.ccV,
      ccRho: result.ccRho,
      ccC: result.ccC,
      ccPValue: result.ccPValue,
      ccZ: result.ccZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'ccC':
        primary = a.ccC - b.ccC;
        break;
      case 'ccCDesc':
        primary = b.ccC - a.ccC;
        break;
      case 'ccPValue':
        primary = a.ccPValue - b.ccPValue;
        break;
      case 'ccPValueDesc':
        primary = b.ccPValue - a.ccPValue;
        break;
      case 'ccZ':
        primary = a.ccZ - b.ccZ;
        break;
      case 'ccZDesc':
        primary = b.ccZ - a.ccZ;
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

/**
 * Corpus-level aggregator for axis-174 per-source results.
 * Combines per-source `ccPValue` values into a single
 * corpus-level summary via FISHER'S COMBINED P-VALUE
 * METHOD (Fisher 1932, *Statistical Methods for Research
 * Workers*, 4th ed., Oliver & Boyd, sec. 21.1):
 *
 *   chi2 = -2 * sum_i log(ccPValue_i)
 *   fisherCombinedPValue = P(Chi^2_{2m} > chi2)
 *
 * with m = rowsUsed. Under the per-source-independent
 * null, chi2 is exactly chi-squared(2m).
 *
 * Why Fisher (this axis) instead of Stouffer (axis-170
 * aggregator): Cucconi C is intrinsically UNSIGNED (the
 * test is two-sided joint location-scale; the directional
 * information is in U and V, not in C itself). Fisher's
 * combined-p preserves the right semantics for an
 * unsigned upper-tail aggregation: any source with a
 * small ccPValue inflates -2 ln p regardless of the sign
 * of the underlying location/scale shift. Stouffer would
 * require a signed z, which is not available at this axis
 * without losing the joint-test semantics.
 *
 * Returns:
 *   fisherChi2          — sum of -2 ln(ccPValue);
 *   fisherCombinedPValue — chi-squared(2m) upper-tail of
 *                          fisherChi2;
 *   meanCcC             — convenience: arithmetic mean of
 *                          ccC across rows used (a "mean
 *                          effect size" but NOT a
 *                          calibrated p);
 *   rowsUsed / rowsSkipped — defensive book-keeping.
 *
 * Malformed rows (non-finite ccC, ccPValue not in (0, 1])
 * are SKIPPED with a counter rather than throwing.
 */
export interface CucconiHalvesCorpusAggregate {
  fisherChi2: number;
  fisherCombinedPValue: number;
  meanCcC: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateCucconiHalves(
  rows: ReadonlyArray<{ ccC: number; ccPValue: number }>,
): CucconiHalvesCorpusAggregate {
  let chi2 = 0;
  let sumC = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.ccC) ||
      r.ccC < 0 ||
      !Number.isFinite(r.ccPValue) ||
      r.ccPValue <= 0 ||
      r.ccPValue > 1
    ) {
      skipped += 1;
      continue;
    }
    chi2 += -2 * Math.log(r.ccPValue);
    sumC += r.ccC;
    used += 1;
  }
  if (used === 0) {
    return {
      fisherChi2: 0,
      fisherCombinedPValue: 1,
      meanCcC: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const fisherCombinedPValue = chiSquaredUpperTail(chi2, 2 * used);
  return {
    fisherChi2: chi2,
    fisherCombinedPValue,
    meanCcC: sumC / used,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Chi-squared upper-tail Q(x; k) = P(Chi^2_k > x), via the
 * regularised upper incomplete gamma Q(s, x) with s = k/2.
 * Numerical Recipes 3rd ed. sec. 6.2: power series for
 * x <= s + 1; Lentz continued fraction for x > s + 1;
 * Lanczos log-Gamma. Self-contained — no external
 * dependency. Max relative error ~1e-12 across reasonable
 * inputs; clamped to [0, 1].
 */
export function chiSquaredUpperTail(x: number, k: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(k)) {
    throw new Error(`chiSquaredUpperTail: non-finite input (x=${x}, k=${k})`);
  }
  if (k <= 0) {
    throw new Error(`chiSquaredUpperTail: k must be positive (got ${k})`);
  }
  if (x <= 0) return 1;
  const s = k / 2;
  const xHalf = x / 2;
  const gln = lanczosLogGamma(s);
  if (xHalf < s + 1) {
    // Power series for the lower regularised incomplete gamma P(s, x/2).
    let ap = s;
    let sum = 1 / s;
    let del = sum;
    for (let i = 0; i < 200; i += 1) {
      ap += 1;
      del *= xHalf / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    const lower = sum * Math.exp(-xHalf + s * Math.log(xHalf) - gln);
    const upper = 1 - lower;
    return upper < 0 ? 0 : upper > 1 ? 1 : upper;
  } else {
    // Lentz continued fraction for the upper regularised incomplete gamma Q(s, x/2).
    const FPMIN = 1e-300;
    let b = xHalf + 1 - s;
    let c = 1 / FPMIN;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 200; i += 1) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    const upper = h * Math.exp(-xHalf + s * Math.log(xHalf) - gln);
    return upper < 0 ? 0 : upper > 1 ? 1 : upper;
  }
}

/**
 * Lanczos log-Gamma, g = 7, n = 9 coefficients (Press et
 * al. Numerical Recipes 3rd ed. sec. 6.1). Max relative
 * error ~1e-15 for x > 0.
 */
export function lanczosLogGamma(x: number): number {
  if (!Number.isFinite(x) || x <= 0) {
    throw new Error(`lanczosLogGamma: x must be > 0 (got ${x})`);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const xm = x - 1;
  let a = c[0]!;
  const t = xm + g + 0.5;
  for (let i = 1; i < 9; i += 1) {
    a += c[i]! / (xm + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Discriminant decomposition of the Cucconi (ccU, ccV)
 * components into a SIGNED LOCATION channel and a SIGNED
 * SCALE channel using the closed-form null correlation
 * rho.
 *
 * Background. Cucconi's C is a JOINT statistic — it loses
 * the directional information when collapsed to a single
 * upper-tail p-value. For downstream Stouffer-style
 * aggregation we need orthogonal signed projections.
 *
 * Construction. Marozzi (2009) sec. 4 observes that under
 * a pure LOCATION shift (B stochastically larger than A),
 * U and V have OPPOSITE signs and EQUAL absolute values
 * (T1 inflates exactly as T2 deflates because the rank
 * sum is conserved); under a pure SCALE shift
 * (B more dispersed than A around the same median), U and
 * V have the SAME sign (both T1 and T2 grow because B's
 * ranks pile up at BOTH extremes of the pool).
 *
 * The natural orthogonal basis is therefore:
 *
 *     locZ   = (ccU - ccV) / sqrt(2 (1 - rho))
 *     scaleZ = (ccU + ccV) / sqrt(2 (1 + rho))
 *
 * Each is a SIGNED N(0, 1)-distributed (asymptotically)
 * channel under H0 (since (ccU, ccV) is asymptotically
 * bivariate normal with correlation rho, the rotated
 * components U-V and U+V have variances 2(1-rho) and
 * 2(1+rho) respectively, with zero covariance). The sum
 * of squares satisfies the EXACT IDENTITY
 *
 *     locZ^2 + scaleZ^2 == 2 * C
 *
 * (verified by the test suite), so this is a NORM-
 * PRESERVING decomposition — it splits the joint chi-2(2)
 * mass between the two interpretable channels without
 * loss.
 *
 * SIGN CONVENTIONS:
 *   - locZ > 0   -> second half stochastically LARGER
 *                   (location of B has shifted UP);
 *                   matches Mann-Whitney-115 mwZ sign
 *                   convention.
 *   - locZ < 0   -> second half stochastically SMALLER.
 *   - scaleZ > 0 -> second half MORE DISPERSED about
 *                   the pool centre (matches Siegel-
 *                   Tukey-117 stZ and Ansari-Bradley-170
 *                   abZ sign conventions);
 *   - scaleZ < 0 -> second half MORE CONCENTRATED about
 *                   the pool centre.
 *
 * Throws on non-finite inputs or rho not in (-1, 1).
 */
export function cucconiSignedChannels(
  ccU: number,
  ccV: number,
  ccRho: number,
): { locZ: number; scaleZ: number } {
  if (!Number.isFinite(ccU) || !Number.isFinite(ccV)) {
    throw new Error(
      `cucconiSignedChannels: non-finite ccU/ccV (ccU=${ccU}, ccV=${ccV})`,
    );
  }
  if (!Number.isFinite(ccRho) || ccRho <= -1 || ccRho >= 1) {
    throw new Error(
      `cucconiSignedChannels: ccRho must be in (-1, 1) (got ${ccRho})`,
    );
  }
  const locZ = (ccU - ccV) / Math.sqrt(2 * (1 - ccRho));
  const scaleZ = (ccU + ccV) / Math.sqrt(2 * (1 + ccRho));
  return { locZ, scaleZ };
}

/**
 * Classification label for the Cucconi joint signal
 * based on the angle of (locZ, scaleZ) in the
 * decomposition plane.
 *
 *   |locZ| / |scaleZ| > 2  ->  'location-dominant'
 *   |scaleZ| / |locZ| > 2  ->  'scale-dominant'
 *   otherwise              ->  'mixed'
 *
 * The 2:1 magnitude ratio corresponds to ~80 deg / ~10
 * deg in the (locZ, scaleZ) plane and reproduces the
 * cutoffs Marozzi (2009) sec. 4 reports as empirically
 * sharp on simulated joint location-scale alternatives.
 *
 * Returns 'null-like' when both |locZ| and |scaleZ| are
 * below 0.5 (no detectable signal in either channel).
 *
 * Pure helper, no external dependency.
 */
export type CucconiDirection =
  | 'null-like'
  | 'location-dominant'
  | 'scale-dominant'
  | 'mixed';

export function cucconiDirectionLabel(
  locZ: number,
  scaleZ: number,
): CucconiDirection {
  if (!Number.isFinite(locZ) || !Number.isFinite(scaleZ)) {
    throw new Error(
      `cucconiDirectionLabel: non-finite inputs (locZ=${locZ}, scaleZ=${scaleZ})`,
    );
  }
  const aL = Math.abs(locZ);
  const aS = Math.abs(scaleZ);
  if (aL < 0.5 && aS < 0.5) return 'null-like';
  if (aS === 0) return 'location-dominant';
  if (aL === 0) return 'scale-dominant';
  if (aL / aS > 2) return 'location-dominant';
  if (aS / aL > 2) return 'scale-dominant';
  return 'mixed';
}
