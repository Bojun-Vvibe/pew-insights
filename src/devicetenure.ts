/**
 * device-tenure: per-device active-span lens.
 *
 * The same shape as `model-tenure`, `provider-tenure`, and
 * `source-tenure`, but grouped by `device_id` (the stable per-host
 * identifier pew stamps onto every queue row). Completes the tenure
 * family on the fourth and last categorical axis available in the
 * QueueLine schema.
 *
 * For every device_id, we look at the set of distinct `hour_start`
 * timestamps in which it produced a positive `total_tokens`
 * observation, then compute:
 *
 *   - firstSeen:    ISO of the earliest active bucket
 *   - lastSeen:     ISO of the latest active bucket
 *   - spanHours:    clock hours from firstSeen to lastSeen (>= 0,
 *                   may be fractional). 0 for a single-bucket device.
 *   - activeBuckets: number of distinct `hour_start` values
 *   - tokens:       sum of total_tokens across all active buckets
 *   - tokensPerActiveBucket: tokens / activeBuckets (mean intensity)
 *   - tokensPerSpanHour:    tokens / max(spanHours, 1)
 *   - distinctSources:      number of distinct source CLIs seen on
 *                           this device over its tenure (a quick
 *                           "how many tools does this host run?"
 *                           signal that is *not* available from any
 *                           other tenure report).
 *   - distinctModels:       number of distinct normalised models
 *                           routed through this device.
 *
 * Why a separate subcommand:
 *
 *   - `device-share` is a mass tally — it reports the token
 *     percentage each device contributes, but has no firstSeen /
 *     lastSeen / span axis at all. It cannot answer "is this device
 *     a long-tenured laptop or a one-day VM?".
 *   - `model-tenure` / `provider-tenure` / `source-tenure` are on
 *     the wrong axis. Aggregating their rows by hand to the device
 *     level is wrong because the same hour_start gets double-counted
 *     across categories — `device-tenure` reduces on the device axis
 *     directly.
 *   - `cohabitation`, `interarrival`, `burstiness`, etc. are per-
 *     model magnitude/timing stats and never produce a tenure span
 *     on the device axis.
 *
 * `distinctSources` and `distinctModels` are included specifically
 * because once you are looking at devices, the natural follow-ups
 * are "how many CLIs does this host run?" and "how many model
 * variants flow through it?" — both cheap to compute alongside the
 * span and answered by no other report.
 *
 * Bucket granularity: same caveat as the other tenure lenses —
 * `hour_start` may be hourly or half-hourly depending on what pew
 * emits. We do not assume a fixed width; `activeBuckets` is the
 * count of distinct timestamp strings, `spanHours` is wall-clock
 * first->last.
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface DeviceTenureOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /** Restrict to a single model. Non-matching rows -> droppedModelFilter. */
  model?: string | null;
  /**
   * Drop devices whose `activeBuckets` < `minBuckets` from `devices[]`.
   * Display filter only — global denominators reflect the full
   * population. Default 0 = keep every device. Counts surface as
   * `droppedSparseDevices`.
   */
  minBuckets?: number;
  /**
   * Truncate `devices[]` to the top N after sorting. Display filter
   * only — `totalDevices`, `totalActiveBuckets`, `totalTokens`
   * always reflect the full population. Counts surface as
   * `droppedTopDevices`. Default 0 = no cap.
   */
  top?: number;
  /**
   * Sort key for `devices[]`:
   *   - 'span' (default): spanHours desc (longest tenure first)
   *   - 'active':         activeBuckets desc (most-touched first)
   *   - 'tokens':         tokens desc (highest mass first)
   *   - 'density':        tokensPerSpanHour desc (densest first)
   *   - 'sources':        distinctSources desc (broadest CLI host first)
   *   - 'models':         distinctModels desc (broadest model router first)
   *   - 'gap':            longestGapHours desc (longest dormancy first)
   * Tiebreak in all cases: device key asc (lex).
   */
  sort?: 'span' | 'active' | 'tokens' | 'density' | 'sources' | 'models' | 'gap';
  /**
   * Threshold in hours for the `recentlyActive` per-device flag and
   * `recentlyActiveCount` summary. A device is `recentlyActive` iff
   * `(generatedAt - lastSeen) < recentThresholdHours`. Display flag
   * only — does not change which devices are kept. Default 24.
   * Range > 0.
   */
  recentThresholdHours?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DeviceTenureRow {
  device: string;
  firstSeen: string;
  lastSeen: string;
  /**
   * Clock hours between firstSeen and lastSeen, may be fractional.
   * 0 for a single-bucket device.
   */
  spanHours: number;
  /** Distinct `hour_start` buckets in which this device was active. */
  activeBuckets: number;
  /** Sum of total_tokens across this device's active buckets. */
  tokens: number;
  /** tokens / activeBuckets. */
  tokensPerActiveBucket: number;
  /** tokens / max(spanHours, 1). */
  tokensPerSpanHour: number;
  /** Number of distinct sources seen on this device. */
  distinctSources: number;
  /** Number of distinct normalised models seen on this device. */
  distinctModels: number;
  /**
   * Longest contiguous idle gap (in hours) between consecutive
   * active buckets for this device. 0 for a single-bucket device.
   * Surfaces dormancy patterns within an otherwise-long tenure
   * (e.g. a laptop that's been around 200 days but had a 60-day
   * vacation gap).
   */
  longestGapHours: number;
  /**
   * Hours since `generatedAt - lastSeen`. Useful for ranking
   * "stale" devices independent of `spanHours`. May be negative if
   * the test injects a `generatedAt` before the data window.
   */
  hoursSinceLastSeen: number;
  /**
   * True iff `hoursSinceLastSeen < recentThresholdHours`. A device
   * may have a long span but be dormant; this flag separates the
   * two.
   */
  recentlyActive: boolean;
}

export interface DeviceTenureReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  model: string | null;
  /** Echo of the resolved `minBuckets` floor. */
  minBuckets: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Echo of the resolved `sort` key. */
  sort: 'span' | 'active' | 'tokens' | 'density' | 'sources' | 'models' | 'gap';
  /** Echo of the resolved `recentThresholdHours`. */
  recentThresholdHours: number;
  /** Count of devices flagged `recentlyActive` (full population, pre top cap). */
  recentlyActiveCount: number;
  /** Distinct devices surviving filters (pre top cap). */
  totalDevices: number;
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
  /** Rows excluded by the `model` filter. */
  droppedModelFilter: number;
  /** Device rows hidden by the `minBuckets` floor. */
  droppedSparseDevices: number;
  /** Device rows hidden by the `top` cap. */
  droppedTopDevices: number;
  /** Per-device tenure rows after sort + top cap. */
  devices: DeviceTenureRow[];
}

const HOUR_MS = 3_600_000;

export function buildDeviceTenure(
  queue: QueueLine[],
  opts: DeviceTenureOptions = {},
): DeviceTenureReport {
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
  const sort = opts.sort ?? 'span';
  if (
    sort !== 'span' &&
    sort !== 'active' &&
    sort !== 'tokens' &&
    sort !== 'density' &&
    sort !== 'sources' &&
    sort !== 'models' &&
    sort !== 'gap'
  ) {
    throw new Error(
      `sort must be 'span' | 'active' | 'tokens' | 'density' | 'sources' | 'models' | 'gap' (got ${opts.sort})`,
    );
  }
  const recentThresholdHours = opts.recentThresholdHours ?? 24;
  if (!Number.isFinite(recentThresholdHours) || recentThresholdHours <= 0) {
    throw new Error(
      `recentThresholdHours must be > 0 (got ${opts.recentThresholdHours})`,
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
  const modelFilter =
    opts.model != null && opts.model !== '' ? normaliseModel(opts.model) : null;

  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const generatedMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedMs)) {
    throw new Error(`invalid generatedAt: ${opts.generatedAt}`);
  }

  interface Acc {
    hours: Set<string>;
    sources: Set<string>;
    models: Set<string>;
    firstMs: number;
    lastMs: number;
    tokens: number;
    /** Sorted list of distinct hour_start ms values for gap computation. */
    hourMsList: number[];
  }
  const perDevice = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedSourceFilter = 0;
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

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const model = normaliseModel(typeof q.model === 'string' ? q.model : '');
    if (modelFilter !== null && model !== modelFilter) {
      droppedModelFilter += 1;
      continue;
    }

    const device =
      typeof q.device_id === 'string' && q.device_id !== ''
        ? q.device_id
        : 'unknown';

    let acc = perDevice.get(device);
    if (!acc) {
      acc = {
        hours: new Set<string>(),
        sources: new Set<string>(),
        models: new Set<string>(),
        firstMs: ms,
        lastMs: ms,
        tokens: 0,
        hourMsList: [],
      };
      perDevice.set(device, acc);
    }
    if (!acc.hours.has(q.hour_start)) {
      acc.hours.add(q.hour_start);
      acc.hourMsList.push(ms);
    }
    acc.sources.add(source);
    acc.models.add(model);
    if (ms < acc.firstMs) acc.firstMs = ms;
    if (ms > acc.lastMs) acc.lastMs = ms;
    acc.tokens += tt;
  }

  const devices: DeviceTenureRow[] = [];
  let droppedSparseDevices = 0;
  let totalActiveBuckets = 0;
  let totalTokens = 0;
  let recentlyActiveCount = 0;

  for (const [device, acc] of perDevice.entries()) {
    const activeBuckets = acc.hours.size;
    if (activeBuckets === 0) continue;
    totalActiveBuckets += activeBuckets;
    totalTokens += acc.tokens;
    if (activeBuckets < minBuckets) {
      droppedSparseDevices += 1;
      continue;
    }
    const spanHours = (acc.lastMs - acc.firstMs) / HOUR_MS;
    // Longest contiguous idle gap: scan sorted hour_start ms list.
    let longestGapHours = 0;
    if (acc.hourMsList.length >= 2) {
      const sorted = [...acc.hourMsList].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gap = (sorted[i]! - sorted[i - 1]!) / HOUR_MS;
        if (gap > longestGapHours) longestGapHours = gap;
      }
    }
    const hoursSinceLastSeen = (generatedMs - acc.lastMs) / HOUR_MS;
    const recentlyActive = hoursSinceLastSeen < recentThresholdHours;
    if (recentlyActive) recentlyActiveCount += 1;
    devices.push({
      device,
      firstSeen: new Date(acc.firstMs).toISOString(),
      lastSeen: new Date(acc.lastMs).toISOString(),
      spanHours,
      activeBuckets,
      tokens: acc.tokens,
      tokensPerActiveBucket: acc.tokens / activeBuckets,
      tokensPerSpanHour: acc.tokens / Math.max(spanHours, 1),
      distinctSources: acc.sources.size,
      distinctModels: acc.models.size,
      longestGapHours,
      hoursSinceLastSeen,
      recentlyActive,
    });
  }

  devices.sort((a, b) => {
    let primary = 0;
    if (sort === 'span') primary = b.spanHours - a.spanHours;
    else if (sort === 'active') primary = b.activeBuckets - a.activeBuckets;
    else if (sort === 'tokens') primary = b.tokens - a.tokens;
    else if (sort === 'density')
      primary = b.tokensPerSpanHour - a.tokensPerSpanHour;
    else if (sort === 'sources') primary = b.distinctSources - a.distinctSources;
    else if (sort === 'models') primary = b.distinctModels - a.distinctModels;
    else primary = b.longestGapHours - a.longestGapHours;
    if (primary !== 0) return primary;
    return a.device < b.device ? -1 : a.device > b.device ? 1 : 0;
  });

  let droppedTopDevices = 0;
  let kept = devices;
  if (top > 0 && devices.length > top) {
    droppedTopDevices = devices.length - top;
    kept = devices.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    model: modelFilter,
    minBuckets,
    top,
    sort,
    recentThresholdHours,
    totalDevices: devices.length,
    totalActiveBuckets,
    totalTokens,
    recentlyActiveCount,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedSourceFilter,
    droppedModelFilter,
    droppedSparseDevices,
    droppedTopDevices,
    devices: kept,
  };
}
