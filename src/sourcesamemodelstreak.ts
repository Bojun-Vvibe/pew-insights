/**
 * source-same-model-streak: per-source longest run of consecutive
 * queue rows (ordered by `hour_start` ascending, then `model`
 * ascending as a stable tie-break) that share the same `model`.
 *
 * Headline question: **for each source, what is the longest
 * uninterrupted stretch of rows pinned to a single model, and how
 * does that streak compare to the source's total row count?**
 *
 * A "streak" here is a maximal contiguous slice of the source's
 * row timeline whose `model` values are all equal. For a source
 * with row count `n`, the longest streak `L` lies in `[1, n]`. We
 * also report:
 *
 *   - `streakCount`        : total number of streaks (equivalently,
 *                            1 + (number of model-switches between
 *                            adjacent rows)).
 *   - `longestStreakModel` : the model that drove the longest run
 *                            (lex tiebreak on ties — earliest model
 *                            id wins).
 *   - `longestStreakRatio` : `longestStreak / rowsKept`. In `(0, 1]`.
 *                            `1.0` iff every row uses the same
 *                            model (a perfectly model-locked
 *                            source). Closer to `1/n` iff the
 *                            source rotates models on almost every
 *                            row.
 *   - `meanStreakLength`   : `rowsKept / streakCount`. Average run
 *                            of consecutive same-model rows.
 *
 * Why this is genuinely orthogonal to existing lenses:
 *
 *   - `model-switching` reports the *rate* of model switches but
 *     not the longest sustained run between switches. A source
 *     with 50% switch rate could have a longest run of 2 or of
 *     500.
 *   - `bucket-streak-length` is per-*model* runs of consecutive
 *     active *buckets* — bucket-grain, model-grouped. This new
 *     lens is per-*source* runs of consecutive *rows* sharing the
 *     same model — row-grain, source-grouped.
 *   - `source-run-lengths` is run-lengths of same-*source* across
 *     *sessions*. This is run-lengths of same-*model* across
 *     *queue rows* within a single source.
 *   - `model-tenure` / `model-cohabitation` describe model
 *     lifetimes / overlap; they cannot recover the longest
 *     uninterrupted stretch.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` (counted in
 *      `droppedInvalidHourStart`).
 *   3. Group remaining rows by source.
 *   4. Per source: sort by `hour_start` asc, then `model` asc.
 *   5. Skip sources with `rowsKept < 1` (impossible after step 3
 *      but defensive).
 *   6. Walk the sorted timeline; track the current model and the
 *      current run length. When the model changes, finalise the
 *      run and start a new one.
 *   7. Compute `longestStreak`, `longestStreakModel`, `streakCount`,
 *      `longestStreakRatio`, `meanStreakLength`.
 *   8. Apply display gates `--min-rows`, `--min-streak`, `--min-ratio`.
 *   9. Sort + optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - Single-row source: `longestStreak = 1`, `streakCount = 1`,
 *     `longestStreakRatio = 1.0`. The model is whatever that row
 *     uses; legitimate but uninformative — that's why
 *     `--min-rows` defaults to 2.
 *   - Empty model strings are coerced to the literal `'unknown'`
 *     (codebase convention; mirrors source coercion).
 *   - All-equal models: `longestStreak = rowsKept`, `streakCount = 1`,
 *     `longestStreakRatio = 1.0`.
 *   - Model rotates every row: `longestStreak = 1`,
 *     `streakCount = rowsKept`, `longestStreakRatio = 1 / rowsKept`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourceSameModelStreakOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many rows. Display filter
   * only — global denominators reflect the full kept population.
   * Suppressed rows surface as `droppedBelowMinRows`. Default 2.
   */
  minRows?: number;
  /**
   * Drop sources whose `longestStreak` is strictly below this
   * value. Display filter only. Default 1 (no floor).
   */
  minStreak?: number;
  /**
   * Drop sources whose `longestStreakRatio` is strictly below
   * this value. In `[0, 1]`. Display filter only. Default 0.
   */
  minRatio?: number;
  /**
   * Cap the per-source table to the top N rows after sort.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'streak-desc' (default): longestStreak desc.
   *   - 'streak-asc':            longestStreak asc.
   *   - 'ratio-desc':            longestStreakRatio desc.
   *   - 'ratio-asc':             longestStreakRatio asc.
   *   - 'rows':                  rowsKept desc.
   *   - 'switches':              streakCount desc (more rotation first).
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'streak-desc'
    | 'streak-asc'
    | 'ratio-desc'
    | 'ratio-asc'
    | 'rows'
    | 'switches'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceSameModelStreakRow {
  source: string;
  rowsKept: number;
  streakCount: number;
  longestStreak: number;
  longestStreakModel: string;
  longestStreakRatio: number;
  meanStreakLength: number;
}

export interface SourceSameModelStreakReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minStreak: number;
  minRatio: number;
  top: number | null;
  sort:
    | 'streak-desc'
    | 'streak-asc'
    | 'ratio-desc'
    | 'ratio-asc'
    | 'rows'
    | 'switches'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinRows: number;
  droppedBelowMinStreak: number;
  droppedBelowMinRatio: number;
  droppedBelowTopCap: number;
  sources: SourceSameModelStreakRow[];
}

const VALID_SORTS = [
  'streak-desc',
  'streak-asc',
  'ratio-desc',
  'ratio-asc',
  'rows',
  'switches',
  'source',
] as const;

export function buildSourceSameModelStreak(
  queue: QueueLine[],
  opts: SourceSameModelStreakOptions = {},
): SourceSameModelStreakReport {
  const minRows = opts.minRows ?? 2;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minStreak = opts.minStreak ?? 1;
  if (!Number.isInteger(minStreak) || minStreak < 1) {
    throw new Error(
      `minStreak must be a positive integer (got ${opts.minStreak})`,
    );
  }
  const minRatio = opts.minRatio ?? 0;
  if (!Number.isFinite(minRatio) || minRatio < 0 || minRatio > 1) {
    throw new Error(
      `minRatio must be a finite number in [0, 1] (got ${opts.minRatio})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'streak-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
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

  // Per-source: array of [hour_start_ms, model, hour_start_iso].
  const perSource = new Map<string, Array<[number, string]>>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;

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
    const model =
      typeof q.model === 'string' && q.model !== '' ? q.model : 'unknown';

    let arr = perSource.get(source);
    if (!arr) {
      arr = [];
      perSource.set(source, arr);
    }
    arr.push([ms, model]);
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  const allRows: SourceSameModelStreakRow[] = [];

  for (const [source, samples] of perSource.entries()) {
    totalRowsKept += samples.length;
    const n = samples.length;
    if (n < 1) continue;

    // Sort by hour_start asc, then model asc as deterministic tiebreak.
    samples.sort((a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });

    let longestStreak = 1;
    let longestStreakModel = samples[0]![1];
    let streakCount = 1;
    let curModel = samples[0]![1];
    let curLen = 1;

    for (let i = 1; i < n; i += 1) {
      const m = samples[i]![1];
      if (m === curModel) {
        curLen += 1;
      } else {
        // close previous run
        if (
          curLen > longestStreak ||
          (curLen === longestStreak && curModel < longestStreakModel)
        ) {
          longestStreak = curLen;
          longestStreakModel = curModel;
        }
        streakCount += 1;
        curModel = m;
        curLen = 1;
      }
    }
    // close final run
    if (
      curLen > longestStreak ||
      (curLen === longestStreak && curModel < longestStreakModel)
    ) {
      longestStreak = curLen;
      longestStreakModel = curModel;
    }

    const longestStreakRatio = longestStreak / n;
    const meanStreakLength = n / streakCount;

    allRows.push({
      source,
      rowsKept: n,
      streakCount,
      longestStreak,
      longestStreakModel,
      longestStreakRatio,
      meanStreakLength,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinStreak = 0;
  let droppedBelowMinRatio = 0;
  const survived: SourceSameModelStreakRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.longestStreak < minStreak) {
      droppedBelowMinStreak += 1;
      continue;
    }
    if (row.longestStreakRatio < minRatio) {
      droppedBelowMinRatio += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'streak-desc') primary = b.longestStreak - a.longestStreak;
    else if (sort === 'streak-asc') primary = a.longestStreak - b.longestStreak;
    else if (sort === 'ratio-desc')
      primary = b.longestStreakRatio - a.longestStreakRatio;
    else if (sort === 'ratio-asc')
      primary = a.longestStreakRatio - b.longestStreakRatio;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
    else if (sort === 'switches') primary = b.streakCount - a.streakCount;
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
    minRows,
    minStreak,
    minRatio,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinRows,
    droppedBelowMinStreak,
    droppedBelowMinRatio,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
