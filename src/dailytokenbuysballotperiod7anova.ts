/**
 * daily-token-buys-ballot-period7-anova: per-source
 * BUYS-BALLOT 1847 PERIOD-7 ONE-WAY ANOVA F-TEST for a
 * fixed weekday-of-week periodicity in the gap-filled
 * daily total_tokens series.
 *
 * TWO-HUNDRED-AND-SIXTEENTH cross-source axis.
 *
 * Mechanism. Buys-Ballot (1847, *Les Changements
 * Periodiques de Temperature*, Utrecht: Kemink) proposed
 * folding a long observational series of length n at a
 * KNOWN period p, arranging the values into a p-column
 * table (the eponymous Buys-Ballot table), and comparing
 * the column means against the grand mean. Modern
 * treatments (Brockwell & Davis 1991 *Time Series:
 * Theory and Methods* sec. 1.4 "Classical decomposition
 * of a time series", Wei 2006 *Time Series Analysis* 2nd
 * ed. sec. 2.7) frame this exactly as a one-way
 * fixed-effect ANOVA F-test on the column factor.
 *
 * For our daily-token series the natural KNOWN period is
 * p = 7 (weekday-of-week). Concretely: index the gap-
 * filled tenure series x[0], x[1], ..., x[n-1] starting
 * at acc.firstActiveDay (UTC). Define the column index
 *
 *     c[i] = i mod 7                  for i = 0..n-1
 *
 * (so c[0] is the weekday of firstActiveDay, c[1] the
 * next weekday, etc.) Let n_j = #{i : c[i] = j} be the
 * count in column j, mu_j = (1/n_j) sum_{c[i]=j} x[i] the
 * column mean, and mu = (1/n) sum_i x[i] the grand mean.
 *
 *     SS_between = sum_{j=0}^{6} n_j * (mu_j - mu)^2
 *     SS_within  = sum_{i=0}^{n-1} (x[i] - mu_{c[i]})^2
 *     SS_total   = sum_{i=0}^{n-1} (x[i] - mu)^2
 *                = SS_between + SS_within
 *
 * Under H0 of "no weekday effect" (all 7 column means
 * equal, equivalently mu_j = mu for all j), and under
 * iid Normal residuals e[i] = x[i] - mu_{c[i]} ~ N(0,
 * sigma^2), the F statistic
 *
 *     bbF = ( SS_between / (p - 1) ) /
 *           ( SS_within  / (n - p) )
 *
 * follows an F(p - 1, n - p) = F(6, n - 7) distribution
 * (Scheffe 1959 *The Analysis of Variance* sec. 2.4;
 * Searle 1971 *Linear Models* sec. 6.3). The two-sided
 * (actually one-sided upper-tail, since F is non-
 * negative) p-value is
 *
 *     bbPValue = 1 - F_{6, n-7}(bbF) = I_{x}(p-1)/2, (n-p)/2)
 *
 * with x = (p-1)*F / ((p-1)*F + (n-p)) and I the
 * regularised incomplete beta function (Abramowitz-Stegun
 * 26.5.20). We use a self-contained Lentz-method
 * continued-fraction evaluation of the incomplete beta
 * (Numerical Recipes 3rd ed. sec. 6.4 "Incomplete Beta
 * Function"), accurate to ~1e-10 across the required
 * argument range.
 *
 * SECONDARY DIAGNOSTIC. We additionally surface the
 * "weekday R-squared" eta^2 = SS_between / SS_total in
 * [0, 1] -- the fraction of total daily-token variance
 * explained by weekday-of-week alone. This is a
 * directly-interpretable EFFECT SIZE (Cohen 1988 sec.
 * 8.2.1), independent of n.
 *
 * SIGN CONVENTION. F-tests are inherently one-sided;
 * bbF >= 0 always. LARGE bbF (small bbPValue) =
 * SIGNIFICANT WEEKDAY-OF-WEEK PERIODICITY. SMALL bbF
 * (large bbPValue) = NO DETECTABLE WEEKDAY-OF-WEEK
 * STRUCTURE.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 *   - vs `iso-weekday-of-week-entropy` (axis-shape, NOT a
 *     daily-token axis here but a sibling): that axis is
 *     a Shannon entropy of the WEEKDAY MASS DISTRIBUTION
 *     (sum of token mass per weekday, normalised). It is
 *     PERMUTATION-INVARIANT within a weekday and
 *     BLIND TO INTRA-WEEKDAY VARIANCE: a source with all
 *     mass on Monday but with Mondays varying wildly
 *     between 1 and 1e9 has the same entropy as a source
 *     with all Mondays equal to 1e6. Axis-216 explicitly
 *     compares BETWEEN-weekday variance to WITHIN-weekday
 *     variance and so PUNISHES intra-weekday noise. Two
 *     sources can have identical weekday entropy and
 *     opposite bbPValues.
 *
 *   - vs `weekend-weekday-ratio`: that axis collapses to a
 *     2-level (weekend vs weekday) ratio of total mass.
 *     Axis-216 keeps all 7 levels and tests the
 *     OMNIBUS NULL "no effect at any of 7 weekdays". A
 *     source with strong Wed-vs-Tue contrast but no
 *     weekend signal will register on axis-216 and not on
 *     weekend-weekday-ratio.
 *
 *   - vs `daily-token-fisher-g-periodicity`: Fisher's g
 *     (1929 *Proc. R. Soc. A* 125:54-59) is a
 *     PERIODOGRAM-MAX statistic over ALL Fourier
 *     frequencies omega_k = 2*pi*k/n with k = 1..floor(n/2).
 *     It is a SEARCH over unknown frequencies. Axis-216
 *     fixes period p = 7 a priori (a STRUCTURAL not
 *     statistical choice), so:
 *     (a) axis-216 has SIX degrees of freedom in the
 *         numerator vs Fisher-g's 1 (the largest periodogram
 *         ordinate); the F vs Fisher-g critical structure
 *         is fundamentally different;
 *     (b) axis-216 detects ANY period-7 mean shift
 *         INCLUDING NON-SINUSOIDAL ones (e.g. only Sat is
 *         high, all other days flat -- this has nontrivial
 *         period-7 ANOVA but a small periodogram ordinate
 *         at frequency 1/7 because most Fourier mass leaks
 *         to harmonics);
 *     (c) Fisher-g controls family-wise alpha across all
 *         frequencies and so is conservative at any one
 *         frequency; axis-216 is a single-frequency test
 *         and so is more powerful at exactly omega = 2*pi/7.
 *
 *   - vs `daily-token-spectral-peak-frequency` and the
 *     spectral-flatness / spectral-entropy family: those
 *     are PSD-derived continuous-frequency descriptors of
 *     the entire spectrum (where most mass sits, how
 *     concentrated, etc). Axis-216 is a hypothesis-test
 *     statistic at a SINGLE pre-specified frequency. The
 *     spectrum can be flat (high spectral-entropy, low
 *     concentration) yet still have a small but
 *     STATISTICALLY SIGNIFICANT period-7 mean structure
 *     above iid Normal residuals; axis-216 catches that.
 *
 *   - vs `daily-token-mannkendall-tau` / `theil-sen-slope`
 *     / `cox-stuart-thirds-trend` (axis-215): those are
 *     MONOTONE-TREND tests; they are sensitive to
 *     ORDERED rise/fall over the full tenure but are
 *     INVARIANT to within-week reordering. Axis-216 is
 *     INVARIANT to monotonic transformations of the time
 *     index that preserve weekday alignment but is
 *     SENSITIVE to within-week reordering: shifting the
 *     series by 1 day permutes the column assignments and
 *     can wipe out a strong period-7 effect. The two
 *     statistics are mutually orthogonal in the sense
 *     that detrending the series leaves bbF unchanged
 *     (subtracting a linear trend is a constant within
 *     each column on average, removed by SS_between's
 *     mean-centering).
 *
 *   - vs `daily-token-page-l-block-trend` (axis-213):
 *     Page-L is a within-3-day-block ORDERED-ALTERNATIVE
 *     midrank test for monotone within-block trend.
 *     Axis-216 is an UNORDERED 7-cell ANOVA F. The two
 *     test orthogonal alternatives: Page-L is sensitive
 *     to within-block monotonicity, axis-216 to between-
 *     weekday mean inequality.
 *
 *   - vs `daily-token-runs-test-z` / `runs-test-detrended`:
 *     runs-tests count sign-of-difference runs. Axis-216
 *     measures variance partition. A series with strong
 *     period-7 structure (e.g. weekends low, weekdays
 *     high) has many short up-down runs at the weekly
 *     boundary and so a small runsZ (rejecting iid); but
 *     a series with ANY period-7 structure rejects on
 *     axis-216. The two reject overlapping alternatives
 *     but for STRUCTURALLY different reasons (run-length
 *     distribution vs explained variance share).
 *
 *   - vs all spectral / fractal-dimension / inequality
 *     axes: those are amplitude-only or
 *     permutation-invariant. Axis-216 is fundamentally
 *     PERIOD-PHASE-DEPENDENT: shifting the series by 1
 *     day relative to its calendar week REASSIGNS column
 *     labels and can change bbF by orders of magnitude.
 *
 * Headline question:
 * **"For each source, is there a STATISTICALLY
 *   SIGNIFICANT WEEKDAY-OF-WEEK MEAN STRUCTURE in the
 *   gap-filled daily-token series, after partitioning
 *   total variance into between-weekday and
 *   within-weekday components under the period-7
 *   Buys-Ballot table?"**
 *
 * References:
 *   Buys-Ballot, C. H. D., *Les Changements Periodiques
 *     de Temperature*, Utrecht: Kemink (1847). Original
 *     introduction of the period-folded table.
 *   Brockwell, P. J. & Davis, R. A., *Time Series:
 *     Theory and Methods*, 2nd ed., Springer 1991, sec.
 *     1.4 (classical decomposition; Buys-Ballot table).
 *   Wei, W. W. S., *Time Series Analysis: Univariate and
 *     Multivariate Methods*, 2nd ed., Pearson 2006, sec.
 *     2.7 (period-folding ANOVA on seasonal index).
 *   Scheffe, H., *The Analysis of Variance*, Wiley 1959,
 *     sec. 2.4 (one-way fixed-effect F-test, exact F
 *     reference distribution).
 *   Press, W. H. et al., *Numerical Recipes*, 3rd ed.,
 *     CUP 2007, sec. 6.4 (Lentz continued-fraction
 *     evaluation of the regularised incomplete beta).
 *   Cohen, J., *Statistical Power Analysis for the
 *     Behavioral Sciences*, 2nd ed., LEA 1988, sec. 8.2.1
 *     (eta^2 effect-size interpretation).
 *
 * Caveats:
 *
 *   - HARD FLOOR n >= 28 days. With p = 7 columns we need
 *     n - p >= 21 within-DOF for the F-approximation to
 *     have usable accuracy and at least 4 obs per column
 *     on average so that the column-mean SE is not
 *     dominated by a single observation. (Scheffe 1959
 *     sec. 10.4 finds the ANOVA F robust to non-Normal
 *     residuals once each cell has >= 4 obs.)
 *   - HARD FLOOR n_j >= 1 for every column j (no empty
 *     cells). With n >= 28 and p = 7 every column has
 *     n_j >= 4 by pigeonhole; we still defensively
 *     check.
 *   - The phase of column 0 depends on the WEEKDAY of
 *     acc.firstActiveDay. Two sources with the same
 *     period-7 effect but starting on different weekdays
 *     have their column-mean VECTORS cyclically shifted;
 *     the F statistic is invariant under cyclic shifts
 *     (it is a sum-over-columns) so bbF and bbPValue are
 *     phase-invariant. We do NOT report calendar-weekday
 *     names because the CLI is phase-agnostic.
 *   - Zero-padded sparse days inflate within-cell
 *     variance and so DEFLATE bbF; this is the right
 *     conservatism (a sparse intermittent source should
 *     not register a weekday effect on the basis of one
 *     big Tuesday). Sources where the within-cell SS is
 *     identically zero (all values equal in every column)
 *     trip the zero-variance gate before reaching this
 *     axis.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=28 so each column has >= 4 obs):
 *   pew-insights daily-token-buys-ballot-period7-anova
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-buys-ballot-period7-anova \
 *     --source vsc-redacted --json
 *
 *   # Sort by bbF descending (strongest weekday effect first):
 *   pew-insights daily-token-buys-ballot-period7-anova \
 *     --sort bbFDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenBuysBallotPeriod7AnovaSort =
  | 'bbF'
  | 'bbFDesc'
  | 'bbPValue'
  | 'bbPValueDesc'
  | 'bbEta2'
  | 'bbEta2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBuysBallotPeriod7AnovaOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 28 so
   * every weekday column has on average >= 4 obs and
   * the within-DOF n - 7 >= 21 is enough for the
   * F(6, n-7) approximation to have usable accuracy.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenBuysBallotPeriod7AnovaSort;
  generatedAt?: string;
}

export interface DailyTokenBuysBallotPeriod7AnovaSourceRow {
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
  /** Per-column counts n_0..n_6; cyclic-shift-invariant. */
  bbColumnCounts: number[];
  /** Between-weekday sum of squares. */
  bbSsBetween: number;
  /** Within-weekday sum of squares. */
  bbSsWithin: number;
  /** Total sum of squares = SsBetween + SsWithin (modulo float). */
  bbSsTotal: number;
  /** Numerator DOF p-1 = 6 (constant; carried for downstream consumers). */
  bbDfBetween: number;
  /** Denominator DOF n - p = n - 7. */
  bbDfWithin: number;
  /** F statistic = (SsBetween/(p-1)) / (SsWithin/(n-p)). */
  bbF: number;
  /** Eta^2 = SsBetween / SsTotal in [0, 1] (Cohen 1988 sec. 8.2.1). */
  bbEta2: number;
  /** One-sided upper-tail p-value under F(6, n-7). */
  bbPValue: number;
}

export interface DailyTokenBuysBallotPeriod7AnovaReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenBuysBallotPeriod7AnovaSort;
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
  sources: DailyTokenBuysBallotPeriod7AnovaSourceRow[];
}

/**
 * Natural log of the Gamma function via Lanczos g=7,n=9
 * approximation (Numerical Recipes 3rd ed. sec. 6.1).
 * Max relative error ~2e-10 for x > 0.
 *
 * Self-contained; matches the helper used internally by
 * the Buys-Ballot incomplete-beta routine below.
 */
export function lnGammaBuysBallot(x: number): number {
  if (!Number.isFinite(x) || x <= 0) {
    throw new Error(`lnGammaBuysBallot: x must be > 0 (got ${x})`);
  }
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const xx = x - 1;
  const t = xx + 7.5;
  let s = c[0]!;
  for (let i = 1; i < 9; i += 1) s += c[i]! / (xx + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(s)
  );
}

/**
 * Regularised incomplete beta I_x(a, b) via the Lentz
 * continued-fraction evaluation (Numerical Recipes 3rd
 * ed. sec. 6.4, eq. 6.4.5--6.4.6). Max relative error
 * ~1e-10 across 0 <= x <= 1, a, b > 0 of the magnitudes
 * we use (a = 3, b in [10, 200]).
 *
 * The symmetry I_x(a, b) = 1 - I_{1-x}(b, a) is used
 * when x > (a + 1) / (a + b + 2) for faster convergence.
 */
export function regularisedIncompleteBetaBuysBallot(
  x: number,
  a: number,
  b: number,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(
      `regularisedIncompleteBetaBuysBallot: non-finite input (x=${x},a=${a},b=${b})`,
    );
  }
  if (a <= 0 || b <= 0) {
    throw new Error(
      `regularisedIncompleteBetaBuysBallot: a and b must be > 0 (got a=${a},b=${b})`,
    );
  }
  if (x < 0 || x > 1) {
    throw new Error(
      `regularisedIncompleteBetaBuysBallot: x must be in [0,1] (got ${x})`,
    );
  }
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lnBetaPrefix =
    lnGammaBuysBallot(a + b) - lnGammaBuysBallot(a) - lnGammaBuysBallot(b);
  const front =
    Math.exp(lnBetaPrefix + a * Math.log(x) + b * Math.log(1 - x));

  const useSymmetry = x > (a + 1) / (a + b + 2);
  const xx = useSymmetry ? 1 - x : x;
  const aa = useSymmetry ? b : a;
  const bb = useSymmetry ? a : b;

  // Lentz's algorithm with epsilon thresholds per NR 5.2
  const fpmin = 1e-300;
  const eps = 3e-15;
  const qab = aa + bb;
  const qap = aa + 1;
  const qam = aa - 1;
  let c = 1;
  let d = 1 - (qab * xx) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aaTerm = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
    d = 1 + aaTerm * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aaTerm / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aaTerm = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
    d = 1 + aaTerm * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aaTerm / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  const cfBranch = (front * h) / aa;
  return useSymmetry ? 1 - cfBranch : cfBranch;
}

/**
 * Upper-tail p-value of the F(d1, d2) distribution at f.
 *
 *     P(F >= f) = I_{d2/(d2 + d1*f)}(d2/2, d1/2)
 *
 * (Abramowitz-Stegun 26.6.4). Returns 1 for f <= 0,
 * 0 for f = +inf.
 */
export function fDistributionUpperTailBuysBallot(
  f: number,
  d1: number,
  d2: number,
): number {
  if (!Number.isFinite(f)) {
    if (f === Number.POSITIVE_INFINITY) return 0;
    throw new Error(`fDistributionUpperTailBuysBallot: f must be finite (got ${f})`);
  }
  if (!Number.isFinite(d1) || !Number.isFinite(d2) || d1 <= 0 || d2 <= 0) {
    throw new Error(
      `fDistributionUpperTailBuysBallot: d1 and d2 must be > 0 (got d1=${d1},d2=${d2})`,
    );
  }
  if (f <= 0) return 1;
  const x = d2 / (d2 + d1 * f);
  return regularisedIncompleteBetaBuysBallot(x, d2 / 2, d1 / 2);
}

/**
 * Buys-Ballot 1847 PERIOD-7 partition: arrange `values`
 * into 7 weekday columns by c[i] = i mod 7 and compute
 * column counts, column means, between-column SS,
 * within-column SS, and total SS.
 *
 * EXACT IDENTITIES preserved by this function (verified
 * by the test suite):
 *   - bbColumnCounts.length === 7 always.
 *   - sum(bbColumnCounts) === values.length.
 *   - For values.length = 7k exactly, every column count
 *     equals k.
 *   - bbSsBetween + bbSsWithin === bbSsTotal modulo
 *     accumulated float error.
 *   - For all-equal values: bbSsBetween = bbSsWithin =
 *     bbSsTotal = 0.
 *   - For values strictly periodic with period 7
 *     (e.g. v[i] = i mod 7) and length 7k: bbSsWithin = 0
 *     and bbSsTotal = bbSsBetween > 0.
 *   - Cyclic shift of the input (v -> v rotated by k
 *     positions, k in [0..6]) PERMUTES bbColumnCounts and
 *     column means but leaves bbSsBetween, bbSsWithin and
 *     bbSsTotal numerically identical.
 *   - Adding a constant c to every value leaves all SS
 *     values identical (translation invariance).
 *   - Multiplying every value by a > 0 multiplies every
 *     SS value by a^2 (positive-scale homogeneity).
 */
export function partitionBuysBallotPeriod7(values: number[]): {
  bbColumnCounts: number[];
  bbColumnMeans: number[];
  bbSsBetween: number;
  bbSsWithin: number;
  bbSsTotal: number;
  bbGrandMean: number;
} {
  const n = values.length;
  const colSums = new Array<number>(7).fill(0);
  const colCounts = new Array<number>(7).fill(0);
  for (let i = 0; i < n; i += 1) {
    const c = i % 7;
    colSums[c]! += values[i]!;
    colCounts[c]! += 1;
  }
  const colMeans = new Array<number>(7).fill(0);
  for (let j = 0; j < 7; j += 1) {
    colMeans[j] = colCounts[j]! > 0 ? colSums[j]! / colCounts[j]! : 0;
  }
  let grandSum = 0;
  for (const v of values) grandSum += v;
  const grandMean = n > 0 ? grandSum / n : 0;
  let ssBetween = 0;
  for (let j = 0; j < 7; j += 1) {
    if (colCounts[j]! > 0) {
      const d = colMeans[j]! - grandMean;
      ssBetween += colCounts[j]! * d * d;
    }
  }
  let ssWithin = 0;
  let ssTotal = 0;
  for (let i = 0; i < n; i += 1) {
    const c = i % 7;
    const dWithin = values[i]! - colMeans[c]!;
    const dTotal = values[i]! - grandMean;
    ssWithin += dWithin * dWithin;
    ssTotal += dTotal * dTotal;
  }
  return {
    bbColumnCounts: colCounts,
    bbColumnMeans: colMeans,
    bbSsBetween: ssBetween,
    bbSsWithin: ssWithin,
    bbSsTotal: ssTotal,
    bbGrandMean: grandMean,
  };
}

/**
 * Buys-Ballot 1847 PERIOD-7 ANOVA F-test on a real-
 * valued series. Returns the column counts, the four
 * sum-of-squares quantities, the F statistic, eta^2,
 * and the upper-tail F(6, n-7) p-value.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - bbF >= 0 always.
 *   - bbEta2 in [0, 1] always.
 *   - bbF(x + c) === bbF(x) for any constant c
 *     (translation invariance).
 *   - bbF(a * x) === bbF(x) for any a > 0 (positive scale
 *     invariance: SS_between and SS_within both scale by
 *     a^2).
 *   - bbF(-x) === bbF(x) (variance partition is sign-
 *     invariant).
 *   - For x[i] = i mod 7 (perfect period-7 staircase),
 *     bbSsWithin = 0 and bbF = +infinity (we report
 *     Number.POSITIVE_INFINITY and bbPValue = 0).
 *   - For x = repeat(constant) the test is undefined
 *     (zero centred variance); we throw to be filtered
 *     upstream via droppedZeroVariance.
 *   - For x permuted within columns (within-week
 *     reordering that preserves c[i] = i mod 7), bbF
 *     changes; for x permuted ACROSS columns (e.g. fully
 *     random shuffle), bbF tends toward F(6, n-7) under
 *     iid Normal residuals.
 */
export function dailyTokenBuysBallotPeriod7Anova(values: number[]): {
  mean: number;
  stddev: number;
  nSamples: number;
  bbColumnCounts: number[];
  bbColumnMeans: number[];
  bbSsBetween: number;
  bbSsWithin: number;
  bbSsTotal: number;
  bbDfBetween: number;
  bbDfWithin: number;
  bbF: number;
  bbEta2: number;
  bbPValue: number;
} {
  const n = values.length;
  if (n < 28) {
    throw new Error(
      `dailyTokenBuysBallotPeriod7Anova: need at least 28 samples (got ${n})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenBuysBallotPeriod7Anova requires finite values',
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
      `dailyTokenBuysBallotPeriod7Anova: zero centred variance (n=${n})`,
    );
  }

  const part = partitionBuysBallotPeriod7(values);
  for (let j = 0; j < 7; j += 1) {
    if (part.bbColumnCounts[j]! < 1) {
      throw new Error(
        `dailyTokenBuysBallotPeriod7Anova: empty weekday column j=${j} (n=${n})`,
      );
    }
  }

  const dfBetween = 6;
  const dfWithin = n - 7;
  if (dfWithin < 21) {
    throw new Error(
      `dailyTokenBuysBallotPeriod7Anova: need n - 7 >= 21 (got ${dfWithin})`,
    );
  }

  let bbF: number;
  let bbPValue: number;
  if (part.bbSsWithin === 0) {
    // Perfect period-7 (no within-cell variance): F = +inf, p = 0.
    bbF = Number.POSITIVE_INFINITY;
    bbPValue = 0;
  } else {
    const msBetween = part.bbSsBetween / dfBetween;
    const msWithin = part.bbSsWithin / dfWithin;
    bbF = msBetween / msWithin;
    if (!Number.isFinite(bbF) || bbF < 0) {
      throw new Error(
        `dailyTokenBuysBallotPeriod7Anova: non-finite F (n=${n})`,
      );
    }
    bbPValue = fDistributionUpperTailBuysBallot(bbF, dfBetween, dfWithin);
  }

  const bbEta2 =
    part.bbSsTotal > 0 ? part.bbSsBetween / part.bbSsTotal : 0;

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bbColumnCounts: part.bbColumnCounts,
    bbColumnMeans: part.bbColumnMeans,
    bbSsBetween: part.bbSsBetween,
    bbSsWithin: part.bbSsWithin,
    bbSsTotal: part.bbSsTotal,
    bbDfBetween: dfBetween,
    bbDfWithin: dfWithin,
    bbF,
    bbEta2,
    bbPValue,
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

export function buildDailyTokenBuysBallotPeriod7Anova(
  queue: QueueLine[],
  opts: DailyTokenBuysBallotPeriod7AnovaOptions = {},
): DailyTokenBuysBallotPeriod7AnovaReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 28;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 28) {
    throw new Error(
      `minTenureDays must be an integer >= 28 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenBuysBallotPeriod7AnovaSort = opts.sort ?? 'bbFDesc';
  const validSorts: DailyTokenBuysBallotPeriod7AnovaSort[] = [
    'bbF',
    'bbFDesc',
    'bbPValue',
    'bbPValueDesc',
    'bbEta2',
    'bbEta2Desc',
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
  const rows: DailyTokenBuysBallotPeriod7AnovaSourceRow[] = [];

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
      result = dailyTokenBuysBallotPeriod7Anova(filled);
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
      bbColumnCounts: result.bbColumnCounts,
      bbSsBetween: result.bbSsBetween,
      bbSsWithin: result.bbSsWithin,
      bbSsTotal: result.bbSsTotal,
      bbDfBetween: result.bbDfBetween,
      bbDfWithin: result.bbDfWithin,
      bbF: result.bbF,
      bbEta2: result.bbEta2,
      bbPValue: result.bbPValue,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bbF':
        primary = a.bbF - b.bbF;
        break;
      case 'bbFDesc':
        primary = b.bbF - a.bbF;
        break;
      case 'bbPValue':
        primary = a.bbPValue - b.bbPValue;
        break;
      case 'bbPValueDesc':
        primary = b.bbPValue - a.bbPValue;
        break;
      case 'bbEta2':
        primary = a.bbEta2 - b.bbEta2;
        break;
      case 'bbEta2Desc':
        primary = b.bbEta2 - a.bbEta2;
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
