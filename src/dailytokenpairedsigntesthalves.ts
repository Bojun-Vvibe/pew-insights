/**
 * daily-token-paired-sign-test-halves: per-source PAIRED
 * BINOMIAL SIGN TEST on the half-split gap-filled daily
 * total_tokens series. Each day of the first half
 * (n1 = floor(n/2) days) is PAIRED with the corresponding
 * day of the second half (n2 = n - n1 days; if n is odd
 * we drop the median day so the two halves have IDENTICAL
 * length and the pairing is unambiguous). Within-pair
 * differences d_i = B_i - A_i are reduced to PURE SIGNS
 * sign(d_i) in {-1, 0, +1}; the test statistic is S+
 * (count of strictly positive d_i), referenced to its
 * EXACT BINOMIAL(N_nz, 1/2) null under H0 of within-pair
 * symmetry of d_i around 0 (where N_nz = #{i : d_i != 0}
 * after Pratt 1959 zero elimination).
 *
 * ONE-HUNDRED-AND-NINETIETH cross-source axis. SECOND
 * PAIRED-DESIGN cross-source axis (axis-189
 * wilcoxon-signed-rank-halves was the first).
 *
 * STRUCTURALLY ORTHOGONAL to every prior axis. Detail:
 *
 *   - vs axis-189 WILCOXON SIGNED-RANK PAIRED test. Both
 *     are paired-design tests on the SAME pairing of
 *     d_i = B_i - A_i, but they are MAXIMALLY
 *     COMPLEMENTARY: axis-189 keeps the FULL RANKS of
 *     |d_i| (and pays for it with a stronger
 *     distributional assumption on the paired-difference
 *     CDF -- symmetry of F_d around 0); axis-190 DISCARDS
 *     all rank-magnitude information and keeps ONLY the
 *     signs (paying nothing -- the binomial sign null
 *     requires only that each d_i be EXCHANGEABLE with
 *     its negation, a strictly weaker condition than
 *     symmetry of the entire CDF and one that holds for
 *     ANY continuous symmetric paired distribution
 *     whatever, including heavy-tailed and asymmetric-
 *     about-zero contaminations that BREAK Wilcoxon).
 *     This makes axis-190 the MOST DISTRIBUTION-FREE
 *     paired test in the family. The two together form
 *     a robustness sandwich: axis-189 has more power
 *     under symmetric tails, axis-190 still has Type-I
 *     control under arbitrary asymmetric tails.
 *   - vs axis-115 MANN-WHITNEY (independent two-sample
 *     rank-sum). MW treats the halves as INDEPENDENT
 *     samples and tests stochastic dominance F_A != F_B.
 *     axis-190 treats them as PAIRED observations of the
 *     same calendar day-position and tests whether the
 *     within-pair shift sign is balanced. The PAIRED
 *     null is STRICTLY STRONGER than the unpaired one
 *     whenever pairing reduces variance.
 *   - vs axis-188 PERMUTATION WELCH-T (independent two-
 *     sample, raw values, exchangeable null). axis-188
 *     permutes labels under exchangeability of the
 *     POOLED sample. axis-190 only uses SIGNS of
 *     within-pair differences under per-pair exchange
 *     with the negation; raw value magnitudes are
 *     entirely discarded.
 *   - vs axis-186 HL (HODGES-LEHMANN POINT ESTIMATOR +
 *     LEHMANN CI). HL is a TWO-SAMPLE point estimator
 *     of the location shift. axis-190 is a paired-
 *     design SIGNIFICANCE test on the sign balance of
 *     d_i; it does NOT estimate magnitude.
 *   - vs axis-187 A12 (Vargha-Delaney probability-of-
 *     superiority). A12 is an UNSIGNED rank-overlap
 *     effect-size on independent two-sample data.
 *     axis-190 is a SIGNED paired-design hypothesis
 *     test using only the binary up/down information.
 *   - vs axis-113 daily-token-difference-sign-test
 *     (Mood difference-sign trend test). axis-113 sums
 *     POSITIVE FIRST DIFFERENCES x[i+1] - x[i] across
 *     CONSECUTIVE days (n - 1 trials, sensitive to
 *     monotone trend). axis-190 sums positive PAIRED
 *     half-differences x[half+i] - x[i] across half-
 *     pairings (n/2 trials, sensitive to a SUSTAINED
 *     LEVEL SHIFT between the two halves but INSENSITIVE
 *     to within-half oscillation). The two are based on
 *     completely different pairings of completely
 *     different index-pairs and answer different
 *     questions.
 *
 * THE STATISTIC. Given the gap-filled daily series
 * v[0..n-1], drop v[(n-1)/2] when n is odd so n becomes
 * even, then split into A = v[0..n/2-1] and B =
 * v[n/2..n-1]. Pair (A_i, B_i) for i in [0, n/2).
 * Compute d_i = B_i - A_i. Drop zero differences (Pratt
 * 1959 zero-elimination); let N_nz = #{i : d_i != 0}.
 * Define
 *
 *     S+ = #{i : d_i > 0}       (count of positive d_i)
 *     S- = #{i : d_i < 0}       (count of negative d_i)
 *     S0 = #{i : d_i = 0}       (zero pairs, dropped)
 *
 * Under H0 of within-pair symmetry around 0,
 *
 *     S+ ~ Binomial(N_nz, 1/2)
 *     E[S+]   = N_nz / 2
 *     Var[S+] = N_nz / 4
 *
 * EXACT TWO-SIDED P. We compute the exact two-sided
 * binomial p as
 *
 *     pTwoSided = Pr( |X - N_nz/2| >= |S+ - N_nz/2| )
 *                where X ~ Binomial(N_nz, 1/2).
 *
 * This uses the SYMMETRY of Binomial(N_nz, 1/2) around
 * its mean: with k* = round(|S+ - N_nz/2|),
 * pTwoSided = Pr(X <= N_nz/2 - k*) + Pr(X >= N_nz/2 + k*).
 * One-sided p's are
 *
 *     pUpper = Pr(X >= S+)
 *     pLower = Pr(X <= S+).
 *
 * NORMAL APPROXIMATION Z (continuity-corrected) is also
 * surfaced for cross-axis comparability to other Z-
 * scaled axes:
 *
 *     Z = (S+ - N_nz/2 - 0.5 * sign(S+ - N_nz/2))
 *         / sqrt(N_nz / 4)
 *
 * (cc vanishes when S+ == N_nz/2). SIGN convention:
 * positive Z = SECOND-half larger, matching the cross-
 * axis convention from axes 115/186/187/188/189.
 *
 * EFFECT SIZE. We surface the SIGN-BALANCE PROPORTION
 *
 *     piPlus = S+ / N_nz in [0, 1]
 *
 * and the DIRECTIONAL SIGN-BALANCE STATISTIC
 *
 *     delta = (S+ - S-) / N_nz in [-1, +1]
 *
 * (delta = 2 * piPlus - 1). |delta| has a clean scale-
 * free interpretation as the net excess proportion of
 * within-pair upward shifts and is directly comparable
 * across sources of widely different token volumes.
 *
 * DECISION BUCKETS. 5-level keyed off pTwoSided:
 *
 *     pTwoSided <= 0.001  -> 'highly-significant'
 *     pTwoSided <= 0.01   -> 'very-significant'
 *     pTwoSided <= 0.05   -> 'significant'
 *     pTwoSided <= 0.10   -> 'marginal'
 *     pTwoSided >  0.10   -> 'ns'
 *
 * Refs:
 *   - Arbuthnott, J. (1710). An argument for divine
 *     providence, taken from the constant regularity
 *     observed in the births of both sexes.
 *     *Phil. Trans. R. Soc.* 27:186-190. (The original
 *     sign test.)
 *   - Dixon, W. J. & Mood, A. M. (1946). The statistical
 *     sign test. *J. Amer. Stat. Assoc.* 41(236):
 *     557-566.
 *   - Pratt, J. W. (1959). Remarks on zeros and ties in
 *     the Wilcoxon signed rank procedures. *J. Amer.
 *     Stat. Assoc.* 54(287):655-667. (Zero-elimination
 *     convention also used here.)
 *   - Conover, W. J. (1999). *Practical Nonparametric
 *     Statistics* 3rd ed. Wiley. Chapter 3.4
 *     (paired sign test, exact binomial p).
 */

import type { QueueLine } from './types.js';

export type DailyTokenPairedSignTestHalvesSort =
  | 'sPlus'
  | 'absZDesc'
  | 'pTwoSided'
  | 'absDeltaDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type PairedSignTestDecision =
  | 'highly-significant'
  | 'very-significant'
  | 'significant'
  | 'marginal'
  | 'ns';

export interface DailyTokenPairedSignTestHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPairedSignTestHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenPairedSignTestHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Number of pairs after dropping the median day if n odd. */
  pstNPairs: number;
  /** Number of non-zero pairs (zeros dropped Pratt-style). */
  pstNNonZero: number;
  /** Number of zero-difference pairs that were dropped. */
  pstNZeroDropped: number;
  /** Count of positive d_i. */
  pstSPlus: number;
  /** Count of negative d_i. */
  pstSMinus: number;
  /** Expected S+ under H0 = N_nz / 2. */
  pstExpectedSPlus: number;
  /** Variance of S+ under H0 = N_nz / 4. */
  pstVarianceSPlus: number;
  /** Continuity-corrected normal-approximation Z. */
  pstZ: number;
  /** Exact two-sided binomial p. */
  pstPTwoSided: number;
  /** Exact upper-tail binomial p = Pr(X >= S+). */
  pstPUpper: number;
  /** Exact lower-tail binomial p = Pr(X <= S+). */
  pstPLower: number;
  /** Sign of (S+ - N_nz/2) in {-1, 0, +1}. */
  pstSign: -1 | 0 | 1;
  /** Sign-balance proportion S+ / N_nz in [0, 1]. */
  pstPiPlus: number;
  /** Directional sign-balance (S+ - S-) / N_nz in [-1, 1]. */
  pstDelta: number;
  /** 5-level decision bucket. */
  pstDecision: PairedSignTestDecision;
}

export interface DailyTokenPairedSignTestHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPairedSignTestHalvesSort;
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
  sources: DailyTokenPairedSignTestHalvesSourceRow[];
}

/** Decision bucket from two-sided p. */
export function pairedSignTestDecision(
  pTwoSided: number,
): PairedSignTestDecision {
  if (!Number.isFinite(pTwoSided) || pTwoSided < 0 || pTwoSided > 1) {
    throw new Error(
      `pairedSignTestDecision: pTwoSided must be in [0, 1] (got ${pTwoSided})`,
    );
  }
  if (pTwoSided <= 0.001) return 'highly-significant';
  if (pTwoSided <= 0.01) return 'very-significant';
  if (pTwoSided <= 0.05) return 'significant';
  if (pTwoSided <= 0.10) return 'marginal';
  return 'ns';
}

/**
 * Exact Binomial(N, 1/2) PMF at k via stable log-space
 * computation. Uses lgamma-style identity log C(N,k) =
 * lgamma(N+1) - lgamma(k+1) - lgamma(N-k+1) so we never
 * touch numbers that overflow double precision even for
 * N ~ 10^4. Returns Pr(X = k).
 */
export function binomialHalfPmf(n: number, k: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`binomialHalfPmf: n must be a non-negative integer (got ${n})`);
  }
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  // log C(n,k) - n*log(2)
  const logC = lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  return Math.exp(logC - n * Math.LN2);
}

/** Lanczos approximation to lgamma(x) for x > 0. */
function lgamma(x: number): number {
  // Lanczos g=7, n=9 coefficients (Numerical Recipes).
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // reflection: lgamma(x) = log(pi/sin(pi*x)) - lgamma(1-x)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  const xm1 = x - 1;
  let a = c[0]!;
  for (let i = 1; i < g + 2; i += 1) a += c[i]! / (xm1 + i);
  const t = xm1 + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Exact lower-tail Pr(X <= k) for X ~ Binomial(n, 1/2).
 * Computed by direct summation of PMF on whichever tail
 * is smaller (we sum the tail of length min(k, n-k)+1).
 */
export function binomialHalfCdfLower(n: number, k: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`binomialHalfCdfLower: n must be a non-negative integer (got ${n})`);
  }
  if (k < 0) return 0;
  if (k >= n) return 1;
  const kk = Math.floor(k);
  // sum smaller tail.
  if (kk <= n - kk - 1) {
    let s = 0;
    for (let j = 0; j <= kk; j += 1) s += binomialHalfPmf(n, j);
    return Math.min(1, Math.max(0, s));
  } else {
    let s = 0;
    for (let j = kk + 1; j <= n; j += 1) s += binomialHalfPmf(n, j);
    return Math.min(1, Math.max(0, 1 - s));
  }
}

/** Exact upper-tail Pr(X >= k) for X ~ Binomial(n, 1/2). */
export function binomialHalfCdfUpper(n: number, k: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  return 1 - binomialHalfCdfLower(n, k - 1);
}

/**
 * Exact two-sided p for a Binomial(n, 1/2) test of H0:
 * p = 1/2, observed S+ = sPlus. Uses the symmetry of
 * the null around n/2: pTwoSided = Pr(X <= min) +
 * Pr(X >= max) where (min, max) are the two equidistant
 * points around n/2.
 */
export function binomialHalfTwoSidedP(n: number, sPlus: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`binomialHalfTwoSidedP: n must be a non-negative integer (got ${n})`);
  }
  if (n === 0) return 1;
  const mu = n / 2;
  const dev = Math.abs(sPlus - mu);
  const lo = Math.floor(mu - dev);
  const hi = Math.ceil(mu + dev);
  // Pr(X <= lo) + Pr(X >= hi). For integer n and integer
  // sPlus these are the symmetric tail endpoints; for
  // odd n this still correctly mirrors around n/2.
  const pLo = binomialHalfCdfLower(n, lo);
  const pHi = binomialHalfCdfUpper(n, hi);
  return Math.min(1, Math.max(0, pLo + pHi));
}

/**
 * Paired sign test on a contiguous-half split of the
 * input series. Returns S+, S-, expected S+, variance,
 * continuity-corrected normal-approx Z, EXACT binomial
 * p-values (two-sided / upper / lower), sign, and the
 * directional sign-balance effect-size delta.
 */
export function dailyTokenPairedSignTestHalves(values: number[]): {
  nPairs: number;
  nNonZero: number;
  nZeroDropped: number;
  sPlus: number;
  sMinus: number;
  expectedSPlus: number;
  varianceSPlus: number;
  z: number;
  pTwoSided: number;
  pUpper: number;
  pLower: number;
  piPlus: number;
  delta: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenPairedSignTestHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenPairedSignTestHalves requires finite values',
      );
    }
  }
  // Drop median day when n odd so halves have identical length.
  let trimmed: number[];
  if (n % 2 === 1) {
    const mid = (n - 1) >>> 1;
    trimmed = values.slice(0, mid).concat(values.slice(mid + 1));
  } else {
    trimmed = values.slice();
  }
  const half = trimmed.length / 2;
  const sampleA = trimmed.slice(0, half);
  const sampleB = trimmed.slice(half);
  let sPlus = 0;
  let sMinus = 0;
  let nZeroDropped = 0;
  for (let i = 0; i < half; i += 1) {
    const d = sampleB[i]! - sampleA[i]!;
    if (d > 0) sPlus += 1;
    else if (d < 0) sMinus += 1;
    else nZeroDropped += 1;
  }
  const nNonZero = sPlus + sMinus;
  if (nNonZero < 6) {
    throw new Error(
      `dailyTokenPairedSignTestHalves: need at least 6 non-zero differences (got ${nNonZero})`,
    );
  }
  const expectedSPlus = nNonZero / 2;
  const varianceSPlus = nNonZero / 4;
  const dev = sPlus - expectedSPlus;
  const cc = dev > 0 ? -0.5 : dev < 0 ? 0.5 : 0;
  const z = (dev + cc) / Math.sqrt(varianceSPlus);
  const pTwoSided = binomialHalfTwoSidedP(nNonZero, sPlus);
  const pUpper = binomialHalfCdfUpper(nNonZero, sPlus);
  const pLower = binomialHalfCdfLower(nNonZero, sPlus);
  const piPlus = sPlus / nNonZero;
  const delta = (sPlus - sMinus) / nNonZero;
  return {
    nPairs: half,
    nNonZero,
    nZeroDropped,
    sPlus,
    sMinus,
    expectedSPlus,
    varianceSPlus,
    z,
    pTwoSided,
    pUpper,
    pLower,
    piPlus,
    delta,
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

export function buildDailyTokenPairedSignTestHalves(
  queue: QueueLine[],
  opts: DailyTokenPairedSignTestHalvesOptions = {},
): DailyTokenPairedSignTestHalvesReport {
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
  const sort: DailyTokenPairedSignTestHalvesSort = opts.sort ?? 'absZDesc';
  const validSorts: DailyTokenPairedSignTestHalvesSort[] = [
    'sPlus',
    'absZDesc',
    'pTwoSided',
    'absDeltaDesc',
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
  const rows: DailyTokenPairedSignTestHalvesSourceRow[] = [];

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
      result = dailyTokenPairedSignTestHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const sign: -1 | 0 | 1 =
      result.sPlus > result.expectedSPlus
        ? 1
        : result.sPlus < result.expectedSPlus
          ? -1
          : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      pstNPairs: result.nPairs,
      pstNNonZero: result.nNonZero,
      pstNZeroDropped: result.nZeroDropped,
      pstSPlus: result.sPlus,
      pstSMinus: result.sMinus,
      pstExpectedSPlus: result.expectedSPlus,
      pstVarianceSPlus: result.varianceSPlus,
      pstZ: result.z,
      pstPTwoSided: result.pTwoSided,
      pstPUpper: result.pUpper,
      pstPLower: result.pLower,
      pstSign: sign,
      pstPiPlus: result.piPlus,
      pstDelta: result.delta,
      pstDecision: pairedSignTestDecision(result.pTwoSided),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'sPlus':
        primary = b.pstSPlus - a.pstSPlus;
        break;
      case 'absZDesc':
        primary = Math.abs(b.pstZ) - Math.abs(a.pstZ);
        break;
      case 'pTwoSided':
        primary = a.pstPTwoSided - b.pstPTwoSided;
        break;
      case 'absDeltaDesc':
        primary = Math.abs(b.pstDelta) - Math.abs(a.pstDelta);
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
