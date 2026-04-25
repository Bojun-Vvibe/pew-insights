/**
 * provider-tenure: per-provider active-span lens (the provider-axis
 * analog of `model-tenure`).
 *
 * For every inference vendor (anthropic / openai / google / xai / ...
 * as classified by `classifyProvider` from `providershare`), look at
 * the set of distinct `hour_start` timestamps in which any model from
 * that provider produced a positive `total_tokens` observation, then
 * compute:
 *
 *   - firstSeen:    ISO of the earliest active bucket
 *   - lastSeen:     ISO of the latest active bucket
 *   - spanHours:    clock hours from firstSeen to lastSeen (>= 0,
 *                   may be fractional). 0 for a single-bucket
 *                   provider.
 *   - activeBuckets: number of distinct `hour_start` values with
 *                    at least one positive-token row from any model
 *                    of this provider
 *   - tokens:       sum of total_tokens across all active buckets
 *                   for this provider
 *   - distinctModels: number of distinct (normalised) model ids that
 *                     this provider contributed
 *   - tokensPerActiveBucket: tokens / activeBuckets
 *   - tokensPerSpanHour:    tokens / max(spanHours, 1) — average
 *                           token throughput per clock hour over the
 *                           full tenure (idle or not). 1-hour floor
 *                           keeps single-bucket providers finite.
 *
 * Why a separate subcommand:
 *
 *   - `model-tenure` operates on individual model ids: `gpt-5`,
 *     `gpt-5.4`, and `gpt-5-mini` are three independent rows. That
 *     hides the fact that they're all the same vendor and that the
 *     vendor's tenure is wider than any single model's.
 *   - `provider-share` reports session-count and message-share per
 *     provider but never anchors to firstSeen / lastSeen and never
 *     measures a tenure span — it cannot tell you "openai has been
 *     producing tokens for 47 days, anthropic for 49, xai joined
 *     yesterday".
 *   - `source-tenure` is the producer-axis analog (which CLI was
 *     active when) — orthogonal to which inference vendor served
 *     the tokens.
 *   - `tenure-vs-density-quadrant` is per-model; rolling vendors
 *     into quadrants would require this subcommand's pre-roll first.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';
import { classifyProvider } from './providershare.js';

export interface ProviderTenureOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Truncate `providers[]` to the top N after sorting. Display
   * filter only — `totalProviders`, `totalActiveBuckets`,
   * `totalTokens` always reflect the full population. Counts surface
   * as `droppedTopProviders`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `providers[]`:
   *   - 'span' (default):    spanHours desc (longest tenure first)
   *   - 'active':            activeBuckets desc (most-touched first)
   *   - 'tokens':            tokens desc (highest mass first)
   *   - 'density':           tokensPerSpanHour desc (densest first)
   *   - 'models':            distinctModels desc (broadest first)
   * Tiebreak in all cases: provider name asc (lex).
   */
  sort?: 'span' | 'active' | 'tokens' | 'density' | 'models';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ProviderTenureRow {
  provider: string;
  firstSeen: string;
  lastSeen: string;
  /**
   * Clock hours between firstSeen and lastSeen, may be fractional.
   * 0 for a single-bucket provider.
   */
  spanHours: number;
  /** Distinct `hour_start` buckets touched by this provider. */
  activeBuckets: number;
  /** Sum of total_tokens across this provider's active buckets. */
  tokens: number;
  /** Distinct (normalised) model ids contributed by this provider. */
  distinctModels: number;
  /** tokens / activeBuckets. */
  tokensPerActiveBucket: number;
  /**
   * tokens / max(spanHours, 1). The 1-hour floor keeps the value
   * finite and meaningful for single-bucket providers.
   */
  tokensPerSpanHour: number;
}

export interface ProviderTenureReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved `sort` key. */
  sort: 'span' | 'active' | 'tokens' | 'density' | 'models';
  /** Distinct providers surviving filters. */
  totalProviders: number;
  /** Sum of activeBuckets across the *full* population (pre top cap). */
  totalActiveBuckets: number;
  /** Sum of total_tokens across the *full* population (pre top cap). */
  totalTokens: number;
  /** Rows with non-parseable hour_start. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 / non-finite. */
  droppedZeroTokens: number;
  /** Rows excluded by the `source` filter. */
  droppedSourceFilter: number;
  /** Provider rows hidden by the `top` cap. */
  droppedTopProviders: number;
  /** Per-provider tenure rows after sort + top cap. */
  providers: ProviderTenureRow[];
}

const HOUR_MS = 3_600_000;

export function buildProviderTenure(
  queue: QueueLine[],
  opts: ProviderTenureOptions = {},
): ProviderTenureReport {
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'span';
  if (
    sort !== 'span' &&
    sort !== 'active' &&
    sort !== 'tokens' &&
    sort !== 'density' &&
    sort !== 'models'
  ) {
    throw new Error(
      `sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
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
    hours: Set<string>;
    models: Set<string>;
    firstMs: number;
    lastMs: number;
    tokens: number;
  }
  const perProvider = new Map<string, Acc>();

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

    const src = typeof q.source === 'string' ? q.source : '';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    const provider = classifyProvider(model);
    let acc = perProvider.get(provider);
    if (!acc) {
      acc = {
        hours: new Set<string>(),
        models: new Set<string>(),
        firstMs: ms,
        lastMs: ms,
        tokens: 0,
      };
      perProvider.set(provider, acc);
    }
    acc.hours.add(q.hour_start);
    acc.models.add(model);
    if (ms < acc.firstMs) acc.firstMs = ms;
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.tokens += tt;
  }

  const providers: ProviderTenureRow[] = [];
  let totalActiveBuckets = 0;
  let totalTokens = 0;
  for (const [provider, acc] of perProvider.entries()) {
    const activeBuckets = acc.hours.size;
    if (activeBuckets === 0) continue;
    const spanHours = (acc.lastMs - acc.firstMs) / HOUR_MS;
    const tokensPerActiveBucket = acc.tokens / activeBuckets;
    const tokensPerSpanHour = acc.tokens / Math.max(spanHours, 1);
    providers.push({
      provider,
      firstSeen: new Date(acc.firstMs).toISOString(),
      lastSeen: new Date(acc.lastMs).toISOString(),
      spanHours,
      activeBuckets,
      tokens: acc.tokens,
      distinctModels: acc.models.size,
      tokensPerActiveBucket,
      tokensPerSpanHour,
    });
    totalActiveBuckets += activeBuckets;
    totalTokens += acc.tokens;
  }

  providers.sort((a, b) => {
    let primary = 0;
    if (sort === 'span') primary = b.spanHours - a.spanHours;
    else if (sort === 'active') primary = b.activeBuckets - a.activeBuckets;
    else if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'models') primary = b.distinctModels - a.distinctModels;
    else primary = b.tokensPerSpanHour - a.tokensPerSpanHour;
    if (primary !== 0) return primary;
    return a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : 0;
  });

  let droppedTopProviders = 0;
  let kept = providers;
  if (top > 0 && providers.length > top) {
    droppedTopProviders = providers.length - top;
    kept = providers.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    top,
    sort,
    totalProviders: providers.length,
    totalActiveBuckets,
    totalTokens,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedTopProviders,
    providers: kept,
  };
}
