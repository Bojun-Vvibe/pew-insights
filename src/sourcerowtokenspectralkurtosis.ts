/**
 * source-row-token-spectral-kurtosis: per-source **spectral
 * kurtosis** of the per-row `total_tokens` sequence.
 *
 * Headline question: **for each source, how peaked / heavy-tailed
 * is the per-row token PSD around its centroid relative to a
 * reference Gaussian-shaped PSD?** This is the 4th standardized
 * central moment of the one-sided non-DC power spectrum, the
 * orthogonal companion to:
 *   - `source-row-token-spectral-centroid`  (1st moment / location)
 *   - `source-row-token-spectral-bandwidth` (2nd central moment / spread)
 *   - `source-row-token-spectral-skewness`  (3rd standardized central
 *                                             moment / asymmetry)
 *
 * Centroid says *where* the PSD mass sits, bandwidth says *how
 * spread* it is, skewness says *which side* the tail leans, and
 * kurtosis says *how peaked vs. how heavy-tailed* the PSD is
 * around the centroid — a sign-blind, location-blind, scale-blind
 * descriptor of PSD shape.
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
 * and fourth central moment
 *
 *   m4  = sum_k (k - c)^4 * P[k] / sum_k P[k],
 *
 * the **standardized spectral kurtosis** is reported in the
 * Pearson form
 *
 *   kurtosis  = m4 / m2^2,
 *
 * and the **excess** form (Fisher convention; Gaussian baseline 3)
 *
 *   excess    = kurtosis - 3.
 *
 * Reported quantities:
 *   - `centroidBin`     : first-moment bin (real); recomputed
 *                         inline so the four-moment quartet stays
 *                         internally consistent.
 *   - `bandwidthBin`    : sqrt(m2); bin-units. Reported because
 *                         `kurtosis` is undefined when this is 0.
 *   - `m4`              : raw fourth central moment; bin^4 units.
 *                         Useful as a sanity check on magnitude.
 *   - `kurtosis`        : `m4 / m2^2`. Always `>= 1` (Cauchy-Schwarz);
 *                         large values => sharply peaked PSD with
 *                         heavy tails around the centroid;
 *                         values near 1.8 indicate a uniform-on-band
 *                         PSD (the kurtosis of a uniform
 *                         distribution); values near 3 indicate a
 *                         Gaussian-shaped PSD.
 *   - `excess`          : `kurtosis - 3`. Positive => leptokurtic
 *                         (more peaked / heavier-tailed than
 *                         Gaussian); negative => platykurtic
 *                         (flatter-topped / lighter-tailed than
 *                         Gaussian).
 *
 * Citation: Antoni, J. (2006), "The spectral kurtosis: a useful
 * tool for characterising non-stationary signals", Mech. Syst.
 * Signal Process., 20(2), 282-307 — the canonical reference for
 * spectral kurtosis as a non-stationarity / impulsiveness
 * descriptor in vibration & condition monitoring. See also
 * Peeters, G. (2004), "A large set of audio features for sound
 * description (similarity and classification) in the CUIDADO
 * project", IRCAM Tech. Rep., §6.1.4 — fourth central moment of
 * the power spectrum as the canonical spectral peakedness
 * descriptor; Lerch, A. (2012), "An Introduction to Audio Content
 * Analysis", Wiley/IEEE Press, §3.3.2 (Spectral Kurtosis); and
 * Joanes & Gill (1998), "Comparing measures of sample skewness
 * and kurtosis", J. Royal Stat. Soc. Series D, 47(1), 183-189
 * for the Pearson vs Fisher (excess) conventions.
 *
 * Why this lens is **genuinely orthogonal** to every other
 * `source-row-token-*` lens already in the suite:
 *
 *   - vs. **spectral-skewness** (0.6.152): skewness is the *3rd*
 *     standardized central moment (sign-bearing, asymmetry).
 *     Kurtosis is the *4th* standardized central moment
 *     (sign-blind, peakedness/tail-weight). Two PSDs with
 *     identical skewness can have wildly different kurtosis: a
 *     symmetric two-tone PSD around the centroid has skewness 0
 *     and kurtosis ~1; a symmetric PSD with mass piled at the
 *     centroid plus thin symmetric tails has skewness 0 and
 *     kurtosis >> 3. Asymmetry vs. peakedness — orthogonal.
 *   - vs. **spectral-bandwidth** (0.6.150): bandwidth is the
 *     *2nd* central moment (spread). Kurtosis divides the *4th*
 *     central moment by the *square* of the second, deliberately
 *     scaling spread out so only shape (peakedness vs. flatness)
 *     remains. Two PSDs with identical bandwidth can have very
 *     different kurtosis (uniform-on-band ~1.8 vs. spike-at-
 *     centroid >> 3). Spread vs. *shape* of spread.
 *   - vs. **spectral-centroid** (0.6.148): centroid is location
 *     only. Kurtosis is location-blind: shifting the PSD along
 *     the bin axis leaves kurtosis invariant.
 *   - vs. **spectral-rolloff** (0.6.146): roll-off is a single
 *     CDF *quantile*. Kurtosis is a fourth-moment summary of the
 *     whole PSD shape.
 *   - vs. **spectral-flatness** (0.6.144): SF is the geometric/
 *     arithmetic mean ratio `G/A` of `P[k]` — a position-blind
 *     entropy-like ratio with range `[0, 1]`. Kurtosis is also
 *     position-blind but is a moment-based, unbounded
 *     peakedness summary; the two diverge when the PSD has heavy
 *     tails around a strong centroid (high kurtosis but moderate
 *     flatness) versus uniform-on-band (low kurtosis ~1.8 with
 *     flatness ~1).
 *   - vs. **hjorth-mobility / hjorth-complexity / TKEO**:
 *     Hjorth-mobility is sqrt of a *non-central* second moment.
 *     Hjorth-complexity is a ratio of mobilities. TKEO is a
 *     time-domain f^2-biased energy operator. None capture the
 *     fourth-moment peakedness summary kurtosis provides.
 *   - vs. **autocorrelation (lag-1) / mann-kendall**:
 *     time-domain summaries; integrate one lag or one trend
 *     statistic; lose the PSD entirely.
 *   - vs. **fractal / scaling lenses (DFA, Higuchi-FD,
 *     Katz-FD, Petrosian-FD, Hurst-RS)**: those summarise PSD
 *     *slope* / scaling on a log-log axis. Slope is a
 *     first-moment-like summary of `log P[k]` against `log k`;
 *     kurtosis is a fourth-moment summary of `P[k]` against `k`
 *     on the linear axis. Not collapsible.
 *   - vs. **amplitude-shape lenses (cv, mad, iqr-ratio,
 *     time-domain skewness/kurtosis, gini, crest-factor,
 *     burstiness-coefficient)**: amplitude domain,
 *     order-invariant. Spectral kurtosis here is sensitive to
 *     *sample order* — shuffle the sequence and the spectral
 *     kurtosis changes; amplitude kurtosis does not.
 *   - vs. **time-domain symbolic entropies (approximate,
 *     sample, permutation, renyi, lempel-ziv)**: ordinal /
 *     symbolic reductions; lose the PSD entirely.
 *   - vs. **event counters (zcr, runs-test, turning-point)**:
 *     scalar event tallies; kurtosis is a continuous
 *     fourth-moment summary on bin index.
 *
 * Edge cases:
 *   - `n < minRows`: surfaces under `droppedBelowMinRows`.
 *   - Constant series (all post-centering values 0, or
 *     numerically zero total power, or `K < 2` so a 4th moment
 *     is degenerate, or `m2` numerically 0 so kurtosis is
 *     undefined): surfaces under `droppedConstantSeries`.
 *   - Defensive non-finite computed quantity: surfaces under
 *     `droppedDegenerate`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak in all sort modes is
 * `source` asc.
 */
import type { QueueLine } from './types.js';

export type SourceRowTokenSpectralKurtosisSort =
  | 'kurtosis-asc'
  | 'kurtosis-desc'
  | 'excess-asc'
  | 'excess-desc'
  | 'abs-excess-desc'
  | 'rows'
  | 'source';

export interface SourceRowTokenSpectralKurtosisOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many post-validity rows.
   * Must be an integer `>= 4` (need K = floor(n/2) >= 2 for a
   * meaningful 4th moment, and a non-zero variance to standardize
   * by). Default 8.
   */
  minRows?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Optional lower bound on reported `kurtosis` (Pearson). Sources
   * whose value is strictly below this threshold are suppressed
   * and counted under `droppedBelowMinKurtosis`. Useful to
   * surface only sources whose PSD is sufficiently peaked.
   */
  minKurtosis?: number | null;
  /**
   * Optional upper bound on reported `kurtosis`. Symmetric
   * counterpart. Surfaces in `droppedAboveMaxKurtosis`. Useful to
   * surface only sources whose PSD is sufficiently flat-topped.
   *
   * If both are set and `minKurtosis > maxKurtosis`, the
   * constructor throws — operator error, not a silent empty
   * report.
   */
  maxKurtosis?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'kurtosis-asc':         Pearson kurtosis ascending (least
   *                             peaked / flat-topped first).
   *   - 'kurtosis-desc':        Pearson kurtosis descending (most
   *                             peaked / heavy-tailed first).
   *   - 'excess-asc':           excess kurtosis ascending (most
   *                             platykurtic first).
   *   - 'excess-desc' (default): excess kurtosis descending (most
   *                              leptokurtic first — sharpest peaks
   *                              and heaviest tails relative to
   *                              Gaussian).
   *   - 'abs-excess-desc':      |excess| descending (furthest from
   *                              Gaussian-shaped PSD in either
   *                              direction first).
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: SourceRowTokenSpectralKurtosisSort;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRowTokenSpectralKurtosisRow {
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
  /** Raw 4th central moment (bin^4 units). */
  m4: number;
  /** Pearson spectral kurtosis: m4 / m2^2. Always >= 1. */
  kurtosis: number;
  /** Excess (Fisher) spectral kurtosis: kurtosis - 3. */
  excess: number;
}

export interface SourceRowTokenSpectralKurtosisReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  top: number | null;
  minKurtosis: number | null;
  maxKurtosis: number | null;
  sort: SourceRowTokenSpectralKurtosisSort;
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedInvalidTokens: number;
  droppedNegativeTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedConstantSeries: number;
  droppedDegenerate: number;
  droppedBelowMinKurtosis: number;
  droppedAboveMaxKurtosis: number;
  droppedBelowTopCap: number;
  sources: SourceRowTokenSpectralKurtosisRow[];
}

const VALID_SORTS = [
  'kurtosis-asc',
  'kurtosis-desc',
  'excess-asc',
  'excess-desc',
  'abs-excess-desc',
  'rows',
  'source',
] as const;

export function buildSourceRowTokenSpectralKurtosis(
  queue: QueueLine[],
  opts: SourceRowTokenSpectralKurtosisOptions = {},
): SourceRowTokenSpectralKurtosisReport {
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
  const minKurtosis = opts.minKurtosis ?? null;
  if (minKurtosis !== null) {
    if (!Number.isFinite(minKurtosis)) {
      throw new Error(
        `minKurtosis must be a finite number (got ${opts.minKurtosis})`,
      );
    }
  }
  const maxKurtosis = opts.maxKurtosis ?? null;
  if (maxKurtosis !== null) {
    if (!Number.isFinite(maxKurtosis)) {
      throw new Error(
        `maxKurtosis must be a finite number (got ${opts.maxKurtosis})`,
      );
    }
  }
  if (
    minKurtosis !== null &&
    maxKurtosis !== null &&
    minKurtosis > maxKurtosis
  ) {
    throw new Error(
      `minKurtosis (${minKurtosis}) must be <= maxKurtosis (${maxKurtosis})`,
    );
  }
  const sort = opts.sort ?? 'excess-desc';
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

  const allRows: SourceRowTokenSpectralKurtosisRow[] = [];

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
      // Need at least two bins to have a non-trivial 4th moment.
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
    let m4 = 0;
    for (let k = 1; k <= bins; k++) {
      const d = k - centroidBin;
      const d2 = d * d;
      const p = power[k - 1]!;
      m2 += d2 * p;
      m4 += d2 * d2 * p;
    }
    m2 = m2 / sumPower;
    m4 = m4 / sumPower;
    const bandwidthBin = Math.sqrt(Math.max(0, m2));

    if (!Number.isFinite(m2) || m2 <= 0) {
      // Variance numerically zero -> standardized kurtosis undefined.
      droppedConstantSeries += 1;
      continue;
    }
    const kurtosis = m4 / (m2 * m2);
    const excess = kurtosis - 3;

    if (
      !Number.isFinite(centroidBin) ||
      !Number.isFinite(bandwidthBin) ||
      !Number.isFinite(m4) ||
      !Number.isFinite(kurtosis) ||
      !Number.isFinite(excess) ||
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
      m4,
      kurtosis,
      excess,
    });
  }

  allRows.sort((a, b) => {
    let primary = 0;
    if (sort === 'kurtosis-asc') {
      primary = a.kurtosis - b.kurtosis;
    } else if (sort === 'kurtosis-desc') {
      primary = b.kurtosis - a.kurtosis;
    } else if (sort === 'excess-asc') {
      primary = a.excess - b.excess;
    } else if (sort === 'excess-desc') {
      primary = b.excess - a.excess;
    } else if (sort === 'abs-excess-desc') {
      primary = Math.abs(b.excess) - Math.abs(a.excess);
    } else if (sort === 'rows') {
      primary = b.rowsKept - a.rowsKept;
    } else {
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinKurtosis = 0;
  let droppedAboveMaxKurtosis = 0;
  let postRows = allRows;
  if (minKurtosis !== null || maxKurtosis !== null) {
    const kept: SourceRowTokenSpectralKurtosisRow[] = [];
    for (const row of postRows) {
      if (minKurtosis !== null && row.kurtosis < minKurtosis) {
        droppedBelowMinKurtosis += 1;
        continue;
      }
      if (maxKurtosis !== null && row.kurtosis > maxKurtosis) {
        droppedAboveMaxKurtosis += 1;
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
    minKurtosis,
    maxKurtosis,
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
    droppedBelowMinKurtosis,
    droppedAboveMaxKurtosis,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
