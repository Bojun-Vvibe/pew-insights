/**
 * Model-switching analysis: identifies sessions whose `session_key`
 * spans more than one `model` value across snapshots, and quantifies
 * how often the operator (or pew runtime) hops between models inside
 * one logical session.
 *
 * Why a separate subcommand:
 *
 *   - `agent-mix` reports concentration of model usage *across*
 *     sessions (which model gets the most sessions overall) but
 *     never looks *inside* a session_key. Two corpora with
 *     identical agent-mix can have wildly different intra-session
 *     switching behaviour.
 *   - `transitions` looks at adjacency between *distinct* sessions,
 *     not at the model identity inside a single session.
 *   - `sources` is a source × model pivot — it cannot detect that
 *     `claude:abc-123` was first served by claude-opus-4.7 and then
 *     re-snapshotted under claude-sonnet-4.5; it just counts both
 *     model-rows independently.
 *
 * Switching matters because it surfaces:
 *
 *   1. Operator-driven model fallback ("opus rate-limited me, fell
 *      back to sonnet mid-session").
 *   2. Routing changes by the host (LiteLLM / Hermes flipping the
 *      backing model under the same logical session).
 *   3. Cost-attribution ambiguity — when a single session spans
 *      $/1k token rates across models, naive per-session cost
 *      reports become approximate; this command quantifies how
 *      much of the corpus is affected.
 *
 * What we emit:
 *
 *   - `consideredSessions` — distinct `session_key` values matched
 *     by the window (deduplicated across snapshots).
 *   - `switchedSessions` — distinct keys whose snapshots span ≥2
 *     distinct models; `switchedShare = switchedSessions /
 *     consideredSessions`.
 *   - Per-key `switchCount` distribution: empirical histogram of
 *     "how many distinct models this session touched", with
 *     1, 2, 3, 4+ buckets and quantile waypoints (p50/p90/p99/max
 *     using nearest-rank, matching the rest of the codebase).
 *   - `topTransitions` — directed (from_model → to_model) pair
 *     counts derived from snapshot order within each session_key.
 *     "Order" is `snapshot_at` ascending, with `started_at` as a
 *     deterministic tiebreaker. Capped to the top N pairs (default
 *     10) by count, then by `from_model`, then `to_model` for a
 *     stable, lexicographic tiebreaker.
 *   - Per-source breakdown of switchedShare when `--by source`,
 *     so the operator can spot which integration (claude-code vs
 *     opencode vs codex) is doing the switching.
 *
 * Window semantics: filter by `started_at` (matching the rest of
 * the session-level subcommands). A session_key is considered "in
 * the window" if *any* of its snapshots fall in the window — this
 * preserves the property that `switchedShare` describes the
 * operator's experience, not the snapshot-truncation behaviour of
 * the queue.
 *
 * Determinism: pure builder. Map iteration order is preserved by
 * Map insertion order, but every output array is explicitly sorted
 * with a total-order comparator so JSON output is byte-stable
 * across runs given the same input.
 */
import type { SessionLine } from './types.js';

export type ModelSwitchingDimension = 'all' | 'source';

export interface ModelSwitchingOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /** Split dimension. Default 'all'. */
  by?: ModelSwitchingDimension;
  /**
   * Maximum number of (from → to) transition pairs to emit in
   * `topTransitions`. Must be a positive integer. Default 10.
   * Pairs beyond the top-N are summarised in `otherTransitions`.
   */
  top?: number;
  /**
   * Minimum number of distinct models a session must have touched
   * to be classified as "switched" and to contribute to
   * `topTransitions`. Must be an integer ≥ 2. Default 2 (any
   * change of model). Set to 3+ to focus on heavier switching
   * (sessions that touched at least three different models),
   * which is useful when chasing routing instability vs ordinary
   * 2-model fallback.
   *
   * Sessions with `distinctModels < minSwitches` are still
   * counted in `consideredSessions` and in the
   * `distinctModelCountBuckets` histogram (so the operator can
   * see the full population), but contribute zero to
   * `switchedSessions`, `totalTransitions`, and the transitions
   * table.
   */
  minSwitches?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ModelSwitchingTransition {
  from: string;
  to: string;
  count: number;
  /** count / totalTransitions in the considered population. 0 when none. */
  share: number;
}

export interface ModelSwitchingDistribution {
  group: string;
  consideredSessions: number;
  switchedSessions: number;
  switchedShare: number;
  /** Sum of distinct-model-counts across switched sessions − switchedSessions; i.e. extra hops beyond the first model. */
  totalTransitions: number;
  /** Mean distinct models per *switched* session (≥2). 0 when none. */
  meanModelsPerSwitchedSession: number;
  /** p50 / p90 / p99 / max of distinct-model-count across ALL considered sessions (not just switched). */
  p50DistinctModels: number;
  p90DistinctModels: number;
  p99DistinctModels: number;
  maxDistinctModels: number;
  /**
   * Histogram of distinct-model-count per session. Keys are
   * '1', '2', '3', '4+'. Always present in this fixed order so
   * downstream consumers can assume the schema.
   */
  distinctModelCountBuckets: { label: '1' | '2' | '3' | '4+'; count: number; share: number }[];
}

export interface ModelSwitchingReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  by: ModelSwitchingDimension;
  top: number;
  /** Echo of the resolved minSwitches (always ≥ 2). */
  minSwitches: number;
  /** Sessions matched by window (distinct session_key, post-dedup). */
  consideredSessions: number;
  /** Distinct session_keys with ≥ minSwitches distinct model values. */
  switchedSessions: number;
  /** switchedSessions / consideredSessions. 0 when consideredSessions == 0. */
  switchedShare: number;
  /** Distinct (from,to) pairs observed across all qualifying switched sessions. */
  uniqueTransitionPairs: number;
  /** Total directed transitions counted (sum over qualifying sessions of (seq_len − 1)). */
  totalTransitions: number;
  /** Top-N (from,to) pairs by count. Length ≤ `top`. */
  topTransitions: ModelSwitchingTransition[];
  /** Sum of counts of pairs that fell outside the top-N. 0 when uniqueTransitionPairs ≤ top. */
  otherTransitionsCount: number;
  /**
   * One row per group when `by == 'source'` (sorted by
   * consideredSessions desc, then group asc). Length 1 with group
   * `'all'` when `by == 'all'`.
   */
  distributions: ModelSwitchingDistribution[];
}

interface PerKey {
  source: string;
  /** Snapshots in stable order (snapshot_at asc, started_at asc tiebreaker). */
  snapshots: { model: string; snapshot_at: string; started_at: string }[];
}

function pickGroup(source: string, by: ModelSwitchingDimension): string {
  if (by === 'all') return 'all';
  return source.length > 0 ? source : 'unknown';
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

/**
 * Reduce a session_key's snapshots to its ordered sequence of
 * *distinct consecutive* models. Repeated identical models in a
 * row collapse to one entry — we count *transitions*, not snapshot
 * counts. Order is `snapshot_at` ascending, `started_at` ascending
 * as a deterministic tiebreaker.
 */
function distinctConsecutiveModels(pk: PerKey): string[] {
  const sorted = [...pk.snapshots].sort((a, b) => {
    if (a.snapshot_at < b.snapshot_at) return -1;
    if (a.snapshot_at > b.snapshot_at) return 1;
    if (a.started_at < b.started_at) return -1;
    if (a.started_at > b.started_at) return 1;
    if (a.model < b.model) return -1;
    if (a.model > b.model) return 1;
    return 0;
  });
  const out: string[] = [];
  for (const s of sorted) {
    if (out.length === 0 || out[out.length - 1] !== s.model) out.push(s.model);
  }
  return out;
}

function buildDistribution(
  group: string,
  perKey: PerKey[],
  minSwitches: number,
): ModelSwitchingDistribution {
  const distinctCounts: number[] = [];
  let switchedSessions = 0;
  let totalTransitions = 0;
  let totalDistinctModelHops = 0;
  for (const pk of perKey) {
    const distinct = new Set(pk.snapshots.map((s) => s.model)).size;
    distinctCounts.push(distinct);
    if (distinct >= minSwitches) {
      switchedSessions += 1;
      totalDistinctModelHops += distinct - 1;
      // Directed hops, counting back-and-forth toggling, computed
      // from the snapshot-ordered distinct-consecutive sequence.
      const seq = distinctConsecutiveModels(pk);
      totalTransitions += Math.max(0, seq.length - 1);
    }
  }
  const sortedAsc = [...distinctCounts].sort((a, b) => a - b);
  const considered = perKey.length;

  const buckets: ModelSwitchingDistribution['distinctModelCountBuckets'] = [
    { label: '1', count: 0, share: 0 },
    { label: '2', count: 0, share: 0 },
    { label: '3', count: 0, share: 0 },
    { label: '4+', count: 0, share: 0 },
  ];
  for (const c of distinctCounts) {
    if (c <= 1) buckets[0]!.count += 1;
    else if (c === 2) buckets[1]!.count += 1;
    else if (c === 3) buckets[2]!.count += 1;
    else buckets[3]!.count += 1;
  }
  for (const b of buckets) b.share = considered === 0 ? 0 : b.count / considered;

  return {
    group,
    consideredSessions: considered,
    switchedSessions,
    switchedShare: considered === 0 ? 0 : switchedSessions / considered,
    totalTransitions,
    meanModelsPerSwitchedSession:
      switchedSessions === 0
        ? 0
        : (totalDistinctModelHops + switchedSessions) / switchedSessions,
    p50DistinctModels: nearestRank(sortedAsc, 0.5),
    p90DistinctModels: nearestRank(sortedAsc, 0.9),
    p99DistinctModels: nearestRank(sortedAsc, 0.99),
    maxDistinctModels: sortedAsc.length === 0 ? 0 : sortedAsc[sortedAsc.length - 1]!,
    distinctModelCountBuckets: buckets,
  };
}

export function buildModelSwitching(
  sessions: SessionLine[],
  opts: ModelSwitchingOptions = {},
): ModelSwitchingReport {
  const by: ModelSwitchingDimension = opts.by ?? 'all';
  if (by !== 'all' && by !== 'source') {
    throw new Error(`by must be 'all' | 'source' (got ${String(opts.by)})`);
  }

  const top = opts.top ?? 10;
  if (!Number.isFinite(top) || top <= 0 || !Number.isInteger(top)) {
    throw new Error(`top must be a positive integer (got ${opts.top})`);
  }

  const minSwitches = opts.minSwitches ?? 2;
  if (
    !Number.isFinite(minSwitches) ||
    minSwitches < 2 ||
    !Number.isInteger(minSwitches)
  ) {
    throw new Error(`minSwitches must be an integer >= 2 (got ${opts.minSwitches})`);
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

  // Aggregate snapshots by session_key. A session_key is admitted
  // if ANY of its snapshots fall inside the window — see header
  // comment for the rationale.
  const perKey = new Map<string, PerKey>();
  for (const s of sessions) {
    if (typeof s.session_key !== 'string' || s.session_key.length === 0) continue;
    if (typeof s.model !== 'string' || s.model.length === 0) continue;
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) continue;
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;
    let entry = perKey.get(s.session_key);
    if (!entry) {
      entry = { source: typeof s.source === 'string' ? s.source : '', snapshots: [] };
      perKey.set(s.session_key, entry);
    }
    entry.snapshots.push({
      model: s.model,
      snapshot_at: typeof s.snapshot_at === 'string' ? s.snapshot_at : '',
      started_at: s.started_at,
    });
  }

  // Global figures.
  let consideredSessions = 0;
  let switchedSessions = 0;
  let totalTransitions = 0;
  const transitionCounts = new Map<string, number>();
  for (const pk of perKey.values()) {
    consideredSessions += 1;
    const distinct = new Set(pk.snapshots.map((s) => s.model)).size;
    if (distinct < minSwitches) continue;
    const seq = distinctConsecutiveModels(pk);
    if (seq.length >= 2) {
      switchedSessions += 1;
      totalTransitions += seq.length - 1;
      for (let i = 0; i < seq.length - 1; i++) {
        const k = `${seq[i]}\u0000${seq[i + 1]}`;
        transitionCounts.set(k, (transitionCounts.get(k) ?? 0) + 1);
      }
    }
  }

  const allTransitions: ModelSwitchingTransition[] = [];
  for (const [k, count] of transitionCounts) {
    const idx = k.indexOf('\u0000');
    const from = k.slice(0, idx);
    const to = k.slice(idx + 1);
    allTransitions.push({
      from,
      to,
      count,
      share: totalTransitions === 0 ? 0 : count / totalTransitions,
    });
  }
  allTransitions.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.from < b.from) return -1;
    if (a.from > b.from) return 1;
    if (a.to < b.to) return -1;
    if (a.to > b.to) return 1;
    return 0;
  });
  const topTransitions = allTransitions.slice(0, top);
  const otherTransitionsCount = allTransitions
    .slice(top)
    .reduce((acc, t) => acc + t.count, 0);

  // Distributions.
  const distributions: ModelSwitchingDistribution[] = [];
  if (by === 'all') {
    distributions.push(buildDistribution('all', [...perKey.values()], minSwitches));
  } else {
    const grouped = new Map<string, PerKey[]>();
    for (const pk of perKey.values()) {
      const g = pickGroup(pk.source, 'source');
      let arr = grouped.get(g);
      if (!arr) {
        arr = [];
        grouped.set(g, arr);
      }
      arr.push(pk);
    }
    for (const [g, arr] of grouped) distributions.push(buildDistribution(g, arr, minSwitches));
    distributions.sort((a, b) => {
      if (b.consideredSessions !== a.consideredSessions) {
        return b.consideredSessions - a.consideredSessions;
      }
      return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
    });
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    top,
    minSwitches,
    consideredSessions,
    switchedSessions,
    switchedShare: consideredSessions === 0 ? 0 : switchedSessions / consideredSessions,
    uniqueTransitionPairs: allTransitions.length,
    totalTransitions,
    topTransitions,
    otherTransitionsCount,
    distributions,
  };
}
