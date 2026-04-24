/**
 * Session **concurrency** analysis: how many sessions were running
 * simultaneously, and when did the overlap peak?
 *
 * Where every existing session-aware builder treats each `SessionLine`
 * as an isolated row — `sessions` reports per-session distributions,
 * `gaps` measures the *idle* spaces *between* sessions, `streaks`
 * collapses days to ACTIVE/IDLE, and `velocity` aggregates by hour
 * onto the token corpus — none of them ask the *interval* question:
 * at any given instant in the window, how many sessions were
 * simultaneously open?
 *
 * The answer matters for two reasons:
 *
 *   1. **Capacity**: a workflow whose sessions never overlap looks
 *      very different from one that frequently fans out 4–5 in
 *      parallel, even if both produce the same daily token total.
 *   2. **Drift detection**: a sudden spike in peak concurrency
 *      (e.g. the same agent left running across 10 watches) shows
 *      up as a tall, narrow peak in the histogram and is invisible
 *      to per-day averages.
 *
 * Algorithm (deterministic sweep):
 *
 *   1. Take each session as a half-open interval
 *      `[started_at, end)` where `end = max(last_message_at,
 *      started_at + duration_seconds*1000)`. We cap at the window
 *      bounds so a session that started before `since` or runs past
 *      `until` is clipped, not dropped — the operator wants to see
 *      its concurrency *contribution* inside the window.
 *   2. Emit two events per clipped interval: `{t, +1, sessionKey}`
 *      at start, `{t, -1, sessionKey}` at end. Sort by `(t asc,
 *      delta asc)` so closes process before opens at the same
 *      timestamp — a session ending at exactly the moment another
 *      starts is *not* counted as concurrency. (Equal-tie convention
 *      is documented and tested.)
 *   3. Sweep, tracking the running concurrency count and the set
 *      of currently-open sessions. Whenever count changes, the
 *      previous segment `[prevT, t)` contributed `prevCount`
 *      concurrent sessions for `t - prevT` ms.
 *   4. Track the maximum count, the ISO timestamp where it was
 *      first reached, and (deterministically) the set of sessions
 *      open at that peak.
 *   5. Build a histogram: `level → totalMs spent at exactly that
 *      concurrency level`. Level 0 is included so the operator can
 *      compute coverage = (windowMs - histogram[0]) / windowMs.
 *
 * Determinism: pure builder. Tie-break is fully specified
 * (`closes-before-opens` at equal timestamps; ties in peak
 * `peakSessions` resolved by `session_key` ascending). Never reads
 * `Date.now()`.
 */
import type { SessionLine } from './types.js';

export interface ConcurrencyOptions {
  /** Inclusive ISO lower bound on the sweep window. null = use earliest session start. */
  since?: string | null;
  /** Exclusive ISO upper bound on the sweep window. null = use latest session end. */
  until?: string | null;
  /**
   * Cap on `peakSessions[]`. Default 10. Even if more sessions
   * tied at the peak, only the first `topN` by `session_key`
   * ascending are returned (count is always exact).
   */
  topN?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ConcurrencyHistogramBin {
  /** Concurrency level (0 = nothing open). */
  level: number;
  /** Total milliseconds spent at exactly this level inside the window. */
  totalMs: number;
  /** Share of the window (totalMs / windowMs). 0..1. */
  fraction: number;
}

export interface ConcurrencyPeakSession {
  sessionKey: string;
  source: string;
  kind: string;
  startedAt: string;
  endedAt: string;
}

export interface ConcurrencyReport {
  generatedAt: string;
  /** Inclusive ISO start of the sweep window. */
  windowStart: string;
  /** Exclusive ISO end of the sweep window. */
  windowEnd: string;
  /** windowEnd - windowStart in milliseconds. 0 when inputs are degenerate. */
  windowMs: number;
  /** Number of sessions whose clipped interval has positive length in the window. */
  consideredSessions: number;
  /** Sessions skipped (zero-length after clipping or fully outside window). */
  skippedSessions: number;
  /** Maximum concurrent open sessions seen in the window. >= 0. */
  peakConcurrency: number;
  /** First ISO instant at which `peakConcurrency` was reached. null when peak == 0. */
  peakAt: string | null;
  /** Total ms spent at peakConcurrency across the window. */
  peakDurationMs: number;
  /**
   * Sessions open at the first instant of `peakAt`. Empty when peak
   * is 0. Sorted by `session_key` ascending; truncated to `topN`.
   */
  peakSessions: ConcurrencyPeakSession[];
  /** Average concurrency = sum(level * totalMs) / windowMs. 0 when windowMs == 0. */
  averageConcurrency: number;
  /**
   * Coverage = fraction of window with concurrency >= 1. 0..1.
   * 0 when windowMs == 0.
   */
  coverage: number;
  /**
   * Histogram of time spent at each concurrency level, sorted by
   * `level` ascending. Includes level 0. Levels with totalMs == 0
   * are omitted.
   */
  histogram: ConcurrencyHistogramBin[];
  topN: number;
}

interface SweepEvent {
  t: number; // epoch ms
  delta: 1 | -1;
  sessionKey: string;
}

/**
 * Compute the effective end-of-session timestamp.
 * Prefer `last_message_at` when present and after `started_at`,
 * but extend out to `started_at + duration_seconds*1000` when
 * pew's writer recorded a duration that the timestamp missed
 * (rounding, late-arriving message). This favours capturing the
 * full overlap window.
 */
function effectiveEndMs(s: SessionLine): number {
  const start = Date.parse(s.started_at);
  if (!Number.isFinite(start)) return Number.NaN;
  const lastMsg = Date.parse(s.last_message_at);
  const durMs = Number.isFinite(s.duration_seconds) ? Math.max(0, s.duration_seconds) * 1000 : 0;
  const candidates: number[] = [];
  if (Number.isFinite(lastMsg) && lastMsg > start) candidates.push(lastMsg);
  if (durMs > 0) candidates.push(start + durMs);
  if (candidates.length === 0) return start; // zero-length session — will be skipped
  return Math.max(...candidates);
}

export function buildConcurrency(
  sessions: SessionLine[],
  opts: ConcurrencyOptions = {},
): ConcurrencyReport {
  const topN = opts.topN ?? 10;
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${opts.topN})`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // Determine window bounds.
  let sinceMs = opts.since != null ? Date.parse(opts.since) : Number.NaN;
  let untilMs = opts.until != null ? Date.parse(opts.until) : Number.NaN;
  if (opts.since != null && !Number.isFinite(sinceMs)) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && !Number.isFinite(untilMs)) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  // Build per-session intervals.
  interface Interval {
    sessionKey: string;
    source: string;
    kind: string;
    startMs: number;
    endMs: number;
    startIso: string;
    endIso: string;
  }
  const intervals: Interval[] = [];
  for (const s of sessions) {
    const start = Date.parse(s.started_at);
    const end = effectiveEndMs(s);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    intervals.push({
      sessionKey: s.session_key,
      source: s.source,
      kind: s.kind,
      startMs: start,
      endMs: end,
      startIso: s.started_at,
      endIso: new Date(end).toISOString(),
    });
  }

  // Auto-derive bounds from data when not provided.
  if (!Number.isFinite(sinceMs)) {
    sinceMs =
      intervals.length === 0 ? 0 : intervals.reduce((m, i) => (i.startMs < m ? i.startMs : m), intervals[0]!.startMs);
  }
  if (!Number.isFinite(untilMs)) {
    untilMs =
      intervals.length === 0 ? 0 : intervals.reduce((m, i) => (i.endMs > m ? i.endMs : m), intervals[0]!.endMs);
  }
  if (untilMs < sinceMs) untilMs = sinceMs;

  const windowMs = untilMs - sinceMs;
  const windowStart = new Date(sinceMs).toISOString();
  const windowEnd = new Date(untilMs).toISOString();

  // Clip intervals to window; drop those fully outside.
  let considered = 0;
  let skipped = 0;
  const events: SweepEvent[] = [];
  const intervalLookup = new Map<string, Interval>();

  for (const iv of intervals) {
    const cs = Math.max(iv.startMs, sinceMs);
    const ce = Math.min(iv.endMs, untilMs);
    if (ce <= cs) {
      skipped += 1;
      continue;
    }
    considered += 1;
    intervalLookup.set(iv.sessionKey, iv);
    events.push({ t: cs, delta: 1, sessionKey: iv.sessionKey });
    events.push({ t: ce, delta: -1, sessionKey: iv.sessionKey });
  }

  // Sort: closes (-1) before opens (+1) at the same timestamp; then by sessionKey for determinism.
  events.sort((a, b) => {
    if (a.t !== b.t) return a.t - b.t;
    if (a.delta !== b.delta) return a.delta - b.delta; // -1 before +1
    if (a.sessionKey < b.sessionKey) return -1;
    if (a.sessionKey > b.sessionKey) return 1;
    return 0;
  });

  // Sweep.
  const histogramMs = new Map<number, number>();
  if (windowMs > 0) histogramMs.set(0, windowMs); // start with all-window-empty; subtract as we go.

  let prevT = sinceMs;
  let count = 0;
  const open = new Set<string>();
  let peak = 0;
  let peakAtMs: number | null = null;
  let peakSessionsSnapshot: string[] = [];
  let peakDurationMs = 0;

  function record(fromT: number, toT: number, level: number): void {
    const dt = toT - fromT;
    if (dt <= 0) return;
    // Subtract from level-0 bucket and add to actual level bucket.
    if (level !== 0) {
      const zeroPrev = histogramMs.get(0) ?? 0;
      histogramMs.set(0, Math.max(0, zeroPrev - dt));
    }
    histogramMs.set(level, (histogramMs.get(level) ?? 0) + (level === 0 ? 0 : dt));
    if (level === peak && peak > 0) peakDurationMs += dt;
  }

  for (const ev of events) {
    if (ev.t > prevT) {
      record(prevT, ev.t, count);
      prevT = ev.t;
    }
    if (ev.delta === 1) {
      count += 1;
      open.add(ev.sessionKey);
      if (count > peak) {
        // New peak — reset duration tally; snapshot will be re-recorded next segment.
        peak = count;
        peakAtMs = ev.t;
        peakSessionsSnapshot = [...open].sort();
        peakDurationMs = 0;
      }
    } else {
      count -= 1;
      open.delete(ev.sessionKey);
    }
  }
  // Tail: from last event to windowEnd.
  if (prevT < untilMs) record(prevT, untilMs, count);

  // Build histogram array.
  const histogram: ConcurrencyHistogramBin[] = [...histogramMs.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([level, ms]) => ({
      level,
      totalMs: ms,
      fraction: windowMs === 0 ? 0 : ms / windowMs,
    }))
    .sort((a, b) => a.level - b.level);

  const averageConcurrency =
    windowMs === 0
      ? 0
      : histogram.reduce((acc, b) => acc + b.level * b.totalMs, 0) / windowMs;
  const coverage =
    windowMs === 0
      ? 0
      : histogram.filter((b) => b.level >= 1).reduce((acc, b) => acc + b.totalMs, 0) / windowMs;

  const peakSessions: ConcurrencyPeakSession[] = peakSessionsSnapshot
    .slice(0, topN)
    .map((key) => {
      const iv = intervalLookup.get(key)!;
      return {
        sessionKey: iv.sessionKey,
        source: iv.source,
        kind: iv.kind,
        startedAt: iv.startIso,
        endedAt: iv.endIso,
      };
    });

  return {
    generatedAt,
    windowStart,
    windowEnd,
    windowMs,
    consideredSessions: considered,
    skippedSessions: skipped,
    peakConcurrency: peak,
    peakAt: peakAtMs == null ? null : new Date(peakAtMs).toISOString(),
    peakDurationMs,
    peakSessions,
    averageConcurrency,
    coverage,
    histogram,
    topN,
  };
}
