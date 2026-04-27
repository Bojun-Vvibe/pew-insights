/**
 * source-row-token-spectral-flatness: per-source **spectral
 * flatness** (a.k.a. **Wiener entropy**, a.k.a. **tonality
 * coefficient**) of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how white-noise-like
 * vs. how tonal/periodic is the per-row token sequence in the
 * frequency domain?**
 *
 * Spectral flatness `SF = G(P) / A(P)`, where `P[k] = |X[k]|^2`
 * is the (one-sided, DC-excluded) power spectrum of the
 * mean-centered series and:
 *   - G(P) = exp( mean( log(P[k]) ) )   (geometric mean)
 *   - A(P) = mean( P[k] )                (arithmetic mean)
 *
 * By the AM-GM inequality, `0 < SF <= 1`. Theoretical anchors:
 *   - SF -> 1: power is **uniformly distributed across all
 *     frequencies** -> white-noise-like / unstructured signal.
 *   - SF -> 0: power is **concentrated in a few frequency
 *     bins** -> highly tonal / periodic signal (a single sine
 *     wave is the limiting case).
 *
 * Provenance: Johnston, J. D. (1988), "Transform Coding of
 * Audio Signals Using Perceptual Noise Criteria",
 * IEEE J. Selected Areas in Comms 6(2):314-323. Standard
 * tonality measure in MPEG audio psychoacoustics. Equivalent
 * to `exp(-H_diff)` where `H_diff` is the differential entropy
 * of a stationary Gaussian process with the given PSD
 * (Burg 1975), which is why it is also called *Wiener entropy*.
 *
 * Construction:
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`, non-finite or
 *      negative `total_tokens` (counted separately).
 *   3. Group by source, sort each group by `hour_start` ascending
 *      (sort matters: this is a frequency-domain lens; reordering
 *      rows changes the spectrum).
 *   4. Skip if `n < minRows` (default 8; need at least a few
 *      frequency bins for the geometric mean to be informative).
 *   5. Mean-center the series (subtract sample mean). This is
 *      standard in spectral-flatness pipelines: it removes the
 *      DC component, which would otherwise dominate `A(P)` for
 *      strictly-positive series like token counts and crush SF
 *      toward 0 for reasons unrelated to tonality.
 *   6. Compute the real DFT via direct O(n^2) summation:
 *         X[k] = sum_t x_t * exp(-2*pi*i * k * t / n)
 *      for k = 1 .. floor(n/2). (k = 0 is DC; we already
 *      removed it via centering.) Power: `P[k] = |X[k]|^2`.
 *   7. Drop bins with `P[k] <= eps` (floor at `1e-300`); if
 *      after flooring all bins are at the floor, the series is
 *      a constant — surface under `droppedConstantSeries`.
 *      Otherwise replace any sub-floor bins with the floor
 *      value before taking logs (Welch / log-MS convention).
 *   8. SF = exp( mean(log P) ) / mean(P).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **crest-factor / iqr-ratio / mad / cv / kurtosis /
 *     skewness / gini / burstiness-coefficient**: all are
 *     amplitude-domain shape statistics. SF is a **frequency-
 *     domain** statistic — two series with identical histograms
 *     but different temporal arrangements have different SF.
 *   - vs. **lag-1 autocorrelation**: AR(1) summary at a single
 *     lag. SF integrates the entire PSD and is not biased by
 *     any particular lag.
 *   - vs. **TKEO / hjorth-mobility / hjorth-complexity**: those
 *     are spectral *moments* (TKEO ~ omega^2 * A^2; mobility ~
 *     centroid; complexity ~ bandwidth). SF is an **entropy-
 *     like** functional of the PSD, not a moment, and is
 *     invariant to rescaling of the spectrum.
 *   - vs. **zero-crossing rate / runs-test / turning-point /
 *     mann-kendall**: count-based event statistics that
 *     compress the entire signal to a single integer.
 *   - vs. **approximate / sample / permutation / renyi
 *     entropies**: those are time-domain symbolic /
 *     ordinal entropies; SF is the entropy of the **power
 *     spectrum** (a scalar functional of the Fourier
 *     transform). They generally disagree: a sine wave has
 *     high permutation/sample entropy on noise but vanishing SF.
 *   - vs. **Hurst-RS / DFA / Higuchi-FD / Katz-FD /
 *     Petrosian-FD**: long-range scaling / fractal-dimension
 *     summaries — single-exponent characterisations of the PSD
 *     decay; SF is the *whole-band* flatness, not a slope.
 *   - vs. **lempel-ziv**: symbolic factor count; binarisation
 *     destroys frequency content.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0): surfaces
 *     under `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity (impossible given
 *     the input invariants but checked): surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralFlatnessSort =
  | 'sf-asc'
  | 'sf-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralFlatnessOptions {
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
   *   - 'sf-asc' (default): SF ascending — most tonal first.
   *   - 'sf-desc':          SF descending — most white-noise-like first.
   *   - 'rows':             rowsKept desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralFlatnessSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralFlatnessRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Geometric mean of the power spectrum. */
  geometricMean: number;
  /** Arithmetic mean of the power spectrum. */
  arithmeticMean: number;
  /** SF = G/A. In (0, 1]. */
  spectralFlatness: number;
  /**
   * Index (1-based, in 1..floor(n/2)) of the bin with the
   * largest power, useful for reading dominant period =
   * n / dominantBin (in row-spacing units).
   */
  dominantBin: number;
  /** Fraction of total non-DC power held by the dominantBin. */
  dominantBinShare: number;
}

export interface SourceRowTokenSpectralFlatnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenSpectralFlatnessSort;
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
  sources: SourceRowTokenSpectralFlatnessRow[];
}

const VALID_SORTS = ['sf-asc', 'sf-desc', 'rows', 'source'] as const;
const POWER_FLOOR = 1e-300;

export function buildSourceRowTokenSpectralFlatness(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralFlatnessOptions = {},
): SourceRowTokenSpectralFlatnessReport {
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
  const sort = opts.sort ?? 'sf-asc';
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

  const allRows: SourceRowTokenSpectralFlatnessRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;

    samples.sort((a, b) => a[0] - b[0]);
    const v = samples.map((s) => s[1]);
    const n = v.length;

    if (n < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }

    // Mean-center: drop the DC component analytically.
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

    // One-sided non-DC bins: k = 1..floor(n/2).
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
      // After mean-centering with non-zero variance, total power
      // is strictly positive; this branch is defensive only.
      droppedConstantSeries += 1;
      continue;
    }

    // Floor sub-eps bins for geometric-mean numerics; if all
    // bins were below floor, fall through to droppedConstantSeries.
    let aboveFloor = 0;
    for (let k = 0; k < bins; k++) {
      if (power[k]! > POWER_FLOOR) aboveFloor += 1;
      else power[k] = POWER_FLOOR;
    }
    if (aboveFloor === 0) {
      droppedConstantSeries += 1;
      continue;
    }

    let sumLog = 0;
    let sumP = 0;
    for (let k = 0; k < bins; k++) {
      sumLog += Math.log(power[k]!);
      sumP += power[k]!;
    }
    const geometricMean = Math.exp(sumLog / bins);
    const arithmeticMean = sumP / bins;
    const spectralFlatness = geometricMean / arithmeticMean;
    const dominantBinShare = dominantPower / sumPower;

    if (
      !Number.isFinite(geometricMean) ||
      !Number.isFinite(arithmeticMean) ||
      !Number.isFinite(spectralFlatness) ||
      !Number.isFinite(dominantBinShare)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      bins,
      geometricMean,
      arithmeticMean,
      spectralFlatness,
      dominantBin,
      dominantBinShare,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'sf-asc') {
      primary = a.spectralFlatness - b.spectralFlatness;
    } else if (sort === 'sf-desc') {
      primary = b.spectralFlatness - a.spectralFlatness;
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
