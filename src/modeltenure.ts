/**
 * model-tenure: per-model active-span lens.
 *
 * For every model, we look at the set of distinct `hour_start`
 * timestamps in which it produced a positive `total_tokens`
 * observation, then compute:
 *
 *   - firstSeen:    ISO of the earliest active bucket
 *   - lastSeen:     ISO of the latest active bucket
 *   - spanHours:    clock hours from firstSeen to lastSeen (>= 0,
 *                   may be fractional). 0 for a single-bucket model.
 *   - activeBuckets: number of distinct `hour_start` values
 *   - tokens:       sum of total_tokens across all active buckets
 *   - tokensPerActiveBucket: tokens / activeBuckets (mean intensity)
 *   - tokensPerSpanHour:    tokens / max(spanHours, 1) — average
 *                           token throughput per clock hour over the
 *                           full tenure (idle or not). For
 *                           single-bucket models we use 1 hour as
 *                           the floor so the value reflects the only
 *                           bucket's size.
 *
 * Note on bucket granularity: the queue's `hour_start` field is
 * named for hourly buckets but pew may emit half-hour buckets
 * (observed: ":00" and ":30" both present in real data). We do not
 * assume any fixed bucket width — we only count distinct timestamp
 * strings (`activeBuckets`) and measure the clock span in hours
 * (`spanHours`). This keeps the metric honest regardless of
 * upstream bucket size changes.
 *
 * Why a separate subcommand:
 *
 *   - `model-mix-entropy` collapses model usage into a single
 *     concentration scalar per window — it cannot tell you how long
 *     a given model has been around.
 *   - `model-cohabitation` is about co-presence of *pairs* of models
 *     in the same hour, not the lifetime span of any one model.
 *   - `agent-mix` / `provider-share` / `cost` are mass tallies over a
 *     window — a model used for one giant burst on day 1 and a model
 *     used continuously over 30 days at the same total volume look
 *     identical to them.
 *   - `bucket-intensity` reports per-bucket *magnitude* distribution
 *     per model — it never surfaces firstSeen / lastSeen / span.
 *   - `interarrival-time` reports time *between* active buckets per
 *     model but does not anchor to firstSeen/lastSeen and does not
 *     produce a tenure span.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface ModelTenureOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ModelTenureRow {
  model: string;
  firstSeen: string;
  lastSeen: string;
  /**
   * Clock hours between firstSeen and lastSeen, may be fractional.
   * 0 for a single-bucket model.
   */
  spanHours: number;
  /** Distinct `hour_start` buckets in which this model was active. */
  activeBuckets: number;
  /** Sum of total_tokens across this model's active buckets. */
  tokens: number;
  /** tokens / activeBuckets. */
  tokensPerActiveBucket: number;
  /**
   * tokens / max(spanHours, 1). The 1-hour floor keeps the value
   * finite and meaningful for single-bucket models.
   */
  tokensPerSpanHour: number;
}

export interface ModelTenureReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Distinct models surviving filters. */
  totalModels: number;
  /** Sum of activeBuckets across all kept models. */
  totalActiveBuckets: number;
  /** Sum of total_tokens across all kept observations. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Per-model tenure rows. Sorted by spanHours desc, then model asc. */
  models: ModelTenureRow[];
}

const HOUR_MS = 3_600_000;

export function buildModelTenure(
  queue: QueueLine[],
  opts: ModelTenureOptions = {},
): ModelTenureReport {
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

  interface Acc {
    hours: Set<string>;
    firstMs: number;
    lastMs: number;
    tokens: number;
  }
  const perModel = new Map<string, Acc>();

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

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    let acc = perModel.get(model);
    if (!acc) {
      acc = {
        hours: new Set<string>(),
        firstMs: ms,
        lastMs: ms,
        tokens: 0,
      };
      perModel.set(model, acc);
    }
    acc.hours.add(q.hour_start);
    if (ms < acc.firstMs) acc.firstMs = ms;
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.tokens += tt;
  }

  const models: ModelTenureRow[] = [];
  let totalActiveBuckets = 0;
  let totalTokens = 0;
  for (const [model, acc] of perModel.entries()) {
    const activeBuckets = acc.hours.size;
    if (activeBuckets === 0) continue;
    const spanHours = (acc.lastMs - acc.firstMs) / HOUR_MS;
    const tokensPerActiveBucket = acc.tokens / activeBuckets;
    const tokensPerSpanHour = acc.tokens / Math.max(spanHours, 1);
    models.push({
      model,
      firstSeen: new Date(acc.firstMs).toISOString(),
      lastSeen: new Date(acc.lastMs).toISOString(),
      spanHours,
      activeBuckets,
      tokens: acc.tokens,
      tokensPerActiveBucket,
      tokensPerSpanHour,
    });
    totalActiveBuckets += activeBuckets;
    totalTokens += acc.tokens;
  }

  models.sort((a, b) => {
    if (b.spanHours !== a.spanHours) return b.spanHours - a.spanHours;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    totalModels: models.length,
    totalActiveBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    models,
  };
}
