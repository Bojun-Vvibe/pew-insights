/**
 * source-row-token-temporal-flatness: per-source **temporal
 * flatness** (Wiener-entropy analog computed directly on the
 * per-row `total_tokens` amplitude envelope rather than on its
 * power spectrum).
 *
 * Headline question: **for each source, how *flat vs. spiky*
 * is the per-row token amplitude envelope itself, in the
 * row-index domain?**
 *
 * For a non-negative series `a[n] = total_tokens[n]`,
 * `n = 0..N-1`, with `N >= minRows` and at least one strictly
 * positive `a[n]`, define
 *
 *   G(a) = exp( (1/N) * sum_{n} log(max(a[n], eps)) )   (geometric mean)
 *   A(a) = (1/N) * sum_{n} a[n]                         (arithmetic mean)
 *   tf   = G(a) / A(a)                                  (in (0, 1])
 *
 * `tf` is the **temporal flatness** of the amplitude envelope.
 * By the AM-GM inequality, `0 < tf <= 1`. Theoretical anchors:
 *
 *   - `tf -> 1`: the envelope is **constant across all rows**
 *     (a[n] = c for all n) — perfectly flat amplitude history.
 *     A perfectly flat constant series has `tf = 1` exactly.
 *   - `tf small (-> 0)`: the envelope is **highly concentrated
 *     in a few rows** — most rows carry near-zero token mass
 *     and a small handful carry all of it. The lower bound 0
 *     is approached as more and more rows are floored to `eps`
 *     while a single row carries all the mass.
 *
 * This is the *time-domain dual* of `source-row-token-spectral
 * -flatness`. Spectral flatness applies the AM-GM ratio to the
 * one-sided non-DC PSD bins; temporal flatness applies the same
 * ratio to the raw row-domain amplitudes. The two are
 * genuinely different:
 *   - A perfectly tonal sine wave has very low spectral flatness
 *     (one PSD bin dominates) but high temporal flatness (the
 *     |sine| amplitude envelope is fairly uniform).
 *   - A constant DC level has high temporal flatness (envelope
 *     is flat) and undefined spectral flatness after mean-
 *     centering (zero variance).
 *   - An impulsive single-row spike has very low temporal
 *     flatness (one row dominates) and high spectral flatness
 *     (spike has flat broadband spectrum after centering).
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      (note: the AM-GM ratio is *order-invariant* on the
 *      multiset of amplitudes; sorting is for determinism /
 *      consistency with sibling lenses, not for numerics).
 *   4. Skip if `n < minRows` (default 8).
 *   5. Skip if all `a[n] == 0` (`droppedZeroSeries`).
 *   6. Floor sub-eps amplitudes at `EPS = 1e-300` for the log
 *      sum; arithmetic-mean uses raw `a[n]`. This matches the
 *      Welch / log-MS convention used by spectral-flatness.
 *   7. tf = exp(sumLog / N) / arithmeticMean.
 *
 * Reported quantities:
 *   - `rowsKept`   : N (>= minRows by gate).
 *   - `totalAmp`   : sum_{n} a[n] (descriptor's denominator * N).
 *   - `arithmeticMean` : A(a). Co-reported so operators can
 *     compare "average row size" across sources.
 *   - `geometricMean`  : G(a). Co-reported so operators can
 *     read tf as the explicit ratio.
 *   - `tf`         : temporal flatness in (0, 1]. Headline.
 *
 * Citation: Johnston, J. D. (1988), "Transform Coding of Audio
 * Signals Using Perceptual Noise Criteria", IEEE J. Selected
 * Areas in Comms 6(2):314-323 (defines the AM-GM flatness
 * ratio in the spectral domain). Peeters, G. (2004), CUIDADO
 * IRCAM Tech. Rep., §6.1 (treats the amplitude envelope a[n]
 * as a first-class time-domain object — same role here for
 * the temporal-flatness ratio).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-flatness**: applies the SAME AM-GM ratio
 *     but to the one-sided non-DC PSD, not the row-domain
 *     amplitudes. Constant series, sine waves, and impulses
 *     each occupy a distinct (tf, sf) quadrant, so the two
 *     lenses are independent.
 *   - vs. **temporal-centroid / -spread / -skewness /
 *     -kurtosis (Peeters 2004 §6.1 quartet)**: those are
 *     amplitude-weighted moments of the *row index*. They
 *     describe *where* / *how wide* / *which lean* / *how
 *     peaked* the mass sits along n. Temporal-flatness is
 *     *position-invariant*: permuting the rows does not change
 *     G(a) or A(a). It picks up only the multiset of
 *     amplitudes, not their position.
 *   - vs. **amplitude-shape gini / mad / iqr-ratio /
 *     coefficient-of-variation / kurtosis / skewness /
 *     burstiness-coefficient / crest-factor**: those are also
 *     order-invariant amplitude-shape descriptors. Temporal-
 *     flatness is the *Wiener-entropy* member of that family
 *     (G/A ratio), distinct from variance ratios (CV),
 *     percentile ratios (IQR), absolute-deviation ratios (MAD,
 *     gini), peak-to-mean ratios (crest), and standardized
 *     central moments (kurtosis, skewness). The G/A ratio
 *     uniquely captures multiplicative concentration: it is
 *     particularly sensitive to rows being *floored to zero*
 *     (each zero row drives G(a) toward zero exponentially).
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: those count
 *     motif-frequency or pattern-novelty on transformed
 *     symbol sequences. Temporal-flatness is computed directly
 *     on raw amplitude magnitudes; it is sensitive to scale
 *     (unlike rank-based symbolic entropies).
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades (self-
 *     similarity). They are amplitude-rescaling-invariant.
 *     Temporal-flatness is *scale-invariant in a different
 *     way*: rescaling all amplitudes by `c > 0` leaves tf
 *     unchanged (G and A both scale by c).
 *   - vs. **hjorth-mobility / -complexity / TKEO**: those are
 *     normalized derivative-energy descriptors that pick up
 *     local roughness. Temporal-flatness is global.
 *   - vs. **autocorrelation-lag1 / runs-test / turning-point /
 *     mann-kendall / zero-crossing-rate**: those are event-
 *     count or sign-pattern descriptors. Temporal-flatness
 *     ignores order entirely.
 *
 * Key invariants:
 *   - `tf in (0, 1]` always (AM-GM).
 *   - `tf == 1` iff all `a[n]` are equal AND positive.
 *   - **Amplitude-scale invariant**: a[n] -> c * a[n] for any
 *     c > 0 leaves tf unchanged.
 *   - **Order-invariant** (permutation of n): tf depends only
 *     on the multiset {a[n]}, not on the row order.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (`sum a[n] == 0`): surfaces under
 *     `droppedZeroSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTemporalFlatnessSort =
  | 'tf-desc'
  | 'tf-asc'
  | 'dist-flat-asc'
  | 'dist-flat-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalFlatnessOptions {
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
   *   - 'tf-desc' (default): flattest envelope first.
   *   - 'tf-asc':            spikiest / most concentrated first.
   *   - 'rows':              rowsKept desc.
   *   - 'source':            source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalFlatnessSort;
  /**
   * Optional inclusive lower bound on `tf`. Sources with
   * tf < minTf surface under `droppedBelowMinTf`. Must be
   * a finite real in (0, 1] (the AM-GM range for tf).
   * Useful for "show me only the flat-envelope cohort"
   * (e.g. `--min-tf 0.5` for tf-at-or-above 0.5).
   * Default null.
   */
  minTf?: number | null;
  /**
   * Optional inclusive upper bound on `tf`. Sources with
   * tf > maxTf surface under `droppedAboveMaxTf`. Must be
   * a finite real in (0, 1] and `>= minTf` when both are
   * set. Useful for "show me only the spiky cohort"
   * (e.g. `--max-tf 0.4`).
   * Default null.
   */
  maxTf?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalFlatnessRow {
  source: string;
  rowsKept: number;
  /** sum_{n=0..N-1} a[n] (= sum of total_tokens). */
  totalAmp: number;
  /** Arithmetic mean of a[n]. */
  arithmeticMean: number;
  /** Geometric mean of a[n] (with sub-EPS rows floored at EPS for log). */
  geometricMean: number;
  /** Temporal flatness G(a) / A(a) in (0, 1]. Headline. */
  tf: number;
}

export interface SourceRowTokenTemporalFlatnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalFlatnessSort;
  minTf: number | null;
  maxTf: number | null;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedZeroSeries: number;
  droppedDegenerate: number;
  droppedBelowMinTf: number;
  droppedAboveMaxTf: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalFlatnessRow[];
}

const VALID_SORTS = [
  'tf-desc',
  'tf-asc',
  'dist-flat-asc',
  'dist-flat-desc',
  'rows',
  'source',
] as const;

/**
 * Reference value for the "perfectly flat" envelope's
 * temporal flatness. By the AM-GM inequality, tf <= 1
 * with equality iff all a[n] are equal positive. We pin
 * 1 as the reference for the `dist-flat-*` sort modes.
 */
const FLAT_TF = 1;

/** Floor for sub-EPS amplitudes when taking logs (Welch / log-MS convention). */
const EPS = 1e-300;

export function buildSourceRowTokenTemporalFlatness(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalFlatnessOptions = {},
): SourceRowTokenTemporalFlatnessReport {
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
  const sort = opts.sort ?? 'tf-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
    );
  }

  const minTf = opts.minTf ?? null;
  if (minTf !== null) {
    if (!Number.isFinite(minTf)) {
      throw new Error(`minTf must be a finite real (got ${opts.minTf})`);
    }
    if (minTf <= 0 || minTf > 1) {
      throw new Error(
        `minTf must be in (0, 1] (the AM-GM range for tf); got ${opts.minTf}`,
      );
    }
  }
  const maxTf = opts.maxTf ?? null;
  if (maxTf !== null) {
    if (!Number.isFinite(maxTf)) {
      throw new Error(`maxTf must be a finite real (got ${opts.maxTf})`);
    }
    if (maxTf <= 0 || maxTf > 1) {
      throw new Error(
        `maxTf must be in (0, 1] (the AM-GM range for tf); got ${opts.maxTf}`,
      );
    }
  }
  if (minTf !== null && maxTf !== null && minTf > maxTf) {
    throw new Error(`minTf (${minTf}) must be <= maxTf (${maxTf})`);
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

  const allRows: SourceRowTokenTemporalFlatnessRow[] = [];

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
    let sumLog = 0;
    for (let i = 0; i < n; i++) {
      const v = a[i]!;
      totalAmp += v;
      sumLog += Math.log(v > EPS ? v : EPS);
    }

    if (totalAmp <= 0 || !Number.isFinite(totalAmp)) {
      droppedZeroSeries += 1;
      continue;
    }

    const arithmeticMean = totalAmp / n;
    const geometricMean = Math.exp(sumLog / n);
    const tf = geometricMean / arithmeticMean;

    if (
      !Number.isFinite(arithmeticMean) ||
      !Number.isFinite(geometricMean) ||
      !Number.isFinite(tf)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      totalAmp,
      arithmeticMean,
      geometricMean,
      tf,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'tf-desc') {
      primary = b.tf - a.tf;
    } else if (sort === 'tf-asc') {
      primary = a.tf - b.tf;
    } else if (sort === 'dist-flat-asc') {
      primary = Math.abs(a.tf - FLAT_TF) - Math.abs(b.tf - FLAT_TF);
    } else if (sort === 'dist-flat-desc') {
      primary = Math.abs(b.tf - FLAT_TF) - Math.abs(a.tf - FLAT_TF);
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

  // Apply min/max-tf filters BEFORE top cap so the sort
  // window matches the operator's stated tf band.
  let droppedBelowMinTf = 0;
  let droppedAboveMaxTf = 0;
  let filteredRows = allRows;
  if (minTf !== null || maxTf !== null) {
    filteredRows = [];
    for (const row of allRows) {
      if (minTf !== null && row.tf < minTf) {
        droppedBelowMinTf += 1;
        continue;
      }
      if (maxTf !== null && row.tf > maxTf) {
        droppedAboveMaxTf += 1;
        continue;
      }
      filteredRows.push(row);
    }
  }
  finalSources = filteredRows;
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
    minTf,
    maxTf,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedInvalidTokens,
    droppedNegativeTokens,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedZeroSeries,
    droppedDegenerate,
    droppedBelowMinTf,
    droppedAboveMaxTf,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
