/**
 * Cache-hit-ratio drift scoring.
 *
 * Composes:
 *   - `buildDailySeries` (trend.ts) for the day grid + zero-fill semantics
 *   - `safeLogit` / `expit` / `ewmaLogit` (ratios.ts) for the bounded-ratio math
 *   - `mean` / `stdDev` (anomalies.ts) for the trailing-baseline z-score
 *
 * Why a separate module from `anomalies.ts`?
 * ------------------------------------------
 * `anomalies` scores raw token totals — an unbounded count. Cache-hit
 * ratios live in [0, 1]; scoring them with mean ± k·σ on the raw
 * series breaks for all the reasons documented in `ratios.ts`
 * (bounded variance, predictions outside [0, 1], asymmetric step
 * meaning near boundaries). The fix is to score the **logit-EWMA**
 * series, then render both the smoothed ratio (in (0, 1) for
 * humans) and the z-score (in logit space, where ±2σ has its
 * usual interpretation).
 *
 * Why both EWMA *and* a trailing baseline?
 *   - EWMA gives a smoothed "where the ratio sits today" — the
 *     primary number a human cares about, immune to single-day jitter.
 *   - The trailing baseline of *recent EWMA values* gives the
 *     yardstick for "is today's smoothed ratio drifting?" — exactly
 *     the regime-shift detector `anomalies` already validates.
 *   - Scoring drift on the smoothed series (not raw daily ratios)
 *     is what makes this useful: a single weird day shouldn't fire,
 *     but a sustained walk away from baseline should.
 *
 * Days with zero `input_tokens` produce no defined ratio and are
 * marked `undefined` (skipped by EWMA, no z-score). They do NOT
 * silently become 0/1 — that would poison the smoothed series.
 *
 * Determinism: like `forecast` and `anomalies`, the pure builder
 * never reads `Date.now()`. Callers pass `asOf` explicitly.
 */
import { buildDailySeries } from './trend.js';
import { mean, stdDev } from './anomalies.js';
import {
  DEFAULT_RATIO_EPS,
  ewmaLogit,
  expit,
  safeLogit,
} from './ratios.js';
import type { QueueLine } from './types.js';

export type RatioStatus =
  | 'undefined' // no input_tokens that day → no ratio defined
  | 'warmup'    // not enough EWMA history to score against baseline
  | 'flat'      // baseline σ = 0 in logit space → no scoring possible
  | 'normal'    // |z| < threshold
  | 'high'      // z ≥ +threshold (cache-hit climbed unusually)
  | 'low';      // z ≤ -threshold (cache-hit dropped unusually)

export interface RatioDay {
  day: string;
  /**
   * Daily cache-hit ratio = `cached_input_tokens / (input_tokens + cached_input_tokens)`.
   * Always in [0, 1]. null when both numerator and denominator are 0.
   * See `buildRatiosReport` for the rationale on this denominator
   * vs the naive `cached / input`.
   */
  ratio: number | null;
  /** input_tokens for the day (denominator). */
  inputTokens: number;
  /** cached_input_tokens for the day (numerator). */
  cachedInputTokens: number;
  /** Smoothed ratio in (0, 1) after logit-EWMA up to and including this day. null until first defined day. */
  ewma: number | null;
  /** Mean of the trailing baseline window in logit space. null during warmup. */
  baselineLogitMean: number | null;
  /** Sample stddev of the trailing baseline window in logit space. null during warmup. */
  baselineLogitStdDev: number | null;
  /** z-score of today's logit(ewma) against the trailing baseline. null when not scored. */
  z: number | null;
  status: RatioStatus;
}

export interface RatiosOptions {
  /** Days of history to score, including warmup. Default 30. */
  lookbackDays?: number;
  /** EWMA alpha in (0, 1]. Higher = more weight on recent days. Default 0.3. */
  alpha?: number;
  /**
   * Trailing-window size used to compute the logit-space baseline
   * for z-scoring drift. Default 7. Note: this is a window over the
   * *EWMA* values, not the raw daily ratios.
   */
  baselineDays?: number;
  /** |z| threshold for flagging in logit-space. Default 2.0. */
  threshold?: number;
  /** Clamp epsilon for safeLogit. Default 1e-6 (from ratios.ts). */
  eps?: number;
  /** Cutoff timestamp; defaults to now. */
  asOf?: string;
}

export interface RatiosReport {
  asOf: string;
  lookbackDays: number;
  alpha: number;
  baselineDays: number;
  threshold: number;
  eps: number;
  /** Per-day series, oldest → newest. */
  series: RatioDay[];
  /** Subset of `series` with status === 'high' or 'low'. */
  flagged: RatioDay[];
  /** True iff the most recent scored day is `high`. */
  recentHigh: boolean;
  /** True iff the most recent scored day is `low`. */
  recentLow: boolean;
  /** Most recent EWMA value, or null if no defined days in window. */
  currentEwma: number | null;
}

// ---------------------------------------------------------------------------
// Per-day cache-hit aggregation
// ---------------------------------------------------------------------------

interface DayAgg {
  inputTokens: number;
  cachedInputTokens: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Aggregate `input_tokens` and `cached_input_tokens` per UTC day.
 * Unlike `buildDailySeries` (which sums `total_tokens`), we need both
 * numerator and denominator separately so the ratio is computed at
 * the day level, not per-event.
 */
export function aggregateCacheTokensByDay(
  queue: QueueLine[],
): Map<string, DayAgg> {
  const out = new Map<string, DayAgg>();
  for (const q of queue) {
    const k = dayKey(q.hour_start);
    const e = out.get(k) ?? { inputTokens: 0, cachedInputTokens: 0 };
    e.inputTokens += q.input_tokens || 0;
    e.cachedInputTokens += q.cached_input_tokens || 0;
    out.set(k, e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildRatiosReport(
  queue: QueueLine[],
  opts: RatiosOptions = {},
): RatiosReport {
  const lookbackDays = opts.lookbackDays ?? 30;
  const alpha = opts.alpha ?? 0.3;
  const baselineDays = opts.baselineDays ?? 7;
  const threshold = opts.threshold ?? 2.0;
  const eps = opts.eps ?? DEFAULT_RATIO_EPS;
  const asOf = opts.asOf ?? new Date().toISOString();

  if (lookbackDays < 1) throw new Error(`lookbackDays must be >= 1`);
  if (!(alpha > 0 && alpha <= 1)) {
    throw new Error(`alpha must be in (0, 1] (got ${alpha})`);
  }
  if (baselineDays < 1) throw new Error(`baselineDays must be >= 1`);
  if (!(threshold > 0)) throw new Error(`threshold must be > 0`);

  // Anchor the day grid to asOf using the same backwards-walk logic
  // that buildDailySeries uses, so days without events are zero-filled
  // and missing days don't shift the index.
  const endDay = asOf.slice(0, 10);
  const grid = buildDailySeries(queue, endDay, lookbackDays);
  const cacheAgg = aggregateCacheTokensByDay(queue);

  // Pass 1: compute raw daily ratios, then walk EWMA in logit space
  // skipping `undefined` days (no input_tokens). EWMA carries forward
  // across undefined gaps — `acc` doesn't decay, the next defined day
  // resumes blending against the last known logit value. This matches
  // the spirit of "we have no new evidence today, keep the prior".
  //
  // Ratio definition: `cached / (input + cached)`.
  // Why this and not `cached / input`?
  //   - In pew's queue.jsonl, several sources report `input_tokens`
  //     as the *uncached* portion only — so `cached / input` can
  //     exceed 1 (e.g. cached=300, input=100 → ratio 3.0). That
  //     poisons the [0,1] domain that all of `ratios.ts` is built on.
  //   - `cached / (input + cached)` is unambiguously "fraction of
  //     total input tokens that came from the cache", always in
  //     [0, 1] regardless of source convention, and reduces to the
  //     intuitive cache-hit-ratio for sources that *do* include
  //     cached in `input_tokens` (since then input ≥ cached and the
  //     denominator just becomes input + cached − overlap; close
  //     enough for drift detection, exact for pure-uncached
  //     sources).
  //   - We don't try to auto-detect the source convention — the
  //     unified ratio is what we ship.
  const series: RatioDay[] = grid.map((g) => {
    const agg = cacheAgg.get(g.day) ?? { inputTokens: 0, cachedInputTokens: 0 };
    const denom = agg.inputTokens + agg.cachedInputTokens;
    const ratio = denom > 0 ? agg.cachedInputTokens / denom : null;
    return {
      day: g.day,
      ratio,
      inputTokens: agg.inputTokens,
      cachedInputTokens: agg.cachedInputTokens,
      ewma: null,
      baselineLogitMean: null,
      baselineLogitStdDev: null,
      z: null,
      status: ratio == null ? 'undefined' : 'warmup',
    };
  });

  // EWMA pass — in logit space, but stored as the back-transformed
  // probability for human consumption. Also keep a parallel
  // `logitEwma` array for z-scoring drift downstream.
  const logitEwma: Array<number | null> = new Array(series.length).fill(null);
  let acc: number | null = null;
  for (let i = 0; i < series.length; i++) {
    const r = series[i]!.ratio;
    if (r == null) {
      // Skip — but if we already have an `acc`, surface the current
      // smoothed value so the human sees the EWMA "stayed" rather
      // than disappeared. Don't update `acc` on undefined.
      if (acc != null) {
        series[i]!.ewma = expit(acc);
        logitEwma[i] = acc;
      }
      continue;
    }
    const x = safeLogit(r, eps);
    if (acc == null) {
      acc = x; // first defined sample anchors the EWMA
    } else {
      acc = alpha * x + (1 - alpha) * acc;
    }
    series[i]!.ewma = expit(acc);
    logitEwma[i] = acc;
  }

  // Z-score pass — score each defined day's logit(EWMA) against the
  // mean/stddev of the *prior* `baselineDays` logit-EWMA values.
  // We deliberately use the EWMA series (not the raw daily ratios)
  // as the baseline: a single noisy day shouldn't fire, only
  // sustained drift should.
  //
  // Crucially we ONLY score days that had new evidence today
  // (series[i].ratio != null). Days where the EWMA was merely
  // carried forward from prior history get a displayed `ewma` value
  // for human inspection but stay in their existing `undefined`
  // status — re-scoring a stale carried-forward value would mark
  // the same day-of-no-data as drifted forever.
  for (let i = 0; i < series.length; i++) {
    if (series[i]!.ratio == null) continue; // no new evidence → no scoring
    const cur = logitEwma[i];
    if (cur == null) continue; // shouldn't happen given ratio!=null, but defensive

    // Collect the *prior* baselineDays defined logit-EWMA values
    // (excluding today). Walk backwards.
    const baseline: number[] = [];
    for (let j = i - 1; j >= 0 && baseline.length < baselineDays; j--) {
      const v = logitEwma[j];
      if (v != null) baseline.push(v);
    }
    if (baseline.length < baselineDays) {
      // not enough trailing history yet; status stays 'warmup'
      continue;
    }

    const mu = mean(baseline);
    const sigma = stdDev(baseline);
    series[i]!.baselineLogitMean = mu;
    series[i]!.baselineLogitStdDev = sigma;

    // Treat near-zero σ as flat. `stdDev` of n identical floats
    // returns ~6e-17 (floating-point residual), not exactly 0.
    // A logit-space σ below 1e-9 corresponds to ratios that match
    // to ~10 decimal places — not real signal we can score against.
    const FLAT_SIGMA = 1e-9;
    if (sigma < FLAT_SIGMA) {
      series[i]!.status = 'flat';
      continue;
    }
    const z = (cur - mu) / sigma;
    series[i]!.z = z;
    if (z >= threshold) series[i]!.status = 'high';
    else if (z <= -threshold) series[i]!.status = 'low';
    else series[i]!.status = 'normal';
  }

  const flagged = series.filter(
    (d) => d.status === 'high' || d.status === 'low',
  );

  // Find the most recent *scored* day for the recent-high/recent-low
  // exit-code signal. A trailing run of `undefined` days (e.g. user
  // stopped using the tool) shouldn't suppress an alert from the
  // last day they did use it.
  let recentHigh = false;
  let recentLow = false;
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i]!.status;
    if (s === 'high') {
      recentHigh = true;
      break;
    }
    if (s === 'low') {
      recentLow = true;
      break;
    }
    if (s === 'normal' || s === 'flat') break;
    // 'warmup' / 'undefined' → keep walking backwards
  }

  // currentEwma = EWMA value on the most recent day (whether defined or
  // carried forward).
  const currentEwma =
    series.length > 0 ? series[series.length - 1]!.ewma : null;

  return {
    asOf,
    lookbackDays,
    alpha,
    baselineDays,
    threshold,
    eps,
    series,
    flagged,
    recentHigh,
    recentLow,
    currentEwma,
  };
}
