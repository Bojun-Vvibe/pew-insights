/**
 * source-decay-half-life: per-source token "half-life" along the
 * tenure axis.
 *
 * For every source (the upstream agent CLI / channel that emitted
 * the row — `claude-code`, `opencode`, `codex`, `hermes`, etc.) we
 * sort its active buckets in time order, walk the cumulative-token
 * curve, and find the first bucket at which the running sum
 * reaches >= 50% of the source's total tokens. We then report:
 *
 *   - firstSeen / lastSeen: ISO of first and last active bucket.
 *   - spanHours:            clock hours first->last (fractional;
 *                           0 if a single bucket).
 *   - activeBuckets:        distinct active hour_start values.
 *   - tokens:               sum of total_tokens.
 *   - halfLifeIso:          ISO of the bucket where the cumulative
 *                           token sum first crossed >= 50% of the
 *                           source's total mass.
 *   - halfLifeHours:        clock hours from firstSeen to
 *                           halfLifeIso (>= 0).
 *   - halfLifeFraction:     halfLifeHours / spanHours, in [0, 1].
 *                           Single-bucket source -> 0. Lower means
 *                           more front-loaded; 0.5 means a flat
 *                           token-rate over tenure; > 0.5 means
 *                           back-loaded ("ramping up late").
 *   - frontLoadIndex:       0.5 - halfLifeFraction. Positive ->
 *                           front-loaded (most mass landed early
 *                           in the source's life); negative ->
 *                           back-loaded; 0 -> uniform across span.
 *
 * Why a separate subcommand:
 *
 *   - `source-tenure` reports first/last/span/active-buckets/tokens
 *     but treats tenure as a single span — it cannot tell you
 *     whether the tokens landed evenly across the span or piled up
 *     at one end.
 *   - `bucket-streak-length` measures contiguity, not where in the
 *     tenure window the mass actually accrued.
 *   - `tail-share` and `provider-share` are pure mass tallies with
 *     no tenure axis.
 *   - `idle-gaps` measures inactivity gaps — orthogonal.
 *   - `source-mix` is composition by source over the *whole window*,
 *     not by source's own tenure.
 *
 * Headline question: "for each source, did most of the tokens land
 * early in the source's lifetime, late, or evenly?" — i.e., is this
 * source still ramping up, plateauing, or already declining?
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';

export interface SourceDecayHalfLifeOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single normalised model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Drop sources whose `activeBuckets` < `minBuckets` from
   * `sources[]`. Display filter only — global denominators
   * (totalSources, totalActiveBuckets, totalTokens) reflect the
   * full population. Suppressed rows surface as
   * `droppedSparseSources`. Default 0 = keep every source.
   */
  minBuckets?: number;
  /**
   * Cap the number of `sources[]` rows emitted after sorting and
   * the `minBuckets` floor. Suppressed rows surface as
   * `droppedBelowTopCap`. Default null = no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'halflife' (default): halfLifeFraction asc (most
   *     front-loaded first; ties on tokens desc, source asc).
   *   - 'frontload':          frontLoadIndex desc (== 'halflife'
   *     in ordering but emphasizes the index column when reading).
   *   - 'tokens':             tokens desc (highest mass first).
   *   - 'span':               spanHours desc (longest tenure first).
   *   - 'active':             activeBuckets desc.
   * Final tiebreak in all cases: source key asc (lex).
   */
  sort?: 'halflife' | 'frontload' | 'tokens' | 'span' | 'active';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceDecayHalfLifeRow {
  source: string;
  firstSeen: string;
  lastSeen: string;
  spanHours: number;
  activeBuckets: number;
  tokens: number;
  halfLifeIso: string;
  halfLifeHours: number;
  halfLifeFraction: number;
  frontLoadIndex: number;
}

export interface SourceDecayHalfLifeReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  model: string | null;
  /** Echo of the resolved `minBuckets` floor. */
  minBuckets: number;
  /** Echo of the resolved `top` cap (null = no cap). */
  top: number | null;
  /** Echo of the resolved `sort` key. */
  sort: 'halflife' | 'frontload' | 'tokens' | 'span' | 'active';
  /** Distinct sources surviving filters (pre min-buckets filter). */
  totalSources: number;
  /** Sum of activeBuckets across the *full* surviving population. */
  totalActiveBuckets: number;
  /** Sum of total_tokens across the *full* surviving population. */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `model` filter. */
  droppedModelFilter: number;
  /** Source rows hidden by the `minBuckets` floor. */
  droppedSparseSources: number;
  /** Source rows trimmed by the `top` cap (after sort + floor). */
  droppedBelowTopCap: number;
  /** Per-source rows, sorted per opts.sort. */
  sources: SourceDecayHalfLifeRow[];
}

const HOUR_MS = 3_600_000;

export function buildSourceDecayHalfLife(
  queue: QueueLine[],
  opts: SourceDecayHalfLifeOptions = {},
): SourceDecayHalfLifeReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(
        `top must be a positive integer (got ${opts.top})`,
      );
    }
  }
  const sort = opts.sort ?? 'halflife';
  if (
    sort !== 'halflife' &&
    sort !== 'frontload' &&
    sort !== 'tokens' &&
    sort !== 'span' &&
    sort !== 'active'
  ) {
    throw new Error(
      `sort must be 'halflife' | 'frontload' | 'tokens' | 'span' | 'active' (got ${opts.sort})`,
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

  // per source: ms-bucket -> tokens accumulator (with iso for output)
  interface Acc {
    bucketMs: Map<number, { iso: string; tokens: number }>;
  }
  const perSource = new Map<string, Acc>();

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
      const model = typeof q.model === 'string' ? q.model : '';
      if (model !== modelFilter) {
        droppedModelFilter += 1;
        continue;
      }
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';

    let acc = perSource.get(source);
    if (!acc) {
      acc = { bucketMs: new Map<number, { iso: string; tokens: number }>() };
      perSource.set(source, acc);
    }
    const cell = acc.bucketMs.get(ms);
    if (cell) {
      cell.tokens += tt;
    } else {
      acc.bucketMs.set(ms, { iso: q.hour_start, tokens: tt });
    }
  }

  const sources: SourceDecayHalfLifeRow[] = [];
  let droppedSparseSources = 0;
  let totalActiveBuckets = 0;
  let totalTokens = 0;

  for (const [source, acc] of perSource.entries()) {
    const sorted = [...acc.bucketMs.entries()].sort((a, b) => a[0] - b[0]);
    const activeBuckets = sorted.length;
    if (activeBuckets === 0) continue;

    let srcTokens = 0;
    for (const [, cell] of sorted) srcTokens += cell.tokens;

    totalActiveBuckets += activeBuckets;
    totalTokens += srcTokens;

    if (activeBuckets < minBuckets) {
      droppedSparseSources += 1;
      continue;
    }

    const firstMs = sorted[0]![0];
    const lastMs = sorted[sorted.length - 1]![0];
    const firstIso = sorted[0]![1].iso;
    const lastIso = sorted[sorted.length - 1]![1].iso;
    const spanMs = lastMs - firstMs;
    const spanHours = spanMs / HOUR_MS;

    // Find the first bucket at which the running cumulative sum
    // reaches >= 50% of srcTokens. Single-bucket sources collapse
    // to that one bucket trivially.
    const halfTarget = srcTokens / 2;
    let runSum = 0;
    let halfIdx = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      runSum += sorted[i]![1].tokens;
      if (runSum >= halfTarget) {
        halfIdx = i;
        break;
      }
    }
    const halfMs = sorted[halfIdx]![0];
    const halfIso = sorted[halfIdx]![1].iso;
    const halfHours = (halfMs - firstMs) / HOUR_MS;
    const halfFraction = spanMs > 0 ? halfHours / spanHours : 0;
    const frontLoadIndex = 0.5 - halfFraction;

    sources.push({
      source,
      firstSeen: firstIso,
      lastSeen: lastIso,
      spanHours,
      activeBuckets,
      tokens: srcTokens,
      halfLifeIso: halfIso,
      halfLifeHours: halfHours,
      halfLifeFraction: halfFraction,
      frontLoadIndex,
    });
  }

  sources.sort((a, b) => {
    let primary = 0;
    if (sort === 'halflife') {
      primary = a.halfLifeFraction - b.halfLifeFraction;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'frontload') {
      primary = b.frontLoadIndex - a.frontLoadIndex;
      if (primary === 0) primary = b.tokens - a.tokens;
    } else if (sort === 'tokens') {
      primary = b.tokens - a.tokens;
    } else if (sort === 'span') {
      primary = b.spanHours - a.spanHours;
    } else {
      primary = b.activeBuckets - a.activeBuckets;
    }
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = sources;
  if (top !== null && sources.length > top) {
    droppedBelowTopCap = sources.length - top;
    finalSources = sources.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    model: modelFilter,
    minBuckets,
    top,
    sort,
    totalSources: sources.length,
    totalActiveBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedModelFilter,
    droppedSparseSources,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
