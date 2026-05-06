/**
 * daily-token-inclan-tiao-icss-variance-changepoint:
 * per-source INCLÁN-TIAO 1994 ICSS VARIANCE-CHANGEPOINT
 * TEST on the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-THIRD cross-source axis.
 *
 * Mechanism. Inclán, C. & Tiao, G. C. (1994), "Use of
 * cumulative sums of squares for retrospective detection of
 * changes of variance", *J. Amer. Statist. Assoc.* 89:913-
 * 923. The "IT" / "ICSS" statistic.
 *
 * Let x[0..n-1] be the gap-filled daily token series for
 * one source (n = nTenureDays >= 21). Mean-centre the
 * series to remove first-moment effects:
 *
 *     y[i] = x[i] - mean(x)                                (1)
 *
 * Form the CUMULATIVE SUM OF SQUARES:
 *
 *     C[k]   = sum_{i=0..k} y[i]^2,    k in {0..n-1}      (2)
 *
 * and the centred ICSS process:
 *
 *     D[k]   = C[k] / C[n-1]  -  (k + 1) / n              (3)
 *
 * The Inclán-Tiao test statistic is:
 *
 *     IT     = sqrt(n / 2) * max_{0 <= k < n-1} |D[k]|     (4)
 *
 * (the last point D[n-1] = 0 by construction, excluded.)
 *
 * Under H0 of CONSTANT (UNCONDITIONAL) VARIANCE, and
 * assuming y[i] are iid with finite fourth moment,
 *
 *     sqrt(n / 2) * D[floor(n*t)]  -->  B_0(t)             (5)
 *
 * weakly on D[0,1], where B_0 is a standard Brownian
 * bridge. Therefore IT has the Kolmogorov distribution,
 *
 *     Pr(IT > c)  =  2 * sum_{j=1..inf} (-1)^{j+1}
 *                                       * exp(-2 j^2 c^2)  (6)
 *
 * which is the same distribution as the two-sided
 * Kolmogorov-Smirnov statistic. Critical values: c_{0.05}
 * = 1.358, c_{0.01} = 1.628 (Inclán-Tiao 1994 Table 1).
 *
 * The MOST-LIKELY VARIANCE-CHANGEPOINT is
 *
 *     kStar  = argmax_{0 <= k < n-1} |D[k]|                (7)
 *
 * with directionSign = sign(D[kStar]). Positive D[kStar]
 * means the cumulative sum of squares ACCUMULATES FASTER
 * than the (k+1)/n null line up to kStar -- i.e., HIGHER
 * VARIANCE in the LEFT segment x[0..kStar]. Negative
 * D[kStar] means HIGHER VARIANCE in the RIGHT segment
 * x[kStar+1..n-1].
 *
 * Variance-shift diagnostics surfaced:
 *
 *   - varBefore = var(y[0..kStar])              (n_a divisor)
 *   - varAfter  = var(y[kStar+1..n-1])          (n_b divisor)
 *   - logVarRatio = ln(varAfter / varBefore)
 *     (positive = variance INCREASES after kStar; negative
 *     = variance DECREASES after kStar; consistent with
 *     directionSign * (-1) up to ties).
 *   - itStat = the IT test statistic in (4).
 *   - dStar = D[kStar].
 *   - kCritical05 / kCritical01 = the Inclán-Tiao 1994
 *     Table-1 asymptotic critical values 1.358 and 1.628.
 *   - lEdgeRatio = max(D[0]^2, D[n-2]^2) / D[kStar]^2
 *     in [0, 1]: edge-of-window peaks indicating boundary
 *     effects where the asymptotic approximation is least
 *     reliable.
 *   - secondPeakRatio: the second-best |D[k]| outside a
 *     guard window of +/- max(3, ceil(n/10)) days, relative
 *     to the primary. Close to 1 = MULTIPLE variance
 *     regimes; the full ICSS algorithm (Inclán-Tiao 1994
 *     sec. 3) iterates segment-by-segment but here we
 *     surface the candidate explicitly without recursion.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * All forty-one preceding cross-source axes 181-222 test
 * either for (a) MONOTONE TREND in the FIRST MOMENT
 * (Theil-Sen 181, Mann-Kendall variants 195-200, Hirsch-
 * Slack 218, Sen-Adichie 219, Hamed-Rao 220), (b) a
 * CHANGEPOINT in the FIRST MOMENT (Pettitt 154, Buys-
 * Ballot 215, Laplace centroid 217, SNHT 221, Lombard 222),
 * or (c) a STRUCTURAL/PERIODIC pattern in the FIRST MOMENT
 * (Cox-Stuart thirds 213, Buys-Ballot 215, Page-L 207).
 *
 * Inclán-Tiao 1994 ICSS is the FIRST cross-source axis to
 * test for a CHANGEPOINT IN THE SECOND MOMENT (variance /
 * scale). Specifically:
 *
 *   1. NULL HYPOTHESIS: H0: Var(x[i]) = sigma^2 constant
 *      across i (NOT E[x[i]] = mu constant). Lombard, SNHT,
 *      Pettitt all assume constant variance and test for a
 *      shift in mean; ICSS does the OPPOSITE -- mean is
 *      assumed constant (or removed via centring) and the
 *      target is a shift in variance.
 *   2. STATISTIC FAMILY: SQUARED-RESIDUAL CUMULATIVE
 *      DEVIATION (Brownian-bridge limit on cusum-of-
 *      squares). Lombard: smoothed-rank cumulative
 *      deviation. SNHT: two-mean partition log-likelihood.
 *      Pettitt: two-rank-sum max. Hamed-Rao MK: rank
 *      autocorrelation-corrected slope. ICSS uses
 *      MAGNITUDES OF SQUARES, which is invariant under
 *      mean-shifts and orthogonal to all rank tests.
 *   3. ASYMPTOTIC NULL DISTRIBUTION: Kolmogorov-Smirnov
 *      sup-norm Brownian bridge. Lombard: Anderson-Darling-
 *      like INTEGRATED Brownian-bridge squared. SNHT:
 *      Khaliq-Ouarda Gaussian-MLE max. Pettitt: discrete
 *      Mann-Whitney walk-max. ICSS shares only the bridge
 *      generator with Lombard but takes the L-infinity
 *      functional, where Lombard takes the L-2 functional
 *      ON A DIFFERENT BRIDGE (smoothed rank vs cusum-of-
 *      squares).
 *   4. INVARIANCES: ICSS is INVARIANT UNDER LOCATION
 *      SHIFTS (the centring step removes them). All location
 *      tests (Lombard, SNHT, Pettitt, Hirsch-Slack, etc.)
 *      are NOT invariant under variance shifts. The two
 *      families are therefore mutually orthogonal in the
 *      same sense that mean and variance are orthogonal
 *      under a Gaussian factorisation.
 *
 * The test exists explicitly to detect heteroscedasticity-
 * regime changes that LEAVE THE MEAN UNCHANGED -- a regime
 * where every single one of axes 181-222 returns a null /
 * insignificant verdict. It is therefore a strict
 * COMPLEMENT, not a competitor, to all prior axes.
 *
 * Headline question:
 * **"For each source, IS THERE A STATISTICALLY SIGNIFICANT
 *   CHANGE IN THE VARIANCE (NOT THE MEAN) OF DAILY
 *   TOTAL_TOKENS, AND IF SO, AROUND WHICH DAY DOES THE
 *   VARIANCE REGIME SWITCH?"**
 *
 * References:
 *   Inclán, C. & Tiao, G. C., "Use of cumulative sums of
 *     squares for retrospective detection of changes of
 *     variance", *JASA* 89 (1994), pp. 913-923. The
 *     original ICSS paper.
 *   Brown, R. L., Durbin, J. & Evans, J. M., "Techniques
 *     for testing the constancy of regression relationships
 *     over time", *JRSSB* 37 (1975), pp. 149-192. CUSUM-
 *     of-squares precursor.
 *   Sansó, A., Aragó, V. & Carrion-i-Silvestre, J. L.,
 *     "Testing for changes in the unconditional variance
 *     of financial time series", *Revista de Economía
 *     Financiera* 4 (2004), pp. 32-53. Robust-IT extensions.
 *
 * Caveats:
 *   - HARD FLOOR n >= 21. Below ~20, Kolmogorov asymptotics
 *     are anti-conservative.
 *   - Detects a SINGLE variance changepoint. Multiple
 *     changepoints require iterative ICSS (Inclán-Tiao 1994
 *     sec. 3); we surface secondPeakRatio as a screening
 *     diagnostic only.
 *   - Sensitive to outliers in y^2 (a single huge spike
 *     dominates C[k]). Pair with axis-217 Laplace centroid
 *     for cross-validation.
 *   - Assumes finite fourth moment of x. Heavy-tailed
 *     sources (e.g. rare extreme bursts) inflate IT.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   pew-insights daily-token-inclan-tiao-icss-variance-changepoint
 *   pew-insights daily-token-inclan-tiao-icss-variance-changepoint --json
 *   pew-insights daily-token-inclan-tiao-icss-variance-changepoint --sort itStatDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenInclanTiaoIcssVarianceChangepointSort =
  | 'itStat'
  | 'itStatDesc'
  | 'pApprox'
  | 'pApproxDesc'
  | 'kStar'
  | 'kStarDesc'
  | 'absLogVarRatio'
  | 'absLogVarRatioDesc'
  | 'secondPeakRatio'
  | 'secondPeakRatioDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenInclanTiaoIcssVarianceChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenInclanTiaoIcssVarianceChangepointSort;
  generatedAt?: string;
}

export interface DailyTokenInclanTiaoIcssVarianceChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** IT = sqrt(n/2) * max |D[k]|, always >= 0. */
  itStat: number;
  /** Argmax k of |D[k]| in {0..n-2}; -1 if degenerate. */
  kStar: number;
  /** ISO YYYY-MM-DD of x[kStar]. null if degenerate. */
  kStarDay: string | null;
  /** D[kStar] in [-1, 1]; positive = LEFT segment higher variance. */
  dStar: number;
  /** Sign of D[kStar] in {-1, 0, +1}. */
  directionSign: number;
  /** var(y[0..kStar]). */
  varBefore: number;
  /** var(y[kStar+1..n-1]). */
  varAfter: number;
  /** ln(varAfter / varBefore). +inf, -inf, NaN replaced with 0. */
  logVarRatio: number;
  /** Kolmogorov upper-tail p-value. */
  pApprox: number;
  /** True iff itStat > 1.358 (alpha = 0.05 critical). */
  significant05: boolean;
  /** True iff itStat > 1.628 (alpha = 0.01 critical). */
  significant01: boolean;
  /** Edge ratio: max(D[0]^2, D[n-2]^2) / D[kStar]^2 in [0, 1]. */
  lEdgeRatio: number;
  /** Second-best |D[k]| outside guard +/- max(3, ceil(n/10)) of kStar. */
  secondPeak: number;
  /** k of secondPeak, -1 if none. */
  kStar2: number;
  /** ISO day at kStar2. null if none. */
  kStar2Day: string | null;
  /** secondPeak^2 / D[kStar]^2 in [0, 1]. */
  secondPeakRatio: number;
}

export interface DailyTokenInclanTiaoIcssVarianceChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenInclanTiaoIcssVarianceChangepointSort;
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
  /** Inclán-Tiao 1994 Table-1 asymptotic critical at alpha=0.05. */
  kCritical05: number;
  /** Inclán-Tiao 1994 Table-1 asymptotic critical at alpha=0.01. */
  kCritical01: number;
  sources: DailyTokenInclanTiaoIcssVarianceChangepointSourceRow[];
}

export interface IcssSummary {
  itStat: number;
  kStar: number;
  dStar: number;
  directionSign: number;
  lEdgeRatio: number;
  secondPeak: number;
  kStar2: number;
  secondPeakRatio: number;
}

/**
 * Pure ICSS summary on a real-valued series of length
 * n >= 2. Caller is responsible for mean-centring; this
 * function computes C[k] on raw squares and assumes the
 * input is already centred (or that the location is the
 * intended baseline). Throws on zero total sum-of-squares.
 */
export function icssSummary(centred: number[]): IcssSummary {
  const n = centred.length;
  if (n < 2) {
    return {
      itStat: 0,
      kStar: -1,
      dStar: 0,
      directionSign: 0,
      lEdgeRatio: 0,
      secondPeak: 0,
      kStar2: -1,
      secondPeakRatio: 0,
    };
  }
  // C[k] = sum_{i<=k} y[i]^2
  const C: number[] = new Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    acc += centred[i]! * centred[i]!;
    C[i] = acc;
  }
  const total = C[n - 1]!;
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(
      `icssSummary: total sum of squares must be > 0 (got ${total})`,
    );
  }
  // D[k] = C[k]/C[n-1] - (k+1)/n; argmax over k in {0..n-2}
  const D: number[] = new Array(n);
  for (let k = 0; k < n; k += 1) {
    D[k] = C[k]! / total - (k + 1) / n;
  }
  // argmax |D[k]| over k in {0..n-2}
  let kStar = 0;
  let bestAbs = Math.abs(D[0]!);
  for (let k = 1; k < n - 1; k += 1) {
    const a = Math.abs(D[k]!);
    if (a > bestAbs) {
      bestAbs = a;
      kStar = k;
    }
  }
  const dStar = D[kStar]!;
  const directionSign = dStar > 0 ? 1 : dStar < 0 ? -1 : 0;
  const itStat = Math.sqrt(n / 2) * Math.abs(dStar);
  // edge ratio in D^2
  const peakSq = dStar * dStar;
  const lastInner = n >= 2 ? D[n - 2]! : 0;
  const edgeSq = Math.max(D[0]! * D[0]!, lastInner * lastInner);
  const lEdgeRatio = peakSq > 0 ? edgeSq / peakSq : 0;
  // second peak outside guard
  const guard = Math.max(3, Math.ceil(n / 10));
  let secondPeak = 0;
  let kStar2 = -1;
  for (let k = 0; k < n - 1; k += 1) {
    if (Math.abs(k - kStar) <= guard) continue;
    const a = Math.abs(D[k]!);
    if (a > secondPeak) {
      secondPeak = a;
      kStar2 = k;
    }
  }
  const secondPeakRatio =
    peakSq > 0 ? (secondPeak * secondPeak) / peakSq : 0;
  return {
    itStat,
    kStar,
    dStar,
    directionSign,
    lEdgeRatio,
    secondPeak,
    kStar2,
    secondPeakRatio,
  };
}

/**
 * Two-sided Kolmogorov-Smirnov upper-tail probability.
 *
 *     Pr(K > c) = 2 * sum_{j=1..inf} (-1)^{j+1} * exp(-2 j^2 c^2)
 *
 * Numerically stable for c in [0, ~6]. For c > ~6, returns
 * 0 (numerically zero). For c <= 0, returns 1.
 */
export function kolmogorovUpperTailP(c: number): number {
  if (!Number.isFinite(c) || c <= 0) return 1;
  let sum = 0;
  let term = 0;
  // run series until convergence or max j
  for (let j = 1; j <= 200; j += 1) {
    term = 2 * ((j % 2 === 1) ? 1 : -1) * Math.exp(-2 * j * j * c * c);
    sum += term;
    if (Math.abs(term) < 1e-18) break;
  }
  if (!Number.isFinite(sum) || sum < 0) return 0;
  if (sum > 1) return 1;
  return sum;
}

export const ICSS_CRITICAL_05 = 1.358;
export const ICSS_CRITICAL_01 = 1.628;

/**
 * Inclán-Tiao 1994 ICSS variance-changepoint summary on a
 * gap-filled daily series of length n >= 21. Throws on
 * non-finite or negative weights. The series is mean-
 * centred internally; constant series throw zero-variance.
 */
export function dailyTokenInclanTiaoIcssVarianceChangepoint(
  weights: number[],
): {
  mean: number;
  stddev: number;
  nSamples: number;
  itStat: number;
  kStar: number;
  dStar: number;
  directionSign: number;
  varBefore: number;
  varAfter: number;
  logVarRatio: number;
  pApprox: number;
  significant05: boolean;
  significant01: boolean;
  lEdgeRatio: number;
  secondPeak: number;
  kStar2: number;
  secondPeakRatio: number;
} {
  const n = weights.length;
  if (n < 21) {
    throw new Error(
      `dailyTokenInclanTiaoIcssVarianceChangepoint: need at least 21 samples (got ${n})`,
    );
  }
  for (const v of weights) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenInclanTiaoIcssVarianceChangepoint requires finite weights',
      );
    }
    if (v < 0) {
      throw new Error(
        'dailyTokenInclanTiaoIcssVarianceChangepoint requires non-negative weights',
      );
    }
  }
  let sumW = 0;
  for (let i = 0; i < n; i += 1) sumW += weights[i]!;
  const mean = sumW / n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = weights[i]! - mean;
    denom += c * c;
  }
  if (denom === 0) {
    throw new Error(
      `dailyTokenInclanTiaoIcssVarianceChangepoint: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(denom / n);
  // mean-centre
  const centred: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) centred[i] = weights[i]! - mean;
  const sm = icssSummary(centred);
  // partitioned variance at kStar (split AFTER kStar so before = y[0..kStar])
  const split = Math.max(1, Math.min(n - 1, sm.kStar + 1));
  let sa = 0;
  let saSq = 0;
  for (let i = 0; i < split; i += 1) {
    sa += centred[i]!;
    saSq += centred[i]! * centred[i]!;
  }
  const meanA = sa / split;
  const varBefore = saSq / split - meanA * meanA;
  let sb = 0;
  let sbSq = 0;
  const nb = n - split;
  for (let i = split; i < n; i += 1) {
    sb += centred[i]!;
    sbSq += centred[i]! * centred[i]!;
  }
  const meanB = nb > 0 ? sb / nb : 0;
  const varAfter = nb > 0 ? sbSq / nb - meanB * meanB : 0;
  let logVarRatio = 0;
  if (varBefore > 0 && varAfter > 0) {
    logVarRatio = Math.log(varAfter / varBefore);
  } else if (varBefore === 0 && varAfter > 0) {
    logVarRatio = Number.POSITIVE_INFINITY;
  } else if (varBefore > 0 && varAfter === 0) {
    logVarRatio = Number.NEGATIVE_INFINITY;
  } else {
    logVarRatio = 0;
  }
  if (!Number.isFinite(logVarRatio)) logVarRatio = 0;
  const pApprox = kolmogorovUpperTailP(sm.itStat);
  const significant05 = sm.itStat > ICSS_CRITICAL_05;
  const significant01 = sm.itStat > ICSS_CRITICAL_01;
  return {
    mean,
    stddev,
    nSamples: n,
    itStat: sm.itStat,
    kStar: sm.kStar,
    dStar: sm.dStar,
    directionSign: sm.directionSign,
    varBefore,
    varAfter,
    logVarRatio,
    pApprox,
    significant05,
    significant01,
    lEdgeRatio: sm.lEdgeRatio,
    secondPeak: sm.secondPeak,
    kStar2: sm.kStar2,
    secondPeakRatio: sm.secondPeakRatio,
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

export function buildDailyTokenInclanTiaoIcssVarianceChangepoint(
  queue: QueueLine[],
  opts: DailyTokenInclanTiaoIcssVarianceChangepointOptions = {},
): DailyTokenInclanTiaoIcssVarianceChangepointReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenInclanTiaoIcssVarianceChangepointSort =
    opts.sort ?? 'itStatDesc';
  const validSorts: DailyTokenInclanTiaoIcssVarianceChangepointSort[] = [
    'itStat',
    'itStatDesc',
    'pApprox',
    'pApproxDesc',
    'kStar',
    'kStarDesc',
    'absLogVarRatio',
    'absLogVarRatioDesc',
    'secondPeakRatio',
    'secondPeakRatioDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
  const rows: DailyTokenInclanTiaoIcssVarianceChangepointSourceRow[] = [];

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
      result = dailyTokenInclanTiaoIcssVarianceChangepoint(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const kStarDay =
      result.kStar >= 0 && result.kStar < nTenure
        ? addUtcDays(acc.firstDay, result.kStar)
        : null;
    const kStar2Day =
      result.kStar2 >= 0 && result.kStar2 < nTenure
        ? addUtcDays(acc.firstDay, result.kStar2)
        : null;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      itStat: result.itStat,
      kStar: result.kStar,
      kStarDay,
      dStar: result.dStar,
      directionSign: result.directionSign,
      varBefore: result.varBefore,
      varAfter: result.varAfter,
      logVarRatio: result.logVarRatio,
      pApprox: result.pApprox,
      significant05: result.significant05,
      significant01: result.significant01,
      lEdgeRatio: result.lEdgeRatio,
      secondPeak: result.secondPeak,
      kStar2: result.kStar2,
      kStar2Day,
      secondPeakRatio: result.secondPeakRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'itStat':
        primary = a.itStat - b.itStat;
        break;
      case 'itStatDesc':
        primary = b.itStat - a.itStat;
        break;
      case 'pApprox':
        primary = a.pApprox - b.pApprox;
        break;
      case 'pApproxDesc':
        primary = b.pApprox - a.pApprox;
        break;
      case 'kStar':
        primary = a.kStar - b.kStar;
        break;
      case 'kStarDesc':
        primary = b.kStar - a.kStar;
        break;
      case 'absLogVarRatio':
        primary = Math.abs(a.logVarRatio) - Math.abs(b.logVarRatio);
        break;
      case 'absLogVarRatioDesc':
        primary = Math.abs(b.logVarRatio) - Math.abs(a.logVarRatio);
        break;
      case 'secondPeakRatio':
        primary = a.secondPeakRatio - b.secondPeakRatio;
        break;
      case 'secondPeakRatioDesc':
        primary = b.secondPeakRatio - a.secondPeakRatio;
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
    kCritical05: ICSS_CRITICAL_05,
    kCritical01: ICSS_CRITICAL_01,
    sources: kept,
  };
}
