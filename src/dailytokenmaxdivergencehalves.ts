/**
 * daily-token-max-divergence-halves: per-source
 * KDE-SMOOTHED L^infinity (MAX-DIVERGENCE / SUP-NORM)
 * distance between the FIRST and SECOND half of the
 * gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-THIRD cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129/130/131/132
 * for direct comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h is Silverman's rule of thumb on the POOLED
 * sample with the robust scale (Silverman 1986, eq. 3.31):
 *
 *     h = 0.9 * mad_pool * n^(-1/5)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side:
 *
 *     g_lo = min(x) - 3*h
 *     g_hi = max(x) + 3*h
 *     dx   = (g_hi - g_lo) / (K - 1)
 *
 * Gaussian KDE per half on the shared grid; trapezoidal
 * mass-normalisation to exact pmfs p, q on {g_0..g_{K-1}}
 * (sum_k p_k = sum_k q_k = 1).
 *
 * MAX-DIVERGENCE / SUP-NORM (L^infinity):
 *
 *     maxDiv(p, q)  =  max_k | p_k - q_k |    in [0, 1]
 *
 * The L^infinity norm of the per-bin pmf gap. This is the
 * "Chebyshev pmf distance" / "uniform metric on pmfs". It
 * answers the SHARPEST possible question: the SINGLE BUCKET
 * where the two half-distributions disagree the MOST. Unlike
 * TV (L^1), Hellinger (L^2 sqrt), JSD/KL/Renyi (log
 * functionals), and Bhattacharyya (log of inner product),
 * maxDiv is determined ENTIRELY by the worst-case bucket and
 * is INVARIANT under any change to the other K-1 buckets so
 * long as that one stays largest.
 *
 * RELATED: WORST-BUCKET LOCATION DIAGNOSTIC. We expose
 *
 *     argMaxBucketIndex   in [0, K-1]
 *     argMaxBucketX       = g_lo + argMaxBucketIndex * dx
 *     argMaxPK, argMaxQK  pmf masses at that bucket
 *     argMaxSign          = +1 if p_k > q_k there, else -1
 *
 * so a downstream user can immediately point to the
 * token-volume regime (e.g. "the divergence is concentrated
 * at the high-token tail bucket") that drives the score.
 *
 * NORMALISED RANKING SCALE. maxDiv is already in [0, 1] (it
 * is in [0, 1] because both p_k, q_k in [0, 1] and
 * |p-q|<=max(p,q)<=1). However maxDiv approaches 1 only when
 * the pmfs concentrate on disjoint single bins, which on a
 * Gaussian-KDE-smoothed grid is unreachable. We additionally
 * expose
 *
 *     maxDivLinfL1Ratio  =  maxDiv / tvDist     in [0, 1]
 *
 * where tvDist = 0.5 * sum_k |p_k - q_k| is the
 * total-variation distance (axis-127). The ratio sits in
 * [1/K, 1]: 1/K when the per-bin gap is FLAT (uniform
 * disagreement across all buckets) and 1 when ONE bucket
 * dominates the pmf gap entirely. Hence maxDivLinfL1Ratio is
 * a SPARSITY-OF-DISAGREEMENT diagnostic on top of the raw
 * sup-norm score: low ratio = "broad" half-vs-half drift,
 * high ratio = "spike" drift in one specific token-volume
 * regime.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-132:
 *
 *   - Class. L^infinity NORM of the pmf gap. Unique class
 *     of "sup-norm two-sample tests on a KDE-smoothed pmf".
 *     No prior axis is the L^infinity norm. All previously
 *     shipped half-vs-half axes are EITHER L^1 (TV), L^2 in
 *     some coordinate system (H in sqrt-amplitude, Delta in
 *     reciprocal-sum, CvM in CDF-prob, energy in CF), L^1 of
 *     the CDF (W1), tail-weighted L^2 of the CDF (AD),
 *     sup-norm of the CDF (KS), RKHS kernel embedding (MMD),
 *     low-dim Euclidean on quantiles (qv-Mahalanobis, PCA),
 *     or LOG functionals on the pmf (KL, JSD, Jeffreys,
 *     Bhattacharyya, Renyi-2). MaxDiv occupies the L^infinity
 *     slot in the L^p ladder on the KDE pmf gap that has
 *     been entirely empty.
 *
 *   - vs axis-118 KS. KS is sup-norm on the EMPIRICAL CDF;
 *     maxDiv is sup-norm on the KDE PMF. Different objects.
 *     KS is permutation-invariant (CDF is order-statistic),
 *     so is maxDiv (KDE pmf is permutation-invariant within
 *     each half). KS does NOT depend on a kernel; maxDiv
 *     does (Silverman, K=257). For two halves with
 *     identical CDFs but different per-bin smoothed
 *     densities (impossible without smoothing tie-breaking),
 *     KS = 0 and maxDiv = 0. Generally not monotone images
 *     of each other.
 *
 *   - vs axis-127 TV (L^1 on the same KDE pmfs). TV =
 *     0.5 * sum_k |p_k - q_k|, maxDiv = max_k |p_k - q_k|.
 *     Holder gives maxDiv <= 2*TV and (1/K)*sum_k|...|
 *     <= maxDiv, hence (2/K)*TV <= maxDiv <= 2*TV. Monotone
 *     ordering can differ when one pmf gap is FLAT (TV
 *     dominates maxDiv up to factor K) versus SPIKED (TV
 *     and maxDiv are comparable). Hence cross-source
 *     RANKING by maxDiv differs materially from TV.
 *
 *   - vs axes 128 H / 129 Delta / 130 bDist / 131 J / 132
 *     Renyi-2. All log/sqrt-amplitude/reciprocal-sum
 *     functionals; maxDiv is a pure L^infinity norm. None
 *     of those axes can be recovered from maxDiv alone
 *     (they integrate over all K buckets; maxDiv only sees
 *     the worst bucket). Conversely none of them recover
 *     maxDiv (a divergence integral is unchanged by moving
 *     mass between bins so long as the integral is
 *     preserved, while maxDiv changes whenever the worst
 *     bucket changes).
 *
 *   - vs spectral / autocorrelation / Gini / DFA / etc.
 *     Those summarise the WHOLE series; maxDiv is a pmf
 *     functional applied to two HALVES. Permutation-
 *     invariant within halves, permutation-SENSITIVE across
 *     halves.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the SUP-NORM (L^infinity) gap maxDiv = max_k |p_k - q_k|,
 *   what is the WORST-CASE per-bucket disagreement, WHICH
 *   token-volume bucket drives it, and is the half-vs-half
 *   drift CONCENTRATED on one bucket or BROADLY SPREAD
 *   (maxDivLinfL1Ratio close to 1 vs close to 1/K)?"**
 *
 * References:
 *   Devroye, L. and Lugosi, G., Combinatorial Methods in
 *     Density Estimation, Springer (2001), Ch. 1 (L^infinity
 *     and L^p density-estimate metrics).
 *   Silverman, B. W., Density Estimation for Statistics and
 *     Data Analysis, Chapman & Hall (1986), eq. 3.31.
 *   Wand, M. P. and Jones, M. C., Kernel Smoothing, Chapman
 *     & Hall (1995), §2.7.
 *
 * Caveats:
 *
 *   - Grid size K = 257 and bandwidth multiplier 0.9 are
 *     FIXED for cross-source comparability AND for
 *     bit-exact bandwidth identity with axes
 *     126/127/128/129/130/131/132.
 *   - Hard floor n >= 8 so that n1, n2 >= 4.
 *   - maxDiv === 0 iff p === q on the grid; maxDiv in
 *     [0, 1]. The upper-bound 1 is unreachable for
 *     KDE-smoothed pmfs over a shared grid.
 *   - argMaxBucketIndex is the SMALLEST index attaining
 *     the maximum (deterministic tie-break).
 *   - maxDivLinfL1Ratio = maxDiv / tvDist defined as 0
 *     when tvDist === 0 (which forces maxDiv === 0).
 *   - Translation- AND positive-scale-invariant in the data
 *     (data and bandwidth scale together; pmfs unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-max-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-max-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by sup-norm ascending:
 *   pew-insights daily-token-max-divergence-halves \
 *     --sort maxDiv
 */
import type { QueueLine } from './types.js';

export type DailyTokenMaxDivergenceHalvesSort =
  | 'maxDiv'
  | 'maxDivDesc'
  | 'maxDivLinfL1Ratio'
  | 'maxDivLinfL1RatioDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenMaxDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenMaxDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenMaxDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  maxDivN1: number;
  maxDivN2: number;
  maxDivMadPool: number;
  maxDivBandwidth: number;
  maxDivGridLo: number;
  maxDivGridHi: number;
  maxDivGridDx: number;
  maxDivGridK: number;
  /** Sup-norm L^infinity pmf-gap maxDiv = max_k |p_k - q_k| in [0, 1]. */
  maxDiv: number;
  /** Index k* in [0, K-1] of the bucket attaining the max (smallest such k). */
  argMaxBucketIndex: number;
  /** Token-volume coordinate at the worst bucket: g_lo + k* * dx. */
  argMaxBucketX: number;
  /** pmf mass p_{k*} at the worst bucket. */
  argMaxPK: number;
  /** pmf mass q_{k*} at the worst bucket. */
  argMaxQK: number;
  /** +1 if p_{k*} > q_{k*}, -1 if p_{k*} < q_{k*}, 0 if equal. */
  argMaxSign: number;
  /** Total-variation distance tvDist = 0.5*sum_k |p_k - q_k| (axis-127 statistic). */
  tvDist: number;
  /** Sparsity-of-disagreement diagnostic: maxDiv / tvDist in [1/K, 1]; 0 when tvDist === 0. */
  maxDivLinfL1Ratio: number;
}

export interface DailyTokenMaxDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenMaxDivergenceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  gridK: number;
  silvermanMultiplier: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenMaxDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129/130/131/132). */
export const MAXDIV_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier (matches axes 126/127/128/129/130/131/132). */
export const MAXDIV_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const MAXDIV_GRID_EXTENSION_H = 3;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function gaussianPdf(u: number): number {
  return Math.exp(-0.5 * u * u) / SQRT_2PI;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  if (n % 2 === 1) return sorted[mid]!;
  return 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * KDE-smoothed sup-norm (L^infinity) divergence between halves of a real series.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - maxDiv(x + c) === maxDiv(x) for any constant c (translation).
 *   - maxDiv(k*x) === maxDiv(x) for any k > 0 (positive scale).
 *   - maxDiv >= 0; maxDiv === 0 iff p === q on the grid.
 *   - maxDiv in [0, 1].
 *   - Symmetric: swapping the two halves preserves maxDiv (and tvDist),
 *     flips argMaxSign.
 *   - argMaxBucketIndex is the SMALLEST attaining index (deterministic
 *     tie-break for the all-equal pathology).
 *   - Holder ordering: maxDiv <= 2*tvDist and maxDiv >= (2/K)*tvDist.
 */
export function dailyTokenMaxDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  maxDivN1: number;
  maxDivN2: number;
  maxDivMadPool: number;
  maxDivBandwidth: number;
  maxDivGridLo: number;
  maxDivGridHi: number;
  maxDivGridDx: number;
  maxDivGridK: number;
  maxDiv: number;
  argMaxBucketIndex: number;
  argMaxBucketX: number;
  argMaxPK: number;
  argMaxQK: number;
  argMaxSign: number;
  tvDist: number;
  maxDivLinfL1Ratio: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenMaxDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenMaxDivergenceHalves requires finite values',
      );
    }
  }

  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenMaxDivergenceHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;
  const A = values.slice(0, n1);
  const B = values.slice(n1);

  const medPool = median(values);
  const absDev: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) absDev[i] = Math.abs(values[i]! - medPool);
  const madPool = 1.4826 * median(absDev);

  let h = MAXDIV_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = MAXDIV_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - MAXDIV_GRID_EXTENSION_H * h;
  const gHi = mx + MAXDIV_GRID_EXTENSION_H * h;
  const K = MAXDIV_GRID_K;
  const dx = (gHi - gLo) / (K - 1);

  const fA: number[] = new Array(K);
  const fB: number[] = new Array(K);
  const invH = 1 / h;
  const invN1H = 1 / (n1 * h);
  const invN2H = 1 / (n2 * h);
  for (let k = 0; k < K; k += 1) {
    const gk = gLo + k * dx;
    let sa = 0;
    for (let i = 0; i < n1; i += 1) {
      sa += gaussianPdf((gk - A[i]!) * invH);
    }
    fA[k] = sa * invN1H;
    let sb = 0;
    for (let i = 0; i < n2; i += 1) {
      sb += gaussianPdf((gk - B[i]!) * invH);
    }
    fB[k] = sb * invN2H;
  }

  const w: number[] = new Array(K);
  for (let k = 0; k < K; k += 1) {
    w[k] = k === 0 || k === K - 1 ? dx / 2 : dx;
  }
  let zA = 0;
  let zB = 0;
  for (let k = 0; k < K; k += 1) {
    zA += w[k]! * fA[k]!;
    zB += w[k]! * fB[k]!;
  }
  if (!(zA > 0) || !(zB > 0) || !Number.isFinite(zA) || !Number.isFinite(zB)) {
    throw new Error(
      `dailyTokenMaxDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  // Single pass: compute |p_k - q_k|, track sup-norm and L^1 (tvDist*2).
  let maxAbsGap = 0;
  let argMaxIdx = 0;
  let sumAbsGap = 0;
  let argMaxPK = 0;
  let argMaxQK = 0;
  for (let k = 0; k < K; k += 1) {
    const pk = (w[k]! * fA[k]!) / zA;
    const qk = (w[k]! * fB[k]!) / zB;
    const gap = pk - qk;
    const absGap = gap < 0 ? -gap : gap;
    sumAbsGap += absGap;
    if (absGap > maxAbsGap) {
      maxAbsGap = absGap;
      argMaxIdx = k;
      argMaxPK = pk;
      argMaxQK = qk;
    }
  }
  const tvDist = 0.5 * sumAbsGap;
  const maxDiv = maxAbsGap;
  const argMaxBucketX = gLo + argMaxIdx * dx;
  const argMaxSign =
    argMaxPK > argMaxQK ? 1 : argMaxPK < argMaxQK ? -1 : 0;
  const maxDivLinfL1Ratio = tvDist > 0 ? maxDiv / tvDist : 0;

  if (
    !Number.isFinite(maxDiv) ||
    !Number.isFinite(tvDist) ||
    !Number.isFinite(maxDivLinfL1Ratio)
  ) {
    throw new Error(
      `dailyTokenMaxDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    maxDivN1: n1,
    maxDivN2: n2,
    maxDivMadPool: madPool,
    maxDivBandwidth: h,
    maxDivGridLo: gLo,
    maxDivGridHi: gHi,
    maxDivGridDx: dx,
    maxDivGridK: K,
    maxDiv,
    argMaxBucketIndex: argMaxIdx,
    argMaxBucketX,
    argMaxPK,
    argMaxQK,
    argMaxSign,
    tvDist,
    maxDivLinfL1Ratio,
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

export function buildDailyTokenMaxDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenMaxDivergenceHalvesOptions = {},
): DailyTokenMaxDivergenceHalvesReport {
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
  const sort: DailyTokenMaxDivergenceHalvesSort =
    opts.sort ?? 'maxDivDesc';
  const validSorts: DailyTokenMaxDivergenceHalvesSort[] = [
    'maxDiv',
    'maxDivDesc',
    'maxDivLinfL1Ratio',
    'maxDivLinfL1RatioDesc',
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
  const rows: DailyTokenMaxDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenMaxDivergenceHalves(filled);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('zero centred variance') || msg.includes('KDE mass')) {
        droppedZeroVariance += 1;
      } else {
        droppedNonFiniteFit += 1;
      }
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
      maxDivN1: result.maxDivN1,
      maxDivN2: result.maxDivN2,
      maxDivMadPool: result.maxDivMadPool,
      maxDivBandwidth: result.maxDivBandwidth,
      maxDivGridLo: result.maxDivGridLo,
      maxDivGridHi: result.maxDivGridHi,
      maxDivGridDx: result.maxDivGridDx,
      maxDivGridK: result.maxDivGridK,
      maxDiv: result.maxDiv,
      argMaxBucketIndex: result.argMaxBucketIndex,
      argMaxBucketX: result.argMaxBucketX,
      argMaxPK: result.argMaxPK,
      argMaxQK: result.argMaxQK,
      argMaxSign: result.argMaxSign,
      tvDist: result.tvDist,
      maxDivLinfL1Ratio: result.maxDivLinfL1Ratio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'maxDiv':
        primary = a.maxDiv - b.maxDiv;
        break;
      case 'maxDivDesc':
        primary = b.maxDiv - a.maxDiv;
        break;
      case 'maxDivLinfL1Ratio':
        primary = a.maxDivLinfL1Ratio - b.maxDivLinfL1Ratio;
        break;
      case 'maxDivLinfL1RatioDesc':
        primary = b.maxDivLinfL1Ratio - a.maxDivLinfL1Ratio;
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
    gridK: MAXDIV_GRID_K,
    silvermanMultiplier: MAXDIV_SILVERMAN_MULTIPLIER,
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
