/**
 * inter-source-handoff-latency: how much wall-clock time passes between
 * consecutive *different-source* active hour-buckets?
 *
 * For each `hour_start` bucket present in the queue we compute the
 * bucket's **primary source** = the `source` value with the highest
 * `total_tokens` sum inside that bucket. Ties are broken
 * lexicographically on the source name (deterministic). Then we walk
 * the active buckets in `hour_start` ascending order; whenever an
 * adjacent pair `(prev, next)` has `prev.primary != next.primary`,
 * we record the **handoff latency** = `(next.ms - prev.ms) / 3_600_000`
 * hours.
 *
 * Why a separate subcommand:
 *
 *   - `bucket-handoff-frequency` measures how *often* the primary
 *     **model** changes between adjacent active buckets, but says
 *     nothing about *how long apart* those handoffs happen and works
 *     at model-level not source-level.
 *   - `provider-switching-frequency` is also a *count* lens, scoped
 *     to provider (anthropic / openai / ...), and does not measure
 *     time-between-handoffs.
 *   - `interarrival` is a *raw bucket-to-bucket* distance lens — it
 *     does not condition on the primary source changing.
 *   - `idle-gaps` is a generic "long quiet stretch" lens regardless
 *     of what tool was running on either side of the gap.
 *
 * Headline question: "when I switch from one CLI tool to another, how
 * long does the swap take? Are tool handoffs back-to-back live swaps,
 * or do they almost always cross an overnight gap?"
 *
 * What we emit:
 *
 *   - `activeBuckets`: distinct active `hour_start` values surviving
 *     filters.
 *   - `consideredPairs`: `activeBuckets - 1` (0 if `activeBuckets <= 1`).
 *   - `handoffPairs`: pairs whose primary source changed.
 *   - `handoffShare`: `handoffPairs / consideredPairs` in [0, 1] (0
 *     when no pairs).
 *   - `medianLatencyHours` / `meanLatencyHours` / `minLatencyHours`
 *     / `maxLatencyHours`: stats over the latency distribution
 *     (hours). All null when `handoffPairs == 0`.
 *   - `contiguousHandoffs`: handoff pairs whose latency is exactly
 *     1 hour ("live swap, no idle gap"). `gappedHandoffs` is the
 *     complement.
 *   - `topHandoffs`: directed `(from -> to)` source-pair counts with
 *     median latency for that pair, sorted by count desc, then
 *     median latency asc, then `from` asc, then `to` asc; capped
 *     at `topHandoffs` (default 10).
 *   - `dominantSource`: the source that appears as `primary` in the
 *     most buckets; ties broken by total tokens desc, then name asc.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface InterSourceHandoffLatencyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Cap the number of `pairs[]` rows emitted after sort. Suppressed
   * rows surface as `droppedBelowTopCap`. Default 10. Use 0 to suppress
   * the table entirely (still echoes `topHandoffs: 0`).
   */
  topHandoffs?: number;
  /**
   * Drop `(from -> to)` rows whose `count < minHandoffs` from
   * `pairs[]`. Display filter only — `handoffPairs`, `handoffShare`,
   * and the latency stats still reflect the full pre-filter
   * population. Suppressed rows surface as `droppedBelowMinHandoffs`.
   * Default 1 = keep every pair. Applied before `topHandoffs`.
   */
  minHandoffs?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface InterSourceHandoffPair {
  from: string;
  to: string;
  count: number;
  /** Median latency for this directed pair, in hours. */
  medianLatencyHours: number;
  /** Min latency for this directed pair, in hours. */
  minLatencyHours: number;
  /** Max latency for this directed pair, in hours. */
  maxLatencyHours: number;
}

export interface InterSourceHandoffLatencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved `topHandoffs` cap. */
  topHandoffs: number;
  /** Echo of the resolved `minHandoffs` floor. */
  minHandoffs: number;
  /** Distinct active hour-buckets surviving filters. */
  activeBuckets: number;
  /** activeBuckets - 1 (0 if activeBuckets <= 1). */
  consideredPairs: number;
  /** Pairs whose primary source changed. */
  handoffPairs: number;
  /** handoffPairs / consideredPairs, in [0, 1]; 0 if no pairs. */
  handoffShare: number;
  /** Median latency across all handoff pairs, in hours. null if no handoffs. */
  medianLatencyHours: number | null;
  /** Mean latency across all handoff pairs, in hours. null if no handoffs. */
  meanLatencyHours: number | null;
  /** Min latency across all handoff pairs, in hours. null if no handoffs. */
  minLatencyHours: number | null;
  /** Max latency across all handoff pairs, in hours. null if no handoffs. */
  maxLatencyHours: number | null;
  /** Subset of `handoffPairs` whose latency is exactly 1 hour. */
  contiguousHandoffs: number;
  /** Subset of `handoffPairs` whose latency is > 1 hour. */
  gappedHandoffs: number;
  /** Most-frequent primary source across active buckets (null if no buckets). */
  dominantSource: string | null;
  /** Bucket-count for `dominantSource`. */
  dominantSourceBuckets: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Buckets whose only contribution was an empty/missing source name. */
  droppedEmptySourceBuckets: number;
  /** Rows trimmed by the `topHandoffs` cap. */
  droppedBelowTopCap: number;
  /** Rows hidden by the `minHandoffs` floor (applied before the top cap). */
  droppedBelowMinHandoffs: number;
  /** Top directed (from -> to) primary-source handoffs. */
  pairs: InterSourceHandoffPair[];
}

const HOUR_MS = 3_600_000;

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildInterSourceHandoffLatency(
  queue: QueueLine[],
  opts: InterSourceHandoffLatencyOptions = {},
): InterSourceHandoffLatencyReport {
  const topHandoffs = opts.topHandoffs ?? 10;
  if (!Number.isInteger(topHandoffs) || topHandoffs < 0) {
    throw new Error(
      `topHandoffs must be a non-negative integer (got ${opts.topHandoffs})`,
    );
  }
  const minHandoffs = opts.minHandoffs ?? 1;
  if (!Number.isInteger(minHandoffs) || minHandoffs < 1) {
    throw new Error(
      `minHandoffs must be a positive integer (got ${opts.minHandoffs})`,
    );
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

  // bucket ms -> { iso, source -> tokens }
  const buckets = new Map<number, { iso: string; sources: Map<string, number> }>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedZeroTokens += 1;
      continue;
    }

    const source = typeof q.source === 'string' ? q.source : '';

    let cell = buckets.get(ms);
    if (!cell) {
      cell = { iso: q.hour_start, sources: new Map<string, number>() };
      buckets.set(ms, cell);
    }
    cell.sources.set(source, (cell.sources.get(source) ?? 0) + tt);
  }

  // Compute primary source per bucket; drop buckets whose only source
  // contribution was the empty string.
  interface PrimaryRow {
    ms: number;
    iso: string;
    source: string;
    tokens: number;
  }
  const primaries: PrimaryRow[] = [];
  let droppedEmptySourceBuckets = 0;
  for (const [ms, cell] of buckets.entries()) {
    let bestSource: string | null = null;
    let bestTokens = -Infinity;
    const sortedSources = [...cell.sources.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    for (const [source, tokens] of sortedSources) {
      if (source === '') continue;
      if (tokens > bestTokens) {
        bestTokens = tokens;
        bestSource = source;
      }
    }
    if (bestSource === null) {
      droppedEmptySourceBuckets += 1;
      continue;
    }
    primaries.push({ ms, iso: cell.iso, source: bestSource, tokens: bestTokens });
  }

  primaries.sort((a, b) => a.ms - b.ms);

  const activeBuckets = primaries.length;

  // Walk consecutive pairs.
  let handoffPairs = 0;
  let contiguousHandoffs = 0;
  let gappedHandoffs = 0;
  const allLatencies: number[] = [];
  const pairLatencies = new Map<string, { from: string; to: string; lats: number[] }>();

  for (let i = 1; i < primaries.length; i += 1) {
    const prev = primaries[i - 1]!;
    const next = primaries[i]!;
    if (prev.source === next.source) continue;
    const gapMs = next.ms - prev.ms;
    const gapHours = gapMs / HOUR_MS;
    handoffPairs += 1;
    if (gapMs === HOUR_MS) contiguousHandoffs += 1;
    else gappedHandoffs += 1;
    allLatencies.push(gapHours);
    const key = prev.source + '\x1f' + next.source;
    const cell = pairLatencies.get(key);
    if (cell) {
      cell.lats.push(gapHours);
    } else {
      pairLatencies.set(key, { from: prev.source, to: next.source, lats: [gapHours] });
    }
  }

  const consideredPairs = activeBuckets > 0 ? activeBuckets - 1 : 0;
  const handoffShare = consideredPairs > 0 ? handoffPairs / consideredPairs : 0;

  let medianLatencyHours: number | null = null;
  let meanLatencyHours: number | null = null;
  let minLatencyHours: number | null = null;
  let maxLatencyHours: number | null = null;
  if (allLatencies.length > 0) {
    const sorted = [...allLatencies].sort((a, b) => a - b);
    medianLatencyHours = median(sorted);
    meanLatencyHours =
      allLatencies.reduce((s, x) => s + x, 0) / allLatencies.length;
    minLatencyHours = sorted[0]!;
    maxLatencyHours = sorted[sorted.length - 1]!;
  }

  // Dominant source: most buckets, ties on total tokens desc, then name asc.
  const perSource = new Map<string, { buckets: number; tokens: number }>();
  for (const p of primaries) {
    const cell = perSource.get(p.source);
    if (cell) {
      cell.buckets += 1;
      cell.tokens += p.tokens;
    } else {
      perSource.set(p.source, { buckets: 1, tokens: p.tokens });
    }
  }
  let dominantSource: string | null = null;
  let dominantSourceBuckets = 0;
  let dominantTokens = -Infinity;
  const sourceKeys = [...perSource.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const s of sourceKeys) {
    const cell = perSource.get(s)!;
    if (
      cell.buckets > dominantSourceBuckets ||
      (cell.buckets === dominantSourceBuckets && cell.tokens > dominantTokens)
    ) {
      dominantSource = s;
      dominantSourceBuckets = cell.buckets;
      dominantTokens = cell.tokens;
    }
  }

  // Build pair rows with per-pair stats.
  const pairRows: InterSourceHandoffPair[] = [];
  for (const cell of pairLatencies.values()) {
    const sortedLats = [...cell.lats].sort((a, b) => a - b);
    pairRows.push({
      from: cell.from,
      to: cell.to,
      count: cell.lats.length,
      medianLatencyHours: median(sortedLats),
      minLatencyHours: sortedLats[0]!,
      maxLatencyHours: sortedLats[sortedLats.length - 1]!,
    });
  }

  // Sort: count desc, median latency asc (faster swaps first within tie),
  // then from asc, then to asc.
  pairRows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.medianLatencyHours !== b.medianLatencyHours)
      return a.medianLatencyHours - b.medianLatencyHours;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinHandoffs = 0;
  let pairs = pairRows;
  if (minHandoffs > 1) {
    const survivors = pairs.filter((p) => p.count >= minHandoffs);
    droppedBelowMinHandoffs = pairs.length - survivors.length;
    pairs = survivors;
  }
  if (pairs.length > topHandoffs) {
    droppedBelowTopCap = pairs.length - topHandoffs;
    pairs = pairs.slice(0, topHandoffs);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    topHandoffs,
    minHandoffs,
    activeBuckets,
    consideredPairs,
    handoffPairs,
    handoffShare,
    medianLatencyHours,
    meanLatencyHours,
    minLatencyHours,
    maxLatencyHours,
    contiguousHandoffs,
    gappedHandoffs,
    dominantSource,
    dominantSourceBuckets,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedEmptySourceBuckets,
    droppedBelowTopCap,
    droppedBelowMinHandoffs,
    pairs,
  };
}
