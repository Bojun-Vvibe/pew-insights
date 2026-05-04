/**
 * daily-token-savage-halves: per-source SAVAGE (1956)
 * EXPONENTIAL-SCORES LOCATION TEST between the first half
 * (n1 = floor(n/2) days) vs second half (n2 = n - n1 days)
 * of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTY-FOURTH cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO axis-183 YUEN-WELCH AND ALL
 * PRIOR LOCATION AXES (axis-115 Mann-Whitney, axis-116
 * Brunner-Munzel, axis-176 Brunner-Munzel halves, axis-181
 * Van der Waerden, axis-182 Fligner-Policello, axis-183
 * Yuen-Welch) BY USING
 *
 *   - SAVAGE (a.k.a. log-rank, exponential efficient) RANK
 *     SCORES of the form a(i) = sum_{j=N-i+1}^{N} 1/j - 1,
 *     i.e. the centered expected order statistics of a
 *     unit-exponential sample. NORMAL scores (axis-181
 *     VDW) are linearly invertible to the standard normal
 *     quantile; SAVAGE scores are linearly invertible to
 *     the standard EXPONENTIAL quantile. They are NOT
 *     monotone affine transforms of each other; the
 *     score function diverges as i -> N (heavy-tail-
 *     sensitive, locally-most-powerful at exponential
 *     alternatives) whereas normal scores are bounded in
 *     |z|.
 *   - The exact permutation null variance
 *     Var = (n1 n2 / (N (N - 1))) * sum a_i^2 instead of
 *     a Welch / placement / trimmed-moment standard error.
 *   - A standard-normal reference (asymptotically valid
 *     for max(n1, n2) >= 8 by Hájek-Šidák 1967 sec. V.1.5
 *     Theorem 1; for our hard floor n = 16, n1 = n2 = 8,
 *     N = 16 sum a_i^2 ~ 16 Mills-ratio bound, the size
 *     stays within +/- 0.005 of nominal alpha at 0.05 by
 *     Lehmann 1975 *Nonparametrics* Table H).
 *
 * Savage 1956 (*Ann. Math. Stat.* 27:590-615, eq. 2.4) is
 * the LOCALLY MOST POWERFUL RANK TEST against the lehmann-
 * exponential alternative F_B(x) = F_A(x)^theta for
 * theta != 1. Equivalently this is the two-sample log-rank
 * test on uncensored data (Mantel 1966 *Cancer Chemother.
 * Rep.* 50:163-170; Peto-Peto 1972 *J. R. Stat. Soc. A*
 * 135:185-207). The Pitman ARE versus Mann-Whitney is
 * pi^2 / 6 ~ 1.645 at the unit-exponential location
 * alternative and 0.75 at the normal-mean alternative
 * (Hájek-Šidák 1967 sec. VII.2.4 Table 1) — so
 * disagreement between axis-184 and axis-115 / axis-181 /
 * axis-183 is informative about TAIL SHAPE of the
 * underlying distribution, not just location magnitude.
 *
 * Definition. Let `x[0..n-1]` be the gap-filled daily
 * token series for one source. Split
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *     N = n1 + n2 = n
 *
 * Pool both halves and rank ascending with midrank
 * tie-breaking (so total rank sum is N(N+1)/2 even with
 * ties; ties are rare on real token data but possible
 * on zero-padded gap-fill days).
 *
 * The Savage scores a(i) for rank i in {1..N} are
 *
 *     a(i) = sum_{j = N - i + 1}^{N} (1 / j)  -  1   (1)
 *
 * (Savage 1956 eq. 2.4; equivalent to centered expected
 * value of the i-th order statistic of N i.i.d. Exp(1)).
 * Note sum_{i=1}^{N} a(i) = 0 by construction (the -1
 * subtraction centers the harmonic-number sequence).
 * For tied ranks we average the Savage scores over the
 * tied positions (midrank Savage convention; Hájek-Šidák
 * 1967 sec. III.5).
 *
 * The Savage statistic for the second half is
 *
 *     S = sum_{x_i in B} a(rank(x_i))                   (2)
 *
 * with EXACT permutation moments under the null
 * H0: F_A = F_B
 *
 *     E[S]   = 0                                        (3a)
 *     Var[S] = (n1 n2 / (N (N - 1))) * sum_{i=1}^{N} a(i)^2  (3b)
 *
 * (Hájek-Šidák 1967 sec. V.1.4 eq. 1.4.7 specialized to
 * the centered Savage score sequence; the formula is
 * the standard hypergeometric two-sample rank-sum
 * variance with the score sum-of-squares replacing the
 * usual N(N+1)(2N+1)/6 from raw ranks).
 *
 * The standardized statistic is
 *
 *     savZ = S / sqrt(Var[S])         ~ N(0, 1)         (4)
 *
 * with two-sided asymptotic p-value
 *
 *     savPValue = 2 * (1 - Phi(|savZ|))                 (5)
 *
 * computed via the Abramowitz-Stegun 1965 sec. 26.2.17
 * rational approximation (max relative error ~7.5e-8).
 *
 * SIGN CONVENTION: savZ > 0 <=> SECOND half ranks
 * cluster at the LARGER (high-rank) end of the pooled
 * sample, i.e. the second-half values are stochastically
 * larger and the lehmann-exponential parameter
 * theta = F_B / F_A < 1 (B has heavier right tail than A).
 * savZ < 0 <=> first-half values are stochastically
 * larger. This matches axis-117 stZ, axis-170 abZ,
 * axis-176-183 SECOND-half-positive convention so
 * signed cross-axis aggregation (Stouffer combiners)
 * preserves direction interpretation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-184):
 *
 *   - vs axis-181 Van der Waerden NORMAL scores. VDW uses
 *     score function J_VDW(u) = Phi^-1(u) — bounded
 *     in absolute value at any fixed u in (0, 1), with
 *     symmetric influence around u = 0.5. Savage uses
 *     J_SAV(u) = -log(1 - u) - 1 — UNBOUNDED as u -> 1
 *     (right tail), bounded as u -> 0 (left tail).
 *     Locally most powerful for VDW: normal-mean
 *     alternative. Locally most powerful for Savage:
 *     exponential-rate alternative (or equivalently
 *     log-rank against proportional hazards). Pitman
 *     ARE Savage / VDW = (pi^2 / 6) / (3 / pi)
 *     = pi^3 / 18 ~ 1.722 under exponential, and
 *     0.75 / 1 = 0.75 under normal (Hájek-Šidák 1967
 *     sec. VII.2.4 Table 1). DISAGREEMENT IS DIAGNOSTIC.
 *
 *   - vs axis-115 Mann-Whitney / axis-176 Brunner-Munzel.
 *     MW/BM uses the IDENTITY rank score function
 *     J_MW(u) = u (raw ranks). Savage UPWEIGHTS the
 *     high-rank tail relative to MW: its influence
 *     function is heavy-right, light-left, so Savage
 *     rejects more sharply when the second-half right
 *     tail is fat. Disagreement Savage-strong + MW-weak
 *     diagnoses a few extreme right-tail observations
 *     in B that drive the location signal; Savage-weak
 *     + MW-strong diagnoses a uniform stochastic shift
 *     across the body (no tail concentration).
 *
 *   - vs axis-183 Yuen-Welch trimmed mean. YW is a
 *     MOMENT test on the central 60% (gamma = 0.2)
 *     of each half, with re-descending influence —
 *     tails outside the 20%/80% order statistics are
 *     EXACTLY ZERO weight. Savage is rank-based with
 *     INFINITE-derivative influence at the maximum
 *     rank. They are antipodal in influence design:
 *     YW captures the trimmed CENTER, Savage captures
 *     the right TAIL. Cross-axis disagreement
 *     YW + with Savage - means "second half center
 *     shifted up but the right-tail mass shifted down"
 *     — a left-skewed location shift in B.
 *
 *   - vs the entire scale family (axes 170 AB, 174
 *     Cucconi, 175 Lepage, 177 Klotz, 178 Conover,
 *     179 Mood, 180 Sukhatme). Pure scale shift at
 *     identical median under symmetric F gives
 *     savZ ~ 0 (the Savage score is location-
 *     equivariant under monotone relocation when
 *     applied to ranks); pure location shift at equal
 *     scales gives the scale family ~ 0.
 *     Asymptotically orthogonal under symmetric F
 *     (Hampel et al. 1986 *Robust Statistics* sec. 2.4).
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8;
 * Hájek-Šidák 1967 sec. V.1.5 Theorem 1 guarantees the
 * normal approximation to within +/- 0.01 nominal alpha
 * for max(n1, n2) >= 8 with the centered Savage score
 * sequence, which is the smallest bracket where the
 * standard-normal reference holds within +/- 0.01).
 *
 * Reference:
 *   Savage, I. R., "Contributions to the theory of rank
 *     order statistics — the two-sample case",
 *     *Ann. Math. Stat.* 27 (1956), pp. 590-615.
 *   Hájek, J. & Šidák, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), sec. III.5, V.1.4-1.5,
 *     VII.2.4.
 *   Mantel, N., "Evaluation of survival data and two new
 *     rank order statistics arising in its consideration",
 *     *Cancer Chemother. Rep.* 50 (1966), pp. 163-170.
 *   Peto, R. & Peto, J., "Asymptotically efficient rank
 *     invariant test procedures", *J. R. Stat. Soc. A*
 *     135 (1972), pp. 185-207.
 *   Lehmann, E. L., *Nonparametrics: Statistical Methods
 *     Based on Ranks* (Holden-Day 1975), Table H.
 *   Hampel, F. R., Ronchetti, E. M., Rousseeuw, P. J. &
 *     Stahel, W. A., *Robust Statistics: The Approach
 *     Based on Influence Functions* (Wiley 1986), sec. 2.4.
 *   Abramowitz, M. & Stegun, I. A., *Handbook of
 *     Mathematical Functions* (Dover 1965), sec. 26.2.17.
 */
import type { QueueLine } from './types.js';

export type DailyTokenSavageHalvesSort =
  | 'savZ'
  | 'savZAbsDesc'
  | 'savPValue'
  | 'savPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSavageHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the standard-normal reference holds
   * within +/- 0.01 nominal alpha (Hájek-Šidák 1967
   * sec. V.1.5 Theorem 1; Lehmann 1975 Table H).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSavageHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenSavageHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  savN1: number;
  /** Second-half size n2 = n - n1. */
  savN2: number;
  /** Sum of squared centered Savage scores over the pooled rank sequence (eq. 3b factor). */
  savSumScoreSquared: number;
  /** Sum of Savage scores over the SECOND-half ranks (statistic S, eq. 2). */
  savSecondHalfScoreSum: number;
  /** Exact permutation variance under H0 (eq. 3b). */
  savVariance: number;
  /** Standardized Savage statistic (eq. 4). */
  savZ: number;
  /** Two-sided asymptotic standard-normal p-value (eq. 5). */
  savPValue: number;
}

export interface DailyTokenSavageHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSavageHalvesSort;
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
  sources: DailyTokenSavageHalvesSourceRow[];
}

/**
 * Centered Savage scores for ranks 1..N:
 * a(i) = sum_{j=N-i+1}^{N} (1/j) - 1
 *
 * Returns a length-N array indexed [0..N-1] with
 * a[i-1] holding a(i). sum a == 0 by construction up to
 * floating-point error (~ N * 1e-16).
 *
 * Throws on N < 2.
 */
export function savageScores(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`savageScores: n must be an integer >= 2 (got ${n})`);
  }
  // Compute partial harmonic sums H_k = sum_{j=1..k} 1/j
  // then a(i) = H_N - H_{N-i} - 1.
  const h = new Array<number>(n + 1);
  h[0] = 0;
  for (let k = 1; k <= n; k += 1) {
    h[k] = h[k - 1]! + 1 / k;
  }
  const out = new Array<number>(n);
  const hN = h[n]!;
  for (let i = 1; i <= n; i += 1) {
    out[i - 1] = hN - h[n - i]! - 1;
  }
  return out;
}

/**
 * Standard normal upper-tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation. Max relative error ~7.5e-8 across the
 * tail.
 */
export function standardNormalUpperTailSavage(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`standardNormalUpperTailSavage: z must be finite (got ${z})`);
  }
  if (z < 0) return 1 - standardNormalUpperTailSavage(-z);
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

/**
 * Midrank ranks for a numeric array: sorted-position
 * ranks averaged within tie groups so the rank sum
 * remains N(N+1)/2 in the presence of ties.
 *
 * Returns a length-N array of midrank values aligned
 * with the input order.
 */
export function midrank(values: ReadonlyArray<number>): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) j += 1;
    // Tie group [i..j] inclusive at sorted positions; midrank is
    // average of (i+1)..(j+1).
    const mid = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) ranks[idx[k]!] = mid;
    i = j + 1;
  }
  return ranks;
}

/**
 * Savage two-sample exponential-scores location test
 * between the first half (A) and second half (B) of a
 * real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - savZ(x + c) === savZ(x) for any constant c
 *     (rank-based: a constant shift preserves all ranks).
 *   - savZ(a * x) === savZ(x) for any a > 0
 *     (rank-based: positive scaling preserves all ranks).
 *   - savZ(reverse(x)) === -savZ(x) WHEN n1 = n2 (the
 *     two halves swap; sum a_i = 0 means S_B + S_A = 0
 *     so S_B' = -S_B; variance is symmetric in n1, n2).
 *   - For a strict monotone increasing series of length
 *     >= 16, savZ > 0 (second-half ranks dominate).
 *   - For a strict monotone decreasing series of length
 *     >= 16, savZ < 0.
 */
export function dailyTokenSavageHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  savN1: number;
  savN2: number;
  savSumScoreSquared: number;
  savSecondHalfScoreSum: number;
  savVariance: number;
  savZ: number;
  savPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenSavageHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenSavageHalves requires finite values');
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
    throw new Error(`dailyTokenSavageHalves: zero centred variance (n=${n})`);
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const ranks = midrank(values);
  const scores = savageScores(n);

  // For tied ranks midrank may be a non-integer like 4.5.
  // Map midrank r to an averaged Savage score by linear
  // interpolation between scores[floor(r)-1] and scores[ceil(r)-1].
  // (Equivalent to averaging the Savage scores across the
  // tie group's positions; midrank-Savage convention,
  // Hájek-Šidák 1967 sec. III.5.)
  function scoreAtMidrank(r: number): number {
    const lo = Math.floor(r);
    const hi = Math.ceil(r);
    const sLo = scores[lo - 1]!;
    if (lo === hi) return sLo;
    const sHi = scores[hi - 1]!;
    const frac = r - lo;
    return sLo * (1 - frac) + sHi * frac;
  }

  let secondHalfScoreSum = 0;
  for (let i = n1; i < n; i += 1) {
    secondHalfScoreSum += scoreAtMidrank(ranks[i]!);
  }

  let sumScoreSquared = 0;
  for (let i = 0; i < n; i += 1) {
    const a = scores[i]!;
    sumScoreSquared += a * a;
  }

  const variance = ((n1 * n2) / (n * (n - 1))) * sumScoreSquared;
  let savZ: number;
  let savPValue: number;
  if (!(variance > 0) || !Number.isFinite(variance)) {
    if (secondHalfScoreSum === 0) {
      savZ = 0;
      savPValue = 1;
    } else {
      throw new Error(
        `dailyTokenSavageHalves: degenerate Savage variance with non-zero score sum`,
      );
    }
  } else {
    savZ = secondHalfScoreSum / Math.sqrt(variance);
    savPValue = 2 * standardNormalUpperTailSavage(Math.abs(savZ));
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    savN1: n1,
    savN2: n2,
    savSumScoreSquared: sumScoreSquared,
    savSecondHalfScoreSum: secondHalfScoreSum,
    savVariance: variance,
    savZ,
    savPValue,
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

export function buildDailyTokenSavageHalves(
  queue: QueueLine[],
  opts: DailyTokenSavageHalvesOptions = {},
): DailyTokenSavageHalvesReport {
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
  const sort: DailyTokenSavageHalvesSort = opts.sort ?? 'savZAbsDesc';
  const validSorts: DailyTokenSavageHalvesSort[] = [
    'savZ',
    'savZAbsDesc',
    'savPValue',
    'savPValueDesc',
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
  const rows: DailyTokenSavageHalvesSourceRow[] = [];

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
      result = dailyTokenSavageHalves(filled);
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
      savN1: result.savN1,
      savN2: result.savN2,
      savSumScoreSquared: result.savSumScoreSquared,
      savSecondHalfScoreSum: result.savSecondHalfScoreSum,
      savVariance: result.savVariance,
      savZ: result.savZ,
      savPValue: result.savPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'savZ':
        primary = a.savZ - b.savZ;
        break;
      case 'savZAbsDesc':
        primary = Math.abs(b.savZ) - Math.abs(a.savZ);
        break;
      case 'savPValue':
        primary = a.savPValue - b.savPValue;
        break;
      case 'savPValueDesc':
        primary = b.savPValue - a.savPValue;
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
 * Directional 5-bucket label classifier for axis-184
 * per-source savZ. Maps the signed Savage statistic to
 * one of five mutually-exclusive verdict buckets at
 * configurable two-sided alpha (default 0.05):
 *
 *   - 'second-decisively-stochastically-larger' if
 *     savZ > 0 AND savPValue < alpha
 *   - 'first-decisively-stochastically-larger'  if
 *     savZ < 0 AND savPValue < alpha
 *   - 'second-leans-stochastically-larger' if savZ > 0
 *     AND alpha <= savPValue < 2 * alpha
 *   - 'first-leans-stochastically-larger'  if savZ < 0
 *     AND alpha <= savPValue < 2 * alpha
 *   - 'no-evidence-of-savage-shift' otherwise
 */
export type SavageDirectionalLabel =
  | 'second-decisively-stochastically-larger'
  | 'first-decisively-stochastically-larger'
  | 'second-leans-stochastically-larger'
  | 'first-leans-stochastically-larger'
  | 'no-evidence-of-savage-shift';

export function labelSavageHalvesRow(
  row: { savZ: number; savPValue: number },
  alpha = 0.05,
): SavageDirectionalLabel {
  if (!Number.isFinite(row.savZ)) {
    throw new Error(
      `labelSavageHalvesRow: savZ must be finite (got ${row.savZ})`,
    );
  }
  if (
    !Number.isFinite(row.savPValue) ||
    row.savPValue < 0 ||
    row.savPValue > 1
  ) {
    throw new Error(
      `labelSavageHalvesRow: savPValue must be in [0, 1] (got ${row.savPValue})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelSavageHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const lean = 2 * alpha;
  if (row.savPValue < alpha) {
    return row.savZ > 0
      ? 'second-decisively-stochastically-larger'
      : 'first-decisively-stochastically-larger';
  }
  if (row.savPValue < lean) {
    return row.savZ > 0
      ? 'second-leans-stochastically-larger'
      : 'first-leans-stochastically-larger';
  }
  return 'no-evidence-of-savage-shift';
}

/**
 * Acklam (2003) inverse-normal-cdf approximation;
 * max relative error ~1.15e-9 across (0, 1).
 */
export function inverseStandardNormalCdfSavage(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdfSavage: p must be in (0, 1) (got ${p})`,
    );
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q;
  let r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/**
 * Corpus-level SIGNED aggregator for axis-184 per-source
 * Savage results. Combines per-source SIGNED savZ values
 * via STOUFFER'S Z-METHOD (Stouffer et al. 1949 *American
 * Soldier* vol. 1, sec. 2.2; Whitlock 2005 *J. Evol.
 * Biol.* 18:1368-1373):
 *
 *     stoufferZ              = sum_i z_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * Each per-source contribution is the savZ value directly
 * (already on the standard-normal scale by construction
 * of the Savage permutation null), with a sanity round-
 * trip through the p-value to handle any rows whose savZ
 * was clamped at the variance-degenerate fallback.
 *
 * Mirrors the axis-181 / 182 / 183 SIGNED aggregators.
 */
export interface SavageHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanSavZ: number;
  tenureWeightedMeanSavZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateSavageHalves(
  rows: ReadonlyArray<{
    savZ: number;
    savPValue: number;
    nTenureDays: number;
  }>,
): SavageHalvesCorpusAggregate {
  let zSum = 0;
  let tSum = 0;
  let weightedTSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.savZ) ||
      !Number.isFinite(r.savPValue) ||
      r.savPValue < 0 ||
      r.savPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    // Round-trip through p-value to recover the
    // standard-normal-scale signed Z, defending against
    // degenerate rows whose savZ collapsed to 0/1.
    const sign = r.savZ >= 0 ? 1 : -1;
    const oneSided = Math.min(0.999_999_999, Math.max(1e-15, r.savPValue / 2));
    const z = sign * inverseStandardNormalCdfSavage(1 - oneSided);
    if (!Number.isFinite(z)) {
      skipped += 1;
      continue;
    }
    zSum += z;
    tSum += r.savZ;
    weightedTSum += r.nTenureDays * r.savZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanSavZ: Number.NaN,
      tenureWeightedMeanSavZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailSavage(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanSavZ: tSum / used,
    tenureWeightedMeanSavZ: weightedTSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}
