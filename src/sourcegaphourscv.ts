/**
 * source-gap-hours-cv: per-source coefficient of variation of the
 * inter-bucket gap distribution.
 *
 * Headline question: **for each source, how dispersed are the
 * gaps (in hours) between consecutive active hour buckets — i.e. is
 * the source clocked-regular, Poisson-ish, or wildly bursty in its
 * spacing?**
 *
 * Intuition. Given the sequence of distinct UTC hour buckets where
 * a source had token mass > 0, define the gap between adjacent
 * buckets as `g_i = t_{i+1} - t_i` (in hours, integer >= 1). The
 * coefficient of variation `gapCv = stddev(g) / mean(g)` is the
 * standard queueing-theory dispersion knob on an inter-arrival
 * sequence:
 *
 *   - `gapCv` near 0     -> highly regular ("clocked"). Every
 *     active hour comes the same number of hours after the previous.
 *     Cron-like producers, pinned poll loops.
 *   - `gapCv` near 1     -> Poisson-ish. Gaps look exponential
 *     (memoryless). Mixed human + machine usage with no preferred
 *     spacing tends here.
 *   - `gapCv` >> 1       -> heavy-tailed / bursty. A few enormous
 *     gaps (multi-day silences) dominate the variance. Project-
 *     style work: dense activity for a stretch, then dark for days.
 *
 * Distinct from every existing lens:
 *
 *   - `interarrival-time` already collects the same per-source gap
 *     sequence but reports it as min/p50/p90/max + a fixed-edge
 *     histogram. It does **not** emit CV. CV compresses the spread
 *     into a single regular-vs-bursty number that enables ranking
 *     across sources, which p50/p90 alone cannot do (a source with
 *     p50=1, p90=2, max=200 and one with p50=1, p90=2, max=4 have
 *     wildly different CV but identical p50/p90).
 *   - `source-burstiness-fano-factor` is variance-to-mean of the
 *     **count** of rows per fixed-width time bucket. CV-of-IAT is
 *     a different statistic on the **gap** distribution. Two sources
 *     can have identical Fano factor but very different gapCv (Fano
 *     is dominated by within-bucket count variance; gapCv is
 *     dominated by between-bucket spacing variance).
 *   - `source-active-day-streak`, `source-decay-half-life`,
 *     `source-dry-spell` look at run lengths or single-event
 *     aggregates, not the dispersion of the gap distribution.
 *   - `idle-gaps` operates on `SessionLine` (per-session message
 *     gaps in seconds), not on per-source hour-bucket activity.
 *
 * Per surviving source we compute:
 *
 *   - hoursActive:  count of distinct UTC hour buckets with
 *                   token_mass > 0 in the window.
 *   - gaps:         hoursActive - 1 (the number of inter-bucket
 *                   gaps; 0 when hoursActive < 2).
 *   - meanGap:      arithmetic mean of g_i, in hours. 0 when
 *                   gaps == 0.
 *   - stdGap:       population stddev of g_i, in hours. 0 when
 *                   gaps == 0 or gaps == 1 (single sample -> 0
 *                   variance by convention).
 *   - gapCv:        stdGap / meanGap if meanGap > 0, else 0.
 *   - minGap:       minimum gap (>= 1) when gaps > 0, else 0.
 *   - maxGap:       maximum gap when gaps > 0, else 0.
 *   - flat:         true iff gaps > 0 and every gap is identical
 *                   (i.e. stdGap == 0 with gaps >= 1). A "perfectly
 *                   clocked" source.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start` or zero `total_tokens`.
 *      The "active" definition mirrors `interarrival-time`: a
 *      bucket counts only if the source put non-zero token mass in it.
 *   3. Per source: collect the set of distinct hour_start ms values;
 *      sort ascending; emit gaps as integer hours.
 *   4. Apply display gates `--min-active-hours` (default 3, since
 *      gaps >= 2 is needed for a non-degenerate CV) and
 *      `--min-mean-gap` (default 0, no floor on typical spacing).
 *   5. Sort, then optionally cap with `--top`.
 *
 * Edge cases:
 *
 *   - A source with hoursActive == 1 has zero gaps. It is dropped
 *     under the default --min-active-hours 3, but is preserved
 *     under --min-active-hours 1 with gapCv reported as 0.
 *   - Two rows in the same hour bucket count as a single active
 *     bucket (gap distribution is over distinct buckets).
 *   - All gaps must be >= 1 hour by construction (distinct
 *     hour-aligned buckets).
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 * Sort is deterministic with `source` asc as the final tiebreak.
 */
import type { QueueLine } from './types.js';

export interface SourceGapHoursCvOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many distinct active hour
   * buckets from the per-source table. Display filter only — global
   * denominators reflect the full kept population. Suppressed rows
   * surface as `droppedBelowMinActiveHours`. Must be a positive
   * integer. Default 3 (need at least 2 gaps for a non-degenerate CV).
   */
  minActiveHours?: number;
  /**
   * Drop sources whose `meanGap` (in hours) is strictly below this
   * value. Display filter only. Suppressed rows surface as
   * `droppedBelowMinMeanGap`. Must be a finite, non-negative number.
   * Default 0 = no floor.
   */
  minMeanGap?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'cv' (default):    gapCv desc.
   *   - 'mean-gap':        meanGap desc.
   *   - 'max-gap':         maxGap desc.
   *   - 'active-hours':    hoursActive desc.
   *   - 'source':          source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?: 'cv' | 'mean-gap' | 'max-gap' | 'active-hours' | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceGapHoursCvRow {
  source: string;
  hoursActive: number;
  gaps: number;
  meanGap: number;
  stdGap: number;
  gapCv: number;
  minGap: number;
  maxGap: number;
  /** True iff gaps >= 1 and every gap is identical (perfectly clocked). */
  flat: boolean;
}

export interface SourceGapHoursCvReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minActiveHours: number;
  minMeanGap: number;
  top: number | null;
  sort: 'cv' | 'mean-gap' | 'max-gap' | 'active-hours' | 'source';
  /** Distinct sources seen pre-filter. */
  totalSources: number;
  /** Sum of distinct active hour buckets across all sources. */
  totalActiveHours: number;
  /** Sum of gap counts across all sources (= totalActiveHours - totalSources where each source has >= 1 active hour). */
  totalGaps: number;
  droppedInvalidHourStart: number;
  droppedZeroTokenMass: number;
  droppedSourceFilter: number;
  droppedBelowMinActiveHours: number;
  droppedBelowMinMeanGap: number;
  droppedBelowTopCap: number;
  sources: SourceGapHoursCvRow[];
}

const HOUR_MS = 3_600_000;

export function buildSourceGapHoursCv(
  queue: QueueLine[],
  opts: SourceGapHoursCvOptions = {},
): SourceGapHoursCvReport {
  const minActiveHours = opts.minActiveHours ?? 3;
  if (!Number.isInteger(minActiveHours) || minActiveHours < 1) {
    throw new Error(
      `minActiveHours must be a positive integer (got ${opts.minActiveHours})`,
    );
  }
  const minMeanGap = opts.minMeanGap ?? 0;
  if (!Number.isFinite(minMeanGap) || minMeanGap < 0) {
    throw new Error(
      `minMeanGap must be a finite, non-negative number (got ${opts.minMeanGap})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'cv';
  const validSorts = ['cv', 'mean-gap', 'max-gap', 'active-hours', 'source'];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
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

  // Per source -> set of distinct hour_start ms values with mass > 0.
  const perSource = new Map<string, Set<number>>();

  let droppedInvalidHourStart = 0;
  let droppedZeroTokenMass = 0;
  let droppedSourceFilter = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const totalRaw = Number(q.total_tokens);
    const totalTok =
      Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : 0;
    if (totalTok === 0) {
      droppedZeroTokenMass += 1;
      continue;
    }

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    let s = perSource.get(source);
    if (!s) {
      s = new Set<number>();
      perSource.set(source, s);
    }
    s.add(ms);
  }

  const totalSources = perSource.size;
  let totalActiveHours = 0;
  let totalGaps = 0;
  const allRows: SourceGapHoursCvRow[] = [];

  for (const [source, set] of perSource.entries()) {
    const hoursActive = set.size;
    totalActiveHours += hoursActive;
    if (hoursActive < 2) {
      allRows.push({
        source,
        hoursActive,
        gaps: 0,
        meanGap: 0,
        stdGap: 0,
        gapCv: 0,
        minGap: 0,
        maxGap: 0,
        flat: false,
      });
      continue;
    }
    const sorted = Array.from(set).sort((a, b) => a - b);
    const gapsArr: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const a = sorted[i - 1] as number;
      const b = sorted[i] as number;
      const g = Math.round((b - a) / HOUR_MS);
      gapsArr.push(g);
    }
    const gapsN = gapsArr.length;
    totalGaps += gapsN;
    let sum = 0;
    let minG = gapsArr[0] as number;
    let maxG = gapsArr[0] as number;
    for (const g of gapsArr) {
      sum += g;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
    }
    const meanGap = sum / gapsN;
    let varSum = 0;
    for (const g of gapsArr) {
      const d = g - meanGap;
      varSum += d * d;
    }
    const stdGap = Math.sqrt(varSum / gapsN);
    const gapCv = meanGap > 0 ? stdGap / meanGap : 0;
    const flat = gapsN >= 1 && stdGap === 0;
    allRows.push({
      source,
      hoursActive,
      gaps: gapsN,
      meanGap,
      stdGap,
      gapCv,
      minGap: minG,
      maxGap: maxG,
      flat,
    });
  }

  let droppedBelowMinActiveHours = 0;
  let droppedBelowMinMeanGap = 0;
  const survived: SourceGapHoursCvRow[] = [];
  for (const row of allRows) {
    if (row.hoursActive < minActiveHours) {
      droppedBelowMinActiveHours += 1;
      continue;
    }
    if (row.meanGap < minMeanGap) {
      droppedBelowMinMeanGap += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'cv') primary = b.gapCv - a.gapCv;
    else if (sort === 'mean-gap') primary = b.meanGap - a.meanGap;
    else if (sort === 'max-gap') primary = b.maxGap - a.maxGap;
    else if (sort === 'active-hours') primary = b.hoursActive - a.hoursActive;
    else primary = a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    if (primary !== 0) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedBelowTopCap = 0;
  let finalSources = survived;
  if (top !== null && survived.length > top) {
    droppedBelowTopCap = survived.length - top;
    finalSources = survived.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    source: sourceFilter,
    minActiveHours,
    minMeanGap,
    top,
    sort,
    totalSources,
    totalActiveHours,
    totalGaps,
    droppedInvalidHourStart,
    droppedZeroTokenMass,
    droppedSourceFilter,
    droppedBelowMinActiveHours,
    droppedBelowMinMeanGap,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
