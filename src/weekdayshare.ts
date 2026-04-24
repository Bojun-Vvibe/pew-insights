/**
 * weekday-share: token mass by ISO weekday (Mon=1..Sun=7), per
 * model or per source.
 *
 * For each (group, weekday) cell, sums `total_tokens` across the
 * window. Per group, computes share-of-tokens within that group's
 * 7-day distribution. Headline columns:
 *
 *   - share[0..6]: share of group tokens landing on each weekday
 *     (entries sum to ~1 ignoring fp noise)
 *   - peak weekday: index with the largest share
 *   - hhi: Herfindahl-Hirschman concentration index across the 7
 *     weekday shares, in [1/7, 1]. 1/7 = perfectly uniform week,
 *     1 = entire spend on one weekday. The "is this user a
 *     weekday-only worker, or 7-day uniform?" lens in a single
 *     scalar.
 *   - active weekdays: count of weekdays with > 0 tokens. 7 means
 *     every weekday saw activity in the window; 5 likely a
 *     Mon-Fri shape; 1 means the model only ever ran on one DOW.
 *
 * Why a fresh subcommand instead of folding into existing reports:
 *
 *   - `time-of-day` is hour-of-day collapsed across all weekdays.
 *     It cannot distinguish "Tuesdays at 14:00" from "Saturdays
 *     at 14:00".
 *   - `heatmap` is 24×7 normalised against the global cell maximum
 *     — useful for visualising hot cells but it deliberately
 *     squashes scale differences across models. You can't read
 *     "claude-opus is 90% Mon-Fri" off it.
 *   - `peak-hour-share` is *within-day* concentration, not
 *     across-week.
 *   - `streaks`, `velocity`, `concurrency`, `gaps` all look at
 *     temporal cadence at the second/minute scale, not
 *     day-of-week composition.
 *
 * Determinism: pure builder. `Date.now()` only via
 * `opts.generatedAt`. ISO weekday is computed in UTC from the
 * parsed `hour_start` — Sunday's UTC `getUTCDay()` is 0, which
 * we map to ISO weekday 7 so Monday is index 0 in the shares
 * array (caller-friendly Mon-first ordering). Rows whose
 * `hour_start` won't parse land in `droppedInvalidHourStart`.
 * Rows whose `total_tokens <= 0` land in `droppedZeroTokens`.
 *
 * The HHI scalar is the concentration headline (Herfindahl) —
 * sum of squared shares. For 7 buckets it's bounded in [1/7, 1].
 * Reporting it lets operators rank models by week-shape
 * concentration without eyeballing seven percentages each.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export type WeekdayShareDimension = 'model' | 'source';

export interface WeekdayShareOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Group rows by `model` (default) or by `source`.
   */
  by?: WeekdayShareDimension;
  /**
   * Drop group rows whose total token count is `< minTokens` from
   * `groups[]`. Display filter only — global denominators reflect
   * the full population. Default 0 (keep every group).
   */
  minTokens?: number;
  /**
   * Truncate `groups[]` to the top N by total tokens. Display
   * filter only. Default 0 (no truncation).
   */
  top?: number;
  /**
   * Drop groups whose `activeWeekdays` count is `< minActiveWeekdays`.
   * Display filter only — global denominators reflect the full
   * population. Default 1 (keep every group with any activity).
   *
   * Operationally useful for hiding the "this model only ever ran
   * on one weekday" long tail when ranking by HHI: a singleton-day
   * model trivially scores HHI = 1.0 and crowds out the top of an
   * `--by hhi` sort. Setting `--min-active-weekdays 5` keeps only
   * models with broad enough activity to make the HHI comparison
   * meaningful.
   */
  minActiveWeekdays?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface WeekdayShareGroupRow {
  /**
   * Group key. When `by === 'model'` this is the normalised model
   * id; when `by === 'source'` this is the raw source string.
   * Field name kept as `model` for downstream JSON consumer
   * symmetry with the size/share family.
   */
  model: string;
  /** Sum of total_tokens across all weekdays. */
  totalTokens: number;
  /** Token count per ISO weekday, indexed Mon=0..Sun=6. */
  tokensPerWeekday: number[];
  /** Share per ISO weekday, indexed Mon=0..Sun=6. Sums to ~1. */
  sharePerWeekday: number[];
  /** ISO weekday (0..6, Mon=0) with the largest share. */
  peakWeekday: number;
  /** Share value at peakWeekday (in [1/7, 1]). */
  peakShare: number;
  /** Distinct ISO weekdays with > 0 tokens (1..7). */
  activeWeekdays: number;
  /**
   * Herfindahl-Hirschman index across the 7 weekday shares.
   * In [1/7, 1]. 1/7 = perfectly uniform, 1 = single-weekday.
   */
  hhi: number;
}

export interface WeekdayShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved grouping dimension. */
  by: WeekdayShareDimension;
  /** Echo of the resolved minTokens floor. */
  minTokens: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved minActiveWeekdays floor. */
  minActiveWeekdays: number;
  /** Sum of total_tokens across all kept rows for the *global* row. */
  totalTokens: number;
  /** Tokens per ISO weekday across all rows (Mon=0..Sun=6). */
  globalTokensPerWeekday: number[];
  /** Shares per ISO weekday across all rows (Mon=0..Sun=6). */
  globalSharePerWeekday: number[];
  /** Peak weekday across all rows (Mon=0..Sun=6). */
  globalPeakWeekday: number;
  /** Peak share across all rows. */
  globalPeakShare: number;
  /** HHI across all rows. */
  globalHhi: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** Group rows hidden by the minTokens floor. */
  droppedGroupRows: number;
  /** Group rows hidden by the `top` cap (counted after minTokens). */
  droppedTopGroups: number;
  /** Group rows hidden by the minActiveWeekdays floor. */
  droppedSparseGroups: number;
  /**
   * One row per kept group. Sorted by total tokens desc, then
   * group key asc.
   */
  groups: WeekdayShareGroupRow[];
}

/**
 * Map UTC `getUTCDay()` (Sun=0..Sat=6) to ISO weekday Mon-first
 * (Mon=0..Sun=6). Sunday folds to 6.
 */
function isoWeekdayMonFirst(utcDay: number): number {
  // utcDay: 0=Sun, 1=Mon, ..., 6=Sat
  // mon-first: 0=Mon, 1=Tue, ..., 5=Sat, 6=Sun
  return (utcDay + 6) % 7;
}

function hhiOf(shares: number[]): number {
  let s = 0;
  for (const x of shares) s += x * x;
  return s;
}

export function buildWeekdayShare(
  queue: QueueLine[],
  opts: WeekdayShareOptions = {},
): WeekdayShareReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative number (got ${opts.minTokens})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minActiveWeekdays = opts.minActiveWeekdays ?? 1;
  if (
    !Number.isInteger(minActiveWeekdays) ||
    minActiveWeekdays < 1 ||
    minActiveWeekdays > 7
  ) {
    throw new Error(
      `minActiveWeekdays must be an integer in [1, 7] (got ${opts.minActiveWeekdays})`,
    );
  }
  const by: WeekdayShareDimension = opts.by ?? 'model';
  if (by !== 'model' && by !== 'source') {
    throw new Error(`by must be 'model' or 'source' (got ${opts.by})`);
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

  // group -> weekday(0..6) -> tokens
  const agg = new Map<string, number[]>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  const globalTokensPerWeekday = new Array<number>(7).fill(0);

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

    const utcDay = new Date(ms).getUTCDay();
    const wd = isoWeekdayMonFirst(utcDay);

    const groupKey =
      by === 'source'
        ? typeof q.source === 'string' && q.source !== ''
          ? q.source
          : 'unknown'
        : normaliseModel(typeof q.model === 'string' ? q.model : '');

    let buckets = agg.get(groupKey);
    if (!buckets) {
      buckets = new Array<number>(7).fill(0);
      agg.set(groupKey, buckets);
    }
    buckets[wd] = (buckets[wd] ?? 0) + tt;
    globalTokensPerWeekday[wd] = (globalTokensPerWeekday[wd] ?? 0) + tt;
  }

  const groups: WeekdayShareGroupRow[] = [];
  let droppedGroupRows = 0;
  let droppedSparseGroups = 0;

  for (const [group, buckets] of agg) {
    const total = buckets.reduce((acc, x) => acc + x, 0);
    if (total <= 0) continue;
    if (total < minTokens) {
      droppedGroupRows += 1;
      continue;
    }
    const shares = buckets.map((x) => x / total);
    let peakWd = 0;
    let peakShare = 0;
    let activeWd = 0;
    for (let i = 0; i < 7; i++) {
      const sv = shares[i] ?? 0;
      if (sv > peakShare) {
        peakShare = sv;
        peakWd = i;
      }
      if ((buckets[i] ?? 0) > 0) activeWd += 1;
    }
    if (activeWd < minActiveWeekdays) {
      droppedSparseGroups += 1;
      continue;
    }
    groups.push({
      model: group,
      totalTokens: total,
      tokensPerWeekday: buckets.slice(),
      sharePerWeekday: shares,
      peakWeekday: peakWd,
      peakShare,
      activeWeekdays: activeWd,
      hhi: hhiOf(shares),
    });
  }

  groups.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopGroups = 0;
  let kept = groups;
  if (top > 0 && groups.length > top) {
    droppedTopGroups = groups.length - top;
    kept = groups.slice(0, top);
  }

  const totalTokens = globalTokensPerWeekday.reduce((acc, x) => acc + x, 0);
  const globalSharePerWeekday =
    totalTokens > 0
      ? globalTokensPerWeekday.map((x) => x / totalTokens)
      : new Array<number>(7).fill(0);
  let globalPeakWd = 0;
  let globalPeakShare = 0;
  for (let i = 0; i < 7; i++) {
    const sv = globalSharePerWeekday[i] ?? 0;
    if (sv > globalPeakShare) {
      globalPeakShare = sv;
      globalPeakWd = i;
    }
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    minTokens,
    top,
    minActiveWeekdays,
    totalTokens,
    globalTokensPerWeekday,
    globalSharePerWeekday,
    globalPeakWeekday: totalTokens > 0 ? globalPeakWd : -1,
    globalPeakShare,
    globalHhi: totalTokens > 0 ? hhiOf(globalSharePerWeekday) : 0,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedGroupRows,
    droppedTopGroups,
    droppedSparseGroups,
    groups: kept,
  };
}

/** Mon-first ISO labels for renderers. */
export const WEEKDAY_LABELS_MON_FIRST: readonly string[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];
