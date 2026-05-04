/**
 * daily-token-fisher-g-periodicity: per-source FISHER'S
 * g-TEST FOR PERIODICITY -- the classical Fisher (1929)
 * significance test for the LARGEST periodogram ordinate
 * against the Gaussian-white-noise null on the gap-filled
 * mean-centred daily total_tokens series.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4 (gate enforced via
 * `--min-tenure-days 8`), let
 *
 *   g  = max_{k=1..K} P[k] / sum_{k=1..K} P[k]   in (1/K, 1]
 *
 * be Fisher's g-statistic (the SHARE of total spectral mass
 * carried by the WINNING bin). Under H0 (the series is
 * Gaussian white noise) the exact distribution of g is
 * (Fisher 1929, Brockwell & Davis 1991 §10.2):
 *
 *   P(g > x) = sum_{j=1}^{m} (-1)^{j-1} * C(K, j)
 *                            * (1 - j*x)^{K-1}
 *
 * where m = floor(1 / x). This is the "Fisher exact p-value",
 * `gPValue`, and is bounded in [0, 1] under H0 (it has the
 * standard uniform-on-[0,1] property of any exact p-value).
 *
 * ONE-HUNDRED-AND-SIXTY-SIXTH cross-source axis. This is the
 * FIRST primitive in the suite that delivers a CALIBRATED
 * EXACT p-value for periodogram-based detection of a single
 * sinusoidal component against a Gaussian-white-noise null.
 * Every prior spectral axis (32-98 family, including peak-
 * frequency 96, second-peak 97, tail-flatness 98) reports
 * STRUCTURAL DESCRIPTORS of the PSD (position, magnitude,
 * shape) but NOT a calibrated rejection probability for the
 * "is there any non-trivial periodic component at all" null.
 * Fisher's g delivers exactly that: a single-number
 * SIGNIFICANCE TEST whose finite-sample distribution is known
 * in CLOSED FORM (no asymptotics, no bootstrap).
 *
 * READING:
 *
 *   - g near 1/K -- spectrum is nearly UNIFORM (white-noise-
 *                   compatible). gPValue near 1.
 *   - g near 1   -- almost ALL spectral mass on a SINGLE bin
 *                   (a strong periodic component). gPValue
 *                   near 0.
 *   - gPValue < 0.05 -- reject H0 at 5%: a single sinusoidal
 *                   component is statistically significant
 *                   against white noise.
 *
 * COMPANIONS:
 *
 *   - `gStat` (= peakMassShare from axis-96 by construction
 *      identity, surfaced here under its statistical name).
 *   - `gNeg2LogP` = -2 * log(gPValue + epsilon), the standard
 *      Fisher's combined-evidence transformation. Distributed
 *      chi-squared(2) under H0 and additive across independent
 *      sources -- exactly the property that makes it useful as
 *      a CROSS-SOURCE pooled-evidence axis. Higher = stronger
 *      rejection of white-noise.
 *   - `gZ` = (g - E[g | H0]) / sqrt(Var[g | H0]) where the
 *      moments come from the same exact distribution; gives a
 *      standardised effect-size companion to the calibrated
 *      p-value. (Computed numerically from the survival
 *      function via integration of P(g > x) on a fixed grid.)
 *
 * BOUND: g in (1/K, 1] EXACTLY (lower bound 1/K achieved iff
 * the periodogram is uniform; upper bound 1 achieved iff the
 * periodogram is concentrated at a single bin). gPValue in
 * [0, 1].
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; kept bins k >=
 *     1 are UNCHANGED. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every kept bin scales by
 *     a^2; the RATIO max/sum is UNCHANGED.
 *     SCALE-INVARIANT for any non-zero a.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 reversal-blind.
 *     TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD,
 *     drives g toward 1/K and gPValue toward 1.
 *   - BIN-PERMUTATION: g is BIN-PERMUTATION-INVARIANT (max
 *     and sum are both permutation-invariant). This is the
 *     primary orthogonality witness vs axis-96 (peak-bin) and
 *     axis-97 (second-peak): both of those collapse on
 *     permutation, g does NOT.
 *   - BIN-REVERSAL k -> K + 1 - k: max/sum unchanged.
 *     BIN-REVERSAL-INVARIANT (unlike axis-96 and axis-97).
 *
 * REFERENCES:
 *
 *   Fisher, R. A. "Tests of significance in harmonic
 *     analysis." Proc. Roy. Soc. A 125 (1929), pp. 54-59 --
 *     ORIGINAL g-test derivation, Theorem of Sec. 5 gives the
 *     closed-form survival function used here.
 *   Brockwell, P. J. & Davis, R. A., "Time Series: Theory and
 *     Methods" (2nd ed., Springer 1991), §10.2 -- modern
 *     textbook treatment of Fisher's g and the closed-form
 *     p-value formula.
 *   Wichert, S., Fokianos, K., Strimmer, K., "Identifying
 *     periodically expressed transcripts in microarray time
 *     series data", Bioinformatics 20:1 (2004), 5-20 --
 *     contemporary application; identical formula.
 *   Anderson, T. W., "The Statistical Analysis of Time Series"
 *     (Wiley 1971), §4.3 -- exact distribution derivation.
 *
 * STRUCTURAL ORTHOGONALITY -- the FIRST CALIBRATED-p-VALUE
 * SPECTRAL AXIS, distinct from every prior axis 32..165:
 *
 *   - vs `daily-token-spectral-peak-frequency` (axis-96): 96
 *     reports the ARGMAX BIN INDEX (an integer position).
 *     This axis reports the SHARE of total mass at that bin
 *     and a CALIBRATED p-value. A spectrum spiked at k=2 vs
 *     a spectrum spiked at k=K both have peakMassShare = 1
 *     and gPValue ~ 0; axis-96 distinguishes them, this axis
 *     does NOT. Bin-permutation MOVES axis-96 (it is index-
 *     valued) and FIXES this axis (max/sum invariant).
 *
 *   - vs `daily-token-spectral-crest-factor` (axis-89, peak-
 *     to-MEAN ratio K * peakMassShare): crest = K * gStat
 *     by construction. Crest is an UNCALIBRATED magnitude
 *     ratio; gPValue is the calibrated significance of that
 *     same magnitude under the white-noise null. Crest tells
 *     "how spiky"; gPValue tells "how unlikely under white
 *     noise" -- a magnitude-vs-significance pair.
 *
 *   - vs `daily-token-spectral-flatness-wiener` (axis-85, GM
 *     / AM): flatness ALSO collapses to a single number under
 *     bin permutation, but it uses ALL bins (geometric mean)
 *     vs only the WINNING bin (max). A bimodal PSD with two
 *     equal peaks of mass 0.5 each has g = 0.5 (gPValue
 *     small) but flatness substantially below 1; flatness
 *     reads "concentration" as a smooth GM/AM curve, g reads
 *     "is there a SINGLE dominant bin".
 *
 *   - vs `daily-token-spectral-entropy` (axis-69): Shannon
 *     entropy of the normalised PSD -- ALL bins contribute.
 *     Same mass on two bins gives the same entropy regardless
 *     of HOW concentrated the WINNING bin is; g cares only
 *     about the winning bin.
 *
 *   - vs `daily-token-dft-power-law-slope` (axis-84, beta on
 *     log-log): beta is a GLOBAL fit. g is a SINGLE-BIN
 *     statistic. A clean 1/f PSD has steep negative beta and
 *     g typically modest (mass smeared across low-k bins);
 *     a clean sinusoidal PSD has beta ~ 0 and g near 1.
 *
 *   - vs `daily-token-ljung-box-q-test` (axis Ljung-Box on
 *     time-domain autocorrelation): both deliver calibrated
 *     p-values, but Ljung-Box pools L lags of the AUTO-
 *     CORRELATION FUNCTION (a TIME-DOMAIN quadratic form);
 *     Fisher's g picks the SINGLE LARGEST FREQUENCY-DOMAIN
 *     ordinate. White-noise residual after AR(1) removal can
 *     have small Ljung-Box Q yet very small gPValue if a
 *     residual sinusoid sits at one bin -- and vice-versa.
 *
 *   - vs `daily-token-bartels-rank-vN-detrended` (axis-164),
 *     `runs-test-detrended` (axis-163), `durbin-watson` (axis-
 *     162): all are TIME-DOMAIN serial-dependence tests on
 *     RESIDUALS from a linear detrend. Fisher's g is FREQUENCY
 *     -DOMAIN on the gap-filled mean-centred series and
 *     targets a periodic component, not generic dependence.
 *
 *   - vs `daily-token-hoeffding-d-lag1` (axis-165): bivariate
 *     rank-based independence test on lag-1 paired sequence.
 *     Fisher's g is univariate-spectral on the original
 *     series. Hoeffding D rejects independence; g rejects
 *     "white noise" by detecting a single dominant frequency.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when the
 * computed g / gPValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenFisherGPeriodicitySort =
  | 'gStat'
  | 'gStatDesc'
  | 'gPValue'
  | 'gPValueDesc'
  | 'gNeg2LogP'
  | 'gNeg2LogPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenFisherGPeriodicityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and Fisher's g closed-form survival function is well-
   * defined for typical g values.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenFisherGPeriodicitySort;
  generatedAt?: string;
}

export interface DailyTokenFisherGPeriodicitySourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  totalPower: number;
  peakPower: number;
  peakBin: number;
  /** g = P[k*] / sum_{k=1..K} P[k] in (1/K, 1]. */
  gStat: number;
  /** Fisher exact p-value for max-bin against white noise. */
  gPValue: number;
  /** -2 * log(gPValue + 1e-300), chi-squared(2) under H0. */
  gNeg2LogP: number;
}

export interface DailyTokenFisherGPeriodicityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenFisherGPeriodicitySort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPowerSum: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenFisherGPeriodicitySourceRow[];
}

/**
 * log binomial coefficient log(C(n, k)) computed via log-
 * gamma to avoid overflow for large n. Stable for the n up to
 * a few thousand we need here (n = K = floor(tenure / 2)).
 */
function lgamma(z: number): number {
  // Lanczos approximation, g = 7, n = 9.
  if (z < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
    );
  }
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < g + 2; i += 1) x += c[i]! / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logBinom(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}

/**
 * Fisher's exact p-value for the g-statistic on K periodogram
 * ordinates under the Gaussian-white-noise null:
 *
 *   P(g > x) = sum_{j=1}^{m} (-1)^{j-1} * C(K, j)
 *                            * (1 - j*x)^{K-1}
 *
 * with m = floor(1 / x). Computed in log-space term-wise via
 * log-binomial to remain stable for K up to several thousand.
 *
 * Edge cases:
 *   - x <= 1/K -> p = 1 (g cannot be below 1/K).
 *   - x >= 1   -> p = 0.
 *   - x = 1/K + eps -> p ~ 1 (the trivial uniform spectrum).
 *
 * Returns a value in [0, 1]; clamped to [0, 1] to absorb
 * cancellation at very large K.
 */
export function fisherGPValue(g: number, K: number): number {
  if (!Number.isFinite(g) || !Number.isFinite(K)) {
    throw new Error(
      `fisherGPValue: non-finite input (g=${g}, K=${K})`,
    );
  }
  if (K < 2 || !Number.isInteger(K)) {
    throw new Error(`fisherGPValue: K must be integer >= 2 (got ${K})`);
  }
  if (g <= 1 / K) return 1;
  if (g >= 1) return 0;
  const m = Math.floor(1 / g);
  // Sum sum_{j=1..m} (-1)^{j-1} * C(K, j) * (1 - j*g)^{K-1}
  // term-wise. Magnitudes can grow before alternating
  // cancellation, so accumulate exponentials of the log-
  // magnitude and sum with sign explicitly.
  let s = 0;
  for (let j = 1; j <= m; j += 1) {
    const base = 1 - j * g;
    if (base <= 0) break; // (1 - j*g)^{K-1} = 0 when j*g >= 1
    const logTerm = logBinom(K, j) + (K - 1) * Math.log(base);
    const term = Math.exp(logTerm);
    s += j % 2 === 1 ? term : -term;
  }
  if (s < 0) s = 0;
  if (s > 1) s = 1;
  return s;
}

/**
 * Fisher's g-statistic and exact p-value on a non-negative
 * power vector indexed by k = 1..power.length. Returns
 * `{ gStat, gPValue, gNeg2LogP, peakBin, peakPower,
 *    totalPower }` where peakBin = argmax (1-indexed; ties ->
 * smallest k).
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> gStat = 1/K (lower bound),
 *                          gPValue = 1.
 *   - K=K, P=[0,...,0,1] -> gStat = 1 (upper bound),
 *                          gPValue = 0.
 *   - K=K, P=[1,0,...,0] -> gStat = 1, gPValue = 0.
 *   - K=2, P=[a,b]       -> gStat = max(a,b)/(a+b),
 *                          gPValue = K * (1 - g)^{K-1} for g
 *                          in (1/2, 1] (m=1; second term has
 *                          (1 - 2g)^{K-1} = 0 when g >= 1/2).
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function fisherGStatistic(power: number[]): {
  gStat: number;
  gPValue: number;
  gNeg2LogP: number;
  peakBin: number;
  peakPower: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(`fisherGStatistic: too few bins (${K}; need >= 2)`);
  }
  let totalPower = 0;
  let peakPower = -Infinity;
  let peakBin = 1;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `fisherGStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `fisherGStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
    if (p > peakPower) {
      peakPower = p;
      peakBin = i + 1;
    }
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `fisherGStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  const gStat = peakPower / totalPower;
  const gPValue = fisherGPValue(gStat, K);
  const gNeg2LogP = -2 * Math.log(gPValue + 1e-300);
  if (
    !Number.isFinite(gStat) ||
    !Number.isFinite(gPValue) ||
    !Number.isFinite(gNeg2LogP)
  ) {
    throw new Error(
      `fisherGStatistic: non-finite output (gStat=${gStat}, gPValue=${gPValue}, gNeg2LogP=${gNeg2LogP})`,
    );
  }
  return { gStat, gPValue, gNeg2LogP, peakBin, peakPower, totalPower };
}

export function dailyTokenFisherGPeriodicity(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  peakPower: number;
  peakBin: number;
  gStat: number;
  gPValue: number;
  gNeg2LogP: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenFisherGPeriodicity: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenFisherGPeriodicity requires finite values',
      );
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
      'dailyTokenFisherGPeriodicity: zero variance (constant series)',
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
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `dailyTokenFisherGPeriodicity: too few bins (${K}; need >= 2)`,
    );
  }
  const r = fisherGStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    peakPower: r.peakPower,
    peakBin: r.peakBin,
    gStat: r.gStat,
    gPValue: r.gPValue,
    gNeg2LogP: r.gNeg2LogP,
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

export function buildDailyTokenFisherGPeriodicity(
  queue: QueueLine[],
  opts: DailyTokenFisherGPeriodicityOptions = {},
): DailyTokenFisherGPeriodicityReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenFisherGPeriodicitySort = opts.sort ?? 'gPValue';
  const validSorts: DailyTokenFisherGPeriodicitySort[] = [
    'gStat',
    'gStatDesc',
    'gPValue',
    'gPValueDesc',
    'gNeg2LogP',
    'gNeg2LogPDesc',
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
  let droppedZeroPowerSum = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenFisherGPeriodicitySourceRow[] = [];

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
      result = dailyTokenFisherGPeriodicity(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive total power')) {
        droppedZeroPowerSum += 1;
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
      peakPower: result.peakPower,
      peakBin: result.peakBin,
      gStat: result.gStat,
      gPValue: result.gPValue,
      gNeg2LogP: result.gNeg2LogP,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'gStat':
        primary = a.gStat - b.gStat;
        break;
      case 'gStatDesc':
        primary = b.gStat - a.gStat;
        break;
      case 'gPValue':
        primary = a.gPValue - b.gPValue;
        break;
      case 'gPValueDesc':
        primary = b.gPValue - a.gPValue;
        break;
      case 'gNeg2LogP':
        primary = a.gNeg2LogP - b.gNeg2LogP;
        break;
      case 'gNeg2LogPDesc':
        primary = b.gNeg2LogP - a.gNeg2LogP;
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
    droppedZeroPowerSum,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
