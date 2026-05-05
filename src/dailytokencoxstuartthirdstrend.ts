/**
 * daily-token-cox-stuart-thirds-trend: per-source COX-
 * STUART 1955 sec. 5 *THIRDS-VARIANT* SIGN TEST FOR
 * TREND on the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-FIFTEENTH cross-source axis.
 *
 * Mechanism. Cox & Stuart (1955, *J. R. Statist. Soc. B*
 * 17(1):222-228, "Some quick sign tests for trend in
 * location and dispersion") propose a quick sign-of-
 * paired-differences trend test. Their HEADLINE form
 * (axes 111 and 205 in this suite) pairs the i-th
 * observation with the (i + ceil(n/2))-th, giving
 * floor(n/2) pairs separated by a HALF-SERIES lag.
 *
 * In the SAME paper (sec. 5, "Tests with three or more
 * groups of observations") Cox & Stuart explicitly
 * suggest splitting the series into THIRDS and pairing
 * the FIRST third with the LAST third, *DROPPING THE
 * MIDDLE THIRD ENTIRELY*. Concretely, with
 *
 *     m   = floor(n / 3)
 *     gap = n - m                         (lag between paired indices)
 *
 * we form exactly m pairs
 *
 *     d_i = x[i + gap] - x[i],   i = 0, 1, ..., m - 1
 *
 * Note `gap >= 2*m` (with equality iff n is a multiple
 * of 3) so EVERY pair lag is at least 2/3 of the
 * tenure, giving each pair-difference STRONGER signal-
 * to-noise for slow monotone drifts than the half-pair
 * variant (whose pair lags are only n/2 apart).
 *
 * Define
 *
 *     csTPlus   = #{ i : d_i > 0 }
 *     csTMinus  = #{ i : d_i < 0 }
 *     csTTies   = #{ i : d_i = 0 }
 *     csTNonTies = csTPlus + csTMinus
 *
 * Under H0 of NO MONOTONIC TREND the late-minus-early
 * sign is symmetric Bernoulli(1/2) on the non-tied
 * pairs (Cox-Stuart 1955 sec. 5 eq. 11; Daniel 1990
 * *Applied Nonparametric Statistics* 2nd ed. sec. 2.2;
 * Hollander, Wolfe & Chicken 2014 sec. 3.1). So
 * csTPlus ~ Binomial(csTNonTies, 1/2) under H0, and the
 * standardised statistic
 *
 *     csTZ = ( csTPlus - csTNonTies / 2 ) /
 *            sqrt( csTNonTies / 4 )
 *          ~~ N(0, 1)
 *
 * is asymptotically standard normal once
 * csTNonTies >= 8. (Cox-Stuart 1955 Table 4 finds the
 * normal approximation accurate within 0.005 of nominal
 * alpha at csTNonTies = 8 for two-sided tests.) The
 * two-sided p-value is
 *
 *     csTPValue = 2 * (1 - Phi(|csTZ|))
 *
 * via the same Abramowitz-Stegun 26.2.17 Q(z) used by
 * axis-205.
 *
 * SIGN CONVENTION:
 *
 *     csTZ much greater than +1.96 = significantly MORE
 *       positive thirds-pair differences than 50/50 =
 *       SIGNIFICANT UP-TREND on the third-vs-third lag.
 *     csTZ much less than -1.96    = significant DOWN-
 *       TREND on the third-vs-third lag.
 *     |csTZ| < 1.96                = no detectable
 *       monotone third-vs-third drift.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test
 *     (CLASSIC HALF-PAIR Cox-Stuart). Axis-111 uses pair
 *     lag c = floor(n/2) and m = floor(n/2) pairs.
 *     Axis-215 uses pair lag gap = n - floor(n/3) =
 *     ceil(2n/3) and m = floor(n/3) pairs. The TWO ARE
 *     NOT MONOTONICALLY EQUIVALENT because:
 *     (a) the pair INDEX SETS are disjoint above i =
 *         floor(n/3) (axis-111 pairs go through floor(n/2)-1;
 *         axis-215 pairs stop at floor(n/3)-1 on the early
 *         side and start at ceil(2n/3) on the late side);
 *     (b) the THIRDS variant's STRONGER LAG concentrates
 *         signal for slow monotone drifts: for x[i] = a + b*i
 *         + eps_i with iid eps the per-pair signal-to-noise
 *         ratio is b * gap / sqrt(2) sigma vs b * c /
 *         sqrt(2) sigma -- a factor of ~4/3 ratio in favour
 *         of THIRDS, so axis-215 is MORE POWERFUL for a
 *         given m at slow drifts;
 *     (c) the THIRDS variant has LOWER m, so for FAST
 *         alternating-sign drifts (e.g. periodic with
 *         period ~n/3) axis-215 will tie-out (signs are
 *         random across the third-of-period lag) where
 *         axis-111 still detects the half-period mismatch.
 *     The two statistics can have OPPOSITE SIGNS on the
 *     same series (e.g. up-then-down-then-up: axis-111's
 *     half-pair sees mixed signs but the early/late thirds
 *     are both up so axis-215 says UP).
 *
 *   - vs axis-205 daily-token-cox-stuart-sign-pairs.
 *     Same as above; axis-205 is the same half-pair
 *     statistic as axis-111 with a different downstream
 *     aggregator. Axis-215 changes the UNDERLYING PAIR
 *     SET; not a downstream re-packaging.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. MK is the
 *     ALL-PAIRS concordance count over all C(n,2) pairs;
 *     axis-215 is a SIGN-TEST on a CARDINALITY-floor(n/3)
 *     pair subset chosen for maximum lag. MK is omnibus
 *     for any monotone trend; axis-215 specifically
 *     targets HEAD-VS-TAIL location shift while
 *     STRUCTURALLY IGNORING THE MIDDLE THIRD.
 *
 *   - vs axis-214 daily-token-theil-sen-slope. Theil-Sen
 *     is a POINT ESTIMATOR of slope MAGNITUDE in tokens/
 *     day with a Sen 1968 rank-based CI. Axis-215 is a
 *     UNITLESS sign-count Z and reports no slope
 *     magnitude. A series with steep Theil-Sen slope and
 *     a FLAT MIDDLE THIRD will show high theilSenSlope
 *     and high csTZ; a series with steep slope only in
 *     the MIDDLE THIRD (e.g. a step in the middle that
 *     cancels by tenure end) will show high theilSenSlope
 *     but ZERO csTZ.
 *
 *   - vs axis-213 daily-token-page-l-block-trend. Page-L
 *     is a within-3-day-block ordered-alternative test
 *     on midranks (LOCAL block-by-block). Axis-215 is a
 *     GLOBAL head-vs-tail sign test that DROPS the
 *     middle third. The two share no common monotone
 *     transformation.
 *
 *   - vs axis-197 daily-token-foster-stuart-s. FS-S
 *     counts PREFIX-EXTREMUM-CROSSING events (records);
 *     axis-215 counts head-vs-tail PAIR-DIFFERENCE signs.
 *     FS-S is sensitive to dispersion instability;
 *     axis-215 is sensitive to head-vs-tail location
 *     shift only. Records and pair-differences are
 *     fundamentally different functionals.
 *
 *   - vs all spectral / PSD / fractal-dimension /
 *     inequality / shape axes. Those are
 *     PERMUTATION-INVARIANT (or amplitude-only).
 *     Axis-215 is fundamentally NON-permutation-invariant:
 *     a reverse permutation flips csTZ's sign but not
 *     |csTZ|, while a random shuffle drives csTZ to ~0.
 *
 * Headline question:
 * **"For each source, are the LAST THIRD of daily-token
 *   observations systematically larger (csTZ much
 *   greater than 0) or smaller (csTZ much less than 0)
 *   than the FIRST THIRD when matched pair-by-pair on
 *   the third-vs-third lag, IGNORING the middle third
 *   ENTIRELY?"**
 *
 * References:
 *   Cox, D. R. & Stuart, A., "Some quick sign tests for
 *     trend in location and dispersion", J. R. Statist.
 *     Soc. B 17(1) (1955), pp. 222-228, esp. sec. 5
 *     "Tests with three or more groups of observations"
 *     (the thirds variant is recommended there for
 *     additional power against monotone trend).
 *   Daniel, W. W., "Applied Nonparametric Statistics",
 *     2nd ed., Duxbury 1990, sec. 2.2 (sign test
 *     justification on the matched-pair count).
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     "Nonparametric Statistical Methods", 3rd ed.,
 *     Wiley 2014, sec. 3.1 (normal-approximation
 *     accuracy of the binomial sign test at small n).
 *   Conover, W. J., "Practical Nonparametric Statistics",
 *     3rd ed., Wiley 1999, p. 159-161 (tie-handling
 *     convention: drop ties before standardising).
 *
 * Caveats:
 *
 *   - Index parity: when n is not a multiple of 3 the
 *     "middle third" is not exactly n/3 indices; we use
 *     m = floor(n/3) pairs and gap = n - m. This is the
 *     Cox-Stuart 1955 sec. 5 convention.
 *   - Hard floor n >= 24: we need at least m = 8 pairs
 *     for the normal approximation to have usable
 *     accuracy. (Below 8 we throw and the row drops to
 *     droppedNonFiniteFit.)
 *   - Ties are EXCLUDED from the standardised statistic
 *     (Cox-Stuart 1955 sec. 2; Conover 1999 p. 159).
 *     In the zero-padded sparse-day regime ties are
 *     common and csTNonTies can be much smaller than
 *     csTPairs; we surface BOTH counts.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=24 so m >= 8):
 *   pew-insights daily-token-cox-stuart-thirds-trend
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-cox-stuart-thirds-trend \
 *     --source vsc-redacted --json
 *
 *   # Sort by absolute Z descending (strongest head-vs-tail
 *   # drift first):
 *   pew-insights daily-token-cox-stuart-thirds-trend \
 *     --sort csTZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenCoxStuartThirdsTrendSort =
  | 'csTZ'
  | 'csTZAbsDesc'
  | 'csTPValue'
  | 'csTPValueDesc'
  | 'csTPlus'
  | 'csTPlusDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCoxStuartThirdsTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 24 so
   * the resulting m = floor(n/3) >= 8 pairs is enough
   * for the normal approximation to have usable accuracy.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCoxStuartThirdsTrendSort;
  generatedAt?: string;
}

export interface DailyTokenCoxStuartThirdsTrendSourceRow {
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
  /** Number of pairs m = floor(n/3). */
  csTPairs: number;
  /** Pair lag gap = n - floor(n/3) = ceil(2n/3). */
  csTGap: number;
  /** Count of strictly positive thirds-pair differences. */
  csTPlus: number;
  /** Count of strictly negative thirds-pair differences. */
  csTMinus: number;
  /** Count of zero thirds-pair differences (excluded from Z). */
  csTTies: number;
  /** Effective sample size csTPlus + csTMinus. */
  csTNonTies: number;
  /** Standardised Z = (csTPlus - csTNonTies/2) / sqrt(csTNonTies/4). */
  csTZ: number;
  /** Two-sided normal p-value. */
  csTPValue: number;
}

export interface DailyTokenCoxStuartThirdsTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCoxStuartThirdsTrendSort;
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
  sources: DailyTokenCoxStuartThirdsTrendSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 *
 * Self-contained copy (matches the helper used by
 * axis-205 daily-token-cox-stuart-sign-pairs).
 */
export function standardNormalUpperTailCoxStuartThirds(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailCoxStuartThirds: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailCoxStuartThirds(-z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * z);
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    b1 * t +
    b2 * t * t +
    b3 * t * t * t +
    b4 * t * t * t * t +
    b5 * t * t * t * t * t;
  const q = phi * poly;
  return q < 0 ? 0 : q > 1 ? 1 : q;
}

/**
 * Count Cox-Stuart THIRDS-variant paired-difference
 * signs on `values` with pair lag gap = n - floor(n/3)
 * = ceil(2n/3). Returns the per-pair counts (positive,
 * negative, ties), the number of pairs m = floor(n/3),
 * and the actual gap. The middle third (indices m, m+1,
 * ..., gap-1 = n-m-1) is dropped entirely from the
 * statistic.
 *
 * Pair (i, i + gap) for i = 0, 1, ..., m - 1.
 *
 * EXACT IDENTITIES preserved by this function (verified
 * by the test suite):
 *   - For n = 9: m = 3, gap = 6, pairs are (0,6),(1,7),(2,8).
 *   - For n = 10: m = 3, gap = 7, pairs are (0,7),(1,8),(2,9).
 *   - For n = 12: m = 4, gap = 8, pairs are (0,8),(1,9),(2,10),(3,11).
 *   - gap = n - m always satisfies gap >= 2*m with
 *     equality iff n is a multiple of 3.
 */
export function countCoxStuartThirdsPairs(values: number[]): {
  csTPairs: number;
  csTGap: number;
  csTPlus: number;
  csTMinus: number;
  csTTies: number;
} {
  const n = values.length;
  const m = Math.floor(n / 3);
  const gap = n - m;
  let csTPlus = 0;
  let csTMinus = 0;
  let csTTies = 0;
  for (let i = 0; i < m; i += 1) {
    const a = values[i]!;
    const b = values[i + gap]!;
    const d = b - a;
    if (d > 0) csTPlus += 1;
    else if (d < 0) csTMinus += 1;
    else csTTies += 1;
  }
  return { csTPairs: m, csTGap: gap, csTPlus, csTMinus, csTTies };
}

/**
 * Cox-Stuart 1955 sec. 5 THIRDS-variant sign-test for
 * trend on a real-valued series. Returns the per-pair
 * counts, the lag, the standardised Z, and the two-
 * sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - csTPlus(x + c) === csTPlus(x) for any constant c
 *     (paired differences are translation-invariant).
 *   - csTPlus(a * x) === csTPlus(x) for any a > 0
 *     (positive scale preserves sign of pair-differences).
 *   - csTPlus(-x) === csTMinus(x) (negation flips every
 *     pair-difference sign uniformly), so csTZ(-x) ===
 *     -csTZ(x) on tie-free input.
 *   - For x strictly increasing: csTPlus === csTPairs.
 *   - For x strictly decreasing: csTMinus === csTPairs.
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 *   - csTZ is finite and well-defined when csTNonTies >= 1.
 *   - csTGap >= 2*csTPairs always (the head and tail
 *     thirds are guaranteed disjoint).
 */
export function dailyTokenCoxStuartThirdsTrend(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  csTPairs: number;
  csTGap: number;
  csTPlus: number;
  csTMinus: number;
  csTTies: number;
  csTNonTies: number;
  csTZ: number;
  csTPValue: number;
} {
  const n = values.length;
  if (n < 24) {
    throw new Error(
      `dailyTokenCoxStuartThirdsTrend: need at least 24 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenCoxStuartThirdsTrend requires finite values',
      );
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
      `dailyTokenCoxStuartThirdsTrend: zero centred variance (n=${n})`,
    );
  }

  const observed = countCoxStuartThirdsPairs(values);
  const csTNonTies = observed.csTPlus + observed.csTMinus;
  if (csTNonTies < 8) {
    throw new Error(
      `dailyTokenCoxStuartThirdsTrend: too few non-tied thirds-pairs (csTNonTies=${csTNonTies}, need >=8)`,
    );
  }
  // Sign-test standardisation under H0 csTPlus ~ Bin(csTNonTies, 1/2):
  //   E[csTPlus]   = csTNonTies / 2
  //   Var[csTPlus] = csTNonTies / 4
  const expPlus = csTNonTies / 2;
  const varPlus = csTNonTies / 4;
  if (!(varPlus > 0) || !Number.isFinite(varPlus)) {
    throw new Error(
      `dailyTokenCoxStuartThirdsTrend: degenerate variance (varPlus=${varPlus})`,
    );
  }
  const csTZ = (observed.csTPlus - expPlus) / Math.sqrt(varPlus);
  if (!Number.isFinite(csTZ)) {
    throw new Error(
      `dailyTokenCoxStuartThirdsTrend: non-finite z (n=${n})`,
    );
  }
  const csTPValue =
    2 * standardNormalUpperTailCoxStuartThirds(Math.abs(csTZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    csTPairs: observed.csTPairs,
    csTGap: observed.csTGap,
    csTPlus: observed.csTPlus,
    csTMinus: observed.csTMinus,
    csTTies: observed.csTTies,
    csTNonTies,
    csTZ,
    csTPValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-215. Combines
 * per-source SIGNED csTZ via Stouffer's Z-method
 * (Stouffer et al. 1949 *The American Soldier*, Vol. 1
 * sec. 3). Skips malformed rows.
 *
 * Stouffer's Z = sum(z_i) / sqrt(k); under H0 of a global
 * absence of head-vs-tail trend across all k surfaced
 * sources, Stouffer's Z is approximately N(0, 1) and the
 * two-sided p-value is 2 * (1 - Phi(|stoufferZ|)).
 *
 * Returns NaN means when no rows are usable.
 */
export interface CoxStuartThirdsTrendCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanCsTZ: number;
  tenureWeightedMeanCsTZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateCoxStuartThirdsTrend(
  rows: ReadonlyArray<{
    csTZ: number;
    csTPValue: number;
    csTNonTies: number;
    nTenureDays: number;
  }>,
): CoxStuartThirdsTrendCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.csTZ) ||
      !Number.isFinite(r.csTPValue) ||
      r.csTPValue <= 0 ||
      r.csTPValue > 1 ||
      !Number.isInteger(r.csTNonTies) ||
      r.csTNonTies < 8 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.csTZ;
    weightedZSum += r.nTenureDays * r.csTZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanCsTZ: Number.NaN,
      tenureWeightedMeanCsTZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailCoxStuartThirds(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanCsTZ: zSum / used,
    tenureWeightedMeanCsTZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
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

export function buildDailyTokenCoxStuartThirdsTrend(
  queue: QueueLine[],
  opts: DailyTokenCoxStuartThirdsTrendOptions = {},
): DailyTokenCoxStuartThirdsTrendReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 24;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 24) {
    throw new Error(
      `minTenureDays must be an integer >= 24 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenCoxStuartThirdsTrendSort = opts.sort ?? 'csTZAbsDesc';
  const validSorts: DailyTokenCoxStuartThirdsTrendSort[] = [
    'csTZ',
    'csTZAbsDesc',
    'csTPValue',
    'csTPValueDesc',
    'csTPlus',
    'csTPlusDesc',
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
  const rows: DailyTokenCoxStuartThirdsTrendSourceRow[] = [];

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
      result = dailyTokenCoxStuartThirdsTrend(filled);
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
      csTPairs: result.csTPairs,
      csTGap: result.csTGap,
      csTPlus: result.csTPlus,
      csTMinus: result.csTMinus,
      csTTies: result.csTTies,
      csTNonTies: result.csTNonTies,
      csTZ: result.csTZ,
      csTPValue: result.csTPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'csTZ':
        primary = a.csTZ - b.csTZ;
        break;
      case 'csTZAbsDesc':
        primary = Math.abs(b.csTZ) - Math.abs(a.csTZ);
        break;
      case 'csTPValue':
        primary = a.csTPValue - b.csTPValue;
        break;
      case 'csTPValueDesc':
        primary = b.csTPValue - a.csTPValue;
        break;
      case 'csTPlus':
        primary = a.csTPlus - b.csTPlus;
        break;
      case 'csTPlusDesc':
        primary = b.csTPlus - a.csTPlus;
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
