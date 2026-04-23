/**
 * Cost estimation.
 *
 * pew's queue.jsonl rows give us per-(source, model, hour) token counts
 * split into input / cached_input / output / reasoning_output. To turn
 * that into a $ estimate we need a per-model rate table priced in
 * USD per 1M tokens. Rates differ by token kind:
 *
 *   - input          : full prompt-token price
 *   - cached_input   : discounted prompt-token price (provider-side cache hit)
 *   - output         : completion-token price
 *   - reasoning      : reasoning-token price (often == output)
 *
 * Rates are a best-effort default snapshot; users override via a
 * config file (`~/.config/pew-insights/rates.json` by default, or
 * any path passed with `--rates`). Unknown models contribute zero
 * cost and are reported in `unknownModels` so the user can extend
 * the table.
 */
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { normaliseModel } from './parsers.js';
import type { QueueLine } from './types.js';

/** All rates are USD per 1,000,000 tokens. */
export interface ModelRate {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}

export type RateTable = Record<string, ModelRate>;

/**
 * Default per-model rate snapshot. These are illustrative defaults
 * for the canonical model names produced by `normaliseModel`. Users
 * can override entirely or per-model via a JSON file.
 *
 * NOTE: rates change frequently — treat as a starting point, not gospel.
 */
export const DEFAULT_RATES: RateTable = {
  'claude-opus-4.7':   { input: 15.00, cachedInput: 1.50, output: 75.00, reasoning: 75.00 },
  'claude-sonnet-4.6': { input:  3.00, cachedInput: 0.30, output: 15.00, reasoning: 15.00 },
  'gpt-5.4':           { input:  5.00, cachedInput: 0.50, output: 15.00, reasoning: 15.00 },
  'gpt-5.2':           { input:  2.50, cachedInput: 0.25, output:  7.50, reasoning:  7.50 },
  'gpt-5-nano':        { input:  0.20, cachedInput: 0.02, output:  0.80, reasoning:  0.80 },
};

export function defaultRatesPath(): string {
  return join(homedir(), '.config', 'pew-insights', 'rates.json');
}

/**
 * Load a rates table from disk. Returns `null` if the file does not
 * exist (caller decides whether to fall back to DEFAULT_RATES).
 * Throws on malformed JSON / wrong shape so misconfiguration is loud.
 */
export async function readRatesFile(path: string): Promise<RateTable | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`rates file ${path} must be a JSON object keyed by model name`);
  }
  const out: RateTable = {};
  for (const [model, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') {
      throw new Error(`rates entry for ${model} must be an object`);
    }
    const v = val as Record<string, unknown>;
    const rate: ModelRate = {
      input: Number(v.input ?? 0),
      cachedInput: Number(v.cachedInput ?? v.cached_input ?? 0),
      output: Number(v.output ?? 0),
      reasoning: Number(v.reasoning ?? v.output ?? 0),
    };
    for (const k of ['input', 'cachedInput', 'output', 'reasoning'] as const) {
      if (!Number.isFinite(rate[k]) || rate[k] < 0) {
        throw new Error(`rates entry for ${model}.${k} must be a non-negative number`);
      }
    }
    out[model] = rate;
  }
  return out;
}

/** Merge a user table over the defaults; user keys win. */
export function mergeRates(base: RateTable, override: RateTable | null): RateTable {
  if (!override) return { ...base };
  return { ...base, ...override };
}

// ---------------------------------------------------------------------------
// Cost computation
// ---------------------------------------------------------------------------

export interface CostBreakdown {
  model: string;
  events: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  /** input_tokens already excludes cached_input_tokens in pew's schema. */
  inputCost: number;
  cachedInputCost: number;
  outputCost: number;
  reasoningCost: number;
  totalCost: number;
  /** Per-1M-token blended rate computed against billable token sum. */
  blendedRatePerMillion: number;
}

export interface CostReport {
  since: string | null;
  totalCost: number;
  /** Naive what-if cost if every cached token had been charged at the full input rate. */
  totalCostNoCache: number;
  cacheSavings: number;
  rows: CostBreakdown[];
  unknownModels: Array<{ model: string; events: number; totalTokens: number }>;
}

function rateOrZero(rates: RateTable, model: string): ModelRate | null {
  return rates[model] ?? null;
}

/**
 * Compute estimated cost for a queue slice. Filters by `since` if set.
 * Each model gets its own row; unknown models are tracked separately
 * so the user can spot gaps in their rates table.
 */
export function computeCost(
  queue: QueueLine[],
  since: string | null,
  rates: RateTable,
): CostReport {
  const filtered = since ? queue.filter((q) => q.hour_start >= since) : queue;

  const perModel = new Map<string, CostBreakdown>();
  const unknown = new Map<string, { events: number; totalTokens: number }>();

  let totalCost = 0;
  let totalCostNoCache = 0;

  for (const q of filtered) {
    const model = normaliseModel(q.model);
    const rate = rateOrZero(rates, model);

    if (!rate) {
      const u = unknown.get(model) ?? { events: 0, totalTokens: 0 };
      u.events += 1;
      u.totalTokens += q.total_tokens || 0;
      unknown.set(model, u);
      continue;
    }

    let row = perModel.get(model);
    if (!row) {
      row = {
        model,
        events: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        inputCost: 0,
        cachedInputCost: 0,
        outputCost: 0,
        reasoningCost: 0,
        totalCost: 0,
        blendedRatePerMillion: 0,
      };
      perModel.set(model, row);
    }

    const inT = q.input_tokens || 0;
    const cachedT = q.cached_input_tokens || 0;
    const outT = q.output_tokens || 0;
    const reasonT = q.reasoning_output_tokens || 0;

    const inCost = (inT * rate.input) / 1_000_000;
    const cachedCost = (cachedT * rate.cachedInput) / 1_000_000;
    const outCost = (outT * rate.output) / 1_000_000;
    const reasonCost = (reasonT * rate.reasoning) / 1_000_000;

    row.events += 1;
    row.inputTokens += inT;
    row.cachedInputTokens += cachedT;
    row.outputTokens += outT;
    row.reasoningTokens += reasonT;
    row.inputCost += inCost;
    row.cachedInputCost += cachedCost;
    row.outputCost += outCost;
    row.reasoningCost += reasonCost;
    row.totalCost += inCost + cachedCost + outCost + reasonCost;

    totalCost += inCost + cachedCost + outCost + reasonCost;
    // What-if: cached charged at full input rate.
    totalCostNoCache += inCost + (cachedT * rate.input) / 1_000_000 + outCost + reasonCost;
  }

  // Finalise blended rate.
  for (const row of perModel.values()) {
    const billable = row.inputTokens + row.cachedInputTokens + row.outputTokens + row.reasoningTokens;
    row.blendedRatePerMillion = billable > 0 ? (row.totalCost / billable) * 1_000_000 : 0;
  }

  const rows = Array.from(perModel.values()).sort((a, b) => b.totalCost - a.totalCost);
  const unknownRows = Array.from(unknown.entries())
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    since,
    totalCost,
    totalCostNoCache,
    cacheSavings: Math.max(0, totalCostNoCache - totalCost),
    rows,
    unknownModels: unknownRows,
  };
}
