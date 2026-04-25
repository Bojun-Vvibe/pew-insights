/**
 * source-pair-cooccurrence: which CLI tools share the same active
 * `hour_start` bucket?
 *
 * For each `hour_start` bucket present in the queue we collect the
 * **set of distinct sources** that posted any positive `total_tokens`
 * in that bucket. For every **unordered** pair `{A, B}` of distinct
 * sources that both appear in the same bucket we increment the pair's
 * co-occurrence count. The output is the top pairs by raw count, plus
 * a Jaccard similarity (`buckets(A) ∩ buckets(B)` / `buckets(A) ∪
 * buckets(B)`) and a per-pair share of total co-occurrence pairs.
 *
 * Why a separate subcommand:
 *
 *   - `cohabitation` is a **model-level** lens (which model versions
 *     run together) and only emits one figure per pair.
 *   - `inter-source-handoff-latency` is **sequential** — it asks
 *     "did the primary source change between adjacent buckets?" and
 *     ignores buckets where two sources are concurrently active.
 *   - `bucket-handoff-frequency` is also a sequential / model-level
 *     transition lens.
 *   - `source-breadth-per-day` is a daily aggregate of distinct
 *     source counts; it does not surface *which* tools tend to be
 *     paired up in the same hour.
 *
 * Headline question: "when I'm running multiple CLI tools at once,
 * which combinations are real (e.g. claude-code + opencode in the
 * same hour) vs which never happen (e.g. claude-code + hermes)?"
 *
 * What we emit:
 *
 *   - `activeBuckets`: distinct active `hour_start` values surviving
 *     filters and source-set construction.
 *   - `multiSourceBuckets`: subset of `activeBuckets` whose source
 *     set has size >= 2.
 *   - `cooccurrenceShare`: `multiSourceBuckets / activeBuckets` in
 *     [0, 1] (0 when no buckets).
 *   - `totalPairs`: sum over all multi-source buckets of `C(k, 2)`
 *     where `k = |sources in bucket|`. Equals the total weight
 *     contributed across all pair rows pre-filter.
 *   - `distinctPairs`: number of distinct unordered `{A, B}` pairs
 *     observed at least once.
 *   - `dominantPair`: the unordered pair with the largest count
 *     (ties broken on Jaccard desc, then `a` asc, then `b` asc;
 *     null if no pairs).
 *   - `pairs[]`: rows `{a, b, count, jaccard, share}`, sorted by
 *     count desc, then jaccard desc, then `a` asc, then `b` asc;
 *     capped at `topPairs` (default 10).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface SourcePairCooccurrenceOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Cap the number of `pairs[]` rows emitted after sort. Suppressed
   * rows surface as `droppedBelowTopCap`. Default 10. Use 0 to suppress
   * the table entirely (still echoes `topPairs: 0`).
   */
  topPairs?: number;
  /**
   * Drop pair rows whose `count < minCount` from `pairs[]`. Display
   * filter only — `totalPairs`, `distinctPairs`, `cooccurrenceShare`
   * still reflect the full pre-filter population. Suppressed rows
   * surface as `droppedBelowMinCount`. Default 1 = keep every pair.
   * Applied before `topPairs`.
   */
  minCount?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourcePairCooccurrenceRow {
  a: string;
  b: string;
  /** Number of buckets in which both `a` and `b` are active. */
  count: number;
  /** |buckets(a) ∩ buckets(b)| / |buckets(a) ∪ buckets(b)| in [0, 1]. */
  jaccard: number;
  /** count / totalPairs in [0, 1]; 0 if totalPairs == 0. */
  share: number;
}

export interface SourcePairCooccurrenceReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved `topPairs` cap. */
  topPairs: number;
  /** Echo of the resolved `minCount` floor. */
  minCount: number;
  /** Distinct active hour-buckets surviving filters. */
  activeBuckets: number;
  /** Subset of `activeBuckets` with >= 2 distinct sources active. */
  multiSourceBuckets: number;
  /** multiSourceBuckets / activeBuckets in [0, 1]; 0 if no buckets. */
  cooccurrenceShare: number;
  /** Sum of C(k,2) over multi-source buckets (raw co-occurrence weight). */
  totalPairs: number;
  /** Number of distinct unordered pairs observed at least once. */
  distinctPairs: number;
  /** Most-frequent pair (null if no pairs). */
  dominantPair: { a: string; b: string; count: number } | null;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows whose source field was empty/missing. */
  droppedEmptySource: number;
  /** Rows trimmed by the `topPairs` cap. */
  droppedBelowTopCap: number;
  /** Rows hidden by the `minCount` floor (applied before the top cap). */
  droppedBelowMinCount: number;
  /** Top unordered source pairs. */
  pairs: SourcePairCooccurrenceRow[];
}

export function buildSourcePairCooccurrence(
  queue: QueueLine[],
  opts: SourcePairCooccurrenceOptions = {},
): SourcePairCooccurrenceReport {
  const topPairs = opts.topPairs ?? 10;
  if (!Number.isInteger(topPairs) || topPairs < 0) {
    throw new Error(
      `topPairs must be a non-negative integer (got ${opts.topPairs})`,
    );
  }
  const minCount = opts.minCount ?? 1;
  if (!Number.isInteger(minCount) || minCount < 1) {
    throw new Error(
      `minCount must be a positive integer (got ${opts.minCount})`,
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

  // bucket ms -> Set<source>
  const buckets = new Map<number, Set<string>>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedEmptySource = 0;

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
    if (source === '') {
      droppedEmptySource += 1;
      continue;
    }

    let set = buckets.get(ms);
    if (!set) {
      set = new Set<string>();
      buckets.set(ms, set);
    }
    set.add(source);
  }

  const activeBuckets = buckets.size;

  // Per-source bucket count (for Jaccard denom).
  const perSourceBuckets = new Map<string, number>();
  for (const set of buckets.values()) {
    for (const s of set) {
      perSourceBuckets.set(s, (perSourceBuckets.get(s) ?? 0) + 1);
    }
  }

  // Per-pair co-occurrence count.
  // Key: 'a\x1fb' with a < b lex.
  const pairCounts = new Map<string, { a: string; b: string; count: number }>();
  let multiSourceBuckets = 0;
  let totalPairs = 0;

  for (const set of buckets.values()) {
    if (set.size < 2) continue;
    multiSourceBuckets += 1;
    const sorted = [...set].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        totalPairs += 1;
        const key = a + '\x1f' + b;
        const cell = pairCounts.get(key);
        if (cell) cell.count += 1;
        else pairCounts.set(key, { a, b, count: 1 });
      }
    }
  }

  const distinctPairs = pairCounts.size;
  const cooccurrenceShare =
    activeBuckets > 0 ? multiSourceBuckets / activeBuckets : 0;

  // Build rows with Jaccard + share.
  const allRows: SourcePairCooccurrenceRow[] = [];
  for (const cell of pairCounts.values()) {
    const ba = perSourceBuckets.get(cell.a) ?? 0;
    const bb = perSourceBuckets.get(cell.b) ?? 0;
    // |A ∪ B| = |A| + |B| - |A ∩ B|. count = |A ∩ B|.
    const union = ba + bb - cell.count;
    const jaccard = union > 0 ? cell.count / union : 0;
    const share = totalPairs > 0 ? cell.count / totalPairs : 0;
    allRows.push({ a: cell.a, b: cell.b, count: cell.count, jaccard, share });
  }

  // Sort: count desc, jaccard desc, a asc, b asc.
  allRows.sort((x, y) => {
    if (y.count !== x.count) return y.count - x.count;
    if (y.jaccard !== x.jaccard) return y.jaccard - x.jaccard;
    if (x.a !== y.a) return x.a < y.a ? -1 : 1;
    return x.b < y.b ? -1 : x.b > y.b ? 1 : 0;
  });

  // Dominant pair = first row of the unfiltered sorted list (or null).
  const dominantPair =
    allRows.length > 0
      ? { a: allRows[0]!.a, b: allRows[0]!.b, count: allRows[0]!.count }
      : null;

  let pairs = allRows;
  let droppedBelowMinCount = 0;
  let droppedBelowTopCap = 0;
  if (minCount > 1) {
    const survivors = pairs.filter((p) => p.count >= minCount);
    droppedBelowMinCount = pairs.length - survivors.length;
    pairs = survivors;
  }
  if (pairs.length > topPairs) {
    droppedBelowTopCap = pairs.length - topPairs;
    pairs = pairs.slice(0, topPairs);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    topPairs,
    minCount,
    activeBuckets,
    multiSourceBuckets,
    cooccurrenceShare,
    totalPairs,
    distinctPairs,
    dominantPair,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedEmptySource,
    droppedBelowTopCap,
    droppedBelowMinCount,
    pairs,
  };
}
