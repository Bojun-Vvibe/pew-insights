/**
 * Turn-cadence distribution: per-session average seconds between
 * operator turns, defined as
 *
 *   cadence_seconds = duration_seconds / user_messages
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `session-lengths` reports per-session *total duration* — not
 *     normalised by how many operator turns happened inside that
 *     duration. A 30-minute session with 1 user turn and a
 *     30-minute session with 30 user turns both look like
 *     "30 minutes" in `session-lengths`, but they describe
 *     completely different working tempos.
 *   - `gaps` reports gaps *between* sessions, not within.
 *   - `velocity` is messages-per-hour over a *window* (a rate
 *     across many sessions); it does not surface the per-session
 *     intra-session cadence distribution.
 *   - `reply-ratio` is about message-count shape
 *     (assistant/user), not timing.
 *   - `concurrency` / `transitions` describe inter-session
 *     handoffs, not intra-session pacing.
 *
 * The cadence answers a different question: *how often, on
 * average, did I prod the agent during this session?* A small
 * cadence (≤30s) means "rapid back-and-forth conversation". A
 * large cadence (≥600s = 10min) means "long autonomous chains
 * between human prods". This is the temporal counterpart to
 * `reply-ratio`'s structural view, and is the natural way to
 * detect sessions where the operator parked the agent and walked
 * away.
 *
 * What we emit:
 *
 *   - per-bin counts and shares against a fixed default ladder
 *     (≤10s, ≤30s, ≤60s, ≤300s, ≤600s, ≤1800s, >1800s) or
 *     operator-supplied edges. The ladder spans rapid (≤10s),
 *     conversational (≤60s), thoughtful (≤5min), parked
 *     (≤30min), and abandoned-style (>30min) tempos.
 *   - quantile waypoints (p50 / p90 / p95 / p99 / max) using
 *     nearest-rank (k = ceil(q*n)) to match `gaps` /
 *     `session-lengths` / `reply-ratio`.
 *   - mean cadence across the considered population and the modal
 *     bin (largest count, ties broken by tighter upper edge).
 *   - per-bin median + mean so each bin's centre can be inspected.
 *   - cumulative share on each bin for the empirical CDF.
 *   - dropped-session counters distinguishing "no operator turns"
 *     (`user_messages == 0` — cadence undefined) from "below
 *     duration floor" (`duration_seconds < minDurationSeconds` —
 *     instant or negative-duration noise where cadence is
 *     meaningless).
 *
 * Window semantics: filter by `started_at` to match `sessions` /
 * `gaps` / `session-lengths` / `reply-ratio`.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified.
 */
import type { SessionLine } from './types.js';

export type TurnCadenceDimension = 'all' | 'source' | 'kind';

/**
 * Default bin upper-edges in seconds. Each edge is the inclusive
 * upper bound of its bin. The final bin is open-ended
 * (`> last edge`).
 *
 * Choices:
 *   - 10s    → very rapid (typing-speed back-and-forth)
 *   - 30s    → fast conversational
 *   - 60s    → conversational
 *   - 300s   → thoughtful (1–5 min between prods)
 *   - 600s   → slow / multitasking
 *   - 1800s  → parked (5–30 min between prods)
 *   - >1800s → abandoned-style (>30 min — operator walked away)
 */
export const DEFAULT_CADENCE_EDGES_SECONDS: number[] = [
  10, 30, 60, 300, 600, 1800,
];

export interface TurnCadenceOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Custom bin upper-edges in seconds (strictly ascending, all
   * > 0). If omitted, `DEFAULT_CADENCE_EDGES_SECONDS` is used.
   * The final "> last edge" bin is always appended automatically.
   */
  edges?: number[];
  /**
   * Drop sessions whose `duration_seconds < min`. Default 1 — a
   * zero- or negative-duration session can't describe cadence.
   * Set 0 to keep everything (zero-duration sessions will have
   * cadence 0, which falls in the first bin).
   */
  minDurationSeconds?: number;
  /**
   * Drop sessions whose `user_messages < min`. Default 1 — every
   * session needs at least one operator turn for the cadence
   * formula to be defined. Set higher (e.g. 2) to *also* exclude
   * single-prompt sessions, where `cadence = duration / 1 =
   * duration` and the metric collapses into pure session length.
   * Filtering single-prompt sessions surfaces the cadence of
   * actual *back-and-forth* sessions, separating "one prompt,
   * long autonomous run" from "many prods, fast tempo". Counted
   * separately as `droppedMinUserMessages` so the operator can
   * see how many sessions were excluded.
   */
  minUserMessages?: number;
  /**
   * Optional split dimension. Default 'all' = single global
   * distribution. 'source' / 'kind' emits one distribution per
   * group, sharing the same bin ladder for direct comparison.
   */
  by?: TurnCadenceDimension;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface TurnCadenceBin {
  /** Inclusive lower bound in seconds (previous edge, or 0 for first bin). */
  lowerSeconds: number;
  /** Inclusive upper bound in seconds, or `null` for the open-ended final bin. */
  upperSeconds: number | null;
  /** Human-readable label, e.g. '≤10s' / '10-30s' / '>1800s'. */
  label: string;
  count: number;
  /** count / totalSessions in the owning distribution. 0 when empty. */
  share: number;
  /**
   * Cumulative share of sessions in this bin and all earlier
   * (lower-cadence) bins. Empirical CDF evaluated at the bin's
   * upper edge (or 1.0 for the open-ended final bin). 0 when empty.
   */
  cumulativeShare: number;
  /** Median cadence (seconds) of the sessions in this bin. 0 if bin empty. */
  medianSeconds: number;
  /** Mean cadence (seconds) of the sessions in this bin. 0 if bin empty. */
  meanSeconds: number;
}

export interface TurnCadenceDistribution {
  /** Group key. 'all' for the global distribution. */
  group: string;
  totalSessions: number;
  /** Mean of cadence across sessions, in seconds. 0 when empty. */
  meanSeconds: number;
  /** Quantile waypoints in seconds via nearest-rank. 0 when empty. */
  p50Seconds: number;
  p90Seconds: number;
  p95Seconds: number;
  p99Seconds: number;
  maxSeconds: number;
  /** Bins in ascending order. */
  bins: TurnCadenceBin[];
  /** Index into `bins[]` of the modal bin. -1 when empty. */
  modalBinIndex: number;
}

export interface TurnCadenceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: TurnCadenceDimension;
  /** Resolved upper-edges actually used, in seconds. */
  edges: number[];
  minDurationSeconds: number;
  minUserMessages: number;
  /** Sessions matched by window but with user_messages == 0. */
  droppedZeroUserMessages: number;
  /** Sessions matched by window but dropped by the duration floor. */
  droppedMinDuration: number;
  /**
   * Sessions matched by window with `user_messages > 0` but
   * `user_messages < minUserMessages` (and so excluded as
   * single-prompt / not-enough-back-and-forth). Always `0` when
   * `minUserMessages <= 1`. Distinct from
   * `droppedZeroUserMessages` so the operator can tell
   * "agent-only rows" apart from "single-prompt rows".
   */
  droppedMinUserMessages: number;
  /** Sessions actually included in the distributions. */
  consideredSessions: number;
  /**
   * One distribution row per group. When `by == 'all'`, length 1
   * with group `'all'`. Otherwise sorted by totalSessions desc,
   * group asc.
   */
  distributions: TurnCadenceDistribution[];
}

function pickGroup(s: SessionLine, by: TurnCadenceDimension): string {
  if (by === 'all') return 'all';
  if (by === 'source') {
    return typeof s.source === 'string' && s.source.length > 0 ? s.source : 'unknown';
  }
  return typeof s.kind === 'string' && s.kind.length > 0 ? s.kind : 'unknown';
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

function formatSeconds(s: number): string {
  if (s === 0) return '0s';
  if (s < 1) return `${s.toFixed(2)}s`;
  if (Number.isInteger(s)) return `${s}s`;
  return `${s.toFixed(1)}s`;
}

function makeBinLabels(edges: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < edges.length; i++) {
    if (i === 0) {
      labels.push(`≤${formatSeconds(edges[0]!)}`);
    } else {
      labels.push(`${formatSeconds(edges[i - 1]!)}-${formatSeconds(edges[i]!)}`);
    }
  }
  labels.push(`>${formatSeconds(edges[edges.length - 1]!)}`);
  return labels;
}

function binFor(edges: number[], cadence: number): number {
  for (let i = 0; i < edges.length; i++) {
    if (cadence <= edges[i]!) return i;
  }
  return edges.length;
}

function buildDistribution(
  group: string,
  cadences: number[],
  edges: number[],
  labels: string[],
): TurnCadenceDistribution {
  const totalSessions = cadences.length;
  if (totalSessions === 0) {
    const bins: TurnCadenceBin[] = labels.map((label, i) => ({
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
      totalSessions: 0,
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

  const sortedAsc = [...cadences].sort((a, b) => a - b);
  const sum = sortedAsc.reduce((a, b) => a + b, 0);
  const meanSeconds = sum / totalSessions;

  const perBin: number[][] = labels.map(() => []);
  for (const c of cadences) perBin[binFor(edges, c)]!.push(c);

  const bins: TurnCadenceBin[] = labels.map((label, i) => {
    const xs = perBin[i]!;
    const sortedBin = [...xs].sort((a, b) => a - b);
    const binSum = sortedBin.reduce((a, b) => a + b, 0);
    return {
      lowerSeconds: i === 0 ? 0 : edges[i - 1]!,
      upperSeconds: i < edges.length ? edges[i]! : null,
      label,
      count: sortedBin.length,
      share: sortedBin.length / totalSessions,
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
    totalSessions,
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

export function buildTurnCadence(
  sessions: SessionLine[],
  opts: TurnCadenceOptions = {},
): TurnCadenceReport {
  const by: TurnCadenceDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source' && by !== 'kind') {
    throw new Error(`by must be 'all' | 'source' | 'kind' (got ${String(opts.by)})`);
  }

  const minDurationSeconds = opts.minDurationSeconds ?? 1;
  if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
    throw new Error(
      `minDurationSeconds must be a non-negative finite number (got ${opts.minDurationSeconds})`,
    );
  }

  const minUserMessages = opts.minUserMessages ?? 1;
  if (!Number.isFinite(minUserMessages) || minUserMessages < 1) {
    throw new Error(
      `minUserMessages must be a finite number >= 1 (got ${opts.minUserMessages})`,
    );
  }

  const edges = opts.edges ?? DEFAULT_CADENCE_EDGES_SECONDS;
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

  const buckets = new Map<string, number[]>();
  let consideredSessions = 0;
  let droppedZeroUserMessages = 0;
  let droppedMinDuration = 0;
  let droppedMinUserMessages = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    const um = Number(s.user_messages);
    const dur = Number(s.duration_seconds);
    if (!Number.isFinite(um) || !Number.isFinite(dur)) continue;
    if (um < 0 || dur < 0) continue;

    if (dur < minDurationSeconds) {
      droppedMinDuration += 1;
      continue;
    }
    if (um === 0) {
      droppedZeroUserMessages += 1;
      continue;
    }
    if (um < minUserMessages) {
      droppedMinUserMessages += 1;
      continue;
    }

    const cadence = dur / um;
    consideredSessions += 1;
    const g = pickGroup(s, by);
    let arr = buckets.get(g);
    if (!arr) {
      arr = [];
      buckets.set(g, arr);
    }
    arr.push(cadence);
  }

  const distributions: TurnCadenceDistribution[] = [];
  if (by === 'all') {
    distributions.push(
      buildDistribution('all', buckets.get('all') ?? [], edges, labels),
    );
  } else {
    for (const [g, arr] of buckets) {
      distributions.push(buildDistribution(g, arr, edges, labels));
    }
    distributions.sort((a, b) => {
      if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions;
      return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
    });
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    edges: [...edges],
    minDurationSeconds,
    minUserMessages,
    droppedZeroUserMessages,
    droppedMinDuration,
    droppedMinUserMessages,
    consideredSessions,
    distributions,
  };
}
