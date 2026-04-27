/**
 * source-row-token-zero-crossing-rate: per-source **Zero
 * Crossing Rate (ZCR)** of the de-meaned per-row `total_tokens`
 * time-ordered sequence. ZCR is one of the oldest and simplest
 * spectral-frequency proxies (Kedem 1986, "Spectral analysis
 * and discrimination by zero-crossings", Proc. IEEE 74(11):
 * 1477-1493) and a workhorse of speech / audio analysis.
 *
 * Headline question: **for each source, how often does the
 * row-token series swing from above-mean to below-mean (or
 * vice-versa) per step?** Reads as a normalised "characteristic
 * frequency" of the centred series in cycles per sample.
 *
 * Construction:
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own
 *      counter).
 *   3. Group by source, sort each group by `hour_start`
 *      ascending to obtain `v[0..N-1]`.
 *   4. Skip if `n < minRows` (default 24; ZCR is a count over
 *      `N-1` adjacent pairs and benefits from a stable
 *      denominator).
 *   5. Compute mean `mu = mean(v)` and centred `c[i] = v[i] - mu`.
 *      Skip under `droppedZeroVariance` if every `c[i] == 0`
 *      (a constant series; no crossings are even definable).
 *   6. Count adjacent **sign changes** under the sign convention
 *      `sign(0) = +1` (a single isolated zero between two
 *      positives is not a crossing; a `+ -> 0 -> -` transition
 *      counts as one crossing on the `0 -> -` step). Pairs
 *      `(c[i], c[i+1])` with strictly opposite signs increment
 *      the count.
 *   7. **rate = crossings / (N - 1)**, in [0, 1]. The Nyquist
 *      benchmark is `0.5` (every adjacent pair flips sign:
 *      pure alternating `+ - + - ...`). White noise with a
 *      symmetric, mean-zero stationary distribution has
 *      expected ZCR `0.5`. Slow drifts / persistent series
 *      have ZCR << 0.5; high-frequency oscillation has ZCR
 *      approaching 0.5; a perfectly anti-persistent series
 *      hits 0.5 exactly.
 *   8. Skip under `droppedDegenerate` if any computed quantity
 *      is non-finite.
 *
 * Reading rate:
 *   - rate ~ 0      : signal stays on one side of its mean for
 *                     the entire window (very slow drift /
 *                     near-monotone). Trivially achieved by a
 *                     monotone increasing or decreasing series
 *                     centred only once at the midpoint.
 *   - rate ~ 0.05   : low-frequency content dominates; one
 *                     crossing every ~20 rows.
 *   - rate ~ 0.25   : "moderate" oscillation; quarter-Nyquist.
 *   - rate ~ 0.5    : Nyquist; alternating sign on every step.
 *                     Expected for symmetric mean-zero white
 *                     noise; achieved exactly by `+ - + -`.
 *   - rate > 0.5    : impossible by construction (max one
 *                     crossing per adjacent pair).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **hjorth-mobility / hjorth-complexity**: Hjorth
 *     parameters are variance-ratios on the differenced series
 *     and are sensitive to amplitude *scale* of the wiggles;
 *     ZCR counts only *sign* changes after centring and is
 *     completely insensitive to amplitude. Two series that
 *     agree on every sign of `(v[i] - mu)` produce identical
 *     ZCR but can have wildly different mobility/complexity.
 *   - vs. **autocorrelation-lag1**: rho_1 is a population
 *     correlation on raw values; ZCR is a count on the
 *     centred *signs*. The Kedem cosine identity links them
 *     for *Gaussian* stationary series only
 *     (rho_1 = cos(pi * ZCR)); empirical token-count series
 *     are heavy-tailed, non-Gaussian, and non-stationary, so
 *     ZCR carries information rho_1 does not.
 *   - vs. **runs / turning-point / mann-kendall**: runs counts
 *     monotone *streaks* in raw values, turning-point counts
 *     local extrema, MK counts concordant pairs. None of them
 *     centre by the mean. A monotone-ramp series has runs = 1,
 *     turning-point = 0, MK = +1, but ZCR ~ 1/(N-1) (one
 *     crossing at the midpoint).
 *   - vs. **permutation-entropy / sample-entropy**: PE is
 *     ordinal-pattern based (length-m windows), SampEn is
 *     tolerance-matched recurrence. ZCR is a single-pass
 *     pairwise sign count and uses no embedding window.
 *   - vs. **lempel-ziv**: LZ counts unique factors in a
 *     median-binarised symbol sequence. ZCR uses *mean*
 *     binarisation (not median) and counts *transitions*, not
 *     *factors*. A perfectly alternating `+ - + -` series has
 *     LZ ~ small but ZCR = 0.5 (Nyquist); a long run of `+`
 *     followed by a long run of `-` has ZCR ~ 1/(N-1) but LZ
 *     identical to the alternating case if we only look at the
 *     binary alphabet.
 *   - vs. **dfa / hurst-rs / katz-fd / higuchi-fd**: those are
 *     all multi-scale path-length / scaling exponents. ZCR is a
 *     single-scale, fixed-step count.
 *   - vs. **renyi-entropy / shannon**: histogrammatic / value-
 *     space; ZCR is order-sensitive and discards bin counts.
 *   - vs. **all order-invariant dispersion / shape lenses**
 *     (-iqr-ratio, -mad, -skewness, -kurtosis, -gini,
 *     -burstiness-coefficient, -coefficient-of-variation):
 *     shuffling the sequence leaves them unchanged but
 *     dramatically changes ZCR (typically inflates it toward
 *     the white-noise asymptote of 0.5).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - all centred values exactly zero (i.e. constant series):
 *     surfaces under `droppedZeroVariance`. We do **not** report
 *     `rate = 0` for a constant series; that would conflate
 *     "very slow drift but signal exists" with "no signal at
 *     all".
 *   - any non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Sign convention notes:
 *   - We treat `sign(0) = +1`. A single isolated zero between
 *     two positives is therefore *not* a crossing
 *     (`+ 0 +` => sign sequence `+ + +`, zero crossings).
 *     A `+ -> 0 -> -` transition counts as exactly one crossing
 *     (sign sequence `+ + -`, one crossing on the second step).
 *     This matches the Kedem convention.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenZeroCrossingRateSort =
  | 'rate-asc'
  | 'rate-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenZeroCrossingRateOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (ZCR uses N-1 adjacent pairs and
   * benefits from a denominator >= 3). Default 24.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'rate-asc' (default): rate ascending —
   *     most "slow-drift / persistent" first.
   *   - 'rate-desc':           rate descending —
   *     most "high-frequency / Nyquist-like" first.
   *   - 'rows':                rowsKept desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenZeroCrossingRateSort;
  /**
   * Optional lower bound on reported rate. Sources whose
   * computed rate is strictly below this threshold are
   * suppressed and counted under `droppedBelowMinRate`.
   * Default null (no filter). Useful to surface only the
   * Nyquist-like / noise-like sources (rate >= 0.4 typical)
   * and hide the well-behaved persistent majority.
   */
  minRate?: number | null;
  /**
   * Optional upper bound on reported rate. Sources whose
   * computed rate is strictly above this threshold are
   * suppressed and counted under `droppedAboveMaxRate`.
   * Default null. Symmetric counterpart to `minRate`: useful
   * to surface only the slow-drift / persistent sources
   * (rate <= 0.2 typical) and hide the noisy ones.
   *
   * If both `minRate` and `maxRate` are set and `minRate >
   * maxRate`, the constructor throws — that is operator error,
   * not a silent empty report.
   */
  maxRate?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenZeroCrossingRateRow {
  source: string;
  rowsKept: number;
  /** Mean of v used for centring. */
  mean: number;
  /** Number of adjacent sign changes in the centred series. */
  crossings: number;
  /** crossings / (N - 1), in [0, 0.5] empirically (max 1.0 by construction). */
  rate: number;
}

export interface SourceRowTokenZeroCrossingRateReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenZeroCrossingRateSort;
  minRate: number | null;
  maxRate: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  droppedBelowMinRate: number;
  droppedAboveMaxRate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenZeroCrossingRateRow[];
}

const VALID_SORTS = ['rate-asc', 'rate-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenZeroCrossingRate(
  queue: QueueLine[],
  opts: SourceRowTokenZeroCrossingRateOptions = {},
): SourceRowTokenZeroCrossingRateReport {
  const minRows = opts.minRows ?? 24;
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
  const sort = opts.sort ?? 'rate-asc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }
  const minRate = opts.minRate ?? null;
  if (minRate !== null) {
    if (!Number.isFinite(minRate) || minRate < 0 || minRate > 1) {
      throw new Error(
        `minRate must be a finite number in [0, 1] (got ${opts.minRate})`,
      );
    }
  }
  const maxRate = opts.maxRate ?? null;
  if (maxRate !== null) {
    if (!Number.isFinite(maxRate) || maxRate < 0 || maxRate > 1) {
      throw new Error(
        `maxRate must be a finite number in [0, 1] (got ${opts.maxRate})`,
      );
    }
  }
  if (minRate !== null && maxRate !== null && minRate > maxRate) {
    throw new Error(
      `minRate (${minRate}) must be <= maxRate (${maxRate})`,
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

  const allRows: SourceRowTokenZeroCrossingRateRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const N = v.length;

    if (N < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let mean = 0;
    for (let i = 0; i < N; i++) mean += v[i]!;
    mean /= N;

    // Quick zero-variance check: every value equals the mean.
    let allEqual = true;
    for (let i = 0; i < N; i++) {
      if (v[i]! !== mean) {
        allEqual = false;
        break;
      }
    }
    if (allEqual) {
      droppedZeroVariance += 1;
      continue;
    }

    // sign(c) where sign(0) = +1.
    function sgn(x: number): number {
      return x < 0 ? -1 : 1;
    }

    let crossings = 0;
    let prev = sgn(v[0]! - mean);
    for (let i = 1; i < N; i++) {
      const cur = sgn(v[i]! - mean);
      if (cur !== prev) {
        crossings += 1;
        prev = cur;
      }
    }

    const rate = crossings / (N - 1);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: N,
      mean,
      crossings,
      rate,
    });
  }

  function rateKey(row: SourceRowTokenZeroCrossingRateRow, asc: boolean): number {
    if (!Number.isFinite(row.rate))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.rate;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'rate-asc') {
      primary = rateKey(a, true) - rateKey(b, true);
    } else if (sort === 'rate-desc') {
      primary = rateKey(b, false) - rateKey(a, false);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinRate = 0;
  let droppedAboveMaxRate = 0;
  let postRows = allRows;
  if (minRate !== null || maxRate !== null) {
    const kept: SourceRowTokenZeroCrossingRateRow[] = [];
    for (const row of postRows) {
      if (minRate !== null && row.rate < minRate) {
        droppedBelowMinRate += 1;
        continue;
      }
      if (maxRate !== null && row.rate > maxRate) {
        droppedAboveMaxRate += 1;
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
    minRate,
    maxRate,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroVariance,
    droppedDegenerate,
    droppedBelowMinRate,
    droppedAboveMaxRate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
