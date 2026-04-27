/**
 * source-row-token-katz-fd: per-source **Katz Fractal
 * Dimension (KFD)** of Katz (1988) on the per-row
 * `total_tokens` time-ordered sequence.
 *
 * Headline question: **for each source, treating the per-row
 * token-count sequence as a 2D planar curve in (i, v[i]), how
 * does the curve's total path length compare to its maximum
 * extent from its starting point?** A perfectly straight curve
 * has KFD -> 1 (path length equals the chord). A maximally
 * coiled / space-filling curve has KFD ~ 2 (path length grows
 * much faster than the chord).
 *
 * Construction (Katz 1988, Comput. Biol. Med. 18(3):145-156):
 *
 *   1. Filter queue rows by [since, until) and optional
 *      `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (each surfaces in its own counter).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      so the test sees the actual temporal sequence v[0..N-1].
 *   4. Skip the source if `n < minRows` (default 16; needs
 *      enough length for L and d to be stable).
 *   5. Skip the source if `sigma == 0` (a constant series gives
 *      L = N - 1 in normalised coords and d = 0 -> log(0) is
 *      undefined). Surfaces under `droppedZeroVariance`. This is
 *      an honest drop, not a "KFD = 1" report.
 *   6. **Katz normalisation.** Compute the raw 2D step lengths
 *      `e[i] = sqrt(1 + (v[i+1] - v[i])^2)` for `i = 0..N-2`.
 *      The raw average step `a = (1/(N-1)) * sum e[i]`. Divide
 *      every `v[i]` by `a` (this is Katz's published
 *      scale-invariance trick: it puts the curve in
 *      "per-step-length" units so KFD does not change under any
 *      affine rescaling of the values). All quantities below
 *      use the **normalised** sequence `v_norm[i] = v[i] / a`.
 *   7. Compute on the normalised curve `(i, v_norm[i])`:
 *        - `L = sum_{i=0..N-2} sqrt(1 + (v_norm[i+1] - v_norm[i])^2)`
 *          = total Euclidean path length.
 *        - `d = max_{i=0..N-1} sqrt(i^2 + (v_norm[i] - v_norm[0])^2)`
 *          = maximum Euclidean distance from the starting point.
 *        - `n = L / aHat`, where `aHat` is the average step on
 *          the **normalised** curve. By construction of the Katz
 *          normalisation, `aHat = 1`, so `n = L` numerically
 *          equals the path length, but conceptually is the
 *          "number of unit steps" in the curve. We track both
 *          `L` and `n` for transparency.
 *   8. Katz's formula:
 *        `KFD = log10(n) / (log10(n) + log10(d / L))`.
 *      For a perfectly straight (i.e. monotone-affine) curve,
 *      `d = L`, so `log(d/L) = 0` and `KFD = 1`. For an
 *      arbitrarily coiled curve `L >> d`, so `log(d/L)` is
 *      a large negative number and `KFD` rises toward 2.
 *      Skip the source under `droppedDegenerate` if any of the
 *      following non-recoverable conditions hits:
 *        - `L <= 0` (cannot take log)
 *        - `d <= 0` (curve never moves away from its start;
 *          can happen for a non-constant series that just
 *          oscillates back to v[0] at every step, but in
 *          practice is almost impossible for `N >= minRows`
 *          because the i-component of d already grows like i)
 *        - `n <= 1` (cannot take log10(n))
 *        - the denominator `log10(n) + log10(d/L)` is exactly
 *          zero (KFD undefined).
 *   9. Clamp the reported KFD to the theoretical bracket
 *      `[1, 2]`. Values outside that range are flagged via
 *      `clampedBelow1` / `clampedAbove2` counters; the raw
 *      pre-clamp value is preserved in `kfdRaw` so the operator
 *      can audit the raw computation.
 *
 * Reading KFD:
 *   - KFD ~ 1.0 = a near-monotone, straight-ish trajectory
 *     (path length barely exceeds the start-to-extreme chord).
 *   - KFD ~ 1.3-1.5 = moderate roughness; the curve coils back
 *     on itself a substantial fraction of its extent.
 *   - KFD -> 2 = a heavily oscillating, almost
 *     space-filling trajectory.
 *   - Strict numerical comparison across series is most valid
 *     when N is held approximately fixed (KFD has a known
 *     log(N) bias — that's the reason the `--length-correct`
 *     refinement option exists, see below in v0.6.129+).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite, including
 * the closest neighbour `source-row-token-higuchi-fd`:
 *
 *   - `source-row-token-higuchi-fd` (HFD): Higuchi estimates
 *     the slope of `log(L(k))` vs `log(k)` across **multiple
 *     sub-sampling strides** k = 1..kMax — i.e. it is a
 *     **scaling exponent** of the path length under
 *     coarse-graining. Katz uses **only stride 1** (the raw
 *     consecutive-difference path length) and instead compares
 *     that path length to a **single global geometric
 *     reference** (the maximum chord d). Mathematically:
 *     HFD = -d log(L(k)) / d log(k), which exists in the
 *     limit as a power-law scaling exponent;
 *     KFD = log(n) / (log(n) + log(d/L)), which is a closed-form
 *     ratio at one scale. The two coincide only for ideal
 *     self-similar curves with a clean L(k) ~ k^{-D} law. On
 *     empirical mixed-regime series with drift,
 *     heteroscedasticity, or short bursts, HFD and KFD
 *     **routinely disagree** because Katz is dominated by the
 *     single largest excursion (via d) while Higuchi averages
 *     the roughness across all strides 1..kMax. Concretely:
 *     ranking sources by HFD vs by KFD on the same data does
 *     **not** preserve order in general.
 *   - `source-row-token-hurst-rs` (Hurst R/S): R/S looks at the
 *     scaling of the **range of cumulative deviations** divided
 *     by stddev. KFD looks at a **fixed-scale geometric ratio**
 *     of arc length to maximum extent. The two probe entirely
 *     different aspects of the trajectory.
 *   - `source-row-token-dfa` (DFA-p): DFA detrends a cumulative
 *     profile within sliding windows and reports the rms
 *     residual scaling. KFD does not detrend at all and uses
 *     the raw values; their definitions barely overlap.
 *   - `source-row-token-permutation-entropy` (PE): PE is
 *     ordinal-only — value-blind beyond rank order. KFD is
 *     fully metric: actual numeric magnitudes drive both L
 *     and d.
 *   - `source-row-token-sample-entropy` (SampEn): SampEn is
 *     a **single-scale conditional irregularity** based on
 *     tolerance-matching of length-m windows. KFD is a
 *     **single-scale path-length-to-extent ratio** with no
 *     notion of pattern matching at all.
 *   - `source-row-token-mann-kendall-trend` / `-runs-test` /
 *     `-turning-point-count`: directional / dichotomy /
 *     extremum tests, not arc-length geometry.
 *   - `source-row-token-autocorrelation-lag1`: linear, lag-1,
 *     parametric. KFD is non-parametric and integrates
 *     information across the whole curve.
 *   - `source-row-token-lempel-ziv` / `-renyi-entropy`:
 *     symbolic / histogrammatic, value-domain or
 *     order-invariant respectively. KFD is geometric.
 *   - All order-invariant dispersion / shape lenses
 *     (-iqr-ratio, -mad, -skewness, -kurtosis, -gini,
 *     -burstiness-coefficient, -coefficient-of-variation):
 *     shuffling the sequence leaves them unchanged but
 *     dramatically inflates KFD because shuffling pumps L
 *     up while leaving d roughly comparable.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - `sigma == 0`: surfaces under `droppedZeroVariance`.
 *   - `L <= 0`, `d <= 0`, `n <= 1`, or denominator zero:
 *     surfaces under `droppedDegenerate`.
 *   - KFD outside `[1, 2]`: reported but `clampedBelow1` /
 *     `clampedAbove2` incremented; `kfd` carries the clamped
 *     value in `[1, 2]` and `kfdRaw` carries the raw value.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenKatzFdSort =
  | 'kfd-asc'
  | 'kfd-desc'
  | 'rows'
  | 'source';

/**
 * Plan-form for the Katz construction.
 *
 *   - '2d' (default): Katz's original 2D framing — treat the
 *     sequence as the planar curve `(i, v[i])`. Step lengths
 *     are `sqrt(1 + dv^2)` and `d` is the 2D chord
 *     `sqrt(i^2 + dv0^2)`. The i-axis (always unit step)
 *     dominates `d` and `L` for sequences with bounded value
 *     range relative to `n`, which is why every empirical
 *     KFD lands in `[1, 1.2]`.
 *
 *   - '1d': Esteller-style value-only variant — strip the
 *     i-axis. Step lengths reduce to `|dv|` and `d` reduces
 *     to `max_i |v[i] - v[0]|`. Mathematically:
 *     `KFD_1d = log10(n) / (log10(n) + log10(d_v / sum|dv|))`
 *     where `d_v = max_i |v[i] - v[0]|`. Without the
 *     unit-step i-axis padding, both `L` and `d` collapse to
 *     genuine value-domain quantities and the KFD spreads
 *     over a much wider range, making rankings between
 *     sources far more discriminating.
 */
export type SourceRowTokenKatzFdPlanform = '2d' | '1d';

export interface SourceRowTokenKatzFdOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4`. Default 16.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * If true, subtract the OLS linear trend from each per-source
   * value sequence before computing L, d, KFD. Default false.
   *
   * Why this matters and is genuinely orthogonal to the no-detrend
   * default: a strong linear drift inflates `d` (the max chord)
   * roughly linearly with N while inflating `L` by a fixed
   * additive amount per step, which biases KFD downward (toward
   * 1). Detrending isolates the **deviation from drift**,
   * exposing the genuine roughness regime of the increments.
   * The reported `sigma` is the stddev of the detrended series
   * when this flag is on, so the zero-variance gate also sees
   * the detrended residuals.
   */
  detrend?: boolean;
  /**
   * Plan-form selector: '2d' (default, Katz 1988 original) or
   * '1d' (Esteller et al. 2001 value-only variant). See the
   * type-level docstring on `SourceRowTokenKatzFdPlanform` for
   * the mathematical rationale; the practical effect is that
   * '1d' spreads the KFD distribution over a much wider
   * dynamic range than '2d', making cross-source rankings
   * substantially more discriminating on token-count series.
   */
  planform?: SourceRowTokenKatzFdPlanform;
  /**
   * Sort key for `sources[]`:
   *   - 'kfd-asc' (default): KFD ascending — straightest first.
   *   - 'kfd-desc':          KFD descending — most coiled first.
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenKatzFdSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenKatzFdRow {
  source: string;
  rowsKept: number;
  /** population stddev of v (informational; KFD itself is scale-invariant). */
  sigma: number;
  /** Total Euclidean path length on the Katz-normalised curve. */
  L: number;
  /** Maximum Euclidean distance from the starting point on the normalised curve. */
  d: number;
  /** Number of unit steps n = L / aHat (= L by construction of the normalisation). */
  n: number;
  /** Estimated Katz Fractal Dimension, clamped to [1, 2]. */
  kfd: number;
  /** Raw KFD prior to clamping; equals `kfd` unless clamping fired. */
  kfdRaw: number;
}

export interface SourceRowTokenKatzFdReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  detrend: boolean;
  planform: SourceRowTokenKatzFdPlanform;
  sort: SourceRowTokenKatzFdSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  clampedBelow1: number;
  clampedAbove2: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenKatzFdRow[];
}

const VALID_SORTS = ['kfd-asc', 'kfd-desc', 'rows', 'source'] as const;

export function buildSourceRowTokenKatzFd(
  queue: QueueLine[],
  opts: SourceRowTokenKatzFdOptions = {},
): SourceRowTokenKatzFdReport {
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
  const detrend = opts.detrend ?? false;
  const planform: SourceRowTokenKatzFdPlanform = opts.planform ?? '2d';
  if (planform !== '2d' && planform !== '1d') {
    throw new Error(`planform must be '2d' or '1d' (got ${opts.planform})`);
  }
  const sort = opts.sort ?? 'kfd-asc';
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
  let droppedDegenerate = 0;
  let clampedBelow1 = 0;
  let clampedAbove2 = 0;

  const allRows: SourceRowTokenKatzFdRow[] = [];

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

    // Population stddev (informational + zero-variance gate).
    let mean = 0;
    for (let i = 0; i < N; i++) mean += v[i]!;
    mean /= N;
    let variance = 0;
    for (let i = 0; i < N; i++) {
      const dv = v[i]! - mean;
      variance += dv * dv;
    }
    variance /= N;
    const sigma = Math.sqrt(variance);

    if (sigma === 0) {
      droppedZeroVariance += 1;
      continue;
    }

    // Raw average step length (in original v units, time step = 1
    // for the 2D planform; only the value delta for the 1D planform).
    let rawStepSum = 0;
    for (let i = 0; i < N - 1; i++) {
      const dy = v[i + 1]! - v[i]!;
      rawStepSum +=
        planform === '2d' ? Math.sqrt(1 + dy * dy) : Math.abs(dy);
    }
    const aRaw = rawStepSum / (N - 1);
    if (!(aRaw > 0)) {
      droppedDegenerate += 1;
      continue;
    }

    // Katz normalisation: divide v by aRaw.
    const vN: number[] = new Array(N);
    for (let i = 0; i < N; i++) vN[i] = v[i]! / aRaw;

    // L on normalised curve.
    let L = 0;
    for (let i = 0; i < N - 1; i++) {
      const dy = vN[i + 1]! - vN[i]!;
      L += planform === '2d' ? Math.sqrt(1 + dy * dy) : Math.abs(dy);
    }
    // d on normalised curve.
    const v0 = vN[0]!;
    let d = 0;
    for (let i = 0; i < N; i++) {
      const dy = vN[i]! - v0;
      const dist =
        planform === '2d'
          ? Math.sqrt(i * i + dy * dy)
          : Math.abs(dy);
      if (dist > d) d = dist;
    }

    // n = L / aHat where aHat = L / (N - 1) on the normalised curve,
    // hence n = N - 1 numerically. We retain the form `L / aHat` for
    // documentation but compute n = N - 1 for numerical stability.
    const n = N - 1;

    if (!(L > 0) || !(d > 0) || n <= 1) {
      droppedDegenerate += 1;
      continue;
    }

    const logN = Math.log10(n);
    const logRatio = Math.log10(d / L);
    const denom = logN + logRatio;
    if (!Number.isFinite(denom) || denom === 0) {
      droppedDegenerate += 1;
      continue;
    }

    const kfdRaw = logN / denom;
    let kfd = kfdRaw;
    if (kfdRaw < 1) {
      kfd = 1;
      clampedBelow1 += 1;
    } else if (kfdRaw > 2) {
      kfd = 2;
      clampedAbove2 += 1;
    }

    allRows.push({
      source,
      rowsKept: N,
      sigma,
      L,
      d,
      n,
      kfd,
      kfdRaw,
    });
  }

  // Sort.
  function kfdKey(row: SourceRowTokenKatzFdRow, asc: boolean): number {
    if (!Number.isFinite(row.kfd))
      return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return row.kfd;
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'kfd-asc') {
      primary = kfdKey(a, true) - kfdKey(b, true);
    } else if (sort === 'kfd-desc') {
      primary = kfdKey(b, false) - kfdKey(a, false);
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
    planform,
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
    clampedBelow1,
    clampedAbove2,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
