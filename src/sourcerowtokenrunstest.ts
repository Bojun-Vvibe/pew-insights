/**
 * source-row-token-runs-test: per-source **Wald-Wolfowitz runs test**
 * on the per-row `total_tokens` sequence, dichotomised at the
 * source's own median.
 *
 * Headline question: **for each source, is the order in which the
 * row token volumes arrive consistent with an i.i.d. random
 * sequence — or are above-median and below-median rows clumped
 * (positive serial dependence) or alternating (negative serial
 * dependence)?**
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`), non-finite or negative
 *      `total_tokens` (counted in `droppedInvalidTokens` /
 *      `droppedNegativeTokens`).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the runs-test sees the actual temporal
 *      sequence, not insertion order.
 *   4. Per source: compute the median `m` of `total_tokens`. Drop
 *      rows whose value **equals** the median (this is the
 *      standard textbook handling of ties in the
 *      Wald-Wolfowitz two-class form). Counted in
 *      `droppedAtMedian` so the operator sees the ties they lost.
 *   5. Map each remaining row to a sign: `+1` if `total_tokens > m`,
 *      `-1` if `< m`. Let `n1` = count of `+1`s, `n2` = count of
 *      `-1`s, `n = n1 + n2`. Skip the source if `n < minRows`
 *      (default 8 — runs-test Z is unreliable below this) or if
 *      either `n1 = 0` or `n2 = 0` (a constant-sign sequence has
 *      `runs = 1` and zero variance under the null; counted in
 *      `droppedSingleClass`).
 *   6. Count **runs** `R` — maximal contiguous same-sign blocks.
 *   7. Under H0 (i.i.d.), the runs count has known
 *      mean and variance:
 *          mu_R    = 1 + 2*n1*n2 / n
 *          var_R   = 2*n1*n2 * (2*n1*n2 - n) / (n^2 * (n - 1))
 *      and Z = (R - mu_R) / sqrt(var_R) is asymptotically N(0, 1).
 *   8. Reading Z:
 *      - `Z` near `0`:    sequence is order-consistent with i.i.d.
 *      - `Z << 0` (e.g. `< -1.96`): **too few runs** — above- and
 *                                   below-median rows are **clumped**;
 *                                   positive serial dependence /
 *                                   regime persistence in token volume.
 *      - `Z >> 0` (e.g. `> +1.96`): **too many runs** — above- and
 *                                   below-median rows **alternate**
 *                                   more than chance; negative serial
 *                                   dependence / mean-reversion.
 *   9. Also emit two-sided p-value via the normal approximation
 *      (`p = 2 * (1 - Phi(|Z|))`) — operator-friendly. Approximated
 *      with a rational-function `erf` good to ~1.5e-7 absolute.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-autocorrelation-lag1` measures **linear**
 *     serial dependence on the **raw** values: a Pearson rho. The
 *     runs test is **non-parametric** and operates on the **sign
 *     sequence around the median**, ignoring magnitudes. Two
 *     sources can have lag1 rho ~ 0 (no linear correlation) and
 *     yet show strongly clumped above/below-median structure (e.g.
 *     a slow regime drift the linear lag-1 misses but the runs
 *     count picks up clearly).
 *   - `source-row-token-burstiness-coefficient` (B) and
 *     `source-row-token-coefficient-of-variation` (cv) report
 *     **dispersion regime**, not ordering. Shuffling the sequence
 *     leaves B and cv unchanged but typically pushes Z toward 0.
 *   - `source-row-token-iqr-ratio`, `-mad`, `-skewness`,
 *     `-kurtosis`, `-gini`: marginal distribution shape /
 *     spread / concentration. All are **order-invariant**.
 *   - `source-same-model-streak`: categorical run length on
 *     **model identity**, not on token volume sign.
 *   - `source-row-token-monotone-run-length` (if present in the
 *     daily flavour) measures consecutive monotone-direction runs;
 *     the runs test is on the **two-class sign sequence around the
 *     median**, not first-difference sign.
 *
 * Edge cases:
 *
 *   - `n < minRows` after dropping ties: surfaces under
 *     `droppedBelowMinRows`.
 *   - All values equal the median (constant series): every row is
 *     dropped under `droppedAtMedian`; source surfaces under
 *     `droppedBelowMinRows` with rowsKept = 0.
 *   - All values strictly above (or strictly below) the median
 *     (e.g. odd-length asymmetric series): one of `n1` / `n2` is
 *     zero; runs count is degenerate; counted under
 *     `droppedSingleClass`.
 *   - Median computation: standard sample median (mean of the two
 *     middle values for even n; middle value for odd n).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenRunsTestSort =
  | 'z-asc'
  | 'z-desc'
  | 'abs-z-desc'
  | 'p-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenRunsTestOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many sign-classified
   * (post-tie-drop) rows. Display filter only — global
   * denominators reflect the full kept population. Must be an
   * integer >= 4. Default 8 (the normal-approximation Z is
   * unreliable below this for runs-test).
   */
  minRows?: number;
  /**
   * Drop sources whose two-sided runs-test p-value is strictly
   * **above** this threshold; cohort selector that surfaces only
   * sources with statistically detectable non-randomness. Must be
   * a finite number in (0, 1]. Default 1 (no floor — every
   * source survives, including those that look perfectly i.i.d.).
   */
  maxP?: number;
  /**
   * Drop sources whose **absolute Z statistic** is strictly
   * **below** this threshold; cohort selector on the direction-
   * agnostic non-randomness *effect size*. Must be a finite,
   * non-negative number. Default 0 (no floor).
   *
   * Why this is genuinely orthogonal to `--max-p` even though Z
   * and p are monotonically related under the normal-approx:
   *
   *   - `--max-p f` filters on the **tail probability under H0**
   *     — a hypothesis-testing gate. It is *sample-size aware*:
   *     a source with `|Z| = 1.6` and `n = 9` survives `--max-p
   *     0.2` (its p-value is ~0.11) but a source with the same
   *     `|Z| = 1.6` and `n = 500` *also* survives at the same
   *     threshold (p still ~0.11). The two are reported as
   *     equally "marginally significant" even though the larger
   *     sample is pinning down a much smaller true effect.
   *   - `--min-abs-z g` filters on the **normalised effect size
   *     itself** — how many null-stddevs is `R` from `E[R]`,
   *     regardless of how that translates to a tail probability.
   *     Useful when the operator wants "show me sources whose
   *     run-count is at least 2 sigma off its null expectation,
   *     period" rather than "show me sources whose null
   *     hypothesis I can reject at p < f".
   *
   * Under the normal-approx these two scalars are
   * monotonically related (`p = 2*(1 - Phi(|Z|))`), so for a
   * given pair `(g, f)` *one filter is strictly stronger than
   * the other* — but the operator-facing semantics differ:
   * `--min-abs-z` is the more conservative *effect-size* gate
   * familiar from physics / signal-detection contexts;
   * `--max-p` is the *Neyman-Pearson* gate familiar from
   * frequentist hypothesis testing. Both are documented
   * thresholds; offering both lets the operator pick the
   * vocabulary that matches their downstream use.
   *
   * Combined with `--max-p`, both gates are applied (logical
   * AND); each surviving source must clear both. Counted
   * separately so the operator sees which gate dropped what.
   */
  minAbsZ?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'abs-z-desc' (default): |Z| descending — surfaces the
   *                             most-non-random sequences first
   *                             (clumped and alternating both
   *                             float to the top).
   *   - 'z-asc':                Z ascending — most-clumped first.
   *   - 'z-desc':               Z descending — most-alternating first.
   *   - 'p-asc':                p-value ascending — most-significant
   *                             non-randomness first.
   *   - 'rows':                 rowsKept desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenRunsTestSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenRunsTestRow {
  source: string;
  /** rows used in the runs count (post-tie, post-window). */
  rowsKept: number;
  /** sample median of total_tokens (pre-tie-drop). */
  median: number;
  /** count of post-tie rows strictly above the median. */
  n1: number;
  /** count of post-tie rows strictly below the median. */
  n2: number;
  /** count of post-tie rows dropped at exactly the median. */
  ties: number;
  /** observed runs count. */
  runs: number;
  /** expected runs under H0. */
  expectedRuns: number;
  /** stddev of runs under H0 (population form, normal-approx). */
  stddevRuns: number;
  /** Wald-Wolfowitz Z statistic. */
  z: number;
  /** two-sided normal-approx p-value, in [0, 1]. */
  pValue: number;
}

export interface SourceRowTokenRunsTestReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  maxP: number;
  minAbsZ: number;
  top: number | null;
  sort: SourceRowTokenRunsTestSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedAtMedian: number;
  droppedSingleClass: number;
  droppedBelowMinRows: number;
  droppedAboveMaxP: number;
  droppedBelowMinAbsZ: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenRunsTestRow[];
}

const VALID_SORTS = [
  'z-asc',
  'z-desc',
  'abs-z-desc',
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

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildSourceRowTokenRunsTest(
  queue: QueueLine[],
  opts: SourceRowTokenRunsTestOptions = {},
): SourceRowTokenRunsTestReport {
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
  const minAbsZ = opts.minAbsZ ?? 0;
  if (!Number.isFinite(minAbsZ) || minAbsZ < 0) {
    throw new Error(
      `minAbsZ must be a finite, non-negative number (got ${opts.minAbsZ})`,
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
  let droppedAtMedian = 0;
  let droppedSingleClass = 0;
  let droppedBelowMinRows = 0;

  const allRows: SourceRowTokenRunsTestRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    // Sort by hour_start asc (stable: secondary by insertion order is fine
    // because Array.prototype.sort is stable in modern V8 / Node 20+).
    samples.sort((a, b) => a[0] - b[0]);

    const values = samples.map((s) => s[1]);
    const sortedForMedian = values.slice().sort((a, b) => a - b);
    const med = median(sortedForMedian);

    // Build the sign sequence; drop ties.
    let n1 = 0;
    let n2 = 0;
    let ties = 0;
    const signs: number[] = [];
    for (const v of values) {
      if (v > med) {
        signs.push(1);
        n1 += 1;
      } else if (v < med) {
        signs.push(-1);
        n2 += 1;
      } else {
        ties += 1;
      }
    }
    droppedAtMedian += ties;

    const n = n1 + n2;

    if (n1 === 0 || n2 === 0) {
      droppedSingleClass += 1;
      continue;
    }

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Count runs.
    let runs = 1;
    for (let i = 1; i < signs.length; i++) {
      if (signs[i] !== signs[i - 1]) runs += 1;
    }

    const meanR = 1 + (2 * n1 * n2) / n;
    const varR =
      (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
    const stdR = Math.sqrt(Math.max(varR, 0));
    const z = stdR > 0 ? (runs - meanR) / stdR : 0;
    const p = stdR > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;

    allRows.push({
      source,
      rowsKept: n,
      median: med,
      n1,
      n2,
      ties,
      runs,
      expectedRuns: meanR,
      stddevRuns: stdR,
      z,
      pValue: Math.max(0, Math.min(1, p)),
    });
  }

  let droppedAboveMaxP = 0;
  let droppedBelowMinAbsZ = 0;
  const survived: SourceRowTokenRunsTestRow[] = [];
  for (const row of allRows) {
    if (minAbsZ > 0 && Math.abs(row.z) < minAbsZ) {
      droppedBelowMinAbsZ += 1;
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
    minAbsZ,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedAtMedian,
    droppedSingleClass,
    droppedBelowMinRows,
    droppedAboveMaxP,
    droppedBelowMinAbsZ,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
