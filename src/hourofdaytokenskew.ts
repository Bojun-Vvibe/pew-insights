/**
 * hour-of-day-token-skew: per UTC hour-of-day (0..23), the sample
 * skewness of daily token totals across the days that hour was
 * observed in the queue.
 *
 * For every `QueueLine` we attribute its `total_tokens` to the
 * (UTC date, UTC hour-of-day) cell extracted from `hour_start`.
 * Within one hour-of-day bucket we then have a vector of per-day
 * totals — one observation per UTC date that had at least one
 * row landing in that hour. We compute the standard
 * Fisher–Pearson moment skewness `g1 = m3 / m2^1.5` on that
 * vector, where `m_k` is the k-th central moment about the mean.
 *
 *   - g1 ≈ 0:  symmetric (or only mildly tilted) day-to-day
 *              token usage at that hour.
 *   - g1 > 0:  right-skewed — most days are quiet at that hour
 *              and a small set of days carry occasional bursts.
 *   - g1 < 0:  left-skewed — most days are heavy at that hour
 *              and a small set of days are quiet.
 *
 * Distinct lens vs the existing reports:
 *
 *   - `hour-of-week`, `peak-hour`, `time-of-day` report the
 *     *mean* / *median* / *share* of tokens per hour. They tell
 *     you which hours carry the most mass, but not whether that
 *     mass arrives steadily every day or in occasional bursts.
 *   - `bucket-token-gini` measures concentration *per source
 *     across its active hour buckets* — orthogonal axis.
 *     hour-of-day-token-skew fixes the hour-of-day and varies
 *     the day, which is the day-to-day stability question.
 *   - `hour-of-day-source-mix-entropy` measures *which sources*
 *     dominate each hour, not *how variable* the per-day token
 *     totals are within an hour.
 *   - `burstiness` is a single global coefficient of variation —
 *     no hour-of-day breakdown.
 *   - `weekday-share` is a different temporal axis (weekday, not
 *     hour-of-day) and reports shares, not distribution shape.
 *
 * Use case: identify hours where the *shape* of demand differs
 * from the rest. An hour that ranks middle-of-the-pack on mean
 * tokens but has a sky-high positive skew is a "rare-burst"
 * hour — capacity sized for the median will brown out on those
 * occasional spikes. A perfectly symmetric high-mean hour is
 * predictable steady demand and can be planned more aggressively.
 *
 * Output:
 *
 *   - one row per UTC hour-of-day that has at least `--min-days`
 *     observed days (default 2 — skewness is undefined on n<2
 *     and noisy on tiny n; 2 is the minimum to compute m2 > 0).
 *   - per-row: hour, observedDays, totalTokens, meanDailyTokens,
 *              stddevDailyTokens, skewness, maxDailyTokens,
 *              minDailyTokens.
 *   - global rollup: bucket-count-weighted mean of |skewness|
 *     across kept hours (which hours are most asymmetric on
 *     average, weighted by token mass), the unweighted mean
 *     skewness across kept hours, and the count of hours with
 *     |skewness| >= 1 (a conventional "highly skewed" threshold).
 *
 * Window semantics: `--since` / `--until` filter by `hour_start`
 * before per-(date, hour) aggregation, so the returned vectors
 * reflect only the in-window observations.
 *
 * Determinism: pure builder. `generatedAt` is the only
 * `Date.now()` read and is overridable. All sorts fully specified.
 */
import type { QueueLine } from './types.js';

export interface HourOfDayTokenSkewOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop hours from `hours[]` whose observed-day count is
   * `< minDays`. Their counts surface as `droppedBelowMinDays`.
   * Display + global-rollup floor (we only roll up over hours
   * we actually report on, since skewness on n<2 is undefined).
   * Default 2 — the structural minimum to have a non-zero m2.
   */
  minDays?: number;
  /**
   * Optional cap on `hours[]`. When set, the report keeps only
   * the top K hours sorted by `|skewness|` desc (then
   * `totalTokens` desc, then `hour` asc). Hidden hours surface
   * as `droppedBelowTopK`. Crucially, the global rollup
   * (`weightedMeanAbsSkewness`, `unweightedMeanSkewness`,
   * `highlySkewedHourCount`) is computed across the full
   * post-`minDays` kept set *before* the topK cap so the
   * population summary stays invariant under the display cap.
   * Default unset = no cap.
   */
  topK?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface HourOfDayTokenSkewRow {
  /** UTC hour of day, 0..23. */
  hour: number;
  /** Distinct UTC dates that had at least one row in this hour. */
  observedDays: number;
  /** Sum of total_tokens across the (date, hour) cells in this hour. */
  totalTokens: number;
  /** totalTokens / observedDays. 0 when observedDays = 0. */
  meanDailyTokens: number;
  /** Population stddev of per-day totals. 0 when observedDays ≤ 1. */
  stddevDailyTokens: number;
  /** Fisher–Pearson moment skewness g1 on per-day totals.
   *  0 when observedDays ≤ 1 or stddev = 0 (degenerate). */
  skewness: number;
  /** Heaviest single day's total in this hour. 0 when no days. */
  maxDailyTokens: number;
  /** Lightest observed day's total in this hour. 0 when no days. */
  minDailyTokens: number;
}

export interface HourOfDayTokenSkewReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minDays. */
  minDays: number;
  /** Resolved topK cap (null = no cap). */
  topK: number | null;
  /** Sum of total_tokens across all considered rows (post-window). */
  totalTokens: number;
  /** Distinct UTC hours-of-day observed (pre-minDays). */
  observedHours: number;
  /** Rows where `hour_start` did not parse as ISO. */
  droppedInvalidHourStart: number;
  /** Rows with non-finite or non-positive `total_tokens`. */
  droppedZeroTokens: number;
  /** Hours hidden by the `minDays` floor. */
  droppedBelowMinDays: number;
  /** Hours hidden by the `topK` display cap (applied after `minDays`). */
  droppedBelowTopK: number;
  /** Token-weighted mean of `|skewness|` across kept hours. 0 when
   *  there are no considered tokens in kept hours. */
  weightedMeanAbsSkewness: number;
  /** Unweighted mean of (signed) skewness across kept hours.
   *  0 when there are no kept hours. */
  unweightedMeanSkewness: number;
  /** Count of kept hours with |skewness| >= 1.0 (a conventional
   *  "highly skewed" threshold). */
  highlySkewedHourCount: number;
  /** Per-hour rows. Default sort: |skewness| desc → totalTokens desc → hour asc. */
  hours: HourOfDayTokenSkewRow[];
}

/**
 * Fisher–Pearson moment skewness g1 on a numeric vector.
 *   m_k = (1/n) Σ (x_i − mean)^k
 *   g1  = m_3 / m_2^1.5
 * Returns 0 for n ≤ 1 or m_2 == 0 (degenerate / constant vector).
 */
function skewnessOf(values: number[]): { mean: number; stddev: number; skewness: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stddev: 0, skewness: 0 };
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  if (n === 1) return { mean, stddev: 0, skewness: 0 };
  let m2 = 0;
  let m3 = 0;
  for (const v of values) {
    const d = v - mean;
    const d2 = d * d;
    m2 += d2;
    m3 += d2 * d;
  }
  m2 /= n;
  m3 /= n;
  const stddev = Math.sqrt(m2);
  if (m2 === 0) return { mean, stddev: 0, skewness: 0 };
  const g1 = m3 / Math.pow(m2, 1.5);
  if (!Number.isFinite(g1)) return { mean, stddev, skewness: 0 };
  return { mean, stddev, skewness: g1 };
}

export function buildHourOfDayTokenSkew(
  queue: QueueLine[],
  opts: HourOfDayTokenSkewOptions = {},
): HourOfDayTokenSkewReport {
  const minDays = opts.minDays ?? 2;
  if (!Number.isFinite(minDays) || minDays < 2 || !Number.isInteger(minDays)) {
    throw new Error(`minDays must be an integer >= 2 (got ${opts.minDays})`);
  }

  const topK = opts.topK ?? null;
  if (topK !== null) {
    if (!Number.isInteger(topK) || topK < 1) {
      throw new Error(`topK must be a positive integer (got ${opts.topK})`);
    }
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

  // hour (0..23) -> dateISO (YYYY-MM-DD UTC) -> tokens
  const agg = new Map<number, Map<string, number>>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let globalTotal = 0;

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

    const d = new Date(ms);
    const hour = d.getUTCHours();
    const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD

    let perDay = agg.get(hour);
    if (!perDay) {
      perDay = new Map();
      agg.set(hour, perDay);
    }
    perDay.set(dateKey, (perDay.get(dateKey) ?? 0) + tt);
    globalTotal += tt;
  }

  const observedHours = agg.size;

  const allRows: HourOfDayTokenSkewRow[] = [];
  for (const [hour, perDay] of agg) {
    const values: number[] = [];
    let total = 0;
    let max = 0;
    let min = Number.POSITIVE_INFINITY;
    for (const [, tokens] of perDay) {
      values.push(tokens);
      total += tokens;
      if (tokens > max) max = tokens;
      if (tokens < min) min = tokens;
    }
    const observedDays = values.length;
    const { mean, stddev, skewness } = skewnessOf(values);
    allRows.push({
      hour,
      observedDays,
      totalTokens: total,
      meanDailyTokens: mean,
      stddevDailyTokens: stddev,
      skewness,
      maxDailyTokens: max,
      minDailyTokens: observedDays > 0 ? min : 0,
    });
  }

  // minDays display floor.
  let droppedBelowMinDays = 0;
  const kept: HourOfDayTokenSkewRow[] = [];
  for (const row of allRows) {
    if (row.observedDays < minDays) {
      droppedBelowMinDays += 1;
      continue;
    }
    kept.push(row);
  }

  // Global rollup is computed on `kept` (post-minDays) so the
  // population summary respects the structural floor.
  let weightedNumerator = 0;
  let weightedDenominator = 0;
  let unweightedSum = 0;
  let highlySkewedHourCount = 0;
  for (const r of kept) {
    weightedNumerator += Math.abs(r.skewness) * r.totalTokens;
    weightedDenominator += r.totalTokens;
    unweightedSum += r.skewness;
    if (Math.abs(r.skewness) >= 1) highlySkewedHourCount += 1;
  }
  const weightedMeanAbsSkewness =
    weightedDenominator === 0 ? 0 : weightedNumerator / weightedDenominator;
  const unweightedMeanSkewness = kept.length === 0 ? 0 : unweightedSum / kept.length;

  // Sort: |skewness| desc → totalTokens desc → hour asc.
  const ranked = [...kept].sort((a, b) => {
    const ab = Math.abs(b.skewness) - Math.abs(a.skewness);
    if (ab !== 0) return ab;
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.hour - b.hour;
  });

  // topK display cap.
  let droppedBelowTopK = 0;
  let display: HourOfDayTokenSkewRow[];
  if (topK === null) {
    display = ranked;
  } else if (ranked.length > topK) {
    droppedBelowTopK = ranked.length - topK;
    display = ranked.slice(0, topK);
  } else {
    display = ranked;
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minDays,
    topK,
    totalTokens: globalTotal,
    observedHours,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedBelowMinDays,
    droppedBelowTopK,
    weightedMeanAbsSkewness,
    unweightedMeanSkewness,
    highlySkewedHourCount,
    hours: display,
  };
}
