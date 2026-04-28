/**
 * source-row-token-lehmer-11-mean: per-source **Lehmer mean of
 * order 11** (a.k.a. **L_11**) of `total_tokens` across the
 * source's queue rows.
 *
 * Definition. Given the per-source per-row non-negative
 * `total_tokens` samples `x_1, x_2, ..., x_n` with at least
 * one strictly positive row:
 *
 *     L_11 = ( sum_{i=1..n} x_i^11 ) / ( sum_{i=1..n} x_i^10 )
 *
 * Equivalently, L_11 is the `x_i^10`-weighted arithmetic mean
 * of `x_i` (each row weights itself by its own *tenth power*),
 * so L_11 = sum(x*x^10) / sum(x^10) = E_w[x] with weights
 * w_i = x_i^10 / sum(x_j^10).
 *
 * Headline question: **for each source, what is the Lehmer
 * mean of order 11 of the per-row token distribution — the
 * size-tenth-power-weighted central tendency that, by the
 * Lehmer-monotonicity inequality, sits strictly above
 * L_10 (v0.6.199) and therefore extends the integer Lehmer
 * ladder one further step to the right:
 * `L_-3 <= ... <= AM <= ... <= L_8 <= L_9 <= L_10 <= L_11`?**
 *
 * Properties.
 *
 *   - **Above-L_10 upper bound** (Lehmer monotonicity). For
 *     any non-negative sample with at least one strictly
 *     positive row, `L_10 <= L_11`, with equality iff every
 *     positive row is equal.
 *   - **Lehmer mean of order 11**. The general Lehmer mean
 *     `L_p(x) = sum(x^p) / sum(x^{p-1})` is monotone
 *     non-decreasing in `p` for non-negative samples.
 *   - **Strictly non-negative**: L_11 >= 0 for any
 *     non-negative sample with sum(x^10) > 0; L_11 = 0 iff
 *     every row is 0.
 *   - **Bounded by `[L_10, max]`** (when every row is
 *     non-negative): `L_10 <= L_11 <= max`, with `L_11 = L_10`
 *     iff every positive row is equal and `L_11 = max` iff
 *     every positive row equals `max`.
 *   - **Scale-equivariant** (multiplicative): rescaling every
 *     row by `c >= 0` rescales L_11 by `c`.
 *   - **NOT translation-equivariant**.
 *   - **Order-invariant**: depends only on the multiset of
 *     row values.
 *   - **Identity on a constant positive series**: if all rows
 *     equal `c > 0`, then L_11 = c.
 *   - **Self-tenth-power-weighted-mean interpretation**:
 *     L_11 is the arithmetic mean of `x_i` weighted by
 *     `x_i^10`. Even more aggressively size-biased than L_10.
 *
 * Three free byproducts: `l11L10Gap = L_11 - L_10`,
 * `l11L9Gap = L_11 - L_9`, `l11AmGap = L_11 - mean`. All
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
 *   7. Drop sources whose entire `sum(x^10) == 0` (all-zero
 *      series — denominator vanishes; surface as
 *      `droppedAllZeroSources`).
 *   8. Compute `sum11`, `sum10`, `sum9`, `sumX`, then
 *      `mean = sumX / n`,
 *      `lehmer9Mean = sum9 / sum8`,
 *      `lehmer10Mean = sum10 / sum9`,
 *      `lehmer11Mean = sum11 / sum10`,
 *      `l11L10Gap = L_11 - L_10` (always >= 0),
 *      `l11L9Gap = L_11 - L_9` (always >= 0),
 *      `l11AmGap = L_11 - mean` (always >= 0).
 *   9. Apply display gates: `--min-rows`, `--min-lehmer-11-mean`.
 *  10. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenLehmer11MeanOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minRows?: number;
  minLehmer11Mean?: number;
  top?: number | null;
  sort?:
    | 'lehmer-11-mean-desc'
    | 'lehmer-11-mean-asc'
    | 'mean-desc'
    | 'l10-gap-desc'
    | 'l9-gap-desc'
    | 'am-gap-desc'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenLehmer11MeanRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of all `rowsKept` non-negative rows. */
  mean: number;
  /** Lehmer mean of order 9 = sum(x^9) / sum(x^8). */
  lehmer9Mean: number;
  /** Lehmer mean of order 10 = sum(x^10) / sum(x^9). */
  lehmer10Mean: number;
  /** Lehmer mean of order 11 = sum(x^11) / sum(x^10). */
  lehmer11Mean: number;
  /** L_11 - L_10. Always >= 0 by Lehmer monotonicity. */
  l11L10Gap: number;
  /** L_11 - L_9. Always >= 0 by Lehmer monotonicity. */
  l11L9Gap: number;
  /** L_11 - mean. Always >= 0 by Lehmer monotonicity. */
  l11AmGap: number;
}

export interface SourceRowTokenLehmer11MeanReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minLehmer11Mean: number;
  top: number | null;
  sort:
    | 'lehmer-11-mean-desc'
    | 'lehmer-11-mean-asc'
    | 'mean-desc'
    | 'l10-gap-desc'
    | 'l9-gap-desc'
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
  droppedBelowMinLehmer11Mean: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLehmer11MeanRow[];
}

const ABSOLUTE_MIN_ROWS = 1;

const VALID_SORTS = [
  'lehmer-11-mean-desc',
  'lehmer-11-mean-asc',
  'mean-desc',
  'l10-gap-desc',
  'l9-gap-desc',
  'am-gap-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenLehmer11Mean(
  queue: QueueLine[],
  opts: SourceRowTokenLehmer11MeanOptions = {},
): SourceRowTokenLehmer11MeanReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minLehmer11Mean = opts.minLehmer11Mean ?? 0;
  if (!Number.isFinite(minLehmer11Mean) || minLehmer11Mean < 0) {
    throw new Error(
      `minLehmer11Mean must be a finite, non-negative number (got ${opts.minLehmer11Mean})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lehmer-11-mean-desc';
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
  const allRows: SourceRowTokenLehmer11MeanRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAllZeroSources = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum11 = 0;
    let sum10 = 0;
    let sum9 = 0;
    let sum8 = 0;
    let sumX = 0;
    for (let i = 0; i < n; i += 1) {
      const v = samples[i]!;
      const v2 = v * v;
      const v4 = v2 * v2;
      const v8 = v4 * v4;
      const v9 = v8 * v;
      const v10 = v9 * v;
      const v11 = v10 * v;
      sum11 += v11;
      sum10 += v10;
      sum9 += v9;
      sum8 += v8;
      sumX += v;
    }
    if (sum10 === 0) {
      droppedAllZeroSources += 1;
      continue;
    }
    const mean = sumX / n;
    // sum8, sum9 are zero only if every value is zero,
    // already caught by sum10 === 0 above.
    const lehmer9Mean = sum9 / sum8;
    const lehmer10Mean = sum10 / sum9;
    const lehmer11Mean = sum11 / sum10;
    const l11L10Gap = lehmer11Mean - lehmer10Mean;
    const l11L9Gap = lehmer11Mean - lehmer9Mean;
    const l11AmGap = lehmer11Mean - mean;

    allRows.push({
      source,
      rowsKept: n,
      mean,
      lehmer9Mean,
      lehmer10Mean,
      lehmer11Mean,
      l11L10Gap,
      l11L9Gap,
      l11AmGap,
    });
  }

  let droppedBelowMinLehmer11Mean = 0;
  const survived: SourceRowTokenLehmer11MeanRow[] = [];
  for (const row of allRows) {
    if (minLehmer11Mean > 0 && row.lehmer11Mean < minLehmer11Mean) {
      droppedBelowMinLehmer11Mean += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'lehmer-11-mean-desc')
      primary = b.lehmer11Mean - a.lehmer11Mean;
    else if (sort === 'lehmer-11-mean-asc')
      primary = a.lehmer11Mean - b.lehmer11Mean;
    else if (sort === 'mean-desc') primary = b.mean - a.mean;
    else if (sort === 'l10-gap-desc') primary = b.l11L10Gap - a.l11L10Gap;
    else if (sort === 'l9-gap-desc') primary = b.l11L9Gap - a.l11L9Gap;
    else if (sort === 'am-gap-desc') primary = b.l11AmGap - a.l11AmGap;
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
    minLehmer11Mean,
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
    droppedBelowMinLehmer11Mean,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
