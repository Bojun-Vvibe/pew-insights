/**
 * source-row-token-temporal-skewness: per-source **Peeters
 * 2004 temporal skewness** (3rd standardized time-domain
 * moment) of the per-row `total_tokens` series.
 *
 * Headline question: **for each source, is the amplitude
 * mass distributed *symmetrically* around its temporal
 * centroid, or does it *lean* (left or right) along its
 * row history?** This is a *time-domain* third-moment
 * descriptor: the standardized amplitude-weighted third
 * central moment of the row index around the temporal
 * centroid. It is the time-domain analog of
 * spectral-skewness (which is the standardized
 * power-weighted third central moment of the *frequency
 * bin index* around the spectral centroid).
 *
 * For a non-negative-amplitude time series `a[n] = |x[n]|`,
 * `n = 0..N-1`, with `N >= minRows` and at least one
 * non-zero `a[n]`, define
 *
 *   tc_index = sum_{n} n * a[n] / sum_{n} a[n]              (Peeters 2004 §6.1; 1st moment)
 *   ts_index = sqrt( sum_{n} (n - tc_index)^2 * a[n]
 *                    / sum_{n} a[n] )                       (Peeters 2004 §6.1; 2nd central moment)
 *   m3       = sum_{n} (n - tc_index)^3 * a[n]
 *              / sum_{n} a[n]                               (Peeters 2004 §6.1; 3rd central moment)
 *   ts3      = m3 / ts_index^3                              (standardized; unitless)
 *
 * `ts3` is the **standardized temporal skewness**:
 *   - `ts3 > 0`: amplitude leans *back* of `tc_index`. The
 *     bulk of the mass sits at indices below `tc_index`
 *     (early in the row history), with a longer thin
 *     *trailing* tail toward the end. Read: "early peak,
 *     long quiet tail" — the source had a burst of
 *     activity near the start of its history and has been
 *     trailing off since.
 *   - `ts3 < 0`: amplitude leans *forward* of `tc_index`.
 *     Mass sits at indices above `tc_index` (late in the
 *     row history), with a longer thin *leading* tail.
 *     Read: "long quiet build-up, late peak" — the source
 *     was quiet for much of its history and recently
 *     ramped up.
 *   - `ts3 ~ 0`: amplitude is **symmetrically distributed**
 *     around `tc_index`. A perfectly symmetric envelope
 *     (uniform, or a centered triangle, or a centered
 *     bimodal split) lands exactly at zero.
 *
 * **Sign convention** matches Pearson's standardized third
 * moment / Peeters' temporal skewness exactly. There is no
 * normalization to `[-1, 1]`; `ts3` is unbounded in
 * principle, though for non-negative `a[n]` on a bounded
 * row index it is bounded by a function of `N` (extreme
 * values are achieved only by near-impulse mass at row 0
 * or row N-1).
 *
 * Crucially, this is **time-index-based**, not
 * wall-clock-based: the n-axis is the row ordinal of the
 * source's own appearances in the queue, not calendar
 * time. Two sources can have very different overall
 * activity rates and still be ranked on "is your usage
 * symmetric, leaning early, or leaning late within your
 * own history?".
 *
 * Reported quantities:
 *   - `rowsKept`   : N (>= minRows by gate).
 *   - `totalAmp`   : sum_{n} a[n] = sum of total_tokens
 *                    after gates (descriptor's denominator).
 *   - `tcIndex`    : Peeters temporal centroid in row-index
 *                    units (range [0, N-1]). Co-reported so
 *                    operators can locate the lean.
 *   - `tsIndex`    : raw temporal spread in row-index units
 *                    (range [0, (N-1)/2]). Co-reported so
 *                    operators can read the lean *relative*
 *                    to the spread.
 *   - `ts3`        : standardized temporal skewness
 *                    (unitless). Headline.
 *
 * Citation: Peeters, G. (2004), "A large set of audio
 * features for sound description (similarity and
 * classification) in the CUIDADO project", IRCAM
 * Tech. Rep., §6.1 (Temporal Centroid + Temporal Spread +
 * Temporal Skewness as the 1st/2nd/3rd amplitude-weighted
 * standardized moments of the time index of an energy
 * envelope).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **temporal-centroid** (1st time-domain moment):
 *     centroid asks *where* the mass sits; skewness asks
 *     *which side* of that position the bulk leans.
 *     Two sources with identical tc=0.5 can have ts3 of
 *     opposite sign: one with a few tall early bursts
 *     plus a long thin tail (positive ts3) versus one
 *     with a long quiet build-up plus a tall late burst
 *     (negative ts3).
 *   - vs. **temporal-spread** (2nd time-domain moment):
 *     spread asks *how wide* the mass is around tc;
 *     skewness asks *which side is heavier*. Two sources
 *     can share identical tc and identical ts and still
 *     differ in ts3 — one symmetric, one one-sided —
 *     because the 2nd moment is the std of (n - tc)
 *     while the 3rd moment is the *signed cube* of the
 *     same deviations. Spread is sign-blind by
 *     construction; skewness is the sign-aware completion.
 *   - vs. **spectral-skewness** (3rd freq-domain moment):
 *     spectral-skewness lives on the PSD's *frequency bin
 *     index* — it asks whether the energy is biased toward
 *     low or high frequencies relative to the spectral
 *     centroid. Temporal-skewness lives on the *time-row
 *     index* — it asks whether the amplitude is biased
 *     toward early or late rows relative to the temporal
 *     centroid. Two sources can share spectral-skewness
 *     (same frequency-content asymmetry) and have wildly
 *     different temporal-skewness (one front-loaded in
 *     time, one back-loaded), and vice versa.
 *   - vs. **amplitude-shape skewness** (the existing
 *     `source-row-token-skewness` lens): that lens is
 *     the standardized 3rd moment of the *amplitude
 *     values themselves* (a.k.a. Pearson's skewness of
 *     `{a[n]}` as a multiset). It is *order-invariant*:
 *     permuting the rows in time gives the same value.
 *     Temporal-skewness is *order-sensitive*: shuffling
 *     the rows changes ts3, because the row index `n` is
 *     part of the formula. Two sources with identical
 *     amplitude histograms but mirrored time orderings
 *     will have identical amplitude-skewness and *opposite-
 *     sign* ts3.
 *   - vs. **all spectral-* lenses (entropy, flatness,
 *     rolloff, decrease, irregularity, kurtosis,
 *     bandwidth)**: frequency-domain. None describe
 *     time-domain asymmetry of the amplitude envelope.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     log-log slope of fluctuation across decades. They
 *     are *position-invariant in time* — translating the
 *     series in row index does not change them.
 *     Temporal-skewness is *not* time-shift invariant:
 *     prepending quiet rows shifts both tc and ts3.
 *   - vs. **hjorth-mobility / -complexity / TKEO**:
 *     normalized derivative-energy descriptors; do not
 *     localize mass asymmetry in time.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal
 *     / symbolic descriptors on transformed values. They
 *     ignore amplitude magnitude and time-index weighting.
 *   - vs. **temporal-centroid + temporal-spread** (could
 *     you reconstruct ts3 from these?): no. tc and ts
 *     fully describe a *Gaussian* envelope on the row
 *     index, but not a skewed one. ts3 is the missing
 *     3rd time-domain moment that distinguishes a
 *     symmetric envelope from a one-sided lean at the
 *     same (tc, ts).
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - All-zero series (denominator `sum a[n] = 0`):
 *     surfaces under `droppedZeroSeries`.
 *   - Zero-variance series (all mass at a single row):
 *     `ts_index = 0`, so `ts3 = m3 / 0` is undefined.
 *     Surfaces under `droppedZeroVariance`. Note this
 *     gate is *separate* from `droppedZeroSeries` because
 *     a single-row spike has nonzero amplitude but zero
 *     spread, and we want operators to be able to
 *     distinguish "no mass at all" from "mass at exactly
 *     one row".
 *   - Defensive non-finite computed quantity: surfaces
 *     under `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenTemporalSkewnessSort =
  | 'ts3-desc'
  | 'ts3-asc'
  | 'abs-ts3-desc'
  | 'abs-ts3-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenTemporalSkewnessOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 3` (need at least 3 rows so a 3rd
   * central moment is meaningfully defined; 2 rows can never
   * be skewed). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'ts3-desc' (default): most positive (most front-loaded
   *      with trailing tail) first.
   *   - 'ts3-asc':            most negative (most back-loaded
   *      with leading tail) first.
   *   - 'abs-ts3-desc':       most asymmetric (any direction) first.
   *   - 'abs-ts3-asc':        most symmetric first.
   *   - 'rows':               rowsKept desc.
   *   - 'source':             source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenTemporalSkewnessSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenTemporalSkewnessRow {
  source: string;
  rowsKept: number;
  /** sum_{n=0..N-1} a[n] (= sum of total_tokens; descriptor's denominator). */
  totalAmp: number;
  /** Peeters temporal centroid in row-index units (range [0, N-1]). */
  tcIndex: number;
  /** Raw temporal spread in row-index units (range [0, (N-1)/2]). */
  tsIndex: number;
  /** Standardized temporal skewness (unitless). Headline. */
  ts3: number;
}

export interface SourceRowTokenTemporalSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenTemporalSkewnessSort;
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
  droppedBelowTopCap: number;
  sources: SourceRowTokenTemporalSkewnessRow[];
}

const VALID_SORTS = [
  'ts3-desc',
  'ts3-asc',
  'abs-ts3-desc',
  'abs-ts3-asc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenTemporalSkewness(
  queue: QueueLine[],
  opts: SourceRowTokenTemporalSkewnessOptions = {},
): SourceRowTokenTemporalSkewnessReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 3) {
    throw new Error(
      `minRows must be an integer >= 3 (got ${opts.minRows})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'ts3-desc';
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
  let droppedZeroSeries = 0;
  let droppedZeroVariance = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenTemporalSkewnessRow[] = [];

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

    // Second + third central moments in one pass.
    let m2 = 0;
    let m3 = 0;
    for (let i = 0; i < n; i++) {
      const d = i - tcIndex;
      const d2 = d * d;
      m2 += d2 * a[i]!;
      m3 += d2 * d * a[i]!;
    }
    const variance = m2 / totalAmp;
    const safeVar = variance > 0 ? variance : 0;
    const tsIndex = Math.sqrt(safeVar);

    if (tsIndex <= 0) {
      droppedZeroVariance += 1;
      continue;
    }

    const m3Std = m3 / totalAmp;
    const ts3 = m3Std / (tsIndex * tsIndex * tsIndex);

    if (
      !Number.isFinite(tcIndex) ||
      !Number.isFinite(tsIndex) ||
      !Number.isFinite(ts3)
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
      ts3,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'ts3-desc') {
      primary = b.ts3 - a.ts3;
    } else if (sort === 'ts3-asc') {
      primary = a.ts3 - b.ts3;
    } else if (sort === 'abs-ts3-desc') {
      primary = Math.abs(b.ts3) - Math.abs(a.ts3);
    } else if (sort === 'abs-ts3-asc') {
      primary = Math.abs(a.ts3) - Math.abs(b.ts3);
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
    sort,
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
    droppedBelowTopCap,
    sources: finalSources,
  };
}
