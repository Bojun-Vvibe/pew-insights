/**
 * daily-token-spectral-contrast: per-source SPECTRAL CONTRAST
 * (mean-of-top-quartile minus mean-of-bottom-quartile, in
 * log-power space, averaged over LOG-SPACED sub-bands of the
 * one-sided non-DC periodogram of the gap-filled mean-centred
 * daily total_tokens series).
 *
 * ONE-HUNDRED-AND-SECOND cross-source axis.
 *
 * Definition. Let P[k] for k = 1..K = floor(n/2) be the
 * one-sided periodogram of the gap-filled mean-centred series
 * (same construction used by axes 86-101). Partition the bin
 * index range [1, K] into B contiguous LOG-SPACED sub-bands
 * b = 1..B with edges
 *     e[b] = round(K^(b/B))            (with e[0] = 0)
 * so that band b owns bins (e[b-1], e[b]]. Within each band b
 * with at least four bins, sort the bin powers ascending,
 * compute
 *     vTop[b]    = mean of the top    ceil(|band|/4) bins
 *     vBottom[b] = mean of the bottom ceil(|band|/4) bins
 *     contrast[b] = log(vTop[b] + eps) - log(vBottom[b] + eps)
 * with eps = 1e-30 to guard log(0). The headline statistic is
 *     contrastMean = (1/Bvalid) * sum_{b valid} contrast[b]
 * the AVERAGE peak-vs-valley LOG-power gap across the log-
 * spaced sub-bands. Bands with fewer than four bins are
 * dropped and surfaced as nBandsDropped.
 *
 * This is the standard MFCC-flavoured "spectral contrast"
 * primitive (Jiang et al., "Music type classification by
 * spectral contrast feature", ICME 2002, eq. 4-5), reduced
 * to a single scalar by averaging the per-band contrasts.
 *
 * contrastMean is in [0, +inf). It is 0 iff every band is
 * locally flat (all bins in the band equal); it grows without
 * bound as any band acquires a sharp peak-vs-valley gap.
 * Reported alongside contrastMean:
 *   - contrastMax   (loudest peak-vs-valley band)
 *   - contrastMin   (flattest band)
 *   - nBandsValid   (bands with >= 4 bins, used in the mean)
 *   - nBandsDropped (bands too narrow to compute a top/bottom
 *                    quartile)
 *
 * Headline question:
 * **"For each source, on a band-local basis (log-spaced
 *   sub-bands), how large is the peak-vs-valley LOG-power
 *   gap inside each band of its daily-token spectrum?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN AXIS:
 *
 *   - vs ALL Renyi-family axes (99, 100, 101) and Shannon
 *     axis-69: every Renyi/Shannon entropy on the PSD is BIN-
 *     PERMUTATION INVARIANT. axis-102 is BIN-POSITION
 *     SENSITIVE because it partitions on the bin INDEX (log-
 *     spaced edges). A permuted PSD has IDENTICAL Renyi/Shannon
 *     entropy but generally different per-band top/bottom
 *     quartiles, hence different contrastMean.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis 85,
 *     full-band GM/AM) and `-flatness-tail` (axis 98, upper-
 *     half subset GM/AM): both are GLOBAL or HALF-BAND ratios
 *     in linear space. axis-102 operates on LOG-SPACED LOCAL
 *     SUB-BANDS in LOG-power space, then averages. A spectrum
 *     with one big peak in band 1 and a perfectly flat band 2
 *     has a MEDIUM Wiener flatness, but contrastMean is
 *     dominated by band 1's huge gap and is large; conversely
 *     a uniformly noisy spectrum (random heights, all bands
 *     roughly equally dispersed) has medium contrastMean per
 *     band, but Wiener flatness is far below 1.
 *
 *   - vs `daily-token-spectral-crest-factor` (axis 89, max/mean):
 *     axis-89 is a SINGLE GLOBAL extremum ratio. axis-102 is
 *     averaged over B local extremum ratios (one per band), in
 *     LOG space. A spectrum with one isolated huge bin (high
 *     crest) but no inner-band structure has a moderate
 *     contrastMean (because most bands are locally flat); a
 *     spectrum with B medium peaks (one per band, all the same
 *     size as the crest peak's mean-relative ratio) has the
 *     same crest factor but a much higher contrastMean.
 *
 *   - vs `daily-token-spectral-irregularity` (axis 93,
 *     |P[k]-P[k+1]| / sum P): axis-93 is a NEAREST-NEIGHBOUR
 *     adjacent-bin difference (TV-norm-style). axis-102 is a
 *     QUARTILE-MEAN difference inside log-spaced bands. Two
 *     spectra with the same TV norm can have very different
 *     contrast (one with adjacent bins jittering up/down has
 *     high TV but low contrast within any band; one with a
 *     monotone ramp inside each band has low TV but high
 *     contrast).
 *
 *   - vs `daily-token-spectral-roughness` (axis 95,
 *     Plomp-Levelt dissonance kernel summed over bin pairs):
 *     axis-95 is a fixed-kernel pairwise interaction sum on
 *     the PSD; it is invariant under uniform log-frequency
 *     reparametrisation only locally. axis-102 directly slices
 *     the PSD on log-spaced bin edges and reduces each slice
 *     to a single contrast scalar. Two PSDs with identical
 *     pairwise dissonance can have very different contrastMean.
 *
 *   - vs `daily-token-spectral-decrease` (axis 92, weighted
 *     mean of (P[k]-P[1])/(k-1)) and `-skewness/kurtosis`
 *     (axes 90/91, central moments of the bin-index pmf):
 *     these are CENTROID-BASED moments in LINEAR power. axis-
 *     102 is LOG-power, LOCAL, and quartile-based (robust to
 *     extreme bins inside a band; trimmed by quartile mean).
 *
 *   - vs `daily-token-spectral-bandwidth` (axis 87, sqrt of
 *     centroid-relative second moment) and `-spread-iqr`
 *     (axis 94, percentile-based dispersion of the PSD pmf):
 *     both are GLOBAL dispersion of the bin-index pmf. axis-102
 *     measures within-band power gaps; a spectrum with a wide
 *     bandwidth but flat bands (smooth ramp) has small
 *     contrastMean; one with narrow bandwidth and concentrated
 *     within-band peaks has large contrastMean.
 *
 *   - vs `daily-token-spectral-rolloff` (axis 88, CDF
 *     percentile bin) and `-centroid` (axis 86, first moment):
 *     both summarise the PSD pmf with a SINGLE bin index.
 *     axis-102 produces B per-band scalars and averages.
 *
 *   - vs `daily-token-spectral-peak-frequency` (axis 96) and
 *     `-second-peak-frequency` (axis 97): both are DISCRETE
 *     argmax-style indices. axis-102 is a CONTINUOUS log-power
 *     gap inside each band. Two spectra with the same argmax
 *     and second-argmax bins can have arbitrarily different
 *     within-band contrast (e.g. peak bin sits next to a
 *     valley vs next to another near-peak bin).
 *
 *   - vs `daily-token-dft-power-law-slope` (axis 84, OLS slope
 *     of log P on log k): axis-84 reduces the entire spectrum
 *     to a SINGLE scaling exponent. axis-102 keeps band-local
 *     deviation around any global trend. A pure 1/f^alpha
 *     spectrum has a well-defined slope but contrastMean ~ 0
 *     within each band (each band is approximately a smooth
 *     local power-law slice with low quartile spread). A
 *     1/f^alpha spectrum WITH band-local notches has the same
 *     slope but contrastMean strictly positive.
 *
 *   - vs all amplitude-shape axes 32-67 (Gini, Atkinson,
 *     Theil, GE, Hill, Bowley, Mehran, Wolfson, Kolm-Pollak,
 *     Kakwani, ...): those are TIME-DOMAIN amplitude
 *     concentration. axis-102 is FREQUENCY-DOMAIN, log-spaced
 *     sub-band peak-vs-valley. A shuffle of the daily series
 *     leaves all time-domain shape statistics fixed but
 *     destroys the spectrum.
 *
 *   - vs all per-row spectral axes (`source-row-token-spectral-
 *     entropy/flatness/centroid/...`): those operate on the
 *     PER-ROW token mass distribution; axis-102 operates on
 *     the per-source DAILY-AGGREGATED series. Different
 *     domain, different unit of aggregation.
 *
 * Caveats:
 *
 *   - contrastMean depends on B (band count). The default
 *     B = 6 is the ICME-2002 spectral-contrast convention; we
 *     expose `--bands` so callers can tune it. With very small
 *     K (< 4*B), several bands collapse below the 4-bin
 *     quartile floor and surface as nBandsDropped.
 *
 *   - Bands are right-closed log-spaced: edges
 *     e[b] = max(round(K^(b/B)), e[b-1] + 1). The "+1" keeps
 *     adjacent edges strictly increasing on small K; an explicit
 *     monotonic clamp protects against the integer-rounding tie
 *     at low frequencies. Each band carries at least one bin;
 *     bands with < 4 bins are still dropped from the contrast
 *     average.
 *
 *   - The eps = 1e-30 floor under each log() suppresses
 *     log(0) on bands where the bottom quartile is identically
 *     zero. The resulting contrast saturates at log((vTop +
 *     eps) / eps) ~ 70 for any non-tiny vTop, which is a
 *     SOFT cap; we report the saturating bands via
 *     nBandsSaturated for transparency.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (B = 6 log-spaced bands), all sources with at
 *   # least 1000 tokens and 16 days of gap-filled tenure:
 *   pew-insights daily-token-spectral-contrast
 *
 *   # Tighter band partition (B = 8) with a higher tenure
 *   # floor (so K = floor(n/2) >= 16 = 2*B is enforced):
 *   pew-insights daily-token-spectral-contrast \
 *     --bands 8 --min-tenure-days 32
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-spectral-contrast --json
 *
 *   # Restrict to a single source and sort by maximum band:
 *   pew-insights daily-token-spectral-contrast \
 *     --source claude-code --sort contrastMaxDesc
 *
 * References:
 *   Jiang, D.-N., Lu, L., Zhang, H.-J., Tao, J.-H. & Cai,
 *     L.-H., "Music type classification by spectral contrast
 *     feature", Proc. IEEE ICME 2002, vol. 1, pp. 113-116.
 *   Akkermans, V., Serra, J. & Herrera, P., "Shape-based
 *     spectral contrast descriptor", Proc. SMC 2009.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenSpectralContrastSort =
  | 'contrastMean'
  | 'contrastMeanDesc'
  | 'contrastMax'
  | 'contrastMaxDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpectralContrastOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16 so that
   * K = floor(n/2) >= 8 candidate Fourier bins are available
   * (default `bands = 6` needs roughly 4 bins per band so it
   * can produce at least one valid contrast band).
   */
  minTenureDays?: number;
  /**
   * Number of log-spaced sub-bands. Default 6 (ICME-2002
   * convention). Must be a positive integer >= 2.
   */
  bands?: number;
  top?: number;
  sort?: DailyTokenSpectralContrastSort;
  generatedAt?: string;
}

export interface DailyTokenSpectralContrastSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  /** Number of one-sided Fourier bins K = floor(n/2). */
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** Total one-sided power sum_{k=1..K} P[k]. */
  totalPower: number;
  /** Number of log-spaced sub-bands requested. */
  nBandsRequested: number;
  /** Number of bands with >= 4 bins (used in contrastMean). */
  nBandsValid: number;
  /** Number of bands dropped (< 4 bins). */
  nBandsDropped: number;
  /** Number of valid bands whose vBottom == 0 (saturated by eps floor). */
  nBandsSaturated: number;
  /** Mean per-band log-power contrast (top quartile - bottom quartile). */
  contrastMean: number;
  /** Max per-band contrast. */
  contrastMax: number;
  /** Min per-band contrast. */
  contrastMin: number;
}

export interface DailyTokenSpectralContrastReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  bands: number;
  top: number;
  sort: DailyTokenSpectralContrastSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPower: number;
  droppedNoValidBand: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenSpectralContrastSourceRow[];
}

const EPS_LOG = 1e-30;

/**
 * Compute log-spaced bin edges e[0]=0, e[B]=K with monotone
 * non-decreasing rounding. Returns an array of length B+1.
 *
 * Closed-form anchors:
 *   - K = B: returns [0, 1, 2, ..., B].
 *   - K = 1, B >= 2: every band has 0 bins after the first
 *     (the monotone clamp gives [0, 1, 2, ...] but the tail
 *     cannot exceed K = 1; the helper instead pins e[B] = K).
 */
export function logSpacedBinEdges(k: number, b: number): number[] {
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`logSpacedBinEdges: K must be a positive integer (got ${k})`);
  }
  if (!Number.isInteger(b) || b < 2) {
    throw new Error(`logSpacedBinEdges: bands must be an integer >= 2 (got ${b})`);
  }
  const edges = new Array<number>(b + 1);
  edges[0] = 0;
  for (let i = 1; i <= b; i += 1) {
    let e = Math.round(Math.pow(k, i / b));
    if (e < edges[i - 1]! + 1) e = edges[i - 1]! + 1;
    if (e > k) e = k;
    edges[i] = e;
  }
  // Force the last edge exactly to K so the partition is total.
  edges[b] = k;
  // Re-clamp from the top down so monotonicity holds even when
  // K is small enough that the upward clamp pushed past K.
  for (let i = b - 1; i >= 1; i -= 1) {
    if (edges[i]! > edges[i + 1]!) edges[i] = edges[i + 1]!;
  }
  return edges;
}

/**
 * Spectral-contrast primitive on a non-negative power vector.
 * Returns the mean / max / min per-band log-power contrast and
 * counts of valid / dropped / saturated bands.
 *
 * Closed-form sanity anchors:
 *   - power = uniform: every band is locally flat -> all
 *     valid contrasts are 0 -> contrastMean = 0.
 *   - power = single huge bin in one band, zeros elsewhere:
 *     that band has vBottom = 0 (saturated), other bands are
 *     all-zero (vTop = vBottom = 0 -> contrast = 0). The
 *     saturated band's contrast ~= log((peak + eps) / eps).
 *
 * Throws on too-few-bins (< 2 * bands), non-finite power,
 * negative power, or zero total power.
 */
export function spectralContrast(
  power: number[],
  bands: number,
): {
  contrastMean: number;
  contrastMax: number;
  contrastMin: number;
  nBandsValid: number;
  nBandsDropped: number;
  nBandsSaturated: number;
  totalPower: number;
} {
  const k = power.length;
  if (!Number.isInteger(bands) || bands < 2) {
    throw new Error(`spectralContrast: bands must be an integer >= 2 (got ${bands})`);
  }
  if (k < bands) {
    throw new Error(
      `spectralContrast: too few bins (K=${k}, bands=${bands}; need K >= bands)`,
    );
  }
  let s = 0;
  for (let i = 0; i < k; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(`spectralContrast: non-finite power at index ${i} (${p})`);
    }
    if (p < 0) {
      throw new Error(`spectralContrast: negative power at index ${i} (${p})`);
    }
    s += p;
  }
  if (!(s > 0)) {
    throw new Error(`spectralContrast: zero total power (S=${s})`);
  }
  const edges = logSpacedBinEdges(k, bands);
  let nValid = 0;
  let nDropped = 0;
  let nSaturated = 0;
  let sumContrast = 0;
  let maxContrast = -Infinity;
  let minContrast = +Infinity;
  for (let b = 1; b <= bands; b += 1) {
    const lo = edges[b - 1]!; // exclusive
    const hi = edges[b]!; // inclusive
    const width = hi - lo;
    if (width < 4) {
      nDropped += 1;
      continue;
    }
    const slice = new Array<number>(width);
    for (let i = 0; i < width; i += 1) {
      slice[i] = power[lo + i]!;
    }
    slice.sort((x, y) => x - y);
    const q = Math.max(1, Math.ceil(width / 4));
    let topSum = 0;
    let botSum = 0;
    for (let i = 0; i < q; i += 1) {
      botSum += slice[i]!;
      topSum += slice[width - 1 - i]!;
    }
    const vTop = topSum / q;
    const vBot = botSum / q;
    if (!Number.isFinite(vTop) || !Number.isFinite(vBot)) {
      throw new Error(
        `spectralContrast: non-finite quartile mean in band ${b} (vTop=${vTop}, vBot=${vBot})`,
      );
    }
    if (vBot <= 0) nSaturated += 1;
    const contrast = Math.log(vTop + EPS_LOG) - Math.log(vBot + EPS_LOG);
    sumContrast += contrast;
    if (contrast > maxContrast) maxContrast = contrast;
    if (contrast < minContrast) minContrast = contrast;
    nValid += 1;
  }
  if (nValid === 0) {
    throw new Error(
      `spectralContrast: no valid band (every band had < 4 bins; K=${k}, bands=${bands})`,
    );
  }
  const contrastMean = sumContrast / nValid;
  return {
    contrastMean,
    contrastMax: maxContrast,
    contrastMin: minContrast,
    nBandsValid: nValid,
    nBandsDropped: nDropped,
    nBandsSaturated: nSaturated,
    totalPower: s,
  };
}

/**
 * Daily-token spectral-contrast primitive on a real-valued
 * series. Computes the one-sided periodogram and applies
 * `spectralContrast` to the resulting bin power vector.
 *
 * Throws when the series is too short, non-finite, zero-
 * variance, yields zero total power, or has no band wide
 * enough to compute a quartile mean.
 */
export function dailyTokenSpectralContrast(
  values: number[],
  bands: number,
): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  contrastMean: number;
  contrastMax: number;
  contrastMin: number;
  nBandsValid: number;
  nBandsDropped: number;
  nBandsSaturated: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenSpectralContrast: series too short (n=${n}, need n >= 4)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('dailyTokenSpectralContrast requires finite values');
    }
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error(
      'dailyTokenSpectralContrast: zero variance (constant series)',
    );
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let varSum = 0;
  for (const v of values) {
    const d = v - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const power = periodogramOneSided(values);
  const result = spectralContrast(power, bands);
  if (
    !Number.isFinite(result.contrastMean) ||
    !Number.isFinite(result.contrastMax) ||
    !Number.isFinite(result.contrastMin)
  ) {
    throw new Error(
      `dailyTokenSpectralContrast: non-finite output (contrastMean=${result.contrastMean})`,
    );
  }
  return {
    mean: mu,
    stddev,
    nFreqBins: power.length,
    totalPower: result.totalPower,
    contrastMean: result.contrastMean,
    contrastMax: result.contrastMax,
    contrastMin: result.contrastMin,
    nBandsValid: result.nBandsValid,
    nBandsDropped: result.nBandsDropped,
    nBandsSaturated: result.nBandsSaturated,
  };
}

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenSpectralContrast(
  queue: QueueLine[],
  opts: DailyTokenSpectralContrastOptions = {},
): DailyTokenSpectralContrastReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const bands = opts.bands ?? 6;
  if (!Number.isInteger(bands) || bands < 2) {
    throw new Error(`bands must be an integer >= 2 (got ${opts.bands})`);
  }
  const minTenureDays = opts.minTenureDays ?? 16;
  // Hard floor: K = floor(n/2) must be >= bands so at least one
  // band can host >= 4 bins.
  const minFloor = 2 * bands;
  if (!Number.isInteger(minTenureDays) || minTenureDays < minFloor) {
    throw new Error(
      `minTenureDays must be an integer >= ${minFloor} (= 2*bands; got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpectralContrastSort = opts.sort ?? 'contrastMeanDesc';
  const validSorts: DailyTokenSpectralContrastSort[] = [
    'contrastMean',
    'contrastMeanDesc',
    'contrastMax',
    'contrastMaxDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface SrcAcc {
    perDay: Map<string, number>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.perDay.set(day, (acc.perDay.get(day) ?? 0) + tt);
    acc.totalTokens += tt;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedZeroPower = 0;
  let droppedNoValidBand = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenSpectralContrastSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(acc.firstDay, acc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = acc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = acc.perDay.get(cursor) ?? 0;
      cursor = addUtcDays(cursor, 1);
    }
    let mn = filled[0]!;
    let mx = filled[0]!;
    for (let i = 1; i < nTenure; i += 1) {
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenSpectralContrast(filled, bands);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('zero total power')) {
        droppedZeroPower += 1;
      } else if (msg.includes('no valid band')) {
        droppedNoValidBand += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      nFreqBins: result.nFreqBins,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      totalPower: result.totalPower,
      nBandsRequested: bands,
      nBandsValid: result.nBandsValid,
      nBandsDropped: result.nBandsDropped,
      nBandsSaturated: result.nBandsSaturated,
      contrastMean: result.contrastMean,
      contrastMax: result.contrastMax,
      contrastMin: result.contrastMin,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'contrastMean':
        primary = a.contrastMean - b.contrastMean;
        break;
      case 'contrastMeanDesc':
        primary = b.contrastMean - a.contrastMean;
        break;
      case 'contrastMax':
        primary = a.contrastMax - b.contrastMax;
        break;
      case 'contrastMaxDesc':
        primary = b.contrastMax - a.contrastMax;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
      default:
        primary = 0;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
  });

  let droppedTopSources = 0;
  let kept = rows;
  if (top > 0 && rows.length > top) {
    droppedTopSources = rows.length - top;
    kept = rows.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    bands,
    top,
    sort,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinTenure,
    droppedZeroVariance,
    droppedZeroPower,
    droppedNoValidBand,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
