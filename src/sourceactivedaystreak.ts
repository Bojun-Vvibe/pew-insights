/**
 * source-active-day-streak: per-source longest run of consecutive
 * UTC calendar days on which the source had at least one
 * positive-token bucket.
 *
 * Habit-consistency metric. Two sources can share the same calendar
 * tenure (first→last day span) yet have radically different
 * stickiness: one used every single day for 30 days, another used
 * once every 4–5 days across the same 30-day span. `source-tenure`
 * cannot tell them apart; this report can.
 *
 * For every source we compute, on its own positive-token buckets:
 *
 *   - activeDays:       count of distinct UTC calendar days with
 *                       at least one positive-token bucket.
 *   - tenureDays:       calendar days from `firstDay` to `lastDay`
 *                       inclusive (>= 1 when activeDays >= 1).
 *   - longestStreak:    length (in days) of the longest maximal
 *                       run of consecutive UTC calendar days that
 *                       were all active.
 *   - longestStreakStart / longestStreakEnd: ISO YYYY-MM-DD bounds
 *                       of that run (earliest qualifying run wins
 *                       on ties, so the result is deterministic).
 *   - currentStreak:    length of the streak ending on `lastDay`
 *                       (1 if `lastDay-1` was inactive). For sources
 *                       still active in the corpus's final day this
 *                       is the live streak; otherwise it's the
 *                       trailing streak when the source went quiet.
 *   - streaks:          total count of maximal active-day runs.
 *   - meanStreak:       activeDays / streaks (mean run length in days).
 *   - density:          activeDays / tenureDays in [0, 1]. 1 = used
 *                       every single day of its calendar tenure;
 *                       low values = sporadic use. A perfect
 *                       streaker has density==1 and longestStreak
 *                       == activeDays == tenureDays.
 *   - tokens:           sum of total_tokens across all positive-
 *                       token buckets for the source.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `source-tenure` reports first→last day span and active days
 *     but not the longest *consecutive* active run, so it can't
 *     distinguish "used every day for 30 days" from "used 30
 *     scattered days across 90".
 *   - `source-debut-recency` is a calendar-position metric (where
 *     on the timeline the source sits) — silent on internal
 *     consistency.
 *   - `source-decay-half-life` measures intra-tenure mass shape
 *     (where in the source's life tokens piled up) — silent on
 *     consecutive-day habits.
 *   - `source-run-lengths` measures consecutive *sessions* of the
 *     same source (operator stickiness in a single sitting), not
 *     consecutive *days*. A source with run-length 1 throughout
 *     can still have a 30-day active-day streak.
 *   - `bucket-streak-length` measures consecutive active *hour
 *     buckets* per source (intra-day burstiness), not calendar
 *     days. A streak that crosses many hours within one calendar
 *     day is irrelevant here; what matters is whether the next
 *     calendar day was also touched at all.
 *   - `active-span-per-day` / `first-bucket-of-day` /
 *     `last-bucket-of-day` are corpus-level day-shape metrics with
 *     no per-source angle.
 *
 * Headline question: "Which sources do I touch *every day*, and
 * for how long has my longest unbroken habit been?"
 *
 * Knobs:
 *
 *   - `since` / `until`: filter on `hour_start`. Streaks are
 *     computed on the post-filter active-day set, so a window cut
 *     can split a streak.
 *   - `model`: restrict to a single normalised model id.
 *   - `source`: restrict to a single source key (display filter
 *     on the population — global denominators echo the kept set).
 *   - `minDays`: drop sources with fewer than `n` active days from
 *     the per-source table. Display filter only — `totalSources`
 *     and `totalTokens` reflect the full kept population.
 *     Suppressed rows surface as `droppedBelowMinDays`. Default 1.
 *   - `top`: cap the per-source table after sort + minDays.
 *     Suppressed rows surface as `droppedBelowTopCap`. Default null.
 *   - `sort`: `tokens` (default) | `streak` (longestStreak desc) |
 *     `density` | `current` | `days` | `source`.
 *   - `densityMin`: drop rows whose `density` is strictly below
 *     this fraction. Display filter only. Suppressed rows surface
 *     as `droppedBelowDensityMin`. Must be in `[0, 1]`. Default 0.
 *
 * Determinism: pure builder. No `Date.now()` reads (only
 * `opts.generatedAt` for the wall-clock stamp). Tie-breaks fully
 * specified — identical input always yields identical output.
 */
import type { QueueLine } from './types.js';

export interface SourceActiveDayStreakOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single normalised model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /** Restrict to a single source key. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop rows with `activeDays` strictly below this threshold from
   * `sources[]`. Display filter only. Suppressed rows surface as
   * `droppedBelowMinDays`. Default 1.
   */
  minDays?: number;
  /**
   * Cap the per-source table after sort + minDays. Suppressed rows
   * surface as `droppedBelowTopCap`. Default null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokens desc.
   *   - 'streak':           longestStreak desc.
   *   - 'density':          density desc.
   *   - 'current':          currentStreak desc.
   *   - 'days':             activeDays desc.
   *   - 'source':           source key asc (lex).
   * Final tiebreak in all cases: source key asc (lex).
   */
  sort?: 'tokens' | 'streak' | 'density' | 'current' | 'days' | 'source';
  /**
   * Drop rows whose `density` is strictly below this fraction from
   * `sources[]`. Display filter only. Must be in `[0, 1]`. Default 0.
   */
  densityMin?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceActiveDayStreakRow {
  source: string;
  firstDay: string;
  lastDay: string;
  tenureDays: number;
  activeDays: number;
  streaks: number;
  meanStreak: number;
  longestStreak: number;
  longestStreakStart: string;
  longestStreakEnd: string;
  currentStreak: number;
  density: number;
  tokens: number;
}

export interface SourceActiveDayStreakReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  sourceFilter: string | null;
  /** Echo of resolved `minDays`. */
  minDays: number;
  /** Echo of resolved `top` cap (null = no cap). */
  top: number | null;
  /** Echo of resolved `sort` key. */
  sort: 'tokens' | 'streak' | 'density' | 'current' | 'days' | 'source';
  /** Echo of resolved `densityMin`. */
  densityMin: number;
  /** Distinct sources in the full kept population (pre display filters). */
  totalSources: number;
  /** Sum of total_tokens across the full kept population. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by `model` filter. */
  droppedModelFilter: number;
  /** Rows excluded by `source` filter. */
  droppedSourceFilter: number;
  /** Source rows hidden by `minDays` floor. */
  droppedBelowMinDays: number;
  /** Source rows hidden by `densityMin` floor. */
  droppedBelowDensityMin: number;
  /** Source rows trimmed by `top` cap. */
  droppedBelowTopCap: number;
  /** Per-source rows, sorted per opts.sort. */
  sources: SourceActiveDayStreakRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
  // ISO YYYY-MM-DD floored to UTC calendar day.
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dayKeyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

export function buildSourceActiveDayStreak(
  queue: QueueLine[],
  opts: SourceActiveDayStreakOptions = {},
): SourceActiveDayStreakReport {
  const minDays = opts.minDays ?? 1;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(
      `minDays must be a positive integer (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'tokens';
  if (
    sort !== 'tokens' &&
    sort !== 'streak' &&
    sort !== 'density' &&
    sort !== 'current' &&
    sort !== 'days' &&
    sort !== 'source'
  ) {
    throw new Error(
      `sort must be 'tokens' | 'streak' | 'density' | 'current' | 'days' | 'source' (got ${opts.sort})`,
    );
  }
  const densityMin = opts.densityMin ?? 0;
  if (!Number.isFinite(densityMin) || densityMin < 0 || densityMin > 1) {
    throw new Error(`densityMin must be in [0, 1] (got ${opts.densityMin})`);
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const modelFilter =
    opts.model != null && opts.model !== '' ? opts.model : null;
  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Acc {
    days: Map<string, number>; // dayKey -> tokens summed on that day
  }
  const perSource = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedModelFilter = 0;
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
    if (modelFilter !== null) {
      const model = typeof q.model === 'string' ? q.model : '';
      if (model !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }
    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let acc = perSource.get(source);
    if (!acc) {
      acc = { days: new Map<string, number>() };
      perSource.set(source, acc);
    }
    const k = dayKey(ms);
    acc.days.set(k, (acc.days.get(k) ?? 0) + tt);
  }

  const allRows: SourceActiveDayStreakRow[] = [];
  let totalTokens = 0;

  for (const [source, acc] of perSource.entries()) {
    if (acc.days.size === 0) continue;

    const sortedKeys = [...acc.days.keys()].sort();
    const activeDays = sortedKeys.length;
    let srcTokens = 0;
    for (const v of acc.days.values()) srcTokens += v;
    totalTokens += srcTokens;

    const firstDay = sortedKeys[0]!;
    const lastDay = sortedKeys[sortedKeys.length - 1]!;
    const firstMs = dayKeyToMs(firstDay);
    const lastMs = dayKeyToMs(lastDay);
    const tenureDays = Math.round((lastMs - firstMs) / DAY_MS) + 1;

    // Walk the sorted day list to count maximal consecutive runs.
    let streaks = 1;
    let longestStreak = 1;
    let longestStart = firstDay;
    let longestEnd = firstDay;
    let runStart = firstDay;
    let runLen = 1;
    let prevMs = firstMs;
    for (let i = 1; i < sortedKeys.length; i += 1) {
      const k = sortedKeys[i]!;
      const cur = dayKeyToMs(k);
      if (cur - prevMs === DAY_MS) {
        runLen += 1;
      } else {
        // close previous run
        if (runLen > longestStreak) {
          longestStreak = runLen;
          longestStart = runStart;
          longestEnd = sortedKeys[i - 1]!;
        }
        streaks += 1;
        runStart = k;
        runLen = 1;
      }
      prevMs = cur;
    }
    // close trailing run
    if (runLen > longestStreak) {
      longestStreak = runLen;
      longestStart = runStart;
      longestEnd = lastDay;
    }
    const currentStreak = runLen;
    const meanStreak = activeDays / streaks;
    const density = activeDays / tenureDays;

    allRows.push({
      source,
      firstDay,
      lastDay,
      tenureDays,
      activeDays,
      streaks,
      meanStreak,
      longestStreak,
      longestStreakStart: longestStart,
      longestStreakEnd: longestEnd,
      currentStreak,
      density,
      tokens: srcTokens,
    });
  }

  // Apply minDays then densityMin display filters.
  const survived: SourceActiveDayStreakRow[] = [];
  let droppedBelowMinDays = 0;
  let droppedBelowDensityMin = 0;
  for (const row of allRows) {
    if (row.activeDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    if (row.density < densityMin) {
      droppedBelowDensityMin += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'streak') primary = b.longestStreak - a.longestStreak;
    else if (sort === 'density') primary = b.density - a.density;
    else if (sort === 'current') primary = b.currentStreak - a.currentStreak;
    else if (sort === 'days') primary = b.activeDays - a.activeDays;
    // 'source' falls through to the lex tiebreak below.
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    model: modelFilter,
    sourceFilter,
    minDays,
    top,
    sort,
    densityMin,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedSourceFilter,
    droppedBelowMinDays,
    droppedBelowDensityMin,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
