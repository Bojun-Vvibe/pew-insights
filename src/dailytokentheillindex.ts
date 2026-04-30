/**
 * daily-token-theil-l-index: per-source THEIL-L (mean log deviation, MLD)
 * inequality index of the per-day total_tokens distribution.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by Theil's second
 * inequality measure (a.k.a. mean log deviation, GE(0) of the
 * generalised-entropy family).
 *
 * Construction (Theil 1967, Bourguignon 1979):
 *
 *   Let mu = mean(D), n = |D|.
 *
 *     L = (1 / n) * sum_i log(mu / D_i)
 *       = log(mu) - (1 / n) * sum_i log(D_i)
 *       = log(mu / GeoMean(D))
 *
 *   Range: L in [0, +inf). L = 0 iff every D_i = mu (perfect
 *   equality). L grows without bound as concentration grows. Reported
 *   in NATS (natural log; multiply by 1/ln(2) to convert to bits).
 *
 *   Interpretation: L is the EXPECTED log shortfall of a randomly
 *   sampled day's mass relative to the equal-share level. Equivalently,
 *   it is the Kullback-Leibler divergence FROM the empirical
 *   day-mass-share distribution (q_i = D_i / sum D) TO the uniform
 *   share distribution (1/n), evaluated against the uniform
 *   reference: L = D_KL(uniform || q). This is the "L" in Theil's L
 *   (the q-vs-uniform divergence with uniform as the FIRST argument);
 *   Theil's T (axis-shipped variant in some toolkits) flips the
 *   arguments and weights by mass.
 *
 *   Connections to other inequality measures (orthogonality below):
 *     - L = -log(1 - A(epsilon=1)) where A is the Atkinson index at
 *       log-utility (axis-36 at epsilon=1). The two functions share
 *       the SAME ordering on every fixed n-vector but report on
 *       DIFFERENT scales (A is bounded in [0, 1]; L is unbounded
 *       above in [0, +inf)) and have DIFFERENT subgroup structure
 *       (see below). At every other epsilon, A(epsilon) and L are
 *       FUNCTIONALLY independent (L is just GE(0)); the link only
 *       exists at the log-utility limit.
 *     - L is the alpha=0 element of the GENERALISED-ENTROPY family
 *       GE(alpha) = (1 / (n * alpha * (alpha - 1))) * sum_i ((D_i / mu)^alpha - 1)
 *       which collapses to L at alpha -> 0 and to Theil-T at alpha -> 1
 *       and to half the squared coefficient of variation (GE(2)) at
 *       alpha = 2. We surface ALL of these in the optional alphaSweep.
 *
 *   ZERO-COLLAPSE: log(mu / 0) = +inf, so a single zero day pins
 *   L = +inf. We surface this as `zeroCollapse: true` and report
 *   `theilL: Infinity`. The `--drop-zero-days` flag removes zero
 *   days from the vector before the index is computed (only relevant
 *   under hypothetical augmentation; our ingestion already drops
 *   non-positive token rows).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `daily-token-gini-coefficient` is a Lorenz-curve integral
 *     (rank-weighted absolute differences). Theil-L is an
 *     ENTROPY-DIVERGENCE measure (KL divergence from uniform).
 *     Different functional class (Lorenz vs. KL); different
 *     decomposability (Gini does NOT decompose additively into
 *     within + between subgroup terms; Theil-L does, with NO
 *     residual). Two day-vectors with identical Gini can have
 *     wildly different L because L weights a transfer at the
 *     bottom (small D_i) much more heavily than Gini does --
 *     log(mu / D_i) blows up as D_i -> 0.
 *   - `daily-token-pietra-ratio` (axis-35) is the L-infinity Lorenz
 *     gap (one anchored max over the population). Theil-L is an
 *     L-1 average over log shortfalls. Different norm; different
 *     transfer sensitivity. Pietra is FLAT under same-side mean-
 *     preserving transfers; L is STRICTLY responsive to ANY
 *     non-trivial transfer.
 *   - `daily-token-zenga-index` (axis pre-35) averages bottom-vs-
 *     top mean ratios over rank cuts. L uses no rank ordering at
 *     all -- it operates on log values directly.
 *   - `daily-token-atkinson-index` (axis-36) is the CRRA welfare
 *     loss A(epsilon) bounded in [0, 1]. Theil-L is GE(0),
 *     unbounded in [0, +inf). The two FUNCTIONALLY coincide as
 *     orderings only at epsilon = 1 (log utility), where
 *     L = -log(1 - A); at every other epsilon they are
 *     independent. Critically:
 *       (a) Theil-L is ADDITIVELY DECOMPOSABLE into within-group
 *           and between-group components with NO residual;
 *           Atkinson is NOT additively decomposable (it has a
 *           cross term that depends on subgroup means).
 *       (b) Theil-L is reported in NATS (information-theoretic
 *           interpretable as KL divergence); Atkinson is a
 *           welfare-loss FRACTION. The unit difference matters
 *           when comparing across n's (L scales like
 *           Theil-bound = log(n); Atkinson is always in [0, 1]).
 *     We expose `atkinsonAtEpsilon1` as a derived field for
 *     numerical cross-validation (= 1 - exp(-L)).
 *   - All time-ordered axes (autocorrelation, monotone-run-length,
 *     second-difference-sign-runs, z-score-extremes) read the
 *     daily series as a sequence. L is permutation-invariant.
 *
 * Headline question:
 * **"For each source, how many NATS of information would we need
 *   to add to the empirical day-mass-share distribution to bring
 *   it to perfect equality across days? And how does that loss
 *   compare to the bounded-welfare Atkinson(epsilon=1) on the
 *   same vector via L = -log(1 - A)?"**
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
 *   - `minDays` (default 2): L is degenerate for n < 2; surfaces
 *     as `droppedBelowMinDays`.
 *   - `dropZeroDays` (default false): drop D_i = 0 days BEFORE
 *     computing L (avoids the +inf zero-collapse; surfaces as
 *     `nDroppedZeroDays` per row).
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'theilL'): 'theilL' | 'tokens' | 'days' |
 *     'source' | 'meanDaily'.
 *   - `minTheilL` (default 0): display filter; in [0, +inf).
 *   - `alphaSweep` (default empty): when non-empty, attach a
 *     `geSweep` array per row with one entry per alpha value
 *     `{ alpha, ge }`, where `ge` is the GE(alpha) element of the
 *     generalised-entropy family (alpha=0 reproduces theilL;
 *     alpha=1 is Theil-T; alpha=2 is half-squared-CV). Refinement
 *     in v0.6.275 is the per-source alpha-sweep helper.
 */
import type { QueueLine } from './types.js';

export type DailyTokenTheilLSort =
  | 'theilL'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily';

export interface DailyTokenTheilLOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  /**
   * If true, days whose total_tokens = 0 are removed BEFORE the
   * Theil-L computation. Without this, a single zero day pins
   * L = +inf (zero-collapse). Default false.
   */
  dropZeroDays?: boolean;
  top?: number;
  sort?: DailyTokenTheilLSort;
  /**
   * Display filter: drop rows whose `theilL` is strictly below
   * this value. 0 = no filter; in [0, +inf).
   */
  minTheilL?: number;
  /**
   * Refinement (v0.6.274): when set to a non-empty array, every
   * emitted row gains a `geSweep` array with one entry per alpha
   * value `{ alpha, ge }` where ge = GE(alpha) of the same per-day
   * vector. Pure compute; witnesses where in the GE family the
   * source sits (alpha=0 -> theilL; alpha=1 -> Theil-T; alpha=2
   * -> half-squared-CV). Provides a single-axis snapshot of the
   * full GE-family shape without needing a separate command.
   */
  alphaSweep?: readonly number[];
  generatedAt?: string;
}

export interface DailyTokenTheilLSourceRow {
  source: string;
  /** Sum of total_tokens across all retained days. */
  totalTokens: number;
  /** Number of distinct UTC days with positive token mass. */
  nDays: number;
  /**
   * Number of zero-mass days that were dropped before the index
   * was computed (only when `dropZeroDays` is set). Always 0
   * for the standard ingestion pipeline.
   */
  nDroppedZeroDays: number;
  firstDay: string;
  lastDay: string;
  /**
   * Theil-L (mean log deviation) of the per-day total_tokens
   * vector, in NATS. In [0, +inf). 0 = perfect equality.
   * +Infinity if zeroCollapse and !dropZeroDays.
   */
  theilL: number;
  /**
   * Cross-check: Atkinson(epsilon=1) on the same vector. Equals
   * `1 - exp(-theilL)` when theilL is finite, else 1. In [0, 1].
   * Surfaces the bounded-welfare reading of the same shape.
   */
  atkinsonAtEpsilon1: number;
  /**
   * Geometric mean of the per-day total_tokens. Equals
   * `mu * exp(-theilL)` when finite, else 0. In tokens.
   */
  geometricMeanDaily: number;
  /** Mean per-day total_tokens (totalTokens / nDays). Scale anchor. */
  meanDailyTokens: number;
  /** Largest single-day total_tokens. */
  maxDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the largest single-day total. */
  maxDay: string;
  /** Smallest single-day total_tokens (post-drop-zero-days if set). */
  minDailyTokens: number;
  /** UTC date (yyyy-mm-dd) of the smallest single-day total. */
  minDay: string;
  /**
   * True iff a structural zero collapse happened (any D_i = 0 with
   * dropZeroDays=false forces L = +inf). Useful to distinguish
   * "pinned" vs. "computed" extremes.
   */
  zeroCollapse: boolean;
  /**
   * Refinement (v0.6.274): present iff `alphaSweep` was set.
   * Each entry pins `{ alpha, ge }` for the SAME day vector,
   * surfacing the GE(alpha) family shape without re-running the
   * command per alpha.
   */
  geSweep?: { alpha: number; ge: number }[];
}

export interface DailyTokenTheilLReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  dropZeroDays: boolean;
  top: number;
  sort: DailyTokenTheilLSort;
  minTheilL: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinTheilL: number;
  droppedTopSources: number;
  /** Echo of the alphaSweep knob; empty array when not set. */
  alphaSweep: number[];
  sources: DailyTokenTheilLSourceRow[];
}

/**
 * Theil-L (mean log deviation) of a non-negative numeric vector.
 *
 * Returns:
 *   - { theilL: 0, geometricMean: 0, mean: 0, zeroCollapse: false }
 *     for n < 2 or all-zero / empty input.
 *   - theilL = +Infinity, geometricMean = 0, zeroCollapse = true
 *     if any element is exactly 0.
 *   - theilL in [0, +inf) otherwise.
 *
 * Throws on negative or non-finite input.
 */
export function theilLOfVector(values: number[]): {
  theilL: number;
  geometricMean: number;
  mean: number;
  zeroCollapse: boolean;
} {
  const n = values.length;
  if (n < 2) {
    return { theilL: 0, geometricMean: 0, mean: 0, zeroCollapse: false };
  }
  let total = 0;
  let hasZero = false;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `theilLOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
    if (v === 0) hasZero = true;
  }
  if (total <= 0) {
    return { theilL: 0, geometricMean: 0, mean: 0, zeroCollapse: false };
  }
  const mu = total / n;
  if (hasZero) {
    return {
      theilL: Number.POSITIVE_INFINITY,
      geometricMean: 0,
      mean: mu,
      zeroCollapse: true,
    };
  }
  // L = log(mu) - (1/n) * sum log(D_i) = log(mu / GeoMean)
  let logSum = 0;
  for (const v of values) logSum += Math.log(v);
  const meanLog = logSum / n;
  const geoMean = Math.exp(meanLog);
  let theilL = Math.log(mu) - meanLog;
  // Numerical clamp: L >= 0 by Jensen; floating-point can put it
  // ~-1e-16 negative on near-uniform vectors.
  if (theilL < 0) theilL = 0;
  return { theilL, geometricMean: geoMean, mean: mu, zeroCollapse: false };
}

/**
 * Generalised-entropy GE(alpha) of a non-negative numeric vector.
 *
 * Definitions:
 *   GE(alpha) = (1 / (n * alpha * (alpha - 1)))
 *               * sum_i ((D_i / mu)^alpha - 1)              alpha != 0, 1
 *   GE(0)     = (1 / n) * sum_i log(mu / D_i)               (Theil-L)
 *   GE(1)     = (1 / n) * sum_i (D_i / mu) * log(D_i / mu)  (Theil-T)
 *
 * Returns 0 for n < 2 or all-zero. Returns +Infinity for alpha <= 0
 * with any zero element (log / power blows up).
 *
 * Throws on negative or non-finite input.
 */
export function generalisedEntropyOfVector(
  values: number[],
  alpha: number,
): number {
  if (!Number.isFinite(alpha)) {
    throw new Error(
      `generalisedEntropyOfVector requires finite alpha (got ${alpha})`,
    );
  }
  const n = values.length;
  if (n < 2) return 0;
  let total = 0;
  let hasZero = false;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `generalisedEntropyOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
    if (v === 0) hasZero = true;
  }
  if (total <= 0) return 0;
  const mu = total / n;
  if (alpha === 0) {
    if (hasZero) return Number.POSITIVE_INFINITY;
    let logSum = 0;
    for (const v of values) logSum += Math.log(v);
    let ge = Math.log(mu) - logSum / n;
    if (ge < 0) ge = 0;
    return ge;
  }
  if (alpha === 1) {
    if (hasZero) {
      // 0 * log(0) -> 0 by convention; the rest of the sum is finite.
      let s = 0;
      for (const v of values) {
        if (v === 0) continue;
        const r = v / mu;
        s += r * Math.log(r);
      }
      let ge = s / n;
      if (ge < 0) ge = 0;
      return ge;
    }
    let s = 0;
    for (const v of values) {
      const r = v / mu;
      s += r * Math.log(r);
    }
    let ge = s / n;
    if (ge < 0) ge = 0;
    return ge;
  }
  // alpha != 0, 1
  if (alpha < 0 && hasZero) return Number.POSITIVE_INFINITY;
  let s = 0;
  for (const v of values) {
    const r = v / mu;
    // r >= 0; if r = 0 and alpha > 0, r^alpha = 0; we contribute (-1).
    s += Math.pow(r, alpha) - 1;
  }
  let ge = s / (n * alpha * (alpha - 1));
  if (ge < 0) ge = 0;
  return ge;
}

export function buildDailyTokenTheilLIndex(
  queue: QueueLine[],
  opts: DailyTokenTheilLOptions = {},
): DailyTokenTheilLReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Theil-L is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minTheilL = opts.minTheilL ?? 0;
  if (!Number.isFinite(minTheilL) || minTheilL < 0) {
    throw new Error(
      `minTheilL must be a non-negative finite number (got ${opts.minTheilL})`,
    );
  }
  const sort: DailyTokenTheilLSort = opts.sort ?? 'theilL';
  const validSorts: DailyTokenTheilLSort[] = [
    'theilL',
    'tokens',
    'days',
    'source',
    'meanDaily',
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

  const alphaSweep: number[] = [];
  if (opts.alphaSweep && opts.alphaSweep.length > 0) {
    for (const a of opts.alphaSweep) {
      if (!Number.isFinite(a)) {
        throw new Error(
          `alphaSweep values must be finite numbers (got ${a})`,
        );
      }
      alphaSweep.push(a);
    }
  }

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
  const rows: DailyTokenTheilLSourceRow[] = [];

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
    let minDailyTokens = Number.POSITIVE_INFINITY;
    let minDay = acc.firstDay;
    for (const [d, v] of acc.perDay) {
      valuesAll.push(v);
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
      if (v < minDailyTokens) {
        minDailyTokens = v;
        minDay = d;
      }
    }
    let values = valuesAll;
    let nDroppedZeroDays = 0;
    if (dropZeroDays) {
      values = valuesAll.filter((v) => v > 0);
      nDroppedZeroDays = valuesAll.length - values.length;
      if (values.length < minDays) {
        droppedBelowMinDays += 1;
        continue;
      }
    }
    const t = theilLOfVector(values);
    const atkinsonAtEpsilon1 = Number.isFinite(t.theilL)
      ? 1 - Math.exp(-t.theilL)
      : 1;
    const row: DailyTokenTheilLSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nDroppedZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      theilL: t.theilL,
      atkinsonAtEpsilon1,
      geometricMeanDaily: t.geometricMean,
      meanDailyTokens: acc.totalTokens / nDays,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
      zeroCollapse: t.zeroCollapse,
    };
    if (alphaSweep.length > 0) {
      row.geSweep = alphaSweep.map((a) => ({
        alpha: a,
        ge: generalisedEntropyOfVector(values, a),
      }));
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinTheilL = 0;
  let filtered = rows;
  if (minTheilL > 0) {
    const next: DailyTokenTheilLSourceRow[] = [];
    for (const r of rows) {
      if (r.theilL >= minTheilL) next.push(r);
      else droppedBelowMinTheilL += 1;
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
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'theilL':
      default: {
        // +Infinity sorts to top.
        const av = a.theilL;
        const bv = b.theilL;
        if (av === bv) primary = 0;
        else if (!Number.isFinite(bv) && Number.isFinite(av)) primary = 1;
        else if (!Number.isFinite(av) && Number.isFinite(bv)) primary = -1;
        else primary = bv - av;
        break;
      }
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
    dropZeroDays,
    top,
    sort,
    minTheilL,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinTheilL,
    droppedTopSources,
    alphaSweep,
    sources: kept,
  };
}
