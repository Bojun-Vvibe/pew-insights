/**
 * daily-token-kuiper-v-cumulative-periodogram: per-source
 * KUIPER V TEST on the CUMULATIVE PERIODOGRAM of the gap-
 * filled mean-centred daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-SECOND cross-source axis.
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the NORMALISED
 * CUMULATIVE PERIODOGRAM
 *
 *   C[j] = (sum_{k=1..j} P[k]) / (sum_{k=1..K} P[k]),
 *          j = 1..K
 *
 * The KUIPER (1960, "Tests concerning random points on a
 * circle", Proc. Koninklijke Nederlandse Akademie van
 * Wetenschappen A 63:38-47) STATISTIC is the SUM of the
 * one-sided maximum positive deviation and the one-sided
 * maximum negative deviation of C[j] from the uniform
 * reference j/K:
 *
 *   kpDPlus  = max_{j=1..K-1} ( C[j] - j/K )
 *   kpDMinus = max_{j=1..K-1} ( j/K - C[j] )
 *   kpV      = kpDPlus + kpDMinus
 *
 * (max set to 0 when no positive / no negative deviation
 * exists -- so kpV >= 0 always.) The standardised statistic
 * is
 *
 *   kpVStar = ( sqrt(K) + 0.155 + 0.24 / sqrt(K) ) * kpV
 *
 * which removes the leading finite-K bias and brings the
 * survival function into the asymptotic regime above K = 8.
 * Stephens (1970, J. R. Stat. Soc. B 32(1):115-122 Table 1)
 * tabulates kpVStar critical values 1.620 (10%), 1.747 (5%),
 * 1.862 (2.5%), 2.001 (1%); we adopt the closed-form
 * survival
 *
 *   P(kpVStar > v) = sum_{m=1..} 2 (4 m^2 v^2 - 1) exp(-2 m^2 v^2)
 *
 * (Kuiper 1960 eq. 3.4; Stephens 1970 eq. 1.5; Press et al.
 * "Numerical Recipes" 3rd ed. sec. 14.3.4 routine `kuiper`).
 * The series converges to ~1e-12 in <= 100 terms across the
 * operating range used by the test (kpVStar in [0.5, 5]);
 * we cap at m = 100 with an absolute-tolerance early exit.
 *
 * READING:
 *
 *   - kpVStar small (~0)  -> C[j] tracks j/K everywhere
 *                            with only tiny one-sided
 *                            excursions in either direction;
 *                            kpPValue near 1.
 *   - kpVStar large       -> the cumulative spectrum has
 *                            BOTH a noticeable positive
 *                            excursion AND a noticeable
 *                            negative excursion; the PSD is
 *                            biased AWAY FROM uniform in BOTH
 *                            directions (e.g. mass redistributed
 *                            from mid-band to BOTH the low-
 *                            and high-frequency tails);
 *                            kpPValue near 0.
 *   - kpPValue < 0.05     -> reject H0 of white noise at 5%
 *                            in the SUM-OF-EXCURSIONS sense.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs `daily-token-bartlett-cumulative-periodogram`
 *     (axis-167): SAME statistic domain (the cumulative
 *     periodogram C[j] - j/K), DIFFERENT NORM. Bartlett is
 *     the SUP-NORM of |C[j] - j/K| -- the LARGER of the
 *     two one-sided maxima. Kuiper is the SUM of BOTH one-
 *     sided maxima. PRIMARY witness: a spectrum whose
 *     cumulative process has ONE LARGE positive excursion
 *     and ONE LARGE negative excursion of similar magnitude
 *     yields kpV near 2*max but Bartlett bD = max -- Kuiper
 *     reports approximately TWICE the signal Bartlett does.
 *     A spectrum with only a one-sided excursion (e.g.
 *     uniform low-frequency excess and zero high-frequency
 *     deficit) yields kpV approximately = bD -- the two
 *     statistics agree. Kuiper is therefore SHIFT-INVARIANT
 *     on the circular cumulative process while Bartlett is
 *     not (Kuiper 1960 abstract: "the test is invariant
 *     under cyclic permutations of the sample"). This is
 *     exactly the textbook orthogonality between Kolmogorov-
 *     Smirnov and Kuiper on the EDF (Stephens 1970).
 *
 *   - vs `daily-token-cramer-von-mises-cumulative-periodogram`
 *     (axis-168) and
 *     `daily-token-anderson-darling-cumulative-periodogram`
 *     (axis-169): SAME statistic domain, DIFFERENT NORM
 *     ENTIRELY. CvM and AD are L^2 functionals (uniform-
 *     weighted and tail-weighted respectively); Kuiper is
 *     a sum of two one-sided L^infty extrema. A single-bin
 *     SPIKE drives Kuiper kpV large (one-sided excursion
 *     proportional to the spike) but CvM/AD only modestly
 *     (one large pointwise contribution averaged against
 *     K-1 small ones). A SUSTAINED sinusoidal-shape PSD
 *     with both a low-band excess and a high-band deficit
 *     drives Kuiper LARGE (BOTH excursions add) and CvM
 *     also large (sustained departure) but their relative
 *     ratio differs from the spike case.
 *
 *   - vs `daily-token-fisher-g-periodicity` (axis-166):
 *     Fisher's g is a MAX-SHARE of one bin (bin-permutation
 *     -INVARIANT); Kuiper is bin-permutation-SENSITIVE
 *     (cumulative ordering across bins).
 *
 *   - vs all 2nd-moment spectral descriptors (centroid,
 *     bandwidth, kurtosis, skewness, rolloff, flatness,
 *     entropy): those are MOMENTS / SCALARS of the PSD
 *     shape; Kuiper is a CALIBRATED p-value with a
 *     two-sided sup-norm functional.
 *
 *   - vs the time-domain serial-dependence tests (durbin-
 *     watson 162, runs-test 163, rank-vN 164, hoeffding-d
 *     165, ljung-box-Q 158, mcleod-li 159): all are time-
 *     domain; Kuiper is frequency-domain on the cumulative
 *     periodogram.
 *
 *   - vs the halves axes (115-118, 167-171 halves variants):
 *     halves axes compare TWO HALVES of the time series;
 *     Kuiper-V-CPM tests the ENTIRE series's PSD against
 *     uniform.
 *
 * BOUND: kpV in [0, 1]. kpVStar in [0, ~sqrt(K)+1]. kpPValue
 * in [0, 1].
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
 *     drives kpV toward 0.
 *   - BIN-PERMUTATION: NOT invariant -- C[j] cumulative
 *     ordering is permutation-sensitive.
 *   - BIN-CYCLIC-ROTATION: kpV INVARIANT in magnitude on the
 *     circular cumulative process (this is Kuiper's claim
 *     to fame for testing distributions on a circle); on the
 *     linear K-bin process the invariance is approximate to
 *     within the boundary-bin contribution.
 *   - BIN-REVERSAL k -> K + 1 - k: (kpDPlus, kpDMinus) swap
 *     and kpV is INVARIANT.
 *
 * REFERENCES:
 *
 *   Kuiper, N. H. "Tests concerning random points on a
 *     circle", Proc. Koninklijke Nederlandse Akademie van
 *     Wetenschappen, ser. A 63 (1960) 38-47 -- the original
 *     definition of V = D+ + D- and the asymptotic
 *     survival function.
 *   Stephens, M. A. "Use of the Kolmogorov-Smirnov, Cramer-
 *     von Mises and related statistics without extensive
 *     tables", J. R. Stat. Soc. B 32(1) (1970) 115-122 --
 *     standardisation `kpVStar = (sqrt(K) + 0.155 + 0.24/sqrt(K))*V`
 *     and tabulated critical values.
 *   Press, W. H., Teukolsky, S. A., Vetterling, W. T. &
 *     Flannery, B. P. "Numerical Recipes: The Art of
 *     Scientific Computing", 3rd ed., Cambridge University
 *     Press, 2007, sec. 14.3.4 -- routine `kuiper` for
 *     the survival series.
 *   Brockwell, P. J. & Davis, R. A. "Time Series: Theory
 *     and Methods", 2nd ed., Springer, 1991, §10.2 --
 *     application of EDF tests to the cumulative periodogram.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when
 * the computed kpV / kpPValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenKuiperVCumulativePeriodogramSort =
  | 'kpV'
  | 'kpVDesc'
  | 'kpVStar'
  | 'kpVStarDesc'
  | 'kpPValue'
  | 'kpPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKuiperVCumulativePeriodogramOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and the Kuiper standardisation is in its asymptotic
   * regime.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKuiperVCumulativePeriodogramSort;
  generatedAt?: string;
}

export interface DailyTokenKuiperVCumulativePeriodogramSourceRow {
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
  /** raw kpDPlus  = max_j (C[j] - j/K), clamped at 0. */
  kpDPlus: number;
  /** raw kpDMinus = max_j (j/K - C[j]), clamped at 0. */
  kpDMinus: number;
  /** raw kpV = kpDPlus + kpDMinus, in [0, 1]. */
  kpV: number;
  /** standardised kpVStar = (sqrt(K) + 0.155 + 0.24/sqrt(K)) * kpV. */
  kpVStar: number;
  /** Kuiper 1960 / Stephens 1970 survival p-value, in [0, 1]. */
  kpPValue: number;
  /**
   * Argmax-bin (1-indexed) achieving kpDPlus.
   *   Small jPlus  -> low-frequency excess (LF tail bias).
   *   Large jPlus  -> high-frequency excess (HF tail bias).
   */
  kpJPlus: number;
  /** Argmax-bin (1-indexed) achieving kpDMinus. */
  kpJMinus: number;
}

export interface DailyTokenKuiperVCumulativePeriodogramReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKuiperVCumulativePeriodogramSort;
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
  sources: DailyTokenKuiperVCumulativePeriodogramSourceRow[];
}

/**
 * Kuiper V survival function P(V* > v) via the asymptotic
 * series (Kuiper 1960 eq. 3.4; Stephens 1970 eq. 1.5):
 *
 *   P(V* > v) = sum_{m=1..} 2 (4 m^2 v^2 - 1) exp(-2 m^2 v^2)
 *
 * Edge cases:
 *   - v <= 0           -> p = 1
 *   - v very large     -> p ~ 0 (early-exit when the running
 *                         partial sum is below 1e-30 in
 *                         absolute value)
 *   - non-finite v     -> throws
 *
 * The series alternates in sign for moderate v but the partial
 * sums converge from above for v >= 0.4 (verified by the test
 * sweep against Stephens 1970 Table 1 critical values).
 *
 * Cap at m = 100 with an absolute-tolerance early exit at
 * 1e-15.
 */
export function kuiperVSurvival(v: number): number {
  if (!Number.isFinite(v)) {
    throw new Error(`kuiperVSurvival: non-finite input (${v})`);
  }
  if (v <= 0) return 1;
  // For very small v the series is dominated by the m=1 term
  // 2*(4 v^2 - 1)*exp(-2 v^2) which is NEGATIVE for v < 0.5,
  // so the cumulative survival CAN exceed 1 in the partial
  // sums; clamp to [0, 1] at the end.
  let sum = 0;
  for (let m = 1; m <= 100; m += 1) {
    const m2v2 = m * m * v * v;
    const term = 2 * (4 * m2v2 - 1) * Math.exp(-2 * m2v2);
    sum += term;
    if (Math.abs(term) < 1e-15 && m >= 3) break;
  }
  if (sum < 0) return 0;
  if (sum > 1) return 1;
  return sum;
}

/**
 * Kuiper V cumulative-periodogram statistic on a non-negative
 * power vector indexed by k = 1..power.length.
 *
 * Returns
 *   { kpDPlus, kpDMinus, kpV, kpVStar, kpPValue,
 *     kpJPlus, kpJMinus, totalPower }.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> C[j] = j/K exactly,
 *                          kpDPlus = 0, kpDMinus = 0,
 *                          kpV = 0, kpVStar = 0, p = 1.
 *   - K=K, P=[1,0,...,0] -> C[1..K-1] = 1,
 *                          dev[j] = 1 - j/K  (always > 0),
 *                          kpDPlus = 1 - 1/K (at j=1),
 *                          kpDMinus = 0,
 *                          kpV = 1 - 1/K.
 *   - K=K, P=[0,...,0,1] -> C[1..K-1] = 0,
 *                          dev[j] = -j/K  (always < 0),
 *                          kpDPlus = 0,
 *                          kpDMinus = (K-1)/K (at j=K-1),
 *                          kpV = (K-1)/K.
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function kuiperVCumulativePeriodogramStatistic(power: number[]): {
  kpDPlus: number;
  kpDMinus: number;
  kpV: number;
  kpVStar: number;
  kpPValue: number;
  kpJPlus: number;
  kpJMinus: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `kuiperVCumulativePeriodogramStatistic: too few bins (${K}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `kuiperVCumulativePeriodogramStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `kuiperVCumulativePeriodogramStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `kuiperVCumulativePeriodogramStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  let cum = 0;
  let kpDPlus = 0;
  let kpDMinus = 0;
  let kpJPlus = 0;
  let kpJMinus = 0;
  // Loop j = 1..K-1 inclusive. j = K is the trivial endpoint
  // where C[K] = 1 = K/K so contributes zero deviation; we
  // exclude it exactly as Kuiper 1960 prescribes (the
  // continuous integral excludes the right endpoint) and
  // as axes 167-169 do.
  for (let j = 1; j <= K - 1; j += 1) {
    cum += power[j - 1]!;
    const cj = cum / totalPower;
    const fj = j / K;
    const dev = cj - fj;
    if (dev > kpDPlus) {
      kpDPlus = dev;
      kpJPlus = j;
    }
    if (-dev > kpDMinus) {
      kpDMinus = -dev;
      kpJMinus = j;
    }
  }
  const kpV = kpDPlus + kpDMinus;
  const sqrtK = Math.sqrt(K);
  const kpVStar = (sqrtK + 0.155 + 0.24 / sqrtK) * kpV;
  const kpPValue = kuiperVSurvival(kpVStar);
  if (
    !Number.isFinite(kpDPlus) ||
    !Number.isFinite(kpDMinus) ||
    !Number.isFinite(kpV) ||
    !Number.isFinite(kpVStar) ||
    !Number.isFinite(kpPValue)
  ) {
    throw new Error(
      `kuiperVCumulativePeriodogramStatistic: non-finite output (kpV=${kpV}, kpVStar=${kpVStar}, kpPValue=${kpPValue})`,
    );
  }
  return {
    kpDPlus,
    kpDMinus,
    kpV,
    kpVStar,
    kpPValue,
    kpJPlus,
    kpJMinus,
    totalPower,
  };
}

export function dailyTokenKuiperVCumulativePeriodogram(values: number[]): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  kpDPlus: number;
  kpDMinus: number;
  kpV: number;
  kpVStar: number;
  kpPValue: number;
  kpJPlus: number;
  kpJMinus: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenKuiperVCumulativePeriodogram: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenKuiperVCumulativePeriodogram requires finite values',
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
      'dailyTokenKuiperVCumulativePeriodogram: zero variance (constant series)',
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
      `dailyTokenKuiperVCumulativePeriodogram: too few bins (${K}; need >= 2)`,
    );
  }
  const r = kuiperVCumulativePeriodogramStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    kpDPlus: r.kpDPlus,
    kpDMinus: r.kpDMinus,
    kpV: r.kpV,
    kpVStar: r.kpVStar,
    kpPValue: r.kpPValue,
    kpJPlus: r.kpJPlus,
    kpJMinus: r.kpJMinus,
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

export function buildDailyTokenKuiperVCumulativePeriodogram(
  queue: QueueLine[],
  opts: DailyTokenKuiperVCumulativePeriodogramOptions = {},
): DailyTokenKuiperVCumulativePeriodogramReport {
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
  const sort: DailyTokenKuiperVCumulativePeriodogramSort =
    opts.sort ?? 'kpPValue';
  const validSorts: DailyTokenKuiperVCumulativePeriodogramSort[] = [
    'kpV',
    'kpVDesc',
    'kpVStar',
    'kpVStarDesc',
    'kpPValue',
    'kpPValueDesc',
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
  const rows: DailyTokenKuiperVCumulativePeriodogramSourceRow[] = [];

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
      result = dailyTokenKuiperVCumulativePeriodogram(filled);
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
      kpDPlus: result.kpDPlus,
      kpDMinus: result.kpDMinus,
      kpV: result.kpV,
      kpVStar: result.kpVStar,
      kpPValue: result.kpPValue,
      kpJPlus: result.kpJPlus,
      kpJMinus: result.kpJMinus,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kpV':
        primary = a.kpV - b.kpV;
        break;
      case 'kpVDesc':
        primary = b.kpV - a.kpV;
        break;
      case 'kpVStar':
        primary = a.kpVStar - b.kpVStar;
        break;
      case 'kpVStarDesc':
        primary = b.kpVStar - a.kpVStar;
        break;
      case 'kpPValue':
        primary = a.kpPValue - b.kpPValue;
        break;
      case 'kpPValueDesc':
        primary = b.kpPValue - a.kpPValue;
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
 * Corpus-level aggregator for axis-172 per-source results.
 * Produces a single corpus-level summary that captures both
 * the COMBINED SIGNIFICANCE (Fisher 1932) and the CORPUS-
 * WIDE TWO-SIDED-EXCURSION ASYMMETRY of the cumulative
 * periodograms.
 *
 * Outputs:
 *
 *   tenureWeightedKpVStar -- weighted average of `kpVStar`
 *     across rows with weights `nTenureDays - 1` (matches
 *     the effective-K weighting of the per-source statistic).
 *
 *   fisherCombinedPValue -- Fisher (1932) combined p-value:
 *
 *       chi2 = -2 * sum_i log(p_i),     p_i = kpPValue_i
 *       fisherCombinedPValue = P(Chi2_{2m} > chi2)
 *
 *     for m = number of valid rows. Computed via the chi-
 *     squared upper-tail routine factored out of axis-169.
 *     Returns 1 when m = 0.
 *
 *   sumKpDPlus / sumKpDMinus -- raw sums of the per-source
 *     one-sided maxima. The companion ratio
 *
 *         twoSidedAsymmetryRatio
 *           = min(sumKpDPlus, sumKpDMinus)
 *             / max(sumKpDPlus, sumKpDMinus)
 *
 *     is in [0, 1] and answers the orthogonality-witness
 *     question:
 *
 *         ratio near 0  -> corpus PSDs are uniformly
 *                          ONE-SIDED (Kuiper degenerates to
 *                          Bartlett at the corpus level);
 *         ratio near 1  -> corpus PSDs balance positive
 *                          and negative cumulative
 *                          excursions (Kuiper signal is
 *                          ~2x Bartlett at the corpus
 *                          level -- the regime where this
 *                          axis adds the most over 167-169).
 *
 *   rowsUsed / rowsSkipped -- defensive book-keeping.
 *
 * Malformed rows (non-finite `kpVStar` / `kpPValue`, non-
 * integer / < 2 nTenureDays, kpDPlus or kpDMinus < 0) are
 * SKIPPED with a counter rather than throwing.
 */
export interface KuiperVCumulativePeriodogramCorpusAggregate {
  tenureWeightedKpVStar: number;
  fisherCombinedPValue: number;
  sumKpDPlus: number;
  sumKpDMinus: number;
  twoSidedAsymmetryRatio: number;
  totalTenureWeight: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateKuiperVCumulativePeriodogram(
  rows: ReadonlyArray<{
    nTenureDays: number;
    kpVStar: number;
    kpPValue: number;
    kpDPlus: number;
    kpDMinus: number;
  }>,
): KuiperVCumulativePeriodogramCorpusAggregate {
  let weightedSum = 0;
  let totalWeight = 0;
  let chi2 = 0;
  let sumKpDPlus = 0;
  let sumKpDMinus = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.kpVStar) ||
      !Number.isFinite(r.kpPValue) ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 2 ||
      !(r.kpDPlus >= 0) ||
      !(r.kpDMinus >= 0)
    ) {
      skipped += 1;
      continue;
    }
    const w = r.nTenureDays - 1;
    weightedSum += w * r.kpVStar;
    totalWeight += w;
    const pClamped = Math.max(1e-300, Math.min(1, r.kpPValue));
    chi2 += -2 * Math.log(pClamped);
    sumKpDPlus += r.kpDPlus;
    sumKpDMinus += r.kpDMinus;
    used += 1;
  }
  if (used === 0) {
    return {
      tenureWeightedKpVStar: 0,
      fisherCombinedPValue: 1,
      sumKpDPlus: 0,
      sumKpDMinus: 0,
      twoSidedAsymmetryRatio: 0,
      totalTenureWeight: 0,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const tenureWeightedKpVStar = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const dof = 2 * used;
  const fisherCombinedPValue = chiSquaredUpperTailLocal(chi2, dof);
  const maxSum = Math.max(sumKpDPlus, sumKpDMinus);
  const minSum = Math.min(sumKpDPlus, sumKpDMinus);
  const twoSidedAsymmetryRatio = maxSum > 0 ? minSum / maxSum : 0;
  return {
    tenureWeightedKpVStar,
    fisherCombinedPValue,
    sumKpDPlus,
    sumKpDMinus,
    twoSidedAsymmetryRatio,
    totalTenureWeight: totalWeight,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Local chi-squared upper-tail `P(Chi^2_k > x)` via the
 * regularised upper incomplete gamma function (Numerical
 * Recipes 6.2). Self-contained -- no cross-axis import. Same
 * algorithm as axis-169 / axis-171 (Lentz continued fraction
 * for x > s+1, power series for x <= s+1, Lanczos log-Gamma).
 *
 * Convergence: ~1e-12 absolute in <= 100 iterations across
 * the operating range used by the Fisher combined-p (k = 2m
 * for m rows; typically k <= 200).
 */
export function chiSquaredUpperTailLocal(x: number, k: number): number {
  if (!Number.isFinite(x)) {
    throw new Error(`chiSquaredUpperTailLocal: non-finite x (${x})`);
  }
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error(`chiSquaredUpperTailLocal: invalid dof k (${k}; need k > 0)`);
  }
  if (x <= 0) return 1;
  const s = k / 2;
  const xHalf = x / 2;
  if (xHalf < s + 1) {
    return 1 - lowerIncompleteGammaSeriesLocal(s, xHalf);
  }
  return upperIncompleteGammaCFLocal(s, xHalf);
}

function lowerIncompleteGammaSeriesLocal(s: number, x: number): number {
  let term = 1 / s;
  let sum = term;
  for (let n = 1; n < 1000; n += 1) {
    term *= x / (s + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGammaLocal(s));
}

function upperIncompleteGammaCFLocal(s: number, x: number): number {
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
  return h * Math.exp(-x + s * Math.log(x) - logGammaLocal(s));
}

function logGammaLocal(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGammaLocal(1 - z);
  }
  z -= 1;
  let a = c[0]!;
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i]! / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}
