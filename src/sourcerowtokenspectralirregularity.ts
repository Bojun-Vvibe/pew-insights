/**
 * source-row-token-spectral-irregularity: per-source **Jensen
 * 1999 spectral irregularity** of the per-row `total_tokens`
 * sequence.
 *
 * Headline question: **for each source, how locally bin-to-bin
 * jagged is the per-row token PSD, regardless of where its
 * mass sits or how it slopes?** This is a *local difference
 * energy* descriptor: not a moment, not a quantile, not a
 * concentration scalar, not a slope-from-anchor. It measures
 * how much the spectrum jitters bin-to-bin once you have
 * normalized out total power.
 *
 * For the one-sided non-DC power spectrum
 * `P[k] = |X[k]|^2`, `k = 1..K = floor(n/2)`, with `K >= 2`,
 * Jensen 1999's simplification of Krimphoff 1994 defines the
 * irregularity as the bin-difference energy normalized by the
 * total bin energy:
 *
 *   irregularity = sum_{k=1..K-1} (P[k] - P[k+1])^2
 *                  / sum_{k=1..K} P[k]^2.
 *
 * Range and interpretation:
 *   - `irregularity = 0` iff every adjacent pair `P[k] = P[k+1]`,
 *     i.e. the PSD is perfectly flat across non-DC bins (all
 *     bins carry equal power). Permuting bins of a flat PSD
 *     does not change this.
 *   - Small `irregularity` (close to 0): the PSD is smooth /
 *     locally similar bin-to-bin even if globally tilted.
 *   - Large `irregularity` (toward and above 1): the PSD has
 *     strong bin-to-bin discontinuities — sharp peaks adjacent
 *     to deep valleys (a "comb" or "spiky" PSD shape).
 *   - The descriptor is dimensionless (a ratio of two
 *     same-units sums) and order-sensitive: permuting PSD
 *     bins changes the value.
 *
 * Reported quantities:
 *   - `bins`         : K = floor(n/2). >= 2 by gate.
 *   - `totalPower`   : sum_{k=1..K} P[k] (full one-sided non-DC
 *                      power; reported for cross-lens
 *                      comparability).
 *   - `sumP2`        : sum_{k=1..K} P[k]^2 (the descriptor's
 *                      denominator; reported because
 *                      `irregularity` is undefined when this
 *                      is 0 and the operator wants to see why
 *                      a source dropped under
 *                      `droppedConstantSeries`).
 *   - `diffEnergy`   : sum_{k=1..K-1} (P[k] - P[k+1])^2
 *                      (the descriptor's numerator).
 *   - `irregularity` : Jensen 1999 spectral irregularity (the
 *                      headline; dimensionless ratio).
 *
 * Citation: Jensen, K. (1999), "Timbre Models of Musical
 * Sounds", PhD thesis, University of Copenhagen, DIKU
 * Tech. Rep. 99/7, §3.5 (spectral irregularity as the
 * normalized bin-difference energy of the magnitude
 * spectrum); Krimphoff, J., McAdams, S., Winsberg, S. (1994),
 * "Caracterisation du timbre des sons complexes. II Analyses
 * acoustiques et quantification psychophysique", Journal de
 * Physique IV, 4(C5):625-628 (the original log-based
 * three-point local-deviation definition that Jensen later
 * simplified to the squared-difference form used here).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-centroid** (1st moment / location): two
 *     PSDs can share an identical centroid yet have very
 *     different irregularity — a smooth Gaussian-shaped PSD
 *     and a comb-shaped PSD with the same center of mass
 *     give equal centroid but very different irregularity.
 *   - vs. **spectral-bandwidth** (2nd central moment about
 *     centroid): bandwidth measures total spread; irregularity
 *     measures local jitter. A PSD that is broadly spread but
 *     smooth has high bandwidth and low irregularity; a PSD
 *     concentrated in a narrow band of alternating peaks /
 *     valleys has low bandwidth and high irregularity.
 *   - vs. **spectral-skewness / -kurtosis** (3rd / 4th
 *     standardized central moments about centroid): all are
 *     centroid-anchored *global* shape descriptors with no
 *     local-difference term. A symmetric-but-jagged PSD has
 *     skewness 0 yet high irregularity.
 *   - vs. **spectral-rolloff** (CDF quantile): rolloff bins
 *     are integrals of PSD up to a CDF threshold; irregularity
 *     is a derivative-like measure of the PSD itself. Two PSDs
 *     with the same 85% rolloff bin can differ wildly in
 *     irregularity.
 *   - vs. **spectral-flatness** (geometric/arithmetic mean
 *     ratio): flatness is a *global* concentration ratio that
 *     is bin-permutation-invariant — permuting PSD bins gives
 *     the same flatness. Irregularity depends on bin order
 *     (it is a sum over adjacent pairs). A flat-but-permuted
 *     PSD has the same flatness as the unpermuted version but
 *     different irregularity.
 *   - vs. **spectral-entropy** (Shannon on normalized PSD):
 *     entropy is also bin-permutation-invariant; same argument
 *     as flatness above. Irregularity captures the bin-order
 *     information that entropy throws away.
 *   - vs. **spectral-decrease** (Peeters 2004 1/(k-1)-weighted
 *     slope-from-anchor): decrease is anchored at bin 1 with
 *     a position-aware weighting; it measures the *systematic
 *     drop from bin 1*. Irregularity has no anchor and no bin
 *     index in its weights — only adjacent-pair differences.
 *     A perfectly-monotone-decreasing PSD has strongly
 *     negative decrease but low irregularity (smooth descent);
 *     a same-decrease-on-average PSD with a jagged staircase
 *     has the same decrease but high irregularity.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarize
 *     PSD log-log slope across decades. Irregularity is
 *     a linear local-difference ratio with no log-log term.
 *   - vs. **hjorth-mobility / -complexity / TKEO**: total
 *     energy / activity summaries; not adjacent-bin-difference
 *     based.
 *   - vs. **autocorrelation-lag1 / mann-kendall / runs /
 *     turning-point**: time-domain summaries; lose the PSD.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic on raw values; lose the PSD.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness)**:
 *     amplitude domain, order-invariant. Irregularity is a
 *     PSD descriptor and order-sensitive.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, total
 *     power 0, `K < 2`, or denominator `sum P[k]^2 <= 0`):
 *     surfaces under `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralIrregularitySort =
  | 'irregularity-desc'
  | 'irregularity-asc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralIrregularityOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2 so the
   * adjacent-pair sum has at least one term).
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
   *   - 'irregularity-desc' (default): jaggedest PSD first.
   *   - 'irregularity-asc':            smoothest PSD first.
   *   - 'rows':                        rowsKept desc.
   *   - 'source':                      source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralIrregularitySort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralIrregularityRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** sum_{k=1..bins} P[k]^2 — the descriptor's denominator. */
  sumP2: number;
  /** sum_{k=1..bins-1} (P[k] - P[k+1])^2 — the descriptor's numerator. */
  diffEnergy: number;
  /** Jensen 1999 spectral irregularity (dimensionless). */
  irregularity: number;
}

export interface SourceRowTokenSpectralIrregularityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  sort: SourceRowTokenSpectralIrregularitySort;
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
  sources: SourceRowTokenSpectralIrregularityRow[];
}

const VALID_SORTS = [
  'irregularity-desc',
  'irregularity-asc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralIrregularity(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralIrregularityOptions = {},
): SourceRowTokenSpectralIrregularityReport {
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
  const sort = opts.sort ?? 'irregularity-desc';
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

  const allRows: SourceRowTokenSpectralIrregularityRow[] = [];

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
      droppedConstantSeries += 1;
      continue;
    }
    const power = new Array<number>(bins);
    let sumPower = 0;
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
    }

    if (sumPower <= 0 || !Number.isFinite(sumPower)) {
      droppedConstantSeries += 1;
      continue;
    }

    let sumP2 = 0;
    for (let k = 0; k < bins; k++) {
      const p = power[k]!;
      sumP2 += p * p;
    }
    let diffEnergy = 0;
    for (let k = 0; k < bins - 1; k++) {
      const d = power[k]! - power[k + 1]!;
      diffEnergy += d * d;
    }

    if (sumP2 <= 0 || !Number.isFinite(sumP2)) {
      droppedConstantSeries += 1;
      continue;
    }

    const irregularity = diffEnergy / sumP2;

    if (
      !Number.isFinite(irregularity) ||
      !Number.isFinite(diffEnergy) ||
      !Number.isFinite(sumP2)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      bins,
      totalPower: sumPower,
      sumP2,
      diffEnergy,
      irregularity,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'irregularity-desc') {
      primary = b.irregularity - a.irregularity;
    } else if (sort === 'irregularity-asc') {
      primary = a.irregularity - b.irregularity;
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
