/**
 * time-of-day: distribution of session **start times** across the
 * 24 hours of the day, plus an optional grouping by `source`
 * (the local producer CLI). Answers questions like:
 *
 *   - "When during the day do I actually start sessions?"
 *   - "Is my late-night work disproportionately one tool?"
 *   - "Which hour is my peak — and how peaked is it?"
 *
 * Why a new subcommand:
 *
 *   - `heatmap` (existing) crosses weekday × hour using *messages*
 *     and is rendered as a grid; great for visual gestalt but
 *     hard to drive numerical decisions off (no shares, no
 *     per-source split, no peak/off-hours summary).
 *   - `turn-cadence` measures *within-session* user→user gaps,
 *     not when sessions are launched.
 *   - `idle-gaps` measures *between-session* gaps in absolute
 *     time, not the hour-of-day they fall on.
 *   - `session-source-mix` reports producer share independent of
 *     when the sessions ran.
 *
 * The time-of-day view is the operator's "scheduling" lens:
 * when am I working, and (with `--by-source`) which producer
 * dominates that hour.
 *
 * Hour computation: hours are taken from `started_at` parsed as
 * an ISO-8601 instant, then bucketed in either UTC or a fixed
 * IANA-style offset given by `--tz-offset` (e.g. `-07:00`,
 * `+08:00`). This avoids pulling in `Intl.DateTimeFormat` /
 * `Temporal` for full IANA zone support — the operator already
 * knows their own offset, and the offset path is fully
 * deterministic and unit-testable.
 *
 * Determinism: pure builder, no `Date.now()` reads. All hour
 * buckets 0..23 always present (zero-filled), so output shape is
 * stable across runs even when the data is sparse.
 */
import type { SessionLine } from './types.js';

export interface TimeOfDayOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Hour-bucketing timezone offset, in `±HH:MM` or `±HHMM` or
   * `Z` form. Default `Z` (UTC). Example: `-07:00` for PDT,
   * `+08:00` for CST. The offset is added to the parsed UTC
   * instant before extracting the hour. Sub-hour offsets like
   * `+05:30` (IST) are supported.
   */
  tzOffset?: string;
  /**
   * Group hour buckets by `source` (the local producer CLI). When
   * true, each bucket also carries a `bySource` map of
   * `source -> count`. Default false.
   */
  bySource?: boolean;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface HourBucket {
  /** 0..23 in the resolved timezone. */
  hour: number;
  /** Number of sessions whose start fell in this hour. */
  sessions: number;
  /** sessions / consideredSessions. 0 when input is empty. */
  share: number;
  /**
   * Per-source counts in this hour. Empty object when
   * `bySource` is false. Sources with 0 sessions in this hour
   * are omitted (so the map is sparse per row but the parent
   * `hours[]` array is dense).
   */
  bySource: Record<string, number>;
}

export interface TimeOfDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved offset, normalised to `±HH:MM` or `Z`. */
  tzOffset: string;
  /** Echo of `bySource`. */
  bySource: boolean;
  /** Total sessions matched by window and used in shares. */
  consideredSessions: number;
  /** Sessions with non-parseable started_at. */
  droppedInvalidStartedAt: number;
  /**
   * The hour with the most sessions. -1 when no sessions.
   * Ties broken by lowest hour.
   */
  peakHour: number;
  /** Sessions in `peakHour`. 0 when no sessions. */
  peakSessions: number;
  /**
   * 24 entries, hour 0 through hour 23, always present.
   */
  hours: HourBucket[];
}

/**
 * Parse a timezone offset string into total minutes from UTC.
 * Returns null if invalid.
 */
export function parseTzOffsetMinutes(raw: string): number | null {
  if (raw === 'Z' || raw === 'z') return 0;
  // Accept ±HH:MM, ±HHMM, ±HH
  const m = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hh = Number(m[2]);
  const mm = m[3] != null ? Number(m[3]) : 0;
  if (hh > 23 || mm > 59) return null;
  return sign * (hh * 60 + mm);
}

function formatTzOffset(minutes: number): string {
  if (minutes === 0) return 'Z';
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, '0');
  const mm = (abs % 60).toString().padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

export function buildTimeOfDay(
  sessions: SessionLine[],
  opts: TimeOfDayOptions = {},
): TimeOfDayReport {
  const tzRaw = opts.tzOffset ?? 'Z';
  const tzMinutes = parseTzOffsetMinutes(tzRaw);
  if (tzMinutes === null) {
    throw new Error(`invalid tzOffset: ${tzRaw}`);
  }
  const tzOffset = formatTzOffset(tzMinutes);

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const bySource = opts.bySource === true;

  const counts: number[] = new Array(24).fill(0);
  const sourceCounts: Array<Map<string, number>> = bySource
    ? Array.from({ length: 24 }, () => new Map<string, number>())
    : [];
  let considered = 0;
  let droppedInvalidStartedAt = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) {
      droppedInvalidStartedAt += 1;
      continue;
    }
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    // Apply offset, then extract UTC hour of the shifted instant.
    const shifted = new Date(startMs + tzMinutes * 60_000);
    const hour = shifted.getUTCHours();
    counts[hour]! += 1;
    considered += 1;
    if (bySource) {
      const src = typeof s.source === 'string' && s.source.length > 0 ? s.source : 'unknown';
      const m = sourceCounts[hour]!;
      m.set(src, (m.get(src) ?? 0) + 1);
    }
  }

  let peakHour = -1;
  let peakSessions = 0;
  if (considered > 0) {
    for (let h = 0; h < 24; h++) {
      if (counts[h]! > peakSessions) {
        peakSessions = counts[h]!;
        peakHour = h;
      }
    }
  }

  const hours: HourBucket[] = [];
  for (let h = 0; h < 24; h++) {
    const c = counts[h]!;
    const bucket: HourBucket = {
      hour: h,
      sessions: c,
      share: considered === 0 ? 0 : c / considered,
      bySource: {},
    };
    if (bySource) {
      const m = sourceCounts[h]!;
      // Deterministic key order: sort by count desc then key asc.
      const entries = Array.from(m.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
      });
      const out: Record<string, number> = {};
      for (const [k, v] of entries) out[k] = v;
      bucket.bySource = out;
    }
    hours.push(bucket);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    tzOffset,
    bySource,
    consideredSessions: considered,
    droppedInvalidStartedAt,
    peakHour,
    peakSessions,
    hours,
  };
}
