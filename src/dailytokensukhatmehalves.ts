/**
 * daily-token-sukhatme-halves: per-source SUKHATME (1957)
 * ABSOLUTE-DEVIATIONS U-STATISTIC SCALE TEST for equality
 * of dispersion between the first half (n1 = floor(n/2)
 * days) vs second half (n2 = n - n1 days) of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-EIGHTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Sukhatme (1957, *Ann. Math. Statist.* 28(1):188-194,
 * eq. 2.1) proposed the U-STATISTIC on ABSOLUTE
 * DEVIATIONS FROM THE POOLED MEDIAN. Compute the pooled
 * median M = median(A union B) and the absolute deviation
 * vectors a_i = |A_i - M|, b_j = |B_j - M|. Form the
 * Mann-Whitney-style U-count of pairs in which a B-deviation
 * exceeds an A-deviation:
 *
 *     S = #{ (i, j) : a_i < b_j } + 0.5 * #{ (i, j) : a_i = b_j }
 *
 * Under H0 of equal dispersion (and approximately equal
 * location, eliminated by the median fold) the standard
 * Mann-Whitney null moments hold:
 *
 *     E[S]   = n1 * n2 / 2
 *     Var[S] = n1 * n2 * (n + 1) / 12
 *
 * giving the asymptotic standardised statistic
 *
 *     sukhatmeZ = ( S - E[S] ) / sqrt(Var[S])  ~ N(0, 1)
 *
 * Two-sided p-value
 *
 *     sukhatmePValue = 2 * ( 1 - Phi(|sukhatmeZ|) )
 *
 * SIGN CONVENTION: sukhatmeZ > 0 <=> SECOND half has
 * LARGER absolute deviations (B-deviations more often
 * exceed A-deviations); sukhatmeZ < 0 <=> FIRST half is
 * more dispersed. Matches axis-117 stZ, axis-170 abZ,
 * axis-177 klotzZ, axis-178 conoverZ, axis-179 moodZ
 * directional convention so signed cross-axis aggregation
 * (Stouffer combiners) preserves direction interpretation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim for axis-180):
 *
 *   - vs axis-179 daily-token-mood-halves (Mood 1954).
 *     Mood squares CENTRED MID-RANKS on RAW pooled values
 *     (no median fold), giving a U-shaped weight that
 *     rewards rank-extremity equally at both ends. Sukhatme
 *     OPERATES ON ABSOLUTE DEVIATIONS from the pooled
 *     median (classic median fold) and uses the LINEAR
 *     U-statistic count, not a rank-quadratic. Mood's score
 *     is (R - (n+1)/2)^2 in [0, ((n-1)/2)^2]; Sukhatme's
 *     contribution per pair is the indicator 1{a_i < b_j}
 *     in {0, 1/2, 1}. Pitman ARE Sukhatme/Mood < 1 under
 *     normal scale alternatives but Sukhatme has bounded
 *     influence per observation (no single value can
 *     contribute more than n2 to S) — strictly more
 *     outlier-robust than Mood's quadratic weight.
 *
 *   - vs axis-178 daily-token-conover-squared-ranks-halves
 *     (Conover & Iman 1978). Conover squares ASCENDING
 *     RANKS of |X - WITHIN-HALF median|. Sukhatme uses
 *     UNSQUARED COUNTS on |X - POOLED median|. The pooling
 *     of the median estimator vs the within-half estimator
 *     is the structural axis: Conover separately estimates
 *     two medians (one per half), Sukhatme estimates one
 *     pooled median. Under H0 (equal location AND scale)
 *     both are size-correct; under EQUAL location + UNEQUAL
 *     scale Sukhatme is purer (it avoids the within-half
 *     median estimation noise that contaminates Conover's
 *     scale signal).
 *
 *   - vs axis-170 daily-token-ansari-bradley-halves
 *     (Ansari-Bradley 1960). AB uses FOLDED LINEAR ranks
 *     |R - (n+1)/2| on RAW pooled values (folds about the
 *     RANK MIDPOINT, not the data median). Sukhatme folds
 *     about the DATA MEDIAN then takes UNFOLDED ranks
 *     (via the Mann-Whitney U-count on the deviations).
 *     The two folds are NOT equivalent except in the
 *     degenerate case of perfectly symmetric pooled
 *     distributions with equal sample sizes — under
 *     skewed data they diverge sharply.
 *
 *   - vs axis-177 daily-token-klotz-halves (Klotz 1962).
 *     Klotz uses SQUARED NORMAL SCORES on RAW pooled
 *     ranks — exponential rank-extremity amplification.
 *     Sukhatme uses LINEAR U-statistic counts on
 *     ABSOLUTE-DEVIATION pooled ranks. Klotz's ARE under
 *     normal scale alternatives is 1.000 (asymptotically
 *     optimal); Sukhatme's is 6/(pi^2) ~ 0.608, but
 *     Sukhatme is DISTRIBUTION-FREE under any continuous
 *     symmetric F (Klotz requires F ~ N for full
 *     efficiency).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (Siegel-Tukey 1960). ST uses INTERLEAVED OUTSIDE-IN
 *     ranks 1, n, 2, n-1, ... assigned by position-from-
 *     extremes on the pooled order then summed over the
 *     second sample. Sukhatme operates on ABSOLUTE
 *     DEVIATIONS from the pooled median — a fundamentally
 *     different rank scheme. ST and Sukhatme have the
 *     SAME ARE 0.608 under normal scale alternatives, but
 *     ST's score is a permutation of {1..n} (FIXED scores
 *     determined by rank position), Sukhatme's is a count
 *     of pair comparisons (DATA-DEPENDENT scores via the
 *     |X - M| transform). They reject differently under
 *     skewed alternatives.
 *
 *   - vs axis-115/176 Mann-Whitney/Brunner-Munzel
 *     (STOCHASTIC ORDERING tests on RAW values). MW/BM
 *     count pairs with X_i < Y_j. Sukhatme counts pairs
 *     with |X_i - M| < |Y_j - M|. The two are
 *     ORTHOGONAL by construction: pure scale shift with
 *     equal medians gives MW/BM ~ 0 and Sukhatme rejects;
 *     pure location shift with equal spreads gives MW/BM
 *     != 0 and Sukhatme is approximately invariant
 *     (median fold absorbs the shift).
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Sukhatme 1957 sec. 4: actual size 0.046-0.054 across
 * n1 = n2 in [8, 50] under continuous symmetric F).
 *
 * Reference:
 *   Sukhatme, B. V., "On certain two-sample nonparametric
 *     tests for variances", *Annals of Mathematical
 *     Statistics* 28(1) (1957), pp. 188-194.
 *   Hollander, M., Wolfe, D. A. & Chicken, E.,
 *     *Nonparametric Statistical Methods* 3rd ed.
 *     (Wiley 2014), sec. 5.5.
 */
import type { QueueLine } from './types.js';

export type DailyTokenSukhatmeHalvesSort =
  | 'sukhatmeZ'
  | 'sukhatmeZAbsDesc'
  | 'sukhatmePValue'
  | 'sukhatmePValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSukhatmeHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Sukhatme 1957 sec. 4).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSukhatmeHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenSukhatmeHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Pooled median used for the absolute-deviation fold. */
  pooledMedian: number;
  /** First-half size n1 = floor(n/2). */
  sukhatmeN1: number;
  /** Second-half size n2 = n - n1. */
  sukhatmeN2: number;
  /** Sukhatme U-count S = #{(i,j) : a_i < b_j} + 0.5 #{a_i = b_j}. */
  sukhatmeS: number;
  /** Null mean E[S] = n1 n2 / 2. */
  sukhatmeExpS: number;
  /** Null variance Var[S] = n1 n2 (n+1) / 12. */
  sukhatmeVarS: number;
  /** Standardised Sukhatme Z ~ N(0, 1) under H0. */
  sukhatmeZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|sukhatmeZ|)). */
  sukhatmePValue: number;
}

export interface DailyTokenSukhatmeHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSukhatmeHalvesSort;
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
  sources: DailyTokenSukhatmeHalvesSourceRow[];
}

/**
 * Pooled median of `values` using the type-7 (linear-
 * interpolation) convention: for even n the average of
 * the two central order statistics; for odd n the
 * single central value. Implemented via in-place
 * Floyd-Rivest-equivalent O(n log n) sort for clarity
 * (n <= a few thousand in this domain so the constant
 * factor is irrelevant).
 */
export function pooledMedianSukhatme(values: number[]): number {
  const n = values.length;
  if (n === 0) {
    throw new Error('pooledMedianSukhatme: empty input');
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error('pooledMedianSukhatme: non-finite value');
    }
  }
  const sorted = values.slice().sort((a, b) => a - b);
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailSukhatme(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailSukhatme: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailSukhatme(-z);
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
 * Sukhatme (1957) absolute-deviations U-statistic scale
 * test on the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Uses the
 * POOLED MEDIAN as the location-fold anchor (not within-
 * half medians — that would be Conover/Brown-Forsythe).
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - sukhatmeZ(x + c) === sukhatmeZ(x) for any constant c
 *     (the pooled median shifts by c, so |x_i - M| is
 *     unchanged; the U-count is invariant).
 *   - sukhatmeZ(a * x) === sukhatmeZ(x) for any a > 0
 *     (positive scale preserves the order of |X - M|,
 *     so the pair counts are unchanged).
 *   - sukhatmeZ(reverse(x)) === -sukhatmeZ(x) WHEN n1 = n2
 *     AND no |X - M| ties between halves: reversing swaps
 *     A and B, which swaps the roles in S — the U-count
 *     flips to n1*n2 - S, negating the centred numerator.
 *   - For x = repeat(constant) all |x_i - M| = 0, all
 *     pairs tie, S = n1*n2/2 = E[S], sukhatmeZ = 0/0 — we
 *     throw on zero variance to surface this upstream.
 */
export function dailyTokenSukhatmeHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  pooledMedian: number;
  sukhatmeN1: number;
  sukhatmeN2: number;
  sukhatmeS: number;
  sukhatmeExpS: number;
  sukhatmeVarS: number;
  sukhatmeZ: number;
  sukhatmePValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenSukhatmeHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenSukhatmeHalves requires finite values');
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
      `dailyTokenSukhatmeHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const pooledMedian = pooledMedianSukhatme(values);

  // Absolute deviations from the pooled median.
  const a = new Array<number>(n1);
  const b = new Array<number>(n2);
  for (let i = 0; i < n1; i += 1) a[i] = Math.abs(values[i]! - pooledMedian);
  for (let j = 0; j < n2; j += 1)
    b[j] = Math.abs(values[n1 + j]! - pooledMedian);

  // O(n log n) U-count via merging sorted absolute-deviation
  // arrays. For each b_j, count #{i : a_i < b_j} + 0.5 #{i : a_i = b_j}.
  const aSorted = a.slice().sort((x, y) => x - y);
  let S = 0;
  for (let j = 0; j < n2; j += 1) {
    const bv = b[j]!;
    // Lower bound (first index with aSorted[i] >= bv).
    let lo = 0;
    let hi = n1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (aSorted[m]! < bv) lo = m + 1;
      else hi = m;
    }
    const lessThan = lo;
    // Upper bound (first index with aSorted[i] > bv).
    lo = 0;
    hi = n1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (aSorted[m]! <= bv) lo = m + 1;
      else hi = m;
    }
    const ties = lo - lessThan;
    S += lessThan + 0.5 * ties;
  }

  const expS = (n1 * n2) / 2;
  const varS = (n1 * n2 * (n + 1)) / 12;
  if (!(varS > 0) || !Number.isFinite(varS)) {
    throw new Error(
      `dailyTokenSukhatmeHalves: degenerate null variance (varS=${varS})`,
    );
  }
  const sukhatmeZ = (S - expS) / Math.sqrt(varS);
  const sukhatmePValue =
    2 * standardNormalUpperTailSukhatme(Math.abs(sukhatmeZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    pooledMedian,
    sukhatmeN1: n1,
    sukhatmeN2: n2,
    sukhatmeS: S,
    sukhatmeExpS: expS,
    sukhatmeVarS: varS,
    sukhatmeZ,
    sukhatmePValue,
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

export function buildDailyTokenSukhatmeHalves(
  queue: QueueLine[],
  opts: DailyTokenSukhatmeHalvesOptions = {},
): DailyTokenSukhatmeHalvesReport {
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
  const sort: DailyTokenSukhatmeHalvesSort = opts.sort ?? 'sukhatmeZAbsDesc';
  const validSorts: DailyTokenSukhatmeHalvesSort[] = [
    'sukhatmeZ',
    'sukhatmeZAbsDesc',
    'sukhatmePValue',
    'sukhatmePValueDesc',
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
  const rows: DailyTokenSukhatmeHalvesSourceRow[] = [];

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
      result = dailyTokenSukhatmeHalves(filled);
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
      pooledMedian: result.pooledMedian,
      sukhatmeN1: result.sukhatmeN1,
      sukhatmeN2: result.sukhatmeN2,
      sukhatmeS: result.sukhatmeS,
      sukhatmeExpS: result.sukhatmeExpS,
      sukhatmeVarS: result.sukhatmeVarS,
      sukhatmeZ: result.sukhatmeZ,
      sukhatmePValue: result.sukhatmePValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'sukhatmeZ':
        primary = a.sukhatmeZ - b.sukhatmeZ;
        break;
      case 'sukhatmeZAbsDesc':
        primary = Math.abs(b.sukhatmeZ) - Math.abs(a.sukhatmeZ);
        break;
      case 'sukhatmePValue':
        primary = a.sukhatmePValue - b.sukhatmePValue;
        break;
      case 'sukhatmePValueDesc':
        primary = b.sukhatmePValue - a.sukhatmePValue;
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
 * Corpus-level SIGNED aggregator for axis-180 per-source
 * results. Combines per-source SIGNED sukhatmeZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949 *American
 * Soldier* vol. 1, sec. 2.2; Whitlock 2005 *J. Evol.
 * Biol.* 18:1368-1373):
 *
 *     stoufferZ              = sum_i sukhatmeZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * sukhatmeZ is intrinsically signed (positive = second
 * half MORE dispersed; negative = first half MORE
 * dispersed) so Stouffer is the correct meta-analytic
 * combiner. Mirrors the axis-177/178/179 SIGNED corpus
 * aggregators so all four can be compared elementwise to
 * detect cross-axis sign agreement (strong evidence) vs
 * disagreement (alternative localised to a specific
 * weighting regime — bounded U-count vs squared rank vs
 * squared centred rank vs squared normal score).
 *
 * Also returns
 *
 *   - meanSukhatmeZ — unweighted corpus-mean sukhatmeZ
 *   - tenureWeightedMeanSukhatmeZ — nTenureDays-weighted
 *     mean sukhatmeZ (matches the axis-175 v0.6.452 ...
 *     axis-179 v0.6.459 weighting convention)
 *   - rowsUsed, rowsSkipped — counters; malformed rows
 *     (non-finite Z, P outside (0, 1], non-positive
 *     VarS or nTenureDays) are SKIPPED with a counter
 *     rather than throwing.
 */
export interface SukhatmeHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanSukhatmeZ: number;
  tenureWeightedMeanSukhatmeZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateSukhatmeHalves(
  rows: ReadonlyArray<{
    sukhatmeZ: number;
    sukhatmePValue: number;
    sukhatmeVarS: number;
    nTenureDays: number;
  }>,
): SukhatmeHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.sukhatmeZ) ||
      !Number.isFinite(r.sukhatmePValue) ||
      r.sukhatmePValue <= 0 ||
      r.sukhatmePValue > 1 ||
      !Number.isFinite(r.sukhatmeVarS) ||
      r.sukhatmeVarS <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.sukhatmeZ;
    weightedZSum += r.nTenureDays * r.sukhatmeZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanSukhatmeZ: Number.NaN,
      tenureWeightedMeanSukhatmeZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailSukhatme(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanSukhatmeZ: zSum / used,
    tenureWeightedMeanSukhatmeZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Directional 5-bucket label classifier for axis-180
 * per-source sukhatmeZ. Maps the signed standardised
 * statistic to one of five mutually-exclusive verdict
 * buckets at configurable two-sided alpha (default 0.05):
 *
 *   - 'second-decisively-more-dispersed' if sukhatmeZ > 0
 *     AND sukhatmePValue < alpha
 *   - 'first-decisively-more-dispersed'  if sukhatmeZ < 0
 *     AND sukhatmePValue < alpha
 *   - 'second-leans-more-dispersed' if sukhatmeZ > 0 AND
 *     alpha <= sukhatmePValue < 2 * alpha (suggestive
 *     but not significant at the chosen level)
 *   - 'first-leans-more-dispersed'  if sukhatmeZ < 0 AND
 *     alpha <= sukhatmePValue < 2 * alpha
 *   - 'no-evidence-of-dispersion-shift' otherwise
 *
 * Throws on malformed input (non-finite Z, P outside
 * (0, 1], alpha outside (0, 0.5]).
 */
export type SukhatmeDirectionalLabel =
  | 'second-decisively-more-dispersed'
  | 'first-decisively-more-dispersed'
  | 'second-leans-more-dispersed'
  | 'first-leans-more-dispersed'
  | 'no-evidence-of-dispersion-shift';

export function labelSukhatmeHalvesRow(
  row: { sukhatmeZ: number; sukhatmePValue: number },
  alpha = 0.05,
): SukhatmeDirectionalLabel {
  if (!Number.isFinite(row.sukhatmeZ)) {
    throw new Error(
      `labelSukhatmeHalvesRow: sukhatmeZ must be finite (got ${row.sukhatmeZ})`,
    );
  }
  if (
    !Number.isFinite(row.sukhatmePValue) ||
    row.sukhatmePValue <= 0 ||
    row.sukhatmePValue > 1
  ) {
    throw new Error(
      `labelSukhatmeHalvesRow: sukhatmePValue must be in (0, 1] (got ${row.sukhatmePValue})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelSukhatmeHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const lean = 2 * alpha;
  if (row.sukhatmePValue < alpha) {
    return row.sukhatmeZ > 0
      ? 'second-decisively-more-dispersed'
      : 'first-decisively-more-dispersed';
  }
  if (row.sukhatmePValue < lean) {
    return row.sukhatmeZ > 0
      ? 'second-leans-more-dispersed'
      : 'first-leans-more-dispersed';
  }
  return 'no-evidence-of-dispersion-shift';
}
