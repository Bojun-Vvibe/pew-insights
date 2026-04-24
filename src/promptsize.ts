/**
 * prompt-size: per-model distribution of `input_tokens` per `QueueLine`
 * row in `queue.jsonl`. Bucketises each row's input-token count into a
 * fixed ladder of size edges and surfaces, per model:
 *
 *   - row count and share in each bucket
 *   - mean and p95 input_tokens
 *   - the largest single prompt observed
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `cost` collapses everything into dollars and never exposes per-row
 *     prompt size; a 2-million-token prompt looks identical to twenty
 *     100k prompts in that view.
 *   - `cache-hit-ratio` divides `cached / input` but says nothing about
 *     the absolute size of the prompt being sent — a high hit ratio on
 *     a 1-million-token prompt is still expensive in latency.
 *   - `provider-share` and `reasoning-share` aggregate vendor / output
 *     composition and ignore prompt geometry entirely.
 *   - `heatmap` is a time-of-day view over totals.
 *
 * The prompt-size view is the "how close are my prompts to the model's
 * context window?" lens — useful for spotting workloads that are about
 * to hit a 200k/1M cap, picking models whose ceilings actually fit the
 * job, and noticing when a single runaway request blows up the average.
 *
 * Window semantics: filter by `hour_start` (the row's own timestamp),
 * exactly like the rest of the queue-based reports (`cost`, `forecast`,
 * `trend`, `cache-hit-ratio`, `reasoning-share`).
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts fully
 * specified. Rows whose `input_tokens === 0` are folded out — a
 * zero-token "prompt" is almost certainly a metering artefact (warm-up
 * ping, retry-with-empty-body, etc.) and would otherwise drag the mean
 * downward. Their counts surface as `droppedZeroInput` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

/**
 * Default bucket edges, in input_tokens. Each edge is the inclusive
 * lower bound of a bucket; the last bucket is open on the right.
 *
 * Rationale: we want the buckets to align with the user's mental model
 * of "how much of my context window am I using?" The boundaries here
 * trace the well-known ceilings:
 *
 *   - 0–4k:    micro prompts (single-turn calls, classifier-style)
 *   - 4–32k:   small chats, short documents
 *   - 32–128k: typical "fits a small repo" working sets
 *   - 128–200k: the GPT-4-era 200k ceiling
 *   - 200–500k: anything beyond legacy ceilings — entering long-context
 *     territory where caching matters most
 *   - 500k–1M: approaching the modern 1M ceiling (gpt-5.x, gemini-3)
 *   - 1M+:     million-token regime; very few models accept this
 *
 * Override with `opts.edges` for non-default ladders.
 */
export const DEFAULT_PROMPT_SIZE_EDGES: number[] = [
  0,
  4_000,
  32_000,
  128_000,
  200_000,
  500_000,
  1_000_000,
];

export interface PromptSizeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
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
   * `DEFAULT_PROMPT_SIZE_EDGES`. Overrides are validated; non-finite,
   * negative, non-monotonic, or non-zero-first ladders are rejected
   * loudly so the operator never silently miscounts.
   */
  edges?: number[];
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface PromptSizeBucket {
  /** Inclusive lower bound, in input_tokens. */
  from: number;
  /** Exclusive upper bound, in input_tokens. null for the open last bucket. */
  to: number | null;
  /** Number of QueueLine rows that fell in this bucket for this model. */
  rows: number;
  /** rows / model.rows. 0 when model.rows === 0. */
  share: number;
}

export interface ModelPromptSizeRow {
  /** Normalised model id (output of `normaliseModel`). */
  model: string;
  /** Number of QueueLine rows considered for this model. */
  rows: number;
  /** Sum of input_tokens across those rows. */
  totalInputTokens: number;
  /**
   * Arithmetic mean of input_tokens across kept rows. 0 when rows === 0.
   * Note: this is per-row mean, NOT token-weighted; that's the whole
   * point — we want to know the typical prompt size.
   */
  meanInputTokens: number;
  /**
   * Approximate 95th percentile of input_tokens per row using the
   * "nearest-rank" method on the sorted sample. 0 when rows === 0.
   * Approximate is fine — we just want to flag the long tail without
   * paying for kernel-density estimation.
   */
  p95InputTokens: number;
  /** Largest single input_tokens value observed. 0 when rows === 0. */
  maxInputTokens: number;
  /**
   * One entry per bucket in `opts.edges`, in the same order. Every
   * model exposes the full ladder (zero-row buckets included) so
   * downstream renderers don't have to align ragged rows.
   */
  buckets: PromptSizeBucket[];
}

export interface PromptSizeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minRows floor. */
  minRows: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved bucket edges (inclusive lower bounds). */
  edges: number[];
  /** Rows considered (input_tokens > 0 and inside window). */
  consideredRows: number;
  /** Sum of input_tokens across consideredRows. */
  totalInputTokens: number;
  /**
   * Overall arithmetic mean input_tokens per considered row. 0 when no
   * considered rows. Aggregates across every model.
   */
  overallMeanInputTokens: number;
  /** Largest single input_tokens value across the considered population. */
  overallMaxInputTokens: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with input_tokens <= 0. */
  droppedZeroInput: number;
  /** Rows with non-finite / negative input_tokens. */
  droppedInvalidTokens: number;
  /** Model rows hidden by the minRows floor. */
  droppedModelRows: number;
  /** Model rows hidden by the `top` cap (counted after minRows). */
  droppedTopModels: number;
  /**
   * Aggregate bucket counts across ALL models (kept and dropped). Lets
   * the operator answer "what fraction of all my prompts are above
   * 200k?" without summing the per-model rows themselves.
   */
  overallBuckets: PromptSizeBucket[];
  /**
   * One row per kept model. Sorted by row count desc, then model asc
   * — i.e. the heaviest users surface first, which is what the
   * operator actually wants to act on.
   */
  models: ModelPromptSizeRow[];
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
  // Linear scan is fine — edges arrays are tiny (default 7).
  for (let i = edges.length - 1; i >= 0; i--) {
    if (value >= edges[i]!) return i;
  }
  return 0;
}

function emptyBuckets(edges: number[]): PromptSizeBucket[] {
  return edges.map((from, i) => ({
    from,
    to: i + 1 < edges.length ? edges[i + 1]! : null,
    rows: 0,
    share: 0,
  }));
}

function p95(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  // Nearest-rank: ceil(0.95 * n) using 1-indexed semantics.
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(0.95 * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

export function buildPromptSize(
  queue: QueueLine[],
  opts: PromptSizeOptions = {},
): PromptSizeReport {
  const minRows = opts.minRows ?? 0;
  if (!Number.isInteger(minRows) || minRows < 0) {
    throw new Error(`minRows must be a non-negative integer (got ${opts.minRows})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const edges = opts.edges ?? DEFAULT_PROMPT_SIZE_EDGES;
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
    totalInput: number;
    maxInput: number;
    bucketCounts: number[];
    samples: number[];
  };

  const agg = new Map<string, Agg>();
  const overallBucketCounts = new Array(edges.length).fill(0) as number[];
  let consideredRows = 0;
  let totalInput = 0;
  let overallMaxInput = 0;
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
    if (!Number.isFinite(inT) || inT < 0) {
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
    if (inT > overallMaxInput) overallMaxInput = inT;
    const bIdx = bucketIndex(inT, edges);
    overallBucketCounts[bIdx] = (overallBucketCounts[bIdx] ?? 0) + 1;

    let row = agg.get(model);
    if (!row) {
      row = {
        rows: 0,
        totalInput: 0,
        maxInput: 0,
        bucketCounts: new Array(edges.length).fill(0) as number[],
        samples: [],
      };
      agg.set(model, row);
    }
    row.rows += 1;
    row.totalInput += inT;
    if (inT > row.maxInput) row.maxInput = inT;
    row.bucketCounts[bIdx] = (row.bucketCounts[bIdx] ?? 0) + 1;
    row.samples.push(inT);
  }

  const models: ModelPromptSizeRow[] = [];
  let droppedModelRows = 0;
  for (const [model, row] of agg) {
    if (row.rows < minRows) {
      droppedModelRows += 1;
      continue;
    }
    const sorted = row.samples.slice().sort((a, b) => a - b);
    const buckets: PromptSizeBucket[] = edges.map((from, i) => ({
      from,
      to: i + 1 < edges.length ? edges[i + 1]! : null,
      rows: row.bucketCounts[i] ?? 0,
      share: row.rows === 0 ? 0 : (row.bucketCounts[i] ?? 0) / row.rows,
    }));
    models.push({
      model,
      rows: row.rows,
      totalInputTokens: row.totalInput,
      meanInputTokens: row.rows === 0 ? 0 : row.totalInput / row.rows,
      p95InputTokens: p95(sorted),
      maxInputTokens: row.maxInput,
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

  const overallBuckets: PromptSizeBucket[] = edges.map((from, i) => ({
    from,
    to: i + 1 < edges.length ? edges[i + 1]! : null,
    rows: overallBucketCounts[i] ?? 0,
    share: consideredRows === 0 ? 0 : (overallBucketCounts[i] ?? 0) / consideredRows,
  }));

  // Defensive: an empty report still exposes the empty buckets ladder
  // so renderers / JSON consumers never have to special-case it.
  if (consideredRows === 0 && overallBuckets.every((b) => b.rows === 0)) {
    // Already shaped correctly by emptyBuckets symmetry — this branch
    // is here only to make the contract explicit for future readers.
    void emptyBuckets; // suppress unused-warn while keeping the helper in scope
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRows,
    top,
    edges: edges.slice(),
    consideredRows,
    totalInputTokens: totalInput,
    overallMeanInputTokens: consideredRows === 0 ? 0 : totalInput / consideredRows,
    overallMaxInputTokens: overallMaxInput,
    droppedInvalidHourStart,
    droppedZeroInput,
    droppedInvalidTokens,
    droppedModelRows,
    droppedTopModels,
    overallBuckets,
    models: kept,
  };
}
