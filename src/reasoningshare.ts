/**
 * reasoning-share: per-model token-weighted share of
 * `reasoning_output_tokens / (output_tokens + reasoning_output_tokens)`
 * across the `QueueLine` rows in `queue.jsonl`.
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `cost` rolls reasoning tokens into the dollar figure but
 *     hides the *share* of generated tokens that were "thinking"
 *     vs. user-visible. A model whose output is 80% reasoning
 *     spends 5x more dollars per visible token than one that
 *     reasons inline.
 *   - `cache-hit-ratio` is input-side only and never inspects
 *     output composition.
 *   - `provider-share` aggregates by vendor and ignores the
 *     reasoning column entirely.
 *   - The session-level reports operate on `SessionLine` and do
 *     not see the per-hour `reasoning_output_tokens` column.
 *
 * The reasoning-share view is the "how much of what this model
 * generates is hidden chain-of-thought?" lens — useful for
 * deciding whether to switch a workload to a non-reasoning
 * variant, or to budget for the reasoning premium.
 *
 * Window semantics: filter by `hour_start` (the row's own
 * timestamp), exactly like the rest of the queue-based reports
 * (`cost`, `forecast`, `trend`, `cache-hit-ratio`).
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified. Rows whose `output_tokens + reasoning_output_tokens
 * === 0` are folded out of the considered population (you cannot
 * define a share when nothing was generated); their counts surface
 * as `droppedZeroOutput` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface ReasoningShareOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop model rows whose row count is `< minRows` from the
   * `models[]` output. Display filter only — global denominators
   * always reflect the full population so the operator can see
   * how much was hidden via `droppedModelRows`.
   * Default 0 (keep every model).
   */
  minRows?: number;
  /**
   * Truncate `models[]` to the top N by total generated tokens
   * (output + reasoning). Display filter only — global
   * denominators stay stable. Models hidden by `--top` surface
   * as `droppedTopModels`. Default 0 (no truncation).
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ModelReasoningRow {
  /** Normalised model id (output of `normaliseModel`). */
  model: string;
  /** Number of QueueLine rows considered for this model. */
  rows: number;
  /** Sum of output_tokens across those rows. */
  outputTokens: number;
  /** Sum of reasoning_output_tokens across those rows. */
  reasoningTokens: number;
  /** outputTokens + reasoningTokens. */
  generatedTokens: number;
  /**
   * Token-weighted reasoning share for this model:
   * reasoningTokens / generatedTokens. 0 when generatedTokens === 0
   * (defensively guarded — such rows are dropped upstream).
   */
  reasoningShare: number;
}

export interface ReasoningShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Rows considered (generated_tokens > 0 and inside window). */
  consideredRows: number;
  /** Sum of output_tokens across consideredRows. */
  totalOutputTokens: number;
  /** Sum of reasoning_output_tokens across consideredRows. */
  totalReasoningTokens: number;
  /** totalOutputTokens + totalReasoningTokens. */
  totalGeneratedTokens: number;
  /**
   * Overall token-weighted reasoning share.
   * totalReasoningTokens / totalGeneratedTokens. 0 when no rows.
   */
  overallReasoningShare: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with output_tokens + reasoning_output_tokens <= 0. */
  droppedZeroOutput: number;
  /** Rows with non-finite / negative token counts. */
  droppedInvalidTokens: number;
  /** Model rows hidden by the minRows floor. */
  droppedModelRows: number;
  /** Model rows hidden by the `top` cap (counted after minRows). */
  droppedTopModels: number;
  /**
   * One row per kept model. Sorted by generatedTokens desc, then
   * model asc — i.e. the heaviest generators surface first, which
   * is what the operator actually wants to act on.
   */
  models: ModelReasoningRow[];
}

export function buildReasoningShare(
  queue: QueueLine[],
  opts: ReasoningShareOptions = {},
): ReasoningShareReport {
  const minRows = opts.minRows ?? 0;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(`minRows must be a non-negative integer (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
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

  const agg = new Map<string, { rows: number; out: number; reasoning: number }>();
  let consideredRows = 0;
  let totalOut = 0;
  let totalReasoning = 0;
  let droppedInvalidHourStart = 0;
  let droppedZeroOutput = 0;
  let droppedInvalidTokens = 0;

  for (const q of queue) {
    const hourMs = Date.parse(q.hour_start);
    if (!Number.isFinite(hourMs)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && hourMs < sinceMs) continue;
    if (untilMs !== null && hourMs >= untilMs) continue;

    const outT = Number(q.output_tokens);
    const rT = Number(q.reasoning_output_tokens);
    if (!Number.isFinite(outT) || !Number.isFinite(rT) || outT < 0 || rT < 0) {
      droppedInvalidTokens += 1;
      continue;
    }
    const gen = outT + rT;
    if (gen === 0) {
      droppedZeroOutput += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    consideredRows += 1;
    totalOut += outT;
    totalReasoning += rT;

    let row = agg.get(model);
    if (!row) {
      row = { rows: 0, out: 0, reasoning: 0 };
      agg.set(model, row);
    }
    row.rows += 1;
    row.out += outT;
    row.reasoning += rT;
  }

  const models: ModelReasoningRow[] = [];
  let droppedModelRows = 0;
  for (const [model, row] of agg) {
    if (row.rows < minRows) {
      droppedModelRows += 1;
      continue;
    }
    const generated = row.out + row.reasoning;
    models.push({
      model,
      rows: row.rows,
      outputTokens: row.out,
      reasoningTokens: row.reasoning,
      generatedTokens: generated,
      reasoningShare: generated === 0 ? 0 : row.reasoning / generated,
    });
  }
  models.sort((a, b) => {
    if (b.generatedTokens !== a.generatedTokens) return b.generatedTokens - a.generatedTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopModels = 0;
  let kept = models;
  if (top > 0 && models.length > top) {
    droppedTopModels = models.length - top;
    kept = models.slice(0, top);
  }

  const totalGen = totalOut + totalReasoning;
  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    top,
    consideredRows,
    totalOutputTokens: totalOut,
    totalReasoningTokens: totalReasoning,
    totalGeneratedTokens: totalGen,
    overallReasoningShare: totalGen === 0 ? 0 : totalReasoning / totalGen,
    droppedInvalidHourStart,
    droppedZeroOutput,
    droppedInvalidTokens,
    droppedModelRows,
    droppedTopModels,
    models: kept,
  };
}
