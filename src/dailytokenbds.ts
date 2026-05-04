/**
 * daily-token-bds: per-source BROCK-DECHERT-SCHEINKMAN
 * (BDS) NONLINEAR-DEPENDENCE TEST via the correlation
 * integral on m-dimensional embeddings of the gap-filled
 * daily total_tokens series.
 *
 * ONE-HUNDRED-AND-SIXTIETH cross-source axis.
 *
 * Definition. Let x[0..n-1] be the gap-filled daily
 * token series for one source over its tenure
 * (n = nTenureDays). For embedding dimension m >= 1
 * and tolerance epsilon > 0 form the m-history vectors
 *
 *     X_t^m = (x[t], x[t+1], ..., x[t+m-1])
 *
 * for t = 0..T_m-1 where T_m = n - m + 1. The
 * CORRELATION INTEGRAL at dimension m is
 *
 *     C(m, eps) = (2 / (T_m (T_m - 1)))
 *                 * sum_{i < j} I( ||X_i^m - X_j^m||_inf < eps )
 *
 * where ||.||_inf is the Chebyshev (component-wise max)
 * norm. Under the null that x is i.i.d. (independent
 * identically distributed) the m-history correlation
 * integral factorises:
 *
 *     C(m, eps) -> C(1, eps)^m   as T -> infinity.
 *
 * The BDS statistic is the standardised excess of the
 * empirical m-history correlation integral over the
 * factorisation predicted by the i.i.d. null:
 *
 *     V(m, eps) = sqrt(n) * (C(m, eps) - C(1, eps)^m)
 *                 / sigma(m, eps)
 *
 * with the Brock-Dechert-Scheinkman-LeBaron 1996
 * asymptotic standard error
 *
 *     sigma^2(m, eps) = 4 *
 *       [ K^m
 *         + 2 * sum_{j=1..m-1} K^{m-j} * c^{2j}
 *         + (m - 1)^2 * c^{2m}
 *         - m^2 * K * c^{2m - 2} ]
 *
 * where c = C(1, eps) and
 *
 *     K = (1 / T) * sum_{t=0..T-1} ( (1/T) * #{ s : |x[t] - x[s]| < eps } )^2
 *
 * is the "triple-match" correlation integral. Under
 * the i.i.d. null V(m, eps) is asymptotically N(0, 1).
 * |bdsZ| much greater than 1.96 indicates rejection
 * of the i.i.d. null at alpha = 0.05 -- there is
 * NONLINEAR or otherwise non-i.i.d. structure in the
 * m-history embedding that the simple linear (level)
 * autocorrelation cannot account for.
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS A NEW
 * PRIMITIVE NOT REDUCIBLE TO ANY OTHER DAILY-TOKEN
 * AXIS IN 79-159:
 *
 *   - vs axis-159 daily-token-mcleod-li (ARCH
 *     portmanteau on squared residuals). McLeod-Li is
 *     a SECOND-MOMENT TIME-DOMAIN PORTMANTEAU on
 *     squared centred residuals -- it is targeted at
 *     conditional-variance memory (ARCH/GARCH).
 *     BDS operates on the JOINT DISTRIBUTION of the
 *     m-history embedding via the Chebyshev-ball
 *     correlation integral. BDS detects nonlinear
 *     dependence of ALL ORDERS jointly (ARCH, chaos,
 *     threshold AR, bilinear, sign-of-residual
 *     persistence, regime-switching) without
 *     committing to the second-moment functional
 *     form. A pure-ARCH series gives both mlZ and
 *     bdsZ large; a deterministic chaotic series
 *     (e.g. logistic-map iterates) gives bdsZ much
 *     greater than 0 with mlZ approx 0 because the
 *     squared residuals can be uncorrelated while the
 *     joint embedding distribution remains far from
 *     the i.i.d. product. The two are complementary,
 *     not redundant.
 *
 *   - vs axis-114 daily-token-ljung-box-q-test
 *     (LEVEL portmanteau). Ljung-Box is a second-
 *     order LINEAR statistic -- it is blind to any
 *     dependence whose linear autocovariance happens
 *     to be zero (e.g. x[t] = z[t] * z[t-1] for
 *     i.i.d. z has lbZ approx 0 but bdsZ much greater
 *     than 0). BDS is constructed precisely to detect
 *     the dependence Ljung-Box misses.
 *
 *   - vs axis-158 Lo-MacKinlay variance-ratio. VR
 *     tests q-period LEVEL variance scaling against a
 *     martingale-difference null. BDS tests the much
 *     stronger i.i.d. null on the FULL JOINT embedding
 *     distribution. A martingale-difference series
 *     with nonlinear dependence (e.g. a GARCH whose
 *     conditional mean is zero) has vrZ approx 0 but
 *     bdsZ much greater than 0.
 *
 *   - vs axis-157 ADF and axis-156 KPSS unit-root /
 *     stationarity. Both target the level mean
 *     process under specific parametric alternatives
 *     (unit root, deterministic trend). BDS does
 *     not assume any parametric mean / variance
 *     structure -- it tests joint independence
 *     directly via the correlation integral.
 *
 *   - vs axes 153-155 (CUSUM, Pettitt, Buishand):
 *     these are level-mean changepoint statistics.
 *     BDS tests joint i.i.d. of the embedding,
 *     which is sensitive to but not specific to
 *     mean-shifts -- and notably is sensitive to
 *     dependence with NO mean shift at all.
 *
 *   - vs the spectral / fractal-dimension axes
 *     (Higuchi, Katz, Petrosian, Sevcik, box-count,
 *     DFA): all of those summarise self-affinity /
 *     scaling of the LEVEL series. BDS is a JOINT-
 *     DISTRIBUTION INDEPENDENCE TEST on m-history
 *     embeddings -- a categorically different probe.
 *
 *   - vs the entropy axes (sample entropy,
 *     approximate entropy, permutation entropy,
 *     Lempel-Ziv complexity): SampEn and ApEn are
 *     conditional-probability statistics on
 *     m-history matches and are themselves close
 *     relatives of the correlation integral.
 *     BDS is distinct in that it computes a
 *     STANDARDISED Z-SCORE of (C(m, eps) - C(1, eps)^m)
 *     against the closed-form BDS variance with a
 *     sharp asymptotic Gaussian null -- it is a
 *     hypothesis test, not a complexity index.
 *     SampEn at radius r summarises the conditional
 *     probability ratio C(m+1, r) / C(m, r) without
 *     a null distribution. The two quantities are
 *     mathematically related but operationally
 *     disjoint (SampEn -> a complexity scalar; BDS
 *     -> a p-value-style z-score against i.i.d.).
 *
 * Headline question:
 * **"For each source, after centring is the daily-
 *   token series statistically distinguishable from
 *   an i.i.d. sequence of any sort -- linear,
 *   nonlinear, second-moment, higher-moment, or
 *   chaotic?"**
 *
 * Reference:
 *   Brock, W. A., Dechert, W. D., Scheinkman, J. A.,
 *     and LeBaron, B., "A test for independence based
 *     on the correlation dimension", Econometric
 *     Reviews 15(3) (1996), pp. 197-235.
 *   Brock, W. A., Hsieh, D. A., and LeBaron, B.,
 *     "Nonlinear Dynamics, Chaos, and Instability:
 *     Statistical Theory and Economic Evidence",
 *     MIT Press, 1991.
 *   Kanzler, L., "Very Fast and Correctly Sized
 *     Estimation of the BDS Statistic",
 *     Christ Church / Oxford working paper, 1999.
 *
 * Caveats:
 *
 *   - BDS standard finite-sample guidance (Brock-
 *     Hsieh-LeBaron 1991): n >= 200 for reliable
 *     asymptotics, eps in [0.5*sigma, 1.5*sigma],
 *     m in {2, 3, 4, 5}. We default eps = 0.7 * sigma
 *     and m = 2. For shorter series (the 14-day
 *     min-tenure default) the asymptotic Gaussian
 *     approximation degrades and bdsZ should be read
 *     as a relative ranking statistic across sources
 *     rather than a sharp p-value.
 *   - The series is centred but NOT prewhitened. If
 *     the level has clear linear autocorrelation
 *     (e.g. weekly seasonality) BDS will detect it
 *     -- a positive bdsZ does NOT distinguish linear
 *     from nonlinear dependence. To target
 *     specifically nonlinear dependence the standard
 *     practice is to fit an ARMA model first and run
 *     BDS on the residuals. We deliberately do NOT
 *     prewhiten here so that the axis remains a
 *     pure permutation-sensitive joint-distribution
 *     probe; the user can compose with axis-110
 *     Mann-Kendall, axis-114 Ljung-Box, etc., to
 *     attribute the rejection to a specific
 *     functional form.
 *   - Numerical edge cases: zero series-variance is
 *     filtered upstream (mn === mx in the builder).
 *     A degenerate one-bin correlation integral
 *     (c = 1, all pairs within eps) has variance = 0
 *     and is reported as bdsZ = 0.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`.
 *
 * CLI usage examples:
 *
 *   # Default (min-tenure-days=14, m=2, eps-sigma=0.7):
 *   pew-insights daily-token-bds
 *
 *   # JSON for downstream tooling:
 *   pew-insights daily-token-bds --json
 *
 *   # Sort by absolute z-score descending:
 *   pew-insights daily-token-bds --sort bdsZAbsDesc
 */
import type { QueueLine } from './types.js';

export type DailyTokenBdsSort =
  | 'bdsV'
  | 'bdsVDesc'
  | 'bdsZ'
  | 'bdsZDesc'
  | 'bdsZAbs'
  | 'bdsZAbsDesc'
  | 'cM'
  | 'cMDesc'
  | 'cMOverC1Pow'
  | 'cMOverC1PowDesc'
  | 'cMOverC1PowLogAbs'
  | 'cMOverC1PowLogAbsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenBdsOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Minimum gap-filled tenure in days. Hard floor 4. */
  minTenureDays?: number;
  /** Embedding dimension m >= 2. Default 2. */
  embeddingDim?: number;
  /**
   * Tolerance epsilon as a multiple of the sample
   * standard deviation. Brock-Hsieh-LeBaron 1991
   * recommend the [0.5, 1.5] range. Default 0.7.
   */
  epsSigma?: number;
  top?: number;
  sort?: DailyTokenBdsSort;
  generatedAt?: string;
}

export interface DailyTokenBdsSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mean: number;
  stddev: number;
  /** Embedding dimension actually used. */
  bdsM: number;
  /** Tolerance epsilon actually applied (= epsSigma * stddev). */
  bdsEps: number;
  /** C(1, eps): one-history correlation integral. */
  c1: number;
  /** C(m, eps): m-history correlation integral. */
  cM: number;
  /** Triple-match correlation integral K. */
  bdsK: number;
  /**
   * Raw BDS statistic V(m, eps) = sqrt(n) *
   * (C(m, eps) - C(1, eps)^m) / sigma(m, eps).
   */
  bdsV: number;
  /**
   * Standardised score (alias of bdsV; kept distinct
   * for downstream code that reasons in z-score
   * vocabulary independent of statistic name).
   */
  bdsZ: number;
  /** sigma(m, eps) used to standardise. */
  bdsSigma: number;
  /**
   * Independence-deficit ratio C(m, eps) / C(1, eps)^m.
   * Equals 1 exactly under the iid factorisation null;
   * > 1 means the m-history embedding has EXCESS
   * coincidences (positive joint dependence); < 1 means
   * dispersal. Reads as a unit-free shape-descriptor of
   * the BDS deficit, complementing the n-scaled bdsV.
   * Defined as 0 when c1 = 0.
   */
  cMOverC1Pow: number;
  /**
   * log10(cMOverC1Pow) when defined and finite, else 0.
   * Symmetric around 0 (independence) on a scale where
   * factor-of-10 over-coincidence (= 1.0) and factor-of-10
   * dispersal (= -1.0) are equidistant from the iid null.
   * Used as a sort key to surface the largest DEPENDENCE
   * MAGNITUDE regardless of sign, decoupled from sample
   * size (unlike |bdsV| which scales with sqrt(n)).
   */
  cMOverC1PowLog10: number;
}

export interface DailyTokenBdsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  embeddingDim: number;
  epsSigma: number;
  top: number;
  sort: DailyTokenBdsSort;
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
  sources: DailyTokenBdsSourceRow[];
}

/**
 * BDS independence test on a real-valued series at
 * embedding dimension m and tolerance eps.
 *
 * EXACT IDENTITIES preserved (verified by tests):
 *
 *   - C(1, eps) is permutation-invariant.
 *     C(m, eps) for m >= 2 is NOT permutation-
 *     invariant: it depends on the temporal order.
 *     This is the core sensitivity of the test.
 *   - C(m, eps) -> C(1, eps)^m as the series
 *     approaches i.i.d.; the BDS statistic
 *     standardises this gap.
 *   - bdsV(x + c) === bdsV(x) for any constant c
 *     (translation invariance of pairwise
 *     differences).
 *   - bdsV(a * x) === bdsV(x) for any non-zero
 *     scalar a, provided eps is rescaled by the
 *     same |a| (we do this automatically because
 *     eps = epsSigma * stddev tracks the scale).
 *
 * Closed-form anchors:
 *   - constant series filtered upstream by zero-
 *     variance guard.
 *   - perfectly periodic series with period p < m
 *     embedded in m dimensions: m-history pairs
 *     coincide deterministically -> C(m, eps)
 *     much greater than C(1, eps)^m -> bdsV much
 *     greater than 0.
 *   - i.i.d. uniform draws -> C(m, eps) approx
 *     C(1, eps)^m -> bdsV approx 0 (subject to
 *     finite-sample fluctuations of order
 *     1 / sqrt(n)).
 *
 * Throws when too short, non-finite, embedding too
 * large for the sample, or non-finite variance.
 */
export function dailyTokenBds(
  values: number[],
  embeddingDim = 2,
  epsSigma = 0.7,
): {
  mean: number;
  stddev: number;
  nSamples: number;
  bdsM: number;
  bdsEps: number;
  c1: number;
  cM: number;
  bdsK: number;
  bdsV: number;
  bdsZ: number;
  bdsSigma: number;
} {
  const n = values.length;
  if (n < 4) {
    throw new Error(
      `dailyTokenBds: need at least 4 samples (got ${n})`,
    );
  }
  if (!Number.isInteger(embeddingDim) || embeddingDim < 2) {
    throw new Error(
      `dailyTokenBds: embeddingDim must be an integer >= 2 (got ${embeddingDim})`,
    );
  }
  if (!Number.isFinite(epsSigma) || epsSigma <= 0) {
    throw new Error(
      `dailyTokenBds: epsSigma must be a positive finite number (got ${epsSigma})`,
    );
  }
  if (embeddingDim > n - 1) {
    throw new Error(
      `dailyTokenBds: embeddingDim ${embeddingDim} exceeds n-1 (n=${n})`,
    );
  }
  for (const val of values) {
    if (!Number.isFinite(val)) {
      throw new Error('dailyTokenBds requires finite values');
    }
  }

  let mu = 0;
  for (const val of values) mu += val;
  mu /= n;
  let varSum = 0;
  for (const val of values) {
    const d = val - mu;
    varSum += d * d;
  }
  const stddev = Math.sqrt(varSum / n);
  if (stddev === 0) {
    throw new Error(`dailyTokenBds: zero variance (n=${n})`);
  }
  const eps = epsSigma * stddev;

  // h[i][j] = 1 iff |x[i] - x[j]| < eps. Symmetric,
  // h[i][i] = 1 (Brock-Hsieh-LeBaron treat the
  // diagonal as a match; we do the same so K below
  // matches the Kanzler 1999 convention exactly).
  // Storage: a single n*n Uint8Array. n up to a few
  // thousand here is fine; daily series are bounded.
  const h = new Uint8Array(n * n);
  for (let i = 0; i < n; i += 1) {
    h[i * n + i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const match = Math.abs(values[i]! - values[j]!) < eps ? 1 : 0;
      h[i * n + j] = match;
      h[j * n + i] = match;
    }
  }

  // C(1, eps) over UNORDERED pairs i < j.
  let c1Sum = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      c1Sum += h[i * n + j]!;
    }
  }
  const nPairs1 = (n * (n - 1)) / 2;
  const c1 = c1Sum / nPairs1;

  // K = (1/n) sum_t ( (1/n) sum_s h[t,s] )^2.
  // Equivalent to the Kanzler 1999 triple-match
  // probability under the i.i.d. null (E[h_ij h_jk]
  // for k != i).
  let kSum = 0;
  for (let t = 0; t < n; t += 1) {
    let row = 0;
    for (let s = 0; s < n; s += 1) row += h[t * n + s]!;
    const p = row / n;
    kSum += p * p;
  }
  const bdsK = kSum / n;

  // C(m, eps) over UNORDERED pairs of m-history
  // vectors (T_m = n - m + 1).
  const Tm = n - embeddingDim + 1;
  let cmSum = 0;
  for (let i = 0; i < Tm; i += 1) {
    outer: for (let j = i + 1; j < Tm; j += 1) {
      for (let d = 0; d < embeddingDim; d += 1) {
        if (h[(i + d) * n + (j + d)] === 0) continue outer;
      }
      cmSum += 1;
    }
  }
  const nPairsM = (Tm * (Tm - 1)) / 2;
  const cM = nPairsM > 0 ? cmSum / nPairsM : 0;

  // BDS asymptotic variance (Brock-Dechert-
  // Scheinkman-LeBaron 1996, eq. 2.16 simplified
  // form per Kanzler 1999):
  //   sigma^2 = 4 * [ K^m
  //                 + 2 * sum_{j=1..m-1} K^{m-j} c^{2j}
  //                 + (m-1)^2 c^{2m}
  //                 - m^2 K c^{2m-2} ]
  const m = embeddingDim;
  let sigSq = Math.pow(bdsK, m) + (m - 1) * (m - 1) * Math.pow(c1, 2 * m);
  sigSq -= m * m * bdsK * Math.pow(c1, 2 * m - 2);
  for (let j = 1; j <= m - 1; j += 1) {
    sigSq += 2 * Math.pow(bdsK, m - j) * Math.pow(c1, 2 * j);
  }
  sigSq *= 4;
  // Round-off can produce tiny negatives in the
  // perfectly-i.i.d. closed-form limit; clamp at 0.
  if (sigSq < 0) sigSq = 0;
  const bdsSigma = Math.sqrt(sigSq);

  let bdsV: number;
  if (bdsSigma === 0) {
    bdsV = 0;
  } else {
    bdsV = (Math.sqrt(n) * (cM - Math.pow(c1, m))) / bdsSigma;
  }

  if (!Number.isFinite(bdsV)) {
    throw new Error(
      `dailyTokenBds: non-finite V (n=${n}, m=${m}, eps=${eps})`,
    );
  }

  return {
    mean: mu,
    stddev,
    nSamples: n,
    bdsM: m,
    bdsEps: eps,
    c1,
    cM,
    bdsK,
    bdsV,
    bdsZ: bdsV,
    bdsSigma,
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

export function buildDailyTokenBds(
  queue: QueueLine[],
  opts: DailyTokenBdsOptions = {},
): DailyTokenBdsReport {
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
  const embeddingDim = opts.embeddingDim ?? 2;
  if (!Number.isInteger(embeddingDim) || embeddingDim < 2) {
    throw new Error(
      `embeddingDim must be an integer >= 2 (got ${opts.embeddingDim})`,
    );
  }
  const epsSigma = opts.epsSigma ?? 0.7;
  if (!Number.isFinite(epsSigma) || epsSigma <= 0) {
    throw new Error(
      `epsSigma must be a positive finite number (got ${opts.epsSigma})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenBdsSort = opts.sort ?? 'bdsZAbsDesc';
  const validSorts: DailyTokenBdsSort[] = [
    'bdsV',
    'bdsVDesc',
    'bdsZ',
    'bdsZDesc',
    'bdsZAbs',
    'bdsZAbsDesc',
    'cM',
    'cMDesc',
    'cMOverC1Pow',
    'cMOverC1PowDesc',
    'cMOverC1PowLogAbs',
    'cMOverC1PowLogAbsDesc',
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
  const rows: DailyTokenBdsSourceRow[] = [];

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
      result = dailyTokenBds(filled, embeddingDim, epsSigma);
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
      bdsM: result.bdsM,
      bdsEps: result.bdsEps,
      c1: result.c1,
      cM: result.cM,
      bdsK: result.bdsK,
      bdsV: result.bdsV,
      bdsZ: result.bdsZ,
      bdsSigma: result.bdsSigma,
      cMOverC1Pow: ((): number => {
        const denom = Math.pow(result.c1, result.bdsM);
        if (!Number.isFinite(denom) || denom === 0) return 0;
        return result.cM / denom;
      })(),
      cMOverC1PowLog10: ((): number => {
        const denom = Math.pow(result.c1, result.bdsM);
        if (!Number.isFinite(denom) || denom === 0) return 0;
        const ratio = result.cM / denom;
        if (!Number.isFinite(ratio) || ratio <= 0) return 0;
        return Math.log10(ratio);
      })(),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'bdsV':
        primary = a.bdsV - b.bdsV;
        break;
      case 'bdsVDesc':
        primary = b.bdsV - a.bdsV;
        break;
      case 'bdsZ':
        primary = a.bdsZ - b.bdsZ;
        break;
      case 'bdsZDesc':
        primary = b.bdsZ - a.bdsZ;
        break;
      case 'bdsZAbs':
        primary = Math.abs(a.bdsZ) - Math.abs(b.bdsZ);
        break;
      case 'bdsZAbsDesc':
        primary = Math.abs(b.bdsZ) - Math.abs(a.bdsZ);
        break;
      case 'cM':
        primary = a.cM - b.cM;
        break;
      case 'cMDesc':
        primary = b.cM - a.cM;
        break;
      case 'cMOverC1Pow':
        primary = a.cMOverC1Pow - b.cMOverC1Pow;
        break;
      case 'cMOverC1PowDesc':
        primary = b.cMOverC1Pow - a.cMOverC1Pow;
        break;
      case 'cMOverC1PowLogAbs':
        primary =
          Math.abs(a.cMOverC1PowLog10) - Math.abs(b.cMOverC1PowLog10);
        break;
      case 'cMOverC1PowLogAbsDesc':
        primary =
          Math.abs(b.cMOverC1PowLog10) - Math.abs(a.cMOverC1PowLog10);
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
    embeddingDim,
    epsSigma,
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
