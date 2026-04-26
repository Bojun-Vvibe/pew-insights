/**
 * cumulative-tokens-midpoint: for each source, locate the day at
 * which the *cumulative* token total crosses 50% of the source's
 * lifetime tokens, then express that day's position as a
 * **percentile of the source's own tenure window** (calendar
 * `[firstActiveDay, lastActiveDay]`, inclusive, gap-filled with
 * zero-token days).
 *
 * Headline value `midpointPctTenure` lives in `[0, 1]`:
 *
 *   - ~0.50  →  the source emitted tokens at a roughly uniform
 *               daily rate across its whole tenure (Lorenz-symmetric).
 *   - <0.50  →  **front-loaded**: half the lifetime tokens were
 *               already burned before the calendar midpoint of the
 *               source's tenure.
 *   - >0.50  →  **back-loaded**: the source warmed up slowly and
 *               most tokens piled into the late portion of its life.
 *
 * Why a separate subcommand:
 *
 *   - `source-debut-recency` reports `debutShare` = tokens in the
 *     **first 25% (fixed window)** of tenure. It cannot tell you
 *     whether mass crossed 50% at day 0.30 vs day 0.45 of the
 *     tenure — both look identical under a quartile floor.
 *   - `source-decay-half-life` (if present) measures *count-based*
 *     half-life on activity counts; this is **token-mass-based** and
 *     is anchored to the calendar tenure axis, not the active-day
 *     axis. The two diverge for sparse sources.
 *   - `bucket-token-gini` is a single inequality scalar across all
 *     buckets globally; it does not localise *where* on each
 *     source's timeline the inequality shows up.
 *   - `daily-token-autocorrelation-lag1` measures day-to-day
 *     persistence (does today predict tomorrow), not where in the
 *     life-cycle mass concentrates.
 *
 * Two related diagnostics are surfaced on the same row:
 *
 *   - `midpointDayIndex` (0-based) — the integer day index inside
 *     `[firstActiveDay, lastActiveDay]` whose **inclusive** running
 *     total first equals or exceeds 50% of `tokens`. Always in
 *     `[0, tenureDays - 1]`.
 *   - `midpointDayIso` — ISO date (`YYYY-MM-DDT00:00:00.000Z`) of
 *     that day, computed from `firstActiveDay` + `midpointDayIndex`
 *     in UTC days.
 *
 * Edge cases:
 *
 *   - Single-day sources: `tenureDays = 1`, `midpointDayIndex = 0`,
 *     `midpointPctTenure = 0` (the half-mass crossing happens on
 *     the only day; we report 0 to mean "at the very start"). They
 *     are flagged with `singleDay=true` so the operator can ignore
 *     them when reading the leaderboard.
 *   - Sources with `tokens = 0` after filtering would be impossible
 *     (we already drop zero-token rows). Defensive guard returns
 *     no row.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Source ordering on output: per `opts.sort` (default `tokens` desc),
 * with deterministic tiebreaks.
 */
import type { QueueLine } from './types.js';

export interface CumulativeTokensMidpointOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many distinct tokens-bearing
   * **calendar days** from the per-source table. Display filter only
   * — global denominators reflect the full kept population.
   * Suppressed rows surface as `droppedBelowMinDays`. Default 1.
   */
  minDays?: number;
  /**
   * Cap the per-source table to the top N rows after sort + minDays
   * floor. Suppressed rows surface as `droppedBelowTopCap`.
   * Default null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokens desc.
   *   - 'midpoint':         midpointPctTenure asc (most front-loaded
   *                         first; ties on tokens desc).
   *   - 'tenure':           tenureDays desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'midpoint' | 'tenure' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface CumulativeTokensMidpointRow {
  source: string;
  tokens: number;
  firstActiveDay: string;
  lastActiveDay: string;
  /** Distinct tokens-bearing calendar days. */
  activeDays: number;
  /** Calendar tenure span in days, inclusive. >=1. */
  tenureDays: number;
  /** 0-based day index inside the tenure span where cum tokens first crosses 50%. */
  midpointDayIndex: number;
  /** ISO date of midpointDayIndex (UTC, YYYY-MM-DDT00:00:00.000Z). */
  midpointDayIso: string;
  /**
   * midpointDayIndex / max(1, tenureDays - 1). In [0, 1].
   * 0 = crossed on the first day; 1 = crossed on the last day.
   */
  midpointPctTenure: number;
  /** True iff tenureDays === 1. */
  singleDay: boolean;
}

export interface CumulativeTokensMidpointReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minDays: number;
  top: number | null;
  sort: 'tokens' | 'midpoint' | 'tenure' | 'source';
  /** Distinct sources that survived filters (pre minDays floor). */
  totalSources: number;
  /** Sum of total_tokens across the full kept population. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  droppedBelowMinDays: number;
  droppedBelowTopCap: number;
  sources: CumulativeTokensMidpointRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

function dayKeyToIso(k: number): string {
  return new Date(k * DAY_MS).toISOString();
}

export function buildCumulativeTokensMidpoint(
  queue: QueueLine[],
  opts: CumulativeTokensMidpointOptions = {},
): CumulativeTokensMidpointReport {
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
  const sort = opts.sort ?? 'tokens';
  if (
    sort !== 'tokens' &&
    sort !== 'midpoint' &&
    sort !== 'tenure' &&
    sort !== 'source'
  ) {
    throw new Error(
      `sort must be 'tokens' | 'midpoint' | 'tenure' | 'source' (got ${opts.sort})`,
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

  // Per-source: dayKey -> tokens
  const perSource = new Map<string, Map<number, number>>();

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

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let acc = perSource.get(source);
    if (!acc) {
      acc = new Map<number, number>();
      perSource.set(source, acc);
    }
    const dk = dayKey(ms);
    acc.set(dk, (acc.get(dk) ?? 0) + tt);
  }

  const allRows: CumulativeTokensMidpointRow[] = [];
  let totalTokens = 0;

  for (const [source, perDay] of perSource.entries()) {
    if (perDay.size === 0) continue;
    const days = [...perDay.keys()].sort((a, b) => a - b);
    const firstDay = days[0]!;
    const lastDay = days[days.length - 1]!;
    const tenureDays = lastDay - firstDay + 1;

    let srcTokens = 0;
    for (const v of perDay.values()) srcTokens += v;
    if (srcTokens <= 0) continue;
    totalTokens += srcTokens;

    // Walk the calendar [firstDay, lastDay] inclusively, gap-filling
    // with 0, accumulating until we cross half-mass.
    const half = srcTokens / 2;
    let running = 0;
    let midpointDayIndex = 0;
    for (let i = 0; i < tenureDays; i += 1) {
      const dk = firstDay + i;
      running += perDay.get(dk) ?? 0;
      if (running >= half) {
        midpointDayIndex = i;
        break;
      }
    }

    const singleDay = tenureDays === 1;
    const midpointPctTenure = singleDay
      ? 0
      : midpointDayIndex / (tenureDays - 1);

    allRows.push({
      source,
      tokens: srcTokens,
      firstActiveDay: dayKeyToIso(firstDay),
      lastActiveDay: dayKeyToIso(lastDay),
      activeDays: perDay.size,
      tenureDays,
      midpointDayIndex,
      midpointDayIso: dayKeyToIso(firstDay + midpointDayIndex),
      midpointPctTenure,
      singleDay,
    });
  }

  // Apply minDays (on activeDays — distinct tokens-bearing days).
  let droppedBelowMinDays = 0;
  const survived: CumulativeTokensMidpointRow[] = [];
  for (const row of allRows) {
    if (row.activeDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'midpoint') {
      primary = a.midpointPctTenure - b.midpointPctTenure;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'tenure') {
      primary = b.tenureDays - a.tenureDays;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else {
      // 'source'
      primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    }
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
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedBelowMinDays,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
