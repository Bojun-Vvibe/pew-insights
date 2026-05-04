/**
 * daily-token-kpss-stationarity: per-source KPSS (Kwiatkowski-Phillips-
 * Schmidt-Shin, 1992) level-stationarity test on the gap-filled daily
 * total_tokens series.
 *
 * AXIS-156 (long-run-variance-normalized stationarity test).
 *
 * For each source, on the gap-filled tenure series x[0..n-1] with mean
 * mu = (1/n) sum_i x[i], define the demeaned residuals e[i] = x[i] - mu
 * and the partial sums:
 *
 *     S[t] = sum_{i=0..t} e[i]              t = 0..n-1   (S[n-1] = 0)
 *
 * The KPSS level-stationarity statistic is:
 *
 *     eta = (1 / n^2) * sum_{t=0..n-1} S[t]^2 / sigma2_lr(L)
 *
 * where sigma2_lr(L) is the BARTLETT-KERNEL HAC ("Newey-West", 1987)
 * long-run variance estimator with bandwidth L:
 *
 *     gamma[h] = (1/n) sum_{i=h..n-1} e[i] * e[i-h]    for h = 0..L
 *     w(h, L)  = 1 - h / (L + 1)                        Bartlett weight
 *     sigma2_lr(L) = gamma[0] + 2 * sum_{h=1..L} w(h,L) * gamma[h]
 *
 * We use the Schwert (1989) bandwidth rule:
 *
 *     L = floor(4 * (n / 100)^(1/4))
 *
 * which is a standard, deterministic, data-independent choice (depends
 * only on n).
 *
 * Asymptotic distribution: under H0 (level stationarity), eta converges
 * to integral_0^1 V(r)^2 dr where V is a standard Brownian bridge. The
 * upper-tail critical values (Kwiatkowski et al. 1992 Table 1, level
 * model "mu") are:
 *
 *     10%: 0.347   5%: 0.463   2.5%: 0.574   1%: 0.739
 *
 * We expose a categorical `verdict` derived from these thresholds:
 *
 *     eta < 0.347            -> "stationary"          (cannot reject H0 at 10%)
 *     0.347 <= eta < 0.463   -> "borderline"          (reject at 10%, not 5%)
 *     0.463 <= eta < 0.739   -> "nonstationary"       (reject at 5%)
 *     eta >= 0.739           -> "strongly-nonstationary" (reject at 1%)
 *
 * Why this is structurally orthogonal to all 155 prior axes:
 *
 *   - axis-155 buishand-range / U: Buishand normalizes by the
 *     I.I.D. population sigma (assumes serial independence); KPSS
 *     normalizes by the LONG-RUN variance with a Bartlett-kernel HAC
 *     correction that *explicitly absorbs serial dependence*. The
 *     hypotheses are inverted: Buishand H0 = constant mean (changepoint
 *     test), KPSS H0 = level-stationary mean (stationarity test). Same
 *     partial-sum object S[t], fundamentally different normalization
 *     and inference.
 *   - axis-154 pettitt-changepoint: rank-based, magnitude-blind, single
 *     break point. KPSS uses raw magnitudes through HAC variance and
 *     asks about overall stationarity (no break point at all).
 *   - axis-153 cusum-max-deviation: max |centered cumsum|, no
 *     normalization; KPSS uses INTEGRATED squared partial sums divided
 *     by the long-run variance. CUSUM is a sup norm; KPSS is an L2
 *     norm with HAC scaling.
 *   - mann-kendall, cox-stuart, runs-test, bartels-rank-vonneumann:
 *     trend / randomness tests on pairwise/sign relationships, not on
 *     long-run-variance-normalized partial sums.
 *   - autocorrelation-lag1/lag7, kendall/spearman autocorr, ljung-box-q:
 *     point-/global-serial-correlation summaries; KPSS uses the WHOLE
 *     autocovariance spectrum truncated and Bartlett-tapered to L lags
 *     to construct the variance scale, then tests a *different*
 *     hypothesis (stationarity, not serial-uncorrelated-ness).
 *   - dfa-alpha, hurst-rs: long-memory exponents; KPSS critical values
 *     and statistic sit in a finite-sample stationary-vs-unit-root
 *     framework with concrete cutoffs, not a scaling exponent.
 *   - allan-deviation, hampel-outlier-count: variance / point-outlier
 *     summaries, no partial-sum integration, no long-run variance.
 *
 * Knobs:
 *   - `minDays` (default 8): n must be >= 8 for the Schwert bandwidth
 *     rule to give L >= 1 with non-degenerate HAC variance.
 *   - `top` (default 0): display cap.
 *   - `sort`: tokens|eta|bandwidth|lrvariance|ndays|verdict.
 *
 *   `verdict` sort orders categorically:
 *   strongly-nonstationary > nonstationary > borderline > stationary > flat.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export type DailyTokenKpssStationaritySortKey =
  | 'tokens'
  | 'eta'
  | 'bandwidth'
  | 'lrvariance'
  | 'ndays'
  | 'verdict'
  | 'hacratio'
  | 'papprox';

export type KpssVerdict =
  | 'stationary'
  | 'borderline'
  | 'nonstationary'
  | 'strongly-nonstationary'
  | 'flat';

export interface DailyTokenKpssStationarityOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Minimum gap-filled tenure length (days). Must be >= 8. Default 8. */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  sort?: DailyTokenKpssStationaritySortKey;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenKpssStationaritySourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nFilledDays: number;
  /** KPSS eta statistic. >= 0. */
  eta: number;
  /** Schwert bandwidth L = floor(4 * (n/100)^0.25). >= 1 when n >= 8. */
  bandwidth: number;
  /** Bartlett-HAC long-run variance estimate. > 0 when not flat. */
  lrVariance: number;
  /** Population variance gamma[0] = sum e^2 / n (no HAC correction). */
  gammaZero: number;
  /** Categorical verdict at standard KPSS-Table-1 (level) cutoffs. */
  verdict: KpssVerdict;
  /** lrVariance / gammaZero. >1 = positive serial dep; <1 = negative. */
  hacInflationRatio: number;
  /** Approximate upper-tail p-value via 4-anchor interpolation. */
  pApprox: number;
  /** True iff series has zero variance — KPSS undefined. */
  flat: boolean;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenKpssStationarityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: DailyTokenKpssStationaritySortKey;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenKpssStationaritySourceRow[];
}

export interface KpssSummary {
  eta: number;
  bandwidth: number;
  lrVariance: number;
  gammaZero: number;
  verdict: KpssVerdict;
  hacInflationRatio: number;
  pApprox: number;
  flat: boolean;
}

const KPSS_CRIT_10 = 0.347;
const KPSS_CRIT_5 = 0.463;
const KPSS_CRIT_25 = 0.574;
const KPSS_CRIT_1 = 0.739;

const P_LEVELS: readonly number[] = [0.1, 0.05, 0.025, 0.01];
const ETA_ANCHORS: readonly number[] = [
  KPSS_CRIT_10,
  KPSS_CRIT_5,
  KPSS_CRIT_25,
  KPSS_CRIT_1,
];

/**
 * 4-anchor log-linear interpolation/extrapolation of the upper-tail
 * KPSS p-value at the published Table-1 (level model) critical values.
 *
 *   eta <= 0.347   -> linear-in-eta from p=1 at eta=0 to p=0.10 at 0.347
 *   0.347..0.463   -> log-linear in p between 0.10 and 0.05
 *   0.463..0.574   -> log-linear in p between 0.05 and 0.025
 *   0.574..0.739   -> log-linear in p between 0.025 and 0.01
 *   eta >  0.739   -> log-linear extrapolation using last (eta, p) pair,
 *                     pinned at min p = 1e-4
 *
 * Diagnostic only. The KPSS asymptotic null is a Brownian-bridge L2
 * functional; this anchored interpolation is faithful at the four
 * tabulated points and well-behaved between them, but should not be
 * over-interpreted in deep tails.
 */
export function kpssPApprox(eta: number): number {
  if (!Number.isFinite(eta) || eta <= 0) return 0.99;
  // Below the 10% anchor: linear in eta from (0, 1) to (KPSS_CRIT_10, 0.10).
  if (eta <= ETA_ANCHORS[0]!) {
    const slope = (1 - P_LEVELS[0]!) / ETA_ANCHORS[0]!;
    const p = 1 - slope * eta;
    return Math.min(0.99, Math.max(P_LEVELS[0]!, p));
  }
  // Between consecutive anchors: log-linear in p.
  for (let i = 0; i < ETA_ANCHORS.length - 1; i++) {
    const e0 = ETA_ANCHORS[i]!;
    const e1 = ETA_ANCHORS[i + 1]!;
    if (eta <= e1) {
      const t = (eta - e0) / (e1 - e0);
      const lp = Math.log(P_LEVELS[i]!) + t * (Math.log(P_LEVELS[i + 1]!) - Math.log(P_LEVELS[i]!));
      return Math.exp(lp);
    }
  }
  // Above the 1% anchor: extrapolate using the slope of the last segment.
  const eA = ETA_ANCHORS[ETA_ANCHORS.length - 2]!;
  const eB = ETA_ANCHORS[ETA_ANCHORS.length - 1]!;
  const pA = P_LEVELS[P_LEVELS.length - 2]!;
  const pB = P_LEVELS[P_LEVELS.length - 1]!;
  const slope = (Math.log(pB) - Math.log(pA)) / (eB - eA);
  const lp = Math.log(pB) + slope * (eta - eB);
  return Math.max(1e-4, Math.exp(lp));
}

export function kpssVerdict(eta: number, flat: boolean): KpssVerdict {
  if (flat) return 'flat';
  if (eta >= KPSS_CRIT_1) return 'strongly-nonstationary';
  if (eta >= KPSS_CRIT_5) return 'nonstationary';
  if (eta >= KPSS_CRIT_10) return 'borderline';
  return 'stationary';
}

/** Schwert (1989) bandwidth rule. Returns max(1, floor(4 * (n/100)^0.25)). */
export function schwertBandwidth(n: number): number {
  if (n < 2) return 0;
  const raw = Math.floor(4 * Math.pow(n / 100, 0.25));
  return Math.max(1, Math.min(raw, n - 1));
}

/**
 * Pure KPSS level-stationarity summary on a real-valued series of
 * length n. Returns `flat` true when n < 2 or sample variance is 0.
 */
export function kpssSummary(values: number[]): KpssSummary {
  const n = values.length;
  if (n < 2) {
    return {
      eta: 0,
      bandwidth: 0,
      lrVariance: 0,
      gammaZero: 0,
      verdict: 'flat',
      hacInflationRatio: 1,
      pApprox: 0.99,
      flat: true,
    };
  }
  let mu = 0;
  for (let i = 0; i < n; i++) mu += values[i]!;
  mu /= n;

  const e: number[] = new Array(n);
  let gamma0 = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - mu;
    e[i] = d;
    gamma0 += d * d;
  }
  gamma0 /= n;
  if (gamma0 === 0 || !Number.isFinite(gamma0)) {
    return {
      eta: 0,
      bandwidth: 0,
      lrVariance: 0,
      gammaZero: 0,
      verdict: 'flat',
      hacInflationRatio: 1,
      pApprox: 0.99,
      flat: true,
    };
  }

  const L = schwertBandwidth(n);
  // Bartlett-kernel HAC long-run variance.
  let lrv = gamma0;
  for (let h = 1; h <= L; h++) {
    let acc = 0;
    for (let i = h; i < n; i++) acc += e[i]! * e[i - h]!;
    const gammaH = acc / n;
    const w = 1 - h / (L + 1);
    lrv += 2 * w * gammaH;
  }
  // Numerical floor: Bartlett kernel is positive semi-definite so lrv
  // should be >= 0 in exact arithmetic. Floating-point noise can push
  // borderline-flat constant-mean series slightly negative; clamp.
  if (lrv <= 0 || !Number.isFinite(lrv)) {
    // Degenerate HAC — fall back to gamma0 to avoid a divide-by-zero
    // and surface eta in the natural i.i.d.-Buishand limit (not
    // mathematically KPSS, but a meaningful diagnostic).
    lrv = gamma0;
  }

  // Partial-sum-squared accumulator.
  let cum = 0;
  let psq = 0;
  for (let t = 0; t < n; t++) {
    cum += e[t]!;
    psq += cum * cum;
  }
  const eta = psq / (n * n * lrv);
  const flat = false;
  return {
    eta,
    bandwidth: L,
    lrVariance: lrv,
    gammaZero: gamma0,
    verdict: kpssVerdict(eta, flat),
    hacInflationRatio: lrv / gamma0,
    pApprox: kpssPApprox(eta),
    flat,
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

const SORT_KEYS: DailyTokenKpssStationaritySortKey[] = [
  'tokens',
  'eta',
  'bandwidth',
  'lrvariance',
  'ndays',
  'verdict',
  'hacratio',
  'papprox',
];

const VERDICT_RANK: Record<KpssVerdict, number> = {
  'strongly-nonstationary': 4,
  nonstationary: 3,
  borderline: 2,
  stationary: 1,
  flat: 0,
};

export function buildDailyTokenKpssStationarity(
  queue: QueueLine[],
  opts: DailyTokenKpssStationarityOptions = {},
): DailyTokenKpssStationarityReport {
  const minDays = opts.minDays ?? 8;
  if (!Number.isInteger(minDays) || minDays < 8) {
    throw new Error(`minDays must be an integer >= 8 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (!SORT_KEYS.includes(sort)) {
    throw new Error(
      `sort must be one of ${SORT_KEYS.join('|')} (got ${opts.sort})`,
    );
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
  const rows: DailyTokenKpssStationaritySourceRow[] = [];
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

    const summary = kpssSummary(filled);
    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      eta: summary.eta,
      bandwidth: summary.bandwidth,
      lrVariance: summary.lrVariance,
      gammaZero: summary.gammaZero,
      verdict: summary.verdict,
      hacInflationRatio: summary.hacInflationRatio,
      pApprox: summary.pApprox,
      flat: summary.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'eta':
        primary = b.eta - a.eta;
        break;
      case 'bandwidth':
        primary = b.bandwidth - a.bandwidth;
        break;
      case 'lrvariance':
        primary = b.lrVariance - a.lrVariance;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
        break;
      case 'verdict':
        primary = VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict];
        break;
      case 'hacratio':
        primary = b.hacInflationRatio - a.hacInflationRatio;
        break;
      case 'papprox':
        // Smaller p first (most significant rejection).
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
