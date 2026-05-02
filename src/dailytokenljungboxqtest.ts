/**
 * daily-token-ljung-box-q-test: per-source LJUNG-BOX
 * PORTMANTEAU Q-TEST FOR SERIAL CORRELATION at H lags
 * on the gap-filled mean-centred daily total_tokens
 * series.
 *
 * ONE-HUNDRED-AND-FOURTEENTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Let xbar = mean(x). For each
 * lag k in {1, .., H} compute the BIASED sample
 * autocorrelation
 *
 *     r_k = sum_{t=0..n-1-k} (x[t]-xbar)(x[t+k]-xbar)
 *           / sum_{t=0..n-1} (x[t]-xbar)^2
 *
 * (this is the standard time-series convention:
 * numerator uses n - k summands but the denominator
 * uses all n summands of the centred squared sum;
 * Box, Jenkins & Reinsel 1994 sec. 2.1.4). Define the
 * LJUNG-BOX PORTMANTEAU Q-STATISTIC
 *
 *     Q_LB(H) = n (n + 2) sum_{k=1..H} r_k^2 / (n - k)
 *
 * (Ljung & Box 1978, Biometrika 65(2):297-303).
 *
 * Under the iid white-noise null with finite fourth
 * moment, Q_LB(H) is asymptotically Chi-Square with H
 * degrees of freedom. The standardised score
 *
 *     lbZ = (Q_LB(H) - H) / sqrt(2 H)
 *
 * is approximately N(0, 1) for H >= 10 (the Wilson-
 * Hilferty-style normal approximation to Chi-Square
 * with H df has mean H and variance 2 H).
 * lbZ much greater than +1.96 indicates significant
 * portmanteau evidence of serial correlation across
 * lags 1..H (heavy clumping at SOME subset of those
 * lags); lbZ approx 0 indicates white-noise-consistent
 * behaviour over the entire lag spectrum 1..H.
 *
 * This is a TWO-SIDED diagnostic for *any* form of
 * non-trivial serial structure across multiple lags
 * simultaneously -- positive trend, anti-persistence,
 * weekly seasonality, and longer-range periodicity
 * all contribute. The test is BLIND TO THE FORM and
 * SIGN of the dependence (because squared
 * autocorrelations enter); pair with directional
 * single-lag axes (107 Spearman lag-1, 108 Kendall
 * lag-1, 113 Mood diff-sign) to disambiguate.
 *
 * DEFAULT H = 10 (the canonical Box-Jenkins value;
 * Tsay 2010 "Analysis of Financial Time Series" 3rd
 * ed. sec. 2.4 recommends H = 10 for non-seasonal
 * daily series; we cap at min(10, floor(n/4)) at the
 * primitive level so very short tenures do not
 * over-fit). The cap follows the conservative
 * Hyndman & Athanasopoulos 2018 "Forecasting:
 * Principles and Practice" 2nd ed. sec. 3.3
 * recommendation H = min(10, T/5) for non-seasonal,
 * tightened to T/4 here to maintain consistency
 * with the 14-day default min-tenure.
 *
 * MODIFICATION OVER BOX-PIERCE 1970. The original
 * Box-Pierce Q-statistic is Q_BP = n sum r_k^2; the
 * Ljung-Box modification weights each squared
 * autocorrelation by (n + 2) / (n - k), which
 * substantially improves the chi-square approximation
 * for moderate n. Both are reported in the literature;
 * we use the Ljung-Box form exclusively as it is the
 * modern default in R (Box.test type "Ljung-Box"),
 * statsmodels (acorr_ljungbox), and MATLAB (lbqtest).
 *
 * (Ljung, G. M. and Box, G. E. P., "On a measure of
 *  lack of fit in time series models", Biometrika 65
 *  (1978), pp. 297-303; Box, G. E. P. and Pierce, D.
 *  A., "Distribution of residual autocorrelations in
 *  autoregressive-integrated moving average time
 *  series models", JASA 65 (1970), pp. 1509-1526;
 *  Tsay, R. S., "Analysis of Financial Time Series",
 *  3rd ed., Wiley, 2010, sec. 2.4; Hyndman, R. J.
 *  and Athanasopoulos, G., "Forecasting: Principles
 *  and Practice", 2nd ed., OTexts, 2018, sec. 3.3.)
 *
 * Reported alongside `lbQ`: the effective lag count
 * `lbH` (after the floor(n/4) cap), the chi-square
 * degrees of freedom `lbDf` (= lbH), the standardised
 * score `lbZ`, and the per-lag autocorrelations
 * `lbAcf` (a length-lbH array of r_k values for
 * k = 1..lbH).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-113:
 *
 *   - Class. PORTMANTEAU-RANDOMNESS-TEST (multi-lag
 *     squared-autocorrelation chi-square statistic),
 *     specifically the weighted sum of squared
 *     autocorrelations across lags 1..H with a
 *     Chi-Square(H) null. PORTMANTEAU = sum-over-many-
 *     lags; this is the defining property that makes
 *     Ljung-Box orthogonal to every single-lag test
 *     in the prior axis set.
 *
 *   - vs axis-113 daily-token-difference-sign-test
 *     (Mood). Mood is a SINGLE-LAG (k=1) BINARY
 *     SIGN-COUNT statistic on first differences with
 *     a Binomial(n-1, 1/2) null. Ljung-Box is a
 *     MULTI-LAG (k=1..H) SQUARED-AUTOCORRELATION
 *     statistic on the centred series with a
 *     Chi-Square(H) null. Sample space differs (n-1
 *     diff signs vs H squared autocorrelations);
 *     functional differs (binary sign count vs
 *     squared correlation sum); null differs
 *     (Binomial vs Chi-Square); detection target
 *     differs (directional drift at lag 1 vs ANY
 *     serial structure across H lags).
 *
 *   - vs axis-112 daily-token-bartels-rank-von-neumann.
 *     Bartels is a SINGLE-LAG (k=1) SQUARED-RANK-
 *     ADJACENT-DIFFERENCE statistic with a closed-
 *     form Gaussian null. Ljung-Box is a MULTI-LAG
 *     (k=1..H) SQUARED-AUTOCORRELATION statistic on
 *     the RAW centred values with a Chi-Square null.
 *     A series with strong lag-7 weekly seasonality
 *     but no lag-1 persistence has Bartels RVN
 *     approx 2 (lag-1 random) but Ljung-Box Q(10)
 *     much greater than 10 (the lag-7 contribution
 *     dominates the sum). Conversely, a series with
 *     strong lag-1 persistence but no longer-lag
 *     structure has Bartels RVN much less than 2 AND
 *     Ljung-Box Q(10) elevated, but Ljung-Box reveals
 *     the SPECIFIC LAG via the per-lag lbAcf array.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test.
 *     Cox-Stuart is a HALF-SHIFT BINOMIAL SIGN-TEST
 *     on floor(n/2) paired comparisons at LAG
 *     floor(n/2) -- a SINGLE-LAG TREND test at the
 *     half-shift lag. Ljung-Box is a MULTI-LAG
 *     PORTMANTEAU test. Sample space differs by a
 *     full order of magnitude.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. Mann-
 *     Kendall is a GLOBAL ALL-PAIRS sign-of-difference
 *     statistic over n*(n-1)/2 pairs, sensitive to
 *     monotonic trend across the whole sweep. Ljung-
 *     Box is a SUM OF SQUARED AUTOCORRELATIONS at H
 *     SPECIFIC LAGS, sensitive to serial structure at
 *     those lags. A series with a slow linear trend
 *     has tau_MK = +1 AND Ljung-Box Q elevated (the
 *     trend manifests as a long-tailed acf), but
 *     they detect by different statistics; a series
 *     with a strong lag-7 seasonality but no
 *     monotonic trend has tau_MK approx 0 AND
 *     Ljung-Box Q very large.
 *
 *   - vs axis-109 daily-token-upper-records-count.
 *     Upper-records counts STRICT NEW MAXIMA. Ljung-
 *     Box sums squared autocorrelations. Unrelated.
 *
 *   - vs axis-108 / 107 (kendall-tau / spearman lag-1
 *     rank autocorrelation). Both axes 107 and 108
 *     are SINGLE-LAG (k=1) RANK CORRELATIONS. Ljung-
 *     Box is a MULTI-LAG (k=1..H) PEARSON
 *     AUTOCORRELATION-SQUARED summed statistic.
 *     For a series with rho_S(1) much greater than 0
 *     but acf decaying fast, Ljung-Box Q is dominated
 *     by the single lag-1 term and the result agrees
 *     with axes 107/108 in DIRECTION-OF-EVIDENCE
 *     (both reject iid). For a series with weak
 *     rho_S(1) but strong rho(7), axes 107/108
 *     report nothing while Ljung-Box Q(10) clearly
 *     rejects iid -- demonstrating the portmanteau
 *     advantage.
 *
 *   - vs the existing daily-token-autocorrelation-lag1
 *     and -lag7 axes (single-lag Pearson autocorr at
 *     fixed lags). Those report the *raw* r_1 and
 *     r_7 values without a calibrated null. Ljung-
 *     Box delivers a CALIBRATED p-value over the
 *     SUM of the lag-1..lag-H squared autocorrs.
 *     The two are complementary: lag-k axes give the
 *     SHAPE of the acf; Ljung-Box gives a PORTMANTEAU
 *     test that the acf is jointly distinguishable
 *     from white noise.
 *
 *   - vs axes 105 / 106 (zero-crossing-rate /
 *     turning-point-rate). LOCAL counting statistics
 *     on consecutive sign-changes. Ljung-Box is a
 *     PORTMANTEAU multi-lag squared-autocorrelation
 *     statistic.
 *
 *   - vs axes 103 / 104 (second-diff-sign-runs /
 *     monotone-run-length). Different primitives
 *     entirely (curvature-sign run count and
 *     longest-monotone-run length).
 *
 *   - vs the inequality / shape axes (Gini, Atkinson,
 *     Theil, ..). PERMUTATION-INVARIANT functionals
 *     of the empirical distribution. Ljung-Box
 *     depends entirely on the TEMPORAL ORDER of
 *     values; a uniformly random permutation has
 *     E[lbQ] = H regardless of value distribution.
 *
 *   - vs the spectral axes (84-104). Spectral axes
 *     transform to the FREQUENCY domain via the FFT
 *     and summarise the periodogram (entropy,
 *     centroid, rolloff, flatness, etc.). Ljung-Box
 *     stays in the TIME domain and summarises the
 *     SAMPLE AUTOCORRELATION FUNCTION (the Fourier
 *     transform pair of the periodogram, by the
 *     Wiener-Khinchin theorem). They contain
 *     equivalent INFORMATION in the limit n -> inf
 *     but the FINITE-SAMPLE statistics, the nulls,
 *     and the sensitivity profiles all differ
 *     fundamentally. Ljung-Box has a closed-form
 *     Chi-Square null at finite H; spectral entropy
 *     etc. require permutation tests for calibration.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes.
 *     Those are scaling exponents fit across multiple
 *     window sizes. Ljung-Box is a single chi-square
 *     test statistic at a single fixed H. Hurst-type
 *     axes detect long-memory power-law decay of the
 *     acf; Ljung-Box detects ANY non-zero acf at
 *     lags 1..H but is most sensitive to short-range
 *     structure (the lag-k contribution decays as
 *     1 / (n - k), so small lags dominate Q_LB).
 *
 * Headline question:
 * **"For each source, when we compute the sample
 *   autocorrelation at lags 1..H on the gap-filled
 *   daily token series, does the joint magnitude
 *   sum n(n+2) sum r_k^2 / (n-k) exceed what would be
 *   expected under an iid white-noise null
 *   (Chi-Square(H) right-tail)?"**
 *
 * Reference:
 *   Ljung, G. M. and Box, G. E. P., "On a measure of
 *     lack of fit in time series models", Biometrika
 *     65 (1978), pp. 297-303.
 *   Box, G. E. P. and Pierce, D. A., "Distribution of
 *     residual autocorrelations in autoregressive-
 *     integrated moving average time series models",
 *     JASA 65 (1970), pp. 1509-1526.
 *   Box, G. E. P., Jenkins, G. M. and Reinsel, G. C.,
 *     "Time Series Analysis: Forecasting and Control",
 *     3rd ed., Prentice-Hall, 1994, sec. 2.1 / 8.2.
 *   Tsay, R. S., "Analysis of Financial Time Series",
 *     3rd ed., Wiley, 2010, sec. 2.4.
 *   Hyndman, R. J. and Athanasopoulos, G., "Fore-
 *     casting: Principles and Practice", 2nd ed.,
 *     OTexts, 2018, sec. 3.3.
 *
 * Caveats:
 *
 *   - lbQ in [0, +inf). lbQ approx H = white-noise-
 *     consistent; lbQ much greater than H = serial
 *     structure detected.
 *   - lbZ approx N(0, 1) is the (Q - H)/sqrt(2H)
 *     normalisation of Chi-Square(H). For more
 *     accurate p-values at moderate H use the exact
 *     Chi-Square(H) right-tail; the standardised
 *     score is reported here for compositional
 *     consistency with the other randomness-test
 *     axes (108-113), all of which surface a
 *     z-score.
 *   - Effective lag count lbH = min(10, floor(n/4)).
 *     This caps the test at H = 10 (canonical
 *     Box-Jenkins) but tightens to floor(n/4) for
 *     short tenures so that the n - k denominator
 *     in the Ljung-Box weighting remains positive
 *     and well-conditioned.
 *   - Biased acf denominator. Per Box-Jenkins-Reinsel
 *     1994 sec. 2.1.4 we use the BIASED estimator
 *     r_k = (sum (x_t - xbar)(x_{t+k} - xbar)) /
 *     (sum (x_t - xbar)^2) -- the same denominator
 *     for all k. The unbiased variant (per-k
 *     denominator using n - k summands) is NOT
 *     standard for portmanteau tests and is
 *     intentionally omitted.
 *   - Test is BLIND TO THE SIGN of the
 *     autocorrelations (squared values enter the
 *     sum). For directional information consult
 *     the lbAcf array directly or pair with axis-
 *     113 Mood (lag-1 directional trend).
 *   - Test is BLIND TO THE SPECIFIC LAG that drives
 *     significance -- a series with rho(1) = 0.5
 *     and rho(2..10) = 0 yields the same Q as a
 *     series with rho(7) = 0.5 and rho(others) = 0
 *     (modulo the (n-k) weighting). Inspect lbAcf
 *     to identify which lag dominates.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14, lags=10):
 *   pew-insights daily-token-ljung-box-q-test
 *
 *   # JSON for downstream tooling, restricted to one source:
 *   pew-insights daily-token-ljung-box-q-test \
 *     --source vscode-other --json
 *
 *   # Sort by absolute z-score descending (strongest
 *   # serial-structure evidence first):
 *   pew-insights daily-token-ljung-box-q-test \
 *     --sort lbZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenLjungBoxQTestSort =
  | 'q'
  | 'qDesc'
  | 'lbZ'
  | 'lbZDesc'
  | 'lbZAbs'
  | 'lbZAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenLjungBoxQTestOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 4.
   */
  minTenureDays?: number;
  /**
   * Maximum lag H for the portmanteau sum. Effective
   * H is min(maxLag, floor(n/4)) per Box-Jenkins.
   * Default 10.
   */
  maxLag?: number;
  top?: number;
  sort?: DailyTokenLjungBoxQTestSort;
  generatedAt?: string;
}

export interface DailyTokenLjungBoxQTestSourceRow {
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
  /** Effective lag count after the min(maxLag, floor(n/4)) cap. */
  lbH: number;
  /** Chi-square degrees of freedom (= lbH). */
  lbDf: number;
  /** Per-lag biased sample autocorrelations r_1..r_lbH. */
  lbAcf: number[];
  /** Ljung-Box portmanteau Q statistic. */
  lbQ: number;
  /** Standardised score (Q - H) / sqrt(2 H). */
  lbZ: number;
}

export interface DailyTokenLjungBoxQTestReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  maxLag: number;
  top: number;
  sort: DailyTokenLjungBoxQTestSort;
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
  sources: DailyTokenLjungBoxQTestSourceRow[];
}

/**
 * Ljung-Box portmanteau Q-test for serial correlation
 * on a real-valued series at lags 1..H where
 * H = min(maxLag, floor(n/4)).
 *
 * Closed-form sanity anchors:
 *   - constant series filtered upstream by zero-
 *     variance guard (centred squared sum = 0).
 *   - strictly monotone increasing series x = (1, 2,
 *     .., n) -> r_k > 0 for all k (smoothly decaying
 *     positive acf), Q much greater than H,
 *     lbZ much greater than 0.
 *   - perfectly alternating series 1, 2, 1, 2, .. ->
 *     r_1 = -1 + O(1/n); r_2 approx +1; r_k oscillates
 *     in sign with period 2; squared values all close
 *     to 1, Q approx n*(n+2)*H, lbZ much greater than 0.
 *   - i.i.d. continuous sample -> r_k approx 0 for
 *     k > 0, Q approx H, lbZ approx 0.
 *
 * Throws when the series is too short, contains non-
 * finite entries, or has zero centred variance.
 */
export function dailyTokenLjungBoxQTest(
  values: number[],
  maxLag = 10,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  lbH: number;
  lbDf: number;
  lbAcf: number[];
  lbQ: number;
  lbZ: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenLjungBoxQTest: need at least 4 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(maxLag) || maxLag < 1) {
    throw new Error(
      `dailyTokenLjungBoxQTest: maxLag must be a positive integer (got ${maxLag})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenLjungBoxQTest requires finite values',
      );
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;

  // Pre-centre once.
  const centred: number[] = new Array(n);
  let denom = 0;
  for (let i = 0; i < n; i += 1) {
    const c = values[i]! - mu;
    centred[i] = c;
    denom += c * c;
  }
  const stddev = Math.sqrt(denom / n);
  if (denom === 0) {
    throw new Error(
      `dailyTokenLjungBoxQTest: zero centred variance (n=${n})`,
    );
  }

  // Effective H = min(maxLag, floor(n/4)). The
  // floor(n/4) cap is the conservative Hyndman-Atha-
  // nasopoulos 2018 sec. 3.3 upper bound (T/5
  // recommended; tightened here for the 14-day floor).
  const lbH = Math.max(1, Math.min(maxLag, Math.floor(n / 4)));
  if (lbH < 1) {
    throw new Error(
      `dailyTokenLjungBoxQTest: effective H is non-positive (n=${n})`,
    );
  }

  // Biased sample autocorrelations and Ljung-Box sum.
  const lbAcf: number[] = new Array(lbH);
  let weighted = 0;
  for (let k = 1; k <= lbH; k += 1) {
    let num = 0;
    for (let t = 0; t < n - k; t += 1) {
      num += centred[t]! * centred[t + k]!;
    }
    const rk = num / denom;
    lbAcf[k - 1] = rk;
    // (n + 2) / (n - k) weighting; n - k > 0 because
    // lbH <= floor(n/4) <= n - 1.
    weighted += (rk * rk) / (n - k);
  }
  const lbQ = n * (n + 2) * weighted;
  const lbDf = lbH;
  const lbZ = (lbQ - lbDf) / Math.sqrt(2 * lbDf);

  if (!Number.isFinite(lbQ) || !Number.isFinite(lbZ)) {
    throw new Error(
      `dailyTokenLjungBoxQTest: non-finite Q or Z (n=${n}, H=${lbH})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    lbH,
    lbDf,
    lbAcf,
    lbQ,
    lbZ,
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

export function buildDailyTokenLjungBoxQTest(
  queue: QueueLine[],
  opts: DailyTokenLjungBoxQTestOptions = {},
): DailyTokenLjungBoxQTestReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 4) {
    throw new Error(
      `minTenureDays must be an integer >= 4 (got ${opts.minTenureDays})`,
    );
  }
  const maxLag = opts.maxLag ?? 10;
  if (!Number.isInteger(maxLag) || maxLag < 1) {
    throw new Error(`maxLag must be a positive integer (got ${opts.maxLag})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenLjungBoxQTestSort = opts.sort ?? 'lbZAbsDesc';
  const validSorts: DailyTokenLjungBoxQTestSort[] = [
    'q',
    'qDesc',
    'lbZ',
    'lbZDesc',
    'lbZAbs',
    'lbZAbsDesc',
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
  const rows: DailyTokenLjungBoxQTestSourceRow[] = [];

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
      result = dailyTokenLjungBoxQTest(filled, maxLag);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenLjungBoxQTestSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mean: result.mean,
      stddev: result.stddev,
      lbH: result.lbH,
      lbDf: result.lbDf,
      lbAcf: result.lbAcf,
      lbQ: result.lbQ,
      lbZ: result.lbZ,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'q':
        primary = a.lbQ - b.lbQ;
        break;
      case 'qDesc':
        primary = b.lbQ - a.lbQ;
        break;
      case 'lbZ':
        primary = a.lbZ - b.lbZ;
        break;
      case 'lbZDesc':
        primary = b.lbZ - a.lbZ;
        break;
      case 'lbZAbs':
        primary = Math.abs(a.lbZ) - Math.abs(b.lbZ);
        break;
      case 'lbZAbsDesc':
        primary = Math.abs(b.lbZ) - Math.abs(a.lbZ);
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
    maxLag,
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
