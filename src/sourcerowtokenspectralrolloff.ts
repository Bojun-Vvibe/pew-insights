/**
 * source-row-token-spectral-rolloff: per-source **spectral
 * roll-off frequency** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, below which frequency
 * does a chosen fraction (default 85%) of the total non-DC
 * spectral energy lie?**
 *
 * For a one-sided non-DC power spectrum `P[k] = |X[k]|^2`,
 * `k = 1..floor(n/2)`, the roll-off **bin** `R` is the smallest
 * `k` such that `sum_{j=1..k} P[j] >= rolloffFraction * sum P`.
 * Reported quantities:
 *   - `rolloffBin`         : the integer bin `R` (1-based).
 *   - `rolloffFractionBins`: `R / floor(n/2)` in (0, 1] — a
 *                            scale-free band-edge in
 *                            "fraction-of-Nyquist" units.
 *   - `cumulativeFraction` : the realised cumulative fraction
 *                            at `R` (>= rolloffFraction).
 *   - `dominantBin` and `dominantBinShare` for context.
 *
 * Citation: McKinney, M. F. & Breebaart, J. (2003), "Features
 * for Audio and Music Classification", Proc. ISMIR 2003,
 * pp. 151-158 — establishes spectral roll-off as a standard
 * timbral feature alongside spectral flatness, centroid, and
 * spread. Earlier mention in Klapuri, A. (1999), "Sound
 * onset detection by applying psychoacoustic knowledge",
 * Proc. ICASSP-99 vol.6 pp.3089-3092.
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending.
 *      (Sort matters: this is a frequency-domain lens.)
 *   4. Skip if `n < minRows` (default 8). Need at least a few
 *      bins to make the cumulative-energy curve informative.
 *   5. Mean-center the series (subtract sample mean) — drops the
 *      DC component, which would otherwise hide the true energy
 *      distribution for strictly-positive series like token
 *      counts.
 *   6. Compute the real DFT via direct O(n^2) summation:
 *         X[k] = sum_t x_t * exp(-2*pi*i * k * t / n)
 *      for k = 1..floor(n/2). Power: `P[k] = |X[k]|^2`.
 *   7. If total power is non-positive (constant series after
 *      centering), surface under `droppedConstantSeries`.
 *   8. Cumulative-sum P from k=1 upward; `R` is the first bin
 *      where the cumulative reaches `rolloffFraction * sumP`.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-flatness (Wiener entropy)**: SF answers
 *     "how peaked vs uniform is the PSD across all bins"
 *     (an entropy-like ratio G/A). Roll-off answers "where
 *     along the frequency axis is the energy concentrated"
 *     (a CDF percentile of the PSD). Two PSDs can have
 *     identical SF but very different roll-off (e.g. two
 *     equally-peaked spectra peaked at different frequencies).
 *   - vs. **TKEO / hjorth-mobility / hjorth-complexity**:
 *     those are spectral *moments* (energy-like, centroid,
 *     bandwidth). Roll-off is a *quantile* of the cumulative
 *     PSD — robust to high-frequency tail mass that pulls
 *     moments around.
 *   - vs. **autocorrelation (lag-1)** / **single-lag**
 *     time-domain summaries: integrates one lag; roll-off
 *     integrates the entire PSD up to a quantile.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise
 *     PSD *slope* / scaling; roll-off summarises the PSD
 *     *quantile location*.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness-
 *     coefficient)**: amplitude domain, order-invariant.
 *     Roll-off is order-sensitive.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi)**: ordinal/symbolic
 *     reductions; lose the PSD entirely.
 *   - vs. **event counters (zcr, runs-test, turning-point,
 *     mann-kendall)**: scalar event tallies; roll-off is a
 *     band-edge frequency.
 *   - vs. **lempel-ziv**: binarised factor count; roll-off
 *     uses the full continuous PSD.
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

export type SourceRowTokenSpectralRolloffSort =
  | 'rolloff-asc'
  | 'rolloff-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralRolloffOptions {
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
   * The cumulative-energy fraction at which to read the
   * roll-off bin. Must be in (0, 1]. Default 0.85 (the
   * canonical McKinney & Breebaart 2003 / Klapuri 1999
   * value). Common alternatives: 0.50 (median band-edge),
   * 0.95 (near-edge tail).
   */
  rolloffFraction?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Optional lower bound on reported `rolloffFractionBins`.
   * Sources whose value is strictly below this threshold are
   * suppressed and counted under `droppedBelowMinRolloffFracBins`.
   * Useful to surface only the more high-frequency-loaded sources.
   */
  minRolloffFracBins?: number | null;
  /**
   * Optional upper bound on reported `rolloffFractionBins`.
   * Symmetric counterpart to `minRolloffFracBins`. Surfaces in
   * `droppedAboveMaxRolloffFracBins`. Useful to surface only the
   * more low-frequency-loaded sources.
   *
   * If both are set and `minRolloffFracBins > maxRolloffFracBins`,
   * the constructor throws — operator error, not a silent
   * empty report.
   */
  maxRolloffFracBins?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'rolloff-asc' (default): rolloffFractionBins ascending —
   *                              most low-frequency-loaded first.
   *   - 'rolloff-desc':          rolloffFractionBins descending —
   *                              most high-frequency-loaded first.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralRolloffSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralRolloffRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** 1-based bin index where cumulative power first crosses the threshold. */
  rolloffBin: number;
  /** rolloffBin / bins, in (0, 1]. Scale-free band-edge fraction. */
  rolloffFractionBins: number;
  /** Realised cumulative fraction at rolloffBin (>= rolloffFraction). */
  cumulativeFraction: number;
  /** Bin holding the largest single-bin power (for context). */
  dominantBin: number;
  /** Fraction of total non-DC power held by the dominantBin. */
  dominantBinShare: number;
}

export interface SourceRowTokenSpectralRolloffReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  rolloffFraction: number;
  top: number | null;
  minRolloffFracBins: number | null;
  maxRolloffFracBins: number | null;
  sort: SourceRowTokenSpectralRolloffSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowMinRolloffFracBins: number;
  droppedAboveMaxRolloffFracBins: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralRolloffRow[];
}

const VALID_SORTS = [
  'rolloff-asc',
  'rolloff-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralRolloff(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralRolloffOptions = {},
): SourceRowTokenSpectralRolloffReport {
  const minRows = opts.minRows ?? 8;
  if (!Number.isInteger(minRows) || minRows < 4) {
    throw new Error(
      `minRows must be an integer >= 4 (got ${opts.minRows})`,
    );
  }
  const rolloffFraction = opts.rolloffFraction ?? 0.85;
  if (
    !Number.isFinite(rolloffFraction) ||
    rolloffFraction <= 0 ||
    rolloffFraction > 1
  ) {
    throw new Error(
      `rolloffFraction must be in (0, 1] (got ${opts.rolloffFraction})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const minRolloffFracBins = opts.minRolloffFracBins ?? null;
  if (minRolloffFracBins !== null) {
    if (!Number.isFinite(minRolloffFracBins)) {
      throw new Error(
        `minRolloffFracBins must be a finite number (got ${opts.minRolloffFracBins})`,
      );
    }
  }
  const maxRolloffFracBins = opts.maxRolloffFracBins ?? null;
  if (maxRolloffFracBins !== null) {
    if (!Number.isFinite(maxRolloffFracBins)) {
      throw new Error(
        `maxRolloffFracBins must be a finite number (got ${opts.maxRolloffFracBins})`,
      );
    }
  }
  if (
    minRolloffFracBins !== null &&
    maxRolloffFracBins !== null &&
    minRolloffFracBins > maxRolloffFracBins
  ) {
    throw new Error(
      `minRolloffFracBins (${minRolloffFracBins}) must be <= maxRolloffFracBins (${maxRolloffFracBins})`,
    );
  }
  const sort = opts.sort ?? 'rolloff-asc';
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

  const allRows: SourceRowTokenSpectralRolloffRow[] = [];

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
    const power = new Array<number>(bins);
    let sumPower = 0;
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
      power[k - 1] = p;
      sumPower += p;
      if (p > dominantPower) {
        dominantPower = p;
        dominantBin = k;
      }
    }

    if (sumPower <= 0 || !Number.isFinite(sumPower)) {
      droppedConstantSeries += 1;
      continue;
    }

    const target = rolloffFraction * sumPower;
    let cum = 0;
    let rolloffBin = bins; // worst case: all bins needed.
    for (let k = 0; k < bins; k++) {
      cum += power[k]!;
      if (cum >= target) {
        rolloffBin = k + 1; // 1-based.
        break;
      }
    }
    const cumulativeFraction = cum / sumPower;
    const rolloffFractionBins = rolloffBin / bins;
    const dominantBinShare = dominantPower / sumPower;

    if (
      !Number.isFinite(cumulativeFraction) ||
      !Number.isFinite(rolloffFractionBins) ||
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
      rolloffBin,
      rolloffFractionBins,
      cumulativeFraction,
      dominantBin,
      dominantBinShare,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'rolloff-asc') {
      primary = a.rolloffFractionBins - b.rolloffFractionBins;
    } else if (sort === 'rolloff-desc') {
      primary = b.rolloffFractionBins - a.rolloffFractionBins;
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinRolloffFracBins = 0;
  let droppedAboveMaxRolloffFracBins = 0;
  let postRows = allRows;
  if (minRolloffFracBins !== null || maxRolloffFracBins !== null) {
    const kept: SourceRowTokenSpectralRolloffRow[] = [];
    for (const row of postRows) {
      if (
        minRolloffFracBins !== null &&
        row.rolloffFractionBins < minRolloffFracBins
      ) {
        droppedBelowMinRolloffFracBins += 1;
        continue;
      }
      if (
        maxRolloffFracBins !== null &&
        row.rolloffFractionBins > maxRolloffFracBins
      ) {
        droppedAboveMaxRolloffFracBins += 1;
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
    rolloffFraction,
    top,
    minRolloffFracBins,
    maxRolloffFracBins,
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
    droppedBelowMinRolloffFracBins,
    droppedAboveMaxRolloffFracBins,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
