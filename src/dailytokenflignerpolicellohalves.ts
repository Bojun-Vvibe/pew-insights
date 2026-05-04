/**
 * daily-token-fligner-policello-halves: per-source
 * FLIGNER-POLICELLO (1981) ROBUST RANK LOCATION TEST
 * for the BEHRENS-FISHER NONPARAMETRIC NULL
 * H0: P(X < Y) + 0.5 P(X = Y) = 0.5 between the first
 * half (n1 = floor(n/2) days) vs second half
 * (n2 = n - n1 days) of the gap-filled daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-EIGHTY-SECOND cross-source axis.
 *
 * STRUCTURALLY ORTHOGONAL TO axis-181 VAN DER WAERDEN
 * normal-scores location test AND to axis-115 / axis-116
 * Mann-Whitney / Brunner-Munzel: Fligner-Policello does
 * NOT assume EQUAL SCALE between the two halves. Both
 * Wilcoxon-Mann-Whitney and Van der Waerden require
 * F_A and F_B to differ ONLY in location for the test
 * to be calibrated as a pure location test (under
 * unequal scale they conflate location and scale and
 * lose nominal alpha). Brunner-Munzel relaxes the equal-
 * scale assumption only ASYMPTOTICALLY via a Welch-style
 * df adjustment on a t-reference. Fligner-Policello
 * relaxes it EXACTLY at the null-variance level by
 * estimating the asymptotic null variance separately
 * from each sample's "placement" counts, giving a
 * standardised statistic that is N(0,1) under the
 * Behrens-Fisher null without ANY assumption about the
 * spread of the two halves (Fligner & Policello 1981
 * *JASA* 76:162-168 Thm. 3). This is the cleanest
 * orthogonality move available without re-treading
 * existing axes: a third location channel that explicitly
 * decouples from the entire scale family (axes 170 AB,
 * 174 Cucconi, 175 Lepage, 177 Klotz, 178 Conover, 179
 * Mood, 180 Sukhatme).
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure. Split
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Define the PLACEMENTS
 *
 *     P_i = #{ j : B[j] <  A[i] } + 0.5 #{ j : B[j] = A[i] }
 *     Q_j = #{ i : A[i] <  B[j] } + 0.5 #{ i : A[i] = B[j] }
 *
 * with mid-tie correction (Fligner-Policello 1981 eq. 2.2).
 * Their means
 *
 *     Pbar = (1/n1) sum_i P_i
 *     Qbar = (1/n2) sum_j Q_j
 *
 * satisfy n1 * Pbar = n2 * Qbar = U (the Mann-Whitney
 * U-statistic of A vs B). The CENTRED SUMS OF SQUARES
 *
 *     V1 = sum_i (P_i - Pbar)^2
 *     V2 = sum_j (Q_j - Qbar)^2
 *
 * give the standardised statistic (FP 1981 eq. 2.3):
 *
 *     fpZ = ( sum Q_j - sum P_i ) /
 *           ( 2 sqrt( V1 + V2 + Pbar Qbar ) )       (1)
 *
 * Under the BEHRENS-FISHER NULL theta = P(X<Y) +
 * 0.5 P(X=Y) = 0.5 (Fligner & Policello 1981 Thm. 3),
 * fpZ -> N(0, 1) as min(n1, n2) -> infty REGARDLESS of
 * the relationship between the spreads of F_A and F_B.
 * Two-sided p-value
 *
 *     fpPValue = 2 * ( 1 - Phi(|fpZ|) )            (2)
 *
 * SIGN CONVENTION: fpZ > 0 <=> SECOND half stochastically
 * larger (B observations tend to exceed A; sum Q_j > sum
 * P_i). fpZ < 0 <=> FIRST half stochastically larger.
 * Matches axis-117 stZ, axis-170 abZ, axis-177 klotzZ,
 * axis-178 conoverZ, axis-179 moodZ, axis-180 sukhatmeZ,
 * axis-181 vdwZ SECOND-half-positive convention so signed
 * cross-axis aggregation (Stouffer combiners) preserves
 * direction interpretation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-182):
 *
 *   - vs axis-181 Van der Waerden. VDW requires
 *     EQUAL SCALE for the asymptotic null reference to
 *     hold; FP makes no such assumption. Under H0
 *     (equal location AND equal scale, F_A = F_B
 *     continuous) both have the same calibration but
 *     under unequal scale with equal location, VDW
 *     can reject (size > alpha) while FP holds nominal
 *     alpha (Pratt 1964 *JASA* 59:655-680; Fligner-
 *     Policello 1981 Sec. 4 simulation tables 1-3).
 *     This means the two location axes DISAGREE
 *     informatively in the unequal-spread regime —
 *     a compound diagnostic that neither alone provides.
 *
 *   - vs axis-115 / axis-116 Mann-Whitney /
 *     Brunner-Munzel halves. MW requires equal scale
 *     for pure location interpretation (otherwise it
 *     is a stochastic-ordering test); BM corrects with
 *     a t reference and Welch df. FP corrects at the
 *     null-variance level via the placement variances
 *     V1 + V2, giving exact asymptotic N(0,1)
 *     calibration without df estimation. Pitman ARE
 *     FP/MW = 1 under equal-scale alternatives;
 *     FP/BM ~ 1 under heteroscedastic alternatives
 *     (Fligner & Policello 1981 Sec. 5).
 *
 *   - vs the entire scale family (axes 170, 174, 175,
 *     177, 178, 179, 180). Pure scale shift with equal
 *     medians gives fpZ ~ 0 under symmetric F (the
 *     placements are symmetric around their means);
 *     pure location shift with equal scales gives the
 *     scale family ~ 0. Asymptotically orthogonal
 *     under symmetric F (Hajek-Sidak 1967 Lemma III.4.1,
 *     Fligner-Policello 1981 Thm. 3 corollary).
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Fligner & Policello 1981 Table 1: actual size
 * 0.041-0.058 across n1 = n2 in [8, 50] under Lehmann,
 * normal, double-exponential, and chi-squared(1) F).
 *
 * Reference:
 *   Fligner, M. A. & Policello, G. E., "Robust rank
 *     procedures for the Behrens-Fisher problem",
 *     *Journal of the American Statistical Association*
 *     76 (1981), pp. 162-168.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods* 3rd ed.
 *     (Wiley 2014), sec. 4.4.
 *   Pratt, J. W., "Robustness of some procedures for
 *     the two-sample location problem", *JASA* 59
 *     (1964), pp. 655-680.
 */
import type { QueueLine } from './types.js';

export type DailyTokenFlignerPolicelloHalvesSort =
  | 'fpZ'
  | 'fpZAbsDesc'
  | 'fpPValue'
  | 'fpPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenFlignerPolicelloHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Fligner-Policello 1981 Table 1).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenFlignerPolicelloHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenFlignerPolicelloHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  fpN1: number;
  /** Second-half size n2 = n - n1. */
  fpN2: number;
  /** Sum of A's placements sum_i P_i. */
  fpSumP: number;
  /** Sum of B's placements sum_j Q_j. */
  fpSumQ: number;
  /** Centred sum-of-squares of A's placements. */
  fpV1: number;
  /** Centred sum-of-squares of B's placements. */
  fpV2: number;
  /** Standardised FP Z ~ N(0, 1) under Behrens-Fisher H0. */
  fpZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|fpZ|)). */
  fpPValue: number;
}

export interface DailyTokenFlignerPolicelloHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenFlignerPolicelloHalvesSort;
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
  sources: DailyTokenFlignerPolicelloHalvesSourceRow[];
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailFp(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailFp: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailFp(-z);
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
 * Compute the Fligner-Policello placements P_i and Q_j
 * with mid-tie correction (FP 1981 eq. 2.2):
 *
 *   P_i = #{ j : B[j] <  A[i] } + 0.5 #{ j : B[j] = A[i] }
 *   Q_j = #{ i : A[i] <  B[j] } + 0.5 #{ i : A[i] = B[j] }
 *
 * Naive O(n1 * n2) implementation; fine for the
 * tenure sizes we encounter (typically a few hundred
 * days, < 1e5 ops total).
 */
export function flignerPolicelloPlacements(
  a: number[],
  b: number[],
): { P: number[]; Q: number[] } {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) {
    throw new Error('flignerPolicelloPlacements: both samples must be non-empty');
  }
  for (const v of a) {
    if (!Number.isFinite(v)) {
      throw new Error('flignerPolicelloPlacements: non-finite in A');
    }
  }
  for (const v of b) {
    if (!Number.isFinite(v)) {
      throw new Error('flignerPolicelloPlacements: non-finite in B');
    }
  }
  const P = new Array<number>(n1).fill(0);
  const Q = new Array<number>(n2).fill(0);
  for (let i = 0; i < n1; i += 1) {
    let lt = 0;
    let eq = 0;
    const ai = a[i]!;
    for (let j = 0; j < n2; j += 1) {
      const bj = b[j]!;
      if (bj < ai) lt += 1;
      else if (bj === ai) eq += 1;
    }
    P[i] = lt + 0.5 * eq;
  }
  for (let j = 0; j < n2; j += 1) {
    let lt = 0;
    let eq = 0;
    const bj = b[j]!;
    for (let i = 0; i < n1; i += 1) {
      const ai = a[i]!;
      if (ai < bj) lt += 1;
      else if (ai === bj) eq += 1;
    }
    Q[j] = lt + 0.5 * eq;
  }
  return { P, Q };
}

/**
 * Fligner-Policello (1981) ROBUST RANK location test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - fpZ(x + c) === fpZ(x) for any constant c
 *     (a constant shift preserves all pairwise
 *     comparisons, so all placements are unchanged).
 *   - fpZ(a * x) === fpZ(x) for any a > 0
 *     (positive scale preserves order so placements
 *     are unchanged).
 *   - fpZ(reverse(x)) === -fpZ(x) WHEN n1 = n2 (P and Q
 *     swap roles, sum P + sum Q = n1 * n2 is invariant
 *     so sum Q - sum P flips sign; V1 and V2 swap so
 *     V1 + V2 + Pbar Qbar is invariant).
 *   - For x = repeat(constant) all placements equal
 *     n2 / 2 and n1 / 2 respectively, V1 = V2 = 0,
 *     Pbar Qbar = n1 n2 / 4 > 0, so fpZ = 0 / sqrt(...)
 *     = 0 — but we throw on zero centred VARIANCE of
 *     the input series (degenerate input) before
 *     reaching that branch.
 */
export function dailyTokenFlignerPolicelloHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  fpN1: number;
  fpN2: number;
  fpSumP: number;
  fpSumQ: number;
  fpV1: number;
  fpV2: number;
  fpZ: number;
  fpPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenFlignerPolicelloHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenFlignerPolicelloHalves requires finite values',
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
      `dailyTokenFlignerPolicelloHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const a = values.slice(0, n1);
  const b = values.slice(n1);

  const { P, Q } = flignerPolicelloPlacements(a, b);
  let sumP = 0;
  for (const v of P) sumP += v;
  let sumQ = 0;
  for (const v of Q) sumQ += v;
  const Pbar = sumP / n1;
  const Qbar = sumQ / n2;
  let v1 = 0;
  for (const v of P) {
    const c = v - Pbar;
    v1 += c * c;
  }
  let v2 = 0;
  for (const v of Q) {
    const c = v - Qbar;
    v2 += c * c;
  }
  const denomInner = v1 + v2 + Pbar * Qbar;
  let fpZ: number;
  if (denomInner > 0 && Number.isFinite(denomInner)) {
    fpZ = (sumQ - sumP) / (2 * Math.sqrt(denomInner));
  } else {
    // Degenerate FP variance (perfect separation between halves).
    // Fall back to the Mann-Whitney null reference: under H0 the
    // U-statistic U = sumQ has E[U] = n1 n2 / 2 and
    // Var[U] = n1 n2 (n1 + n2 + 1) / 12. This preserves a sensible
    // signed standardised statistic at the boundary where the FP
    // placement variance vanishes.
    const mwVar = (n1 * n2 * (n1 + n2 + 1)) / 12;
    if (!(mwVar > 0) || !Number.isFinite(mwVar)) {
      throw new Error(
        `dailyTokenFlignerPolicelloHalves: degenerate FP and MW variances (denomInner=${denomInner}, mwVar=${mwVar})`,
      );
    }
    fpZ = (sumQ - (n1 * n2) / 2) / Math.sqrt(mwVar);
  }
  const fpPValue = 2 * standardNormalUpperTailFp(Math.abs(fpZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    fpN1: n1,
    fpN2: n2,
    fpSumP: sumP,
    fpSumQ: sumQ,
    fpV1: v1,
    fpV2: v2,
    fpZ,
    fpPValue,
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

export function buildDailyTokenFlignerPolicelloHalves(
  queue: QueueLine[],
  opts: DailyTokenFlignerPolicelloHalvesOptions = {},
): DailyTokenFlignerPolicelloHalvesReport {
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
  const sort: DailyTokenFlignerPolicelloHalvesSort = opts.sort ?? 'fpZAbsDesc';
  const validSorts: DailyTokenFlignerPolicelloHalvesSort[] = [
    'fpZ',
    'fpZAbsDesc',
    'fpPValue',
    'fpPValueDesc',
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
  const rows: DailyTokenFlignerPolicelloHalvesSourceRow[] = [];

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
      result = dailyTokenFlignerPolicelloHalves(filled);
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
      fpN1: result.fpN1,
      fpN2: result.fpN2,
      fpSumP: result.fpSumP,
      fpSumQ: result.fpSumQ,
      fpV1: result.fpV1,
      fpV2: result.fpV2,
      fpZ: result.fpZ,
      fpPValue: result.fpPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'fpZ':
        primary = a.fpZ - b.fpZ;
        break;
      case 'fpZAbsDesc':
        primary = Math.abs(b.fpZ) - Math.abs(a.fpZ);
        break;
      case 'fpPValue':
        primary = a.fpPValue - b.fpPValue;
        break;
      case 'fpPValueDesc':
        primary = b.fpPValue - a.fpPValue;
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
