/**
 * source-row-token-sample-entropy: per-source **Sample Entropy
 * (SampEn)** of Richman & Moorman (2000) on the per-row
 * `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how unpredictable is the
 * next token-count value given the immediately preceding `m`-long
 * pattern, when "matching" is judged at tolerance `r * sigma`?**
 * SampEn = -ln(A / B), where:
 *   - B = number of pairs of length-m template vectors that match
 *         (Chebyshev / sup-norm distance <= tolerance), excluding
 *         self-matches.
 *   - A = number of those same pairs whose extension to length
 *         m+1 also matches.
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence.
 *   4. Per source: form values v[0..n-1]. Compute the population
 *      stddev `sigma` of v (note: SampEn uses a **scale** for the
 *      tolerance; we follow the standard convention
 *      `tolerance = r * sigma`, so `r` is unitless and roughly
 *      comparable across sources).
 *   5. Skip the source if `n < minRows` (default 12 — needs at
 *      least a handful of length-(m+1) templates for the count
 *      to be informative; surfaced under `droppedBelowMinRows`).
 *      `minRows` must be `>= m + 2`.
 *   6. Skip the source if `sigma == 0` (a constant series has no
 *      meaningful tolerance scale; surfaced under
 *      `droppedZeroVariance`). This is the classical
 *      "tolerance collapse" failure mode and is an honest drop,
 *      not a SampEn = 0 report.
 *   7. Form template vectors:
 *        Xm[i]  = (v[i],   v[i+1], ..., v[i+m-1])    for i in [0, n-m]
 *        Xm1[i] = (v[i],   v[i+1], ..., v[i+m])      for i in [0, n-m-1]
 *      (Following Richman-Moorman, both index sets run to the
 *      same upper bound `n - m - 1` — the "no self-match,
 *      consistent-N" convention — so that A and B are computed
 *      over the same pair count `N*(N-1)/2` with `N = n - m`.)
 *   8. Count pairs (i, j) with `i < j` and `i, j in [0, n-m-1]`:
 *        - B counts pairs whose length-m Chebyshev distance
 *          `max_k |v[i+k] - v[j+k]|` (k in [0, m-1]) is `<= tol`.
 *        - A counts the subset of those pairs whose length-(m+1)
 *          Chebyshev distance is also `<= tol` — equivalently,
 *          B-matching pairs that additionally satisfy
 *          `|v[i+m] - v[j+m]| <= tol`.
 *   9. SampEn = -ln(A / B).
 *      Edge cases per the literature:
 *        - B == 0 (no length-m matches at all): undefined; we
 *          surface as `degenerate=true`, `sampEn=null`,
 *          `degenerateNoMatches+=1`. Operator reading: tolerance
 *          too tight for the dynamic range at this `m`.
 *        - A == 0 but B > 0: SampEn = +Infinity in the canonical
 *          formula. We clamp to a reported sentinel
 *          `sampEn = +Infinity` and flag `degenerate=true`,
 *          `degenerateNoExtensions+=1`. Operator reading:
 *          length-m matches exist but **none** extend to length
 *          m+1 — the next sample is essentially never predictable
 *          from the last m at this tolerance. Often a sign of
 *          high noise, very short n, or a tolerance that is
 *          large enough to admit length-m noise-matches but too
 *          tight to admit consistent length-(m+1) matches.
 *
 * Reading SampEn:
 *   - Lower SampEn (closer to 0) = **more regular / more
 *     predictable** length-m -> length-(m+1) extensions.
 *   - Higher SampEn = **less regular / more random**.
 *   - Strict numerical comparison across series is only valid
 *     when (m, r) and (approximately) n are held fixed.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-permutation-entropy` (PE): PE collapses
 *     each window to its **ordinal pattern** (rank order, fully
 *     value-blind beyond order). SampEn keeps the **metric**
 *     information — it asks whether two windows are numerically
 *     close at tolerance `r * sigma`. A series can have
 *     `PE ~ 1` (uniform ordinal patterns) yet very low SampEn
 *     (matching values reliably extend) and vice versa.
 *   - `source-row-token-hurst-rs`: classical R/S over partition
 *     scales — a **multi-scale memory** scalar from cumulative
 *     deviation envelopes. SampEn is a **single-scale
 *     conditional irregularity** scalar at one chosen
 *     (m, tolerance).
 *   - `source-row-token-mann-kendall-trend` / `-runs-test` /
 *     `-turning-point-count`: directional / dichotomy / extremum
 *     tests, not pattern-extension matching.
 *   - `source-row-token-autocorrelation-lag1`: linear,
 *     parametric, lag-1 only. SampEn is non-parametric and
 *     captures **m-th order** conditional structure.
 *   - All order-invariant dispersion / shape lenses
 *     (`-iqr-ratio`, `-mad`, `-skewness`, `-kurtosis`, `-gini`,
 *     `-burstiness-coefficient`, `-coefficient-of-variation`):
 *     shuffling the sequence leaves them unchanged but typically
 *     pushes SampEn toward its high-randomness regime.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`.
 *   - `B == 0`: row is reported with `sampEn = null`,
 *     `degenerate = true`, counted under `degenerateNoMatches`.
 *   - `A == 0, B > 0`: row is reported with `sampEn = +Infinity`
 *     (encoded as the literal JSON value via `Number.POSITIVE_INFINITY`
 *     -> serialised as `null` by JSON.stringify; the report also
 *     carries `aMatches = 0`, `bMatches > 0`, and
 *     `degenerate = true`, `degenerateNoExtensions += 1` so the
 *     condition is unambiguous).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSampleEntropySort =
  | 'sampen-asc'
  | 'sampen-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSampleEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Embedding dimension `m`. Must be an integer in `[1, 6]`.
   * Default 2 (matches the bulk of the SampEn literature).
   */
  m?: number;
  /**
   * Unitless tolerance multiplier `r`. The actual matching
   * tolerance is `r * sigma_v`, where `sigma_v` is the
   * population stddev of the per-source value sequence. Must be
   * a finite positive number. Default 0.2 (the canonical
   * Richman-Moorman default).
   */
  r?: number;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= m + 2` (need at least one length-(m+1)
   * template). Default 12.
   */
  minRows?: number;
  /**
   * Drop sources whose length-`m` match count `B` is strictly
   * **below** this threshold. Must be an integer `>= 0`. Default
   * 0 (no floor).
   *
   * Why this is genuinely orthogonal to `--min-rows`:
   *
   *   - `--min-rows` gates on the **input sample size** `n`. For
   *     fixed `(m, r)` the number of length-`m` matches `B` does
   *     not scale linearly with `n` — it scales with `n^2` only
   *     in the dense-match regime (small effective dynamic range
   *     relative to tolerance). A long source with a wide
   *     dynamic range can clear `--min-rows` comfortably while
   *     still producing a small `B` (e.g. 5 or 10), at which
   *     point the SampEn estimate `-ln(A/B)` is dominated by
   *     small-count noise and the `A/B` ratio is essentially
   *     the outcome of a handful of Bernoulli trials.
   *   - `--min-template-matches` gates on the **count regime
   *     of the SampEn estimator itself**. Setting e.g.
   *     `--min-template-matches 100` filters out the cohort of
   *     sources whose reported `SampEn` is statistically
   *     unstable from too few length-`m` matches, leaving the
   *     surviving values directly comparable as point
   *     estimates.
   *
   * Combined with `--min-rows` and `--top` the gates apply
   * (logical AND); each gate counts its drops separately so the
   * operator sees which gate dropped what.
   *
   * Note: degenerate sources (`B == 0`, `A == 0 & B > 0`) are
   * still **kept** in the output by default (they are honest
   * signals); a non-degenerate row with `B < minTemplateMatches`
   * is what this gate filters. To also drop degenerate rows,
   * combine with a sufficiently large `--min-template-matches`.
   */
  minTemplateMatches?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'sampen-asc' (default): SampEn ascending — most-regular
   *                             (most-predictable) first. Degenerate
   *                             rows sort to the bottom.
   *   - 'sampen-desc':          SampEn descending — most-random first.
   *                             Degenerate rows sort to the bottom.
   *   - 'rows':                 rowsKept desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSampleEntropySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSampleEntropyRow {
  source: string;
  rowsKept: number;
  /** number of length-(m+1) template starting indices = rowsKept - m. */
  templateCount: number;
  /** population stddev of v; the tolerance scale. */
  sigma: number;
  /** absolute tolerance applied (= r * sigma). */
  tolerance: number;
  /** Number of (i,j), i<j, length-m Chebyshev-matching pairs. */
  bMatches: number;
  /** Number of (i,j), i<j, pairs that also match at length m+1. */
  aMatches: number;
  /**
   * Sample entropy = -ln(A / B). null if `B == 0` (degenerate;
   * tolerance too tight). +Infinity if `A == 0` and `B > 0`
   * (degenerate; matches don't extend).
   */
  sampEn: number | null;
  /** True if either degenerate condition above triggered. */
  degenerate: boolean;
}

export interface SourceRowTokenSampleEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  m: number;
  r: number;
  minRows: number;
  minTemplateMatches: number;
  top: number | null;
  sort: SourceRowTokenSampleEntropySort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  degenerateNoMatches: number;
  degenerateNoExtensions: number;
  droppedBelowMinTemplateMatches: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSampleEntropyRow[];
}

const VALID_SORTS = ['sampen-asc', 'sampen-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenSampleEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenSampleEntropyOptions = {},
): SourceRowTokenSampleEntropyReport {
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
  const minTemplateMatches = opts.minTemplateMatches ?? 0;
  if (!Number.isInteger(minTemplateMatches) || minTemplateMatches < 0) {
    throw new Error(
      `minTemplateMatches must be an integer >= 0 (got ${opts.minTemplateMatches})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'sampen-asc';
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
  let droppedZeroVariance = 0;
  let degenerateNoMatches = 0;
  let degenerateNoExtensions = 0;

  const allRows: SourceRowTokenSampleEntropyRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // population stddev
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

    // Number of length-(m+1) starts: N = n - m. Pair indices i,j
    // both in [0, N-1] = [0, n-m-1]. (Templates of length m share
    // this same N to keep A and B comparable.)
    const N = n - m;
    let bMatches = 0;
    let aMatches = 0;

    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        // length-m Chebyshev distance
        let dMax = 0;
        for (let k = 0; k < m; k++) {
          const d = Math.abs(v[i + k]! - v[j + k]!);
          if (d > dMax) {
            dMax = d;
            if (dMax > tolerance) break;
          }
        }
        if (dMax <= tolerance) {
          bMatches += 1;
          // length-(m+1) extension
          const ext = Math.abs(v[i + m]! - v[j + m]!);
          if (ext > dMax) dMax = ext;
          if (dMax <= tolerance) aMatches += 1;
        }
      }
    }

    let sampEn: number | null;
    let degenerate = false;
    if (bMatches === 0) {
      sampEn = null;
      degenerate = true;
      degenerateNoMatches += 1;
    } else if (aMatches === 0) {
      sampEn = Number.POSITIVE_INFINITY;
      degenerate = true;
      degenerateNoExtensions += 1;
    } else {
      sampEn = -Math.log(aMatches / bMatches);
    }

    allRows.push({
      source,
      rowsKept: n,
      templateCount: N,
      sigma,
      tolerance,
      bMatches,
      aMatches,
      sampEn,
      degenerate,
    });
  }

  // Apply --min-template-matches gate. Only non-degenerate rows
  // are subject to it; degenerate rows (B=0 or A=0&B>0) are
  // honest signals and surface via their own counters.
  let droppedBelowMinTemplateMatches = 0;
  const survived: SourceRowTokenSampleEntropyRow[] = [];
  for (const row of allRows) {
    if (
      minTemplateMatches > 0 &&
      !row.degenerate &&
      row.bMatches < minTemplateMatches
    ) {
      droppedBelowMinTemplateMatches += 1;
      continue;
    }
    survived.push(row);
  }

  // Sort. Degenerate rows always sink to the bottom regardless
  // of sort key; tiebreak is source asc.
  function sampenKey(row: SourceRowTokenSampleEntropyRow, asc: boolean): number {
    if (row.degenerate) return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (row.sampEn === null) return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(row.sampEn)) return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.sampEn;
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'sampen-asc') {
      primary = sampenKey(a, true) - sampenKey(b, true);
    } else if (sort === 'sampen-desc') {
      // For desc, want highest first, but degenerate to bottom.
      // Use the *negative* of an ascending key with degenerate -> +inf
      // sentinel so degenerate rows always end up last.
      const ka = a.degenerate ? Number.POSITIVE_INFINITY : -((a.sampEn as number));
      const kb = b.degenerate ? Number.POSITIVE_INFINITY : -((b.sampEn as number));
      // Re-introduce: we want non-degenerate sorted by sampen desc, so
      // smaller of (-sampen) first.
      primary = ka - kb;
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
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
    m,
    r,
    minRows,
    minTemplateMatches,
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
    degenerateNoMatches,
    degenerateNoExtensions,
    droppedBelowMinTemplateMatches,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
