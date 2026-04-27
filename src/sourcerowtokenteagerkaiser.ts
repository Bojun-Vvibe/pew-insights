/**
 * source-row-token-teager-kaiser: per-source **mean Teager-Kaiser
 * Energy Operator (TKEO)** of Kaiser (1990, "On a simple algorithm
 * to calculate the 'energy' of a signal", ICASSP-90, vol. 1,
 * pp. 381-384) on the per-row `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, what is the average
 * instantaneous nonlinear energy of consecutive token-count
 * triplets?** TKEO simultaneously couples local amplitude AND
 * frequency: for `x_n = A cos(omega n + phi)` the discrete
 * operator yields psi(x_n) ~ A^2 * sin^2(omega) ~ A^2 * omega^2
 * for small `omega`, i.e. it tracks `(amplitude * frequency)^2`
 * in a single 3-point computation — neither pure variance nor
 * pure spectral content.
 *
 * Construction (canonical Kaiser 1990 discrete operator):
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source and **sort each group by `hour_start`
 *      ascending** so the operator sees the actual temporal
 *      sequence.
 *   4. Skip if `n < minRows` (default 8; the operator needs
 *      `n - 2` interior samples and a handful is the minimum
 *      for a meaningful mean). `minRows` must be `>= 3`.
 *   5. For i in [1, n-2]:
 *        psi_i = x_i^2 - x_{i-1} * x_{i+1}
 *      tkeoMean = (1 / (n-2)) * sum_{i=1..n-2} psi_i
 *   6. Optional `--normalize`: divide tkeoMean by `sigma_v^2`
 *      (population variance of the series). For a pure tone
 *      `x_n = A cos(omega n + phi)` with A != 0, the normalised
 *      operator concentrates around `2 sin^2(omega) ~ 2 omega^2`
 *      for small `omega`, i.e. an **amplitude-invariant**
 *      proxy for instantaneous frequency-squared. Without
 *      normalisation tkeoMean scales as `A^2 * omega^2` and is
 *      directly comparable only across sources of similar
 *      amplitude scale. We surface both unnormalised (`tkeoMean`)
 *      and the normalisation in the row so operators can choose.
 *      `sigma == 0` triggers `droppedZeroVariance` (operator is
 *      identically zero for a constant series, but normalisation
 *      would 0/0; we drop rather than emit NaN).
 *
 * Reading TKEO mean:
 *   - Constant series: psi_i identically 0 (drop on zero-variance).
 *   - Smooth slow-varying series (low `omega`, large coherent
 *     amplitude): small positive mean.
 *   - Spiky / high-frequency oscillation: large positive mean,
 *     because `x_i^2` dominates `x_{i-1} * x_{i+1}` whenever
 *     consecutive samples differ in sign or magnitude.
 *   - Negative tkeoMean is **possible** on real-world non-AM-FM
 *     signals (the Kaiser operator is only guaranteed
 *     non-negative for true mono-component AM-FM signals; on
 *     mixed / noisy series the average can drift slightly
 *     negative). We do NOT clip to >=0 — the sign carries
 *     diagnostic information about non-AM-FM structure.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **coefficient-of-variation / mad / iqr-ratio /
 *     skewness / kurtosis / gini / burstiness-coefficient**:
 *     all order-invariant — they ignore temporal structure
 *     entirely. TKEO uses three consecutive samples and is
 *     **annihilated** by reordering.
 *   - vs. **autocorrelation-lag1**: linear lag-1 cross product
 *     (`E[x_i * x_{i-1}]` after centering / normalising). TKEO
 *     uses a **squared** centre with a lag-1 product subtracted
 *     and is **non-linear** (cross product of three samples).
 *   - vs. **hjorth-mobility / -complexity**: variance ratios on
 *     first / second differences. TKEO is not a difference-of-
 *     variances; it is a per-sample **energy** product that
 *     simultaneously tracks amplitude and frequency in one
 *     scalar (Kaiser's original motivation).
 *   - vs. **zero-crossing-rate**: pure single-scale sign-change
 *     count; carries no amplitude information. TKEO is fully
 *     metric.
 *   - vs. **approximate-entropy / sample-entropy / permutation-
 *     entropy / renyi-entropy**: conditional / ordinal /
 *     distributional irregularity. TKEO is a deterministic
 *     3-point energy product, not an information-theoretic
 *     quantity.
 *   - vs. **lempel-ziv**: median-binarised factor count over
 *     a two-letter alphabet — value-blind beyond sign. TKEO
 *     keeps the full real-valued metric structure and squares it.
 *   - vs. **dfa / hurst-rs**: multi-scale memory scaling
 *     exponents (slope on log-log plots). TKEO is a single-scale
 *     pointwise operator averaged.
 *   - vs. **higuchi-fd / katz-fd / petrosian-fd**: path-length /
 *     fractal dimension scalars that grow with ruggedness but
 *     don't square sample magnitudes. TKEO grows quadratically
 *     in amplitude.
 *   - vs. **mann-kendall / runs-test / turning-point-count**:
 *     directional / dichotomy / extremum tests on signs only.
 *     TKEO uses signed real values multiplicatively.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`
 *     (operator is identically zero; nothing to learn).
 *   - Non-finite computed quantity (defensive): surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTeagerKaiserSort =
  | 'tkeo-asc'
  | 'tkeo-desc'
  | 'abs-asc'
  | 'abs-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTeagerKaiserOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 3`. Default 8.
   */
  minRows?: number;
  /**
   * If true, divide the unnormalised tkeoMean by the population
   * variance (sigma^2) of the series. Reports the normalised
   * value as `tkeoMeanNormalized`. Default false.
   */
  normalize?: boolean;
  /**
   * Optional lower bound on reported TKEO. When `--normalize`
   * is on, the bound applies to `tkeoMeanNormalized`; otherwise
   * to `tkeoMean`. Sources whose value is strictly below the
   * threshold are suppressed and counted under
   * `droppedBelowMinTkeo`. Useful to surface only the
   * high-energy / high-frequency-content sources.
   */
  minTkeo?: number | null;
  /**
   * Optional upper bound on reported TKEO. Symmetric counterpart
   * to `minTkeo`. Surfaces in `droppedAboveMaxTkeo`. Useful to
   * surface only the quiet / low-energy sources for diagnostics.
   *
   * If both are set and `minTkeo > maxTkeo`, the constructor
   * throws — that is operator error, not a silent empty report.
   */
  maxTkeo?: number | null;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tkeo-asc' (default): tkeoMean ascending — quietest
   *                           (lowest amplitude*frequency energy) first.
   *   - 'tkeo-desc':          tkeoMean descending — most-energetic first.
   *   - 'rows':               rowsKept desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   *
   * When `--normalize` is set, the sort key applies to
   * `tkeoMeanNormalized`.
   */
  sort?: SourceRowTokenTeagerKaiserSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTeagerKaiserRow {
  source: string;
  rowsKept: number;
  /** n - 2; number of interior samples on which psi was evaluated. */
  interiorSamples: number;
  /** Population stddev of v; reported for context. */
  sigma: number;
  /** Mean of psi_i = x_i^2 - x_{i-1} * x_{i+1} over interior samples. */
  tkeoMean: number;
  /**
   * Present iff `--normalize` was requested. Value is
   * tkeoMean / sigma^2. Null otherwise.
   */
  tkeoMeanNormalized: number | null;
}

export interface SourceRowTokenTeagerKaiserReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  normalize: boolean;
  minTkeo: number | null;
  maxTkeo: number | null;
  top: number | null;
  sort: SourceRowTokenTeagerKaiserSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  droppedBelowMinTkeo: number;
  droppedAboveMaxTkeo: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTeagerKaiserRow[];
}

const VALID_SORTS = ['tkeo-asc', 'tkeo-desc', 'abs-asc', 'abs-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenTeagerKaiser(
  queue: QueueLine[],
  opts: SourceRowTokenTeagerKaiserOptions = {},
): SourceRowTokenTeagerKaiserReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 3) {
    throw new Error(
      `minRows must be an integer >= 3 (got ${opts.minRows})`,
    );
  }
  const normalize = opts.normalize ?? false;
  const minTkeo = opts.minTkeo ?? null;
  if (minTkeo !== null) {
    if (!Number.isFinite(minTkeo)) {
      throw new Error(`minTkeo must be a finite number (got ${opts.minTkeo})`);
    }
  }
  const maxTkeo = opts.maxTkeo ?? null;
  if (maxTkeo !== null) {
    if (!Number.isFinite(maxTkeo)) {
      throw new Error(`maxTkeo must be a finite number (got ${opts.maxTkeo})`);
    }
  }
  if (minTkeo !== null && maxTkeo !== null && minTkeo > maxTkeo) {
    throw new Error(
      `minTkeo (${minTkeo}) must be <= maxTkeo (${maxTkeo})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tkeo-asc';
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
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenTeagerKaiserRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let mean = 0;
    for (let i = 0; i < n; i++) mean += v[i]!;
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      const d = v[i]! - mean;
      variance += d * d;
    }
    variance /= n;
    const sigma = Math.sqrt(variance);

    if (sigma === 0) {
      droppedZeroVariance += 1;
      continue;
    }

    // Kaiser TKEO: psi_i = x_i^2 - x_{i-1} * x_{i+1}, i in [1, n-2].
    let sumPsi = 0;
    const interior = n - 2;
    for (let i = 1; i <= n - 2; i++) {
      const psi = v[i]! * v[i]! - v[i - 1]! * v[i + 1]!;
      sumPsi += psi;
    }
    const tkeoMean = sumPsi / interior;

    let tkeoMeanNormalized: number | null = null;
    if (normalize) {
      tkeoMeanNormalized = tkeoMean / variance;
    }

    if (
      !Number.isFinite(tkeoMean) ||
      (normalize && !Number.isFinite(tkeoMeanNormalized!))
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      interiorSamples: interior,
      sigma,
      tkeoMean,
      tkeoMeanNormalized,
    });
  }

  function tkeoKey(row: SourceRowTokenTeagerKaiserRow): number {
    if (normalize && row.tkeoMeanNormalized !== null) {
      return row.tkeoMeanNormalized;
    }
    return row.tkeoMean;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'tkeo-asc') {
      primary = tkeoKey(a) - tkeoKey(b);
    } else if (sort === 'tkeo-desc') {
      primary = tkeoKey(b) - tkeoKey(a);
    } else if (sort === 'abs-asc') {
      primary = Math.abs(tkeoKey(a)) - Math.abs(tkeoKey(b));
    } else if (sort === 'abs-desc') {
      primary = Math.abs(tkeoKey(b)) - Math.abs(tkeoKey(a));
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinTkeo = 0;
  let droppedAboveMaxTkeo = 0;
  let postRows = allRows;
  if (minTkeo !== null || maxTkeo !== null) {
    const kept: SourceRowTokenTeagerKaiserRow[] = [];
    for (const row of postRows) {
      const v =
        normalize && row.tkeoMeanNormalized !== null
          ? row.tkeoMeanNormalized
          : row.tkeoMean;
      if (minTkeo !== null && v < minTkeo) {
        droppedBelowMinTkeo += 1;
        continue;
      }
      if (maxTkeo !== null && v > maxTkeo) {
        droppedAboveMaxTkeo += 1;
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
    normalize,
    minTkeo,
    maxTkeo,
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
    droppedDegenerate,
    droppedBelowMinTkeo,
    droppedAboveMaxTkeo,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
