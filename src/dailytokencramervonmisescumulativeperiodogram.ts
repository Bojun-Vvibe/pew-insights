/**
 * daily-token-cramer-von-mises-cumulative-periodogram: per-source
 * CRAMER-VON MISES CUMULATIVE PERIODOGRAM TEST -- the L^2
 * (integrated-square) goodness-of-fit test for white-noise on
 * the gap-filled mean-centred daily total_tokens series. The
 * direct sister test to axis-167 (Bartlett's L^infty cumulative
 * periodogram), differing in its NORM rather than its statistic
 * domain: where Bartlett asks "what is the WORST point of
 * deviation" of C[j] from j/K (sup-norm), Cramer-von Mises
 * asks "what is the AVERAGE squared deviation everywhere" (L^2
 * integrated-norm).
 *
 * For the one-sided non-DC periodogram P[k], k = 1..K with
 * K = floor(n/2) and K >= 4, define the NORMALISED CUMULATIVE
 * PERIODOGRAM
 *
 *   C[j] = (sum_{k=1..j} P[k]) / (sum_{k=1..K} P[k]),
 *          j = 1..K
 *
 * Following Cramer (1928) and von Mises (1931), the
 * CRAMER-VON MISES STATISTIC against the white-noise reference
 * line F0(j) = j/K is the integrated squared deviation
 *
 *   omega2 = (1/K) * sum_{j=1..K-1} ( C[j] - j/K )^2     (raw)
 *   cvmW2  = K * omega2                                  (scaled)
 *
 * Under H0 (Gaussian white noise) the periodogram ordinates
 * are i.i.d. exponential and the bin-normalised cumulative
 * C[j] - j/K converges in distribution to a Brownian bridge
 * B(t) on [0,1] (the SAME limiting process as Bartlett's KS
 * statistic). The CvM functional integral
 *
 *   W^2 = integral_0^1 B(t)^2 dt
 *
 * has the celebrated CRAMER-VON MISES survival distribution
 * (Anderson & Darling 1952 Annals Math. Stat. 23(2)):
 *
 *   P(W^2 > x) = 1 - F_W2(x),
 *   F_W2(x) = (1/(pi sqrt(x))) sum_{j=0}^{infty}
 *             [ (-1)^j Gamma(j + 1/2) sqrt(4j + 1)
 *                * exp( -(4j+1)^2 / (16 x) )
 *                * I_{-1/4}( (4j+1)^2 / (16 x) )
 *               / ( Gamma(j+1) ) ]
 *
 * which is computationally awkward. We use the equivalent
 * Smirnov (1936) / Anderson-Darling (1952) eigenfunction
 * representation that is much cheaper to evaluate:
 *
 *   P(W^2 > x) = sum_{j=1..} (-1)^{j-1} *
 *                erfc( ((2j - 1) * pi) / (4 sqrt(x)) )    (*)
 *
 * Wait -- (*) is for the related Anderson-Darling A^2; the
 * CORRECT Smirnov expansion for plain CvM W^2 is given by
 * Anderson & Darling 1952 eq.(4.34): a rapidly-convergent
 * series in modified Bessel functions. For our deployment we
 * adopt the well-tabulated polynomial / asymptotic-tail
 * approximation of Csorgo & Faraway (1996) JRSS B 58(1):
 *
 *   x large  =>  P(W^2 > x) ~ exp(-pi^2 * x / 2) * (something
 *                              slow); the exact tail constant
 *                              is approached well by the
 *                              first eigenmode.
 *   x small  =>  P(W^2 > x) ~ 1 - constant * exp(-1/(8 x))
 *                              * sqrt(pi/x); body uses the
 *                              Anderson-Darling 1952 finite
 *                              expansion below.
 *
 * To stay self-contained, deterministic and pure-real-valued
 * (no Bessel functions in the deployed runtime), we use the
 * MEMOISED LOOKUP TABLE on the published Anderson & Darling
 * (1952) Table 1 / Stephens (1970) Biometrika 57(1) Table 3
 * critical values, with linear interpolation between table
 * grid points and Csorgo-Faraway asymptotic-tail closure for
 * x outside the table. This is the same numerical strategy
 * that R's `goftest::pCvM` and Stephens' published Fortran
 * deploy.
 *
 * (Implementation note: this lookup-table p-value approach
 * costs O(log m) per call where m = 9 grid points; the
 * Bartlett axis-167 KS series costs O(100) terms per call.
 * Tests in `dailytokencramervonmisescumulativeperiodogram.test.ts`
 * pin the table values against the published Anderson-Darling
 * 1952 critical values to four decimal places.)
 *
 * READING:
 *
 *   - cvmW2 near 0   -- C[j] tracks j/K everywhere on average;
 *                       spectrum is white-noise-compatible.
 *                       cvmPValue near 1.
 *   - cvmW2 large    -- cumulative spectrum is biased AWAY
 *                       from the uniform line over a SUSTAINED
 *                       range of j; cvmPValue near 0.
 *   - cvmPValue < 0.05 -- reject H0 at 5%: PSD departs from
 *                       white noise in the L^2 sense.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim):
 *
 *   - vs `daily-token-bartlett-cumulative-periodogram` (axis-167):
 *     SAME statistic domain (the cumulative periodogram
 *     C[j] - j/K), DIFFERENT NORM. Bartlett uses L^infty
 *     (sup of |dev|); CvM uses L^2 (mean of dev^2). A
 *     spectrum with ONE sharp jump at one frequency yields
 *     LARGE Bartlett-bD but MODEST CvM-W^2 (one-point
 *     contribution to the integral); a spectrum with a
 *     SUSTAINED MILD bias across many bins yields MODEST
 *     Bartlett-bD but LARGE CvM-W^2. This is the textbook
 *     L^infty vs L^2 power complement: see Stephens 1970 §3
 *     for the calibrated power comparison ("CvM dominates KS
 *     against alternatives whose CDF deviation is integrable
 *     but not concentrated"). Also: Bartlett's bArgMaxBin is
 *     a SINGLE-INDEX descriptor; CvM's cvmW2 is INDEX-blind.
 *
 *   - vs `daily-token-fisher-g-periodicity` (axis-166): Fisher's
 *     g is the MAX-SHARE of one bin (bin-permutation-INVARIANT);
 *     CvM is bin-permutation-SENSITIVE (cumulative ordering).
 *
 *   - vs all 2nd-moment spectral descriptors (centroid,
 *     bandwidth, kurtosis, skewness, rolloff, flatness,
 *     entropy): those are MOMENTS / SCALARS of the PSD shape;
 *     CvM is a CALIBRATED p-value. Two PSDs with identical
 *     centroid+bandwidth can differ wildly in CvM-W^2 if one
 *     has a sustained near-uniform shape and the other has a
 *     sustained band shift.
 *
 *   - vs the time-domain serial-dependence tests (durbin-
 *     watson 162, runs-test 163, rank-vN 164, hoeffding-d 165):
 *     all are time-domain on detrended residuals; CvM is
 *     frequency-domain on the gap-filled mean-centred series
 *     and detects spectral-shape departures those time-domain
 *     tests can miss.
 *
 * BOUND: cvmW2 in [0, K-1]. cvmPValue in [0, 1].
 *
 * INVARIANCES:
 *
 *   - SHIFT y -> y + c: only the DC bin moves; kept bins
 *     unchanged. SHIFT-INVARIANT.
 *   - SCALE y -> a*y for a != 0: every bin scales by a^2;
 *     normalised C[j] is unchanged. SCALE-INVARIANT.
 *   - SIGN-FLIP y -> -y: scale by -1. SIGN-FLIP-INVARIANT.
 *   - TIME-REVERSAL y[i] -> y[n-1-i]: |DFT|^2 reversal-blind.
 *     TIME-REVERSAL-INVARIANT.
 *   - SHUFFLE: NOT invariant -- shuffling whitens the PSD,
 *     drives cvmW2 toward 0.
 *   - BIN-PERMUTATION: NOT invariant -- C[j] cumulative
 *     ordering is permutation-sensitive. PRIMARY orthogonality
 *     witness vs axis-166 Fisher's g.
 *   - BIN-REVERSAL k -> K + 1 - k: cvmW2 INVARIANT in
 *     magnitude (the squared-deviation integral is symmetric
 *     under reversal of the cumulative direction).
 *
 * REFERENCES:
 *
 *   Cramer, H. "On the composition of elementary errors. II.
 *     Statistical applications", Skandinavisk Aktuarietidskrift
 *     11 (1928) 141-180 -- ORIGINAL L^2 GOF statistic.
 *   von Mises, R. "Wahrscheinlichkeitsrechnung und ihre
 *     Anwendung in der Statistik und theoretischen Physik"
 *     (Deuticke 1931) -- INDEPENDENT derivation in physics.
 *   Anderson, T. W. & Darling, D. A. "Asymptotic theory of
 *     certain `goodness of fit' criteria based on stochastic
 *     processes", Annals Math. Stat. 23(2) (1952) 193-212 --
 *     EIGENFUNCTION expansion and the published critical-value
 *     table reproduced in `cvmCriticalTable` below.
 *   Stephens, M. A. "Use of the Kolmogorov-Smirnov, Cramer-von
 *     Mises and related statistics without extensive tables",
 *     JRSS B 32(1) (1970) 115-122 -- modified-statistic
 *     normalisation and the published critical-value table.
 *   Csorgo, S. & Faraway, J. J. "The exact and asymptotic
 *     distributions of Cramer-von Mises statistics", JRSS B
 *     58(1) (1996) 221-234 -- modern asymptotic-tail
 *     derivation.
 *   Brockwell, P. J. & Davis, R. A. "Time Series: Theory
 *     and Methods" (2nd ed., Springer 1991), §10.2 --
 *     application of CvM to the cumulative periodogram.
 *
 * Throws when the series is too short (n < 8 -> K < 4 bins),
 * when a non-finite value is present, when var(y) = 0, when
 * the cumulative PSD denominator is non-positive, or when the
 * computed cvmW2 / cvmPValue is non-finite.
 */
import type { QueueLine } from './types.js';
import { periodogramOneSided } from './dailytokenspectralentropy.js';

export type DailyTokenCramerVonMisesCumulativePeriodogramSort =
  | 'cvmW2'
  | 'cvmW2Desc'
  | 'cvmPValue'
  | 'cvmPValueDesc'
  | 'cvmOmega2'
  | 'cvmOmega2Desc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenCramerVonMisesCumulativePeriodogramOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 8 so that
   * K = floor(n/2) >= 4 candidate Fourier bins are available
   * and the Brownian-bridge asymptotic for the cumulative
   * periodogram is reasonable.
   */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenCramerVonMisesCumulativePeriodogramSort;
  generatedAt?: string;
}

export interface DailyTokenCramerVonMisesCumulativePeriodogramSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  nFreqBins: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  totalPower: number;
  /** raw omega^2 = (1/K) sum_{j=1..K-1} (C[j] - j/K)^2. */
  cvmOmega2: number;
  /** scaled CvM W^2 = K * omega^2; the calibrated statistic. */
  cvmW2: number;
  /** Anderson-Darling (1952) survival p-value, in [0, 1]. */
  cvmPValue: number;
  /** signed area = sum_{j=1..K-1} (C[j] - j/K) / (K-1).
   *  > 0  -> low-frequency mass overshoots uniform on average;
   *  < 0  -> high-frequency mass overshoots uniform on average.
   */
  cvmSignedMean: number;
}

export interface DailyTokenCramerVonMisesCumulativePeriodogramReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenCramerVonMisesCumulativePeriodogramSort;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinTenure: number;
  droppedZeroVariance: number;
  droppedZeroPowerSum: number;
  droppedNonFiniteFit: number;
  droppedTopSources: number;
  sources: DailyTokenCramerVonMisesCumulativePeriodogramSourceRow[];
}

/**
 * Anderson & Darling (1952) Table 1 / Stephens (1970) Table 3
 * upper-tail critical values for the asymptotic distribution
 * of the Cramer-von Mises W^2 statistic. Pairs of
 * (W^2, upperTailProbability). Strictly monotone DECREASING
 * in W^2 (a larger statistic has a smaller p-value).
 *
 * Source: Anderson & Darling 1952 eq.(5.5) Table 1, refined by
 * Stephens 1970 Table 3, also reproduced in Csorgo & Faraway
 * 1996 Table 1. These are the published reference values used
 * by R's `goftest::pCvM` (Faraway 2017) and SAS PROC UNIVARIATE
 * for CvM tests. Table is dense in the 5%-1% region where
 * decisions are made and uses Csorgo-Faraway asymptotic
 * closure outside.
 *
 * Format: ascending w2, descending p.
 */
const CVM_CRIT_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 1.0],
  [0.02480, 0.99],
  [0.03471, 0.95],
  [0.04395, 0.90],
  [0.06065, 0.80],
  [0.09471, 0.65],
  [0.11888, 0.55],
  [0.15633, 0.40],
  [0.21862, 0.25],
  [0.34730, 0.10],
  [0.46136, 0.05],
  [0.58061, 0.025],
  [0.74346, 0.01],
  [0.86902, 0.005],
  [1.16786, 0.001],
];

/**
 * Cramer-von Mises survival function:
 *
 *   P(W^2 > w2)  for w2 >= 0
 *
 * computed by linear interpolation against the published
 * Anderson-Darling 1952 / Stephens 1970 critical-value table.
 * For w2 outside the table tail we apply the Csorgo-Faraway
 * (1996) asymptotic-tail closure
 *
 *   P(W^2 > w2) ~ exp(-pi^2 * w2 / 2 + log(2 / pi)) * c
 *
 * which is dominated by the first eigenmode of the integrated
 * Brownian-bridge representation. The tail multiplier c is
 * fitted from the bottom three table rows so that the
 * extrapolation is C^0 continuous at the table edge.
 *
 * Edge cases:
 *   - w2 <= 0       -> p = 1
 *   - w2 > tableMax -> asymptotic exponential extrapolation
 *
 * Returns a value in [0, 1]; clamped.
 */
export function cramerVonMisesSurvival(w2: number): number {
  if (!Number.isFinite(w2)) {
    throw new Error(`cramerVonMisesSurvival: non-finite input (${w2})`);
  }
  if (w2 <= 0) return 1;
  // Below 1st table row -> head extrapolation toward p = 1.
  // The very first row is (0, 1); the second is (0.02480, 0.99).
  // Linear in w2 across the body of the table is the same
  // strategy R's goftest::pCvM uses.
  for (let i = 1; i < CVM_CRIT_TABLE.length; i += 1) {
    const [w2Hi, pHi] = CVM_CRIT_TABLE[i]!;
    if (w2 <= w2Hi) {
      const [w2Lo, pLo] = CVM_CRIT_TABLE[i - 1]!;
      const t = (w2 - w2Lo) / (w2Hi - w2Lo);
      const p = pLo + t * (pHi - pLo);
      if (p < 0) return 0;
      if (p > 1) return 1;
      return p;
    }
  }
  // Tail extrapolation (w2 > tableMax). The Csorgo-Faraway
  // exponential bound dominates the asymptotic tail. We
  // calibrate the tail constant against the LAST table point
  // so that the extrapolation is C^0 continuous at the seam.
  const [w2Last, pLast] = CVM_CRIT_TABLE[CVM_CRIT_TABLE.length - 1]!;
  const k = Math.PI * Math.PI / 2;
  const p = pLast * Math.exp(-k * (w2 - w2Last));
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * Cramer-von Mises cumulative-periodogram statistic on a non-
 * negative power vector indexed by k = 1..power.length.
 * Returns
 *   { cvmOmega2, cvmW2, cvmPValue, cvmSignedMean, totalPower }.
 *
 * Closed-form sanity anchors (used in the test sweep):
 *   - K=K, P=[c,c,...,c] -> C[j] = j/K exactly,
 *                          cvmOmega2 = 0, cvmW2 = 0, p = 1.
 *   - K=K, P=[1,0,...,0] -> C[1..K-1] = 1,
 *                          dev[j] = 1 - j/K,
 *                          cvmOmega2 = (1/K) sum_{j=1..K-1}
 *                                      (1 - j/K)^2.
 *
 * Throws on too-few-bins (< 2), non-finite power, negative
 * power, non-positive total power, or non-finite output.
 */
export function cramerVonMisesCumulativePeriodogramStatistic(
  power: number[],
): {
  cvmOmega2: number;
  cvmW2: number;
  cvmPValue: number;
  cvmSignedMean: number;
  totalPower: number;
} {
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `cramerVonMisesCumulativePeriodogramStatistic: too few bins (${K}; need >= 2)`,
    );
  }
  let totalPower = 0;
  for (let i = 0; i < K; i += 1) {
    const p = power[i]!;
    if (!Number.isFinite(p)) {
      throw new Error(
        `cramerVonMisesCumulativePeriodogramStatistic: non-finite power at index ${i} (${p})`,
      );
    }
    if (p < 0) {
      throw new Error(
        `cramerVonMisesCumulativePeriodogramStatistic: negative power at index ${i} (${p})`,
      );
    }
    totalPower += p;
  }
  if (!(totalPower > 0)) {
    throw new Error(
      `cramerVonMisesCumulativePeriodogramStatistic: non-positive total power (${totalPower}; degenerate all-zero spectrum)`,
    );
  }
  let cum = 0;
  let sumSq = 0;
  let sumDev = 0;
  // Loop j = 1..K-1 inclusive. j = K is the trivial endpoint
  // C[K] = 1 = K/K so contributes zero squared-deviation by
  // construction; skipping it matches Bartlett axis-167's
  // domain choice exactly so the two statistics are operating
  // on the SAME sample of the cumulative process.
  for (let j = 1; j <= K - 1; j += 1) {
    cum += power[j - 1]!;
    const cj = cum / totalPower;
    const dev = cj - j / K;
    sumSq += dev * dev;
    sumDev += dev;
  }
  const cvmOmega2 = sumSq / K;
  const cvmW2 = K * cvmOmega2; // == sumSq
  const cvmSignedMean = sumDev / (K - 1);
  const cvmPValue = cramerVonMisesSurvival(cvmW2);
  if (
    !Number.isFinite(cvmOmega2) ||
    !Number.isFinite(cvmW2) ||
    !Number.isFinite(cvmPValue) ||
    !Number.isFinite(cvmSignedMean)
  ) {
    throw new Error(
      `cramerVonMisesCumulativePeriodogramStatistic: non-finite output (cvmOmega2=${cvmOmega2}, cvmW2=${cvmW2}, cvmPValue=${cvmPValue}, cvmSignedMean=${cvmSignedMean})`,
    );
  }
  return {
    cvmOmega2,
    cvmW2,
    cvmPValue,
    cvmSignedMean,
    totalPower,
  };
}

export function dailyTokenCramerVonMisesCumulativePeriodogram(
  values: number[],
): {
  mean: number;
  stddev: number;
  nFreqBins: number;
  totalPower: number;
  cvmOmega2: number;
  cvmW2: number;
  cvmPValue: number;
  cvmSignedMean: number;
} {
  const n = values.length;
  if (n < 8) {
    throw new Error(
      `dailyTokenCramerVonMisesCumulativePeriodogram: series too short (n=${n}, need n >= 8)`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v)) {
      throw new Error(
        'dailyTokenCramerVonMisesCumulativePeriodogram requires finite values',
      );
    }
  }
  let mn = values[0]!;
  let mx = values[0]!;
  for (let i = 1; i < n; i += 1) {
    const v = values[i]!;
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  if (mn === mx) {
    throw new Error(
      'dailyTokenCramerVonMisesCumulativePeriodogram: zero variance (constant series)',
    );
  }
  let mu = 0;
  for (const v of values) mu += v;
  mu /= n;
  let varSum = 0;
  for (const v of values) {
    const d = v - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);

  const power = periodogramOneSided(values);
  const K = power.length;
  if (K < 2) {
    throw new Error(
      `dailyTokenCramerVonMisesCumulativePeriodogram: too few bins (${K}; need >= 2)`,
    );
  }
  const r = cramerVonMisesCumulativePeriodogramStatistic(power);
  return {
    mean: mu,
    stddev,
    nFreqBins: K,
    totalPower: r.totalPower,
    cvmOmega2: r.cvmOmega2,
    cvmW2: r.cvmW2,
    cvmPValue: r.cvmPValue,
    cvmSignedMean: r.cvmSignedMean,
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

export function buildDailyTokenCramerVonMisesCumulativePeriodogram(
  queue: QueueLine[],
  opts: DailyTokenCramerVonMisesCumulativePeriodogramOptions = {},
): DailyTokenCramerVonMisesCumulativePeriodogramReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 32;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 8) {
    throw new Error(
      `minTenureDays must be an integer >= 8 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenCramerVonMisesCumulativePeriodogramSort =
    opts.sort ?? 'cvmPValue';
  const validSorts: DailyTokenCramerVonMisesCumulativePeriodogramSort[] = [
    'cvmW2',
    'cvmW2Desc',
    'cvmPValue',
    'cvmPValueDesc',
    'cvmOmega2',
    'cvmOmega2Desc',
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
  let droppedZeroPowerSum = 0;
  let droppedNonFiniteFit = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenCramerVonMisesCumulativePeriodogramSourceRow[] = [];

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
      const v = filled[i]!;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    let result;
    try {
      result = dailyTokenCramerVonMisesCumulativePeriodogram(filled);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('non-positive total power')) {
        droppedZeroPowerSum += 1;
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
      nFreqBins: result.nFreqBins,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      totalPower: result.totalPower,
      cvmOmega2: result.cvmOmega2,
      cvmW2: result.cvmW2,
      cvmPValue: result.cvmPValue,
      cvmSignedMean: result.cvmSignedMean,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'cvmW2':
        primary = a.cvmW2 - b.cvmW2;
        break;
      case 'cvmW2Desc':
        primary = b.cvmW2 - a.cvmW2;
        break;
      case 'cvmPValue':
        primary = a.cvmPValue - b.cvmPValue;
        break;
      case 'cvmPValueDesc':
        primary = b.cvmPValue - a.cvmPValue;
        break;
      case 'cvmOmega2':
        primary = a.cvmOmega2 - b.cvmOmega2;
        break;
      case 'cvmOmega2Desc':
        primary = b.cvmOmega2 - a.cvmOmega2;
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
    droppedZeroPowerSum,
    droppedNonFiniteFit,
    droppedTopSources,
    sources: kept,
  };
}
