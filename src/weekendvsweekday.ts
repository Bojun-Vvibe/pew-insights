/**
 * weekend-vs-weekday: token mass split between weekend (Sat/Sun)
 * and weekday (Mon–Fri) days, broken down per model.
 *
 * Every other report either ignores the weekly cycle (cost,
 * provider-share) or slices it finely (weekday-share, time-of-day,
 * peak-hour-share). The single most common product question we
 * keep asking — "do I actually use weekends to grind, or only
 * weekdays?" — needs a coarser two-bucket lens, *per model*. A
 * model that is 70% weekend has very different spend dynamics from
 * one that is 5% weekend, even when their absolute totals match.
 *
 * For each kept row we classify `hour_start` as `weekend` (Sat=6
 * or Sun=0 in UTC) or `weekday` (Mon–Fri = 1..5), then aggregate
 * by normalised model. The report carries:
 *
 *   - one global summary row (totals + ratio) and one row per
 *     model with: weekendTokens / weekdayTokens, share %, ratio
 *     (= weekend / weekday, NaN guarded), rows seen on each side,
 *     distinctSources, firstSeen / lastSeen
 *   - dropped counters split by reason (bad hour_start, zero
 *     tokens, below min-rows, below top cap)
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Day-of-week classification is UTC; we don't
 * try to guess the operator's timezone — `weekday-share` already
 * supports `--tz`, so this report leaves that knob to its sibling.
 *
 * Window semantics match the rest of the suite: `since` inclusive,
 * `until` exclusive on `hour_start`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface WeekendVsWeekdayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop model rows whose total considered rows (weekend + weekday)
   * is `< minRows` from `models[]`. Display filter only — global
   * totals reflect the full population. Default 0.
   */
  minRows?: number;
  /**
   * Truncate `models[]` to the top N by total tokens
   * (weekend + weekday). Display filter only. Default 0 = no cap.
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface WeekendVsWeekdayModelRow {
  /** Normalised model string (post `normaliseModel`). */
  model: string;
  weekendTokens: number;
  weekdayTokens: number;
  totalTokens: number;
  /** weekendTokens / totalTokens, in [0,1]. 0 if total = 0. */
  weekendShare: number;
  /** weekdayTokens / totalTokens, in [0,1]. 0 if total = 0. */
  weekdayShare: number;
  /**
   * weekendTokens / weekdayTokens. Infinity if weekday = 0 and
   * weekend > 0; 0 if both are 0 or weekend = 0; finite otherwise.
   * A "balanced by calendar" reference would be 2/5 = 0.4 (two
   * weekend days vs five weekday days), so a ratio above 0.4 means
   * the model leans weekend-heavy *relative to days available*.
   */
  weekendToWeekdayRatio: number;
  weekendRows: number;
  weekdayRows: number;
  distinctSources: number;
  /** Earliest `hour_start` seen for this model (ISO). */
  firstSeen: string;
  /** Latest `hour_start` seen for this model (ISO). */
  lastSeen: string;
}

export interface WeekendVsWeekdayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Sum of total_tokens across all kept rows. */
  totalTokens: number;
  /** Sum of total_tokens across kept rows whose hour_start is Sat/Sun (UTC). */
  weekendTokens: number;
  /** Sum of total_tokens across kept rows whose hour_start is Mon–Fri (UTC). */
  weekdayTokens: number;
  /** Global weekend share, in [0,1]. 0 if total = 0. */
  weekendShare: number;
  /** Global weekend / weekday ratio (see row docs for edge cases). */
  weekendToWeekdayRatio: number;
  /** Distinct models observed before display filters. */
  totalModels: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** Model rows hidden by the minRows floor. */
  droppedMinRows: number;
  /** Model rows hidden by the `top` cap (counted after other floors). */
  droppedTopModels: number;
  /**
   * One row per kept model. Sorted by total tokens desc, then
   * model asc.
   */
  models: WeekendVsWeekdayModelRow[];
}

function ratio(weekend: number, weekday: number): number {
  if (weekday === 0) return weekend > 0 ? Number.POSITIVE_INFINITY : 0;
  return weekend / weekday;
}

export function buildWeekendVsWeekday(
  queue: QueueLine[],
  opts: WeekendVsWeekdayOptions = {},
): WeekendVsWeekdayReport {
  const minRows = opts.minRows ?? 0;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(`minRows must be a non-negative integer (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
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

  interface Acc {
    model: string;
    weekendTokens: number;
    weekdayTokens: number;
    weekendRows: number;
    weekdayRows: number;
    sources: Set<string>;
    firstSeenMs: number;
    lastSeenMs: number;
    firstSeen: string;
    lastSeen: string;
  }

  const agg = new Map<string, Acc>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let globalWeekend = 0;
  let globalWeekday = 0;

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

    const dow = new Date(ms).getUTCDay(); // 0=Sun,6=Sat
    const isWeekend = dow === 0 || dow === 6;

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    let a = agg.get(model);
    if (!a) {
      a = {
        model,
        weekendTokens: 0,
        weekdayTokens: 0,
        weekendRows: 0,
        weekdayRows: 0,
        sources: new Set<string>(),
        firstSeenMs: ms,
        lastSeenMs: ms,
        firstSeen: q.hour_start,
        lastSeen: q.hour_start,
      };
      agg.set(model, a);
    }
    if (isWeekend) {
      a.weekendTokens += tt;
      a.weekendRows += 1;
      globalWeekend += tt;
    } else {
      a.weekdayTokens += tt;
      a.weekdayRows += 1;
      globalWeekday += tt;
    }
    a.sources.add(
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown',
    );
    if (ms < a.firstSeenMs) {
      a.firstSeenMs = ms;
      a.firstSeen = q.hour_start;
    }
    if (ms > a.lastSeenMs) {
      a.lastSeenMs = ms;
      a.lastSeen = q.hour_start;
    }
  }

  const totalModels = agg.size;
  const all: WeekendVsWeekdayModelRow[] = [];
  for (const a of agg.values()) {
    const tot = a.weekendTokens + a.weekdayTokens;
    all.push({
      model: a.model,
      weekendTokens: a.weekendTokens,
      weekdayTokens: a.weekdayTokens,
      totalTokens: tot,
      weekendShare: tot > 0 ? a.weekendTokens / tot : 0,
      weekdayShare: tot > 0 ? a.weekdayTokens / tot : 0,
      weekendToWeekdayRatio: ratio(a.weekendTokens, a.weekdayTokens),
      weekendRows: a.weekendRows,
      weekdayRows: a.weekdayRows,
      distinctSources: a.sources.size,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    });
  }

  // Apply minRows floor.
  let droppedMinRows = 0;
  const afterMin: WeekendVsWeekdayModelRow[] = [];
  for (const row of all) {
    if (row.weekendRows + row.weekdayRows < minRows) {
      droppedMinRows += 1;
      continue;
    }
    afterMin.push(row);
  }

  // Sort: total desc, model asc on tie.
  afterMin.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  // Apply top cap.
  let droppedTopModels = 0;
  let kept = afterMin;
  if (top > 0 && afterMin.length > top) {
    droppedTopModels = afterMin.length - top;
    kept = afterMin.slice(0, top);
  }

  const totalTokens = globalWeekend + globalWeekday;
  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    top,
    totalTokens,
    weekendTokens: globalWeekend,
    weekdayTokens: globalWeekday,
    weekendShare: totalTokens > 0 ? globalWeekend / totalTokens : 0,
    weekendToWeekdayRatio: ratio(globalWeekend, globalWeekday),
    totalModels,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedMinRows,
    droppedTopModels,
    models: kept,
  };
}
