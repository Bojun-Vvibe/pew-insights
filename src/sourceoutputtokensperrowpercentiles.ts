/**
 * source-output-tokens-per-row-percentiles: per-source distribution
 * of `output_tokens` **per individual queue row** (a "row" is one
 * `hour_start` bucket), reported as p50 / p90 / p99 plus mean and
 * max. Headline question: **for a given source, how fat is its
 * typical generation, and how heavy is its tail?**
 *
 * Why a separate subcommand:
 *
 *   - `output-size` reports the same shape statistics but groups by
 *     **model**, not by source. A single source (e.g. an editor
 *     assistant) routinely fans out across 3–5 models; pooling by
 *     model loses the per-source operational signal entirely.
 *   - `output-token-decile-distribution` is a **global** decile cut
 *     of every bucket row in the queue, with no per-source breakdown
 *     and no ability to compare two sources' tail thickness.
 *   - `source-output-token-benford-deviation` is a leading-digit
 *     fingerprint of the same column but discards magnitude — two
 *     sources with identical Benford fits can have wildly different
 *     p99 outputs.
 *   - `source-cost-class-mix` projects each row onto a small/med/large
 *     categorical based on `total_tokens` (input + output combined),
 *     so it cannot answer the output-only generation-shape question.
 *   - `source-io-ratio-stability` reports the per-day output/input
 *     ratio's CV — a *consistency* statistic, not a magnitude one.
 *     A source with a perfectly stable ratio of 0.5 can still have
 *     enormous tail rows in absolute output tokens.
 *
 * Concretely, for each surviving source we compute:
 *
 *   - rowsConsidered:  count of rows with output_tokens > 0 (rows
 *                      with output_tokens == 0 are still counted in
 *                      `rowsZeroOutput` but do not enter the
 *                      percentile sequence — a zero-output row is a
 *                      degenerate "no generation happened" event).
 *   - rowsZeroOutput:  count of rows with output_tokens == 0.
 *   - outputSum:       sum of output_tokens across rowsConsidered.
 *   - mean:            outputSum / rowsConsidered.
 *   - max:             max(output_tokens) across rowsConsidered.
 *   - p50, p90, p99:   linear-interpolation percentiles of the sorted
 *                      ascending output_tokens sequence (rank =
 *                      pct * (n - 1); two-point linear interpolation
 *                      between adjacent ranks). Standard "type-7"
 *                      definition.
 *   - p99OverP50:      tail-heaviness ratio. A purely flat source
 *                      gets 1.0; a source whose worst row is 100x
 *                      its median gets 100.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. Per-source: bucket every row's `output_tokens` (treated as 0
 *      if non-finite or negative). Rows with output == 0 increment
 *      `rowsZeroOutput`; rows with output > 0 enter the percentile
 *      sequence.
 *   4. Sort each source's positive sequence ascending; compute
 *      mean / max / p50 / p90 / p99 / p99OverP50.
 *   5. Apply display gates `--min-rows` (default 3) and
 *      `--min-p99` (default 0).
 *   6. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - rowsConsidered == 0  →  source dropped (no positive output
 *     tokens means no distribution to summarise). Surfaces as
 *     `droppedAllZero`.
 *   - rowsConsidered == 1  →  p50/p90/p99/max all equal that single
 *     value; mean equals it; p99OverP50 = 1. `singleSample = true`.
 *   - p50 == 0 (which can only happen if rowsConsidered == 0; the
 *     positive-only filter guarantees the median of a non-empty
 *     positive sequence is > 0): p99OverP50 = 0 by convention. The
 *     guard exists defensively so the divisor is never zero.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceOutputTokensPerRowPercentilesOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many positive-output rows from
   * the per-source table. Display filter only — global denominators
   * reflect the full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer. Default 3
   * (percentiles on <3 samples are not informative).
   */
  minRows?: number;
  /**
   * Drop sources whose `p99` is strictly below this value from the
   * per-source table. Display filter only. Suppressed rows surface
   * as `droppedBelowMinP99`. Must be a non-negative finite number.
   * Default 0 = no floor.
   */
  minP99?: number;
  /**
   * Drop sources whose `p99OverP50` (tail = p99 / p50) is strictly
   * below this value from the per-source table. Display filter only.
   * Suppressed rows surface as `droppedBelowMinTail`. Must be a
   * non-negative finite number. Default 0 = no floor.
   *
   * Useful for surfacing sources whose generation distribution is
   * bimodal/heavy-tailed (e.g. `--min-tail 5` keeps only sources
   * whose worst row is at least 5x their median). Sources flagged
   * as `flatLine`/all-equal automatically have tail = 1 and will be
   * suppressed by any `--min-tail > 1`.
   */
  minTail?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null
   * = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): outputSum desc.
   *   - 'p50':              p50 desc.
   *   - 'p90':              p90 desc.
   *   - 'p99':              p99 desc.
   *   - 'tail':             p99OverP50 desc (heaviest tail first).
   *   - 'rows':             rowsConsidered desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'p50' | 'p90' | 'p99' | 'tail' | 'rows' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceOutputTokensPerRowPercentilesRow {
  source: string;
  rowsConsidered: number;
  rowsZeroOutput: number;
  outputSum: number;
  mean: number;
  max: number;
  p50: number;
  p90: number;
  p99: number;
  /** p99 / p50, with 0 by convention if p50 == 0 (defensive guard). */
  p99OverP50: number;
  /** True iff rowsConsidered === 1. */
  singleSample: boolean;
}

export interface SourceOutputTokensPerRowPercentilesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minP99: number;
  minTail: number;
  top: number | null;
  sort: 'tokens' | 'p50' | 'p90' | 'p99' | 'tail' | 'rows' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of output_tokens across all kept positive-output rows. */
  totalOutputTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  /** Sources whose every kept row had output_tokens == 0. */
  droppedAllZero: number;
  droppedBelowMinRows: number;
  droppedBelowMinP99: number;
  droppedBelowMinTail: number;
  droppedBelowTopCap: number;
  sources: SourceOutputTokensPerRowPercentilesRow[];
}

/** Type-7 (linear interpolation) percentile on an ascending-sorted array. */
function percentile(sorted: number[], pct: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0]!;
  const rank = pct * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export function buildSourceOutputTokensPerRowPercentiles(
  queue: QueueLine[],
  opts: SourceOutputTokensPerRowPercentilesOptions = {},
): SourceOutputTokensPerRowPercentilesReport {
  const minRows = opts.minRows ?? 3;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minP99 = opts.minP99 ?? 0;
  if (!Number.isFinite(minP99) || minP99 < 0) {
    throw new Error(
      `minP99 must be a non-negative finite number (got ${opts.minP99})`,
    );
  }
  const minTail = opts.minTail ?? 0;
  if (!Number.isFinite(minTail) || minTail < 0) {
    throw new Error(
      `minTail must be a non-negative finite number (got ${opts.minTail})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tokens';
  const validSorts = ['tokens', 'p50', 'p90', 'p99', 'tail', 'rows', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
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

  interface Bucket {
    positives: number[];
    zeros: number;
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
    const out = Number.isFinite(outRaw) && outRaw > 0 ? outRaw : 0;

    let b = perSource.get(source);
    if (!b) {
      b = { positives: [], zeros: 0 };
      perSource.set(source, b);
    }
    if (out === 0) {
      b.zeros += 1;
    } else {
      b.positives.push(out);
    }
  }

  const totalSources = perSource.size;
  let droppedAllZero = 0;
  let totalOutputTokens = 0;
  const allRows: SourceOutputTokensPerRowPercentilesRow[] = [];

  for (const [source, b] of perSource.entries()) {
    if (b.positives.length === 0) {
      droppedAllZero += 1;
      continue;
    }
    b.positives.sort((a, c) => a - c);
    let sum = 0;
    for (const v of b.positives) sum += v;
    const n = b.positives.length;
    const mean = sum / n;
    const max = b.positives[n - 1]!;
    const p50 = percentile(b.positives, 0.5);
    const p90 = percentile(b.positives, 0.9);
    const p99 = percentile(b.positives, 0.99);
    const p99OverP50 = p50 > 0 ? p99 / p50 : 0;
    totalOutputTokens += sum;
    allRows.push({
      source,
      rowsConsidered: n,
      rowsZeroOutput: b.zeros,
      outputSum: sum,
      mean,
      max,
      p50,
      p90,
      p99,
      p99OverP50,
      singleSample: n === 1,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinP99 = 0;
  let droppedBelowMinTail = 0;
  const survived: SourceOutputTokensPerRowPercentilesRow[] = [];
  for (const row of allRows) {
    if (row.rowsConsidered < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.p99 < minP99) {
      droppedBelowMinP99 += 1;
      continue;
    }
    if (row.p99OverP50 < minTail) {
      droppedBelowMinTail += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.outputSum - a.outputSum;
    else if (sort === 'p50') primary = b.p50 - a.p50;
    else if (sort === 'p90') primary = b.p90 - a.p90;
    else if (sort === 'p99') primary = b.p99 - a.p99;
    else if (sort === 'tail') primary = b.p99OverP50 - a.p99OverP50;
    else if (sort === 'rows') primary = b.rowsConsidered - a.rowsConsidered;
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
    minP99,
    minTail,
    top,
    sort,
    totalSources,
    totalOutputTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedAllZero,
    droppedBelowMinRows,
    droppedBelowMinP99,
    droppedBelowMinTail,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
