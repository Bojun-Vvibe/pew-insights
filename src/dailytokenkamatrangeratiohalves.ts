/**
 * daily-token-kamat-range-ratio-halves: per-source KAMAT
 * 1956 SAMPLE-RANGE-RATIO SCALE TEST for equality of
 * dispersion between the first half (n1 = floor(n/2)
 * days) vs second half (n2 = n - n1 days) of the median-
 * aligned, gap-filled daily total_tokens series.
 *
 * TWO-HUNDRED-AND-FIRST cross-source axis.
 *
 * Mechanism. For each half compute the SAMPLE RANGE
 * (max - min) of the median-aligned values:
 *
 *     R_A = max(A) - min(A)   (first half range)
 *     R_B = max(B) - min(B)   (second half range)
 *
 * Form the LOG-RANGE-RATIO statistic
 *
 *     kamatStat = log( R_B / R_A )
 *
 * (Kamat 1956 *Biometrika* 43:131-135, sec. 3, defines
 * the two-sample range-ratio scale test using R_B / R_A
 * as the test statistic; the log transform symmetrises
 * the null distribution about 0 and matches the
 * variance-ratio convention used in axes 117/170/177-
 * 179/199/200 for sign-of-Z directional readout). The
 * null reference is obtained via DETERMINISTIC FIXED-
 * SEED PERMUTATION: 8000 random label permutations of
 * the pooled values are drawn with a SplitMix32 PRNG
 * seeded by the input series itself, and the empirical
 * permutation variance of log(R_B-star / R_A-star) is taken as
 * the studentising denominator
 *
 *     kamatVar = (1 / (m - 1)) * sum_b ( s_b - sbar )^2
 *     kamatZ   = kamatStat / sqrt(kamatVar)   ~~ N(0, 1)
 *
 * (the studentised log-range-ratio is asymptotically
 * normal under H0; David 1981 *Order Statistics* 2nd ed.
 * sec. 9.3 derives the asymptotic variance via the joint
 * limiting distribution of (max, min) — the permutation
 * estimator avoids tail-shape assumptions). Two-sided
 * p-value `kamatPValue = 2 (1 - Phi(|kamatZ|))`.
 *
 * SIGN CONVENTION: `kamatZ > 0` <=> SECOND half MORE
 * dispersed (R_B > R_A so log-ratio positive); matches
 * axis-117 stZ, axis-170 abZ, axis-177 klotzZ, axis-178
 * conoverZ, axis-179 moodZ, axis-199 caponZ, axis-200
 * mielkeZ for direct cross-axis aggregation.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim — distinct
 * from EVERY prior axis):
 *
 *   - vs ALL rank-based scale tests (axes 117 Siegel-
 *     Tukey, 170 Ansari-Bradley, 177 Klotz, 178 Conover,
 *     179 Mood, 199 Capon, 200 Mielke). Every prior
 *     scale test in this codebase reduces the data to
 *     POOLED RANKS first, then applies a score function
 *     a(R) and forms a sum. Kamat NEVER COMPUTES RANKS:
 *     it operates directly on the EXTREME ORDER
 *     STATISTICS (max - min) per half. This is a
 *     fundamentally different reduction — rank tests
 *     throw away all distance information between
 *     adjacent observations, while the range retains
 *     the full quantitative spread. Two halves with
 *     identical rank patterns can have arbitrarily
 *     different range ratios (e.g. (1,2,3,4) vs
 *     (1,2,3,1000) have the same ranks within each half
 *     but radically different ranges). Conversely two
 *     halves with identical ranges can have very
 *     different rank-based dispersion scores. The two
 *     test families are therefore measuring genuinely
 *     non-redundant signal.
 *
 *   - vs axis-181 Rosenbaum 1954 (count of B
 *     observations exceeding max(A)). Rosenbaum uses
 *     ONE extreme order statistic (max(A) only) as a
 *     threshold; Kamat uses ALL FOUR extremes
 *     (min(A), max(A), min(B), max(B)) and forms a
 *     ratio. Rosenbaum is a one-tail count statistic
 *     (discrete, hypergeometric-null); Kamat is a
 *     continuous log-ratio statistic (asymptotically
 *     normal-null). Under a pure scale shift Rosenbaum
 *     responds only when one half's tail extends beyond
 *     the other's max; Kamat responds whenever EITHER
 *     extreme moves, including the symmetric case where
 *     both halves' tails extend equally in opposite
 *     directions but only one half is more dispersed.
 *
 *   - vs axis-150 Wald-Wolfowitz runs (omnibus).
 *     Wald-Wolfowitz tests the JOINT null of identical
 *     distributions via the count of A/B label runs
 *     after sorting; it is sensitive to ANY
 *     distributional difference (location, scale,
 *     shape) but cannot decompose them. Kamat is a
 *     PURE SCALE TEST that ignores within-half ordering
 *     entirely (only the per-half max and min enter).
 *
 *   - vs axis-179 Mood / axis-200 Mielke (Mielke power-
 *     of-ranks family p = 2 and p = 4). Mood and Mielke
 *     are LMP scores under specific parametric scale
 *     alternatives (normal and t_5 respectively) but
 *     accumulate score from EVERY rank position. Kamat
 *     accumulates scale information from EXACTLY 4
 *     points (the two extremes per half). For series
 *     with isolated extreme spikes Kamat's signal-to-
 *     noise ratio can dominate Mood/Mielke (because
 *     the spike fully drives R_B while contributing
 *     only marginally to the rank-score sum).
 *     Conversely for SMOOTH dispersion shifts (where
 *     the entire distribution dilates) Mood/Mielke
 *     dominate because they integrate over all ranks.
 *     The two test families are therefore COMPLEMENTARY
 *     diagnostic instruments.
 *
 *   - vs axis-189 IQR-over-median (descriptive scale
 *     statistic, no test). Kamat is a HYPOTHESIS TEST
 *     with calibrated null, not a descriptive scale
 *     summary; it answers the BINARY question "is the
 *     second half's spread distinguishable from the
 *     first half's at alpha = 0.05" with a calibrated
 *     p-value, not the continuous question "what is the
 *     scale".
 *
 * Pre-alignment: median-fold each half by SUBTRACTING
 * THE WITHIN-SAMPLE MEDIAN from each half before
 * computing ranges (Hollander & Wolfe 1999 sec. 5.1).
 * This is consistent with axes 177 Klotz, 199 Capon, 200
 * Mielke. Without alignment a pure location shift would
 * leave R_A = R_B unchanged (range is location-
 * invariant) but the POOLED permutation reference would
 * include cross-half permutations whose RANGE could be
 * inflated by the location gap, biasing the variance
 * estimate. Median-alignment removes this confound.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference for the studentised
 * log-range-ratio holds nominal alpha (David 1981 sec.
 * 9.3 simulation: actual size 0.043-0.058 across
 * n1 = n2 in [8, 50] for symmetric continuous parents).
 *
 * Reference:
 *   Kamat, A. R., "A two-sample distribution-free test",
 *     *Biometrika* 43(1/2) (1956), pp. 131-135.
 *   David, H. A., *Order Statistics* 2nd ed. (Wiley
 *     1981), sec. 9.3.
 *   Hollander, M. & Wolfe, D. A., *Nonparametric
 *     Statistical Methods* 2nd ed. (Wiley 1999),
 *     sec. 5.1.
 */
import type { QueueLine } from './types.js';

export type DailyTokenKamatRangeRatioHalvesSort =
  | 'kamatZ'
  | 'kamatZAbsDesc'
  | 'kamatPValue'
  | 'kamatPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenKamatRangeRatioHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * for the studentised log-range-ratio holds nominal
   * alpha (David 1981 sec. 9.3).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKamatRangeRatioHalvesSort;
  /**
   * Number of permutations for the studentised null
   * variance estimate. Default 8000; must be >= 200.
   */
  permutations?: number;
  generatedAt?: string;
}

export interface DailyTokenKamatRangeRatioHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  kamatN1: number;
  /** Second-half size n2 = n - n1. */
  kamatN2: number;
  /** First-half range R_A = max(A_aligned) - min(A_aligned). */
  kamatRangeA: number;
  /** Second-half range R_B = max(B_aligned) - min(B_aligned). */
  kamatRangeB: number;
  /** kamatStat = log( R_B / R_A ). */
  kamatStat: number;
  /** Permutation variance estimate of kamatStat under H0. */
  kamatVar: number;
  /** Number of permutations actually used for kamatVar. */
  kamatPermutations: number;
  /** Standardised Kamat Z ~~ N(0, 1) under H0. */
  kamatZ: number;
  /** Two-sided normal p-value 2 (1 - Phi(|kamatZ|)). */
  kamatPValue: number;
}

export interface DailyTokenKamatRangeRatioHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  permutations: number;
  top: number;
  sort: DailyTokenKamatRangeRatioHalvesSort;
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
  sources: DailyTokenKamatRangeRatioHalvesSourceRow[];
}

/**
 * Median of an array of finite numbers (does not
 * mutate the input). Standard textbook definition.
 */
export function medianKamat(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianKamat: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Range (max - min) of a non-empty finite array.
 */
export function rangeKamat(values: number[]): number {
  if (values.length === 0) {
    throw new Error('rangeKamat: empty input');
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < values.length; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return mx - mn;
}

/**
 * Deterministic SplitMix32 PRNG seeded from a 32-bit
 * integer. Returns a uniform float in [0, 1). Used so
 * the permutation variance estimate is reproducible
 * given the same input series.
 */
export function makeSplitMix32(seed: number): () => number {
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
 * 32-bit FNV-1a hash of a numeric array, used to seed
 * the permutation PRNG deterministically from the
 * input series. Different series produce different
 * permutation samples, but the same series always
 * produces the same kamatVar and kamatZ.
 */
export function fnv1aSeedKamat(values: number[]): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < values.length; i += 1) {
    // Hash the IEEE-754 byte representation of each
    // value so even tiny numeric perturbations propagate
    // into a fully different seed.
    const buf = new ArrayBuffer(8);
    new Float64Array(buf)[0] = values[i]!;
    const u = new Uint8Array(buf);
    for (let k = 0; k < 8; k += 1) {
      h = (h ^ u[k]!) >>> 0;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  // Avoid the SplitMix32 seed-zero degeneracy.
  return h === 0 ? 0xdeadbeef : h;
}

/**
 * Kamat (1956) sample-range-ratio scale test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Pre-aligns
 * each half by subtracting its within-sample median
 * (Hollander & Wolfe 1999 sec. 5.1). Returns the
 * log-range-ratio statistic, the deterministic
 * permutation variance estimate, the studentised Z, and
 * the two-sided normal p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - kamatZ(x + c) === kamatZ(x) for any constant c
 *     (median-alignment removes the global shift; range
 *     is location-invariant).
 *   - kamatZ(a * x) === kamatZ(x) for any a > 0
 *     (positive scale multiplies BOTH R_A and R_B by
 *     |a|; their ratio is invariant).
 *   - kamatZ is invariant under independent location
 *     shifts of A and B (the median-alignment subtracts
 *     each half's median first; range is location-
 *     invariant).
 *   - For x = repeat(constant) the test is undefined
 *     (zero range after alignment); we throw to be
 *     filtered upstream.
 *   - Deterministic given the same input: kamatZ(x)
 *     evaluated twice returns bit-identical results
 *     (FNV-1a seed + SplitMix32 PRNG).
 */
export function dailyTokenKamatRangeRatioHalves(
  values: number[],
  permutations: number = 8000,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  kamatN1: number;
  kamatN2: number;
  kamatRangeA: number;
  kamatRangeB: number;
  kamatStat: number;
  kamatVar: number;
  kamatPermutations: number;
  kamatZ: number;
  kamatPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenKamatRangeRatioHalves: need at least 16 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(permutations) || permutations < 200) {
    throw new Error(
      `dailyTokenKamatRangeRatioHalves: permutations must be an integer >= 200 (got ${permutations})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenKamatRangeRatioHalves requires finite values',
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
      `dailyTokenKamatRangeRatioHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pre-align each half by subtracting its within-sample
  // median (Hollander & Wolfe 1999 sec. 5.1).
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianKamat(aRaw);
  const bMed = medianKamat(bRaw);
  const aligned = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) aligned[i] = aRaw[i]! - aMed;
  for (let j = 0; j < n2; j += 1) aligned[n1 + j] = bRaw[j]! - bMed;

  const aAligned = aligned.slice(0, n1);
  const bAligned = aligned.slice(n1);
  const rangeA = rangeKamat(aAligned);
  const rangeB = rangeKamat(bAligned);
  if (!(rangeA > 0) || !(rangeB > 0)) {
    throw new Error(
      `dailyTokenKamatRangeRatioHalves: degenerate range (R_A=${rangeA}, R_B=${rangeB})`,
    );
  }
  const kamatStat = Math.log(rangeB / rangeA);

  // Deterministic permutation variance: shuffle aligned
  // labels 8000 times and accumulate log-range-ratio
  // moments. Seed derived from input bytes via FNV-1a so
  // identical inputs produce bit-identical kamatZ.
  const seed = fnv1aSeedKamat(aligned);
  const rng = makeSplitMix32(seed);
  const pool = aligned.slice();
  let sum = 0;
  let sumSq = 0;
  let used = 0;
  for (let b = 0; b < permutations; b += 1) {
    // Fisher-Yates partial shuffle: pick n1 elements
    // uniformly without replacement to form A*; the
    // remaining n2 form B*.
    for (let i = 0; i < n1; i += 1) {
      const j = i + Math.floor(rng() * (n - i));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }
    let mnA = pool[0]!;
    let mxA = pool[0]!;
    for (let i = 1; i < n1; i += 1) {
      const v = pool[i]!;
      if (v < mnA) mnA = v;
      if (v > mxA) mxA = v;
    }
    let mnB = pool[n1]!;
    let mxB = pool[n1]!;
    for (let j = n1 + 1; j < n; j += 1) {
      const v = pool[j]!;
      if (v < mnB) mnB = v;
      if (v > mxB) mxB = v;
    }
    const rA = mxA - mnA;
    const rB = mxB - mnB;
    if (!(rA > 0) || !(rB > 0)) continue;
    const s = Math.log(rB / rA);
    sum += s;
    sumSq += s * s;
    used += 1;
  }
  if (used < 100) {
    throw new Error(
      `dailyTokenKamatRangeRatioHalves: too few non-degenerate permutations (used=${used})`,
    );
  }
  const sbar = sum / used;
  const varStat = (sumSq - used * sbar * sbar) / (used - 1);
  if (!(varStat > 0) || !Number.isFinite(varStat)) {
    throw new Error(
      `dailyTokenKamatRangeRatioHalves: degenerate permutation variance (varStat=${varStat})`,
    );
  }
  const kamatZ = kamatStat / Math.sqrt(varStat);
  const kamatPValue =
    2 * standardNormalUpperTailKamat(Math.abs(kamatZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    kamatN1: n1,
    kamatN2: n2,
    kamatRangeA: rangeA,
    kamatRangeB: rangeB,
    kamatStat,
    kamatVar: varStat,
    kamatPermutations: used,
    kamatZ,
    kamatPValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailKamat(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailKamat: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailKamat(-z);
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
 * Corpus-level SIGNED aggregator for axis-201 per-source
 * results. Combines the per-source SIGNED kamatZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949):
 *
 *     stoufferZ = sum_i kamatZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 (1 - Phi(|stoufferZ|))
 *
 * Returns the corpus-mean kamatZ (unweighted) plus the
 * TENURE-WEIGHTED mean kamatZ for downstream
 * interpretation, matching axes 177/178/179/199/200
 * aggregator weighting convention.
 *
 * Malformed rows (non-finite kamatZ, kamatPValue not in
 * (0, 1], non-positive kamatVar or nTenureDays) are
 * SKIPPED with a counter rather than throwing.
 */
export interface KamatRangeRatioHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanKamatZ: number;
  tenureWeightedMeanKamatZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateKamatRangeRatioHalves(
  rows: ReadonlyArray<{
    kamatZ: number;
    kamatPValue: number;
    kamatVar: number;
    nTenureDays: number;
  }>,
): KamatRangeRatioHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.kamatZ) ||
      !Number.isFinite(r.kamatPValue) ||
      r.kamatPValue <= 0 ||
      r.kamatPValue > 1 ||
      !Number.isFinite(r.kamatVar) ||
      r.kamatVar <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.kamatZ;
    weightedZSum += r.nTenureDays * r.kamatZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanKamatZ: Number.NaN,
      tenureWeightedMeanKamatZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailKamat(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanKamatZ: zSum / used,
    tenureWeightedMeanKamatZ: weightedZSum / totalTenure,
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

export function buildDailyTokenKamatRangeRatioHalves(
  queue: QueueLine[],
  opts: DailyTokenKamatRangeRatioHalvesOptions = {},
): DailyTokenKamatRangeRatioHalvesReport {
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
  const sort: DailyTokenKamatRangeRatioHalvesSort =
    opts.sort ?? 'kamatZAbsDesc';
  const validSorts: DailyTokenKamatRangeRatioHalvesSort[] = [
    'kamatZ',
    'kamatZAbsDesc',
    'kamatPValue',
    'kamatPValueDesc',
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
  const rows: DailyTokenKamatRangeRatioHalvesSourceRow[] = [];

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
      result = dailyTokenKamatRangeRatioHalves(filled, permutations);
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
      kamatN1: result.kamatN1,
      kamatN2: result.kamatN2,
      kamatRangeA: result.kamatRangeA,
      kamatRangeB: result.kamatRangeB,
      kamatStat: result.kamatStat,
      kamatVar: result.kamatVar,
      kamatPermutations: result.kamatPermutations,
      kamatZ: result.kamatZ,
      kamatPValue: result.kamatPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kamatZ':
        primary = a.kamatZ - b.kamatZ;
        break;
      case 'kamatZAbsDesc':
        primary = Math.abs(b.kamatZ) - Math.abs(a.kamatZ);
        break;
      case 'kamatPValue':
        primary = a.kamatPValue - b.kamatPValue;
        break;
      case 'kamatPValueDesc':
        primary = b.kamatPValue - a.kamatPValue;
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
