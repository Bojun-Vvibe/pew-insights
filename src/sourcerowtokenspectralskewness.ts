/**
 * source-row-token-spectral-skewness: per-source **spectral
 * skewness** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, is the per-row token PSD
 * tail-heavy on the high-frequency side (positive skew) or on
 * the low-frequency side (negative skew) relative to its own
 * centroid?** This is the 3rd standardized central moment
 * companion to `source-row-token-spectral-centroid` (1st
 * moment / location) and `source-row-token-spectral-bandwidth`
 * (sqrt of 2nd central moment / spread). Centroid says *where*
 * the PSD mass sits; bandwidth says *how spread* it is around
 * that location; skewness says *which side of the centroid the
 * tail leans towards*.
 *
 * For a one-sided non-DC power spectrum `P[k] = |X[k]|^2`,
 * `k = 1..K = floor(n/2)`, with centroid
 *
 *   c   = sum_k k * P[k] / sum_k P[k],
 *
 * second central moment (variance)
 *
 *   m2  = sum_k (k - c)^2 * P[k] / sum_k P[k],
 *
 * and third central moment
 *
 *   m3  = sum_k (k - c)^3 * P[k] / sum_k P[k],
 *
 * the (Fisher / Pearson) **standardized** spectral skewness is
 *
 *   skewness = m3 / m2^(3/2).
 *
 * Reported quantities:
 *   - `centroidBin`     : first-moment bin (real); recomputed
 *                         inline so the three-moment triple is
 *                         internally consistent.
 *   - `bandwidthBin`    : sqrt(m2); bin-units. Reported because
 *                         `skewness` is undefined when this is 0
 *                         and the operator wants to see why a
 *                         source dropped under
 *                         `droppedConstantSeries`.
 *   - `m3`              : raw third central moment; bin^3 units.
 *                         Useful as a sanity check on sign.
 *   - `skewness`        : `m3 / m2^(3/2)`. Sign tells which side
 *                         of the centroid the PSD tail leans:
 *                         **positive** => tail on the
 *                         high-frequency side of the centroid
 *                         (PSD mass piles up at low frequencies
 *                         with a long high-frequency tail);
 *                         **negative** => tail on the
 *                         low-frequency side of the centroid.
 *                         Magnitude gives the asymmetry strength
 *                         in standardized units.
 *
 * Citation: Peeters, G. (2004), "A large set of audio features
 * for sound description (similarity and classification) in the
 * CUIDADO project", IRCAM Tech. Rep., §6.1.4 — third central
 * moment of the power spectrum as the canonical spectral
 * asymmetry descriptor. See also Lerch, A. (2012), "An
 * Introduction to Audio Content Analysis", Wiley/IEEE Press,
 * §3.3.2 (Spectral Skewness), and the standardized
 * (Fisher) form in Joanes & Gill (1998), "Comparing measures
 * of sample skewness and kurtosis", J. Royal Stat. Soc. Series
 * D, 47(1), 183-189.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-centroid** (0.6.148): centroid is the
 *     *first* moment (location). Skewness is the *third*
 *     standardized central moment (asymmetry of mass around
 *     that location). Two PSDs with identical centroids can
 *     have skewness of opposite sign: a PSD with mass at bins
 *     {c - 1, c + 5} (positive skew) vs. {c - 5, c + 1}
 *     (negative skew) share the same centroid but flip the
 *     skewness sign. Mean vs. asymmetry of a CDF — orthogonal.
 *   - vs. **spectral-bandwidth** (0.6.150): bandwidth is the
 *     *second* central moment (sqrt of variance / spread).
 *     Skewness divides the *third* central moment by the
 *     *3/2 power of the second*, deliberately scaling spread
 *     out so only asymmetry remains. Two PSDs with identical
 *     bandwidth can have very different skewness: a symmetric
 *     two-tone PSD around the centroid has skewness 0; an
 *     asymmetric two-tone PSD with the same variance has
 *     non-zero skewness. Spread vs. *direction* of spread.
 *   - vs. **spectral-rolloff** (0.6.146): roll-off is a
 *     single CDF *quantile*. Skewness is a third-moment
 *     summary of the whole CDF shape. Two PSDs that share an
 *     85% roll-off bin can have wildly different skewness
 *     (e.g. a long left tail with a sharp 85th percentile vs.
 *     a long right tail with the same 85th percentile).
 *   - vs. **spectral-flatness** (0.6.144): SF is the
 *     geometric/arithmetic mean ratio `G/A` of `P[k]` —
 *     a global "how peaked vs uniform" entropy ratio that is
 *     position-blind. Skewness is position-aware *and*
 *     direction-aware: a uniform PSD on `[1, K/2]` and the
 *     mirror-image uniform PSD on `[K/2 + 1, K]` share the
 *     same flatness but opposite-sign skewness around their
 *     respective centroids.
 *   - vs. **hjorth-mobility / hjorth-complexity / TKEO**:
 *     Hjorth-mobility is sqrt of a *non-central* second
 *     moment. Hjorth-complexity is a ratio of mobilities.
 *     TKEO is a time-domain f^2-biased energy operator. None
 *     of these capture sign-bearing PSD asymmetry; all are
 *     non-negative spread/energy summaries.
 *   - vs. **autocorrelation (lag-1) / mann-kendall**:
 *     time-domain summaries; integrate one lag or one trend
 *     statistic; lose the PSD entirely.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise PSD
 *     *slope* / scaling on a log-log axis. Slope is a
 *     first-moment-like summary of `log P[k]` against
 *     `log k`; skewness is a third-moment summary of `P[k]`
 *     against `k` on the linear axis. They are not collapsible
 *     onto each other in general.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     time-domain skewness/kurtosis, gini, crest-factor,
 *     burstiness-coefficient)**: amplitude domain,
 *     order-invariant. Skewness here is sensitive to *sample
 *     order* (it is a PSD descriptor) — shuffle the sequence
 *     and the spectral skewness changes; amplitude skewness
 *     does not.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic reductions; lose the PSD entirely.
 *   - vs. **event counters (zcr, runs-test, turning-point)**:
 *     scalar event tallies; skewness is a continuous,
 *     sign-bearing third-moment summary on bin index.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, or
 *     numerically zero total power, or `K < 2` so a 3rd moment
 *     is degenerate, or `m2` numerically 0 so skewness is
 *     undefined): surfaces under `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralSkewnessSort =
  | 'skewness-asc'
  | 'skewness-desc'
  | 'abs-skewness-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralSkewnessOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2 for a
   * meaningful 3rd moment, and a non-zero variance to standardize
   * by). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Optional lower bound on reported `skewness`. Sources whose
   * value is strictly below this threshold are suppressed and
   * counted under `droppedBelowMinSkewness`. Useful to surface
   * only sources whose PSD leans sufficiently towards the
   * high-frequency tail.
   */
  minSkewness?: number | null;
  /**
   * Optional upper bound on reported `skewness`. Symmetric
   * counterpart. Surfaces in `droppedAboveMaxSkewness`. Useful
   * to surface only sources whose PSD leans towards the
   * low-frequency tail.
   *
   * If both are set and `minSkewness > maxSkewness`, the
   * constructor throws — operator error, not a silent empty
   * report.
   */
  maxSkewness?: number | null;
  /**
   * Optional lower bound on reported `bandwidthBin` (sqrt of m2,
   * bin-units). Sources whose value is strictly below this
   * threshold are suppressed and counted under
   * `droppedBelowMinBandwidthBin`. Useful to avoid reading
   * skewness off near-degenerate (almost-zero-variance) PSDs
   * where the standardized 3rd moment is numerically fragile.
   */
  minBandwidthBin?: number | null;
  /**
   * Optional upper bound on reported `bandwidthBin`. Symmetric
   * counterpart. Surfaces in `droppedAboveMaxBandwidthBin`. If
   * both are set and `minBandwidthBin > maxBandwidthBin` the
   * constructor throws.
   */
  maxBandwidthBin?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'skewness-asc' (default): standardized skewness ascending
   *                               — most negatively skewed (long
   *                               low-frequency tail) first.
   *   - 'skewness-desc':         skewness descending — most
   *                               positively skewed (long
   *                               high-frequency tail) first.
   *   - 'abs-skewness-desc':     |skewness| descending — most
   *                               asymmetric (in either direction)
   *                               first.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralSkewnessSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralSkewnessRow {
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
  /** Raw 3rd central moment (bin^3 units). */
  m3: number;
  /** Standardized (Fisher) spectral skewness: m3 / m2^(3/2). */
  skewness: number;
}

export interface SourceRowTokenSpectralSkewnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  minSkewness: number | null;
  maxSkewness: number | null;
  minBandwidthBin: number | null;
  maxBandwidthBin: number | null;
  sort: SourceRowTokenSpectralSkewnessSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowMinSkewness: number;
  droppedAboveMaxSkewness: number;
  droppedBelowMinBandwidthBin: number;
  droppedAboveMaxBandwidthBin: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralSkewnessRow[];
}

const VALID_SORTS = [
  'skewness-asc',
  'skewness-desc',
  'abs-skewness-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralSkewness(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralSkewnessOptions = {},
): SourceRowTokenSpectralSkewnessReport {
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
  const minSkewness = opts.minSkewness ?? null;
  if (minSkewness !== null) {
    if (!Number.isFinite(minSkewness)) {
      throw new Error(
        `minSkewness must be a finite number (got ${opts.minSkewness})`,
      );
    }
  }
  const maxSkewness = opts.maxSkewness ?? null;
  if (maxSkewness !== null) {
    if (!Number.isFinite(maxSkewness)) {
      throw new Error(
        `maxSkewness must be a finite number (got ${opts.maxSkewness})`,
      );
    }
  }
  if (
    minSkewness !== null &&
    maxSkewness !== null &&
    minSkewness > maxSkewness
  ) {
    throw new Error(
      `minSkewness (${minSkewness}) must be <= maxSkewness (${maxSkewness})`,
    );
  }
  const minBandwidthBin = opts.minBandwidthBin ?? null;
  if (minBandwidthBin !== null) {
    if (!Number.isFinite(minBandwidthBin) || minBandwidthBin < 0) {
      throw new Error(
        `minBandwidthBin must be a finite number >= 0 (got ${opts.minBandwidthBin})`,
      );
    }
  }
  const maxBandwidthBin = opts.maxBandwidthBin ?? null;
  if (maxBandwidthBin !== null) {
    if (!Number.isFinite(maxBandwidthBin) || maxBandwidthBin < 0) {
      throw new Error(
        `maxBandwidthBin must be a finite number >= 0 (got ${opts.maxBandwidthBin})`,
      );
    }
  }
  if (
    minBandwidthBin !== null &&
    maxBandwidthBin !== null &&
    minBandwidthBin > maxBandwidthBin
  ) {
    throw new Error(
      `minBandwidthBin (${minBandwidthBin}) must be <= maxBandwidthBin (${maxBandwidthBin})`,
    );
  }
  const sort = opts.sort ?? 'skewness-asc';
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

  const allRows: SourceRowTokenSpectralSkewnessRow[] = [];

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
      // Need at least two bins to have a non-trivial 3rd moment.
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
    let m2 = 0;
    let m3 = 0;
    for (let k = 1; k <= bins; k++) {
      const d = k - centroidBin;
      const p = power[k - 1]!;
      m2 += d * d * p;
      m3 += d * d * d * p;
    }
    m2 = m2 / sumPower;
    m3 = m3 / sumPower;
    const bandwidthBin = Math.sqrt(Math.max(0, m2));

    if (!Number.isFinite(m2) || m2 <= 0) {
      // Variance numerically zero -> standardized skewness undefined.
      droppedConstantSeries += 1;
      continue;
    }
    const skewness = m3 / Math.pow(m2, 1.5);

    if (
      !Number.isFinite(centroidBin) ||
      !Number.isFinite(bandwidthBin) ||
      !Number.isFinite(m3) ||
      !Number.isFinite(skewness) ||
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
      m3,
      skewness,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'skewness-asc') {
      primary = a.skewness - b.skewness;
    } else if (sort === 'skewness-desc') {
      primary = b.skewness - a.skewness;
    } else if (sort === 'abs-skewness-desc') {
      primary = Math.abs(b.skewness) - Math.abs(a.skewness);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinSkewness = 0;
  let droppedAboveMaxSkewness = 0;
  let droppedBelowMinBandwidthBin = 0;
  let droppedAboveMaxBandwidthBin = 0;
  let postRows = allRows;
  if (
    minSkewness !== null ||
    maxSkewness !== null ||
    minBandwidthBin !== null ||
    maxBandwidthBin !== null
  ) {
    const kept: SourceRowTokenSpectralSkewnessRow[] = [];
    for (const row of postRows) {
      // Skewness filters first (the lens's headline filter axis),
      // then the bandwidth-bin sanity filter. Both surface in their
      // own dropped buckets so the operator can read which gate a
      // source fell through.
      if (minSkewness !== null && row.skewness < minSkewness) {
        droppedBelowMinSkewness += 1;
        continue;
      }
      if (maxSkewness !== null && row.skewness > maxSkewness) {
        droppedAboveMaxSkewness += 1;
        continue;
      }
      if (minBandwidthBin !== null && row.bandwidthBin < minBandwidthBin) {
        droppedBelowMinBandwidthBin += 1;
        continue;
      }
      if (maxBandwidthBin !== null && row.bandwidthBin > maxBandwidthBin) {
        droppedAboveMaxBandwidthBin += 1;
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
    minSkewness,
    maxSkewness,
    minBandwidthBin,
    maxBandwidthBin,
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
    droppedBelowMinSkewness,
    droppedAboveMaxSkewness,
    droppedBelowMinBandwidthBin,
    droppedAboveMaxBandwidthBin,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
