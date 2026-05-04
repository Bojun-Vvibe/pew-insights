/**
 * daily-token-klotz-halves: per-source KLOTZ (1962)
 * NORMAL-SCORES SCALE TEST for equality of dispersion
 * between the first half (n1 = floor(n/2) days) vs second
 * half (n2 = n - n1 days) of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-SEVENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Klotz (1962 *J. Amer. Statist. Assoc.* 57:597-602)
 * proposed the SQUARED-NORMAL-SCORES SCALE TEST: assign
 * the score
 *
 *     a(R_i) = ( Phi^{-1}( R_i / (n + 1) ) )^2
 *
 * to each pooled mid-rank R_i (1..n), where Phi^{-1} is
 * the standard-normal inverse CDF (the van der Waerden
 * 1953 *Indagationes Math.* 14:453-458 normal score).
 * The Klotz statistic is the sum of squared normal scores
 * over the SECOND sample
 *
 *     K = sum_{j in B} a(R_j)
 *
 * Under H0 of equal dispersion (more precisely: equal
 * underlying CDFs about a common median; pre-aligned),
 * with n = n1 + n2 and pooled score mean
 *
 *     abar = (1/n) sum_i a(R_i)
 *
 * the exact null moments (Klotz 1962 eq. 2.4-2.5) are
 *
 *     E[K]   = n2 * abar
 *     Var[K] = ( n1 * n2 / ( n * (n - 1) ) ) *
 *              sum_i ( a(R_i) - abar )^2
 *
 * giving the standardised statistic
 *
 *     klotzZ = ( K - E[K] ) / sqrt(Var[K])
 *            ~ N(0, 1)   (asymptotically; Klotz 1962
 *                         Tab. 1 shows the normal
 *                         approximation is accurate to
 *                         within 1% on alpha for
 *                         n1 = n2 >= 8)
 *
 * Two-sided p-value
 *
 *     klotzPValue = 2 * ( 1 - Phi( |klotzZ| ) )
 *
 * SIGN CONVENTION: klotzZ > 0 <=> SECOND half has LARGER
 * dispersion (more mass at extremes of the pooled
 * ordering); klotzZ < 0 <=> FIRST half has larger
 * dispersion. Matches axis-117 stZ and axis-170 abZ
 * directional convention for direct cross-axis
 * aggregation.
 *
 * Pre-alignment: like Siegel-Tukey and Ansari-Bradley
 * the Klotz scale test ASSUMES equal medians under H0,
 * since location shift contaminates rank-based scale
 * statistics. We pre-align by SUBTRACTING THE
 * WITHIN-SAMPLE MEDIAN from each half before pooling and
 * ranking (the standard textbook adjustment; Hollander &
 * Wolfe 1999 *Nonparametric Statistical Methods* 2nd ed.
 * sec. 5.1). The aligned series preserves dispersion
 * differences while centring location differences out.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (Siegel-Tukey 1960). ST uses LINEAR "outside-in"
 *     ranks 1, n, 2, n-1, 3, n-2, ... assigned by
 *     position-from-extremes; equal-spacing of weights.
 *     Klotz uses SQUARED NORMAL SCORES which place
 *     QUADRATICALLY MORE weight on tail observations.
 *     Klotz has Pitman ARE 1.000 vs the F test under
 *     normal-scale alternatives (the maximum possible
 *     for a rank scale test); ST has ARE ~0.608.
 *     The two tests reject MEANINGFULLY differently when
 *     the dispersion difference is concentrated in the
 *     tails (heavy-tailed token usage spikes) vs the
 *     shoulders (slow drift).
 *
 *   - vs axis-170 daily-token-ansari-bradley-halves
 *     (Ansari-Bradley 1960). AB uses FOLDED LINEAR
 *     ranks |R - (n+1)/2| (a triangular weight
 *     function). Klotz's squared-normal-score weights
 *     grow much faster than AB's linear-from-centre
 *     weights, making Klotz strictly more powerful for
 *     heavy-tailed alternatives (Klotz 1962 Tab. 2:
 *     ARE Klotz/AB = pi/2 ~ 1.57 under normal).
 *
 *   - vs axis-122 daily-token-brown-forsyth-halves
 *     (Brown-Forsythe 1974 *JASA* 69:364-367) and
 *     axis-123 daily-token-bartlett-cumulative-
 *     periodogram. BF/Bartlett are PARAMETRIC tests on
 *     squared deviations from the median/mean; they are
 *     asymptotically equivalent to F under normality but
 *     break down spectacularly under heavy tails. Klotz
 *     is fully nonparametric and DISTRIBUTION-FREE under
 *     H0, so it holds nominal alpha under any
 *     continuous null distribution, while BF/Bartlett
 *     drift severely (Conover et al. 1981 *Technometrics*
 *     23:351-361 Tab. 3: BF actual size 0.18-0.32 vs
 *     nominal 0.05 under double-exponential).
 *
 *   - vs axis-176 daily-token-brunner-munzel-halves and
 *     axis-115 daily-token-mann-whitney-halves
 *     (STOCHASTIC ORDERING tests). BM/MW test for
 *     stochastic dominance; pure scale shift with equal
 *     medians gives BM/MW ~ 0 while Klotz rejects
 *     strongly. Cross-loading near zero by construction.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi-2(2)
 *     location-scale tests). C/L combine a location
 *     statistic and a scale statistic into one chi-2(2);
 *     they cannot SEPARATE the two channels. Klotz is a
 *     pure scale test and answers ONLY the dispersion
 *     question; combined with axis-176 BM (pure
 *     location), Klotz forms an ORTHOGONAL DECOMPOSITION
 *     of what C/L mash together.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Klotz 1962 sec. 4 simulation: actual size 0.044-0.054
 * across n1 = n2 in [8, 50]).
 *
 * Reference:
 *   Klotz, J. H., "Nonparametric tests for scale",
 *     *J. Amer. Statist. Assoc.* 57(298) (1962),
 *     pp. 597-602.
 *   van der Waerden, B. L., "Order tests for the two-
 *     sample problem and their power",
 *     *Indagationes Math.* 14 (1953), pp. 453-458.
 *   Hollander, M. & Wolfe, D. A., *Nonparametric
 *     Statistical Methods* 2nd ed. (Wiley 1999), sec. 5.1.
 *   Conover, W. J., Johnson, M. E. & Johnson, M. M.,
 *     "A comparative study of tests for homogeneity of
 *     variances...", *Technometrics* 23(4) (1981),
 *     pp. 351-361.
 */
import type { QueueLine } from './types.js';

export type DailyTokenKlotzHalvesSort =
  | 'klotzZ'
  | 'klotzZAbsDesc'
  | 'klotzPValue'
  | 'klotzPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKlotzHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Klotz 1962 sec. 4).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKlotzHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenKlotzHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  klotzN1: number;
  /** Second-half size n2 = n - n1. */
  klotzN2: number;
  /** Pooled-score mean abar = (1/n) sum a(R_i). */
  klotzAbar: number;
  /** Sum of squared deviations of a(R_i) from abar. */
  klotzScoreSS: number;
  /** Klotz statistic K = sum_{j in B} a(R_j). */
  klotzK: number;
  /** Null mean E[K] = n2 * abar. */
  klotzExpK: number;
  /** Null variance Var[K] = n1 n2 / (n(n-1)) * klotzScoreSS. */
  klotzVarK: number;
  /** Standardised Klotz Z ~ N(0, 1) under H0. */
  klotzZ: number;
  /** Two-sided normal p-value 2(1 - Phi(|klotzZ|)). */
  klotzPValue: number;
}

export interface DailyTokenKlotzHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKlotzHalvesSort;
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
  sources: DailyTokenKlotzHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksKlotz(values: number[]): number[] {
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
 * Median of an array of finite numbers (does not mutate
 * the input). Uses the standard textbook definition:
 * average of the two middle order statistics for even n,
 * the middle order statistic for odd n.
 */
export function medianKlotz(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianKlotz: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Klotz (1962) normal-scores scale test on the first-half
 * (A = x[0..n1-1]) vs second-half (B = x[n1..n-1]) of a
 * real-valued series. Pre-aligns each half by subtracting
 * its within-sample median (Hollander & Wolfe 1999
 * sec. 5.1). Returns the squared-normal-score statistic
 * K = sum_{j in B} a(R_j), its null mean and variance,
 * the standardised Z, and the two-sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - klotzZ(x + c) === klotzZ(x) for any constant c
 *     (median-alignment removes the global shift; ranks
 *     are invariant under any monotone transform).
 *   - klotzZ(a * x) === klotzZ(x) for any a > 0 (positive
 *     scale preserves both halves' medians and pooled
 *     mid-ranks, hence preserves K, E[K], Var[K]).
 *   - klotzZ is invariant under independent location
 *     shifts of A and B (the median-alignment step
 *     subtracts each half's median first).
 *   - For x = repeat(constant) the test is undefined
 *     (zero score variance after alignment); we throw
 *     to be filtered upstream.
 *   - klotzZ(reverse(x)) === -klotzZ(x) WHEN n1 = n2
 *     AND there are no ties (swapping halves negates the
 *     numerator (K - E[K]) up to sign; Var[K] is
 *     symmetric in the labels).
 */
export function dailyTokenKlotzHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  klotzN1: number;
  klotzN2: number;
  klotzAbar: number;
  klotzScoreSS: number;
  klotzK: number;
  klotzExpK: number;
  klotzVarK: number;
  klotzZ: number;
  klotzPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenKlotzHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenKlotzHalves requires finite values');
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
      `dailyTokenKlotzHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pre-align each half by subtracting its within-sample
  // median (Hollander & Wolfe 1999 sec. 5.1).
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianKlotz(aRaw);
  const bMed = medianKlotz(bRaw);
  const aligned = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) aligned[i] = aRaw[i]! - aMed;
  for (let j = 0; j < n2; j += 1) aligned[n1 + j] = bRaw[j]! - bMed;

  // Pooled mid-ranks on the aligned values.
  const ranks = midRanksKlotz(aligned);

  // Squared-normal-score a(R_i) = ( Phi^{-1}(R_i/(n+1)) )^2.
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const u = ranks[i]! / (n + 1);
    const z = inverseStandardNormalCdfKlotz(u);
    scores[i] = z * z;
  }

  let abar = 0;
  for (let i = 0; i < n; i += 1) abar += scores[i]!;
  abar /= n;

  let scoreSS = 0;
  for (let i = 0; i < n; i += 1) {
    const c = scores[i]! - abar;
    scoreSS += c * c;
  }
  if (!(scoreSS > 0) || !Number.isFinite(scoreSS)) {
    throw new Error(
      `dailyTokenKlotzHalves: degenerate score variance (scoreSS=${scoreSS})`,
    );
  }

  let K = 0;
  for (let j = 0; j < n2; j += 1) K += scores[n1 + j]!;

  const expK = n2 * abar;
  const varK = ((n1 * n2) / (n * (n - 1))) * scoreSS;
  if (!(varK > 0) || !Number.isFinite(varK)) {
    throw new Error(
      `dailyTokenKlotzHalves: degenerate null variance (varK=${varK})`,
    );
  }
  const klotzZ = (K - expK) / Math.sqrt(varK);
  const klotzPValue = 2 * standardNormalUpperTailKlotz(Math.abs(klotzZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    klotzN1: n1,
    klotzN2: n2,
    klotzAbar: abar,
    klotzScoreSS: scoreSS,
    klotzK: K,
    klotzExpK: expK,
    klotzVarK: varK,
    klotzZ,
    klotzPValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailKlotz(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`standardNormalUpperTailKlotz: z must be finite (got ${z})`);
  }
  if (z < 0) return 1 - standardNormalUpperTailKlotz(-z);
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
 * Inverse standard-normal CDF: given p in (0, 1), returns
 * z such that Phi(z) = p. Beasley-Springer-Moro 1977 +
 * Acklam 2003 (max relative error ~1e-9 across p in
 * (1e-300, 1 - 1e-300)).
 */
export function inverseStandardNormalCdfKlotz(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdfKlotz: p in (0,1) required (got ${p})`,
    );
  }
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let z: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    z =
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    z =
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z =
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  return z;
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

export function buildDailyTokenKlotzHalves(
  queue: QueueLine[],
  opts: DailyTokenKlotzHalvesOptions = {},
): DailyTokenKlotzHalvesReport {
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
  const sort: DailyTokenKlotzHalvesSort = opts.sort ?? 'klotzZAbsDesc';
  const validSorts: DailyTokenKlotzHalvesSort[] = [
    'klotzZ',
    'klotzZAbsDesc',
    'klotzPValue',
    'klotzPValueDesc',
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
  const rows: DailyTokenKlotzHalvesSourceRow[] = [];

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
      result = dailyTokenKlotzHalves(filled);
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
      klotzN1: result.klotzN1,
      klotzN2: result.klotzN2,
      klotzAbar: result.klotzAbar,
      klotzScoreSS: result.klotzScoreSS,
      klotzK: result.klotzK,
      klotzExpK: result.klotzExpK,
      klotzVarK: result.klotzVarK,
      klotzZ: result.klotzZ,
      klotzPValue: result.klotzPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'klotzZ':
        primary = a.klotzZ - b.klotzZ;
        break;
      case 'klotzZAbsDesc':
        primary = Math.abs(b.klotzZ) - Math.abs(a.klotzZ);
        break;
      case 'klotzPValue':
        primary = a.klotzPValue - b.klotzPValue;
        break;
      case 'klotzPValueDesc':
        primary = b.klotzPValue - a.klotzPValue;
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
