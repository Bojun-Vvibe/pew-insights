/**
 * source-row-token-mann-kendall-trend: per-source **Mann-Kendall
 * rank-based monotonic trend test** on the per-row `total_tokens`
 * time-ordered sequence.
 *
 * Headline question: **for each source, is the per-row token volume
 * exhibiting a monotonic trend over time (rising or falling)
 * stronger than chance — without assuming linearity, normality, or
 * any parametric form?**
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`), non-finite or negative
 *      `total_tokens` (counted in `droppedInvalidTokens` /
 *      `droppedNegativeTokens`).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence,
 *      not insertion order.
 *   4. Per source: skip if `n < minRows` (default 8 — the normal-
 *      approximation Z is unreliable below this for Mann-Kendall;
 *      counted under `droppedBelowMinRows`).
 *   5. Compute the Mann-Kendall S statistic:
 *          S = sum_{i<j} sign(x_j - x_i)
 *      where sign(d) = +1 if d>0, -1 if d<0, 0 if d==0.
 *      Implemented as the naive O(n^2) double loop — exact and
 *      sufficient for typical per-source row counts (a few thousand
 *      at the high end). For an LLM queue.jsonl this is unnoticed.
 *   6. Compute the tie-corrected variance:
 *          Var[S] = [ n(n-1)(2n+5) - sum_t t(t-1)(2t+5) ] / 18
 *      where the sum is over each tie group of size t (>=2) in the
 *      values vector. With no ties this collapses to n(n-1)(2n+5)/18.
 *   7. Apply the standard continuity correction and form Z:
 *          Z = (S - 1) / sqrt(Var[S])   if S > 0
 *          Z = 0                          if S == 0
 *          Z = (S + 1) / sqrt(Var[S])   if S < 0
 *      and report a two-sided normal-approx p-value
 *      (`p = 2 * (1 - Phi(|Z|))`).
 *   8. Also report **Kendall's tau-b** (tie-aware concordance):
 *          tau = S / sqrt( (n0 - n1) * (n0 - n2) )
 *      where:
 *          n0 = n(n-1)/2
 *          n1 = sum_t t(t-1)/2  (over tie groups in the value vector)
 *          n2 = 0                (the time index has no ties — every
 *                                 row's `hour_start` slot is distinct
 *                                 by sort position)
 *      So tau-b reduces here to the standard tie-aware form on the
 *      value side only. tau in [-1, +1]; tau = +1 = strict monotone
 *      increase, tau = -1 = strict monotone decrease, tau ~ 0 = no
 *      monotonic order.
 *   9. Reading Z and tau:
 *      - `Z` near `0` / `tau` near `0`: no monotonic trend detectable.
 *      - `Z >> 0` (`> +1.96`): **upward trend** — later rows tend to
 *                              have higher `total_tokens` than earlier
 *                              rows, monotonically (not necessarily
 *                              linearly).
 *      - `Z << 0` (`< -1.96`): **downward trend** — later rows tend to
 *                              have lower `total_tokens` than earlier
 *                              rows.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-runs-test` is a non-parametric test of
 *     **i.i.d.-ness via the sign sequence around the median**, and
 *     specifically detects **clumping vs alternation** of above-/
 *     below-median rows. A monotone trend will normally also show
 *     up under runs-test (because the bottom half lands first and
 *     the top half lands last), but the runs-test cannot
 *     distinguish *which direction* the trend goes — it reads `Z
 *     << 0` (clumped) for both monotone-up and monotone-down.
 *     Mann-Kendall reports a **signed** statistic and so resolves
 *     direction. Conversely, a slow drift with a noisy median
 *     dichotomy can register `Z ~ 0` under runs-test (because the
 *     above/below switches still look random) but a clear `tau` and
 *     `Z` under Mann-Kendall (because pairwise concordance is
 *     accumulating monotonically). The two scalars are not
 *     functionally redundant.
 *   - `source-row-token-turning-point-count` measures **first-
 *     difference jaggedness** — too few or too many local extrema.
 *     A monotone-but-saw-tooth series (e.g. linear ramp + small
 *     noise) will be **smooth** under turning-point (T close to
 *     the i.i.d. expectation 2(n-2)/3 if the noise is genuine, or
 *     `Z << 0` if very smooth) and **trending** under Mann-Kendall.
 *     A *zig-zag with no net trend* will be jagged under turning-
 *     point (`Z >> 0`) and *flat* under Mann-Kendall (`tau ~ 0`).
 *   - `source-row-token-autocorrelation-lag1` is a **linear**,
 *     **parametric** Pearson rho on the raw values at a single lag.
 *     Mann-Kendall is **non-parametric**, **rank-based**, and
 *     **all-pair** (every i<j pair contributes), so it picks up
 *     monotone trends regardless of shape and is robust to outliers
 *     in a way lag-1 rho is not.
 *   - `source-row-token-permutation-entropy` measures **ordinal-
 *     pattern uniformity at scale m=3**. A pure linear trend
 *     produces almost entirely the `(1,2,3)` ordinal pattern and so
 *     reads PE near 0; Mann-Kendall reads `tau` near +1 with a
 *     small p-value. They agree on *that* extreme but diverge on
 *     intermediate cases: a series with a slow trend buried in
 *     short-range jitter will show modestly elevated PE
 *     (because most triples are still mixed) but a clear `tau` (
 *     because pairwise concordance accumulates over the long
 *     baseline). PE is local-window-averaged; Mann-Kendall is
 *     global-pairwise.
 *   - `source-row-token-burstiness-coefficient`,
 *     `-coefficient-of-variation`, `-iqr-ratio`, `-mad`, `-gini`,
 *     `-skewness`, `-kurtosis`: all **order-invariant**. Shuffling
 *     the row sequence leaves them unchanged but typically pushes
 *     `tau` toward 0. Mann-Kendall is the trend lens; those are the
 *     dispersion / shape lenses.
 *   - `source-daily-token-trend-slope` is a per-source **linear
 *     OLS slope on the daily-aggregated token mass**. Mann-Kendall
 *     here operates on the **per-row** sequence (no daily binning),
 *     is non-parametric (no slope assumption), and reports a
 *     concordance scalar in [-1, +1] (not a slope in tokens/day).
 *     A source with a clear sign-of-trend but a non-linear shape
 *     can have a low OLS slope R^2 but a strong Mann-Kendall tau.
 *
 * Edge cases:
 *
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All values equal: S = 0, all pairs are ties, Var[S] becomes 0
 *     (the tie-correction term cancels n(n-1)(2n+5)). Z = 0; tau is
 *     defined as 0 (n0 - n1 = 0; standard convention to report 0
 *     when the denominator vanishes); pValue = 1. Surfaces as a
 *     surviving row with a clear "no trend" reading.
 *   - Strict monotone increasing without ties: S = n(n-1)/2,
 *     tau = +1, Z = (S - 1) / sqrt(Var[S]) — large positive.
 *   - Strict monotone decreasing without ties: S = -n(n-1)/2,
 *     tau = -1, Z large negative.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenMannKendallTrendSort =
  | 'z-asc'
  | 'z-desc'
  | 'abs-z-desc'
  | 'tau-asc'
  | 'tau-desc'
  | 'abs-tau-desc'
  | 'p-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenMannKendallTrendOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter
   * only — global denominators reflect the full kept population.
   * Must be an integer >= 4. Default 8 (the normal-approximation
   * Z is unreliable below this for Mann-Kendall).
   */
  minRows?: number;
  /**
   * Drop sources whose two-sided p-value is strictly **above**
   * this threshold; cohort selector that surfaces only sources
   * with statistically detectable monotonic trend. Must be a
   * finite number in (0, 1]. Default 1 (no floor).
   */
  maxP?: number;
  /**
   * Drop sources whose **|tau|** is strictly **below** this
   * threshold; cohort selector on the direction-agnostic
   * **concordance effect size**. Must be a finite number in
   * `[0, 1]`. Default `0` (no floor).
   *
   * Why this is genuinely orthogonal to `--max-p` even though Z
   * and p are monotonically related under the normal-approx and
   * Z is itself a monotone function of `tau` *for fixed n*:
   *
   *   - `--max-p f` filters on the **tail probability under H0**
   *     — a hypothesis-testing gate. It is *sample-size aware*:
   *     a long-running source with a very modest tau (e.g. 0.05
   *     over `n = 2000` rows) can clear `--max-p 0.01` because
   *     the variance of S scales with `n^{3/2}` while S grows
   *     with `n^2`; the same `tau = 0.05` over `n = 12` rows is
   *     nowhere near significant.
   *   - `--min-abs-tau g` filters on the **concordance effect
   *     size itself** — the fraction of pair comparisons that
   *     are concordant minus the fraction that are discordant.
   *     This is a sample-size-independent, operator-meaningful
   *     scalar in `[0, 1]`: "show me sources whose later rows
   *     are at least 20% more concordant-than-discordant with
   *     the time index, regardless of whether I have enough
   *     rows to call it statistically significant."
   *
   * Combined with `--max-p`, both gates are applied (logical
   * AND); each surviving source must clear both. Counted
   * separately so the operator sees which gate dropped what.
   * `--min-abs-tau` runs first (and so claims its drops first)
   * — symmetric with how `--min-abs-z` precedes `--max-p` in
   * the runs-test lens.
   */
  minAbsTau?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'abs-z-desc' (default): |Z| descending — surfaces strongest
   *                             trend in either direction first.
   *   - 'z-asc':                Z ascending — strongest *downward*
   *                             trend first.
   *   - 'z-desc':               Z descending — strongest *upward*
   *                             trend first.
   *   - 'tau-asc':              tau ascending — most-negative
   *                             concordance first.
   *   - 'tau-desc':             tau descending — most-positive
   *                             concordance first.
   *   - 'abs-tau-desc':         |tau| descending — strongest signed
   *                             concordance in either direction
   *                             first (sample-size-agnostic vs.
   *                             abs-z-desc which is sample-size
   *                             aware via the variance scaling).
   *   - 'p-asc':                p-value ascending — most-significant
   *                             trend first.
   *   - 'rows':                 rowsKept desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenMannKendallTrendSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenMannKendallTrendRow {
  source: string;
  /** rows used in the test. */
  rowsKept: number;
  /** Mann-Kendall S statistic. */
  s: number;
  /** tie-corrected variance of S under H0. */
  varS: number;
  /** continuity-corrected normal-approx Z statistic. */
  z: number;
  /** Kendall's tau-b in [-1, +1]. */
  tau: number;
  /** number of pair-ties on the value side (sum_t t*(t-1)/2). */
  valueTiePairs: number;
  /** number of distinct tie groups of size >= 2 on the value side. */
  valueTieGroups: number;
  /** two-sided normal-approx p-value, in [0, 1]. */
  pValue: number;
}

export interface SourceRowTokenMannKendallTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  maxP: number;
  minAbsTau: number;
  top: number | null;
  sort: SourceRowTokenMannKendallTrendSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinAbsTau: number;
  droppedAboveMaxP: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenMannKendallTrendRow[];
}

const VALID_SORTS = [
  'z-asc',
  'z-desc',
  'abs-z-desc',
  'tau-asc',
  'tau-desc',
  'abs-tau-desc',
  'p-asc',
  'rows',
  'source',
] as const;

/**
 * Abramowitz-Stegun 7.1.26 rational approximation to erf(x);
 * absolute error < 1.5e-7. Sufficient for an operator p-value.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function buildSourceRowTokenMannKendallTrend(
  queue: QueueLine[],
  opts: SourceRowTokenMannKendallTrendOptions = {},
): SourceRowTokenMannKendallTrendReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 4) {
    throw new Error(
      `minRows must be an integer >= 4 (got ${opts.minRows})`,
    );
  }
  const maxP = opts.maxP ?? 1;
  if (!Number.isFinite(maxP) || maxP <= 0 || maxP > 1) {
    throw new Error(
      `maxP must be a finite number in (0, 1] (got ${opts.maxP})`,
    );
  }
  const minAbsTau = opts.minAbsTau ?? 0;
  if (!Number.isFinite(minAbsTau) || minAbsTau < 0 || minAbsTau > 1) {
    throw new Error(
      `minAbsTau must be a finite number in [0, 1] (got ${opts.minAbsTau})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'abs-z-desc';
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

  const allRows: SourceRowTokenMannKendallTrendRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    if (samples.length < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Sort by hour_start ascending so that pair (i, j) with i<j
    // means "row i happened before row j".
    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    // Naive O(n^2) Mann-Kendall S accumulation.
    let s = 0;
    for (let i = 0; i < n - 1; i++) {
      const vi = v[i]!;
      for (let j = i + 1; j < n; j++) {
        const d = v[j]! - vi;
        if (d > 0) s += 1;
        else if (d < 0) s -= 1;
      }
    }

    // Tie groups on the value vector.
    const sorted = v.slice().sort((a, b) => a - b);
    let tieAdjustment = 0;
    let valueTiePairs = 0;
    let valueTieGroups = 0;
    let i = 0;
    while (i < n) {
      let k = i + 1;
      while (k < n && sorted[k] === sorted[i]) k += 1;
      const t = k - i;
      if (t >= 2) {
        tieAdjustment += t * (t - 1) * (2 * t + 5);
        valueTiePairs += (t * (t - 1)) / 2;
        valueTieGroups += 1;
      }
      i = k;
    }

    const varS = (n * (n - 1) * (2 * n + 5) - tieAdjustment) / 18;
    const stdS = Math.sqrt(Math.max(varS, 0));

    let z: number;
    if (stdS === 0) {
      z = 0;
    } else if (s > 0) {
      z = (s - 1) / stdS;
    } else if (s < 0) {
      z = (s + 1) / stdS;
    } else {
      z = 0;
    }

    const n0 = (n * (n - 1)) / 2;
    const denom = n0 - valueTiePairs; // n2 = 0 (no time-side ties post-sort).
    let tau: number;
    if (denom <= 0) {
      tau = 0;
    } else {
      // tau-b: S / sqrt((n0 - n1) * (n0 - n2)) and n2 = 0 -> n0.
      tau = s / Math.sqrt(denom * n0);
    }

    const p = stdS > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;

    allRows.push({
      source,
      rowsKept: n,
      s,
      varS,
      z,
      tau,
      valueTiePairs,
      valueTieGroups,
      pValue: Math.max(0, Math.min(1, p)),
    });
  }

  let droppedAboveMaxP = 0;
  let droppedBelowMinAbsTau = 0;
  const survived: SourceRowTokenMannKendallTrendRow[] = [];
  for (const row of allRows) {
    if (minAbsTau > 0 && Math.abs(row.tau) < minAbsTau) {
      droppedBelowMinAbsTau += 1;
      continue;
    }
    if (maxP < 1 && row.pValue > maxP) {
      droppedAboveMaxP += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'abs-z-desc') primary = Math.abs(b.z) - Math.abs(a.z);
    else if (sort === 'z-asc') primary = a.z - b.z;
    else if (sort === 'z-desc') primary = b.z - a.z;
    else if (sort === 'tau-asc') primary = a.tau - b.tau;
    else if (sort === 'tau-desc') primary = b.tau - a.tau;
    else if (sort === 'abs-tau-desc')
      primary = Math.abs(b.tau) - Math.abs(a.tau);
    else if (sort === 'p-asc') primary = a.pValue - b.pValue;
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
    minRows,
    maxP,
    minAbsTau,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinAbsTau,
    droppedAboveMaxP,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
