/**
 * daily-token-atkinson-index: per-source ATKINSON inequality index of
 * the per-day total_tokens distribution at a configurable
 * inequality-aversion parameter epsilon (default 0.5).
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by the Atkinson index.
 *
 * Construction (Atkinson 1970):
 *
 *   Let mu = mean(D), n = |D|, epsilon >= 0.
 *
 *     A(epsilon) = 1 - EDE(epsilon) / mu
 *
 *   where the equally-distributed-equivalent income EDE(epsilon) is
 *   the constant-relative-risk-aversion (CRRA) certainty equivalent
 *   of D:
 *
 *     EDE(epsilon) = (1/n * sum_i D_i^(1 - epsilon))^{1 / (1 - epsilon)}    if epsilon != 1
 *     EDE(1)       = (prod_i D_i)^{1 / n}     (geometric mean)
 *
 *   Range: A(epsilon) in [0, 1]. A = 0 iff every D_i = mu (perfect
 *   equality). A -> 1 as concentration grows.
 *
 *   Interpretation: A(epsilon) is the FRACTION of total token mass
 *   that an inequality-averse social planner with CRRA preferences
 *   at parameter epsilon would be willing to give up in exchange
 *   for the SAME total split equally across days. Equivalently, if
 *   the planner is told "we'll take A * mu tokens off every day
 *   then redistribute the rest equally", they would be indifferent
 *   between the original distribution and the leveled-down one.
 *
 *   The epsilon knob:
 *     - epsilon = 0      -> A = 0 (Rawlsian-indifferent; pure utilitarian)
 *     - epsilon -> 0+    -> top-sensitive: a small number of huge
 *                          days dominates the loss
 *     - epsilon = 0.5    -> mild inequality aversion; balanced
 *                          (default; matches what most empirical
 *                          welfare studies report alongside Gini)
 *     - epsilon = 1      -> log utility; A = 1 - GeoMean / ArithMean
 *                          (Theil-L family link)
 *     - epsilon = 2      -> strong inequality aversion; bottom-sensitive
 *     - epsilon -> inf   -> A -> 1 - min(D) / mu (Rawlsian maximin)
 *
 *   ZERO-COLLAPSE: For epsilon >= 1, EDE(epsilon) = 0 if any D_i = 0
 *   (geometric mean / harmonic-style collapse), so A(epsilon) = 1
 *   pinned. This is a structural property of CRRA welfare and is
 *   reported as `zeroCollapse: true` so it is not mistaken for a
 *   spurious extreme. Filtered upstream by `dropZeroDays` (default
 *   false): when set we drop days with D_i = 0 from the vector
 *   before computing the index. We never enter zeros for our data
 *   (we drop non-positive token rows at ingest), but the option
 *   makes the function safe under hypothetical augmentation.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `daily-token-gini-coefficient` is the Lorenz integral. Atkinson
 *     is NOT a Lorenz functional at all -- it is a CRRA welfare
 *     loss. Two vectors with identical Gini can have very different
 *     A(epsilon) for any epsilon != 0 because Gini weights all
 *     transfers by their position on the Lorenz curve while
 *     Atkinson weights them by the marginal CRRA utility at the
 *     transfer level. Specifically, Atkinson satisfies STRICT
 *     Pigou-Dalton transfer sensitivity at every epsilon > 0,
 *     while Pietra (axis-35) does NOT (Pietra is insensitive to
 *     same-side mean-preserving transfers).
 *   - `daily-token-pietra-ratio` (axis-35) is the L-infinity Lorenz
 *     gap: a single max. Atkinson is an integral of CRRA utility
 *     over the WHOLE distribution. Different functional class
 *     (welfare vs. order-statistic), different transfer sensitivity.
 *   - `daily-token-zenga-index` averages bottom-vs-top mean ratios.
 *     Atkinson uses no rank ordering; it operates on the unsorted
 *     value distribution via the power-mean.
 *   - All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes) read the
 *     daily series as a sequence. Atkinson is permutation-invariant.
 *
 * Headline question:
 * **"For each source, what fraction of total token mass would an
 *   inequality-averse planner (CRRA epsilon = 0.5 by default) be
 *   willing to give up to make every day equal? And how does that
 *   loss change as we vary epsilon from top-sensitive (small) to
 *   bottom-sensitive (large)?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor; surfaces as `droppedSparseSources`.
 *   - `minDays` (default 2): Atkinson is degenerate for n < 2;
 *     surfaces as `droppedBelowMinDays`.
 *   - `epsilon` (default 0.5): inequality aversion >= 0.
 *   - `dropZeroDays` (default false): drop D_i = 0 days BEFORE
 *     computing the index (only relevant if zeros exist; surfaces
 *     as nDroppedZeroDays per row).
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'atkinson'): 'atkinson' | 'tokens' | 'days' |
 *     'source' | 'ede'.
 *   - `minAtkinson`: display filter in [0, 1].
 */
import type { QueueLine } from './types.js';

export type DailyTokenAtkinsonSort =
  | 'atkinson'
  | 'tokens'
  | 'days'
  | 'source'
  | 'ede';

export interface DailyTokenAtkinsonOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  /**
   * CRRA inequality-aversion parameter epsilon >= 0. Default 0.5.
   * epsilon = 1 uses the geometric-mean limit (log utility).
   */
  epsilon?: number;
  /**
   * If true, days whose total_tokens = 0 are removed BEFORE the
   * Atkinson computation (relevant only at epsilon >= 1, where a
   * single zero pins A = 1). Default false.
   */
  dropZeroDays?: boolean;
  top?: number;
  sort?: DailyTokenAtkinsonSort;
  /**
   * Display filter: drop rows whose `atkinson` is strictly below
   * this value. 0 = no filter; in [0, 1].
   */
  minAtkinson?: number;
  generatedAt?: string;
}

export interface DailyTokenAtkinsonSourceRow {
  source: string;
  /** Sum of total_tokens across all retained days. */
  totalTokens: number;
  /** Number of distinct UTC days with positive token mass. */
  nDays: number;
  /**
   * Number of zero-mass days that were dropped before the index
   * was computed (only when `dropZeroDays` is set). Always 0
   * for the standard ingestion pipeline (we drop non-positive
   * rows upstream); kept for transparency under hypothetical
   * augmentation.
   */
  nDroppedZeroDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Atkinson index A(epsilon) of the per-day total_tokens vector.
   * In [0, 1]. 0 = perfect equality; -> 1 = extreme concentration.
   */
  atkinson: number;
  /** Mean per-day total_tokens (totalTokens / nDays). Scale anchor. */
  meanDailyTokens: number;
  /**
   * Equally-distributed-equivalent income at the chosen epsilon.
   * EDE = mu * (1 - A). In tokens. Lower-bounded by min(D),
   * upper-bounded by mu.
   */
  ede: number;
  /**
   * Largest single-day total_tokens.
   */
  maxDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the largest single-day total. */
  maxDay: string;
  /**
   * True iff a structural zero collapse happened at epsilon >= 1
   * (any D_i = 0 forces A = 1). Useful to distinguish "pinned"
   * vs. "computed" extremes.
   */
  zeroCollapse: boolean;
}

export interface DailyTokenAtkinsonReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  epsilon: number;
  dropZeroDays: boolean;
  top: number;
  sort: DailyTokenAtkinsonSort;
  minAtkinson: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinAtkinson: number;
  droppedTopSources: number;
  sources: DailyTokenAtkinsonSourceRow[];
}

/**
 * Atkinson index A(epsilon) of a non-negative numeric vector.
 *
 * Returns:
 *   - { atkinson: 0, ede: 0, mean: 0, zeroCollapse: false } for
 *     n < 2 or all-zero / empty input.
 *   - atkinson in [0, 1] otherwise.
 *
 * Throws on negative or non-finite input or epsilon < 0.
 */
export function atkinsonOfVector(
  values: number[],
  epsilon: number,
): {
  atkinson: number;
  ede: number;
  mean: number;
  zeroCollapse: boolean;
} {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new Error(
      `atkinsonOfVector requires epsilon >= 0 finite (got ${epsilon})`,
    );
  }
  const n = values.length;
  if (n < 2) {
    return { atkinson: 0, ede: 0, mean: 0, zeroCollapse: false };
  }
  let total = 0;
  let hasZero = false;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `atkinsonOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
    if (v === 0) hasZero = true;
  }
  if (total <= 0) {
    return { atkinson: 0, ede: 0, mean: 0, zeroCollapse: false };
  }
  const mu = total / n;
  // epsilon = 0: A = 0 (utilitarian). EDE = mu.
  if (epsilon === 0) {
    return { atkinson: 0, ede: mu, mean: mu, zeroCollapse: false };
  }
  // Zero-collapse for epsilon >= 1: EDE = 0, A = 1.
  if (hasZero && epsilon >= 1) {
    return { atkinson: 1, ede: 0, mean: mu, zeroCollapse: true };
  }
  let ede: number;
  if (epsilon === 1) {
    // log-utility limit: EDE = geometric mean.
    let logSum = 0;
    for (const v of values) logSum += Math.log(v);
    ede = Math.exp(logSum / n);
  } else {
    const exponent = 1 - epsilon;
    let powSum = 0;
    for (const v of values) {
      // v >= 0; if v = 0 and epsilon < 1, v^exponent = 0 (well-defined).
      powSum += Math.pow(v, exponent);
    }
    ede = Math.pow(powSum / n, 1 / exponent);
  }
  // Numerical clamp: EDE <= mu by Jensen; floating point can put it
  // ~1e-15 above mu for near-uniform vectors.
  if (ede > mu) ede = mu;
  if (ede < 0) ede = 0;
  const atkinson = 1 - ede / mu;
  // Clamp to [0, 1] against floating-point drift on near-equal vectors.
  const clamped = atkinson < 0 ? 0 : atkinson > 1 ? 1 : atkinson;
  return { atkinson: clamped, ede, mean: mu, zeroCollapse: false };
}

export function buildDailyTokenAtkinsonIndex(
  queue: QueueLine[],
  opts: DailyTokenAtkinsonOptions = {},
): DailyTokenAtkinsonReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Atkinson is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const epsilon = opts.epsilon ?? 0.5;
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new Error(
      `epsilon must be a non-negative finite number (got ${opts.epsilon})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minAtkinson = opts.minAtkinson ?? 0;
  if (!Number.isFinite(minAtkinson) || minAtkinson < 0 || minAtkinson > 1) {
    throw new Error(
      `minAtkinson must be a finite number in [0, 1] (got ${opts.minAtkinson})`,
    );
  }
  const sort: DailyTokenAtkinsonSort = opts.sort ?? 'atkinson';
  const validSorts: DailyTokenAtkinsonSort[] = [
    'atkinson',
    'tokens',
    'days',
    'source',
    'ede',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(
      `source must be a string when set (got ${typeof sourceFilter})`,
    );
  }
  const dropZeroDays = opts.dropZeroDays ?? false;

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
  const rows: DailyTokenAtkinsonSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDays = acc.perDay.size;
    if (nDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    const valuesAll: number[] = [];
    let maxDailyTokens = -1;
    let maxDay = acc.firstDay;
    for (const [d, v] of acc.perDay) {
      valuesAll.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
    }
    let values = valuesAll;
    let nDroppedZeroDays = 0;
    if (dropZeroDays) {
      values = valuesAll.filter((v) => v > 0);
      nDroppedZeroDays = valuesAll.length - values.length;
      if (values.length < minDays) {
        // Dropping zeros made the vector too small; surface as
        // below-min-days so it's visible.
        droppedBelowMinDays += 1;
        continue;
      }
    }
    const a = atkinsonOfVector(values, epsilon);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nDroppedZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      atkinson: a.atkinson,
      meanDailyTokens: acc.totalTokens / nDays,
      ede: a.ede,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      zeroCollapse: a.zeroCollapse,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinAtkinson = 0;
  let filtered = rows;
  if (minAtkinson > 0) {
    const next: DailyTokenAtkinsonSourceRow[] = [];
    for (const r of rows) {
      if (r.atkinson >= minAtkinson) next.push(r);
      else droppedBelowMinAtkinson += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'ede':
        primary = b.ede - a.ede;
        break;
      case 'atkinson':
      default:
        primary = b.atkinson - a.atkinson;
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
    epsilon,
    dropZeroDays,
    top,
    sort,
    minAtkinson,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinAtkinson,
    droppedTopSources,
    sources: kept,
  };
}
