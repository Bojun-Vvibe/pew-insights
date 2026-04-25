/**
 * output-input-ratio: per-model ratio of `output_tokens` to
 * `input_tokens` aggregated across `QueueLine` rows in
 * `queue.jsonl`. Answers questions like:
 *
 *   - "Which of my models is *chatty* (lots of completion per
 *     unit of prompt) vs *terse* (gives short answers to long
 *     prompts)?"
 *   - "Did a model swap actually change the verbosity profile
 *     of my workloads, or just the price tag?"
 *   - "Are tool-loop agents (codex, opencode) sending huge
 *     prompts and getting tiny answers — i.e. is most of the
 *     spend going to context I keep re-shipping?"
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `prompt-size` and `output-size` are *univariate* distribution
 *     views — they bucket the input or output side, but never
 *     correlate the two. A model with mean prompt 100k and mean
 *     completion 200 looks identical in the prompt-size view to a
 *     model with mean prompt 100k and mean completion 20k; the
 *     verbosity signal is invisible there.
 *   - `cost` collapses both sides into a single dollar figure, with
 *     vendor-specific weights, so a chatty cheap model and a terse
 *     expensive one can land on the same $ bar.
 *   - `cache-hit-ratio` is a ratio over the *input* side only.
 *   - `reasoning-share` reports `reasoning_output / output_tokens`
 *     within the output side; it does not look at input at all.
 *
 * The output-input-ratio view is the "verbosity per call" lens,
 * scoped to rows where input_tokens > 0 (you cannot define a
 * ratio when there were no input tokens to ratio against).
 *
 * Window semantics: filter by `hour_start` (the row's own
 * timestamp), exactly like the rest of the queue-based reports
 * (`cost`, `forecast`, `cache-hit-ratio`, `output-size`).
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified. Rows whose `input_tokens === 0` fall out of
 * the considered population (cannot define a ratio); their counts
 * surface as `droppedZeroInput` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface OutputInputRatioOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop model rows whose row count is `< minRows` from the
   * `models[]` output. Display filter only — global denominators
   * always reflect the full population, surfaced via
   * `droppedModelRows`. Default 0 (keep every model).
   */
  minRows?: number;
  /**
   * Truncate `models[]` to the top N by input volume. Display
   * filter only. Models hidden surface as `droppedTopModels`.
   * Default 0 (no truncation).
   */
  top?: number;
  /**
   * Also break down each per-model row by `source` (the local
   * producer CLI). When true, each `ModelRatioRow` carries a
   * `bySource` map of `source -> { rows, inputTokens,
   * outputTokens, ratio }`. Default false.
   */
  bySource?: boolean;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRatioStats {
  rows: number;
  inputTokens: number;
  outputTokens: number;
  /** outputTokens / inputTokens, 0 when inputTokens === 0. */
  ratio: number;
}

export interface ModelRatioRow {
  /** Normalised model id (output of `normaliseModel`). */
  model: string;
  /** Number of QueueLine rows with input_tokens > 0 for this model. */
  rows: number;
  /** Sum of input_tokens across those rows. */
  inputTokens: number;
  /** Sum of output_tokens across those rows. */
  outputTokens: number;
  /**
   * Token-weighted output/input ratio for this model:
   * outputTokens / inputTokens. 0 when inputTokens === 0
   * (defensively guarded — by construction can't happen since
   * we drop zero-input rows before aggregation).
   */
  ratio: number;
  /**
   * Mean of per-row ratios for this model
   * (sum(out_i / in_i) / rows). Equally weights every call,
   * so a single 100k-token completion does not dominate the
   * signal the way it would in `ratio`. Zero when rows === 0.
   */
  meanRowRatio: number;
  /**
   * Per-source breakdown for this model. Empty object when
   * `bySource` is false. Sources sorted by inputTokens desc,
   * then source asc — same convention as cache-hit-ratio.
   */
  bySource: Record<string, SourceRatioStats>;
}

export interface OutputInputRatioReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of `bySource`. */
  bySource: boolean;
  /** Rows considered (input_tokens > 0 and inside window). */
  consideredRows: number;
  /** Sum of input_tokens across consideredRows. */
  totalInputTokens: number;
  /** Sum of output_tokens across consideredRows. */
  totalOutputTokens: number;
  /**
   * Overall token-weighted ratio.
   * totalOutputTokens / totalInputTokens. 0 when no rows.
   */
  overallRatio: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with input_tokens <= 0 (cannot define a ratio). */
  droppedZeroInput: number;
  /** Rows with non-finite / negative input_tokens or output_tokens. */
  droppedInvalidTokens: number;
  /** Model rows hidden by the minRows floor. */
  droppedModelRows: number;
  /** Model rows hidden by the `top` cap (counted after minRows). */
  droppedTopModels: number;
  /**
   * One row per kept model. Sorted by inputTokens desc, then
   * model asc — heaviest workloads surface first.
   */
  models: ModelRatioRow[];
}

export function buildOutputInputRatio(
  queue: QueueLine[],
  opts: OutputInputRatioOptions = {},
): OutputInputRatioReport {
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
  const bySource = opts.bySource === true;

  const agg = new Map<
    string,
    {
      rows: number;
      input: number;
      output: number;
      rowRatioSum: number;
      sources: Map<string, { rows: number; input: number; output: number }>;
    }
  >();
  let consideredRows = 0;
  let totalInput = 0;
  let totalOutput = 0;
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
    const outT = Number(q.output_tokens);
    if (!Number.isFinite(inT) || !Number.isFinite(outT) || inT < 0 || outT < 0) {
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
    totalOutput += outT;

    let row = agg.get(model);
    if (!row) {
      row = { rows: 0, input: 0, output: 0, rowRatioSum: 0, sources: new Map() };
      agg.set(model, row);
    }
    row.rows += 1;
    row.input += inT;
    row.output += outT;
    row.rowRatioSum += outT / inT;
    if (bySource) {
      const src =
        typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
      let sRow = row.sources.get(src);
      if (!sRow) {
        sRow = { rows: 0, input: 0, output: 0 };
        row.sources.set(src, sRow);
      }
      sRow.rows += 1;
      sRow.input += inT;
      sRow.output += outT;
    }
  }

  const models: ModelRatioRow[] = [];
  let droppedModelRows = 0;
  for (const [model, row] of agg) {
    if (row.rows < minRows) {
      droppedModelRows += 1;
      continue;
    }
    const sourceOut: Record<string, SourceRatioStats> = {};
    if (bySource) {
      const entries = Array.from(row.sources.entries()).sort((a, b) => {
        if (b[1].input !== a[1].input) return b[1].input - a[1].input;
        return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
      });
      for (const [src, s] of entries) {
        sourceOut[src] = {
          rows: s.rows,
          inputTokens: s.input,
          outputTokens: s.output,
          ratio: s.input === 0 ? 0 : s.output / s.input,
        };
      }
    }
    models.push({
      model,
      rows: row.rows,
      inputTokens: row.input,
      outputTokens: row.output,
      ratio: row.input === 0 ? 0 : row.output / row.input,
      meanRowRatio: row.rows === 0 ? 0 : row.rowRatioSum / row.rows,
      bySource: sourceOut,
    });
  }
  models.sort((a, b) => {
    if (b.inputTokens !== a.inputTokens) return b.inputTokens - a.inputTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopModels = 0;
  let kept = models;
  if (top > 0 && models.length > top) {
    droppedTopModels = models.length - top;
    kept = models.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    top,
    bySource,
    consideredRows,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    overallRatio: totalInput === 0 ? 0 : totalOutput / totalInput,
    droppedInvalidHourStart,
    droppedZeroInput,
    droppedInvalidTokens,
    droppedModelRows,
    droppedTopModels,
    models: kept,
  };
}
