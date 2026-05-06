/**
 * daily-token-inoue-copula-df-sup-empirical-copula-changepoint:
 * per-source EMPIRICAL-COPULA / JOINT-RANK-CDF SUP-DEVIATION
 * changepoint detector on a (lag-0, lag-1) bivariate
 * embedding of the gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-THIRTY-FIRST cross-source axis (axis-231).
 *
 * Mechanism. Inoue, A. (2001), "Testing for distributional
 * change in time series", *Econometric Theory* 17(1):
 * 156-187. Inoue (2001) tests the null of a CONSTANT
 * MULTIVARIATE DISTRIBUTION against the alternative of a
 * single SHIFT in the joint distribution, using a CUSUM-
 * style sup deviation between the EMPIRICAL JOINT CDF on
 * the prefix [1..k] and on the suffix [k+1..n]. Because
 * direct joint CDFs are scale-dependent, we instead apply
 * Inoue's test to the EMPIRICAL COPULA (joint CDF of the
 * pseudo-observations U_t = (R_t / (n+1)) on each margin),
 * which is invariant to strictly monotone marginal
 * transformations (Sklar's theorem). The resulting
 * statistic detects changes in the DEPENDENCE STRUCTURE
 * (Kendall-tau, tail behaviour, copula family) rather than
 * in the marginals.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total
 * tokens series for one source (n >= 21). Build the
 * (lag-0, lag-1) BIVARIATE EMBEDDING
 *
 *   v_t = (x_t, x_{t-1}),  t = 1..n-1                 (1)
 *
 * giving N = n - 1 bivariate vectors. Convert each margin
 * to PSEUDO-OBSERVATIONS via the EMPIRICAL CDF of the
 * column (full-sample ranks):
 *
 *   U_t,1 = R_{t,1} / (N + 1),  U_t,2 = R_{t,2} / (N + 1) (2)
 *
 * where R_{t,j} is the rank of v_{t,j} within the j-th
 * column (ties broken by average rank). Pseudo-observations
 * are uniform on [0,1] and INVARIANT to strictly monotone
 * marginal transformations.
 *
 * Empirical copula at split k. Define
 *
 *   C_k(u,v)   = (1/k) sum_{t=1..k}  1{U_t,1<=u, U_t,2<=v} (3)
 *   C_n-k(u,v) = (1/(N-k)) sum_{t=k+1..N} 1{U_t,1<=u, U_t,2<=v} (4)
 *
 * Inoue's joint-CDF CUSUM sup statistic adapted to the
 * copula domain:
 *
 *   D_k = sqrt(k(N-k)/N) * sup_{(u,v)}|C_k(u,v) - C_n-k(u,v)| (5)
 *
 * The sup is attained on the GRID of pseudo-observations
 * {(U_t,1, U_t,2) : t=1..N} since the indicators are
 * step functions, so we evaluate (5) only on that finite
 * grid (O(N^2) per k). The TEST STATISTIC is
 *
 *   D_max = max_{k in [k_min, N - k_min]} D_k          (6)
 *
 * with k_min = max(5, ceil(0.10 N)) (Inoue 2001 §3.2:
 * trim 10% of each end to avoid boundary noise). The
 * BREAK-POINT ESTIMATOR is
 *
 *   tauHat = argmax_{k} D_k                            (7)
 *
 * mapped back to the original day index t = tauHat + 1
 * (the +1 accounts for the lag-1 embedding eating x_0).
 *
 * Calibration. Under H0 of a constant joint distribution
 * (and strong-mixing pseudo-observations), Inoue (2001
 * Thm. 1) shows D_max converges in distribution to the
 * sup of a Gaussian-bridge functional whose 95% quantile
 * is approx 1.358 (the same Kolmogorov-Smirnov-Kuiper-
 * level constant). We use the verdict ladder
 *
 *   verdict = no-shift          if D_max < 1.224 (~90%)
 *           = borderline        if D_max < 1.358 (~95%)
 *           = shift             if D_max < 1.628 (~99%)
 *           = strong-shift      otherwise               (8)
 *
 * Note: tail (8) is conservative — Inoue's exact null
 * limit involves nuisance parameters that vanish under
 * full rank-based pivoting; the cited cutoffs are
 * Kolmogorov approximations and surfaced verbatim so
 * downstream consumers can rescore.
 *
 * Output schema (per-source row):
 *
 *   - dMax: D_max in (5)-(6).
 *   - tauHat: argmax k.
 *   - tauHatDay: ISO YYYY-MM-DD of the change point.
 *   - verdict: one of (8).
 *   - dCurve: full D_k curve (length N - 2 k_min + 1).
 *   - kMin: trim used.
 *   - dPrefix: copula-mass concentration on prefix
 *     (mean of C_tauHat over grid).
 *   - dSuffix: copula-mass concentration on suffix.
 *   - tauTrimRatio: kMin / N.
 *
 * STRUCTURAL ORTHOGONALITY (axis-231 vs axes 181-230).
 *
 * Of the prior 230 cross-source axes NONE is a
 * RANK-INVARIANT EMPIRICAL-COPULA SUP-DEVIATION test on a
 * BIVARIATE LAG EMBEDDING. Axis-231 is orthogonal along
 * five INDEPENDENT dimensions inside the changepoint
 * family:
 *
 *   1. JOINT-DISTRIBUTION not univariate. Axes 153, 154,
 *      155, 221, 222, 223, 224, 225, 227, 228, 229, 230
 *      all act on the UNIVARIATE x_t series (cusum, range,
 *      Pettitt rank, Lombard, Inclan-Tiao, PELT, WBS, ECP,
 *      BOCPD, SSA, spectral CUSUM, NEWMA RFF). Inoue tests
 *      the JOINT distribution of (x_t, x_{t-1}) — a
 *      different mathematical object whose change can
 *      occur even when the marginals are constant.
 *   2. COPULA invariance. By moving to pseudo-observations
 *      U = R/(N+1), the test is INVARIANT under any strictly
 *      monotone marginal transformation. None of axes
 *      181-230 enjoy this invariance: they are tied to a
 *      specific scaling (MAD, sigma, raw tokens, log).
 *   3. EMPIRICAL-CDF / KOLMOGOROV-SUP statistic. The test
 *      is sup_{(u,v)} |C_k - C_{n-k}| — an L_inf functional
 *      on a 2-D probability surface. Axes 226 (ECP) and
 *      230 (NEWMA) are L_2 / energy / L_2-EWMA statistics;
 *      axis-227 (BOCPD) is a posterior probability;
 *      axis-228 (SSA) is a subspace angle; axis-229
 *      (spectral CUSUM) is a frequency-domain partial
 *      sum. The L_inf-on-2-D-CDF dimension is new.
 *   4. RANK-CUSUM lineage but BIVARIATE. Axis-154 (Pettitt)
 *      is a univariate rank CUSUM. Axis-231 generalises
 *      the rank-CUSUM idea to the JOINT-CDF surface — a
 *      strict structural superset that reduces to neither
 *      Pettitt (different statistic) nor Kuiper (no V-shape
 *      pairing).
 *   5. ALARM RULE. The verdict cutoffs (8) come from the
 *      Kolmogorov-bridge limit on the 2-D copula surface,
 *      not from EWMA steady-state SD (axis-230), posterior
 *      argmax (axis-227), Schwarz penalty (axes 224-225),
 *      pairwise energy (axis-226), F-ratio of singular
 *      values (axis-228), or periodogram threshold
 *      (axis-229). The decision rule is functionally
 *      distinct.
 *
 * Refs. Inoue, A. (2001), "Testing for distributional
 * change in time series", *Econometric Theory* 17(1):
 * 156-187; Sklar, A. (1959), "Fonctions de repartition a
 * n dimensions et leurs marges", *Publ. Inst. Statist.
 * Univ. Paris* 8: 229-231; Genest, C. and Favre, A.-C.
 * (2007), "Everything you always wanted to know about
 * copula modeling but were afraid to ask", *J. Hydrologic
 * Eng.* 12(4): 347-368; Csorgo, M. and Horvath, L. (1997),
 * *Limit Theorems in Change-Point Analysis* (Wiley) — the
 * Kolmogorov-bridge calibration.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. RANKS, MEDIAN, UTILS
// =========================================================

/** FNV-1a 32-bit hash of a string (for deterministic tie-breaking). */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Average ranks (1..n) of a numeric array, ties resolved by mean rank.
 * Returns a new array of length xs.length.
 */
export function averageRanks(xs: readonly number[]): number[] {
  const n = xs.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => xs[a]! - xs[b]!);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && xs[idx[j + 1]!]! === xs[idx[i]!]!) j += 1;
    // ties from i..j (inclusive) get average rank
    const mean = (i + j + 2) / 2; // 1-indexed
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = mean;
    }
    i = j + 1;
  }
  return ranks;
}

// =========================================================
// SECTION 2. EMPIRICAL-COPULA D_k SCAN
// =========================================================

export interface InoueCopulaScanResult {
  /** Length: N - 2 * kMin + 1, indexed by k - kMin. */
  dCurve: number[];
  /** D_max over the trimmed range. */
  dMax: number;
  /** Argmax k (in 1..N). */
  tauHat: number;
  /** Mean copula mass on prefix at tauHat (diagnostic). */
  dPrefix: number;
  /** Mean copula mass on suffix at tauHat (diagnostic). */
  dSuffix: number;
  /** Trim used. */
  kMin: number;
}

/**
 * Run Inoue empirical-copula sup-deviation scan on a (u1, u2)
 * pseudo-observation array of length N.
 *
 * Cost: O(N^2) per k due to grid evaluation. We compute
 * cumulative-count tables once and update incrementally to
 * keep total cost O(N^2).
 */
export function inoueCopulaScan(
  u1: readonly number[],
  u2: readonly number[],
  kMinIn?: number,
): InoueCopulaScanResult {
  const N = u1.length;
  if (N !== u2.length) {
    throw new Error(`u1 and u2 length mismatch: ${N} vs ${u2.length}`);
  }
  if (N < 11) {
    throw new Error(`inoueCopulaScan requires N >= 11 (got ${N})`);
  }
  const kMin = kMinIn ?? Math.max(5, Math.ceil(0.1 * N));
  if (!Number.isInteger(kMin) || kMin < 5 || 2 * kMin >= N) {
    throw new Error(`kMin out of range: ${kMin} for N=${N}`);
  }

  // Precompute, for each grid point g = (u1[g], u2[g]) and
  // each prefix length k, the count C_k(u1[g], u2[g]) * k.
  // We do an incremental pass: for k=1..N, add the indicator
  // 1{u1[k-1] <= u1[g] AND u2[k-1] <= u2[g]} for every g.
  //
  // Memory: O(N^2). For N up to ~365 (one year) this is
  // 365*365 = 133225 ints, well within budget.
  const cumCount = new Array<Int32Array>(N + 1);
  cumCount[0] = new Int32Array(N);
  for (let k = 1; k <= N; k += 1) {
    const prev = cumCount[k - 1]!;
    const cur = new Int32Array(N);
    const ux = u1[k - 1]!;
    const uy = u2[k - 1]!;
    for (let g = 0; g < N; g += 1) {
      const inc = ux <= u1[g]! && uy <= u2[g]! ? 1 : 0;
      cur[g] = prev[g]! + inc;
    }
    cumCount[k] = cur;
  }
  const totalCount = cumCount[N]!;

  // For each k in [kMin, N-kMin], compute
  //   D_k = sqrt(k(N-k)/N) * max_g | (cumCount[k][g] / k) - ((totalCount[g] - cumCount[k][g])/(N-k)) |
  const upper = N - kMin;
  const dCurve = new Array<number>(upper - kMin + 1);
  let dMax = -Infinity;
  let tauHat = kMin;
  for (let k = kMin; k <= upper; k += 1) {
    const ck = cumCount[k]!;
    let best = 0;
    const invK = 1 / k;
    const invComp = 1 / (N - k);
    for (let g = 0; g < N; g += 1) {
      const cKg = ck[g]!;
      const rest = totalCount[g]! - cKg;
      const diff = Math.abs(cKg * invK - rest * invComp);
      if (diff > best) best = diff;
    }
    const w = Math.sqrt((k * (N - k)) / N);
    const dk = w * best;
    dCurve[k - kMin] = dk;
    if (dk > dMax) {
      dMax = dk;
      tauHat = k;
    }
  }

  // Diagnostic: mean copula mass on prefix vs suffix at tauHat.
  const ck = cumCount[tauHat]!;
  let sumPrefix = 0;
  let sumSuffix = 0;
  const k = tauHat;
  for (let g = 0; g < N; g += 1) {
    sumPrefix += ck[g]! / k;
    sumSuffix += (totalCount[g]! - ck[g]!) / (N - k);
  }
  return {
    dCurve,
    dMax,
    tauHat,
    dPrefix: sumPrefix / N,
    dSuffix: sumSuffix / N,
    kMin,
  };
}

/** Verdict ladder per Inoue (2001) calibrated against Kolmogorov-bridge constants. */
export function inoueVerdict(
  dMax: number,
): 'no-shift' | 'borderline' | 'shift' | 'strong-shift' {
  if (!Number.isFinite(dMax)) return 'no-shift';
  if (dMax < 1.224) return 'no-shift';
  if (dMax < 1.358) return 'borderline';
  if (dMax < 1.628) return 'shift';
  return 'strong-shift';
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSort =
  | 'dMax'
  | 'dMaxDesc'
  | 'tauHat'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSort;
  /** Optional explicit kMin trim. Default max(5, ceil(0.1 N)). */
  kMin?: number;
  /** Drop rows with verdict == 'no-shift'. */
  onlyShifts?: boolean;
  generatedAt?: string;
}

export interface DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** N = nTenureDays - 1 (lag-1 embedding eats day 0). */
  nEmbedded: number;
  kMin: number;
  dMax: number;
  tauHat: number;
  tauHatDay: string;
  dPrefix: number;
  dSuffix: number;
  tauTrimRatio: number;
  verdict: 'no-shift' | 'borderline' | 'shift' | 'strong-shift';
}

export interface DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSort;
  kMinExplicit: number | null;
  onlyShifts: boolean;
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
  sources: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSourceRow[];
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

/**
 * Per-source pure builder. Validates options, gap-fills,
 * runs Inoue empirical-copula sup-deviation scan, returns a
 * deterministic report.
 */
export function buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(
  queue: QueueLine[],
  opts: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointOptions = {},
): DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be an integer >= 0 (got ${opts.top})`);
  }
  const sort: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSort =
    opts.sort ?? 'dMaxDesc';
  const validSorts: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSort[] = [
    'dMax',
    'dMaxDesc',
    'tauHat',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const kMinExplicit = opts.kMin ?? null;
  if (kMinExplicit !== null) {
    if (!Number.isInteger(kMinExplicit) || kMinExplicit < 5) {
      throw new Error(`kMin must be an integer >= 5 (got ${opts.kMin})`);
    }
  }
  const onlyShifts = opts.onlyShifts ?? false;
  if (typeof onlyShifts !== 'boolean') {
    throw new Error(`onlyShifts must be boolean (got ${opts.onlyShifts})`);
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
  const rows: DailyTokenInoueCopulaDfSupEmpiricalCopulaChangepointSourceRow[] = [];

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
    for (let i = 0; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    // Build (lag-0, lag-1) embedding.
    const N = nTenure - 1;
    const v1 = new Array<number>(N);
    const v2 = new Array<number>(N);
    for (let t = 0; t < N; t += 1) {
      v1[t] = filled[t + 1]!;
      v2[t] = filled[t]!;
    }
    const r1 = averageRanks(v1);
    const r2 = averageRanks(v2);
    const u1 = r1.map((r) => r / (N + 1));
    const u2 = r2.map((r) => r / (N + 1));

    const kMinUsed = kMinExplicit ?? Math.max(5, Math.ceil(0.1 * N));
    if (2 * kMinUsed >= N) {
      droppedBelowMinTenure += 1;
      continue;
    }
    let scan: InoueCopulaScanResult;
    try {
      scan = inoueCopulaScan(u1, u2, kMinUsed);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(scan.dMax) ||
      !Number.isFinite(scan.dPrefix) ||
      !Number.isFinite(scan.dSuffix)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    // tauHat is in N-embedded index space (1..N-1). Map back to
    // original day index: original day = firstDay + (tauHat) days
    // (because v_t = (x_t, x_{t-1}) at original index t = tauHat).
    const tauHatDay = addUtcDays(acc.firstDay, scan.tauHat);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      nEmbedded: N,
      kMin: scan.kMin,
      dMax: scan.dMax,
      tauHat: scan.tauHat,
      tauHatDay,
      dPrefix: scan.dPrefix,
      dSuffix: scan.dSuffix,
      tauTrimRatio: scan.kMin / N,
      verdict: inoueVerdict(scan.dMax),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'dMax':
        primary = a.dMax - b.dMax;
        break;
      case 'dMaxDesc':
        primary = b.dMax - a.dMax;
        break;
      case 'tauHat':
        primary = a.tauHat - b.tauHat;
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
  if (onlyShifts) {
    kept = kept.filter((r) => r.verdict !== 'no-shift');
  }
  if (top > 0 && kept.length > top) {
    droppedTopSources = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    top,
    sort,
    kMinExplicit,
    onlyShifts,
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
