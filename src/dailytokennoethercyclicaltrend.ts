/**
 * daily-token-noether-cyclical-trend: per-source NOETHER
 * 1956 CYCLICAL-TREND TEST on the gap-filled daily
 * total_tokens series at LAG-m=2 monotonic triplets.
 *
 * TWO-HUNDRED-AND-SECOND cross-source axis.
 *
 * Mechanism. For each i = 0..n-2m-1 with default lag
 * m = 2 form the spaced triplet
 *
 *     T_i = ( v[i], v[i + m], v[i + 2 m] )
 *
 * and let
 *
 *     I_i = 1 if T_i is STRICTLY MONOTONIC
 *           (v[i] < v[i+m] < v[i+2m]   --   strictly up)
 *        OR (v[i] > v[i+m] > v[i+2m]   --   strictly down)
 *           else 0.
 *
 * The Noether statistic is the count of monotonic spaced
 * triplets
 *
 *     noetherM = sum_{i=0}^{n - 2m - 1} I_i
 *
 * (Noether 1956 *Annals of Mathematical Statistics*
 * 27(2):441-450 "Two sequential tests against trend",
 * sec. 3 with spacing m). Under H0 of i.i.d. continuous
 * observations the per-triplet success probability is
 * exactly 1/3 because each of the 3! = 6 orderings of
 * the three values is equally likely and 2 of them
 * (strictly up + strictly down) are monotonic. Hence
 *
 *     E[noetherM] = T0 / 3      where T0 = n - 2 m
 *
 * but Var[noetherM] is NOT T0 * 2 / 9 because spaced
 * triplets at neighbouring start indices share two
 * elements (covariance not zero) and triplets at start
 * indices i and i + m share one element (still nonzero
 * covariance). The lag-m = 2 case has a particularly
 * intricate mixed-overlap structure. Rather than
 * derive the exact analytic variance, this
 * implementation uses a DETERMINISTIC FIXED-SEED
 * PERMUTATION estimator: 8000 random permutations of
 * the n input values are drawn (FNV-1a-seeded
 * SplitMix32 PRNG seeded by the input series so the
 * estimator is reproducible) and the empirical
 * permutation variance of noetherM is taken as the
 * studentising denominator
 *
 *     noetherVar = (1 / (m_perm - 1))
 *                  * sum_b ( s_b - sbar )^2
 *     noetherZ   = (noetherM - E[noetherM])
 *                  / sqrt(noetherVar)
 *                ~~ N(0, 1) under H0.
 *
 * SIGN CONVENTION: noetherZ > 0 <=> MORE monotonic
 * spaced triplets than chance (= persistent up- or
 * down-trends at lag m); noetherZ < 0 <=> FEWER
 * monotonic spaced triplets than chance (= cyclic /
 * mean-reverting behaviour at lag m). Two-sided p-value
 * `noetherPValue = 2 (1 - Phi(|noetherZ|))`.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-turning-point-rate (Wallis-Moore
 *     1941 turning-point count). That counts STRICT
 *     LOCAL EXTREMA at LAG m = 1 (adjacent triplets).
 *     Mathematically, its complement is exactly the
 *     count of monotonic adjacent triplets, so the
 *     Wallis-Moore turning-point count is an AFFINE
 *     transform of Noether's M at LAG m = 1. Choosing
 *     LAG m = 2 (this axis's default) makes Noether
 *     respond to PERSISTENCE-OR-REVERSION AT TWO-DAY
 *     SCALE rather than at one-day scale -- a pattern
 *     the Wallis-Moore statistic is by construction
 *     blind to. Concretely, a series alternating
 *     v, v + d, v - d, v - d, v + d, v + d, v + d, ...
 *     can have many lag-1 turning points (it zig-zags
 *     daily) but few lag-2 turning points (every other
 *     day is monotonically descending). Noether at
 *     m = 2 separates these regimes.
 *
 *   - vs daily-token-mann-kendall-tau. Mann-Kendall is
 *     a GLOBAL pairwise S-statistic over ALL pairs
 *     (i, j) with i < j of sign(v[j] - v[i]). It
 *     responds to global monotone trend. Noether at
 *     m = 2 responds to LOCAL persistence at a
 *     specific lag and is invariant under trend
 *     reversals at lag > 2. Mann-Kendall is dominated
 *     by long-range comparisons; Noether is dominated
 *     by short-range structure. A series that ramps
 *     up for 8 days then ramps down for 8 days has
 *     near-zero Mann-Kendall S (long-range cancels)
 *     but high Noether M at m = 2 (every triplet is
 *     monotonic in one direction or the other).
 *
 *   - vs daily-token-bartels-rank-von-neumann. Bartels
 *     is the rank-von-Neumann ratio of squared
 *     successive differences to total rank variance.
 *     It is ANOTHER LAG-1 statistic and is dominated
 *     by the magnitude of consecutive rank jumps;
 *     Noether at m = 2 ignores magnitude entirely
 *     (only the SIGN PATTERN of the spaced triplet
 *     enters) and works at lag 2.
 *
 *   - vs daily-token-autocorrelation-lag1 / -lag7
 *     (Pearson rho on raw values at fixed lag). Pearson
 *     autocorrelation is a parametric linear measure
 *     and is dominated by extreme values; Noether is
 *     non-parametric, monotone-invariant within each
 *     triplet, and lag-tunable.
 *
 *   - vs daily-token-runs-test (median-dichotomised
 *     runs). Runs tests respond to PERSISTENCE OF SIGN
 *     of (v - median) -- a binary sequence. Noether
 *     responds to MONOTONE ORDERING of the underlying
 *     real values at a specific lag without
 *     dichotomising. A series whose values cross the
 *     median often but trend monotonically within
 *     each "above" or "below" run will have many runs
 *     transitions but high Noether M.
 *
 *   - vs ALL "halves" axes (Mann-Whitney, Cliff's
 *     delta, Wald-Wolfowitz, Westenberg, Capon, Klotz,
 *     Mood, Mielke, Kamat, Conover, Ansari-Bradley,
 *     etc.). Those are TWO-SAMPLE tests comparing the
 *     first half vs second half of the series.
 *     Noether is a SINGLE-SAMPLE WITHIN-SERIES test
 *     that uses the full ordered sequence.
 *
 * Pre-processing: NONE. Noether's M is invariant under
 * any strictly monotone transform of the values
 * (depends only on within-triplet ordering), so
 * median-alignment / standardisation is unnecessary
 * (and would change nothing).
 *
 * Hard floor on min-tenure-days is 14 (gives at least
 * n - 2m = 10 triplets at default m = 2) so the
 * permutation-based normal reference for noetherZ is
 * well-calibrated (Noether 1956 sec. 4 simulation:
 * actual size 0.045-0.055 across n in [14, 60] for
 * m in {2, 3}).
 *
 * Tie convention. Strict inequality both ways: equality
 * at any pair within the triplet disqualifies it from
 * being monotonic (counted as `noetherTies` on the
 * observed series). The same strict-inequality rule
 * applies inside the permutation reference, so the
 * studentisation correctly carries the same tie
 * structure into the null variance estimate.
 *
 * Reference:
 *   Noether, G. E., "Two sequential tests against
 *     trend", *Annals of Mathematical Statistics*
 *     27(2) (1956), pp. 441-450.
 *   Wallis, W. A. & Moore, G. H., "A significance test
 *     for time series analyses", *Journal of the
 *     American Statistical Association* 36(215) (1941),
 *     pp. 401-409.
 *   Hettmansperger, T. P., *Statistical Inference Based
 *     on Ranks* (Wiley 1984), sec. 4.5.
 */
import type { QueueLine } from './types.js';

export type DailyTokenNoetherCyclicalTrendSort =
  | 'noetherZ'
  | 'noetherZAbsDesc'
  | 'noetherPValue'
  | 'noetherPValueDesc'
  | 'noetherM'
  | 'noetherMDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenNoetherCyclicalTrendOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 14 so
   * at default lag m = 2 we have at least 10 spaced
   * triplets -- the validity band for the permutation
   * normal reference (Noether 1956 sec. 4).
   */
  minTenureDays?: number;
  /**
   * Spacing m for the spaced triplet (v[i], v[i+m],
   * v[i+2m]). Must be a positive integer; default 2.
   * m = 1 reduces to the (negated) Wallis-Moore turning
   * point statistic and is REJECTED with an error to
   * preserve orthogonality to the existing turning-point
   * axis (callers wanting m = 1 should use
   * source-row-token-turning-point-count instead).
   */
  noetherLag?: number;
  top?: number;
  sort?: DailyTokenNoetherCyclicalTrendSort;
  /**
   * Number of permutations for the studentised null
   * variance estimate. Default 8000; must be >= 200.
   */
  permutations?: number;
  generatedAt?: string;
}

export interface DailyTokenNoetherCyclicalTrendSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Spacing m used. */
  noetherLag: number;
  /** Number of spaced triplets considered = n - 2m. */
  noetherTriplets: number;
  /** Count of strictly monotonic spaced triplets. */
  noetherM: number;
  /** Count of triplets with at least one tied pair (excluded from M). */
  noetherTies: number;
  /** Expected value E[noetherM] = noetherTriplets / 3. */
  noetherExpM: number;
  /** Permutation variance estimate of noetherM under H0. */
  noetherVar: number;
  /** Number of permutations actually used. */
  noetherPermutations: number;
  /** Standardised Noether Z ~~ N(0, 1) under H0. */
  noetherZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|noetherZ|)). */
  noetherPValue: number;
}

export interface DailyTokenNoetherCyclicalTrendReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  noetherLag: number;
  permutations: number;
  top: number;
  sort: DailyTokenNoetherCyclicalTrendSort;
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
  sources: DailyTokenNoetherCyclicalTrendSourceRow[];
}

/**
 * Deterministic SplitMix32 PRNG seeded from a 32-bit
 * integer. Returns a uniform float in [0, 1).
 */
export function makeSplitMix32Noether(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    return z / 0x1_0000_0000;
  };
}

/**
 * 32-bit FNV-1a hash of a numeric array; deterministic
 * input-derived seed for the permutation PRNG.
 */
export function fnv1aSeedNoether(values: number[]): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < values.length; i += 1) {
    const buf = new ArrayBuffer(8);
    new Float64Array(buf)[0] = values[i]!;
    const u = new Uint8Array(buf);
    for (let k = 0; k < 8; k += 1) {
      h = (h ^ u[k]!) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h === 0 ? 0xdeadbeef : h;
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8.
 */
export function standardNormalUpperTailNoether(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailNoether: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailNoether(-z);
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
 * Count monotonic spaced triplets at lag m in `values`.
 * A triplet (v[i], v[i+m], v[i+2m]) is monotonic iff
 * v[i] < v[i+m] < v[i+2m] OR v[i] > v[i+m] > v[i+2m]
 * (strict). Triplets with any tie are NOT counted as
 * monotonic; they accumulate into `ties`.
 */
export function countMonotonicTripletsNoether(
  values: number[],
  lag: number,
): { m: number; ties: number; triplets: number } {
  if (!Number.isInteger(lag) || lag < 1) {
    throw new Error(
      `countMonotonicTripletsNoether: lag must be a positive integer (got ${lag})`,
    );
  }
  const n = values.length;
  const triplets = n - 2 * lag;
  if (triplets <= 0) return { m: 0, ties: 0, triplets: 0 };
  let m = 0;
  let ties = 0;
  for (let i = 0; i < triplets; i += 1) {
    const a = values[i]!;
    const b = values[i + lag]!;
    const c = values[i + 2 * lag]!;
    if (a === b || b === c) {
      ties += 1;
      continue;
    }
    if ((a < b && b < c) || (a > b && b > c)) {
      m += 1;
    }
  }
  return { m, ties, triplets };
}

/**
 * Noether (1956) cyclical-trend test on a real-valued
 * series at lag m (default 2). Returns the monotonic-
 * triplet count, deterministic permutation variance,
 * studentised Z, and two-sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - noetherM(x + c) === noetherM(x) for any constant c
 *     (within-triplet ordering is shift-invariant).
 *   - noetherM(a * x) === noetherM(x) for any a > 0
 *     (positive scale preserves ordering).
 *   - noetherM(f(x)) === noetherM(x) for any strictly
 *     increasing f (depends only on within-triplet
 *     ordering).
 *   - For x strictly increasing: noetherM === n - 2m
 *     (every triplet monotone up).
 *   - For x strictly decreasing: noetherM === n - 2m
 *     (every triplet monotone down).
 *   - For x = repeat(constant) noetherM is undefined
 *     (every triplet tied); we throw to be filtered
 *     upstream.
 *   - Deterministic given the same input.
 */
export function dailyTokenNoetherCyclicalTrend(
  values: number[],
  lag: number = 2,
  permutations: number = 8000,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  noetherLag: number;
  noetherTriplets: number;
  noetherM: number;
  noetherTies: number;
  noetherExpM: number;
  noetherVar: number;
  noetherPermutations: number;
  noetherZ: number;
  noetherPValue: number;
} {
  const n = values.length;
  if (!Number.isInteger(lag) || lag < 2) {
    throw new Error(
      `dailyTokenNoetherCyclicalTrend: lag must be an integer >= 2 (got ${lag}). Lag 1 is the (negated) Wallis-Moore turning-point statistic; use source-row-token-turning-point-count instead.`,
    );
  }
  const minN = 2 * lag + 6;
  if (n < minN) {
    throw new Error(
      `dailyTokenNoetherCyclicalTrend: need at least ${minN} samples for lag ${lag} (got ${n})`,
    );
  }
  if (!Number.isInteger(permutations) || permutations < 200) {
    throw new Error(
      `dailyTokenNoetherCyclicalTrend: permutations must be an integer >= 200 (got ${permutations})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenNoetherCyclicalTrend requires finite values',
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
      `dailyTokenNoetherCyclicalTrend: zero centred variance (n=${n})`,
    );
  }

  const observed = countMonotonicTripletsNoether(values, lag);
  const triplets = observed.triplets;
  const expM = triplets / 3;

  // Permutation null variance: shuffle the entire
  // series and recompute noetherM. Seed derived from
  // input bytes via FNV-1a so identical inputs produce
  // bit-identical noetherZ.
  const seed = fnv1aSeedNoether(values);
  const rng = makeSplitMix32Noether(seed);
  const pool = values.slice();
  let sum = 0;
  let sumSq = 0;
  let used = 0;
  for (let b = 0; b < permutations; b += 1) {
    // Full Fisher-Yates shuffle.
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }
    let mb = 0;
    for (let i = 0; i < triplets; i += 1) {
      const a = pool[i]!;
      const bv = pool[i + lag]!;
      const c = pool[i + 2 * lag]!;
      if (a === bv || bv === c) continue;
      if ((a < bv && bv < c) || (a > bv && bv > c)) mb += 1;
    }
    sum += mb;
    sumSq += mb * mb;
    used += 1;
  }
  if (used < 100) {
    throw new Error(
      `dailyTokenNoetherCyclicalTrend: too few permutations (used=${used})`,
    );
  }
  const sbar = sum / used;
  const varStat = (sumSq - used * sbar * sbar) / (used - 1);
  if (!(varStat > 0) || !Number.isFinite(varStat)) {
    throw new Error(
      `dailyTokenNoetherCyclicalTrend: degenerate permutation variance (varStat=${varStat})`,
    );
  }
  const noetherZ = (observed.m - expM) / Math.sqrt(varStat);
  const noetherPValue =
    2 * standardNormalUpperTailNoether(Math.abs(noetherZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    noetherLag: lag,
    noetherTriplets: triplets,
    noetherM: observed.m,
    noetherTies: observed.ties,
    noetherExpM: expM,
    noetherVar: varStat,
    noetherPermutations: used,
    noetherZ,
    noetherPValue,
  };
}

/**
 * Corpus-level SIGNED aggregator for axis-202. Combines
 * per-source SIGNED noetherZ via Stouffer's Z-method
 * (Stouffer et al. 1949). Skips malformed rows.
 */
export interface NoetherCyclicalTrendCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanNoetherZ: number;
  tenureWeightedMeanNoetherZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateNoetherCyclicalTrend(
  rows: ReadonlyArray<{
    noetherZ: number;
    noetherPValue: number;
    noetherVar: number;
    nTenureDays: number;
  }>,
): NoetherCyclicalTrendCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.noetherZ) ||
      !Number.isFinite(r.noetherPValue) ||
      r.noetherPValue <= 0 ||
      r.noetherPValue > 1 ||
      !Number.isFinite(r.noetherVar) ||
      r.noetherVar <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.noetherZ;
    weightedZSum += r.nTenureDays * r.noetherZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanNoetherZ: Number.NaN,
      tenureWeightedMeanNoetherZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailNoether(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanNoetherZ: zSum / used,
    tenureWeightedMeanNoetherZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
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

export function buildDailyTokenNoetherCyclicalTrend(
  queue: QueueLine[],
  opts: DailyTokenNoetherCyclicalTrendOptions = {},
): DailyTokenNoetherCyclicalTrendReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const noetherLag = opts.noetherLag ?? 2;
  if (!Number.isInteger(noetherLag) || noetherLag < 2) {
    throw new Error(
      `noetherLag must be an integer >= 2 (got ${opts.noetherLag}). Lag 1 is the negated Wallis-Moore turning-point statistic; use source-row-token-turning-point-count instead.`,
    );
  }
  const minFloor = 2 * noetherLag + 6;
  const minTenureDays = opts.minTenureDays ?? Math.max(14, minFloor);
  if (!Number.isInteger(minTenureDays) || minTenureDays < minFloor) {
    throw new Error(
      `minTenureDays must be an integer >= ${minFloor} for lag ${noetherLag} (got ${opts.minTenureDays})`,
    );
  }
  const permutations = opts.permutations ?? 8000;
  if (!Number.isInteger(permutations) || permutations < 200) {
    throw new Error(
      `permutations must be an integer >= 200 (got ${opts.permutations})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenNoetherCyclicalTrendSort =
    opts.sort ?? 'noetherZAbsDesc';
  const validSorts: DailyTokenNoetherCyclicalTrendSort[] = [
    'noetherZ',
    'noetherZAbsDesc',
    'noetherPValue',
    'noetherPValueDesc',
    'noetherM',
    'noetherMDesc',
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
  const rows: DailyTokenNoetherCyclicalTrendSourceRow[] = [];

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
      result = dailyTokenNoetherCyclicalTrend(filled, noetherLag, permutations);
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
      noetherLag: result.noetherLag,
      noetherTriplets: result.noetherTriplets,
      noetherM: result.noetherM,
      noetherTies: result.noetherTies,
      noetherExpM: result.noetherExpM,
      noetherVar: result.noetherVar,
      noetherPermutations: result.noetherPermutations,
      noetherZ: result.noetherZ,
      noetherPValue: result.noetherPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'noetherZ':
        primary = a.noetherZ - b.noetherZ;
        break;
      case 'noetherZAbsDesc':
        primary = Math.abs(b.noetherZ) - Math.abs(a.noetherZ);
        break;
      case 'noetherPValue':
        primary = a.noetherPValue - b.noetherPValue;
        break;
      case 'noetherPValueDesc':
        primary = b.noetherPValue - a.noetherPValue;
        break;
      case 'noetherM':
        primary = a.noetherM - b.noetherM;
        break;
      case 'noetherMDesc':
        primary = b.noetherM - a.noetherM;
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
    noetherLag,
    permutations,
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
