/**
 * source-row-token-burstiness-coefficient: per-source Goh & Barabási
 * (2008) **burstiness coefficient B** of `total_tokens` across the
 * source's queue rows:
 *
 *     B = (sigma - mu) / (sigma + mu)
 *
 * where `mu` is the sample mean and `sigma` is the sample standard
 * deviation (population form, divisor n) of per-row `total_tokens`.
 *
 * Headline question: **for each source, is the per-row token volume
 * regular ("anti-bursty"), Poisson-like, or bursty, on a single
 * bounded [-1, 1] regime axis?**
 *
 * Reading the scalar:
 *
 *   - `B = -1`: perfectly periodic / constant series (sigma = 0).
 *   - `B =  0`: sigma == mu — neutral "exponential / Poisson-like"
 *     baseline (the same regime cv = 1 marks). Anything below 0 is
 *     more regular than Poisson; anything above 0 is more bursty.
 *   - `B ->  1`: extremely heavy-tailed; one or a handful of rows
 *     dwarf the rest (sigma >> mu).
 *
 * Why this lens is genuinely orthogonal to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-coefficient-of-variation` reports the raw
 *     `cv = sigma / mu` on (0, +inf). B is a **bounded monotone
 *     transform** of cv: `B = (cv - 1) / (cv + 1)`, so the *ranking*
 *     of sources by B and by cv is identical for non-degenerate
 *     sources. The added value of B is **not** a different ranking;
 *     it is a **regime-classification scalar** with three concrete
 *     anchor points (-1 periodic, 0 Poisson, +1 maximally bursty)
 *     that are directly comparable across sources of any scale and
 *     that gate cleanly on a fixed threshold (e.g. `--min-b 0` =
 *     "show me only super-Poisson sources"). cv has no such
 *     interpretable cut-off — its scale is open-ended and its
 *     "Poisson baseline" of 1.0 is a number an operator has to
 *     remember rather than a built-in zero.
 *   - `source-burstiness-fano-factor` is the **Fano factor**
 *     `F = sigma^2 / mu` on **per-day totals** — different grain
 *     (day, not row), different functional form (variance/mean,
 *     carries token units, scale-dependent), different bounds (0
 *     to +inf), different anchor (F = 1 ~ Poisson, not B = 0).
 *     Two sources can have identical F (because their day-level
 *     variance/mean coincide) and very different B (because the
 *     row-level cv differs).
 *   - `source-row-token-iqr-ratio` is a **robust, order-statistic**
 *     spread-vs-centre measure: outlier-immune. B is a moment-based
 *     measure dominated by a few extreme rows. Two distributions
 *     can share IQR/median and have wildly different B.
 *   - `source-row-token-mad` (median absolute deviation / median):
 *     also robust, also median-anchored. B uses mean and stddev.
 *   - `source-row-token-gini` is a **Lorenz-curve concentration**
 *     index, a pairwise-difference area integral. A perfectly
 *     symmetric distribution can have Gini ~0.3 with B near 0;
 *     a Pareto with Gini ~0.7 can have B close to 1.
 *   - `source-row-token-skewness` and `source-row-token-kurtosis`
 *     are 3rd and 4th standardised moments — shape, not the
 *     mean/stddev *ratio* B reports.
 *   - `source-row-token-autocorrelation-lag1` measures **ordering
 *     persistence**, blind to dispersion. Shuffling rows leaves B
 *     unchanged but typically zeros out lag-1 autocorrelation.
 *   - `source-row-token-same-model-streak` is a **categorical**
 *     stickiness statistic — which model — not numerical
 *     dispersion of token magnitudes.
 *   - `source-output-tokens-per-row-percentiles` reports raw
 *     percentiles of `output_tokens` (not total_tokens) and emits
 *     no single comparable scalar.
 *
 * Concretely, for each source:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`).
 *   3. Drop rows with non-finite `total_tokens` (counted in
 *      `droppedInvalidTokens`).
 *   4. Drop rows with **negative** `total_tokens` (counted in
 *      `droppedNegativeTokens`). Negative token magnitudes are
 *      meaningless under the Goh & Barabási interpretation
 *      (which is a non-negative point-process spread vs centre).
 *   5. Group remaining rows by source.
 *   6. Per source: skip if `n < minRows` (default 2 — need at
 *      least 2 observations for any non-trivial sigma).
 *   7. Compute mean (mu) and **population** stddev (sigma) using
 *      the divisor `n` (not `n - 1`); the Goh & Barabási formula
 *      and almost all empirical literature use the population
 *      form. Document this explicitly so the operator knows.
 *   8. Emit:
 *      - `mean`, `stddev`, `cv = stddev / mean` (with
 *        `cv = null` when `mean = 0`),
 *      - `b`:
 *          - the standard B = (sigma - mu) / (sigma + mu) when
 *            `sigma + mu > 0`,
 *          - `0` when `sigma = 0` AND `mu > 0` (constant non-zero
 *            series — perfectly regular; B = -1 is the *limit* but
 *            we actually observe sigma = 0, mu > 0 directly:
 *            `B = (0 - mu) / (0 + mu) = -1`. The formula already
 *            yields `-1` here so we keep that.) Actually: when
 *            sigma = 0 and mu > 0, the formula yields -1 cleanly;
 *            we mark `flat: true` so the operator can filter.
 *          - `null` when `sigma = 0` AND `mu = 0` (all rows are
 *            zero — the formula is 0/0; the regime is undefined;
 *            we mark `degenerate: true`).
 *      - `flat`: true iff `sigma = 0` (constant series); the
 *        rendered B is exactly -1 unless the series is also
 *        all-zero (in which case `b = null`, `degenerate = true`).
 *      - `degenerate`: true iff `sigma = 0 && mu = 0` (B
 *        undefined; reported as null rather than NaN).
 *   9. Apply display gates `--min-rows`, `--min-b` (cohort filter
 *      on the burstiness scalar — `null`/degenerate rows are
 *      dropped by any finite `--min-b`, including `--min-b -1`,
 *      because they have no comparable scalar; counted under
 *      `droppedDegenerate`).
 *  10. Sort + optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - `n < 2`: surfaces as `droppedBelowMinRows`.
 *   - All-equal non-zero series: sigma = 0, mu > 0; B = -1
 *     (perfectly anti-bursty), `flat: true`.
 *   - All-zero series: sigma = 0, mu = 0; B = null,
 *     `degenerate: true`.
 *   - Single huge outlier in an otherwise constant series:
 *     mu and sigma both grow; B asymptotes to ((n-1)/(n+1))^0.5
 *     scaled — for large n it approaches +1 only with truly
 *     pathological tails.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenBurstinessCoefficientSort =
  | 'b-desc'
  | 'b-asc'
  | 'abs-b-desc'
  | 'mean-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenBurstinessCoefficientOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows. Display
   * filter only — global denominators reflect the full kept
   * population. Must be an integer >= 2 (need at least two
   * observations for any non-trivial sigma). Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose burstiness coefficient `b` is strictly
   * below this value; cohort selector. Must be a finite number
   * in the closed interval [-1, 1]. Default -1 (effectively no
   * floor — every regime survives, including perfectly periodic
   * sources whose b = -1). With f > -1, drops `degenerate`
   * (sigma = 0, mu = 0) sources too (their b is null) — counted
   * under `droppedDegenerate` so the operator sees they were
   * dropped because of *what* they are, not because of *how
   * bursty* they are.
   *
   * Reserved for the v0.7.0 refinement commit; the v0.6.99
   * implementation already wires the option end-to-end so the
   * refinement is purely additive.
   */
  minB?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'b-desc' (default): b descending. `null` (degenerate)
   *                         rows sort last.
   *   - 'b-asc':            b ascending. `null` (degenerate)
   *                         rows sort last.
   *   - 'abs-b-desc':       |b| descending — surface the
   *                         most-extreme regimes first
   *                         (perfectly periodic and maximally
   *                         bursty both float to the top).
   *                         `null` rows sort last.
   *   - 'mean-desc':        mean descending.
   *   - 'rows':             rowsKept desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenBurstinessCoefficientSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenBurstinessCoefficientRow {
  source: string;
  rowsKept: number;
  mean: number;
  stddev: number;
  /** stddev / mean. `null` iff `mean = 0`. */
  cv: number | null;
  /**
   * Goh & Barabási burstiness coefficient
   * `b = (stddev - mean) / (stddev + mean)`. `null` iff
   * `stddev = 0 && mean = 0` (degenerate; ratio is 0/0).
   */
  b: number | null;
  flat: boolean;
  degenerate: boolean;
}

export interface SourceRowTokenBurstinessCoefficientReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minB: number;
  top: number | null;
  sort: SourceRowTokenBurstinessCoefficientSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinB: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenBurstinessCoefficientRow[];
}

const VALID_SORTS = [
  'b-desc',
  'b-asc',
  'abs-b-desc',
  'mean-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenBurstinessCoefficient(
  queue: QueueLine[],
  opts: SourceRowTokenBurstinessCoefficientOptions = {},
): SourceRowTokenBurstinessCoefficientReport {
  const minRows = opts.minRows ?? 2;
  if (!Number.isInteger(minRows) || minRows < 2) {
    throw new Error(
      `minRows must be an integer >= 2 (got ${opts.minRows})`,
    );
  }
  const minB = opts.minB ?? -1;
  if (!Number.isFinite(minB) || minB < -1 || minB > 1) {
    throw new Error(
      `minB must be a finite number in [-1, 1] (got ${opts.minB})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'b-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  const perSource = new Map<string, number[]>();

  let droppedInvalidHourStart = 0;
  let droppedInvalidTokens = 0;
  let droppedNegativeTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const tt = q.total_tokens;
    if (typeof tt !== 'number' || !Number.isFinite(tt)) {
      droppedInvalidTokens += 1;
      continue;
    }
    if (tt < 0) {
      droppedNegativeTokens += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push(tt);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceRowTokenBurstinessCoefficientRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum = 0;
    for (const v of samples) sum += v;
    const mean = sum / n;
    let sqSum = 0;
    for (const v of samples) {
      const d = v - mean;
      sqSum += d * d;
    }
    // Population stddev (divisor n) per Goh & Barabási convention.
    const variance = sqSum / n;
    const stddev = Math.sqrt(variance);

    let cv: number | null;
    if (mean === 0) cv = null;
    else cv = stddev / mean;

    let b: number | null;
    let flat: boolean;
    let degenerate: boolean;
    if (stddev === 0 && mean === 0) {
      // 0/0; regime undefined.
      b = null;
      flat = true;
      degenerate = true;
    } else if (stddev === 0) {
      // mean > 0; constant non-zero series. (0 - mu)/(0 + mu) = -1.
      b = -1;
      flat = true;
      degenerate = false;
    } else {
      b = (stddev - mean) / (stddev + mean);
      flat = false;
      degenerate = false;
    }

    allRows.push({
      source,
      rowsKept: n,
      mean,
      stddev,
      cv,
      b,
      flat,
      degenerate,
    });
  }

  let droppedBelowMinB = 0;
  let droppedDegenerate = 0;
  const survived: SourceRowTokenBurstinessCoefficientRow[] = [];
  for (const row of allRows) {
    if (minB > -1) {
      if (row.b === null) {
        // Degenerate rows have no comparable scalar; the floor
        // excludes them. Counted under droppedDegenerate (not
        // droppedBelowMinB) so the operator sees they were
        // dropped because of *what* they are, not because of
        // *how bursty* they are.
        droppedDegenerate += 1;
        continue;
      }
      if (row.b < minB) {
        droppedBelowMinB += 1;
        continue;
      }
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'b-desc') {
      const av = a.b;
      const bv = b.b;
      if (av === null && bv === null) primary = 0;
      else if (av === null) primary = 1;
      else if (bv === null) primary = -1;
      else primary = bv - av;
    } else if (sort === 'b-asc') {
      const av = a.b;
      const bv = b.b;
      if (av === null && bv === null) primary = 0;
      else if (av === null) primary = 1;
      else if (bv === null) primary = -1;
      else primary = av - bv;
    } else if (sort === 'abs-b-desc') {
      const av = a.b;
      const bv = b.b;
      if (av === null && bv === null) primary = 0;
      else if (av === null) primary = 1;
      else if (bv === null) primary = -1;
      else primary = Math.abs(bv) - Math.abs(av);
    } else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minRows,
    minB,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinB,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
