/**
 * source-row-token-lehmer-12-mean: per-source **Lehmer mean of
 * order 12** (a.k.a. **L_12**) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least
 * one strictly positive row:
 *
 *     L_12 = ( sum_{i=1..n} x_i^12 ) / ( sum_{i=1..n} x_i^11 )
 *
 * Equivalently, L_12 is the `x_i^11`-weighted arithmetic mean
 * of `x_i` (each row weights itself by its own *eleventh power*),
 * so L_12 = sum(x*x^11) / sum(x^11) = E_w[x] with weights
 * w_i = x_i^11 / sum(x_j^11).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order 12 of the per-row token distribution — the
 * size-eleventh-power-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly above
 * L_11 (v0.6.200) and therefore extends the integer Lehmer
 * ladder one further step to the right:
 * `L_-3 <= ... <= AM <= ... <= L_9 <= L_10 <= L_11 <= L_12`?**
 *
 * Properties.
 *
 *   - **Above-L_11 upper bound** (Lehmer monotonicity). For
 *     any non-negative sample with at least one strictly
 *     positive row, `L_11 <= L_12`, with equality iff every
 *     positive row is equal.
 *   - **Lehmer mean of order 12**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` is monotone
 *     non-decreasing in `p` for non-negative samples.
 *   - **Strictly non-negative**: L_12 >= 0 for any
 *     non-negative sample with sum(x^11) > 0; L_12 = 0 iff
 *     every row is 0.
 *   - **Bounded by `[L_11, max]`** (when every row is
 *     non-negative): `L_11 <= L_12 <= max`, with `L_12 = L_11`
 *     iff every positive row is equal and `L_12 = max` iff
 *     every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling every
 *     row by `c >= 0` rescales L_12 by `c`.
 *   - **NOT translation-equivariant**.
 *   - **Order-invariant**: depends only on the multiset of
 *     row values.
 *   - **Identity on a constant positive series**: if all rows
 *     equal `c > 0`, then L_12 = c.
 *   - **Self-eleventh-power-weighted-mean interpretation**:
 *     L_12 is the arithmetic mean of `x_i` weighted by
 *     `x_i^11`. Even more aggressively size-biased than L_11.
 *
 * Three free byproducts: `l12L11Gap = L_12 - L_11`,
 * `l12L10Gap = L_12 - L_10`, `l12AmGap = L_12 - mean`. All
 * `>= 0` by Lehmer monotonicity, all `0` iff the positive
 * part of the series is constant.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 1).
 *   7. Drop sources whose entire `sum(x^11) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources`).
 *   8. Compute `sum12`, `sum11`, `sum10`, `sum9`, `sumX`, then
 *      `mean = sumX / n`,
 *      `lehmer10Mean = sum10 / sum9`,
 *      `lehmer11Mean = sum11 / sum10`,
 *      `lehmer12Mean = sum12 / sum11`,
 *      `l12L11Gap = L_12 - L_11` (always >= 0),
 *      `l12L10Gap = L_12 - L_10` (always >= 0),
 *      `l12AmGap = L_12 - mean` (always >= 0).
 *   9. Apply display gates: `--min-rows`, `--min-lehmer-12-mean`.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmer12MeanOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  minLehmer12Mean?: number;
  top?: number | null;
  sort?:
    | 'lehmer-12-mean-desc'
    | 'lehmer-12-mean-asc'
    | 'mean-desc'
    | 'l11-gap-desc'
    | 'l10-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenLehmer12MeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Lehmer mean of order 10 = sum(x^10) / sum(x^9). */
  lehmer10Mean: number;
  /** Lehmer mean of order 11 = sum(x^11) / sum(x^10). */
  lehmer11Mean: number;
  /** Lehmer mean of order 12 = sum(x^12) / sum(x^11). */
  lehmer12Mean: number;
  /** L_12 - L_11. Always >= 0 by Lehmer monotonicity. */
  l12L11Gap: number;
  /** L_12 - L_10. Always >= 0 by Lehmer monotonicity. */
  l12L10Gap: number;
  /** L_12 - mean. Always >= 0 by Lehmer monotonicity. */
  l12AmGap: number;
}

export interface SourceRowTokenLehmer12MeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmer12Mean: number;
  top: number | null;
  sort:
    | 'lehmer-12-mean-desc'
    | 'lehmer-12-mean-asc'
    | 'mean-desc'
    | 'l11-gap-desc'
    | 'l10-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAllZeroSources: number;
  droppedBelowMinLehmer12Mean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmer12MeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-12-mean-desc',
  'lehmer-12-mean-asc',
  'mean-desc',
  'l11-gap-desc',
  'l10-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmer12Mean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmer12MeanOptions = {},
): SourceRowTokenLehmer12MeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmer12Mean = opts.minLehmer12Mean ?? 0;
  if (!Number.isFinite(minLehmer12Mean) || minLehmer12Mean < 0) {
    throw new Error(
      `minLehmer12Mean must be a finite, non-negative number (got ${opts.minLehmer12Mean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-12-mean-desc';
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
  const allRows: SourceRowTokenLehmer12MeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum12 = 0;
    let sum11 = 0;
    let sum10 = 0;
    let sum9 = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const v2 = v * v;
      const v4 = v2 * v2;
      const v8 = v4 * v4;
      const v9 = v8 * v;
      const v10 = v9 * v;
      const v11 = v10 * v;
      const v12 = v11 * v;
      sum12 += v12;
      sum11 += v11;
      sum10 += v10;
      sum9 += v9;
      sumX += v;
    }
    if (sum11 === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    // sum9, sum10 are zero only if every value is zero,
    // already caught by sum11 === 0 above.
    const lehmer10Mean = sum10 / sum9;
    const lehmer11Mean = sum11 / sum10;
    const lehmer12Mean = sum12 / sum11;
    const l12L11Gap = lehmer12Mean - lehmer11Mean;
    const l12L10Gap = lehmer12Mean - lehmer10Mean;
    const l12AmGap = lehmer12Mean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      lehmer10Mean,
      lehmer11Mean,
      lehmer12Mean,
      l12L11Gap,
      l12L10Gap,
      l12AmGap,
    });
  }

  let droppedBelowMinLehmer12Mean = 0;
  const survived: SourceRowTokenLehmer12MeanRow[] = [];
  for (const row of allRows) {
    if (minLehmer12Mean > 0 && row.lehmer12Mean < minLehmer12Mean) {
      droppedBelowMinLehmer12Mean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-12-mean-desc')
      primary = b.lehmer12Mean - a.lehmer12Mean;
    else if (sort === 'lehmer-12-mean-asc')
      primary = a.lehmer12Mean - b.lehmer12Mean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'l11-gap-desc') primary = b.l12L11Gap - a.l12L11Gap;
    else if (sort === 'l10-gap-desc') primary = b.l12L10Gap - a.l12L10Gap;
    else if (sort === 'am-gap-desc') primary = b.l12AmGap - a.l12AmGap;
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
    minLehmer12Mean,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAllZeroSources,
    droppedBelowMinLehmer12Mean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
