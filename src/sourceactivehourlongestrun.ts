/**
 * source-active-hour-longest-run: per-source longest *contiguous* run of
 * *active* UTC hours-of-day (those with positive token mass) on the
 * circular 24-cycle.
 *
 * SCAFFOLD — types only. Builder lands in the next commit.
 *
 * Orthogonal to source-dead-hour-count (which measures liveHours count
 * and longestDeadRun): two sources can have identical liveHours but
 * very different longestActiveRun depending on whether their active
 * mass is one contiguous shift or scattered across the 24-hour clock.
 */
import type { QueueLine } from './types.js';

export type SourceActiveHourLongestRunSort =
  | 'tokens'
  | 'run'
  | 'active'
  | 'share'
  | 'source';

export interface SourceActiveHourLongestRunOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceActiveHourLongestRunSort;
  minLongestActiveRun?: number;
  generatedAt?: string;
}

export interface SourceActiveHourLongestRunSourceRow {
  source: string;
  totalTokens: number;
  nBuckets: number;
  firstDay: string;
  lastDay: string;
  hourMass: number[];
  activeHours: number;
  longestActiveRun: number;
  activeRunCount: number;
  activeRunShare: number;
  longestRunStart: number;
}

export interface SourceActiveHourLongestRunReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceActiveHourLongestRunSort;
  minLongestActiveRun: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinLongestActiveRun: number;
  droppedTopSources: number;
  sources: SourceActiveHourLongestRunSourceRow[];
}

export function buildSourceActiveHourLongestRun(
  _queue: QueueLine[],
  opts: SourceActiveHourLongestRunOptions = {},
): SourceActiveHourLongestRunReport {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens: opts.minTokens ?? 1000,
    top: opts.top ?? 0,
    sort: opts.sort ?? 'tokens',
    minLongestActiveRun: opts.minLongestActiveRun ?? 0,
    source: opts.source ?? null,
    totalTokens: 0,
    totalSources: 0,
    droppedInvalidHourStart: 0,
    droppedNonPositiveTokens: 0,
    droppedSourceFilter: 0,
    droppedSparseSources: 0,
    droppedBelowMinLongestActiveRun: 0,
    droppedTopSources: 0,
    sources: [],
  };
}
