/**
 * source-row-token-renyi-entropy: per-source **Rényi entropy at
 * α=2** (a.k.a. **collision entropy**) of the per-row
 * `total_tokens` distribution, computed over an equal-width
 * histogram of the per-source values.
 *
 * Headline question: **for each source, how concentrated is the
 * row-level token-cost distribution under the collision-probability
 * weighting?** Rényi-2 H_2 = -log2(Σ p_i²) emphasises the
 * probability that two independently-drawn rows from the same
 * source land in the **same** token-cost bin. Sources that
 * occasionally produce a few dominant token-cost bands score
 * **lower** H_2 than Shannon would suggest; sources whose rows
 * spread evenly across bins score close to log2(K).
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source (no time-sort needed — Rényi-2 is a
 *      multiset / order-invariant statistic).
 *   4. Skip the source if `n < minRows` (default 8). Surfaces
 *      under `droppedBelowMinRows`.
 *   5. Tie / degeneracy gate: if `max == min` (all values
 *      identical) the histogram is a single non-empty bin and
 *      H_2 collapses to 0 trivially. Surfaces under
 *      `droppedConstantSeries`.
 *   6. Build an **equal-width histogram** over [min, max] with
 *      `bins` bins (default 16). Bin edges are
 *      `min + k*(max-min)/bins` for k=0..bins; the right edge is
 *      inclusive. Compute counts c_k and probabilities
 *      p_k = c_k / N over **non-empty** bins only (empty bins
 *      contribute 0 to Σ p² and to the support count).
 *   7. Collision entropy:
 *        H_2 = -log2(Σ_k p_k²)         (in bits)
 *      Effective support:
 *        K = number of non-empty bins
 *      Normalise:
 *        h2Norm = H_2 / log2(K)        (when K >= 2)
 *      h2Norm == 1 iff all non-empty bins are equiprobable;
 *      h2Norm -> 0 as the mass concentrates into a single bin.
 *      When K == 1 we already drop under
 *      `droppedConstantSeries` (see step 5).
 *
 * Reading h2Norm:
 *   - h2Norm ~ 0.0-0.3: token costs collapse to one or two
 *     dominant bands; collision probability is high.
 *   - h2Norm ~ 0.5-0.8: typical multi-modal mix.
 *   - h2Norm ~ 0.9+: token costs spread approximately uniformly
 *     across the source's [min, max] range.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - **Shape / dispersion lenses** (`-iqr-ratio`, `-mad`,
 *     `-skewness`, `-kurtosis`, `-gini`,
 *     `-burstiness-coefficient`, `-coefficient-of-variation`):
 *     these compress the distribution to **moments or
 *     order-statistic ratios** of the **values**. Rényi-2
 *     compresses the **histogram** (a probability vector) and
 *     ignores value magnitudes after binning. Two distributions
 *     with identical mean/var/IQR/Gini can have very different
 *     Σ p² if one is bimodal-on-extremes and the other is
 *     unimodal-in-the-middle, so Rényi-2 separates them where
 *     moment-based lenses cannot.
 *   - **Shannon-entropy cousins** in the suite are computed on
 *     **other axes**: `model-mix-entropy`, `hour-of-day-source-mix-entropy`
 *     and `source-hour-of-day-token-mass-entropy` are all on
 *     mix / time-bin distributions. `source-row-token-permutation-entropy`
 *     is Shannon over **ordinal patterns** of length m, not over
 *     value bins. None of them is α=2 collision entropy on
 *     **per-row token-cost histograms**.
 *   - **Order-sensitive lenses** (`-permutation-entropy`,
 *     `-sample-entropy`, `-mann-kendall-trend`, `-runs-test`,
 *     `-turning-point-count`, `-autocorrelation-lag1`,
 *     `-hurst-rs`, `-higuchi-fd`, `-lempel-ziv`): they read the
 *     **temporal sequence** of values. Rényi-2 here is a pure
 *     multiset statistic: shuffle the rows and h2 / h2Norm are
 *     invariant. So the new lens is exactly the
 *     **order-blind / value-binned** complement to the
 *     order-sensitive family.
 *   - **Shannon (α=1) vs collision (α=2)**: Shannon
 *     H_1 = -Σ p log p is dominated by **rare** bins (it goes
 *     to +inf as a bin's probability shrinks toward 0). Collision
 *     entropy H_2 = -log Σ p² is dominated by **dominant** bins
 *     (a single big bin pushes Σ p² toward 1, pushing H_2 toward
 *     0). For a two-bin mix at probabilities (0.99, 0.01):
 *     H_1 ~ 0.081 bits, H_2 ~ 0.029 bits — collision entropy is
 *     ~3x more sensitive to the dominant mode. The two
 *     entropies coincide only on the uniform distribution.
 *     This is a different summary, not a redundant one.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All values identical (`max == min`): surfaces under
 *     `droppedConstantSeries` (H_2 trivially 0, h2Norm undefined).
 *   - K (non-empty-bin count) == 1 after binning is
 *     impossible unless `max == min`, which is already gated above.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 *
 * Companion lenses in the suite for cross-comparison:
 *   - `source-row-token-lempel-ziv` (sequence-factor complexity)
 *   - `source-row-token-permutation-entropy` (ordinal Shannon)
 *   - `source-row-token-gini` / `-iqr-ratio` (concentration on values)
 *   - `source-row-token-skewness` / `-kurtosis` (moment shape)
 *   - `source-row-token-burstiness-coefficient` (Goh-Barabási B)
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenRenyiEntropySort =
  | 'h2-asc'
  | 'h2-desc'
  | 'h2norm-asc'
  | 'h2norm-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenRenyiEntropyOptions {
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
   * Number of equal-width histogram bins per source. Must be an
   * integer >= 2. Default 16.
   */
  bins?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /** Sort key. Default 'h2norm-asc' (most concentrated first). */
  sort?: SourceRowTokenRenyiEntropySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenRenyiEntropyRow {
  source: string;
  rowsKept: number;
  /** Per-source min(value). */
  minValue: number;
  /** Per-source max(value). */
  maxValue: number;
  /** Number of non-empty bins (effective support, K). */
  support: number;
  /** Σ p_k² over non-empty bins (collision probability). */
  collisionProb: number;
  /** Rényi-2 entropy in bits: -log2(Σ p²). */
  h2: number;
  /** Normalised Rényi-2: h2 / log2(K). 1 iff non-empty bins equiprobable. */
  h2Norm: number;
}

export interface SourceRowTokenRenyiEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  bins: number;
  top: number | null;
  sort: SourceRowTokenRenyiEntropySort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenRenyiEntropyRow[];
}

const VALID_SORTS = [
  'h2-asc',
  'h2-desc',
  'h2norm-asc',
  'h2norm-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenRenyiEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenRenyiEntropyOptions = {},
): SourceRowTokenRenyiEntropyReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 2) {
    throw new Error(`minRows must be an integer >= 2 (got ${opts.minRows})`);
  }
  const bins = opts.bins ?? 16;
  if (!Number.isInteger(bins) || bins < 2) {
    throw new Error(`bins must be an integer >= 2 (got ${opts.bins})`);
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'h2norm-asc';
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
    arr.push(tt);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedBelowMinRows = 0;
  let droppedConstantSeries = 0;

  const allRows: SourceRowTokenRenyiEntropyRow[] = [];

  for (const [src, vals] of perSource.entries()) {
    totalRowsKept += vals.length;
    const N = vals.length;
    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let mn = vals[0]!;
    let mx = vals[0]!;
    for (let i = 1; i < N; i++) {
      const v = vals[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mx === mn) {
      droppedConstantSeries += 1;
      continue;
    }

    const range = mx - mn;
    const counts = new Array<number>(bins).fill(0);
    for (let i = 0; i < N; i++) {
      const v = vals[i]!;
      // Map [mn, mx] to bins; right edge inclusive.
      let idx = Math.floor(((v - mn) / range) * bins);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]! += 1;
    }

    let collisionProb = 0;
    let support = 0;
    for (let k = 0; k < bins; k++) {
      const c = counts[k]!;
      if (c === 0) continue;
      support += 1;
      const p = c / N;
      collisionProb += p * p;
    }

    // collisionProb is in (0, 1]. H_2 = -log2(collisionProb).
    const h2 = -Math.log2(collisionProb);
    // support >= 2 is guaranteed: max != min implies values fall in
    // at least two distinct bins... unless every value lands in the
    // same bin due to integer floor on a tiny range. Guard explicitly.
    let h2Norm: number;
    if (support < 2) {
      droppedConstantSeries += 1;
      continue;
    } else {
      h2Norm = h2 / Math.log2(support);
    }

    allRows.push({
      source: src,
      rowsKept: N,
      minValue: mn,
      maxValue: mx,
      support,
      collisionProb,
      h2,
      h2Norm,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'h2-asc') primary = a.h2 - b.h2;
    else if (sort === 'h2-desc') primary = b.h2 - a.h2;
    else if (sort === 'h2norm-asc') primary = a.h2Norm - b.h2Norm;
    else if (sort === 'h2norm-desc') primary = b.h2Norm - a.h2Norm;
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
    bins,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedConstantSeries,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
