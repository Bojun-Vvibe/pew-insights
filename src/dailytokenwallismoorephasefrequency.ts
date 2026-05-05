/**
 * daily-token-wallis-moore-phase-frequency: per-source
 * WALLIS-MOORE 1941 PHASE-FREQUENCY TEST FOR RANDOMNESS
 * applied to the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-NINTH cross-source axis.
 *
 * Mechanism. Wallis & Moore (1941 *Biometrika* 32:
 * 148-159) introduce the PHASE-FREQUENCY TEST. Given a
 * series x[1], ..., x[n] of distinct values, the
 * sequence of first differences has signs in {+, -}.
 * A PHASE is a maximal monotone run of consecutive
 * differences with the same sign -- equivalently, the
 * maximal stretches of monotone increase or decrease
 * between two TURNING POINTS. The COMPLETE phases are
 * those bounded on BOTH sides by turning points (the
 * first and last phases are typically incomplete since
 * they begin or end at the series boundary, not at a
 * turning point).
 *
 * Let h be the number of COMPLETE phases. Wallis-Moore
 * 1941 give the closed-form moments under the random-
 * permutation null (all n! orderings equally likely):
 *
 *     E[h]   = (2 n - 7) / 3
 *     Var[h] = (16 n - 29) / 90    (n >= 5)
 *
 * For n >= 12 the standardised statistic
 *
 *     wmZ = (h - E[h]) / sqrt(Var[h])
 *
 * is approximately standard-normal, and the two-sided
 * p-value is
 *
 *     wmPValue = 2 * (1 - Phi(|wmZ|))
 *
 * where Phi is the standard-normal CDF. This is the
 * NORMAL-APPROXIMATION FORM used in Wallis-Moore 1941
 * Table I and reproduced in Kendall & Stuart (1976
 * *Adv. Theory of Statistics* vol. 3 sec. 45.10).
 *
 * SIGN CONVENTION:
 *
 *   - wmZ << -1.96: TOO FEW phases = the series has
 *     LONGER monotone stretches than expected by chance
 *     = SMOOTH / TRENDING / POSITIVELY-CORRELATED
 *     dynamics. Either a global monotone trend or
 *     strong positive serial correlation reduces phase
 *     count.
 *   - wmZ >> +1.96: TOO MANY phases = the series
 *     OSCILLATES more than expected = ANTI-CORRELATED
 *     / ZIGZAG / NEGATIVELY-AUTOCORRELATED dynamics.
 *     The maximum is approximately 2(n-2)/3 phases for
 *     a perfect zigzag.
 *   - wmZ ~ 0: the phase count is consistent with iid
 *     random ordering.
 *
 * TIE HANDLING. Wallis-Moore assumes no ties; with ties
 * the sign of the difference x[i+1] - x[i] is not
 * defined for tied pairs. We adopt the standard
 * convention used in the runs-up-down literature
 * (Bradley 1968 sec. 13.2, Gibbons-Chakraborti 2003
 * sec. 3.4): TIED PAIRS ARE SKIPPED -- the run/phase
 * identifying scan only considers strictly monotone
 * differences. If after skipping ties fewer than n-1
 * non-zero differences remain, the test loses power;
 * we still report the statistic but flag the effective
 * non-tied length nNonTied for transparency.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-noether-turning-points-lag-2 (and
 *     david-barton runs-up-down). Turning-points counts
 *     LAG-2 SIGN REVERSALS -- the number of indices i
 *     in 2..n-1 with sign(x[i] - x[i-1]) !=
 *     sign(x[i+1] - x[i]). Phases are MAXIMAL MONOTONE
 *     STRETCHES between turning points. While there is
 *     a deterministic relation under no ties (h_complete
 *     = TP_count - 1 when the first/last segments are
 *     incomplete, h_complete = TP_count + 1 when both
 *     are complete), the SUFFICIENT STATISTIC and
 *     EXPECTED VALUE FORMULAS DIFFER -- E[TP] = 2(n-2)/3
 *     and Var[TP] = (16n - 29)/90 for TPs versus
 *     E[h] = (2n-7)/3 and Var[h] = (16n - 29)/90 for
 *     phases. The variance formulas COINCIDE
 *     (combinatorial coincidence; Kendall-Stuart 1976
 *     45.10) but the means differ by 5/3, so the
 *     STANDARDISED Z statistics are translates of each
 *     other only when the relation h = TP - 1 holds
 *     EXACTLY -- but in finite samples with ties or
 *     boundary phases the two diverge. Empirically wmZ
 *     and noetherZ agree on direction but differ in
 *     magnitude in the tail when the first/last phases
 *     are long.
 *
 *   - vs axis-201 lag-1 up-down runs (Levene 1952). The
 *     1952 Levene RUNS-UP-DOWN test counts the TOTAL
 *     NUMBER OF RUNS (each run is a maximal stretch of
 *     consecutive +1 or -1 sign-of-difference values).
 *     A "run" in Levene's sense is the SAME OBJECT as a
 *     "phase" in Wallis-Moore -- but Levene includes
 *     the FIRST and LAST possibly-incomplete phases in
 *     the count, and uses E[R] = (2n-1)/3 and
 *     Var[R] = (16n-29)/90 (the SAME variance,
 *     different mean, with a 4/3 shift). Wallis-Moore
 *     focuses on COMPLETE phases only.
 *
 *   - vs axis-202 lag-c pair-signs / axis-203
 *     david-barton noether sign-run-vs-spaced-triplet.
 *     Those test SIGN STRUCTURE at fixed lag c or in
 *     spaced triplets, NOT contiguous phase length.
 *
 *   - vs axis-205 Cox-Stuart sign-pairs. Cox-Stuart
 *     pairs v[i] with v[i + ceil(n/2)] -- a GLOBAL
 *     first-vs-second-half comparison. Wallis-Moore is
 *     LOCAL contiguous-phase counting.
 *
 *   - vs axis-206 Jonckheere-Terpstra. JT tests the
 *     ORDERED ALTERNATIVE across k=4 BLOCKS via SUMS OF
 *     PAIRWISE U-COUNTS. Wallis-Moore is unblocked,
 *     contiguous-phase counting.
 *
 *   - vs axis-207 Pitman MSSD. Pitman MSSD uses
 *     SQUARED first-differences (an L2-magnitude
 *     statistic on differences); Wallis-Moore uses the
 *     SIGN PATTERN of differences (an L0-counting
 *     statistic). A series with constant-magnitude
 *     zigzag gives Pitman ppZ ~ -large (smoothness in
 *     squared diffs is low because zigzag has high
 *     squared diffs) and wmZ >> 0 (many phases) --
 *     SAME DIRECTION but different mechanisms. A
 *     monotone trend with iid noise gives Pitman ppZ
 *     near 0 and wmZ < 0 (trend reduces phases) --
 *     DIFFERENT directions.
 *
 *   - vs axis-208 Spearman footrule. Footrule is a
 *     GLOBAL L1 distance from rank-identity (a STATIC
 *     rank-vs-time alignment); Wallis-Moore is a LOCAL
 *     CONTIGUOUS phase-segmentation count (a DYNAMIC
 *     differencing-based statistic). A series that is
 *     locally smooth (long phases) but with a perfectly
 *     rank-shuffled relation to time gives wmZ << 0
 *     (few phases) but sfZ ~ 0 (footrule sees the rank
 *     shuffle); a series whose ranks happen to match
 *     time identity but with high-frequency phase
 *     noise gives sfZ << 0 (perfect monotone trend in
 *     ranks) but wmZ ~ 0 (phases follow the noise).
 *
 * Pre-processing: NONE. Statistic depends only on the
 * SIGN PATTERN of consecutive differences -- shift- and
 * scale-invariant, robust to any monotone reparam-
 * eterisation that preserves the order of the series.
 *
 * Refs:
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series analyses", *Journal of the
 *     American Statistical Association* 36 (1941),
 *     pp. 401-409. (Phase-frequency moments.)
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series", *Biometrika* 32 (1941),
 *     pp. 148-159.
 *   Bradley, J. V., *Distribution-Free Statistical
 *     Tests*, Prentice-Hall (1968), sec. 13.2.
 *   Kendall, M. G. & Stuart, A., *The Advanced Theory
 *     of Statistics, vol. 3: Design and Analysis, and
 *     Time-Series*, Griffin (1976), sec. 45.10.
 *   Gibbons, J. D. & Chakraborti, S., *Nonparametric
 *     Statistical Inference*, 4th ed., Marcel Dekker
 *     (2003), sec. 3.4.
 */
import type { QueueLine } from './types.js';

export type DailyTokenWallisMoorePhaseFrequencySort =
  | 'wmZ'
  | 'wmZAbsDesc'
  | 'wmPValue'
  | 'wmPValueDesc'
  | 'wmH'
  | 'wmHDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenWallisMoorePhaseFrequencyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep the Wallis-Moore normal approximation
   * reasonable (Bradley 1968 sec. 13.2 recommends
   * n >= 12 for the moments-based normal approx).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenWallisMoorePhaseFrequencySort;
  generatedAt?: string;
}

export interface DailyTokenWallisMoorePhaseFrequencySourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled daily series. */
  mean: number;
  /** Sample stddev of the gap-filled daily series. */
  stddev: number;
  /** Number of non-tied consecutive differences used. */
  nNonTied: number;
  /** Observed number of complete phases h. */
  wmH: number;
  /** Closed-form expectation E[h] = (2n - 7) / 3. */
  wmHExpected: number;
  /** Closed-form variance Var[h] = (16n - 29) / 90. */
  wmHVariance: number;
  /** Standardised Z = (h - E[h]) / sqrt(Var[h]). */
  wmZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|wmZ|)). */
  wmPValue: number;
}

export interface DailyTokenWallisMoorePhaseFrequencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWallisMoorePhaseFrequencySort;
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
  sources: DailyTokenWallisMoorePhaseFrequencySourceRow[];
}

/**
 * Compute the SIGN of consecutive differences with ties
 * skipped: returns the sign sequence
 * sign(values[i+1] - values[i]) for i = 0..n-2,
 * dropping zeros.
 */
export function wallisMoorePhaseSigns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const d = values[i]! - values[i - 1]!;
    if (d > 0) out.push(1);
    else if (d < 0) out.push(-1);
    // ties: skip
  }
  return out;
}

/**
 * Count the number of COMPLETE phases in the sign
 * sequence. A phase is a maximal run of consecutive
 * equal signs in the sign-of-difference vector. The
 * first and last runs are INCOMPLETE (they begin/end
 * at the series boundary, not a turning point) and are
 * EXCLUDED. Returns max(0, totalRuns - 2).
 *
 * Edge cases:
 *   - empty sign vector       -> 0
 *   - single-run sign vector  -> 0 complete phases
 *   - two-run sign vector     -> 0 complete phases
 *     (both runs are incomplete -- the only TP is
 *     between them)
 *   - k-run sign vector (k>=3) -> k - 2 complete phases
 */
export function wallisMoorePhaseCount(signs: number[]): number {
  if (signs.length === 0) return 0;
  let runs = 1;
  for (let i = 1; i < signs.length; i += 1) {
    if (signs[i] !== signs[i - 1]) runs += 1;
  }
  return Math.max(0, runs - 2);
}

/**
 * Closed-form expectation of h under the uniform-random
 * permutation null: E[h] = (2 n - 7) / 3 (Wallis-Moore
 * 1941 JASA eq. 4 / Bradley 1968 sec. 13.2).
 */
export function wallisMooreExpectedH(n: number): number {
  if (!Number.isInteger(n) || n < 5) {
    throw new Error(
      `wallisMooreExpectedH: n must be integer >= 5 (got ${n})`,
    );
  }
  return (2 * n - 7) / 3;
}

/**
 * Closed-form variance of h under the uniform-random
 * permutation null: Var[h] = (16 n - 29) / 90 (Wallis-
 * Moore 1941 JASA eq. 5 / Bradley 1968 sec. 13.2).
 */
export function wallisMooreVarianceH(n: number): number {
  if (!Number.isInteger(n) || n < 5) {
    throw new Error(
      `wallisMooreVarianceH: n must be integer >= 5 (got ${n})`,
    );
  }
  return (16 * n - 29) / 90;
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailWallisMoorePhaseFrequency(
  z: number,
): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailWallisMoorePhaseFrequency: z must be finite (got ${z})`,
    );
  }
  if (z < 0)
    return 1 - standardNormalUpperTailWallisMoorePhaseFrequency(-z);
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

export function dailyTokenWallisMoorePhaseFrequency(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nNonTied: number;
  wmH: number;
  wmHExpected: number;
  wmHVariance: number;
  wmZ: number;
  wmPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenWallisMoorePhaseFrequency: need at least 12 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenWallisMoorePhaseFrequency requires finite values',
      );
    }
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let ss = 0;
  for (const v of values) {
    const c = v - mu;
    ss += c * c;
  }
  if (ss === 0) {
    throw new Error(
      `dailyTokenWallisMoorePhaseFrequency: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const signs = wallisMoorePhaseSigns(values);
  const nNonTied = signs.length;
  const wmH = wallisMoorePhaseCount(signs);
  const wmHExpected = wallisMooreExpectedH(n);
  const wmHVariance = wallisMooreVarianceH(n);
  if (!(wmHVariance > 0) || !Number.isFinite(wmHVariance)) {
    throw new Error(
      `dailyTokenWallisMoorePhaseFrequency: non-positive variance (n=${n})`,
    );
  }
  const wmZ = (wmH - wmHExpected) / Math.sqrt(wmHVariance);
  if (!Number.isFinite(wmZ)) {
    throw new Error(
      `dailyTokenWallisMoorePhaseFrequency: non-finite z (n=${n})`,
    );
  }
  const wmPValue =
    2 *
    standardNormalUpperTailWallisMoorePhaseFrequency(Math.abs(wmZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nNonTied,
    wmH,
    wmHExpected,
    wmHVariance,
    wmZ,
    wmPValue: Math.min(1, Math.max(0, wmPValue)),
  };
}

export interface WallisMoorePhaseFrequencyCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanWmZ: number;
  tenureWeightedMeanWmZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED wmZ values via Stouffer's (1949) Z-method.
 * Skips rows with non-finite wmZ, malformed wmPValue,
 * or tenure below the floor.
 */
export function aggregateWallisMoorePhaseFrequency(
  rows: ReadonlyArray<{
    wmZ: number;
    wmPValue: number;
    nTenureDays: number;
  }>,
): WallisMoorePhaseFrequencyCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.wmZ) ||
      !Number.isFinite(r.wmPValue) ||
      r.wmPValue < 0 ||
      r.wmPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.wmZ;
    weightedZSum += r.nTenureDays * r.wmZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanWmZ: Number.NaN,
      tenureWeightedMeanWmZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 *
    standardNormalUpperTailWallisMoorePhaseFrequency(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanWmZ: zSum / used,
    tenureWeightedMeanWmZ: weightedZSum / totalTenure,
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

export function buildDailyTokenWallisMoorePhaseFrequency(
  queue: QueueLine[],
  opts: DailyTokenWallisMoorePhaseFrequencyOptions = {},
): DailyTokenWallisMoorePhaseFrequencyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 12;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 12) {
    throw new Error(
      `minTenureDays must be an integer >= 12 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenWallisMoorePhaseFrequencySort =
    opts.sort ?? 'wmZAbsDesc';
  const validSorts: DailyTokenWallisMoorePhaseFrequencySort[] = [
    'wmZ',
    'wmZAbsDesc',
    'wmPValue',
    'wmPValueDesc',
    'wmH',
    'wmHDesc',
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
  const rows: DailyTokenWallisMoorePhaseFrequencySourceRow[] = [];

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
      result = dailyTokenWallisMoorePhaseFrequency(filled);
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
      nNonTied: result.nNonTied,
      wmH: result.wmH,
      wmHExpected: result.wmHExpected,
      wmHVariance: result.wmHVariance,
      wmZ: result.wmZ,
      wmPValue: result.wmPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'wmZ':
        primary = a.wmZ - b.wmZ;
        break;
      case 'wmZAbsDesc':
        primary = Math.abs(b.wmZ) - Math.abs(a.wmZ);
        break;
      case 'wmPValue':
        primary = a.wmPValue - b.wmPValue;
        break;
      case 'wmPValueDesc':
        primary = b.wmPValue - a.wmPValue;
        break;
      case 'wmH':
        primary = a.wmH - b.wmH;
        break;
      case 'wmHDesc':
        primary = b.wmH - a.wmH;
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
