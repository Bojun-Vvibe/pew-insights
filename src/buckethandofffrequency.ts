/**
 * bucket-handoff-frequency: how often does the *primary model* of an
 * active hour-bucket change relative to the previous active bucket
 * in time order?
 *
 * For each `hour_start` bucket present in the queue we compute the
 * bucket's **primary model** = the normalised `model` value with the
 * highest `total_tokens` sum inside that bucket. Ties are broken
 * lexicographically on the model name (deterministic). Then we walk
 * the active buckets in `hour_start` ascending order and count, for
 * each adjacent pair `(prev, next)`, whether `prev.primary !=
 * next.primary` — that's a **handoff**. We also count whether the
 * pair is **contiguous** (`next` is exactly one hour after `prev`)
 * vs **gapped** (anything else), so the operator can separate
 * "live model swap inside a working session" from "I came back the
 * next morning on a different model".
 *
 * Why a separate subcommand:
 *
 *   - `model-switching` measures intra-session model swaps inside
 *     a single `session_key` — it never crosses bucket boundaries
 *     or session boundaries.
 *   - `transitions` measures session-to-session adjacency by
 *     `source` / `kind` / `project_ref` — model identity is not
 *     part of its key.
 *   - `model-mix-entropy` reports a global Shannon mix across
 *     buckets but says nothing about *order* — two corpora with
 *     identical entropy can have very different handoff cadences.
 *   - `agent-mix` and `provider-share` are pure mass tallies with
 *     no time axis at all.
 *
 * Headline question: "across my active hours, how often does the
 * model I'm primarily using change from one hour to the next, and
 * what are the most common handoff pairs (e.g. does opus -> sonnet
 * dominate, or is it noise on top of long sticky runs)?"
 *
 * What we emit:
 *
 *   - `activeBuckets`: distinct active `hour_start` values surviving
 *     filters.
 *   - `consideredPairs`: `activeBuckets - 1` (0 if `activeBuckets
 *     <= 1`).
 *   - `handoffPairs`: pairs whose primary model changed.
 *   - `handoffShare`: `handoffPairs / consideredPairs` in [0, 1]
 *     (0 when no pairs).
 *   - `contiguousPairs` / `gappedPairs`: split of `consideredPairs`
 *     by whether the gap is exactly one hour. `contiguousHandoffs`
 *     / `gappedHandoffs` further split `handoffPairs`.
 *   - `topHandoffs`: directed `(from -> to)` pair counts, sorted
 *     by count desc, then `from` asc, then `to` asc; capped at
 *     `topHandoffs` (default 10).
 *   - `stickiestModel`: the model that appears as `primary` in the
 *     most buckets; ties broken by total tokens desc, then name asc.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface BucketHandoffFrequencyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Cap the number of `topHandoffs` rows emitted after sort. Suppressed
   * rows surface as `droppedBelowTopCap`. Default 10. Use 0 to suppress
   * the table entirely (still echoes `topHandoffs: 0`).
   */
  topHandoffs?: number;
  /**
   * Drop `(from -> to)` pair rows whose `count < minHandoffs` from
   * `pairs[]`. Display filter only — `handoffPairs`, `handoffShare`,
   * and the contiguous/gapped totals still reflect the full
   * pre-filter population. Suppressed rows surface as
   * `droppedBelowMinHandoffs`. Default 1 = keep every pair.
   * Applied *before* `topHandoffs`.
   */
  minHandoffs?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface BucketHandoffPair {
  from: string;
  to: string;
  count: number;
}

export interface BucketHandoffFrequencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `topHandoffs` cap. */
  topHandoffs: number;
  /** Echo of the resolved `minHandoffs` floor. */
  minHandoffs: number;
  /** Distinct active hour-buckets surviving filters. */
  activeBuckets: number;
  /** activeBuckets - 1 (0 if activeBuckets <= 1). */
  consideredPairs: number;
  /** Pairs whose primary model changed. */
  handoffPairs: number;
  /** handoffPairs / consideredPairs, in [0, 1]; 0 if no pairs. */
  handoffShare: number;
  /** Pairs whose gap is exactly one hour. */
  contiguousPairs: number;
  /** Pairs whose gap is > one hour. */
  gappedPairs: number;
  /** Subset of `handoffPairs` that are contiguous. */
  contiguousHandoffs: number;
  /** Subset of `handoffPairs` that are gapped. */
  gappedHandoffs: number;
  /** Most-frequent primary model across active buckets (null if no buckets). */
  stickiestModel: string | null;
  /** Bucket-count for `stickiestModel`. */
  stickiestModelBuckets: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Buckets whose only contribution was an empty/missing model name. */
  droppedEmptyModelBuckets: number;
  /** Handoff rows trimmed by the `topHandoffs` cap. */
  droppedBelowTopCap: number;
  /** Handoff rows hidden by the `minHandoffs` floor (applied before the top cap). */
  droppedBelowMinHandoffs: number;
  /** Top directed (from -> to) primary-model handoffs. */
  pairs: BucketHandoffPair[];
}

const HOUR_MS = 3_600_000;

export function buildBucketHandoffFrequency(
  queue: QueueLine[],
  opts: BucketHandoffFrequencyOptions = {},
): BucketHandoffFrequencyReport {
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

  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // bucket ms -> { iso, model -> tokens }
  const buckets = new Map<number, { iso: string; models: Map<string, number> }>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;

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

    if (sourceFilter !== null) {
      const src = typeof q.source === 'string' ? q.source : '';
      if (src !== sourceFilter) {
        droppedSourceFilter += 1;
        continue;
      }
    }

    const model = typeof q.model === 'string' ? q.model : '';

    let cell = buckets.get(ms);
    if (!cell) {
      cell = { iso: q.hour_start, models: new Map<string, number>() };
      buckets.set(ms, cell);
    }
    cell.models.set(model, (cell.models.get(model) ?? 0) + tt);
  }

  // Compute primary model per bucket; drop buckets whose only model
  // contribution was the empty string.
  interface PrimaryRow {
    ms: number;
    iso: string;
    model: string;
    tokens: number; // tokens for the primary model in that bucket
  }
  const primaries: PrimaryRow[] = [];
  let droppedEmptyModelBuckets = 0;
  for (const [ms, cell] of buckets.entries()) {
    // Pick model with highest tokens; break ties on model name asc.
    let bestModel: string | null = null;
    let bestTokens = -Infinity;
    const sortedModels = [...cell.models.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    for (const [model, tokens] of sortedModels) {
      if (model === '') continue;
      if (tokens > bestTokens) {
        bestTokens = tokens;
        bestModel = model;
      }
    }
    if (bestModel === null) {
      droppedEmptyModelBuckets += 1;
      continue;
    }
    primaries.push({ ms, iso: cell.iso, model: bestModel, tokens: bestTokens });
  }

  primaries.sort((a, b) => a.ms - b.ms);

  const activeBuckets = primaries.length;

  // Walk consecutive pairs.
  let handoffPairs = 0;
  let contiguousPairs = 0;
  let gappedPairs = 0;
  let contiguousHandoffs = 0;
  let gappedHandoffs = 0;
  const handoffCounts = new Map<string, BucketHandoffPair>();

  for (let i = 1; i < primaries.length; i += 1) {
    const prev = primaries[i - 1]!;
    const next = primaries[i]!;
    const gapMs = next.ms - prev.ms;
    const isContiguous = gapMs === HOUR_MS;
    if (isContiguous) contiguousPairs += 1;
    else gappedPairs += 1;
    if (prev.model !== next.model) {
      handoffPairs += 1;
      if (isContiguous) contiguousHandoffs += 1;
      else gappedHandoffs += 1;
      const key = prev.model + '\x1f' + next.model;
      const cell = handoffCounts.get(key);
      if (cell) {
        cell.count += 1;
      } else {
        handoffCounts.set(key, { from: prev.model, to: next.model, count: 1 });
      }
    }
  }

  const consideredPairs = activeBuckets > 0 ? activeBuckets - 1 : 0;
  const handoffShare = consideredPairs > 0 ? handoffPairs / consideredPairs : 0;

  // Stickiest model: most buckets, ties on total tokens desc, then
  // model name asc.
  const perModel = new Map<string, { buckets: number; tokens: number }>();
  for (const p of primaries) {
    const cell = perModel.get(p.model);
    if (cell) {
      cell.buckets += 1;
      cell.tokens += p.tokens;
    } else {
      perModel.set(p.model, { buckets: 1, tokens: p.tokens });
    }
  }
  let stickiestModel: string | null = null;
  let stickiestModelBuckets = 0;
  let stickiestTokens = -Infinity;
  const modelKeys = [...perModel.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  for (const m of modelKeys) {
    const cell = perModel.get(m)!;
    if (
      cell.buckets > stickiestModelBuckets ||
      (cell.buckets === stickiestModelBuckets && cell.tokens > stickiestTokens)
    ) {
      stickiestModel = m;
      stickiestModelBuckets = cell.buckets;
      stickiestTokens = cell.tokens;
    }
  }

  // Sort handoff pairs by count desc, then from asc, then to asc.
  const sortedPairs = [...handoffCounts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let droppedBelowMinHandoffs = 0;
  let pairs = sortedPairs;
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
    source: sourceFilter,
    topHandoffs,
    minHandoffs,
    activeBuckets,
    consideredPairs,
    handoffPairs,
    handoffShare,
    contiguousPairs,
    gappedPairs,
    contiguousHandoffs,
    gappedHandoffs,
    stickiestModel,
    stickiestModelBuckets,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedEmptyModelBuckets,
    droppedBelowTopCap,
    droppedBelowMinHandoffs,
    pairs,
  };
}
