/**
 * daily-token-pettitt-changepoint: per-source non-parametric PETTITT
 * changepoint statistic on the gap-filled daily total_tokens series.
 *
 * AXIS-154 (single-changepoint, rank-based).
 *
 * For each source, on the gap-filled tenure series x[0..n-1]:
 *
 *     U[t] = sum_{i<=t} sum_{j>t} sign(x[i] - x[j])      (t = 0..n-2)
 *
 * Pettitt's statistic is
 *
 *     KT     = max_{0<=t<=n-2} |U[t]|
 *     tStar  = argmax_t |U[t]|              (earliest tie)
 *
 * The asymptotic two-sided significance is approximated by
 *
 *     p ~ 2 * exp( -6 * KT^2 / (n^3 + n^2) )
 *
 * (Pettitt 1979). We clamp p to [0,1].
 *
 * Distinctly from CUSUM (axis-153), Pettitt:
 *   - is RANK-BASED (uses sign(x[i]-x[j]) only) — magnitude-blind, so a
 *     single 1e9 outlier shifts U[t] by at most O(n) instead of O(1e9);
 *     breakdown point ~0.5.
 *   - asks "what is the most likely SINGLE step-shift split point and
 *     how strong is it?" rather than CUSUM's "what is the worst
 *     accumulated drift excursion above/below the mean?".
 *   - reports an explicit p-value, which CUSUM does not.
 *   - tStar is bounded in [0, n-2] (cannot equal n-1); CUSUM's argMax
 *     can be anywhere including the last index.
 *
 * Distinctly from Mann-Kendall (monotone trend rank): Mann-Kendall
 * sums sign(x[i]-x[j]) over ALL i<j and tests monotone trend across
 * the whole series; Pettitt SPLITS the series at every t and asks
 * which split has the strongest Mann-Whitney shift between left and
 * right halves. A V-shape series can have small Mann-Kendall (no
 * monotone trend) but very large Pettitt KT (clean changepoint at
 * the V vertex).
 *
 * Distinctly from runs-test-z / cox-stuart / bartels-rank: those test
 * for randomness/runs/rank-vonneumann; Pettitt tests for a SINGLE
 * step shift in distribution location.
 *
 * Knobs:
 *   - `minDays` (default 4): n must be >= 4 for a non-trivial split.
 *   - `top` (default 0): display cap.
 *   - `sort`: tokens|kt|ktnorm|p|abszshift|tstaridx|ndays.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 * All sorts have explicit secondary keys (source asc).
 */
import type { QueueLine } from './types.js';

export type DailyTokenPettittChangepointSortKey =
  | 'tokens'
  | 'kt'
  | 'ktnorm'
  | 'p'
  | 'abszshift'
  | 'tstaridx'
  | 'kt2overkt'
  | 'ndays';

export interface DailyTokenPettittChangepointOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  /** Minimum gap-filled tenure length (days). Must be >= 4. Default 4. */
  minDays?: number;
  /** Display cap on `sources[]` after sort. 0 = no cap. Default 0. */
  top?: number;
  sort?: DailyTokenPettittChangepointSortKey;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenPettittChangepointSourceRow {
  source: string;
  totalTokens: number;
  nActiveDays: number;
  nFilledDays: number;
  /** Pettitt KT = max_t |U[t]|. Always >= 0. */
  kt: number;
  /** KT / (n^2 / 4). Roughly in [0,1] under a clean step shift. 0 if n<2. */
  ktNormalized: number;
  /** Two-sided asymptotic p-value approximation, clamped to [0,1]. */
  pApprox: number;
  /** argmax t. -1 if degenerate. ISO day at this index is `tStarDay`. */
  tStarIndex: number;
  /** ISO YYYY-MM-DD of x[tStarIndex]. null when degenerate. */
  tStarDay: string | null;
  /** Mean of x[0..tStarIndex] (inclusive). 0 when degenerate. */
  meanBefore: number;
  /** Mean of x[tStarIndex+1..n-1]. 0 when degenerate. */
  meanAfter: number;
  /** meanAfter - meanBefore. Sign indicates jump direction. */
  meanShift: number;
  /**
   * Second-best |U[t]| OUTSIDE a guard window of +/- max(3, floor(n/5))
   * around tStarIndex. Surfaces regime multiplicity: a series with two
   * roughly equal-strength changepoints will have kt2 close to kt; a
   * series with a single dominant break will have kt2 << kt.
   * 0 when no candidate exists outside the guard window or when flat.
   */
  kt2: number;
  /** kt2 / kt, in [0, 1]. 0 when kt = 0 or no second candidate. */
  kt2OverKt: number;
  /** argmax t for the second-best |U[t]|. -1 when none. */
  tStar2Index: number;
  /** ISO YYYY-MM-DD at tStar2Index. null when none. */
  tStar2Day: string | null;
  /** True iff series is constant (all values identical) — Pettitt undefined. */
  flat: boolean;
  firstActiveDay: string;
  lastActiveDay: string;
}

export interface DailyTokenPettittChangepointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  top: number;
  sort: DailyTokenPettittChangepointSortKey;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedTopSources: number;
  sources: DailyTokenPettittChangepointSourceRow[];
}

export interface PettittSummary {
  kt: number;
  ktNormalized: number;
  pApprox: number;
  tStarIndex: number;
  meanBefore: number;
  meanAfter: number;
  meanShift: number;
  /** Second-best |U[t]| outside the guard window around tStarIndex. */
  kt2: number;
  /** kt2 / kt, in [0, 1]. */
  kt2OverKt: number;
  /** argmax t for second-best, or -1 if none. */
  tStar2Index: number;
  flat: boolean;
}

/**
 * Pure Pettitt changepoint summary on a real-valued series of length n.
 * Uses an O(n log n) rank-based reformulation:
 *
 *     U[t] = 2 * (sum of ranks of x[0..t]) - (t+1)*(n+1)
 *
 * with ties handled via average ranks. KT = max_t |U[t]|, tStar = argmax.
 */
export function pettittSummary(values: number[]): PettittSummary {
  const n = values.length;
  if (n < 2) {
    return {
      kt: 0,
      ktNormalized: 0,
      pApprox: 1,
      tStarIndex: -1,
      meanBefore: 0,
      meanAfter: 0,
      meanShift: 0,
      kt2: 0,
      kt2OverKt: 0,
      tStar2Index: -1,
      flat: true,
    };
  }
  // Average-rank assignment (R type 7-equivalent for ties via mean rank).
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && indexed[j + 1]!.v === indexed[k]!.v) j += 1;
    // ranks (1-based) k+1 .. j+1 averaged
    const avg = (k + 1 + j + 1) / 2;
    for (let m = k; m <= j; m++) ranks[indexed[m]!.i] = avg;
    k = j + 1;
  }

  // Detect flat series after rank assignment (all equal -> all ranks (n+1)/2).
  let allEqual = true;
  for (let i = 1; i < n; i++) {
    if (values[i] !== values[0]) {
      allEqual = false;
      break;
    }
  }
  if (allEqual) {
    return {
      kt: 0,
      ktNormalized: 0,
      pApprox: 1,
      tStarIndex: -1,
      meanBefore: 0,
      meanAfter: 0,
      meanShift: 0,
      kt2: 0,
      kt2OverKt: 0,
      tStar2Index: -1,
      flat: true,
    };
  }

  // U[t] = 2 * sum_{i<=t} rank[i] - (t+1)*(n+1).  t = 0..n-2.
  // First pass: compute all |U[t]| and find primary tStar.
  const absU = new Array<number>(n - 1);
  let cum = 0;
  let absKt = 0;
  let kt = 0;
  let tStar = 0;
  for (let t = 0; t < n - 1; t++) {
    cum += ranks[t]!;
    const u = 2 * cum - (t + 1) * (n + 1);
    const a = Math.abs(u);
    absU[t] = a;
    if (a > absKt) {
      absKt = a;
      kt = u;
      tStar = t;
    }
  }

  // Second pass: find best |U[t]| OUTSIDE the guard window
  //   [tStar - guard, tStar + guard] (inclusive),
  // where guard = max(3, floor(n/5)). This excludes the immediate
  // neighbourhood of the primary changepoint (where |U[t]| is
  // mechanically near-max because U[t] is piecewise-linear in t).
  const guard = Math.max(3, Math.floor(n / 5));
  let kt2 = 0;
  let tStar2 = -1;
  for (let t = 0; t < n - 1; t++) {
    if (Math.abs(t - tStar) <= guard) continue;
    const a = absU[t]!;
    if (a > kt2) {
      kt2 = a;
      tStar2 = t;
    }
  }

  const ktAbs = Math.abs(kt);
  const denom = (n * n) / 4;
  const ktNormalized = denom > 0 ? ktAbs / denom : 0;
  const expArg = -(6 * ktAbs * ktAbs) / (n * n * n + n * n);
  let p = 2 * Math.exp(expArg);
  if (!Number.isFinite(p) || p < 0) p = 0;
  if (p > 1) p = 1;

  let sumA = 0;
  for (let i = 0; i <= tStar; i++) sumA += values[i]!;
  const meanBefore = sumA / (tStar + 1);
  let sumB = 0;
  for (let i = tStar + 1; i < n; i++) sumB += values[i]!;
  const meanAfter = sumB / (n - tStar - 1);

  return {
    kt: ktAbs,
    ktNormalized,
    pApprox: p,
    tStarIndex: tStar,
    meanBefore,
    meanAfter,
    meanShift: meanAfter - meanBefore,
    kt2,
    kt2OverKt: ktAbs > 0 ? kt2 / ktAbs : 0,
    tStar2Index: tStar2,
    flat: false,
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

const SORT_KEYS: DailyTokenPettittChangepointSortKey[] = [
  'tokens',
  'kt',
  'ktnorm',
  'p',
  'abszshift',
  'tstaridx',
  'kt2overkt',
  'ndays',
];

export function buildDailyTokenPettittChangepoint(
  queue: QueueLine[],
  opts: DailyTokenPettittChangepointOptions = {},
): DailyTokenPettittChangepointReport {
  const minDays = opts.minDays ?? 4;
  if (!Number.isInteger(minDays) || minDays < 4) {
    throw new Error(`minDays must be an integer >= 4 (got ${opts.minDays})`);
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
  const rows: DailyTokenPettittChangepointSourceRow[] = [];
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
    const filledDays: string[] = [];
    let cursor = first;
    for (let i = 0; i < nFilled; i++) {
      filled.push(days.get(cursor) ?? 0);
      filledDays.push(cursor);
      cursor = addDays(cursor, 1);
    }

    const summary = pettittSummary(filled);
    const tStarDay =
      summary.tStarIndex >= 0 && summary.tStarIndex < filledDays.length
        ? filledDays[summary.tStarIndex]!
        : null;
    const tStar2Day =
      summary.tStar2Index >= 0 && summary.tStar2Index < filledDays.length
        ? filledDays[summary.tStar2Index]!
        : null;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: nActive,
      nFilledDays: nFilled,
      kt: summary.kt,
      ktNormalized: summary.ktNormalized,
      pApprox: summary.pApprox,
      tStarIndex: summary.tStarIndex,
      tStarDay,
      meanBefore: summary.meanBefore,
      meanAfter: summary.meanAfter,
      meanShift: summary.meanShift,
      kt2: summary.kt2,
      kt2OverKt: summary.kt2OverKt,
      tStar2Index: summary.tStar2Index,
      tStar2Day,
      flat: summary.flat,
      firstActiveDay: first,
      lastActiveDay: last,
    });
  }

  rows.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'kt':
        primary = b.kt - a.kt;
        break;
      case 'ktnorm':
        primary = b.ktNormalized - a.ktNormalized;
        break;
      case 'p':
        primary = a.pApprox - b.pApprox; // smallest p first (most significant)
        break;
      case 'abszshift':
        primary = Math.abs(b.meanShift) - Math.abs(a.meanShift);
        break;
      case 'tstaridx':
        primary = b.tStarIndex - a.tStarIndex;
        break;
      case 'kt2overkt':
        primary = b.kt2OverKt - a.kt2OverKt;
        break;
      case 'ndays':
        primary = b.nFilledDays - a.nFilledDays;
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
