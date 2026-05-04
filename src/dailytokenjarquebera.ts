/**
 * daily-token-jarque-bera: per-source JARQUE-BERA
 * MOMENT-BASED LM TEST FOR NORMALITY of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTY-FIRST cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Let mu = mean(x),
 * m_k = (1/n) sum (x[t] - mu)^k for k = 2, 3, 4.
 * The sample SKEWNESS and EXCESS KURTOSIS are
 *
 *     S = m_3 / m_2^{3/2}
 *     K = m_4 / m_2^{2} - 3
 *
 * The JARQUE-BERA STATISTIC is
 *
 *     JB = (n / 6) * ( S^2 + (1/4) * K^2 )
 *
 * (Jarque & Bera 1980 Econ. Letters 6:255-259;
 *  Jarque & Bera 1987 Int. Stat. Rev. 55:163-172).
 *
 * Under the iid Gaussian null, JB is asymptotically
 * Chi-Square with 2 degrees of freedom (one for S, one
 * for K). The standardised score
 *
 *     jbZ = (JB - 2) / sqrt(4) = (JB - 2) / 2
 *
 * (Chi-Square(2) has mean 2 and variance 4) is
 * approximately N(0, 1) for large n. jbZ much greater
 * than +1.96 indicates significant departure from
 * Gaussianity in skewness and/or kurtosis. The
 * one-sided upper-tail Chi-Square(2) p-value has the
 * closed form
 *
 *     pApprox = exp(-JB / 2)
 *
 * (Chi-Square(2) === Exponential(rate 1/2)). pApprox
 * < 0.05 iff JB > 2 ln 20 approx 5.991.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-160:
 *
 *   - vs the AXES THAT TEST INDEPENDENCE / SERIAL
 *     STRUCTURE (axis-160 BDS, axis-159 McLeod-Li,
 *     axis-158 VR Lo-MacKinlay, axis-114 Ljung-Box).
 *     All four are TIME-ORDER tests: their statistics
 *     change under permutation of x. JARQUE-BERA is
 *     PERMUTATION-INVARIANT -- it only sees the
 *     unordered multiset of values. A series can be
 *     i.i.d. (BDS, ML, VR, LB all approximately 0)
 *     while having JB much greater than 0 (heavy-
 *     tailed iid lognormal); conversely a series can
 *     be perfectly Gaussian-marginal (JB approx 0)
 *     while having strong serial structure (BDS, ML,
 *     LB much greater than 0). JB targets the
 *     MARGINAL DISTRIBUTION SHAPE; the four serial
 *     tests target the JOINT DEPENDENCE STRUCTURE.
 *
 *   - vs the STATIONARITY / CHANGEPOINT AXES
 *     (axis-157 ADF, axis-156 KPSS, axis-155 Buishand
 *     range, axis-154 Pettitt, axis-153 CUSUM).
 *     Those test the LEVEL TRAJECTORY for a unit
 *     root, level-stationarity, range-of-cumdev, or
 *     a changepoint. JB is silent about trajectory
 *     and decisive about marginal shape. A pure
 *     linear trend in iid Gaussian noise has JB
 *     approx 0 (centring removes the trend's effect
 *     on m_3 and m_4 only weakly via the residual
 *     skew/kurtosis -- the dominant signal lives in
 *     ADF / KPSS / Buishand).
 *
 *   - vs the CDF-DISTANCE-BETWEEN-HALVES AXES
 *     (Anderson-Darling halves axis-..., Cramer-von
 *     Mises halves, KS halves, etc.). Those compare
 *     the EMPIRICAL CDF of the FIRST HALF vs the
 *     SECOND HALF -- they detect distributional
 *     DRIFT between two windows. JB compares the
 *     WHOLE empirical distribution to a SINGLE
 *     reference (Gaussian) via two moments. A
 *     stationary heavy-tailed iid stream has JB much
 *     greater than 0 but every halves-distance
 *     approx 0; a slow level shift in iid Gaussian
 *     has halves-distances much greater than 0 but
 *     JB approx 0.
 *
 *   - vs the SHAPE / SKEWNESS / KURTOSIS AXES (raw
 *     skewness, raw kurtosis, Bowley skewness,
 *     L-skewness, medcouple etc.). Those expose
 *     INDIVIDUAL moment shape statistics one at a
 *     time. JB is the single JOINT LM TEST that
 *     COMBINES skewness and kurtosis into one
 *     calibrated Chi-Square decision -- the smallest
 *     sufficient summary for "is the marginal
 *     plausibly Gaussian?". The constituent S and K
 *     are surfaced for diagnostic decomposition (the
 *     same way BDS surfaces C(1) and C(m)), but the
 *     JOINT TEST is what makes axis-161 a primitive
 *     and not a derived field of any of those.
 *
 *   - vs the INEQUALITY axes (Gini, Theil, Atkinson,
 *     Hoover, ...). Inequality measures are
 *     scale-equivariant ratios sensitive to the
 *     RELATIVE SPREAD of the upper / lower tails.
 *     JB is a scale-invariant moment-LM test
 *     calibrated to a parametric (Gaussian) null.
 *
 * Headline question:
 * **"For each source, is the daily token volume
 *   plausibly drawn iid from a Gaussian distribution,
 *   or do the third (skew) and fourth (kurtosis)
 *   moments jointly reject normality?"**
 *
 * Reference:
 *   Jarque, C. M. and Bera, A. K., "Efficient tests for
 *     normality, homoscedasticity and serial
 *     independence of regression residuals", Economics
 *     Letters 6(3) (1980), pp. 255-259.
 *   Jarque, C. M. and Bera, A. K., "A test for normality
 *     of observations and regression residuals",
 *     International Statistical Review 55(2) (1987),
 *     pp. 163-172.
 *   Bowman, K. O. and Shenton, L. R., "Omnibus test
 *     contours for departures from normality based on
 *     sqrt(b1) and b2", Biometrika 62(2) (1975),
 *     pp. 243-250 (the bivariate moment-pair test JB
 *     descends from).
 *
 * Caveats:
 *
 *   - JB in [0, +inf). JB approx 0 = sample skew and
 *     excess kurtosis both approx 0 (Gaussian-like
 *     marginal); JB much greater than 5.991 = reject
 *     Gaussian at alpha = 0.05 by Chi-Square(2).
 *   - The Chi-Square(2) approximation is asymptotic.
 *     For small n (n < 30) it tends to over-reject;
 *     pApprox should be read as suggestive in the
 *     14..30 day tenure band.
 *   - JB is BLIND TO WHICH MOMENT (skew or kurtosis)
 *     drives rejection. Inspect skewness and
 *     excessKurtosis directly to attribute. A
 *     symmetric heavy-tailed stream has S approx 0
 *     and K much greater than 0 (rejection from
 *     kurtosis); a one-sided burst stream has S
 *     much greater than 0 and K elevated (joint).
 *   - Test is PERMUTATION-INVARIANT: completely
 *     decoupled from temporal ordering. Use in
 *     COMPOSITION with axis-160 BDS to separate
 *     "non-Gaussian iid" (JB high, BDS approx 0)
 *     from "Gaussian-marginal but serially
 *     dependent" (BDS high, JB approx 0).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-jarque-bera
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-jarque-bera --json
 *
 *   # Sort by JB statistic descending (largest non-
 *   # Gaussianity first):
 *   pew-insights daily-token-jarque-bera --sort jbDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenJarqueBeraSort =
  | 'jb'
  | 'jbDesc'
  | 'jbZ'
  | 'jbZDesc'
  | 'skewAbs'
  | 'skewAbsDesc'
  | 'kurtAbs'
  | 'kurtAbsDesc'
  | 'skewContribFraction'
  | 'skewContribFractionDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type JbVerdict =
  | 'gaussian'
  | 'borderline'
  | 'non-gaussian'
  | 'strongly-non-gaussian';

export interface DailyTokenJarqueBeraOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenJarqueBeraSort;
  generatedAt?: string;
}

export interface DailyTokenJarqueBeraSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Sample skewness S = m3 / m2^{3/2}. */
  skewness: number;
  /** Sample EXCESS kurtosis K = m4 / m2^2 - 3. */
  excessKurtosis: number;
  /** Jarque-Bera statistic JB = (n/6)(S^2 + K^2/4). */
  jb: number;
  /** Standardised score (JB - 2) / 2. */
  jbZ: number;
  /** Closed-form upper-tail Chi-Square(2) p-value: exp(-JB / 2). */
  jbPApprox: number;
  /**
   * Fraction of JB driven by SKEWNESS rather than EXCESS
   * KURTOSIS:
   *
   *   jbSkewContribFraction = S^2 / ( S^2 + K^2 / 4 )
   *
   * In [0, 1]. 1 means the rejection is entirely
   * skewness-driven (asymmetric heavy tail on one side);
   * 0 means entirely kurtosis-driven (symmetric heavy
   * tails / sharp peak); 0.5 means the two moments
   * contribute equally to JB. The complement
   * (1 - jbSkewContribFraction) is the kurtosis share.
   * Defined as 0 when the denominator is exactly 0
   * (only possible when both S and K are exactly 0,
   * i.e. a perfectly Gaussian-moment sample).
   *
   * This is the JB "axis of rejection" -- two sources
   * with the same JB can have very different
   * jbSkewContribFraction and therefore very different
   * marginal-shape stories. The original axis-161 caveat
   * notes that "JB is BLIND TO WHICH MOMENT drives
   * rejection -- inspect skewness and excessKurtosis
   * directly to attribute"; jbSkewContribFraction is the
   * single-number summary of that attribution.
   */
  jbSkewContribFraction: number;
  /** Verdict by Chi-Square(2) cutoffs (see VERDICT_CUTOFFS). */
  verdict: JbVerdict;
}

export interface DailyTokenJarqueBeraReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenJarqueBeraSort;
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
  sources: DailyTokenJarqueBeraSourceRow[];
}

/**
 * Verdict cutoffs by upper-tail Chi-Square(2) p-value
 * (equivalently by JB itself since p = exp(-JB/2)):
 *
 *   gaussian              p > 0.20  iff JB <  3.219
 *   borderline    0.05 <  p <= 0.20 iff 3.219 <= JB <  5.991
 *   non-gaussian  0.01 <  p <= 0.05 iff 5.991 <= JB <  9.210
 *   strongly-non-gaussian p <= 0.01 iff JB >= 9.210
 */
const JB_GAUSSIAN_MAX = 3.218875824868201; // -2*ln(0.20)
const JB_BORDERLINE_MAX = 5.991464547107982; // ChiSq(2) 95th
const JB_NONGAUSSIAN_MAX = 9.210340371976184; // -2*ln(0.01)

function classifyJb(jb: number): JbVerdict {
  if (jb < JB_GAUSSIAN_MAX) return 'gaussian';
  if (jb < JB_BORDERLINE_MAX) return 'borderline';
  if (jb < JB_NONGAUSSIAN_MAX) return 'non-gaussian';
  return 'strongly-non-gaussian';
}

/**
 * Jarque-Bera moment-based normality test on a real-
 * valued series of length n >= 4.
 *
 * EXACT IDENTITIES preserved (verified by tests):
 *
 *   - jb(reverse(x)) === jb(x). Permutation-invariant.
 *   - jb(x + c) === jb(x) for any constant c (centring
 *     removes the shift).
 *   - jb(a * x) === jb(x) for any non-zero scalar a
 *     (m_k scales as a^k; numerator and denominator of
 *     S and K both scale identically and cancel).
 *   - jbZ === (jb - 2) / 2.
 *   - jbPApprox === exp(-jb / 2) in [0, 1].
 *   - For a perfectly symmetric two-point distribution
 *     {-1, +1, -1, +1, ...} (n even): S = 0,
 *     K = -2 (excess kurtosis of two-point), so
 *     JB = (n/6)(0 + (1/4) * 4) = n / 6.
 *
 * Closed-form anchors:
 *   - constant series filtered upstream by zero-
 *     variance guard (m_2 = 0).
 *   - Gaussian iid: S approx 0, K approx 0,
 *     JB approx 0, jbZ approx -1.
 *
 * Throws when too short, non-finite, or zero variance.
 */
export function dailyTokenJarqueBera(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  skewness: number;
  excessKurtosis: number;
  jb: number;
  jbZ: number;
  jbPApprox: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenJarqueBera: need at least 4 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenJarqueBera requires finite values');
    }
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;

  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of values) {
    const d = v - mu;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
    m4 += d2 * d2;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;

  if (m2 === 0) {
    throw new Error(
      `dailyTokenJarqueBera: zero level variance (n=${n})`,
    );
  }

  const stddev = Math.sqrt(m2);
  const skewness = m3 / (m2 * stddev); // m_3 / m_2^{3/2}
  const excessKurtosis = m4 / (m2 * m2) - 3;
  const jb = (n / 6) * (skewness * skewness + (excessKurtosis * excessKurtosis) / 4);
  const jbZ = (jb - 2) / 2;
  const jbPApprox = Math.exp(-jb / 2);

  if (
    !Number.isFinite(skewness) ||
    !Number.isFinite(excessKurtosis) ||
    !Number.isFinite(jb)
  ) {
    throw new Error(
      `dailyTokenJarqueBera: non-finite moment fit (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    skewness,
    excessKurtosis,
    jb,
    jbZ,
    jbPApprox,
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

export function buildDailyTokenJarqueBera(
  queue: QueueLine[],
  opts: DailyTokenJarqueBeraOptions = {},
): DailyTokenJarqueBeraReport {
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
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenJarqueBeraSort = opts.sort ?? 'jbDesc';
  const validSorts: DailyTokenJarqueBeraSort[] = [
    'jb',
    'jbDesc',
    'jbZ',
    'jbZDesc',
    'skewAbs',
    'skewAbsDesc',
    'kurtAbs',
    'kurtAbsDesc',
    'skewContribFraction',
    'skewContribFractionDesc',
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
  const rows: DailyTokenJarqueBeraSourceRow[] = [];

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
      result = dailyTokenJarqueBera(filled);
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
      skewness: result.skewness,
      excessKurtosis: result.excessKurtosis,
      jb: result.jb,
      jbZ: result.jbZ,
      jbPApprox: result.jbPApprox,
      jbSkewContribFraction: (() => {
        const s2 = result.skewness * result.skewness;
        const k2over4 =
          (result.excessKurtosis * result.excessKurtosis) / 4;
        const denom = s2 + k2over4;
        return denom === 0 ? 0 : s2 / denom;
      })(),
      verdict: classifyJb(result.jb),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'jb':
        primary = a.jb - b.jb;
        break;
      case 'jbDesc':
        primary = b.jb - a.jb;
        break;
      case 'jbZ':
        primary = a.jbZ - b.jbZ;
        break;
      case 'jbZDesc':
        primary = b.jbZ - a.jbZ;
        break;
      case 'skewAbs':
        primary = Math.abs(a.skewness) - Math.abs(b.skewness);
        break;
      case 'skewAbsDesc':
        primary = Math.abs(b.skewness) - Math.abs(a.skewness);
        break;
      case 'kurtAbs':
        primary = Math.abs(a.excessKurtosis) - Math.abs(b.excessKurtosis);
        break;
      case 'kurtAbsDesc':
        primary = Math.abs(b.excessKurtosis) - Math.abs(a.excessKurtosis);
        break;
      case 'skewContribFraction':
        primary = a.jbSkewContribFraction - b.jbSkewContribFraction;
        break;
      case 'skewContribFractionDesc':
        primary = b.jbSkewContribFraction - a.jbSkewContribFraction;
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
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
