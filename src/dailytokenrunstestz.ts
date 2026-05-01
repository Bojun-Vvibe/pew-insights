/**
 * daily-token-runs-test-z: per-source Wald-Wolfowitz RUNS-TEST
 * Z-STATISTIC on the binary above/below-median sequence of the
 * per-day total_tokens vector, taken in CALENDAR ORDER.
 *
 * SIXTY-FOURTH cross-source axis.
 *
 * For each source we collapse hourly buckets into a per-day total
 * D = (D_1, D_2, ..., D_n) under UTC day keys, and take the global
 * median m = P50(D) (linear interpolation, R type 7 -- same as MADM).
 *
 * Define a binary sequence s_i in {+,-}:
 *
 *     s_i = '+' if D_i  > m
 *     s_i = '-' if D_i  < m
 *     s_i is DROPPED if D_i == m
 *
 * Let n_+ and n_- be the counts after dropping ties, n = n_+ + n_-.
 * Let R be the number of MAXIMAL RUNS of identical symbols in
 * (s_1, ..., s_n). The Wald-Wolfowitz null (i.i.d. symmetric)
 * predicts:
 *
 *     mu_R    = 2 n_+ n_- / n + 1
 *     var_R   = 2 n_+ n_- (2 n_+ n_- - n) / (n^2 (n - 1))
 *     z       = (R - mu_R) / sqrt(var_R)
 *
 * RTZ = z. Sign convention:
 *
 *     z << 0   : FEWER runs than expected -> CLUSTERING
 *                 (above-median days bunch together, then below-median
 *                  days bunch together; persistence / regime behaviour).
 *     z ~  0   : sequence is consistent with i.i.d. symmetric noise.
 *     z >> 0   : MORE runs than expected -> ANTI-CLUSTERING
 *                 (above and below alternate more than chance; mean-
 *                  reversion / oscillation).
 *
 * Range of z: roughly [-sqrt(n-1), +sqrt(n-1)]; under the null its
 * tail probabilities follow standard normal asymptotically (n_+ >= 10
 * and n_- >= 10 is a common rule of thumb, but the statistic is
 * defined for n >= 2 with n_+ >= 1 and n_- >= 1).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..63):
 *
 *   - axes 32..57 (Gini, S-Gini, Atkinson, Theil-L/T, GE family,
 *     Hoover, Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson,
 *     Palma, Kolm-Pollak, Chakravarty, Amato, Esteban-Ray,
 *     Var-of-Logs, Log-MAD, FGT) and axes 58..63 (PGR, IOM, MSR,
 *     DSG, QSR, MADM) are ALL PERMUTATION-INVARIANT magnitude
 *     statistics: shuffle the days arbitrarily and they do not
 *     change. RTZ is NOT permutation-invariant. RTZ is the ONLY
 *     temporal-ordering statistic in the daily-token family that
 *     answers a "do high days CLUSTER?" question, not a "how
 *     unequal?" question.
 *
 *   - The closest cousin in the wider repo is
 *     `daily-token-autocorrelation-lag-1` (rho_1), which is also
 *     order-sensitive. But rho_1 is a MOMENT functional of the
 *     centred values: rho_1 = sum (D_t - mean)(D_{t+1} - mean) /
 *     sum (D_t - mean)^2 -- breakdown 1/n and dominated by the
 *     largest absolute deviations. RTZ is built on the BINARY
 *     above/below-median trace -- it discards magnitude entirely,
 *     so it has BREAKDOWN POINT 0.5 (a single 1e9 day flips one
 *     bit of the trace and changes R by at most 2). The pair
 *     (rho_1, RTZ) jointly distinguishes magnitude-driven serial
 *     correlation from sign-driven clustering, and they will
 *     disagree under heavy-tailed shocks (rho_1 dominated by the
 *     spike, RTZ unaffected) and under symmetric square-wave
 *     regimes (RTZ extreme negative, rho_1 mid).
 *
 *   - axis 32 `daily-token-monotone-run-length` and axis 56
 *     `daily-token-second-diff-sign-runs` are also runs-on-signs
 *     statistics, but on FIRST or SECOND DIFFERENCES of values
 *     (sign of D_{t+1}-D_t etc), NOT on the above-median binary
 *     trace. They measure local trend persistence; RTZ measures
 *     regime persistence about the GLOBAL median. The two answer
 *     different questions: a long monotone ramp gives low
 *     monotone-run-length count and low diff-sign-runs count, but
 *     RTZ on the same ramp gives R = 2 (one '-' run then one '+'
 *     run), z ~= -sqrt(n-1) -- i.e. extreme clustering by RTZ.
 *
 * Headline question:
 * **"For each source, are above-median and below-median days
 *   CLUSTERED in time (regime behaviour, z << 0), randomly
 *   interleaved (z ~ 0), or hyper-alternating (mean-reversion,
 *   z >> 0)?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass
 *     is below this floor.
 *   - `minDays` (default 8): the runs-test asymptotic is unstable
 *     for n_+ < 4 or n_- < 4, so default 8 keeps both arms
 *     non-trivial.
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'absZ'): 'absZ' (most clustered/anticlustered
 *     first) | 'z' | 'tokens' | 'days' | 'source' | 'runs'.
 *   - `minAbsZ`: display filter on |z|; degenerate rows are always
 *     retained.
 *   - `includeAcf1` (refinement): every row gains `acf1` (lag-1
 *     Pearson autocorrelation on the same per-day vector after
 *     centring on the median) and `signCoherence = -z * acf1` so
 *     that POSITIVE coherence flags axes that AGREE on the
 *     "persistence" reading and NEGATIVE coherence flags
 *     magnitude-vs-sign disagreement.
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';

export type DailyTokenRunsTestZSort =
  | 'absZ'
  | 'z'
  | 'tokens'
  | 'days'
  | 'source'
  | 'runs';

export interface DailyTokenRunsTestZOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenRunsTestZSort;
  /** Display filter: drop rows whose `|z|` is strictly below this value. 0 = no filter. */
  minAbsZ?: number | null;
  /**
   * Refinement (v0.6.308): when true, every emitted row gains an
   * `acf1` lag-1 Pearson autocorrelation on (D_t - median) and a
   * `signCoherence = -z * acf1` cross-axis signed witness.
   * Pure compute; no extra I/O.
   */
  includeAcf1?: boolean;
  generatedAt?: string;
}

export interface DailyTokenRunsTestZSourceRow {
  source: string;
  totalTokens: number;
  /** Days kept after dropping median-tied days (n_+ + n_-). */
  nDays: number;
  /** Days originally observed (before tie drop). */
  nDaysObserved: number;
  /** Days dropped because D_i exactly equals the median. */
  nDaysTied: number;
  firstDay: string;
  lastDay: string;
  /** Per-day P50 under linear interpolation (R type 7). */
  medianDaily: number;
  /** Count of days strictly above the median. */
  nPlus: number;
  /** Count of days strictly below the median. */
  nMinus: number;
  /** Number of maximal runs of identical signs in the kept sequence. */
  runs: number;
  /** E[runs] = 2*n+ *n- /n + 1 under the i.i.d. symmetric null. */
  meanRuns: number;
  /** Var[runs] under the same null. */
  varRuns: number;
  /** (runs - meanRuns) / sqrt(varRuns). */
  z: number;
  /** Mean per-day total_tokens (totalTokens / nDays). */
  meanDailyTokens: number;
  /**
   * True when n_+ < 1 or n_- < 1 (constant sign or single-symbol
   * trace) or when varRuns <= 0 (degenerate variance). z = 0 in
   * this case as a guard.
   */
  degenerate: boolean;
  /** Refinement: surfaced iff includeAcf1. */
  acf1?: number;
  /** Refinement: -z * acf1. Surfaced iff includeAcf1. */
  signCoherence?: number;
}

export interface DailyTokenRunsTestZReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenRunsTestZSort;
  minAbsZ: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinAbsZ: number;
  droppedTopSources: number;
  /** Echo of the includeAcf1 knob. */
  includeAcf1: boolean;
  sources: DailyTokenRunsTestZSourceRow[];
}

/**
 * Linear-interpolation (numpy 'linear' / R type 7) percentile of a
 * pre-sorted ascending vector.
 */
function percentileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/**
 * Wald-Wolfowitz runs-test primitive on a pre-ordered numeric
 * vector. Returns the median, sign counts, run count, and the
 * z-statistic. Days exactly equal to the median are excluded.
 *
 * Throws on negative or non-finite input.
 */
export function runsTestZOfVector(values: number[]): {
  median: number;
  nPlus: number;
  nMinus: number;
  runs: number;
  meanRuns: number;
  varRuns: number;
  z: number;
  degenerate: boolean;
} {
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `runsTestZOfVector requires non-negative finite values (got ${v})`,
      );
    }
  }
  const n0 = values.length;
  if (n0 < 2) {
    return {
      median: n0 === 1 ? values[0]! : 0,
      nPlus: 0,
      nMinus: 0,
      runs: 0,
      meanRuns: 0,
      varRuns: 0,
      z: 0,
      degenerate: true,
    };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const median = percentileSorted(sorted, 50);
  // Build the sign trace, dropping ties.
  const signs: number[] = [];
  for (let i = 0; i < n0; i += 1) {
    const v = values[i]!;
    if (v > median) signs.push(1);
    else if (v < median) signs.push(-1);
    // exact equality: drop
  }
  const n = signs.length;
  let nPlus = 0;
  let nMinus = 0;
  for (const s of signs) {
    if (s > 0) nPlus += 1;
    else nMinus += 1;
  }
  if (n < 2 || nPlus < 1 || nMinus < 1) {
    return {
      median,
      nPlus,
      nMinus,
      runs: n === 0 ? 0 : 1,
      meanRuns: 0,
      varRuns: 0,
      z: 0,
      degenerate: true,
    };
  }
  let runs = 1;
  for (let i = 1; i < n; i += 1) {
    if (signs[i] !== signs[i - 1]) runs += 1;
  }
  const num = 2 * nPlus * nMinus;
  const meanRuns = num / n + 1;
  const varRuns = (num * (num - n)) / (n * n * (n - 1));
  if (!(varRuns > 0)) {
    return {
      median,
      nPlus,
      nMinus,
      runs,
      meanRuns,
      varRuns: Math.max(0, varRuns),
      z: 0,
      degenerate: true,
    };
  }
  const z = (runs - meanRuns) / Math.sqrt(varRuns);
  return { median, nPlus, nMinus, runs, meanRuns, varRuns, z, degenerate: false };
}

/**
 * Lag-1 Pearson autocorrelation on (values - median). Returns 0
 * when n < 2 or denominator is zero. This is intentionally a
 * MEDIAN-CENTRED variant (not mean-centred) so the cross-axis
 * `signCoherence = -z * acf1` is consistent: both axes are
 * referenced to the same global median.
 */
function lag1AutocorrelationCenteredAtMedian(values: number[], median: number): number {
  const n = values.length;
  if (n < 2) return 0;
  const c: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) c[i] = values[i]! - median;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) den += c[i]! * c[i]!;
  for (let i = 0; i + 1 < n; i += 1) num += c[i]! * c[i + 1]!;
  if (!(den > 0)) return 0;
  return num / den;
}

export function buildDailyTokenRunsTestZ(
  queue: QueueLine[],
  opts: DailyTokenRunsTestZOptions = {},
): DailyTokenRunsTestZReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 8;
  if (!Number.isInteger(minDays) || minDays < 4) {
    throw new Error(
      `minDays must be an integer >= 4 (the runs-test variance is unstable for n+ or n- < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAbsZ = opts.minAbsZ ?? null;
  if (minAbsZ !== null && (!Number.isFinite(minAbsZ) || minAbsZ < 0)) {
    throw new Error(
      `minAbsZ must be a non-negative finite number when set (got ${opts.minAbsZ})`,
    );
  }
  const sort: DailyTokenRunsTestZSort = opts.sort ?? 'absZ';
  const validSorts: DailyTokenRunsTestZSort[] = [
    'absZ',
    'z',
    'tokens',
    'days',
    'source',
    'runs',
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
  let droppedBelowMinDays = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenRunsTestZSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDaysObserved = acc.perDay.size;
    if (nDaysObserved < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    // Sort days lexicographically (ISO YYYY-MM-DD == calendar order)
    const dayKeys = Array.from(acc.perDay.keys()).sort();
    const values: number[] = dayKeys.map((d) => acc.perDay.get(d)!);
    const r = runsTestZOfVector(values);
    const nKept = r.nPlus + r.nMinus;
    const row: DailyTokenRunsTestZSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays: nKept,
      nDaysObserved,
      nDaysTied: nDaysObserved - nKept,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      medianDaily: r.median,
      nPlus: r.nPlus,
      nMinus: r.nMinus,
      runs: r.runs,
      meanRuns: r.meanRuns,
      varRuns: r.varRuns,
      z: r.z,
      meanDailyTokens: acc.totalTokens / nDaysObserved,
      degenerate: r.degenerate,
    };
    if (opts.includeAcf1) {
      const acf1 = lag1AutocorrelationCenteredAtMedian(values, r.median);
      row.acf1 = acf1;
      row.signCoherence = -r.z * acf1;
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAbsZ = 0;
  let filtered = rows;
  if (minAbsZ !== null && minAbsZ > 0) {
    const next: DailyTokenRunsTestZSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || Math.abs(r.z) >= minAbsZ) next.push(r);
      else droppedBelowMinAbsZ += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'z':
        primary = b.z - a.z;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'runs':
        primary = b.runs - a.runs;
        break;
      case 'absZ':
      default:
        primary = Math.abs(b.z) - Math.abs(a.z);
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minDays,
    top,
    sort,
    minAbsZ,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinAbsZ,
    droppedTopSources,
    includeAcf1: opts.includeAcf1 ?? false,
    sources: kept,
  };
}
