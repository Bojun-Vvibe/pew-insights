/**
 * source-row-token-passing-bablok-slope: per-source **Passing-Bablok**
 * slope of per-row `total_tokens` against row index.
 *
 * Definition. Given the source's `n` rows in chronological order
 * `(t_i, x_i)` with `t_i = i` (0-based row index) and `x_i =
 * total_tokens`, the **Passing-Bablok** estimator (Passing & Bablok
 * 1983, originally for clinical-chemistry method comparison) is a
 * robust regression slope computed as a **shifted median of the
 * pairwise slope cloud**:
 *
 *   1. For every ordered pair `i < j`, compute
 *      `s_{ij} = (x_j - x_i) / (j - i)`.
 *      Exclude the degenerate pair where both numerator and
 *      denominator are zero (impossible here since `j != i`, so
 *      every pair contributes a finite slope; we still drop any
 *      `s_{ij} == -1` per the original PB convention to avoid a
 *      singular shift).
 *   2. Let `N` be the number of valid pairwise slopes and let
 *      `K = #{ s_{ij} < -1 }` be the count of slopes strictly less
 *      than `-1`.
 *   3. Sort the valid slopes ascending and define the **shifted
 *      median** at 1-based position `(N + 1) / 2 + K`. For odd
 *      `(N - K)` the slope is a single sorted entry; for even
 *      `(N - K)` it is the average of the two straddling entries
 *      (standard PB rule).
 *   4. `intercept = median_i ( x_i - slope * i )`.
 *
 * Headline question: **for each source, what robust per-row trend in
 * token magnitude survives when *both* axes can carry error and you
 * want the slope to be SYMMETRIC under x <-> y swap (an errors-in-
 * variables model), unlike Theil-Sen / Siegel which are y-asymmetric?**
 *
 * Mechanical class — **R-estimator (rank/order based, SHIFTED-MEDIAN
 * pairwise slope, errors-in-both-variables, x<->y SYMMETRIC)**.
 * Mechanically distinct from every previously shipped lens in the
 * suite, including its closest siblings:
 *
 *   - **vs source-row-token-theil-sen-slope (v0.6.214)**: Theil-Sen
 *     takes the *plain* median of all pairwise slopes (y-on-x
 *     regression model, ~29.3% breakdown). Passing-Bablok takes a
 *     **shifted** median, where the shift `K` exactly compensates
 *     for the asymmetry the plain median has under x<->y swap. As a
 *     consequence: **Passing-Bablok is x<->y SYMMETRIC** (regress
 *     y on x or x on y, you get reciprocal slopes), while Theil-Sen
 *     is not. Asymptotic breakdown is also ~29.3%, but the bias
 *     profile differs sharply when the index axis has "error" (e.g.
 *     irregular sampling cadence collapsed to integer ranks).
 *   - **vs source-row-token-siegel-slope (v0.6.216)**: Siegel uses
 *     **nested medians** (per-anchor inner median, then outer
 *     median) and reaches ~50% breakdown but is also y-asymmetric.
 *     Passing-Bablok stays at ~29.3% breakdown but gains x<->y
 *     symmetry — a different robustness axis (functional invariance
 *     vs raw outlier tolerance).
 *   - **vs source-daily-token-trend-slope (OLS)**: that lens fits
 *     ordinary least squares on **daily aggregates** (one point per
 *     active calendar day) — breakdown 0%, asymmetric. Passing-
 *     Bablok works on the **raw per-row stream**, breakdown ~29.3%,
 *     symmetric.
 *   - **vs the M-estimator family (Huber/Tukey/Hampel/Andrews/
 *     Welsch/Cauchy/Geman-McClure — v0.6.207-v0.6.217)**: those are
 *     **location** estimators (one robust mean per source) computed
 *     by IRLS on residuals from a single center. Passing-Bablok is
 *     a **trend / slope** estimator and uses no IRLS, no tuning
 *     constant, no scale parameter, no weight function.
 *   - **vs source-row-token-mann-kendall-trend**: Mann-Kendall
 *     reports a rank-correlation tau and a p-value of monotone
 *     trend; it does not give a magnitude. Passing-Bablok is the
 *     **point estimate of the slope itself** in `tokens / row`.
 *   - **vs all dispersion lenses (MAD, IQR, gini, CV)**: those are
 *     scale, not location-of-trend.
 *
 * This lens is the **first x<->y SYMMETRIC slope estimator** in the
 * suite, and the **first errors-in-both-variables (Deming-style)
 * regression** in the suite — every prior slope lens implicitly
 * assumes the index axis is exact and only `total_tokens` carries
 * error. Originally proposed by Passing & Bablok (J Clin Chem Clin
 * Biochem, 1983) for method-comparison studies in clinical chemistry
 * where neither method could be designated as the reference, and
 * widely used in laboratory medicine ever since for exactly that
 * reason.
 *
 * Reports a unique **shift diagnostic**:
 *
 *   - `pairsValid`        N
 *   - `pairsBelowMinusOne` K = #{ s_ij < -1 }
 *   - `shiftIndex`        the 1-based position used in the sorted
 *                         slope array, `(N + 1) / 2 + K` (rounded
 *                         to integer for the "lower" pick when
 *                         even). A small `shiftIndex / N` ratio
 *                         (close to 1/2) means the data has few
 *                         steeply-negative slopes and PB is close
 *                         to plain Theil-Sen. A ratio noticeably
 *                         above 1/2 means a substantial fraction of
 *                         pairs have slope < -1 and PB shifts away
 *                         from Theil-Sen.
 *   - `pbVsTheilSenGap`   `slope_PB - slope_TheilSen`, the literal
 *                         shift in `tokens / row` introduced by the
 *                         Passing-Bablok correction. Zero iff
 *                         `K == 0` AND `N` is odd (or by
 *                         coincidence). Sign indicates direction.
 *
 * Translation- and scale-equivariant in `x`. The PB shift `K` is
 * scale-equivariant only for non-negative scaling factors (the
 * `s < -1` cutoff is a fixed constant and is the source of the x<->y
 * symmetry). Asymptotic breakdown ~0.293, same as Theil-Sen.
 *
 * Edge cases:
 *
 *   - **n < 2 pairs**: skipped via `--min-rows` (absolute floor 4).
 *   - **All x_i equal**: every pairwise slope is exactly 0;
 *     `K = 0`; `slope = 0`, `intercept = x_1`,
 *     `pbVsTheilSenGap = 0`.
 *   - **n large**: O(n^2) pair count. Guard with `--max-pairs`
 *     (default 5_000_000 over `n*(n-1)/2`, i.e. n ~ 3163).
 *   - **All slopes valid (no slope == -1)**: this is the typical
 *     case for token streams which are non-negative; equality with
 *     `-1` would require very specific integer drops at unit
 *     cadence and is filtered when it occurs.
 *
 * Steps:
 *
 *   1. Filter queue rows by `[since, until)` and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`     -> droppedInvalidHourStart.
 *   3. Drop rows with non-finite `total_tokens`   -> droppedInvalidTokens.
 *   4. Drop rows with negative `total_tokens`     -> droppedNegativeTokens.
 *   5. Group remaining rows by `source` (empty/missing -> 'unknown'),
 *      sorting per-source rows by `hour_start` ascending (ties
 *      broken by original input order).
 *   6. Per source: skip if `n < minRows` (default 4). Skip if
 *      `n*(n-1)/2 > maxPairs` -> droppedAbovePairCap.
 *   7. Enumerate all `n*(n-1)/2` ordered pair slopes; drop any
 *      `s_ij == -1` -> recorded in `pairsDroppedMinusOne`.
 *   8. Sort the surviving slopes ascending. `K = #{s < -1}`.
 *      Apply the PB shifted-median rule to obtain `slope`.
 *      `intercept = median_i (x_i - slope * i)`.
 *   9. Free byproducts:
 *        - `mean`                arithmetic mean of x
 *        - `median`              ordinary sample median of x
 *        - `firstX`              x_0
 *        - `lastX`               x_{n-1}
 *        - `naiveSlope`          `(x_{n-1} - x_0) / (n - 1)`
 *        - `theilSenSlope`       plain median of all valid slopes
 *                                (the unshifted reference)
 *        - `pbVsTheilSenGap`     `slope - theilSenSlope`
 *        - `slopeSign`           'up' | 'down' | 'flat'
 *        - `slopeMagnitude`      |slope|
 *        - `pairsValid`          N
 *        - `pairsBelowMinusOne`  K
 *        - `pairsDroppedMinusOne` count of pairs with slope == -1
 *        - `shiftIndex`          1-based PB pick position (lower
 *                                pick when even)
 *  10. Apply display gates:
 *        - `--min-rows`             (absolute floor 4)        -> droppedBelowMinRows.
 *        - `--min-slope-magnitude`  cohort selector           -> droppedBelowMinSlopeMagnitude.
 *  11. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceRowTokenPassingBablokSlopeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Drop sources with fewer than this many rows. Integer >= 4. */
  minRows?: number;
  /** Drop sources whose `|slope|` is strictly below this value. Finite, non-negative. */
  minSlopeMagnitude?: number;
  /**
   * Skip sources whose ordered pair count `n*(n-1)/2` exceeds this
   * cap, to bound the O(n^2) work. Positive integer.
   * Default 5_000_000 (~ n = 3163).
   */
  maxPairs?: number;
  top?: number | null;
  sort?:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'gap-desc'
    | 'gap-magnitude-desc'
    | 'shift-ratio-desc'
    | 'naive-gap-magnitude-desc'
    | 'sign-flipped-first'
    | 'rows'
    | 'source';
  generatedAt?: string;
}

export interface SourceRowTokenPassingBablokSlopeRow {
  source: string;
  rowsKept: number;
  /** Arithmetic mean of x. */
  mean: number;
  /** Sample median of x. */
  median: number;
  /** First row's total_tokens (chronological). */
  firstX: number;
  /** Last row's total_tokens (chronological). */
  lastX: number;
  /** Endpoint-only slope `(lastX - firstX) / (n - 1)`. Non-robust reference. */
  naiveSlope: number;
  /** Plain (unshifted) median of all valid pairwise slopes — the Theil-Sen reference. */
  theilSenSlope: number;
  /** Passing-Bablok shifted-median slope, in tokens per row. */
  slope: number;
  /** Median-based intercept `median_i(x_i - slope * i)`. */
  intercept: number;
  /** |slope|. */
  slopeMagnitude: number;
  /** 'up' if slope > 0, 'down' if slope < 0, 'flat' if slope == 0. */
  slopeSign: 'up' | 'down' | 'flat';
  /** Number of valid pairwise slopes used (N). */
  pairsValid: number;
  /** Number of valid slopes strictly less than -1 (K). */
  pairsBelowMinusOne: number;
  /** Number of pairs whose slope was exactly -1 and therefore excluded. */
  pairsDroppedMinusOne: number;
  /**
   * 1-based pick position in the sorted-ascending slope array used
   * for the PB shifted median (lower pick when even). Equals
   * `floor((N + 1)/2) + K`.
   */
  shiftIndex: number;
  /**
   * `shiftIndex / N`. Close to 0.5 means PB is near plain Theil-Sen
   * (few negative-than-minus-one slopes); noticeably above 0.5
   * means PB has shifted substantially.
   */
  shiftRatio: number;
  /** `slope - theilSenSlope`, the literal PB correction in tokens / row. */
  pbVsTheilSenGap: number;
  /**
   * `slope - naiveSlope`, the gap between PB's robust shifted-median
   * estimate and the non-robust endpoint-only reference
   * `(lastX - firstX) / (n - 1)`. Sign and magnitude both meaningful.
   * A large absolute gap means the endpoints are highly unrepresentative
   * of the bulk pair cloud. Same units as slope (tokens / row).
   */
  pbVsNaiveGap: number;
  /**
   * True iff `sign(slope) != sign(naiveSlope)` AND neither is exactly
   * zero. Direct flag for "PB disagrees with the endpoint-only reading
   * about the trend direction" — the most actionable cohort for
   * downstream analysts.
   */
  signFlippedFromNaive: boolean;
}

export interface SourceRowTokenPassingBablokSlopeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minSlopeMagnitude: number;
  maxPairs: number;
  top: number | null;
  sort:
    | 'slope-desc'
    | 'slope-asc'
    | 'magnitude-desc'
    | 'gap-desc'
    | 'gap-magnitude-desc'
    | 'shift-ratio-desc'
    | 'naive-gap-magnitude-desc'
    | 'sign-flipped-first'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedAbovePairCap: number;
  droppedBelowMinSlopeMagnitude: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenPassingBablokSlopeRow[];
}

const ABSOLUTE_MIN_ROWS = 4;
const DEFAULT_MAX_PAIRS = 5_000_000;

const VALID_SORTS = [
  'slope-desc',
  'slope-asc',
  'magnitude-desc',
  'gap-desc',
  'gap-magnitude-desc',
  'shift-ratio-desc',
  'naive-gap-magnitude-desc',
  'sign-flipped-first',
  'rows',
  'source',
] as const;

function sampleMedian(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n % 2 === 1) return sortedAsc[(n - 1) / 2]!;
  return (sortedAsc[n / 2 - 1]! + sortedAsc[n / 2]!) / 2;
}

function medianOfArray(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return sampleMedian(s);
}

/**
 * Compute the Passing-Bablok shifted-median slope for a
 * chronologically ordered series `xs`. The index axis is implicit
 * `0..n-1`. Returns the PB slope, the unshifted Theil-Sen reference
 * slope, the median intercept (using the PB slope), and the shift
 * diagnostics.
 *
 * Pairs with slope exactly equal to `-1` are excluded per the
 * original PB convention; the count is reported separately.
 *
 * Throws if `xs.length < 2`.
 */
export function passingBablokSlope(xs: number[]): {
  slope: number;
  theilSenSlope: number;
  intercept: number;
  pairsValid: number;
  pairsBelowMinusOne: number;
  pairsDroppedMinusOne: number;
  shiftIndex: number;
} {
  const n = xs.length;
  if (n < 2) {
    throw new Error(`passingBablokSlope: need at least 2 points (got ${n})`);
  }
  const totalPairs = (n * (n - 1)) / 2;
  const slopes: number[] = new Array<number>(totalPairs);
  let used = 0;
  let droppedMinusOne = 0;
  for (let i = 0; i < n; i += 1) {
    const xi = xs[i]!;
    for (let j = i + 1; j < n; j += 1) {
      const s = (xs[j]! - xi) / (j - i);
      if (s === -1) {
        droppedMinusOne += 1;
        continue;
      }
      slopes[used] = s;
      used += 1;
    }
  }
  // Shrink to actual valid count.
  const valid = slopes.slice(0, used).sort((a, b) => a - b);
  const N = valid.length;
  if (N === 0) {
    // Degenerate: all pairwise slopes were exactly -1 (essentially impossible
    // for a non-negative token series of length >= 2, but we guard).
    return {
      slope: 0,
      theilSenSlope: 0,
      intercept: xs[0]!,
      pairsValid: 0,
      pairsBelowMinusOne: 0,
      pairsDroppedMinusOne: droppedMinusOne,
      shiftIndex: 0,
    };
  }
  let K = 0;
  for (let k = 0; k < N; k += 1) {
    if (valid[k]! < -1) K += 1;
    else break; // sorted asc
  }
  // PB shifted median. Standard rule:
  //   pos1 = floor((N + 1)/2) + K   (1-based "lower" pick)
  //   if (N - K) is odd: slope = valid[pos1 - 1]
  //   if (N - K) is even: slope = average of valid[pos1 - 1] and valid[pos1]
  // Equivalently: take the median of the (N - K) entries starting at index K,
  // then add K to the chosen position(s) — this is the published formulation.
  const remaining = N - K;
  let slope: number;
  let shiftIndex: number;
  if (remaining <= 0) {
    // All slopes < -1: degenerate; fall back to plain median of valid.
    slope = sampleMedian(valid);
    shiftIndex = Math.floor((N + 1) / 2);
  } else if (remaining % 2 === 1) {
    const localPos = (remaining + 1) / 2; // 1-based within the K..N-1 window
    const pos1 = K + localPos; // 1-based in full sorted array
    slope = valid[pos1 - 1]!;
    shiftIndex = pos1;
  } else {
    const localLo = remaining / 2; // 1-based
    const pos1 = K + localLo;
    slope = (valid[pos1 - 1]! + valid[pos1]!) / 2;
    shiftIndex = pos1;
  }

  const theilSen = sampleMedian(valid);

  const resid = new Array<number>(n);
  for (let i = 0; i < n; i += 1) resid[i] = xs[i]! - slope * i;
  const intercept = medianOfArray(resid);

  return {
    slope,
    theilSenSlope: theilSen,
    intercept,
    pairsValid: N,
    pairsBelowMinusOne: K,
    pairsDroppedMinusOne: droppedMinusOne,
    shiftIndex,
  };
}

export function buildSourceRowTokenPassingBablokSlope(
  queue: QueueLine[],
  opts: SourceRowTokenPassingBablokSlopeOptions = {},
): SourceRowTokenPassingBablokSlopeReport {
  const minRows = opts.minRows ?? ABSOLUTE_MIN_ROWS;
  if (!Number.isInteger(minRows) || minRows < ABSOLUTE_MIN_ROWS) {
    throw new Error(
      `minRows must be an integer >= ${ABSOLUTE_MIN_ROWS} (got ${opts.minRows})`,
    );
  }
  const minSlopeMagnitude = opts.minSlopeMagnitude ?? 0;
  if (!Number.isFinite(minSlopeMagnitude) || minSlopeMagnitude < 0) {
    throw new Error(
      `minSlopeMagnitude must be a finite, non-negative number (got ${opts.minSlopeMagnitude})`,
    );
  }
  const maxPairs = opts.maxPairs ?? DEFAULT_MAX_PAIRS;
  if (!Number.isInteger(maxPairs) || maxPairs < 1) {
    throw new Error(`maxPairs must be a positive integer (got ${opts.maxPairs})`);
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'magnitude-desc';
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

  const perSource = new Map<
    string,
    Array<{ ms: number; ord: number; x: number }>
  >();

  let droppedInvalidHourStart = 0;
  let droppedInvalidTokens = 0;
  let droppedNegativeTokens = 0;
  let droppedSourceFilter = 0;

  let ord = 0;
  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    const ordHere = ord;
    ord += 1;
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
    arr.push({ ms, ord: ordHere, x: tt });
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceRowTokenPassingBablokSlopeRow[] = [];
  let droppedBelowMinRows = 0;
  let droppedAbovePairCap = 0;

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    const pairsTotalCheck = (n * (n - 1)) / 2;
    if (pairsTotalCheck > maxPairs) {
      droppedAbovePairCap += 1;
      continue;
    }

    samples.sort((p, q) =>
      p.ms !== q.ms ? p.ms - q.ms : p.ord - q.ord,
    );
    const xs = samples.map((s) => s.x);

    let totalSum = 0;
    for (let i = 0; i < n; i += 1) totalSum += xs[i]!;
    const meanv = totalSum / n;
    const sorted = xs.slice().sort((p, q) => p - q);
    const medianv = sampleMedian(sorted);
    const firstX = xs[0]!;
    const lastX = xs[n - 1]!;
    const naiveSlope = (lastX - firstX) / (n - 1);

    const pb = passingBablokSlope(xs);
    const slope = pb.slope;
    const intercept = pb.intercept;

    const slopeMagnitude = Math.abs(slope);
    const slopeSign: 'up' | 'down' | 'flat' =
      slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat';

    const shiftRatio = pb.pairsValid > 0 ? pb.shiftIndex / pb.pairsValid : 0;

    allRows.push({
      source,
      rowsKept: n,
      mean: meanv,
      median: medianv,
      firstX,
      lastX,
      naiveSlope,
      theilSenSlope: pb.theilSenSlope,
      slope,
      intercept,
      slopeMagnitude,
      slopeSign,
      pairsValid: pb.pairsValid,
      pairsBelowMinusOne: pb.pairsBelowMinusOne,
      pairsDroppedMinusOne: pb.pairsDroppedMinusOne,
      shiftIndex: pb.shiftIndex,
      shiftRatio,
      pbVsTheilSenGap: slope - pb.theilSenSlope,
      pbVsNaiveGap: slope - naiveSlope,
      signFlippedFromNaive:
        slope !== 0 &&
        naiveSlope !== 0 &&
        Math.sign(slope) !== Math.sign(naiveSlope),
    });
  }

  let droppedBelowMinSlopeMagnitude = 0;
  const survived: SourceRowTokenPassingBablokSlopeRow[] = [];
  for (const row of allRows) {
    if (minSlopeMagnitude > 0 && row.slopeMagnitude < minSlopeMagnitude) {
      droppedBelowMinSlopeMagnitude += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((p, q) => {
    let primary = 0;
    if (sort === 'slope-desc') primary = q.slope - p.slope;
    else if (sort === 'slope-asc') primary = p.slope - q.slope;
    else if (sort === 'magnitude-desc')
      primary = q.slopeMagnitude - p.slopeMagnitude;
    else if (sort === 'gap-desc') primary = q.pbVsTheilSenGap - p.pbVsTheilSenGap;
    else if (sort === 'gap-magnitude-desc')
      primary = Math.abs(q.pbVsTheilSenGap) - Math.abs(p.pbVsTheilSenGap);
    else if (sort === 'shift-ratio-desc')
      primary = q.shiftRatio - p.shiftRatio;
    else if (sort === 'naive-gap-magnitude-desc')
      primary = Math.abs(q.pbVsNaiveGap) - Math.abs(p.pbVsNaiveGap);
    else if (sort === 'sign-flipped-first')
      primary =
        (q.signFlippedFromNaive ? 1 : 0) - (p.signFlippedFromNaive ? 1 : 0);
    else if (sort === 'rows') primary = q.rowsKept - p.rowsKept;
    else primary = p.source < q.source ? -1 : p.source > q.source ? 1 : 0;
    if (primary !== 0) return primary;
    return p.source < q.source ? -1 : p.source > q.source ? 1 : 0;
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
    minSlopeMagnitude,
    maxPairs,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedAbovePairCap,
    droppedBelowMinSlopeMagnitude,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
