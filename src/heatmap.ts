/**
 * Hour-of-day × day-of-week token-activity heatmap.
 *
 * Aggregates `QueueLine[]` into a 7×24 matrix to surface diurnal /
 * weekly cycles in pew usage. Where `trend` and `anomalies` collapse
 * everything onto a single time axis (per-day totals), this module
 * keeps the *cycle* dimension separate so a steady night-owl regime
 * doesn't read as "anomalous late-night spike" — it reads as the
 * shape of the work itself.
 *
 * Why a separate subcommand (instead of folding into `digest`):
 *
 *   - `digest` is window-totals; one row per day OR per hour, never
 *     a 2D cross. A 7×24 matrix is the smallest grid that exposes
 *     both cycles at once, and it composes poorly with the existing
 *     row-stacked tables.
 *   - The peak-cell + concentration metrics here (Gini-style) are
 *     summary stats *over the matrix*, not over a 1D series. They
 *     don't have a natural home in `trend` or `anomalies`.
 *   - `forecast` already uses dayOfWeek internally for seasonal
 *     residuals, but never exposes the day-of-week shape directly.
 *     This subcommand is the operator-facing view of that shape.
 *
 * Determinism: the pure builder takes `asOf` and never reads
 * Date.now(). All time-bucket arithmetic happens against the
 * QueueLine.hour_start ISO timestamp, which is already
 * hour-aligned by pew's writer (see PEW_INTERNALS.md).
 *
 * Timezone: by default we bucket in UTC because that's what
 * `hour_start` is stored in and it's the only globally-stable
 * choice. Pass `tz: 'local'` to bucket in the host's local time —
 * useful when the user wants to see "my actual workday shape"
 * rather than UTC. The local conversion uses `Date.toLocaleString`
 * so the host TZ database does the work; we never hand-roll
 * offsets.
 */
import type { QueueLine } from './types.js';

export type HeatmapMetric =
  | 'total'  // total_tokens
  | 'input'  // input_tokens (uncached portion only — see ratios.ts notes)
  | 'cached' // cached_input_tokens
  | 'output'; // output_tokens + reasoning_output_tokens

export type HeatmapTz = 'utc' | 'local';

export interface HeatmapOptions {
  /** How many days of history to include. Default 30. */
  lookbackDays?: number;
  /** Which token field to aggregate. Default 'total'. */
  metric?: HeatmapMetric;
  /** Bucket in UTC or host-local time. Default 'utc'. */
  tz?: HeatmapTz;
  /** Cutoff timestamp; defaults to now. */
  asOf?: string;
}

export interface HeatmapCell {
  /** ISO day-of-week, 1=Mon..7=Sun. */
  dow: number;
  /** Hour-of-day, 0..23. */
  hour: number;
  tokens: number;
}

export interface HeatmapReport {
  asOf: string;
  lookbackDays: number;
  metric: HeatmapMetric;
  tz: HeatmapTz;
  /** Inclusive UTC date string of oldest day in window. */
  windowStart: string;
  /** Inclusive UTC date string of newest day in window. */
  windowEnd: string;
  /** 7 rows (Mon..Sun) × 24 cols (00..23). cells[dow-1][hour] = tokens. */
  cells: number[][];
  /** Sum across each row. rowTotals[dow-1] = tokens for that ISO dow. */
  rowTotals: number[];
  /** Sum across each col. colTotals[hour] = tokens for that hour. */
  colTotals: number[];
  /** Sum of every cell. Equals sum(rowTotals) == sum(colTotals). */
  grandTotal: number;
  /** Highest-tokens cell, or null if matrix is empty. */
  peakCell: HeatmapCell | null;
  /** Largest rowTotal index (1..7), or null on empty matrix. */
  peakDow: number | null;
  /** Largest colTotal index (0..23), or null on empty matrix. */
  peakHour: number | null;
  /**
   * Share of `grandTotal` accounted for by the peak 4 hours of the
   * day (any 4 consecutive hours in colTotals, wrapping 23→0). 0..1.
   * 0.167 (= 4/24) is perfectly uniform; values near 1.0 mean activity
   * is sharply concentrated in a small window. null on empty matrix.
   */
  diurnalConcentration: number | null;
  /**
   * Share of `grandTotal` accounted for by the top 2 days of the
   * week (any 2 days, not necessarily consecutive). 0..1. 0.286
   * (= 2/7) is uniform; values near 1.0 mean usage clusters on
   * just a couple of days. null on empty matrix.
   */
  weeklyConcentration: number | null;
  /**
   * Number of QueueLine events that fed the matrix (after window
   * filtering). Surfaces "is the matrix sparse?" without forcing
   * the operator to sum cells by hand.
   */
  events: number;
}

const ISO_DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Public constant — keeps render layer in lockstep with builder. */
export const HEATMAP_DOW_LABELS = ISO_DOW_LABELS;

/**
 * Convert a JS UTCDay (0=Sun..6=Sat) to ISO day-of-week (1=Mon..7=Sun).
 * Pulled out so both UTC and local paths route through the same map.
 */
function toIsoDow(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Pull the {dow, hour} bucket out of an ISO timestamp.
 *
 * UTC path: parse, read getUTCDay/getUTCHours. Stable across hosts.
 *
 * Local path: we deliberately *don't* use getDay/getHours, because
 * those depend on the V8 timezone offset *for the parsed instant*.
 * That's actually what we want — the local calendar position of the
 * event — but the safer expression of intent is `toLocaleString`
 * with `hour12: false` and explicit fields, which forces the runtime
 * to hand back the local-calendar values without us doing any offset
 * math by hand.
 */
function bucketOf(iso: string, tz: HeatmapTz): { dow: number; hour: number } {
  const d = new Date(iso);
  if (tz === 'utc') {
    return { dow: toIsoDow(d.getUTCDay()), hour: d.getUTCHours() };
  }
  // Local TZ: use Intl to extract weekday + hour without doing offset math.
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const dowMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const dow = dowMap[weekdayShort] ?? 1;
  // Intl can return '24' for midnight in some locales; normalise to 0.
  const hourNum = Number.parseInt(hourStr, 10);
  const hour = hourNum === 24 ? 0 : hourNum;
  return { dow, hour };
}

/** Pick the right token field from a QueueLine for the chosen metric. */
function tokensFor(q: QueueLine, metric: HeatmapMetric): number {
  switch (metric) {
    case 'input': return q.input_tokens;
    case 'cached': return q.cached_input_tokens;
    case 'output': return q.output_tokens + q.reasoning_output_tokens;
    case 'total':
    default: return q.total_tokens;
  }
}

/**
 * Compute the largest sum of any K *consecutive* entries in `xs`,
 * with wrap-around. Used by diurnalConcentration: "any 4 consecutive
 * hours" implies a sliding window over a circular 24-element array,
 * because peak windows can straddle midnight (e.g. 22:00–01:59).
 *
 * O(n) — single pass with a running sum after seeding the first
 * window. n=24 always so this is trivially fast; we keep the
 * algorithm tight anyway because it's also called from tests with
 * synthetic inputs.
 */
function maxWindowSumCircular(xs: number[], k: number): number {
  const n = xs.length;
  if (n === 0 || k <= 0) return 0;
  if (k >= n) {
    let s = 0;
    for (const x of xs) s += x;
    return s;
  }
  // Seed: first k elements.
  let cur = 0;
  for (let i = 0; i < k; i++) cur += xs[i]!;
  let best = cur;
  // Slide n-1 more times, wrapping the leaving index.
  for (let start = 1; start < n; start++) {
    const leaving = xs[(start - 1) % n]!;
    const entering = xs[(start + k - 1) % n]!;
    cur = cur - leaving + entering;
    if (cur > best) best = cur;
  }
  return best;
}

/** Sum of the top-K values in `xs` (any positions, not consecutive). */
function topKSum(xs: number[], k: number): number {
  if (k <= 0 || xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => b - a);
  let s = 0;
  for (let i = 0; i < Math.min(k, sorted.length); i++) s += sorted[i]!;
  return s;
}

/**
 * UTC date `n` days before `asOf`, returned as `YYYY-MM-DD`. Inclusive
 * window semantics match `trend.buildDailySeries`.
 */
function daysAgoUtc(asOf: string, n: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function buildHeatmap(
  queue: QueueLine[],
  opts: HeatmapOptions = {},
): HeatmapReport {
  const lookbackDays = opts.lookbackDays ?? 30;
  const metric: HeatmapMetric = opts.metric ?? 'total';
  const tz: HeatmapTz = opts.tz ?? 'utc';
  const asOf = opts.asOf ?? new Date().toISOString();

  if (lookbackDays < 1) {
    throw new Error(`lookbackDays must be >= 1 (got ${lookbackDays})`);
  }

  // Window cutoff: include only events on/after this UTC date.
  // We compare against the YYYY-MM-DD prefix of hour_start so the
  // boundary semantics match the rest of the codebase (UTC-day grid,
  // same as trend.ts/anomalies.ts).
  const windowStart = daysAgoUtc(asOf, lookbackDays - 1);
  const windowEnd = asOf.slice(0, 10);

  // Build the empty 7×24 matrix.
  const cells: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let events = 0;

  for (const q of queue) {
    const day = q.hour_start.slice(0, 10);
    if (day < windowStart) continue;
    if (day > windowEnd) continue;
    const { dow, hour } = bucketOf(q.hour_start, tz);
    const tokens = tokensFor(q, metric);
    const row = cells[dow - 1]!;
    row[hour] = (row[hour] ?? 0) + tokens;
    events += 1;
  }

  // Marginals.
  const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    let s = 0;
    for (let r = 0; r < 7; r++) s += cells[r]![h]!;
    colTotals[h] = s;
  }
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  // Peaks + concentration. All null on an empty matrix to avoid
  // misleading 0/0 reports.
  let peakCell: HeatmapCell | null = null;
  let peakDow: number | null = null;
  let peakHour: number | null = null;
  let diurnalConcentration: number | null = null;
  let weeklyConcentration: number | null = null;

  if (grandTotal > 0) {
    let bestTokens = -1;
    for (let r = 0; r < 7; r++) {
      for (let h = 0; h < 24; h++) {
        const v = cells[r]![h]!;
        if (v > bestTokens) {
          bestTokens = v;
          peakCell = { dow: r + 1, hour: h, tokens: v };
        }
      }
    }
    // peakDow / peakHour from marginals — argmax with ties broken
    // by lower index for determinism (matches Array.indexOf).
    let bestRow = 0;
    for (let r = 1; r < 7; r++) {
      if (rowTotals[r]! > rowTotals[bestRow]!) bestRow = r;
    }
    peakDow = bestRow + 1;
    let bestCol = 0;
    for (let h = 1; h < 24; h++) {
      if (colTotals[h]! > colTotals[bestCol]!) bestCol = h;
    }
    peakHour = bestCol;

    diurnalConcentration = maxWindowSumCircular(colTotals, 4) / grandTotal;
    weeklyConcentration = topKSum(rowTotals, 2) / grandTotal;
  }

  return {
    asOf,
    lookbackDays,
    metric,
    tz,
    windowStart,
    windowEnd,
    cells,
    rowTotals,
    colTotals,
    grandTotal,
    peakCell,
    peakDow,
    peakHour,
    diurnalConcentration,
    weeklyConcentration,
    events,
  };
}
