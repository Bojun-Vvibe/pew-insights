/**
 * model-cohabitation: which models share the same `hour_start`
 * bucket. For every UTC hour bucket present in the queue, list the
 * distinct (normalised) models active inside it, then aggregate
 * unordered model *pairs* across all buckets.
 *
 * Why a separate subcommand:
 *
 *   - `model-switching` looks at sequential fallback *inside one
 *     session_key* — A→B→A transitions on the SessionLine table.
 *     Cohabitation is bucket-parallel, not session-sequential, and
 *     uses the QueueLine table; it surfaces the case "two different
 *     producers (or one producer routed two ways) are using two
 *     different models in the same wall-clock hour", which is
 *     invisible to model-switching when the session keys differ.
 *   - `model-mix-entropy` answers "how diverse is each *source's*
 *     fleet" — it's a per-source population statistic, never
 *     pairwise, and never time-bucketed.
 *   - `agent-mix` and `provider-share` are pure mass tallies with no
 *     notion of co-occurrence at all.
 *
 * Concretely, for each UTC `hour_start` bucket we:
 *   1. Collect the set of distinct normalised models active in that
 *      bucket (token mass > 0).
 *   2. For every unordered pair (A,B) with A < B (lex), increment
 *      `coBuckets[A,B]` by 1 and `coTokens[A,B]` by the minimum of
 *      the two models' token mass in that bucket (the "shared
 *      capacity" lower bound — a Jaccard-flavoured weight that
 *      prevents one giant model from dominating every pair it
 *      touches).
 *   3. Per model A track `bucketsActive[A]` (distinct buckets where
 *      A appeared) and `tokens[A]` (total token mass).
 *
 * Reported per pair:
 *   - `coBuckets`: number of UTC hour buckets where both appeared
 *   - `coTokens`: sum over those buckets of min(tokensA, tokensB)
 *   - `cohabIndex`: coBuckets / (bucketsActive[A] + bucketsActive[B] - coBuckets)
 *     — Jaccard on bucket-presence sets in [0,1]. 1 = perfect
 *     cohabitants (only ever appear together), 0 = never co-occur.
 *   - `coShareA`: coBuckets / bucketsActive[A] (asymmetric "P(B|A)")
 *   - `coShareB`: coBuckets / bucketsActive[B]
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Pair ordering on output: coBuckets desc, then coTokens desc, then
 * (modelA asc, modelB asc).
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface ModelCohabitationOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop pairs whose `coBuckets < minCoBuckets` from `pairs[]`.
   * Display filter only — `totalPairs` reflects the full population.
   * Default 0.
   */
  minCoBuckets?: number;
  /**
   * Truncate `pairs[]` to the top N by `coBuckets` (then `coTokens`,
   * then lex). Display filter only. Default 0 = no cap.
   */
  top?: number;
  /**
   * If non-null, restrict the analysis to a single source. All
   * non-matching rows surface as `droppedSourceFilter`. Models
   * still co-habit at the bucket level — within the filtered rows.
   * Default null.
   */
  source?: string | null;
  /**
   * If non-null, hide pair rows that do not include this model
   * (after `normaliseModel`). Display filter only — every other
   * top-level number (totals, models[]) is byte-identical to the
   * unfiltered run. Counts surface as `droppedByModelFilter`.
   * Default null.
   */
  byModel?: string | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ModelCohabitationModelRow {
  model: string;
  /** Distinct hour buckets in which this model had token mass > 0. */
  bucketsActive: number;
  /** Total token mass attributed to this model across all kept rows. */
  tokens: number;
  /**
   * Number of distinct *other* models this model ever shared a
   * bucket with. 0 means this model is always alone in its hour.
   */
  distinctCohabitants: number;
}

export interface ModelCohabitationPairRow {
  modelA: string;
  modelB: string;
  /** Distinct UTC hour buckets where both A and B had tokens > 0. */
  coBuckets: number;
  /** Sum over co-buckets of min(tokensA_in_bucket, tokensB_in_bucket). */
  coTokens: number;
  /**
   * Jaccard on bucket-presence: coBuckets / (|A| + |B| - coBuckets).
   * In [0,1]. 1 = perfect cohabitants.
   */
  cohabIndex: number;
  /** coBuckets / bucketsActive[A]. P(B present | A present). */
  coShareA: number;
  /** coBuckets / bucketsActive[B]. P(A present | B present). */
  coShareB: number;
}

export interface ModelCohabitationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minCoBuckets: number;
  top: number;
  source: string | null;
  /** Echo of the resolved byModel filter (post `normaliseModel`). */
  byModel: string | null;
  /** Distinct hour buckets observed across kept rows. */
  totalBuckets: number;
  /**
   * Buckets containing >= 2 distinct models (where pairs can form).
   */
  multiModelBuckets: number;
  /** Distinct models observed across kept rows. */
  totalModels: number;
  /** Total unique unordered pairs observed before display filters. */
  totalPairs: number;
  /** Sum of total_tokens across kept rows. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Pair rows hidden by `minCoBuckets`. */
  droppedMinCoBuckets: number;
  /** Pair rows hidden by the `byModel` filter. */
  droppedByModelFilter: number;
  /** Pair rows hidden by the `top` cap. */
  droppedTopPairs: number;
  /** Per-model summary, sorted by tokens desc, then model asc. */
  models: ModelCohabitationModelRow[];
  /** Per-pair report, sorted by coBuckets desc, then coTokens desc, then lex. */
  pairs: ModelCohabitationPairRow[];
}

export function buildModelCohabitation(
  queue: QueueLine[],
  opts: ModelCohabitationOptions = {},
): ModelCohabitationReport {
  const minCoBuckets = opts.minCoBuckets ?? 0;
  if (!Number.isInteger(minCoBuckets) || minCoBuckets < 0) {
    throw new Error(
      `minCoBuckets must be a non-negative integer (got ${opts.minCoBuckets})`,
    );
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

  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;
  const byModelFilter =
    opts.byModel != null && opts.byModel !== ''
      ? normaliseModel(opts.byModel)
      : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // bucket -> model -> tokens-in-bucket
  const buckets = new Map<string, Map<string, number>>();
  // model -> tokens (across kept rows)
  const modelTokens = new Map<string, number>();
  let totalTokens = 0;
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
    const bucketKey = q.hour_start;
    let perModel = buckets.get(bucketKey);
    if (!perModel) {
      perModel = new Map<string, number>();
      buckets.set(bucketKey, perModel);
    }
    perModel.set(model, (perModel.get(model) ?? 0) + tt);
    modelTokens.set(model, (modelTokens.get(model) ?? 0) + tt);
    totalTokens += tt;
  }

  // Per-model bucket presence + cohabitants set.
  const modelBuckets = new Map<string, number>();
  const modelCohabitants = new Map<string, Set<string>>();
  // pairKey "A||B" with A<B -> { coBuckets, coTokens }
  const pairAgg = new Map<string, { a: string; b: string; co: number; coTok: number }>();
  let multiModelBuckets = 0;

  for (const perModel of buckets.values()) {
    const models = Array.from(perModel.keys());
    for (const m of models) {
      modelBuckets.set(m, (modelBuckets.get(m) ?? 0) + 1);
    }
    if (models.length < 2) continue;
    multiModelBuckets += 1;
    models.sort();
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const a = models[i] as string;
        const b = models[j] as string;
        const key = `${a}\u0001${b}`;
        const ta = perModel.get(a) ?? 0;
        const tb = perModel.get(b) ?? 0;
        const w = ta < tb ? ta : tb;
        const cur = pairAgg.get(key);
        if (!cur) {
          pairAgg.set(key, { a, b, co: 1, coTok: w });
        } else {
          cur.co += 1;
          cur.coTok += w;
        }
        let sa = modelCohabitants.get(a);
        if (!sa) {
          sa = new Set<string>();
          modelCohabitants.set(a, sa);
        }
        sa.add(b);
        let sb = modelCohabitants.get(b);
        if (!sb) {
          sb = new Set<string>();
          modelCohabitants.set(b, sb);
        }
        sb.add(a);
      }
    }
  }

  // Build pair rows.
  const allPairs: ModelCohabitationPairRow[] = [];
  for (const p of pairAgg.values()) {
    const ba = modelBuckets.get(p.a) ?? 0;
    const bb = modelBuckets.get(p.b) ?? 0;
    const denom = ba + bb - p.co;
    const cohabIndex = denom > 0 ? p.co / denom : 0;
    allPairs.push({
      modelA: p.a,
      modelB: p.b,
      coBuckets: p.co,
      coTokens: p.coTok,
      cohabIndex,
      coShareA: ba > 0 ? p.co / ba : 0,
      coShareB: bb > 0 ? p.co / bb : 0,
    });
  }
  const totalPairs = allPairs.length;

  // Apply minCoBuckets.
  let droppedMinCoBuckets = 0;
  const afterMin: ModelCohabitationPairRow[] = [];
  for (const row of allPairs) {
    if (row.coBuckets < minCoBuckets) {
      droppedMinCoBuckets += 1;
      continue;
    }
    afterMin.push(row);
  }

  // Apply byModel filter.
  let droppedByModelFilter = 0;
  let afterByModel = afterMin;
  if (byModelFilter !== null) {
    const next: ModelCohabitationPairRow[] = [];
    for (const row of afterMin) {
      if (row.modelA === byModelFilter || row.modelB === byModelFilter) {
        next.push(row);
      } else {
        droppedByModelFilter += 1;
      }
    }
    afterByModel = next;
  }
  afterByModel.sort((x, y) => {
    if (y.coBuckets !== x.coBuckets) return y.coBuckets - x.coBuckets;
    if (y.coTokens !== x.coTokens) return y.coTokens - x.coTokens;
    if (x.modelA !== y.modelA) return x.modelA < y.modelA ? -1 : 1;
    return x.modelB < y.modelB ? -1 : x.modelB > y.modelB ? 1 : 0;
  });

  let droppedTopPairs = 0;
  let keptPairs = afterByModel;
  if (top > 0 && afterByModel.length > top) {
    droppedTopPairs = afterByModel.length - top;
    keptPairs = afterByModel.slice(0, top);
  }

  // Build per-model summary.
  const modelRows: ModelCohabitationModelRow[] = [];
  for (const [m, tok] of modelTokens.entries()) {
    modelRows.push({
      model: m,
      bucketsActive: modelBuckets.get(m) ?? 0,
      tokens: tok,
      distinctCohabitants: modelCohabitants.get(m)?.size ?? 0,
    });
  }
  modelRows.sort((a, b) => {
    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minCoBuckets,
    top,
    source: sourceFilter,
    byModel: byModelFilter,
    totalBuckets: buckets.size,
    multiModelBuckets,
    totalModels: modelTokens.size,
    totalPairs,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedMinCoBuckets,
    droppedByModelFilter,
    droppedTopPairs,
    models: modelRows,
    pairs: keptPairs,
  };
}
