/**
 * source-row-token-midhinge: per-source **Tukey midhinge** of
 * `total_tokens` across the source's queue rows.
 *
 * Definition. Given the per-source per-row `total_tokens`
 * samples, with type-7 quantiles `q1 = Q(0.25)` and
 * `q3 = Q(0.75)`, the Tukey midhinge (Tukey, 1977,
 * "Exploratory Data Analysis") is:
 *
 *     MH = (q1 + q3) / 2
 *
 * Headline question: **for each source, what is the central
 * point of the interquartile range — the location of the
 * middle 50 % of per-row token usage as a single scalar in
 * the same units as `total_tokens` — without any contribution
 * from the median or from anything outside [q1, q3]?**
 *
 * Properties.
 *
 *   - **Robust central tendency**, breakdown 25 %: a single
 *     arbitrarily-large row cannot move MH until at least
 *     25 % of rows are pushed past it. The mean has 0 %
 *     breakdown; the median has 50 % breakdown. MH has the
 *     same 25 %-breakdown as the trimean but is built solely
 *     on Q1 and Q3 — it gives the median weight 0, while the
 *     trimean gives the median weight 1/2.
 *   - **Lies in [q1, q3]** (always between the 25th and 75th
 *     percentiles) and is the exact midpoint of that interval:
 *     MH = q1 + (q3 - q1)/2 = q3 - (q3 - q1)/2. So for
 *     non-negative data, MH >= 0.
 *   - **Translation- and scale-equivariant**: shifting all
 *     rows by `c` shifts MH by `c`; rescaling by `c > 0`
 *     rescales MH by `c`. (Unlike CQD / Bowley which are
 *     scale-invariant — those measure shape, MH measures
 *     location.)
 *   - **Order-invariant**: MH depends only on the multiset
 *     of row values, not on row order.
 *   - **Identity on a constant series**: if all rows equal
 *     `c`, then q1 = q3 = c so MH = c. (Same as mean,
 *     median, and trimean.)
 *   - **Insensitive to the median**: two distributions that
 *     share q1 and q3 but have very different medians have
 *     identical midhinges. The signed gap
 *     `mhMedianGap = midhinge - median` reveals where the
 *     median sits inside its own IQR — positive means the
 *     median is in the lower half of [q1, q3] (long upper
 *     central half), zero means perfectly symmetric central
 *     half, negative means the median is in the upper half
 *     (long lower central half). Bounded by
 *     `[-(q3-q1)/2, +(q3-q1)/2]`.
 *   - **Always finite for any non-empty series**: no division,
 *     never undefined.
 *
 * Why this lens is genuinely orthogonal to every existing
 * `source-row-token-*` lens already in the suite:
 *
 *   - **Distinct from trimean** (the closest sibling): the
 *     trimean is `(q1 + 2*median + q3) / 4 = MH/2 + median/2`,
 *     i.e. trimean blends MH and median 50/50. Midhinge
 *     drops the median entirely. On any asymmetric
 *     distribution the trimean and midhinge disagree by
 *     exactly `(median - midhinge) / 2`. A source with
 *     median = 100, q1 = 50, q3 = 200 has midhinge 125 but
 *     trimean 112.5; midhinge surfaces the IQR center, trimean
 *     surfaces the IQR-and-median consensus.
 *   - **Distinct from the median**: midhinge equals the median
 *     only on distributions with a perfectly symmetric central
 *     half. Two sources with identical medians but different
 *     IQRs typically have different midhinges.
 *   - **Distinct from the mean**: the mean has 0 %-breakdown
 *     and is dominated by tail rows; midhinge ignores
 *     everything below q1 and above q3 and is a pure central-
 *     half location estimator.
 *   - **Distinct from CQD / Bowley / IQR-ratio**: those are
 *     all *shape* statistics built from the same q1/q3 (and
 *     median for Bowley). CQD = (q3-q1)/(q3+q1) is direction-
 *     blind dispersion in [0,1]; Bowley = ((q3-2q2+q1)/(q3-q1))
 *     is direction in [-1,+1]; IQR-ratio is dispersion / median.
 *     Midhinge is *location* in the same units as total_tokens.
 *   - **Distinct from MAD / coefficient-of-variation /
 *     burstiness / skewness / kurtosis / gini**: those are
 *     all spread or shape statistics, not central tendency.
 *   - **Distinct from source-output-tokens-per-row-percentiles**:
 *     that command exposes the raw P50/P75/P90/P99 of
 *     `output_tokens` (different field) without blending them
 *     into a single L-estimator.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown').
 *   6. Per source: skip if `n < minRows` (default 4 — need at least
 *      one observation per quartile slot for meaningful Q1/Q3).
 *   7. Sort ascending; compute Q1, median, Q3 with the type-7
 *      (linear-interpolation) quantile estimator. Compute
 *      `midhinge = (q1 + q3) / 2` and `mhMedianGap = midhinge - median`.
 *   8. Apply display gates:
 *      - `--min-rows`     (absolute floor 4)            -> droppedBelowMinRows.
 *      - `--min-midhinge` (cohort: only sources with
 *                          meaningful central magnitude;
 *                          finite, non-negative)        -> droppedBelowMinMidhinge.
 *   9. Sort, then optionally cap with `--top`.
 *
 * Edge cases and design notes:
 *
 *   - All-equal positive series (all rows == c): q1 = q3 = c;
 *     midhinge = c; mhMedianGap = 0.
 *   - All-zero series: q1 = q3 = 0; midhinge = 0;
 *     mhMedianGap = 0. (No degeneracy — midhinge is well-
 *     defined; the operator can spot all-zero sources by
 *     `midhinge == 0` paired with `q3 == 0`.)
 *   - At least 25 % zeros, q3 > 0: q1 = 0; midhinge = q3 / 2.
 *   - Symmetric central half (median == midhinge):
 *     mhMedianGap == 0 (additional invariant pinned in the
 *     property tests).
 *   - Negative total_tokens: dropped (same convention as
 *     trimean, iqr-ratio, bowley, cqd lenses).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenMidhingeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter.
   * Must be an integer >= 4 (one observation per quartile slot).
   * Default 4.
   */
  minRows?: number;
  /**
   * Drop sources whose midhinge is strictly below this value.
   * Cohort selector for "this source actually carries non-trivial
   * central token magnitude" — useful to hide low-volume noise
   * sources before ranking. Must be a finite, non-negative number.
   * Default 0.
   */
  minMidhinge?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'midhinge-desc' (default): midhinge desc (largest IQR-center magnitude first).
   *   - 'midhinge-asc':            midhinge asc.
   *   - 'median-desc':             median desc (compare with midhinge ranking).
   *   - 'gap-desc':                |mhMedianGap| desc (median furthest from IQR center first).
   *   - 'rows':                    rowsKept desc.
   *   - 'source':                  source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'midhinge-desc'
    | 'midhinge-asc'
    | 'median-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenMidhingeRow {
  source: string;
  rowsKept: number;
  q1: number;
  median: number;
  q3: number;
  /** Tukey midhinge (q1 + q3) / 2. */
  midhinge: number;
  /**
   * Signed gap midhinge - median. Positive means the median sits
   * in the lower half of [q1, q3] (upper central half longer);
   * negative means the median sits in the upper half (lower central
   * half longer); zero on any symmetric central half. Bounded by
   * [-(q3-q1)/2, +(q3-q1)/2].
   */
  mhMedianGap: number;
}

export interface SourceRowTokenMidhingeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMidhinge: number;
  top: number | null;
  sort:
    | 'midhinge-desc'
    | 'midhinge-asc'
    | 'median-desc'
    | 'gap-desc'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinMidhinge: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMidhingeRow[];
}

const ABSOLUTE_MIN_ROWS = 4;

const VALID_SORTS = [
  'midhinge-desc',
  'midhinge-asc',
  'median-desc',
  'gap-desc',
  'rows',
  'source',
] as const;

/**
 * Linear-interpolation (type-7) quantile of an already-sorted
 * ascending array `xs`. `p` in `[0, 1]`. Matches numpy.quantile's
 * default and R's `quantile(..., type = 7)`. Same helper as in
 * `sourcerowtokentrimean.ts` / `sourcerowtokenbowleyskewness.ts`
 * — duplicated here to keep this module self-contained (no
 * cross-lens import dependency).
 */
function quantileType7(xs: number[], p: number): number {
  const n = xs.length;
  if (n === 0) throw new Error('quantileType7: empty input');
  if (n === 1) return xs[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return xs[lo]!;
  return xs[lo]! + (h - lo) * (xs[hi]! - xs[lo]!);
}

export function buildSourceRowTokenMidhinge(
  queue: QueueLine[],
  opts: SourceRowTokenMidhingeOptions = {},
): SourceRowTokenMidhingeReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minMidhinge = opts.minMidhinge ?? 0;
  if (!Number.isFinite(minMidhinge) || minMidhinge < 0) {
    throw new Error(
      `minMidhinge must be a finite, non-negative number (got ${opts.minMidhinge})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'midhinge-desc';
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
  const allRows: SourceRowTokenMidhingeRow[] = [];
  let droppedBelowMinRows = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const q1 = quantileType7(sorted, 0.25);
    const median = quantileType7(sorted, 0.5);
    const q3 = quantileType7(sorted, 0.75);
    const midhinge = (q1 + q3) / 2;
    const mhMedianGap = midhinge - median;

    allRows.push({
      source,
      rowsKept: n,
      q1,
      median,
      q3,
      midhinge,
      mhMedianGap,
    });
  }

  let droppedBelowMinMidhinge = 0;
  const survived: SourceRowTokenMidhingeRow[] = [];
  for (const row of allRows) {
    if (minMidhinge > 0 && row.midhinge < minMidhinge) {
      droppedBelowMinMidhinge += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'midhinge-desc') primary = b.midhinge - a.midhinge;
    else if (sort === 'midhinge-asc') primary = a.midhinge - b.midhinge;
    else if (sort === 'median-desc') primary = b.median - a.median;
    else if (sort === 'gap-desc')
      primary = Math.abs(b.mhMedianGap) - Math.abs(a.mhMedianGap);
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
    minMidhinge,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinMidhinge,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
