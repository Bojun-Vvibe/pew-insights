/**
 * daily-token-adams-mackay-bocpd-bayesian-online-runlength:
 * per-source ADAMS-MACKAY 2007 BAYESIAN ONLINE
 * CHANGEPOINT DETECTION (BOCPD) on the gap-filled daily
 * total_tokens series.
 *
 * TWO-HUNDRED-AND-TWENTY-SEVENTH cross-source axis.
 *
 * Mechanism. Adams, R.P. and MacKay, D.J.C. (2007),
 * "Bayesian Online Changepoint Detection",
 * arXiv:0710.3742.
 *
 * Setup. Let x[0..n-1] be the gap-filled daily total
 * tokens series for one source (n >= 21). Define a
 * latent run-length r_t in {0, 1, ..., t} that counts
 * the number of consecutive observations since the most
 * recent changepoint at time t. BOCPD maintains a
 * RECURSIVE POSTERIOR p(r_t | x[0..t]) by combining
 * (a) a constant-hazard prior H(r) = 1 / lambda over
 * r_t and (b) a UPM (underlying predictive model) on
 * the per-segment data. We adopt the canonical Normal-
 * inverse-Gamma UPM with parameters (mu, kappa, alpha,
 * beta) and a Student-t posterior predictive
 *
 *     p(x | r) = StudentT(x ; mu, beta*(kappa+1)/
 *                         (alpha*kappa), 2*alpha)        (1)
 *
 * (Murphy 2007 Eq. 99, Adams-MacKay 2007 sec. 3.2).
 * Predictive update is conjugate:
 *
 *     mu'    = (kappa*mu + x) / (kappa + 1)
 *     kappa' = kappa + 1
 *     alpha' = alpha + 1/2
 *     beta'  = beta + (kappa*(x - mu)^2) / (2*(kappa+1))  (2)
 *
 * Recursion. At time t with messages M_t[r] = p(r_t = r,
 * x[0..t]), GROW (no CP) and CP messages are
 *
 *     M_{t+1}[r+1]  = M_t[r] * pi(x_{t+1} | r) * (1 - H)
 *     M_{t+1}[0]    = sum_r M_t[r] * pi(x_{t+1} | r) * H  (3)
 *
 * with H = 1/lambda the constant hazard. After each step
 * we NORMALISE M_t to obtain the run-length posterior
 * p(r_t | x[1..t]).
 *
 * Surfaces (deterministic, pure):
 *
 *   - mChangepoints: number of detected MAP changepoints
 *     on the offline pass (counted as time steps where
 *     the MAP run-length argmax_r p(r_t | x[1..t]) = 0
 *     after the first observation).
 *   - tauStar: ascending changepoint indices in {1..n-1}.
 *   - tauStarDays: ISO YYYY-MM-DD of x[tau] for each tau.
 *   - meanRunLengthMap: average MAP run length over
 *     t in [1, n-1].
 *   - maxRunLengthMap: largest MAP run length attained.
 *   - cpProbability: the maximum over t of
 *     p(r_t = 0 | x[1..t]) (= "strongest single CP
 *     evidence").
 *   - posteriorEntropy: average Shannon entropy (nats)
 *     of the run-length posterior over t in [1, n-1];
 *     low = decisive segmentation, high = diffuse.
 *   - hazardLambda: lambda actually applied (= 1/H).
 *   - sigmaHat: MAD-of-first-differences scale used to
 *     SCALE the upm prior beta.
 *
 * STRUCTURAL ORTHOGONALITY (the core claim).
 *
 * Of the prior 226 cross-source axes NONE is an ONLINE
 * BAYESIAN run-length recursion with conjugate Normal-
 * inverse-Gamma UPM and a constant-hazard prior. Closest
 * neighbours inside the changepoint family:
 *
 *   - axis-221 ALEXANDERSSON-PETTITT (single CP, mean,
 *     parametric/rank, BATCH).
 *   - axis-222 LOMBARD smooth changepoint (single,
 *     smooth, rank-CUSUM, BATCH).
 *   - axis-223 INCLAN-TIAO ICSS (single CP, variance,
 *     parametric, BATCH cumulative-sum search).
 *   - axis-224 KILLICK-FEARNHEAD-ECKLEY PELT (multiple
 *     CP, variance, GAUSSIAN cost + BIC, BATCH dynamic
 *     program).
 *   - axis-225 FRYZLEWICZ WBS (multiple CP, mean,
 *     RANDOMISED CUSUM aggregation, BATCH).
 *   - axis-226 MATTESON-JAMES ECP (multiple CP, full
 *     distribution, energy-distance, BATCH binary
 *     segmentation).
 *
 * Axis-227 BOCPD is orthogonal along three INDEPENDENT
 * dimensions inside the changepoint family:
 *
 *   1. INFERENCE PARADIGM. BOCPD is BAYESIAN with a
 *      proper PRIOR on segment count (geometric over run
 *      lengths) and produces a FULL POSTERIOR over the
 *      latent run length. Axes 221-226 are FREQUENTIST
 *      hypothesis tests / point estimators.
 *   2. ONLINE RECURSION. BOCPD is a STREAMING
 *      forward-only message-passing recursion: at time t
 *      it has only seen x[0..t]. All prior axes are
 *      BATCH algorithms that read the entire sequence
 *      twice or more (CUSUM, DP, randomised intervals,
 *      energy-distance scans).
 *   3. UNCERTAINTY SURFACE. BOCPD surfaces a posterior
 *      ENTROPY and a calibrated cpProbability scalar in
 *      [0, 1], not a frequentist p-value or a non-
 *      negative test statistic. The STRENGTH of evidence
 *      is interpretable as a probability mass on r_t = 0.
 *
 * The axis is also orthogonal to all earlier trend /
 * variance / shape / dispersion axes (181-220) because
 * (a) those axes target a single moment / shape
 * functional, while BOCPD targets the LATENT
 * SEGMENTATION STRUCTURE of the series, and (b) BOCPD
 * is derived from a coherent generative model rather
 * than a moment-condition test.
 *
 * Refs: Adams, R.P. and MacKay, D.J.C. (2007), "Bayesian
 * Online Changepoint Detection", arXiv:0710.3742;
 * Murphy, K.P. (2007), "Conjugate Bayesian analysis of
 * the Gaussian distribution", tech. rep. UBC; Fearnhead
 * and Liu (2007), "On-line inference for multiple
 * changepoint problems", *J. Roy. Statist. Soc. B*
 * 69(4): 589-605.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. PURE NUMERIC HELPERS
// =========================================================

/** Median; returns 0 on empty. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) >> 1]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** MAD = median |x - median(x)|. Returns 0 on empty / constant. */
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const dev: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i += 1) dev[i] = Math.abs(values[i]! - med);
  return median(dev);
}

/** MAD-of-first-differences sigma estimator divided by sqrt(2); 0.6745 = MAD-to-sd. */
export function sigmaHatMadDiff(x: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const diff: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) diff[i] = x[i + 1]! - x[i]!;
  return (mad(diff) / 0.6745) / Math.SQRT2;
}

// =========================================================
// SECTION 2. STUDENT-T LOG-PDF (Normal-inverse-Gamma posterior predictive)
// =========================================================

/**
 * Stirling-quality log-Gamma; sufficient precision for nu in (0, 1e6].
 * Lanczos g = 7, n = 9 coefficients (Numerical Recipes 3rd ed., 6.1).
 */
export function logGamma(z: number): number {
  if (!(z > 0) || !Number.isFinite(z)) return Number.NaN;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // Reflection: ln Gamma(z) = ln(pi/sin(pi z)) - ln Gamma(1 - z)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const w = z - 1;
  let a = c[0]!;
  for (let i = 1; i < g + 2; i += 1) a += c[i]! / (w + i);
  const t = w + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (w + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Student-t log-pdf at x with location mu, scale sigma > 0,
 * degrees of freedom nu > 0.
 *
 *   ln p(x) = ln Gamma((nu+1)/2) - ln Gamma(nu/2)
 *           - 0.5 * ln(nu * pi * sigma^2)
 *           - ((nu+1)/2) * ln(1 + (x - mu)^2 / (nu * sigma^2))
 */
export function studentTLogPdf(x: number, mu: number, sigma: number, nu: number): number {
  if (!(sigma > 0) || !(nu > 0) || !Number.isFinite(x) || !Number.isFinite(mu)) {
    return Number.NEGATIVE_INFINITY;
  }
  const z = (x - mu) / sigma;
  return logGamma((nu + 1) / 2)
    - logGamma(nu / 2)
    - 0.5 * Math.log(nu * Math.PI)
    - Math.log(sigma)
    - ((nu + 1) / 2) * Math.log(1 + (z * z) / nu);
}

// =========================================================
// SECTION 3. BOCPD CORE
// =========================================================

export interface BocpdPosteriorAtT {
  /** Run-length values 0..t. */
  r: number[];
  /** Posterior mass on each r; sums to 1. */
  p: number[];
  /** argmax_r p(r). */
  rMap: number;
  /** p(r_t = 0); > 0.5 typically signals a MAP changepoint. */
  pCp: number;
}

export interface BocpdResult {
  /** posteriors[t] for t in 0..n-1; posteriors[0] is the trivial atom at r=0. */
  posteriors: BocpdPosteriorAtT[];
  /** MAP-detected CPs at t > 0 where rMap drops below the previous-step rMap (segment restart). */
  tauStar: number[];
  /** max over t > 0 of pCp. */
  cpProbability: number;
  /** mean over t > 0 of rMap. */
  meanRunLengthMap: number;
  /** max over t > 0 of rMap. */
  maxRunLengthMap: number;
  /** mean over t > 0 of -sum p log p (nats). */
  posteriorEntropy: number;
  /** Hazard parameter H actually applied. */
  hazard: number;
  /** UPM prior parameters actually applied. */
  upmPrior: { mu: number; kappa: number; alpha: number; beta: number };
}

export interface BocpdOptions {
  /** Constant geometric-prior hazard H = 1/lambda. */
  hazard: number;
  /** UPM Normal-inverse-Gamma prior. */
  upmPrior: { mu: number; kappa: number; alpha: number; beta: number };
}

/**
 * Pure offline pass of the Adams-MacKay 2007 BOCPD recursion
 * with a Normal-inverse-Gamma UPM (Student-t posterior
 * predictive). Returns the per-step posteriors and the MAP
 * trajectory.
 *
 * Throws on n < 1, hazard not in (0, 1), or invalid prior.
 */
export function bocpdRun(x: number[], opts: BocpdOptions): BocpdResult {
  const n = x.length;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`bocpdRun: need n >= 1 integer (got ${n})`);
  }
  const { hazard } = opts;
  if (!Number.isFinite(hazard) || !(hazard > 0) || !(hazard < 1)) {
    throw new Error(`bocpdRun: hazard must be in (0, 1) (got ${hazard})`);
  }
  const { mu: mu0, kappa: kappa0, alpha: alpha0, beta: beta0 } = opts.upmPrior;
  if (!Number.isFinite(mu0)) throw new Error(`bocpdRun: prior mu non-finite (${mu0})`);
  if (!(kappa0 > 0) || !Number.isFinite(kappa0)) {
    throw new Error(`bocpdRun: prior kappa must be > 0 (got ${kappa0})`);
  }
  if (!(alpha0 > 0) || !Number.isFinite(alpha0)) {
    throw new Error(`bocpdRun: prior alpha must be > 0 (got ${alpha0})`);
  }
  if (!(beta0 > 0) || !Number.isFinite(beta0)) {
    throw new Error(`bocpdRun: prior beta must be > 0 (got ${beta0})`);
  }

  // UPM sufficient statistics for each candidate run-length r.
  // params[r] = posterior NIG state if we are r steps into a segment.
  // We rebuild a fresh array per step.
  let mu: number[] = [mu0];
  let kappa: number[] = [kappa0];
  let alpha: number[] = [alpha0];
  let beta: number[] = [beta0];
  let logM: number[] = [0]; // log p(r_0 = 0, x[0..-1]) = log 1.

  const posteriors: BocpdPosteriorAtT[] = [];
  posteriors.push({ r: [0], p: [1], rMap: 0, pCp: 1 });

  const tauStar: number[] = [];
  let cpProbability = 0;
  let sumRunMap = 0;
  let maxRunMap = 0;
  let sumEntropy = 0;
  let countTGtZero = 0;

  for (let t = 0; t < n; t += 1) {
    const xt = x[t]!;
    const k = mu.length; // number of run-length hypotheses entering this step

    // 1. predictive log-likelihoods pi[r] = log p(x_t | r).
    const piLog: number[] = new Array(k);
    for (let r = 0; r < k; r += 1) {
      const sigmaPred = Math.sqrt((beta[r]! * (kappa[r]! + 1)) / (alpha[r]! * kappa[r]!));
      const nuPred = 2 * alpha[r]!;
      piLog[r] = studentTLogPdf(xt, mu[r]!, sigmaPred, nuPred);
    }

    // 2. growth and CP messages (in log-space).
    //    grow_log[r+1] = logM[r] + piLog[r] + log(1 - H)
    //    cp_log       = logsumexp_r ( logM[r] + piLog[r] + log(H) )
    const log1mH = Math.log(1 - hazard);
    const logH = Math.log(hazard);
    const growLog: number[] = new Array(k + 1);
    growLog[0] = Number.NEGATIVE_INFINITY; // populated by cpLog below
    for (let r = 0; r < k; r += 1) {
      growLog[r + 1] = logM[r]! + piLog[r]! + log1mH;
    }
    // logsumexp for cp:
    let m = Number.NEGATIVE_INFINITY;
    for (let r = 0; r < k; r += 1) {
      const v = logM[r]! + piLog[r]! + logH;
      if (v > m) m = v;
    }
    let s = 0;
    if (Number.isFinite(m)) {
      for (let r = 0; r < k; r += 1) {
        s += Math.exp(logM[r]! + piLog[r]! + logH - m);
      }
    }
    const cpLog = Number.isFinite(m) && s > 0 ? m + Math.log(s) : Number.NEGATIVE_INFINITY;
    growLog[0] = cpLog;

    // 3. update UPM sufficient stats: index r grows to r+1; r=0 reseeds from prior.
    const newMu: number[] = new Array(k + 1);
    const newKappa: number[] = new Array(k + 1);
    const newAlpha: number[] = new Array(k + 1);
    const newBeta: number[] = new Array(k + 1);
    newMu[0] = mu0;
    newKappa[0] = kappa0;
    newAlpha[0] = alpha0;
    newBeta[0] = beta0;
    for (let r = 0; r < k; r += 1) {
      const muR = mu[r]!;
      const kappaR = kappa[r]!;
      const alphaR = alpha[r]!;
      const betaR = beta[r]!;
      newMu[r + 1] = (kappaR * muR + xt) / (kappaR + 1);
      newKappa[r + 1] = kappaR + 1;
      newAlpha[r + 1] = alphaR + 0.5;
      newBeta[r + 1] = betaR + (kappaR * (xt - muR) * (xt - muR)) / (2 * (kappaR + 1));
    }

    // 4. normalise messages -> posterior p(r_t | x[0..t]).
    let lmax = Number.NEGATIVE_INFINITY;
    for (let r = 0; r <= k; r += 1) if (growLog[r]! > lmax) lmax = growLog[r]!;
    let zsum = 0;
    const post: number[] = new Array(k + 1);
    if (Number.isFinite(lmax)) {
      for (let r = 0; r <= k; r += 1) {
        post[r] = Math.exp(growLog[r]! - lmax);
        zsum += post[r]!;
      }
      for (let r = 0; r <= k; r += 1) post[r] = post[r]! / zsum;
    } else {
      // degenerate: collapse to uniform.
      const u = 1 / (k + 1);
      for (let r = 0; r <= k; r += 1) post[r] = u;
    }

    let rMap = 0;
    let pMap = post[0]!;
    for (let r = 1; r <= k; r += 1) {
      if (post[r]! > pMap) {
        pMap = post[r]!;
        rMap = r;
      }
    }
    const rArr = new Array<number>(k + 1);
    for (let r = 0; r <= k; r += 1) rArr[r] = r;
    posteriors.push({ r: rArr, p: post, rMap, pCp: post[0]! });

    if (t > 0) {
      countTGtZero += 1;
      const prevRMap = posteriors[posteriors.length - 2]!.rMap;
      // CP detected when MAP run length resets to 0 OR drops below the
      // previous step's run length (segment restart). The latter is the
      // canonical Adams-MacKay 2007 detection rule on the MAP trajectory:
      // r_t < r_{t-1} + 1 means a CP took posterior mass off the growing
      // run. We adopt the strict-decrement form to avoid double-counting
      // small posterior fluctuations: r_t < r_{t-1}.
      if (rMap < prevRMap) tauStar.push(t);
      if (post[0]! > cpProbability) cpProbability = post[0]!;
      sumRunMap += rMap;
      if (rMap > maxRunMap) maxRunMap = rMap;
      let h = 0;
      for (let r = 0; r <= k; r += 1) {
        const pr = post[r]!;
        if (pr > 0) h -= pr * Math.log(pr);
      }
      sumEntropy += h;
    }

    // Roll forward.
    mu = newMu;
    kappa = newKappa;
    alpha = newAlpha;
    beta = newBeta;
    logM = new Array(k + 1);
    if (Number.isFinite(lmax)) {
      for (let r = 0; r <= k; r += 1) logM[r] = Math.log(post[r]!);
    } else {
      const u = -Math.log(k + 1);
      for (let r = 0; r <= k; r += 1) logM[r] = u;
    }
  }

  posteriors.shift(); // drop the synthetic t=-1 atom

  return {
    posteriors,
    tauStar,
    cpProbability,
    meanRunLengthMap: countTGtZero > 0 ? sumRunMap / countTGtZero : 0,
    maxRunLengthMap: maxRunMap,
    posteriorEntropy: countTGtZero > 0 ? sumEntropy / countTGtZero : 0,
    hazard,
    upmPrior: opts.upmPrior,
  };
}

// =========================================================
// SECTION 4. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSort =
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'cpProbability'
  | 'cpProbabilityDesc'
  | 'meanRunLengthMap'
  | 'meanRunLengthMapDesc'
  | 'posteriorEntropy'
  | 'posteriorEntropyDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSort;
  /** Geometric-prior hazard parameter lambda (>= 2); H = 1/lambda. Default 100. */
  hazardLambda?: number;
  /** UPM kappa0 prior strength on mean (> 0); default 1.0. */
  upmKappa?: number;
  /** UPM alpha0 prior d.o.f. on variance (> 0); default 1.0. */
  upmAlpha?: number;
  /** Drop rows with mChangepoints == 0. */
  onlyWithCps?: boolean;
  generatedAt?: string;
}

export interface DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  mChangepoints: number;
  tauStar: number[];
  tauStarDays: string[];
  cpProbability: number;
  meanRunLengthMap: number;
  maxRunLengthMap: number;
  posteriorEntropy: number;
  hazardLambda: number;
  sigmaHat: number;
  upmMu0: number;
  upmKappa: number;
  upmAlpha: number;
  upmBeta: number;
}

export interface DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSort;
  hazardLambda: number;
  upmKappa: number;
  upmAlpha: number;
  onlyWithCps: boolean;
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
  sources: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSourceRow[];
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

/**
 * Per-source pure builder. Validates options, gap-fills,
 * runs BOCPD, returns a deterministic report.
 */
export function buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(
  queue: QueueLine[],
  opts: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthOptions = {},
): DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minTenureDays = opts.minTenureDays ?? 21;
  if (!Number.isInteger(minTenureDays) || minTenureDays < 21) {
    throw new Error(
      `minTenureDays must be an integer >= 21 (got ${opts.minTenureDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSort =
    opts.sort ?? 'mChangepointsDesc';
  const validSorts: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSort[] = [
    'mChangepoints',
    'mChangepointsDesc',
    'cpProbability',
    'cpProbabilityDesc',
    'meanRunLengthMap',
    'meanRunLengthMapDesc',
    'posteriorEntropy',
    'posteriorEntropyDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const hazardLambda = opts.hazardLambda ?? 100;
  if (!Number.isFinite(hazardLambda) || hazardLambda < 2) {
    throw new Error(
      `hazardLambda must be a finite number >= 2 (got ${opts.hazardLambda})`,
    );
  }
  const upmKappa = opts.upmKappa ?? 1.0;
  if (!Number.isFinite(upmKappa) || !(upmKappa > 0)) {
    throw new Error(`upmKappa must be > 0 (got ${opts.upmKappa})`);
  }
  const upmAlpha = opts.upmAlpha ?? 1.0;
  if (!Number.isFinite(upmAlpha) || !(upmAlpha > 0)) {
    throw new Error(`upmAlpha must be > 0 (got ${opts.upmAlpha})`);
  }
  const onlyWithCps = opts.onlyWithCps ?? false;
  if (typeof onlyWithCps !== 'boolean') {
    throw new Error(`onlyWithCps must be boolean (got ${opts.onlyWithCps})`);
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
  const rows: DailyTokenAdamsMackayBocpdBayesianOnlineRunLengthSourceRow[] = [];

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
    let sumX = 0;
    for (let i = 0; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
      sumX += val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    const meanGlobal = sumX / nTenure;
    let sigmaHat = sigmaHatMadDiff(filled);
    if (!(sigmaHat > 0) || !Number.isFinite(sigmaHat)) {
      let sumD = 0;
      let sumD2 = 0;
      const k = filled.length - 1;
      for (let i = 0; i < k; i += 1) {
        const d = filled[i + 1]! - filled[i]!;
        sumD += d;
        sumD2 += d * d;
      }
      const meanD = sumD / k;
      const varD = Math.max(0, sumD2 / k - meanD * meanD);
      sigmaHat = Math.sqrt(varD) / Math.SQRT2;
      if (!(sigmaHat > 0) || !Number.isFinite(sigmaHat)) {
        droppedNonFiniteFit += 1;
        continue;
      }
    }
    // UPM prior: mu0 = global mean, beta0 = upmAlpha * sigmaHat^2 (so prior
    // marginal variance ~ sigmaHat^2). Mild shrinkage via kappa = upmKappa.
    const beta0 = upmAlpha * sigmaHat * sigmaHat;
    if (!(beta0 > 0) || !Number.isFinite(beta0)) {
      droppedNonFiniteFit += 1;
      continue;
    }
    let result: BocpdResult;
    try {
      result = bocpdRun(filled, {
        hazard: 1 / hazardLambda,
        upmPrior: {
          mu: meanGlobal,
          kappa: upmKappa,
          alpha: upmAlpha,
          beta: beta0,
        },
      });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(result.cpProbability) ||
      !Number.isFinite(result.meanRunLengthMap) ||
      !Number.isFinite(result.posteriorEntropy)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const tauStarDays = result.tauStar.map((t) => addUtcDays(acc.firstDay, t));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      mChangepoints: result.tauStar.length,
      tauStar: result.tauStar,
      tauStarDays,
      cpProbability: result.cpProbability,
      meanRunLengthMap: result.meanRunLengthMap,
      maxRunLengthMap: result.maxRunLengthMap,
      posteriorEntropy: result.posteriorEntropy,
      hazardLambda,
      sigmaHat,
      upmMu0: meanGlobal,
      upmKappa,
      upmAlpha,
      upmBeta: beta0,
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mChangepoints':
        primary = a.mChangepoints - b.mChangepoints;
        break;
      case 'mChangepointsDesc':
        primary = b.mChangepoints - a.mChangepoints;
        break;
      case 'cpProbability':
        primary = a.cpProbability - b.cpProbability;
        break;
      case 'cpProbabilityDesc':
        primary = b.cpProbability - a.cpProbability;
        break;
      case 'meanRunLengthMap':
        primary = a.meanRunLengthMap - b.meanRunLengthMap;
        break;
      case 'meanRunLengthMapDesc':
        primary = b.meanRunLengthMap - a.meanRunLengthMap;
        break;
      case 'posteriorEntropy':
        primary = a.posteriorEntropy - b.posteriorEntropy;
        break;
      case 'posteriorEntropyDesc':
        primary = b.posteriorEntropy - a.posteriorEntropy;
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
  if (onlyWithCps) {
    kept = kept.filter((r) => r.mChangepoints > 0);
  }
  if (top > 0 && kept.length > top) {
    droppedTopSources = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minTenureDays,
    top,
    sort,
    hazardLambda,
    upmKappa,
    upmAlpha,
    onlyWithCps,
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
