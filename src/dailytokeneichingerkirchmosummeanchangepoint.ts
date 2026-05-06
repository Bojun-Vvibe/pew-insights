/**
 * daily-token-eichinger-kirch-mosum-mean-changepoint:
 * per-source EICHINGER-KIRCH (2018) MOSUM (MOving-SUM)
 * symmetric two-sample mean-shift changepoint detector
 * applied retrospectively to the gap-filled daily total_tokens
 * series.
 *
 * TWO-HUNDRED-AND-THIRTY-THIRD cross-source axis (axis-233).
 *
 * Mechanism. Eichinger & Kirch (2018) *Bernoulli* 24(1):526-564
 * "A MOSUM procedure for the estimation of multiple random
 * change points" formalise an old idea of Husková & Slabý
 * (2001) and Bauer & Hackl (1978): rather than a sequential
 * one-sided CUSUM that resets at running minima (Page-
 * Hinkley) or a DP-segmented penalised cost (Killick PELT)
 * or a randomised-interval CUSUM (Fryzlewicz WBS), scan a
 * SYMMETRIC TWO-SAMPLE moving-window difference of means
 * across the entire series and locate ALL local maxima of
 * the absolute statistic.
 *
 * For a series x_1, ..., x_N and a bandwidth G in [1, N/2),
 * define for each midpoint k in [G, N-G] the MOSUM statistic
 *
 *   T_k(G) = sqrt(G/2) * (mR_k - mL_k) / sigmaHat              (1)
 *
 * where
 *
 *   mL_k    = (1/G) * sum_{i=k-G+1}^{k}     x_i                 (left mean)
 *   mR_k    = (1/G) * sum_{i=k+1}^{k+G}     x_i                 (right mean)
 *   sigmaHat = robust pooled scale estimator (MAD * 1.4826)
 *
 * Under H0 (no change in the mean) the absolute MOSUM
 * statistic |T_k(G)| converges to the supremum of a
 * scaled stationary Ornstein-Uhlenbeck-like Gaussian process
 * (Eichinger-Kirch 2018 Thm 2.1; Hušková-Slabý 2001 Thm 1).
 * The asymptotic 5%/1% critical values for the supremum
 * over [G, N-G] are tabulated by Hušková-Slabý (2001 Table 1)
 * and grow logarithmically in N/G:
 *
 *   c_alpha(N, G) = a(N/G) * sqrt(2 * log(N/G)) +
 *                   b(alpha) / sqrt(2 * log(N/G))               (2)
 *
 * where a(t) = sqrt(2 log log t) for the boundary correction
 * and b(0.05) ~= 1.946, b(0.01) ~= 3.000 (Hušková 1990;
 * Eichinger-Kirch 2018 §2.2). For finite samples we expose
 * the threshold as a USER-TUNABLE multiple
 *
 *   threshold(G) = thresholdScale * sqrt(2 * log(N/G))           (3)
 *
 * with thresholdScale defaulting to 1.4 (mid-way between
 * Hušková 5% and 1% asymptotic constants in standard-error
 * units) so the user can dial up/down without touching the
 * raw asymptotic table.
 *
 * MULTIPLE CHANGEPOINT LOCALISATION. Following Eichinger-
 * Kirch (2018 §3 Algorithm A) we declare a changepoint at
 * any LOCAL MAXIMUM k of |T_k(G)| satisfying both:
 *
 *   (a) |T_k(G)| > threshold(G);
 *   (b) k is a LOCAL MAX of |T| over the symmetric window
 *       [k-G, k+G] (so candidates are at least G apart, the
 *       "minimum spacing" rule of Eichinger-Kirch §3.1).
 *
 * The bandwidth G is exposed as a fraction of the series
 * length: G = max(7, floor(bandwidthFrac * N)), with
 * bandwidthFrac default 0.10 (a common rule of thumb;
 * Eichinger-Kirch §4 use 0.05-0.20 in their simulations).
 * The lower clamp at 7 ensures at least one MAD-stable
 * window even on very short series.
 *
 * BANDWIDTH ORTHOGONALITY. By construction MOSUM with
 * bandwidth G ~ 0.10 N is sensitive to changes whose
 * SEGMENT LENGTH is at least G; smaller segments are
 * smoothed away. This is FUNDAMENTALLY DIFFERENT from:
 *
 *   - Page-Hinkley (axis-232): sensitive to ANY shift
 *     once cumulative deviation exceeds lambda, with
 *     no minimum-segment-length requirement.
 *   - WBS (axis-225): random-interval CUSUM picks up
 *     SHORT segments that PELT misses.
 *   - PELT (axis-224): DP minimisation of penalised
 *     L2 cost - global, not local.
 *   - BOCPD (axis-227): online posterior on r_t with
 *     no spatial bandwidth at all.
 *
 * MOSUM occupies a UNIQUE niche: SYMMETRIC TWO-SAMPLE local
 * window mean-difference scan with a GUARANTEED MINIMUM-
 * SEPARATION between detected changepoints.
 *
 * STRUCTURAL ORTHOGONALITY (axis-233 vs axes 181-232). NONE
 * of the prior 232 cross-source axes is a SYMMETRIC ROLLING
 * TWO-SAMPLE bandwidth-G mean-difference scan with local-
 * maximum suppression. Eichinger-Kirch MOSUM is structurally
 * orthogonal along five independent dimensions:
 *
 *   1. SYMMETRIC TWO-SAMPLE WINDOW (vs ASYMMETRIC CUMULATIVE).
 *      MOSUM compares two equal-size adjacent windows
 *      [k-G+1..k] vs [k+1..k+G] at every midpoint. CUSUM-
 *      family axes (153 max-deviation, 232 Page-Hinkley)
 *      compare a CUMULATIVE prefix to a running mean - an
 *      ASYMMETRIC reference. WBS (axis-225) uses random
 *      INTERVALS [s,e] of variable length, not symmetric
 *      windows. PELT (axis-224) uses no window at all.
 *
 *   2. MULTIPLE LOCAL-MAX CHANGEPOINTS. MOSUM emits ALL
 *      local maxima of |T_k| > threshold spaced at least G
 *      apart; every prior axis emits AT MOST ONE estimate
 *      (axis-232 PH tauStar; axis-231 Inoue tauStar; axis-
 *      230 NEWMA tauStar; axis-229xaxis-228 spectral-CUSUM
 *      single tauStar) OR is purely-magnitude (axis-153
 *      CUSUM-max-deviation). The exception is axis-225 WBS
 *      (multiple) and axis-224 PELT (multiple) - but they
 *      use DP penalisation and random intervals respectively,
 *      not local-max suppression on a deterministic rolling
 *      scan. Axis-227 BOCPD reports posterior, not discrete
 *      multiple CPs.
 *
 *   3. BANDWIDTH-G MIN-SEGMENT-LENGTH GUARANTEE. By
 *      construction MOSUM cannot emit two CPs closer than G.
 *      No prior axis has this property: PELT, WBS, BOCPD
 *      can all emit arbitrarily close CPs.
 *
 *   4. ROBUST MAD SCALE. MOSUM divides by sigmaHat = 1.4826
 *      * MAD(diffs), making it robust to heavy-tailed
 *      contamination. PH (axis-232) and NEWMA (axis-230)
 *      use IQR-scaled thresholds but apply them to the RAW
 *      stream, not to a centred-difference. ICSS (axis-223)
 *      and Lombard (axis-222) use sample variance.
 *
 *   5. ORNSTEIN-UHLENBECK SUPREMUM ASYMPTOTICS. The
 *      asymptotic null distribution is sup of an OU-like
 *      Gaussian process (Hušková-Slabý 2001) with log-N/G
 *      tail correction (3). This is geometrically distinct
 *      from Brownian-bridge (axis-153 CUSUM, axis-221
 *      Alexandersson SNHT), Brownian-motion-crossing (axis-
 *      232 PH), Schwarz/MDL penalty (axis-224 PELT), Bayes
 *      factor (axis-227 BOCPD), Hilbert-Schmidt RKHS (axis-
 *      230 NEWMA), and copula sup-deviation (axis-231 Inoue)
 *      asymptotics.
 *
 * NUMERICAL NOTE. The naive O(N*G) implementation of (1) is
 * fine for our N <= a few thousand. We use a ROLLING-SUM
 * O(N) implementation: maintain leftSum, rightSum and update
 * incrementally as k advances by 1.
 *
 * Output schema (per-source row):
 *
 *   - mosumMax: max_k |T_k(G)|.
 *   - mosumArgmax: argmax k.
 *   - mosumArgmaxDay: ISO YYYY-MM-DD.
 *   - mChangepoints: number of local-max CPs surviving the
 *     threshold-and-spacing rule.
 *   - tauStarDays: list of CP days (chronological).
 *   - bandwidthG: G actually used.
 *   - thresholdUsed: from (3).
 *   - peakRatio: mosumMax / thresholdUsed.
 *   - sigmaHatUsed: robust scale.
 *   - verdict: peakRatio<0.50 no-shift, <1.00 borderline,
 *     <2.00 shift, otherwise strong-shift.
 *
 * Refs:
 *   Bauer, P. & Hackl, P., 1978, "The use of MOSUMS for
 *     quality control", Technometrics 20(4):431-436.
 *   Hušková, M., 1990, "Asymptotic d-optimality in
 *     change-point problems", J. Statist. Plann. Inference
 *     25:333-346.
 *   Hušková, M. & Slabý, A., 2001, "Permutation tests for
 *     multiple changes", Kybernetika 37(5):605-622.
 *   Eichinger, B. & Kirch, C., 2018, "A MOSUM procedure for
 *     the estimation of multiple random change points",
 *     Bernoulli 24(1):526-564.
 *
 * Class anchor: PEAK = thresholdScale * sqrt(2 * log(N/G))
 * is unity in peakRatio units.
 */

import type { QueueLine } from './types.js';

// =========================================================
// SECTION 1. NUMERIC HELPERS
// =========================================================

function sortedAsc(xs: readonly number[]): number[] {
  const c = xs.slice();
  c.sort((a, b) => a - b);
  return c;
}

/** Median of a numeric vector via ascending sort. */
export function median(xs: readonly number[]): number {
  const n = xs.length;
  if (n === 0) return Number.NaN;
  const s = sortedAsc(xs);
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid]! : 0.5 * (s[mid - 1]! + s[mid]!);
}

/**
 * Median Absolute Deviation = median(|x - median(x)|), scaled by
 * 1.4826 to be a consistent estimator of sigma under Gaussianity.
 */
export function madScale(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return Number.NaN;
  const m = median(xs);
  const dev = new Array<number>(n);
  for (let i = 0; i < n; i += 1) dev[i] = Math.abs(xs[i]! - m);
  return 1.4826 * median(dev);
}

// =========================================================
// SECTION 2. MOSUM CORE
// =========================================================

export interface MosumScanResult {
  /** |T_k(G)| for k in [G, N-G]; length = N - 2G + 1. */
  absMosum: number[];
  /** max_k |T_k(G)|. */
  mosumMax: number;
  /** argmax k (in original-series index space, i.e. midpoint). */
  mosumArgmax: number;
  /** Bandwidth G actually used. */
  bandwidthG: number;
  /** Robust pooled scale estimator (1.4826 * MAD of first differences). */
  sigmaHatUsed: number;
  /** thresholdScale * sqrt(2 * log(N/G)). */
  thresholdUsed: number;
  /** mosumMax / thresholdUsed. */
  peakRatio: number;
  /**
   * Local-max CPs in original-series index space, surviving:
   *   (a) |T_k| > thresholdUsed
   *   (b) local max over symmetric window [k-G, k+G]
   * Sorted ascending.
   */
  changepoints: number[];
}

export interface MosumScanOptions {
  /**
   * G = max(7, floor(bandwidthFrac * N)). Default 0.10. Must be in (0, 0.5).
   */
  bandwidthFrac?: number;
  /**
   * threshold = thresholdScale * sqrt(2 * log(N / G)). Default 1.4.
   * Must be > 0. Hušková-Slabý 2001 5% asymptotic ~= 1.0; 1% ~= 1.5
   * (in standard-error units after the log-correction).
   */
  thresholdScale?: number;
}

export function mosumScan(
  x: readonly number[],
  opts: MosumScanOptions = {},
): MosumScanResult {
  const N = x.length;
  if (N < 14) throw new Error(`mosumScan requires N >= 14 (got ${N})`);
  const bandwidthFrac = opts.bandwidthFrac ?? 0.1;
  const thresholdScale = opts.thresholdScale ?? 1.4;
  if (!Number.isFinite(bandwidthFrac) || !(bandwidthFrac > 0) || bandwidthFrac >= 0.5) {
    throw new Error(
      `bandwidthFrac must be in (0, 0.5) (got ${bandwidthFrac})`,
    );
  }
  if (!Number.isFinite(thresholdScale) || !(thresholdScale > 0)) {
    throw new Error(`thresholdScale must be > 0 finite (got ${thresholdScale})`);
  }
  const G = Math.max(7, Math.floor(bandwidthFrac * N));
  if (2 * G >= N) {
    throw new Error(
      `bandwidth G=${G} too large for N=${N} (require 2G < N)`,
    );
  }
  // Robust scale via MAD of first differences (this is the
  // standard MOSUM scale; differencing kills mean drift).
  const diffs = new Array<number>(N - 1);
  for (let i = 0; i < N - 1; i += 1) diffs[i] = x[i + 1]! - x[i]!;
  // Diff is var 2*sigma^2 under iid; rescale by 1/sqrt(2).
  let sigmaHatUsed = madScale(diffs) / Math.SQRT2;
  if (!Number.isFinite(sigmaHatUsed) || sigmaHatUsed <= 0) {
    // Fall back to MAD of raw series (handles zero-diff streaks
    // such as piecewise-constant test series where median diff = 0).
    sigmaHatUsed = madScale(x);
  }
  if (!Number.isFinite(sigmaHatUsed) || sigmaHatUsed <= 0) {
    // Final fallback: standard deviation. Only fails on truly
    // constant series, which the caller should have filtered as
    // zero-variance upstream.
    let sum = 0;
    for (const v of x) sum += v;
    const mean = sum / N;
    let sq = 0;
    for (const v of x) sq += (v - mean) * (v - mean);
    sigmaHatUsed = Math.sqrt(sq / Math.max(1, N - 1));
  }
  if (!Number.isFinite(sigmaHatUsed) || sigmaHatUsed <= 0) {
    throw new Error(
      `MAD-based sigma is non-positive (degenerate series); got ${sigmaHatUsed}`,
    );
  }
  const thresholdUsed = thresholdScale * Math.sqrt(2 * Math.log(N / G));
  // Rolling-sum O(N) MOSUM scan over k in [G, N-G].
  // mL_k = mean(x[k-G+1..k]) ; mR_k = mean(x[k+1..k+G]).
  // For k = G (first valid midpoint, 0-indexed):
  //   left window  = x[1..G]
  //   right window = x[G+1..2G]
  // We index k from G up to N-G inclusive in 0-indexed terms,
  // which gives N - 2G + 1 windows (matches absMosum length).
  let leftSum = 0;
  let rightSum = 0;
  for (let i = 1; i <= G; i += 1) leftSum += x[i]!;
  for (let i = G + 1; i <= 2 * G; i += 1) rightSum += x[i]!;
  const M = N - 2 * G + 1;
  const absMosum = new Array<number>(M);
  let mosumMax = -Infinity;
  let mosumArgmax = G;
  // 0-indexed k starts at G. Convert: when iter j = 0 .. M-1, k = G + j.
  // The left window is x[k-G+1 .. k] inclusive.
  // The right window is x[k+1 .. k+G] inclusive.
  // For j = 0 we already loaded:
  //   leftSum  = x[1..G]  -- correct since k = G implies left = x[1..G]
  //   rightSum = x[G+1..2G] -- correct since k = G implies right = x[G+1..2G]
  for (let j = 0; j < M; j += 1) {
    const mL = leftSum / G;
    const mR = rightSum / G;
    const tk = (Math.sqrt(G / 2) * (mR - mL)) / sigmaHatUsed;
    const abs = Math.abs(tk);
    absMosum[j] = abs;
    if (abs > mosumMax) {
      mosumMax = abs;
      mosumArgmax = G + j;
    }
    // Slide window forward: k -> k+1.
    if (j < M - 1) {
      const k = G + j;
      // Drop x[k-G+1] from left, add x[k+1] to left.
      leftSum -= x[k - G + 1]!;
      leftSum += x[k + 1]!;
      // Drop x[k+1] from right, add x[k+G+1] to right.
      rightSum -= x[k + 1]!;
      rightSum += x[k + G + 1]!;
    }
  }
  // Local-max CPs: scan absMosum, accept j if abs > threshold AND
  // it's the max within +/- G in midpoint-index space.
  // (Eichinger-Kirch §3 Algorithm A.)
  const changepoints: number[] = [];
  for (let j = 0; j < M; j += 1) {
    const abs = absMosum[j]!;
    if (abs <= thresholdUsed) continue;
    // Check local-max property within +/- G in j-space.
    let isLocalMax = true;
    const lo = Math.max(0, j - G);
    const hi = Math.min(M - 1, j + G);
    for (let l = lo; l <= hi; l += 1) {
      if (l === j) continue;
      if (absMosum[l]! > abs) {
        isLocalMax = false;
        break;
      }
    }
    if (isLocalMax) changepoints.push(G + j);
  }
  // Enforce strict G-spacing: greedy pick by descending magnitude.
  // (Two strict ties within G of each other can both pass the local-max
  // check above; Eichinger-Kirch §3 calls for explicit suppression.)
  if (changepoints.length > 1) {
    const ranked = changepoints
      .map((k) => ({ k, abs: absMosum[k - G]! }))
      .sort((a, b) => b.abs - a.abs);
    const accepted: number[] = [];
    for (const cand of ranked) {
      let ok = true;
      for (const a of accepted) {
        if (Math.abs(cand.k - a) < G) {
          ok = false;
          break;
        }
      }
      if (ok) accepted.push(cand.k);
    }
    accepted.sort((a, b) => a - b);
    changepoints.length = 0;
    changepoints.push(...accepted);
  }
  const peakRatio = mosumMax / thresholdUsed;
  return {
    absMosum,
    mosumMax,
    mosumArgmax,
    bandwidthG: G,
    sigmaHatUsed,
    thresholdUsed,
    peakRatio,
    changepoints,
  };
}

export function mosumVerdict(
  peakRatio: number,
): 'no-shift' | 'borderline' | 'shift' | 'strong-shift' {
  if (Number.isNaN(peakRatio)) return 'no-shift';
  if (peakRatio === Infinity) return 'strong-shift';
  if (peakRatio < 0.5) return 'no-shift';
  if (peakRatio < 1.0) return 'borderline';
  if (peakRatio < 2.0) return 'shift';
  return 'strong-shift';
}

// =========================================================
// SECTION 3. PER-SOURCE BUILDER
// =========================================================

export type DailyTokenEichingerKirchMosumMeanChangepointSort =
  | 'mosumMax'
  | 'mosumMaxDesc'
  | 'peakRatio'
  | 'peakRatioDesc'
  | 'mChangepoints'
  | 'mChangepointsDesc'
  | 'tokens'
  | 'tenure'
  | 'source';

export interface DailyTokenEichingerKirchMosumMeanChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  /** Hard floor 21. */
  minTenureDays?: number;
  top?: number;
  sort?: DailyTokenEichingerKirchMosumMeanChangepointSort;
  /** G = max(7, floor(bandwidthFrac * N)). Default 0.10. */
  bandwidthFrac?: number;
  /** threshold = thresholdScale * sqrt(2 ln(N/G)). Default 1.4. */
  thresholdScale?: number;
  /** Drop rows with verdict == 'no-shift'. */
  onlyShifts?: boolean;
  generatedAt?: string;
}

export interface DailyTokenEichingerKirchMosumMeanChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nTenureDays: number;
  firstActiveDay: string;
  lastActiveDay: string;
  bandwidthG: number;
  sigmaHatUsed: number;
  thresholdUsed: number;
  mosumMax: number;
  mosumArgmax: number;
  mosumArgmaxDay: string;
  mChangepoints: number;
  tauStarDays: string[];
  peakRatio: number;
  verdict: 'no-shift' | 'borderline' | 'shift' | 'strong-shift';
}

export interface DailyTokenEichingerKirchMosumMeanChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minTenureDays: number;
  top: number;
  sort: DailyTokenEichingerKirchMosumMeanChangepointSort;
  bandwidthFrac: number;
  thresholdScale: number;
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
  sources: DailyTokenEichingerKirchMosumMeanChangepointSourceRow[];
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

export function buildDailyTokenEichingerKirchMosumMeanChangepoint(
  queue: QueueLine[],
  opts: DailyTokenEichingerKirchMosumMeanChangepointOptions = {},
): DailyTokenEichingerKirchMosumMeanChangepointReport {
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
  const sort: DailyTokenEichingerKirchMosumMeanChangepointSort =
    opts.sort ?? 'peakRatioDesc';
  const validSorts: DailyTokenEichingerKirchMosumMeanChangepointSort[] = [
    'mosumMax',
    'mosumMaxDesc',
    'peakRatio',
    'peakRatioDesc',
    'mChangepoints',
    'mChangepointsDesc',
    'tokens',
    'tenure',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const bandwidthFrac = opts.bandwidthFrac ?? 0.1;
  if (
    !Number.isFinite(bandwidthFrac) ||
    !(bandwidthFrac > 0) ||
    bandwidthFrac >= 0.5
  ) {
    throw new Error(
      `bandwidthFrac must be in (0, 0.5) finite (got ${opts.bandwidthFrac})`,
    );
  }
  const thresholdScale = opts.thresholdScale ?? 1.4;
  if (!Number.isFinite(thresholdScale) || !(thresholdScale > 0)) {
    throw new Error(
      `thresholdScale must be > 0 finite (got ${opts.thresholdScale})`,
    );
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
  const rows: DailyTokenEichingerKirchMosumMeanChangepointSourceRow[] = [];

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
    let scan: MosumScanResult;
    try {
      scan = mosumScan(filled, { bandwidthFrac, thresholdScale });
    } catch {
      droppedNonFiniteFit += 1;
      continue;
    }
    if (
      !Number.isFinite(scan.mosumMax) ||
      !Number.isFinite(scan.peakRatio) ||
      !Number.isFinite(scan.thresholdUsed)
    ) {
      droppedNonFiniteFit += 1;
      continue;
    }
    const tauStarDays = scan.changepoints.map((k) => addUtcDays(acc.firstDay, k));
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nActiveDays: acc.perDay.size,
      nTenureDays: nTenure,
      firstActiveDay: acc.firstDay,
      lastActiveDay: acc.lastDay,
      bandwidthG: scan.bandwidthG,
      sigmaHatUsed: scan.sigmaHatUsed,
      thresholdUsed: scan.thresholdUsed,
      mosumMax: scan.mosumMax,
      mosumArgmax: scan.mosumArgmax,
      mosumArgmaxDay: addUtcDays(acc.firstDay, scan.mosumArgmax),
      mChangepoints: scan.changepoints.length,
      tauStarDays,
      peakRatio: scan.peakRatio,
      verdict: mosumVerdict(scan.peakRatio),
    });
    totalTokensSum += acc.totalTokens;
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'mosumMax':
        primary = a.mosumMax - b.mosumMax;
        break;
      case 'mosumMaxDesc':
        primary = b.mosumMax - a.mosumMax;
        break;
      case 'peakRatio':
        primary = a.peakRatio - b.peakRatio;
        break;
      case 'peakRatioDesc':
        primary = b.peakRatio - a.peakRatio;
        break;
      case 'mChangepoints':
        primary = a.mChangepoints - b.mChangepoints;
        break;
      case 'mChangepointsDesc':
        primary = b.mChangepoints - a.mChangepoints;
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
    bandwidthFrac,
    thresholdScale,
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
