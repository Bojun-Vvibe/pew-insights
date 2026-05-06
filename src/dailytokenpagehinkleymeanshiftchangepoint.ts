/**
 * daily-token-page-hinkley-mean-shift-changepoint:
 * per-source PAGE-HINKLEY (PH) ONLINE / SEQUENTIAL MEAN-SHIFT
 * detector applied retrospectively to the gap-filled daily
 * total_tokens series.
 *
 * TWO-HUNDRED-AND-THIRTY-SECOND cross-source axis (axis-232).
 *
 * Mechanism. Page (1954) *Biometrika* 41:100-115 introduced
 * the cumulative-sum chart; Hinkley (1971) *Biometrika*
 * 58:509-523 derived the SEQUENTIAL TEST that decides on
 * a SHIFT IN THE MEAN of an INDEPENDENT bounded sequence
 * by comparing a one-sided cumulative deviation to a
 * threshold. The classical PAGE-HINKLEY one-sided UPSHIFT
 * statistic on a stream {x_t}_{t>=1} with running mean
 * mHat_t = (1/t) sum_{s<=t} x_s and a tolerance delta is
 *
 *   U_t = sum_{s<=t} (x_s - mHat_s - delta)             (1)
 *   m_t = min_{s<=t} U_s                                (2)
 *   PH_t = U_t - m_t                                    (3)
 *
 * (the matching DOWNSHIFT statistic flips signs:
 *   D_t = sum_{s<=t} (mHat_s - x_s - delta);  M_t = min D_s;
 *   PH^-_t = D_t - M_t.)
 *
 * An ALARM is raised at the first t with PH_t > lambda
 * (or PH^-_t > lambda); the change point estimate is the
 * argmin time s* attaining m_{tAlarm} (Hinkley 1971 §3 -
 * the "last reset"). Because we operate in a BATCH /
 * RETROSPECTIVE setting, we run BOTH directions over the
 * full series and report
 *
 *   phMaxUp   = max_t PH_t                              (4)
 *   phMaxDown = max_t PH^-_t                            (5)
 *   phMax     = max(phMaxUp, phMaxDown)                 (6)
 *   tauStar   = argmin time of m at the dominant arm    (7)
 *   direction = 'up' if phMaxUp >= phMaxDown else 'down'(8)
 *
 * The TOLERANCE delta is the user's allowed-drift slack
 * (units of x_t). Following Mouss et al. (2004) we expose
 * delta as a MULTIPLE of the IQR of x for scale invariance:
 * delta = deltaScale * IQR(x), with deltaScale default 0.005
 * (very small, since for a TRUE level shift PH grows
 * linearly in t and the test is robust to the exact
 * choice). The DECISION THRESHOLD lambda is exposed as a
 * MULTIPLE of total mass: lambda = lambdaScale * IQR(x) *
 * sqrt(N), default lambdaScale = 1.0 (rule-of-thumb
 * Gama-Castillo 2007 §4).
 *
 * Verdict ladder. Because Page-Hinkley is SEQUENTIAL the
 * null distribution depends on the stopping rule; rather
 * than cite an asymptotic constant we report a PEAK-RATIO
 *
 *   peakRatio = phMax / (lambdaScale * IQR(x) * sqrt(N))
 *
 * which is 1.0 at the threshold by construction.
 *
 *   verdict = no-shift     if peakRatio < 0.50
 *           = borderline   if peakRatio < 1.00
 *           = shift        if peakRatio < 2.00
 *           = strong-shift otherwise
 *
 * (Cutoffs surfaced verbatim so downstream consumers can
 * rescore. They are NOT p-values.)
 *
 * Output schema (per-source row):
 *
 *   - phMaxUp, phMaxDown, phMax: (4)-(6).
 *   - direction: (8).
 *   - tauStar: argmin time at dominant arm.
 *   - tauStarDay: ISO YYYY-MM-DD.
 *   - meanLeft, meanRight: sample mean over [0..tauStar) and
 *     [tauStar..N).
 *   - meanGap: meanRight - meanLeft.
 *   - lambdaUsed, deltaUsed: numeric values fed into PH.
 *   - peakRatio: (4)/lambdaUsed.
 *   - verdict: ladder above.
 *
 * STRUCTURAL ORTHOGONALITY (axis-232 vs axes 181-231).
 *
 * Of the prior 231 cross-source axes, NONE is a SEQUENTIAL,
 * ONE-SIDED, RUNNING-MEAN-DEVIATION CUSUM with a self-
 * resetting MIN reference. Page-Hinkley is structurally
 * orthogonal along five independent dimensions:
 *
 *   1. SEQUENTIAL-WITH-RESET vs FIXED-WINDOW. The PH
 *      statistic re-zeros at every new minimum of U_t,
 *      i.e. it tracks the LAST reset of the mean. None of
 *      the axes 221-231 (Alexandersson, Lombard, Inclan-
 *      Tiao, Killick-Pelt PELT, Fryzlewicz WBS, Matteson
 *      E-divisive, Adams-MacKay BOCPD, Moskvina-Zhigljavsky
 *      SSA, Picard-Aue spectral CUSUM, Keriven-Garreau-
 *      Poli NEWMA-RFF, Inoue empirical-copula) carry a
 *      RESETTING reference: they are either fixed-window
 *      (Inclan-Tiao ICSS), DP segmentation (PELT, WBS),
 *      Bayesian posterior (BOCPD), subspace (SSA),
 *      frequency-domain (Picard-Aue), kernel-mean (Keriven),
 *      or copula (Inoue). Resetting min/max references give
 *      PH a UNIQUE invariance to the LOCATION of the change
 *      within the window.
 *
 *   2. ONE-SIDED ARM SEPARATION. PH separately tracks UP
 *      and DOWN arms with the dominant arm reported. None
 *      of axes 153-231 expose a SIGNED arm comparison
 *      (axis-153 CUSUM-max-deviation reports max(|U_t|)
 *      with no arm decomposition; axis-225 WBS reports
 *      magnitude; axis-227 BOCPD reports posterior with no
 *      sign).
 *
 *   3. RUNNING-MEAN REFERENCE. PH subtracts the RUNNING
 *      mean mHat_s in (1) - the reference is itself a
 *      stochastic process. CUSUM (axis-153) and Inclan-Tiao
 *      (axis-223) subtract the FULL-SAMPLE mean (a fixed
 *      target). This gives PH a different bias profile in
 *      the presence of multiple shifts: the running mean
 *      smoothly tracks the new level after a shift, which
 *      ATTENUATES detection of subsequent shifts (a
 *      well-known "detection-deafness" property absent in
 *      fixed-mean axes).
 *
 *   4. TOLERANCE-DELTA SLACK. PH carries an explicit
 *      deadband delta (typical of EWMA/CUSUM control charts)
 *      that none of axes 153, 221-231 expose: those axes
 *      detect ANY deviation; PH DEMANDS a deviation
 *      exceeding delta per step. This makes PH robust to
 *      slow random-walk drift while remaining sharp to
 *      abrupt shifts.
 *
 *   5. ALARM-BASED DECISION GEOMETRY. PH's verdict is
 *      driven by the maximum of a self-resetting CUSUM
 *      compared to a sqrt(N)-scaled threshold - a
 *      Gauss-Markov / Brownian-motion-crossing geometry.
 *      Axes 221-231 use chi-square / F / Schwarz / Bayes
 *      factor / Kolmogorov / Hilbert-Schmidt / sup-deviation
 *      geometries respectively. PH's BROWNIAN-CROSSING
 *      decision surface is structurally new.
 *
 * Refs:
 *   Page, E. S., 1954, "Continuous inspection schemes",
 *     Biometrika 41(1/2):100-115.
 *   Hinkley, D. V., 1971, "Inference about the change-point
 *     from cumulative sum tests", Biometrika 58(3):509-523.
 *   Mouss, H., Mouss, D., Mouss, N. & Sefouhi, L., 2004,
 *     "Test of Page-Hinkley, an approach for fault detection
 *     in an agro-alimentary production system", Proc. 5th
 *     Asian Control Conf. 815-818.
 *   Gama, J., Medas, P., Castillo, G. & Rodrigues, P., 2004,
 *     "Learning with drift detection", SBIA 286-295.
 *
 * Class anchor: PEAK = lambdaScale * IQR(x) * sqrt(N).
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. NUMERIC HELPERS
// =========================================================

/** Sorted-copy ascending. */
function sortedAsc(xs: readonly number[]): number[] {
  const c = xs.slice();
  c.sort((a, b) => a - b);
  return c;
}

/** Linear-interpolated quantile q in [0,1]. */
export function quantile(xsSorted: readonly number[], q: number): number {
  const n = xsSorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return xsSorted[0]!;
  if (q <= 0) return xsSorted[0]!;
  if (q >= 1) return xsSorted[n - 1]!;
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return xsSorted[lo]! * (1 - frac) + xsSorted[hi]! * frac;
}

/** IQR = Q3 - Q1 with linear interpolation; returns NaN for n < 2. */
export function iqr(xs: readonly number[]): number {
  if (xs.length < 2) return Number.NaN;
  const s = sortedAsc(xs);
  return quantile(s, 0.75) - quantile(s, 0.25);
}

// =========================================================
// SECTION 2. PAGE-HINKLEY CORE
// =========================================================

export interface PageHinkleyArmResult {
  /** PH curve PH_t for t = 0..N-1 (one arm). */
  phCurve: number[];
  /** max_t PH_t. */
  phMax: number;
  /** Argmin time s* of running min m_{tArgMax} where tArgMax = argmax PH_t. */
  tauStar: number;
}

/**
 * Run a single-arm Page-Hinkley scan ('up' arm: detect mean increases).
 *
 * For 'up' direction: e_t = x_t - mHat_t - delta; U_t = cumsum(e); m_t = running min(U); PH_t = U_t - m_t.
 * For 'down' direction: e_t = mHat_t - x_t - delta; same recursion.
 *
 * tauStar is computed by: identify tArgMax = argmax PH_t, then
 * find argmin of U_s for s in [0..tArgMax]; report that s as the
 * shift-onset estimate ("last reset").
 */
export function pageHinkleyArm(
  x: readonly number[],
  delta: number,
  direction: 'up' | 'down',
): PageHinkleyArmResult {
  const N = x.length;
  if (N < 2) throw new Error(`pageHinkleyArm requires N >= 2 (got ${N})`);
  if (!Number.isFinite(delta) || delta < 0) {
    throw new Error(`delta must be non-negative finite (got ${delta})`);
  }
  const phCurve = new Array<number>(N);
  const uCurve = new Array<number>(N);
  let runSum = 0;
  let u = 0;
  let mMin = 0;
  let phMax = 0;
  let tArgMax = 0;
  for (let t = 0; t < N; t += 1) {
    const xt = x[t]!;
    runSum += xt;
    const mHat = runSum / (t + 1);
    const dev = direction === 'up' ? xt - mHat - delta : mHat - xt - delta;
    u += dev;
    uCurve[t] = u;
    if (u < mMin) mMin = u;
    const ph = u - mMin;
    phCurve[t] = ph;
    if (ph > phMax) {
      phMax = ph;
      tArgMax = t;
    }
  }
  // tauStar = argmin U_s over s in [0..tArgMax], tiebreak to LAST (most
  // recent) min — Hinkley 1971's "last reset" rule, which puts tauStar at
  // the moment the new regime begins rather than at t=0 when uCurve[0]=0.
  let tauStar = 0;
  let minU = uCurve[0]!;
  for (let s = 1; s <= tArgMax; s += 1) {
    if (uCurve[s]! <= minU) {
      minU = uCurve[s]!;
      tauStar = s;
    }
  }
  return { phCurve, phMax, tauStar };
}

export interface PageHinkleyScanResult {
  phMaxUp: number;
  phMaxDown: number;
  phMax: number;
  direction: 'up' | 'down' | 'flat';
  tauStar: number;
  /** delta value actually used. */
  deltaUsed: number;
  /** lambda decision threshold actually used. */
  lambdaUsed: number;
  /** phMax / lambdaUsed. */
  peakRatio: number;
}

export interface PageHinkleyScanOptions {
  /** delta = deltaScale * IQR(x). Default 0.005. Must be >= 0. */
  deltaScale?: number;
  /** lambda = lambdaScale * IQR(x) * sqrt(N). Default 1.0. Must be > 0. */
  lambdaScale?: number;
}

export function pageHinkleyScan(
  x: readonly number[],
  opts: PageHinkleyScanOptions = {},
): PageHinkleyScanResult {
  const N = x.length;
  if (N < 5) throw new Error(`pageHinkleyScan requires N >= 5 (got ${N})`);
  const deltaScale = opts.deltaScale ?? 0.005;
  const lambdaScale = opts.lambdaScale ?? 1.0;
  if (!Number.isFinite(deltaScale) || deltaScale < 0) {
    throw new Error(`deltaScale must be >= 0 finite (got ${deltaScale})`);
  }
  if (!Number.isFinite(lambdaScale) || !(lambdaScale > 0)) {
    throw new Error(`lambdaScale must be > 0 finite (got ${lambdaScale})`);
  }
  const xIqr = iqr(x);
  if (!Number.isFinite(xIqr) || xIqr <= 0) {
    // Series with IQR == 0 is degenerate (constant or near-constant),
    // PH cannot detect a level shift. Caller should drop these.
    throw new Error(`IQR is non-positive or non-finite (got ${xIqr})`);
  }
  const deltaUsed = deltaScale * xIqr;
  const lambdaUsed = lambdaScale * xIqr * Math.sqrt(N);
  const up = pageHinkleyArm(x, deltaUsed, 'up');
  const dn = pageHinkleyArm(x, deltaUsed, 'down');
  let direction: 'up' | 'down' | 'flat';
  let tauStar: number;
  let phMax: number;
  if (up.phMax === 0 && dn.phMax === 0) {
    direction = 'flat';
    tauStar = 0;
    phMax = 0;
  } else if (up.phMax >= dn.phMax) {
    direction = 'up';
    tauStar = up.tauStar;
    phMax = up.phMax;
  } else {
    direction = 'down';
    tauStar = dn.tauStar;
    phMax = dn.phMax;
  }
  const peakRatio = phMax / lambdaUsed;
  return {
    phMaxUp: up.phMax,
    phMaxDown: dn.phMax,
    phMax,
    direction,
    tauStar,
    deltaUsed,
    lambdaUsed,
    peakRatio,
  };
}

/** Verdict ladder per peakRatio. */
export function pageHinkleyVerdict(
  peakRatio: number,
): 'no-shift' | 'borderline' | 'shift' | 'strong-shift' {
  if (Number.isNaN(peakRatio)) return 'no-shift';
  if (peakRatio === Infinity) return 'strong-shift';
  if (peakRatio < 0.5) return 'no-shift';
  if (peakRatio < 1.0) return 'borderline';
  if (peakRatio < 2.0) return 'shift';
  return 'strong-shift';
}

/**
 * Numeric stability guard. True iff peakRatio is finite, verdict is
 * shift-or-stronger, and the |meanGap| / IQR is at least epsGap.
 */
export function pageHinkleyIsSubstantiveShift(
  row: { peakRatio: number; verdict: string; meanGap: number; iqrUsed: number },
  epsGap = 0.1,
): boolean {
  if (!Number.isFinite(row.peakRatio) || !Number.isFinite(row.meanGap)) return false;
  if (row.verdict === 'no-shift' || row.verdict === 'borderline') return false;
  if (!Number.isFinite(row.iqrUsed) || row.iqrUsed <= 0) return false;
  return Math.abs(row.meanGap) / row.iqrUsed >= epsGap;
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenPageHinkleyMeanShiftChangepointSort =
  | 'phMax'
  | 'phMaxDesc'
  | 'peakRatio'
  | 'peakRatioDesc'
  | 'tauStar'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenPageHinkleyMeanShiftChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenPageHinkleyMeanShiftChangepointSort;
  /** delta = deltaScale * IQR(x). Default 0.005. */
  deltaScale?: number;
  /** lambda = lambdaScale * IQR(x) * sqrt(N). Default 1.0. */
  lambdaScale?: number;
  /** Drop rows with verdict == 'no-shift'. */
  onlyShifts?: boolean;
  generatedAt?: string;
}

export interface DailyTokenPageHinkleyMeanShiftChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  iqrUsed: number;
  deltaUsed: number;
  lambdaUsed: number;
  phMaxUp: number;
  phMaxDown: number;
  phMax: number;
  direction: 'up' | 'down' | 'flat';
  tauStar: number;
  tauStarDay: string;
  meanLeft: number;
  meanRight: number;
  meanGap: number;
  peakRatio: number;
  verdict: 'no-shift' | 'borderline' | 'shift' | 'strong-shift';
}

export interface DailyTokenPageHinkleyMeanShiftChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenPageHinkleyMeanShiftChangepointSort;
  deltaScale: number;
  lambdaScale: number;
  onlyShifts: boolean;
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
  sources: DailyTokenPageHinkleyMeanShiftChangepointSourceRow[];
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
 * Per-source pure builder. Validates options, gap-fills the daily
 * total_tokens series, runs Page-Hinkley two-arm scan, returns a
 * deterministic report.
 */
export function buildDailyTokenPageHinkleyMeanShiftChangepoint(
  queue: QueueLine[],
  opts: DailyTokenPageHinkleyMeanShiftChangepointOptions = {},
): DailyTokenPageHinkleyMeanShiftChangepointReport {
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
    throw new Error(`top must be an integer >= 0 (got ${opts.top})`);
  }
  const sort: DailyTokenPageHinkleyMeanShiftChangepointSort = opts.sort ?? 'peakRatioDesc';
  const validSorts: DailyTokenPageHinkleyMeanShiftChangepointSort[] = [
    'phMax',
    'phMaxDesc',
    'peakRatio',
    'peakRatioDesc',
    'tauStar',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const deltaScale = opts.deltaScale ?? 0.005;
  if (!Number.isFinite(deltaScale) || deltaScale < 0) {
    throw new Error(`deltaScale must be >= 0 finite (got ${opts.deltaScale})`);
  }
  const lambdaScale = opts.lambdaScale ?? 1.0;
  if (!Number.isFinite(lambdaScale) || !(lambdaScale > 0)) {
    throw new Error(`lambdaScale must be > 0 finite (got ${opts.lambdaScale})`);
  }
  const onlyShifts = opts.onlyShifts ?? false;
  if (typeof onlyShifts !== 'boolean') {
    throw new Error(`onlyShifts must be boolean (got ${opts.onlyShifts})`);
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
  const rows: DailyTokenPageHinkleyMeanShiftChangepointSourceRow[] = [];

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
    for (let i = 0; i < nTenure; i += 1) {
      const val = filled[i]!;
      if (val < mn) mn = val;
      if (val > mx) mx = val;
    }
    if (mn === mx) {
      droppedZeroVariance += 1;
      continue;
    }
    const xIqr = iqr(filled);
    if (!Number.isFinite(xIqr) || xIqr <= 0) {
      droppedZeroVariance += 1;
      continue;
    }
    let scan: PageHinkleyScanResult;
    try {
      scan = pageHinkleyScan(filled, { deltaScale, lambdaScale });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(scan.phMax) ||
      !Number.isFinite(scan.peakRatio) ||
      !Number.isFinite(scan.lambdaUsed)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    // Compute mean left / right around tauStar.
    let sumL = 0;
    let nL = scan.tauStar;
    for (let i = 0; i < scan.tauStar; i += 1) sumL += filled[i]!;
    let sumR = 0;
    let nR = nTenure - scan.tauStar;
    for (let i = scan.tauStar; i < nTenure; i += 1) sumR += filled[i]!;
    const meanLeft = nL > 0 ? sumL / nL : Number.NaN;
    const meanRight = nR > 0 ? sumR / nR : Number.NaN;
    const meanGap =
      Number.isFinite(meanLeft) && Number.isFinite(meanRight)
        ? meanRight - meanLeft
        : Number.NaN;
    const tauStarDay = addUtcDays(acc.firstDay, scan.tauStar);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      iqrUsed: xIqr,
      deltaUsed: scan.deltaUsed,
      lambdaUsed: scan.lambdaUsed,
      phMaxUp: scan.phMaxUp,
      phMaxDown: scan.phMaxDown,
      phMax: scan.phMax,
      direction: scan.direction,
      tauStar: scan.tauStar,
      tauStarDay,
      meanLeft,
      meanRight,
      meanGap,
      peakRatio: scan.peakRatio,
      verdict: pageHinkleyVerdict(scan.peakRatio),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'phMax':
        primary = a.phMax - b.phMax;
        break;
      case 'phMaxDesc':
        primary = b.phMax - a.phMax;
        break;
      case 'peakRatio':
        primary = a.peakRatio - b.peakRatio;
        break;
      case 'peakRatioDesc':
        primary = b.peakRatio - a.peakRatio;
        break;
      case 'tauStar':
        primary = a.tauStar - b.tauStar;
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
  if (onlyShifts) {
    kept = kept.filter((r) => r.verdict !== 'no-shift');
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
    deltaScale,
    lambdaScale,
    onlyShifts,
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
