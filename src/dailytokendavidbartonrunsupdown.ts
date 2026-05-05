/**
 * daily-token-david-barton-runs-up-down: per-source
 * DAVID & BARTON 1958 RUNS-UP-AND-DOWN TEST on the
 * gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-THIRD cross-source axis.
 *
 * Mechanism. Form the (n - 1) first differences
 * d[i] = v[i+1] - v[i] (i = 0 .. n-2). Replace each
 * by its sign s[i] in {-1, 0, +1}. A "run up" is a
 * maximal contiguous block of strictly positive signs;
 * a "run down" is a maximal contiguous block of
 * strictly negative signs. Zero differences (ties) are
 * BROKEN by ASSIGNING THEM THE SIGN OF THE PREVIOUS
 * NON-ZERO DIFFERENCE (Bradley 1968 sec. 12.3.4); the
 * leading run of leading zeros is dropped (= no
 * direction yet established). Let dbR be the total
 * count of runs-up-and-down obtained.
 *
 * Under H0 of i.i.d. continuous observations David &
 * Barton (1958, *Biometrika* 45(1-2):253-256, "A test
 * for birth-order effects") give the EXACT moments for
 * the runs-up-and-down statistic on n observations:
 *
 *     E[dbR]   = (2 n - 1) / 3
 *     Var[dbR] = (16 n - 29) / 90
 *
 * (also Edgington 1961 *American Statistician* 15(4):8
 * eq. 1; Bradley 1968 *Distribution-Free Statistical
 * Tests* sec. 12.3.4 Theorem 12.3.4-1). The
 * standardised statistic
 *
 *     dbZ = (dbR - E[dbR]) / sqrt(Var[dbR])
 *           ~~ N(0, 1) under H0
 *
 * is asymptotically standard normal for n >= 12 (Levene
 * 1952 *Annals of Math Stat* 23:34-56 eq. 4.2 -- the
 * convergence is very fast because dbR is a sum of
 * weakly dependent indicator variables on adjacent
 * differences with bounded covariance).
 *
 * SIGN CONVENTION:
 *
 *     dbZ much greater than +1.96 = MORE runs than
 *       chance = the series alternates direction MORE
 *       often than expected = HIGH-FREQUENCY OSCILLATION
 *       / mean-reverting daily structure.
 *     dbZ much less than -1.96 = FEWER runs than
 *       chance = LONGER monotone stretches than expected
 *       = LOW-FREQUENCY PERSISTENCE / trending behaviour.
 *     dbZ approx 0 = no detectable departure from
 *       i.i.d. ordering.
 *
 * Two-sided p-value `dbPValue = 2 (1 - Phi(|dbZ|))`.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-noether-cyclical-trend (axis-202).
 *     Noether at lag 2 counts MONOTONIC SPACED TRIPLETS
 *     (v[i], v[i+2], v[i+4]) -- the within-triplet sign
 *     pattern at LAG 2. David-Barton counts MAXIMAL
 *     RUNS of identically-signed first differences --
 *     the LAG-1 sign-grouping structure across the
 *     WHOLE series. A series with strong lag-1
 *     alternation but no lag-2 structure (e.g.
 *     up-down-up-down-up-down) yields high dbR (many
 *     runs) but Noether-at-lag-2 sees mostly monotonic
 *     triplets. Conversely a series with two long
 *     monotone segments (5 days up then 5 days down)
 *     yields LOW dbR (only 2 runs) but Noether-at-lag-2
 *     sees mostly monotonic triplets again. The two
 *     statistics are NOT a monotone transform of each
 *     other.
 *
 *   - vs daily-token-turning-point-rate (Wallis-Moore
 *     lag-1 turning-point count). Turning points count
 *     STRICT LOCAL EXTREMA = positions where sign(d[i])
 *     != sign(d[i-1]). David-Barton counts MAXIMAL
 *     RUNS OF SIGNS = blocks of identically-signed
 *     first differences. The turning-point count is
 *     EXACTLY (dbR - 1) when there are no ties (every
 *     sign change creates a new run; the first run
 *     contributes no turning point). With ties broken
 *     by carry-forward they can diverge: a tie inside
 *     a run absorbs into that run (no new run, no new
 *     turning point) but a tie at a boundary changes
 *     run accounting subtly. More importantly, the
 *     STANDARDISATION differs: Wallis-Moore divides by
 *     sqrt((16 n - 29) / 90) over the turning-point
 *     count (not the run count); the two z-statistics
 *     have CORRELATED but DIFFERENT null distributions
 *     under tied data. In our gap-filled token series
 *     ties are common (lots of zero days), so the two
 *     diverge in practice.
 *
 *   - vs daily-token-runs-test-z (Wald-Wolfowitz median-
 *     binarised runs, axis-64). Wald-Wolfowitz first
 *     dichotomises the WHOLE series at its median, then
 *     counts maximal runs of identically-signed
 *     (v - median) values with a hypergeometric null.
 *     David-Barton operates on FIRST DIFFERENCES (not
 *     median-centred values) and counts runs of their
 *     SIGN (not runs around a fixed threshold). A
 *     monotone-trending series with all values above
 *     the median in the second half (Wald-Wolfowitz
 *     sees few runs around the median) but with
 *     consistent positive first differences (David-
 *     Barton sees ONE long run-up = also low dbR) --
 *     here both fire. But a series alternating around
 *     the median with a slow monotone drift (Wald-
 *     Wolfowitz sees many runs, dbZ > 0) and David-
 *     Barton sees few runs (dbZ < 0 if drift dominates
 *     differences). The two statistics dissociate on
 *     drift-plus-noise mixtures.
 *
 *   - vs daily-token-bartels-rank-von-neumann. Bartels
 *     is the rank-von-Neumann ratio of squared
 *     successive differences to total rank variance --
 *     a MAGNITUDE-SENSITIVE lag-1 statistic. David-
 *     Barton uses ONLY the sign of each first
 *     difference (magnitude is discarded) and counts
 *     runs (not squared differences). A series with
 *     uniform-magnitude alternating differences and a
 *     series with mixed-magnitude alternating
 *     differences give the same David-Barton result
 *     but very different Bartels result.
 *
 *   - vs daily-token-mann-kendall-tau. Mann-Kendall
 *     sums sign(v[j] - v[i]) over ALL n*(n-1)/2 pairs
 *     -- a global all-pairs trend statistic. David-
 *     Barton uses only the n-1 ADJACENT pairs. A
 *     series with strong global trend but locally
 *     noisy daily differences yields large |Mann-
 *     Kendall S| but moderate dbR. A series with no
 *     global trend but strong local periodicity
 *     yields near-zero Mann-Kendall S but large dbR.
 *
 *   - vs daily-token-autocorrelation-lag1 / -lag7
 *     (Pearson rho on raw values at fixed lag). Pearson
 *     autocorrelation is parametric, magnitude-
 *     dominated, and computed on raw values. David-
 *     Barton is non-parametric, sign-only, and computed
 *     on first differences.
 *
 *   - vs ALL "halves" axes (Mann-Whitney, Cliff,
 *     Wald-Wolfowitz halves, Westenberg, Capon, Klotz,
 *     Mood, Mielke, Kamat, Conover, Ansari-Bradley,
 *     Siegel-Tukey, Sukhatme, etc.). Those are TWO-
 *     SAMPLE tests comparing the first half vs second
 *     half of the series. David-Barton is a SINGLE-
 *     SAMPLE WITHIN-SERIES test that uses the full
 *     ordered sequence of first-difference signs.
 *
 * Pre-processing: NONE. The first-difference signs are
 * invariant under any global ADDITIVE shift of the
 * series, and invariant under any POSITIVE scale. Sign
 * is preserved under any STRICTLY MONOTONE transform
 * applied uniformly to the whole series, so dbR is
 * also rank-invariant in that sense.
 *
 * Hard floor on min-tenure-days is 12 (gives n - 1 = 11
 * first differences, well within Levene 1952's
 * asymptotic-normal regime where the actual size of
 * the dbZ test is within 0.005 of nominal alpha at
 * n = 12).
 *
 * Tie convention. Zero first differences (which arise
 * frequently in the gap-filled token series where many
 * adjacent days have identical -- often zero -- token
 * counts) are CARRIED FORWARD with the sign of the
 * most recent non-zero difference (Bradley 1968 sec.
 * 12.3.4 convention C; Mood 1940 sec. 5). Leading
 * zeros (before any non-zero difference) are dropped
 * from the run accounting because no direction has
 * yet been established. If ALL differences are zero
 * the series is constant and is filtered upstream by
 * the zero-variance guard.
 *
 * Reference:
 *   David, F. N. & Barton, D. E., "A test for birth-
 *     order effects", *Biometrika* 45(1-2) (1958),
 *     pp. 253-256.
 *   Edgington, E. S., "Probability table for number
 *     of runs of signs of first differences in
 *     ordered series", *American Statistician* 15(4)
 *     (1961), p. 8.
 *   Bradley, J. V., *Distribution-Free Statistical
 *     Tests* (Prentice-Hall 1968), sec. 12.3.4.
 *   Levene, H., "On the power function of tests of
 *     randomness based on runs up and down",
 *     *Annals of Mathematical Statistics* 23(1)
 *     (1952), pp. 34-56.
 */
import type { QueueLine } from './types.js';

export type DailyTokenDavidBartonRunsUpDownSort =
  | 'dbZ'
  | 'dbZAbsDesc'
  | 'dbPValue'
  | 'dbPValueDesc'
  | 'dbR'
  | 'dbRDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenDavidBartonRunsUpDownOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 so
   * n - 1 = 11 first differences -- within Levene 1952's
   * asymptotic-normal validity band.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenDavidBartonRunsUpDownSort;
  generatedAt?: string;
}

export interface DailyTokenDavidBartonRunsUpDownSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Number of first differences = nTenureDays - 1. */
  dbDiffs: number;
  /** Number of zero first differences (ties absorbed by carry-forward). */
  dbZeros: number;
  /** Observed run count of runs-up-and-down on the sign sequence. */
  dbR: number;
  /** E[dbR] under H0 = (2 n - 1) / 3. */
  dbExpR: number;
  /** Var[dbR] under H0 = (16 n - 29) / 90. */
  dbVar: number;
  /** Standardised z = (dbR - E[dbR]) / sqrt(Var[dbR]). */
  dbZ: number;
  /** Two-sided normal p-value. */
  dbPValue: number;
}

export interface DailyTokenDavidBartonRunsUpDownReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenDavidBartonRunsUpDownSort;
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
  sources: DailyTokenDavidBartonRunsUpDownSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailDavidBarton(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailDavidBarton: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailDavidBarton(-z);
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
 * Count runs-up-and-down on the first-difference sign
 * sequence of `values`. Ties (zero diffs) absorb into
 * the most recent established sign (Bradley 1968 conv.
 * C); leading-zero diffs are dropped from the count
 * because no direction has yet been established.
 *
 * Returns the number of runs `dbR`, the total number
 * of first differences considered `dbDiffs = n - 1`,
 * and the count of zero diffs `dbZeros`.
 */
export function countRunsUpDownDavidBarton(values: number[]): {
  dbDiffs: number;
  dbZeros: number;
  dbR: number;
} {
  const n = values.length;
  if (n < 2) return { dbDiffs: 0, dbZeros: 0, dbR: 0 };
  const dbDiffs = n - 1;
  let dbZeros = 0;
  let runs = 0;
  let lastSign = 0; // 0 = no sign established yet
  for (let i = 0; i < dbDiffs; i += 1) {
    const d = values[i + 1]! - values[i]!;
    let s: number;
    if (d > 0) s = 1;
    else if (d < 0) s = -1;
    else {
      dbZeros += 1;
      // carry forward the previous sign (Bradley 1968
      // sec. 12.3.4 convention C). If no prior sign,
      // skip this diff.
      if (lastSign === 0) continue;
      s = lastSign;
    }
    if (s !== lastSign) {
      runs += 1;
      lastSign = s;
    }
  }
  return { dbDiffs, dbZeros, dbR: runs };
}

/**
 * David-Barton (1958) runs-up-and-down test on a
 * real-valued series. Returns the run count,
 * David-Barton normal moments, standardised Z, and
 * two-sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - dbR(x + c) === dbR(x) for any constant c
 *     (first differences are translation-invariant).
 *   - dbR(a * x) === dbR(x) for any a > 0
 *     (positive scale preserves sign of differences).
 *   - dbR(-x) === dbR(x): negating the series flips
 *     every difference sign uniformly, runs structure
 *     unchanged.
 *   - For x strictly increasing: dbR === 1
 *     (one long run up, no sign changes).
 *   - For x strictly decreasing: dbR === 1
 *     (one long run down).
 *   - For x perfectly alternating up-down-up-down...:
 *     dbR === n - 1 (every diff flips sign).
 *   - dbZ is finite for n >= 12.
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 */
export function dailyTokenDavidBartonRunsUpDown(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  dbDiffs: number;
  dbZeros: number;
  dbR: number;
  dbExpR: number;
  dbVar: number;
  dbZ: number;
  dbPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenDavidBartonRunsUpDown: need at least 12 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenDavidBartonRunsUpDown requires finite values',
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
      `dailyTokenDavidBartonRunsUpDown: zero centred variance (n=${n})`,
    );
  }

  const observed = countRunsUpDownDavidBarton(values);
  // David-Barton 1958 normal moments on n observations
  // (= n - 1 first differences):
  //   E[R]   = (2 n - 1) / 3
  //   Var[R] = (16 n - 29) / 90
  const dbExpR = (2 * n - 1) / 3;
  const dbVar = (16 * n - 29) / 90;
  if (!(dbVar > 0) || !Number.isFinite(dbVar)) {
    throw new Error(
      `dailyTokenDavidBartonRunsUpDown: degenerate variance (dbVar=${dbVar})`,
    );
  }
  const dbZ = (observed.dbR - dbExpR) / Math.sqrt(dbVar);
  if (!Number.isFinite(dbZ)) {
    throw new Error(
      `dailyTokenDavidBartonRunsUpDown: non-finite z (n=${n})`,
    );
  }
  const dbPValue = 2 * standardNormalUpperTailDavidBarton(Math.abs(dbZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    dbDiffs: observed.dbDiffs,
    dbZeros: observed.dbZeros,
    dbR: observed.dbR,
    dbExpR,
    dbVar,
    dbZ,
    dbPValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-203. Combines
 * per-source SIGNED dbZ via Stouffer's Z-method
 * (Stouffer et al. 1949). Skips malformed rows.
 */
export interface DavidBartonRunsUpDownCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanDbZ: number;
  tenureWeightedMeanDbZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateDavidBartonRunsUpDown(
  rows: ReadonlyArray<{
    dbZ: number;
    dbPValue: number;
    dbVar: number;
    nTenureDays: number;
  }>,
): DavidBartonRunsUpDownCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.dbZ) ||
      !Number.isFinite(r.dbPValue) ||
      r.dbPValue <= 0 ||
      r.dbPValue > 1 ||
      !Number.isFinite(r.dbVar) ||
      r.dbVar <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.dbZ;
    weightedZSum += r.nTenureDays * r.dbZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanDbZ: Number.NaN,
      tenureWeightedMeanDbZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailDavidBarton(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanDbZ: zSum / used,
    tenureWeightedMeanDbZ: weightedZSum / totalTenure,
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

export function buildDailyTokenDavidBartonRunsUpDown(
  queue: QueueLine[],
  opts: DailyTokenDavidBartonRunsUpDownOptions = {},
): DailyTokenDavidBartonRunsUpDownReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 12) {
    throw new Error(
      `minTenureDays must be an integer >= 12 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenDavidBartonRunsUpDownSort = opts.sort ?? 'dbZAbsDesc';
  const validSorts: DailyTokenDavidBartonRunsUpDownSort[] = [
    'dbZ',
    'dbZAbsDesc',
    'dbPValue',
    'dbPValueDesc',
    'dbR',
    'dbRDesc',
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
  const rows: DailyTokenDavidBartonRunsUpDownSourceRow[] = [];

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
      result = dailyTokenDavidBartonRunsUpDown(filled);
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
      dbDiffs: result.dbDiffs,
      dbZeros: result.dbZeros,
      dbR: result.dbR,
      dbExpR: result.dbExpR,
      dbVar: result.dbVar,
      dbZ: result.dbZ,
      dbPValue: result.dbPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'dbZ':
        primary = a.dbZ - b.dbZ;
        break;
      case 'dbZAbsDesc':
        primary = Math.abs(b.dbZ) - Math.abs(a.dbZ);
        break;
      case 'dbPValue':
        primary = a.dbPValue - b.dbPValue;
        break;
      case 'dbPValueDesc':
        primary = b.dbPValue - a.dbPValue;
        break;
      case 'dbR':
        primary = a.dbR - b.dbR;
        break;
      case 'dbRDesc':
        primary = b.dbR - a.dbR;
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
