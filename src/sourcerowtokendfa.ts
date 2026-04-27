/**
 * source-row-token-dfa: per-source **Detrended Fluctuation
 * Analysis (DFA) alpha exponent** of Peng et al. (1994) on the
 * per-row `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, how does the
 * detrended cumulative-sum-deviation fluctuation scale with
 * window size?** The exponent alpha distinguishes:
 *
 *   - alpha ~ 0.5 = uncorrelated white noise.
 *   - alpha < 0.5 = anti-persistent (a high value tends to be
 *     followed by a low value, large-step reversals).
 *   - 0.5 < alpha < 1 = long-range positive (persistent)
 *     correlations; alpha = 1 is 1/f noise (pink noise).
 *   - 1 < alpha < 1.5 = non-stationary, between 1/f and Brownian.
 *   - alpha = 1.5 = Brownian motion (integrated white noise).
 *   - alpha > 1.5 = even smoother / more drift-dominated than
 *     Brownian.
 *
 * Construction (Peng et al. 1994, Phys. Rev. E 49:1685-1689):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens`.
 *   3. Group by source, sort each group by `hour_start` ascending
 *      so we see the actual temporal sequence v[0..N-1].
 *   4. Skip if `n < minRows` (default 32; needs enough length
 *      for a regression over multiple window sizes). minRows
 *      must be >= 4 * scaleMin so we get >= 4 windows at the
 *      smallest scale.
 *   5. Compute the global mean vBar and the integrated
 *      profile `Y[i] = sum_{j=0..i} (v[j] - vBar)`. (This is
 *      DFA's defining cumulative deviation: it converts
 *      stationary noise into a random walk whose roughness
 *      reveals the correlation structure.)
 *   6. For each scale `s` in `[scaleMin, scaleMax]` (logarithmic
 *      grid; default scaleMin=4, scaleMax=floor(N/4)):
 *        Split Y into `floor(N/s)` non-overlapping windows of
 *        length s.
 *        In each window, fit an OLS linear trend `Y_hat = a + b*x`
 *        (DFA-1: linear detrending — this is what
 *        differentiates DFA from Hurst R/S, which uses no
 *        detrending of the cumulative sum at all).
 *        Compute the residual variance of that window, then
 *        average across all windows -> `F^2(s)`.
 *        `F(s) = sqrt(F^2(s))`.
 *      We require at least `minWindowsPerScale` (default 4)
 *      windows per scale, otherwise the scale is skipped and
 *      counted under `scalesDropped`.
 *   7. DFA's defining relation: `F(s) ~ s^alpha`. Estimate
 *      alpha by an **ordinary least-squares fit of `log(F(s))`
 *      against `log(s)`**. The slope is `alpha`.
 *      Require >= `minScales` usable scales; otherwise drop
 *      the source under `droppedTooFewScales`.
 *   8. Clamp the reported alpha to a sane theoretical bracket
 *      [0, 2]; values outside flag `clampedBelow0` /
 *      `clampedAbove2`. The raw fit is preserved as `alphaRaw`.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-hurst-rs` (Hurst R/S): R/S looks at the
 *     range of cumulative deviations divided by stddev across
 *     partition scales — **no detrending at all**. DFA detrends
 *     each window by its **local linear fit** before computing
 *     fluctuation. The two estimators coincide only for ideal
 *     fBm with no trend. Empirically, on series with even mild
 *     drift, R/S is biased upward by the trend (reports H near
 *     1) while DFA-1 absorbs the linear part and reports the
 *     true scaling of the residuals. Ranking sources by Hurst
 *     vs by DFA on the same data does **not** preserve order.
 *   - `source-row-token-higuchi-fd` (HFD): HFD measures the
 *     scaling of **arc length of the original sequence** at
 *     stride k. DFA measures the scaling of **detrended
 *     fluctuation of the cumulative deviation** at window size
 *     s. The two scaling exponents are mathematically related
 *     for ideal fBm (`HFD = 2 - alpha` in that limit) but in
 *     practice differ markedly on real data with drift +
 *     heteroscedasticity. HFD operates on increments; DFA
 *     operates on the integrated profile after local
 *     detrending — opposite ends of the integration ladder.
 *   - `source-row-token-permutation-entropy` (PE): PE is
 *     ordinal-only, scale-blind, and value-blind beyond rank
 *     order. DFA is fully metric and uses cumulative sums.
 *   - `source-row-token-sample-entropy` (SampEn): SampEn is
 *     **single-scale** conditional irregularity. DFA is
 *     **multi-scale** scaling of detrended fluctuation.
 *   - `source-row-token-mann-kendall` / `-runs-test` /
 *     `-turning-point-count`: directional / dichotomy /
 *     extremum tests; DFA is a power-law scaling exponent.
 *   - `source-row-token-autocorrelation-lag1`: linear, lag-1,
 *     parametric. DFA integrates information across all window
 *     sizes and is non-parametric.
 *   - `source-row-token-lempel-ziv`: symbolic complexity of a
 *     binarised sequence. DFA is real-valued, multi-scale, and
 *     based on cumulative deviation.
 *   - `source-row-token-renyi-entropy` and all order-invariant
 *     dispersion / shape lenses: DFA is order-sensitive (its
 *     entire signal comes from temporal correlation structure).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`. (A
 *     constant series has Y[i] = 0 for all i, so F(s) = 0 for
 *     all s, log F(s) is undefined — we drop honestly rather
 *     than pretend alpha = anything.)
 *   - At very small s, all `floor(N/s)` windows of length s
 *     can be fit by OLS but if the residual variance is zero
 *     in every window (e.g. perfect ramp), F(s) = 0; that
 *     scale is dropped, counted under `scalesDropped`.
 *   - Fewer than `minScales` usable scales -> drop under
 *     `droppedTooFewScales`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenDfaSort =
  | 'alpha-asc'
  | 'alpha-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenDfaOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Minimum window size s. Integer >= 4 (need >= 4 points per
   * window to fit a meaningful linear detrend and still have
   * residual degrees of freedom). Default 4.
   */
  scaleMin?: number;
  /**
   * Maximum window size s. Integer in [scaleMin*2, floor(N/4)]
   * (need >= 4 windows at the largest scale for a stable
   * average). If null, defaults to floor(N/4) for each source
   * (so the actual max varies per source, surfaced in row).
   * Default null.
   */
  scaleMax?: number | null;
  /**
   * Minimum number of usable scales required to estimate alpha.
   * Integer >= 3. Default 4.
   */
  minScales?: number;
  /**
   * Minimum windows per scale required for that scale to enter
   * the regression. Integer >= 2. Default 4.
   */
  minWindowsPerScale?: number;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Integer >= 4 * scaleMin. Default 32.
   */
  minRows?: number;
  /**
   * Order of the per-window polynomial detrend (DFA-p).
   * - `1` = linear detrend (DFA-1, the canonical Peng et al. 1994
   *   default — eliminates first-order non-stationarity / linear
   *   trends within each window).
   * - `2` = quadratic detrend (DFA-2 — eliminates linear and
   *   quadratic trends, exposes the scaling of higher-order
   *   residual structure).
   * - `3` = cubic detrend (DFA-3 — eliminates up to cubic
   *   trends).
   * Higher orders are sensitive to higher-frequency / higher-
   * order non-stationarity and are **genuinely orthogonal** to
   * DFA-1 on real series with curvature: DFA-1 reports the
   * scaling of the residual after removing local *linear* drift,
   * DFA-2 reports the scaling after also removing local
   * *quadratic* drift. The two estimators agree on stationary
   * fGn but diverge in the presence of curvature, e.g. a
   * sinusoidal modulation will be partially absorbed by DFA-2
   * but not by DFA-1. Requires `scaleMin >= detrendOrder + 2`
   * so each window has residual DOF for the polynomial fit.
   * Integer in [1, 3]. Default 1.
   */
  detrendOrder?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'alpha-asc' (default): alpha ascending — most
   *     anti-persistent first.
   *   - 'alpha-desc':          alpha descending — most
   *     drift-dominated first.
   *   - 'rows':                rowsKept desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenDfaSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenDfaRow {
  source: string;
  rowsKept: number;
  /** Population stddev of v (informational; alpha is scale-invariant). */
  sigma: number;
  /** Smallest window size that entered the regression. */
  scaleMinUsed: number;
  /** Largest window size that entered the regression. */
  scaleMaxUsed: number;
  /** Number of scales s that produced a positive F(s) and entered the fit. */
  scalesUsed: number;
  /** Number of scales s that were dropped (F(s) <= 0 or too few windows). */
  scalesDropped: number;
  /**
   * Estimated DFA-1 alpha exponent, clamped to [0, 2].
   */
  alpha: number;
  /**
   * Raw OLS slope of log(F(s)) vs log(s). Equals `alpha` unless
   * the slope was outside [0, 2].
   */
  alphaRaw: number;
  /** Coefficient of determination of the linear fit (in [0, 1]). */
  r2: number;
}

export interface SourceRowTokenDfaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  scaleMin: number;
  scaleMax: number | null;
  minScales: number;
  minWindowsPerScale: number;
  minRows: number;
  detrendOrder: number;
  top: number | null;
  sort: SourceRowTokenDfaSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedTooFewScales: number;
  clampedBelow0: number;
  clampedAbove2: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenDfaRow[];
}

const VALID_SORTS = ['alpha-asc', 'alpha-desc', 'rows', 'source'] as const;

/** Build a logarithmic grid of integer scales in [lo, hi]. */
function logScales(lo: number, hi: number): number[] {
  if (hi <= lo) return [lo];
  const out: number[] = [];
  // Aim for ~10-16 scales spread logarithmically.
  const target = Math.min(16, Math.max(4, Math.round(Math.log2(hi / lo) * 4)));
  const seen = new Set<number>();
  for (let i = 0; i < target; i++) {
    const t = i / (target - 1);
    const s = Math.round(lo * Math.pow(hi / lo, t));
    if (s >= lo && s <= hi && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Sum of squared residuals after OLS-fitting a polynomial of
 * the given `order` to the values `(j, Y[off + j])` for
 * `j = 0..s-1`. Solves the (order+1)x(order+1) normal equations
 * by Gaussian elimination with partial pivoting. Returns 0 if the
 * system is singular (degenerate window).
 *
 * order = 1 -> linear (DFA-1).
 * order = 2 -> quadratic (DFA-2).
 * order = 3 -> cubic (DFA-3).
 */
function polyDetrendSSR(
  Y: number[],
  off: number,
  s: number,
  order: number,
): number {
  const k = order + 1;
  // Normal equations: A * c = b, where
  //   A[i][j] = sum_t t^(i+j),  b[i] = sum_t t^i * Y[off+t].
  // Compute power sums up to t^(2*order).
  const pSum = new Array<number>(2 * order + 1).fill(0);
  const yPow = new Array<number>(k).fill(0);
  for (let t = 0; t < s; t++) {
    let pw = 1;
    const yt = Y[off + t]!;
    for (let p = 0; p < 2 * order + 1; p++) {
      pSum[p]! += pw;
      if (p < k) yPow[p]! += pw * yt;
      pw *= t;
    }
  }
  // Build augmented matrix [A | b].
  const M: number[][] = [];
  for (let i = 0; i < k; i++) {
    const row = new Array<number>(k + 1).fill(0);
    for (let j = 0; j < k; j++) row[j] = pSum[i + j]!;
    row[k] = yPow[i]!;
    M.push(row);
  }
  // Gaussian elimination with partial pivoting.
  for (let i = 0; i < k; i++) {
    let pivot = i;
    let pivotAbs = Math.abs(M[i]![i]!);
    for (let r = i + 1; r < k; r++) {
      const a = Math.abs(M[r]![i]!);
      if (a > pivotAbs) {
        pivot = r;
        pivotAbs = a;
      }
    }
    if (pivotAbs === 0) return 0; // singular
    if (pivot !== i) {
      const tmp = M[i]!;
      M[i] = M[pivot]!;
      M[pivot] = tmp;
    }
    const inv = 1 / M[i]![i]!;
    for (let r = i + 1; r < k; r++) {
      const factor = M[r]![i]! * inv;
      if (factor === 0) continue;
      for (let c = i; c <= k; c++) {
        M[r]![c]! -= factor * M[i]![c]!;
      }
    }
  }
  // Back-substitution for the coefficient vector c.
  const c = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let acc = M[i]![k]!;
    for (let j = i + 1; j < k; j++) acc -= M[i]![j]! * c[j]!;
    c[i] = acc / M[i]![i]!;
  }
  // Sum of squared residuals.
  let ssr = 0;
  for (let t = 0; t < s; t++) {
    let yhat = 0;
    let pw = 1;
    for (let p = 0; p < k; p++) {
      yhat += c[p]! * pw;
      pw *= t;
    }
    const e = Y[off + t]! - yhat;
    ssr += e * e;
  }
  return ssr;
}

export function buildSourceRowTokenDfa(
  queue: QueueLine[],
  opts: SourceRowTokenDfaOptions = {},
): SourceRowTokenDfaReport {
  const scaleMin = opts.scaleMin ?? 4;
  if (!Number.isInteger(scaleMin) || scaleMin < 4) {
    throw new Error(`scaleMin must be an integer >= 4 (got ${opts.scaleMin})`);
  }
  const scaleMaxOpt = opts.scaleMax ?? null;
  if (scaleMaxOpt !== null) {
    if (!Number.isInteger(scaleMaxOpt) || scaleMaxOpt < scaleMin * 2) {
      throw new Error(
        `scaleMax must be an integer >= scaleMin*2 (=${scaleMin * 2}) (got ${opts.scaleMax})`,
      );
    }
  }
  const minScales = opts.minScales ?? 4;
  if (!Number.isInteger(minScales) || minScales < 3) {
    throw new Error(`minScales must be an integer >= 3 (got ${opts.minScales})`);
  }
  const minWindowsPerScale = opts.minWindowsPerScale ?? 4;
  if (!Number.isInteger(minWindowsPerScale) || minWindowsPerScale < 2) {
    throw new Error(
      `minWindowsPerScale must be an integer >= 2 (got ${opts.minWindowsPerScale})`,
    );
  }
  const minRows = opts.minRows ?? 32;
  if (!Number.isInteger(minRows) || minRows < 4 * scaleMin) {
    throw new Error(
      `minRows must be an integer >= 4*scaleMin (=${4 * scaleMin}) (got ${opts.minRows})`,
    );
  }
  const detrendOrder = opts.detrendOrder ?? 1;
  if (!Number.isInteger(detrendOrder) || detrendOrder < 1 || detrendOrder > 3) {
    throw new Error(
      `detrendOrder must be an integer in [1, 3] (got ${opts.detrendOrder})`,
    );
  }
  if (scaleMin < detrendOrder + 2) {
    throw new Error(
      `scaleMin must be >= detrendOrder + 2 (=${detrendOrder + 2}) (got scaleMin=${scaleMin})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'alpha-asc';
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
  let droppedTooFewScales = 0;
  let clampedBelow0 = 0;
  let clampedAbove2 = 0;

  const allRows: SourceRowTokenDfaRow[] = [];

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

    // Step 5: integrated profile Y[i] = sum_{j<=i} (v[j] - mean).
    const Y: number[] = new Array(N);
    let acc = 0;
    for (let i = 0; i < N; i++) {
      acc += v[i]! - mean;
      Y[i] = acc;
    }

    // Determine per-source scaleMax: explicit opt or floor(N/4).
    const sMax = scaleMaxOpt ?? Math.floor(N / 4);
    if (sMax < scaleMin * 2) {
      // Not enough range for a meaningful scaling fit.
      droppedTooFewScales += 1;
      continue;
    }
    const scales = logScales(scaleMin, sMax);

    // Step 6: compute F(s) for each scale.
    const xs: number[] = []; // log(s)
    const ys: number[] = []; // log(F(s))
    let scalesDropped = 0;
    let scaleMinUsed = Number.POSITIVE_INFINITY;
    let scaleMaxUsed = 0;

    for (const s of scales) {
      const numWindows = Math.floor(N / s);
      if (numWindows < minWindowsPerScale) {
        scalesDropped += 1;
        continue;
      }
      // Within each window, polynomial-detrend Y[w*s .. w*s+s-1]
      // (order = detrendOrder), sum residual squares, then average
      // over windows. detrendOrder=1 is DFA-1 (Peng et al. 1994 default).
      let sumVar = 0;
      let usedWindows = 0;
      for (let w = 0; w < numWindows; w++) {
        const off = w * s;
        const ss = polyDetrendSSR(Y, off, s, detrendOrder);
        sumVar += ss / s;
        usedWindows += 1;
      }
      if (usedWindows < minWindowsPerScale) {
        scalesDropped += 1;
        continue;
      }
      const F2 = sumVar / usedWindows;
      if (!(F2 > 0)) {
        scalesDropped += 1;
        continue;
      }
      const F = Math.sqrt(F2);
      xs.push(Math.log(s));
      ys.push(Math.log(F));
      if (s < scaleMinUsed) scaleMinUsed = s;
      if (s > scaleMaxUsed) scaleMaxUsed = s;
    }

    if (xs.length < minScales) {
      droppedTooFewScales += 1;
      continue;
    }

    // Step 7: OLS log F = a + alpha * log s.
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
    const slope = sxy / sxx;
    const intercept = ybar - slope * xbar;
    const alphaRaw = slope;

    // R^2.
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const yhat = intercept + slope * xs[i]!;
      const e = ys[i]! - yhat;
      ssRes += e * e;
      const d = ys[i]! - ybar;
      ssTot += d * d;
    }
    const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    let alpha = alphaRaw;
    if (alphaRaw < 0) {
      alpha = 0;
      clampedBelow0 += 1;
    } else if (alphaRaw > 2) {
      alpha = 2;
      clampedAbove2 += 1;
    }

    allRows.push({
      source,
      rowsKept: N,
      sigma,
      scaleMinUsed: Number.isFinite(scaleMinUsed) ? scaleMinUsed : 0,
      scaleMaxUsed,
      scalesUsed: n,
      scalesDropped,
      alpha,
      alphaRaw,
      r2,
    });
  }

  function alphaKey(row: SourceRowTokenDfaRow, asc: boolean): number {
    if (!Number.isFinite(row.alpha))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.alpha;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'alpha-asc') {
      primary = alphaKey(a, true) - alphaKey(b, true);
    } else if (sort === 'alpha-desc') {
      primary = alphaKey(b, false) - alphaKey(a, false);
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
    scaleMin,
    scaleMax: scaleMaxOpt,
    minScales,
    minWindowsPerScale,
    minRows,
    detrendOrder,
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
    clampedBelow0,
    clampedAbove2,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
