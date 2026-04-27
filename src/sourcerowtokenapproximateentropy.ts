/**
 * source-row-token-approximate-entropy: per-source **Approximate
 * Entropy (ApEn)** of Pincus (1991, PNAS 88(6):2297-2301) on the
 * per-row `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how often do similar
 * length-m templates remain similar one step further out, when
 * "similar" is judged at tolerance `r * sigma`?** Lower ApEn =
 * more regular; higher ApEn = more irregular.
 *
 * Construction (canonical Pincus 1991 definition, *with*
 * self-matches — this is what makes ApEn distinct from SampEn):
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence.
 *   4. Per source: form `v[0..n-1]`. Compute the population stddev
 *      `sigma`. Set `tolerance = r * sigma`.
 *   5. Skip if `n < minRows` (default 12; needs a handful of
 *      length-(m+1) templates). `minRows` must be `>= m + 2`.
 *   6. Skip if `sigma == 0` (constant series; tolerance collapses).
 *      Surfaces under `droppedZeroVariance`.
 *   7. For each `k` in `{m, m+1}`:
 *        Nk = n - k + 1
 *        For each i in [0, Nk-1], C_i^k = (# j in [0, Nk-1] with
 *           Chebyshev distance(template_i^k, template_j^k) <= tol)
 *           / Nk         <-- self-match included (j may equal i)
 *        phi^k = (1/Nk) * sum_i ln(C_i^k)
 *   8. ApEn(m, r) = phi^m - phi^(m+1).
 *
 * Crucial Pincus property: because **self-matches are counted**,
 * `C_i^k >= 1/Nk > 0` for every i, so `ln(C_i^k)` is always
 * finite. ApEn is therefore **never undefined** for a
 * non-constant series with `n >= m + 2` — there is no
 * `degenerateNoMatches` / `degenerateNoExtensions` failure mode
 * the way SampEn has. This is precisely the bias-of-self-matching
 * that Richman & Moorman (2000) flagged when introducing SampEn:
 * ApEn is biased toward regularity but is finite-by-construction;
 * SampEn removes the bias at the cost of being undefined when no
 * matches exist. Reporting both in parallel is the standard
 * practice when using either as a diagnostic.
 *
 * Reading ApEn:
 *   - Lower ApEn (closer to 0) = **more regular / more
 *     predictable** length-m -> length-(m+1) extensions.
 *   - Higher ApEn = **less regular / more random**.
 *   - ApEn for white noise (m=2, r=0.2) typically ~ 1.6-2.1
 *     for moderate n; for a perfectly periodic series, ApEn ~ 0.
 *   - Strict numerical comparison across series is only valid
 *     when (m, r) and (approximately) n are held fixed.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite, and in
 * particular to `source-row-token-sample-entropy`:
 *
 *   - vs. **sample-entropy** (closest cousin): SampEn excludes
 *     self-matches and computes `-ln(A/B)` with `A`, `B` as
 *     pair counts of length-(m+1) and length-m matches
 *     respectively. ApEn includes self-matches and computes
 *     `phi^m - phi^(m+1)` as a difference of mean-log-conditional
 *     probabilities. The two are not monotone-related on real
 *     data: ApEn is biased toward regularity for short n
 *     (self-matches inflate `C_i^k` more for length-(m+1) where
 *     `Nk` is smaller), so a series can rank higher in ApEn but
 *     lower in SampEn or vice versa. ApEn is also defined
 *     everywhere SampEn is undefined (no-match degeneracies),
 *     making the two complementary as diagnostics.
 *   - vs. **permutation-entropy**: PE is ordinal-only
 *     (rank patterns, value-blind beyond order). ApEn is fully
 *     metric (uses tolerance scale).
 *   - vs. **hurst-rs / dfa**: those are multi-scale memory
 *     scaling exponents. ApEn is a **single-scale** conditional
 *     irregularity scalar at a fixed (m, tolerance).
 *   - vs. **mann-kendall / runs-test / turning-point-count**:
 *     directional / dichotomy / extremum tests, not
 *     pattern-extension matching.
 *   - vs. **autocorrelation-lag1**: linear, parametric, lag-1.
 *     ApEn is non-parametric and captures m-th order conditional
 *     structure.
 *   - vs. **lempel-ziv**: median-binarised factor count over a
 *     two-letter alphabet; ApEn keeps the full real-valued
 *     metric structure.
 *   - vs. **katz-fd / higuchi-fd / petrosian-fd**: path-length /
 *     fractal dimension scalars; structurally unrelated to
 *     conditional probability extensions.
 *   - vs. **hjorth-mobility / -complexity**: variance ratios on
 *     differenced series — magnitude-sensitive and fully
 *     parametric. ApEn is non-parametric and amplitude-invariant
 *     after the `r * sigma` tolerance scaling.
 *   - vs. **zero-crossing-rate**: pure single-scale sign-change
 *     count; carries no information about pattern extension.
 *   - vs. all order-invariant dispersion / shape lenses
 *     (`-iqr-ratio`, `-mad`, `-skewness`, `-kurtosis`, `-gini`,
 *     `-burstiness-coefficient`, `-coefficient-of-variation`):
 *     shuffling the sequence leaves them unchanged but typically
 *     pushes ApEn toward its high-randomness regime.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`.
 *   - Non-finite computed quantity (should not happen because
 *     self-matches guarantee strictly positive C^k, but defensive
 *     check): surfaces under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenApproximateEntropySort =
  | 'apen-asc'
  | 'apen-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenApproximateEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Embedding dimension `m`. Must be an integer in `[1, 6]`.
   * Default 2 (matches the Pincus 1991 convention for short-to-
   * moderate series).
   */
  m?: number;
  /**
   * Unitless tolerance multiplier `r`. Actual matching tolerance
   * is `r * sigma_v`. Must be a finite positive number. Default
   * 0.2 (the canonical Pincus default).
   */
  r?: number;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= m + 2`. Default 12.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'apen-asc' (default): ApEn ascending — most-regular
   *                           (most-predictable) first.
   *   - 'apen-desc':          ApEn descending — most-random first.
   *   - 'rows':               rowsKept desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenApproximateEntropySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenApproximateEntropyRow {
  source: string;
  rowsKept: number;
  /** N_m = n - m + 1; number of length-m templates. */
  templateCountM: number;
  /** N_(m+1) = n - m; number of length-(m+1) templates. */
  templateCountMp1: number;
  /** Population stddev of v; the tolerance scale. */
  sigma: number;
  /** Absolute tolerance applied (= r * sigma). */
  tolerance: number;
  /** phi^m. */
  phiM: number;
  /** phi^(m+1). */
  phiMp1: number;
  /** ApEn = phi^m - phi^(m+1). Always finite for non-constant series. */
  apEn: number;
}

export interface SourceRowTokenApproximateEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  m: number;
  r: number;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenApproximateEntropySort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenApproximateEntropyRow[];
}

const VALID_SORTS = ['apen-asc', 'apen-desc', 'rows', 'source'] as const;

/**
 * Compute phi^k = (1 / Nk) * sum_i ln(C_i^k), where
 *   Nk = n - k + 1
 *   C_i^k = (# j in [0, Nk-1] with Chebyshev(template_i^k, template_j^k) <= tol) / Nk
 * Self-matches (j == i) are included.
 */
function phiOf(v: number[], k: number, tol: number): number {
  const n = v.length;
  const Nk = n - k + 1;
  let sumLnC = 0;
  for (let i = 0; i < Nk; i++) {
    let count = 0;
    for (let j = 0; j < Nk; j++) {
      // Chebyshev distance over the length-k window
      let dMax = 0;
      for (let p = 0; p < k; p++) {
        const d = Math.abs(v[i + p]! - v[j + p]!);
        if (d > dMax) {
          dMax = d;
          if (dMax > tol) break;
        }
      }
      if (dMax <= tol) count += 1;
    }
    // count >= 1 always (j == i contributes a 0-distance match)
    const C = count / Nk;
    sumLnC += Math.log(C);
  }
  return sumLnC / Nk;
}

export function buildSourceRowTokenApproximateEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenApproximateEntropyOptions = {},
): SourceRowTokenApproximateEntropyReport {
  const m = opts.m ?? 2;
  if (!Number.isInteger(m) || m < 1 || m > 6) {
    throw new Error(`m must be an integer in [1, 6] (got ${opts.m})`);
  }
  const r = opts.r ?? 0.2;
  if (!Number.isFinite(r) || r <= 0) {
    throw new Error(`r must be a finite positive number (got ${opts.r})`);
  }
  const minRows = opts.minRows ?? 12;
  if (!Number.isInteger(minRows) || minRows < m + 2) {
    throw new Error(
      `minRows must be an integer >= m+2 (=${m + 2}) (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'apen-asc';
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
  let droppedZeroVariance = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenApproximateEntropyRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let mean = 0;
    for (let i = 0; i < n; i++) mean += v[i]!;
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const d = v[i]! - mean;
      variance += d * d;
    }
    variance /= n;
    const sigma = Math.sqrt(variance);

    if (sigma === 0) {
      droppedZeroVariance += 1;
      continue;
    }

    const tolerance = r * sigma;
    const phiM = phiOf(v, m, tolerance);
    const phiMp1 = phiOf(v, m + 1, tolerance);
    const apEn = phiM - phiMp1;

    if (
      !Number.isFinite(phiM) ||
      !Number.isFinite(phiMp1) ||
      !Number.isFinite(apEn)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      templateCountM: n - m + 1,
      templateCountMp1: n - m,
      sigma,
      tolerance,
      phiM,
      phiMp1,
      apEn,
    });
  }

  function apenKey(row: SourceRowTokenApproximateEntropyRow, asc: boolean): number {
    if (!Number.isFinite(row.apEn))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.apEn;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'apen-asc') {
      primary = apenKey(a, true) - apenKey(b, true);
    } else if (sort === 'apen-desc') {
      primary = apenKey(b, false) - apenKey(a, false);
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
    m,
    r,
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
    droppedZeroVariance,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
