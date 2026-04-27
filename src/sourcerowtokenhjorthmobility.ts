/**
 * source-row-token-hjorth-mobility: per-source **Hjorth
 * Mobility** of Hjorth (1970) on the per-row `total_tokens`
 * time-ordered sequence.
 *
 * Headline question: **for each source, what is the typical
 * step-to-step rate of change of the token-count series,
 * normalised by the overall amplitude of the series?**
 *
 * Construction (Hjorth 1970, EEG Clin. Neurophysiol. 29:306-310):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      so the lens sees the actual temporal sequence v[0..N-1].
 *   4. Skip the source if `n < minRows` (default 16; mobility
 *      is a ratio of two variances and needs enough samples
 *      for both to be stable).
 *   5. Skip the source if `var(v) == 0` (constant series:
 *      diff series is also identically zero, so `var(dv) == 0`
 *      and the ratio `0/0` is undefined). Surfaces under
 *      `droppedZeroVariance`. This is an honest drop, not a
 *      "mobility = 0" report.
 *   6. Compute the **first difference** sequence
 *      `dv[i] = v[i+1] - v[i]` for `i = 0..N-2` (length N-1).
 *   7. Compute population variances:
 *        - `var_v  = (1/N)     * sum_i (v[i]  - mean(v))^2`
 *        - `var_dv = (1/(N-1)) * sum_i (dv[i] - mean(dv))^2`
 *      (Hjorth's original definition uses the **population**
 *      variance over the available samples; we follow that
 *      convention.)
 *   8. **Hjorth Mobility:** `mobility = sqrt(var_dv / var_v)`.
 *      Units: inverse-sample (1 / step). On a perfectly smooth
 *      DC-like series, `var_dv = 0` and `mobility = 0`. On a
 *      pure white-noise series, `var_dv ~ 2 * var_v` (because
 *      `var(v[i+1]-v[i]) = var(v[i+1]) + var(v[i])` for
 *      uncorrelated samples) and `mobility ~ sqrt(2) ~ 1.414`.
 *      For a sinusoid `v[i] = A sin(omega i)` the mobility
 *      converges to `2 sin(omega/2)` in the discrete-time
 *      formulation (= omega for small omega), which is the
 *      origin of Hjorth's interpretation of mobility as the
 *      "mean angular frequency" of the signal.
 *   9. Skip the source under `droppedDegenerate` if any of the
 *      following non-recoverable conditions hits:
 *        - `var_v <= 0` (already gated by zero-variance, but
 *          guards against floating-point underflow)
 *        - the ratio is non-finite or negative
 *
 * Reading mobility:
 *   - mobility ~ 0       = step-to-step changes negligible
 *                          relative to overall amplitude
 *                          (heavily smoothed / DC-dominated).
 *   - mobility ~ 1       = consecutive samples share roughly
 *                          half their variance with a one-step
 *                          delay (mildly correlated).
 *   - mobility ~ sqrt(2) = pure white noise (consecutive
 *                          samples uncorrelated).
 *   - mobility > sqrt(2) = anti-correlated / oscillatory at
 *                          the Nyquist scale (each sample
 *                          tends to flip sign relative to the
 *                          previous).
 *   - The mobility is **scale-invariant** (multiplying every
 *     v[i] by a positive constant cancels out of the ratio),
 *     so cross-source comparisons are valid even when sources
 *     differ in absolute token magnitude by orders of magnitude.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-katz-fd` (KFD) and
 *     `source-row-token-higuchi-fd` (HFD): both are
 *     **path-length-to-extent** (KFD) or **path-length-vs-stride**
 *     (HFD) geometric ratios. Mobility is a **variance ratio**
 *     between the original series and its first difference; it
 *     is dimensionally and definitionally distinct. KFD/HFD on
 *     a pure-sinusoid input depend on the amplitude through the
 *     i-axis padding (KFD) or the path-length scaling (HFD);
 *     mobility on the same sinusoid is amplitude-independent
 *     and depends only on the angular frequency.
 *   - `source-row-token-dfa` (DFA-p): DFA examines the rms
 *     residual scaling of a **cumulative profile** within
 *     sliding windows. Mobility looks at the **first
 *     difference** at lag 1 only and never integrates. The two
 *     are at opposite ends of the integration / differentiation
 *     spectrum.
 *   - `source-row-token-hurst-rs` (R/S): R/S looks at the
 *     **range of cumulative deviations** divided by stddev
 *     across windows of varying size. Mobility is a single
 *     fixed-lag variance ratio and does not aggregate across
 *     window sizes.
 *   - `source-row-token-autocorrelation-lag1` (rho_1): there
 *     is a known **algebraic identity** in the limit of large
 *     N for a stationary series:
 *     `mobility^2 = 2 * (1 - rho_1)`. So mobility is a strict
 *     monotone transform of lag-1 autocorrelation **for purely
 *     stationary series**. For real, non-stationary,
 *     mixed-regime token-count series the identity does not
 *     hold exactly — mobility uses the **empirical population
 *     variance of the diff series** while rho_1 uses the
 *     **lag-1 covariance normalised by the original variance**;
 *     these differ whenever the diff series has a non-zero
 *     mean (i.e. there is drift), so the two lenses give
 *     genuinely different rankings under drift. This lens is
 *     additionally useful because mobility surfaces an
 *     **absolute frequency-style scale** (in 1/step) whereas
 *     rho_1 is a unitless correlation; they are reported in
 *     different units and read by operators in different ways.
 *   - `source-row-token-permutation-entropy` (PE): PE is
 *     **ordinal-only** — value-blind beyond rank order.
 *     Mobility is fully metric: actual numeric magnitudes
 *     drive both numerator and denominator.
 *   - `source-row-token-sample-entropy` (SampEn): SampEn is a
 *     **single-scale conditional irregularity** based on
 *     tolerance-matching of length-m windows. Mobility has no
 *     notion of pattern matching and operates only on one
 *     summary statistic of the diff series.
 *   - `source-row-token-mann-kendall-trend` / `-runs-test` /
 *     `-turning-point-count`: directional / dichotomy /
 *     extremum tests, not a variance ratio.
 *   - `source-row-token-lempel-ziv` / `-renyi-entropy` /
 *     `-shannon-*`: symbolic / histogrammatic, value-domain
 *     or order-invariant respectively. Mobility is metric and
 *     order-sensitive.
 *   - All order-invariant dispersion / shape lenses
 *     (-iqr-ratio, -mad, -skewness, -kurtosis, -gini,
 *     -burstiness-coefficient, -coefficient-of-variation):
 *     shuffling the sequence leaves them unchanged but
 *     dramatically inflates `var_dv` (and thus mobility)
 *     because shuffling destroys any positive temporal
 *     correlation that suppresses consecutive deltas.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `var(v) == 0`: surfaces under `droppedZeroVariance`.
 *   - `var(v) > 0` but ratio non-finite (floating-point
 *     overflow on extreme inputs): surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenHjorthMobilitySort =
  | 'mobility-asc'
  | 'mobility-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenHjorthMobilityOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4`. Default 16. Mobility is a ratio
   * of two variances; below this length both estimates become
   * very noisy.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'mobility-asc' (default): mobility ascending — smoothest first.
   *   - 'mobility-desc':           mobility descending — most jittery first.
   *   - 'rows':                    rowsKept desc.
   *   - 'source':                  source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenHjorthMobilitySort;
  /**
   * If true, subtract the OLS linear trend from each per-source
   * value sequence before computing var(v) and var(diff(v)).
   * Default false.
   *
   * Why this is **genuinely orthogonal** to the no-detrend
   * default and not just a tuning knob: a strong linear drift
   * on a stationary noise process inflates `var(v)` quadratically
   * with N (the trend variance dominates) while leaving
   * `var(diff(v))` essentially unchanged (because the trend
   * contributes a constant `b` to every diff and `var(b) = 0`).
   * That biases the no-detrend mobility **downward** toward 0
   * for any series with strong drift, regardless of the
   * underlying step-to-step jitter. Detrending strips out
   * that quadratic-in-N denominator inflation and exposes the
   * **true ratio of step-to-step jitter to fluctuation
   * amplitude around the trend**, which is the regime
   * operators usually want when ranking sources by "how noisy
   * is this once you account for its growth".
   *
   * Worked example: a sequence `v[i] = i + e[i]` with `e[i]`
   * iid zero-mean unit-variance noise has
   * `var(v) ~ N^2/12 + 1` (trend variance dominates for
   * large N) but `var(diff(v)) ~ 2 + var(b) = 2` (since the
   * diff of the trend is the constant `b = 1`). No-detrend
   * mobility ~ sqrt(2 / (N^2/12)) -> 0 as N grows. Detrended
   * mobility on the same series stays at ~ sqrt(2) for all N
   * — the white-noise asymptote correctly recovered.
   */
  detrend?: boolean;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenHjorthMobilityRow {
  source: string;
  rowsKept: number;
  /** Population variance of v. */
  varV: number;
  /** Population variance of the first-difference series. */
  varDv: number;
  /** Hjorth mobility = sqrt(varDv / varV). */
  mobility: number;
}

export interface SourceRowTokenHjorthMobilityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  detrend: boolean;
  sort: SourceRowTokenHjorthMobilitySort;
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
  sources: SourceRowTokenHjorthMobilityRow[];
}

const VALID_SORTS = [
  'mobility-asc',
  'mobility-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenHjorthMobility(
  queue: QueueLine[],
  opts: SourceRowTokenHjorthMobilityOptions = {},
): SourceRowTokenHjorthMobilityReport {
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
  const sort = opts.sort ?? 'mobility-asc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }
  const detrend = opts.detrend ?? false;

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

  const allRows: SourceRowTokenHjorthMobilityRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    let v = samples.map((s) => s[1]);
    const N = v.length;

    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    if (detrend) {
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < N; i++) {
        sx += i;
        sy += v[i]!;
      }
      const xbar = sx / N;
      const ybar = sy / N;
      let sxx = 0;
      let sxy = 0;
      for (let i = 0; i < N; i++) {
        const dx = i - xbar;
        sxx += dx * dx;
        sxy += dx * (v[i]! - ybar);
      }
      const b = sxx === 0 ? 0 : sxy / sxx;
      const a = ybar - b * xbar;
      const detrended: number[] = new Array(N);
      for (let i = 0; i < N; i++) detrended[i] = v[i]! - (a + b * i);
      v = detrended;
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
    let meanDv = 0;
    const dv: number[] = new Array(M);
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

    if (!(varV > 0)) {
      droppedDegenerate += 1;
      continue;
    }

    const ratio = varDv / varV;
    if (!Number.isFinite(ratio) || ratio < 0) {
      droppedDegenerate += 1;
      continue;
    }
    const mobility = Math.sqrt(ratio);

    allRows.push({
      source,
      rowsKept: N,
      varV,
      varDv,
      mobility,
    });
  }

  function mobilityKey(
    row: SourceRowTokenHjorthMobilityRow,
    asc: boolean,
  ): number {
    if (!Number.isFinite(row.mobility))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.mobility;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'mobility-asc') {
      primary = mobilityKey(a, true) - mobilityKey(b, true);
    } else if (sort === 'mobility-desc') {
      primary = mobilityKey(b, false) - mobilityKey(a, false);
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
    detrend,
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
