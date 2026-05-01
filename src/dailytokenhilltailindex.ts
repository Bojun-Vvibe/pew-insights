/**
 * daily-token-hill-tail-index: per-source HILL ESTIMATOR of the
 * tail index alpha on the per-day total_tokens vector.
 *
 * SIXTY-FIFTH cross-source axis.
 *
 * For each source we collapse hourly buckets into a per-day total
 * D = (D_1, D_2, ..., D_n) under UTC day keys, sort the values in
 * DESCENDING order to obtain the order statistics
 *   X_(1) >= X_(2) >= ... >= X_(n)
 * and pick the top k = floor(n * topFrac) order statistics
 * (default topFrac = 0.20). The Hill (1975) estimator of the
 * Pareto tail index alpha is:
 *
 *     gamma_hat = (1/k) * sum_{i=1..k} log(X_(i)) - log(X_(k+1))
 *     alpha_hat = 1 / gamma_hat
 *
 * where gamma_hat is the EXTREME-VALUE INDEX (the reciprocal of
 * alpha for a Pareto-type tail). Asymptotic null is normal with
 * variance gamma^2 / k for i.i.d. samples from a regularly varying
 * distribution.
 *
 * SIGN / INTERPRETATION:
 *   - alpha < 1     : extremely heavy tail (mean is INFINITE in
 *                     the population analogue; sample mean dominated
 *                     by the largest day).
 *   - 1 <= alpha < 2: heavy tail (variance infinite in the
 *                     population; sample variance unstable).
 *   - 2 <= alpha < 4: moderate / sub-Gaussian-but-still-heavy.
 *   - alpha >= 4    : near-light tail, mean and variance both
 *                     well-defined; close to exponential / Gaussian.
 *
 * Headline question:
 * **"For each source, HOW HEAVY is the right tail of the per-day
 *   total_tokens distribution -- specifically, what Pareto exponent
 *   alpha governs the top 20% of days?"**
 *
 * STRUCTURAL ORTHOGONALITY -- WHY THIS IS DIFFERENT FROM EVERY
 * SHIPPED DAILY-TOKEN AXIS (32..64):
 *
 *   - All axes 32..63 are FULL-DISTRIBUTION dispersion / inequality
 *     functionals (Gini, Atkinson, Theil-L/T, GE family, Hoover,
 *     Pietra, Bonferroni, Mehran, Wolfson, Foster-Wolfson, Palma,
 *     Kolm-Pollak, Chakravarty, Amato, Esteban-Ray, Var-of-Logs,
 *     Log-MAD, FGT, PGR, IOM, MSR, DSG, QSR, MADM): they integrate
 *     OVER THE WHOLE day vector or compute fixed quantile gaps.
 *     Hill is SEMIPARAMETRIC and TAIL-ONLY -- it discards the
 *     bottom 80% of days entirely. Multiplying every bottom-80%
 *     day by 0 leaves alpha_hat unchanged; multiplying every
 *     bottom-80% day by 1000 also leaves alpha_hat unchanged.
 *     None of axes 32..63 share this property.
 *
 *   - vs axis 64 RTZ (the only other order/structural axis):
 *     RTZ is on the binary above/below-median sign trace and is
 *     CALENDAR-ORDER sensitive but discards magnitude. Hill is
 *     PERMUTATION-INVARIANT (sort by descending value first) but
 *     keeps magnitude on the top-k -- the exact opposite slice of
 *     information. RTZ tells you "do high days CLUSTER in time?";
 *     Hill tells you "are high days POWER-LAW heavy?". A perfect
 *     square-wave (alternating high/low) gives RTZ extreme
 *     positive (anti-clustering) while Hill is unaffected by the
 *     ordering and only sees the magnitude spread of the high
 *     half.
 *
 *   - vs axis 1 (`tailshare`, top-K mass share): tailshare is a
 *     LINEAR functional of top-k values normalised by total mass.
 *     Doubling X_(k+1) (the threshold value) keeps tailshare
 *     monotone but the value changes. Hill is SCALE-INVARIANT
 *     (multiply every day by c > 0 and alpha_hat is identical)
 *     because gamma_hat is a difference of LOGS. tailshare is
 *     also bounded in [k/n, 1]; Hill is unbounded in (0, +inf).
 *     The two axes will disagree under "many heavy days but only
 *     a mild Pareto exponent" (tailshare high, alpha high) and
 *     under "few extreme days with very heavy power law"
 *     (tailshare moderate, alpha low).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass
 *     is below this floor.
 *   - `minDays` (default 10): the Hill estimator with topFrac=0.2
 *     needs k>=2 stable order statistics, so default 10 ensures
 *     k = floor(10*0.2) = 2 and n - k - 1 >= 7 below-tail values.
 *   - `topFrac` (default 0.20): fraction of upper order statistics
 *     to use (k = floor(n * topFrac)). Must be in (0, 1).
 *   - `top` (default 0 = no cap): display cap.
 *   - `sort` (default 'alpha'): 'alpha' (lightest tails first;
 *     largest alpha) | 'invAlpha' (heaviest tails first) | 'tokens'
 *     | 'days' | 'source' | 'k'.
 *   - `maxAlpha`: display filter; hide rows whose alpha exceeds
 *     this value (i.e. show only the heaviest-tailed sources).
 *   - `--json`: raw JSON output.
 */
import type { QueueLine } from './types.js';

export type DailyTokenHillTailIndexSort =
  | 'alpha'
  | 'invAlpha'
  | 'tokens'
  | 'days'
  | 'source'
  | 'k';

export interface DailyTokenHillTailIndexOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  topFrac?: number;
  top?: number;
  sort?: DailyTokenHillTailIndexSort;
  /** Display filter: drop rows whose alpha is strictly above this value. null = no filter. */
  maxAlpha?: number | null;
  generatedAt?: string;
}

export interface DailyTokenHillTailIndexSourceRow {
  source: string;
  totalTokens: number;
  /** Days observed (all days with strictly positive total_tokens). */
  nDays: number;
  firstDay: string;
  lastDay: string;
  /** k = floor(nDays * topFrac); number of top order statistics used. */
  k: number;
  /** X_(k+1), the cutoff threshold (the (k+1)-th largest day). */
  threshold: number;
  /** gamma_hat = (1/k) * sum log(X_(i)) - log(X_(k+1)). Always >= 0. */
  gamma: number;
  /** alpha_hat = 1 / gamma_hat. +Infinity when gamma == 0 (degenerate). */
  alpha: number;
  /** Asymptotic SE of gamma under iid Pareto-tail null: gamma / sqrt(k). */
  gammaStdErr: number;
  meanDailyTokens: number;
  /**
   * True when k < 1, threshold <= 0, or gamma_hat == 0 (all top-k
   * values equal threshold). alpha is set to +Infinity in the
   * gamma == 0 case as a guard.
   */
  degenerate: boolean;
}

export interface DailyTokenHillTailIndexReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  topFrac: number;
  top: number;
  sort: DailyTokenHillTailIndexSort;
  maxAlpha: number | null;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedAboveMaxAlpha: number;
  droppedTopSources: number;
  sources: DailyTokenHillTailIndexSourceRow[];
}

/**
 * Hill (1975) tail index primitive on a strictly positive numeric
 * vector. `topFrac` selects the fraction of upper order statistics
 * to use; k = floor(n * topFrac) and must be >= 1 and <= n - 1.
 *
 * Returns:
 *   - k:          number of upper order statistics actually used.
 *   - threshold:  X_(k+1), the (k+1)-th largest value.
 *   - gamma:      Hill extreme-value index estimator.
 *   - alpha:      1 / gamma (Pareto exponent), +Infinity if gamma == 0.
 *   - degenerate: true when the input is too short or top-k all
 *                 equal the threshold (gamma == 0).
 *
 * Throws on non-positive or non-finite input.
 */
export function hillTailIndexOfVector(
  values: number[],
  topFrac: number,
): {
  k: number;
  threshold: number;
  gamma: number;
  alpha: number;
  degenerate: boolean;
} {
  if (!Number.isFinite(topFrac) || topFrac <= 0 || topFrac >= 1) {
    throw new Error(
      `hillTailIndexOfVector requires topFrac in (0, 1) (got ${topFrac})`,
    );
  }
  for (const v of values) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `hillTailIndexOfVector requires strictly positive finite values (got ${v})`,
      );
    }
  }
  const n = values.length;
  if (n < 2) {
    return { k: 0, threshold: n === 1 ? values[0]! : 0, gamma: 0, alpha: Infinity, degenerate: true };
  }
  const k = Math.floor(n * topFrac);
  if (k < 1 || k >= n) {
    return { k, threshold: 0, gamma: 0, alpha: Infinity, degenerate: true };
  }
  // Sort descending.
  const sorted = values.slice().sort((a, b) => b - a);
  const threshold = sorted[k]!; // (k+1)-th largest because of 0-indexing
  if (!(threshold > 0)) {
    return { k, threshold, gamma: 0, alpha: Infinity, degenerate: true };
  }
  const logThr = Math.log(threshold);
  let acc = 0;
  for (let i = 0; i < k; i += 1) {
    acc += Math.log(sorted[i]!) - logThr;
  }
  const gamma = acc / k;
  if (!(gamma > 0)) {
    return { k, threshold, gamma: 0, alpha: Infinity, degenerate: true };
  }
  return { k, threshold, gamma, alpha: 1 / gamma, degenerate: false };
}

export function buildDailyTokenHillTailIndex(
  queue: QueueLine[],
  opts: DailyTokenHillTailIndexOptions = {},
): DailyTokenHillTailIndexReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 10;
  if (!Number.isInteger(minDays) || minDays < 5) {
    throw new Error(
      `minDays must be an integer >= 5 (the Hill estimator with default topFrac=0.2 needs k>=1 and at least one threshold day) (got ${opts.minDays})`,
    );
  }
  const topFrac = opts.topFrac ?? 0.2;
  if (!Number.isFinite(topFrac) || topFrac <= 0 || topFrac >= 1) {
    throw new Error(
      `topFrac must be a finite number in (0, 1) (got ${opts.topFrac})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const maxAlpha = opts.maxAlpha ?? null;
  if (maxAlpha !== null && (!Number.isFinite(maxAlpha) || maxAlpha <= 0)) {
    throw new Error(
      `maxAlpha must be a strictly positive finite number when set (got ${opts.maxAlpha})`,
    );
  }
  const sort: DailyTokenHillTailIndexSort = opts.sort ?? 'alpha';
  const validSorts: DailyTokenHillTailIndexSort[] = [
    'alpha',
    'invAlpha',
    'tokens',
    'days',
    'source',
    'k',
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
  let droppedBelowMinDays = 0;
  let totalTokensSum = 0;
  const rows: DailyTokenHillTailIndexSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const nDays = acc.perDay.size;
    if (nDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    const values = Array.from(acc.perDay.values());
    const r = hillTailIndexOfVector(values, topFrac);
    const gammaStdErr = r.k > 0 && r.gamma > 0 ? r.gamma / Math.sqrt(r.k) : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      k: r.k,
      threshold: r.threshold,
      gamma: r.gamma,
      alpha: r.alpha,
      gammaStdErr,
      meanDailyTokens: acc.totalTokens / nDays,
      degenerate: r.degenerate,
    });
    totalTokensSum += acc.totalTokens;
  }

  let droppedAboveMaxAlpha = 0;
  let filtered = rows;
  if (maxAlpha !== null) {
    const next: DailyTokenHillTailIndexSourceRow[] = [];
    for (const r of rows) {
      if (r.degenerate || r.alpha <= maxAlpha) next.push(r);
      else droppedAboveMaxAlpha += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'invAlpha':
        // Heaviest tails first (smallest alpha first); push degenerate (alpha=Inf) to the end.
        primary = a.alpha - b.alpha;
        break;
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'k':
        primary = b.k - a.k;
        break;
      case 'alpha':
      default:
        // Lightest tails first (largest alpha first); degenerate (alpha=Inf) sorts to the front.
        primary = b.alpha - a.alpha;
        break;
    }
    if (Number.isNaN(primary) || primary === 0) {
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
    return primary;
  });

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    minDays,
    topFrac,
    top,
    sort,
    maxAlpha,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedAboveMaxAlpha,
    droppedTopSources,
    sources: kept,
  };
}
