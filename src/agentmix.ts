/**
 * Agent-mix concentration analysis: how is your token spend
 * distributed across the agents (or models, or kinds) you actually
 * use, and is one of them dominating?
 *
 * The existing builders all answer adjacent but different
 * questions:
 *
 *   - `sources` is a *pivot* (source × model totals). It hands you
 *     the raw matrix and lets you read the shape yourself.
 *   - `digest` aggregates by source/model/day but never reduces to
 *     a single concentration number.
 *   - `compare` does A/B between two windows, not a within-window
 *     distribution shape.
 *   - `top-projects` ranks projects, not agents.
 *
 * `agent-mix` collapses the window down to *one row per group*
 * (group = source | model | kind), reports each group's share of
 * the window's total tokens, and emits two concentration scalars:
 *
 *   - **HHI** (Herfindahl–Hirschman Index) = Σ sᵢ² over the group
 *     shares sᵢ ∈ [0, 1]. HHI ∈ [1/n, 1]. 1 means a single group
 *     owns 100% of the spend; 1/n means perfectly uniform across
 *     n groups. Standard antitrust concentration metric, useful
 *     here because it is monotone in dominance and bounded.
 *   - **Gini coefficient** ∈ [0, 1]. 0 means perfectly equal
 *     (every group identical); → 1 means a single group dominates.
 *     Computed via the trapezoid Lorenz-curve formula:
 *
 *         G = 1 − (1/n) Σ_{k=1..n} (Lₖ + Lₖ₋₁)
 *
 *     where Lₖ is the cumulative share of the k smallest groups.
 *
 * HHI and Gini answer slightly different questions: HHI is
 * dominated by the largest few squared shares (sensitive to a
 * single mega-source), Gini is more sensitive to the *shape*
 * across the long tail. Reporting both is cheap and the operator
 * can pick whichever framing fits.
 *
 * Determinism: pure builder. Sort is fully specified
 * (`tokens desc, group asc`). Empty group string gets bucketed as
 * `'unknown'`. No `Date.now()` reads.
 */
import type { QueueLine } from './types.js';

export type AgentMixDimension = 'source' | 'model' | 'kind';

export type AgentMixMetric = 'total' | 'input' | 'output' | 'cached';

export interface AgentMixOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Grouping dimension. Default 'source'. */
  by?: AgentMixDimension;
  /**
   * Which token field to attribute and concentrate on. Default
   * 'total'. `input` and `output` separate the producer/consumer
   * sides — a source can dominate input (lots of context) without
   * dominating output (lots of generated text), and vice versa.
   * `cached` surfaces who is actually benefiting from cache hits.
   */
  metric?: AgentMixMetric;
  /** Cap rows shown in `topGroups`. Default 10. Must be a positive integer. */
  topN?: number;
  /**
   * Drop groups whose token total < `minTokens` from the surfaced
   * `topGroups[]`. The window-wide totals, HHI, Gini, and
   * `groupCount` are unaffected — this is a *display* filter so
   * the operator can hide noise. Default 0 = no filter.
   */
  minTokens?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface AgentMixGroup {
  group: string;
  /** Sum of total_tokens attributed to this group. */
  tokens: number;
  /** Number of QueueLine rows that contributed. */
  events: number;
  /** Number of distinct hour buckets this group appeared in. */
  activeHours: number;
  /** tokens / windowTotalTokens. 0 when window total is 0. */
  share: number;
}

export interface AgentMixReport {
  generatedAt: string;
  /** Inclusive ISO start of the window. null = unbounded. */
  windowStart: string | null;
  /** Exclusive ISO end of the window. null = unbounded. */
  windowEnd: string | null;
  by: AgentMixDimension;
  metric: AgentMixMetric;
  topN: number;
  /** As-supplied minTokens display filter (0 = no filter). */
  minTokens: number;
  /** QueueLine rows considered after `since/until` filtering. */
  consideredEvents: number;
  /** Sum of total_tokens across the considered window. */
  totalTokens: number;
  /** Distinct non-empty groups observed in the window. */
  groupCount: number;
  /**
   * Herfindahl–Hirschman Index Σ sᵢ². 0 when there are no tokens.
   * Bounded in [1/groupCount, 1] when groupCount > 0.
   */
  hhi: number;
  /**
   * Gini coefficient on the per-group token totals. 0 when there
   * are 0 or 1 groups (no inequality is definable). Bounded
   * in [0, 1−1/n].
   */
  gini: number;
  /**
   * Cumulative share of the top `groupCount/2` (rounded up)
   * largest groups. A handy "is half my workload concentrated in
   * a tiny minority?" scalar that sits between HHI's
   * concentration squashing and Gini's whole-curve summary. 0
   * when there are no tokens.
   */
  topHalfShare: number;
  /** Top-N rows by tokens desc, ties broken by group asc. */
  topGroups: AgentMixGroup[];
}

interface Bucket {
  tokens: number;
  events: number;
  hours: Set<string>;
}

function pickGroup(q: QueueLine, by: AgentMixDimension): string {
  if (by === 'source') {
    return typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
  }
  if (by === 'model') {
    return typeof q.model === 'string' && q.model.length > 0 ? q.model : 'unknown';
  }
  // kind: QueueLine has no `kind` field directly. The closest
  // semantic is the source's role (human vs agent). We leave kind
  // bucketed as `unknown` in queue-only mode and rely on the
  // dimension being primarily useful via session_queue downstream;
  // for now we synthesise 'agent' for any source containing 'code'
  // or 'claw' style tokens and 'human' otherwise. This keeps the
  // API symmetric with `transitions` / `sessions` without
  // requiring a join. Operators wanting strict kind buckets can
  // use `sessions --by kind` instead.
  const src = q.source ?? '';
  if (src.length === 0) return 'unknown';
  // Heuristic-free fallback: just key on source so the dimension
  // is at least deterministic. Document this in the README at
  // bump time.
  return src;
}

function pickMetric(q: QueueLine, metric: AgentMixMetric): number {
  switch (metric) {
    case 'input':
      return q.input_tokens || 0;
    case 'output':
      return q.output_tokens || 0;
    case 'cached':
      return q.cached_input_tokens || 0;
    case 'total':
    default:
      return q.total_tokens || 0;
  }
}

function median(_sorted: number[]): number {
  // unused; kept for symmetry with neighbouring builders. Removed
  // intentionally — we don't report a median here.
  return 0;
}
void median;

export function buildAgentMix(queue: QueueLine[], opts: AgentMixOptions = {}): AgentMixReport {
  const topN = opts.topN ?? 10;
  if (!Number.isInteger(topN) || topN < 1) {
    throw new Error(`topN must be a positive integer (got ${opts.topN})`);
  }
  const by: AgentMixDimension = opts.by ?? 'source';
  if (by !== 'source' && by !== 'model' && by !== 'kind') {
    throw new Error(`by must be 'source' | 'model' | 'kind' (got ${String(opts.by)})`);
  }
  const metric: AgentMixMetric = opts.metric ?? 'total';
  if (metric !== 'total' && metric !== 'input' && metric !== 'output' && metric !== 'cached') {
    throw new Error(`metric must be 'total' | 'input' | 'output' | 'cached' (got ${String(opts.metric)})`);
  }
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative finite number (got ${opts.minTokens})`);
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

  const buckets = new Map<string, Bucket>();
  let consideredEvents = 0;
  let totalTokens = 0;

  for (const q of queue) {
    const startMs = Date.parse(q.hour_start);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    consideredEvents += 1;
    const tk = pickMetric(q, metric);
    totalTokens += tk;

    const g = pickGroup(q, by);
    let b = buckets.get(g);
    if (!b) {
      b = { tokens: 0, events: 0, hours: new Set() };
      buckets.set(g, b);
    }
    b.tokens += tk;
    b.events += 1;
    b.hours.add(q.hour_start);
  }

  // Build group rows with shares.
  const allGroups: AgentMixGroup[] = [];
  for (const [g, b] of buckets) {
    allGroups.push({
      group: g,
      tokens: b.tokens,
      events: b.events,
      activeHours: b.hours.size,
      share: totalTokens === 0 ? 0 : b.tokens / totalTokens,
    });
  }
  // Deterministic order: tokens desc, group asc.
  allGroups.sort((a, b) => {
    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
    return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
  });

  // Concentration metrics. Use only groups with >0 tokens — a
  // group with 0 tokens (impossible here since we skip <0, but
  // defensive) would otherwise spuriously inflate Gini.
  const positive = allGroups.filter((g) => g.tokens > 0);
  const n = positive.length;

  let hhi = 0;
  for (const g of positive) hhi += g.share * g.share;

  let gini = 0;
  if (n >= 2 && totalTokens > 0) {
    // Sort ascending for the Lorenz curve.
    const asc = [...positive].sort((a, b) => a.tokens - b.tokens);
    let cumShare = 0;
    let prevCum = 0;
    let trapezoidSum = 0;
    for (let i = 0; i < n; i++) {
      cumShare += asc[i]!.share;
      trapezoidSum += cumShare + prevCum;
      prevCum = cumShare;
    }
    gini = Math.max(0, 1 - trapezoidSum / n);
  }

  let topHalfShare = 0;
  if (n >= 1 && totalTokens > 0) {
    const half = Math.max(1, Math.ceil(n / 2));
    // allGroups is already tokens desc. Top half = first `half` rows.
    let acc = 0;
    for (let i = 0; i < half; i++) acc += allGroups[i]!.share;
    topHalfShare = acc;
  }

  // Apply display filter.
  let displayGroups = allGroups;
  if (minTokens > 0) displayGroups = displayGroups.filter((g) => g.tokens >= minTokens);
  const topGroups = displayGroups.slice(0, topN);

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    metric,
    topN,
    minTokens,
    consideredEvents,
    totalTokens,
    groupCount: n,
    hhi,
    gini,
    topHalfShare,
    topGroups,
  };
}
