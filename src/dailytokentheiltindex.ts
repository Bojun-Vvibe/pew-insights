/**
 * daily-token-theil-t-index: per-source THEIL-T (mass-weighted entropy
 * deviation, GE(1)) of the per-day total_tokens distribution.
 *
 * For each source we collapse all hourly buckets into a single scalar
 * per UTC day (D_d = sum of total_tokens on day d) and then summarise
 * the resulting day vector D = (D_1, ..., D_n) by Theil's FIRST
 * inequality measure (Theil 1967; the alpha = 1 element of the
 * generalised-entropy GE(alpha) family).
 *
 * Construction:
 *
 *   Let mu = mean(D), n = |D|, q_i = D_i / sum(D) (the mass share of
 *   day i).
 *
 *     T = (1 / n) * sum_i (D_i / mu) * log(D_i / mu)
 *       = sum_i q_i * log(q_i / (1/n))
 *       = log(n) + sum_i q_i * log(q_i)
 *       = log(n) - H_q                            (H_q = Shannon entropy of q)
 *
 *   Range: T in [0, log(n)]. T = 0 iff every D_i = mu (perfect
 *   equality). T = log(n) iff one day carries all the mass. Reported
 *   in NATS (multiply by 1/ln(2) for bits).
 *
 *   Interpretation: T is the Kullback-Leibler divergence FROM the
 *   empirical mass-share distribution q TO the uniform-share
 *   distribution (1/n), evaluated against the EMPIRICAL reference
 *   (mass-weighted): T = D_KL(q || uniform). This is the MIRROR of
 *   Theil-L = D_KL(uniform || q): same two distributions, opposite
 *   reference -- and KL is asymmetric, so the two indices are
 *   FUNCTIONALLY independent except at the perfect-equality point.
 *
 *   Equivalent forms:
 *     T = log(n) + sum_i q_i log q_i              (entropy form)
 *     T = log(EntropicMean(D) / mu)               (entropic-mean form,
 *       where EntropicMean = sum_i q_i * D_i / mu = E_q[D] / mu, the
 *       MASS-WEIGHTED average per-day mass scaled by mu)
 *
 * Why orthogonal to every prior daily-token axis (and to Theil-L
 * specifically -- this is the central design point):
 *
 *   axis-37 is daily-token-theil-l-index = GE(0) = D_KL(uniform || q).
 *   This axis is GE(1) = D_KL(q || uniform). KL DIVERGENCE IS
 *   ASYMMETRIC. Mechanically:
 *
 *     - Theil-L weights each day's deviation by 1/n (UNIFORM weight)
 *       and the deviation is log(mu/D_i). When D_i is small,
 *       log(mu/D_i) blows up -> L is BOTTOM-SENSITIVE: a small day
 *       moves L a lot, a large day moves it only slowly. A single
 *       zero day pins L = +inf.
 *     - Theil-T weights each day's deviation by q_i = D_i/sum(D)
 *       (MASS weight) and the deviation is log(D_i/mu). When D_i is
 *       large, BOTH the weight q_i AND the log(D_i/mu) factor grow
 *       -> T is TOP-SENSITIVE: a large day moves T a lot, a small
 *       day contributes negligibly. A zero day contributes 0 to T
 *       (by the convention 0 * log(0) = 0); T REMAINS FINITE on
 *       zero-day vectors. This is the key empirical contrast with
 *       axis-37.
 *
 *   Two sources can have IDENTICAL Theil-L but very different
 *   Theil-T (and vice versa). Their RATIO T/L is itself a meaningful
 *   skew indicator: T/L > 1 means the inequality lives in the upper
 *   tail (a few mega-days dominate); T/L < 1 means it lives in the
 *   lower tail (a few near-zero days dominate). We surface this ratio
 *   as `tOverL` per row -- a one-shot skew witness that requires both
 *   axes to compute. Either axis alone cannot recover it.
 *
 *   Other comparisons:
 *
 *     - daily-token-gini-coefficient: Gini is a Lorenz integral
 *       (rank-weighted absolute differences). Theil-T is a KL
 *       divergence (mass-weighted log ratios). Gini is bounded in
 *       [0, 1] and not unboundedly responsive to top-tail spikes;
 *       Theil-T is in [0, log(n)] and grows linearly in log of the
 *       top-share when one day dominates.
 *     - daily-token-pietra-ratio: Pietra is an L-infinity Lorenz
 *       gap (one anchored max). Theil-T is an L-1 mass-weighted
 *       average over log ratios. Different norm; different transfer
 *       sensitivity.
 *     - daily-token-zenga-index: Zenga averages bottom-vs-top mean
 *       ratios over rank cuts. Theil-T uses no rank ordering at
 *       all -- only mass shares.
 *     - daily-token-atkinson-index: Atkinson is bounded in [0, 1].
 *       Theil-T is in [0, log(n)]. Atkinson is also additively
 *       decomposable only with a residual; Theil-T (like Theil-L)
 *       decomposes EXACTLY into within + between. Atkinson and
 *       Theil-T share an ordering only at the special epsilon
 *       limit and are functionally independent elsewhere.
 *     - daily-token-theil-l-index (axis-37): explained above. Same
 *       two distributions q, uniform; opposite KL argument order.
 *       Functionally independent because KL is asymmetric.
 *     - All time-ordered axes (autocorrelation, monotone-run-length,
 *       second-difference-sign-runs, z-score-extremes): Theil-T is
 *       permutation-invariant, so orthogonal by construction.
 *
 *   Headline question:
 *   **"For each source, how many NATS of mass-weighted divergence
 *     does the empirical day-mass-share distribution carry away
 *     from the uniform-share reference? And how does this top-
 *     sensitive reading compare to axis-37's bottom-sensitive
 *     Theil-L on the same vector (via the T/L skew ratio)?"**
 *
 * ZERO-COLLAPSE: Theil-T does NOT zero-collapse. Each zero day
 *   contributes 0 to the sum (0 * log(0) = 0 by convention). T
 *   remains finite on any non-empty non-trivially-zero vector. We
 *   surface `nZeroDays` for transparency.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source.
 *   - `minTokens` (default 1000): hide sources whose total mass is
 *     below this floor.
 *   - `minDays` (default 2): T is degenerate for n < 2.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *   - `sort` (default 'theilT'): 'theilT' | 'tokens' | 'days' |
 *     'source' | 'meanDaily' | 'tOverL' (skew indicator).
 *   - `minTheilT` (default 0): display filter; in [0, log(n)].
 *   - `alphaSweep`: optional GE(alpha) sweep, same shape as axis-37.
 */
import type { QueueLine } from './types.js';
import {
  theilLOfVector,
  generalisedEntropyOfVector,
} from './dailytokentheillindex.js';

export type DailyTokenTheilTSort =
  | 'theilT'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'tOverL';

export interface DailyTokenTheilTOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  minDays?: number;
  top?: number;
  sort?: DailyTokenTheilTSort;
  /** Display filter: drop rows whose theilT < this. In [0, +inf). */
  minTheilT?: number;
  /**
   * When non-empty, every emitted row gains a `geSweep` array with
   * one entry per alpha value `{ alpha, ge }` where ge = GE(alpha) of
   * the same per-day vector. Mirrors axis-37 alpha-sweep so the GE
   * family can be inspected from either anchor.
   */
  alphaSweep?: readonly number[];
  generatedAt?: string;
}

export interface DailyTokenTheilTSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days with at least one observation. */
  nDays: number;
  /** Number of zero-mass days observed (informational; does not affect T). */
  nZeroDays: number;
  firstDay: string;
  lastDay: string;
  /** Theil-T (GE(1)) in NATS. In [0, log(nDays)]. 0 = perfect equality. */
  theilT: number;
  /**
   * Cross-anchor: Theil-L (GE(0)) on the same vector. We always
   * compute it because the headline value of THIS axis is the
   * SKEW RATIO T/L, which requires both. In NATS; +Infinity on
   * zero-day vectors.
   */
  theilL: number;
  /**
   * Skew indicator: theilT / theilL.
   *   > 1  => upper-tail-dominated (top-sensitive inequality wins)
   *   < 1  => lower-tail-dominated (bottom-sensitive inequality wins)
   *   = 1  => symmetric (rare; happens exactly at log-uniform shapes)
   *   = 0  => either both 0 (perfect equality) or T = 0 with L > 0
   *           (impossible for non-degenerate input).
   * Set to NaN when theilL = 0 (would be 0/0 or +inf/0).
   * Set to 0 when theilL = +inf (any zero day pins L = +inf, then
   * T/L is the limit 0; we report it as 0 with `lInfinite: true`).
   */
  tOverL: number;
  /** True iff theilL = +Infinity (>=1 zero day). */
  lInfinite: boolean;
  /**
   * Equivalent rendering: T = log(n) - H_q, where H_q is the Shannon
   * entropy of the day-mass-share distribution q. Useful as a
   * normalised information-theoretic readout in [0, log(n)].
   */
  shannonEntropyQ: number;
  /**
   * Normalised Theil-T: theilT / log(nDays). In [0, 1]. The reading
   * "fraction of the way from uniform to one-day-takes-all".
   * 0 = perfect equality; 1 = one day carries everything.
   * Defined as 0 when nDays < 2.
   */
  normalisedTheilT: number;
  /** Mean per-day total_tokens. */
  meanDailyTokens: number;
  /** Largest single-day total_tokens. */
  maxDailyTokens: number;
  maxDay: string;
  /** Smallest single-day total_tokens. */
  minDailyTokens: number;
  minDay: string;
  geSweep?: { alpha: number; ge: number }[];
}

export interface DailyTokenTheilTReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  minDays: number;
  top: number;
  sort: DailyTokenTheilTSort;
  minTheilT: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinDays: number;
  droppedBelowMinTheilT: number;
  droppedTopSources: number;
  alphaSweep: number[];
  sources: DailyTokenTheilTSourceRow[];
}

/**
 * Theil-T (GE(1)) of a non-negative vector, in NATS.
 *
 * Returns:
 *   - 0 for n < 2, all-zero, or empty.
 *   - In [0, log(n)] otherwise.
 *
 * Convention 0 * log(0) = 0 keeps T finite on zero-day vectors.
 * Throws on negative or non-finite input.
 */
export function theilTOfVector(values: number[]): {
  theilT: number;
  shannonEntropyQ: number;
  mean: number;
} {
  const n = values.length;
  if (n < 2) return { theilT: 0, shannonEntropyQ: 0, mean: 0 };
  let total = 0;
  for (const v of values) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(
        `theilTOfVector requires non-negative finite values (got ${v})`,
      );
    }
    total += v;
  }
  if (total <= 0) return { theilT: 0, shannonEntropyQ: 0, mean: 0 };
  const mu = total / n;
  // T = sum_i q_i * log(q_i / (1/n)) = log(n) + sum_i q_i log q_i
  // Compute in the q-form to keep numerics stable.
  let entropy = 0; // -sum q log q  (Shannon, in nats)
  for (const v of values) {
    if (v === 0) continue; // 0 * log(0) = 0
    const q = v / total;
    entropy -= q * Math.log(q);
  }
  let theilT = Math.log(n) - entropy;
  // Numerical clamp: T in [0, log(n)].
  if (theilT < 0) theilT = 0;
  const upper = Math.log(n);
  if (theilT > upper) theilT = upper;
  return { theilT, shannonEntropyQ: entropy, mean: mu };
}

export function buildDailyTokenTheilTIndex(
  queue: QueueLine[],
  opts: DailyTokenTheilTOptions = {},
): DailyTokenTheilTReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const minDays = opts.minDays ?? 2;
  if (!Number.isInteger(minDays) || minDays < 2) {
    throw new Error(
      `minDays must be an integer >= 2 (Theil-T is degenerate for n < 2) (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minTheilT = opts.minTheilT ?? 0;
  if (!Number.isFinite(minTheilT) || minTheilT < 0) {
    throw new Error(
      `minTheilT must be a non-negative finite number (got ${opts.minTheilT})`,
    );
  }
  const sort: DailyTokenTheilTSort = opts.sort ?? 'theilT';
  const validSorts: DailyTokenTheilTSort[] = [
    'theilT',
    'tokens',
    'days',
    'source',
    'meanDaily',
    'tOverL',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;

  const alphaSweep: number[] = [];
  if (opts.alphaSweep && opts.alphaSweep.length > 0) {
    for (const a of opts.alphaSweep) {
      if (!Number.isFinite(a)) {
        throw new Error(
          `alphaSweep values must be finite numbers (got ${a})`,
        );
      }
      alphaSweep.push(a);
    }
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
  const rows: DailyTokenTheilTSourceRow[] = [];

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
    const values: number[] = [];
    let maxDailyTokens = -1;
    let maxDay = acc.firstDay;
    let minDailyTokens = Number.POSITIVE_INFINITY;
    let minDay = acc.firstDay;
    let nZeroDays = 0;
    for (const [d, v] of acc.perDay) {
      values.push(v);
      if (v === 0) nZeroDays += 1;
      if (v > maxDailyTokens) {
        maxDailyTokens = v;
        maxDay = d;
      }
      if (v < minDailyTokens) {
        minDailyTokens = v;
        minDay = d;
      }
    }
    const t = theilTOfVector(values);
    const lRes = theilLOfVector(values);
    const lInfinite = !Number.isFinite(lRes.theilL);
    let tOverL: number;
    if (lInfinite) {
      tOverL = 0; // T finite, L = +inf -> ratio = 0.
    } else if (lRes.theilL === 0) {
      // Both should be 0 in practice. Use NaN to flag the degenerate case.
      tOverL = t.theilT === 0 ? Number.NaN : Number.POSITIVE_INFINITY;
    } else {
      tOverL = t.theilT / lRes.theilL;
    }
    const upper = Math.log(nDays);
    const normalisedTheilT = upper > 0 ? t.theilT / upper : 0;
    const row: DailyTokenTheilTSourceRow = {
      source: src,
      totalTokens: acc.totalTokens,
      nDays,
      nZeroDays,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      theilT: t.theilT,
      theilL: lRes.theilL,
      tOverL,
      lInfinite,
      shannonEntropyQ: t.shannonEntropyQ,
      normalisedTheilT,
      meanDailyTokens: acc.totalTokens / nDays,
      maxDailyTokens: Math.max(0, maxDailyTokens),
      maxDay,
      minDailyTokens: Number.isFinite(minDailyTokens) ? minDailyTokens : 0,
      minDay,
    };
    if (alphaSweep.length > 0) {
      row.geSweep = alphaSweep.map((a) => ({
        alpha: a,
        ge: generalisedEntropyOfVector(values, a),
      }));
    }
    rows.push(row);
    totalTokensSum += acc.totalTokens;
  }

  let droppedBelowMinTheilT = 0;
  let filtered = rows;
  if (minTheilT > 0) {
    const next: DailyTokenTheilTSourceRow[] = [];
    for (const r of rows) {
      if (r.theilT >= minTheilT) next.push(r);
      else droppedBelowMinTheilT += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'tokens':
        primary = b.totalTokens - a.totalTokens;
        break;
      case 'days':
        primary = b.nDays - a.nDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'meanDaily':
        primary = b.meanDailyTokens - a.meanDailyTokens;
        break;
      case 'tOverL': {
        // NaN sorts last; +inf to top.
        const av = a.tOverL;
        const bv = b.tOverL;
        const aBad = !Number.isFinite(av) && !Number.isNaN(av);
        const bBad = !Number.isFinite(bv) && !Number.isNaN(bv);
        if (Number.isNaN(av) && Number.isNaN(bv)) primary = 0;
        else if (Number.isNaN(av)) primary = 1;
        else if (Number.isNaN(bv)) primary = -1;
        else if (aBad && !bBad) primary = -1;
        else if (bBad && !aBad) primary = 1;
        else primary = bv - av;
        break;
      }
      case 'theilT':
      default:
        primary = b.theilT - a.theilT;
        break;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    top,
    sort,
    minTheilT,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinDays,
    droppedBelowMinTheilT,
    droppedTopSources,
    alphaSweep,
    sources: kept,
  };
}
