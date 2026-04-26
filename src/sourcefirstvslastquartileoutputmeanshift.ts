/**
 * source-first-vs-last-quartile-output-mean-shift: per-source
 * non-parametric chronological drift detector for `output_tokens`.
 *
 * Headline question: **for each source, has the mean per-row
 * `output_tokens` shifted from the source's earliest activity to its
 * most recent activity?** I.e. is the source generating fatter or
 * thinner replies now than when it started?
 *
 * Algorithm. For each source, we collect every queue row in the
 * window with finite `hour_start` and `output_tokens >= 0`, sort the
 * rows ascending by `hour_start` (ties broken by original input
 * order — stable), and split the sorted sequence into four contiguous
 * chronological slices of nearly-equal size (Tukey-style quartiles
 * over the row index). We then compute:
 *
 *   - `firstQMean`:  arithmetic mean of `output_tokens` over the
 *                    earliest 25% of rows (Q1 by chronology).
 *   - `lastQMean`:   arithmetic mean over the latest 25% of rows
 *                    (Q4 by chronology).
 *   - `meanShift`:   `lastQMean - firstQMean`. Positive = the source
 *                    is generating fatter replies on average than at
 *                    debut; negative = thinner; ~0 = stationary.
 *   - `relShift`:    `meanShift / firstQMean` if `firstQMean > 0`,
 *                    else 0. Unitless. The natural cross-source
 *                    comparator: a source whose firstQ mean was 100
 *                    and lastQ mean is 200 has `relShift = 1.0`,
 *                    same headline drift as a source going 10000 →
 *                    20000 even though their absolute shifts differ
 *                    by 100x.
 *   - `firstQRows`,
 *     `lastQRows`:   slice sizes (used for transparency about how
 *                    much sample each end of the comparison rests on;
 *                    small for low-row sources).
 *   - `firstQEnd`:   ISO `hour_start` of the last row in Q1 — the
 *                    "as of" boundary of the early-period mean.
 *   - `lastQStart`:  ISO `hour_start` of the first row in Q4 — the
 *                    "since" boundary of the late-period mean.
 *
 * Quartile boundaries follow the Tukey index split: with `n` rows
 * sorted by hour_start, Q1 is rows `[0, floor(n/4))`, Q4 is rows
 * `[n - floor(n/4), n)`. For `n = 4k` this is exactly `k` rows in
 * each end-quartile (no overlap, no gaps in the middle two quartiles
 * which we deliberately ignore — middle 50% is unobserved by design;
 * this lens is about the **endpoints**, not the trajectory).
 * For non-multiples of 4, Q1 and Q4 are equal-sized (each `floor(n/4)`)
 * and the leftover rows fall in the middle. This guarantees Q1 and
 * Q4 are disjoint for `n >= 2` and equal-sized — both prerequisites
 * for `meanShift` to be a clean apples-to-apples comparison.
 *
 * Why this is genuinely new (orthogonal to existing per-source lenses):
 *
 *   - `source-daily-token-trend-slope` fits an OLS line through
 *     **daily aggregates** of `total_tokens` over the source's active
 *     day sequence. It assumes a linear trend and aggregates by day
 *     (so a source that swings within a day but is flat across days
 *     looks flat). This lens is **non-parametric** (no model fit, no
 *     linearity assumption), operates on **per-row `output_tokens`**
 *     (not daily totals), and answers a different question:
 *     "endpoints have shifted" vs "there is a linear trend". The two
 *     can disagree: a source with a U-shaped trajectory has near-zero
 *     OLS slope but a near-zero `meanShift` too, while a source that
 *     suddenly jumped late in life has near-zero slope but a large
 *     `meanShift`. Conversely, a source on a smooth ramp has both.
 *   - `source-decay-half-life` fits exponential decay to a daily mass
 *     sequence — assumes monotone decay, returns time-to-half. Cannot
 *     express a source that **grew** in reply size (slope > 0).
 *   - `source-output-tokens-per-row-percentiles` reports p50/p90/p99
 *     of per-row `output_tokens` pooled across the **whole window**.
 *     Pooling destroys chronological information — a source whose
 *     reply size doubled in the last quarter of its life has the
 *     same pooled p99 as a source with constant reply size.
 *   - `source-output-tokens-by-hour-cv` measures CV across **clock
 *     hours of day**, which is a circular dimension orthogonal to
 *     calendar-time chronology.
 *   - `source-cumulative-mass-half-life-day` finds the day where the
 *     cumulative running sum crosses 50%. That is a single-statistic
 *     centroid on **mass**, not on **mean reply size**, and operates
 *     on `total_tokens` (input + output). A source can have a mass
 *     half-life centred mid-window while having a strongly drifting
 *     reply-size mean.
 *   - `source-input-output-correlation-coefficient` fits Pearson `r`
 *     between input and output token sequences pooled over the
 *     whole window. Per-row association ≠ per-time-period mean
 *     shift; a source can have stable r and large meanShift, or vice
 *     versa.
 *
 * In short: this is the only lens in the codebase that asks
 * "is this source's typical reply size **structurally different now**
 * from when it began?" without assuming the shape of the trajectory.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per source: collect (hour_start_ms, output_tokens) pairs;
 *      sort ascending by hour_start_ms (stable on input order).
 *   4. Skip sources with rowsKept < 4 (cannot form non-degenerate
 *      quartiles); they surface as `droppedTooFewRowsForQuartiles`.
 *   5. Slice into Q1 = rows[0, q) and Q4 = rows[n-q, n) where
 *      `q = floor(n / 4)` (>= 1).
 *   6. Compute means over each slice; derive `meanShift` and
 *      `relShift`.
 *   7. Apply display gates `--min-rows` (default 4, the absolute
 *      floor for non-degenerate quartiles) and `--min-quartile-rows`
 *      (default 1, the absolute floor for a defined quartile mean).
 *   8. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - A source with all-zero `output_tokens` produces `firstQMean = 0`,
 *     `lastQMean = 0`, `meanShift = 0`, `relShift = 0`. Reported as
 *     stationary, not dropped — zero output is real signal.
 *   - A source where Q1 has zero mean but Q4 is positive cannot
 *     compute `relShift` (division by zero); we report `relShift = 0`
 *     and set `degenerate = y`. The absolute `meanShift` is still
 *     reported and is the right column to read in this case.
 *   - Negative `output_tokens` values (which should never occur in a
 *     valid pew queue) are clamped to 0.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceFirstVsLastQuartileOutputMeanShiftOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows from the per-source
   * table. Display filter only — global denominators reflect the full
   * kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer >= 4 (the
   * absolute floor for forming non-degenerate quartiles). Default 4.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'shift-desc' (default): meanShift desc (largest growth first).
   *   - 'shift-asc':            meanShift asc (largest shrink first).
   *   - 'abs-shift':            |meanShift| desc (largest drift either way).
   *   - 'rel-shift-desc':       relShift desc.
   *   - 'rel-shift-asc':        relShift asc.
   *   - 'abs-rel-shift':        |relShift| desc.
   *   - 'rows':                 rowsKept desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'shift-desc'
    | 'shift-asc'
    | 'abs-shift'
    | 'rel-shift-desc'
    | 'rel-shift-asc'
    | 'abs-rel-shift'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceFirstVsLastQuartileOutputMeanShiftRow {
  source: string;
  rowsKept: number;
  firstQRows: number;
  lastQRows: number;
  firstQMean: number;
  lastQMean: number;
  meanShift: number;
  relShift: number;
  firstQEnd: string;
  lastQStart: string;
  /** True iff Q1 mean is 0 (relShift undefined, reported as 0). */
  degenerate: boolean;
}

export interface SourceFirstVsLastQuartileOutputMeanShiftReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort:
    | 'shift-desc'
    | 'shift-asc'
    | 'abs-shift'
    | 'rel-shift-desc'
    | 'rel-shift-asc'
    | 'abs-rel-shift'
    | 'rows'
    | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of kept rows across all sources. */
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedTooFewRowsForQuartiles: number;
  droppedBelowMinRows: number;
  droppedBelowTopCap: number;
  sources: SourceFirstVsLastQuartileOutputMeanShiftRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'shift-desc',
  'shift-asc',
  'abs-shift',
  'rel-shift-desc',
  'rel-shift-asc',
  'abs-rel-shift',
  'rows',
  'source',
] as const;

export function buildSourceFirstVsLastQuartileOutputMeanShift(
  queue: QueueLine[],
  opts: SourceFirstVsLastQuartileOutputMeanShiftOptions = {},
): SourceFirstVsLastQuartileOutputMeanShiftReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (
    !Number.isInteger(minRows) ||
    minRows < ABSOLUTE_MIN_ROWS
  ) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'shift-desc';
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

  // Per source -> array of (hour_start_ms, output_tokens, originalIdx)
  type Pair = { ms: number; out: number; idx: number };
  const perSource = new Map<string, Pair[]>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;
  let i = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      i += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) {
      i += 1;
      continue;
    }
    if (untilMs !== null && ms >= untilMs) {
      i += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      i += 1;
      continue;
    }

    const outRaw = Number(q.output_tokens);
    const out = Number.isFinite(outRaw) && outRaw > 0 ? outRaw : 0;

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push({ ms, out, idx: i });
    i += 1;
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedTooFewRowsForQuartiles = 0;
  const allRows: SourceFirstVsLastQuartileOutputMeanShiftRow[] = [];

  for (const [source, pairs] of perSource.entries()) {
    totalRowsKept += pairs.length;
    if (pairs.length < ABSOLUTE_MIN_ROWS) {
      droppedTooFewRowsForQuartiles += 1;
      continue;
    }
    // Stable sort: primary by ms asc, secondary by original idx asc.
    pairs.sort((a, b) => {
      if (a.ms !== b.ms) return a.ms - b.ms;
      return a.idx - b.idx;
    });
    const n = pairs.length;
    const q = Math.floor(n / 4);
    if (q < 1) {
      // Cannot happen given the n >= 4 floor above, but guard anyway.
      droppedTooFewRowsForQuartiles += 1;
      continue;
    }
    let firstSum = 0;
    for (let k = 0; k < q; k += 1) {
      firstSum += (pairs[k] as Pair).out;
    }
    let lastSum = 0;
    for (let k = n - q; k < n; k += 1) {
      lastSum += (pairs[k] as Pair).out;
    }
    const firstQMean = firstSum / q;
    const lastQMean = lastSum / q;
    const meanShift = lastQMean - firstQMean;
    const degenerate = firstQMean === 0;
    const relShift = degenerate ? 0 : meanShift / firstQMean;
    const firstQEnd = new Date((pairs[q - 1] as Pair).ms).toISOString();
    const lastQStart = new Date((pairs[n - q] as Pair).ms).toISOString();

    allRows.push({
      source,
      rowsKept: n,
      firstQRows: q,
      lastQRows: q,
      firstQMean,
      lastQMean,
      meanShift,
      relShift,
      firstQEnd,
      lastQStart,
      degenerate,
    });
  }

  let droppedBelowMinRows = 0;
  const survived: SourceFirstVsLastQuartileOutputMeanShiftRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'shift-desc') primary = b.meanShift - a.meanShift;
    else if (sort === 'shift-asc') primary = a.meanShift - b.meanShift;
    else if (sort === 'abs-shift')
      primary = Math.abs(b.meanShift) - Math.abs(a.meanShift);
    else if (sort === 'rel-shift-desc') primary = b.relShift - a.relShift;
    else if (sort === 'rel-shift-asc') primary = a.relShift - b.relShift;
    else if (sort === 'abs-rel-shift')
      primary = Math.abs(b.relShift) - Math.abs(a.relShift);
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
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedTooFewRowsForQuartiles,
    droppedBelowMinRows,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
