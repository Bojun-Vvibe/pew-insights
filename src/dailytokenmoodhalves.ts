/**
 * daily-token-mood-halves: per-source MOOD (1954)
 * SQUARED-CENTERED-RANKS SCALE TEST for equality of
 * dispersion between the first half (n1 = floor(n/2)
 * days) vs second half (n2 = n - n1 days) of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Mood (1954, *Ann. Math. Statist.* 25:514-522, eq. 4)
 * proposed the SQUARED-CENTERED-RANKS scale statistic.
 * Pool the n values, assign mid-ranks R_1, ..., R_n
 * (1..n; ties get average rank), and form the second-
 * sample squared-deviation-from-rank-midpoint sum
 *
 *     W = sum_{j in B} ( R_j - (n + 1) / 2 )^2
 *
 * Under H0 of equal dispersion the EXACT null moments
 * (Mood 1954 Theorem 1) are
 *
 *     E[W]   = n2 * (n^2 - 1) / 12
 *     Var[W] = n1 * n2 * (n + 1) * (n^2 - 4) / 180
 *
 * giving the asymptotic standardised statistic
 *
 *     moodZ = ( W - E[W] ) / sqrt(Var[W])  ~ N(0, 1)
 *
 * Two-sided p-value
 *
 *     moodPValue = 2 * ( 1 - Phi(|moodZ|) )
 *
 * SIGN CONVENTION: moodZ > 0 <=> SECOND half has LARGER
 * dispersion (its observations land further from the
 * pooled rank midpoint, accumulating more squared
 * centered-rank weight); moodZ < 0 <=> FIRST half has
 * larger dispersion. Matches axis-117 stZ, axis-170
 * abZ, axis-177 klotzZ, axis-178 conoverZ directional
 * convention for direct cross-axis aggregation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-178 daily-token-conover-squared-ranks-halves
 *     (Conover & Iman 1978). Conover squares ASCENDING
 *     ranks on |X - median| (within-half median fold,
 *     ABSOLUTE-DEVIATION space). Mood squares CENTERED
 *     ranks on RAW pooled values (no median fold), with
 *     the centring constant being the rank midpoint
 *     (n+1)/2 NOT zero. Conover's scoring is R^2 in
 *     [1, n^2]; Mood's is (R - (n+1)/2)^2 in [0,
 *     ((n-1)/2)^2] — a U-shaped weight that gives
 *     equal weight to the LOWEST and HIGHEST ranks
 *     (symmetric about the median rank). The two reject
 *     differently when location and dispersion both
 *     shift: Conover's median fold removes the location
 *     channel, Mood's centred-rank-square does not.
 *     Pitman ARE Mood/Conover = 1.000 under normal
 *     scale alternatives but the two diverge sharply
 *     under joint location-scale.
 *
 *   - vs axis-170 daily-token-ansari-bradley-halves
 *     (Ansari-Bradley 1960). AB uses the FOLDED LINEAR
 *     score |R - (n+1)/2| (a triangular weight, ARE
 *     6/(pi^2) ~ 0.608 vs F under normal). Mood uses
 *     the SQUARED centred-rank (R - (n+1)/2)^2 (a
 *     parabolic weight, ARE 15/(2 pi^2) ~ 0.760 vs F
 *     under normal — see Mood 1954 sec. 4 Tab. 1).
 *     Both are symmetric U-shaped scores about the
 *     rank midpoint but the second derivative differs:
 *     AB's |.| has a kink at the centre, Mood's (.)^2
 *     is smooth and HEAVIER on the rank extremes.
 *     Empirically the two reject in the same direction
 *     but Mood is more powerful under normal-tailed
 *     scale alternatives, AB more robust to single
 *     outliers (its triangular weight cannot exceed
 *     (n-1)/2 — Mood's parabolic weight reaches
 *     ((n-1)/2)^2).
 *
 *   - vs axis-177 daily-token-klotz-halves (Klotz 1962).
 *     Klotz uses SQUARED NORMAL SCORES
 *     a(R) = (Phi^{-1}(R/(n+1)))^2 — a TAIL-AMPLIFIED
 *     U-shape that grows EXPONENTIALLY with rank-
 *     extremity. Mood uses SQUARED CENTRED RAW RANKS
 *     (R - (n+1)/2)^2 — POLYNOMIAL (quadratic) growth.
 *     ARE Mood/Klotz = 15/(2 pi^2) / 1 ~ 0.760 under
 *     normal; Mood is more robust under heavy-tailed
 *     contamination (Klotz's normal-quantile transform
 *     can blow up under outliers; Mood's bounded by
 *     ((n-1)/2)^2 by construction).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (Siegel-Tukey 1960). ST uses LINEAR
 *     "outside-in" ranks 1, n, 2, n-1, ... assigned by
 *     POSITION-FROM-EXTREMES on the pooled order then
 *     summed (NOT squared) over the second sample.
 *     Mood uses STANDARD ASCENDING ranks then SQUARES
 *     CENTRED. ST's score is a permutation of {1..n}
 *     reassigned by alternating allocation; Mood's is
 *     a deterministic monotone-from-centre function
 *     of the rank itself. ST has Pitman ARE 6/(pi^2)
 *     ~ 0.608 vs F; Mood has 15/(2 pi^2) ~ 0.760 — a
 *     25% relative-efficiency gain over ST under
 *     normal scale alternatives.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi-2(2)
 *     location-scale tests). C/L combine a location and
 *     scale statistic into one chi-2(2); they cannot
 *     SEPARATE the two channels. Mood is a pure
 *     SCALE-DETECTION axis isolating the dispersion
 *     question (subject to the known location-channel
 *     leakage when no median-fold is applied — a
 *     deliberate design choice that distinguishes Mood
 *     from Conover within the SCALE family).
 *
 *   - vs axis-115/176 Mann-Whitney/Brunner-Munzel
 *     (STOCHASTIC ORDERING tests on raw values). MW/BM
 *     test for stochastic dominance with LINEAR rank
 *     scores summed over the second sample. Mood uses
 *     CENTRED-SQUARED rank scores; the two are
 *     ORTHOGONAL by construction — pure scale shift
 *     with equal medians gives MW/BM ~ 0 while Mood
 *     rejects strongly; pure location shift with equal
 *     spreads gives MW/BM != 0 while Mood remains near
 *     0 (the second-sample's centred-rank-squared
 *     sum equals the first-sample's by symmetry under
 *     pure location shift on equal-variance inputs).
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Mood 1954 sec. 5 Tab. 2: actual size 0.047-0.054
 * across n1 = n2 in [8, 50]; Hajek & Sidak 1967
 * sec. III.4.5 confirms convergence rate
 * O(n^{-1/2})).
 *
 * Reference:
 *   Mood, A. M., "On the asymptotic efficiency of
 *     certain nonparametric two-sample tests",
 *     *Annals of Mathematical Statistics* 25(3) (1954),
 *     pp. 514-522.
 *   Hajek, J. & Sidak, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), sec. III.4.5.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods* 3rd ed.
 *     (Wiley 2014), sec. 5.3.
 */
import type { QueueLine } from './types.js';

export type DailyTokenMoodHalvesSort =
  | 'moodZ'
  | 'moodZAbsDesc'
  | 'moodPValue'
  | 'moodPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMoodHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Mood 1954 sec. 5 Tab. 2).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMoodHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMoodHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  moodN1: number;
  /** Second-half size n2 = n - n1. */
  moodN2: number;
  /** Mood statistic W = sum_{j in B} (R_j - (n+1)/2)^2. */
  moodW: number;
  /** Null mean E[W] = n2 (n^2 - 1) / 12. */
  moodExpW: number;
  /** Null variance Var[W] = n1 n2 (n+1)(n^2-4)/180. */
  moodVarW: number;
  /** Standardised Mood Z ~ N(0, 1) under H0. */
  moodZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|moodZ|)). */
  moodPValue: number;
}

export interface DailyTokenMoodHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMoodHalvesSort;
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
  sources: DailyTokenMoodHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksMood(values: number[]): number[] {
  const n = values.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) {
      j += 1;
    }
    const midRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = midRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Mood (1954) squared-centered-ranks scale test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Pooled
 * mid-ranks are centred at the rank midpoint (n+1)/2
 * and squared; the second-sample sum is standardised
 * under the exact null moments E[W] = n2 (n^2-1)/12,
 * Var[W] = n1 n2 (n+1)(n^2-4)/180.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - moodZ(x + c) === moodZ(x) for any constant c
 *     (the pooled rank ordering is invariant under
 *     additive shifts; ranks themselves are unchanged).
 *   - moodZ(a * x) === moodZ(x) for any a > 0 (positive
 *     scale preserves the pooled rank ordering).
 *   - moodZ(reverse(x)) === -moodZ(x) WHEN n1 = n2 AND
 *     there are no ties: reversing swaps which half
 *     each rank lands in; W -> sum_A R^2 - sum_B R^2
 *     pattern about E[W] negates the centred numerator,
 *     and Var[W] is symmetric in (n1, n2).
 *   - For x = repeat(constant) all ranks tie at
 *     (n+1)/2, every centred rank is 0, W = 0,
 *     numerator = -E[W] != 0 BUT Var[W] is also 0 in
 *     the degenerate sense — we throw to be filtered
 *     upstream (zero-variance gate).
 */
export function dailyTokenMoodHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  moodN1: number;
  moodN2: number;
  moodW: number;
  moodExpW: number;
  moodVarW: number;
  moodZ: number;
  moodPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenMoodHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenMoodHalves requires finite values');
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
      `dailyTokenMoodHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pooled mid-ranks on the RAW values (no median fold —
  // this is what distinguishes Mood from Conover).
  const ranks = midRanksMood(values);

  const midpoint = (n + 1) / 2;

  // W = sum over second-sample of (R - (n+1)/2)^2.
  let W = 0;
  for (let j = 0; j < n2; j += 1) {
    const c = ranks[n1 + j]! - midpoint;
    W += c * c;
  }

  const expW = (n2 * (n * n - 1)) / 12;
  const varW = (n1 * n2 * (n + 1) * (n * n - 4)) / 180;
  if (!(varW > 0) || !Number.isFinite(varW)) {
    throw new Error(
      `dailyTokenMoodHalves: degenerate null variance (varW=${varW})`,
    );
  }
  const moodZ = (W - expW) / Math.sqrt(varW);
  const moodPValue = 2 * standardNormalUpperTailMood(Math.abs(moodZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    moodN1: n1,
    moodN2: n2,
    moodW: W,
    moodExpW: expW,
    moodVarW: varW,
    moodZ,
    moodPValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailMood(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailMood: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailMood(-z);
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

function addUtcDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

export function buildDailyTokenMoodHalves(
  queue: QueueLine[],
  opts: DailyTokenMoodHalvesOptions = {},
): DailyTokenMoodHalvesReport {
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
  const sort: DailyTokenMoodHalvesSort = opts.sort ?? 'moodZAbsDesc';
  const validSorts: DailyTokenMoodHalvesSort[] = [
    'moodZ',
    'moodZAbsDesc',
    'moodPValue',
    'moodPValueDesc',
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
  const rows: DailyTokenMoodHalvesSourceRow[] = [];

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
      result = dailyTokenMoodHalves(filled);
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
      moodN1: result.moodN1,
      moodN2: result.moodN2,
      moodW: result.moodW,
      moodExpW: result.moodExpW,
      moodVarW: result.moodVarW,
      moodZ: result.moodZ,
      moodPValue: result.moodPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'moodZ':
        primary = a.moodZ - b.moodZ;
        break;
      case 'moodZAbsDesc':
        primary = Math.abs(b.moodZ) - Math.abs(a.moodZ);
        break;
      case 'moodPValue':
        primary = a.moodPValue - b.moodPValue;
        break;
      case 'moodPValueDesc':
        primary = b.moodPValue - a.moodPValue;
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
