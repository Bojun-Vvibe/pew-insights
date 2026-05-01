/**
 * daily-token-hjorth-mobility: per-source Hjorth Mobility parameter
 * (Hjorth, B., "EEG analysis based on time domain properties",
 * Electroencephalography and Clinical Neurophysiology 29(3):306-310,
 * 1970) on the gap-filled daily total_tokens series.
 *
 * SEVENTY-NINTH cross-source axis.
 *
 * For each source, build the per-UTC-day total_tokens series across
 * the source's tenure [firstActiveDay, lastActiveDay]. Missing
 * calendar days INSIDE that tenure are filled with 0 tokens (same
 * gap-fill convention as axes 67/68/69/70/71/72/73/74/75/76/77/78).
 *
 * Hjorth Mobility procedure (single-scale variance ratio):
 *
 *   1. Compute first differences:
 *        d[i] = y[i+1] - y[i]   for i = 0..N-2     (length N-1)
 *
 *   2. Compute population variances (Hjorth's original 1970
 *      definition uses population variance / mean-square deviation
 *      around the sample mean -- not Bessel-corrected):
 *        var_v  = (1/N)     * sum_{i=0..N-1} (y[i] - mean(y))^2
 *        var_dv = (1/(N-1)) * sum_{i=0..N-2} (d[i] - mean(d))^2
 *
 *   3. mobility = sqrt(var_dv / var_v)
 *
 * Defaults: `min-tenure-days = 32`, `min-tokens = 1000`. The
 * minimum tenure floor of 4 ensures at least 3 first-difference
 * samples for a meaningful var_dv estimate.
 *
 * Reading mobility:
 *   - mobility ~ 0       = step-to-step changes negligible vs the
 *                          overall variance (slowly varying / DC-
 *                          like series).
 *   - mobility ~ 1       = consecutive samples share roughly half
 *                          their variance with a one-step neighbour
 *                          (analytically equivalent to lag-1
 *                          autocorrelation rho_1 = 0.5 under the
 *                          stationarity / large-N approximation
 *                          mobility^2 ~ 2*(1 - rho_1)).
 *   - mobility ~ sqrt(2) ~ 1.414 = pure white noise (consecutive
 *                          samples uncorrelated; rho_1 ~ 0).
 *   - mobility > sqrt(2) = anti-correlated / oscillatory at the
 *                          one-step scale (rho_1 < 0).
 *
 *   - Mobility is SCALE-INVARIANT (multiplying every y by k > 0
 *     scales both var_v and var_dv by k^2; the ratio survives).
 *   - Mobility is SHIFT-INVARIANT (adding a constant cancels in
 *     both variances).
 *   - Mobility is NOT SHUFFLE-INVARIANT: shuffling y leaves var_v
 *     unchanged but typically inflates var_dv -> mobility rises.
 *
 * STRUCTURAL ORTHOGONALITY -- SINGLE-SCALE VARIANCE RATIO BETWEEN
 * THE SERIES AND ITS FIRST DIFFERENCE, fundamentally distinct from
 * every shipped daily-token axis 32..78:
 *
 *   - vs `daily-token-box-count-fd` (axis 78): BFD is a MULTI-
 *     SCALE OLS log-log slope on 2D box coverage of the double-
 *     normalised waveform. Mobility is a SINGLE-SCALE closed-form
 *     variance ratio. BFD requires a geometric grid ladder and an
 *     OLS fit; mobility is one number from two sample variances.
 *     They diverge sharply on series with one extreme outlier:
 *     box coverage at coarse m sees one extra column (BFD ~
 *     unchanged) but one big jump dominates var_dv (mobility
 *     rises substantially).
 *
 *   - vs `daily-token-sevcik-fd` (axis 77): SFD is a single-scale
 *     log-domain ratio of path length L to its smooth lower bound
 *     2*(N-1) on the double-normalised waveform. Mobility is a
 *     LINEAR-DOMAIN ratio of TWO SAMPLE VARIANCES on the RAW (not
 *     normalised) series. Both are single-scale but probe
 *     different statistics: SFD is a geometric path measure
 *     (length-per-segment in unit-square coords), mobility is a
 *     second-moment ratio (var of derivative vs var of signal).
 *     SFD on a constant series is undefined (zero range);
 *     mobility on a constant series is undefined (zero variance) --
 *     handled symmetrically as droppedZeroVariance.
 *
 *   - vs `daily-token-petrosian-fd` (axis 76): PFD counts SIGN
 *     CHANGES in the first-difference sequence. Mobility uses the
 *     MAGNITUDE of those first differences (their variance). Two
 *     series with identical sign-change patterns can have wildly
 *     different mobilities: a uniform-step zigzag and an
 *     amplitude-modulated zigzag share PFD exactly but mobility
 *     is dominated by the amplitude envelope.
 *
 *   - vs `daily-token-katz-fd` (axis 75): KFD uses RAW path length
 *     and RAW max chord d. Mobility uses VARIANCES (squared
 *     deviations summed). KFD weights extreme excursions through
 *     the d denominator; mobility weights them quadratically in
 *     var_dv.
 *
 *   - vs `daily-token-higuchi-fd` (axis 74): HFD is a multi-scale
 *     OLS slope on stride-k subsampled path lengths L(k).
 *     Mobility is single-scale and uses no subsampling.
 *
 *   - vs `daily-token-hurst-rs` (axis 71) / `daily-token-dfa-
 *     alpha` (axis 72): both are MULTI-SCALE variance-scaling
 *     estimators on cumulative deviations (DFA additionally
 *     detrends each window). Mobility is SINGLE-SCALE and
 *     operates directly on first differences with no cumulative
 *     transform.
 *
 *   - vs `daily-token-autocorrelation-lag1` (axis 67): mobility
 *     and rho_1 are linked by the large-N, mean-zero, weak-
 *     stationarity approximation
 *
 *         mobility^2 = 2 * (1 - rho_1) * var_v_norm
 *
 *     where var_v_norm collapses to 1 in the canonical theoretical
 *     setting. So mobility is a DISTINCT-BUT-RELATED scalar that
 *     captures the SAME directional information at the small-
 *     deviation limit but uses a DIFFERENT empirical estimator
 *     (population variance of diffs vs lag-1 covariance / variance).
 *     The two diverge on series where the equality assumptions
 *     break down (non-zero mean dominated by drift, marked
 *     non-stationarity, heavy-tailed step distribution). Mobility
 *     additionally surfaces an absolute-amplitude reading via
 *     `varDv` and `varV` whereas rho_1 is a normalised correlation
 *     in [-1, 1]. The test file ships an explicit witness on a
 *     mean-zero AR(1) showing mobility^2 ~ 2 * (1 - rho_1) within
 *     small-N tolerance, AND a `driftBreaksLink` witness asserting
 *     a strongly drifting series can have mobility and rho_1 that
 *     do not satisfy the canonical equality.
 *
 *   - vs `daily-token-spectral-entropy` (axis 69): SE summarises
 *     the periodogram flatness across all frequencies. Mobility is
 *     proportional to the spectral CENTROID (Hjorth showed in 1970
 *     Eq. 3 that mobility equals the second-moment frequency
 *     omega_1 of the spectrum) -- so mobility is a SPECIFIC
 *     spectral moment whereas SE is a flatness summary across the
 *     entire spectrum. They are independent: a low-entropy spectrum
 *     (concentrated mass) can have arbitrary centroid; a flat
 *     spectrum (high entropy) forces a specific centroid value.
 *
 *   - vs `daily-token-permutation-entropy` (axis 70) / `daily-
 *     token-sample-entropy` (axis 73): pattern / template
 *     statistics on ordinal patterns or amplitude similarity.
 *     Mobility is a pure second-moment scalar with no embedding
 *     window or template matching.
 *
 *   - vs all permutation-invariant dispersion / shape axes 32-67:
 *     they are SHUFFLE-INVARIANT (Gini, Theil, Atkinson, Hoover,
 *     etc., depend only on the multiset of values). Mobility is
 *     SHUFFLE-SENSITIVE: shuffling typically inflates var_dv
 *     because adjacent differences become near-iid, while var_v
 *     is unchanged. The test file ships a `shuffleInflatesMobility`
 *     witness on a slowly-varying series asserting shuffled
 *     mobility >= 1.5x sorted-by-time mobility.
 *
 * INVARIANCES:
 *   - Invariant under SHIFT (y' = y + c).
 *   - Invariant under POSITIVE SCALE (y' = a*y, a > 0).
 *   - Invariant under SIGN FLIP (y' = -y) because variances are
 *     even functions.
 *   - NOT invariant under TIME REVERSAL in general (the diff
 *     variance of a reversed sequence equals the diff variance of
 *     the original, so mobility IS time-reversal invariant -- a
 *     property shared with the FD axes; the asymmetry between
 *     mobility and 67's lag-1 ACF arises because rho_1 itself is
 *     time-reversal invariant for stationary signals too).
 *   - NOT invariant under non-affine monotone transforms (e.g.
 *     y' = sqrt(y) reshapes both variances differently).
 *
 * REFERENCES:
 *   Hjorth, B., "EEG analysis based on time domain properties",
 *     Electroenceph. Clin. Neurophysiol. 29(3):306-310, 1970.
 *   Hjorth, B., "The Physical Significance of Time Domain
 *     Descriptors in EEG Analysis", Electroenceph. Clin.
 *     Neurophysiol. 34:321-325, 1973.
 */
import type { QueueLine } from './types.js';

export type DailyTokenHjorthMobilitySort =
  | 'absMobilityDeviationDesc'
  | 'mobility'
  | 'mobilityDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHjorthMobilityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4 so the diff
   * series has at least 3 samples (need >= 2 for variance; we set
   * the floor at 4 series samples = 3 diff samples for a stable
   * second-moment estimate).
   * Default 32 (matches axes 74/75/76/77/78).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHjorthMobilitySort;
  generatedAt?: string;
}

export interface DailyTokenHjorthMobilitySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Hjorth mobility = sqrt(var_dv / var_v). */
  mobility: number;
  /** Population variance of the raw series. */
  varV: number;
  /** Population variance of the first-difference series. */
  varDv: number;
  /** mean(y); informational. */
  meanV: number;
  /** mean(diff(y)); informational. */
  meanDv: number;
}

export interface DailyTokenHjorthMobilityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHjorthMobilitySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteMobility: number;
  droppedTopSources: number;
  sources: DailyTokenHjorthMobilitySourceRow[];
}

/**
 * Hjorth mobility on a real-valued series. Returns mobility plus
 * the underlying variances and means for traceability.
 *
 * Throws when the series is too short (n < 3 -- need at least 2
 * diffs for var_dv), when a non-finite value is present, or when
 * var_v collapses to 0 (constant series).
 */
export function hjorthMobility(values: number[]): {
  mobility: number;
  varV: number;
  varDv: number;
  meanV: number;
  meanDv: number;
} {
  const N = values.length;
  if (N < 3) {
    throw new Error(`hjorthMobility: series too short (n=${N}, need n >= 3)`);
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('hjorthMobility requires finite values');
    }
  }
  let sumV = 0;
  for (let i = 0; i < N; i += 1) sumV += values[i]!;
  const meanV = sumV / N;
  let varV = 0;
  for (let i = 0; i < N; i += 1) {
    const d = values[i]! - meanV;
    varV += d * d;
  }
  varV /= N;
  if (!(varV > 0)) {
    throw new Error(`hjorthMobility: zero variance (constant series)`);
  }
  const M = N - 1;
  let sumDv = 0;
  const dv: number[] = new Array(M);
  for (let i = 0; i < M; i += 1) {
    dv[i] = values[i + 1]! - values[i]!;
    sumDv += dv[i]!;
  }
  const meanDv = sumDv / M;
  let varDv = 0;
  for (let i = 0; i < M; i += 1) {
    const d = dv[i]! - meanDv;
    varDv += d * d;
  }
  varDv /= M;
  const mobility = Math.sqrt(varDv / varV);
  if (!Number.isFinite(mobility)) {
    throw new Error(`hjorthMobility: non-finite mobility (${mobility})`);
  }
  return { mobility, varV, varDv, meanV, meanDv };
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

export function buildDailyTokenHjorthMobility(
  queue: QueueLine[],
  opts: DailyTokenHjorthMobilityOptions = {},
): DailyTokenHjorthMobilityReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenHjorthMobilitySort = opts.sort ?? 'absMobilityDeviationDesc';
  const validSorts: DailyTokenHjorthMobilitySort[] = [
    'absMobilityDeviationDesc',
    'mobility',
    'mobilityDesc',
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
    let accSrc = agg.get(src);
    if (!accSrc) {
      accSrc = {
        perDay: new Map<string, number>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, accSrc);
    }
    accSrc.perDay.set(day, (accSrc.perDay.get(day) ?? 0) + tt);
    accSrc.totalTokens += tt;
    if (day < accSrc.firstDay) accSrc.firstDay = day;
    if (day > accSrc.lastDay) accSrc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let droppedBelowMinTenure = 0;
  let droppedZeroVariance = 0;
  let droppedNonFiniteMobility = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHjorthMobilitySourceRow[] = [];

  for (const [src, accSrc] of agg) {
    if (accSrc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nTenure = dayDiffInclusive(accSrc.firstDay, accSrc.lastDay);
    if (nTenure < minTenureDays) {
      droppedBelowMinTenure += 1;
      continue;
    }
    const filled: number[] = new Array(nTenure);
    let cursor = accSrc.firstDay;
    for (let i = 0; i < nTenure; i += 1) {
      filled[i] = accSrc.perDay.get(cursor) ?? 0;
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
      result = hjorthMobility(filled);
    } catch {
      droppedNonFiniteMobility += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: accSrc.totalTokens,
      nActiveDays: accSrc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: accSrc.firstDay,
      lastActiveDay: accSrc.lastDay,
      mobility: result.mobility,
      varV: result.varV,
      varDv: result.varDv,
      meanV: result.meanV,
      meanDv: result.meanDv,
    });
    totalTokensSum += accSrc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mobility':
        primary = a.mobility - b.mobility;
        break;
      case 'mobilityDesc':
        primary = b.mobility - a.mobility;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'tenure':
        primary = b.nTenureDays - a.nTenureDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'absMobilityDeviationDesc':
      default:
        // Mobility is bounded below at 0; pure white noise sits at
        // sqrt(2). We sort by distance from the white-noise reference
        // sqrt(2) so both unusually-smooth and unusually-oscillatory
        // series rise to the top.
        primary =
          Math.abs(b.mobility - Math.SQRT2) - Math.abs(a.mobility - Math.SQRT2);
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
    droppedNonFiniteMobility,
    droppedTopSources,
    sources: kept,
  };
}
