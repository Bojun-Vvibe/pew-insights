/**
 * source-row-token-lempel-ziv: per-source **Lempel-Ziv (LZ76)
 * symbolic complexity** of the per-row `total_tokens`
 * time-ordered sequence after a per-source median-binarisation.
 *
 * Headline question: **for each source, how algorithmically
 * compressible is the binary symbol sequence obtained by marking
 * each row 1 if its `total_tokens` is strictly above the
 * per-source median, else 0?** A perfectly periodic 0101... has
 * very few distinct LZ factors -> low complexity. A
 * Bernoulli(0.5) i.i.d. binary source has the maximum number
 * of distinct factors -> normalised LZ approaches 1. The metric
 * tracks **algorithmic / sequence-pattern repetition** in a way
 * that none of the existing `source-row-token-*` lenses do.
 *
 * Construction (Lempel & Ziv 1976, "On the Complexity of Finite
 * Sequences", IEEE Trans. IT, 22(1):75-81):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      so the test sees the actual temporal sequence v[0..N-1].
 *   4. Skip the source if `n < minRows` (default 8). Surfaces
 *      under `droppedBelowMinRows`.
 *   5. Compute the per-source **median** of v. Binarise:
 *        s[i] = 1 if v[i] > median, else 0.
 *      We use **strict greater-than** so that a constant series
 *      -> all zeros and immediately fails the tie gate below.
 *   6. Tie / degeneracy gate: if all bits are equal (i.e. the
 *      series has fewer than 2 distinct symbols once binarised),
 *      LZ complexity collapses to 1 trivially and the lens has
 *      nothing to say. Surfaces under `droppedConstantBitstream`.
 *   7. **LZ76 parse** of the binary string `s`:
 *        - Walk a pointer `i` from 0 to N-1.
 *        - At each step, find the longest prefix `s[i..i+L-1]`
 *          that already appears as a contiguous substring of the
 *          already-parsed prefix `s[0..i-1]`. Standard LZ76
 *          (a.k.a. "exhaustive" production complexity) counts a
 *          new factor as `s[i..i+L]` (one symbol past the longest
 *          reproducible prefix), then advances `i` by `L + 1`.
 *        - The very first symbol always starts factor 1.
 *        - Final partial factor at the right edge counts as a
 *          full factor.
 *      The total number of factors is `c(N)`, the LZ76 complexity.
 *   8. Normalise (Lempel-Ziv's own asymptotic upper bound for a
 *      length-N binary sequence):
 *        b(N) = N / log2(N)        (with N >= 2)
 *      Report:
 *        lz = c(N)
 *        lzNorm = c(N) / b(N) = c(N) * log2(N) / N
 *      For an i.i.d. fair coin, `lzNorm -> 1` as `N -> infinity`.
 *      For a periodic / highly repetitive series, `lzNorm` is
 *      well below 1.
 *
 * Reading lzNorm:
 *   - lzNorm ~ 0.0-0.3: highly repetitive / near-periodic
 *     binary skeleton (e.g. long runs above and below median).
 *   - lzNorm ~ 0.5-0.8: mixed regime with some structure.
 *   - lzNorm ~ 0.9+: binary skeleton looks essentially
 *     unpredictable / Bernoulli-like.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-permutation-entropy` (PE): PE is an
 *     **ordinal** entropy over length-`m` rank patterns. LZ76
 *     here is a **sequence-factor** count over a binary
 *     symbolisation. PE on a strictly monotone series saturates
 *     to a single pattern (entropy ~ 0); LZ on the same series
 *     binarises to `0...01...1` which has only `O(log N)`
 *     distinct factors, also low — but PE on a *periodic*
 *     up-down-up-down series gives the full m! patterns one by
 *     one whereas LZ gives a tiny constant. The two disagree
 *     systematically on periodic vs. monotone signals.
 *   - `source-row-token-sample-entropy` (SampEn): a
 *     **single-scale conditional irregularity** of m-windows
 *     under a tolerance r on the **raw values**. LZ76 here is
 *     **binarised** and **multi-length** (factors of all
 *     lengths). A series with strong mean drift but
 *     constant-shape templates can have low SampEn (templates
 *     repeat) yet high LZ (binary symbolisation around the
 *     drifting median is irregular).
 *   - `source-row-token-runs-test` / `-turning-point-count`:
 *     count specific event types (sign-runs, local extrema)
 *     and test against an expected null. LZ76 counts the
 *     **diversity of sub-strings** the series produces, which
 *     can grow fast even when the runs / turning-point counts
 *     are at their expected values.
 *   - `source-row-token-mann-kendall-trend`: directional
 *     monotone-trend test. A pure monotone trend collapses LZ
 *     to its minimum because the binary skeleton is
 *     `0...01...1` with O(log N) factors. So MK and LZ are
 *     **anti-correlated** on monotone signals but uncorrelated
 *     in general — they probe different things.
 *   - `source-row-token-autocorrelation-lag1`: linear, lag-1,
 *     parametric, value-domain. LZ76 is non-linear, multi-lag,
 *     non-parametric, symbol-domain.
 *   - `source-row-token-hurst-rs` / `-higuchi-fd`: scaling
 *     exponents on the **value** sequence (R/S of cumulative
 *     deviations; arc-length scaling under sub-sampling). LZ76
 *     ignores magnitudes entirely after binarisation; it
 *     measures **symbol-sequence richness**, not power-law
 *     scaling.
 *   - All order-invariant dispersion / shape lenses
 *     (-iqr-ratio, -mad, -skewness, -kurtosis, -gini,
 *     -burstiness-coefficient, -coefficient-of-variation):
 *     shuffling the sequence is invariant for them. Shuffling
 *     also leaves the per-source **median** invariant, so the
 *     binarised symbol multiset is invariant — but the
 *     **order** of those symbols is destroyed, so LZ76 typically
 *     **changes** under shuffle. LZ is therefore an honest
 *     order-sensitive complement.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All bits equal (constant series, or every value below or
 *     above the median due to ties): surfaces under
 *     `droppedConstantBitstream`.
 *   - For N = 1, log2(N) = 0 and `lzNorm` would be undefined;
 *     this is already excluded by `minRows >= 2`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenLempelZivSort =
  | 'lz-asc'
  | 'lz-desc'
  | 'lznorm-asc'
  | 'lznorm-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenLempelZivOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer >= 2. Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'lznorm-asc' (default): normalised LZ ascending (most
   *     repetitive first).
   *   - 'lznorm-desc':           normalised LZ descending (most
   *     unpredictable first).
   *   - 'lz-asc' / 'lz-desc':    raw factor count.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenLempelZivSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenLempelZivRow {
  source: string;
  rowsKept: number;
  /** Per-source median used for binarisation. */
  median: number;
  /** Count of bits == 1 in the binarised stream. */
  onesCount: number;
  /** Count of bits == 0 in the binarised stream. */
  zerosCount: number;
  /** Raw LZ76 factor count c(N). */
  lz: number;
  /**
   * Normalised LZ: c(N) * log2(N) / N. In (0, ~1] for non-degenerate
   * binary streams; 1.0 is the i.i.d. fair-coin asymptote.
   */
  lzNorm: number;
}

export interface SourceRowTokenLempelZivReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenLempelZivSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantBitstream: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenLempelZivRow[];
}

const VALID_SORTS = [
  'lz-asc',
  'lz-desc',
  'lznorm-asc',
  'lznorm-desc',
  'rows',
  'source',
] as const;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * LZ76 "exhaustive" production complexity on a binary string
 * encoded as a Uint8Array of 0/1 bytes. Returns the number of
 * factors c(N).
 */
function lz76Factors(bits: Uint8Array): number {
  const N = bits.length;
  if (N === 0) return 0;
  if (N === 1) return 1;

  let c = 1; // first symbol = factor 1
  let i = 1;
  while (i < N) {
    // Find longest L >= 1 such that bits[i..i+L-1] occurs as a
    // contiguous substring of bits[0..i-1]. Then emit a factor
    // covering bits[i..i+L] (inclusive of the next symbol),
    // and advance i by L + 1. If i + L == N, the partial
    // already at the right edge still counts as a full factor.
    let L = 0;
    while (i + L < N) {
      const candLen = L + 1;
      // search bits[i..i+candLen-1] in bits[0..i-1]
      let found = false;
      const limit = i - candLen; // last possible start
      if (limit >= 0) {
        outer: for (let s = 0; s <= limit; s++) {
          for (let k = 0; k < candLen; k++) {
            if (bits[s + k] !== bits[i + k]) continue outer;
          }
          found = true;
          break;
        }
      }
      if (found) {
        L = candLen;
      } else {
        break;
      }
    }
    // Emit factor of length L + 1 (covers the "innovation" symbol
    // at position i + L). Advance.
    c += 1;
    i += L + 1;
  }
  return c;
}

export function buildSourceRowTokenLempelZiv(
  queue: QueueLine[],
  opts: SourceRowTokenLempelZivOptions = {},
): SourceRowTokenLempelZivReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 2) {
    throw new Error(`minRows must be an integer >= 2 (got ${opts.minRows})`);
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'lznorm-asc';
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

    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let arr = perSource.get(src);
    if (!arr) {
      arr = [];
      perSource.set(src, arr);
    }
    arr.push([ms, tt]);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedBelowMinRows = 0;
  let droppedConstantBitstream = 0;

  const allRows: SourceRowTokenLempelZivRow[] = [];

  for (const [src, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    samples.sort((a, b) => a[0] - b[0]);
    const N = samples.length;
    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    const v = samples.map((s) => s[1]);

    const sortedV = [...v].sort((a, b) => a - b);
    const med = median(sortedV);

    const bits = new Uint8Array(N);
    let ones = 0;
    for (let i = 0; i < N; i++) {
      if (v[i]! > med) {
        bits[i] = 1;
        ones += 1;
      } else {
        bits[i] = 0;
      }
    }
    const zeros = N - ones;
    if (ones === 0 || zeros === 0) {
      droppedConstantBitstream += 1;
      continue;
    }

    const lz = lz76Factors(bits);
    const lzNorm = (lz * Math.log2(N)) / N;

    allRows.push({
      source: src,
      rowsKept: N,
      median: med,
      onesCount: ones,
      zerosCount: zeros,
      lz,
      lzNorm,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'lz-asc') primary = a.lz - b.lz;
    else if (sort === 'lz-desc') primary = b.lz - a.lz;
    else if (sort === 'lznorm-asc') primary = a.lzNorm - b.lzNorm;
    else if (sort === 'lznorm-desc') primary = b.lzNorm - a.lzNorm;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    droppedConstantBitstream,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
