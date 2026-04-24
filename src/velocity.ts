/**
 * Token-velocity analysis: tokens-per-minute during *active stretches*.
 *
 * Where `trend` collapses each day to a single magnitude, `streaks`
 * categorises whole days as ACTIVE/IDLE, `heatmap` averages over
 * the diurnal/weekly cycle, and `anomalies` flags single-day outliers,
 * none of those answer the *intensity* question: when you were
 * actually working, how hard were you hitting the API?
 *
 * Concretely, given the hourly `QueueLine` buckets in a window, we:
 *
 *   1. Project them onto a contiguous, zero-filled hour grid
 *      ending at the window's last hour. Empty hours read as 0
 *      tokens, which is the right thing for stretch boundaries.
 *   2. Walk the grid and gather *active stretches*: maximal runs of
 *      consecutive hours whose total_tokens >= `minTokensPerHour`
 *      (default 1 — any usage at all separates a stretch from the
 *      idle hours around it).
 *   3. For each stretch report tokens, hours, and the derived
 *      tokens/minute = totalTokens / (hours * 60). Velocity is what
 *      makes this distinct from the existing builders — it's a
 *      *rate*, not a sum.
 *   4. Surface a peak stretch by velocity (the burstiest run),
 *      median velocity (a robust "typical active hour"), and the
 *      top-N stretches sorted by velocity desc.
 *
 * Why a separate subcommand:
 *
 *   - `digest`/`trend` aggregate by day; a 90-minute frenzy and a
 *     90-minute trickle that produced the same daily total are
 *     indistinguishable to them. Velocity separates them.
 *   - `heatmap` averages over weeks of hour-of-day cells, which
 *     smears single-event bursts across the long-run mean. A
 *     stretch is the opposite: a single contiguous event.
 *   - `streaks` is *day*-granular and binary (active vs idle); it
 *     never measures within-day intensity.
 *   - `anomalies` flags daily totals; a daily total is a flat
 *     average over 24 hours and hides the within-day rate.
 *
 * Determinism: pure builder, takes `asOf` and never reads
 * `Date.now()`. The hour grid is UTC-aligned to match
 * `buildDailySeries` and `buildHeatmap`. Sort is fully deterministic
 * (velocity desc, then hours desc, then startHour asc).
 */
import type { QueueLine } from './types.js';

export interface VelocityOptions {
  /**
   * How many hours of history to include, ending at `asOf`'s hour.
   * Default 168 (7 days). Must be >= 1.
   */
  lookbackHours?: number;
  /**
   * Minimum total_tokens for an hour to count as ACTIVE. Default 1
   * (any usage). Raise this to ignore trickle-only hours and only
   * stretch-merge hours of substantive work. Must be >= 0.
   */
  minTokensPerHour?: number;
  /**
   * Cap top-stretches table. Default 10. Must be a positive integer.
   */
  topN?: number;
  /**
   * Cutoff timestamp; defaults to now. The window is the
   * `lookbackHours` ending at the hour containing `asOf` (inclusive).
   */
  asOf?: string;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface VelocityStretch {
  /** Inclusive ISO start of the first active hour in the stretch. */
  startHour: string;
  /** Inclusive ISO start of the last active hour in the stretch. */
  endHour: string;
  /** Number of consecutive active hours. >= 1. */
  hours: number;
  /** Sum of total_tokens across the stretch. */
  tokens: number;
  /** Sum of input_tokens across the stretch. */
  inputTokens: number;
  /** Sum of output_tokens across the stretch. */
  outputTokens: number;
  /** Number of QueueLine events that contributed (per-row count). */
  events: number;
  /**
   * Derived rate: tokens / (hours * 60). Always >= 0; finite. We
   * divide by *hours*, not by wall-clock minutes between
   * `startHour` and `endHour`, so a 1-hour stretch is consistently
   * `tokens / 60` regardless of where in the hour the first event
   * landed (the bucket is hour-aligned upstream).
   */
  tokensPerMinute: number;
}

export interface VelocityReport {
  generatedAt: string;
  /** Inclusive ISO start of the oldest hour-bucket considered. */
  windowStart: string;
  /** Inclusive ISO start of the newest hour-bucket considered. */
  windowEnd: string;
  lookbackHours: number;
  minTokensPerHour: number;
  topN: number;
  /** Total active hours across all stretches. */
  totalActiveHours: number;
  /** Number of distinct stretches found. */
  stretchCount: number;
  /** Sum of tokens across all active hours in the window. */
  totalActiveTokens: number;
  /**
   * Aggregate velocity: totalActiveTokens / (totalActiveHours * 60).
   * 0 when there are no active hours. This is the "while you were
   * working, your average rate" headline.
   */
  averageTokensPerMinute: number;
  /**
   * Median per-stretch velocity. null when stretchCount == 0.
   * Robust to a single screaming-fast stretch dominating the mean.
   */
  medianTokensPerMinute: number | null;
  /** Stretch with the highest tokensPerMinute. null when none. */
  peakStretch: VelocityStretch | null;
  /** Stretch with the most hours. null when none. Tie-break: higher tokens. */
  longestStretch: VelocityStretch | null;
  /**
   * Top-N stretches sorted by tokensPerMinute desc, hours desc,
   * startHour asc.
   */
  topStretches: VelocityStretch[];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const HOUR_MS = 3600 * 1000;

function hourFloorIso(iso: string): string {
  // hour_start is already hour-aligned per pew's writer, but be defensive.
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const floored = Math.floor(t / HOUR_MS) * HOUR_MS;
  return new Date(floored).toISOString();
}

function addHoursIso(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * HOUR_MS).toISOString();
}

interface HourBucket {
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  events: number;
}

function emptyBucket(): HourBucket {
  return { tokens: 0, inputTokens: 0, outputTokens: 0, events: 0 };
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sortedAsc[mid]!;
  return (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export function buildVelocity(queue: QueueLine[], opts: VelocityOptions = {}): VelocityReport {
  const lookbackHours = opts.lookbackHours ?? 168;
  const minTokensPerHour = opts.minTokensPerHour ?? 1;
  const topN = opts.topN ?? 10;

  if (!Number.isInteger(lookbackHours) || lookbackHours < 1) {
    throw new Error(`lookbackHours must be a positive integer (got ${opts.lookbackHours})`);
  }
  if (!Number.isFinite(minTokensPerHour) || minTokensPerHour < 0) {
    throw new Error(`minTokensPerHour must be >= 0 (got ${opts.minTokensPerHour})`);
  }
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${opts.topN})`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const asOf = opts.asOf ?? generatedAt;
  const endHour = hourFloorIso(asOf);
  const startHour = addHoursIso(endHour, -(lookbackHours - 1));

  // 1. Project queue onto hour grid.
  const buckets = new Map<string, HourBucket>();
  for (const q of queue) {
    const h = hourFloorIso(q.hour_start);
    if (h < startHour || h > endHour) continue;
    const b = buckets.get(h) ?? emptyBucket();
    b.tokens += q.total_tokens || 0;
    b.inputTokens += q.input_tokens || 0;
    b.outputTokens += q.output_tokens || 0;
    b.events += 1;
    buckets.set(h, b);
  }

  // 2. Walk the grid forward; build maximal active stretches.
  const stretches: VelocityStretch[] = [];
  let cur:
    | (HourBucket & { startHour: string; endHour: string; hours: number })
    | null = null;

  for (let i = 0; i < lookbackHours; i += 1) {
    const h = addHoursIso(startHour, i);
    const b = buckets.get(h) ?? emptyBucket();
    const isActive = b.tokens >= minTokensPerHour && b.tokens > 0;
    if (isActive) {
      if (cur == null) {
        cur = { startHour: h, endHour: h, hours: 1, ...b };
      } else {
        cur.endHour = h;
        cur.hours += 1;
        cur.tokens += b.tokens;
        cur.inputTokens += b.inputTokens;
        cur.outputTokens += b.outputTokens;
        cur.events += b.events;
      }
    } else if (cur != null) {
      stretches.push(finalizeStretch(cur));
      cur = null;
    }
  }
  if (cur != null) stretches.push(finalizeStretch(cur));

  // 3. Aggregates.
  const totalActiveHours = stretches.reduce((a, s) => a + s.hours, 0);
  const totalActiveTokens = stretches.reduce((a, s) => a + s.tokens, 0);
  const averageTokensPerMinute =
    totalActiveHours === 0 ? 0 : totalActiveTokens / (totalActiveHours * 60);

  let medianTokensPerMinute: number | null = null;
  let peakStretch: VelocityStretch | null = null;
  let longestStretch: VelocityStretch | null = null;
  if (stretches.length > 0) {
    const sortedRates = [...stretches.map((s) => s.tokensPerMinute)].sort(
      (a, b) => a - b,
    );
    medianTokensPerMinute = median(sortedRates);

    // peak by velocity, tie-break: more hours, then earlier startHour.
    peakStretch = [...stretches].sort(stretchVelocityCmp)[0]!;
    // longest by hours, tie-break: more tokens, then earlier startHour.
    longestStretch = [...stretches].sort(stretchHoursCmp)[0]!;
  }

  const topStretches = [...stretches].sort(stretchVelocityCmp).slice(0, topN);

  return {
    generatedAt,
    windowStart: startHour,
    windowEnd: endHour,
    lookbackHours,
    minTokensPerHour,
    topN,
    totalActiveHours,
    stretchCount: stretches.length,
    totalActiveTokens,
    averageTokensPerMinute,
    medianTokensPerMinute,
    peakStretch,
    longestStretch,
    topStretches,
  };
}

function finalizeStretch(
  cur: HourBucket & { startHour: string; endHour: string; hours: number },
): VelocityStretch {
  const tokensPerMinute = cur.tokens / (cur.hours * 60);
  return {
    startHour: cur.startHour,
    endHour: cur.endHour,
    hours: cur.hours,
    tokens: cur.tokens,
    inputTokens: cur.inputTokens,
    outputTokens: cur.outputTokens,
    events: cur.events,
    tokensPerMinute,
  };
}

function stretchVelocityCmp(a: VelocityStretch, b: VelocityStretch): number {
  if (a.tokensPerMinute !== b.tokensPerMinute) {
    return b.tokensPerMinute - a.tokensPerMinute;
  }
  if (a.hours !== b.hours) return b.hours - a.hours;
  if (a.startHour < b.startHour) return -1;
  if (a.startHour > b.startHour) return 1;
  return 0;
}

function stretchHoursCmp(a: VelocityStretch, b: VelocityStretch): number {
  if (a.hours !== b.hours) return b.hours - a.hours;
  if (a.tokens !== b.tokens) return b.tokens - a.tokens;
  if (a.startHour < b.startHour) return -1;
  if (a.startHour > b.startHour) return 1;
  return 0;
}
