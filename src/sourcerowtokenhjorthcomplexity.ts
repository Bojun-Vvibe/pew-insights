/**
 * source-row-token-hjorth-complexity: per-source **Hjorth
 * Complexity** of Hjorth (1970, EEG Clin. Neurophysiol.
 * 29:306-310) on the per-row `total_tokens` time-ordered
 * sequence. Natural follow-up to `source-row-token-hjorth-
 * mobility`: composes mobility on `v` and on `diff(v)`.
 *
 * Headline question: **for each source, does the signal's
 * step-to-step frequency content stay constant (complexity ~ 1,
 * sine-like / single-tone) or does it diversify (complexity > 1,
 * noise-like / multi-tone) across scales?**
 *
 * Construction (Hjorth 1970):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      to obtain v[0..N-1].
 *   4. Skip if `n < minRows` (default 24; complexity is a ratio
 *      of two mobilities, so it needs enough samples for both
 *      `var(v)`, `var(dv)`, and `var(ddv)` to be stable —
 *      stricter than mobility's own default of 16).
 *   5. Compute `dv[i] = v[i+1] - v[i]` (length N-1) and
 *      `ddv[i] = dv[i+1] - dv[i]` (length N-2).
 *   6. Compute population variances of v, dv, ddv.
 *   7. Skip under `droppedZeroVariance` if `var(v) == 0` (a
 *      constant series has both diff and second-diff identically
 *      zero; complexity = 0/0). Skip under `droppedFlatDiff` if
 *      `var(dv) == 0` while `var(v) > 0` (a perfect linear ramp:
 *      mobility itself is well-defined and equals 0, but
 *      complexity = 0/0 because both diff series are constant).
 *      This is a meaningful and honest drop, not a "complexity =
 *      0" or "complexity = NaN" report.
 *   8. **Hjorth Mobility:** `mobV  = sqrt(var(dv)  / var(v))`.
 *   9. **Hjorth Mobility of diff:** `mobDv = sqrt(var(ddv) / var(dv))`.
 *  10. **Hjorth Complexity:** `complexity = mobDv / mobV`.
 *      Unitless. Hjorth's interpretation: how the signal's
 *      "mean frequency" of `dv` relates to that of `v`.
 *  11. Skip under `droppedDegenerate` if any computed quantity
 *      is non-finite or negative.
 *
 * Reading complexity:
 *   - complexity ~ 1   = signal's first difference has the same
 *                        characteristic frequency as the signal
 *                        itself; pure sinusoid is the canonical
 *                        case (cos and -sin share frequency).
 *                        Read as "single dominant frequency".
 *   - complexity > 1   = first difference is "more wiggly" than
 *                        the original; multi-frequency / noisier
 *                        / more spectral spread. Pure white noise
 *                        on both v and dv asymptotes to ~ 1
 *                        in expectation but typical empirical
 *                        finite-sample estimates run slightly
 *                        above 1.
 *   - complexity < 1   = first difference is *smoother* than
 *                        the original; happens for signals with
 *                        a strong slow envelope where dv removes
 *                        most of the slow drift but ddv stays
 *                        small. Rare on real data but possible
 *                        for chirps / slowly-modulated tones.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite, including
 * `source-row-token-hjorth-mobility`:
 *
 *   - vs. **hjorth-mobility**: mobility is the **first**
 *     spectral moment of the signal (variance of `dv` over
 *     variance of `v`); complexity is the **ratio of two
 *     mobilities** and thus tracks the **second** spectral
 *     moment (loosely, the spread of the spectrum, not its
 *     centre). Two sources with identical mobility can have
 *     very different complexities: a pure sinusoid at angular
 *     frequency w has mobility ~ w and complexity ~ 1, whereas
 *     band-limited white noise truncated at the same w has
 *     similar mobility but complexity strictly > 1.
 *   - vs. **katz-fd / higuchi-fd**: KFD/HFD are
 *     **path-length-based fractal dimensions**; complexity is
 *     a variance-ratio-of-variance-ratios. KFD on a sinusoid
 *     scales with amplitude through axis padding; complexity
 *     on the same sinusoid is amplitude-invariant and stays
 *     at ~ 1 regardless of amplitude or frequency.
 *   - vs. **dfa**: DFA looks at scaling of detrended cumulative
 *     residuals across window sizes; complexity uses no
 *     cumulation, only differentiation, and only at lags 1 and 2.
 *   - vs. **hurst-rs**: R/S aggregates across window sizes;
 *     complexity is a single fixed-lag ratio.
 *   - vs. **autocorrelation-lag1**: rho_1 captures only the
 *     first-order temporal correlation; complexity additionally
 *     captures the **change** in mobility under one application
 *     of the diff operator. There is no closed-form algebraic
 *     identity between complexity and rho_1 the way there is
 *     for mobility (`mobility^2 = 2*(1 - rho_1)` for stationary
 *     series); complexity's denominator carries information
 *     about lag-2 covariance through `var(ddv)`, which rho_1
 *     never sees.
 *   - vs. **permutation-entropy**: PE is ordinal-only, value-
 *     blind beyond rank order. Complexity is fully metric.
 *   - vs. **sample-entropy**: SampEn matches length-m windows
 *     within a tolerance; complexity uses two summary statistics
 *     and does no pattern matching.
 *   - vs. **mann-kendall / runs / turning-point**: monotonicity
 *     / dichotomy / extremum tests; not a variance ratio.
 *   - vs. **lempel-ziv / renyi-entropy / shannon**: symbolic /
 *     histogrammatic; complexity is fully metric and order-
 *     sensitive.
 *   - vs. **all order-invariant dispersion / shape lenses**
 *     (-iqr-ratio, -mad, -skewness, -kurtosis, -gini,
 *     -burstiness-coefficient, -coefficient-of-variation):
 *     shuffling the sequence leaves them unchanged but
 *     dramatically changes complexity (typically inflates it
 *     toward the white-noise regime).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `var(v) == 0`: surfaces under `droppedZeroVariance`.
 *   - `var(dv) == 0` while `var(v) > 0` (perfect linear ramp):
 *     surfaces under `droppedFlatDiff`.
 *   - any non-finite or negative computed quantity: surfaces
 *     under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenHjorthComplexitySort =
  | 'complexity-asc'
  | 'complexity-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenHjorthComplexityOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 6` (we need at least N-2 >= 4 to have
   * a stable second-diff variance estimate). Default 24.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'complexity-asc' (default): complexity ascending —
   *     most "single-tone" / sinusoidal first.
   *   - 'complexity-desc':           complexity descending —
   *     most "multi-tone" / noise-like first.
   *   - 'rows':                      rowsKept desc.
   *   - 'source':                    source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenHjorthComplexitySort;
  /**
   * Optional lower bound on reported complexity. Sources whose
   * computed complexity is strictly below this threshold are
   * suppressed from `sources[]` and counted under
   * `droppedBelowMinComplexity`. Default null (no filter).
   *
   * Why this is **genuinely orthogonal** to the unfiltered
   * default and not just a tuning knob: the typical operator
   * question with this lens is "which sources have
   * single-frequency-dominant token traffic (complexity ~ 1)
   * and which have spectrally-spread, noise-like traffic
   * (complexity > 1)". On a queue with many sources, the
   * single-tone tail at complexity ~ 1 dominates the report
   * visually and crowds out the few high-complexity outliers
   * that are actually anomaly candidates. `--min-complexity 1.5`
   * (or similar) suppresses the well-behaved sinusoidal
   * majority and surfaces only the spectrally-spread sources
   * worth investigating. Importantly the filter applies
   * **after** the natural-mathematical drops (zero-variance,
   * flat-diff, degenerate); a source that **fails** to compute
   * a complexity is still surfaced under its honest-drop
   * counter, not silently absorbed into the threshold counter.
   */
  minComplexity?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenHjorthComplexityRow {
  source: string;
  rowsKept: number;
  /** Population variance of v. */
  varV: number;
  /** Population variance of dv = diff(v). */
  varDv: number;
  /** Population variance of ddv = diff(diff(v)). */
  varDdv: number;
  /** Hjorth mobility of v: sqrt(varDv / varV). */
  mobility: number;
  /** Hjorth mobility of dv: sqrt(varDdv / varDv). */
  mobilityDv: number;
  /** Hjorth complexity = mobilityDv / mobility. */
  complexity: number;
}

export interface SourceRowTokenHjorthComplexityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenHjorthComplexitySort;
  minComplexity: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedFlatDiff: number;
  droppedDegenerate: number;
  droppedBelowMinComplexity: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenHjorthComplexityRow[];
}

const VALID_SORTS = [
  'complexity-asc',
  'complexity-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenHjorthComplexity(
  queue: QueueLine[],
  opts: SourceRowTokenHjorthComplexityOptions = {},
): SourceRowTokenHjorthComplexityReport {
  const minRows = opts.minRows ?? 24;
  if (!Number.isInteger(minRows) || minRows < 6) {
    throw new Error(
      `minRows must be an integer >= 6 (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'complexity-asc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }
  const minComplexity = opts.minComplexity ?? null;
  if (minComplexity !== null) {
    if (!Number.isFinite(minComplexity) || minComplexity < 0) {
      throw new Error(
        `minComplexity must be a non-negative finite number (got ${opts.minComplexity})`,
      );
    }
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
  let droppedFlatDiff = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenHjorthComplexityRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const N = v.length;

    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Population variance of v.
    let meanV = 0;
    for (let i = 0; i < N; i++) meanV += v[i]!;
    meanV /= N;
    let varV = 0;
    for (let i = 0; i < N; i++) {
      const d = v[i]! - meanV;
      varV += d * d;
    }
    varV /= N;

    if (varV === 0) {
      droppedZeroVariance += 1;
      continue;
    }

    // First-difference series and its population variance.
    const M = N - 1;
    const dv: number[] = new Array(M);
    let meanDv = 0;
    for (let i = 0; i < M; i++) {
      const d = v[i + 1]! - v[i]!;
      dv[i] = d;
      meanDv += d;
    }
    meanDv /= M;
    let varDv = 0;
    for (let i = 0; i < M; i++) {
      const c = dv[i]! - meanDv;
      varDv += c * c;
    }
    varDv /= M;

    if (varDv === 0) {
      droppedFlatDiff += 1;
      continue;
    }

    // Second-difference series and its population variance.
    const K = M - 1;
    let meanDdv = 0;
    const ddv: number[] = new Array(K);
    for (let i = 0; i < K; i++) {
      const d = dv[i + 1]! - dv[i]!;
      ddv[i] = d;
      meanDdv += d;
    }
    meanDdv /= K;
    let varDdv = 0;
    for (let i = 0; i < K; i++) {
      const c = ddv[i]! - meanDdv;
      varDdv += c * c;
    }
    varDdv /= K;

    const ratio1 = varDv / varV;
    const ratio2 = varDdv / varDv;
    if (
      !Number.isFinite(ratio1) ||
      ratio1 < 0 ||
      !Number.isFinite(ratio2) ||
      ratio2 < 0
    ) {
      droppedDegenerate += 1;
      continue;
    }
    const mobility = Math.sqrt(ratio1);
    const mobilityDv = Math.sqrt(ratio2);
    if (!(mobility > 0)) {
      droppedDegenerate += 1;
      continue;
    }
    const complexity = mobilityDv / mobility;
    if (!Number.isFinite(complexity) || complexity < 0) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: N,
      varV,
      varDv,
      varDdv,
      mobility,
      mobilityDv,
      complexity,
    });
  }

  function complexityKey(
    row: SourceRowTokenHjorthComplexityRow,
    asc: boolean,
  ): number {
    if (!Number.isFinite(row.complexity))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.complexity;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'complexity-asc') {
      primary = complexityKey(a, true) - complexityKey(b, true);
    } else if (sort === 'complexity-desc') {
      primary = complexityKey(b, false) - complexityKey(a, false);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinComplexity = 0;
  let postRows = allRows;
  if (minComplexity !== null) {
    const kept: SourceRowTokenHjorthComplexityRow[] = [];
    for (const row of postRows) {
      if (row.complexity < minComplexity) {
        droppedBelowMinComplexity += 1;
        continue;
      }
      kept.push(row);
    }
    postRows = kept;
  }
  let finalSources = postRows;
  if (top !== null && postRows.length > top) {
    droppedBelowTopCap = postRows.length - top;
    finalSources = postRows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minRows,
    top,
    sort,
    minComplexity,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroVariance,
    droppedFlatDiff,
    droppedDegenerate,
    droppedBelowMinComplexity,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
