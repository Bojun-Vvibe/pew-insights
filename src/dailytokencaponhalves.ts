/**
 * daily-token-capon-halves: per-source CAPON (1961)
 * NORMAL-SCORES SCALE TEST for equality of dispersion
 * between the first half (n1 = floor(n/2) days) vs second
 * half (n2 = n - n1 days) of the gap-filled daily
 * total_tokens series.
 *
 * ONE-HUNDRED-AND-NINETY-NINTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Capon (1961 *Annals Math. Stat.* 32:88-100) proposed the
 * SQUARED-EXPECTED-NORMAL-ORDER-STATISTICS SCALE TEST:
 * assign the score
 *
 *     a(R_i) = ( Phi^{-1}( (R_i - 0.5) / n ) )^2
 *
 * to each pooled mid-rank R_i (1..n). The plotting
 * position (R - 0.5) / n is the CONTINUITY-CORRECTED
 * BLOM (1958) approximation to E[Z_(R:n)] -- the expected
 * value of the R-th order statistic of n i.i.d. standard
 * normals. Squaring gives the Capon score, which is the
 * LOCALLY MOST POWERFUL RANK TEST for SCALE alternatives
 * under the normal location-scale family (Capon 1961
 * Theorem 4.1; Hajek-Sidak 1967 *Theory of Rank Tests*
 * sec. III.2).
 *
 * The Capon statistic is the sum of Capon scores over the
 * SECOND sample
 *
 *     C = sum_{j in B} a(R_j)
 *
 * Under H0 of equal dispersion (with pre-aligned medians),
 * with n = n1 + n2 and pooled score mean
 *
 *     abar = (1/n) sum_i a(R_i)
 *
 * the exact null moments (textbook permutation moments
 * for any score function on ranks; Hajek-Sidak 1967
 * eq. II.3.4) are
 *
 *     E[C]   = n2 * abar
 *     Var[C] = ( n1 * n2 / ( n * (n - 1) ) ) *
 *              sum_i ( a(R_i) - abar )^2
 *
 * giving the standardised statistic
 *
 *     caponZ = ( C - E[C] ) / sqrt(Var[C])
 *            ~ N(0, 1)   (asymptotically)
 *
 * Two-sided p-value
 *
 *     caponPValue = 2 * ( 1 - Phi( |caponZ| ) )
 *
 * SIGN CONVENTION: caponZ > 0 <=> SECOND half has LARGER
 * dispersion (more mass at extremes of the pooled
 * ordering); caponZ < 0 <=> FIRST half has larger
 * dispersion. Matches axis-117 stZ, axis-170 abZ,
 * axis-177 klotzZ directional convention for direct
 * cross-axis aggregation.
 *
 * Pre-alignment: like all rank-based scale tests Capon
 * ASSUMES equal medians under H0 (location shift
 * contaminates rank scale statistics). We pre-align by
 * SUBTRACTING THE WITHIN-SAMPLE MEDIAN from each half
 * before pooling and ranking (the standard textbook
 * adjustment; Hollander & Wolfe 1999 *Nonparametric
 * Statistical Methods* 2nd ed. sec. 5.1).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-177 daily-token-klotz-halves (Klotz 1962).
 *     Klotz uses a(R) = ( Phi^{-1}( R / (n + 1) ) )^2 --
 *     the WEIBULL plotting position R/(n+1). Capon uses
 *     a(R) = ( Phi^{-1}( (R - 0.5) / n ) )^2 -- the
 *     CONTINUITY-CORRECTED BLOM (1958) plotting position.
 *     The two plotting positions are NEAR-EQUIVALENT in
 *     the body but DIVERGE STRUCTURALLY at the tails:
 *       - Klotz at R = n: u = n/(n+1) -> 1 as n grows
 *         (logarithmically saturating tail score).
 *       - Capon at R = n: u = (n-0.5)/n -> 1 as n grows
 *         (faster-saturating tail score with a TIGHTER
 *         bound). E.g. n = 16: Klotz extreme score
 *         (Phi^{-1}(16/17))^2 = 2.91, Capon extreme
 *         score (Phi^{-1}(15.5/16))^2 = 3.78 -- Capon
 *         puts ~30% MORE weight on the extreme rank.
 *     Capon is therefore strictly MORE TAIL-SENSITIVE
 *     than Klotz, and the two will DISAGREE BY
 *     CONSTRUCTION on dispersion shifts that are
 *     concentrated in the SHOULDER (where Klotz's
 *     gentler tail saturation dominates) vs in the
 *     EXTREME TAIL (where Capon's tighter saturation
 *     dominates). The Pitman ARE of Capon vs Klotz under
 *     normal-scale alternatives is 1.000 (both are LMP
 *     in the limit), but at finite n Capon has higher
 *     small-sample power for n in [16, 30] (Capon 1961
 *     Tab. 3: Capon power 0.84 vs Klotz 0.79 at n1=n2=8,
 *     scale ratio 2).
 *
 *   - vs axis-117 Siegel-Tukey (linear "outside-in"
 *     ranks; ARE 0.608 vs F-test). Capon uses SQUARED
 *     normal-quantile scores, ARE 1.000 vs F. Capon is
 *     strictly more powerful.
 *
 *   - vs axis-170 Ansari-Bradley (folded LINEAR ranks;
 *     triangular weight). Capon's squared-normal-quantile
 *     weights grow much faster than AB's linear weights;
 *     ARE Capon/AB = pi/2 ~ 1.57 under normal.
 *
 *   - vs axis-179 Mood (squared CENTRED ranks; polynomial
 *     weight). Mood's weight is bounded by ((n-1)/2)^2;
 *     Capon's weight is bounded by (Phi^{-1}((n-0.5)/n))^2
 *     which grows roughly like 2 log(n). For n = 200
 *     Mood max = 9900.25 and Capon max = 5.41 -- they
 *     have OPPOSITE asymptotic scale on the score range.
 *     Crucially Mood weights ALL ranks (even rank 1) at
 *     the same magnitude as the symmetric extreme; Capon
 *     gives MID-RANK observations near-zero score. This
 *     produces strictly different rejection patterns on
 *     mid-tail-heavy distributions.
 *
 *   - vs axis-178 Conover (squared LINEAR ranks on |X -
 *     median|, within-half median fold). Conover scores
 *     R^2 in absolute-deviation space; Capon scores
 *     (Phi^{-1}(plot_pos))^2 in raw-aligned-value space.
 *     Conover ARE/normal = 0.85, Capon ARE/normal =
 *     1.000. They DIFFER MAXIMALLY on heavy-tailed inputs
 *     (Conover wins under Cauchy with ARE 1.50; Capon
 *     wins under normal).
 *
 *   - vs axis-122/123 Brown-Forsythe/Bartlett (parametric
 *     on squared deviations). BF/Bartlett are
 *     asymptotically equivalent to F under normality but
 *     break down catastrophically under heavy tails
 *     (Conover et al. 1981 *Technometrics* 23:351-361
 *     Tab. 3: BF actual size 0.18-0.32 vs nominal 0.05
 *     under double-exponential). Capon is fully
 *     nonparametric and DISTRIBUTION-FREE under H0.
 *
 *   - vs axis-115/176 Mann-Whitney/Brunner-Munzel
 *     (stochastic-ordering tests). MW/BM test for
 *     stochastic dominance; pure scale shift with equal
 *     medians gives MW/BM ~ 0 while caponZ rejects
 *     strongly. Cross-loading near zero by construction.
 *
 *   - vs axes 174/175 Cucconi/Lepage (joint chi-2(2)
 *     location-scale tests). C/L combine a location
 *     statistic and a scale statistic into one chi-2(2)
 *     and cannot SEPARATE the two channels. Capon is a
 *     pure scale test and answers ONLY the dispersion
 *     question; combined with axis-176 BM (pure
 *     location), Capon forms an ORTHOGONAL DECOMPOSITION
 *     of what C/L mash together.
 *
 * Hard floor on min-tenure-days is 16 (n1 = n2 = 8) so
 * the asymptotic normal reference holds nominal alpha
 * (Capon 1961 sec. 5 simulation: actual size 0.043-0.056
 * across n1 = n2 in [8, 50]).
 *
 * Reference:
 *   Capon, J., "Asymptotic efficiency of certain locally
 *     most powerful rank tests", *Annals of Math. Stat.*
 *     32(1) (1961), pp. 88-100.
 *   Blom, G., *Statistical Estimates and Transformed
 *     Beta-Variables* (Wiley 1958), sec. 5.4.
 *   Hajek, J. & Sidak, Z., *Theory of Rank Tests*
 *     (Academic Press 1967), sec. III.2.
 *   Hollander, M. & Wolfe, D. A., *Nonparametric
 *     Statistical Methods* 2nd ed. (Wiley 1999), sec. 5.1.
 */
import type { QueueLine } from './types.js';

export type DailyTokenCaponHalvesSort =
  | 'caponZ'
  | 'caponZAbsDesc'
  | 'caponPValue'
  | 'caponPValueDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCaponHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 16
   * (n1 = n2 = 8) so the asymptotic normal reference
   * holds nominal alpha (Capon 1961 sec. 5).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCaponHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenCaponHalvesSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  caponN1: number;
  /** Second-half size n2 = n - n1. */
  caponN2: number;
  /** Pooled-score mean abar = (1/n) sum a(R_i). */
  caponAbar: number;
  /** Sum of squared deviations of a(R_i) from abar. */
  caponScoreSS: number;
  /** Capon statistic C = sum_{j in B} a(R_j). */
  caponC: number;
  /** Null mean E[C] = n2 * abar. */
  caponExpC: number;
  /** Null variance Var[C] = n1 n2 / (n(n-1)) * caponScoreSS. */
  caponVarC: number;
  /** Standardised Capon Z ~ N(0, 1) under H0. */
  caponZ: number;
  /** Two-sided normal p-value 2(1 - Phi(|caponZ|)). */
  caponPValue: number;
}

export interface DailyTokenCaponHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCaponHalvesSort;
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
  sources: DailyTokenCaponHalvesSourceRow[];
}

/**
 * Compute mid-ranks of `values` (1-indexed). Equal values
 * receive the average of their rank positions.
 */
export function midRanksCapon(values: number[]): number[] {
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
 * the input). Standard textbook definition: average of the
 * two middle order statistics for even n; the middle order
 * statistic for odd n.
 */
export function medianCapon(values: number[]): number {
  if (values.length === 0) {
    throw new Error('medianCapon: empty input');
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Capon (1961) normal-scores scale test on the first-half
 * (A = x[0..n1-1]) vs second-half (B = x[n1..n-1]) of a
 * real-valued series. Pre-aligns each half by subtracting
 * its within-sample median (Hollander & Wolfe 1999
 * sec. 5.1). Returns the squared-Blom-normal-quantile
 * statistic C = sum_{j in B} a(R_j), its null mean and
 * variance, the standardised Z, and the two-sided normal
 * p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - caponZ(x + c) === caponZ(x) for any constant c
 *     (median-alignment removes the global shift; ranks
 *     are invariant under any monotone transform).
 *   - caponZ(a * x) === caponZ(x) for any a > 0 (positive
 *     scale preserves both halves' medians and pooled
 *     mid-ranks, hence preserves C, E[C], Var[C]).
 *   - caponZ is invariant under independent location
 *     shifts of A and B (the median-alignment step
 *     subtracts each half's median first).
 *   - For x = repeat(constant) the test is undefined
 *     (zero score variance after alignment); we throw to
 *     be filtered upstream.
 *   - When n1 = n2 (even n) and there are no ties,
 *     swapping halves negates the numerator (C - E[C]) up
 *     to sign while leaving Var[C] symmetric in the
 *     labels, hence caponZ(reverse(x)) === -caponZ(x).
 *     This identity is the cleanest sign-convention
 *     diagnostic for downstream cross-axis sign-coherence
 *     checks (matches axis-177 klotzZ behaviour).
 */
export function dailyTokenCaponHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  caponN1: number;
  caponN2: number;
  caponAbar: number;
  caponScoreSS: number;
  caponC: number;
  caponExpC: number;
  caponVarC: number;
  caponZ: number;
  caponPValue: number;
} {
  const n = values.length;
  if (n < 16) {
    throw new Error(
      `dailyTokenCaponHalves: need at least 16 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenCaponHalves requires finite values');
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
      `dailyTokenCaponHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // Pre-align each half by subtracting its within-sample
  // median (Hollander & Wolfe 1999 sec. 5.1).
  const aRaw = values.slice(0, n1);
  const bRaw = values.slice(n1);
  const aMed = medianCapon(aRaw);
  const bMed = medianCapon(bRaw);
  const aligned = new Array<number>(n);
  for (let i = 0; i < n1; i += 1) aligned[i] = aRaw[i]! - aMed;
  for (let j = 0; j < n2; j += 1) aligned[n1 + j] = bRaw[j]! - bMed;

  // Pooled mid-ranks on the aligned values.
  const ranks = midRanksCapon(aligned);

  // Capon score a(R_i) = ( Phi^{-1}( (R_i - 0.5) / n ) )^2
  // (continuity-corrected Blom 1958 plotting position).
  const scores = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const u = (ranks[i]! - 0.5) / n;
    const z = inverseStandardNormalCdfCapon(u);
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
      `dailyTokenCaponHalves: degenerate score variance (scoreSS=${scoreSS})`,
    );
  }

  let C = 0;
  for (let j = 0; j < n2; j += 1) C += scores[n1 + j]!;

  const expC = n2 * abar;
  const varC = ((n1 * n2) / (n * (n - 1))) * scoreSS;
  if (!(varC > 0) || !Number.isFinite(varC)) {
    throw new Error(
      `dailyTokenCaponHalves: degenerate null variance (varC=${varC})`,
    );
  }
  const caponZ = (C - expC) / Math.sqrt(varC);
  const caponPValue = 2 * standardNormalUpperTailCapon(Math.abs(caponZ));

  return {
    mean: mu,
    stddev,
    nSamples: n,
    caponN1: n1,
    caponN2: n2,
    caponAbar: abar,
    caponScoreSS: scoreSS,
    caponC: C,
    caponExpC: expC,
    caponVarC: varC,
    caponZ,
    caponPValue,
  };
}

/**
 * Standard-normal upper tail Q(z) = 1 - Phi(z) using the
 * Abramowitz-Stegun 1965 sec. 26.2.17 rational
 * approximation; max relative error ~7.5e-8 across the
 * full real line.
 */
export function standardNormalUpperTailCapon(z: number): number {
  if (!Number.isFinite(z)) {
    throw new Error(`standardNormalUpperTailCapon: z must be finite (got ${z})`);
  }
  if (z < 0) return 1 - standardNormalUpperTailCapon(-z);
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
export function inverseStandardNormalCdfCapon(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    throw new Error(
      `inverseStandardNormalCdfCapon: p in (0,1) required (got ${p})`,
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

/**
 * Corpus-level SIGNED aggregator for axis-199 per-source
 * results. Combines the per-source SIGNED caponZ via
 * STOUFFER'S Z-METHOD (Stouffer et al. 1949 *American
 * Soldier* vol. 1, sec. 2.2; Whitlock 2005 *J. Evol.
 * Biol.* 18:1368-1373):
 *
 *     stoufferZ = sum_i caponZ_i / sqrt(m)
 *     stoufferTwoSidedPValue = 2 * (1 - Phi(|stoufferZ|))
 *
 * Returns the corpus-mean caponZ (unweighted) plus the
 * TENURE-WEIGHTED mean caponZ for downstream
 * interpretation.
 *
 * Malformed rows (non-finite caponZ, caponPValue not in
 * (0, 1], non-positive caponVarC or nTenureDays) are
 * SKIPPED with a counter rather than throwing.
 */
export interface CaponHalvesCorpusAggregate {
  stoufferZ: number;
  stoufferTwoSidedPValue: number;
  meanCaponZ: number;
  tenureWeightedMeanCaponZ: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateCaponHalves(
  rows: ReadonlyArray<{
    caponZ: number;
    caponPValue: number;
    caponVarC: number;
    nTenureDays: number;
  }>,
): CaponHalvesCorpusAggregate {
  let zSum = 0;
  let weightedZSum = 0;
  let totalTenure = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.caponZ) ||
      !Number.isFinite(r.caponPValue) ||
      r.caponPValue <= 0 ||
      r.caponPValue > 1 ||
      !Number.isFinite(r.caponVarC) ||
      r.caponVarC <= 0 ||
      !Number.isInteger(r.nTenureDays) ||
      r.nTenureDays <= 0
    ) {
      skipped += 1;
      continue;
    }
    zSum += r.caponZ;
    weightedZSum += r.nTenureDays * r.caponZ;
    totalTenure += r.nTenureDays;
    used += 1;
  }
  if (used === 0) {
    return {
      stoufferZ: 0,
      stoufferTwoSidedPValue: 1,
      meanCaponZ: Number.NaN,
      tenureWeightedMeanCaponZ: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const stoufferZ = zSum / Math.sqrt(used);
  const stoufferTwoSidedPValue =
    2 * standardNormalUpperTailCapon(Math.abs(stoufferZ));
  return {
    stoufferZ,
    stoufferTwoSidedPValue,
    meanCaponZ: zSum / used,
    tenureWeightedMeanCaponZ: weightedZSum / totalTenure,
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

export function buildDailyTokenCaponHalves(
  queue: QueueLine[],
  opts: DailyTokenCaponHalvesOptions = {},
): DailyTokenCaponHalvesReport {
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
  const sort: DailyTokenCaponHalvesSort = opts.sort ?? 'caponZAbsDesc';
  const validSorts: DailyTokenCaponHalvesSort[] = [
    'caponZ',
    'caponZAbsDesc',
    'caponPValue',
    'caponPValueDesc',
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
  const rows: DailyTokenCaponHalvesSourceRow[] = [];

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
      result = dailyTokenCaponHalves(filled);
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
      caponN1: result.caponN1,
      caponN2: result.caponN2,
      caponAbar: result.caponAbar,
      caponScoreSS: result.caponScoreSS,
      caponC: result.caponC,
      caponExpC: result.caponExpC,
      caponVarC: result.caponVarC,
      caponZ: result.caponZ,
      caponPValue: result.caponPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'caponZ':
        primary = a.caponZ - b.caponZ;
        break;
      case 'caponZAbsDesc':
        primary = Math.abs(b.caponZ) - Math.abs(a.caponZ);
        break;
      case 'caponPValue':
        primary = a.caponPValue - b.caponPValue;
        break;
      case 'caponPValueDesc':
        primary = b.caponPValue - a.caponPValue;
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

/**
 * REFINEMENT (v0.6.498): cross-axis agreement diagnostic
 * for axis-199 (Capon) vs axis-177 (Klotz). Both tests are
 * SQUARED-NORMAL-QUANTILE scale tests on pooled mid-ranks
 * but use STRUCTURALLY DIFFERENT plotting positions:
 *
 *     Klotz:  u = R / (n + 1)        (Weibull)
 *     Capon:  u = (R - 0.5) / n      (continuity-corrected
 *                                     Blom 1958)
 *
 * At small n (n in [16, 30]) the Capon plotting position
 * puts ~30% MORE weight on extreme ranks than Klotz. The
 * two tests therefore tend to AGREE on the SIGN of the
 * dispersion shift (both are LMP for normal scale
 * alternatives in the limit) but DISAGREE on the
 * MAGNITUDE: when the dispersion shift is concentrated in
 * the EXTREME TAIL Capon |z| > Klotz |z|, when it is
 * concentrated in the SHOULDER Klotz |z| > Capon |z|.
 *
 * This helper buckets a per-source pair (caponZ, klotzZ)
 * into one of four mutually-exclusive diagnostic buckets:
 *
 *   - `tail-amplified`: |caponZ| > |klotzZ| AND
 *     sign(caponZ) == sign(klotzZ). Capon's tighter
 *     extreme-rank weight wins; the dispersion shift is
 *     concentrated in the extreme tail.
 *   - `shoulder-amplified`: |klotzZ| > |caponZ| AND
 *     sign(klotzZ) == sign(caponZ). Klotz's gentler tail
 *     saturation wins; the dispersion shift is in the
 *     shoulder rather than the extreme tail.
 *   - `sign-conflict`: sign(caponZ) != sign(klotzZ). Rare
 *     -- both tests should agree on direction in the
 *     asymptotic limit. Indicates a mid-tail dispersion
 *     pattern that the two scoring schemes disagree on
 *     (watch-list).
 *   - `coherent`: |caponZ| == |klotzZ| (within 1e-9
 *     tolerance) AND signs agree. The dispersion shift is
 *     uniformly distributed across all rank classes;
 *     plotting-position choice is irrelevant.
 */
export type CaponKlotzAgreementBucket =
  | 'tail-amplified'
  | 'shoulder-amplified'
  | 'sign-conflict'
  | 'coherent';

export function classifyCaponKlotzAgreement(
  caponZ: number,
  klotzZ: number,
): CaponKlotzAgreementBucket {
  if (!Number.isFinite(caponZ) || !Number.isFinite(klotzZ)) {
    throw new Error(
      `classifyCaponKlotzAgreement: requires finite caponZ and klotzZ (got ${caponZ}, ${klotzZ})`,
    );
  }
  // Sign agreement: zero on either side counts as
  // sign-agreement with whichever side is signed.
  const sCapon = Math.sign(caponZ);
  const sKlotz = Math.sign(klotzZ);
  if (sCapon !== 0 && sKlotz !== 0 && sCapon !== sKlotz) {
    return 'sign-conflict';
  }
  const aCapon = Math.abs(caponZ);
  const aKlotz = Math.abs(klotzZ);
  if (Math.abs(aCapon - aKlotz) <= 1e-9) {
    return 'coherent';
  }
  return aCapon > aKlotz ? 'tail-amplified' : 'shoulder-amplified';
}
