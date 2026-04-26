/**
 * source-day-of-week-token-mass-share: per-source distribution of
 * total token mass across the 7 days of the week (UTC).
 *
 * For each source we collapse every hourly bucket into a length-7
 * vector indexed by UTC day-of-week (0 = Sunday .. 6 = Saturday),
 *
 *   D_d = sum_{rows with utc-dow = d} total_tokens     (d in 0..6)
 *
 * and report the share vector
 *
 *   share_d = D_d / sum_d D_d                          (sums to 1)
 *
 * along with three derived concentration metrics:
 *
 *   - dominantDow / dominantShare: argmax_d share_d, max_d share_d.
 *     Lower bound 1/7 ≈ 0.1429 (uniform), upper bound 1
 *     (all mass on one weekday).
 *   - weekendShare = share_0 + share_6 (Sun + Sat, UTC). Uniform
 *     baseline is 2/7 ≈ 0.2857. Above => weekend-skewed; below =>
 *     weekday-skewed.
 *   - normalizedEntropy = H / ln(7), where H is the Shannon entropy
 *     of the share vector. Range [0, 1]; 1 = uniform across all
 *     7 weekdays, 0 = all mass on a single weekday. This is a
 *     *non-circular* concentration measure — the day-of-week axis
 *     is treated as 7 categorical bins, not as a 7-cycle, because
 *     adjacency (Sun next to Sat) is rarely meaningful for
 *     token-mass workload patterns.
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `weekday-share` and `weekend-vs-weekday` are *global* (not
 *     per-source) and report a single aggregate share. They cannot
 *     answer "does codex skew weekend while ide-assistant-A is
 *     weekday-only?".
 *   - `source-token-mass-hour-centroid` and
 *     `source-hour-of-day-topk-mass-share` are *hour-of-day* axes,
 *     a totally different axis from day-of-week.
 *   - `daily-token-*` family (gini, autocorr, monotone-runs, etc.)
 *     operate on the *date* axis (each calendar day is its own bin).
 *     They mix DOW with epoch — a source with a 6-month run will
 *     have its DOW signal smeared across many calendar days.
 *     This subcommand collapses the date axis and keeps only the
 *     7-cycle signal.
 *   - `source-active-day-streak`, `source-decay-half-life`,
 *     `source-dry-spell` are temporal recency metrics, not weekday
 *     concentration.
 *
 * Headline question:
 * **"Within each source's lifetime token mass, how is it
 *   distributed across the 7 weekdays — and which sources are
 *   weekend-skewed vs weekday-skewed?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface
 *     as `droppedSourceFilter`.
 *   - `minTokens` (default 1000): structural floor on total token
 *     mass for a row to be reported. Sparse sources surface as
 *     `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'dominant' |
 *     'weekend' | 'entropy' | 'source'.
 *   - `tz` is intentionally NOT a knob: weekday is read from the
 *     UTC timestamp via `Date.getUTCDay()`, matching every other
 *     time-axis stat in this codebase.
 */
import type { QueueLine } from './types.js';

export type SourceDayOfWeekTokenMassShareSort =
  | 'tokens'
  | 'dominant'
  | 'weekend'
  | 'entropy'
  | 'source';

export interface SourceDayOfWeekTokenMassShareOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceDayOfWeekTokenMassShareSort;
  /**
   * Display filter (refinement, v0.6.41): drop rows whose
   * `weekendShare` is strictly below this threshold.
   * Useful for surfacing only weekend-skewed sources.
   * Range [0, 1]; default 0 = no filter.
   */
  minWeekendShare?: number;
  generatedAt?: string;
}

export interface SourceDayOfWeekTokenMassShareSourceRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC days seen. */
  nDays: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Token-mass share for each weekday, 0=Sun..6=Sat. Sums to 1. */
  shares: [number, number, number, number, number, number, number];
  /** UTC weekday with the largest share. */
  dominantDow: number;
  dominantShare: number;
  /** share[0] + share[6]. */
  weekendShare: number;
  /** Shannon entropy of the share vector / ln(7). Range [0, 1]. */
  normalizedEntropy: number;
}

export interface SourceDayOfWeekTokenMassShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceDayOfWeekTokenMassShareSort;
  minWeekendShare: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  uniformBaseline: number; // 1/7
  weekendUniformBaseline: number; // 2/7
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinWeekendShare: number;
  droppedTopSources: number;
  sources: SourceDayOfWeekTokenMassShareSourceRow[];
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export function dowName(d: number): string {
  if (!Number.isInteger(d) || d < 0 || d > 6) return '?';
  return DOW_NAMES[d]!;
}

/**
 * Shannon entropy of a non-negative share vector, normalized by
 * ln(n). Returns 0 for the empty/zero case, 1 for uniform.
 */
export function normalizedShannonEntropy(shares: number[]): number {
  if (shares.length === 0) return 0;
  const total = shares.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (!(total > 0)) return 0;
  let h = 0;
  for (const s of shares) {
    if (s <= 0) continue;
    const p = s / total;
    h -= p * Math.log(p);
  }
  const denom = Math.log(shares.length);
  if (denom <= 0) return 0;
  return Math.min(1, Math.max(0, h / denom));
}

export function buildSourceDayOfWeekTokenMassShare(
  queue: QueueLine[],
  opts: SourceDayOfWeekTokenMassShareOptions = {},
): SourceDayOfWeekTokenMassShareReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minWeekendShare = opts.minWeekendShare ?? 0;
  if (
    !Number.isFinite(minWeekendShare) ||
    minWeekendShare < 0 ||
    minWeekendShare > 1
  ) {
    throw new Error(
      `minWeekendShare must be a finite number in [0, 1] (got ${opts.minWeekendShare})`,
    );
  }
  const sort: SourceDayOfWeekTokenMassShareSort = opts.sort ?? 'tokens';
  const validSorts: SourceDayOfWeekTokenMassShareSort[] = [
    'tokens',
    'dominant',
    'weekend',
    'entropy',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(`sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
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

  interface SrcAcc {
    mass: number[]; // length 7
    days: Set<string>;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
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
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const dow = new Date(ms).getUTCDay();
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        mass: new Array(7).fill(0),
        days: new Set<string>(),
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.mass[dow] = (acc.mass[dow] ?? 0) + tt;
    acc.totalTokens += tt;
    acc.days.add(day);
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokensSum = 0;
  const rows: SourceDayOfWeekTokenMassShareSourceRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    const total = acc.totalTokens;
    const shares = acc.mass.map((m) => (total > 0 ? m / total : 0)) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    let dominantDow = 0;
    let dominantShare = -1;
    for (let d = 0; d < 7; d++) {
      const s = shares[d]!;
      if (s > dominantShare) {
        dominantShare = s;
        dominantDow = d;
      }
    }
    const weekendShare = (shares[0] ?? 0) + (shares[6] ?? 0);
    const normalizedEntropy = normalizedShannonEntropy(acc.mass);
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nDays: acc.days.size,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      shares,
      dominantDow,
      dominantShare: Math.max(0, dominantShare),
      weekendShare,
      normalizedEntropy,
    });
    totalTokensSum += acc.totalTokens;
  }

  // refinement filter (v0.6.41)
  let droppedBelowMinWeekendShare = 0;
  let filtered = rows;
  if (minWeekendShare > 0) {
    const next: SourceDayOfWeekTokenMassShareSourceRow[] = [];
    for (const r of rows) {
      if (r.weekendShare >= minWeekendShare) next.push(r);
      else droppedBelowMinWeekendShare += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'dominant':
        primary = b.dominantShare - a.dominantShare;
        break;
      case 'weekend':
        primary = b.weekendShare - a.weekendShare;
        break;
      case 'entropy':
        primary = a.normalizedEntropy - b.normalizedEntropy; // low entropy = concentrated => first
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    top,
    sort,
    minWeekendShare,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    uniformBaseline: 1 / 7,
    weekendUniformBaseline: 2 / 7,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinWeekendShare,
    droppedTopSources,
    sources: kept,
  };
}
