/**
 * bucket-gap-distribution: per-source distribution of gap sizes
 * between consecutive active buckets.
 *
 * For every source, we sort its distinct active `hour_start`
 * buckets and compute the gap between each pair of consecutive
 * buckets *expressed in bucket-widths*. A gap of 1 bucket-width
 * means contiguous (no idle bucket between them); a gap of 5
 * means there were 4 idle buckets between two active ones.
 *
 * Bucket-width is inferred from the smallest positive
 * inter-bucket gap observed across the entire filtered queue
 * (typically 30 or 60 minutes — `pew` emits one or the other
 * depending on the writer). If only one bucket exists across the
 * whole input we fall back to 60 minutes; in that case every
 * source has zero gap rows.
 *
 * For every source we report the gap-count (`gapCount`, equal to
 * `activeBuckets - 1` per source) and the percentile shape
 * (nearest-rank R-1) of those gaps in bucket-widths:
 *
 *   - minGap, p50Gap, p90Gap, p99Gap, maxGap, meanGap
 *   - contiguousGaps:  count of gaps that equal exactly 1 width
 *   - contiguousShare: contiguousGaps / gapCount
 *   - tokens:          sum of total_tokens across the source's
 *                      active buckets
 *
 * Why a separate subcommand:
 *
 *   - `idle-gaps` reports a *single* aggregated idle-time number
 *     per source/global; it does not surface the per-source
 *     percentile shape of gap sizes.
 *   - `bucket-streak-length` reports the *longest contiguous
 *     run* per source/model — the inverse view (it asks how long
 *     a streak gets, not how big the gaps between streaks get).
 *   - `interarrival-time` reports gaps in seconds, not bucket-
 *     widths, and is computed across all events globally rather
 *     than across the per-source distinct-bucket timeline.
 *   - `burstiness` collapses the entire shape to one CV scalar.
 *
 * Headline question this answers: "for each source, when it is
 * not contiguous, how big are the idle gaps — typical, tail, and
 * worst — and what fraction of all gaps are actually contiguous?"
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface BucketGapDistributionOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Drop sources whose `gapCount` < `minGaps` from `sources[]`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 = keep every source. Counts surface as
   * `droppedSparseSources`. A source needs at least 2 active
   * buckets to have a single gap, so a value of 1 already
   * suppresses single-bucket sources.
   */
  minGaps?: number;
  /**
   * Cap displayed `sources[]` to top N after sort + minGaps
   * filter. Suppressed rows surface as `droppedBelowTopCap`.
   * Default unset = no cap.
   */
  top?: number | null;
  /**
   * Floor on individual gaps in *bucket-widths*. Any gap whose
   * size is `< minGap` is dropped from the per-source gap list
   * *before* percentile / mean / contiguousShare computation.
   * Counts surface as `droppedBelowMinGap` (global). Sources
   * whose every gap falls below the floor surface as
   * `droppedAllGapsFloored` (distinct from `droppedSparseSources`,
   * which counts sources whose `gapCount < minGaps` *after* the
   * floor). Default 0 = no per-gap floor. Setting `2` is the
   * common "ignore contiguous gaps, only describe true idle
   * stretches" mode.
   */
  minGap?: number;
  /**
   * Sort key for `sources[]`:
   *   - 'tokens' (default): tokens desc (highest mass first)
   *   - 'gaps':             gapCount desc (most gappy first)
   *   - 'p50':              p50Gap desc (largest typical gap)
   *   - 'max':              maxGap desc (worst-tail first)
   *   - 'contiguous':       contiguousShare desc (most contiguous first)
   * Tiebreak in all cases: source key asc (lex).
   */
  sort?: 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
  /**
   * Override the inferred bucket-width in milliseconds. Tests use
   * this to force a known width. When unset, width is inferred
   * from the smallest positive inter-bucket gap across all
   * filtered rows; if no positive gap exists, falls back to
   * 3,600,000 (1h).
   */
  bucketWidthMs?: number;
}

export interface BucketGapDistributionRow {
  source: string;
  activeBuckets: number;
  gapCount: number;
  minGap: number;
  p50Gap: number;
  p90Gap: number;
  p99Gap: number;
  maxGap: number;
  meanGap: number;
  contiguousGaps: number;
  contiguousShare: number;
  tokens: number;
}

export interface BucketGapDistributionReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  minGaps: number;
  minGap: number;
  top: number | null;
  sort: 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous';
  bucketWidthMs: number;
  bucketWidthInferred: boolean;
  /** Distinct sources surviving filters (pre min-gaps + top filter). */
  totalSources: number;
  /** Sum of activeBuckets across the *full* population. */
  totalActiveBuckets: number;
  /** Sum of gapCount across the *full* population (post-minGap floor). */
  totalGaps: number;
  /** Sum of total_tokens across the *full* population. */
  totalTokens: number;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedModelFilter: number;
  /** Individual gaps dropped by the per-gap minGap floor. */
  droppedBelowMinGap: number;
  /** Sources whose every gap fell below the minGap floor. */
  droppedAllGapsFloored: number;
  droppedSparseSources: number;
  droppedBelowTopCap: number;
  sources: BucketGapDistributionRow[];
}

const HOUR_MS = 3_600_000;

function nearestRankR1(sortedAsc: number[], pct: number): number {
  // Nearest-rank R-1 percentile: rank = ceil(pct/100 * n), clamped
  // into [1, n], 1-indexed. Caller guarantees sortedAsc.length >= 1.
  const n = sortedAsc.length;
  const rank = Math.max(1, Math.min(n, Math.ceil((pct / 100) * n)));
  return sortedAsc[rank - 1]!;
}

export function buildBucketGapDistribution(
  queue: QueueLine[],
  opts: BucketGapDistributionOptions = {},
): BucketGapDistributionReport {
  const minGaps = opts.minGaps ?? 0;
  if (!Number.isInteger(minGaps) || minGaps < 0) {
    throw new Error(
      `minGaps must be a non-negative integer (got ${opts.minGaps})`,
    );
  }
  const minGap = opts.minGap ?? 0;
  if (!Number.isInteger(minGap) || minGap < 0) {
    throw new Error(
      `minGap must be a non-negative integer (got ${opts.minGap})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  if (opts.bucketWidthMs != null) {
    if (
      !Number.isFinite(opts.bucketWidthMs) ||
      opts.bucketWidthMs <= 0 ||
      !Number.isInteger(opts.bucketWidthMs)
    ) {
      throw new Error(
        `bucketWidthMs must be a positive integer (got ${opts.bucketWidthMs})`,
      );
    }
  }
  const sort = opts.sort ?? 'tokens';
  if (
    sort !== 'tokens' &&
    sort !== 'gaps' &&
    sort !== 'p50' &&
    sort !== 'max' &&
    sort !== 'contiguous'
  ) {
    throw new Error(
      `sort must be 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous' (got ${opts.sort})`,
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

  const modelFilter =
    opts.model != null && opts.model !== '' ? opts.model : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  interface Acc {
    bucketMs: Map<number, number>; // ms -> tokens accumulated
  }
  const perSource = new Map<string, Acc>();
  const allMsSet = new Set<number>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedModelFilter = 0;

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

    if (modelFilter !== null) {
      const m = typeof q.model === 'string' ? q.model : '';
      if (m !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';

    let acc = perSource.get(source);
    if (!acc) {
      acc = { bucketMs: new Map<number, number>() };
      perSource.set(source, acc);
    }
    acc.bucketMs.set(ms, (acc.bucketMs.get(ms) ?? 0) + tt);
    allMsSet.add(ms);
  }

  let bucketWidthMs: number;
  let bucketWidthInferred: boolean;
  if (opts.bucketWidthMs != null) {
    bucketWidthMs = opts.bucketWidthMs;
    bucketWidthInferred = false;
  } else {
    const sortedAll = [...allMsSet].sort((a, b) => a - b);
    let smallest = Number.POSITIVE_INFINITY;
    for (let i = 1; i < sortedAll.length; i += 1) {
      const gap = sortedAll[i]! - sortedAll[i - 1]!;
      if (gap > 0 && gap < smallest) smallest = gap;
    }
    if (Number.isFinite(smallest)) {
      bucketWidthMs = smallest;
      bucketWidthInferred = true;
    } else {
      bucketWidthMs = HOUR_MS;
      bucketWidthInferred = true;
    }
  }

  const allRows: BucketGapDistributionRow[] = [];
  let totalActiveBuckets = 0;
  let totalGaps = 0;
  let totalTokens = 0;
  let droppedBelowMinGap = 0;
  let droppedAllGapsFloored = 0;

  for (const [source, acc] of perSource.entries()) {
    const sortedMs = [...acc.bucketMs.keys()].sort((a, b) => a - b);
    const activeBuckets = sortedMs.length;
    if (activeBuckets === 0) continue;

    let srcTokens = 0;
    for (const v of acc.bucketMs.values()) srcTokens += v;

    totalActiveBuckets += activeBuckets;
    totalTokens += srcTokens;

    const rawGaps: number[] = [];
    for (let i = 1; i < sortedMs.length; i += 1) {
      const deltaMs = sortedMs[i]! - sortedMs[i - 1]!;
      const widths = Math.round(deltaMs / bucketWidthMs);
      rawGaps.push(widths > 0 ? widths : 1);
    }

    // Apply per-gap minGap floor.
    const gaps: number[] = [];
    let flooredHere = 0;
    for (const g of rawGaps) {
      if (g < minGap) {
        flooredHere += 1;
        continue;
      }
      gaps.push(g);
    }
    droppedBelowMinGap += flooredHere;

    // Track the case where the source had raw gaps but all of
    // them were floored away.
    if (rawGaps.length > 0 && gaps.length === 0) {
      droppedAllGapsFloored += 1;
    }

    totalGaps += gaps.length;

    if (gaps.length === 0) {
      // Single-bucket source: no gap distribution. Emit row with
      // safe sentinels so downstream rendering does not crash;
      // minGaps filter typically suppresses it.
      allRows.push({
        source,
        activeBuckets,
        gapCount: 0,
        minGap: 0,
        p50Gap: 0,
        p90Gap: 0,
        p99Gap: 0,
        maxGap: 0,
        meanGap: 0,
        contiguousGaps: 0,
        contiguousShare: 0,
        tokens: srcTokens,
      });
      continue;
    }

    const sortedGaps = [...gaps].sort((a, b) => a - b);
    let sum = 0;
    let contiguous = 0;
    for (const g of gaps) {
      sum += g;
      if (g === 1) contiguous += 1;
    }
    const meanGap = sum / gaps.length;
    allRows.push({
      source,
      activeBuckets,
      gapCount: gaps.length,
      minGap: sortedGaps[0]!,
      p50Gap: nearestRankR1(sortedGaps, 50),
      p90Gap: nearestRankR1(sortedGaps, 90),
      p99Gap: nearestRankR1(sortedGaps, 99),
      maxGap: sortedGaps[sortedGaps.length - 1]!,
      meanGap,
      contiguousGaps: contiguous,
      contiguousShare: contiguous / gaps.length,
      tokens: srcTokens,
    });
  }

  const totalSources = allRows.length;

  // Apply minGaps floor.
  let droppedSparseSources = 0;
  const survivors: BucketGapDistributionRow[] = [];
  for (const row of allRows) {
    if (row.gapCount < minGaps) {
      droppedSparseSources += 1;
      continue;
    }
    survivors.push(row);
  }

  survivors.sort((a, b) => {
    let primary = 0;
    if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'gaps') primary = b.gapCount - a.gapCount;
    else if (sort === 'p50') primary = b.p50Gap - a.p50Gap;
    else if (sort === 'max') primary = b.maxGap - a.maxGap;
    else primary = b.contiguousShare - a.contiguousShare;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let displayed = survivors;
  if (top !== null && survivors.length > top) {
    droppedBelowTopCap = survivors.length - top;
    displayed = survivors.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    model: modelFilter,
    minGaps,
    minGap,
    top,
    sort,
    bucketWidthMs,
    bucketWidthInferred,
    totalSources,
    totalActiveBuckets,
    totalGaps,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedBelowMinGap,
    droppedAllGapsFloored,
    droppedSparseSources,
    droppedBelowTopCap,
    sources: displayed,
  };
}
