/**
 * daily-token-adf-unit-root: per-source Augmented Dickey-Fuller (ADF)
 * unit-root test on the gap-filled daily total_tokens series.
 *
 * AXIS-157 (regression-based unit-root test, structurally inverse to
 * the axis-156 KPSS stationarity test).
 *
 * Model: ADF level-with-constant ("type c", "drift only", no trend),
 * the standard "test for a unit root in the level" specification.
 * On the gap-filled tenure series x[0..n-1] with first differences
 * dx[i] = x[i] - x[i-1] for i = 1..n-1, fit OLS:
 *
 *     dx[t] = alpha + rho * x[t-1] + sum_{j=1..p} phi[j] * dx[t-j] + eps[t]
 *
 * for t = p+1..n-1. The ADF tau statistic is the OLS t-ratio for rho:
 *
 *     tau = rho_hat / SE(rho_hat)
 *
 * Under H0 (unit root, rho = 0), tau follows the Dickey-Fuller
 * "tau_mu" distribution (constant, no trend; Fuller 1976 / Hamilton
 * 1994 Table B.6). It is *not* a Student-t distribution. The standard
 * tabulated asymptotic critical values are:
 *
 *     1%:  -3.430   5%:  -2.860   10%: -2.570
 *
 * H0: there is a unit root (series is integrated of order 1, I(1)).
 * H1: rho < 0 (mean-reverting; series is stationary around the mean,
 *     i.e. I(0)).
 *
 * REJECT H0 when tau is *more negative* than the critical value (this
 * is a one-sided lower-tail test in the DF distribution). Rejection
 * means evidence FOR stationarity around a constant mean.
 *
 * Lag selection: deterministic Schwert (1989) maximum-lag rule
 *
 *     pMax = floor(12 * (n / 100)^(1/4))
 *
 * capped at floor((n - 1) / 4) so the regression has > 0 effective
 * residual degrees of freedom even on tiny series. Schwert's rule is
 * the standard "rule-of-thumb" maximum lag for unit-root tests; we
 * use it directly (no information-criterion search) so the statistic
 * is fully deterministic and reproducible.
 *
 * Categorical verdict at the standard DF tau_mu cutoffs:
 *
 *     tau >  -2.570            -> "unit-root"            (cannot reject H0 at 10%)
 *     -2.860 < tau <= -2.570   -> "borderline"           (reject at 10%, not 5%)
 *     -3.430 < tau <= -2.860   -> "stationary"           (reject at 5%)
 *     tau <= -3.430            -> "strongly-stationary"  (reject at 1%)
 *
 * Verdict-axis polarity note: this is *opposite* to the axis-156 KPSS
 * verdict polarity by design. KPSS labels something "nonstationary"
 * when it rejects the stationarity null; ADF labels something
 * "stationary" when it rejects the unit-root null. The two tests jointly
 * stratify a series into:
 *
 *     - (KPSS=stationary, ADF=stationary)        : strong stationarity
 *     - (KPSS=stationary, ADF=unit-root)         : underpowered ADF
 *     - (KPSS=nonstationary, ADF=stationary)     : conflicting evidence
 *     - (KPSS=nonstationary, ADF=unit-root)      : strong unit-root
 *
 * which is the canonical (KPSS, ADF) cross-tabulation used in applied
 * unit-root analysis. axis-156 and axis-157 jointly carry information
 * neither carries alone.
 *
 * Why this is structurally orthogonal to all 156 prior axes:
 *
 *   - axis-156 kpss-stationarity: integrated-squared-partial-sums
 *     statistic with HAC long-run-variance normalization; null is
 *     stationarity. ADF is a regression-t on the lagged-level
 *     coefficient in a finite-AR autoregression; null is a unit root.
 *     Same series, dual hypotheses, completely different statistical
 *     machinery (functional-CLT integrand vs OLS regression t-ratio).
 *   - axis-155 buishand-range: range of cumulative departures, no
 *     regression, no AR structure, i.i.d. variance normalization.
 *   - axis-154 pettitt-changepoint: rank-based single-break detection
 *     on Mann-Whitney U; no AR fit, no unit-root concept.
 *   - axis-153 cusum: max |centered cumsum|, no normalization, no
 *     regression.
 *   - cox-stuart, mann-kendall, runs-test, bartels-rank-vonneumann:
 *     trend / randomness tests on signs / ranks of pairwise
 *     comparisons; no AR coefficient, no unit-root null.
 *   - autocorrelation lag-1/lag-7, ljung-box-q, kendall/spearman
 *     autocorr: serial-correlation summaries on the level series;
 *     ADF instead regresses *first differences* on the lagged level
 *     and tests the level coefficient — a fundamentally different
 *     parametric quantity (long-run vs short-run behavior).
 *   - dfa-alpha, hurst-rs: long-memory exponents (continuum of
 *     persistence); ADF asks the discrete I(0) vs I(1) question with
 *     concrete tabulated cutoffs.
 *   - allan-deviation, hampel-outlier-count: variance / point-outlier
 *     summaries — no integration-order concept.
 *
 * Knobs:
 *   - `minDays` (default 12): n must be >= 12 so that with at least
 *     1 augmentation lag (set automatically when n is small) the
 *     regression has non-degenerate residual degrees of freedom.
 *   - `top` (default 0): display cap.
 *   - `sort`: tokens|tau|lags|rho|ndays|verdict|papprox.
 *
 *   `verdict` sort orders categorically by *strength of stationarity
 *   evidence*: strongly-stationary > stationary > borderline >
 *   unit-root > flat.
 *
 * Determinism: pure builder. No wall clock except opts.generatedAt.
 * Pure OLS via normal-equations Cholesky (small p, fully deterministic).
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export type DailyTokenAdfUnitRootSortKey =
  | 'tokens'
  | 'tau'
  | 'lags'
  | 'rho'
  | 'ndays'
  | 'verdict'
  | 'papprox';

export type AdfVerdict =
  | 'strongly-stationary'
  | 'stationary'
  | 'borderline'
  | 'unit-root'
  | 'flat';

export interface DailyTokenAdfUnitRootOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Minimum gap-filled tenure length (days). Must be >= 12. Default 12. */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  sort?: DailyTokenAdfUnitRootSortKey;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenAdfUnitRootSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nFilledDays: number;
  /** ADF tau statistic (OLS t-ratio for rho). Negative under H1. */
  tau: number;
  /** OLS estimate of rho (lagged-level coefficient). */
  rho: number;
  /** Heteroskedasticity-naive OLS standard error of rho. > 0. */
  rhoSe: number;
  /** Augmentation lag count actually used (>= 0, <= pMax). */
  lags: number;
  /** Schwert max-lag rule pMax = min(floor(12*(n/100)^.25), floor((n-1)/4)). */
  pMax: number;
  /** Effective regression sample size (n - 1 - lags). */
  nReg: number;
  /** Categorical verdict at standard DF tau_mu cutoffs. */
  verdict: AdfVerdict;
  /** Approximate one-sided p-value via 3-anchor interpolation on tau. */
  pApprox: number;
  /** True iff series has zero variance — ADF undefined. */
  flat: boolean;
  /** True iff regression numerics broke (singular X'X) — fall back to flat-like row. */
  degenerate: boolean;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenAdfUnitRootReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: DailyTokenAdfUnitRootSortKey;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenAdfUnitRootSourceRow[];
}

export interface AdfSummary {
  tau: number;
  rho: number;
  rhoSe: number;
  lags: number;
  pMax: number;
  nReg: number;
  verdict: AdfVerdict;
  pApprox: number;
  flat: boolean;
  degenerate: boolean;
}

// Standard Dickey-Fuller asymptotic critical values, "tau_mu" model
// (constant, no trend). Hamilton (1994) Table B.6, MacKinnon (1996).
const DF_CRIT_10 = -2.57;
const DF_CRIT_5 = -2.86;
const DF_CRIT_1 = -3.43;

const TAU_ANCHORS: readonly number[] = [DF_CRIT_10, DF_CRIT_5, DF_CRIT_1];
const P_LEVELS: readonly number[] = [0.1, 0.05, 0.01];

/**
 * 3-anchor log-linear interpolation of the lower-tail ADF p-value at
 * the standard DF tau_mu critical values.
 *
 *   tau >= -2.57    -> linear-in-tau from p=0.99 at tau=0 to p=0.10 at -2.57
 *   -2.57..-2.86    -> log-linear in p between 0.10 and 0.05
 *   -2.86..-3.43    -> log-linear in p between 0.05 and 0.01
 *   tau <  -3.43    -> log-linear extrapolation; pinned at min p = 1e-4
 *
 * Diagnostic only (the DF asymptotic null involves a functional of
 * Brownian motion); faithful at the three tabulated points.
 */
export function adfPApprox(tau: number): number {
  if (!Number.isFinite(tau)) return 0.99;
  if (tau >= 0) return 0.99;
  if (tau >= TAU_ANCHORS[0]!) {
    // tau in [-2.57, 0): linear from (0, 0.99) to (-2.57, 0.10).
    const t = tau / TAU_ANCHORS[0]!; // 0..1 as tau goes 0..-2.57
    const p = 0.99 + t * (P_LEVELS[0]! - 0.99);
    return Math.min(0.99, Math.max(P_LEVELS[0]!, p));
  }
  for (let i = 0; i < TAU_ANCHORS.length - 1; i++) {
    const t0 = TAU_ANCHORS[i]!;
    const t1 = TAU_ANCHORS[i + 1]!;
    if (tau >= t1) {
      // tau between t0 (=-2.57) and t1 (=-2.86); both negative, t1 < t0.
      const u = (tau - t0) / (t1 - t0); // 0..1
      const lp = Math.log(P_LEVELS[i]!) + u * (Math.log(P_LEVELS[i + 1]!) - Math.log(P_LEVELS[i]!));
      return Math.exp(lp);
    }
  }
  // tau < -3.43: extrapolate using last segment slope.
  const tA = TAU_ANCHORS[TAU_ANCHORS.length - 2]!;
  const tB = TAU_ANCHORS[TAU_ANCHORS.length - 1]!;
  const pA = P_LEVELS[P_LEVELS.length - 2]!;
  const pB = P_LEVELS[P_LEVELS.length - 1]!;
  const slope = (Math.log(pB) - Math.log(pA)) / (tB - tA);
  const lp = Math.log(pB) + slope * (tau - tB);
  return Math.max(1e-4, Math.exp(lp));
}

export function adfVerdict(tau: number, flat: boolean): AdfVerdict {
  if (flat) return 'flat';
  if (!Number.isFinite(tau)) return 'unit-root';
  if (tau <= DF_CRIT_1) return 'strongly-stationary';
  if (tau <= DF_CRIT_5) return 'stationary';
  if (tau <= DF_CRIT_10) return 'borderline';
  return 'unit-root';
}

/**
 * Schwert (1989) maximum-lag rule for unit-root tests.
 * pMax = min(floor(12 * (n/100)^0.25), floor((n - 1) / 4)).
 * The (n-1)/4 cap ensures the regression has positive degrees of
 * freedom even on tiny n; the rule yields 0 for n < 2.
 */
export function schwertMaxLag(n: number): number {
  if (n < 2) return 0;
  const raw = Math.floor(12 * Math.pow(n / 100, 0.25));
  const cap = Math.floor((n - 1) / 4);
  return Math.max(0, Math.min(raw, cap));
}

/**
 * Solve the symmetric positive-definite normal-equations system
 * (XtX) * beta = Xty by Cholesky. Returns null on numerical failure
 * (non-PD matrix). k is small (<= ~20) so the cubic cost is fine.
 *
 * Also returns the inverse-diagonal entries of (XtX)^{-1} via solving
 * for each unit vector; only the diagonal entry for the rho column
 * is needed by the caller, but we compute the full diagonal to keep
 * the helper general.
 */
function choleskySolve(
  XtX: number[][],
  Xty: number[],
): { beta: number[]; invDiag: number[] } | null {
  const k = XtX.length;
  // Copy + factor in-place into L (lower triangular).
  const L: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = XtX[i]![j]!;
      for (let m = 0; m < j; m++) s -= L[i]![m]! * L[j]![m]!;
      if (i === j) {
        if (s <= 0 || !Number.isFinite(s)) return null;
        L[i]![j] = Math.sqrt(s);
      } else {
        L[i]![j] = s / L[j]![j]!;
      }
    }
  }
  // Solve L y = Xty.
  const y = new Array<number>(k).fill(0);
  for (let i = 0; i < k; i++) {
    let s = Xty[i]!;
    for (let m = 0; m < i; m++) s -= L[i]![m]! * y[m]!;
    y[i] = s / L[i]![i]!;
  }
  // Solve L^T beta = y.
  const beta = new Array<number>(k).fill(0);
  for (let i = k - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let m = i + 1; m < k; m++) s -= L[m]![i]! * beta[m]!;
    beta[i] = s / L[i]![i]!;
  }
  // Diagonal of (XtX)^{-1}: solve XtX * v_j = e_j and take v_j[j].
  const invDiag = new Array<number>(k).fill(0);
  for (let j = 0; j < k; j++) {
    const yj = new Array<number>(k).fill(0);
    for (let i = 0; i < k; i++) {
      let s = i === j ? 1 : 0;
      for (let m = 0; m < i; m++) s -= L[i]![m]! * yj[m]!;
      yj[i] = s / L[i]![i]!;
    }
    const vj = new Array<number>(k).fill(0);
    for (let i = k - 1; i >= 0; i--) {
      let s = yj[i]!;
      for (let m = i + 1; m < k; m++) s -= L[m]![i]! * vj[m]!;
      vj[i] = s / L[i]![i]!;
    }
    invDiag[j] = vj[j]!;
  }
  return { beta, invDiag };
}

/**
 * Pure ADF level-with-constant unit-root summary on a real-valued
 * series of length n. Returns `flat` true when n < 2 or sample
 * variance is 0; returns `degenerate` true when the OLS normal
 * equations are singular (pathological collinearity).
 */
export function adfSummary(values: number[]): AdfSummary {
  const n = values.length;
  const flatRow: AdfSummary = {
    tau: 0,
    rho: 0,
    rhoSe: 0,
    lags: 0,
    pMax: 0,
    nReg: 0,
    verdict: 'flat',
    pApprox: 0.99,
    flat: true,
    degenerate: false,
  };
  if (n < 2) return flatRow;

  // Variance check.
  let mu = 0;
  for (let i = 0; i < n; i++) mu += values[i]!;
  mu /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - mu;
    v += d * d;
  }
  if (v === 0 || !Number.isFinite(v)) return flatRow;

  const pMax = schwertMaxLag(n);
  // Ensure regression has at least 2 residual df beyond the parameters.
  // Number of regressors k = 2 + lags (intercept, lagged level, lags
  // augmentations). Effective sample T = n - 1 - lags. df = T - k.
  // We'll iterate from pMax downwards and use the largest lags such
  // that df >= 2 AND the OLS solve succeeds.
  for (let lags = pMax; lags >= 0; lags--) {
    const startT = 1 + lags;
    const T = n - startT;
    const k = 2 + lags;
    if (T - k < 2) continue;
    // Build XtX (k x k) and Xty (k) and yt'y on the fly.
    const XtX: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    const Xty = new Array<number>(k).fill(0);
    let yty = 0;
    let xRow = new Array<number>(k);
    for (let t = startT; t < n; t++) {
      const dy = values[t]! - values[t - 1]!;
      // Regressors: [1, x[t-1], dx[t-1], dx[t-2], ..., dx[t-lags]].
      xRow[0] = 1;
      xRow[1] = values[t - 1]!;
      for (let j = 1; j <= lags; j++) {
        xRow[1 + j] = values[t - j]! - values[t - j - 1]!;
      }
      for (let i = 0; i < k; i++) {
        const xi = xRow[i]!;
        Xty[i]! += xi * dy;
        const row = XtX[i]!;
        for (let jj = i; jj < k; jj++) row[jj]! += xi * xRow[jj]!;
      }
      yty += dy * dy;
    }
    // Symmetrize XtX (we only filled upper triangle).
    for (let i = 0; i < k; i++) {
      for (let jj = 0; jj < i; jj++) XtX[i]![jj] = XtX[jj]![i]!;
    }
    const sol = choleskySolve(XtX, Xty);
    if (!sol) continue;
    const beta = sol.beta;
    const invDiag = sol.invDiag;
    // SSR = yty - beta' Xty.
    let bxy = 0;
    for (let i = 0; i < k; i++) bxy += beta[i]! * Xty[i]!;
    let ssr = yty - bxy;
    if (!Number.isFinite(ssr) || ssr < 0) ssr = 0;
    const df = T - k;
    const sigma2 = ssr / df;
    const rho = beta[1]!;
    const seRho = Math.sqrt(Math.max(0, sigma2 * invDiag[1]!));
    if (!Number.isFinite(seRho) || seRho === 0) continue;
    const tau = rho / seRho;
    if (!Number.isFinite(tau)) continue;
    return {
      tau,
      rho,
      rhoSe: seRho,
      lags,
      pMax,
      nReg: T,
      verdict: adfVerdict(tau, false),
      pApprox: adfPApprox(tau),
      flat: false,
      degenerate: false,
    };
  }
  // All lag candidates failed -> degenerate row.
  return {
    tau: 0,
    rho: 0,
    rhoSe: 0,
    lags: 0,
    pMax,
    nReg: 0,
    verdict: 'unit-root',
    pApprox: 0.99,
    flat: false,
    degenerate: true,
  };
}

function addDays(ymd: string, days: number): string {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  const next = new Date(ms + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function dayDiffInclusive(a: string, b: string): number {
  const am = Date.parse(`${a}T00:00:00.000Z`);
  const bm = Date.parse(`${b}T00:00:00.000Z`);
  return Math.round((bm - am) / 86_400_000) + 1;
}

const SORT_KEYS: DailyTokenAdfUnitRootSortKey[] = [
  'tokens',
  'tau',
  'lags',
  'rho',
  'ndays',
  'verdict',
  'papprox',
];

const VERDICT_RANK: Record<AdfVerdict, number> = {
  'strongly-stationary': 4,
  stationary: 3,
  borderline: 2,
  'unit-root': 1,
  flat: 0,
};

export function buildDailyTokenAdfUnitRoot(
  queue: QueueLine[],
  opts: DailyTokenAdfUnitRootOptions = {},
): DailyTokenAdfUnitRootReport {
  const minDays = opts.minDays ?? 12;
  if (!Number.isInteger(minDays) || minDays < 12) {
    throw new Error(`minDays must be an integer >= 12 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!SORT_KEYS.includes(sort)) {
    throw new Error(`sort must be one of ${SORT_KEYS.join('|')} (got ${opts.sort})`);
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  const agg = new Map<string, Map<string, number>>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
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
      droppedZeroTokens += 1;
      continue;
    }

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const day = q.hour_start.slice(0, 10);
    let days = agg.get(src);
    if (!days) {
      days = new Map<string, number>();
      agg.set(src, days);
    }
    days.set(day, (days.get(day) ?? 0) + tt);
  }

  const totalSources = agg.size;
  const rows: DailyTokenAdfUnitRootSourceRow[] = [];
  let droppedSparseSources = 0;
  let totalTokens = 0;

  for (const [src, days] of agg) {
    const sortedKeys = Array.from(days.keys()).sort();
    const series = sortedKeys.map((d) => days.get(d)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    const nActive = series.length;
    if (nActive === 0) continue;

    const first = sortedKeys[0]!;
    const last = sortedKeys[sortedKeys.length - 1]!;
    const nFilled = dayDiffInclusive(first, last);
    if (nFilled < minDays) {
      droppedSparseSources += 1;
      continue;
    }

    const filled: number[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      cursor = addDays(cursor, 1);
    }

    const summary = adfSummary(filled);
    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      tau: summary.tau,
      rho: summary.rho,
      rhoSe: summary.rhoSe,
      lags: summary.lags,
      pMax: summary.pMax,
      nReg: summary.nReg,
      verdict: summary.verdict,
      pApprox: summary.pApprox,
      flat: summary.flat,
      degenerate: summary.degenerate,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tau':
        // Most-negative tau first (strongest stationarity evidence).
        primary = a.tau - b.tau;
        break;
      case 'lags':
        primary = b.lags - a.lags;
        break;
      case 'rho':
        primary = a.rho - b.rho;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
        break;
      case 'verdict':
        primary = VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict];
        break;
      case 'papprox':
        primary = a.pApprox - b.pApprox;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    minDays,
    top,
    sort,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedTopSources,
    sources: kept,
  };
}
