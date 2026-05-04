/**
 * daily-token-watson-u2-cumulative-periodogram: per-source
 * WATSON U^2 TEST on the CUMULATIVE PERIODOGRAM of the
 * gap-filled mean-centred daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-THIRD cross-source axis.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the NORMALISED
 * CUMULATIVE PERIODOGRAM
 *
 *   C[j] = (sum_{k=1..j} P[k]) / (sum_{k=1..K} P[k]),
 *          j = 1..K
 *
 * Let e[j] = C[j] - j/K denote the deviation from uniform on
 * j = 1..K-1 (matches Bartlett-167, CvM-168, AD-169, Kuiper-
 * 172 conventions). The WATSON (1961, "Goodness-of-fit tests
 * on a circle", Biometrika 48(1/2):109-114) U^2 STATISTIC
 * is the MEAN-CENTRED L^2 norm of the deviation:
 *
 *   eBar = (1 / (K-1)) * sum_{j=1..K-1} e[j]
 *   wU2  = (1 / (K-1)) * sum_{j=1..K-1} (e[j] - eBar)^2
 *
 * That is, Watson U^2 = CvM L^2 norm MINUS the SQUARED MEAN
 * of the deviation -- Watson 1961's geometric insight is
 * that subtracting the mean makes the statistic INVARIANT
 * UNDER CYCLIC ROTATION of the underlying support (the
 * canonical "test on a circle"). Stephens (1970, J. R. Stat.
 * Soc. B 32(1):115-122) gives the modified form
 *
 *   wU2Star = (wU2 - 0.1/K + 0.1/K^2) * (1 + 0.8/K)
 *
 * which removes the leading finite-K bias and brings the
 * survival function into the asymptotic regime above K = 8.
 * The asymptotic survival function (Watson 1961 eq. 5.6;
 * Stephens 1970 eq. 1.6; Lockhart & Stephens 1985 J. R. Stat.
 * Soc. B 47(1):112-119) is
 *
 *   P(U^2 > u) = 2 * sum_{m>=1} (-1)^(m-1) exp(-2 m^2 pi^2 u)
 *
 * which converges geometrically (~exp(-2 pi^2 u) per term)
 * and yields ~1e-12 in <= 50 terms across the operating
 * range of the test (wU2Star in [0.01, 1.5]). We cap at
 * m = 100 with an absolute-tolerance early exit at 1e-15.
 *
 * READING:
 *
 *   - wU2Star small (~0)  -> C[j] tracks j/K everywhere with
 *                            only tiny mean-centred L^2
 *                            deviation; wU2PValue near 1.
 *   - wU2Star large       -> the cumulative spectrum has a
 *                            SUSTAINED MEAN-CENTRED departure
 *                            from uniform (a balanced LF/HF
 *                            redistribution drives this large
 *                            even though the OVERALL mean
 *                            cumulative deviation is near 0,
 *                            BECAUSE the variance of the
 *                            deviation around its own mean is
 *                            large); wU2PValue near 0.
 *   - wU2PValue < 0.05    -> reject H0 of white noise at 5%
 *                            in the MEAN-CENTRED L^2 sense.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs `daily-token-cramer-von-mises-cumulative-periodogram`
 *     (axis-168): SAME L^2 functional family, DIFFERENT
 *     CENTERING. CvM is the un-centred L^2 norm of the
 *     deviation; Watson U^2 SUBTRACTS THE MEAN BEFORE
 *     SQUARING. PRIMARY witness: a deviation profile e[j]
 *     that is approximately CONSTANT (e.g. C[j] = j/K + c
 *     for a single-bin-at-DC offset) yields CvM ~ c^2 (the
 *     full L^2 mass of the constant) but Watson U^2 ~ 0
 *     (the variance of a constant is zero). Conversely a
 *     deviation profile with e[j] = sin(2 pi j/K) yields CvM
 *     and Watson U^2 in approximately equal magnitude (a
 *     pure-sinusoidal deviation has zero mean already).
 *     This is exactly the textbook orthogonality between
 *     CvM and Watson U^2 on the EDF (Watson 1961 abstract;
 *     Stephens 1970 sec. 4).
 *
 *   - vs `daily-token-bartlett-cumulative-periodogram`
 *     (axis-167): different NORM (sup vs L^2) AND different
 *     centering. Bartlett picks up a single large excursion;
 *     Watson U^2 picks up sustained mean-centred dispersion.
 *
 *   - vs `daily-token-anderson-darling-cumulative-periodogram`
 *     (axis-169): both are L^2 functionals but AD is TAIL-
 *     WEIGHTED (weight 1 / (j/K * (1 - j/K)) inflating the
 *     boundary contribution) while Watson U^2 is UNIFORMLY-
 *     WEIGHTED and MEAN-CENTRED. A tail-only deviation
 *     dominates AD; a balanced full-support deviation
 *     dominates Watson U^2.
 *
 *   - vs `daily-token-kuiper-v-cumulative-periodogram`
 *     (axis-172): both are CYCLIC-ROTATION-INVARIANT but
 *     Kuiper uses the SUM of the two one-sided sup-norms
 *     while Watson uses the MEAN-CENTRED L^2 norm. A spike
 *     drives Kuiper large but Watson modestly; a sustained
 *     sinusoidal deviation drives Watson large but Kuiper
 *     only modestly (only the extrema register).
 *
 *   - vs `daily-token-fisher-g-periodicity` (axis-166):
 *     Fisher's g is a MAX-SHARE of a single bin (bin-
 *     permutation-INVARIANT); Watson U^2 is bin-permutation-
 *     SENSITIVE through the cumulative ordering.
 *
 *   - vs all 2nd-moment spectral descriptors (centroid,
 *     bandwidth, kurtosis, skewness, rolloff, flatness,
 *     entropy): those are MOMENTS / SCALARS of the PSD
 *     SHAPE; Watson U^2 is a CALIBRATED p-value with a
 *     mean-centred L^2 functional on the CUMULATIVE process.
 *
 *   - vs the time-domain serial-dependence tests (durbin-
 *     watson 162, runs-test 163, rank-vN 164, hoeffding-d
 *     165, ljung-box-Q 158, mcleod-li 159): all are time-
 *     domain; Watson U^2 is frequency-domain on the cumulative
 *     periodogram.
 *
 *   - vs the halves axes (115-118, 167-171 halves variants):
 *     halves axes compare TWO HALVES of the time series;
 *     Watson U^2 CPM tests the ENTIRE series's PSD against
 *     uniform.
 *
 * BOUND: wU2 in [0, 0.25] (achieved by alternating-sign
 * extreme triangular deviations). wU2Star in [0, ~0.25].
 * wU2PValue in [0, 1].
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; kept bins
 *     unchanged. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every bin scales by a^2;
 *     normalised C[j] is unchanged. SCALE-INVARIANT.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 reversal-blind.
 *     TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD,
 *     drives wU2 toward 0.
 *   - BIN-PERMUTATION: NOT invariant -- C[j] cumulative
 *     ordering is permutation-sensitive.
 *   - BIN-CYCLIC-ROTATION: wU2 INVARIANT in magnitude on the
 *     circular cumulative process (this is Watson's claim
 *     to fame for testing distributions on a circle); on the
 *     linear K-bin process the invariance is approximate to
 *     within the boundary-bin contribution.
 *   - BIN-REVERSAL k -> K + 1 - k: deviation profile reverses
 *     sign; (e - eBar)^2 is invariant -> wU2 INVARIANT.
 *   - ADDING A CONSTANT to the deviation profile (which would
 *     be equivalent to a uniform DC offset of the cumulative
 *     process): wU2 INVARIANT (the mean-centring removes it).
 *
 * REFERENCES:
 *
 *   Watson, G. S. "Goodness-of-fit tests on a circle",
 *     Biometrika 48(1/2) (1961) 109-114 -- the original
 *     definition U^2 = integral of (F_n - F)^2 minus the
 *     squared mean and the asymptotic survival function.
 *   Stephens, M. A. "Use of the Kolmogorov-Smirnov, Cramer-
 *     von Mises and related statistics without extensive
 *     tables", J. R. Stat. Soc. B 32(1) (1970) 115-122 --
 *     standardisation `(U^2 - 0.1/n + 0.1/n^2)(1 + 0.8/n)`
 *     and tabulated critical values 0.152 (10%), 0.187 (5%),
 *     0.221 (2.5%), 0.267 (1%) for U^2*.
 *   Lockhart, R. A. & Stephens, M. A. "Tests of fit for the
 *     von Mises distribution", J. R. Stat. Soc. B 47(1)
 *     (1985) 112-119 -- closed-form survival expansion.
 *   Brockwell, P. J. & Davis, R. A. "Time Series: Theory
 *     and Methods", 2nd ed., Springer, 1991, sec. 10.2 --
 *     application of EDF tests to the cumulative periodogram.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when
 * the computed wU2 / wU2PValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenWatsonU2CumulativePeriodogramSort =
  | 'wU2'
  | 'wU2Desc'
  | 'wU2Star'
  | 'wU2StarDesc'
  | 'wU2PValue'
  | 'wU2PValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenWatsonU2CumulativePeriodogramOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and the Watson U^2 standardisation is in its asymptotic
   * regime.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenWatsonU2CumulativePeriodogramSort;
  generatedAt?: string;
}

export interface DailyTokenWatsonU2CumulativePeriodogramSourceRow {
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
  /** Mean of the deviation profile e[j] = C[j] - j/K over j=1..K-1. */
  eBar: number;
  /** raw wU2 = (1/(K-1)) sum (e[j] - eBar)^2, in [0, 0.25]. */
  wU2: number;
  /** standardised wU2Star = (wU2 - 0.1/K + 0.1/K^2)*(1 + 0.8/K). */
  wU2Star: number;
  /** Watson 1961 / Stephens 1970 survival p-value, in [0, 1]. */
  wU2PValue: number;
}

export interface DailyTokenWatsonU2CumulativePeriodogramReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenWatsonU2CumulativePeriodogramSort;
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
  sources: DailyTokenWatsonU2CumulativePeriodogramSourceRow[];
}

/**
 * Watson U^2 survival function P(U^2 > u) via the asymptotic
 * series (Watson 1961 eq. 5.6; Stephens 1970 eq. 1.6):
 *
 *   P(U^2 > u) = 2 * sum_{m>=1} (-1)^(m-1) exp(-2 m^2 pi^2 u)
 *
 * Edge cases:
 *   - u <= 0           -> p = 1
 *   - u very large     -> p ~ 0 (geometric decay
 *                         exp(-2 pi^2 u) per term)
 *   - non-finite u     -> throws
 *
 * The series converges to ~1e-15 in <= 50 terms across the
 * operating range used by the test (u in [0.005, 1.5]).
 * Cap at m = 100 with an absolute-tolerance early exit.
 */
export function watsonU2Survival(u: number): number {
  if (!Number.isFinite(u)) {
    throw new Error(`watsonU2Survival: non-finite input (${u})`);
  }
  if (u <= 0) return 1;
  let sum = 0;
  const twoPi2 = 2 * Math.PI * Math.PI;
  for (let m = 1; m <= 100; m += 1) {
    const term = (m % 2 === 1 ? 1 : -1) * Math.exp(-twoPi2 * m * m * u);
    sum += term;
    if (Math.abs(term) < 1e-18 && m >= 3) break;
  }
  const p = 2 * sum;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Watson U^2 cumulative-periodogram statistic on a non-
 * negative power vector indexed by k = 1..power.length.
 *
 * Returns
 *   { eBar, wU2, wU2Star, wU2PValue, totalPower }.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c]    -> C[j] = j/K exactly,
 *                              e[j] = 0,
 *                              eBar = 0, wU2 = 0,
 *                              wU2PValue = 1.
 *   - K=K, P=[1,0,...,0]    -> C[1..K-1] = 1,
 *                              e[j] = 1 - j/K,
 *                              eBar = (K-1)/(2K)  ~ 1/2,
 *                              wU2 has known closed form
 *                              (variance of an arithmetic
 *                              progression).
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function watsonU2CumulativePeriodogramStatistic(power: number[]): {
  eBar: number;
  wU2: number;
  wU2Star: number;
  wU2PValue: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `watsonU2CumulativePeriodogramStatistic: too few bins (${K}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `watsonU2CumulativePeriodogramStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `watsonU2CumulativePeriodogramStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `watsonU2CumulativePeriodogramStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  // First pass: compute deviations e[j] = C[j] - j/K and mean.
  const m = K - 1;
  const dev: number[] = new Array(m);
  let cum = 0;
  let sumE = 0;
  for (let j = 1; j <= m; j += 1) {
    cum += power[j - 1]!;
    const cj = cum / totalPower;
    const fj = j / K;
    const e = cj - fj;
    dev[j - 1] = e;
    sumE += e;
  }
  const eBar = sumE / m;
  let varE = 0;
  for (let i = 0; i < m; i += 1) {
    const d = dev[i]! - eBar;
    varE += d * d;
  }
  const wU2 = varE / m;
  const wU2Star = (wU2 - 0.1 / K + 0.1 / (K * K)) * (1 + 0.8 / K);
  const wU2PValue = watsonU2Survival(wU2Star > 0 ? wU2Star : wU2);
  if (
    !Number.isFinite(eBar) ||
    !Number.isFinite(wU2) ||
    !Number.isFinite(wU2Star) ||
    !Number.isFinite(wU2PValue)
  ) {
    throw new Error(
      `watsonU2CumulativePeriodogramStatistic: non-finite output (wU2=${wU2}, wU2Star=${wU2Star}, wU2PValue=${wU2PValue})`,
    );
  }
  return { eBar, wU2, wU2Star, wU2PValue, totalPower };
}

export function dailyTokenWatsonU2CumulativePeriodogram(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  eBar: number;
  wU2: number;
  wU2Star: number;
  wU2PValue: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenWatsonU2CumulativePeriodogram: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenWatsonU2CumulativePeriodogram requires finite values',
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
      'dailyTokenWatsonU2CumulativePeriodogram: zero variance (constant series)',
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
      `dailyTokenWatsonU2CumulativePeriodogram: too few bins (${K}; need >= 2)`,
    );
  }
  const r = watsonU2CumulativePeriodogramStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    eBar: r.eBar,
    wU2: r.wU2,
    wU2Star: r.wU2Star,
    wU2PValue: r.wU2PValue,
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

export function buildDailyTokenWatsonU2CumulativePeriodogram(
  queue: QueueLine[],
  opts: DailyTokenWatsonU2CumulativePeriodogramOptions = {},
): DailyTokenWatsonU2CumulativePeriodogramReport {
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
  const sort: DailyTokenWatsonU2CumulativePeriodogramSort =
    opts.sort ?? 'wU2PValue';
  const validSorts: DailyTokenWatsonU2CumulativePeriodogramSort[] = [
    'wU2',
    'wU2Desc',
    'wU2Star',
    'wU2StarDesc',
    'wU2PValue',
    'wU2PValueDesc',
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
  const rows: DailyTokenWatsonU2CumulativePeriodogramSourceRow[] = [];

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
      result = dailyTokenWatsonU2CumulativePeriodogram(filled);
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
      eBar: result.eBar,
      wU2: result.wU2,
      wU2Star: result.wU2Star,
      wU2PValue: result.wU2PValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'wU2':
        primary = a.wU2 - b.wU2;
        break;
      case 'wU2Desc':
        primary = b.wU2 - a.wU2;
        break;
      case 'wU2Star':
        primary = a.wU2Star - b.wU2Star;
        break;
      case 'wU2StarDesc':
        primary = b.wU2Star - a.wU2Star;
        break;
      case 'wU2PValue':
        primary = a.wU2PValue - b.wU2PValue;
        break;
      case 'wU2PValueDesc':
        primary = b.wU2PValue - a.wU2PValue;
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

/**
 * Corpus-level aggregator for axis-173 per-source results.
 * Produces a single corpus-level summary that captures both
 * the COMBINED SIGNIFICANCE (Fisher 1932) and the CORPUS-
 * WIDE MEAN-DEVIATION-SHARE -- the orthogonality witness
 * unique to Watson U^2.
 *
 * Outputs:
 *
 *   tenureWeightedWU2Star -- weighted average of `wU2Star`
 *     across rows with weights `nTenureDays - 1` (matches
 *     the effective-K weighting of the per-source statistic).
 *
 *   fisherCombinedPValue -- Fisher (1932) combined p-value:
 *
 *       chi2 = -2 * sum_i log(wU2PValue_i)
 *       fisherCombinedPValue = P(Chi2_{2m} > chi2)
 *
 *     for m = number of valid rows. Computed via the chi-
 *     squared upper-tail routine factored out of axis-169 /
 *     axis-171 / axis-172. Returns 1 when m = 0.
 *
 *   meanDeviationShare -- corpus-level fraction of CvM-168
 *     L^2 mass that the mean-centring removes:
 *
 *         meanDeviationShare
 *           = sum_i (eBar_i^2)
 *             / (sum_i (wU2_i + eBar_i^2))     in [0, 1]
 *
 *     This is the corpus-wide answer to:
 *
 *         share near 0  -> per-source deviation profiles
 *                          have ZERO MEAN already (CvM and
 *                          Watson U^2 agree at the corpus
 *                          level -- Watson adds nothing
 *                          orthogonal beyond CvM here);
 *         share near 1  -> per-source deviation profiles
 *                          are dominated by a CONSTANT
 *                          OFFSET (CvM measures the offset
 *                          and almost nothing else; Watson
 *                          U^2 strips it out entirely --
 *                          the regime where this axis adds
 *                          the most over CvM-168).
 *
 *     This is THE STRUCTURAL-ORTHOGONALITY WITNESS against
 *     axis-168 in production data.
 *
 *   sumWU2 / sumEBarSquared -- raw sums used by the share.
 *
 *   rowsUsed / rowsSkipped -- defensive book-keeping.
 *
 * Malformed rows (non-finite `wU2Star` / `wU2PValue` /
 * `eBar`, non-integer / < 2 nTenureDays, wU2 < 0) are
 * SKIPPED with a counter rather than throwing.
 */
export interface WatsonU2CumulativePeriodogramCorpusAggregate {
  tenureWeightedWU2Star: number;
  fisherCombinedPValue: number;
  sumWU2: number;
  sumEBarSquared: number;
  meanDeviationShare: number;
  totalTenureWeight: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateWatsonU2CumulativePeriodogram(
  rows: ReadonlyArray<{
    nTenureDays: number;
    wU2: number;
    wU2Star: number;
    wU2PValue: number;
    eBar: number;
  }>,
): WatsonU2CumulativePeriodogramCorpusAggregate {
  let weightedSum = 0;
  let totalWeight = 0;
  let chi2 = 0;
  let sumWU2 = 0;
  let sumEBarSquared = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.wU2) ||
      !Number.isFinite(r.wU2Star) ||
      !Number.isFinite(r.wU2PValue) ||
      !Number.isFinite(r.eBar) ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 2 ||
      !(r.wU2 >= 0)
    ) {
      skipped += 1;
      continue;
    }
    const w = r.nTenureDays - 1;
    weightedSum += w * r.wU2Star;
    totalWeight += w;
    const pClamped = Math.max(1e-300, Math.min(1, r.wU2PValue));
    chi2 += -2 * Math.log(pClamped);
    sumWU2 += r.wU2;
    sumEBarSquared += r.eBar * r.eBar;
    used += 1;
  }
  if (used === 0) {
    return {
      tenureWeightedWU2Star: 0,
      fisherCombinedPValue: 1,
      sumWU2: 0,
      sumEBarSquared: 0,
      meanDeviationShare: 0,
      totalTenureWeight: 0,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const tenureWeightedWU2Star = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const dof = 2 * used;
  const fisherCombinedPValue = chiSquaredUpperTailLocalWatson(chi2, dof);
  const totalCvmEquivalent = sumWU2 + sumEBarSquared;
  const meanDeviationShare =
    totalCvmEquivalent > 0 ? sumEBarSquared / totalCvmEquivalent : 0;
  return {
    tenureWeightedWU2Star,
    fisherCombinedPValue,
    sumWU2,
    sumEBarSquared,
    meanDeviationShare,
    totalTenureWeight: totalWeight,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Local chi-squared upper-tail `P(Chi^2_k > x)` via the
 * regularised upper incomplete gamma function (Numerical
 * Recipes 6.2). Self-contained -- no cross-axis import.
 * Same algorithm as axes 169 / 171 / 172.
 */
export function chiSquaredUpperTailLocalWatson(
  x: number,
  k: number,
): number {
  if (!Number.isFinite(x)) {
    throw new Error(`chiSquaredUpperTailLocalWatson: non-finite x (${x})`);
  }
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error(
      `chiSquaredUpperTailLocalWatson: invalid dof k (${k}; need k > 0)`,
    );
  }
  if (x <= 0) return 1;
  const s = k / 2;
  const xHalf = x / 2;
  if (xHalf < s + 1) {
    return 1 - lowerIncompleteGammaSeriesLocalWatson(s, xHalf);
  }
  return upperIncompleteGammaCFLocalWatson(s, xHalf);
}

function lowerIncompleteGammaSeriesLocalWatson(s: number, x: number): number {
  let term = 1 / s;
  let sum = term;
  for (let n = 1; n < 1000; n += 1) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGammaLocalWatson(s));
}

function upperIncompleteGammaCFLocalWatson(s: number, x: number): number {
  const FPMIN = 1e-300;
  let b = x + 1 - s;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i += 1) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h * Math.exp(-x + s * Math.log(x) - logGammaLocalWatson(s));
}

function logGammaLocalWatson(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - logGammaLocalWatson(1 - z)
    );
  }
  z -= 1;
  let a = c[0]!;
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
