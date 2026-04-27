/**
 * source-row-token-spectral-bandwidth: per-source **spectral
 * bandwidth** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how widely is the
 * per-row token PSD spread around its own first moment
 * (centroid)?** This is the 2nd central moment companion to
 * `source-row-token-spectral-centroid` (1st moment). The
 * centroid reads *where* the PSD mass sits; the bandwidth
 * reads *how spread out* it is around that location.
 *
 * For a one-sided non-DC power spectrum `P[k] = |X[k]|^2`,
 * `k = 1..K = floor(n/2)`, with centroid
 *
 *   c = sum_k k * P[k] / sum_k P[k],
 *
 * the (power-weighted, p=2) spectral bandwidth is
 *
 *   bandwidthBin = sqrt( sum_k (k - c)^2 * P[k] / sum_k P[k] ).
 *
 * Reported quantities:
 *   - `centroidBin`            : first-moment bin (real).
 *   - `bandwidthBin`           : sqrt of 2nd central moment;
 *                                bin-units; in `[0, K-1]` in
 *                                principle (max ~ K/2 in
 *                                practice for a 2-spike PSD at
 *                                the band ends).
 *   - `bandwidthFractionBins`  : `bandwidthBin / bins` —
 *                                scale-free spread in
 *                                "fraction-of-Nyquist" units.
 *   - `bandwidthFractionMax`   : `bandwidthBin / maxPossible`
 *                                where `maxPossible` is the
 *                                bandwidth of a 2-spike PSD
 *                                placed at bins 1 and K (a
 *                                normalised concentration index
 *                                in [0, 1] given a fixed n).
 *
 * Citation: Klapuri, A. (1999), "Sound onset detection by
 * applying psychoacoustic knowledge", Proc. ICASSP-99 vol.6
 * pp.3089-3092 — second central moment of the power spectrum
 * as a timbral spread descriptor. Reaffirmed in Peeters, G.
 * (2004), "A large set of audio features for sound
 * description (similarity and classification) in the CUIDADO
 * project", IRCAM Tech. Rep., §6.1 (Spectral spread).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-centroid** (the lens shipped in 0.6.148):
 *     centroid is the *first* moment (location). Bandwidth is
 *     the *second* central moment (spread around that
 *     location). Two PSDs with identical centroids can have
 *     very different bandwidths: a single-spike PSD vs. a
 *     uniform-over-the-whole-band PSD can both centre on
 *     `K/2`, but the spike has near-zero bandwidth and the
 *     uniform has bandwidth near `K / sqrt(12)`. Mean vs.
 *     spread of a CDF — a textbook orthogonal pair.
 *   - vs. **spectral-rolloff** (0.6.146): roll-off is a
 *     *quantile* of the cumulative PSD. Bandwidth is a
 *     *moment* around the centroid. A PSD with mass equally
 *     above and below the 85% roll-off bin can have any
 *     bandwidth value depending on how far that mass spreads
 *     from the centroid; conversely a wide and a narrow PSD
 *     can share the same 85% quantile bin if their tails are
 *     placed symmetrically. Quantile vs. central moment.
 *   - vs. **spectral-flatness** (0.6.144): SF is the
 *     geometric/arithmetic mean ratio `G/A` of `P[k]` —
 *     a global "how peaked vs uniform" entropy ratio.
 *     Bandwidth is *position-aware*: it is sensitive to where
 *     on the axis the mass sits relative to the centroid, not
 *     just to the magnitude profile. A PSD with two equal
 *     peaks at bins 1 and K and a PSD with two equal peaks
 *     at bins (K/2 - 1) and (K/2 + 1) share the same flatness
 *     but very different bandwidths.
 *   - vs. **hjorth-mobility / hjorth-complexity / TKEO**:
 *     Hjorth-mobility ~= sqrt(integrated f^2-weighted PSD /
 *     total PSD) — a *non-central* second moment (around 0,
 *     not around the centroid). Bandwidth is the *central*
 *     second moment (around the centroid). The two differ by
 *     the centroid squared (parallel-axis theorem). TKEO is a
 *     time-domain energy operator with f^2 bias — also a
 *     non-central moment summary. None of these collapse to
 *     bandwidth in general.
 *   - vs. **autocorrelation (lag-1) / mann-kendall**:
 *     time-domain summaries; integrate one lag or one trend
 *     statistic; lose the PSD entirely.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise
 *     PSD *slope* / scaling; bandwidth summarises PSD
 *     *spread around its mean location*.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness-
 *     coefficient)**: amplitude domain, order-invariant.
 *     Bandwidth is order-sensitive.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic reductions; lose the PSD entirely.
 *   - vs. **event counters (zcr, runs-test, turning-point)**:
 *     scalar event tallies; bandwidth is a continuous spread
 *     measure on bin index.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, or
 *     numerically zero total power, or `K < 2` so spread is
 *     undefined): surfaces under `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralBandwidthSort =
  | 'bandwidth-asc'
  | 'bandwidth-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralBandwidthOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2 for a
   * meaningful 2nd moment). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Optional lower bound on reported `bandwidthFractionBins`.
   * Sources whose value is strictly below this threshold are
   * suppressed and counted under `droppedBelowMinBandwidthFracBins`.
   * Useful to surface only the more spectrally spread sources.
   */
  minBandwidthFracBins?: number | null;
  /**
   * Optional upper bound on reported `bandwidthFractionBins`.
   * Symmetric counterpart. Surfaces in
   * `droppedAboveMaxBandwidthFracBins`. Useful to surface only
   * the more spectrally concentrated sources.
   *
   * If both are set and `minBandwidthFracBins > maxBandwidthFracBins`,
   * the constructor throws — operator error, not a silent
   * empty report.
   */
  maxBandwidthFracBins?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'bandwidth-asc' (default): bandwidthFractionBins
   *                                ascending — most spectrally
   *                                concentrated first.
   *   - 'bandwidth-desc':           bandwidthFractionBins
   *                                descending — most spectrally
   *                                spread first.
   *   - 'rows':                    rowsKept desc.
   *   - 'source':                  source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralBandwidthSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralBandwidthRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** Power-weighted mean bin index in [1, bins]. Real-valued. */
  centroidBin: number;
  /** sqrt of 2nd central moment around centroid; bin-units. */
  bandwidthBin: number;
  /** bandwidthBin / bins, scale-free spread. */
  bandwidthFractionBins: number;
  /**
   * bandwidthBin / maxPossibleBandwidth where the max is the
   * bandwidth of a 2-spike PSD at bins 1 and K (the
   * widest-possible discrete PSD on the available band).
   * In [0, 1].
   */
  bandwidthFractionMax: number;
}

export interface SourceRowTokenSpectralBandwidthReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  minBandwidthFracBins: number | null;
  maxBandwidthFracBins: number | null;
  sort: SourceRowTokenSpectralBandwidthSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowMinBandwidthFracBins: number;
  droppedAboveMaxBandwidthFracBins: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralBandwidthRow[];
}

const VALID_SORTS = [
  'bandwidth-asc',
  'bandwidth-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralBandwidth(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralBandwidthOptions = {},
): SourceRowTokenSpectralBandwidthReport {
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
  const minBandwidthFracBins = opts.minBandwidthFracBins ?? null;
  if (minBandwidthFracBins !== null) {
    if (!Number.isFinite(minBandwidthFracBins)) {
      throw new Error(
        `minBandwidthFracBins must be a finite number (got ${opts.minBandwidthFracBins})`,
      );
    }
  }
  const maxBandwidthFracBins = opts.maxBandwidthFracBins ?? null;
  if (maxBandwidthFracBins !== null) {
    if (!Number.isFinite(maxBandwidthFracBins)) {
      throw new Error(
        `maxBandwidthFracBins must be a finite number (got ${opts.maxBandwidthFracBins})`,
      );
    }
  }
  if (
    minBandwidthFracBins !== null &&
    maxBandwidthFracBins !== null &&
    minBandwidthFracBins > maxBandwidthFracBins
  ) {
    throw new Error(
      `minBandwidthFracBins (${minBandwidthFracBins}) must be <= maxBandwidthFracBins (${maxBandwidthFracBins})`,
    );
  }
  const sort = opts.sort ?? 'bandwidth-asc';
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

  const allRows: SourceRowTokenSpectralBandwidthRow[] = [];

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
    if (bins < 2) {
      // Need at least two bins to have a non-trivial spread.
      droppedConstantSeries += 1;
      continue;
    }
    const power = new Array<number>(bins);
    let sumPower = 0;
    let weightedSum = 0;
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
      power[k - 1] = p;
      sumPower += p;
      weightedSum += k * p;
    }

    if (sumPower <= 0 || !Number.isFinite(sumPower)) {
      droppedConstantSeries += 1;
      continue;
    }

    const centroidBin = weightedSum / sumPower;
    let centralVar = 0;
    for (let k = 1; k <= bins; k++) {
      const d = k - centroidBin;
      centralVar += d * d * power[k - 1]!;
    }
    centralVar = centralVar / sumPower;
    const bandwidthBin = Math.sqrt(Math.max(0, centralVar));
    const bandwidthFractionBins = bandwidthBin / bins;
    // Maximum-possible bandwidth for a discrete PSD on bins
    // {1..K}: place equal mass at the two extreme bins (1 and K).
    // centroid = (1 + K) / 2; central variance =
    // ((K - 1) / 2)^2; sqrt = (K - 1) / 2.
    const maxPossible = (bins - 1) / 2;
    const bandwidthFractionMax =
      maxPossible > 0 ? bandwidthBin / maxPossible : 0;

    if (
      !Number.isFinite(centroidBin) ||
      !Number.isFinite(bandwidthBin) ||
      !Number.isFinite(bandwidthFractionBins) ||
      !Number.isFinite(bandwidthFractionMax) ||
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
      bandwidthBin,
      bandwidthFractionBins,
      bandwidthFractionMax,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'bandwidth-asc') {
      primary = a.bandwidthFractionBins - b.bandwidthFractionBins;
    } else if (sort === 'bandwidth-desc') {
      primary = b.bandwidthFractionBins - a.bandwidthFractionBins;
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinBandwidthFracBins = 0;
  let droppedAboveMaxBandwidthFracBins = 0;
  let postRows = allRows;
  if (minBandwidthFracBins !== null || maxBandwidthFracBins !== null) {
    const kept: SourceRowTokenSpectralBandwidthRow[] = [];
    for (const row of postRows) {
      if (
        minBandwidthFracBins !== null &&
        row.bandwidthFractionBins < minBandwidthFracBins
      ) {
        droppedBelowMinBandwidthFracBins += 1;
        continue;
      }
      if (
        maxBandwidthFracBins !== null &&
        row.bandwidthFractionBins > maxBandwidthFracBins
      ) {
        droppedAboveMaxBandwidthFracBins += 1;
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
    minBandwidthFracBins,
    maxBandwidthFracBins,
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
    droppedBelowMinBandwidthFracBins,
    droppedAboveMaxBandwidthFracBins,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
