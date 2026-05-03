/**
 * daily-token-symmetric-chi-squared-halves: per-source
 * KDE-SMOOTHED ADDITIVE SYMMETRIC CHI-SQUARED divergence
 * between the FIRST and SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-FOURTH cross-source axis.
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
 * 132/133 for direct comparability of bandwidth):
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
 * mass-normalisation. (Bit-exact same setup as axes 126-133.)
 *
 * ADDITIVE SYMMETRIC CHI-SQUARED (Cha 2007, eq. 33):
 *
 *     psChi2(p, q) = sum_k  (p_k - q_k)^2 * (p_k + q_k)
 *                          --------------------------------
 *                                 p_k * q_k
 *
 * Equivalent to the SUM of forward and reverse Pearson
 * chi-squared divergences:
 *
 *     psChi2(p, q) = chi2(p || q)  +  chi2(q || p)
 *                  = sum (p-q)^2/q  +  sum (p-q)^2/p
 *
 * which makes it a FULL symmetric extension of the Pearson
 * chi-squared statistic. Range: [0, +inf). Zero iff p === q
 * on the grid. Heavy-tailed behaviour: amplifies bin ratios
 * where ONE distribution has near-zero mass while the other
 * has finite mass; the (1/p_k + 1/q_k) weighting punishes
 * disagreement in low-probability bins MUCH more harshly
 * than TV (axis-127), Hellinger (axis-128) or Bhattacharyya
 * (axis-130). This is the OPPOSITE selectivity profile from
 * sup-norm maxDiv (axis-133) which only sees the worst
 * absolute gap and is INSENSITIVE to base-rate.
 *
 * NUMERICAL FLOOR. To make the (1/p_k + 1/q_k) term
 * well-defined under finite KDE smoothing on a 257-point
 * grid, we floor each pmf bin at
 *
 *     PMF_FLOOR = 1e-15
 *
 * before forming the per-bin ratio. This is a no-op for
 * any genuine KDE pmf (Gaussian KDE with positive bandwidth
 * gives strictly positive pmf at every bin, typically
 * >> 1e-15) and exists ONLY to immunise against IEEE-754
 * underflow in pathological tail-bins. The floor preserves
 * the symmetric chi-squared identity to 12+ decimal places
 * on every observed real-data row.
 *
 * RELATED DECOMPOSITIONS exposed as diagnostics:
 *
 *     pearsonForward = sum_k (p_k - q_k)^2 / q_k
 *     pearsonReverse = sum_k (p_k - q_k)^2 / p_k
 *     psChi2         = pearsonForward + pearsonReverse
 *     pearsonAsymmetryRatio = max(F, R) / min(F, R)   in [1, +inf)
 *
 * pearsonAsymmetryRatio === 1 iff the two pmfs disagree
 * symmetrically across the grid; large values flag that ONE
 * direction (forward p->q or reverse q->p) carries most of
 * the divergence — i.e. one half has tail mass the other
 * does not. This is genuinely new diagnostic content not
 * available from any prior axis (TV, H, JSD, Bhattacharyya
 * all collapse the directional asymmetry; KL-style
 * functionals expose it but are not in the shipped set).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-133:
 *
 *   - Class. RECIPROCAL-WEIGHTED L^2 of the pmf gap. Unique:
 *     the ONLY shipped half-vs-half axis whose summand has
 *     an INVERSE pmf factor. All previously shipped axes
 *     are L^p (p in {1, 2, infinity}) of the pmf gap with
 *     either UNIFORM weights (TV, maxDiv), SQRT-amplitude
 *     weights (H), RECIPROCAL-SUM weights (Delta /
 *     triangular-discrim, weight 1/(p+q)), or LOG functionals
 *     (JSD, Bhattacharyya, Jeffreys, Renyi-2). Symmetric
 *     chi-squared is the ONLY one with weight (p+q)/(p*q).
 *
 *   - vs axis-127 TV: TV is L^1 of |p-q| with uniform
 *     weight. psChi2 is L^2 of |p-q| with weight
 *     (p+q)/(p*q). Different norms AND different weights.
 *
 *   - vs axis-128 Hellinger: H = sqrt(0.5*sum(sqrt(p)-sqrt(q))^2)
 *     is L^2 in SQRT-amplitude with uniform weight. psChi2
 *     is L^2 in linear amplitude with reciprocal weight.
 *
 *   - vs axis-129 Delta (triangular-discrim): weight
 *     1/(p+q) (HARMONIC of bin masses) vs psChi2 weight
 *     (p+q)/(p*q) (HARMONIC of bin RATIOS). Both symmetric
 *     L^2 of the gap, but Delta is BOUNDED in [0, 2]
 *     while psChi2 is UNBOUNDED above; Delta down-weights
 *     low-mass bins, psChi2 UP-weights them. Diametrically
 *     opposite tail sensitivity.
 *
 *   - vs axis-133 maxDiv (sup-norm): maxDiv only sees the
 *     single worst absolute gap, blind to base-rate. psChi2
 *     sees ALL bins weighted by inverse base-rate. A
 *     low-base-rate bin with the same |p-q| contributes
 *     1/p + 1/q times more to psChi2 than to maxDiv.
 *
 *   - vs LOG functionals (JSD/Bhattacharyya/Jeffreys/Renyi):
 *     LOG functionals are bounded in slope at p,q -> 0
 *     (log diverges only logarithmically); psChi2 is
 *     POLYNOMIALLY divergent (1/p, 1/q). Different tail
 *     amplification regime entirely.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the SYMMETRIC CHI-SQUARED divergence
 *   psChi2 = sum_k (p_k-q_k)^2 (p_k+q_k)/(p_k q_k),
 *   how strong is the half-vs-half drift WHEN
 *   LOW-PROBABILITY TOKEN-VOLUME REGIMES ARE WEIGHTED
 *   HEAVILY, and is that drift symmetric (forward Pearson
 *   ~ reverse Pearson) or directional (one half has
 *   tail mass the other does not)?"**
 *
 * References:
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 33.
 *   Pearson, K. (1900). "On the criterion that a given
 *     system of deviations from the probable [...]",
 *     Phil. Mag. 50.
 *   Liese, F. and Vajda, I. (2006). "On Divergences and
 *     Informations in Statistics and Information Theory",
 *     IEEE Trans. Inf. Theory 52(10).
 *
 * Caveats:
 *
 *   - psChi2 is unbounded above; large values flag that
 *     one half visits a token-volume regime the other half
 *     never does.
 *   - PMF_FLOOR = 1e-15 is a numerical safeguard, not a
 *     statistical regulariser. Gaussian KDE with positive
 *     bandwidth on a 257-point grid puts strictly positive
 *     mass everywhere; floor is exercised only under
 *     IEEE-754 underflow at extreme tail bins.
 *   - pearsonAsymmetryRatio is undefined (set to 1) when
 *     both pearsonForward and pearsonReverse are zero.
 *   - Translation- AND positive-scale-invariant in the data
 *     (data and bandwidth scale together; pmfs unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-symmetric-chi-squared-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-symmetric-chi-squared-halves \
 *     --source vscode-other --json
 *
 *   # Sort by symmetric chi-squared ascending:
 *   pew-insights daily-token-symmetric-chi-squared-halves \
 *     --sort psChi2
 */
import type { QueueLine } from './types.js';

export type DailyTokenSymmetricChiSquaredHalvesSort =
  | 'psChi2'
  | 'psChi2Desc'
  | 'asymmetry'
  | 'asymmetryDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenSymmetricChiSquaredHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenSymmetricChiSquaredHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenSymmetricChiSquaredHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  psChiN1: number;
  psChiN2: number;
  psChiMadPool: number;
  psChiBandwidth: number;
  psChiGridLo: number;
  psChiGridHi: number;
  psChiGridDx: number;
  psChiGridK: number;
  /** Symmetric chi-squared divergence sum_k (p_k-q_k)^2 (p_k+q_k)/(p_k q_k) in [0, +inf). */
  psChi2: number;
  /** Forward Pearson chi-squared sum_k (p_k-q_k)^2/q_k in [0, +inf). */
  pearsonForward: number;
  /** Reverse Pearson chi-squared sum_k (p_k-q_k)^2/p_k in [0, +inf). */
  pearsonReverse: number;
  /** max(F, R) / min(F, R) in [1, +inf); 1 when both zero. */
  pearsonAsymmetryRatio: number;
}

export interface DailyTokenSymmetricChiSquaredHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenSymmetricChiSquaredHalvesSort;
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
  sources: DailyTokenSymmetricChiSquaredHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129/130/131/132/133). */
export const PSCHI_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const PSCHI_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const PSCHI_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins for the (1/p, 1/q) factors. */
export const PSCHI_PMF_FLOOR = 1e-15;

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
 * KDE-smoothed additive symmetric chi-squared divergence between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - psChi2(x + c) === psChi2(x) for any constant c (translation).
 *   - psChi2(k*x) === psChi2(x) for any k > 0 (positive scale).
 *   - psChi2 >= 0; psChi2 === 0 iff p === q on the grid.
 *   - psChi2 === pearsonForward + pearsonReverse (additive identity).
 *   - Symmetric: swapping the two halves preserves psChi2 and swaps
 *     pearsonForward <-> pearsonReverse (asymmetry ratio unchanged).
 *   - pearsonAsymmetryRatio in [1, +inf), == 1 when forward == reverse.
 */
export function dailyTokenSymmetricChiSquaredHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  psChiN1: number;
  psChiN2: number;
  psChiMadPool: number;
  psChiBandwidth: number;
  psChiGridLo: number;
  psChiGridHi: number;
  psChiGridDx: number;
  psChiGridK: number;
  psChi2: number;
  pearsonForward: number;
  pearsonReverse: number;
  pearsonAsymmetryRatio: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenSymmetricChiSquaredHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenSymmetricChiSquaredHalves requires finite values',
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
      `dailyTokenSymmetricChiSquaredHalves: zero centred variance (n=${n})`,
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

  let h = PSCHI_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = PSCHI_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - PSCHI_GRID_EXTENSION_H * h;
  const gHi = mx + PSCHI_GRID_EXTENSION_H * h;
  const K = PSCHI_GRID_K;
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
      `dailyTokenSymmetricChiSquaredHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let pearsonForward = 0;
  let pearsonReverse = 0;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < PSCHI_PMF_FLOOR) pk = PSCHI_PMF_FLOOR;
    if (qk < PSCHI_PMF_FLOOR) qk = PSCHI_PMF_FLOOR;
    const gap = pk - qk;
    const sq = gap * gap;
    pearsonForward += sq / qk;
    pearsonReverse += sq / pk;
  }
  const psChi2 = pearsonForward + pearsonReverse;

  let pearsonAsymmetryRatio: number;
  if (pearsonForward === 0 && pearsonReverse === 0) {
    pearsonAsymmetryRatio = 1;
  } else {
    const lo = Math.min(pearsonForward, pearsonReverse);
    const hi = Math.max(pearsonForward, pearsonReverse);
    pearsonAsymmetryRatio = lo > 0 ? hi / lo : Number.POSITIVE_INFINITY;
  }

  if (
    !Number.isFinite(psChi2) ||
    !Number.isFinite(pearsonForward) ||
    !Number.isFinite(pearsonReverse)
  ) {
    throw new Error(
      `dailyTokenSymmetricChiSquaredHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    psChiN1: n1,
    psChiN2: n2,
    psChiMadPool: madPool,
    psChiBandwidth: h,
    psChiGridLo: gLo,
    psChiGridHi: gHi,
    psChiGridDx: dx,
    psChiGridK: K,
    psChi2,
    pearsonForward,
    pearsonReverse,
    pearsonAsymmetryRatio,
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

export function buildDailyTokenSymmetricChiSquaredHalves(
  queue: QueueLine[],
  opts: DailyTokenSymmetricChiSquaredHalvesOptions = {},
): DailyTokenSymmetricChiSquaredHalvesReport {
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
  const sort: DailyTokenSymmetricChiSquaredHalvesSort = opts.sort ?? 'psChi2Desc';
  const validSorts: DailyTokenSymmetricChiSquaredHalvesSort[] = [
    'psChi2',
    'psChi2Desc',
    'asymmetry',
    'asymmetryDesc',
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
  const rows: DailyTokenSymmetricChiSquaredHalvesSourceRow[] = [];

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
      result = dailyTokenSymmetricChiSquaredHalves(filled);
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
      psChiN1: result.psChiN1,
      psChiN2: result.psChiN2,
      psChiMadPool: result.psChiMadPool,
      psChiBandwidth: result.psChiBandwidth,
      psChiGridLo: result.psChiGridLo,
      psChiGridHi: result.psChiGridHi,
      psChiGridDx: result.psChiGridDx,
      psChiGridK: result.psChiGridK,
      psChi2: result.psChi2,
      pearsonForward: result.pearsonForward,
      pearsonReverse: result.pearsonReverse,
      pearsonAsymmetryRatio: result.pearsonAsymmetryRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'psChi2':
        primary = a.psChi2 - b.psChi2;
        break;
      case 'psChi2Desc':
        primary = b.psChi2 - a.psChi2;
        break;
      case 'asymmetry':
        primary = a.pearsonAsymmetryRatio - b.pearsonAsymmetryRatio;
        break;
      case 'asymmetryDesc':
        primary = b.pearsonAsymmetryRatio - a.pearsonAsymmetryRatio;
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
    gridK: PSCHI_GRID_K,
    silvermanMultiplier: PSCHI_SILVERMAN_MULTIPLIER,
    pmfFloor: PSCHI_PMF_FLOOR,
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
