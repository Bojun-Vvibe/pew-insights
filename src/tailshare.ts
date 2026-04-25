/**
 * tail-share: Pareto-style concentration of token mass per source.
 *
 * For each source, we collect every (hour_start) bucket that produced
 * positive total_tokens, sort buckets by total_tokens descending, then
 * report what fraction of total tokens lives in the top K% of buckets.
 *
 * Default percentiles checked: 1%, 5%, 10%, 20%. Each row reports:
 *
 *   - bucketCount:     total distinct active buckets for this source
 *   - tokens:          sum of total_tokens across all buckets
 *   - top1Share:       fraction of tokens in the heaviest 1% of buckets
 *   - top5Share:       same for 5%
 *   - top10Share:      same for 10%
 *   - top20Share:      same for 20%
 *   - giniLike:        a coarse concentration scalar in [0, 1) — the
 *                      mean of (top1+top5+top10+top20)/4 with the
 *                      uniform-distribution baseline subtracted off.
 *                      0 = perfectly uniform, →1 = all mass in one
 *                      bucket. Cheap, deterministic, no sorting beyond
 *                      what we already pay for the percentiles.
 *
 * Why a separate subcommand:
 *
 *   - `bucket-intensity` reports the *distribution shape* (mean, p50,
 *     p95, max) of per-bucket token magnitudes per source, but never
 *     surfaces "what fraction of total volume lives in the heavy
 *     buckets" — that's the Pareto question this lens answers.
 *   - `peak-hour-share` is about *clock hour* concentration, not
 *     bucket concentration, so a source that's bursty within every
 *     hour looks unconcentrated to it.
 *   - `burstiness` is a coefficient-of-variation lens that conflates
 *     "many small buckets + one big one" with "wildly variable
 *     buckets" — Pareto top-share is the cleaner read on that
 *     specific question.
 *   - `model-mix-entropy` collapses *model* concentration; it has
 *     nothing to say about bucket concentration.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';

export interface TailShareOptions {
  /** Inclusive ISO lower bound on hour_start. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on hour_start. null = no upper bound. */
  until?: string | null;
  /**
   * Drop sources whose bucketCount < this floor. Display-only filter
   * (counts surface as droppedSparseSourceRows / droppedSparseSources).
   * Default 0 = no floor.
   */
  minBuckets?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface TailShareRow {
  source: string;
  bucketCount: number;
  tokens: number;
  top1Share: number;
  top5Share: number;
  top10Share: number;
  top20Share: number;
  giniLike: number;
}

export interface TailShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minBuckets: number;
  /** Sources surviving filters. */
  totalSources: number;
  /** Sum of bucketCount across surviving sources. */
  totalBuckets: number;
  /** Sum of tokens across surviving sources. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  /** Source rows hidden by the minBuckets floor. */
  droppedSparseSources: number;
  /** Underlying buckets across those sparse sources. */
  droppedSparseBuckets: number;
  /** Per-source rows, sorted by giniLike desc, source-name asc tiebreak. */
  sources: TailShareRow[];
}

/**
 * Smallest integer >= ceil(fraction * n), but always >= 1 when n > 0
 * so that "top 1%" of a 12-bucket source still picks at least one
 * bucket. Returns 0 when n == 0.
 */
function topKCount(n: number, fraction: number): number {
  if (n <= 0) return 0;
  return Math.max(1, Math.ceil(n * fraction));
}

function topShare(sortedDesc: number[], totalTokens: number, fraction: number): number {
  if (totalTokens <= 0 || sortedDesc.length === 0) return 0;
  const k = topKCount(sortedDesc.length, fraction);
  let sum = 0;
  for (let i = 0; i < k; i += 1) sum += sortedDesc[i]!;
  return sum / totalTokens;
}

export function buildTailShare(
  queue: QueueLine[],
  opts: TailShareOptions = {},
): TailShareReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(`minBuckets must be a non-negative integer (got ${opts.minBuckets})`);
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

  // Bucket = (source, hour_start) -> sum total_tokens. We sum across
  // models so a single hour with multiple models still counts as one
  // bucket (this is the bucket-level Pareto question, not model-level).
  const perSourceBuckets = new Map<string, Map<string, number>>();
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

    const src = typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    let buckets = perSourceBuckets.get(src);
    if (!buckets) {
      buckets = new Map<string, number>();
      perSourceBuckets.set(src, buckets);
    }
    buckets.set(q.hour_start, (buckets.get(q.hour_start) ?? 0) + tt);
  }

  const all: TailShareRow[] = [];
  for (const [source, buckets] of perSourceBuckets.entries()) {
    const sortedDesc = Array.from(buckets.values()).sort((a, b) => b - a);
    const bucketCount = sortedDesc.length;
    let tokens = 0;
    for (const v of sortedDesc) tokens += v;

    const top1Share = topShare(sortedDesc, tokens, 0.01);
    const top5Share = topShare(sortedDesc, tokens, 0.05);
    const top10Share = topShare(sortedDesc, tokens, 0.1);
    const top20Share = topShare(sortedDesc, tokens, 0.2);

    // Coarse concentration scalar. For a uniform distribution on n
    // buckets with the topKCount() ceiling, the expected mean of the
    // four shares is approximately the average of the four ceil-based
    // fractions. We subtract that baseline so giniLike → 0 for
    // uniform and → close to 1 for "all mass in one bucket".
    const baseline =
      (topKCount(bucketCount, 0.01) +
        topKCount(bucketCount, 0.05) +
        topKCount(bucketCount, 0.1) +
        topKCount(bucketCount, 0.2)) /
      (4 * Math.max(bucketCount, 1));
    const meanShare = (top1Share + top5Share + top10Share + top20Share) / 4;
    const denom = Math.max(1 - baseline, 1e-9);
    const raw = (meanShare - baseline) / denom;
    const giniLike = raw < 0 ? 0 : raw > 1 ? 1 : raw;

    all.push({
      source,
      bucketCount,
      tokens,
      top1Share,
      top5Share,
      top10Share,
      top20Share,
      giniLike,
    });
  }

  // Sparse-source filter
  let droppedSparseSources = 0;
  let droppedSparseBuckets = 0;
  const kept: TailShareRow[] = [];
  for (const row of all) {
    if (minBuckets > 0 && row.bucketCount < minBuckets) {
      droppedSparseSources += 1;
      droppedSparseBuckets += row.bucketCount;
      continue;
    }
    kept.push(row);
  }

  kept.sort((a, b) => {
    const d = b.giniLike - a.giniLike;
    if (d !== 0) return d;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let totalBuckets = 0;
  let totalTokens = 0;
  for (const r of kept) {
    totalBuckets += r.bucketCount;
    totalTokens += r.tokens;
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minBuckets,
    totalSources: kept.length,
    totalBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSparseSources,
    droppedSparseBuckets,
    sources: kept,
  };
}
