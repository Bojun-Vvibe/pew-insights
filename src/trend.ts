/**
 * Trend analysis: week-over-week and day-over-day deltas with
 * ASCII sparklines.
 *
 * The `since` window for callers is the *display* window — what to
 * render in the sparkline and breakdown. The deltas always compare
 * the most recent N days (default 7) against the prior N days, and
 * the most recent 24h against the prior 24h, regardless of `since`.
 * That keeps the headline numbers stable as the user scopes in/out.
 */
import { normaliseModel } from './parsers.js';
import type { QueueLine } from './types.js';

// ---------------------------------------------------------------------------
// ASCII sparkline
// ---------------------------------------------------------------------------

const SPARK_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/**
 * Render a numeric series as a unicode block sparkline. Empty series
 * returns ''. All-zero / single-value series renders as a baseline
 * row of '▁' chars (no division-by-zero blowups).
 */
export function asciiSparkline(values: number[]): string {
  if (values.length === 0) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    const x = Number.isFinite(v) ? v : 0;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min)) return SPARK_CHARS[0]!.repeat(values.length);
  if (max === min) return SPARK_CHARS[0]!.repeat(values.length);
  const range = max - min;
  const last = SPARK_CHARS.length - 1;
  let out = '';
  for (const v of values) {
    const x = Number.isFinite(v) ? v : 0;
    const t = (x - min) / range;
    let idx = Math.round(t * last);
    if (idx < 0) idx = 0;
    if (idx > last) idx = last;
    out += SPARK_CHARS[idx];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Daily series construction
// ---------------------------------------------------------------------------

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a complete day-by-day token series ending at `endDay` (inclusive)
 * spanning `days` calendar days. Days with no events are filled with 0
 * so deltas / sparklines line up correctly.
 */
export function buildDailySeries(
  queue: QueueLine[],
  endDay: string,
  days: number,
): Array<{ day: string; tokens: number; events: number }> {
  const buckets = new Map<string, { tokens: number; events: number }>();
  for (const q of queue) {
    const k = dayKey(q.hour_start);
    const e = buckets.get(k) ?? { tokens: 0, events: 0 };
    e.tokens += q.total_tokens || 0;
    e.events += 1;
    buckets.set(k, e);
  }
  const out: Array<{ day: string; tokens: number; events: number }> = [];
  // Walk backwards from endDay.
  const end = new Date(endDay + 'T00:00:00.000Z');
  for (let i = days - 1; i >= 0; i--) {
    const d = isoDay(addDays(end, -i));
    const e = buckets.get(d) ?? { tokens: 0, events: 0 };
    out.push({ day: d, ...e });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hourly series (for day-over-day comparison)
// ---------------------------------------------------------------------------

/**
 * Sum of total_tokens for queue rows whose hour_start is in
 * [from, until).
 */
export function sumTokensInRange(
  queue: QueueLine[],
  fromIso: string,
  untilIso: string,
): { tokens: number; events: number } {
  let tokens = 0;
  let events = 0;
  for (const q of queue) {
    if (q.hour_start >= fromIso && q.hour_start < untilIso) {
      tokens += q.total_tokens || 0;
      events += 1;
    }
  }
  return { tokens, events };
}

// ---------------------------------------------------------------------------
// Trend report
// ---------------------------------------------------------------------------

export interface DeltaWindow {
  /** Tokens in the most-recent window. */
  current: number;
  /** Tokens in the directly-preceding window of the same length. */
  previous: number;
  /** Absolute delta = current - previous. */
  delta: number;
  /** Fractional change. `null` when previous == 0 (avoid div-by-zero). */
  pct: number | null;
}

export interface TrendReport {
  since: string | null;
  /** End instant of the analysis window (defaults to now). */
  asOf: string;
  /** Day-over-day comparison: last 24h vs prior 24h ending at asOf. */
  dod: DeltaWindow;
  /** Week-over-week comparison: last 7 days vs prior 7 days ending at asOf. */
  wow: DeltaWindow;
  /** Daily token series for the display window (oldest → newest). */
  series: Array<{ day: string; tokens: number; events: number }>;
  /** Display-window sparkline rendered as unicode block chars. */
  sparkline: string;
  /** Per-model breakdown limited to the display window. */
  byModel: Array<{
    model: string;
    current: number;
    previous: number;
    delta: number;
    pct: number | null;
    sparkline: string;
  }>;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

function deltaWindow(current: number, previous: number): DeltaWindow {
  return { current, previous, delta: current - previous, pct: pctChange(current, previous) };
}

export interface TrendOptions {
  /** ISO timestamp marking the analysis cutoff (default: now). */
  asOf?: string;
  /** Display-window length in days (default 14). */
  windowDays?: number;
}

/**
 * Build a trend report. `since` is preserved for callers that want to
 * report what window they asked for, but the actual deltas use fixed
 * 24h / 7d offsets relative to `asOf` so headline numbers don't drift.
 */
export function buildTrend(
  queue: QueueLine[],
  since: string | null,
  opts: TrendOptions = {},
): TrendReport {
  const asOf = opts.asOf ?? new Date().toISOString();
  const windowDays = opts.windowDays ?? 14;
  const asOfMs = new Date(asOf).getTime();

  // Day-over-day: last 24h vs prior 24h.
  const dodCurStart = new Date(asOfMs - 24 * 3_600_000).toISOString();
  const dodPrevStart = new Date(asOfMs - 48 * 3_600_000).toISOString();
  const dodCur = sumTokensInRange(queue, dodCurStart, asOf);
  const dodPrev = sumTokensInRange(queue, dodPrevStart, dodCurStart);

  // Week-over-week: last 7d vs prior 7d.
  const wowCurStart = new Date(asOfMs - 7 * 86_400_000).toISOString();
  const wowPrevStart = new Date(asOfMs - 14 * 86_400_000).toISOString();
  const wowCur = sumTokensInRange(queue, wowCurStart, asOf);
  const wowPrev = sumTokensInRange(queue, wowPrevStart, wowCurStart);

  // Display series.
  const endDay = asOf.slice(0, 10);
  const series = buildDailySeries(queue, endDay, windowDays);

  // Per-model breakdown (top 8 models in current week).
  const halfMs = (windowDays / 2) * 86_400_000;
  const splitIso = new Date(asOfMs - halfMs).toISOString();
  const startIso = new Date(asOfMs - windowDays * 86_400_000).toISOString();

  const modelCur = new Map<string, number>();
  const modelPrev = new Map<string, number>();
  const modelSeries = new Map<string, number[]>();

  // Initialise per-day per-model buckets.
  for (const s of series) {
    for (const arr of modelSeries.values()) arr.push(0);
    void s;
  }

  for (const q of queue) {
    if (q.hour_start < startIso || q.hour_start >= asOf) continue;
    const m = normaliseModel(q.model);
    const t = q.total_tokens || 0;
    if (q.hour_start >= splitIso) {
      modelCur.set(m, (modelCur.get(m) ?? 0) + t);
    } else {
      modelPrev.set(m, (modelPrev.get(m) ?? 0) + t);
    }
    // Sparkline series per model.
    const dayIdx = series.findIndex((s) => s.day === dayKey(q.hour_start));
    if (dayIdx >= 0) {
      let arr = modelSeries.get(m);
      if (!arr) {
        arr = new Array(series.length).fill(0);
        modelSeries.set(m, arr);
      }
      arr[dayIdx] = (arr[dayIdx] ?? 0) + t;
    }
  }

  const allModels = new Set([...modelCur.keys(), ...modelPrev.keys()]);
  const byModel = Array.from(allModels)
    .map((m) => {
      const cur = modelCur.get(m) ?? 0;
      const prev = modelPrev.get(m) ?? 0;
      return {
        model: m,
        current: cur,
        previous: prev,
        delta: cur - prev,
        pct: pctChange(cur, prev),
        sparkline: asciiSparkline(modelSeries.get(m) ?? []),
      };
    })
    .sort((a, b) => b.current - a.current)
    .slice(0, 8);

  return {
    since,
    asOf,
    dod: deltaWindow(dodCur.tokens, dodPrev.tokens),
    wow: deltaWindow(wowCur.tokens, wowPrev.tokens),
    series,
    sparkline: asciiSparkline(series.map((s) => s.tokens)),
    byModel,
  };
}
