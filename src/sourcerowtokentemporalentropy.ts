/**
 * source-row-token-temporal-entropy: per-source **Shannon entropy
 * of the normalized per-row total_tokens amplitude envelope**,
 * computed in the row-index domain rather than on a transformed
 * spectrum or symbolic alphabet.
 *
 * Headline question: **for each source, how *evenly distributed*
 * is the total token mass across the per-row envelope, in nats
 * (and as a 0..1 normalized fraction of the maximum-entropy
 * uniform reference)?**
 *
 * For a non-negative series `a[n] = total_tokens[n]`,
 * `n = 0..N-1`, with `N >= minRows` and `S = sum_n a[n] > 0`,
 * normalize the envelope into a probability distribution
 *
 *   p[n] = a[n] / S,    sum_n p[n] = 1,    p[n] >= 0
 *
 * Then the **temporal Shannon entropy** in nats is
 *
 *   H(p) = - sum_{n : p[n] > 0} p[n] * ln(p[n])
 *
 * with the standard 0 * log(0) := 0 convention. The
 * **normalized temporal entropy** is
 *
 *   H_norm(p) = H(p) / ln(N)    in [0, 1]
 *
 * where ln(N) is the maximum entropy (uniform p[n] = 1/N).
 * This is the headline value reported as `normEntropy`.
 *
 * Theoretical anchors:
 *
 *   - `H_norm = 1`: the envelope is **perfectly uniform across
 *     all rows** (every row carries exactly S/N tokens). The
 *     mass is spread as evenly as possible.
 *   - `H_norm = 0`: the envelope is **a single-row impulse**
 *     (one row carries all S tokens, all others carry zero).
 *     The mass is maximally concentrated.
 *   - Intermediate values describe how close the envelope is
 *     to one extreme or the other.
 *
 * This is the *time-domain dual* of `source-row-token-spectral
 * -entropy`. Spectral entropy applies the Shannon formula to
 * the normalized one-sided non-DC PSD bins; temporal entropy
 * applies the SAME formula to the row-domain amplitudes
 * normalized to a probability mass function. The two are
 * genuinely different:
 *   - A perfectly tonal sine wave has very low spectral
 *     entropy (one PSD bin dominates) but high temporal
 *     entropy (the |sine| amplitude envelope spreads mass
 *     across many rows roughly uniformly).
 *   - A constant DC level has high temporal entropy
 *     (uniform row mass) and undefined spectral entropy
 *     after mean-centering (zero variance).
 *   - An impulsive single-row spike has zero temporal
 *     entropy (one row carries all mass) and high spectral
 *     entropy (an impulse has flat broadband spectrum).
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      (note: Shannon entropy of {p[n]} is *order-invariant*
 *      on the multiset; sorting is for determinism / consistency
 *      with sibling lenses, not for numerics).
 *   4. Skip if `n < minRows` (default 8).
 *   5. Skip if `S = sum_n a[n] == 0` (`droppedZeroSeries`).
 *   6. Normalize: p[n] = a[n] / S.
 *   7. H = - sum_{n : p[n] > 0} p[n] * ln(p[n]).
 *   8. normEntropy = H / ln(N).
 *
 * Reported quantities:
 *   - `rowsKept`     : N (>= minRows by gate).
 *   - `nonZeroRows`  : count of rows with a[n] > 0 (the
 *     support size of p; useful diagnostic).
 *   - `totalAmp`     : sum_{n} a[n] = S.
 *   - `entropyNats`  : H(p) in nats.
 *   - `maxEntropy`   : ln(N) — the uniform-distribution
 *     reference, co-reported so operators can compute
 *     H/ln(N) themselves and verify normEntropy.
 *   - `normEntropy`  : H / ln(N) in [0, 1]. Headline.
 *
 * Citation: Shannon, C. E. (1948), "A Mathematical Theory of
 * Communication", Bell Sys. Tech. J. 27:379-423, 623-656
 * (defines the Shannon entropy H = -sum p log p). Misra et al.
 * (2004), "Estimation of the Shannon's entropy of several
 * shifted exponential populations" (treats finite-sample
 * entropy of normalized empirical mass functions). The
 * application to a time-domain amplitude envelope (rather
 * than a power spectrum) follows the same pattern as
 * Peeters (2004), CUIDADO IRCAM Tech. Rep., §6.1, where
 * the amplitude envelope a[n] is treated as a first-class
 * time-domain object.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-entropy**: applies the SAME Shannon
 *     formula but to the one-sided non-DC PSD, not the
 *     row-domain mass function. A sine wave, a constant,
 *     and an impulse each occupy a distinct (H_temp, H_spec)
 *     quadrant, so the two lenses are independent.
 *   - vs. **temporal-flatness (G/A ratio)**: both are
 *     order-invariant amplitude-shape concentration
 *     descriptors, but they are *different functionals*.
 *     Temporal-flatness is the geometric/arithmetic mean
 *     ratio (a Wiener-entropy in the multiplicative sense);
 *     temporal-entropy is the Shannon entropy of the
 *     normalized mass function (an additive information
 *     measure). They agree on the extremes (constant ->
 *     both maximal; single spike -> both minimal) but
 *     diverge on the middle: e.g. a series with half the
 *     rows at value v and half at zero has
 *     `tf = 0` but `H_norm = ln(N/2)/ln(N) > 0`. They
 *     answer different questions: tf asks "how spiky are
 *     the AMPLITUDES?", H_norm asks "how SPREAD-OUT is
 *     the MASS?".
 *   - vs. **temporal-centroid / -spread / -skewness /
 *     -kurtosis (Peeters 2004 §6.1 quartet)**: those are
 *     amplitude-weighted moments of the *row index*. They
 *     describe *where* / *how wide* / *which lean* / *how
 *     peaked* the mass sits along n. Temporal-entropy is
 *     *position-invariant*: permuting the rows does not
 *     change H(p). It picks up only the multiset of
 *     normalized probabilities, not their position.
 *   - vs. **amplitude-shape gini / mad / iqr-ratio /
 *     coefficient-of-variation / kurtosis / skewness /
 *     burstiness-coefficient / crest-factor**: those are
 *     also order-invariant amplitude-shape descriptors.
 *     Temporal-entropy is the *Shannon-information* member
 *     of that family, distinct from Lorenz/Gini area
 *     ratios, absolute-deviation ratios, percentile
 *     ratios, peak-to-mean ratios, and standardized
 *     central moments. Shannon entropy uniquely captures
 *     *information-theoretic* concentration: it is the
 *     log-likelihood of the empirical mass function under
 *     itself, normalized by the maximum-entropy uniform.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: those
 *     count motif-frequency or pattern-novelty on
 *     transformed symbol sequences (e.g. permutation
 *     patterns of m-tuples, or LZ-compression dictionary
 *     size). Temporal-entropy is computed directly on the
 *     raw amplitude magnitudes treated as a probability
 *     mass; it is sensitive to amplitude scale in the
 *     non-uniform direction (a tall spike + flat tail has
 *     lower H than a balanced series even when the
 *     symbolic patterns are identical).
 *   - vs. **renyi-entropy**: Rényi entropy of order alpha
 *     is `H_alpha = (1/(1-alpha)) * ln(sum p^alpha)`,
 *     which generalizes Shannon (alpha -> 1). The
 *     existing `source-row-token-renyi-entropy` lens
 *     reports a single non-Shannon order (typically
 *     alpha = 2, the collision entropy) on a *symbolic*
 *     coarse-graining of the series. This lens reports
 *     the alpha = 1 (Shannon) limit on the *raw amplitude*
 *     mass function. Different order, different
 *     coarse-graining, different domain.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades (self-
 *     similarity). They are amplitude-rescaling-invariant.
 *     Temporal-entropy is *amplitude-scale-invariant* in
 *     a different way: rescaling all amplitudes by `c > 0`
 *     leaves p[n] = a[n]/S unchanged (both numerator and
 *     denominator scale by c), so H is unchanged.
 *   - vs. **hjorth-mobility / -complexity / TKEO**: those
 *     are normalized derivative-energy descriptors that
 *     pick up local roughness. Temporal-entropy is global
 *     and ignores adjacency.
 *   - vs. **autocorrelation-lag1 / runs-test / turning-point /
 *     mann-kendall / zero-crossing-rate**: those are event-
 *     count or sign-pattern descriptors. Temporal-entropy
 *     ignores order entirely.
 *
 * Key invariants:
 *   - `entropyNats >= 0` always (Shannon non-negativity).
 *   - `entropyNats <= ln(N)` always (max entropy uniform).
 *   - `normEntropy in [0, 1]` always.
 *   - `normEntropy == 1` iff p[n] is uniform (a[n] all equal
 *     and positive).
 *   - `normEntropy == 0` iff p[n] is a single-point mass
 *     (one row carries all of S, all others zero).
 *   - **Amplitude-scale invariant**: a[n] -> c * a[n] for any
 *     c > 0 leaves p[n] = a[n]/S unchanged, so H unchanged.
 *   - **Order-invariant** (permutation of n): H depends only
 *     on the multiset {p[n]}, not on the row order.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (`S == 0`): surfaces under
 *     `droppedZeroSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTemporalEntropySort =
  | 'norm-entropy-desc'
  | 'norm-entropy-asc'
  | 'dist-uniform-asc'
  | 'dist-uniform-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4`. Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'norm-entropy-desc' (default): most-uniform / spread mass first.
   *   - 'norm-entropy-asc':            most-concentrated mass first.
   *   - 'dist-uniform-asc':            closest to uniform reference first.
   *   - 'dist-uniform-desc':           farthest from uniform first.
   *   - 'rows':                        rowsKept desc.
   *   - 'source':                      source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalEntropySort;
  /**
   * Optional inclusive lower bound on `normEntropy`. Sources
   * with normEntropy < x surface under `droppedBelowMinNormEntropy`.
   * Must be a finite real in [0, 1]. Useful for "show me only
   * the spread-mass cohort" (e.g. `--min-norm-entropy 0.7`).
   * Default null.
   */
  minNormEntropy?: number | null;
  /**
   * Optional inclusive upper bound on `normEntropy`. Sources
   * with normEntropy > x surface under `droppedAboveMaxNormEntropy`.
   * Must be a finite real in [0, 1] and `>= minNormEntropy`
   * when both are set. Useful for "show me only the
   * concentrated cohort" (e.g. `--max-norm-entropy 0.4`).
   * Default null.
   */
  maxNormEntropy?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalEntropyRow {
  source: string;
  rowsKept: number;
  /** Count of rows where a[n] > 0 (support size of p). */
  nonZeroRows: number;
  /** sum_{n=0..N-1} a[n] = S. */
  totalAmp: number;
  /** Shannon entropy of {p[n] = a[n]/S} in nats. */
  entropyNats: number;
  /** ln(rowsKept) — the uniform-reference maximum entropy. */
  maxEntropy: number;
  /** Normalized entropy entropyNats / maxEntropy in [0, 1]. Headline. */
  normEntropy: number;
}

export interface SourceRowTokenTemporalEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalEntropySort;
  minNormEntropy: number | null;
  maxNormEntropy: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroSeries: number;
  droppedDegenerate: number;
  droppedBelowMinNormEntropy: number;
  droppedAboveMaxNormEntropy: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalEntropyRow[];
}

const VALID_SORTS = [
  'norm-entropy-desc',
  'norm-entropy-asc',
  'dist-uniform-asc',
  'dist-uniform-desc',
  'rows',
  'source',
] as const;

/**
 * Reference value for the "perfectly uniform" envelope's
 * normalized temporal entropy. By the Shannon non-negativity
 * and max-entropy properties, normEntropy in [0, 1] with
 * equality at 1 iff p is uniform. We pin 1 as the reference
 * for the `dist-uniform-*` sort modes.
 */
const UNIFORM_NORM_ENTROPY = 1;

export function buildSourceRowTokenTemporalEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalEntropyOptions = {},
): SourceRowTokenTemporalEntropyReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 4) {
    throw new Error(`minRows must be an integer >= 4 (got ${opts.minRows})`);
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'norm-entropy-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const minNormEntropy = opts.minNormEntropy ?? null;
  if (minNormEntropy !== null) {
    if (!Number.isFinite(minNormEntropy)) {
      throw new Error(
        `minNormEntropy must be a finite real (got ${opts.minNormEntropy})`,
      );
    }
    if (minNormEntropy < 0 || minNormEntropy > 1) {
      throw new Error(
        `minNormEntropy must be in [0, 1] (the Shannon normalized range); got ${opts.minNormEntropy}`,
      );
    }
  }
  const maxNormEntropy = opts.maxNormEntropy ?? null;
  if (maxNormEntropy !== null) {
    if (!Number.isFinite(maxNormEntropy)) {
      throw new Error(
        `maxNormEntropy must be a finite real (got ${opts.maxNormEntropy})`,
      );
    }
    if (maxNormEntropy < 0 || maxNormEntropy > 1) {
      throw new Error(
        `maxNormEntropy must be in [0, 1] (the Shannon normalized range); got ${opts.maxNormEntropy}`,
      );
    }
  }
  if (
    minNormEntropy !== null &&
    maxNormEntropy !== null &&
    minNormEntropy > maxNormEntropy
  ) {
    throw new Error(
      `minNormEntropy (${minNormEntropy}) must be <= maxNormEntropy (${maxNormEntropy})`,
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
  let droppedZeroSeries = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenTemporalEntropyRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const a = samples.map((s) => s[1]);
    const n = a.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let totalAmp = 0;
    let nonZeroRows = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i]!;
      totalAmp += v;
      if (v > 0) nonZeroRows += 1;
    }

    if (totalAmp <= 0 || !Number.isFinite(totalAmp)) {
      droppedZeroSeries += 1;
      continue;
    }

    // Shannon entropy in nats with 0*log0 := 0 convention.
    let entropyNats = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i]!;
      if (v > 0) {
        const p = v / totalAmp;
        entropyNats -= p * Math.log(p);
      }
    }

    const maxEntropy = Math.log(n);
    const normEntropy = maxEntropy > 0 ? entropyNats / maxEntropy : 0;

    if (
      !Number.isFinite(entropyNats) ||
      !Number.isFinite(maxEntropy) ||
      !Number.isFinite(normEntropy)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      nonZeroRows,
      totalAmp,
      entropyNats,
      maxEntropy,
      normEntropy,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'norm-entropy-desc') {
      primary = b.normEntropy - a.normEntropy;
    } else if (sort === 'norm-entropy-asc') {
      primary = a.normEntropy - b.normEntropy;
    } else if (sort === 'dist-uniform-asc') {
      primary =
        Math.abs(a.normEntropy - UNIFORM_NORM_ENTROPY) -
        Math.abs(b.normEntropy - UNIFORM_NORM_ENTROPY);
    } else if (sort === 'dist-uniform-desc') {
      primary =
        Math.abs(b.normEntropy - UNIFORM_NORM_ENTROPY) -
        Math.abs(a.normEntropy - UNIFORM_NORM_ENTROPY);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  // Apply min/max-norm-entropy filters BEFORE top cap so the
  // sort window matches the operator's stated band.
  let droppedBelowMinNormEntropy = 0;
  let droppedAboveMaxNormEntropy = 0;
  let filteredRows = allRows;
  if (minNormEntropy !== null || maxNormEntropy !== null) {
    filteredRows = [];
    for (const row of allRows) {
      if (minNormEntropy !== null && row.normEntropy < minNormEntropy) {
        droppedBelowMinNormEntropy += 1;
        continue;
      }
      if (maxNormEntropy !== null && row.normEntropy > maxNormEntropy) {
        droppedAboveMaxNormEntropy += 1;
        continue;
      }
      filteredRows.push(row);
    }
  }
  let droppedBelowTopCap = 0;
  let finalSources = filteredRows;
  if (top !== null && filteredRows.length > top) {
    droppedBelowTopCap = filteredRows.length - top;
    finalSources = filteredRows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minRows,
    top,
    sort,
    minNormEntropy,
    maxNormEntropy,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroSeries,
    droppedDegenerate,
    droppedBelowMinNormEntropy,
    droppedAboveMaxNormEntropy,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
