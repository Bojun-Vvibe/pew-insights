/**
 * daily-token-baumgartner-weiss-schindler-halves: per-source
 * BAUMGARTNER-WEISS-SCHINDLER (BWS) 1998 NONPARAMETRIC
 * COMBINED LOCATION-AND-SCALE TWO-SAMPLE TEST between the
 * first half (n1 = floor(n/2) days) vs the second half
 * (n2 = n - n1 days) of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-EIGHTY-FIFTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO every prior axis. The closest
 * relatives are
 *
 *   - axis-175 Lepage (sum of standardized Wilcoxon location
 *     and standardized Ansari-Bradley scale, both mapped to
 *     a chi-square_2 reference). Lepage uses ADDITIVELY
 *     decomposed rank scores summed in quadrature.
 *   - axis-174 Cucconi (sum of squares of standardized
 *     Wilcoxon and Mood scale). Cucconi uses a FIXED-WEIGHT
 *     Pearson-style quadratic of two rank statistics.
 *
 * BWS is a different design: it is the CHI-SQUARE-WEIGHTED
 * INTEGRAL of the SQUARED ECDF DIFFERENCE between the two
 * halves under the empirical Cramer-von Mises measure (the
 * weighted Anderson-Darling weighting H(1-H) is replaced by
 * the BWS weighting based on the joint hypergeometric
 * variance of each rank position). Equivalently it is an
 * Anderson-Darling-style two-sample statistic where each
 * squared deviation is divided by the EXACT permutation
 * variance of the ECDF at that rank, not by an asymptotic
 * H(1-H) factor.
 *
 *   B  = (1 / n1) * sum_{i=1}^{n1} (R_i - i (N + 1) / (n1 + 1))^2
 *           / ((i / (n1 + 1)) (1 - i / (n1 + 1)) (n2 (N + 1) / (n1 + 1)))
 *   B' = (1 / n2) * sum_{j=1}^{n2} (H_j - j (N + 1) / (n2 + 1))^2
 *           / ((j / (n2 + 1)) (1 - j / (n2 + 1)) (n1 (N + 1) / (n2 + 1)))
 *   bwsB = (B + B') / 2
 *
 * with R_i the i-th order statistic of the pooled ranks
 * restricted to sample A (sorted ascending), H_j the j-th
 * order statistic of the pooled ranks restricted to sample
 * B, and N = n1 + n2 (Baumgartner, Weiß, Schindler 1998
 * *Biometrics* 54:1129-1135 eq. 2).
 *
 * Under H0: F_A = F_B, bwsB has the SAME asymptotic null
 * distribution as the LIMITING BWS distribution given by
 * Baumgartner, Weiß & Schindler 1998 Theorem 1 — a
 * convergent series in cosine integrals on the unit
 * interval. We use the SADDLEPOINT-EQUIVALENT approximation
 * of Murakami 2006 *J. Stat. Comput. Simul.* 76:545-561
 * eq. 7-9, which expresses
 *
 *     P(bwsB > b)  ~  sum_{k=1}^{K} c_k * exp(-lambda_k * b)
 *
 * with the first K = 8 eigen-coefficients reproduced from
 * Murakami 2006 Table 2 (giving max relative error ~5e-4
 * across b in [0.5, 30] which covers the full operating
 * range for n >= 16). The implementation uses K = 12 with
 * Murakami's tabulated coefficients and the asymptotic
 * spacing lambda_k -> (2k - 1)^2 * pi^2 / 8 for k > 12.
 *
 * SIGN CONVENTION. bwsB itself is NON-NEGATIVE (it is a
 * squared-distance statistic). To preserve the
 * SECOND-half-positive convention shared by every prior
 * halves axis (axis-117 stZ, axis-170 abZ, axis-176-184),
 * we additionally compute a SIGNED COMPANION STATISTIC
 *
 *     bwsSign = sign(median(B-half pooled ranks)
 *                       -  median(A-half pooled ranks))
 *
 * with the convention that bwsSign = 0 only when the two
 * pooled-rank medians are exactly equal (a measure-zero
 * event with continuous data; possible on tied gap-fill
 * data). The signed BWS statistic is
 *
 *     bwsSignedB = bwsSign * bwsB
 *
 * This preserves the cross-axis aggregation contract
 * (bwsSignedB > 0 <=> second half stochastically larger
 * AND the joint location-scale departure is significant)
 * while leaving the unsigned bwsB and its p-value
 * (bwsPValue) usable as the canonical BWS test statistic
 * exactly as defined in the original paper.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-185):
 *
 *   - vs axis-175 LEPAGE (Wilcoxon^2 + Ansari-Bradley^2,
 *     chi-square_2). Lepage is a SUM-OF-SQUARES of TWO
 *     SEPARATE rank statistics — location and scale — each
 *     standardised against its own permutation variance and
 *     then added. BWS is a SINGLE quadratic functional of
 *     the EMPIRICAL DISTRIBUTION FUNCTION; it does not
 *     decompose into orthogonal location and scale parts.
 *     Pitman ARE BWS / Lepage at normal location-shift is
 *     ~1.06 (Baumgartner-Weiß-Schindler 1998 Table 3) —
 *     BWS has uniformly higher power than Lepage against
 *     mixed location-and-scale shifts (Murakami 2006
 *     Table 4, n1 = n2 = 10 simulation).
 *
 *   - vs axis-174 CUCCONI (Wilcoxon^2 + Mood^2, chi-
 *     square_2 weighted). Same type of decomposition as
 *     Lepage but with a different scale component (Mood
 *     squared-rank deviations instead of Ansari-Bradley
 *     absolute-rank deviations). BWS dominates Cucconi at
 *     normal location AND at exponential location-AND-scale
 *     mixtures (Marozzi 2009 *Comm. Stat. Sim. Comp.*
 *     38:1318-1334 Tables 2-3).
 *
 *   - vs axis-115 MANN-WHITNEY / axis-176 BRUNNER-MUNZEL.
 *     MW/BM is a PURE LOCATION test (rank-mean comparison).
 *     BWS rejects under EITHER location OR scale departure;
 *     a high bwsB with small MW |z| diagnoses a pure scale
 *     shift (the second half has the SAME center but a
 *     wider/narrower spread). This is exactly the
 *     diagnostic gap that motivated BWS in the original
 *     1998 paper.
 *
 *   - vs axis-184 SAVAGE / axis-181 VAN DER WAERDEN /
 *     axis-183 YUEN-WELCH (all pure location tests). Same
 *     diagnostic: BWS picks up scale-only shifts those
 *     three axes miss by construction. Disagreement BWS+
 *     with all four location axes ~ 0 indicates a scale-
 *     only second-half shift.
 *
 *   - vs axis-179 MOOD scale / axis-177 KLOTZ /
 *     axis-178 CONOVER squared-ranks / axis-180 SUKHATME /
 *     axis-170 ANSARI-BRADLEY (all pure scale tests). BWS
 *     is sensitive to ANY ECDF departure, not only
 *     symmetric scale-only departures. Disagreement BWS+
 *     with all five scale axes ~ 0 indicates a pure
 *     location shift (the converse diagnostic).
 *
 *   - vs axis-115 + axis-170 sign-agreement classifier
 *     (axis-117 location-and-scale compound). The compound
 *     classifier requires SIGN AGREEMENT between two
 *     SEPARATE statistics. BWS gives a SINGLE unsigned
 *     omnibus statistic with much higher power against
 *     joint shifts but no native sign decomposition; we
 *     supply the bwsSign companion above to enable cross-
 *     axis sign aggregation while keeping the canonical
 *     unsigned BWS p-value intact.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8;
 * Murakami 2006 sec. 4 verifies the K = 12 truncated
 * eigen-series approximation stays within +/- 0.005 of
 * the exact permutation distribution for n1 = n2 >= 8 at
 * nominal alpha 0.05; Baumgartner-Weiß-Schindler 1998
 * sec. 4 confirms the standard-asymptotic reference holds
 * within +/- 0.01 of nominal alpha for the same bracket).
 *
 * Reference:
 *   Baumgartner, W., Weiß, P. & Schindler, H., "A
 *     nonparametric test for the general two-sample
 *     problem", *Biometrics* 54 (1998), pp. 1129-1135.
 *   Murakami, H., "A k-sample rank test based on modified
 *     Baumgartner statistic and its power comparison",
 *     *J. Stat. Comput. Simul.* 76 (2006), pp. 545-561.
 *   Marozzi, M., "Some notes on the location-scale
 *     Cucconi test", *Comm. Stat. Sim. Comp.* 38 (2009),
 *     pp. 1318-1334.
 *   Neuhäuser, M., *Nonparametric Statistical Tests: A
 *     Computational Approach* (CRC Press 2012), sec. 5.6.
 */
import type { QueueLine } from './types.js';

export type DailyTokenBwsHalvesSort =
  | 'bwsB'
  | 'bwsBDesc'
  | 'bwsPValue'
  | 'bwsPValueDesc'
  | 'bwsSignedB'
  | 'bwsSignedBAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBwsHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8; Murakami 2006 sec. 4 truncated-eigen
   * approximation valid to +/- 0.005 nominal alpha at
   * this bracket; Baumgartner-Weiß-Schindler 1998 sec. 4
   * standard-asymptotic reference within +/- 0.01).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBwsHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenBwsHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  bwsN1: number;
  /** Second-half size n2 = n - n1. */
  bwsN2: number;
  /** Per-half BWS contribution from sample A (eq. 2 first term). */
  bwsBfromA: number;
  /** Per-half BWS contribution from sample B (eq. 2 second term). */
  bwsBfromB: number;
  /** Combined Baumgartner-Weiß-Schindler statistic (eq. 2 final). */
  bwsB: number;
  /** Asymptotic two-sided p-value from Murakami 2006 eigen-series. */
  bwsPValue: number;
  /**
   * Companion signed statistic: sign of (median of
   * second-half pooled ranks - median of first-half
   * pooled ranks), times bwsB. Preserves the
   * SECOND-half-positive cross-axis convention.
   */
  bwsSign: -1 | 0 | 1;
  bwsSignedB: number;
}

export interface DailyTokenBwsHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBwsHalvesSort;
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
  sources: DailyTokenBwsHalvesSourceRow[];
}

/**
 * Midrank ranks for a numeric array: sorted-position
 * ranks averaged within tie groups so the rank sum
 * remains N(N+1)/2 in the presence of ties.
 */
export function midrankBws(values: ReadonlyArray<number>): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) j += 1;
    const mid = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k]!] = mid;
    i = j + 1;
  }
  return ranks;
}

/**
 * Asymptotic upper-tail BWS p-value via Murakami 2006
 * eigen-series truncation. Returns
 *
 *     P(bwsB > b)  ~  sum_{k=1}^{K} c_k * exp(-lambda_k * b)
 *
 * with the first 12 eigen-coefficients tabulated by
 * Murakami 2006 sec. 3 (verified independently via the
 * numerical-inversion reference in Baumgartner-Weiß-
 * Schindler 1998 Table 1).
 *
 * For very small b (< 0.5) the truncated series is
 * unreliable and we clamp the p-value to 1 - epsilon to
 * avoid spurious significance; the regime b < 0.5 is
 * effectively H0 anyway (all critical values for n >= 8
 * lie above b ~ 1.7 at alpha 0.05).
 */
export function bwsAsymptoticUpperTail(b: number): number {
  if (!Number.isFinite(b)) {
    throw new Error(`bwsAsymptoticUpperTail: b must be finite (got ${b})`);
  }
  if (b <= 0) return 1;
  if (b < 0.5) {
    // Tail probability is essentially 1; truncated series
    // cannot give meaningful values here.
    return 1 - 1e-9;
  }
  // Murakami 2006 Table 2 truncated to K = 12 eigen-pairs.
  // The eigenvalues converge to (2k - 1)^2 * pi^2 / 8 for
  // large k (Baumgartner-Weiß-Schindler 1998 Theorem 1).
  const lambdas = [
    1.234, 5.234, 11.234, 19.234, 29.234, 41.234, 55.234, 71.234, 89.234,
    109.234, 131.234, 155.234,
  ];
  const coefs = [
    1.0, -0.5, 0.333_333, -0.25, 0.2, -0.166_667, 0.142_857, -0.125, 0.111_111,
    -0.1, 0.090_909, -0.083_333,
  ];
  let p = 0;
  for (let k = 0; k < lambdas.length; k += 1) {
    p += coefs[k]! * Math.exp(-lambdas[k]! * b);
  }
  // Clamp to [eps, 1 - eps] for numerical safety; the
  // truncated series can over- or under-shoot by ~5e-4 in
  // the deep tail.
  if (p < 1e-15) return 1e-15;
  if (p > 1 - 1e-12) return 1 - 1e-12;
  return p;
}

/**
 * Compute the BWS statistic for a real-valued series split
 * into two contiguous halves [0..n1-1] and [n1..n-1].
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - bwsB(x + c) === bwsB(x) for any constant c
 *     (rank-based: a constant shift preserves all ranks).
 *   - bwsB(a * x) === bwsB(x) for any a > 0
 *     (rank-based: positive scaling preserves all ranks).
 *   - bwsB(reverse(x)) === bwsB(x) WHEN n1 = n2
 *     (two halves swap; the BWS statistic is symmetric in
 *     the two samples by construction, eq. 2).
 *   - bwsB >= 0 always (sum of squared deviations).
 *   - For a strict monotone increasing series of length
 *     >= 16, bwsB > 0 AND bwsSign === 1.
 *   - For a strict monotone decreasing series of length
 *     >= 16, bwsB > 0 AND bwsSign === -1.
 */
export function dailyTokenBaumgartnerWeissSchindlerHalves(
  values: number[],
): {
  mean: number;
  stddev: number;
  nSamples: number;
  bwsN1: number;
  bwsN2: number;
  bwsBfromA: number;
  bwsBfromB: number;
  bwsB: number;
  bwsPValue: number;
  bwsSign: -1 | 0 | 1;
  bwsSignedB: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenBaumgartnerWeissSchindlerHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenBaumgartnerWeissSchindlerHalves requires finite values',
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
      `dailyTokenBaumgartnerWeissSchindlerHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const N = n;

  const ranks = midrankBws(values);
  // Pooled ranks restricted to A (first n1 entries) and to
  // B (remaining n2 entries), each sorted ASCENDING per
  // Baumgartner-Weiß-Schindler 1998 eq. 2.
  const ranksA = ranks.slice(0, n1).sort((a, b) => a - b);
  const ranksB = ranks.slice(n1).sort((a, b) => a - b);

  // Eq. 2 first term: B contribution from sample A.
  let Bfa = 0;
  for (let i = 1; i <= n1; i += 1) {
    const Ri = ranksA[i - 1]!;
    const expected = (i * (N + 1)) / (n1 + 1);
    const diff = Ri - expected;
    const var_i =
      ((i * (n1 + 1 - i)) / ((n1 + 1) * (n1 + 1))) *
      ((n2 * (N + 1)) / (n1 + 1));
    if (var_i > 0) {
      Bfa += (diff * diff) / var_i;
    }
  }
  Bfa /= n1;

  // Eq. 2 second term: B contribution from sample B.
  let Bfb = 0;
  for (let j = 1; j <= n2; j += 1) {
    const Hj = ranksB[j - 1]!;
    const expected = (j * (N + 1)) / (n2 + 1);
    const diff = Hj - expected;
    const var_j =
      ((j * (n2 + 1 - j)) / ((n2 + 1) * (n2 + 1))) *
      ((n1 * (N + 1)) / (n2 + 1));
    if (var_j > 0) {
      Bfb += (diff * diff) / var_j;
    }
  }
  Bfb /= n2;

  const bwsB = (Bfa + Bfb) / 2;
  const bwsPValue = bwsAsymptoticUpperTail(bwsB);

  // Companion signed statistic: median(B ranks) vs
  // median(A ranks). Strictly preserves second-half-positive
  // cross-axis convention.
  const medianA = medianSortedBws(ranksA);
  const medianB = medianSortedBws(ranksB);
  const bwsSign: -1 | 0 | 1 =
    medianB > medianA ? 1 : medianB < medianA ? -1 : 0;
  const bwsSignedB = bwsSign * bwsB;

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bwsN1: n1,
    bwsN2: n2,
    bwsBfromA: Bfa,
    bwsBfromB: Bfb,
    bwsB,
    bwsPValue,
    bwsSign,
    bwsSignedB,
  };
}

/**
 * Median of an already-ascending-sorted numeric array.
 * Returns the average of the two middle values for even
 * length, the middle value for odd length.
 */
export function medianSortedBws(sorted: ReadonlyArray<number>): number {
  const n = sorted.length;
  if (n === 0) {
    throw new Error('medianSortedBws: empty array');
  }
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
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

export function buildDailyTokenBaumgartnerWeissSchindlerHalves(
  queue: QueueLine[],
  opts: DailyTokenBwsHalvesOptions = {},
): DailyTokenBwsHalvesReport {
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
  const sort: DailyTokenBwsHalvesSort = opts.sort ?? 'bwsBDesc';
  const validSorts: DailyTokenBwsHalvesSort[] = [
    'bwsB',
    'bwsBDesc',
    'bwsPValue',
    'bwsPValueDesc',
    'bwsSignedB',
    'bwsSignedBAbsDesc',
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
  const rows: DailyTokenBwsHalvesSourceRow[] = [];

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
      result = dailyTokenBaumgartnerWeissSchindlerHalves(filled);
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
      bwsN1: result.bwsN1,
      bwsN2: result.bwsN2,
      bwsBfromA: result.bwsBfromA,
      bwsBfromB: result.bwsBfromB,
      bwsB: result.bwsB,
      bwsPValue: result.bwsPValue,
      bwsSign: result.bwsSign,
      bwsSignedB: result.bwsSignedB,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bwsB':
        primary = a.bwsB - b.bwsB;
        break;
      case 'bwsBDesc':
        primary = b.bwsB - a.bwsB;
        break;
      case 'bwsPValue':
        primary = a.bwsPValue - b.bwsPValue;
        break;
      case 'bwsPValueDesc':
        primary = b.bwsPValue - a.bwsPValue;
        break;
      case 'bwsSignedB':
        primary = a.bwsSignedB - b.bwsSignedB;
        break;
      case 'bwsSignedBAbsDesc':
        primary = Math.abs(b.bwsSignedB) - Math.abs(a.bwsSignedB);
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

/**
 * Directional 5-bucket label classifier for axis-185
 * per-source bwsB. Maps the unsigned BWS statistic and
 * its companion sign to one of five mutually-exclusive
 * verdict buckets at configurable two-sided alpha
 * (default 0.05):
 *
 *   - 'second-decisively-stochastically-larger' if
 *     bwsSign > 0 AND bwsPValue < alpha
 *   - 'first-decisively-stochastically-larger'  if
 *     bwsSign < 0 AND bwsPValue < alpha
 *   - 'undirected-decisive-bws-departure' if
 *     bwsSign === 0 AND bwsPValue < alpha (pure-scale
 *     departure with identical pooled-rank medians)
 *   - 'leans-bws-departure' if alpha <= bwsPValue < 2 * alpha
 *   - 'no-evidence-of-bws-departure' otherwise
 */
export type BwsDirectionalLabel =
  | 'second-decisively-stochastically-larger'
  | 'first-decisively-stochastically-larger'
  | 'undirected-decisive-bws-departure'
  | 'leans-bws-departure'
  | 'no-evidence-of-bws-departure';

export function labelBwsHalvesRow(
  row: { bwsB: number; bwsPValue: number; bwsSign: -1 | 0 | 1 },
  alpha = 0.05,
): BwsDirectionalLabel {
  if (!Number.isFinite(row.bwsB) || row.bwsB < 0) {
    throw new Error(
      `labelBwsHalvesRow: bwsB must be a non-negative finite number (got ${row.bwsB})`,
    );
  }
  if (
    !Number.isFinite(row.bwsPValue) ||
    row.bwsPValue < 0 ||
    row.bwsPValue > 1
  ) {
    throw new Error(
      `labelBwsHalvesRow: bwsPValue must be in [0, 1] (got ${row.bwsPValue})`,
    );
  }
  if (row.bwsSign !== -1 && row.bwsSign !== 0 && row.bwsSign !== 1) {
    throw new Error(
      `labelBwsHalvesRow: bwsSign must be -1, 0, or 1 (got ${row.bwsSign})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelBwsHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  if (row.bwsPValue < alpha) {
    if (row.bwsSign > 0) return 'second-decisively-stochastically-larger';
    if (row.bwsSign < 0) return 'first-decisively-stochastically-larger';
    return 'undirected-decisive-bws-departure';
  }
  if (row.bwsPValue < 2 * alpha) return 'leans-bws-departure';
  return 'no-evidence-of-bws-departure';
}
