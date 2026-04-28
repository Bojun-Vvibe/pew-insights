/**
 * source-row-token-temporal-centroid: per-source **Peeters
 * 2004 temporal centroid** of the per-row `total_tokens`
 * sequence.
 *
 * Headline question: **for each source, where in its
 * own activity span (as a fraction 0..1) does the
 * energy-weighted center of mass of its per-row token
 * series sit?** This is a *time-domain* first-moment
 * descriptor: the energy-weighted mean of the *time index*,
 * normalized by the total span. It is the time-domain analog
 * of spectral-centroid (which is the energy-weighted mean of
 * the *frequency index*).
 *
 * For a non-negative-amplitude time series `a[n] = |x[n]|`,
 * `n = 0..N-1`, with `N >= minRows` and at least one
 * non-zero `a[n]`, Peeters 2004 §6.1 defines the temporal
 * centroid as
 *
 *   tc_index = sum_{n=0..N-1} n * a[n] / sum_{n=0..N-1} a[n]
 *
 * In its raw form `tc_index` is in units of "row index"
 * (range `[0, N-1]`). Because per-source `N` varies wildly
 * across the queue (a source with 64 rows vs one with 476),
 * cross-source comparability requires normalizing to the
 * unit interval. This lens reports the **normalized
 * temporal centroid**
 *
 *   tc = tc_index / (N - 1)            (range [0, 1])
 *
 * so a source with `tc = 0.5` has its energy-weighted
 * center exactly in the middle of its own row index span,
 * `tc < 0.5` means the source's energy is front-loaded
 * (early rows carry more `total_tokens` mass relative to
 * late rows), and `tc > 0.5` means it is back-loaded
 * (energy concentrated toward the latest rows of the
 * source's history).
 *
 * Crucially, this is **time-index-based**, not
 * wall-clock-based: the n-axis is the row ordinal of the
 * source's own appearances in the queue, not calendar time.
 * This is what makes it pure-shape and immune to
 * inter-source-rate differences. Two sources can have very
 * different overall activity rates and still be ranked on
 * "is your usage front-loaded or back-loaded across your
 * own history?". This row-index-amplitude framing is a
 * direct time-domain mirror of the bin-index-power framing
 * used by spectral-centroid.
 *
 * Reported quantities:
 *   - `rowsKept`   : N (>= minRows by gate).
 *   - `totalAmp`   : sum_{n=0..N-1} a[n] = sum of total_tokens
 *                    after gates (descriptor's denominator).
 *   - `weightedSum`: sum_{n=0..N-1} n * a[n] (numerator).
 *   - `tcIndex`    : raw centroid in units of row index
 *                    (range [0, N-1]).
 *   - `tc`         : normalized temporal centroid in [0, 1].
 *                    Headline.
 *
 * Citation: Peeters, G. (2004), "A large set of audio
 * features for sound description (similarity and
 * classification) in the CUIDADO project", IRCAM
 * Tech. Rep., §6.1 (Temporal Centroid: amplitude-weighted
 * mean of the time index of an energy envelope).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-centroid** (frequency-domain 1st
 *     moment): spectral-centroid is the energy-weighted
 *     mean of the *frequency bin index* on the PSD of
 *     the mean-centered series. Temporal centroid is the
 *     amplitude-weighted mean of the *time-row index* on
 *     the raw non-negative series. Two sources can share
 *     spectral-centroid (same dominant frequency content)
 *     and have wildly different temporal-centroid
 *     (front-loaded vs back-loaded). Conversely, two
 *     identically-shaped sequences (same tc) can have
 *     opposite spectral content.
 *   - vs. **spectral-bandwidth / -skewness / -kurtosis**:
 *     all are *frequency-domain* moments. None describe
 *     *where in time* the energy sits. A series whose energy
 *     is concentrated in the first 10% of rows but with
 *     broadband spectral content has tc << 0.5 and high
 *     bandwidth.
 *   - vs. **spectral-rolloff** (frequency CDF quantile):
 *     temporal-centroid is a time-domain first moment;
 *     rolloff is a frequency-domain CDF quantile. Two
 *     sources with the same 85% rolloff bin can have
 *     opposite temporal centroids.
 *   - vs. **spectral-flatness / -entropy**: frequency-domain
 *     concentration ratios; bin-permutation-invariant. They
 *     have no time-position information at all.
 *   - vs. **spectral-decrease**: frequency-domain
 *     1/(k-1)-weighted slope-from-anchor at frequency bin 1.
 *     A monotone-decreasing PSD has strong decrease but
 *     could have tc anywhere in [0, 1] depending on
 *     time-domain ordering.
 *   - vs. **spectral-irregularity** (Jensen 1999, lens
 *     just above this one): adjacent-bin difference energy
 *     of the PSD; a different *frequency*-domain operator.
 *     Temporal centroid is its time-domain dual in spirit
 *     (both are "shape" descriptors), but they live in
 *     different domains and are mutually un-derivable.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades. They
 *     are scale-invariant and *position-invariant in time*
 *     — translating the series in row index does not
 *     change them. Temporal centroid is *not* time-shift
 *     invariant: prepending a quiet row shifts tc.
 *   - vs. **hjorth-mobility / -complexity / TKEO**:
 *     normalized derivative-energy descriptors; do not
 *     localize energy in time.
 *   - vs. **autocorrelation-lag1 / mann-kendall / runs /
 *     turning-point**: lag-1 cohesion, monotone trend,
 *     run-length statistics. None compute a first moment
 *     of amplitude over time index. Mann-Kendall tracks
 *     rank-trend direction (up/down) but does not weight
 *     by amplitude — a small-amplitude monotone increase
 *     gets the same MK score as a huge one.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal
 *     / symbolic descriptors on transformed values. They
 *     ignore amplitude magnitude and time-index weighting.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness)**:
 *     all order-invariant: permuting the series in time
 *     gives the same value. Temporal centroid is *the*
 *     archetypal order-sensitive amplitude-domain
 *     descriptor — its whole point is "where in time".
 *   - vs. **spectral-centroid + DFA**: even taken together,
 *     they cannot reconstruct tc. Spectral-centroid throws
 *     away time, DFA throws away time-position. tc is the
 *     missing first moment.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (every `a[n] = 0`, denominator
 *     `sum a[n] = 0`): surfaces under `droppedZeroSeries`.
 *   - Single-row series after filters: would have
 *     `N - 1 = 0` (division by zero in normalization);
 *     blocked by the `minRows >= 2` gate.
 *   - Defensive non-finite computed quantity: surfaces
 *     under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTemporalCentroidSort =
  | 'tc-desc'
  | 'tc-asc'
  | 'tc-index-desc'
  | 'tc-index-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalCentroidOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 2` (need at least 2 rows so the
   * normalization N - 1 >= 1). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tc-desc' (default): most back-loaded first (tc -> 1).
   *   - 'tc-asc':            most front-loaded first (tc -> 0).
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalCentroidSort;
  /**
   * Optional inclusive lower bound on `tc`. Sources with
   * tc < minTc surface under `droppedBelowMinTc`. Must be in
   * [0, 1]. Useful for "show me only back-loaded sources".
   * Default null.
   */
  minTc?: number | null;
  /**
   * Optional inclusive upper bound on `tc`. Sources with
   * tc > maxTc surface under `droppedAboveMaxTc`. Must be in
   * [0, 1] and >= minTc when both are set. Useful for "show
   * me only front-loaded sources". Default null.
   */
  maxTc?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalCentroidRow {
  source: string;
  rowsKept: number;
  /** sum_{n=0..N-1} a[n] (= sum of total_tokens; descriptor's denominator). */
  totalAmp: number;
  /** sum_{n=0..N-1} n * a[n] (descriptor's numerator). */
  weightedSum: number;
  /** Raw centroid in row-index units (range [0, N-1]). */
  tcIndex: number;
  /** Normalized temporal centroid in [0, 1]. Headline. */
  tc: number;
}

export interface SourceRowTokenTemporalCentroidReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalCentroidSort;
  minTc: number | null;
  maxTc: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroSeries: number;
  droppedDegenerate: number;
  droppedBelowMinTc: number;
  droppedAboveMaxTc: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalCentroidRow[];
}

const VALID_SORTS = [
  'tc-desc',
  'tc-asc',
  'tc-index-desc',
  'tc-index-asc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTemporalCentroid(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalCentroidOptions = {},
): SourceRowTokenTemporalCentroidReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 2) {
    throw new Error(
      `minRows must be an integer >= 2 (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tc-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const minTc = opts.minTc ?? null;
  if (minTc !== null) {
    if (!Number.isFinite(minTc) || minTc < 0 || minTc > 1) {
      throw new Error(`minTc must be in [0, 1] (got ${opts.minTc})`);
    }
  }
  const maxTc = opts.maxTc ?? null;
  if (maxTc !== null) {
    if (!Number.isFinite(maxTc) || maxTc < 0 || maxTc > 1) {
      throw new Error(`maxTc must be in [0, 1] (got ${opts.maxTc})`);
    }
  }
  if (minTc !== null && maxTc !== null && minTc > maxTc) {
    throw new Error(
      `minTc (${minTc}) must be <= maxTc (${maxTc})`,
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

  const allRows: SourceRowTokenTemporalCentroidRow[] = [];

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
    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i]!;
      totalAmp += v;
      weightedSum += i * v;
    }

    if (totalAmp <= 0 || !Number.isFinite(totalAmp)) {
      droppedZeroSeries += 1;
      continue;
    }

    const tcIndex = weightedSum / totalAmp;
    const tc = tcIndex / (n - 1);

    if (
      !Number.isFinite(tcIndex) ||
      !Number.isFinite(tc) ||
      tc < 0 ||
      tc > 1
    ) {
      droppedDegenerate += 1;
      continue;
    }

    // Pinned invariant: tc must lie in [0, 1] for every emitted
    // row (already enforced above as a degenerate guard, but
    // make the contract explicit so downstream consumers can
    // rely on it). For non-negative a[n] with at least one
    // positive value, tc_index = sum(n * a[n]) / sum(a[n]) is
    // a convex combination of {0, 1, ..., N-1}, so tc_index in
    // [0, N-1] and tc = tc_index / (N-1) in [0, 1] by
    // construction.
    if (tc < 0 || tc > 1) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      totalAmp,
      weightedSum,
      tcIndex,
      tc,
    });
  }

  // Apply min/max-tc filters (post-compute). These filter
  // BEFORE sort and BEFORE top-cap so the sort window matches
  // the operator's stated tc range.
  let droppedBelowMinTc = 0;
  let droppedAboveMaxTc = 0;
  let filteredRows = allRows;
  if (minTc !== null || maxTc !== null) {
    filteredRows = [];
    for (const row of allRows) {
      if (minTc !== null && row.tc < minTc) {
        droppedBelowMinTc += 1;
        continue;
      }
      if (maxTc !== null && row.tc > maxTc) {
        droppedAboveMaxTc += 1;
        continue;
      }
      filteredRows.push(row);
    }
  }

  filteredRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'tc-desc') {
      primary = b.tc - a.tc;
    } else if (sort === 'tc-asc') {
      primary = a.tc - b.tc;
    } else if (sort === 'tc-index-desc') {
      primary = b.tcIndex - a.tcIndex;
    } else if (sort === 'tc-index-asc') {
      primary = a.tcIndex - b.tcIndex;
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

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
    minTc,
    maxTc,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroSeries,
    droppedDegenerate,
    droppedBelowMinTc,
    droppedAboveMaxTc,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
