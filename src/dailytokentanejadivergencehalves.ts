/**
 * daily-token-taneja-divergence-halves: per-source
 * KDE-SMOOTHED TANEJA ARITHMETIC-GEOMETRIC MEAN DIVERGENCE
 * between the FIRST and SECOND half of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-THIRTY-SIXTH cross-source axis.
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
 * 132/133/134/135 for direct comparability of bandwidth):
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
 * mass-normalisation. (Bit-exact same setup as axes 126-135.)
 *
 * TANEJA DIVERGENCE (Taneja 1989/2005; Cha 2007 eq. 30):
 *
 *     T(p, q) = sum_k  ( (p_k + q_k) / 2 )
 *               * log( (p_k + q_k) / (2 * sqrt(p_k * q_k)) )
 *
 * The summand is the ARITHMETIC mean (p+q)/2 multiplied by
 * the LOG of the AM-to-GM ratio (p+q)/(2*sqrt(p*q)). It is
 * an f-divergence with f(t) = ((1+t)/2) * log((1+t)/(2*sqrt(t))),
 * symmetric under swap of p, q, and bounded above for any
 * pair of pmfs on a fixed grid (the AM-to-GM log gap is at
 * most logarithmic in the bin asymmetry).
 *
 * Range. T(p, q) >= 0 with equality iff p === q on the grid.
 * Per-bin upper bound: with both pmfs floored at PMF_FLOOR,
 * each summand is bounded by (1/2) * log(1/(2*sqrt(eps))).
 * In practice T saturates well below this loose bound.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY PRIOR AXIS 118-135:
 *
 *   - Class. AM-OF-GM LOG RATIO. The summand is a LOG of
 *     the per-bin AM-to-GM ratio, weighted by the AM. No
 *     prior half-vs-half axis uses an AM/GM contrast.
 *     JSD/Bhattacharyya are bilinear in p, q (coefficient
 *     log(2) * sqrt(p*q) etc.); Jeffreys / KL use log(p/q);
 *     Taneja uses log( (p+q) / (2*sqrt(p*q)) ) -- a quantity
 *     that is ZERO iff p == q at the bin and grows with the
 *     INEQUALITY between p and q REGARDLESS of which side
 *     is larger.
 *
 *   - vs axis-122 Bhattacharyya BC = sum_k sqrt(p_k * q_k):
 *     Bhatt aggregates the per-bin GM directly (linear in
 *     sqrt(p*q)). Taneja contrasts the AM and the GM via a
 *     LOG. Two pmfs with the same total Bhatt overlap can
 *     have very different Taneja scores depending on HOW
 *     the disagreement is distributed across bins (Taneja
 *     is super-additive in per-bin AM-GM gap; Bhatt is
 *     additive in per-bin GM).
 *
 *   - vs axis-129 triangular Delta = sum_k (p-q)^2/(p+q):
 *     Delta uses the per-bin chi-square style (p-q)^2
 *     normalised by AM. Taneja uses the AM-GM LOG ratio.
 *     For small per-bin gap |p - q| << p+q the AM-GM gap is
 *     ~ (p-q)^2 / (8 * AM^2) so Taneja behaves locally like
 *     a constant times sum_k AM * (p-q)^2 / AM^2 ~ sum
 *     (p-q)^2/AM; the locally-quadratic behaviour matches
 *     Delta only up to a constant. Beyond the local regime
 *     (large per-bin disagreement) Taneja saturates
 *     LOGARITHMICALLY while Delta saturates LINEARLY in
 *     |p - q|/(p + q) -- different non-local growth.
 *
 *   - vs axis-135 Clark = sqrt(sum_k ((p-q)/(p+q))^2):
 *     Clark squares and root-sums the per-bin RELATIVE gap;
 *     Taneja log-weights the per-bin AM/GM ratio. Clark is
 *     bin-wise BOUNDED in [0, 1]^2 BEFORE squaring; Taneja
 *     is bin-wise unbounded above (AM/GM blows up
 *     logarithmically as p/q -> 0). Different bounded vs
 *     unbounded regime; different mean operator (p+q)/2 on
 *     log-AM/GM vs naked normalised-square sum.
 *
 *   - vs axis-134 psChi2 = sum_k (p-q)^2 (p+q)/(p*q): both
 *     blow up at p, q -> 0 but with very different orders.
 *     psChi2 grows POLYNOMIALLY (1/(p*q)); Taneja grows
 *     LOGARITHMICALLY (log(1/sqrt(p*q))). Taneja is much
 *     more tail-tolerant than psChi2 while still being
 *     more aggressive than the bounded Clark ceiling.
 *
 *   - vs axis-118 JSD: JSD uses the MIDPOINT pmf m = (p+q)/2
 *     and aggregates KL(p||m) + KL(q||m). Taneja uses the
 *     SAME midpoint AS A WEIGHT on a DIFFERENT log gap (AM
 *     vs GM, not p vs midpoint). JSD is bounded by log(2)
 *     for pmfs; Taneja is not -- saturates with the depth
 *     of the per-bin asymmetry.
 *
 * NUMERICAL FLOOR. The geometric mean sqrt(p*q) underflows
 * to zero in IEEE-754 only at extreme tail bins. We apply
 * the SAME PMF_FLOOR = 1e-15 as axes 134/135 to keep the
 * AM/GM ratio well-defined and preserve cross-axis numerical
 * comparability. The floor is a no-op for any genuine KDE
 * pmf.
 *
 * RELATED DIAGNOSTICS exposed on every row:
 *
 *     tanejaDivergence    = sum_k AM_k * log( AM_k / GM_k )
 *     tanejaMaxBin        = max_k of the per-bin Taneja summand
 *     tanejaMaxAmGmRatio  = max_k AM_k / GM_k             >= 1
 *     tanejaSpreadRatio   = tanejaDivergence /
 *                           (K * tanejaMaxBin)            in [0, 1]
 *
 * tanejaSpreadRatio approaches 1/K iff the divergence is
 * concentrated in a single bin and approaches 1 iff every
 * bin contributes the same maximal amount. Defined as 0
 * when tanejaMaxBin === 0 (vacuous case where halves
 * coincide). Cross-source-comparable: independent of the
 * overall divergence magnitude.
 *
 * Headline question:
 * **"For each source, when we smooth the daily-token
 *   distributions of the first vs second half with a
 *   shared Gaussian KDE bandwidth and compare them with
 *   the TANEJA AM-GM divergence
 *   T = sum_k AM_k * log(AM_k / GM_k),
 *   how strong is the half-vs-half drift WHEN EACH BIN
 *   IS PENALISED FOR THE LOG-GAP BETWEEN ITS LOCAL
 *   ARITHMETIC AND GEOMETRIC MEAN MASSES (so disagreement
 *   is read on a logarithmic scale of asymmetry)?"**
 *
 * References:
 *   Taneja, I. J. (1989). "On generalized information
 *     measures and their applications", Adv. Electronics &
 *     Electron Physics 76, 327-413.
 *   Taneja, I. J. (2005). "On symmetric and nonsymmetric
 *     divergence measures and their generalizations",
 *     Adv. Imaging & Electron Physics 138, 177-250.
 *   Cha, Sung-Hyuk (2007). "Comprehensive Survey on
 *     Distance/Similarity Measures between Probability
 *     Density Functions", Int. J. Math. Models and Methods
 *     in Applied Sciences 1(4), eq. 30.
 *
 * Caveats:
 *
 *   - Taneja divergence is symmetric under swap of p, q
 *     and non-negative, but is NOT a metric (no triangle
 *     inequality; Cha 2007).
 *   - PMF_FLOOR = 1e-15 is a numerical safeguard, not a
 *     statistical regulariser.
 *   - Translation- AND positive-scale-invariant in the data
 *     (data and bandwidth scale together; pmfs unchanged).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-taneja-divergence-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-taneja-divergence-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Taneja divergence ascending:
 *   pew-insights daily-token-taneja-divergence-halves --sort taneja
 */
import type { QueueLine } from './types.js';

export type DailyTokenTanejaDivergenceHalvesSort =
  | 'taneja'
  | 'tanejaDesc'
  | 'maxBin'
  | 'maxBinDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenTanejaDivergenceHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 8. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenTanejaDivergenceHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenTanejaDivergenceHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  tanejaN1: number;
  tanejaN2: number;
  tanejaMadPool: number;
  tanejaBandwidth: number;
  tanejaGridLo: number;
  tanejaGridHi: number;
  tanejaGridDx: number;
  tanejaGridK: number;
  /** Taneja divergence sum_k AM_k * log(AM_k/GM_k) >= 0. */
  tanejaDivergence: number;
  /** Largest per-bin summand contributing to the Taneja sum. */
  tanejaMaxBin: number;
  /** max_k AM_k/GM_k >= 1; saturates iff at least one bin is highly asymmetric. */
  tanejaMaxAmGmRatio: number;
  /**
   * Spread diagnostic tanejaDivergence / (K * tanejaMaxBin) in [0, 1].
   * Approaches 1 iff every bin contributes the same maximal Taneja
   * amount (broad, evenly-spread asymmetry); approaches 1/K iff the
   * Taneja mass is concentrated in a single bin. Defined as 0 when
   * tanejaMaxBin === 0 (vacuous case where halves coincide).
   * Cross-source-comparable: INDEPENDENT of overall divergence
   * magnitude.
   */
  tanejaSpreadRatio: number;
}

export interface DailyTokenTanejaDivergenceHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenTanejaDivergenceHalvesSort;
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
  sources: DailyTokenTanejaDivergenceHalvesSourceRow[];
}

/** Fixed KDE grid size (matches axes 126/127/128/129/130/131/132/133/134/135). */
export const TANEJA_GRID_K = 257;
/** Fixed Silverman bandwidth multiplier. */
export const TANEJA_SILVERMAN_MULTIPLIER = 0.9;
/** Fixed grid extension in bandwidth units on each side. */
export const TANEJA_GRID_EXTENSION_H = 3;
/** Numerical underflow floor on pmf bins for the sqrt(p*q) denominator. */
export const TANEJA_PMF_FLOOR = 1e-15;

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
 * KDE-smoothed Taneja AM-GM divergence between halves.
 *
 * EXACT IDENTITIES preserved (verified by the test suite):
 *
 *   - tanejaDivergence(x + c) === tanejaDivergence(x) for any c.
 *   - tanejaDivergence(k*x) === tanejaDivergence(x) for any k > 0.
 *   - tanejaDivergence >= 0.
 *   - tanejaDivergence === 0 iff p === q on the grid.
 *   - Symmetric: swapping the two halves preserves tanejaDivergence.
 *   - tanejaMaxAmGmRatio >= 1.
 *   - tanejaMaxBin >= 0.
 */
export function dailyTokenTanejaDivergenceHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  tanejaN1: number;
  tanejaN2: number;
  tanejaMadPool: number;
  tanejaBandwidth: number;
  tanejaGridLo: number;
  tanejaGridHi: number;
  tanejaGridDx: number;
  tanejaGridK: number;
  tanejaDivergence: number;
  tanejaMaxBin: number;
  tanejaMaxAmGmRatio: number;
  tanejaSpreadRatio: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenTanejaDivergenceHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenTanejaDivergenceHalves requires finite values');
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
      `dailyTokenTanejaDivergenceHalves: zero centred variance (n=${n})`,
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

  let h = TANEJA_SILVERMAN_MULTIPLIER * madPool * Math.pow(n, -1 / 5);
  if (!(h > 0) || !Number.isFinite(h)) {
    let mn = values[0]!;
    let mx = values[0]!;
    for (let i = 1; i < n; i += 1) {
      const v = values[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    h = TANEJA_SILVERMAN_MULTIPLIER * (mx - mn) * Math.pow(n, -1 / 5);
    if (!(h > 0)) h = 1;
  }

  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const gLo = mn - TANEJA_GRID_EXTENSION_H * h;
  const gHi = mx + TANEJA_GRID_EXTENSION_H * h;
  const K = TANEJA_GRID_K;
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
      `dailyTokenTanejaDivergenceHalves: KDE mass non-positive (zA=${zA}, zB=${zB})`,
    );
  }

  let sum = 0;
  let maxBin = 0;
  let maxRatio = 1;
  for (let k = 0; k < K; k += 1) {
    let pk = (w[k]! * fA[k]!) / zA;
    let qk = (w[k]! * fB[k]!) / zB;
    if (pk < TANEJA_PMF_FLOOR) pk = TANEJA_PMF_FLOOR;
    if (qk < TANEJA_PMF_FLOOR) qk = TANEJA_PMF_FLOOR;
    const am = 0.5 * (pk + qk);
    const gm = Math.sqrt(pk * qk);
    const ratio = am / gm;
    // ratio >= 1 by AM-GM; clamp to 1 to defuse fp dust below 1.
    const safeRatio = ratio >= 1 ? ratio : 1;
    const term = am * Math.log(safeRatio);
    sum += term;
    if (term > maxBin) maxBin = term;
    if (safeRatio > maxRatio) maxRatio = safeRatio;
  }

  const tanejaDivergence = sum;
  const tanejaMaxBin = maxBin;
  const tanejaMaxAmGmRatio = maxRatio;
  const tanejaSpreadRatio =
    tanejaMaxBin > 0 ? tanejaDivergence / (K * tanejaMaxBin) : 0;

  if (
    !Number.isFinite(tanejaDivergence) ||
    !Number.isFinite(tanejaMaxBin) ||
    !Number.isFinite(tanejaMaxAmGmRatio) ||
    !Number.isFinite(tanejaSpreadRatio)
  ) {
    throw new Error(
      `dailyTokenTanejaDivergenceHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    tanejaN1: n1,
    tanejaN2: n2,
    tanejaMadPool: madPool,
    tanejaBandwidth: h,
    tanejaGridLo: gLo,
    tanejaGridHi: gHi,
    tanejaGridDx: dx,
    tanejaGridK: K,
    tanejaDivergence,
    tanejaMaxBin,
    tanejaMaxAmGmRatio,
    tanejaSpreadRatio,
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

export function buildDailyTokenTanejaDivergenceHalves(
  queue: QueueLine[],
  opts: DailyTokenTanejaDivergenceHalvesOptions = {},
): DailyTokenTanejaDivergenceHalvesReport {
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
  const sort: DailyTokenTanejaDivergenceHalvesSort = opts.sort ?? 'tanejaDesc';
  const validSorts: DailyTokenTanejaDivergenceHalvesSort[] = [
    'taneja',
    'tanejaDesc',
    'maxBin',
    'maxBinDesc',
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
  const rows: DailyTokenTanejaDivergenceHalvesSourceRow[] = [];

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
      result = dailyTokenTanejaDivergenceHalves(filled);
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
      tanejaN1: result.tanejaN1,
      tanejaN2: result.tanejaN2,
      tanejaMadPool: result.tanejaMadPool,
      tanejaBandwidth: result.tanejaBandwidth,
      tanejaGridLo: result.tanejaGridLo,
      tanejaGridHi: result.tanejaGridHi,
      tanejaGridDx: result.tanejaGridDx,
      tanejaGridK: result.tanejaGridK,
      tanejaDivergence: result.tanejaDivergence,
      tanejaMaxBin: result.tanejaMaxBin,
      tanejaMaxAmGmRatio: result.tanejaMaxAmGmRatio,
      tanejaSpreadRatio: result.tanejaSpreadRatio,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'taneja':
        primary = a.tanejaDivergence - b.tanejaDivergence;
        break;
      case 'tanejaDesc':
        primary = b.tanejaDivergence - a.tanejaDivergence;
        break;
      case 'maxBin':
        primary = a.tanejaMaxBin - b.tanejaMaxBin;
        break;
      case 'maxBinDesc':
        primary = b.tanejaMaxBin - a.tanejaMaxBin;
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
    gridK: TANEJA_GRID_K,
    silvermanMultiplier: TANEJA_SILVERMAN_MULTIPLIER,
    pmfFloor: TANEJA_PMF_FLOOR,
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
