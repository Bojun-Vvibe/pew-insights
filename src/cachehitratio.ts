/**
 * cache-hit-ratio: distribution of `cached_input_tokens / input_tokens`
 * across the `QueueLine` rows in `queue.jsonl`. Answers questions like:
 *
 *   - "How effective is prompt-caching across my actual workloads?"
 *   - "Which model gives me the worst cache reuse — and is that
 *     a routing problem or a prompt-shape problem?"
 *   - "Is one source (claude-code / opencode / codex / ...)
 *     leaving cache savings on the table?"
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `cost` rolls cached vs. uncached spend into a single dollar
 *     figure but does not surface the *ratio* — and small models
 *     with cheap rates can mask poor cache reuse on expensive ones.
 *   - `provider-share` aggregates by vendor but does not look at
 *     token-level efficiency at all.
 *   - `byproject` attributes tokens to project refs but, again,
 *     does not isolate the cache-reuse signal.
 *   - `ratios` (the existing per-session ratios report) lives on
 *     `SessionLine` and never sees the per-hour token columns
 *     that drive prompt-cache behaviour.
 *
 * The cache-hit-ratio view is the "is my prompt-cache earning
 * its keep?" lens, scoped to the rows that actually have any
 * input tokens to cache.
 *
 * Window semantics: filter by `hour_start` (the row's own
 * timestamp), exactly like the rest of the queue-based reports
 * (`cost`, `forecast`, `trend`).
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified. Ratios fold rows whose `input_tokens === 0`
 * out of the considered population (you cannot define a hit
 * ratio when there were no input tokens to cache); their counts
 * surface as `droppedZeroInput` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface CacheHitRatioOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop model rows whose row count is `< minRows` from the
   * `models[]` output. Display filter only — global denominators
   * (`consideredRows`, `totalInputTokens`, `totalCachedInputTokens`)
   * always reflect the full population so the operator can see
   * how much was hidden via `droppedModelRows`.
   * Default 0 (keep every model).
   */
  minRows?: number;
  /**
   * Also break down each per-model row by `source` (the local
   * producer CLI). When true, each `ModelCacheRow` carries a
   * `bySource` map of `source -> { rows, inputTokens,
   * cachedInputTokens, hitRatio }`. Default false.
   */
  bySource?: boolean;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceCacheStats {
  rows: number;
  inputTokens: number;
  cachedInputTokens: number;
  /** cachedInputTokens / inputTokens, 0 when inputTokens === 0. */
  hitRatio: number;
}

export interface ModelCacheRow {
  /** Normalised model id (output of `normaliseModel`). */
  model: string;
  /** Number of QueueLine rows with input_tokens > 0 for this model. */
  rows: number;
  /** Sum of input_tokens across those rows. */
  inputTokens: number;
  /** Sum of cached_input_tokens across those rows. */
  cachedInputTokens: number;
  /**
   * Token-weighted hit ratio for this model:
   * cachedInputTokens / inputTokens. 0 when inputTokens === 0
   * (which can only happen if all rows for this model were
   * dropped — defensively guarded).
   */
  hitRatio: number;
  /**
   * Per-source breakdown for this model. Empty object when
   * `bySource` is false. Sources sorted by inputTokens desc,
   * then source asc.
   */
  bySource: Record<string, SourceCacheStats>;
}

export interface CacheHitRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of `bySource`. */
  bySource: boolean;
  /** Rows considered (input_tokens > 0 and inside window). */
  consideredRows: number;
  /** Sum of input_tokens across consideredRows. */
  totalInputTokens: number;
  /** Sum of cached_input_tokens across consideredRows. */
  totalCachedInputTokens: number;
  /**
   * Overall token-weighted hit ratio.
   * totalCachedInputTokens / totalInputTokens. 0 when no rows.
   */
  overallHitRatio: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with input_tokens <= 0 (cannot define a ratio). */
  droppedZeroInput: number;
  /** Rows with non-finite / negative input_tokens or cached_input_tokens. */
  droppedInvalidTokens: number;
  /** Model rows hidden by the minRows floor. */
  droppedModelRows: number;
  /**
   * One row per kept model. Sorted by inputTokens desc, then
   * model asc — i.e. the heaviest cache-eligible workloads
   * surface first, which is what the operator actually wants
   * to act on.
   */
  models: ModelCacheRow[];
}

export function buildCacheHitRatio(
  queue: QueueLine[],
  opts: CacheHitRatioOptions = {},
): CacheHitRatioReport {
  const minRows = opts.minRows ?? 0;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(`minRows must be a non-negative integer (got ${opts.minRows})`);
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
  const bySource = opts.bySource === true;

  const agg = new Map<
    string,
    {
      rows: number;
      input: number;
      cached: number;
      sources: Map<string, { rows: number; input: number; cached: number }>;
    }
  >();
  let consideredRows = 0;
  let totalInput = 0;
  let totalCached = 0;
  let droppedInvalidHourStart = 0;
  let droppedZeroInput = 0;
  let droppedInvalidTokens = 0;

  for (const q of queue) {
    const hourMs = Date.parse(q.hour_start);
    if (!Number.isFinite(hourMs)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && hourMs < sinceMs) continue;
    if (untilMs !== null && hourMs >= untilMs) continue;

    const inT = Number(q.input_tokens);
    const cT = Number(q.cached_input_tokens);
    if (!Number.isFinite(inT) || !Number.isFinite(cT) || inT < 0 || cT < 0) {
      droppedInvalidTokens += 1;
      continue;
    }
    if (inT === 0) {
      droppedZeroInput += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    consideredRows += 1;
    totalInput += inT;
    totalCached += cT;

    let row = agg.get(model);
    if (!row) {
      row = { rows: 0, input: 0, cached: 0, sources: new Map() };
      agg.set(model, row);
    }
    row.rows += 1;
    row.input += inT;
    row.cached += cT;
    if (bySource) {
      const src =
        typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
      let sRow = row.sources.get(src);
      if (!sRow) {
        sRow = { rows: 0, input: 0, cached: 0 };
        row.sources.set(src, sRow);
      }
      sRow.rows += 1;
      sRow.input += inT;
      sRow.cached += cT;
    }
  }

  const models: ModelCacheRow[] = [];
  let droppedModelRows = 0;
  for (const [model, row] of agg) {
    if (row.rows < minRows) {
      droppedModelRows += 1;
      continue;
    }
    const sourceOut: Record<string, SourceCacheStats> = {};
    if (bySource) {
      const entries = Array.from(row.sources.entries()).sort((a, b) => {
        if (b[1].input !== a[1].input) return b[1].input - a[1].input;
        return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
      });
      for (const [src, s] of entries) {
        sourceOut[src] = {
          rows: s.rows,
          inputTokens: s.input,
          cachedInputTokens: s.cached,
          hitRatio: s.input === 0 ? 0 : s.cached / s.input,
        };
      }
    }
    models.push({
      model,
      rows: row.rows,
      inputTokens: row.input,
      cachedInputTokens: row.cached,
      hitRatio: row.input === 0 ? 0 : row.cached / row.input,
      bySource: sourceOut,
    });
  }
  models.sort((a, b) => {
    if (b.inputTokens !== a.inputTokens) return b.inputTokens - a.inputTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    bySource,
    consideredRows,
    totalInputTokens: totalInput,
    totalCachedInputTokens: totalCached,
    overallHitRatio: totalInput === 0 ? 0 : totalCached / totalInput,
    droppedInvalidHourStart,
    droppedZeroInput,
    droppedInvalidTokens,
    droppedModelRows,
    models,
  };
}
