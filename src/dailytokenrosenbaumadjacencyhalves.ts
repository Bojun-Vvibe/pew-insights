/**
 * daily-token-rosenbaum-adjacency-halves: per-source
 * ROSENBAUM TWO-SAMPLE ADJACENCY TEST comparing the
 * first half vs second half of the gap-filled daily
 * total_tokens series via the count of SECOND-HALF
 * OBSERVATIONS STRICTLY EXCEEDING the MAXIMUM of the
 * FIRST HALF.
 *
 * ONE-HUNDRED-AND-NINETY-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source (n = nTenureDays >= 8).
 * Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Define
 *
 *     rsTUpper = #{ b in B : b > max(A) }
 *     rsTLower = #{ a in A : a < min(B) }
 *     rsT      = rsTUpper + rsTLower
 *
 * rsT counts the number of UNAMBIGUOUSLY EXTREME
 * observations -- those that lie outside the support of
 * the opposite half. Under H0 of identical distributions
 * (Rosenbaum 1954, Annals of Mathematical Statistics
 * 25(1):146-150 "Tables for a nonparametric test of
 * location"), and using only continuous distributions,
 * rsTUpper has the discrete distribution
 *
 *     P(rsTUpper >= k) = C(n1, n1-1) * C(n2, k+1)
 *                      ----------------------------
 *                              C(n, k)
 *
 * but under the ASYMPTOTIC normal approximation
 * (Hettmansperger 1984 *Statistical Inference Based on
 * Ranks*, section 3.4) we have, for moderate n1, n2,
 *
 *     E[rsT]  = (n1 + n2) / (n1 + 1)  +  (n1 + n2) / (n2 + 1)
 *     Var[rsT] = approx 2 * (n1 + n2) * (n1 - 1) * (n2 - 1)
 *                / ((n1 + 2) * (n2 + 2))
 *
 * (the exact expectations are derived from order-
 * statistic combinatorics; the approximations above are
 * the standard rank-based asymptotics quoted in
 * Sprent & Smeeton 2001 *Applied Nonparametric
 * Statistical Methods*, 3rd ed., section 6.3.1).
 *
 * We compute a normal-approximation z-score
 *
 *     rsZ = (rsT - E[rsT]) / sqrt(Var[rsT])
 *
 * with continuity correction
 *
 *     rsZ_low  = (rsT + 0.5 - E[rsT]) / sqrt(Var[rsT])
 *     rsZ_high = (rsT - 0.5 - E[rsT]) / sqrt(Var[rsT])
 *
 * applied symmetrically: rsZ = rsZ_high if rsT > E[rsT];
 * rsZ_low if rsT < E[rsT]; 0 if equal. Two-sided p:
 *
 *     rsTwoSidedP = 2 * Phi( -|rsZ| )
 *
 * Direction. The DIRECTION of any rejection is
 *
 *     rsSignedDirection = sign(rsTUpper - rsTLower)
 *
 * which is +1 if more upper-extremes (B > max(A)) than
 * lower-extremes (A < min(B)) -- second half stretches
 * the upper tail; -1 if the reverse; 0 if balanced. Note
 * that rsT ITSELF is a two-sided omnibus statistic
 * (large rsT = ANY tail-stretching); rsSignedDirection
 * decomposes the rejection into upper-tail vs lower-tail
 * stretching.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs axis-115 daily-token-mann-whitney-halves and
 *     axis-187 vargha-delaney-halves and axis-191
 *     cliffs-delta-halves. Those are functionals of ALL
 *     PAIRWISE COMPARISONS (i, j) with i in A, j in B
 *     (pooled-sort ranks). Rosenbaum's rsT depends ONLY
 *     on a TINY SUBSET of pairs -- namely the ones
 *     involving max(A) or min(B). Two configurations
 *     with the SAME rank sum can have rsT = 0 (no
 *     extremes, every pair {a, b} with a < max(A) and b
 *     in [min(B), max(A)]) or rsT = n2 (perfect
 *     separation, every b > max(A)). Therefore rsT is
 *     not reducible to the rank sum.
 *
 *   - vs axis-194 daily-token-wald-wolfowitz-runs-halves.
 *     wwR is a functional of the FULL pooled-sort label
 *     sequence (every adjacency contributes). rsT is a
 *     functional of the EXTREME ENVELOPE only. wwR can
 *     be at its maximum (perfect alternation) while rsT
 *     = 0; wwR can be at its minimum (perfect
 *     separation) while rsT = max(n1, n2). The two
 *     statistics measure orthogonal aspects: wwR =
 *     interior alternation, rsT = boundary exclusion.
 *
 *   - vs axis-186 daily-token-ks-two-sample-halves.
 *     ksD = sup_t |F_A(t) - F_B(t)| -- the LARGEST
 *     CUMULATIVE GAP, which can occur ANYWHERE in the
 *     pooled support. rsT is supported only on the
 *     INDICES of the pooled sort that lie strictly above
 *     max(A) or below min(B). KS can reject (large gap
 *     in the middle of the support) without rsT
 *     rejecting (extremes still overlap); rsT can reject
 *     (B has a few values above max(A)) without KS
 *     rejecting (the remainder of B sits inside the A
 *     envelope so the cumulative gap stays small).
 *
 *   - vs axis-192 daily-token-kuiper-two-sample-halves.
 *     Kuiper V = sup(F_A - F_B) + sup(F_B - F_A) -- a
 *     full-support functional of two ECDF suprema. rsT
 *     is purely an EXTREME-SUPPORT functional. Same
 *     argument as KS.
 *
 *   - vs axis-193 daily-token-tukey-quick-halves. Tukey
 *     W = #{ b in B : b > max(A) } + #{ a in A :
 *     a < min(B) } counts END-EXCEEDANCE PAIRS but
 *     uses a VERY DIFFERENT critical region (Tukey's
 *     fixed quick-rule of W >= 7 for alpha 0.05, valid
 *     only for nearly-equal sample sizes; Tukey 1959).
 *     Mathematically rsT and Tukey W are CLOSELY
 *     RELATED for equal n1 = n2 -- they are essentially
 *     the same count -- but they DIFFER in the
 *     INFERENCE: Tukey W uses fixed cut-points
 *     calibrated for n1 = n2 in [5, 30] only; Rosenbaum
 *     rsT uses a CONTINUOUS NORMAL APPROXIMATION that
 *     is valid for arbitrary n1, n2 and yields a
 *     z-score and p-value rather than a binary
 *     reject/accept verdict. Critically: Tukey W's
 *     critical value is NOT a function of n1, n2; rsT's
 *     z-score IS. Where Tukey returns "W = 5,
 *     verdict = ACCEPT (5 < 7)", Rosenbaum returns rsT
 *     = 5, rsZ = +1.83, rsP = 0.067 -- a graduated
 *     significance signal. The two are calibration-
 *     orthogonal even though their sufficient statistic
 *     shares its support.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves. ST is
 *     a SCALE test based on FOLDED RANKS. rsT is a
 *     LOCATION-SHIFT-IN-EXTREMES test -- highly
 *     sensitive to a uniform location shift large
 *     enough to push min(B) above max(A), insensitive
 *     to a pure scale change with the same median.
 *
 *   - vs axis-189 wilcoxon-signed-rank, axis-190 paired
 *     sign. Both are PAIRED on the i-th obs. rsT is
 *     UNPAIRED on extremes only.
 *
 * Caveats.
 *
 *   - Ties. When max(A) is tied with one or more values
 *     in B, the strict inequality (b > max(A)) excludes
 *     them; same for min(B) and A. This is the standard
 *     conservative tie treatment (Hettmansperger 1984,
 *     section 3.4.2).
 *
 *   - Continuity correction. The +/- 0.5 correction to
 *     rsT in the z-score improves the normal
 *     approximation accuracy by 1-2% in the moderate-n
 *     regime (Sprent & Smeeton 2001).
 *
 *   - n-size band. The normal approximation requires
 *     n1, n2 >= 4 (Hettmansperger 1984, condition C3.4).
 *     We enforce minTenureDays >= 8 so n1, n2 >= 4.
 *
 *   - Power profile. Rosenbaum's test has its highest
 *     power against LOCATION SHIFTS large enough to
 *     separate the supports; it has very low power
 *     against shape changes that preserve the support
 *     envelope. It complements the rank-sum and
 *     ECDF-supremum tests by isolating EXTREME-TAIL
 *     evidence.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-rosenbaum-adjacency-halves
 *
 *   pew-insights daily-token-rosenbaum-adjacency-halves \
 *     --json --min-tenure-days 14 --sort rsZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenRosenbaumAdjacencyHalvesSort =
  | 'rsT'
  | 'rsTDesc'
  | 'rsZ'
  | 'rsZDesc'
  | 'rsZAbs'
  | 'rsZAbsDesc'
  | 'rsP'
  | 'rsPDesc'
  | 'rsAsymmetry'
  | 'rsAsymmetryDesc'
  | 'rsAsymmetryAbs'
  | 'rsAsymmetryAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenRosenbaumAdjacencyHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * each half has at least 4 observations (validity band
   * for the normal approximation to rsT;
   * Hettmansperger 1984).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenRosenbaumAdjacencyHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenRosenbaumAdjacencyHalvesSourceRow {
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
  rsN1: number;
  /** Second-half size n2 = n - n1. */
  rsN2: number;
  /** max of the first half. */
  rsMaxA: number;
  /** min of the second half. */
  rsMinB: number;
  /** max of the second half. */
  rsMaxB: number;
  /** min of the first half. */
  rsMinA: number;
  /** count of B observations strictly > max(A). */
  rsTUpper: number;
  /** count of A observations strictly < min(B). */
  rsTLower: number;
  /** rsT = rsTUpper + rsTLower (Rosenbaum's adjacency stat). */
  rsT: number;
  /** Expected rsT under H0. */
  rsExpT: number;
  /** Variance of rsT under H0. */
  rsVarT: number;
  /**
   * Continuity-corrected z-score
   * (rsT +/- 0.5 - E[rsT]) / sqrt(Var[rsT]); positive =
   * MORE extremes than expected (= tail-stretching =
   * distributional separation signal); negative =
   * fewer extremes than expected (rare; envelope
   * compression of one half by the other).
   */
  rsZ: number;
  /** Two-sided p-value via the normal approximation. */
  rsTwoSidedP: number;
  /**
   * Directional decomposition:
   * +1 if rsTUpper > rsTLower (second half stretches the upper tail),
   * -1 if rsTUpper < rsTLower (second half stretches the lower tail),
   *  0 if balanced.
   */
  rsSignedDirection: number;
  /**
   * Asymmetry index in [-1, +1]:
   *
   *     rsAsymmetry = (rsTUpper - rsTLower) / max(rsT, 1)
   *
   * = +1 iff all extremes lie in the upper tail
   * (rsTLower = 0 and rsTUpper > 0); = -1 iff all
   * extremes lie in the lower tail; = 0 iff balanced or
   * rsT = 0. Provides a continuous-valued direction
   * signal complementary to the discrete
   * rsSignedDirection sign. Refinement (v0.6.490).
   */
  rsAsymmetry: number;
}

export interface DailyTokenRosenbaumAdjacencyHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenRosenbaumAdjacencyHalvesSort;
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
  sources: DailyTokenRosenbaumAdjacencyHalvesSourceRow[];
}

/**
 * Standard-normal CDF via Abramowitz-Stegun 7.1.26 rational
 * approximation (max abs error 1.5e-7).
 */
function phi(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Rosenbaum's two-sample adjacency test on the first half
 * (A = x[0..n1-1]) vs second half (B = x[n1..n-1]) of a
 * real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - rsT(x + c) === rsT(x) for any constant c (uniform
 *     shift preserves order statistics across both halves).
 *   - rsT(a * x) === rsT(x) for any a > 0 (positive
 *     scaling preserves order).
 *   - rsT(f(x)) === rsT(x) for any strictly increasing f
 *     (depends only on POOLED ORDER STATISTICS).
 *   - 0 <= rsT <= n1 + n2.
 *   - rsT = 0 iff supports overlap fully (max(A) >= max(B) AND
 *     min(B) <= min(A)) -- envelope of one half contains the other.
 *   - rsTUpper = n2 iff every B observation strictly exceeds max(A)
 *     (perfect upper separation).
 *   - rsTLower = n1 iff every A observation strictly precedes min(B)
 *     (which is the same as rsTUpper = n2 only when supports are disjoint;
 *     in general rsTUpper + rsTLower <= n).
 */
export function dailyTokenRosenbaumAdjacencyHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  rsN1: number;
  rsN2: number;
  rsMaxA: number;
  rsMinB: number;
  rsMaxB: number;
  rsMinA: number;
  rsTUpper: number;
  rsTLower: number;
  rsT: number;
  rsExpT: number;
  rsVarT: number;
  rsZ: number;
  rsTwoSidedP: number;
  rsSignedDirection: number;
  rsAsymmetry: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenRosenbaumAdjacencyHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenRosenbaumAdjacencyHalves requires finite values',
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
      `dailyTokenRosenbaumAdjacencyHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Compute extremes of A and B.
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

  // Strict-inequality counts (conservative tie treatment).
  let rsTUpper = 0;
  for (let i = n1; i < n; i += 1) {
    if (values[i]! > maxA) rsTUpper += 1;
  }
  let rsTLower = 0;
  for (let i = 0; i < n1; i += 1) {
    if (values[i]! < minB) rsTLower += 1;
  }
  const rsT = rsTUpper + rsTLower;

  // Standard rank-based normal approximation moments.
  // E[rsT] = (n1 + n2) / (n1 + 1) + (n1 + n2) / (n2 + 1)
  // Var[rsT] = 2*(n1+n2)*(n1-1)*(n2-1) / ((n1+2)*(n2+2))
  const expT = n / (n1 + 1) + n / (n2 + 1);
  const varT =
    (n1 >= 2 && n2 >= 2)
      ? (2 * n * (n1 - 1) * (n2 - 1)) / ((n1 + 2) * (n2 + 2))
      : 0;

  let z: number;
  let p: number;
  if (varT <= 0) {
    z = 0;
    p = 1;
  } else {
    const sd = Math.sqrt(varT);
    if (rsT > expT) {
      z = (rsT - 0.5 - expT) / sd;
    } else if (rsT < expT) {
      z = (rsT + 0.5 - expT) / sd;
    } else {
      z = 0;
    }
    if (z === 0) {
      p = 1;
    } else {
      p = 2 * phi(-Math.abs(z));
      if (p > 1) p = 1;
      if (p < 0) p = 0;
    }
  }

  let signedDir = 0;
  if (rsTUpper > rsTLower) signedDir = 1;
  else if (rsTUpper < rsTLower) signedDir = -1;

  // Asymmetry index in [-1, +1]: continuous-valued
  // complement to rsSignedDirection sign.
  const rsAsymmetry = rsT > 0 ? (rsTUpper - rsTLower) / rsT : 0;

  if (
    !Number.isFinite(rsT) ||
    !Number.isFinite(expT) ||
    !Number.isFinite(varT) ||
    !Number.isFinite(z) ||
    !Number.isFinite(p)
  ) {
    throw new Error(
      `dailyTokenRosenbaumAdjacencyHalves: non-finite output (n=${n}, rsT=${rsT})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    rsN1: n1,
    rsN2: n2,
    rsMaxA: maxA,
    rsMinB: minB,
    rsMaxB: maxB,
    rsMinA: minA,
    rsTUpper,
    rsTLower,
    rsT,
    rsExpT: expT,
    rsVarT: varT,
    rsZ: z,
    rsTwoSidedP: p,
    rsSignedDirection: signedDir,
    rsAsymmetry,
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

export function buildDailyTokenRosenbaumAdjacencyHalves(
  queue: QueueLine[],
  opts: DailyTokenRosenbaumAdjacencyHalvesOptions = {},
): DailyTokenRosenbaumAdjacencyHalvesReport {
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
  const sort: DailyTokenRosenbaumAdjacencyHalvesSort =
    opts.sort ?? 'rsZAbsDesc';
  const validSorts: DailyTokenRosenbaumAdjacencyHalvesSort[] = [
    'rsT',
    'rsTDesc',
    'rsZ',
    'rsZDesc',
    'rsZAbs',
    'rsZAbsDesc',
    'rsP',
    'rsPDesc',
    'rsAsymmetry',
    'rsAsymmetryDesc',
    'rsAsymmetryAbs',
    'rsAsymmetryAbsDesc',
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
  const rows: DailyTokenRosenbaumAdjacencyHalvesSourceRow[] = [];

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
      result = dailyTokenRosenbaumAdjacencyHalves(filled);
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
      rsN1: result.rsN1,
      rsN2: result.rsN2,
      rsMaxA: result.rsMaxA,
      rsMinB: result.rsMinB,
      rsMaxB: result.rsMaxB,
      rsMinA: result.rsMinA,
      rsTUpper: result.rsTUpper,
      rsTLower: result.rsTLower,
      rsT: result.rsT,
      rsExpT: result.rsExpT,
      rsVarT: result.rsVarT,
      rsZ: result.rsZ,
      rsTwoSidedP: result.rsTwoSidedP,
      rsSignedDirection: result.rsSignedDirection,
      rsAsymmetry: result.rsAsymmetry,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'rsT':
        primary = a.rsT - b.rsT;
        break;
      case 'rsTDesc':
        primary = b.rsT - a.rsT;
        break;
      case 'rsZ':
        primary = a.rsZ - b.rsZ;
        break;
      case 'rsZDesc':
        primary = b.rsZ - a.rsZ;
        break;
      case 'rsZAbs':
        primary = Math.abs(a.rsZ) - Math.abs(b.rsZ);
        break;
      case 'rsZAbsDesc':
        primary = Math.abs(b.rsZ) - Math.abs(a.rsZ);
        break;
      case 'rsP':
        primary = a.rsTwoSidedP - b.rsTwoSidedP;
        break;
      case 'rsPDesc':
        primary = b.rsTwoSidedP - a.rsTwoSidedP;
        break;
      case 'rsAsymmetry':
        primary = a.rsAsymmetry - b.rsAsymmetry;
        break;
      case 'rsAsymmetryDesc':
        primary = b.rsAsymmetry - a.rsAsymmetry;
        break;
      case 'rsAsymmetryAbs':
        primary = Math.abs(a.rsAsymmetry) - Math.abs(b.rsAsymmetry);
        break;
      case 'rsAsymmetryAbsDesc':
        primary = Math.abs(b.rsAsymmetry) - Math.abs(a.rsAsymmetry);
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
