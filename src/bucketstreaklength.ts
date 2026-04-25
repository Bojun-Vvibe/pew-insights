/**
 * bucket-streak-length: per-model consecutive-active-bucket runs.
 *
 * For every model (normalised), we sort its distinct active
 * `hour_start` buckets and break that timeline into "streaks":
 * maximal runs of consecutive buckets where each step is exactly
 * one bucket-width apart. A bucket-width is inferred from the
 * smallest positive inter-bucket gap observed across the entire
 * filtered queue (typically 30 or 60 minutes — `pew` emits one
 * or the other depending on the writer). If only one bucket
 * exists across the whole input we fall back to 60 minutes; that
 * fallback only ever produces single-bucket streaks of length 1
 * for any model.
 *
 * For every model we report:
 *
 *   - activeBuckets:      total distinct active buckets
 *   - streakCount:        number of streaks (one per maximal run)
 *   - longestStreak:      length of the longest streak (>= 1)
 *   - meanStreakLength:   activeBuckets / streakCount
 *   - longestStreakStart: ISO start of the longest streak's first
 *                         bucket (lex tiebreak on ties — earliest
 *                         wins)
 *   - longestStreakEnd:   ISO start of the longest streak's last
 *                         bucket
 *   - tokens:             sum of total_tokens across active buckets
 *
 * Why a separate subcommand:
 *
 *   - `model-tenure` reports first/last/span/active-bucket counts,
 *     but treats the entire tenure as a single span — it cannot
 *     tell you whether a model with 200 active buckets was used
 *     in one continuous 200-bucket marathon or in 200 isolated
 *     single-bucket touches.
 *   - `burstiness` and `interarrival` describe gap *distributions*
 *     between buckets but do not surface the longest sustained
 *     run as a single number. A model with mean interarrival = 1h
 *     could still have a max streak of 3, or of 300; the mean
 *     does not tell you which.
 *   - `bucket-intensity` is per-bucket magnitude, orthogonal to
 *     temporal contiguity.
 *   - `idle-gaps` measures inactivity between buckets — the
 *     complement view. This subcommand measures contiguous
 *     activity directly.
 *
 * The headline question this answers: "for each model, what is the
 * longest consecutive run of active buckets, and how often does
 * the model sustain runs?" — i.e., sustained vs spiky usage.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface BucketStreakLengthOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop models whose `activeBuckets` < `minBuckets` from `models[]`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 = keep every model. Counts surface as
   * `droppedSparseModels`.
   */
  minBuckets?: number;
  /**
   * Sort key for `models[]`:
   *   - 'length' (default): longestStreak desc (longest run first)
   *   - 'tokens':           tokens desc (highest mass first)
   *   - 'active':           activeBuckets desc (most-touched first)
   *   - 'mean':             meanStreakLength desc (most-sustained first)
   * Tiebreak in all cases: model key asc (lex).
   */
  sort?: 'length' | 'tokens' | 'active' | 'mean';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
  /**
   * Override the inferred bucket-width in milliseconds. Tests use
   * this to force a known width without depending on the input
   * shape. When unset, width is inferred from the smallest
   * positive inter-bucket gap across all filtered rows; if no
   * positive gap exists, falls back to 3,600,000 (1h).
   */
  bucketWidthMs?: number;
}

export interface BucketStreakLengthRow {
  model: string;
  activeBuckets: number;
  streakCount: number;
  longestStreak: number;
  meanStreakLength: number;
  longestStreakStart: string;
  longestStreakEnd: string;
  tokens: number;
}

export interface BucketStreakLengthReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `minBuckets` floor. */
  minBuckets: number;
  /** Echo of the resolved `sort` key. */
  sort: 'length' | 'tokens' | 'active' | 'mean';
  /** Bucket-width (ms) used to decide consecutiveness. */
  bucketWidthMs: number;
  /** True if `bucketWidthMs` was inferred from the data. */
  bucketWidthInferred: boolean;
  /** Distinct models surviving filters (pre min-buckets filter). */
  totalModels: number;
  /** Sum of activeBuckets across the *full* population. */
  totalActiveBuckets: number;
  /** Sum of total_tokens across the *full* population. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Model rows hidden by the `minBuckets` floor. */
  droppedSparseModels: number;
  /** Per-model streak rows, sorted by longestStreak desc, model asc. */
  models: BucketStreakLengthRow[];
}

const HOUR_MS = 3_600_000;

export function buildBucketStreakLength(
  queue: QueueLine[],
  opts: BucketStreakLengthOptions = {},
): BucketStreakLengthReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
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
  const sort = opts.sort ?? 'length';
  if (
    sort !== 'length' &&
    sort !== 'tokens' &&
    sort !== 'active' &&
    sort !== 'mean'
  ) {
    throw new Error(
      `sort must be 'length' | 'tokens' | 'active' | 'mean' (got ${opts.sort})`,
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

  interface Acc {
    // map from ms -> hour_start string (for ISO output) and tokens accum
    bucketMs: Map<number, { iso: string; tokens: number }>;
  }
  const perModel = new Map<string, Acc>();
  const allMsSet = new Set<number>();

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

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');

    let acc = perModel.get(model);
    if (!acc) {
      acc = { bucketMs: new Map<number, { iso: string; tokens: number }>() };
      perModel.set(model, acc);
    }
    const cell = acc.bucketMs.get(ms);
    if (cell) {
      cell.tokens += tt;
    } else {
      acc.bucketMs.set(ms, { iso: q.hour_start, tokens: tt });
    }
    allMsSet.add(ms);
  }

  // Infer bucket width as the smallest positive gap between
  // distinct active timestamps (across all models). Ties on
  // smallest gap are fine — gap is gap.
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

  const models: BucketStreakLengthRow[] = [];
  let droppedSparseModels = 0;
  let totalActiveBuckets = 0;
  let totalTokens = 0;

  for (const [model, acc] of perModel.entries()) {
    const sorted = [...acc.bucketMs.entries()].sort((a, b) => a[0] - b[0]);
    const activeBuckets = sorted.length;
    if (activeBuckets === 0) continue;

    let modelTokens = 0;
    for (const [, cell] of sorted) modelTokens += cell.tokens;

    totalActiveBuckets += activeBuckets;
    totalTokens += modelTokens;

    if (activeBuckets < minBuckets) {
      droppedSparseModels += 1;
      continue;
    }

    // Walk the sorted timeline and count streaks. A step that is
    // exactly bucketWidthMs continues the current streak; any
    // larger gap closes the current streak and starts a new one.
    let streakCount = 1;
    let currentLen = 1;
    let currentStartIdx = 0;
    let longest = 1;
    let longestStartIdx = 0;
    let longestEndIdx = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i]![0] - sorted[i - 1]![0];
      if (gap === bucketWidthMs) {
        currentLen += 1;
      } else {
        // close the closing streak: check if it was the longest
        if (currentLen > longest) {
          longest = currentLen;
          longestStartIdx = currentStartIdx;
          longestEndIdx = i - 1;
        }
        streakCount += 1;
        currentLen = 1;
        currentStartIdx = i;
      }
    }
    // close the final streak
    if (currentLen > longest) {
      longest = currentLen;
      longestStartIdx = currentStartIdx;
      longestEndIdx = sorted.length - 1;
    }

    models.push({
      model,
      activeBuckets,
      streakCount,
      longestStreak: longest,
      meanStreakLength: activeBuckets / streakCount,
      longestStreakStart: sorted[longestStartIdx]![1].iso,
      longestStreakEnd: sorted[longestEndIdx]![1].iso,
      tokens: modelTokens,
    });
  }

  models.sort((a, b) => {
    let primary = 0;
    if (sort === 'length') primary = b.longestStreak - a.longestStreak;
    else if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'active') primary = b.activeBuckets - a.activeBuckets;
    else primary = b.meanStreakLength - a.meanStreakLength;
    if (primary !== 0) return primary;
    return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minBuckets,
    sort,
    bucketWidthMs,
    bucketWidthInferred,
    totalModels: models.length,
    totalActiveBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseModels,
    models,
  };
}
