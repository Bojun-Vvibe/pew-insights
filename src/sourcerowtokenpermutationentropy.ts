/**
 * source-row-token-permutation-entropy: per-source **Bandt-Pompe
 * permutation entropy** (default order m=3) on the per-row
 * `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how complex is the
 * ordinal pattern of consecutive token-count windows of length
 * m — i.e. how uniformly distributed are the m! possible rank
 * orderings of (v[i], v[i+1], ..., v[i+m-1])?**
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence,
 *      not insertion order.
 *   4. Per source: walk the value sequence v[0..n-1] with a
 *      sliding window of length m. Each window
 *      (v[i], ..., v[i+m-1]) is mapped to a permutation pi in
 *      S_m by the **rank-order** of its values: pi[k] = number
 *      of j in [0, m) with (v[i+j] < v[i+k]) OR
 *      (v[i+j] == v[i+k] AND j < k). The "j < k" tiebreak gives
 *      a deterministic, total ordering even with repeated
 *      values; the fraction of windows that contain at least
 *      one tie is surfaced separately as `tieWindowFraction` so
 *      the operator can audit how much of the entropy comes
 *      from arbitrary tie-breaking.
 *   5. Skip the source if `n < minRows` (default 8 — needs at
 *      least m+1 windows for the entropy to start being
 *      meaningful, surfaced under `droppedBelowMinRows`).
 *      `minRows` must be `>= order + 2` so that windows-count
 *      `n - order + 1 >= 3`.
 *   6. Count the multiplicity c[pi] of each observed
 *      permutation; total windows W = n - m + 1. Permutation
 *      entropy in nats:
 *          H = -sum_{pi: c[pi]>0} (c[pi]/W) * ln(c[pi]/W)
 *      Normalised permutation entropy (in [0, 1]):
 *          PE = H / ln(m!)
 *      so PE = 1 means every one of the m! permutations is
 *      observed equally often (maximum complexity / closest to
 *      i.i.d. continuous), and PE = 0 means a single
 *      permutation accounts for **all** windows (maximally
 *      regular / pure linear trend or pure single-period
 *      oscillation).
 *   7. Reading PE:
 *      - `PE` near `1`: ordinal patterns are uniformly
 *                       distributed; the series looks
 *                       order-equivalent to i.i.d. continuous
 *                       noise at scale m.
 *      - `PE` near `0`: ordinal patterns are dominated by one
 *                       (or a few) permutations; the series is
 *                       highly regular at scale m. For m=3 the
 *                       extreme cases are a strict monotone
 *                       sequence (only `[0,1,2]` -> PE = 0) or a
 *                       strict anti-monotone sequence (only
 *                       `[2,1,0]` -> PE = 0).
 *      - `PE` mid-range (e.g. `~0.85` for m=3): the series uses
 *                       most ordinal patterns but with mild
 *                       imbalance — typical of weakly persistent
 *                       real-world series.
 *   8. The dominant permutation index `dominantPattern` (the
 *      lex-rank of the most-frequent pi in [0, m!)) and its
 *      observed mass `dominantPatternFraction = max c[pi] / W`
 *      are surfaced so the operator can see **which** pattern is
 *      driving a low PE without re-deriving it from raw data.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-runs-test`: dichotomises around the
 *     **median** and looks at run lengths above/below a level.
 *     PE ignores absolute level entirely and works on
 *     **ordinal patterns of length m** — three-way relations
 *     among consecutive triples (for m=3), not two-way relations
 *     to the median.
 *   - `source-row-token-turning-point-count`: counts only the
 *     two ordinal events {peak, trough} inside each interior
 *     triple — equivalently, it groups the 6 m=3 permutations
 *     into 3 classes (`[1,0,2]`+`[1,2,0]`+`[2,0,1]`+`[0,2,1]` =
 *     turning points; the rest = monotone) and reports a
 *     count, not the entropy of the full 6-bin distribution.
 *     PE distinguishes, e.g., a sequence dominated by the
 *     monotone-up pattern `[0,1,2]` from one dominated by the
 *     monotone-down pattern `[2,1,0]`; the turning-point test
 *     puts both in the "no turning point" bin and reports the
 *     same Z. PE is therefore strictly finer at scale m=3 and
 *     non-redundant at higher m.
 *   - `source-row-token-autocorrelation-lag1`: linear Pearson
 *     rho on **raw values**. PE is non-parametric and invariant
 *     to any **strictly monotone** rescaling of the values
 *     (log, sqrt, affine, ...).
 *   - `source-row-token-burstiness-coefficient`,
 *     `-coefficient-of-variation`, `-iqr-ratio`, `-mad`,
 *     `-skewness`, `-kurtosis`, `-gini`: marginal-distribution
 *     dispersion / shape lenses, **all order-invariant** —
 *     shuffling the sequence leaves them unchanged but typically
 *     pushes PE toward 1.
 *
 * Edge cases:
 *
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `order` must be an integer in `[2, 6]`; m=7 already needs
 *     5040 distinct buckets to be undersampled by typical row
 *     counts. Default 3 (matches the bulk of the literature).
 *   - All values equal: every window collapses under the
 *     `j < k` tiebreak to the identity permutation
 *     `[0, 1, ..., m-1]`; PE = 0; `tieWindowFraction = 1`.
 *   - Strictly monotone series (1, 2, ..., n): only the
 *     identity permutation appears; PE = 0; tieWindowFraction = 0.
 *   - Perfectly alternating series (1, 10, 1, 10, ...): for m=3
 *     only the two permutations `[0,2,1]` (low-high-low) and
 *     `[1,0,2]` (high-low-high) appear, each with mass 1/2;
 *     H = ln 2; PE = ln 2 / ln 6 ~ 0.3869. (Verified in tests.)
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenPermutationEntropySort =
  | 'pe-asc'
  | 'pe-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenPermutationEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Embedding dimension m (a.k.a. "order"). Must be an integer
   * in `[2, 6]`. Default 3. Higher m -> finer pattern resolution
   * but needs more rows; m=7 has 5040 buckets and is undersampled
   * by typical per-source row counts in this dataset, so it is
   * disallowed at the CLI to keep the lens honest.
   */
  order?: number;
  /**
   * Drop sources with fewer than this many post-window rows.
   * Must be an integer `>= order + 2` (need at least 3 windows
   * for the entropy to be informative). Default 8.
   */
  minRows?: number;
  /**
   * Drop sources whose **fraction of windows that contain at
   * least one tie** (`tieWindowFraction`) is strictly **above**
   * this threshold. Must be a finite number in `(0, 1]`. Default
   * 1 (no floor — every source survives, including
   * tiebreaker-dominated discrete series).
   *
   * Why this is genuinely orthogonal to `--min-rows`:
   *
   *   - `--min-rows` gates on the **sample size** of the
   *     pattern distribution; below ~`order!` windows the
   *     entropy estimate is biased low simply because not
   *     every permutation can be observed even once. It is a
   *     statistical-power gate.
   *   - `--max-tie-window-fraction` gates on the **continuity
   *     premise** of the lens itself. A source whose row-token
   *     series is, say, 70% repeated values within sliding
   *     windows (`tieWindowFraction = 0.70`) is violating the
   *     Bandt-Pompe distinct-value assumption so badly that
   *     the reported PE is informative mostly about how the
   *     `j<k` tiebreaker is resolving ties (which biases PE
   *     **down** toward the identity permutation), not about
   *     the genuine ordinal complexity of the underlying
   *     stochastic process. Filtering these out (e.g.
   *     `--max-tie-window-fraction 0.30`) keeps the
   *     surviving PE values interpretable as evidence about
   *     ordinal complexity.
   *
   * Combined with `--min-rows` and `--top` the gates apply
   * (logical AND); each gate counts its drops separately so the
   * operator sees which gate dropped what.
   */
  maxTieWindowFraction?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'pe-asc' (default): normalised permutation entropy
   *                         ascending — most-regular sources first.
   *   - 'pe-desc':          PE descending — most-complex first.
   *   - 'rows':             rowsKept desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenPermutationEntropySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenPermutationEntropyRow {
  source: string;
  /** total post-window post-validity rows for this source. */
  rowsKept: number;
  /** number of length-`order` sliding windows: rowsKept - order + 1. */
  windowCount: number;
  /** number of distinct ordinal patterns observed (in `[1, order!]`). */
  distinctPatterns: number;
  /** Shannon entropy of the pattern distribution, in nats. */
  entropyNats: number;
  /** normalised permutation entropy = entropyNats / ln(order!), in `[0, 1]`. */
  permutationEntropy: number;
  /**
   * Lex-rank in `[0, order!)` of the most-frequent pattern.
   * For m=3 the lex order is:
   *   0=[0,1,2] 1=[0,2,1] 2=[1,0,2] 3=[1,2,0] 4=[2,0,1] 5=[2,1,0].
   */
  dominantPattern: number;
  /** observed mass of the dominant pattern, in `(0, 1]`. */
  dominantPatternFraction: number;
  /**
   * Fraction of windows that contained at least one tie
   * (`v[i+j] == v[i+k]` for some j != k). In `[0, 1]`. Surfaced
   * so the operator can audit how much of the entropy comes
   * from arbitrary `j < k` tiebreaking on a discrete series.
   */
  tieWindowFraction: number;
}

export interface SourceRowTokenPermutationEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  order: number;
  minRows: number;
  maxTieWindowFraction: number;
  top: number | null;
  sort: SourceRowTokenPermutationEntropySort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAboveMaxTieWindowFraction: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenPermutationEntropyRow[];
}

const VALID_SORTS = ['pe-asc', 'pe-desc', 'rows', 'source'] as const;

/** factorial for small m only (m <= 6 enforced upstream). */
function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/**
 * Encode a permutation array (length m, values are a permutation
 * of 0..m-1) to its lex rank in `[0, m!)`. Standard
 * factorial-number-system / Lehmer-code construction.
 */
function permLexRank(perm: number[]): number {
  const m = perm.length;
  const used: boolean[] = new Array(m).fill(false);
  let rank = 0;
  for (let i = 0; i < m; i++) {
    let smaller = 0;
    for (let j = 0; j < perm[i]!; j++) {
      if (!used[j]) smaller += 1;
    }
    rank += smaller * factorial(m - 1 - i);
    used[perm[i]!] = true;
  }
  return rank;
}

export function buildSourceRowTokenPermutationEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenPermutationEntropyOptions = {},
): SourceRowTokenPermutationEntropyReport {
  const order = opts.order ?? 3;
  if (!Number.isInteger(order) || order < 2 || order > 6) {
    throw new Error(`order must be an integer in [2, 6] (got ${opts.order})`);
  }
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < order + 2) {
    throw new Error(
      `minRows must be an integer >= order+2 (=${order + 2}) (got ${opts.minRows})`,
    );
  }
  const maxTieWindowFraction = opts.maxTieWindowFraction ?? 1;
  if (
    !Number.isFinite(maxTieWindowFraction) ||
    maxTieWindowFraction <= 0 ||
    maxTieWindowFraction > 1
  ) {
    throw new Error(
      `maxTieWindowFraction must be a finite number in (0, 1] (got ${opts.maxTieWindowFraction})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'pe-asc';
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

  /** Per source: array of [hour_start ms, total_tokens]. */
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

  const allRows: SourceRowTokenPermutationEntropyRow[] = [];
  const factM = factorial(order);
  const lnFactM = Math.log(factM);

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const values = samples.map((s) => s[1]);
    const n = values.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    const W = n - order + 1;
    const counts = new Map<number, number>();
    let tiedWindows = 0;

    const indices = new Array(order);
    for (let i = 0; i < W; i++) {
      // Determine the permutation pi: pi[k] = rank of v[i+k] in
      // the window (with j<k tiebreak for equal values).
      let hasTie = false;
      for (let k = 0; k < order; k++) {
        let rank = 0;
        const vk = values[i + k]!;
        for (let j = 0; j < order; j++) {
          if (j === k) continue;
          const vj = values[i + j]!;
          if (vj < vk) rank += 1;
          else if (vj === vk) {
            hasTie = true;
            if (j < k) rank += 1;
          }
        }
        indices[k] = rank;
      }
      if (hasTie) tiedWindows += 1;
      const lex = permLexRank(indices);
      counts.set(lex, (counts.get(lex) ?? 0) + 1);
    }

    let H = 0;
    let dominantPattern = 0;
    let dominantCount = 0;
    for (const [lex, c] of counts.entries()) {
      const p = c / W;
      H -= p * Math.log(p);
      if (c > dominantCount) {
        dominantCount = c;
        dominantPattern = lex;
      }
    }
    const PE = lnFactM > 0 ? H / lnFactM : 0;

    allRows.push({
      source,
      rowsKept: n,
      windowCount: W,
      distinctPatterns: counts.size,
      entropyNats: H,
      permutationEntropy: Math.max(0, Math.min(1, PE)),
      dominantPattern,
      dominantPatternFraction: dominantCount / W,
      tieWindowFraction: tiedWindows / W,
    });
  }

  let droppedAboveMaxTieWindowFraction = 0;
  const survived: SourceRowTokenPermutationEntropyRow[] = [];
  for (const row of allRows) {
    if (
      maxTieWindowFraction < 1 &&
      row.tieWindowFraction > maxTieWindowFraction
    ) {
      droppedAboveMaxTieWindowFraction += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'pe-asc') primary = a.permutationEntropy - b.permutationEntropy;
    else if (sort === 'pe-desc') primary = b.permutationEntropy - a.permutationEntropy;
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
    order,
    minRows,
    maxTieWindowFraction,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAboveMaxTieWindowFraction,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
