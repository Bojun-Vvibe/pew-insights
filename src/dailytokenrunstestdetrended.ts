/**
 * daily-token-runs-test-detrended: per-source
 * WALD-WOLFOWITZ RUNS-TEST Z-STATISTIC computed on
 * the SIGN sequence of the OLS-DETRENDED residuals
 * of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTY-THIRD cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure. Fit
 * the OLS LINEAR TREND
 *
 *     x_t  approx  a + b * t
 *
 * by closed-form moment estimators (identical to the
 * fit used in axis-162 daily-token-durbin-watson-
 * detrended). Form residuals
 *
 *     e_t = x_t - (a + b * t)        t = 0..n-1
 *
 * (sum e_t === 0 by OLS first-order condition; sum
 * t * e_t === 0 by the second). Define the binary
 * sign sequence
 *
 *     s_t = '+' if e_t > 0
 *     s_t = '-' if e_t < 0
 *     s_t   DROPPED if e_t == 0       (exact zero residual)
 *
 * Let n_+ and n_- be the counts of '+' and '-' AFTER
 * the zero-residual drop, n = n_+ + n_-, and let R be
 * the number of MAXIMAL RUNS of identical signs in the
 * (zero-pruned) sequence (s_{i_1}, s_{i_2}, ...,
 * s_{i_n}). Under the WALD-WOLFOWITZ NULL of an
 * exchangeable iid sign sequence with the observed
 * (n_+, n_-) margin,
 *
 *     mu_R    = 2 * n_+ * n_- / n + 1
 *     var_R   = 2 * n_+ * n_- (2 * n_+ * n_- - n)
 *               / ( n^2 * (n - 1) )
 *     rtZ     = (R - mu_R) / sqrt(var_R)
 *
 * (Wald & Wolfowitz 1940 Ann. Math. Stat. 11(2):147-162).
 *
 * Sign convention (identical to axis-149 raw-series
 * runs-test, applied here on RESIDUALS):
 *
 *   rtZ << 0   FEWER runs than expected -> CLUSTERING
 *              of detrended residuals (positive days
 *              bunch together, negative days bunch
 *              together; PERSISTENCE around the trend).
 *   rtZ approx 0   sign sequence is consistent with
 *              i.i.d. symmetric noise around the
 *              fitted linear trend.
 *   rtZ >> 0   MORE runs than expected -> ANTI-
 *              CLUSTERING (signs alternate more than
 *              chance; OSCILLATION around the trend,
 *              consistent with a negative AR(1)
 *              residual or a deterministic
 *              high-frequency oscillation).
 *
 * Identities preserved (verified by tests):
 *
 *   - rtZ(x + c) === rtZ(x) for any constant c
 *     (additive shift absorbed into intercept;
 *      residuals unchanged; sign sequence unchanged).
 *   - rtZ(a * x) === rtZ(x) for any non-zero scalar a
 *     (positive a preserves all signs; negative a
 *     flips all signs which preserves R, n_+ <-> n_-
 *     swap, mu_R / var_R / R unchanged).
 *   - For a perfect linear ramp x_t = a + b*t:
 *     residuals are exactly zero -> n = 0 -> THROWS
 *     (zero residual variance).
 *   - For a perfectly alternating residual pattern
 *     (s = +,-,+,-,...): R = n exactly, rtZ takes
 *     its maximum positive value.
 *   - For a perfectly clustered residual pattern
 *     (s = +,+,...,+,-,-,...,-): R = 2 exactly, rtZ
 *     takes its minimum (most negative) value.
 *
 * Verdict cutoffs by standardised score rtZ
 * (asymptotic N(0, 1) under the runs-test null):
 *
 *   strong-clustering         rtZ <= -2.576   (p <= 0.005, two-sided 0.01)
 *   borderline-clustering    -2.576 < rtZ <= -1.645 (p <= 0.05 one-sided)
 *   independent              -1.645 < rtZ <  +1.645
 *   borderline-anti-cluster  +1.645 <= rtZ <  +2.576
 *   strong-anti-clustering    rtZ >= +2.576
 *
 * The asymptotic Normal approximation is adequate
 * for n_+ >= 10 and n_- >= 10; for smaller samples
 * rtZ is reported but should be read as suggestive.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-162:
 *
 *   - vs axis-149 daily-token-runs-test-z (raw-series
 *     runs-test on above/below GLOBAL MEDIAN of the
 *     RAW series). The pivot is fundamentally
 *     different:
 *       * axis-149 splits the RAW series at the
 *         global median P50(x). For a monotone-
 *         trending series this means the FIRST half
 *         is all '-' and the SECOND half is all '+',
 *         giving R = 2 and a near-minimum rtZ
 *         regardless of any short-range structure --
 *         the trend SWAMPS the runs signal.
 *       * THIS axis splits the RESIDUALS at zero
 *         (which is the natural pivot, since
 *         sum e_t === 0 by OLS). The trend is
 *         REMOVED before the runs are counted, so
 *         the test sees only the SHORT-RANGE SIGN
 *         BEHAVIOUR around the fitted line. A
 *         linearly-rising series with iid Gaussian
 *         noise gives axis-149 rtZ approx -sqrt(n)
 *         (extreme clustering) but THIS axis rtZ
 *         approx 0 (independent).
 *
 *   - vs axis-162 daily-token-durbin-watson-
 *     detrended. Both operate on OLS residuals
 *     e_t. But:
 *       * DW is a CONTINUOUS L^2 quadratic-form
 *         statistic: dw = sum (e_t - e_{t-1})^2 /
 *         sum e_t^2. It depends on the MAGNITUDES
 *         of the residuals, weighted by their
 *         pairwise squared differences.
 *       * THIS axis is a DISCRETE L^0 nonparametric
 *         statistic on SIGN(e_t) only. It is BLIND
 *         TO MAGNITUDE: residuals (+0.0001, -10000,
 *         +0.0002, -10000, ...) have the same R as
 *         (+1, -1, +1, -1, ...); DW differs by
 *         several orders of magnitude between these.
 *       * Concretely a residual sequence of large-
 *         small-large-small can give DW approx 4
 *         (perfect anti-correlation) while this
 *         axis gives rtZ approx +sqrt(n) -- both
 *         see anti-clustering. But a sequence of
 *         small-small-LARGE-LARGE-small-small-LARGE-
 *         LARGE gives DW dominated by the large
 *         jumps (DW well below 2) while this axis
 *         sees runs of length 2 (rtZ approx 0
 *         depending on exact n_+/n_-). DW and rtZ
 *         disagree in the AGREEMENT-IN-SIGN /
 *         DISAGREEMENT-IN-MAGNITUDE regime, which
 *         is exactly when nonparametric robustness
 *         matters.
 *
 *   - vs every other RAW-SERIES SERIAL-CORRELATION
 *     AXIS (raw-series autocorrelation lag-1 / lag-7,
 *     Spearman lag-1, Kendall lag-1, Bartels-rank
 *     von Neumann, axis-114 Ljung-Box, axis-159
 *     McLeod-Li, axis-158 VR, axis-160 BDS): all of
 *     those see x_t (or |x_t|, x_t^2, ranks(x_t),
 *     m-history embeddings of x_t). This axis
 *     operates on SIGN(e_t) where e_t are the
 *     OLS-DETRENDED residuals -- a TWO-STEP
 *     transformation that is not a feature of any
 *     of those statistics.
 *
 *   - vs the STATIONARITY / UNIT-ROOT / CHANGEPOINT
 *     AXES (axis-156 KPSS, axis-157 ADF, axis-153
 *     CUSUM, axis-154 Pettitt, axis-155 Buishand):
 *     those test the LEVEL TRAJECTORY for unit
 *     root / level-stationarity / changepoint. This
 *     axis tests the RUN STRUCTURE OF THE SIGN OF
 *     RESIDUALS AROUND A FITTED LINEAR TREND -- a
 *     completely different question.
 *
 *   - vs axis-161 JARQUE-BERA: JB is permutation-
 *     invariant on the raw series and tests
 *     marginal-shape (skew + kurtosis). This axis
 *     is time-ordered on the SIGN of residuals and
 *     IGNORES the marginal shape entirely (the
 *     statistic depends only on the order in which
 *     positive and negative residuals appear, not on
 *     their magnitudes).
 *
 * Headline question:
 * **"For each source, after we subtract the best
 *   linear trend, do above-trend and below-trend
 *   days CLUSTER (long runs of same sign,
 *   rtZ << 0), ALTERNATE more than chance
 *   (rtZ >> 0), or look like an iid coin
 *   (rtZ approx 0)?"**
 *
 * Reference:
 *   Wald, A. and Wolfowitz, J., "On a test whether
 *     two samples are from the same population",
 *     Annals of Mathematical Statistics 11(2)
 *     (1940), pp. 147-162.
 *
 * Caveats:
 *
 *   - Asymptotic Normal approximation is adequate
 *     only for n_+ >= 10 and n_- >= 10. Below this,
 *     the EXACT distribution of R conditional on
 *     (n_+, n_-) is hypergeometric and rtZ tail
 *     probabilities are coarse.
 *   - rtZ is BLIND TO RESIDUAL MAGNITUDE. A residual
 *     sequence with one massive outlier and otherwise
 *     iid noise has the same rtZ as the same
 *     sequence with the outlier replaced by the next
 *     same-sign value. Compose with axis-162 DW
 *     (magnitude-aware) for a complete residual
 *     diagnostic.
 *   - rtZ is undefined when n_+ == 0 or n_- == 0
 *     (all residuals same sign -- impossible by OLS
 *     unless all residuals are exactly zero, i.e.
 *     perfect linear fit, which we already drop).
 *     We additionally drop the row when n < 4 after
 *     zero-residual pruning (safety floor).
 *   - var_R is undefined for n == 1 and is zero for
 *     the degenerate cases (n_+ == 0 or n_- == 0).
 *     Both are caught explicitly.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, sort by largest
 *   # |rtZ|):
 *   pew-insights daily-token-runs-test-detrended
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-runs-test-detrended --json
 *
 *   # Sort by raw rtZ ascending (most clustered
 *   # residuals first):
 *   pew-insights daily-token-runs-test-detrended --sort rtZ
 */
import type { QueueLine } from './types.js';

export type DailyTokenRunsTestDetrendedSort =
  | 'rtZ'
  | 'rtZDesc'
  | 'rtZAbs'
  | 'rtZAbsDesc'
  | 'runs'
  | 'runsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type RunsDetrendedVerdict =
  | 'strong-clustering'
  | 'borderline-clustering'
  | 'independent'
  | 'borderline-anti-clustering'
  | 'strong-anti-clustering';

export interface DailyTokenRunsTestDetrendedOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenRunsTestDetrendedSort;
  generatedAt?: string;
}

export interface DailyTokenRunsTestDetrendedSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** OLS intercept of fitted x_t = a + b*t. */
  trendIntercept: number;
  /** OLS slope of fitted x_t = a + b*t (tokens / day). */
  trendSlope: number;
  /** Count of positive residuals (e_t > 0). */
  nPos: number;
  /** Count of negative residuals (e_t < 0). */
  nNeg: number;
  /** Count of exactly-zero residuals (dropped). */
  nZero: number;
  /** Number of maximal sign-runs in the zero-pruned sequence. */
  runs: number;
  /** Expected runs under the WW null: 2*nPos*nNeg/n + 1. */
  expectedRuns: number;
  /** Standardised score (R - mu) / sqrt(var). */
  rtZ: number;
  /** Verdict by rtZ cutoffs (see VERDICT_CUTOFFS). */
  verdict: RunsDetrendedVerdict;
}

export interface DailyTokenRunsTestDetrendedReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenRunsTestDetrendedSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroResidualVariance: number;
  droppedDegenerateSign: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenRunsTestDetrendedSourceRow[];
}

const RT_Z_STRONG = 2.5758293035489004; // N(0,1) 99.5th percentile
const RT_Z_WEAK = 1.6448536269514722; // N(0,1) 95th percentile

function classifyRunsDetrended(rtZ: number): RunsDetrendedVerdict {
  if (rtZ <= -RT_Z_STRONG) return 'strong-clustering';
  if (rtZ <= -RT_Z_WEAK) return 'borderline-clustering';
  if (rtZ < RT_Z_WEAK) return 'independent';
  if (rtZ < RT_Z_STRONG) return 'borderline-anti-clustering';
  return 'strong-anti-clustering';
}

/**
 * Wald-Wolfowitz runs test on the sign sequence of
 * OLS-detrended residuals.
 *
 * Throws when too short, non-finite, zero level
 * variance, zero residual variance (perfect linear
 * fit), or degenerate sign distribution after
 * zero-pruning (n_+ == 0 or n_- == 0; n < 4).
 */
export function dailyTokenRunsTestDetrended(values: number[]): {
  nSamples: number;
  trendIntercept: number;
  trendSlope: number;
  nPos: number;
  nNeg: number;
  nZero: number;
  runs: number;
  expectedRuns: number;
  varRuns: number;
  rtZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenRunsTestDetrended: need at least 4 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenRunsTestDetrended requires finite values',
      );
    }
  }

  const tbar = (n - 1) / 2;
  let xbar = 0;
  for (const v of values) xbar += v;
  xbar /= n;

  let sxt = 0; // sum (t - tbar) * (x - xbar)
  let stt = 0; // sum (t - tbar)^2
  let sxx = 0; // sum (x - xbar)^2
  for (let t = 0; t < n; t += 1) {
    const dt = t - tbar;
    const dx = values[t]! - xbar;
    sxt += dt * dx;
    stt += dt * dt;
    sxx += dx * dx;
  }
  if (sxx === 0) {
    throw new Error(
      `dailyTokenRunsTestDetrended: zero level variance (n=${n})`,
    );
  }
  const slope = sxt / stt;
  const intercept = xbar - slope * tbar;

  // Build sign sequence, dropping exact zeros.
  const signs: number[] = [];
  let nPos = 0;
  let nNeg = 0;
  let nZero = 0;
  let rss = 0;
  for (let t = 0; t < n; t += 1) {
    const r = values[t]! - (intercept + slope * t);
    rss += r * r;
    if (r > 0) {
      signs.push(1);
      nPos += 1;
    } else if (r < 0) {
      signs.push(-1);
      nNeg += 1;
    } else {
      nZero += 1;
    }
  }
  if (rss === 0 || rss < 1e-300) {
    throw new Error(
      `dailyTokenRunsTestDetrended: zero residual variance (perfect linear fit, n=${n})`,
    );
  }
  const nEff = signs.length;
  if (nEff < 4 || nPos === 0 || nNeg === 0) {
    throw new Error(
      `dailyTokenRunsTestDetrended: degenerate sign distribution (nPos=${nPos}, nNeg=${nNeg}, nEff=${nEff})`,
    );
  }

  // Count maximal runs.
  let runs = 1;
  for (let i = 1; i < nEff; i += 1) {
    if (signs[i] !== signs[i - 1]) runs += 1;
  }

  const npn = nPos * nNeg;
  const expectedRuns = (2 * npn) / nEff + 1;
  const varRuns =
    (2 * npn * (2 * npn - nEff)) / (nEff * nEff * (nEff - 1));
  if (!Number.isFinite(varRuns) || varRuns <= 0) {
    throw new Error(
      `dailyTokenRunsTestDetrended: non-positive var_R (nEff=${nEff}, nPos=${nPos}, nNeg=${nNeg})`,
    );
  }
  const rtZ = (runs - expectedRuns) / Math.sqrt(varRuns);
  if (!Number.isFinite(rtZ)) {
    throw new Error(
      `dailyTokenRunsTestDetrended: non-finite rtZ (nEff=${nEff})`,
    );
  }

  return {
    nSamples: n,
    trendIntercept: intercept,
    trendSlope: slope,
    nPos,
    nNeg,
    nZero,
    runs,
    expectedRuns,
    varRuns,
    rtZ,
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

export function buildDailyTokenRunsTestDetrended(
  queue: QueueLine[],
  opts: DailyTokenRunsTestDetrendedOptions = {},
): DailyTokenRunsTestDetrendedReport {
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
  const sort: DailyTokenRunsTestDetrendedSort = opts.sort ?? 'rtZAbsDesc';
  const validSorts: DailyTokenRunsTestDetrendedSort[] = [
    'rtZ',
    'rtZDesc',
    'rtZAbs',
    'rtZAbsDesc',
    'runs',
    'runsDesc',
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
  let droppedZeroResidualVariance = 0;
  let droppedDegenerateSign = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenRunsTestDetrendedSourceRow[] = [];

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
      result = dailyTokenRunsTestDetrended(filled);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/zero residual variance/.test(msg)) {
        droppedZeroResidualVariance += 1;
      } else if (/degenerate sign/.test(msg)) {
        droppedDegenerateSign += 1;
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
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      trendIntercept: result.trendIntercept,
      trendSlope: result.trendSlope,
      nPos: result.nPos,
      nNeg: result.nNeg,
      nZero: result.nZero,
      runs: result.runs,
      expectedRuns: result.expectedRuns,
      rtZ: result.rtZ,
      verdict: classifyRunsDetrended(result.rtZ),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rtZ':
        primary = a.rtZ - b.rtZ;
        break;
      case 'rtZDesc':
        primary = b.rtZ - a.rtZ;
        break;
      case 'rtZAbs':
        primary = Math.abs(a.rtZ) - Math.abs(b.rtZ);
        break;
      case 'rtZAbsDesc':
        primary = Math.abs(b.rtZ) - Math.abs(a.rtZ);
        break;
      case 'runs':
        primary = a.runs - b.runs;
        break;
      case 'runsDesc':
        primary = b.runs - a.runs;
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
    droppedZeroResidualVariance,
    droppedDegenerateSign,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
