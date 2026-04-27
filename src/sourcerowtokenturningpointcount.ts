/**
 * source-row-token-turning-point-count: per-source **Wallis-Moore
 * turning-point test** on the per-row `total_tokens` time-ordered
 * sequence.
 *
 * Headline question: **for each source, does the per-row token
 * volume series have the right number of local extrema (peaks +
 * troughs) for an i.i.d. random sequence — or is it too smooth
 * (regime persistence / trends) or too jagged (over-alternating /
 * mean-reversion at the first-difference scale)?**
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the test sees the actual temporal sequence,
 *      not insertion order.
 *   4. Per source: walk the value sequence v[0..n-1]. A position
 *      `i` (1 <= i <= n-2) is a **turning point** iff
 *        (v[i] > v[i-1] AND v[i] > v[i+1])  // peak
 *        OR
 *        (v[i] < v[i-1] AND v[i] < v[i+1])  // trough
 *      Equality at either neighbour means **not** a turning point
 *      (Wallis-Moore strict-inequality form). Plateaus / repeated
 *      values therefore reduce T relative to a strict-inequality
 *      i.i.d. continuous null. Counted in `tiePositions` (the
 *      number of internal positions where `v[i] == v[i-1]` or
 *      `v[i] == v[i+1]`) so the operator sees how much of the
 *      series is plateau structure.
 *   5. Skip the source if `n < minRows` (default 8 — the normal
 *      approximation is unreliable below this, surfaced under
 *      `droppedBelowMinRows`).
 *   6. Under H0 (i.i.d. continuous) the turning-point count T
 *      has known mean and variance:
 *          E[T]    = 2 * (n - 2) / 3
 *          Var[T]  = (16 * n - 29) / 90
 *      and Z = (T - E[T]) / sqrt(Var[T]) is asymptotically N(0,1).
 *   7. Reading Z:
 *      - `Z` near `0`:    turning-point count is order-consistent
 *                         with i.i.d.
 *      - `Z << 0` (e.g. `< -1.96`): **too few turning points** —
 *                                   the series is **too smooth** for
 *                                   i.i.d. noise; consistent with
 *                                   trend / regime persistence at
 *                                   the first-difference scale
 *                                   (the value tends to keep moving
 *                                   in the same direction).
 *      - `Z >> 0` (e.g. `> +1.96`): **too many turning points** —
 *                                   the series is **too jagged**;
 *                                   consistent with over-alternation
 *                                   / negative serial dependence at
 *                                   the first-difference scale
 *                                   (mean-reversion).
 *   8. Two-sided normal-approx p-value: `p = 2 * (1 - Phi(|Z|))`.
 *      Approximated with a rational-function `erf` good to
 *      ~1.5e-7 absolute (same approximation used elsewhere in
 *      the suite for consistency).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - `source-row-token-runs-test`: dichotomises around the
 *     **median** and counts maximal same-sign runs. That collapses
 *     all magnitude information into one bit per row and is
 *     sensitive to long regimes above/below a *level* (the median).
 *     The turning-point test ignores levels entirely and looks
 *     only at the **first-difference sign pattern** at each
 *     interior point. The two are non-redundant: a slow saw-tooth
 *     that crosses the median often will look "alternating" to
 *     the runs-test (high Z) but smooth to the turning-point test
 *     (low T) because each ramp has many same-direction steps.
 *     A noisy series tightly clustered around the median may have
 *     few runs (regime persistence around the level) but many
 *     turning points (jagged at the step scale).
 *   - `source-row-token-autocorrelation-lag1`: Pearson rho on
 *     **raw values** — linear, parametric, sensitive to
 *     magnitudes. Turning-point T is **non-parametric**, depends
 *     only on the relative ordering of consecutive triples, and
 *     is invariant to any monotone transform of the values.
 *   - `source-row-token-burstiness-coefficient`,
 *     `-coefficient-of-variation`, `-iqr-ratio`, `-mad`,
 *     `-skewness`, `-kurtosis`, `-gini`: marginal-distribution
 *     dispersion / shape lenses. **All are order-invariant** —
 *     shuffling the sequence leaves them unchanged but typically
 *     pushes T toward its i.i.d. expectation.
 *   - `source-same-model-streak`: categorical run length on
 *     **model identity**, not on token-volume first-difference
 *     sign.
 *   - `source-row-token-monotone-run-length` (daily flavour, if
 *     present): consecutive monotone-direction days. The
 *     turning-point test counts **internal extrema in the per-row
 *     sequence** at the row scale, not run lengths at a daily
 *     aggregation.
 *
 * Edge cases:
 *
 *   - `n < minRows` (must be >= 4 — the formula needs n-2 >= 2):
 *     surfaces under `droppedBelowMinRows`.
 *   - `n == 2`: no interior positions; T = 0; would surface only
 *     if minRows allowed it (rejected by the >= 4 floor).
 *   - All values equal: zero turning points (no strict
 *     inequality ever holds); `tiePositions == n - 2`. The Z
 *     statistic will be very negative — correctly flagging
 *     "this sequence is far smoother than i.i.d."
 *   - Strictly monotone series (1, 2, 3, ..., n): zero turning
 *     points (every interior i has v[i-1] < v[i] < v[i+1]
 *     therefore neither peak nor trough). Z very negative.
 *   - Perfectly alternating series (1, 10, 1, 10, ...): every
 *     interior position is a turning point; T = n - 2. Z very
 *     positive.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak in all sort modes is `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTurningPointCountSort =
  | 'z-asc'
  | 'z-desc'
  | 'abs-z-desc'
  | 'p-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTurningPointCountOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-window rows. Must
   * be an integer >= 4 (the formula needs n-2 >= 2 and the
   * normal approximation is unreliable below 8). Default 8.
   */
  minRows?: number;
  /**
   * Drop sources whose two-sided turning-point-test p-value is
   * strictly **above** this threshold. Must be a finite number
   * in (0, 1]. Default 1 (no floor).
   */
  maxP?: number;
  /**
   * Drop sources whose **absolute Z statistic** is strictly
   * **below** this threshold. Default 0 (no floor).
   */
  minAbsZ?: number;
  /**
   * Drop sources whose **fraction of interior positions that
   * are ties** (`tiePositions / (n - 2)`) is strictly **above**
   * this threshold. Must be a finite number in (0, 1]. Default 1
   * (no floor — every source survives, including pure plateaus).
   *
   * Why this is genuinely orthogonal to `--max-p` / `--min-abs-z`:
   *
   *   - `--max-p` and `--min-abs-z` gate on the **statistical
   *     significance** of the (T - E[T]) gap under the i.i.d.
   *     continuous null. Both treat ties the same way the test
   *     itself does — a tied position is just "not a turning
   *     point" — and so a series that is mostly plateau can
   *     score a very low T (and a very negative Z) for reasons
   *     that have nothing to do with first-difference
   *     persistence: it simply has no first differences to
   *     count, because the values aren't moving.
   *   - `--max-tie-fraction` gates on the **continuity assumption
   *     itself**. A source whose row-token series is, say, 80%
   *     repeated values (`tiePositions / (n-2) = 0.80`) is
   *     violating the Wallis-Moore continuous-distribution
   *     premise so badly that the reported Z is informative
   *     mostly about **how discrete** the series is, not about
   *     whether its first differences are persistent. Filtering
   *     these out (e.g. `--max-tie-fraction 0.30`) keeps the
   *     surviving Z statistics interpretable as evidence about
   *     trend / mean-reversion at the step scale.
   *
   * Combined with the existing gates, all three apply (logical
   * AND); each gate counts its drops separately so the operator
   * sees which gate dropped what.
   */
  maxTieFraction?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'abs-z-desc' (default): |Z| descending — surfaces the
   *                             most-non-iid sequences first
   *                             (too smooth and too jagged both
   *                             float to the top).
   *   - 'z-asc':                Z ascending — smoothest first.
   *   - 'z-desc':               Z descending — most jagged first.
   *   - 'p-asc':                p-value ascending — most-significant
   *                             non-randomness first.
   *   - 'rows':                 rowsKept desc.
   *   - 'source':               source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTurningPointCountSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTurningPointCountRow {
  source: string;
  /** total post-window post-validity rows for this source. */
  rowsKept: number;
  /** observed turning-point count T. */
  turningPoints: number;
  /** number of interior positions with a tie at either neighbour. */
  tiePositions: number;
  /** expected turning points under H0. */
  expectedTurningPoints: number;
  /** stddev of T under H0. */
  stddevTurningPoints: number;
  /** Wallis-Moore Z statistic. */
  z: number;
  /** two-sided normal-approx p-value, in [0, 1]. */
  pValue: number;
}

export interface SourceRowTokenTurningPointCountReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  maxP: number;
  minAbsZ: number;
  maxTieFraction: number;
  top: number | null;
  sort: SourceRowTokenTurningPointCountSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAboveMaxP: number;
  droppedBelowMinAbsZ: number;
  droppedAboveMaxTieFraction: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTurningPointCountRow[];
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
 * absolute error < 1.5e-7.
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

export function buildSourceRowTokenTurningPointCount(
  queue: QueueLine[],
  opts: SourceRowTokenTurningPointCountOptions = {},
): SourceRowTokenTurningPointCountReport {
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
  const maxTieFraction = opts.maxTieFraction ?? 1;
  if (
    !Number.isFinite(maxTieFraction) ||
    maxTieFraction <= 0 ||
    maxTieFraction > 1
  ) {
    throw new Error(
      `maxTieFraction must be a finite number in (0, 1] (got ${opts.maxTieFraction})`,
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

  const allRows: SourceRowTokenTurningPointCountRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const values = samples.map((s) => s[1]);
    const n = values.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let T = 0;
    let tiePositions = 0;
    for (let i = 1; i < n - 1; i++) {
      const a = values[i - 1]!;
      const b = values[i]!;
      const c = values[i + 1]!;
      if (a === b || b === c) {
        tiePositions += 1;
        continue;
      }
      if ((b > a && b > c) || (b < a && b < c)) T += 1;
    }

    const expected = (2 * (n - 2)) / 3;
    const variance = (16 * n - 29) / 90;
    const stddev = Math.sqrt(Math.max(variance, 0));
    const z = stddev > 0 ? (T - expected) / stddev : 0;
    const p = stddev > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;

    allRows.push({
      source,
      rowsKept: n,
      turningPoints: T,
      tiePositions,
      expectedTurningPoints: expected,
      stddevTurningPoints: stddev,
      z,
      pValue: Math.max(0, Math.min(1, p)),
    });
  }

  let droppedAboveMaxP = 0;
  let droppedBelowMinAbsZ = 0;
  let droppedAboveMaxTieFraction = 0;
  const survived: SourceRowTokenTurningPointCountRow[] = [];
  for (const row of allRows) {
    const interior = row.rowsKept - 2;
    const tieFrac = interior > 0 ? row.tiePositions / interior : 0;
    if (maxTieFraction < 1 && tieFrac > maxTieFraction) {
      droppedAboveMaxTieFraction += 1;
      continue;
    }
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
    maxTieFraction,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAboveMaxP,
    droppedBelowMinAbsZ,
    droppedAboveMaxTieFraction,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
