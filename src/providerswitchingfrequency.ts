/**
 * provider-switching-frequency: per UTC calendar day, how often does
 * the *primary provider* of an active hour-bucket change relative to
 * the previous active bucket on the same day, in `hour_start` order?
 *
 * For each `hour_start` bucket present in the queue we compute the
 * bucket's **primary provider** = `classifyProvider(normaliseModel)`
 * applied to the model with the highest `total_tokens` sum inside
 * that bucket. Ties are broken lexicographically on the normalised
 * model name (deterministic), then we re-classify to a provider.
 * Buckets whose only contribution was an empty/missing model name
 * surface as `droppedEmptyModelBuckets` and never contribute to a
 * day's active-bucket count.
 *
 * For each UTC calendar day we then walk the active buckets in
 * `hour_start` ascending order and, for each adjacent pair within
 * the same day, count whether the primary provider changed — that
 * is a **provider switch** for that day. Day boundaries reset the
 * walk, so a 23:00 → next-day-00:00 swap is *not* a same-day
 * switch (it is captured separately in `crossDaySwitches` and
 * `crossDayPairs` so the operator can see whether overnight gaps
 * tend to also be vendor swaps).
 *
 * Why a separate subcommand:
 *
 *   - `bucket-handoff-frequency` counts *model-level* handoffs
 *     across the entire span ignoring day structure. Two corpora
 *     with identical handoff counts can have very different
 *     per-day cadences (one swap per day for 30 days vs 30 swaps
 *     in one frantic day).
 *   - `provider-share` is a pure mass tally; no time order, no
 *     adjacency.
 *   - `provider-tenure` reports how many *total* buckets each
 *     provider was primary in; it never quantifies how often the
 *     operator actually toggled between vendors within a day.
 *   - `model-switching` is intra-session and ignores the
 *     bucket/day axis entirely.
 *   - `bucket-handoff-frequency` collapses provider identity into
 *     model identity, so two `claude-*` models switching look the
 *     same as `claude-*` → `gpt-*`. This subcommand classifies
 *     to provider first, so we count *vendor* swaps only.
 *
 * Headline question: "on a typical active day, how many times do I
 * bounce between inference vendors?". Useful for routing-stability
 * analysis, vendor-lock-in risk, and explaining cost variance
 * (different vendors have different $/Mtok rates).
 *
 * What we emit:
 *
 *   - `activeDays` / `activeBuckets`: post-filter populations.
 *   - `consideredPairs` / `switchPairs`: same-day adjacent pairs and
 *     the subset whose primary provider changed; `switchShare =
 *     switchPairs / consideredPairs` ∈ [0,1].
 *   - `crossDayPairs` / `crossDaySwitches`: adjacent active buckets
 *     that crossed a UTC day boundary, and the subset whose primary
 *     provider also changed. These are *not* counted in
 *     `consideredPairs`; they exist purely so the operator can
 *     compare overnight churn vs intra-day churn.
 *   - `meanSwitchesPerActiveDay`: `switchPairs / activeDays` (0 when
 *     `activeDays == 0`). Reported separately because a day with
 *     1 active bucket contributes 0 pairs but still counts as an
 *     active day; the mean is "average intra-day churn an active
 *     day exhibits" rather than "per-pair churn rate".
 *   - `daysWithAnySwitch` / `dayCoverage`: how many active days
 *     had ≥1 same-day switch, and that fraction of `activeDays`.
 *   - `topPairs`: directed `(from -> to)` provider-pair counts
 *     across same-day switches, sorted by count desc, then `from`
 *     asc, then `to` asc; capped at `topPairs` (default 10).
 *   - `days[]`: per-day rows (UTC `YYYY-MM-DD`) with
 *     `activeBuckets`, `consideredPairs`, `switchPairs`,
 *     `switchShare`, and the dominant provider on that day
 *     (most primary buckets; ties on tokens desc, then provider
 *     name asc). Sorted by `--sort` (default `'day'` desc).
 *
 * Provider classification reuses `classifyProvider(normaliseModel)`
 * from `providershare.ts`, so the vocabulary stays consistent
 * across `provider-share`, `provider-tenure`, and this command:
 * `anthropic`, `openai`, `google`, `meta`, `mistral`, `xai`,
 * `deepseek`, `qwen`, `cohere`, `unknown`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';
import { classifyProvider } from './providershare.js';

export type ProviderSwitchingSort = 'day' | 'switches' | 'buckets' | 'share';

export interface ProviderSwitchingFrequencyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Cap the number of rows in `topPairs[]` after sort. Suppressed
   * rows surface as `droppedBelowTopCap`. Default 10. Use 0 to
   * suppress the table (still echoes `topPairs: 0`).
   */
  topPairs?: number;
  /**
   * Cap the number of rows in `days[]` after sort. Default 0 = no
   * cap. Suppressed rows surface as `droppedTopDays`. Summary
   * stats always reflect the full population.
   */
  topDays?: number;
  /**
   * Sort key for `days[]`: `'day'` desc | `'switches'` desc |
   * `'buckets'` desc | `'share'` desc. Default `'day'`.
   * Ties on the primary key always break on day asc to keep
   * output stable.
   */
  sort?: ProviderSwitchingSort;
  /**
   * Drop rows from `days[]` whose `switchPairs < minSwitches`.
   * Display filter only — summary stats (`switchPairs`,
   * `switchShare`, `daysWithAnySwitch`, ...) always reflect the
   * full active-days population. Suppressed rows surface as
   * `droppedBelowMinSwitches`. Default 0 = keep every day.
   * Applied *before* `topDays` (sort, then filter, then cap).
   *
   * Useful when chasing high-churn days only: `--min-switches 5`
   * hides quiet single-vendor days so the table is just the
   * vendor-bouncy ones. Must be a non-negative integer.
   */
  minSwitches?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ProviderSwitchingPair {
  from: string;
  to: string;
  count: number;
}

export interface ProviderSwitchingDayRow {
  /** UTC `YYYY-MM-DD`. */
  day: string;
  activeBuckets: number;
  consideredPairs: number;
  switchPairs: number;
  /** switchPairs / consideredPairs in [0, 1]; 0 when consideredPairs == 0. */
  switchShare: number;
  /** Provider that was primary in the most buckets that day. */
  dominantProvider: string;
  /** Bucket-count for `dominantProvider` on that day. */
  dominantProviderBuckets: number;
}

export interface ProviderSwitchingFrequencyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  topPairs: number;
  topDays: number;
  sort: ProviderSwitchingSort;
  /** Echo of the resolved minSwitches floor. */
  minSwitches: number;
  /** Distinct UTC calendar days with ≥1 active bucket. */
  activeDays: number;
  /** Distinct active hour-buckets surviving filters. */
  activeBuckets: number;
  /** Sum over days of (perDayActiveBuckets - 1, floored at 0). */
  consideredPairs: number;
  /** Subset of consideredPairs whose primary provider changed. */
  switchPairs: number;
  /** switchPairs / consideredPairs, in [0, 1]; 0 if consideredPairs == 0. */
  switchShare: number;
  /** Adjacent active-bucket pairs that crossed a UTC day boundary. */
  crossDayPairs: number;
  /** Subset of crossDayPairs whose primary provider also changed. */
  crossDaySwitches: number;
  /** switchPairs / activeDays, 0 if activeDays == 0. */
  meanSwitchesPerActiveDay: number;
  /** Distinct days with switchPairs > 0. */
  daysWithAnySwitch: number;
  /** daysWithAnySwitch / activeDays, 0 if activeDays == 0. */
  dayCoverage: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Buckets whose only contribution was an empty/missing model name. */
  droppedEmptyModelBuckets: number;
  /** Rows of `topPairs[]` trimmed by the cap. */
  droppedBelowTopCap: number;
  /** Rows of `days[]` trimmed by `topDays`. */
  droppedTopDays: number;
  /** Rows of `days[]` hidden by the `minSwitches` floor. */
  droppedBelowMinSwitches: number;
  /** Top directed (from -> to) same-day provider switches. */
  pairs: ProviderSwitchingPair[];
  /** Per-day rows; sort governed by `sort`. */
  days: ProviderSwitchingDayRow[];
}

function utcDay(ms: number): string {
  // YYYY-MM-DD slice of an ISO timestamp; safe since hour_start is
  // always normalised to top-of-hour UTC by pew.
  return new Date(ms).toISOString().slice(0, 10);
}

export function buildProviderSwitchingFrequency(
  queue: QueueLine[],
  opts: ProviderSwitchingFrequencyOptions = {},
): ProviderSwitchingFrequencyReport {
  const topPairs = opts.topPairs ?? 10;
  if (!Number.isInteger(topPairs) || topPairs < 0) {
    throw new Error(
      `topPairs must be a non-negative integer (got ${opts.topPairs})`,
    );
  }
  const topDays = opts.topDays ?? 0;
  if (!Number.isInteger(topDays) || topDays < 0) {
    throw new Error(
      `topDays must be a non-negative integer (got ${opts.topDays})`,
    );
  }
  const sort: ProviderSwitchingSort = opts.sort ?? 'day';
  if (sort !== 'day' && sort !== 'switches' && sort !== 'buckets' && sort !== 'share') {
    throw new Error(
      `sort must be 'day' | 'switches' | 'buckets' | 'share' (got ${String(opts.sort)})`,
    );
  }
  const minSwitches = opts.minSwitches ?? 0;
  if (!Number.isInteger(minSwitches) || minSwitches < 0) {
    throw new Error(
      `minSwitches must be a non-negative integer (got ${opts.minSwitches})`,
    );
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

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // bucket ms -> { iso, model -> tokens }
  const buckets = new Map<number, { iso: string; models: Map<string, number> }>();

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

    if (sourceFilter !== null) {
      const src = typeof q.source === 'string' ? q.source : '';
      if (src !== sourceFilter) {
        droppedSourceFilter += 1;
        continue;
      }
    }

    const rawModel = typeof q.model === 'string' ? q.model : '';
    // Normalise once at ingest so primary-model selection and
    // provider classification operate on the canonical id.
    const model = rawModel.length > 0 ? normaliseModel(rawModel) : '';

    let cell = buckets.get(ms);
    if (!cell) {
      cell = { iso: q.hour_start, models: new Map<string, number>() };
      buckets.set(ms, cell);
    }
    cell.models.set(model, (cell.models.get(model) ?? 0) + tt);
  }

  // Compute primary provider per bucket; drop buckets whose only
  // model contribution was the empty string.
  interface PrimaryRow {
    ms: number;
    iso: string;
    provider: string;
    tokens: number;
  }
  const primaries: PrimaryRow[] = [];
  let droppedEmptyModelBuckets = 0;
  for (const [ms, cell] of buckets.entries()) {
    let bestModel: string | null = null;
    let bestTokens = -Infinity;
    const sortedModels = [...cell.models.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    );
    for (const [model, tokens] of sortedModels) {
      if (model === '') continue;
      if (tokens > bestTokens) {
        bestTokens = tokens;
        bestModel = model;
      }
    }
    if (bestModel === null) {
      droppedEmptyModelBuckets += 1;
      continue;
    }
    primaries.push({
      ms,
      iso: cell.iso,
      provider: classifyProvider(bestModel),
      tokens: bestTokens,
    });
  }

  primaries.sort((a, b) => a.ms - b.ms);

  // Group by UTC day; track per-day primary-provider bucket counts
  // so we can compute dominantProvider deterministically.
  interface DayBucket {
    day: string;
    rows: PrimaryRow[];
    perProvider: Map<string, { buckets: number; tokens: number }>;
  }
  const dayMap = new Map<string, DayBucket>();
  for (const p of primaries) {
    const day = utcDay(p.ms);
    let cell = dayMap.get(day);
    if (!cell) {
      cell = { day, rows: [], perProvider: new Map() };
      dayMap.set(day, cell);
    }
    cell.rows.push(p);
    const pp = cell.perProvider.get(p.provider);
    if (pp) {
      pp.buckets += 1;
      pp.tokens += p.tokens;
    } else {
      cell.perProvider.set(p.provider, { buckets: 1, tokens: p.tokens });
    }
  }

  // Walk same-day adjacent pairs, count switches and pair counts.
  let consideredPairs = 0;
  let switchPairs = 0;
  let crossDayPairs = 0;
  let crossDaySwitches = 0;
  const pairCounts = new Map<string, ProviderSwitchingPair>();

  for (let i = 1; i < primaries.length; i += 1) {
    const prev = primaries[i - 1]!;
    const next = primaries[i]!;
    const sameDay = utcDay(prev.ms) === utcDay(next.ms);
    if (sameDay) {
      consideredPairs += 1;
      if (prev.provider !== next.provider) {
        switchPairs += 1;
        const key = prev.provider + '\x1f' + next.provider;
        const cell = pairCounts.get(key);
        if (cell) cell.count += 1;
        else pairCounts.set(key, { from: prev.provider, to: next.provider, count: 1 });
      }
    } else {
      crossDayPairs += 1;
      if (prev.provider !== next.provider) crossDaySwitches += 1;
    }
  }

  const activeBuckets = primaries.length;
  const activeDays = dayMap.size;

  // Per-day rows.
  const dayRows: ProviderSwitchingDayRow[] = [];
  let daysWithAnySwitch = 0;
  for (const cell of dayMap.values()) {
    // Per-day pair walk.
    let perDayPairs = 0;
    let perDaySwitches = 0;
    for (let i = 1; i < cell.rows.length; i += 1) {
      perDayPairs += 1;
      if (cell.rows[i - 1]!.provider !== cell.rows[i]!.provider) {
        perDaySwitches += 1;
      }
    }
    if (perDaySwitches > 0) daysWithAnySwitch += 1;

    // Dominant provider: most buckets, ties on tokens desc, then name asc.
    let dominantProvider = '';
    let dominantBuckets = -1;
    let dominantTokens = -Infinity;
    const provKeys = [...cell.perProvider.keys()].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    for (const k of provKeys) {
      const v = cell.perProvider.get(k)!;
      if (
        v.buckets > dominantBuckets ||
        (v.buckets === dominantBuckets && v.tokens > dominantTokens)
      ) {
        dominantProvider = k;
        dominantBuckets = v.buckets;
        dominantTokens = v.tokens;
      }
    }

    dayRows.push({
      day: cell.day,
      activeBuckets: cell.rows.length,
      consideredPairs: perDayPairs,
      switchPairs: perDaySwitches,
      switchShare: perDayPairs > 0 ? perDaySwitches / perDayPairs : 0,
      dominantProvider,
      dominantProviderBuckets: dominantBuckets < 0 ? 0 : dominantBuckets,
    });
  }

  // Sort days[].
  dayRows.sort((a, b) => {
    if (sort === 'day') {
      // day desc (most recent first), tie on day asc — but day
      // values are unique per-row, so this is just desc.
      return a.day < b.day ? 1 : a.day > b.day ? -1 : 0;
    }
    if (sort === 'switches') {
      if (b.switchPairs !== a.switchPairs) return b.switchPairs - a.switchPairs;
      return a.day < b.day ? -1 : a.day > b.day ? 1 : 0;
    }
    if (sort === 'buckets') {
      if (b.activeBuckets !== a.activeBuckets) return b.activeBuckets - a.activeBuckets;
      return a.day < b.day ? -1 : a.day > b.day ? 1 : 0;
    }
    // share
    if (b.switchShare !== a.switchShare) return b.switchShare - a.switchShare;
    return a.day < b.day ? -1 : a.day > b.day ? 1 : 0;
  });

  let droppedTopDays = 0;
  let droppedBelowMinSwitches = 0;
  let days = dayRows;
  if (minSwitches > 0) {
    const survivors = days.filter((d) => d.switchPairs >= minSwitches);
    droppedBelowMinSwitches = days.length - survivors.length;
    days = survivors;
  }
  if (topDays > 0 && days.length > topDays) {
    droppedTopDays = days.length - topDays;
    days = days.slice(0, topDays);
  }

  // Sort pairs by count desc, then from asc, then to asc.
  const sortedPairs = [...pairCounts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });
  let droppedBelowTopCap = 0;
  let pairs = sortedPairs;
  if (pairs.length > topPairs) {
    droppedBelowTopCap = pairs.length - topPairs;
    pairs = pairs.slice(0, topPairs);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    topPairs,
    topDays,
    sort,
    minSwitches,
    activeDays,
    activeBuckets,
    consideredPairs,
    switchPairs,
    switchShare: consideredPairs > 0 ? switchPairs / consideredPairs : 0,
    crossDayPairs,
    crossDaySwitches,
    meanSwitchesPerActiveDay: activeDays > 0 ? switchPairs / activeDays : 0,
    daysWithAnySwitch,
    dayCoverage: activeDays > 0 ? daysWithAnySwitch / activeDays : 0,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedEmptyModelBuckets,
    droppedBelowTopCap,
    droppedTopDays,
    droppedBelowMinSwitches,
    pairs,
    days,
  };
}
