/**
 * source-row-token-spectral-entropy: per-source **Shannon
 * spectral entropy** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how concentrated vs.
 * spread out is the per-row token PSD across frequency bins,
 * measured as the information entropy of the PSD treated as a
 * probability distribution over bins?**
 *
 * For a one-sided non-DC power spectrum `P[k] = |X[k]|^2`,
 * `k = 1..K = floor(n/2)`, normalize to a probability mass on
 * bins
 *
 *   p[k] = P[k] / sum_j P[j],
 *
 * then the **Shannon spectral entropy** (bits) is
 *
 *   H        = - sum_{k=1..K, p[k] > 0} p[k] * log2(p[k]),
 *
 * and the **normalized spectral entropy** (in [0, 1]) is
 *
 *   H_norm   = H / log2(K).
 *
 * Reported quantities:
 *   - `entropyBits` : raw H, in bits. Range [0, log2(K)]. 0
 *                     iff the entire PSD sits in a single bin
 *                     (a pure tone); log2(K) iff the PSD is
 *                     perfectly uniform across all K bins
 *                     (white-on-band).
 *   - `entropyNorm` : H / log2(K), in [0, 1]. The
 *                     dimensionless, K-comparable form
 *                     reported by Pan, Chen & Hsieh (2009)
 *                     and the EEG / biomedical literature
 *                     (Inouye et al. 1991, Rezek & Roberts
 *                     1998). 0 = pure tone; 1 = uniform PSD.
 *   - `dominantBin` / `dominantShare` : argmax bin and its
 *                     `p[k]`, included as a sanity-check
 *                     companion: H_norm should fall when
 *                     `dominantShare` rises and rise as
 *                     `dominantShare` falls toward 1/K.
 *
 * Citation:
 *   - Shannon, C. E. (1948), "A Mathematical Theory of
 *     Communication", Bell System Tech. J., 27(3), 379-423 —
 *     the canonical reference for the Shannon entropy
 *     functional applied here.
 *   - Inouye, T., Shinosaki, K., Sakamoto, H., Toi, S.,
 *     Ukai, S., Iyama, A., Katsuda, Y. & Hirano, M. (1991),
 *     "Quantification of EEG irregularity by use of the
 *     entropy of the power spectrum",
 *     Electroencephalogr. Clin. Neurophysiol., 79(3), 204-210
 *     — the canonical reference for normalized spectral
 *     entropy of a one-sided PSD as an irregularity measure.
 *   - Rezek, I. A. & Roberts, S. J. (1998), "Stochastic
 *     complexity measures for physiological signal analysis",
 *     IEEE Trans. Biomed. Eng., 45(9), 1186-1191 — H/log(K)
 *     normalization framing.
 *   - Pan, Y.-N., Chen, J. & Li, X.-L. (2009), "Spectral
 *     entropy: A complementary index for rolling element
 *     bearing performance degradation assessment",
 *     Proc. IMechE Part C, 223(5), 1223-1231 — the
 *     condition-monitoring framing for normalized PSD entropy
 *     as a tonal-vs-broadband index.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-flatness** (0.6.144): SF is the
 *     *geometric / arithmetic mean ratio* of `P[k]` —
 *     `(prod P[k])^(1/K) / ((1/K) sum P[k])`. SF and H_norm
 *     are *both* concentration summaries with `[0, 1]`
 *     range, and *both* hit 1 at the perfectly uniform PSD,
 *     but they are NOT the same functional and they
 *     disagree on intermediate distributions. SF is a
 *     *renormalized geometric mean* (Wiener entropy in the
 *     log domain); H_norm is a *Shannon entropy* in the
 *     linear domain. A two-bin PSD with masses `(0.99,
 *     0.01)` has flatness `~= 0.198` (geometric mean
 *     `0.0995` over arithmetic mean `0.5`) but normalized
 *     entropy only `~= 0.081` (`H = 0.0808`, `log2(2) = 1`)
 *     — Shannon penalizes the long tail far less than the
 *     geometric mean does. A uniform-on-half PSD with
 *     masses `(0.5, 0.5, 0, 0)` has flatness 0 (because the
 *     geometric mean is 0 the moment any single bin is 0)
 *     but normalized entropy `0.5` (`H = 1`, `log2(4) = 2`).
 *     Flatness is sensitive to the *worst* bin; entropy is
 *     sensitive to the *whole shape*. Different functionals
 *     with different sensitivities — orthogonal in the
 *     direction that matters.
 *   - vs. **spectral-bandwidth** (0.6.150): bandwidth is the
 *     *2nd central moment* around the centroid. Bandwidth
 *     and entropy can disagree: a PSD with mass split
 *     equally between bins 1 and K has very high bandwidth
 *     and very high entropy; a PSD with mass uniformly
 *     spread over a *small* contiguous band centered on K/2
 *     has low bandwidth but moderate entropy. Spread vs.
 *     diversity — orthogonal axes.
 *   - vs. **spectral-kurtosis** (0.6.154): kurtosis is the
 *     *4th standardized central moment* around the centroid
 *     — a peakedness/tail-weight summary. A high-kurtosis
 *     PSD (sharp central peak with heavy symmetric tails)
 *     can have moderate entropy because the tails fan mass
 *     out across many bins. A low-kurtosis (flat-topped)
 *     PSD on a narrow band has low entropy (mass is
 *     concentrated on those few bins) but a low kurtosis
 *     value `~ 1.8` (the uniform baseline). Peakedness vs.
 *     concentration — orthogonal.
 *   - vs. **spectral-skewness** (0.6.152): skewness is
 *     sign-bearing (3rd standardized central moment).
 *     Entropy is sign-blind. Two PSDs with opposite-sign
 *     skewness can share the exact same entropy.
 *   - vs. **spectral-centroid** (0.6.148) / **spectral-
 *     rolloff**: centroid is location, rolloff is a CDF
 *     quantile. Entropy is location-blind: shifting the
 *     PSD along the bin axis (a circular shift, or trimming
 *     equal-mass tails from each side) leaves entropy
 *     invariant.
 *   - vs. **hjorth-mobility / hjorth-complexity / TKEO**:
 *     time-domain energy/activity descriptors; do not
 *     reduce the PSD to an information-theoretic
 *     concentration summary.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: those are
 *     ordinal / symbolic reductions of the *time series*.
 *     Spectral entropy here is the Shannon entropy of the
 *     normalized *power spectrum*. Time-domain entropies
 *     count repeating motifs; spectral entropy counts how
 *     many frequency bins meaningfully participate in the
 *     PSD. Two series with identical permutation entropy
 *     can have wildly different spectral entropy: a
 *     periodic carrier (one frequency, low spectral
 *     entropy) vs. a finely-shuffled version with the same
 *     ordinal patterns but a broadened PSD (high spectral
 *     entropy).
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise
 *     PSD *slope* on a log-log axis. Slope is a single
 *     first-moment-like summary of `log P[k]` against
 *     `log k`; entropy is an information-theoretic summary
 *     of the *whole* normalized PSD on the linear axis.
 *     Two power-law PSDs with the same slope can have
 *     different entropies if one has additional spectral
 *     concentration features superimposed. Not collapsible.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     time-domain skewness/kurtosis, gini, crest-factor,
 *     burstiness-coefficient)**: amplitude domain,
 *     order-invariant. Spectral entropy here is sensitive
 *     to *sample order* — shuffle the sequence and the
 *     spectral entropy changes (typically rises toward
 *     the white-noise ceiling); amplitude entropy / amplitude
 *     gini do not.
 *   - vs. **event counters (zcr, runs-test, turning-point)**:
 *     scalar event tallies; spectral entropy is a
 *     continuous information-theoretic summary on bin
 *     index.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, or
 *     numerically zero total power, or `K < 2` so a
 *     `log2(K)` normalization is degenerate): surfaces under
 *     `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralEntropySort =
  | 'entropy-asc'
  | 'entropy-desc'
  | 'norm-asc'
  | 'norm-desc'
  | 'dom-share-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2 so that
   * `log2(K) > 0` and the normalized entropy is well-defined).
   * Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'norm-desc' (default): normalized entropy descending
   *                            (most broadband / white-like
   *                            PSD first).
   *   - 'norm-asc':            normalized entropy ascending
   *                            (most tonal / concentrated PSD
   *                            first).
   *   - 'entropy-desc':        raw bits descending.
   *   - 'entropy-asc':         raw bits ascending.
   *   - 'dom-share-desc':      dominant-bin share descending
   *                            (a complementary view of
   *                            tonality).
   *   - 'rows':                rowsKept desc.
   *   - 'source':              source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralEntropySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralEntropyRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** Shannon entropy of the normalized PSD, in bits. Range [0, log2(bins)]. */
  entropyBits: number;
  /** entropyBits / log2(bins). Range [0, 1]. 0=pure tone, 1=uniform PSD. */
  entropyNorm: number;
  /** Argmax bin (1..bins) of P[k]. Tiebreak: smallest bin. */
  dominantBin: number;
  /** P[dominantBin] / totalPower, in (0, 1]. */
  dominantShare: number;
}

export interface SourceRowTokenSpectralEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenSpectralEntropySort;
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
  sources: SourceRowTokenSpectralEntropyRow[];
}

const VALID_SORTS = [
  'entropy-asc',
  'entropy-desc',
  'norm-asc',
  'norm-desc',
  'dom-share-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralEntropy(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralEntropyOptions = {},
): SourceRowTokenSpectralEntropyReport {
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
  const sort = opts.sort ?? 'norm-desc';
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

  const allRows: SourceRowTokenSpectralEntropyRow[] = [];
  const LN2 = Math.log(2);

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
      // Need K >= 2 so log2(K) > 0 and the normalized entropy
      // is well-defined.
      droppedConstantSeries += 1;
      continue;
    }
    const power = new Array<number>(bins);
    let sumPower = 0;
    let dominantBin = 1;
    let dominantPower = -Infinity;
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

    let entropyNats = 0;
    for (let k = 0; k < bins; k++) {
      const pk = power[k]! / sumPower;
      if (pk > 0) {
        entropyNats += -pk * Math.log(pk);
      }
    }
    const entropyBits = entropyNats / LN2;
    const log2K = Math.log(bins) / LN2;
    const entropyNorm = entropyBits / log2K;
    const dominantShare = dominantPower / sumPower;

    if (
      !Number.isFinite(entropyBits) ||
      !Number.isFinite(entropyNorm) ||
      !Number.isFinite(dominantShare) ||
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
      entropyBits,
      entropyNorm,
      dominantBin,
      dominantShare,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'entropy-asc') {
      primary = a.entropyBits - b.entropyBits;
    } else if (sort === 'entropy-desc') {
      primary = b.entropyBits - a.entropyBits;
    } else if (sort === 'norm-asc') {
      primary = a.entropyNorm - b.entropyNorm;
    } else if (sort === 'norm-desc') {
      primary = b.entropyNorm - a.entropyNorm;
    } else if (sort === 'dom-share-desc') {
      primary = b.dominantShare - a.dominantShare;
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
