/**
 * source-dry-spell: per-source longest run of consecutive UTC
 * calendar days *without* a positive-token bucket, measured strictly
 * inside the source's tenure (firstDay → lastDay inclusive).
 *
 * The orthogonal complement to `source-active-day-streak`. Where
 * `source-active-day-streak` answers "what's the longest unbroken
 * habit?", this report answers "what's the worst gap I've taken?"
 *
 * Two sources can share the same tenure, the same `activeDays`, and
 * even the same density (activeDays/tenureDays) yet have radically
 * different *gap shape*: one source's inactivity is spread evenly as
 * many short 1-day gaps; the other's is concentrated in a single
 * multi-week dry spell. `source-active-day-streak` cannot
 * distinguish these patterns — its longest-streak number is silent
 * about how the inactive days are arranged.
 *
 * For every source we compute, on its positive-token buckets:
 *
 *   - firstDay / lastDay: ISO YYYY-MM-DD bounds of activity.
 *   - tenureDays:         calendar days from firstDay → lastDay
 *                         inclusive (>= 1).
 *   - activeDays:         distinct UTC days with at least one
 *                         positive-token bucket.
 *   - inactiveDays:       tenureDays - activeDays (>= 0). Number of
 *                         calendar days strictly inside tenure with
 *                         zero positive-token buckets.
 *   - longestDrySpell:    length (in days) of the longest maximal
 *                         run of consecutive *inactive* UTC days
 *                         strictly inside tenure. 0 when the source
 *                         was active every single day of its tenure.
 *   - longestDrySpellStart / longestDrySpellEnd: ISO YYYY-MM-DD
 *                         bounds of that run (earliest qualifying
 *                         run wins on ties → deterministic). Both
 *                         are empty strings when longestDrySpell==0.
 *   - nDrySpells:         total count of maximal inactive runs
 *                         strictly inside tenure (0 when activeDays
 *                         == tenureDays).
 *   - meanDrySpell:       inactiveDays / nDrySpells (0 when
 *                         nDrySpells == 0). Mean inactive-run length
 *                         in days.
 *   - drySpellFraction:   inactiveDays / tenureDays in [0, 1).
 *                         1.0 is impossible (firstDay and lastDay
 *                         are always active). 0 = perfect attendance.
 *   - tokens:             sum of total_tokens across the source.
 *
 * Why this is orthogonal to everything that already ships:
 *
 *   - `source-active-day-streak` reports the longest *active* run
 *     and density but is silent on how absences cluster. A source
 *     with longestStreak=10 over 30-day tenure and density=0.6 could
 *     be "10 active, 12 off, 8 active" (longestDrySpell=12) or
 *     "10 active, 1 off, 1 active, 1 off, …" (longestDrySpell≈1).
 *     This report uniquely surfaces the worst-gap shape.
 *   - `source-tenure` reports the calendar span only.
 *   - `source-debut-recency` is a calendar-position metric.
 *   - `source-decay-half-life` measures intra-tenure token-mass
 *     center, not gap geometry.
 *   - `source-run-lengths` measures consecutive same-source
 *     *sessions* (operator stickiness within a sitting), not
 *     calendar-day inactivity.
 *   - `bucket-streak-length` measures consecutive positive *hour
 *     buckets* (intra-day burstiness), not multi-day absences.
 *   - `gaps` / `idle-gaps` / `bucket-gap-distribution` measure
 *     inter-bucket time gaps with no per-source dry-spell roll-up
 *     into "consecutive blank UTC days within tenure".
 *
 * Headline question: "When I take a break from a source, how long
 * is the longest one — and which source has the worst gap?"
 *
 * Knobs:
 *
 *   - since / until: filter on hour_start. Dry spells are computed
 *     on the post-filter active-day set, so a window cut can shrink
 *     tenure and therefore both shorten and lengthen dry spells.
 *   - model:        restrict to a single normalised model id.
 *   - source:       restrict to a single source key. Display filter
 *                   on the population — global denominators echo
 *                   the kept set.
 *   - minDays:      drop sources with fewer than n active days from
 *                   the per-source table. Display filter only.
 *                   Default 1.
 *   - top:          cap the per-source table after sort + filters.
 *                   Default null (no cap).
 *   - sort:         'longest' (default, longestDrySpell desc) |
 *                   'fraction' (drySpellFraction desc) |
 *                   'tokens' | 'inactive' (inactiveDays desc) |
 *                   'mean' (meanDrySpell desc) | 'source' (lex asc).
 *   - minLongest:   drop rows whose longestDrySpell is strictly
 *                   below this integer. Display filter. Default 0
 *                   (no-op). Use 1 to hide perfect-attendance
 *                   sources, or 7 to keep only week-plus offenders.
 *
 * Determinism: pure builder. No Date.now() reads (only opts.generatedAt).
 * Tie-breaks fully specified — identical input yields identical output.
 */
import type { QueueLine } from './types.js';

export type SourceDrySpellSort =
  | 'longest'
  | 'fraction'
  | 'tokens'
  | 'inactive'
  | 'mean'
  | 'source';

export interface SourceDrySpellOptions {
  since?: string | null;
  until?: string | null;
  model?: string | null;
  source?: string | null;
  /** Display filter: drop rows with activeDays < minDays. Default 1. */
  minDays?: number;
  /** Display cap after sort + minDays + minLongest. Default null. */
  top?: number | null;
  /** Sort key. Default 'longest'. */
  sort?: SourceDrySpellSort;
  /**
   * Drop rows whose longestDrySpell is strictly below this integer
   * from the per-source table. Default 0 (no-op).
   */
  minLongest?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceDrySpellRow {
  source: string;
  firstDay: string;
  lastDay: string;
  tenureDays: number;
  activeDays: number;
  inactiveDays: number;
  longestDrySpell: number;
  longestDrySpellStart: string;
  longestDrySpellEnd: string;
  nDrySpells: number;
  meanDrySpell: number;
  drySpellFraction: number;
  tokens: number;
}

export interface SourceDrySpellReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  sourceFilter: string | null;
  minDays: number;
  top: number | null;
  sort: SourceDrySpellSort;
  minLongest: number;
  totalSources: number;
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedModelFilter: number;
  droppedSourceFilter: number;
  droppedBelowMinDays: number;
  droppedBelowMinLongest: number;
  droppedBelowTopCap: number;
  sources: SourceDrySpellRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): string {
  return new Date(Math.floor(ms / DAY_MS) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dayKeyToMs(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

export function buildSourceDrySpell(
  queue: QueueLine[],
  opts: SourceDrySpellOptions = {},
): SourceDrySpellReport {
  const minDays = opts.minDays ?? 1;
  if (!Number.isInteger(minDays) || minDays < 1) {
    throw new Error(
      `minDays must be a positive integer (got ${opts.minDays})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort: SourceDrySpellSort = opts.sort ?? 'longest';
  if (
    sort !== 'longest' &&
    sort !== 'fraction' &&
    sort !== 'tokens' &&
    sort !== 'inactive' &&
    sort !== 'mean' &&
    sort !== 'source'
  ) {
    throw new Error(
      `sort must be 'longest' | 'fraction' | 'tokens' | 'inactive' | 'mean' | 'source' (got ${opts.sort})`,
    );
  }
  const minLongest = opts.minLongest ?? 0;
  if (!Number.isInteger(minLongest) || minLongest < 0) {
    throw new Error(
      `minLongest must be a non-negative integer (got ${opts.minLongest})`,
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

  const modelFilter =
    opts.model != null && opts.model !== '' ? opts.model : null;
  const sourceFilter =
    opts.source != null && opts.source !== '' ? opts.source : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Acc {
    days: Map<string, number>;
  }
  const perSource = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedModelFilter = 0;
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
    if (modelFilter !== null) {
      const model = typeof q.model === 'string' ? q.model : '';
      if (model !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }
    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let acc = perSource.get(source);
    if (!acc) {
      acc = { days: new Map<string, number>() };
      perSource.set(source, acc);
    }
    const k = dayKey(ms);
    acc.days.set(k, (acc.days.get(k) ?? 0) + tt);
  }

  const allRows: SourceDrySpellRow[] = [];
  let totalTokens = 0;

  for (const [source, acc] of perSource.entries()) {
    if (acc.days.size === 0) continue;

    const sortedKeys = [...acc.days.keys()].sort();
    const activeDays = sortedKeys.length;
    let srcTokens = 0;
    for (const v of acc.days.values()) srcTokens += v;
    totalTokens += srcTokens;

    const firstDay = sortedKeys[0]!;
    const lastDay = sortedKeys[sortedKeys.length - 1]!;
    const firstMs = dayKeyToMs(firstDay);
    const lastMs = dayKeyToMs(lastDay);
    const tenureDays = Math.round((lastMs - firstMs) / DAY_MS) + 1;
    const inactiveDays = tenureDays - activeDays;

    // Walk consecutive active-day pairs; each gap > 1 day yields an
    // inactive run of length (gap - 1) days. Tracks earliest-tied
    // longest dry spell.
    let nDrySpells = 0;
    let longestDrySpell = 0;
    let longestStart = '';
    let longestEnd = '';
    let prevMs = firstMs;
    for (let i = 1; i < sortedKeys.length; i += 1) {
      const cur = dayKeyToMs(sortedKeys[i]!);
      const gap = Math.round((cur - prevMs) / DAY_MS);
      if (gap > 1) {
        const runLen = gap - 1;
        nDrySpells += 1;
        if (runLen > longestDrySpell) {
          longestDrySpell = runLen;
          // start = day after prev active; end = day before cur active
          longestStart = dayKey(prevMs + DAY_MS);
          longestEnd = dayKey(cur - DAY_MS);
        }
      }
      prevMs = cur;
    }
    const meanDrySpell = nDrySpells === 0 ? 0 : inactiveDays / nDrySpells;
    const drySpellFraction = tenureDays === 0 ? 0 : inactiveDays / tenureDays;

    allRows.push({
      source,
      firstDay,
      lastDay,
      tenureDays,
      activeDays,
      inactiveDays,
      longestDrySpell,
      longestDrySpellStart: longestStart,
      longestDrySpellEnd: longestEnd,
      nDrySpells,
      meanDrySpell,
      drySpellFraction,
      tokens: srcTokens,
    });
  }

  const survived: SourceDrySpellRow[] = [];
  let droppedBelowMinDays = 0;
  let droppedBelowMinLongest = 0;
  for (const row of allRows) {
    if (row.activeDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    if (row.longestDrySpell < minLongest) {
      droppedBelowMinLongest += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'longest') primary = b.longestDrySpell - a.longestDrySpell;
    else if (sort === 'fraction')
      primary = b.drySpellFraction - a.drySpellFraction;
    else if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'inactive') primary = b.inactiveDays - a.inactiveDays;
    else if (sort === 'mean') primary = b.meanDrySpell - a.meanDrySpell;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    model: modelFilter,
    sourceFilter,
    minDays,
    top,
    sort,
    minLongest,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedSourceFilter,
    droppedBelowMinDays,
    droppedBelowMinLongest,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
