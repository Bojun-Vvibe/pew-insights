/**
 * Reply-ratio distribution: per-session shape of
 * `assistant_messages / user_messages`.
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `sessions` reports message counts in aggregate (totals, mean,
 *     p95) but not the *per-session ratio* between operator turns
 *     and agent turns. A session with 1 user message and 30
 *     assistant messages and a session with 15 of each both look
 *     "active" in `sessions`, but they describe very different
 *     working modes.
 *   - `agent-mix` is about *token-volume* concentration across
 *     agents (HHI / Gini); it does not address the conversational
 *     shape inside any one session.
 *   - `session-lengths` is about *duration*, not message structure.
 *   - `transitions` / `concurrency` look at inter-session
 *     handoffs, not intra-session reply structure.
 *
 * The ratio `assistant_messages / user_messages` answers a
 * different question: *how many assistant turns do I get per
 * operator turn?* A high ratio (e.g. ≥5) means the session is
 * agent-led — long autonomous chains between human prods. A ratio
 * near 1 means the session is conversational. A ratio < 1 means
 * the operator is sending more turns than the assistant replies
 * to (rare; usually pre-flight messages, cancelled runs, or
 * partial captures).
 *
 * What we emit:
 *
 *   - per-bin counts and shares against a fixed default ladder
 *     (≤0.5, ≤1, ≤2, ≤5, ≤10, ≤20, >20) or operator-supplied
 *     edges. The ladder spans the four meaningful regimes:
 *     under-replied (<1), conversational (~1), agent-amplified
 *     (1–5), and agent-monologue (>5).
 *   - quantile waypoints (p50 / p90 / p95 / p99 / max) using the
 *     nearest-rank convention (k = ceil(q*n)) to match `gaps` /
 *     `session-lengths`.
 *   - mean ratio across the considered population and the modal
 *     bin (largest count, ties broken by tighter upper edge).
 *   - per-bin median + mean so each bin's centre can be inspected.
 *   - cumulative share on each bin so downstream consumers can
 *     read the empirical CDF without re-summing.
 *   - dropped-session counters: how many sessions were skipped
 *     because `user_messages == 0` (ratio undefined) or because
 *     the row failed the min-messages floor. Distinct counters
 *     so the operator can tell "I have lots of agent-only rows"
 *     from "I have lots of tiny noise rows".
 *
 * Window semantics: filter by `started_at` to match `sessions` /
 * `gaps` / `session-lengths`.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified.
 */
import type { SessionLine } from './types.js';

export type ReplyRatioDimension = 'all' | 'source' | 'kind';

/**
 * Default bin upper-edges on the ratio scale. Each edge is the
 * inclusive upper bound of its bin. The final bin is open-ended
 * (`> last edge`).
 *
 * Choices:
 *   - 0.5  → operator-dominant (more user turns than assistant)
 *   - 1.0  → roughly balanced
 *   - 2.0  → light agent amplification
 *   - 5.0  → moderate agent amplification
 *   - 10.0 → strong agent amplification
 *   - 20.0 → near-monologue
 *   - >20  → full monologue / chain-of-thought run
 */
export const DEFAULT_RATIO_EDGES: number[] = [0.5, 1, 2, 5, 10, 20];

export interface ReplyRatioOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Custom bin upper-edges (strictly ascending, all > 0). If
   * omitted, `DEFAULT_RATIO_EDGES` is used. The final
   * "> last edge" bin is always appended automatically.
   */
  edges?: number[];
  /**
   * Drop sessions whose `total_messages < min`. Default 2 — a
   * session with only one message (in either direction) cannot
   * meaningfully describe reply behaviour. Set 0 to keep
   * everything.
   */
  minTotalMessages?: number;
  /**
   * Optional split dimension. Default 'all' = single global
   * distribution. 'source' / 'kind' emits one distribution per
   * group, sharing the same bin ladder so they are directly
   * comparable.
   */
  by?: ReplyRatioDimension;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ReplyRatioBin {
  /** Inclusive lower bound (the previous edge, or 0 for the first bin). */
  lowerRatio: number;
  /** Inclusive upper bound, or `null` for the open-ended final bin. */
  upperRatio: number | null;
  /** Human-readable label, e.g. '≤0.5' / '0.5-1' / '>20'. */
  label: string;
  count: number;
  /** count / totalSessions in the owning distribution. 0 when empty. */
  share: number;
  /**
   * Cumulative share of sessions in this bin and all earlier
   * (lower-ratio) bins. Empirical CDF evaluated at the bin's upper
   * edge (or 1.0 for the open-ended final bin). 0 when empty.
   */
  cumulativeShare: number;
  /** Median ratio of the sessions in this bin. 0 if bin empty. */
  medianRatio: number;
  /** Mean ratio of the sessions in this bin. 0 if bin empty. */
  meanRatio: number;
}

export interface ReplyRatioDistribution {
  /** Group key. 'all' for the global distribution. */
  group: string;
  totalSessions: number;
  /** Mean of `assistant_messages / user_messages` across sessions. 0 when empty. */
  meanRatio: number;
  /** Quantile waypoints via nearest-rank. 0 when empty. */
  p50Ratio: number;
  p90Ratio: number;
  p95Ratio: number;
  p99Ratio: number;
  maxRatio: number;
  /** Bins in ascending order. */
  bins: ReplyRatioBin[];
  /** Index into `bins[]` of the modal bin. -1 when empty. */
  modalBinIndex: number;
}

export interface ReplyRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: ReplyRatioDimension;
  /** Resolved upper-edges actually used. */
  edges: number[];
  minTotalMessages: number;
  /** Sessions matched by window+min-messages but with user_messages == 0. */
  droppedZeroUserMessages: number;
  /** Sessions matched by window but dropped by the min-messages floor. */
  droppedMinMessages: number;
  /** Sessions actually included in the distributions. */
  consideredSessions: number;
  /**
   * One distribution row per group. When `by == 'all'`, length 1
   * with group `'all'`. Otherwise sorted by totalSessions desc,
   * group asc.
   */
  distributions: ReplyRatioDistribution[];
}

function pickGroup(s: SessionLine, by: ReplyRatioDimension): string {
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

function formatRatio(r: number): string {
  if (r === 0) return '0';
  if (Number.isInteger(r)) return String(r);
  // 2 sig figs is enough — these are bin labels.
  return r.toFixed(r < 1 ? 2 : 1);
}

function makeBinLabels(edges: number[]): string[] {
  const labels: string[] = [];
  for (let i = 0; i < edges.length; i++) {
    if (i === 0) {
      labels.push(`≤${formatRatio(edges[0]!)}`);
    } else {
      labels.push(`${formatRatio(edges[i - 1]!)}-${formatRatio(edges[i]!)}`);
    }
  }
  labels.push(`>${formatRatio(edges[edges.length - 1]!)}`);
  return labels;
}

function binFor(edges: number[], ratio: number): number {
  for (let i = 0; i < edges.length; i++) {
    if (ratio <= edges[i]!) return i;
  }
  return edges.length;
}

function buildDistribution(
  group: string,
  ratios: number[],
  edges: number[],
  labels: string[],
): ReplyRatioDistribution {
  const totalSessions = ratios.length;
  if (totalSessions === 0) {
    const bins: ReplyRatioBin[] = labels.map((label, i) => ({
      lowerRatio: i === 0 ? 0 : edges[i - 1]!,
      upperRatio: i < edges.length ? edges[i]! : null,
      label,
      count: 0,
      share: 0,
      cumulativeShare: 0,
      medianRatio: 0,
      meanRatio: 0,
    }));
    return {
      group,
      totalSessions: 0,
      meanRatio: 0,
      p50Ratio: 0,
      p90Ratio: 0,
      p95Ratio: 0,
      p99Ratio: 0,
      maxRatio: 0,
      bins,
      modalBinIndex: -1,
    };
  }

  const sortedAsc = [...ratios].sort((a, b) => a - b);
  const sum = sortedAsc.reduce((a, b) => a + b, 0);
  const meanRatio = sum / totalSessions;

  const perBin: number[][] = labels.map(() => []);
  for (const r of ratios) perBin[binFor(edges, r)]!.push(r);

  const bins: ReplyRatioBin[] = labels.map((label, i) => {
    const xs = perBin[i]!;
    const sortedBin = [...xs].sort((a, b) => a - b);
    const binSum = sortedBin.reduce((a, b) => a + b, 0);
    return {
      lowerRatio: i === 0 ? 0 : edges[i - 1]!,
      upperRatio: i < edges.length ? edges[i]! : null,
      label,
      count: sortedBin.length,
      share: sortedBin.length / totalSessions,
      cumulativeShare: 0,
      medianRatio: sortedBin.length === 0 ? 0 : nearestRank(sortedBin, 0.5),
      meanRatio: sortedBin.length === 0 ? 0 : binSum / sortedBin.length,
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
      const aUp = a.upperRatio === null ? Number.POSITIVE_INFINITY : a.upperRatio;
      const bUp = b.upperRatio === null ? Number.POSITIVE_INFINITY : b.upperRatio;
      if (bUp < aUp) modalBinIndex = i;
    }
  }

  return {
    group,
    totalSessions,
    meanRatio,
    p50Ratio: nearestRank(sortedAsc, 0.5),
    p90Ratio: nearestRank(sortedAsc, 0.9),
    p95Ratio: nearestRank(sortedAsc, 0.95),
    p99Ratio: nearestRank(sortedAsc, 0.99),
    maxRatio: sortedAsc[sortedAsc.length - 1]!,
    bins,
    modalBinIndex,
  };
}

export function buildReplyRatio(
  sessions: SessionLine[],
  opts: ReplyRatioOptions = {},
): ReplyRatioReport {
  const by: ReplyRatioDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source' && by !== 'kind') {
    throw new Error(`by must be 'all' | 'source' | 'kind' (got ${String(opts.by)})`);
  }

  const minTotalMessages = opts.minTotalMessages ?? 2;
  if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
    throw new Error(`minTotalMessages must be a non-negative finite number (got ${opts.minTotalMessages})`);
  }

  const edges = opts.edges ?? DEFAULT_RATIO_EDGES;
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error('edges must be a non-empty array');
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!Number.isFinite(e) || e <= 0) {
      throw new Error(`edges[${i}] must be a positive finite number (got ${e})`);
    }
    if (i > 0 && e <= edges[i - 1]!) {
      throw new Error(`edges must be strictly ascending (edges[${i}] = ${e} <= edges[${i - 1}] = ${edges[i - 1]})`);
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
  let droppedMinMessages = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    const um = Number(s.user_messages);
    const am = Number(s.assistant_messages);
    const tm = Number(s.total_messages);
    if (!Number.isFinite(um) || !Number.isFinite(am) || !Number.isFinite(tm)) continue;
    if (um < 0 || am < 0 || tm < 0) continue;

    if (tm < minTotalMessages) {
      droppedMinMessages += 1;
      continue;
    }
    if (um === 0) {
      droppedZeroUserMessages += 1;
      continue;
    }

    const ratio = am / um;
    consideredSessions += 1;
    const g = pickGroup(s, by);
    let arr = buckets.get(g);
    if (!arr) {
      arr = [];
      buckets.set(g, arr);
    }
    arr.push(ratio);
  }

  const distributions: ReplyRatioDistribution[] = [];
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
    minTotalMessages,
    droppedZeroUserMessages,
    droppedMinMessages,
    consideredSessions,
    distributions,
  };
}
