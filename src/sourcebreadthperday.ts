/**
 * source-breadth-per-day: per UTC calendar day, how many *distinct*
 * sources were active. The "tool-diversity" lens.
 *
 * For each UTC calendar day with at least one positive-token row:
 *
 *   - day:           ISO date YYYY-MM-DD (UTC)
 *   - sourceCount:   distinct `source` values active that day
 *                    (only sources with > 0 tokens that day count)
 *   - sources:       comma-joined sorted list (lex asc) of those
 *                    source names — for human inspection
 *   - bucketsOnDay:  distinct active hour_start values that day
 *   - tokensOnDay:   sum of total_tokens that day
 *
 * Plus distribution stats over the full population:
 *   min / p25 / median / mean / p75 / max for `sourceCount`,
 *   plus `singleSourceDays` and `multiSourceDays` counters and
 *   `multiSourceShare` = multi / distinct.
 *
 * Why this is orthogonal to what already ships:
 *
 *   - `provider-share` / `source-tenure` aggregate over the whole
 *     window — they don't anchor per calendar day.
 *   - `cohabitation` measures *which sources co-occur within the
 *     same hour bucket*; this measures *how many sources show up
 *     anywhere in the same calendar day*. A day with codex at 09:00
 *     and claude-code at 22:00 has cohabitation=0 but
 *     sourceCount=2 — the lenses see different things.
 *   - `active-span-per-day` / `first-bucket-of-day` characterise
 *     time-of-day shape; they're agnostic to which tools were used.
 *   - `model-mix-entropy` is over models, not sources, and is not
 *     per-day.
 *
 * Standard `--since` / `--until` / `--source` / `--top` filters;
 * `--top` is display-only. Default sort `day desc` (newest first).
 *
 * Note on `--source`: when set, the report degenerates by design —
 * every kept day has sourceCount=1. The flag is still accepted for
 * symmetry with sibling commands and is useful for verifying day
 * coverage of a single tool.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface SourceBreadthPerDayOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Truncate `days[]` to N rows after sorting. Display filter only —
   * summary stats always reflect the full pre-cap population.
   * Suppressed rows surface as `droppedTopDays`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `days[]`:
   *   - 'day' (default):     day desc (newest first)
   *   - 'sources':           sourceCount desc (most-diverse day first)
   *   - 'tokens':            tokensOnDay desc
   *   - 'buckets':           bucketsOnDay desc
   * Tiebreak in all non-default cases: day desc.
   */
  sort?: 'day' | 'sources' | 'tokens' | 'buckets';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceBreadthPerDayRow {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** Distinct sources active that day with positive tokens. */
  sourceCount: number;
  /** Comma-joined sorted (lex asc) list of source names. */
  sources: string;
  /** Distinct active hour_start values on this day. */
  bucketsOnDay: number;
  /** Sum of total_tokens on this day. */
  tokensOnDay: number;
}

export interface SourceBreadthPerDayReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved `sort` key. */
  sort: 'day' | 'sources' | 'tokens' | 'buckets';
  /** Distinct UTC calendar days with at least one positive-token row. */
  distinctDays: number;
  /** Sum of total_tokens across the *full* population (pre top cap). */
  totalTokens: number;
  /** min sourceCount observed across all days (null if no days). */
  sourceCountMin: number | null;
  /** max sourceCount observed across all days (null if no days). */
  sourceCountMax: number | null;
  /** arithmetic mean of sourceCount (null if no days). */
  sourceCountMean: number | null;
  /** median sourceCount (null if no days). */
  sourceCountMedian: number | null;
  /** 25th percentile sourceCount (null if no days). */
  sourceCountP25: number | null;
  /** 75th percentile sourceCount (null if no days). */
  sourceCountP75: number | null;
  /** Days where exactly one source was active (sourceCount === 1). */
  singleSourceDays: number;
  /** Days where two or more sources were active (sourceCount >= 2). */
  multiSourceDays: number;
  /** multiSourceDays / distinctDays (0 if no days). */
  multiSourceShare: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Rows with empty/non-string source value. */
  droppedEmptySource: number;
  /** Day rows hidden by the `top` cap. */
  droppedTopDays: number;
  /** Per-day rows after sort + top cap. */
  days: SourceBreadthPerDayRow[];
}

export function buildSourceBreadthPerDay(
  queue: QueueLine[],
  opts: SourceBreadthPerDayOptions = {},
): SourceBreadthPerDayReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'day';
  if (
    sort !== 'day' &&
    sort !== 'sources' &&
    sort !== 'tokens' &&
    sort !== 'buckets'
  ) {
    throw new Error(
      `sort must be 'day' | 'sources' | 'tokens' | 'buckets' (got ${opts.sort})`,
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

  interface Acc {
    sources: Set<string>;
    buckets: Set<string>;
    tokens: number;
  }
  const perDay = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;
  let droppedEmptySource = 0;

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
    if (src === '') {
      droppedEmptySource += 1;
      continue;
    }

    const day = new Date(ms).toISOString().slice(0, 10);
    let acc = perDay.get(day);
    if (!acc) {
      acc = { sources: new Set<string>(), buckets: new Set<string>(), tokens: 0 };
      perDay.set(day, acc);
    }
    acc.sources.add(src);
    acc.buckets.add(q.hour_start);
    acc.tokens += tt;
  }

  const allDays: SourceBreadthPerDayRow[] = [];
  let totalTokens = 0;
  for (const [day, acc] of perDay.entries()) {
    const sortedSources = [...acc.sources].sort();
    allDays.push({
      day,
      sourceCount: acc.sources.size,
      sources: sortedSources.join(','),
      bucketsOnDay: acc.buckets.size,
      tokensOnDay: acc.tokens,
    });
    totalTokens += acc.tokens;
  }

  const distinctDays = allDays.length;
  let sourceCountMin: number | null = null;
  let sourceCountMax: number | null = null;
  let sourceCountMean: number | null = null;
  let sourceCountMedian: number | null = null;
  let sourceCountP25: number | null = null;
  let sourceCountP75: number | null = null;
  let singleSourceDays = 0;
  let multiSourceDays = 0;
  let multiSourceShare = 0;

  if (distinctDays > 0) {
    const counts = allDays.map((d) => d.sourceCount);
    const sorted = [...counts].sort((a, b) => a - b);
    sourceCountMin = sorted[0]!;
    sourceCountMax = sorted[sorted.length - 1]!;
    sourceCountMean = counts.reduce((s, c) => s + c, 0) / distinctDays;
    sourceCountMedian = percentileInt(sorted, 0.5);
    sourceCountP25 = percentileInt(sorted, 0.25);
    sourceCountP75 = percentileInt(sorted, 0.75);

    for (const c of counts) {
      if (c === 1) singleSourceDays += 1;
      else if (c >= 2) multiSourceDays += 1;
    }
    multiSourceShare = multiSourceDays / distinctDays;
  }

  allDays.sort((a, b) => {
    let primary = 0;
    if (sort === 'sources') primary = b.sourceCount - a.sourceCount;
    else if (sort === 'tokens') primary = b.tokensOnDay - a.tokensOnDay;
    else if (sort === 'buckets') primary = b.bucketsOnDay - a.bucketsOnDay;
    if (primary !== 0) return primary;
    return a.day < b.day ? 1 : a.day > b.day ? -1 : 0;
  });

  let droppedTopDays = 0;
  let kept: SourceBreadthPerDayRow[] = allDays;
  if (top > 0 && kept.length > top) {
    droppedTopDays = kept.length - top;
    kept = kept.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    top,
    sort,
    distinctDays,
    totalTokens,
    sourceCountMin,
    sourceCountMax,
    sourceCountMean,
    sourceCountMedian,
    sourceCountP25,
    sourceCountP75,
    singleSourceDays,
    multiSourceDays,
    multiSourceShare,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedEmptySource,
    droppedTopDays,
    days: kept,
  };
}

/** Linear-interpolation percentile rounded to nearest int (counts are integer). */
function percentileInt(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = q * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const frac = idx - lo;
  return Math.round(sortedAsc[lo]! + frac * (sortedAsc[hi]! - sortedAsc[lo]!));
}
