/**
 * source-rank-churn: day-over-day instability of the
 * source-by-tokens leaderboard.
 *
 * For every consecutive UTC-date pair `(d, d+1)` that both have
 * at least one row in the window, rank the sources by their
 * `total_tokens` on each of the two days (descending; ties
 * broken by source name ascending). Take the **union** of
 * sources that appeared on either day; sources missing on one
 * side get an "absent rank" equal to `unionSize` (i.e. they
 * count as one slot below the worst observed rank on that day,
 * symmetric on both sides). Compute the **normalised Spearman
 * footrule**:
 *
 *     footrule(d, d+1) = sum_i |rank_d(i) - rank_{d+1}(i)|
 *                       / maxFootrule(unionSize)
 *
 * where the denominator is the maximum possible value for a
 * full reversal of `unionSize` ranks
 * (`floor(n^2 / 2)` for `n = unionSize`). The result lives in
 * `[0, 1]`: 0 = leaderboard byte-identical day-over-day,
 * 1 = perfect reversal.
 *
 * Why a fresh subcommand:
 *
 *   - `source-mix` / `provider-share` / `agent-mix` are
 *     **share-concentration** lenses on the *whole window*.
 *     They cannot tell whether share-rank-2 yesterday is the
 *     same source as share-rank-2 today.
 *   - `source-tenure` and `provider-tenure` measure *first-seen
 *     to last-seen* spans — they collapse the entire dataset
 *     into one number per source and never look at adjacent days.
 *   - `source-decay-half-life` is a within-source decay model;
 *     it does not compare sources against each other.
 *   - `transitions` and `inter-source-handoff-latency` are
 *     **session-adjacency** matrices over `started_at`, not
 *     daily-aggregate leaderboard reshuffles.
 *   - `weekday-share` collapses across weeks and never measures
 *     adjacent-day reshuffles.
 *
 * What we emit:
 *
 *   - global rollup: `dayPairs`, `meanFootrule`, `medianFootrule`,
 *     `p90Footrule`, `maxFootrule`, `stableDayPairs` (footrule
 *     == 0), `chaosDayPairs` (footrule >= 0.5).
 *   - per-source row (sorted by `meanRank` asc, source asc):
 *     `daysObserved`, `meanRank`, `stddevRank`, `bestRank`,
 *     `worstRank`, `distinctRanks` (Tony Plate-style rank
 *     entropy in slots, not bits — purely structural).
 *
 * Determinism: pure builder. No `Date.now()` reads outside the
 * `generatedAt` default. UTC date keys derived by slicing
 * `hour_start` to `YYYY-MM-DD` (every recent subcommand uses
 * the same convention; matches `weekday-share`).
 */
import type { QueueLine } from './types.js';

export interface SourceRankChurnOptions {
  /** Inclusive ISO lower bound on `hour_start`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `hour_start`. null = no upper bound. */
  until?: string | null;
  /**
   * Drop sources that contributed fewer than this many distinct
   * UTC dates of activity. Default 1 (keep everything). Useful
   * when a one-off source appearance dominates the union and
   * inflates the footrule denominator.
   */
  minDays?: number;
  /**
   * If > 0, cap the per-source `sources[]` to the top K by
   * `meanRank` asc (the "leaders"). Hidden rows surface as
   * `droppedBelowTopK`. The global rollup is computed on the
   * full kept set *before* the cap, mirroring the
   * `bucket-token-gini` / `hour-of-day-token-skew` convention.
   */
  topK?: number | null;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceRankChurnSourceRow {
  source: string;
  /** Distinct UTC dates this source had ≥1 token on. */
  daysObserved: number;
  /** Mean rank across observed days (1-indexed). */
  meanRank: number;
  /** Population stddev of rank across observed days. 0 if 1 obs. */
  stddevRank: number;
  /** Best (numerically smallest) rank ever held. */
  bestRank: number;
  /** Worst (numerically largest) rank ever held. */
  worstRank: number;
  /** Distinct rank values touched. */
  distinctRanks: number;
  /** Sum of `total_tokens` across observed days. */
  totalTokens: number;
}

export interface SourceRankChurnReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  minDays: number;
  topK: number | null;
  /** Distinct UTC dates seen in the window. */
  observedDays: number;
  /** Distinct UTC dates after `minDays` filtering of sources is applied. */
  consideredDays: number;
  /** Distinct sources kept after `minDays`. */
  keptSources: number;
  /** Adjacent UTC-date pairs (both sides have ≥1 kept token). */
  dayPairs: number;
  /** Day-pairs whose normalised footrule is exactly 0 (perfect carryover). */
  stableDayPairs: number;
  /** Day-pairs whose normalised footrule is ≥ 0.5. */
  chaosDayPairs: number;
  /** Mean normalised footrule across all `dayPairs`. */
  meanFootrule: number;
  /** Median (nearest-rank) normalised footrule. */
  medianFootrule: number;
  /** 90th-pct (nearest-rank) normalised footrule. */
  p90Footrule: number;
  /** Maximum observed normalised footrule. */
  maxFootrule: number;
  /** Rows dropped from `sources[]` because of `topK`. 0 if topK == null. */
  droppedBelowTopK: number;
  /** Rows dropped because `daysObserved < minDays`. */
  droppedBelowMinDays: number;
  /** Rows dropped because `hour_start` failed to parse. */
  droppedInvalidHourStart: number;
  /** Rows dropped because `total_tokens` was non-positive. */
  droppedZeroTokens: number;
  /** Per-source rows, sorted by `meanRank` asc, source asc. */
  sources: SourceRankChurnSourceRow[];
}

interface PerDayPerSource {
  date: string; // YYYY-MM-DD
  totals: Map<string, number>; // source -> tokens that day
}

function nearestRank(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (q <= 0) return sortedAsc[0]!;
  if (q >= 1) return sortedAsc[sortedAsc.length - 1]!;
  const k = Math.max(1, Math.ceil(q * sortedAsc.length));
  return sortedAsc[k - 1]!;
}

function rankSourcesForDay(totals: Map<string, number>): Map<string, number> {
  // Rank by tokens desc, source asc; dense ranks (1..n) with no
  // gaps. Ties on tokens get distinct ranks broken by source asc
  // so the comparison is fully deterministic.
  const entries = [...totals.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  const ranks = new Map<string, number>();
  for (let i = 0; i < entries.length; i++) {
    ranks.set(entries[i]![0], i + 1);
  }
  return ranks;
}

function isUtcDateString(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function nextUtcDate(d: string): string {
  const ms = Date.parse(`${d}T00:00:00.000Z`);
  return new Date(ms + 86_400_000).toISOString().slice(0, 10);
}

export function buildSourceRankChurn(
  rows: QueueLine[],
  opts: SourceRankChurnOptions = {},
): SourceRankChurnReport {
  const minDays = opts.minDays ?? 1;
  if (!Number.isFinite(minDays) || minDays < 1 || !Number.isInteger(minDays)) {
    throw new Error(`minDays must be a positive integer (got ${opts.minDays})`);
  }
  const topK = opts.topK ?? null;
  if (topK !== null) {
    if (!Number.isFinite(topK) || topK < 1 || !Number.isInteger(topK)) {
      throw new Error(`topK must be a positive integer or null (got ${opts.topK})`);
    }
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

  // ---- ingest ---------------------------------------------------
  let droppedInvalidHourStart = 0;
  let droppedZeroTokens = 0;
  // date -> source -> tokens
  const perDay = new Map<string, Map<string, number>>();
  // source -> distinct date set
  const sourceDays = new Map<string, Set<string>>();

  for (const r of rows) {
    const ms = Date.parse(r.hour_start);
    if (!Number.isFinite(ms)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    if (sinceMs !== null && ms < sinceMs) continue;
    if (untilMs !== null && ms >= untilMs) continue;
    const t = Number(r.total_tokens);
    if (!Number.isFinite(t) || t <= 0) {
      droppedZeroTokens += 1;
      continue;
    }
    const date = new Date(ms).toISOString().slice(0, 10);
    if (!isUtcDateString(date)) {
      droppedInvalidHourStart += 1;
      continue;
    }
    const src = typeof r.source === 'string' && r.source.length > 0 ? r.source : 'unknown';
    let m = perDay.get(date);
    if (!m) {
      m = new Map<string, number>();
      perDay.set(date, m);
    }
    m.set(src, (m.get(src) ?? 0) + t);
    let s = sourceDays.get(src);
    if (!s) {
      s = new Set<string>();
      sourceDays.set(src, s);
    }
    s.add(date);
  }

  const observedDays = perDay.size;

  // ---- minDays filter applied to source membership --------------
  const keptSourceSet = new Set<string>();
  let droppedBelowMinDays = 0;
  for (const [src, days] of sourceDays) {
    if (days.size >= minDays) keptSourceSet.add(src);
    else droppedBelowMinDays += 1;
  }

  // Filter perDay totals to kept sources only; drop days that
  // become empty afterwards.
  const filteredPerDay: PerDayPerSource[] = [];
  for (const [date, totals] of perDay) {
    const kept = new Map<string, number>();
    for (const [src, t] of totals) {
      if (keptSourceSet.has(src)) kept.set(src, t);
    }
    if (kept.size > 0) filteredPerDay.push({ date, totals: kept });
  }
  filteredPerDay.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const consideredDays = filteredPerDay.length;

  // ---- per-day ranks --------------------------------------------
  const dateToRanks = new Map<string, Map<string, number>>();
  for (const d of filteredPerDay) {
    dateToRanks.set(d.date, rankSourcesForDay(d.totals));
  }

  // ---- adjacent-day footrules -----------------------------------
  const footrules: number[] = [];
  for (let i = 1; i < filteredPerDay.length; i++) {
    const prev = filteredPerDay[i - 1]!;
    const cur = filteredPerDay[i]!;
    if (cur.date !== nextUtcDate(prev.date)) continue; // require *adjacent* dates
    const prevRanks = dateToRanks.get(prev.date)!;
    const curRanks = dateToRanks.get(cur.date)!;
    const union = new Set<string>([...prevRanks.keys(), ...curRanks.keys()]);
    const n = union.size;
    if (n < 2) continue; // footrule undefined on a single source
    const absentRank = n; // one slot below the worst observed
    let raw = 0;
    for (const s of union) {
      const a = prevRanks.get(s) ?? absentRank;
      const b = curRanks.get(s) ?? absentRank;
      raw += Math.abs(a - b);
    }
    // Max footrule for n ranks under full reversal.
    const denom = Math.floor((n * n) / 2);
    if (denom === 0) continue;
    footrules.push(raw / denom);
  }

  const dayPairs = footrules.length;
  const sortedFr = [...footrules].sort((a, b) => a - b);
  const meanFootrule =
    dayPairs === 0 ? 0 : footrules.reduce((acc, x) => acc + x, 0) / dayPairs;
  const medianFootrule = nearestRank(sortedFr, 0.5);
  const p90Footrule = nearestRank(sortedFr, 0.9);
  const maxFootrule = dayPairs === 0 ? 0 : sortedFr[sortedFr.length - 1]!;
  const stableDayPairs = footrules.filter((x) => x === 0).length;
  const chaosDayPairs = footrules.filter((x) => x >= 0.5).length;

  // ---- per-source rank volatility -------------------------------
  // Use the per-day ranks computed above (over kept sources only).
  const perSourceRanks = new Map<string, number[]>();
  const perSourceTokens = new Map<string, number>();
  for (const d of filteredPerDay) {
    const ranks = dateToRanks.get(d.date)!;
    for (const [src, rk] of ranks) {
      let arr = perSourceRanks.get(src);
      if (!arr) {
        arr = [];
        perSourceRanks.set(src, arr);
      }
      arr.push(rk);
    }
    for (const [src, t] of d.totals) {
      perSourceTokens.set(src, (perSourceTokens.get(src) ?? 0) + t);
    }
  }

  let sources: SourceRankChurnSourceRow[] = [];
  for (const [src, ranks] of perSourceRanks) {
    const n = ranks.length;
    const mean = ranks.reduce((a, b) => a + b, 0) / n;
    const variance =
      n === 1 ? 0 : ranks.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
    const stddev = Math.sqrt(variance);
    let best = ranks[0]!;
    let worst = ranks[0]!;
    const distinct = new Set<number>();
    for (const r of ranks) {
      if (r < best) best = r;
      if (r > worst) worst = r;
      distinct.add(r);
    }
    sources.push({
      source: src,
      daysObserved: n,
      meanRank: mean,
      stddevRank: stddev,
      bestRank: best,
      worstRank: worst,
      distinctRanks: distinct.size,
      totalTokens: perSourceTokens.get(src) ?? 0,
    });
  }
  sources.sort((a, b) => {
    if (a.meanRank !== b.meanRank) return a.meanRank - b.meanRank;
    return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
  });

  const keptSources = sources.length;
  let droppedBelowTopK = 0;
  if (topK !== null && sources.length > topK) {
    droppedBelowTopK = sources.length - topK;
    sources = sources.slice(0, topK);
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    minDays,
    topK,
    observedDays,
    consideredDays,
    keptSources,
    dayPairs,
    stableDayPairs,
    chaosDayPairs,
    meanFootrule,
    medianFootrule,
    p90Footrule,
    maxFootrule,
    droppedBelowTopK,
    droppedBelowMinDays,
    droppedInvalidHourStart,
    droppedZeroTokens,
    sources,
  };
}
