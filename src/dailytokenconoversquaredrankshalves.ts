/**
 * daily-token-conover-squared-ranks-halves: per-source
 * CONOVER (1971/1980) SQUARED-RANKS SCALE TEST for
 * equality of dispersion between the first half
 * (n1 = floor(n/2) days) vs second half (n2 = n - n1
 * days) of the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Conover (1971 *Practical Nonparametric Statistics* 1st
 * ed. sec. 5.3; refined Conover & Iman 1978 *J. Amer.
 * Statist. Assoc.* 73:498-506) proposed the SQUARED-RANKS
 * SCALE TEST. Construct the absolute deviations from the
 * within-half median
 *
 *     u_i = | x_i - median(A) |       for i in A
 *     v_j = | x_{n1+j} - median(B) |  for j in B
 *
 * pool the n = n1 + n2 deviations, assign mid-ranks
 * R_1, ..., R_n (1..n; ties get average rank), and form
 * the SQUARED-RANK STATISTIC over the SECOND sample
 *
 *     T = sum_{j in B} R_j^2
 *
 * Under H0 of equal dispersion, with pooled squared-rank
 * mean and squared-rank sum-of-squares
 *
 *     Rbar2 = (1/n) sum_i R_i^2
 *     SS    = sum_i ( R_i^2 - Rbar2 )^2
 *
 * the exact null moments (Conover 1980 eq. 5.3.1-5.3.2)
 * are
 *
 *     E[T]   = n2 * Rbar2
 *     Var[T] = ( n1 * n2 / ( n * (n - 1) ) ) * SS
 *
 * giving the standardised statistic
 *
 *     conoverZ = ( T - E[T] ) / sqrt(Var[T])
 *              ~ N(0, 1)   (asymptotically; Conover & Iman
 *                           1978 Tab. 2 shows the normal
 *                           approximation is accurate to
 *                           within 1% on alpha for
 *                           n1 = n2 >= 8)
 *
 * Two-sided p-value
 *
 *     conoverPValue = 2 * ( 1 - Phi( |conoverZ| ) )
 *
 * SIGN CONVENTION: conoverZ > 0 <=> SECOND half has LARGER
 * dispersion (deviations |x - median(B)| concentrate in
 * the upper ranks of the pooled |.| ordering); conoverZ
 * < 0 <=> FIRST half has larger dispersion. Matches
 * axis-117 stZ, axis-170 abZ, and axis-177 klotzZ
 * directional convention for direct cross-axis
 * aggregation.
 *
 * Pre-alignment: the Conover squared-ranks test takes the
 * absolute deviation from EACH HALF'S OWN MEDIAN before
 * pooling — this is the within-sample-centring approach
 * recommended by Conover & Iman 1978 sec. 3 (eq. 7),
 * which removes location confounding while preserving
 * dispersion differences. (The alternative pooled-median
 * centring of Mood 1954 introduces a small location-shift
 * bias under unequal n1, n2; the within-sample variant
 * is the modern textbook default — Conover 1999
 * *Practical Nonparametric Statistics* 3rd ed. sec. 5.3
 * Tab. 5.3.)
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-177 daily-token-klotz-halves (Klotz 1962).
 *     Klotz uses SQUARED NORMAL SCORES on the pooled
 *     RAW VALUES, a(R_i) = ( Phi^{-1}( R_i / (n+1) ) )^2.
 *     Conover uses SQUARED RAW RANKS R_i^2 on the pooled
 *     ABSOLUTE DEVIATIONS |X - median|. Two distinct
 *     mechanisms: (i) Klotz transforms ranks through the
 *     inverse-normal CDF (so weights are TAIL-AMPLIFIED
 *     by the standard-normal density); Conover squares
 *     the LINEAR ranks directly (weights grow only as
 *     R^2, NOT exponentially). (ii) Klotz operates on
 *     the raw aligned values; Conover operates on
 *     ABSOLUTE-DEVIATION SPACE which folds the
 *     distribution about each half's median first. Klotz
 *     has Pitman ARE 1.000 vs F under normal-scale
 *     alternatives; Conover has ARE 6/(pi^2) ~ 0.608
 *     under normal but is more powerful than Klotz under
 *     UNIFORM and DOUBLE-EXPONENTIAL scale alternatives
 *     (Conover & Iman 1978 Tab. 4: Conover/Klotz ARE
 *     1.50 under Cauchy, 0.85 under normal). The two
 *     reject MEANINGFULLY DIFFERENTLY when the dispersion
 *     shift is symmetric-shoulder (favours Conover) vs
 *     tail-concentrated (favours Klotz).
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves
 *     (Siegel-Tukey 1960). ST uses LINEAR "outside-in"
 *     ranks 1, n, 2, n-1, ... assigned by
 *     position-from-extremes on the RAW pooled order.
 *     Conover assigns STANDARD ASCENDING ranks on
 *     |X - median| then SQUARES THEM. ST has Pitman ARE
 *     ~0.608 vs F; Conover has the same ARE under normal
 *     but is more robust to ties (ST's outside-in
 *     allocation rule is undefined for ties without
 *     additional sub-rules; Conover's mid-ranks handle
 *     ties uniformly). The two operate in different
 *     spaces (pooled raw values vs pooled |X - median|)
 *     and rank by different rules (interleaved vs
 *     squared-ascending).
 *
 *   - vs axis-170 daily-token-ansari-bradley-halves
 *     (Ansari-Bradley 1960). AB uses FOLDED LINEAR ranks
 *     |R - (n+1)/2| (a triangular weight function on the
 *     RAW pooled order). Conover uses SQUARED ASCENDING
 *     ranks on |X - median| (a quadratic weight function
 *     in absolute-deviation space). AB folds ranks about
 *     the midpoint of the rank ordering; Conover folds
 *     OBSERVATIONS about each half's median, then ranks
 *     ascendingly, then squares. Different folding
 *     locations and different weight curves; the two
 *     reject differently when the location of the rank
 *     centre and the location of the value-median
 *     diverge (e.g., heavily skewed distributions).
 *
 *   - vs axis-122 daily-token-brown-forsyth-halves
 *     (Brown-Forsythe 1974) and axis-123 daily-token-
 *     bartlett-cumulative-periodogram. BF/Bartlett are
 *     PARAMETRIC tests on squared deviations from the
 *     mean/median; asymptotically equivalent to F under
 *     normality but break down under heavy tails.
 *     Conover is fully nonparametric and DISTRIBUTION-FREE
 *     under H0 (Conover & Iman 1978 sec. 4; holds nominal
 *     alpha under any continuous null distribution).
 *
 *   - vs axis-115/176 Mann-Whitney/Brunner-Munzel
 *     (STOCHASTIC ORDERING tests on raw values). MW/BM
 *     test for stochastic dominance; pure scale shift with
 *     equal medians gives MW/BM ~ 0 while Conover rejects
 *     strongly (Conover operates on ABSOLUTE DEVIATIONS
 *     which detect dispersion regardless of location).
 *     Cross-loading near zero by construction.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi-2(2)
 *     location-scale tests). C/L combine a location and
 *     scale statistic into one chi-2(2); they cannot
 *     SEPARATE the two channels. Conover is a pure scale
 *     test isolating the dispersion question.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Conover & Iman 1978 sec. 5 simulation: actual size
 * 0.046-0.053 across n1 = n2 in [8, 50]).
 *
 * Reference:
 *   Conover, W. J., *Practical Nonparametric Statistics*
 *     1st ed. (Wiley 1971), sec. 5.3.
 *   Conover, W. J. & Iman, R. L., "Some exact tables for
 *     the squared ranks test", *Comm. Statist. Simulation
 *     Comput.* B7 (1978), pp. 491-513.
 *   Conover, W. J. & Iman, R. L., "Rank transformations
 *     as a bridge between parametric and nonparametric
 *     statistics", *J. Amer. Statist. Assoc.* 73(364)
 *     (1978), pp. 498-506.
 *   Conover, W. J., *Practical Nonparametric Statistics*
 *     3rd ed. (Wiley 1999), sec. 5.3.
 *   Mood, A. M., "On the asymptotic efficiency of certain
 *     nonparametric two-sample tests", *Ann. Math.
 *     Statist.* 25 (1954), pp. 514-522.
 */
import type { QueueLine } from './types.js';

export type DailyTokenConoverSquaredRanksHalvesSort =
  | 'conoverZ'
  | 'conoverZAbsDesc'
  | 'conoverPValue'
  | 'conoverPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenConoverSquaredRanksHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Conover & Iman 1978 sec. 5).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenConoverSquaredRanksHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenConoverSquaredRanksHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  conoverN1: number;
  /** Second-half size n2 = n - n1. */
  conoverN2: number;
  /** Pooled squared-rank mean Rbar2 = (1/n) sum R_i^2. */
  conoverRbar2: number;
  /** Sum of squared deviations of R_i^2 from Rbar2. */
  conoverScoreSS: number;
  /** Conover statistic T = sum_{j in B} R_j^2. */
  conoverT: number;
  /** Null mean E[T] = n2 * Rbar2. */
  conoverExpT: number;
  /** Null variance Var[T] = n1 n2 / (n(n-1)) * SS. */
  conoverVarT: number;
  /** Standardised Conover Z ~ N(0, 1) under H0. */
  conoverZ: number;
  /** Two-sided normal p-value 2(1 - Phi(|conoverZ|)). */
  conoverPValue: number;
}

export interface DailyTokenConoverSquaredRanksHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenConoverSquaredRanksHalvesSort;
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
  sources: DailyTokenConoverSquaredRanksHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksConover(values: number[]): number[] {
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
 * the input). Standard textbook definition: average of
 * the two middle order statistics for even n, the middle
 * order statistic for odd n.
 */
export function medianConover(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianConover: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Conover (1971/1980) squared-ranks scale test on the
 * first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series. Each half is
 * folded about its OWN median (Conover & Iman 1978 eq. 7
 * within-sample centring), the pooled absolute deviations
 * are mid-ranked, the ranks are SQUARED, and the
 * second-sample sum is standardised under the exact null
 * moments.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - conoverZ(x + c) === conoverZ(x) for any constant c
 *     (the within-sample medians shift by c too, so
 *     |x - median| is invariant).
 *   - conoverZ(a * x) === conoverZ(x) for any a > 0
 *     (positive scale preserves both halves' medians and
 *     the pooled mid-rank ordering on |X - median|).
 *   - conoverZ is invariant under independent location
 *     shifts of A and B (the within-sample median-fold
 *     subtracts each half's median first).
 *   - For x = repeat(constant) the test is undefined
 *     (zero squared-rank variance after folding); we
 *     throw to be filtered upstream.
 *   - conoverZ(reverse(x)) === -conoverZ(x) WHEN n1 = n2
 *     AND there are no ties (swapping halves negates the
 *     numerator (T - E[T]); Var[T] is symmetric in the
 *     labels).
 */
export function dailyTokenConoverSquaredRanksHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  conoverN1: number;
  conoverN2: number;
  conoverRbar2: number;
  conoverScoreSS: number;
  conoverT: number;
  conoverExpT: number;
  conoverVarT: number;
  conoverZ: number;
  conoverPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenConoverSquaredRanksHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenConoverSquaredRanksHalves requires finite values');
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
      `dailyTokenConoverSquaredRanksHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Within-sample median fold (Conover & Iman 1978 eq. 7).
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianConover(aRaw);
  const bMed = medianConover(bRaw);
  const dev = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) dev[i] = Math.abs(aRaw[i]! - aMed);
  for (let j = 0; j < n2; j += 1) dev[n1 + j] = Math.abs(bRaw[j]! - bMed);

  // Pooled mid-ranks on the absolute deviations.
  const ranks = midRanksConover(dev);

  // Squared raw ranks R_i^2 (the Conover score function).
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const r = ranks[i]!;
    scores[i] = r * r;
  }

  let rbar2 = 0;
  for (let i = 0; i < n; i += 1) rbar2 += scores[i]!;
  rbar2 /= n;

  let scoreSS = 0;
  for (let i = 0; i < n; i += 1) {
    const c = scores[i]! - rbar2;
    scoreSS += c * c;
  }
  if (!(scoreSS > 0) || !Number.isFinite(scoreSS)) {
    throw new Error(
      `dailyTokenConoverSquaredRanksHalves: degenerate score variance (scoreSS=${scoreSS})`,
    );
  }

  let T = 0;
  for (let j = 0; j < n2; j += 1) T += scores[n1 + j]!;

  const expT = n2 * rbar2;
  const varT = ((n1 * n2) / (n * (n - 1))) * scoreSS;
  if (!(varT > 0) || !Number.isFinite(varT)) {
    throw new Error(
      `dailyTokenConoverSquaredRanksHalves: degenerate null variance (varT=${varT})`,
    );
  }
  const conoverZ = (T - expT) / Math.sqrt(varT);
  const conoverPValue =
    2 * standardNormalUpperTailConover(Math.abs(conoverZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    conoverN1: n1,
    conoverN2: n2,
    conoverRbar2: rbar2,
    conoverScoreSS: scoreSS,
    conoverT: T,
    conoverExpT: expT,
    conoverVarT: varT,
    conoverZ,
    conoverPValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailConover(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(
      `standardNormalUpperTailConover: z must be finite (got ${z})`,
    );
  }
  if (z < 0) return 1 - standardNormalUpperTailConover(-z);
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
 * Corpus-level SIGNED aggregator for axis-178 per-source
 * results. Combines the per-source SIGNED conoverZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949 *American
 * Soldier* vol. 1, sec. 2.2; Whitlock 2005 *J. Evol.
 * Biol.* 18:1368-1373):
 *
 *     stoufferZ = sum_i conoverZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * This is the SIGNED counterpart to the Lancaster /
 * Fisher unsigned aggregators used for the chi-2(2)
 * joint location-scale axes 174/175 (where positive and
 * negative evidence cannot meaningfully cancel). conoverZ
 * is intrinsically signed (positive = second half MORE
 * dispersed; negative = first half MORE dispersed) so
 * Stouffer is the correct meta-analytic combiner —
 * opposite-direction sources can meaningfully cancel,
 * which is exactly what the unsigned chi-2(2) Lancaster
 * combiner can NOT express.
 *
 * Also returns
 *
 *   - meanConoverZ — unweighted corpus-mean conoverZ
 *   - tenureWeightedMeanConoverZ — nTenureDays-weighted
 *     mean conoverZ (matches the axis-175 v0.6.452,
 *     axis-176 v0.6.453, axis-177 v0.6.456 weighting
 *     convention)
 *   - rowsUsed, rowsSkipped — counters; malformed rows
 *     (non-finite conoverZ, conoverPValue not in (0, 1],
 *     non-positive conoverVarT or nTenureDays) are
 *     SKIPPED with a counter rather than throwing.
 *
 * AXIS-CROSS USE. Combined elementwise with axis-177's
 * `aggregateKlotzHalves` (signed Stouffer over klotzZ),
 * the two corpus-mean Z scores form an ORTHOGONAL
 * scale-detector pair: agreement on sign confirms a
 * dispersion shift in BOTH the rank-quadratic (Conover)
 * AND tail-amplified-normal-score (Klotz) channels;
 * disagreement localises the alternative to either
 * shoulder-dominant (Conover-only) or tail-dominant
 * (Klotz-only) regimes.
 */
export interface ConoverSquaredRanksHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanConoverZ: number;
  tenureWeightedMeanConoverZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateConoverSquaredRanksHalves(
  rows: ReadonlyArray<{
    conoverZ: number;
    conoverPValue: number;
    conoverVarT: number;
    nTenureDays: number;
  }>,
): ConoverSquaredRanksHalvesCorpusAggregate {
  let zSum = 0;
  let zRawSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.conoverZ) ||
      !Number.isFinite(r.conoverPValue) ||
      r.conoverPValue <= 0 ||
      r.conoverPValue > 1 ||
      !Number.isFinite(r.conoverVarT) ||
      r.conoverVarT <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.conoverZ;
    zRawSum += r.conoverZ;
    weightedZSum += r.nTenureDays * r.conoverZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanConoverZ: Number.NaN,
      tenureWeightedMeanConoverZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailConover(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanConoverZ: zRawSum / used,
    tenureWeightedMeanConoverZ: weightedZSum / totalTenure,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Directional label classifier for axis-178 per-source
 * conoverZ. Maps the signed standardised statistic to one
 * of five mutually-exclusive verdict buckets at
 * configurable two-sided alpha (default 0.05):
 *
 *   - 'second-decisively-more-dispersed' if conoverZ > 0
 *     AND conoverPValue < alpha
 *   - 'first-decisively-more-dispersed'  if conoverZ < 0
 *     AND conoverPValue < alpha
 *   - 'second-leans-more-dispersed' if conoverZ > 0 AND
 *     alpha <= conoverPValue < 2 * alpha (suggestive but
 *     not significant at the chosen level)
 *   - 'first-leans-more-dispersed'  if conoverZ < 0 AND
 *     alpha <= conoverPValue < 2 * alpha
 *   - 'no-evidence-of-dispersion-shift' otherwise
 *
 * Throws on malformed input (non-finite Z, P outside
 * (0, 1], alpha outside (0, 0.5]).
 */
export type ConoverDirectionalLabel =
  | 'second-decisively-more-dispersed'
  | 'first-decisively-more-dispersed'
  | 'second-leans-more-dispersed'
  | 'first-leans-more-dispersed'
  | 'no-evidence-of-dispersion-shift';

export function labelConoverSquaredRanksHalvesRow(
  row: { conoverZ: number; conoverPValue: number },
  alpha = 0.05,
): ConoverDirectionalLabel {
  if (!Number.isFinite(row.conoverZ)) {
    throw new Error(
      `labelConoverSquaredRanksHalvesRow: conoverZ must be finite (got ${row.conoverZ})`,
    );
  }
  if (
    !Number.isFinite(row.conoverPValue) ||
    row.conoverPValue <= 0 ||
    row.conoverPValue > 1
  ) {
    throw new Error(
      `labelConoverSquaredRanksHalvesRow: conoverPValue must be in (0, 1] (got ${row.conoverPValue})`,
    );
  }
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 0.5) {
    throw new Error(
      `labelConoverSquaredRanksHalvesRow: alpha must be in (0, 0.5] (got ${alpha})`,
    );
  }
  const lean = 2 * alpha;
  if (row.conoverPValue < alpha) {
    return row.conoverZ > 0
      ? 'second-decisively-more-dispersed'
      : 'first-decisively-more-dispersed';
  }
  if (row.conoverPValue < lean) {
    return row.conoverZ > 0
      ? 'second-leans-more-dispersed'
      : 'first-leans-more-dispersed';
  }
  return 'no-evidence-of-dispersion-shift';
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

export function buildDailyTokenConoverSquaredRanksHalves(
  queue: QueueLine[],
  opts: DailyTokenConoverSquaredRanksHalvesOptions = {},
): DailyTokenConoverSquaredRanksHalvesReport {
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
  const sort: DailyTokenConoverSquaredRanksHalvesSort =
    opts.sort ?? 'conoverZAbsDesc';
  const validSorts: DailyTokenConoverSquaredRanksHalvesSort[] = [
    'conoverZ',
    'conoverZAbsDesc',
    'conoverPValue',
    'conoverPValueDesc',
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
  const rows: DailyTokenConoverSquaredRanksHalvesSourceRow[] = [];

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
      result = dailyTokenConoverSquaredRanksHalves(filled);
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
      conoverN1: result.conoverN1,
      conoverN2: result.conoverN2,
      conoverRbar2: result.conoverRbar2,
      conoverScoreSS: result.conoverScoreSS,
      conoverT: result.conoverT,
      conoverExpT: result.conoverExpT,
      conoverVarT: result.conoverVarT,
      conoverZ: result.conoverZ,
      conoverPValue: result.conoverPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'conoverZ':
        primary = a.conoverZ - b.conoverZ;
        break;
      case 'conoverZAbsDesc':
        primary = Math.abs(b.conoverZ) - Math.abs(a.conoverZ);
        break;
      case 'conoverPValue':
        primary = a.conoverPValue - b.conoverPValue;
        break;
      case 'conoverPValueDesc':
        primary = b.conoverPValue - a.conoverPValue;
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
