/**
 * output-size: per-model distribution of `output_tokens` per `QueueLine`
 * row in `queue.jsonl`. Symmetric counterpart to `prompt-size`, but for
 * the *generated* side of each call instead of the prompt side.
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `prompt-size` answers "how big are my prompts?" — purely the
 *     input side. Output volume is a totally different operational
 *     question (latency, throttling, $-per-call cost dominance for
 *     output-priced models like the Claude family).
 *   - `cost` collapses everything to dollars; a 200-token completion
 *     costs the same as one 200-token completion regardless of whether
 *     it was a single fat answer or twenty thin ones.
 *   - `reasoning-share` reports the *fraction* of generated tokens
 *     spent on hidden reasoning, but never exposes the absolute
 *     output-token distribution per model.
 *   - `cache-hit-ratio`, `provider-share`, `time-of-day`, `heatmap`
 *     all ignore output-token geometry entirely.
 *
 * The output-size view is the "how much do my models actually generate
 * per call?" lens — useful for:
 *
 *   - cost forecasting on output-priced vendors (Anthropic) where the
 *     output side dominates the bill;
 *   - latency planning (long completions = long wall-clock);
 *   - catching runaway-generation incidents (e.g. an agent that looped
 *     and emitted a 100k-token wall of text);
 *   - sanity-checking that a "concise" model is actually being concise.
 *
 * Bucket ladder is in `output_tokens`, smaller than the prompt-size
 * ladder because typical completions live in 0–8k territory and the
 * interesting tail is the 16k–64k+ regime where a model went off the
 * rails or wrote an entire document. Override via `opts.edges`.
 *
 * Two complementary lenses on the same data:
 *
 *   - The default (no `atLeast`) shows the full output-size population
 *     — short tool-call replies and giant document generations all in
 *     the same histogram. Answers "what fraction of my completions are
 *     above 8k?" and surfaces the long tail.
 *   - With `atLeast >= 8_000`, the view scopes to the heavy-output
 *     workload only. The mean and p95 then reflect the long-completion
 *     population specifically, instead of being dragged downward by
 *     the tool-call mass.
 *
 * Window semantics: filter by `hour_start` (the row's own timestamp),
 * exactly like `prompt-size`, `cost`, `forecast`, `trend`,
 * `cache-hit-ratio`, `reasoning-share`.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts fully
 * specified. Rows whose `output_tokens === 0` are folded out — a
 * zero-output row is almost always a metering artefact (failed call,
 * cancelled mid-stream) and would drag the mean downward. Their counts
 * surface as `droppedZeroOutput` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

/**
 * Default bucket edges, in output_tokens. Each edge is the inclusive
 * lower bound of a bucket; the last bucket is open on the right.
 *
 * Rationale: typical completions live in 0–8k territory. The
 * interesting operational tail is the 16k–64k+ regime where a model
 * either generated an entire document, looped on itself, or both.
 *
 *   - 0–256:    micro outputs (tool calls, classifier-style yes/no)
 *   - 256–1k:   short answers, one-paragraph replies
 *   - 1k–4k:    typical chat completions
 *   - 4k–8k:    long-form replies, code blocks, structured outputs
 *   - 8k–16k:   document-length generation
 *   - 16k–64k:  unusual; report-writing or runaway loops
 *   - 64k+:     pathological tail; investigate every occurrence
 *
 * Override with `opts.edges` for non-default ladders.
 */
export const DEFAULT_OUTPUT_SIZE_EDGES: number[] = [
  0,
  256,
  1_000,
  4_000,
  8_000,
  16_000,
  64_000,
];

export type OutputSizeDimension = 'model' | 'source';

export interface OutputSizeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Group rows by `model` (default — normalised model id) or by
   * `source` (the producer string: `claude-code`, `codex`, `opencode`,
   * ...). Source-grouping answers "which CLI's traffic is generating
   * the long-completion mass?" — the model view can't tell you that
   * because the same model is reached through several producers.
   */
  by?: OutputSizeDimension;
  /**
   * Drop model rows whose row count is `< minRows` from the
   * `models[]` output. Display filter only — global denominators
   * always reflect the full population so the operator can see how
   * much was hidden via `droppedModelRows`. Default 0 (keep every
   * model).
   */
  minRows?: number;
  /**
   * Truncate `models[]` to the top N by row count. Display filter
   * only — global denominators stay stable. Models hidden by `top`
   * surface as `droppedTopModels`. Default 0 (no truncation).
   */
  top?: number;
  /**
   * Custom bucket edges (ascending, first must be 0). Defaults to
   * `DEFAULT_OUTPUT_SIZE_EDGES`. Overrides are validated; non-finite,
   * negative, non-monotonic, or non-zero-first ladders are rejected
   * loudly so the operator never silently miscounts.
   */
  edges?: number[];
  /**
   * Drop rows whose `output_tokens < atLeast` from the considered
   * population entirely. Acts BEFORE bucketing, mean, p95, and max are
   * computed — i.e. all stats reflect the filtered population.
   * Useful for "show me only the heavy-completion workload" lenses,
   * where small tool-call replies are operationally noise. Their
   * counts surface as `droppedAtLeast`. Default 0 (no floor).
   */
  atLeast?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface OutputSizeBucket {
  /** Inclusive lower bound, in output_tokens. */
  from: number;
  /** Exclusive upper bound, in output_tokens. null for the open last bucket. */
  to: number | null;
  /** Number of QueueLine rows that fell in this bucket for this model. */
  rows: number;
  /** rows / model.rows. 0 when model.rows === 0. */
  share: number;
}

export interface ModelOutputSizeRow {
  /**
   * Group key. When `by === 'model'` this is the normalised model id
   * (output of `normaliseModel`); when `by === 'source'` this is the
   * raw source string from the QueueLine. The field name is kept as
   * `model` for backwards-compatibility with downstream JSON consumers.
   */
  model: string;
  /** Number of QueueLine rows considered for this model. */
  rows: number;
  /** Sum of output_tokens across those rows. */
  totalOutputTokens: number;
  /**
   * Arithmetic mean of output_tokens across kept rows. 0 when rows === 0.
   * Note: per-row mean, NOT token-weighted.
   */
  meanOutputTokens: number;
  /**
   * Approximate 95th percentile of output_tokens per row using the
   * "nearest-rank" method on the sorted sample. 0 when rows === 0.
   */
  p95OutputTokens: number;
  /** Largest single output_tokens value observed. 0 when rows === 0. */
  maxOutputTokens: number;
  /**
   * One entry per bucket in `opts.edges`, in the same order. Every
   * model exposes the full ladder (zero-row buckets included) so
   * downstream renderers don't have to align ragged rows.
   */
  buckets: OutputSizeBucket[];
}

export interface OutputSizeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved grouping dimension. */
  by: OutputSizeDimension;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved bucket edges (inclusive lower bounds). */
  edges: number[];
  /** Echo of the resolved `atLeast` floor (0 = no floor). */
  atLeast: number;
  /** Rows considered (output_tokens > 0, >= atLeast, and inside window). */
  consideredRows: number;
  /** Sum of output_tokens across consideredRows. */
  totalOutputTokens: number;
  /**
   * Overall arithmetic mean output_tokens per considered row. 0 when no
   * considered rows. Aggregates across every model.
   */
  overallMeanOutputTokens: number;
  /** Largest single output_tokens value across the considered population. */
  overallMaxOutputTokens: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with output_tokens <= 0. */
  droppedZeroOutput: number;
  /** Rows with non-finite / negative output_tokens. */
  droppedInvalidTokens: number;
  /** Rows with output_tokens < atLeast (when atLeast > 0). */
  droppedAtLeast: number;
  /** Model rows hidden by the minRows floor. */
  droppedModelRows: number;
  /** Model rows hidden by the `top` cap (counted after minRows). */
  droppedTopModels: number;
  /**
   * Aggregate bucket counts across ALL models (kept and dropped). Lets
   * the operator answer "what fraction of all my completions are above
   * 8k?" without summing the per-model rows themselves.
   */
  overallBuckets: OutputSizeBucket[];
  /**
   * One row per kept model. Sorted by row count desc, then model asc.
   */
  models: ModelOutputSizeRow[];
}

function validateEdges(edges: number[]): void {
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error('edges must be a non-empty ascending number array starting at 0');
  }
  if (edges[0] !== 0) {
    throw new Error(`edges[0] must be 0 (got ${edges[0]})`);
  }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!Number.isFinite(e) || e < 0) {
      throw new Error(`edges[${i}] must be a non-negative finite number (got ${e})`);
    }
    if (i > 0 && e <= edges[i - 1]!) {
      throw new Error(
        `edges must be strictly ascending; edges[${i}] (${e}) <= edges[${i - 1}] (${edges[i - 1]})`,
      );
    }
  }
}

function bucketIndex(value: number, edges: number[]): number {
  for (let i = edges.length - 1; i >= 0; i--) {
    if (value >= edges[i]!) return i;
  }
  return 0;
}

function p95(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(0.95 * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

export function buildOutputSize(
  queue: QueueLine[],
  opts: OutputSizeOptions = {},
): OutputSizeReport {
  const minRows = opts.minRows ?? 0;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(`minRows must be a non-negative integer (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const atLeast = opts.atLeast ?? 0;
  if (!Number.isFinite(atLeast) || atLeast < 0) {
    throw new Error(`atLeast must be a non-negative finite number (got ${opts.atLeast})`);
  }
  const by: OutputSizeDimension = opts.by ?? 'model';
  if (by !== 'model' && by !== 'source') {
    throw new Error(`by must be 'model' or 'source' (got ${opts.by})`);
  }
  const edges = opts.edges ?? DEFAULT_OUTPUT_SIZE_EDGES;
  validateEdges(edges);

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  type Agg = {
    rows: number;
    totalOutput: number;
    maxOutput: number;
    bucketCounts: number[];
    samples: number[];
  };

  const agg = new Map<string, Agg>();
  const overallBucketCounts = new Array(edges.length).fill(0) as number[];
  let consideredRows = 0;
  let totalOutput = 0;
  let overallMaxOutput = 0;
  let droppedInvalidHourStart = 0;
  let droppedZeroOutput = 0;
  let droppedInvalidTokens = 0;
  let droppedAtLeast = 0;

  for (const q of queue) {
    const hourMs = Date.parse(q.hour_start);
    if (!Number.isFinite(hourMs)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && hourMs < sinceMs) continue;
    if (untilMs !== null && hourMs >= untilMs) continue;

    const outT = Number(q.output_tokens);
    if (!Number.isFinite(outT) || outT < 0) {
      droppedInvalidTokens += 1;
      continue;
    }
    if (outT === 0) {
      droppedZeroOutput += 1;
      continue;
    }
    if (atLeast > 0 && outT < atLeast) {
      droppedAtLeast += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    const groupKey =
      by === 'source'
        ? typeof q.source === 'string' && q.source !== ''
          ? q.source
          : 'unknown'
        : model;
    consideredRows += 1;
    totalOutput += outT;
    if (outT > overallMaxOutput) overallMaxOutput = outT;
    const bIdx = bucketIndex(outT, edges);
    overallBucketCounts[bIdx] = (overallBucketCounts[bIdx] ?? 0) + 1;

    let row = agg.get(groupKey);
    if (!row) {
      row = {
        rows: 0,
        totalOutput: 0,
        maxOutput: 0,
        bucketCounts: new Array(edges.length).fill(0) as number[],
        samples: [],
      };
      agg.set(groupKey, row);
    }
    row.rows += 1;
    row.totalOutput += outT;
    if (outT > row.maxOutput) row.maxOutput = outT;
    row.bucketCounts[bIdx] = (row.bucketCounts[bIdx] ?? 0) + 1;
    row.samples.push(outT);
  }

  const models: ModelOutputSizeRow[] = [];
  let droppedModelRows = 0;
  for (const [model, row] of agg) {
    if (row.rows < minRows) {
      droppedModelRows += 1;
      continue;
    }
    const sorted = row.samples.slice().sort((a, b) => a - b);
    const buckets: OutputSizeBucket[] = edges.map((from, i) => ({
      from,
      to: i + 1 < edges.length ? edges[i + 1]! : null,
      rows: row.bucketCounts[i] ?? 0,
      share: row.rows === 0 ? 0 : (row.bucketCounts[i] ?? 0) / row.rows,
    }));
    models.push({
      model,
      rows: row.rows,
      totalOutputTokens: row.totalOutput,
      meanOutputTokens: row.rows === 0 ? 0 : row.totalOutput / row.rows,
      p95OutputTokens: p95(sorted),
      maxOutputTokens: row.maxOutput,
      buckets,
    });
  }
  models.sort((a, b) => {
    if (b.rows !== a.rows) return b.rows - a.rows;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopModels = 0;
  let kept = models;
  if (top > 0 && models.length > top) {
    droppedTopModels = models.length - top;
    kept = models.slice(0, top);
  }

  const overallBuckets: OutputSizeBucket[] = edges.map((from, i) => ({
    from,
    to: i + 1 < edges.length ? edges[i + 1]! : null,
    rows: overallBucketCounts[i] ?? 0,
    share: consideredRows === 0 ? 0 : (overallBucketCounts[i] ?? 0) / consideredRows,
  }));

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    minRows,
    top,
    edges: edges.slice(),
    atLeast,
    consideredRows,
    totalOutputTokens: totalOutput,
    overallMeanOutputTokens: consideredRows === 0 ? 0 : totalOutput / consideredRows,
    overallMaxOutputTokens: overallMaxOutput,
    droppedInvalidHourStart,
    droppedZeroOutput,
    droppedInvalidTokens,
    droppedAtLeast,
    droppedModelRows,
    droppedTopModels,
    overallBuckets,
    models: kept,
  };
}
