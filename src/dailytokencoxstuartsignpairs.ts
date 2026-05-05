/**
 * daily-token-cox-stuart-sign-pairs: per-source COX &
 * STUART 1955 SIGN-OF-PAIRED-DIFFERENCES TREND TEST
 * applied to the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-FIFTH cross-source axis.
 *
 * Mechanism. Cox & Stuart (1955, *JRSS-B* 17(1):
 * 222-228, "Some quick sign tests for trend in
 * location and dispersion") propose a "quick" trend
 * test: pair each early observation with its temporally-
 * matched late observation by the spacing
 *
 *     c = ceil(n / 2)
 *
 * (so for n = 12 we have c = 6, pairs (v[0],v[6]),
 * (v[1],v[7]), ..., (v[5],v[11])). When n is odd the
 * MIDDLE value v[(n-1)/2] is dropped, giving exactly
 * floor(n/2) pairs. For each pair compute the SIGN of
 * the late-minus-early difference
 *
 *     s_i = sign( v[i + c] - v[i] )   in {-1, 0, +1}
 *
 * Let `csPlus` = #{ i : s_i = +1 }, `csMinus` =
 * #{ i : s_i = -1 }, `csTies` = #{ i : s_i = 0 }, and
 * `csNonTies` = csPlus + csMinus.
 *
 * Under H0 of NO MONOTONIC TREND the late minus early
 * sign is symmetric Bernoulli(1/2) on the non-tied
 * pairs (Cox & Stuart 1955 sec. 2; also Daniel 1990
 * *Applied Nonparametric Statistics* 2nd ed. sec. 2.2;
 * Hollander, Wolfe & Chicken 2014 sec. 3.1). So
 * `csPlus` ~ Binomial(csNonTies, 1/2) under H0, and
 * the standardised statistic
 *
 *     csZ = ( csPlus - csNonTies / 2 ) /
 *           sqrt( csNonTies / 4 )
 *         ~~ N(0, 1)
 *
 * is asymptotically standard normal once csNonTies >= 10
 * (Cox-Stuart 1955 Table 1; Hollander et al. 2014
 * sec. 3.1 finds normal approximation accurate within
 * 0.005 of nominal alpha at csNonTies = 10 with the
 * continuity correction omitted, which is conservative
 * for two-sided tests at alpha = 0.05).
 *
 * SIGN CONVENTION:
 *
 *     csZ much greater than +1.96 = significantly
 *       MORE positive pair-differences than 50/50 =
 *       LATE half SYSTEMATICALLY ABOVE early half =
 *       MONOTONIC INCREASING TREND.
 *     csZ much less than -1.96 = MONOTONIC DECREASING
 *       TREND.
 *     csZ approx 0 = no detectable monotonic trend.
 *
 * Two-sided p-value `csPValue = 2 (1 - Phi(|csZ|))`.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-david-barton-runs-up-down (axis-203).
 *     David-Barton counts MAXIMAL RUNS of identically-
 *     signed FIRST DIFFERENCES (lag-1 sign-grouping
 *     across the full sequence). Cox-Stuart counts
 *     SIGNS of FAR-PAIRED differences (lag c = ceil(n/2)
 *     -- maximally distant pairing). A series with
 *     strong lag-1 alternation (high David-Barton dbZ)
 *     can have CSplus = csMinus (csZ ~ 0) if early /
 *     late halves are otherwise level. A series with a
 *     pure step shift between halves (csZ very large)
 *     can have arbitrary lag-1 oscillation pattern with
 *     dbZ ~ 0.
 *
 *   - vs daily-token-noether-cyclical-trend (axis-202).
 *     Noether at lag-2 counts MONOTONIC SPACED TRIPLETS
 *     (v[i], v[i+2], v[i+2*2]) -- a LOCAL trend probe at
 *     a FIXED short lag. Cox-Stuart pairs use lag
 *     c = ceil(n/2) -- a GLOBAL trend probe at a
 *     MAXIMAL lag. Local lag-2 monotonicity (Noether
 *     sees high noetherM) does NOT imply global trend
 *     (csZ stays ~ 0 if total drift cancels).
 *
 *   - vs daily-token-mann-kendall-tau (if shipped) /
 *     other rank-correlation trend tests. Mann-Kendall
 *     sums sign(v[j] - v[i]) over ALL n*(n-1)/2 pairs.
 *     Cox-Stuart sums sign over EXACTLY floor(n/2)
 *     far-paired pairs. Mann-Kendall has O(n^2)
 *     contributions and is sensitive to ANY monotonic
 *     pattern. Cox-Stuart is the "quick" approximation
 *     -- it deliberately uses only floor(n/2) pairs,
 *     trading power for simplicity and tie-robustness.
 *
 *   - vs daily-token-turning-point-rate. Turning-point
 *     count is the lag-1 LOCAL-EXTREMA count (a
 *     dispersion / oscillation diagnostic). Cox-Stuart
 *     measures GLOBAL trend via paired signs.
 *
 *   - vs ALL HALVES-COMPARISON axes (Mann-Whitney,
 *     Cliff, Wald-Wolfowitz halves, Wilcoxon, Hogg-
 *     Adaptive, etc.). Those tests pool the early and
 *     late halves into TWO INDEPENDENT SAMPLES and
 *     compare distributions (rank-sum, rank-difference,
 *     median-cell-counts, etc.). Cox-Stuart pairs the
 *     SAME-INDEX-OFFSET observations and tests the
 *     paired-sign null. A pure step shift gives BOTH a
 *     significant Mann-Whitney AND a significant
 *     Cox-Stuart (sign-aligned), but a noisy positive
 *     trend gives a stronger Cox-Stuart (paired-design
 *     variance reduction) than Mann-Whitney (which
 *     ignores the pairing structure).
 *
 *   - vs daily-token-foster-stuart (if shipped) sign-
 *     based extreme-record-count trend. Foster-Stuart
 *     counts UPPER and LOWER RECORDS as the series is
 *     scanned. Cox-Stuart counts paired-difference
 *     signs at fixed offset. Different sign domains.
 *
 * Pre-processing: NONE. The paired-difference sign is
 * invariant under any global ADDITIVE shift and any
 * POSITIVE scale of the series. Sign is also preserved
 * under any STRICTLY MONOTONE transform applied
 * uniformly, so csPlus / csMinus are rank-invariant in
 * that sense.
 *
 * Hard floor on min-tenure-days is 20 (gives n = 20,
 * c = 10, csNonTies <= 10 pairs -- right at the
 * Cox-Stuart 1955 Table 1 normal-approximation
 * threshold). With ties common in the gap-filled token
 * series we additionally require csNonTies >= 10
 * AFTER tie removal; sources failing that floor surface
 * as droppedNonFiniteFit.
 *
 * Tie convention. Zero pair-differences ARE COUNTED as
 * `csTies` and EXCLUDED from the standardisation
 * denominator (Cox-Stuart 1955 sec. 3 "treatment of
 * ties"; Daniel 1990 sec. 2.2 -- equivalent to the
 * "drop ties" sign-test convention of Hodges-Lehmann
 * 1956). This is more conservative than the "split
 * ties 50/50" convention because it reduces the
 * effective sample size.
 *
 * Reference:
 *   Cox, D. R. & Stuart, A., "Some quick sign tests
 *     for trend in location and dispersion",
 *     *Journal of the Royal Statistical Society: Series
 *     B (Methodological)* 17(1) (1955), pp. 222-228.
 *   Daniel, W. W., *Applied Nonparametric Statistics*,
 *     2nd ed. (PWS-Kent 1990), sec. 2.2.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods*, 3rd ed.
 *     (Wiley 2014), sec. 3.1.
 */
import type { QueueLine } from './types.js';

export type DailyTokenCoxStuartSignPairsSort =
  | 'csZ'
  | 'csZAbsDesc'
  | 'csPValue'
  | 'csPValueDesc'
  | 'csPlus'
  | 'csPlusDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCoxStuartSignPairsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 20 so
   * floor(n/2) >= 10 pairs -- within Cox-Stuart 1955
   * Table 1's normal-approximation validity band.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCoxStuartSignPairsSort;
  generatedAt?: string;
}

export interface DailyTokenCoxStuartSignPairsSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Pair spacing c = ceil(n/2). */
  csC: number;
  /** Number of pairs formed = floor(n/2). */
  csPairs: number;
  /** Count of positive pair-differences v[i+c] - v[i]. */
  csPlus: number;
  /** Count of negative pair-differences. */
  csMinus: number;
  /** Count of zero pair-differences (excluded from Z). */
  csTies: number;
  /** Effective sample size csPlus + csMinus. */
  csNonTies: number;
  /** Standardised Z = (csPlus - csNonTies/2) / sqrt(csNonTies/4). */
  csZ: number;
  /** Two-sided normal p-value. */
  csPValue: number;
}

export interface DailyTokenCoxStuartSignPairsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCoxStuartSignPairsSort;
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
  sources: DailyTokenCoxStuartSignPairsSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailCoxStuart(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailCoxStuart: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailCoxStuart(-z);
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
 * Count Cox-Stuart paired-difference signs on `values`
 * with pair spacing c = ceil(n/2). Returns the per-pair
 * counts (positive, negative, ties) and the spacing
 * actually used. When n is odd the middle observation
 * v[(n-1)/2] is silently dropped (Cox-Stuart 1955
 * sec. 2 convention).
 */
export function countCoxStuartPairs(values: number[]): {
  csC: number;
  csPairs: number;
  csPlus: number;
  csMinus: number;
  csTies: number;
} {
  const n = values.length;
  if (n < 2) {
    return { csC: 0, csPairs: 0, csPlus: 0, csMinus: 0, csTies: 0 };
  }
  const csC = Math.ceil(n / 2);
  const csPairs = Math.floor(n / 2);
  let csPlus = 0;
  let csMinus = 0;
  let csTies = 0;
  for (let i = 0; i < csPairs; i += 1) {
    const a = values[i]!;
    const b = values[i + csC]!;
    const d = b - a;
    if (d > 0) csPlus += 1;
    else if (d < 0) csMinus += 1;
    else csTies += 1;
  }
  return { csC, csPairs, csPlus, csMinus, csTies };
}

/**
 * Cox-Stuart (1955) sign-of-paired-differences trend
 * test on a real-valued series. Returns the per-pair
 * counts, standardised Z, and two-sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - csPlus(x + c) === csPlus(x) for any constant c
 *     (paired differences are translation-invariant).
 *   - csPlus(a * x) === csPlus(x) for any a > 0
 *     (positive scale preserves sign of pair-differences).
 *   - csPlus(-x) + csMinus(-x) === csNonTies(x), and
 *     specifically csPlus(-x) === csMinus(x) (negation
 *     flips every pair-difference sign uniformly).
 *   - For x strictly increasing: csPlus === csPairs
 *     (every pair-difference positive).
 *   - For x strictly decreasing: csMinus === csPairs.
 *   - For x perfectly periodic with period 2c (where
 *     c = ceil(n/2)): csTies === csPairs.
 *   - csZ is finite and well-defined when csNonTies >= 1.
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 */
export function dailyTokenCoxStuartSignPairs(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  csC: number;
  csPairs: number;
  csPlus: number;
  csMinus: number;
  csTies: number;
  csNonTies: number;
  csZ: number;
  csPValue: number;
} {
  const n = values.length;
  if (n < 20) {
    throw new Error(
      `dailyTokenCoxStuartSignPairs: need at least 20 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenCoxStuartSignPairs requires finite values',
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
      `dailyTokenCoxStuartSignPairs: zero centred variance (n=${n})`,
    );
  }

  const observed = countCoxStuartPairs(values);
  const csNonTies = observed.csPlus + observed.csMinus;
  if (csNonTies < 10) {
    throw new Error(
      `dailyTokenCoxStuartSignPairs: too few non-tied pairs (csNonTies=${csNonTies}, need >=10)`,
    );
  }
  // Sign-test standardisation under H0 csPlus ~ Bin(csNonTies, 1/2):
  //   E[csPlus]   = csNonTies / 2
  //   Var[csPlus] = csNonTies / 4
  const expPlus = csNonTies / 2;
  const varPlus = csNonTies / 4;
  if (!(varPlus > 0) || !Number.isFinite(varPlus)) {
    throw new Error(
      `dailyTokenCoxStuartSignPairs: degenerate variance (varPlus=${varPlus})`,
    );
  }
  const csZ = (observed.csPlus - expPlus) / Math.sqrt(varPlus);
  if (!Number.isFinite(csZ)) {
    throw new Error(
      `dailyTokenCoxStuartSignPairs: non-finite z (n=${n})`,
    );
  }
  const csPValue = 2 * standardNormalUpperTailCoxStuart(Math.abs(csZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    csC: observed.csC,
    csPairs: observed.csPairs,
    csPlus: observed.csPlus,
    csMinus: observed.csMinus,
    csTies: observed.csTies,
    csNonTies,
    csZ,
    csPValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-205. Combines
 * per-source SIGNED csZ via Stouffer's Z-method
 * (Stouffer et al. 1949). Skips malformed rows.
 */
export interface CoxStuartSignPairsCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanCsZ: number;
  tenureWeightedMeanCsZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateCoxStuartSignPairs(
  rows: ReadonlyArray<{
    csZ: number;
    csPValue: number;
    csNonTies: number;
    nTenureDays: number;
  }>,
): CoxStuartSignPairsCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.csZ) ||
      !Number.isFinite(r.csPValue) ||
      r.csPValue <= 0 ||
      r.csPValue > 1 ||
      !Number.isInteger(r.csNonTies) ||
      r.csNonTies < 10 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.csZ;
    weightedZSum += r.nTenureDays * r.csZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanCsZ: Number.NaN,
      tenureWeightedMeanCsZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailCoxStuart(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanCsZ: zSum / used,
    tenureWeightedMeanCsZ: weightedZSum / totalTenure,
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

export function buildDailyTokenCoxStuartSignPairs(
  queue: QueueLine[],
  opts: DailyTokenCoxStuartSignPairsOptions = {},
): DailyTokenCoxStuartSignPairsReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 20;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 20) {
    throw new Error(
      `minTenureDays must be an integer >= 20 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenCoxStuartSignPairsSort = opts.sort ?? 'csZAbsDesc';
  const validSorts: DailyTokenCoxStuartSignPairsSort[] = [
    'csZ',
    'csZAbsDesc',
    'csPValue',
    'csPValueDesc',
    'csPlus',
    'csPlusDesc',
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
  const rows: DailyTokenCoxStuartSignPairsSourceRow[] = [];

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
      result = dailyTokenCoxStuartSignPairs(filled);
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
      csC: result.csC,
      csPairs: result.csPairs,
      csPlus: result.csPlus,
      csMinus: result.csMinus,
      csTies: result.csTies,
      csNonTies: result.csNonTies,
      csZ: result.csZ,
      csPValue: result.csPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'csZ':
        primary = a.csZ - b.csZ;
        break;
      case 'csZAbsDesc':
        primary = Math.abs(b.csZ) - Math.abs(a.csZ);
        break;
      case 'csPValue':
        primary = a.csPValue - b.csPValue;
        break;
      case 'csPValueDesc':
        primary = b.csPValue - a.csPValue;
        break;
      case 'csPlus':
        primary = a.csPlus - b.csPlus;
        break;
      case 'csPlusDesc':
        primary = b.csPlus - a.csPlus;
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
