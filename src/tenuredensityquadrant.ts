/**
 * tenure-vs-density-quadrant: classify each model into one of four
 * quadrants by (tenure × density), where the splits are the global
 * medians of the surviving population.
 *
 * For each model we compute:
 *   - spanHours:    clock hours from firstSeen to lastSeen (>= 0,
 *                   may be fractional). 0 for a single-bucket model.
 *   - activeBuckets: number of distinct hour_start buckets.
 *   - tokens:       sum of total_tokens over those buckets.
 *   - density:      tokens / activeBuckets (mean per-bucket mass).
 *
 * Then we compute the median spanHours and the median density across
 * all surviving models and bucket each model into:
 *
 *   - long-dense   (LD): spanHours >= medianSpan AND density >= medianDensity
 *   - long-sparse  (LS): spanHours >= medianSpan AND density <  medianDensity
 *   - short-dense  (SD): spanHours <  medianSpan AND density >= medianDensity
 *   - short-sparse (SS): spanHours <  medianSpan AND density <  medianDensity
 *
 * The split convention is "ties go long / dense" (>=) so the upper-right
 * quadrant tends to be slightly heavier when there is an odd count or
 * many ties on the median. This is documented and stable.
 *
 * Why this is a distinct lens:
 *
 *   - `model-tenure` reports each model's span/active-buckets/tokens
 *     individually but never *classifies* models into a population-relative
 *     2×2 grid. The quadrant assignment is the new artifact here.
 *   - `bucket-intensity` reports per-bucket magnitude distributions per
 *     model — it has no notion of tenure span and never crosses a model
 *     against population medians.
 *   - `model-mix-entropy` collapses model usage into a single concentration
 *     scalar per window — not per-model and not bivariate.
 *   - `tail-share` is a per-source Pareto over buckets — it operates on
 *     sources, not models, and has no tenure axis.
 *
 * Determinism: pure builder. Wall clock only via opts.generatedAt.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export type Quadrant = 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse';

export interface TenureDensityQuadrantOptions {
  /** Inclusive ISO lower bound on hour_start. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on hour_start. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop models whose activeBuckets < n before computing medians and
   * assigning quadrants. Suppressed rows surface as droppedSparseModels.
   * Default 0 = no floor.
   */
  minBuckets?: number;
  /**
   * Truncate the per-quadrant `models[]` lists to the top n rows (by
   * tokens desc) for display. Display filter only — quadrant counts
   * always reflect the full surviving population. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key inside each quadrant's `models[]` list:
   *   - 'tokens' (default): tokens desc
   *   - 'span':             spanHours desc
   *   - 'density':          density desc
   *   - 'active':           activeBuckets desc
   * Tiebreak in all cases: model name asc.
   */
  sort?: 'tokens' | 'span' | 'density' | 'active';
  /**
   * Restrict the displayed report to a single quadrant. The medians
   * are still computed over the full surviving population (so the
   * filter does NOT change which models are classified into which
   * quadrant) — it only suppresses the other three quadrants from
   * `quadrants[]` for display. Suppressed quadrants surface as
   * `droppedQuadrants` (count + tokens). Default null = show all four.
   */
  quadrant?: Quadrant | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface QuadrantModelRow {
  model: string;
  spanHours: number;
  activeBuckets: number;
  tokens: number;
  density: number;
  quadrant: Quadrant;
}

export interface QuadrantBucket {
  quadrant: Quadrant;
  /** Total models assigned to this quadrant (full surviving population). */
  count: number;
  /** Sum of tokens across all models in this quadrant. */
  tokens: number;
  /** Sum of activeBuckets across all models in this quadrant. */
  activeBuckets: number;
  /** Per-model rows, sorted, possibly truncated by `top`. */
  models: QuadrantModelRow[];
  /** Models hidden by the `top` cap (for this quadrant only). */
  droppedTop: number;
}

export interface TenureDensityQuadrantReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  /** Echo of the resolved minBuckets floor. */
  minBuckets: number;
  /** Echo of the resolved per-quadrant top cap (0 = no cap). */
  top: number;
  /** Echo of the resolved sort key. */
  sort: 'tokens' | 'span' | 'density' | 'active';
  /** Echo of the resolved quadrant filter (null = no filter). */
  quadrant: Quadrant | null;
  /** Distinct models surviving filters (after minBuckets). */
  totalModels: number;
  /** Sum of activeBuckets across the surviving population. */
  totalActiveBuckets: number;
  /** Sum of total_tokens across the surviving population. */
  totalTokens: number;
  /**
   * Median spanHours of the surviving population. null when totalModels == 0.
   * The split is `>= medianSpanHours` for "long". Even-N median is the
   * arithmetic mean of the two middle values.
   */
  medianSpanHours: number | null;
  /**
   * Median density (tokens / activeBuckets) of the surviving population.
   * null when totalModels == 0. The split is `>= medianDensity` for "dense".
   */
  medianDensity: number | null;
  droppedInvalidHourStart: number;
  droppedZeroTokens: number;
  droppedSourceFilter: number;
  /** Models excluded by the minBuckets floor. */
  droppedSparseModels: number;
  /** Buckets lost via the minBuckets floor. */
  droppedSparseBuckets: number;
  /**
   * Quadrants suppressed by the `quadrant` filter. Always 0 if
   * `quadrant` is null. Aggregates over the suppressed quadrants:
   * sum of model counts and sum of tokens.
   */
  droppedQuadrantModels: number;
  droppedQuadrantTokens: number;
  /** Quadrants in fixed order: LD, LS, SD, SS (filtered if requested). */
  quadrants: QuadrantBucket[];
}

const HOUR_MS = 3_600_000;
const QUADRANT_ORDER: Quadrant[] = [
  'long-dense',
  'long-sparse',
  'short-dense',
  'short-sparse',
];

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) throw new Error('median of empty list');
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildTenureDensityQuadrant(
  queue: QueueLine[],
  opts: TenureDensityQuadrantOptions = {},
): TenureDensityQuadrantReport {
  const minBuckets = opts.minBuckets ?? 0;
  if (!Number.isInteger(minBuckets) || minBuckets < 0) {
    throw new Error(
      `minBuckets must be a non-negative integer (got ${opts.minBuckets})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const sort = opts.sort ?? 'tokens';
  if (sort !== 'tokens' && sort !== 'span' && sort !== 'density' && sort !== 'active') {
    throw new Error(
      `sort must be 'tokens' | 'span' | 'density' | 'active' (got ${opts.sort})`,
    );
  }
  const quadrantFilter = opts.quadrant ?? null;
  if (
    quadrantFilter !== null &&
    quadrantFilter !== 'long-dense' &&
    quadrantFilter !== 'long-sparse' &&
    quadrantFilter !== 'short-dense' &&
    quadrantFilter !== 'short-sparse'
  ) {
    throw new Error(
      `quadrant must be one of 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse' (got ${opts.quadrant})`,
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
    firstMs: number;
    lastMs: number;
    tokens: number;
  }
  const perModel = new Map<string, Acc>();

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
    let acc = perModel.get(model);
    if (!acc) {
      acc = {
        hours: new Set<string>(),
        firstMs: ms,
        lastMs: ms,
        tokens: 0,
      };
      perModel.set(model, acc);
    }
    acc.hours.add(q.hour_start);
    if (ms < acc.firstMs) acc.firstMs = ms;
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.tokens += tt;
  }

  // Build raw rows + apply minBuckets floor.
  interface RawRow {
    model: string;
    spanHours: number;
    activeBuckets: number;
    tokens: number;
    density: number;
  }
  const raw: RawRow[] = [];
  let droppedSparseModels = 0;
  let droppedSparseBuckets = 0;
  for (const [model, acc] of perModel.entries()) {
    const activeBuckets = acc.hours.size;
    if (activeBuckets === 0) continue;
    if (minBuckets > 0 && activeBuckets < minBuckets) {
      droppedSparseModels += 1;
      droppedSparseBuckets += activeBuckets;
      continue;
    }
    const spanHours = (acc.lastMs - acc.firstMs) / HOUR_MS;
    raw.push({
      model,
      spanHours,
      activeBuckets,
      tokens: acc.tokens,
      density: acc.tokens / activeBuckets,
    });
  }

  const totalModels = raw.length;
  let totalActiveBuckets = 0;
  let totalTokens = 0;
  for (const r of raw) {
    totalActiveBuckets += r.activeBuckets;
    totalTokens += r.tokens;
  }

  let medianSpanHours: number | null = null;
  let medianDensity: number | null = null;
  const quadrantAcc = new Map<Quadrant, QuadrantBucket>();
  for (const q of QUADRANT_ORDER) {
    quadrantAcc.set(q, {
      quadrant: q,
      count: 0,
      tokens: 0,
      activeBuckets: 0,
      models: [],
      droppedTop: 0,
    });
  }

  if (totalModels > 0) {
    const spans = raw.map((r) => r.spanHours).sort((a, b) => a - b);
    const dens = raw.map((r) => r.density).sort((a, b) => a - b);
    medianSpanHours = median(spans);
    medianDensity = median(dens);

    for (const r of raw) {
      const isLong = r.spanHours >= medianSpanHours;
      const isDense = r.density >= medianDensity;
      const quadrant: Quadrant = isLong
        ? isDense
          ? 'long-dense'
          : 'long-sparse'
        : isDense
          ? 'short-dense'
          : 'short-sparse';
      const bucket = quadrantAcc.get(quadrant)!;
      bucket.count += 1;
      bucket.tokens += r.tokens;
      bucket.activeBuckets += r.activeBuckets;
      bucket.models.push({
        model: r.model,
        spanHours: r.spanHours,
        activeBuckets: r.activeBuckets,
        tokens: r.tokens,
        density: r.density,
        quadrant,
      });
    }

    // Sort and (optionally) truncate each quadrant's display list.
    for (const bucket of quadrantAcc.values()) {
      bucket.models.sort((a, b) => {
        let primary = 0;
        if (sort === 'tokens') primary = b.tokens - a.tokens;
        else if (sort === 'span') primary = b.spanHours - a.spanHours;
        else if (sort === 'density') primary = b.density - a.density;
        else primary = b.activeBuckets - a.activeBuckets;
        if (primary !== 0) return primary;
        return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
      });
      if (top > 0 && bucket.models.length > top) {
        bucket.droppedTop = bucket.models.length - top;
        bucket.models = bucket.models.slice(0, top);
      }
    }
  }

  // Apply quadrant display filter (does NOT change classification —
  // only suppresses other quadrants from the report). Suppressed
  // quadrants are aggregated into droppedQuadrant{Models,Tokens}.
  const allQuadrants = QUADRANT_ORDER.map((q) => quadrantAcc.get(q)!);
  let visibleQuadrants: QuadrantBucket[] = allQuadrants;
  let droppedQuadrantModels = 0;
  let droppedQuadrantTokens = 0;
  if (quadrantFilter !== null) {
    visibleQuadrants = allQuadrants.filter((b) => b.quadrant === quadrantFilter);
    for (const b of allQuadrants) {
      if (b.quadrant !== quadrantFilter) {
        droppedQuadrantModels += b.count;
        droppedQuadrantTokens += b.tokens;
      }
    }
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minBuckets,
    top,
    sort,
    quadrant: quadrantFilter,
    totalModels,
    totalActiveBuckets,
    totalTokens,
    medianSpanHours,
    medianDensity,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedSparseModels,
    droppedSparseBuckets,
    droppedQuadrantModels,
    droppedQuadrantTokens,
    quadrants: visibleQuadrants,
  };
}
