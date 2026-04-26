/**
 * source-single-day-mass-concentration: for each source, the share
 * of its total token mass that fell on its single biggest UTC day
 * (`maxDayShare`), plus the cumulative share on its top-2 and top-3
 * days (`top2Share`, `top3Share`), plus a Herfindahl–Hirschman
 * Index (`hhi`) computed over the per-day share distribution.
 *
 * Headline question: **how concentrated is a source's history on
 * its single fattest day?** A source whose entire activity is
 * one giant burst on one calendar day gets `maxDayShare = 1.0`
 * and `hhi = 1.0`; a source uniformly spread across N days gets
 * `maxDayShare = 1/N` and `hhi = 1/N`.
 *
 * Why a separate subcommand (orthogonal to every existing lens):
 *
 *   - `daily-token-gini-coefficient` is a **global** (all-source-
 *     pooled) inequality measure on per-day total mass; it cannot
 *     answer the per-source question and conflates "one source had
 *     a giant day" with "one calendar day was hot across all
 *     sources".
 *   - `bucket-token-gini` measures inequality across hourly
 *     buckets, not calendar days; a source that's flat across
 *     hours within one day but only ever active on one day gets a
 *     low bucket-gini but a maxDayShare = 1.0 here.
 *   - `source-day-of-week-token-mass-share` is a **modular DOW
 *     histogram** (Mon..Sun); it cannot detect "a single
 *     Wednesday produced 80% of this source's mass". DOW shares
 *     can look balanced even when one specific date dominates.
 *   - `source-token-mass-hour-centroid` is a **location** metric
 *     (where on the 24h clock the mass sits), not a
 *     **concentration** metric (how peaked the per-day mass is).
 *   - `source-active-day-streak` / `source-active-hour-longest-run`
 *     measure **consecutive run length**, not mass concentration.
 *     A source can have a 30-day streak with one outlier day
 *     holding 90% of total mass — the streak says nothing about
 *     that.
 *   - `source-burstiness-fano-factor` is variance/mean on per-
 *     bucket counts (request-arrival dispersion); it ignores
 *     token magnitude entirely.
 *   - `source-output-tokens-per-row-percentiles` summarises the
 *     per-row magnitude distribution, not its temporal
 *     concentration on calendar days.
 *
 * Concretely, for each surviving source we compute:
 *
 *   - daysActive:    distinct UTC calendar days with positive
 *                    `total_tokens` for this source within the
 *                    window.
 *   - tokenSum:      sum of `total_tokens` across all kept rows
 *                    for this source (the per-source denominator).
 *   - maxDay:        the UTC date string `YYYY-MM-DD` of the
 *                    single biggest day.
 *   - maxDayTokens:  total_tokens on that day.
 *   - maxDayShare:   maxDayTokens / tokenSum, in [0, 1].
 *   - top2Share:     (sum of top-2 days' tokens) / tokenSum.
 *                    Equals maxDayShare when daysActive == 1.
 *   - top3Share:     (sum of top-3 days' tokens) / tokenSum.
 *   - hhi:           sum_i (day_i_tokens / tokenSum)^2 over all
 *                    active days. In [1/daysActive, 1]. A source
 *                    with one day gets hhi = 1.0; a source with N
 *                    perfectly equal days gets hhi = 1/N.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Per-source: bucket each row's `total_tokens` (treated as 0
 *      if non-finite or negative) into a per-UTC-day map keyed by
 *      `YYYY-MM-DD` (the date portion of the ISO `hour_start`).
 *      Days that net to zero are not counted in `daysActive` (a
 *      day with zero tokens has no mass to concentrate).
 *   4. Sort each source's per-day token list descending; compute
 *      maxDayTokens / maxDayShare / top2Share / top3Share / hhi.
 *   5. Apply display gates `--min-days` (default 3) — sources with
 *      fewer than that many active days are suppressed. Defaults
 *      to 3 because the top-3 cumulative is the headline signal
 *      and is degenerate when fewer than 3 days exist.
 *   6. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - tokenSum == 0  →  source dropped (no mass to share).
 *     Surfaces as `droppedZeroMass`.
 *   - daysActive == 1  →  maxDayShare = top2Share = top3Share =
 *     hhi = 1.0. `singleDay = true`.
 *   - daysActive == 2  →  top2Share = top3Share = 1.0 (sum of
 *     top-2 of 2 = full sum); maxDayShare in [0.5, 1.0].
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 * Day-key derivation uses the first 10 chars of the ISO timestamp
 * (assumes upstream produces UTC-Z timestamps, as the queue file
 * does — see `parsers.ts`).
 */
import type { QueueLine } from './types.js';

export interface SourceSingleDayMassConcentrationOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many active calendar days
   * from the per-source table. Display filter only — global
   * denominators reflect the full kept population. Suppressed
   * rows surface as `droppedBelowMinDays`. Must be a positive
   * integer. Default 3 (the top-3 cumulative is degenerate
   * below 3 days).
   */
  minDays?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default
   * null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokenSum desc.
   *   - 'maxshare':         maxDayShare desc (most peaked first).
   *   - 'top2':             top2Share desc.
   *   - 'top3':             top3Share desc.
   *   - 'hhi':              hhi desc.
   *   - 'days':             daysActive desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'maxshare' | 'top2' | 'top3' | 'hhi' | 'days' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceSingleDayMassConcentrationRow {
  source: string;
  daysActive: number;
  tokenSum: number;
  /** UTC YYYY-MM-DD of the biggest day. */
  maxDay: string;
  maxDayTokens: number;
  /** maxDayTokens / tokenSum, in (0, 1]. */
  maxDayShare: number;
  /** (sum of top-2 days) / tokenSum. Equals maxDayShare when daysActive==1. */
  top2Share: number;
  /** (sum of top-3 days) / tokenSum. */
  top3Share: number;
  /** Herfindahl-Hirschman index over per-day share, in [1/daysActive, 1]. */
  hhi: number;
  /** True iff daysActive === 1. */
  singleDay: boolean;
}

export interface SourceSingleDayMassConcentrationReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minDays: number;
  top: number | null;
  sort: 'tokens' | 'maxshare' | 'top2' | 'top3' | 'hhi' | 'days' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of total_tokens across all kept rows. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedZeroMass: number;
  droppedBelowMinDays: number;
  droppedBelowTopCap: number;
  sources: SourceSingleDayMassConcentrationRow[];
}

export function buildSourceSingleDayMassConcentration(
  queue: QueueLine[],
  opts: SourceSingleDayMassConcentrationOptions = {},
): SourceSingleDayMassConcentrationReport {
  const minDays = opts.minDays ?? 3;
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
  const sort = opts.sort ?? 'tokens';
  const validSorts = [
    'tokens',
    'maxshare',
    'top2',
    'top3',
    'hhi',
    'days',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
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

  const perSource = new Map<string, Map<string, number>>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;
  let totalTokens = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const totRaw = Number(q.total_tokens);
    const tot = Number.isFinite(totRaw) && totRaw > 0 ? totRaw : 0;
    if (tot === 0) continue;

    // Day key = first 10 chars of ISO hour_start (UTC YYYY-MM-DD).
    const day = q.hour_start.slice(0, 10);

    let m = perSource.get(source);
    if (!m) {
      m = new Map<string, number>();
      perSource.set(source, m);
    }
    m.set(day, (m.get(day) ?? 0) + tot);
    totalTokens += tot;
  }

  const totalSources = perSource.size;
  let droppedZeroMass = 0;
  const allRows: SourceSingleDayMassConcentrationRow[] = [];

  for (const [source, dayMap] of perSource.entries()) {
    if (dayMap.size === 0) {
      droppedZeroMass += 1;
      continue;
    }
    let sum = 0;
    const dayEntries: Array<[string, number]> = [];
    for (const [d, t] of dayMap.entries()) {
      if (t <= 0) continue;
      dayEntries.push([d, t]);
      sum += t;
    }
    if (dayEntries.length === 0 || sum === 0) {
      droppedZeroMass += 1;
      continue;
    }
    // Sort descending by tokens; tiebreak by day asc for determinism.
    dayEntries.sort((a, b) => {
      const d = b[1] - a[1];
      if (d !== 0) return d;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
    const daysActive = dayEntries.length;
    const maxDay = dayEntries[0]![0];
    const maxDayTokens = dayEntries[0]![1];
    const maxDayShare = maxDayTokens / sum;
    const top2Tokens =
      daysActive >= 2 ? maxDayTokens + dayEntries[1]![1] : maxDayTokens;
    const top3Tokens =
      daysActive >= 3
        ? top2Tokens + dayEntries[2]![1]
        : top2Tokens;
    const top2Share = top2Tokens / sum;
    const top3Share = top3Tokens / sum;
    let hhi = 0;
    for (const [, t] of dayEntries) {
      const s = t / sum;
      hhi += s * s;
    }
    allRows.push({
      source,
      daysActive,
      tokenSum: sum,
      maxDay,
      maxDayTokens,
      maxDayShare,
      top2Share,
      top3Share,
      hhi,
      singleDay: daysActive === 1,
    });
  }

  let droppedBelowMinDays = 0;
  const survived: SourceSingleDayMassConcentrationRow[] = [];
  for (const row of allRows) {
    if (row.daysActive < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.tokenSum - a.tokenSum;
    else if (sort === 'maxshare') primary = b.maxDayShare - a.maxDayShare;
    else if (sort === 'top2') primary = b.top2Share - a.top2Share;
    else if (sort === 'top3') primary = b.top3Share - a.top3Share;
    else if (sort === 'hhi') primary = b.hhi - a.hhi;
    else if (sort === 'days') primary = b.daysActive - a.daysActive;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
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
    source: sourceFilter,
    minDays,
    top,
    sort,
    totalSources,
    totalTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedZeroMass,
    droppedBelowMinDays,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
