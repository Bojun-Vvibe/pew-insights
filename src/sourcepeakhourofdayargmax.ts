/**
 * source-peak-hour-of-day-argmax: per-source the hour-of-day [0..23]
 * (UTC) at which `total_tokens` mass peaks — i.e. `argmax_h
 * sum_{rows in hour h} total_tokens`. Reports the peak hour, the
 * mass share at the peak (peak / sum_all_hours), and the **margin**
 * to the runner-up hour (peakShare - secondShare).
 *
 * Headline question: **for each source, in which UTC hour does its
 * token mass peak, and is that peak a sharp single-hour spike or a
 * broad plateau?**
 *
 * This is a **mode-like** statistic on the hour-of-day mass
 * histogram, deliberately distinct from
 * `source-token-mass-hour-centroid` which is the **mean-like**
 * (centroid) statistic on the same histogram. A source that runs
 * smoothly across all 24 hours has a centroid near 11.5 but no
 * meaningful argmax; a source that runs in two bursts at 02:00 and
 * 14:00 has a centroid near 8 and an argmax at one of the two
 * spikes (with low margin to the other). A source that runs only
 * during a single 1-hour daily burst at 17:00 has centroid = 17
 * and argmax = 17 with margin = 1.0.
 *
 * Definitions. Per source, let `m[h]` be the sum of `total_tokens`
 * across all kept rows whose `hour_start`'s UTC hour equals `h`,
 * for `h in {0..23}`. Let `T = sum_h m[h]`. Then:
 *
 *   - peakHour            = argmax_h m[h]                    (0..23)
 *   - peakMass            = m[peakHour]
 *   - peakShare           = peakMass / T                     (0..1)
 *   - secondHour          = argmax_h, h != peakHour, m[h]    (0..23 or null)
 *   - secondShare         = m[secondHour] / T                (0..1)
 *   - margin              = peakShare - secondShare          (0..1)
 *   - hoursActive         = |{h : m[h] > 0}|                 (1..24)
 *
 * Tiebreak inside argmax: lowest hour wins (stable + deterministic).
 *
 * Reading guide:
 *
 *   - margin near 1.0   : razor-sharp single-hour spike. The source
 *                         only ever runs in this one hour.
 *   - margin in [0.3, 0.7] : a clear daily peak with a weaker echo
 *                         (e.g. lunch break or a CI re-run window).
 *   - margin near 0     : two or more hours essentially tied; the
 *                         "peak" is statistically meaningless and
 *                         the centroid lens is the right one.
 *   - peakShare near 1/24 (~0.042) : near-uniform across the
 *                         day; argmax is noise.
 *
 * Why this is genuinely orthogonal to every per-source temporal
 * lens already in the codebase:
 *
 *   - `source-token-mass-hour-centroid` is the **mean** of the
 *     hour-of-day mass distribution (a 1st-moment, location
 *     statistic). Argmax is the **mode** (a 0th-order, peak-
 *     selection statistic). For a unimodal, symmetric daily
 *     pattern they coincide; for a multimodal or skewed daily
 *     pattern they diverge by an arbitrary amount. A source with
 *     centroid = 12 could have argmax = 0, 12, or 23.
 *   - `source-hour-of-day-token-mass-entropy` is the Shannon
 *     entropy of the hour-of-day mass distribution (a spread/
 *     dispersion statistic). Two sources with identical entropy
 *     can have different argmax hours.
 *   - `source-hour-of-day-top-k-mass-share` aggregates mass over
 *     the top-k hours (a `k`-hour cumulative concentration).
 *     Argmax is the `k=1` *identity* (which hour) plus the margin
 *     between #1 and #2. Top-k-mass-share at k=1 gives the same
 *     `peakShare` value but does not tell you **which** hour, and
 *     does not give the margin to #2.
 *   - `source-dead-hour-count` counts hours with zero mass.
 *     Argmax cares about the busiest hour, not the empty ones.
 *   - `source-active-hour-longest-run` / `-active-hour-span` are
 *     about contiguous active windows. Argmax picks the single
 *     dominant hour regardless of contiguity.
 *   - `source-day-of-week-token-mass-share` is on day-of-week,
 *     not hour-of-day.
 *   - `source-cumulative-mass-half-life-day` is on the day axis,
 *     not the hour-of-day axis.
 *   - `peak-hour` (top-level, all sources collapsed) reports the
 *     workspace-wide peak hour. This is per-source.
 *   - `hour-of-day-token-skew` / `hour-of-day-source-mix-entropy`
 *     are workspace-wide hour-of-day lenses, not per-source.
 *
 * Algorithm:
 *
 *   1. Filter queue rows by [since, until) and optional `--source`.
 *   2. Drop rows with non-finite `hour_start`.
 *   3. Drop rows with non-positive `total_tokens` (no mass to
 *      contribute to a peak).
 *   4. Per source: accumulate `m[h]` for `h in {0..23}` (UTC hour
 *      from `hour_start`).
 *   5. Skip sources with `T = 0` (degenerate; no peak).
 *   6. Compute peakHour, peakShare, secondHour, secondShare,
 *      margin, hoursActive.
 *   7. Apply display gates: `--min-rows`, `--min-mass`.
 *   8. Sort, then optionally cap with `--top`.
 *
 * Determinism: pure builder. Wall clock only via
 * `opts.generatedAt`. Sort tiebreak is `source` asc.
 */
import type { QueueLine } from './types.js';

export interface SourcePeakHourOfDayArgmaxOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /** Restrict to a single source. Non-matching rows -> droppedSourceFilter. */
  source?: string | null;
  /**
   * Drop sources with fewer than this many kept rows from the per-
   * source table. Display filter only — global denominators reflect
   * the full kept population. Suppressed rows surface as
   * `droppedBelowMinRows`. Must be a positive integer >= 1. Default 1
   * (any source with at least one mass-bearing row qualifies).
   */
  minRows?: number;
  /**
   * Drop sources whose total `total_tokens` mass `T` is strictly
   * below this value. Display filter only. Suppressed rows surface
   * as `droppedBelowMinMass`. Must be finite and non-negative.
   * Default 0 = no floor.
   */
  minMass?: number;
  /**
   * Cap the per-source table to the top N rows after sort + filters.
   * Suppressed rows surface as `droppedBelowTopCap`. Default null =
   * no cap.
   */
  top?: number | null;
  /**
   * Sort key for `sources[]`:
   *   - 'margin-desc' (default): margin desc (sharpest peaks first).
   *   - 'margin-asc':            margin asc (flattest peaks first).
   *   - 'peak-share':            peakShare desc.
   *   - 'peak-hour':             peakHour asc (chronological by UTC hour).
   *   - 'mass':                  total mass T desc.
   *   - 'rows':                  rowsKept desc.
   *   - 'source':                source asc (lex).
   * Final tiebreak in all cases: source key asc.
   */
  sort?:
    | 'margin-desc'
    | 'margin-asc'
    | 'peak-share'
    | 'peak-hour'
    | 'mass'
    | 'rows'
    | 'source';
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourcePeakHourOfDayArgmaxRow {
  source: string;
  rowsKept: number;
  totalMass: number;
  peakHour: number;
  peakMass: number;
  peakShare: number;
  /** null iff only one hour is active (no runner-up exists). */
  secondHour: number | null;
  /** 0 iff no runner-up. */
  secondShare: number;
  /** peakShare - secondShare in [0, 1]. 1.0 iff hoursActive = 1. */
  margin: number;
  hoursActive: number;
}

export interface SourcePeakHourOfDayArgmaxReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  source: string | null;
  minRows: number;
  minMass: number;
  top: number | null;
  sort:
    | 'margin-desc'
    | 'margin-asc'
    | 'peak-share'
    | 'peak-hour'
    | 'mass'
    | 'rows'
    | 'source';
  totalSources: number;
  totalRowsKept: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedZeroMassSources: number;
  droppedBelowMinRows: number;
  droppedBelowMinMass: number;
  droppedBelowTopCap: number;
  sources: SourcePeakHourOfDayArgmaxRow[];
}

const VALID_SORTS = [
  'margin-desc',
  'margin-asc',
  'peak-share',
  'peak-hour',
  'mass',
  'rows',
  'source',
] as const;

interface Acc {
  mass: number[]; // length 24
  rowsKept: number;
  totalMass: number;
}

export function buildSourcePeakHourOfDayArgmax(
  queue: QueueLine[],
  opts: SourcePeakHourOfDayArgmaxOptions = {},
): SourcePeakHourOfDayArgmaxReport {
  const minRows = opts.minRows ?? 1;
  if (!Number.isInteger(minRows) || minRows < 1) {
    throw new Error(
      `minRows must be a positive integer (got ${opts.minRows})`,
    );
  }
  const minMass = opts.minMass ?? 0;
  if (!Number.isFinite(minMass) || minMass < 0) {
    throw new Error(
      `minMass must be a finite, non-negative number (got ${opts.minMass})`,
    );
  }
  const top = opts.top ?? null;
  if (top !== null) {
    if (!Number.isInteger(top) || top < 1) {
      throw new Error(`top must be a positive integer (got ${opts.top})`);
    }
  }
  const sort = opts.sort ?? 'margin-desc';
  if (!(VALID_SORTS as readonly string[]).includes(sort)) {
    throw new Error(
      `sort must be one of ${VALID_SORTS.join('|')} (got ${opts.sort})`,
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

  const perSource = new Map<string, Acc>();

  let droppedInvalidHourStart = 0;
  let droppedSourceFilter = 0;
  let droppedNonPositiveTokens = 0;

  for (const q of queue) {
    const ms = Date.parse(q.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;

    const source =
      typeof q.source === 'string' && q.source !== '' ? q.source : 'unknown';
    if (sourceFilter !== null && source !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }

    const tt = Number(q.total_tokens);
    if (!Number.isFinite(tt) || tt <= 0) {
      droppedNonPositiveTokens += 1;
      continue;
    }

    // hour_start is ISO-8601; read UTC hour from char positions 11..13.
    const hStr = q.hour_start.slice(11, 13);
    let h = Number.parseInt(hStr, 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      h = new Date(ms).getUTCHours();
    }

    let acc = perSource.get(source);
    if (!acc) {
      acc = { mass: new Array(24).fill(0), rowsKept: 0, totalMass: 0 };
      perSource.set(source, acc);
    }
    acc.mass[h] = (acc.mass[h] ?? 0) + tt;
    acc.rowsKept += 1;
    acc.totalMass += tt;
  }

  const totalSources = perSource.size;
  let totalRowsKept = 0;
  let droppedZeroMassSources = 0;
  const allRows: SourcePeakHourOfDayArgmaxRow[] = [];

  for (const [source, acc] of perSource.entries()) {
    totalRowsKept += acc.rowsKept;
    if (acc.totalMass <= 0) {
      // unreachable given the non-positive token gate above, but guard anyway.
      droppedZeroMassSources += 1;
      continue;
    }
    // argmax with lowest-hour tiebreak.
    let peakHour = 0;
    let peakMass = acc.mass[0] ?? 0;
    for (let h = 1; h < 24; h += 1) {
      const m = acc.mass[h] ?? 0;
      if (m > peakMass) {
        peakMass = m;
        peakHour = h;
      }
    }
    // runner-up (lowest hour wins on ties), excluding peakHour.
    let secondHour: number | null = null;
    let secondMass = -1;
    for (let h = 0; h < 24; h += 1) {
      if (h === peakHour) continue;
      const m = acc.mass[h] ?? 0;
      if (m > 0 && m > secondMass) {
        secondMass = m;
        secondHour = h;
      }
    }
    const peakShare = peakMass / acc.totalMass;
    const secondShare =
      secondHour === null ? 0 : (secondMass as number) / acc.totalMass;
    const margin = peakShare - secondShare;
    let hoursActive = 0;
    for (let h = 0; h < 24; h += 1) {
      if ((acc.mass[h] ?? 0) > 0) hoursActive += 1;
    }
    allRows.push({
      source,
      rowsKept: acc.rowsKept,
      totalMass: acc.totalMass,
      peakHour,
      peakMass,
      peakShare,
      secondHour,
      secondShare,
      margin,
      hoursActive,
    });
  }

  let droppedBelowMinRows = 0;
  let droppedBelowMinMass = 0;
  const survived: SourcePeakHourOfDayArgmaxRow[] = [];
  for (const row of allRows) {
    if (row.rowsKept < minRows) {
      droppedBelowMinRows += 1;
      continue;
    }
    if (row.totalMass < minMass) {
      droppedBelowMinMass += 1;
      continue;
    }
    survived.push(row);
  }

  survived.sort((a, b) => {
    let primary = 0;
    if (sort === 'margin-desc') primary = b.margin - a.margin;
    else if (sort === 'margin-asc') primary = a.margin - b.margin;
    else if (sort === 'peak-share') primary = b.peakShare - a.peakShare;
    else if (sort === 'peak-hour') primary = a.peakHour - b.peakHour;
    else if (sort === 'mass') primary = b.totalMass - a.totalMass;
    else if (sort === 'rows') primary = b.rowsKept - a.rowsKept;
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
    minRows,
    minMass,
    top,
    sort,
    totalSources,
    totalRowsKept,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedZeroMassSources,
    droppedBelowMinRows,
    droppedBelowMinMass,
    droppedBelowTopCap,
    sources: finalSources,
  };
}
