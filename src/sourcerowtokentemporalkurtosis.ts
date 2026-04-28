/**
 * source-row-token-temporal-kurtosis: per-source **Peeters
 * 2004 temporal kurtosis** (4th standardized time-domain
 * moment) of the per-row `total_tokens` series.
 *
 * Headline question: **for each source, how *peaked vs.
 * flat* is the amplitude envelope around its temporal
 * centroid along its row history?** This is a *time-domain*
 * fourth-moment descriptor: the standardized
 * amplitude-weighted fourth central moment of the row index
 * around the temporal centroid. It is the time-domain analog
 * of spectral-kurtosis (which is the standardized
 * power-weighted fourth central moment of the *frequency
 * bin index* around the spectral centroid).
 *
 * For a non-negative-amplitude time series `a[n] = |x[n]|`,
 * `n = 0..N-1`, with `N >= minRows` and at least one
 * non-zero `a[n]`, define
 *
 *   tc_index = sum_{n} n * a[n] / sum_{n} a[n]              (Peeters 2004 §6.1; 1st moment)
 *   ts_index = sqrt( sum_{n} (n - tc_index)^2 * a[n]
 *                    / sum_{n} a[n] )                       (Peeters 2004 §6.1; 2nd central moment)
 *   m4       = sum_{n} (n - tc_index)^4 * a[n]
 *              / sum_{n} a[n]                               (Peeters 2004 §6.1; 4th central moment)
 *   ts4      = m4 / ts_index^4                              (standardized; unitless; >= 1)
 *
 * `ts4` is the **standardized temporal kurtosis** (raw,
 * not excess; uses the Pearson convention so a flat
 * two-point split sits at 1 and the uniform envelope at
 * 1.8). The corresponding *excess* kurtosis is `ts4 - 3`,
 * but we report the raw form to stay consistent with
 * `source-row-token-spectral-kurtosis` and the rest of the
 * Peeters 2004 §6.1 quartet (centroid + spread + skewness
 * + kurtosis).
 *
 *   - `ts4 small (close to 1)`: amplitude envelope is
 *     **bimodal / two-sided**: most mass sits at the two
 *     extremes (row 0 and row N-1) with little near the
 *     centroid. Lower-bound 1.0 is achieved only by the
 *     symmetric two-point envelope (mass split equally
 *     between row 0 and row N-1).
 *   - `ts4 ~ 1.8`: uniform envelope (constant amplitude
 *     across all rows). Reference value: a uniform
 *     distribution on `[0, N-1]` has kurtosis exactly 9/5
 *     in the continuous limit.
 *   - `ts4 ~ 3`: Gaussian-like envelope (mesokurtic) —
 *     mass is concentrated near `tc_index` and tapers off
 *     at a "normal" rate.
 *   - `ts4 large (>> 3)`: amplitude envelope is **highly
 *     peaked / impulsive**: a tall narrow spike near
 *     `tc_index` with thin tails. The more impulsive the
 *     burst, the larger `ts4`.
 *
 * **Sign convention** matches Pearson's standardized
 * fourth moment / Peeters' temporal kurtosis exactly. There
 * is no normalization. `ts4` is bounded below by 1
 * (Cauchy-Schwarz) and unbounded above (a single near-
 * impulse mass at one row gives `ts4 -> +inf`, but a
 * single-row spike has `ts_index = 0` and surfaces under
 * `droppedZeroVariance` instead — see edge cases below).
 *
 * Crucially, this is **time-index-based**, not
 * wall-clock-based: the n-axis is the row ordinal of the
 * source's own appearances in the queue, not calendar
 * time. Two sources can have very different overall
 * activity rates and still be ranked on "is your usage
 * envelope sharply peaked or flatly bimodal within your
 * own history?".
 *
 * Reported quantities:
 *   - `rowsKept`   : N (>= minRows by gate).
 *   - `totalAmp`   : sum_{n} a[n] = sum of total_tokens
 *                    after gates (descriptor's denominator).
 *   - `tcIndex`    : Peeters temporal centroid in row-index
 *                    units (range [0, N-1]). Co-reported so
 *                    operators can locate the peak.
 *   - `tsIndex`    : raw temporal spread in row-index units
 *                    (range [0, (N-1)/2]). Co-reported so
 *                    operators can read the peakedness
 *                    *relative* to the spread.
 *   - `ts4`        : standardized temporal kurtosis
 *                    (unitless, >= 1). Headline.
 *
 * Citation: Peeters, G. (2004), "A large set of audio
 * features for sound description (similarity and
 * classification) in the CUIDADO project", IRCAM
 * Tech. Rep., §6.1 (Temporal Centroid + Temporal Spread +
 * Temporal Skewness + Temporal Kurtosis as the 1st/2nd/3rd/
 * 4th amplitude-weighted standardized moments of the time
 * index of an energy envelope).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **temporal-centroid** (1st time-domain moment):
 *     centroid asks *where* the mass sits; kurtosis asks
 *     *how peaked* the mass is around that position.
 *     Two sources with identical tc=0.5 can have wildly
 *     different ts4 — one with a tall narrow spike at the
 *     centroid (large ts4) versus one with mass split at
 *     the two endpoints (small ts4 ~ 1).
 *   - vs. **temporal-spread** (2nd time-domain moment):
 *     spread asks *how wide* the mass is around tc;
 *     kurtosis asks *what shape* that mass takes once
 *     standardized by its width. Spread divides out: ts4
 *     is invariant to a uniform rescaling of all
 *     amplitudes (multiplying every `a[n]` by `c > 0`
 *     leaves ts4 unchanged), and is *also* invariant to
 *     stretching the row index (since both m4 and ts^4
 *     scale identically). It picks up *only* the shape.
 *   - vs. **temporal-skewness** (3rd time-domain moment):
 *     skewness measures *which side* of tc the mass leans
 *     (sign-aware odd moment); kurtosis measures
 *     *peakedness vs. flatness* (sign-blind even moment).
 *     A mirrored series has flipped-sign ts3 but identical
 *     ts4. A two-sided symmetric envelope can have ts3=0
 *     and arbitrary ts4. The pair (ts3, ts4) describes
 *     orthogonal shape axes: lean direction vs. peak
 *     sharpness.
 *   - vs. **spectral-kurtosis** (4th freq-domain moment):
 *     spectral-kurtosis lives on the PSD's *frequency bin
 *     index* — it asks whether energy is concentrated at
 *     a few peaky frequency bins or spread flatly across
 *     the band. Temporal-kurtosis lives on the *time-row
 *     index* — it asks whether amplitude is concentrated
 *     at a few peaky rows or spread flatly across the row
 *     history. Two sources can share spectral-kurtosis
 *     (same frequency-content peakedness) and have wildly
 *     different temporal-kurtosis (one impulsive in time,
 *     one uniform), and vice versa.
 *   - vs. **amplitude-shape kurtosis** (the existing
 *     `source-row-token-kurtosis` lens): that lens is the
 *     standardized 4th moment of the *amplitude values
 *     themselves* (a.k.a. Pearson's kurtosis of `{a[n]}`
 *     as a multiset). It is *order-invariant*: permuting
 *     the rows in time gives the same value.
 *     Temporal-kurtosis is *order-sensitive*: shuffling
 *     the rows changes ts4, because the row index `n` is
 *     part of the formula. Two sources with identical
 *     amplitude histograms but different time orderings
 *     (e.g., one bimodal in time vs. one unimodal in
 *     time) will have identical amplitude-kurtosis but
 *     different ts4.
 *   - vs. **all spectral-* lenses (entropy, flatness,
 *     rolloff, decrease, irregularity, skewness, centroid,
 *     bandwidth)**: frequency-domain. None describe
 *     time-domain peakedness of the amplitude envelope.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades. They
 *     are *position-invariant in time* and *amplitude-
 *     scaling-invariant*; they describe self-similarity,
 *     not envelope shape around tc.
 *   - vs. **hjorth-mobility / -complexity / TKEO**:
 *     normalized derivative-energy descriptors; do not
 *     localize *concentration* of mass at a position.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal
 *     / symbolic descriptors on transformed values. They
 *     ignore amplitude magnitude and time-index weighting.
 *   - vs. **temporal-centroid + temporal-spread +
 *     temporal-skewness** (could you reconstruct ts4 from
 *     these?): no. tc, ts, and ts3 fully describe a
 *     *skewed-Gaussian-family* envelope on the row index,
 *     but not its tail/peak weight. ts4 is the missing
 *     4th time-domain moment that distinguishes a
 *     Gaussian-tailed envelope from an impulsive spike or
 *     a flat bimodal split at the same (tc, ts, ts3).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (denominator `sum a[n] = 0`):
 *     surfaces under `droppedZeroSeries`.
 *   - Zero-variance series (all mass at a single row):
 *     `ts_index = 0`, so `ts4 = m4 / 0` is undefined.
 *     Surfaces under `droppedZeroVariance`. Note this
 *     gate is *separate* from `droppedZeroSeries` because
 *     a single-row spike has nonzero amplitude but zero
 *     spread.
 *   - Defensive non-finite computed quantity: surfaces
 *     under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTemporalKurtosisSort =
  | 'ts4-desc'
  | 'ts4-asc'
  | 'dist-uniform-asc'
  | 'dist-uniform-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalKurtosisOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need at least 4 rows so a 4th
   * central moment is meaningfully defined). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'ts4-desc' (default): most peaked / impulsive first.
   *   - 'ts4-asc':            most flat / bimodal first.
   *   - 'rows':               rowsKept desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalKurtosisSort;
  /**
   * Optional inclusive lower bound on `ts4`. Sources with
   * ts4 < minTs4 surface under `droppedBelowMinTs4`. Must
   * be a finite real `>= 1` (the Cauchy-Schwarz lower
   * bound for ts4). Useful for "show me only the peaked
   * cohort" (e.g. `--min-ts4 3` for mesokurtic-or-better).
   * Default null.
   */
  minTs4?: number | null;
  /**
   * Optional inclusive upper bound on `ts4`. Sources with
   * ts4 > maxTs4 surface under `droppedAboveMaxTs4`. Must
   * be a finite real `>= 1` and `>= minTs4` when both are
   * set. Useful for "show me only the flat / bimodal
   * cohort" (e.g. `--max-ts4 1.8` for sub-uniform).
   * Default null.
   */
  maxTs4?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalKurtosisRow {
  source: string;
  rowsKept: number;
  /** sum_{n=0..N-1} a[n] (= sum of total_tokens; descriptor's denominator). */
  totalAmp: number;
  /** Peeters temporal centroid in row-index units (range [0, N-1]). */
  tcIndex: number;
  /** Raw temporal spread in row-index units (range [0, (N-1)/2]). */
  tsIndex: number;
  /** Standardized temporal kurtosis (unitless, >= 1). Headline. */
  ts4: number;
}

export interface SourceRowTokenTemporalKurtosisReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalKurtosisSort;
  minTs4: number | null;
  maxTs4: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroSeries: number;
  droppedZeroVariance: number;
  droppedDegenerate: number;
  droppedBelowMinTs4: number;
  droppedAboveMaxTs4: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalKurtosisRow[];
}

const VALID_SORTS = [
  'ts4-desc',
  'ts4-asc',
  'dist-uniform-asc',
  'dist-uniform-desc',
  'rows',
  'source',
] as const;

/**
 * Reference value for the discrete-uniform envelope's
 * temporal kurtosis. The continuous uniform on [0, 1]
 * has kurtosis exactly 9/5 = 1.8 (Pearson convention,
 * not excess); the discrete uniform on {0, ..., N-1}
 * converges to this in the large-N limit. We pin it as
 * the reference for the `dist-uniform-*` sort modes.
 */
const UNIFORM_TS4 = 9 / 5;

export function buildSourceRowTokenTemporalKurtosis(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalKurtosisOptions = {},
): SourceRowTokenTemporalKurtosisReport {
  const minRows = opts.minRows ?? 8;
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
  const sort = opts.sort ?? 'ts4-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const minTs4 = opts.minTs4 ?? null;
  if (minTs4 !== null) {
    if (!Number.isFinite(minTs4)) {
      throw new Error(`minTs4 must be a finite real (got ${opts.minTs4})`);
    }
    if (minTs4 < 1) {
      throw new Error(
        `minTs4 must be >= 1 (Cauchy-Schwarz lower bound for ts4); got ${opts.minTs4}`,
      );
    }
  }
  const maxTs4 = opts.maxTs4 ?? null;
  if (maxTs4 !== null) {
    if (!Number.isFinite(maxTs4)) {
      throw new Error(`maxTs4 must be a finite real (got ${opts.maxTs4})`);
    }
    if (maxTs4 < 1) {
      throw new Error(
        `maxTs4 must be >= 1 (Cauchy-Schwarz lower bound for ts4); got ${opts.maxTs4}`,
      );
    }
  }
  if (minTs4 !== null && maxTs4 !== null && minTs4 > maxTs4) {
    throw new Error(`minTs4 (${minTs4}) must be <= maxTs4 (${maxTs4})`);
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
  let droppedZeroVariance = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenTemporalKurtosisRow[] = [];

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

    // Second + fourth central moments in one pass.
    let m2 = 0;
    let m4 = 0;
    for (let i = 0; i < n; i++) {
      const d = i - tcIndex;
      const d2 = d * d;
      m2 += d2 * a[i]!;
      m4 += d2 * d2 * a[i]!;
    }
    const variance = m2 / totalAmp;
    const safeVar = variance > 0 ? variance : 0;
    const tsIndex = Math.sqrt(safeVar);

    if (tsIndex <= 0) {
      droppedZeroVariance += 1;
      continue;
    }

    const m4Std = m4 / totalAmp;
    const ts4 = m4Std / (tsIndex * tsIndex * tsIndex * tsIndex);

    if (
      !Number.isFinite(tcIndex) ||
      !Number.isFinite(tsIndex) ||
      !Number.isFinite(ts4)
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
      ts4,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'ts4-desc') {
      primary = b.ts4 - a.ts4;
    } else if (sort === 'ts4-asc') {
      primary = a.ts4 - b.ts4;
    } else if (sort === 'dist-uniform-asc') {
      primary = Math.abs(a.ts4 - UNIFORM_TS4) - Math.abs(b.ts4 - UNIFORM_TS4);
    } else if (sort === 'dist-uniform-desc') {
      primary = Math.abs(b.ts4 - UNIFORM_TS4) - Math.abs(a.ts4 - UNIFORM_TS4);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  // Apply min/max-ts4 filters BEFORE top cap so the sort
  // window matches the operator's stated ts4 band.
  let droppedBelowMinTs4 = 0;
  let droppedAboveMaxTs4 = 0;
  let filteredRows = allRows;
  if (minTs4 !== null || maxTs4 !== null) {
    filteredRows = [];
    for (const row of allRows) {
      if (minTs4 !== null && row.ts4 < minTs4) {
        droppedBelowMinTs4 += 1;
        continue;
      }
      if (maxTs4 !== null && row.ts4 > maxTs4) {
        droppedAboveMaxTs4 += 1;
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
    minTs4,
    maxTs4,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroSeries,
    droppedZeroVariance,
    droppedDegenerate,
    droppedBelowMinTs4,
    droppedAboveMaxTs4,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
