/**
 * daily-token-second-difference-sign-runs: per-source longest run
 * of consecutive same-sign **second differences** of daily total
 * tokens. The second difference at day i (for i >= 2 in the
 * source's active-day series) is
 *
 *   d2[i] = (v[i] - v[i-1]) - (v[i-1] - v[i-2])
 *         = v[i] - 2 * v[i-1] + v[i-2]
 *
 * Its sign classifies the local *concavity* of the trajectory:
 *
 *   - sign(d2) > 0  ->  'concaveup'  (acceleration: increases are
 *     getting bigger or decreases are shrinking; the curve bends
 *     upward).
 *   - sign(d2) < 0  ->  'concavedown' (deceleration: increases are
 *     shrinking or decreases are getting steeper; the curve bends
 *     downward).
 *   - sign(d2) == 0 -> 'flat' (linear segment: equal step sizes).
 *
 * A "sign run" is a maximal consecutive sequence of same-sign
 * second differences. Length is **number of d2 points** in the
 * run (so length k spans k+2 active days). 'flat' steps break
 * concaveup/concavedown runs in both directions and start their
 * own flat runs (we report flat runs separately for completeness
 * but they are usually rare in real token series).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `daily-token-monotone-run-length` looks at the sign of the
 *     **first** difference (velocity regime: "is this source going
 *     up or down today?"). A series 1,2,4,8,16 has monotone-up
 *     length 5 *and* concaveup length 3. A series 1,2,3,4,5 also
 *     has monotone-up length 5 but concaveup length 0 (all d2 == 0)
 *     -> linear, not accelerating. Monotone-run cannot distinguish
 *     "climbing linearly" from "climbing exponentially". This
 *     subcommand exactly does.
 *   - `daily-token-autocorrelation-lag1` is a global mean-shape
 *     statistic on the level series; it is silent about local
 *     concavity persistence. Two series with identical rho1 can
 *     have radically different concaveup-run distributions.
 *   - `daily-token-zscore-extremes` is a tail-event count on the
 *     level distribution. It cannot see "this source has been
 *     decelerating for 6 days straight" if no individual day is
 *     extreme.
 *   - `trend` / `forecast` fit a *linear* drift; their residuals
 *     contain whatever curvature exists, but they don't surface
 *     "the longest unbroken stretch of accelerating growth".
 *   - `burstiness`, `rolling-bucket-cv`, `bucket-token-gini` are
 *     order-free dispersion statistics; permuting daily values
 *     leaves them unchanged but destroys d2-sign runs in
 *     expectation.
 *
 * Headline question:
 * **"What is the longest unbroken stretch this source has spent
 *   in a single concavity regime — accelerating or decelerating —
 *   and which regime is it in right now?"**
 *
 * Concretely, for each source:
 *
 *   1. Aggregate per UTC calendar day (`hour_start[0..10]`):
 *      tokens summed across all device/model rows for that day.
 *      Days with non-positive tokens are dropped (consistent with
 *      monotone-run-length / autocorrelation-lag1).
 *   2. Sort active days ascending. If fewer than `minDays` days
 *      remain (default 3 — need at least 3 to have one d2 point),
 *      drop the source as `droppedSparseSources`.
 *   3. Compute the d2 series of length `nActiveDays - 2`. Classify
 *      each point as 'concaveup' / 'concavedown' / 'flat'.
 *   4. Find longest maximal same-sign run for each of the three
 *      classes. Earliest tie wins -> deterministic.
 *   5. Trailing run: the run ending on the *last* d2 point. Maps
 *      to `currentRegime` and `currentRunLength`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to one source (others surface as
 *     `droppedSourceFilter`).
 *   - `minDays` (default 3): structural floor; need at least 3
 *     active days for any d2 point to exist. Sparse sources
 *     surface as `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`
 *     after sort. Suppressed surface as `droppedTopSources`.
 *   - `sort`: `'tokens'` (default) | `'longest'` | `'concaveup'` |
 *     `'concavedown'` | `'flat'` | `'current'` | `'ndays'` |
 *     `'source'`.
 */
import type { QueueLine } from './types.js';

export type ConcavityRegime = 'concaveup' | 'concavedown' | 'flat';

export type SecondDiffSignRunsSort =
  | 'tokens'
  | 'longest'
  | 'concaveup'
  | 'concavedown'
  | 'flat'
  | 'current'
  | 'ndays'
  | 'source';

export interface DailyTokenSecondDiffSignRunsOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Restrict analysis to a single source. Non-matching rows
   * surface as `droppedSourceFilter`. null = no filter.
   */
  source?: string | null;
  /**
   * Minimum number of *active* calendar days required for the
   * source to be reported. Must be >= 3 (need at least 3 days for
   * one second-difference point to exist). Default 3.
   */
  minDays?: number;
  /**
   * Truncate `sources[]` to the top N rows after the sort.
   * Display filter only -- global denominators reflect the full
   * kept population. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for the per-source table (display only).
   *   - 'tokens'      (default): totalTokens desc, source asc
   *   - 'longest':              longestRegimeRun desc, source asc
   *   - 'concaveup':            longestConcaveUpRun desc, source asc
   *   - 'concavedown':          longestConcaveDownRun desc, source asc
   *   - 'flat':                 longestFlatRun desc, source asc
   *   - 'current':              currentRunLength desc, source asc
   *   - 'ndays':                nActiveDays desc, source asc
   *   - 'source':               source asc
   */
  sort?: SecondDiffSignRunsSort;
  /**
   * Display filter: hide rows whose `currentRunLength` is strictly
   * below this value. Useful for surfacing only sources that are
   * sitting in a *deeply persistent* concavity regime right now,
   * filtering out the noise of length-1 trailing runs (which mean
   * the regime just flipped on the most recent d2 point and is
   * fragile). Counts surface as `droppedBelowMinCurrentRun`.
   * Default 0 = no floor (every kept row shown).
   *
   * Filter order (matches the rest of the family):
   * window -> source -> minDays -> minCurrentRun -> sort -> top.
   */
  minCurrentRun?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DailyTokenSecondDiffSignRunsSourceRow {
  source: string;
  /** Sum of total_tokens across the source's positive-token days. */
  totalTokens: number;
  /** Count of distinct active calendar days (>= 3 in any kept row). */
  nActiveDays: number;
  /** ISO YYYY-MM-DD of the first active day. */
  firstActiveDay: string;
  /** ISO YYYY-MM-DD of the last active day. */
  lastActiveDay: string;
  /**
   * Number of second-difference points (= nActiveDays - 2).
   * Always >= 1 in a kept row.
   */
  nD2Points: number;
  /** Total count of concaveup d2 points (sign > 0). */
  nConcaveUp: number;
  /** Total count of concavedown d2 points (sign < 0). */
  nConcaveDown: number;
  /** Total count of flat d2 points (sign == 0). */
  nFlat: number;
  /**
   * Length (number of d2 points) of the longest maximal
   * concaveup run. 0 when no concaveup point exists.
   */
  longestConcaveUpRun: number;
  /** ISO YYYY-MM-DD of the first day of `longestConcaveUpRun` (empty when 0). */
  longestConcaveUpStart: string;
  /** ISO YYYY-MM-DD of the last day of `longestConcaveUpRun` (empty when 0). */
  longestConcaveUpEnd: string;
  /** Length of the longest maximal concavedown run. 0 when none. */
  longestConcaveDownRun: number;
  /** ISO YYYY-MM-DD of the first day of `longestConcaveDownRun` (empty when 0). */
  longestConcaveDownStart: string;
  /** ISO YYYY-MM-DD of the last day of `longestConcaveDownRun` (empty when 0). */
  longestConcaveDownEnd: string;
  /** Length of the longest maximal flat run. 0 when none. */
  longestFlatRun: number;
  /** ISO YYYY-MM-DD of the first day of `longestFlatRun` (empty when 0). */
  longestFlatStart: string;
  /** ISO YYYY-MM-DD of the last day of `longestFlatRun` (empty when 0). */
  longestFlatEnd: string;
  /**
   * `max(longestConcaveUpRun, longestConcaveDownRun, longestFlatRun)`.
   * Convenience field for headline reporting / sorting.
   */
  longestRegimeRun: number;
  /**
   * Regime of the longest run. Tie-break order: 'concaveup' >
   * 'concavedown' > 'flat'. Only 'flat' when all three are 0
   * (impossible in a kept row, since nD2Points >= 1).
   */
  longestRegime: ConcavityRegime;
  /**
   * Regime of the run *containing the last d2 point*. Always set
   * in a kept row.
   */
  currentRegime: ConcavityRegime;
  /**
   * Length (in d2 points) of the trailing same-sign run. >= 1 in
   * any kept row.
   */
  currentRunLength: number;
  /** Total maximal same-sign runs across the d2 series (any regime). */
  totalRuns: number;
}

export interface DailyTokenSecondDiffSignRunsReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minDays floor. */
  minDays: number;
  /** Echo of resolved top cap (0 = no cap). */
  top: number;
  /** Echo of resolved sort key. */
  sort: SecondDiffSignRunsSort;
  /** Echo of resolved minCurrentRun floor (0 = no floor). */
  minCurrentRun: number;
  /** Echo of source filter (null when not set). */
  source: string | null;
  /** Sum of total_tokens across all kept source rows. */
  totalTokens: number;
  /** Distinct sources seen (before display filters). */
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Sources with fewer than `minDays` active days. */
  droppedSparseSources: number;
  /** Source rows hidden by the `minCurrentRun` floor. */
  droppedBelowMinCurrentRun: number;
  /** Source rows hidden by the `top` cap. */
  droppedTopSources: number;
  /** One row per kept source. */
  sources: DailyTokenSecondDiffSignRunsSourceRow[];
}

interface RunSpan {
  startD2Idx: number; // index into the d2 array
  endD2Idx: number;
  length: number;
}

/**
 * Walk a sign series (each entry one of three regimes) once and
 * collect every maximal same-regime run, separately per regime.
 */
function findSignRuns(signs: ConcavityRegime[]): {
  concaveup: RunSpan[];
  concavedown: RunSpan[];
  flat: RunSpan[];
  totalRuns: number;
} {
  const concaveup: RunSpan[] = [];
  const concavedown: RunSpan[] = [];
  const flat: RunSpan[] = [];
  if (signs.length === 0) {
    return { concaveup, concavedown, flat, totalRuns: 0 };
  }
  let runStart = 0;
  let runRegime: ConcavityRegime = signs[0]!;
  for (let i = 1; i < signs.length; i++) {
    if (signs[i] !== runRegime) {
      const span: RunSpan = {
        startD2Idx: runStart,
        endD2Idx: i - 1,
        length: i - runStart,
      };
      if (runRegime === 'concaveup') concaveup.push(span);
      else if (runRegime === 'concavedown') concavedown.push(span);
      else flat.push(span);
      runStart = i;
      runRegime = signs[i]!;
    }
  }
  const lastSpan: RunSpan = {
    startD2Idx: runStart,
    endD2Idx: signs.length - 1,
    length: signs.length - runStart,
  };
  if (runRegime === 'concaveup') concaveup.push(lastSpan);
  else if (runRegime === 'concavedown') concavedown.push(lastSpan);
  else flat.push(lastSpan);
  return {
    concaveup,
    concavedown,
    flat,
    totalRuns: concaveup.length + concavedown.length + flat.length,
  };
}

function pickLongest(runs: RunSpan[]): RunSpan | null {
  // earliest tie wins -> deterministic
  let best: RunSpan | null = null;
  for (const r of runs) {
    if (best === null || r.length > best.length) best = r;
  }
  return best;
}

export function buildDailyTokenSecondDiffSignRuns(
  queue: QueueLine[],
  opts: DailyTokenSecondDiffSignRunsOptions = {},
): DailyTokenSecondDiffSignRunsReport {
  const minDays = opts.minDays ?? 3;
  if (!Number.isInteger(minDays) || minDays < 3) {
    throw new Error(`minDays must be an integer >= 3 (got ${opts.minDays})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minCurrentRun = opts.minCurrentRun ?? 0;
  if (!Number.isInteger(minCurrentRun) || minCurrentRun < 0) {
    throw new Error(
      `minCurrentRun must be a non-negative integer (got ${opts.minCurrentRun})`,
    );
  }
  const sort = opts.sort ?? 'tokens';
  const validSorts: SecondDiffSignRunsSort[] = [
    'tokens',
    'longest',
    'concaveup',
    'concavedown',
    'flat',
    'current',
    'ndays',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
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

  const agg = new Map<string, Map<string, number>>();
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
    const src = typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const day = q.hour_start.slice(0, 10);
    let days = agg.get(src);
    if (!days) {
      days = new Map<string, number>();
      agg.set(src, days);
    }
    days.set(day, (days.get(day) ?? 0) + tt);
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokens = 0;
  const rows: DailyTokenSecondDiffSignRunsSourceRow[] = [];

  for (const [src, days] of agg) {
    const sortedDays = Array.from(days.keys()).sort();
    const series = sortedDays.map((d) => days.get(d)!);
    const sourceTotal = series.reduce((a, b) => a + b, 0);
    totalTokens += sourceTotal;
    if (series.length < minDays) {
      droppedSparseSources += 1;
      continue;
    }
    // d2 (length n-2). Each d2[i] aligns with active-day index i+2,
    // and the "first day" of that d2 point is sortedDays[i].
    const n = series.length;
    const signs: ConcavityRegime[] = new Array(n - 2);
    let nUp = 0;
    let nDown = 0;
    let nFlat = 0;
    for (let i = 0; i < n - 2; i++) {
      const v0 = series[i]!;
      const v1 = series[i + 1]!;
      const v2 = series[i + 2]!;
      const d2 = v2 - 2 * v1 + v0;
      let s: ConcavityRegime;
      if (d2 > 0) {
        s = 'concaveup';
        nUp += 1;
      } else if (d2 < 0) {
        s = 'concavedown';
        nDown += 1;
      } else {
        s = 'flat';
        nFlat += 1;
      }
      signs[i] = s;
    }
    const { concaveup, concavedown, flat, totalRuns } = findSignRuns(signs);
    const longestUpSpan = pickLongest(concaveup);
    const longestDownSpan = pickLongest(concavedown);
    const longestFlatSpan = pickLongest(flat);
    const longestUp = longestUpSpan?.length ?? 0;
    const longestDown = longestDownSpan?.length ?? 0;
    const longestFlat = longestFlatSpan?.length ?? 0;
    const longestRegimeRun = Math.max(longestUp, longestDown, longestFlat);
    let longestRegime: ConcavityRegime;
    if (longestRegimeRun === longestUp && longestUp > 0) longestRegime = 'concaveup';
    else if (longestRegimeRun === longestDown && longestDown > 0)
      longestRegime = 'concavedown';
    else longestRegime = 'flat';

    // Trailing run: walk back from the last d2 point.
    const currentRegime = signs[signs.length - 1]!;
    let currentRunLength = 1;
    for (let i = signs.length - 2; i >= 0; i--) {
      if (signs[i] === currentRegime) currentRunLength += 1;
      else break;
    }

    const dayOfD2 = (idx: number): string => sortedDays[idx]!;
    const lastDayOfD2 = (idx: number): string => sortedDays[idx + 2]!;

    rows.push({
      source: src,
      totalTokens: sourceTotal,
      nActiveDays: n,
      firstActiveDay: sortedDays[0]!,
      lastActiveDay: sortedDays[n - 1]!,
      nD2Points: signs.length,
      nConcaveUp: nUp,
      nConcaveDown: nDown,
      nFlat: nFlat,
      longestConcaveUpRun: longestUp,
      longestConcaveUpStart: longestUpSpan ? dayOfD2(longestUpSpan.startD2Idx) : '',
      longestConcaveUpEnd: longestUpSpan ? lastDayOfD2(longestUpSpan.endD2Idx) : '',
      longestConcaveDownRun: longestDown,
      longestConcaveDownStart: longestDownSpan
        ? dayOfD2(longestDownSpan.startD2Idx)
        : '',
      longestConcaveDownEnd: longestDownSpan
        ? lastDayOfD2(longestDownSpan.endD2Idx)
        : '',
      longestFlatRun: longestFlat,
      longestFlatStart: longestFlatSpan ? dayOfD2(longestFlatSpan.startD2Idx) : '',
      longestFlatEnd: longestFlatSpan ? lastDayOfD2(longestFlatSpan.endD2Idx) : '',
      longestRegimeRun,
      longestRegime,
      currentRegime,
      currentRunLength,
      totalRuns,
    });
  }

  // Apply minCurrentRun display filter (after build, before sort)
  let droppedBelowMinCurrentRun = 0;
  let filtered: DailyTokenSecondDiffSignRunsSourceRow[] = rows;
  if (minCurrentRun > 0) {
    const next: DailyTokenSecondDiffSignRunsSourceRow[] = [];
    for (const r of rows) {
      if (r.currentRunLength >= minCurrentRun) next.push(r);
      else droppedBelowMinCurrentRun += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'longest':
        primary = b.longestRegimeRun - a.longestRegimeRun;
        break;
      case 'concaveup':
        primary = b.longestConcaveUpRun - a.longestConcaveUpRun;
        break;
      case 'concavedown':
        primary = b.longestConcaveDownRun - a.longestConcaveDownRun;
        break;
      case 'flat':
        primary = b.longestFlatRun - a.longestFlatRun;
        break;
      case 'current':
        primary = b.currentRunLength - a.currentRunLength;
        break;
      case 'ndays':
        primary = b.nActiveDays - a.nActiveDays;
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0) return primary;
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
    minDays,
    top,
    sort,
    minCurrentRun,
    source: sourceFilter,
    totalTokens,
    totalSources,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinCurrentRun,
    droppedTopSources,
    sources: kept,
  };
}
