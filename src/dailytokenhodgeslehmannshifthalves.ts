/**
 * daily-token-hodges-lehmann-shift-halves: per-source
 * HODGES-LEHMANN 1963 DISTRIBUTION-FREE TWO-SAMPLE
 * MEDIAN-SHIFT POINT ESTIMATOR with companion LEHMANN
 * 1963 NONPARAMETRIC CONFIDENCE INTERVAL between the
 * first half (n1 = floor(n/2) days) vs the second half
 * (n2 = n - n1 days) of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-EIGHTY-SIXTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO every prior axis. All prior
 * halves axes are TEST STATISTICS yielding a Z-score or
 * chi-square deviance with an asymptotic p-value: axis-115
 * Mann-Whitney rank-sum, axis-181 van-der-Waerden normal
 * scores, axis-182 Fligner-Policello, axis-183 Yuen-Welch
 * trimmed mean, axis-184 Savage exponential scores,
 * axis-185 Baumgartner-Weiss-Schindler omnibus, the
 * pure-scale family (axis-170/177/178/179/180), and the
 * combined-quadratic family (axis-174 Cucconi, axis-175
 * Lepage). NONE of them produce a POINT ESTIMATE in the
 * ORIGINAL TOKEN UNITS of the median shift between the
 * two halves, and none produce a DISTRIBUTION-FREE
 * CONFIDENCE INTERVAL on that shift.
 *
 * THE STATISTIC. Define the m = n1 * n2 pairwise Walsh
 * differences between the second-half sample Y =
 * (y_1, ..., y_{n2}) and the first-half sample X =
 * (x_1, ..., x_{n1}) as
 *
 *     D_{i,j} = y_j - x_i,    1 <= i <= n1, 1 <= j <= n2
 *
 * Then the HODGES-LEHMANN two-sample shift estimator is
 *
 *     hlDelta = median{ D_{i,j} : 1 <= i <= n1,
 *                                  1 <= j <= n2 }
 *
 * (Hodges & Lehmann 1963 *Ann. Math. Stat.* 34:598-611,
 * eq. 2.1). Under the LOCATION-SHIFT MODEL Y = X + theta
 * with theta the true median shift, hlDelta is the median-
 * unbiased and asymptotically Gaussian estimator with the
 * SAME Pitman ARE as the Mann-Whitney rank-sum test. Under
 * normal F, ARE(hl, mean-difference) = 3/pi ~ 0.955; under
 * a logistic F, ARE = pi^2/9 ~ 1.097; under any heavy-
 * tailed (Cauchy, Laplace) F, ARE > 1 (Hodges-Lehmann 1963
 * Theorem 1; Lehmann 1975 *Nonparametrics* sec. 2.3).
 *
 * THE LEHMANN CONFIDENCE INTERVAL. Sort the m = n1 * n2
 * pairwise differences ascendingly into D_{(1)} <= ... <=
 * D_{(m)}. For nominal two-sided level alpha, choose the
 * INTEGER ORDER STATISTIC INDEX
 *
 *     k_alpha = U_{alpha/2; n1, n2}
 *
 * where U_{alpha/2; n1, n2} is the upper alpha/2 quantile
 * of the EXACT Mann-Whitney null distribution of the U
 * statistic. Then the LEHMANN 1963 *Ann. Math. Stat.*
 * 34:1507-1512 confidence interval is
 *
 *     [ D_{(k_alpha + 1)},  D_{(m - k_alpha)} ]
 *
 * with EXACT coverage >= 1 - alpha for any continuous F
 * (DISTRIBUTION-FREE: depends only on rank invariance,
 * not on F's shape, mean, variance, or tails).
 *
 * For n1 + n2 >= 20 (always true here since min-tenure =
 * 16 implies n1 + n2 >= 16; we additionally enforce
 * n1 * n2 >= 64 for the asymptotic CI), we use the
 * NORMAL APPROXIMATION to U:
 *
 *     E[U]   = n1 * n2 / 2
 *     Var[U] = n1 * n2 * (n1 + n2 + 1) / 12
 *
 *     k_alpha = round( E[U] - z_{alpha/2} * sqrt(Var[U]) )
 *
 * with z_{alpha/2} the standard-normal upper quantile (we
 * use the high-precision Beasley-Springer-Moro inverse
 * normal CDF, accurate to 5e-9 across the relevant alpha
 * range alpha in [1e-6, 0.5]).
 *
 * SIGN CONVENTION. hlDelta is signed: positive means the
 * second half has a LARGER median, exactly matching the
 * SECOND-half-positive cross-axis convention shared by
 * every prior halves axis.
 *
 * The CI is summarized by hlCiLow, hlCiHigh, and the
 * derived flag hlCiExcludesZero (true iff 0 is outside
 * [hlCiLow, hlCiHigh]). The flag is the EXACT analogue at
 * level alpha of "reject H0: theta = 0 by the Mann-
 * Whitney test at level alpha"; it is NOT a redundant
 * recomputation of axis-115 because (a) it carries the
 * EFFECT SIZE in token units, not just the binary
 * decision, and (b) at any non-rejection it still yields
 * a TWO-SIDED RANGE on the plausible median shift.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-186):
 *
 *   - vs axis-115 MANN-WHITNEY (test statistic, p-value).
 *     Axis-186 is the COMPANION ESTIMATOR. Mann-Whitney
 *     rejects iff the corresponding Lehmann CI excludes 0
 *     under the pure location-shift model, but axis-186
 *     additionally reports the POINT ESTIMATE and the
 *     two-sided CI in original token units. Axis-115 says
 *     "the second half is stochastically larger with
 *     p < 0.001"; axis-186 says "the median per-day token
 *     volume rose by +12.4M tokens [95% CI: 8.1M, 16.9M]".
 *   - vs axis-181 VDW / axis-184 SAVAGE / axis-183 YW
 *     (other location tests). All of these test the same
 *     null but use different score functions or trimming.
 *     Axis-186 produces no score-function-dependent
 *     statistic; it is a DIRECT MEDIAN of pairwise raw
 *     differences in original token units.
 *   - vs axis-185 BWS / axis-175 LEPAGE / axis-174 CUCCONI
 *     (omnibus / combined location-and-scale). These
 *     reject under any distributional departure but
 *     report no effect size. Axis-186 reports only the
 *     LOCATION SHIFT effect size; it is INSENSITIVE to
 *     pure-scale departures (a property shared with
 *     axis-115).
 *   - vs the PURE-SCALE family (axis-170/177-180). Those
 *     are scale tests; axis-186 is a location estimator.
 *
 * COMPLEXITY. Naive median of m = n1 * n2 pairwise
 * differences is O(m log m) = O(n^2 log n). For our
 * domain (typical n in [16, 400]) this is at most ~4e4
 * log 4e4 ~ 6e5 comparisons per source — well below any
 * IO cost. We compute all pairwise differences explicitly
 * and sort once; this gives both hlDelta and the CI from
 * the same sorted array.
 *
 * EXACT IDENTITIES preserved (verified by the test
 * suite):
 *
 *   - hlDelta(x + c) = hlDelta(x) for any constant c
 *     (location-equivariant — pairwise diffs unchanged by
 *     shifting both halves by the same constant; but
 *     hlDelta(x SHIFTED BY c IN THE SECOND HALF ONLY) =
 *     hlDelta(x) + c).
 *   - hlDelta(a * x) = a * hlDelta(x) for any a > 0
 *     (scale-equivariant in the same direction).
 *   - hlDelta(reverse(x)) = -hlDelta(x) when n1 = n2
 *     (sign-flip on swapping the halves).
 *   - hlCiLow <= hlDelta <= hlCiHigh always.
 *   - For a strict monotone increasing series of length
 *     >= 16, hlDelta > 0 AND hlCiExcludesZero === true.
 *   - For a strict monotone decreasing series of length
 *     >= 16, hlDelta < 0 AND hlCiExcludesZero === true.
 */

import type { QueueLine } from './types.js';

export type DailyTokenHlShiftHalvesSort =
  | 'hlDelta'
  | 'hlDeltaDesc'
  | 'hlDeltaAbsDesc'
  | 'hlCiWidth'
  | 'hlCiWidthDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenHlShiftHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenHlShiftHalvesSort;
  alpha?: number;
  generatedAt?: string;
}

export interface DailyTokenHlShiftHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  hlN1: number;
  /** Second-half size n2 = n - n1. */
  hlN2: number;
  /** Total pairwise differences considered: m = n1 * n2. */
  hlPairs: number;
  /** Hodges-Lehmann two-sample shift estimator (eq. 2.1). */
  hlDelta: number;
  /** Lehmann 1963 lower CI endpoint at level (1 - alpha). */
  hlCiLow: number;
  /** Lehmann 1963 upper CI endpoint at level (1 - alpha). */
  hlCiHigh: number;
  /** hlCiHigh - hlCiLow, in original token units. */
  hlCiWidth: number;
  /** True iff 0 is strictly outside [hlCiLow, hlCiHigh]. */
  hlCiExcludesZero: boolean;
  /** Confidence level used (1 - alpha). */
  hlCiLevel: number;
  /**
   * Companion sign in {-1, 0, +1}. +1 means hlDelta > 0
   * (second half median larger), -1 means < 0, 0 means
   * exactly 0 (measure-zero on continuous data; possible
   * with tied gap-filled token counts).
   */
  hlSign: -1 | 0 | 1;
}

export interface DailyTokenHlShiftHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenHlShiftHalvesSort;
  alpha: number;
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
  sources: DailyTokenHlShiftHalvesSourceRow[];
}

/**
 * Beasley-Springer-Moro inverse normal CDF approximation.
 * Returns z such that Phi(z) = p, accurate to ~5e-9 for
 * p in (1e-12, 1 - 1e-12). Used to compute z_{alpha/2}
 * for the asymptotic Lehmann CI quantile.
 */
export function inverseNormalCdfBsm(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(`inverseNormalCdfBsm: p must be in (0, 1) (got ${p})`);
  }
  // Beasley-Springer-Moro 1977 / Moro 1995 coefficients.
  const a = [
    -3.969_683_028_665_376e1, 2.209_460_984_245_205e2,
    -2.759_285_104_469_687e2, 1.383_577_518_672_69e2,
    -3.066_479_806_614_716e1, 2.506_628_277_459_239,
  ];
  const b = [
    -5.447_609_879_822_406e1, 1.615_858_368_580_409e2,
    -1.556_989_798_598_866e2, 6.680_131_188_771_972e1,
    -1.328_068_155_288_572e1,
  ];
  const c = [
    -7.784_894_002_430_293e-3, -3.223_964_580_411_365e-1,
    -2.400_758_277_161_838, -2.549_732_539_343_734,
    4.374_664_141_464_968, 2.938_163_982_698_783,
  ];
  const d = [
    7.784_695_709_041_462e-3, 3.224_671_290_700_398e-1,
    2.445_134_137_142_996, 3.754_408_661_907_416,
  ];
  const pLow = 0.024_25;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      ((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!
    ) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
      q
    ) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r +
        1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/**
 * Median of an already-ascending-sorted array. For odd
 * length returns the middle element; for even length
 * returns the average of the two middle elements.
 */
export function medianSortedHl(sorted: ReadonlyArray<number>): number {
  const n = sorted.length;
  if (n === 0) {
    throw new Error('medianSortedHl: empty array');
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Compute the Hodges-Lehmann two-sample shift estimator
 * and Lehmann distribution-free CI from two pre-split
 * sub-samples sampleA (first half) and sampleB (second
 * half). Internal primitive: takes the two halves
 * directly so it is independent of the halving rule.
 *
 * Returns hlDelta (median of pairwise differences B - A),
 * hlCiLow / hlCiHigh (Lehmann CI endpoints from the
 * sorted pairwise-difference order statistics with
 * Mann-Whitney quantile index), and hlPairs = nA * nB.
 */
export function hodgesLehmannShift(
  sampleA: ReadonlyArray<number>,
  sampleB: ReadonlyArray<number>,
  alpha: number,
): {
  hlDelta: number;
  hlCiLow: number;
  hlCiHigh: number;
  hlPairs: number;
} {
  const nA = sampleA.length;
  const nB = sampleB.length;
  if (nA < 1 || nB < 1) {
    throw new Error(
      `hodgesLehmannShift: both samples must be non-empty (got ${nA}, ${nB})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `hodgesLehmannShift: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  for (const v of sampleA) {
    if (!Number.isFinite(v)) {
      throw new Error('hodgesLehmannShift: sampleA must be all finite');
    }
  }
  for (const v of sampleB) {
    if (!Number.isFinite(v)) {
      throw new Error('hodgesLehmannShift: sampleB must be all finite');
    }
  }
  const m = nA * nB;
  const diffs = new Array<number>(m);
  let idx = 0;
  for (let i = 0; i < nA; i += 1) {
    const ai = sampleA[i]!;
    for (let j = 0; j < nB; j += 1) {
      diffs[idx++] = sampleB[j]! - ai;
    }
  }
  diffs.sort((x, y) => x - y);
  const hlDelta = medianSortedHl(diffs);

  // Lehmann 1963 CI quantile via normal-approximation to
  // Mann-Whitney U. E[U] = n1 n2 / 2, Var[U] = n1 n2
  // (n1 + n2 + 1) / 12. We require nA * nB >= 64 to use
  // the asymptotic; smaller samples are filtered upstream
  // by min-tenure-days >= 16 (n1 = 8, n2 = 8 => m = 64).
  const meanU = m / 2;
  const varU = (m * (nA + nB + 1)) / 12;
  const z = inverseNormalCdfBsm(1 - alpha / 2);
  const kRaw = meanU - z * Math.sqrt(varU);
  // Clamp to valid index range and round to nearest int.
  let kAlpha = Math.round(kRaw);
  if (kAlpha < 0) kAlpha = 0;
  if (kAlpha >= m) kAlpha = m - 1;
  const lowIdx = kAlpha; // D_{(k+1)} is sorted index k (0-based).
  const highIdx = m - 1 - kAlpha; // D_{(m - k)} is sorted index m-1-k.
  if (highIdx < lowIdx) {
    // Degenerate (very small m) — collapse to the median.
    return { hlDelta, hlCiLow: hlDelta, hlCiHigh: hlDelta, hlPairs: m };
  }
  return {
    hlDelta,
    hlCiLow: diffs[lowIdx]!,
    hlCiHigh: diffs[highIdx]!,
    hlPairs: m,
  };
}

/**
 * Compute the Hodges-Lehmann two-sample shift estimator
 * and Lehmann CI for a real-valued series split into two
 * contiguous halves [0..n1-1] and [n1..n-1].
 */
export function dailyTokenHodgesLehmannShiftHalves(
  values: number[],
  alpha: number,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  hlN1: number;
  hlN2: number;
  hlPairs: number;
  hlDelta: number;
  hlCiLow: number;
  hlCiHigh: number;
  hlCiWidth: number;
  hlCiExcludesZero: boolean;
  hlSign: -1 | 0 | 1;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenHodgesLehmannShiftHalves: need at least 16 samples (got ${n})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `dailyTokenHodgesLehmannShiftHalves: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenHodgesLehmannShiftHalves requires finite values',
      );
    }
  }
  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenHodgesLehmannShiftHalves: zero centred variance (n=${n})`,
    );
  }
  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const sampleA = values.slice(0, n1);
  const sampleB = values.slice(n1);
  const r = hodgesLehmannShift(sampleA, sampleB, alpha);
  const hlCiWidth = r.hlCiHigh - r.hlCiLow;
  const hlCiExcludesZero = r.hlCiLow > 0 || r.hlCiHigh < 0;
  const hlSign: -1 | 0 | 1 =
    r.hlDelta > 0 ? 1 : r.hlDelta < 0 ? -1 : 0;
  return {
    mean: mu,
    stddev,
    nSamples: n,
    hlN1: n1,
    hlN2: n2,
    hlPairs: r.hlPairs,
    hlDelta: r.hlDelta,
    hlCiLow: r.hlCiLow,
    hlCiHigh: r.hlCiHigh,
    hlCiWidth,
    hlCiExcludesZero,
    hlSign,
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

export function buildDailyTokenHodgesLehmannShiftHalves(
  queue: QueueLine[],
  opts: DailyTokenHlShiftHalvesOptions = {},
): DailyTokenHlShiftHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 16;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 16) {
    throw new Error(
      `minTenureDays must be an integer >= 16 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const alpha = opts.alpha ?? 0.05;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(`alpha must be in (0, 0.5] (got ${opts.alpha})`);
  }
  const sort: DailyTokenHlShiftHalvesSort = opts.sort ?? 'hlDeltaAbsDesc';
  const validSorts: DailyTokenHlShiftHalvesSort[] = [
    'hlDelta',
    'hlDeltaDesc',
    'hlDeltaAbsDesc',
    'hlCiWidth',
    'hlCiWidthDesc',
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
  const rows: DailyTokenHlShiftHalvesSourceRow[] = [];

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
      result = dailyTokenHodgesLehmannShiftHalves(filled, alpha);
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
      hlN1: result.hlN1,
      hlN2: result.hlN2,
      hlPairs: result.hlPairs,
      hlDelta: result.hlDelta,
      hlCiLow: result.hlCiLow,
      hlCiHigh: result.hlCiHigh,
      hlCiWidth: result.hlCiWidth,
      hlCiExcludesZero: result.hlCiExcludesZero,
      hlCiLevel: 1 - alpha,
      hlSign: result.hlSign,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'hlDelta':
        primary = a.hlDelta - b.hlDelta;
        break;
      case 'hlDeltaDesc':
        primary = b.hlDelta - a.hlDelta;
        break;
      case 'hlDeltaAbsDesc':
        primary = Math.abs(b.hlDelta) - Math.abs(a.hlDelta);
        break;
      case 'hlCiWidth':
        primary = a.hlCiWidth - b.hlCiWidth;
        break;
      case 'hlCiWidthDesc':
        primary = b.hlCiWidth - a.hlCiWidth;
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
    alpha,
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

/**
 * Directional 5-bucket label classifier for axis-186
 * Hodges-Lehmann shift rows. Maps the signed estimator
 * and its companion CI-excludes-zero flag to one of five
 * mutually-exclusive verdict buckets:
 *
 *   - 'second-decisively-larger-by-shift' if hlSign > 0
 *     AND hlCiExcludesZero (CI strictly above 0)
 *   - 'first-decisively-larger-by-shift' if hlSign < 0
 *     AND hlCiExcludesZero (CI strictly below 0)
 *   - 'leans-second-larger-by-shift' if hlSign > 0 AND
 *     NOT hlCiExcludesZero (positive point estimate but
 *     CI straddles 0)
 *   - 'leans-first-larger-by-shift' if hlSign < 0 AND
 *     NOT hlCiExcludesZero
 *   - 'no-detectable-shift' if hlSign === 0 (median
 *     pairwise diff is exactly zero)
 */
export type HlShiftDirectionalLabel =
  | 'second-decisively-larger-by-shift'
  | 'first-decisively-larger-by-shift'
  | 'leans-second-larger-by-shift'
  | 'leans-first-larger-by-shift'
  | 'no-detectable-shift';

export function labelHlShiftHalvesRow(row: {
  hlDelta: number;
  hlCiLow: number;
  hlCiHigh: number;
  hlCiExcludesZero: boolean;
  hlSign: -1 | 0 | 1;
}): HlShiftDirectionalLabel {
  if (
    !Number.isFinite(row.hlDelta) ||
    !Number.isFinite(row.hlCiLow) ||
    !Number.isFinite(row.hlCiHigh)
  ) {
    throw new Error('labelHlShiftHalvesRow: hlDelta and CI must be finite');
  }
  if (row.hlCiLow > row.hlCiHigh) {
    throw new Error(
      `labelHlShiftHalvesRow: hlCiLow (${row.hlCiLow}) must be <= hlCiHigh (${row.hlCiHigh})`,
    );
  }
  if (row.hlSign !== -1 && row.hlSign !== 0 && row.hlSign !== 1) {
    throw new Error(
      `labelHlShiftHalvesRow: hlSign must be -1, 0, or 1 (got ${row.hlSign})`,
    );
  }
  if (row.hlSign === 0) return 'no-detectable-shift';
  if (row.hlCiExcludesZero) {
    return row.hlSign > 0
      ? 'second-decisively-larger-by-shift'
      : 'first-decisively-larger-by-shift';
  }
  return row.hlSign > 0
    ? 'leans-second-larger-by-shift'
    : 'leans-first-larger-by-shift';
}
