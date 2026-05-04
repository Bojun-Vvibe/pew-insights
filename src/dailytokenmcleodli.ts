/**
 * daily-token-mcleod-li-q-test: per-source MCLEOD-LI
 * PORTMANTEAU Q-TEST FOR ARCH / VOLATILITY-CLUSTERING
 * at H lags on the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-FIFTY-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Centre once: e[t] = x[t] - mean(x).
 * Square: u[t] = e[t] * e[t]. Let ubar = mean(u). For
 * each lag k in {1, .., H} compute the BIASED sample
 * autocorrelation OF THE SQUARED RESIDUALS
 *
 *     r2_k = sum_{t=0..n-1-k} (u[t]-ubar)(u[t+k]-ubar)
 *            / sum_{t=0..n-1} (u[t]-ubar)^2
 *
 * (the same Box-Jenkins-Reinsel 1994 sec. 2.1.4
 * biased-acf convention as Ljung-Box, but applied to
 * u rather than x). Define the MCLEOD-LI PORTMANTEAU
 * Q-STATISTIC
 *
 *     Q_ML(H) = n (n + 2) sum_{k=1..H} r2_k^2 / (n - k)
 *
 * (McLeod & Li 1983, J. Time Series Analysis 4(4):
 * 269-273).
 *
 * Under the iid white-noise null with finite eighth
 * moment (the "no-ARCH" null), Q_ML(H) is
 * asymptotically Chi-Square with H degrees of
 * freedom. The standardised score
 *
 *     mlZ = (Q_ML(H) - H) / sqrt(2 H)
 *
 * is approximately N(0, 1). mlZ much greater than
 * +1.96 indicates significant volatility-clustering /
 * conditional-heteroskedasticity ("ARCH effects" in
 * the Engle 1982 sense) -- large absolute deviations
 * tend to follow large absolute deviations and small
 * tend to follow small. mlZ approx 0 indicates that
 * the squared-residual series is white-noise-
 * consistent (constant conditional variance, no
 * volatility memory).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-158:
 *
 *   - vs axis-114 daily-token-ljung-box-q-test.
 *     Ljung-Box is the SAME functional form
 *     (n(n+2) sum r^2/(n-k)) but applied to the
 *     CENTRED LEVEL series e[t]. McLeod-Li applies
 *     the identical functional to the SQUARED level
 *     u[t] = e[t]^2. The two tests are constructed
 *     to be COMPLEMENTARY (McLeod & Li 1983 explicitly
 *     positioned the squared-residual variant as the
 *     diagnostic for ARCH effects after Ljung-Box has
 *     been applied to the level). A series with linear
 *     drift has lbZ much greater than 0 but mlZ approx
 *     0 (the squared-deviation series is white-noise);
 *     a GARCH(1,1) or ARCH(1) series has lbZ approx 0
 *     but mlZ much greater than 0 (level is white but
 *     the variance has memory). The two are
 *     orthogonal in the precise sense that under a
 *     pure-trend null lbZ -> +inf and mlZ -> 0, while
 *     under a pure-ARCH null mlZ -> +inf and lbZ -> 0.
 *
 *   - vs axis-158 Lo-MacKinlay variance-ratio. VR
 *     tests the q-period variance-scaling of the
 *     LEVEL with a Gaussian null on a closed-form
 *     variance estimator. McLeod-Li tests the
 *     portmanteau autocorrelation OF THE SQUARED
 *     LEVEL with a Chi-Square null. VR with vrZ_hc
 *     uses heteroskedasticity-consistent variance
 *     under a martingale-difference null that allows
 *     ARCH; that is, VR is robust against ARCH but
 *     SILENT about its presence. McLeod-Li directly
 *     QUANTIFIES the ARCH effect that VR's hc
 *     correction is robust against.
 *
 *   - vs axis-157 ADF, axis-156 KPSS, axis-155
 *     Buishand range, axis-154 Pettitt change-point,
 *     axis-153 CUSUM drift index. All five are
 *     LEVEL-based stationarity / change-point tests.
 *     McLeod-Li is a SECOND-MOMENT test about the
 *     conditional variance of the residuals.
 *
 *   - vs axis-152 Hampel outlier count, axis-151
 *     Allan deviation. Hampel is a static-window
 *     outlier counter on the level; Allan is a
 *     volatility-of-volatility measure on
 *     non-overlapping window means. McLeod-Li is
 *     a portmanteau autocorrelation test on the
 *     squared centred residuals -- a correlation
 *     statistic, not a count and not a window-mean
 *     dispersion.
 *
 *   - vs the SPECTRAL axes (axis-84..104). Spectral
 *     axes summarise the periodogram of the LEVEL.
 *     McLeod-Li is a TIME-DOMAIN portmanteau
 *     autocorrelation on the SQUARED level. Even
 *     under the Wiener-Khinchin equivalence, the
 *     spectrum of x and the spectrum of x^2 carry
 *     orthogonal information whenever x is non-Gaussian
 *     (which token streams unambiguously are: heavy
 *     right tail, mass at zero on idle days).
 *
 *   - vs the inequality / shape axes. Permutation-
 *     invariant. McLeod-Li depends entirely on the
 *     temporal order of the squared deviations.
 *
 * Headline question:
 * **"For each source, do periods of large absolute
 *   token deviations cluster in time -- do calm days
 *   beget calm days and noisy days beget noisy days
 *   beyond what an iid white-noise level model would
 *   predict?"**
 *
 * Reference:
 *   McLeod, A. I. and Li, W. K., "Diagnostic checking
 *     ARMA time series models using squared-residual
 *     autocorrelations", Journal of Time Series
 *     Analysis 4(4) (1983), pp. 269-273.
 *   Engle, R. F., "Autoregressive conditional
 *     heteroscedasticity with estimates of the
 *     variance of United Kingdom inflation",
 *     Econometrica 50(4) (1982), pp. 987-1007.
 *   Tsay, R. S., "Analysis of Financial Time Series",
 *     3rd ed., Wiley, 2010, sec. 3.2 (squared-residual
 *     diagnostics for ARCH).
 *   Ljung, G. M. and Box, G. E. P., "On a measure of
 *     lack of fit in time series models", Biometrika
 *     65 (1978), pp. 297-303.
 *
 * Caveats:
 *
 *   - Q_ML in [0, +inf). Q_ML approx H = no detectable
 *     ARCH; Q_ML much greater than H = volatility
 *     clustering present.
 *   - Effective H = min(maxLag, floor(n/4)) (same
 *     Box-Jenkins / Hyndman-Athanasopoulos cap as
 *     Ljung-Box). For the 14-day default tenure floor
 *     this gives H = 3.
 *   - Test is BLIND TO SIGN of the squared-residual
 *     autocorrelations and BLIND TO THE LAG that
 *     drives significance. Inspect mlAcf to identify
 *     the dominant lag.
 *   - Under heavy-tailed level distributions (which
 *     daily token series exhibit) the asymptotic
 *     Chi-Square approximation becomes conservative
 *     for finite n; mlZ values in the 1.5..3 band
 *     should be read as suggestive rather than
 *     decisive. mlZ much greater than 3 is robust.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, max-lag=10):
 *   pew-insights daily-token-mcleod-li
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-mcleod-li --json
 *
 *   # Sort by absolute z-score descending:
 *   pew-insights daily-token-mcleod-li --sort mlZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenMcLeodLiSort =
  | 'mlQ'
  | 'mlQDesc'
  | 'mlZ'
  | 'mlZDesc'
  | 'mlZAbs'
  | 'mlZAbsDesc'
  | 'mlAbsAcfMax'
  | 'mlAbsAcfMaxDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMcLeodLiOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  /**
   * Maximum lag H for the squared-residual portmanteau sum.
   * Effective H = min(maxLag, floor(n/4)). Default 10.
   */
  maxLag?: number;
  top?: number;
  sort?: DailyTokenMcLeodLiSort;
  generatedAt?: string;
}

export interface DailyTokenMcLeodLiSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Effective lag count after the min(maxLag, floor(n/4)) cap. */
  mlH: number;
  mlDf: number;
  /** Per-lag biased sample autocorrelations of squared residuals. */
  mlAcf: number[];
  /** McLeod-Li portmanteau Q statistic on squared residuals. */
  mlQ: number;
  /** Standardised score (Q - H) / sqrt(2 H). */
  mlZ: number;
  /**
   * Maximum |r2_k| across k = 1..mlH. Identifies the
   * single most-correlated squared-residual lag.
   * mlQ hides the dominant lag inside the portmanteau
   * sum; mlAbsAcfMax surfaces it directly. Range
   * [0, 1].
   */
  mlAbsAcfMax: number;
  /**
   * The lag k in {1, .., mlH} achieving mlAbsAcfMax.
   * Ties broken by smallest k (shortest-lag wins).
   */
  mlAbsAcfMaxLag: number;
}

export interface DailyTokenMcLeodLiReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  maxLag: number;
  top: number;
  sort: DailyTokenMcLeodLiSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenMcLeodLiSourceRow[];
}

/**
 * McLeod-Li portmanteau Q-test for ARCH /
 * volatility-clustering on a real-valued series at
 * lags 1..H where H = min(maxLag, floor(n/4)).
 *
 * EXACT IDENTITIES preserved (verified by tests):
 *
 *   - mlQ(reverse(x)) === mlQ(x). The biased acf of
 *     squared residuals is time-reversal symmetric.
 *   - mlQ(x + c) === mlQ(x) for any constant c
 *     (centring removes the shift).
 *   - mlQ(a * x) === mlQ(x) for any non-zero scalar
 *     a (numerator and denominator of r2_k both
 *     pick up a factor of a^4 which cancels).
 *   - mlAcf[k] in [-1, +1] by Cauchy-Schwarz on the
 *     centred squared-residual cross-products.
 *   - mlDf === mlH.
 *
 * Closed-form anchors:
 *   - constant series filtered upstream by zero-
 *     variance guard (centred squared sum = 0).
 *   - series with constant absolute deviation, e.g.
 *     x[t] = a + (-1)^t * b for fixed b > 0, has
 *     u[t] = b^2 (constant), centred-u variance = 0
 *     -> filtered as zero squared-residual variance.
 *   - i.i.d. continuous Gaussian level -> r2_k
 *     approx 0 for k > 0, mlQ approx H, mlZ approx 0.
 *   - alternating amplitude (1, 2, 1, 4, 1, 2, 1, 4)
 *     where odd indices are quiet (1) and even
 *     indices alternate large/very-large -> u has
 *     period-2 structure -> r2_2 large positive,
 *     mlQ much greater than H, mlZ much greater than 0.
 *
 * Throws when too short, non-finite, or zero squared-
 * residual variance.
 */
export function dailyTokenMcLeodLi(
  values: number[],
  maxLag = 10,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  mlH: number;
  mlDf: number;
  mlAcf: number[];
  mlQ: number;
  mlZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenMcLeodLi: need at least 4 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(maxLag) || maxLag < 1) {
    throw new Error(
      `dailyTokenMcLeodLi: maxLag must be a positive integer (got ${maxLag})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenMcLeodLi requires finite values');
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;

  // Build squared centred residuals u[t] = (x[t] - mu)^2.
  const u: number[] = new Array(n);
  let levelDenom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    const c2 = c * c;
    u[i] = c2;
    levelDenom += c2;
  }
  const stddev = Math.sqrt(levelDenom / n);
  if (levelDenom === 0) {
    throw new Error(
      `dailyTokenMcLeodLi: zero level variance (n=${n})`,
    );
  }

  // Centre u and compute its centred squared sum.
  let ubar = 0;
  for (const v of u) ubar += v;
  ubar /= n;
  const uc: number[] = new Array(n);
  let denomU = 0;
  for (let i = 0; i < n; i += 1) {
    const c = u[i]! - ubar;
    uc[i] = c;
    denomU += c * c;
  }
  if (denomU === 0) {
    throw new Error(
      `dailyTokenMcLeodLi: zero squared-residual variance (n=${n}); the level deviations all share identical magnitude`,
    );
  }

  const mlH = Math.max(1, Math.min(maxLag, Math.floor(n / 4)));
  const mlAcf: number[] = new Array(mlH);
  let weighted = 0;
  for (let k = 1; k <= mlH; k += 1) {
    let num = 0;
    for (let t = 0; t < n - k; t += 1) {
      num += uc[t]! * uc[t + k]!;
    }
    const r2k = num / denomU;
    mlAcf[k - 1] = r2k;
    weighted += (r2k * r2k) / (n - k);
  }
  const mlQ = n * (n + 2) * weighted;
  const mlDf = mlH;
  const mlZ = (mlQ - mlDf) / Math.sqrt(2 * mlDf);

  if (!Number.isFinite(mlQ) || !Number.isFinite(mlZ)) {
    throw new Error(
      `dailyTokenMcLeodLi: non-finite Q or Z (n=${n}, H=${mlH})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    mlH,
    mlDf,
    mlAcf,
    mlQ,
    mlZ,
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

/**
 * Largest |r2_k| across the lag spectrum and the lag k
 * achieving it. Ties broken by smallest k (shortest-lag
 * wins) -- the convention is that shorter-lag dependence
 * is the more parsimonious explanation when magnitudes
 * tie.
 */
function maxAbs(acf: number[]): { value: number; lag: number } {
  let bestVal = 0;
  let bestLag = 0;
  for (let i = 0; i < acf.length; i += 1) {
    const a = Math.abs(acf[i]!);
    if (a > bestVal) {
      bestVal = a;
      bestLag = i + 1;
    }
  }
  return { value: bestVal, lag: bestLag };
}

export function buildDailyTokenMcLeodLi(
  queue: QueueLine[],
  opts: DailyTokenMcLeodLiOptions = {},
): DailyTokenMcLeodLiReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const maxLag = opts.maxLag ?? 10;
  if (!Number.isInteger(maxLag) || maxLag < 1) {
    throw new Error(`maxLag must be a positive integer (got ${opts.maxLag})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenMcLeodLiSort = opts.sort ?? 'mlZAbsDesc';
  const validSorts: DailyTokenMcLeodLiSort[] = [
    'mlQ',
    'mlQDesc',
    'mlZ',
    'mlZDesc',
    'mlZAbs',
    'mlZAbsDesc',
    'mlAbsAcfMax',
    'mlAbsAcfMaxDesc',
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
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenMcLeodLiSourceRow[] = [];

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
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenMcLeodLi(filled, maxLag);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      mlH: result.mlH,
      mlDf: result.mlDf,
      mlAcf: result.mlAcf,
      mlQ: result.mlQ,
      mlZ: result.mlZ,
      mlAbsAcfMax: maxAbs(result.mlAcf).value,
      mlAbsAcfMaxLag: maxAbs(result.mlAcf).lag,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mlQ':
        primary = a.mlQ - b.mlQ;
        break;
      case 'mlQDesc':
        primary = b.mlQ - a.mlQ;
        break;
      case 'mlZ':
        primary = a.mlZ - b.mlZ;
        break;
      case 'mlZDesc':
        primary = b.mlZ - a.mlZ;
        break;
      case 'mlZAbs':
        primary = Math.abs(a.mlZ) - Math.abs(b.mlZ);
        break;
      case 'mlZAbsDesc':
        primary = Math.abs(b.mlZ) - Math.abs(a.mlZ);
        break;
      case 'mlAbsAcfMax':
        primary = a.mlAbsAcfMax - b.mlAbsAcfMax;
        break;
      case 'mlAbsAcfMaxDesc':
        primary = b.mlAbsAcfMax - a.mlAbsAcfMax;
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
    maxLag,
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
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
