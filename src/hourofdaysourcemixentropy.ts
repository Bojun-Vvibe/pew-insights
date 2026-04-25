/**
 * hour-of-day-source-mix-entropy: per-hour-of-day Shannon entropy of
 * source share of token mass.
 *
 * Bin every `QueueLine` by UTC hour-of-day (0..23) using `hour_start`,
 * sum `total_tokens` per (hour, source), then for each hour compute
 * Shannon entropy `H = -Σ p_i log2 p_i` over the per-source share of
 * that hour's tokens.
 *
 *   - H ≈ 0  → that hour is dominated by a single source (mono-source)
 *   - H → log2(k) → tokens are spread evenly across k sources at that
 *     hour (poly-source)
 *
 * Distinct lens vs the existing reports:
 *
 *   - `hour-of-week` and `time-of-day` show absolute token mass per
 *     hour but never ask how *concentrated on a single source* that
 *     hour is.
 *   - `model-mix-entropy` is per-source over models; this is per
 *     hour-of-day over sources. Different axis of diversity.
 *   - `peak-hour` picks the single peak hour by token mass.
 *   - `source-mix` is global; this slices the same population by
 *     hour-of-day so we can see *when* during the day the operator is
 *     mono-source vs poly-source.
 *   - `source-decay-half-life`, `source-tenure`, `source-run-lengths`
 *     are session-side / temporal-stickiness reports, not per-hour
 *     diversity.
 *
 * Use case: spot the hours where one tool monopolises the keyboard
 * (e.g. "I always use opencode at 09:00 UTC") vs hours where
 * everything coexists (e.g. "16:00 UTC is the only hour where four
 * sources fight for tokens"). Useful for scheduling, for deciding
 * when context-switch cost is highest, and for noticing that a
 * fleet purchased to look diverse is actually mono-source for most
 * of the day.
 *
 * What we emit:
 *
 *   - one row per *occupied* hour-of-day bucket (0..23 in UTC),
 *     sorted by hour ascending (default) so the report reads as a
 *     daily curve. Rows for hours with zero considered tokens are
 *     omitted.
 *   - per-row: tokens, sourceCount, entropyBits, maxEntropyBits
 *     (= log2(sourceCount)), normalizedEntropy (in [0,1] when
 *     sourceCount > 1, else 0), effectiveSources (= 2^H), the top
 *     source by share, and the top source's share of that hour.
 *   - global rollup: token-weighted average of `entropyBits` and
 *     `normalizedEntropy` across hours, plus `monoSourceHourCount`
 *     = number of occupied hours where exactly one source supplied
 *     all tokens in that hour.
 *
 * Window semantics: filter by `hour_start`. Window is applied
 * *before* hour-of-day bucketing.
 *
 * Determinism: pure builder. `generatedAt` is the only Date.now()
 * read and overridable. All sorts fully specified.
 */
import type { QueueLine } from './types.js';

export interface HourOfDaySourceMixEntropyOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop hour rows whose total token count is `< minTokens` from
   * `hours[]`. The dropped count surfaces as `droppedSparseHours`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 (keep every occupied hour).
   */
  minTokens?: number;
  /**
   * Optional source allowlist. When set, only QueueLine rows whose
   * `source` matches one of the listed values are considered.
   * Sessions whose source is not in the list are dropped *before*
   * hour bucketing and counted as `droppedByFilterSource`. Lets the
   * operator ask "what does my hour-of-day diversity look like if
   * I only count sources X and Y?". Crucially, dropping sources
   * may collapse a 3-source hour into a 1-source hour — entropy is
   * recomputed on the surviving population. Default unset = no
   * source filter.
   */
  filterSources?: string[];
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface HourOfDaySourceMixEntropyRow {
  /** UTC hour-of-day in [0,23]. */
  hour: number;
  /** Sum of total_tokens for QueueLines whose UTC hour matches. */
  totalTokens: number;
  /** Number of QueueLine rows attributed to this hour. */
  rows: number;
  /** Distinct sources observed for this hour. */
  sourceCount: number;
  /** Shannon entropy in bits over per-source share of total_tokens.
   *  0 when sourceCount ≤ 1. */
  entropyBits: number;
  /** log2(sourceCount). 0 when sourceCount ≤ 1. */
  maxEntropyBits: number;
  /** entropyBits / maxEntropyBits in [0,1]. 0 when sourceCount ≤ 1.
   *  Reads as "how close to a perfectly even per-source split is
   *  this hour?". */
  normalizedEntropy: number;
  /** 2^entropyBits — the effective number of evenly-weighted
   *  sources this hour behaves like. 1 when sourceCount = 1. */
  effectiveSources: number;
  /** Token share of the most-active source for this hour in [0,1]. */
  topSourceShare: number;
  /** Source name of the most-active source for this hour. */
  topSource: string;
}

export interface HourOfDaySourceMixEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of resolved minTokens. */
  minTokens: number;
  /** Resolved source filter (null = no filter). */
  filterSources: string[] | null;
  /** Sum of total_tokens across all considered rows (post-filter). */
  totalTokens: number;
  /** Distinct UTC hour-of-day buckets that had any considered tokens. */
  occupiedHours: number;
  /** Rows where `hour_start` did not parse as ISO. */
  droppedInvalidHourStart: number;
  /** Rows with non-finite or non-positive `total_tokens`. */
  droppedZeroTokens: number;
  /** Rows dropped by the `--filter-source` allowlist. */
  droppedByFilterSource: number;
  /** Hours hidden by the `minTokens` floor. */
  droppedSparseHours: number;
  /** Token-weighted mean of entropyBits across occupied hours.
   *  0 when there are no considered tokens. */
  weightedMeanEntropyBits: number;
  /** Token-weighted mean of normalizedEntropy across occupied
   *  hours. 0 when there are no considered tokens. Hours with
   *  sourceCount ≤ 1 contribute 0 to the numerator (their tokens
   *  still count in the denominator). */
  weightedMeanNormalizedEntropy: number;
  /** Number of occupied hours where exactly one source supplied
   *  all tokens (sourceCount === 1). */
  monoSourceHourCount: number;
  /** Per-hour rows. Default sort: hour asc. */
  hours: HourOfDaySourceMixEntropyRow[];
}

export function buildHourOfDaySourceMixEntropy(
  queue: QueueLine[],
  opts: HourOfDaySourceMixEntropyOptions = {},
): HourOfDaySourceMixEntropyReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative number (got ${opts.minTokens})`);
  }

  let filterSet: Set<string> | null = null;
  if (opts.filterSources != null) {
    if (!Array.isArray(opts.filterSources) || opts.filterSources.length === 0) {
      throw new Error('filterSources must be a non-empty array when provided');
    }
    for (const s of opts.filterSources) {
      if (typeof s !== 'string' || s.length === 0) {
        throw new Error(
          `filterSources entries must be non-empty strings (got ${JSON.stringify(s)})`,
        );
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

  // hour -> source -> tokens
  const agg = new Map<number, { rows: number; total: number; sources: Map<string, number> }>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedByFilterSource = 0;
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

    const src =
      typeof q.source === 'string' && q.source.length > 0 ? q.source : 'unknown';
    if (filterSet !== null && !filterSet.has(src)) {
      droppedByFilterSource += 1;
      continue;
    }

    const hour = new Date(ms).getUTCHours();
    let bucket = agg.get(hour);
    if (!bucket) {
      bucket = { rows: 0, total: 0, sources: new Map() };
      agg.set(hour, bucket);
    }
    bucket.rows += 1;
    bucket.total += tt;
    bucket.sources.set(src, (bucket.sources.get(src) ?? 0) + tt);
    globalTotal += tt;
  }

  const occupiedHours = agg.size;

  const allRows: HourOfDaySourceMixEntropyRow[] = [];
  for (const [hour, bucket] of agg) {
    const sourceCount = bucket.sources.size;
    let entropy = 0;
    let topShare = 0;
    let topSource = '';
    if (bucket.total > 0) {
      const entries = Array.from(bucket.sources.entries()).sort((x, y) => {
        if (y[1] !== x[1]) return y[1] - x[1];
        return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0;
      });
      for (const [, tokens] of entries) {
        if (tokens <= 0) continue;
        const p = tokens / bucket.total;
        entropy += -p * Math.log2(p);
      }
      const top = entries[0]!;
      topSource = top[0];
      topShare = top[1] / bucket.total;
    }
    const maxEntropy = sourceCount > 1 ? Math.log2(sourceCount) : 0;
    const normalized =
      sourceCount > 1 && maxEntropy > 0 ? entropy / maxEntropy : 0;
    const effective = sourceCount > 0 ? Math.pow(2, entropy) : 0;

    allRows.push({
      hour,
      totalTokens: bucket.total,
      rows: bucket.rows,
      sourceCount,
      entropyBits: entropy,
      maxEntropyBits: maxEntropy,
      normalizedEntropy: normalized,
      effectiveSources: effective,
      topSourceShare: topShare,
      topSource,
    });
  }

  // Apply minTokens display filter; count drops.
  let droppedSparseHours = 0;
  const kept: HourOfDaySourceMixEntropyRow[] = [];
  for (const row of allRows) {
    if (row.totalTokens < minTokens) {
      droppedSparseHours += 1;
      continue;
    }
    kept.push(row);
  }
  kept.sort((a, b) => a.hour - b.hour);

  // Global rollup (token-weighted across the *kept* rows). The
  // weights live in the same population the user is looking at.
  let weightedEntropyNumerator = 0;
  let weightedNormalizedNumerator = 0;
  let weightedDenominator = 0;
  let monoSourceHourCount = 0;
  for (const r of kept) {
    weightedEntropyNumerator += r.entropyBits * r.totalTokens;
    weightedNormalizedNumerator += r.normalizedEntropy * r.totalTokens;
    weightedDenominator += r.totalTokens;
    if (r.sourceCount === 1) monoSourceHourCount += 1;
  }
  const weightedMeanEntropyBits =
    weightedDenominator === 0 ? 0 : weightedEntropyNumerator / weightedDenominator;
  const weightedMeanNormalizedEntropy =
    weightedDenominator === 0 ? 0 : weightedNormalizedNumerator / weightedDenominator;

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    filterSources: filterSet === null ? null : [...filterSet].sort(),
    totalTokens: globalTotal,
    occupiedHours,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedByFilterSource,
    droppedSparseHours,
    weightedMeanEntropyBits,
    weightedMeanNormalizedEntropy,
    monoSourceHourCount,
    hours: kept,
  };
}
