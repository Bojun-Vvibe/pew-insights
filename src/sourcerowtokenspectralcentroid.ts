/**
 * source-row-token-spectral-centroid: per-source **spectral
 * centroid** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, where along the
 * frequency axis does the centre of mass of the power spectrum
 * sit?** This is the brightness analogue from audio timbre:
 * higher centroid = energy concentrated at higher frequencies
 * (per-row jitter), lower centroid = energy concentrated at
 * lower frequencies (slow envelope).
 *
 * For a one-sided non-DC power spectrum `P[k] = |X[k]|^2`,
 * `k = 1..floor(n/2)`, the spectral centroid is the
 * power-weighted mean bin index:
 *
 *   centroidBin = sum_{k=1..K} k * P[k] / sum_{k=1..K} P[k]
 *
 * Reported quantities:
 *   - `centroidBin`         : power-weighted mean bin (real,
 *                             not necessarily an integer).
 *   - `centroidFractionBins`: `centroidBin / floor(n/2)` in
 *                             (0, 1] — scale-free brightness in
 *                             "fraction-of-Nyquist" units.
 *   - `dominantBin` / `dominantBinShare` for context.
 *
 * Citation: Klapuri, A. (1999), "Sound onset detection by
 * applying psychoacoustic knowledge", Proc. ICASSP-99 vol.6
 * pp.3089-3092 — first moment of the power spectrum as a
 * timbral brightness descriptor. Reaffirmed in McKinney, M. F.
 * & Breebaart, J. (2003), "Features for Audio and Music
 * Classification", Proc. ISMIR 2003, pp. 151-158.
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending.
 *      (Sort matters: this is a frequency-domain lens.)
 *   4. Skip if `n < minRows` (default 8).
 *   5. Mean-center the series (subtract sample mean) — drops the
 *      DC component.
 *   6. Compute the real DFT via direct O(n^2) summation:
 *         X[k] = sum_t x_t * exp(-2*pi*i * k * t / n)
 *      for k = 1..floor(n/2). Power: `P[k] = |X[k]|^2`.
 *   7. If total power is non-positive (constant series after
 *      centering), surface under `droppedConstantSeries`.
 *   8. centroidBin = sum(k * P[k]) / sum(P[k]).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-rolloff** (the lens shipped in 0.6.146):
 *     roll-off is a *quantile* (the bin at which the cumulative
 *     PSD first crosses some fraction). Centroid is the *first
 *     moment* (mean) of the same PSD. Two PSDs with identical
 *     85% roll-off bins can have very different centroids
 *     (e.g. one with a sharp peak at the roll-off bin, one
 *     with broad mass spread evenly up to it). Quantile vs.
 *     mean of a CDF — a textbook orthogonal pair.
 *   - vs. **spectral-flatness**: SF answers "how peaked vs
 *     uniform is the PSD" (an entropy-like ratio G/A).
 *     Centroid answers "where on the axis is the mean of the
 *     PSD". A flat PSD and a peaked PSD can share the same
 *     centroid (both centred on the same bin); a uniformly
 *     low PSD and a uniformly high PSD have identical SF but
 *     different centroids.
 *   - vs. **TKEO / hjorth-mobility / hjorth-complexity**: TKEO
 *     is a time-domain energy operator with a frequency-squared
 *     bias. Hjorth-mobility ~= sqrt(integrated f^2-weighted
 *     PSD / total PSD) — that is, the *square root of the
 *     second moment*. Centroid is the *first moment*. First and
 *     second moments are independent under most distributions
 *     (a low-mean / high-variance PSD vs. a high-mean / low-
 *     variance PSD share neither).
 *   - vs. **autocorrelation (lag-1)** / **mann-kendall**:
 *     time-domain summaries; integrate one lag or one trend
 *     statistic; lose the PSD entirely.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise
 *     PSD *slope* / scaling; centroid summarises PSD
 *     *location*.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness-
 *     coefficient)**: amplitude domain, order-invariant.
 *     Centroid is order-sensitive.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic reductions; lose the PSD entirely.
 *   - vs. **event counters (zcr, runs-test, turning-point)**:
 *     scalar event tallies; centroid is a continuous mean
 *     bin index.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, or
 *     numerically zero total power): surfaces under
 *     `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralCentroidSort =
  | 'centroid-asc'
  | 'centroid-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralCentroidOptions {
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
   *   - 'centroid-asc' (default): centroidFractionBins ascending —
   *                               most low-frequency-loaded first.
   *   - 'centroid-desc':          centroidFractionBins descending —
   *                               most high-frequency-loaded first.
   *   - 'rows':                   rowsKept desc.
   *   - 'source':                 source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralCentroidSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralCentroidRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** Power-weighted mean bin index in [1, bins]. Real-valued. */
  centroidBin: number;
  /** centroidBin / bins, in (0, 1]. Scale-free brightness. */
  centroidFractionBins: number;
  /** Bin holding the largest single-bin power (for context). */
  dominantBin: number;
  /** Fraction of total non-DC power held by the dominantBin. */
  dominantBinShare: number;
}

export interface SourceRowTokenSpectralCentroidReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenSpectralCentroidSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralCentroidRow[];
}

const VALID_SORTS = [
  'centroid-asc',
  'centroid-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralCentroid(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralCentroidOptions = {},
): SourceRowTokenSpectralCentroidReport {
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
  const sort = opts.sort ?? 'centroid-asc';
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
  let droppedConstantSeries = 0;
  let droppedDegenerate = 0;

  const allRows: SourceRowTokenSpectralCentroidRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    let sum = 0;
    for (let i = 0; i < n; i++) sum += v[i]!;
    const mean = sum / n;
    const xc = new Array<number>(n);
    let allZero = true;
    for (let i = 0; i < n; i++) {
      const d = v[i]! - mean;
      xc[i] = d;
      if (d !== 0) allZero = false;
    }
    if (allZero) {
      droppedConstantSeries += 1;
      continue;
    }

    const bins = Math.floor(n / 2);
    let sumPower = 0;
    let weightedSum = 0;
    let dominantBin = 1;
    let dominantPower = -1;
    for (let k = 1; k <= bins; k++) {
      const w = (-2 * Math.PI * k) / n;
      let re = 0;
      let im = 0;
      for (let t = 0; t < n; t++) {
        const angle = w * t;
        const xt = xc[t]!;
        re += xt * Math.cos(angle);
        im += xt * Math.sin(angle);
      }
      const p = re * re + im * im;
      sumPower += p;
      weightedSum += k * p;
      if (p > dominantPower) {
        dominantPower = p;
        dominantBin = k;
      }
    }

    if (sumPower <= 0 || !Number.isFinite(sumPower)) {
      droppedConstantSeries += 1;
      continue;
    }

    const centroidBin = weightedSum / sumPower;
    const centroidFractionBins = centroidBin / bins;
    const dominantBinShare = dominantPower / sumPower;

    if (
      !Number.isFinite(centroidBin) ||
      !Number.isFinite(centroidFractionBins) ||
      !Number.isFinite(dominantBinShare) ||
      !Number.isFinite(sumPower)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      bins,
      totalPower: sumPower,
      centroidBin,
      centroidFractionBins,
      dominantBin,
      dominantBinShare,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'centroid-asc') {
      primary = a.centroidFractionBins - b.centroidFractionBins;
    } else if (sort === 'centroid-desc') {
      primary = b.centroidFractionBins - a.centroidFractionBins;
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
    droppedConstantSeries,
    droppedDegenerate,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
