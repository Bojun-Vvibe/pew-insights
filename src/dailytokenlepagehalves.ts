/**
 * daily-token-lepage-halves: per-source LEPAGE (1971)
 * JOINT LOCATION-SCALE TWO-SAMPLE NONPARAMETRIC TEST
 * comparing the first half vs second half of the gap-
 * filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SEVENTY-FIFTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily token
 * series for one source over its tenure (n = nTenureDays).
 * Split into two contiguous halves
 *
 *     A = x[0..n1-1]    with n1 = floor(n/2)
 *     B = x[n1..n-1]    with n2 = n - n1
 *
 * The Lepage (1971) statistic is the SUM of two
 * INDEPENDENT-UNDER-H0 standardised chi-squared(1)
 * components:
 *
 *     L = zW^2 + zAB^2
 *
 * where
 *
 *   - zW is the standardised WILCOXON RANK-SUM
 *     (Mann-Whitney) statistic computed on monotonic
 *     mid-ranks of the RAW pooled series. Sensitive to
 *     LOCATION shift between A and B.
 *
 *     W_A = sum_{i in A} R_i  (mid-ranks 1..n)
 *     E[W_A]   = n1 (n + 1) / 2
 *     Var[W_A] = n1 n2 (n + 1) / 12   (no-tie form)
 *     zW       = (W_A - E[W_A]) / sqrt(Var[W_A])
 *
 *   - zAB is the standardised ANSARI-BRADLEY rank-sum
 *     statistic computed on FOLDED ranks of the pooled
 *     MEDIAN-CENTRED halves. Sensitive to SCALE shift
 *     between A and B.
 *
 *     AB_A = sum_{i in A} F_i  (folded ranks min(k, n+1-k))
 *     E[AB_A]   = n1 (n + 2) / 4         (n even)
 *               = n1 (n + 1)^2 / (4 n)    (n odd)
 *     Var[AB_A] = n1 n2 (n + 2)(n - 2) / (48 (n - 1))   (n even)
 *               = n1 n2 (n + 1)(n^2 + 3) / (48 n^2)     (n odd)
 *     zAB      = (AB_A - E[AB_A]) / sqrt(Var[AB_A])
 *
 * Under H0 (equal distribution of A and B), zW and zAB
 * are ASYMPTOTICALLY INDEPENDENT N(0, 1) (Lepage 1971
 * Lemma 2: the Wilcoxon rank-sum is a function of the
 * monotonic rank vector while the Ansari-Bradley rank-sum
 * is a function of the FOLDED rank vector on MEDIAN-
 * CENTRED data; the two are asymptotically uncorrelated
 * because the folded transform is symmetric about the
 * pool centre). Therefore
 *
 *     L  ~  Chi-Squared(2)   (asymptotically, n -> inf)
 *
 * and the upper-tail p-value is
 *
 *     P(L > l) = exp(-l / 2)
 *
 * (chi-2(2) survival = exp(-x/2)).
 *
 * EQUIVALENT REPORT FORM. For downstream Stouffer-style
 * aggregation we also report
 *
 *     lepZ = sqrt(L)
 *
 * which is the chi-2(2) root with the same upper-tail
 * interpretation (intrinsically unsigned). The directional
 * information is in the SIGNED zW and zAB components:
 * positive zW = first half has more rank-mass = first half
 * stochastically LARGER (matches axis-115 mwZ > 0
 * convention reversed, see SIGN CONVENTIONS below);
 * positive zAB = first half collects more central folded-
 * rank mass = first half MORE CONCENTRATED = second half
 * MORE DISPERSED.
 *
 * SIGN CONVENTIONS for the per-channel z's (matching the
 * PRIOR axes' conventions for cross-axis aggregation):
 *
 *   - lepLocZ = -zW
 *       lepLocZ > 0  <=>  W_A < E[W_A]
 *                    <=>  first half has SMALLER ranks
 *                    <=>  SECOND half stochastically LARGER
 *       (matches axis-115 mwZ sign: mwZ > 0 = second half
 *       stochastically larger; the negation aligns Lepage
 *       location channel with Mann-Whitney's convention.)
 *   - lepScaleZ = -zAB
 *       lepScaleZ > 0  <=>  AB_A < E[AB_A]
 *                      <=>  first half has SMALLER folded-
 *                           rank mass = first half MORE
 *                           DISPERSED (rank mass at the
 *                           extremes) = SECOND half MORE
 *                           CONCENTRATED
 *       (matches axis-117 stZ / axis-170 abZ sign: those
 *       are positive when SECOND half is more dispersed;
 *       wait -- axis-170 abZ is POSITIVE when first half
 *       collects more central mass, i.e. second half MORE
 *       dispersed, which is abZ = (W_A - mean) /
 *       sqrt(var) > 0. So zAB > 0 <=> second half MORE
 *       dispersed. We adopt lepScaleZ = +zAB to match
 *       axis-170. See implementation.)
 *
 * The IMPLEMENTATION below uses lepLocZ = -zW and
 * lepScaleZ = +zAB so both signs match their axis-115 /
 * axis-170 counterparts directly. The exact identity
 *
 *     lepLocZ^2 + lepScaleZ^2  ===  L
 *
 * is preserved (sign flips don't change squared values).
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs axis-115 daily-token-mann-whitney-halves
 *     (Wilcoxon-only, LOCATION). Lepage REUSES the
 *     Wilcoxon component as ONE of two channels but adds
 *     the Ansari-Bradley scale channel and combines via
 *     SUM-OF-SQUARES. A pure scale shift gives axis-115
 *     near null but axis-175 significant via the AB
 *     component.
 *
 *   - vs axis-117 daily-token-siegel-tukey-halves and
 *     axis-170 daily-token-ansari-bradley-halves (SCALE-
 *     only). Lepage reuses the Ansari-Bradley scale
 *     channel as ONE of two channels but adds the
 *     Wilcoxon location channel. A pure location shift
 *     gives axis-117 / axis-170 near null but axis-175
 *     significant via the W component.
 *
 *   - vs axis-174 daily-token-cucconi-halves (joint
 *     location-scale via SQUARED-RANK SUMS T1 and T2,
 *     combined by CORRELATION-DECORRELATION rho). This
 *     is the KEY ORTHOGONALITY. Both Lepage and Cucconi
 *     are joint location-scale tests with chi-2(2)
 *     asymptotic null distribution, but they differ
 *     STRUCTURALLY:
 *
 *       (a) Cucconi uses the SAME monotonic ranks (1..n)
 *           on the RAW pooled series for BOTH components
 *           (T1 = sum squared ranks of B, T2 = sum
 *           squared complementary ranks of B). The two
 *           components are INHERENTLY CORRELATED under
 *           H0 with closed-form rho = 2(n^2-4)/((2n+1)
 *           (8n+11)) - 1 ~ -7/8, and Cucconi's quadratic
 *           form INCLUDES the cross-term -2 rho U V to
 *           decorrelate.
 *
 *       (b) Lepage uses TWO DIFFERENT rank schemes on
 *           DIFFERENT DATA: monotonic mid-ranks on the
 *           RAW pool (W) and folded ranks on the MEDIAN-
 *           CENTRED pool (AB). The two components are
 *           ASYMPTOTICALLY INDEPENDENT (the median-
 *           centring de-couples them), and Lepage's sum
 *           L = zW^2 + zAB^2 has NO cross-term.
 *
 *     POWER COMPARISON: Marozzi (2009) sec. 5 reports
 *     Cucconi has UNIFORMLY HIGHER POWER on simulated
 *     joint location-scale alternatives, especially
 *     under heavy tails -- Cucconi's closed-form rho
 *     captures redundancy that Lepage's "treat as
 *     independent" assumption ignores. However Lepage
 *     has TWO ADVANTAGES Cucconi lacks:
 *
 *       (i) DIRECTIONAL INTERPRETABILITY: zW and zAB are
 *           SIGNED z-scores with direct interpretation
 *           in the same sign convention as the
 *           individual axes 115 and 170; no rotation or
 *           decomposition is required to read direction.
 *           (Cucconi requires the locZ/scaleZ refinement
 *           added in axis-174 v0.6.450 to recover this.)
 *
 *      (ii) ROBUSTNESS UNDER PURE-LOCATION DOMINANT
 *           ALTERNATIVES: when the true alternative is
 *           PURE LOCATION (no scale shift), Lepage's L
 *           has chi-2(1) effective dimension (the AB
 *           component contributes only chi-2(1) noise),
 *           while Cucconi's C still uses both T1 and T2
 *           which are ALMOST COMPLETELY REDUNDANT under
 *           location-only shift (rho ~ -0.88), giving C
 *           a NOISIER null distribution at fixed
 *           location signal. Empirically (Marozzi 2009
 *           Tab. 3, normal-shift alternative) Cucconi
 *           wins by ~3 percentage points; under heavy
 *           tails the gap widens; under symmetric
 *           location-only Lepage closes to within 1
 *           percentage point.
 *
 *   - vs axis-171 Mood's median (one-point EDF gap at
 *     pooled median). Mood is invariant to any monotone
 *     transform of the underlying values; Lepage uses
 *     rank POSITIONS and is only invariant to monotone
 *     transforms of the data, not of the ranks.
 *
 *   - vs axis-116 Brown-Forsythe (PARAMETRIC F on
 *     |x - median|). Brown-Forsythe uses raw magnitudes;
 *     Lepage is fully RANK-INVARIANT. Differs on heavy-
 *     tailed contamination.
 *
 *   - vs the cumulative-periodogram axes (167-169, 172-
 *     173). Those are FREQUENCY-DOMAIN goodness-of-fit
 *     against white noise on the WHOLE series. Lepage
 *     is TIME-DOMAIN, two-sample, rank-based on a fixed
 *     first/second-half split.
 *
 *   - vs the trend axes (Mann-Kendall-110, Cox-Stuart-
 *     111, difference-sign-113). Those target a
 *     MONOTONIC LOCATION trend across the WHOLE series.
 *     Lepage targets the JOINT location-scale shift
 *     between two FIXED halves and is invariant to the
 *     internal order WITHIN each half.
 *
 * Headline question:
 * **"For each source, when we split the gap-filled daily
 *   token series into a first half (n1 days) and a second
 *   half (n2 days), compute the Wilcoxon rank-sum on the
 *   raw pooled monotonic mid-ranks and the Ansari-Bradley
 *   folded-rank sum on the median-centred pooled ranks,
 *   standardise each to a z-score, and form the Lepage
 *   sum-of-squares L = zW^2 + zAB^2, does the upper tail
 *   exp(-L/2) drop below alpha = 0.05?"**
 *
 * Reference:
 *   Lepage, Y., "A combination of Wilcoxon's and Ansari-
 *     Bradley's statistics", Biometrika 58(1) (1971),
 *     pp. 213-217.
 *   Hollander, Wolfe & Chicken, *Nonparametric Statistical
 *     Methods*, 3rd ed. (Wiley 2014), sec. 5.5.
 *   Marozzi, M., "Some notes on the location-scale Cucconi
 *     test", J. Nonparametric Statistics 21(5) (2009),
 *     pp. 629-647 (Lepage vs Cucconi power comparison).
 *
 * Caveats:
 *
 *   - The exp(-L/2) p-value uses the asymptotic chi-2(2)
 *     decomposition. Lepage 1971 sec. 4 reports the
 *     small-sample tail is mildly conservative for
 *     n <= 12. We require n >= 8.
 *   - Tied pooled values (Wilcoxon component) use MID-
 *     RANK assignment with the standard tie-corrected
 *     variance (matches axis-115 implementation). The
 *     Ansari-Bradley component uses stable sort with
 *     ties broken by original index (matches axis-170);
 *     the folded-rank moments do not use a tie correction
 *     (Hollander/Wolfe/Chicken 2014 note that the AB tie
 *     correction is small for moderate ties and is
 *     omitted here for parity with axis-170).
 *   - All-equal series filtered upstream by zero-variance
 *     guard.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   pew-insights daily-token-lepage-halves
 *
 *   pew-insights daily-token-lepage-halves \
 *     --json --min-tenure-days 14 --sort lepLDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenLepageHalvesSort =
  | 'lepL'
  | 'lepLDesc'
  | 'lepPValue'
  | 'lepPValueDesc'
  | 'lepZ'
  | 'lepZDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLepageHalvesOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so
   * the Lepage asymptotic chi-2(2) approximation holds
   * (each component has Var well above the small-sample
   * regime).
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenLepageHalvesSort;
  generatedAt?: string;
}

export interface DailyTokenLepageHalvesSourceRow {
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
  lepN1: number;
  /** Second-half size n2 = n - n1. */
  lepN2: number;
  /** Wilcoxon first-half rank-sum (raw, mid-ranks). */
  lepWA: number;
  /** Ansari-Bradley first-half folded-rank sum (median-centred). */
  lepABA: number;
  /** Standardised Wilcoxon component zW (raw sign: positive = first half larger ranks). */
  lepZW: number;
  /** Standardised Ansari-Bradley component zAB (raw sign: positive = first half collects more central folded-rank mass = second half MORE dispersed). */
  lepZAB: number;
  /** Lepage joint statistic L = zW^2 + zAB^2. */
  lepL: number;
  /** Asymptotic chi-2(2) upper-tail p-value: exp(-L/2). */
  lepPValue: number;
  /** Z-equivalent: sqrt(L); intrinsically unsigned. */
  lepZ: number;
}

export interface DailyTokenLepageHalvesReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenLepageHalvesSort;
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
  sources: DailyTokenLepageHalvesSourceRow[];
}

/**
 * Exact Wilcoxon (Mann-Whitney) rank-sum null moments for
 * the first-half rank-sum W_A in a sample of size n =
 * n1 + n2 with NO TIES (the no-tie variance is used as
 * the LEPAGE-CANONICAL form here; tie correction is
 * applied separately at the per-call site).
 *
 *     E[W_A]   = n1 (n + 1) / 2
 *     Var[W_A] = n1 n2 (n + 1) / 12
 *
 * (Hollander, Wolfe & Chicken 2014 eq. 4.7.)
 */
export function wilcoxonNullMoments(
  n1: number,
  n2: number,
): { mean: number; variance: number } {
  if (!Number.isInteger(n1) || n1 < 1) {
    throw new Error(`wilcoxonNullMoments: n1 must be an integer >= 1 (got ${n1})`);
  }
  if (!Number.isInteger(n2) || n2 < 1) {
    throw new Error(`wilcoxonNullMoments: n2 must be an integer >= 1 (got ${n2})`);
  }
  const n = n1 + n2;
  const mean = (n1 * (n + 1)) / 2;
  const variance = (n1 * n2 * (n + 1)) / 12;
  if (!Number.isFinite(mean) || !Number.isFinite(variance) || variance <= 0) {
    throw new Error(
      `wilcoxonNullMoments: degenerate moments (n1=${n1}, n2=${n2}, mean=${mean}, var=${variance})`,
    );
  }
  return { mean, variance };
}

/**
 * Exact Ansari-Bradley folded-rank null moments
 * (Ansari & Bradley 1960 Theorem 2.1; Hollander, Wolfe &
 * Chicken 2014 eq. 5.16). Returns moments for the first-
 * half folded-rank sum AB_A under H0.
 */
export function ansariBradleyNullMomentsLep(
  n1: number,
  n2: number,
): { mean: number; variance: number } {
  if (!Number.isInteger(n1) || n1 < 1) {
    throw new Error(`ansariBradleyNullMomentsLep: n1 must be an integer >= 1 (got ${n1})`);
  }
  if (!Number.isInteger(n2) || n2 < 1) {
    throw new Error(`ansariBradleyNullMomentsLep: n2 must be an integer >= 1 (got ${n2})`);
  }
  const n = n1 + n2;
  let mean: number;
  let variance: number;
  if (n % 2 === 0) {
    mean = (n1 * (n + 2)) / 4;
    variance = (n1 * n2 * (n + 2) * (n - 2)) / (48 * (n - 1));
  } else {
    mean = (n1 * (n + 1) * (n + 1)) / (4 * n);
    variance = (n1 * n2 * (n + 1) * (n * n + 3)) / (48 * n * n);
  }
  if (!Number.isFinite(mean) || !Number.isFinite(variance) || variance <= 0) {
    throw new Error(
      `ansariBradleyNullMomentsLep: degenerate moments (n1=${n1}, n2=${n2}, mean=${mean}, var=${variance})`,
    );
  }
  return { mean, variance };
}

/**
 * Build the Ansari-Bradley FOLDED rank vector for sample
 * size n: rank k (1-indexed) gets folded value
 * min(k, n+1-k). For n=8: [1, 2, 3, 4, 4, 3, 2, 1]; for
 * n=9: [1, 2, 3, 4, 5, 4, 3, 2, 1].
 */
export function ansariBradleyRanksForLep(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(
      `ansariBradleyRanksForLep: n must be an integer >= 2 (got ${n})`,
    );
  }
  const ranks: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = i + 1;
    const b = n - i;
    ranks[i] = a < b ? a : b;
  }
  return ranks;
}

function medianSortedLep(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) throw new Error('medianSortedLep: empty');
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/**
 * Lepage (1971) joint location-scale two-sample
 * nonparametric test on the first-half (A = x[0..n1-1])
 * vs second-half (B = x[n1..n-1]) of a real-valued series.
 *
 * Combines:
 *   (a) Wilcoxon rank-sum on RAW pooled mid-ranks (with
 *       tie-corrected variance), giving zW.
 *   (b) Ansari-Bradley folded-rank sum on MEDIAN-CENTRED
 *       pooled values (stable rank assignment), giving
 *       zAB.
 *
 * The Lepage statistic is L = zW^2 + zAB^2, asymptotically
 * chi-squared(2) under H0; lepPValue = exp(-L/2).
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - lepL(x + c) === lepL(x) for any constant c (the
 *     Wilcoxon rank-sum is invariant under any monotone
 *     transform; the AB component median-centres so
 *     constant shift cancels exactly).
 *   - lepL(a * x) === lepL(x) for any a > 0 (positive
 *     scale preserves both monotonic ranks and folded
 *     ranks on the centred data).
 *   - lepL = lepLocZ^2 + lepScaleZ^2 (sign flips don't
 *     affect the squared sum -- the orthogonal-channel
 *     decomposition is NORM-PRESERVING).
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream.
 */
export function dailyTokenLepageHalves(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  lepN1: number;
  lepN2: number;
  lepWA: number;
  lepABA: number;
  lepZW: number;
  lepZAB: number;
  lepL: number;
  lepPValue: number;
  lepZ: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenLepageHalves: need at least 8 samples (got ${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenLepageHalves requires finite values');
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
      `dailyTokenLepageHalves: zero centred variance (n=${n})`,
    );
  }

  const n1 = Math.floor(n / 2);
  const n2 = n - n1;

  // ----- Wilcoxon component on RAW pooled mid-ranks -----
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => values[a]! - values[b]!);

  const ranks: number[] = new Array(n);
  const tieGroupSizes: number[] = [];
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]!]! === values[idx[i]!]!) {
      j += 1;
    }
    const groupSize = j - i + 1;
    if (groupSize > 1) tieGroupSizes.push(groupSize);
    const midRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[idx[k]!] = midRank;
    }
    i = j + 1;
  }

  let lepWA = 0;
  for (let k = 0; k < n1; k += 1) lepWA += ranks[k]!;

  const wMean = (n1 * (n + 1)) / 2;
  let tieSum = 0;
  for (const tg of tieGroupSizes) tieSum += tg * tg * tg - tg;
  const wVar =
    ((n1 * n2) / (12 * n * (n - 1))) * (n * n * n - n - tieSum);
  if (wVar <= 0 || !Number.isFinite(wVar)) {
    throw new Error(
      `dailyTokenLepageHalves: non-positive Wilcoxon tie-corrected variance (n=${n}, tieSum=${tieSum})`,
    );
  }
  const lepZW = (lepWA - wMean) / Math.sqrt(wVar);

  // ----- Ansari-Bradley component on MEDIAN-CENTRED pool -----
  const aSorted = values.slice(0, n1).sort((p, q) => p - q);
  const bSorted = values.slice(n1).sort((p, q) => p - q);
  const medA = medianSortedLep(aSorted);
  const medB = medianSortedLep(bSorted);

  interface PoolElem {
    centred: number;
    origIdx: number;
    fromFirstHalf: boolean;
  }
  const pool: PoolElem[] = new Array(n);
  for (let k = 0; k < n1; k += 1) {
    pool[k] = {
      centred: values[k]! - medA,
      origIdx: k,
      fromFirstHalf: true,
    };
  }
  for (let k = 0; k < n2; k += 1) {
    pool[n1 + k] = {
      centred: values[n1 + k]! - medB,
      origIdx: n1 + k,
      fromFirstHalf: false,
    };
  }
  pool.sort((p, q) => {
    if (p.centred !== q.centred) return p.centred - q.centred;
    return p.origIdx - q.origIdx;
  });

  const folded = ansariBradleyRanksForLep(n);
  let lepABA = 0;
  for (let k = 0; k < n; k += 1) {
    if (pool[k]!.fromFirstHalf) lepABA += folded[k]!;
  }

  const { mean: abMean, variance: abVar } = ansariBradleyNullMomentsLep(
    n1,
    n2,
  );
  const lepZAB = (lepABA - abMean) / Math.sqrt(abVar);

  // ----- Combine -----
  const lepL = lepZW * lepZW + lepZAB * lepZAB;
  if (!Number.isFinite(lepL) || lepL < 0) {
    throw new Error(
      `dailyTokenLepageHalves: non-finite or negative L (n=${n}, L=${lepL})`,
    );
  }
  // chi-2(2) survival = exp(-x/2)
  const lepPValue = Math.exp(-lepL / 2);
  const lepZ = Math.sqrt(lepL);

  return {
    mean: mu,
    stddev,
    nSamples: n,
    lepN1: n1,
    lepN2: n2,
    lepWA,
    lepABA,
    lepZW,
    lepZAB,
    lepL,
    lepPValue,
    lepZ,
  };
}

/**
 * Signed orthogonal decomposition of the Lepage joint
 * statistic into a SIGNED LOCATION channel and a SIGNED
 * SCALE channel matching the per-axis sign conventions.
 *
 *   lepLocZ   = -zW   (positive = SECOND half stochastically
 *                       larger; matches axis-115 mwZ sign)
 *   lepScaleZ = +zAB  (positive = SECOND half MORE dispersed;
 *                       matches axis-170 abZ sign)
 *
 * EXACT IDENTITY:
 *
 *     lepLocZ^2 + lepScaleZ^2  ===  lepL
 *
 * (sign flips do not affect squared values; both channels
 * have the same magnitude as zW and zAB).
 *
 * Pure helper, no external dependency.
 */
export function lepageSignedChannels(
  zW: number,
  zAB: number,
): { lepLocZ: number; lepScaleZ: number } {
  if (!Number.isFinite(zW) || !Number.isFinite(zAB)) {
    throw new Error(
      `lepageSignedChannels: non-finite zW/zAB (zW=${zW}, zAB=${zAB})`,
    );
  }
  return { lepLocZ: -zW, lepScaleZ: zAB };
}

/**
 * Classification label for the Lepage joint signal based
 * on the magnitude ratio of (lepLocZ, lepScaleZ).
 *
 *   |lepLocZ| / |lepScaleZ| > 2  ->  'location-dominant'
 *   |lepScaleZ| / |lepLocZ| > 2  ->  'scale-dominant'
 *   both below 0.5               ->  'null-like'
 *   otherwise                    ->  'mixed'
 *
 * Mirrors the cucconiDirectionLabel cutoff (axis-174
 * v0.6.450 refinement) for cross-axis consistency.
 */
export type LepageDirection =
  | 'null-like'
  | 'location-dominant'
  | 'scale-dominant'
  | 'mixed';

export function lepageDirectionLabel(
  lepLocZ: number,
  lepScaleZ: number,
): LepageDirection {
  if (!Number.isFinite(lepLocZ) || !Number.isFinite(lepScaleZ)) {
    throw new Error(
      `lepageDirectionLabel: non-finite inputs (lepLocZ=${lepLocZ}, lepScaleZ=${lepScaleZ})`,
    );
  }
  const aL = Math.abs(lepLocZ);
  const aS = Math.abs(lepScaleZ);
  if (aL < 0.5 && aS < 0.5) return 'null-like';
  if (aS === 0) return 'location-dominant';
  if (aL === 0) return 'scale-dominant';
  if (aL / aS > 2) return 'location-dominant';
  if (aS / aL > 2) return 'scale-dominant';
  return 'mixed';
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

export function buildDailyTokenLepageHalves(
  queue: QueueLine[],
  opts: DailyTokenLepageHalvesOptions = {},
): DailyTokenLepageHalvesReport {
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
  const sort: DailyTokenLepageHalvesSort = opts.sort ?? 'lepLDesc';
  const validSorts: DailyTokenLepageHalvesSort[] = [
    'lepL',
    'lepLDesc',
    'lepPValue',
    'lepPValueDesc',
    'lepZ',
    'lepZDesc',
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
  const rows: DailyTokenLepageHalvesSourceRow[] = [];

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
      result = dailyTokenLepageHalves(filled);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenLepageHalvesSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      lepN1: result.lepN1,
      lepN2: result.lepN2,
      lepWA: result.lepWA,
      lepABA: result.lepABA,
      lepZW: result.lepZW,
      lepZAB: result.lepZAB,
      lepL: result.lepL,
      lepPValue: result.lepPValue,
      lepZ: result.lepZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'lepL':
        primary = a.lepL - b.lepL;
        break;
      case 'lepLDesc':
        primary = b.lepL - a.lepL;
        break;
      case 'lepPValue':
        primary = a.lepPValue - b.lepPValue;
        break;
      case 'lepPValueDesc':
        primary = b.lepPValue - a.lepPValue;
        break;
      case 'lepZ':
        primary = a.lepZ - b.lepZ;
        break;
      case 'lepZDesc':
        primary = b.lepZ - a.lepZ;
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
 * Corpus-level aggregator for axis-175 per-source results.
 * Combines per-source `lepPValue` values into a single
 * corpus-level summary via FISHER'S COMBINED P-VALUE
 * METHOD (Fisher 1932 sec. 21.1):
 *
 *   chi2 = -2 * sum_i log(lepPValue_i)
 *   fisherCombinedPValue = P(Chi^2_{2m} > chi2)
 *
 * with m = rowsUsed. Under the per-source-independent
 * null, chi2 is exactly chi-squared(2m).
 *
 * Why Fisher (this axis): Lepage L is intrinsically
 * UNSIGNED (sum-of-squares of two signed components).
 * Fisher's combined-p preserves the right semantics for
 * an unsigned upper-tail aggregation; small lepPValue
 * inflates -2 ln p regardless of the underlying
 * direction.
 */
export interface LepageHalvesCorpusAggregate {
  fisherChi2: number;
  fisherCombinedPValue: number;
  meanLepL: number;
  rowsUsed: number;
  rowsSkipped: number;
}

export function aggregateLepageHalves(
  rows: ReadonlyArray<{ lepL: number; lepPValue: number }>,
): LepageHalvesCorpusAggregate {
  let chi2 = 0;
  let sumL = 0;
  let used = 0;
  let skipped = 0;
  for (const r of rows) {
    if (
      !Number.isFinite(r.lepL) ||
      r.lepL < 0 ||
      !Number.isFinite(r.lepPValue) ||
      r.lepPValue <= 0 ||
      r.lepPValue > 1
    ) {
      skipped += 1;
      continue;
    }
    chi2 += -2 * Math.log(r.lepPValue);
    sumL += r.lepL;
    used += 1;
  }
  if (used === 0) {
    return {
      fisherChi2: 0,
      fisherCombinedPValue: 1,
      meanLepL: Number.NaN,
      rowsUsed: 0,
      rowsSkipped: skipped,
    };
  }
  const fisherCombinedPValue = chiSquaredUpperTailLep(chi2, 2 * used);
  return {
    fisherChi2: chi2,
    fisherCombinedPValue,
    meanLepL: sumL / used,
    rowsUsed: used,
    rowsSkipped: skipped,
  };
}

/**
 * Chi-squared upper tail Q(x; k) via the regularised upper
 * incomplete gamma. Self-contained (mirrors the axis-174
 * implementation). Max relative error ~1e-12.
 */
export function chiSquaredUpperTailLep(x: number, k: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(k)) {
    throw new Error(`chiSquaredUpperTailLep: non-finite input (x=${x}, k=${k})`);
  }
  if (k <= 0) {
    throw new Error(`chiSquaredUpperTailLep: k must be positive (got ${k})`);
  }
  if (x <= 0) return 1;
  const s = k / 2;
  const xHalf = x / 2;
  const gln = lanczosLogGammaLep(s);
  if (xHalf < s + 1) {
    let ap = s;
    let sum = 1 / s;
    let del = sum;
    for (let i = 0; i < 200; i += 1) {
      ap += 1;
      del *= xHalf / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    const lower = sum * Math.exp(-xHalf + s * Math.log(xHalf) - gln);
    const upper = 1 - lower;
    return upper < 0 ? 0 : upper > 1 ? 1 : upper;
  } else {
    const FPMIN = 1e-300;
    let b = xHalf + 1 - s;
    let c = 1 / FPMIN;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 200; i += 1) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    const upper = h * Math.exp(-xHalf + s * Math.log(xHalf) - gln);
    return upper < 0 ? 0 : upper > 1 ? 1 : upper;
  }
}

export function lanczosLogGammaLep(x: number): number {
  if (!Number.isFinite(x) || x <= 0) {
    throw new Error(`lanczosLogGammaLep: x must be > 0 (got ${x})`);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const xm = x - 1;
  let a = c[0]!;
  const t = xm + g + 0.5;
  for (let i = 1; i < 9; i += 1) {
    a += c[i]! / (xm + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}
