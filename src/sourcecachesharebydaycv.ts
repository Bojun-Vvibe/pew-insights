/**
 * source-cache-share-by-day-cv: per-source consistency of the
 * **daily input-token cache hit share** across the source's active
 * calendar UTC days.
 *
 * For each (source, day) bucket, daily cache share is defined as
 *
 *     share = cached_input_tokens / input_tokens
 *
 * — i.e. the fraction of the day's prompt mass that was served from
 * cache rather than re-shipped over the wire. Days where
 * `input_tokens === 0` are dropped from the share sequence (share
 * undefined) but counted in `daysWithZeroInput`.
 *
 * Headline value `shareCv` is the **coefficient of variation**
 * (population stddev / mean) of the per-day share sequence. It
 * answers: "given a source, how reliably does it re-use prompt
 * cache day-over-day?" Low CV = the source's cache posture is
 * stable; high CV = some days are cache-cold (fresh sessions, big
 * uncached prompts) and others are cache-hot (long-running
 * follow-ups against a warm context).
 *
 * Why a separate subcommand:
 *
 *   - `source-cold-warm-row-ratio` is a **row-count split** by
 *     `cached_input_tokens === 0` vs `> 0`. It says nothing about
 *     how the share *moves* day-over-day inside the warm rows.
 *   - `source-weekend-weekday-cache-share-gap` collapses time into
 *     **two buckets** (Mon..Fri vs Sat..Sun). A source that is wildly
 *     unstable inside the weekday bucket can still report a tiny
 *     gap; this metric exposes that.
 *   - `cache-hit-ratio` and `cache-hit-by-hour` are **global**
 *     across sources — they cannot tell a source that ran 0.6 cache
 *     share every day from one that flipped between 0.0 and 1.0
 *     (both can integrate to 0.6 globally).
 *   - `source-io-ratio-stability` is the analogous CV but on
 *     `output / input`, not on cache reuse. Orthogonal axis: a
 *     source with perfectly stable IO ratio can still have wild
 *     cache CV (or vice versa).
 *
 * The metric is **scale-invariant** in token volume: a source that
 * burns 10\u00d7 more tokens but holds the same cache share gets the
 * same CV. That makes it useful for comparing a heavyweight context
 * source to a tiny chat source on equal footing.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. For each (source, calendar UTC day) bucket, sum
 *      `cached_input_tokens` and `input_tokens` across all queue
 *      rows. Days with `input_tokens === 0` are dropped from the
 *      share sequence but counted in `daysWithZeroInput`. Days
 *      with `input > 0, cached === 0` contribute a share of 0 \u2014
 *      they legitimately reduce the source's mean and inflate the
 *      CV.
 *   4. Per source: build the array `dailyShares[]`. The mean,
 *      population variance, stddev, and CV are computed in the
 *      conventional way.
 *   5. Display gate `--min-days` (default 3): sources with fewer
 *      than `minDays` share-bearing days are dropped from the table
 *      (CV on <2 samples is statistically meaningless). Drops
 *      surface as `droppedBelowMinDays`.
 *
 * Edge cases:
 *
 *   - A source whose mean daily share is 0 (every kept day had
 *     `cached_input_tokens === 0`) gets `shareCv = 0` by
 *     convention (degenerate constant sequence) and `flatCold = true`.
 *   - A source whose mean daily share is 1 (every kept day had
 *     `cached_input_tokens === input_tokens`) gets `shareCv = 0`
 *     and `pureWarm = true`. Distinct from `flatCold` so the
 *     operator can spot the structural opposite.
 *   - A source with exactly 1 share day after filters fails the
 *     `minDays >= 2` floor and is suppressed; even if `minDays = 1`
 *     is forced via the option, it is reported with
 *     `singleSample = true`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceCacheShareByDayCvOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many **share-bearing** calendar
   * days (i.e. days with `input_tokens > 0`). Display filter only
   * \u2014 global denominators reflect the full kept population.
   * Suppressed rows surface as `droppedBelowMinDays`. Must be a
   * positive integer. Default 3.
   */
  minDays?: number;
  /**
   * Cap the per-source table to the top N rows after sort + minDays
   * floor. Suppressed rows surface as `droppedBelowTopCap`. Default
   * null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokens desc.
   *   - 'cv':               shareCv asc (most stable first;
   *                         ties on tokens desc).
   *   - 'mean':             meanShare desc (highest cache hitter
   *                         first; ties on tokens desc).
   *   - 'days':             daysWithShare desc; ties on tokens desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'cv' | 'mean' | 'days' | 'source';
  /**
   * Drop sources whose `meanShare` is strictly below this value
   * from the per-source table. Display filter only \u2014 global
   * denominators reflect the full kept population. Suppressed rows
   * surface as `droppedBelowMinMeanShare`. Must be a finite number
   * in [0, 1]. Default 0 = no floor.
   *
   * Useful for suppressing the
   * "mathematically-loud-but-substantively-cold" regime: a source
   * whose mean cache share is ~0.001 with one outlier day inflating
   * `shareCv` past 5.0 is *technically* unstable but trivially
   * cold. `--min-mean-share 0.05` drops anything below 5% average
   * cache share, so the CV ranking starts to mean
   * "wild among genuinely cache-using sources".
   */
  minMeanShare?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceCacheShareByDayCvRow {
  source: string;
  /** Sum of total_tokens across all kept rows for this source. */
  tokens: number;
  /** Sum of input_tokens across all kept rows for this source. */
  inputTokens: number;
  /** Sum of cached_input_tokens across all kept rows for this source. */
  cachedInputTokens: number;
  /** Distinct calendar days with at least one kept row. */
  activeDays: number;
  /** Distinct calendar days with input_tokens > 0 (denominator for shares). */
  daysWithShare: number;
  /** Calendar days where input_tokens == 0 across the whole day. */
  daysWithZeroInput: number;
  /** Arithmetic mean of the per-day cache-share sequence. */
  meanShare: number;
  /** Population stddev of the per-day cache-share sequence. */
  stdShare: number;
  /**
   * stdShare / meanShare. Convention: 0 if meanShare == 0 (degenerate
   * flat-cold source) \u2014 flagged with flatCold=true.
   */
  shareCv: number;
  /** True iff every share-bearing day had cached_input_tokens == 0. */
  flatCold: boolean;
  /** True iff every share-bearing day had cached == input (share == 1). */
  pureWarm: boolean;
  /** True iff daysWithShare === 1. */
  singleSample: boolean;
}

export interface SourceCacheShareByDayCvReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minDays: number;
  top: number | null;
  sort: 'tokens' | 'cv' | 'mean' | 'days' | 'source';
  minMeanShare: number;
  /** Distinct sources that survived window/source filters. */
  totalSources: number;
  /** Sum of total_tokens across the full kept population. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinDays: number;
  droppedBelowMinMeanShare: number;
  droppedBelowTopCap: number;
  sources: SourceCacheShareByDayCvRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

export function buildSourceCacheShareByDayCv(
  queue: QueueLine[],
  opts: SourceCacheShareByDayCvOptions = {},
): SourceCacheShareByDayCvReport {
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
  if (
    sort !== 'tokens' &&
    sort !== 'cv' &&
    sort !== 'mean' &&
    sort !== 'days' &&
    sort !== 'source'
  ) {
    throw new Error(
      `sort must be 'tokens' | 'cv' | 'mean' | 'days' | 'source' (got ${opts.sort})`,
    );
  }
  const minMeanShare = opts.minMeanShare ?? 0;
  if (
    !Number.isFinite(minMeanShare) ||
    minMeanShare < 0 ||
    minMeanShare > 1
  ) {
    throw new Error(
      `minMeanShare must be a finite number in [0, 1] (got ${opts.minMeanShare})`,
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

  interface DayAgg {
    inTok: number;
    cachedTok: number;
    totalTok: number;
  }
  const perSource = new Map<string, Map<number, DayAgg>>();

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

    const inT = Number(q.input_tokens);
    const cachedT = Number(q.cached_input_tokens);
    const totT = Number(q.total_tokens);
    const inSafe = Number.isFinite(inT) && inT > 0 ? inT : 0;
    const cachedSafe = Number.isFinite(cachedT) && cachedT > 0 ? cachedT : 0;
    const totSafe = Number.isFinite(totT) && totT > 0 ? totT : 0;

    let acc = perSource.get(source);
    if (!acc) {
      acc = new Map<number, DayAgg>();
      perSource.set(source, acc);
    }
    const dk = dayKey(ms);
    let day = acc.get(dk);
    if (!day) {
      day = { inTok: 0, cachedTok: 0, totalTok: 0 };
      acc.set(dk, day);
    }
    day.inTok += inSafe;
    // Clamp cached to <= input at row level isn't right (rows can have
    // legit cached>0 with input==0 in some logs), but at the per-day
    // share level we clip the share to [0,1] only if day.cachedTok
    // exceeds day.inTok, which can happen if a logger double-counts.
    day.cachedTok += cachedSafe;
    day.totalTok += totSafe;
  }

  const allRows: SourceCacheShareByDayCvRow[] = [];
  let totalTokens = 0;

  for (const [source, perDay] of perSource.entries()) {
    if (perDay.size === 0) continue;

    let inputTokens = 0;
    let cachedInputTokens = 0;
    let srcTokens = 0;
    let daysWithZeroInput = 0;
    const shares: number[] = [];

    for (const day of perDay.values()) {
      inputTokens += day.inTok;
      cachedInputTokens += day.cachedTok;
      srcTokens += day.totalTok;
      if (day.inTok <= 0) {
        daysWithZeroInput += 1;
      } else {
        let s = day.cachedTok / day.inTok;
        if (s < 0) s = 0;
        if (s > 1) s = 1;
        shares.push(s);
      }
    }

    totalTokens += srcTokens;

    const daysWithShare = shares.length;
    let meanShare = 0;
    let stdShare = 0;
    let shareCv = 0;
    let flatCold = false;
    let pureWarm = false;

    if (daysWithShare > 0) {
      let sum = 0;
      for (const s of shares) sum += s;
      meanShare = sum / daysWithShare;
      let sq = 0;
      for (const s of shares) {
        const d = s - meanShare;
        sq += d * d;
      }
      stdShare = Math.sqrt(sq / daysWithShare);
      if (meanShare === 0) {
        // every kept day had cached == 0
        shareCv = 0;
        flatCold = true;
      } else if (meanShare === 1) {
        // every kept day had cached == input (perfectly warm)
        shareCv = stdShare; // trivially 0 too
        pureWarm = true;
      } else {
        shareCv = stdShare / meanShare;
      }
    }

    allRows.push({
      source,
      tokens: srcTokens,
      inputTokens,
      cachedInputTokens,
      activeDays: perDay.size,
      daysWithShare,
      daysWithZeroInput,
      meanShare,
      stdShare,
      shareCv,
      flatCold,
      pureWarm,
      singleSample: daysWithShare === 1,
    });
  }

  let droppedBelowMinDays = 0;
  let droppedBelowMinMeanShare = 0;
  const survived: SourceCacheShareByDayCvRow[] = [];
  for (const row of allRows) {
    if (row.daysWithShare < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    if (row.meanShare < minMeanShare) {
      droppedBelowMinMeanShare += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'cv') {
      primary = a.shareCv - b.shareCv;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'mean') {
      primary = b.meanShare - a.meanShare;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'days') {
      primary = b.daysWithShare - a.daysWithShare;
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
    minMeanShare,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinDays,
    droppedBelowMinMeanShare,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
