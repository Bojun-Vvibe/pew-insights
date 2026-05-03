/**
 * daily-token-clark-distance-halves: per-source
 * KDE-SMOOTHED CLARK DISTANCE between the FIRST and SECOND
 * half of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into halves
 *
 *     A = x[0..n1-1]      with n1 = floor(n/2)
 *     B = x[n1..n-1]      with n2 = n - n1
 *
 * Pooled robust scale (population MAD around the pooled
 * median; identical recipe to axes 126/127/128/129/130/131/
 * 132/133/134 for direct comparability of bandwidth):
 *
 *     med_pool = median(x)
 *     mad_pool = 1.4826 * median( |x - med_pool| )
 *
 * Bandwidth h is Silverman's rule of thumb on the POOLED
 * sample with the robust scale:
 *
 *     h = 0.9 * mad_pool * n^(-1/5)
 *
 * Shared evaluation grid. K = 257 equally-spaced grid points
 * over the pooled support extended by 3*h on each side; pmfs
 * p, q are obtained by Gaussian KDE per half then trapezoidal
 * mass-normalisation. (Bit-exact same setup as axes 126-134.)
 *
 * CLARK DISTANCE (Clark 1952; Deza & Deza 2009):
 *
 *     Clark(p, q) = sqrt( sum_k  ( (p_k - q_k) / (p_k + q_k) )^2 )
 *
 * Range: [0, sqrt(K)]. Zero iff p === q on the grid.
 * Equals sqrt(K) iff at every bin EXACTLY one of p_k, q_k
 * is zero (perfectly disjoint supports).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-134:
 *
 *   - Class. NORMALISED L^2 of the pmf gap. The summand is
 *     the SQUARE of the per-bin RELATIVE gap (p-q)/(p+q),
 *     NOT the gap itself. Every shipped half-vs-half axis
 *     uses ABSOLUTE pmf gap (TV: |p-q|; H: |sqrt(p)-sqrt(q)|;
 *     Wasserstein: integrated cdf gap; psChi2: (p-q)^2*(p+q)/(p*q);
 *     triangular: (p-q)^2/(p+q); maxDiv: max|p-q|; JSD/Bhatt/
 *     Jeffreys: log(p/m) etc.) Clark is the ONLY one whose
 *     summand is bin-wise NORMALISED to the [-1, 1] interval
 *     BEFORE squaring.
 *
 *   - vs axis-129 triangular-discrim Delta = sum_k (p-q)^2/(p+q):
 *     Delta has weight 1/(p+q) MULTIPLYING (p-q)^2. Clark has
 *     weight 1/(p+q)^2 MULTIPLYING (p-q)^2 inside the sqrt.
 *     One extra factor of 1/(p+q) makes Clark MUCH MORE
 *     sensitive to disagreement at low base-rate bins than
 *     Delta — a low-mass bin with the same |p-q| contributes
 *     1/(p+q) more to Clark^2 than to Delta. Clark is BOUNDED
 *     in [0, sqrt(K)], Delta is BOUNDED in [0, 2].
 *
 *   - vs axis-134 psChi2 = sum_k (p-q)^2*(p+q)/(p*q): psChi2
 *     UP-weights low-mass bins by 1/(p*q); Clark up-weights
 *     them by 1/(p+q)^2. For two bins with EQUAL p+q but
 *     DIFFERENT split (e.g. p=ε,q=p+q-ε vs p=q=(p+q)/2), psChi2
 *     amplifies the asymmetric split by 1/(εq); Clark sees
 *     them identically in the denominator (same p+q) — Clark
 *     reads the RELATIVE gap, psChi2 reads the ASYMMETRY of
 *     the split. Different selectivity profile.
 *
 *   - vs axis-127 TV = 0.5*sum_k |p-q|: TV is unweighted L^1.
 *     Clark is weighted L^2 with NORMALISER 1/(p+q)^2 inside
 *     the square. A bin with p=0.5, q=0.5 contributes 0 to
 *     both. A bin with p=1e-6, q=2e-6 contributes ~1e-6 to TV
 *     but ~1/3 to Clark^2 (relative gap 1/3). Clark sees
 *     proportional differences invisible to TV.
 *
 *   - vs axis-133 maxDiv (sup-norm): maxDiv is L^infinity of
 *     the absolute gap. Clark is L^2 of the RELATIVE gap. A
 *     bin with p=1e-9, q=1e-3 has absolute gap ~1e-3 (small
 *     for maxDiv) but relative gap ~1 (saturates Clark
 *     summand). Diametrically opposite tail policies.
 *
 *   - vs LOG functionals (JSD/Bhattacharyya/Jeffreys/Renyi):
 *     LOG functionals are bounded in slope at p,q -> 0 (log
 *     diverges only logarithmically). Clark is BOUNDED at
 *     p,q -> 0 because the per-bin summand is in [0, 1].
 *     Clark is BOUNDED while psChi2 (axis-134) is unbounded
 *     and JSD is bounded by log(2) — different boundedness
 *     regime entirely (Clark ceiling = sqrt(K) = sqrt(257)
 *     ~ 16.03 grows with grid resolution, NOT with data).
 *
 * NUMERICAL FLOOR. The denominator p_k + q_k can underflow
 * to exactly zero in IEEE-754 only at extreme tail bins
 * where Gaussian KDE evaluates below 1e-308. To make the
 * ratio well-defined we apply the SAME PMF_FLOOR = 1e-15 as
 * axis-134 (psChi2), preserving cross-axis numerical
 * comparability. The floor is a no-op for any genuine KDE
 * pmf (Gaussian KDE with positive bandwidth on a 257-point
 * grid puts strictly positive mass everywhere, typically
 * >> 1e-15).
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     clarkDistance     = sqrt(sum_k r_k^2)            in [0, sqrt(K)]
 *     clarkNormalised   = clarkDistance / sqrt(K)      in [0, 1]
 *     clarkMeanRelGap   = (1/K) * sum_k |r_k|          in [0, 1]
 *     clarkMaxRelGap    = max_k |r_k|                  in [0, 1]
 *
 * where r_k = (p_k - q_k) / (p_k + q_k) is the per-bin
 * relative gap. clarkNormalised is the cross-grid-comparable
 * form (rescaled to [0, 1] regardless of K). clarkMaxRelGap
 * is the L^infinity counterpart of the same per-bin
 * normalised quantity — flags whether the divergence comes
 * from ONE bin saturating to ~1 (regime-disjointness) or
 * MANY bins contributing modestly.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the CLARK DISTANCE
 *   Clark = sqrt(sum_k ((p_k-q_k)/(p_k+q_k))^2),
 *   how strong is the half-vs-half drift WHEN EACH BIN'S
 *   DISAGREEMENT IS NORMALISED TO ITS LOCAL TOTAL MASS
 *   (so a small absolute gap at a low-mass bin counts
 *   as much as a large absolute gap at a high-mass bin)?"**
 *
 * References:
 *   Clark, P. J. (1952). "An extension of the coefficient of
 *     divergence for use with multiple characters", Copeia
 *     1952(2), 61-64.
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 24.
 *   Deza, M. M. & Deza, E. (2009). "Encyclopedia of
 *     Distances", Springer.
 *
 * Caveats:
 *
 *   - Clark distance ceiling sqrt(K) depends on grid
 *     resolution; use clarkNormalised for cross-grid
 *     comparability. Within this codebase K is fixed at 257
 *     for ALL axes 126-135 so cross-source comparison of
 *     raw clarkDistance is unambiguous.
 *   - Clark distance does NOT satisfy the triangle
 *     inequality and is not a metric (Cha 2007); it is a
 *     divergence. Symmetric under swap of p, q.
 *   - PMF_FLOOR = 1e-15 is a numerical safeguard, not a
 *     statistical regulariser. Gaussian KDE with positive
 *     bandwidth on a 257-point grid puts strictly positive
 *     mass everywhere; floor is exercised only under
 *     IEEE-754 underflow at extreme tail bins.
 *   - Translation- AND positive-scale-invariant in the data
 *     (data and bandwidth scale together; pmfs unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-clark-distance-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-clark-distance-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Clark distance ascending:
 *   pew-insights daily-token-clark-distance-halves --sort clark
 */
import type { QueueLine } from './types.js';

export type DailyTokenClarkDistanceHalvesSort =
  | 'clark'
  | 'clarkDesc'
  | 'maxRel'
  | 'maxRelDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenClarkDistanceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenClarkDistanceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenClarkDistanceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  clarkN1: number;
  clarkN2: number;
  clarkMadPool: number;
  clarkBandwidth: number;
  clarkGridLo: number;
  clarkGridHi: number;
  clarkGridDx: number;
  clarkGridK: number;
  /** Clark distance sqrt(sum_k ((p_k-q_k)/(p_k+q_k))^2) in [0, sqrt(K)]. */
  clarkDistance: number;
  /** clarkDistance / sqrt(K) in [0, 1] (cross-grid-comparable). */
  clarkNormalised: number;
  /** (1/K)*sum_k |r_k| where r_k = (p_k-q_k)/(p_k+q_k) in [0, 1]. */
  clarkMeanRelGap: number;
  /** max_k |r_k| in [0, 1]; saturates iff one bin is regime-disjoint. */
  clarkMaxRelGap: number;
  /**
   * Spread diagnostic clarkDistance / (sqrt(K) * clarkMaxRelGap) in [0, 1].
   * Approaches 1 iff the per-bin relative gaps are uniformly large across
   * the grid (broad, evenly-spread disagreement); approaches 0 iff the
   * Clark mass is concentrated in a small number of saturated bins
   * (sparse disagreement). Defined as 0 when clarkMaxRelGap === 0
   * (vacuous case where halves coincide). Cross-source-comparable:
   * INDEPENDENT of overall divergence magnitude — disambiguates whether
   * a high Clark distance comes from MANY moderately-disagreeing bins
   * or FEW saturated bins, complementing the maxRel sup-norm view.
   */
  clarkSpreadRatio: number;
}

export interface DailyTokenClarkDistanceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenClarkDistanceHalvesSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  gridK: number;
  silvermanMultiplier: number;
  pmfFloor: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenClarkDistanceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129/130/131/132/133/134). */
export const CLARK_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const CLARK_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const CLARK_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins for the (p+q) denominator. */
export const CLARK_PMF_FLOOR = 1e-15;

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
 * KDE-smoothed Clark distance between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - clarkDistance(x + c) === clarkDistance(x) for any c (translation).
 *   - clarkDistance(k*x) === clarkDistance(x) for any k > 0 (scale).
 *   - 0 <= clarkDistance <= sqrt(K).
 *   - clarkDistance === 0 iff p === q on the grid.
 *   - Symmetric: swapping the two halves preserves clarkDistance.
 *   - clarkNormalised === clarkDistance / sqrt(K) in [0, 1].
 *   - clarkMaxRelGap in [0, 1] and >= clarkMeanRelGap.
 */
export function dailyTokenClarkDistanceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  clarkN1: number;
  clarkN2: number;
  clarkMadPool: number;
  clarkBandwidth: number;
  clarkGridLo: number;
  clarkGridHi: number;
  clarkGridDx: number;
  clarkGridK: number;
  clarkDistance: number;
  clarkNormalised: number;
  clarkMeanRelGap: number;
  clarkMaxRelGap: number;
  clarkSpreadRatio: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenClarkDistanceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenClarkDistanceHalves requires finite values');
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
      `dailyTokenClarkDistanceHalves: zero centred variance (n=${n})`,
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

  let h = CLARK_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = CLARK_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - CLARK_GRID_EXTENSION_H * h;
  const gHi = mx + CLARK_GRID_EXTENSION_H * h;
  const K = CLARK_GRID_K;
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
      `dailyTokenClarkDistanceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sumSq = 0;
  let sumAbs = 0;
  let maxAbs = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < CLARK_PMF_FLOOR) pk = CLARK_PMF_FLOOR;
    if (qk < CLARK_PMF_FLOOR) qk = CLARK_PMF_FLOOR;
    const denomBin = pk + qk;
    const r = (pk - qk) / denomBin;
    const ar = Math.abs(r);
    sumSq += r * r;
    sumAbs += ar;
    if (ar > maxAbs) maxAbs = ar;
  }

  const clarkDistance = Math.sqrt(sumSq);
  const clarkNormalised = clarkDistance / Math.sqrt(K);
  const clarkMeanRelGap = sumAbs / K;
  const clarkMaxRelGap = maxAbs;
  const clarkSpreadRatio =
    clarkMaxRelGap > 0 ? clarkDistance / (Math.sqrt(K) * clarkMaxRelGap) : 0;

  if (
    !Number.isFinite(clarkDistance) ||
    !Number.isFinite(clarkNormalised) ||
    !Number.isFinite(clarkMeanRelGap) ||
    !Number.isFinite(clarkMaxRelGap) ||
    !Number.isFinite(clarkSpreadRatio)
  ) {
    throw new Error(
      `dailyTokenClarkDistanceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    clarkN1: n1,
    clarkN2: n2,
    clarkMadPool: madPool,
    clarkBandwidth: h,
    clarkGridLo: gLo,
    clarkGridHi: gHi,
    clarkGridDx: dx,
    clarkGridK: K,
    clarkDistance,
    clarkNormalised,
    clarkMeanRelGap,
    clarkMaxRelGap,
    clarkSpreadRatio,
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

export function buildDailyTokenClarkDistanceHalves(
  queue: QueueLine[],
  opts: DailyTokenClarkDistanceHalvesOptions = {},
): DailyTokenClarkDistanceHalvesReport {
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
  const sort: DailyTokenClarkDistanceHalvesSort = opts.sort ?? 'clarkDesc';
  const validSorts: DailyTokenClarkDistanceHalvesSort[] = [
    'clark',
    'clarkDesc',
    'maxRel',
    'maxRelDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
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
  const rows: DailyTokenClarkDistanceHalvesSourceRow[] = [];

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
      result = dailyTokenClarkDistanceHalves(filled);
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
      clarkN1: result.clarkN1,
      clarkN2: result.clarkN2,
      clarkMadPool: result.clarkMadPool,
      clarkBandwidth: result.clarkBandwidth,
      clarkGridLo: result.clarkGridLo,
      clarkGridHi: result.clarkGridHi,
      clarkGridDx: result.clarkGridDx,
      clarkGridK: result.clarkGridK,
      clarkDistance: result.clarkDistance,
      clarkNormalised: result.clarkNormalised,
      clarkMeanRelGap: result.clarkMeanRelGap,
      clarkMaxRelGap: result.clarkMaxRelGap,
      clarkSpreadRatio: result.clarkSpreadRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'clark':
        primary = a.clarkDistance - b.clarkDistance;
        break;
      case 'clarkDesc':
        primary = b.clarkDistance - a.clarkDistance;
        break;
      case 'maxRel':
        primary = a.clarkMaxRelGap - b.clarkMaxRelGap;
        break;
      case 'maxRelDesc':
        primary = b.clarkMaxRelGap - a.clarkMaxRelGap;
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
    gridK: CLARK_GRID_K,
    silvermanMultiplier: CLARK_SILVERMAN_MULTIPLIER,
    pmfFloor: CLARK_PMF_FLOOR,
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
