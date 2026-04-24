/**
 * peak-hour-share: per-model concentration of token spend in each
 * day's busiest 1-hour window.
 *
 * For every (group, day-UTC) pair in the window, we sum
 * `total_tokens` per hour-of-day, find the single hour with the
 * largest sum, and record that hour's share of the day's total.
 * The per-day share is then aggregated per group as mean / p50 /
 * p95 / max, and we also surface the modal peak hour (which hour
 * of the 24-hour clock most commonly came out on top).
 *
 * Why a fresh subcommand instead of folding into existing reports:
 *
 *   - `time-of-day` reports the *distribution* of session start
 *     times across hours, with shares that sum to 1 over the
 *     whole window. That answers "when do I work?" — but it
 *     can't answer "is my work spiky or smooth on a given day?"
 *     because everything is collapsed to one big histogram.
 *   - `heatmap` shows weekday × hour cells but always normalised
 *     against the global cell maximum, so a model that's bursty
 *     on Tuesdays and a model that's bursty on Sundays look
 *     identical once you isolate to the per-day per-hour view.
 *   - `output-size` / `prompt-size` are size-of-call lenses, not
 *     concentration-in-time lenses.
 *   - `concurrency`, `velocity`, `gaps`, `idle-gaps` look at
 *     between-session timing, not within-day clustering of
 *     token spend.
 *
 * The peak-hour-share view is the "spikiness" lens. It answers
 * questions the existing reports literally cannot:
 *
 *   - "On a typical day, what fraction of this model's tokens
 *     hit in its single busiest hour?" — a high mean (say >
 *     50%) means batch-style workload concentrated into one
 *     burst; a low mean (say ~10%) means smoothly spread.
 *   - "Which hour-of-the-clock most often holds the daily peak
 *     for this model?" — operationally useful for rate-limit
 *     planning and provider-side capacity scheduling.
 *   - "What's the worst-case daily concentration?" (the p95 /
 *     max columns) — a 100% day means the entire day's spend
 *     for that model arrived inside one hour. Worth knowing
 *     for cost-spike investigation.
 *
 * Determinism: pure builder. No `Date.now()` reads (override
 * via `opts.generatedAt`). All sorts fully specified. Days are
 * bucketed in UTC against the first 10 chars of `hour_start`
 * (`YYYY-MM-DD`); hours via the substring `hour_start.slice(11,
 * 13)` parsed as 0..23. Rows whose `hour_start` does not match
 * the expected ISO shape land in `droppedInvalidHourStart` and
 * never affect any percentile, mean, or share. Rows whose
 * `total_tokens <= 0` land in `droppedZeroTokens` for the same
 * reason — a zero-token row contributes no signal to "which
 * hour was busiest" and would only inflate denominators.
 *
 * Singleton-day handling: a (group, day) pair with only one
 * active hour trivially has peak-share 1.0. That's a real and
 * operationally meaningful answer ("100% of today's spend for
 * this model arrived in one hour"), so it is kept by default.
 * The `--min-active-hours` flag exists for operators who want
 * to scope to multi-hour days only — useful when comparing
 * "true spikiness" across models with different baseline
 * activity levels. Days dropped by that floor surface as
 * `droppedSingletonDays` for visibility.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export type PeakHourDimension = 'model' | 'source';

export interface PeakHourOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Group rows by `model` (default — normalised model id) or by
   * `source` (the producer string: `claude-code`, `codex`,
   * `opencode`, ...). Source-grouping answers the orthogonal
   * "which CLI is bursty?" question.
   */
  by?: PeakHourDimension;
  /**
   * Drop group rows whose day-count is `< minDays` from `groups[]`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 (keep every group).
   */
  minDays?: number;
  /**
   * Truncate `groups[]` to the top N by day count. Display filter
   * only. Default 0 (no truncation).
   */
  top?: number;
  /**
   * Drop (group, day) pairs whose distinct active-hour count is
   * `< minActiveHours` BEFORE peak-share is recorded. Default 1
   * (every day with any activity counts; singleton-hour days
   * trivially score 1.0). Bump to e.g. 3 to scope the
   * concentration metric to days with at least 3 different
   * active hours. Days dropped here surface as
   * `droppedSingletonDays`.
   */
  minActiveHours?: number;
  /**
   * Width of the "peak window" in hours, in [1, 24]. Default 1
   * — the historical "busiest single hour" lens. Bumping to
   * e.g. 3 generalises the metric: for each day the K
   * highest-token hours are summed and divided by the day's
   * total. Useful for answering "what fraction of the day's
   * spend lands in my busiest 3 hours?" — a smoothly-spread
   * model rises slowly with K (a perfectly uniform 24-hour
   * model goes K/24), while a bursty one saturates at 100%
   * almost immediately. The picked hours are NOT required to
   * be contiguous: this is the empirical-quantile lens, not a
   * sliding-window lens. K must be <= 24; K === 24 always
   * yields share == 1.0 (and the metric becomes degenerate).
   * The chosen K is enforced against `minActiveHours` (the
   * day must have at least K active hours to be included),
   * and overrides `minActiveHours` upward when K > minActiveHours
   * — selecting the top-K of fewer-than-K active hours would
   * over-count zeroes.
   */
  peakWindowHours?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface PeakHourGroupRow {
  /**
   * Group key. When `by === 'model'` this is the normalised model
   * id; when `by === 'source'` this is the raw source string.
   * Field name kept as `model` for downstream JSON consumer
   * symmetry with the size/share family.
   */
  model: string;
  /** Number of (group, day) pairs that contributed a peak-share. */
  days: number;
  /** Sum of total_tokens across those days. */
  totalTokens: number;
  /**
   * Arithmetic mean of per-day peak shares in [0, 1]. 0 when
   * `days === 0`.
   */
  meanPeakShare: number;
  /** Approximate 50th percentile (median) of per-day peak shares. */
  p50PeakShare: number;
  /** Approximate 95th percentile (nearest-rank) of per-day peak shares. */
  p95PeakShare: number;
  /** Maximum per-day peak share observed. */
  maxPeakShare: number;
  /**
   * Hour-of-day (UTC, 0..23) that most often held the daily peak
   * for this group. Ties broken by lowest hour. -1 when
   * `days === 0`.
   */
  modalPeakHour: number;
  /**
   * Number of days where `modalPeakHour` was the actual daily
   * peak. `modalPeakHourCount / days` is "how dominant is the
   * favourite hour".
   */
  modalPeakHourCount: number;
}

export interface PeakHourReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved grouping dimension. */
  by: PeakHourDimension;
  /** Echo of the resolved minDays floor. */
  minDays: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved minActiveHours floor. */
  minActiveHours: number;
  /** Echo of the resolved peakWindowHours width (1 = legacy single-hour lens). */
  peakWindowHours: number;
  /** Distinct (group, day) pairs that contributed. */
  consideredDays: number;
  /** Sum of total_tokens across all considered (group, day) pairs. */
  totalTokens: number;
  /**
   * Token-count-weighted mean of per-day peak shares across the
   * full considered population. Differs from a simple mean of
   * per-group means when day counts vary across groups; this
   * one answers "for an arbitrary token, what's the share of
   * its day that hit in its group's peak hour?".
   */
  overallMeanPeakShare: number;
  /** Largest peak share seen anywhere. */
  overallMaxPeakShare: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** (group, day) pairs dropped by `minActiveHours`. */
  droppedSingletonDays: number;
  /** Group rows hidden by the minDays floor. */
  droppedGroupRows: number;
  /** Group rows hidden by the `top` cap (counted after minDays). */
  droppedTopGroups: number;
  /**
   * One row per kept group. Sorted by day count desc, then
   * group key asc.
   */
  groups: PeakHourGroupRow[];
}

function p50(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  // Nearest-rank (lower-median) for symmetry with p95.
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(0.5 * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

function p95(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil(0.95 * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)]!;
}

/**
 * Parse the day key (UTC YYYY-MM-DD) and hour (0..23) from an
 * ISO-8601 `hour_start`. Returns null when the string is not
 * a recognised ISO instant. Uses `Date.parse` for the validity
 * gate so we never accept malformed input that just happens to
 * have plausible substrings, then derives the day & hour from
 * the parsed instant in UTC for true tz-stability.
 */
function parseDayAndHour(hourStart: string): { day: string; hour: number } | null {
  const ms = Date.parse(hourStart);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const day = d.toISOString().slice(0, 10);
  const hour = d.getUTCHours();
  return { day, hour };
}

export function buildPeakHourShare(
  queue: QueueLine[],
  opts: PeakHourOptions = {},
): PeakHourReport {
  const minDays = opts.minDays ?? 0;
  if (!Number.isInteger(minDays) || minDays < 0) {
    throw new Error(`minDays must be a non-negative integer (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minActiveHoursRaw = opts.minActiveHours ?? 1;
  if (
    !Number.isInteger(minActiveHoursRaw) ||
    minActiveHoursRaw < 1 ||
    minActiveHoursRaw > 24
  ) {
    throw new Error(
      `minActiveHours must be an integer in [1, 24] (got ${opts.minActiveHours})`,
    );
  }
  const peakWindowHours = opts.peakWindowHours ?? 1;
  if (
    !Number.isInteger(peakWindowHours) ||
    peakWindowHours < 1 ||
    peakWindowHours > 24
  ) {
    throw new Error(
      `peakWindowHours must be an integer in [1, 24] (got ${opts.peakWindowHours})`,
    );
  }
  // Selecting the top-K of fewer-than-K active hours would
  // count "missing" hours as zero against the day total — the
  // share is still mathematically defined but the operator
  // signal degrades. Pull the floor up to K silently here so
  // the metric stays apples-to-apples; the caller's chosen
  // floor is still respected as a *minimum*.
  const minActiveHours = Math.max(minActiveHoursRaw, peakWindowHours);
  const by: PeakHourDimension = opts.by ?? 'model';
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

  // group -> day -> hour (0..23) -> tokens
  const agg = new Map<string, Map<string, number[]>>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;

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

    const dh = parseDayAndHour(q.hour_start);
    if (dh === null) {
      // Already covered by Date.parse above, but keep the guard
      // so the type narrows and a future schema drift can't
      // silently miscount.
      droppedInvalidHourStart += 1;
      continue;
    }

    const groupKey =
      by === 'source'
        ? typeof q.source === 'string' && q.source !== ''
          ? q.source
          : 'unknown'
        : normaliseModel(typeof q.model === 'string' ? q.model : '');

    let dayMap = agg.get(groupKey);
    if (!dayMap) {
      dayMap = new Map<string, number[]>();
      agg.set(groupKey, dayMap);
    }
    let hours = dayMap.get(dh.day);
    if (!hours) {
      hours = new Array(24).fill(0) as number[];
      dayMap.set(dh.day, hours);
    }
    hours[dh.hour] = (hours[dh.hour] ?? 0) + tt;
  }

  const groups: PeakHourGroupRow[] = [];
  let droppedGroupRows = 0;
  let droppedSingletonDays = 0;
  let consideredDays = 0;
  let totalTokens = 0;
  let overallMaxPeakShare = 0;
  let weightedShareNumer = 0;
  let weightedShareDenom = 0;

  for (const [group, dayMap] of agg) {
    const peakShares: number[] = [];
    const peakHourCounts = new Array(24).fill(0) as number[];
    let groupDays = 0;
    let groupTokens = 0;

    for (const [, hours] of dayMap) {
      let dayTotal = 0;
      let activeHours = 0;
      let peakHour = 0;
      let peakTokens = 0;
      for (let h = 0; h < 24; h++) {
        const v = hours[h] ?? 0;
        if (v > 0) {
          activeHours += 1;
          dayTotal += v;
          if (v > peakTokens) {
            peakTokens = v;
            peakHour = h;
          }
        }
      }
      if (activeHours < minActiveHours) {
        droppedSingletonDays += 1;
        continue;
      }
      if (dayTotal <= 0) {
        // Defensive: should never happen because we filter
        // total_tokens <= 0 above, but keep the guard so a
        // future schema drift can't divide by zero.
        droppedSingletonDays += 1;
        continue;
      }
      // Top-K peak window. K === 1 collapses to the legacy
      // single-hour share (peakTokens / dayTotal); K > 1 sums
      // the K largest hours by token mass. The picked hours
      // need not be contiguous — empirical-quantile lens, not
      // sliding-window. Sort descending and take K (we already
      // know activeHours >= peakWindowHours via minActiveHours,
      // so we never sum a synthetic zero into the numerator).
      const peakSum =
        peakWindowHours === 1
          ? peakTokens
          : hours
              .slice()
              .sort((a, b) => b - a)
              .slice(0, peakWindowHours)
              .reduce((acc, x) => acc + x, 0);
      const share = peakSum / dayTotal;
      peakShares.push(share);
      peakHourCounts[peakHour] = (peakHourCounts[peakHour] ?? 0) + 1;
      groupDays += 1;
      groupTokens += dayTotal;
      consideredDays += 1;
      totalTokens += dayTotal;
      // Token-weighted overall mean: each day contributes its
      // share weighted by its token volume. Heavy days move
      // the overall number more — operationally what you want
      // when answering "what fraction of an arbitrary token's
      // day arrived in the peak hour".
      weightedShareNumer += share * dayTotal;
      weightedShareDenom += dayTotal;
      if (share > overallMaxPeakShare) overallMaxPeakShare = share;
    }

    if (groupDays === 0) continue;

    if (groupDays < minDays) {
      droppedGroupRows += 1;
      continue;
    }

    const sorted = peakShares.slice().sort((a, b) => a - b);
    let modalHour = -1;
    let modalCount = 0;
    for (let h = 0; h < 24; h++) {
      const c = peakHourCounts[h] ?? 0;
      if (c > modalCount) {
        modalCount = c;
        modalHour = h;
      }
    }
    const meanShare =
      peakShares.reduce((acc, x) => acc + x, 0) / peakShares.length;

    groups.push({
      model: group,
      days: groupDays,
      totalTokens: groupTokens,
      meanPeakShare: meanShare,
      p50PeakShare: p50(sorted),
      p95PeakShare: p95(sorted),
      maxPeakShare: sorted[sorted.length - 1] ?? 0,
      modalPeakHour: modalHour,
      modalPeakHourCount: modalCount,
    });
  }

  groups.sort((a, b) => {
    if (b.days !== a.days) return b.days - a.days;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  let droppedTopGroups = 0;
  let kept = groups;
  if (top > 0 && groups.length > top) {
    droppedTopGroups = groups.length - top;
    kept = groups.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    by,
    minDays,
    top,
    minActiveHours,
    peakWindowHours,
    consideredDays,
    totalTokens,
    overallMeanPeakShare:
      weightedShareDenom === 0 ? 0 : weightedShareNumer / weightedShareDenom,
    overallMaxPeakShare,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSingletonDays,
    droppedGroupRows,
    droppedTopGroups,
    groups: kept,
  };
}
