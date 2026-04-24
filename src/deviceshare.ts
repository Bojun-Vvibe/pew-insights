/**
 * device-share: per-`device_id` slice of the queue population.
 *
 * Each queue line carries the `device_id` that minted it (a stable
 * UUID per pew install). For users who run pew on more than one
 * machine — laptop vs desktop vs CI box — every other report
 * collapses devices together, so it is impossible to ask "which
 * machine actually drove most of last week's spend?" or "is my
 * desktop's claude usage drowning out the laptop's gpt usage?".
 *
 * This builder emits one row per device with:
 *
 *   - totalTokens, share-of-total %
 *   - inputTokens / cachedInputTokens / outputTokens /
 *     reasoningOutputTokens (the four columns the queue ships)
 *   - cacheHitRatio = cachedInputTokens / inputTokens (0 if input=0)
 *   - rows: number of queue lines tagged with this device
 *   - activeHours: distinct `hour_start` buckets the device hit
 *   - distinctModels: count of unique normalised model strings the
 *     device used (a "1" here means single-model machine, "5" means
 *     a generalist)
 *   - distinctSources: count of unique source strings (codex /
 *     claude-code / gemini-cli / ...)
 *   - firstSeen / lastSeen: ISO bounds of `hour_start` across the
 *     device's rows
 *
 * Distinct lens vs the existing reports:
 *
 *   - `provider-share` slices by `source` (which client), not by
 *     `device_id` (which physical machine). A single laptop can
 *     run codex+claude-code+gemini and they all collapse together
 *     in provider-share but split out cleanly here.
 *   - `concurrency`, `velocity`, `peak-hour-share`, `weekday-share`
 *     all collapse across devices.
 *   - `top-projects` is per-project, orthogonal.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Device ids are echoed as-is (UUID strings) —
 * we do not redact or shorten, the renderer does presentation.
 */
import type { QueueLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface DeviceShareOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop device rows whose total token count is `< minTokens` from
   * `devices[]`. Display filter only — global denominators reflect
   * the full population. Default 0 (keep every device).
   */
  minTokens?: number;
  /**
   * Truncate `devices[]` to the top N by total tokens. Display
   * filter only. Default 0 (no truncation).
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface DeviceShareRow {
  deviceId: string;
  totalTokens: number;
  /** totalTokens / globalTotalTokens, in [0,1]. 0 if global is 0. */
  share: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  /** cachedInputTokens / inputTokens. 0 if inputTokens = 0. */
  cacheHitRatio: number;
  /** Number of queue lines tagged with this device after window/dedup. */
  rows: number;
  /** Distinct `hour_start` buckets the device hit. */
  activeHours: number;
  /** Distinct normalised model strings the device used. */
  distinctModels: number;
  /** Distinct source strings the device used. */
  distinctSources: number;
  /** Earliest `hour_start` seen for this device (ISO). */
  firstSeen: string;
  /** Latest `hour_start` seen for this device (ISO). */
  lastSeen: string;
}

export interface DeviceShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  /** Echo of the resolved minTokens floor. */
  minTokens: number;
  /** Echo of the resolved `top` cap (0 = no cap). */
  top: number;
  /** Sum of total_tokens across all kept rows for the *global* row. */
  totalTokens: number;
  /** Distinct devices observed before display filters. */
  totalDevices: number;
  /** Rows where hour_start did not parse as an ISO instant. */
  droppedInvalidHourStart: number;
  /** Rows with total_tokens <= 0 or non-finite. */
  droppedZeroTokens: number;
  /** Rows with empty / non-string `device_id` (counted, dropped). */
  droppedEmptyDevice: number;
  /** Device rows hidden by the minTokens floor. */
  droppedMinTokens: number;
  /** Device rows hidden by the `top` cap (counted after other floors). */
  droppedTopDevices: number;
  /**
   * One row per kept device. Sorted by total tokens desc, then
   * deviceId asc.
   */
  devices: DeviceShareRow[];
}

export function buildDeviceShare(
  queue: QueueLine[],
  opts: DeviceShareOptions = {},
): DeviceShareReport {
  const minTokens = opts.minTokens ?? 0;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(`minTokens must be a non-negative number (got ${opts.minTokens})`);
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
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

  interface Acc {
    deviceId: string;
    totalTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    rows: number;
    hours: Set<string>;
    models: Set<string>;
    sources: Set<string>;
    firstSeenMs: number;
    lastSeenMs: number;
    firstSeen: string;
    lastSeen: string;
  }

  const agg = new Map<string, Acc>();
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  let droppedEmptyDevice = 0;
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

    const dev = typeof q.device_id === 'string' ? q.device_id.trim() : '';
    if (dev === '') {
      droppedEmptyDevice += 1;
      continue;
    }

    let a = agg.get(dev);
    if (!a) {
      a = {
        deviceId: dev,
        totalTokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        rows: 0,
        hours: new Set<string>(),
        models: new Set<string>(),
        sources: new Set<string>(),
        firstSeenMs: ms,
        lastSeenMs: ms,
        firstSeen: q.hour_start,
        lastSeen: q.hour_start,
      };
      agg.set(dev, a);
    }
    a.totalTokens += tt;
    const inT = Number(q.input_tokens);
    if (Number.isFinite(inT) && inT > 0) a.inputTokens += inT;
    const cinT = Number(q.cached_input_tokens);
    if (Number.isFinite(cinT) && cinT > 0) a.cachedInputTokens += cinT;
    const outT = Number(q.output_tokens);
    if (Number.isFinite(outT) && outT > 0) a.outputTokens += outT;
    const rrT = Number(q.reasoning_output_tokens);
    if (Number.isFinite(rrT) && rrT > 0) a.reasoningOutputTokens += rrT;
    a.rows += 1;
    a.hours.add(q.hour_start);
    a.models.add(normaliseModel(typeof q.model === 'string' ? q.model : ''));
    a.sources.add(
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown',
    );
    if (ms < a.firstSeenMs) {
      a.firstSeenMs = ms;
      a.firstSeen = q.hour_start;
    }
    if (ms > a.lastSeenMs) {
      a.lastSeenMs = ms;
      a.lastSeen = q.hour_start;
    }
    globalTotal += tt;
  }

  const totalDevices = agg.size;
  const all: DeviceShareRow[] = [];
  for (const a of agg.values()) {
    const cacheHitRatio =
      a.inputTokens > 0 ? a.cachedInputTokens / a.inputTokens : 0;
    all.push({
      deviceId: a.deviceId,
      totalTokens: a.totalTokens,
      share: globalTotal > 0 ? a.totalTokens / globalTotal : 0,
      inputTokens: a.inputTokens,
      cachedInputTokens: a.cachedInputTokens,
      outputTokens: a.outputTokens,
      reasoningOutputTokens: a.reasoningOutputTokens,
      cacheHitRatio,
      rows: a.rows,
      activeHours: a.hours.size,
      distinctModels: a.models.size,
      distinctSources: a.sources.size,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
    });
  }

  // Apply minTokens floor.
  let droppedMinTokens = 0;
  const afterMin: DeviceShareRow[] = [];
  for (const row of all) {
    if (row.totalTokens < minTokens) {
      droppedMinTokens += 1;
      continue;
    }
    afterMin.push(row);
  }

  // Sort: total tokens desc, deviceId asc on tie.
  afterMin.sort((a, b) => {
    if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
    return a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0;
  });

  // Apply top cap.
  let droppedTopDevices = 0;
  let kept = afterMin;
  if (top > 0 && afterMin.length > top) {
    droppedTopDevices = afterMin.length - top;
    kept = afterMin.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    top,
    totalTokens: globalTotal,
    totalDevices,
    droppedInvalidHourStart,
    droppedZeroTokens,
    droppedEmptyDevice,
    droppedMinTokens,
    droppedTopDevices,
    devices: kept,
  };
}
