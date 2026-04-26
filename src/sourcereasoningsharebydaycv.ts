/**
 * source-reasoning-share-by-day-cv: per-source consistency of the
 * **daily reasoning share** of total reply work across the source's
 * active calendar UTC days.
 *
 * For each (source, day) bucket, daily reasoning share is defined as
 *
 *     share = reasoning_output_tokens / (output_tokens + reasoning_output_tokens)
 *
 * — i.e. the fraction of the day's reply work that was *invisible*
 * thinking rather than *visible* output. Days where both
 * `output_tokens` and `reasoning_output_tokens` are zero are dropped
 * from the share sequence (share undefined) but counted in
 * `daysWithZeroReply`.
 *
 * Headline value `shareCv` is the **coefficient of variation**
 * (population stddev / mean) of the per-day share sequence. It
 * answers: "given a source, how reliably does it preserve the
 * thinking-vs-typing balance day-over-day?" Low CV = the source's
 * reasoning posture is stable; high CV = some days are pure
 * generation, others are pure thinking.
 *
 * Why a separate subcommand:
 *
 *   - `reasoning-share` is a single global per-**model** mean. It
 *     has no per-source view, no day axis, and cannot tell a model
 *     that ran 0.4 reasoning every day from one that flipped between
 *     0.0 and 0.8 (both can integrate to 0.4 globally).
 *   - `source-io-ratio-stability` measures CV of `output / input`,
 *     not the *internal* split inside reply work. A source that
 *     sends 10× more output every day with the same reasoning ratio
 *     gets a flat ratioCv signal but a moving io ratio.
 *   - `prompt-output-correlation --include-reasoning` collapses
 *     reasoning into total output for a single global Pearson r;
 *     it discards the daily share sequence entirely.
 *   - `output-input-ratio` and `daily-token-autocorrelation-lag1`
 *     touch neither reasoning tokens nor a per-source-day axis.
 *
 * The metric is **scale-invariant** in token volume: a source that
 * burns 10× more tokens but holds the same reasoning share gets the
 * same CV. That makes it useful for comparing a heavyweight reasoning
 * model to a tiny chat source on equal footing.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. For each (source, calendar UTC day) bucket, sum
 *      `output_tokens` and `reasoning_output_tokens` across all
 *      queue rows. Days with `output + reasoning === 0` are dropped
 *      from the share sequence but counted in `daysWithZeroReply`.
 *      Days with `output > 0, reasoning === 0` contribute a share
 *      of 0 — they legitimately reduce the source's mean and inflate
 *      the CV.
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
 *     `reasoning_output_tokens === 0`) gets `shareCv = 0` by
 *     convention (degenerate constant sequence) and `flatLine = true`.
 *   - A source whose mean daily share is 1 (every kept day had
 *     `output_tokens === 0` but `reasoning_output_tokens > 0`) gets
 *     `shareCv = 0` and `pureReasoning = true`. Distinct from
 *     `flatLine` so the operator can spot the structural opposite.
 *   - A source with exactly 1 share day after filters fails the
 *     `minDays >= 2` floor and is suppressed; even if `minDays = 1`
 *     is forced via the option, it is reported with `singleSample
 *     = true`.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceReasoningShareByDayCvOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many **share-bearing** calendar
   * days (i.e. days with `output + reasoning > 0`). Display filter
   * only — global denominators reflect the full kept population.
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
   *   - 'mean':             meanShare asc; ties on tokens desc.
   *   - 'days':             daysWithShare desc; ties on tokens desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'cv' | 'mean' | 'days' | 'source';
  /**
   * Drop sources whose `meanShare` is strictly below this value
   * from the per-source table. Display filter only — global
   * denominators reflect the full kept population. Suppressed rows
   * surface as `droppedBelowMinMeanShare`. Must be a finite number
   * in [0, 1]. Default 0 = no floor.
   *
   * Useful for suppressing the "mathematically-loud-but-substantively-
   * flat" regime: a source with reasoning tokens contributing
   * ~0.004% of total reply work but one outlier day inflating
   * `shareCv` past 3.0 is *technically* unstable but trivially
   * negligible. `--min-mean-share 0.01` drops anything below 1%
   * average reasoning share, so the CV ranking starts to mean
   * "wild among genuinely reasoning sources".
   */
  minMeanShare?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceReasoningShareByDayCvRow {
  source: string;
  /** Sum of total_tokens across all kept rows for this source. */
  tokens: number;
  /** Sum of output_tokens across all kept rows for this source. */
  outputTokens: number;
  /** Sum of reasoning_output_tokens across all kept rows for this source. */
  reasoningTokens: number;
  /** Distinct calendar days with at least one kept row. */
  activeDays: number;
  /** Distinct calendar days with output + reasoning > 0 (denominator for shares). */
  daysWithShare: number;
  /** Calendar days where output + reasoning == 0 across the whole day. */
  daysWithZeroReply: number;
  /** Arithmetic mean of the per-day reasoning-share sequence. */
  meanShare: number;
  /** Population stddev of the per-day reasoning-share sequence. */
  stdShare: number;
  /**
   * stdShare / meanShare. Convention: 0 if meanShare == 0 (degenerate
   * flat-zero source) — flagged with flatLine=true.
   */
  shareCv: number;
  /** True iff every share-bearing day had reasoning_output_tokens == 0. */
  flatLine: boolean;
  /** True iff every share-bearing day had output_tokens == 0 (share == 1). */
  pureReasoning: boolean;
  /** True iff daysWithShare === 1. */
  singleSample: boolean;
}

export interface SourceReasoningShareByDayCvReport {
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
  sources: SourceReasoningShareByDayCvRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

export function buildSourceReasoningShareByDayCv(
  queue: QueueLine[],
  opts: SourceReasoningShareByDayCvOptions = {},
): SourceReasoningShareByDayCvReport {
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
    outTok: number;
    reasTok: number;
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

    const outT = Number(q.output_tokens);
    const reasT = Number(q.reasoning_output_tokens);
    const totT = Number(q.total_tokens);
    const outSafe = Number.isFinite(outT) && outT > 0 ? outT : 0;
    const reasSafe = Number.isFinite(reasT) && reasT > 0 ? reasT : 0;
    const totSafe = Number.isFinite(totT) && totT > 0 ? totT : 0;

    let acc = perSource.get(source);
    if (!acc) {
      acc = new Map<number, DayAgg>();
      perSource.set(source, acc);
    }
    const dk = dayKey(ms);
    let day = acc.get(dk);
    if (!day) {
      day = { outTok: 0, reasTok: 0, totalTok: 0 };
      acc.set(dk, day);
    }
    day.outTok += outSafe;
    day.reasTok += reasSafe;
    day.totalTok += totSafe;
  }

  const allRows: SourceReasoningShareByDayCvRow[] = [];
  let totalTokens = 0;

  for (const [source, perDay] of perSource.entries()) {
    if (perDay.size === 0) continue;

    let outputTokens = 0;
    let reasoningTokens = 0;
    let srcTokens = 0;
    let daysWithZeroReply = 0;
    const shares: number[] = [];

    for (const day of perDay.values()) {
      outputTokens += day.outTok;
      reasoningTokens += day.reasTok;
      srcTokens += day.totalTok;
      const denom = day.outTok + day.reasTok;
      if (denom <= 0) {
        daysWithZeroReply += 1;
      } else {
        shares.push(day.reasTok / denom);
      }
    }

    totalTokens += srcTokens;

    const daysWithShare = shares.length;
    let meanShare = 0;
    let stdShare = 0;
    let shareCv = 0;
    let flatLine = false;
    let pureReasoning = false;

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
        // every kept day had reasoning == 0
        shareCv = 0;
        flatLine = true;
      } else if (meanShare === 1) {
        // every kept day had output == 0 (pure reasoning)
        shareCv = stdShare; // trivially 0 too, but be explicit
        pureReasoning = true;
      } else {
        shareCv = stdShare / meanShare;
      }
    }

    allRows.push({
      source,
      tokens: srcTokens,
      outputTokens,
      reasoningTokens,
      activeDays: perDay.size,
      daysWithShare,
      daysWithZeroReply,
      meanShare,
      stdShare,
      shareCv,
      flatLine,
      pureReasoning,
      singleSample: daysWithShare === 1,
    });
  }

  let droppedBelowMinDays = 0;
  let droppedBelowMinMeanShare = 0;
  const survived: SourceReasoningShareByDayCvRow[] = [];
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
      primary = a.meanShare - b.meanShare;
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
