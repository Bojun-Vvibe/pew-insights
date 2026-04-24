/**
 * Idle-gap distribution **inside** a session.
 *
 * `gaps` (the existing subcommand) measures pauses *between*
 * sessions — adjacent (prev, next) pairs across the entire corpus.
 * That is the right tool for "when am I active vs idle as an
 * operator", but it is silent on what happens *within* a single
 * `session_key` once it has started.
 *
 * `idle-gaps` answers the orthogonal question: while a session is
 * notionally "alive" (multiple snapshots have been emitted under
 * the same `session_key`), how long are the quiet stretches between
 * consecutive snapshots?
 *
 * Why this is interesting:
 *
 *   1. A long intra-session idle gap with no model change is the
 *      classic "I left the agent open, walked away, came back, kept
 *      typing" pattern. These inflate `duration_seconds` without
 *      meaningfully inflating throughput, which biases anything
 *      downstream that divides cost by wall-clock duration.
 *   2. A *short* p99 inside a session means the session is being
 *      re-snapshotted aggressively (chatty agent loops). That is a
 *      candidate signal for "this integration is over-snapshotting".
 *   3. The shape of the histogram (modal bin) tells the operator
 *      whether their typical session is bursty (modal ≤60s) or
 *      conversational (modal ≤30m).
 *
 * What we emit:
 *
 *   - per-bin counts and shares against a fixed default ladder of
 *     intra-session pause durations (≤60s, ≤5m, ≤30m, ≤1h, ≤4h,
 *     ≤1d, >1d) or operator-supplied edges.
 *   - quantile waypoints (p50 / p90 / p95 / p99 / max) using
 *     nearest-rank, matching the rest of the codebase.
 *   - mean idle-gap across the population and the modal bin
 *     (largest count, ties broken by the tighter upper edge).
 *   - per-bin median + mean so each bin's centre can be inspected.
 *   - cumulative share on each bin for the empirical CDF.
 *   - dropped-row counters so the operator can see why rows did
 *     not contribute: a session_key that only ever produced a
 *     single snapshot has zero gap pairs and is dropped at the
 *     `singleSnapshotSessions` counter (not at the gap-pair level)
 *     so the operator can read "how many of my session_keys are
 *     one-shot".
 *
 * Window semantics: filter by `started_at` to match `sessions` /
 * `gaps` / every other session-level subcommand. A session_key is
 * admitted if *any* of its snapshots fall in the window — once
 * admitted, every consecutive snapshot pair contributes a gap.
 *
 * Determinism: pure builder. No `Date.now()` reads. Snapshot
 * ordering is `snapshot_at` ascending with `started_at` as a
 * deterministic tiebreaker (matches `model-switching`).
 */
import type { SessionLine } from './types.js';

export type IdleGapsDimension = 'all' | 'source' | 'kind';

/**
 * Default bin upper-edges in **seconds**. Each edge is the
 * inclusive upper bound of its bin. The final bin is open-ended.
 *
 * Choices:
 *   - 60       → tight burst (chatty re-snapshot)
 *   - 300      → 5m, normal think-time
 *   - 1800     → 30m, slow conversational
 *   - 3600     → 1h, coffee break
 *   - 14400    → 4h, half-day pause
 *   - 86400    → 1 day, "left it open overnight"
 *   - >86400   → multi-day session (very stale)
 */
export const DEFAULT_IDLE_GAP_EDGES_SECONDS: number[] = [
  60, 300, 1800, 3600, 14400, 86400,
];

export interface IdleGapsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Custom bin upper-edges in seconds (strictly ascending,
   * all > 0). If omitted, `DEFAULT_IDLE_GAP_EDGES_SECONDS` is
   * used. The final "> last edge" bin is always appended.
   */
  edges?: number[];
  /**
   * Drop intra-session gaps shorter than this many seconds.
   * Default 0 (keep everything). Useful when the queue is
   * snapshotting extremely aggressively (every couple of seconds)
   * and the operator wants to filter out noise.
   */
  minGapSeconds?: number;
  /** Optional split dimension. Default 'all'. */
  by?: IdleGapsDimension;
  /**
   * If > 0, populate `topSessions` with the top-N session_keys
   * ranked by `maxGapSeconds` desc. Useful for "which sessions
   * have the longest single intra-session pause" — typically
   * "I left this one open overnight" cases. Default 0 (skip).
   */
  topSessions?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface IdleGapsTopSession {
  session_key: string;
  source: string;
  kind: string;
  /** Number of intra-session gap pairs for this session_key. */
  gapCount: number;
  /** Maximum intra-session gap in seconds. */
  maxGapSeconds: number;
  /** Sum of intra-session gaps in seconds. */
  totalGapSeconds: number;
}

export interface IdleGapsBin {
  /** Inclusive lower bound (the previous edge, or 0 for the first bin). */
  lowerSeconds: number;
  /** Inclusive upper bound, or null for the open-ended final bin. */
  upperSeconds: number | null;
  /** Human-readable label, e.g. '≤60s' / '60s-300s' / '>86400s'. */
  label: string;
  count: number;
  /** count / totalGaps in the owning distribution. 0 when empty. */
  share: number;
  /**
   * Cumulative share of gaps in this bin and all earlier (shorter)
   * bins. 0 when empty; final bin is always 1.0 when totalGaps > 0.
   */
  cumulativeShare: number;
  /** Median gap_seconds of the gaps in this bin. 0 if empty. */
  medianSeconds: number;
  /** Mean gap_seconds of the gaps in this bin. 0 if empty. */
  meanSeconds: number;
}

export interface IdleGapsDistribution {
  /** Group key. 'all' for the global distribution. */
  group: string;
  /**
   * Distinct session_keys that contributed at least one gap pair
   * to this group.
   */
  sessions: number;
  /** Count of intra-session gap measurements (snapshot pairs). */
  totalGaps: number;
  /** Mean gap_seconds across the distribution. 0 when empty. */
  meanSeconds: number;
  /** Quantile waypoints via nearest-rank. 0 when empty. */
  p50Seconds: number;
  p90Seconds: number;
  p95Seconds: number;
  p99Seconds: number;
  maxSeconds: number;
  /** Bins in ascending order. */
  bins: IdleGapsBin[];
  /** Index into `bins[]` of the modal bin. -1 when empty. */
  modalBinIndex: number;
}

export interface IdleGapsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: IdleGapsDimension;
  edges: number[];
  minGapSeconds: number;
  /**
   * session_keys matched by the window but with only a single
   * snapshot (so no gap pair could be measured). Counted globally,
   * not per-group.
   */
  singleSnapshotSessions: number;
  /** Raw snapshot rows dropped because of unparseable `snapshot_at`. */
  droppedInvalidSnapshots: number;
  /** Gap pairs dropped because their gap was below `minGapSeconds`. */
  droppedBelowFloor: number;
  /**
   * Distinct session_keys that contributed at least one gap pair
   * to *any* group.
   */
  consideredSessions: number;
  /** Total intra-session gap pairs included across all groups. */
  totalGaps: number;
  /**
   * Top-N session_keys by max intra-session gap (desc, with
   * session_key asc as deterministic tiebreaker). Empty unless
   * `opts.topSessions > 0`.
   */
  topSessions: IdleGapsTopSession[];
  /**
   * One distribution row per group. When `by == 'all'`, length 1
   * with group `'all'`. Otherwise sorted by `totalGaps` desc,
   * group asc.
   */
  distributions: IdleGapsDistribution[];
}

interface PerKey {
  source: string;
  kind: string;
  /** snapshot rows for this session_key, in input order. */
  snapshots: { snapshot_at: string; started_at: string }[];
}

function pickGroup(pk: PerKey, by: IdleGapsDimension): string {
  if (by === 'all') return 'all';
  if (by === 'source') return pk.source.length > 0 ? pk.source : 'unknown';
  return pk.kind.length > 0 ? pk.kind : 'unknown';
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

function makeBinLabels(edges: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < edges.length; i++) {
    if (i === 0) {
      labels.push(`≤${edges[0]!}s`);
    } else {
      labels.push(`${edges[i - 1]!}s-${edges[i]!}s`);
    }
  }
  labels.push(`>${edges[edges.length - 1]!}s`);
  return labels;
}

function binFor(edges: number[], n: number): number {
  for (let i = 0; i < edges.length; i++) {
    if (n <= edges[i]!) return i;
  }
  return edges.length;
}

function buildDistribution(
  group: string,
  sessions: number,
  values: number[],
  edges: number[],
  labels: string[],
): IdleGapsDistribution {
  const totalGaps = values.length;
  if (totalGaps === 0) {
    const bins: IdleGapsBin[] = labels.map((label, i) => ({
      lowerSeconds: i === 0 ? 0 : edges[i - 1]!,
      upperSeconds: i < edges.length ? edges[i]! : null,
      label,
      count: 0,
      share: 0,
      cumulativeShare: 0,
      medianSeconds: 0,
      meanSeconds: 0,
    }));
    return {
      group,
      sessions,
      totalGaps: 0,
      meanSeconds: 0,
      p50Seconds: 0,
      p90Seconds: 0,
      p95Seconds: 0,
      p99Seconds: 0,
      maxSeconds: 0,
      bins,
      modalBinIndex: -1,
    };
  }

  const sortedAsc = [...values].sort((a, b) => a - b);
  const sum = sortedAsc.reduce((a, b) => a + b, 0);
  const meanSeconds = sum / totalGaps;

  const perBin: number[][] = labels.map(() => []);
  for (const n of values) perBin[binFor(edges, n)]!.push(n);

  const bins: IdleGapsBin[] = labels.map((label, i) => {
    const xs = perBin[i]!;
    const sortedBin = [...xs].sort((a, b) => a - b);
    const binSum = sortedBin.reduce((a, b) => a + b, 0);
    return {
      lowerSeconds: i === 0 ? 0 : edges[i - 1]!,
      upperSeconds: i < edges.length ? edges[i]! : null,
      label,
      count: sortedBin.length,
      share: sortedBin.length / totalGaps,
      cumulativeShare: 0,
      medianSeconds: sortedBin.length === 0 ? 0 : nearestRank(sortedBin, 0.5),
      meanSeconds: sortedBin.length === 0 ? 0 : binSum / sortedBin.length,
    };
  });

  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    acc += bins[i]!.share;
    bins[i]!.cumulativeShare = i === bins.length - 1 ? 1 : acc;
  }

  let modalBinIndex = 0;
  for (let i = 1; i < bins.length; i++) {
    const a = bins[modalBinIndex]!;
    const b = bins[i]!;
    if (b.count > a.count) {
      modalBinIndex = i;
    } else if (b.count === a.count) {
      const aUp = a.upperSeconds === null ? Number.POSITIVE_INFINITY : a.upperSeconds;
      const bUp = b.upperSeconds === null ? Number.POSITIVE_INFINITY : b.upperSeconds;
      if (bUp < aUp) modalBinIndex = i;
    }
  }

  return {
    group,
    sessions,
    totalGaps,
    meanSeconds,
    p50Seconds: nearestRank(sortedAsc, 0.5),
    p90Seconds: nearestRank(sortedAsc, 0.9),
    p95Seconds: nearestRank(sortedAsc, 0.95),
    p99Seconds: nearestRank(sortedAsc, 0.99),
    maxSeconds: sortedAsc[sortedAsc.length - 1]!,
    bins,
    modalBinIndex,
  };
}

export function buildIdleGaps(
  sessions: SessionLine[],
  opts: IdleGapsOptions = {},
): IdleGapsReport {
  const by: IdleGapsDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source' && by !== 'kind') {
    throw new Error(`by must be 'all' | 'source' | 'kind' (got ${String(opts.by)})`);
  }

  const minGapSeconds = opts.minGapSeconds ?? 0;
  if (!Number.isFinite(minGapSeconds) || minGapSeconds < 0) {
    throw new Error(
      `minGapSeconds must be a non-negative finite number (got ${opts.minGapSeconds})`,
    );
  }

  const edges = opts.edges ?? DEFAULT_IDLE_GAP_EDGES_SECONDS;
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error('edges must be a non-empty array');
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!Number.isFinite(e) || e <= 0) {
      throw new Error(`edges[${i}] must be a positive finite number (got ${e})`);
    }
    if (i > 0 && e <= edges[i - 1]!) {
      throw new Error(
        `edges must be strictly ascending (edges[${i}] = ${e} <= edges[${i - 1}] = ${edges[i - 1]})`,
      );
    }
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
  const labels = makeBinLabels(edges);

  const topSessionsN = opts.topSessions ?? 0;
  if (!Number.isFinite(topSessionsN) || topSessionsN < 0 || !Number.isInteger(topSessionsN)) {
    throw new Error(
      `topSessions must be a non-negative integer (got ${opts.topSessions})`,
    );
  }

  // Accumulate snapshots per session_key.
  const perKey = new Map<string, PerKey>();
  let droppedInvalidSnapshots = 0;
  for (const s of sessions) {
    if (typeof s.session_key !== 'string' || s.session_key.length === 0) continue;
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;
    const snapAt = typeof s.snapshot_at === 'string' ? s.snapshot_at : '';
    const snapMs = Date.parse(snapAt);
    if (!Number.isFinite(snapMs)) {
      droppedInvalidSnapshots += 1;
      continue;
    }
    let entry = perKey.get(s.session_key);
    if (!entry) {
      entry = {
        source: typeof s.source === 'string' ? s.source : '',
        kind: typeof s.kind === 'string' ? s.kind : '',
        snapshots: [],
      };
      perKey.set(s.session_key, entry);
    }
    entry.snapshots.push({ snapshot_at: snapAt, started_at: s.started_at });
  }

  // Per-session gap extraction.
  let singleSnapshotSessions = 0;
  let droppedBelowFloor = 0;
  // Map<group, { sessions: Set<key>, gaps: number[] }>
  const buckets = new Map<string, { sessions: Set<string>; gaps: number[] }>();
  let consideredSessions = 0;
  // For top-sessions: collected per session_key.
  const perSessionStats: IdleGapsTopSession[] = [];

  for (const [key, pk] of perKey) {
    if (pk.snapshots.length < 2) {
      singleSnapshotSessions += 1;
      continue;
    }
    // Sort snapshots by snapshot_at asc, started_at as tiebreak.
    const snaps = [...pk.snapshots].sort((a, b) => {
      if (a.snapshot_at < b.snapshot_at) return -1;
      if (a.snapshot_at > b.snapshot_at) return 1;
      if (a.started_at < b.started_at) return -1;
      if (a.started_at > b.started_at) return 1;
      return 0;
    });
    const localGaps: number[] = [];
    for (let i = 1; i < snaps.length; i++) {
      const prev = Date.parse(snaps[i - 1]!.snapshot_at);
      const cur = Date.parse(snaps[i]!.snapshot_at);
      if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
      const gap = Math.max(0, (cur - prev) / 1000);
      if (gap < minGapSeconds) {
        droppedBelowFloor += 1;
        continue;
      }
      localGaps.push(gap);
    }
    if (localGaps.length === 0) continue;
    consideredSessions += 1;
    const g = pickGroup(pk, by);
    let bucket = buckets.get(g);
    if (!bucket) {
      bucket = { sessions: new Set<string>(), gaps: [] };
      buckets.set(g, bucket);
    }
    bucket.sessions.add(key);
    for (const v of localGaps) bucket.gaps.push(v);

    if (topSessionsN > 0) {
      let maxG = 0;
      let sumG = 0;
      for (const v of localGaps) {
        if (v > maxG) maxG = v;
        sumG += v;
      }
      perSessionStats.push({
        session_key: key,
        source: pk.source,
        kind: pk.kind,
        gapCount: localGaps.length,
        maxGapSeconds: maxG,
        totalGapSeconds: sumG,
      });
    }
  }

  let totalGaps = 0;
  for (const b of buckets.values()) totalGaps += b.gaps.length;

  // Resolve top-N sessions by maxGapSeconds desc, session_key asc.
  let topSessions: IdleGapsTopSession[] = [];
  if (topSessionsN > 0 && perSessionStats.length > 0) {
    perSessionStats.sort((a, b) => {
      if (b.maxGapSeconds !== a.maxGapSeconds) return b.maxGapSeconds - a.maxGapSeconds;
      if (a.session_key < b.session_key) return -1;
      if (a.session_key > b.session_key) return 1;
      return 0;
    });
    topSessions = perSessionStats.slice(0, topSessionsN);
  }

  const distributions: IdleGapsDistribution[] = [];
  if (by === 'all') {
    const b = buckets.get('all') ?? { sessions: new Set<string>(), gaps: [] };
    distributions.push(buildDistribution('all', b.sessions.size, b.gaps, edges, labels));
  } else {
    for (const [g, b] of buckets) {
      distributions.push(buildDistribution(g, b.sessions.size, b.gaps, edges, labels));
    }
    distributions.sort((a, b) => {
      if (b.totalGaps !== a.totalGaps) return b.totalGaps - a.totalGaps;
      return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
    });
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    edges: [...edges],
    minGapSeconds,
    singleSnapshotSessions,
    droppedInvalidSnapshots,
    droppedBelowFloor,
    consideredSessions,
    totalGaps,
    topSessions,
    distributions,
  };
}
