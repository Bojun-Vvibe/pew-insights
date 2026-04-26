/**
 * source-io-ratio-stability: per-source consistency of the daily
 * `output_tokens / input_tokens` ratio across a source's active
 * **calendar days**.
 *
 * Headline value `ratioCv` is the **coefficient of variation**
 * (population stddev / mean) of the per-day ratio sequence. It
 * answers: "given a source, how reliably does it preserve its own
 * input-vs-output shape day-over-day?" Low CV = the source asks
 * and answers in a stable proportion; high CV = the daily shape
 * swings wildly (some days mostly prompt, some days mostly
 * generation).
 *
 * Why a separate subcommand:
 *
 *   - `output-input-ratio` reports a single global ratio. It says
 *     nothing about *consistency* over time and cannot tell a
 *     source that ran 0.4 every day from one that flipped between
 *     0.1 and 0.7 (both can integrate to the same global ratio).
 *   - `prompt-output-correlation` (if present) measures
 *     **within-day** correlation between prompt and output sizes
 *     across buckets. It is anchored to bucket pairs, not the
 *     daily ratio sequence, and gives no per-source CV.
 *   - `daily-token-autocorrelation-lag1` is about persistence in
 *     **total tokens**, which is a magnitude metric. The IO ratio
 *     can be perfectly stable while volume crashes, and vice versa.
 *   - `output-token-decile-distribution` /
 *     `input-token-decile-distribution` characterise the
 *     marginal distributions across buckets but do not relate
 *     them daily-pairwise per source.
 *
 * The metric is scale-invariant in token volume: a source that
 * burns 10× more tokens but holds the same ratio gets the same CV.
 * That makes it useful for comparing a heavyweight agentic source
 * to a tiny chat source on equal footing.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite hour_start.
 *   3. For each (source, calendar UTC day) bucket, sum
 *      `input_tokens` and `output_tokens` across all queue rows.
 *      Days with `input_tokens === 0` are **dropped from the ratio
 *      sequence** (ratio undefined) but counted in
 *      `daysWithZeroInput`. Days with `input_tokens > 0` and
 *      `output_tokens === 0` contribute a ratio of 0 — they
 *      legitimately reduce the source's mean and inflate the CV.
 *   4. Per source: build the array `dailyRatios[]`. The mean,
 *      population variance, stddev, and CV are computed in the
 *      conventional way.
 *   5. Display gate `--min-days` (default 3): sources with fewer
 *      than `minDays` ratio-bearing days are dropped from the
 *      table (CV on <2 samples is statistically meaningless).
 *      Drops surface as `droppedBelowMinDays`.
 *
 * Edge cases:
 *
 *   - A source whose mean daily ratio is 0 (every kept day had
 *     `output_tokens === 0`) gets `ratioCv = 0` by convention
 *     (degenerate constant sequence) and `flatLine = true`.
 *   - A source with exactly 1 ratio day after filters fails the
 *     `minDays >= 2` floor and is suppressed; even if `minDays = 1`
 *     is forced via the option, it is reported with
 *     `ratioCv = 0`, `singleSample = true` so the operator can
 *     ignore it.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceIoRatioStabilityOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many **ratio-bearing**
   * calendar days (i.e. days with `input_tokens > 0`). Display
   * filter only — global denominators reflect the full kept
   * population. Suppressed rows surface as `droppedBelowMinDays`.
   * Must be a positive integer. Default 3 (CV on <2 samples is
   * not meaningful; default to 3 for a non-degenerate signal).
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
   *   - 'cv':               ratioCv asc (most stable first;
   *                         ties on tokens desc).
   *   - 'mean':             meanRatio asc; ties on tokens desc.
   *   - 'days':             daysWithRatio desc; ties on tokens desc.
   *   - 'source':           source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'tokens' | 'cv' | 'mean' | 'days' | 'source';
  /**
   * Drop sources whose `ratioCv` is strictly below this value
   * from the per-source table. Display filter only — global
   * denominators reflect the full kept population. Suppressed
   * rows surface as `droppedBelowCvMin`. Must be a non-negative
   * finite number. Default 0 = no floor.
   *
   * Useful for finding the "wild" sources whose interaction
   * shape is genuinely volatile (e.g. `--cv-min 0.5`) without
   * being drowned in stable rows.
   */
  cvMin?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceIoRatioStabilityRow {
  source: string;
  /** Sum of total_tokens across all kept rows for this source. */
  tokens: number;
  /** Sum of input_tokens across all kept rows for this source. */
  inputTokens: number;
  /** Sum of output_tokens across all kept rows for this source. */
  outputTokens: number;
  /** Distinct calendar days with at least one kept row. */
  activeDays: number;
  /** Distinct calendar days with input_tokens > 0 (denominator for ratios). */
  daysWithRatio: number;
  /** Calendar days where input_tokens == 0 across the whole day. */
  daysWithZeroInput: number;
  /** Arithmetic mean of the per-day output/input ratio sequence. */
  meanRatio: number;
  /** Population stddev of the per-day output/input ratio sequence. */
  stdRatio: number;
  /**
   * stdRatio / meanRatio. Convention: 0 if meanRatio == 0 (degenerate
   * flat-zero source) — flagged with flatLine=true.
   */
  ratioCv: number;
  /** True iff every ratio-bearing day had output_tokens == 0. */
  flatLine: boolean;
  /** True iff daysWithRatio === 1. */
  singleSample: boolean;
}

export interface SourceIoRatioStabilityReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minDays: number;
  top: number | null;
  sort: 'tokens' | 'cv' | 'mean' | 'days' | 'source';
  cvMin: number;
  /** Distinct sources that survived filters (pre minDays floor). */
  totalSources: number;
  /** Sum of total_tokens across the full kept population. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedSourceFilter: number;
  droppedBelowMinDays: number;
  droppedBelowCvMin: number;
  droppedBelowTopCap: number;
  sources: SourceIoRatioStabilityRow[];
}

const DAY_MS = 86_400_000;

function dayKey(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

export function buildSourceIoRatioStability(
  queue: QueueLine[],
  opts: SourceIoRatioStabilityOptions = {},
): SourceIoRatioStabilityReport {
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
  const cvMin = opts.cvMin ?? 0;
  if (!Number.isFinite(cvMin) || cvMin < 0) {
    throw new Error(`cvMin must be a non-negative finite number (got ${opts.cvMin})`);
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

  // Per source: dayKey -> { in, out, total }
  interface DayAgg {
    inTok: number;
    outTok: number;
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
    const outT = Number(q.output_tokens);
    const totT = Number(q.total_tokens);
    const inSafe = Number.isFinite(inT) && inT > 0 ? inT : 0;
    const outSafe = Number.isFinite(outT) && outT > 0 ? outT : 0;
    const totSafe = Number.isFinite(totT) && totT > 0 ? totT : 0;

    let acc = perSource.get(source);
    if (!acc) {
      acc = new Map<number, DayAgg>();
      perSource.set(source, acc);
    }
    const dk = dayKey(ms);
    let day = acc.get(dk);
    if (!day) {
      day = { inTok: 0, outTok: 0, totalTok: 0 };
      acc.set(dk, day);
    }
    day.inTok += inSafe;
    day.outTok += outSafe;
    day.totalTok += totSafe;
  }

  const allRows: SourceIoRatioStabilityRow[] = [];
  let totalTokens = 0;

  for (const [source, perDay] of perSource.entries()) {
    if (perDay.size === 0) continue;

    let inputTokens = 0;
    let outputTokens = 0;
    let srcTokens = 0;
    let daysWithZeroInput = 0;
    const ratios: number[] = [];

    for (const day of perDay.values()) {
      inputTokens += day.inTok;
      outputTokens += day.outTok;
      srcTokens += day.totalTok;
      if (day.inTok <= 0) {
        daysWithZeroInput += 1;
      } else {
        ratios.push(day.outTok / day.inTok);
      }
    }

    totalTokens += srcTokens;

    const daysWithRatio = ratios.length;
    let meanRatio = 0;
    let stdRatio = 0;
    let ratioCv = 0;
    let flatLine = false;

    if (daysWithRatio > 0) {
      let sum = 0;
      for (const r of ratios) sum += r;
      meanRatio = sum / daysWithRatio;
      let sq = 0;
      for (const r of ratios) {
        const d = r - meanRatio;
        sq += d * d;
      }
      stdRatio = Math.sqrt(sq / daysWithRatio);
      if (meanRatio === 0) {
        // every ratio was exactly 0 → output_tokens always 0
        ratioCv = 0;
        flatLine = true;
      } else {
        ratioCv = stdRatio / meanRatio;
      }
    }

    allRows.push({
      source,
      tokens: srcTokens,
      inputTokens,
      outputTokens,
      activeDays: perDay.size,
      daysWithRatio,
      daysWithZeroInput,
      meanRatio,
      stdRatio,
      ratioCv,
      flatLine,
      singleSample: daysWithRatio === 1,
    });
  }

  let droppedBelowMinDays = 0;
  let droppedBelowCvMin = 0;
  const survived: SourceIoRatioStabilityRow[] = [];
  for (const row of allRows) {
    if (row.daysWithRatio < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    if (row.ratioCv < cvMin) {
      droppedBelowCvMin += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'cv') {
      primary = a.ratioCv - b.ratioCv;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'mean') {
      primary = a.meanRatio - b.meanRatio;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'days') {
      primary = b.daysWithRatio - a.daysWithRatio;
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
    cvMin,
    totalSources: allRows.length,
    totalTokens,
    droppedInvalidHourStart,
    droppedSourceFilter,
    droppedBelowMinDays,
    droppedBelowCvMin,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
