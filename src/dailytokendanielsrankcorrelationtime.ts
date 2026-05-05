/**
 * daily-token-daniels-rank-correlation-time: per-source
 * DANIELS 1944 RANK CORRELATION (Spearman rho) of the
 * value-rank vector against the TIME-INDEX-RANK vector
 * (1, 2, ..., n) on the gap-filled daily total_tokens
 * series.
 *
 * TWO-HUNDRED-AND-TENTH cross-source axis.
 *
 * Mechanism. Daniels (1944 *Biometrika* 33: 129-135)
 * formalised the use of Spearman's rank correlation
 * coefficient (Spearman 1904) as a TEST FOR TREND when
 * one of the two ranked variables is the IDENTITY-RANK
 * sequence 1, 2, ..., n encoding the order of
 * observation in time. Given a series x[1], ..., x[n]
 * with no ties, let R[i] = rank of x[i] among
 * x[1..n] (smallest = 1, largest = n). Then Daniels'
 * statistic is
 *
 *     drRho = 1 - 6 * sum_{i=1..n}(R[i] - i)^2
 *                  / (n * (n^2 - 1))
 *
 * which equals the Pearson correlation between R[i]
 * and i. Under the random-permutation null (all n!
 * orderings of x equally likely):
 *
 *     E[drRho]   = 0
 *     Var[drRho] = 1 / (n - 1)        (Daniels 1944)
 *
 * For n >= 12 the standardised statistic
 *
 *     drZ = drRho / sqrt(1 / (n - 1)) = drRho * sqrt(n - 1)
 *
 * is approximately standard-normal, and the two-sided
 * p-value is
 *
 *     drPValue = 2 * (1 - Phi(|drZ|))
 *
 * where Phi is the standard-normal CDF. This is the
 * NORMAL-APPROXIMATION FORM used in Daniels 1944 and
 * reproduced in Kendall (1970, *Rank Correlation
 * Methods*, 4th ed., chap. 4) and Gibbons-Chakraborti
 * (2003 sec. 11.3).
 *
 * SIGN CONVENTION:
 *
 *   - drZ >> +1.96: drRho near +1 = ranks RISE WITH
 *     TIME = MONOTONE UP-TREND.
 *   - drZ << -1.96: drRho near -1 = ranks FALL WITH
 *     TIME = MONOTONE DOWN-TREND.
 *   - drZ ~ 0: ranks are uncorrelated with time =
 *     NO MONOTONE TREND.
 *
 * TIE HANDLING. With ties in the value series we use
 * the standard MIDRANK convention (average rank
 * assigned to all tied values), so the Spearman rho
 * formula above is REPLACED by the Pearson correlation
 * of midranks against the time-identity vector. The
 * normal-approximation variance 1/(n-1) is mildly
 * conservative under heavy ties; we still report the
 * statistic and surface the tied-group count for
 * transparency.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-208 Spearman footrule (sfZ). Footrule is
 *     the L1 sum sum |R[i] - i|, an ABSOLUTE-deviation
 *     statistic; Daniels rho uses the L2 sum
 *     sum (R[i] - i)^2, a SQUARED-deviation statistic.
 *     The two statistics agree on direction (both
 *     small when ranks align with time, large when
 *     they anti-align) but have DIFFERENT POWER
 *     PROFILES and DIFFERENT NULL VARIANCES:
 *     Var[sfTilde] under the null is (n^2 - 1) / 3
 *     (Diaconis-Graham 1977) whereas Var[drRho] under
 *     the null is 1 / (n - 1). The L2 form is more
 *     sensitive to OUTLIER rank displacements (a single
 *     index with R[i] - i = +k contributes k^2 to
 *     Daniels but only |k| to footrule); the L1 form
 *     is more robust. A series with one large
 *     dislocation gives drZ farther from 0 than sfZ,
 *     while a series with many small dislocations
 *     gives sfZ relatively further from 0.
 *
 *   - vs daily-token-mann-kendall-tau. Mann-Kendall
 *     tau is a CONCORDANT-PAIR-COUNT statistic
 *     S = sum_{i < j} sign(x[j] - x[i]) -- it counts
 *     PAIRS in agreement vs disagreement with the time
 *     ordering and does not use the explicit RANK
 *     VALUES. Daniels rho squares the rank-vs-time
 *     deviations directly. The two are MONOTONICALLY
 *     RELATED in the absence of ties but not equal:
 *     rho ~ 1 - (3/2) * (1 - tau)^2 in the limit of
 *     near-ties (Kendall 1970 chap. 1). Their null
 *     variances differ -- Var[tau] = 2(2n+5) /
 *     (9n(n-1)) while Var[rho] = 1/(n-1) -- and the
 *     standardised Z statistics are NOT equal in
 *     finite samples.
 *
 *   - vs daily-token-spearman-autocorrelation-lag1.
 *     That is a SERIAL rank correlation between R[i]
 *     and R[i+1]; Daniels is a GLOBAL rank correlation
 *     between R[i] and i. Lag-1 rank serial
 *     correlation can be near 0 for a series with a
 *     strong global trend whose noise is iid (the
 *     trend dominates the global rho but the lag-1
 *     differences look random); conversely a smooth
 *     AR(1) drift with no trend can give high lag-1
 *     correlation but near-zero global drRho.
 *
 *   - vs axis-209 Wallis-Moore phase-frequency. WM
 *     counts COMPLETE MONOTONE PHASES of the sign-of-
 *     first-difference sequence -- a LOCAL CONTIGUOUS
 *     SHAPE statistic on differences. Daniels uses the
 *     GLOBAL RANK ALIGNMENT of values with time. A
 *     series with a strong monotone trend gives
 *     drZ >> 0 AND wmZ << 0 (few phases). A perfectly
 *     RANK-SHUFFLED-but-LOCALLY-SMOOTH series (long
 *     monotone runs, but rearranged so that ranks do
 *     not align with time) gives wmZ << 0 (few phases)
 *     yet drZ near 0. A globally trending but locally
 *     noisy series gives drZ >> 0 but wmZ near 0.
 *     Mechanistically COMPLEMENTARY.
 *
 *   - vs axis-205 Cox-Stuart (csZ). Cox-Stuart pairs
 *     v[i] with v[i + ceil(n/2)] and counts the sign
 *     of differences -- a HALF-LAG SIGN-OF-PAIR
 *     statistic, NOT a rank-vs-time correlation.
 *     Cox-Stuart uses only n/2 paired comparisons;
 *     Daniels uses all n rank-time pairs.
 *
 *   - vs axis-206 Jonckheere-Terpstra. JT tests the
 *     ORDERED ALTERNATIVE across k=4 BLOCKS via SUMS
 *     OF U-COUNTS. Daniels is an unblocked global
 *     rank-correlation statistic.
 *
 *   - vs axis-207 Pitman MSSD. Pitman MSSD uses
 *     SQUARED FIRST-DIFFERENCES of the raw values, an
 *     L2 magnitude statistic on differences sensitive
 *     to scale; Daniels is RANK-BASED (scale- and
 *     monotone-transform-invariant) and uses
 *     value-rank vs time-rank.
 *
 * Pre-processing: NONE. The statistic depends only on
 * the value-RANK sequence and time-identity sequence;
 * it is invariant to any STRICTLY MONOTONE
 * reparameterisation of the series.
 *
 * Refs:
 *   Daniels, H. E., "The relation between measures of
 *     correlation in the universe of sample
 *     permutations", *Biometrika* 33 (1944),
 *     pp. 129-135.
 *   Spearman, C., "The proof and measurement of
 *     association between two things", *American
 *     Journal of Psychology* 15 (1904), pp. 72-101.
 *   Kendall, M. G., *Rank Correlation Methods*, 4th
 *     ed., Griffin (1970), chap. 4.
 *   Gibbons, J. D. & Chakraborti, S., *Nonparametric
 *     Statistical Inference*, 4th ed., Marcel Dekker
 *     (2003), sec. 11.3.
 *   Diaconis, P. & Graham, R. L., "Spearman's footrule
 *     as a measure of disarray", *J. R. Statist. Soc.
 *     B* 39 (1977), pp. 262-268. (For null variance
 *     comparison vs footrule.)
 */
import type { QueueLine } from './types.js';

export type DailyTokenDanielsRankCorrelationTimeSort =
  | 'drZ'
  | 'drZAbsDesc'
  | 'drPValue'
  | 'drPValueDesc'
  | 'drRho'
  | 'drRhoDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenDanielsRankCorrelationTimeOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 to
   * keep the Daniels rho normal approximation reasonable
   * (Kendall 1970 chap. 4 recommends n >= 10-12 for the
   * sqrt(n-1) standardisation).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenDanielsRankCorrelationTimeSort;
  generatedAt?: string;
}

export interface DailyTokenDanielsRankCorrelationTimeSourceRow {
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
  /** Number of tied groups (groups of >=2 equal values). */
  nTiedGroups: number;
  /** Daniels Spearman rho between value-ranks and time-identity. */
  drRho: number;
  /** Closed-form null variance Var[rho] = 1 / (n - 1). */
  drRhoVariance: number;
  /** Standardised Z = rho * sqrt(n - 1). */
  drZ: number;
  /** Two-sided normal-tail p-value 2 * (1 - Phi(|drZ|)). */
  drPValue: number;
}

export interface DailyTokenDanielsRankCorrelationTimeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenDanielsRankCorrelationTimeSort;
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
  sources: DailyTokenDanielsRankCorrelationTimeSourceRow[];
}

/**
 * Compute MIDRANKS of a numeric vector. Tied values
 * receive the average of the positions they would
 * occupy. Returns an array of the same length as the
 * input. Also returns the number of TIED GROUPS (groups
 * of size >= 2) for diagnostic surfacing.
 */
export function danielsMidranks(values: number[]): {
  ranks: number[];
  nTiedGroups: number;
} {
  const n = values.length;
  const idx: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) idx[i] = i;
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks: number[] = new Array(n);
  let i = 0;
  let nTiedGroups = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && values[idx[j]!]! === values[idx[i]!]!) j += 1;
    const avg = (i + 1 + j) / 2;
    if (j - i >= 2) nTiedGroups += 1;
    for (let k = i; k < j; k += 1) ranks[idx[k]!] = avg;
    i = j;
  }
  return { ranks, nTiedGroups };
}

/**
 * Compute Daniels' rank correlation rho between the
 * value-rank vector R and the time-identity vector
 * (1, 2, ..., n). Uses the Pearson correlation form so
 * that midranks under ties are handled correctly.
 */
export function danielsRankCorrelationRho(
  ranks: number[],
): number {
  const n = ranks.length;
  if (n < 2) {
    throw new Error(
      `danielsRankCorrelationRho: need at least 2 ranks (got ${n})`,
    );
  }
  const meanR = (n + 1) / 2;
  let num = 0;
  let denomR = 0;
  let denomI = 0;
  for (let i = 0; i < n; i += 1) {
    const dr = ranks[i]! - meanR;
    const di = i + 1 - meanR;
    num += dr * di;
    denomR += dr * dr;
    denomI += di * di;
  }
  if (denomR === 0 || denomI === 0) {
    throw new Error(
      `danielsRankCorrelationRho: zero variance in ranks (n=${n})`,
    );
  }
  return num / Math.sqrt(denomR * denomI);
}

/**
 * Closed-form null variance of Daniels rho under the
 * uniform-random permutation null: Var[rho] = 1 / (n - 1)
 * (Daniels 1944 / Kendall 1970 chap. 4).
 */
export function danielsRhoVariance(n: number): number {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(
      `danielsRhoVariance: n must be integer >= 2 (got ${n})`,
    );
  }
  return 1 / (n - 1);
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via the
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailDanielsRankCorrelationTime(
  z: number,
): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailDanielsRankCorrelationTime: z must be finite (got ${z})`,
    );
  }
  if (z < 0)
    return 1 - standardNormalUpperTailDanielsRankCorrelationTime(-z);
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

export function dailyTokenDanielsRankCorrelationTime(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  nTiedGroups: number;
  drRho: number;
  drRhoVariance: number;
  drZ: number;
  drPValue: number;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenDanielsRankCorrelationTime: need at least 12 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenDanielsRankCorrelationTime requires finite values',
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
      `dailyTokenDanielsRankCorrelationTime: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ss / (n - 1));
  const { ranks, nTiedGroups } = danielsMidranks(values);
  const drRho = danielsRankCorrelationRho(ranks);
  const drRhoVariance = danielsRhoVariance(n);
  if (!(drRhoVariance > 0) || !Number.isFinite(drRhoVariance)) {
    throw new Error(
      `dailyTokenDanielsRankCorrelationTime: non-positive variance (n=${n})`,
    );
  }
  const drZ = drRho / Math.sqrt(drRhoVariance);
  if (!Number.isFinite(drZ)) {
    throw new Error(
      `dailyTokenDanielsRankCorrelationTime: non-finite z (n=${n})`,
    );
  }
  const drPValue =
    2 *
    standardNormalUpperTailDanielsRankCorrelationTime(Math.abs(drZ));
  return {
    mean: mu,
    stddev,
    nSamples: n,
    nTiedGroups,
    drRho,
    drRhoVariance,
    drZ,
    drPValue: Math.min(1, Math.max(0, drPValue)),
  };
}

export interface DanielsRankCorrelationTimeCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanDrZ: number;
  tenureWeightedMeanDrZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

/**
 * Corpus-level SIGNED aggregator: combines per-source
 * SIGNED drZ values via Stouffer's (1949) Z-method.
 * Skips rows with non-finite drZ, malformed drPValue,
 * or tenure below the floor.
 */
export function aggregateDanielsRankCorrelationTime(
  rows: ReadonlyArray<{
    drZ: number;
    drPValue: number;
    nTenureDays: number;
  }>,
): DanielsRankCorrelationTimeCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.drZ) ||
      !Number.isFinite(r.drPValue) ||
      r.drPValue < 0 ||
      r.drPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.drZ;
    weightedZSum += r.nTenureDays * r.drZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanDrZ: Number.NaN,
      tenureWeightedMeanDrZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 *
    standardNormalUpperTailDanielsRankCorrelationTime(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanDrZ: zSum / used,
    tenureWeightedMeanDrZ: weightedZSum / totalTenure,
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

export function buildDailyTokenDanielsRankCorrelationTime(
  queue: QueueLine[],
  opts: DailyTokenDanielsRankCorrelationTimeOptions = {},
): DailyTokenDanielsRankCorrelationTimeReport {
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
  const sort: DailyTokenDanielsRankCorrelationTimeSort =
    opts.sort ?? 'drZAbsDesc';
  const validSorts: DailyTokenDanielsRankCorrelationTimeSort[] = [
    'drZ',
    'drZAbsDesc',
    'drPValue',
    'drPValueDesc',
    'drRho',
    'drRhoDesc',
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
  const rows: DailyTokenDanielsRankCorrelationTimeSourceRow[] = [];

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
      result = dailyTokenDanielsRankCorrelationTime(filled);
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
      nTiedGroups: result.nTiedGroups,
      drRho: result.drRho,
      drRhoVariance: result.drRhoVariance,
      drZ: result.drZ,
      drPValue: result.drPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'drZ':
        primary = a.drZ - b.drZ;
        break;
      case 'drZAbsDesc':
        primary = Math.abs(b.drZ) - Math.abs(a.drZ);
        break;
      case 'drPValue':
        primary = a.drPValue - b.drPValue;
        break;
      case 'drPValueDesc':
        primary = b.drPValue - a.drPValue;
        break;
      case 'drRho':
        primary = a.drRho - b.drRho;
        break;
      case 'drRhoDesc':
        primary = b.drRho - a.drRho;
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
