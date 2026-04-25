/**
 * source-tenure: per-source active-span lens.
 *
 * The same shape as `model-tenure`, but grouped by `source` (the
 * upstream agent CLI / channel that emitted the row — e.g.
 * `claude-code`, `opencode`, `codex`, etc.) instead of by model.
 *
 * For every source, we look at the set of distinct `hour_start`
 * timestamps in which it produced a positive `total_tokens`
 * observation, then compute:
 *
 *   - firstSeen:    ISO of the earliest active bucket
 *   - lastSeen:     ISO of the latest active bucket
 *   - spanHours:    clock hours from firstSeen to lastSeen (>= 0,
 *                   may be fractional). 0 for a single-bucket source.
 *   - activeBuckets: number of distinct `hour_start` values
 *   - tokens:       sum of total_tokens across all active buckets
 *   - tokensPerActiveBucket: tokens / activeBuckets (mean intensity)
 *   - tokensPerSpanHour:    tokens / max(spanHours, 1) — average
 *                           token throughput per clock hour over the
 *                           full tenure (idle or not).
 *   - distinctModels:       number of distinct normalised models
 *                           seen under this source over its tenure
 *                           (a quick "did this CLI multi-model?"
 *                           signal that is *not* available from
 *                           `model-tenure`'s per-model rows).
 *
 * Why a separate subcommand:
 *
 *   - `model-tenure` is per-model. It can tell you `claude-opus-4.7`
 *     has been around 196h, but it cannot tell you that the
 *     `claude-code` *source* spans 720h aggregating across whatever
 *     model variants flowed through it. Aggregating model-tenure
 *     rows by hand to the source level is wrong because the same
 *     hour_start is double-counted across models — `source-tenure`
 *     reduces on the source axis directly.
 *   - `source-mix` and `provider-share` are mass tallies; they have
 *     no firstSeen / lastSeen / span axis at all.
 *   - `tail-share` reports per-source Pareto/Gini concentration
 *     across buckets — it is about magnitude *distribution*, not
 *     temporal extent.
 *   - `cohabitation`, `interarrival`, `burstiness`, etc. are all
 *     per-model (or per-(model|source)) magnitude/timing stats
 *     and never produce a tenure span on the source axis.
 *
 * `distinctModels` is included specifically because once you are
 * looking at sources, the natural follow-up question is "how many
 * model variants did this CLI route through over its lifetime?",
 * which is cheap to compute alongside the span and answers a
 * question no other report answers.
 *
 * Bucket granularity: same caveat as `model-tenure` — `hour_start`
 * may be hourly or half-hourly depending on what pew emits. We do
 * not assume a fixed width; `activeBuckets` is the count of
 * distinct timestamp strings, `spanHours` is wall-clock first->last.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface SourceTenureOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Drop sources whose `activeBuckets` < `minBuckets` from `sources[]`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 = keep every source. Counts surface as
   * `droppedSparseSources`.
   */
  minBuckets?: number;
  /**
   * Drop sources whose `distinctModels` < `minModels` from
   * `sources[]`. Display filter only — global denominators reflect
   * the full population. Default 0 = keep every source. Counts
   * surface as `droppedNarrowSources`. Useful for isolating the
   * sources that actually multi-route across model variants
   * (e.g. excluding single-model fixed-route channels).
   */
  minModels?: number;
  /**
   * Truncate `sources[]` to the top N after sorting. Display filter
   * only — `totalSources`, `totalActiveBuckets`, `totalTokens`
   * always reflect the full population. Counts surface as
   * `droppedTopSources`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `sources[]`:
   *   - 'span' (default):    spanHours desc (longest tenure first)
   *   - 'active':            activeBuckets desc (most-touched first)
   *   - 'tokens':            tokens desc (highest mass first)
   *   - 'density':           tokensPerSpanHour desc (densest first)
   *   - 'models':            distinctModels desc (broadest router first)
   * Tiebreak in all cases: source key asc (lex).
   */
  sort?: 'span' | 'active' | 'tokens' | 'density' | 'models';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceTenureRow {
  source: string;
  firstSeen: string;
  lastSeen: string;
  /**
   * Clock hours between firstSeen and lastSeen, may be fractional.
   * 0 for a single-bucket source.
   */
  spanHours: number;
  /** Distinct `hour_start` buckets in which this source was active. */
  activeBuckets: number;
  /** Sum of total_tokens across this source's active buckets. */
  tokens: number;
  /** tokens / activeBuckets. */
  tokensPerActiveBucket: number;
  /** tokens / max(spanHours, 1). */
  tokensPerSpanHour: number;
  /** Number of distinct normalised models seen under this source. */
  distinctModels: number;
}

export interface SourceTenureReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  /** Echo of the resolved `minBuckets` floor. */
  minBuckets: number;
  /** Echo of the resolved `minModels` floor. */
  minModels: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved `sort` key. */
  sort: 'span' | 'active' | 'tokens' | 'density' | 'models';
  /** Distinct sources surviving filters (pre top cap). */
  totalSources: number;
  /** Sum of activeBuckets across the *full* population (pre top cap). */
  totalActiveBuckets: number;
  /** Sum of total_tokens across the *full* population (pre top cap). */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `model` filter. */
  droppedModelFilter: number;
  /** Source rows hidden by the `minBuckets` floor. */
  droppedSparseSources: number;
  /** Source rows hidden by the `minModels` floor. */
  droppedNarrowSources: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** Per-source tenure rows after sort + top cap. */
  sources: SourceTenureRow[];
}

const HOUR_MS = 3_600_000;

export function buildSourceTenure(
  queue: QueueLine[],
  opts: SourceTenureOptions = {},
): SourceTenureReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
  }
  const minModels = opts.minModels ?? 0;
  if (!Number.isInteger(minModels) || minModels < 0) {
    throw new Error(
      `minModels must be a non-negative integer (got ${opts.minModels})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'span';
  if (
    sort !== 'span' &&
    sort !== 'active' &&
    sort !== 'tokens' &&
    sort !== 'density' &&
    sort !== 'models'
  ) {
    throw new Error(
      `sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
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

  const modelFilter =
    opts.model != null && opts.model !== '' ? normaliseModel(opts.model) : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Acc {
    hours: Set<string>;
    models: Set<string>;
    firstMs: number;
    lastMs: number;
    tokens: number;
  }
  const perSource = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedModelFilter = 0;

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

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    if (modelFilter !== null && model !== modelFilter) {
      droppedModelFilter += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';

    let acc = perSource.get(source);
    if (!acc) {
      acc = {
        hours: new Set<string>(),
        models: new Set<string>(),
        firstMs: ms,
        lastMs: ms,
        tokens: 0,
      };
      perSource.set(source, acc);
    }
    acc.hours.add(q.hour_start);
    acc.models.add(model);
    if (ms < acc.firstMs) acc.firstMs = ms;
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.tokens += tt;
  }

  const sources: SourceTenureRow[] = [];
  let droppedSparseSources = 0;
  let droppedNarrowSources = 0;
  let totalActiveBuckets = 0;
  let totalTokens = 0;

  for (const [source, acc] of perSource.entries()) {
    const activeBuckets = acc.hours.size;
    if (activeBuckets === 0) continue;
    totalActiveBuckets += activeBuckets;
    totalTokens += acc.tokens;
    if (activeBuckets < minBuckets) {
      droppedSparseSources += 1;
      continue;
    }
    if (acc.models.size < minModels) {
      droppedNarrowSources += 1;
      continue;
    }
    const spanHours = (acc.lastMs - acc.firstMs) / HOUR_MS;
    sources.push({
      source,
      firstSeen: new Date(acc.firstMs).toISOString(),
      lastSeen: new Date(acc.lastMs).toISOString(),
      spanHours,
      activeBuckets,
      tokens: acc.tokens,
      tokensPerActiveBucket: acc.tokens / activeBuckets,
      tokensPerSpanHour: acc.tokens / Math.max(spanHours, 1),
      distinctModels: acc.models.size,
    });
  }

  sources.sort((a, b) => {
    let primary = 0;
    if (sort === 'span') primary = b.spanHours - a.spanHours;
    else if (sort === 'active') primary = b.activeBuckets - a.activeBuckets;
    else if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'density')
      primary = b.tokensPerSpanHour - a.tokensPerSpanHour;
    else primary = b.distinctModels - a.distinctModels;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = sources;
  if (top > 0 && sources.length > top) {
    droppedTopSources = sources.length - top;
    kept = sources.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    model: modelFilter,
    minBuckets,
    minModels,
    top,
    sort,
    totalSources: sources.length,
    totalActiveBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedSparseSources,
    droppedNarrowSources,
    droppedTopSources,
    sources: kept,
  };
}
