/**
 * Activity-streak analysis for pew usage.
 *
 * Where `trend` shows the *magnitude* of recent usage and `heatmap`
 * shows the *cycle* shape (hour-of-day × day-of-week), `streaks`
 * answers a different question: **how consistent is the cadence?**
 *
 * Concretely, given a daily token series, we classify each day as
 * either ACTIVE (tokens >= minTokens) or IDLE, then walk the series
 * to find:
 *
 *   - longest active streak (consecutive ACTIVE days),
 *   - longest idle gap   (consecutive IDLE days),
 *   - the *current* trailing streak/gap (whichever the most recent
 *     day is part of), so the operator can see "I'm on day 11 of an
 *     active run" or "it's been 3 days since I touched pew",
 *   - count of active days, count of distinct streaks, and the median
 *     active-streak length (a robust 'typical run' summary that
 *     doesn't get blown out by a single very long streak).
 *
 * Why a new subcommand instead of folding into `trend`:
 *
 *   - `trend` is value-comparison (current window vs prior window).
 *     It treats every day as a continuous magnitude. A 0-token day
 *     in `trend` reads as just a low value; in `streaks` it's a
 *     categorical state-change. Mixing the two collapses the signal.
 *   - The summary metrics here (longest run, gap lengths, current
 *     streak number) are ordinal / count statistics over a discretised
 *     series. They have no natural home in the existing modules,
 *     which all aggregate magnitudes.
 *   - `anomalies` flags individual outlier days; `streaks` flags
 *     *patterns of consecutive days*, which is a different time
 *     scale (regime vs spike).
 *
 * Determinism: pure builder, takes `asOf`, never reads Date.now()
 * directly. The day grid is UTC, matching `trend.buildDailySeries`
 * and `heatmap.buildHeatmap` so all three subcommands can be safely
 * cross-read on the same window.
 */
import type { QueueLine } from './types.js';
import { buildDailySeries } from './trend.js';

export interface StreaksOptions {
  /** How many days of history to include. Default 30. Must be >= 1. */
  lookbackDays?: number;
  /**
   * Minimum total_tokens for a day to count as ACTIVE. Default 1
   * (any usage at all). Operators tracking a deliberate practice
   * cadence ("at least 50K tokens of real work") can raise this.
   * Must be >= 0 — a value of 0 effectively makes every day in the
   * window active because it includes 0-token IDLE days.
   */
  minTokens?: number;
  /** Cutoff timestamp; defaults to now. */
  asOf?: string;
}

export type DayState = 'active' | 'idle';

export interface StreakRun {
  /** 'active' = consecutive ACTIVE days, 'idle' = consecutive IDLE days. */
  state: DayState;
  /** Inclusive YYYY-MM-DD start day (oldest day of the run). */
  startDay: string;
  /** Inclusive YYYY-MM-DD end day (newest day of the run). */
  endDay: string;
  /** Number of consecutive days in the run. >= 1. */
  length: number;
  /** Sum of total_tokens across the run (0 for idle runs). */
  tokens: number;
}

export interface StreaksReport {
  asOf: string;
  lookbackDays: number;
  minTokens: number;
  /** Inclusive UTC date string of oldest day in window. */
  windowStart: string;
  /** Inclusive UTC date string of newest day in window. */
  windowEnd: string;
  /** All runs in chronological order (oldest first). */
  runs: StreakRun[];
  /** Number of ACTIVE days in the window. */
  activeDays: number;
  /** Number of IDLE days in the window. */
  idleDays: number;
  /** activeDays / lookbackDays. 0..1. */
  activeFraction: number;
  /** Longest ACTIVE run, or null if no ACTIVE day exists in window. */
  longestActive: StreakRun | null;
  /** Longest IDLE run, or null if no IDLE day exists in window. */
  longestIdle: StreakRun | null;
  /**
   * The run containing the most-recent day in the window. Always
   * non-null (an empty window is rejected upstream by lookback>=1).
   * Lets operators see "you're 11 days into an active streak" or
   * "it's been 3 days since you touched pew".
   */
  currentRun: StreakRun;
  /**
   * Number of distinct ACTIVE runs (independent streaks). Distinct
   * from `runs.length / 2` because the window can start or end on
   * either state.
   */
  activeRunCount: number;
  /**
   * Median length of ACTIVE runs. null if there are no ACTIVE runs.
   * Ties broken by lower-half average (standard median definition
   * for even-count populations).
   */
  medianActiveLength: number | null;
  /**
   * Mean length of ACTIVE runs. null if there are no ACTIVE runs.
   * Reported alongside the median so a skewed distribution (one big
   * streak + many short ones) is visible.
   */
  meanActiveLength: number | null;
}

function addDaysUtc(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function median(xs: number[]): number {
  // Caller guarantees xs.length > 0.
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildStreaks(
  queue: QueueLine[],
  opts: StreaksOptions = {},
): StreaksReport {
  const lookbackDays = opts.lookbackDays ?? 30;
  const minTokens = opts.minTokens ?? 1;
  const asOf = opts.asOf ?? new Date().toISOString();

  if (lookbackDays < 1) {
    throw new Error(`lookbackDays must be >= 1 (got ${lookbackDays})`);
  }
  if (minTokens < 0) {
    throw new Error(`minTokens must be >= 0 (got ${minTokens})`);
  }

  const endDay = asOf.slice(0, 10);
  // Reuse the canonical daily series builder so streak boundaries
  // match `trend` exactly. This also gives us the 0-fill for IDLE
  // days for free.
  const series = buildDailySeries(queue, endDay, lookbackDays);
  const windowStart = series[0]!.day;
  const windowEnd = series[series.length - 1]!.day;

  // Walk the series, accumulating runs. We classify per day, then
  // emit a run whenever the state flips (or at end-of-series).
  const runs: StreakRun[] = [];
  let curState: DayState | null = null;
  let curStart = '';
  let curLength = 0;
  let curTokens = 0;

  const flush = (endDayInclusive: string) => {
    if (curState == null) return;
    runs.push({
      state: curState,
      startDay: curStart,
      endDay: endDayInclusive,
      length: curLength,
      tokens: curTokens,
    });
  };

  let prevDay = '';
  for (const point of series) {
    const state: DayState = point.tokens >= minTokens ? 'active' : 'idle';
    if (curState === null) {
      curState = state;
      curStart = point.day;
      curLength = 1;
      curTokens = point.tokens;
    } else if (state === curState) {
      curLength += 1;
      curTokens += point.tokens;
    } else {
      flush(prevDay);
      curState = state;
      curStart = point.day;
      curLength = 1;
      curTokens = point.tokens;
    }
    prevDay = point.day;
  }
  flush(prevDay);

  // Marginals.
  let activeDays = 0;
  let idleDays = 0;
  const activeLengths: number[] = [];
  let longestActive: StreakRun | null = null;
  let longestIdle: StreakRun | null = null;
  for (const r of runs) {
    if (r.state === 'active') {
      activeDays += r.length;
      activeLengths.push(r.length);
      // Tie-break: keep the *earlier* run if equal length, so the
      // result is deterministic on a given series.
      if (longestActive == null || r.length > longestActive.length) {
        longestActive = r;
      }
    } else {
      idleDays += r.length;
      if (longestIdle == null || r.length > longestIdle.length) {
        longestIdle = r;
      }
    }
  }

  const activeFraction = activeDays / lookbackDays;
  const currentRun = runs[runs.length - 1]!;
  const activeRunCount = activeLengths.length;
  const medianActiveLength = activeRunCount === 0 ? null : median(activeLengths);
  const meanActiveLength =
    activeRunCount === 0
      ? null
      : activeLengths.reduce((a, b) => a + b, 0) / activeRunCount;

  // `addDaysUtc` is unused inside the report itself but kept exported
  // potential via test seam. (Marked void to avoid lint complaint.)
  void addDaysUtc;

  return {
    asOf,
    lookbackDays,
    minTokens,
    windowStart,
    windowEnd,
    runs,
    activeDays,
    idleDays,
    activeFraction,
    longestActive,
    longestIdle,
    currentRun,
    activeRunCount,
    medianActiveLength,
    meanActiveLength,
  };
}
