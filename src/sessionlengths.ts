/**
 * Session-length distribution: a binned histogram of session
 * `duration_seconds` plus quantile waypoints (p50/p90/p95/p99/max).
 *
 * Why a new subcommand instead of folding into `sessions`:
 *
 *   - `sessions` already emits *summary* stats (median + mean + p95)
 *     and a "longest single session" callout, but it deliberately
 *     does NOT show the *shape* of the distribution. A median can be
 *     45 min while the population is bimodal (many 5-min check-ins
 *     plus a smaller tail of multi-hour deep work) and `sessions`
 *     never exposes that.
 *   - `gaps` is about *inter-session* idle time, not intra-session
 *     duration.
 *   - `concurrency` and `transitions` operate on overlap / handoff
 *     structure between sessions, not duration shape.
 *
 * What we emit:
 *
 *   - per-bin counts and shares against a fixed default ladder
 *     (≤1m, ≤5m, ≤15m, ≤30m, ≤1h, ≤2h, ≤4h, >4h) or operator-
 *     supplied edges,
 *   - quantile waypoints (p50, p90, p95, p99, max) using the
 *     nearest-rank convention (k = ceil(q*n)) so the threshold is
 *     always an actually-observed duration, matching `gaps`,
 *   - mean and total wall-clock,
 *   - the modal bin (largest by count, ties broken by upper edge
 *     ascending so the "tightest" winning bin wins),
 *   - per-bin median and mean so the operator can see e.g. that the
 *     ≤1h bin is genuinely centred at 35min and not crowded against
 *     the ceiling.
 *
 * Window semantics: filter by `started_at` to match `sessions` /
 * `gaps`. A session that started in-window but ran past the
 * `until` boundary is still counted at its full `duration_seconds`,
 * because the question is "what shape of session do I start", not
 * "how much time did I spend in-window".
 *
 * Determinism: pure builder. No `Date.now()` reads. All stats
 * computed off the in-memory window; sort fully specified.
 */
import type { SessionLine } from './types.js';

export type SessionLengthsDimension = 'all' | 'source' | 'kind';

/**
 * Default bin edges in seconds. Each edge is the *upper* bound of
 * its bin (inclusive). The final bin is open-ended (`> last edge`).
 * Choices reflect the natural human session-shape ladder: under a
 * minute (mis-clicks / quick lookups), under five (one-shot
 * questions), under fifteen (small task), under thirty (a normal
 * dev cycle), under one / two / four hours (deep work tiers).
 */
export const DEFAULT_LENGTH_EDGES_SECONDS: number[] = [
  60, 300, 900, 1800, 3600, 7200, 14400,
];

export interface SessionLengthsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Custom bin upper-edges in seconds (strictly ascending, all > 0).
   * If omitted, `DEFAULT_LENGTH_EDGES_SECONDS` is used. The final
   * "> last edge" bin is always appended automatically.
   */
  edgesSeconds?: number[];
  /** Drop sessions with `duration_seconds < min`. Default 0. */
  minDurationSeconds?: number;
  /**
   * Optional split dimension. Default 'all' = single global
   * distribution. 'source' / 'kind' emits one distribution per
   * group, sharing the same bin ladder so distributions are
   * directly comparable.
   */
  by?: SessionLengthsDimension;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SessionLengthsBin {
  /** Inclusive lower bound in seconds (the previous edge, or 0 for the first bin). */
  lowerSeconds: number;
  /** Inclusive upper bound in seconds, or `null` for the open-ended final bin. */
  upperSeconds: number | null;
  /** Human-readable label, e.g. '≤1m' / '1m-5m' / '>4h'. */
  label: string;
  count: number;
  /** count / totalSessions (in the owning distribution). 0 if owner is empty. */
  share: number;
  /**
   * Cumulative share of sessions in this bin and all earlier
   * (shorter-duration) bins. Empirical CDF evaluated at the bin's
   * upper edge (or 1.0 for the open-ended final bin). 0 when the
   * owning distribution is empty.
   */
  cumulativeShare: number;
  /** Median duration_seconds of the sessions in this bin. 0 if bin empty. */
  medianSeconds: number;
  /** Mean duration_seconds of the sessions in this bin. 0 if bin empty. */
  meanSeconds: number;
}

export interface SessionLengthsDistribution {
  /** Group key. 'all' for the global distribution. */
  group: string;
  totalSessions: number;
  /** Sum of duration_seconds across this group (after min-duration filter). */
  totalSeconds: number;
  /** Mean duration_seconds. 0 when empty. */
  meanSeconds: number;
  /** Quantile waypoints via nearest-rank. 0 when empty. */
  p50Seconds: number;
  p90Seconds: number;
  p95Seconds: number;
  p99Seconds: number;
  maxSeconds: number;
  /** Bins in ascending order; first bin is `[0, edges[0]]`. */
  bins: SessionLengthsBin[];
  /** Index into `bins[]` of the modal bin. -1 when empty. */
  modalBinIndex: number;
}

export interface SessionLengthsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: SessionLengthsDimension;
  /** Resolved upper-edges actually used (in seconds). */
  edgesSeconds: number[];
  minDurationSeconds: number;
  /** Sessions considered after window + min-duration filtering. */
  consideredSessions: number;
  /**
   * One distribution row per group. When `by == 'all'`, length 1
   * with group `'all'`. When `by == 'source' | 'kind'`, sorted by
   * totalSessions desc, group asc.
   */
  distributions: SessionLengthsDistribution[];
}

function pickGroup(s: SessionLine, by: SessionLengthsDimension): string {
  if (by === 'all') return 'all';
  if (by === 'source') {
    return typeof s.source === 'string' && s.source.length > 0 ? s.source : 'unknown';
  }
  // kind
  return typeof s.kind === 'string' && s.kind.length > 0 ? s.kind : 'unknown';
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = sec / 60;
    return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
  }
  const h = sec / 3600;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
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

function binFor(edges: number[], duration: number): number {
  for (let i = 0; i < edges.length; i++) {
    if (duration <= edges[i]!) return i;
  }
  return edges.length; // open-ended bin
}

function buildDistribution(
  group: string,
  durations: number[],
  edges: number[],
  labels: string[],
): SessionLengthsDistribution {
  const totalSessions = durations.length;
  if (totalSessions === 0) {
    const bins: SessionLengthsBin[] = labels.map((label, i) => ({
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
      totalSeconds: 0,
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

  const sortedAsc = [...durations].sort((a, b) => a - b);
  const totalSeconds = sortedAsc.reduce((a, b) => a + b, 0);
  const meanSeconds = totalSeconds / totalSessions;

  // Bucket per-bin durations to compute per-bin median/mean.
  const perBin: number[][] = labels.map(() => []);
  for (const d of durations) perBin[binFor(edges, d)]!.push(d);

  const bins: SessionLengthsBin[] = labels.map((label, i) => {
    const xs = perBin[i]!;
    const sortedBin = [...xs].sort((a, b) => a - b);
    const sum = sortedBin.reduce((a, b) => a + b, 0);
    return {
      lowerSeconds: i === 0 ? 0 : edges[i - 1]!,
      upperSeconds: i < edges.length ? edges[i]! : null,
      label,
      count: sortedBin.length,
      share: sortedBin.length / totalSessions,
      cumulativeShare: 0, // patched below in a second pass
      medianSeconds: sortedBin.length === 0 ? 0 : nearestRank(sortedBin, 0.5),
      meanSeconds: sortedBin.length === 0 ? 0 : sum / sortedBin.length,
    };
  });

  // Cumulative share pass. Open-ended bin always closes at 1.0
  // exactly to absorb floating-point drift.
  let acc = 0;
  for (let i = 0; i < bins.length; i++) {
    acc += bins[i]!.share;
    bins[i]!.cumulativeShare = i === bins.length - 1 ? 1 : acc;
  }

  // Modal bin: largest count; tie-break upper edge ascending
  // (open-ended bin's upper is treated as +Infinity for ordering).
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
    totalSeconds,
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

export function buildSessionLengths(
  sessions: SessionLine[],
  opts: SessionLengthsOptions = {},
): SessionLengthsReport {
  const by: SessionLengthsDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source' && by !== 'kind') {
    throw new Error(`by must be 'all' | 'source' | 'kind' (got ${String(opts.by)})`);
  }

  const minDurationSeconds = opts.minDurationSeconds ?? 0;
  if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
    throw new Error(`minDurationSeconds must be a non-negative finite number (got ${opts.minDurationSeconds})`);
  }

  const edges = opts.edgesSeconds ?? DEFAULT_LENGTH_EDGES_SECONDS;
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error('edgesSeconds must be a non-empty array');
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!Number.isFinite(e) || e <= 0) {
      throw new Error(`edgesSeconds[${i}] must be a positive finite number (got ${e})`);
    }
    if (i > 0 && e <= edges[i - 1]!) {
      throw new Error(`edgesSeconds must be strictly ascending (edges[${i}] = ${e} <= edges[${i - 1}] = ${edges[i - 1]})`);
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

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;
    const dur = Number(s.duration_seconds);
    if (!Number.isFinite(dur) || dur < 0) continue;
    if (dur < minDurationSeconds) continue;

    consideredSessions += 1;
    const g = pickGroup(s, by);
    let arr = buckets.get(g);
    if (!arr) {
      arr = [];
      buckets.set(g, arr);
    }
    arr.push(dur);
  }

  const distributions: SessionLengthsDistribution[] = [];
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
    edgesSeconds: [...edges],
    minDurationSeconds,
    consideredSessions,
    distributions,
  };
}
