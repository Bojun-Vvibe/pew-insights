/**
 * Idle-gap detection between sessions.
 *
 * Most "alerting" against the session corpus is noisy: every overnight
 * pause looks like a long gap. The interesting question is the
 * *relative* one: which gaps in this window are unusually long
 * compared to my own typical inter-session quiet?
 *
 * `gaps` answers exactly that. We:
 *
 *   1. Filter session-queue rows to the [since, until) window using
 *      `started_at` (matches `sessions` semantics — a long session
 *      belongs to the day it started on).
 *   2. Sort survivors by `started_at` asc, with `session_key` as a
 *      stable tie-break.
 *   3. For each adjacent pair (prev, next), the **gap_seconds** is
 *      `(next.started_at - prev.last_message_at)`, clamped at 0.
 *      We measure to `last_message_at` rather than `started_at` so a
 *      long-running session does not count as "idle" while it was
 *      still emitting messages.
 *   4. Build the empirical distribution of gap_seconds and compute
 *      the requested quantile threshold via **nearest-rank**
 *      (k = ceil(q * n)). Nearest-rank gives an actual observed gap
 *      as the threshold rather than an interpolated value, which
 *      matches how an operator reads "the unusual 10%".
 *   5. Flag every gap whose duration is strictly greater than the
 *      threshold and return them sorted by gap_seconds desc with
 *      `prev.started_at` asc as a deterministic tie-break.
 *
 * Determinism: pure builder. Never reads `Date.now()`. All sorts have
 * an explicit secondary key.
 */
import type { SessionLine } from './types.js';

export interface GapsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Quantile threshold in (0, 1). Default 0.9. A gap is flagged
   * when `gap_seconds > nearest-rank(quantile)`. Use 0.95 for
   * stricter alerting, 0.75 for noisier coverage.
   */
  quantile?: number;
  /**
   * Absolute floor in seconds. A gap shorter than this never gets
   * flagged regardless of quantile. Default 0 (no floor). Useful
   * when your typical gap distribution is dominated by sub-minute
   * pauses and you only care about "real" idles.
   */
  minGapSeconds?: number;
  /** Cap on the number of flagged gaps surfaced. Default 10. Must be >= 1. */
  topN?: number;
  /**
   * Optional injected `generatedAt` ISO timestamp. When unset we use
   * `new Date().toISOString()` like every other builder; tests pass
   * a fixed value so the snapshot is deterministic.
   */
  generatedAt?: string;
}

export interface GapPointer {
  sessionKey: string;
  source: string;
  kind: string;
  startedAt: string;
  lastMessageAt: string;
  projectRef: string;
}

export interface GapRow {
  /** Index into the sorted-by-startedAt list. 0-based. */
  index: number;
  /** The session that ended (or last spoke) before the gap. */
  before: GapPointer;
  /** The session that started after the gap. */
  after: GapPointer;
  /** Idle duration in seconds. Always >= 0. */
  gapSeconds: number;
  /**
   * Empirical quantile rank of this gap inside the window's gap
   * distribution, in [0, 1]. Computed as `(rank_of_value) / n` where
   * `rank_of_value` counts gaps strictly less than this value plus
   * half the ties (mid-rank). Lets the operator distinguish a
   * "barely over the threshold" gap from a true outlier.
   */
  quantileRank: number;
}

export interface GapsReport {
  generatedAt: string;
  since: string | null;
  until: string | null;
  quantile: number;
  minGapSeconds: number;
  topN: number;
  /** Number of sessions surviving the window filter. */
  totalSessions: number;
  /** Number of adjacent gaps measured (== max(0, totalSessions - 1)). */
  totalGaps: number;
  /**
   * The nearest-rank threshold value in seconds. null when fewer
   * than 2 sessions survive (no gaps to threshold against).
   */
  thresholdSeconds: number | null;
  /** Flagged gaps, sorted gap_seconds desc / before.startedAt asc. */
  flagged: GapRow[];
  /** Median of the full gap distribution. null when totalGaps == 0. */
  medianGapSeconds: number | null;
  /** Max observed gap. null when totalGaps == 0. */
  maxGapSeconds: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseIso(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function nearestRankQuantile(sortedAsc: number[], q: number): number {
  // Caller guarantees sortedAsc.length > 0 and 0 < q <= 1.
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[Math.min(k, sortedAsc.length) - 1]!;
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sortedAsc[mid]!;
  return (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

function quantileRankOf(value: number, sortedAsc: number[]): number {
  // Mid-rank: (#strictly_less + 0.5 * #equal) / n. Lies in (0, 1].
  let less = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) less += 1;
    else if (v === value) equal += 1;
  }
  return (less + 0.5 * equal) / sortedAsc.length;
}

function toPointer(s: SessionLine): GapPointer {
  return {
    sessionKey: s.session_key,
    source: s.source,
    kind: s.kind,
    startedAt: s.started_at,
    lastMessageAt: s.last_message_at,
    projectRef: s.project_ref,
  };
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export function buildGaps(sessions: SessionLine[], opts: GapsOptions = {}): GapsReport {
  const quantile = opts.quantile ?? 0.9;
  const minGapSeconds = opts.minGapSeconds ?? 0;
  const topN = opts.topN ?? 10;
  const since = opts.since ?? null;
  const until = opts.until ?? null;

  if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) {
    throw new Error(`quantile must be in (0, 1] (got ${opts.quantile})`);
  }
  if (!Number.isFinite(minGapSeconds) || minGapSeconds < 0) {
    throw new Error(`minGapSeconds must be >= 0 (got ${opts.minGapSeconds})`);
  }
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${opts.topN})`);
  }

  const sinceMs = since == null ? -Infinity : parseIso(since);
  const untilMs = until == null ? Infinity : parseIso(until);

  // 1. Window filter on started_at.
  const inWindow: SessionLine[] = [];
  for (const s of sessions) {
    const st = parseIso(s.started_at);
    if (st >= sinceMs && st < untilMs) inWindow.push(s);
  }

  // 2. Sort by started_at asc, session_key asc as a stable tie-break.
  inWindow.sort((a, b) => {
    const da = parseIso(a.started_at);
    const db = parseIso(b.started_at);
    if (da !== db) return da - db;
    if (a.session_key < b.session_key) return -1;
    if (a.session_key > b.session_key) return 1;
    return 0;
  });

  // 3. Compute adjacent gaps.
  const gapValues: number[] = [];
  const gapTuples: { idx: number; gap: number; prev: SessionLine; next: SessionLine }[] = [];
  for (let i = 1; i < inWindow.length; i += 1) {
    const prev = inWindow[i - 1]!;
    const next = inWindow[i]!;
    const lastEndMs = parseIso(prev.last_message_at);
    const nextStartMs = parseIso(next.started_at);
    const rawGap = Math.floor((nextStartMs - lastEndMs) / 1000);
    const gap = Math.max(0, rawGap);
    gapValues.push(gap);
    gapTuples.push({ idx: i - 1, gap, prev, next });
  }

  const totalSessions = inWindow.length;
  const totalGaps = gapValues.length;

  let thresholdSeconds: number | null = null;
  let medianGapSeconds: number | null = null;
  let maxGapSeconds: number | null = null;
  let flagged: GapRow[] = [];

  if (totalGaps > 0) {
    const sortedAsc = [...gapValues].sort((a, b) => a - b);
    thresholdSeconds = nearestRankQuantile(sortedAsc, quantile);
    medianGapSeconds = median(sortedAsc);
    maxGapSeconds = sortedAsc[sortedAsc.length - 1]!;

    const candidates: GapRow[] = [];
    for (const t of gapTuples) {
      if (t.gap > thresholdSeconds && t.gap >= minGapSeconds) {
        candidates.push({
          index: t.idx,
          before: toPointer(t.prev),
          after: toPointer(t.next),
          gapSeconds: t.gap,
          quantileRank: quantileRankOf(t.gap, sortedAsc),
        });
      }
    }
    // 5. Flagged sort: gap_seconds desc, then before.startedAt asc, then sessionKey asc.
    candidates.sort((a, b) => {
      if (a.gapSeconds !== b.gapSeconds) return b.gapSeconds - a.gapSeconds;
      const da = parseIso(a.before.startedAt);
      const db = parseIso(b.before.startedAt);
      if (da !== db) return da - db;
      if (a.before.sessionKey < b.before.sessionKey) return -1;
      if (a.before.sessionKey > b.before.sessionKey) return 1;
      return 0;
    });
    flagged = candidates.slice(0, topN);
  }

  return {
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    since,
    until,
    quantile,
    minGapSeconds,
    topN,
    totalSessions,
    totalGaps,
    thresholdSeconds,
    flagged,
    medianGapSeconds,
    maxGapSeconds,
  };
}
