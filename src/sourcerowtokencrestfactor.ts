/**
 * source-row-token-crest-factor: per-source **crest factor**
 * (peak-to-RMS ratio) of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how peaky is the
 * per-row token sequence relative to its bulk energy?**
 *
 * Crest factor `C = peak / rms`, where:
 *   - peak = max_i |x_i| (here x_i >= 0, so just max x_i)
 *   - rms  = sqrt( (1/n) * sum_i x_i^2 )
 *
 * This is a classic peakiness measure from signal processing
 * (sine wave: C = sqrt(2) ~= 1.4142; square wave: C = 1; pure
 * impulse-in-noise: C grows arbitrarily large with the
 * impulse). Operationally on token streams: low C means a
 * source is "always producing similar-sized rows", high C
 * means a source has occasional outsized blowouts dominating
 * an otherwise quiet baseline.
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      (sort is not strictly required for C, but matches the
 *      conventions of the rest of the source-row-token-* suite
 *      and makes debugging via JSON dumps deterministic).
 *   4. Skip if `n < minRows` (default 4; crest factor is
 *      meaningless on a single sample).
 *   5. Compute peak = max x_i and rms = sqrt(mean(x_i^2)).
 *      crestFactor = peak / rms.
 *      If rms == 0 (all-zero series), drop under
 *      `droppedZeroRms` (peak/0 = NaN/Inf; we surface the
 *      structural fact rather than emit non-finite).
 *
 * Theoretical bounds:
 *   - C >= 1 always (peak is at least RMS for any series with
 *     a finite max).
 *   - C <= sqrt(n) always (achieved by a single non-zero
 *     sample among n-1 zeros). We surface `crestFactorMax`
 *     = sqrt(n) per row so operators can read C in absolute
 *     terms ("how close to maximally peaky is this source?")
 *     and as a normalised `crestFactorNorm = (C - 1) /
 *     (sqrt(n) - 1)` in [0, 1] for cross-source comparison
 *     when n differs across sources.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * source-row-token-* lens already in the suite:
 *
 *   - vs. **coefficient-of-variation (cv = sigma/mean)**: cv
 *     is variance-based and centered. C is peak-based and
 *     uncentered (uses raw moments). A series with one giant
 *     spike and many small-but-nonzero values can have
 *     identical sigma to a series with two medium spikes,
 *     yet very different peak/rms.
 *   - vs. **mad / iqr-ratio / gini / kurtosis / skewness**:
 *     all are distributional shape moments. C is a
 *     deterministic ratio of two specific scalars (max,
 *     L2-norm/sqrt(n)) and is dominated by the single
 *     extremal sample.
 *   - vs. **burstiness-coefficient (B = (sigma-mu)/(sigma+mu))**:
 *     B saturates at +1 for very bursty and -1 for very
 *     regular; bounded. C is unbounded above and floors at 1.
 *   - vs. **TKEO / hjorth / autocorrelation / ZCR / runs-test
 *     / turning-point / mann-kendall**: all use temporal
 *     structure (consecutive samples). C is order-invariant —
 *     it is a property of the multiset of values.
 *   - vs. **entropy lenses (approximate / sample / permutation
 *     / renyi)**: information-theoretic / ordinal. C is a
 *     deterministic L^infinity-vs-L^2 ratio, not a functional
 *     of the empirical distribution beyond {max, sumOfSquares}.
 *   - vs. **fractal-dimension lenses (higuchi / katz /
 *     petrosian) / dfa / hurst**: geometric / scaling
 *     invariants of the path. C ignores path geometry
 *     entirely.
 *   - vs. **lempel-ziv**: factor-count over a binarised
 *     alphabet. C keeps full real-valued amplitude.
 *   - vs. **fano-factor (variance/mean)**: F is a 2nd-vs-1st
 *     moment ratio; C is an L^infinity-vs-L^2 ratio. F is
 *     unaffected by where the variance lives; C is dominated
 *     by the single largest sample.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `rms == 0` (all values zero): surfaces under
 *     `droppedZeroRms` (constant-zero series).
 *   - Non-finite computed quantity (defensive): surfaces
 *     under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenCrestFactorSort =
  | 'crest-asc'
  | 'crest-desc'
  | 'norm-asc'
  | 'norm-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenCrestFactorOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 2`. Default 4.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'crest-asc' (default): crestFactor ascending — least peaky first.
   *   - 'crest-desc':          crestFactor descending — most peaky first.
   *   - 'norm-asc':            crestFactorNorm ascending — least peaky
   *                            relative to its own n first. Useful
   *                            when source ns differ widely; norm
   *                            puts everyone on the same [0,1] scale.
   *   - 'norm-desc':           crestFactorNorm descending — most peaky
   *                            relative to its own n first.
   *   - 'rows':                rowsKept desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenCrestFactorSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenCrestFactorRow {
  source: string;
  rowsKept: number;
  /** max_i x_i. */
  peak: number;
  /** sqrt(mean(x_i^2)). */
  rms: number;
  /** peak / rms. >= 1 always. */
  crestFactor: number;
  /** sqrt(n); theoretical upper bound on crestFactor. */
  crestFactorMax: number;
  /**
   * (crestFactor - 1) / (crestFactorMax - 1), in [0, 1].
   * For n == 1 (impossible here since minRows >= 2) this
   * would be 0/0; we never reach that branch.
   */
  crestFactorNorm: number;
}

export interface SourceRowTokenCrestFactorReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenCrestFactorSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroRms: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenCrestFactorRow[];
}

const VALID_SORTS = [
  'crest-asc',
  'crest-desc',
  'norm-asc',
  'norm-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenCrestFactor(
  queue: QueueLine[],
  opts: SourceRowTokenCrestFactorOptions = {},
): SourceRowTokenCrestFactorReport {
  const minRows = opts.minRows ?? 4;
  if (!Number.isInteger(minRows) || minRows < 2) {
    throw new Error(
      `minRows must be an integer >= 2 (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'crest-asc';
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

  const perSource = new Map<string, Array<[number, number]>>();

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
    arr.push([ms, tt]);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedBelowMinRows = 0;
  let droppedZeroRms = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenCrestFactorRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = v[i]!;
      if (x > peak) peak = x;
      sumSq += x * x;
    }
    const rms = Math.sqrt(sumSq / n);

    if (rms === 0) {
      droppedZeroRms += 1;
      continue;
    }

    const crestFactor = peak / rms;
    const crestFactorMax = Math.sqrt(n);
    const crestFactorNorm =
      (crestFactor - 1) / (crestFactorMax - 1);

    if (
      !Number.isFinite(crestFactor) ||
      !Number.isFinite(crestFactorNorm)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      peak,
      rms,
      crestFactor,
      crestFactorMax,
      crestFactorNorm,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'crest-asc') {
      primary = a.crestFactor - b.crestFactor;
    } else if (sort === 'crest-desc') {
      primary = b.crestFactor - a.crestFactor;
    } else if (sort === 'norm-asc') {
      primary = a.crestFactorNorm - b.crestFactorNorm;
    } else if (sort === 'norm-desc') {
      primary = b.crestFactorNorm - a.crestFactorNorm;
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = allRows;
  if (top !== null && allRows.length > top) {
    droppedBelowTopCap = allRows.length - top;
    finalSources = allRows.slice(0, top);
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
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroRms,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
