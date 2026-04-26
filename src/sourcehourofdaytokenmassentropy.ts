/**
 * source-hour-of-day-token-mass-entropy: per-source Shannon entropy
 * of the token-mass distribution over UTC hours-of-day (0..23).
 *
 * For each source we collapse every hourly bucket onto a length-24
 * vector indexed by UTC hour-of-day (same axis as
 * `source-dead-hour-count` / `source-active-hour-longest-run` /
 * `source-token-mass-hour-centroid`),
 *
 *   M_h = sum_{rows with utc-hour = h} total_tokens     (h in 0..23)
 *
 * normalize to a probability distribution
 *
 *   p_h = M_h / sum_h M_h
 *
 * and report the Shannon entropy (in bits, log base 2):
 *
 *   H = - sum_{p_h > 0} p_h * log2(p_h)
 *
 * with derived quantities:
 *
 *   - `entropyBits`:           H in [0, log2(24)] = [0, ~4.585]
 *   - `entropyNormalized`:     H / log2(24) in [0, 1]. 1 means token
 *                              mass is *perfectly uniform* across all
 *                              24 hours; 0 means it sits in a single
 *                              hour.
 *   - `effectiveHours` = 2^H:  perplexity. The "equivalent number of
 *                              hours" the source is concentrated in,
 *                              if those hours each carried equal
 *                              mass. Always in (0, 24]; equals
 *                              activeHours iff the active hours
 *                              carry exactly equal mass.
 *   - `concentrationGap` =
 *       activeHours - effectiveHours in [0, activeHours): the gap
 *       between *raw breadth* and *effective breadth*. 0 means the
 *       source's active hours are equal-mass; large positive values
 *       mean breadth is illusory (one or two hours dominate).
 *   - `topHourShare`:          mass share of the single busiest hour
 *                              (max p_h). Concentration sanity check.
 *   - `topHour`:               UTC hour 0..23 of the busiest hour.
 *   - `activeHours`:           count of hours with p_h > 0 (range
 *                              0..24, same definition as
 *                              `source-active-hour-longest-run`).
 *
 * Why orthogonal to everything that already ships:
 *
 *   - `hour-of-day-source-mix-entropy` is the *cross-source* axis at
 *     each hour ("at 14:00 UTC, how mixed is the source roster?").
 *     This subcommand is the *within-source* axis across hours ("for
 *     source X, how spread is its day?"). Different probability
 *     space, different question.
 *   - `model-mix-entropy` is entropy of the *model* axis at the
 *     workspace level. Different axis entirely.
 *   - `source-token-mass-hour-centroid` reports the *circular mean*
 *     hour. Two sources with mass in {09, 10, 11} and {00..23
 *     uniform} can have similar centroids (~10 vs the circular mean
 *     of uniform is undefined / arbitrary), but the entropies are
 *     log2(3) vs log2(24) — a 3.6x gap that the centroid hides.
 *   - `source-dead-hour-count` and `source-active-hour-longest-run`
 *     count *which* hours are zero/positive. They treat all positive
 *     hours equally. A source with p = (0.95, 0.025, 0.025) and one
 *     with p = (0.34, 0.33, 0.33) on the same 3 hours both report
 *     activeHours=3, longestActiveRun=3, but entropies are ~0.34
 *     and ~1.585 bits respectively. This subcommand surfaces that
 *     gap and quantifies it via `concentrationGap`.
 *   - `source-hour-of-day-topk-mass-share` reports the lump share of
 *     the top-k hours. It is monotone and partial; entropy is the
 *     full distributional summary in one scalar.
 *   - `daily-token-gini-coefficient` is the *daily* axis (per-day
 *     totals across the calendar window), not hour-of-day.
 *
 * Headline question:
 *   **"For each source, how spread out is its token mass across the
 *   24-hour clock — and is the apparent spread real or driven by one
 *   dominant hour?"**
 *
 * Determinism: pure builder. Wall clock only via `opts.generatedAt`.
 *
 * Knobs:
 *
 *   - `since` / `until`: ISO time-window filter on `hour_start`.
 *   - `source`: restrict to a single source; non-matching surface as
 *     `droppedSourceFilter`.
 *   - `minTokens` (default 1000): structural floor on total token
 *     mass per source. Sparse sources surface as
 *     `droppedSparseSources`.
 *   - `top` (default 0 = no cap): display cap on `sources[]`.
 *     Suppressed surface as `droppedTopSources`.
 *   - `sort` (default 'tokens'): 'tokens' | 'entropy' | 'normalized'
 *     | 'effective' | 'gap' | 'top-share' | 'source'.
 *     'entropy' / 'normalized' / 'effective' = desc.
 *     'gap' = concentrationGap desc (most-illusory-breadth first).
 *     'top-share' = topHourShare desc (most-concentrated first).
 *   - `minNormalized` (refinement, v0.6.46): drop rows whose
 *     `entropyNormalized` is strictly below this float in [0, 1].
 *     Default 0 = no filter. Useful for surfacing only sources with
 *     genuine spread; e.g. `--min-normalized 0.7` keeps only sources
 *     using their day broadly. Counts surface as
 *     `droppedBelowMinNormalized`.
 *   - `tz` is intentionally NOT a knob: hour-of-day is read from the
 *     UTC timestamp, matching every other time-axis stat in this
 *     codebase.
 */
import type { QueueLine } from './types.js';

export type SourceHourEntropySort =
  | 'tokens'
  | 'entropy'
  | 'normalized'
  | 'effective'
  | 'gap'
  | 'top-share'
  | 'source';

export interface SourceHourEntropyOptions {
  since?: string | null;
  until?: string | null;
  source?: string | null;
  minTokens?: number;
  top?: number;
  sort?: SourceHourEntropySort;
  /**
   * Display filter (refinement, v0.6.46): drop rows whose
   * `entropyNormalized` is strictly below this float in [0, 1].
   * Default 0 = no filter.
   */
  minNormalized?: number;
  /**
   * Display filter (refinement, v0.6.47): drop rows whose
   * `effectiveHours` (= 2^entropyBits) is strictly below this
   * float in [0, 24]. Complementary to `minNormalized`: surfaces
   * sources whose *real* spread (perplexity) clears a concrete
   * hour-count threshold, regardless of how many raw active hours
   * they touch. A source with `activeHours=24` but
   * `effectiveHours=2.1` (mass dumped in two hours, the rest a
   * thin tail) passes `--min-normalized 0.3` but is filtered out
   * by `--min-effective-hours 6`. Counts surface as
   * `droppedBelowMinEffectiveHours`.
   * Range [0, 24]; default 0 = no filter.
   */
  minEffectiveHours?: number;
  generatedAt?: string;
}

export interface SourceHourEntropyRow {
  source: string;
  totalTokens: number;
  /** Number of distinct UTC hour-buckets that contributed rows. */
  nBuckets: number;
  /** First and last UTC day contributing rows (yyyy-mm-dd). */
  firstDay: string;
  lastDay: string;
  /** Token mass per UTC hour-of-day (length 24). */
  hourMass: number[];
  /** Count of hour-of-day bins with mass > 0. Range 0..24. */
  activeHours: number;
  /** Shannon entropy in bits. Range [0, log2(24)] = [0, ~4.585]. */
  entropyBits: number;
  /** entropyBits / log2(24). Range [0, 1]. */
  entropyNormalized: number;
  /** 2^entropyBits. Perplexity (effective number of active hours). */
  effectiveHours: number;
  /** activeHours - effectiveHours. Range [0, activeHours). */
  concentrationGap: number;
  /** Mass share of the single busiest hour. Range (0, 1]. */
  topHourShare: number;
  /** UTC hour-of-day of the busiest hour, or -1 if no mass. */
  topHour: number;
}

export interface SourceHourEntropyReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minTokens: number;
  top: number;
  sort: SourceHourEntropySort;
  minNormalized: number;
  minEffectiveHours: number;
  source: string | null;
  totalTokens: number;
  totalSources: number;
  /** log2(24), exposed so callers can reconstruct the normalization. */
  maxEntropyBits: number;
  droppedInvalidHourStart: number;
  droppedNonPositiveTokens: number;
  droppedSourceFilter: number;
  droppedSparseSources: number;
  droppedBelowMinNormalized: number;
  droppedBelowMinEffectiveHours: number;
  droppedTopSources: number;
  sources: SourceHourEntropyRow[];
}

export const MAX_HOUR_ENTROPY_BITS = Math.log2(24);

/**
 * Shannon entropy in bits of a non-negative mass vector.
 * Returns 0 for the all-zero vector and for any vector with exactly
 * one positive entry. Ignores zero entries (0 * log 0 := 0).
 */
export function shannonEntropyBits(mass: number[]): number {
  let total = 0;
  for (const m of mass) {
    if (m < 0) {
      throw new Error(`shannonEntropyBits: negative mass entry ${m}`);
    }
    total += m;
  }
  if (total === 0) return 0;
  let h = 0;
  for (const m of mass) {
    if (m === 0) continue;
    const p = m / total;
    h -= p * Math.log2(p);
  }
  // Clamp tiny negative drift from floating-point rounding.
  if (h < 0 && h > -1e-12) h = 0;
  return h;
}

export function buildSourceHourOfDayTokenMassEntropy(
  queue: QueueLine[],
  opts: SourceHourEntropyOptions = {},
): SourceHourEntropyReport {
  const minTokens = opts.minTokens ?? 1000;
  if (!Number.isFinite(minTokens) || minTokens < 0) {
    throw new Error(
      `minTokens must be a non-negative finite number (got ${opts.minTokens})`,
    );
  }
  const top = opts.top ?? 0;
  if (!Number.isInteger(top) || top < 0) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }
  const minNormalized = opts.minNormalized ?? 0;
  if (
    !Number.isFinite(minNormalized) ||
    minNormalized < 0 ||
    minNormalized > 1
  ) {
    throw new Error(
      `minNormalized must be a finite number in [0, 1] (got ${opts.minNormalized})`,
    );
  }
  const minEffectiveHours = opts.minEffectiveHours ?? 0;
  if (
    !Number.isFinite(minEffectiveHours) ||
    minEffectiveHours < 0 ||
    minEffectiveHours > 24
  ) {
    throw new Error(
      `minEffectiveHours must be a finite number in [0, 24] (got ${opts.minEffectiveHours})`,
    );
  }
  const sort: SourceHourEntropySort = opts.sort ?? 'tokens';
  const validSorts: SourceHourEntropySort[] = [
    'tokens',
    'entropy',
    'normalized',
    'effective',
    'gap',
    'top-share',
    'source',
  ];
  if (!validSorts.includes(sort)) {
    throw new Error(
      `sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
    );
  }
  const sourceFilter = opts.source ?? null;
  if (sourceFilter !== null && typeof sourceFilter !== 'string') {
    throw new Error(`source must be a string when set (got ${typeof sourceFilter})`);
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

  interface SrcAcc {
    mass: number[];
    nBuckets: number;
    totalTokens: number;
    firstDay: string;
    lastDay: string;
  }
  const agg = new Map<string, SrcAcc>();
  let droppedInvalidHourStart = 0;
  let droppedNonPositiveTokens = 0;
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
      droppedNonPositiveTokens += 1;
      continue;
    }
    const src =
      typeof q.source === 'string' && q.source !== '' ? q.source : '(unknown)';
    if (sourceFilter !== null && src !== sourceFilter) {
      droppedSourceFilter += 1;
      continue;
    }
    const hour = new Date(ms).getUTCHours();
    const day = q.hour_start.slice(0, 10);
    let acc = agg.get(src);
    if (!acc) {
      acc = {
        mass: new Array(24).fill(0),
        nBuckets: 0,
        totalTokens: 0,
        firstDay: day,
        lastDay: day,
      };
      agg.set(src, acc);
    }
    acc.mass[hour] = (acc.mass[hour] ?? 0) + tt;
    acc.totalTokens += tt;
    acc.nBuckets += 1;
    if (day < acc.firstDay) acc.firstDay = day;
    if (day > acc.lastDay) acc.lastDay = day;
  }

  const totalSources = agg.size;
  let droppedSparseSources = 0;
  let totalTokensSum = 0;
  const rows: SourceHourEntropyRow[] = [];

  for (const [src, acc] of agg) {
    if (acc.totalTokens < minTokens) {
      droppedSparseSources += 1;
      continue;
    }
    let activeHours = 0;
    let topHour = -1;
    let topMass = -1;
    for (let h = 0; h < 24; h++) {
      const m = acc.mass[h] ?? 0;
      if (m > 0) {
        activeHours += 1;
        if (m > topMass) {
          topMass = m;
          topHour = h;
        }
      }
    }
    const entropyBits = shannonEntropyBits(acc.mass);
    const entropyNormalized =
      MAX_HOUR_ENTROPY_BITS > 0 ? entropyBits / MAX_HOUR_ENTROPY_BITS : 0;
    const effectiveHours = entropyBits > 0 ? Math.pow(2, entropyBits) : (activeHours === 1 ? 1 : 0);
    const concentrationGap = activeHours - effectiveHours;
    const topHourShare = topMass > 0 ? topMass / acc.totalTokens : 0;
    rows.push({
      source: src,
      totalTokens: acc.totalTokens,
      nBuckets: acc.nBuckets,
      firstDay: acc.firstDay,
      lastDay: acc.lastDay,
      hourMass: acc.mass.slice(),
      activeHours,
      entropyBits,
      entropyNormalized,
      effectiveHours,
      concentrationGap,
      topHourShare,
      topHour,
    });
    totalTokensSum += acc.totalTokens;
  }

  // refinement filter (v0.6.46)
  let droppedBelowMinNormalized = 0;
  let filtered = rows;
  if (minNormalized > 0) {
    const next: SourceHourEntropyRow[] = [];
    for (const r of rows) {
      if (r.entropyNormalized >= minNormalized) next.push(r);
      else droppedBelowMinNormalized += 1;
    }
    filtered = next;
  }

  // refinement filter (v0.6.47): perplexity threshold
  let droppedBelowMinEffectiveHours = 0;
  if (minEffectiveHours > 0) {
    const next: SourceHourEntropyRow[] = [];
    for (const r of filtered) {
      if (r.effectiveHours >= minEffectiveHours) next.push(r);
      else droppedBelowMinEffectiveHours += 1;
    }
    filtered = next;
  }

  filtered.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'entropy':
        primary = b.entropyBits - a.entropyBits;
        break;
      case 'normalized':
        primary = b.entropyNormalized - a.entropyNormalized;
        break;
      case 'effective':
        primary = b.effectiveHours - a.effectiveHours;
        break;
      case 'gap':
        primary = b.concentrationGap - a.concentrationGap;
        break;
      case 'top-share':
        primary = b.topHourShare - a.topHourShare;
        break;
      case 'source':
        primary = 0;
        break;
      case 'tokens':
      default:
        primary = b.totalTokens - a.totalTokens;
        break;
    }
    if (primary !== 0 && Number.isFinite(primary)) return primary;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  let droppedTopSources = 0;
  let kept = filtered;
  if (top > 0 && filtered.length > top) {
    droppedTopSources = filtered.length - top;
    kept = filtered.slice(0, top);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minTokens,
    top,
    sort,
    minNormalized,
    minEffectiveHours,
    source: sourceFilter,
    totalTokens: totalTokensSum,
    totalSources,
    maxEntropyBits: MAX_HOUR_ENTROPY_BITS,
    droppedInvalidHourStart,
    droppedNonPositiveTokens,
    droppedSourceFilter,
    droppedSparseSources,
    droppedBelowMinNormalized,
    droppedBelowMinEffectiveHours,
    droppedTopSources,
    sources: kept,
  };
}
