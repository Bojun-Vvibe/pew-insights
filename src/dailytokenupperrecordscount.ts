/**
 * daily-token-upper-records-count: per-source NUMBER OF
 * STRICT UPPER RECORDS in the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Index i in {0, .., n-1} is a STRICT UPPER RECORD iff
 *
 *     x[i] > max(x[0..i-1])
 *
 * with the convention that index 0 is ALWAYS a record (the
 * empty-prefix max is defined as -infinity). The reported
 * statistic is the integer COUNT
 *
 *     R_n = |{ i in {0, .., n-1} : x[i] > max(x[0..i-1]) }|
 *
 * in {1, .., n}.
 *
 * Closed-form null distribution (Renyi 1962). For an iid
 * continuous sample, the indicator variables
 * I_i = 1[x[i] is a record] are MUTUALLY INDEPENDENT
 * Bernoulli(1/i) (i = 1, .., n with index 1 always a
 * record), and therefore
 *
 *     E[R_n]   = H_n   = sum_{k=1}^{n} 1/k       (n-th harmonic)
 *     Var[R_n] = H_n - H_n^{(2)}                 where
 *                H_n^{(2)} = sum_{k=1}^{n} 1/k^2
 *
 * (Renyi, "Theorie des elements saillants d'une suite
 * d'observations", Annales scientifiques de l'Universite de
 * Clermont-Ferrand 8, 1962, pp. 7-13; Glick, "Breaking
 * records and breaking boards", American Mathematical
 * Monthly 85 (1978), pp. 2-26, eq. 2.1-2.3; Arnold-
 * Balakrishnan-Nagaraja, "Records", Wiley 1998, ch. 2.) The
 * sum of independent Bernoulli(1/k) variables is
 * asymptotically normal by Lyapunov's CLT (the variance is
 * unbounded since H_n diverges like ln n + gamma), so the
 * standardised score
 *
 *     RZ = (R_n - H_n) / sqrt(H_n - H_n^{(2)})
 *
 * is approximately N(0, 1) for moderate n under the iid
 * continuous null. For n < 4 RZ is reported as 0 (the
 * variance H_n - H_n^{(2)} is small enough that the normal
 * approximation has no purchase).
 *
 * Tie regime. In the gap-filled regime sparse days are
 * zero-padded, so multiple indices may share the value 0.
 * The STRICT inequality x[i] > prevMax means a tied value
 * does NOT count as a new record -- a long stretch of zeros
 * after the first contributes nothing to R_n. This is the
 * Renyi convention and is the only convention under which
 * the closed-form null moments above hold exactly. We
 * surface the count of LOOSE (>=) records as a side-quantity
 * `nUpperRecordsLoose` for callers who want the alternative;
 * the reported headline `nUpperRecords` and `recordZ` are
 * always the strict variant.
 *
 * Reported alongside `nUpperRecords`: `nUpperRecordsLoose`
 * (>=) for comparison, the reference anchors
 * `recordExpectedIid = H_n` and `recordVarIid =
 * H_n - H_n^{(2)}`, the position of the LAST upper record
 * `lastRecordIndex` in {0, .., n-1}, the position of the
 * MAXIMUM-VALUE record (always one of the recorded indices)
 * and the standardised score `recordZ`.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS
 * IN 79-108:
 *
 *   - Class. RECORDS-COUNT is a CUMULATIVE-MAXIMUM
 *     CROSSING COUNT: it counts the number of times the
 *     running maximum strictly increases. It is a function
 *     of the RANK of x[i] within the prefix x[0..i] -- not
 *     of any pair, lag, or spectral feature. The sample
 *     space is partitioned into n! equiprobable
 *     permutations (under iid continuous), and R_n is a
 *     PERMUTATION STATISTIC whose distribution is exactly
 *     the convolution of independent Bernoulli(1/k). No
 *     other axis in 79-108 is a prefix-max-crossing count.
 *
 *   - vs axis-105 daily-token-zero-crossing-rate. ZCR is
 *     a SIGN-CHANGE rate of the demeaned LEVEL series; it
 *     is a forward-difference local statistic that depends
 *     only on consecutive pairs (x[i] - mean) and (x[i+1]
 *     - mean). R_n is a PREFIX-WIDE GLOBAL statistic: each
 *     index i compares to its entire prefix max, not to
 *     i-1. The two are functionally independent: a series
 *     can have arbitrary ZCR with the same R_n (e.g.
 *     monotone increasing has ZCR ~ 0 and R_n = n; a
 *     reverse-sorted series has very low ZCR and R_n = 1).
 *
 *   - vs axis-106 daily-token-turning-point-rate. TPR is
 *     the rate of sign-changes of the FIRST DIFFERENCE --
 *     a local-curvature symbol stream depending on three
 *     consecutive values. R_n depends on the full prefix
 *     history. A pure monotone increase has TPR = 0 and
 *     R_n = n; a strictly decreasing series has TPR = 0
 *     and R_n = 1. Same TPR class, opposite R_n extreme.
 *
 *   - vs axis-107 / 108 (Spearman / Kendall lag-1
 *     autocorrelation). Those are LAG-1 PAIR statistics;
 *     R_n is a NON-LAGGED prefix-comparison statistic. A
 *     strictly increasing series has tau = +1, rho = +1,
 *     AND R_n = n (the maximum), but a series that is
 *     "mostly non-decreasing with one big late spike" can
 *     have tau ~ 0 and still have R_n much larger than the
 *     iid expectation H_n. Records counts surface globally
 *     trending behaviour that lag-1 cannot.
 *
 *   - vs the runs-test / monotone-run-length / second-
 *     difference sign-runs axes. Those condition on
 *     consecutive sign blocks; R_n only counts the strict
 *     prefix-max crossings. A series with many short
 *     monotone runs but no new global maxima after index 0
 *     has high run statistics and R_n = 1.
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, Palma, Hoover, Bonferroni, Mehran, Pietra,
 *     Foster-Wolfson, Esteban-Ray, Wolfson, Zenga,
 *     Chakravarty, Kolm-Pollak, GE2/3/4/half/negone,
 *     S-Gini, Amato, FGT, Hill-tail, decile / quintile /
 *     percentile gap ratios, IQR/median, MAD/median,
 *     log-MAD, midspread, var-of-logs, z-score-extremes,
 *     L-skewness, medcouple, Bowley): every one of those
 *     is a PERMUTATION-INVARIANT functional of the
 *     empirical distribution. R_n depends on the TEMPORAL
 *     ORDER of the prefix. A reverse-sorted permutation of
 *     x has identical Gini, identical Atkinson, etc., but
 *     R_n = 1 instead of n.
 *
 *   - vs the spectral / PSD axes (axis-84 to axis-104).
 *     PSD axes map the WHOLE-tenure periodogram to a
 *     scalar; the periodogram is invariant to TIME-
 *     REVERSAL and discards phase. R_n is built from
 *     directional prefix scans and is NOT time-reversal
 *     symmetric (records under time reversal correspond
 *     to lower records of the original series, a different
 *     statistic).
 *
 *   - vs the entropy axes (sample, permutation,
 *     approximate, Renyi spectral, spectral entropy). Those
 *     are pattern-recurrence complexity measures on
 *     amplitude / spectral embeddings; R_n is an integer
 *     count of prefix-max-strict-improvement events, with
 *     a closed-form null mean and variance.
 *
 *   - vs the fractal-dimension / long-memory axes
 *     (Higuchi, Katz, Petrosian, Sevcik, box-count, DFA
 *     alpha, Hurst R/S). Those measure scaling exponents
 *     across multiple scales. R_n is a single integer
 *     count, not a scaling fit.
 *
 *   - vs Hjorth (mobility, complexity), Teager-Kaiser, LZ,
 *     curvature-sign-change-rate. Those are continuous-
 *     magnitude operators on the level or its differences.
 *     R_n is a counting statistic in {1, .., n} with a
 *     closed-form Bernoulli-convolution null.
 *
 * Headline question:
 * **"For each source, how many times during its gap-filled
 *   tenure did the daily token total strictly EXCEED EVERY
 *   prior day's total -- and is that number larger or
 *   smaller than the iid expected H_n new-records count?"**
 *
 * Reference:
 *   Renyi, A., "Theorie des elements saillants d'une suite
 *     d'observations" (Theory of order statistics), Annales
 *     scientifiques de l'Universite de Clermont-Ferrand
 *     8 (1962), pp. 7-13.
 *   Glick, N., "Breaking records and breaking boards",
 *     American Mathematical Monthly 85 (1978), pp. 2-26
 *     (eq. 2.1-2.3 give E[R_n] = H_n, Var[R_n] = H_n -
 *     H_n^{(2)}).
 *   Arnold, B. C., Balakrishnan, N. and Nagaraja, H. N.,
 *     "Records", Wiley 1998, ch. 2 (Bernoulli-convolution
 *     representation).
 *
 * Caveats:
 *
 *   - Index 0 is ALWAYS a record. R_n in {1, .., n}.
 *   - The variance H_n - H_n^{(2)} grows like ln n; for
 *     short tenures (n ~ 14-20) the discrete Bernoulli-
 *     convolution null is mildly skewed and the normal
 *     approximation `recordZ ~ N(0, 1)` is approximate.
 *   - Tie handling. STRICT records (>) match the Renyi
 *     1962 closed form exactly under iid continuous. In
 *     the zero-padded daily-token regime, ties at zero are
 *     common; we surface `nUpperRecordsLoose` (using >=)
 *     as a side metric but always headline the strict
 *     count.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-upper-records-count
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-upper-records-count \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (most non-iid
 *   # first):
 *   pew-insights daily-token-upper-records-count \
 *     --sort recordZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenUpperRecordsCountSort =
  | 'records'
  | 'recordsDesc'
  | 'recordZ'
  | 'recordZDesc'
  | 'recordZAbs'
  | 'recordZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenUpperRecordsCountOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the
   * H_n harmonic null variance has at least
   * H_4 - H_4^{(2)} ~ 1.04 of mass spread.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenUpperRecordsCountSort;
  generatedAt?: string;
}

export interface DailyTokenUpperRecordsCountSourceRow {
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
  /** STRICT (>) upper records count. Always >= 1. */
  nUpperRecords: number;
  /** LOOSE (>=) upper records count, side-quantity. Always >= 1. */
  nUpperRecordsLoose: number;
  /** Index in {0, .., n-1} of the LAST strict upper record. */
  lastRecordIndex: number;
  /** Index in {0, .., n-1} where the maximum value first occurs. */
  argmaxIndex: number;
  /** Maximum value of the gap-filled tenure series. */
  maxValue: number;
  /** Asymptotic E[R_n] under independence: H_n. */
  recordExpectedIid: number;
  /** Asymptotic Var[R_n] under independence: H_n - H_n^{(2)}. */
  recordVarIid: number;
  /** Standardised score (R_n - H_n) / sqrt(H_n - H_n^{(2)}). */
  recordZ: number;
}

export interface DailyTokenUpperRecordsCountReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenUpperRecordsCountSort;
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
  sources: DailyTokenUpperRecordsCountSourceRow[];
}

/**
 * Strict upper records primitive on a real-valued series.
 *
 * Closed-form sanity anchors:
 *   - strictly monotone increasing series x = (1, 2, .., n)
 *     -> every index is a new record -> R_n = n.
 *   - strictly monotone decreasing series x = (n, n-1, .., 1)
 *     -> only index 0 is a record -> R_n = 1.
 *   - constant series x = (c, c, .., c) -> only index 0 is
 *     a STRICT record -> R_n = 1; the LOOSE count = n.
 *   - i.i.d. continuous sample -> E[R_n] = H_n
 *     = sum_{k=1}^{n} 1/k (Renyi 1962).
 *
 * Throws when the series is too short or contains
 * non-finite entries.
 */
export function dailyTokenUpperRecordsCount(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nUpperRecords: number;
  nUpperRecordsLoose: number;
  lastRecordIndex: number;
  argmaxIndex: number;
  maxValue: number;
  recordExpectedIid: number;
  recordVarIid: number;
  recordZ: number;
} {
  const n = values.length;
  if (n < 3) {
    throw new Error(
      `dailyTokenUpperRecordsCount: need at least 3 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenUpperRecordsCount requires finite values');
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

  let prevMax = values[0]!;
  let nStrict = 1; // index 0 is always a record
  let lastIdx = 0;
  let argmax = 0;
  let maxVal = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v > prevMax) {
      nStrict += 1;
      lastIdx = i;
      prevMax = v;
    }
    if (v > maxVal) {
      maxVal = v;
      argmax = i;
    }
  }
  // Loose (>=) records: a separate single pass with its own
  // running max. We do not entangle this with the strict pass
  // because the running maxima differ once a tie at the
  // current strict max occurs (the loose pass does not advance
  // its max strictly above a tied value, but it still counts
  // the tie as a record).
  let looseMax = values[0]!;
  let nLoose = 1;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v >= looseMax) {
      nLoose += 1;
      looseMax = v;
    }
  }

  // Harmonic numbers H_n and H_n^{(2)}.
  let H1 = 0;
  let H2 = 0;
  for (let k = 1; k <= n; k += 1) {
    H1 += 1 / k;
    H2 += 1 / (k * k);
  }
  const recordVarIid = H1 - H2;
  const recordZ =
    n >= 4 && recordVarIid > 0
      ? (nStrict - H1) / Math.sqrt(recordVarIid)
      : 0;
  if (!Number.isFinite(recordZ)) {
    throw new Error(
      `dailyTokenUpperRecordsCount: non-finite recordZ (n=${n}, R=${nStrict}, H1=${H1}, var=${recordVarIid})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    nUpperRecords: nStrict,
    nUpperRecordsLoose: nLoose,
    lastRecordIndex: lastIdx,
    argmaxIndex: argmax,
    maxValue: maxVal,
    recordExpectedIid: H1,
    recordVarIid,
    recordZ,
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

export function buildDailyTokenUpperRecordsCount(
  queue: QueueLine[],
  opts: DailyTokenUpperRecordsCountOptions = {},
): DailyTokenUpperRecordsCountReport {
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
  const sort: DailyTokenUpperRecordsCountSort = opts.sort ?? 'recordZAbsDesc';
  const validSorts: DailyTokenUpperRecordsCountSort[] = [
    'records',
    'recordsDesc',
    'recordZ',
    'recordZDesc',
    'recordZAbs',
    'recordZAbsDesc',
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
  const rows: DailyTokenUpperRecordsCountSourceRow[] = [];

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
      result = dailyTokenUpperRecordsCount(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenUpperRecordsCountSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      nUpperRecords: result.nUpperRecords,
      nUpperRecordsLoose: result.nUpperRecordsLoose,
      lastRecordIndex: result.lastRecordIndex,
      argmaxIndex: result.argmaxIndex,
      maxValue: result.maxValue,
      recordExpectedIid: result.recordExpectedIid,
      recordVarIid: result.recordVarIid,
      recordZ: result.recordZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'records':
        primary = a.nUpperRecords - b.nUpperRecords;
        break;
      case 'recordsDesc':
        primary = b.nUpperRecords - a.nUpperRecords;
        break;
      case 'recordZ':
        primary = a.recordZ - b.recordZ;
        break;
      case 'recordZDesc':
        primary = b.recordZ - a.recordZ;
        break;
      case 'recordZAbs':
        primary = Math.abs(a.recordZ) - Math.abs(b.recordZ);
        break;
      case 'recordZAbsDesc':
        primary = Math.abs(b.recordZ) - Math.abs(a.recordZ);
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
