/**
 * source-row-token-hurst-rs: per-source **Hurst exponent via classical
 * rescaled-range (R/S) analysis** on the per-row `total_tokens`
 * time-ordered sequence.
 *
 * Headline question: **for each source, does the per-row token volume
 * exhibit long-range dependence — i.e. is the sequence persistent
 * (H > 0.5, large rows tend to be followed by large rows over many
 * scales), mean-reverting (H < 0.5, large rows tend to be followed by
 * small rows), or close to a memoryless random walk (H ~ 0.5)?**
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`
 *      (`droppedInvalidHourStart`), non-finite or negative
 *      `total_tokens` (`droppedInvalidTokens` /
 *      `droppedNegativeTokens`).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence,
 *      not insertion order.
 *   4. Per source: skip if `n < minRows` (default 32 — R/S needs
 *      enough points to support at least three log-spaced window
 *      scales; below ~32 the regression has too few points to be
 *      meaningful; counted under `droppedBelowMinRows`).
 *   5. Choose a log-spaced set of window sizes in
 *      `[minWindow, floor(n / 2)]`. `minWindow` defaults to 8;
 *      caller can raise via `--min-window`. We pick scales
 *      `m_k = round(minWindow * (1 + step)^k)` with step chosen so
 *      we get at most `maxScales` (default 12) distinct scales,
 *      monotone increasing, all `>= minWindow` and `<= floor(n/2)`.
 *      Duplicate consecutive rounds are collapsed. If fewer than
 *      `minScales` (default 3) distinct usable scales survive,
 *      the source is dropped under `droppedBelowMinScales`.
 *   6. For each window size m: split the series into
 *      `K = floor(n / m)` **non-overlapping** chunks of length m
 *      (drop the trailing remainder; this is the standard R/S
 *      construction). For each chunk:
 *        - mean mu = (1/m) sum_i x_i
 *        - deviations d_i = x_i - mu
 *        - cumulative deviations Z_t = sum_{i=1..t} d_i
 *        - range R = max(Z) - min(Z)
 *        - sample stddev S = sqrt( (1/m) sum_i (x_i - mu)^2 )
 *          (population form, the classical R/S convention)
 *        - if S == 0 (constant chunk), skip the chunk and count
 *          it under `degenerateChunks` for the source. If all
 *          chunks at scale m are degenerate, drop the scale and
 *          count it under `droppedScalesAllDegenerate`.
 *      `(R/S)_m` = arithmetic mean of `R / S` over the surviving
 *      chunks at that scale.
 *   7. Fit an OLS line: `log((R/S)_m) = H * log(m) + c` over the
 *      surviving scales, weighted equally per scale (the
 *      classical Mandelbrot construction; not weighting by chunk
 *      count keeps the slope estimator from being dominated by the
 *      smallest scales which have the most chunks). Report:
 *        - `hurst` = slope (H)
 *        - `intercept` = c
 *        - `r2` = coefficient of determination of the log-log fit
 *                 (uncentered would not give the usual
 *                 [0, 1] reading; we use the centered R^2 form
 *                 1 - SSres/SStot)
 *        - `scalesUsed` = number of `(m, R/S)` points fed to OLS.
 *   8. Reading H:
 *      - `H ~ 0.5`: random walk / no long-range memory.
 *      - `H > 0.5`: **persistent** — increments are positively
 *        correlated across many scales (a busy source tends to
 *        stay busy; a slow patch tends to stay slow). Common in
 *        bursty/heavy-tailed traffic.
 *      - `H < 0.5`: **anti-persistent** / mean-reverting — large
 *        rows are more likely than chance to be followed by small
 *        rows across many scales. Indicates a regulated /
 *        clipped / quota-driven generator.
 *      - `H near 0` or `H > 1`: regression is unreliable —
 *        almost certainly a degenerate / quantised series; check
 *        `r2` and `scalesUsed` before trusting it.
 *
 * Why this lens is **genuinely orthogonal** to every existing
 * `source-row-token-*` lens:
 *
 *   - `source-row-token-mann-kendall-trend` and
 *     `source-daily-token-trend-slope` measure **monotone trend**
 *     (a single direction). R/S Hurst measures **multi-scale
 *     correlation structure of the increments** — a source can
 *     have `tau ~ 0` (no net trend) and still show `H = 0.8`
 *     (long persistent runs that happen to balance out), or
 *     `H = 0.3` (anti-persistent zig-zag with no net direction).
 *     The Hurst regression is **direction-agnostic**.
 *   - `source-row-token-runs-test` is a **single-scale**
 *     dichotomous test on the median sign sequence. R/S is
 *     **multi-scale** and operates on the raw values.
 *     Anti-persistent series with H < 0.5 will typically show
 *     `Z >> 0` under runs-test (lots of alternation) but
 *     runs-test cannot distinguish anti-persistence from a fair
 *     i.i.d. coin at one scale.
 *   - `source-row-token-autocorrelation-lag1` is a **single
 *     lag**, **linear-parametric** Pearson rho. Hurst R/S
 *     aggregates correlation behaviour across **many scales**
 *     and so can detect long-range dependence that lag-1 misses
 *     entirely (FARIMA-style processes can have rho_1 close to
 *     0 but H clearly above 0.5 because the slow-decay
 *     correlation lives at lag 10, 100, 1000 ...).
 *   - `source-row-token-permutation-entropy` measures **local
 *     ordinal-pattern uniformity at a fixed scale m=3**. Hurst
 *     measures the **scaling behaviour of the variance of
 *     cumulative deviations**. PE is a complexity / entropy
 *     scalar; H is a self-similarity / memory scalar.
 *   - `source-row-token-turning-point-count` is a **first-
 *     difference jaggedness** count. An H = 0.3 series and an
 *     H = 0.7 series can have similar turning-point counts but
 *     wildly different R/S scaling.
 *   - `source-row-token-burstiness-coefficient`,
 *     `-coefficient-of-variation`, `-iqr-ratio`, `-mad`,
 *     `-gini`, `-skewness`, `-kurtosis`: all **order-invariant**
 *     dispersion / shape scalars; shuffling the row sequence
 *     leaves them unchanged but typically pushes H toward 0.5
 *     (the i.i.d. expectation under R/S, modulo small-sample
 *     bias). H is the order-sensitive scaling lens.
 *
 * Edge cases:
 *
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `n` large enough but the resolved log-spaced scale grid
 *     yields fewer than `minScales` distinct usable scales:
 *     surfaces under `droppedBelowMinScales`.
 *   - All values equal: every chunk has S = 0, every scale is
 *     all-degenerate, source drops under `droppedAllDegenerate`.
 *   - Strict monotone series: R grows linearly per chunk while S
 *     grows sub-linearly; classical R/S yields H close to 1 (the
 *     classical "trended series" failure mode of R/S — the user
 *     should cross-check with `source-row-token-mann-kendall-
 *     trend` before claiming long-range dependence on a trended
 *     source). We report this honestly and let the operator
 *     reason; we do **not** detrend.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenHurstRsSort =
  | 'hurst-asc'
  | 'hurst-desc'
  | 'abs-hurst-deviation-desc'
  | 'r2-desc'
  | 'rows'
  | 'scales'
  | 'source';

export interface SourceRowTokenHurstRsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Default 32 —
   * R/S needs enough points to support a multi-scale regression.
   * Must be an integer >= 16.
   */
  minRows?: number;
  /**
   * Smallest window size to consider when building the log-spaced
   * scale grid. Must be an integer >= 4. Default 8.
   */
  minWindow?: number;
  /**
   * Maximum number of distinct log-spaced scales to evaluate
   * (the actual count may be smaller after deduping rounded
   * scales and clipping at floor(n/2)). Must be an integer >= 3.
   * Default 12.
   */
  maxScales?: number;
  /**
   * Minimum number of distinct usable scales for the source to
   * survive (otherwise drops under `droppedBelowMinScales`).
   * Must be an integer >= 3. Default 3.
   */
  minScales?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  sort?: SourceRowTokenHurstRsSort;
  generatedAt?: string;
}

export interface SourceRowTokenHurstRsRow {
  source: string;
  rowsKept: number;
  /** Hurst exponent: OLS slope of log((R/S)_m) vs log(m). */
  hurst: number;
  /** OLS intercept of the log-log fit. */
  intercept: number;
  /** Centered R^2 of the log-log regression in [0, 1] (or 1 if SStot=0). */
  r2: number;
  /** Number of (m, R/S) points fed to the OLS regression. */
  scalesUsed: number;
  /** Smallest scale m used. */
  minScaleUsed: number;
  /** Largest scale m used. */
  maxScaleUsed: number;
  /** Chunks skipped across all scales because their stddev was 0. */
  degenerateChunks: number;
  /** Scales skipped because every chunk at that scale was degenerate. */
  scalesDroppedAllDegenerate: number;
}

export interface SourceRowTokenHurstRsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minWindow: number;
  maxScales: number;
  minScales: number;
  top: number | null;
  sort: SourceRowTokenHurstRsSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinScales: number;
  droppedAllDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenHurstRsRow[];
}

const VALID_SORTS = [
  'hurst-asc',
  'hurst-desc',
  'abs-hurst-deviation-desc',
  'r2-desc',
  'rows',
  'scales',
  'source',
] as const;

/**
 * Build a strictly-increasing list of log-spaced window sizes in
 * [minWindow, maxWindow], capped at maxCount distinct rounded values.
 */
function buildScales(
  minWindow: number,
  maxWindow: number,
  maxCount: number,
): number[] {
  if (maxWindow < minWindow) return [];
  if (maxWindow === minWindow) return [minWindow];
  if (maxCount === 1) return [minWindow];
  const out: number[] = [];
  // Geometric ratio so that minWindow * r^(maxCount-1) = maxWindow.
  const r = Math.pow(maxWindow / minWindow, 1 / (maxCount - 1));
  let last = -1;
  for (let k = 0; k < maxCount; k++) {
    const raw = minWindow * Math.pow(r, k);
    const m = Math.max(minWindow, Math.min(maxWindow, Math.round(raw)));
    if (m !== last) {
      out.push(m);
      last = m;
    }
  }
  // Ensure final scale is at most maxWindow (it should be by construction).
  return out;
}

export function buildSourceRowTokenHurstRs(
  queue: QueueLine[],
  opts: SourceRowTokenHurstRsOptions = {},
): SourceRowTokenHurstRsReport {
  const minRows = opts.minRows ?? 32;
  if (!Number.isInteger(minRows) || minRows < 16) {
    throw new Error(
      `minRows must be an integer >= 16 (got ${opts.minRows})`,
    );
  }
  const minWindow = opts.minWindow ?? 8;
  if (!Number.isInteger(minWindow) || minWindow < 4) {
    throw new Error(
      `minWindow must be an integer >= 4 (got ${opts.minWindow})`,
    );
  }
  const maxScales = opts.maxScales ?? 12;
  if (!Number.isInteger(maxScales) || maxScales < 3) {
    throw new Error(
      `maxScales must be an integer >= 3 (got ${opts.maxScales})`,
    );
  }
  const minScales = opts.minScales ?? 3;
  if (!Number.isInteger(minScales) || minScales < 3) {
    throw new Error(
      `minScales must be an integer >= 3 (got ${opts.minScales})`,
    );
  }
  if (minScales > maxScales) {
    throw new Error(
      `minScales (${minScales}) must not exceed maxScales (${maxScales})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'abs-hurst-deviation-desc';
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
  let droppedBelowMinScales = 0;
  let droppedAllDegenerate = 0;

  const survived: SourceRowTokenHurstRsRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    if (samples.length < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    samples.sort((a, b) => a[0] - b[0]);
    const x = samples.map((s) => s[1]);
    const n = x.length;

    const maxWindow = Math.floor(n / 2);
    if (maxWindow < minWindow) {
      droppedBelowMinScales += 1;
      continue;
    }
    const scales = buildScales(minWindow, maxWindow, maxScales);
    if (scales.length < minScales) {
      droppedBelowMinScales += 1;
      continue;
    }

    let degenerateChunksTotal = 0;
    let scalesDroppedAllDegenerate = 0;

    const logM: number[] = [];
    const logRS: number[] = [];

    for (const m of scales) {
      const k = Math.floor(n / m);
      let chunkRsSum = 0;
      let chunkRsCount = 0;
      let degenerateThisScale = 0;
      for (let c = 0; c < k; c++) {
        const start = c * m;
        let sum = 0;
        for (let i = 0; i < m; i++) sum += x[start + i]!;
        const mu = sum / m;
        let cum = 0;
        let zMin = Infinity;
        let zMax = -Infinity;
        let sqDev = 0;
        for (let i = 0; i < m; i++) {
          const d = x[start + i]! - mu;
          cum += d;
          if (cum < zMin) zMin = cum;
          if (cum > zMax) zMax = cum;
          sqDev += d * d;
        }
        const stddev = Math.sqrt(sqDev / m);
        if (stddev === 0) {
          degenerateThisScale += 1;
          continue;
        }
        const range = zMax - zMin;
        chunkRsSum += range / stddev;
        chunkRsCount += 1;
      }
      degenerateChunksTotal += degenerateThisScale;
      if (chunkRsCount === 0) {
        scalesDroppedAllDegenerate += 1;
        continue;
      }
      const rsBar = chunkRsSum / chunkRsCount;
      // R/S of a constant-mean i.i.d. series is positive; defensive guard.
      if (rsBar <= 0) {
        scalesDroppedAllDegenerate += 1;
        continue;
      }
      logM.push(Math.log(m));
      logRS.push(Math.log(rsBar));
    }

    if (logM.length < minScales) {
      droppedAllDegenerate += 1;
      continue;
    }

    // OLS on (logM, logRS).
    const k = logM.length;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < k; i++) {
      sx += logM[i]!;
      sy += logRS[i]!;
    }
    const xbar = sx / k;
    const ybar = sy / k;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < k; i++) {
      const dx = logM[i]! - xbar;
      sxx += dx * dx;
      sxy += dx * (logRS[i]! - ybar);
    }
    if (sxx === 0) {
      // All scales collapsed to one log value; OLS undefined.
      droppedAllDegenerate += 1;
      continue;
    }
    const slope = sxy / sxx;
    const intercept = ybar - slope * xbar;

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < k; i++) {
      const yhat = slope * logM[i]! + intercept;
      const r = logRS[i]! - yhat;
      ssRes += r * r;
      const dy = logRS[i]! - ybar;
      ssTot += dy * dy;
    }
    const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

    survived.push({
      source,
      rowsKept: n,
      hurst: slope,
      intercept,
      r2,
      scalesUsed: k,
      minScaleUsed: Math.exp(logM[0]!),
      maxScaleUsed: Math.exp(logM[k - 1]!),
      degenerateChunks: degenerateChunksTotal,
      scalesDroppedAllDegenerate,
    });
  }

  // Round the min/max scale used back to integers for display.
  for (const r of survived) {
    r.minScaleUsed = Math.round(r.minScaleUsed);
    r.maxScaleUsed = Math.round(r.maxScaleUsed);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'hurst-asc') primary = a.hurst - b.hurst;
    else if (sort === 'hurst-desc') primary = b.hurst - a.hurst;
    else if (sort === 'abs-hurst-deviation-desc')
      primary = Math.abs(b.hurst - 0.5) - Math.abs(a.hurst - 0.5);
    else if (sort === 'r2-desc') primary = b.r2 - a.r2;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'scales') primary = b.scalesUsed - a.scalesUsed;
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
    minRows,
    minWindow,
    maxScales,
    minScales,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinScales,
    droppedAllDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
