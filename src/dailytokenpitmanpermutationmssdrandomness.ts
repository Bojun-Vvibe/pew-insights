/**
 * daily-token-pitman-permutation-mssd-randomness:
 * per-source PITMAN 1937 PERMUTATION TEST FOR RANDOMNESS
 * applied to the gap-filled daily total_tokens series via
 * the MEAN-OF-SQUARED-SUCCESSIVE-DIFFERENCES (MSSD)
 * statistic compared against a FIXED-SEED SAMPLED
 * PERMUTATION NULL DISTRIBUTION on the RAW VALUES.
 *
 * TWO-HUNDRED-AND-SEVENTH cross-source axis.
 *
 * Mechanism. Pitman (1937 *Biometrika* 29: 322-335
 * "Significance tests which may be applied to samples
 * from any populations") proposes a fully nonparametric
 * test for the H0 "the n observations were generated
 * exchangeably (any of n! orderings equiprobable)" that
 * uses the SAME RAW-VALUE STATISTIC under both the
 * observed ordering and every permutation, evaluating
 * significance by the EXACT PERMUTATION REFERENCE
 * DISTRIBUTION rather than an asymptotic limit.
 *
 * The statistic chosen here is the MEAN OF SQUARED
 * SUCCESSIVE DIFFERENCES:
 *
 *     mssd(x) = (1 / (n-1)) * sum_{i=1..n-1} (x[i] - x[i-1])^2
 *
 * which is the von Neumann (1941 *Annals of Mathematical
 * Statistics* 12: 367-395) numerator of the variance-
 * ratio statistic but applied to the RAW VALUES rather
 * than to the ranks (cf. axis daily-token-bartels-rank-
 * von-neumann which uses ranks and the asymptotic-normal
 * Bartels reference).
 *
 * Under H0 of exchangeable ordering, mssd(x) over the
 * observed series is exchangeably distributed with
 * mssd(pi(x)) for every permutation pi in S_n. We thus
 * compute the PITMAN PERMUTATION P-VALUE
 *
 *     ppPValue = P_{pi}( mssd(pi(x)) <= mssd(x) )
 *
 * (one-sided lower-tail: small mssd indicates POSITIVE
 * SERIAL DEPENDENCE / smoothness, since adjacent values
 * are closer than expected under exchangeable shuffle;
 * large mssd indicates NEGATIVE SERIAL DEPENDENCE /
 * oscillation). For the two-sided test we then take
 *
 *     ppTwoSidedPValue = 2 * min(ppPValue, 1 - ppPValue)
 *
 * (Pitman 1937 sec. 4; modern restatement in Edgington
 * & Onghena 2007 *Randomization Tests* 4th ed., sec. 3.3.)
 *
 * For n large enough that n! is intractable we use a
 * FIXED-SEED MONTE CARLO PERMUTATION SAMPLE with B
 * permutations drawn via a deterministic linear-
 * congruential PRNG (see `pitmanLcgPrng` below; uses
 * Numerical Recipes 64-bit LCG constants). The default
 * B = 999 gives a granularity of 1/1000 on the p-value;
 * the +1 (mid-p convention) avoids ties at exactly 0.
 * The PRNG seed is derived deterministically from the
 * series length and the first/last values via a stable
 * mix function (`pitmanSeedFromSeries`) so that the same
 * input series always yields the same p-value across
 * runs and across machines.
 *
 *     ppMcPValueOneSided = ( 1 + #{b : mssd(pi_b(x)) <= mssd(x)} )
 *                          / (B + 1)
 *
 * (the standard "+1" Monte-Carlo p-value of Davison &
 * Hinkley 1997 *Bootstrap Methods and their Application*
 * eq. 4.10, which guarantees exact size alpha under the
 * permutation reference even for finite B.)
 *
 * The standardised z-score is computed against the
 * EXACT PERMUTATION-NULL MOMENTS of MSSD. These are
 * available in closed form (von Neumann 1941 / Bartels
 * 1982 *J. Amer. Stat. Assoc.* 77: 40-46):
 *
 *     E[mssd] = 2 * ssBar
 *     Var[mssd] = (4 / (n - 1)) * ( m4Bar - ssBar^2 )
 *                 -- and a finite-sample correction term
 *
 * where ssBar = (1/n) sum (x[i] - mean(x))^2 and
 * m4Bar = (1/n) sum (x[i] - mean(x))^4.
 *
 * To keep the implementation self-contained and to AVOID
 * mechanistic overlap with the rank-asymptotic Bartels
 * test we use ONLY the leading-order moment-matching
 * (E[mssd] = 2*ssBar; Var[mssd] estimated empirically
 * from the B Monte-Carlo permutations) when reporting
 * the standardised statistic
 *
 *     ppZ = (mssd(x) - 2 * ssBar) / sqrt(Var_MC[mssd])
 *
 * where Var_MC is the SAMPLE VARIANCE of the B
 * permutation mssd values. This gives a self-consistent
 * Monte-Carlo z-score whose REFERENCE IS THE PERMUTATION
 * DISTRIBUTION ITSELF rather than any asymptotic
 * approximation -- the fundamental Pitman 1937
 * principle.
 *
 * SIGN CONVENTION:
 *
 *     ppZ << -1.96 = mssd(x) much smaller than its
 *       permutation expectation = SMOOTHNESS / POSITIVE
 *       LAG-1 SERIAL DEPENDENCE (adjacent observations
 *       atypically similar).
 *     ppZ >> +1.96 = mssd(x) much larger than its
 *       permutation expectation = OSCILLATION /
 *       NEGATIVE LAG-1 SERIAL DEPENDENCE (adjacent
 *       observations atypically dissimilar).
 *     ppZ ~ 0 = no detectable serial pattern at lag 1.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs daily-token-bartels-rank-von-neumann.
 *     Bartels uses RANKS of the values (rank-based
 *     statistic) AND an ASYMPTOTIC NORMAL REFERENCE
 *     (mean = 2, variance = 4(n-2) / (n-1)(n+1) under
 *     the exact permutation distribution). Pitman MSSD
 *     uses RAW VALUES (sensitive to the actual
 *     magnitudes, not just ordinal positions) AND a
 *     FIXED-SEED MONTE CARLO PERMUTATION REFERENCE
 *     (no asymptotic approximation, exact size at
 *     alpha = (k+1)/(B+1) for integer k). A series with
 *     a few extreme outliers but otherwise smooth
 *     dynamics gives a Bartels statistic dominated by
 *     rank smoothness (low Bartels => smooth) but a
 *     Pitman MSSD dominated by the squared outlier
 *     differences (high MSSD => oscillation), and the
 *     two probes will DISAGREE -- this is the
 *     "value-magnitude vs rank-pattern" axis.
 *
 *   - vs axis-206 Jonckheere-Terpstra quartile-blocks.
 *     JT tests for MONOTONIC ORDERED-ALTERNATIVE across
 *     k=4 chronological blocks. Pitman MSSD tests for
 *     LAG-1 SERIAL EXCHANGEABILITY -- a series with
 *     strong global trend but lag-1 randomness (e.g.
 *     linear trend + iid noise) gives jtZ >> 0 but
 *     ppZ ~ 0; conversely a series with no trend but
 *     strong lag-1 oscillation (zigzag) gives jtZ ~ 0
 *     but ppZ >> 0.
 *
 *   - vs axis-205 Cox-Stuart sign-pairs (lag-c paired
 *     sign). Cox-Stuart pairs v[i] with v[i+c] at LAG
 *     c=ceil(n/2) and counts sign-of-difference. Pitman
 *     MSSD aggregates SQUARED DIFFERENCES at LAG 1
 *     across the entire series. Different lag, different
 *     reduction (sign vs squared magnitude), different
 *     reference distribution (asymptotic-normal binomial
 *     vs Monte-Carlo permutation).
 *
 *   - vs axis-203 David-Barton runs-up-down. David-
 *     Barton counts MAXIMAL RUNS of identically-signed
 *     FIRST DIFFERENCES (sign-only summary at lag 1).
 *     Pitman MSSD uses the SQUARED MAGNITUDE of first
 *     differences (continuous summary at lag 1) AND
 *     the permutation null. A series with constant-
 *     amplitude lag-1 oscillation gives both dbZ >> 0
 *     and ppZ >> 0; a series with HETEROSCEDASTIC
 *     lag-1 oscillation (small zigzags around small
 *     values, large zigzags around large values) gives
 *     dbZ >> 0 (run count high) but ppZ dominated by
 *     the large-value jumps -- the magnitude axis.
 *
 *   - vs all halves-comparison axes (Mann-Whitney etc.).
 *     Halves test for MEAN/SCALE EQUALITY between
 *     contiguous halves. Pitman MSSD tests for LAG-1
 *     EXCHANGEABILITY across the ENTIRE series. A
 *     stationary series with iid noise passes BOTH
 *     halves-equal AND lag-1-exchangeable; a non-
 *     stationary series with smooth drift may show
 *     halves-unequal (mean-shift detected) AND lag-1-
 *     smooth (small successive differences); a
 *     stationary series with strong AR(1) noise may
 *     pass halves-equal (no mean shift) but FAIL lag-1
 *     exchangeable (positive serial correlation).
 *
 * Pre-processing: NONE (raw values, gap-filled with
 * zeros for absent days). The MSSD statistic is NOT
 * scale-invariant (mssd(a*x) = a^2 * mssd(x)) but the
 * PERMUTATION P-VALUE is scale-invariant because the
 * scaling cancels in the comparison
 * mssd(pi(x)) <= mssd(x). The statistic IS
 * shift-invariant (mssd(x + c) = mssd(x)). The Z-score
 * is both shift- and scale-invariant.
 *
 * Hard floor on min-tenure-days: 12 (n=12 gives
 * 12! ~ 4.8e8 -- well above the B=999 default Monte-
 * Carlo budget; gives reasonable granularity at the
 * permutation reference even with a small series).
 *
 * Determinism. The PRNG seed is derived from
 * (n, x[0] truncated to int, x[n-1] truncated to int)
 * via the SplitMix64 finaliser (Steele, Lea & Flood
 * 2014 *J. Stat. Comp. Sim.* 84: 1267-1283). The same
 * input series always yields the same B permutations,
 * the same MC mssd values, the same p-value, and the
 * same Z-score across runs and machines.
 *
 * Reference:
 *   Pitman, E. J. G., "Significance tests which may be
 *     applied to samples from any populations",
 *     *Biometrika* 29 (1937), pp. 322-335.
 *   von Neumann, J., "Distribution of the ratio of the
 *     mean square successive difference to the
 *     variance", *Annals of Mathematical Statistics*
 *     12 (1941), pp. 367-395.
 *   Bartels, R., "The rank version of von Neumann's
 *     ratio test for randomness", *J. Amer. Stat.
 *     Assoc.* 77 (1982), pp. 40-46.
 *   Davison, A. C. & Hinkley, D. V., *Bootstrap
 *     Methods and their Application* (Cambridge 1997),
 *     sec. 4.2.
 *   Edgington, E. S. & Onghena, P., *Randomization
 *     Tests*, 4th ed. (Chapman & Hall 2007), sec. 3.3.
 *   Steele, G. L., Lea, D. & Flood, C. H., "Fast
 *     splittable pseudorandom number generators",
 *     *J. Stat. Comp. Sim.* 84 (2014), pp. 1267-1283.
 */
import type { QueueLine } from './types.js';

export type DailyTokenPitmanPermutationMssdRandomnessSort =
  | 'ppZ'
  | 'ppZAbsDesc'
  | 'ppPValue'
  | 'ppPValueDesc'
  | 'ppMssd'
  | 'ppMssdDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPitmanPermutationMssdRandomnessOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 12 so
   * that 12! ~ 4.8e8 permutations is well above the
   * B=999 default Monte-Carlo budget.
   */
  minTenureDays?: number;
  /**
   * Number of Monte-Carlo permutations B. Default 999
   * (gives 1/1000 p-value granularity). Must be a
   * positive integer.
   */
  permutations?: number;
  top?: number;
  sort?: DailyTokenPitmanPermutationMssdRandomnessSort;
  generatedAt?: string;
}

export interface DailyTokenPitmanPermutationMssdRandomnessSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Number of Monte-Carlo permutations used (= options.permutations). */
  ppPermutations: number;
  /** mean of squared successive differences on the observed series. */
  ppMssd: number;
  /** Permutation-mean expectation E[mssd] = 2 * ssBar (closed form). */
  ppMssdExpected: number;
  /** Sample variance of mssd across the B Monte-Carlo permutations. */
  ppMssdVarianceMc: number;
  /** Standardised Z = (mssd(x) - E[mssd]) / sqrt(Var_MC[mssd]). */
  ppZ: number;
  /**
   * Two-sided Monte-Carlo permutation p-value:
   *     2 * min(ppMcPValueLowerOneSided, 1 - ppMcPValueLowerOneSided)
   * with the +1 mid-p convention.
   */
  ppPValue: number;
  /** SplitMix64-derived deterministic PRNG seed used for the B permutations. */
  ppSeed: string;
}

export interface DailyTokenPitmanPermutationMssdRandomnessReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  permutations: number;
  top: number;
  sort: DailyTokenPitmanPermutationMssdRandomnessSort;
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
  sources: DailyTokenPitmanPermutationMssdRandomnessSourceRow[];
}

/**
 * SplitMix64 finaliser (Steele, Lea & Flood 2014).
 * Strong deterministic seed mixer; given any 64-bit
 * input, returns a well-distributed 64-bit output. Used
 * here as the seed-mixer for the per-series PRNG.
 *
 * Implementation note: JS does not have native 64-bit
 * ints; we represent the state as a BigInt and mask to
 * 64 bits at every step. Returns a string of the
 * unsigned 64-bit value (suitable for stable hashing).
 */
export function pitmanSplitMix64(x: bigint): bigint {
  const MASK = (1n << 64n) - 1n;
  let z = (x + 0x9e3779b97f4a7c15n) & MASK;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  z = (z ^ (z >> 31n)) & MASK;
  return z;
}

/**
 * Derive a deterministic 64-bit seed from a value series
 * via SplitMix64-mix of n, floor(x[0]), floor(x[n-1]).
 * Returns the seed as a decimal string (stable across
 * platforms; safe to embed in JSON output for audit).
 */
export function pitmanSeedFromSeries(values: number[]): bigint {
  if (values.length === 0) {
    throw new Error('pitmanSeedFromSeries: empty series');
  }
  const MASK = (1n << 64n) - 1n;
  const n = BigInt(values.length);
  // Truncate first/last values to 64-bit ints (they are
  // gap-filled token totals, always nonneg integers in
  // pew data; the `& MASK` makes us robust to any
  // rounding noise).
  const x0 = BigInt(Math.floor(Math.abs(values[0]!))) & MASK;
  const xn = BigInt(Math.floor(Math.abs(values[values.length - 1]!))) & MASK;
  // Fold n, x0, xn into a single 64-bit seed via three
  // SplitMix64 steps -- avalanches every input bit into
  // every output bit.
  let s = pitmanSplitMix64(n);
  s = pitmanSplitMix64((s ^ x0) & MASK);
  s = pitmanSplitMix64((s ^ xn) & MASK);
  return s;
}

/**
 * SplitMix64-based PRNG: stateful next(). Returns a
 * uniform unsigned 64-bit integer per call. The state
 * advances by adding the SplitMix64 golden-ratio
 * increment (Steele-Lea-Flood 2014 sec. 4.1).
 */
export interface PitmanLcgPrng {
  next(): bigint;
  nextUint32(): number;
}

export function pitmanLcgPrng(seed: bigint): PitmanLcgPrng {
  const MASK = (1n << 64n) - 1n;
  let state = seed & MASK;
  return {
    next(): bigint {
      state = (state + 0x9e3779b97f4a7c15n) & MASK;
      let z = state;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
      z = (z ^ (z >> 31n)) & MASK;
      return z;
    },
    nextUint32(): number {
      const v = this.next();
      // Take the high 32 bits (better quality than the
      // low 32 for many SplitMix64 derivatives).
      return Number((v >> 32n) & 0xffffffffn);
    },
  };
}

/**
 * Compute the mean of squared successive differences
 * statistic
 *     mssd(x) = (1/(n-1)) * sum_{i=1..n-1} (x[i]-x[i-1])^2
 * for n >= 2.
 */
export function pitmanMeanSquaredSuccessiveDifference(
  values: number[],
): number {
  const n = values.length;
  if (n < 2) {
    throw new Error(
      `pitmanMeanSquaredSuccessiveDifference: need at least 2 samples (got ${n})`,
    );
  }
  let sumSq = 0;
  for (let i = 1; i < n; i += 1) {
    const d = values[i]! - values[i - 1]!;
    sumSq += d * d;
  }
  return sumSq / (n - 1);
}

/**
 * In-place Fisher-Yates shuffle using the supplied
 * deterministic PRNG. Mutates `arr`. Returns `arr` for
 * chaining.
 */
export function pitmanFisherYatesShuffleInPlace(
  arr: number[],
  prng: PitmanLcgPrng,
): number[] {
  const n = arr.length;
  for (let i = n - 1; i > 0; i -= 1) {
    // Bounded uniform in [0, i] via rejection.
    const bound = i + 1;
    const limit = Math.floor(0x100000000 / bound) * bound;
    let r: number;
    do {
      r = prng.nextUint32();
    } while (r >= limit);
    const j = r % bound;
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Centred sum-of-squares-bar = (1/n) sum (x[i] - mean(x))^2.
 * Used as the closed-form expectation E[mssd] = 2*ssBar.
 */
export function pitmanCentredVarianceBar(values: number[]): {
  mean: number;
  ssBar: number;
} {
  const n = values.length;
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let ss = 0;
  for (const v of values) {
    const c = v - mu;
    ss += c * c;
  }
  return { mean: mu, ssBar: ss / n };
}

/**
 * Pitman 1937 permutation test for randomness via MSSD.
 * Returns the observed mssd, the closed-form permutation
 * expectation, the Monte-Carlo variance, the standardised
 * Z, and the two-sided MC p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - mssd(x + c) === mssd(x) for any constant c
 *     (squared first-differences are shift-invariant).
 *   - mssd(a * x) === a^2 * mssd(x) for any a.
 *   - The permutation p-value is shift-, scale-, and
 *     sign-invariant when computed against the same
 *     reference distribution (the absolute deviations
 *     from the closed-form expectation cancel).
 *   - For x = repeat(constant) the centred variance is
 *     zero; we throw to be filtered upstream.
 *   - For x strictly monotone (increasing or decreasing
 *     by a constant step) mssd(x) is the SAME constant
 *     under every permutation that preserves the
 *     successive-difference set -- but in a SAMPLED
 *     permutation the random reorderings will give
 *     systematically LARGER mssd, so the lower-tail
 *     p-value is small (smoothness detected).
 */
export function dailyTokenPitmanPermutationMssdRandomness(
  values: number[],
  permutations: number,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  ppPermutations: number;
  ppMssd: number;
  ppMssdExpected: number;
  ppMssdVarianceMc: number;
  ppZ: number;
  ppPValue: number;
  ppSeed: string;
} {
  const n = values.length;
  if (n < 12) {
    throw new Error(
      `dailyTokenPitmanPermutationMssdRandomness: need at least 12 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(permutations) || permutations < 99) {
    throw new Error(
      `dailyTokenPitmanPermutationMssdRandomness: permutations must be integer >= 99 (got ${permutations})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenPitmanPermutationMssdRandomness requires finite values',
      );
    }
  }

  const { mean, ssBar } = pitmanCentredVarianceBar(values);
  if (ssBar === 0) {
    throw new Error(
      `dailyTokenPitmanPermutationMssdRandomness: zero centred variance (n=${n})`,
    );
  }
  const stddev = Math.sqrt(ssBar);

  const observed = pitmanMeanSquaredSuccessiveDifference(values);
  const expected = 2 * ssBar;

  // Build the deterministic PRNG.
  const seed = pitmanSeedFromSeries(values);
  const prng = pitmanLcgPrng(seed);

  // Sample B permutations, accumulate the mssd values
  // and the count of those <= observed.
  const B = permutations;
  const mssdSamples = new Array<number>(B);
  const scratch = values.slice();
  let leCount = 0;
  let sumMssd = 0;
  let sumMssdSq = 0;
  for (let b = 0; b < B; b += 1) {
    pitmanFisherYatesShuffleInPlace(scratch, prng);
    const m = pitmanMeanSquaredSuccessiveDifference(scratch);
    mssdSamples[b] = m;
    sumMssd += m;
    sumMssdSq += m * m;
    if (m <= observed) leCount += 1;
  }
  const meanMc = sumMssd / B;
  // Sample-variance (Bessel-corrected) of the B mssd
  // permutation values.
  const varMc = (sumMssdSq - B * meanMc * meanMc) / (B - 1);
  if (!(varMc > 0) || !Number.isFinite(varMc)) {
    throw new Error(
      `dailyTokenPitmanPermutationMssdRandomness: degenerate MC variance (varMc=${varMc})`,
    );
  }
  const ppZ = (observed - expected) / Math.sqrt(varMc);
  if (!Number.isFinite(ppZ)) {
    throw new Error(
      `dailyTokenPitmanPermutationMssdRandomness: non-finite z (n=${n})`,
    );
  }
  // +1 / (B+1) Monte-Carlo p-value (Davison-Hinkley
  // 1997 eq. 4.10).
  const lowerOneSided = (1 + leCount) / (B + 1);
  const upperOneSided = 1 - lowerOneSided + 1 / (B + 1);
  const ppPValue = Math.min(
    1,
    2 * Math.min(lowerOneSided, upperOneSided),
  );

  return {
    mean,
    stddev,
    nSamples: n,
    ppPermutations: B,
    ppMssd: observed,
    ppMssdExpected: expected,
    ppMssdVarianceMc: varMc,
    ppZ,
    ppPValue,
    ppSeed: seed.toString(),
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) via
 * Abramowitz-Stegun 26.2.17 rational approximation;
 * max relative error ~7.5e-8. Used by the Stouffer
 * aggregator below.
 */
export function standardNormalUpperTailPitmanPermutationMssd(
  z: number,
): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailPitmanPermutationMssd: z must be finite (got ${z})`,
    );
  }
  if (z < 0) {
    return 1 - standardNormalUpperTailPitmanPermutationMssd(-z);
  }
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
 * Corpus-level SIGNED aggregator for axis-207. Combines
 * per-source SIGNED ppZ via Stouffer's Z-method
 * (Stouffer et al. 1949). Skips malformed rows.
 */
export interface PitmanPermutationMssdRandomnessCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanPpZ: number;
  tenureWeightedMeanPpZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregatePitmanPermutationMssdRandomness(
  rows: ReadonlyArray<{
    ppZ: number;
    ppPValue: number;
    nTenureDays: number;
  }>,
): PitmanPermutationMssdRandomnessCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.ppZ) ||
      !Number.isFinite(r.ppPValue) ||
      r.ppPValue <= 0 ||
      r.ppPValue > 1 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays < 12
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.ppZ;
    weightedZSum += r.nTenureDays * r.ppZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanPpZ: Number.NaN,
      tenureWeightedMeanPpZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailPitmanPermutationMssd(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanPpZ: zSum / used,
    tenureWeightedMeanPpZ: weightedZSum / totalTenure,
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

export function buildDailyTokenPitmanPermutationMssdRandomness(
  queue: QueueLine[],
  opts: DailyTokenPitmanPermutationMssdRandomnessOptions = {},
): DailyTokenPitmanPermutationMssdRandomnessReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 12;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 12) {
    throw new Error(
      `minTenureDays must be an integer >= 12 (got ${opts.minTenureDays})`,
    );
  }
  const permutations = opts.permutations ?? 999;
  if (!Number.isInteger(permutations) || permutations < 99) {
    throw new Error(
      `permutations must be an integer >= 99 (got ${opts.permutations})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenPitmanPermutationMssdRandomnessSort =
    opts.sort ?? 'ppZAbsDesc';
  const validSorts: DailyTokenPitmanPermutationMssdRandomnessSort[] = [
    'ppZ',
    'ppZAbsDesc',
    'ppPValue',
    'ppPValueDesc',
    'ppMssd',
    'ppMssdDesc',
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
  const rows: DailyTokenPitmanPermutationMssdRandomnessSourceRow[] = [];

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
      result = dailyTokenPitmanPermutationMssdRandomness(filled, permutations);
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
      ppPermutations: result.ppPermutations,
      ppMssd: result.ppMssd,
      ppMssdExpected: result.ppMssdExpected,
      ppMssdVarianceMc: result.ppMssdVarianceMc,
      ppZ: result.ppZ,
      ppPValue: result.ppPValue,
      ppSeed: result.ppSeed,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'ppZ':
        primary = a.ppZ - b.ppZ;
        break;
      case 'ppZAbsDesc':
        primary = Math.abs(b.ppZ) - Math.abs(a.ppZ);
        break;
      case 'ppPValue':
        primary = a.ppPValue - b.ppPValue;
        break;
      case 'ppPValueDesc':
        primary = b.ppPValue - a.ppPValue;
        break;
      case 'ppMssd':
        primary = a.ppMssd - b.ppMssd;
        break;
      case 'ppMssdDesc':
        primary = b.ppMssd - a.ppMssd;
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
