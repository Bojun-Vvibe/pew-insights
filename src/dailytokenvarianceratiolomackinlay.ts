/**
 * daily-token-variance-ratio-lomackinlay: per-source
 * LO-MACKINLAY VARIANCE-RATIO TEST for the random-walk
 * null on the gap-filled daily total_tokens series.
 *
 * ONE-HUNDRED-AND-FIFTY-EIGHTH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). Form first differences
 *
 *     d[t] = x[t] - x[t-1]      t = 1, .., n - 1
 *
 * (so there are nDiff = n - 1 single-step increments).
 * For a non-overlapping aggregation horizon q the
 * q-period variance-ratio is
 *
 *     VR(q) = Var(x[t] - x[t-q]) / (q * Var(x[t] - x[t-1]))
 *
 * Under the iid random-walk null (RW1) Var(x[t]-x[t-q])
 * = q * Var(d) so VR(q) = 1 for all q. Under positive
 * serial correlation in d (mean-reverting deviations
 * compounded in the level) VR(q) > 1; under negative
 * serial correlation (anti-persistent compounding) VR(q)
 * < 1. (Lo & MacKinlay 1988 RFS 1(1):41-66.)
 *
 * The HOMOSKEDASTIC asymptotic variance of VR(q) under
 * RW1 (Lo-MacKinlay eq. 9) is
 *
 *     Var_iid[VR(q)] = (2 (2 q - 1) (q - 1)) / (3 q m)
 *
 * where m = nDiff is the number of one-step differences
 * (we use the OVERLAPPING formulation with the (nDiff)
 * normalizer per the canonical Campbell-Lo-MacKinlay
 * 1997 sec. 2.4 implementation; for non-overlapping the
 * effective sample is m = floor(nDiff / q), which
 * discards information). The standardised statistic is
 *
 *     vrZ_iid = (VR(q) - 1) / sqrt(Var_iid[VR(q)])
 *
 * approximately N(0, 1) under RW1.
 *
 * The HETEROSKEDASTICITY-CONSISTENT variance (Lo &
 * MacKinlay 1988 eq. 12) replaces the iid term with
 *
 *     Var_hc[VR(q)] = sum_{j=1..q-1} (2 (q - j) / q)^2 * delta(j)
 *
 * where
 *
 *     delta(j) = sum_{t=j+1..m}
 *                  (d[t] - mu)^2 (d[t-j] - mu)^2
 *                / ( sum_{t=1..m} (d[t] - mu)^2 )^2
 *
 * is the heteroskedasticity-consistent estimate of the
 * j-th squared-residual autocovariance. The robust
 * standardised statistic
 *
 *     vrZ_hc = (VR(q) - 1) / sqrt(Var_hc[VR(q)])
 *
 * is also approximately N(0, 1) but is robust to
 * conditional-heteroskedasticity-consistent (CHC) DGPs
 * such as ARCH(p), GARCH(p,q), and stochastic-volatility
 * processes -- the iid statistic over-rejects under
 * volatility clustering, while vrZ_hc maintains
 * correct size.
 *
 * vrZ_iid (or vrZ_hc) much greater than +1.96 indicates
 * positive level-serial-correlation (mean-reverting
 * compounding -- the level wanders less than a pure
 * random walk would predict over q-day horizons);
 * vrZ much less than -1.96 indicates negative
 * level-serial-correlation (anti-persistence at the
 * level -- the level wanders MORE over q days than a
 * random walk would predict, e.g. after a one-day
 * spike there is a partial reversal). vrZ approx 0 is
 * RW1-consistent at the chosen horizon.
 *
 * DEFAULT q = 2 (the canonical Lo-MacKinlay smallest
 * non-trivial horizon; the q = 2 case has the highest
 * power against AR(1) departures and is the value
 * tabulated in Lo-MacKinlay 1988 Table 1). The CLI
 * exposes --q for arbitrary horizons subject to
 * 2 <= q <= floor(nDiff / 2) (so each q-period block
 * has at least 2 one-step increments backing it and the
 * delta(j) sums have positive support).
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A FUNDAMENTALLY
 * NEW PRIMITIVE NOT REDUCIBLE TO ANY OF THE PRIOR 157 AXES:
 *
 *   - Class. RANDOM-WALK NULL TEST via the variance
 *     scaling exponent. The variance-ratio is a
 *     SECOND-MOMENT SCALING test on the LEVEL series:
 *     for an iid random walk Var(x[t] - x[t-q]) is
 *     EXACTLY linear in q; departures from linearity
 *     are the test statistic. No prior axis tests
 *     this scaling property.
 *
 *   - vs axis-157 daily-token-adf-unit-root. ADF tests
 *     the AR(1) coefficient rho in dx[t] = alpha +
 *     rho * x[t-1] + ... via a t-ratio with a non-
 *     standard Dickey-Fuller null distribution.
 *     Variance-ratio tests the q-period variance-
 *     scaling of the LEVEL with a STANDARD Gaussian
 *     null on a closed-form variance estimator. Both
 *     can detect departures from the random walk but
 *     by entirely different statistics: ADF rejects
 *     when rho < 0 (mean reversion in the AR(1)
 *     sense); VR rejects when VR(q) != 1 (departure
 *     from linear variance scaling at horizon q).
 *     A series with weak AR(1) but strong
 *     longer-lag autocorrelation can have ADF tau
 *     close to 0 (insignificant) but VR(q) very
 *     different from 1 at q matching the dominant
 *     correlation horizon -- and vice versa.
 *
 *   - vs axis-156 daily-token-kpss-stationarity. KPSS
 *     tests stationarity around a constant via a
 *     functional-CLT integrand (sum of squared
 *     centred partial sums divided by Bartlett-HAC
 *     long-run variance) with H0 = stationary,
 *     H1 = unit root. VR has H0 = random walk (unit
 *     root with iid increments), H1 = serially-
 *     correlated increments. The hypotheses are
 *     COMPLEMENTARY: KPSS asks "is the level
 *     stationary?", VR asks "are the increments
 *     iid?". A pure unit-root with iid increments
 *     PASSES VR (vrZ approx 0) but FAILS KPSS
 *     (eta much greater than the critical value).
 *
 *   - vs axis-114 daily-token-ljung-box-q-test. LB
 *     tests the joint magnitude of squared
 *     AUTOCORRELATIONS of the LEVEL series at lags
 *     1..H via a Chi-Square(H) null. VR tests the
 *     VARIANCE-SCALING of the LEVEL DIFFERENCES at
 *     a single horizon q via a Gaussian null. The
 *     statistics are computed on different objects
 *     (centred level vs differences) and have
 *     different nulls (Chi-Square vs N(0, 1)).
 *
 *   - vs the daily-token-autocorrelation-lag1/lag7
 *     axes. Those are point estimates of Pearson
 *     autocorrelation at fixed lags on the LEVEL.
 *     VR is a closed-form scalar function of the
 *     INCREMENT autocorrelations weighted by the
 *     Lo-MacKinlay triangular kernel (1, 1 - 1/q,
 *     1 - 2/q, ..., 1/q). The relationship
 *     (Lo-MacKinlay eq. 7) is
 *         VR(q) = 1 + 2 sum_{k=1..q-1}
 *                       (1 - k/q) * rho_d(k)
 *     where rho_d is the increment autocorrelation.
 *     The variance-ratio is therefore a CALIBRATED
 *     PORTMANTEAU on the INCREMENTS with a closed-
 *     form Gaussian null, structurally distinct from
 *     the Ljung-Box portmanteau on the LEVELS.
 *
 *   - vs axis-110 daily-token-mann-kendall-tau. M-K
 *     is a global all-pairs sign-of-difference rank
 *     statistic for monotonic trend. VR is a
 *     second-moment variance-scaling test for
 *     random-walk increments. The statistics measure
 *     orthogonal departures: a pure linear trend
 *     gives M-K tau = +1 AND VR(q) > 1 (the trend
 *     induces positive increment autocorrelation),
 *     but a mean-reverting series with no monotonic
 *     trend gives M-K tau approx 0 AND VR(q) < 1.
 *
 *   - vs axis-111 daily-token-cox-stuart-trend-test
 *     and axis-113 daily-token-difference-sign-test.
 *     Both are SIGN-COUNT statistics on increments
 *     (Mood) or paired half-shift comparisons (Cox-
 *     Stuart) with Binomial nulls. VR is a SECOND-
 *     MOMENT variance-scaling statistic with a
 *     Gaussian null. Sample-space dimensions
 *     differ; functional differs; null differs.
 *
 *   - vs axis-153 cusum-max-deviation, axis-154
 *     pettitt-changepoint, axis-155 buishand-range.
 *     Those are CHANGEPOINT statistics on the
 *     LEVEL detecting a single break. VR is a
 *     SECOND-MOMENT SCALING statistic on the
 *     INCREMENTS detecting departure from
 *     iid-random-walk.
 *
 *   - vs the inequality / shape axes (Gini,
 *     Atkinson, Theil, ..). Those are
 *     PERMUTATION-INVARIANT functionals of the
 *     empirical distribution of values. VR depends
 *     entirely on the TEMPORAL ORDER (it is a
 *     function of the differenced series; reversing
 *     the differences flips signs but VR(q) is
 *     invariant to time-reversal of the level
 *     because Var(x[t] - x[t-q]) is symmetric in
 *     direction).
 *
 *   - vs the spectral axes. Spectral statistics
 *     summarise the periodogram in the FREQUENCY
 *     domain. VR stays in the TIME domain and
 *     summarises the variance-scaling exponent.
 *     They are Fourier-transform pairs of related
 *     information but the FINITE-SAMPLE statistics,
 *     the nulls, and the sensitivity profiles all
 *     differ.
 *
 *   - vs DFA / Hurst R/S / fractal-dimension axes.
 *     Hurst-R/S and DFA-alpha are scaling exponents
 *     fit ACROSS A RANGE of window sizes (multi-
 *     point regression on log-log axes). VR is a
 *     SINGLE-HORIZON closed-form statistic with a
 *     Gaussian null at a single fixed q. The
 *     Hurst exponent is asymptotically related to
 *     the variance ratio via H = 0.5 + 0.5 *
 *     log_2(VR(2)) for the q = 2 case under
 *     fractional-Brownian assumptions, but the
 *     calibration, sensitivity, and finite-sample
 *     null are completely different (Hurst R/S has
 *     no closed-form null and requires Monte
 *     Carlo for inference; VR has a closed-form
 *     Gaussian null).
 *
 * Headline question:
 * **"For each source, when we form q-period variance
 *   ratios on the gap-filled daily token series, does
 *   VR(q) deviate from 1 by more than the iid random-
 *   walk asymptotic standard error allows -- and is
 *   that deviation robust to volatility clustering
 *   (vrZ_hc) as well as iid (vrZ_iid)?"**
 *
 * Reference:
 *   Lo, A. W. and MacKinlay, A. C., "Stock market
 *     prices do not follow random walks: Evidence
 *     from a simple specification test", Review of
 *     Financial Studies 1(1) (1988), pp. 41-66.
 *   Campbell, J. Y., Lo, A. W. and MacKinlay, A. C.,
 *     "The Econometrics of Financial Markets",
 *     Princeton University Press, 1997, sec. 2.4.
 *   Liu, C. Y. and He, J., "A variance-ratio test of
 *     random walks in foreign exchange rates", J.
 *     Finance 46 (1991), pp. 773-785.
 *
 * Caveats:
 *
 *   - VR(q) in (0, +inf). VR approx 1 = random-walk-
 *     consistent; VR > 1 = positive level-serial-
 *     correlation (level wanders less than a pure
 *     RW); VR < 1 = negative level-serial-correlation
 *     (level wanders more than a pure RW).
 *   - vrZ_iid valid under iid increments; over-rejects
 *     when increments exhibit volatility clustering.
 *     vrZ_hc is the Lo-MacKinlay heteroskedasticity-
 *     consistent variant -- always report both.
 *   - The OVERLAPPING formulation with denominator
 *     m = nDiff is the canonical Campbell-Lo-
 *     MacKinlay 1997 sec. 2.4 implementation; the
 *     non-overlapping variant uses m = floor(nDiff/q)
 *     and discards (q - 1) / q of the data, with
 *     correspondingly higher variance.
 *   - q is capped at floor(nDiff / 2) so the delta(j)
 *     sums have at least floor(nDiff / 2) summands
 *     for the longest lag j = q - 1. For nDiff < 4
 *     no q satisfies 2 <= q <= floor(nDiff / 2),
 *     hence the hard min-tenure-days = 6 floor
 *     (n = 6 -> nDiff = 5 -> floor(5/2) = 2 -> q=2
 *     just admissible).
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 *     CLI usage examples:
 *
 *   # Default (min-tenure-days=14, q=2):
 *   pew-insights daily-token-variance-ratio-lo-mackinlay
 *
 *   # JSON for downstream tooling at q=5:
 *   pew-insights daily-token-variance-ratio-lo-mackinlay \
 *     --q 5 --json
 *
 *   # Sort by absolute heteroskedasticity-consistent
 *   # z-score descending (strongest robust evidence first):
 *   pew-insights daily-token-variance-ratio-lo-mackinlay \
 *     --sort vrZHcAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenVarianceRatioLoMacKinlaySort =
  | 'vr'
  | 'vrDesc'
  | 'vrZIid'
  | 'vrZIidDesc'
  | 'vrZIidAbs'
  | 'vrZIidAbsDesc'
  | 'vrZHc'
  | 'vrZHcDesc'
  | 'vrZHcAbs'
  | 'vrZHcAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenVarianceRatioLoMacKinlayOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /**
   * Minimum gap-filled tenure in days. Hard floor 6
   * (nDiff = 5, floor(5/2) = 2 -> q = 2 just
   * admissible).
   */
  minTenureDays?: number;
  /**
   * Aggregation horizon q for the variance ratio
   * (default 2, canonical Lo-MacKinlay smallest
   * non-trivial horizon). Effective q is min(q,
   * floor(nDiff / 2)) per the delta(j)-sum support
   * requirement.
   */
  q?: number;
  top?: number;
  sort?: DailyTokenVarianceRatioLoMacKinlaySort;
  generatedAt?: string;
}

export interface DailyTokenVarianceRatioLoMacKinlaySourceRow {
  source: string;
  totalTokens: number;
  /** Days with strictly positive token mass. */
  nActiveDays: number;
  /** Gap-filled tenure length in calendar days. */
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Mean of the first-difference series d[t]. */
  diffMean: number;
  /** Population stddev of the first-difference series d[t]. */
  diffStddev: number;
  /** Number of one-step differences (= nTenureDays - 1). */
  nDiff: number;
  /** Effective q after the floor(nDiff/2) cap. */
  vrQ: number;
  /** Lo-MacKinlay variance ratio VR(q). */
  vr: number;
  /** Standardised score (VR-1)/sqrt(Var_iid). */
  vrZIid: number;
  /** Standardised score (VR-1)/sqrt(Var_hc). */
  vrZHc: number;
}

export interface DailyTokenVarianceRatioLoMacKinlayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  q: number;
  top: number;
  sort: DailyTokenVarianceRatioLoMacKinlaySort;
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
  sources: DailyTokenVarianceRatioLoMacKinlaySourceRow[];
}

/**
 * Lo-MacKinlay variance-ratio test on a real-valued
 * level series at horizon q where the effective q is
 * min(q, floor(nDiff / 2)) and nDiff = n - 1.
 *
 * EXACT IDENTITIES preserved by this implementation
 * (verified by the test suite):
 *
 *   - vr(x + c) === vr(x) for any constant c. The
 *     differencing step removes c.
 *   - vr(a * x) === vr(x) for any positive scalar a.
 *     Both numerator and denominator scale by a^2.
 *   - vr at q = 1 is identically 1 (trivial); we
 *     therefore require q >= 2.
 *   - vrZIid and vrZHc are 0 when VR == 1 exactly.
 *
 * Closed-form sanity anchors:
 *   - constant series -> filtered upstream by the
 *     zero-variance guard (Var(d) = 0).
 *   - strictly monotone increasing series x = (1, 2,
 *     .., n) -> all d[t] = 1, Var(d) = 0 -> filtered
 *     by zero-variance guard.
 *   - alternating series 1, 2, 1, 2, .. -> d[t]
 *     alternates +1, -1; Var(d) > 0; rho_d(1) = -1
 *     so VR(2) = 1 + 2 * (1/2) * (-1) = 0. Strong
 *     anti-persistence.
 *   - i.i.d. continuous sample for d -> VR(q) approx
 *     1, vrZ approx 0.
 *
 * Throws when the differenced series is too short,
 * contains non-finite entries, or has zero variance.
 */
export function dailyTokenVarianceRatioLoMacKinlay(
  values: number[],
  q = 2,
): {
  diffMean: number;
  diffStddev: number;
  nSamples: number;
  nDiff: number;
  vrQ: number;
  vr: number;
  vrZIid: number;
  vrZHc: number;
} {
  const n = values.length;
  if (n < 6) {
    throw new Error(
      `dailyTokenVarianceRatioLoMacKinlay: need at least 6 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(q) || q < 2) {
    throw new Error(
      `dailyTokenVarianceRatioLoMacKinlay: q must be an integer >= 2 (got ${q})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error(
        'dailyTokenVarianceRatioLoMacKinlay requires finite values',
      );
    }
  }

  const nDiff = n - 1;
  const d: number[] = new Array(nDiff);
  for (let t = 0; t < nDiff; t += 1) {
    d[t] = values[t + 1]! - values[t]!;
  }

  // Cap effective q at floor(nDiff / 2) so the
  // longest delta(j) sum (j = q - 1) has at least
  // floor(nDiff / 2) summands.
  const vrQ = Math.max(2, Math.min(q, Math.floor(nDiff / 2)));
  if (vrQ < 2) {
    throw new Error(
      `dailyTokenVarianceRatioLoMacKinlay: effective q < 2 (n=${n})`,
    );
  }

  // Mean and centred-squared-sum of the increments.
  let mu = 0;
  for (const val of d) mu += val;
  mu /= nDiff;

  let s1 = 0;
  const dCent: number[] = new Array(nDiff);
  for (let t = 0; t < nDiff; t += 1) {
    const c = d[t]! - mu;
    dCent[t] = c;
    s1 += c * c;
  }
  if (s1 === 0) {
    throw new Error(
      `dailyTokenVarianceRatioLoMacKinlay: zero centred variance in differences (n=${n})`,
    );
  }
  const sigma1Sq = s1 / nDiff; // population variance of d
  const diffStddev = Math.sqrt(sigma1Sq);

  // Numerator: Var(x[t] - x[t-q]) = (1 / (nDiff - q + 1))
  // sum_{t=q..nDiff} (sum_{j=t-q+1..t} d[j] - q*mu)^2.
  // Use a rolling sum for efficiency.
  let rolling = 0;
  for (let j = 0; j < vrQ; j += 1) rolling += dCent[j]!;
  let sQ = rolling * rolling;
  let m = 1;
  for (let t = vrQ; t < nDiff; t += 1) {
    rolling += dCent[t]! - dCent[t - vrQ]!;
    sQ += rolling * rolling;
    m += 1;
  }
  // sQ is now sum over m = nDiff - vrQ + 1 windows.
  const sigmaQSq = sQ / (nDiff * vrQ); // canonical Lo-MacKinlay overlapping normalizer
  const vr = sigmaQSq / sigma1Sq;

  // Asymptotic iid variance (Lo-MacKinlay eq. 9).
  const varIid = (2 * (2 * vrQ - 1) * (vrQ - 1)) / (3 * vrQ * nDiff);
  const vrZIid = varIid > 0 ? (vr - 1) / Math.sqrt(varIid) : 0;

  // Heteroskedasticity-consistent variance
  // (Lo-MacKinlay eq. 12). delta(j) =
  // sum_{t=j+1..nDiff} dCent[t]^2 dCent[t-j]^2
  // / ( sum_{t=1..nDiff} dCent[t]^2 )^2.
  const denomSq = s1 * s1;
  let varHc = 0;
  for (let j = 1; j < vrQ; j += 1) {
    let num = 0;
    for (let t = j; t < nDiff; t += 1) {
      const a = dCent[t]!;
      const b = dCent[t - j]!;
      num += a * a * b * b;
    }
    const deltaJ = num / denomSq;
    const w = (2 * (vrQ - j)) / vrQ;
    varHc += w * w * deltaJ;
  }
  const vrZHc = varHc > 0 ? (vr - 1) / Math.sqrt(varHc) : 0;

  if (
    !Number.isFinite(vr) ||
    !Number.isFinite(vrZIid) ||
    !Number.isFinite(vrZHc)
  ) {
    throw new Error(
      `dailyTokenVarianceRatioLoMacKinlay: non-finite statistic (n=${n}, q=${vrQ})`,
    );
  }

  return {
    diffMean: mu,
    diffStddev,
    nSamples: n,
    nDiff,
    vrQ,
    vr,
    vrZIid,
    vrZHc,
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

export function buildDailyTokenVarianceRatioLoMacKinlay(
  queue: QueueLine[],
  opts: DailyTokenVarianceRatioLoMacKinlayOptions = {},
): DailyTokenVarianceRatioLoMacKinlayReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 14;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 6) {
    throw new Error(
      `minTenureDays must be an integer >= 6 (got ${opts.minTenureDays})`,
    );
  }
  const q = opts.q ?? 2;
  if (!Number.isInteger(q) || q < 2) {
    throw new Error(`q must be an integer >= 2 (got ${opts.q})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenVarianceRatioLoMacKinlaySort =
    opts.sort ?? 'vrZHcAbsDesc';
  const validSorts: DailyTokenVarianceRatioLoMacKinlaySort[] = [
    'vr',
    'vrDesc',
    'vrZIid',
    'vrZIidDesc',
    'vrZIidAbs',
    'vrZIidAbsDesc',
    'vrZHc',
    'vrZHcDesc',
    'vrZHcAbs',
    'vrZHcAbsDesc',
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

  for (const qline of queue) {
    const ms = Date.parse(qline.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const tt = Number(qline.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof qline.source === 'string' && qline.source !== ''
        ? qline.source
        : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const day = qline.hour_start.slice(0, 10);
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
  const rows: DailyTokenVarianceRatioLoMacKinlaySourceRow[] = [];

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
      result = dailyTokenVarianceRatioLoMacKinlay(filled, q);
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    const row: DailyTokenVarianceRatioLoMacKinlaySourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      diffMean: result.diffMean,
      diffStddev: result.diffStddev,
      nDiff: result.nDiff,
      vrQ: result.vrQ,
      vr: result.vr,
      vrZIid: result.vrZIid,
      vrZHc: result.vrZHc,
    };
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'vr':
        primary = a.vr - b.vr;
        break;
      case 'vrDesc':
        primary = b.vr - a.vr;
        break;
      case 'vrZIid':
        primary = a.vrZIid - b.vrZIid;
        break;
      case 'vrZIidDesc':
        primary = b.vrZIid - a.vrZIid;
        break;
      case 'vrZIidAbs':
        primary = Math.abs(a.vrZIid) - Math.abs(b.vrZIid);
        break;
      case 'vrZIidAbsDesc':
        primary = Math.abs(b.vrZIid) - Math.abs(a.vrZIid);
        break;
      case 'vrZHc':
        primary = a.vrZHc - b.vrZHc;
        break;
      case 'vrZHcDesc':
        primary = b.vrZHc - a.vrZHc;
        break;
      case 'vrZHcAbs':
        primary = Math.abs(a.vrZHc) - Math.abs(b.vrZHc);
        break;
      case 'vrZHcAbsDesc':
        primary = Math.abs(b.vrZHc) - Math.abs(a.vrZHc);
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
    q,
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
