/**
 * source-row-token-temporal-spread: per-source **Peeters
 * 2004 temporal spread** (a.k.a. temporal bandwidth) of the
 * per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how *wide* (in
 * normalized row-index units) is the amplitude-weighted
 * spread of its per-row token series around its own
 * temporal centroid?** This is a *time-domain* second-moment
 * descriptor: the amplitude-weighted standard deviation of
 * the *time index* around the temporal centroid, normalized
 * by the row-index span. It is the time-domain analog of
 * spectral-bandwidth (which is the energy-weighted standard
 * deviation of the *frequency index* around the spectral
 * centroid).
 *
 * For a non-negative-amplitude time series `a[n] = |x[n]|`,
 * `n = 0..N-1`, with `N >= minRows` and at least one
 * non-zero `a[n]`, define
 *
 *   tc_index = sum_{n} n * a[n] / sum_{n} a[n]                (Peeters 2004 §6.1)
 *   ts_index = sqrt( sum_{n} (n - tc_index)^2 * a[n]
 *                    / sum_{n} a[n] )                          (Peeters 2004 §6.1)
 *
 * In its raw form `ts_index` is in units of "row index"
 * (range `[0, (N-1)/2]`; the upper bound is achieved by a
 * mass split equally between row 0 and row N-1). Because
 * per-source `N` varies wildly across the queue, cross-source
 * comparability requires normalizing to the unit interval.
 * This lens reports the **normalized temporal spread**
 *
 *   ts = ts_index / (N - 1)            (range [0, 0.5])
 *
 * so a source with `ts -> 0` has all its energy concentrated
 * at a single row index (a perfect impulse — the narrowest
 * possible temporal footprint); a source with `ts -> 0.5`
 * has its energy split equally between the first and last
 * row (the widest possible temporal footprint, the
 * maximum-bimodal extreme); and a uniform-amplitude series
 * (energy spread evenly across all rows) lands at
 * `ts = sqrt((N+1)/(12(N-1)))` -> `1/sqrt(12) ~= 0.2887` as
 * `N -> inf` (the std of a discrete uniform distribution on
 * [0, N-1] divided by N-1).
 *
 * Crucially, this is **time-index-based**, not
 * wall-clock-based: the n-axis is the row ordinal of the
 * source's own appearances in the queue, not calendar time.
 * Two sources can have very different overall activity rates
 * and still be ranked on "is your usage tightly concentrated
 * in time, or smeared across your history?". This row-index-
 * amplitude framing is a direct time-domain mirror of the
 * bin-index-power framing used by spectral-bandwidth.
 *
 * Reported quantities:
 *   - `rowsKept`   : N (>= minRows by gate).
 *   - `totalAmp`   : sum_{n=0..N-1} a[n] = sum of total_tokens
 *                    after gates (descriptor's denominator).
 *   - `tcIndex`    : Peeters temporal centroid in row-index
 *                    units (range [0, N-1]). Co-reported so
 *                    operators can locate the spread.
 *   - `tsIndex`    : raw temporal spread in row-index units
 *                    (range [0, (N-1)/2]).
 *   - `ts`         : normalized temporal spread in [0, 0.5].
 *                    Headline.
 *
 * Citation: Peeters, G. (2004), "A large set of audio
 * features for sound description (similarity and
 * classification) in the CUIDADO project", IRCAM
 * Tech. Rep., §6.1 (Temporal Centroid + Temporal Spread:
 * amplitude-weighted mean and standard deviation of the time
 * index of an energy envelope).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **temporal-centroid** (1st time-domain moment):
 *     centroid asks *where* the mass sits; spread asks *how
 *     wide* it is around that position. Two sources with
 *     identical tc=0.5 can have very different ts: one with
 *     all energy at row N/2 (ts -> 0) vs one with energy
 *     split between row 0 and row N-1 (ts -> 0.5).
 *   - vs. **spectral-bandwidth** (2nd freq-domain moment):
 *     spectral-bandwidth is the power-weighted std of the
 *     *frequency bin index* on the PSD. Temporal spread is
 *     the amplitude-weighted std of the *time-row index*
 *     on the raw non-negative series. Two sources can share
 *     spectral-bandwidth (same frequency-content width) and
 *     have wildly different temporal-spread (one tightly
 *     clustered in time, one smeared across its history).
 *   - vs. **spectral-skewness / -kurtosis / -entropy /
 *     -flatness / -rolloff / -decrease / -irregularity**:
 *     all are *frequency-domain* descriptors. None describe
 *     *temporal* width. A series whose energy is concentrated
 *     in the first 10% of rows but with broadband spectral
 *     content has small ts and high spectral-bandwidth.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades. They
 *     are *position-invariant in time* — translating the
 *     series in row index does not change them. Temporal
 *     spread is *not* time-shift invariant: prepending
 *     quiet rows shifts both tc and ts.
 *   - vs. **hjorth-mobility / -complexity / TKEO**:
 *     normalized derivative-energy descriptors; do not
 *     localize energy width in time.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal
 *     / symbolic descriptors on transformed values. They
 *     ignore amplitude magnitude and time-index weighting.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness)**:
 *     all order-invariant: permuting the series in time
 *     gives the same value. Temporal spread is order-
 *     sensitive — shuffling the rows changes ts.
 *   - vs. **temporal-centroid + cv** (could you reconstruct
 *     ts from these?): no. cv is order-invariant on the
 *     amplitudes themselves; temporal-centroid is the first
 *     moment of the position*amplitude product. Neither
 *     captures how *wide around tc* the mass spreads. ts is
 *     the missing 2nd time-domain moment.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (denominator `sum a[n] = 0`):
 *     surfaces under `droppedZeroSeries`.
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

export type SourceRowTokenTemporalSpreadSort =
  | 'ts-desc'
  | 'ts-asc'
  | 'ts-index-desc'
  | 'ts-index-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalSpreadOptions {
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
   *   - 'ts-desc' (default): widest temporal footprint first.
   *   - 'ts-asc':            narrowest first (impulse-like).
   *   - 'ts-index-desc':     widest by raw row-index units.
   *   - 'ts-index-asc':      narrowest by raw row-index units.
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalSpreadSort;
  /**
   * Optional inclusive lower bound on `ts`. Sources with
   * ts < minTs surface under `droppedBelowMinTs`. Must be
   * in [0, 0.5]. Useful for "show me only widely-spread
   * sources" (filter out impulse-like). Default null.
   */
  minTs?: number | null;
  /**
   * Optional inclusive upper bound on `ts`. Sources with
   * ts > maxTs surface under `droppedAboveMaxTs`. Must be
   * in [0, 0.5] and >= minTs when both are set. Useful for
   * "show me only tightly-clustered sources". Default null.
   */
  maxTs?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalSpreadRow {
  source: string;
  rowsKept: number;
  /** sum_{n=0..N-1} a[n] (= sum of total_tokens; descriptor's denominator). */
  totalAmp: number;
  /** Peeters temporal centroid in row-index units (range [0, N-1]). */
  tcIndex: number;
  /** Raw temporal spread in row-index units (range [0, (N-1)/2]). */
  tsIndex: number;
  /** Normalized temporal spread in [0, 0.5]. Headline. */
  ts: number;
}

export interface SourceRowTokenTemporalSpreadReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalSpreadSort;
  minTs: number | null;
  maxTs: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroSeries: number;
  droppedDegenerate: number;
  droppedBelowMinTs: number;
  droppedAboveMaxTs: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalSpreadRow[];
}

const VALID_SORTS = [
  'ts-desc',
  'ts-asc',
  'ts-index-desc',
  'ts-index-asc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTemporalSpread(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalSpreadOptions = {},
): SourceRowTokenTemporalSpreadReport {
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
  const sort = opts.sort ?? 'ts-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const minTs = opts.minTs ?? null;
  if (minTs !== null) {
    if (!Number.isFinite(minTs) || minTs < 0 || minTs > 0.5) {
      throw new Error(`minTs must be in [0, 0.5] (got ${opts.minTs})`);
    }
  }
  const maxTs = opts.maxTs ?? null;
  if (maxTs !== null) {
    if (!Number.isFinite(maxTs) || maxTs < 0 || maxTs > 0.5) {
      throw new Error(`maxTs must be in [0, 0.5] (got ${opts.maxTs})`);
    }
  }
  if (minTs !== null && maxTs !== null && minTs > maxTs) {
    throw new Error(`minTs (${minTs}) must be <= maxTs (${maxTs})`);
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

  const allRows: SourceRowTokenTemporalSpreadRow[] = [];

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

    // Second central moment (amplitude-weighted variance of row
    // index around tcIndex), then sqrt for std.
    let m2 = 0;
    for (let i = 0; i < n; i++) {
      const d = i - tcIndex;
      m2 += d * d * a[i]!;
    }
    const variance = m2 / totalAmp;
    // Numerical floor: variance can be a tiny negative due to
    // floating-point cancellation when all mass sits at one row
    // (true variance = 0). Clamp to zero.
    const safeVar = variance > 0 ? variance : 0;
    const tsIndex = Math.sqrt(safeVar);
    const ts = tsIndex / (n - 1);

    if (
      !Number.isFinite(tcIndex) ||
      !Number.isFinite(tsIndex) ||
      !Number.isFinite(ts) ||
      ts < 0 ||
      ts > 0.5 + 1e-9
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      totalAmp,
      tcIndex,
      tsIndex,
      ts,
    });
  }

  // Apply min/max-ts filters (post-compute). These filter
  // BEFORE sort and BEFORE top-cap so the sort window matches
  // the operator's stated ts band.
  let droppedBelowMinTs = 0;
  let droppedAboveMaxTs = 0;
  let filteredRows = allRows;
  if (minTs !== null || maxTs !== null) {
    filteredRows = [];
    for (const row of allRows) {
      if (minTs !== null && row.ts < minTs) {
        droppedBelowMinTs += 1;
        continue;
      }
      if (maxTs !== null && row.ts > maxTs) {
        droppedAboveMaxTs += 1;
        continue;
      }
      filteredRows.push(row);
    }
  }

  filteredRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'ts-desc') {
      primary = b.ts - a.ts;
    } else if (sort === 'ts-asc') {
      primary = a.ts - b.ts;
    } else if (sort === 'ts-index-desc') {
      primary = b.tsIndex - a.tsIndex;
    } else if (sort === 'ts-index-asc') {
      primary = a.tsIndex - b.tsIndex;
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
    minTs,
    maxTs,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroSeries,
    droppedDegenerate,
    droppedBelowMinTs,
    droppedAboveMaxTs,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
