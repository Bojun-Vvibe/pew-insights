/**
 * source-row-token-petrosian-fd: per-source **Petrosian Fractal
 * Dimension (PFD)** of Petrosian (1995) on the per-row
 * `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how much "wiggle"
 * exists in the first-difference sign sequence of the per-row
 * token-count series, normalised by length?** PFD reduces the
 * full continuous trajectory to a single binary symbol stream
 * (sign of `v[i+1] - v[i]`) and then asks "how many sign flips
 * are there in that stream, relative to length N?", expressed
 * in Petrosian's closed-form log-ratio.
 *
 * Construction (Petrosian 1995, "Kolmogorov complexity of
 * finite sequences and recognition of different preictal EEG
 * patterns", Proc. 8th IEEE Symp. CBMS, pp. 212-217):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own
 *      counter).
 *   3. Group by source, sort each group by `hour_start`
 *      ascending so the test sees the actual temporal sequence
 *      v[0..N-1].
 *   4. Skip the source if `n < minRows` (default 16).
 *   5. Skip the source if all values are equal (`droppedZeroVariance`).
 *      The first-difference series is then identically zero and
 *      the sign mapping is undefined.
 *   6. Compute the first-difference series `dv[i] = v[i+1] - v[i]`
 *      for `i = 0..N-2`, length `M = N - 1`.
 *   7. Map `dv[i]` to a binary sign symbol in `{+1, -1}`:
 *      zero -> +1 (the Esteller 2001 convention, also matching
 *      ZCR in this suite). `Nd` = number of adjacent sign
 *      changes in that sequence. (Equivalently: number of
 *      strict local extrema in `v` under the convention that a
 *      flat-then-up step is treated as continuing-up.)
 *   8. Petrosian's closed form:
 *        `PFD = log10(M) / (log10(M) + log10(M / (M + 0.4 * Nd)))`
 *      The `0.4` heuristic constant was empirically derived by
 *      Petrosian from binary EEG sequences and rederived by
 *      Esteller, Vachtsevanos, Echauz, Litt 2001
 *      (Sig. Proc. 81(7):1543-1557).
 *   9. PFD is theoretically bounded in `[1, 2]` (Petrosian
 *      proves the upper bound for the maximally-alternating
 *      binary sequence). Clamp to that bracket; out-of-range
 *      raw values are flagged via `clampedBelow1` / `clampedAbove2`
 *      and `pfdRaw` retains the pre-clamp value for audit.
 *
 * Reading PFD:
 *   - PFD ~ 1.0 = a near-monotone trajectory (few sign flips
 *     in the diff series; values move mostly in one direction
 *     for long stretches).
 *   - PFD ~ 1.05 - 1.15 = moderate roughness; some sign flips
 *     but well below the Nyquist alternation rate.
 *   - PFD -> ~1.18 = near-maximum (Nyquist-like; every diff
 *     flips sign, equivalent to local-extrema-everywhere).
 *   - PFD strictly above ~1.2 is essentially impossible on
 *     real first-difference sign sequences.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite, including
 * its closest neighbours `source-row-token-katz-fd`,
 * `source-row-token-higuchi-fd`,
 * `source-row-token-zero-crossing-rate`, and
 * `source-row-token-turning-point-count`:
 *
 *   - vs. `katz-fd` (KFD): KFD is a **metric** quantity — it
 *     uses the actual numeric magnitudes through L (Euclidean
 *     path length) and d (max chord). PFD is **purely binary**
 *     after the sign mapping; magnitudes drop out completely.
 *     Multiply every value by 13 and Nd is bit-identical
 *     (verified by test). Two series with identical sign-of-diff
 *     sequences and wildly different amplitudes share the same
 *     PFD but diverge sharply on KFD.
 *   - vs. `higuchi-fd` (HFD): HFD is a multi-scale **scaling
 *     exponent** of `log L(k)` vs `log k`; PFD is single-scale
 *     and closed-form. HFD probes self-similarity across strides;
 *     PFD probes only stride-1 first-difference sign flips.
 *   - vs. `zero-crossing-rate` (ZCR): ZCR counts sign changes
 *     of `(v - mean)` — i.e. of the **value** sequence centred
 *     by its mean. PFD counts sign changes of `diff(v)` — the
 *     **first-difference** sequence. A monotone ramp has ZCR
 *     `~ 1/(N-1)` (one mid-crossing) but Nd = 0 / PFD ~ 1
 *     (no flips in the diff stream at all). On noisy
 *     heavy-tailed token-count series the two decouple
 *     because a strongly trending series with occasional dips
 *     can have low ZCR (mean-crossings rare) and high PFD
 *     (each dip creates two diff-sign-flips).
 *   - vs. `turning-point-count` (TPC): TPC reports the **raw
 *     count** of local extrema. PFD wraps that count in
 *     Petrosian's specific log-ratio with N, producing a
 *     **length-normalised dimensional quantity** in `[1, 2]`
 *     rather than a raw integer count. Ranking sources by TPC
 *     vs by PFD does not preserve order in general because
 *     TPC is not normalised by N — a long source with many
 *     extrema can have lower PFD than a short source with
 *     fewer extrema if its extrema/length ratio is lower.
 *     This is exactly the length-bias correction Petrosian
 *     introduced.
 *   - vs. `runs-test-z` (Wald-Wolfowitz): runs-test
 *     binarises by the **median of v** (not the diff sign);
 *     produces a Z-score against expected runs under
 *     independence, not a fractal dimension.
 *   - vs. `mann-kendall-trend`: M-K counts concordant vs
 *     discordant pairs across all `(i, j)` pairs (not just
 *     adjacent), then maps to a Z; PFD only looks at adjacent
 *     diffs.
 *   - vs. `autocorrelation-lag1`: linear, parametric, magnitude-
 *     sensitive; PFD is non-parametric and binary.
 *   - vs. `hjorth-mobility` / `hjorth-complexity`: variance
 *     ratios on the diff / second-diff series — magnitude-
 *     sensitive. PFD ignores magnitudes.
 *   - vs. `permutation-entropy` / `sample-entropy`: PE uses
 *     ordinal patterns of length m; SampEn uses tolerance-
 *     matched windows. PFD uses no embedding window.
 *   - vs. `lempel-ziv`: LZ counts unique factors in a
 *     **median-binarised** symbol sequence over the value
 *     domain. PFD counts **sign flips** in the
 *     **diff-binarised** symbol sequence. Different
 *     symbolisation, different statistic family (factor count
 *     vs sign-flip count).
 *   - vs. `renyi-entropy`: histogrammatic on the value
 *     distribution; order-invariant.
 *   - vs. `dfa` / `hurst-rs`: scaling exponents on the
 *     cumulative-deviation profile; PFD has no cumulative
 *     profile.
 *   - vs. all order-invariant dispersion / shape lenses
 *     (`-iqr-ratio`, `-mad`, `-skewness`, `-kurtosis`, `-gini`,
 *     `-burstiness-coefficient`, `-coefficient-of-variation`):
 *     shuffling the sequence leaves them unchanged but
 *     dramatically inflates Nd / PFD because shuffling
 *     destroys runs of consistent-sign diffs.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All values equal: surfaces under `droppedZeroVariance`.
 *   - `M < 2` after the sign mapping: surfaces under
 *     `droppedDegenerate` (cannot happen for `N >= minRows >= 4`
 *     under the default zero-rule, but the gate is retained
 *     defensively).
 *   - PFD outside `[1, 2]`: reported but `clampedBelow1` /
 *     `clampedAbove2` incremented; `pfd` carries the clamped
 *     value, `pfdRaw` carries the raw value.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenPetrosianFdSort =
  | 'pfd-asc'
  | 'pfd-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenPetrosianFdOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4`. Default 16.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'pfd-asc' (default): PFD ascending — smoothest first.
   *   - 'pfd-desc':          PFD descending — wiggliest first.
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenPetrosianFdSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenPetrosianFdRow {
  source: string;
  rowsKept: number;
  /** Effective length of the diff sign sequence (= N - 1). */
  M: number;
  /** Number of adjacent sign changes in the diff sign sequence. */
  Nd: number;
  /** Number of dv == 0 entries (informational). */
  zeroDiffs: number;
  /** Estimated Petrosian Fractal Dimension, clamped to [1, 2]. */
  pfd: number;
  /** Raw PFD prior to clamping; equals `pfd` unless clamping fired. */
  pfdRaw: number;
}

export interface SourceRowTokenPetrosianFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenPetrosianFdSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  clampedBelow1: number;
  clampedAbove2: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenPetrosianFdRow[];
}

const VALID_SORTS = ['pfd-asc', 'pfd-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenPetrosianFd(
  queue: QueueLine[],
  opts: SourceRowTokenPetrosianFdOptions = {},
): SourceRowTokenPetrosianFdReport {
  const minRows = opts.minRows ?? 16;
  if (!Number.isInteger(minRows) || minRows < 4) {
    throw new Error(
      `minRows must be an integer >= 4 (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'pfd-asc';
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
  let clampedBelow1 = 0;
  let clampedAbove2 = 0;

  const allRows: SourceRowTokenPetrosianFdRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const N = v.length;

    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let allEqual = true;
    for (let i = 1; i < N; i++) {
      if (v[i] !== v[0]) {
        allEqual = false;
        break;
      }
    }
    if (allEqual) {
      droppedZeroVariance += 1;
      continue;
    }

    // Build the diff sign sequence; zero -> +1.
    let zeroDiffs = 0;
    const signs: number[] = new Array(N - 1);
    for (let i = 0; i < N - 1; i++) {
      const d = v[i + 1]! - v[i]!;
      if (d === 0) zeroDiffs += 1;
      signs[i] = d >= 0 ? 1 : -1;
    }
    const M = signs.length;
    if (M < 2) {
      droppedDegenerate += 1;
      continue;
    }

    let Nd = 0;
    for (let i = 0; i < M - 1; i++) {
      if (signs[i] !== signs[i + 1]) Nd += 1;
    }

    const logM = Math.log10(M);
    const denomInner = M / (M + 0.4 * Nd);
    const logRatio = Math.log10(denomInner);
    const denom = logM + logRatio;
    if (!Number.isFinite(denom) || denom === 0 || logM <= 0) {
      droppedDegenerate += 1;
      continue;
    }

    const pfdRaw = logM / denom;
    if (!Number.isFinite(pfdRaw)) {
      droppedDegenerate += 1;
      continue;
    }
    let pfd = pfdRaw;
    if (pfdRaw < 1) {
      pfd = 1;
      clampedBelow1 += 1;
    } else if (pfdRaw > 2) {
      pfd = 2;
      clampedAbove2 += 1;
    }

    allRows.push({
      source,
      rowsKept: N,
      M,
      Nd,
      zeroDiffs,
      pfd,
      pfdRaw,
    });
  }

  function pfdKey(row: SourceRowTokenPetrosianFdRow, asc: boolean): number {
    if (!Number.isFinite(row.pfd))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.pfd;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'pfd-asc') {
      primary = pfdKey(a, true) - pfdKey(b, true);
    } else if (sort === 'pfd-desc') {
      primary = pfdKey(b, false) - pfdKey(a, false);
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
    droppedZeroVariance,
    droppedDegenerate,
    clampedBelow1,
    clampedAbove2,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
