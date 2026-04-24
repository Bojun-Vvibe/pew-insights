/**
 * Message-volume distribution: per-session distribution of
 * `total_messages` (the count of messages exchanged in the
 * session, both user and assistant).
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `session-lengths` reports per-session *duration* (seconds);
 *     it does not say how many turns happened inside that
 *     duration. A 10-minute, 2-message exec and a 10-minute,
 *     200-message conversation both look like "10 minutes".
 *   - `reply-ratio` reports the *shape* of messages
 *     (`assistant_messages / user_messages`); a 1:1 session and
 *     a 100:100 session both have ratio 1.0.
 *   - `turn-cadence` reports *time between* operator turns
 *     (`duration / user_messages`); it normalises away total
 *     volume.
 *   - `sessions` reports *aggregate* message counts (totals,
 *     mean, p95) but not the *per-session* distribution shape
 *     (bin counts, modal bin, full quantile waypoints).
 *
 * The volume distribution answers: *how big are my sessions in
 * messages?* A small bin (≤2) means "one-shot" execs (a single
 * prompt + one reply). A middle bin (3–20) means "short
 * conversational". A large bin (>200) means "long sustained
 * sessions" — usually long-running agent loops.
 *
 * What we emit:
 *
 *   - per-bin counts and shares against a fixed default ladder
 *     (≤2, ≤5, ≤10, ≤20, ≤50, ≤100, ≤200, >200) or
 *     operator-supplied edges. The ladder spans one-shot,
 *     short conversational, long conversational, and sustained
 *     loop tempos.
 *   - quantile waypoints (p50 / p90 / p95 / p99 / max) using
 *     nearest-rank (k = ceil(q*n)) to match `gaps` /
 *     `session-lengths` / `reply-ratio` / `turn-cadence`.
 *   - mean message-count across the considered population and
 *     the modal bin (largest count, ties broken by tighter upper
 *     edge).
 *   - per-bin median + mean so each bin's centre can be inspected.
 *   - cumulative share on each bin for the empirical CDF.
 *   - dropped-session counters so the operator can tell why
 *     rows were excluded: below the min-messages floor, or
 *     non-finite / negative counts.
 *
 * Window semantics: filter by `started_at` to match `sessions` /
 * `gaps` / `session-lengths` / `reply-ratio` / `turn-cadence`.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified.
 */
import type { SessionLine } from './types.js';

export type MessageVolumeDimension = 'all' | 'source' | 'kind';

/**
 * Default bin upper-edges in messages. Each edge is the
 * inclusive upper bound of its bin. The final bin is open-ended
 * (`> last edge`).
 *
 * Choices:
 *   - 2    → one-shot (a single prompt + a single reply)
 *   - 5    → very short
 *   - 10   → short conversational
 *   - 20   → conversational
 *   - 50   → long conversational
 *   - 100  → long-running
 *   - 200  → sustained loop
 *   - >200 → very long sustained loop / runaway
 */
export const DEFAULT_VOLUME_EDGES: number[] = [2, 5, 10, 20, 50, 100, 200];

export interface MessageVolumeOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Custom bin upper-edges (strictly ascending, all > 0). If
   * omitted, `DEFAULT_VOLUME_EDGES` is used. The final
   * "> last edge" bin is always appended automatically.
   */
  edges?: number[];
  /**
   * Drop sessions whose `total_messages < min`. Default 1 — a
   * session with zero messages cannot meaningfully describe
   * any volume distribution. Set 0 to keep all rows
   * (equivalent here to "drop nothing on the volume floor").
   */
  minTotalMessages?: number;
  /**
   * Optional split dimension. Default 'all' = single global
   * distribution. 'source' / 'kind' emits one distribution per
   * group, sharing the same bin ladder so they are directly
   * comparable.
   */
  by?: MessageVolumeDimension;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
  /**
   * Optional analytic threshold on the message-count scale. When
   * set, every distribution gets an extra `aboveThresholdShare`
   * field = the fraction of sessions with `total_messages >
   * threshold`. Useful for answering "what share of my sessions
   * are runaway loops" (e.g. `threshold=100`) in a single field,
   * without re-summing bin shares (which is fragile when the
   * operator overrides `--edges`). Must be > 0 when supplied.
   */
  threshold?: number;
}

export interface MessageVolumeBin {
  /** Inclusive lower bound (the previous edge + 1, or 1 for the first bin). */
  lowerMessages: number;
  /** Inclusive upper bound, or `null` for the open-ended final bin. */
  upperMessages: number | null;
  /** Human-readable label, e.g. '≤2' / '3-5' / '>200'. */
  label: string;
  count: number;
  /** count / totalSessions in the owning distribution. 0 when empty. */
  share: number;
  /**
   * Cumulative share of sessions in this bin and all earlier
   * (lower-volume) bins. Empirical CDF evaluated at the bin's
   * upper edge (or 1.0 for the open-ended final bin). 0 when
   * empty.
   */
  cumulativeShare: number;
  /** Median total_messages of the sessions in this bin. 0 if empty. */
  medianMessages: number;
  /** Mean total_messages of the sessions in this bin. 0 if empty. */
  meanMessages: number;
}

export interface MessageVolumeDistribution {
  /** Group key. 'all' for the global distribution. */
  group: string;
  totalSessions: number;
  /** Mean of `total_messages` across sessions. 0 when empty. */
  meanMessages: number;
  /** Quantile waypoints via nearest-rank. 0 when empty. */
  p50Messages: number;
  p90Messages: number;
  p95Messages: number;
  p99Messages: number;
  maxMessages: number;
  /** Bins in ascending order. */
  bins: MessageVolumeBin[];
  /** Index into `bins[]` of the modal bin. -1 when empty. */
  modalBinIndex: number;
  /**
   * Fraction of sessions with `total_messages > threshold`. Only
   * populated when `opts.threshold` is supplied; otherwise `null`.
   * 0 when empty.
   */
  aboveThresholdShare: number | null;
}

export interface MessageVolumeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: MessageVolumeDimension;
  /** Resolved upper-edges actually used. */
  edges: number[];
  minTotalMessages: number;
  /** Threshold echoed from opts; null when not supplied. */
  threshold: number | null;
  /** Sessions matched by window but dropped by the min-messages floor. */
  droppedMinMessages: number;
  /** Sessions with non-finite / negative total_messages. */
  droppedInvalid: number;
  /** Sessions actually included in the distributions. */
  consideredSessions: number;
  /**
   * One distribution row per group. When `by == 'all'`, length 1
   * with group `'all'`. Otherwise sorted by totalSessions desc,
   * group asc.
   */
  distributions: MessageVolumeDistribution[];
}

function pickGroup(s: SessionLine, by: MessageVolumeDimension): string {
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

function makeBinLabels(edges: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < edges.length; i++) {
    if (i === 0) {
      labels.push(`≤${edges[0]!}`);
    } else {
      const lo = edges[i - 1]! + 1;
      const hi = edges[i]!;
      labels.push(lo === hi ? String(hi) : `${lo}-${hi}`);
    }
  }
  labels.push(`>${edges[edges.length - 1]!}`);
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
  values: number[],
  edges: number[],
  labels: string[],
  threshold: number | null,
): MessageVolumeDistribution {
  const totalSessions = values.length;
  if (totalSessions === 0) {
    const bins: MessageVolumeBin[] = labels.map((label, i) => ({
      lowerMessages: i === 0 ? 1 : edges[i - 1]! + 1,
      upperMessages: i < edges.length ? edges[i]! : null,
      label,
      count: 0,
      share: 0,
      cumulativeShare: 0,
      medianMessages: 0,
      meanMessages: 0,
    }));
    return {
      group,
      totalSessions: 0,
      meanMessages: 0,
      p50Messages: 0,
      p90Messages: 0,
      p95Messages: 0,
      p99Messages: 0,
      maxMessages: 0,
      bins,
      modalBinIndex: -1,
      aboveThresholdShare: threshold === null ? null : 0,
    };
  }

  const sortedAsc = [...values].sort((a, b) => a - b);
  const sum = sortedAsc.reduce((a, b) => a + b, 0);
  const meanMessages = sum / totalSessions;

  const perBin: number[][] = labels.map(() => []);
  for (const n of values) perBin[binFor(edges, n)]!.push(n);

  const bins: MessageVolumeBin[] = labels.map((label, i) => {
    const xs = perBin[i]!;
    const sortedBin = [...xs].sort((a, b) => a - b);
    const binSum = sortedBin.reduce((a, b) => a + b, 0);
    return {
      lowerMessages: i === 0 ? 1 : edges[i - 1]! + 1,
      upperMessages: i < edges.length ? edges[i]! : null,
      label,
      count: sortedBin.length,
      share: sortedBin.length / totalSessions,
      cumulativeShare: 0,
      medianMessages: sortedBin.length === 0 ? 0 : nearestRank(sortedBin, 0.5),
      meanMessages: sortedBin.length === 0 ? 0 : binSum / sortedBin.length,
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
      const aUp = a.upperMessages === null ? Number.POSITIVE_INFINITY : a.upperMessages;
      const bUp = b.upperMessages === null ? Number.POSITIVE_INFINITY : b.upperMessages;
      if (bUp < aUp) modalBinIndex = i;
    }
  }

  return {
    group,
    totalSessions,
    meanMessages,
    p50Messages: nearestRank(sortedAsc, 0.5),
    p90Messages: nearestRank(sortedAsc, 0.9),
    p95Messages: nearestRank(sortedAsc, 0.95),
    p99Messages: nearestRank(sortedAsc, 0.99),
    maxMessages: sortedAsc[sortedAsc.length - 1]!,
    bins,
    modalBinIndex,
    aboveThresholdShare:
      threshold === null
        ? null
        : values.reduce((acc, n) => acc + (n > threshold ? 1 : 0), 0) / totalSessions,
  };
}

export function buildMessageVolume(
  sessions: SessionLine[],
  opts: MessageVolumeOptions = {},
): MessageVolumeReport {
  const by: MessageVolumeDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source' && by !== 'kind') {
    throw new Error(`by must be 'all' | 'source' | 'kind' (got ${String(opts.by)})`);
  }

  const minTotalMessages = opts.minTotalMessages ?? 1;
  if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
    throw new Error(
      `minTotalMessages must be a non-negative finite number (got ${opts.minTotalMessages})`,
    );
  }

  const edges = opts.edges ?? DEFAULT_VOLUME_EDGES;
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

  const threshold = opts.threshold ?? null;
  if (threshold !== null && (!Number.isFinite(threshold) || threshold <= 0)) {
    throw new Error(
      `threshold must be a positive finite number when supplied (got ${opts.threshold})`,
    );
  }

  const buckets = new Map<string, number[]>();
  let consideredSessions = 0;
  let droppedMinMessages = 0;
  let droppedInvalid = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    const tm = Number(s.total_messages);
    if (!Number.isFinite(tm) || tm < 0) {
      droppedInvalid += 1;
      continue;
    }

    if (tm < minTotalMessages) {
      droppedMinMessages += 1;
      continue;
    }

    consideredSessions += 1;
    const g = pickGroup(s, by);
    let arr = buckets.get(g);
    if (!arr) {
      arr = [];
      buckets.set(g, arr);
    }
    arr.push(tm);
  }

  const distributions: MessageVolumeDistribution[] = [];
  if (by === 'all') {
    distributions.push(
      buildDistribution('all', buckets.get('all') ?? [], edges, labels, threshold),
    );
  } else {
    for (const [g, arr] of buckets) {
      distributions.push(buildDistribution(g, arr, edges, labels, threshold));
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
    minTotalMessages,
    threshold,
    droppedMinMessages,
    droppedInvalid,
    consideredSessions,
    distributions,
  };
}
