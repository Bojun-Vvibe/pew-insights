/**
 * Session-level analysis for pew usage.
 *
 * The other subcommands all aggregate the **token** corpus (`queue.jsonl`,
 * hourly buckets). `sessions` is the first builder that takes the
 * **session** corpus (`session-queue.jsonl`) as its primary input and
 * surfaces a different kind of question: *what does my conversation
 * shape look like?*
 *
 * Concretely, given the session-queue lines in a window, we report:
 *
 *   - total session count and total wall-clock seconds,
 *   - longest single session (by duration_seconds),
 *   - chattiest session (by total_messages),
 *   - duration distribution (median + mean + p95) so that one outlier
 *     7-hour session doesn't masquerade as the typical one,
 *   - message-count distribution on the same three statistics,
 *   - a top-N grouped breakdown by the chosen dimension
 *     (`source` | `kind` | `project_ref`).
 *
 * Why a new subcommand instead of folding into `digest`/`top-projects`:
 *
 *   - `digest` emits token totals by source/model/hour. It never reads
 *     `started_at` / `last_message_at` / `duration_seconds` /
 *     `user_messages` / `assistant_messages` — a session is just a
 *     row to be tallied for its tokens.
 *   - `top-projects` proportionally attributes tokens to projects via
 *     project_ref but again ignores the session's own structural
 *     metadata (when did it start, how long did it run, how many
 *     turns).
 *   - The summary stats here (median session length in minutes, p95
 *     duration, "chattiest session", count by kind) only make sense
 *     against per-session rows, not against hourly token buckets, so
 *     they have no natural home in any existing module.
 *
 * Determinism: pure builder. Takes `since` / `until` as ISO strings;
 * never reads `Date.now()`. Window membership uses `started_at` so a
 * single long session is attributed to its starting day, matching how
 * a human would describe it ("the long session I started Tuesday").
 */
import type { SessionLine } from './types.js';

export type SessionsDimension = 'source' | 'kind' | 'project_ref';

export interface SessionsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Minimum `duration_seconds` for a session to be counted. Default 0.
   * Useful for filtering out auto-created empty sessions or one-shot
   * exec calls that left a 0-second row behind.
   */
  minDurationSeconds?: number;
  /** Grouping dimension for the breakdown table. Default 'source'. */
  by?: SessionsDimension;
  /** How many groups to surface in the top-N table. Default 10. Must be >= 1. */
  topN?: number;
}

export interface SessionsDistributionStats {
  /** Number of values in the distribution. */
  count: number;
  /** Median (50th percentile, lower-half average for even count). */
  median: number | null;
  /** Mean. null when count == 0. */
  mean: number | null;
  /**
   * 95th percentile via nearest-rank (k = ceil(0.95 * n)). null when
   * count == 0. We use nearest-rank instead of linear interpolation
   * because n is typically small and we want the answer to be an
   * actual observed value (matches how an operator reads "the worst
   * 5% of sessions").
   */
  p95: number | null;
  /** Min observed. null when count == 0. */
  min: number | null;
  /** Max observed. null when count == 0. */
  max: number | null;
}

export interface SessionPointer {
  sessionKey: string;
  source: string;
  kind: string;
  startedAt: string;
  durationSeconds: number;
  totalMessages: number;
  projectRef: string;
}

export interface SessionsGroupRow {
  /** Group key value (e.g. 'opencode' for by=source, 'agent' for by=kind, hex for project_ref). */
  key: string;
  /** Number of sessions in this group. */
  sessions: number;
  /** Sum of duration_seconds across the group. */
  totalDurationSeconds: number;
  /** Sum of total_messages across the group. */
  totalMessages: number;
  /** Median duration_seconds within the group. null if 0 sessions (impossible here). */
  medianDurationSeconds: number;
}

export interface SessionsReport {
  /** ISO 'as-of' moment used to label the report. Echoes `since`/`until` for clarity. */
  generatedAt: string;
  since: string | null;
  until: string | null;
  minDurationSeconds: number;
  by: SessionsDimension;
  topN: number;
  /** Total sessions surviving the filters. */
  totalSessions: number;
  /** Sum of duration_seconds across the surviving sessions. */
  totalDurationSeconds: number;
  /** Sum of total_messages across the surviving sessions. */
  totalMessages: number;
  /** Per-session duration distribution (in seconds). */
  durationStats: SessionsDistributionStats;
  /** Per-session message-count distribution. */
  messageStats: SessionsDistributionStats;
  /**
   * Longest single session by duration_seconds. null only when
   * totalSessions == 0. Tie-break: earlier `started_at` wins, so the
   * report is deterministic on a given input.
   */
  longestSession: SessionPointer | null;
  /**
   * Chattiest single session by total_messages. null only when
   * totalSessions == 0. Same earlier-wins tie-break.
   */
  chattiestSession: SessionPointer | null;
  /**
   * Top N groups under the chosen dimension, sorted by session count
   * desc (tie-break: totalDurationSeconds desc, then key asc). The
   * full set is summarised by `groupCardinality` so the operator
   * knows when the table is truncated.
   */
  topGroups: SessionsGroupRow[];
  /** Total distinct group-key values present (before topN truncation). */
  groupCardinality: number;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function median(xs: number[]): number {
  // Caller guarantees xs.length > 0.
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function p95NearestRank(xs: number[]): number {
  // Caller guarantees xs.length > 0.
  const sorted = [...xs].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.95 * sorted.length));
  return sorted[k - 1]!;
}

function summariseDistribution(xs: number[]): SessionsDistributionStats {
  const count = xs.length;
  if (count === 0) {
    return { count: 0, median: null, mean: null, p95: null, min: null, max: null };
  }
  const sum = xs.reduce((a, b) => a + b, 0);
  let mn = xs[0]!;
  let mx = xs[0]!;
  for (const v of xs) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return {
    count,
    median: median(xs),
    mean: sum / count,
    p95: p95NearestRank(xs),
    min: mn,
    max: mx,
  };
}

function pointerOf(s: SessionLine): SessionPointer {
  return {
    sessionKey: s.session_key,
    source: s.source,
    kind: s.kind,
    startedAt: s.started_at,
    durationSeconds: s.duration_seconds,
    totalMessages: s.total_messages,
    projectRef: s.project_ref,
  };
}

function groupKeyOf(s: SessionLine, by: SessionsDimension): string {
  switch (by) {
    case 'source':
      return s.source || '(unknown)';
    case 'kind':
      return s.kind || '(unknown)';
    case 'project_ref':
      return s.project_ref || '(unknown)';
  }
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export function buildSessions(
  sessions: SessionLine[],
  opts: SessionsOptions = {},
): SessionsReport {
  const since = opts.since ?? null;
  const until = opts.until ?? null;
  const minDurationSeconds = opts.minDurationSeconds ?? 0;
  const by = opts.by ?? 'source';
  const topN = opts.topN ?? 10;

  if (minDurationSeconds < 0) {
    throw new Error(`minDurationSeconds must be >= 0 (got ${minDurationSeconds})`);
  }
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${topN})`);
  }
  if (by !== 'source' && by !== 'kind' && by !== 'project_ref') {
    throw new Error(`by must be one of source | kind | project_ref (got ${by})`);
  }

  // Apply window + min-duration filters in a single pass.
  const filtered: SessionLine[] = [];
  for (const s of sessions) {
    if (since != null && s.started_at < since) continue;
    if (until != null && s.started_at >= until) continue;
    if (s.duration_seconds < minDurationSeconds) continue;
    filtered.push(s);
  }

  const durations = filtered.map((s) => s.duration_seconds);
  const messages = filtered.map((s) => s.total_messages);
  const durationStats = summariseDistribution(durations);
  const messageStats = summariseDistribution(messages);

  // Longest + chattiest. Earlier-started session wins ties so that
  // re-running on the same input always picks the same pointer.
  let longestSession: SessionPointer | null = null;
  let chattiestSession: SessionPointer | null = null;
  for (const s of filtered) {
    if (
      longestSession == null ||
      s.duration_seconds > longestSession.durationSeconds ||
      (s.duration_seconds === longestSession.durationSeconds &&
        s.started_at < longestSession.startedAt)
    ) {
      longestSession = pointerOf(s);
    }
    if (
      chattiestSession == null ||
      s.total_messages > chattiestSession.totalMessages ||
      (s.total_messages === chattiestSession.totalMessages &&
        s.started_at < chattiestSession.startedAt)
    ) {
      chattiestSession = pointerOf(s);
    }
  }

  // Group breakdown.
  interface GroupAcc {
    sessions: number;
    totalDurationSeconds: number;
    totalMessages: number;
    durations: number[];
  }
  const groups = new Map<string, GroupAcc>();
  for (const s of filtered) {
    const k = groupKeyOf(s, by);
    let g = groups.get(k);
    if (!g) {
      g = { sessions: 0, totalDurationSeconds: 0, totalMessages: 0, durations: [] };
      groups.set(k, g);
    }
    g.sessions += 1;
    g.totalDurationSeconds += s.duration_seconds;
    g.totalMessages += s.total_messages;
    g.durations.push(s.duration_seconds);
  }

  const allGroups: SessionsGroupRow[] = [];
  for (const [key, acc] of groups) {
    allGroups.push({
      key,
      sessions: acc.sessions,
      totalDurationSeconds: acc.totalDurationSeconds,
      totalMessages: acc.totalMessages,
      // Caller guarantees acc.sessions > 0 here, so median is safe.
      medianDurationSeconds: median(acc.durations),
    });
  }
  // Deterministic sort: sessions desc, totalDuration desc, key asc.
  allGroups.sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    if (b.totalDurationSeconds !== a.totalDurationSeconds) {
      return b.totalDurationSeconds - a.totalDurationSeconds;
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  const topGroups = allGroups.slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    since,
    until,
    minDurationSeconds,
    by,
    topN,
    totalSessions: filtered.length,
    totalDurationSeconds: filtered.reduce((a, s) => a + s.duration_seconds, 0),
    totalMessages: filtered.reduce((a, s) => a + s.total_messages, 0),
    durationStats,
    messageStats,
    longestSession,
    chattiestSession,
    topGroups,
    groupCardinality: groups.size,
  };
}
