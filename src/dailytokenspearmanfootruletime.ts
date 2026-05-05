/**
 * daily-token-spearman-footrule-time: per-source SPEARMAN
 * 1906 FOOTRULE RANK DISTANCE between the value-rank
 * vector and the time-identity-rank vector of the gap-
 * filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-EIGHTH cross-source axis.
 *
 * Mechanism. Spearman (1906 *Brit. J. Psychol.* 2:
 * 89-108) introduces, alongside the rank correlation
 * coefficient that bears his name, the FOOTRULE STATISTIC
 *
 *     D = sum_{i=1..n} | R(x[i]) - i |
 *
 * where R(x[i]) is the (mid-rank) rank of x[i] within
 * x[1..n] (broken with the standard average-of-tied-
 * ranks convention) and i is the chronological index
 * (i.e. the time-identity rank). D is the L1 DISTANCE
 * between the value-rank permutation pi = (R(x[1]), ...,
 * R(x[n])) and the IDENTITY permutation (1, 2, ..., n)
 * on the symmetric group S_n. Diaconis & Graham (1977
 * *J. Roy. Statist. Soc. B* 39: 262-268) study this
 * statistic in detail and give its EXACT MOMENTS under
 * the uniform-random-permutation null:
 *
 *     E[D]   = (n^2 - 1) / 3
 *     Var[D] = (n + 1) (2 n^2 + 7) / 45    (n >= 2)
 *
 * (the variance formula is Diaconis-Graham 1977 eq. 2.2;
 * the expectation is the trivial integral E|U - V| over
 * uniform discrete U, V on {1..n}). For n >= 12 the
 * standardised statistic
 *
 *     sfZ = (D - E[D]) / sqrt(Var[D])
 *
 * is approximately standard-normal under H0 (uniform
 * permutation), and the two-sided p-value is
 *
 *     sfPValue = 2 * (1 - Phi(|sfZ|))
 *
 * (Phi the standard-normal CDF; Diaconis-Graham 1977
 * sec. 3 give the asymptotic-normality argument via the
 * combinatorial CLT of Hoeffding 1951.)
 *
 * SIGN CONVENTION:
 *
 *   - sfZ << -1.96: D much SMALLER than E[D] = the value
 *     ranks track the time index too closely =
 *     STRONG MONOTONE INCREASING TREND (rank-vector ~
 *     identity).
 *   - sfZ >> +1.96: D much LARGER than E[D] = the value
 *     ranks are FARTHER from the identity than under a
 *     random permutation = STRONG MONOTONE DECREASING
 *     TREND (rank-vector ~ reverse identity, which gives
 *     the maximum footrule distance D_max =
 *     floor(n^2 / 2)).
 *   - sfZ ~ 0: no detectable monotone trend in the
 *     rank-vs-time L1 metric.
 *
 * Note that sfZ is SIGNED with a STRONGER REJECTION at
 * BOTH TAILS but with OPPOSITE TREND DIRECTIONS (UP at
 * lower tail, DOWN at upper tail) -- this is the
 * geometric peculiarity of the L1-rank-distance
 * statistic: the IDENTITY permutation (perfect up-trend)
 * minimises D (D_min = 0) and the REVERSE permutation
 * (perfect down-trend) maximises D (D_max approx
 * n^2/2). Thus the sign of (D - E[D]) classifies trend
 * DIRECTION, and the magnitude classifies trend
 * STRENGTH.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-mann-kendall-tau (axis trending tau).
 *     Mann-Kendall tau counts SIGNED PAIRWISE
 *     CONCORDANCES (Kendall 1938 tau-b on pairs (i,j)
 *     with i < j). Spearman footrule sums the L1
 *     RANK-DISTANCE per element. The two are
 *     PROVABLY DIFFERENT functions of the rank
 *     permutation: tau is a U-statistic of order 2,
 *     footrule is an L-statistic of order 1. A
 *     permutation with many small local rank
 *     displacements (e.g. each i swapped with i+1)
 *     gives footrule = n but tau ~ -1 + 2/n -- they
 *     measure orthogonal aspects of departure from
 *     identity.
 *
 *   - vs daily-token-spearman-autocorrelation-lag-1.
 *     Lag-1 Spearman autocorrelation is a LOCAL
 *     correlation at lag 1; footrule is a GLOBAL
 *     L1-distance from the identity. A series whose
 *     ranks are random within each half but the two
 *     halves are swapped gives high lag-1
 *     autocorrelation (within each half) but a large
 *     footrule (the swap puts each rank far from its
 *     time index).
 *
 *   - vs axis-206 Jonckheere-Terpstra. JT tests the
 *     ORDERED ALTERNATIVE across k=4 BLOCKS via SUMS OF
 *     PAIRWISE U-COUNTS. Spearman footrule is a per-
 *     element L1 distance over the WHOLE series -- no
 *     blocking, no pairwise enumeration, finer
 *     resolution at the cost of less robustness to
 *     within-block heterogeneity.
 *
 *   - vs axis-207 Pitman MSSD. Pitman tests LAG-1
 *     SERIAL EXCHANGEABILITY via squared first-
 *     differences against a permutation reference;
 *     footrule tests GLOBAL MONOTONE TREND via L1
 *     rank distance. A linear trend with iid noise
 *     gives footrule strongly negative sfZ (clear
 *     trend) but Pitman ppZ ~ 0 (no lag-1 dependence
 *     once trend is exchangeably permuted in the null
 *     comparison -- though the null itself is
 *     unconditional, not detrended); a smooth zigzag
 *     gives Pitman ppZ << 0 (smoothness) but footrule
 *     sfZ ~ 0 (no monotone trend).
 *
 *   - vs axis-205 Cox-Stuart sign-pairs. Cox-Stuart
 *     pairs v[i] with v[i + ceil(n/2)] and counts
 *     sign-of-difference; footrule uses ALL n values
 *     and the ENTIRE rank permutation. Cox-Stuart sees
 *     a trend that is monotone over the FIRST-vs-
 *     SECOND-HALF span; footrule sees the full
 *     rank-vs-time alignment.
 *
 *   - vs daily-token-turning-point-rate / Bienayme-
 *     Kendall. TPR is a sign-change count of FIRST
 *     DIFFERENCES; footrule is an L1 distance of RANKS.
 *     A monotone series (no turning points) maximises
 *     |sfZ| (perfect trend) and minimises tpr; a
 *     strict zigzag maximises tpr but gives footrule
 *     ~ E[D] (the rank permutation looks random in L1
 *     even though it is highly structured locally).
 *
 * Pre-processing: NONE (raw values, gap-filled with
 * zeros for absent days). Footrule uses MID-RANKS so
 * ties (very common when two days have the same
 * gap-filled token total of zero) are handled by
 * assigning each tied observation the average of the
 * ranks they would occupy. The footrule statistic is
 * SHIFT-INVARIANT and SCALE-INVARIANT (rank-only). The
 * Z-score is also shift- and scale-invariant.
 *
 * Hard floor on min-tenure-days: 12 (matching the rest
 * of the trend trilogy axis-205/206/207; gives a
 * reasonable normal-approximation accuracy via the
 * Hoeffding combinatorial CLT for n >= 12).
 *
 * Determinism. Pure deterministic function of the input
 * series: same inputs always give the same D, the same
 * sfZ, and the same p-value. No PRNG.
 *
 * Reference:
 *   Spearman, C., "Footrule for measuring correlation",
 *     *British Journal of Psychology* 2 (1906),
 *     pp. 89-108.
 *   Diaconis, P. & Graham, R. L., "Spearman's footrule
 *     as a measure of disarray", *J. Roy. Statist. Soc.
 *     Series B* 39 (1977), pp. 262-268.
 *   Hoeffding, W., "A combinatorial central limit
 *     theorem", *Annals of Mathematical Statistics* 22
 *     (1951), pp. 558-566.
 */
import type { QueueLine } from './types.js';

export type DailyTokenSpearmanFootruleTimeSort =
  | 'sfZ'
  | 'sfZAbsDesc'
  | 'sfPValue'
  | 'sfPValueDesc'
  | 'sfD'
  | 'sfDDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSpearmanFootruleTimeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep the Hoeffding combinatorial-CLT normal
   * approximation reasonable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSpearmanFootruleTimeSort;
  generatedAt?: string;
}

export interface DailyTokenSpearmanFootruleTimeSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled daily series. */
  mean: number;
  /** Sample stddev of the gap-filled daily series. */
  stddev: number;
  /** Observed Spearman footrule D = sum |R(x[i]) - i|. */
  sfD: number;
  /** Closed-form expectation E[D] = (n^2 - 1) / 3 under uniform permutation. */
  sfDExpected: number;
  /** Closed-form variance Var[D] = (n+1)(2 n^2 + 7) / 45 under uniform permutation. */
  sfDVariance: number;
  /** Standardised Z = (D - E[D]) / sqrt(Var[D]). */
  sfZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|sfZ|)). */
  sfPValue: number;
}

export interface DailyTokenSpearmanFootruleTimeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSpearmanFootruleTimeSort;
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
  sources: DailyTokenSpearmanFootruleTimeSourceRow[];
}

/**
 * Compute the MID-RANK vector of `values` using the
 * average-of-tied-ranks convention. For x = [3, 1, 1, 2]
 * returns ranks [4, 1.5, 1.5, 3].
 */
export function spearmanFootruleMidRanks(values: number[]): number[] {
  const n = values.length;
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => {
    const va = values[a]!;
    const vb = values[b]!;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return a - b;
  });
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) j += 1;
    // Average rank for the tie group i..j is
    // ((i+1) + (j+1)) / 2 (ranks are 1-based).
    const avg = ((i + 1) + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Compute the Spearman footrule statistic D = sum
 * |R(x[i]) - i|, where R is the mid-rank vector and i
 * is the 1-based time index.
 */
export function spearmanFootruleStatistic(values: number[]): number {
  const ranks = spearmanFootruleMidRanks(values);
  let d = 0;
  for (let i = 0; i < values.length; i += 1) {
    d += Math.abs(ranks[i]! - (i + 1));
  }
  return d;
}

/**
 * Closed-form expectation of D under the uniform-random
 * permutation null: E[D] = (n^2 - 1) / 3.
 */
export function spearmanFootruleExpectedD(n: number): number {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(
      `spearmanFootruleExpectedD: n must be integer >= 2 (got ${n})`,
    );
  }
  return (n * n - 1) / 3;
}

/**
 * Closed-form variance of D under the uniform-random
 * permutation null: Var[D] = (n + 1)(2 n^2 + 7) / 45
 * (Diaconis-Graham 1977 eq. 2.2).
 */
export function spearmanFootruleVarianceD(n: number): number {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(
      `spearmanFootruleVarianceD: n must be integer >= 2 (got ${n})`,
    );
  }
  return ((n + 1) * (2 * n * n + 7)) / 45;
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailSpearmanFootruleTime(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailSpearmanFootruleTime: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailSpearmanFootruleTime(-z);
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const t = 1 / (1 + p * z);
  const phi = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const poly =
    b1 * t +
    b2 * t * t +
    b3 * t * t * t +
    b4 * t * t * t * t +
    b5 * t * t * t * t * t;
  const q = phi * poly;
  return q < 0 ? 0 : q > 1 ? 1 : q;
}

export function dailyTokenSpearmanFootruleTime(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  sfD: number;
  sfDExpected: number;
  sfDVariance: number;
  sfZ: number;
  sfPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenSpearmanFootruleTime: need at least 12 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenSpearmanFootruleTime requires finite values',
      );
    }
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let ss = 0;
  for (const v of values) {
    const c = v - mu;
    ss += c * c;
  }
  if (ss === 0) {
    throw new Error(
      `dailyTokenSpearmanFootruleTime: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const sfD = spearmanFootruleStatistic(values);
  const sfDExpected = spearmanFootruleExpectedD(n);
  const sfDVariance = spearmanFootruleVarianceD(n);
  if (!(sfDVariance > 0) || !Number.isFinite(sfDVariance)) {
    throw new Error(
      `dailyTokenSpearmanFootruleTime: non-positive variance (n=${n})`,
    );
  }
  const sfZ = (sfD - sfDExpected) / Math.sqrt(sfDVariance);
  if (!Number.isFinite(sfZ)) {
    throw new Error(
      `dailyTokenSpearmanFootruleTime: non-finite z (n=${n})`,
    );
  }
  const sfPValue =
    2 * standardNormalUpperTailSpearmanFootruleTime(Math.abs(sfZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    sfD,
    sfDExpected,
    sfDVariance,
    sfZ,
    sfPValue: Math.min(1, Math.max(0, sfPValue)),
  };
}

export interface SpearmanFootruleTimeCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanSfZ: number;
  tenureWeightedMeanSfZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED sfZ values via Stouffer's (1949) Z-method.
 * Skips rows with non-finite sfZ, malformed sfPValue, or
 * tenure below the floor.
 */
export function aggregateSpearmanFootruleTime(
  rows: ReadonlyArray<{
    sfZ: number;
    sfPValue: number;
    nTenureDays: number;
  }>,
): SpearmanFootruleTimeCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.sfZ) ||
      !Number.isFinite(r.sfPValue) ||
      r.sfPValue < 0 ||
      r.sfPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.sfZ;
    weightedZSum += r.nTenureDays * r.sfZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanSfZ: Number.NaN,
      tenureWeightedMeanSfZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailSpearmanFootruleTime(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanSfZ: zSum / used,
    tenureWeightedMeanSfZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
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

export function buildDailyTokenSpearmanFootruleTime(
  queue: QueueLine[],
  opts: DailyTokenSpearmanFootruleTimeOptions = {},
): DailyTokenSpearmanFootruleTimeReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 12;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 12) {
    throw new Error(
      `minTenureDays must be an integer >= 12 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenSpearmanFootruleTimeSort = opts.sort ?? 'sfZAbsDesc';
  const validSorts: DailyTokenSpearmanFootruleTimeSort[] = [
    'sfZ',
    'sfZAbsDesc',
    'sfPValue',
    'sfPValueDesc',
    'sfD',
    'sfDDesc',
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
  const rows: DailyTokenSpearmanFootruleTimeSourceRow[] = [];

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
      result = dailyTokenSpearmanFootruleTime(filled);
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
      sfD: result.sfD,
      sfDExpected: result.sfDExpected,
      sfDVariance: result.sfDVariance,
      sfZ: result.sfZ,
      sfPValue: result.sfPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'sfZ':
        primary = a.sfZ - b.sfZ;
        break;
      case 'sfZAbsDesc':
        primary = Math.abs(b.sfZ) - Math.abs(a.sfZ);
        break;
      case 'sfPValue':
        primary = a.sfPValue - b.sfPValue;
        break;
      case 'sfPValueDesc':
        primary = b.sfPValue - a.sfPValue;
        break;
      case 'sfD':
        primary = a.sfD - b.sfD;
        break;
      case 'sfDDesc':
        primary = b.sfD - a.sfD;
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
