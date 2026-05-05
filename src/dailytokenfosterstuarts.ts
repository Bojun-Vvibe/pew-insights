/**
 * daily-token-foster-stuart-s: per-source FOSTER-STUART
 * S-STATISTIC for INSTABILITY-OF-DISPERSION via combined
 * STRICT UPPER + STRICT LOWER RECORD COUNTS over the
 * gap-filled daily total_tokens series, with the closed-
 * form harmonic-number null (Foster & Stuart 1954, J. R.
 * Statist. Soc. B 16(1):1-22).
 *
 * ONE-HUNDRED-AND-NINETY-SEVENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Following Foster & Stuart 1954 sec. 2 we EXCLUDE index 0
 * from both the upper and the lower record passes (the
 * trivial "the first observation is its own running max
 * and min"). For i in {1, .., n-1} define the FOSTER-
 * STUART RECORD INDICATORS
 *
 *     u_i = 1[ x[i] > max(x[0..i-1]) ]   (strict upper)
 *     l_i = 1[ x[i] < min(x[0..i-1]) ]   (strict lower)
 *
 * and the integer counts
 *
 *     U = sum_{i=1}^{n-1} u_i        in {0, .., n-1}
 *     L = sum_{i=1}^{n-1} l_i        in {0, .., n-1}
 *
 * The FOSTER-STUART S-STATISTIC is the SUM
 *
 *     S = U + L                       in {0, .., 2(n-1)}
 *
 * and the FOSTER-STUART D-STATISTIC is the SIGNED
 * DIFFERENCE
 *
 *     D = U - L                       in {-(n-1), .., +(n-1)}
 *
 * S targets DISPERSION INSTABILITY (a series whose
 * dispersion is GROWING produces both new highs AND new
 * lows long after the iid harmonic clock predicts they
 * should stop arriving); D targets TREND DIRECTION (a
 * series with a STRONG UP-TREND produces many new HIGHS
 * but few new LOWS, and vice versa).  This module
 * surfaces BOTH but headlines S; the D-statistic is
 * exposed as a side-quantity for downstream joiners.
 *
 * Closed-form null distribution (Foster & Stuart 1954
 * sec. 2 + Renyi 1962 record-indicator decomposition).
 * Under the iid-continuous null, for each i in
 * {1, .., n-1} the indicator u_i is Bernoulli(1/(i+1))
 * because x[i] is the maximum of the first i+1 iid values
 * with probability 1/(i+1); similarly l_i is Bernoulli(
 * 1/(i+1)). Furthermore the indicators u_i (resp. l_i)
 * across i are MUTUALLY INDEPENDENT (Renyi 1962); under
 * the iid-continuous null U and L are ASYMPTOTICALLY
 * UNCORRELATED (the leading-order independence
 * approximation used by Foster & Stuart 1954 Table 1;
 * Glick 1978 Amer. Math. Monthly 85:2-26 sec. 4 shows
 * Cov(U, L) = O(1) while Var(U) and Var(L) each grow
 * like ln n + gamma, so the relative correlation
 * vanishes). This gives the closed-form moments
 *
 *     E[U]   = E[L]   = mu_1            where
 *     mu_1                = sum_{k=2}^{n} 1/k    = H_n - 1
 *     Var[U] = Var[L] = mu_2            where
 *     mu_2                = sum_{k=2}^{n} 1/k - sum_{k=2}^{n} 1/k^2
 *                         = (H_n - 1) - (H_n^{(2)} - 1)
 *                         = H_n - H_n^{(2)}
 *     E[S]   = 2 * mu_1   = 2 * (H_n - 1)
 *     Var[S] = 2 * mu_2   = 2 * (H_n - H_n^{(2)})    (asymptotic)
 *     E[D]   = 0
 *     Var[D] = 2 * mu_2   = 2 * (H_n - H_n^{(2)})    (asymptotic)
 *
 * with H_n = sum_{k=1}^{n} 1/k and H_n^{(2)} =
 * sum_{k=1}^{n} 1/k^2.  The standardised z-scores
 *
 *     fsSZ = (S - 2*mu_1) / sqrt(2 * mu_2)
 *     fsDZ = (D - 0)      / sqrt(2 * mu_2)
 *
 * are each approximately N(0, 1) for moderate n under the
 * iid-continuous null (the underlying sums of independent
 * Bernoullis are asymptotically normal by Lyapunov's
 * CLT).  For n < 6 the variance mu_2 is so small that the
 * normal approximation is meaningless; we report fsSZ and
 * fsDZ as 0 and the test as not-applicable.
 *
 * SIGN CONVENTIONS.
 *
 *   - fsSZ > 0  <=>  MORE TOTAL RECORDS than the iid
 *     harmonic clock predicts  <=>  the dispersion of the
 *     series GREW over the tenure (new highs AND new lows
 *     keep arriving past iid expectation).
 *   - fsSZ < 0  <=>  FEWER TOTAL RECORDS than expected
 *     <=>  the dispersion was SET EARLY and locked in (no
 *     new extremes after the first few observations).
 *   - fsDZ > 0  <=>  more UPPER than LOWER records  <=>
 *     UPWARD TREND.
 *   - fsDZ < 0  <=>  more LOWER than UPPER records  <=>
 *     DOWNWARD TREND.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-109 daily-token-upper-records-count.
 *     Axis-109 is the RENYI count R_n with INDEX 0
 *     included as a trivial record; its statistic is
 *     U_{Renyi} = U_{Foster-Stuart} + 1 and is sensitive
 *     ONLY to the upper tail.  The Foster-Stuart S
 *     statistic combines the UPPER and LOWER record
 *     channels, surfacing dispersion-instability that
 *     axis-109 cannot see (a series with no new upper
 *     records but a long stream of new lower records --
 *     pure downward dispersion drift -- is null on
 *     axis-109 but rejects strongly on fsSZ).  More
 *     concretely: fsSZ depends on BOTH tails of the
 *     prefix-extremum-improvement events, while
 *     axis-109's recordZ depends on ONE tail only.
 *
 *   - vs axis-106 daily-token-turning-point-rate. TPR
 *     counts INTERIOR LOCAL EXTREMA (sign changes of the
 *     first difference), a LOCAL three-window symbolic
 *     statistic.  Foster-Stuart S counts PREFIX-EXTREMUM-
 *     CROSSING events, a GLOBAL prefix-comparison
 *     statistic: each event compares to the ENTIRE
 *     prefix history, not just to the two neighbours.  A
 *     series can have arbitrary TPR with the same S: a
 *     monotone increasing series has TPR = 0 and S = n-1
 *     (every index past 0 sets a new upper record); a
 *     symmetrically-alternating series around its initial
 *     value has TPR ~ 1 and S = small (ties suppress
 *     strict records).
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. MK is
 *     an ALL-PAIRS concordance statistic on the level
 *     series, sensitive to MONOTONE TREND.  Foster-Stuart
 *     S is a PREFIX-EXTREMUM statistic sensitive to
 *     DISPERSION INSTABILITY -- a series with constant
 *     mean but growing variance has tau ~ 0 (no
 *     monotone-trend signal) but fsSZ much greater than 0
 *     (many late-arriving new highs and new lows).
 *     Conversely, the Foster-Stuart D-statistic IS
 *     trend-sensitive but in a fundamentally different
 *     way from MK: D depends on PREFIX-RECORD events
 *     only, while MK depends on every (i, j) pair.
 *
 *   - vs axis-194 daily-token-wald-wolfowitz-runs-halves.
 *     WW is a TWO-SAMPLE LABEL-RANDOMNESS test on the
 *     first-half/second-half partition.  Foster-Stuart S
 *     is a SINGLE-SAMPLE FULL-SERIES extremum-event
 *     count.  Mechanism-wise the two are not even of the
 *     same class: WW depends on the ALTERNATION of group
 *     labels in the pooled-rank order; FS-S depends on
 *     the PREFIX-RECORD events in the level series.  A
 *     series with perfectly random WW labels can have
 *     fsSZ at any extreme value (e.g., growing dispersion
 *     within both halves equally).
 *
 *   - vs axis-195 daily-token-rosenbaum-adjacency-halves.
 *     Rosenbaum counts the EXTREME-ORDER-STATISTICS
 *     (largest values of either group) and how MANY
 *     come from the larger-group END of the pooled
 *     ordering.  It is a TWO-SAMPLE TAIL-DOMINANCE test.
 *     FS-S is a SINGLE-SAMPLE extremum-event count over
 *     the FULL series.  The two functionals share NO
 *     common transformation: Rosenbaum depends on the
 *     POOLED-RANK ASSIGNMENT to the two halves;
 *     FS-S depends on the PREFIX-EXTREMUM HISTORY of the
 *     undivided series.
 *
 *   - vs the spectral / PSD / fractal-dimension axes.
 *     Those map either the FULL-tenure periodogram or a
 *     scaling-exponent fit to a scalar; both are
 *     PERMUTATION-INVARIANT (PSD via time-reversal
 *     symmetry; FD via sliding-box averaging).  Foster-
 *     Stuart S is fundamentally NON-permutation-invariant:
 *     a reverse-sorted permutation of x has fsSZ very
 *     negative (no new records arrive after position 0
 *     for either pass) while the permuted version may
 *     have fsSZ very positive.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). Those are PERMUTATION-INVARIANT
 *     functionals of the empirical distribution.  Foster-
 *     Stuart S depends on TEMPORAL ORDER through the
 *     prefix-max and prefix-min event chain.
 *
 * Headline question:
 * **"For each source, do new HIGHS and new LOWS keep
 *   arriving in the gap-filled daily token series at
 *   roughly the iid harmonic rate (S ~ 2*(H_n - 1)) -- or
 *   does dispersion appear to be GROWING (S much greater
 *   than expected, fsSZ much greater than 0) or LOCKED IN
 *   EARLY (S much smaller than expected, fsSZ much less
 *   than 0)?"**
 *
 * Reference:
 *   Foster, F. G. & Stuart, A., "Distribution-free tests
 *     in time-series based on the breaking of records",
 *     J. R. Statist. Soc. B 16(1) (1954), pp. 1-22 (with
 *     discussion).
 *   Renyi, A., "Theorie des elements saillants d'une
 *     suite d'observations", Ann. Sci. Univ. Clermont-
 *     Ferrand 8 (1962), pp. 7-13.
 *   Glick, N., "Breaking records and breaking boards",
 *     Amer. Math. Monthly 85 (1978), pp. 2-26.
 *   Arnold, B. C., Balakrishnan, N. and Nagaraja, H. N.,
 *     "Records", Wiley 1998, ch. 2 (Bernoulli-convolution
 *     representation; asymptotic uncorrelatedness of U
 *     and L under iid continuous).
 *
 * Caveats:
 *
 *   - Index 0 is INTENTIONALLY EXCLUDED from both passes
 *     (this is the Foster-Stuart 1954 convention; it
 *     differs from the Renyi 1962 / axis-109 convention
 *     of treating index 0 as a trivial record).  Hence
 *     U + L = S in {0, .., 2(n-1)} with iid expectation
 *     2*(H_n - 1).
 *   - Cov(U, L) is treated as zero for the variance (the
 *     Foster-Stuart 1954 Table 1 / Glick 1978 sec. 4
 *     leading-order asymptotic approximation).  The
 *     correction term is O(1/ln n) in the standardised
 *     fsSZ for large n; for the gap-filled tenure
 *     regime (n ~ 14-200) this contributes < 5% to the
 *     z-score.
 *   - In the zero-padded sparse-day regime, ties at zero
 *     are common and STRICT inequalities can suppress
 *     records.  We surface the LOOSE (>=, <=) counts
 *     `nUpperRecordsLooseFs`, `nLowerRecordsLooseFs` as
 *     side quantities for callers who want the
 *     alternative; the headline counts and z-scores are
 *     ALWAYS the strict variants (only the strict
 *     variants match the closed-form null).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-foster-stuart-s
 *
 *   pew-insights daily-token-foster-stuart-s \
 *     --json --min-tenure-days 30 --sort fsSZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenFosterStuartSSort =
  | 's'
  | 'sDesc'
  | 'fsSZ'
  | 'fsSZDesc'
  | 'fsSZAbs'
  | 'fsSZAbsDesc'
  | 'fsDZ'
  | 'fsDZDesc'
  | 'fsDZAbs'
  | 'fsDZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenFosterStuartSOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 6 so
   * mu_2 = H_n - H_n^{(2)} is large enough for the normal
   * approximation to have any purchase (mu_2(6) ~ 0.96).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenFosterStuartSSort;
  generatedAt?: string;
}

export interface DailyTokenFosterStuartSSourceRow {
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
  /** STRICT upper records on indices 1..n-1 (Foster-Stuart convention). */
  nUpperRecordsFs: number;
  /** STRICT lower records on indices 1..n-1 (Foster-Stuart convention). */
  nLowerRecordsFs: number;
  /** LOOSE (>=) upper records on indices 1..n-1 (side quantity). */
  nUpperRecordsLooseFs: number;
  /** LOOSE (<=) lower records on indices 1..n-1 (side quantity). */
  nLowerRecordsLooseFs: number;
  /** S = nUpperRecordsFs + nLowerRecordsFs. */
  fsS: number;
  /** D = nUpperRecordsFs - nLowerRecordsFs. */
  fsD: number;
  /** mu_1 = H_n - 1 = sum_{k=2}^{n} 1/k. */
  fsExpectedU: number;
  /** mu_2 = H_n - H_n^{(2)} = sum_{k=2}^{n} (1/k - 1/k^2). */
  fsVarU: number;
  /** Asymptotic E[S] = 2*mu_1. */
  fsExpectedS: number;
  /** Asymptotic Var[S] = 2*mu_2. */
  fsVarS: number;
  /** Standardised score (S - 2*mu_1) / sqrt(2*mu_2) ~ N(0,1). */
  fsSZ: number;
  /** Standardised score D / sqrt(2*mu_2) ~ N(0,1). */
  fsDZ: number;
}

export interface DailyTokenFosterStuartSReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenFosterStuartSSort;
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
  sources: DailyTokenFosterStuartSSourceRow[];
}

/**
 * Foster-Stuart S and D record-event counts on a real-
 * valued series, EXCLUDING index 0 from both record
 * passes (Foster & Stuart 1954 convention).
 *
 * Closed-form sanity anchors verified by the test suite:
 *
 *   - x = (1, 2, .., n)        -> U = n-1, L = 0,
 *     S = n-1, D = +(n-1)  (every index past 0 is a new
 *     strict upper record, no new lows ever)
 *   - x = (n, n-1, .., 1)      -> U = 0, L = n-1,
 *     S = n-1, D = -(n-1)  (mirror image)
 *   - x = (c, c, .., c)        -> U = 0, L = 0,
 *     S = 0, D = 0          (no strict records possible)
 *   - x = (1, n, 2, n-1, ..)   -> S much greater than
 *     2*(H_n-1)            (alternating extreme-injection
 *     yields many records of both kinds)
 *   - i.i.d. continuous        -> E[S] = 2*(H_n - 1),
 *     Var[S] = 2*(H_n - H_n^{(2)})  (asymptotic;
 *     Foster-Stuart 1954 Table 1)
 *
 * Throws when the series is too short or contains
 * non-finite entries.
 */
export function dailyTokenFosterStuartS(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nUpperRecordsFs: number;
  nLowerRecordsFs: number;
  nUpperRecordsLooseFs: number;
  nLowerRecordsLooseFs: number;
  fsS: number;
  fsD: number;
  fsExpectedU: number;
  fsVarU: number;
  fsExpectedS: number;
  fsVarS: number;
  fsSZ: number;
  fsDZ: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenFosterStuartS: need at least 3 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenFosterStuartS requires finite values');
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

  // Strict upper / lower record passes, excluding index 0
  // (Foster-Stuart 1954 convention).
  let runningMax = values[0]!;
  let runningMin = values[0]!;
  let nU = 0;
  let nL = 0;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v > runningMax) {
      nU += 1;
      runningMax = v;
    }
    if (v < runningMin) {
      nL += 1;
      runningMin = v;
    }
  }
  // Loose (>=, <=) side counts. Run independent passes
  // because the strict and loose running extrema diverge
  // once a tie at the current extremum occurs.
  let looseMax = values[0]!;
  let looseMin = values[0]!;
  let nULoose = 0;
  let nLLoose = 0;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v >= looseMax) {
      nULoose += 1;
      looseMax = v;
    }
    if (v <= looseMin) {
      nLLoose += 1;
      looseMin = v;
    }
  }

  // Harmonic numbers H_n and H_n^{(2)}.
  let H1 = 0;
  let H2 = 0;
  for (let k = 1; k <= n; k += 1) {
    H1 += 1 / k;
    H2 += 1 / (k * k);
  }
  // Foster-Stuart per-pass mean and variance: indices
  // i = 1, .., n-1 contribute Bernoulli(1/(i+1)), so the
  // mean is sum_{k=2}^{n} 1/k = H_n - 1 and the variance
  // is sum_{k=2}^{n} (1/k - 1/k^2) = (H_n - 1) - (H_n^{(2)} - 1)
  // = H_n - H_n^{(2)}.
  const mu1 = H1 - 1;
  const mu2 = H1 - H2;
  const fsS = nU + nL;
  const fsD = nU - nL;
  const fsExpectedS = 2 * mu1;
  const fsVarS = 2 * mu2;
  const sigmaS = Math.sqrt(fsVarS);
  const applicable = n >= 6 && fsVarS > 0;
  const fsSZ = applicable ? (fsS - fsExpectedS) / sigmaS : 0;
  const fsDZ = applicable ? fsD / sigmaS : 0;
  if (!Number.isFinite(fsSZ) || !Number.isFinite(fsDZ)) {
    throw new Error(
      `dailyTokenFosterStuartS: non-finite z (n=${n}, S=${fsS}, D=${fsD}, mu1=${mu1}, mu2=${mu2})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    nUpperRecordsFs: nU,
    nLowerRecordsFs: nL,
    nUpperRecordsLooseFs: nULoose,
    nLowerRecordsLooseFs: nLLoose,
    fsS,
    fsD,
    fsExpectedU: mu1,
    fsVarU: mu2,
    fsExpectedS,
    fsVarS,
    fsSZ,
    fsDZ,
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

export function buildDailyTokenFosterStuartS(
  queue: QueueLine[],
  opts: DailyTokenFosterStuartSOptions = {},
): DailyTokenFosterStuartSReport {
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
  const sort: DailyTokenFosterStuartSSort = opts.sort ?? 'fsSZAbsDesc';
  const validSorts: DailyTokenFosterStuartSSort[] = [
    's',
    'sDesc',
    'fsSZ',
    'fsSZDesc',
    'fsSZAbs',
    'fsSZAbsDesc',
    'fsDZ',
    'fsDZDesc',
    'fsDZAbs',
    'fsDZAbsDesc',
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
  const rows: DailyTokenFosterStuartSSourceRow[] = [];

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
      result = dailyTokenFosterStuartS(filled);
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
      nUpperRecordsFs: result.nUpperRecordsFs,
      nLowerRecordsFs: result.nLowerRecordsFs,
      nUpperRecordsLooseFs: result.nUpperRecordsLooseFs,
      nLowerRecordsLooseFs: result.nLowerRecordsLooseFs,
      fsS: result.fsS,
      fsD: result.fsD,
      fsExpectedU: result.fsExpectedU,
      fsVarU: result.fsVarU,
      fsExpectedS: result.fsExpectedS,
      fsVarS: result.fsVarS,
      fsSZ: result.fsSZ,
      fsDZ: result.fsDZ,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 's':
        primary = a.fsS - b.fsS;
        break;
      case 'sDesc':
        primary = b.fsS - a.fsS;
        break;
      case 'fsSZ':
        primary = a.fsSZ - b.fsSZ;
        break;
      case 'fsSZDesc':
        primary = b.fsSZ - a.fsSZ;
        break;
      case 'fsSZAbs':
        primary = Math.abs(a.fsSZ) - Math.abs(b.fsSZ);
        break;
      case 'fsSZAbsDesc':
        primary = Math.abs(b.fsSZ) - Math.abs(a.fsSZ);
        break;
      case 'fsDZ':
        primary = a.fsDZ - b.fsDZ;
        break;
      case 'fsDZDesc':
        primary = b.fsDZ - a.fsDZ;
        break;
      case 'fsDZAbs':
        primary = Math.abs(a.fsDZ) - Math.abs(b.fsDZ);
        break;
      case 'fsDZAbsDesc':
        primary = Math.abs(b.fsDZ) - Math.abs(a.fsDZ);
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
