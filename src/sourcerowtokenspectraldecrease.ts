/**
 * source-row-token-spectral-decrease: per-source **spectral
 * decrease** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how perceptually
 * steeply does the per-row token PSD decrease away from its
 * first non-DC bin?** This is the Peeters 2004 spectral
 * decrease descriptor: a `1/(k-1)`-weighted measure of how
 * quickly the spectrum drops as frequency-bin index `k` grows
 * past `k = 1`. Unlike spectral-centroid (location of mass) or
 * spectral-bandwidth (spread around centroid) or
 * spectral-skewness/kurtosis (3rd/4th central moments around
 * centroid), spectral decrease is a **slope-like, fixed-anchor
 * (anchored at bin 1) PSD shape descriptor with a
 * perceptually-motivated `1/(k-1)` weighting** that gives
 * disproportionate importance to the *low-frequency drop-off*
 * and de-emphasizes the high-frequency tail.
 *
 * For a one-sided non-DC power spectrum
 * `P[k] = |X[k]|^2`, `k = 1..K = floor(n/2)`, with `K >= 2`,
 * Peeters 2004 (CUIDADO §6.1.2) defines the spectral decrease
 * as
 *
 *   decrease = (1 / sum_{k=2..K} P[k])
 *              * sum_{k=2..K} (P[k] - P[1]) / (k - 1).
 *
 * Sign and interpretation:
 *   - **decrease < 0**: every higher-bin power `P[k]` for
 *     `k >= 2` sits below `P[1]` on average (with `1/(k-1)`
 *     weighting that emphasizes the immediate drop from `k=1`
 *     to `k=2`). The PSD genuinely *decreases* from the
 *     fundamental. Typical for sources whose per-row token
 *     sequences carry strong low-frequency mass with a
 *     monotone-ish decline toward high frequencies.
 *   - **decrease ~ 0**: higher-bin powers are on average
 *     comparable to `P[1]`. The PSD holds up roughly flat
 *     past the first bin (broadband-on-band).
 *   - **decrease > 0**: higher-bin powers exceed `P[1]` on
 *     average. The PSD does NOT decrease away from bin 1 —
 *     mass is piled higher up the band (a high-pass-shaped
 *     sequence around its mean).
 *
 * Note that the denominator is `sum_{k=2..K} P[k]`
 * (deliberately excluding bin 1) so the descriptor is
 * dimensionless on the high-frequency mass; the numerator's
 * `(P[k] - P[1])` term anchors the comparison at bin 1.
 *
 * Reported quantities:
 *   - `bins`        : K = floor(n/2). >= 2 by gate.
 *   - `totalPower`  : sum_{k=1..K} P[k] (full one-sided non-DC
 *                     power; reported for cross-lens
 *                     comparability with other PSD lenses).
 *   - `firstBinPower`: P[1] (the anchor bin power; reported
 *                      because the sign of `decrease` is
 *                      determined relative to it).
 *   - `tailPower`   : sum_{k=2..K} P[k] (the descriptor's
 *                     denominator; reported because
 *                     `decrease` is undefined when this is 0
 *                     and the operator wants to see why a
 *                     source dropped under
 *                     `droppedConstantSeries`).
 *   - `decrease`    : Peeters 2004 spectral decrease (the
 *                     headline; dimensionless ratio).
 *
 * Citation: Peeters, G. (2004), "A large set of audio features
 * for sound description (similarity and classification) in the
 * CUIDADO project", IRCAM Tech. Rep., §6.1.2 — spectral
 * decrease as a perceptually-motivated PSD slope-from-anchor
 * descriptor with `1/(k-1)` weighting that de-emphasizes the
 * high-frequency tail relative to the immediate drop past
 * the fundamental. See also Lerch, A. (2012), "An Introduction
 * to Audio Content Analysis", Wiley/IEEE Press, §3.3.1
 * (Spectral Slope and Decrease).
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-centroid** (0.6.148): centroid is the
 *     1st *moment* (a location summary across the whole
 *     PSD). Decrease is a *slope-from-anchor* summary tied
 *     to bin 1 specifically, with a `1/(k-1)` weighting that
 *     no centroid computation has. Two PSDs with identical
 *     centroids can have very different decrease values: a
 *     PSD with mass at bins {1, K-1} (low-frequency anchor
 *     dominant + a far high-bin peak) gives a strongly
 *     positive decrease while a PSD with mass at bins
 *     {K/2 - 5, K/2 + 5} (no mass at bin 1, symmetric around
 *     centroid) gives a near-zero decrease — same centroid,
 *     opposite sign decrease.
 *   - vs. **spectral-bandwidth / -skewness / -kurtosis**
 *     (0.6.150 / 0.6.151-153 / 0.6.153-155): all three are
 *     central moments computed *around the centroid*. Decrease
 *     is anchored at bin 1, NOT at the centroid, and uses the
 *     specifically-motivated `1/(k-1)` weighting. A PSD that
 *     is perfectly symmetric around its centroid (skewness 0)
 *     can still have a strongly negative decrease if the
 *     centroid sits near bin 1; the central moments are
 *     centroid-relative and cannot detect the bin-1 anchor
 *     drop.
 *   - vs. **spectral-rolloff** (0.6.146): roll-off is a single
 *     CDF *quantile* on the cumulative PSD. Decrease integrates
 *     the *full* tail with `1/(k-1)` weighting, anchored at
 *     bin 1. Two PSDs that share an 85% roll-off bin can have
 *     very different decrease values depending on how mass is
 *     distributed below the rolloff bin and around bin 1.
 *   - vs. **spectral-flatness** (0.6.144): SF is the
 *     geometric/arithmetic mean ratio `G/A` — a global
 *     concentration scalar that is position-blind and
 *     anchor-blind. Decrease is anchor-aware (bin 1) and
 *     position-aware (`1/(k-1)` weighting). A flat PSD on
 *     `[1, K]` and a flat PSD on `[K/2, K]` share the same
 *     flatness but very different decrease values.
 *   - vs. **spectral-entropy** (0.6.155-159): entropy is a
 *     concentration scalar (Shannon on normalized PSD,
 *     bin-permutation-invariant). Decrease depends on bin
 *     ordering and is anchored at bin 1; permuting bins
 *     leaves entropy unchanged but flips decrease.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise PSD
 *     *log-log slope* across decades. Decrease is a linear
 *     `1/(k-1)`-weighted ratio anchored at bin 1; it is
 *     dimensionful in a different way and not collapsible
 *     onto a log-log slope in general.
 *   - vs. **hjorth-mobility / -complexity / TKEO**: all
 *     non-central / non-anchored sign-blind energy summaries.
 *     Decrease is sign-bearing and anchored.
 *   - vs. **autocorrelation (lag-1) / mann-kendall / runs /
 *     turning-point**: time-domain summaries; one lag, one
 *     trend statistic, or scalar event tallies; lose the PSD
 *     entirely.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic; lose the PSD entirely.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     skewness, kurtosis, gini, crest-factor, burstiness)**:
 *     amplitude domain, order-invariant. Decrease is a PSD
 *     descriptor — order-sensitive.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, total
 *     power 0, `K < 2`, or tail power
 *     `sum_{k=2..K} P[k] <= 0`): surfaces under
 *     `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralDecreaseSort =
  | 'decrease-asc'
  | 'decrease-desc'
  | 'abs-decrease-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralDecreaseOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2).
   * Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Optional lower bound on reported `decrease`. Sources whose
   * value is strictly below this threshold are suppressed and
   * counted under `droppedBelowMinDecrease`. Useful to surface
   * only sources whose PSD does not fall too steeply away from
   * bin 1 — e.g. `--min-decrease -0.5` excludes the most
   * strongly-low-frequency-anchored sources.
   */
  minDecrease?: number | null;
  /**
   * Optional upper bound on reported `decrease`. Symmetric
   * counterpart. Surfaces in `droppedAboveMaxDecrease`. Useful
   * to surface only sources whose PSD genuinely decreases away
   * from bin 1 — e.g. `--max-decrease 0` excludes any source
   * whose mass piles higher up the band.
   *
   * If both are set and `minDecrease > maxDecrease`, the
   * constructor throws — operator error, not a silent empty
   * report.
   */
  maxDecrease?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'decrease-asc' (default): most-negative decrease first
   *                               (PSD drops most steeply away
   *                               from bin 1).
   *   - 'decrease-desc':         most-positive decrease first
   *                               (PSD rises away from bin 1).
   *   - 'abs-decrease-desc':     |decrease| desc — strongest
   *                               departure from "PSD holds up
   *                               flat past bin 1" in either
   *                               direction first.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralDecreaseSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralDecreaseRow {
  source: string;
  rowsKept: number;
  /** Number of one-sided non-DC frequency bins used (= floor(n/2)). */
  bins: number;
  /** Total non-DC spectral power (sum of |X[k]|^2 for k=1..bins). */
  totalPower: number;
  /** P[1] — the anchor bin power. */
  firstBinPower: number;
  /** sum_{k=2..bins} P[k] — the descriptor's denominator. */
  tailPower: number;
  /** Peeters 2004 spectral decrease (dimensionless). */
  decrease: number;
}

export interface SourceRowTokenSpectralDecreaseReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  minDecrease: number | null;
  maxDecrease: number | null;
  sort: SourceRowTokenSpectralDecreaseSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowMinDecrease: number;
  droppedAboveMaxDecrease: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralDecreaseRow[];
}

const VALID_SORTS = [
  'decrease-asc',
  'decrease-desc',
  'abs-decrease-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralDecrease(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralDecreaseOptions = {},
): SourceRowTokenSpectralDecreaseReport {
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
  const minDecrease = opts.minDecrease ?? null;
  if (minDecrease !== null) {
    if (!Number.isFinite(minDecrease)) {
      throw new Error(
        `minDecrease must be a finite number (got ${opts.minDecrease})`,
      );
    }
  }
  const maxDecrease = opts.maxDecrease ?? null;
  if (maxDecrease !== null) {
    if (!Number.isFinite(maxDecrease)) {
      throw new Error(
        `maxDecrease must be a finite number (got ${opts.maxDecrease})`,
      );
    }
  }
  if (
    minDecrease !== null &&
    maxDecrease !== null &&
    minDecrease > maxDecrease
  ) {
    throw new Error(
      `minDecrease (${minDecrease}) must be <= maxDecrease (${maxDecrease})`,
    );
  }
  const sort = opts.sort ?? 'decrease-asc';
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

  const allRows: SourceRowTokenSpectralDecreaseRow[] = [];

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

    const firstBinPower = power[0]!;
    let tailPower = 0;
    let weightedDiff = 0;
    for (let k = 2; k <= bins; k++) {
      const p = power[k - 1]!;
      tailPower += p;
      weightedDiff += (p - firstBinPower) / (k - 1);
    }

    if (tailPower <= 0 || !Number.isFinite(tailPower)) {
      droppedConstantSeries += 1;
      continue;
    }

    const decrease = weightedDiff / tailPower;

    if (
      !Number.isFinite(decrease) ||
      !Number.isFinite(firstBinPower) ||
      !Number.isFinite(tailPower)
    ) {
      droppedDegenerate += 1;
      continue;
    }

    allRows.push({
      source,
      rowsKept: n,
      bins,
      totalPower: sumPower,
      firstBinPower,
      tailPower,
      decrease,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'decrease-asc') {
      primary = a.decrease - b.decrease;
    } else if (sort === 'decrease-desc') {
      primary = b.decrease - a.decrease;
    } else if (sort === 'abs-decrease-desc') {
      primary = Math.abs(b.decrease) - Math.abs(a.decrease);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinDecrease = 0;
  let droppedAboveMaxDecrease = 0;
  let postRows = allRows;
  if (minDecrease !== null || maxDecrease !== null) {
    const kept: SourceRowTokenSpectralDecreaseRow[] = [];
    for (const row of postRows) {
      if (minDecrease !== null && row.decrease < minDecrease) {
        droppedBelowMinDecrease += 1;
        continue;
      }
      if (maxDecrease !== null && row.decrease > maxDecrease) {
        droppedAboveMaxDecrease += 1;
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
    minDecrease,
    maxDecrease,
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
    droppedBelowMinDecrease,
    droppedAboveMaxDecrease,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
