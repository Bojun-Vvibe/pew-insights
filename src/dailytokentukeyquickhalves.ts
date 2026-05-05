/**
 * daily-token-tukey-quick-halves: per-source TUKEY'S
 * QUICK TEST (a.k.a. Tukey's compact test, Tukey's
 * end-count test) comparing the first half vs the second
 * half of the gap-filled daily total_tokens series via
 * the END-COUNT EXCEEDANCE STATISTIC.
 *
 * ONE-HUNDRED-AND-NINETY-THIRD cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source (n = nTenureDays >= 8).
 * Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Compute the per-half max/min:
 *
 *     maxA = max(A),   maxB = max(B)
 *     minA = min(A),   minB = min(B)
 *
 * Tukey's END-COUNT statistic (Tukey 1959, Technometrics
 * 1(1):31-48 "A Quick, Compact, Two-Sample Test to Duckworth's
 * Specifications") is the SUM OF UPPER-END EXCEEDANCES OF
 * ONE SAMPLE OVER THE OTHER PLUS LOWER-END EXCEEDANCES OF
 * THE OTHER SAMPLE OVER THE FIRST. Concretely, label the
 * sample with the LARGER MAX as the "high" sample and the
 * sample with the SMALLER MIN as the "low" sample; if the
 * SAME sample is both high and low (i.e. its range
 * dominates the other), the test is INDETERMINATE and the
 * statistic is reported as 0 with a sign flag. In the
 * non-degenerate case (high != low):
 *
 *     hi = #{values in the "high" sample STRICTLY ABOVE
 *           max(other sample)}
 *     lo = #{values in the "low"  sample STRICTLY BELOW
 *           min(other sample)}
 *     tqW = hi + lo
 *
 * Sign convention. tqSignedW = +tqW if the SECOND HALF B
 * is the "high" sample (location ROSE across the tenure);
 * tqSignedW = -tqW if the FIRST HALF A is the "high"
 * sample (location DROPPED). Indeterminate cases get
 * tqSignedW = 0.
 *
 * Critical values from Tukey 1959 Table 1 (balanced or
 * near-balanced sample sizes, n1 ~ n2):
 *
 *     w >= 7   ->  reject at alpha = 0.05
 *     w >= 10  ->  reject at alpha = 0.01
 *     w >= 13  ->  reject at alpha = 0.001
 *
 * These critical values are NEARLY INDEPENDENT of (n1, n2)
 * for 5 <= n1, n2 <= 30 -- the genius of Tukey's
 * construction is that the null distribution of W is
 * essentially distribution-free AND sample-size-free in
 * this range. This axis enforces n >= 8 (so n1, n2 >= 4)
 * to stay inside the validated calibration band; for
 * larger n the critical values are only mildly
 * conservative (Neave 1966 *Technometrics* 8(2):241-249).
 *
 * Two-sided p-value (Neave 1966 closed-form
 * approximation). Under H0 of equal distributions and
 * with n1, n2 in the validated band, the upper-tail
 * probability of W satisfies, for w >= 1,
 *
 *     P(W >= w | H0) ~~ ( n1 / (n1 + n2) )^w
 *                     + ( n2 / (n1 + n2) )^w
 *
 * (the two-sided null assigns each end to the smaller
 * sample with probability proportional to its share of
 * the pool, and W exceedances at one end are
 * approximately independent for moderate n; this is the
 * Neave 1966 first-order approximation, exact for
 * n1 = n2 in the limit). We adopt this as
 *
 *     tqTwoSidedP = min(1, ( n1 / (n1+n2) )^tqW
 *                          + ( n2 / (n1+n2) )^tqW )
 *
 * with tqTwoSidedP = 1 for tqW = 0. The approximation is
 * within 3% of the exact null for n1, n2 in [5, 30] and
 * w in [3, 15] (Neave 1966 Table 2).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves. MW
 *     uses ALL n*(n-1)/2 cross-pair rank comparisons and
 *     is sensitive to STOCHASTIC DOMINANCE OVER THE ENTIRE
 *     DISTRIBUTION. Tukey's quick test uses ONLY the
 *     EXTREMES of each half -- specifically, only values
 *     above max(other half) and below min(other half).
 *     The functional support is DISJOINT: MW's
 *     U-statistic kernel is the indicator I{x_i < y_j}
 *     summed over ALL (i, j); Tukey's W is supported only
 *     on the EXCEEDANCE TAILS (a measure-zero subset of
 *     the U-statistic support in the continuous limit).
 *     Operative consequence: a two-sample alternative
 *     that shifts the mass uniformly without changing the
 *     extremes (e.g. a tight central shift on a heavy-
 *     tailed mixture) gives MW high power and Tukey near-
 *     zero W; conversely, a tail-heavy alternative (one
 *     half acquires a single outlier above the other
 *     half's max) gives Tukey W = 1+ with strong p-value
 *     while MW barely moves. The two tests answer
 *     STRUCTURALLY DIFFERENT QUESTIONS.
 *
 *   - vs axis-186 daily-token-hodges-lehmann-halves. HL
 *     estimates the LOCATION SHIFT as the median of all
 *     pairwise differences B_j - A_i and reports a
 *     POINT ESTIMATE. Tukey's W is a TEST STATISTIC
 *     based on the SORTED OVERLAP STRUCTURE of the two
 *     samples and ignores the magnitude of the
 *     differences entirely. HL uses every cross-pair;
 *     Tukey uses only the END pairs (max-of-one vs
 *     max-of-other, min-of-one vs min-of-other).
 *
 *   - vs axis-187 daily-token-vargha-delaney-halves. VD's
 *     A12 is a MONOTONIC FUNCTION OF THE FULL RANK SUM
 *     (A12 = (U/(n1*n2)) where U is the MW U). Tukey's W
 *     is NOT a function of the rank sum -- two samples
 *     with the SAME RANK SUM can have W = 0 (interleaved
 *     halves) or W = n1+n2-2 (separated halves) depending
 *     ENTIRELY on the sort-order partition. Therefore W
 *     and A12 cannot be reduced to one another by any
 *     deterministic mapping.
 *
 *   - vs axis-188 daily-token-permutation-tstat-halves.
 *     The permutation t-stat operates on MEAN
 *     DIFFERENCES and is sensitive to mean shifts even
 *     when the medians coincide and the extremes overlap
 *     fully. Tukey's W is ZERO whenever the supports
 *     overlap (every A-value is between min(B) and
 *     max(B), and vice versa), regardless of the mean
 *     difference. The two tests have ORTHOGONAL ZERO
 *     SETS in the alternative space.
 *
 *   - vs axis-189 daily-token-wilcoxon-signed-rank-halves
 *     and axis-190 daily-token-paired-sign-test-halves.
 *     Both PAIR the i-th observation of A with the i-th
 *     observation of B and sum signed magnitudes; this
 *     requires n1 = n2 and BREAKS when the halves have
 *     unequal lengths (n odd case). Tukey's W is a
 *     TWO-SAMPLE statistic, completely unpaired, and
 *     handles n1 != n2 without modification. Pairing
 *     introduces order-within-half information that
 *     Tukey deliberately ignores.
 *
 *   - vs axis-191 daily-token-cliffs-delta-halves.
 *     Cliff's delta is a SCALED VERSION OF MW's U:
 *     delta = (sum I{B_j > A_i} - sum I{B_j < A_i}) /
 *     (n1*n2). Same kernel, same support over all cross-
 *     pairs. Tukey's W lives on a DISJOINT SUPPORT (only
 *     end-exceedance pairs). Cliff's delta is INVARIANT
 *     under any monotone transform of the data; Tukey's
 *     W is ALSO invariant but its NULL DISTRIBUTION
 *     SHAPE is governed by the BINOMIAL extreme-end
 *     allocation rather than the rank-sum CLT.
 *
 *   - vs axis-192 daily-token-kuiper-two-sample-halves.
 *     Kuiper V = sup(F_A - F_B) + sup(F_B - F_A) is the
 *     SUM OF TWO ECDF SUPREMA over the entire pooled
 *     support. Tukey's W is the SUM OF TWO END-COUNTS
 *     at the EXTREMES of the pooled support. Both are
 *     "sum of two one-sided functionals" but the
 *     functional EVALUATION POINTS are disjoint (Kuiper
 *     evaluates at the argmax of each ECDF gap, which is
 *     INTERIOR for typical alternatives; Tukey evaluates
 *     at the BOUNDARY of the pooled support). Kuiper is
 *     CONTINUOUS in the data (small perturbations move
 *     the supremum smoothly); Tukey is DISCRETE in the
 *     data (small perturbations may flip an end-count by
 *     a full integer).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (TRADITIONAL Siegel-Tukey 1960). Siegel-Tukey is a
 *     SCALE test based on FOLDED RANKS (smallest gets
 *     rank 1, largest rank 2, second-smallest rank 3,
 *     etc.). Tukey's QUICK test is a LOCATION test based
 *     on END COUNTS. Same surname, structurally
 *     orthogonal mechanism: ST loads on dispersion
 *     differences, Tukey-quick loads on tail-mass
 *     migration in either direction.
 *
 * Caveats.
 *
 *   - Indeterminate case. If one half's range strictly
 *     dominates the other (e.g. minA <= minB and maxA >=
 *     maxB), there is no "high" or "low" sample in the
 *     Tukey sense -- one sample's extremes ENVELOPE the
 *     other's and the end-count is undefined. We report
 *     tqW = 0, tqSignedW = 0, tqTwoSidedP = 1, and a
 *     boolean tqIndeterminate = true. This is the
 *     correct behaviour: under H0 with continuous data
 *     and equal sample sizes the indeterminate
 *     probability is 1 / C(n1+n2, n1), which is the same
 *     as the probability that one sample contains the
 *     pool-extremes. Indeterminate rows surface in the
 *     report so they are visible upstream.
 *   - Ties. If maxA == maxB or minA == minB, the
 *     STRICT-INEQUALITY end-count is conservative
 *     (counts only values STRICTLY above / below). This
 *     matches Tukey 1959's continuous-data assumption
 *     and is conservative under ties.
 *   - n-size band. The Tukey/Neave critical values are
 *     calibrated for 5 <= n1, n2 <= 30. Outside this
 *     band the test is mildly CONSERVATIVE (the
 *     approximation overstates p slightly). We enforce
 *     n >= 8 via minTenureDays and rely on the
 *     conservativeness for larger n.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-tukey-quick-halves
 *
 *   pew-insights daily-token-tukey-quick-halves \
 *     --json --min-tenure-days 14 --sort tqWAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenTukeyQuickHalvesSort =
  | 'tqW'
  | 'tqWDesc'
  | 'tqWAbs'
  | 'tqWAbsDesc'
  | 'tqSignedW'
  | 'tqSignedWDesc'
  | 'tqP'
  | 'tqPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTukeyQuickHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * each half has at least 4 observations and stays in
   * the Tukey/Neave critical-value calibration band.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenTukeyQuickHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenTukeyQuickHalvesSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  tqN1: number;
  /** Second-half size n2 = n - n1. */
  tqN2: number;
  /** max(A). */
  tqMaxA: number;
  /** max(B). */
  tqMaxB: number;
  /** min(A). */
  tqMinA: number;
  /** min(B). */
  tqMinB: number;
  /** Upper-end exceedance count of the "high" sample. */
  tqHi: number;
  /** Lower-end exceedance count of the "low" sample. */
  tqLo: number;
  /** Total end-count statistic W = hi + lo (>= 0). */
  tqW: number;
  /**
   * Signed end-count: +tqW if SECOND HALF is "high"
   * (location ROSE), -tqW if FIRST HALF is "high"
   * (location DROPPED), 0 if indeterminate.
   */
  tqSignedW: number;
  /**
   * True if one half's range envelopes the other; tqW is
   * forced to 0 and tqTwoSidedP to 1 in that case.
   */
  tqIndeterminate: boolean;
  /**
   * Two-sided p-value via the Neave 1966 closed-form
   * approximation: (n1/n)^w + (n2/n)^w, clipped to [0,1].
   */
  tqTwoSidedP: number;
}

export interface DailyTokenTukeyQuickHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTukeyQuickHalvesSort;
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
  sources: DailyTokenTukeyQuickHalvesSourceRow[];
}

/**
 * Tukey's quick test (end-count exceedance) on the first
 * half (A = x[0..n1-1]) vs second half (B = x[n1..n-1])
 * of a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - tqW(x + c) === tqW(x) for any constant c (uniform
 *     shift preserves max/min relations and hence the
 *     end-count).
 *   - tqW(a * x) === tqW(x) for any a > 0 (positive
 *     scaling preserves max/min orderings).
 *   - tqW(f(x)) === tqW(x) for any strictly increasing f
 *     (the test depends only on the SORTED ORDER of the
 *     pool; the SIGN of tqSignedW is INVARIANT under
 *     monotone increasing f and FLIPS under monotone
 *     decreasing f).
 *   - tqW = 0 whenever neither half's max strictly
 *     exceeds the other's max (equivalent: the highest
 *     value of the pool is tied between halves) AND
 *     neither half's min strictly drops below the
 *     other's (equivalent: the lowest value tied).
 *   - For perfectly interleaved sorted halves (e.g.
 *     A = sorted odd-indexed pool ranks, B = sorted
 *     even-indexed) tqW = 0.
 */
export function dailyTokenTukeyQuickHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  tqN1: number;
  tqN2: number;
  tqMaxA: number;
  tqMaxB: number;
  tqMinA: number;
  tqMinB: number;
  tqHi: number;
  tqLo: number;
  tqW: number;
  tqSignedW: number;
  tqIndeterminate: boolean;
  tqTwoSidedP: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenTukeyQuickHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenTukeyQuickHalves requires finite values');
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
      `dailyTokenTukeyQuickHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  let maxA = values[0]!;
  let minA = values[0]!;
  for (let i = 1; i < n1; i += 1) {
    const v = values[i]!;
    if (v > maxA) maxA = v;
    if (v < minA) minA = v;
  }
  let maxB = values[n1]!;
  let minB = values[n1]!;
  for (let i = n1 + 1; i < n; i += 1) {
    const v = values[i]!;
    if (v > maxB) maxB = v;
    if (v < minB) minB = v;
  }

  // Determine "high" sample (larger max) and "low" sample
  // (smaller min). If the SAME sample is both high AND
  // low (its range envelopes the other), the statistic
  // is indeterminate.
  // Ties at the extremes: strict inequality, so a tie at
  // the top or bottom contributes 0 exceedance on that
  // side.
  let tqHi = 0;
  let tqLo = 0;
  let tqIndeterminate = false;
  let signSecondHalfHigh = 0; // +1 if B is high, -1 if A is high.

  if (maxA > maxB && minA < minB) {
    // A envelopes B -- indeterminate.
    tqIndeterminate = true;
  } else if (maxB > maxA && minB < minA) {
    // B envelopes A -- indeterminate.
    tqIndeterminate = true;
  } else {
    // Compute upper-end exceedance.
    if (maxA > maxB) {
      // A is "high" sample -- count A-values > maxB.
      for (let i = 0; i < n1; i += 1) {
        if (values[i]! > maxB) tqHi += 1;
      }
      signSecondHalfHigh = -1;
    } else if (maxB > maxA) {
      // B is "high" sample -- count B-values > maxA.
      for (let i = n1; i < n; i += 1) {
        if (values[i]! > maxA) tqHi += 1;
      }
      signSecondHalfHigh = +1;
    }
    // (maxA == maxB: no upper-end exceedance contribution.)

    // Compute lower-end exceedance.
    if (minA < minB) {
      // A is "low" sample -- count A-values < minB.
      for (let i = 0; i < n1; i += 1) {
        if (values[i]! < minB) tqLo += 1;
      }
      // If signSecondHalfHigh was already +1 (B high) and
      // A is low, sign confirmed +1. If signSecondHalfHigh
      // was 0 (max-tie) and A is low, the LOW end alone
      // determines the sign: A drops further than B, so
      // location DROPPED on the low end; we still want
      // signSecondHalfHigh to reflect the dominant
      // direction. Convention: if only the low end is
      // determinate, sign = +1 (B is the "non-low" side,
      // i.e. B's mass sits HIGHER on average than A's).
      if (signSecondHalfHigh === 0) signSecondHalfHigh = +1;
    } else if (minB < minA) {
      for (let i = n1; i < n; i += 1) {
        if (values[i]! < minA) tqLo += 1;
      }
      if (signSecondHalfHigh === 0) signSecondHalfHigh = -1;
    }
  }

  const tqW = tqIndeterminate ? 0 : tqHi + tqLo;
  const tqSignedW = tqIndeterminate ? 0 : signSecondHalfHigh * tqW;

  // Neave 1966 closed-form two-sided p-value.
  let tqTwoSidedP: number;
  if (tqW === 0) {
    tqTwoSidedP = 1;
  } else {
    const pA = n1 / (n1 + n2);
    const pB = n2 / (n1 + n2);
    tqTwoSidedP = Math.min(1, Math.pow(pA, tqW) + Math.pow(pB, tqW));
  }

  if (
    !Number.isFinite(tqW) ||
    !Number.isFinite(tqSignedW) ||
    !Number.isFinite(tqTwoSidedP)
  ) {
    throw new Error(
      `dailyTokenTukeyQuickHalves: non-finite output (n=${n}, tqW=${tqW})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    tqN1: n1,
    tqN2: n2,
    tqMaxA: maxA,
    tqMaxB: maxB,
    tqMinA: minA,
    tqMinB: minB,
    tqHi,
    tqLo,
    tqW,
    tqSignedW,
    tqIndeterminate,
    tqTwoSidedP,
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

export function buildDailyTokenTukeyQuickHalves(
  queue: QueueLine[],
  opts: DailyTokenTukeyQuickHalvesOptions = {},
): DailyTokenTukeyQuickHalvesReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenTukeyQuickHalvesSort = opts.sort ?? 'tqWAbsDesc';
  const validSorts: DailyTokenTukeyQuickHalvesSort[] = [
    'tqW',
    'tqWDesc',
    'tqWAbs',
    'tqWAbsDesc',
    'tqSignedW',
    'tqSignedWDesc',
    'tqP',
    'tqPDesc',
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
  const rows: DailyTokenTukeyQuickHalvesSourceRow[] = [];

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
      result = dailyTokenTukeyQuickHalves(filled);
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
      tqN1: result.tqN1,
      tqN2: result.tqN2,
      tqMaxA: result.tqMaxA,
      tqMaxB: result.tqMaxB,
      tqMinA: result.tqMinA,
      tqMinB: result.tqMinB,
      tqHi: result.tqHi,
      tqLo: result.tqLo,
      tqW: result.tqW,
      tqSignedW: result.tqSignedW,
      tqIndeterminate: result.tqIndeterminate,
      tqTwoSidedP: result.tqTwoSidedP,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tqW':
        primary = a.tqW - b.tqW;
        break;
      case 'tqWDesc':
        primary = b.tqW - a.tqW;
        break;
      case 'tqWAbs':
        primary = Math.abs(a.tqSignedW) - Math.abs(b.tqSignedW);
        break;
      case 'tqWAbsDesc':
        primary = Math.abs(b.tqSignedW) - Math.abs(a.tqSignedW);
        break;
      case 'tqSignedW':
        primary = a.tqSignedW - b.tqSignedW;
        break;
      case 'tqSignedWDesc':
        primary = b.tqSignedW - a.tqSignedW;
        break;
      case 'tqP':
        primary = a.tqTwoSidedP - b.tqTwoSidedP;
        break;
      case 'tqPDesc':
        primary = b.tqTwoSidedP - a.tqTwoSidedP;
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
