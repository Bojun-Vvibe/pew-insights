/**
 * Consecutive same-source run-lengths.
 *
 * A "run" is a maximal contiguous stretch of sessions whose `source`
 * is identical, when sessions are ordered by `started_at` ascending.
 * The run-length distribution describes operator stickiness on a
 * given source: do you tend to do one session on a tool and switch,
 * or do you batch many sessions on the same source before moving on?
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `transitions` / `inter-source-handoff-latency` describe what
 *     happens *at* the boundary between two sources (which pair
 *     and how much time elapsed). They don't describe the *length*
 *     of the stretch on each side of the boundary.
 *   - `source-tenure` measures calendar tenure (first→last day a
 *     source was used at all). A source can have year-long tenure
 *     with run-lengths of 1 throughout — these are different
 *     operator behaviours.
 *   - `source-mix` / `source-decay-half-life` are about share over
 *     time, not about uninterrupted bursts.
 *   - `bucket-streak-length` counts contiguous *active buckets* per
 *     source from the queue (token bursts), not consecutive
 *     sessions of the same source from the session queue.
 *
 * The question this answers: when I sit down with source X, how
 * many sessions in a row do I spend with X before switching?
 *
 * What we emit:
 *
 *   - per-source run-length distribution: count of runs, mean,
 *     median, p90, p99, max run-length, and the share of all
 *     sessions that landed in single-session runs (length == 1)
 *     — the canonical "switched immediately" share.
 *   - global rollup with the same percentiles across all runs
 *     regardless of source.
 *   - longest-run sample per source: the started_at of the first
 *     session in that source's longest run, so the operator can
 *     locate it.
 *   - dropped-session counter for sessions with bad/missing
 *     `started_at` (can't be ordered) or empty `source`.
 *
 * Window semantics: filter by `started_at` to match
 * `transitions` / `gaps` / `session-lengths`. Runs are computed
 * on the post-filter session set so a window cut may split a run.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified (started_at asc, then session_key asc as the
 * tie-breaker so runs are stable when two sessions share a
 * started_at).
 */
import type { SessionLine } from './types.js';

export interface SourceRunLengthsOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop sources whose post-window run-count is `< n`. Default 1.
   * Sources whose run-count falls below this floor are counted
   * separately as `droppedSparseSources` and not emitted in
   * `sources[]`. Set higher to filter out sources with too few
   * runs to give a meaningful distribution.
   */
  minRuns?: number;
  /**
   * Optional display cap on the `sources[]` list after sort. The
   * cap is applied *after* the `minRuns` filter so it never hides
   * a source that already passed the structural floor through
   * accident; hidden rows surface as `droppedBelowTopCap`.
   * Default unset = no cap.
   */
  top?: number | null;
  /**
   * Optional source allowlist. When set, only sessions whose
   * `source` matches one of the listed values are considered.
   * Useful to ask "what does my run-length look like for just
   * sources X and Y?" without the noise from rare sources.
   * Counts of dropped-by-filter sessions surface as
   * `droppedByFilterSource`. Default unset = no source filter.
   */
  filterSources?: string[];
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRunLengthRow {
  source: string;
  runCount: number;
  /** Total sessions belonging to this source's runs. */
  sessionCount: number;
  meanRunLength: number;
  /** Quantile waypoints over this source's run-lengths (nearest-rank). */
  p50RunLength: number;
  p90RunLength: number;
  p99RunLength: number;
  maxRunLength: number;
  /**
   * Share of this source's sessions that fell in single-session
   * runs (length == 1) — the immediate-switch share. 0 when the
   * source has no sessions in window.
   */
  singleSessionRunShare: number;
  /** ISO `started_at` of the first session of this source's longest run. */
  longestRunStartedAt: string;
}

export interface SourceRunLengthsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minRuns: number;
  /** Resolved top cap (null = no cap). */
  top: number | null;
  /** Resolved source filter list (null = no filter). */
  filterSources: string[] | null;
  /** Sessions actually used to compute runs (post-window, post-filter, post-validity). */
  consideredSessions: number;
  /** Sessions dropped because of bad/missing `started_at`. */
  droppedInvalidStart: number;
  /** Sessions dropped because of empty `source`. */
  droppedEmptySource: number;
  /** Sessions dropped by the `--filter-source` allowlist. 0 when no filter set. */
  droppedByFilterSource: number;
  /** Sources excluded by the `minRuns` structural floor. */
  droppedSparseSources: number;
  /** Sources excluded by the `top` display cap (applied after `minRuns`). */
  droppedBelowTopCap: number;
  /** Total runs across all considered sources. */
  totalRuns: number;
  /** Global run-length quantiles across all runs (nearest-rank). */
  globalP50RunLength: number;
  globalP90RunLength: number;
  globalP99RunLength: number;
  globalMaxRunLength: number;
  globalMeanRunLength: number;
  /** Share of all considered sessions that fell in length-1 runs. */
  globalSingleSessionRunShare: number;
  /** Per-source rows, sorted by maxRunLength desc, then source asc. */
  sources: SourceRunLengthRow[];
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

interface Run {
  source: string;
  length: number;
  firstStartedAt: string;
}

export function buildSourceRunLengths(
  sessions: SessionLine[],
  opts: SourceRunLengthsOptions = {},
): SourceRunLengthsReport {
  const minRuns = opts.minRuns ?? 1;
  if (!Number.isFinite(minRuns) || minRuns < 1) {
    throw new Error(
      `minRuns must be a finite number >= 1 (got ${opts.minRuns})`,
    );
  }

  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isFinite(top) || top < 1 || !Number.isInteger(top)) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }

  let filterSet: Set<string> | null = null;
  if (opts.filterSources != null) {
    if (!Array.isArray(opts.filterSources) || opts.filterSources.length === 0) {
      throw new Error('filterSources must be a non-empty array when provided');
    }
    for (const s of opts.filterSources) {
      if (typeof s !== 'string' || s.length === 0) {
        throw new Error(`filterSources entries must be non-empty strings (got ${JSON.stringify(s)})`);
      }
    }
    filterSet = new Set(opts.filterSources);
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

  let droppedInvalidStart = 0;
  let droppedEmptySource = 0;
  let droppedByFilterSource = 0;

  type Considered = { source: string; startedAt: string; startedMs: number; sessionKey: string };
  const considered: Considered[] = [];
  for (const s of sessions) {
    const startedMs = Date.parse(s.started_at);
    if (!Number.isFinite(startedMs)) {
      droppedInvalidStart += 1;
      continue;
    }
    if (sinceMs !== null && startedMs < sinceMs) continue;
    if (untilMs !== null && startedMs >= untilMs) continue;
    if (typeof s.source !== 'string' || s.source.length === 0) {
      droppedEmptySource += 1;
      continue;
    }
    if (filterSet !== null && !filterSet.has(s.source)) {
      droppedByFilterSource += 1;
      continue;
    }
    considered.push({
      source: s.source,
      startedAt: s.started_at,
      startedMs,
      sessionKey: s.session_key,
    });
  }

  considered.sort((a, b) => {
    if (a.startedMs !== b.startedMs) return a.startedMs - b.startedMs;
    return a.sessionKey < b.sessionKey ? -1 : a.sessionKey > b.sessionKey ? 1 : 0;
  });

  const runs: Run[] = [];
  for (const c of considered) {
    const last = runs[runs.length - 1];
    if (last && last.source === c.source) {
      last.length += 1;
    } else {
      runs.push({ source: c.source, length: 1, firstStartedAt: c.startedAt });
    }
  }

  // Per-source aggregation.
  const perSource = new Map<string, Run[]>();
  for (const r of runs) {
    let arr = perSource.get(r.source);
    if (!arr) {
      arr = [];
      perSource.set(r.source, arr);
    }
    arr.push(r);
  }

  let droppedSparseSources = 0;
  const rowsAll: SourceRunLengthRow[] = [];
  for (const [source, sourceRuns] of perSource) {
    if (sourceRuns.length < minRuns) {
      droppedSparseSources += 1;
      continue;
    }
    const lengths = sourceRuns.map((r) => r.length);
    const sortedAsc = [...lengths].sort((a, b) => a - b);
    const sessionCount = lengths.reduce((a, b) => a + b, 0);
    const singleCount = lengths.filter((n) => n === 1).length;
    // Pick longest run; tie-break on earliest firstStartedAt for determinism.
    let longestRun = sourceRuns[0]!;
    for (const r of sourceRuns) {
      if (
        r.length > longestRun.length ||
        (r.length === longestRun.length && r.firstStartedAt < longestRun.firstStartedAt)
      ) {
        longestRun = r;
      }
    }
    rowsAll.push({
      source,
      runCount: sourceRuns.length,
      sessionCount,
      meanRunLength: sessionCount / sourceRuns.length,
      p50RunLength: nearestRank(sortedAsc, 0.5),
      p90RunLength: nearestRank(sortedAsc, 0.9),
      p99RunLength: nearestRank(sortedAsc, 0.99),
      maxRunLength: sortedAsc[sortedAsc.length - 1]!,
      singleSessionRunShare: sessionCount === 0 ? 0 : singleCount / sessionCount,
      longestRunStartedAt: longestRun.firstStartedAt,
    });
  }

  rowsAll.sort((a, b) => {
    if (b.maxRunLength !== a.maxRunLength) return b.maxRunLength - a.maxRunLength;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let rows = rowsAll;
  if (top !== null && rowsAll.length > top) {
    droppedBelowTopCap = rowsAll.length - top;
    rows = rowsAll.slice(0, top);
  }

  // Global rollup over all runs (regardless of cap / sparse filter — global
  // is the population-level view; per-source filters describe what we *show*,
  // not what the population is).
  const allLengths = runs.map((r) => r.length);
  const allSorted = [...allLengths].sort((a, b) => a - b);
  const totalSessions = allLengths.reduce((a, b) => a + b, 0);
  const totalSingle = allLengths.filter((n) => n === 1).length;

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minRuns,
    top,
    filterSources: filterSet === null ? null : [...filterSet].sort(),
    consideredSessions: considered.length,
    droppedInvalidStart,
    droppedEmptySource,
    droppedByFilterSource,
    droppedSparseSources,
    droppedBelowTopCap,
    totalRuns: runs.length,
    globalP50RunLength: nearestRank(allSorted, 0.5),
    globalP90RunLength: nearestRank(allSorted, 0.9),
    globalP99RunLength: nearestRank(allSorted, 0.99),
    globalMaxRunLength: allSorted.length === 0 ? 0 : allSorted[allSorted.length - 1]!,
    globalMeanRunLength: runs.length === 0 ? 0 : totalSessions / runs.length,
    globalSingleSessionRunShare: totalSessions === 0 ? 0 : totalSingle / totalSessions,
    sources: rows,
  };
}
