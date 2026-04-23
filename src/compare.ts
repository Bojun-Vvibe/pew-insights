/**
 * A/B comparison of two windows of queue activity.
 *
 * Design notes
 * ------------
 * Given two named time windows A and B (each a half-open ISO range), we group
 * queue rows by a chosen dimension (`source` or `model`) and produce per-key
 * deltas plus a coarse "significance hint" derived from a two-sample Welch's
 * t-test over per-day totals within each window.
 *
 * Why per-day instead of per-event?
 *   Per-event values are wildly heteroskedastic — a single big batch can flip
 *   any test. Per-day totals are the natural grain users reason about and
 *   smooth out single-event spikes. We require ≥2 days per window to compute
 *   any t at all.
 *
 * Why Welch and not Student?
 *   We don't assume equal variance between windows; the windows are usually
 *   the same length but the *spread* often differs (bursty week vs steady
 *   week). Welch handles that.
 *
 * Significance hint mapping (NOT a real p-value):
 *   - If either window has fewer than 2 days of data → 'insufficient'
 *   - If both windows are zero → 'n/s'
 *   - Otherwise: compute |t|, then use a crude lookup against the
 *     normal-approximation tails (df is roughly Welch–Satterthwaite, but we
 *     approximate by treating the test as a z-test for moderate df):
 *         |t| ≥ 1.96  → 'significant'  (~p < 0.05)
 *         |t| ≥ 1.28  → 'weak'         (~p < 0.20)
 *         else        → 'n/s'
 *   This is intentionally a *hint*, not a publication-grade test. The README
 *   calls this out.
 *
 * Window naming aliases
 *   For convenience the CLI accepts two preset alias pairs:
 *     'this-week' vs 'last-week'   — Mon..Sun ISO weeks
 *     'today' vs 'yesterday'       — UTC days
 *   Plus arbitrary `--a-from / --a-until / --b-from / --b-until` ISO ranges.
 */
import { normaliseModel } from './parsers.js';
import type { QueueLine } from './types.js';

export type CompareDimension = 'source' | 'model';
export type SignificanceHint = 'significant' | 'weak' | 'n/s' | 'insufficient';

export interface CompareWindow {
  /** Display label, e.g. 'this-week'. */
  label: string;
  /** Inclusive ISO start. */
  from: string;
  /** Exclusive ISO until. */
  until: string;
}

export interface ComparePresetResult {
  a: CompareWindow;
  b: CompareWindow;
}

export interface CompareRow {
  key: string;
  aTokens: number;
  bTokens: number;
  aEvents: number;
  bEvents: number;
  delta: number; // a - b
  pct: number | null; // (a - b) / b
  /** Welch t statistic over per-day token totals; null when insufficient. */
  t: number | null;
  hint: SignificanceHint;
}

export interface CompareReport {
  dimension: CompareDimension;
  a: CompareWindow;
  b: CompareWindow;
  aTotalTokens: number;
  bTotalTokens: number;
  rows: CompareRow[];
}

// ---------------------------------------------------------------------------
// Window presets
// ---------------------------------------------------------------------------

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isoWeekMonday(d: Date): Date {
  const dow = d.getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  const monday = addDays(d, -(isoDow - 1));
  return new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
}

/**
 * Resolve a preset name pair (e.g. 'this-week' vs 'last-week') into two
 * concrete ISO windows anchored at `asOf`. Returns null if `name` is not a
 * known preset.
 */
export function resolveComparePreset(name: string, asOf?: string): ComparePresetResult | null {
  const at = asOf ? new Date(asOf) : new Date();
  switch (name) {
    case 'this-week-vs-last-week':
    case 'wow':
    case 'week-over-week': {
      const thisMon = isoWeekMonday(at);
      const nextMon = addDays(thisMon, 7);
      const lastMon = addDays(thisMon, -7);
      return {
        a: { label: 'this-week', from: thisMon.toISOString(), until: nextMon.toISOString() },
        b: { label: 'last-week', from: lastMon.toISOString(), until: thisMon.toISOString() },
      };
    }
    case 'today-vs-yesterday':
    case 'dod':
    case 'day-over-day': {
      const today = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
      const tomorrow = addDays(today, 1);
      const yesterday = addDays(today, -1);
      return {
        a: { label: 'today', from: today.toISOString(), until: tomorrow.toISOString() },
        b: { label: 'yesterday', from: yesterday.toISOString(), until: today.toISOString() },
      };
    }
    case 'last-7d-vs-prior-7d':
    case 'rolling-week': {
      const end = at;
      const aFrom = new Date(end.getTime() - 7 * 86_400_000);
      const bFrom = new Date(end.getTime() - 14 * 86_400_000);
      return {
        a: { label: 'last-7d', from: aFrom.toISOString(), until: end.toISOString() },
        b: { label: 'prior-7d', from: bFrom.toISOString(), until: aFrom.toISOString() },
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface DayStats {
  /** Per-day token totals across all days in the window (zero-filled). */
  series: number[];
  totalTokens: number;
  events: number;
}

function dayStatsFor(
  queue: QueueLine[],
  win: CompareWindow,
  keyOf: (q: QueueLine) => string | null,
  filterKey: string,
): DayStats {
  const buckets = new Map<string, number>();
  let total = 0;
  let events = 0;
  for (const q of queue) {
    if (q.hour_start < win.from || q.hour_start >= win.until) continue;
    const k = keyOf(q);
    if (k !== filterKey) continue;
    const day = q.hour_start.slice(0, 10);
    const t = q.total_tokens || 0;
    buckets.set(day, (buckets.get(day) ?? 0) + t);
    total += t;
    events += 1;
  }
  // Zero-fill across the window's day span.
  const start = new Date(win.from.slice(0, 10) + 'T00:00:00Z');
  const end = new Date(win.until.slice(0, 10) + 'T00:00:00Z');
  // Number of days in [start, end). For windows where until time is non-midnight,
  // round up to include the partial day so series length is consistent.
  let days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  if (days < 1) days = 1;
  const series: number[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    series.push(buckets.get(isoDay(d)) ?? 0);
  }
  return { series, totalTokens: total, events };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sampleVariance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return acc / (xs.length - 1);
}

/** Welch's t statistic; returns null when either sample has < 2 entries or both variances are zero with equal means. */
export function welchT(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const va = sampleVariance(a);
  const vb = sampleVariance(b);
  const denom = Math.sqrt(va / a.length + vb / b.length);
  if (denom === 0) {
    if (ma === mb) return 0;
    return ma > mb ? Infinity : -Infinity;
  }
  return (ma - mb) / denom;
}

function classify(t: number | null, aLen: number, bLen: number): SignificanceHint {
  if (aLen < 2 || bLen < 2) return 'insufficient';
  if (t === null) return 'insufficient';
  if (!Number.isFinite(t)) return 'significant';
  const abs = Math.abs(t);
  if (abs >= 1.96) return 'significant';
  if (abs >= 1.28) return 'weak';
  return 'n/s';
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export interface CompareOptions {
  /** Drop dimension keys whose combined a+b tokens are below this threshold. */
  minTokens?: number;
  /** Cap the number of rows returned. */
  topN?: number;
}

function keyExtractor(dim: CompareDimension): (q: QueueLine) => string | null {
  if (dim === 'source') return (q) => q.source || 'unknown';
  return (q) => normaliseModel(q.model);
}

export function buildCompare(
  queue: QueueLine[],
  a: CompareWindow,
  b: CompareWindow,
  dimension: CompareDimension,
  opts: CompareOptions = {},
): CompareReport {
  const keyOf = keyExtractor(dimension);
  const allKeys = new Set<string>();
  let aTotal = 0;
  let bTotal = 0;
  for (const q of queue) {
    const inA = q.hour_start >= a.from && q.hour_start < a.until;
    const inB = q.hour_start >= b.from && q.hour_start < b.until;
    if (!inA && !inB) continue;
    const k = keyOf(q);
    if (!k) continue;
    allKeys.add(k);
    const t = q.total_tokens || 0;
    if (inA) aTotal += t;
    if (inB) bTotal += t;
  }

  const minTokens = opts.minTokens ?? 0;
  const rows: CompareRow[] = [];
  for (const k of allKeys) {
    const aStats = dayStatsFor(queue, a, keyOf, k);
    const bStats = dayStatsFor(queue, b, keyOf, k);
    if (aStats.totalTokens + bStats.totalTokens < minTokens) continue;
    const t = welchT(aStats.series, bStats.series);
    rows.push({
      key: k,
      aTokens: aStats.totalTokens,
      bTokens: bStats.totalTokens,
      aEvents: aStats.events,
      bEvents: bStats.events,
      delta: aStats.totalTokens - bStats.totalTokens,
      pct: bStats.totalTokens === 0 ? null : (aStats.totalTokens - bStats.totalTokens) / bStats.totalTokens,
      t,
      hint: classify(t, aStats.series.length, bStats.series.length),
    });
  }

  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const trimmed = opts.topN != null ? rows.slice(0, opts.topN) : rows;

  return {
    dimension,
    a,
    b,
    aTotalTokens: aTotal,
    bTotalTokens: bTotal,
    rows: trimmed,
  };
}
