/**
 * source-row-token-higuchi-fd: per-source **Higuchi Fractal
 * Dimension (HFD)** of Higuchi (1988) on the per-row
 * `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how geometrically rough
 * (path-length-wise) is the per-row token-count time-ordered curve
 * across multiple sub-sampling scales?** A purely smooth curve has
 * HFD -> 1. White noise has HFD -> 2. fBm with Hurst exponent H
 * has HFD = 2 - H asymptotically — i.e. HFD probes a **geometric
 * roughness** that is mathematically related to but **distinct in
 * estimator** from R/S-based Hurst.
 *
 * Construction (Higuchi 1988, Physica D, 31:277-283):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      so the test sees the actual temporal sequence v[0..N-1].
 *   4. Skip the source if `n < minRows` (default 16; needs enough
 *      length for the largest k to still have multiple
 *      first-differences). `minRows` must be `>= kMax + 2`.
 *   5. Skip the source if `sigma == 0` (a constant series gives a
 *      degenerate L(k) = 0 for every k -> log(0) is undefined).
 *      Surfaces under `droppedZeroVariance`. This is an honest
 *      drop, not a "HFD = 1" report.
 *   6. For each scale `k = 1..kMax` (default kMax = 8):
 *        For each starting index `m = 1..k`:
 *          Build the sub-series indices `m, m+k, m+2k, ...`
 *          Let `M = floor((N - m) / k)`  (number of jumps).
 *          If `M < 1`, skip this (m, k) pair.
 *          Compute the partial path length:
 *            `Lm(k) = (sum_{i=1..M} |v[m + i*k - 1] - v[m + (i-1)*k - 1]|) * (N - 1) / (M * k)`
 *          (The `(N - 1) / (M * k)` factor is Higuchi's
 *          normalisation so that L(k) is comparable across k.)
 *        Let `L(k) = (1/k) * sum_m Lm(k)`. We drop any k for
 *        which `L(k) == 0` (cannot take log) or where no valid
 *        (m, k) pair survived; surfaced under `kDropped`.
 *   7. Higuchi's relation: `L(k) ~ k^{-D}`. Estimate `D` by an
 *      **ordinary least-squares fit of `log(L(k))` against
 *      `log(1/k)`**. The slope is `D`.
 *      We require at least `minK` (default 4) usable scales for
 *      a stable fit; otherwise the row is dropped under
 *      `droppedTooFewScales`.
 *   8. Clamp the reported point estimate to the theoretical
 *      bracket [1, 2] — values outside that range are reported
 *      as the literal fitted slope but flagged via
 *      `clampedBelow1` / `clampedAbove2` counters; the underlying
 *      `slopeRaw` is preserved in the row so the operator can
 *      audit the raw fit.
 *
 * Reading HFD:
 *   - HFD ~ 1.0 = a smooth, low-roughness curve (path length
 *     barely grows as the sub-sampling grid shrinks).
 *   - HFD ~ 1.5 = roughness consistent with Brownian-motion
 *     increments (random-walk / 1/f^2 spectrum).
 *   - HFD ~ 2.0 = a maximally space-filling, anti-persistent
 *     curve (white-noise-like increments).
 *   - Strict numerical comparison across series is only valid
 *     when (kMax) and (approximately) `n` are held fixed.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-hurst-rs` (Hurst R/S): R/S is the
 *     classical **rescaled-range over partition scales**
 *     estimator — it measures the scaling of the **range of
 *     cumulative deviations** divided by stddev. HFD measures
 *     the scaling of the **arc length of the curve itself**
 *     across geometric sub-sampling lattices. Mathematically:
 *     R/S looks at second-order moments of the cumulative
 *     process; HFD looks at first-order absolute increments
 *     of the original process at multiple step sizes. The two
 *     are exactly equivalent only for ideal fBm (`HFD = 2 - H`
 *     in that special case); for empirical mixed-regime
 *     sequences (drift + heteroscedasticity + heavy tails) the
 *     two estimators routinely disagree by a substantial margin
 *     because R/S is biased upward by short-range memory while
 *     HFD is biased upward by high-frequency noise. Concretely:
 *     ranking sources by Hurst-R/S vs by HFD on the same data
 *     does **not** preserve order in general.
 *   - `source-row-token-permutation-entropy` (PE): PE is
 *     ordinal-only — value-blind beyond rank order. HFD is a
 *     fully metric quantity: doubling all values doubles every
 *     |delta|, leaves L(k) ratios identical -> HFD invariant
 *     under affine scaling, but **changes** the magnitudes the
 *     PE bins ignore.
 *   - `source-row-token-sample-entropy` (SampEn): SampEn is a
 *     **single-scale conditional irregularity** at one chosen
 *     `(m, r)` based on tolerance-matching of length-m windows.
 *     HFD is a **multi-scale arc-length scaling exponent** with
 *     no notion of pattern matching at all.
 *   - `source-row-token-mann-kendall-trend` / `-runs-test` /
 *     `-turning-point-count`: directional / dichotomy /
 *     extremum tests, not arc-length scaling.
 *   - `source-row-token-autocorrelation-lag1`: linear, lag-1,
 *     parametric. HFD is non-parametric and integrates
 *     information across all sub-sampling scales `k = 1..kMax`.
 *   - All order-invariant dispersion / shape lenses (-iqr-ratio,
 *     -mad, -skewness, -kurtosis, -gini, -burstiness-coefficient,
 *     -coefficient-of-variation): shuffling the sequence leaves
 *     them unchanged but typically pushes HFD toward its
 *     high-roughness regime (HFD ~ 2).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`.
 *   - `kMax + 1 > n`: rejected at validation time.
 *   - For some scales `k` the L(k) sum may be exactly zero (e.g.
 *     a series that happens to be flat on every sub-grid at
 *     stride k). Those k's are dropped from the regression and
 *     counted under `kDropped` for that source.
 *   - Fewer than `minK` usable scales -> `droppedTooFewScales`.
 *   - Slope outside [1, 2] -> reported but `clampedBelow1` /
 *     `clampedAbove2` incremented; `slope` carries the clamped
 *     value in [1, 2] and `slopeRaw` carries the raw fit.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenHiguchiFdSort =
  | 'hfd-asc'
  | 'hfd-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenHiguchiFdOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Maximum sub-sampling stride `kMax`. Higuchi's regression
   * uses scales `k = 1..kMax`. Must be an integer in `[2, 64]`.
   * Default 8. Larger kMax buys more regression points but at
   * the cost of fewer first-differences per (m, k) pair, which
   * inflates variance of the L(k) estimate at large k.
   */
  kMax?: number;
  /**
   * Minimum number of usable scales (k's that produced a
   * positive L(k)) required to estimate the slope. Must be an
   * integer in `[2, kMax]`. Default 4.
   */
  minK?: number;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= kMax + 2`. Default 16.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'hfd-asc' (default): HFD ascending — smoothest first.
   *   - 'hfd-desc':          HFD descending — roughest first.
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenHiguchiFdSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenHiguchiFdRow {
  source: string;
  rowsKept: number;
  /** population stddev of v (informational; HFD itself is scale-invariant). */
  sigma: number;
  /** Number of scales k that produced a positive L(k) and entered the fit. */
  scalesUsed: number;
  /** Number of scales k that were dropped (L(k) <= 0 or empty subgrid). */
  kDropped: number;
  /**
   * Estimated Higuchi Fractal Dimension, clamped to [1, 2].
   */
  hfd: number;
  /**
   * Raw OLS slope of -log(L(k)) vs log(k). Equals `hfd` unless
   * the slope was outside [1, 2], in which case it is preserved
   * here for audit and `hfd` carries the clamped value.
   */
  slopeRaw: number;
  /** Coefficient of determination of the linear fit (in [0, 1]). */
  r2: number;
}

export interface SourceRowTokenHiguchiFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  kMax: number;
  minK: number;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenHiguchiFdSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedTooFewScales: number;
  clampedBelow1: number;
  clampedAbove2: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenHiguchiFdRow[];
}

const VALID_SORTS = ['hfd-asc', 'hfd-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenHiguchiFd(
  queue: QueueLine[],
  opts: SourceRowTokenHiguchiFdOptions = {},
): SourceRowTokenHiguchiFdReport {
  const kMax = opts.kMax ?? 8;
  if (!Number.isInteger(kMax) || kMax < 2 || kMax > 64) {
    throw new Error(`kMax must be an integer in [2, 64] (got ${opts.kMax})`);
  }
  const minK = opts.minK ?? 4;
  if (!Number.isInteger(minK) || minK < 2 || minK > kMax) {
    throw new Error(
      `minK must be an integer in [2, kMax=${kMax}] (got ${opts.minK})`,
    );
  }
  const minRows = opts.minRows ?? 16;
  if (!Number.isInteger(minRows) || minRows < kMax + 2) {
    throw new Error(
      `minRows must be an integer >= kMax+2 (=${kMax + 2}) (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'hfd-asc';
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
  let droppedTooFewScales = 0;
  let clampedBelow1 = 0;
  let clampedAbove2 = 0;

  const allRows: SourceRowTokenHiguchiFdRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const N = v.length;

    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Population stddev (informational + zero-variance gate).
    let mean = 0;
    for (let i = 0; i < N; i++) mean += v[i]!;
    mean /= N;
    let variance = 0;
    for (let i = 0; i < N; i++) {
      const d = v[i]! - mean;
      variance += d * d;
    }
    variance /= N;
    const sigma = Math.sqrt(variance);

    if (sigma === 0) {
      droppedZeroVariance += 1;
      continue;
    }

    // Compute L(k) for k = 1..kMax.
    const xs: number[] = []; // log(k)
    const ys: number[] = []; // log(L(k))
    let kDropped = 0;

    for (let k = 1; k <= kMax; k++) {
      let sumLm = 0;
      let validM = 0;
      for (let mStart = 1; mStart <= k; mStart++) {
        const M = Math.floor((N - mStart) / k);
        if (M < 1) continue;
        let absSum = 0;
        for (let i = 1; i <= M; i++) {
          const idx1 = mStart + i * k - 1;
          const idx0 = mStart + (i - 1) * k - 1;
          absSum += Math.abs(v[idx1]! - v[idx0]!);
        }
        // Higuchi normalisation: (N - 1) / (M * k)
        const Lm = (absSum * (N - 1)) / (M * k);
        sumLm += Lm;
        validM += 1;
      }
      if (validM === 0) {
        kDropped += 1;
        continue;
      }
      const Lk = sumLm / validM; // averaging over the m starts that survived
      if (!(Lk > 0)) {
        kDropped += 1;
        continue;
      }
      xs.push(Math.log(k));
      ys.push(Math.log(Lk));
    }

    if (xs.length < minK) {
      droppedTooFewScales += 1;
      continue;
    }

    // OLS: log(L) = a + b * log(k); HFD = -b.
    const n = xs.length;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i]!;
      sy += ys[i]!;
    }
    const xbar = sx / n;
    const ybar = sy / n;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i]! - xbar;
      sxx += dx * dx;
      sxy += dx * (ys[i]! - ybar);
    }
    if (sxx === 0) {
      droppedTooFewScales += 1;
      continue;
    }
    const b = sxy / sxx;
    const a = ybar - b * xbar;
    const slopeRaw = -b;

    // R^2 of the fit.
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const yhat = a + b * xs[i]!;
      const e = ys[i]! - yhat;
      ssRes += e * e;
      const d = ys[i]! - ybar;
      ssTot += d * d;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    let hfd = slopeRaw;
    if (slopeRaw < 1) {
      hfd = 1;
      clampedBelow1 += 1;
    } else if (slopeRaw > 2) {
      hfd = 2;
      clampedAbove2 += 1;
    }

    allRows.push({
      source,
      rowsKept: N,
      sigma,
      scalesUsed: n,
      kDropped,
      hfd,
      slopeRaw,
      r2,
    });
  }

  // Sort.
  function hfdKey(row: SourceRowTokenHiguchiFdRow, asc: boolean): number {
    if (!Number.isFinite(row.hfd))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.hfd;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'hfd-asc') {
      primary = hfdKey(a, true) - hfdKey(b, true);
    } else if (sort === 'hfd-desc') {
      primary = hfdKey(b, false) - hfdKey(a, false);
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
    kMax,
    minK,
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
    droppedTooFewScales,
    clampedBelow1,
    clampedAbove2,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
