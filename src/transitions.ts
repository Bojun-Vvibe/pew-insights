/**
 * Session **transition** analysis: when one session ends and another
 * begins shortly after, what does the handoff look like?
 *
 * The existing session-aware builders all answer either *per-session*
 * questions (`sessions` distributions, `gaps` idle-period flagging),
 * *aggregate* questions (`velocity` hourly tokens, `streaks` ACTIVE
 * vs IDLE day collapse), or *interval* questions (`concurrency`
 * sweep). None of them ask the *adjacency* question:
 *
 *   "When I close an `opencode` session, what is the next thing I
 *    open? Do I usually hand off to `claude`, do I bounce back to
 *    another `opencode`, or do I walk away?"
 *
 * That answer is a **transition matrix** over the sources (or `kind`
 * or `project_ref`) of consecutive sessions, plus the gap distribution
 * for each transition cell. It is the categorical analogue of `gaps`:
 * `gaps` measures *how long* the idle space is, `transitions` measures
 * *what kind of work was on either side of it*.
 *
 * Algorithm (deterministic):
 *
 *   1. Sort sessions by `started_at` ascending. Break ties on
 *      `session_key` ascending so the order is fully reproducible.
 *   2. Drop sessions outside the `[since, until)` window (membership
 *      decided by `started_at`, mirroring `sessions` and `gaps`).
 *   3. For each adjacent pair `(prev, next)`, compute
 *      `gapSeconds = max(0, started_at(next) - effectiveEnd(prev))`.
 *      `effectiveEnd` = `max(last_message_at, started_at +
 *      duration_seconds*1000)` — same convention as `concurrency`,
 *      so a long-tailed session that ends after another one started
 *      registers as a *negative raw gap* which we floor to 0 and
 *      flag as `overlapping = true` on that pair.
 *   4. If `gapSeconds <= maxGapSeconds`, the pair counts as a
 *      *handoff*. Otherwise it counts as a *break* (no transition
 *      attributed; both sides are recorded as terminal).
 *   5. Tally cells `(fromGroup, toGroup) → { count, gapMs[] }`.
 *      From a tallied cell, derive `count`, `medianGapMs`,
 *      `p95GapMs`, `overlapCount`.
 *   6. For each `from` group, compute `stickiness` = fraction of its
 *      handoffs whose `to` is the same group. Sticky → the operator
 *      stays inside one tool. Spread → frequent context switches.
 *   7. Top-N is by `count` desc, ties broken by `(fromGroup,
 *      toGroup)` ascending so output is stable across runs.
 *
 * Determinism: pure builder. Never reads `Date.now()`. All sort
 * tie-breaks are fully specified.
 */
import type { SessionLine } from './types.js';

export type TransitionsDimension = 'source' | 'kind' | 'project_ref';

export interface TransitionsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Maximum gap between adjacent sessions for the pair to count as a
   * handoff. Pairs with gap > this are recorded as breaks. Default
   * 1800 (30 minutes) — long enough to span "I went to lunch and
   * came back to the same problem", short enough that an
   * overnight gap is treated as a fresh start.
   */
  maxGapSeconds?: number;
  /** Grouping dimension. Default 'source'. */
  by?: TransitionsDimension;
  /** Top-N transitions surfaced in the table. Default 10. Must be >= 1. */
  topN?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface TransitionCell {
  from: string;
  to: string;
  /** Number of handoff pairs landing in this cell. */
  count: number;
  /** Median (50th-percentile, lower-half) gap in milliseconds. */
  medianGapMs: number;
  /** 95th percentile via nearest-rank (k = ceil(0.95 * n)). */
  p95GapMs: number;
  /**
   * Pairs where `next.started_at < effectiveEnd(prev)` — i.e. the
   * sessions actually overlapped. Recorded as `gap = 0` but
   * counted here so the operator can tell "0 because back-to-back"
   * from "0 because they were running side-by-side".
   */
  overlapCount: number;
}

export interface TransitionStickiness {
  group: string;
  /** Total handoffs leaving this group. */
  outgoing: number;
  /** Handoffs whose `to` is the same group. */
  selfLoop: number;
  /** selfLoop / outgoing. null when outgoing == 0. */
  stickiness: number | null;
}

export interface TransitionsReport {
  generatedAt: string;
  /** Inclusive ISO start of the window. null = unbounded. */
  windowStart: string | null;
  /** Exclusive ISO end of the window. null = unbounded. */
  windowEnd: string | null;
  by: TransitionsDimension;
  maxGapSeconds: number;
  topN: number;
  /** Sessions inside the window after filtering. */
  consideredSessions: number;
  /** Adjacent pairs evaluated = max(0, considered - 1). */
  adjacentPairs: number;
  /** Pairs whose gap <= maxGapSeconds (counted in the matrix). */
  handoffs: number;
  /** Pairs whose gap > maxGapSeconds (excluded from the matrix). */
  breaks: number;
  /** Pairs whose intervals actually overlapped. Subset of handoffs. */
  overlaps: number;
  /** Median gap across all handoff pairs, in ms. 0 when handoffs == 0. */
  overallMedianGapMs: number;
  /** p95 gap across all handoff pairs, in ms. 0 when handoffs == 0. */
  overallP95GapMs: number;
  /** Top-N transition cells by count desc. */
  topTransitions: TransitionCell[];
  /** Per-`from`-group stickiness, sorted by group asc. */
  stickiness: TransitionStickiness[];
  /** Distinct groups actually observed (sorted asc). */
  groups: string[];
}

function effectiveEndMs(s: SessionLine): number {
  const start = Date.parse(s.started_at);
  if (!Number.isFinite(start)) return Number.NaN;
  const lastMsg = Date.parse(s.last_message_at);
  const durMs = Number.isFinite(s.duration_seconds) ? Math.max(0, s.duration_seconds) * 1000 : 0;
  const candidates: number[] = [];
  if (Number.isFinite(lastMsg) && lastMsg > start) candidates.push(lastMsg);
  if (durMs > 0) candidates.push(start + durMs);
  if (candidates.length === 0) return start;
  return Math.max(...candidates);
}

function pickGroup(s: SessionLine, by: TransitionsDimension): string {
  const v = s[by];
  return typeof v === 'string' && v.length > 0 ? v : 'unknown';
}

/** Median (50th percentile, lower-half average for even n). */
function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Nearest-rank p95 (k = ceil(0.95 * n)). */
function p95(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const k = Math.max(1, Math.ceil(0.95 * sorted.length));
  return sorted[Math.min(k - 1, sorted.length - 1)]!;
}

export function buildTransitions(
  sessions: SessionLine[],
  opts: TransitionsOptions = {},
): TransitionsReport {
  const topN = opts.topN ?? 10;
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${opts.topN})`);
  }
  const maxGapSeconds = opts.maxGapSeconds ?? 1800;
  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds < 0) {
    throw new Error(`maxGapSeconds must be a non-negative finite number (got ${opts.maxGapSeconds})`);
  }
  const by: TransitionsDimension = opts.by ?? 'source';
  if (by !== 'source' && by !== 'kind' && by !== 'project_ref') {
    throw new Error(`by must be 'source' | 'kind' | 'project_ref' (got ${String(opts.by)})`);
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

  // Filter to in-window, sort.
  const filtered: SessionLine[] = [];
  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;
    filtered.push(s);
  }
  filtered.sort((a, b) => {
    const da = Date.parse(a.started_at);
    const db = Date.parse(b.started_at);
    if (da !== db) return da - db;
    return a.session_key < b.session_key ? -1 : a.session_key > b.session_key ? 1 : 0;
  });

  const cellMap = new Map<string, { from: string; to: string; gaps: number[]; overlap: number }>();
  let handoffs = 0;
  let breaks = 0;
  let overlaps = 0;
  const allHandoffGaps: number[] = [];

  // Per-`from` outgoing tally for stickiness.
  const outgoingByGroup = new Map<string, { total: number; selfLoop: number }>();

  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1]!;
    const next = filtered[i]!;
    const prevEnd = effectiveEndMs(prev);
    const nextStart = Date.parse(next.started_at);
    if (!Number.isFinite(prevEnd) || !Number.isFinite(nextStart)) continue;
    const rawGapMs = nextStart - prevEnd;
    const gapMs = Math.max(0, rawGapMs);
    const gapSeconds = gapMs / 1000;
    if (gapSeconds > maxGapSeconds) {
      breaks++;
      continue;
    }
    handoffs++;
    if (rawGapMs < 0) overlaps++;
    const fromGroup = pickGroup(prev, by);
    const toGroup = pickGroup(next, by);
    const key = `${fromGroup}\u0000${toGroup}`;
    const cell = cellMap.get(key);
    if (cell) {
      cell.gaps.push(gapMs);
      if (rawGapMs < 0) cell.overlap++;
    } else {
      cellMap.set(key, { from: fromGroup, to: toGroup, gaps: [gapMs], overlap: rawGapMs < 0 ? 1 : 0 });
    }
    const out = outgoingByGroup.get(fromGroup);
    if (out) {
      out.total++;
      if (toGroup === fromGroup) out.selfLoop++;
    } else {
      outgoingByGroup.set(fromGroup, { total: 1, selfLoop: toGroup === fromGroup ? 1 : 0 });
    }
    allHandoffGaps.push(gapMs);
  }

  // Build cells.
  const cells: TransitionCell[] = [];
  for (const c of cellMap.values()) {
    const sorted = [...c.gaps].sort((a, b) => a - b);
    cells.push({
      from: c.from,
      to: c.to,
      count: c.gaps.length,
      medianGapMs: median(sorted),
      p95GapMs: p95(sorted),
      overlapCount: c.overlap,
    });
  }
  // Sort by count desc, then (from, to) asc.
  cells.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });
  const topTransitions = cells.slice(0, topN);

  // Stickiness rows.
  const stickiness: TransitionStickiness[] = [];
  for (const [group, agg] of outgoingByGroup) {
    stickiness.push({
      group,
      outgoing: agg.total,
      selfLoop: agg.selfLoop,
      stickiness: agg.total === 0 ? null : agg.selfLoop / agg.total,
    });
  }
  stickiness.sort((a, b) => (a.group < b.group ? -1 : a.group > b.group ? 1 : 0));

  // Distinct groups.
  const groupSet = new Set<string>();
  for (const c of cells) {
    groupSet.add(c.from);
    groupSet.add(c.to);
  }
  const groups = [...groupSet].sort();

  const allSorted = [...allHandoffGaps].sort((a, b) => a - b);

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    maxGapSeconds,
    topN,
    consideredSessions: filtered.length,
    adjacentPairs: Math.max(0, filtered.length - 1),
    handoffs,
    breaks,
    overlaps,
    overallMedianGapMs: median(allSorted),
    overallP95GapMs: p95(allSorted),
    topTransitions,
    stickiness,
    groups,
  };
}
