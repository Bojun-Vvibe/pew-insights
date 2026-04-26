/**
 * source-zero-output-row-share: per-source share of rows with
 * `output_tokens == 0` — i.e. turns where the model produced no
 * output despite being invoked.
 *
 * Headline question: **what fraction of a source's rows are
 * zero-output turns, and how much input volume do those zero-output
 * rows account for?**
 *
 * Intuition. A row with `output_tokens == 0` represents a turn that
 * was either aborted (user ctrl-c'd before any tokens streamed),
 * empty-replied (server returned a stop with no content), or
 * accounting-only (e.g. tool-result echo recorded as a queue row
 * but with no model generation). These are operationally interesting
 * because:
 *
 *   - Input tokens were still consumed (prompt was assembled and
 *     possibly shipped) — the input cost is real even though there
 *     is no output to show for it.
 *   - A high `zeroShare` for a source suggests workflow friction:
 *     prompts being abandoned, context-collection turns that don't
 *     trigger generation, or aggressive stop-sequence misconfig.
 *   - The metric is independent of session length, time-of-day, and
 *     model choice — it is a pure shape statistic on per-row output
 *     presence/absence.
 *
 * Distinct from every existing lens:
 *
 *   - `source-output-tokens-per-row-percentiles` reports percentile
 *     shape (p50/p90/p99) of the **non-empty** output distribution
 *     and treats zero rows as just "the smallest values". A source
 *     with 30% zero-output rows and a source with 0% zero-output
 *     rows can have identical p90/p99 if their non-zero tails are
 *     the same. zeroShare is a categorical count, not a quantile.
 *   - `source-cost-class-mix` projects rows onto small/med/large
 *     buckets by `total_tokens`. Zero-output rows usually fall in
 *     `small` but the `small` bucket is dominated by genuine
 *     small-but-non-empty turns; the two phenomena are not
 *     separable in that lens.
 *   - `source-input-token-top-row-share` is mass-concentration on
 *     the **input** column for **positive-input** rows; it has
 *     nothing to say about whether output was produced.
 *   - `source-cold-warm-row-ratio` partitions rows by
 *     `cached_input_tokens` (input-side cache state); orthogonal
 *     to output-presence.
 *
 * Per surviving source we compute:
 *
 *   - rows:              total kept rows for the source after window
 *                        + source filter.
 *   - zeroRows:          count of rows with `output_tokens == 0`
 *                        (treats non-finite or negative as 0).
 *   - zeroShare:         zeroRows / rows. In [0, 1].
 *   - zeroInputSum:      sum of `input_tokens` over zero-output rows
 *                        — the "wasted-input" volume.
 *   - totalInputSum:     sum of `input_tokens` over all kept rows.
 *   - zeroInputShare:    zeroInputSum / totalInputSum if
 *                        totalInputSum > 0, else 0. In [0, 1]. A
 *                        zeroShare of 0.30 with zeroInputShare of
 *                        0.05 means zero-output rows are common but
 *                        small; zeroShare 0.05 with zeroInputShare
 *                        0.40 means zero-output rows are rare but
 *                        each one carries a giant prompt — which is
 *                        the operationally expensive failure mode.
 *   - zeroOnly:          true iff every kept row has output == 0.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. Per-source: tally rows; for each row, treat output_tokens as
 *      0 if non-finite or negative, otherwise as the raw value;
 *      zero-row iff the resulting value === 0.
 *   4. Apply display gates `--min-rows` (default 3),
 *      `--min-zero-share` (default 0), `--min-zero-input-share`
 *      (default 0).
 *   5. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - rows == 0 is impossible by construction (a source only enters
 *     `perSource` if at least one row was tallied).
 *   - rows == 1 with zero-output -> zeroShare == 1, zeroOnly == true.
 *     Default `--min-rows 3` filters this out.
 *   - totalInputSum == 0 (every row had zero input): zeroInputShare
 *     reported as 0 by convention.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceZeroOutputRowShareOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows from the
   * per-source table. Display filter only — global denominators
   * reflect the full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer. Default 3
   * (a `zeroShare` over <3 samples is degenerate).
   */
  minRows?: number;
  /**
   * Drop sources whose `zeroShare` is strictly below this value.
   * Display filter only. Suppressed rows surface as
   * `droppedBelowMinZeroShare`. Must be in [0, 1]. Default 0 = no floor.
   */
  minZeroShare?: number;
  /**
   * Drop sources whose `zeroInputShare` is strictly below this value.
   * Display filter only. Suppressed rows surface as
   * `droppedBelowMinZeroInputShare`. Must be in [0, 1]. Default 0 =
   * no floor.
   */
  minZeroInputShare?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null
   * = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'zero-share' (default): zeroShare desc.
   *   - 'zero-input-share':     zeroInputShare desc.
   *   - 'zero-rows':            zeroRows desc.
   *   - 'rows':                 rows desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'zero-share' | 'zero-input-share' | 'zero-rows' | 'rows' | 'source';
  /**
   * If true, drop rows with `input_tokens == 0` before computing
   * `zeroShare`. The metric then reads "of rows that actually had
   * a prompt assembled, what fraction produced no output?" — which
   * isolates the aborted-after-prompt-shipped failure mode from
   * pure accounting artifacts (rows recorded with neither input nor
   * output tokens). When the flag is on, `rows` reports the count
   * of positive-input rows only; `excludedZeroInput` (per-source)
   * tallies how many rows were dropped under this gate. Default
   * false. Independent of every other gate.
   */
  excludeZeroInput?: boolean;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceZeroOutputRowShareRow {
  source: string;
  rows: number;
  zeroRows: number;
  zeroShare: number;
  zeroInputSum: number;
  totalInputSum: number;
  zeroInputShare: number;
  /** True iff every row had output == 0. */
  zeroOnly: boolean;
  /**
   * Count of rows with input_tokens == 0 that were excluded by
   * `excludeZeroInput`. Always 0 when the flag is off.
   */
  excludedZeroInput: number;
}

export interface SourceZeroOutputRowShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minZeroShare: number;
  minZeroInputShare: number;
  top: number | null;
  sort: 'zero-share' | 'zero-input-share' | 'zero-rows' | 'rows' | 'source';
  excludeZeroInput: boolean;
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of all kept rows across all sources. */
  totalRows: number;
  /** Sum of zero-output rows across all sources. */
  totalZeroRows: number;
  /** Sum of input_tokens over all kept rows. */
  totalInputTokens: number;
  /** Sum of input_tokens over all zero-output rows. */
  totalZeroInputTokens: number;
  /** Sum of rows excluded by `excludeZeroInput` across all sources. */
  totalExcludedZeroInput: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinZeroShare: number;
  droppedBelowMinZeroInputShare: number;
  droppedBelowTopCap: number;
  sources: SourceZeroOutputRowShareRow[];
}

export function buildSourceZeroOutputRowShare(
  queue: QueueLine[],
  opts: SourceZeroOutputRowShareOptions = {},
): SourceZeroOutputRowShareReport {
  const minRows = opts.minRows ?? 3;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minZeroShare = opts.minZeroShare ?? 0;
  if (
    !Number.isFinite(minZeroShare) ||
    minZeroShare < 0 ||
    minZeroShare > 1
  ) {
    throw new Error(
      `minZeroShare must be a finite number in [0, 1] (got ${opts.minZeroShare})`,
    );
  }
  const minZeroInputShare = opts.minZeroInputShare ?? 0;
  if (
    !Number.isFinite(minZeroInputShare) ||
    minZeroInputShare < 0 ||
    minZeroInputShare > 1
  ) {
    throw new Error(
      `minZeroInputShare must be a finite number in [0, 1] (got ${opts.minZeroInputShare})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'zero-share';
  const validSorts = [
    'zero-share',
    'zero-input-share',
    'zero-rows',
    'rows',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const excludeZeroInput = opts.excludeZeroInput ?? false;

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

  interface Bucket {
    rows: number;
    zeroRows: number;
    zeroInputSum: number;
    totalInputSum: number;
    excludedZeroInput: number;
  }
  const perSource = new Map<string, Bucket>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const outRaw = Number(q.output_tokens);
    const outTok = Number.isFinite(outRaw) && outRaw > 0 ? outRaw : 0;
    const inRaw = Number(q.input_tokens);
    const inTok = Number.isFinite(inRaw) && inRaw > 0 ? inRaw : 0;

    let b = perSource.get(source);
    if (!b) {
      b = {
        rows: 0,
        zeroRows: 0,
        zeroInputSum: 0,
        totalInputSum: 0,
        excludedZeroInput: 0,
      };
      perSource.set(source, b);
    }
    if (excludeZeroInput && inTok === 0) {
      b.excludedZeroInput += 1;
      continue;
    }
    b.rows += 1;
    b.totalInputSum += inTok;
    if (outTok === 0) {
      b.zeroRows += 1;
      b.zeroInputSum += inTok;
    }
  }

  const totalSources = perSource.size;
  let totalRows = 0;
  let totalZeroRows = 0;
  let totalInputTokens = 0;
  let totalZeroInputTokens = 0;
  let totalExcludedZeroInput = 0;
  const allRows: SourceZeroOutputRowShareRow[] = [];

  for (const [source, b] of perSource.entries()) {
    const zeroShare = b.rows > 0 ? b.zeroRows / b.rows : 0;
    const zeroInputShare =
      b.totalInputSum > 0 ? b.zeroInputSum / b.totalInputSum : 0;
    totalRows += b.rows;
    totalZeroRows += b.zeroRows;
    totalInputTokens += b.totalInputSum;
    totalZeroInputTokens += b.zeroInputSum;
    totalExcludedZeroInput += b.excludedZeroInput;
    allRows.push({
      source,
      rows: b.rows,
      zeroRows: b.zeroRows,
      zeroShare,
      zeroInputSum: b.zeroInputSum,
      totalInputSum: b.totalInputSum,
      zeroInputShare,
      zeroOnly: b.rows > 0 && b.zeroRows === b.rows,
      excludedZeroInput: b.excludedZeroInput,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinZeroShare = 0;
  let droppedBelowMinZeroInputShare = 0;
  const survived: SourceZeroOutputRowShareRow[] = [];
  for (const row of allRows) {
    if (row.rows < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.zeroShare < minZeroShare) {
      droppedBelowMinZeroShare += 1;
      continue;
    }
    if (row.zeroInputShare < minZeroInputShare) {
      droppedBelowMinZeroInputShare += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'zero-share') primary = b.zeroShare - a.zeroShare;
    else if (sort === 'zero-input-share')
      primary = b.zeroInputShare - a.zeroInputShare;
    else if (sort === 'zero-rows') primary = b.zeroRows - a.zeroRows;
    else if (sort === 'rows') primary = b.rows - a.rows;
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
    minZeroShare,
    minZeroInputShare,
    top,
    sort,
    excludeZeroInput,
    totalSources,
    totalRows,
    totalZeroRows,
    totalInputTokens,
    totalZeroInputTokens,
    totalExcludedZeroInput,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinZeroShare,
    droppedBelowMinZeroInputShare,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
