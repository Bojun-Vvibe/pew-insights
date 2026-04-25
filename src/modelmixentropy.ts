/**
 * model-mix-entropy: Shannon entropy of model usage per source.
 *
 * Each `QueueLine` carries a `source` (the local producer CLI:
 * codex, claude-code, gemini-cli, opencode, ...) and a `model`
 * (the upstream model id the producer ended up calling). For each
 * source we ask:
 *
 *   How concentrated is this producer's model usage?
 *   Is it a *mono-model* client (always the same model — entropy ≈ 0)
 *   or a *poly-model* client (spreads token mass across many
 *   models — entropy → log2(k))?
 *
 * Answered as Shannon entropy `H = -Σ p_i log2 p_i` over the per-model
 * share of `total_tokens` for that source. We also emit:
 *
 *   - `maxEntropy = log2(distinctModels)` — the theoretical ceiling
 *     given the same number of models but a perfectly even split
 *   - `normalizedEntropy = H / maxEntropy` in [0,1] (0 when only one
 *     model; defined as 0 when distinctModels ≤ 1)
 *   - `effectiveModels = 2^H` — the "perplexity" of the mix; reads as
 *     "this source behaves like it's using ~N evenly-weighted models"
 *   - `topModelShare` — the share of the most-used model
 *
 * Distinct lens vs the existing reports:
 *
 *   - `provider-share` shows token *mass* per source but never asks
 *     how diverse each source's model fleet is.
 *   - `model-switching` looks at *transitions* between adjacent calls,
 *     a sequential signal. Entropy is a population-level diversity
 *     signal — orthogonal.
 *   - `agent-mix` and `device-share` slice by other axes entirely.
 *   - `output-input-ratio --by-source` measures verbosity, not mix
 *     concentration.
 *
 * Use case: spot the source that is "wasting" a multi-model setup by
 * pinning to a single model, vs. the source that is genuinely
 * load-balancing. Inverse use case: spot the source that is
 * *thrashing* across many models when one would do.
 *
 * Determinism: pure builder. No `Date.now()` reads beyond the
 * fallback for `generatedAt`. All sorts fully specified.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface ModelMixEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop source rows whose total token count is `< minTokens` from
   * `sources[]`. Display filter only — global denominators reflect
   * the full population. Default 0 (keep every source).
   */
  minTokens?: number;
  /**
   * If > 0, also include the top K models for each source on the
   * row's `topModels` array (sorted by tokens desc, then name asc).
   * Display only — entropy / effectiveModels / topModelShare are
   * byte-identical to the un-flagged run; only the new array is
   * populated. Default 0 (no per-model breakdown).
   */
  topK?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ModelMixModelEntry {
  model: string;
  tokens: number;
  /** tokens / source.totalTokens in [0,1]. */
  share: number;
}

export interface ModelMixEntropyRow {
  source: string;
  /** Sum of total_tokens for this source across the window. */
  totalTokens: number;
  /** Number of QueueLine rows attributed to this source. */
  rows: number;
  /** Distinct normalised model strings observed for this source. */
  distinctModels: number;
  /**
   * Shannon entropy in bits over per-model share of total_tokens.
   * 0 when distinctModels ≤ 1.
   */
  entropyBits: number;
  /**
   * log2(distinctModels). 0 when distinctModels ≤ 1.
   */
  maxEntropyBits: number;
  /**
   * entropyBits / maxEntropyBits in [0,1]. 0 when distinctModels ≤ 1.
   * Reads as "how close to a perfectly-even mix is this source?".
   */
  normalizedEntropy: number;
  /**
   * 2^entropyBits — the effective number of evenly-weighted models
   * this source behaves like. 1 when distinctModels = 1.
   */
  effectiveModels: number;
  /** Token share of this source's most-used model in [0,1]. */
  topModelShare: number;
  /** Normalised id of the most-used model for this source. */
  topModel: string;
  /**
   * Top-K models for this source by token mass, when `topK > 0`.
   * Sorted by tokens desc, then model asc. Empty array when topK=0.
   */
  topModels: ModelMixModelEntry[];
}

export interface ModelMixEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minTokens. */
  minTokens: number;
  /** Echo of resolved topK. */
  topK: number;
  /** Sum of total_tokens across all considered rows. */
  totalTokens: number;
  /** Distinct sources observed before display filters. */
  totalSources: number;
  /** Rows where hour_start did not parse as ISO. */
  droppedInvalidHourStart: number;
  /** Rows with non-finite or non-positive total_tokens. */
  droppedZeroTokens: number;
  /** Source rows hidden by the minTokens floor. */
  droppedMinTokens: number;
  /**
   * One row per kept source. Sorted by totalTokens desc, then
   * source asc on tie.
   */
  sources: ModelMixEntropyRow[];
}

export function buildModelMixEntropy(
  queue: QueueLine[],
  opts: ModelMixEntropyOptions = {},
): ModelMixEntropyReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative number (got ${opts.minTokens})`);
  }
  const topK = opts.topK ?? 0;
  if (!Number.isInteger(topK) || topK < 0) {
    throw new Error(`topK must be a non-negative integer (got ${opts.topK})`);
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

  interface Acc {
    source: string;
    total: number;
    rows: number;
    /** model -> token sum */
    models: Map<string, number>;
  }

  const agg = new Map<string, Acc>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let globalTotal = 0;

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

    const src =
      typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');

    let a = agg.get(src);
    if (!a) {
      a = { source: src, total: 0, rows: 0, models: new Map() };
      agg.set(src, a);
    }
    a.total += tt;
    a.rows += 1;
    a.models.set(model, (a.models.get(model) ?? 0) + tt);
    globalTotal += tt;
  }

  const totalSources = agg.size;
  const all: ModelMixEntropyRow[] = [];
  for (const a of agg.values()) {
    const distinctModels = a.models.size;
    let entropy = 0;
    let topShare = 0;
    let topModel = '';
    if (a.total > 0) {
      // Sort models by tokens desc, then name asc — stable top-model
      // pick when two models tie on token mass.
      const entries = Array.from(a.models.entries()).sort((x, y) => {
        if (y[1] !== x[1]) return y[1] - x[1];
        return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
      });
      for (const [, tokens] of entries) {
        if (tokens <= 0) continue;
        const p = tokens / a.total;
        entropy += -p * Math.log2(p);
      }
      const top = entries[0]!;
      topModel = top[0];
      topShare = top[1] / a.total;
    }
    const maxEntropy = distinctModels > 1 ? Math.log2(distinctModels) : 0;
    const normalized =
      distinctModels > 1 && maxEntropy > 0 ? entropy / maxEntropy : 0;
    const effective = distinctModels > 0 ? Math.pow(2, entropy) : 0;

    const topModels: ModelMixModelEntry[] = [];
    if (topK > 0 && a.total > 0) {
      const sorted = Array.from(a.models.entries()).sort((x, y) => {
        if (y[1] !== x[1]) return y[1] - x[1];
        return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
      });
      for (const [m, t] of sorted.slice(0, topK)) {
        topModels.push({ model: m, tokens: t, share: t / a.total });
      }
    }

    all.push({
      source: a.source,
      totalTokens: a.total,
      rows: a.rows,
      distinctModels,
      entropyBits: entropy,
      maxEntropyBits: maxEntropy,
      normalizedEntropy: normalized,
      effectiveModels: effective,
      topModelShare: topShare,
      topModel,
      topModels,
    });
  }

  let droppedMinTokens = 0;
  const kept: ModelMixEntropyRow[] = [];
  for (const row of all) {
    if (row.totalTokens < minTokens) {
      droppedMinTokens += 1;
      continue;
    }
    kept.push(row);
  }
  kept.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    topK,
    totalTokens: globalTotal,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedMinTokens,
    sources: kept,
  };
}
