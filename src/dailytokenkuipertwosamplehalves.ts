/**
 * daily-token-kuiper-two-sample-halves: per-source
 * KUIPER TWO-SAMPLE TEST comparing the empirical
 * cumulative distribution functions (ECDFs) of the
 * FIRST half vs the SECOND half of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-NINETY-SECOND cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Split into two contiguous halves:
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * Construct the empirical CDFs and the two SIGNED
 * suprema:
 *
 *     F_A(t) = (1/n1) * #{i : A_i <= t}
 *     F_B(t) = (1/n2) * #{j : B_j <= t}
 *     kpDPlus  = sup_t  ( F_A(t) - F_B(t) )
 *     kpDMinus = sup_t  ( F_B(t) - F_A(t) )
 *
 * The KUIPER two-sample statistic is the SUM of the
 * two one-sided suprema (Kuiper 1960, *Proceedings of
 * the Koninklijke Nederlandse Akademie van
 * Wetenschappen, Series A* 63:38-47):
 *
 *     kpV = kpDPlus + kpDMinus
 *
 * The ALGEBRAIC RELATIONSHIP to the Kolmogorov-Smirnov
 * statistic (axis-118) is
 *
 *     ksD = max(kpDPlus, kpDMinus)   <=  kpV
 *                                    <=  2 * ksD
 *
 * Equality on the LEFT holds iff one of kpDPlus /
 * kpDMinus is zero (one-sided ECDF crossing); equality
 * on the RIGHT holds iff kpDPlus = kpDMinus (perfectly
 * balanced two-sided crossing). For real data the
 * Kuiper V is a strictly different functional of the
 * ECDF gap pattern.
 *
 * Sign convention. Kuiper V is INHERENTLY UNSIGNED --
 * it answers "do the ECDFs differ in any direction?"
 * by adding up the deviation in BOTH directions. We
 * report `kpVDirection` as a categorical descriptor of
 * the dominant lobe (informational only; does NOT
 * determine the test):
 *
 *     kpVDirection = 'second-larger'
 *                          if kpDMinus > kpDPlus
 *     kpVDirection = 'first-larger'
 *                          if kpDPlus  > kpDMinus
 *     kpVDirection = 'balanced'  if kpDPlus = kpDMinus
 *
 * 'second-larger' means F_B sits BELOW F_A at the
 * dominant supremum, i.e. half B puts more mass at
 * higher values -- second half stochastically larger.
 *
 * Asymptotic null distribution. Under H0 (both halves
 * drawn from the same continuous distribution F),
 * Kuiper 1960 derives the limiting distribution of the
 * scaled statistic
 *
 *     kpLambda = ( sqrt(en) + 0.155 + 0.24/sqrt(en) )
 *                * kpV
 *
 * with en = n1*n2/(n1+n2), and the right-tail
 * p-value (Stephens 1965, *Biometrika* 52(3-4):309-321
 * eq. 4.3; Numerical Recipes 3rd ed. eq. 14.3.20):
 *
 *     kpP = 2 sum_{k=1..inf}
 *           ( 4 k^2 kpLambda^2 - 1 )
 *           * exp( -2 k^2 kpLambda^2 )
 *
 * This series converges much faster than the KS
 * Smirnov series for moderate lambda; we truncate
 * adaptively at the standard EPS1 = 1e-12 /
 * EPS2 = 1e-30 thresholds (NR 14.3.21).
 *
 * Normal-standardised z-equivalent for cross-axis
 * comparability:
 *
 *     kpZ = sign-by-direction * |Phi^{-1}(kpP / 2)|
 *
 * where 'sign-by-direction' is +1 for 'second-larger',
 * -1 for 'first-larger', and 0 for 'balanced'. Note
 * the underlying TEST is two-sided and direction-
 * agnostic; the sign on kpZ is a presentation aid only.
 *
 * Stephens 1965 critical-value table (alpha=0.05,
 * large n asymptote) gives
 *
 *     kpVCrit_{0.05} ~= 1.747 / ( sqrt(en) + 0.155
 *                                 + 0.24/sqrt(en) )
 *
 * (rearranging the kpLambda inflation factor for the
 * .05 critical lambda 1.747 from Stephens 1965 Table
 * 1B).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A
 * FUNDAMENTALLY NEW PRIMITIVE NOT REDUCIBLE TO ANY
 * OTHER DAILY-TOKEN AXIS:
 *
 *   - vs axis-118 daily-token-ks-two-sample-halves.
 *     KS uses the supremum max(D+, D-); Kuiper uses
 *     the SUM D+ + D-. KS is MAXIMISED by ONE-SIDED
 *     ECDF crossings; Kuiper is MAXIMISED by TWO-
 *     SIDED ECDF crossings. The two are mathematically
 *     bracketed (ksD <= kpV <= 2 ksD) but capture
 *     OPPOSITE features of the ECDF-difference shape:
 *     a clean step-shift gives ksD ~= kpV (one lobe
 *     dominates, the other is ~0); a SCALE shift with
 *     equal medians gives ksD ~= kpV/2 (two equal
 *     lobes; KS sees half the signal Kuiper sees).
 *     Furthermore, Kuiper V is ROTATION-INVARIANT on
 *     the unit circle (its original purpose: testing
 *     uniformity of directional data) -- adding any
 *     constant c to the threshold variable does NOT
 *     change which lobe is largest, but it CAN change
 *     which one-sided supremum KS reports. On the
 *     real line this manifests as DIFFERENT
 *     SENSITIVITY PROFILES against shape alternatives.
 *
 *   - vs axis-115 Mann-Whitney halves. MW measures
 *     STOCHASTIC DOMINANCE via int F_A dF_B (a SIGNED
 *     ECDF integral). Kuiper measures the COMBINED
 *     (signed-sum-of-suprema) ECDF gap. Two halves
 *     with EQUAL MEDIANS but DIFFERENT TAIL SPREADS
 *     (e.g. A = N(0, 1), B = N(0, 4)) yield mwZ ~= 0
 *     (no stochastic dominance) but kpV >> 0 (the
 *     two ECDFs cross AT the median and diverge in
 *     both tails -- a CLASSIC two-sided alternative
 *     that Kuiper was designed for).
 *
 *   - vs axes 116/117 Brown-Forsythe / Siegel-Tukey.
 *     Both are SCALE-ONLY tests. Kuiper is OMNIBUS:
 *     it picks up scale shifts AS WELL AS location
 *     shifts AS WELL AS multimodality emergence. A
 *     pure mean-shift gives Kuiper a strong response
 *     where Brown-Forsythe gives bfZ ~= 0.
 *
 *   - vs axis-119 Anderson-Darling halves. AD weights
 *     the squared ECDF gap by 1/(F(1-F)) which AMPLIFIES
 *     tail discrepancies. Kuiper weights both lobes
 *     EQUALLY (uniform weight on the supremum). A
 *     mid-distribution two-sided crossing is caught by
 *     Kuiper but DAMPED in AD; conversely, an extreme-
 *     tail one-sided spike is amplified by AD but only
 *     contributes its raw height to Kuiper.
 *
 *   - vs axis-187 Vargha-Delaney A12 / axis-191
 *     Cliff's delta. Both are ordinal effect-size
 *     SCALARS quantifying stochastic dominance. Kuiper
 *     V is a SUM-OF-DEVIATIONS test statistic, not a
 *     dominance-fraction. Kuiper rejects under any
 *     ECDF gap (including pure scale shift with no
 *     dominance); A12 / Cliff's delta sit at 0.5 / 0
 *     respectively under pure scale shift.
 *
 *   - vs axes 121-156 (divergence axes). Those are
 *     INFORMATION-THEORETIC functionals of the BINNED
 *     densities (Hellinger, Wasserstein, KL, etc).
 *     Kuiper is a SUPREMUM-BASED ECDF functional with
 *     no binning step.
 *
 *   - vs axes 64 / 110 / 111 / 113 / 114 (Wald-
 *     Wolfowitz, Mann-Kendall, Cox-Stuart, Mood
 *     difference-sign, Ljung-Box). All depend on the
 *     ORDER of the values. Kuiper is permutation-
 *     invariant within each half.
 *
 *   - vs axis-189/190 paired tests. Those leverage
 *     within-pair pairing d_i = B_i - A_i. Kuiper
 *     treats the two halves as INDEPENDENT samples
 *     and operates on their full ECDFs.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled
 *   daily token series into a first half (n1 days)
 *   and a second half (n2 days), build their empirical
 *   CDFs F_A and F_B, and compute kpV = sup(F_A-F_B) +
 *   sup(F_B-F_A), does kpV exceed the Stephens 1965
 *   alpha = 0.05 critical value?"**
 *
 * Reference:
 *   Kuiper, N. H., "Tests concerning random points on
 *     a circle", Proceedings of the Koninklijke
 *     Nederlandse Akademie van Wetenschappen, Series A
 *     63 (1960), pp. 38-47.
 *   Stephens, M. A., "The goodness-of-fit statistic
 *     V_N: distribution and significance points",
 *     Biometrika 52(3-4) (1965), pp. 309-321.
 *   Press, W. H., Teukolsky, S. A., Vetterling, W. T.
 *     and Flannery, B. P., "Numerical Recipes: The
 *     Art of Scientific Computing", 3rd ed.,
 *     Cambridge University Press, 2007, sec. 14.3
 *     eqs. 14.3.20-21.
 *
 * Caveats:
 *
 *   - kpDPlus, kpDMinus, kpV in [0, 2]. (Each lobe in
 *     [0, 1]; sum in [0, 2].) For real data with both
 *     halves drawn from any nondegenerate distribution,
 *     kpV strictly < 2.
 *   - kpP in (0, 1]. kpZ in (-inf, +inf) (sign carried
 *     by the dominant-lobe direction; magnitude from
 *     the two-sided p).
 *   - Discrete tied data (gap-filled token series with
 *     many zeros) makes kpP CONSERVATIVE (under-
 *     rejecting); the asymptotic null is calibrated for
 *     continuous F. This matches axis-118 KS behaviour.
 *   - Half-split: n1 = floor(n/2), n2 = n - n1
 *     (matches axis-115 / axis-118 / axis-119). Hard
 *     floor n >= 8 so n1, n2 >= 4 (Stephens 1965
 *     calibrated regime for the asymptotic null).
 *   - All-equal series filtered upstream by zero-
 *     variance guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14):
 *   pew-insights daily-token-kuiper-two-sample-halves
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-kuiper-two-sample-halves \
 *     --source vscode-other --json
 *
 *   # Sort by Kuiper V descending (strongest two-sided
 *   # ECDF gap first):
 *   pew-insights daily-token-kuiper-two-sample-halves \
 *     --sort kpVDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenKuiperTwoSampleHalvesSort =
  | 'kpV'
  | 'kpVDesc'
  | 'kpZ'
  | 'kpZDesc'
  | 'kpZAbs'
  | 'kpZAbsDesc'
  | 'kpP'
  | 'kpPDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export type KuiperVDirection = 'first-larger' | 'second-larger' | 'balanced';

export interface DailyTokenKuiperTwoSampleHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * that n1, n2 >= 4 (Stephens 1965 calibrated regime
   * for the asymptotic Kuiper null).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenKuiperTwoSampleHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenKuiperTwoSampleHalvesSourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the gap-filled tenure series. */
  mean: number;
  /** Population stddev of the gap-filled tenure series. */
  stddev: number;
  /** First-half size n1 = floor(n/2). */
  kpN1: number;
  /** Second-half size n2 = n - n1. */
  kpN2: number;
  /** Median of the first half (diagnostic; Kuiper does not centre). */
  kpMedianA: number;
  /** Median of the second half (diagnostic; Kuiper does not centre). */
  kpMedianB: number;
  /** Positive supremum sup_t (F_A(t) - F_B(t)) in [0, 1]. */
  kpDPlus: number;
  /** Positive supremum sup_t (F_B(t) - F_A(t)) in [0, 1]. */
  kpDMinus: number;
  /** Kuiper V = kpDPlus + kpDMinus in [0, 2]. */
  kpV: number;
  /** Categorical descriptor of the dominant lobe (informational). */
  kpVDirection: KuiperVDirection;
  /** Effective sample size en = n1*n2/(n1+n2). */
  kpEn: number;
  /**
   * Stephens 1965 inflated lambda = (sqrt(en) + 0.155
   * + 0.24/sqrt(en)) * kpV.
   */
  kpLambda: number;
  /** Two-sided asymptotic Kuiper p-value (Stephens 1965). */
  kpP: number;
  /**
   * Normal-standardised z-equivalent.
   * Sign derived from kpVDirection (presentation aid;
   * the underlying test is two-sided).
   */
  kpZ: number;
  /** Stephens 1965 alpha=0.05 critical V value. */
  kpVCrit05: number;
}

export interface DailyTokenKuiperTwoSampleHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenKuiperTwoSampleHalvesSort;
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
  sources: DailyTokenKuiperTwoSampleHalvesSourceRow[];
}

function medianSorted(sorted: number[]): number {
  const m = sorted.length;
  if (m === 0) return Number.NaN;
  return m % 2 === 1
    ? sorted[(m - 1) / 2]!
    : (sorted[m / 2 - 1]! + sorted[m / 2]!) / 2;
}

/**
 * Stephens 1965 asymptotic Kuiper p-value series:
 *
 *     P(V > v) ~ 2 sum_{k=1..inf}
 *                  (4 k^2 lambda^2 - 1) exp(-2 k^2 lambda^2)
 *
 * with lambda = (sqrt(en) + 0.155 + 0.24/sqrt(en)) * V.
 * Numerical Recipes 3rd ed. eq. 14.3.20 with
 * convergence threshold eq. 14.3.21.
 *
 * The series converges very fast for lambda >= 0.4
 * (typical practical regime); below that the right-
 * tail p-value is essentially 1 and the test cannot
 * reject. We clip to 1 for lambda < 0.4.
 */
export function kuiperP(lambda: number): number {
  if (Number.isNaN(lambda)) return 1;
  if (lambda <= 0) return 1;
  if (lambda === Number.POSITIVE_INFINITY) return 0;
  if (lambda < 0.4) return 1;
  if (lambda > 1e6) return 0;
  const EPS1 = 1e-12;
  const EPS2 = 1e-30;
  let sum = 0;
  let termbf = 0;
  const a2 = -2 * lambda * lambda;
  for (let j = 1; j <= 200; j += 1) {
    const k2 = j * j;
    const term = 2 * (4 * k2 * lambda * lambda - 1) * Math.exp(a2 * k2);
    sum += term;
    if (
      j > 1 &&
      (Math.abs(term) <= EPS1 * termbf || Math.abs(term) <= EPS2 * sum)
    ) {
      const p = sum;
      return p > 1 ? 1 : p < 0 ? 0 : p;
    }
    termbf = Math.abs(term);
  }
  const p = sum;
  return p > 1 ? 1 : p < 0 ? 0 : p;
}

/**
 * Inverse normal quantile via Acklam 2003 rational
 * approximation (max relative error 1.15e-9 in the
 * central region; 4.5e-4 in tails). Used for the
 * z-equivalent presentation field.
 */
function normalQuantile(p: number): number {
  if (!Number.isFinite(p) || p <= 0 || p >= 1) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    return Number.NaN;
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
        c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r +
        a[5]!) *
        q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q +
      c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/**
 * Kuiper two-sample equality-of-distribution test on
 * the first-half (A = x[0..n1-1]) vs second-half
 * (B = x[n1..n-1]) of a real-valued series.
 *
 * Computes kpDPlus = sup_t (F_A(t) - F_B(t)) and
 * kpDMinus = sup_t (F_B(t) - F_A(t)) by sweeping the
 * pooled sorted values, with tied pooled values
 * flushed in a single step (Massey 1951 upper-step
 * convention for ties), then kpV = kpDPlus + kpDMinus.
 *
 * EXACT IDENTITIES preserved by this implementation:
 *
 *   - kpV(x + c) === kpV(x) for any constant c.
 *   - kpV(a * x) === kpV(x) for any a > 0; for a < 0
 *     the rank order REVERSES; kpV is INVARIANT
 *     because the two suprema swap roles, but the
 *     direction descriptor flips.
 *   - kpV is INVARIANT under swapping the two halves;
 *     the direction descriptor flips.
 *   - For x = repeat(constant) the test is undefined
 *     (zero variance); we throw to be filtered upstream.
 *   - kpDPlus, kpDMinus in [0, 1]; kpV in [0, 2];
 *     kpV >= ksD = max(kpDPlus, kpDMinus); kpV <= 2*ksD.
 *   - kpV >= ksDplus and kpV >= ksDminus individually,
 *     so kpV >= ksD always.
 */
export function dailyTokenKuiperTwoSampleHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  kpN1: number;
  kpN2: number;
  kpMedianA: number;
  kpMedianB: number;
  kpDPlus: number;
  kpDMinus: number;
  kpV: number;
  kpVDirection: KuiperVDirection;
  kpEn: number;
  kpLambda: number;
  kpP: number;
  kpZ: number;
  kpVCrit05: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenKuiperTwoSampleHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenKuiperTwoSampleHalves requires finite values',
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
      `dailyTokenKuiperTwoSampleHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const kpMedianA = medianSorted(aSorted);
  const kpMedianB = medianSorted(bSorted);

  // Kuiper sup-of-each-side via merged sweep over the
  // two sorted halves. Identical sweep mechanics as KS
  // (axis-118): walk both arrays simultaneously, at
  // each unique pooled value v advance the count of
  // A-elements <= v and B-elements <= v, then record
  // the running F_A(v) - F_B(v) AFTER the step.
  // Kuiper differs from KS only in the FINAL
  // statistic (sum of suprema vs max).
  let i = 0;
  let j = 0;
  let kpDPlus = 0;
  let kpDMinus = 0;
  while (i < n1 && j < n2) {
    const va = aSorted[i]!;
    const vb = bSorted[j]!;
    let v: number;
    if (va < vb) {
      v = va;
    } else if (vb < va) {
      v = vb;
    } else {
      v = va;
    }
    while (i < n1 && aSorted[i]! === v) i += 1;
    while (j < n2 && bSorted[j]! === v) j += 1;
    const fa = i / n1;
    const fb = j / n2;
    const diff = fa - fb;
    if (diff > kpDPlus) kpDPlus = diff;
    if (-diff > kpDMinus) kpDMinus = -diff;
  }
  // Drain the longer side: same KS argument applies.
  // After one half is fully consumed F_X = 1 there;
  // any further pooled value can only DECREASE the
  // already-recorded supremum on the OTHER side, so
  // no extremum can be missed.

  const kpV = kpDPlus + kpDMinus;
  // Direction convention (matches axis-118 KS):
  //   kpDPlus = sup(F_A - F_B) > 0 means F_A is ABOVE
  //   F_B at the supremum, i.e. half A puts more mass
  //   at LOW thresholds -- half B is STOCHASTICALLY
  //   LARGER -- 'second-larger'.
  //   kpDMinus dominant means symmetric reverse.
  const kpVDirection: KuiperVDirection =
    kpDPlus > kpDMinus
      ? 'second-larger'
      : kpDMinus > kpDPlus
        ? 'first-larger'
        : 'balanced';
  const kpEn = (n1 * n2) / (n1 + n2);
  const sqrtEn = Math.sqrt(kpEn);
  const inflate = sqrtEn + 0.155 + 0.24 / sqrtEn;
  const kpLambda = inflate * kpV;
  const kpP = kuiperP(kpLambda);
  const kpAbsZ = kpP >= 1 ? 0 : -normalQuantile(kpP / 2);
  const directionSign =
    kpVDirection === 'second-larger'
      ? 1
      : kpVDirection === 'first-larger'
        ? -1
        : 0;
  const kpZ = directionSign * kpAbsZ;
  // Stephens 1965 critical lambda at alpha=0.05 is
  // ~1.747 (Table 1B large-n asymptote). Invert the
  // inflation factor to get the critical V:
  //     kpVCrit = lambdaCrit / inflate.
  const kpVCrit05 = 1.747 / inflate;

  if (
    !Number.isFinite(kpV) ||
    !Number.isFinite(kpLambda) ||
    !Number.isFinite(kpP) ||
    !Number.isFinite(kpZ)
  ) {
    throw new Error(
      `dailyTokenKuiperTwoSampleHalves: non-finite statistic (n=${n})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    kpN1: n1,
    kpN2: n2,
    kpMedianA,
    kpMedianB,
    kpDPlus,
    kpDMinus,
    kpV,
    kpVDirection,
    kpEn,
    kpLambda,
    kpP,
    kpZ,
    kpVCrit05,
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

export function buildDailyTokenKuiperTwoSampleHalves(
  queue: QueueLine[],
  opts: DailyTokenKuiperTwoSampleHalvesOptions = {},
): DailyTokenKuiperTwoSampleHalvesReport {
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
  const sort: DailyTokenKuiperTwoSampleHalvesSort = opts.sort ?? 'kpVDesc';
  const validSorts: DailyTokenKuiperTwoSampleHalvesSort[] = [
    'kpV',
    'kpVDesc',
    'kpZ',
    'kpZDesc',
    'kpZAbs',
    'kpZAbsDesc',
    'kpP',
    'kpPDesc',
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
  const rows: DailyTokenKuiperTwoSampleHalvesSourceRow[] = [];

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
      result = dailyTokenKuiperTwoSampleHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenKuiperTwoSampleHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      kpN1: result.kpN1,
      kpN2: result.kpN2,
      kpMedianA: result.kpMedianA,
      kpMedianB: result.kpMedianB,
      kpDPlus: result.kpDPlus,
      kpDMinus: result.kpDMinus,
      kpV: result.kpV,
      kpVDirection: result.kpVDirection,
      kpEn: result.kpEn,
      kpLambda: result.kpLambda,
      kpP: result.kpP,
      kpZ: result.kpZ,
      kpVCrit05: result.kpVCrit05,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kpV':
        primary = a.kpV - b.kpV;
        break;
      case 'kpVDesc':
        primary = b.kpV - a.kpV;
        break;
      case 'kpZ':
        primary = a.kpZ - b.kpZ;
        break;
      case 'kpZDesc':
        primary = b.kpZ - a.kpZ;
        break;
      case 'kpZAbs':
        primary = Math.abs(a.kpZ) - Math.abs(b.kpZ);
        break;
      case 'kpZAbsDesc':
        primary = Math.abs(b.kpZ) - Math.abs(a.kpZ);
        break;
      case 'kpP':
        primary = a.kpP - b.kpP;
        break;
      case 'kpPDesc':
        primary = b.kpP - a.kpP;
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
